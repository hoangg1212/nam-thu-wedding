
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
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Eye,
  EyeOff,
  ImageIcon,
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
// NAM & THU - GALLERY MANAGER
// FIX ESLINT - GIAI ĐOẠN 3.11
//
// GIỮ NGUYÊN:
// - Album dùng chung cho cả 3 Admin.
// - Thêm, sửa, xóa ảnh bằng popup.
// - Upload MongoDB GridFS.
// - Mô tả tối đa 5.000 ký tự.
// - Xem trước ảnh trước khi upload.
// - Ẩn / hiện ảnh.
// - Sắp xếp ảnh lên / xuống xuyên trang.
// - Phân trang 8 ảnh.
// - Thống kê toàn bộ Album.
// - Responsive desktop / mobile.
// - Khóa cuộn nền và điều khiển focus.
//
// ĐÃ SỬA:
// - Không ghi ref.current trong render.
// - Không đồng bộ currentPage bằng effect.
// - Không setState đồng bộ trong effect tải ảnh.
// - Không setState trong effect tạo preview.
// ======================================================

interface GalleryPhoto {
  id: string;
  imageUrl: string;
  alt: string;
  sortOrder: number;
  isVisible: boolean;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
}

interface ApiResult {
  success?: boolean;
  message?: string;
  photos?: GalleryPhoto[];
  photo?: GalleryPhoto;
}

type Editor =
  | {
      mode: "add";
      photoId: null;
    }
  | {
      mode: "edit";
      photoId: string;
    };

type DeleteModal = GalleryPhoto | null;

// ======================================================
// CONFIG
// ======================================================

const GALLERY_API = "/api/admin/gallery";
const UPLOAD_API = "/api/admin/gallery/upload";

const PAGE_SIZE = 8;
const MAX_IMAGE_SIZE = 8 * 1024 * 1024;
const MAX_DESCRIPTION = 5000;

const ALLOWED_MIME = [
  "image/jpeg",
  "image/png",
  "image/webp",
];

const textareaClass =
  "w-full min-h-[150px] resize-y rounded-xl border border-[#E2E6E2] bg-white px-4 py-3 text-[14px] leading-6 text-[#31566B] outline-none transition focus:border-[#B8A27D] focus:ring-4 focus:ring-[#B8A27D]/10 disabled:opacity-50";

const secondaryButtonClass =
  "inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-[#DFE6E1] bg-white px-4 text-[12px] font-medium text-[#31566B] transition hover:bg-[#F5F7F3] disabled:cursor-not-allowed disabled:opacity-40";

// ======================================================
// HELPERS
// ======================================================

function sortPhotos(
  photos: GalleryPhoto[]
): GalleryPhoto[] {
  return [...photos].sort(
    (a, b) =>
      a.sortOrder - b.sortOrder ||
      a.createdAt.localeCompare(b.createdAt) ||
      a.id.localeCompare(b.id)
  );
}

async function readApiResult(
  response: Response
): Promise<ApiResult> {
  try {
    return (await response.json()) as ApiResult;
  } catch {
    throw new Error(
      "Máy chủ trả về dữ liệu không hợp lệ."
    );
  }
}

async function sendJson(
  method: "PATCH" | "DELETE",
  body: Record<string, unknown>
): Promise<ApiResult> {
  const response = await fetch(GALLERY_API, {
    method,
    credentials: "same-origin",
    cache: "no-store",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  const result = await readApiResult(response);

  if (!response.ok || !result.success) {
    throw new Error(
      result.message || "Thao tác không thành công."
    );
  }

  return result;
}

function PhotoImage({
  src,
  alt,
  sizes,
}: {
  src: string;
  alt: string;
  sizes: string;
}) {
  return (
    <Image
      src={src}
      alt={alt || "Ảnh cưới Nam và Thư"}
      fill
      unoptimized={src.startsWith(
        "/api/gallery/image/"
      )}
      sizes={sizes}
      className="object-cover"
    />
  );
}

// ======================================================
// MAIN COMPONENT
// ======================================================

export default function GalleryManager() {
  // ==================================================
  // DATA
  // ==================================================

  const [photos, setPhotos] =
    useState<GalleryPhoto[]>([]);

  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // ==================================================
  // PAGINATION
  //
  // Toàn bộ ảnh được giữ trong state.
  // Chỉ phân trang khi hiển thị.
  // ==================================================

  const [currentPage, setCurrentPage] =
    useState(1);

  const totalPhotos = photos.length;

  const totalPages = Math.ceil(
    totalPhotos / PAGE_SIZE
  );

  // FIX ESLINT:
  // Không dùng effect để ép currentPage.
  // Tính trang hợp lệ trực tiếp từ dữ liệu.
  const safePage = Math.min(
    Math.max(1, currentPage),
    Math.max(1, totalPages)
  );

  const startIndex =
    (safePage - 1) * PAGE_SIZE;

  const paginatedPhotos = photos.slice(
    startIndex,
    startIndex + PAGE_SIZE
  );

  const firstItem =
    totalPhotos > 0 ? startIndex + 1 : 0;

  const lastItem = Math.min(
    startIndex + PAGE_SIZE,
    totalPhotos
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
  // MODAL
  // ==================================================

  const [editor, setEditor] =
    useState<Editor | null>(null);

  const [deleteModal, setDeleteModal] =
    useState<DeleteModal>(null);

  const [description, setDescription] =
    useState("");

  const [selectedFile, setSelectedFile] =
    useState<File | null>(null);

  const [previewUrl, setPreviewUrl] =
    useState("");

  // ==================================================
  // REFS
  // ==================================================

  const fileInputRef =
    useRef<HTMLInputElement>(null);

  const closeButtonRef =
    useRef<HTMLButtonElement>(null);

  const previousFocusRef =
    useRef<HTMLElement | null>(null);

  const modalRef =
    useRef<HTMLDivElement>(null);

  const busyRef = useRef(false);
  const requestVersion = useRef(0);

  // FIX ESLINT:
  // Không cập nhật busyRef.current trong render.
  // Đồng bộ ref sau khi React commit.
  useEffect(() => {
    busyRef.current = busy;
  }, [busy]);

  // ==================================================
  // PHÂN TRANG
  // ==================================================

  function goToPage(page: number) {
    if (busy || loading) return;

    setCurrentPage(
      Math.max(
        1,
        Math.min(page, Math.max(1, totalPages))
      )
    );
  }

  // ==================================================
  // LOAD PHOTOS
  // ==================================================

  const loadPhotos = useCallback(
    async (signal?: AbortSignal) => {
      const version = ++requestVersion.current;

      setLoading(true);
      setError("");

      try {
        const response = await fetch(GALLERY_API, {
          method: "GET",
          credentials: "same-origin",
          cache: "no-store",
          signal,
        });

        const result =
          await readApiResult(response);

        if (
          !response.ok ||
          !result.success ||
          !Array.isArray(result.photos)
        ) {
          throw new Error(
            result.message ||
              "Không thể tải danh sách ảnh."
          );
        }

        if (
          signal?.aborted ||
          version !== requestVersion.current
        ) {
          return;
        }

        setPhotos(sortPhotos(result.photos));
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
            : "Không thể tải dữ liệu Album."
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

  // FIX ESLINT:
  // Đưa việc gọi loadPhotos sang microtask.
  // Giữ AbortController chống request cũ.
  useEffect(() => {
    const controller = new AbortController();

    void Promise.resolve().then(() => {
      if (!controller.signal.aborted) {
        return loadPhotos(controller.signal);
      }
    });

    return () => {
      controller.abort();
    };
  }, [loadPhotos]);

  // ==================================================
  // PREVIEW URL CLEANUP
  //
  // Tạo URL ngay khi người dùng chọn file.
  // Effect chỉ có nhiệm vụ thu hồi object URL.
  // Không cập nhật React state trong effect.
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

  const modalOpen =
    editor !== null || deleteModal !== null;

  useEffect(() => {
    if (!modalOpen) return;

    const previousOverflow =
      document.body.style.overflow;

    document.body.style.overflow = "hidden";

    closeButtonRef.current?.focus();

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        if (!busyRef.current) {
          event.preventDefault();

          setEditor(null);
          setDeleteModal(null);
          setSelectedFile(null);
          setPreviewUrl("");
          setDescription("");
        }

        return;
      }

      if (event.key !== "Tab") return;

      const modal = modalRef.current;
      if (!modal) return;

      const focusableElements = Array.from(
        modal.querySelectorAll<HTMLElement>(
          'button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), a[href]'
        )
      ).filter(
        (element) =>
          element.getAttribute("tabindex") !== "-1" &&
          element.getClientRects().length > 0
      );

      if (!focusableElements.length) return;

      const first = focusableElements[0];
      const last =
        focusableElements[
          focusableElements.length - 1
        ];

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

      previousFocusRef.current?.focus();
    };
  }, [modalOpen]);

  // ==================================================
  // MODAL HELPERS
  // ==================================================

  function rememberFocus() {
    previousFocusRef.current =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
  }

  function resetEditorState() {
    setSelectedFile(null);
    setPreviewUrl("");
    setDescription("");

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }

  function openAdd() {
    if (busy || loading) return;

    rememberFocus();
    resetEditorState();

    setEditor({
      mode: "add",
      photoId: null,
    });

    setDeleteModal(null);
    setError("");
    setSuccess("");
  }

  function openEdit(photo: GalleryPhoto) {
    if (busy || loading) return;

    rememberFocus();
    resetEditorState();

    setEditor({
      mode: "edit",
      photoId: photo.id,
    });

    setDeleteModal(null);
    setDescription(photo.alt);
    setError("");
    setSuccess("");
  }

  function openDelete(photo: GalleryPhoto) {
    if (busy || loading) return;

    rememberFocus();

    setEditor(null);
    setDeleteModal(photo);
    setError("");
    setSuccess("");
  }

  function closeModal() {
    if (busy) return;

    setEditor(null);
    setDeleteModal(null);

    resetEditorState();
    setError("");
  }

  // ==================================================
  // FILE VALIDATION
  // ==================================================

  function handleFileChange(
    event: ChangeEvent<HTMLInputElement>
  ) {
    const file = event.target.files?.[0];

    if (!file) return;

    if (!ALLOWED_MIME.includes(file.type)) {
      setError(
        "Chỉ hỗ trợ ảnh JPG, PNG hoặc WebP."
      );

      event.target.value = "";
      return;
    }

    if (
      file.size === 0 ||
      file.size > MAX_IMAGE_SIZE
    ) {
      setError(
        "Dung lượng ảnh phải lớn hơn 0 và không vượt quá 8 MB."
      );

      event.target.value = "";
      return;
    }

    // FIX ESLINT:
    // Tạo URL trong event handler thay vì effect.
    // URL cũ được thu hồi bởi cleanup effect.
    const nextPreview =
      URL.createObjectURL(file);

    setSelectedFile(file);
    setPreviewUrl(nextPreview);

    setError("");
    setSuccess("");
  }

  // ==================================================
  // SAVE IMAGE
  // ==================================================

  async function handleSave(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    if (!editor || busy) return;

    const alt = description.trim();

    if (
      Array.from(alt).length > MAX_DESCRIPTION
    ) {
      setError(
        "Mô tả ảnh không được vượt quá 5.000 ký tự."
      );
      return;
    }

    if (
      editor.mode === "add" &&
      !selectedFile
    ) {
      setError(
        "Vui lòng chọn ảnh từ máy tính."
      );
      return;
    }

    setBusy(true);
    setError("");
    setSuccess("");

    try {
      if (selectedFile) {
        const formData = new FormData();

        formData.append("file", selectedFile);
        formData.append("alt", alt);

        if (editor.mode === "edit") {
          formData.append(
            "photoId",
            editor.photoId
          );
        }

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
          await readApiResult(response);

        if (!response.ok || !result.success) {
          throw new Error(
            result.message ||
              "Không thể tải ảnh lên."
          );
        }
      } else if (editor.mode === "edit") {
        // Sửa mô tả nhưng không upload lại ảnh.
        await sendJson("PATCH", {
          id: editor.photoId,
          alt,
        });
      }

      const wasAdd = editor.mode === "add";

      setEditor(null);
      resetEditorState();

      await loadPhotos();

      if (wasAdd) {
        setCurrentPage(1);
      }

      setSuccess(
        wasAdd
          ? "Đã tải ảnh lên Album thành công."
          : "Đã cập nhật ảnh thành công."
      );
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Không thể lưu thông tin ảnh."
      );
    } finally {
      setBusy(false);
    }
  }

  // ==================================================
  // TOGGLE VISIBILITY
  // ==================================================

  async function toggleVisibility(
    photo: GalleryPhoto
  ) {
    if (busy || loading) return;

    setBusy(true);
    setError("");
    setSuccess("");

    try {
      const nextVisibility = !photo.isVisible;

      await sendJson("PATCH", {
        id: photo.id,
        isVisible: nextVisibility,
      });

      setPhotos((current) =>
        current.map((item) =>
          item.id === photo.id
            ? {
                ...item,
                isVisible: nextVisibility,
              }
            : item
        )
      );

      setSuccess(
        nextVisibility
          ? "Đã bật hiển thị ảnh."
          : "Đã ẩn ảnh khỏi Album."
      );
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Không thể cập nhật trạng thái ảnh."
      );
    } finally {
      setBusy(false);
    }
  }

  // ==================================================
  // DELETE PHOTO
  // ==================================================

  async function deletePhoto() {
    if (busy || !deleteModal) return;

    setBusy(true);
    setError("");
    setSuccess("");

    try {
      await sendJson("DELETE", {
        id: deleteModal.id,
      });

      const deletedId = deleteModal.id;

      setPhotos((current) =>
        current.filter(
          (item) => item.id !== deletedId
        )
      );

      setDeleteModal(null);

      setSuccess(
        "Đã xóa ảnh khỏi Album thành công."
      );
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Không thể xóa ảnh."
      );
    } finally {
      setBusy(false);
    }
  }

  // ==================================================
  // REORDER
  //
  // Sử dụng chỉ số toàn bộ danh sách.
  // Ảnh cuối trang 1 đổi chỗ được với
  // ảnh đầu trang 2.
  // ==================================================

  async function movePhoto(
    globalIndex: number,
    direction: -1 | 1
  ) {
    if (busy || loading) return;

    const nextIndex =
      globalIndex + direction;

    if (
      nextIndex < 0 ||
      nextIndex >= photos.length
    ) {
      return;
    }

    const reordered = [...photos];

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
      await sendJson("PATCH", {
        action: "reorder",
        ids: reordered.map(
          (photo) => photo.id
        ),
      });

      setPhotos(
        reordered.map((photo, position) => ({
          ...photo,
          sortOrder: position,
        }))
      );

      setSuccess(
        "Đã cập nhật thứ tự ảnh."
      );
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Không thể sắp xếp ảnh."
      );
    } finally {
      setBusy(false);
    }
  }

  // ==================================================
  // STATISTICS
  // ==================================================

  const total = photos.length;

  const visible = photos.filter(
    (photo) => photo.isVisible
  ).length;

  const hidden = total - visible;

  const currentPhoto =
    editor?.mode === "edit"
      ? photos.find(
          (photo) =>
            photo.id === editor.photoId
        )
      : null;

  const imagePreview =
    previewUrl ||
    currentPhoto?.imageUrl ||
    "";

  // ==================================================
  // RENDER
  // ==================================================

  return (
    <main className="mx-auto w-full max-w-[1450px] px-4 py-7 text-[#31566B] sm:px-6 sm:py-9 xl:px-8">
      {/* HEADER */}

      <section className="mb-8">
        <div className="mb-3 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-[#B8A27D]">
          <Images size={16} />
          Wedding Gallery Management
        </div>

        <div className="flex flex-wrap items-end justify-between gap-4">
          <h1 className="font-wedding-serif text-[35px] leading-tight sm:text-[43px]">
            Quản lý Album ảnh
          </h1>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={busy || loading}
              onClick={() => {
                setSuccess("");
                void loadPhotos();
              }}
              className="inline-flex h-11 items-center gap-2 rounded-xl border border-[#DFE5E1] bg-white px-4 text-[13px] font-medium disabled:opacity-50"
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
              disabled={busy || loading}
              className="inline-flex h-11 items-center gap-2 rounded-xl bg-[#31566B] px-5 text-[13px] font-semibold text-white transition hover:bg-[#28495C] disabled:opacity-50"
            >
              <Plus size={17} />
              Thêm ảnh
            </button>
          </div>
        </div>
      </section>

      {/* STATISTICS */}

      <section className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-3">
        {[
          {
            title: "Tổng số ảnh",
            value: total,
            icon: Images,
            color: "text-[#B8A27D]",
          },
          {
            title: "Đang hiển thị",
            value: visible,
            icon: Eye,
            color: "text-[#568567]",
          },
          {
            title: "Đang ẩn",
            value: hidden,
            icon: EyeOff,
            color: "text-[#B08B54]",
          },
        ].map((stat) => {
          const Icon = stat.icon;

          return (
            <div
              key={stat.title}
              className="rounded-[20px] border border-[#E8E3D9] bg-white p-5 shadow-sm sm:p-6"
            >
              <Icon
                size={21}
                className={stat.color}
              />

              <p className="mt-4 text-xs text-[#87989A]">
                {stat.title}
              </p>

              <p className="mt-2 text-3xl font-semibold tabular-nums">
                {stat.value}
              </p>
            </div>
          );
        })}
      </section>

      {/* GLOBAL FEEDBACK */}

      {!modalOpen && error && (
        <div
          role="alert"
          className="mb-5 flex items-start gap-2 rounded-xl border border-[#EDC5C7] bg-[#FFF1F1] px-4 py-3 text-[13px] leading-6 text-[#B2545A]"
        >
          <AlertCircle
            size={17}
            className="mt-0.5 shrink-0"
          />
          {error}
        </div>
      )}

      {!modalOpen && success && !error && (
        <div
          role="status"
          className="mb-5 flex items-center gap-2 rounded-xl border border-[#D1E7D9] bg-[#EFF9F2] px-4 py-3 text-[13px] text-[#3D7654]"
        >
          <CheckCircle2 size={17} />
          {success}
        </div>
      )}

      {/* PHOTO LIST */}

      <section>
        <div className="mb-5 flex items-center justify-between gap-3">
          <h2 className="font-wedding-serif text-[27px]">
            Danh sách ảnh
          </h2>

          {!loading && (
            <p className="text-xs text-[#87989A]">
              {photos.length} ảnh
            </p>
          )}
        </div>

        {loading ? (
          <div className="flex min-h-[300px] items-center justify-center rounded-2xl border border-[#E8E3D9] bg-white">
            <LoaderCircle
              size={27}
              className="animate-spin text-[#31566B]"
            />
          </div>
        ) : photos.length === 0 ? (
          <div className="rounded-2xl border border-[#E8E3D9] bg-white px-5 py-16 text-center">
            <Images
              size={38}
              className="mx-auto mb-4 text-[#B8A27D]"
            />

            <p className="text-sm text-[#87989A]">
              Album chưa có ảnh nào.
            </p>

            <button
              type="button"
              onClick={openAdd}
              className="mt-5 inline-flex items-center gap-2 rounded-xl bg-[#31566B] px-5 py-3 text-[13px] text-white"
            >
              <Plus size={16} />
              Thêm ảnh đầu tiên
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 items-start gap-5 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
            {paginatedPhotos.map(
              (photo, index) => {
                const globalIndex =
                  startIndex + index;

                return (
                  <article
                    key={photo.id}
                    className="min-w-0 overflow-hidden rounded-[20px] border border-[#E8E3D9] bg-white shadow-sm"
                  >
                    {/* IMAGE */}

                    <div className="relative aspect-[4/5] overflow-hidden bg-[#F1F3EB]">
                      <PhotoImage
                        src={photo.imageUrl}
                        alt={photo.alt}
                        sizes="(max-width: 639px) 100vw, (max-width: 1279px) 50vw, 33vw"
                      />

                      <span className="absolute left-3 top-3 rounded-full bg-white/90 px-3 py-1.5 text-xs font-semibold text-[#31566B]">
                        {String(
                          globalIndex + 1
                        ).padStart(2, "0")}
                      </span>

                      <span
                        className={`absolute right-3 top-3 inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] font-medium ${
                          photo.isVisible
                            ? "bg-[#EAF6ED] text-[#568567]"
                            : "bg-[#FFF4E5] text-[#B08B54]"
                        }`}
                      >
                        {photo.isVisible ? (
                          <Eye size={13} />
                        ) : (
                          <EyeOff size={13} />
                        )}

                        {photo.isVisible
                          ? "Đang hiện"
                          : "Đang ẩn"}
                      </span>
                    </div>

                    {/* DETAILS */}

                    <div className="space-y-4 p-4 sm:p-5">
                      <p className="line-clamp-3 whitespace-pre-wrap break-words text-[13px] font-medium leading-6">
                        {photo.alt ||
                          "Chưa có mô tả"}
                      </p>

                      {/* EDIT / VISIBILITY */}

                      <div className="grid grid-cols-2 gap-2">
                        <button
                          type="button"
                          onClick={() =>
                            openEdit(photo)
                          }
                          disabled={busy}
                          className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-[#E1E6E2] bg-[#FAFBF9] px-3 text-[12px] font-medium disabled:opacity-50"
                        >
                          <Pencil size={15} />
                          Chỉnh sửa
                        </button>

                        <button
                          type="button"
                          onClick={() =>
                            void toggleVisibility(photo)
                          }
                          disabled={busy}
                          className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-[#E1E6E2] bg-[#FAFBF9] px-3 text-[12px] font-medium disabled:opacity-50"
                        >
                          {photo.isVisible ? (
                            <EyeOff size={15} />
                          ) : (
                            <Eye size={15} />
                          )}

                          {photo.isVisible
                            ? "Ẩn ảnh"
                            : "Hiện ảnh"}
                        </button>
                      </div>

                      {/* REORDER / DELETE */}

                      <div className="flex items-center justify-between gap-2 border-t border-[#EDF0EC] pt-4">
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() =>
                              void movePhoto(
                                globalIndex,
                                -1
                              )
                            }
                            disabled={
                              busy ||
                              globalIndex === 0
                            }
                            aria-label={`Đưa ảnh ${globalIndex + 1} lên`}
                            className="flex h-10 w-10 items-center justify-center rounded-xl border border-[#E1E6E2] disabled:opacity-30"
                          >
                            <ArrowUp size={17} />
                          </button>

                          <button
                            type="button"
                            onClick={() =>
                              void movePhoto(
                                globalIndex,
                                1
                              )
                            }
                            disabled={
                              busy ||
                              globalIndex ===
                                photos.length - 1
                            }
                            aria-label={`Đưa ảnh ${globalIndex + 1} xuống`}
                            className="flex h-10 w-10 items-center justify-center rounded-xl border border-[#E1E6E2] disabled:opacity-30"
                          >
                            <ArrowDown size={17} />
                          </button>
                        </div>

                        <button
                          type="button"
                          onClick={() =>
                            openDelete(photo)
                          }
                          disabled={busy}
                          className="inline-flex h-10 items-center gap-2 rounded-xl border border-[#F1DADC] bg-[#FFF7F7] px-3 text-[12px] text-[#B65B60] disabled:opacity-50"
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

        {!loading && totalPhotos > 0 && (
          <div className="mt-8 flex flex-col items-center justify-between gap-4 rounded-[18px] border border-[#E8E3D9] bg-white px-4 py-5 sm:flex-row sm:px-5">
            <p className="text-center text-[12px] text-[#829294] sm:text-left">
              Hiển thị{" "}
              <strong>{firstItem}</strong>
              {" – "}
              <strong>{lastItem}</strong>
              {" / "}
              <strong>{totalPhotos}</strong>
              {" "}ảnh
            </p>

            {totalPages > 1 && (
              <nav
                aria-label="Phân trang Album ảnh"
                className="flex flex-wrap items-center justify-center gap-2"
              >
                <button
                  type="button"
                  disabled={
                    safePage <= 1 ||
                    busy ||
                    loading
                  }
                  onClick={() =>
                    goToPage(safePage - 1)
                  }
                  className={secondaryButtonClass}
                >
                  <ChevronLeft size={16} />
                  Trước
                </button>

                {pageNumbers.map(
                  (pageNumber) => (
                    <button
                      key={pageNumber}
                      type="button"
                      disabled={busy || loading}
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
                          : "h-10 min-w-10 rounded-xl border border-[#DFE6E1] bg-white px-3 text-[12px] text-[#31566B] transition hover:bg-[#F5F7F3]"
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
                    busy ||
                    loading
                  }
                  onClick={() =>
                    goToPage(safePage + 1)
                  }
                  className={secondaryButtonClass}
                >
                  Sau
                  <ChevronRight size={16} />
                </button>
              </nav>
            )}
          </div>
        )}
      </section>

      {/* ADD / EDIT MODAL */}

      {editor && (
        <div
          className="fixed inset-0 z-[9999] flex items-center justify-center bg-[#101B21]/65 p-3 backdrop-blur-[5px] sm:p-5"
          onMouseDown={(event) => {
            if (
              event.target === event.currentTarget &&
              !busyRef.current
            ) {
              closeModal();
            }
          }}
        >
          <section
            ref={modalRef}
            id="gallery-editor-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="gallery-modal-title"
            className="flex max-h-[min(92dvh,850px)] w-full max-w-[920px] flex-col overflow-hidden rounded-[22px] border border-[#E7E2D9] bg-[#FFFDF9] shadow-[0_30px_100px_rgba(0,0,0,0.25)] sm:rounded-[26px]"
          >
            {/* HEADER */}

            <div className="flex shrink-0 items-center justify-between gap-4 border-b border-[#E9E7DF] bg-white px-5 py-4 sm:px-7 sm:py-5">
              <div>
                <p className="mb-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-[#B8A27D]">
                  Wedding Gallery
                </p>

                <h2
                  id="gallery-modal-title"
                  className="font-wedding-serif text-[26px] text-[#31566B] sm:text-[30px]"
                >
                  {editor.mode === "add"
                    ? "Thêm ảnh mới"
                    : "Chỉnh sửa ảnh"}
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

            {/* BODY */}

            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-5 sm:px-7 sm:py-6">
              {error && (
                <div
                  role="alert"
                  className="mb-5 flex items-start gap-2 rounded-xl border border-[#EDC5C7] bg-[#FFF1F1] px-4 py-3 text-[13px] leading-6 text-[#B2545A]"
                >
                  <AlertCircle
                    size={17}
                    className="mt-0.5 shrink-0"
                  />
                  {error}
                </div>
              )}

              <form
                id="gallery-editor-form"
                onSubmit={handleSave}
                className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_290px]"
              >
                <div className="min-w-0 space-y-6">
                  {/* UPLOAD INPUT */}

                  <div>
                    <label
                      htmlFor="gallery-file-input"
                      className="mb-2 block text-[13px] font-medium text-[#50666E]"
                    >
                      {editor.mode === "add"
                        ? "Chọn ảnh từ máy tính"
                        : "Thay thế ảnh (không bắt buộc)"}
                    </label>

                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      disabled={busy}
                      onChange={handleFileChange}
                      className="sr-only"
                      id="gallery-file-input"
                    />

                    <button
                      type="button"
                      onClick={() =>
                        fileInputRef.current?.click()
                      }
                      disabled={busy}
                      className="flex min-h-[135px] w-full flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed border-[#C9D6D3] bg-[#F9FBF9] px-4 py-5 text-center transition hover:border-[#B8A27D] hover:bg-[#F6F5F0] disabled:opacity-50"
                    >
                      <Upload
                        size={28}
                        className="text-[#B8A27D]"
                      />

                      <span className="text-sm font-semibold text-[#31566B]">
                        {selectedFile
                          ? "Đổi ảnh đã chọn"
                          : "Chọn ảnh để tải lên"}
                      </span>

                      <span className="text-xs text-[#87989A]">
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

                  {/* DESCRIPTION */}

                  <div>
                    <label
                      htmlFor="gallery-description"
                      className="mb-2 block text-[13px] font-medium text-[#50666E]"
                    >
                      Mô tả ảnh
                    </label>

                    <textarea
                      id="gallery-description"
                      rows={6}
                      value={description}
                      disabled={busy}
                      placeholder="Nhập mô tả ảnh..."
                      onChange={(event) =>
                        setDescription(
                          event.target.value
                        )
                      }
                      className={textareaClass}
                    />

                    <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                      <span className="text-xs text-[#87989A]">
                        Hỗ trợ tiếng Việt, emoji và ký tự đặc biệt
                      </span>

                      <span
                        className={`text-xs tabular-nums ${
                          Array.from(description).length >
                          MAX_DESCRIPTION
                            ? "font-semibold text-red-600"
                            : "text-[#87989A]"
                        }`}
                      >
                        {Array.from(
                          description
                        ).length.toLocaleString("vi-VN")}
                        {" / "}
                        {MAX_DESCRIPTION.toLocaleString(
                          "vi-VN"
                        )}
                      </span>
                    </div>
                  </div>
                </div>

                {/* IMAGE PREVIEW */}

                <aside className="overflow-hidden rounded-2xl border border-[#E8E3D9] bg-[#F8F8F3]">
                  <div className="relative aspect-[4/5]">
                    {imagePreview ? (
                      previewUrl ? (
                        <Image
                          src={previewUrl}
                          alt="Xem trước ảnh đã chọn"
                          fill
                          unoptimized
                          sizes="290px"
                          className="object-cover"
                        />
                      ) : (
                        <PhotoImage
                          src={imagePreview}
                          alt={description}
                          sizes="290px"
                        />
                      )
                    ) : (
                      <div className="flex h-full flex-col items-center justify-center gap-3 px-4 text-center text-[#9AA7A7]">
                        <ImageIcon size={35} />
                        <p className="text-xs">
                          Chọn ảnh để xem trước
                        </p>
                      </div>
                    )}
                  </div>

                  <p className="px-4 py-3 text-center text-xs text-[#87989A]">
                    Xem trước ảnh
                  </p>
                </aside>
              </form>
            </div>

            {/* FOOTER */}

            <div className="flex shrink-0 flex-wrap items-center justify-end gap-3 border-t border-[#E9E7DF] bg-white px-5 py-4 sm:px-7">
              <button
                type="button"
                onClick={closeModal}
                disabled={busy}
                className="inline-flex h-11 items-center justify-center rounded-xl border border-[#DFE5E1] bg-white px-5 text-[13px] font-medium text-[#61726D] transition hover:bg-[#F7F8F5] disabled:opacity-50"
              >
                Hủy
              </button>

              <button
                type="submit"
                form="gallery-editor-form"
                disabled={busy}
                className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-[#31566B] px-6 text-[13px] font-semibold text-white transition hover:bg-[#28495C] disabled:opacity-50"
              >
                {busy ? (
                  <LoaderCircle
                    size={17}
                    className="animate-spin"
                  />
                ) : selectedFile ? (
                  <Upload size={17} />
                ) : (
                  <Save size={17} />
                )}

                {busy
                  ? "Đang xử lý..."
                  : editor.mode === "add"
                    ? "Tải ảnh lên Album"
                    : "Lưu thay đổi"}
              </button>
            </div>
          </section>
        </div>
      )}

      {/* DELETE CONFIRMATION */}

      {deleteModal && (
        <div
          className="fixed inset-0 z-[9999] flex items-center justify-center bg-[#101B21]/65 p-3 backdrop-blur-[5px] sm:p-5"
          onMouseDown={(event) => {
            if (
              event.target === event.currentTarget &&
              !busyRef.current
            ) {
              closeModal();
            }
          }}
        >
          <section
            ref={modalRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="gallery-delete-title"
            className="flex w-full max-w-[480px] flex-col overflow-hidden rounded-[22px] border border-[#E7E2D9] bg-[#FFFDF9] shadow-[0_30px_100px_rgba(0,0,0,0.25)]"
          >
            <div className="flex items-center justify-between gap-3 border-b border-[#E9E7DF] bg-white px-5 py-4">
              <h2
                id="gallery-delete-title"
                className="font-wedding-serif text-[25px] text-[#31566B]"
              >
                Xác nhận xóa ảnh
              </h2>

              <button
                ref={closeButtonRef}
                type="button"
                disabled={busy}
                onClick={closeModal}
                aria-label="Đóng cửa sổ"
                className="flex h-10 w-10 items-center justify-center rounded-full border border-[#E5E8E5] text-[#61726D] disabled:opacity-50"
              >
                <X size={19} />
              </button>
            </div>

            <div className="space-y-4 px-5 py-6">
              <div className="flex items-start gap-3">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[#FFF0F0] text-[#B65B60]">
                  <Trash2 size={22} />
                </div>

                <div>
                  <p className="text-[14px] font-semibold text-[#31566B]">
                    Bạn có chắc muốn xóa ảnh này?
                  </p>

                  <p className="mt-2 text-[13px] leading-6 text-[#829294]">
                    Ảnh sẽ bị xóa khỏi Album.
                    Thao tác không có chức năng
                    hoàn tác trong giao diện.
                  </p>
                </div>
              </div>

              <div className="mx-auto w-full max-w-[180px]">
                <div className="relative aspect-[4/5] overflow-hidden rounded-xl bg-[#F1F3EB]">
                  <PhotoImage
                    src={deleteModal.imageUrl}
                    alt={deleteModal.alt}
                    sizes="180px"
                  />
                </div>
              </div>

              {deleteModal.alt && (
                <p className="line-clamp-3 break-words text-center text-[12px] leading-5 text-[#61726D]">
                  {deleteModal.alt}
                </p>
              )}

              {error && (
                <div
                  role="alert"
                  className="rounded-xl border border-[#EDC5C7] bg-[#FFF1F1] px-4 py-3 text-[12px] text-[#B2545A]"
                >
                  {error}
                </div>
              )}
            </div>

            <div className="flex justify-end gap-3 border-t border-[#E9E7DF] bg-white px-5 py-4">
              <button
                type="button"
                disabled={busy}
                onClick={closeModal}
                className={secondaryButtonClass}
              >
                Hủy
              </button>

              <button
                type="button"
                disabled={busy}
                onClick={() =>
                  void deletePhoto()
                }
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
          </section>
        </div>
      )}
    </main>
  );
}
