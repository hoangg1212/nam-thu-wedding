
"use client";

import Image from "next/image";

import {
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";

import { Heart } from "lucide-react";

// ======================================================
// NAM & THƯ - LOVE STORY
//
// CẬP NHẬT NỘI DUNG:
// - Tập trung vào hành trình bên nhau.
// - Nhắc đến những cột mốc và kỷ niệm.
// - Lời dẫn và lời kết trang nhã, tự nhiên.
// - Phân biệt rõ với phần Album ảnh cưới.
//
// GIỮ NGUYÊN CHỨC NĂNG:
// - Scroll Reveal.
// - Hỗ trợ prefers-reduced-motion.
// - Timeline lấy trực tiếp từ MongoDB.
// - Không ghi đè nội dung từng cột mốc.
// - Sắp xếp theo sortOrder.
// - Không dùng dữ liệu tĩnh khi API lỗi.
// - Ảnh trang trí, viền đôi và hoa góc.
// - Bố cục trái/phải xen kẽ.
// - Responsive desktop, tablet và mobile.
// ======================================================

// ======================================================
// CONTENT
//
// Nội dung giới thiệu chung của Love Story.
//
// Các cột mốc cụ thể vẫn do Admin quản lý.
// Không tự tạo thêm sự kiện hoặc ngày tháng.
// ======================================================

const LOVE_STORY_CONTENT = {
  eyebrow: "OUR LOVE STORY",

  title: "Hành Trình Bên Nhau",

  description:
    "Từ những lần gặp gỡ đầu tiên đến những tháng ngày " +
    "cùng đồng hành, mỗi chặng đường đều để lại trong " +
    "chúng mình những kỷ niệm đáng nhớ. Có niềm vui, " +
    "có thử thách và cả những điều giản dị đã giúp " +
    "Nam và Thư hiểu, thương và trân trọng nhau nhiều hơn.",

  closing:
    "Cảm ơn vì đã cùng nhau đi qua những ngày tháng ấy. " +
    "Những kỷ niệm đã có sẽ luôn là một phần quý giá, " +
    "để chúng mình tiếp tục nắm tay nhau trên " +
    "chặng đường phía trước.",
};

// ======================================================
// TYPES
// ======================================================

interface StoryItemData {
  id: string;
  date: string;
  title: string;
  description: string;
  image: string;
  sortOrder: number;
}

interface PublicStoriesResponse {
  success?: boolean;
  stories?: StoryItemData[];
}

// ======================================================
// SCROLL REVEAL
//
// Không gọi setState trực tiếp trong useEffect.
// Tương thích React Hooks và ESLint.
// ======================================================

function Reveal({
  children,
  delay = 0,
}: {
  children: ReactNode;
  delay?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const element = ref.current;

    if (!element) {
      return;
    }

    let cancelled = false;

    const prefersReducedMotion =
      window.matchMedia(
        "(prefers-reduced-motion: reduce)"
      ).matches;

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

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      {
        threshold: 0.08,
        rootMargin: "0px 0px -25px 0px",
      }
    );

    observer.observe(element);

    return () => {
      cancelled = true;
      observer.disconnect();
    };
  }, []);

  return (
    <div
      ref={ref}
      style={{
        transitionDelay: `${delay}ms`,
      }}
      className={`
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
      {children}
    </div>
  );
}

// ======================================================
// STORY HEADING
//
// Giới thiệu về hành trình tình yêu,
// không trùng nội dung Album ảnh cưới.
// ======================================================

function StoryHeading() {
  return (
    <Reveal>
      <div
        className="
          mx-auto mb-10 max-w-3xl
          text-center
          sm:mb-12
          md:mb-14
          lg:mb-16
        "
      >
        {/* ENGLISH EYEBROW */}

        <p
          className="
            text-[10px] font-medium
            uppercase tracking-[0.36em]
            text-[#C98792]
            sm:text-[11px]
            sm:tracking-[0.4em]
          "
        >
          {LOVE_STORY_CONTENT.eyebrow}
        </p>

        {/* MAIN HEADING */}

        <h2
          className="
            font-wedding-serif
            mt-3 text-[44px]
            font-light leading-[1.08]
            tracking-[-0.02em]
            text-[#31566B]
            sm:text-5xl
            md:text-6xl
            lg:text-[72px]
          "
        >
          {LOVE_STORY_CONTENT.title}
        </h2>

        {/* DECORATIVE DIVIDER */}

        <div
          aria-hidden="true"
          className="
            mx-auto mt-5 flex
            items-center justify-center gap-3
          "
        >
          <span
            className="
              h-px w-11
              bg-gradient-to-r
              from-transparent
              to-[#B8A27D]/50
              sm:w-16
            "
          />

          <Heart
            size={12}
            fill="currentColor"
            strokeWidth={1}
            className="text-[#C98792]"
          />

          <span
            className="
              h-px w-11
              bg-gradient-to-l
              from-transparent
              to-[#B8A27D]/50
              sm:w-16
            "
          />
        </div>

        {/* INTRODUCTION */}

        <p
          className="
            font-wedding-serif
            mx-auto mt-5 max-w-[690px]
            text-[16px] font-normal
            leading-7 text-[#61726D]
            sm:text-lg sm:leading-8
            md:text-xl md:leading-9
          "
        >
          {LOVE_STORY_CONTENT.description}
        </p>
      </div>
    </Reveal>
  );
}

// ======================================================
// DECORATIVE CORNER
//
// Trang trí góc khung ảnh bằng nét hoa.
// ======================================================

function DecorativeCorner({
  position,
}: {
  position: "top-left" | "bottom-right";
}) {
  const placement =
    position === "top-left"
      ? "left-0 top-0"
      : "bottom-0 right-0 rotate-180";

  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 96 96"
      fill="none"
      className={`
        pointer-events-none
        absolute z-20
        h-[74px] w-[74px]
        text-[#D2B98A]
        sm:h-[90px] sm:w-[90px]
        ${placement}
      `}
    >
      {/* CURVED CORNER LINES */}

      <path
        d="M8 64V28C8 17 17 8 28 8H64"
        stroke="currentColor"
        strokeWidth="1"
        opacity="0.85"
      />

      <path
        d="M17 55V29C17 22 22 17 29 17H55"
        stroke="currentColor"
        strokeWidth="0.8"
        opacity="0.6"
      />

      {/* FLORAL ORNAMENT */}

      <path
        d="M22 39C32 35 37 28 40 19"
        stroke="currentColor"
        strokeWidth="0.9"
        strokeLinecap="round"
      />

      <path
        d="M28 35C20 30 22 24 26 24C31 24 33 30 28 35Z"
        stroke="currentColor"
        strokeWidth="0.8"
      />

      <path
        d="M34 28C32 21 37 17 41 20C45 24 40 29 34 28Z"
        stroke="currentColor"
        strokeWidth="0.8"
      />

      <path
        d="M40 19C44 14 49 16 49 20C49 24 44 26 40 19Z"
        stroke="currentColor"
        strokeWidth="0.8"
      />

      <circle
        cx="40"
        cy="19"
        r="2"
        fill="currentColor"
      />

      <circle
        cx="20"
        cy="58"
        r="1.5"
        fill="currentColor"
        opacity="0.75"
      />

      <circle
        cx="58"
        cy="20"
        r="1.5"
        fill="currentColor"
        opacity="0.75"
      />
    </svg>
  );
}

// ======================================================
// STORY IMAGE
//
// Giữ nguyên thiết kế khung ảnh:
// - Viền đôi.
// - Nền trang trí lệch.
// - Hoa góc trên trái và dưới phải.
// - Số thứ tự cột mốc.
// - Hover phóng ảnh nhẹ.
// ======================================================

function StoryImage({
  image,
  title,
  index,
}: {
  image: string;
  title: string;
  index: number;
}) {
  return (
    <div
      className="
        group relative mx-auto
        aspect-[4/5] w-full
        max-w-[520px]
      "
    >
      {/* DECORATIVE BACKGROUND */}

      <div
        aria-hidden="true"
        className="
          absolute inset-0
          translate-x-[9px]
          translate-y-[9px]
          rounded-[12px]
          border border-[#B8A27D]/35
          bg-[#E9E7DA]/30
          sm:translate-x-[13px]
          sm:translate-y-[13px]
          sm:rounded-[16px]
        "
      />

      {/* MAIN PHOTO FRAME */}

      <div
        className="
          relative h-full w-full
          overflow-hidden
          rounded-[12px]
          border border-[#B8A27D]/50
          bg-[#FFFDF8]
          p-[7px]
          shadow-[0_25px_70px_rgba(49,86,107,0.12)]
          transition-all duration-700
          group-hover:shadow-[0_35px_85px_rgba(49,86,107,0.17)]
          sm:rounded-[16px]
          sm:p-[10px]
        "
      >
        {/* INNER BORDER */}

        <div
          aria-hidden="true"
          className="
            pointer-events-none
            absolute inset-[3px] z-10
            rounded-[10px]
            border border-[#B8A27D]/30
            sm:inset-[5px]
            sm:rounded-[12px]
          "
        />

        {/* PHOTOGRAPH */}

        <div
          className="
            relative h-full w-full
            overflow-hidden
            rounded-[6px]
            bg-[#E9EDE5]
            sm:rounded-[9px]
          "
        >
          {image.trim() ? (
            <Image
              src={image}
              alt={title}
              fill
              sizes="
                (max-width: 768px) 92vw,
                (max-width: 1200px) 48vw,
                520px
              "
              unoptimized={image.startsWith(
                "/api/stories/image/"
              )}
              className="
                object-cover object-center
                transition-transform
                duration-[1400ms] ease-out
                group-hover:scale-[1.04]
              "
            />
          ) : (
            <div
              className="
                flex h-full w-full
                items-center justify-center
                bg-gradient-to-b
                from-[#E9EDE5] to-[#F8F1EE]
              "
            >
              <Heart
                size={36}
                strokeWidth={1}
                className="text-[#B8A27D]/60"
              />
            </div>
          )}

          {/* SUBTLE IMAGE GRADIENT */}

          <div
            className="
              pointer-events-none
              absolute inset-0
              bg-gradient-to-t
              from-[#213E50]/16
              via-transparent
              to-transparent
            "
          />
        </div>

        {/* DECORATIVE CORNERS */}

        <DecorativeCorner position="top-left" />
        <DecorativeCorner position="bottom-right" />

        {/* TIMELINE NUMBER */}

        <div
          className="
            absolute bottom-5 right-5
            z-20
            flex h-11 w-11
            items-center justify-center
            rounded-full
            border border-[#FFFDF8]/80
            bg-[#FFFDF8]/90
            font-wedding-serif
            text-sm font-medium
            text-[#587589]
            shadow-[0_8px_28px_rgba(49,86,107,0.10)]
            backdrop-blur-md
            sm:h-12 sm:w-12
          "
        >
          {String(index + 1).padStart(2, "0")}
        </div>
      </div>
    </div>
  );
}

// ======================================================
// STORY CONTENT
//
// Nội dung từng cột mốc lấy từ MongoDB.
//
// Admin quyết định:
// - Ngày / thời điểm.
// - Tiêu đề.
// - Nội dung.
// - Ảnh.
//
// Không tự thay câu chuyện đã lưu.
// ======================================================

function StoryContent({
  date,
  title,
  description,
  reverse,
}: {
  date: string;
  title: string;
  description: string;
  reverse: boolean;
}) {
  return (
    <div
      className={`
        mx-auto w-full max-w-[520px]
        ${reverse ? "lg:text-right" : ""}
      `}
    >
      {/* DATE / MILESTONE */}

      <div
        className={`
          flex items-center gap-3
          ${reverse ? "lg:justify-end" : ""}
        `}
      >
        <span
          className="
            h-px w-8
            bg-gradient-to-r
            from-[#B8A27D]/55
            to-transparent
          "
        />

        {date.trim() && (
          <span
            className="
              rounded-full
              border border-[#7A9CAC]/20
              bg-[#FFFDF8]/75
              px-4 py-2
              text-[9px] font-medium
              uppercase tracking-[0.22em]
              text-[#587589]
              shadow-[0_8px_25px_rgba(49,86,107,0.06)]
              backdrop-blur-md
              sm:text-[10px]
            "
          >
            {date}
          </span>
        )}
      </div>

      {/* MILESTONE TITLE */}

      <h3
        className="
          font-wedding-serif
          mt-4 text-[32px]
          font-normal leading-[1.2]
          tracking-[-0.015em]
          text-[#31566B]
          sm:text-4xl
          md:text-[42px]
          lg:text-5xl
        "
      >
        {title}
      </h3>

      {/* DIVIDER */}

      <div
        aria-hidden="true"
        className={`
          mt-4 flex items-center gap-2.5
          ${reverse ? "lg:justify-end" : ""}
        `}
      >
        <Heart
          size={9}
          fill="currentColor"
          strokeWidth={1}
          className="text-[#C98792]"
        />

        <span
          className="
            h-px w-12
            bg-gradient-to-r
            from-[#B8A27D]/50
            to-transparent
          "
        />
      </div>

      {/* MILESTONE DESCRIPTION */}

      <p
        className="
          font-wedding-serif
          mt-4 whitespace-pre-line break-words
          text-[16px]
          font-normal leading-7
          text-[#61726D]
          sm:text-[17px]
          sm:leading-8
          md:text-lg md:leading-9
        "
      >
        {description}
      </p>

      {/* MOBILE DIVIDER */}

      <div
        aria-hidden="true"
        className="
          mt-6 flex items-center gap-3
          lg:hidden
        "
      >
        <span
          className="
            h-px flex-1
            bg-gradient-to-r
            from-[#7A9CAC]/25
            to-transparent
          "
        />

        <Heart
          size={11}
          strokeWidth={1}
          className="text-[#C98792]/65"
        />
      </div>
    </div>
  );
}

// ======================================================
// TIMELINE ITEM
//
// Xen kẽ ảnh và nội dung trái/phải trên desktop.
// Mobile hiển thị ảnh trước, nội dung sau.
// ======================================================

function TimelineItem({
  story,
  index,
}: {
  story: StoryItemData;
  index: number;
}) {
  const reverse = index % 2 === 1;

  return (
    <Reveal delay={(index % 3) * 80}>
      <article
        className="
          relative grid
          items-center gap-7
          md:gap-10
          lg:grid-cols-2
          lg:gap-20
        "
      >
        {/* STORY IMAGE */}

        <div
          className={
            reverse
              ? "lg:order-2"
              : "lg:order-1"
          }
        >
          <StoryImage
            image={story.image}
            title={story.title}
            index={index}
          />
        </div>

        {/* STORY TEXT */}

        <div
          className={
            reverse
              ? "lg:order-1"
              : "lg:order-2"
          }
        >
          <StoryContent
            date={story.date}
            title={story.title}
            description={story.description}
            reverse={reverse}
          />
        </div>

        {/* CENTER TIMELINE HEART */}

        <div
          aria-hidden="true"
          className="
            absolute left-1/2 top-1/2
            hidden h-10 w-10
            -translate-x-1/2
            -translate-y-1/2
            items-center justify-center
            rounded-full
            border border-[#7A9CAC]/25
            bg-[#F7F7EF]
            text-[#C98792]
            shadow-[0_8px_30px_rgba(49,86,107,0.09)]
            lg:flex
          "
        >
          <Heart
            size={12}
            fill="currentColor"
            strokeWidth={1}
          />
        </div>
      </article>
    </Reveal>
  );
}

// ======================================================
// STORY CLOSING
//
// Lời kết hướng về những kỷ niệm đã có
// và chặng đường sắp tới của Nam & Thư.
// ======================================================

function StoryClosing() {
  const message = LOVE_STORY_CONTENT.closing;

  if (!message.trim()) {
    return null;
  }

  return (
    <Reveal>
      <div
        className="
          mx-auto mt-9 flex
          max-w-[420px]
          items-center justify-center gap-4
          sm:mt-10
          md:mt-12 md:max-w-[760px]
        "
      >
        <span
          className="
            h-px flex-1
            bg-gradient-to-r
            from-transparent
            to-[#7A9CAC]/35
          "
        />

        <p
          className="
            font-wedding-serif
            max-w-[250px]
            text-center text-[14px]
            font-normal italic
            leading-6 text-[#61726D]/85
            sm:text-[15px]
            md:max-w-none
            md:text-[16px]
          "
        >
          {message}
        </p>

        <span
          className="
            h-px flex-1
            bg-gradient-to-l
            from-transparent
            to-[#7A9CAC]/35
          "
        />
      </div>
    </Reveal>
  );
}

// ======================================================
// MAIN LOVE STORY
//
// Dữ liệu cột mốc lấy từ /api/stories.
//
// Nếu API trả []:
// - Không hiển thị Love Story.
//
// Nếu API lỗi:
// - Không hiển thị dữ liệu tĩnh.
// - Không làm xuất hiện lại các cột mốc
//   mà Admin đã xóa hoặc ẩn.
// ======================================================

export default function LoveStory() {
  const [stories, setStories] =
    useState<StoryItemData[]>([]);

  const [loading, setLoading] =
    useState(true);

  // ==================================================
  // LOAD MONGODB STORIES
  // ==================================================

  useEffect(() => {
    const controller =
      new AbortController();

    async function loadStories() {
      try {
        const response = await fetch(
          "/api/stories",
          {
            cache: "no-store",
            signal: controller.signal,
          }
        );

        if (!response.ok) {
          throw new Error(
            "Không thể tải Love Story."
          );
        }

        const data =
          (await response.json()) as PublicStoriesResponse;

        if (
          !data.success ||
          !Array.isArray(data.stories)
        ) {
          throw new Error(
            "Dữ liệu Love Story không hợp lệ."
          );
        }

        // Chỉ nhận dữ liệu hợp lệ.
        const validStories = data.stories.filter(
          (story): story is StoryItemData =>
            typeof story.id === "string" &&
            typeof story.date === "string" &&
            typeof story.title === "string" &&
            typeof story.description === "string" &&
            typeof story.image === "string" &&
            typeof story.sortOrder === "number" &&
            Number.isFinite(story.sortOrder)
        );

        // Giữ thứ tự do Admin thiết lập.
        validStories.sort(
          (a, b) =>
            a.sortOrder - b.sortOrder ||
            a.id.localeCompare(b.id)
        );

        if (!controller.signal.aborted) {
          setStories(validStories);
        }
      } catch (error) {
        if (!controller.signal.aborted) {
          console.error(
            "[PUBLIC LOVE STORY]",
            error
          );

          // Không dùng lại timeline tĩnh.
          setStories([]);
        }
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    }

    void loadStories();

    return () => {
      controller.abort();
    };
  }, []);

  // ==================================================
  // KHÔNG RENDER KHI CHƯA CÓ DỮ LIỆU
  // ==================================================

  if (
    loading ||
    stories.length === 0
  ) {
    return null;
  }

  // ==================================================
  // RENDER
  // ==================================================

  return (
    <section
      id="story"
      className="
        relative -mt-px
        scroll-mt-16
        overflow-hidden

        bg-[linear-gradient(to_bottom,#F8F1EE_0%,#F8F1EE_8%,#F5F5EC_42%,#EEF4F6_100%)]

        px-5 py-14
        sm:px-6 sm:py-16
        md:px-8 md:py-20
        lg:py-24
      "
    >
      {/* BACKGROUND DECORATIONS */}

      <div
        aria-hidden="true"
        className="
          pointer-events-none
          absolute left-0 top-0
          h-16 w-full
          bg-gradient-to-b
          from-[#F8F1EE]
          via-[#F8F1EE]/75
          to-transparent
          md:h-20
        "
      />

      <div
        aria-hidden="true"
        className="
          pointer-events-none
          absolute -left-36 top-[10%]
          h-[360px] w-[360px]
          rounded-full
          bg-[#8FB4C7]/16
          blur-[125px]
          md:h-[470px] md:w-[470px]
        "
      />

      <div
        aria-hidden="true"
        className="
          pointer-events-none
          absolute -right-40 bottom-[12%]
          h-[380px] w-[380px]
          rounded-full
          bg-[#D9A5AE]/16
          blur-[135px]
          md:h-[500px] md:w-[500px]
        "
      />

      <div
        aria-hidden="true"
        className="
          pointer-events-none
          absolute left-1/2 top-1/2
          h-[620px] w-[70%]
          -translate-x-1/2
          -translate-y-1/2
          rounded-full
          bg-[#DCE5D8]/16
          blur-[140px]
          md:w-[50%]
        "
      />

      {/* MAIN CONTENT */}

      <div
        className="
          relative z-10
          mx-auto max-w-[1180px]
        "
      >
        {/* LOVE STORY HEADING */}

        <StoryHeading />

        {/* TIMELINE */}

        <div
          className="
            relative space-y-12
            sm:space-y-14
            md:space-y-18
            lg:space-y-20
          "
        >
          {/* TIMELINE LINE */}

          <div
            aria-hidden="true"
            className="
              pointer-events-none
              absolute left-1/2 top-0
              hidden h-full w-px
              -translate-x-1/2
              bg-gradient-to-b
              from-transparent
              via-[#7A9CAC]/25
              to-transparent
              lg:block
            "
          />

          {/* TIMELINE ITEMS */}

          {stories.map((story, index) => (
            <TimelineItem
              key={story.id}
              story={story}
              index={index}
            />
          ))}
        </div>

        {/* CLOSING MESSAGE */}

        <StoryClosing />
      </div>
    </section>
  );
}
