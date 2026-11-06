
"use client";

import Image from "next/image";
import {
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";

import {
  MapPin,
  Navigation,
  ExternalLink,
} from "lucide-react";

import {
  wedding,
  type GuestSide,
} from "@/data/wedding";

import {
  useWeddingData,
} from "@/components/providers/WeddingProvider";

// =====================================================
// NAM & THU - WEDDING INVITATION
//
// CẬP NHẬT RESPONSIVE:
// - Hai khối Nhà trai / Nhà gái cân đối.
// - Cố định vùng hiển thị cha mẹ.
// - Tên một phụ huynh được căn giữa.
// - Đường phân cách và địa chỉ cùng hàng.
// - Không tràn chữ trên màn hình mobile.
// - Giữ lựa chọn hiển thị từ Admin.
//
// GIỮ NGUYÊN:
// - Dữ liệu WeddingProvider.
// - Ảnh cô dâu / chú rể.
// - Ring Decoration.
// - Lịch cưới động.
// - Ngày giờ và âm lịch.
// - Google Maps.
// - Hiệu ứng Reveal.
// =====================================================

// =====================================================
// TYPES
// =====================================================

interface WeddingInvitationProps {
  guestName: string;
  guestSide: GuestSide;
}

type ParentDisplayMode =
  | "both"
  | "father"
  | "mother";

interface FamilyInformationProps {
  title: string;
  father: string;
  mother: string;
  address: string;
  displayMode: ParentDisplayMode;
}

interface PublicDisplayEvent {
  side: GuestSide;
  familyDisplayMode?: ParentDisplayMode;
}

interface PublicEventsResponse {
  success?: boolean;
  events?: PublicDisplayEvent[];
}

// =====================================================
// DATE CONSTANTS
// =====================================================

const lunarDates: Record<GuestSide, string> = {
  bride: "Tức ngày 18 tháng 11 năm Bính Ngọ",
  groom: "Tức ngày 19 tháng 11 năm Bính Ngọ",
};

const originalDates: Record<GuestSide, string> = {
  bride: "2026-12-26",
  groom: "2026-12-27",
};

// =====================================================
// PARENT DISPLAY MODE
// =====================================================

function normalizeDisplayMode(
  value: unknown
): ParentDisplayMode {
  if (
    value === "father" ||
    value === "mother"
  ) {
    return value;
  }

  return "both";
}

// =====================================================
// ĐỌC LỰA CHỌN HIỂN THỊ TỪ API
//
// Nếu chưa tải được API, không hiện tên cha mẹ.
// Tránh hiện nhầm tên người được chọn ẩn.
// =====================================================

function useFamilyDisplayModes() {
  const [displayModes, setDisplayModes] =
    useState<
      Record<GuestSide, ParentDisplayMode> | null
    >(null);

  useEffect(() => {
    const controller = new AbortController();

    async function fetchDisplayModes() {
      try {
        const response = await fetch(
          "/api/wedding-events",
          {
            method: "GET",
            credentials: "same-origin",
            cache: "no-store",
            signal: controller.signal,
          }
        );

        if (!response.ok) {
          throw new Error(
            "Không thể tải cấu hình hiển thị gia đình."
          );
        }

        const data =
          (await response.json()) as PublicEventsResponse;

        if (
          !data.success ||
          !Array.isArray(data.events)
        ) {
          throw new Error(
            "Dữ liệu hiển thị gia đình không hợp lệ."
          );
        }

        const nextModes: Record<
          GuestSide,
          ParentDisplayMode
        > = {
          groom: "both",
          bride: "both",
        };

        for (const event of data.events) {
          if (
            event.side === "groom" ||
            event.side === "bride"
          ) {
            nextModes[event.side] =
              normalizeDisplayMode(
                event.familyDisplayMode
              );
          }
        }

        if (!controller.signal.aborted) {
          setDisplayModes(nextModes);
        }
      } catch (error) {
        if (controller.signal.aborted) return;

        console.error(
          "[WEDDING FAMILY DISPLAY]",
          error
        );
      }
    }

    void Promise.resolve().then(() => {
      if (!controller.signal.aborted) {
        return fetchDisplayModes();
      }
    });

    return () => controller.abort();
  }, []);

  return displayModes;
}

// =====================================================
// GOOGLE MAPS
// =====================================================

function getValidGoogleMapsUrl(
  mapUrl: string
): string | null {
  const value = mapUrl.trim();

  if (!value) return null;

  try {
    const url = new URL(value);
    const hostname = url.hostname.toLowerCase();

    if (url.protocol !== "https:") {
      return null;
    }

    const isGoogleMaps =
      hostname === "maps.app.goo.gl" ||
      hostname === "maps.google.com" ||
      (
        hostname === "google.com" &&
        url.pathname.startsWith("/maps")
      ) ||
      /^maps\.google\.[a-z.]+$/.test(hostname) ||
      (
        /^www\.google\.[a-z.]+$/.test(hostname) &&
        url.pathname.startsWith("/maps")
      );

    return isGoogleMaps ? url.toString() : null;
  } catch {
    return null;
  }
}

// =====================================================
// DATE HELPERS
// =====================================================

function formatCalendarNote(
  eventDate: string,
  eventTitle: string
): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(eventDate)) {
    return eventTitle;
  }

  const day = Number(eventDate.slice(8, 10));

  return `${day} · ${eventTitle}`;
}

function eventBelongsToCalendar(
  date: string,
  year: number,
  month: number
): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return false;
  }

  return (
    Number(date.slice(0, 4)) === year &&
    Number(date.slice(5, 7)) === month
  );
}

// =====================================================
// SCROLL REVEAL
// =====================================================

function Reveal({
  children,
  delay = 0,
}: {
  children: ReactNode;
  delay?: number;
}) {
  const elementRef = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const element = elementRef.current;

    if (!element) return;

    const reducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;

    if (
      reducedMotion ||
      !("IntersectionObserver" in window)
    ) {
      void Promise.resolve().then(() => {
        setVisible(true);
      });

      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      {
        threshold: 0.08,
        rootMargin: "0px 0px -35px 0px",
      }
    );

    observer.observe(element);

    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={elementRef}
      style={{
        transitionDelay: `${delay}ms`,
      }}
      className={`transition-all duration-1000 ease-out motion-reduce:translate-y-0 motion-reduce:opacity-100 ${
        visible
          ? "translate-y-0 opacity-100"
          : "translate-y-7 opacity-0"
      }`}
    >
      {children}
    </div>
  );
}

// =====================================================
// RING DECORATION
// =====================================================

function RingDecoration() {
  return (
    <div
      aria-hidden="true"
      className="mx-auto flex w-full max-w-[520px] items-center justify-center py-1"
    >
      <svg
        viewBox="0 0 500 100"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="h-[68px] w-full sm:h-[76px] md:h-[88px]"
      >
        <path
          d="M0 70 C35 52 58 86 91 69 C116 56 121 80 146 68 C162 60 170 59 188 63"
          stroke="#B8A27D"
          strokeWidth="1.2"
          opacity="0.55"
        />

        <path
          d="M312 63 C330 59 338 60 354 68 C379 80 384 56 409 69 C442 86 465 52 500 70"
          stroke="#B8A27D"
          strokeWidth="1.2"
          opacity="0.55"
        />

        <ellipse
          cx="220"
          cy="49"
          rx="48"
          ry="25"
          transform="rotate(-13 220 49)"
          stroke="#B8A27D"
          strokeWidth="1.6"
        />

        <ellipse
          cx="220"
          cy="49"
          rx="39"
          ry="18"
          transform="rotate(-13 220 49)"
          stroke="#B8A27D"
          strokeWidth="1"
          opacity="0.65"
        />

        <ellipse
          cx="280"
          cy="49"
          rx="48"
          ry="25"
          transform="rotate(13 280 49)"
          stroke="#B8A27D"
          strokeWidth="1.6"
        />

        <ellipse
          cx="280"
          cy="49"
          rx="39"
          ry="18"
          transform="rotate(13 280 49)"
          stroke="#B8A27D"
          strokeWidth="1"
          opacity="0.65"
        />
      </svg>
    </div>
  );
}

// =====================================================
// SOFT DIVIDER
// =====================================================

function SoftDivider() {
  return (
    <div
      aria-hidden="true"
      className="mx-auto flex max-w-[680px] items-center justify-center gap-4"
    >
      <span className="h-px flex-1 bg-gradient-to-r from-transparent to-[#B8A27D]/40" />

      <span className="text-[12px] text-[#C98792]">
        ♡
      </span>

      <span className="h-px flex-1 bg-gradient-to-l from-transparent to-[#B8A27D]/40" />
    </div>
  );
}

// =====================================================
// COUPLE PORTRAIT
// =====================================================

function CouplePortrait({
  label,
  name,
  image,
}: {
  label: string;
  name: string;
  image: string;
}) {
  return (
    <article className="mx-auto w-full max-w-[470px] text-center">
      <div className="group relative mx-auto aspect-[4/5] w-full overflow-hidden rounded-t-[150px] border border-[#FFFDF8]/90 bg-[#FFFDF8]/55 p-1.5 shadow-[0_18px_45px_rgba(49,86,107,0.08)] sm:p-2 md:shadow-[0_30px_80px_rgba(49,86,107,0.11)]">
        <div className="relative h-full w-full overflow-hidden rounded-t-[145px] bg-[#F8F5F0]">
          <Image
            src={image}
            alt={name}
            fill
            sizes="(max-width: 767px) 44vw, (max-width: 1100px) 42vw, 470px"
            className="object-cover object-center transition-transform duration-[1400ms] ease-out group-hover:scale-[1.04]"
          />

          <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[#213E50]/10 via-transparent to-transparent" />
        </div>
      </div>

      <p className="mt-4 text-[9px] font-medium uppercase tracking-[0.25em] text-[#C98792] sm:mt-6 sm:text-[11px] md:mt-7">
        {label}
      </p>

      <h3 className="font-wedding-serif mt-2 text-[24px] font-normal leading-tight text-[#31566B] sm:text-[32px] md:text-[40px] lg:text-5xl">
        {name}
      </h3>
    </article>
  );
}

// =====================================================
// CALENDAR HEART
// =====================================================

function CalendarHeart({
  day,
  emphasized,
  month,
}: {
  day: number;
  emphasized: boolean;
  month: number;
}) {
  return (
    <div
      className="relative flex h-[40px] w-[44px] items-center justify-center sm:h-[46px] sm:w-[50px] md:h-[52px] md:w-[56px]"
      aria-label={`Ngày ${day} tháng ${month}`}
    >
      <svg
        viewBox="0 0 64 58"
        fill="none"
        className="absolute inset-0 h-full w-full"
        aria-hidden="true"
      >
        <path
          d="M32 52 C27 47 8 34 8 18 C8 9 14 4 22 4 C27 4 31 7 32 11 C34 7 38 4 43 4 C51 4 57 9 57 18 C57 34 38 47 32 52"
          stroke={
            emphasized ? "#C98792" : "#B8A27D"
          }
          strokeWidth={emphasized ? 2.5 : 1.7}
          strokeLinecap="round"
          strokeLinejoin="round"
          fill={emphasized ? "#F8F1EE" : "none"}
        />
      </svg>

      <span
        className={`font-wedding-serif relative -translate-y-[2px] text-[16px] font-medium sm:text-[19px] md:text-[21px] ${
          emphasized
            ? "text-[#A65C70]"
            : "text-[#31566B]"
        }`}
      >
        {day}
      </span>
    </div>
  );
}

// =====================================================
// WEDDING CALENDAR
// =====================================================

function WeddingCalendar({
  guestSide,
}: {
  guestSide: GuestSide;
}) {
  const {
    weddingData,
    weddingEvents,
    weddingLoaded,
  } = useWeddingData();

  const calendar = weddingData.calendar;

  const selectedLocation =
    weddingData.locations[guestSide];

  const personalDay = eventBelongsToCalendar(
    selectedLocation.eventDate,
    calendar.year,
    calendar.month
  )
    ? Number(
        selectedLocation.eventDate.slice(8, 10)
      )
    : -1;

  const calendarNotes = weddingLoaded
    ? weddingEvents
        .filter((event) =>
          eventBelongsToCalendar(
            event.eventDate,
            calendar.year,
            calendar.month
          )
        )
        .sort(
          (a, b) =>
            a.eventDate.localeCompare(b.eventDate)
        )
        .map((event) => ({
          side: event.side,
          text: formatCalendarNote(
            event.eventDate,
            event.eventTitle
          ),
        }))
    : [];

  const weekdays = [
    "T2",
    "T3",
    "T4",
    "T5",
    "T6",
    "T7",
    "CN",
  ];

  const firstDay = new Date(
    Date.UTC(
      calendar.year,
      calendar.month - 1,
      1
    )
  ).getUTCDay();

  const startOffset = (firstDay + 6) % 7;

  const daysInMonth = new Date(
    Date.UTC(
      calendar.year,
      calendar.month,
      0
    )
  ).getUTCDate();

  const cells: Array<number | null> = [
    ...Array.from(
      { length: startOffset },
      () => null
    ),
    ...Array.from(
      { length: daysInMonth },
      (_, index) => index + 1
    ),
  ];

  while (cells.length % 7 !== 0) {
    cells.push(null);
  }

  const highlighted = new Set(
    weddingLoaded
      ? calendarNotes.map((note) => {
          const source = weddingEvents.find(
            (event) =>
              event.side === note.side
          );

          return source
            ? Number(
                source.eventDate.slice(8, 10)
              )
            : -1;
        })
      : []
  );

  return (
    <div className="relative mx-auto min-h-[410px] w-full max-w-[980px] overflow-hidden sm:min-h-[450px] md:min-h-[500px]">
      <div
        className="absolute inset-0 bg-cover bg-center"
        style={{
          backgroundColor: "#EEF4F6",
          backgroundImage: `
            linear-gradient(
              rgba(255,253,248,0.74),
              rgba(255,253,248,0.74)
            ),
            url("${calendar.backgroundImage}")
          `,
        }}
      />

      <div className="pointer-events-none absolute -left-24 top-[10%] h-[280px] w-[280px] rounded-full bg-[#8FB4C7]/10 blur-[90px]" />

      <div className="pointer-events-none absolute -right-24 bottom-[5%] h-[280px] w-[280px] rounded-full bg-[#D9A5AE]/12 blur-[95px]" />

      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_bottom,#EEF4F6_0%,transparent_18%,transparent_76%,#F6F6ED_100%)]" />

      <div className="relative z-10 mx-auto flex min-h-[410px] max-w-[760px] flex-col justify-center px-3 py-7 sm:min-h-[450px] sm:px-8 sm:py-8 md:min-h-[500px] md:px-10 md:py-9">
        <div className="text-center">
          <p className="font-wedding text-[50px] leading-none text-[#587589] sm:text-[64px] md:text-[76px]">
            {calendar.monthLabel}
          </p>

          <p className="font-wedding-serif mt-2 text-[14px] font-medium tracking-[0.24em] text-[#C98792] sm:text-[16px] md:text-[18px]">
            {calendar.year}
          </p>
        </div>

        <div className="mx-auto mt-5 w-full max-w-[650px] sm:mt-6 md:mt-7">
          <div className="grid grid-cols-7">
            {weekdays.map((day) => (
              <div
                key={day}
                className="text-center"
              >
                <span className="font-wedding-serif text-[11px] font-medium text-[#587589] sm:text-[13px] md:text-[15px]">
                  {day}
                </span>
              </div>
            ))}
          </div>

          <div className="mt-2 grid grid-cols-7 sm:mt-3 sm:gap-y-1">
            {cells.map((day, index) => (
              <div
                key={index}
                className="flex h-[40px] items-center justify-center sm:h-[46px] md:h-[52px]"
              >
                {day === null ? null : highlighted.has(
                    day
                  ) ? (
                  <CalendarHeart
                    day={day}
                    month={calendar.month}
                    emphasized={
                      day === personalDay
                    }
                  />
                ) : (
                  <span className="font-wedding-serif text-[15px] text-[#61726D] sm:text-[18px] md:text-[20px]">
                    {day}
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="mx-auto mt-5 flex max-w-[620px] flex-col items-center justify-center gap-1.5 text-center sm:mt-6 sm:flex-row sm:gap-5">
          {calendarNotes.map(
            (note, index) => (
              <div
                key={note.side}
                className="contents"
              >
                {index > 0 && (
                  <span
                    aria-hidden="true"
                    className="hidden h-1.5 w-1.5 rounded-full bg-[#C98792]/75 sm:block"
                  />
                )}

                <span className="font-wedding-serif text-[15px] italic text-[#587589] sm:text-[17px]">
                  {note.text}
                </span>
              </div>
            )
          )}

          {weddingLoaded &&
            calendarNotes.length === 0 && (
              <span className="font-wedding-serif text-[15px] italic text-[#587589]">
                Lịch cưới sẽ được cập nhật
              </span>
            )}
        </div>
      </div>
    </div>
  );
}

// =====================================================
// WEDDING INFORMATION HEADING
// =====================================================

function WeddingInformationHeading() {
  return (
    <div className="mx-auto mb-9 max-w-[760px] text-center sm:mb-11 md:mb-12">
      <div
        aria-hidden="true"
        className="flex items-center justify-center gap-3"
      >
        <span className="h-px w-9 bg-gradient-to-r from-transparent to-[#B8A27D]/65 sm:w-14" />
        <span className="text-[10px] text-[#C98792]">
          ✦
        </span>
        <span className="text-[17px] text-[#C98792]">
          ♡
        </span>
        <span className="text-[10px] text-[#C98792]">
          ✦
        </span>
        <span className="h-px w-9 bg-gradient-to-l from-transparent to-[#B8A27D]/65 sm:w-14" />
      </div>

      <h2 className="font-wedding-serif text-[26px] font-medium uppercase leading-tight tracking-[0.045em] text-[#9B7B4D] sm:text-[32px] md:text-[40px] lg:text-[44px]">
        {wedding.invitation.detailsTitle}
      </h2>

      <div
        aria-hidden="true"
        className="mx-auto mt-5 h-px w-20 bg-gradient-to-r from-transparent via-[#B8A27D] to-transparent"
      />
    </div>
  );
}

// =====================================================
// FAMILY INFORMATION
//
// RESPONSIVE FIX:
//
// Mỗi bên có cùng cấu trúc:
// 1. Tiêu đề - chiều cao đồng nhất.
// 2. Vùng cha mẹ - chiều cao đồng nhất.
// 3. Đường kẻ - vị trí đồng nhất.
// 4. Địa chỉ - bắt đầu cùng một hàng.
//
// Khi có một tên:
// - Căn giữa trong vùng tên.
//
// Khi có hai tên:
// - Hai dòng được căn giữa chung một khối.
//
// Không sử dụng space-y làm thay đổi vị trí
// đường kẻ và địa chỉ giữa hai gia đình.
// =====================================================

function FamilyInformation({
  title,
  father,
  mother,
  address,
  displayMode,
}: FamilyInformationProps) {
  const fatherName = father.trim();
  const motherName = mother.trim();

  const showFather =
    displayMode !== "mother" &&
    fatherName.length > 0;

  const showMother =
    displayMode !== "father" &&
    motherName.length > 0;

  return (
    <div className="flex min-w-0 w-full flex-col items-center px-1 text-center sm:px-4 md:px-7">
      {/* CÙNG CHIỀU CAO TIÊU ĐỀ */}

      <div className="flex h-[42px] w-full items-start justify-center sm:h-[48px] md:h-[54px]">
        <h3 className="font-wedding-serif break-words text-[15px] font-medium uppercase leading-6 tracking-[0.07em] text-[#587589] sm:text-[21px] sm:tracking-[0.12em] md:text-[24px] lg:text-[26px]">
          {title}
        </h3>
      </div>

      {/* 
        VÙNG HIỂN THỊ TÊN CHA MẸ

        Cả hai khối luôn có chiều cao giống nhau.

        Trên mobile cho phép tên dài xuống dòng.
        Không ẩn nội dung và không để tràn cột.
      */}

      <div className="flex h-[116px] w-full min-w-0 items-center justify-center sm:h-[112px] md:h-[116px]">
        <div className="flex w-full min-w-0 flex-col items-center justify-center gap-1 text-center font-wedding-serif text-[12px] leading-[1.55] text-[#61726D] sm:gap-1.5 sm:text-[17px] sm:leading-7 md:text-[19px] md:leading-8 lg:text-[20px]">
          {showFather && (
            <p className="w-full min-w-0 whitespace-normal break-words [overflow-wrap:anywhere]">
              Ông: {fatherName}
            </p>
          )}

          {showMother && (
            <p className="w-full min-w-0 whitespace-normal break-words [overflow-wrap:anywhere]">
              Bà: {motherName}
            </p>
          )}
        </div>
      </div>

      {/* 
        ĐƯỜNG KẺ LUÔN CÙNG HÀNG

        Không phụ thuộc số lượng tên hiển thị.
      */}

      <div className="flex h-[28px] w-full shrink-0 items-center justify-center sm:h-[34px]">
        <span className="h-px w-12 bg-gradient-to-r from-transparent via-[#B8A27D]/55 to-transparent sm:w-16" />
      </div>

      {/* 
        ĐỊA CHỈ

        Hai địa chỉ bắt đầu ở cùng vị trí.
        Tự xuống dòng trên màn hình hẹp.
      */}

      <div className="flex w-full min-w-0 flex-col items-center justify-start pt-2 sm:pt-3">
        <p className="font-wedding-serif mx-auto w-full max-w-[320px] whitespace-normal break-words text-[11px] italic leading-[1.7] text-[#587589]/85 sm:text-[14px] sm:leading-6 md:text-[16px] md:leading-7 lg:text-[17px]">
          {address.trim() ||
            "Địa chỉ sẽ được cập nhật"}
        </p>
      </div>
    </div>
  );
}

// =====================================================
// EVENT DATE
// =====================================================

function RefinedEventDate({
  guestSide,
}: {
  guestSide: GuestSide;
}) {
  const {
    weddingData,
    weddingLoaded,
  } = useWeddingData();

  const event =
    weddingData.locations[guestSide];

  const [year, month, day] =
    event.eventDate.split("-");

  const isOriginalDate =
    weddingLoaded &&
    event.eventDate ===
      originalDates[guestSide];

  return (
    <div className="mx-auto mt-8 w-full max-w-[650px] text-center sm:mt-10">
      <p className="font-wedding-serif text-[12px] font-medium uppercase tracking-[0.11em] text-[#587589] sm:text-[15px] md:text-[17px]">
        {guestSide === "bride"
          ? "Bữa tiệc chung vui tại tư gia nhà gái"
          : "Hôn lễ được cử hành tại tư gia nhà trai"}
      </p>

      <div className="mx-auto mt-5 grid w-full max-w-[520px] grid-cols-[1fr_auto_1fr] items-center gap-3 sm:gap-6 md:gap-8">
        <div className="flex min-w-0 flex-col items-center justify-center gap-3">
          <span className="h-px w-full bg-[#B8A27D]/70" />

          <p className="font-wedding-serif whitespace-nowrap text-[12px] font-medium uppercase tracking-[0.04em] text-[#587589] sm:text-[16px] md:text-[19px]">
            {event.weekdayLabel}
          </p>

          <span className="h-px w-full bg-[#B8A27D]/70" />
        </div>

        <div className="flex items-center justify-center">
          <span className="font-wedding-serif text-[82px] font-light leading-[0.95] text-[#9B7B4D] sm:text-[105px] md:text-[128px]">
            {Number(day) || "--"}
          </span>
        </div>

        <div className="flex min-w-0 flex-col items-center justify-center gap-3">
          <span className="h-px w-full bg-[#B8A27D]/70" />

          <p className="font-wedding-serif whitespace-nowrap text-[13px] font-medium uppercase tracking-[0.07em] text-[#587589] sm:text-[17px] md:text-[20px]">
            {month && year
              ? `${month} . ${year}`
              : "Đang cập nhật"}
          </p>

          <span className="h-px w-full bg-[#B8A27D]/70" />
        </div>
      </div>

      {isOriginalDate && (
        <p className="font-wedding-serif mx-auto mt-4 text-[14px] font-medium italic leading-6 tracking-[0.02em] text-[#61726D] sm:text-[17px] md:text-[19px]">
          ({lunarDates[guestSide]})
        </p>
      )}

      {weddingLoaded &&
        event.time.trim() && (
          <p className="font-wedding-serif mt-3 text-[18px] text-[#31566B] sm:text-[21px]">
            Vào lúc {event.time}
          </p>
        )}

      {weddingLoaded &&
        !event.time.trim() && (
          <p className="font-wedding-serif mt-3 text-[14px] italic text-[#61726D] sm:text-[16px]">
            Giờ tổ chức sẽ được cập nhật
          </p>
        )}
    </div>
  );
}

// =====================================================
// GOOGLE MAPS
// =====================================================

function WeddingMapDirections({
  guestSide,
}: {
  guestSide: GuestSide;
}) {
  const {
    weddingData,
    weddingLoaded,
  } = useWeddingData();

  const location =
    weddingData.locations[guestSide];

  const displayAddress =
    weddingLoaded &&
    location.address.trim()
      ? location.address
      : "Địa chỉ sẽ được cập nhật";

  const mapsUrl = weddingLoaded
    ? getValidGoogleMapsUrl(
        location.mapUrl
      )
    : null;

  return (
    <div className="mx-auto mt-9 max-w-[680px] text-center">
      <p className="font-wedding-serif text-[20px] font-medium uppercase tracking-[0.06em] text-[#587589] sm:text-[24px]">
        {location.title}
      </p>

      <div className="mx-auto mt-4 flex max-w-[640px] items-start justify-center gap-2">
        <MapPin
          size={18}
          strokeWidth={1.5}
          className="mt-1 shrink-0 text-[#C98792]"
        />

        <p className="font-wedding-serif text-[18px] leading-7 text-[#61726D] sm:text-[21px]">
          {displayAddress}
        </p>
      </div>

      {mapsUrl ? (
        <a
          href={mapsUrl}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={`Xem chỉ đường đến ${location.title}`}
          className="group mt-7 inline-flex min-h-[52px] min-w-[210px] items-center justify-center gap-3 rounded-full bg-[#31566B] px-8 text-[11px] font-medium uppercase tracking-[0.15em] text-white shadow-[0_12px_30px_rgba(49,86,107,0.14)] transition-all duration-300 hover:-translate-y-0.5 hover:bg-[#C98792]"
        >
          <Navigation
            size={16}
            strokeWidth={1.6}
          />

          <span>Xem chỉ đường</span>

          <ExternalLink
            size={14}
            strokeWidth={1.5}
            className="opacity-75 transition-transform duration-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
          />
        </a>
      ) : (
        <button
          type="button"
          disabled
          title="Chưa có liên kết Google Maps"
          className="mt-7 inline-flex min-h-[52px] min-w-[210px] cursor-not-allowed items-center justify-center gap-3 rounded-full border border-[#B8A27D]/30 bg-[#B8A27D]/15 px-8 text-[11px] font-medium uppercase tracking-[0.15em] text-[#8A958E]"
        >
          <Navigation
            size={16}
            strokeWidth={1.6}
          />
          <span>Xem chỉ đường</span>
        </button>
      )}
    </div>
  );
}

// =====================================================
// WEDDING DETAILS
// =====================================================

function WeddingDetails({
  guestSide,
}: {
  guestSide: GuestSide;
}) {
  const {
    weddingData,
    weddingEvents,
    weddingLoaded,
  } = useWeddingData();

  const displayModes =
    useFamilyDisplayModes();

  const location =
    weddingData.locations[guestSide];

  const groomActive = weddingEvents.some(
    (event) => event.side === "groom"
  );

  const brideActive = weddingEvents.some(
    (event) => event.side === "bride"
  );

  const groomParents =
    weddingLoaded && groomActive
      ? weddingData.groom.parents
      : {
          father: "",
          mother: "",
        };

  const brideParents =
    weddingLoaded && brideActive
      ? weddingData.bride.parents
      : {
          father: "",
          mother: "",
        };

  const groomAddress =
    weddingLoaded && groomActive
      ? weddingData.locations.groom.address
      : "";

  const brideAddress =
    weddingLoaded && brideActive
      ? weddingData.locations.bride.address
      : "";

  // Chỉ hiện tên khi đã nhận được cấu hình.
  const groomMode: ParentDisplayMode =
    displayModes?.groom ?? "both";

  const brideMode: ParentDisplayMode =
    displayModes?.bride ?? "both";

  return (
    <div className="mx-auto w-full max-w-[980px]">
      <WeddingInformationHeading />

      {/* =====================================
          THÔNG TIN HAI GIA ĐÌNH

          FIX:
          - Hai cột luôn cân nhau.
          - Divider nằm chính giữa.
          - Vùng tên có chiều cao đồng nhất.
          - Địa chỉ nằm cùng một hàng.
          - Không bị lệch nếu một bên chỉ có
            cha hoặc chỉ có mẹ.
      ===================================== */}

      <div className="grid w-full grid-cols-[minmax(0,1fr)_1px_minmax(0,1fr)] items-stretch gap-x-2 sm:gap-x-5 md:gap-x-8">
        {/* NHÀ TRAI */}

        <FamilyInformation
          title="Nhà trai"
          father={
            displayModes
              ? groomParents.father
              : ""
          }
          mother={
            displayModes
              ? groomParents.mother
              : ""
          }
          displayMode={groomMode}
          address={groomAddress}
        />

        {/* ĐƯỜNG PHÂN CÁCH GIỮA HAI BÊN */}

        <div
          aria-hidden="true"
          className="w-px self-stretch bg-gradient-to-b from-transparent via-[#B8A27D]/45 to-transparent"
        />

        {/* NHÀ GÁI */}

        <FamilyInformation
          title="Nhà gái"
          father={
            displayModes
              ? brideParents.father
              : ""
          }
          mother={
            displayModes
              ? brideParents.mother
              : ""
          }
          displayMode={brideMode}
          address={brideAddress}
        />
      </div>

      {/* TÊN CÔ DÂU CHÚ RỂ */}

      <div className="mt-11 text-center">
        <p className="font-wedding-serif text-xs uppercase tracking-[0.28em] text-[#C98792]">
          Chú rể
        </p>

        <p className="font-wedding mt-1 text-[64px] leading-[1.1] text-[#31566B] sm:text-[80px] md:text-[100px]">
          {weddingData.groom.fullName}
        </p>

        <div className="my-2 flex items-center justify-center gap-4">
          <span className="h-px w-12 bg-gradient-to-r from-transparent to-[#B8A27D]/45" />

          <span className="font-wedding-serif text-[28px] italic text-[#C98792]">
            &
          </span>

          <span className="h-px w-12 bg-gradient-to-l from-transparent to-[#B8A27D]/45" />
        </div>

        <p className="font-wedding-serif text-xs uppercase tracking-[0.28em] text-[#C98792]">
          Cô dâu
        </p>

        <p className="font-wedding mt-1 text-[64px] leading-[1.1] text-[#31566B] sm:text-[80px] md:text-[100px]">
          {weddingData.bride.fullName}
        </p>
      </div>

      <div className="my-11">
        <SoftDivider />
      </div>

      {/* THÔNG TIN BUỔI LỄ */}

      <div className="mx-auto max-w-[860px] text-center">
        <h3 className="font-wedding-serif text-[27px] font-medium uppercase tracking-[0.05em] text-[#587589] sm:text-[34px] md:text-[38px]">
          {location.eventTitle}
        </h3>

        <RefinedEventDate
          guestSide={guestSide}
        />

        <WeddingMapDirections
          guestSide={guestSide}
        />

        <div className="mx-auto mt-12 max-w-[620px]">
          <SoftDivider />

          <p className="font-wedding-serif mx-auto mt-5 max-w-[440px] text-[16px] italic leading-7 text-[#587589] sm:text-[19px]">
            {
              weddingData.invitation
                .closingMessage
            }
          </p>
        </div>
      </div>
    </div>
  );
}

// =====================================================
// MAIN COMPONENT
// =====================================================

export default function WeddingInvitation({
  guestName,
  guestSide,
}: WeddingInvitationProps) {
  const {
    weddingData,
    weddingLoaded,
    activeSides,
  } = useWeddingData();

  const displayGuestName =
    guestName.trim() || "Quý khách";

  if (
    weddingLoaded &&
    !activeSides.includes(guestSide)
  ) {
    return null;
  }

  return (
    <section
      id="invitation"
      className="relative -mt-px scroll-mt-16 overflow-hidden bg-[linear-gradient(to_bottom,#F9F8EE_0%,#EEF4F6_24%,#F6F6ED_58%,#FAF4EF_80%,#EEF4F6_100%)] px-5 py-14 sm:px-6 sm:py-16 md:px-8 md:py-20 lg:py-24"
    >
      {/* BACKGROUND DECORATIONS */}

      <div className="pointer-events-none absolute -left-40 top-[15%] h-[430px] w-[430px] rounded-full bg-[#8FB4C7]/12 blur-[130px]" />

      <div className="pointer-events-none absolute -right-40 top-[52%] h-[450px] w-[450px] rounded-full bg-[#D9A5AE]/12 blur-[140px]" />

      <div className="relative z-10 mx-auto max-w-[1200px]">
        {/* INVITATION HEADING */}

        <Reveal>
          <div className="mx-auto max-w-[760px] px-2 text-center">
            <h2 className="font-wedding-serif text-[26px] font-medium uppercase leading-tight tracking-[0.045em] text-[#9B7B4D] sm:text-[32px] md:text-[40px] lg:text-[44px]">
              {weddingData.invitation.title}
            </h2>

            <RingDecoration />

            <p className="font-wedding-serif mx-auto max-w-[560px] text-[18px] leading-8 text-[#9B7B60] sm:text-[21px]">
              Trân trọng kính mời
            </p>

            <h3 className="font-wedding-serif mx-auto mt-2 max-w-[680px] break-words text-[30px] font-medium text-[#31566B] sm:text-[40px] md:text-[46px]">
              {displayGuestName}
            </h3>

            <p className="font-wedding-serif mx-auto mt-3 max-w-[570px] text-[18px] leading-8 text-[#9B7B60] sm:text-[21px]">
              đến chung vui và chứng kiến
              ngày hạnh phúc của chúng mình.
            </p>
          </div>
        </Reveal>

        {/* COUPLE PORTRAITS */}

        <div className="mx-auto mt-12 max-w-[1080px] sm:mt-14 md:mt-16">
          <div className="grid grid-cols-[minmax(0,1fr)_34px_minmax(0,1fr)] items-center gap-1.5 sm:grid-cols-[minmax(0,1fr)_56px_minmax(0,1fr)] sm:gap-3 md:grid-cols-[minmax(0,1fr)_90px_minmax(0,1fr)] md:gap-8 lg:grid-cols-[minmax(0,1fr)_110px_minmax(0,1fr)]">
            <Reveal>
              <CouplePortrait
                label="Chú rể"
                name={
                  weddingData.groom.fullName
                }
                image={
                  weddingData.groom.illustration
                }
              />
            </Reveal>

            <div
              aria-hidden="true"
              className="flex items-center justify-center"
            >
              <span className="flex h-10 w-10 items-center justify-center rounded-full border border-[#C98792]/30 bg-[#FFFDF8]/85 text-[#C98792] shadow-sm sm:h-12 sm:w-12 md:h-16 md:w-16">
                ♥
              </span>
            </div>

            <Reveal delay={150}>
              <CouplePortrait
                label="Cô dâu"
                name={
                  weddingData.bride.fullName
                }
                image={
                  weddingData.bride.illustration
                }
              />
            </Reveal>
          </div>
        </div>

        {/* CALENDAR */}

        <div className="mt-10 sm:mt-14 md:mt-16">
          <Reveal>
            <WeddingCalendar
              guestSide={guestSide}
            />
          </Reveal>
        </div>

        {/* WEDDING INFORMATION */}

        <div className="mt-12 sm:mt-16 md:mt-20">
          <Reveal>
            <WeddingDetails
              guestSide={guestSide}
            />
          </Reveal>
        </div>
      </div>
    </section>
  );
}
