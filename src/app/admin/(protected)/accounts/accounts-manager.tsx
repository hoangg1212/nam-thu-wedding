
"use client";

import {
  useCallback,
  useEffect,
  useState,
  type FormEvent,
} from "react";

import {
  CheckCircle2,
  Eye,
  EyeOff,
  KeyRound,
  LockKeyhole,
  Plus,
  RefreshCw,
  ShieldCheck,
  UnlockKeyhole,
  UserRound,
  Users,
  X,
} from "lucide-react";

// ======================================================
// NAM & THU - SUPER ADMIN ACCOUNTS MANAGER
//
// GIAI ĐOẠN 3.11 - FIX ESLINT
//
// ĐÃ SỬA:
// - react-hooks/set-state-in-effect.
// - Giữ AbortController khi tải dữ liệu.
// - Không cập nhật state đồng bộ từ effect.
//
// GIỮ NGUYÊN:
// - Xem danh sách tài khoản.
// - Tạo tài khoản Nhà trai/Nhà gái.
// - Khóa/mở khóa tài khoản.
// - Đặt lại mật khẩu.
// - Không sửa Super Admin tại đây.
// - Giữ nguyên giao diện và API.
// ======================================================

// ======================================================
// TYPES
// ======================================================

type AdminRole =
  | "super_admin"
  | "groom_admin"
  | "bride_admin";

type ManagedRole =
  | "groom_admin"
  | "bride_admin";

interface Account {
  id: string;
  username: string;
  role: AdminRole;
  isActive: boolean;
  lastLoginAt: string | null;
  createdAt: string | null;
}

interface ApiResponse {
  success?: boolean;
  message?: string;
  accounts?: Account[];
}

// ======================================================
// CONFIG
// ======================================================

const ACCOUNTS_API = "/api/admin/accounts";

// ======================================================
// HELPERS
// ======================================================

function roleLabel(role: AdminRole) {
  switch (role) {
    case "super_admin":
      return "Super Admin";

    case "groom_admin":
      return "Admin Nhà trai";

    case "bride_admin":
      return "Admin Nhà gái";
  }
}

function formatDate(value: string | null) {
  if (!value) {
    return "Chưa có";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Không xác định";
  }

  return date.toLocaleString("vi-VN", {
    timeZone: "Asia/Ho_Chi_Minh",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// ======================================================
// PASSWORD VALIDATION
//
// Kiểm tra mật khẩu trước khi gửi API.
// Backend vẫn phải xác thực độc lập.
// ======================================================

function passwordError(value: string) {
  if (Array.from(value).length < 8) {
    return "Mật khẩu phải có ít nhất 8 ký tự.";
  }

  if (!/[A-Za-z]/.test(value)) {
    return "Mật khẩu phải có chữ cái.";
  }

  if (!/[0-9]/.test(value)) {
    return "Mật khẩu phải có chữ số.";
  }

  if (!/[^A-Za-z0-9\s]/.test(value)) {
    return "Mật khẩu phải có ký tự đặc biệt.";
  }

  if (
    new TextEncoder().encode(value).length > 1024
  ) {
    return "Mật khẩu quá dài.";
  }

  return "";
}

// ======================================================
// API RESPONSE HELPER
// ======================================================

async function readApiResponse(
  response: Response
): Promise<ApiResponse> {
  try {
    return (await response.json()) as ApiResponse;
  } catch {
    throw new Error(
      "Máy chủ trả về dữ liệu không hợp lệ."
    );
  }
}

// ======================================================
// MAIN COMPONENT
// ======================================================

export default function AccountsManager() {
  // ==================================================
  // ACCOUNTS STATE
  // ==================================================

  const [accounts, setAccounts] =
    useState<Account[]>([]);

  const [loading, setLoading] =
    useState(true);

  const [saving, setSaving] =
    useState(false);

  const [error, setError] =
    useState("");

  const [success, setSuccess] =
    useState("");

  // ==================================================
  // CREATE ACCOUNT MODAL
  // ==================================================

  const [createOpen, setCreateOpen] =
    useState(false);

  const [newRole, setNewRole] =
    useState<ManagedRole>("groom_admin");

  const [username, setUsername] =
    useState("");

  const [password, setPassword] =
    useState("");

  // ==================================================
  // RESET PASSWORD MODAL
  // ==================================================

  const [resetAccount, setResetAccount] =
    useState<Account | null>(null);

  const [resetPassword, setResetPassword] =
    useState("");

  const [showPassword, setShowPassword] =
    useState(false);

  // ==================================================
  // LOAD ACCOUNTS
  //
  // Hàm tải danh sách từ MongoDB API.
  //
  // Sử dụng AbortSignal để tránh cập nhật
  // state khi request đã bị hủy.
  // ==================================================

  const loadAccounts = useCallback(
    async (signal?: AbortSignal) => {
      if (signal?.aborted) {
        return;
      }

      setLoading(true);

      try {
        const response = await fetch(
          ACCOUNTS_API,
          {
            credentials: "same-origin",
            cache: "no-store",
            signal,
          }
        );

        const result =
          await readApiResponse(response);

        if (
          !response.ok ||
          !result.success
        ) {
          throw new Error(
            result.message ||
              "Không thể tải danh sách tài khoản."
          );
        }

        if (signal?.aborted) {
          return;
        }

        setAccounts(result.accounts ?? []);
        setError("");
      } catch (caught) {
        if (signal?.aborted) {
          return;
        }

        setError(
          caught instanceof Error
            ? caught.message
            : "Không thể tải tài khoản."
        );
      } finally {
        if (!signal?.aborted) {
          setLoading(false);
        }
      }
    },
    []
  );

  // ==================================================
  // FIX ESLINT: SET STATE IN EFFECT
  //
  // TRƯỚC ĐÂY:
  //
  // useEffect(() => {
  //   const controller = new AbortController();
  //   void loadAccounts(controller.signal);
  //   return () => controller.abort();
  // }, [loadAccounts]);
  //
  // Lệnh loadAccounts() chạy trực tiếp từ
  // useEffect và gọi setLoading(true).
  //
  // CẬP NHẬT:
  // - Đưa việc gọi hàm vào microtask.
  // - Kiểm tra signal trước khi gọi.
  // - Cleanup vẫn hủy request.
  // ==================================================

  useEffect(() => {
    const controller =
      new AbortController();

    void Promise.resolve().then(() => {
      if (controller.signal.aborted) {
        return;
      }

      return loadAccounts(
        controller.signal
      );
    });

    return () => {
      controller.abort();
    };
  }, [loadAccounts]);

  // ==================================================
  // API MUTATION
  //
  // POST: tạo tài khoản.
  // PATCH: khóa/mở khóa/đổi mật khẩu.
  // ==================================================

  async function mutate(
    method: "POST" | "PATCH",
    payload: Record<string, unknown>
  ) {
    const response = await fetch(
      ACCOUNTS_API,
      {
        method,
        credentials: "same-origin",
        cache: "no-store",

        headers: {
          "Content-Type": "application/json",
        },

        body: JSON.stringify(payload),
      }
    );

    const result =
      await readApiResponse(response);

    if (
      !response.ok ||
      !result.success
    ) {
      throw new Error(
        result.message ||
          "Không thể thực hiện thao tác."
      );
    }

    return result;
  }

  // ==================================================
  // CREATE ACCOUNT
  // ==================================================

  async function createAccount(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    if (saving) {
      return;
    }

    // Chuẩn hóa tên đăng nhập.
    const normalized = username
      .trim()
      .toLowerCase();

    // Chỉ cho phép chữ thường, số,
    // dấu gạch dưới, dấu gạch ngang và dấu chấm.
    if (
      !/^[a-z0-9_.-]{3,50}$/.test(normalized)
    ) {
      setError(
        "Tên đăng nhập phải có 3–50 ký tự hợp lệ."
      );
      return;
    }

    const validation =
      passwordError(password);

    if (validation) {
      setError(validation);
      return;
    }

    setSaving(true);
    setError("");
    setSuccess("");

    try {
      const result = await mutate(
        "POST",
        {
          username: normalized,
          password,
          role: newRole,
        }
      );

      // Xóa dữ liệu mật khẩu khỏi state
      // sau khi tạo thành công.
      setCreateOpen(false);
      setUsername("");
      setPassword("");
      setShowPassword(false);

      setSuccess(
        result.message ||
          "Tạo tài khoản thành công."
      );

      await loadAccounts();
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Không thể tạo tài khoản."
      );
    } finally {
      setSaving(false);
    }
  }

  // ==================================================
  // LOCK / UNLOCK ACCOUNT
  //
  // Giữ bước xác nhận trước khi khóa/mở.
  // ==================================================

  async function updateStatus(
    account: Account
  ) {
    if (saving) {
      return;
    }

    const action = account.isActive
      ? "lock"
      : "unlock";

    const confirmed = window.confirm(
      account.isActive
        ? `Khóa tài khoản ${account.username}? Phiên đăng nhập hiện tại sẽ bị thu hồi.`
        : `Mở khóa tài khoản ${account.username}?`
    );

    if (!confirmed) {
      return;
    }

    setSaving(true);
    setError("");
    setSuccess("");

    try {
      const result = await mutate(
        "PATCH",
        {
          id: account.id,
          action,
        }
      );

      setSuccess(
        result.message ||
          "Cập nhật tài khoản thành công."
      );

      await loadAccounts();
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Không thể cập nhật tài khoản."
      );
    } finally {
      setSaving(false);
    }
  }

  // ==================================================
  // RESET PASSWORD
  // ==================================================

  async function submitReset(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    if (!resetAccount || saving) {
      return;
    }

    const validation =
      passwordError(resetPassword);

    if (validation) {
      setError(validation);
      return;
    }

    setSaving(true);
    setError("");
    setSuccess("");

    try {
      const result = await mutate(
        "PATCH",
        {
          id: resetAccount.id,
          action: "reset_password",
          password: resetPassword,
        }
      );

      // Không giữ mật khẩu sau khi lưu.
      setResetAccount(null);
      setResetPassword("");
      setShowPassword(false);

      setSuccess(
        result.message ||
          "Đặt lại mật khẩu thành công."
      );

      await loadAccounts();
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Không thể đặt lại mật khẩu."
      );
    } finally {
      setSaving(false);
    }
  }

  // ==================================================
  // DERIVED DATA
  // ==================================================

  const hasGroom = accounts.some(
    (item) =>
      item.role === "groom_admin"
  );

  const hasBride = accounts.some(
    (item) =>
      item.role === "bride_admin"
  );

  // Mỗi bên chỉ có một tài khoản Admin.
  const canCreate =
    !hasGroom || !hasBride;

  const activeAccounts = accounts.filter(
    (item) => item.isActive
  ).length;

  const familyAccounts = accounts.filter(
    (item) =>
      item.role !== "super_admin"
  ).length;

  // ==================================================
  // RENDER
  // ==================================================

  return (
    <section className="space-y-6">
      {/* ==========================================
          HEADER MODULE
      ========================================== */}

      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="mb-2 flex items-center gap-2 text-[#B8A27D]">
            <Users size={18} />

            <span className="text-xs font-semibold uppercase tracking-[0.15em]">
              Quản lý thành viên
            </span>
          </div>

          <h2 className="text-xl font-semibold text-[#31566B]">
            Tài khoản quản trị
          </h2>

          <p className="mt-2 text-[13px] leading-6 text-[#829296]">
            Quản lý tài khoản Nhà trai và Nhà gái.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          {/* REFRESH */}

          <button
            type="button"
            disabled={loading || saving}
            onClick={() => {
              setError("");
              void loadAccounts();
            }}
            className="inline-flex h-11 items-center gap-2 rounded-xl border border-[#DDE5E1] bg-white px-4 text-sm font-medium disabled:opacity-50"
          >
            <RefreshCw size={16} />
            Làm mới
          </button>

          {/* CREATE */}

          <button
            type="button"
            disabled={
              loading ||
              saving ||
              !canCreate
            }
            onClick={() => {
              setError("");
              setSuccess("");

              setUsername("");
              setPassword("");
              setShowPassword(false);

              setNewRole(
                hasGroom
                  ? "bride_admin"
                  : "groom_admin"
              );

              setCreateOpen(true);
            }}
            className="inline-flex h-11 items-center gap-2 rounded-xl bg-[#31566B] px-5 text-sm font-medium text-white disabled:opacity-50"
          >
            <Plus size={17} />
            Tạo tài khoản
          </button>
        </div>
      </div>

      {/* ==========================================
          NOTIFICATIONS
      ========================================== */}

      {success && (
        <div
          role="status"
          className="flex items-start gap-2 rounded-xl border border-[#CFE6D7] bg-[#EFF9F2] p-4 text-sm text-[#407554]"
        >
          <CheckCircle2
            size={18}
            className="shrink-0"
          />

          <span>{success}</span>
        </div>
      )}

      {error && (
        <div
          role="alert"
          className="rounded-xl border border-[#EEC9C9] bg-[#FFF1F1] p-4 text-sm text-[#B2545A]"
        >
          {error}
        </div>
      )}

      {/* ==========================================
          STATISTICS
      ========================================== */}

      <div className="grid gap-4 sm:grid-cols-3">
        {[
          {
            label: "Tổng tài khoản",
            value: accounts.length,
          },
          {
            label: "Đang hoạt động",
            value: activeAccounts,
          },
          {
            label: "Tài khoản gia đình",
            value: familyAccounts,
          },
        ].map((item) => (
          <div
            key={item.label}
            className="rounded-[18px] border border-[#E7E1D8] bg-white/90 p-5 shadow-sm"
          >
            <p className="text-xs text-[#88989B]">
              {item.label}
            </p>

            <p className="mt-2 text-3xl font-semibold">
              {item.value}
            </p>
          </div>
        ))}
      </div>

      {/* ==========================================
          ACCOUNTS LIST
      ========================================== */}

      <section className="overflow-hidden rounded-[22px] border border-[#E7E1D8] bg-white/95 shadow-sm">
        <div className="flex items-center gap-3 border-b border-[#ECE8DF] p-5">
          <ShieldCheck
            size={19}
            className="text-[#B8A27D]"
          />

          <h3 className="text-sm font-semibold">
            Danh sách tài khoản
          </h3>
        </div>

        {loading ? (
          <p className="p-10 text-center text-sm text-[#88989B]">
            Đang tải danh sách...
          </p>
        ) : accounts.length === 0 ? (
          <p className="p-10 text-center text-sm text-[#88989B]">
            Chưa có tài khoản hiển thị.
          </p>
        ) : (
          <div className="divide-y divide-[#EEEAE2]">
            {accounts.map((account) => {
              const isSuper =
                account.role ===
                "super_admin";

              return (
                <div
                  key={account.id}
                  className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between"
                >
                  {/* ACCOUNT INFORMATION */}

                  <div className="flex min-w-0 items-center gap-3">
                    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#F4F1E9] text-[#B8A27D]">
                      <UserRound size={20} />
                    </span>

                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold">
                        {account.username}
                      </p>

                      <p className="mt-1 text-xs text-[#829296]">
                        {roleLabel(
                          account.role
                        )}
                      </p>

                      <p className="mt-1 text-[11px] text-[#9BA7A7]">
                        Đăng nhập gần nhất:{" "}
                        {formatDate(
                          account.lastLoginAt
                        )}
                      </p>
                    </div>
                  </div>

                  {/* ACCOUNT STATUS */}

                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={
                        account.isActive
                          ? "rounded-full bg-[#EAF6EF] px-3 py-2 text-xs text-[#427857]"
                          : "rounded-full bg-[#FCEEEE] px-3 py-2 text-xs text-[#B2545A]"
                      }
                    >
                      {account.isActive
                        ? "Hoạt động"
                        : "Đã khóa"}
                    </span>

                    {/* Không cho thao tác với
                        tài khoản Super Admin. */}

                    {!isSuper && (
                      <>
                        {/* RESET PASSWORD */}

                        <button
                          type="button"
                          disabled={saving}
                          onClick={() => {
                            setError("");
                            setSuccess("");

                            setShowPassword(false);
                            setResetPassword("");

                            setResetAccount(
                              account
                            );
                          }}
                          className="inline-flex items-center gap-2 rounded-xl border border-[#E0E6E2] px-3 py-2 text-xs font-medium disabled:opacity-50"
                        >
                          <KeyRound size={15} />
                          Đổi mật khẩu
                        </button>

                        {/* LOCK / UNLOCK */}

                        <button
                          type="button"
                          disabled={saving}
                          onClick={() =>
                            void updateStatus(
                              account
                            )
                          }
                          className="inline-flex items-center gap-2 rounded-xl border border-[#E0E6E2] px-3 py-2 text-xs font-medium disabled:opacity-50"
                        >
                          {account.isActive ? (
                            <LockKeyhole
                              size={15}
                            />
                          ) : (
                            <UnlockKeyhole
                              size={15}
                            />
                          )}

                          {account.isActive
                            ? "Khóa"
                            : "Mở khóa"}
                        </button>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* ==========================================
          MODAL TẠO TÀI KHOẢN
      ========================================== */}

      {createOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-[#142D3A]/55 p-4">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="create-title"
            className="w-full max-w-md rounded-[24px] bg-white p-6 shadow-2xl sm:p-8"
          >
            {/* MODAL HEADER */}

            <div className="mb-6 flex items-center justify-between gap-3">
              <h2
                id="create-title"
                className="font-wedding-serif text-3xl"
              >
                Tạo tài khoản
              </h2>

              <button
                type="button"
                disabled={saving}
                aria-label="Đóng"
                onClick={() =>
                  setCreateOpen(false)
                }
              >
                <X size={20} />
              </button>
            </div>

            {/* CREATE FORM */}

            <form
              onSubmit={createAccount}
              className="space-y-4"
            >
              {/* ROLE */}

              <div>
                <label
                  htmlFor="create-role"
                  className="mb-2 block text-sm font-medium"
                >
                  Vai trò
                </label>

                <select
                  id="create-role"
                  value={newRole}
                  disabled={saving}
                  onChange={(event) =>
                    setNewRole(
                      event.target
                        .value as ManagedRole
                    )
                  }
                  className="h-12 w-full rounded-xl border border-[#DDE5E1] bg-white px-4 text-sm"
                >
                  {!hasGroom && (
                    <option value="groom_admin">
                      Admin Nhà trai
                    </option>
                  )}

                  {!hasBride && (
                    <option value="bride_admin">
                      Admin Nhà gái
                    </option>
                  )}
                </select>
              </div>

              {/* USERNAME */}

              <div>
                <label
                  htmlFor="create-username"
                  className="mb-2 block text-sm font-medium"
                >
                  Tên đăng nhập
                </label>

                <input
                  id="create-username"
                  autoComplete="off"
                  required
                  minLength={3}
                  maxLength={50}
                  disabled={saving}
                  value={username}
                  onChange={(event) =>
                    setUsername(
                      event.target.value
                    )
                  }
                  className="h-12 w-full rounded-xl border border-[#DDE5E1] px-4 text-sm"
                  placeholder="Nhập tài khoản"
                />
              </div>

              {/* PASSWORD */}

              <div>
                <label
                  htmlFor="create-password"
                  className="mb-2 block text-sm font-medium"
                >
                  Mật khẩu
                </label>

                <div className="relative">
                  <input
                    id="create-password"
                    type={
                      showPassword
                        ? "text"
                        : "password"
                    }
                    required
                    disabled={saving}
                    autoComplete="new-password"
                    value={password}
                    onChange={(event) =>
                      setPassword(
                        event.target.value
                      )
                    }
                    className="h-12 w-full rounded-xl border border-[#DDE5E1] px-4 pr-12 text-sm"
                    placeholder="Nhập mật khẩu"
                  />

                  <button
                    type="button"
                    disabled={saving}
                    aria-label={
                      showPassword
                        ? "Ẩn mật khẩu"
                        : "Hiện mật khẩu"
                    }
                    onClick={() =>
                      setShowPassword(
                        (value) => !value
                      )
                    }
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[#829296]"
                  >
                    {showPassword ? (
                      <EyeOff size={18} />
                    ) : (
                      <Eye size={18} />
                    )}
                  </button>
                </div>

                <p className="mt-2 text-xs leading-5 text-[#8A999B]">
                  Từ 8 ký tự, gồm chữ cái,
                  chữ số và ký tự đặc biệt.
                </p>
              </div>

              {/* FORM ACTIONS */}

              <div className="flex gap-3 pt-3">
                <button
                  type="button"
                  disabled={saving}
                  onClick={() =>
                    setCreateOpen(false)
                  }
                  className="h-12 flex-1 rounded-xl border border-[#DDE5E1] text-sm"
                >
                  Hủy
                </button>

                <button
                  type="submit"
                  disabled={saving}
                  className="h-12 flex-1 rounded-xl bg-[#31566B] text-sm font-medium text-white disabled:opacity-50"
                >
                  {saving
                    ? "Đang tạo..."
                    : "Tạo tài khoản"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ==========================================
          MODAL ĐẶT LẠI MẬT KHẨU
      ========================================== */}

      {resetAccount && (
        <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-[#142D3A]/55 p-4">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="reset-title"
            className="w-full max-w-md rounded-[24px] bg-white p-6 shadow-2xl sm:p-8"
          >
            {/* MODAL HEADER */}

            <div className="mb-6 flex items-center justify-between gap-3">
              <h2
                id="reset-title"
                className="font-wedding-serif text-3xl"
              >
                Đổi mật khẩu
              </h2>

              <button
                type="button"
                aria-label="Đóng"
                disabled={saving}
                onClick={() =>
                  setResetAccount(null)
                }
              >
                <X size={20} />
              </button>
            </div>

            {/* ACCOUNT INFORMATION */}

            <p className="mb-5 text-sm text-[#829296]">
              Tài khoản:{" "}
              <strong className="text-[#31566B]">
                {resetAccount.username}
              </strong>
            </p>

            {/* RESET FORM */}

            <form
              onSubmit={submitReset}
              className="space-y-4"
            >
              <div>
                <label
                  htmlFor="reset-new-password"
                  className="mb-2 block text-sm font-medium"
                >
                  Mật khẩu mới
                </label>

                <div className="relative">
                  <input
                    id="reset-new-password"
                    type={
                      showPassword
                        ? "text"
                        : "password"
                    }
                    required
                    disabled={saving}
                    autoComplete="new-password"
                    value={resetPassword}
                    onChange={(event) =>
                      setResetPassword(
                        event.target.value
                      )
                    }
                    className="h-12 w-full rounded-xl border border-[#DDE5E1] px-4 pr-12 text-sm"
                    placeholder="Nhập mật khẩu mới"
                  />

                  <button
                    type="button"
                    disabled={saving}
                    aria-label={
                      showPassword
                        ? "Ẩn mật khẩu"
                        : "Hiện mật khẩu"
                    }
                    onClick={() =>
                      setShowPassword(
                        (value) => !value
                      )
                    }
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[#829296]"
                  >
                    {showPassword ? (
                      <EyeOff size={18} />
                    ) : (
                      <Eye size={18} />
                    )}
                  </button>
                </div>

                <p className="mt-2 text-xs leading-5 text-[#8A999B]">
                  Từ 8 ký tự, gồm chữ cái,
                  số và ký tự đặc biệt.
                </p>
              </div>

              {/* FORM ACTIONS */}

              <div className="flex gap-3 pt-3">
                <button
                  type="button"
                  disabled={saving}
                  onClick={() =>
                    setResetAccount(null)
                  }
                  className="h-12 flex-1 rounded-xl border border-[#DDE5E1] text-sm"
                >
                  Hủy
                </button>

                <button
                  type="submit"
                  disabled={saving}
                  className="h-12 flex-1 rounded-xl bg-[#31566B] text-sm font-medium text-white disabled:opacity-50"
                >
                  {saving
                    ? "Đang lưu..."
                    : "Lưu mật khẩu"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </section>
  );
}
