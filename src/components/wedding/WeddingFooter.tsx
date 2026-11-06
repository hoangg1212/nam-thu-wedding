
"use client";

import { Heart } from "lucide-react";
import { wedding } from "@/data/wedding";

// ======================================================
// DECORATIVE DIVIDER
// ======================================================

function FooterDivider() {
  return (
    <div
      aria-hidden="true"
      className="
        mx-auto flex
        items-center justify-center
        gap-3
      "
    >
      <span
        className="
          h-px w-12
          bg-gradient-to-r
          from-transparent
          to-[#7A9CAC]/30
        "
      />

      <Heart
        size={10}
        strokeWidth={1.2}
        className="text-[#C98792]/70"
      />

      <span
        className="
          h-px w-12
          bg-gradient-to-l
          from-transparent
          to-[#7A9CAC]/30
        "
      />
    </div>
  );
}

// ======================================================
// WEDDING FOOTER
// ======================================================

export default function WeddingFooter() {
  const weddingYear = new Date(
    wedding.date
  ).getFullYear();

  return (
    <footer
      id="footer"
      className="
        relative -mt-px
        overflow-hidden

        bg-[linear-gradient(to_bottom,#F9F8EE_0%,#F7EEEB_12%,#F3F5EF_55%,#EAF2F5_100%)]

        px-5 py-8

        text-center
      "
    >
      {/* Decorative background glow */}
      <div
        aria-hidden="true"
        className="
          pointer-events-none

          absolute
          left-1/2 top-0

          h-24
          w-[70%]

          -translate-x-1/2

          rounded-full
          bg-[#FFFDF8]/45
          blur-[45px]
        "
      />

      {/* Footer content */}
      <div
        className="
          relative z-10
          mx-auto
          max-w-lg
        "
      >
        {/* Decorative heart divider */}
        <FooterDivider />

        {/* Wedding message */}
        <p
          className="
            font-wedding-serif

            mt-4

            text-[14px]
            font-normal
            italic

            tracking-[0.04em]

            text-[#587589]/75

            sm:text-[15px]
          "
        >
          Một ngày để nhớ · Một hành trình để thương
        </p>

        {/* Wedding year */}
        <p
          className="
            mt-3

            text-[8px]
            font-medium
            uppercase

            tracking-[0.3em]

            text-[#61726D]/50
          "
        >
          Ngày chung đôi · {weddingYear}
        </p>
      </div>
    </footer>
  );
}
