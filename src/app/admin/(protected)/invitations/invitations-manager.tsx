
"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type FormEvent,
} from "react";

import {
  AlertTriangle,
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  ClipboardCopy,
  Clock3,
  Edit3,
  ExternalLink,
  HeartHandshake,
  LoaderCircle,
  Mail,
  Plus,
  RefreshCw,
  Search,
  Send,
  Trash2,
  UserRound,
  X,
} from "lucide-react";

// ======================================================
// NAM & THU - INVITATIONS MANAGER
//
// CẬP NHẬT GIAI ĐOẠN 3.11
//
// FIX:
// - Không còn form lồng bên trong form.
// - Tìm khách bằng Enter hoặc nút Tìm.
// - Enter tìm khách không kích hoạt lưu thiệp.
//
// GIỮ NGUYÊN:
// - Tạo, sửa, xóa thiệp.
// - Trạng thái gửi thiệp.
// - Tìm kiếm, lọc, phân trang.
// - Chọn khách trong popup.
// - Sao chép và xem link thiệp.
// - Hiển thị RSVP.
// - Giao diện desktop và mobile.
// - Phân quyền xử lý ở backend API.
// ======================================================

// ======================================================
// TYPES
// ======================================================

type AdminRole =
  | "super_admin"
  | "groom_admin"
  | "bride_admin";

type WeddingSide = "groom" | "bride";

type DeliveryStatus = "not_sent" | "sent";

type RsvpStatus =
  | "no_response"
  | "attending"
  | "declined"
  | "unsure";

interface ManagerProps {
  adminRole: AdminRole;
  adminSide: WeddingSide | null;
}

interface Invitation {
  id: string;
  guestId: string;
  guestName: string;
  guestPhone: string;
  guestNote: string;
  guestDeleted: boolean;
  side: WeddingSide;
  slug: string;
  publicToken: string;
  publicPath: string;
  deliveryStatus: DeliveryStatus;
  sentAt: string | null;
  rsvpStatus: RsvpStatus;
  rsvpMessage: string;
  respondedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

interface Guest {
  id: string;
  fullName: string;
  phone: string;
  side: WeddingSide;
  note: string;
}

interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

interface InvitationStatistics {
  total: number;
  sent: number;
  notSent: number;
}

interface InvitationResponse {
  success?: boolean;
  message?: string;
  invitations?: Invitation[];
  invitation?: Invitation;
  pagination?: Pagination;
  statistics?: InvitationStatistics;
}

interface GuestsResponse {
  success?: boolean;
  message?: string;
  guests?: Guest[];
  pagination?: Pagination;
}

type Modal =
  | { type: "create" }
  | { type: "edit"; invitation: Invitation }
  | { type: "delete"; invitation: Invitation }
  | { type: "delivery"; invitation: Invitation }
  | null;

// ======================================================
// CONFIG
// ======================================================

const PAGE_SIZE = 10;
const GUEST_PAGE_SIZE = 100;

const API = "/api/admin/invitations";
const GUEST_API = "/api/admin/guests";

const inputClass =
  "h-11 w-full rounded-xl border border-[#DFE6E2] bg-white px-4 text-[13px] text-[#31566B] outline-none transition focus:border-[#B8A27D] focus:ring-4 focus:ring-[#B8A27D]/10 disabled:opacity-50";

const labelClass =
  "mb-2 block text-[12px] font-medium text-[#425C69]";

const iconButtonClass =
  "inline-flex h-9 w-9 items-center justify-center rounded-lg transition hover:bg-[#F4F5F2] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#B8A27D] disabled:cursor-not-allowed disabled:opacity-40";

// ======================================================
// DISPLAY HELPERS
// ======================================================

function sideLabel(side: WeddingSide) {
  return side === "groom" ? "Nhà trai" : "Nhà gái";
}

function deliveryLabel(status: DeliveryStatus) {
  return status === "sent" ? "Đã gửi" : "Chưa gửi";
}

function rsvpLabel(status: RsvpStatus) {
  switch (status) {
    case "attending":
      return "Sẽ tham dự";
    case "declined":
      return "Không tham dự";
    case "unsure":
      return "Chưa chắc chắn";
    default:
      return "Chưa phản hồi";
  }
}

function rsvpClass(status: RsvpStatus) {
  switch (status) {
    case "attending":
      return "bg-[#EAF7EE] text-[#427857]";
    case "declined":
      return "bg-[#FFF0F0] text-[#B45F65]";
    case "unsure":
      return "bg-[#FFF5E4] text-[#9A7542]";
    default:
      return "bg-[#EEF2F4] text-[#748891]";
  }
}

function formatDate(
  value: string | null | undefined
) {
  if (!value) return "Chưa có";

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

function getPublicUrl(path: string) {
  return new URL(
    path,
    window.location.origin
  ).toString();
}

async function copyText(text: string) {
  if (
    navigator.clipboard &&
    window.isSecureContext
  ) {
    try {
      await navigator.clipboard.writeText(text);
      return;
    } catch {
      // Dùng cách sao chép dự phòng.
    }
  }

  const element = document.createElement("textarea");

  element.value = text;
  element.readOnly = true;
  element.style.position = "fixed";
  element.style.left = "-9999px";

  document.body.appendChild(element);
  element.select();

  try {
    if (!document.execCommand("copy")) {
      throw new Error(
        "Trình duyệt không cho phép sao chép."
      );
    }
  } finally {
    element.remove();
  }
}

async function readJson<T>(
  response: Response
): Promise<T> {
  try {
    return (await response.json()) as T;
  } catch {
    throw new Error(
      "Máy chủ trả về dữ liệu không hợp lệ."
    );
  }
}

// ======================================================
// STATISTICS CARD
// ======================================================

function StatCard({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: number;
  icon: typeof Mail;
}) {
  return (
    <div className="rounded-[18px] border border-[#E7E1D8] bg-white/95 p-4 shadow-sm sm:p-5">
      <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-xl bg-[#F5F1E8] text-[#B8A27D]">
        <Icon size={18} />
      </div>

      <p className="text-[25px] font-semibold tabular-nums text-[#31566B] sm:text-3xl">
        {value}
      </p>

      <p className="mt-1 text-[11px] text-[#839397] sm:text-xs">
        {label}
      </p>
    </div>
  );
}

// ======================================================
// MAIN COMPONENT
// ======================================================

export default function InvitationsManager({
  adminRole,
  adminSide,
}: ManagerProps) {
  const isSuper = adminRole === "super_admin";
  const defaultSide: WeddingSide =
    adminSide ?? "groom";

  // ==================================================
  // DATA
  // ==================================================

  const [invitations, setInvitations] =
    useState<Invitation[]>([]);

  const [statistics, setStatistics] =
    useState<InvitationStatistics>({
      total: 0,
      sent: 0,
      notSent: 0,
    });

  const [pagination, setPagination] =
    useState<Pagination>({
      page: 1,
      limit: PAGE_SIZE,
      total: 0,
      totalPages: 0,
    });

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // ==================================================
  // FILTERS
  // ==================================================

  const [page, setPage] = useState(1);

  const [searchInput, setSearchInput] =
    useState("");

  const [search, setSearch] = useState("");

  const [sideFilter, setSideFilter] =
    useState<"all" | WeddingSide>(
      adminSide ?? "all"
    );

  const [deliveryFilter, setDeliveryFilter] =
    useState<"all" | DeliveryStatus>("all");

  // ==================================================
  // MODAL
  // ==================================================

  const [modal, setModal] = useState<Modal>(null);
  const [modalError, setModalError] = useState("");

  const [selectedGuestId, setSelectedGuestId] =
    useState("");

  const [selectedDelivery, setSelectedDelivery] =
    useState<DeliveryStatus>("not_sent");

  const modalRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);

  const previousFocusRef =
    useRef<HTMLElement | null>(null);

  const savingRef = useRef(false);

  useEffect(() => {
    savingRef.current = saving;
  }, [saving]);

  // ==================================================
  // GUEST PICKER
  // ==================================================

  const [guestSearchInput, setGuestSearchInput] =
    useState("");

  const [guestSearch, setGuestSearch] =
    useState("");

  const [guestPage, setGuestPage] = useState(1);

  const [guestSide, setGuestSide] =
    useState<"all" | WeddingSide>(
      adminSide ?? "all"
    );

  const [guestOptions, setGuestOptions] =
    useState<Guest[]>([]);

  const [guestPagination, setGuestPagination] =
    useState<Pagination>({
      page: 1,
      limit: GUEST_PAGE_SIZE,
      total: 0,
      totalPages: 0,
    });

  const [guestLoading, setGuestLoading] =
    useState(false);

  const [guestError, setGuestError] =
    useState("");

  const requestVersion = useRef(0);

  // ==================================================
  // LOAD INVITATIONS
  // ==================================================

  const loadInvitations = useCallback(
    async (signal?: AbortSignal) => {
      const version = ++requestVersion.current;

      setLoading(true);

      try {
        const params = new URLSearchParams({
          page: String(page),
          limit: String(PAGE_SIZE),
        });

        if (search) {
          params.set("search", search);
        }

        if (sideFilter !== "all") {
          params.set("side", sideFilter);
        }

        if (deliveryFilter !== "all") {
          params.set(
            "deliveryStatus",
            deliveryFilter
          );
        }

        const response = await fetch(
          `${API}?${params.toString()}`,
          {
            credentials: "same-origin",
            cache: "no-store",
            signal,
          }
        );

        const data =
          await readJson<InvitationResponse>(response);

        if (
          !response.ok ||
          !data.success ||
          !Array.isArray(data.invitations)
        ) {
          throw new Error(
            data.message ||
            "Không thể tải danh sách thiệp."
          );
        }

        if (
          signal?.aborted ||
          version !== requestVersion.current
        ) {
          return;
        }

        setInvitations(data.invitations);

        setPagination(
          data.pagination ?? {
            page,
            limit: PAGE_SIZE,
            total: 0,
            totalPages: 0,
          }
        );

        setStatistics(
          data.statistics ?? {
            total: 0,
            sent: 0,
            notSent: 0,
          }
        );

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
            : "Không thể tải thiệp mời."
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
    [page, search, sideFilter, deliveryFilter]
  );

  useEffect(() => {
    const controller = new AbortController();

    void Promise.resolve().then(() => {
      if (!controller.signal.aborted) {
        return loadInvitations(controller.signal);
      }
    });

    return () => {
      controller.abort();
    };
  }, [loadInvitations]);

  // ==================================================
  // LOAD GUEST OPTIONS
  // ==================================================

  const isGuestPickerOpen =
    modal?.type === "create" ||
    modal?.type === "edit";

  useEffect(() => {
    if (!isGuestPickerOpen) return;

    const controller = new AbortController();

    async function fetchGuests() {
      setGuestLoading(true);
      setGuestError("");

      try {
        const params = new URLSearchParams({
          page: String(guestPage),
          limit: String(GUEST_PAGE_SIZE),
        });

        if (guestSearch.trim()) {
          params.set(
            "search",
            guestSearch.trim()
          );
        }

        if (guestSide !== "all") {
          params.set("side", guestSide);
        }

        const response = await fetch(
          `${GUEST_API}?${params.toString()}`,
          {
            credentials: "same-origin",
            cache: "no-store",
            signal: controller.signal,
          }
        );

        const data =
          await readJson<GuestsResponse>(response);

        if (
          !response.ok ||
          !data.success ||
          !Array.isArray(data.guests)
        ) {
          throw new Error(
            data.message ||
            "Không thể tải danh sách khách."
          );
        }

        if (controller.signal.aborted) return;

        setGuestOptions(data.guests);

        setGuestPagination(
          data.pagination ?? {
            page: guestPage,
            limit: GUEST_PAGE_SIZE,
            total: data.guests.length,
            totalPages: 1,
          }
        );
      } catch (caught) {
        if (controller.signal.aborted) return;

        setGuestOptions([]);

        setGuestError(
          caught instanceof Error
            ? caught.message
            : "Không thể tải khách mời."
        );
      } finally {
        if (!controller.signal.aborted) {
          setGuestLoading(false);
        }
      }
    }

    void fetchGuests();

    return () => controller.abort();
  }, [
    isGuestPickerOpen,
    guestPage,
    guestSearch,
    guestSide,
  ]);

  // ==================================================
  // MODAL BEHAVIOUR
  // ==================================================

  const modalOpen = modal !== null;

  useEffect(() => {
    if (!modalOpen) return;

    const oldOverflow =
      document.body.style.overflow;

    document.body.style.overflow = "hidden";

    closeRef.current?.focus();

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        if (!savingRef.current) {
          event.preventDefault();
          setModal(null);
        }
        return;
      }

      if (event.key !== "Tab") return;

      const container = modalRef.current;

      if (!container) return;

      const focusable = Array.from(
        container.querySelectorAll<HTMLElement>(
          'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), a[href]'
        )
      ).filter(
        (element) =>
          element.getClientRects().length > 0
      );

      if (!focusable.length) return;

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
      onKeyDown
    );

    return () => {
      document.body.style.overflow = oldOverflow;

      document.removeEventListener(
        "keydown",
        onKeyDown
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
    const response = await fetch(API, {
      method,
      credentials: "same-origin",
      cache: "no-store",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    const result =
      await readJson<InvitationResponse>(response);

    if (!response.ok || !result.success) {
      throw new Error(
        result.message ||
        "Không thể thực hiện thao tác."
      );
    }

    return result;
  }

  // ==================================================
  // OPEN / CLOSE MODAL
  // ==================================================

  function rememberFocus() {
    previousFocusRef.current =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
  }

  function resetGuestPicker() {
    setGuestSearchInput("");
    setGuestSearch("");
    setGuestPage(1);
    setGuestOptions([]);
    setGuestError("");
  }

  function openCreate() {
    if (saving) return;

    rememberFocus();

    setSelectedGuestId("");
    setGuestSide(adminSide ?? "all");
    resetGuestPicker();

    setModalError("");
    setError("");
    setSuccess("");

    setModal({ type: "create" });
  }

  function openEdit(invitation: Invitation) {
    if (saving) return;

    rememberFocus();

    setSelectedGuestId(invitation.guestId);

    // Không cho chuyển thiệp sang bên khác.
    setGuestSide(invitation.side);
    resetGuestPicker();

    setModalError("");
    setError("");
    setSuccess("");

    setModal({
      type: "edit",
      invitation,
    });
  }

  function openDelete(invitation: Invitation) {
    if (saving) return;

    rememberFocus();

    setModalError("");
    setError("");
    setSuccess("");

    setModal({
      type: "delete",
      invitation,
    });
  }

  function openDelivery(invitation: Invitation) {
    if (saving) return;

    rememberFocus();

    setSelectedDelivery(
      invitation.deliveryStatus
    );

    setModalError("");
    setError("");
    setSuccess("");

    setModal({
      type: "delivery",
      invitation,
    });
  }

  function closeModal() {
    if (saving) return;

    setModal(null);
    setModalError("");
  }

  // ==================================================
  // CREATE / EDIT INVITATION
  // ==================================================

  async function saveInvitation(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    if (
      saving ||
      !modal ||
      (
        modal.type !== "create" &&
        modal.type !== "edit"
      )
    ) {
      return;
    }

    if (!selectedGuestId) {
      setModalError(
        "Vui lòng chọn khách mời."
      );
      return;
    }

    setSaving(true);
    setModalError("");
    setSuccess("");

    try {
      let result: InvitationResponse;

      if (modal.type === "create") {
        result = await mutate("POST", {
          guestId: selectedGuestId,
        });
      } else {
        if (
          modal.invitation.guestId ===
          selectedGuestId
        ) {
          setModalError(
            "Bạn chưa chọn khách khác để chỉnh sửa."
          );
          return;
        }

        result = await mutate("PATCH", {
          id: modal.invitation.id,
          guestId: selectedGuestId,
        });
      }

      const wasCreate =
        modal.type === "create";

      setModal(null);

      setSuccess(
        result.message ??
        "Đã lưu thiệp mời."
      );

      if (wasCreate && page !== 1) {
        setPage(1);
      } else {
        await loadInvitations();
      }
    } catch (caught) {
      setModalError(
        caught instanceof Error
          ? caught.message
          : "Không thể lưu thiệp mời."
      );
    } finally {
      setSaving(false);
    }
  }

  // ==================================================
  // DELETE INVITATION
  // ==================================================

  async function deleteInvitation() {
    if (
      saving ||
      !modal ||
      modal.type !== "delete"
    ) {
      return;
    }

    setSaving(true);
    setModalError("");
    setSuccess("");

    try {
      const result = await mutate(
        "DELETE",
        { id: modal.invitation.id }
      );

      setModal(null);

      setSuccess(
        result.message ??
        "Đã xóa thiệp mời."
      );

      if (
        invitations.length === 1 &&
        page > 1
      ) {
        setPage((current) =>
          Math.max(1, current - 1)
        );
      } else {
        await loadInvitations();
      }
    } catch (caught) {
      setModalError(
        caught instanceof Error
          ? caught.message
          : "Không thể xóa thiệp mời."
      );
    } finally {
      setSaving(false);
    }
  }

  // ==================================================
  // UPDATE DELIVERY STATUS
  // ==================================================

  async function saveDelivery() {
    if (
      saving ||
      !modal ||
      modal.type !== "delivery"
    ) {
      return;
    }

    if (
      modal.invitation.deliveryStatus ===
      selectedDelivery
    ) {
      closeModal();
      return;
    }

    setSaving(true);
    setModalError("");
    setSuccess("");

    try {
      const result = await mutate(
        "PATCH",
        {
          id: modal.invitation.id,
          deliveryStatus: selectedDelivery,
        }
      );

      setModal(null);

      setSuccess(
        result.message ??
        "Đã cập nhật trạng thái gửi."
      );

      await loadInvitations();
    } catch (caught) {
      setModalError(
        caught instanceof Error
          ? caught.message
          : "Không thể cập nhật trạng thái."
      );
    } finally {
      setSaving(false);
    }
  }

  // ==================================================
  // COPY INVITATION LINK
  // ==================================================

  async function copyInvitation(
    invitation: Invitation
  ) {
    try {
      await copyText(
        getPublicUrl(invitation.publicPath)
      );

      setError("");
      setSuccess(
        `Đã sao chép link thiệp của ${invitation.guestName}.`
      );
    } catch (caught) {
      setSuccess("");

      setError(
        caught instanceof Error
          ? caught.message
          : "Không thể sao chép link."
      );
    }
  }

  // ==================================================
  // SEARCH INVITATIONS
  // ==================================================

  function submitSearch(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    setPage(1);
    setSearch(searchInput.trim());
  }

  // ==================================================
  // FIX HYDRATION - SEARCH GUESTS
  //
  // Hàm này không nhận sự kiện submit.
  //
  // Nút Tìm dùng type="button".
  // Ô tìm kiếm xử lý Enter bằng onKeyDown.
  //
  // Không tạo thêm thẻ form bên trong
  // invitation-editor-form.
  // ==================================================

  function submitGuestSearch() {
    if (guestLoading || saving) {
      return;
    }

    setGuestPage(1);
    setGuestSearch(
      guestSearchInput.trim()
    );
  }

  function resetFilters() {
    setPage(1);
    setSearchInput("");
    setSearch("");
    setSideFilter(adminSide ?? "all");
    setDeliveryFilter("all");
    setError("");
    setSuccess("");
  }

  // ==================================================
  // RENDER GUEST PICKER
  // ==================================================

  function renderGuestPicker() {
    const currentInvitation =
      modal?.type === "edit"
        ? modal.invitation
        : null;

    return (
      <div className="space-y-4">
        <div>
          <label className={labelClass}>
            Tìm và chọn khách mời *
          </label>

          {/* ========================================
              FIX NESTED FORM

              Trước đây phần này dùng <form>,
              gây lỗi hydration vì nằm bên
              trong form tạo/chỉnh sửa thiệp.

              Nay dùng div role="search".
          ======================================== */}

          <div
            role="search"
            className="flex gap-2"
          >
            <div className="relative min-w-0 flex-1">
              <Search
                size={16}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-[#94A2A4]"
              />

              <input
                type="search"
                value={guestSearchInput}
                maxLength={100}
                disabled={guestLoading || saving}
                onChange={(event) =>
                  setGuestSearchInput(
                    event.target.value
                  )
                }
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    // Không submit form tạo thiệp.
                    event.preventDefault();
                    event.stopPropagation();

                    submitGuestSearch();
                  }
                }}
                placeholder="Tên hoặc số điện thoại..."
                aria-label="Tìm kiếm khách mời"
                className={`${inputClass} pl-10`}
              />
            </div>

            <button
              type="button"
              disabled={guestLoading || saving}
              onClick={submitGuestSearch}
              className="h-11 rounded-xl border border-[#DDE5E1] px-4 text-[12px] font-medium text-[#31566B] disabled:cursor-not-allowed disabled:opacity-50"
            >
              Tìm
            </button>
          </div>
        </div>

        {/* LỌC BÊN MỜI */}

        {isSuper && modal?.type === "create" && (
          <div>
            <label
              htmlFor="invitation-guest-side"
              className={labelClass}
            >
              Bên mời
            </label>

            <select
              id="invitation-guest-side"
              value={guestSide}
              onChange={(event) => {
                setSelectedGuestId("");
                setGuestPage(1);

                setGuestSide(
                  event.target.value as
                  | "all"
                  | WeddingSide
                );
              }}
              className={inputClass}
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
          </div>
        )}

        {/* KHÁCH ĐANG LIÊN KẾT */}

        {currentInvitation && (
          <div className="rounded-xl border border-[#EAE4D8] bg-[#F9F8F4] p-3 text-[12px] leading-6 text-[#61726D]">
            <p className="font-medium text-[#31566B]">
              Khách hiện tại
            </p>

            <p>
              {currentInvitation.guestName}
              {" · "}
              {sideLabel(currentInvitation.side)}
            </p>

            {currentInvitation.deliveryStatus ===
              "sent" && (
                <p className="mt-2 text-[#B2545A]">
                  Thiệp đã gửi nên không thể đổi
                  người nhận.
                </p>
              )}

            {currentInvitation.rsvpStatus !==
              "no_response" && (
                <p className="mt-2 text-[#B2545A]">
                  Khách đã phản hồi RSVP nên
                  không thể đổi người nhận.
                </p>
              )}
          </div>
        )}

        {/* THÔNG BÁO LỖI */}

        {guestError && (
          <p
            role="alert"
            className="text-[12px] text-[#B2545A]"
          >
            {guestError}
          </p>
        )}

        {/* DANH SÁCH KHÁCH */}

        <div className="overflow-hidden rounded-xl border border-[#E7E1D8]">
          <div className="flex items-center justify-between border-b border-[#EEEAE2] bg-[#F9F8F4] px-3 py-2.5">
            <span className="text-[12px] font-medium text-[#31566B]">
              Danh sách khách mời
            </span>

            <span className="text-[11px] text-[#839397]">
              {guestPagination.total} khách
            </span>
          </div>

          <div className="max-h-[250px] overflow-y-auto">
            {guestLoading ? (
              <div className="flex items-center justify-center gap-2 p-8 text-[12px] text-[#839397]">
                <LoaderCircle
                  size={17}
                  className="animate-spin"
                />
                Đang tải khách...
              </div>
            ) : guestOptions.length === 0 ? (
              <div className="px-4 py-8 text-center text-[12px] leading-6 text-[#839397]">
                Không tìm thấy khách phù hợp.
                Hãy thêm khách ở module
                Quản lý khách mời trước.
              </div>
            ) : (
              guestOptions.map((guest) => {
                const selected =
                  selectedGuestId === guest.id;

                const locked =
                  modal?.type === "edit" &&
                  (
                    currentInvitation?.deliveryStatus ===
                    "sent" ||
                    currentInvitation?.rsvpStatus !==
                    "no_response"
                  );

                return (
                  <button
                    key={guest.id}
                    type="button"
                    disabled={saving || locked}
                    onClick={() =>
                      setSelectedGuestId(guest.id)
                    }
                    className={`flex w-full items-center justify-between gap-3 border-b border-[#F0EDE6] px-4 py-3 text-left transition last:border-b-0 disabled:opacity-50 ${selected
                      ? "bg-[#EEF4F3]"
                      : "bg-white hover:bg-[#FAFAF7]"
                      }`}
                  >
                    <div className="min-w-0">
                      <p className="truncate text-[13px] font-medium text-[#31566B]">
                        {guest.fullName}
                      </p>

                      <p className="mt-1 text-[11px] text-[#89999C]">
                        {sideLabel(guest.side)}
                        {" · "}
                        {guest.phone || "Chưa có SĐT"}
                      </p>
                    </div>

                    {selected ? (
                      <CheckCircle2
                        size={18}
                        className="shrink-0 text-[#427857]"
                      />
                    ) : (
                      <span className="h-4 w-4 shrink-0 rounded-full border border-[#D1DBD5]" />
                    )}
                  </button>
                );
              })
            )}
          </div>

          {/* PHÂN TRANG KHÁCH */}

          <div className="flex items-center justify-between gap-2 border-t border-[#EEEAE2] px-3 py-2.5">
            <span className="text-[11px] text-[#89999C]">
              Trang {guestPage} /{" "}
              {Math.max(
                1,
                guestPagination.totalPages
              )}
            </span>

            <div className="flex gap-2">
              <button
                type="button"
                disabled={
                  guestLoading ||
                  guestPage <= 1
                }
                onClick={() =>
                  setGuestPage((current) =>
                    Math.max(1, current - 1)
                  )
                }
                className="rounded-lg border border-[#DEE5E0] p-2 text-[#31566B] disabled:opacity-30"
                aria-label="Trang khách trước"
              >
                <ChevronLeft size={15} />
              </button>

              <button
                type="button"
                disabled={
                  guestLoading ||
                  guestPage >=
                  guestPagination.totalPages
                }
                onClick={() =>
                  setGuestPage(
                    (current) => current + 1
                  )
                }
                className="rounded-lg border border-[#DEE5E0] p-2 text-[#31566B] disabled:opacity-30"
                aria-label="Trang khách sau"
              >
                <ChevronRight size={15} />
              </button>
            </div>
          </div>
        </div>

        {selectedGuestId && (
          <p className="flex items-center gap-2 text-[12px] text-[#427857]">
            <CheckCircle2 size={16} />
            Đã chọn khách mời
          </p>
        )}
      </div>
    );
  }

  // ==================================================
  // RENDER MAIN UI
  // ==================================================

  return (
    <section className="space-y-6">
      {/* ACTION BAR */}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-[#31566B]">
            Danh sách thiệp mời
          </h2>

          <p className="mt-1 text-xs text-[#839397]">
            {isSuper
              ? "Quản lý thiệp mời của hai gia đình."
              : `Bạn đang quản lý thiệp ${sideLabel(
                defaultSide
              )}.`}
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={loading || saving}
            onClick={() =>
              void loadInvitations()
            }
            className="inline-flex h-11 items-center gap-2 rounded-xl border border-[#DDE5E1] bg-white px-4 text-[13px] font-medium text-[#31566B] disabled:opacity-50"
          >
            <RefreshCw
              size={16}
              className={
                loading ? "animate-spin" : ""
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
            Tạo thiệp mời
          </button>
        </div>
      </div>

      {/* STATISTICS */}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        <StatCard
          label="Tổng thiệp mời"
          value={statistics.total}
          icon={Mail}
        />

        <StatCard
          label="Đã gửi thiệp"
          value={statistics.sent}
          icon={Send}
        />

        <StatCard
          label="Chưa gửi thiệp"
          value={statistics.notSent}
          icon={Clock3}
        />
      </div>

      {/* NOTIFICATIONS */}

      {success && (
        <div
          role="status"
          className="flex items-start gap-2 rounded-xl border border-[#CFE6D7] bg-[#EFF9F2] p-4 text-[13px] leading-6 text-[#407554]"
        >
          <CheckCircle2
            size={17}
            className="mt-0.5 shrink-0"
          />
          {success}
        </div>
      )}

      {error && (
        <div
          role="alert"
          className="rounded-xl border border-[#EEC9C9] bg-[#FFF1F1] p-4 text-[13px] leading-6 text-[#B2545A]"
        >
          {error}
        </div>
      )}

      {/* FILTERS */}

      <div className="rounded-[20px] border border-[#E7E1D8] bg-white/95 p-4 shadow-sm sm:p-5">
        <form
          onSubmit={submitSearch}
          className="flex flex-col gap-3 sm:flex-row"
        >
          <div className="relative flex-1">
            <Search
              size={17}
              className="absolute left-4 top-1/2 -translate-y-1/2 text-[#94A2A4]"
            />

            <input
              type="search"
              value={searchInput}
              onChange={(event) =>
                setSearchInput(event.target.value)
              }
              maxLength={100}
              placeholder="Tìm tên hoặc số điện thoại khách..."
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

        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <div>
            <label
              htmlFor="invitation-side-filter"
              className={labelClass}
            >
              Bên mời
            </label>

            {isSuper ? (
              <select
                id="invitation-side-filter"
                value={sideFilter}
                onChange={(event) => {
                  setPage(1);
                  setSideFilter(
                    event.target.value as
                    | "all"
                    | WeddingSide
                  );
                }}
                className={inputClass}
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
              <input
                id="invitation-side-filter"
                readOnly
                value={sideLabel(defaultSide)}
                className={`${inputClass} bg-[#F8F9F6]`}
              />
            )}
          </div>

          <div>
            <label
              htmlFor="invitation-delivery-filter"
              className={labelClass}
            >
              Trạng thái gửi
            </label>

            <select
              id="invitation-delivery-filter"
              value={deliveryFilter}
              onChange={(event) => {
                setPage(1);
                setDeliveryFilter(
                  event.target.value as
                  | "all"
                  | DeliveryStatus
                );
              }}
              className={inputClass}
            >
              <option value="all">
                Tất cả
              </option>
              <option value="not_sent">
                Chưa gửi
              </option>
              <option value="sent">
                Đã gửi
              </option>
            </select>
          </div>

          <div className="flex items-end">
            <button
              type="button"
              onClick={resetFilters}
              className="h-11 w-full rounded-xl border border-[#DFE6E2] bg-[#FAFAF7] px-4 text-[13px] font-medium text-[#61726D] hover:bg-[#F5F5EF]"
            >
              Xóa bộ lọc
            </button>
          </div>
        </div>
      </div>

      {/* INVITATION LIST */}

      <div className="overflow-hidden rounded-[22px] border border-[#E7E1D8] bg-white/95 shadow-sm">
        <div className="flex items-center justify-between gap-3 border-b border-[#EEE9E1] p-5">
          <div className="flex items-center gap-2">
            <Mail
              size={18}
              className="text-[#B8A27D]"
            />

            <h3 className="text-sm font-semibold text-[#31566B]">
              Thiệp mời
            </h3>
          </div>

          <span className="text-xs text-[#89999C]">
            {pagination.total} kết quả
          </span>
        </div>

        {loading ? (
          <div className="flex flex-col items-center justify-center gap-3 py-16 text-[#829296]">
            <LoaderCircle
              size={28}
              className="animate-spin"
            />

            <p className="text-sm">
              Đang tải danh sách thiệp...
            </p>
          </div>
        ) : invitations.length === 0 ? (
          <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
            <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-[#F5F1E8] text-[#B8A27D]">
              <Mail size={28} />
            </div>

            <h3 className="text-base font-semibold text-[#31566B]">
              Chưa có thiệp mời phù hợp
            </h3>

            <p className="mt-2 max-w-sm text-[13px] leading-6 text-[#879699]">
              Nhấn Tạo thiệp mời và chọn một
              khách từ danh sách đã có.
            </p>
          </div>
        ) : (
          <>
            {/* DESKTOP TABLE */}

            <div className="hidden overflow-x-auto lg:block">
              <table className="w-full min-w-[1140px] text-left">
                <thead className="bg-[#F9F8F4] text-[11px] uppercase tracking-[0.05em] text-[#819195]">
                  <tr>
                    <th className="px-5 py-4 font-medium">
                      Khách nhận thiệp
                    </th>
                    <th className="px-5 py-4 font-medium">
                      Bên mời
                    </th>
                    <th className="px-5 py-4 font-medium">
                      Gửi thiệp
                    </th>
                    <th className="px-5 py-4 font-medium">
                      RSVP
                    </th>
                    <th className="px-5 py-4 font-medium">
                      Phản hồi
                    </th>
                    <th className="px-5 py-4 text-right font-medium">
                      Thao tác
                    </th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-[#F0EDE6]">
                  {invitations.map((invitation) => (
                    <tr
                      key={invitation.id}
                      className="transition hover:bg-[#FAFAF7]"
                    >
                      <td className="px-5 py-4">
                        <p className="text-[13px] font-semibold text-[#31566B]">
                          {invitation.guestName}
                        </p>

                        <p className="mt-1 text-[11px] text-[#91A0A2]">
                          {invitation.guestPhone ||
                            "Chưa có SĐT"}
                        </p>

                        {invitation.guestDeleted && (
                          <p className="mt-1 text-[11px] text-[#B2545A]">
                            Khách không còn hợp lệ
                          </p>
                        )}
                      </td>

                      <td className="px-5 py-4">
                        <span className="rounded-full bg-[#F4F0E7] px-3 py-1.5 text-[11px] text-[#8C754F]">
                          {sideLabel(invitation.side)}
                        </span>
                      </td>

                      <td className="px-5 py-4">
                        <span
                          className={`rounded-full px-3 py-1.5 text-[11px] ${invitation.deliveryStatus ===
                            "sent"
                            ? "bg-[#EAF7EE] text-[#427857]"
                            : "bg-[#F1F2F0] text-[#869292]"
                            }`}
                        >
                          {deliveryLabel(
                            invitation.deliveryStatus
                          )}
                        </span>

                        {invitation.sentAt && (
                          <p className="mt-2 text-[11px] text-[#89999C]">
                            {formatDate(
                              invitation.sentAt
                            )}
                          </p>
                        )}
                      </td>

                      <td className="px-5 py-4">
                        <span
                          className={`rounded-full px-3 py-1.5 text-[11px] ${rsvpClass(
                            invitation.rsvpStatus
                          )}`}
                        >
                          {rsvpLabel(
                            invitation.rsvpStatus
                          )}
                        </span>

                        {invitation.rsvpMessage && (
                          <p
                            title={invitation.rsvpMessage}
                            className="mt-2 max-w-[200px] truncate text-[11px] text-[#89999C]"
                          >
                            {invitation.rsvpMessage}
                          </p>
                        )}
                      </td>

                      <td className="px-5 py-4 text-[11px] text-[#89999C]">
                        {formatDate(
                          invitation.respondedAt
                        )}
                      </td>

                      <td className="px-5 py-4">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            type="button"
                            onClick={() =>
                              void copyInvitation(
                                invitation
                              )
                            }
                            title="Sao chép link"
                            aria-label={`Sao chép link của ${invitation.guestName}`}
                            className={`${iconButtonClass} text-[#61726D]`}
                          >
                            <ClipboardCopy size={16} />
                          </button>

                          <a
                            href={invitation.publicPath}
                            target="_blank"
                            rel="noopener noreferrer"
                            title="Xem thiệp"
                            aria-label={`Xem thiệp của ${invitation.guestName}`}
                            className={`${iconButtonClass} text-[#9A7542]`}
                          >
                            <ExternalLink size={16} />
                          </a>

                          <button
                            type="button"
                            disabled={saving}
                            onClick={() =>
                              openDelivery(invitation)
                            }
                            title="Trạng thái gửi"
                            aria-label={`Trạng thái gửi thiệp của ${invitation.guestName}`}
                            className={`${iconButtonClass} text-[#427857]`}
                          >
                            <Send size={16} />
                          </button>

                          <button
                            type="button"
                            disabled={saving}
                            onClick={() =>
                              openEdit(invitation)
                            }
                            title="Chỉnh sửa"
                            aria-label={`Chỉnh sửa thiệp ${invitation.guestName}`}
                            className={`${iconButtonClass} text-[#31566B]`}
                          >
                            <Edit3 size={16} />
                          </button>

                          <button
                            type="button"
                            disabled={saving}
                            onClick={() =>
                              openDelete(invitation)
                            }
                            title="Xóa thiệp"
                            aria-label={`Xóa thiệp ${invitation.guestName}`}
                            className={`${iconButtonClass} text-[#B2545A]`}
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* MOBILE CARDS */}

            <div className="divide-y divide-[#EEEAE2] lg:hidden">
              {invitations.map((invitation) => (
                <article
                  key={invitation.id}
                  className="p-4 sm:p-5"
                >
                  <div className="flex items-start gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#F4F0E7] text-[#B8A27D]">
                      <UserRound size={19} />
                    </div>

                    <div className="min-w-0 flex-1">
                      <h3 className="break-words text-sm font-semibold text-[#31566B]">
                        {invitation.guestName}
                      </h3>

                      <p className="mt-1 text-xs text-[#91A0A2]">
                        {invitation.guestPhone ||
                          "Chưa có SĐT"}
                      </p>

                      <p className="mt-1 text-[11px] text-[#9A835B]">
                        {sideLabel(invitation.side)}
                      </p>
                    </div>
                  </div>

                  <div className="mt-4 flex flex-wrap gap-2">
                    <span
                      className={`rounded-full px-3 py-1.5 text-[11px] ${invitation.deliveryStatus ===
                        "sent"
                        ? "bg-[#EAF7EE] text-[#427857]"
                        : "bg-[#F1F2F0] text-[#869292]"
                        }`}
                    >
                      {deliveryLabel(
                        invitation.deliveryStatus
                      )}
                    </span>

                    <span
                      className={`rounded-full px-3 py-1.5 text-[11px] ${rsvpClass(
                        invitation.rsvpStatus
                      )}`}
                    >
                      {rsvpLabel(
                        invitation.rsvpStatus
                      )}
                    </span>
                  </div>

                  {invitation.rsvpMessage && (
                    <p className="mt-3 break-words text-[12px] leading-6 text-[#859597]">
                      Lời nhắn:{" "}
                      {invitation.rsvpMessage}
                    </p>
                  )}

                  <p className="mt-3 text-[11px] text-[#A0A9A8]">
                    Phản hồi:{" "}
                    {formatDate(
                      invitation.respondedAt
                    )}
                  </p>

                  {invitation.guestDeleted && (
                    <p className="mt-2 text-[12px] text-[#B2545A]">
                      Khách liên kết đã bị xóa
                      hoặc không còn hợp lệ.
                    </p>
                  )}

                  <div className="mt-4 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() =>
                        void copyInvitation(
                          invitation
                        )
                      }
                      className="inline-flex h-10 items-center gap-2 rounded-lg border border-[#E4E9E5] px-3 text-[11px] text-[#31566B]"
                    >
                      <ClipboardCopy size={15} />
                      Sao chép
                    </button>

                    <a
                      href={invitation.publicPath}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex h-10 items-center gap-2 rounded-lg border border-[#E4E9E5] px-3 text-[11px] text-[#31566B]"
                    >
                      <ExternalLink size={15} />
                      Xem thiệp
                    </a>

                    <button
                      type="button"
                      disabled={saving}
                      onClick={() =>
                        openDelivery(invitation)
                      }
                      className="inline-flex h-10 items-center gap-2 rounded-lg border border-[#E4E9E5] px-3 text-[11px] text-[#427857] disabled:opacity-50"
                    >
                      <Send size={15} />
                      Trạng thái
                    </button>

                    <button
                      type="button"
                      disabled={saving}
                      onClick={() =>
                        openEdit(invitation)
                      }
                      aria-label="Chỉnh sửa thiệp"
                      className="flex h-10 w-10 items-center justify-center rounded-lg border border-[#E4E9E5] text-[#31566B] disabled:opacity-50"
                    >
                      <Edit3 size={16} />
                    </button>

                    <button
                      type="button"
                      disabled={saving}
                      onClick={() =>
                        openDelete(invitation)
                      }
                      aria-label="Xóa thiệp"
                      className="flex h-10 w-10 items-center justify-center rounded-lg border border-[#EEDCDD] text-[#B2545A] disabled:opacity-50"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </article>
              ))}
            </div>
          </>
        )}

        {/* PAGINATION */}

        {!loading && pagination.total > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-4 border-t border-[#EEEAE2] px-5 py-4">
            <p className="text-xs text-[#89999C]">
              Trang {pagination.page} /{" "}
              {Math.max(
                1,
                pagination.totalPages
              )}
            </p>

            <div className="flex gap-2">
              <button
                type="button"
                disabled={page <= 1 || saving}
                onClick={() =>
                  setPage((current) =>
                    Math.max(1, current - 1)
                  )
                }
                className="inline-flex h-9 items-center gap-1 rounded-lg border border-[#DEE5E0] px-3 text-xs text-[#31566B] disabled:opacity-40"
              >
                <ChevronLeft size={15} />
                Trước
              </button>

              <button
                type="button"
                disabled={
                  page >= pagination.totalPages ||
                  saving
                }
                onClick={() =>
                  setPage(
                    (current) => current + 1
                  )
                }
                className="inline-flex h-9 items-center gap-1 rounded-lg border border-[#DEE5E0] px-3 text-xs text-[#31566B] disabled:opacity-40"
              >
                Sau
                <ChevronRight size={15} />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* MODAL */}

      {modal && (
        <div
          className="fixed inset-0 z-[9999] flex items-center justify-center bg-[#142D3A]/60 p-3 backdrop-blur-[3px] sm:p-5"
          onMouseDown={(event) => {
            if (
              event.target === event.currentTarget &&
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
            aria-labelledby="invitation-modal-title"
            className="flex max-h-[92dvh] w-full max-w-[620px] flex-col overflow-hidden rounded-[22px] bg-white shadow-2xl"
          >
            {/* MODAL HEADER */}

            <div className="flex shrink-0 items-start justify-between gap-4 border-b border-[#EEEAE2] p-5 sm:p-7">
              <div>
                <h2
                  id="invitation-modal-title"
                  className="font-wedding-serif text-[26px] leading-tight text-[#31566B] sm:text-[32px]"
                >
                  {modal.type === "create"
                    ? "Tạo thiệp mời"
                    : modal.type === "edit"
                      ? "Chỉnh sửa thiệp"
                      : modal.type === "delete"
                        ? "Xác nhận xóa thiệp"
                        : "Trạng thái gửi thiệp"}
                </h2>

                <p className="mt-2 text-[12px] leading-5 text-[#849497]">
                  {modal.type === "create"
                    ? "Chọn một khách mời để tạo đường dẫn riêng."
                    : modal.type === "edit"
                      ? "Đổi người nhận khi thiệp chưa gửi."
                      : modal.type === "delete"
                        ? "Thao tác này không xóa thông tin khách."
                        : "Cập nhật trạng thái gửi thực tế."}
                </p>
              </div>

              <button
                ref={closeRef}
                type="button"
                disabled={saving}
                onClick={closeModal}
                aria-label="Đóng popup"
                className="shrink-0 rounded-lg p-2 text-[#809195] hover:bg-[#F4F5F2] disabled:opacity-50"
              >
                <X size={20} />
              </button>
            </div>

            {/* CREATE / EDIT */}

            {modal.type === "create" ||
              modal.type === "edit" ? (
              <>
                {/* Chỉ còn một form chính.
                    Guest Picker không chứa form con. */}

                <form
                  id="invitation-editor-form"
                  onSubmit={(event) =>
                    void saveInvitation(event)
                  }
                  className="min-h-0 flex-1 space-y-5 overflow-y-auto overscroll-contain p-5 sm:p-7"
                >
                  {modalError && (
                    <div
                      role="alert"
                      className="rounded-xl border border-[#EEC9C9] bg-[#FFF1F1] p-3 text-[12px] leading-6 text-[#B2545A]"
                    >
                      {modalError}
                    </div>
                  )}

                  {renderGuestPicker()}

                  <div className="rounded-xl border border-[#EAE4D8] bg-[#F9F8F4] p-4">
                    <p className="flex items-center gap-2 text-[12px] font-semibold text-[#31566B]">
                      <HeartHandshake
                        size={16}
                        className="text-[#B8A27D]"
                      />
                      Thiệp mời cá nhân hóa
                    </p>

                    <p className="mt-2 text-[12px] leading-6 text-[#809094]">
                      Hệ thống sẽ tự sinh link
                      riêng theo tên khách cùng
                      mã ngẫu nhiên để tránh trùng.
                      Một khách chỉ có một thiệp
                      đang hoạt động.
                    </p>
                  </div>
                </form>

                <div className="flex shrink-0 flex-wrap justify-end gap-3 border-t border-[#EEEAE2] p-5 sm:px-7">
                  <button
                    type="button"
                    disabled={saving}
                    onClick={closeModal}
                    className="h-11 rounded-xl border border-[#DEE5E0] px-6 text-[13px] text-[#61726D] disabled:opacity-50"
                  >
                    Hủy
                  </button>

                  <button
                    type="submit"
                    form="invitation-editor-form"
                    disabled={
                      saving ||
                      guestLoading ||
                      (
                        modal.type === "edit" &&
                        (
                          modal.invitation.deliveryStatus ===
                          "sent" ||
                          modal.invitation.rsvpStatus !==
                          "no_response"
                        )
                      )
                    }
                    className="inline-flex h-11 items-center gap-2 rounded-xl bg-[#31566B] px-6 text-[13px] font-medium text-white disabled:opacity-50"
                  >
                    {saving ? (
                      <LoaderCircle
                        size={16}
                        className="animate-spin"
                      />
                    ) : modal.type === "edit" ? (
                      <Check size={16} />
                    ) : (
                      <Plus size={16} />
                    )}

                    {saving
                      ? "Đang lưu..."
                      : modal.type === "edit"
                        ? "Lưu thay đổi"
                        : "Tạo thiệp"}
                  </button>
                </div>
              </>
            ) : modal.type === "delete" ? (
              <>
                {/* DELETE MODAL */}

                <div className="min-h-0 flex-1 overflow-y-auto p-5 sm:p-7">
                  <div className="flex gap-3">
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[#FFF0F0] text-[#B2545A]">
                      <AlertTriangle size={22} />
                    </div>

                    <div>
                      <p className="text-[14px] font-semibold text-[#31566B]">
                        Xóa thiệp của{" "}
                        {modal.invitation.guestName}?
                      </p>

                      <p className="mt-3 text-[13px] leading-6 text-[#809094]">
                        Thiệp sẽ biến mất khỏi
                        danh sách và đường dẫn
                        thiệp mới sẽ không còn
                        hợp lệ sau khi tích hợp
                        trang công khai.
                      </p>

                      <p className="mt-3 text-[12px] leading-6 text-[#427857]">
                        Thông tin khách mời,
                        trạng thái RSVP và lời
                        nhắn được giữ nguyên
                        trong cơ sở dữ liệu.
                      </p>
                    </div>
                  </div>

                  {modalError && (
                    <div
                      role="alert"
                      className="mt-5 rounded-xl border border-[#EEC9C9] bg-[#FFF1F1] p-3 text-[12px] text-[#B2545A]"
                    >
                      {modalError}
                    </div>
                  )}
                </div>

                <div className="flex shrink-0 justify-end gap-3 border-t border-[#EEEAE2] p-5 sm:px-7">
                  <button
                    type="button"
                    disabled={saving}
                    onClick={closeModal}
                    className="h-11 rounded-xl border border-[#DEE5E0] px-6 text-[13px] text-[#61726D] disabled:opacity-50"
                  >
                    Hủy
                  </button>

                  <button
                    type="button"
                    disabled={saving}
                    onClick={() =>
                      void deleteInvitation()
                    }
                    className="inline-flex h-11 items-center gap-2 rounded-xl bg-[#B2545A] px-6 text-[13px] font-medium text-white disabled:opacity-50"
                  >
                    {saving ? (
                      <LoaderCircle
                        size={16}
                        className="animate-spin"
                      />
                    ) : (
                      <Trash2 size={16} />
                    )}

                    {saving
                      ? "Đang xóa..."
                      : "Xác nhận xóa"}
                  </button>
                </div>
              </>
            ) : (
              <>
                {/* DELIVERY MODAL */}

                <div className="min-h-0 flex-1 space-y-5 overflow-y-auto p-5 sm:p-7">
                  <div className="rounded-xl border border-[#EAE4D8] bg-[#F9F8F4] p-4">
                    <p className="text-[12px] text-[#809094]">
                      Khách nhận thiệp
                    </p>

                    <p className="mt-1 text-[14px] font-semibold text-[#31566B]">
                      {modal.invitation.guestName}
                    </p>

                    <p className="mt-2 text-[12px] text-[#809094]">
                      Trạng thái hiện tại:{" "}
                      {deliveryLabel(
                        modal.invitation.deliveryStatus
                      )}
                    </p>
                  </div>

                  <div>
                    <label
                      htmlFor="invitation-delivery"
                      className={labelClass}
                    >
                      Trạng thái gửi
                    </label>

                    <select
                      id="invitation-delivery"
                      value={selectedDelivery}
                      disabled={saving}
                      onChange={(event) =>
                        setSelectedDelivery(
                          event.target.value as
                          DeliveryStatus
                        )
                      }
                      className={inputClass}
                    >
                      <option value="not_sent">
                        Chưa gửi thiệp
                      </option>

                      <option value="sent">
                        Đã gửi thiệp
                      </option>
                    </select>
                  </div>

                  <p className="text-[12px] leading-6 text-[#809094]">
                    Chỉ đánh dấu Đã gửi khi
                    bạn thực sự gửi link thiệp
                    cho khách. Sao chép link
                    không tự thay đổi trạng thái.
                  </p>

                  {modalError && (
                    <div
                      role="alert"
                      className="rounded-xl border border-[#EEC9C9] bg-[#FFF1F1] p-3 text-[12px] text-[#B2545A]"
                    >
                      {modalError}
                    </div>
                  )}
                </div>

                <div className="flex shrink-0 justify-end gap-3 border-t border-[#EEEAE2] p-5 sm:px-7">
                  <button
                    type="button"
                    disabled={saving}
                    onClick={closeModal}
                    className="h-11 rounded-xl border border-[#DEE5E0] px-6 text-[13px] text-[#61726D] disabled:opacity-50"
                  >
                    Hủy
                  </button>

                  <button
                    type="button"
                    disabled={saving}
                    onClick={() =>
                      void saveDelivery()
                    }
                    className="inline-flex h-11 items-center gap-2 rounded-xl bg-[#31566B] px-6 text-[13px] font-medium text-white disabled:opacity-50"
                  >
                    {saving ? (
                      <LoaderCircle
                        size={16}
                        className="animate-spin"
                      />
                    ) : (
                      <Check size={16} />
                    )}

                    {saving
                      ? "Đang lưu..."
                      : "Lưu trạng thái"}
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