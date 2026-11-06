
import {
  NextRequest,
  NextResponse,
} from "next/server";

import {
  GridFSBucket,
  ObjectId,
  type Document,
} from "mongodb";

import {
  getCurrentAdmin,
  hasAdminPermission,
} from "@/lib/admin-auth";

import {
  getDatabase,
} from "@/lib/mongodb";

import {
  getStoriesCollection,
  STORY_IMAGE_API_PREFIX,
  STORY_IMAGE_MAX_BYTES,
} from "@/lib/wedding-stories";

// ======================================================
// NAM & THU - LOVE STORY IMAGE API
//
// GIAI ĐOẠN 3.8 - BƯỚC 5
//
// GET /api/stories/image/[id]
//
// Chức năng:
// 1. Đọc ảnh Love Story từ MongoDB GridFS.
// 2. Kiểm tra ID ảnh hợp lệ.
// 3. Kiểm tra ảnh có tồn tại không.
// 4. Kiểm tra ảnh thuộc Love Story nào.
// 5. Ảnh đang hiển thị: khách được xem.
// 6. Ảnh đang ẩn: chỉ Admin được xem.
// 7. Ảnh chưa gắn vào cột mốc:
//    chỉ Admin được xem trước.
// 8. Kiểm tra loại ảnh và dung lượng.
// 9. Trả về dữ liệu ảnh đúng Content-Type.
//
// Album Love Story dùng chung cho cả ba Admin.
//
// Bucket: story_uploads
//
// Không khai báo export const runtime.
// ======================================================

// ======================================================
// CONFIG
// ======================================================

const GRIDFS_BUCKET_NAME = "story_uploads";

const SUPPORTED_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
] as const;

type SupportedMime =
  (typeof SUPPORTED_MIME_TYPES)[number];

// ======================================================
// TYPES
// ======================================================

// Next.js 16 sử dụng params kiểu Promise.
interface RouteContext {
  params: Promise<{
    id: string;
  }>;
}

// Metadata của tệp lưu trong GridFS.
interface StoryGridFsMetadata {
  category?: string;
  uploadedBy?: string;
  uploadedAt?: Date;
  mimeType?: string;
}

// ======================================================
// RESPONSE HELPERS
// ======================================================

// Trả lỗi JSON có cùng cấu trúc với API khác.
function sendError(
  message: string,
  status = 400
) {
  return NextResponse.json(
    {
      success: false,
      message,
    },
    {
      status,
      headers: {
        // Không cache lỗi và trạng thái truy cập.
        "Cache-Control": "private, no-store",

        // Tránh trình duyệt đoán MIME.
        "X-Content-Type-Options": "nosniff",
      },
    }
  );
}

// ======================================================
// VALIDATION HELPERS
// ======================================================

// ObjectId MongoDB gồm chính xác 24 ký tự hex.
//
// Không dùng riêng ObjectId.isValid vì muốn
// đảm bảo URL chỉ nhận định dạng 24-hex.
function isValidGridFsId(
  value: string
): boolean {
  return /^[a-f0-9]{24}$/i.test(value);
}

// Kiểm tra MIME chỉ thuộc các định dạng hỗ trợ.
function isSupportedMime(
  value: unknown
): value is SupportedMime {
  return (
    typeof value === "string" &&
    SUPPORTED_MIME_TYPES.some(
      (type) => type === value
    )
  );
}

// Lấy MIME đã lưu từ GridFS.
//
// Bước upload trước đó lưu:
// - contentType tại file document.
// - metadata.mimeType.
//
// Nếu dữ liệu thiếu hoặc sai:
// không trả file về trình duyệt.
function getImageMime(
  file: Document
): SupportedMime | null {
  const metadata =
    file.metadata as
      | StoryGridFsMetadata
      | undefined;

  const contentType = file.contentType;
  const metadataMime = metadata?.mimeType;

  // Ưu tiên MIME chính thức của GridFS.
  if (isSupportedMime(contentType)) {
    // Nếu metadata cũng có MIME,
    // hai giá trị phải khớp.
    if (
      metadataMime !== undefined &&
      metadataMime !== contentType
    ) {
      return null;
    }

    return contentType;
  }

  // Tương thích khi chỉ có metadata MIME.
  if (isSupportedMime(metadataMime)) {
    return metadataMime;
  }

  return null;
}

// ======================================================
// ADMIN ACCESS
// ======================================================

// Kiểm tra người đang truy cập có quyền
// đọc dữ liệu Love Story hay không.
//
// Không giới hạn Nhà trai / Nhà gái vì
// stories:read là quyền chung cho ba Admin.
async function canAdminReadStories():
  Promise<boolean> {
  const admin = await getCurrentAdmin();

  if (!admin) {
    return false;
  }

  return hasAdminPermission(
    admin.role,
    "stories:read"
  );
}

// ======================================================
// GET IMAGE
// ======================================================

export async function GET(
  _request: NextRequest,
  context: RouteContext
) {
  // ==================================================
  // 1. GET IMAGE ID
  // ==================================================

  const { id } = await context.params;

  // Kiểm tra ID trước khi gọi MongoDB.
  if (!isValidGridFsId(id)) {
    return sendError(
      "Mã ảnh không hợp lệ.",
      400
    );
  }

  const normalizedId = id.toLowerCase();

  const fileId = new ObjectId(
    normalizedId
  );

  const imageUrl =
    `${STORY_IMAGE_API_PREFIX}${normalizedId}`;

  try {
    // ==================================================
    // 2. CONNECT MONGODB
    // ==================================================

    const database =
      await getDatabase();

    // Đọc từ collection GridFS files.
    const filesCollection =
      database.collection(
        `${GRIDFS_BUCKET_NAME}.files`
      );

    const file =
      await filesCollection.findOne({
        _id: fileId,
      });

    // Không có file thực tế trên MongoDB.
    if (!file) {
      return sendError(
        "Không tìm thấy ảnh.",
        404
      );
    }

    // ==================================================
    // 3. VERIFY IMAGE OWNERSHIP
    //
    // Endpoint chỉ phục vụ ảnh do hệ thống
    // upload vào bucket Love Story.
    // ==================================================

    const metadata =
      file.metadata as
        | StoryGridFsMetadata
        | undefined;

    if (
      metadata?.category !== "love-story"
    ) {
      return sendError(
        "Không tìm thấy ảnh Love Story.",
        404
      );
    }

    // ==================================================
    // 4. VALIDATE MIME
    // ==================================================

    const mime = getImageMime(file);

    if (!mime) {
      return sendError(
        "Định dạng ảnh không được hỗ trợ.",
        415
      );
    }

    // ==================================================
    // 5. VALIDATE FILE SIZE
    //
    // Không đọc file có kích thước vượt
    // quá giới hạn hệ thống.
    // ==================================================

    const fileSize = file.length;

    if (
      typeof fileSize !== "number" ||
      !Number.isSafeInteger(fileSize) ||
      fileSize <= 0 ||
      fileSize > STORY_IMAGE_MAX_BYTES
    ) {
      return sendError(
        "Dung lượng ảnh không hợp lệ.",
        413
      );
    }

    // ==================================================
    // 6. CHECK IMAGE VISIBILITY
    //
    // Các trường hợp:
    //
    // A. Có ít nhất một cột mốc công khai
    //    sử dụng ảnh -> cho khách xem.
    //
    // B. Ảnh chỉ được dùng bởi cột mốc ẩn
    //    -> yêu cầu Admin.
    //
    // C. Ảnh chưa gắn vào cột mốc
    //    -> chỉ Admin xem trước.
    //
    // D. Ảnh thuộc cột mốc đã xóa
    //    -> không công khai.
    // ==================================================

    const storiesCollection =
      await getStoriesCollection();

    // Có cột mốc đang hiển thị dùng ảnh?
    const visibleStory =
      await storiesCollection.findOne(
        {
          image: imageUrl,
          isVisible: true,
        },
        {
          projection: {
            _id: 1,
          },
        }
      );

    // Nếu ảnh chưa được công khai,
    // chỉ Admin có quyền đọc mới xem được.
    if (!visibleStory) {
      const allowed =
        await canAdminReadStories();

      if (!allowed) {
        // Dùng 404 để không tiết lộ sự tồn tại
        // của ảnh đang ẩn hoặc chưa sử dụng.
        return sendError(
          "Không tìm thấy ảnh.",
          404
        );
      }
    }

    // ==================================================
    // 7. READ GRIDFS
    // ==================================================

    const bucket = new GridFSBucket(
      database,
      {
        bucketName:
          GRIDFS_BUCKET_NAME,
      }
    );

    const chunks: Buffer[] = [];

    let totalBytes = 0;

    // Đọc các chunks của ảnh từ GridFS.
    //
    // Ảnh tối đa 8 MB nên có thể gom vào
    // một Buffer trước khi gửi response.
    for await (
      const chunk of bucket.openDownloadStream(
        fileId
      )
    ) {
      const buffer =
        Buffer.from(chunk);

      totalBytes += buffer.length;

      // Kiểm tra lại để phòng metadata sai.
      if (
        totalBytes > STORY_IMAGE_MAX_BYTES
      ) {
        return sendError(
          "Ảnh vượt quá dung lượng cho phép.",
          413
        );
      }

      chunks.push(buffer);
    }

    // File không có dữ liệu.
    if (totalBytes === 0) {
      return sendError(
        "Dữ liệu ảnh đang trống.",
        404
      );
    }

    // Đối chiếu kích thước thực tế với GridFS.
    if (totalBytes !== fileSize) {
      console.error(
        "[STORY IMAGE SIZE MISMATCH]",
        {
          id: normalizedId,
          expected: fileSize,
          actual: totalBytes,
        }
      );

      return sendError(
        "Dữ liệu ảnh không đầy đủ.",
        500
      );
    }

    // Ghép tất cả chunks thành một Buffer.
    const imageBuffer =
      Buffer.concat(chunks);

    // ==================================================
    // 8. RETURN IMAGE RESPONSE
    //
    // Không sử dụng public cache vì trạng thái
    // ẩn/hiện có thể thay đổi bất cứ lúc nào.
    //
    // Không cache cũng giúp URL ảnh sau khi
    // bị xóa/ẩn sẽ được kiểm tra lại.
    // ==================================================

    return new NextResponse(
      new Uint8Array(imageBuffer),
      {
        status: 200,
        headers: {
          "Content-Type": mime,

          "Content-Length":
            String(imageBuffer.byteLength),

          "Content-Disposition": "inline",

          "Cache-Control":
            "private, no-store",

          "X-Content-Type-Options":
            "nosniff",
        },
      }
    );
  } catch (error) {
    // ==================================================
    // 9. ERROR HANDLING
    // ==================================================

    console.error(
      "[LOVE STORY IMAGE GET]",
      {
        imageId: normalizedId,
        error,
      }
    );

    return sendError(
      "Không thể tải ảnh Love Story.",
      500
    );
  }
}
