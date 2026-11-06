
"use client";

import {
  useEffect,
  useRef,
  useState,
} from "react";

export default function CustomCursor() {
  const cursorRef = useRef<HTMLDivElement>(null);

  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    const pointer = window.matchMedia(
      "(hover: hover) and (pointer: fine)"
    );

    if (!pointer.matches) {
      return;
    }

    const frame = requestAnimationFrame(() => {
      setEnabled(true);
    });

    function move(event: MouseEvent) {
      const cursor = cursorRef.current;

      if (!cursor) return;

      cursor.style.transform = `translate3d(${event.clientX - 15
        }px, ${event.clientY - 15}px, 0)`;

      cursor.style.opacity = "1";
    }

    function hide() {
      if (cursorRef.current) {
        cursorRef.current.style.opacity = "0";
      }
    }

    window.addEventListener("mousemove", move, {
      passive: true,
    });

    document.addEventListener("mouseleave", hide);

    return () => {
      cancelAnimationFrame(frame);

      window.removeEventListener("mousemove", move);
      document.removeEventListener("mouseleave", hide);
    };
  }, []);

  if (!enabled) {
    return null;
  }

  return (
    <div
      ref={cursorRef}
      aria-hidden="true"
      className="
        pointer-events-none
        fixed left-0 top-0
        z-[20000]

        flex h-[30px] w-[30px]
        items-center justify-center

        rounded-full

        border border-[#B8A27D]/55

        bg-[#FFFDF8]/20

        text-[12px] text-[#C98792]

        shadow-[0_4px_18px_rgba(49,86,107,0.08)]

        backdrop-blur-[2px]

        opacity-0

        transition-[transform,opacity]
        duration-75
        ease-out

        select-none
      "
    >
      ♡
    </div>
  );
}
