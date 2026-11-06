
import * as argon2 from "argon2";
import { ObjectId } from "mongodb";
import { NextRequest, NextResponse } from "next/server";

import {
  getAdminCollection,
  requireAdminApi,
} from "@/lib/admin-auth";

// ======================================================
// NAM & THU - ADMIN PERSONAL PROFILE
//
// GET   /api/admin/profile : Xem hồ sơ của mình
// PATCH /api/admin/profile : Sửa hồ sơ của mình
//
// Không nhận ID tài khoản từ frontend.
// ID luôn được lấy từ phiên đăng nhập.
//
// ======================================================

interface ProfileFields {
  fullName?: string;
  dateOfBirth?: string | null;
  email?: string;
  avatarDataUrl?: string | null;
}

interface UpdateBody {
  fullName?: unknown;
  dateOfBirth?: unknown;
  email?: unknown;
  username?: unknown;
  avatarDataUrl?: unknown;
  currentPassword?: unknown;
  newPassword?: unknown;
}

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

function fail(message: string, status: number) {
  return json({ success: false, message }, status);
}

// ======================================================
// KIỂM TRA ẢNH ĐẠI DIỆN
// Chỉ chấp nhận JPEG, PNG và WebP.
// Không chấp nhận SVG hoặc URL tùy ý.
// ======================================================

function validateAvatar(
  value: unknown
): string | null {
  if (value === null || value === "") {
    return null;
  }

  if (typeof value !== "string") {
    throw new Error("Ảnh đại diện không hợp lệ.");
  }

  const match = value.match(
    /^data:image\/(jpeg|png|webp);base64,([A-Za-z0-9+/]+={0,2})$/
  );

  if (!match) {
    throw new Error(
      "Chỉ hỗ trợ ảnh JPG, PNG hoặc WebP."
    );
  }

  const mime = match[1];
  const encoded = match[2];

  if (
    encoded.length > 350000 ||
    encoded.length % 4 !== 0
  ) {
    throw new Error(
      "Dung lượng ảnh không hợp lệ."
    );
  }

  const bytes = Buffer.from(encoded, "base64");

  if (
    bytes.length === 0 ||
    bytes.length > 250 * 1024
  ) {
    throw new Error(
      "Ảnh đại diện phải nhỏ hơn hoặc bằng 250 KB."
    );
  }

  // Đảm bảo dữ liệu base64 hợp lệ.
  if (
    bytes.toString("base64") !== encoded
  ) {
    throw new Error(
      "Dữ liệu ảnh không hợp lệ."
    );
  }

  const isJpeg =
    bytes.length >= 3 &&
    bytes[0] === 0xff &&
    bytes[1] === 0xd8 &&
    bytes[2] === 0xff;

  const isPng =
    bytes.length >= 8 &&
    bytes.subarray(0, 8).equals(
      Buffer.from([
        137, 80, 78, 71, 13, 10, 26, 10,
      ])
    );

  const isWebp =
    bytes.length >= 12 &&
    bytes.toString("ascii", 0, 4) === "RIFF" &&
    bytes.toString("ascii", 8, 12) === "WEBP";

  if (
    (mime === "jpeg" && !isJpeg) ||
    (mime === "png" && !isPng) ||
    (mime === "webp" && !isWebp)
  ) {
    throw new Error(
      "Định dạng thực tế của ảnh không hợp lệ."
    );
  }

  // Chuẩn hóa để dữ liệu lưu nhất quán.
  return `data:image/${mime};base64,${encoded}`;
}

// ======================================================
// VALIDATE INPUT
// ======================================================

function validateText(
  value: unknown,
  label: string,
  maxLength: number
): string {
  if (typeof value !== "string") {
    throw new Error(`${label} không hợp lệ.`);
  }

  const result = value.trim();

  if (Array.from(result).length > maxLength) {
    throw new Error(
      `${label} không được vượt quá ${maxLength} ký tự.`
    );
  }

  if (/[\x00-\x1F\x7F]/.test(result)) {
    throw new Error(
      `${label} chứa ký tự không hợp lệ.`
    );
  }

  return result;
}

function validateBirthDate(value: unknown) {
  if (
    value === "" ||
    value === null ||
    value === undefined
  ) {
    return null;
  }

  if (
    typeof value !== "string" ||
    !/^\d{4}-\d{2}-\d{2}$/.test(value)
  ) {
    throw new Error("Ngày sinh không hợp lệ.");
  }

  const [year, month, day] = value
    .split("-")
    .map(Number);

  const date = new Date(
    Date.UTC(year, month - 1, day)
  );

  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day ||
    year < 1900 ||
    date.getTime() > Date.now()
  ) {
    throw new Error("Ngày sinh không hợp lệ.");
  }

  return value;
}

function validateNewPassword(value: string) {
  if (
    Array.from(value).length < 8 ||
    Buffer.byteLength(value, "utf8") > 1024 ||
    !/[A-Za-z]/.test(value) ||
    !/[0-9]/.test(value) ||
    !/[^A-Za-z0-9\s]/.test(value)
  ) {
    throw new Error(
      "Mật khẩu mới phải có ít nhất 8 ký tự, gồm chữ cái, chữ số và ký tự đặc biệt."
    );
  }
}

// ======================================================
// CHUYỂN DỮ LIỆU HỒ SƠ CHO FRONTEND
// Không bao giờ trả passwordHash hoặc session token.
// ======================================================

function toProfile(
  admin: {
    _id: ObjectId;
    username: string;
    role: string;
    isActive: boolean;
    fullName?: string;
    dateOfBirth?: string | null;
    email?: string;
    avatarDataUrl?: string | null;
  }
) {
  return {
    id: admin._id.toString(),
    username: admin.username,
    role: admin.role,
    isActive: admin.isActive,
    fullName: admin.fullName ?? "",
    dateOfBirth: admin.dateOfBirth ?? "",
    email: admin.email ?? "",
    avatarDataUrl: admin.avatarDataUrl ?? null,
    hasPassword: true,
  };
}

// ======================================================
// GET - HỒ SƠ ĐANG ĐĂNG NHẬP
// ======================================================

export async function GET(request: NextRequest) {
  try {
    const auth = await requireAdminApi(request);

    if (auth.error) {
      return auth.error;
    }

    if (!auth.admin) {
      return fail("Chưa đăng nhập.", 401);
    }

    const collection = await getAdminCollection();

    const account = await collection.findOne({
      _id: new ObjectId(auth.admin.id),
    });

    if (!account) {
      return fail("Không tìm thấy tài khoản.", 404);
    }

    return json({
      success: true,
      profile: toProfile(account as typeof account & ProfileFields),
    });
  } catch (error) {
    console.error("[PROFILE GET ERROR]", error);
    return fail("Không thể tải hồ sơ.", 500);
  }
}

// ======================================================
// PATCH - CẬP NHẬT HỒ SƠ CỦA CHÍNH MÌNH
// ======================================================

export async function PATCH(request: NextRequest) {
  try {
    const auth = await requireAdminApi(request);

    if (auth.error) {
      return auth.error;
    }

    if (!auth.admin) {
      return fail("Chưa đăng nhập.", 401);
    }

    const contentType =
      request.headers.get("content-type") ?? "";

    if (
      !contentType
        .toLowerCase()
        .includes("application/json")
    ) {
      return fail("Chỉ chấp nhận dữ liệu JSON.", 415);
    }

    const contentLength = Number(
      request.headers.get("content-length") || "0"
    );

    if (contentLength > 400000) {
      return fail("Dữ liệu gửi lên quá lớn.", 413);
    }

    const raw = await request.text();

    if (
      Buffer.byteLength(raw, "utf8") > 400000
    ) {
      return fail("Dữ liệu gửi lên quá lớn.", 413);
    }

    let body: UpdateBody;

    try {
      const parsed: unknown = JSON.parse(raw);

      if (
        !parsed ||
        typeof parsed !== "object" ||
        Array.isArray(parsed)
      ) {
        throw new Error();
      }

      body = parsed as UpdateBody;
    } catch {
      return fail("Dữ liệu JSON không hợp lệ.", 400);
    }

    // ==================================================
    // KIỂM TRA DỮ LIỆU FORM
    // ==================================================

    let fullName: string;
    let email: string;
    let username: string;
    let dateOfBirth: string | null;
    let avatarDataUrl: string | null;

    try {
      fullName = validateText(
        body.fullName,
        "Họ và tên",
        100
      );

      email = validateText(
        body.email,
        "Email",
        254
      ).toLowerCase();

      username = validateText(
        body.username,
        "Tên đăng nhập",
        50
      ).toLowerCase();

      dateOfBirth = validateBirthDate(
        body.dateOfBirth
      );

      avatarDataUrl = validateAvatar(
        body.avatarDataUrl
      );

      if (
        !/^[a-z0-9_.-]{3,50}$/.test(username)
      ) {
        throw new Error(
          "Tên đăng nhập phải có 3–50 ký tự, không dấu và không có khoảng trắng."
        );
      }

      if (
        email &&
        !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
      ) {
        throw new Error(
          "Địa chỉ email không hợp lệ."
        );
      }
    } catch (error) {
      return fail(
        error instanceof Error
          ? error.message
          : "Dữ liệu hồ sơ không hợp lệ.",
        400
      );
    }

    // Để sửa hồ sơ, bắt buộc xác nhận mật khẩu.
    if (
      typeof body.currentPassword !== "string" ||
      body.currentPassword.length === 0 ||
      Buffer.byteLength(
        body.currentPassword,
        "utf8"
      ) > 1024
    ) {
      return fail(
        "Vui lòng nhập mật khẩu hiện tại để xác nhận.",
        400
      );
    }

    const newPassword =
      typeof body.newPassword === "string"
        ? body.newPassword
        : "";

    try {
      if (newPassword) {
        validateNewPassword(newPassword);
      }
    } catch (error) {
      return fail(
        error instanceof Error
          ? error.message
          : "Mật khẩu mới không hợp lệ.",
        400
      );
    }

    const collection = await getAdminCollection();
    const accountId = new ObjectId(
      auth.admin.id
    );

    const account = await collection.findOne({
      _id: accountId,
      isActive: true,
    });

    if (!account) {
      return fail(
        "Tài khoản không còn hoạt động.",
        403
      );
    }

    // ==================================================
    // XÁC MINH MẬT KHẨU HIỆN TẠI
    // ==================================================

    const validPassword = await argon2.verify(
      account.passwordHash,
      body.currentPassword
    );

    if (!validPassword) {
      return fail(
        "Mật khẩu hiện tại không đúng.",
        403
      );
    }

    // ==================================================
    // KIỂM TRA TÊN ĐĂNG NHẬP TRÙNG
    // ==================================================

    if (username !== account.username) {
      const duplicate = await collection.findOne({
        username,
        _id: { $ne: accountId },
      });

      if (duplicate) {
        return fail(
          "Tên đăng nhập đã được sử dụng.",
          409
        );
      }
    }

    // ==================================================
    // CẬP NHẬT DỮ LIỆU
    // ==================================================

    const updates: Record<string, unknown> = {
      username,
      fullName,
      email,
      dateOfBirth,
      avatarDataUrl,
      updatedAt: new Date(),
    };

    if (newPassword) {
      updates.passwordHash = await argon2.hash(
        newPassword,
        {
          type: argon2.argon2id,
          memoryCost: 65536,
          timeCost: 3,
          parallelism: 1,
        }
      );
    }

    // Giữ nguyên role. Không cho client đổi quyền.
    // Khi thay mật khẩu, thu hồi session hiện tại.
    if (newPassword) {
      updates.activeSessionHash = null;
      updates.sessionExpiresAt = null;
      updates.failedLoginAttempts = 0;
      updates.lockedUntil = null;
    }

    try {
      const result = await collection.updateOne(
        {
          _id: accountId,
          isActive: true,
          passwordHash: account.passwordHash,
        },
        {
          $set: updates,
        }
      );

      if (result.matchedCount !== 1) {
        return fail(
          "Dữ liệu đã thay đổi. Vui lòng tải lại và thử lại.",
          409
        );
      }
    } catch (error) {
      if (
        typeof error === "object" &&
        error !== null &&
        "code" in error &&
        error.code === 11000
      ) {
        return fail(
          "Tên đăng nhập đã tồn tại.",
          409
        );
      }

      throw error;
    }

    const updated = await collection.findOne({
      _id: accountId,
    });

    return json({
      success: true,
      message: newPassword
        ? "Cập nhật hồ sơ và đổi mật khẩu thành công. Vui lòng đăng nhập lại."
        : "Cập nhật hồ sơ thành công.",
      requiresLogin: Boolean(newPassword),
      profile: updated
        ? toProfile(updated as typeof updated & ProfileFields)
        : null,
    });
  } catch (error) {
    console.error("[PROFILE PATCH ERROR]", error);

    return fail(
      "Không thể cập nhật hồ sơ lúc này.",
      500
    );
  }
}
