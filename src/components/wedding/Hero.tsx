
"use client";

import { useWedding } from "@/components/providers/WeddingProvider";

// ======================================================
// NAM & THU - HERO
//
// Dữ liệu ngày cưới lấy từ WeddingProvider.
// Giữ nguyên giao diện và hiệu ứng đã hoàn thiện.
// ======================================================

// ==========================================
// RING DECORATION
// ==========================================

function RingDecoration() {
  return (
    <div
      aria-hidden="true"
      className="
        mx-auto
        flex w-full
        max-w-[420px]
        items-center justify-center
      "
    >
      <svg
        viewBox="0 0 500 100"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="
          h-[56px] w-full
          overflow-visible
          sm:h-[62px]
          md:h-[70px]
          lg:h-[74px]
        "
      >
        {/* ĐƯỜNG TRANG TRÍ BÊN TRÁI */}
        <path
          d="
            M0 64
            C34 51 60 76 92 64
            C116 55 128 68 150 62
            C165 58 177 57 190 61
          "
          stroke="#E6D2B0"
          strokeWidth="1.2"
          strokeLinecap="round"
          opacity="0.82"
        />

        {/* ĐƯỜNG TRANG TRÍ BÊN PHẢI */}
        <path
          d="
            M310 61
            C323 57 335 58 350 62
            C372 68 384 55 408 64
            C440 76 466 51 500 64
          "
          stroke="#E6D2B0"
          strokeWidth="1.2"
          strokeLinecap="round"
          opacity="0.82"
        />

        {/* NHẪN TRÁI */}
        <ellipse
          cx="220"
          cy="49"
          rx="47"
          ry="24"
          transform="rotate(-12 220 49)"
          stroke="#E6D2B0"
          strokeWidth="1.7"
        />

        <ellipse
          cx="220"
          cy="49"
          rx="38"
          ry="17"
          transform="rotate(-12 220 49)"
          stroke="#E6D2B0"
          strokeWidth="1"
          opacity="0.5"
        />

        {/* NHẪN PHẢI */}
        <ellipse
          cx="280"
          cy="49"
          rx="47"
          ry="24"
          transform="rotate(12 280 49)"
          stroke="#E6D2B0"
          strokeWidth="1.7"
        />

        <ellipse
          cx="280"
          cy="49"
          rx="38"
          ry="17"
          transform="rotate(12 280 49)"
          stroke="#E6D2B0"
          strokeWidth="1"
          opacity="0.5"
        />

        {/* ĐIỂM NHẤN */}
        <circle
          cx="250"
          cy="24"
          r="2"
          fill="#F2D8DC"
          opacity="0.9"
        />

        <circle
          cx="250"
          cy="75"
          r="1.5"
          fill="#E6D2B0"
          opacity="0.75"
        />
      </svg>
    </div>
  );
}

// ==========================================
// DECORATIVE LINE
// ==========================================

function DecorativeLine() {
  return (
    <div
      aria-hidden="true"
      className="
        mx-auto mt-5
        flex max-w-[180px]
        items-center justify-center
        gap-3
      "
    >
      <span
        className="
          h-px flex-1
          bg-gradient-to-r
          from-transparent
          to-[#E6D2B0]/80
        "
      />

      <span
        className="
          h-[5px] w-[5px]
          rotate-45
          border border-[#F2D8DC]/90
        "
      />

      <span
        className="
          h-px flex-1
          bg-gradient-to-l
          from-transparent
          to-[#E6D2B0]/80
        "
      />
    </div>
  );
}

// ==========================================
// HERO COMPONENT
// ==========================================

export default function Hero() {
  // ==================================================
  // DỮ LIỆU ĐỘNG TỪ MONGODB QUA PROVIDER
  // ==================================================

  const {
    invitationOpened,
    weddingData,
  } = useWedding();

  // Giữ nguyên cấu trúc WeddingData,
  // chỉ thay nguồn lấy dữ liệu.
  const wedding = weddingData;
  const hero = wedding.heroSection;

  return (
    <section
      id="home"
      className="wedding-hero-new"
      aria-label="Giới thiệu lễ cưới"
    >
      {/* BACKGROUND IMAGE - GIỮ NGUYÊN */}
      <div className="wedding-hero-background">
        <div
          className="wedding-hero-image"
          style={{
            backgroundImage: `url("${wedding.heroImage}")`,
          }}
        />
      </div>

      {/* OVERLAY - GIỮ NGUYÊN */}
      <div className="wedding-hero-overlay" />
      <div className="wedding-hero-blue-glow" />

      {/* CONTENT */}
      <div
        className={`
          relative z-10
          mx-auto flex
          min-h-[100svh]
          w-full max-w-[1440px]
          items-center justify-center
          px-5 pb-12 pt-24
          text-center
          transition-all duration-1000 ease-out
          sm:px-6 sm:pb-14
          md:px-8 md:pb-16 md:pt-28
          ${invitationOpened
            ? "translate-y-0 opacity-100"
            : "translate-y-8 opacity-0"
          }
        `}
      >
        <div
          className="
            mx-auto w-full
            max-w-[590px]
            sm:max-w-[640px]
            md:max-w-[690px]
            lg:max-w-[740px]
          "
        >
          {/* EYEBROW */}
          <div
            className="
              flex items-center
              justify-center gap-3
            "
          >
            <span
              className="
                h-px w-6
                bg-gradient-to-r
                from-transparent
                to-[#F2DEC6]/85
                sm:w-9 md:w-11
              "
            />

            <span
              className="
                h-[4px] w-[4px]
                rounded-full
                bg-[#F2D8DC]/95
              "
            />

            <p
              className="
                text-[9px] font-medium
                uppercase tracking-[0.26em]
                text-[#FFF9F2]
                sm:text-[10px]
                sm:tracking-[0.32em]
                md:text-[11px]
              "
              style={{
                textShadow:
                  "0 2px 10px rgba(0,0,0,0.32)",
              }}
            >
              {hero.eyebrow}
            </p>

            <span
              className="
                h-[4px] w-[4px]
                rounded-full
                bg-[#F2D8DC]/95
              "
            />

            <span
              className="
                h-px w-6
                bg-gradient-to-l
                from-transparent
                to-[#F2DEC6]/85
                sm:w-9 md:w-11
              "
            />
          </div>

          {/* RING DECORATION */}
          <div className="mt-3 sm:mt-4 md:mt-5">
            <RingDecoration />
          </div>

          {/* COUPLE NAMES */}
          <h1
            className="
              font-wedding
              -mt-1 flex flex-wrap
              items-center justify-center
              gap-x-3 gap-y-1
              text-[58px]
              leading-[0.92]
              text-[#FFFDF9]
              sm:text-[74px]
              md:gap-x-4 md:text-[90px]
              lg:text-[102px]
              xl:text-[110px]
            "
            style={{
              textShadow:
                "0 4px 18px rgba(0,0,0,0.32), 0 2px 8px rgba(0,0,0,0.20)",
            }}
          >
            {/* GROOM */}
            <span>{wedding.groom.shortName}</span>

            {/* AMPERSAND */}
            <span
              className="
                relative flex
                h-10 w-10 shrink-0
                items-center justify-center
                rounded-full
                border border-[#F2DEC6]/45
                bg-white/18
                font-wedding-serif
                text-[13px] font-normal
                italic text-[#F2DEC6]
                shadow-[0_8px_20px_rgba(0,0,0,0.10)]
                backdrop-blur-[2px]
                sm:h-11 sm:w-11 sm:text-sm
                md:h-12 md:w-12 md:text-base
              "
            >
              <span
                className="
                  absolute inset-[4px]
                  rounded-full
                  border border-white/12
                "
              />

              <span className="relative z-10">&</span>
            </span>

            {/* BRIDE */}
            <span>{wedding.bride.shortName}</span>
          </h1>

          {/* DECORATIVE LINE */}
          <DecorativeLine />

          {/* LOVE QUOTE */}
          <p
            className="
              font-wedding-serif
              mx-auto mt-4
              max-w-[540px]
              text-[16px]
              font-normal italic
              leading-7
              text-[#FFF8F2]
              sm:text-lg sm:leading-8
              md:mt-5 md:max-w-[590px]
              md:text-xl md:leading-9
            "
            style={{
              textShadow:
                "0 3px 14px rgba(0,0,0,0.35)",
            }}
          >
            “{hero.quote}”
          </p>

          {/* DATE */}
          <div
            className="
              mx-auto my-5
              flex max-w-[340px]
              items-center justify-center
              gap-3
              sm:my-6 sm:gap-4
              md:my-7
            "
          >
            <span
              className="
                h-px flex-1
                bg-gradient-to-r
                from-transparent
                to-[#F2DEC6]/80
              "
            />

            <div
              className="
                rounded-full
                border border-[#F2DEC6]/45
                bg-white/16
                px-4 py-2
                shadow-[0_8px_22px_rgba(0,0,0,0.10)]
                backdrop-blur-[2px]
                sm:px-5
              "
            >
              <p
                className="
                  font-wedding-serif
                  whitespace-nowrap
                  text-[12px]
                  font-semibold
                  tracking-[0.18em]
                  text-[#FFFDF8]
                  sm:text-[13px]
                  sm:tracking-[0.22em]
                  md:text-[14px]
                  md:tracking-[0.25em]
                "
                style={{
                  textShadow:
                    "0 2px 10px rgba(0,0,0,0.28)",
                }}
              >
                {wedding.displayDate}
              </p>
            </div>

            <span
              className="
                h-px flex-1
                bg-gradient-to-l
                from-transparent
                to-[#F2DEC6]/80
              "
            />
          </div>

          {/* CTA */}
          <a
            href={hero.ctaHref}
            className="
              group inline-flex
              min-h-[48px]
              items-center justify-center
              gap-3 rounded-full
              border border-[#FFF8F0]/70
              bg-[#FFFDF8]/94
              px-6 py-3
              text-[9px] font-semibold
              uppercase tracking-[0.16em]
              text-[#2F4D45]
              shadow-[0_14px_34px_rgba(0,0,0,0.14)]
              transition-all duration-300
              hover:-translate-y-0.5
              hover:border-[#B97882]
              hover:bg-[#B97882]
              hover:text-white
              sm:min-h-[50px]
              sm:px-7 sm:text-[10px]
              md:px-8 md:text-[11px]
            "
          >
            <span>{hero.ctaText}</span>

            <span
              className="
                text-[15px]
                transition-transform duration-300
                group-hover:translate-y-1
              "
            >
              ↓
            </span>
          </a>
        </div>
      </div>

      {/* BOTTOM TRANSITION */}
      <div
        className="
          pointer-events-none
          absolute bottom-0 left-0
          z-[5] h-16 w-full
          bg-gradient-to-t
          from-[#F9F8EE]/58
          to-transparent
          md:h-20
        "
      />
    </section>
  );
}
