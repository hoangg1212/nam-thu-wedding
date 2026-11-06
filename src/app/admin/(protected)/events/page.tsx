
import { Suspense } from "react";
import { redirect } from "next/navigation";
import { connection } from "next/server";

import { getCurrentAdmin } from "@/lib/admin-auth";
import EventsManager from "./events-manager";

// ======================================================
// NAM & THU - EVENTS ADMIN PAGE
// ======================================================

async function EventsAccessGate() {
  // Dữ liệu phụ thuộc tài khoản đang đăng nhập.
  await connection();

  const admin = await getCurrentAdmin();

  if (!admin) {
    redirect("/admin/login");
  }

  return (
    <EventsManager
      role={admin.role}
      side={admin.side}
    />
  );
}

function EventsLoading() {
  return (
    <main className="flex min-h-[65vh] items-center justify-center bg-[#F9F8EE]">
      <div className="text-center">
        <div
          className="mx-auto mb-4 h-10 w-10 animate-spin rounded-full border-[3px] border-[#E5E7E2] border-t-[#31566B]"
          aria-hidden="true"
        />
        <p className="text-sm text-[#819197]">
          Đang tải thông tin lễ cưới...
        </p>
      </div>
    </main>
  );
}

export default function EventsPage() {
  return (
    <Suspense fallback={<EventsLoading />}>
      <EventsAccessGate />
    </Suspense>
  );
}
