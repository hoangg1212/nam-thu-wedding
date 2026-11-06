
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { connection } from "next/server";

import {
  getGuestCollection,
} from "@/lib/wedding-guests";

import {
  getInvitationCollection,
} from "@/lib/wedding-invitations";

import {
  WeddingProvider,
} from "@/components/providers/WeddingProvider";

import Preloader from "@/components/wedding/Preloader";
import InvitationCover from "@/components/wedding/InvitationCover";
import WeddingPage from "@/components/wedding/WeddingPage";

import MusicPlayer from "@/components/wedding/MusicPlayer";
import BackToTop from "@/components/wedding/BackToTop";
import CustomCursor from "@/components/wedding/CustomCursor";

import {
  type GuestSide,
} from "@/data/wedding";

// ======================================================
// NAM & THU - PERSONAL INVITATION PAGE
//
// GIAI ĐOẠN 3.10 - BƯỚC 4.1
//
// NEXT.JS 16.4.3 + CACHE COMPONENTS
//
// HỖ TRỢ HAI LOẠI LINK:
//
// CŨ:
// /invite/<48-character-token>
//
// MỚI:
// /invite/<guest-slug>-<48-character-token>
//
// Dữ liệu cũ:
// collection guests
//
// Dữ liệu mới:
// collection invitations -> guests
//
// GIỮ NGUYÊN:
// - WeddingProvider
// - Preloader
// - InvitationCover
// - WeddingPage
// - MusicPlayer
// - BackToTop
// - CustomCursor
//
// KHÔNG TRẢ VỀ:
// - Số điện thoại
// - Ghi chú
// - RSVP
// - Thông tin Admin
// ======================================================

// ======================================================
// TYPES
// ======================================================

interface InvitationPageProps {
  params: Promise<{
    token: string;
  }>;
}

interface InvitationData {
  guestName: string;
  guestSide: GuestSide;
}

// ======================================================
// CONSTANTS
// ======================================================

// Token cũ và token mới đều gồm 48 ký tự hex.
const TOKEN_REGEX = /^[a-f0-9]{48}$/i;

// Link mới gồm slug, dấu gạch ngang và token.
const NEW_LINK_REGEX =
  /^([a-z0-9]+(?:-[a-z0-9]+)*)-([a-f0-9]{48})$/i;

const MAX_ROUTE_LENGTH = 160;

// ======================================================
// GUEST DATA HELPER
//
// Chỉ lấy tên khách và bên mời.
// Không tiết lộ thông tin riêng tư.
// ======================================================

function createInvitationData(
  fullName: unknown,
  side: unknown
): InvitationData | null {
  if (
    side !== "groom" &&
    side !== "bride"
  ) {
    return null;
  }

  const guestName =
    typeof fullName === "string"
      ? Array.from(fullName.trim())
          .slice(0, 120)
          .join("")
      : "";

  return {
    guestName: guestName || "Quý khách",
    guestSide: side,
  };
}

// ======================================================
// LOAD LEGACY INVITATION
//
// Link cũ:
//
// /invite/<invitationToken>
//
// Đọc trực tiếp từ collection guests.
//
// Không thay đổi cách tra cứu cũ.
// ======================================================

async function loadLegacyInvitation(
  token: string
): Promise<InvitationData | null> {
  if (!TOKEN_REGEX.test(token)) {
    return null;
  }

  const collection =
    await getGuestCollection();

  const guest = await collection.findOne(
    {
      invitationToken: token.toLowerCase(),
      isDeleted: false,
    },
    {
      projection: {
        fullName: 1,
        side: 1,
      },
    }
  );

  if (!guest) {
    return null;
  }

  return createInvitationData(
    guest.fullName,
    guest.side
  );
}

// ======================================================
// LOAD NEW INVITATION
//
// Link mới:
//
// /invite/<slug>-<publicToken>
//
// BƯỚC 1:
// Tìm bản ghi trong invitations.
//
// BƯỚC 2:
// Kiểm tra thiệp chưa bị xóa.
//
// BƯỚC 3:
// Tìm khách liên kết bằng guestId.
//
// BƯỚC 4:
// Kiểm tra khách chưa bị xóa,
// đồng thời đúng bên mời.
//
// BƯỚC 5:
// Trả về tên và bên mời.
// ======================================================

async function loadNewInvitation(
  routeToken: string
): Promise<InvitationData | null> {
  const match =
    NEW_LINK_REGEX.exec(routeToken);

  if (!match) {
    return null;
  }

  const publicToken =
    match[2].toLowerCase();

  const invitationCollection =
    await getInvitationCollection();

  const invitation =
    await invitationCollection.findOne(
      {
        publicToken,
        publicPath:
          `/invite/${routeToken}`,
        isDeleted: false,
      },
      {
        projection: {
          guestId: 1,
          side: 1,
        },
      }
    );

  if (!invitation) {
    return null;
  }

  const guestCollection =
    await getGuestCollection();

  const guest =
    await guestCollection.findOne(
      {
        _id: invitation.guestId,
        isDeleted: false,
        side: invitation.side,
      },
      {
        projection: {
          fullName: 1,
          side: 1,
        },
      }
    );

  if (!guest) {
    return null;
  }

  return createInvitationData(
    guest.fullName,
    guest.side
  );
}

// ======================================================
// LOAD INVITATION
//
// Phân biệt link cũ và mới.
//
// Không tự fallback từ link mới về link cũ
// nếu không tìm thấy thiệp tương ứng.
// ======================================================

async function loadInvitation(
  token: string
): Promise<InvitationData | null> {
  if (
    !token ||
    token.length > MAX_ROUTE_LENGTH
  ) {
    return null;
  }

  // ================================================
  // LINK CŨ
  // ================================================

  if (TOKEN_REGEX.test(token)) {
    return loadLegacyInvitation(token);
  }

  // ================================================
  // LINK MỚI
  // ================================================

  if (NEW_LINK_REGEX.test(token)) {
    return loadNewInvitation(token);
  }

  return null;
}

// ======================================================
// DYNAMIC INVITATION CONTENT
//
// connection(), params và truy vấn MongoDB
// nằm trong Suspense boundary.
//
// Chỉ thực hiện khi có request.
// ======================================================

async function InvitationContent({
  params,
}: InvitationPageProps) {
  await connection();

  const { token } = await params;

  const invitation =
    await loadInvitation(token);

  if (!invitation) {
    notFound();
  }

  return (
    <WeddingProvider>
      {/* ============================================
          PRELOADER
      ============================================ */}

      <Preloader />

      {/* ============================================
          INVITATION COVER

          Hiển thị tên khách và bên mời.
          Giữ nguyên component đã có.
      ============================================ */}

      <Suspense fallback={null}>
        <InvitationCover
          guestName={invitation.guestName}
          guestSide={invitation.guestSide}
        />
      </Suspense>

      {/* ============================================
          WEDDING PAGE

          Giữ nguyên nội dung thiệp cưới,
          các section và giao diện hiện tại.
      ============================================ */}

      <Suspense fallback={null}>
        <WeddingPage
          guestName={invitation.guestName}
          guestSide={invitation.guestSide}
        />
      </Suspense>

      {/* ============================================
          MUSIC
      ============================================ */}

      <MusicPlayer />

      {/* ============================================
          BACK TO TOP
      ============================================ */}

      <BackToTop />

      {/* ============================================
          CUSTOM CURSOR
      ============================================ */}

      <CustomCursor />
    </WeddingProvider>
  );
}

// ======================================================
// LOADING FALLBACK
//
// Không chứa dữ liệu khách mời.
// ======================================================

function InvitationFallback() {
  return (
    <main
      aria-busy="true"
      aria-live="polite"
      className="
        flex min-h-screen
        items-center justify-center
        bg-[#FFFDF8] px-6
      "
    >
      <div className="text-center">
        <div
          aria-hidden="true"
          className="
            mx-auto mb-5
            h-9 w-9 animate-spin
            rounded-full
            border-2 border-[#B8A27D]/25
            border-t-[#B8A27D]
          "
        />

        <p className="font-wedding-serif text-lg text-[#31566B]">
          Đang chuẩn bị thiệp mời...
        </p>

        <p className="mt-2 text-xs tracking-wide text-[#587589]">
          NAM ♥ THƯ · 2026
        </p>
      </div>
    </main>
  );
}

// ======================================================
// PAGE
//
// Component cha chỉ tạo Suspense boundary.
//
// Không truy vấn database ở đây.
// ======================================================

export default function InvitationPage({
  params,
}: InvitationPageProps) {
  return (
    <Suspense fallback={<InvitationFallback />}>
      <InvitationContent params={params} />
    </Suspense>
  );
}
