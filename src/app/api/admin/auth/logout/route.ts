
import {
  NextRequest,
  NextResponse,
} from "next/server";

import {
  ADMIN_COOKIE_NAME,
  getAdminCollection,
  hashAdminSessionToken,
  isSameOriginRequest,
} from "@/lib/admin-auth";

// ======================================================
// NAM & THU - ADMIN LOGOUT
//
// API:
// POST /api/admin/auth/logout
//
// CHỨC NĂNG:
// - Kiểm tra nguồn yêu cầu.
// - Lấy session token từ cookie.
// - Thu hồi phiên trong MongoDB.
// - Xóa cookie đăng nhập.
// - Trả kết quả đăng xuất.
//
// CẬP NHẬT:
// - Hỗ trợ kiểm tra same-origin trên localhost.
// - Không nới lỏng kiểm tra cho domain bên ngoài.
// - Điều chỉnh Secure cookie khi chạy localhost.
// - Bổ sung log để xác định lỗi 403 / 500.
// - Không báo thành công nếu thu hồi phiên lỗi.
// ======================================================

// ======================================================
// 1. CẤU HÌNH RESPONSE
// ======================================================

const NO_STORE_HEADERS = {
  "Cache-Control": "no-store",
};

// ======================================================
// 2. KIỂM TRA LOCALHOST
//
// Chỉ nhận diện hostname của môi trường local.
// Không dựa đơn thuần vào NODE_ENV vì
// npm run start cũng dùng production.
// ======================================================

function isLocalHostname(
  hostname: string
): boolean {
  return (
    hostname === "localhost" ||
    hostname === "127.0.0.1" ||
    hostname === "[::1]"
  );
}

// ======================================================
// 3. KIỂM TRA SAME-ORIGIN
//
// Ưu tiên sử dụng hàm xác thực có sẵn
// trong hệ thống admin-auth.
//
// Nếu kiểm tra gốc không thành công:
// - Chỉ có ngoại lệ cho localhost.
// - Origin phải trùng chính xác với URL request.
// - Không chấp nhận origin tùy ý.
// - Không bỏ kiểm tra CSRF.
// ======================================================

function isAllowedLogoutOrigin(
  request: NextRequest
): boolean {
  // Giữ nguyên cơ chế bảo vệ hiện tại.
  if (isSameOriginRequest(request)) {
    return true;
  }

  // Chỉ áp dụng phương án kiểm tra bổ sung
  // khi chạy trên localhost.
  if (
    !isLocalHostname(
      request.nextUrl.hostname
    )
  ) {
    return false;
  }

  const origin =
    request.headers.get("origin");

  // Không chấp nhận Origin không xác định
  // trong phương án kiểm tra bổ sung.
  if (!origin) {
    return false;
  }

  try {
    const requestOrigin =
      request.nextUrl.origin;

    const suppliedOrigin =
      new URL(origin).origin;

    // So sánh chính xác protocol, hostname,
    // port thông qua thuộc tính origin.
    return suppliedOrigin === requestOrigin;
  } catch {
    return false;
  }
}

// ======================================================
// 4. COOKIE SECURITY
//
// Production chạy HTTPS:
// - Secure = true.
//
// npm run start trên HTTP localhost:
// - Secure = false.
//
// Domain khác localhost:
// - Giữ Secure trong Production.
//
// Lưu ý:
// Khi triển khai thực tế cần cấu hình
// HTTPS và cookie nhất quán trong
// API đăng nhập và đăng xuất.
// ======================================================

function shouldUseSecureCookie(
  request: NextRequest
): boolean {
  if (
    isLocalHostname(
      request.nextUrl.hostname
    )
  ) {
    return (
      request.nextUrl.protocol === "https:"
    );
  }

  return (
    process.env.NODE_ENV === "production" ||
    request.nextUrl.protocol === "https:"
  );
}

// ======================================================
// 5. TẠO RESPONSE THÔNG BÁO
// ======================================================

function createErrorResponse(
  message: string,
  status: number
): NextResponse {
  return NextResponse.json(
    {
      success: false,
      message,
    },
    {
      status,
      headers: NO_STORE_HEADERS,
    }
  );
}

// ======================================================
// 6. API POST - ĐĂNG XUẤT
// ======================================================

export async function POST(
  request: NextRequest
) {
  // ==================================================
  // BƯỚC 1: KIỂM TRA SAME-ORIGIN
  //
  // Ngăn website khác gửi request
  // đăng xuất trái phép.
  // ==================================================

  if (!isAllowedLogoutOrigin(request)) {
    console.warn(
      "[ADMIN LOGOUT] Origin bị từ chối",
      {
        origin:
          request.headers.get("origin"),
        requestOrigin:
          request.nextUrl.origin,
      }
    );

    return createErrorResponse(
      "Yêu cầu không hợp lệ.",
      403
    );
  }

  // ==================================================
  // BƯỚC 2: LẤY SESSION TOKEN
  //
  // Session token lấy từ cookie HTTP-only.
  // Không lấy từ query string hoặc request body.
  // ==================================================

  const token = request.cookies.get(
    ADMIN_COOKIE_NAME
  )?.value;

  try {
    // ==================================================
    // BƯỚC 3: THU HỒI PHIÊN ĐĂNG NHẬP
    //
    // Chỉ xử lý token đúng định dạng:
    // - 64 ký tự hexadecimal.
    //
    // Không lưu token thô trong MongoDB.
    // Chỉ tìm session qua token hash.
    // ==================================================

    if (
      token &&
      /^[a-f0-9]{64}$/i.test(token)
    ) {
      const collection =
        await getAdminCollection();

      await collection.updateOne(
        {
          activeSessionHash:
            hashAdminSessionToken(token),
        },
        {
          $set: {
            activeSessionHash: null,
            sessionExpiresAt: null,
            updatedAt: new Date(),
          },
        }
      );
    }

    // ==================================================
    // BƯỚC 4: TẠO RESPONSE THÀNH CÔNG
    // ==================================================

    const response = NextResponse.json(
      {
        success: true,
        message: "Đăng xuất thành công.",
      },
      {
        status: 200,
        headers: NO_STORE_HEADERS,
      }
    );

    // ==================================================
    // BƯỚC 5: XÓA COOKIE ĐĂNG NHẬP
    //
    // Sử dụng cùng tên và path của
    // cookie xác thực hiện tại.
    //
    // Cookie hết hạn ngay lập tức.
    // ==================================================

    response.cookies.set({
      name: ADMIN_COOKIE_NAME,
      value: "",

      httpOnly: true,

      secure:
        shouldUseSecureCookie(request),

      sameSite: "lax",

      path: "/",

      expires: new Date(0),

      maxAge: 0,
    });

    return response;
  } catch (error) {
    // ==================================================
    // BƯỚC 6: XỬ LÝ LỖI
    //
    // Không trả success khi MongoDB chưa
    // xác nhận thao tác thu hồi phiên.
    //
    // Không in session token ra terminal.
    // ==================================================

    console.error(
      "[ADMIN LOGOUT ERROR]",
      error
    );

    return createErrorResponse(
      "Không thể hoàn tất đăng xuất. Vui lòng thử lại.",
      500
    );
  }
}
