
import { NextRequest, NextResponse } from "next/server";
import type { Collection, Document } from "mongodb";

import { getDatabase } from "@/lib/mongodb";

import {
  requireAdminApi,
  canAccessWeddingSide,
  type WeddingSide,
} from "@/lib/admin-auth";

// ======================================================
// NAM & THU - WEDDING EVENTS ADMIN API
//
// GET   /api/admin/events
// PATCH /api/admin/events
//
// Collection: wedding_events
//
// CẬP NHẬT:
// family.displayMode = both | father | mother
//
// Dữ liệu cũ chưa có displayMode:
// Mặc định "both" để tương thích.
// ======================================================

type ParentDisplayMode =
  | "both"
  | "father"
  | "mother";

interface WeddingEventData {
  side: WeddingSide;
  eventTitle: string;
  eventDate: string;
  eventTime: string | null;
  timeConfirmed: boolean;
  timezone: "Asia/Ho_Chi_Minh";

  family: {
    father: string;
    mother: string;
    displayMode: ParentDisplayMode;
  };

  venue: {
    name: string;
    address: string;
    mapUrl: string;
  };

  isActive: boolean;
}

const SIDES: WeddingSide[] = [
  "groom",
  "bride",
];

function send(
  data: Record<string, unknown>,
  status = 200
) {
  return NextResponse.json(data, {
    status,
    headers: {
      "Cache-Control": "private, no-store",
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

function isSide(
  value: unknown
): value is WeddingSide {
  return (
    value === "groom" ||
    value === "bride"
  );
}

function isDisplayMode(
  value: unknown
): value is ParentDisplayMode {
  return (
    value === "both" ||
    value === "father" ||
    value === "mother"
  );
}

function stringValue(
  value: unknown,
  label: string,
  maxLength: number
): string {
  if (typeof value !== "string") {
    throw new Error(
      `${label} không hợp lệ.`
    );
  }

  const result = value.trim();

  if (
    Array.from(result).length > maxLength ||
    /[\x00-\x1F\x7F]/.test(result)
  ) {
    throw new Error(
      `${label} chứa ký tự không hợp lệ hoặc quá dài.`
    );
  }

  return result;
}

function isValidDate(
  value: string
): boolean {
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(value)
  ) {
    return false;
  }

  const [year, month, day] =
    value.split("-").map(Number);

  const testDate = new Date(
    Date.UTC(year, month - 1, day)
  );

  return (
    year >= 2000 &&
    year <= 2100 &&
    testDate.getUTCFullYear() === year &&
    testDate.getUTCMonth() === month - 1 &&
    testDate.getUTCDate() === day
  );
}

// ======================================================
// VALIDATE EVENT
// ======================================================

function validateEvent(
  value: unknown
): WeddingEventData {
  if (
    !value ||
    typeof value !== "object" ||
    Array.isArray(value)
  ) {
    throw new Error(
      "Dữ liệu lễ cưới không hợp lệ."
    );
  }

  const raw =
    value as Record<string, unknown>;

  if (!isSide(raw.side)) {
    throw new Error(
      "Bên tổ chức không hợp lệ."
    );
  }

  const eventTitle = stringValue(
    raw.eventTitle,
    "Tên buổi lễ",
    120
  );

  if (!eventTitle) {
    throw new Error(
      "Vui lòng nhập tên buổi lễ."
    );
  }

  const eventDate = stringValue(
    raw.eventDate,
    "Ngày tổ chức",
    10
  );

  if (!isValidDate(eventDate)) {
    throw new Error(
      "Ngày tổ chức không hợp lệ."
    );
  }

  if (
    typeof raw.timeConfirmed !== "boolean"
  ) {
    throw new Error(
      "Trạng thái xác nhận giờ không hợp lệ."
    );
  }

  let eventTime: string | null = null;

  if (
    raw.eventTime !== null &&
    raw.eventTime !== undefined &&
    raw.eventTime !== ""
  ) {
    eventTime = stringValue(
      raw.eventTime,
      "Giờ tổ chức",
      5
    );

    if (
      !/^([01]\d|2[0-3]):[0-5]\d$/.test(
        eventTime
      )
    ) {
      throw new Error(
        "Giờ tổ chức phải có định dạng HH:mm."
      );
    }
  }

  if (
    raw.timeConfirmed &&
    !eventTime
  ) {
    throw new Error(
      "Cần nhập giờ trước khi xác nhận giờ tổ chức."
    );
  }

  if (
    !raw.family ||
    typeof raw.family !== "object" ||
    Array.isArray(raw.family)
  ) {
    throw new Error(
      "Thông tin gia đình không hợp lệ."
    );
  }

  if (
    !raw.venue ||
    typeof raw.venue !== "object" ||
    Array.isArray(raw.venue)
  ) {
    throw new Error(
      "Thông tin địa điểm không hợp lệ."
    );
  }

  const family =
    raw.family as Record<string, unknown>;

  const venue =
    raw.venue as Record<string, unknown>;

  const father = stringValue(
    family.father,
    "Họ tên cha",
    120
  );

  const mother = stringValue(
    family.mother,
    "Họ tên mẹ",
    120
  );

  // Chấp nhận dữ liệu cũ chưa có displayMode.
  // Admin mới luôn gửi giá trị cụ thể.
  let displayMode: ParentDisplayMode = "both";

  if (
    family.displayMode !== undefined &&
    family.displayMode !== null
  ) {
    if (
      !isDisplayMode(
        family.displayMode
      )
    ) {
      throw new Error(
        "Lựa chọn hiển thị cha mẹ không hợp lệ."
      );
    }

    displayMode = family.displayMode;
  }

  // Chỉ bắt buộc tên được lựa chọn riêng.
  if (
    displayMode === "father" &&
    !father
  ) {
    throw new Error(
      "Vui lòng nhập họ tên cha khi chọn chỉ hiển thị cha."
    );
  }

  if (
    displayMode === "mother" &&
    !mother
  ) {
    throw new Error(
      "Vui lòng nhập họ tên mẹ khi chọn chỉ hiển thị mẹ."
    );
  }

  const venueName = stringValue(
    venue.name,
    "Tên địa điểm",
    150
  );

  const address = stringValue(
    venue.address,
    "Địa chỉ",
    500
  );

  const mapUrl = stringValue(
    venue.mapUrl,
    "Google Maps",
    1500
  );

  if (mapUrl) {
    let url: URL;

    try {
      url = new URL(mapUrl);
    } catch {
      throw new Error(
        "Liên kết Google Maps không hợp lệ."
      );
    }

    const allowedHosts = [
      "google.com",
      "www.google.com",
      "maps.google.com",
      "maps.app.goo.gl",
      "goo.gl",
    ];

    if (
      url.protocol !== "https:" ||
      !allowedHosts.includes(
        url.hostname
      )
    ) {
      throw new Error(
        "Vui lòng sử dụng liên kết Google Maps HTTPS hợp lệ."
      );
    }
  }

  if (
    typeof raw.isActive !== "boolean"
  ) {
    throw new Error(
      "Trạng thái hiển thị không hợp lệ."
    );
  }

  return {
    side: raw.side,
    eventTitle,
    eventDate,
    eventTime,
    timeConfirmed:
      raw.timeConfirmed,
    timezone: "Asia/Ho_Chi_Minh",

    family: {
      father,
      mother,
      displayMode,
    },

    venue: {
      name: venueName,
      address,
      mapUrl,
    },

    isActive: raw.isActive,
  };
}

// ======================================================
// DATABASE
// ======================================================

async function eventsCollection():
  Promise<Collection<Document>> {
  const database = await getDatabase();

  return database.collection(
    "wedding_events"
  );
}

// ======================================================
// SERIALIZE
//
// Giữ tương thích với document cũ.
// ======================================================

function serializeEvent(
  doc: Document
): WeddingEventData {
  const side: WeddingSide =
    doc.side === "bride"
      ? "bride"
      : "groom";

  const family =
    doc.family &&
    typeof doc.family === "object"
      ? doc.family
      : {};

  const venue =
    doc.venue &&
    typeof doc.venue === "object"
      ? doc.venue
      : {};

  const displayMode:
    ParentDisplayMode =
    isDisplayMode(
      family.displayMode
    )
      ? family.displayMode
      : "both";

  return {
    side,

    eventTitle:
      typeof doc.eventTitle === "string"
        ? doc.eventTitle
        : side === "groom"
          ? "Lễ thành hôn"
          : "Lễ vu quy",

    eventDate:
      typeof doc.eventDate === "string"
        ? doc.eventDate
        : "",

    eventTime:
      typeof doc.eventTime === "string"
        ? doc.eventTime
        : null,

    timeConfirmed:
      doc.timeConfirmed === true,

    timezone: "Asia/Ho_Chi_Minh",

    family: {
      father:
        typeof family.father === "string"
          ? family.father
          : "",

      mother:
        typeof family.mother === "string"
          ? family.mother
          : "",

      displayMode,
    },

    venue: {
      name:
        typeof venue.name === "string"
          ? venue.name
          : "",

      address:
        typeof venue.address === "string"
          ? venue.address
          : "",

      mapUrl:
        typeof venue.mapUrl === "string"
          ? venue.mapUrl
          : "",
    },

    isActive: doc.isActive !== false,
  };
}

// ======================================================
// GET
// ======================================================

export async function GET(
  request: NextRequest
) {
  try {
    const auth = await requireAdminApi(
      request,
      "events:read"
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

    const allowedSides =
      auth.admin.role === "super_admin"
        ? SIDES
        : auth.admin.side
          ? [auth.admin.side]
          : [];

    if (
      allowedSides.length === 0
    ) {
      return fail(
        "Không có quyền xem lễ cưới.",
        403
      );
    }

    const collection =
      await eventsCollection();

    const documents =
      await collection
        .find({
          side: {
            $in: allowedSides,
          },
        })
        .toArray();

    return send({
      success: true,
      events:
        documents.map(serializeEvent),
    });
  } catch (error) {
    console.error(
      "[ADMIN EVENTS GET]",
      error
    );

    return fail(
      "Không thể tải thông tin lễ cưới.",
      500
    );
  }
}

// ======================================================
// PATCH
// ======================================================

export async function PATCH(
  request: NextRequest
) {
  try {
    const auth = await requireAdminApi(
      request,
      "events:write"
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

    const contentType =
      request.headers.get(
        "content-type"
      ) ?? "";

    if (
      !contentType
        .toLowerCase()
        .includes("application/json")
    ) {
      return fail(
        "Yêu cầu phải sử dụng JSON.",
        415
      );
    }

    const bodyText =
      await request.text();

    if (
      Buffer.byteLength(
        bodyText,
        "utf8"
      ) > 10000
    ) {
      return fail(
        "Dữ liệu gửi lên quá lớn.",
        413
      );
    }

    let body: unknown;

    try {
      body = JSON.parse(
        bodyText
      );
    } catch {
      return fail(
        "JSON không hợp lệ.",
        400
      );
    }

    let event: WeddingEventData;

    try {
      event = validateEvent(
        body
      );
    } catch (error) {
      return fail(
        error instanceof Error
          ? error.message
          : "Dữ liệu không hợp lệ.",
        400
      );
    }

    // Kiểm tra quyền tại backend.
    if (
      !canAccessWeddingSide(
        auth.admin.role,
        event.side
      )
    ) {
      return fail(
        "Bạn không có quyền sửa thông tin bên này.",
        403
      );
    }

    const collection =
      await eventsCollection();

    // Không tự tạo thêm document.
    const result =
      await collection.updateOne(
        {
          side: event.side,
        },
        {
          $set: {
            eventTitle:
              event.eventTitle,

            eventDate:
              event.eventDate,

            eventTime:
              event.eventTime,

            timeConfirmed:
              event.timeConfirmed,

            timezone:
              event.timezone,

            // Lưu trọn vẹn cả hai tên và chế độ hiển thị.
            family: {
              father:
                event.family.father,

              mother:
                event.family.mother,

              displayMode:
                event.family.displayMode,
            },

            venue:
              event.venue,

            isActive:
              event.isActive,

            updatedAt:
              new Date(),
          },
        }
      );

    if (
      result.matchedCount !== 1
    ) {
      return fail(
        "Không tìm thấy dữ liệu lễ cưới của bên này. Hãy kiểm tra database.",
        404
      );
    }

    return send({
      success: true,
      message:
        "Đã lưu thông tin lễ cưới.",
      event,
    });
  } catch (error) {
    console.error(
      "[ADMIN EVENTS PATCH]",
      error
    );

    return fail(
      "Không thể lưu thông tin lễ cưới.",
      500
    );
  }
}
