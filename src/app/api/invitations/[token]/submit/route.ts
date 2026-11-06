
import {
  NextRequest,
  NextResponse,
} from "next/server";

import {
  ObjectId,
  type ClientSession,
} from "mongodb";

import {
  getDatabase,
  getMongoClient,
} from "@/lib/mongodb";

import {
  getGuestCollection,
} from "@/lib/wedding-guests";

import {
  getInvitationCollection,
} from "@/lib/wedding-invitations";

import {
  ensureWeddingWishIndexes,
  getWeddingWishesCollection,
  isWeddingWishRsvpStatus,
  isValidWishMessage,
  isValidWishName,
  isValidWishRelation,
} from "@/lib/wedding-wishes";

import { wedding } from "@/data/wedding";

// ======================================================
// NAM & THU - PUBLIC SUBMIT WISHES + RSVP
//
// GIAI ĐOẠN 3.11.3
//
// POST /api/invitations/[token]/submit
//
// HỖ TRỢ:
//
// 1. Thiệp cũ:
//    /invite/<48-hex-token>
//
// 2. Thiệp mới:
//    /invite/<guest-slug>-<48-hex-token>
//
// 3. Token công khai trực tiếp:
//    <48-hex-publicToken>
//
// QUY TẮC:
//
// - Không yêu cầu Admin đăng nhập.
// - Xác định khách bằng token, không bằng tên.
// - Kiểm tra thiệp và khách trong transaction.
// - Không cho dùng thiệp đã xóa mềm.
// - Không cho khách đã xóa mềm gửi phản hồi.
// - Không cho link legacy vượt qua thiệp mới.
// - Cập nhật RSVP tại collection guests.
// - Upsert lời chúc trong collection wishes.
// - Một khách chỉ có một lời chúc cùng nguồn.
// - Gửi lại lời chúc chuyển về pending.
// - Khôi phục lời chúc đã xóa mềm.
// - Không thay đổi trạng thái gửi thiệp.
// - Không sửa thông tin quản lý khách.
// - Không tạo thêm collection hay schema.
// ======================================================

// ======================================================
// TYPES
// ======================================================

interface RouteContext {
  params: Promise<{
    token: string;
  }>;
}

interface SubmitBody {
  guestName?: unknown;
  relation?: unknown;
  rsvpStatus?: unknown;
  message?: unknown;
  website?: unknown;
}

interface ResolvedInvitation {
  guestId: ObjectId;
  side: "groom" | "bride";
}

// ======================================================
// CONSTANTS
// ======================================================

const MAX_BODY_BYTES = 4096;

const MAX_ROUTE_LENGTH = 160;

// 24 bytes -> 48 ký tự hexadecimal.
const TOKEN_PATTERN =
  /^[a-f0-9]{48}$/i;

// Đường dẫn có slug và token.
const NEW_TOKEN_PATTERN =
  /^([a-z0-9]+(?:-[a-z0-9]+)*)-([a-f0-9]{48})$/i;

// Các mối quan hệ đã được cấu hình
// trong nội dung website hiện tại.
const ALLOWED_RELATIONS =
  wedding.wishes.relations;

// ======================================================
// RESPONSE HELPERS
// ======================================================

function respond(
  data: Record<string, unknown>,
  status = 200
) {
  return NextResponse.json(data, {
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
// VALIDATE INVITATION TOKEN
// ======================================================

function isValidRouteToken(
  value: unknown
): value is string {
  if (
    typeof value !== "string" ||
    !value ||
    value.length > MAX_ROUTE_LENGTH
  ) {
    return false;
  }

  return (
    TOKEN_PATTERN.test(value) ||
    NEW_TOKEN_PATTERN.test(value)
  );
}

// ======================================================
// VALIDATE WEDDING SIDE
// ======================================================

function isValidSide(
  value: unknown
): value is "groom" | "bride" {
  return (
    value === "groom" ||
    value === "bride"
  );
}

// ======================================================
// VALIDATE FORM DATA
//
// Giữ nguyên quy tắc validation trong
// lib/wedding-wishes.ts.
// ======================================================

function validateBody(
  body: SubmitBody
): string | null {
  if (!isValidWishName(body.guestName)) {
    return (
      "Vui lòng nhập họ và tên " +
      "từ 2 đến 100 ký tự."
    );
  }

  if (
    !isValidWishRelation(
      body.relation,
      ALLOWED_RELATIONS
    )
  ) {
    return "Vui lòng chọn mối quan hệ hợp lệ.";
  }

  if (
    !isWeddingWishRsvpStatus(
      body.rsvpStatus
    )
  ) {
    return (
      "Vui lòng chọn một trong ba " +
      "trạng thái xác nhận tham dự."
    );
  }

  if (!isValidWishMessage(body.message)) {
    return (
      "Vui lòng nhập lời chúc " +
      "từ 2 đến 500 ký tự."
    );
  }

  // Honeypot:
  // Trường website phải để trống.
  if (
    body.website !== undefined &&
    body.website !== ""
  ) {
    return "Không thể xử lý yêu cầu.";
  }

  return null;
}

// ======================================================
// ORIGIN PROTECTION
//
// Kiểm tra Origin và Sec-Fetch-Site.
//
// Đây là lớp bảo vệ cơ bản.
// Chưa thay thế rate limiting.
// ======================================================

function isAllowedRequest(
  request: NextRequest
): boolean {
  const fetchSite =
    request.headers.get("sec-fetch-site");

  if (fetchSite === "cross-site") {
    return false;
  }

  const origin =
    request.headers.get("origin");

  if (!origin) {
    return true;
  }

  try {
    return (
      new URL(origin).origin ===
      request.nextUrl.origin
    );
  } catch {
    return false;
  }
}

// ======================================================
// READ JSON WITH BODY LIMIT
//
// Giới hạn dữ liệu ngay trong quá trình
// đọc request stream.
// ======================================================

async function readRequestBody(
  request: NextRequest
): Promise<SubmitBody> {
  const contentType =
    request.headers.get("content-type") ?? "";

  if (
    !contentType
      .toLowerCase()
      .includes("application/json")
  ) {
    throw new Error(
      "INVALID_CONTENT_TYPE"
    );
  }

  const contentLength =
    request.headers.get("content-length");

  if (contentLength !== null) {
    const length =
      Number(contentLength);

    if (
      !Number.isFinite(length) ||
      length < 0 ||
      length > MAX_BODY_BYTES
    ) {
      throw new Error(
        "BODY_TOO_LARGE"
      );
    }
  }

  if (!request.body) {
    throw new Error(
      "EMPTY_BODY"
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
          "BODY_TOO_LARGE"
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

  let data: unknown;

  try {
    data = JSON.parse(raw);
  } catch {
    throw new Error(
      "INVALID_JSON"
    );
  }

  if (
    !data ||
    typeof data !== "object" ||
    Array.isArray(data)
  ) {
    throw new Error(
      "INVALID_JSON"
    );
  }

  return data as SubmitBody;
}

// ======================================================
// RESOLVE GUEST FROM INVITATION
//
// Hàm chạy bên trong MongoDB transaction.
//
// Ưu tiên:
// 1. Thiệp mới theo publicPath.
// 2. Thiệp mới theo publicToken trực tiếp.
// 3. Link legacy khi khách chưa có thiệp mới.
//
// Không sử dụng guestName làm định danh.
// ======================================================

async function resolveInvitationGuest(
  routeToken: string,
  session: ClientSession
): Promise<ResolvedInvitation> {
  // ================================================
  // 1. VALIDATE ROUTE
  // ================================================

  if (!isValidRouteToken(routeToken)) {
    throw new Error(
      "INVITATION_NOT_FOUND"
    );
  }

  // ================================================
  // 2. COLLECTIONS
  // ================================================

  const guests =
    await getGuestCollection();

  const invitations =
    await getInvitationCollection();

  const directToken =
    TOKEN_PATTERN.test(routeToken);

  const newRouteMatch =
    NEW_TOKEN_PATTERN.exec(
      routeToken
    );

  // ================================================
  // 3. NEW INVITATION
  // ================================================

  const publicToken = newRouteMatch
    ? newRouteMatch[2].toLowerCase()
    : routeToken.toLowerCase();

  // Với link slug-token phải khớp publicPath.
  // Với token trực tiếp chỉ cần publicToken.
  const invitationFilter = newRouteMatch
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
    await invitations.findOne(
      invitationFilter,
      {
        session,
        projection: {
          guestId: 1,
          side: 1,
        },
      }
    );

  // ================================================
  // 4. VALIDATE ACTIVE INVITATION
  // ================================================

  if (invitation) {
    if (
      !(invitation.guestId instanceof ObjectId) ||
      !isValidSide(invitation.side)
    ) {
      throw new Error(
        "INVITATION_NOT_FOUND"
      );
    }

    const guest =
      await guests.findOne(
        {
          _id: invitation.guestId,
          isDeleted: false,
          side: invitation.side,
        },
        {
          session,
          projection: {
            _id: 1,
            side: 1,
          },
        }
      );

    if (
      !guest?._id ||
      !isValidSide(guest.side)
    ) {
      throw new Error(
        "INVITATION_NOT_FOUND"
      );
    }

    return {
      guestId: guest._id,
      side: guest.side,
    };
  }

  // ================================================
  // 5. LEGACY INVITATION
  // ================================================

  // Link có slug không được phép fallback
  // sang token của collection guests.
  if (!directToken) {
    throw new Error(
      "INVITATION_NOT_FOUND"
    );
  }

  const legacyGuest =
    await guests.findOne(
      {
        invitationToken:
          routeToken.toLowerCase(),
        isDeleted: false,
      },
      {
        session,
        projection: {
          _id: 1,
          side: 1,
        },
      }
    );

  if (
    !legacyGuest?._id ||
    !isValidSide(legacyGuest.side)
  ) {
    throw new Error(
      "INVITATION_NOT_FOUND"
    );
  }

  // ================================================
  // 6. PREVENT REVOKED LEGACY LINK
  //
  // Nếu khách đã có bất kỳ thiệp mới nào
  // trong invitations, kể cả đã xóa mềm,
  // link legacy không còn được chấp nhận.
  // ================================================

  const migratedInvitation =
    await invitations.findOne(
      {
        guestId: legacyGuest._id,
      },
      {
        session,
        projection: {
          _id: 1,
        },
      }
    );

  if (migratedInvitation) {
    throw new Error(
      "INVITATION_NOT_FOUND"
    );
  }

  return {
    guestId: legacyGuest._id,
    side: legacyGuest.side,
  };
}

// ======================================================
// POST - SUBMIT WISH + RSVP
//
// Cập nhật đồng thời:
// - guests.rsvpStatus
// - guests.rsvpMessage
// - guests.respondedAt
// - guests.updatedAt
//
// Và một bản ghi wishes có source:
// invitation_combined
// ======================================================

export async function POST(
  request: NextRequest,
  context: RouteContext
) {
  try {
    // ================================================
    // 1. GET TOKEN
    // ================================================

    const { token } =
      await context.params;

    if (!isValidRouteToken(token)) {
      return fail(
        "Đường dẫn thiệp mời không hợp lệ.",
        404
      );
    }

    // ================================================
    // 2. VALIDATE REQUEST ORIGIN
    // ================================================

    if (!isAllowedRequest(request)) {
      return fail(
        "Yêu cầu không được phép.",
        403
      );
    }

    // ================================================
    // 3. READ FORM DATA
    // ================================================

    const body =
      await readRequestBody(request);

    const validationError =
      validateBody(body);

    if (validationError) {
      return fail(
        validationError,
        400
      );
    }

    // ================================================
    // 4. TYPE NARROWING
    // ================================================

    if (
      !isValidWishName(body.guestName) ||
      !isValidWishRelation(
        body.relation,
        ALLOWED_RELATIONS
      ) ||
      !isWeddingWishRsvpStatus(
        body.rsvpStatus
      ) ||
      !isValidWishMessage(body.message)
    ) {
      return fail(
        "Dữ liệu gửi lên không hợp lệ.",
        400
      );
    }

    const guestName =
      body.guestName.trim();

    const relation =
      body.relation;

    const rsvpStatus =
      body.rsvpStatus;

    const message =
      body.message.trim();

    // ================================================
    // 5. DATABASE COLLECTIONS
    // ================================================

    const client =
      await getMongoClient();

    const database =
      await getDatabase();

    const guests =
      await getGuestCollection();

    const wishes =
      getWeddingWishesCollection(
        database
      );

    // ================================================
    // 6. ENSURE INDEXES
    //
    // Giữ MongoDB indexes hiện có.
    // Thực hiện bên ngoài transaction.
    // ================================================

    await ensureWeddingWishIndexes(
      database
    );

    // ================================================
    // 7. TRANSACTION
    //
    // RSVP và lời chúc được cập nhật cùng nhau.
    // Nếu một thao tác lỗi, transaction rollback.
    // ================================================

    const session =
      client.startSession();

    try {
      await session.withTransaction(
        async () => {
          // ==========================================
          // 7.1. VALIDATE INVITATION + GUEST
          // ==========================================

          const resolved =
            await resolveInvitationGuest(
              token,
              session
            );

          const now = new Date();

          // ==========================================
          // 7.2. UPDATE RSVP
          // ==========================================

          const updateResult =
            await guests.updateOne(
              {
                _id: resolved.guestId,
                side: resolved.side,
                isDeleted: false,
              },
              {
                $set: {
                  rsvpStatus,
                  rsvpMessage: "",
                  respondedAt: now,
                  updatedAt: now,
                },
              },
              {
                session,
              }
            );

          if (
            updateResult.matchedCount !== 1
          ) {
            throw new Error(
              "GUEST_UPDATE_FAILED"
            );
          }

          // ==========================================
          // 7.3. UPSERT WISH
          //
          // Một khách có tối đa một lời chúc
          // thuộc nguồn invitation_combined.
          //
          // Lần đầu: tạo bản ghi mới.
          // Gửi lại: cập nhật bản ghi cũ.
          // Đã xóa mềm: khôi phục.
          // ==========================================

          await wishes.updateOne(
            {
              guestId: resolved.guestId,
              source:
                "invitation_combined",
            },
            {
              $set: {
                guestName,
                guestSide: resolved.side,
                relation,
                message,
                rsvpStatus,

                // Cần được Admin duyệt lại.
                status: "pending",

                reviewedAt: null,
                reviewedBy: null,

                // Khôi phục nếu trước đó
                // lời chúc đã bị xóa mềm.
                isDeleted: false,
                deletedAt: null,

                updatedAt: now,
              },

              $setOnInsert: {
                guestId: resolved.guestId,
                source:
                  "invitation_combined",
                createdAt: now,
              },
            },
            {
              upsert: true,
              session,
            }
          );
        },
        {
          readConcern: {
            level: "snapshot",
          },

          writeConcern: {
            w: "majority",
          },
        }
      );
    } finally {
      await session.endSession();
    }

    // ================================================
    // 8. SUCCESS
    // ================================================

    return respond({
      success: true,

      message:
        "Nam và Thư đã nhận được lời chúc " +
        "và xác nhận tham dự của bạn. " +
        "Chúng mình xin chân thành cảm ơn!",

      rsvpStatus,
    });
  } catch (error) {
    // ================================================
    // 9. CONTROLLED ERROR HANDLING
    // ================================================

    if (error instanceof Error) {
      switch (error.message) {
        case "INVALID_CONTENT_TYPE":
          return fail(
            "Vui lòng gửi dữ liệu JSON.",
            415
          );

        case "EMPTY_BODY":
        case "INVALID_JSON":
          return fail(
            "Dữ liệu gửi lên không hợp lệ.",
            400
          );

        case "BODY_TOO_LARGE":
          return fail(
            "Nội dung gửi lên quá lớn.",
            413
          );

        case "INVITATION_NOT_FOUND":
          return fail(
            "Thiệp mời không tồn tại hoặc đã bị thu hồi.",
            404
          );

        case "INVALID_GUEST_SIDE":
        case "GUEST_ID_MISSING":
          return fail(
            "Thông tin khách mời không hợp lệ.",
            400
          );

        case "GUEST_UPDATE_FAILED":
          return fail(
            "Không thể cập nhật RSVP. Vui lòng thử lại.",
            409
          );
      }
    }

    console.error(
      "[WEDDING COMBINED SUBMIT ERROR]",
      error
    );

    return fail(
      "Không thể gửi thông tin lúc này. " +
      "Vui lòng thử lại sau.",
      503
    );
  }
}
