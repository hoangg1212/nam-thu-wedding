
"use client";

import {
  useCallback,
  useEffect,
  useState,
  type ChangeEvent,
  type FormEvent,
} from "react";

import { useRouter } from "next/navigation";

import {
  CheckCircle2,
  Eye,
  EyeOff,
  ImagePlus,
  LoaderCircle,
  LockKeyhole,
  Pencil,
  Save,
  Trash2,
  UserRound,
} from "lucide-react";

// ======================================================
// NAM & THU - PERSONAL ACCOUNT PROFILE
//
// FIX ESLINT:
// - Tránh cập nhật state đồng bộ khi effect chạy.
// - Giữ AbortController cho yêu cầu tải hồ sơ.
//
// GIỮ NGUYÊN:
// - Xem thông tin tài khoản.
// - Chỉnh sửa hồ sơ cá nhân.
// - Đổi tên đăng nhập và mật khẩu.
// - Tải và tự động tối ưu avatar.
// - Lưu thông tin qua MongoDB API.
// - Yêu cầu đăng nhập lại khi cần.
// ======================================================

// ======================================================
// TYPES
// ======================================================

interface Profile {
  id: string;
  username: string;
  role:
    | "super_admin"
    | "groom_admin"
    | "bride_admin";
  isActive: boolean;
  fullName: string;
  dateOfBirth: string;
  email: string;
  avatarDataUrl: string | null;
  hasPassword: boolean;
}

interface ApiResult {
  success?: boolean;
  message?: string;
  profile?: Profile | null;
  requiresLogin?: boolean;
}

type ProfileTab = "view" | "edit";

// ======================================================
// CONFIG
// ======================================================

const PROFILE_API = "/api/admin/profile";

// Giới hạn API hiện tại là 250 KB.
// Chừa khoảng dự phòng trước khi mã hóa Data URL.
const MAX_AVATAR_BYTES = 230 * 1024;
const MAX_AVATAR_DIMENSION = 1200;

const inputClass =
  "h-12 w-full rounded-xl border border-[#DFE6E2] bg-white px-4 text-sm text-[#31566B] outline-none transition focus:border-[#B8A27D] focus:ring-4 focus:ring-[#B8A27D]/10 disabled:opacity-60";

const labelClass =
  "mb-2 block text-[13px] font-medium text-[#425C69]";

// ======================================================
// DISPLAY HELPERS
// ======================================================

function roleLabel(role: Profile["role"]) {
  switch (role) {
    case "super_admin":
      return "Super Admin";
    case "groom_admin":
      return "Admin Nhà trai";
    case "bride_admin":
      return "Admin Nhà gái";
  }
}

function dateLabel(value: string) {
  if (!value) return "Chưa cập nhật";

  const [year, month, day] = value.split("-");
  return `${day}/${month}/${year}`;
}

function emptyLabel(value: string) {
  return value || "Chưa cập nhật";
}

function formatBytes(bytes: number) {
  if (bytes < 1024) {
    return `${bytes} B`;
  }

  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }

  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
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

// ======================================================
// IMAGE HELPERS
// ======================================================

// Chuyển Blob thành Data URL để gửi qua API.
function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => {
      if (typeof reader.result === "string") {
        resolve(reader.result);
      } else {
        reject(
          new Error(
            "Không thể chuyển đổi dữ liệu ảnh."
          )
        );
      }
    };

    reader.onerror = () => {
      reject(
        new Error("Không thể đọc dữ liệu ảnh.")
      );
    };

    reader.readAsDataURL(blob);
  });
}

// Đọc ảnh bằng trình duyệt, thu hồi object URL
// sau khi tải thành công hoặc gặp lỗi.
function loadImage(
  file: File
): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const image = new Image();

    image.onload = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(image);
    };

    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);

      reject(
        new Error(
          "Trình duyệt không đọc được định dạng ảnh này. Vui lòng chọn ảnh JPG, PNG hoặc WebP."
        )
      );
    };

    image.src = objectUrl;
  });
}

function canvasToBlob(
  canvas: HTMLCanvasElement,
  quality: number
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) {
          resolve(blob);
        } else {
          reject(
            new Error(
              "Không thể tối ưu ảnh đại diện."
            )
          );
        }
      },
      "image/jpeg",
      quality
    );
  });
}

// ======================================================
// AUTO OPTIMIZE AVATAR
//
// Quy trình:
// 1. Đọc ảnh gốc.
// 2. Thu nhỏ tối đa 1200px.
// 3. Chuyển sang JPEG.
// 4. Giảm chất lượng / độ phân giải nếu cần.
// 5. Trả về Data URL phù hợp giới hạn API.
// ======================================================

async function optimizeAvatar(
  file: File
): Promise<string> {
  if (!file.type.startsWith("image/")) {
    throw new Error(
      "Vui lòng chọn một tệp hình ảnh."
    );
  }

  const image = await loadImage(file);

  const originalWidth = image.naturalWidth;
  const originalHeight = image.naturalHeight;

  if (
    originalWidth <= 0 ||
    originalHeight <= 0
  ) {
    throw new Error(
      "Không xác định được kích thước ảnh."
    );
  }

  const scale = Math.min(
    1,
    MAX_AVATAR_DIMENSION /
      Math.max(originalWidth, originalHeight)
  );

  let width = Math.max(
    1,
    Math.round(originalWidth * scale)
  );

  let height = Math.max(
    1,
    Math.round(originalHeight * scale)
  );

  const canvas = document.createElement("canvas");

  const context = canvas.getContext("2d", {
    alpha: false,
  });

  if (!context) {
    throw new Error(
      "Trình duyệt không hỗ trợ xử lý ảnh."
    );
  }

  const qualities = [
    0.88,
    0.78,
    0.68,
    0.58,
    0.48,
    0.38,
  ];

  for (let attempt = 0; attempt < 9; attempt++) {
    canvas.width = width;
    canvas.height = height;

    // Giữ nền trắng khi chuyển ảnh có nền
    // trong suốt sang định dạng JPEG.
    context.fillStyle = "#FFFFFF";
    context.fillRect(0, 0, width, height);

    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = "high";
    context.drawImage(image, 0, 0, width, height);

    for (const quality of qualities) {
      const blob = await canvasToBlob(
        canvas,
        quality
      );

      if (blob.size <= MAX_AVATAR_BYTES) {
        return blobToDataUrl(blob);
      }
    }

    width = Math.max(
      64,
      Math.round(width * 0.75)
    );

    height = Math.max(
      64,
      Math.round(height * 0.75)
    );
  }

  throw new Error(
    "Không thể tối ưu ảnh này. Vui lòng thử một ảnh khác."
  );
}

// ======================================================
// MAIN COMPONENT
// ======================================================

export default function AccountProfile() {
  const router = useRouter();

  // ==================================================
  // PROFILE DATA
  // ==================================================

  const [profile, setProfile] =
    useState<Profile | null>(null);

  const [tab, setTab] =
    useState<ProfileTab>("view");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [processingAvatar, setProcessingAvatar] =
    useState(false);

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // ==================================================
  // PROFILE FORM
  // ==================================================

  const [fullName, setFullName] = useState("");
  const [dateOfBirth, setDateOfBirth] =
    useState("");
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");

  const [avatar, setAvatar] =
    useState<string | null>(null);

  const [avatarMessage, setAvatarMessage] =
    useState("");

  // ==================================================
  // PASSWORD FORM
  // ==================================================

  const [currentPassword, setCurrentPassword] =
    useState("");

  const [newPassword, setNewPassword] =
    useState("");

  const [confirmPassword, setConfirmPassword] =
    useState("");

  const [showPasswords, setShowPasswords] =
    useState(false);

  // ==================================================
  // POPULATE FORM
  //
  // Chỉ được gọi khi nhận dữ liệu API hoặc
  // khi người dùng chủ động hủy chỉnh sửa.
  // ==================================================

  const populateForm = useCallback(
    (item: Profile) => {
      setFullName(item.fullName || "");
      setDateOfBirth(item.dateOfBirth || "");
      setEmail(item.email || "");
      setUsername(item.username);
      setAvatar(item.avatarDataUrl || null);
      setAvatarMessage("");

      // Không giữ mật khẩu cũ trong form.
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    },
    []
  );

  // ==================================================
  // LOAD PROFILE
  // ==================================================

  const loadProfile = useCallback(
    async (signal?: AbortSignal) => {
      if (signal?.aborted) return;

      setLoading(true);
      setError("");

      try {
        const response = await fetch(
          PROFILE_API,
          {
            method: "GET",
            credentials: "same-origin",
            cache: "no-store",
            signal,
          }
        );

        const result =
          await readApiResult(response);

        if (
          !response.ok ||
          !result.success ||
          !result.profile
        ) {
          throw new Error(
            result.message ||
              "Không thể tải hồ sơ."
          );
        }

        if (signal?.aborted) return;

        setProfile(result.profile);
        populateForm(result.profile);
      } catch (caught) {
        if (signal?.aborted) return;

        setError(
          caught instanceof Error
            ? caught.message
            : "Không thể tải hồ sơ."
        );
      } finally {
        if (!signal?.aborted) {
          setLoading(false);
        }
      }
    },
    [populateForm]
  );

  // ==================================================
  // FIX ESLINT: react-hooks/set-state-in-effect
  //
  // Trước đây effect gọi loadProfile() trực tiếp.
  // Hàm này lại gọi setLoading(true) đồng bộ.
  //
  // Chuyển sang microtask để tránh cập nhật
  // state đồng bộ trong quá trình chạy effect.
  //
  // Giữ AbortController cho Strict Mode và
  // khi component bị unmount.
  // ==================================================

  useEffect(() => {
    const controller = new AbortController();

    void Promise.resolve().then(() => {
      if (controller.signal.aborted) return;

      return loadProfile(controller.signal);
    });

    return () => {
      controller.abort();
    };
  }, [loadProfile]);

  // ==================================================
  // AVATAR UPLOAD
  // ==================================================

  async function handleAvatar(
    event: ChangeEvent<HTMLInputElement>
  ) {
    const file = event.target.files?.[0];

    if (!file) return;

    // Cho phép chọn lại cùng tệp khi cần.
    event.target.value = "";

    if (saving || processingAvatar) return;

    setError("");
    setSuccess("");
    setAvatarMessage("");
    setProcessingAvatar(true);

    try {
      const optimized = await optimizeAvatar(file);

      // Chỉ lưu vào state, chưa gửi MongoDB.
      setAvatar(optimized);

      setAvatarMessage(
        `Đã tải và tối ưu ảnh "${file.name}" (${formatBytes(file.size)}). Nhấn Lưu thay đổi để cập nhật.`
      );
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Không thể xử lý ảnh đại diện."
      );
    } finally {
      setProcessingAvatar(false);
    }
  }

  // ==================================================
  // PASSWORD VALIDATION
  // ==================================================

  function validatePassword() {
    if (!newPassword) {
      // Không nhập mật khẩu mới thì giữ nguyên.
      return "";
    }

    if (Array.from(newPassword).length < 8) {
      return "Mật khẩu mới phải có ít nhất 8 ký tự.";
    }

    if (!/[A-Za-z]/.test(newPassword)) {
      return "Mật khẩu mới phải có chữ cái.";
    }

    if (!/[0-9]/.test(newPassword)) {
      return "Mật khẩu mới phải có chữ số.";
    }

    if (!/[^A-Za-z0-9\s]/.test(newPassword)) {
      return "Mật khẩu mới phải có ký tự đặc biệt.";
    }

    if (newPassword !== confirmPassword) {
      return "Mật khẩu xác nhận không khớp.";
    }

    return "";
  }

  // ==================================================
  // SAVE PROFILE
  // ==================================================

  async function handleSave(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    if (
      saving ||
      processingAvatar ||
      !profile
    ) {
      return;
    }

    const normalizedUsername = username
      .trim()
      .toLowerCase();

    if (
      !/^[a-z0-9_.-]{3,50}$/.test(
        normalizedUsername
      )
    ) {
      setError(
        "Tên đăng nhập phải có 3–50 ký tự hợp lệ."
      );
      return;
    }

    if (!currentPassword) {
      setError(
        "Vui lòng nhập mật khẩu hiện tại để xác nhận."
      );
      return;
    }

    const validation = validatePassword();

    if (validation) {
      setError(validation);
      return;
    }

    setSaving(true);
    setError("");
    setSuccess("");

    try {
      const response = await fetch(
        PROFILE_API,
        {
          method: "PATCH",
          credentials: "same-origin",
          cache: "no-store",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            fullName,
            dateOfBirth,
            email,
            username: normalizedUsername,
            avatarDataUrl: avatar,
            currentPassword,
            newPassword,
          }),
        }
      );

      const result =
        await readApiResult(response);

      if (!response.ok || !result.success) {
        throw new Error(
          result.message ||
            "Không thể lưu hồ sơ."
        );
      }

      // Xóa thông tin mật khẩu sau khi lưu.
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");

      if (result.requiresLogin) {
        router.replace("/admin/login");
        router.refresh();
        return;
      }

      if (result.profile) {
        setProfile(result.profile);
        populateForm(result.profile);
      }

      setTab("view");

      setSuccess(
        result.message ||
          "Cập nhật hồ sơ thành công."
      );

      // Cập nhật dữ liệu AdminShell.
      router.refresh();
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Không thể cập nhật hồ sơ."
      );
    } finally {
      setSaving(false);
    }
  }

  // ==================================================
  // LOADING UI
  // ==================================================

  if (loading) {
    return (
      <div className="rounded-2xl border border-[#E5E9E5] bg-white p-10 text-center text-sm text-[#71858B]">
        <LoaderCircle
          size={24}
          className="mx-auto mb-3 animate-spin"
        />
        Đang tải thông tin tài khoản...
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="rounded-2xl border border-[#EDC5C7] bg-white p-6">
        <p className="text-sm text-[#B2545A]">
          {error || "Không tìm thấy hồ sơ."}
        </p>

        <button
          type="button"
          onClick={() => {
            void loadProfile();
          }}
          className="mt-4 text-sm underline"
        >
          Tải lại
        </button>
      </div>
    );
  }

  // ==================================================
  // MAIN UI
  // ==================================================

  return (
    <section className="rounded-[24px] border border-[#E7E1D8] bg-white/90 p-5 shadow-sm sm:p-8">
      {/* HEADER */}

      <div className="mb-6 flex flex-col gap-5 border-b border-[#EEE9E2] pb-6 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          {/* AVATAR HIỆN TẠI */}

          <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-full border border-[#E6D9CB] bg-[#F8ECEC]">
            {profile.avatarDataUrl ? (
              // Dùng img cho Data URL trong hồ sơ nội bộ.
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={profile.avatarDataUrl}
                alt="Ảnh đại diện tài khoản"
                className="h-full w-full object-cover"
              />
            ) : (
              <UserRound
                size={29}
                className="text-[#C98792]"
              />
            )}
          </div>

          <div>
            <h2 className="text-lg font-semibold">
              {profile.fullName ||
                profile.username}
            </h2>

            <p className="mt-1 text-xs text-[#839397]">
              {roleLabel(profile.role)}
            </p>
          </div>
        </div>

        {/* CHUYỂN XEM / SỬA */}

        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => {
              if (saving || processingAvatar) {
                return;
              }

              setTab("view");
              setError("");
              populateForm(profile);
            }}
            disabled={saving || processingAvatar}
            className={
              tab === "view"
                ? "inline-flex items-center gap-2 rounded-xl bg-[#31566B] px-5 py-3 text-sm text-white"
                : "inline-flex items-center gap-2 rounded-xl border border-[#E2E8E4] px-5 py-3 text-sm disabled:opacity-50"
            }
          >
            <Eye size={17} />
            Xem
          </button>

          <button
            type="button"
            disabled={saving || processingAvatar}
            onClick={() => {
              setTab("edit");
              setError("");
              setSuccess("");
            }}
            className={
              tab === "edit"
                ? "inline-flex items-center gap-2 rounded-xl bg-[#31566B] px-5 py-3 text-sm text-white"
                : "inline-flex items-center gap-2 rounded-xl border border-[#E2E8E4] px-5 py-3 text-sm disabled:opacity-50"
            }
          >
            <Pencil size={17} />
            Sửa
          </button>
        </div>
      </div>

      {/* SUCCESS / ERROR */}

      {success && (
        <div
          role="status"
          className="mb-6 flex items-start gap-2 rounded-xl bg-[#EDF8F0] p-4 text-sm text-[#3E7952]"
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
          className="mb-6 rounded-xl border border-[#EDC5C7] bg-[#FFF1F1] p-4 text-sm text-[#B2545A]"
        >
          {error}
        </div>
      )}

      {/* VIEW MODE */}

      {tab === "view" ? (
        <div className="grid gap-5 sm:grid-cols-2">
          {[
            [
              "Họ và tên",
              emptyLabel(profile.fullName),
            ],
            [
              "Ngày sinh",
              dateLabel(profile.dateOfBirth),
            ],
            [
              "Email",
              emptyLabel(profile.email),
            ],
            [
              "Tên đăng nhập",
              profile.username,
            ],
            [
              "Mật khẩu",
              "•••••••• (đã thiết lập)",
            ],
            [
              "Vai trò",
              roleLabel(profile.role),
            ],
          ].map(([label, value]) => (
            <div
              key={label}
              className="rounded-xl bg-[#F9F8F5] p-4"
            >
              <p className="mb-2 text-xs text-[#8A999B]">
                {label}
              </p>

              <p className="break-words text-sm font-medium">
                {value}
              </p>
            </div>
          ))}

          <p className="text-xs leading-6 text-[#849396] sm:col-span-2">
            Mật khẩu thật không được hiển thị
            vì đã được mã hóa bằng Argon2id.
            Chọn Sửa để đổi mật khẩu khi cần.
          </p>
        </div>
      ) : (
        // ==================================================
        // EDIT MODE
        // ==================================================

        <form
          onSubmit={handleSave}
          className="space-y-6"
        >
          {/* AVATAR UPLOAD */}

          <div>
            <label className={labelClass}>
              Ảnh đại diện
            </label>

            <div className="flex flex-wrap items-center gap-4">
              {/* AVATAR PREVIEW */}

              <div className="flex h-24 w-24 shrink-0 items-center justify-center overflow-hidden rounded-full border border-[#E6D9CB] bg-[#F8ECEC]">
                {avatar ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={avatar}
                    alt="Xem trước avatar"
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <UserRound
                    size={34}
                    className="text-[#C98792]"
                  />
                )}
              </div>

              <div className="space-y-3">
                <div className="flex flex-wrap items-center gap-2">
                  {/* CHỌN ẢNH */}

                  <label
                    className={`inline-flex items-center justify-center gap-2 rounded-xl border border-[#DCE5E1] bg-white px-4 py-2.5 text-sm font-medium transition ${
                      processingAvatar
                        ? "cursor-wait opacity-60"
                        : "cursor-pointer hover:bg-[#F6F8F5]"
                    }`}
                  >
                    {processingAvatar ? (
                      <LoaderCircle
                        size={17}
                        className="animate-spin"
                      />
                    ) : (
                      <ImagePlus size={17} />
                    )}

                    {processingAvatar
                      ? "Đang tối ưu ảnh..."
                      : "Tải ảnh lên"}

                    <input
                      type="file"
                      accept="image/*"
                      disabled={
                        processingAvatar || saving
                      }
                      onChange={(event) => {
                        void handleAvatar(event);
                      }}
                      className="sr-only"
                    />
                  </label>

                  {/* XÓA AVATAR */}

                  {avatar && (
                    <button
                      type="button"
                      disabled={
                        saving || processingAvatar
                      }
                      onClick={() => {
                        setAvatar(null);
                        setAvatarMessage(
                          "Đã chọn xóa ảnh đại diện. Nhấn Lưu thay đổi để xác nhận."
                        );
                      }}
                      className="inline-flex items-center gap-1.5 rounded-xl border border-[#F0D7D7] bg-white px-4 py-2.5 text-sm text-[#B2545A] transition hover:bg-[#FFF5F5] disabled:opacity-50"
                    >
                      <Trash2 size={16} />
                      Xóa ảnh
                    </button>
                  )}
                </div>

                <p className="text-xs leading-5 text-[#849396]">
                  Chọn ảnh bình thường, hệ thống
                  sẽ tự tối ưu dung lượng và kích thước.
                  Không cần nén trước.
                </p>
              </div>
            </div>

            {avatarMessage && (
              <p
                role="status"
                className="mt-4 rounded-xl bg-[#EDF8F0] px-4 py-3 text-xs leading-6 text-[#3E7952]"
              >
                <CheckCircle2
                  size={15}
                  className="mr-2 inline-block align-middle"
                />
                {avatarMessage}
              </p>
            )}
          </div>

          {/* PERSONAL INFORMATION */}

          <div className="grid gap-5 sm:grid-cols-2">
            <div>
              <label
                htmlFor="profile-full-name"
                className={labelClass}
              >
                Họ và tên
              </label>

              <input
                id="profile-full-name"
                className={inputClass}
                value={fullName}
                maxLength={100}
                disabled={saving}
                onChange={(event) =>
                  setFullName(event.target.value)
                }
                placeholder="Nhập họ tên"
              />
            </div>

            <div>
              <label
                htmlFor="profile-birthday"
                className={labelClass}
              >
                Ngày sinh
              </label>

              <input
                id="profile-birthday"
                type="date"
                className={inputClass}
                value={dateOfBirth}
                disabled={saving}
                max={new Date()
                  .toISOString()
                  .slice(0, 10)}
                onChange={(event) =>
                  setDateOfBirth(event.target.value)
                }
              />
            </div>

            <div>
              <label
                htmlFor="profile-email"
                className={labelClass}
              >
                Email
              </label>

              <input
                id="profile-email"
                type="email"
                maxLength={254}
                className={inputClass}
                value={email}
                disabled={saving}
                onChange={(event) =>
                  setEmail(event.target.value)
                }
                placeholder="example@gmail.com"
              />
            </div>

            <div>
              <label
                htmlFor="profile-username"
                className={labelClass}
              >
                Tài khoản đăng nhập
              </label>

              <input
                id="profile-username"
                className={inputClass}
                required
                minLength={3}
                maxLength={50}
                autoCapitalize="none"
                spellCheck={false}
                disabled={saving}
                value={username}
                onChange={(event) =>
                  setUsername(event.target.value)
                }
                placeholder="Tên đăng nhập"
              />
            </div>
          </div>

          {/* SECURITY */}

          <div className="rounded-xl border border-[#E8E6DF] bg-[#FAF9F5] p-5">
            <div className="mb-5 flex items-center gap-2">
              <LockKeyhole
                size={18}
                className="text-[#B8A27D]"
              />

              <h3 className="text-sm font-semibold">
                Bảo mật tài khoản
              </h3>
            </div>

            <div className="space-y-4">
              {/* CURRENT PASSWORD */}

              <div>
                <label
                  htmlFor="profile-current-password"
                  className={labelClass}
                >
                  Mật khẩu hiện tại *
                </label>

                <input
                  id="profile-current-password"
                  type={
                    showPasswords
                      ? "text"
                      : "password"
                  }
                  autoComplete="current-password"
                  required
                  disabled={saving}
                  className={inputClass}
                  value={currentPassword}
                  onChange={(event) =>
                    setCurrentPassword(
                      event.target.value
                    )
                  }
                  placeholder="Nhập mật khẩu hiện tại"
                />
              </div>

              {/* NEW PASSWORD */}

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label
                    htmlFor="profile-new-password"
                    className={labelClass}
                  >
                    Mật khẩu mới
                  </label>

                  <input
                    id="profile-new-password"
                    type={
                      showPasswords
                        ? "text"
                        : "password"
                    }
                    autoComplete="new-password"
                    disabled={saving}
                    className={inputClass}
                    value={newPassword}
                    onChange={(event) =>
                      setNewPassword(
                        event.target.value
                      )
                    }
                    placeholder="Để trống nếu không đổi"
                  />
                </div>

                <div>
                  <label
                    htmlFor="profile-confirm-password"
                    className={labelClass}
                  >
                    Xác nhận mật khẩu mới
                  </label>

                  <input
                    id="profile-confirm-password"
                    type={
                      showPasswords
                        ? "text"
                        : "password"
                    }
                    autoComplete="new-password"
                    disabled={saving}
                    className={inputClass}
                    value={confirmPassword}
                    onChange={(event) =>
                      setConfirmPassword(
                        event.target.value
                      )
                    }
                    placeholder="Nhập lại mật khẩu mới"
                  />
                </div>
              </div>

              {/* SHOW / HIDE PASSWORD */}

              <button
                type="button"
                disabled={saving}
                onClick={() =>
                  setShowPasswords(
                    (value) => !value
                  )
                }
                className="inline-flex items-center gap-2 text-xs text-[#61726D] hover:underline"
              >
                {showPasswords ? (
                  <EyeOff size={15} />
                ) : (
                  <Eye size={15} />
                )}

                {showPasswords
                  ? "Ẩn mật khẩu"
                  : "Hiện mật khẩu đang nhập"}
              </button>

              <p className="text-xs leading-5 text-[#849396]">
                Nếu đổi mật khẩu, phải có ít nhất
                8 ký tự, bao gồm chữ cái, chữ số
                và ký tự đặc biệt.
              </p>
            </div>
          </div>

          {/* ACTION BUTTONS */}

          <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
            <button
              type="button"
              disabled={
                saving || processingAvatar
              }
              onClick={() => {
                populateForm(profile);
                setTab("view");
                setError("");
              }}
              className="h-12 rounded-xl border border-[#DEE5E0] px-6 text-sm font-medium disabled:opacity-60"
            >
              Hủy
            </button>

            <button
              type="submit"
              disabled={
                saving || processingAvatar
              }
              className="inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-[#31566B] px-6 text-sm font-medium text-white transition hover:bg-[#29495C] disabled:opacity-60"
            >
              {saving || processingAvatar ? (
                <LoaderCircle
                  size={17}
                  className="animate-spin"
                />
              ) : (
                <Save size={17} />
              )}

              {saving
                ? "Đang lưu..."
                : processingAvatar
                  ? "Đang xử lý ảnh..."
                  : "Lưu thay đổi"}
            </button>
          </div>
        </form>
      )}
    </section>
  );
}
