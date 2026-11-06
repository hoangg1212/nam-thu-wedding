
import {
  NextRequest,
  NextResponse,
} from "next/server";

import {
  GridFSBucket,
  ObjectId,
} from "mongodb";

import { getDatabase } from "@/lib/mongodb";

import {
  requireAdminApi,
} from "@/lib/admin-auth";

import {
  createGalleryPhotoId,
  ensureGalleryInitialized,
  getGalleryCollection,
  isValidGalleryImageUrl,
  serializeGalleryPhoto,
  validateGalleryAlt,
} from "@/lib/wedding-gallery";

// ======================================================
// NAM & THU - ADMIN GALLERY API
//
// GIAI ĐOẠN 3.10 - BƯỚC 5.8
//
// GET    /api/admin/gallery
// POST   /api/admin/gallery
// PATCH  /api/admin/gallery
// DELETE /api/admin/gallery
//
// CẬP NHẬT PHÂN TRANG:
// - Mỗi trang tối đa 8 ảnh.
// - Phân trang trực tiếp tại MongoDB.
// - Trả về pagination metadata.
// - Không ảnh hưởng thống kê tổng ảnh.
// - Tương thích frontend Gallery hiện tại.
//
// CHẾ ĐỘ TƯƠNG THÍCH:
//
// GET /api/admin/gallery
// -> Trả toàn bộ ảnh như phiên bản cũ.
//
// GET /api/admin/gallery?page=1
// -> Trả 8 ảnh đầu tiên.
//
// GET /api/admin/gallery?page=2&limit=8
// -> Trả 8 ảnh tiếp theo.
//
// LÝ DO:
// Frontend hiện tại cần toàn bộ danh sách ảnh
// để gửi đầy đủ IDs khi sắp xếp lại Album.
// Nếu tự động phân trang GET, việc reorder
// sẽ bị lỗi.
//
// CHỨC NĂNG GIỮ NGUYÊN:
// - Cả 3 Admin quản lý chung một Album.
// - Thêm ảnh nội bộ.
// - Upload ảnh bằng API riêng.
// - Sửa ảnh và mô tả.
// - Ẩn / hiện ảnh.
// - Sắp xếp toàn bộ Album.
// - Xóa ảnh.
// - Dọn file GridFS khi xóa.
// - Không xóa file public/images.
// ======================================================

// ======================================================
// CONSTANTS
// ======================================================

const MAX_JSON_BYTES = 20_000;

const MAX_REORDER_ITEMS = 500;

// Phân trang 8 ảnh.
const DEFAULT_PAGE_SIZE = 8;

const MAX_PAGE_SIZE = 8;

// Giới hạn trang để tránh giá trị quá lớn.
const MAX_PAGE = 100_000;

// ======================================================
// TYPES
// ======================================================

interface GalleryPagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

// ======================================================
// RESPONSE HELPERS
// ======================================================

function send(
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

function fail(
  message: string,
  status: number
) {
  return send(
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

// Kiểm tra object hợp lệ.
function isObject(
  value: unknown
): value is Record<string, unknown> {
  return (
    value !== null &&
    typeof value === "object" &&
    !Array.isArray(value)
  );
}

// Kiểm tra ID ảnh.
function validId(
  value: unknown
): value is string {
  return (
    typeof value === "string" &&
    value.length >= 1 &&
    value.length <= 100 &&
    /^[a-zA-Z0-9_-]+$/.test(value)
  );
}

// Chuyển page / limit thành số nguyên dương.
//
// Ví dụ:
// page=2 -> 2
// page=abc -> 1
// limit=50 -> 8
// limit=-1 -> 8
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
// GRIDFS IMAGE ID
//
// Chỉ nhận URL GridFS do hệ thống tạo.
// Không xử lý URL tùy ý.
// ======================================================

function getGridFsId(
  imageUrl: string
): ObjectId | null {
  const matched = imageUrl.match(
    /^\/api\/gallery\/image\/([a-f0-9]{24})$/i
  );

  if (!matched) {
    return null;
  }

  return new ObjectId(
    matched[1]
  );
}

// ======================================================
// READ JSON
//
// Giới hạn kích thước request JSON.
// ======================================================

async function readJson(
  request: NextRequest
): Promise<Record<string, unknown>> {
  const contentType =
    request.headers.get(
      "content-type"
    ) ?? "";

  if (
    !contentType
      .toLowerCase()
      .includes("application/json")
  ) {
    throw new Error(
      "Yêu cầu phải sử dụng application/json."
    );
  }

  const text =
    await request.text();

  if (
    Buffer.byteLength(
      text,
      "utf8"
    ) > MAX_JSON_BYTES
  ) {
    throw new Error(
      "Dữ liệu gửi lên quá lớn."
    );
  }

  let parsed: unknown;

  try {
    parsed = JSON.parse(
      text
    );
  } catch {
    throw new Error(
      "JSON không hợp lệ."
    );
  }

  if (!isObject(parsed)) {
    throw new Error(
      "Dữ liệu gửi lên không hợp lệ."
    );
  }

  return parsed;
}

// ======================================================
// GET - LIST GALLERY PHOTOS
//
// HỖ TRỢ 2 CHẾ ĐỘ:
//
// 1. LEGACY MODE:
//    Không có tham số page.
//    Trả toàn bộ ảnh.
//
// 2. PAGINATED MODE:
//    Có tham số page.
//    Trả tối đa 8 ảnh / trang.
//
// Admin nhìn thấy cả ảnh ẩn.
//
// Sắp xếp:
// - sortOrder tăng dần.
// - createdAt tăng dần.
// - _id tăng dần.
//
// Giữ thứ tự nhất quán giữa các trang.
// ======================================================

export async function GET(
  request: NextRequest
) {
  try {
    // ================================================
    // AUTHORIZATION
    // ================================================

    const auth =
      await requireAdminApi(
        request,
        "gallery:read"
      );

    if (auth.error) {
      return auth.error;
    }

    if (!auth.admin) {
      return fail(
        "Chưa đăng nhập.",
        401
      );
    }

    // ================================================
    // INITIALIZE GALLERY
    // ================================================

    await ensureGalleryInitialized();

    const collection =
      await getGalleryCollection();

    // ================================================
    // READ QUERY PARAMS
    // ================================================

    const params =
      request.nextUrl.searchParams;

    // Chỉ bật phân trang khi có page.
    //
    // Điều này giúp frontend cũ tiếp tục
    // nhận toàn bộ ảnh để reorder.
    const isPaginated =
      params.has("page");

    // ================================================
    // LEGACY MODE
    //
    // GET /api/admin/gallery
    // ================================================

    if (!isPaginated) {
      const documents =
        await collection
          .find({})
          .sort({
            sortOrder: 1,
            createdAt: 1,
            _id: 1,
          })
          .toArray();

      return send({
        success: true,

        photos:
          documents.map(
            serializeGalleryPhoto
          ),

        total:
          documents.length,
      });
    }

    // ================================================
    // PAGINATION MODE
    // ================================================

    const page =
      positiveInteger(
        params.get("page"),
        1,
        MAX_PAGE
      );

    const limit =
      positiveInteger(
        params.get("limit"),
        DEFAULT_PAGE_SIZE,
        MAX_PAGE_SIZE
      );

    // Công thức phân trang:
    //
    // Trang 1: skip 0
    // Trang 2: skip 8
    // Trang 3: skip 16
    const skip =
      (page - 1) * limit;

    // ================================================
    // QUERY MONGODB
    //
    // Đếm toàn bộ ảnh bằng countDocuments().
    // Chỉ lấy đúng ảnh thuộc trang hiện tại.
    // ================================================

    const [
      documents,
      total,
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

      collection.countDocuments(
        {}
      ),
    ]);

    // ================================================
    // PAGINATION METADATA
    // ================================================

    const totalPages =
      Math.ceil(
        total / limit
      );

    const pagination:
      GalleryPagination = {
        page,
        limit,
        total,
        totalPages,
      };

    return send({
      success: true,

      photos:
        documents.map(
          serializeGalleryPhoto
        ),

      total,

      pagination,
    });
  } catch (error) {
    console.error(
      "[ADMIN GALLERY GET]",
      error
    );

    return fail(
      "Không thể tải danh sách ảnh.",
      500
    );
  }
}

// ======================================================
// POST - ADD INTERNAL IMAGE URL
//
// Giữ tương thích với chức năng cũ.
//
// Upload file trực tiếp sử dụng:
// /api/admin/gallery/upload
//
// Không thay đổi cấu trúc MongoDB.
// ======================================================

export async function POST(
  request: NextRequest
) {
  const auth =
    await requireAdminApi(
      request,
      "gallery:write"
    );

  if (auth.error) {
    return auth.error;
  }

  if (!auth.admin) {
    return fail(
      "Chưa đăng nhập.",
      401
    );
  }

  let body:
    Record<string, unknown>;

  try {
    body =
      await readJson(
        request
      );
  } catch (error) {
    return fail(
      error instanceof Error
        ? error.message
        : "Dữ liệu không hợp lệ.",
      400
    );
  }

  if (
    !isValidGalleryImageUrl(
      body.imageUrl
    )
  ) {
    return fail(
      "Đường dẫn ảnh nội bộ không hợp lệ.",
      400
    );
  }

  let alt: string;

  try {
    alt =
      validateGalleryAlt(
        body.alt ?? ""
      );
  } catch (error) {
    return fail(
      error instanceof Error
        ? error.message
        : "Mô tả ảnh không hợp lệ.",
      400
    );
  }

  try {
    await ensureGalleryInitialized();

    const collection =
      await getGalleryCollection();

    // Lấy ảnh cuối theo sortOrder
    // để thêm ảnh mới đúng thứ tự.
    const lastPhoto =
      await collection
        .find({})
        .sort({
          sortOrder: -1,
        })
        .limit(1)
        .next();

    const now =
      new Date();

    const photo = {
      _id:
        createGalleryPhotoId(),

      imageUrl:
        body.imageUrl,

      alt:
        alt ||
        "Ảnh cưới Nam và Thư",

      sortOrder:
        (
          lastPhoto?.sortOrder ??
          -1
        ) + 1,

      isVisible:
        true,

      createdBy:
        auth.admin.id,

      createdAt:
        now,

      updatedAt:
        now,
    };

    await collection.insertOne(
      photo
    );

    return send(
      {
        success: true,

        message:
          "Đã thêm ảnh vào Album.",

        photo:
          serializeGalleryPhoto(
            photo
          ),
      },
      201
    );
  } catch (error) {
    console.error(
      "[ADMIN GALLERY POST]",
      error
    );

    return fail(
      "Không thể thêm ảnh.",
      500
    );
  }
}

// ======================================================
// PATCH - UPDATE / REORDER
//
// Hỗ trợ:
//
// 1. REORDER:
//    Nhận toàn bộ IDs của Album.
//    Không chỉ nhận IDs của trang hiện tại.
//
// 2. UPDATE:
//    Sửa URL, mô tả hoặc trạng thái hiển thị.
//
// Phân trang không ảnh hưởng đến PATCH.
// ======================================================

export async function PATCH(
  request: NextRequest
) {
  const auth =
    await requireAdminApi(
      request,
      "gallery:write"
    );

  if (auth.error) {
    return auth.error;
  }

  if (!auth.admin) {
    return fail(
      "Chưa đăng nhập.",
      401
    );
  }

  let body:
    Record<string, unknown>;

  try {
    body =
      await readJson(
        request
      );
  } catch (error) {
    return fail(
      error instanceof Error
        ? error.message
        : "Dữ liệu không hợp lệ.",
      400
    );
  }

  try {
    await ensureGalleryInitialized();

    const collection =
      await getGalleryCollection();

    // ================================================
    // REORDER
    // ================================================

    if (
      body.action ===
      "reorder"
    ) {
      const ids =
        body.ids;

      if (
        !Array.isArray(
          ids
        ) ||
        ids.length >
          MAX_REORDER_ITEMS ||
        !ids.every(
          validId
        ) ||
        new Set(
          ids
        ).size !==
          ids.length
      ) {
        return fail(
          "Danh sách sắp xếp không hợp lệ.",
          400
        );
      }

      // ================================================
      // VERIFY ALL IDS
      //
      // Đọc toàn bộ ID Album vì reorder
      // ảnh có thể vượt qua ranh giới trang.
      // ================================================

      const documents =
        await collection
          .find(
            {},
            {
              projection: {
                _id: 1,
              },
            }
          )
          .toArray();

      const currentIds =
        new Set(
          documents.map(
            (photo) =>
              photo._id
          )
        );

      if (
        ids.length !==
          currentIds.size ||
        !ids.every(
          (id) =>
            currentIds.has(
              id
            )
        )
      ) {
        return fail(
          "Danh sách Album đã thay đổi. Vui lòng tải lại.",
          409
        );
      }

      if (
        ids.length === 0
      ) {
        return send({
          success: true,

          message:
            "Album hiện không có ảnh.",
        });
      }

      const now =
        new Date();

      // Cập nhật thứ tự cho toàn bộ Album.
      await collection.bulkWrite(
        ids.map(
          (id, index) => ({
            updateOne: {
              filter: {
                _id: id,
              },
              update: {
                $set: {
                  sortOrder:
                    index,

                  updatedAt:
                    now,
                },
              },
            },
          })
        )
      );

      return send({
        success: true,

        message:
          "Đã cập nhật thứ tự ảnh.",
      });
    }

    // ================================================
    // EDIT SINGLE PHOTO
    // ================================================

    if (
      !validId(
        body.id
      )
    ) {
      return fail(
        "Mã ảnh không hợp lệ.",
        400
      );
    }

    const updates:
      Record<
        string,
        unknown
      > = {};

    // ================================================
    // UPDATE IMAGE URL
    // ================================================

    if (
      body.imageUrl !==
      undefined
    ) {
      if (
        !isValidGalleryImageUrl(
          body.imageUrl
        )
      ) {
        return fail(
          "Đường dẫn ảnh không hợp lệ.",
          400
        );
      }

      updates.imageUrl =
        body.imageUrl;
    }

    // ================================================
    // UPDATE DESCRIPTION
    // ================================================

    if (
      body.alt !==
      undefined
    ) {
      try {
        updates.alt =
          validateGalleryAlt(
            body.alt
          );
      } catch (error) {
        return fail(
          error instanceof Error
            ? error.message
            : "Mô tả ảnh không hợp lệ.",
          400
        );
      }
    }

    // ================================================
    // UPDATE VISIBILITY
    // ================================================

    if (
      body.isVisible !==
      undefined
    ) {
      if (
        typeof body.isVisible !==
        "boolean"
      ) {
        return fail(
          "Trạng thái hiển thị không hợp lệ.",
          400
        );
      }

      updates.isVisible =
        body.isVisible;
    }

    if (
      Object.keys(
        updates
      ).length === 0
    ) {
      return fail(
        "Không có nội dung cần cập nhật.",
        400
      );
    }

    updates.updatedAt =
      new Date();

    const result =
      await collection.updateOne(
        {
          _id:
            body.id,
        },
        {
          $set:
            updates,
        }
      );

    if (
      result.matchedCount ===
      0
    ) {
      return fail(
        "Không tìm thấy ảnh.",
        404
      );
    }

    const updated =
      await collection.findOne({
        _id:
          body.id,
      });

    if (!updated) {
      return fail(
        "Không tìm thấy ảnh sau cập nhật.",
        404
      );
    }

    return send({
      success: true,

      message:
        "Đã cập nhật ảnh.",

      photo:
        serializeGalleryPhoto(
          updated
        ),
    });
  } catch (error) {
    console.error(
      "[ADMIN GALLERY PATCH]",
      error
    );

    return fail(
      "Không thể cập nhật Album.",
      500
    );
  }
}

// ======================================================
// DELETE - DELETE PHOTO AND GRIDFS FILE
//
// Thứ tự:
// 1. Kiểm tra quyền.
// 2. Xác định ảnh.
// 3. Xóa bản ghi Album.
// 4. Dọn file GridFS nếu không còn sử dụng.
//
// Không xóa file public/images.
//
// Phân trang không ảnh hưởng đến DELETE.
// ======================================================

export async function DELETE(
  request: NextRequest
) {
  const auth =
    await requireAdminApi(
      request,
      "gallery:write"
    );

  if (auth.error) {
    return auth.error;
  }

  if (!auth.admin) {
    return fail(
      "Chưa đăng nhập.",
      401
    );
  }

  let body:
    Record<string, unknown>;

  try {
    body =
      await readJson(
        request
      );
  } catch (error) {
    return fail(
      error instanceof Error
        ? error.message
        : "Dữ liệu không hợp lệ.",
      400
    );
  }

  if (
    !validId(
      body.id
    )
  ) {
    return fail(
      "Mã ảnh không hợp lệ.",
      400
    );
  }

  try {
    await ensureGalleryInitialized();

    const collection =
      await getGalleryCollection();

    // ================================================
    // GET CURRENT PHOTO
    // ================================================

    const photo =
      await collection.findOne({
        _id:
          body.id,
      });

    if (!photo) {
      return fail(
        "Không tìm thấy ảnh.",
        404
      );
    }

    // Xóa đúng bản ghi và đúng URL.
    // Nếu ảnh đã bị thay thế,
    // không xóa nhầm dữ liệu mới.
    const result =
      await collection.deleteOne({
        _id:
          photo._id,

        imageUrl:
          photo.imageUrl,
      });

    if (
      result.deletedCount !==
      1
    ) {
      return fail(
        "Ảnh đã thay đổi. Vui lòng tải lại Album.",
        409
      );
    }

    // ================================================
    // CLEANUP GRIDFS FILE
    // ================================================

    const gridFsId =
      getGridFsId(
        photo.imageUrl
      );

    if (gridFsId) {
      try {
        // Không xóa file nếu ảnh khác
        // vẫn sử dụng cùng một URL.
        const remaining =
          await collection.countDocuments({
            imageUrl:
              photo.imageUrl,
          });

        if (
          remaining === 0
        ) {
          const database =
            await getDatabase();

          const bucket =
            new GridFSBucket(
              database,
              {
                bucketName:
                  "gallery_uploads",
              }
            );

          await bucket.delete(
            gridFsId
          );
        }
      } catch (
        cleanupError
      ) {
        // Xóa bản ghi đã hoàn tất.
        // Không trả lỗi xóa ảnh nếu
        // chỉ có bước dọn GridFS thất bại.
        console.error(
          "[GALLERY GRIDFS CLEANUP]",
          {
            photoId:
              photo._id,

            imageUrl:
              photo.imageUrl,

            error:
              cleanupError,
          }
        );
      }
    }

    return send({
      success: true,

      message:
        "Đã xóa ảnh khỏi Album.",
    });
  } catch (error) {
    console.error(
      "[ADMIN GALLERY DELETE]",
      error
    );

    return fail(
      "Không thể xóa ảnh.",
      500
    );
  }
}
