
import "server-only";

import { getDatabase } from "@/lib/mongodb";

// ======================================================
// NAM & THU - PUBLIC WEDDING EVENTS
//
// GIAI ĐOẠN 3.4 - ĐỒNG BỘ DỮ LIỆU LỄ CƯỚI
//
// Chức năng:
// - Đọc dữ liệu lễ cưới từ MongoDB Atlas.
// - Chỉ lấy sự kiện đang hoạt động.
// - Chuẩn hóa dữ liệu Nhà trai và Nhà gái.
// - Chỉ trả về thông tin được phép công khai.
// - Không trả về dữ liệu tài khoản Admin.
//
// ======================================================

// ======================================================
// 1. TYPES
// ======================================================

export type PublicWeddingSide =
  | "groom"
  | "bride";

export interface PublicWeddingEvent {
  side: PublicWeddingSide;

  eventTitle: string;
  eventDate: string;
  eventTime: string | null;
  timeConfirmed: boolean;

  timezone: "Asia/Ho_Chi_Minh";

  family: {
    father: string;
    mother: string;
  };

  venue: {
    name: string;
    address: string;
    mapUrl: string;
  };
}

// ======================================================
// 2. MONGODB DOCUMENT TYPE
//
// Khai báo kiểu dữ liệu được đọc từ MongoDB.
//
// Các thuộc tính optional vì dữ liệu cũ
// có thể chưa được cập nhật đầy đủ.
//
// ======================================================

interface StoredWeddingEvent {
  side?: PublicWeddingSide;

  eventTitle?: string;
  eventDate?: string;
  eventTime?: string | null;
  timeConfirmed?: boolean;

  timezone?: string;

  family?: {
    father?: string;
    mother?: string;
  } | null;

  venue?: {
    name?: string;
    address?: string;
    mapUrl?: string;
  } | null;

  isActive?: boolean;

  createdAt?: Date;
  updatedAt?: Date;
}

// ======================================================
// 3. NORMALIZE TEXT
// ======================================================

function safeText(value: unknown): string {
  if (typeof value !== "string") {
    return "";
  }

  return value.trim();
}

// ======================================================
// 4. VALIDATE DATE
//
// Ngày lưu trong MongoDB:
//
// YYYY-MM-DD
//
// Ví dụ:
// 2026-12-26
// 2026-12-27
//
// Không chuyển ngày sang múi giờ khác để
// tránh sai lệch ngày tổ chức lễ cưới.
//
// ======================================================

function safeDate(value: unknown): string {
  if (
    typeof value !== "string" ||
    !/^\d{4}-\d{2}-\d{2}$/.test(value)
  ) {
    return "";
  }

  const [year, month, day] = value
    .split("-")
    .map(Number);

  const date = new Date(
    Date.UTC(year, month - 1, day)
  );

  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return "";
  }

  return value;
}

// ======================================================
// 5. VALIDATE TIME
//
// Giờ tổ chức dạng HH:mm.
//
// Ví dụ:
// 08:00
// 17:30
//
// Nếu chưa nhập hoặc không hợp lệ,
// trả về null.
//
// ======================================================

function safeTime(
  value: unknown
): string | null {
  if (
    typeof value !== "string" ||
    !/^([01]\d|2[0-3]):[0-5]\d$/.test(value)
  ) {
    return null;
  }

  return value;
}

// ======================================================
// 6. VALIDATE GOOGLE MAPS URL
//
// Chỉ chấp nhận liên kết HTTPS thuộc
// những tên miền Google Maps cho phép.
//
// ======================================================

function safeMapUrl(value: unknown): string {
  if (
    typeof value !== "string" ||
    !value.trim()
  ) {
    return "";
  }

  try {
    const url = new URL(value.trim());

    const allowedHosts = new Set([
      "google.com",
      "www.google.com",
      "maps.google.com",
      "maps.app.goo.gl",
      "goo.gl",
    ]);

    if (
      url.protocol !== "https:" ||
      !allowedHosts.has(url.hostname)
    ) {
      return "";
    }

    return url.toString();
  } catch {
    return "";
  }
}

// ======================================================
// 7. NORMALIZE WEDDING EVENT
//
// Chuyển document MongoDB thành dữ liệu
// an toàn để sử dụng ở frontend.
//
// ======================================================

function normalizeWeddingEvent(
  document: StoredWeddingEvent
): PublicWeddingEvent | null {
  // Chỉ cho phép Nhà trai hoặc Nhà gái.
  if (
    document.side !== "groom" &&
    document.side !== "bride"
  ) {
    return null;
  }

  const side = document.side;

  const eventTime = safeTime(
    document.eventTime
  );

  const eventTitle =
    safeText(document.eventTitle) ||
    (side === "groom"
      ? "Lễ thành hôn"
      : "Lễ vu quy");

  const eventDate = safeDate(
    document.eventDate
  );

  const timeConfirmed =
    document.timeConfirmed === true &&
    eventTime !== null;

  // ==================================================
  // KẾT QUẢ
  // ==================================================

  return {
    side,

    eventTitle,
    eventDate,
    eventTime,
    timeConfirmed,

    timezone: "Asia/Ho_Chi_Minh",

    // Thông tin gia đình.
    family: {
      father: safeText(
        document.family?.father
      ),

      mother: safeText(
        document.family?.mother
      ),
    },

    // Thông tin địa điểm.
    venue: {
      name: safeText(
        document.venue?.name
      ),

      address: safeText(
        document.venue?.address
      ),

      mapUrl: safeMapUrl(
        document.venue?.mapUrl
      ),
    },
  };
}

// ======================================================
// 8. GET PUBLIC WEDDING EVENTS
//
// Đọc collection wedding_events.
//
// Quan trọng:
// - Khai báo generic StoredWeddingEvent.
// - Chỉ lấy dữ liệu isActive = true.
// - Không lấy thông tin Admin.
// - Không trả _id MongoDB.
//
// ======================================================

export async function getPublicWeddingEvents():
  Promise<PublicWeddingEvent[]> {
  // Kết nối database.
  const database = await getDatabase();

  // ==================================================
  // FIX TYPESCRIPT ERROR TS2559
  //
  // Trước đây:
  //
  // database.collection("wedding_events")
  //
  // MongoDB trả về WithId<Document>.
  //
  // Hiện tại:
  //
  // database.collection<StoredWeddingEvent>(...)
  //
  // MongoDB sẽ trả về:
  // WithId<StoredWeddingEvent>
  //
  // ==================================================

  const collection =
    database.collection<StoredWeddingEvent>(
      "wedding_events"
    );

  // ==================================================
  // QUERY DATABASE
  // ==================================================

  const documents = await collection
    .find(
      {
        side: {
          $in: ["groom", "bride"],
        },

        isActive: true,
      },
      {
        projection: {
          // Không trả MongoDB ObjectId.
          _id: 0,

          // Thông tin buổi lễ.
          side: 1,
          eventTitle: 1,
          eventDate: 1,
          eventTime: 1,
          timeConfirmed: 1,

          // Thông tin gia đình.
          family: 1,

          // Địa điểm và bản đồ.
          venue: 1,
        },
      }
    )
    .limit(2)
    .toArray();

  // ==================================================
  // NORMALIZE DOCUMENTS
  // ==================================================

  const events = documents
    .map((document) => {
      return normalizeWeddingEvent(
        document
      );
    })
    .filter(
      (
        event
      ): event is PublicWeddingEvent => {
        return event !== null;
      }
    );

  // ==================================================
  // SORT EVENTS
  //
  // Nhà gái trước.
  // Nhà trai sau.
  //
  // ==================================================

  const sideOrder: Record<
    PublicWeddingSide,
    number
  > = {
    bride: 0,
    groom: 1,
  };

  events.sort((a, b) => {
    return (
      sideOrder[a.side] -
      sideOrder[b.side]
    );
  });

  // ==================================================
  // RETURN DATA
  // ==================================================

  return events;
}
