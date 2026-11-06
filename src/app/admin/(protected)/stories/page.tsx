
import { Suspense } from "react";
import { redirect } from "next/navigation";
import { connection } from "next/server";

import {
  getCurrentAdmin,
  hasAdminPermission,
} from "@/lib/admin-auth";

import StoryManager from "./story-manager";

// ======================================================
// NAM & THU - LOVE STORY ADMIN PAGE
//
// Cả ba vai trò được quản lý Love Story:
// - super_admin
// - groom_admin
// - bride_admin
//
// Không giới hạn theo Nhà trai / Nhà gái.
//
// Giao diện quản trị được triển khai trong:
// ./story-manager.tsx
//
// Sử dụng Suspense và connection() tương thích
// ======================================================

// ======================================================
// ACCESS GATE
// ======================================================

async function StoryAccessGate() {
  // Đảm bảo kiểm tra phiên khi có request.
  await connection();

  // Lấy Admin đã đăng nhập.
  const admin = await getCurrentAdmin();

  // Chưa đăng nhập thì chuyển về login.
  if (!admin) {
    redirect("/admin/login");
  }

  // Kiểm tra quyền quản lý Love Story.
  // Bước 1 đã cấp stories:write cho cả ba Admin.
  if (
    !hasAdminPermission(
      admin.role,
      "stories:write"
    )
  ) {
    redirect("/admin");
  }

  // API tiếp tục kiểm tra quyền ở backend.
  return <StoryManager />;
}

// ======================================================
// LOADING
// ======================================================

function StoryLoading() {
  return (
    <div className="flex min-h-[65vh] items-center justify-center px-4">
      <div className="text-center">
        <div
          aria-hidden="true"
          className="mx-auto mb-4 h-9 w-9 animate-spin rounded-full border-[3px] border-[#E2E8E4] border-t-[#31566B]"
        />

        <p className="text-[13px] text-[#829294]">
          Đang tải quản lý Love Story...
        </p>
      </div>
    </div>
  );
}

// ======================================================
// PAGE EXPORT
// ======================================================

export default function AdminStoriesPage() {
  return (
    <Suspense fallback={<StoryLoading />}>
      <StoryAccessGate />
    </Suspense>
  );
}
