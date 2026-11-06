
import { NextRequest, NextResponse } from "next/server";

import { randomUUID } from "node:crypto";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";

import {
  GridFSBucket,
  ObjectId,
} from "mongodb";

import { requireAdminApi } from "@/lib/admin-auth";
import { getDatabase } from "@/lib/mongodb";

import {
  createGalleryPhotoId,
  ensureGalleryInitialized,
  getGalleryCollection,
  serializeGalleryPhoto,
  validateGalleryAlt,
} from "@/lib/wedding-gallery";

// ======================================================
// NAM & THU - ADMIN GALLERY UPLOAD API
//
// POST /api/admin/gallery/upload
//
// Next.js 16 + Cache Components:
// KHÔNG khai báo export const runtime.
//
// Chức năng:
// - Xác thực Admin.
// - Kiểm tra quyền gallery:write.
// - Nhận ảnh JPG, PNG hoặc WebP.
// - Giới hạn 8 MB.
// - Lưu ảnh vào MongoDB GridFS.
// - Thêm hoặc thay thế ảnh trong Album.
// - Hỗ trợ mô tả tối đa 5.000 ký tự.
//
// Album dùng chung cho ba Admin.
// ======================================================

// ======================================================
// CONFIG
// ======================================================

const MAX_FILE_SIZE = 8 * 1024 * 1024;

// ======================================================
// RESPONSE
// ======================================================

function respond(
  body: Record<string, unknown>,
  status = 200
) {
  return NextResponse.json(body, {
    status,
    headers: {
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

function fail(message: string, status: number) {
  return respond(
    {
      success: false,
      message,
    },
    status
  );
}

// ======================================================
// FILE VALIDATION
//
// Không chỉ dựa vào MIME do trình duyệt gửi.
// Kiểm tra chữ ký file thực tế.
// ======================================================

function detectImageMime(
  bytes: Buffer
): string | null {
  // JPEG
  if (
    bytes.length >= 3 &&
    bytes[0] === 0xff &&
    bytes[1] === 0xd8 &&
    bytes[2] === 0xff
  ) {
    return "image/jpeg";
  }

  // PNG
  if (
    bytes.length >= 8 &&
    bytes.subarray(0, 8).equals(
      Buffer.from([
        0x89,
        0x50,
        0x4e,
        0x47,
        0x0d,
        0x0a,
        0x1a,
        0x0a,
      ])
    )
  ) {
    return "image/png";
  }

  // WebP
  if (
    bytes.length >= 12 &&
    bytes.toString("ascii", 0, 4) === "RIFF" &&
    bytes.toString("ascii", 8, 12) === "WEBP"
  ) {
    return "image/webp";
  }

  return null;
}

function getExtension(mime: string): string {
  if (mime === "image/jpeg") {
    return "jpg";
  }

  if (mime === "image/png") {
    return "png";
  }

  return "webp";
}

// ======================================================
// POST - UPLOAD IMAGE
// ======================================================

export async function POST(request: NextRequest) {
  // --------------------------------------------------
  // 1. XÁC THỰC VÀ PHÂN QUYỀN
  // --------------------------------------------------

  const auth = await requireAdminApi(
    request,
    "gallery:write"
  );

  if (auth.error) {
    return auth.error;
  }

  if (!auth.admin) {
    return fail("Chưa đăng nhập.", 401);
  }

  // --------------------------------------------------
  // 2. ĐỌC FORM DATA
  // --------------------------------------------------

  let form: FormData;

  try {
    form = await request.formData();
  } catch {
    return fail(
      "Không thể đọc dữ liệu ảnh tải lên.",
      400
    );
  }

  const file = form.get("file");
  const photoIdValue = form.get("photoId");
  const altValue = form.get("alt");

  if (!(file instanceof File)) {
    return fail(
      "Vui lòng chọn một tệp ảnh.",
      400
    );
  }

  // --------------------------------------------------
  // 3. GIỚI HẠN DUNG LƯỢNG
  // --------------------------------------------------

  if (
    file.size === 0 ||
    file.size > MAX_FILE_SIZE
  ) {
    return fail(
      "Ảnh phải có dung lượng lớn hơn 0 và tối đa 8 MB.",
      413
    );
  }

  // --------------------------------------------------
  // 4. XÁC ĐỊNH CHẾ ĐỘ THÊM / THAY THẾ
  // --------------------------------------------------

  const photoId =
    typeof photoIdValue === "string" &&
    photoIdValue.trim()
      ? photoIdValue.trim()
      : null;

  if (
    photoId &&
    !/^[a-zA-Z0-9_-]{1,100}$/.test(photoId)
  ) {
    return fail(
      "Mã ảnh cần thay thế không hợp lệ.",
      400
    );
  }

  // --------------------------------------------------
  // 5. VALIDATE MÔ TẢ ẢNH
  // --------------------------------------------------

  let alt: string;

  try {
    alt = validateGalleryAlt(
      typeof altValue === "string"
        ? altValue
        : ""
    );
  } catch (error) {
    return fail(
      error instanceof Error
        ? error.message
        : "Mô tả ảnh không hợp lệ.",
      400
    );
  }

  // --------------------------------------------------
  // 6. ĐỌC VÀ KIỂM TRA FILE
  // --------------------------------------------------

  let buffer: Buffer;

  try {
    buffer = Buffer.from(
      await file.arrayBuffer()
    );
  } catch {
    return fail(
      "Không thể xử lý tệp ảnh.",
      400
    );
  }

  const mime = detectImageMime(buffer);

  if (!mime) {
    return fail(
      "Chỉ hỗ trợ ảnh JPG, PNG hoặc WebP hợp lệ.",
      400
    );
  }

  // --------------------------------------------------
  // 7. KẾT NỐI MONGODB
  // --------------------------------------------------

  try {
    await ensureGalleryInitialized();
  } catch (error) {
    console.error(
      "[GALLERY INITIALIZATION ERROR]",
      error
    );

    return fail(
      "Không thể khởi tạo dữ liệu Album.",
      500
    );
  }

  let database: Awaited<
    ReturnType<typeof getDatabase>
  >;

  try {
    database = await getDatabase();
  } catch (error) {
    console.error(
      "[GALLERY DATABASE ERROR]",
      error
    );

    return fail(
      "Không thể kết nối MongoDB.",
      503
    );
  }

  const bucket = new GridFSBucket(database, {
    bucketName: "gallery_uploads",
  });

  const photos = await getGalleryCollection();

  // --------------------------------------------------
  // 8. KIỂM TRA ẢNH CŨ KHI THAY THẾ
  // --------------------------------------------------

  const oldPhoto = photoId
    ? await photos.findOne({
        _id: photoId,
      })
    : null;

  if (photoId && !oldPhoto) {
    return fail(
      "Không tìm thấy ảnh cần thay thế.",
      404
    );
  }

  // --------------------------------------------------
  // 9. TẠO GRIDFS UPLOAD STREAM
  // --------------------------------------------------

  const extension = getExtension(mime);

  const uploadStream = bucket.openUploadStream(
    `wedding-${randomUUID()}.${extension}`,
    {
      contentType: mime,
      metadata: {
        uploadedBy: auth.admin.id,
        uploadedAt: new Date(),
      },
    }
  );

  const uploadedId = uploadStream.id as ObjectId;

  let databaseUpdated = false;

  try {
    // ------------------------------------------------
    // 10. LƯU BINARY FILE VÀO GRIDFS
    // ------------------------------------------------

    await pipeline(
      Readable.from(buffer),
      uploadStream
    );

    const imageUrl =
      `/api/gallery/image/${uploadedId.toHexString()}`;

    const now = new Date();

    // ------------------------------------------------
    // 11. CHỈNH SỬA / THAY THẾ ẢNH
    // ------------------------------------------------

    if (photoId && oldPhoto) {
      const result = await photos.updateOne(
        {
          _id: photoId,
        },
        {
          $set: {
            imageUrl,
            alt,
            updatedAt: now,
          },
        }
      );

      if (result.matchedCount === 0) {
        throw new Error(
          "Ảnh đã bị xóa trong khi cập nhật."
        );
      }

      databaseUpdated = true;

      // Dọn file cũ nếu file thuộc GridFS.
      const oldMatch = oldPhoto.imageUrl.match(
        /^\/api\/gallery\/image\/([a-f0-9]{24})$/
      );

      if (oldMatch) {
        try {
          await bucket.delete(
            new ObjectId(oldMatch[1])
          );
        } catch (cleanupError) {
          console.error(
            "[GALLERY OLD FILE CLEANUP]",
            cleanupError
          );
        }
      }

      const updated = await photos.findOne({
        _id: photoId,
      });

      if (!updated) {
        return respond({
          success: true,
          message: "Đã thay thế ảnh thành công.",
        });
      }

      return respond({
        success: true,
        message: "Đã thay thế ảnh thành công.",
        photo: serializeGalleryPhoto(updated),
      });
    }

    // ------------------------------------------------
    // 12. THÊM ẢNH MỚI
    // ------------------------------------------------

    const lastPhoto = await photos
      .find({})
      .sort({
        sortOrder: -1,
      })
      .limit(1)
      .next();

    const photo = {
      _id: createGalleryPhotoId(),
      imageUrl,
      alt: alt || "Ảnh cưới Nam và Thư",
      sortOrder:
        (lastPhoto?.sortOrder ?? -1) + 1,
      isVisible: true,
      createdBy: auth.admin.id,
      createdAt: now,
      updatedAt: now,
    };

    await photos.insertOne(photo);

    databaseUpdated = true;

    return respond(
      {
        success: true,
        message: "Đã tải ảnh lên Album thành công.",
        photo: serializeGalleryPhoto(photo),
      },
      201
    );
  } catch (error) {
    console.error(
      "[ADMIN GALLERY UPLOAD ERROR]",
      error
    );

    // Chỉ xóa tệp mới nếu chưa ghi thành công
    // thông tin ảnh vào gallery_photos.
    if (!databaseUpdated) {
      try {
        await bucket.delete(uploadedId);
      } catch (cleanupError) {
        console.error(
          "[GALLERY UPLOAD CLEANUP]",
          cleanupError
        );
      }
    }

    return fail(
      "Không thể tải ảnh lên. Vui lòng thử lại.",
      500
    );
  }
}
