
"use client";

import {
  useEffect,
  useState,
} from "react";

import {
  Menu,
  X,
} from "lucide-react";

import { wedding } from "@/data/wedding";

// ==========================================
// MENU ITEMS
// ==========================================

const menuItems = [
  {
    label: "Trang chủ",
    href: "#home",
  },
  {
    label: "Thư mời",
    href: "#invitation",
  },
  {
    label: "Album ảnh",
    href: "#gallery",
  },
  {
    label: "Hành trình",
    href: "#story",
  },
  {
    label: "Lời chúc",
    href: "#wishes",
  },
  {
    label: "Ngày cưới",
    href: "#countdown",
  },
];

// ==========================================
// MAIN HEADER
// ==========================================

export default function WeddingHeader() {
  // Trạng thái menu mobile
  const [menuOpen, setMenuOpen] = useState(false);

  // Trạng thái cuộn trang
  const [scrolled, setScrolled] = useState(false);

  // ========================================
  // THEO DÕI SCROLL
  // ========================================

  useEffect(() => {
    function handleScroll() {
      setScrolled(window.scrollY > 60);
    }

    const frame = requestAnimationFrame(handleScroll);

    window.addEventListener(
      "scroll",
      handleScroll,
      { passive: true }
    );

    return () => {
      cancelAnimationFrame(frame);

      window.removeEventListener(
        "scroll",
        handleScroll
      );
    };
  }, []);

  // ========================================
  // ĐÓNG MENU KHI NHẤN ESC
  // ========================================

  useEffect(() => {
    if (!menuOpen) return;

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setMenuOpen(false);
      }
    }

    window.addEventListener(
      "keydown",
      handleKeyDown
    );

    return () => {
      window.removeEventListener(
        "keydown",
        handleKeyDown
      );
    };
  }, [menuOpen]);

  // ========================================
  // ĐÓNG MENU
  // ========================================

  function closeMenu() {
    setMenuOpen(false);
  }

  return (
    <header
      className={[
        "wedding-header-new",
        scrolled
          ? "wedding-header-new--scrolled"
          : "",
        menuOpen
          ? "wedding-header-new--open"
          : "",
      ].join(" ")}
    >
      <div className="wedding-header-inner">

        {/* ===================================
            LOGO
        =================================== */}

        <a
          href="#home"
          className="wedding-header-logo"
          onClick={closeMenu}
          aria-label="Trở về trang chủ"
        >
          <span>
            {wedding.groom.shortName.charAt(0)}
          </span>

          <span className="wedding-header-logo-heart">
            ♡
          </span>

          <span>
            {wedding.bride.shortName.charAt(0)}
          </span>
        </a>

        {/* ===================================
            DESKTOP NAVIGATION
        =================================== */}

        <nav
          className="wedding-header-nav"
          aria-label="Menu điều hướng chính"
        >
          {menuItems.map((item) => (
            <a
              key={item.href}
              href={item.href}
              className="wedding-header-link"
            >
              {item.label}
            </a>
          ))}
        </nav>

        {/* ===================================
            MOBILE MENU BUTTON
        =================================== */}

        <button
          type="button"
          className="wedding-header-menu-button"
          onClick={() => setMenuOpen(!menuOpen)}
          aria-label={
            menuOpen
              ? "Đóng menu"
              : "Mở menu"
          }
          aria-expanded={menuOpen}
          aria-controls="wedding-mobile-menu"
        >
          {menuOpen ? (
            <X size={21} strokeWidth={1.5} />
          ) : (
            <Menu size={21} strokeWidth={1.5} />
          )}
        </button>
      </div>

      {/* =====================================
          MOBILE MENU
      ===================================== */}

      <div
        id="wedding-mobile-menu"
        className={[
          "wedding-mobile-menu",
          menuOpen
            ? "wedding-mobile-menu--open"
            : "",
        ].join(" ")}
        aria-hidden={!menuOpen}
        inert={!menuOpen}
      >
        {/* TOP DECORATION */}
        <div
          className="wedding-mobile-decoration"
          aria-hidden="true"
        >
          <span />
          <span>♡</span>
          <span />
        </div>

        {/* MENU LINKS */}
        <nav aria-label="Menu trên điện thoại">
          {menuItems.map((item, index) => (
            <a
              key={item.href}
              href={item.href}
              onClick={closeMenu}
              className="wedding-mobile-link"
            >
              <span className="wedding-mobile-number">
                {String(index + 1).padStart(2, "0")}
              </span>

              <span>{item.label}</span>
            </a>
          ))}
        </nav>

        {/* BOTTOM DECORATION */}
        <div className="wedding-mobile-footer">
          <p className="font-wedding">
            {wedding.groom.shortName}
            {" & "}
            {wedding.bride.shortName}
          </p>

          <span>{wedding.displayDate}</span>
        </div>
      </div>
    </header>
  );
}
