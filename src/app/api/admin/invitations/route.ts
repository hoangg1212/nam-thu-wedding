
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
  getAdminSide,
  canAccessWeddingSide,
  type CurrentAdmin,
  type WeddingSide,
} from "@/lib/admin-auth";

import {
  getGuestCollection,
  type WeddingGuest,
} from "@/lib/wedding-guests";

import {
  createWeddingInvitation,
  createInvitationSlug,
  createInvitationPublicToken,
  createInvitationPublicPath,
  ensureInvitationIndexes,
  getInvitationCollection,
  isInvitationDeliveryStatus,
  serializeInvitation,
  type WeddingInvitation,
} from "@/lib/wedding-invitations";

// ======================================================
// NAM & THU - ADMIN INVITATIONS API
//
// GIAI ĐOẠN 3.10 - BƯỚC 5.5
//
// PHÂN TRANG:
// - Cố định tối đa 10 thiệp / trang.
// - Trang đầu tiên là trang 1.
// - Tìm kiếm và lọc trước khi phân trang.
// - Thống kê không bị giới hạn bởi phân trang.
// - MongoDB xử lý skip() và limit().
//
// CHỨC NĂNG:
// GET    Danh sách thiệp mời.
// POST   Tạo thiệp từ khách có sẵn.
// PATCH  Cập nhật thiệp.
// DELETE Xóa mềm thiệp.
//
// BẢO TOÀN:
// - Quyền Super Admin / Groom / Bride.
// - RSVP từ collection guests.
// - Token và URL thiệp cá nhân hóa.
// - Chống tạo thiệp trùng.
// - Không sửa RSVP.
// - Không xóa khách mời.
// - Không thay đổi link thiệp cũ.
// ======================================================

// ======================================================
// CONSTANTS
// ======================================================

const MAX_BODY_BYTES =
  16 * 1024;

// Mặc định 10 thiệp / trang.
const DEFAULT_PAGE_SIZE = 10;

// Không cho API trả quá 10 thiệp / trang.
const MAX_PAGE_SIZE = 10;

// Giới hạn số trang nhận từ request.
const MAX_PAGE = 100000;

const MAX_SEARCH_LENGTH = 100;

// ======================================================
// TYPES
// ======================================================

interface CreateInvitationBody {
  guestId?: unknown;
}

interface UpdateInvitationBody {
  id?: unknown;
  guestId?: unknown;
  deliveryStatus?: unknown;
}

interface DeleteInvitationBody {
  id?: unknown;
}

interface InvitationStatistics {
  total: number;
  sent: number;
  notSent: number;
}

// ======================================================
// JSON HELPERS
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

function isObjectId(
  value: unknown
): value is string {
  return (
    typeof value === "string" &&
    /^[0-9a-fA-F]{24}$/.test(value) &&
    ObjectId.isValid(value)
  );
}

function isWeddingSide(
  value: unknown
): value is WeddingSide {
  return (
    value === "groom" ||
    value === "bride"
  );
}

// Chuyển tham số URL thành số nguyên dương.
//
// Ví dụ:
// page=2 -> 2
// page=abc -> 1
// page=-1 -> 1
// limit=100 -> 10
function positiveInteger(
  value: string | null,
  fallback: number,
  maximum: number
): number {
  if (!value) {
    return fallback;
  }

  const result = Number(value);

  if (
    !Number.isSafeInteger(result) ||
    result < 1
  ) {
    return fallback;
  }

  return Math.min(
    result,
    maximum
  );
}

// Escape ký tự đặc biệt trước khi
// sử dụng trong MongoDB Regex.
function escapeRegex(
  value: string
) {
  return value.replace(
    /[.*+?^${}()|[\]\\]/g,
    "\\$&"
  );
}

// Kiểm tra request chỉ chứa
// các trường dữ liệu được cho phép.
function hasOnlyKeys(
  body: Record<string, unknown>,
  allowed: string[]
) {
  return Object.keys(body).every(
    (key) => allowed.includes(key)
  );
}

// ======================================================
// REQUEST ORIGIN CHECK
// ======================================================

function isAllowedOrigin(
  request: NextRequest
): boolean {
  const origin =
    request.headers.get("origin");

  if (!origin) {
    return true;
  }

  try {
    return (
      new URL(origin).origin ===
      request.nextUrl.origin
    );
  } catch {
    return false;
  }
}

// ======================================================
// READ JSON BODY
//
// Giới hạn kích thước thực tế.
// Không chỉ dựa vào Content-Length.
// ======================================================

async function readJsonBody(
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
      "Yêu cầu phải gửi dữ liệu JSON."
    );
  }

  const contentLengthHeader =
    request.headers.get(
      "content-length"
    );

  if (
    contentLengthHeader !== null
  ) {
    const contentLength =
      Number(
        contentLengthHeader
      );

    if (
      !Number.isFinite(
        contentLength
      ) ||
      contentLength < 0 ||
      contentLength >
        MAX_BODY_BYTES
    ) {
      throw new Error(
        "Kích thước dữ liệu không hợp lệ."
      );
    }
  }

  if (!request.body) {
    throw new Error(
      "Nội dung yêu cầu không hợp lệ."
    );
  }

  const reader =
    request.body.getReader();

  const chunks: Uint8Array[] =
    [];

  let totalBytes = 0;

  try {
    while (true) {
      const {
        done,
        value,
      } = await reader.read();

      if (done) {
        break;
      }

      totalBytes +=
        value.byteLength;

      if (
        totalBytes >
        MAX_BODY_BYTES
      ) {
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

  const text =
    Buffer.concat(
      chunks.map(
        (chunk) =>
          Buffer.from(chunk)
      )
    ).toString("utf8");

  let parsed: unknown;

  try {
    parsed = JSON.parse(text);
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

  return parsed as Record<
    string,
    unknown
  >;
}

// ======================================================
// PERMISSION HELPERS
//
// Super Admin: Hai bên.
// Groom Admin: Nhà trai.
// Bride Admin: Nhà gái.
//
// Phạm vi luôn được áp dụng tại MongoDB.
// ======================================================

function getScopedFilter(
  admin: CurrentAdmin,
  requestedSide?: WeddingSide
): Filter<WeddingInvitation> {
  const filter:
    Filter<WeddingInvitation> = {
      isDeleted: false,
    };

  if (
    admin.role ===
    "super_admin"
  ) {
    if (requestedSide) {
      filter.side =
        requestedSide;
    }

    return filter;
  }

  const assignedSide =
    getAdminSide(
      admin.role
    );

  if (!assignedSide) {
    throw new Error(
      "Không xác định được bên quản lý."
    );
  }

  filter.side =
    assignedSide;

  return filter;
}

function getGuestFilter(
  admin: CurrentAdmin,
  guestId: ObjectId
): Filter<WeddingGuest> {
  const filter:
    Filter<WeddingGuest> = {
      _id: guestId,
      isDeleted: false,
    };

  if (
    admin.role !==
    "super_admin"
  ) {
    const side =
      getAdminSide(
        admin.role
      );

    if (!side) {
      throw new Error(
        "Tài khoản không có bên quản lý."
      );
    }

    filter.side = side;
  }

  return filter;
}

// ======================================================
// FIND AUTHORIZED GUEST
// ======================================================

async function findAuthorizedGuest(
  admin: CurrentAdmin,
  guestId: ObjectId
) {
  const collection =
    await getGuestCollection();

  return collection.findOne(
    getGuestFilter(
      admin,
      guestId
    )
  );
}

// ======================================================
// SERIALIZE WITH LIVE GUEST DATA
//
// RSVP đọc từ guests.
// Không lưu bản sao RSVP vào invitations.
// ======================================================

function withGuestData(
  invitation:
    WeddingInvitation & {
      _id: ObjectId;
    },
  guest: WeddingGuest | null
) {
  return {
    ...serializeInvitation(
      invitation
    ),

    guestName:
      guest?.fullName ??
      invitation.guestNameSnapshot,

    guestPhone:
      guest?.phone ?? "",

    guestNote:
      guest?.note ?? "",

    guestDeleted:
      !guest ||
      guest.isDeleted,

    rsvpStatus:
      guest?.rsvpStatus ??
      "no_response",

    rsvpMessage:
      guest?.rsvpMessage ?? "",

    respondedAt:
      guest?.respondedAt
        ?.toISOString() ??
      null,
  };
}

// ======================================================
// DUPLICATE KEY HELPER
// ======================================================

interface MongoDuplicateError {
  code?: unknown;
  keyPattern?: unknown;
  index?: unknown;
}

function getDuplicateType(
  error: unknown
):
  | "guest"
  | "token"
  | "other"
  | null {
  if (
    !error ||
    typeof error !== "object"
  ) {
    return null;
  }

  const mongoError =
    error as MongoDuplicateError;

  if (
    mongoError.code !==
    11000
  ) {
    return null;
  }

  const pattern =
    mongoError.keyPattern;

  if (
    mongoError.index ===
      "unique_active_guest_invitation" ||
    (
      typeof pattern ===
        "object" &&
      pattern !== null &&
      "guestId" in pattern
    )
  ) {
    return "guest";
  }

  if (
    mongoError.index ===
      "unique_invitation_public_token" ||
    (
      typeof pattern ===
        "object" &&
      pattern !== null &&
      "publicToken" in pattern
    )
  ) {
    return "token";
  }

  return "other";
}

// ======================================================
// GET - LIST INVITATIONS
//
// Query:
// page
// limit
// search
// side
// deliveryStatus
//
// Chuẩn phân trang:
// - Mặc định 10 thiệp.
// - Tối đa 10 thiệp.
// - Tổng số thiệp lấy từ countDocuments().
// - totalPages = ceil(total / limit).
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

    // page=1 -> skip 0
    // page=2 -> skip 10
    // page=3 -> skip 20
    // ...
    const skip =
      (page - 1) * limit;

    // ================================================
    // FILTER SIDE
    // ================================================

    const rawSide =
      params.get("side");

    if (
      rawSide &&
      rawSide !== "all" &&
      !isWeddingSide(rawSide)
    ) {
      return fail(
        "Bên mời không hợp lệ.",
        400
      );
    }

    const requestedSide =
      isWeddingSide(rawSide)
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
        "Bạn không có quyền xem thiệp của bên này.",
        403
      );
    }

    const baseFilter =
      getScopedFilter(
        admin,
        requestedSide
      );

    const filter:
      Filter<WeddingInvitation> = {
        ...baseFilter,
      };

    // ================================================
    // FILTER DELIVERY STATUS
    // ================================================

    const deliveryStatus =
      params.get(
        "deliveryStatus"
      );

    if (
      deliveryStatus &&
      deliveryStatus !== "all"
    ) {
      if (
        !isInvitationDeliveryStatus(
          deliveryStatus
        )
      ) {
        return fail(
          "Trạng thái gửi thiệp không hợp lệ.",
          400
        );
      }

      filter.deliveryStatus =
        deliveryStatus;
    }

    // ================================================
    // SEARCH
    // ================================================

    const search = (
      params.get("search") ??
      ""
    ).trim();

    if (
      Array.from(search)
        .length >
      MAX_SEARCH_LENGTH
    ) {
      return fail(
        "Từ khóa tìm kiếm quá dài.",
        400
      );
    }

    if (search) {
      const safeSearch =
        escapeRegex(
          search
        );

      const guestsCollection =
        await getGuestCollection();

      const guestSearchFilter:
        Filter<WeddingGuest> = {
          isDeleted: false,

          $or: [
            {
              fullName: {
                $regex:
                  safeSearch,
                $options:
                  "i",
              },
            },
            {
              phone: {
                $regex:
                  safeSearch,
                $options:
                  "i",
              },
            },
          ],
        };

      // Giữ phân quyền tìm kiếm khách.
      if (
        baseFilter.side
      ) {
        guestSearchFilter.side =
          baseFilter.side;
      }

      const matchedGuests =
        await guestsCollection
          .find(
            guestSearchFilter
          )
          .project<{
            _id: ObjectId;
          }>({
            _id: 1,
          })
          .toArray();

      const matchingIds =
        matchedGuests.map(
          (guest) =>
            guest._id
        );

      filter.$or = [
        {
          guestNameSnapshot: {
            $regex:
              safeSearch,
            $options:
              "i",
          },
        },
        {
          guestId: {
            $in:
              matchingIds,
          },
        },
      ];
    }

    // ================================================
    // QUERY MONGODB
    // ================================================

    const collection =
      await getInvitationCollection();

    const [
      invitations,
      total,
      sent,
      notSent,
      scopeTotal,
    ] = await Promise.all([
      // Chỉ lấy dữ liệu của trang hiện tại.
      collection
        .find(filter)
        .sort({
          createdAt: -1,
          _id: -1,
        })
        .skip(skip)
        .limit(limit)
        .toArray(),

      // Tổng thiệp phù hợp với bộ lọc.
      collection.countDocuments(
        filter
      ),

      // Thống kê đã gửi:
      // Không giới hạn theo trang.
      collection.countDocuments({
        ...baseFilter,
        deliveryStatus:
          "sent",
      }),

      // Thống kê chưa gửi:
      // Không giới hạn theo trang.
      collection.countDocuments({
        ...baseFilter,
        deliveryStatus:
          "not_sent",
      }),

      // Tổng thiệp trong phạm vi quản lý.
      collection.countDocuments(
        baseFilter
      ),
    ]);

    // ================================================
    // LOAD RSVP FROM GUESTS
    // ================================================

    const guestIds =
      invitations.map(
        (item) =>
          item.guestId
      );

    const guestCollection =
      await getGuestCollection();

    const relatedGuests =
      guestIds.length > 0
        ? await guestCollection
            .find({
              _id: {
                $in:
                  guestIds,
              },
            })
            .toArray()
        : [];

    const guestMap =
      new Map(
        relatedGuests
          .filter(
            (guest) =>
              guest._id
          )
          .map(
            (guest) => [
              guest._id!.toString(),
              guest,
            ]
          )
      );

    // ================================================
    // SERIALIZE
    // ================================================

    const data =
      invitations.map(
        (invitation) => {
          const guest =
            guestMap.get(
              invitation.guestId.toString()
            ) ?? null;

          // Không lộ dữ liệu khách
          // khác phạm vi thiệp.
          const safeGuest =
            guest &&
            !guest.isDeleted &&
            guest.side ===
              invitation.side
              ? guest
              : null;

          return withGuestData(
            {
              ...invitation,
              _id:
                invitation._id!,
            },
            safeGuest
          );
        }
      );

    // ================================================
    // PAGINATION METADATA
    // ================================================

    const totalPages =
      Math.ceil(
        total / limit
      );

    const statistics:
      InvitationStatistics = {
        total:
          scopeTotal,
        sent,
        notSent,
      };

    return json({
      success: true,

      invitations: data,

      pagination: {
        page,
        limit,
        total,
        totalPages,
      },

      statistics,
    });
  } catch (error) {
    console.error(
      "[ADMIN INVITATIONS GET]",
      error
    );

    return fail(
      "Không thể tải danh sách thiệp mời.",
      500
    );
  }
}

// ======================================================
// POST - CREATE INVITATION
//
// Tạo thiệp từ khách có sẵn.
// Không tạo khách mới.
// Không thay đổi RSVP.
// Không cho tạo trùng thiệp đang hoạt động.
// ======================================================

export async function POST(
  request: NextRequest
) {
  try {
    if (
      !isAllowedOrigin(
        request
      )
    ) {
      return fail(
        "Nguồn yêu cầu không hợp lệ.",
        403
      );
    }

    const auth =
      await requireAdminApi(
        request,
        "guests:write"
      );

    if (auth.error) {
      return auth.error;
    }

    const admin =
      auth.admin;

    if (!admin) {
      return fail(
        "Bạn chưa đăng nhập.",
        401
      );
    }

    let body:
      CreateInvitationBody;

    try {
      body =
        await readJsonBody(
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
      !hasOnlyKeys(
        body as Record<
          string,
          unknown
        >,
        ["guestId"]
      )
    ) {
      return fail(
        "Dữ liệu tạo thiệp không hợp lệ.",
        400
      );
    }

    if (
      !isObjectId(
        body.guestId
      )
    ) {
      return fail(
        "Vui lòng chọn khách mời hợp lệ.",
        400
      );
    }

    const guestId =
      new ObjectId(
        body.guestId
      );

    const guest =
      await findAuthorizedGuest(
        admin,
        guestId
      );

    if (!guest) {
      return fail(
        "Không tìm thấy khách mời hoặc không có quyền tạo thiệp cho khách này.",
        404
      );
    }

    if (
      !canAccessWeddingSide(
        admin.role,
        guest.side
      )
    ) {
      return fail(
        "Bạn không có quyền quản lý bên mời này.",
        403
      );
    }

    // Khởi tạo unique indexes.
    await ensureInvitationIndexes();

    const collection =
      await getInvitationCollection();

    const existing =
      await collection.findOne({
        guestId,
        isDeleted:
          false,
      });

    if (existing) {
      return fail(
        "Khách này đã có thiệp mời. Vui lòng chỉnh sửa thiệp hiện tại.",
        409
      );
    }

    // ================================================
    // INSERT WITH TOKEN COLLISION RETRY
    // ================================================

    for (
      let attempt = 0;
      attempt < 3;
      attempt++
    ) {
      const invitation =
        createWeddingInvitation({
          guestId,
          guestName:
            guest.fullName,
          side:
            guest.side,
          adminId:
            admin.id,
        });

      try {
        const result =
          await collection.insertOne(
            invitation
          );

        return json(
          {
            success: true,

            message:
              "Đã tạo thiệp mời thành công.",

            invitation:
              withGuestData(
                {
                  ...invitation,
                  _id:
                    result.insertedId,
                },
                guest
              ),
          },
          201
        );
      } catch (error) {
        const duplicate =
          getDuplicateType(
            error
          );

        if (
          duplicate ===
          "guest"
        ) {
          return fail(
            "Khách này đã có thiệp mời.",
            409
          );
        }

        if (
          duplicate ===
          "token"
        ) {
          continue;
        }

        if (
          duplicate ===
          "other"
        ) {
          return fail(
            "Dữ liệu thiệp bị trùng khóa.",
            409
          );
        }

        throw error;
      }
    }

    return fail(
      "Không thể tạo mã thiệp duy nhất.",
      409
    );
  } catch (error) {
    console.error(
      "[ADMIN INVITATIONS POST]",
      error
    );

    return fail(
      "Không thể tạo thiệp mời.",
      500
    );
  }
}

// ======================================================
// PATCH - UPDATE INVITATION
//
// Hỗ trợ:
// 1. Cập nhật trạng thái gửi.
// 2. Đổi khách liên kết khi chưa gửi.
//
// Không cho cập nhật đồng thời hai nội dung.
// Không sửa RSVP.
// ======================================================

export async function PATCH(
  request: NextRequest
) {
  try {
    if (
      !isAllowedOrigin(
        request
      )
    ) {
      return fail(
        "Nguồn yêu cầu không hợp lệ.",
        403
      );
    }

    const auth =
      await requireAdminApi(
        request,
        "guests:write"
      );

    if (auth.error) {
      return auth.error;
    }

    const admin =
      auth.admin;

    if (!admin) {
      return fail(
        "Bạn chưa đăng nhập.",
        401
      );
    }

    let body:
      UpdateInvitationBody;

    try {
      body =
        await readJsonBody(
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
      !hasOnlyKeys(
        body as Record<
          string,
          unknown
        >,
        [
          "id",
          "guestId",
          "deliveryStatus",
        ]
      )
    ) {
      return fail(
        "Dữ liệu cập nhật thiệp không hợp lệ.",
        400
      );
    }

    if (
      !isObjectId(
        body.id
      )
    ) {
      return fail(
        "ID thiệp mời không hợp lệ.",
        400
      );
    }

    const changesGuest =
      body.guestId !==
      undefined;

    const changesDelivery =
      body.deliveryStatus !==
      undefined;

    if (
      changesGuest ===
      changesDelivery
    ) {
      return fail(
        "Chỉ được cập nhật một nội dung mỗi lần: khách liên kết hoặc trạng thái gửi.",
        400
      );
    }

    const collection =
      await getInvitationCollection();

    const filter:
      Filter<WeddingInvitation> = {
        ...getScopedFilter(
          admin
        ),
        _id:
          new ObjectId(
            body.id
          ),
      };

    const existing =
      await collection.findOne(
        filter
      );

    if (
      !existing ||
      !existing._id
    ) {
      return fail(
        "Không tìm thấy thiệp hoặc không có quyền chỉnh sửa.",
        404
      );
    }

    const now =
      new Date();

    // ================================================
    // UPDATE DELIVERY STATUS
    // ================================================

    if (
      changesDelivery
    ) {
      if (
        !isInvitationDeliveryStatus(
          body.deliveryStatus
        )
      ) {
        return fail(
          "Trạng thái gửi thiệp không hợp lệ.",
          400
        );
      }

      const targetStatus =
        body.deliveryStatus;

      // Khi đánh dấu đã gửi,
      // khách cần còn tồn tại
      // và thuộc đúng bên mời.
      if (
        targetStatus ===
        "sent"
      ) {
        const guest =
          await findAuthorizedGuest(
            admin,
            existing.guestId
          );

        if (
          !guest ||
          guest.side !==
            existing.side
        ) {
          return fail(
            "Khách liên kết đã bị xóa hoặc không còn hợp lệ.",
            409
          );
        }
      }

      const result =
        await collection.updateOne(
          {
            ...filter,
            guestId:
              existing.guestId,
          },
          {
            $set: {
              deliveryStatus:
                targetStatus,

              sentAt:
                targetStatus ===
                "sent"
                  ? existing.sentAt ??
                    now
                  : null,

              updatedAt:
                now,

              updatedBy:
                admin.id,
            },
          }
        );

      if (
        result.matchedCount !==
        1
      ) {
        return fail(
          "Thiệp đã thay đổi. Vui lòng tải lại.",
          409
        );
      }
    }

    // ================================================
    // CHANGE LINKED GUEST
    // ================================================

    if (
      changesGuest
    ) {
      if (
        !isObjectId(
          body.guestId
        )
      ) {
        return fail(
          "Khách mời được chọn không hợp lệ.",
          400
        );
      }

      // Không được đổi khách khi thiệp đã gửi.
      if (
        existing.deliveryStatus !==
        "not_sent"
      ) {
        return fail(
          "Thiệp đã gửi không thể đổi khách liên kết. Hãy tạo thiệp phù hợp thay vì thay đổi người nhận.",
          409
        );
      }

      const newGuestId =
        new ObjectId(
          body.guestId
        );

      if (
        newGuestId.equals(
          existing.guestId
        )
      ) {
        return fail(
          "Khách mời chưa thay đổi.",
          400
        );
      }

      // Kiểm tra khách cũ chưa RSVP.
      const oldGuest =
        await findAuthorizedGuest(
          admin,
          existing.guestId
        );

      if (
        oldGuest &&
        oldGuest.rsvpStatus !==
          "no_response"
      ) {
        return fail(
          "Khách cũ đã phản hồi RSVP. Không thể đổi người nhận của thiệp này.",
          409
        );
      }

      // Kiểm tra khách mới.
      const newGuest =
        await findAuthorizedGuest(
          admin,
          newGuestId
        );

      if (
        !newGuest
      ) {
        return fail(
          "Khách mới không tồn tại hoặc nằm ngoài quyền quản lý.",
          404
        );
      }

      // Không chuyển thiệp sang bên khác.
      if (
        newGuest.side !==
        existing.side
      ) {
        return fail(
          "Không thể đổi thiệp sang khách thuộc bên mời khác. Vui lòng xóa thiệp này và tạo thiệp mới ở đúng bên.",
          400
        );
      }

      // Một khách chỉ có một thiệp đang hoạt động.
      const duplicate =
        await collection.findOne({
          guestId:
            newGuestId,
          isDeleted:
            false,
        });

      if (
        duplicate
      ) {
        return fail(
          "Khách mới đã có thiệp mời.",
          409
        );
      }

      // Sinh slug từ tên khách mới.
      const slug =
        createInvitationSlug(
          newGuest.fullName
        );

      let updated =
        false;

      // Sinh token mới để link cũ
      // không tiếp tục dùng cho khách mới.
      for (
        let attempt = 0;
        attempt < 3;
        attempt++
      ) {
        const token =
          createInvitationPublicToken();

        const publicPath =
          createInvitationPublicPath(
            slug,
            token
          );

        try {
          const result =
            await collection.updateOne(
              {
                ...filter,

                guestId:
                  existing.guestId,

                deliveryStatus:
                  "not_sent",
              },
              {
                $set: {
                  guestId:
                    newGuestId,

                  guestNameSnapshot:
                    newGuest.fullName,

                  slug,

                  publicToken:
                    token,

                  publicPath,

                  updatedAt:
                    now,

                  updatedBy:
                    admin.id,
                },
              }
            );

          if (
            result.matchedCount !==
            1
          ) {
            return fail(
              "Thiệp đã thay đổi. Vui lòng tải lại.",
              409
            );
          }

          updated = true;
          break;
        } catch (error) {
          const type =
            getDuplicateType(
              error
            );

          if (
            type ===
            "guest"
          ) {
            return fail(
              "Khách mới đã có thiệp mời.",
              409
            );
          }

          if (
            type ===
            "token"
          ) {
            continue;
          }

          throw error;
        }
      }

      if (
        !updated
      ) {
        return fail(
          "Không thể tạo đường dẫn mới.",
          409
        );
      }
    }

    // ================================================
    // RETURN UPDATED INVITATION
    // ================================================

    const saved =
      await collection.findOne(
        filter
      );

    if (
      !saved ||
      !saved._id
    ) {
      return fail(
        "Không thể đọc thiệp sau cập nhật.",
        500
      );
    }

    const guestCollection =
      await getGuestCollection();

    const guest =
      await guestCollection.findOne({
        _id:
          saved.guestId,

        isDeleted:
          false,

        side:
          saved.side,
      });

    return json({
      success: true,

      message:
        "Cập nhật thiệp mời thành công.",

      invitation:
        withGuestData(
          {
            ...saved,
            _id:
              saved._id,
          },
          guest
        ),
    });
  } catch (error) {
    console.error(
      "[ADMIN INVITATIONS PATCH]",
      error
    );

    return fail(
      "Không thể cập nhật thiệp mời.",
      500
    );
  }
}

// ======================================================
// DELETE - SOFT DELETE
//
// Chỉ xóa mềm thiệp mời.
//
// Không xóa:
// - Khách mời.
// - RSVP.
// - Lời nhắn RSVP.
// - Lịch sử phản hồi.
// - Các URL thiệp thuộc hệ thống cũ.
// ======================================================

export async function DELETE(
  request: NextRequest
) {
  try {
    if (
      !isAllowedOrigin(
        request
      )
    ) {
      return fail(
        "Nguồn yêu cầu không hợp lệ.",
        403
      );
    }

    const auth =
      await requireAdminApi(
        request,
        "guests:write"
      );

    if (
      auth.error
    ) {
      return auth.error;
    }

    const admin =
      auth.admin;

    if (!admin) {
      return fail(
        "Bạn chưa đăng nhập.",
        401
      );
    }

    let body:
      DeleteInvitationBody;

    try {
      body =
        await readJsonBody(
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
      !hasOnlyKeys(
        body as Record<
          string,
          unknown
        >,
        ["id"]
      ) ||
      !isObjectId(
        body.id
      )
    ) {
      return fail(
        "ID thiệp mời không hợp lệ.",
        400
      );
    }

    const collection =
      await getInvitationCollection();

    const filter:
      Filter<WeddingInvitation> = {
        ...getScopedFilter(
          admin
        ),

        _id:
          new ObjectId(
            body.id
          ),
      };

    const now =
      new Date();

    const result =
      await collection.updateOne(
        filter,
        {
          $set: {
            isDeleted:
              true,

            deletedAt:
              now,

            updatedAt:
              now,

            updatedBy:
              admin.id,
          },
        }
      );

    if (
      result.matchedCount !==
      1
    ) {
      return fail(
        "Không tìm thấy thiệp hoặc không có quyền xóa.",
        404
      );
    }

    return json({
      success: true,

      message:
        "Đã xóa thiệp mời khỏi danh sách. Thông tin khách và RSVP được giữ nguyên.",
    });
  } catch (error) {
    console.error(
      "[ADMIN INVITATIONS DELETE]",
      error
    );

    return fail(
      "Không thể xóa thiệp mời.",
      500
    );
  }
}
