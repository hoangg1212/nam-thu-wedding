
import {
  NextRequest,
  NextResponse,
  connection,
} from "next/server";

import {
  GridFSBucket,
  ObjectId,
} from "mongodb";

import {
  getCurrentAdmin,
  hasAdminPermission,
} from "@/lib/admin-auth";

import { getDatabase } from "@/lib/mongodb";

import {
  getGalleryCollection,
} from "@/lib/wedding-gallery";

// ======================================================
// NAM & THU - GALLERY IMAGE API
//
// GET /api/gallery/image/[id]
//
// Quy tắc:
// - Ảnh đang hiện: mọi khách đều có thể xem.
// - Ảnh đang ẩn: chỉ Admin có quyền gallery:read.
// - Ảnh đã xóa khỏi Album: trả 404.
//
// Không sử dụng export const runtime
// vì dự án bật Cache Components.
// ======================================================

interface RouteContext {
  params: Promise<{
    id: string;
  }>;
}

function fail(
  message: string,
  status: number
) {
  return NextResponse.json(
    {
      success: false,
      message,
    },
    {
      status,
      headers: {
        "Cache-Control":
          "private, no-store",
        "X-Content-Type-Options":
          "nosniff",
      },
    }
  );
}

// ======================================================
// GET IMAGE
// ======================================================

export async function GET(
  _request: NextRequest,
  context: RouteContext
) {
  // Đọc dữ liệu tại thời điểm request.
  await connection();

  const { id } = await context.params;

  if (
    !/^[a-f0-9]{24}$/i.test(id)
  ) {
    return fail(
      "Mã ảnh không hợp lệ.",
      400
    );
  }

  try {
    const database =
      await getDatabase();

    const imageUrl =
      `/api/gallery/image/${id.toLowerCase()}`;

    // ==================================================
    // 1. KIỂM TRA ẢNH CÓ TRONG ALBUM
    // ==================================================

    const gallery =
      await getGalleryCollection();

    const photo =
      await gallery.findOne({
        imageUrl,
      });

    if (!photo) {
      return fail(
        "Không tìm thấy ảnh.",
        404
      );
    }

    // ==================================================
    // 2. KIỂM TRA TRẠNG THÁI HIỂN THỊ
    // ==================================================

    if (
      photo.isVisible !== true
    ) {
      // Admin được phép xem trước ảnh ẩn.
      const admin =
        await getCurrentAdmin();

      if (
        !admin ||
        !hasAdminPermission(
          admin.role,
          "gallery:read"
        )
      ) {
        return fail(
          "Không tìm thấy ảnh.",
          404
        );
      }
    }

    // ==================================================
    // 3. KIỂM TRA GRIDFS FILE
    // ==================================================

    const fileId =
      new ObjectId(id);

    const files =
      database.collection(
        "gallery_uploads.files"
      );

    const file =
      await files.findOne({
        _id: fileId,
      });

    if (!file) {
      return fail(
        "Không tìm thấy dữ liệu ảnh.",
        404
      );
    }

    const mime =
      file.contentType;

    if (
      mime !== "image/jpeg" &&
      mime !== "image/png" &&
      mime !== "image/webp"
    ) {
      return fail(
        "Định dạng ảnh không được hỗ trợ.",
        415
      );
    }

    // ==================================================
    // 4. ĐỌC ẢNH TỪ GRIDFS
    // ==================================================

    const bucket =
      new GridFSBucket(
        database,
        {
          bucketName:
            "gallery_uploads",
        }
      );

    const chunks: Buffer[] = [];

    for await (
      const chunk of bucket.openDownloadStream(
        fileId
      )
    ) {
      chunks.push(
        Buffer.from(chunk)
      );
    }

    const image =
      Buffer.concat(chunks);

    // ==================================================
    // 5. TRẢ DỮ LIỆU ẢNH
    //
    // Dùng no-store để ảnh đã ẩn/xóa
    // không tiếp tục được phục vụ từ cache HTTP.
    // ==================================================

    return new NextResponse(
      new Uint8Array(image),
      {
        status: 200,
        headers: {
          "Content-Type": mime,
          "Content-Length":
            String(image.length),
          "Cache-Control":
            "private, no-store",
          "Content-Disposition":
            "inline",
          "X-Content-Type-Options":
            "nosniff",
        },
      }
    );
  } catch (error) {
    console.error(
      "[GALLERY IMAGE GET]",
      error
    );

    return fail(
      "Không thể tải ảnh.",
      500
    );
  }
}
