
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
// NAM & THU - WEDDING GUESTS
//
// GIAI ĐOẠN 3.5.1
//
// - Chuẩn hóa dữ liệu khách mời.
// - Phân loại Nhà trai / Nhà gái.
// - Tách trạng thái gửi thiệp và xác nhận RSVP.
// - Tạo mã thiệp cá nhân hóa ngẫu nhiên.
// - Tái sử dụng MongoDB hiện tại.
// ======================================================

// ======================================================
// TYPES
// ======================================================

// Trạng thái gửi thiệp.
export type GuestDeliveryStatus =
  | "not_sent"
  | "sent";

// Trạng thái xác nhận tham dự.
export type GuestRsvpStatus =
  | "no_response"
  | "attending"
  | "declined"
  | "unsure";

// Dữ liệu khách mời trong MongoDB.
export interface WeddingGuest {
  // Do MongoDB tự sinh.
  _id?: ObjectId;

  // Thông tin khách mời.
  fullName: string;
  phone: string;
  note: string;

  // Khách thuộc Nhà trai hoặc Nhà gái.
  side: WeddingSide;

  // Mã ngẫu nhiên để tạo link thiệp riêng.
  invitationToken: string;

  // Tình trạng gửi thiệp.
  deliveryStatus: GuestDeliveryStatus;
  sentAt: Date | null;

  // Phản hồi của khách.
  rsvpStatus: GuestRsvpStatus;
  rsvpMessage: string;
  respondedAt: Date | null;

  // Lưu thông tin quản trị.
  createdBy: string;
  updatedBy: string;

  createdAt: Date;
  updatedAt: Date;

  // Xóa mềm để tránh mất lịch sử.
  isDeleted: boolean;
  deletedAt: Date | null;
}

// ======================================================
// CÁC TRẠNG THÁI HỢP LỆ
// ======================================================

export const GUEST_DELIVERY_STATUSES = [
  "not_sent",
  "sent",
] as const;

export const GUEST_RSVP_STATUSES = [
  "no_response",
  "attending",
  "declined",
  "unsure",
] as const;

// ======================================================
// KIỂM TRA TRẠNG THÁI
// ======================================================

export function isGuestDeliveryStatus(
  value: unknown
): value is GuestDeliveryStatus {
  return (
    value === "not_sent" ||
    value === "sent"
  );
}

export function isGuestRsvpStatus(
  value: unknown
): value is GuestRsvpStatus {
  return (
    value === "no_response" ||
    value === "attending" ||
    value === "declined" ||
    value === "unsure"
  );
}

// ======================================================
// TẠO MÃ THIỆP NGẪU NHIÊN
//
// Không sử dụng tên, số điện thoại hoặc ID
// của khách để tạo mã thiệp.
//
// Mỗi mã có 192 bit ngẫu nhiên.
// Không thể đoán bằng cách tăng số thứ tự.
// ======================================================

export function createGuestInvitationToken():
  string {
  return randomBytes(24).toString("hex");
}

// ======================================================
// LẤY COLLECTION
// ======================================================

export async function getGuestCollection():
  Promise<Collection<WeddingGuest>> {
  const database = await getDatabase();

  return database.collection<WeddingGuest>(
    "guests"
  );
}

// ======================================================
// INDEXES
//
// Chỉ cần khởi tạo một lần trong quá trình
// triển khai cơ sở dữ liệu.
//
// Unique index bảo đảm mỗi link thiệp là duy nhất.
// Partial index cho phép tra cứu khách chưa xóa.
// ======================================================

export async function ensureGuestIndexes():
  Promise<void> {
  const collection =
    await getGuestCollection();

  await collection.createIndexes([
    {
      key: {
        invitationToken: 1,
      },
      name: "unique_guest_invitation_token",
      unique: true,
    },
    {
      key: {
        side: 1,
        isDeleted: 1,
        createdAt: -1,
      },
      name: "guest_side_created_at",
    },
    {
      key: {
        side: 1,
        isDeleted: 1,
        rsvpStatus: 1,
      },
      name: "guest_side_rsvp_status",
    },
    {
      key: {
        side: 1,
        isDeleted: 1,
        deliveryStatus: 1,
      },
      name: "guest_side_delivery_status",
    },
  ]);
}

// ======================================================
// TẠO DỮ LIỆU KHÁCH MỜI MẶC ĐỊNH
//
// Dùng khi Admin thêm khách mới.
//
// Khách chưa được gửi thiệp:
// deliveryStatus = not_sent
//
// Khách chưa xác nhận:
// rsvpStatus = no_response
//
// Không có trường số người tham dự.
// ======================================================

export function createWeddingGuest(
  input: {
    fullName: string;
    phone?: string;
    note?: string;
    side: WeddingSide;
    adminId: string;
  }
): WeddingGuest {
  const now = new Date();

  return {
    fullName: input.fullName.trim(),
    phone: input.phone?.trim() ?? "",
    note: input.note?.trim() ?? "",

    side: input.side,

    invitationToken:
      createGuestInvitationToken(),

    deliveryStatus: "not_sent",
    sentAt: null,

    rsvpStatus: "no_response",
    rsvpMessage: "",
    respondedAt: null,

    createdBy: input.adminId,
    updatedBy: input.adminId,

    createdAt: now,
    updatedAt: now,

    isDeleted: false,
    deletedAt: null,
  };
}

// ======================================================
// DỮ LIỆU ĐƯỢC TRẢ VỀ CHO ADMIN
//
// Không đưa trực tiếp ObjectId vào JSON.
// Chỉ dùng serializer này trong API quản trị
// đã kiểm tra quyền và phạm vi Nhà trai/Nhà gái.
// ======================================================

export function serializeGuest(
  guest: WeddingGuest & {
    _id: ObjectId;
  }
) {
  return {
    id: guest._id.toString(),

    fullName: guest.fullName,
    phone: guest.phone,
    note: guest.note,
    side: guest.side,

    invitationToken: guest.invitationToken,

    deliveryStatus: guest.deliveryStatus,
    sentAt:
      guest.sentAt?.toISOString() ?? null,

    rsvpStatus: guest.rsvpStatus,
    rsvpMessage: guest.rsvpMessage,
    respondedAt:
      guest.respondedAt?.toISOString() ?? null,

    createdAt:
      guest.createdAt.toISOString(),

    updatedAt:
      guest.updatedAt.toISOString(),
  };
}
