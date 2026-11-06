
import { Suspense } from "react";
import { redirect } from "next/navigation";
import { connection } from "next/server";

import {
  getCurrentAdmin,
  hasAdminPermission,
} from "@/lib/admin-auth";

import GalleryManager from "./gallery-manager";

// ======================================================
// NAM & THU - ADMIN GALLERY PAGE
//
// GIAI ĐOẠN 3.7.2
//
// Server Component:
// - Xác thực phiên đăng nhập.
// - Kiểm tra quyền gallery:read.
// - Không phân biệt Nhà trai / Nhà gái.
//
// Client Component:
// - Quản lý toàn bộ ảnh.
// - Thêm, sửa, xóa.
// - Ẩn / hiện.
// - Thay đổi thứ tự.
// ======================================================

async function GalleryAccessGate() {
  // Đọc dữ liệu tài khoản trong Suspense.
  await connection();

  const admin = await getCurrentAdmin();

  if (!admin) {
    redirect("/admin/login");
  }

  // Kiểm tra quyền xem Album.
  if (
    !hasAdminPermission(
      admin.role,
      "gallery:read"
    )
  ) {
    redirect("/admin");
  }

  return <GalleryManager />;
}

// ======================================================
// LOADING
// ======================================================

function GalleryLoading() {
  return (
    <main className="flex min-h-[65vh] items-center justify-center bg-[#F9F8EE]">
      <div className="text-center">
        <div
          aria-hidden="true"
          className="mx-auto mb-4 h-10 w-10 animate-spin rounded-full border-[3px] border-[#E5E7E2] border-t-[#31566B]"
        />

        <p className="text-sm text-[#819197]">
          Đang tải Album ảnh...
        </p>
      </div>
    </main>
  );
}

// ======================================================
// PAGE EXPORT
// ======================================================

export default function GalleryAdminPage() {
  return (
    <Suspense fallback={<GalleryLoading />}>
      <GalleryAccessGate />
    </Suspense>
  );
}
