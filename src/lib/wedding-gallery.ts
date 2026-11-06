
import "server-only";

import { randomUUID } from "node:crypto";
import type { Collection, Document } from "mongodb";

import { getDatabase } from "@/lib/mongodb";
import { wedding } from "@/data/wedding";

// ======================================================
// NAM & THU - WEDDING GALLERY
//
// Quản lý dữ liệu Album ảnh trên MongoDB.
//
// Collections:
// - gallery_photos: lưu danh sách ảnh.
// - gallery_meta: lưu trạng thái khởi tạo Album.
// ======================================================

// ======================================================
// CONFIG
// ======================================================

// Cho phép mô tả ảnh dài hơn 200 ký tự.
// Hỗ trợ tiếng Việt, emoji, ký tự đặc biệt và xuống dòng.
export const MAX_GALLERY_ALT_LENGTH = 5000;

// Dấu mốc khởi tạo Album lần đầu.
const GALLERY_SEED_ID = "initial-gallery-v1";

// ======================================================
// TYPES
// ======================================================

export interface GalleryPhoto {
  id: string;
  imageUrl: string;
  alt: string;
  sortOrder: number;
  isVisible: boolean;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface GalleryPhotoDocument extends Document {
  _id: string;
  imageUrl: string;
  alt: string;
  sortOrder: number;
  isVisible: boolean;
  createdBy: string | null;
  createdAt: Date;
  updatedAt: Date;
}

// Khai báo rõ _id kiểu string để MongoDB
// không tự suy luận thành ObjectId.
interface GalleryMetaDocument extends Document {
  _id: string;
  initializedAt: Date;
}

// ======================================================
// ID
// ======================================================

// Tạo ID duy nhất khi thêm ảnh mới.
export function createGalleryPhotoId(): string {
  return randomUUID();
}

// ======================================================
// IMAGE URL VALIDATION
// ======================================================

// Chỉ chấp nhận đường dẫn ảnh nội bộ.
//
// Ví dụ hợp lệ:
// /images/album-01.jpg
// /images/wedding/photo_01.webp
//
// Không chấp nhận URL ngoài hoặc data URI.
export function isValidGalleryImageUrl(
  value: unknown
): value is string {
  if (typeof value !== "string") {
    return false;
  }

  if (
    !value.startsWith("/") ||
    value.startsWith("//") ||
    value.includes("\\") ||
    value.includes("..") ||
    value.includes("?") ||
    value.includes("#")
  ) {
    return false;
  }

  if (value.length > 200) {
    return false;
  }

  return /^\/[a-zA-Z0-9/_-]+\.(jpg|jpeg|png|webp|avif)$/i.test(
    value
  );
}

// ======================================================
// IMAGE DESCRIPTION VALIDATION
// ======================================================

// Mô tả ảnh hỗ trợ:
// - Tiếng Việt có dấu.
// - Emoji và biểu tượng Unicode.
// - Ký tự đặc biệt.
// - Dấu nháy đơn, nháy kép.
// - Dấu ngoặc.
// - Xuống dòng.
// - Nội dung dài tối đa 5.000 ký tự.
//
// Không chặn ký tự đặc biệt.
//
// Lưu ý:
// React phải hiển thị mô tả dưới dạng text,
// không dùng dangerouslySetInnerHTML.
export function validateGalleryAlt(
  value: unknown
): string {
  if (typeof value !== "string") {
    throw new Error(
      "Mô tả ảnh phải là chuỗi văn bản."
    );
  }

  // Chỉ bỏ khoảng trắng thừa ở đầu và cuối.
  // Giữ nguyên ký tự đặc biệt và xuống dòng bên trong.
  const alt = value.trim();

  // Array.from đếm theo Unicode code point,
  // phù hợp hơn với nội dung tiếng Việt và emoji
  // so với String.length.
  const characterCount = Array.from(alt).length;

  if (characterCount > MAX_GALLERY_ALT_LENGTH) {
    throw new Error(
      `Mô tả ảnh không được vượt quá ${MAX_GALLERY_ALT_LENGTH.toLocaleString("vi-VN")} ký tự.`
    );
  }

  return alt;
}

// ======================================================
// SERIALIZE
// ======================================================

// Chuyển dữ liệu MongoDB thành dữ liệu JSON.
// Không trả thêm các trường nội bộ không cần thiết.
export function serializeGalleryPhoto(
  doc: GalleryPhotoDocument
): GalleryPhoto {
  return {
    id: doc._id,
    imageUrl: doc.imageUrl,
    alt: doc.alt,
    sortOrder: doc.sortOrder,
    isVisible: doc.isVisible,
    createdBy: doc.createdBy,
    createdAt: doc.createdAt.toISOString(),
    updatedAt: doc.updatedAt.toISOString(),
  };
}

// ======================================================
// DATABASE COLLECTIONS
// ======================================================

// Collection chứa thông tin các ảnh cưới.
export async function getGalleryCollection(): Promise<
  Collection<GalleryPhotoDocument>
> {
  const database = await getDatabase();

  return database.collection<GalleryPhotoDocument>(
    "gallery_photos"
  );
}

// Collection chứa trạng thái khởi tạo Album.
//
// _id được khai báo kiểu string để tránh lỗi TS2322.
async function getGalleryMetaCollection(): Promise<
  Collection<GalleryMetaDocument>
> {
  const database = await getDatabase();

  return database.collection<GalleryMetaDocument>(
    "gallery_meta"
  );
}

// ======================================================
// INITIALIZE DEFAULT GALLERY
//
// Chuyển ảnh ban đầu từ wedding.gallery
// sang MongoDB khi Album chưa được khởi tạo.
//
// Không tự khôi phục các ảnh mà Admin đã xóa.
// ======================================================

export async function ensureGalleryInitialized(): Promise<void> {
  const meta = await getGalleryMetaCollection();

  // Kiểm tra Album đã khởi tạo hay chưa.
  const existingMarker = await meta.findOne({
    _id: GALLERY_SEED_ID,
  });

  if (existingMarker) {
    return;
  }

  const gallery = await getGalleryCollection();

  const now = new Date();

  // Lấy những đường dẫn ảnh hợp lệ từ wedding.ts.
  const initialPhotos = wedding.gallery.filter(
    isValidGalleryImageUrl
  );

  // Đánh dấu khởi tạo bằng upsert.
  // Chỉ request tạo marker mới được tiếp tục.
  const marker = await meta.updateOne(
    {
      _id: GALLERY_SEED_ID,
    },
    {
      $setOnInsert: {
        initializedAt: now,
      },
    },
    {
      upsert: true,
    }
  );

  if (marker.upsertedCount !== 1) {
    return;
  }

  if (initialPhotos.length === 0) {
    return;
  }

  try {
    // Tạo ảnh bằng ID cố định.
    // $setOnInsert giúp tránh ghi đè ảnh đã có.
    await gallery.bulkWrite(
      initialPhotos.map((imageUrl, index) => ({
        updateOne: {
          filter: {
            _id: `initial-photo-${index + 1}`,
          },
          update: {
            $setOnInsert: {
              imageUrl,
              alt: `Ảnh cưới Nam và Thư ${index + 1}`,
              sortOrder: index,
              isVisible: true,
              createdBy: null,
              createdAt: now,
              updatedAt: now,
            },
          },
          upsert: true,
        },
      }))
    );
  } catch (error) {
    // Nếu quá trình ghi thất bại,
    // bỏ marker để lần sau có thể thử lại.
    //
    // Các ảnh đã ghi sẽ không bị ghi đè
    // nhờ ID cố định và $setOnInsert.
    try {
      await meta.deleteOne({
        _id: GALLERY_SEED_ID,
      });
    } catch (cleanupError) {
      console.error(
        "[GALLERY INITIALIZATION CLEANUP]",
        cleanupError
      );
    }

    throw error;
  }
}
