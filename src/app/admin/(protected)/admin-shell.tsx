
"use client";

import {
  useEffect,
  useState,
  type ReactNode,
} from "react";

import Link from "next/link";
import { usePathname } from "next/navigation";

import {
  BookHeart,
  CalendarDays,
  ChevronRight,
  Heart,
  ImageIcon,
  LayoutDashboard,
  LockKeyhole,
  Mail,
  Menu,
  MessageCircleHeart,
  Settings2,
  UserRound,
  UserRoundCog,
  Users,
  X,
  type LucideIcon,
} from "lucide-react";

import LogoutButton from "./logout-button";

// ======================================================
// NAM & THU - ADMIN SHELL
//
// GIAI ĐOẠN 3.11 - FIX ESLINT
//
// CẬP NHẬT:
// - Sửa react-hooks/set-state-in-effect.
// - Tự đóng mobile menu khi chuyển trang.
// - Không cần đồng bộ pathname bằng useEffect.
// - Giữ nguyên phân quyền sidebar.
// - Love Story hiển thị cho cả ba Admin.
// - Giữ nguyên desktop/mobile.
// - Giữ avatar, header và đăng xuất.
// - Tô sáng menu đang truy cập.
//
// LƯU Ý:
// Sidebar chỉ điều khiển hiển thị menu.
// Backend API vẫn phải kiểm tra phân quyền.
// ======================================================

// ======================================================
// TYPES
// ======================================================

type AdminRole =
  | "super_admin"
  | "groom_admin"
  | "bride_admin";

type WeddingSide = "groom" | "bride";

interface AdminInfo {
  id: string;
  username: string;
  role: AdminRole;
  side: WeddingSide | null;
  fullName: string;
  avatarDataUrl: string | null;
}

interface AdminShellProps {
  admin: AdminInfo;
  children: ReactNode;
}

interface NavigationItem {
  id: string;
  title: string;
  href: string | null;
  icon: LucideIcon;
  roles: AdminRole[];
}

// Trạng thái menu lưu kèm đường dẫn
// để tự đóng menu khi pathname thay đổi.
interface MobileMenuState {
  pathname: string;
  open: boolean;
}

// ======================================================
// ROLES
// ======================================================

const ALL_ROLES: AdminRole[] = [
  "super_admin",
  "groom_admin",
  "bride_admin",
];

// ======================================================
// NAVIGATION
// ======================================================

const NAVIGATION: NavigationItem[] = [
  {
    id: "dashboard",
    title: "Tổng quan",
    href: "/admin",
    icon: LayoutDashboard,
    roles: ALL_ROLES,
  },
  {
    id: "accounts",
    title: "Quản lý tài khoản",
    href: "/admin/accounts",
    icon: UserRoundCog,
    roles: ALL_ROLES,
  },
  {
    id: "events",
    title: "Thông tin lễ cưới",
    href: "/admin/events",
    icon: CalendarDays,
    roles: ALL_ROLES,
  },
  {
    id: "guests",
    title: "Khách mời",
    href: "/admin/guests",
    icon: Users,
    roles: ALL_ROLES,
  },
  {
    id: "invitations",
    title: "Thiệp mời",
    href: "/admin/invitations",
    icon: Mail,
    roles: ALL_ROLES,
  },
  {
    id: "wishes",
    title: "Lời chúc",
    href: "/admin/wishes",
    icon: MessageCircleHeart,
    roles: ALL_ROLES,
  },
  {
    id: "gallery",
    title: "Album ảnh",
    href: "/admin/gallery",
    icon: ImageIcon,
    roles: ALL_ROLES,
  },
  {
    id: "stories",
    title: "Câu chuyện tình yêu",
    href: "/admin/stories",
    icon: BookHeart,

    // Cả ba Admin đều thấy Love Story.
    roles: ALL_ROLES,
  },
  {
    id: "settings",
    title: "Cài đặt hệ thống",
    href: null,
    icon: Settings2,

    // Chỉ Super Admin thấy mục này.
    roles: ["super_admin"],
  },
];

// ======================================================
// HELPERS
// ======================================================

function getRoleLabel(
  role: AdminRole
): string {
  switch (role) {
    case "super_admin":
      return "Super Admin";

    case "groom_admin":
      return "Admin Nhà trai";

    case "bride_admin":
      return "Admin Nhà gái";

    default:
      return "Quản trị viên";
  }
}

function isActivePath(
  pathname: string,
  href: string
): boolean {
  if (href === "/admin") {
    return pathname === "/admin";
  }

  return (
    pathname === href ||
    pathname.startsWith(`${href}/`)
  );
}

function getPageTitle(
  pathname: string
): string {
  const currentItem = NAVIGATION.find(
    (item) =>
      item.href !== null &&
      isActivePath(pathname, item.href)
  );

  return (
    currentItem?.title ??
    "Quản trị website"
  );
}

// ======================================================
// AVATAR
// ======================================================

function AdminAvatar({
  admin,
}: {
  admin: AdminInfo;
}) {
  const displayName =
    admin.fullName?.trim() ||
    admin.username;

  return (
    <span
      className="
        flex h-11 w-11
        shrink-0 items-center
        justify-center overflow-hidden
        rounded-full border-2
        border-[#E8D5CB]
        bg-[#F9ECEE]
        shadow-sm
        sm:h-12 sm:w-12
      "
    >
      {admin.avatarDataUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={admin.avatarDataUrl}
          alt={`Ảnh đại diện ${displayName}`}
          className="
            h-full w-full
            object-cover
          "
        />
      ) : (
        <UserRound
          size={21}
          strokeWidth={1.6}
          className="text-[#C98792]"
        />
      )}
    </span>
  );
}

// ======================================================
// SIDEBAR
// ======================================================

function Sidebar({
  role,
  pathname,
  onNavigate,
}: {
  role: AdminRole;
  pathname: string;
  onNavigate?: () => void;
}) {
  // Chỉ hiển thị các menu được phép.
  const visibleMenu = NAVIGATION.filter(
    (item) => item.roles.includes(role)
  );

  return (
    <div
      className="
        flex h-full min-h-0
        flex-col bg-[#31566B]
        text-white
      "
    >
      {/* ============================================
          LOGO
      ============================================ */}

      <Link
        href="/admin"
        onClick={onNavigate}
        className="
          flex min-h-[94px]
          items-center gap-3
          px-5 py-5
        "
      >
        <span
          className="
            flex h-12 w-12
            shrink-0 items-center
            justify-center
            rounded-full
            border border-white/20
            bg-white/10
          "
        >
          <Heart
            size={24}
            strokeWidth={1.4}
            className="text-[#E9BAC2]"
          />
        </span>

        <span className="min-w-0">
          <span
            className="
              block font-wedding-serif
              text-[27px] leading-none
            "
          >
            Nam &amp; Thư
          </span>

          <span
            className="
              mt-2 block
              text-[9px] font-semibold
              uppercase
              tracking-[0.20em]
              text-[#DCC7A6]
            "
          >
            Quản trị viên
          </span>
        </span>
      </Link>

      <div
        className="
          mx-5 h-px bg-white/15
        "
      />

      {/* ============================================
          NAVIGATION
      ============================================ */}

      <nav
        aria-label="Điều hướng quản trị"
        className="
          min-h-0 flex-1
          overflow-y-auto
          px-3 pb-5 pt-6
        "
      >
        <p
          className="
            mb-3 px-4
            text-[10px] font-semibold
            uppercase tracking-[0.20em]
            text-[#B7CBD2]
          "
        >
          Điều hướng
        </p>

        <div className="space-y-1">
          {visibleMenu.map((item) => {
            const Icon = item.icon;

            // =====================================
            // MODULE CHƯA KÍCH HOẠT
            // =====================================

            if (item.href === null) {
              return (
                <div
                  key={item.id}
                  title="Sắp triển khai"
                  aria-disabled="true"
                  className="
                    flex min-h-[47px]
                    items-center gap-3
                    rounded-xl
                    px-4 py-3
                    text-[#B5C8CE]/65
                  "
                >
                  <Icon
                    size={17}
                    strokeWidth={1.6}
                    className="shrink-0"
                  />

                  <span
                    className="
                      min-w-0 flex-1
                      truncate text-[13px]
                    "
                  >
                    {item.title}
                  </span>

                  <LockKeyhole
                    size={13}
                    className="shrink-0"
                  />
                </div>
              );
            }

            // =====================================
            // MODULE ĐÃ HOẠT ĐỘNG
            // =====================================

            const active = isActivePath(
              pathname,
              item.href
            );

            return (
              <Link
                key={item.id}
                href={item.href}
                onClick={onNavigate}
                aria-current={
                  active ? "page" : undefined
                }
                className={
                  active
                    ? `
                      flex min-h-[47px]
                      items-center gap-3
                      rounded-xl
                      border border-white/25
                      bg-white/15
                      px-4 py-3
                      text-white
                      transition
                    `
                    : `
                      flex min-h-[47px]
                      items-center gap-3
                      rounded-xl
                      px-4 py-3
                      text-[#D5E2E5]
                      transition
                      hover:bg-white/10
                      hover:text-white
                    `
                }
              >
                <Icon
                  size={17}
                  strokeWidth={1.7}
                  className={
                    active
                      ? "shrink-0 text-[#E8C6AD]"
                      : "shrink-0"
                  }
                />

                <span
                  className="
                    min-w-0 flex-1
                    truncate text-[13px]
                    font-medium
                  "
                >
                  {item.title}
                </span>

                {active && (
                  <ChevronRight
                    size={15}
                    className="
                      shrink-0
                      text-[#E8C6AD]
                    "
                  />
                )}
              </Link>
            );
          })}
        </div>
      </nav>

      {/* ============================================
          LOGOUT
      ============================================ */}

      <div
        className="
          shrink-0
          border-t border-white/15
          p-4
        "
      >
        <div
          className="
            flex items-center
            justify-center
            rounded-xl
            bg-white p-1.5
            text-[#31566B]
            shadow-sm
            [&_button]:w-full
            [&_button]:justify-center
            [&_button]:border-transparent
            [&_button]:text-[#31566B]
            [&_button]:shadow-none
            [&_button]:hover:bg-[#F3F5F1]
          "
        >
          <LogoutButton />
        </div>
      </div>
    </div>
  );
}

// ======================================================
// TOPBAR
// ======================================================

function Topbar({
  admin,
  pathname,
  mobileMenuOpen,
  onToggleMenu,
}: {
  admin: AdminInfo;
  pathname: string;
  mobileMenuOpen: boolean;
  onToggleMenu: () => void;
}) {
  const displayName =
    admin.fullName?.trim() ||
    admin.username;

  return (
    <header
      className="
        sticky top-0 z-30
        border-b border-[#E9E3D9]
        bg-white/95
        backdrop-blur-xl
      "
    >
      <div
        className="
          flex min-h-[78px]
          items-center justify-between
          gap-3 px-4 py-3
          sm:px-6
          xl:px-8
        "
      >
        {/* ==========================================
            HEADER LEFT
        ========================================== */}

        <div
          className="
            flex min-w-0
            items-center gap-3
          "
        >
          <button
            type="button"
            aria-label={
              mobileMenuOpen
                ? "Đóng menu"
                : "Mở menu"
            }
            aria-controls="mobile-admin-sidebar"
            aria-expanded={mobileMenuOpen}
            onClick={onToggleMenu}
            className="
              flex h-10 w-10
              shrink-0 items-center
              justify-center
              rounded-xl
              border border-[#E7E1D8]
              text-[#31566B]
              lg:hidden
            "
          >
            {mobileMenuOpen ? (
              <X size={20} />
            ) : (
              <Menu size={20} />
            )}
          </button>

          <div className="min-w-0">
            <h1
              className="
                truncate text-[16px]
                font-semibold
                text-[#31566B]
                sm:text-[18px]
              "
            >
              {getPageTitle(pathname)}
            </h1>

            <p
              className="
                mt-1 hidden
                text-[11px]
                text-[#9BA6A8]
                sm:block
              "
            >
              Nam &amp; Thư Wedding Administration
            </p>
          </div>
        </div>

        {/* ==========================================
            HEADER RIGHT
        ========================================== */}

        <Link
          href="/admin/accounts"
          title="Xem hồ sơ cá nhân"
          className="
            group flex min-w-0
            shrink-0 items-center
            gap-3 rounded-xl
            px-2 py-1.5
            transition
            hover:bg-[#F8F6F1]
          "
        >
          <div
            className="
              min-w-0 text-right
            "
          >
            <p
              className="
                max-w-[150px]
                truncate text-[12px]
                font-semibold
                sm:max-w-[240px]
                sm:text-[13px]
              "
            >
              Xin chào,{" "}
              {displayName}
            </p>

            <p
              className="
                mt-1 text-[11px]
                text-[#819297]
              "
            >
              {getRoleLabel(
                admin.role
              )}
            </p>
          </div>

          <AdminAvatar
            admin={admin}
          />
        </Link>
      </div>
    </header>
  );
}

// ======================================================
// MAIN ADMIN SHELL
// ======================================================

export default function AdminShell({
  admin,
  children,
}: AdminShellProps) {
  const pathname = usePathname();

  // ==================================================
  // FIX ESLINT: MOBILE MENU STATE
  //
  // Không gọi setState khi pathname thay đổi
  // trong useEffect.
  //
  // Thay vào đó, lưu pathname cùng trạng thái
  // menu. Nếu route hiện tại khác route được
  // lưu trong state thì menu được xem là đóng.
  //
  // Ưu điểm:
  // - Không có setState trong effect.
  // - Menu tự đóng khi điều hướng.
  // - Không gây render bổ sung.
  // - Không ảnh hưởng sidebar desktop.
  // ==================================================

  const [mobileMenuState, setMobileMenuState] =
    useState<MobileMenuState>({
      pathname,
      open: false,
    });

  const mobileMenuOpen =
    mobileMenuState.pathname === pathname &&
    mobileMenuState.open;

  // ==================================================
  // TOGGLE MOBILE MENU
  // ==================================================

  function toggleMobileMenu() {
    setMobileMenuState((current) => ({
      pathname,
      open:
        current.pathname === pathname
          ? !current.open
          : true,
    }));
  }

  // ==================================================
  // CLOSE MOBILE MENU
  // ==================================================

  function closeMobileMenu() {
    setMobileMenuState({
      pathname,
      open: false,
    });
  }

  // ==================================================
  // ĐÓNG MENU BẰNG ESCAPE
  //
  // Event listener là hệ thống bên ngoài React.
  // Việc sử dụng useEffect ở đây là hợp lệ.
  // ==================================================

  useEffect(() => {
    if (!mobileMenuOpen) {
      return;
    }

    function handleEscape(
      event: KeyboardEvent
    ) {
      if (event.key === "Escape") {
        setMobileMenuState((current) => ({
          pathname: current.pathname,
          open: false,
        }));
      }
    }

    window.addEventListener(
      "keydown",
      handleEscape
    );

    return () => {
      window.removeEventListener(
        "keydown",
        handleEscape
      );
    };
  }, [mobileMenuOpen]);

  // ==================================================
  // KHÓA CUỘN NỀN KHI MOBILE MENU MỞ
  //
  // Đồng bộ thuộc tính DOM với React state.
  // Không có setState đồng bộ trong effect.
  // ==================================================

  useEffect(() => {
    if (!mobileMenuOpen) {
      return;
    }

    const previousOverflow =
      document.body.style.overflow;

    document.body.style.overflow =
      "hidden";

    return () => {
      document.body.style.overflow =
        previousOverflow;
    };
  }, [mobileMenuOpen]);

  // ==================================================
  // RENDER
  // ==================================================

  return (
    <div
      className="
        min-h-screen
        bg-[#F9F8EE]
        text-[#31566B]
      "
    >
      <div
        className="
          flex min-h-screen
        "
      >
        {/* ============================================
            DESKTOP SIDEBAR
        ============================================ */}

        <aside
          className="
            sticky top-0
            hidden h-screen
            w-[252px]
            shrink-0
            overflow-hidden
            lg:block
            xl:w-[272px]
          "
        >
          <Sidebar
            role={admin.role}
            pathname={pathname}
          />
        </aside>

        {/* ============================================
            MOBILE BACKDROP
        ============================================ */}

        {mobileMenuOpen && (
          <button
            type="button"
            aria-label="Đóng menu"
            onClick={closeMobileMenu}
            className="
              fixed inset-0
              z-40
              bg-[#102D3C]/55
              backdrop-blur-[2px]
              lg:hidden
            "
          />
        )}

        {/* ============================================
            MOBILE DRAWER
        ============================================ */}

        <aside
          id="mobile-admin-sidebar"
          aria-label="Menu quản trị trên điện thoại"
          aria-hidden={!mobileMenuOpen}
          inert={!mobileMenuOpen}
          className={
            `
              fixed inset-y-0 left-0
              z-50
              w-[min(290px,85vw)]
              overflow-hidden
              shadow-2xl
              transition-transform
              duration-300
              lg:hidden
            ` +
            (
              mobileMenuOpen
                ? " translate-x-0"
                : " -translate-x-full"
            )
          }
        >
          <Sidebar
            role={admin.role}
            pathname={pathname}
            onNavigate={closeMobileMenu}
          />

          <button
            type="button"
            aria-label="Đóng sidebar"
            onClick={closeMobileMenu}
            className="
              absolute right-3 top-3
              flex h-9 w-9
              items-center justify-center
              rounded-lg
              bg-white/10 text-white
              hover:bg-white/20
            "
          >
            <X size={18} />
          </button>
        </aside>

        {/* ============================================
            MAIN CONTENT
        ============================================ */}

        <div
          className="
            flex min-w-0
            flex-1 flex-col
          "
        >
          <Topbar
            admin={admin}
            pathname={pathname}
            mobileMenuOpen={mobileMenuOpen}
            onToggleMenu={toggleMobileMenu}
          />

          <div
            className="
              min-w-0 flex-1
            "
          >
            {children}
          </div>

          {/* ==========================================
              FOOTER
          ========================================== */}

          <footer
            className="
              border-t border-[#E9E3D9]
              bg-white/60
              px-4 py-4
              text-center
              text-[11px]
              text-[#9AA5A6]
            "
          >
            Nam &amp; Thư Wedding

            <span
              className="
                mx-2
                text-[#B8A27D]
              "
            >
              ·
            </span>

            Quản trị viên
          </footer>
        </div>
      </div>
    </div>
  );
}
