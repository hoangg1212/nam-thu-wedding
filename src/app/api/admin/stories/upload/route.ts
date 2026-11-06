
import {
  NextRequest,
  NextResponse,
} from "next/server";

import {
  GridFSBucket,
  ObjectId,
} from "mongodb";

import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";

import {
  requireAdminApi,
} from "@/lib/admin-auth";

import {
  getDatabase,
} from "@/lib/mongodb";

import {
  STORY_IMAGE_MAX_BYTES,
  STORY_IMAGE_API_PREFIX,
} from "@/lib/wedding-stories";

// ======================================================
// NAM & THU - LOVE STORY IMAGE UPLOAD
//
// GIAI ĐOẠN 3.8 - BƯỚC 4
//
// POST /api/admin/stories/upload
//
// Chức năng:
// - Xác thực phiên Admin.
// - Cả 3 quyền được upload ảnh.
// - Nhận file qua multipart/form-data.
// - Kiểm tra loại ảnh thật bằng magic bytes.
// - Giới hạn mỗi ảnh tối đa 8 MB.
// - Lưu ảnh trong MongoDB GridFS.
// - Trả về URL ảnh cho form Thêm/Sửa.
//
// Không tự tạo hoặc sửa cột mốc tại API này.
// Việc đó do /api/admin/stories thực hiện.
//
// Bucket MongoDB: story_uploads
// ======================================================

// ======================================================
// CONFIG
// ======================================================

const GRIDFS_BUCKET_NAME = "story_uploads";

// Giới hạn tổng multipart request lớn hơn
// dung lượng tệp một chút để chứa form metadata.
const MAX_REQUEST_BYTES =
  STORY_IMAGE_MAX_BYTES + 1024 * 1024;

// ======================================================
// RESPONSE HELPERS
// ======================================================

function sendJson(
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

function sendError(
  message: string,
  status = 400
) {
  return sendJson(
    {
      success: false,
      message,
    },
    status
  );
}

// ======================================================
// IMAGE FILE SIGNATURE
//
// Không tin hoàn toàn vào file.type
// hoặc phần mở rộng tên tệp.
//
// Kiểm tra bytes đầu để phân biệt:
// - JPEG
// - PNG
// - WebP
// ======================================================

type SupportedImageMime =
  | "image/jpeg"
  | "image/png"
  | "image/webp";

// Kiểm tra ảnh JPEG có phần đầu FF D8 FF.
function isJpeg(
  bytes: Uint8Array
): boolean {
  return (
    bytes.length >= 3 &&
    bytes[0] === 0xff &&
    bytes[1] === 0xd8 &&
    bytes[2] === 0xff
  );
}

// Kiểm tra chữ ký PNG gồm 8 bytes.
function isPng(
  bytes: Uint8Array
): boolean {
  const pngSignature = [
    0x89,
    0x50,
    0x4e,
    0x47,
    0x0d,
    0x0a,
    0x1a,
    0x0a,
  ];

  if (
    bytes.length <
    pngSignature.length
  ) {
    return false;
  }

  return pngSignature.every(
    (byte, index) =>
      bytes[index] === byte
  );
}

// WebP có dạng:
// RIFF .... WEBP
function isWebp(
  bytes: Uint8Array
): boolean {
  if (bytes.length < 12) {
    return false;
  }

  return (
    bytes[0] === 0x52 && // R
    bytes[1] === 0x49 && // I
    bytes[2] === 0x46 && // F
    bytes[3] === 0x46 && // F
    bytes[8] === 0x57 && // W
    bytes[9] === 0x45 && // E
    bytes[10] === 0x42 && // B
    bytes[11] === 0x50 // P
  );
}

// Xác định loại ảnh theo nội dung thực tế.
function detectImageMime(
  bytes: Uint8Array
): SupportedImageMime | null {
  if (isJpeg(bytes)) {
    return "image/jpeg";
  }

  if (isPng(bytes)) {
    return "image/png";
  }

  if (isWebp(bytes)) {
    return "image/webp";
  }

  return null;
}

// ======================================================
// FILE NAME
//
// Không sử dụng trực tiếp tên tệp do người dùng
// cung cấp làm đường dẫn lưu trên hệ thống.
//
// GridFS sẽ sử dụng ID ObjectId.
// ======================================================

function getExtension(
  mime: SupportedImageMime
): string {
  switch (mime) {
    case "image/jpeg":
      return "jpg";

    case "image/png":
      return "png";

    case "image/webp":
      return "webp";
  }
}

// ======================================================
// POST - UPLOAD IMAGE
// ======================================================

export async function POST(
  request: NextRequest
) {
  // ==================================================
  // 1. AUTHENTICATION
  //
  // Cả 3 Admin đều có stories:write.
  // Không truyền side vì Love Story dùng chung.
  // ==================================================

  const auth = await requireAdminApi(
    request,
    "stories:write"
  );

  if (auth.error) {
    return auth.error;
  }

  if (!auth.admin) {
    return sendError(
      "Phiên đăng nhập không hợp lệ.",
      401
    );
  }

  // ==================================================
  // 2. CONTENT TYPE
  // ==================================================

  const contentType =
    request.headers.get("content-type") ?? "";

  if (
    !contentType
      .toLowerCase()
      .startsWith("multipart/form-data")
  ) {
    return sendError(
      "Vui lòng gửi ảnh bằng multipart/form-data.",
      415
    );
  }

  // Kiểm tra sớm Content-Length nếu có.
  const contentLengthHeader =
    request.headers.get("content-length");

  if (contentLengthHeader) {
    const contentLength =
      Number(contentLengthHeader);

    if (
      !Number.isFinite(contentLength) ||
      contentLength < 0
    ) {
      return sendError(
        "Dung lượng request không hợp lệ.",
        400
      );
    }

    if (
      contentLength > MAX_REQUEST_BYTES
    ) {
      return sendError(
        "Request vượt quá dung lượng cho phép.",
        413
      );
    }
  }

  // ==================================================
  // 3. READ MULTIPART
  // ==================================================

  let formData: FormData;

  try {
    formData = await request.formData();
  } catch (error) {
    console.error(
      "[STORIES UPLOAD FORM]",
      error
    );

    return sendError(
      "Không thể đọc dữ liệu ảnh tải lên.",
      400
    );
  }

  const inputFile = formData.get("file");

  if (!(inputFile instanceof File)) {
    return sendError(
      "Vui lòng chọn ảnh để tải lên.",
      400
    );
  }

  // ==================================================
  // 4. FILE SIZE
  // ==================================================

  if (inputFile.size === 0) {
    return sendError(
      "Tệp ảnh đang trống.",
      400
    );
  }

  if (
    inputFile.size >
    STORY_IMAGE_MAX_BYTES
  ) {
    return sendError(
      "Dung lượng ảnh không được vượt quá 8 MB.",
      413
    );
  }

  // ==================================================
  // 5. READ FILE BYTES
  // ==================================================

  let bytes: Uint8Array;

  try {
    bytes = new Uint8Array(
      await inputFile.arrayBuffer()
    );
  } catch (error) {
    console.error(
      "[STORIES UPLOAD READ FILE]",
      error
    );

    return sendError(
      "Không thể đọc nội dung tệp ảnh.",
      400
    );
  }

  // Kiểm tra lại kích thước sau khi đọc.
  if (
    bytes.byteLength === 0 ||
    bytes.byteLength >
      STORY_IMAGE_MAX_BYTES
  ) {
    return sendError(
      "Dung lượng ảnh không hợp lệ.",
      413
    );
  }

  // ==================================================
  // 6. VALIDATE REAL IMAGE FORMAT
  // ==================================================

  const detectedMime =
    detectImageMime(bytes);

  if (!detectedMime) {
    return sendError(
      "Ảnh không hợp lệ. Chỉ hỗ trợ JPG, PNG và WebP.",
      415
    );
  }

  // Chỉ chấp nhận loại MIME mà browser khai báo
  // nếu trùng với loại ảnh đã phát hiện.
  //
  // Việc này giúp phát hiện trường hợp đổi đuôi
  // hoặc giả mạo định dạng ảnh.
  if (
    inputFile.type &&
    inputFile.type !== detectedMime
  ) {
    return sendError(
      "Định dạng tệp không khớp nội dung ảnh.",
      415
    );
  }

  // ==================================================
  // 7. SAVE TO MONGODB GRIDFS
  // ==================================================

  const fileId = new ObjectId();

  let bucket: GridFSBucket | null = null;

  // Biến theo dõi việc bắt đầu ghi.
  let uploadStarted = false;

  try {
    const database =
      await getDatabase();

    bucket = new GridFSBucket(
      database,
      {
        bucketName:
          GRIDFS_BUCKET_NAME,
      }
    );

    const extension = getExtension(
      detectedMime
    );

    // Tên file nội bộ an toàn, dựa trên ObjectId.
    const filename =
      `love-story-${fileId.toHexString()}.${extension}`;

    // Metadata để có thể kiểm tra và dọn tệp.
    const metadata = {
      category: "love-story",
      uploadedBy: auth.admin.id,
      originalName: inputFile.name.slice(0, 255),
      uploadedAt: new Date(),
      mimeType: detectedMime,
    };

    // Tạo luồng ghi GridFS.
    //
    // metadata.contentType được lưu
    // trong file document thông qua options.
    const uploadStream =
      bucket.openUploadStreamWithId(
        fileId,
        filename,
        {
          contentType: detectedMime,
          metadata,
        }
      );

    uploadStarted = true;

    // Ghi dữ liệu ảnh vào GridFS bằng pipeline.
    //
    // Readable.from([Buffer]) giúp truyền
    // một buffer như luồng dữ liệu Node.js.
    await pipeline(
      Readable.from([
        Buffer.from(bytes),
      ]),
      uploadStream
    );

    // ==================================================
    // 8. RETURN IMAGE URL
    // ==================================================

    const imageUrl =
      `${STORY_IMAGE_API_PREFIX}${fileId.toHexString()}`;

    return sendJson(
      {
        success: true,
        message:
          "Đã tải ảnh Love Story lên thành công.",

        // Form quản trị có thể dùng imageUrl.
        imageUrl,

        // Alias để tương thích với field image.
        image: imageUrl,

        // Metadata cơ bản.
        file: {
          id: fileId.toHexString(),
          name: filename,
          mimeType: detectedMime,
          size: bytes.byteLength,
        },
      },
      201
    );
  } catch (error) {
    console.error(
      "[STORIES UPLOAD GRIDFS]",
      error
    );

    // ==================================================
    // 9. CLEANUP WHEN UPLOAD FAILS
    //
    // Nếu đã bắt đầu ghi nhưng gặp lỗi,
    // thử xóa tệp GridFS chưa hoàn chỉnh.
    // ==================================================

    if (bucket && uploadStarted) {
      try {
        await bucket.delete(fileId);
      } catch (cleanupError) {
        console.error(
          "[STORIES UPLOAD CLEANUP]",
          cleanupError
        );
      }
    }

    return sendError(
      "Không thể lưu ảnh lên MongoDB. Vui lòng thử lại.",
      500
    );
  }
}
