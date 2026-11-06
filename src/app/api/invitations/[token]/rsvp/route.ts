
import {
  NextRequest,
  NextResponse,
} from "next/server";

import {
  ObjectId,
} from "mongodb";

import {
  getGuestCollection,
  isGuestRsvpStatus,
  type GuestRsvpStatus,
} from "@/lib/wedding-guests";

import {
  getInvitationCollection,
} from "@/lib/wedding-invitations";

// ======================================================
// NAM & THU - PUBLIC RSVP API
// GIAI ĐOẠN 3.11 - KIỂM TRA VÀ ĐỒNG BỘ TOKEN
//
// GET  /api/invitations/[token]/rsvp
// POST /api/invitations/[token]/rsvp
//
// HỖ TRỢ:
// 1. Link thiệp cũ:
//    /invite/<48-character-token>
//
// 2. Link thiệp mới:
//    /invite/<guest-slug>-<48-character-token>
//
// 3. Token công khai trực tiếp:
//    <48-character-publicToken>
//
// DỮ LIỆU:
// - guests: Thông tin khách và RSVP.
// - invitations: Thiệp, token, trạng thái xóa.
//
// BẢO MẬT:
// - Không yêu cầu tài khoản Admin.
// - Không tìm kiếm khách bằng tên.
// - Không trả số điện thoại hoặc ghi chú.
// - Không cho khách đã xóa gửi RSVP.
// - Không cho thiệp đã xóa gửi RSVP.
// - Không cho link legacy vượt qua thiệp mới.
// - Giới hạn dung lượng JSON.
// - Giới hạn nội dung RSVP 500 ký tự.
//
// KHÔNG THAY ĐỔI:
// - Schema MongoDB.
// - Trạng thái gửi thiệp.
// - Token đã tạo.
// - Dữ liệu quản trị.
// - Collection lời chúc.
// ======================================================

// ======================================================
// TYPES
// ======================================================

interface RouteContext {
  params: Promise<{
    token: string;
  }>;
}

type AllowedRsvpStatus = Exclude<
  GuestRsvpStatus,
  "no_response"
>;

interface ResolvedGuest {
  guestId: ObjectId;
  side: "groom" | "bride";
}

// ======================================================
// CONSTANTS
// ======================================================

const MAX_BODY_BYTES = 2048;

const MAX_MESSAGE_LENGTH = 500;

const MAX_ROUTE_LENGTH = 160;

// 24 bytes ngẫu nhiên = 48 ký tự hexadecimal.
const TOKEN_REGEX = /^[a-f0-9]{48}$/i;

// Link mới:
// ten-khach-<48-character-token>
const NEW_INVITATION_REGEX =
  /^([a-z0-9]+(?:-[a-z0-9]+)*)-([a-f0-9]{48})$/i;

// ======================================================
// RESPONSE HELPERS
// ======================================================

function respond(
  body: Record<string, unknown>,
  status = 200
) {
  return NextResponse.json(body, {
    status,
    headers: {
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

function fail(
  message: string,
  status = 400
) {
  return respond(
    {
      success: false,
      message,
    },
    status
  );
}

// ======================================================
// VALIDATION HELPERS
// ======================================================

// Không cho gửi trạng thái no_response
// qua API xác nhận tham dự.
function validRsvp(
  value: unknown
): value is AllowedRsvpStatus {
  return (
    isGuestRsvpStatus(value) &&
    value !== "no_response"
  );
}

// Kiểm tra lời nhắn.
// Hỗ trợ Unicode và tiếng Việt.
function validMessage(
  value: unknown
): value is string {
  if (typeof value !== "string") {
    return false;
  }

  return (
    Array.from(value.trim()).length <=
      MAX_MESSAGE_LENGTH &&
    !/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/.test(
      value
    )
  );
}

function validSide(
  value: unknown
): value is "groom" | "bride" {
  return (
    value === "groom" ||
    value === "bride"
  );
}

// ======================================================
// RESOLVE INVITATION TOKEN
//
// Thứ tự xử lý:
//
// 1. Link thiệp mới có slug.
// 2. Token 48 ký tự của thiệp mới.
// 3. Token legacy của khách cũ.
//
// Quy tắc:
// - Thiệp mới phải chưa bị xóa mềm.
// - Khách liên kết phải còn hoạt động.
// - Bên mời của thiệp và khách phải khớp.
// - Legacy chỉ hợp lệ nếu khách chưa từng
//   có bản ghi trong collection invitations.
// ======================================================

async function resolveInvitation(
  routeToken: string
): Promise<ResolvedGuest | null> {
  // ================================================
  // 1. VALIDATE ROUTE TOKEN
  // ================================================

  if (
    !routeToken ||
    routeToken.length > MAX_ROUTE_LENGTH
  ) {
    return null;
  }

  const isDirectToken =
    TOKEN_REGEX.test(routeToken);

  const newRouteMatch =
    NEW_INVITATION_REGEX.exec(
      routeToken
    );

  if (
    !isDirectToken &&
    !newRouteMatch
  ) {
    return null;
  }

  // ================================================
  // 2. DATABASE COLLECTIONS
  // ================================================

  const guestCollection =
    await getGuestCollection();

  const invitationCollection =
    await getInvitationCollection();

  // ================================================
  // 3. NEW INVITATION LOOKUP
  // ================================================

  const publicToken = newRouteMatch
    ? newRouteMatch[2].toLowerCase()
    : routeToken.toLowerCase();

  // Link chứa slug phải khớp cả publicPath.
  //
  // Token trực tiếp chỉ cần publicToken.
  //
  // Cả hai trường hợp đều yêu cầu thiệp
  // chưa bị xóa mềm.
  const newInvitationFilter =
    newRouteMatch
      ? {
          publicToken,
          publicPath:
            `/invite/${routeToken}`,
          isDeleted: false,
        }
      : {
          publicToken,
          isDeleted: false,
        };

  const invitation =
    await invitationCollection.findOne(
      newInvitationFilter,
      {
        projection: {
          guestId: 1,
          side: 1,
        },
      }
    );

  // ================================================
  // 4. VALIDATE NEW INVITATION
  // ================================================

  if (invitation) {
    if (
      !validSide(invitation.side) ||
      !(
        invitation.guestId instanceof
        ObjectId
      )
    ) {
      return null;
    }

    const guest =
      await guestCollection.findOne(
        {
          _id: invitation.guestId,
          side: invitation.side,
          isDeleted: false,
        },
        {
          projection: {
            _id: 1,
            side: 1,
          },
        }
      );

    if (
      !guest?._id ||
      !validSide(guest.side)
    ) {
      return null;
    }

    return {
      guestId: guest._id,
      side: guest.side,
    };
  }

  // ================================================
  // 5. LEGACY TOKEN FALLBACK
  // ================================================

  // Link chứa slug không được fallback
  // sang dữ liệu legacy.
  if (!isDirectToken) {
    return null;
  }

  const legacyGuest =
    await guestCollection.findOne(
      {
        invitationToken:
          routeToken.toLowerCase(),
        isDeleted: false,
      },
      {
        projection: {
          _id: 1,
          side: 1,
        },
      }
    );

  if (
    !legacyGuest?._id ||
    !validSide(legacyGuest.side)
  ) {
    return null;
  }

  // ================================================
  // 6. BLOCK MIGRATED LEGACY LINKS
  //
  // Nếu khách đã có thiệp mới trong collection
  // invitations, kể cả thiệp đã xóa mềm,
  // không cho dùng lại token legacy.
  //
  // Điều này đồng bộ với API mở thiệp.
  // ================================================

  const migratedInvitation =
    await invitationCollection.findOne(
      {
        guestId: legacyGuest._id,
      },
      {
        projection: {
          _id: 1,
        },
      }
    );

  if (migratedInvitation) {
    return null;
  }

  return {
    guestId: legacyGuest._id,
    side: legacyGuest.side,
  };
}

// ======================================================
// READ LIMITED JSON
//
// Giới hạn kích thước body khi đọc stream.
// ======================================================

async function readJsonBody(
  request: NextRequest
): Promise<Record<string, unknown>> {
  const contentType =
    request.headers.get("content-type") ??
    "";

  if (
    !contentType
      .toLowerCase()
      .includes("application/json")
  ) {
    throw new Error(
      "Dữ liệu gửi lên phải là JSON."
    );
  }

  if (!request.body) {
    throw new Error(
      "Nội dung yêu cầu không hợp lệ."
    );
  }

  const reader =
    request.body.getReader();

  const chunks: Uint8Array[] = [];

  let totalBytes = 0;

  try {
    while (true) {
      const { done, value } =
        await reader.read();

      if (done) {
        break;
      }

      totalBytes += value.byteLength;

      if (
        totalBytes > MAX_BODY_BYTES
      ) {
        await reader.cancel();

        throw new Error(
          "Nội dung gửi lên quá lớn."
        );
      }

      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }

  const raw = Buffer.concat(
    chunks.map((chunk) =>
      Buffer.from(chunk)
    )
  ).toString("utf8");

  let parsed: unknown;

  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error(
      "Dữ liệu JSON không hợp lệ."
    );
  }

  if (
    !parsed ||
    typeof parsed !== "object" ||
    Array.isArray(parsed)
  ) {
    throw new Error(
      "Nội dung xác nhận không hợp lệ."
    );
  }

  return parsed as Record<
    string,
    unknown
  >;
}

// ======================================================
// GET - READ RSVP
//
// Đọc trạng thái mới nhất từ guests.
// Không lấy RSVP từ invitations.
// ======================================================

export async function GET(
  _request: NextRequest,
  context: RouteContext
) {
  try {
    // ================================================
    // 1. RESOLVE TOKEN
    // ================================================

    const { token } =
      await context.params;

    const resolved =
      await resolveInvitation(token);

    if (!resolved) {
      return fail(
        "Thiệp mời không tồn tại hoặc đã bị thu hồi.",
        404
      );
    }

    // ================================================
    // 2. READ GUEST RSVP
    // ================================================

    const guestCollection =
      await getGuestCollection();

    const guest =
      await guestCollection.findOne(
        {
          _id: resolved.guestId,
          side: resolved.side,
          isDeleted: false,
        },
        {
          projection: {
            _id: 0,
            fullName: 1,
            rsvpStatus: 1,
            rsvpMessage: 1,
            respondedAt: 1,
          },
        }
      );

    if (!guest) {
      return fail(
        "Không tìm thấy thông tin xác nhận.",
        404
      );
    }

    // ================================================
    // 3. NORMALIZE RSVP
    // ================================================

    const savedStatus =
      isGuestRsvpStatus(
        guest.rsvpStatus
      )
        ? guest.rsvpStatus
        : "no_response";

    // ================================================
    // 4. RESPONSE
    // ================================================

    return respond({
      success: true,

      rsvp: {
        guestName: guest.fullName,

        status: savedStatus,

        message:
          guest.rsvpMessage ?? "",

        respondedAt:
          guest.respondedAt instanceof Date
            ? guest.respondedAt.toISOString()
            : null,
      },
    });
  } catch (error) {
    console.error(
      "[PUBLIC RSVP GET]",
      error
    );

    return fail(
      "Không thể tải trạng thái xác nhận.",
      503
    );
  }
}

// ======================================================
// POST - UPDATE RSVP
//
// Chỉ cập nhật:
// - rsvpStatus
// - rsvpMessage
// - respondedAt
// - updatedAt
//
// Không cập nhật:
// - fullName
// - phone
// - side
// - invitationToken
// - deliveryStatus
// - sentAt
//
// Không tạo bản ghi lời chúc.
// ======================================================

export async function POST(
  request: NextRequest,
  context: RouteContext
) {
  try {
    // ================================================
    // 1. RESOLVE TOKEN
    // ================================================

    const { token } =
      await context.params;

    const resolved =
      await resolveInvitation(token);

    if (!resolved) {
      return fail(
        "Thiệp mời không tồn tại hoặc đã bị thu hồi.",
        404
      );
    }

    // ================================================
    // 2. READ INPUT
    // ================================================

    let input: Record<string, unknown>;

    try {
      input =
        await readJsonBody(request);
    } catch (error) {
      return fail(
        error instanceof Error
          ? error.message
          : "Dữ liệu không hợp lệ.",
        400
      );
    }

    // ================================================
    // 3. VALIDATE RSVP STATUS
    // ================================================

    if (!validRsvp(input.status)) {
      return fail(
        "Vui lòng chọn trạng thái tham dự hợp lệ.",
        400
      );
    }

    // ================================================
    // 4. VALIDATE RSVP MESSAGE
    // ================================================

    const rawMessage =
      input.message ?? "";

    if (!validMessage(rawMessage)) {
      return fail(
        "Lời nhắn không hợp lệ hoặc vượt quá 500 ký tự.",
        400
      );
    }

    const status = input.status;

    const cleanedMessage =
      rawMessage.trim();

    const now = new Date();

    // ================================================
    // 5. UPDATE MONGODB
    //
    // Không sửa dữ liệu khách hoặc thiệp
    // ngoài các trường RSVP hiện tại.
    // ================================================

    const guestCollection =
      await getGuestCollection();

    const result =
      await guestCollection.updateOne(
        {
          _id: resolved.guestId,
          side: resolved.side,
          isDeleted: false,
        },
        {
          $set: {
            rsvpStatus: status,
            rsvpMessage:
              cleanedMessage,
            respondedAt: now,
            updatedAt: now,
          },
        }
      );

    if (
      result.matchedCount !== 1
    ) {
      return fail(
        "Thiệp mời không tồn tại hoặc đã bị thu hồi.",
        404
      );
    }

    // ================================================
    // 6. SUCCESS RESPONSE
    // ================================================

    return respond({
      success: true,

      message:
        "Nam và Thư đã nhận được xác nhận của bạn. Xin chân thành cảm ơn!",

      rsvp: {
        status,
        message: cleanedMessage,
        respondedAt:
          now.toISOString(),
      },
    });
  } catch (error) {
    console.error(
      "[PUBLIC RSVP POST]",
      error
    );

    return fail(
      "Không thể lưu xác nhận tham dự. Vui lòng thử lại.",
      503
    );
  }
}
