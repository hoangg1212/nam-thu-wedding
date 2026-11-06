
"use client";

import {
  useEffect,
  useState,
  type CSSProperties,
  type FormEvent,
} from "react";

import Link from "next/link";
import { useRouter } from "next/navigation";

import {
  ArrowRight,
  Eye,
  EyeOff,
  Heart,
  LockKeyhole,
  ShieldCheck,
  UserRound,
  LoaderCircle,
  Sparkles,
} from "lucide-react";

// ======================================================
// TYPES
// ======================================================

interface LoginResponse {
  success?: boolean;
  message?: string;
}

interface FloatingHeart {
  id: number;
  left: string;
  size: number;
  duration: number;
  delay: number;
  opacity: number;
  drift: number;
  color: string;
  rotation: number;
  blur: number;
}

// ======================================================
// FLOATING HEART CONFIGURATION
// Dữ liệu cố định để tránh lỗi hydration mismatch.
// ======================================================

const FLOATING_HEARTS: FloatingHeart[] = [
  {
    id: 1,
    left: "5%",
    size: 19,
    duration: 17,
    delay: -3,
    opacity: 0.38,
    drift: 30,
    color: "#D9A0A8",
    rotation: -15,
    blur: 0,
  },
  {
    id: 2,
    left: "12%",
    size: 32,
    duration: 22,
    delay: -12,
    opacity: 0.23,
    drift: -34,
    color: "#E8B7BF",
    rotation: 10,
    blur: 1,
  },
  {
    id: 3,
    left: "19%",
    size: 15,
    duration: 19,
    delay: -8,
    opacity: 0.4,
    drift: 27,
    color: "#C98792",
    rotation: -20,
    blur: 0,
  },
  {
    id: 4,
    left: "28%",
    size: 25,
    duration: 24,
    delay: -18,
    opacity: 0.2,
    drift: -25,
    color: "#B8A27D",
    rotation: 15,
    blur: 0.5,
  },
  {
    id: 5,
    left: "38%",
    size: 13,
    duration: 16,
    delay: -5,
    opacity: 0.3,
    drift: 18,
    color: "#D6A8AF",
    rotation: -10,
    blur: 0,
  },
  {
    id: 6,
    left: "47%",
    size: 27,
    duration: 25,
    delay: -13,
    opacity: 0.18,
    drift: 35,
    color: "#D4A1A9",
    rotation: 13,
    blur: 1.3,
  },
  {
    id: 7,
    left: "56%",
    size: 18,
    duration: 18,
    delay: -9,
    opacity: 0.3,
    drift: -20,
    color: "#B8A27D",
    rotation: -15,
    blur: 0,
  },
  {
    id: 8,
    left: "65%",
    size: 30,
    duration: 23,
    delay: -4,
    opacity: 0.22,
    drift: 30,
    color: "#C98792",
    rotation: 10,
    blur: 0.8,
  },
  {
    id: 9,
    left: "73%",
    size: 15,
    duration: 20,
    delay: -15,
    opacity: 0.38,
    drift: -28,
    color: "#D8ABB2",
    rotation: -8,
    blur: 0,
  },
  {
    id: 10,
    left: "81%",
    size: 24,
    duration: 21,
    delay: -7,
    opacity: 0.23,
    drift: 20,
    color: "#BDAE91",
    rotation: 18,
    blur: 0.5,
  },
  {
    id: 11,
    left: "89%",
    size: 34,
    duration: 27,
    delay: -20,
    opacity: 0.2,
    drift: -40,
    color: "#D39DA7",
    rotation: -12,
    blur: 1.5,
  },
  {
    id: 12,
    left: "96%",
    size: 17,
    duration: 16,
    delay: -11,
    opacity: 0.36,
    drift: -18,
    color: "#C98792",
    rotation: 8,
    blur: 0,
  },
  {
    id: 13,
    left: "9%",
    size: 12,
    duration: 15,
    delay: -14,
    opacity: 0.25,
    drift: 22,
    color: "#B8A27D",
    rotation: 15,
    blur: 0,
  },
  {
    id: 14,
    left: "33%",
    size: 21,
    duration: 23,
    delay: -2,
    opacity: 0.16,
    drift: -18,
    color: "#D4A1A9",
    rotation: -12,
    blur: 1,
  },
  {
    id: 15,
    left: "60%",
    size: 12,
    duration: 19,
    delay: -16,
    opacity: 0.29,
    drift: 30,
    color: "#C98792",
    rotation: 10,
    blur: 0,
  },
  {
    id: 16,
    left: "86%",
    size: 20,
    duration: 26,
    delay: -5,
    opacity: 0.2,
    drift: -30,
    color: "#B8A27D",
    rotation: -15,
    blur: 0.7,
  },
];

// ======================================================
// FLOATING HEART BACKGROUND
// Giữ nguyên hiệu ứng trái tim bay.
// Animation sử dụng CSS trong globals.css.
// ======================================================

function FloatingHeartsBackground() {
  return (
    <div
      className="
        pointer-events-none
        absolute inset-0 z-0
        overflow-hidden
      "
      aria-hidden="true"
    >
      {/* NỀN GRADIENT MỀM */}

      <div
        className="
          absolute inset-0
          bg-gradient-to-br
          from-[#F9F8EE]
          via-[#FAF7F2]
          to-[#F4EEEA]
        "
      />

      {/* ÁNH SÁNG GÓC TRÊN TRÁI */}

      <div
        className="
          absolute
          -left-[180px] -top-[200px]
          h-[480px] w-[480px]
          rounded-full
          bg-[#E6C3C5]/20
          blur-[110px]
        "
      />

      {/* ÁNH SÁNG GÓC DƯỚI PHẢI */}

      <div
        className="
          absolute
          -bottom-[180px] -right-[170px]
          h-[520px] w-[520px]
          rounded-full
          bg-[#C3D5D1]/25
          blur-[120px]
        "
      />

      {/* ÁNH SÁNG TRUNG TÂM */}

      <div
        className="
          absolute left-1/2 top-1/2
          h-[600px] w-[600px]
          -translate-x-1/2
          -translate-y-1/2
          rounded-full
          bg-white/40
          blur-[110px]
        "
      />

      {/* DANH SÁCH TRÁI TIM BAY */}

      {FLOATING_HEARTS.map((heart) => {
        const style = {
          left: heart.left,

          width: `${heart.size}px`,
          height: `${heart.size}px`,

          color: heart.color,
          opacity: heart.opacity,

          filter: `blur(${heart.blur}px)`,

          animationDuration: `${heart.duration}s`,
          animationDelay: `${heart.delay}s`,

          "--heart-drift": `${heart.drift}px`,
          "--heart-rotation": `${heart.rotation}deg`,
        } as CSSProperties;

        return (
          <span
            key={heart.id}
            className="
              floating-wedding-heart
              absolute bottom-[-70px]
              block will-change-transform
            "
            style={style}
          >
            <svg
              viewBox="0 0 24 24"
              fill="currentColor"
              className="h-full w-full"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                d="
                  M20.84 4.61
                  a5.5 5.5 0 0 0-7.78 0
                  L12 5.67
                  l-1.06-1.06
                  a5.5 5.5 0 0 0-7.78 7.78
                  l1.06 1.06
                  L12 21.23
                  l7.78-7.78
                  1.06-1.06
                  a5.5 5.5 0 0 0 0-7.78
                  Z
                "
              />
            </svg>
          </span>
        );
      })}

      {/* HẠT SÁNG BAY */}

      <div
        className="
          wedding-light-particle
          absolute bottom-[-30px] left-[20%]
          h-2 w-2
          rounded-full
          bg-[#E3B5BC]/60
          blur-[1px]
        "
      />

      <div
        className="
          wedding-light-particle
          absolute bottom-[-30px] left-[76%]
          h-1.5 w-1.5
          rounded-full
          bg-[#B8A27D]/50
          blur-[1px]
        "
        style={{
          animationDelay: "-7s",
          animationDuration: "20s",
        }}
      />
    </div>
  );
}

// ======================================================
// BRAND LOGO
// ======================================================

function WeddingAdminLogo() {
  return (
    <div
      className="
        relative mx-auto
        flex h-[66px] w-[66px]
        items-center justify-center
        rounded-full
        border border-[#E6D9CB]
        bg-white/85
        shadow-[0_8px_25px_rgba(49,86,107,0.07)]
      "
    >
      <div
        className="
          absolute inset-[6px]
          rounded-full
          border border-[#EADDD6]/70
        "
      />

      <Heart
        className="
          relative z-10
          h-[27px] w-[27px]
          text-[#C98792]
        "
        strokeWidth={1.35}
      />

      <span
        className="
          absolute -right-1 top-0
          flex h-5 w-5
          items-center justify-center
          rounded-full
          bg-[#F7EFEB]
          text-[#B8A27D]
        "
      >
        <Sparkles
          className="h-3 w-3"
          strokeWidth={1.4}
        />
      </span>
    </div>
  );
}

// ======================================================
// ADMIN LOGIN PAGE
// ======================================================

export default function AdminLoginPage() {
  const router = useRouter();

  // ==================================================
  // FORM STATE
  // ==================================================

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

  const [showPassword, setShowPassword] =
    useState(false);

  const [loading, setLoading] = useState(false);

  const [checkingSession, setCheckingSession] =
    useState(true);

  const [error, setError] = useState("");

  // ==================================================
  // KIỂM TRA PHIÊN ĐĂNG NHẬP HIỆN TẠI
  // ==================================================

  useEffect(() => {
    let cancelled = false;

    async function checkSession() {
      try {
        const response = await fetch(
          "/api/admin/auth/me",
          {
            method: "GET",
            credentials: "same-origin",
            cache: "no-store",
          }
        );

        if (cancelled) {
          return;
        }

        // Đã đăng nhập thì chuyển tới trang Admin.
        if (response.ok) {
          router.replace("/admin");
          router.refresh();
        }
      } catch {
        // Nếu không kiểm tra được session,
        // vẫn cho phép đăng nhập bình thường.
      } finally {
        if (!cancelled) {
          setCheckingSession(false);
        }
      }
    }

    void checkSession();

    return () => {
      cancelled = true;
    };
  }, [router]);

  // ==================================================
  // XỬ LÝ ĐĂNG NHẬP
  // ==================================================

  async function handleLogin(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    // Không gửi nhiều request cùng lúc.
    if (loading || checkingSession) {
      return;
    }

    setError("");
    setLoading(true);

    try {
      const response = await fetch(
        "/api/admin/auth/login",
        {
          method: "POST",

          headers: {
            "Content-Type": "application/json",
          },

          credentials: "same-origin",
          cache: "no-store",

          body: JSON.stringify({
            username: username.trim(),
            password,
          }),
        }
      );

      const data: LoginResponse =
        await response.json();

      if (!response.ok || !data.success) {
        setError(
          data.message ||
            "Tên đăng nhập hoặc mật khẩu không đúng."
        );

        return;
      }

      // Chỉ chuyển trang khi API xác nhận thành công.
      router.replace("/admin");
      router.refresh();
    } catch {
      setError(
        "Không thể kết nối đến máy chủ. Vui lòng thử lại."
      );
    } finally {
      setLoading(false);
    }
  }

  // ==================================================
  // GIAO DIỆN
  // ==================================================

  return (
    <main
      className="
        relative isolate
        flex min-h-screen min-h-[100svh]
        items-center justify-center
        overflow-hidden
        px-4 py-10
        text-[#31566B]
        sm:px-6 sm:py-12
      "
    >
      {/* ================================================
          BACKGROUND ANIMATION
      ================================================ */}

      <FloatingHeartsBackground />

      {/* ================================================
          MAIN CONTENT
      ================================================ */}

      <div
        className="
          relative z-10
          mx-auto w-full
          max-w-[460px]
        "
      >
        {/* =============================================
            BRANDING
        ============================================= */}

        <div className="mb-7 text-center sm:mb-8">
          <WeddingAdminLogo />

          <div className="mt-6">
            <p
              className="
                text-[10px] font-semibold
                uppercase tracking-[0.36em]
                text-[#B8A27D]
                sm:text-[11px]
              "
            >
              Wedding Administration
            </p>

            <h1
              className="
                mt-3
                font-wedding-serif
                text-[44px]
                font-normal
                leading-[1.1]
                tracking-[0.02em]
                text-[#31566B]
                sm:text-[54px]
              "
            >
              Nam
              <span
                className="
                  mx-2 italic
                  text-[#B8A27D]
                "
              >
                &amp;
              </span>
              Thư
            </h1>

            <p
              className="
                mt-3
                text-[13px]
                font-normal
                tracking-[0.02em]
                text-[#71838B]
                sm:text-sm
              "
            >
              Hệ thống quản trị thiệp cưới
            </p>
          </div>
        </div>

        {/* =============================================
            LOGIN CARD
        ============================================= */}

        <section
          className="
            relative overflow-hidden
            rounded-[28px]
            border border-white/75
            bg-white/85
            px-6 py-8
            shadow-[0_18px_65px_rgba(49,86,107,0.10)]
            backdrop-blur-xl
            sm:rounded-[32px]
            sm:px-9 sm:py-10
          "
        >
          {/* ĐƯỜNG TRANG TRÍ TRÊN CARD */}

          <div
            className="
              pointer-events-none
              absolute left-1/2 top-0
              h-[2px] w-32
              -translate-x-1/2
              bg-gradient-to-r
              from-transparent
              via-[#B8A27D]/75
              to-transparent
            "
          />

          {/* ===========================================
              HEADER CARD
          =========================================== */}

          <div className="mb-8 text-center">
            <div
              className="
                mb-3
                inline-flex
                items-center justify-center
                gap-2
                rounded-full
                border border-[#EAE5DC]
                bg-[#FAF8F2]
                px-4 py-2
              "
            >
              <ShieldCheck
                className="
                  h-[15px] w-[15px]
                  text-[#B8A27D]
                "
                strokeWidth={1.6}
              />

              <span
                className="
                  text-[10px]
                  font-semibold
                  uppercase
                  tracking-[0.18em]
                  text-[#8D947F]
                "
              >
                Khu vực quản trị
              </span>
            </div>

            <h2
              className="
                font-wedding-serif
                text-[36px]
                font-normal
                leading-tight
                text-[#31566B]
                sm:text-[40px]
              "
            >
              Đăng nhập
            </h2>

            <div
              className="
                mx-auto mt-3
                h-px w-14
                bg-gradient-to-r
                from-transparent
                via-[#B8A27D]/60
                to-transparent
              "
            />

            <p
              className="
                mx-auto mt-4
                max-w-[310px]
                text-center
                text-[13px]
                leading-6
                text-[#7B8B91]
                sm:text-sm
              "
            >
              Vui lòng nhập thông tin tài khoản
              để quản lý website.
            </p>
          </div>

          {/* ===========================================
              LOGIN FORM
          =========================================== */}

          <form
            onSubmit={handleLogin}
            className="space-y-5"
          >
            {/* =========================================
                USERNAME
            ========================================= */}

            <div>
              <label
                htmlFor="admin-username"
                className="
                  mb-2 block
                  text-[13px]
                  font-medium
                  text-[#425C69]
                "
              >
                Tên đăng nhập
              </label>

              <div className="group relative">
                <UserRound
                  className="
                    pointer-events-none
                    absolute left-4 top-1/2
                    h-[18px] w-[18px]
                    -translate-y-1/2
                    text-[#9AA8AB]
                    transition-colors
                    group-focus-within:text-[#B8A27D]
                  "
                  strokeWidth={1.6}
                />

                <input
                  id="admin-username"
                  name="username"
                  type="text"
                  autoComplete="username"
                  autoCapitalize="none"
                  spellCheck={false}
                  required
                  minLength={3}
                  maxLength={50}
                  value={username}
                  onChange={(event) => {
                    setUsername(event.target.value);

                    if (error) {
                      setError("");
                    }
                  }}
                  placeholder="Nhập tên đăng nhập"
                  className="
                    h-[54px] w-full
                    rounded-[15px]
                    border border-[#E2E7E6]
                    bg-[#FCFCFA]
                    pl-11 pr-4
                    text-sm
                    text-[#31566B]
                    outline-none
                    transition-all duration-200
                    placeholder:text-[#A6B1B4]
                    hover:border-[#CBD5D3]
                    focus:border-[#B8A27D]
                    focus:bg-white
                    focus:ring-4
                    focus:ring-[#B8A27D]/10
                  "
                />
              </div>
            </div>

            {/* =========================================
                PASSWORD
            ========================================= */}

            <div>
              <label
                htmlFor="admin-password"
                className="
                  mb-2 block
                  text-[13px]
                  font-medium
                  text-[#425C69]
                "
              >
                Mật khẩu
              </label>

              <div className="group relative">
                <LockKeyhole
                  className="
                    pointer-events-none
                    absolute left-4 top-1/2
                    h-[18px] w-[18px]
                    -translate-y-1/2
                    text-[#9AA8AB]
                    transition-colors
                    group-focus-within:text-[#B8A27D]
                  "
                  strokeWidth={1.6}
                />

                <input
                  id="admin-password"
                  name="password"
                  type={
                    showPassword
                      ? "text"
                      : "password"
                  }
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(event) => {
                    setPassword(event.target.value);

                    if (error) {
                      setError("");
                    }
                  }}
                  placeholder="Nhập mật khẩu"
                  className="
                    h-[54px] w-full
                    rounded-[15px]
                    border border-[#E2E7E6]
                    bg-[#FCFCFA]
                    pl-11 pr-12
                    text-sm
                    text-[#31566B]
                    outline-none
                    transition-all duration-200
                    placeholder:text-[#A6B1B4]
                    hover:border-[#CBD5D3]
                    focus:border-[#B8A27D]
                    focus:bg-white
                    focus:ring-4
                    focus:ring-[#B8A27D]/10
                  "
                />

                {/* HIỆN / ẨN MẬT KHẨU */}

                <button
                  type="button"
                  onClick={() => {
                    setShowPassword(
                      (current) => !current
                    );
                  }}
                  className="
                    absolute right-4 top-1/2
                    flex -translate-y-1/2
                    items-center justify-center
                    text-[#99A8AB]
                    transition-colors
                    hover:text-[#31566B]
                  "
                  aria-label={
                    showPassword
                      ? "Ẩn mật khẩu"
                      : "Hiện mật khẩu"
                  }
                  aria-pressed={showPassword}
                >
                  {showPassword ? (
                    <EyeOff
                      className="h-[19px] w-[19px]"
                      strokeWidth={1.7}
                    />
                  ) : (
                    <Eye
                      className="h-[19px] w-[19px]"
                      strokeWidth={1.7}
                    />
                  )}
                </button>
              </div>
            </div>

            {/* =========================================
                ERROR MESSAGE
            ========================================= */}

            {error && (
              <div
                role="alert"
                aria-live="polite"
                className="
                  rounded-xl
                  border border-[#EDC5C7]
                  bg-[#FFF1F1]
                  px-4 py-3
                  text-[13px]
                  leading-6
                  text-[#B2545A]
                "
              >
                {error}
              </div>
            )}

            {/* =========================================
                SUBMIT BUTTON
            ========================================= */}

            <button
              type="submit"
              disabled={
                loading ||
                checkingSession
              }
              className="
                group relative mt-2
                flex h-[54px] w-full
                items-center justify-center
                gap-3 overflow-hidden
                rounded-[15px]
                bg-[#31566B]
                text-[14px]
                font-semibold
                tracking-[0.02em]
                text-white
                shadow-[0_10px_24px_rgba(49,86,107,0.18)]
                transition-all duration-300
                hover:-translate-y-0.5
                hover:bg-[#28495C]
                hover:shadow-[0_14px_28px_rgba(49,86,107,0.22)]
                active:translate-y-0
                disabled:cursor-not-allowed
                disabled:opacity-60
                disabled:hover:translate-y-0
              "
            >
              {/* ÁNH SÁNG HOVER */}

              <span
                className="
                  pointer-events-none
                  absolute inset-0
                  bg-gradient-to-r
                  from-white/0
                  via-white/10
                  to-white/0
                  opacity-0
                  transition-opacity duration-300
                  group-hover:opacity-100
                "
              />

              {loading || checkingSession ? (
                <>
                  <LoaderCircle
                    className="
                      relative z-10
                      h-[18px] w-[18px]
                      animate-spin
                    "
                  />

                  <span className="relative z-10">
                    {loading
                      ? "Đang đăng nhập..."
                      : "Đang kiểm tra phiên..."}
                  </span>
                </>
              ) : (
                <>
                  <span className="relative z-10">
                    Đăng nhập
                  </span>

                  <ArrowRight
                    className="
                      relative z-10
                      h-[17px] w-[17px]
                      transition-transform duration-300
                      group-hover:translate-x-1
                    "
                    strokeWidth={1.8}
                  />
                </>
              )}
            </button>

            {/* =========================================
                QUÊN MẬT KHẨU
                CẬP NHẬT:
                - Nằm dưới nút Đăng nhập.
                - Căn giữa theo chiều ngang.
                - Hiển thị tốt trên mobile/desktop.
                - Giữ nguyên trang đích.
            ========================================= */}

            <div
              className="
                flex w-full
                items-center justify-center
                pt-1 text-center
              "
            >
              <Link
                href="/admin/forgot-password"
                className="
                  inline-flex
                  items-center justify-center
                  rounded-md
                  px-3 py-1
                  text-center
                  text-[13px]
                  font-medium
                  text-[#61726D]
                  transition-all duration-200
                  hover:text-[#C98792]
                  hover:underline
                  hover:underline-offset-4
                  focus-visible:outline
                  focus-visible:outline-2
                  focus-visible:outline-offset-2
                  focus-visible:outline-[#B8A27D]
                "
              >
                Quên mật khẩu?
              </Link>
            </div>
          </form>

          {/* ===========================================
              BOTTOM SECURITY LABEL
          =========================================== */}

          <div
            className="
              mt-7 flex
              items-center justify-center
              gap-2
              border-t border-[#F0EDE7]
              pt-5
            "
          >
            <LockKeyhole
              className="
                h-[13px] w-[13px]
                text-[#9BA6A2]
              "
              strokeWidth={1.6}
            />

            <span
              className="
                text-[11px]
                tracking-[0.02em]
                text-[#9AA6A5]
              "
            >
              Khu vực dành riêng cho quản trị viên
            </span>
          </div>
        </section>

        {/* =============================================
            FOOTER
        ============================================= */}

        <div className="mt-7 text-center">
          <p
            className="
              text-[11px]
              tracking-[0.03em]
              text-[#98A2A1]
            "
          >
            Nam &amp; Thư Wedding

            <span
              className="mx-2 text-[#B8A27D]"
            >
              ·
            </span>

            Private Administration
          </p>

          <div
            className="
              mt-3 flex
              items-center justify-center
              gap-2
            "
          >
            <span
              className="
                h-px w-7
                bg-[#B8A27D]/30
              "
            />

            <Heart
              className="
                h-[11px] w-[11px]
                text-[#C98792]/70
              "
              strokeWidth={1.4}
            />

            <span
              className="
                h-px w-7
                bg-[#B8A27D]/30
              "
            />
          </div>
        </div>
      </div>
    </main>
  );
}
