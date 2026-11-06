
import {
  NextRequest,
  NextResponse,
} from "next/server";

import {
  getGuestCollection,
} from "@/lib/wedding-guests";

import {
  getInvitationCollection,
} from "@/lib/wedding-invitations";

// ======================================================
// NAM & THU - PUBLIC INVITATION API
//
// GIAI ĐOẠN 3.11.1
//
// GET /api/invitations/[token]
//
// MỤC TIÊU:
// - Khách mở thiệp không cần đăng nhập.
// - Ưu tiên hệ thống thiệp mới.
// - Hỗ trợ publicToken và publicPath.
// - Giữ tương thích link khách mời cũ.
// - Không truy cập được thiệp bị xóa mềm.
// - Không truy cập được khách bị xóa mềm.
// - Không công khai thông tin nhạy cảm.
//
// Chỉ trả:
// - guestName
// - guestSide
// ======================================================

interface RouteContext {
  params: Promise<{
    token: string;
  }>;
}

// ======================================================
// RESPONSE HELPERS
// ======================================================

function json(
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
  status: number
) {
  return json(
    {
      success: false,
      message,
    },
    status
  );
}

// ======================================================
// VALIDATION
// ======================================================

// Cho phép:
// - Token hexadecimal.
// - Token alphanumeric.
// - Slug kết hợp token bằng dấu - hoặc _.
//
// Giới hạn độ dài để tránh truy vấn không cần thiết.
function isValidRouteToken(
  value: unknown
): value is string {
  return (
    typeof value === "string" &&
    value.length >= 1 &&
    value.length <= 256 &&
    /^[a-zA-Z0-9_-]+$/.test(value)
  );
}

function isWeddingSide(
  value: unknown
): value is "groom" | "bride" {
  return (
    value === "groom" ||
    value === "bride"
  );
}

// ======================================================
// GET - PUBLIC INVITATION
// ======================================================

export async function GET(
  _request: NextRequest,
  context: RouteContext
) {
  try {
    // ================================================
    // 1. VALIDATE TOKEN
    // ================================================

    const { token } =
      await context.params;

    if (!isValidRouteToken(token)) {
      return fail(
        "Thiệp mời không tồn tại.",
        404
      );
    }

    // ================================================
    // 2. GET COLLECTIONS
    // ================================================

    const invitationCollection =
      await getInvitationCollection();

    const guestCollection =
      await getGuestCollection();

    // ================================================
    // 3. LOOKUP NEW INVITATION
    //
    // Hỗ trợ:
    // - publicToken trùng token được truyền vào.
    // - publicPath trùng /invite/[token].
    //
    // Chỉ tìm thiệp chưa bị xóa mềm.
    // ================================================

    const invitation =
      await invitationCollection.findOne(
        {
          isDeleted: false,

          $or: [
            {
              publicToken: token,
            },
            {
              publicPath:
                `/invite/${token}`,
            },
          ],
        },
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
      const guest =
        await guestCollection.findOne(
          {
            _id: invitation.guestId,
            isDeleted: false,
            side: invitation.side,
          },
          {
            projection: {
              fullName: 1,
              side: 1,
            },
          }
        );

      if (
        !guest ||
        !isWeddingSide(guest.side) ||
        typeof guest.fullName !== "string"
      ) {
        return fail(
          "Thiệp mời không tồn tại hoặc đã bị thu hồi.",
          404
        );
      }

      return json({
        success: true,

        invitation: {
          guestName: guest.fullName,
          guestSide: guest.side,
        },
      });
    }

    // ================================================
    // 5. LEGACY INVITATION FALLBACK
    //
    // Chỉ xét token cũ:
    // - 48 ký tự hexadecimal.
    //
    // Trường hợp khách đã được tạo thiệp
    // trong hệ thống mới, không tiếp tục
    // sử dụng token cũ của collection guests.
    //
    // Điều này tránh trường hợp xóa thiệp mới
    // nhưng link cũ vẫn truy cập được.
    // ================================================

    if (!/^[a-f0-9]{48}$/i.test(token)) {
      return fail(
        "Thiệp mời không tồn tại hoặc đã bị thu hồi.",
        404
      );
    }

    const legacyGuest =
      await guestCollection.findOne(
        {
          invitationToken:
            token.toLowerCase(),
          isDeleted: false,
        },
        {
          projection: {
            _id: 1,
            fullName: 1,
            side: 1,
          },
        }
      );

    if (
      !legacyGuest ||
      !legacyGuest._id ||
      !isWeddingSide(legacyGuest.side) ||
      typeof legacyGuest.fullName !== "string"
    ) {
      return fail(
        "Thiệp mời không tồn tại hoặc đã bị thu hồi.",
        404
      );
    }

    // Nếu khách đã có bản ghi trong collection
    // invitations (kể cả đã xóa mềm),
    // không cho sử dụng đường dẫn legacy.
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
      return fail(
        "Thiệp mời không tồn tại hoặc đã bị thu hồi.",
        404
      );
    }

    return json({
      success: true,

      invitation: {
        guestName: legacyGuest.fullName,
        guestSide: legacyGuest.side,
      },
    });
  } catch (error) {
    console.error(
      "[PUBLIC INVITATION GET]",
      error
    );

    return fail(
      "Không thể tải thiệp mời lúc này.",
      503
    );
  }
}
