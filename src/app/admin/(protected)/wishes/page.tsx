
import {
  Suspense,
} from "react";

import {
  connection,
} from "next/server";

import {
  redirect,
} from "next/navigation";

import {
  getCurrentAdmin,
} from "@/lib/admin-auth";

import WishesManager from "./wishes-manager";

// ======================================================
// NAM & THU - ADMIN WISHES PAGE
//
// GIAI ĐOẠN 3.6.5
//
// - Xác thực phiên Admin phía server.
// - Truyền role và side xuống giao diện.
// - Sử dụng Suspense với Next.js 16.
// - Không truy vấn lời chúc trực tiếp tại client
//   ngoài API đã kiểm tra phân quyền.
// ======================================================

function WishesLoading() {
  return (
    <div className="space-y-5">
      <div className="h-8 w-52 animate-pulse rounded-xl bg-[#E9ECE8]" />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <div
            key={index}
            className="h-32 animate-pulse rounded-[18px] border border-[#E7E1D8] bg-white"
          />
        ))}
      </div>

      <div className="h-72 animate-pulse rounded-[20px] border border-[#E7E1D8] bg-white" />
    </div>
  );
}

async function WishesContent() {
  // Next.js 16: đánh dấu nội dung cần dữ liệu request.
  await connection();

  const admin = await getCurrentAdmin();

  if (!admin) {
    redirect("/admin/login");
  }

  return (
    <WishesManager
      adminRole={admin.role}
      adminSide={admin.side}
    />
  );
}

export default function AdminWishesPage() {
  return (
    <Suspense fallback={<WishesLoading />}>
      <WishesContent />
    </Suspense>
  );
}
