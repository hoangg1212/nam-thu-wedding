
import {
  wedding,
  type GuestSide,
  type WeddingData,
  type WeddingLocation,
} from "@/data/wedding";

// ======================================================
// NAM & THU - WEDDING DATA SYNCHRONIZATION
//
// Chuyển dữ liệu public API sang WeddingData.
// Không thay đổi object wedding gốc.
// Không ghi đè ảnh, nhạc hoặc nội dung trang trí.
// ======================================================

export interface LiveWeddingEvent {
  side: GuestSide;
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

export interface WeddingEventsResponse {
  success: boolean;
  events?: LiveWeddingEvent[];
  message?: string;
}

function validSide(value: unknown): value is GuestSide {
  return value === "groom" || value === "bride";
}

function validDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }

  const [year, month, day] = value
    .split("-")
    .map(Number);

  const date = new Date(
    Date.UTC(year, month - 1, day)
  );

  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

function validTime(value: string | null): boolean {
  return (
    typeof value === "string" &&
    /^([01]\d|2[0-3]):[0-5]\d$/.test(value)
  );
}

function weekdayLabel(dateValue: string): string {
  if (!validDate(dateValue)) {
    return "";
  }

  const [year, month, day] = dateValue
    .split("-")
    .map(Number);

  const weekday = new Date(
    Date.UTC(year, month - 1, day)
  ).getUTCDay();

  return [
    "Chủ nhật",
    "Thứ Hai",
    "Thứ Ba",
    "Thứ Tư",
    "Thứ Năm",
    "Thứ Sáu",
    "Thứ Bảy",
  ][weekday];
}

function formatDisplayDate(dateValue: string): string {
  if (!validDate(dateValue)) {
    return "";
  }

  const [year, month, day] = dateValue.split("-");
  return `${day}.${month}.${year}`;
}

function formatDateRange(
  dates: string[],
  fallback: string
): string {
  const uniqueDates = Array.from(
    new Set(dates.filter(validDate))
  ).sort();

  if (uniqueDates.length === 0) {
    return fallback;
  }

  if (uniqueDates.length === 1) {
    return formatDisplayDate(uniqueDates[0]);
  }

  const [firstYear, firstMonth, firstDay] =
    uniqueDates[0].split("-");

  const [lastYear, lastMonth, lastDay] =
    uniqueDates[uniqueDates.length - 1].split("-");

  if (
    firstYear === lastYear &&
    firstMonth === lastMonth
  ) {
    return `${firstDay} – ${lastDay}.${lastMonth}.${lastYear}`;
  }

  return `${formatDisplayDate(uniqueDates[0])} – ${formatDisplayDate(uniqueDates[uniqueDates.length - 1])}`;
}

function updateLocation(
  original: WeddingLocation,
  event: LiveWeddingEvent
): WeddingLocation {
  const date = validDate(event.eventDate)
    ? event.eventDate
    : original.eventDate;

  const confirmedTime =
    event.timeConfirmed &&
    validTime(event.eventTime)
      ? event.eventTime!
      : "";

  return {
    ...original,

    eventTitle: event.eventTitle,
    eventDate: date,
    weekdayLabel: weekdayLabel(date),

    time: confirmedTime,

    title: event.venue.name || original.title,
    address: event.venue.address,
    mapUrl: event.venue.mapUrl,
  };
}

// ======================================================
// ĐỒNG BỘ LỄ CƯỚI
//
// Chỉ ghi nhận những event API trả về.
// Không tự khôi phục sự kiện đã bị vô hiệu hóa.
// ======================================================

export function mergeWeddingData(
  events: LiveWeddingEvent[],
  base: WeddingData = wedding
): WeddingData {
  const validEvents = events.filter(
    (event) =>
      validSide(event.side) &&
      validDate(event.eventDate)
  );

  const bySide = new Map<GuestSide, LiveWeddingEvent>();

  for (const event of validEvents) {
    bySide.set(event.side, event);
  }

  const groom = bySide.get("groom");
  const bride = bySide.get("bride");

  const groomLocation = groom
    ? updateLocation(base.locations.groom, groom)
    : base.locations.groom;

  const brideLocation = bride
    ? updateLocation(base.locations.bride, bride)
    : base.locations.bride;

  const allDates = [
    groom?.eventDate,
    bride?.eventDate,
  ].filter((date): date is string => Boolean(date));

  // Lịch chỉ hiển thị chính xác khi các buổi lễ
  // đang kích hoạt nằm cùng một tháng.
  const calendarDates = allDates.filter(validDate);

  const sameMonth =
    calendarDates.length > 0 &&
    calendarDates.every(
      (date) =>
        date.slice(0, 7) ===
        calendarDates[0].slice(0, 7)
    );

  let calendar = base.calendar;

  if (sameMonth) {
    const [year, month] =
      calendarDates[0].split("-").map(Number);

    calendar = {
      ...base.calendar,
      year,
      month,
      monthLabel: `Tháng ${month}`,
      highlightedDates: Array.from(
        new Set(
          calendarDates.map((date) =>
            Number(date.slice(8, 10))
          )
        )
      ).sort((a, b) => a - b),
    };
  }

  return {
    ...base,

    displayDate: formatDateRange(
      allDates,
      base.displayDate
    ),

    locations: {
      groom: groomLocation,
      bride: brideLocation,
    },

    calendar,

    groom: {
      ...base.groom,
      parents: groom
        ? { ...groom.family }
        : { ...base.groom.parents },
    },

    bride: {
      ...base.bride,
      parents: bride
        ? { ...bride.family }
        : { ...base.bride.parents },
    },
  };
}
