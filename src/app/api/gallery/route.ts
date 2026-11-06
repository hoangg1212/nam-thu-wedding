
import { NextResponse } from "next/server";
import { connection } from "next/server";

import {
  ensureGalleryInitialized,
  getGalleryCollection,
  serializeGalleryPhoto,
} from "@/lib/wedding-gallery";

// ======================================================
// NAM & THU - PUBLIC GALLERY API
//
// GET /api/gallery
//
// Không yêu cầu đăng nhập.
// Chỉ trả ảnh có isVisible = true.
// Không trả thông tin Admin đã thêm ảnh.
// ======================================================

export async function GET() {
  // Tránh cố định kết quả trong prerender.
  await connection();

  try {
    await ensureGalleryInitialized();

    const collection = await getGalleryCollection();

    const documents = await collection
      .find({ isVisible: true })
      .sort({
        sortOrder: 1,
        createdAt: 1,
        _id: 1,
      })
      .toArray();

    const photos = documents.map((doc) => {
      const photo = serializeGalleryPhoto(doc);

      return {
        id: photo.id,
        imageUrl: photo.imageUrl,
        alt: photo.alt,
        sortOrder: photo.sortOrder,
      };
    });

    return NextResponse.json(
      {
        success: true,
        photos,
        total: photos.length,
      },
      {
        status: 200,
        headers: {
          "Cache-Control": "no-store",
          "X-Content-Type-Options": "nosniff",
        },
      }
    );
  } catch (error) {
    console.error("[PUBLIC GALLERY GET]", error);

    return NextResponse.json(
      {
        success: false,
        message: "Không thể tải Album ảnh.",
        photos: [],
      },
      {
        status: 503,
        headers: {
          "Cache-Control": "no-store",
        },
      }
    );
  }
}
