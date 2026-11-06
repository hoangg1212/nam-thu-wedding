
"use client";

import { Suspense } from "react";

import Preloader from "@/components/wedding/Preloader";
import InvitationCover from "@/components/wedding/InvitationCover";
import WeddingPage from "@/components/wedding/WeddingPage";

import MusicPlayer from "@/components/wedding/MusicPlayer";
import BackToTop from "@/components/wedding/BackToTop";
import CustomCursor from "@/components/wedding/CustomCursor";

import {
  WeddingProvider,
} from "@/components/providers/WeddingProvider";

export default function Home() {
  return (
    <WeddingProvider>
      {/* MÀN HÌNH TẢI */}
      <Preloader />

      {/* MÀN HÌNH MỞ THIỆP */}
      <Suspense fallback={null}>
        <InvitationCover />
      </Suspense>

      {/* WEBSITE CHÍNH */}
      <Suspense fallback={null}>
        <WeddingPage />
      </Suspense>

      {/* NÚT NHẠC */}
      <MusicPlayer />

      {/* NÚT TRỞ VỀ ĐẦU TRANG */}
      <BackToTop />

      {/* CON TRỎ TRÁI TIM */}
      <CustomCursor />
    </WeddingProvider>
  );
}

