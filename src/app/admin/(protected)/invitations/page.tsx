
import { Suspense } from "react";
import { connection } from "next/server";
import { redirect } from "next/navigation";
import {
  HeartHandshake,
  ShieldCheck,
} from "lucide-react";

import {
  getCurrentAdmin,
  getAdminRoleLabel,
  hasAdminPermission,
} from "@/lib/admin-auth";

import InvitationsManager from "./invitations-manager";

// ======================================================
// NAM & THU - INVITATIONS ADMIN PAGE
// GIAI ĐOẠN 3.10 - BƯỚC 3
// ======================================================

async function InvitationsContent() {
  await connection();

  const admin = await getCurrentAdmin();

  if (!admin) {
    redirect("/admin/login");
  }

  // Bước 2 đang sử dụng guests:read/write
  // để quản lý thiệp theo quyền hiện có.
  if (
    !hasAdminPermission(
      admin.role,
      "guests:read"
    )
  ) {
    redirect("/admin");
  }

  return (
    <main className="mx-auto w-full max-w-[1480px] px-4 py-6 sm:px-6 sm:py-8 xl:px-8">
      <section className="mb-7">
        <div className="mb-3 flex items-center gap-2">
          <HeartHandshake
            size={17}
            className="text-[#B8A27D]"
          />

          <span className="text-[11px] font-semibold uppercase tracking-[0.17em] text-[#B8A27D]">
            Nam &amp; Thư Administration
          </span>
        </div>

        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="font-wedding-serif text-[34px] leading-tight text-[#31566B] sm:text-[42px]">
              Quản lý thiệp mời
            </h1>

            <p className="mt-2 max-w-[680px] text-[13px] leading-6 text-[#809094]">
              Tạo thiệp cá nhân hóa từ danh sách
              khách mời, quản lý đường dẫn,
              trạng thái gửi và xác nhận tham dự
              lễ cưới Nam &amp; Thư.
            </p>
          </div>

          <span className="inline-flex items-center gap-2 rounded-full border border-[#E6E3DA] bg-white px-4 py-2 text-[12px] text-[#61726D]">
            <ShieldCheck
              size={15}
              className="text-[#B8A27D]"
            />

            {getAdminRoleLabel(admin.role)}
          </span>
        </div>
      </section>

      <InvitationsManager
        adminRole={admin.role}
        adminSide={admin.side}
      />
    </main>
  );
}

function LoadingInvitations() {
  return (
    <main className="flex min-h-[65vh] items-center justify-center px-4">
      <div className="text-center">
        <div
          aria-hidden="true"
          className="mx-auto mb-3 h-9 w-9 animate-spin rounded-full border-[3px] border-[#E4E8E5] border-t-[#31566B]"
        />

        <p className="text-sm text-[#809094]">
          Đang tải trang quản lý thiệp mời...
        </p>
      </div>
    </main>
  );
}

export default function InvitationsPage() {
  return (
    <Suspense fallback={<LoadingInvitations />}>
      <InvitationsContent />
    </Suspense>
  );
}
