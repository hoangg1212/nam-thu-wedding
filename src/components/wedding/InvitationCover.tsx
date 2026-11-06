
"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";

import {
  wedding,
  getWeddingLocation,
  formatWeddingDate,
  type GuestSide,
} from "@/data/wedding";

import {
  useWedding,
} from "@/components/providers/WeddingProvider";

// ======================================================
// NAM & THU - INVITATION COVER
//
// GIAO DIỆN:
// - Ảnh nền giữ nguyên màu gốc.
// - Không phủ đen toàn màn hình.
// - Không có khung nền đen sau chữ.
// - Không sử dụng backdrop-blur.
// - Chữ trắng kem, có bóng nhẹ để dễ đọc.
// - Phong cách nhẹ nhàng, thanh lịch.
//
// GIỮ NGUYÊN:
// - Link thiệp cá nhân hóa.
// - Phân biệt Nhà trai / Nhà gái.
// - Tên khách từ MongoDB.
// - Responsive mobile / desktop.
// - Hiệu ứng mở thiệp 900ms.
// - Phát nhạc khi mở thiệp.
// ======================================================

interface InvitationCoverProps {
  guestName?: string;
  guestSide?: GuestSide;
}

// ======================================================
// TEXT STYLE
//
// Chỉ sử dụng bóng chữ vừa phải.
// Không tạo nền tối bao quanh nội dung.
// ======================================================

const NAME_STYLE = {
  color: "#FFF9ED",
  textShadow:
    "0 2px 3px rgba(0,0,0,0.55), " +
    "0 5px 14px rgba(0,0,0,0.38)",
};

const TEXT_STYLE = {
  textShadow:
    "0 1px 3px rgba(0,0,0,0.65), " +
    "0 3px 9px rgba(0,0,0,0.32)",
};

const SOFT_STYLE = {
  textShadow:
    "0 1px 3px rgba(0,0,0,0.50), " +
    "0 2px 7px rgba(0,0,0,0.25)",
};

// ======================================================
// FINGERPRINT HEART
// ======================================================

function FingerprintHeart() {
  return (
    <div
      aria-hidden="true"
      className="mx-auto flex items-center justify-center"
    >
      <svg
        viewBox="0 0 120 64"
        className="
          h-[36px] w-[72px]
          sm:h-[48px] sm:w-[90px]
          md:h-[58px] md:w-[105px]
        "
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <g
          stroke="#F2B5C1"
          strokeWidth="1.4"
          strokeLinecap="round"
          opacity="0.95"
        >
          <path d="M57 51 C42 44 30 34 30 22 C30 14 35 9 42 9 C50 9 55 15 57 22" />
          <path d="M54 47 C42 41 34 32 34 23 C34 17 37 13 42 13 C48 13 52 18 54 25" />
          <path d="M51 43 C43 38 38 31 38 24 C38 20 40 17 43 17 C47 17 49 21 51 27" />
          <path d="M47 39 C43 35 41 30 41 25 C41 22 42 21 44 21 C46 21 47 24 47 29" />
        </g>

        <g
          stroke="#F2B5C1"
          strokeWidth="1.4"
          strokeLinecap="round"
          opacity="0.95"
        >
          <path d="M63 51 C78 44 90 34 90 22 C90 14 85 9 78 9 C70 9 65 15 63 22" />
          <path d="M66 47 C78 41 86 32 86 23 C86 17 83 13 78 13 C72 13 68 18 66 25" />
          <path d="M69 43 C77 38 82 31 82 24 C82 20 80 17 77 17 C73 17 71 21 69 27" />
          <path d="M73 39 C77 35 79 30 79 25 C79 22 78 21 76 21 C74 21 73 24 73 29" />
        </g>

        <path
          d="M57 22 C59 27 59 31 60 37 C61 31 61 27 63 22"
          stroke="#FFE2E7"
          strokeWidth="1.3"
        />
      </svg>
    </div>
  );
}

// ======================================================
// MAIN COMPONENT
// ======================================================

export default function InvitationCover({
  guestName: providedGuestName,
  guestSide: providedGuestSide,
}: InvitationCoverProps) {
  const {
    invitationOpened,
    finishInvitation,
    playMusic,
  } = useWedding();

  const searchParams = useSearchParams();

  // ====================================================
  // XÁC ĐỊNH BÊN MỜI
  // ====================================================

  const side: GuestSide =
    providedGuestSide ??
    (
      searchParams.get("side") === "bride"
        ? "bride"
        : "groom"
    );

  // ====================================================
  // TÊN KHÁCH
  // ====================================================

  const guestName =
    providedGuestName !== undefined
      ? providedGuestName.trim().slice(0, 120) ||
        "Quý khách"
      : searchParams
          .get("guest")
          ?.trim()
          .slice(0, 100) ||
        "Quý khách";

  const event = getWeddingLocation(side);

  // ====================================================
  // TRẠNG THÁI MỞ THIỆP
  // ====================================================

  const [opening, setOpening] = useState(false);

  const timerRef =
    useRef<ReturnType<typeof setTimeout> | null>(
      null
    );

  useEffect(() => {
    return () => {
      if (timerRef.current !== null) {
        clearTimeout(timerRef.current);
      }
    };
  }, []);

  // ====================================================
  // XỬ LÝ MỞ THIỆP
  // ====================================================

  function handleOpen() {
    if (opening || invitationOpened) {
      return;
    }

    setOpening(true);

    // Nhạc chỉ phát sau khi người dùng tương tác.
    void playMusic();

    // Giữ nguyên hiệu ứng mở thiệp.
    timerRef.current = setTimeout(() => {
      finishInvitation();
    }, 900);
  }

  if (invitationOpened) {
    return null;
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Thiệp mời cưới Nam và Thư"
      className={`
        fixed inset-0 z-[9000]
        h-[100dvh] w-full
        overflow-x-hidden overflow-y-auto
        overscroll-contain
        bg-[#F5F3E8]
        transition-[opacity,transform]
        duration-[900ms] ease-in-out
        ${
          opening
            ? "pointer-events-none scale-[1.01] opacity-0"
            : "scale-100 opacity-100"
        }
      `}
    >
      {/* ================================================
          BACKGROUND MOBILE

          Hiển thị ảnh gốc.
          Không làm mờ hoặc chỉnh độ trong suốt.
      ================================================ */}

      <div className="pointer-events-none fixed inset-0 md:hidden">
        <Image
          src="/images/invitation-cover-mobile.png"
          alt=""
          fill
          priority
          sizes="100vw"
          className="object-cover object-center"
        />
      </div>

      {/* ================================================
          BACKGROUND DESKTOP
      ================================================ */}

      <div className="pointer-events-none fixed inset-0 hidden md:block">
        <Image
          src="/images/invitation-cover-desktop.jpg"
          alt=""
          fill
          priority
          sizes="100vw"
          className="object-cover object-center"
        />
      </div>

      {/* ================================================
          TRANG TRÍ VIỀN

          Không phủ thêm màu lên ảnh nền.
      ================================================ */}

      <div
        aria-hidden="true"
        className="
          pointer-events-none fixed
          inset-3 rounded-[22px]
          border border-white/45
          sm:inset-4 md:inset-6
        "
      />

      <div
        aria-hidden="true"
        className="
          pointer-events-none fixed
          inset-[18px] rounded-[18px]
          border border-white/25
          sm:inset-[22px] md:inset-8
        "
      />

      {/* ================================================
          MAIN CONTENT

          Không có nền đen phía sau chữ.
          Khi màn hình thấp, nội dung có thể cuộn.
      ================================================ */}

      <div
        className={`
          relative z-10 mx-auto flex
          min-h-[100dvh] w-full max-w-[1450px]
          flex-col px-5 text-center
          pt-[max(24px,env(safe-area-inset-top))]
          pb-[max(28px,env(safe-area-inset-bottom))]
          transition-all duration-700
          sm:px-10 sm:py-10
          md:px-12 md:py-12
          ${
            opening
              ? "-translate-y-4 opacity-0"
              : "translate-y-0 opacity-100"
          }
        `}
      >
        <div
          className="
            mx-auto my-auto
            w-full max-w-[620px]
            min-w-0 py-2
          "
        >
          {/* TOP LABEL */}

          <div className="mb-3 flex items-center justify-center gap-3 sm:mb-6">
            <span className="h-px w-7 bg-[#F3DCAA]/85 sm:w-8" />

            <p
              className="
                text-[10px] font-semibold
                uppercase tracking-[0.26em]
                text-[#FFF8E9]
                sm:text-[11px]
              "
              style={TEXT_STYLE}
            >
              Ngày chung đôi
            </p>

            <span className="h-px w-7 bg-[#F3DCAA]/85 sm:w-8" />
          </div>

          {/* CHÚ RỂ */}

          <p
            className="
              text-[10px] font-semibold
              uppercase tracking-[0.30em]
              text-[#FFD5DD]
              sm:text-[11px]
            "
            style={TEXT_STYLE}
          >
            Chú rể
          </p>

          <h1
            className="
              font-wedding mt-1
              whitespace-normal break-words
              text-[clamp(2.7rem,11vw,3.6rem)]
              leading-[1.08]
              sm:text-[75px]
              md:text-[87px]
              lg:text-[93px]
            "
            style={NAME_STYLE}
          >
            {wedding.groom.fullName}
          </h1>

          {/* KÝ HIỆU & */}

          <div className="my-1 flex items-center justify-center gap-4">
            <span className="h-px w-8 bg-[#F3DCAA]/75" />

            <span
              className="
                font-wedding-serif
                text-[22px] italic
                text-[#FFE4B0]
                sm:text-[25px]
              "
              style={SOFT_STYLE}
            >
              &
            </span>

            <span className="h-px w-8 bg-[#F3DCAA]/75" />
          </div>

          {/* CÔ DÂU */}

          <p
            className="
              text-[10px] font-semibold
              uppercase tracking-[0.30em]
              text-[#FFD5DD]
              sm:text-[11px]
            "
            style={TEXT_STYLE}
          >
            Cô dâu
          </p>

          <h1
            className="
              font-wedding mt-1
              whitespace-normal break-words
              text-[clamp(2.7rem,11vw,3.6rem)]
              leading-[1.08]
              sm:text-[75px]
              md:text-[87px]
              lg:text-[93px]
            "
            style={NAME_STYLE}
          >
            {wedding.bride.fullName}
          </h1>

          {/* TRÁI TIM */}

          <div className="mt-2 sm:mt-3">
            <FingerprintHeart />
          </div>

          {/* NGÀY CƯỚI */}

          <p
            className="
              font-wedding-serif
              mt-2 break-words
              text-[14px] font-semibold
              leading-6 tracking-[0.04em]
              text-[#FFF9ED]
              sm:text-[20px]
              sm:tracking-[0.08em]
            "
            style={TEXT_STYLE}
          >
            {event.weekdayLabel},{" "}
            {formatWeddingDate(event.eventDate)}
          </p>

          <p
            className="
              font-wedding-serif
              mt-1 text-[17px]
              font-medium italic
              leading-6 text-[#FFD5DD]
              sm:mt-2 sm:text-[23px]
            "
            style={TEXT_STYLE}
          >
            {event.eventTitle}
          </p>

          {event.time.trim() && (
            <p
              className="
                font-wedding-serif
                mt-1 text-[15px]
                font-medium text-[#FFF9ED]
                sm:text-[17px]
              "
              style={TEXT_STYLE}
            >
              Vào lúc {event.time}
            </p>
          )}

          {/* ĐƯỜNG PHÂN CÁCH */}

          <div className="my-3 flex items-center justify-center gap-3 sm:my-5">
            <span className="h-px w-10 bg-[#F3DCAA]/80" />

            <span
              className="text-[#FFD5DD]"
              style={SOFT_STYLE}
            >
              ♡
            </span>

            <span className="h-px w-10 bg-[#F3DCAA]/80" />
          </div>

          {/* LỜI MỜI */}

          <p
            className="
              font-wedding-serif
              text-[16px] font-medium
              leading-6 text-[#FFF9ED]
              sm:text-[21px]
            "
            style={TEXT_STYLE}
          >
            Trân trọng kính mời
          </p>

          {/* TÊN KHÁCH */}

          <h2
            className="
              font-wedding-serif
              mx-auto my-2
              max-w-[500px]
              whitespace-normal break-words
              text-[clamp(1.65rem,7vw,2.1rem)]
              font-semibold leading-[1.25]
              text-[#FFE7B8]
              [overflow-wrap:anywhere]
              sm:text-[39px]
            "
            style={TEXT_STYLE}
          >
            {guestName}
          </h2>

          {/* NỘI DUNG */}

          <p
            className="
              font-wedding-serif
              mx-auto max-w-[470px]
              text-[15px] font-medium
              leading-[1.65] text-[#FFF9ED]
              sm:text-[20px] sm:leading-7
            "
            style={TEXT_STYLE}
          >
            đến chung vui và sẻ chia niềm hạnh phúc
            cùng gia đình chúng mình.
          </p>

          {/* NÚT MỞ THIỆP */}

          <button
            type="button"
            onClick={handleOpen}
            disabled={opening}
            className="
              group mt-5 inline-flex
              min-h-[50px] min-w-[190px]
              items-center justify-center
              gap-3 rounded-full
              border border-[#EED9AD]
              bg-[#FFF9EC]/95
              px-8 py-3
              text-[11px] font-semibold
              uppercase tracking-[0.2em]
              text-[#294E42]
              shadow-[0_8px_25px_rgba(0,0,0,0.15)]
              transition-all duration-300
              hover:-translate-y-0.5
              hover:border-[#FFD0DA]
              hover:bg-[#F4C4CF]
              hover:text-[#253F36]
              focus-visible:outline-none
              focus-visible:ring-2
              focus-visible:ring-[#FFF1CD]
              disabled:pointer-events-none
              sm:mt-7 sm:min-h-[54px]
            "
          >
            <span>
              {opening
                ? "Đang mở thiệp"
                : "Mở thiệp"}
            </span>

            <span
              aria-hidden="true"
              className="transition-transform group-hover:translate-x-1"
            >
              →
            </span>
          </button>

          {/* LỜI NHẮN CUỐI */}

          <p
            className="
              font-wedding-serif
              mt-3 text-[12px]
              italic leading-5
              text-[#FFF9ED]
              sm:mt-4 sm:text-[13px]
            "
            style={SOFT_STYLE}
          >
            Một ngày đặc biệt, một lời mời trân quý
          </p>
        </div>
      </div>
    </div>
  );
}
