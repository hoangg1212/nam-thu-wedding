
"use client";

import Image from "next/image";

import {
  useEffect,
  useRef,
  useState,
} from "react";

import { Heart } from "lucide-react";
import { wedding } from "@/data/wedding";

// ======================================================
// NAM & THU - THANK YOU SECTION
//
// FIX ESLINT:
// - react-hooks/set-state-in-effect.
//
// GIỮ NGUYÊN:
// - Hiệu ứng Scroll Reveal.
// - Hỗ trợ prefers-reduced-motion.
// - Ảnh nền từ wedding.ts.
// - Lớp phủ gradient.
// - Khung ảnh và đường viền trang trí.
// - Nội dung lời cảm ơn.
// - Chữ ký cô dâu và chú rể.
// - Ngày cưới.
// - Giao diện Desktop / Tablet / Mobile.
// ======================================================

// ======================================================
// SCROLL REVEAL
//
// Khi section xuất hiện trong màn hình,
// chuyển visible thành true để chạy hiệu ứng.
//
// Nếu trình duyệt không hỗ trợ IntersectionObserver
// hoặc người dùng bật giảm chuyển động,
// hiển thị nội dung ngay mà không cần quan sát.
// ======================================================

function useReveal() {
  const ref = useRef<HTMLDivElement>(null);

  const [visible, setVisible] =
    useState(false);

  useEffect(() => {
    const element = ref.current;

    if (!element) {
      return;
    }

    // Dùng để ngăn cập nhật state sau khi
    // component đã unmount hoặc effect cleanup.
    let cancelled = false;

    // Kiểm tra tùy chọn giảm chuyển động.
    const prefersReducedMotion =
      window.matchMedia(
        "(prefers-reduced-motion: reduce)"
      ).matches;

    // ==================================================
    // FIX ESLINT
    //
    // CODE CŨ:
    //
    // if (
    //   !("IntersectionObserver" in window) ||
    //   prefersReducedMotion
    // ) {
    //   setVisible(true);
    //   return;
    // }
    //
    // VẤN ĐỀ:
    // setVisible(true) được gọi đồng bộ
    // ngay bên trong useEffect.
    //
    // CÁCH SỬA:
    // Đưa cập nhật state vào microtask.
    // Kiểm tra cancelled trước khi cập nhật.
    //
    // Không tắt quy tắc ESLint.
    // ==================================================

    if (
      !("IntersectionObserver" in window) ||
      prefersReducedMotion
    ) {
      void Promise.resolve().then(() => {
        if (!cancelled) {
          setVisible(true);
        }
      });

      return () => {
        cancelled = true;
      };
    }

    // ==================================================
    // INTERSECTION OBSERVER
    //
    // Observer gọi callback khi phần tử
    // đi vào vùng hiển thị.
    // ==================================================

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (
          !cancelled &&
          entry.isIntersecting
        ) {
          setVisible(true);

          // Chỉ cần chạy hiệu ứng một lần.
          observer.disconnect();
        }
      },
      {
        threshold: 0.06,
        rootMargin: "0px 0px -30px 0px",
      }
    );

    observer.observe(element);

    // ==================================================
    // CLEANUP
    // ==================================================

    return () => {
      cancelled = true;
      observer.disconnect();
    };
  }, []);

  return {
    ref,
    visible,
  };
}

// ======================================================
// ORNAMENT
//
// Đường phân cách trang trí:
// - Hai đường kẻ màu vàng.
// - Trái tim màu hồng ở giữa.
// ======================================================

function ThankYouOrnament() {
  return (
    <div
      aria-hidden="true"
      className="
        flex items-center justify-center
        gap-4
      "
    >
      {/* Đường kẻ bên trái */}

      <span
        className="
          h-px w-12
          bg-gradient-to-r
          from-transparent to-[#E4CDA8]
          sm:w-20
        "
      />

      {/* Trái tim */}

      <Heart
        size={16}
        strokeWidth={1.2}
        className="text-[#F1C5CB]"
      />

      {/* Đường kẻ bên phải */}

      <span
        className="
          h-px w-12
          bg-gradient-to-l
          from-transparent to-[#E4CDA8]
          sm:w-20
        "
      />
    </div>
  );
}

// ======================================================
// MAIN THANK YOU
// ======================================================

export default function ThankYou() {
  const {
    ref,
    visible,
  } = useReveal();

  // ==================================================
  // BACKGROUND IMAGE
  //
  // Lấy đường dẫn ảnh từ wedding.ts.
  // Không sử dụng ảnh hardcode trong component.
  // ==================================================

  const backgroundImage =
    wedding.thankYou.backgroundImage;

  // ==================================================
  // RENDER
  // ==================================================

  return (
    <section
      id="thank-you"
      className="
        relative -mt-px
        overflow-hidden
        bg-[#F9F8EE]

        px-4 pt-8 pb-12
        sm:px-6 sm:pt-12 sm:pb-16
        md:px-8 md:pt-16 md:pb-20
        lg:pt-20 lg:pb-24
      "
    >
      {/* ==========================================
          BACKGROUND AMBIENT DECORATIONS
      ========================================== */}

      {/* Background glow bên trái */}

      <div
        aria-hidden="true"
        className="
          pointer-events-none
          absolute -left-40 top-12
          h-[400px] w-[400px]
          rounded-full bg-[#D9A5AE]/10
          blur-[135px]
        "
      />

      {/* Background glow bên phải */}

      <div
        aria-hidden="true"
        className="
          pointer-events-none
          absolute -right-40 bottom-0
          h-[400px] w-[400px]
          rounded-full bg-[#8FB4C7]/10
          blur-[135px]
        "
      />

      {/* ==========================================
          SCROLL REVEAL CONTAINER
      ========================================== */}

      <div
        ref={ref}
        className={`
          relative z-10
          mx-auto max-w-[1240px]

          transition-all duration-1000 ease-out
          motion-reduce:transform-none
          motion-reduce:opacity-100

          ${
            visible
              ? "translate-y-0 opacity-100"
              : "translate-y-6 opacity-0"
          }
        `}
      >
        {/* ==========================================
            PHOTO FRAME
        ========================================== */}

        <div
          className="
            relative isolate
            min-h-[660px]
            overflow-hidden

            rounded-[24px]
            bg-[#31566B]

            shadow-[0_30px_85px_rgba(49,86,107,0.14)]

            sm:min-h-[720px]
            sm:rounded-[32px]

            md:min-h-[760px]
            md:rounded-[40px]

            lg:min-h-[780px]
          "
        >
          {/* ======================================
              BACKGROUND PHOTO
          ====================================== */}

          <Image
            src={backgroundImage}
            alt={`Ảnh cưới của ${wedding.groom.shortName} và ${wedding.bride.shortName}`}
            fill
            sizes="(max-width: 767px) 100vw, 1240px"
            className="object-cover object-[center_25%]"
          />

          {/* ======================================
              PHOTO OVERLAY
          ====================================== */}

          <div
            className="
              absolute inset-0
              bg-gradient-to-b
              from-[#132E3C]/65
              via-[#183747]/55
              to-[#132E3C]/80
            "
          />

          {/* ======================================
              INNER BORDER
          ====================================== */}

          <div
            aria-hidden="true"
            className="
              pointer-events-none
              absolute inset-[10px]
              rounded-[17px]
              border border-white/25

              sm:inset-[15px]
              sm:rounded-[25px]

              md:inset-[20px]
              md:rounded-[30px]
            "
          />

          {/* ======================================
              CORNER ORNAMENT TOP LEFT
          ====================================== */}

          <div
            aria-hidden="true"
            className="
              absolute left-7 top-7
              h-9 w-9
              border-l border-t
              border-[#E4CDA8]/60

              sm:left-10 sm:top-10
              sm:h-12 sm:w-12
            "
          />

          {/* ======================================
              CORNER ORNAMENT BOTTOM RIGHT
          ====================================== */}

          <div
            aria-hidden="true"
            className="
              absolute bottom-7 right-7
              h-9 w-9
              border-b border-r
              border-[#E4CDA8]/60

              sm:bottom-10 sm:right-10
              sm:h-12 sm:w-12
            "
          />

          {/* ======================================
              CONTENT
          ====================================== */}

          <div
            className="
              relative z-10
              flex min-h-[660px]
              flex-col items-center
              justify-center

              px-7 py-16
              text-center text-white

              sm:min-h-[720px]
              sm:px-14

              md:min-h-[760px]
              md:px-20

              lg:min-h-[780px]
            "
          >
            {/* ==================================
                EYEBROW
            ================================== */}

            <p
              className="
                text-[10px] font-medium
                uppercase
                tracking-[0.34em]
                text-[#E9D4B3]

                sm:text-xs
                sm:tracking-[0.4em]
              "
            >
              WITH ALL OUR LOVE
            </p>

            {/* ==================================
                MAIN TITLE
            ================================== */}

            <h2
              className="
                font-wedding-serif

                mt-5
                text-[46px]
                font-light
                leading-[1.1]

                text-[#FFFDF8]

                sm:text-[60px]
                md:text-[74px]
                lg:text-[88px]
              "
            >
              {wedding.thankYou.title}
            </h2>

            {/* ==================================
                DECORATIVE ORNAMENT
            ================================== */}

            <div className="mt-6">
              <ThankYouOrnament />
            </div>

            {/* ==================================
                THANK YOU MESSAGE
            ================================== */}

            <p
              className="
                font-wedding-serif

                mx-auto mt-8
                max-w-[700px]

                text-[17px]
                font-normal
                leading-8

                text-white/90

                sm:text-[20px]
                sm:leading-9

                md:text-[23px]
                md:leading-10
              "
            >
              {wedding.thankYou.message}
            </p>

            {/* ==================================
                COUPLE SIGNATURE
            ================================== */}

            <div
              className="
                mt-10 flex
                flex-wrap
                items-center
                justify-center gap-4

                sm:mt-12
                sm:gap-6
              "
            >
              {/* Chú rể */}

              <span
                className="
                  font-wedding
                  text-[54px]
                  leading-none
                  text-[#FFFDF8]

                  sm:text-[70px]
                  md:text-[82px]
                "
              >
                {wedding.groom.shortName}
              </span>

              {/* Trái tim */}

              <Heart
                size={17}
                fill="currentColor"
                strokeWidth={1}
                className="text-[#F1C5CB]"
              />

              {/* Cô dâu */}

              <span
                className="
                  font-wedding
                  text-[54px]
                  leading-none
                  text-[#FFFDF8]

                  sm:text-[70px]
                  md:text-[82px]
                "
              >
                {wedding.bride.shortName}
              </span>
            </div>

            {/* ==================================
                WEDDING DATE
            ================================== */}

            <p
              className="
                font-wedding-serif

                mt-7
                text-[13px]
                uppercase
                tracking-[0.25em]

                text-[#E9D4B3]

                sm:text-[15px]
              "
            >
              {wedding.displayDate}
            </p>
          </div>
        </div>

        {/* ==========================================
            CLOSING CAPTION
        ========================================== */}

        <div
          className="
            mx-auto mt-10
            max-w-[650px]
            text-center

            sm:mt-12
          "
        >
          <p
            className="
              font-wedding-serif
              text-[16px]
              italic leading-7
              text-[#61726D]

              sm:text-[18px]
            "
          >
            Cảm ơn vì đã trở thành một phần
            trong ngày hạnh phúc của chúng mình.
          </p>
        </div>
      </div>
    </section>
  );
}
