
"use client";

import {
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  CalendarDays,
  Clock3,
  Heart,
  Sparkles,
} from "lucide-react";

import { type GuestSide } from "@/data/wedding";

import {
  useWeddingData,
} from "@/components/providers/WeddingProvider";

// ======================================================
// NAM & THU - COUNTDOWN
//
// GIAI ĐOẠN 3.11 - FIX ESLINT
//
// CHỨC NĂNG:
// - Đồng bộ ngày giờ từ MongoDB.
// - Hiển thị đúng lễ Nhà trai / Nhà gái.
// - Hỗ trợ guestSide từ WeddingPage.
// - Hỗ trợ tham số URL ?side=.
// - Không dùng giờ giả định 00:00.
// - Không đếm ngược khi giờ chưa xác nhận.
// - Tự cập nhật bộ đếm mỗi giây.
// - Ẩn section khi sự kiện không hoạt động.
//
// ĐÃ SỬA:
// - react-hooks/set-state-in-effect.
// - Không gọi setUrlSide đồng bộ trong effect.
// - Giữ nguyên hiệu ứng và giao diện.
// ======================================================

// ======================================================
// TYPES
// ======================================================

interface CountdownProps {
  guestSide?: GuestSide;
}

interface TimeRemaining {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  finished: boolean;
}

// ======================================================
// CONSTANTS
// ======================================================

const WEDDING_TIMEZONE = "+07:00";

const SECOND = 1000;
const MINUTE = 60 * SECOND;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

// ======================================================
// DATE HELPERS
// ======================================================

// Kiểm tra giờ tổ chức theo HH:mm.
// Không chấp nhận giờ không hợp lệ.
function normalizeWeddingTime(
  time: string
): string | null {
  const value = time.trim();

  if (
    !/^([01]\d|2[0-3]):[0-5]\d$/.test(value)
  ) {
    return null;
  }

  return value;
}

// ======================================================
// VALIDATE DATE
// ======================================================

function isValidWeddingDate(
  date: string
): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return false;
  }

  const [year, month, day] = date
    .split("-")
    .map(Number);

  const check = new Date(
    Date.UTC(year, month - 1, day)
  );

  return (
    check.getUTCFullYear() === year &&
    check.getUTCMonth() === month - 1 &&
    check.getUTCDate() === day
  );
}

// ======================================================
// TARGET TIMESTAMP
//
// Chỉ tạo timestamp khi:
// - Ngày tổ chức hợp lệ.
// - Giờ tổ chức hợp lệ.
// - API đã xác nhận giờ tổ chức.
//
// Tuyệt đối không tự đặt 00:00.
// ======================================================

function getTargetTimestamp(
  eventDate: string,
  eventTime: string
): number | null {
  if (!isValidWeddingDate(eventDate)) {
    return null;
  }

  const validTime =
    normalizeWeddingTime(eventTime);

  if (!validTime) {
    return null;
  }

  const timestamp = new Date(
    `${eventDate}T${validTime}:00${WEDDING_TIMEZONE}`
  ).getTime();

  return Number.isFinite(timestamp)
    ? timestamp
    : null;
}

// ======================================================
// CALCULATE TIME REMAINING
// ======================================================

function calculateTimeRemaining(
  targetTimestamp: number,
  currentTimestamp: number
): TimeRemaining {
  if (
    !Number.isFinite(targetTimestamp) ||
    currentTimestamp >= targetTimestamp
  ) {
    return {
      days: 0,
      hours: 0,
      minutes: 0,
      seconds: 0,
      finished: true,
    };
  }

  const difference =
    targetTimestamp - currentTimestamp;

  return {
    days: Math.floor(
      difference / DAY
    ),

    hours: Math.floor(
      (difference % DAY) / HOUR
    ),

    minutes: Math.floor(
      (difference % HOUR) / MINUTE
    ),

    seconds: Math.floor(
      (difference % MINUTE) / SECOND
    ),

    finished: false,
  };
}

// ======================================================
// DISPLAY HELPERS
// ======================================================

function formatDisplayDate(
  date: string
): string {
  if (!isValidWeddingDate(date)) {
    return "Ngày tổ chức sẽ được cập nhật";
  }

  const [year, month, day] =
    date.split("-");

  return `${day}.${month}.${year}`;
}

function formatNumber(
  value: number
): string {
  return String(value).padStart(2, "0");
}

// ======================================================
// URL SIDE HELPERS
//
// Mặc định hiển thị Nhà gái.
// Nếu URL có ?side=groom hoặc ?side=bride
// thì sử dụng bên tương ứng.
//
// Việc đọc URL thực hiện ở client.
// ======================================================

function getSideFromUrl(): GuestSide {
  if (typeof window === "undefined") {
    return "bride";
  }

  const params = new URLSearchParams(
    window.location.search
  );

  const value = params.get("side");

  if (
    value === "groom" ||
    value === "bride"
  ) {
    return value;
  }

  return "bride";
}

// ======================================================
// DECORATIVE DIVIDER
// ======================================================

function CountdownDivider() {
  return (
    <div
      aria-hidden="true"
      className="
        mx-auto flex
        max-w-[260px]
        items-center justify-center
        gap-4
      "
    >
      <span
        className="
          h-px w-16
          bg-gradient-to-r
          from-transparent
          to-[#B8A27D]/60
        "
      />

      <Heart
        size={15}
        strokeWidth={1.3}
        className="text-[#C98792]"
      />

      <span
        className="
          h-px w-16
          bg-gradient-to-l
          from-transparent
          to-[#B8A27D]/60
        "
      />
    </div>
  );
}

// ======================================================
// DECORATIVE RINGS
//
// Trang trí hai chiếc nhẫn cưới.
// Giữ nguyên SVG, màu sắc và kích thước.
// ======================================================

function CountdownRings() {
  return (
    <div
      aria-hidden="true"
      className="
        mx-auto mb-3
        w-full max-w-[260px]
      "
    >
      <svg
        viewBox="0 0 300 90"
        fill="none"
        className="h-[65px] w-full"
      >
        <path
          d="M0 62 C45 43 66 72 98 56"
          stroke="#B8A27D"
          strokeWidth="1.1"
          opacity="0.6"
        />

        <path
          d="M202 56 C234 72 255 43 300 62"
          stroke="#B8A27D"
          strokeWidth="1.1"
          opacity="0.6"
        />

        <ellipse
          cx="130"
          cy="42"
          rx="37"
          ry="24"
          transform="rotate(-15 130 42)"
          stroke="#B8A27D"
          strokeWidth="1.8"
        />

        <ellipse
          cx="130"
          cy="42"
          rx="29"
          ry="17"
          transform="rotate(-15 130 42)"
          stroke="#B8A27D"
          strokeWidth="1"
          opacity="0.6"
        />

        <ellipse
          cx="170"
          cy="42"
          rx="37"
          ry="24"
          transform="rotate(15 170 42)"
          stroke="#B8A27D"
          strokeWidth="1.8"
        />

        <ellipse
          cx="170"
          cy="42"
          rx="29"
          ry="17"
          transform="rotate(15 170 42)"
          stroke="#B8A27D"
          strokeWidth="1"
          opacity="0.6"
        />

        <path
          d="M150 12 C146 6 136 9 138 17 C140 23 150 29 150 29 C150 29 160 23 162 17 C164 9 154 6 150 12Z"
          fill="#C98792"
          opacity="0.8"
        />
      </svg>
    </div>
  );
}

// ======================================================
// COUNTDOWN UNIT
//
// Một ô hiển thị:
// - Số ngày.
// - Số giờ.
// - Số phút.
// - Số giây.
//
// Khi chưa có dữ liệu sẽ hiển thị "--".
// ======================================================

interface CountdownUnitProps {
  value: number | null;
  label: string;
}

function CountdownUnit({
  value,
  label,
}: CountdownUnitProps) {
  return (
    <div
      className="
        group relative
        flex min-h-[100px]
        flex-col
        items-center justify-center
        overflow-hidden
        rounded-[16px]
        border border-[#B8A27D]/30
        bg-[#FFFDF8]/75
        px-1 py-4
        shadow-[0_12px_35px_rgba(49,86,107,0.055)]
        backdrop-blur-sm
        transition-all duration-500
        hover:-translate-y-1
        hover:border-[#B8A27D]/65
        hover:shadow-[0_20px_45px_rgba(49,86,107,0.10)]
        sm:min-h-[130px]
        sm:rounded-[22px]
        sm:px-4 sm:py-6
        md:min-h-[148px]
        md:rounded-[26px]
      "
    >
      {/* Viền trang trí bên trong */}

      <div
        aria-hidden="true"
        className="
          pointer-events-none
          absolute inset-[5px]
          rounded-[12px]
          border border-[#B8A27D]/10
          sm:rounded-[18px]
          md:rounded-[21px]
        "
      />

      {/* Giá trị thời gian */}

      <span
        className="
          relative z-10
          font-wedding-serif
          text-[34px]
          font-light
          leading-none
          tabular-nums
          text-[#31566B]
          sm:text-[52px]
          md:text-[65px]
          lg:text-[76px]
        "
      >
        {value === null
          ? "--"
          : formatNumber(value)}
      </span>

      {/* Đường phân cách */}

      <span
        aria-hidden="true"
        className="
          relative z-10
          my-3 h-px w-6
          bg-[#B8A27D]/45
          sm:my-4 sm:w-9
        "
      />

      {/* Nhãn */}

      <span
        className="
          relative z-10
          text-[9px]
          font-medium uppercase
          tracking-[0.12em]
          text-[#9B7B4D]
          sm:text-[10px]
          sm:tracking-[0.19em]
          md:text-[11px]
        "
      >
        {label}
      </span>
    </div>
  );
}

// ======================================================
// WEDDING DATE INFORMATION
//
// Hiển thị:
// - Thứ trong tuần.
// - Ngày tổ chức.
// - Giờ tổ chức nếu đã xác nhận.
//
// Dữ liệu địa điểm lấy từ WeddingProvider.
// ======================================================

function CountdownEventInfo({
  guestSide,
  eventDate,
  eventTime,
}: {
  guestSide: GuestSide;
  eventDate: string;
  eventTime: string;
}) {
  const {
    weddingData,
  } = useWeddingData();

  const location =
    weddingData.locations[guestSide];

  const validTime =
    normalizeWeddingTime(eventTime);

  return (
    <div
      className="
        mt-9 flex flex-wrap
        items-center justify-center
        gap-x-7 gap-y-3
        sm:mt-11
      "
    >
      {/* Ngày tổ chức */}

      <div
        className="
          inline-flex
          items-center gap-2.5
          text-[#587589]
        "
      >
        <CalendarDays
          size={17}
          strokeWidth={1.5}
        />

        <span
          className="
            font-wedding-serif
            text-[15px]
            sm:text-[18px]
          "
        >
          {location.weekdayLabel},{" "}
          {formatDisplayDate(eventDate)}
        </span>
      </div>

      {/* Giờ tổ chức */}

      {validTime && (
        <div
          className="
            inline-flex
            items-center gap-2.5
            text-[#587589]
          "
        >
          <Clock3
            size={17}
            strokeWidth={1.5}
          />

          <span
            className="
              font-wedding-serif
              text-[15px]
              sm:text-[18px]
            "
          >
            {validTime}
          </span>
        </div>
      )}
    </div>
  );
}

// ======================================================
// COUNTDOWN CONTENT
//
// Chỉ đếm khi:
// - WeddingProvider đã tải dữ liệu.
// - Ngày cưới hợp lệ.
// - Giờ cưới đã được xác nhận.
//
// Khi không có giờ hợp lệ:
// - Hiển thị --.
// - Không tạo mốc thời gian 00:00.
// ======================================================

function CountdownContent({
  guestSide,
}: {
  guestSide: GuestSide;
}) {
  const {
    weddingData,
    weddingLoaded,
    weddingLoading,
  } = useWeddingData();

  const location =
    weddingData.locations[guestSide];

  // ==================================================
  // VALIDATE EVENT
  // ==================================================

  const hasValidEvent =
    weddingLoaded &&
    isValidWeddingDate(
      location.eventDate
    );

  const validTime = hasValidEvent
    ? normalizeWeddingTime(location.time)
    : null;

  // ==================================================
  // TARGET TIMESTAMP
  //
  // Chỉ tính lại khi ngày/giờ thay đổi.
  // ==================================================

  const targetTimestamp = useMemo(
    () =>
      validTime
        ? getTargetTimestamp(
            location.eventDate,
            validTime
          )
        : null,
    [location.eventDate, validTime]
  );

  // ==================================================
  // CURRENT TIMESTAMP
  //
  // Khởi tạo null để tránh hydration mismatch.
  // Sau khi mount, cập nhật mỗi giây.
  // ==================================================

  const [
    currentTimestamp,
    setCurrentTimestamp,
  ] = useState<number | null>(null);

  useEffect(() => {
    if (targetTimestamp === null) {
      return;
    }

    // Cập nhật thời gian thực.
    const updateTime = () => {
      setCurrentTimestamp(Date.now());
    };

    // Cập nhật lần đầu bằng microtask.
    // Sau đó tiếp tục chạy mỗi giây.
    let cancelled = false;

    void Promise.resolve().then(() => {
      if (!cancelled) {
        updateTime();
      }
    });

    const timer = window.setInterval(
      updateTime,
      1000
    );

    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [targetTimestamp]);

  // ==================================================
  // TIME REMAINING
  // ==================================================

  const remaining =
    currentTimestamp !== null &&
    targetTimestamp !== null
      ? calculateTimeRemaining(
          targetTimestamp,
          currentTimestamp
        )
      : null;

  const finished =
    remaining?.finished ?? false;

  // ==================================================
  // RENDER COUNTDOWN
  // ==================================================

  return (
    <div
      className="
        relative z-10
        mx-auto max-w-[1050px]
        text-center
      "
    >
      {/* ==========================================
          DECORATIVE RINGS
      ========================================== */}

      <CountdownRings />

      {/* ==========================================
          EYEBROW
      ========================================== */}

      <p
        className="
          text-[10px]
          font-medium uppercase
          tracking-[0.3em]
          text-[#C98792]
          sm:text-[12px]
          sm:tracking-[0.36em]
        "
      >
        COUNTING DOWN TO FOREVER
      </p>

      {/* ==========================================
          MAIN HEADING
      ========================================== */}

      <h2
        className="
          font-wedding-serif
          mx-auto mt-4
          max-w-[900px]
          text-[35px]
          font-light
          leading-[1.12]
          tracking-[-0.025em]
          text-[#31566B]
          sm:text-[48px]
          md:text-[62px]
          lg:text-[76px]
        "
      >
        {finished
          ? "Ngày Hạnh Phúc Đã Đến"
          : "Đếm Ngược Ngày Hạnh Phúc"}
      </h2>

      {/* ==========================================
          DECORATIVE DIVIDER
      ========================================== */}

      <div className="mt-6">
        <CountdownDivider />
      </div>

      {/* ==========================================
          MESSAGE
      ========================================== */}

      <p
        className="
          font-wedding-serif
          mx-auto mt-6
          max-w-[660px]
          text-[16px]
          leading-7
          text-[#61726D]
          sm:text-[19px]
          sm:leading-8
          md:text-[21px]
          md:leading-9
        "
      >
        {finished
          ? "Hôm nay là ngày đặc biệt mà chúng mình đã mong chờ. Xin cảm ơn những người thân yêu đã cùng sẻ chia niềm hạnh phúc này."
          : "Từng ngày trôi qua, chúng mình lại gần hơn với khoảnh khắc bắt đầu một hành trình mới, nơi hai trái tim cùng chung nhịp đập."}
      </p>

      {/* ==========================================
          EVENT TITLE
      ========================================== */}

      <div
        className="
          mt-7 inline-flex
          items-center justify-center
          gap-2.5
          rounded-full
          border border-[#B8A27D]/35
          bg-[#FFFDF8]/60
          px-5 py-2.5
          sm:mt-8
        "
      >
        <Heart
          size={13}
          fill="currentColor"
          strokeWidth={1}
          className="text-[#C98792]"
        />

        <span
          className="
            font-wedding-serif
            text-[13px]
            text-[#587589]
            sm:text-[16px]
          "
        >
          {location.eventTitle}
          {" – "}
          {location.title}
        </span>
      </div>

      {/* ==========================================
          COUNTDOWN BOXES
      ========================================== */}

      <div
        className="
          mx-auto mt-10
          grid max-w-[850px]
          grid-cols-4
          gap-2
          sm:mt-12
          sm:gap-4
          md:mt-14
          md:gap-5
        "
      >
        <CountdownUnit
          value={
            remaining?.days ?? null
          }
          label="Ngày"
        />

        <CountdownUnit
          value={
            remaining?.hours ?? null
          }
          label="Giờ"
        />

        <CountdownUnit
          value={
            remaining?.minutes ?? null
          }
          label="Phút"
        />

        <CountdownUnit
          value={
            remaining?.seconds ?? null
          }
          label="Giây"
        />
      </div>

      {/* ==========================================
          WEDDING DATE
      ========================================== */}

      <CountdownEventInfo
        guestSide={guestSide}
        eventDate={location.eventDate}
        eventTime={validTime ?? ""}
      />

      {/* ==========================================
          UNCONFIRMED WEDDING TIME
      ========================================== */}

      {!validTime && (
        <p
          className="
            font-wedding-serif
            mx-auto mt-4
            max-w-[540px]
            text-[12px]
            italic leading-5
            text-[#61726D]/70
            sm:text-[14px]
          "
        >
          {weddingLoading
            ? "Đang tải thông tin ngày cưới..."
            : "Giờ tổ chức sẽ được cập nhật sau khi xác nhận."}
        </p>
      )}

      {/* ==========================================
          CLOSING ORNAMENT
      ========================================== */}

      <div
        aria-hidden="true"
        className="
          mt-5 flex
          items-center justify-center
          gap-3
          text-[#B8A27D]/70
        "
      >
        <span className="h-px w-8 bg-current" />

        <Sparkles
          size={14}
          strokeWidth={1.1}
        />

        <span className="h-px w-8 bg-current" />
      </div>
    </div>
  );
}

// ======================================================
// MAIN COUNTDOWN
//
// Ưu tiên:
// 1. guestSide từ WeddingPage.
// 2. Tham số ?side= trong URL.
// 3. Mặc định Nhà gái.
//
// FIX ESLINT:
// - Không setUrlSide đồng bộ trong useEffect.
// - Dùng microtask để cập nhật URL side.
// - Cleanup ngăn state update khi effect
//   không còn hiệu lực.
// ======================================================

export default function Countdown({
  guestSide,
}: CountdownProps) {
  // ==================================================
  // URL SIDE STATE
  //
  // Mặc định "bride" giữ kết quả render ban đầu
  // đồng nhất giữa server và client.
  // ==================================================

  const [
    urlSide,
    setUrlSide,
  ] = useState<GuestSide>("bride");

  // ==================================================
  // FIX ESLINT TẠI DÒNG 768
  //
  // CODE CŨ:
  //
  // useEffect(() => {
  //   if (guestSide) return;
  //
  //   const params = new URLSearchParams(
  //     window.location.search
  //   );
  //
  //   const value = params.get("side");
  //
  //   if (value === "groom" || value === "bride") {
  //     setUrlSide(value);
  //   }
  // }, [guestSide]);
  //
  // CODE MỚI:
  // - Chỉ đọc URL khi không có guestSide.
  // - Đưa setUrlSide vào microtask.
  // - Cleanup chống cập nhật state
  //   khi effect đã kết thúc.
  // ==================================================

  useEffect(() => {
    if (guestSide) {
      return;
    }

    let cancelled = false;

    void Promise.resolve().then(() => {
      if (cancelled) {
        return;
      }

      const nextSide = getSideFromUrl();

      setUrlSide((current) =>
        current === nextSide
          ? current
          : nextSide
      );
    });

    return () => {
      cancelled = true;
    };
  }, [guestSide]);

  // ==================================================
  // EFFECTIVE SIDE
  // ==================================================

  const effectiveSide =
    guestSide ?? urlSide;

  // ==================================================
  // WEDDING DATA
  // ==================================================

  const {
    weddingLoaded,
    activeSides,
  } = useWeddingData();

  // ==================================================
  // ẨN SECTION NẾU SỰ KIỆN KHÔNG HOẠT ĐỘNG
  //
  // Khi Admin tắt lễ Nhà trai/Nhà gái,
  // WeddingProvider sẽ loại bỏ bên đó khỏi
  // danh sách activeSides.
  // ==================================================

  if (
    weddingLoaded &&
    !activeSides.includes(effectiveSide)
  ) {
    return null;
  }

  // ==================================================
  // MAIN RENDER
  // ==================================================

  return (
    <section
      id="countdown"
      className="
        relative -mt-px
        scroll-mt-16
        overflow-hidden
        bg-[linear-gradient(to_bottom,#FAF3EF_0%,#FAF3EF_20%,#F9F5ED_55%,#F9F8EE_100%)]
        px-4
        pb-16 pt-16
        sm:px-6
        sm:pb-20 sm:pt-20
        md:px-8
        md:pb-24 md:pt-24
        lg:pb-28 lg:pt-28
      "
    >
      {/* ==========================================
          BACKGROUND ROSE GLOW
      ========================================== */}

      <div
        aria-hidden="true"
        className="
          pointer-events-none
          absolute -left-[180px]
          top-[12%]
          h-[440px] w-[440px]
          rounded-full
          bg-[#D9A5AE]/10
          blur-[145px]
        "
      />

      {/* ==========================================
          BACKGROUND SAGE GLOW
      ========================================== */}

      <div
        aria-hidden="true"
        className="
          pointer-events-none
          absolute -right-[180px]
          bottom-[10%]
          h-[470px] w-[470px]
          rounded-full
          bg-[#B6C8B8]/15
          blur-[150px]
        "
      />

      {/* ==========================================
          CENTRAL GLOW
      ========================================== */}

      <div
        aria-hidden="true"
        className="
          pointer-events-none
          absolute left-1/2 top-1/2
          h-[550px] w-[65%]
          -translate-x-1/2
          -translate-y-1/2
          rounded-full
          bg-white/25
          blur-[130px]
        "
      />

      {/* ==========================================
          COUNTDOWN CONTENT
      ========================================== */}

      <CountdownContent
        guestSide={effectiveSide}
      />
    </section>
  );
}
