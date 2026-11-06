
"use client";

import {
  useEffect,
  useState,
} from "react";

import {
  useWedding,
} from "@/components/providers/WeddingProvider";

export default function BackToTop() {
  const {
    invitationOpened,
  } = useWedding();

  const [
    visible,
    setVisible,
  ] = useState(false);

  // =====================================
  // THEO DÕI VỊ TRÍ CUỘN
  // =====================================

  useEffect(() => {
    function update() {
      setVisible(window.scrollY > 700);
    }

    const frame = requestAnimationFrame(update);

    window.addEventListener(
      "scroll",
      update,
      { passive: true }
    );

    return () => {
      cancelAnimationFrame(frame);

      window.removeEventListener(
        "scroll",
        update
      );
    };
  }, []);

  // =====================================
  // TRỞ VỀ ĐẦU TRANG
  // =====================================

  function scrollToTop() {
    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  }

  if (!invitationOpened) {
    return null;
  }

  return (
    <button
      type="button"

      onClick={scrollToTop}

      aria-label="Quay lại đầu trang"
      title="Quay lại đầu trang"

      aria-hidden={!visible}
      tabIndex={visible ? 0 : -1}

      className={`
        group

        fixed

        bottom-5
        right-4

        z-[290]

        flex
        h-12
        w-12

        items-center
        justify-center

        overflow-hidden

        rounded-full

        border
        border-[#b98b7b]/25

        bg-[#fffaf7]/85

        text-[#8f6257]

        shadow-[0_10px_35px_rgba(101,67,57,0.12)]

        backdrop-blur-xl

        transition-all
        duration-500

        hover:-translate-y-1

        hover:border-[#b77969]/45

        hover:bg-[#a86f62]

        hover:text-white

        hover:shadow-[0_16px_40px_rgba(144,88,73,0.20)]

        sm:bottom-6
        sm:right-6

        md:h-[52px]
        md:w-[52px]

        ${visible
          ? `
              visible
              translate-y-0
              scale-100
              opacity-100
            `
          : `
              pointer-events-none
              invisible
              translate-y-4
              scale-90
              opacity-0
            `
        }
      `}
    >
      {/* =====================================
          SOFT GLOW
      ===================================== */}

      <span
        className="
          pointer-events-none

          absolute

          h-8
          w-8

          rounded-full

          bg-[#edc8bb]/25

          blur-lg

          transition-all
          duration-500

          group-hover:scale-150

          group-hover:bg-white/20
        "
      />

      {/* =====================================
          ARROW
      ===================================== */}

      <span
        className="
          relative
          z-10

          flex
          flex-col

          items-center
          justify-center

          transition-transform
          duration-300

          group-hover:-translate-y-[2px]
        "
      >
        <span
          className="
            font-wedding-serif

            text-[20px]
            font-light

            leading-none

            sm:text-[22px]
          "
        >
          ↑
        </span>
      </span>

      {/* =====================================
          DECORATIVE RING
      ===================================== */}

      <span
        className="
          pointer-events-none

          absolute
          inset-[4px]

          rounded-full

          border
          border-[#b88b7b]/10

          transition-colors

          group-hover:border-white/20
        "
      />
    </button>
  );
}
