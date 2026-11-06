
import {
  NextRequest,
  NextResponse,
} from "next/server";

import {
  ObjectId,
  type Filter,
} from "mongodb";

import {
  requireAdminApi,
  type CurrentAdmin,
} from "@/lib/admin-auth";

import {
  getDatabase,
} from "@/lib/mongodb";

import {
  getWeddingWishesCollection,
  isWeddingWishSide,
  isWeddingWishStatus,
  serializeWeddingWish,
  type WeddingWish,
  type WeddingWishSide,
  type WeddingWishStatus,
} from "@/lib/wedding-wishes";

// ======================================================
// NAM & THU - ADMIN WISHES API
//
// GIAI ĐOẠN 3.10 - BƯỚC 5.6
//
// GET    /api/admin/wishes
// PATCH  /api/admin/wishes
// DELETE /api/admin/wishes
//
// PHÂN TRANG:
// - Mặc định 10 lời chúc / trang.
// - Tối đa 10 lời chúc / trang.
// - Phân trang trực tiếp tại MongoDB.
// - Tự điều chỉnh nếu trang vượt giới hạn.
// - Giữ nguyên pagination response.
//
// GIỮ NGUYÊN:
// - Tìm kiếm tên khách và nội dung.
// - Lọc Nhà trai / Nhà gái.
// - Lọc trạng thái kiểm duyệt.
// - Thống kê toàn bộ dữ liệu theo quyền.
// - Duyệt, ẩn, chuyển về chờ duyệt.
// - Xóa mềm.
// - Không chỉnh sửa RSVP.
// - Phân quyền phía server.
// ======================================================

// ======================================================
// CONSTANTS
// ======================================================

const DEFAULT_PAGE = 1;

// Mỗi trang tối đa 10 lời chúc.
const DEFAULT_LIMIT = 10;
const MAX_LIMIT = 10;

// Giới hạn giá trị page nhận từ URL.
const MAX_PAGE = 1_000_000;

const MAX_SEARCH_LENGTH = 100;
const MAX_BODY_LENGTH = 2048;

// ======================================================
// RESPONSE HELPERS
// ======================================================

function respond(
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
  status = 400
) {
  return respond(
    {
      success: false,
      message,
    },
    status
  );
}

// ======================================================
// HELPER - PAGINATION
//
// Ví dụ:
// page=2    -> 2
// page=abc  -> 1
// page=-1   -> 1
// limit=100 -> 10
// limit=20  -> 10
// limit=10  -> 10
// ======================================================

function parsePositiveInteger(
  raw: string | null,
  fallback: number,
  max: number
): number {
  if (
    raw === null ||
    !/^\d+$/.test(raw)
  ) {
    return fallback;
  }

  const value = Number(raw);

  if (
    !Number.isSafeInteger(value) ||
    value < 1
  ) {
    return fallback;
  }

  return Math.min(value, max);
}

// ======================================================
// HELPER - SAFE SEARCH
//
// Escape ký tự regex để nội dung tìm kiếm
// được hiểu như văn bản thông thường.
// ======================================================

function escapeRegex(
  value: string
): string {
  return value.replace(
    /[.*+?^${}()|[\]\\]/g,
    "\\$&"
  );
}

// ======================================================
// HELPER - ADMIN SCOPE
//
// Super Admin:
// - Xem và quản lý cả hai bên.
//
// Groom Admin:
// - Chỉ guestSide = groom.
//
// Bride Admin:
// - Chỉ guestSide = bride.
//
// Không tin tham số side từ frontend.
// ======================================================

function getAdminScope(
  admin: CurrentAdmin,
  requestedSide?: WeddingWishSide | null
): Filter<WeddingWish> {
  if (admin.role === "super_admin") {
    return requestedSide
      ? {
          guestSide: requestedSide,
        }
      : {};
  }

  if (
    admin.role === "groom_admin" &&
    admin.side === "groom"
  ) {
    return {
      guestSide: "groom",
    };
  }

  if (
    admin.role === "bride_admin" &&
    admin.side === "bride"
  ) {
    return {
      guestSide: "bride",
    };
  }

  // Không mở quyền nếu role / side
  // của tài khoản không nhất quán.
  throw new Error(
    "INVALID_ADMIN_SIDE"
  );
}

// ======================================================
// HELPER - READ JSON
//
// Giữ giới hạn dung lượng request JSON.
// ======================================================

async function readJsonBody(
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
      "INVALID_CONTENT_TYPE"
    );
  }

  const raw = await request.text();

  if (
    Buffer.byteLength(raw, "utf8") >
    MAX_BODY_LENGTH
  ) {
    throw new Error(
      "BODY_TOO_LARGE"
    );
  }

  let data: unknown;

  try {
    data = JSON.parse(raw);
  } catch {
    throw new Error(
      "INVALID_JSON"
    );
  }

  if (
    !data ||
    typeof data !== "object" ||
    Array.isArray(data)
  ) {
    throw new Error(
      "INVALID_JSON"
    );
  }

  return data as Record<
    string,
    unknown
  >;
}

// ======================================================
// HELPER - MONGODB OBJECT ID
// ======================================================

function parseId(
  value: unknown
): ObjectId | null {
  if (
    typeof value !== "string" ||
    !/^[a-f0-9]{24}$/i.test(value)
  ) {
    return null;
  }

  return new ObjectId(value);
}

// ======================================================
// HELPER - STATISTICS
//
// Thống kê toàn bộ lời chúc trong phạm vi
// quản lý của Admin.
//
// Không giới hạn ở 10 bản ghi của trang.
//
// Bộ lọc trạng thái và từ khóa tìm kiếm
// chỉ áp dụng cho danh sách.
// ======================================================

async function getStatistics(
  collection: ReturnType<
    typeof getWeddingWishesCollection
  >,
  scope: Filter<WeddingWish>
) {
  const baseFilter: Filter<WeddingWish> = {
    ...scope,
    isDeleted: false,
  };

  const [
    total,
    pending,
    approved,
    hidden,
  ] = await Promise.all([
    collection.countDocuments(baseFilter),

    collection.countDocuments({
      ...baseFilter,
      status: "pending",
    }),

    collection.countDocuments({
      ...baseFilter,
      status: "approved",
    }),

    collection.countDocuments({
      ...baseFilter,
      status: "hidden",
    }),
  ]);

  return {
    total,
    pending,
    approved,
    hidden,
  };
}

// ======================================================
// GET - LIST WISHES
//
// Query:
// page
// limit
// search
// side
// status
//
// CẬP NHẬT:
// - Mặc định 10 lời chúc.
// - Tối đa 10 lời chúc.
// - Tổng số trang theo bộ lọc.
// - Tự điều chỉnh trang vượt giới hạn.
// ======================================================

export async function GET(
  request: NextRequest
) {
  try {
    // ================================================
    // 1. AUTHORIZATION
    // ================================================

    const {
      admin,
      error,
    } = await requireAdminApi(
      request,
      "wishes:read"
    );

    if (error) {
      return error;
    }

    if (!admin) {
      return fail(
        "Bạn chưa đăng nhập.",
        401
      );
    }

    // ================================================
    // 2. PAGINATION
    // ================================================

    const params =
      request.nextUrl.searchParams;

    const page = parsePositiveInteger(
      params.get("page"),
      DEFAULT_PAGE,
      MAX_PAGE
    );

    const limit = parsePositiveInteger(
      params.get("limit"),
      DEFAULT_LIMIT,
      MAX_LIMIT
    );

    // ================================================
    // 3. SEARCH
    // ================================================

    const rawSearch =
      params.get("search") ?? "";

    const search =
      rawSearch.trim();

    if (
      search.length >
      MAX_SEARCH_LENGTH
    ) {
      return fail(
        "Từ khóa tìm kiếm quá dài.",
        400
      );
    }

    // ================================================
    // 4. SIDE FILTER
    // ================================================

    const sideParam =
      params.get("side") ?? "all";

    let requestedSide:
      WeddingWishSide | null = null;

    if (sideParam !== "all") {
      if (
        !isWeddingWishSide(
          sideParam
        )
      ) {
        return fail(
          "Bên mời không hợp lệ.",
          400
        );
      }

      requestedSide = sideParam;
    }

    // Từ chối nếu yêu cầu xem
    // dữ liệu vượt quyền.
    if (
      requestedSide &&
      admin.role !== "super_admin" &&
      requestedSide !== admin.side
    ) {
      return fail(
        "Bạn không có quyền xem lời chúc của bên này.",
        403
      );
    }

    // ================================================
    // 5. STATUS FILTER
    // ================================================

    const statusParam =
      params.get("status") ?? "all";

    let requestedStatus:
      WeddingWishStatus | null = null;

    if (statusParam !== "all") {
      if (
        !isWeddingWishStatus(
          statusParam
        )
      ) {
        return fail(
          "Trạng thái kiểm duyệt không hợp lệ.",
          400
        );
      }

      requestedStatus =
        statusParam;
    }

    // ================================================
    // 6. DATABASE FILTER
    // ================================================

    const scope = getAdminScope(
      admin,
      requestedSide
    );

    const filter: Filter<WeddingWish> = {
      ...scope,
      isDeleted: false,
    };

    if (requestedStatus) {
      filter.status =
        requestedStatus;
    }

    if (search) {
      const regex =
        escapeRegex(search);

      filter.$or = [
        {
          guestName: {
            $regex: regex,
            $options: "i",
          },
        },
        {
          message: {
            $regex: regex,
            $options: "i",
          },
        },
        {
          relation: {
            $regex: regex,
            $options: "i",
          },
        },
      ];
    }

    // ================================================
    // 7. DATABASE CONNECTION
    // ================================================

    const database =
      await getDatabase();

    const collection =
      getWeddingWishesCollection(
        database
      );

    // ================================================
    // 8. COUNT & STATISTICS
    //
    // Không giới hạn theo trang hiện tại.
    // ================================================

    const [
      total,
      statistics,
    ] = await Promise.all([
      collection.countDocuments(
        filter
      ),

      getStatistics(
        collection,
        scope
      ),
    ]);

    // ================================================
    // 9. PAGINATION METADATA
    // ================================================

    const totalPages =
      Math.ceil(
        total / limit
      );

    // Trường hợp:
    //
    // Đang trang 4, xóa bớt dữ liệu
    // khiến chỉ còn 3 trang.
    //
    // API tự đưa về trang 3.
    //
    // Nếu không có lời chúc -> trang 1.
    const effectivePage =
      totalPages === 0
        ? 1
        : Math.min(
            page,
            totalPages
          );

    const skip =
      (effectivePage - 1) * limit;

    // ================================================
    // 10. GET CURRENT PAGE
    // ================================================

    const wishes =
      await collection
        .find(filter)
        .sort({
          createdAt: -1,
          _id: -1,
        })
        .skip(skip)
        .limit(limit)
        .toArray();

    // ================================================
    // 11. RESPONSE
    //
    // Giữ cấu trúc JSON cũ.
    // ================================================

    return respond({
      success: true,

      wishes: wishes.map(
        serializeWeddingWish
      ),

      pagination: {
        page: effectivePage,
        limit,
        total,
        totalPages,
      },

      statistics,
    });
  } catch (error) {
    console.error(
      "[ADMIN WISHES GET]",
      error
    );

    return fail(
      "Không thể tải danh sách lời chúc.",
      503
    );
  }
}

// ======================================================
// PATCH - UPDATE MODERATION STATUS
//
// Body:
// {
//   "id": "mongodb_object_id",
//   "status": "approved"
// }
//
// Hỗ trợ:
// - pending
// - approved
// - hidden
//
// Không thay đổi RSVP của khách.
// ======================================================

export async function PATCH(
  request: NextRequest
) {
  try {
    // ================================================
    // 1. AUTHORIZATION
    // ================================================

    const {
      admin,
      error,
    } = await requireAdminApi(
      request,
      "wishes:write"
    );

    if (error) {
      return error;
    }

    if (!admin) {
      return fail(
        "Bạn chưa đăng nhập.",
        401
      );
    }

    // ================================================
    // 2. READ BODY
    // ================================================

    const body =
      await readJsonBody(
        request
      );

    const id = parseId(
      body.id
    );

    if (!id) {
      return fail(
        "Mã lời chúc không hợp lệ.",
        400
      );
    }

    if (
      !isWeddingWishStatus(
        body.status
      )
    ) {
      return fail(
        "Trạng thái kiểm duyệt không hợp lệ.",
        400
      );
    }

    const nextStatus =
      body.status;

    // ================================================
    // 3. DATABASE
    // ================================================

    const database =
      await getDatabase();

    const collection =
      getWeddingWishesCollection(
        database
      );

    const scope =
      getAdminScope(admin);

    const filter: Filter<WeddingWish> = {
      ...scope,
      _id: id,
      isDeleted: false,
    };

    const now = new Date();

    // ================================================
    // 4. UPDATE
    // ================================================

    const result =
      await collection.findOneAndUpdate(
        filter,
        {
          $set: {
            status: nextStatus,

            reviewedAt:
              nextStatus === "pending"
                ? null
                : now,

            reviewedBy:
              nextStatus === "pending"
                ? null
                : new ObjectId(
                    admin.id
                  ),

            updatedAt: now,
          },
        },
        {
          returnDocument: "after",
        }
      );

    if (!result) {
      return fail(
        "Không tìm thấy lời chúc hoặc bạn không có quyền cập nhật.",
        404
      );
    }

    // ================================================
    // 5. RESPONSE
    // ================================================

    const actionLabel =
      nextStatus === "approved"
        ? "Đã duyệt lời chúc."
        : nextStatus === "hidden"
          ? "Đã ẩn lời chúc."
          : "Đã chuyển lời chúc về chờ duyệt.";

    return respond({
      success: true,
      message: actionLabel,

      wish: serializeWeddingWish(
        result
      ),
    });
  } catch (error) {
    if (error instanceof Error) {
      if (
        error.message ===
        "INVALID_CONTENT_TYPE"
      ) {
        return fail(
          "Yêu cầu phải sử dụng JSON.",
          415
        );
      }

      if (
        error.message ===
        "BODY_TOO_LARGE"
      ) {
        return fail(
          "Nội dung gửi lên quá lớn.",
          413
        );
      }

      if (
        error.message ===
        "INVALID_JSON"
      ) {
        return fail(
          "Dữ liệu JSON không hợp lệ.",
          400
        );
      }
    }

    console.error(
      "[ADMIN WISHES PATCH]",
      error
    );

    return fail(
      "Không thể cập nhật lời chúc.",
      503
    );
  }
}

// ======================================================
// DELETE - SOFT DELETE WISH
//
// Body:
// {
//   "id": "mongodb_object_id"
// }
//
// Không xóa vĩnh viễn MongoDB.
//
// Không xóa khách mời.
// Không thay đổi RSVP.
// ======================================================

export async function DELETE(
  request: NextRequest
) {
  try {
    // ================================================
    // 1. AUTHORIZATION
    // ================================================

    const {
      admin,
      error,
    } = await requireAdminApi(
      request,
      "wishes:write"
    );

    if (error) {
      return error;
    }

    if (!admin) {
      return fail(
        "Bạn chưa đăng nhập.",
        401
      );
    }

    // ================================================
    // 2. READ BODY
    // ================================================

    const body =
      await readJsonBody(
        request
      );

    const id = parseId(
      body.id
    );

    if (!id) {
      return fail(
        "Mã lời chúc không hợp lệ.",
        400
      );
    }

    // ================================================
    // 3. DATABASE
    // ================================================

    const database =
      await getDatabase();

    const collection =
      getWeddingWishesCollection(
        database
      );

    const scope =
      getAdminScope(admin);

    const now =
      new Date();

    // ================================================
    // 4. SOFT DELETE
    //
    // Chỉ thao tác trong phạm vi được phép.
    // ================================================

    const result =
      await collection.updateOne(
        {
          ...scope,
          _id: id,
          isDeleted: false,
        },
        {
          $set: {
            isDeleted: true,
            deletedAt: now,
            updatedAt: now,
          },
        }
      );

    if (
      result.matchedCount !== 1
    ) {
      return fail(
        "Không tìm thấy lời chúc hoặc bạn không có quyền xóa.",
        404
      );
    }

    // ================================================
    // 5. RESPONSE
    // ================================================

    return respond({
      success: true,

      message:
        "Đã xóa lời chúc khỏi danh sách quản lý.",
    });
  } catch (error) {
    if (error instanceof Error) {
      if (
        error.message ===
        "INVALID_CONTENT_TYPE"
      ) {
        return fail(
          "Yêu cầu phải sử dụng JSON.",
          415
        );
      }

      if (
        error.message ===
        "BODY_TOO_LARGE"
      ) {
        return fail(
          "Nội dung gửi lên quá lớn.",
          413
        );
      }

      if (
        error.message ===
        "INVALID_JSON"
      ) {
        return fail(
          "Dữ liệu JSON không hợp lệ.",
          400
        );
      }
    }

    console.error(
      "[ADMIN WISHES DELETE]",
      error
    );

    return fail(
      "Không thể xóa lời chúc.",
      503
    );
  }
}
