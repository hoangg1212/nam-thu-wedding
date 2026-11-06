
"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type FormEvent,
} from "react";

import {
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  Edit3,
  LoaderCircle,
  Plus,
  RefreshCw,
  Search,
  Trash2,
  UserRound,
  Users,
  X,
} from "lucide-react";

// ======================================================
// NAM & THU - ADMIN GUESTS MANAGER
//
// GIAI ĐOẠN 3.11 - FIX ESLINT
//
// ĐÃ SỬA:
// - Không ghi ref.current trong render.
// - Không gọi setState đồng bộ trong effect
//   khởi tạo tải danh sách.
//
// GIỮ NGUYÊN:
// - Phân trang 10 khách/trang.
// - Tìm kiếm tên và số điện thoại.
// - Lọc Nhà trai / Nhà gái.
// - Thêm khách bằng popup.
// - Sửa khách bằng popup.
// - Xóa mềm bằng popup.
// - Phân quyền qua API.
// - Responsive desktop và mobile.
// - Không quản lý RSVP hoặc thiệp tại đây.
// ======================================================

// ======================================================
// TYPES
// ======================================================

type WeddingSide = "groom" | "bride";

type AdminRole =
  | "super_admin"
  | "groom_admin"
  | "bride_admin";

interface Guest {
  id: string;
  fullName: string;
  phone: string;
  note: string;
  side: WeddingSide;
  createdAt: string;
  updatedAt: string;
}

interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

interface GuestsResponse {
  success?: boolean;
  message?: string;
  guests?: Guest[];
  pagination?: Pagination;
}

interface GuestsManagerProps {
  adminRole: AdminRole;
  adminSide: WeddingSide | null;
}

interface GuestForm {
  fullName: string;
  phone: string;
  note: string;
  side: WeddingSide;
}

type Modal =
  | { type: "create" }
  | { type: "edit"; guest: Guest }
  | { type: "delete"; guest: Guest }
  | null;

// ======================================================
// CONFIG
// ======================================================

const PAGE_SIZE = 10;
const API_URL = "/api/admin/guests";

const inputClass = `
  h-11 w-full rounded-xl
  border border-[#DFE6E2]
  bg-white px-4
  text-[13px] text-[#31566B]
  outline-none transition
  focus:border-[#B8A27D]
  focus:ring-4 focus:ring-[#B8A27D]/10
  disabled:opacity-50
`;

const labelClass =
  "mb-2 block text-[12px] font-medium text-[#425C69]";

// ======================================================
// HELPERS
// ======================================================

function sideLabel(side: WeddingSide) {
  return side === "groom"
    ? "Nhà trai"
    : "Nhà gái";
}

function formatDate(value: string) {
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

function emptyForm(side: WeddingSide): GuestForm {
  return {
    fullName: "",
    phone: "",
    note: "",
    side,
  };
}

async function readResponse(
  response: Response
): Promise<GuestsResponse> {
  try {
    return (await response.json()) as GuestsResponse;
  } catch {
    throw new Error(
      "Máy chủ trả về dữ liệu không hợp lệ."
    );
  }
}

// ======================================================
// MAIN COMPONENT
// ======================================================

export default function GuestsManager({
  adminRole,
  adminSide,
}: GuestsManagerProps) {
  const isSuperAdmin =
    adminRole === "super_admin";

  const defaultSide: WeddingSide =
    adminSide ?? "groom";

  // ==================================================
  // LIST STATE
  // ==================================================

  const [guests, setGuests] =
    useState<Guest[]>([]);

  const [loading, setLoading] =
    useState(true);

  const [saving, setSaving] =
    useState(false);

  const [error, setError] =
    useState("");

  const [success, setSuccess] =
    useState("");

  // ==================================================
  // PAGINATION
  // ==================================================

  const [page, setPage] =
    useState(1);

  const [pagination, setPagination] =
    useState<Pagination>({
      page: 1,
      limit: PAGE_SIZE,
      total: 0,
      totalPages: 0,
    });

  // ==================================================
  // SEARCH / FILTER
  // ==================================================

  const [searchInput, setSearchInput] =
    useState("");

  const [search, setSearch] =
    useState("");

  const [sideFilter, setSideFilter] =
    useState<"all" | WeddingSide>(
      adminSide ?? "all"
    );

  // ==================================================
  // MODAL STATE
  // ==================================================

  const [modal, setModal] =
    useState<Modal>(null);

  const [modalError, setModalError] =
    useState("");

  const [form, setForm] =
    useState<GuestForm>(
      emptyForm(defaultSide)
    );

  const modalRef =
    useRef<HTMLDivElement>(null);

  const closeButtonRef =
    useRef<HTMLButtonElement>(null);

  const previousFocusRef =
    useRef<HTMLElement | null>(null);

  // ==================================================
  // FIX ESLINT 1: REACT REFS
  //
  // Trước đây:
  // savingRef.current = saving;
  //
  // Lệnh trên chạy trong render.
  //
  // Nay đồng bộ ref trong useEffect.
  // Vẫn giữ logic ngăn đóng popup khi đang lưu.
  // ==================================================

  const savingRef = useRef(false);

  useEffect(() => {
    savingRef.current = saving;
  }, [saving]);

  // Tránh response cũ ghi đè response mới.
  const requestVersion = useRef(0);

  // ==================================================
  // LOAD GUESTS
  //
  // MongoDB thực hiện phân trang.
  // Frontend nhận tối đa 10 khách/trang.
  // ==================================================

  const loadGuests = useCallback(
    async (signal?: AbortSignal) => {
      const version =
        ++requestVersion.current;

      setLoading(true);

      try {
        const params =
          new URLSearchParams({
            page: String(page),
            limit: String(PAGE_SIZE),
          });

        if (search) {
          params.set("search", search);
        }

        if (sideFilter !== "all") {
          params.set(
            "side",
            sideFilter
          );
        }

        const response = await fetch(
          `${API_URL}?${params.toString()}`,
          {
            method: "GET",
            cache: "no-store",
            credentials: "same-origin",
            signal,
          }
        );

        const data =
          await readResponse(response);

        if (
          !response.ok ||
          !data.success ||
          !Array.isArray(data.guests)
        ) {
          throw new Error(
            data.message ||
              "Không thể tải danh sách khách mời."
          );
        }

        if (
          signal?.aborted ||
          version !== requestVersion.current
        ) {
          return;
        }

        const nextPagination =
          data.pagination ?? {
            page,
            limit: PAGE_SIZE,
            total: data.guests.length,
            totalPages: 1,
          };

        // Nếu đang ở trang không còn tồn tại
        // sau khi xóa khách thì quay về
        // trang hợp lệ cuối cùng.
        if (
          nextPagination.totalPages > 0 &&
          page > nextPagination.totalPages
        ) {
          setPage(
            nextPagination.totalPages
          );
          return;
        }

        setGuests(data.guests);
        setPagination(nextPagination);
        setError("");
      } catch (caught) {
        if (
          signal?.aborted ||
          version !== requestVersion.current
        ) {
          return;
        }

        setError(
          caught instanceof Error
            ? caught.message
            : "Không thể tải khách mời."
        );
      } finally {
        if (
          !signal?.aborted &&
          version === requestVersion.current
        ) {
          setLoading(false);
        }
      }
    },
    [page, search, sideFilter]
  );

  // ==================================================
  // FIX ESLINT 2: LOAD DATA IN EFFECT
  //
  // Không gọi ngay loadGuests() đồng bộ
  // trong thân effect.
  //
  // Đưa lời gọi vào microtask.
  // Nếu effect đã cleanup, không gửi request.
  //
  // Vẫn sử dụng AbortController như trước.
  // ==================================================

  useEffect(() => {
    const controller = new AbortController();

    void Promise.resolve().then(() => {
      if (controller.signal.aborted) {
        return;
      }

      return loadGuests(controller.signal);
    });

    return () => {
      controller.abort();
    };
  }, [loadGuests]);

  // ==================================================
  // MODAL: SCROLL LOCK + ESC + FOCUS TRAP
  // ==================================================

  const modalOpen =
    modal !== null;

  useEffect(() => {
    if (!modalOpen) {
      return;
    }

    const oldOverflow =
      document.body.style.overflow;

    document.body.style.overflow =
      "hidden";

    closeButtonRef.current?.focus();

    function handleKeydown(
      event: KeyboardEvent
    ) {
      if (event.key === "Escape") {
        if (!savingRef.current) {
          event.preventDefault();
          setModal(null);
        }

        return;
      }

      if (event.key !== "Tab") {
        return;
      }

      const container =
        modalRef.current;

      if (!container) {
        return;
      }

      const focusable =
        Array.from(
          container.querySelectorAll<HTMLElement>(
            'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), a[href]'
          )
        ).filter(
          (element) =>
            element.getClientRects().length > 0
        );

      if (focusable.length === 0) {
        return;
      }

      const first = focusable[0];

      const last =
        focusable[focusable.length - 1];

      if (
        event.shiftKey &&
        document.activeElement === first
      ) {
        event.preventDefault();
        last.focus();
      } else if (
        !event.shiftKey &&
        document.activeElement === last
      ) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener(
      "keydown",
      handleKeydown
    );

    return () => {
      document.body.style.overflow =
        oldOverflow;

      document.removeEventListener(
        "keydown",
        handleKeydown
      );

      previousFocusRef.current?.focus();
    };
  }, [modalOpen]);

  // ==================================================
  // API MUTATION
  // ==================================================

  async function mutate(
    method: "POST" | "PATCH" | "DELETE",
    payload: Record<string, unknown>
  ) {
    const response = await fetch(
      API_URL,
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

    const data =
      await readResponse(response);

    if (
      !response.ok ||
      !data.success
    ) {
      throw new Error(
        data.message ||
          "Không thể thực hiện thao tác."
      );
    }

    return data;
  }

  // ==================================================
  // MODAL ACTIONS
  // ==================================================

  function rememberFocus() {
    previousFocusRef.current =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
  }

  function openCreate() {
    if (saving) return;

    rememberFocus();

    setForm(
      emptyForm(defaultSide)
    );

    setModalError("");
    setSuccess("");

    setModal({
      type: "create",
    });
  }

  function openEdit(guest: Guest) {
    if (saving) return;

    rememberFocus();

    setForm({
      fullName: guest.fullName,
      phone: guest.phone ?? "",
      note: guest.note ?? "",
      side: guest.side,
    });

    setModalError("");
    setSuccess("");

    setModal({
      type: "edit",
      guest,
    });
  }

  function openDelete(guest: Guest) {
    if (saving) return;

    rememberFocus();

    setModalError("");
    setSuccess("");

    setModal({
      type: "delete",
      guest,
    });
  }

  function closeModal() {
    if (saving) return;

    setModal(null);
    setModalError("");
  }

  // ==================================================
  // SAVE GUEST
  // ==================================================

  async function saveGuest(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    if (
      saving ||
      !modal ||
      modal.type === "delete"
    ) {
      return;
    }

    const fullName =
      form.fullName.trim();

    const phone =
      form.phone.trim();

    const note =
      form.note.trim();

    if (
      fullName.length < 2 ||
      fullName.length > 120
    ) {
      setModalError(
        "Họ tên phải từ 2 đến 120 ký tự."
      );
      return;
    }

    if (phone.length > 30) {
      setModalError(
        "Số điện thoại quá dài."
      );
      return;
    }

    if (note.length > 1000) {
      setModalError(
        "Ghi chú quá dài."
      );
      return;
    }

    setSaving(true);
    setModalError("");

    try {
      const isCreate =
        modal.type === "create";

      const payload: Record<
        string,
        unknown
      > = {
        fullName,
        phone,
        note,
      };

      if (modal.type === "create") {
        payload.side = isSuperAdmin
          ? form.side
          : defaultSide;
      } else {
        payload.id = modal.guest.id;
      }

      const result = await mutate(
        isCreate ? "POST" : "PATCH",
        payload
      );

      setModal(null);

      setSuccess(
        result.message ||
          (
            isCreate
              ? "Đã thêm khách mời."
              : "Đã cập nhật khách mời."
          )
      );

      if (isCreate && page !== 1) {
        setPage(1);
      } else {
        await loadGuests();
      }
    } catch (caught) {
      setModalError(
        caught instanceof Error
          ? caught.message
          : "Không thể lưu khách mời."
      );
    } finally {
      setSaving(false);
    }
  }

  // ==================================================
  // DELETE GUEST
  // ==================================================

  async function deleteGuest() {
    if (
      saving ||
      !modal ||
      modal.type !== "delete"
    ) {
      return;
    }

    setSaving(true);
    setModalError("");

    try {
      const result = await mutate(
        "DELETE",
        {
          id: modal.guest.id,
        }
      );

      setModal(null);

      setSuccess(
        result.message ||
          "Đã xóa khách mời."
      );

      if (
        guests.length === 1 &&
        page > 1
      ) {
        setPage(
          (current) =>
            Math.max(1, current - 1)
        );
      } else {
        await loadGuests();
      }
    } catch (caught) {
      setModalError(
        caught instanceof Error
          ? caught.message
          : "Không thể xóa khách."
      );
    } finally {
      setSaving(false);
    }
  }

  // ==================================================
  // SEARCH / FILTER
  // ==================================================

  function handleSearch(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    setPage(1);

    setSearch(
      searchInput.trim()
    );
  }

  function resetFilters() {
    setSearchInput("");
    setSearch("");

    setSideFilter(
      adminSide ?? "all"
    );

    setPage(1);
    setError("");
  }

  // ==================================================
  // PAGINATION DISPLAY
  // ==================================================

  const totalPages =
    pagination.totalPages;

  const firstItem =
    pagination.total === 0
      ? 0
      : (pagination.page - 1) *
          PAGE_SIZE +
        1;

  const lastItem =
    Math.min(
      pagination.page * PAGE_SIZE,
      pagination.total
    );

  const pageNumbers: number[] = [];

  const startPage = Math.max(
    1,
    Math.min(
      page - 2,
      totalPages - 4
    )
  );

  for (
    let number = startPage;
    number <=
      Math.min(
        totalPages,
        startPage + 4
      );
    number++
  ) {
    pageNumbers.push(number);
  }

  // ==================================================
  // RENDER
  // ==================================================

  return (
    <section className="space-y-6">
      {/* ============================================
          HEADER ACTIONS
      ============================================ */}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-[#31566B]">
            Danh sách khách mời
          </h2>

          <p className="mt-1 text-xs text-[#839397]">
            Mỗi trang hiển thị tối đa{" "}
            <strong>10 khách mời</strong>.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={loading || saving}
            onClick={() =>
              void loadGuests()
            }
            className="inline-flex h-11 items-center gap-2 rounded-xl border border-[#DDE5E1] bg-white px-4 text-[13px] font-medium text-[#31566B] disabled:opacity-50"
          >
            <RefreshCw
              size={16}
              className={
                loading
                  ? "animate-spin"
                  : ""
              }
            />
            Làm mới
          </button>

          <button
            type="button"
            disabled={saving}
            onClick={openCreate}
            className="inline-flex h-11 items-center gap-2 rounded-xl bg-[#31566B] px-5 text-[13px] font-medium text-white transition hover:bg-[#29495C] disabled:opacity-50"
          >
            <Plus size={17} />
            Thêm khách mời
          </button>
        </div>
      </div>

      {/* ============================================
          SUMMARY
      ============================================ */}

      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-[18px] border border-[#E7E1D8] bg-white p-5 shadow-sm">
          <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-[#F5F1E8] text-[#B8A27D]">
            <Users size={19} />
          </div>

          <p className="text-3xl font-semibold tabular-nums text-[#31566B]">
            {pagination.total}
          </p>

          <p className="mt-1 text-xs text-[#839397]">
            Khách trong kết quả lọc
          </p>
        </div>

        <div className="rounded-[18px] border border-[#E7E1D8] bg-white p-5 shadow-sm">
          <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-[#F5F1E8] text-[#B8A27D]">
            <UserRound size={19} />
          </div>

          <p className="text-3xl font-semibold tabular-nums text-[#31566B]">
            {Math.max(
              1,
              totalPages
            )}
          </p>

          <p className="mt-1 text-xs text-[#839397]">
            Tổng số trang
          </p>
        </div>
      </div>

      {/* ============================================
          NOTIFICATIONS
      ============================================ */}

      {success && (
        <div
          role="status"
          className="flex items-start gap-2 rounded-xl border border-[#CFE6D7] bg-[#EFF9F2] p-4 text-[13px] text-[#407554]"
        >
          <CheckCircle2
            size={17}
            className="shrink-0"
          />

          {success}
        </div>
      )}

      {error && (
        <div
          role="alert"
          className="rounded-xl border border-[#EEC9C9] bg-[#FFF1F1] p-4 text-[13px] text-[#B2545A]"
        >
          {error}
        </div>
      )}

      {/* ============================================
          SEARCH AND FILTER
      ============================================ */}

      <div className="rounded-[20px] border border-[#E7E1D8] bg-white p-4 shadow-sm sm:p-5">
        <form
          onSubmit={handleSearch}
          className="flex flex-col gap-3 sm:flex-row"
        >
          <div className="relative flex-1">
            <Search
              size={17}
              className="absolute left-4 top-1/2 -translate-y-1/2 text-[#94A2A4]"
            />

            <input
              type="search"
              maxLength={100}
              value={searchInput}
              onChange={(event) =>
                setSearchInput(
                  event.target.value
                )
              }
              placeholder="Tìm họ tên hoặc số điện thoại..."
              className={`${inputClass} pl-11`}
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="h-11 rounded-xl bg-[#31566B] px-6 text-[13px] font-medium text-white disabled:opacity-50"
          >
            Tìm kiếm
          </button>
        </form>

        <div className="mt-4 flex flex-wrap gap-3">
          {isSuperAdmin ? (
            <select
              aria-label="Lọc bên mời"
              value={sideFilter}
              onChange={(event) => {
                setPage(1);
                setSideFilter(
                  event.target.value as
                    | WeddingSide
                    | "all"
                );
              }}
              className={`${inputClass} max-w-[240px]`}
            >
              <option value="all">
                Cả hai bên
              </option>
              <option value="groom">
                Nhà trai
              </option>
              <option value="bride">
                Nhà gái
              </option>
            </select>
          ) : (
            <span className="inline-flex h-11 items-center rounded-xl border border-[#DFE6E2] bg-[#F9F8F4] px-4 text-[13px] text-[#61726D]">
              {sideLabel(
                defaultSide
              )}
            </span>
          )}

          <button
            type="button"
            onClick={resetFilters}
            className="h-11 rounded-xl border border-[#DFE6E2] px-4 text-[13px] text-[#61726D]"
          >
            Xóa bộ lọc
          </button>
        </div>
      </div>

      {/* ============================================
          GUESTS LIST
      ============================================ */}

      <div className="overflow-hidden rounded-[22px] border border-[#E7E1D8] bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-[#EEE9E1] p-5">
          <h3 className="font-semibold text-[#31566B]">
            Khách mời
          </h3>

          <span className="text-xs text-[#89999C]">
            {pagination.total} kết quả
          </span>
        </div>

        {loading ? (
          <div className="flex flex-col items-center justify-center gap-3 py-16 text-[#839397]">
            <LoaderCircle
              size={28}
              className="animate-spin"
            />

            <p className="text-sm">
              Đang tải khách mời...
            </p>
          </div>
        ) : guests.length === 0 ? (
          <div className="px-6 py-16 text-center">
            <Users
              size={34}
              className="mx-auto text-[#B8A27D]"
            />

            <h3 className="mt-4 font-semibold text-[#31566B]">
              Không có khách mời
            </h3>

            <p className="mt-2 text-sm text-[#89999C]">
              Hãy thêm khách hoặc thay đổi bộ lọc.
            </p>
          </div>
        ) : (
          <>
            {/* DESKTOP */}

            <div className="hidden overflow-x-auto lg:block">
              <table className="w-full text-left">
                <thead className="bg-[#F9F8F4] text-[11px] uppercase tracking-wide text-[#819195]">
                  <tr>
                    <th className="px-5 py-4 font-medium">
                      STT
                    </th>
                    <th className="px-5 py-4 font-medium">
                      Họ tên
                    </th>
                    <th className="px-5 py-4 font-medium">
                      Số điện thoại
                    </th>
                    <th className="px-5 py-4 font-medium">
                      Bên mời
                    </th>
                    <th className="px-5 py-4 font-medium">
                      Ghi chú
                    </th>
                    <th className="px-5 py-4 font-medium">
                      Ngày thêm
                    </th>
                    <th className="px-5 py-4 text-right font-medium">
                      Thao tác
                    </th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-[#F0EDE6]">
                  {guests.map(
                    (guest, index) => (
                      <tr
                        key={guest.id}
                        className="hover:bg-[#FAFAF7]"
                      >
                        <td className="px-5 py-4 text-xs text-[#819195]">
                          {firstItem + index}
                        </td>

                        <td className="px-5 py-4 text-[13px] font-semibold text-[#31566B]">
                          {guest.fullName}
                        </td>

                        <td className="px-5 py-4 text-[12px] text-[#61726D]">
                          {guest.phone ||
                            "Chưa có"}
                        </td>

                        <td className="px-5 py-4">
                          <span className="rounded-full bg-[#F5F1E8] px-3 py-1.5 text-[11px] text-[#8C754F]">
                            {sideLabel(
                              guest.side
                            )}
                          </span>
                        </td>

                        <td
                          title={guest.note}
                          className="max-w-[200px] truncate px-5 py-4 text-[12px] text-[#809094]"
                        >
                          {guest.note ||
                            "—"}
                        </td>

                        <td className="px-5 py-4 text-[11px] text-[#89999C]">
                          {formatDate(
                            guest.createdAt
                          )}
                        </td>

                        <td className="px-5 py-4">
                          <div className="flex justify-end gap-2">
                            <button
                              type="button"
                              disabled={saving}
                              onClick={() =>
                                openEdit(
                                  guest
                                )
                              }
                              title="Chỉnh sửa"
                              aria-label={`Sửa khách ${guest.fullName}`}
                              className="rounded-lg p-2 text-[#31566B] hover:bg-[#EEF4F3] disabled:opacity-50"
                            >
                              <Edit3 size={17} />
                            </button>

                            <button
                              type="button"
                              disabled={saving}
                              onClick={() =>
                                openDelete(
                                  guest
                                )
                              }
                              title="Xóa khách"
                              aria-label={`Xóa khách ${guest.fullName}`}
                              className="rounded-lg p-2 text-[#B2545A] hover:bg-[#FFF0F0] disabled:opacity-50"
                            >
                              <Trash2 size={17} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    )
                  )}
                </tbody>
              </table>
            </div>

            {/* MOBILE */}

            <div className="divide-y divide-[#EEEAE2] lg:hidden">
              {guests.map(
                (guest, index) => (
                  <article
                    key={guest.id}
                    className="p-4 sm:p-5"
                  >
                    <div className="flex items-start gap-3">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#F5F1E8] text-[#B8A27D]">
                        <UserRound size={19} />
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-[#9BA6A8]">
                            {firstItem + index}.
                          </span>

                          <h3 className="break-words text-sm font-semibold text-[#31566B]">
                            {guest.fullName}
                          </h3>
                        </div>

                        <p className="mt-1 text-xs text-[#819195]">
                          {guest.phone ||
                            "Chưa có SĐT"}
                        </p>

                        <p className="mt-2 text-xs text-[#9A835B]">
                          {sideLabel(
                            guest.side
                          )}
                        </p>
                      </div>
                    </div>

                    {guest.note && (
                      <p className="mt-3 break-words text-xs leading-6 text-[#809094]">
                        Ghi chú: {guest.note}
                      </p>
                    )}

                    <div className="mt-4 flex gap-2">
                      <button
                        type="button"
                        disabled={saving}
                        onClick={() =>
                          openEdit(guest)
                        }
                        className="inline-flex h-10 items-center gap-2 rounded-lg border border-[#DFE6E2] px-4 text-xs text-[#31566B] disabled:opacity-50"
                      >
                        <Edit3 size={15} />
                        Sửa
                      </button>

                      <button
                        type="button"
                        disabled={saving}
                        onClick={() =>
                          openDelete(guest)
                        }
                        className="inline-flex h-10 items-center gap-2 rounded-lg border border-[#EEDCDD] px-4 text-xs text-[#B2545A] disabled:opacity-50"
                      >
                        <Trash2 size={15} />
                        Xóa
                      </button>
                    </div>
                  </article>
                )
              )}
            </div>
          </>
        )}

        {/* ============================================
            PAGINATION - 10 GUESTS / PAGE
        ============================================ */}

        {!loading && pagination.total > 0 && (
          <div className="flex flex-col gap-4 border-t border-[#EEEAE2] px-4 py-5 sm:px-5">
            <p className="text-center text-xs text-[#89999C] sm:text-left">
              Hiển thị{" "}
              <strong>{firstItem}</strong>
              {" – "}
              <strong>{lastItem}</strong>
              {" / "}
              <strong>
                {pagination.total}
              </strong>{" "}
              khách mời
            </p>

            {totalPages > 1 && (
              <nav
                aria-label="Phân trang khách mời"
                className="flex flex-wrap items-center justify-center gap-2"
              >
                <button
                  type="button"
                  disabled={
                    page <= 1 ||
                    loading ||
                    saving
                  }
                  onClick={() =>
                    setPage(
                      (current) =>
                        Math.max(
                          1,
                          current - 1
                        )
                    )
                  }
                  className="inline-flex h-10 items-center gap-1 rounded-xl border border-[#DFE6E2] px-3 text-xs text-[#31566B] disabled:opacity-40"
                >
                  <ChevronLeft size={16} />
                  Trước
                </button>

                {pageNumbers.map(
                  (pageNumber) => (
                    <button
                      key={pageNumber}
                      type="button"
                      disabled={
                        loading ||
                        saving
                      }
                      onClick={() =>
                        setPage(
                          pageNumber
                        )
                      }
                      aria-label={`Trang ${pageNumber}`}
                      aria-current={
                        page === pageNumber
                          ? "page"
                          : undefined
                      }
                      className={
                        page === pageNumber
                          ? "h-10 min-w-10 rounded-xl bg-[#31566B] px-3 text-xs font-semibold text-white"
                          : "h-10 min-w-10 rounded-xl border border-[#DFE6E2] bg-white px-3 text-xs text-[#31566B] hover:bg-[#F5F1E8]"
                      }
                    >
                      {pageNumber}
                    </button>
                  )
                )}

                <button
                  type="button"
                  disabled={
                    page >= totalPages ||
                    loading ||
                    saving
                  }
                  onClick={() =>
                    setPage(
                      (current) =>
                        Math.min(
                          totalPages,
                          current + 1
                        )
                    )
                  }
                  className="inline-flex h-10 items-center gap-1 rounded-xl border border-[#DFE6E2] px-3 text-xs text-[#31566B] disabled:opacity-40"
                >
                  Sau
                  <ChevronRight size={16} />
                </button>
              </nav>
            )}
          </div>
        )}
      </div>

      {/* ============================================
          MODALS
      ============================================ */}

      {modal && (
        <div
          className="fixed inset-0 z-[9999] flex items-center justify-center bg-[#142D3A]/60 p-3 backdrop-blur-[3px] sm:p-5"
          onMouseDown={(event) => {
            if (
              event.target ===
                event.currentTarget &&
              !saving
            ) {
              closeModal();
            }
          }}
        >
          <div
            ref={modalRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="guest-modal-title"
            className="flex max-h-[92dvh] w-full max-w-[570px] flex-col overflow-hidden rounded-[22px] bg-white shadow-2xl"
          >
            {/* MODAL HEADER */}

            <div className="flex shrink-0 items-start justify-between gap-4 border-b border-[#EEEAE2] p-5 sm:p-7">
              <div>
                <h2
                  id="guest-modal-title"
                  className="font-wedding-serif text-[28px] text-[#31566B]"
                >
                  {modal.type === "create"
                    ? "Thêm khách mời"
                    : modal.type === "edit"
                      ? "Chỉnh sửa khách mời"
                      : "Xác nhận xóa khách"}
                </h2>

                <p className="mt-2 text-xs leading-5 text-[#849497]">
                  {modal.type === "create"
                    ? "Nhập thông tin khách mời mới."
                    : modal.type === "edit"
                      ? "Cập nhật thông tin khách đã có."
                      : "Thông tin khách sẽ được xóa mềm."}
                </p>
              </div>

              <button
                ref={closeButtonRef}
                type="button"
                disabled={saving}
                onClick={closeModal}
                aria-label="Đóng popup"
                className="rounded-lg p-2 text-[#809195] hover:bg-[#F4F5F2] disabled:opacity-50"
              >
                <X size={20} />
              </button>
            </div>

            {modal.type === "delete" ? (
              <>
                {/* DELETE GUEST MODAL */}

                <div className="min-h-0 flex-1 overflow-y-auto p-5 sm:p-7">
                  <p className="text-sm font-semibold text-[#31566B]">
                    Xóa khách{" "}
                    {modal.guest.fullName}?
                  </p>

                  <p className="mt-3 text-[13px] leading-6 text-[#809094]">
                    Khách sẽ không còn xuất hiện
                    trong danh sách. Dữ liệu
                    được xóa mềm trong cơ sở dữ liệu.
                    Nếu khách có link thiệp,
                    link đó có thể không còn
                    truy cập được.
                  </p>

                  {modalError && (
                    <p
                      role="alert"
                      className="mt-4 rounded-xl bg-[#FFF0F0] p-3 text-xs text-[#B2545A]"
                    >
                      {modalError}
                    </p>
                  )}
                </div>

                <div className="flex shrink-0 justify-end gap-3 border-t border-[#EEEAE2] p-5">
                  <button
                    type="button"
                    disabled={saving}
                    onClick={closeModal}
                    className="h-11 rounded-xl border border-[#DEE5E0] px-5 text-sm text-[#61726D]"
                  >
                    Hủy
                  </button>

                  <button
                    type="button"
                    disabled={saving}
                    onClick={() =>
                      void deleteGuest()
                    }
                    className="inline-flex h-11 items-center gap-2 rounded-xl bg-[#B2545A] px-5 text-sm text-white disabled:opacity-50"
                  >
                    {saving && (
                      <LoaderCircle
                        size={16}
                        className="animate-spin"
                      />
                    )}

                    Xác nhận xóa
                  </button>
                </div>
              </>
            ) : (
              <>
                {/* CREATE / EDIT GUEST FORM */}

                <form
                  id="guest-form"
                  onSubmit={(event) =>
                    void saveGuest(event)
                  }
                  className="min-h-0 flex-1 space-y-5 overflow-y-auto p-5 sm:p-7"
                >
                  {/* FULL NAME */}

                  <div>
                    <label
                      htmlFor="guest-full-name"
                      className={labelClass}
                    >
                      Họ và tên *
                    </label>

                    <input
                      id="guest-full-name"
                      required
                      maxLength={120}
                      value={form.fullName}
                      disabled={saving}
                      onChange={(event) =>
                        setForm(
                          (current) => ({
                            ...current,
                            fullName:
                              event.target.value,
                          })
                        )
                      }
                      placeholder="Nhập tên khách mời"
                      className={inputClass}
                    />
                  </div>

                  {/* PHONE */}

                  <div>
                    <label
                      htmlFor="guest-phone"
                      className={labelClass}
                    >
                      Số điện thoại
                    </label>

                    <input
                      id="guest-phone"
                      type="tel"
                      maxLength={30}
                      value={form.phone}
                      disabled={saving}
                      onChange={(event) =>
                        setForm(
                          (current) => ({
                            ...current,
                            phone:
                              event.target.value,
                          })
                        )
                      }
                      placeholder="Nhập số điện thoại"
                      className={inputClass}
                    />
                  </div>

                  {/* WEDDING SIDE */}

                  <div>
                    <label
                      htmlFor="guest-side"
                      className={labelClass}
                    >
                      Bên mời *
                    </label>

                    {modal.type === "create" &&
                    isSuperAdmin ? (
                      <select
                        id="guest-side"
                        value={form.side}
                        disabled={saving}
                        onChange={(event) =>
                          setForm(
                            (current) => ({
                              ...current,
                              side:
                                event.target.value as WeddingSide,
                            })
                          )
                        }
                        className={inputClass}
                      >
                        <option value="groom">
                          Nhà trai
                        </option>

                        <option value="bride">
                          Nhà gái
                        </option>
                      </select>
                    ) : (
                      <input
                        id="guest-side"
                        readOnly
                        value={sideLabel(
                          modal.type === "edit"
                            ? modal.guest.side
                            : defaultSide
                        )}
                        className={`${inputClass} bg-[#F9F8F4]`}
                      />
                    )}
                  </div>

                  {/* NOTE */}

                  <div>
                    <label
                      htmlFor="guest-note"
                      className={labelClass}
                    >
                      Ghi chú
                    </label>

                    <textarea
                      id="guest-note"
                      rows={4}
                      maxLength={1000}
                      value={form.note}
                      disabled={saving}
                      onChange={(event) =>
                        setForm(
                          (current) => ({
                            ...current,
                            note:
                              event.target.value,
                          })
                        )
                      }
                      placeholder="Ghi chú thêm nếu cần..."
                      className={`${inputClass} h-auto min-h-[110px] resize-y py-3`}
                    />
                  </div>

                  {/* VALIDATION ERROR */}

                  {modalError && (
                    <div
                      role="alert"
                      className="rounded-xl border border-[#EEC9C9] bg-[#FFF1F1] p-3 text-xs leading-6 text-[#B2545A]"
                    >
                      {modalError}
                    </div>
                  )}
                </form>

                {/* MODAL FOOTER */}

                <div className="flex shrink-0 justify-end gap-3 border-t border-[#EEEAE2] p-5">
                  <button
                    type="button"
                    disabled={saving}
                    onClick={closeModal}
                    className="h-11 rounded-xl border border-[#DEE5E0] px-5 text-sm text-[#61726D] disabled:opacity-50"
                  >
                    Hủy
                  </button>

                  <button
                    type="submit"
                    form="guest-form"
                    disabled={saving}
                    className="inline-flex h-11 items-center gap-2 rounded-xl bg-[#31566B] px-6 text-sm font-medium text-white disabled:opacity-50"
                  >
                    {saving ? (
                      <LoaderCircle
                        size={16}
                        className="animate-spin"
                      />
                    ) : (
                      <CheckCircle2 size={16} />
                    )}

                    {saving
                      ? "Đang lưu..."
                      : modal.type === "create"
                        ? "Thêm khách"
                        : "Lưu thay đổi"}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
