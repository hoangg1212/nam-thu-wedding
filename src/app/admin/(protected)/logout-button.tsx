
"use client";

import { useState } from "react";

import {
  useRouter,
} from "next/navigation";

import {
  LogOut,
} from "lucide-react";

export default function LogoutButton() {
  const router = useRouter();

  const [loading, setLoading] =
    useState(false);

  const [error, setError] =
    useState("");

  async function handleLogout() {
    if (loading) return;

    setLoading(true);
    setError("");

    try {
      const response = await fetch(
        "/api/admin/auth/logout",
        {
          method: "POST",
          credentials: "same-origin",
        }
      );

      if (!response.ok) {
        throw new Error(
          "Đăng xuất không thành công."
        );
      }

      router.replace("/admin/login");
      router.refresh();
    } catch {
      setError(
        "Không thể đăng xuất. Vui lòng thử lại."
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={handleLogout}
        disabled={loading}
        className="inline-flex items-center gap-2 rounded-xl border border-[#E3DECF] bg-white px-4 py-2.5 text-sm font-medium text-[#31566B] transition hover:border-[#B8A27D] hover:bg-[#FCFAF5] disabled:opacity-60"
      >
        <LogOut className="h-4 w-4" />

        {loading
          ? "Đang đăng xuất..."
          : "Đăng xuất"}
      </button>

      {error && (
        <span
          role="alert"
          className="text-xs text-red-600"
        >
          {error}
        </span>
      )}
    </div>
  );
}
