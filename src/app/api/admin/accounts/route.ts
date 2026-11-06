
import * as argon2 from "argon2";
import { ObjectId, type WithId } from "mongodb";
import { NextRequest, NextResponse } from "next/server";

import {
  getAdminCollection,
  requireAdminApi,
  type AdminRole,
  type AdminUser,
} from "@/lib/admin-auth";

// ======================================================
// NAM & THU - QUẢN LÝ TÀI KHOẢN ADMIN
//
// GET   /api/admin/accounts  - Danh sách tài khoản
// POST  /api/admin/accounts  - Tạo tài khoản mới
// PATCH /api/admin/accounts  - Khóa, mở khóa, đổi mật khẩu
//
// Chỉ Super Admin được sử dụng.
// ======================================================

type ManagedRole = "groom_admin" | "bride_admin";

type AccountAction =
  | "lock"
  | "unlock"
  | "reset_password";

interface CreateAccountBody {
  username?: unknown;
  password?: unknown;
  role?: unknown;
}

interface UpdateAccountBody {
  id?: unknown;
  action?: unknown;
  password?: unknown;
}

function response(
  data: Record<string, unknown>,
  status = 200
) {
  return NextResponse.json(data, {
    status,
    headers: {
      "Cache-Control": "private, no-store",
    },
  });
}

function errorResponse(
  message: string,
  status: number
) {
  return response(
    { success: false, message },
    status
  );
}

// ======================================================
// VALIDATION
// ======================================================

function isManagedRole(
  value: unknown
): value is ManagedRole {
  return (
    value === "groom_admin" ||
    value === "bride_admin"
  );
}

function validateUsername(value: unknown): string {
  if (typeof value !== "string") {
    throw new Error("Tên đăng nhập không hợp lệ.");
  }

  const username = value.trim().toLowerCase();

  if (!/^[a-z0-9_.-]{3,50}$/.test(username)) {
    throw new Error(
      "Username phải có 3–50 ký tự, chỉ gồm chữ cái không dấu, số, dấu chấm, gạch dưới hoặc gạch ngang."
    );
  }

  return username;
}

function validatePassword(value: unknown): string {
  if (typeof value !== "string") {
    throw new Error("Mật khẩu không hợp lệ.");
  }

  if (
    Array.from(value).length < 8 ||
    Buffer.byteLength(value, "utf8") > 1024 ||
    !/[A-Za-z]/.test(value) ||
    !/[0-9]/.test(value) ||
    !/[^A-Za-z0-9\s]/.test(value)
  ) {
    throw new Error(
      "Mật khẩu cần ít nhất 8 ký tự, gồm chữ cái, chữ số và ký tự đặc biệt."
    );
  }

  return value;
}

async function hashPassword(password: string) {
  return argon2.hash(password, {
    type: argon2.argon2id,
    memoryCost: 65536,
    timeCost: 3,
    parallelism: 1,
  });
}

// ======================================================
// GIỚI HẠN KÍCH THƯỚC REQUEST BODY
// ======================================================

async function readBody(
  request: NextRequest
): Promise<Record<string, unknown>> {
  const contentType =
    request.headers.get("content-type") || "";

  if (
    !contentType
      .toLowerCase()
      .includes("application/json")
  ) {
    throw new Error(
      "Yêu cầu phải gửi dữ liệu JSON."
    );
  }

  const raw = await request.text();

  // Chặn request có dữ liệu vượt giới hạn.
  if (Buffer.byteLength(raw, "utf8") > 4096) {
    throw new Error("Dữ liệu gửi lên quá lớn.");
  }

  let parsed: unknown;

  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error("Dữ liệu JSON không hợp lệ.");
  }

  if (
    !parsed ||
    typeof parsed !== "object" ||
    Array.isArray(parsed)
  ) {
    throw new Error("Nội dung yêu cầu không hợp lệ.");
  }

  return parsed as Record<string, unknown>;
}

// ======================================================
// CHỈ TRẢ VỀ DỮ LIỆU ĐƯỢC PHÉP HIỂN THỊ
// Không bao giờ trả passwordHash hoặc session token.
// ======================================================

function serializeAccount(
  account: WithId<AdminUser>
) {
  return {
    id: account._id.toString(),
    username: account.username,
    role: account.role,
    isActive: account.isActive,
    lastLoginAt:
      account.lastLoginAt?.toISOString() ?? null,
    createdAt:
      account.createdAt?.toISOString() ?? null,
  };
}

// ======================================================
// KIỂM TRA SUPER ADMIN
// ======================================================

async function authorize(
  request: NextRequest
) {
  return requireAdminApi(
    request,
    "accounts:manage"
  );
}

// ======================================================
// GET - DANH SÁCH TÀI KHOẢN
// ======================================================

export async function GET(
  request: NextRequest
) {
  try {
    const auth = await authorize(request);

    if (auth.error) {
      return auth.error;
    }

    if (auth.admin?.role !== "super_admin") {
      return errorResponse(
        "Bạn không có quyền quản lý tài khoản.",
        403
      );
    }

    const collection = await getAdminCollection();

    const accounts = await collection
      .find({
        role: {
          $in: [
            "super_admin",
            "groom_admin",
            "bride_admin",
          ] as AdminRole[],
        },
      })
      .sort({ createdAt: 1 })
      .limit(100)
      .toArray();

    return response({
      success: true,
      accounts: accounts.map(serializeAccount),
    });
  } catch (error) {
    console.error("[ADMIN ACCOUNTS GET]", error);

    return errorResponse(
      "Không thể tải danh sách tài khoản.",
      500
    );
  }
}

// ======================================================
// POST - TẠO TÀI KHOẢN NHÀ TRAI / NHÀ GÁI
// ======================================================

export async function POST(
  request: NextRequest
) {
  try {
    const auth = await authorize(request);

    if (auth.error) {
      return auth.error;
    }

    if (auth.admin?.role !== "super_admin") {
      return errorResponse(
        "Bạn không có quyền tạo tài khoản.",
        403
      );
    }

    let body: CreateAccountBody;

    try {
      body = await readBody(request);
    } catch (error) {
      return errorResponse(
        error instanceof Error
          ? error.message
          : "Dữ liệu không hợp lệ.",
        400
      );
    }

    let username: string;
    let password: string;

    try {
      username = validateUsername(body.username);
      password = validatePassword(body.password);
    } catch (error) {
      return errorResponse(
        error instanceof Error
          ? error.message
          : "Dữ liệu không hợp lệ.",
        400
      );
    }

    if (!isManagedRole(body.role)) {
      return errorResponse(
        "Chỉ được tạo tài khoản Nhà trai hoặc Nhà gái.",
        400
      );
    }

    const collection = await getAdminCollection();

    // Chỉ cho phép một tài khoản cho mỗi bên.
    const existing = await collection.findOne({
      $or: [
        { username },
        { role: body.role },
      ],
    });

    if (existing) {
      return errorResponse(
        existing.username === username
          ? "Tên đăng nhập đã tồn tại."
          : "Bên này đã có tài khoản quản trị.",
        409
      );
    }

    const passwordHash =
      await hashPassword(password);

    const now = new Date();

    const newAccount: AdminUser = {
      username,
      passwordHash,
      role: body.role,
      isActive: true,

      failedLoginAttempts: 0,
      lockedUntil: null,

      activeSessionHash: null,
      sessionExpiresAt: null,

      lastLoginAt: null,
      createdAt: now,
      updatedAt: now,
    };

    let insertedId: ObjectId;

    try {
      const result =
        await collection.insertOne(newAccount);

      insertedId = result.insertedId;
    } catch (error) {
      // Unique index có sẵn trong database
      // giúp chặn username trùng.
      if (
        typeof error === "object" &&
        error !== null &&
        "code" in error &&
        error.code === 11000
      ) {
        return errorResponse(
          "Tên đăng nhập đã tồn tại.",
          409
        );
      }

      throw error;
    }

    return response(
      {
        success: true,
        message: "Tạo tài khoản thành công.",
        account: {
          id: insertedId.toString(),
          username,
          role: body.role,
          isActive: true,
          lastLoginAt: null,
          createdAt: now.toISOString(),
        },
      },
      201
    );
  } catch (error) {
    console.error("[ADMIN ACCOUNTS POST]", error);

    return errorResponse(
      "Không thể tạo tài khoản.",
      500
    );
  }
}

// ======================================================
// PATCH - KHÓA / MỞ KHÓA / ĐỔI MẬT KHẨU
// ======================================================

export async function PATCH(
  request: NextRequest
) {
  try {
    const auth = await authorize(request);

    if (auth.error) {
      return auth.error;
    }

    if (auth.admin?.role !== "super_admin") {
      return errorResponse(
        "Bạn không có quyền cập nhật tài khoản.",
        403
      );
    }

    let body: UpdateAccountBody;

    try {
      body = await readBody(request);
    } catch (error) {
      return errorResponse(
        error instanceof Error
          ? error.message
          : "Dữ liệu không hợp lệ.",
        400
      );
    }

    const { id, action } = body;

    if (
      typeof id !== "string" ||
      !ObjectId.isValid(id) ||
      !/^[a-f0-9]{24}$/i.test(id)
    ) {
      return errorResponse(
        "ID tài khoản không hợp lệ.",
        400
      );
    }

    if (
      action !== "lock" &&
      action !== "unlock" &&
      action !== "reset_password"
    ) {
      return errorResponse(
        "Thao tác không được hỗ trợ.",
        400
      );
    }

    const selectedAction: AccountAction = action;
    const accountId = new ObjectId(id);

    const collection = await getAdminCollection();

    const target = await collection.findOne({
      _id: accountId,
      role: {
        $in: [
          "groom_admin",
          "bride_admin",
        ],
      },
    });

    if (!target) {
      return errorResponse(
        "Không tìm thấy tài khoản Nhà trai/Nhà gái.",
        404
      );
    }

    // Không bao giờ cho phép module này chỉnh sửa
    // Super Admin, kể cả khi gửi API thủ công.

    if (selectedAction === "lock") {
      const result = await collection.updateOne(
        {
          _id: accountId,
          role: target.role,
        },
        {
          $set: {
            isActive: false,

            // Thu hồi session khi khóa.
            activeSessionHash: null,
            sessionExpiresAt: null,

            updatedAt: new Date(),
          },
        }
      );

      if (result.matchedCount !== 1) {
        return errorResponse(
          "Không thể khóa tài khoản.",
          409
        );
      }

      return response({
        success: true,
        message: "Đã khóa tài khoản.",
      });
    }

    if (selectedAction === "unlock") {
      const result = await collection.updateOne(
        {
          _id: accountId,
          role: target.role,
        },
        {
          $set: {
            isActive: true,
            failedLoginAttempts: 0,
            lockedUntil: null,
            updatedAt: new Date(),
          },
        }
      );

      if (result.matchedCount !== 1) {
        return errorResponse(
          "Không thể mở khóa tài khoản.",
          409
        );
      }

      return response({
        success: true,
        message: "Đã mở khóa tài khoản.",
      });
    }

    // Đặt lại mật khẩu.
    let newPassword: string;

    try {
      newPassword = validatePassword(
        body.password
      );
    } catch (error) {
      return errorResponse(
        error instanceof Error
          ? error.message
          : "Mật khẩu không hợp lệ.",
        400
      );
    }

    const passwordHash =
      await hashPassword(newPassword);

    const result = await collection.updateOne(
      {
        _id: accountId,
        role: target.role,
      },
      {
        $set: {
          passwordHash,
          failedLoginAttempts: 0,
          lockedUntil: null,

          // Mật khẩu đổi thì session cũ hết hiệu lực.
          activeSessionHash: null,
          sessionExpiresAt: null,

          updatedAt: new Date(),
        },
      }
    );

    if (result.matchedCount !== 1) {
      return errorResponse(
        "Không thể đặt lại mật khẩu.",
        409
      );
    }

    return response({
      success: true,
      message:
        "Đặt lại mật khẩu thành công. Phiên đăng nhập cũ đã bị thu hồi.",
    });
  } catch (error) {
    console.error("[ADMIN ACCOUNTS PATCH]", error);

    return errorResponse(
      "Không thể cập nhật tài khoản.",
      500
    );
  }
}
