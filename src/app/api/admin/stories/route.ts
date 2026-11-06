
import {
  NextRequest,
  NextResponse,
} from "next/server";

import type {
  WeddingStoryDocument,
} from "@/lib/wedding-stories";

import {
  requireAdminApi,
} from "@/lib/admin-auth";

import {
  createWeddingStoryId,
  ensureStoriesInitialized,
  getStoriesCollection,
  serializeWeddingStory,
  validateStoryDate,
  validateStoryDescription,
  validateStoryImageUrl,
  validateStoryTitle,
} from "@/lib/wedding-stories";

// ======================================================
// NAM & THU - ADMIN LOVE STORY API
//
// GIAI ĐOẠN 3.10 - BƯỚC 5.7
//
// GET    /api/admin/stories
// POST   /api/admin/stories
// PATCH  /api/admin/stories
// DELETE /api/admin/stories
//
// PHÂN TRANG:
// - Mặc định 8 cột mốc/trang khi có page.
// - Tối đa 8 cột mốc/trang.
// - Phân trang trực tiếp tại MongoDB.
// - Trả về pagination metadata.
// - Tổng số, đang hiện, đang ẩn được đếm
//   trên toàn bộ collection.
//
// TƯƠNG THÍCH FRONTEND CŨ:
// - GET không có page: trả toàn bộ cột mốc.
// - GET có page: chỉ trả dữ liệu trang đó.
// - Reorder vẫn nhận toàn bộ danh sách ID.
//
// Cả 3 tài khoản quản lý Love Story chung:
// - super_admin
// - groom_admin
// - bride_admin
//
// CHỨC NĂNG GIỮ NGUYÊN:
// - Thêm cột mốc.
// - Chỉnh sửa ngày, tiêu đề, nội dung, ảnh.
// - Ẩn / hiện.
// - Sắp xếp toàn bộ timeline.
// - Xóa cột mốc.
// - Upload ảnh bằng API riêng.
// ======================================================

// ======================================================
// CONFIG
// ======================================================

// Giới hạn dung lượng JSON.
const MAX_JSON_BYTES = 32 * 1024;

// Giới hạn danh sách ID được reorder.
const MAX_REORDER_ITEMS = 1000;

// Phân trang 8 cột mốc.
const DEFAULT_PAGE_SIZE = 8;

// Không cho vượt quá 8 cột mốc/trang.
const MAX_PAGE_SIZE = 8;

// Giới hạn số trang từ query.
const MAX_PAGE = 100000;

// ======================================================
// TYPES
// ======================================================

interface StoryPagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

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
// VALIDATION HELPERS
// ======================================================

// Kiểm tra JSON object.
function isRecord(
  value: unknown
): value is Record<string, unknown> {
  return (
    value !== null &&
    typeof value === "object" &&
    !Array.isArray(value)
  );
}

// Kiểm tra mã cột mốc.
//
// Hỗ trợ ID:
// - UUID
// - initial-story-1
// - Chuỗi chữ, số, "_" và "-"
function isValidStoryId(
  value: unknown
): value is string {
  return (
    typeof value === "string" &&
    value.length >= 1 &&
    value.length <= 100 &&
    /^[a-zA-Z0-9_-]+$/.test(value)
  );
}

// Kiểm tra tham số page và limit.
//
// Ví dụ:
// page=2 -> 2
// page=abc -> 1
// page=-1 -> 1
// limit=100 -> 8
function positiveInteger(
  value: string | null,
  fallback: number,
  maximum: number
): number {
  if (!value) {
    return fallback;
  }

  const parsed = Number(value);

  if (
    !Number.isSafeInteger(parsed) ||
    parsed < 1
  ) {
    return fallback;
  }

  return Math.min(
    parsed,
    maximum
  );
}

// ======================================================
// READ REQUEST BODY
//
// Giữ cơ chế validation và giới hạn JSON.
// ======================================================

async function readRequestBody(
  request: NextRequest
): Promise<Record<string, unknown>> {
  const contentType =
    request.headers.get("content-type") ?? "";

  if (
    !contentType
      .toLowerCase()
      .includes("application/json")
  ) {
    throw new Error(
      "Dữ liệu gửi lên phải là JSON."
    );
  }

  const contentLength = Number(
    request.headers.get("content-length")
  );

  if (
    Number.isFinite(contentLength) &&
    contentLength > MAX_JSON_BYTES
  ) {
    throw new Error(
      "Dữ liệu gửi lên vượt quá dung lượng cho phép."
    );
  }

  const raw = await request.text();

  if (
    Buffer.byteLength(raw, "utf8") >
    MAX_JSON_BYTES
  ) {
    throw new Error(
      "Dữ liệu gửi lên vượt quá dung lượng cho phép."
    );
  }

  if (!raw.trim()) {
    throw new Error(
      "Nội dung yêu cầu không được để trống."
    );
  }

  let parsed: unknown;

  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error(
      "Dữ liệu JSON không hợp lệ."
    );
  }

  if (!isRecord(parsed)) {
    throw new Error(
      "Nội dung yêu cầu phải là một object."
    );
  }

  return parsed;
}

// ======================================================
// GET - LIST LOVE STORIES
//
// Hỗ trợ 2 chế độ:
// 1. Không có page: lấy tất cả.
// 2. Có page: phân trang tối đa 8 bản ghi.
//
// Ảnh ẩn vẫn hiển thị trong Admin.
// ======================================================

export async function GET(
  request: NextRequest
) {
  try {
    // ================================================
    // AUTHORIZATION
    // ================================================

    const auth = await requireAdminApi(
      request,
      "stories:read"
    );

    if (auth.error) {
      return auth.error;
    }

    if (!auth.admin) {
      return sendError(
        "Vui lòng đăng nhập lại.",
        401
      );
    }

    // ================================================
    // INITIALIZE DATA
    // ================================================

    await ensureStoriesInitialized();

    const collection =
      await getStoriesCollection();

    const params =
      request.nextUrl.searchParams;

    // Frontend cũ không gửi page.
    // Tiếp tục trả tất cả để hỗ trợ reorder.
    const isPaginated = params.has("page");

    // ================================================
    // LEGACY MODE - GET ALL STORIES
    // ================================================

    if (!isPaginated) {
      const documents = await collection
        .find({})
        .sort({
          sortOrder: 1,
          createdAt: 1,
          _id: 1,
        })
        .toArray();

      const stories = documents.map(
        serializeWeddingStory
      );

      return sendJson({
        success: true,
        stories,
        total: stories.length,
        visible: stories.filter(
          (story) => story.isVisible
        ).length,
        hidden: stories.filter(
          (story) => !story.isVisible
        ).length,
      });
    }

    // ================================================
    // PAGINATION MODE
    // ================================================

    const page = positiveInteger(
      params.get("page"),
      1,
      MAX_PAGE
    );

    const limit = positiveInteger(
      params.get("limit"),
      DEFAULT_PAGE_SIZE,
      MAX_PAGE_SIZE
    );

    // Trang 1: skip 0
    // Trang 2: skip 8
    // Trang 3: skip 16
    const skip = (page - 1) * limit;

    // ================================================
    // DATABASE QUERY
    //
    // Thực hiện song song:
    // - Lấy dữ liệu trang.
    // - Đếm toàn bộ.
    // - Đếm cột mốc đang hiện.
    // - Đếm cột mốc đang ẩn.
    // ================================================

    const [
      documents,
      total,
      visible,
      hidden,
    ] = await Promise.all([
      collection
        .find({})
        .sort({
          sortOrder: 1,
          createdAt: 1,
          _id: 1,
        })
        .skip(skip)
        .limit(limit)
        .toArray(),

      collection.countDocuments({}),

      collection.countDocuments({
        isVisible: true,
      }),

      collection.countDocuments({
        isVisible: false,
      }),
    ]);

    const stories = documents.map(
      serializeWeddingStory
    );

    const pagination: StoryPagination = {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    };

    return sendJson({
      success: true,
      stories,
      total,
      visible,
      hidden,
      pagination,
    });
  } catch (error) {
    console.error(
      "[ADMIN STORIES GET]",
      error
    );

    return sendError(
      "Không thể tải danh sách Love Story.",
      500
    );
  }
}

// ======================================================
// POST - CREATE NEW STORY
//
// Không thay đổi cấu trúc dữ liệu.
// Cột mốc mới được thêm ở cuối timeline.
// ======================================================

export async function POST(
  request: NextRequest
) {
  // ================================================
  // AUTHORIZATION
  // ================================================

  const auth = await requireAdminApi(
    request,
    "stories:write"
  );

  if (auth.error) {
    return auth.error;
  }

  if (!auth.admin) {
    return sendError(
      "Vui lòng đăng nhập lại.",
      401
    );
  }

  // ================================================
  // READ JSON
  // ================================================

  let body: Record<string, unknown>;

  try {
    body = await readRequestBody(request);
  } catch (error) {
    return sendError(
      error instanceof Error
        ? error.message
        : "Dữ liệu không hợp lệ.",
      400
    );
  }

  // ================================================
  // VALIDATE FORM VALUES
  // ================================================

  let date: string;
  let title: string;
  let description: string;
  let image: string;

  try {
    date = validateStoryDate(body.date);

    title = validateStoryTitle(body.title);

    description = validateStoryDescription(
      body.description
    );

    image = validateStoryImageUrl(
      body.image ?? ""
    );
  } catch (error) {
    return sendError(
      error instanceof Error
        ? error.message
        : "Thông tin cột mốc không hợp lệ.",
      400
    );
  }

  // ================================================
  // INSERT DOCUMENT
  // ================================================

  try {
    await ensureStoriesInitialized();

    const collection =
      await getStoriesCollection();

    // Lấy sortOrder lớn nhất.
    const lastStory = await collection
      .find({})
      .sort({
        sortOrder: -1,
      })
      .limit(1)
      .next();

    const now = new Date();

    const story: WeddingStoryDocument = {
      _id: createWeddingStoryId(),

      date,
      title,
      description,
      image,

      sortOrder:
        (lastStory?.sortOrder ?? -1) + 1,

      isVisible: true,

      createdBy: auth.admin.id,

      createdAt: now,
      updatedAt: now,
    };

    await collection.insertOne(story);

    return sendJson(
      {
        success: true,
        message:
          "Đã thêm cột mốc Love Story thành công.",
        story: serializeWeddingStory(story),
      },
      201
    );
  } catch (error) {
    console.error(
      "[ADMIN STORIES POST]",
      error
    );

    return sendError(
      "Không thể thêm cột mốc Love Story.",
      500
    );
  }
}

// ======================================================
// PATCH - UPDATE STORY OR REORDER
//
// 1. Cập nhật một cột mốc.
// 2. Ẩn / hiện.
// 3. Sắp xếp toàn bộ timeline.
//
// Chế độ reorder tiếp tục nhận tất cả ID,
// không phải chỉ 8 ID của một trang.
// ======================================================

export async function PATCH(
  request: NextRequest
) {
  // ================================================
  // AUTHORIZATION
  // ================================================

  const auth = await requireAdminApi(
    request,
    "stories:write"
  );

  if (auth.error) {
    return auth.error;
  }

  if (!auth.admin) {
    return sendError(
      "Vui lòng đăng nhập lại.",
      401
    );
  }

  // ================================================
  // READ JSON
  // ================================================

  let body: Record<string, unknown>;

  try {
    body = await readRequestBody(request);
  } catch (error) {
    return sendError(
      error instanceof Error
        ? error.message
        : "Dữ liệu không hợp lệ.",
      400
    );
  }

  try {
    await ensureStoriesInitialized();

    const collection =
      await getStoriesCollection();

    // ================================================
    // REORDER
    // ================================================

    if (body.action === "reorder") {
      const ids = body.ids;

      // Bảo đảm danh sách ID hợp lệ.
      if (
        !Array.isArray(ids) ||
        ids.length > MAX_REORDER_ITEMS ||
        !ids.every(isValidStoryId)
      ) {
        return sendError(
          "Danh sách thứ tự không hợp lệ.",
          400
        );
      }

      const uniqueIds = new Set(ids);

      if (uniqueIds.size !== ids.length) {
        return sendError(
          "Danh sách có mã cột mốc bị trùng.",
          400
        );
      }

      // ================================================
      // VERIFY ALL STORY IDS
      // ================================================

      const existingStories = await collection
        .find(
          {},
          {
            projection: {
              _id: 1,
            },
          }
        )
        .toArray();

      const existingIds = new Set(
        existingStories.map(
          (story) => story._id
        )
      );

      // Chống sắp xếp bằng danh sách thiếu ID.
      if (
        ids.length !== existingIds.size ||
        !ids.every(
          (id) => existingIds.has(id)
        )
      ) {
        return sendError(
          "Danh sách cột mốc đã thay đổi. Vui lòng tải lại.",
          409
        );
      }

      if (ids.length === 0) {
        return sendJson({
          success: true,
          message:
            "Chưa có cột mốc để sắp xếp.",
        });
      }

      const now = new Date();

      // Ghi sortOrder toàn bộ cột mốc.
      await collection.bulkWrite(
        ids.map((id, index) => ({
          updateOne: {
            filter: {
              _id: id,
            },
            update: {
              $set: {
                sortOrder: index,
                updatedAt: now,
              },
            },
          },
        }))
      );

      // Trả về toàn bộ dữ liệu sau sắp xếp
      // để tương thích frontend hiện tại.
      const documents = await collection
        .find({})
        .sort({
          sortOrder: 1,
          createdAt: 1,
          _id: 1,
        })
        .toArray();

      return sendJson({
        success: true,
        message:
          "Đã cập nhật thứ tự Love Story.",
        stories: documents.map(
          serializeWeddingStory
        ),
      });
    }

    // ================================================
    // EDIT SINGLE STORY
    // ================================================

    if (!isValidStoryId(body.id)) {
      return sendError(
        "Mã cột mốc không hợp lệ.",
        400
      );
    }

    // Chỉ cho phép thay đổi các trường
    // thuộc nội dung cột mốc.
    const updates: Partial<
      Pick<
        WeddingStoryDocument,
        | "date"
        | "title"
        | "description"
        | "image"
        | "isVisible"
        | "updatedAt"
      >
    > = {};

    // ================================================
    // UPDATE DATE
    // ================================================

    if (body.date !== undefined) {
      try {
        updates.date = validateStoryDate(
          body.date
        );
      } catch (error) {
        return sendError(
          error instanceof Error
            ? error.message
            : "Ngày không hợp lệ.",
          400
        );
      }
    }

    // ================================================
    // UPDATE TITLE
    // ================================================

    if (body.title !== undefined) {
      try {
        updates.title = validateStoryTitle(
          body.title
        );
      } catch (error) {
        return sendError(
          error instanceof Error
            ? error.message
            : "Tiêu đề không hợp lệ.",
          400
        );
      }
    }

    // ================================================
    // UPDATE DESCRIPTION
    // ================================================

    if (body.description !== undefined) {
      try {
        updates.description =
          validateStoryDescription(
            body.description
          );
      } catch (error) {
        return sendError(
          error instanceof Error
            ? error.message
            : "Nội dung không hợp lệ.",
          400
        );
      }
    }

    // ================================================
    // UPDATE IMAGE
    // ================================================

    if (body.image !== undefined) {
      try {
        updates.image =
          validateStoryImageUrl(
            body.image
          );
      } catch (error) {
        return sendError(
          error instanceof Error
            ? error.message
            : "Đường dẫn ảnh không hợp lệ.",
          400
        );
      }
    }

    // ================================================
    // UPDATE VISIBILITY
    // ================================================

    if (body.isVisible !== undefined) {
      if (
        typeof body.isVisible !== "boolean"
      ) {
        return sendError(
          "Trạng thái hiển thị không hợp lệ.",
          400
        );
      }

      updates.isVisible =
        body.isVisible;
    }

    // ================================================
    // VALIDATE UPDATES
    // ================================================

    if (
      Object.keys(updates).length === 0
    ) {
      return sendError(
        "Không có thông tin cần cập nhật.",
        400
      );
    }

    updates.updatedAt = new Date();

    // ================================================
    // UPDATE MONGODB
    // ================================================

    const result =
      await collection.updateOne(
        {
          _id: body.id,
        },
        {
          $set: updates,
        }
      );

    if (result.matchedCount === 0) {
      return sendError(
        "Không tìm thấy cột mốc cần sửa.",
        404
      );
    }

    const updatedStory =
      await collection.findOne({
        _id: body.id,
      });

    if (!updatedStory) {
      return sendError(
        "Không tìm thấy dữ liệu sau cập nhật.",
        404
      );
    }

    return sendJson({
      success: true,
      message:
        "Đã cập nhật Love Story thành công.",
      story: serializeWeddingStory(
        updatedStory
      ),
    });
  } catch (error) {
    console.error(
      "[ADMIN STORIES PATCH]",
      error
    );

    return sendError(
      "Không thể cập nhật Love Story.",
      500
    );
  }
}

// ======================================================
// DELETE - REMOVE STORY
//
// Chỉ xóa cột mốc được chọn.
// Không xóa toàn bộ collection.
// Không thay đổi dữ liệu wedding.ts.
// Không làm ảnh hưởng cột mốc khác.
// ======================================================

export async function DELETE(
  request: NextRequest
) {
  // ================================================
  // AUTHORIZATION
  // ================================================

  const auth = await requireAdminApi(
    request,
    "stories:write"
  );

  if (auth.error) {
    return auth.error;
  }

  if (!auth.admin) {
    return sendError(
      "Vui lòng đăng nhập lại.",
      401
    );
  }

  // ================================================
  // READ JSON
  // ================================================

  let body: Record<string, unknown>;

  try {
    body = await readRequestBody(request);
  } catch (error) {
    return sendError(
      error instanceof Error
        ? error.message
        : "Dữ liệu không hợp lệ.",
      400
    );
  }

  if (!isValidStoryId(body.id)) {
    return sendError(
      "Mã cột mốc không hợp lệ.",
      400
    );
  }

  // ================================================
  // DELETE FROM MONGODB
  // ================================================

  try {
    await ensureStoriesInitialized();

    const collection =
      await getStoriesCollection();

    const story =
      await collection.findOne({
        _id: body.id,
      });

    if (!story) {
      return sendError(
        "Không tìm thấy cột mốc.",
        404
      );
    }

    const result =
      await collection.deleteOne({
        _id: story._id,
      });

    if (result.deletedCount !== 1) {
      return sendError(
        "Không thể xóa cột mốc. Vui lòng thử lại.",
        409
      );
    }

    return sendJson({
      success: true,
      message:
        "Đã xóa cột mốc Love Story thành công.",
      deletedId: story._id,
    });
  } catch (error) {
    console.error(
      "[ADMIN STORIES DELETE]",
      error
    );

    return sendError(
      "Không thể xóa cột mốc Love Story.",
      500
    );
  }
}
