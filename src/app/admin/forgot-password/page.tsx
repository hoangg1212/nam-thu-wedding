
import Link from "next/link";

import {
  ArrowLeft,
  Heart,
  KeyRound,
  LockKeyhole,
  ShieldCheck,
  Terminal,
} from "lucide-react";

export default function ForgotPasswordPage() {
  return (
    <main className="relative flex min-h-[100svh] items-center justify-center overflow-hidden bg-gradient-to-br from-[#F9F8EE] via-[#FAF7F2] to-[#F4EEEA] px-4 py-10 text-[#31566B]">
      {/* Trang trí nền */}
      <div className="pointer-events-none absolute -left-24 -top-24 h-80 w-80 rounded-full bg-[#D9A0A8]/15 blur-3xl" />

      <div className="pointer-events-none absolute -bottom-24 -right-24 h-80 w-80 rounded-full bg-[#AFC9C0]/20 blur-3xl" />

      <div className="relative z-10 w-full max-w-[470px]">
        {/* Branding */}
        <div className="mb-8 text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full border border-[#E6D9CB] bg-white/90 shadow-sm">
            <Heart
              className="h-7 w-7 text-[#C98792]"
              strokeWidth={1.4}
            />
          </div>

          <p className="mt-5 text-[10px] font-semibold uppercase tracking-[0.3em] text-[#B8A27D]">
            Wedding Administration
          </p>

          <h1 className="mt-3 font-wedding-serif text-5xl text-[#31566B]">
            Nam &amp; Thư
          </h1>

          <p className="mt-3 text-sm text-[#71838B]">
            Hệ thống quản trị thiệp cưới
          </p>
        </div>

        {/* Recovery card */}
        <section className="rounded-[28px] border border-white/80 bg-white/90 px-6 py-9 shadow-[0_18px_55px_rgba(49,86,107,0.08)] backdrop-blur-xl sm:px-9">
          <div className="text-center">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-[#F5F1EA]">
              <KeyRound
                className="h-6 w-6 text-[#B8A27D]"
                strokeWidth={1.6}
              />
            </div>

            <div className="mb-3 inline-flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-[#9A947F]">
              <ShieldCheck className="h-4 w-4" />
              Khôi phục tài khoản
            </div>

            <h2 className="font-wedding-serif text-4xl text-[#31566B]">
              Quên mật khẩu?
            </h2>

            <p className="mx-auto mt-4 max-w-[330px] text-sm leading-7 text-[#71838B]">
              Vì tài khoản quản trị chưa cấu hình
              email khôi phục, bạn có thể đặt lại
              mật khẩu an toàn từ máy quản trị.
            </p>
          </div>

          <div className="mt-8 space-y-5">
            <div className="rounded-2xl border border-[#E7E2D9] bg-[#FCFAF6] p-5">
              <div className="mb-3 flex items-center gap-2">
                <Terminal className="h-5 w-5 text-[#B8A27D]" />

                <h3 className="text-sm font-semibold">
                  Mở Terminal trong VS Code
                </h3>
              </div>

              <p className="text-xs leading-6 text-[#71838B]">
                Tại thư mục gốc của dự án, chạy
                lệnh sau:
              </p>

              <div className="mt-3 overflow-x-auto rounded-xl bg-[#263F4F] px-4 py-4">
                <code className="whitespace-nowrap font-mono text-xs text-white">
                  npm run admin:reset-password
                </code>
              </div>

              <p className="mt-3 text-xs leading-6 text-[#71838B]">
                Nhập tên tài khoản Admin, đặt mật
                khẩu mới và xác nhận. Sau khi
                cập nhật thành công, mọi phiên
                đăng nhập cũ sẽ bị thu hồi.
              </p>
            </div>

            <div className="flex items-start gap-3 rounded-xl bg-[#F2F5F2] px-4 py-3">
              <LockKeyhole className="mt-0.5 h-4 w-4 shrink-0 text-[#61726D]" />

              <p className="text-xs leading-6 text-[#61726D]">
                Chỉ thực hiện trên máy quản trị
                đáng tin cậy. Không chia sẻ
                mật khẩu mới hoặc chuỗi kết nối
                cơ sở dữ liệu.
              </p>
            </div>

            <Link
              href="/admin/login"
              className="flex h-[52px] w-full items-center justify-center gap-2 rounded-xl bg-[#31566B] text-sm font-semibold text-white transition hover:bg-[#28495C]"
            >
              <ArrowLeft className="h-4 w-4" />
              Quay lại đăng nhập
            </Link>
          </div>
        </section>

        <p className="mt-7 text-center text-[11px] text-[#9AA6A5]">
          Nam &amp; Thư Wedding · Private Administration
        </p>
      </div>
    </main>
  );
}
