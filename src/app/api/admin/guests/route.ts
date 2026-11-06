
import { NextRequest, NextResponse } from "next/server";

import {
  ObjectId,
  type Filter,
} from "mongodb";

import {
  requireAdminApi,
  canAccessWeddingSide,
  getAdminSide,
  type WeddingSide,
  type CurrentAdmin,
} from "@/lib/admin-auth";

import {
  createWeddingGuest,
  ensureGuestIndexes,
  getGuestCollection,
  serializeGuest,
  type WeddingGuest,
} from "@/lib/wedding-guests";

// ======================================================
// NAM & THU - ADMIN GUESTS API
// GIAI ĐOẠN 3.10 - BƯỚC 5.4
//
// GET    /api/admin/guests
// POST   /api/admin/guests
// PATCH  /api/admin/guests
// DELETE /api/admin/guests
//
// CẬP NHẬT:
// - Mặc định 10 khách / trang.
// - Tối đa 10 khách / trang.
// - Phân trang tại MongoDB.
// - Tìm kiếm và lọc trước khi phân trang.
// - Thống kê không phụ thuộc trang hiện tại.
//
// GIỮ NGUYÊN:
// - Phân quyền theo Nhà trai / Nhà gái.
// - Thêm khách.
// - Sửa tên, điện thoại, ghi chú.
// - Xóa mềm.
// - Token thiệp cũ.
// - Trạng thái gửi thiệp.
// - Trạng thái RSVP.
// - Lời nhắn và ngày phản hồi.
// - MongoDB indexes hiện tại.
//
// Không chỉnh sửa dữ liệu thiệp hoặc RSVP
// thông qua API quản lý khách mời.
// ======================================================

// ======================================================
// CONFIG
// ======================================================

const MAX_BODY_BYTES = 16 * 1024;

// Chuẩn hóa số lượng bản ghi mỗi trang.
const DEFAULT_PAGE_SIZE = 10;
const MAX_PAGE_SIZE = 10;

const MAX_PAGE = 100000;

const MAX_NAME_LENGTH = 120;
const MAX_PHONE_LENGTH = 30;
const MAX_NOTE_LENGTH = 1000;
const MAX_SEARCH_LENGTH = 100;

// ======================================================
// TYPES
// ======================================================

interface CreateGuestBody {
  fullName?: unknown;
  phone?: unknown;
  note?: unknown;
  side?: unknown;
}

interface UpdateGuestBody {
  id?: unknown;
  fullName?: unknown;
  phone?: unknown;
  note?: unknown;
  side?: unknown;
}

interface DeleteGuestBody {
  id?: unknown;
}

interface GuestStatistics {
  total: number;
  notSent: number;
  sent: number;
  attending: number;
  declined: number;
  unsure: number;
  noResponse: number;
}

interface GuestPagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

// ======================================================
// JSON RESPONSES
// ======================================================

function json(
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
  return json(
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

function isWeddingSide(
  value: unknown
): value is WeddingSide {
  return (
    value === "groom" ||
    value === "bride"
  );
}

function isValidObjectId(
  value: unknown
): value is string {
  return (
    typeof value === "string" &&
    /^[a-f0-9]{24}$/i.test(value) &&
    ObjectId.isValid(value)
  );
}

// Kiểm tra nội dung văn bản.
// Hỗ trợ tiếng Việt, Unicode và emoji.
function validateText(
  value: unknown,
  label: string,
  maxLength: number,
  required = false
): string {
  if (typeof value !== "string") {
    throw new Error(
      `${label} không hợp lệ.`
    );
  }

  const normalized = value.trim();

  if (
    required &&
    normalized.length === 0
  ) {
    throw new Error(
      `${label} không được để trống.`
    );
  }

  if (
    Array.from(normalized).length >
    maxLength
  ) {
    throw new Error(
      `${label} không được vượt quá ${maxLength} ký tự.`
    );
  }

  // Chặn ký tự điều khiển không hợp lệ.
  if (
    /[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/.test(
      normalized
    )
  ) {
    throw new Error(
      `${label} chứa ký tự không hợp lệ.`
    );
  }

  return normalized;
}

function validatePhone(
  value: unknown
): string {
  const phone = validateText(
    value,
    "Số điện thoại",
    MAX_PHONE_LENGTH
  );

  if (
    phone &&
    !/^[0-9+\-().\s]{5,30}$/.test(phone)
  ) {
    throw new Error(
      "Số điện thoại không đúng định dạng."
    );
  }

  return phone;
}

// ======================================================
// READ JSON WITH BODY SIZE LIMIT
//
// Giữ cơ chế giới hạn kích thước request.
// Không chỉ phụ thuộc Content-Length.
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
      "Yêu cầu phải gửi dữ liệu JSON."
    );
  }

  const contentLengthHeader =
    request.headers.get("content-length");

  if (contentLengthHeader !== null) {
    const length = Number(
      contentLengthHeader
    );

    if (
      !Number.isFinite(length) ||
      length < 0 ||
      length > MAX_BODY_BYTES
    ) {
      throw new Error(
        "Dung lượng dữ liệu không hợp lệ."
      );
    }
  }

  if (!request.body) {
    throw new Error(
      "Nội dung yêu cầu không được để trống."
    );
  }

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];

  let totalBytes = 0;

  try {
    while (true) {
      const { done, value } =
        await reader.read();

      if (done) {
        break;
      }

      totalBytes += value.byteLength;

      if (totalBytes > MAX_BODY_BYTES) {
        await reader.cancel();

        throw new Error(
          "Dữ liệu gửi lên quá lớn."
        );
      }

      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }

  const raw = Buffer.concat(
    chunks.map((chunk) =>
      Buffer.from(chunk)
    )
  ).toString("utf8");

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

  if (
    !parsed ||
    typeof parsed !== "object" ||
    Array.isArray(parsed)
  ) {
    throw new Error(
      "Nội dung yêu cầu phải là JSON object."
    );
  }

  return parsed as Record<string, unknown>;
}

// ======================================================
// PERMISSIONS
//
// Super Admin: Cả hai bên.
// Groom Admin: Chỉ Nhà trai.
// Bride Admin: Chỉ Nhà gái.
//
// Phân quyền thực hiện tại backend.
// ======================================================

function getScopedFilter(
  admin: CurrentAdmin,
  requestedSide?: WeddingSide
): Filter<WeddingGuest> {
  const filter: Filter<WeddingGuest> = {
    isDeleted: false,
  };

  if (admin.role === "super_admin") {
    if (requestedSide) {
      filter.side = requestedSide;
    }

    return filter;
  }

  const assignedSide = getAdminSide(
    admin.role
  );

  if (!assignedSide) {
    throw new Error(
      "Không xác định được bên quản lý."
    );
  }

  filter.side = assignedSide;

  return filter;
}

function canWriteSide(
  admin: CurrentAdmin,
  side: WeddingSide
): boolean {
  return canAccessWeddingSide(
    admin.role,
    side
  );
}

// ======================================================
// PAGINATION HELPERS
// ======================================================

// Chỉ chấp nhận số nguyên dương.
//
// page=abc -> 1
// page=-5  -> 1
// page=2   -> 2
//
// limit=100 -> 10
// limit=20  -> 10
// limit=10  -> 10
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

  return Math.min(parsed, maximum);
}

// ======================================================
// SEARCH HELPER
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
// PREVENT CROSS-MODULE UPDATES
//
// Không cho API Khách mời chỉnh sửa
// trực tiếp thiệp mời hoặc RSVP.
// ======================================================

const FORBIDDEN_GUEST_UPDATE_FIELDS = [
  "invitationToken",
  "deliveryStatus",
  "sentAt",
  "rsvpStatus",
  "rsvpMessage",
  "respondedAt",
  "createdBy",
  "updatedBy",
  "createdAt",
  "updatedAt",
  "isDeleted",
  "deletedAt",
  "_id",
];

function containsForbiddenFields(
  body: Record<string, unknown>
): boolean {
  return FORBIDDEN_GUEST_UPDATE_FIELDS.some(
    (field) =>
      Object.prototype.hasOwnProperty.call(
        body,
        field
      )
  );
}

function hasOnlyAllowedKeys(
  body: Record<string, unknown>,
  allowedKeys: string[]
): boolean {
  return Object.keys(body).every(
    (key) => allowedKeys.includes(key)
  );
}

// ======================================================
// MONGODB DUPLICATE KEY
// ======================================================

interface DuplicateKeyError {
  code?: unknown;
  keyPattern?: unknown;
  index?: unknown;
}

function isInvitationTokenDuplicate(
  error: unknown
): boolean {
  if (
    !error ||
    typeof error !== "object"
  ) {
    return false;
  }

  const mongoError =
    error as DuplicateKeyError;

  if (mongoError.code !== 11000) {
    return false;
  }

  const keyPattern =
    mongoError.keyPattern;

  const tokenInPattern =
    typeof keyPattern === "object" &&
    keyPattern !== null &&
    "invitationToken" in keyPattern;

  return (
    tokenInPattern ||
    mongoError.index ===
      "unique_guest_invitation_token"
  );
}

// ======================================================
// GET - LIST GUESTS
//
// Query:
// - page
// - limit
// - search
// - side
//
// CẬP NHẬT:
// - Mặc định 10 khách / trang.
// - Tối đa 10 khách / trang.
// - MongoDB phân trang bằng skip / limit.
// - Thống kê không giới hạn bởi phân trang.
//
// Giữ nguyên response tương thích frontend.
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
      "guests:read"
    );

    if (auth.error) {
      return auth.error;
    }

    const admin = auth.admin;

    if (!admin) {
      return fail(
        "Bạn chưa đăng nhập.",
        401
      );
    }

    // ================================================
    // PAGINATION
    // ================================================

    const params =
      request.nextUrl.searchParams;

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

    // Trang 1 -> skip 0
    // Trang 2 -> skip 10
    // Trang 3 -> skip 20
    const skip = (page - 1) * limit;

    // ================================================
    // FILTER SIDE
    // ================================================

    const rawSide = params.get("side");

    if (
      rawSide &&
      rawSide !== "all" &&
      !isWeddingSide(rawSide)
    ) {
      return fail(
        "Bên khách mời không hợp lệ.",
        400
      );
    }

    const requestedSide = isWeddingSide(
      rawSide
    )
      ? rawSide
      : undefined;

    if (
      requestedSide &&
      !canAccessWeddingSide(
        admin.role,
        requestedSide
      )
    ) {
      return fail(
        "Bạn không có quyền xem khách của bên này.",
        403
      );
    }

    const baseFilter = getScopedFilter(
      admin,
      requestedSide
    );

    const filter: Filter<WeddingGuest> = {
      ...baseFilter,
    };

    // ================================================
    // SEARCH
    // ================================================

    const search = (
      params.get("search") ?? ""
    ).trim();

    if (
      Array.from(search).length >
      MAX_SEARCH_LENGTH
    ) {
      return fail(
        "Từ khóa tìm kiếm quá dài.",
        400
      );
    }

    if (search) {
      const safeSearch =
        escapeRegex(search);

      filter.$or = [
        {
          fullName: {
            $regex: safeSearch,
            $options: "i",
          },
        },
        {
          phone: {
            $regex: safeSearch,
            $options: "i",
          },
        },
      ];
    }

    // ================================================
    // DATABASE
    // ================================================

    const collection =
      await getGuestCollection();

    // Lấy danh sách đã phân trang,
    // tổng kết quả bộ lọc và thống kê
    // toàn bộ phạm vi quản lý.
    const [
      guests,
      total,
      statistics,
    ] = await Promise.all([
      collection
        .find(filter)
        .sort({
          createdAt: -1,
          _id: -1,
        })
        .skip(skip)
        .limit(limit)
        .toArray(),

      collection.countDocuments(filter),

      collection.aggregate<
        GuestStatistics & {
          _id: null;
        }
      >([
        {
          $match: baseFilter,
        },
        {
          $group: {
            _id: null,

            total: {
              $sum: 1,
            },

            notSent: {
              $sum: {
                $cond: [
                  {
                    $eq: [
                      "$deliveryStatus",
                      "not_sent",
                    ],
                  },
                  1,
                  0,
                ],
              },
            },

            sent: {
              $sum: {
                $cond: [
                  {
                    $eq: [
                      "$deliveryStatus",
                      "sent",
                    ],
                  },
                  1,
                  0,
                ],
              },
            },

            attending: {
              $sum: {
                $cond: [
                  {
                    $eq: [
                      "$rsvpStatus",
                      "attending",
                    ],
                  },
                  1,
                  0,
                ],
              },
            },

            declined: {
              $sum: {
                $cond: [
                  {
                    $eq: [
                      "$rsvpStatus",
                      "declined",
                    ],
                  },
                  1,
                  0,
                ],
              },
            },

            unsure: {
              $sum: {
                $cond: [
                  {
                    $eq: [
                      "$rsvpStatus",
                      "unsure",
                    ],
                  },
                  1,
                  0,
                ],
              },
            },

            noResponse: {
              $sum: {
                $cond: [
                  {
                    $eq: [
                      "$rsvpStatus",
                      "no_response",
                    ],
                  },
                  1,
                  0,
                ],
              },
            },
          },
        },
      ]).toArray(),
    ]);

    // ================================================
    // STATISTICS
    // ================================================

    const stats: GuestStatistics =
      statistics[0] ?? {
        total: 0,
        notSent: 0,
        sent: 0,
        attending: 0,
        declined: 0,
        unsure: 0,
        noResponse: 0,
      };

    // ================================================
    // PAGINATION METADATA
    // ================================================

    const pagination: GuestPagination = {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    };

    // ================================================
    // RESPONSE
    // ================================================

    return json({
      success: true,

      guests: guests.map(serializeGuest),

      pagination,

      statistics: stats,
    });
  } catch (error) {
    console.error(
      "[ADMIN GUESTS GET]",
      error
    );

    return fail(
      "Không thể tải danh sách khách mời.",
      500
    );
  }
}

// ======================================================
// POST - CREATE GUEST
//
// Tạo khách mời mới.
// Không tự động tạo thiệp mời mới.
// Giữ nguyên token tương thích hệ thống cũ.
// ======================================================

export async function POST(
  request: NextRequest
) {
  try {
    const auth = await requireAdminApi(
      request,
      "guests:write"
    );

    if (auth.error) {
      return auth.error;
    }

    const admin = auth.admin;

    if (!admin) {
      return fail(
        "Bạn chưa đăng nhập.",
        401
      );
    }

    // ================================================
    // READ BODY
    // ================================================

    let body: CreateGuestBody;

    try {
      body =
        await readJsonBody(request);
    } catch (error) {
      return fail(
        error instanceof Error
          ? error.message
          : "Dữ liệu không hợp lệ.",
        400
      );
    }

    if (
      !hasOnlyAllowedKeys(
        body as Record<string, unknown>,
        ["fullName", "phone", "note", "side"]
      )
    ) {
      return fail(
        "Yêu cầu chứa trường dữ liệu không được phép.",
        400
      );
    }

    // ================================================
    // DETERMINE SIDE
    // ================================================

    let side: WeddingSide;

    if (admin.role === "super_admin") {
      if (!isWeddingSide(body.side)) {
        return fail(
          "Super Admin phải chọn Nhà trai hoặc Nhà gái.",
          400
        );
      }

      side = body.side;
    } else {
      const assignedSide = getAdminSide(
        admin.role
      );

      if (!assignedSide) {
        return fail(
          "Tài khoản không có bên quản lý hợp lệ.",
          403
        );
      }

      if (
        body.side !== undefined &&
        body.side !== assignedSide
      ) {
        return fail(
          "Bạn không được thêm khách cho bên còn lại.",
          403
        );
      }

      side = assignedSide;
    }

    if (
      !canWriteSide(
        admin,
        side
      )
    ) {
      return fail(
        "Không có quyền quản lý bên này.",
        403
      );
    }

    // ================================================
    // VALIDATE GUEST INFORMATION
    // ================================================

    let fullName: string;
    let phone: string;
    let note: string;

    try {
      fullName = validateText(
        body.fullName,
        "Tên khách mời",
        MAX_NAME_LENGTH,
        true
      );

      phone = validatePhone(
        body.phone ?? ""
      );

      note = validateText(
        body.note ?? "",
        "Ghi chú",
        MAX_NOTE_LENGTH
      );
    } catch (error) {
      return fail(
        error instanceof Error
          ? error.message
          : "Thông tin khách không hợp lệ.",
        400
      );
    }

    // ================================================
    // INSERT INTO MONGODB
    // ================================================

    await ensureGuestIndexes();

    const collection =
      await getGuestCollection();

    // Khi trùng invitationToken,
    // tạo document mới tối đa 3 lần.
    for (
      let attempt = 0;
      attempt < 3;
      attempt++
    ) {
      const guest = createWeddingGuest({
        fullName,
        phone,
        note,
        side,
        adminId: admin.id,
      });

      try {
        const result =
          await collection.insertOne(guest);

        const inserted = {
          ...guest,
          _id: result.insertedId,
        };

        return json(
          {
            success: true,
            message:
              "Đã thêm khách mời thành công.",
            guest: serializeGuest(inserted),
          },
          201
        );
      } catch (error) {
        const isDuplicate =
          error !== null &&
          typeof error === "object" &&
          "code" in error &&
          error.code === 11000;

        if (
          isDuplicate &&
          isInvitationTokenDuplicate(error)
        ) {
          // Chỉ thử lại khi trùng token.
          continue;
        }

        if (isDuplicate) {
          console.error(
            "[ADMIN GUESTS POST DUPLICATE]",
            error
          );

          return fail(
            "Dữ liệu bị trùng khóa trong MongoDB.",
            409
          );
        }

        throw error;
      }
    }

    return fail(
      "Không thể tạo mã khách mời duy nhất.",
      409
    );
  } catch (error) {
    console.error(
      "[ADMIN GUESTS POST]",
      error
    );

    return fail(
      "Không thể thêm khách mời.",
      500
    );
  }
}

// ======================================================
// PATCH - UPDATE GUEST INFORMATION
//
// CHỈ CHO PHÉP:
// - fullName
// - phone
// - note
//
// KHÔNG CHO PHÉP:
// - Chuyển Nhà trai / Nhà gái.
// - Đổi token thiệp.
// - Đổi trạng thái gửi.
// - Đổi RSVP.
// - Sửa khách không có quyền.
// ======================================================

export async function PATCH(
  request: NextRequest
) {
  try {
    const auth = await requireAdminApi(
      request,
      "guests:write"
    );

    if (auth.error) {
      return auth.error;
    }

    const admin = auth.admin;

    if (!admin) {
      return fail(
        "Bạn chưa đăng nhập.",
        401
      );
    }

    // ================================================
    // READ BODY
    // ================================================

    let body: UpdateGuestBody;

    try {
      body =
        await readJsonBody(request);
    } catch (error) {
      return fail(
        error instanceof Error
          ? error.message
          : "Dữ liệu không hợp lệ.",
        400
      );
    }

    // ================================================
    // VALIDATE ID
    // ================================================

    if (!isValidObjectId(body.id)) {
      return fail(
        "ID khách mời không hợp lệ.",
        400
      );
    }

    // ================================================
    // REJECT INVITATION / RSVP UPDATES
    // ================================================

    if (
      containsForbiddenFields(
        body as Record<string, unknown>
      )
    ) {
      return fail(
        "Không được cập nhật dữ liệu thiệp mời hoặc RSVP tại Quản lý khách mời.",
        400
      );
    }

    if (body.side !== undefined) {
      return fail(
        "Không hỗ trợ chuyển bên khách mời.",
        400
      );
    }

    if (
      !hasOnlyAllowedKeys(
        body as Record<string, unknown>,
        ["id", "fullName", "phone", "note"]
      )
    ) {
      return fail(
        "Yêu cầu chứa trường không được phép.",
        400
      );
    }

    // ================================================
    // BUILD UPDATE
    // ================================================

    const updates: Partial<WeddingGuest> = {};

    try {
      if (body.fullName !== undefined) {
        updates.fullName = validateText(
          body.fullName,
          "Tên khách mời",
          MAX_NAME_LENGTH,
          true
        );
      }

      if (body.phone !== undefined) {
        updates.phone = validatePhone(
          body.phone
        );
      }

      if (body.note !== undefined) {
        updates.note = validateText(
          body.note,
          "Ghi chú",
          MAX_NOTE_LENGTH
        );
      }
    } catch (error) {
      return fail(
        error instanceof Error
          ? error.message
          : "Dữ liệu cập nhật không hợp lệ.",
        400
      );
    }

    if (
      Object.keys(updates).length === 0
    ) {
      return fail(
        "Không có thông tin khách mời cần sửa.",
        400
      );
    }

    // ================================================
    // DATABASE ACCESS
    // ================================================

    const collection =
      await getGuestCollection();

    const filter: Filter<WeddingGuest> = {
      ...getScopedFilter(admin),
      _id: new ObjectId(body.id),
    };

    const existing =
      await collection.findOne(filter);

    if (!existing) {
      return fail(
        "Không tìm thấy khách mời hoặc không có quyền chỉnh sửa.",
        404
      );
    }

    // ================================================
    // UPDATE
    // ================================================

    updates.updatedAt = new Date();
    updates.updatedBy = admin.id;

    const result =
      await collection.updateOne(
        filter,
        {
          $set: updates,
        }
      );

    if (result.matchedCount !== 1) {
      return fail(
        "Không thể cập nhật khách mời.",
        409
      );
    }

    const updated =
      await collection.findOne(filter);

    if (
      !updated ||
      !updated._id
    ) {
      return fail(
        "Không thể đọc dữ liệu sau cập nhật.",
        500
      );
    }

    return json({
      success: true,
      message:
        "Cập nhật khách mời thành công.",
      guest: serializeGuest({
        ...updated,
        _id: updated._id,
      }),
    });
  } catch (error) {
    console.error(
      "[ADMIN GUESTS PATCH]",
      error
    );

    return fail(
      "Không thể cập nhật khách mời.",
      500
    );
  }
}

// ======================================================
// DELETE - SOFT DELETE GUEST
//
// Không xóa vĩnh viễn khỏi MongoDB.
//
// Giữ lại:
// - Thông tin khách.
// - Mã thiệp.
// - Trạng thái đã gửi.
// - RSVP.
// - Lời nhắn.
// - Thời gian phản hồi.
//
// LƯU Ý:
// Nếu trang thiệp kiểm tra isDeleted=false,
// link thiệp của khách bị xóa mềm có thể
// ngừng hoạt động.
// ======================================================

export async function DELETE(
  request: NextRequest
) {
  try {
    const auth = await requireAdminApi(
      request,
      "guests:write"
    );

    if (auth.error) {
      return auth.error;
    }

    const admin = auth.admin;

    if (!admin) {
      return fail(
        "Bạn chưa đăng nhập.",
        401
      );
    }

    // ================================================
    // READ BODY
    // ================================================

    let body: DeleteGuestBody;

    try {
      body =
        await readJsonBody(request);
    } catch (error) {
      return fail(
        error instanceof Error
          ? error.message
          : "Dữ liệu không hợp lệ.",
        400
      );
    }

    if (
      !hasOnlyAllowedKeys(
        body as Record<string, unknown>,
        ["id"]
      )
    ) {
      return fail(
        "Yêu cầu xóa không hợp lệ.",
        400
      );
    }

    if (!isValidObjectId(body.id)) {
      return fail(
        "ID khách mời không hợp lệ.",
        400
      );
    }

    // ================================================
    // DATABASE
    // ================================================

    const collection =
      await getGuestCollection();

    const filter: Filter<WeddingGuest> = {
      ...getScopedFilter(admin),
      _id: new ObjectId(body.id),
    };

    const now = new Date();

    // ================================================
    // SOFT DELETE
    // ================================================

    const result =
      await collection.updateOne(
        filter,
        {
          $set: {
            isDeleted: true,
            deletedAt: now,
            updatedAt: now,
            updatedBy: admin.id,
          },
        }
      );

    if (result.matchedCount !== 1) {
      return fail(
        "Không tìm thấy khách mời hoặc không có quyền xóa.",
        404
      );
    }

    return json({
      success: true,
      message:
        "Đã xóa khách mời khỏi danh sách.",
    });
  } catch (error) {
    console.error(
      "[ADMIN GUESTS DELETE]",
      error
    );

    return fail(
      "Không thể xóa khách mời.",
      500
    );
  }
}
