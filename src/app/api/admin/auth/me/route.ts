
import {
  connection,
  NextResponse,
} from "next/server";

import {
  getCurrentAdmin,
  getAdminRoleLabel,
} from "@/lib/admin-auth";

// ======================================================
// NAM & THU - CURRENT ADMIN
//
// GET /api/admin/auth/me
//
// NEXT.JS 16.4.3
//
// - Chỉ xác thực khi có request.
// - Không đọc cookie lúc prerender.
// - Không trả session token.
// - Không cache phản hồi chứa thông tin Admin.
// ======================================================

export async function GET() {
  // ==================================================
  // 1. CHUYỂN SANG REQUEST RUNTIME
  //
  // Phải đặt trước try/catch để không bắt nhầm
  // tín hiệu prerender nội bộ của Next.js.
  // ==================================================

  await connection();

  try {
    // ================================================
    // 2. KIỂM TRA SESSION
    // ================================================

    const admin =
      await getCurrentAdmin();

    if (!admin) {
      return NextResponse.json(
        {
          success: false,
          authenticated: false,
          message: "Chưa đăng nhập.",
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
    // 3. TRẢ VỀ THÔNG TIN ADMIN AN TOÀN
    // ================================================

    return NextResponse.json(
      {
        success: true,
        authenticated: true,

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
    // 4. LỖI XÁC THỰC THỰC TẾ
    // ================================================

    console.error(
      "[ADMIN ME ERROR]",
      error
    );

    return NextResponse.json(
      {
        success: false,
        authenticated: false,
        message:
          "Không thể kiểm tra phiên đăng nhập.",
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
