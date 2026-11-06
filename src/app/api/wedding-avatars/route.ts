
import {
  NextResponse,
  connection,
} from "next/server";

import {
  getAdminCollection,
} from "@/lib/admin-auth";

// ======================================================
// NAM & THU - PUBLIC WEDDING AVATARS API
//
// GET /api/wedding-avatars
//
// CHỨC NĂNG:
// - Lấy avatar tài khoản chú rể.
// - Lấy avatar tài khoản cô dâu.
// - Đọc trực tiếp dữ liệu MongoDB.
// - Không yêu cầu khách mời đăng nhập.
// - Không công khai thông tin tài khoản nhạy cảm.
//
// Không chỉnh sửa dữ liệu MongoDB.
// ======================================================

// ======================================================
// TYPES
// ======================================================

// Hai vai trò được phép cung cấp avatar.
type CoupleRole =
  | "groom_admin"
  | "bride_admin";

// Kiểu dữ liệu avatar được lưu trong MongoDB.
//
// Khai báo riêng vì AdminUser hiện chưa định nghĩa
// thuộc tính avatarDataUrl.
interface AvatarAccount {
  role: CoupleRole;
  avatarDataUrl?: string | null;
}

interface PublicWeddingAvatars {
  groom: string | null;
  bride: string | null;
}

// ======================================================
// VALIDATE AVATAR
//
// Chỉ chấp nhận Data URL của JPEG, PNG, WebP.
//
// Không chấp nhận:
// - SVG
// - JavaScript
// - URL bên ngoài
// - Chuỗi quá lớn
// ======================================================

function safeAvatarDataUrl(
  value: unknown
): string | null {
  if (typeof value !== "string") {
    return null;
  }

  if (value.length > 350050) {
    return null;
  }

  const match = value.match(
    /^data:image\/(jpeg|png|webp);base64,([A-Za-z0-9+/]+={0,2})$/
  );

  if (!match) {
    return null;
  }

  const encoded = match[2];

  if (
    encoded.length > 350000 ||
    encoded.length % 4 !== 0
  ) {
    return null;
  }

  return value;
}

// ======================================================
// JSON RESPONSE
// ======================================================

function json(
  body: Record<string, unknown>,
  status = 200
) {
  return NextResponse.json(body, {
    status,

    headers: {
      // Cho phép cache ngắn.
      // Khi cập nhật avatar, dữ liệu sẽ được làm mới.
      "Cache-Control":
        "public, max-age=60, stale-while-revalidate=120",

      "X-Content-Type-Options": "nosniff",
    },
  });
}

// ======================================================
// GET - LẤY AVATAR CÔ DÂU / CHÚ RỂ
// ======================================================

export async function GET() {
  // Đánh dấu endpoint sử dụng dữ liệu động.
  await connection();

  try {
    // Sử dụng collection tài khoản Admin hiện tại.
    const collection = await getAdminCollection();

    // ==================================================
    // TRUY VẤN MONGODB
    //
    // Chỉ lấy:
    // - role
    // - avatarDataUrl
    //
    // Không lấy passwordHash, email hay session.
    // ==================================================

    const accounts = await collection
      .find(
        {
          role: {
            $in: [
              "groom_admin",
              "bride_admin",
            ] as CoupleRole[],
          },

          isActive: true,
        },

        {
          projection: {
            _id: 0,
            role: 1,
            avatarDataUrl: 1,
          },
        }
      )
      .limit(2)
      .toArray();

    // ==================================================
    // CHUẨN BỊ DỮ LIỆU TRẢ VỀ
    // ==================================================

    const avatars: PublicWeddingAvatars = {
      groom: null,
      bride: null,
    };

    for (const account of accounts) {
      // =================================================
      // FIX TYPESCRIPT TS2339
      //
      // MongoDB có trường avatarDataUrl nhưng kiểu
      // AdminUser chưa khai báo thuộc tính này.
      //
      // Bổ sung kiểu cho kết quả truy vấn tại đây,
      // không thay đổi hệ thống xác thực.
      // =================================================

      const avatarAccount =
        account as typeof account & AvatarAccount;

      const avatar = safeAvatarDataUrl(
        avatarAccount.avatarDataUrl
      );

      // Avatar chú rể
      if (
        avatarAccount.role === "groom_admin"
      ) {
        avatars.groom = avatar;
      }

      // Avatar cô dâu
      if (
        avatarAccount.role === "bride_admin"
      ) {
        avatars.bride = avatar;
      }
    }

    // ==================================================
    // SUCCESS
    // ==================================================

    return json({
      success: true,
      avatars,
    });

  } catch (error) {
    console.error(
      "[PUBLIC WEDDING AVATARS GET]",
      error
    );

    return NextResponse.json(
      {
        success: false,

        message:
          "Không thể tải ảnh cô dâu và chú rể.",

        avatars: {
          groom: null,
          bride: null,
        },
      },
      {
        status: 503,

        headers: {
          "Cache-Control": "no-store",
          "X-Content-Type-Options": "nosniff",
        },
      }
    );
  }
}
