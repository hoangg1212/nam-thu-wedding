
import "server-only";

import { randomBytes } from "node:crypto";

import {
  type Collection,
  type ObjectId,
} from "mongodb";

import { getDatabase } from "@/lib/mongodb";

import {
  type WeddingSide,
} from "@/lib/admin-auth";

// ======================================================
// NAM & THU - WEDDING INVITATIONS
//
// GIAI ĐOẠN 3.10 - BƯỚC 1
//
// Quản lý dữ liệu thiệp mời độc lập với khách mời.
//
// COLLECTION: invitations
//
// Chức năng:
// 1. Liên kết thiệp với khách trong collection guests.
// 2. Tạo URL cá nhân hóa theo tên khách.
// 3. Lưu trạng thái gửi thiệp.
// 4. Lưu người tạo và thời gian cập nhật.
// 5. Xóa mềm để bảo toàn lịch sử.
// 6. Mỗi khách chỉ có 1 thiệp đang hoạt động.
// 7. Phân quyền theo Nhà trai / Nhà gái.
//
// RSVP tiếp tục sử dụng dữ liệu thực tế
// trong collection guests.
//
// Không tự tạo thiệp khi thêm khách.
// Không chỉnh sửa dữ liệu khách tại file này.
// ======================================================

// ======================================================
// TYPES
// ======================================================

export type InvitationDeliveryStatus =
  | "not_sent"
  | "sent";

export interface WeddingInvitation {
  _id?: ObjectId;

  // ID khách trong collection guests.
  guestId: ObjectId;

  // Bên mời, dùng để phân quyền.
  side: WeddingSide;

  // Tên khách tại thời điểm tạo thiệp.
  // Khi hiển thị có thể lấy tên mới nhất
  // từ collection guests.
  guestNameSnapshot: string;

  // Slug đọc được theo tên khách.
  // Ví dụ: nguyen-van-an
  slug: string;

  // Mã ngẫu nhiên chống trùng, khó đoán.
  publicToken: string;

  // URL công khai dự kiến:
  // /invite/nguyen-van-an-<publicToken>
  //
  // Route công khai sẽ triển khai ở bước sau.
  publicPath: string;

  // Trạng thái gửi thiệp.
  deliveryStatus: InvitationDeliveryStatus;

  // Thời điểm Admin xác nhận đã gửi.
  sentAt: Date | null;

  // Quản trị.
  createdBy: string;
  updatedBy: string;

  createdAt: Date;
  updatedAt: Date;

  // Xóa mềm.
  isDeleted: boolean;
  deletedAt: Date | null;
}

// ======================================================
// SERIALIZED TYPE
// ======================================================

export interface SerializedInvitation {
  id: string;
  guestId: string;
  side: WeddingSide;
  guestName: string;
  slug: string;
  publicToken: string;
  publicPath: string;
  deliveryStatus: InvitationDeliveryStatus;
  sentAt: string | null;
  createdAt: string;
  updatedAt: string;
}

// ======================================================
// INPUT TYPE
// ======================================================

interface CreateInvitationInput {
  guestId: ObjectId;
  guestName: string;
  side: WeddingSide;
  adminId: string;
}

// ======================================================
// CONSTANTS
// ======================================================

export const INVITATIONS_COLLECTION =
  "invitations";

export const INVITATION_DELIVERY_STATUSES = [
  "not_sent",
  "sent",
] as const;

// ======================================================
// VALIDATION
// ======================================================

export function isInvitationDeliveryStatus(
  value: unknown
): value is InvitationDeliveryStatus {
  return (
    value === "not_sent" ||
    value === "sent"
  );
}

// ======================================================
// SLUG HELPER
//
// Chuyển tên tiếng Việt thành slug URL.
//
// Ví dụ:
// Nguyễn Văn An -> nguyen-van-an
// Trần Thị Mỹ Linh -> tran-thi-my-linh
//
// Slug chỉ phục vụ đường dẫn dễ đọc.
// Không dùng slug đơn lẻ làm mã bảo mật.
// ======================================================

export function createInvitationSlug(
  fullName: string
): string {
  const normalized = fullName
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .toLowerCase()
    .trim();

  const slug = normalized
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80)
    .replace(/-+$/g, "");

  return slug || "khach-moi";
}

// ======================================================
// SECURE TOKEN
//
// 24 bytes = 192 bits ngẫu nhiên.
//
// Mã này được thêm vào sau tên khách để:
// - Tránh hai khách trùng tên.
// - Không tạo URL bằng ID tăng dần.
// - Hạn chế đoán đường dẫn thiệp khác.
// ======================================================

export function createInvitationPublicToken():
  string {
  return randomBytes(24).toString("hex");
}

// ======================================================
// PUBLIC PATH
//
// Chỉ tạo đường dẫn tương đối.
//
// Domain sẽ được bổ sung từ website khi
// Admin sao chép hoặc xem thiệp.
// ======================================================

export function createInvitationPublicPath(
  slug: string,
  token: string
): string {
  return `/invite/${slug}-${token}`;
}

// ======================================================
// DATABASE COLLECTION
// ======================================================

export async function getInvitationCollection():
  Promise<Collection<WeddingInvitation>> {
  const database = await getDatabase();

  return database.collection<WeddingInvitation>(
    INVITATIONS_COLLECTION
  );
}

// ======================================================
// INDEXES
//
// Mỗi khách có tối đa 1 thiệp chưa xóa.
//
// Index unique theo guestId với điều kiện
// isDeleted=false để hỗ trợ tạo lại thiệp
// sau khi đã xóa mềm thiệp cũ.
//
// publicToken là duy nhất toàn hệ thống.
// ======================================================

export async function ensureInvitationIndexes():
  Promise<void> {
  const collection =
    await getInvitationCollection();

  await collection.createIndexes([
    {
      key: {
        guestId: 1,
      },
      name: "unique_active_guest_invitation",
      unique: true,
      partialFilterExpression: {
        isDeleted: false,
      },
    },
    {
      key: {
        publicToken: 1,
      },
      name: "unique_invitation_public_token",
      unique: true,
    },
    {
      key: {
        side: 1,
        isDeleted: 1,
        createdAt: -1,
      },
      name: "invitation_side_created_at",
    },
    {
      key: {
        side: 1,
        isDeleted: 1,
        deliveryStatus: 1,
      },
      name: "invitation_side_delivery_status",
    },
  ]);
}

// ======================================================
// CREATE INVITATION DOCUMENT
//
// Hàm này chỉ tạo object.
// Chưa tự ghi vào MongoDB.
//
// API tạo thiệp ở bước sau sẽ:
// - Kiểm tra phiên Admin.
// - Kiểm tra guestId.
// - Kiểm tra khách thuộc đúng bên.
// - Kiểm tra khách chưa bị xóa.
// - Kiểm tra khách đã có thiệp chưa.
// - Gọi insertOne để lưu.
// ======================================================

export function createWeddingInvitation(
  input: CreateInvitationInput
): WeddingInvitation {
  const now = new Date();

  const guestName =
    input.guestName.trim();

  const slug =
    createInvitationSlug(guestName);

  const publicToken =
    createInvitationPublicToken();

  const publicPath =
    createInvitationPublicPath(
      slug,
      publicToken
    );

  return {
    guestId: input.guestId,
    side: input.side,

    guestNameSnapshot: guestName,

    slug,
    publicToken,
    publicPath,

    deliveryStatus: "not_sent",
    sentAt: null,

    createdBy: input.adminId,
    updatedBy: input.adminId,

    createdAt: now,
    updatedAt: now,

    isDeleted: false,
    deletedAt: null,
  };
}

// ======================================================
// SERIALIZE
//
// Chuyển MongoDB ObjectId và Date thành
// chuỗi JSON dùng được ở frontend.
//
// Chỉ gọi hàm này sau khi đã kiểm tra
// quyền truy cập tại API.
// ======================================================

export function serializeInvitation(
  invitation: WeddingInvitation & {
    _id: ObjectId;
  }
): SerializedInvitation {
  return {
    id: invitation._id.toString(),

    guestId:
      invitation.guestId.toString(),

    side: invitation.side,

    guestName:
      invitation.guestNameSnapshot,

    slug: invitation.slug,

    publicToken:
      invitation.publicToken,

    publicPath:
      invitation.publicPath,

    deliveryStatus:
      invitation.deliveryStatus,

    sentAt:
      invitation.sentAt?.toISOString() ??
      null,

    createdAt:
      invitation.createdAt.toISOString(),

    updatedAt:
      invitation.updatedAt.toISOString(),
  };
}
