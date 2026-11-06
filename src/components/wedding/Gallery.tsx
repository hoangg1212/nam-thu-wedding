
"use client";

import Image from "next/image";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type TouchEvent,
} from "react";

import {
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  Heart,
  Minus,
  Plus,
  X,
} from "lucide-react";

import { wedding } from "@/data/wedding";

// ======================================================
// NAM & THU - PUBLIC WEDDING GALLERY
//
// CẬP NHẬT NỘI DUNG:
// - Toàn bộ câu chữ tập trung vào Album ảnh cưới.
// - Không dùng nhãn "Khoảnh khắc" chung chung.
// - Tiêu đề và lời giới thiệu trang nhã.
// - Chú thích ảnh và Lightbox thống nhất.
// - Nút bấm phù hợp với chức năng Album.
// - Lời kết nói về bộ ảnh cưới Nam & Thư.
//
// GIỮ NGUYÊN CHỨC NĂNG:
// - Tải ảnh từ MongoDB qua /api/gallery.
// - Sắp xếp theo sortOrder.
// - Fallback khi API lỗi.
// - Không dùng fallback khi API trả Album rỗng.
// - Hiển thị 6 khung trống khi chưa có ảnh.
// - Bố cục ảnh so le.
// - Xem thêm 6 ảnh mỗi lần.
// - Thu gọn Album.
// - Lightbox toàn màn hình.
// - Zoom ảnh từ 1x đến 3x.
// - Điều hướng bằng bàn phím.
// - Vuốt chuyển ảnh trên mobile.
// - Responsive desktop, tablet, mobile.
// ======================================================

// ======================================================
// CONFIG
// ======================================================

const INITIAL_VISIBLE_IMAGES = 6;
const IMAGES_PER_LOAD = 6;
const EMPTY_PLACEHOLDER_COUNT = 6;

const MIN_ZOOM = 1;
const MAX_ZOOM = 3;
const ZOOM_STEP = 0.5;

const SWIPE_THRESHOLD = 55;

const EMPTY_PHOTO_BACKGROUND = "#E9EDE5";

// Giữ bố cục ảnh so le trên desktop.
const PHOTO_LAYOUTS = [
  "lg:col-span-8 lg:h-[560px]",
  "lg:col-span-4 lg:h-[440px] lg:mt-20",
  "lg:col-span-4 lg:h-[430px]",
  "lg:col-span-8 lg:h-[540px]",
  "lg:col-span-5 lg:h-[600px]",
  "lg:col-span-7 lg:h-[470px] lg:mt-24",
];

// ======================================================
// TYPES
// ======================================================

interface GalleryPhoto {
  id: string;
  imageUrl: string;
  alt: string;
  sortOrder: number;
}

interface GalleryResponse {
  success?: boolean;
  photos?: GalleryPhoto[];
  message?: string;
}

type GalleryLoadStatus =
  | "loading"
  | "success"
  | "error";

// ======================================================
// TEXT CONTENT
//
// Tập trung vào Album ảnh cưới.
// Dùng chung để nội dung luôn đồng nhất.
// ======================================================

const GALLERY_CONTENT = {
  eyebrow: "OUR WEDDING ALBUM",

  title: "Album Ảnh Cưới",

  description:
    "Bộ ảnh cưới ghi lại những hình ảnh đẹp của " +
    "Nam và Thư trước ngày về chung một nhà. " +
    "Qua từng bức ảnh, chúng mình muốn lưu giữ " +
    "nét dịu dàng, niềm vui và tình cảm chân thành " +
    "dành cho nhau.",

  imageLabel: "ẢNH CƯỚI NAM & THƯ",

  defaultImageTitle: "Ảnh cưới Nam & Thư",

  loadMore: "Xem thêm ảnh cưới",

  collapse: "Thu gọn album",

  lightboxCaption: "Album ảnh cưới Nam & Thư",

  closing:
    "Bộ ảnh cưới là một dấu ấn đặc biệt trước " +
    "ngày thành hôn. Chúng mình trân trọng lưu " +
    "giữ từng bức hình như một phần đẹp đẽ " +
    "của câu chuyện tình yêu này.",
};

// ======================================================
// FALLBACK DATA
//
// Chỉ dùng khi API thực sự bị lỗi.
// Nếu API trả về mảng rỗng hợp lệ,
// không hiển thị ảnh fallback.
// ======================================================

function getFallbackPhotos(): GalleryPhoto[] {
  return wedding.gallery
    .filter(
      (src) =>
        typeof src === "string" &&
        src.trim().length > 0
    )
    .map((imageUrl, index) => ({
      id: `fallback-${index}`,
      imageUrl,

      alt:
        `Ảnh cưới của ${wedding.groom.shortName} ` +
        `và ${wedding.bride.shortName}`,

      sortOrder: index,
    }));
}

const FALLBACK_PHOTOS = getFallbackPhotos();

// ======================================================
// IMAGE HELPERS
// ======================================================

function isGridFsImage(src: string): boolean {
  return /^\/api\/gallery\/image\/[a-f0-9]{24}$/i.test(
    src
  );
}

function getPhotoTitle(photo: GalleryPhoto): string {
  // Giữ chú thích cụ thể đã nhập trong Admin.
  // Khi không có chú thích mới dùng tên mặc định.
  return (
    photo.alt.trim() ||
    GALLERY_CONTENT.defaultImageTitle
  );
}

// ======================================================
// GALLERY IMAGE
// ======================================================

function GalleryImage({
  src,
  alt,
  sizes,
  contain = false,
  zoom = 1,
}: {
  src: string;
  alt: string;
  sizes: string;
  contain?: boolean;
  zoom?: number;
}) {
  return (
    <Image
      src={src}
      alt={alt}
      fill
      unoptimized={isGridFsImage(src)}
      sizes={sizes}
      className={
        contain
          ? "object-contain transition-transform duration-300 ease-out"
          : "object-cover object-center transition-transform duration-[1400ms] ease-out group-hover:scale-[1.045]"
      }
      style={
        contain
          ? {
              transform: `scale(${zoom})`,
            }
          : undefined
      }
    />
  );
}

// ======================================================
// GALLERY DIVIDER
// ======================================================

function GalleryDivider() {
  return (
    <div
      aria-hidden="true"
      className="mx-auto flex w-full max-w-[250px] items-center justify-center gap-4"
    >
      <span className="h-px flex-1 bg-gradient-to-r from-transparent to-[#B8A27D]/65" />

      <Heart
        size={16}
        strokeWidth={1.3}
        className="text-[#C98792]"
      />

      <span className="h-px flex-1 bg-gradient-to-l from-transparent to-[#B8A27D]/65" />
    </div>
  );
}

// ======================================================
// GALLERY HEADING
//
// Nội dung hoàn toàn nói về Album ảnh cưới.
// ======================================================

function GalleryHeading() {
  return (
    <div className="mx-auto max-w-[780px] text-center">
      {/* ENGLISH TITLE */}

      <p className="font-wedding-serif text-[11px] font-medium uppercase tracking-[0.3em] text-[#C98792] sm:text-[13px] md:text-[14px]">
        {GALLERY_CONTENT.eyebrow}
      </p>

      {/* MAIN TITLE */}

      <h2 className="font-wedding-serif mt-4 text-[26px] font-medium uppercase leading-tight tracking-[0.045em] text-[#9B7B4D] sm:text-[32px] md:text-[40px] lg:text-[44px]">
        {GALLERY_CONTENT.title}
      </h2>

      {/* DECORATION */}

      <div className="mt-5">
        <GalleryDivider />
      </div>

      {/* DESCRIPTION */}

      <p className="font-wedding-serif mx-auto mt-6 max-w-[590px] text-[16px] leading-7 text-[#61726D] sm:text-[19px] sm:leading-8 md:text-[21px]">
        {GALLERY_CONTENT.description}
      </p>
    </div>
  );
}

// ======================================================
// EMPTY GALLERY CARD
//
// Không hiển thị ảnh, chữ hoặc icon.
// ======================================================

function EmptyGalleryCard() {
  return (
    <div
      aria-hidden="true"
      className="
        relative h-full w-full
        overflow-hidden
        rounded-[24px]
        border border-[#FFFDF8]/85
        p-[5px]
        shadow-[0_24px_65px_rgba(49,86,107,0.06)]
        sm:rounded-[28px]
        lg:rounded-[32px]
      "
      style={{
        backgroundColor: EMPTY_PHOTO_BACKGROUND,
      }}
    >
      <div
        className="
          h-full w-full
          rounded-[20px]
          sm:rounded-[24px]
          lg:rounded-[28px]
        "
        style={{
          backgroundColor: EMPTY_PHOTO_BACKGROUND,
        }}
      />
    </div>
  );
}

// ======================================================
// EMPTY GALLERY GRID
//
// Hiển thị 6 khung ảnh trống.
// Giữ nguyên bố cục khi chưa có ảnh.
// ======================================================

function EmptyGalleryGrid() {
  return (
    <div className="grid grid-cols-1 items-start gap-5 sm:grid-cols-2 sm:gap-5 lg:grid-cols-12 lg:gap-6">
      {Array.from(
        { length: EMPTY_PLACEHOLDER_COUNT },
        (_, index) => {
          const layout =
            PHOTO_LAYOUTS[
              index % PHOTO_LAYOUTS.length
            ];

          return (
            <div
              key={`empty-gallery-${index}`}
              className={`
                relative h-[390px] min-w-0
                sm:h-[420px]
                ${layout}
              `}
            >
              <EmptyGalleryCard />
            </div>
          );
        }
      )}
    </div>
  );
}

// ======================================================
// PHOTO CARD
//
// Nội dung hiển thị trên mỗi ảnh:
// - ẢNH CƯỚI NAM & THƯ
// - Tên ảnh từ Admin hoặc tên mặc định.
// ======================================================

function GalleryPhotoCard({
  photo,
  index,
  onOpen,
}: {
  photo: GalleryPhoto;
  index: number;
  onOpen: (index: number) => void;
}) {
  const photoTitle = getPhotoTitle(photo);

  return (
    <button
      type="button"
      onClick={() => onOpen(index)}
      aria-label={`Xem ảnh cưới ${index + 1}: ${photoTitle}`}
      className="
        group relative block h-full w-full min-h-0
        overflow-hidden rounded-[24px]
        border border-[#FFFDF8]/85
        bg-[#F1F3EB] p-[5px] text-left
        shadow-[0_24px_65px_rgba(49,86,107,0.10)]
        transition-all duration-500
        hover:-translate-y-1
        hover:shadow-[0_30px_75px_rgba(49,86,107,0.15)]
        focus-visible:outline
        focus-visible:outline-2
        focus-visible:outline-offset-4
        focus-visible:outline-[#31566B]
        sm:rounded-[28px]
        lg:rounded-[32px]
      "
    >
      <div className="relative h-full w-full overflow-hidden rounded-[20px] sm:rounded-[24px] lg:rounded-[28px]">
        {/* IMAGE */}

        <GalleryImage
          src={photo.imageUrl}
          alt={photoTitle}
          sizes="(max-width: 639px) 92vw, (max-width: 1023px) 46vw, 65vw"
        />

        {/* GRADIENT ĐỂ ĐỌC ĐƯỢC CHÚ THÍCH */}

        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[#183747]/60 via-[#213E50]/5 to-transparent opacity-75 transition-opacity duration-500 group-hover:opacity-90" />

        {/* PHOTO NUMBER */}

        <div className="pointer-events-none absolute left-4 top-4 flex h-9 w-9 items-center justify-center rounded-full border border-white/40 bg-white/20 font-wedding-serif text-[11px] font-medium text-white shadow-lg backdrop-blur-md sm:left-5 sm:top-5">
          {String(index + 1).padStart(2, "0")}
        </div>

        {/* PHOTO CAPTION */}

        <div className="pointer-events-none absolute bottom-4 left-4 right-4 flex items-end justify-between gap-4 sm:bottom-5 sm:left-5 sm:right-5">
          <div className="min-w-0 flex-1">
            <p className="text-[9px] font-medium uppercase tracking-[0.24em] text-white/75 sm:text-[10px]">
              {GALLERY_CONTENT.imageLabel}
            </p>

            <p className="font-wedding-serif mt-1 line-clamp-1 text-[17px] font-normal text-white sm:text-lg">
              {photoTitle}
            </p>
          </div>

          <span
            aria-hidden="true"
            className="
              flex h-11 w-11 shrink-0
              items-center justify-center
              rounded-full
              border border-white/45
              bg-white/10
              font-wedding-serif text-2xl
              font-light text-white
              backdrop-blur-md
              transition-all duration-300
              group-hover:rotate-90
              group-hover:border-white
              group-hover:bg-white
              group-hover:text-[#31566B]
            "
          >
            +
          </span>
        </div>
      </div>
    </button>
  );
}

// ======================================================
// EDITORIAL GALLERY GRID
//
// Giữ nguyên bố cục ảnh so le.
// ======================================================

function EditorialGalleryGrid({
  photos,
  onOpen,
}: {
  photos: GalleryPhoto[];
  onOpen: (index: number) => void;
}) {
  return (
    <div className="grid grid-cols-1 items-start gap-5 sm:grid-cols-2 sm:gap-5 lg:grid-cols-12 lg:gap-6">
      {photos.map((photo, index) => {
        const layout =
          PHOTO_LAYOUTS[
            index % PHOTO_LAYOUTS.length
          ];

        return (
          <div
            key={photo.id}
            className={`
              relative h-[390px] min-w-0
              sm:h-[420px]
              ${layout}
            `}
          >
            <GalleryPhotoCard
              photo={photo}
              index={index}
              onOpen={onOpen}
            />
          </div>
        );
      })}
    </div>
  );
}

// ======================================================
// LIGHTBOX
//
// GIỮ NGUYÊN:
// - Xem ảnh toàn màn hình.
// - Zoom 1x đến 3x.
// - Điều hướng bằng nút.
// - Điều hướng bằng bàn phím.
// - Vuốt ảnh trên mobile.
// - Khóa cuộn trang khi mở.
// - Khôi phục focus khi đóng.
//
// CẬP NHẬT:
// - Chú thích thống nhất với Album ảnh cưới.
// ======================================================

function GalleryLightbox({
  photos,
  activeIndex,
  onClose,
  onNext,
  onPrevious,
}: {
  photos: GalleryPhoto[];
  activeIndex: number;
  onClose: () => void;
  onNext: () => void;
  onPrevious: () => void;
}) {
  // ==================================================
  // STATE
  // ==================================================

  const [zoom, setZoom] = useState(1);

  const touchStartX =
    useRef<number | null>(null);

  const closeButtonRef =
    useRef<HTMLButtonElement>(null);

  const photo = photos[activeIndex];

  const canNavigate = photos.length > 1;

  // ==================================================
  // RESET ZOOM KHI CHUYỂN ẢNH
  //
  // Không dùng useEffect để setZoom.
  // ==================================================

  const handleNext = useCallback(() => {
    setZoom(1);
    onNext();
  }, [onNext]);

  const handlePrevious = useCallback(() => {
    setZoom(1);
    onPrevious();
  }, [onPrevious]);

  // ==================================================
  // KEYBOARD & FOCUS
  // ==================================================

  useEffect(() => {
    const previousOverflow =
      document.body.style.overflow;

    const previousFocus =
      document.activeElement;

    document.body.style.overflow = "hidden";

    closeButtonRef.current?.focus();

    function onKeyDown(event: KeyboardEvent) {
      // ESC: Đóng Album.
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
      }

      // Mũi tên phải: Ảnh tiếp theo.
      if (
        event.key === "ArrowRight" &&
        zoom === 1 &&
        canNavigate
      ) {
        event.preventDefault();
        handleNext();
      }

      // Mũi tên trái: Ảnh trước.
      if (
        event.key === "ArrowLeft" &&
        zoom === 1 &&
        canNavigate
      ) {
        event.preventDefault();
        handlePrevious();
      }

      // Phóng to bằng + hoặc =.
      if (
        event.key === "+" ||
        event.key === "="
      ) {
        event.preventDefault();

        setZoom((current) =>
          Math.min(
            MAX_ZOOM,
            current + ZOOM_STEP
          )
        );
      }

      // Thu nhỏ bằng -.
      if (event.key === "-") {
        event.preventDefault();

        setZoom((current) =>
          Math.max(
            MIN_ZOOM,
            current - ZOOM_STEP
          )
        );
      }

      // Giữ focus trong Lightbox.
      if (event.key === "Tab") {
        const dialog =
          document.getElementById(
            "wedding-gallery-lightbox"
          );

        if (!dialog) return;

        const elements = Array.from(
          dialog.querySelectorAll<HTMLElement>(
            'button:not([disabled]), a[href]'
          )
        );

        if (elements.length === 0) return;

        const first = elements[0];
        const last =
          elements[elements.length - 1];

        if (
          event.shiftKey &&
          document.activeElement === first
        ) {
          event.preventDefault();
          last.focus();
        } else if (
          !event.shiftKey &&
          document.activeElement === last
        ) {
          event.preventDefault();
          first.focus();
        }
      }
    }

    document.addEventListener(
      "keydown",
      onKeyDown
    );

    return () => {
      document.body.style.overflow =
        previousOverflow;

      document.removeEventListener(
        "keydown",
        onKeyDown
      );

      if (
        previousFocus instanceof HTMLElement
      ) {
        previousFocus.focus();
      }
    };
  }, [
    onClose,
    handleNext,
    handlePrevious,
    zoom,
    canNavigate,
  ]);

  // ==================================================
  // TOUCH SWIPE - MOBILE
  // ==================================================

  function handleTouchStart(
    event: TouchEvent<HTMLDivElement>
  ) {
    if (event.touches.length !== 1) {
      touchStartX.current = null;
      return;
    }

    touchStartX.current =
      event.touches[0].clientX;
  }

  function handleTouchEnd(
    event: TouchEvent<HTMLDivElement>
  ) {
    if (
      touchStartX.current === null ||
      zoom !== 1
    ) {
      touchStartX.current = null;
      return;
    }

    const endX =
      event.changedTouches[0]?.clientX;

    if (endX === undefined) {
      touchStartX.current = null;
      return;
    }

    const distance =
      endX - touchStartX.current;

    touchStartX.current = null;

    if (
      Math.abs(distance) < SWIPE_THRESHOLD
    ) {
      return;
    }

    if (distance < 0) {
      handleNext();
    } else {
      handlePrevious();
    }
  }

  if (!photo) return null;

  const coupleName =
    `${wedding.groom.shortName} & ` +
    wedding.bride.shortName;

  const photoTitle = getPhotoTitle(photo);

  // ==================================================
  // RENDER LIGHTBOX
  // ==================================================

  return (
    <div
      id="wedding-gallery-lightbox"
      role="dialog"
      aria-modal="true"
      aria-label={`Album ảnh cưới, ảnh ${activeIndex + 1} trên ${photos.length}`}
      className="fixed inset-0 z-[9999] flex flex-col bg-[#101B21]/[0.97] text-white backdrop-blur-xl"
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      {/* HEADER */}

      <div className="relative z-20 flex h-[68px] shrink-0 items-center justify-between border-b border-white/10 px-4 sm:h-[76px] sm:px-8">
        <div>
          <p className="font-wedding-serif text-[10px] uppercase tracking-[0.28em] text-[#E3CCAA] sm:text-xs">
            Album ảnh cưới {coupleName}
          </p>

          <p className="font-wedding-serif mt-1 text-[12px] text-white/60 sm:text-[14px]">
            {String(activeIndex + 1).padStart(
              2,
              "0"
            )}
            {" / "}
            {String(photos.length).padStart(
              2,
              "0"
            )}
          </p>
        </div>

        {/* ZOOM & CLOSE */}

        <div className="flex items-center gap-2 sm:gap-3">
          {/* ZOOM OUT */}

          <button
            type="button"
            onClick={() =>
              setZoom((value) =>
                Math.max(
                  MIN_ZOOM,
                  value - ZOOM_STEP
                )
              )
            }
            disabled={zoom <= MIN_ZOOM}
            aria-label="Thu nhỏ ảnh cưới"
            className="flex h-9 w-9 items-center justify-center rounded-full border border-white/15 text-white/80 transition-colors hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-30 sm:h-10 sm:w-10"
          >
            <Minus size={17} />
          </button>

          {/* ZOOM IN */}

          <button
            type="button"
            onClick={() =>
              setZoom((value) =>
                Math.min(
                  MAX_ZOOM,
                  value + ZOOM_STEP
                )
              )
            }
            disabled={zoom >= MAX_ZOOM}
            aria-label="Phóng to ảnh cưới"
            className="flex h-9 w-9 items-center justify-center rounded-full border border-white/15 text-white/80 transition-colors hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-30 sm:h-10 sm:w-10"
          >
            <Plus size={17} />
          </button>

          {/* CLOSE */}

          <button
            ref={closeButtonRef}
            type="button"
            onClick={onClose}
            aria-label="Đóng Album ảnh cưới"
            className="ml-1 flex h-10 w-10 items-center justify-center rounded-full border border-white/20 text-white transition-colors hover:border-[#C98792] hover:bg-[#C98792] sm:h-11 sm:w-11"
          >
            <X
              size={21}
              strokeWidth={1.5}
            />
          </button>
        </div>
      </div>

      {/* PHOTO VIEWER */}

      <div className="relative flex min-h-0 flex-1 items-center justify-center overflow-hidden px-12 py-6 sm:px-20 md:px-24">
        {/* CLICK BACKGROUND TO CLOSE */}

        <button
          type="button"
          onClick={onClose}
          aria-label="Đóng trình xem ảnh cưới"
          className="absolute inset-0 z-0 cursor-default"
        />

        {/* FULL PHOTO */}

        <div className="pointer-events-none relative z-10 h-full w-full max-w-[1100px]">
          <GalleryImage
            src={photo.imageUrl}
            alt={photoTitle}
            sizes="(max-width: 767px) 100vw, 90vw"
            contain
            zoom={zoom}
          />
        </div>

        {/* NAVIGATION */}

        {canNavigate && zoom === 1 && (
          <>
            {/* PREVIOUS */}

            <button
              type="button"
              onClick={handlePrevious}
              aria-label="Xem ảnh cưới trước"
              className="absolute left-2 z-20 flex h-10 w-10 items-center justify-center rounded-full border border-white/15 bg-white/5 text-white/90 backdrop-blur-sm transition-all duration-300 hover:bg-white/15 sm:left-5 sm:h-12 sm:w-12"
            >
              <ChevronLeft
                size={25}
                strokeWidth={1.4}
              />
            </button>

            {/* NEXT */}

            <button
              type="button"
              onClick={handleNext}
              aria-label="Xem ảnh cưới tiếp theo"
              className="absolute right-2 z-20 flex h-10 w-10 items-center justify-center rounded-full border border-white/15 bg-white/5 text-white/90 backdrop-blur-sm transition-all duration-300 hover:bg-white/15 sm:right-5 sm:h-12 sm:w-12"
            >
              <ChevronRight
                size={25}
                strokeWidth={1.4}
              />
            </button>
          </>
        )}
      </div>

      {/* LIGHTBOX FOOTER */}

      <div className="relative z-20 flex min-h-[64px] shrink-0 items-center justify-center gap-3 border-t border-white/10 px-4 text-center sm:min-h-[75px]">
        <Heart
          size={14}
          strokeWidth={1.3}
          className="text-[#C98792]"
        />

        <p className="font-wedding-serif text-[12px] italic text-white/65 sm:text-[15px]">
          {GALLERY_CONTENT.lightboxCaption}
        </p>

        <Heart
          size={14}
          strokeWidth={1.3}
          className="text-[#C98792]"
        />
      </div>
    </div>
  );
}

// ======================================================
// MAIN GALLERY
// ======================================================

export default function Gallery() {
  // ==================================================
  // DATABASE STATE
  // ==================================================

  const [photos, setPhotos] =
    useState<GalleryPhoto[]>([]);

  const [loadStatus, setLoadStatus] =
    useState<GalleryLoadStatus>("loading");

  const [visibleCount, setVisibleCount] =
    useState(INITIAL_VISIBLE_IMAGES);

  const [activeIndex, setActiveIndex] =
    useState<number | null>(null);

  // ==================================================
  // LOAD MONGODB GALLERY
  //
  // Không dùng ảnh cũ trước khi API phản hồi.
  // ==================================================

  useEffect(() => {
    const controller = new AbortController();

    async function loadGallery() {
      try {
        const response = await fetch(
          "/api/gallery",
          {
            method: "GET",
            cache: "no-store",
            signal: controller.signal,
          }
        );

        if (!response.ok) {
          throw new Error(
            "Không thể tải Album ảnh cưới từ MongoDB."
          );
        }

        const data =
          (await response.json()) as GalleryResponse;

        if (
          !data.success ||
          !Array.isArray(data.photos)
        ) {
          throw new Error(
            "Dữ liệu Album ảnh cưới không hợp lệ."
          );
        }

        // Chỉ nhận đường dẫn ảnh nội bộ hợp lệ.
        const validPhotos = data.photos.filter(
          (photo): photo is GalleryPhoto =>
            typeof photo.id === "string" &&
            typeof photo.imageUrl === "string" &&
            photo.imageUrl.startsWith("/") &&
            !photo.imageUrl.startsWith("//") &&
            typeof photo.alt === "string" &&
            typeof photo.sortOrder === "number"
        );

        // Giữ nguyên thứ tự được cấu hình ở Admin.
        validPhotos.sort(
          (a, b) =>
            a.sortOrder - b.sortOrder ||
            a.id.localeCompare(b.id)
        );

        if (!controller.signal.aborted) {
          setPhotos(validPhotos);
          setLoadStatus("success");

          // Reset số ảnh đang hiển thị.
          setVisibleCount(
            INITIAL_VISIBLE_IMAGES
          );

          // Đóng Lightbox khi danh sách đổi.
          setActiveIndex(null);
        }
      } catch (error) {
        if (controller.signal.aborted) {
          return;
        }

        console.error(
          "[WEDDING GALLERY LOAD]",
          error
        );

        // API lỗi mới dùng fallback.
        setPhotos(FALLBACK_PHOTOS);
        setLoadStatus("error");
      }
    }

    void loadGallery();

    return () => {
      controller.abort();
    };
  }, []);

  // ==================================================
  // DISPLAY STATE
  // ==================================================

  const visiblePhotos = photos.slice(
    0,
    visibleCount
  );

  const hasMore =
    visibleCount < photos.length;

  const canCollapse =
    visibleCount > INITIAL_VISIBLE_IMAGES;

  // Khi đang tải hoặc Album thực sự rỗng,
  // hiển thị 6 khung ảnh trống.
  const showEmptyLayout =
    loadStatus === "loading" ||
    photos.length === 0;

  // ==================================================
  // LIGHTBOX ACTIONS
  // ==================================================

  const closeLightbox = useCallback(() => {
    setActiveIndex(null);
  }, []);

  const nextPhoto = useCallback(() => {
    setActiveIndex((current) => {
      if (
        current === null ||
        photos.length === 0
      ) {
        return current;
      }

      return (
        current + 1
      ) % photos.length;
    });
  }, [photos.length]);

  const previousPhoto = useCallback(() => {
    setActiveIndex((current) => {
      if (
        current === null ||
        photos.length === 0
      ) {
        return current;
      }

      return (
        current - 1 + photos.length
      ) % photos.length;
    });
  }, [photos.length]);

  function openPhoto(index: number) {
    setActiveIndex(index);
  }

  // ==================================================
  // LOAD MORE
  // ==================================================

  function loadMore() {
    setVisibleCount((current) =>
      Math.min(
        current + IMAGES_PER_LOAD,
        photos.length
      )
    );
  }

  // ==================================================
  // COLLAPSE
  // ==================================================

  function collapsePhotos() {
    setVisibleCount(
      INITIAL_VISIBLE_IMAGES
    );
  }

  // ==================================================
  // RENDER
  // ==================================================

  return (
    <>
      {/* ==========================================
          GALLERY SECTION
      ========================================== */}

      <section
        id="gallery"
        className="
          relative -mt-px scroll-mt-16
          overflow-hidden
          bg-[linear-gradient(to_bottom,#EEF4F6_0%,#F9F8EE_24%,#FFFDF8_65%,#F6F6ED_100%)]
          px-4 py-16
          sm:px-6 sm:py-20
          md:px-8 md:py-24
          lg:py-28
        "
      >
        {/* BACKGROUND DECORATION */}

        <div
          aria-hidden="true"
          className="pointer-events-none absolute -left-[200px] top-[12%] h-[500px] w-[500px] rounded-full bg-[#8FB4C7]/10 blur-[150px]"
        />

        <div
          aria-hidden="true"
          className="pointer-events-none absolute -right-[200px] bottom-[15%] h-[500px] w-[500px] rounded-full bg-[#D9A5AE]/10 blur-[150px]"
        />

        <div className="relative z-10 mx-auto max-w-[1250px]">
          {/* HEADING */}

          <GalleryHeading />

          {/* PHOTO GRID */}

          <div className="mt-12 sm:mt-14 md:mt-16 lg:mt-20">
            {showEmptyLayout ? (
              <EmptyGalleryGrid />
            ) : (
              <EditorialGalleryGrid
                photos={visiblePhotos}
                onOpen={openPhoto}
              />
            )}
          </div>

          {/* ==========================================
              LOAD MORE / COLLAPSE
          ========================================== */}

          {!showEmptyLayout &&
            (hasMore || canCollapse) && (
              <div className="mt-11 flex flex-wrap items-center justify-center gap-3 sm:mt-14">
                {/* XEM THÊM ẢNH CƯỚI */}

                {hasMore && (
                  <button
                    type="button"
                    onClick={loadMore}
                    className="
                      group inline-flex min-h-[52px]
                      min-w-[200px]
                      items-center justify-center gap-3
                      rounded-full
                      border border-[#31566B]/40
                      bg-transparent px-8
                      text-[11px] font-medium uppercase
                      tracking-[0.17em] text-[#31566B]
                      transition-all duration-300
                      hover:-translate-y-0.5
                      hover:border-[#31566B]
                      hover:bg-[#31566B]
                      hover:text-white
                    "
                  >
                    <span>
                      {GALLERY_CONTENT.loadMore}
                    </span>

                    <ArrowRight
                      size={16}
                      strokeWidth={1.5}
                      className="transition-transform duration-300 group-hover:translate-x-1"
                    />
                  </button>
                )}

                {/* THU GỌN ALBUM */}

                {canCollapse && (
                  <button
                    type="button"
                    onClick={collapsePhotos}
                    className="
                      inline-flex min-h-[52px]
                      items-center justify-center
                      rounded-full
                      border border-[#B8A27D]/55
                      px-7
                      text-[11px] font-medium uppercase
                      tracking-[0.17em] text-[#9B7B4D]
                      transition-colors duration-300
                      hover:bg-[#B8A27D]/10
                    "
                  >
                    {GALLERY_CONTENT.collapse}
                  </button>
                )}
              </div>
            )}

          {/* ==========================================
              BOTTOM MESSAGE

              Nội dung mới tập trung vào
              ý nghĩa của Album ảnh cưới.
          ========================================== */}

          <div className="mx-auto mt-14 max-w-[680px] text-center sm:mt-16 md:mt-20">
            <GalleryDivider />

            <p className="font-wedding-serif mx-auto mt-6 max-w-[520px] text-[16px] italic leading-7 text-[#61726D]/90 sm:text-[18px]">
              {GALLERY_CONTENT.closing}
            </p>
          </div>
        </div>
      </section>

      {/* ==========================================
          FULLSCREEN LIGHTBOX
      ========================================== */}

      {!showEmptyLayout &&
        activeIndex !== null &&
        activeIndex < photos.length && (
          <GalleryLightbox
            photos={photos}
            activeIndex={activeIndex}
            onClose={closeLightbox}
            onNext={nextPhoto}
            onPrevious={previousPhoto}
          />
        )}
    </>
  );
}
