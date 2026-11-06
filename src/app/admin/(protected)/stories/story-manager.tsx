
"use client";

import Image from "next/image";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type FormEvent,
} from "react";
import {
  AlertCircle,
  ArrowDown,
  ArrowUp,
  CalendarDays,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Eye,
  EyeOff,
  Heart,
  ImagePlus,
  Images,
  LoaderCircle,
  Pencil,
  Plus,
  RefreshCw,
  Save,
  Trash2,
  Upload,
  X,
} from "lucide-react";

// ======================================================
// NAM & THU - LOVE STORY MANAGER
// GIAI ĐOẠN 3.11 - FIX REACT HOOKS / ESLINT
//
// Chức năng:
// - Quản lý Love Story dùng chung cho 3 Admin.
// - Thêm, chỉnh sửa, xóa cột mốc.
// - Nhập ngày bằng lịch hoặc dd/mm/yyyy.
// - Tiêu đề tối đa 200 ký tự.
// - Nội dung tối đa 2.000 ký tự.
// - Upload ảnh MongoDB GridFS, tối đa 8 MB.
// - Xem trước ảnh, thay ảnh khi chỉnh sửa.
// - Ẩn/hiện cột mốc.
// - Sắp xếp xuyên trang.
// - Phân trang 8 cột mốc.
// - Thống kê toàn bộ dữ liệu.
// - Popup responsive, khóa cuộn, focus trap.
//
// Sửa ESLint:
// 1. Không ghi busyRef trong render.
// 2. Không setCurrentPage đồng bộ trong effect.
// 3. Không gọi hàm cập nhật state đồng bộ trong
//    effect tải danh sách.
// 4. Không setState trong effect tạo URL ảnh.
// ======================================================

interface WeddingStory {
  id: string;
  date: string;
  title: string;
  description: string;
  image: string;
  sortOrder: number;
  isVisible: boolean;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
}

interface StoriesApiResponse {
  success?: boolean;
  message?: string;
  stories?: WeddingStory[];
  story?: WeddingStory;
}

interface UploadApiResponse {
  success?: boolean;
  message?: string;
  imageUrl?: string;
  image?: string;
}

type ModalState =
  | { type: "add" }
  | { type: "edit"; story: WeddingStory }
  | { type: "delete"; story: WeddingStory }
  | null;

type DateMode = "calendar" | "manual";

const STORIES_API = "/api/admin/stories";
const UPLOAD_API = "/api/admin/stories/upload";

const PAGE_SIZE = 8;
const MAX_TITLE = 200;
const MAX_DESCRIPTION = 2000;
const MAX_IMAGE_BYTES = 8 * 1024 * 1024;

const ALLOWED_MIME = [
  "image/jpeg",
  "image/png",
  "image/webp",
];

const INPUT_STYLE =
  "w-full rounded-xl border border-[#DFE6E1] bg-white px-4 py-3 text-[14px] text-[#31566B] outline-none transition focus:border-[#B8A27D] focus:ring-4 focus:ring-[#B8A27D]/10 disabled:opacity-60";

const SECONDARY_BUTTON =
  "inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-[#DFE6E1] bg-white px-4 text-[12px] font-medium text-[#31566B] transition hover:bg-[#F5F7F3] disabled:cursor-not-allowed disabled:opacity-40";

// ======================================================
// HELPERS
// ======================================================

function characterCount(value: string): number {
  return Array.from(value).length;
}

function limitCharacters(
  value: string,
  maxLength: number
): string {
  return Array.from(value)
    .slice(0, maxLength)
    .join("");
}

function sortStories(
  stories: WeddingStory[]
): WeddingStory[] {
  return [...stories].sort(
    (a, b) =>
      a.sortOrder - b.sortOrder ||
      a.id.localeCompare(b.id)
  );
}

function calendarToDisplay(value: string): string {
  const match = value.match(
    /^(\d{4})-(\d{2})-(\d{2})$/
  );

  if (!match) return "";

  return `${match[3]}/${match[2]}/${match[1]}`;
}

function displayToCalendar(value: string): string {
  const match = value.match(
    /^(\d{2})\/(\d{2})\/(\d{4})$/
  );

  if (!match) return "";

  return `${match[3]}-${match[2]}-${match[1]}`;
}

function isLeapYear(year: number): boolean {
  return (
    year % 400 === 0 ||
    (year % 4 === 0 && year % 100 !== 0)
  );
}

function isValidDate(value: string): boolean {
  const match = value.match(
    /^(\d{2})\/(\d{2})\/(\d{4})$/
  );

  if (!match) return false;

  const day = Number(match[1]);
  const month = Number(match[2]);
  const year = Number(match[3]);

  if (
    year < 1 ||
    year > 9999 ||
    month < 1 ||
    month > 12
  ) {
    return false;
  }

  const days = [
    31,
    isLeapYear(year) ? 29 : 28,
    31,
    30,
    31,
    30,
    31,
    31,
    30,
    31,
    30,
    31,
  ];

  return day >= 1 && day <= days[month - 1];
}

function isGridFsImage(src: string): boolean {
  return /^\/api\/stories\/image\/[a-f0-9]{24}$/i.test(
    src
  );
}

async function readResponse<T>(
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

async function sendMutation(
  method: "POST" | "PATCH" | "DELETE",
  body: Record<string, unknown>
): Promise<StoriesApiResponse> {
  const response = await fetch(STORIES_API, {
    method,
    credentials: "same-origin",
    cache: "no-store",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  const result =
    await readResponse<StoriesApiResponse>(
      response
    );

  if (!response.ok || !result.success) {
    throw new Error(
      result.message ||
        "Không thể thực hiện thao tác."
    );
  }

  return result;
}

// ======================================================
// MAIN COMPONENT
// ======================================================

export default function StoryManager() {
  // ==================================================
  // DATA
  // ==================================================

  const [stories, setStories] =
    useState<WeddingStory[]>([]);

  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // ==================================================
  // PAGINATION
  //
  // Dữ liệu đầy đủ được lưu trong state để
  // hỗ trợ sắp xếp xuyên trang và thống kê.
  // ==================================================

  const [currentPage, setCurrentPage] =
    useState(1);

  const totalStories = stories.length;

  const totalPages = Math.ceil(
    totalStories / PAGE_SIZE
  );

  // FIX ESLINT:
  // Tính trang hợp lệ từ currentPage và totalPages.
  // Không cần useEffect gọi setCurrentPage().
  const safePage = Math.min(
    Math.max(1, currentPage),
    Math.max(1, totalPages)
  );

  const startIndex =
    (safePage - 1) * PAGE_SIZE;

  const paginatedStories = stories.slice(
    startIndex,
    startIndex + PAGE_SIZE
  );

  const firstItem =
    totalStories > 0 ? startIndex + 1 : 0;

  const lastItem = Math.min(
    startIndex + PAGE_SIZE,
    totalStories
  );

  const pageStart = Math.max(
    1,
    Math.min(safePage - 2, totalPages - 4)
  );

  const pageNumbers = Array.from(
    { length: Math.min(5, totalPages) },
    (_, index) => pageStart + index
  );

  // ==================================================
  // MODAL / FORM
  // ==================================================

  const [modal, setModal] =
    useState<ModalState>(null);

  const [dateMode, setDateMode] =
    useState<DateMode>("calendar");

  const [date, setDate] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] =
    useState("");

  const [selectedFile, setSelectedFile] =
    useState<File | null>(null);

  const [previewUrl, setPreviewUrl] =
    useState("");

  const [formError, setFormError] =
    useState("");

  // ==================================================
  // REFS
  // ==================================================

  const fileInputRef =
    useRef<HTMLInputElement>(null);

  const closeButtonRef =
    useRef<HTMLButtonElement>(null);

  const modalRef =
    useRef<HTMLDivElement>(null);

  const lastFocusRef =
    useRef<HTMLElement | null>(null);

  const busyRef = useRef(false);
  const requestVersion = useRef(0);

  // FIX ESLINT #1:
  // Đồng bộ trạng thái busy sau khi render.
  // Không gán busyRef.current ngay trong render.
  useEffect(() => {
    busyRef.current = busy;
  }, [busy]);

  // ==================================================
  // PAGE ACTIONS
  // ==================================================

  function goToPage(nextPage: number) {
    if (busy || loading) return;

    setCurrentPage(
      Math.max(
        1,
        Math.min(
          nextPage,
          Math.max(1, totalPages)
        )
      )
    );
  }

  // ==================================================
  // LOAD STORIES
  // ==================================================

  const loadStories = useCallback(
    async (signal?: AbortSignal) => {
      const version = ++requestVersion.current;

      setLoading(true);
      setError("");

      try {
        const response = await fetch(
          STORIES_API,
          {
            method: "GET",
            credentials: "same-origin",
            cache: "no-store",
            signal,
          }
        );

        const result =
          await readResponse<StoriesApiResponse>(
            response
          );

        if (
          !response.ok ||
          !result.success ||
          !Array.isArray(result.stories)
        ) {
          throw new Error(
            result.message ||
              "Không thể tải Love Story."
          );
        }

        if (
          signal?.aborted ||
          version !== requestVersion.current
        ) {
          return;
        }

        setStories(sortStories(result.stories));
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
            : "Không thể tải danh sách."
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
    []
  );

  // FIX ESLINT #2:
  // Không gọi loadStories() đồng bộ trong effect.
  // Microtask chạy sau khi effect được thiết lập.
  // AbortController ngăn request đã hủy.
  useEffect(() => {
    const controller = new AbortController();

    void Promise.resolve().then(() => {
      if (!controller.signal.aborted) {
        return loadStories(controller.signal);
      }
    });

    return () => {
      controller.abort();
    };
  }, [loadStories]);

  // ==================================================
  // PREVIEW IMAGE
  //
  // FIX ESLINT #3:
  // Tạo object URL trong onChange.
  // Effect chỉ thu hồi URL đã tạo.
  // ==================================================

  useEffect(() => {
    if (!previewUrl) return;

    return () => {
      URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  // ==================================================
  // MODAL BEHAVIOR
  // ==================================================

  const modalOpen = modal !== null;

  useEffect(() => {
    if (!modalOpen) return;

    const previousOverflow =
      document.body.style.overflow;

    document.body.style.overflow = "hidden";

    closeButtonRef.current?.focus();

    function handleKeyDown(
      event: KeyboardEvent
    ) {
      if (event.key === "Escape") {
        event.preventDefault();

        if (!busyRef.current) {
          setModal(null);
          setSelectedFile(null);
          setPreviewUrl("");
          setFormError("");
        }

        return;
      }

      if (event.key !== "Tab") return;

      const container = modalRef.current;

      if (!container) return;

      const elements = Array.from(
        container.querySelectorAll<HTMLElement>(
          'button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), a[href]'
        )
      ).filter(
        (item) =>
          item.getAttribute("tabindex") !== "-1" &&
          item.getClientRects().length > 0
      );

      if (!elements.length) return;

      const first = elements[0];
      const last = elements[elements.length - 1];

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
        previousOverflow;

      document.removeEventListener(
        "keydown",
        handleKeyDown
      );

      lastFocusRef.current?.focus();
    };
  }, [modalOpen]);

  // ==================================================
  // FORM HELPERS
  // ==================================================

  function resetForm() {
    setDateMode("calendar");
    setDate("");
    setTitle("");
    setDescription("");
    setSelectedFile(null);
    setPreviewUrl("");
    setFormError("");

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }

  function rememberFocus() {
    lastFocusRef.current =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
  }

  function openAdd() {
    if (busy || loading) return;

    rememberFocus();
    resetForm();

    setError("");
    setSuccess("");
    setModal({ type: "add" });
  }

  function openEdit(story: WeddingStory) {
    if (busy || loading) return;

    rememberFocus();
    resetForm();

    const validDate = isValidDate(story.date);

    setDate(validDate ? story.date : "");

    setDateMode(
      validDate ? "calendar" : "manual"
    );

    setTitle(story.title);
    setDescription(story.description);

    setError("");
    setSuccess("");

    setModal({
      type: "edit",
      story,
    });
  }

  function openDelete(story: WeddingStory) {
    if (busy || loading) return;

    rememberFocus();

    setFormError("");
    setError("");
    setSuccess("");

    setModal({
      type: "delete",
      story,
    });
  }

  function closeModal() {
    if (busy) return;

    setModal(null);
    resetForm();
  }

  // ==================================================
  // DATE INPUT
  // ==================================================

  function handleCalendarDate(value: string) {
    setDate(
      value ? calendarToDisplay(value) : ""
    );
    setFormError("");
  }

  function handleManualDate(value: string) {
    setDate(value.slice(0, 10));
    setFormError("");
  }

  // ==================================================
  // SELECT FILE
  // ==================================================

  function handleFileChange(
    event: ChangeEvent<HTMLInputElement>
  ) {
    const file = event.target.files?.[0];

    if (!file) return;

    if (!ALLOWED_MIME.includes(file.type)) {
      setFormError(
        "Chỉ hỗ trợ JPG, PNG hoặc WebP."
      );
      event.target.value = "";
      return;
    }

    if (
      file.size === 0 ||
      file.size > MAX_IMAGE_BYTES
    ) {
      setFormError(
        "Dung lượng ảnh phải lớn hơn 0 và không vượt quá 8 MB."
      );
      event.target.value = "";
      return;
    }

    // Tạo URL khi chọn ảnh thay vì trong effect.
    const nextPreviewUrl =
      URL.createObjectURL(file);

    setSelectedFile(file);
    setPreviewUrl(nextPreviewUrl);
    setFormError("");
  }

  // ==================================================
  // UPLOAD IMAGE
  // ==================================================

  async function uploadImage(
    file: File
  ): Promise<string> {
    const formData = new FormData();

    formData.append("file", file);

    const response = await fetch(
      UPLOAD_API,
      {
        method: "POST",
        credentials: "same-origin",
        cache: "no-store",
        body: formData,
      }
    );

    const result =
      await readResponse<UploadApiResponse>(
        response
      );

    if (!response.ok || !result.success) {
      throw new Error(
        result.message ||
          "Không thể tải ảnh lên."
      );
    }

    const imageUrl =
      result.imageUrl ?? result.image;

    if (
      typeof imageUrl !== "string" ||
      !isGridFsImage(imageUrl)
    ) {
      throw new Error(
        "API upload không trả đường dẫn ảnh hợp lệ."
      );
    }

    return imageUrl;
  }

  // ==================================================
  // SAVE ADD / EDIT
  // ==================================================

  async function handleSave(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    if (
      !modal ||
      modal.type === "delete" ||
      busy
    ) {
      return;
    }

    setFormError("");

    const cleanTitle = title.trim();
    const cleanDescription =
      description.trim();
    const cleanDate = date.trim();

    if (!isValidDate(cleanDate)) {
      setFormError(
        "Vui lòng chọn hoặc nhập ngày hợp lệ theo dd/mm/yyyy."
      );
      return;
    }

    if (
      !cleanTitle ||
      characterCount(cleanTitle) > MAX_TITLE
    ) {
      setFormError(
        "Tiêu đề phải có từ 1 đến 200 ký tự."
      );
      return;
    }

    if (
      !cleanDescription ||
      characterCount(cleanDescription) >
        MAX_DESCRIPTION
    ) {
      setFormError(
        "Nội dung phải có từ 1 đến 2.000 ký tự."
      );
      return;
    }

    setBusy(true);

    try {
      let image =
        modal.type === "edit"
          ? modal.story.image
          : "";

      if (selectedFile) {
        image = await uploadImage(
          selectedFile
        );
      }

      if (modal.type === "add") {
        await sendMutation("POST", {
          date: cleanDate,
          title: cleanTitle,
          description: cleanDescription,
          image,
        });
      } else {
        await sendMutation("PATCH", {
          id: modal.story.id,
          date: cleanDate,
          title: cleanTitle,
          description: cleanDescription,
          image,
        });
      }

      const wasAdd = modal.type === "add";

      setModal(null);
      resetForm();

      await loadStories();

      if (wasAdd) {
        setCurrentPage(1);
      }

      setSuccess(
        wasAdd
          ? "Đã thêm cột mốc Love Story."
          : "Đã cập nhật cột mốc Love Story."
      );
    } catch (caught) {
      setFormError(
        caught instanceof Error
          ? caught.message
          : "Không thể lưu cột mốc."
      );
    } finally {
      setBusy(false);
    }
  }

  // ==================================================
  // DELETE
  // ==================================================

  async function handleDelete() {
    if (
      !modal ||
      modal.type !== "delete" ||
      busy
    ) {
      return;
    }

    setBusy(true);
    setFormError("");

    try {
      await sendMutation("DELETE", {
        id: modal.story.id,
      });

      setModal(null);
      resetForm();

      await loadStories();

      setSuccess(
        "Đã xóa cột mốc Love Story."
      );
    } catch (caught) {
      setFormError(
        caught instanceof Error
          ? caught.message
          : "Không thể xóa cột mốc."
      );
    } finally {
      setBusy(false);
    }
  }

  // ==================================================
  // TOGGLE VISIBILITY
  // ==================================================

  async function toggleVisibility(
    story: WeddingStory
  ) {
    if (busy || loading) return;

    setBusy(true);
    setError("");
    setSuccess("");

    try {
      const nextValue = !story.isVisible;

      await sendMutation("PATCH", {
        id: story.id,
        isVisible: nextValue,
      });

      setStories((current) =>
        current.map((item) =>
          item.id === story.id
            ? {
                ...item,
                isVisible: nextValue,
              }
            : item
        )
      );

      setSuccess(
        nextValue
          ? "Đã bật hiển thị cột mốc."
          : "Đã ẩn cột mốc khỏi thiệp cưới."
      );
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Không thể thay đổi trạng thái."
      );
    } finally {
      setBusy(false);
    }
  }

  // ==================================================
  // REORDER
  // ==================================================

  async function moveStory(
    globalIndex: number,
    direction: -1 | 1
  ) {
    if (busy || loading) return;

    const nextIndex =
      globalIndex + direction;

    if (
      nextIndex < 0 ||
      nextIndex >= stories.length
    ) {
      return;
    }

    const reordered = [...stories];

    [
      reordered[globalIndex],
      reordered[nextIndex],
    ] = [
      reordered[nextIndex],
      reordered[globalIndex],
    ];

    setBusy(true);
    setError("");
    setSuccess("");

    try {
      await sendMutation("PATCH", {
        action: "reorder",
        ids: reordered.map(
          (story) => story.id
        ),
      });

      setStories(
        reordered.map((story, position) => ({
          ...story,
          sortOrder: position,
        }))
      );

      setSuccess(
        "Đã thay đổi thứ tự cột mốc."
      );
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Không thể thay đổi thứ tự."
      );
    } finally {
      setBusy(false);
    }
  }

  // ==================================================
  // STATISTICS
  // ==================================================

  const visibleStories = stories.filter(
    (story) => story.isVisible
  ).length;

  const hiddenStories =
    totalStories - visibleStories;

  const editingStory =
    modal?.type === "edit"
      ? modal.story
      : null;

  const imagePreview =
    previewUrl ||
    editingStory?.image ||
    "";

  // ==================================================
  // RENDER
  // ==================================================

  return (
    <main className="mx-auto w-full max-w-[1450px] px-4 py-7 text-[#31566B] sm:px-6 sm:py-9 xl:px-8">
      {/* HEADER */}

      <section className="mb-8">
        <div className="mb-3 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-[#B8A27D]">
          <Heart size={16} />
          Wedding Love Story
        </div>

        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="font-wedding-serif text-[33px] leading-tight sm:text-[42px]">
              Quản lý Love Story
            </h1>

            <p className="mt-2 max-w-[640px] text-[13px] leading-6 text-[#829294]">
              Quản lý những cột mốc trong hành trình
              yêu thương của Nam &amp; Thư.
              Các thay đổi được lưu vào cơ sở dữ liệu.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={loading || busy}
              onClick={() => {
                setSuccess("");
                void loadStories();
              }}
              className={SECONDARY_BUTTON}
            >
              <RefreshCw
                size={16}
                className={
                  loading ? "animate-spin" : ""
                }
              />
              Tải lại
            </button>

            <button
              type="button"
              onClick={openAdd}
              disabled={loading || busy}
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[#31566B] px-5 text-[13px] font-semibold text-white transition hover:bg-[#28495C] disabled:opacity-50"
            >
              <Plus size={17} />
              Thêm cột mốc
            </button>
          </div>
        </div>
      </section>

      {/* STATISTICS */}

      <section className="mb-8 grid gap-4 sm:grid-cols-3">
        {[
          {
            label: "Tổng cột mốc",
            count: totalStories,
            icon: Heart,
          },
          {
            label: "Đang hiển thị",
            count: visibleStories,
            icon: Eye,
          },
          {
            label: "Đang ẩn",
            count: hiddenStories,
            icon: EyeOff,
          },
        ].map((stat) => {
          const Icon = stat.icon;

          return (
            <div
              key={stat.label}
              className="rounded-[20px] border border-[#E8E3D9] bg-white p-5 shadow-sm sm:p-6"
            >
              <Icon
                size={21}
                className="text-[#B8A27D]"
              />

              <p className="mt-4 text-xs text-[#849496]">
                {stat.label}
              </p>

              <p className="mt-2 text-3xl font-semibold tabular-nums">
                {stat.count}
              </p>
            </div>
          );
        })}
      </section>

      {/* FEEDBACK */}

      {error && (
        <div
          role="alert"
          className="mb-5 flex items-start gap-2 rounded-xl border border-[#EDC5C7] bg-[#FFF0F0] px-4 py-3 text-[13px] text-[#B2545A]"
        >
          <AlertCircle
            size={17}
            className="mt-0.5 shrink-0"
          />
          {error}
        </div>
      )}

      {success && !error && (
        <div
          role="status"
          className="mb-5 flex items-center gap-2 rounded-xl border border-[#D1E7D9] bg-[#EFF9F2] px-4 py-3 text-[13px] text-[#3D7654]"
        >
          <CheckCircle2 size={17} />
          {success}
        </div>
      )}

      {/* STORIES LIST */}

      <section>
        <div className="mb-5 flex items-center justify-between gap-3">
          <h2 className="font-wedding-serif text-[26px] sm:text-[30px]">
            Danh sách cột mốc
          </h2>

          {!loading && (
            <span className="text-xs text-[#849496]">
              {stories.length} cột mốc
            </span>
          )}
        </div>

        {loading ? (
          <div className="flex min-h-[300px] items-center justify-center rounded-[20px] border border-[#E8E3D9] bg-white">
            <LoaderCircle
              size={28}
              className="animate-spin text-[#31566B]"
            />
          </div>
        ) : stories.length === 0 ? (
          <div className="rounded-[20px] border border-[#E8E3D9] bg-white px-5 py-16 text-center">
            <Heart
              size={36}
              className="mx-auto text-[#B8A27D]"
            />

            <p className="mt-4 text-sm text-[#829294]">
              Chưa có cột mốc Love Story nào.
            </p>

            <button
              type="button"
              onClick={openAdd}
              className="mt-5 inline-flex items-center gap-2 rounded-xl bg-[#31566B] px-5 py-3 text-[13px] text-white"
            >
              <Plus size={16} />
              Thêm cột mốc đầu tiên
            </button>
          </div>
        ) : (
          <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
            {paginatedStories.map(
              (story, index) => {
                const globalIndex =
                  startIndex + index;

                return (
                  <article
                    key={story.id}
                    className="min-w-0 overflow-hidden rounded-[20px] border border-[#E8E3D9] bg-white shadow-sm"
                  >
                    {/* IMAGE */}

                    <div className="relative aspect-[4/3] overflow-hidden bg-[#E9EDE5]">
                      {story.image ? (
                        <Image
                          src={story.image}
                          alt={story.title}
                          fill
                          sizes="(max-width: 639px) 100vw, (max-width: 1279px) 50vw, 33vw"
                          unoptimized={isGridFsImage(
                            story.image
                          )}
                          className="object-cover"
                        />
                      ) : (
                        <div className="flex h-full items-center justify-center">
                          <Images
                            size={35}
                            className="text-[#B8A27D]/60"
                          />
                        </div>
                      )}

                      <span className="absolute left-3 top-3 rounded-full bg-white/90 px-3 py-1.5 text-xs font-semibold text-[#31566B]">
                        {String(
                          globalIndex + 1
                        ).padStart(2, "0")}
                      </span>

                      <span
                        className={`absolute right-3 top-3 inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-[11px] font-medium ${
                          story.isVisible
                            ? "bg-[#EAF6ED] text-[#568567]"
                            : "bg-[#FFF4E5] text-[#B08B54]"
                        }`}
                      >
                        {story.isVisible ? (
                          <Eye size={13} />
                        ) : (
                          <EyeOff size={13} />
                        )}

                        {story.isVisible
                          ? "Đang hiện"
                          : "Đang ẩn"}
                      </span>
                    </div>

                    {/* CONTENT */}

                    <div className="space-y-4 p-4 sm:p-5">
                      <div className="flex items-center gap-2 text-[12px] text-[#B08B54]">
                        <CalendarDays size={15} />

                        <span className="break-words">
                          {story.date}
                        </span>
                      </div>

                      <h3 className="font-wedding-serif line-clamp-2 text-[23px] leading-snug text-[#31566B]">
                        {story.title}
                      </h3>

                      <p className="line-clamp-4 whitespace-pre-line break-words text-[13px] leading-6 text-[#829294]">
                        {story.description}
                      </p>

                      {/* EDIT / VISIBILITY */}

                      <div className="grid grid-cols-2 gap-2">
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() =>
                            openEdit(story)
                          }
                          className={SECONDARY_BUTTON}
                        >
                          <Pencil size={15} />
                          Chỉnh sửa
                        </button>

                        <button
                          type="button"
                          disabled={busy}
                          onClick={() =>
                            void toggleVisibility(story)
                          }
                          className={SECONDARY_BUTTON}
                        >
                          {story.isVisible ? (
                            <EyeOff size={15} />
                          ) : (
                            <Eye size={15} />
                          )}

                          {story.isVisible
                            ? "Ẩn"
                            : "Hiện"}
                        </button>
                      </div>

                      {/* REORDER / DELETE */}

                      <div className="flex items-center justify-between gap-3 border-t border-[#EDF0EC] pt-4">
                        <div className="flex gap-2">
                          <button
                            type="button"
                            disabled={
                              busy ||
                              globalIndex === 0
                            }
                            aria-label={`Đưa ${story.title} lên`}
                            onClick={() =>
                              void moveStory(
                                globalIndex,
                                -1
                              )
                            }
                            className="flex h-10 w-10 items-center justify-center rounded-xl border border-[#DFE6E1] disabled:opacity-30"
                          >
                            <ArrowUp size={17} />
                          </button>

                          <button
                            type="button"
                            disabled={
                              busy ||
                              globalIndex ===
                                stories.length - 1
                            }
                            aria-label={`Đưa ${story.title} xuống`}
                            onClick={() =>
                              void moveStory(
                                globalIndex,
                                1
                              )
                            }
                            className="flex h-10 w-10 items-center justify-center rounded-xl border border-[#DFE6E1] disabled:opacity-30"
                          >
                            <ArrowDown size={17} />
                          </button>
                        </div>

                        <button
                          type="button"
                          disabled={busy}
                          onClick={() =>
                            openDelete(story)
                          }
                          className="inline-flex h-10 items-center gap-2 rounded-xl border border-[#F0D5D8] bg-[#FFF7F7] px-4 text-[12px] font-medium text-[#B65B60] disabled:opacity-50"
                        >
                          <Trash2 size={15} />
                          Xóa
                        </button>
                      </div>
                    </div>
                  </article>
                );
              }
            )}
          </div>
        )}

        {/* PAGINATION */}

        {!loading && totalStories > 0 && (
          <div className="mt-8 flex flex-col items-center justify-between gap-4 rounded-[18px] border border-[#E8E3D9] bg-white px-4 py-5 sm:flex-row sm:px-5">
            <p className="text-center text-[12px] text-[#829294] sm:text-left">
              Hiển thị{" "}
              <strong>{firstItem}</strong>
              {" – "}
              <strong>{lastItem}</strong>
              {" / "}
              <strong>{totalStories}</strong>{" "}
              câu chuyện
            </p>

            {totalPages > 1 && (
              <nav
                aria-label="Phân trang Love Story"
                className="flex flex-wrap items-center justify-center gap-2"
              >
                <button
                  type="button"
                  disabled={
                    safePage <= 1 ||
                    loading ||
                    busy
                  }
                  onClick={() =>
                    goToPage(safePage - 1)
                  }
                  className={SECONDARY_BUTTON}
                >
                  <ChevronLeft size={16} />
                  Trước
                </button>

                {pageNumbers.map(
                  (pageNumber) => (
                    <button
                      key={pageNumber}
                      type="button"
                      disabled={loading || busy}
                      onClick={() =>
                        goToPage(pageNumber)
                      }
                      aria-label={`Trang ${pageNumber}`}
                      aria-current={
                        safePage === pageNumber
                          ? "page"
                          : undefined
                      }
                      className={
                        safePage === pageNumber
                          ? "h-10 min-w-10 rounded-xl bg-[#31566B] px-3 text-[12px] font-semibold text-white"
                          : "h-10 min-w-10 rounded-xl border border-[#DFE6E1] bg-white px-3 text-[12px] text-[#31566B] hover:bg-[#F5F7F3]"
                      }
                    >
                      {pageNumber}
                    </button>
                  )
                )}

                <button
                  type="button"
                  disabled={
                    safePage >= totalPages ||
                    loading ||
                    busy
                  }
                  onClick={() =>
                    goToPage(safePage + 1)
                  }
                  className={SECONDARY_BUTTON}
                >
                  Sau
                  <ChevronRight size={16} />
                </button>
              </nav>
            )}
          </div>
        )}
      </section>

      {/* MODAL */}

      {modal && (
        <div
          className="fixed inset-0 z-[9999] flex items-center justify-center bg-[#10202B]/65 p-3 backdrop-blur-[5px] sm:p-5"
          onMouseDown={(event) => {
            if (
              event.target === event.currentTarget &&
              !busy
            ) {
              closeModal();
            }
          }}
        >
          <div
            ref={modalRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="story-modal-title"
            className="flex max-h-[92dvh] w-full max-w-[920px] flex-col overflow-hidden rounded-[22px] border border-[#E7E2D9] bg-[#FFFDF9] shadow-[0_30px_100px_rgba(0,0,0,0.25)] sm:rounded-[26px]"
          >
            {/* MODAL HEADER */}

            <div className="flex shrink-0 items-center justify-between gap-3 border-b border-[#E9E7DF] bg-white px-5 py-4 sm:px-7 sm:py-5">
              <div>
                <p className="mb-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-[#B8A27D]">
                  Wedding Love Story
                </p>

                <h2
                  id="story-modal-title"
                  className="font-wedding-serif text-[25px] text-[#31566B] sm:text-[30px]"
                >
                  {modal.type === "add"
                    ? "Thêm cột mốc"
                    : modal.type === "edit"
                      ? "Chỉnh sửa cột mốc"
                      : "Xác nhận xóa"}
                </h2>
              </div>

              <button
                ref={closeButtonRef}
                type="button"
                onClick={closeModal}
                disabled={busy}
                aria-label="Đóng cửa sổ"
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-[#E5E8E5] text-[#61726D] transition hover:bg-[#F4F5F0] disabled:opacity-50"
              >
                <X size={20} />
              </button>
            </div>

            {/* DELETE CONFIRMATION */}

            {modal.type === "delete" ? (
              <>
                <div className="min-h-0 flex-1 overflow-y-auto px-5 py-7 sm:px-7">
                  <div className="flex items-start gap-4">
                    <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[#FFF0F0] text-[#B65B60]">
                      <Trash2 size={23} />
                    </span>

                    <div>
                      <h3 className="text-[16px] font-semibold text-[#31566B]">
                        Bạn có chắc muốn xóa cột mốc này?
                      </h3>

                      <p className="mt-3 break-words text-[14px] font-medium">
                        {modal.story.title}
                      </p>

                      <p className="mt-2 text-[13px] leading-6 text-[#829294]">
                        Cột mốc sẽ bị xóa khỏi cơ sở dữ liệu và
                        không còn xuất hiện trên thiệp cưới.
                        Thao tác này không có chức năng hoàn tác.
                      </p>
                    </div>
                  </div>

                  {formError && (
                    <p
                      role="alert"
                      className="mt-5 rounded-xl bg-[#FFF0F0] p-4 text-[13px] text-[#B2545A]"
                    >
                      {formError}
                    </p>
                  )}
                </div>

                <div className="flex shrink-0 justify-end gap-3 border-t border-[#E9E7DF] bg-white px-5 py-4 sm:px-7">
                  <button
                    type="button"
                    onClick={closeModal}
                    disabled={busy}
                    className={SECONDARY_BUTTON}
                  >
                    Hủy
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      void handleDelete()
                    }
                    disabled={busy}
                    className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[#B65B60] px-6 text-[13px] font-semibold text-white disabled:opacity-50"
                  >
                    {busy ? (
                      <LoaderCircle
                        size={17}
                        className="animate-spin"
                      />
                    ) : (
                      <Trash2 size={17} />
                    )}

                    {busy
                      ? "Đang xóa..."
                      : "Xác nhận xóa"}
                  </button>
                </div>
              </>
            ) : (
              <>
                {/* ADD / EDIT FORM */}

                <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-5 sm:px-7 sm:py-6">
                  {formError && (
                    <div
                      role="alert"
                      className="mb-5 flex items-start gap-2 rounded-xl border border-[#EDC5C7] bg-[#FFF0F0] p-4 text-[13px] leading-6 text-[#B2545A]"
                    >
                      <AlertCircle
                        size={17}
                        className="mt-0.5 shrink-0"
                      />
                      {formError}
                    </div>
                  )}

                  <form
                    id="story-editor-form"
                    onSubmit={handleSave}
                    className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_290px]"
                  >
                    <div className="min-w-0 space-y-5">
                      {/* DATE INPUT */}

                      <div>
                        <label className="mb-2 block text-[13px] font-medium text-[#50666E]">
                          Ngày tháng năm
                          <span className="ml-1 text-red-500">
                            *
                          </span>
                        </label>

                        <div className="mb-3 grid grid-cols-2 gap-2">
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() =>
                              setDateMode("calendar")
                            }
                            className={`rounded-xl border px-3 py-2.5 text-[12px] font-medium transition ${
                              dateMode === "calendar"
                                ? "border-[#31566B] bg-[#31566B] text-white"
                                : "border-[#DFE6E1] bg-white text-[#61726D]"
                            }`}
                          >
                            <span className="inline-flex items-center gap-2">
                              <CalendarDays size={15} />
                              Chọn lịch
                            </span>
                          </button>

                          <button
                            type="button"
                            disabled={busy}
                            onClick={() =>
                              setDateMode("manual")
                            }
                            className={`rounded-xl border px-3 py-2.5 text-[12px] font-medium transition ${
                              dateMode === "manual"
                                ? "border-[#31566B] bg-[#31566B] text-white"
                                : "border-[#DFE6E1] bg-white text-[#61726D]"
                            }`}
                          >
                            Nhập dd/mm/yyyy
                          </button>
                        </div>

                        {dateMode === "calendar" ? (
                          <input
                            type="date"
                            required
                            value={displayToCalendar(date)}
                            onChange={(event) =>
                              handleCalendarDate(
                                event.target.value
                              )
                            }
                            disabled={busy}
                            className={INPUT_STYLE}
                          />
                        ) : (
                          <input
                            type="text"
                            required
                            inputMode="numeric"
                            placeholder="dd/mm/yyyy"
                            value={date}
                            onChange={(event) =>
                              handleManualDate(
                                event.target.value
                              )
                            }
                            disabled={busy}
                            className={INPUT_STYLE}
                          />
                        )}

                        <p className="mt-2 text-[11px] text-[#829294]">
                          {date && isValidDate(date)
                            ? `Ngày đã chọn: ${date}`
                            : "Ví dụ: 26/12/2026"}
                        </p>
                      </div>

                      {/* TITLE */}

                      <div>
                        <label
                          htmlFor="story-title"
                          className="mb-2 block text-[13px] font-medium text-[#50666E]"
                        >
                          Tiêu đề
                          <span className="ml-1 text-red-500">
                            *
                          </span>
                        </label>

                        <input
                          id="story-title"
                          type="text"
                          required
                          value={title}
                          disabled={busy}
                          onChange={(event) =>
                            setTitle(
                              limitCharacters(
                                event.target.value,
                                MAX_TITLE
                              )
                            )
                          }
                          placeholder="Ví dụ: Ngày chúng mình gặp nhau"
                          className={INPUT_STYLE}
                        />

                        <p className="mt-2 text-right text-[11px] tabular-nums text-[#829294]">
                          {characterCount(title)}
                          {" / "}
                          {MAX_TITLE} ký tự
                        </p>
                      </div>

                      {/* DESCRIPTION */}

                      <div>
                        <label
                          htmlFor="story-description"
                          className="mb-2 block text-[13px] font-medium text-[#50666E]"
                        >
                          Nội dung câu chuyện
                          <span className="ml-1 text-red-500">
                            *
                          </span>
                        </label>

                        <textarea
                          id="story-description"
                          required
                          rows={8}
                          value={description}
                          disabled={busy}
                          placeholder="Viết câu chuyện của hai bạn..."
                          onChange={(event) =>
                            setDescription(
                              limitCharacters(
                                event.target.value,
                                MAX_DESCRIPTION
                              )
                            )
                          }
                          className={`${INPUT_STYLE} min-h-[185px] resize-y leading-7`}
                        />

                        <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                          <span className="text-[11px] text-[#829294]">
                            Hỗ trợ emoji, ký tự đặc biệt
                            và xuống dòng
                          </span>

                          <span className="text-[11px] tabular-nums text-[#829294]">
                            {characterCount(
                              description
                            ).toLocaleString("vi-VN")}
                            {" / "}
                            2.000 ký tự
                          </span>
                        </div>
                      </div>

                      {/* FILE INPUT */}

                      <div>
                        <label className="mb-2 block text-[13px] font-medium text-[#50666E]">
                          Ảnh kỷ niệm
                        </label>

                        <input
                          ref={fileInputRef}
                          type="file"
                          accept="image/jpeg,image/png,image/webp"
                          onChange={handleFileChange}
                          disabled={busy}
                          className="sr-only"
                          aria-label="Chọn ảnh kỷ niệm"
                        />

                        <button
                          type="button"
                          disabled={busy}
                          onClick={() =>
                            fileInputRef.current?.click()
                          }
                          className="flex min-h-[125px] w-full flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-[#C9D6D3] bg-[#F9FBF9] px-4 py-5 text-center transition hover:border-[#B8A27D] hover:bg-[#F6F5F0] disabled:opacity-50"
                        >
                          <Upload
                            size={25}
                            className="text-[#B8A27D]"
                          />

                          <span className="text-[13px] font-semibold text-[#31566B]">
                            {selectedFile
                              ? "Đổi ảnh đã chọn"
                              : modal.type === "edit"
                                ? "Chọn ảnh mới để thay thế"
                                : "Chọn ảnh từ máy tính"}
                          </span>

                          <span className="text-[11px] text-[#829294]">
                            JPG, PNG, WebP – tối đa 8 MB
                          </span>
                        </button>

                        {selectedFile && (
                          <p className="mt-3 break-all text-[12px] text-[#61726D]">
                            Đã chọn:{" "}
                            <strong>
                              {selectedFile.name}
                            </strong>
                          </p>
                        )}
                      </div>
                    </div>

                    {/* IMAGE PREVIEW */}

                    <aside className="overflow-hidden rounded-2xl border border-[#E8E3D9] bg-[#F8F8F3]">
                      <div className="relative aspect-[4/5]">
                        {imagePreview ? (
                          <Image
                            src={imagePreview}
                            alt="Xem trước ảnh kỷ niệm"
                            fill
                            unoptimized={
                              Boolean(previewUrl) ||
                              isGridFsImage(imagePreview)
                            }
                            sizes="290px"
                            className="object-cover"
                          />
                        ) : (
                          <div className="flex h-full flex-col items-center justify-center gap-3 bg-[#E9EDE5] px-4 text-center">
                            <ImagePlus
                              size={35}
                              className="text-[#B8A27D]/70"
                            />

                            <p className="text-xs text-[#829294]">
                              Chưa có ảnh kỷ niệm
                            </p>
                          </div>
                        )}
                      </div>

                      <div className="px-4 py-3 text-center">
                        <p className="text-[12px] text-[#829294]">
                          Xem trước ảnh
                        </p>

                        {modal.type === "edit" &&
                          !selectedFile && (
                            <p className="mt-1 text-[11px] text-[#A0AAAB]">
                              Không chọn ảnh mới sẽ giữ ảnh cũ
                            </p>
                          )}
                      </div>
                    </aside>
                  </form>
                </div>

                {/* FORM FOOTER */}

                <div className="flex shrink-0 flex-wrap items-center justify-end gap-3 border-t border-[#E9E7DF] bg-white px-5 py-4 sm:px-7">
                  <button
                    type="button"
                    onClick={closeModal}
                    disabled={busy}
                    className={SECONDARY_BUTTON}
                  >
                    Hủy
                  </button>

                  <button
                    type="submit"
                    form="story-editor-form"
                    disabled={busy}
                    className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[#31566B] px-6 text-[13px] font-semibold text-white transition hover:bg-[#28495C] disabled:opacity-50"
                  >
                    {busy ? (
                      <LoaderCircle
                        size={17}
                        className="animate-spin"
                      />
                    ) : (
                      <Save size={17} />
                    )}

                    {busy
                      ? "Đang lưu..."
                      : modal.type === "add"
                        ? "Thêm cột mốc"
                        : "Lưu thay đổi"}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </main>
  );
}
