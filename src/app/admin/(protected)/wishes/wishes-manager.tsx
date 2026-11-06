
"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";

import {
  AlertTriangle,
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Eye,
  EyeOff,
  Heart,
  LoaderCircle,
  MessageCircleHeart,
  RefreshCw,
  RotateCcw,
  Search,
  ShieldCheck,
  Trash2,
  X,
  type LucideIcon,
} from "lucide-react";

// ======================================================
// NAM & THU - ADMIN WISHES MANAGER
//
// CẬP NHẬT:
// - Popup xác nhận trước khi xóa lời chúc.
// - Không sử dụng window.confirm().
// - Hiển thị tên khách và nội dung lời chúc.
// - Hủy xóa không gọi API.
// - Xác nhận xóa mới gọi DELETE.
// - Hiển thị lỗi ngay trong popup.
// - Chặn thao tác xóa trùng khi đang xử lý.
//
// GIỮ NGUYÊN:
// - Phân quyền Super Admin / Nhà trai / Nhà gái.
// - Tìm kiếm và lọc trạng thái.
// - Phân trang 10 lời chúc mỗi trang.
// - Thống kê theo trạng thái.
// - Duyệt / Ẩn / Chuyển về chờ duyệt.
// - Xóa mềm qua API.
// - Xem chi tiết lời chúc.
// - Giao diện desktop / tablet / mobile.
// - Không thay đổi khách mời và RSVP.
// ======================================================

// ======================================================
// TYPES
// ======================================================

type AdminRole =
  | "super_admin"
  | "groom_admin"
  | "bride_admin";

type GuestSide = "groom" | "bride";

type WishStatus =
  | "pending"
  | "approved"
  | "hidden";

type RsvpStatus =
  | "attending"
  | "declined"
  | "unsure";

type StatusFilter = WishStatus | "all";
type SideFilter = GuestSide | "all";

interface WishesManagerProps {
  adminRole: AdminRole;
  adminSide: GuestSide | null;
}

interface Wish {
  id: string;
  guestId: string;
  guestName: string;
  guestSide: GuestSide;
  relation: string;
  message: string;
  rsvpStatus: RsvpStatus;
  status: WishStatus;
  reviewedAt: string | null;
  reviewedBy: string | null;
  createdAt: string;
  updatedAt: string;
  isDeleted: boolean;
  deletedAt: string | null;
}

interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

interface Statistics {
  total: number;
  pending: number;
  approved: number;
  hidden: number;
}

interface ApiResponse {
  success?: boolean;
  message?: string;
  wishes?: Wish[];
  wish?: Wish;
  pagination?: Pagination;
  statistics?: Statistics;
}

// ======================================================
// CONSTANTS
// ======================================================

const PAGE_SIZE = 10;

const WISHES_API = "/api/admin/wishes";

const EMPTY_STATS: Statistics = {
  total: 0,
  pending: 0,
  approved: 0,
  hidden: 0,
};

const EMPTY_PAGINATION: Pagination = {
  page: 1,
  limit: PAGE_SIZE,
  total: 0,
  totalPages: 0,
};

const fieldClass =
  "h-11 w-full min-w-0 rounded-xl border border-[#E2E7E4] bg-white px-3.5 text-[13px] text-[#31566B] outline-none transition-colors focus:border-[#B8A27D] focus:ring-2 focus:ring-[#B8A27D]/15 disabled:cursor-not-allowed disabled:bg-[#F6F7F5]";

const labelClass =
  "mb-2 block text-[11px] font-semibold text-[#607680]";

// ======================================================
// DISPLAY HELPERS
// ======================================================

function sideLabel(value: GuestSide): string {
  return value === "groom"
    ? "Nhà trai"
    : "Nhà gái";
}

function statusLabel(value: WishStatus): string {
  switch (value) {
    case "approved":
      return "Đã duyệt";

    case "hidden":
      return "Đã ẩn";

    default:
      return "Chờ duyệt";
  }
}

function rsvpLabel(value: RsvpStatus): string {
  switch (value) {
    case "attending":
      return "Sẽ tham dự";

    case "declined":
      return "Không tham dự";

    case "unsure":
      return "Chưa chắc chắn";
  }
}

function dateLabel(
  value: string | null
): string {
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
// SECTION CARD
// ======================================================

function SectionCard({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`min-w-0 overflow-hidden rounded-2xl border border-[#E8E3DA] bg-white shadow-[0_3px_14px_rgba(49,86,107,0.035)] ${className}`}
    >
      {children}
    </div>
  );
}

// ======================================================
// STATISTICS CARD
// ======================================================

function StatCard({
  title,
  value,
  icon: Icon,
  accent,
}: {
  title: string;
  value: number;
  icon: LucideIcon;
  accent: string;
}) {
  return (
    <div className="min-w-0 rounded-2xl border border-[#E8E3DA] bg-white p-4 shadow-[0_3px_14px_rgba(49,86,107,0.035)] sm:p-5">
      <div
        className={`flex h-9 w-9 items-center justify-center rounded-xl ${accent}`}
      >
        <Icon size={17} strokeWidth={1.8} />
      </div>

      <p className="mt-3 text-[26px] font-semibold leading-none tabular-nums text-[#31566B] sm:text-[30px]">
        {value}
      </p>

      <p className="mt-2 text-[11px] leading-5 text-[#819196] sm:text-xs">
        {title}
      </p>
    </div>
  );
}

// ======================================================
// STATUS BADGE
// ======================================================

function StatusBadge({
  status,
}: {
  status: WishStatus;
}) {
  const styles: Record<WishStatus, string> = {
    pending:
      "bg-[#FFF4E6] text-[#A27A43] border-[#F3E1C7]",
    approved:
      "bg-[#EAF6ED] text-[#417D58] border-[#D0E8D7]",
    hidden:
      "bg-[#F0F2F3] text-[#718086] border-[#E1E5E7]",
  };

  return (
    <span
      className={`inline-flex max-w-full items-center whitespace-nowrap rounded-full border px-2.5 py-1 text-[10px] font-medium ${styles[status]}`}
    >
      {statusLabel(status)}
    </span>
  );
}

// ======================================================
// ACTION BUTTON
// ======================================================

type ActionTone =
  | "neutral"
  | "success"
  | "warning"
  | "danger";

function ActionButton({
  icon: Icon,
  children,
  title,
  onClick,
  disabled,
  tone = "neutral",
  compact = false,
}: {
  icon: LucideIcon;
  children: ReactNode;
  title: string;
  onClick: () => void;
  disabled?: boolean;
  tone?: ActionTone;
  compact?: boolean;
}) {
  const tones: Record<ActionTone, string> = {
    neutral:
      "border-[#E1E7E5] text-[#31566B] hover:bg-[#F0F5F4]",
    success:
      "border-[#D0E8D7] text-[#417D58] hover:bg-[#EAF6ED]",
    warning:
      "border-[#ECDCC5] text-[#A27A43] hover:bg-[#FFF6E9]",
    danger:
      "border-[#EFDBDB] text-[#B75E61] hover:bg-[#FFF0F0]",
  };

  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex h-9 shrink-0 items-center justify-center gap-1.5 rounded-lg border bg-white px-3 text-[11px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#B8A27D] disabled:cursor-not-allowed disabled:opacity-40 ${tones[tone]} ${compact ? "w-9 px-0" : ""}`}
    >
      <Icon size={14} strokeWidth={1.8} />

      {!compact && <span>{children}</span>}
    </button>
  );
}

// ======================================================
// MAIN COMPONENT
// ======================================================

export default function WishesManager({
  adminRole,
  adminSide,
}: WishesManagerProps) {
  const isSuper = adminRole === "super_admin";

  // ==================================================
  // DATABASE STATE
  // ==================================================

  const [wishes, setWishes] =
    useState<Wish[]>([]);

  const [statistics, setStatistics] =
    useState<Statistics>(EMPTY_STATS);

  const [pagination, setPagination] =
    useState<Pagination>(EMPTY_PAGINATION);

  const [loading, setLoading] =
    useState(true);

  const [mutatingId, setMutatingId] =
    useState<string | null>(null);

  // ==================================================
  // PAGINATION & FILTERS
  // ==================================================

  const [page, setPage] = useState(1);

  const [searchInput, setSearchInput] =
    useState("");

  const [search, setSearch] =
    useState("");

  const [sideFilter, setSideFilter] =
    useState<SideFilter>(
      adminSide ?? "all"
    );

  const [statusFilter, setStatusFilter] =
    useState<StatusFilter>("all");

  const [refreshKey, setRefreshKey] =
    useState(0);

  // ==================================================
  // NOTIFICATIONS
  // ==================================================

  const [error, setError] =
    useState("");

  const [success, setSuccess] =
    useState("");

  // ==================================================
  // DETAIL MODAL
  // ==================================================

  const [selectedWish, setSelectedWish] =
    useState<Wish | null>(null);

  // ==================================================
  // DELETE CONFIRMATION MODAL
  //
  // NEW:
  // Chỉ lưu lời chúc cần xóa.
  // Không gửi DELETE cho đến khi xác nhận.
  // ==================================================

  const [wishToDelete, setWishToDelete] =
    useState<Wish | null>(null);

  const [deleteError, setDeleteError] =
    useState("");

  // ==================================================
  // REFS
  // ==================================================

  const mutationLock = useRef(false);
  const latestRequest = useRef(0);

  const deleteCancelButtonRef =
    useRef<HTMLButtonElement>(null);

  const previousFocusRef =
    useRef<HTMLElement | null>(null);

  // ==================================================
  // PAGINATION CALCULATIONS
  // ==================================================

  const totalPages = Math.max(
    1,
    pagination.totalPages
  );

  const currentPage = Math.max(
    1,
    pagination.page
  );

  const firstItem =
    pagination.total === 0
      ? 0
      : (currentPage - 1) * PAGE_SIZE + 1;

  const lastItem = Math.min(
    currentPage * PAGE_SIZE,
    pagination.total
  );

  const pageStart = Math.max(
    1,
    Math.min(
      currentPage - 2,
      totalPages - 4
    )
  );

  const pageNumbers = Array.from(
    {
      length: Math.min(5, totalPages),
    },
    (_, index) => pageStart + index
  );

  // ==================================================
  // LOAD WISHES
  //
  // API đảm nhiệm:
  // - Phân trang tại MongoDB.
  // - Phân quyền.
  // - Tìm kiếm.
  // - Lọc trạng thái.
  // - Thống kê.
  // ==================================================

  const loadWishes = useCallback(
    async (signal: AbortSignal) => {
      const requestId =
        ++latestRequest.current;

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

        if (statusFilter !== "all") {
          params.set("status", statusFilter);
        }

        const response = await fetch(
          `${WISHES_API}?${params.toString()}`,
          {
            method: "GET",
            cache: "no-store",
            credentials: "same-origin",
            signal,
          }
        );

        const data =
          await readApiResponse(response);

        if (
          !response.ok ||
          !data.success ||
          !Array.isArray(data.wishes)
        ) {
          throw new Error(
            data.message ||
              "Không thể tải danh sách lời chúc."
          );
        }

        if (
          signal.aborted ||
          requestId !== latestRequest.current
        ) {
          return;
        }

        const nextPagination =
          data.pagination ??
          EMPTY_PAGINATION;

        // Không để trang hiện tại vượt quá
        // tổng số trang sau khi xóa.
        if (
          page > 1 &&
          (
            nextPagination.totalPages === 0 ||
            page > nextPagination.totalPages
          )
        ) {
          setPage(
            Math.max(
              1,
              nextPagination.totalPages
            )
          );

          return;
        }

        setWishes(data.wishes);

        setStatistics(
          data.statistics ??
          EMPTY_STATS
        );

        setPagination(
          nextPagination
        );

        setError("");
      } catch (caught) {
        if (
          signal.aborted ||
          requestId !== latestRequest.current
        ) {
          return;
        }

        setError(
          caught instanceof Error
            ? caught.message
            : "Không thể tải lời chúc."
        );
      } finally {
        if (
          !signal.aborted &&
          requestId === latestRequest.current
        ) {
          setLoading(false);
        }
      }
    },
    [page, search, sideFilter, statusFilter]
  );

  useEffect(() => {
    const controller = new AbortController();

    void Promise.resolve().then(() => {
      if (controller.signal.aborted) {
        return;
      }

      return loadWishes(
        controller.signal
      );
    });

    return () => {
      controller.abort();
    };
  }, [loadWishes, refreshKey]);

  // ==================================================
  // MUTATION API
  // ==================================================

  async function sendMutation(
    method: "PATCH" | "DELETE",
    body: Record<string, unknown>
  ) {
    const response = await fetch(
      WISHES_API,
      {
        method,
        credentials: "same-origin",
        cache: "no-store",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      }
    );

    const data =
      await readApiResponse(response);

    if (
      !response.ok ||
      !data.success
    ) {
      throw new Error(
        data.message ||
          "Thao tác thất bại."
      );
    }

    return data;
  }

  // ==================================================
  // UPDATE STATUS
  // ==================================================

  async function updateStatus(
    wish: Wish,
    nextStatus: WishStatus
  ) {
    if (
      mutationLock.current ||
      wish.status === nextStatus
    ) {
      return;
    }

    mutationLock.current = true;

    setMutatingId(wish.id);
    setError("");
    setSuccess("");

    try {
      const result = await sendMutation(
        "PATCH",
        {
          id: wish.id,
          status: nextStatus,
        }
      );

      if (result.wish) {
        const updatedWish = result.wish;

        setSelectedWish((current) =>
          current?.id === wish.id
            ? updatedWish
            : current
        );
      }

      setSuccess(
        result.message ||
          "Cập nhật lời chúc thành công."
      );

      setRefreshKey(
        (current) => current + 1
      );
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Không thể cập nhật lời chúc."
      );
    } finally {
      mutationLock.current = false;
      setMutatingId(null);
    }
  }

  // ==================================================
  // OPEN DELETE CONFIRMATION
  //
  // Chỉ mở popup.
  // KHÔNG gọi API ở bước này.
  // ==================================================

  function openDeleteConfirmation(
    wish: Wish
  ) {
    if (mutationLock.current) {
      return;
    }

    previousFocusRef.current =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;

    setDeleteError("");
    setWishToDelete(wish);
  }

  // ==================================================
  // CLOSE DELETE CONFIRMATION
  // ==================================================

  function closeDeleteConfirmation() {
    if (mutationLock.current) {
      return;
    }

    setWishToDelete(null);
    setDeleteError("");
  }

  // ==================================================
  // DELETE MODAL KEYBOARD & FOCUS
  //
  // - Tự focus vào nút Hủy khi mở.
  // - Escape đóng popup khi chưa xử lý.
  // - Tab không thoát ra ngoài popup.
  // - Khóa scroll trang bên dưới.
  // ==================================================

  const isDeleteModalOpen =
    wishToDelete !== null;

  useEffect(() => {
    if (!isDeleteModalOpen) {
      return;
    }

    const oldOverflow =
      document.body.style.overflow;

    document.body.style.overflow =
      "hidden";

    deleteCancelButtonRef.current?.focus();

    function handleKeyDown(
      event: KeyboardEvent
    ) {
      if (event.key === "Escape") {
        if (!mutationLock.current) {
          event.preventDefault();

          setWishToDelete(null);
          setDeleteError("");
        }

        return;
      }

      if (event.key !== "Tab") {
        return;
      }

      const dialog =
        document.getElementById(
          "wish-delete-dialog"
        );

      if (!dialog) {
        return;
      }

      const focusable = Array.from(
        dialog.querySelectorAll<HTMLElement>(
          'button:not([disabled]), a[href], input:not([disabled])'
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
      handleKeyDown
    );

    return () => {
      document.body.style.overflow =
        oldOverflow;

      document.removeEventListener(
        "keydown",
        handleKeyDown
      );

      previousFocusRef.current?.focus();
    };
  }, [isDeleteModalOpen]);

  // ==================================================
  // CONFIRM SOFT DELETE
  //
  // Chỉ thực hiện khi đã mở popup và
  // nhấn nút "Xác nhận xóa".
  //
  // API vẫn dùng DELETE như code gốc.
  // Không thay đổi RSVP / khách mời.
  // ==================================================

  async function deleteWish(
    wish: Wish
  ) {
    if (
      mutationLock.current ||
      !wishToDelete ||
      wishToDelete.id !== wish.id
    ) {
      return;
    }

    mutationLock.current = true;

    setMutatingId(wish.id);
    setDeleteError("");
    setError("");
    setSuccess("");

    try {
      const result = await sendMutation(
        "DELETE",
        {
          id: wish.id,
        }
      );

      // API đã xác nhận xóa thành công.
      setWishToDelete(null);

      // Đóng popup chi tiết nếu đang mở.
      setSelectedWish(null);

      setSuccess(
        result.message ||
          "Đã xóa lời chúc."
      );

      // Điều chỉnh trang nếu xóa bản ghi cuối.
      if (
        wishes.length === 1 &&
        page > 1
      ) {
        setPage(
          (current) =>
            Math.max(1, current - 1)
        );
      } else {
        setRefreshKey(
          (current) => current + 1
        );
      }
    } catch (caught) {
      // Giữ popup mở khi lỗi xảy ra.
      setDeleteError(
        caught instanceof Error
          ? caught.message
          : "Không thể xóa lời chúc."
      );
    } finally {
      mutationLock.current = false;
      setMutatingId(null);
    }
  }

  // ==================================================
  // SEARCH
  // ==================================================

  function handleSearch(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    setPage(1);
    setSearch(searchInput.trim());
  }

  function resetFilters() {
    setPage(1);

    setSearchInput("");
    setSearch("");

    setSideFilter(
      adminSide ?? "all"
    );

    setStatusFilter("all");

    setError("");
    setSuccess("");
  }

  // ==================================================
  // PAGE NAVIGATION
  // ==================================================

  function goToPage(
    nextPage: number
  ) {
    if (
      loading ||
      mutatingId !== null
    ) {
      return;
    }

    const validPage = Math.max(
      1,
      Math.min(
        nextPage,
        totalPages
      )
    );

    setPage(validPage);
  }

  // ==================================================
  // ACTIONS - DESKTOP / MOBILE
  // ==================================================

  function renderActions(
    wish: Wish,
    compact: boolean
  ) {
    const disabled =
      mutatingId !== null;

    return (
      <div
        className={
          compact
            ? "flex flex-nowrap items-center justify-end gap-1"
            : "flex flex-wrap items-center gap-2"
        }
      >
        {/* VIEW */}

        <ActionButton
          icon={Eye}
          title="Xem chi tiết lời chúc"
          compact={compact}
          onClick={() =>
            setSelectedWish(wish)
          }
        >
          Xem
        </ActionButton>

        {/* APPROVE */}

        {wish.status !== "approved" && (
          <ActionButton
            icon={Check}
            title="Duyệt lời chúc"
            tone="success"
            compact={compact}
            disabled={disabled}
            onClick={() => {
              void updateStatus(
                wish,
                "approved"
              );
            }}
          >
            Duyệt
          </ActionButton>
        )}

        {/* HIDE */}

        {wish.status !== "hidden" && (
          <ActionButton
            icon={EyeOff}
            title="Ẩn lời chúc"
            tone="warning"
            compact={compact}
            disabled={disabled}
            onClick={() => {
              void updateStatus(
                wish,
                "hidden"
              );
            }}
          >
            Ẩn
          </ActionButton>
        )}

        {/* PENDING */}

        {wish.status !== "pending" && (
          <ActionButton
            icon={RotateCcw}
            title="Chuyển về chờ duyệt"
            tone="neutral"
            compact={compact}
            disabled={disabled}
            onClick={() => {
              void updateStatus(
                wish,
                "pending"
              );
            }}
          >
            Chờ duyệt
          </ActionButton>
        )}

        {/* DELETE */}

        <ActionButton
          icon={Trash2}
          title="Xóa lời chúc"
          tone="danger"
          compact={compact}
          disabled={disabled}
          onClick={() => {
            // Chỉ mở popup, chưa xóa.
            openDeleteConfirmation(wish);
          }}
        >
          Xóa
        </ActionButton>
      </div>
    );
  }

  // ==================================================
  // STATISTICS
  // ==================================================

  const statCards: {
    title: string;
    value: number;
    icon: LucideIcon;
    accent: string;
  }[] = [
    {
      title: "Tổng lời chúc",
      value: statistics.total,
      icon: MessageCircleHeart,
      accent:
        "bg-[#EFF4F6] text-[#587589]",
    },
    {
      title: "Chờ duyệt",
      value: statistics.pending,
      icon: Clock3,
      accent:
        "bg-[#FFF4E5] text-[#B08B54]",
    },
    {
      title: "Đã duyệt",
      value: statistics.approved,
      icon: CheckCircle2,
      accent:
        "bg-[#EAF6ED] text-[#568567]",
    },
    {
      title: "Đã ẩn",
      value: statistics.hidden,
      icon: EyeOff,
      accent:
        "bg-[#EFF1F2] text-[#7D8B90]",
    },
  ];

  // ======================================================
  // RENDER
  // ======================================================

  return (
    <div className="min-w-0 w-full px-4 py-5 sm:px-6 sm:py-6 xl:px-8 xl:py-8">
      <div className="mx-auto flex w-full max-w-[1480px] min-w-0 flex-col gap-5 sm:gap-6">
        {/* ==========================================
            HEADER
        ========================================== */}

        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
          <div className="min-w-0">
            <div className="mb-2 flex items-center gap-2 text-[#B8A27D]">
              <Heart size={14} />

              <span className="text-[10px] font-semibold uppercase tracking-[0.18em]">
                Nam &amp; Thư Wedding
              </span>
            </div>

            <h2 className="text-[22px] font-semibold leading-tight text-[#31566B] sm:text-[26px]">
              Quản lý lời chúc
            </h2>

            <p className="mt-2 text-[12px] leading-6 text-[#87979A] sm:text-[13px]">
              {isSuper
                ? "Xem, theo dõi và kiểm duyệt lời chúc của hai gia đình."
                : `Xem, theo dõi và kiểm duyệt lời chúc ${sideLabel(
                    adminSide ?? "groom"
                  )}.`}
            </p>
          </div>

          <button
            type="button"
            disabled={
              loading ||
              mutatingId !== null
            }
            onClick={() => {
              setError("");

              setRefreshKey(
                (current) => current + 1
              );
            }}
            className="inline-flex h-10 shrink-0 items-center justify-center gap-2 self-start rounded-xl border border-[#E0E7E4] bg-white px-4 text-[12px] font-medium text-[#31566B] transition hover:bg-[#F4F7F5] disabled:opacity-50"
          >
            <RefreshCw
              size={15}
              className={
                loading ? "animate-spin" : ""
              }
            />

            Làm mới
          </button>
        </div>

        {/* ==========================================
            STATISTICS
        ========================================== */}

        <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
          {statCards.map((item) => (
            <StatCard
              key={item.title}
              title={item.title}
              value={item.value}
              icon={item.icon}
              accent={item.accent}
            />
          ))}
        </div>

        {/* ==========================================
            NOTIFICATIONS
        ========================================== */}

        {success && (
          <div
            role="status"
            aria-live="polite"
            className="flex items-start gap-2 rounded-xl border border-[#D0E8D7] bg-[#EDF8F0] p-4 text-[12px] leading-6 text-[#417D58]"
          >
            <CheckCircle2
              size={17}
              className="mt-1 shrink-0"
            />

            <span className="min-w-0 flex-1">
              {success}
            </span>

            <button
              type="button"
              aria-label="Đóng thông báo"
              onClick={() =>
                setSuccess("")
              }
              className="ml-auto shrink-0"
            >
              <X size={15} />
            </button>
          </div>
        )}

        {error && (
          <div
            role="alert"
            className="flex items-start gap-2 rounded-xl border border-[#EDCDCD] bg-[#FFF1F1] p-4 text-[12px] leading-6 text-[#B75E61]"
          >
            <span className="min-w-0 flex-1">
              {error}
            </span>

            <button
              type="button"
              aria-label="Đóng lỗi"
              onClick={() =>
                setError("")
              }
            >
              <X size={15} />
            </button>
          </div>
        )}

        {/* ==========================================
            SEARCH & FILTERS
        ========================================== */}

        <SectionCard>
          <div className="p-4 sm:p-5">
            <form
              onSubmit={handleSearch}
              className="flex flex-col gap-3 sm:flex-row"
            >
              <div className="relative min-w-0 flex-1">
                <Search
                  size={16}
                  className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[#99A7AA]"
                />

                <input
                  type="search"
                  aria-label="Tìm kiếm lời chúc"
                  maxLength={100}
                  value={searchInput}
                  onChange={(event) =>
                    setSearchInput(
                      event.target.value
                    )
                  }
                  placeholder="Tìm theo tên, mối quan hệ hoặc lời chúc..."
                  className={`${fieldClass} pl-10`}
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="h-11 shrink-0 rounded-xl bg-[#31566B] px-6 text-[12px] font-medium text-white transition hover:bg-[#25495D] disabled:opacity-50"
              >
                Tìm kiếm
              </button>
            </form>

            <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-[1fr_1fr_auto]">
              {/* SIDE FILTER */}

              <div className="min-w-0">
                <label
                  htmlFor="wish-side-filter"
                  className={labelClass}
                >
                  Bên mời
                </label>

                {isSuper ? (
                  <select
                    id="wish-side-filter"
                    value={sideFilter}
                    onChange={(event) => {
                      setPage(1);

                      setSideFilter(
                        event.target.value as SideFilter
                      );
                    }}
                    className={fieldClass}
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
                    id="wish-side-filter"
                    readOnly
                    value={sideLabel(
                      adminSide ?? "groom"
                    )}
                    className={`${fieldClass} bg-[#F6F7F5]`}
                  />
                )}
              </div>

              {/* STATUS FILTER */}

              <div className="min-w-0">
                <label
                  htmlFor="wish-status-filter"
                  className={labelClass}
                >
                  Trạng thái kiểm duyệt
                </label>

                <select
                  id="wish-status-filter"
                  value={statusFilter}
                  onChange={(event) => {
                    setPage(1);

                    setStatusFilter(
                      event.target.value as StatusFilter
                    );
                  }}
                  className={fieldClass}
                >
                  <option value="all">
                    Tất cả
                  </option>

                  <option value="pending">
                    Chờ duyệt
                  </option>

                  <option value="approved">
                    Đã duyệt
                  </option>

                  <option value="hidden">
                    Đã ẩn
                  </option>
                </select>
              </div>

              {/* RESET FILTER */}

              <div className="flex items-end sm:col-span-2 xl:col-span-1">
                <button
                  type="button"
                  onClick={resetFilters}
                  className="h-11 w-full rounded-xl border border-[#E2E7E4] bg-[#FAFAF8] px-5 text-[12px] font-medium text-[#607680] transition hover:bg-[#F1F4F2] xl:w-auto"
                >
                  Xóa bộ lọc
                </button>
              </div>
            </div>
          </div>
        </SectionCard>

        {/* ==========================================
            WISHES LIST
        ========================================== */}

        <SectionCard>
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#EEEAE4] px-4 py-4 sm:px-5">
            <div className="flex items-center gap-2.5">
              <MessageCircleHeart
                size={17}
                className="text-[#B8A27D]"
              />

              <h3 className="text-[13px] font-semibold text-[#31566B]">
                Danh sách lời chúc
              </h3>
            </div>

            <span className="text-[11px] text-[#91A0A3]">
              {pagination.total} kết quả
            </span>
          </div>

          {/* LOADING */}

          {loading ? (
            <div className="flex min-h-[250px] flex-col items-center justify-center gap-3 p-6 text-center text-[#87979A]">
              <LoaderCircle
                size={27}
                className="animate-spin text-[#B8A27D]"
              />

              <p className="text-[12px]">
                Đang tải danh sách lời chúc...
              </p>
            </div>
          ) : wishes.length === 0 ? (
            /* EMPTY */

            <div className="flex min-h-[280px] flex-col items-center justify-center p-6 text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-[#F6F1E8] text-[#B8A27D]">
                <Heart
                  size={25}
                  strokeWidth={1.5}
                />
              </div>

              <h3 className="mt-4 text-sm font-semibold text-[#31566B]">
                Chưa có lời chúc phù hợp
              </h3>

              <p className="mt-2 max-w-sm text-[12px] leading-6 text-[#8A989B]">
                Lời chúc từ thiệp cá nhân hóa sẽ
                xuất hiện tại đây. Bạn cũng có thể
                thử thay đổi bộ lọc.
              </p>
            </div>
          ) : (
            <>
              {/* DESKTOP TABLE */}

              <div className="hidden xl:block">
                <table className="w-full table-fixed border-collapse text-left">
                  <colgroup>
                    <col style={{ width: "19%" }} />
                    <col style={{ width: "30%" }} />
                    <col style={{ width: "15%" }} />
                    <col style={{ width: "13%" }} />
                    <col style={{ width: "23%" }} />
                  </colgroup>

                  <thead className="border-b border-[#EEEAE4] bg-[#FAF9F6] text-[10px] font-semibold uppercase tracking-[0.07em] text-[#91A0A3]">
                    <tr>
                      <th className="px-4 py-4 font-medium">
                        Người gửi
                      </th>

                      <th className="px-4 py-4 font-medium">
                        Lời chúc
                      </th>

                      <th className="px-4 py-4 font-medium">
                        Xác nhận
                      </th>

                      <th className="px-4 py-4 font-medium">
                        Trạng thái
                      </th>

                      <th className="px-4 py-4 text-right font-medium">
                        Thao tác
                      </th>
                    </tr>
                  </thead>

                  <tbody className="divide-y divide-[#F0EDE7]">
                    {wishes.map((wish) => (
                      <tr
                        key={wish.id}
                        className="align-middle transition hover:bg-[#FCFBF8]"
                      >
                        {/* SENDER */}

                        <td className="px-4 py-5">
                          <p className="break-words text-[12px] font-semibold leading-5 text-[#31566B]">
                            {wish.guestName}
                          </p>

                          <p className="mt-1 text-[11px] text-[#B0946E]">
                            {sideLabel(
                              wish.guestSide
                            )}
                          </p>

                          <p className="mt-1 break-words text-[11px] leading-5 text-[#92A0A3]">
                            {wish.relation}
                          </p>
                        </td>

                        {/* MESSAGE */}

                        <td className="px-4 py-5">
                          <p className="line-clamp-2 whitespace-pre-wrap break-words font-wedding-serif text-[13px] leading-6 text-[#61726D]">
                            {wish.message}
                          </p>

                          <p className="mt-1.5 text-[10px] text-[#9AA7A8]">
                            {dateLabel(
                              wish.createdAt
                            )}
                          </p>
                        </td>

                        {/* RSVP */}

                        <td className="px-4 py-5">
                          <span className="text-[11px] leading-5 text-[#607680]">
                            {rsvpLabel(
                              wish.rsvpStatus
                            )}
                          </span>
                        </td>

                        {/* STATUS */}

                        <td className="px-4 py-5">
                          <StatusBadge
                            status={wish.status}
                          />
                        </td>

                        {/* ACTIONS */}

                        <td className="px-4 py-5">
                          {renderActions(
                            wish,
                            true
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* TABLET & MOBILE CARDS */}

              <div className="divide-y divide-[#EEEAE4] xl:hidden">
                {wishes.map((wish) => (
                  <article
                    key={wish.id}
                    className="p-4 sm:p-5"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <h3 className="break-words text-[13px] font-semibold leading-6 text-[#31566B] sm:text-sm">
                          {wish.guestName}
                        </h3>

                        <p className="mt-1 text-[11px] leading-5 text-[#9D8666]">
                          {sideLabel(
                            wish.guestSide
                          )}
                          {" · "}
                          {wish.relation}
                        </p>
                      </div>

                      <StatusBadge
                        status={wish.status}
                      />
                    </div>

                    <div className="mt-4 rounded-xl border border-[#F0E8DB] bg-[#FDFBF6] p-4">
                      <p className="whitespace-pre-wrap break-words font-wedding-serif text-[15px] leading-7 text-[#61726D]">
                        “{wish.message}”
                      </p>
                    </div>

                    <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-[11px] leading-5 text-[#87979A]">
                      <span>
                        <strong className="font-medium text-[#607680]">
                          RSVP:
                        </strong>{" "}
                        {rsvpLabel(
                          wish.rsvpStatus
                        )}
                      </span>

                      <span>
                        <strong className="font-medium text-[#607680]">
                          Ngày gửi:
                        </strong>{" "}
                        {dateLabel(
                          wish.createdAt
                        )}
                      </span>
                    </div>

                    <div className="mt-4 border-t border-[#F0EDE7] pt-4">
                      {renderActions(
                        wish,
                        false
                      )}
                    </div>
                  </article>
                ))}
              </div>
            </>
          )}

          {/* ==========================================
              PAGINATION
          ========================================== */}

          {!loading &&
            pagination.total > 0 && (
              <div className="flex flex-col gap-4 border-t border-[#EEEAE4] px-4 py-4 sm:px-5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-[11px] text-[#91A0A3]">
                    Hiển thị{" "}
                    <strong>
                      {firstItem}
                    </strong>
                    {" – "}
                    <strong>
                      {lastItem}
                    </strong>
                    {" / "}
                    <strong>
                      {pagination.total}
                    </strong>{" "}
                    lời chúc
                  </p>

                  <p className="text-[11px] text-[#91A0A3]">
                    Trang{" "}
                    <strong>
                      {currentPage}
                    </strong>
                    {" / "}
                    <strong>
                      {totalPages}
                    </strong>
                  </p>
                </div>

                {totalPages > 1 && (
                  <nav
                    aria-label="Phân trang lời chúc"
                    className="flex flex-wrap items-center justify-center gap-2"
                  >
                    <button
                      type="button"
                      disabled={
                        loading ||
                        mutatingId !== null ||
                        page <= 1
                      }
                      onClick={() =>
                        goToPage(
                          page - 1
                        )
                      }
                      className="inline-flex h-10 items-center justify-center gap-1 rounded-lg border border-[#E2E7E4] bg-white px-3 text-[11px] text-[#31566B] hover:bg-[#F4F7F5] disabled:opacity-40"
                    >
                      <ChevronLeft size={15} />
                      Trước
                    </button>

                    {pageNumbers.map(
                      (pageNumber) => (
                        <button
                          key={pageNumber}
                          type="button"
                          disabled={
                            loading ||
                            mutatingId !== null
                          }
                          onClick={() =>
                            goToPage(
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
                              ? "h-10 min-w-10 rounded-lg bg-[#31566B] px-3 text-[11px] font-semibold text-white"
                              : "h-10 min-w-10 rounded-lg border border-[#E2E7E4] bg-white px-3 text-[11px] text-[#31566B] transition hover:bg-[#F4F7F5]"
                          }
                        >
                          {pageNumber}
                        </button>
                      )
                    )}

                    <button
                      type="button"
                      disabled={
                        loading ||
                        mutatingId !== null ||
                        page >= totalPages
                      }
                      onClick={() =>
                        goToPage(
                          page + 1
                        )
                      }
                      className="inline-flex h-10 items-center justify-center gap-1 rounded-lg border border-[#E2E7E4] bg-white px-3 text-[11px] text-[#31566B] hover:bg-[#F4F7F5] disabled:opacity-40"
                    >
                      Sau
                      <ChevronRight size={15} />
                    </button>
                  </nav>
                )}
              </div>
            )}
        </SectionCard>

        <p className="pb-2 text-center text-[11px] leading-6 text-[#9BA7A7]">
          Nam &amp; Thư Wedding · Quản lý lời chúc và
          xác nhận tham dự
        </p>
      </div>

      {/* ==========================================
          DETAIL MODAL
      ========================================== */}

      {selectedWish && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center overflow-y-auto bg-[#142D3A]/60 p-3 backdrop-blur-[2px] sm:p-5"
          onMouseDown={(event) => {
            if (
              event.target ===
              event.currentTarget
            ) {
              setSelectedWish(null);
            }
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="wish-detail-title"
            className="my-auto w-full max-w-[580px] max-h-[92dvh] overflow-y-auto rounded-[22px] bg-white p-5 shadow-2xl sm:rounded-[26px] sm:p-7"
          >
            {/* HEADER */}

            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#C98792]">
                  Nam &amp; Thư Wedding
                </p>

                <h2
                  id="wish-detail-title"
                  className="font-wedding-serif mt-2 text-[26px] leading-tight text-[#31566B] sm:text-[32px]"
                >
                  Chi tiết lời chúc
                </h2>
              </div>

              <button
                type="button"
                aria-label="Đóng chi tiết"
                onClick={() =>
                  setSelectedWish(null)
                }
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-[#819196] hover:bg-[#F3F5F2]"
              >
                <X size={19} />
              </button>
            </div>

            {/* SENDER */}

            <div className="mt-6 rounded-xl border border-[#EAE5DC] bg-[#FAF9F6] p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <p className="break-words text-[14px] font-semibold text-[#31566B]">
                    {selectedWish.guestName}
                  </p>

                  <p className="mt-1 text-[12px] text-[#87979A]">
                    {sideLabel(
                      selectedWish.guestSide
                    )}
                    {" · "}
                    {selectedWish.relation}
                  </p>
                </div>

                <StatusBadge
                  status={selectedWish.status}
                />
              </div>

              <p className="mt-3 text-[12px] text-[#607680]">
                RSVP:{" "}
                {rsvpLabel(
                  selectedWish.rsvpStatus
                )}
              </p>
            </div>

            {/* MESSAGE */}

            <div className="my-5 rounded-2xl border border-[#F0E7DA] bg-[#FFFCF7] p-5 sm:p-6">
              <Heart
                size={19}
                fill="currentColor"
                strokeWidth={1}
                className="mb-3 text-[#C98792]"
              />

              <p className="whitespace-pre-wrap break-words font-wedding-serif text-[18px] leading-8 text-[#31566B] sm:text-[20px]">
                {selectedWish.message}
              </p>
            </div>

            {/* DATES */}

            <div className="space-y-2 text-[12px] leading-6 text-[#819196]">
              <p>
                Ngày gửi:{" "}
                {dateLabel(
                  selectedWish.createdAt
                )}
              </p>

              <p>
                Cập nhật:{" "}
                {dateLabel(
                  selectedWish.updatedAt
                )}
              </p>

              <p>
                Kiểm duyệt:{" "}
                {dateLabel(
                  selectedWish.reviewedAt
                )}
              </p>
            </div>

            {/* ACTIONS */}

            <div className="mt-5 border-t border-[#EEEAE4] pt-5">
              {renderActions(
                selectedWish,
                false
              )}
            </div>

            {/* SECURITY NOTE */}

            <div className="mt-5 flex items-start gap-2 rounded-xl bg-[#F4F7F5] p-3 text-[11px] leading-5 text-[#819196]">
              <ShieldCheck
                size={16}
                className="mt-0.5 shrink-0"
              />

              <p>
                Duyệt, ẩn hoặc xóa lời chúc
                không làm thay đổi thông tin
                khách mời hay trạng thái RSVP.
              </p>
            </div>

            <button
              type="button"
              onClick={() =>
                setSelectedWish(null)
              }
              className="mt-5 h-11 w-full rounded-xl border border-[#E2E7E4] text-[12px] font-medium text-[#607680] hover:bg-[#F4F7F5]"
            >
              Đóng
            </button>
          </div>
        </div>
      )}

      {/* ==================================================
          DELETE CONFIRMATION MODAL
          
          MỚI:
          - Nút Xóa chỉ mở popup này.
          - Hủy không tác động dữ liệu.
          - Xác nhận mới thực hiện API DELETE.
          - Lỗi API hiển thị bên trong popup.
          ================================================== */}

      {wishToDelete && (
        <div
          className="fixed inset-0 z-[200] flex items-center justify-center bg-[#142D3A]/65 p-3 backdrop-blur-[3px] sm:p-5"
          onMouseDown={(event) => {
            if (
              event.target ===
                event.currentTarget &&
              !mutationLock.current
            ) {
              closeDeleteConfirmation();
            }
          }}
        >
          <div
            id="wish-delete-dialog"
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="wish-delete-title"
            aria-describedby="wish-delete-description"
            className="flex max-h-[92dvh] w-full max-w-[480px] flex-col overflow-hidden rounded-[22px] bg-white shadow-2xl sm:rounded-[26px]"
          >
            {/* MODAL HEADER */}

            <div className="flex shrink-0 items-start justify-between gap-4 border-b border-[#EEEAE4] p-5 sm:p-6">
              <div className="flex min-w-0 items-center gap-3">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[#FFF0F0] text-[#B75E61]">
                  <AlertTriangle
                    size={24}
                    strokeWidth={1.8}
                  />
                </div>

                <div className="min-w-0">
                  <h2
                    id="wish-delete-title"
                    className="text-[17px] font-semibold leading-6 text-[#31566B] sm:text-[19px]"
                  >
                    Xác nhận xóa lời chúc
                  </h2>

                  <p className="mt-1 text-[12px] text-[#87979A]">
                    Vui lòng xác nhận trước khi xóa.
                  </p>
                </div>
              </div>

              <button
                type="button"
                aria-label="Đóng popup xác nhận"
                disabled={mutatingId !== null}
                onClick={closeDeleteConfirmation}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-[#819196] transition hover:bg-[#F3F5F2] disabled:opacity-50"
              >
                <X size={19} />
              </button>
            </div>

            {/* MODAL BODY */}

            <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-5 sm:p-6">
              <p
                id="wish-delete-description"
                className="text-[13px] leading-6 text-[#607680]"
              >
                Bạn có chắc chắn muốn xóa lời chúc của{" "}
                <span className="font-semibold text-[#31566B]">
                  {wishToDelete.guestName}
                </span>
                ?
              </p>

              {/* XEM TRƯỚC NỘI DUNG */}

              <div className="rounded-xl border border-[#F0E7DA] bg-[#FFFCF7] p-4">
                <div className="mb-2 flex items-center gap-2 text-[#C98792]">
                  <Heart size={15} />

                  <span className="text-[11px] font-semibold">
                    Nội dung lời chúc
                  </span>
                </div>

                <p className="line-clamp-4 whitespace-pre-wrap break-words font-wedding-serif text-[15px] leading-7 text-[#61726D]">
                  “{wishToDelete.message}”
                </p>
              </div>

              {/* WARNING */}

              <div className="flex items-start gap-2.5 rounded-xl border border-[#F1E3CD] bg-[#FFF7EA] p-3.5 text-[12px] leading-6 text-[#9A7542]">
                <AlertTriangle
                  size={17}
                  className="mt-1 shrink-0"
                />

                <p>
                  Lời chúc sẽ được xóa mềm khỏi hệ thống.
                  Thông tin khách mời và trạng thái RSVP
                  vẫn được giữ nguyên.
                </p>
              </div>

              {/* DELETE ERROR */}

              {deleteError && (
                <div
                  role="alert"
                  className="rounded-xl border border-[#EDCDCD] bg-[#FFF1F1] p-3 text-[12px] leading-6 text-[#B75E61]"
                >
                  {deleteError}
                </div>
              )}
            </div>

            {/* MODAL FOOTER */}

            <div className="flex shrink-0 flex-col-reverse gap-3 border-t border-[#EEEAE4] p-5 sm:flex-row sm:justify-end sm:p-6">
              <button
                ref={deleteCancelButtonRef}
                type="button"
                disabled={mutatingId !== null}
                onClick={closeDeleteConfirmation}
                className="h-11 rounded-xl border border-[#E2E7E4] bg-white px-6 text-[13px] font-medium text-[#607680] transition hover:bg-[#F4F7F5] disabled:cursor-not-allowed disabled:opacity-50"
              >
                Hủy
              </button>

              <button
                type="button"
                disabled={mutatingId !== null}
                onClick={() => {
                  void deleteWish(wishToDelete);
                }}
                className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-[#B75E61] px-6 text-[13px] font-medium text-white transition hover:bg-[#A24D51] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#B75E61]/40 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {mutatingId === wishToDelete.id ? (
                  <>
                    <LoaderCircle
                      size={16}
                      className="animate-spin"
                    />
                    Đang xóa...
                  </>
                ) : (
                  <>
                    <Trash2 size={16} />
                    Xác nhận xóa
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
