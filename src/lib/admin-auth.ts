
import "server-only";

import {
  createHash,
  randomBytes,
} from "node:crypto";

import { cookies } from "next/headers";

import type { Collection } from "mongodb";

import { getDatabase } from "@/lib/mongodb";

// ======================================================
// NAM & THU - ADMIN AUTHENTICATION
//
// FIX PRODUCTION LOCALHOST:
//
// - HTTP localhost được phép khi chạy npm run start.
// - Domain Production vẫn yêu cầu HTTPS.
// - Không loại bỏ bảo vệ Same-Origin.
// - Cookie Secure tương thích môi trường chạy.
//
// GIỮ NGUYÊN:
// - Super Admin.
// - Admin Nhà trai.
// - Admin Nhà gái.
// - Phân quyền theo module.
// - Phân quyền theo gia đình.
// - Session token SHA-256.
// - Xác thực phiên từ MongoDB.
// - Thời hạn session.
// - Các API helper đang sử dụng.
// ======================================================

// ======================================================
// 1. SESSION CONFIG
// ======================================================

// Cookie dùng chung cho toàn bộ Admin.
export const ADMIN_COOKIE_NAME =
  "namthu_admin_session";

// Phiên đăng nhập có thời hạn 12 giờ.
export const ADMIN_SESSION_HOURS = 12;

// Khóa tạm thời sau 5 lần đăng nhập sai.
export const MAX_LOGIN_ATTEMPTS = 5;

// Thời gian khóa: 15 phút.
export const LOCK_MINUTES = 15;

// ======================================================
// 2. ROLES
// ======================================================

export const ADMIN_ROLES = [
  "super_admin",
  "groom_admin",
  "bride_admin",
] as const;

export type AdminRole =
  (typeof ADMIN_ROLES)[number];

export type WeddingSide =
  | "groom"
  | "bride";

export type AdminPermission =
  | "dashboard:view"
  | "events:read"
  | "events:write"
  | "guests:read"
  | "guests:write"
  | "wishes:read"
  | "wishes:write"
  | "gallery:read"
  | "gallery:write"
  | "stories:read"
  | "stories:write"
  | "accounts:manage"
  | "settings:manage";

// ======================================================
// 3. DATABASE TYPES
// ======================================================

export interface AdminUser {
  username: string;
  passwordHash: string;

  role: AdminRole;
  isActive: boolean;

  failedLoginAttempts: number;
  lockedUntil: Date | null;

  activeSessionHash: string | null;
  sessionExpiresAt: Date | null;

  lastLoginAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface CurrentAdmin {
  id: string;
  username: string;
  role: AdminRole;
  side: WeddingSide | null;
}

export interface CurrentAdminSession {
  admin: CurrentAdmin;
  token: string;
}

export interface RequireAdminResult {
  admin: CurrentAdmin | null;
  error: Response | null;
}

// ======================================================
// 4. ROLE HELPERS
// ======================================================

// Kiểm tra vai trò có hợp lệ không.
export function isAdminRole(
  value: unknown
): value is AdminRole {
  return (
    typeof value === "string" &&
    ADMIN_ROLES.some(
      (role) => role === value
    )
  );
}

// Tên vai trò hiển thị trên giao diện.
export function getAdminRoleLabel(
  role: AdminRole
): string {
  switch (role) {
    case "super_admin":
      return "Super Admin";

    case "groom_admin":
      return "Admin Nhà trai";

    case "bride_admin":
      return "Admin Nhà gái";
  }
}

// Xác định gia đình mà Admin quản lý.
export function getAdminSide(
  role: AdminRole
): WeddingSide | null {
  switch (role) {
    case "groom_admin":
      return "groom";

    case "bride_admin":
      return "bride";

    case "super_admin":
      return null;
  }
}

// ======================================================
// 5. PERMISSIONS
//
// Cả 3 loại Admin đều quản lý chung:
// - Album ảnh.
// - Love Story.
//
// Các API riêng sẽ kiểm tra quyền theo side.
// ======================================================

const COMMON_PERMISSIONS: AdminPermission[] = [
  "dashboard:view",

  // Thông tin lễ cưới.
  "events:read",
  "events:write",

  // Khách mời.
  "guests:read",
  "guests:write",

  // Lời chúc.
  "wishes:read",
  "wishes:write",

  // Album dùng chung.
  "gallery:read",
  "gallery:write",

  // Love Story dùng chung.
  "stories:read",
  "stories:write",
];

const SUPER_ADMIN_PERMISSIONS: AdminPermission[] = [
  ...COMMON_PERMISSIONS,

  // Chỉ Super Admin được quản lý
  // tài khoản và cài đặt hệ thống.
  "accounts:manage",
  "settings:manage",
];

// ======================================================
// 6. CHECK PERMISSION
// ======================================================

export function hasAdminPermission(
  role: AdminRole,
  permission: AdminPermission
): boolean {
  if (role === "super_admin") {
    return SUPER_ADMIN_PERMISSIONS.includes(
      permission
    );
  }

  return COMMON_PERMISSIONS.includes(
    permission
  );
}

// ======================================================
// 7. CHECK WEDDING SIDE
// ======================================================

export function canAccessWeddingSide(
  role: AdminRole,
  side: WeddingSide
): boolean {
  if (role === "super_admin") {
    return true;
  }

  return getAdminSide(role) === side;
}

// ======================================================
// 8. DATABASE COLLECTION
// ======================================================

export async function getAdminCollection(): Promise<
  Collection<AdminUser>
> {
  const database = await getDatabase();

  return database.collection<AdminUser>(
    "admin_users"
  );
}

// ======================================================
// 9. SESSION TOKEN
// ======================================================

// Token ngẫu nhiên 32 byte = 64 ký tự hex.
export function createAdminSessionToken(): string {
  return randomBytes(32).toString("hex");
}

// Chỉ lưu SHA-256 của token vào MongoDB.
export function hashAdminSessionToken(
  token: string
): string {
  return createHash("sha256")
    .update(token)
    .digest("hex");
}

// Thời điểm hết hạn phiên đăng nhập.
export function getAdminSessionExpiry(): Date {
  return new Date(
    Date.now() +
      ADMIN_SESSION_HOURS * 60 * 60 * 1000
  );
}

// ======================================================
// 10. SESSION LOOKUP
//
// Chỉ chấp nhận session khi:
// - Token đúng định dạng.
// - Hash tồn tại trong MongoDB.
// - Session chưa hết hạn.
// - Tài khoản đang hoạt động.
// - Vai trò hợp lệ.
// ======================================================

export async function findAdminBySessionToken(
  token: string
) {
  if (!/^[a-f0-9]{64}$/i.test(token)) {
    return null;
  }

  const collection =
    await getAdminCollection();

  const tokenHash =
    hashAdminSessionToken(token);

  return collection.findOne({
    activeSessionHash: tokenHash,

    sessionExpiresAt: {
      $gt: new Date(),
    },

    isActive: true,

    role: {
      $in: [...ADMIN_ROLES],
    },
  });
}

// ======================================================
// 11. CONVERT ADMIN DATA
//
// Không trả passwordHash hoặc session hash
// cho giao diện người dùng.
// ======================================================

function toCurrentAdmin(
  admin: AdminUser & {
    _id: {
      toString(): string;
    };
  }
): CurrentAdmin {
  return {
    id: admin._id.toString(),

    username: admin.username,

    role: admin.role,

    side: getAdminSide(admin.role),
  };
}

// ======================================================
// 12. SERVER COMPONENT SESSION
// ======================================================

export async function getCurrentAdminSession():
  Promise<CurrentAdminSession | null> {
  const cookieStore = await cookies();

  const token = cookieStore.get(
    ADMIN_COOKIE_NAME
  )?.value;

  if (!token) {
    return null;
  }

  const admin =
    await findAdminBySessionToken(token);

  if (!admin) {
    return null;
  }

  return {
    admin: toCurrentAdmin(admin),
    token,
  };
}

// Lấy thông tin tài khoản đang đăng nhập.
export async function getCurrentAdmin():
  Promise<CurrentAdmin | null> {
  const session =
    await getCurrentAdminSession();

  return session?.admin ?? null;
}

// ======================================================
// 13. HTTP / HTTPS HELPERS
//
// SỬA LỖI npm run start TRÊN LOCALHOST.
//
// NODE_ENV=production không đồng nghĩa
// website đang sử dụng HTTPS.
//
// npm run start:
// http://localhost:3000
//
// Website chính thức:
// https://tenmiencuaban.com
// ======================================================

// Nhận diện địa chỉ loopback để kiểm thử local.
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
// 14. ĐỌC PROTOCOL THỰC TẾ
//
// Khi chạy sau reverse proxy, Next.js có thể
// nhận request nội bộ qua HTTP dù người dùng
// truy cập website công khai bằng HTTPS.
//
// x-forwarded-proto được sử dụng khi proxy
// do chính bạn quản lý và cấu hình tin cậy.
//
// Không nhận các giá trị khác http/https.
// ======================================================

function getRequestProtocol(
  request: Request
): "http:" | "https:" | null {
  const requestUrl = new URL(request.url);

  const forwardedProto =
    request.headers
      .get("x-forwarded-proto")
      ?.trim()
      .toLowerCase();

  if (forwardedProto === "https") {
    return "https:";
  }

  if (forwardedProto === "http") {
    return "http:";
  }

  if (
    requestUrl.protocol === "https:" ||
    requestUrl.protocol === "http:"
  ) {
    return requestUrl.protocol;
  }

  return null;
}

// ======================================================
// 15. REQUEST ORIGIN CHECK
//
// FIX QUAN TRỌNG:
//
// CODE CŨ:
// Nếu NODE_ENV=production thì bắt buộc
// Origin phải là HTTPS.
//
// Vấn đề:
// npm run start chạy production nhưng
// http://localhost:3000 là HTTP.
//
// CODE MỚI:
// - Origin bắt buộc phải tồn tại.
// - Host và port phải khớp.
// - Protocol phải khớp.
// - HTTP chỉ cho phép với loopback.
// - Domain công khai phải dùng HTTPS.
//
// Các request từ website khác vẫn bị từ chối.
// ======================================================

export function isSameOriginRequest(
  request: Request
): boolean {
  const origin =
    request.headers.get("origin");

  // Request thay đổi dữ liệu phải có Origin.
  if (!origin) {
    return false;
  }

  try {
    const requestUrl =
      new URL(request.url);

    const originUrl =
      new URL(origin);

    // Chỉ cho phép giao thức web thông thường.
    if (
      originUrl.protocol !== "http:" &&
      originUrl.protocol !== "https:"
    ) {
      return false;
    }

    // Origin không được có username/password,
    // đường dẫn hoặc query string.
    if (
      originUrl.username ||
      originUrl.password ||
      originUrl.pathname !== "/" ||
      originUrl.search ||
      originUrl.hash
    ) {
      return false;
    }

    // Giữ hỗ trợ reverse proxy hiện có.
    const forwardedHost =
      request.headers.get("x-forwarded-host");

    const expectedHost =
      forwardedHost ?? requestUrl.host;

    // Host và port phải khớp chính xác.
    if (originUrl.host !== expectedHost) {
      return false;
    }

    // Protocol theo request / reverse proxy.
    const expectedProtocol =
      getRequestProtocol(request);

    if (
      !expectedProtocol ||
      originUrl.protocol !== expectedProtocol
    ) {
      return false;
    }

    // ==================================================
    // HTTP CHỈ ĐƯỢC PHÉP TRÊN LOCALHOST
    // ==================================================

    if (originUrl.protocol === "http:") {
      return isLocalHostname(
        originUrl.hostname
      );
    }

    // HTTPS hợp lệ trên domain chính thức.
    return originUrl.protocol === "https:";
  } catch {
    return false;
  }
}

// ======================================================
// 16. COOKIE SECURE HELPER
//
// Sử dụng chung cho API đăng nhập.
//
// HTTP localhost:
// secure = false
//
// HTTPS localhost / domain:
// secure = true
//
// Lưu ý:
// Website Production chính thức phải sử dụng
// HTTPS và proxy đáng tin cậy.
// ======================================================

export function shouldUseSecureAdminCookie(
  request: Request
): boolean {
  const protocol =
    getRequestProtocol(request);

  if (protocol === "https:") {
    return true;
  }

  // HTTP localhost chỉ dùng để kiểm thử local.
  // Với môi trường công khai, không hạ cấp
  // bảo mật cookie.
  return process.env.NODE_ENV === "production" &&
    !isLocalHostname(new URL(request.url).hostname);
}

// ======================================================
// 17. API AUTHENTICATION
//
// Áp dụng cho tất cả API Admin:
//
// 1. Kiểm tra Same-Origin với request thay đổi.
// 2. Xác thực phiên đăng nhập.
// 3. Kiểm tra quyền module.
// 4. Kiểm tra quyền theo Nhà trai / Nhà gái.
// ======================================================

export async function requireAdminApi(
  request: Request,
  permission?: AdminPermission,
  side?: WeddingSide
): Promise<RequireAdminResult> {
  const isMutation = ![
    "GET",
    "HEAD",
    "OPTIONS",
  ].includes(
    request.method.toUpperCase()
  );

  // ==================================================
  // CHECK SAME-ORIGIN
  // ==================================================

  if (
    isMutation &&
    !isSameOriginRequest(request)
  ) {
    return {
      admin: null,

      error: Response.json(
        {
          success: false,
          message: "Yêu cầu không hợp lệ.",
        },
        {
          status: 403,
        }
      ),
    };
  }

  // ==================================================
  // CHECK ADMIN SESSION
  // ==================================================

  const admin =
    await getCurrentAdmin();

  if (!admin) {
    return {
      admin: null,

      error: Response.json(
        {
          success: false,
          message:
            "Phiên đăng nhập không hợp lệ hoặc đã hết hạn.",
        },
        {
          status: 401,
        }
      ),
    };
  }

  // ==================================================
  // CHECK MODULE PERMISSION
  // ==================================================

  if (
    permission &&
    !hasAdminPermission(
      admin.role,
      permission
    )
  ) {
    return {
      admin: null,

      error: Response.json(
        {
          success: false,
          message:
            "Tài khoản không có quyền thực hiện thao tác này.",
        },
        {
          status: 403,
        }
      ),
    };
  }

  // ==================================================
  // CHECK FAMILY SIDE
  // ==================================================

  if (
    side &&
    !canAccessWeddingSide(
      admin.role,
      side
    )
  ) {
    return {
      admin: null,

      error: Response.json(
        {
          success: false,
          message:
            "Bạn không có quyền truy cập dữ liệu của bên này.",
        },
        {
          status: 403,
        }
      ),
    };
  }

  // ==================================================
  // AUTHORIZED
  // ==================================================

  return {
    admin,
    error: null,
  };
}
