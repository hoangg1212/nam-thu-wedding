
import {
  connection,
  NextRequest,
  NextResponse,
} from "next/server";

import {
  getAdminRoleLabel,
  requireAdminApi,
} from "@/lib/admin-auth";

// ======================================================
// NAM & THU - ADMIN PING API
//
// GET /api/admin/ping
//
// CHỨC NĂNG:
// - Kiểm tra phiên đăng nhập Admin.
// - Xác minh tài khoản còn hoạt động.
// - Hỗ trợ ba vai trò quản trị.
// - Không trả mật khẩu hoặc session token.
//
// NEXT.JS 16.4.3:
// - Không xác thực tại thời điểm prerender.
// ======================================================

export async function GET(
  request: NextRequest
) {
  // ==================================================
  // 1. CHUYỂN SANG REQUEST RUNTIME
  //
  // Không đưa await connection() vào try/catch.
  // ==================================================

  await connection();

  try {
    // ================================================
    // 2. KIỂM TRA PHIÊN ĐĂNG NHẬP
    // ================================================

    const auth =
      await requireAdminApi(request);

    if (auth.error) {
      return auth.error;
    }

    const admin = auth.admin;

    if (!admin) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Phiên đăng nhập không hợp lệ.",
        },
        {
          status: 401,
          headers: {
            "Cache-Control":
              "private, no-store",
            "X-Content-Type-Options":
              "nosniff",
          },
        }
      );
    }

    // ================================================
    // 3. TRẢ VỀ TRẠNG THÁI ADMIN
    // ================================================

    return NextResponse.json(
      {
        success: true,
        message:
          "Kết nối Admin API thành công.",

        admin: {
          id: admin.id,
          username: admin.username,
          role: admin.role,

          roleLabel:
            getAdminRoleLabel(admin.role),

          side: admin.side,
        },
      },
      {
        status: 200,
        headers: {
          "Cache-Control":
            "private, no-store",
          "X-Content-Type-Options":
            "nosniff",
        },
      }
    );
  } catch (error) {
    // ================================================
    // 4. LỖI HỆ THỐNG
    // ================================================

    console.error(
      "[ADMIN PING ERROR]",
      error
    );

    return NextResponse.json(
      {
        success: false,
        message:
          "Không thể kiểm tra trạng thái Admin.",
      },
      {
        status: 500,
        headers: {
          "Cache-Control":
            "private, no-store",
          "X-Content-Type-Options":
            "nosniff",
        },
      }
    );
  }
}
