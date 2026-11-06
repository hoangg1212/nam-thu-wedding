
"use client";

import {
  useSearchParams,
} from "next/navigation";

import {
  type GuestSide,
} from "@/data/wedding";

import WeddingHeader from "./WeddingHeader";
import Hero from "./Hero";
import WeddingInvitation from "./WeddingInvitation";
import Gallery from "./Gallery";
import LoveStory from "./LoveStory";
import Wishes from "./Wishes";
import Countdown from "./Countdown";
import ThankYou from "./ThankYou";
import WeddingFooter from "./WeddingFooter";

// ======================================================
// NAM & THU - WEDDING PAGE
//
// Hỗ trợ:
// - Link thiệp cá nhân hóa /invite/[token].
// - Link cũ ?guest=...&side=...
//
// CẬP NHẬT:
// Truyền guestSide vào Wishes để tự chọn đúng
// mối quan hệ của khách Nhà trai / Nhà gái.
//
// Giữ nguyên toàn bộ thứ tự section.
// ======================================================

interface WeddingPageProps {
  guestName?: string;
  guestSide?: GuestSide;
}

export default function WeddingPage({
  guestName: providedGuestName,
  guestSide: providedGuestSide,
}: WeddingPageProps) {
  const searchParams = useSearchParams();

  const nameFromUrl =
    searchParams.get("guest");

  const sideFromUrl =
    searchParams.get("side");

  // ==================================================
  // TÊN KHÁCH MỜI
  // ==================================================

  const guestName =
    providedGuestName !== undefined
      ? providedGuestName.trim().slice(0, 120) ||
        "Quý khách"
      : nameFromUrl?.trim().slice(0, 100) ||
        "Quý khách";

  // ==================================================
  // NHÀ TRAI / NHÀ GÁI
  // ==================================================

  const guestSide: GuestSide =
    providedGuestSide ??
    (sideFromUrl === "bride"
      ? "bride"
      : "groom");

  // ==================================================
  // MAIN WEBSITE
  // ==================================================

  return (
    <main className="wedding-page">
      {/* HEADER */}
      <WeddingHeader />

      {/* HERO */}
      <Hero />

      {/* THƯ MỜI */}
      <WeddingInvitation
        guestName={guestName}
        guestSide={guestSide}
      />

      {/* ALBUM */}
      <Gallery />

      {/* HÀNH TRÌNH TÌNH YÊU */}
      <LoveStory />

      {/* GỬI LỜI CHÚC + XÁC NHẬN THAM DỰ */}
      <Wishes
        guestName={guestName}
        guestSide={guestSide}
      />

      {/* ĐẾM NGƯỢC */}
      <Countdown
        guestSide={guestSide}
      />

      {/* LỜI CẢM ƠN */}
      <ThankYou />

      {/* FOOTER */}
      <WeddingFooter />
    </main>
  );
}
