
import { Suspense } from "react";

import { redirect } from "next/navigation";
import { connection } from "next/server";

import {
  Eye,
  KeyRound,
  LockKeyhole,
  Pencil,
  ShieldCheck,
  UserRound,
} from "lucide-react";

import {
  getCurrentAdmin,
  getAdminRoleLabel,
} from "@/lib/admin-auth";

import AccountsManager from "./accounts-manager";
import AccountProfile from "./account-profile";

// ======================================================
// NAM & THU - ACCOUNTS PAGE
//
// Super Admin:
// - Danh sách và quản lý tài khoản hai bên.
// - Xem/sửa hồ sơ chính mình.
//
// Nhà trai / Nhà gái:
// - Xem/sửa hồ sơ của chính mình.
// - Không có quyền xem tài khoản bên kia.
//
// ======================================================

function InformationPanel() {
  return (
    <aside className="space-y-5">
      {/* QUYỀN HỒ SƠ */}

      <section
        className="
          rounded-[22px]
          border border-[#E8E2D8]
          bg-white/90
          p-5
          shadow-sm
        "
      >
        <div className="mb-4 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#F3F0E8] text-[#B8A27D]">
            <UserRound size={20} />
          </div>

          <h2 className="text-[15px] font-semibold">
            Hồ sơ của bạn
          </h2>
        </div>

        <p className="text-[13px] leading-6 text-[#7E8E92]">
          Thông tin tại đây thuộc riêng tài khoản
          đang đăng nhập.
        </p>

        <div className="mt-5 space-y-4">
          <div className="flex items-start gap-3">
            <Eye
              size={18}
              className="mt-0.5 shrink-0 text-[#B8A27D]"
            />

            <div>
              <p className="text-[13px] font-medium">
                Xem thông tin
              </p>
              <p className="mt-1 text-xs leading-5 text-[#8C9A9C]">
                Họ tên, ngày sinh, email, avatar
                và tài khoản đăng nhập.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <Pencil
              size={18}
              className="mt-0.5 shrink-0 text-[#B8A27D]"
            />

            <div>
              <p className="text-[13px] font-medium">
                Chỉnh sửa hồ sơ
              </p>
              <p className="mt-1 text-xs leading-5 text-[#8C9A9C]">
                Thay đổi thông tin và tải ảnh
                đại diện mới.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* BẢO MẬT */}

      <section
        className="
          rounded-[22px]
          border border-[#E6DFD1]
          bg-[#F5F1E8]
          p-5
        "
      >
        <div className="mb-3 flex items-center gap-2">
          <LockKeyhole
            size={18}
            className="text-[#B8A27D]"
          />

          <h2 className="text-[14px] font-semibold">
            Bảo mật tài khoản
          </h2>
        </div>

        <p className="text-[12px] leading-6 text-[#7D8B8B]">
          Mỗi lần lưu thay đổi, bạn cần nhập
          mật khẩu hiện tại để xác nhận.
        </p>

        <div className="mt-4 flex items-start gap-2 text-[12px] leading-5 text-[#61726D]">
          <KeyRound
            size={16}
            className="mt-0.5 shrink-0"
          />

          Mật khẩu đã được mã hóa và không
          thể xem lại dưới dạng văn bản.
        </div>
      </section>
    </aside>
  );
}

// ======================================================
// ACCOUNT CONTENT
// ======================================================

async function AccountsContent() {
  await connection();

  const admin = await getCurrentAdmin();

  if (!admin) {
    redirect("/admin/login");
  }

  const isSuper =
    admin.role === "super_admin";

  return (
    <main
      className="
        mx-auto w-full
        max-w-[1480px]
        px-4 py-6
        sm:px-6 sm:py-8
        xl:px-8
      "
    >
      {/* TIÊU ĐỀ TRANG */}

      <section className="mb-7">
        <div className="mb-3 flex items-center gap-2">
          <ShieldCheck
            size={16}
            className="text-[#B8A27D]"
          />

          <span
            className="
              text-[11px] font-semibold
              uppercase tracking-[0.17em]
              text-[#B8A27D]
            "
          >
            Nam &amp; Thư Administration
          </span>
        </div>

        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1
              className="
                font-wedding-serif
                text-[34px]
                leading-tight
                text-[#31566B]
                sm:text-[42px]
              "
            >
              Quản lý tài khoản
            </h1>

            <p
              className="
                mt-2 text-[13px]
                leading-6
                text-[#809094]
              "
            >
              {isSuper
                ? "Quản lý các tài khoản gia đình và cập nhật hồ sơ cá nhân."
                : "Xem và cập nhật thông tin hồ sơ cá nhân của bạn."}
            </p>
          </div>

          <span
            className="
              inline-flex
              items-center gap-2
              rounded-full
              border border-[#E6E3DA]
              bg-white
              px-4 py-2
              text-[12px]
              text-[#61726D]
            "
          >
            <ShieldCheck
              size={15}
              className="text-[#B8A27D]"
            />

            {getAdminRoleLabel(admin.role)}
          </span>
        </div>
      </section>

      {/* NỘI DUNG THEO VAI TRÒ */}

      {isSuper ? (
        <div className="space-y-7">
          {/* MODULE QUẢN LÝ TÀI KHOẢN CÓ SẴN */}

          <AccountsManager />

          {/* HỒ SƠ SUPER ADMIN */}

          <section className="rounded-[22px] border border-[#E8E2D8] bg-white/65 p-4 sm:p-6">
            <div className="mb-5">
              <h2 className="text-lg font-semibold">
                Hồ sơ Super Admin
              </h2>

              <p className="mt-2 text-xs text-[#8C9A9C]">
                Xem và chỉnh sửa tài khoản đang
                đăng nhập.
              </p>
            </div>

            <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_255px]">
              <div className="min-w-0">
                <AccountProfile />
              </div>

              <InformationPanel />
            </div>
          </section>
        </div>
      ) : (
        // NHÀ TRAI / NHÀ GÁI
        <div
          className="
            grid items-start
            gap-5
            xl:grid-cols-[minmax(0,1fr)_255px]
          "
        >
          <div className="min-w-0">
            <AccountProfile />
          </div>

          <InformationPanel />
        </div>
      )}
    </main>
  );
}

// ======================================================
// LOADING
// ======================================================

function LoadingAccounts() {
  return (
    <main className="flex min-h-[65vh] items-center justify-center px-4">
      <div className="text-center">
        <div
          className="
            mx-auto mb-4
            h-9 w-9
            animate-spin
            rounded-full
            border-[3px]
            border-[#E4E8E5]
            border-t-[#31566B]
          "
          aria-hidden="true"
        />

        <p className="text-sm text-[#809094]">
          Đang tải thông tin tài khoản...
        </p>
      </div>
    </main>
  );
}

// ======================================================
// EXPORT
// ======================================================

export default function AccountsPage() {
  return (
    <Suspense fallback={<LoadingAccounts />}>
      <AccountsContent />
    </Suspense>
  );
}
