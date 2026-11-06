
import * as argon2 from "argon2";

import {
  NextRequest,
  NextResponse,
} from "next/server";

import {
  ADMIN_COOKIE_NAME,
  ADMIN_SESSION_HOURS,
  LOCK_MINUTES,
  MAX_LOGIN_ATTEMPTS,
  createAdminSessionToken,
  getAdminCollection,
  getAdminRoleLabel,
  getAdminSessionExpiry,
  getAdminSide,
  hashAdminSessionToken,
  isAdminRole,
  isSameOriginRequest,
  shouldUseSecureAdminCookie,
} from "@/lib/admin-auth";

// ======================================================
// NAM & THU - ADMIN LOGIN API
//
// POST /api/admin/auth/login
//
// FIX:
// - Đăng nhập được khi npm run start
//   trên http://localhost:3000.
// - Cookie Secure theo protocol thực tế.
// - Đồng bộ với admin-auth.ts.
//
// GIỮ NGUYÊN:
// - Xác thực mật khẩu bằng Argon2.
// - Tài khoản Super Admin / Nhà trai / Nhà gái.
// - Khóa tài khoản sau 5 lần đăng nhập sai.
// - Thời gian khóa 15 phút.
// - Session hết hạn sau 12 giờ.
// - Mỗi tài khoản một phiên hoạt động.
// - Token ngẫu nhiên, lưu hash SHA-256.
// - Cookie HttpOnly và SameSite=Lax.
// - Kiểm tra Same-Origin.
// ======================================================

// ======================================================
// TYPES
// ======================================================

interface LoginBody {
  username?: unknown;
  password?: unknown;
}

// ======================================================
// RESPONSE HELPERS
// ======================================================

function jsonError(
  message: string,
  status: number
) {
  return NextResponse.json(
    {
      success: false,
      message,
    },
    {
      status,
      headers: {
        "Cache-Control": "no-store",
      },
    }
  );
}

// ======================================================
// LOGIN
// ======================================================

export async function POST(
  request: NextRequest
) {
  // ==================================================
  // 1. KIỂM TRA SAME-ORIGIN
  //
  // Hàm trong admin-auth.ts hiện đã cho phép
  // HTTP localhost khi chạy npm run start.
  //
  // Domain Production vẫn yêu cầu HTTPS.
  // ==================================================

  if (!isSameOriginRequest(request)) {
    return jsonError(
      "Yêu cầu đăng nhập không hợp lệ.",
      403
    );
  }

  // ==================================================
  // 2. KIỂM TRA CONTENT TYPE
  //
  // Chỉ chấp nhận dữ liệu JSON.
  // ==================================================

  const contentType =
    request.headers.get("content-type") ?? "";

  if (
    !contentType
      .toLowerCase()
      .includes("application/json")
  ) {
    return jsonError(
      "Dữ liệu đăng nhập không hợp lệ.",
      415
    );
  }

  // ==================================================
  // 3. ĐỌC REQUEST BODY
  // ==================================================

  let body: LoginBody;

  try {
    body = (await request.json()) as LoginBody;
  } catch {
    return jsonError(
      "Không đọc được dữ liệu đăng nhập.",
      400
    );
  }

  // ==================================================
  // 4. KIỂM TRA DỮ LIỆU ĐẦU VÀO
  // ==================================================

  if (
    typeof body.username !== "string" ||
    typeof body.password !== "string"
  ) {
    return jsonError(
      "Vui lòng nhập tên đăng nhập và mật khẩu.",
      400
    );
  }

  // Chuẩn hóa username.
  const username = body.username
    .trim()
    .toLowerCase();

  // Mật khẩu giữ nguyên để xác thực Argon2.
  const password = body.password;

  // Kiểm tra định dạng và độ dài.
  if (
    !/^[a-z0-9_.-]{3,50}$/.test(username) ||
    password.length === 0 ||
    Buffer.byteLength(password, "utf8") > 1024
  ) {
    return jsonError(
      "Tên đăng nhập hoặc mật khẩu không đúng.",
      401
    );
  }

  // ==================================================
  // 5. KẾT NỐI MONGODB
  // ==================================================

  try {
    const collection =
      await getAdminCollection();

    // Tìm tài khoản theo username.
    const admin = await collection.findOne({
      username,
    });

    // ==================================================
    // 6. KIỂM TRA TÀI KHOẢN
    //
    // Không tiết lộ username có tồn tại hay không.
    // ==================================================

    if (
      !admin ||
      !admin.isActive ||
      !isAdminRole(admin.role)
    ) {
      return jsonError(
        "Tên đăng nhập hoặc mật khẩu không đúng.",
        401
      );
    }

    const now = new Date();

    // ==================================================
    // 7. KIỂM TRA TÀI KHOẢN BỊ KHÓA
    // ==================================================

    if (
      admin.lockedUntil &&
      admin.lockedUntil.getTime() > now.getTime()
    ) {
      return jsonError(
        "Tài khoản đang bị khóa tạm thời. Vui lòng thử lại sau.",
        423
      );
    }

    // ==================================================
    // 8. XÁC THỰC MẬT KHẨU ARGON2
    // ==================================================

    let validPassword = false;

    try {
      validPassword = await argon2.verify(
        admin.passwordHash,
        password
      );
    } catch {
      // Hash không hợp lệ hoặc có lỗi xác minh.
      // Không trả chi tiết hash/mật khẩu.
      return jsonError(
        "Không thể xác thực tài khoản.",
        401
      );
    }

    // ==================================================
    // 9. XỬ LÝ MẬT KHẨU SAI
    //
    // Sau MAX_LOGIN_ATTEMPTS lần sai,
    // tài khoản bị khóa tạm thời.
    // ==================================================

    if (!validPassword) {
      const failedAttempts =
        (admin.failedLoginAttempts ?? 0) + 1;

      const shouldLock =
        failedAttempts >= MAX_LOGIN_ATTEMPTS;

      const lockedUntil = shouldLock
        ? new Date(
            Date.now() +
              LOCK_MINUTES * 60 * 1000
          )
        : null;

      // Cập nhật có điều kiện để hạn chế
      // request đồng thời ghi đè bộ đếm.
      await collection.updateOne(
        {
          _id: admin._id,

          failedLoginAttempts:
            admin.failedLoginAttempts ?? 0,
        },
        {
          $set: {
            failedLoginAttempts:
              shouldLock
                ? MAX_LOGIN_ATTEMPTS
                : failedAttempts,

            lockedUntil,

            updatedAt: new Date(),
          },
        }
      );

      return jsonError(
        shouldLock
          ? "Bạn đã nhập sai quá nhiều lần. Tài khoản bị khóa tạm thời."
          : "Tên đăng nhập hoặc mật khẩu không đúng.",
        shouldLock ? 423 : 401
      );
    }

    // ==================================================
    // 10. TẠO SESSION MỚI
    //
    // Token ngẫu nhiên.
    // Chỉ lưu hash trong MongoDB.
    // ==================================================

    const token =
      createAdminSessionToken();

    const tokenHash =
      hashAdminSessionToken(token);

    const expiresAt =
      getAdminSessionExpiry();

    // ==================================================
    // 11. LƯU SESSION
    //
    // Mỗi tài khoản có một phiên hoạt động.
    //
    // Tài khoản phải đang hoạt động,
    // có vai trò hợp lệ và không bị khóa.
    // ==================================================

    const updateResult =
      await collection.updateOne(
        {
          _id: admin._id,

          username,

          isActive: true,

          role: {
            $in: [
              "super_admin",
              "groom_admin",
              "bride_admin",
            ],
          },

          $or: [
            {
              lockedUntil: null,
            },
            {
              lockedUntil: {
                $lte: new Date(),
              },
            },
            {
              lockedUntil: {
                $exists: false,
              },
            },
          ],
        },
        {
          $set: {
            // Đặt lại số lần đăng nhập sai.
            failedLoginAttempts: 0,

            // Mở khóa trạng thái tạm.
            lockedUntil: null,

            // Session đang hoạt động.
            activeSessionHash: tokenHash,

            // Thời hạn phiên đăng nhập.
            sessionExpiresAt: expiresAt,

            // Thời gian đăng nhập gần nhất.
            lastLoginAt: new Date(),

            updatedAt: new Date(),
          },
        }
      );

    if (updateResult.matchedCount !== 1) {
      return jsonError(
        "Trạng thái tài khoản đã thay đổi. Vui lòng thử lại.",
        409
      );
    }

    // ==================================================
    // 12. RESPONSE ĐĂNG NHẬP THÀNH CÔNG
    //
    // Không trả passwordHash/session hash.
    // ==================================================

    const response = NextResponse.json(
      {
        success: true,

        message: "Đăng nhập thành công.",

        admin: {
          id: admin._id.toString(),

          username: admin.username,

          role: admin.role,

          roleLabel: getAdminRoleLabel(
            admin.role
          ),

          side: getAdminSide(
            admin.role
          ),
        },
      },
      {
        status: 200,

        headers: {
          "Cache-Control": "no-store",
        },
      }
    );

    // ==================================================
    // 13. SESSION COOKIE
    //
    // FIX:
    //
    // CODE CŨ:
    // secure: NODE_ENV === "production"
    //
    // CODE MỚI:
    // secure: shouldUseSecureAdminCookie(request)
    //
    // Khi kiểm thử:
    // http://localhost:3000 -> false
    //
    // Khi triển khai:
    // https://domain.com -> true
    //
    // Giữ HttpOnly, SameSite và thời hạn 12 giờ.
    // ==================================================

    response.cookies.set({
      name: ADMIN_COOKIE_NAME,

      value: token,

      httpOnly: true,

      secure: shouldUseSecureAdminCookie(
        request
      ),

      sameSite: "lax",

      path: "/",

      expires: expiresAt,

      maxAge: ADMIN_SESSION_HOURS * 3600,
    });

    return response;
  } catch (error) {
    // ==================================================
    // 14. HANDLE SERVER ERROR
    //
    // Không ghi mật khẩu/token vào log.
    // ==================================================

    console.error(
      "[ADMIN LOGIN ERROR]",
      error
    );

    return jsonError(
      "Không thể đăng nhập lúc này. Vui lòng thử lại sau.",
      500
    );
  }
}
