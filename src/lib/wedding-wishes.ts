
import "server-only";

import {
  ObjectId,
  type Collection,
  type Db,
} from "mongodb";

// ======================================================
// NAM & THU - WEDDING WISHES
//
// GIAI ĐOẠN 3.6.1
//
// - Chuẩn hóa collection wishes.
// - Liên kết khách mời với lời chúc.
// - Phân biệt Nhà trai và Nhà gái.
// - Quản lý trạng thái kiểm duyệt.
// - Hỗ trợ xóa mềm.
// - Ngăn tạo trùng lời chúc từ cùng một thiệp.
// - Không lưu token thiệp trong lời chúc.
//
// CHỈ SỬ DỤNG Ở SERVER.
// ======================================================

// ======================================================
// TYPES
// ======================================================

export type WeddingWishSide =
  | "groom"
  | "bride";

export type WeddingWishRsvpStatus =
  | "attending"
  | "declined"
  | "unsure";

export type WeddingWishStatus =
  | "pending"
  | "approved"
  | "hidden";

export type WeddingWishSource =
  "invitation_combined";

// ======================================================
// DATABASE DOCUMENT
// ======================================================

export interface WeddingWish {
  _id?: ObjectId;

  // Liên kết đến collection guests.
  guestId: ObjectId;

  // Không lưu invitationToken trong wishes.
  source: WeddingWishSource;

  guestName: string;
  guestSide: WeddingWishSide;
  relation: string;
  message: string;

  // Trạng thái được chọn khi gửi lời chúc.
  // RSVP chính thức vẫn nằm ở guests.
  rsvpStatus: WeddingWishRsvpStatus;

  // Quy trình kiểm duyệt nội dung.
  status: WeddingWishStatus;

  // Admin duyệt hoặc ẩn lời chúc.
  reviewedAt: Date | null;
  reviewedBy: ObjectId | null;

  // Ngày tạo và cập nhật.
  createdAt: Date;
  updatedAt: Date;

  // Xóa mềm.
  isDeleted: boolean;
  deletedAt: Date | null;
}

// ======================================================
// PUBLIC / ADMIN SERIALIZATION
// ======================================================

export interface SerializedWeddingWish {
  id: string;
  guestId: string;

  guestName: string;
  guestSide: WeddingWishSide;
  relation: string;
  message: string;

  rsvpStatus: WeddingWishRsvpStatus;
  status: WeddingWishStatus;

  reviewedAt: string | null;
  reviewedBy: string | null;

  createdAt: string;
  updatedAt: string;

  isDeleted: boolean;
  deletedAt: string | null;
}

// ======================================================
// COLLECTION
//
// Truyền database đã kết nối từ mongodb.ts.
// Không mở thêm một MongoClient khác.
// ======================================================

export function getWeddingWishesCollection(
  database: Db
): Collection<WeddingWish> {
  return database.collection<WeddingWish>(
    "wishes"
  );
}

// ======================================================
// VALIDATION
// ======================================================

export function isWeddingWishSide(
  value: unknown
): value is WeddingWishSide {
  return (
    value === "groom" ||
    value === "bride"
  );
}

export function isWeddingWishRsvpStatus(
  value: unknown
): value is WeddingWishRsvpStatus {
  return (
    value === "attending" ||
    value === "declined" ||
    value === "unsure"
  );
}

export function isWeddingWishStatus(
  value: unknown
): value is WeddingWishStatus {
  return (
    value === "pending" ||
    value === "approved" ||
    value === "hidden"
  );
}

export function isValidWishName(
  value: unknown
): value is string {
  if (typeof value !== "string") {
    return false;
  }

  const cleaned = value.trim();

  return (
    Array.from(cleaned).length >= 2 &&
    Array.from(cleaned).length <= 100 &&
    !containsInvalidControlCharacters(cleaned)
  );
}

export function isValidWishMessage(
  value: unknown
): value is string {
  if (typeof value !== "string") {
    return false;
  }

  const cleaned = value.trim();

  return (
    Array.from(cleaned).length >= 2 &&
    Array.from(cleaned).length <= 500 &&
    !containsInvalidControlCharacters(cleaned)
  );
}

export function isValidWishRelation(
  value: unknown,
  allowedRelations: readonly string[]
): value is string {
  return (
    typeof value === "string" &&
    allowedRelations.includes(value) &&
    !containsInvalidControlCharacters(value)
  );
}

function containsInvalidControlCharacters(
  value: string
): boolean {
  return /[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/.test(
    value
  );
}

// ======================================================
// CREATE DOCUMENT
//
// Nhận guestId và guestSide đã xác minh
// từ database, không tin dữ liệu tự khai
// của trình duyệt.
//
// Chưa thực hiện insert ở bước này.
// ======================================================

export function createWeddingWishDocument(
  input: {
    guestId: ObjectId;
    guestName: string;
    guestSide: WeddingWishSide;
    relation: string;
    message: string;
    rsvpStatus: WeddingWishRsvpStatus;
  }
): WeddingWish {
  const now = new Date();

  return {
    guestId: input.guestId,

    source: "invitation_combined",

    guestName: input.guestName.trim(),
    guestSide: input.guestSide,
    relation: input.relation,
    message: input.message.trim(),

    rsvpStatus: input.rsvpStatus,

    status: "pending",

    reviewedAt: null,
    reviewedBy: null,

    createdAt: now,
    updatedAt: now,

    isDeleted: false,
    deletedAt: null,
  };
}

// ======================================================
// SERIALIZE
//
// Chuyển ObjectId và Date về string.
// Dùng cho API Admin sau khi đã kiểm tra quyền.
//
// Không trả token thiệp hoặc thông tin nhạy cảm.
// ======================================================

export function serializeWeddingWish(
  wish: WeddingWish
): SerializedWeddingWish {
  if (!wish._id) {
    throw new Error(
      "Lời chúc không có _id hợp lệ."
    );
  }

  return {
    id: wish._id.toHexString(),
    guestId: wish.guestId.toHexString(),

    guestName: wish.guestName,
    guestSide: wish.guestSide,
    relation: wish.relation,
    message: wish.message,

    rsvpStatus: wish.rsvpStatus,
    status: wish.status,

    reviewedAt:
      wish.reviewedAt?.toISOString() ?? null,

    reviewedBy:
      wish.reviewedBy?.toHexString() ?? null,

    createdAt:
      wish.createdAt.toISOString(),

    updatedAt:
      wish.updatedAt.toISOString(),

    isDeleted: wish.isDeleted,

    deletedAt:
      wish.deletedAt?.toISOString() ?? null,
  };
}

// ======================================================
// MONGODB INDEXES
//
// Chỉ gọi sau khi đã kiểm tra indexes
// hiện có trong MongoDB Atlas.
//
// Không tự động drop bất kỳ index nào.
// ======================================================

export async function ensureWeddingWishIndexes(
  database: Db
): Promise<void> {
  const collection =
    getWeddingWishesCollection(database);

  // Một khách chỉ có một lời chúc thuộc
  // nguồn invitation_combined.
  //
  // Partial index để không ảnh hưởng
  // tài liệu cũ không thuộc nguồn này.
  //
  // Kể cả khi lời chúc bị xóa mềm,
  // guestId vẫn giữ duy nhất. Khi khách
  // gửi lại, API có thể khôi phục bản ghi.
  await collection.createIndex(
    {
      guestId: 1,
      source: 1,
    },
    {
      name:
        "unique_combined_wish_per_guest",

      unique: true,

      partialFilterExpression: {
        source:
          "invitation_combined",

        guestId: {
          $type: "objectId",
        },
      },
    }
  );

  // Admin Nhà trai / Nhà gái:
  // lọc theo bên mời và ngày tạo.
  await collection.createIndex(
    {
      guestSide: 1,
      isDeleted: 1,
      createdAt: -1,
    },
    {
      name:
        "wish_side_created_idx",
    }
  );

  // Lọc theo trạng thái kiểm duyệt.
  await collection.createIndex(
    {
      guestSide: 1,
      status: 1,
      isDeleted: 1,
      createdAt: -1,
    },
    {
      name:
        "wish_side_status_created_idx",
    }
  );

  // Tìm các lời chúc chưa được duyệt.
  await collection.createIndex(
    {
      status: 1,
      isDeleted: 1,
      createdAt: -1,
    },
    {
      name:
        "wish_status_created_idx",
    }
  );
}
