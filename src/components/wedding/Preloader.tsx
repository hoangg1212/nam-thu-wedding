
"use client";

import { useEffect, useState } from "react";
import { wedding } from "@/data/wedding";

export default function Preloader() {
  const [visible, setVisible] = useState(true);
  const [leaving, setLeaving] = useState(false);

  // =========================================
  // PRELOADER TIMING
  // =========================================

  useEffect(() => {
    // Bắt đầu fade-out sau 1.100ms
    const fadeTimer = window.setTimeout(() => {
      setLeaving(true);
    }, 1100);

    // Gỡ Preloader sau 1.800ms
    const removeTimer = window.setTimeout(() => {
      setVisible(false);
    }, 1800);

    return () => {
      window.clearTimeout(fadeTimer);
      window.clearTimeout(removeTimer);
    };
  }, []);

  if (!visible) {
    return null;
  }

  return (
    <div
      role="status"
      aria-label="Đang chuẩn bị thiệp cưới"
      className={`
        fixed inset-0 z-[10000]
        flex min-h-[100svh]
        items-center justify-center
        overflow-hidden
        bg-[#F9F8EE]
        px-5
        transition-all duration-700 ease-in-out
        ${leaving
          ? "pointer-events-none scale-[1.015] opacity-0"
          : "scale-100 opacity-100"
        }
      `}
    >
      {/* =====================================
          BACKGROUND GRADIENT
      ===================================== */}

      <div
        aria-hidden="true"
        className="
          pointer-events-none
          absolute inset-0
          bg-[linear-gradient(145deg,#F8F7EC_0%,#F3F5EF_48%,#EAF2F5_100%)]
        "
      />

      {/* =====================================
          BLUE GLOW - TOP LEFT
      ===================================== */}

      <div
        aria-hidden="true"
        className="
          pointer-events-none
          absolute -left-32 top-[10%]
          h-[350px] w-[350px]
          rounded-full
          bg-[#8FB4C7]/20
          blur-[110px]
          md:h-[480px] md:w-[480px]
        "
      />

      {/* =====================================
          DUSTY ROSE GLOW - BOTTOM RIGHT
      ===================================== */}

      <div
        aria-hidden="true"
        className="
          pointer-events-none
          absolute -right-32 bottom-[5%]
          h-[360px] w-[360px]
          rounded-full
          bg-[#D9A5AE]/20
          blur-[115px]
          md:h-[480px] md:w-[480px]
        "
      />

      {/* =====================================
          CENTER SOFT LIGHT
      ===================================== */}

      <div
        aria-hidden="true"
        className="
          pointer-events-none
          absolute left-1/2 top-1/2
          h-[400px] w-[90%]
          -translate-x-1/2 -translate-y-1/2
          rounded-full
          bg-[#FFFDF8]/55
          blur-[100px]
          md:w-[50%]
        "
      />

      {/* =====================================
          OUTER FRAME
      ===================================== */}

      <div
        aria-hidden="true"
        className="
          pointer-events-none
          absolute inset-5
          rounded-[24px]
          border border-[#B8A27D]/15
          sm:inset-8
          md:inset-10
        "
      />

      {/* =====================================
          TOP DECORATION
      ===================================== */}

      <div
        aria-hidden="true"
        className="
          absolute left-1/2 top-[14%]
          flex -translate-x-1/2
          items-center gap-3
          opacity-80
          md:top-[17%]
        "
      >
        <span
          className="
            h-px w-10
            bg-gradient-to-r
            from-transparent
            to-[#B8A27D]/50
          "
        />

        <span className="text-[11px] text-[#C98792]">
          ♡
        </span>

        <span
          className="
            h-px w-10
            bg-gradient-to-l
            from-transparent
            to-[#B8A27D]/50
          "
        />
      </div>

      {/* =====================================
          MAIN CONTENT
      ===================================== */}

      <div
        className="
          relative z-10
          mx-auto w-full
          max-w-[600px]
          text-center
        "
      >
        {/* SMALL LABEL */}
        <p
          className="
            mb-7
            text-[10px]
            font-medium
            uppercase
            tracking-[0.38em]
            text-[#B97882]
            sm:text-[11px]
          "
        >
          Ngày chung đôi
        </p>

        {/* =====================================
            COUPLE INITIALS
        ===================================== */}

        <div
          className="
            flex items-center
            justify-center
            gap-4 sm:gap-7
          "
        >
          {/* GROOM INITIAL */}
          <span
            className="
              font-wedding
              text-[85px]
              leading-none
              text-[#31566B]
              sm:text-[105px]
              md:text-[125px]
            "
          >
            {wedding.groom.shortName.charAt(0)}
          </span>

          {/* HEART */}
          <div
            className="
              relative
              flex h-12 w-12
              items-center justify-center
              rounded-full
              border border-[#C98792]/25
              bg-[#FFFDF8]/70
              shadow-[0_8px_28px_rgba(49,86,107,0.08)]
              backdrop-blur-md
              sm:h-14 sm:w-14
            "
          >
            <span
              className="
                absolute inset-[4px]
                rounded-full
                border border-[#B8A27D]/20
              "
            />

            <span
              className="
                relative z-10
                text-[17px]
                text-[#C98792]
              "
            >
              ♥
            </span>
          </div>

          {/* BRIDE INITIAL */}
          <span
            className="
              font-wedding
              text-[85px]
              leading-none
              text-[#31566B]
              sm:text-[105px]
              md:text-[125px]
            "
          >
            {wedding.bride.shortName.charAt(0)}
          </span>
        </div>

        {/* =====================================
            FULL NAMES
        ===================================== */}

        <p
          className="
            font-wedding-serif
            mt-6
            text-[18px]
            tracking-[0.06em]
            text-[#587589]
            sm:text-[21px]
          "
        >
          {wedding.groom.fullName}

          <span
            className="
              mx-3
              italic
              text-[#C98792]
            "
          >
            &
          </span>

          {wedding.bride.fullName}
        </p>

        {/* =====================================
            DIVIDER
        ===================================== */}

        <div
          className="
            mx-auto mt-6
            flex items-center
            justify-center gap-3
          "
        >
          <span className="h-px w-10 bg-[#B8A27D]/30" />

          <span className="text-[9px] text-[#C98792]/70">
            ✦
          </span>

          <span className="h-px w-10 bg-[#B8A27D]/30" />
        </div>

        {/* =====================================
            LOADING LINE
        ===================================== */}

        <div
          className="
            relative
            mx-auto mt-7
            h-[2px] w-[170px]
            overflow-hidden
            rounded-full
            bg-[#7A9CAC]/15
            sm:w-[210px]
          "
        >
          <div
            className="
              loader-line
              h-full w-full
              bg-gradient-to-r
              from-transparent
              via-[#B8A27D]
              to-transparent
            "
          />
        </div>

        {/* =====================================
            DATE
        ===================================== */}

        <p
          className="
            font-wedding-serif
            mt-6
            text-[12px]
            font-medium
            tracking-[0.25em]
            text-[#61726D]/75
          "
        >
          {wedding.displayDate}
        </p>
      </div>

      {/* =====================================
          BOTTOM DECORATION
      ===================================== */}

      <div
        aria-hidden="true"
        className="
          absolute bottom-[12%] left-1/2
          flex -translate-x-1/2
          items-center gap-3
        "
      >
        <span className="h-px w-8 bg-[#7A9CAC]/25" />

        <span className="text-[9px] text-[#C98792]/50">
          ♥
        </span>

        <span className="h-px w-8 bg-[#7A9CAC]/25" />
      </div>
    </div>
  );
}
