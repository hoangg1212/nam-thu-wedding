
import {
  NextResponse,
} from "next/server";

import {
  getPublicWeddingStories,
} from "@/lib/wedding-stories";

// ======================================================
// NAM & THU - PUBLIC LOVE STORY API
//
// GIAI ĐOẠN 3.8 - BƯỚC 6
//
// GET /api/stories
//
// Chức năng:
// 1. Lấy Love Story từ MongoDB Atlas.
// 2. Chỉ trả về cột mốc đang hiển thị.
// 3. Giữ thứ tự sắp xếp của Admin.
// 4. Không yêu cầu đăng nhập.
// 5. Không tiết lộ thông tin quản trị.
// 6. Không trả dữ liệu cũ khi Album rỗng.
//
// API chỉ đọc, không cho thêm/sửa/xóa.
//
// Admin sử dụng API riêng:
// /api/admin/stories
// ======================================================

// ======================================================
// TYPES
// ======================================================

// Dữ liệu công khai cho frontend.
//
// Không bao gồm:
// - createdBy
// - createdAt
// - updatedAt
// - isVisible
//
// Các trường này không cần thiết trên thiệp cưới.
interface PublicStory {
  id: string;

  date: string;

  title: string;

  description: string;

  image: string;

  sortOrder: number;
}

// ======================================================
// RESPONSE HELPERS
// ======================================================

// Tạo response JSON chung.
//
// no-store để trạng thái ẩn/hiện và thứ tự
// được kiểm tra lại ở mỗi request.
//
// Không phụ thuộc cache của trình duyệt.
function sendJson(
  data: Record<string, unknown>,
  status = 200
) {
  return NextResponse.json(
    data,
    {
      status,
      headers: {
        "Cache-Control":
          "public, no-store",

        "X-Content-Type-Options":
          "nosniff",
      },
    }
  );
}

// ======================================================
// GET PUBLIC STORIES
// ======================================================

export async function GET() {
  try {
    // ==================================================
    // 1. READ DATABASE
    //
    // getPublicWeddingStories() thực hiện:
    // - Khởi tạo dữ liệu ban đầu nếu cần.
    // - Chỉ lấy isVisible=true.
    // - Sắp xếp sortOrder tăng dần.
    // ==================================================

    const stories =
      await getPublicWeddingStories();

    // ==================================================
    // 2. SERIALIZE PUBLIC FIELDS
    //
    // Không trả thông tin nội bộ của Admin.
    // ==================================================

    const publicStories: PublicStory[] =
      stories.map((story) => ({
        id: story.id,

        date: story.date,

        title: story.title,

        description: story.description,

        image: story.image,

        sortOrder: story.sortOrder,
      }));

    // ==================================================
    // 3. RETURN RESPONSE
    //
    // Nếu không có cột mốc nào đang hiện:
    // stories = []
    //
    // Đây là trạng thái hợp lệ, không phải lỗi.
    // ==================================================

    return sendJson({
      success: true,

      stories: publicStories,

      total: publicStories.length,
    });
  } catch (error) {
    // ==================================================
    // 4. ERROR HANDLING
    //
    // Không gửi thông tin lỗi MongoDB,
    // chuỗi kết nối hoặc stack trace cho khách.
    // ==================================================

    console.error(
      "[PUBLIC LOVE STORY GET]",
      error
    );

    return sendJson(
      {
        success: false,

        message:
          "Không thể tải câu chuyện tình yêu.",

        stories: [],
      },
      500
    );
  }
}
