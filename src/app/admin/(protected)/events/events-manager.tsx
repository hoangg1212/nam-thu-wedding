
"use client";

import {
  useCallback,
  useEffect,
  useState,
  type FormEvent,
} from "react";

import {
  CalendarDays,
  CheckCircle2,
  Clock3,
  ExternalLink,
  House,
  LoaderCircle,
  MapPin,
  RefreshCw,
  Save,
  ShieldCheck,
  Users,
} from "lucide-react";

// ======================================================
// NAM & THU - EVENTS MANAGER
//
// CẬP NHẬT:
// - Lưu họ tên cha và mẹ như trước.
// - Chọn hiển thị cả hai / chỉ cha / chỉ mẹ.
// - Mỗi bên có lựa chọn độc lập.
// - Có xem trước thông tin gia đình.
// - Dữ liệu cũ mặc định hiển thị cả hai.
// ======================================================

type WeddingSide = "groom" | "bride";

type AdminRole =
  | "super_admin"
  | "groom_admin"
  | "bride_admin";

type ParentDisplayMode =
  | "both"
  | "father"
  | "mother";

interface WeddingEventData {
  side: WeddingSide;
  eventTitle: string;
  eventDate: string;
  eventTime: string | null;
  timeConfirmed: boolean;
  timezone: "Asia/Ho_Chi_Minh";
  family: {
    father: string;
    mother: string;
    displayMode: ParentDisplayMode;
  };
  venue: {
    name: string;
    address: string;
    mapUrl: string;
  };
  isActive: boolean;
}

interface ApiResult {
  success?: boolean;
  message?: string;
  events?: WeddingEventData[];
  event?: WeddingEventData;
}

interface Props {
  role: AdminRole;
  side: WeddingSide | null;
}

const EVENTS_API = "/api/admin/events";

const SIDE_LABELS = {
  groom: "Nhà trai",
  bride: "Nhà gái",
} as const;

const inputClass =
  "h-12 w-full rounded-xl border border-[#E2E6E2] bg-white px-4 text-[14px] text-[#31566B] outline-none transition focus:border-[#B8A27D] focus:ring-4 focus:ring-[#B8A27D]/10";

const labelClass =
  "mb-2 block text-[13px] font-medium text-[#50666E]";

const DISPLAY_OPTIONS: {
  value: ParentDisplayMode;
  label: string;
  description: string;
}[] = [
  {
    value: "both",
    label: "Hiển thị cả cha và mẹ",
    description: "Hiển thị hai dòng Ông và Bà.",
  },
  {
    value: "father",
    label: "Chỉ hiển thị tên cha",
    description: "Ẩn dòng tên mẹ trên thiệp.",
  },
  {
    value: "mother",
    label: "Chỉ hiển thị tên mẹ",
    description: "Ẩn dòng tên cha trên thiệp.",
  },
];

function isDisplayMode(
  value: unknown
): value is ParentDisplayMode {
  return (
    value === "both" ||
    value === "father" ||
    value === "mother"
  );
}

function normalizeEvent(
  event: WeddingEventData
): WeddingEventData {
  return {
    ...event,
    family: {
      father: event.family?.father ?? "",
      mother: event.family?.mother ?? "",
      displayMode: isDisplayMode(
        event.family?.displayMode
      )
        ? event.family.displayMode
        : "both",
    },
  };
}

function emptyEvent(
  side: WeddingSide
): WeddingEventData {
  return {
    side,
    eventTitle:
      side === "groom"
        ? "Lễ thành hôn"
        : "Lễ vu quy",
    eventDate: "",
    eventTime: null,
    timeConfirmed: false,
    timezone: "Asia/Ho_Chi_Minh",
    family: {
      father: "",
      mother: "",
      displayMode: "both",
    },
    venue: {
      name:
        side === "groom"
          ? "Tư gia nhà trai"
          : "Tư gia nhà gái",
      address: "",
      mapUrl: "",
    },
    isActive: true,
  };
}

function formatDate(value: string): string {
  if (!value) return "Chưa cập nhật";

  const [year, month, day] =
    value.split("-");

  return `${day}/${month}/${year}`;
}

function isMapLink(value: string): boolean {
  if (!value.trim()) return false;

  try {
    const url = new URL(value.trim());

    return (
      url.protocol === "https:" &&
      [
        "google.com",
        "www.google.com",
        "maps.google.com",
        "maps.app.goo.gl",
        "goo.gl",
      ].includes(url.hostname)
    );
  } catch {
    return false;
  }
}

function getAvailableSides(
  role: AdminRole,
  side: WeddingSide | null
): WeddingSide[] {
  if (role === "super_admin") {
    return ["groom", "bride"];
  }

  if (side) return [side];

  return [];
}

async function readApiResponse(
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

export default function EventsManager({
  role,
  side,
}: Props) {
  const initialSide: WeddingSide =
    role === "bride_admin"
      ? "bride"
      : "groom";

  const [events, setEvents] =
    useState<WeddingEventData[]>([]);

  const [selectedSide, setSelectedSide] =
    useState<WeddingSide>(initialSide);

  const [draft, setDraft] =
    useState<WeddingEventData>(
      emptyEvent(initialSide)
    );

  const [loading, setLoading] =
    useState(true);

  const [saving, setSaving] =
    useState(false);

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const isSuper = role === "super_admin";

  const availableSides =
    getAvailableSides(role, side);

  // ==================================================
  // LOAD DATA
  // ==================================================

  const loadEvents = useCallback(
    async (signal?: AbortSignal) => {
      if (signal?.aborted) return;

      setLoading(true);
      setError("");

      try {
        const response = await fetch(
          EVENTS_API,
          {
            method: "GET",
            credentials: "same-origin",
            cache: "no-store",
            signal,
          }
        );

        const result =
          await readApiResponse(response);

        if (!response.ok || !result.success) {
          throw new Error(
            result.message ||
              "Không thể tải thông tin lễ cưới."
          );
        }

        if (signal?.aborted) return;

        const items = (result.events ?? []).map(
          normalizeEvent
        );

        setEvents(items);

        const permittedSides =
          getAvailableSides(role, side);

        const preferredSide: WeddingSide =
          role === "bride_admin"
            ? "bride"
            : "groom";

        const permittedSide =
          permittedSides.includes(preferredSide)
            ? preferredSide
            : permittedSides[0];

        if (permittedSide) {
          setSelectedSide(permittedSide);

          const current = items.find(
            (item) =>
              item.side === permittedSide
          );

          setDraft(
            current ?? emptyEvent(permittedSide)
          );
        }
      } catch (caught) {
        if (signal?.aborted) return;

        setError(
          caught instanceof Error
            ? caught.message
            : "Không thể tải dữ liệu."
        );
      } finally {
        if (!signal?.aborted) {
          setLoading(false);
        }
      }
    },
    [role, side]
  );

  useEffect(() => {
    const controller = new AbortController();

    void Promise.resolve().then(() => {
      if (!controller.signal.aborted) {
        return loadEvents(controller.signal);
      }
    });

    return () => controller.abort();
  }, [loadEvents]);

  // ==================================================
  // UPDATE FORM
  // ==================================================

  function update<
    K extends keyof WeddingEventData
  >(
    key: K,
    value: WeddingEventData[K]
  ) {
    setDraft((current) => ({
      ...current,
      [key]: value,
    }));

    setSuccess("");
  }

  function updateFamily(
    key: keyof WeddingEventData["family"],
    value: string
  ) {
    setDraft((current) => ({
      ...current,
      family: {
        ...current.family,
        [key]: value,
      },
    }));

    setSuccess("");
  }

  function updateVenue(
    key: keyof WeddingEventData["venue"],
    value: string
  ) {
    setDraft((current) => ({
      ...current,
      venue: {
        ...current.venue,
        [key]: value,
      },
    }));

    setSuccess("");
  }

  function changeSide(next: WeddingSide) {
    if (
      !availableSides.includes(next) ||
      saving
    ) {
      return;
    }

    setSelectedSide(next);
    setError("");
    setSuccess("");

    const item = events.find(
      (event) => event.side === next
    );

    setDraft(
      item ?? emptyEvent(next)
    );
  }

  // ==================================================
  // SAVE
  // ==================================================

  async function handleSave(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    if (saving || loading) return;

    if (
      !availableSides.includes(draft.side)
    ) {
      setError(
        "Bạn không có quyền sửa bên này."
      );
      return;
    }

    if (!draft.eventTitle.trim()) {
      setError(
        "Vui lòng nhập tên buổi lễ."
      );
      return;
    }

    if (!draft.eventDate) {
      setError(
        "Vui lòng chọn ngày tổ chức."
      );
      return;
    }

    if (
      draft.timeConfirmed &&
      !draft.eventTime
    ) {
      setError(
        "Vui lòng chọn giờ trước khi xác nhận."
      );
      return;
    }

    // Chỉ kiểm tra tên được chọn hiển thị.
    // Tên còn lại vẫn được lưu nguyên vẹn.
    if (
      draft.family.displayMode === "father" &&
      !draft.family.father.trim()
    ) {
      setError(
        "Bạn đang chọn hiển thị tên cha. Vui lòng nhập họ tên cha."
      );
      return;
    }

    if (
      draft.family.displayMode === "mother" &&
      !draft.family.mother.trim()
    ) {
      setError(
        "Bạn đang chọn hiển thị tên mẹ. Vui lòng nhập họ tên mẹ."
      );
      return;
    }

    if (
      draft.venue.mapUrl &&
      !isMapLink(draft.venue.mapUrl)
    ) {
      setError(
        "Liên kết Google Maps phải là HTTPS hợp lệ."
      );
      return;
    }

    setSaving(true);
    setError("");
    setSuccess("");

    try {
      const response = await fetch(
        EVENTS_API,
        {
          method: "PATCH",
          credentials: "same-origin",
          cache: "no-store",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(draft),
        }
      );

      const result =
        await readApiResponse(response);

      if (!response.ok || !result.success) {
        throw new Error(
          result.message ||
            "Không thể lưu thông tin."
        );
      }

      const saved = normalizeEvent(
        result.event ?? draft
      );

      setDraft(saved);

      setEvents((current) => [
        ...current.filter(
          (item) => item.side !== saved.side
        ),
        saved,
      ]);

      setSuccess(
        `Đã lưu thông tin ${SIDE_LABELS[saved.side]} thành công.`
      );
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Không thể lưu dữ liệu."
      );
    } finally {
      setSaving(false);
    }
  }

  // ==================================================
  // FAMILY PREVIEW
  // ==================================================

  const displayFather =
    draft.family.displayMode !== "mother";

  const displayMother =
    draft.family.displayMode !== "father";

  // ==================================================
  // RENDER
  // ==================================================

  return (
    <main className="mx-auto w-full max-w-[1450px] px-4 py-7 text-[#31566B] sm:px-6 sm:py-9 xl:px-8">
      {/* HEADER */}

      <section className="mb-7">
        <div className="mb-3 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-[#B8A27D]">
          <CalendarDays size={16} />
          Wedding Event Management
        </div>

        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="font-wedding-serif text-[35px] leading-tight sm:text-[43px]">
              Thông tin lễ cưới
            </h1>

            <p className="mt-2 text-[13px] leading-6 text-[#829296]">
              Quản lý ngày tổ chức, thông tin gia đình
              và địa điểm lễ cưới.
            </p>
          </div>

          <button
            type="button"
            onClick={() => {
              void loadEvents();
            }}
            disabled={loading || saving}
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
        </div>
      </section>

      {/* CHỌN NHÀ TRAI / NHÀ GÁI */}

      {isSuper && (
        <div className="mb-6 flex flex-wrap gap-3">
          {(["groom", "bride"] as const).map(
            (item) => (
              <button
                key={item}
                type="button"
                disabled={saving}
                onClick={() => changeSide(item)}
                className={
                  selectedSide === item
                    ? "inline-flex h-12 items-center gap-2 rounded-xl bg-[#31566B] px-6 text-sm font-semibold text-white shadow-sm"
                    : "inline-flex h-12 items-center gap-2 rounded-xl border border-[#E1E5DF] bg-white px-6 text-sm font-medium text-[#61726D]"
                }
              >
                <House size={17} />
                {SIDE_LABELS[item]}
              </button>
            )
          )}
        </div>
      )}

      {error && (
        <div
          role="alert"
          className="mb-5 rounded-xl border border-[#EDC5C7] bg-[#FFF1F1] px-4 py-3 text-[13px] text-[#B2545A]"
        >
          {error}
        </div>
      )}

      {success && (
        <div
          role="status"
          className="mb-5 flex items-center gap-2 rounded-xl border border-[#D1E7D9] bg-[#EFF9F2] px-4 py-3 text-[13px] text-[#3D7654]"
        >
          <CheckCircle2 size={17} />
          {success}
        </div>
      )}

      {loading ? (
        <div className="flex min-h-[320px] items-center justify-center rounded-2xl border border-[#E6E3DA] bg-white">
          <LoaderCircle
            size={25}
            className="animate-spin text-[#31566B]"
          />
        </div>
      ) : (
        <form onSubmit={handleSave}>
          <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_300px]">
            <div className="min-w-0 space-y-5">
              {/* THÔNG TIN BUỔI LỄ */}

              <section className="rounded-[22px] border border-[#E7E2D9] bg-white p-5 shadow-sm sm:p-7">
                <div className="mb-6 flex items-center gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#F3F1E9] text-[#B8A27D]">
                    <CalendarDays size={21} />
                  </div>

                  <div>
                    <h2 className="text-[16px] font-semibold">
                      Thông tin buổi lễ
                    </h2>
                    <p className="mt-1 text-xs text-[#8C9A9C]">
                      {SIDE_LABELS[selectedSide]}
                    </p>
                  </div>
                </div>

                <div className="grid gap-5 sm:grid-cols-2">
                  <div className="sm:col-span-2">
                    <label
                      htmlFor="event-title"
                      className={labelClass}
                    >
                      Tên buổi lễ
                    </label>

                    <input
                      id="event-title"
                      className={inputClass}
                      value={draft.eventTitle}
                      maxLength={120}
                      required
                      onChange={(event) =>
                        update(
                          "eventTitle",
                          event.target.value
                        )
                      }
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="event-date"
                      className={labelClass}
                    >
                      Ngày tổ chức
                    </label>

                    <input
                      id="event-date"
                      type="date"
                      min="2000-01-01"
                      max="2100-12-31"
                      required
                      value={draft.eventDate}
                      className={inputClass}
                      onChange={(event) =>
                        update(
                          "eventDate",
                          event.target.value
                        )
                      }
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="event-time"
                      className={labelClass}
                    >
                      Giờ tổ chức
                    </label>

                    <input
                      id="event-time"
                      type="time"
                      value={draft.eventTime ?? ""}
                      className={inputClass}
                      onChange={(event) =>
                        update(
                          "eventTime",
                          event.target.value || null
                        )
                      }
                    />
                  </div>

                  <label className="flex cursor-pointer items-center gap-3 sm:col-span-2">
                    <input
                      type="checkbox"
                      checked={draft.timeConfirmed}
                      onChange={(event) =>
                        update(
                          "timeConfirmed",
                          event.target.checked
                        )
                      }
                      className="h-4 w-4 accent-[#31566B]"
                    />

                    <span className="text-[13px] text-[#61726D]">
                      Giờ tổ chức đã được xác nhận
                    </span>
                  </label>
                </div>
              </section>

              {/* THÔNG TIN GIA ĐÌNH */}

              <section className="rounded-[22px] border border-[#E7E2D9] bg-white p-5 shadow-sm sm:p-7">
                <div className="mb-6 flex items-center gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#F3F1E9] text-[#B8A27D]">
                    <Users size={21} />
                  </div>

                  <div>
                    <h2 className="text-[16px] font-semibold">
                      Thông tin gia đình
                    </h2>

                    <p className="mt-1 text-xs text-[#8C9A9C]">
                      Họ tên cha mẹ và lựa chọn hiển thị trên thiệp
                    </p>
                  </div>
                </div>

                <div className="grid gap-5 sm:grid-cols-2">
                  <div>
                    <label
                      htmlFor="family-father"
                      className={labelClass}
                    >
                      Họ tên cha
                    </label>

                    <input
                      id="family-father"
                      className={inputClass}
                      maxLength={120}
                      placeholder="Nhập họ và tên cha"
                      value={draft.family.father}
                      onChange={(event) =>
                        updateFamily(
                          "father",
                          event.target.value
                        )
                      }
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="family-mother"
                      className={labelClass}
                    >
                      Họ tên mẹ
                    </label>

                    <input
                      id="family-mother"
                      className={inputClass}
                      maxLength={120}
                      placeholder="Nhập họ và tên mẹ"
                      value={draft.family.mother}
                      onChange={(event) =>
                        updateFamily(
                          "mother",
                          event.target.value
                        )
                      }
                    />
                  </div>
                </div>

                {/* LỰA CHỌN HIỂN THỊ */}

                <fieldset className="mt-7 border-t border-[#EEEAE2] pt-6">
                  <legend className="sr-only">
                    Chọn tên cha mẹ hiển thị trên thiệp
                  </legend>

                  <h3 className="text-[14px] font-semibold text-[#31566B]">
                    Hiển thị thông tin gia đình trên thiệp
                  </h3>

                  <p className="mt-2 text-[12px] leading-6 text-[#829296]">
                    Chỉ thay đổi tên được hiển thị.
                    Họ tên đã nhập vẫn được lưu,
                    không bị xóa khi đổi lựa chọn.
                  </p>

                  <div className="mt-4 grid gap-3 lg:grid-cols-3">
                    {DISPLAY_OPTIONS.map((option) => {
                      const selected =
                        draft.family.displayMode ===
                        option.value;

                      return (
                        <label
                          key={option.value}
                          className={`flex cursor-pointer items-start gap-3 rounded-xl border p-4 transition ${
                            selected
                              ? "border-[#B8A27D] bg-[#F8F5EC] ring-2 ring-[#B8A27D]/10"
                              : "border-[#E2E6E2] bg-white hover:bg-[#FAFAF7]"
                          }`}
                        >
                          <input
                            type="radio"
                            name={`parents-display-${selectedSide}`}
                            value={option.value}
                            checked={selected}
                            onChange={() =>
                              updateFamily(
                                "displayMode",
                                option.value
                              )
                            }
                            className="mt-1 h-4 w-4 shrink-0 accent-[#31566B]"
                          />

                          <span className="min-w-0">
                            <span className="block text-[12px] font-semibold leading-5 text-[#31566B]">
                              {option.label}
                            </span>

                            <span className="mt-1 block text-[11px] leading-5 text-[#87979A]">
                              {option.description}
                            </span>
                          </span>
                        </label>
                      );
                    })}
                  </div>
                </fieldset>

                {/* XEM TRƯỚC */}

                <div className="mt-6 rounded-2xl border border-[#E7E1D8] bg-[#FAF9F5] p-5 text-center">
                  <p className="mb-4 text-[11px] font-semibold uppercase tracking-[0.14em] text-[#B8A27D]">
                    Xem trước trên thiệp cưới
                  </p>

                  <h4 className="font-wedding-serif text-[19px] uppercase tracking-[0.1em] text-[#587589]">
                    {SIDE_LABELS[selectedSide]}
                  </h4>

                  <div className="mt-3 space-y-1 font-wedding-serif text-[16px] leading-7 text-[#61726D]">
                    {displayFather &&
                      draft.family.father.trim() && (
                        <p>
                          Ông: {draft.family.father.trim()}
                        </p>
                      )}

                    {displayMother &&
                      draft.family.mother.trim() && (
                        <p>
                          Bà: {draft.family.mother.trim()}
                        </p>
                      )}

                    {!(
                      (displayFather &&
                        draft.family.father.trim()) ||
                      (displayMother &&
                        draft.family.mother.trim())
                    ) && (
                      <p className="text-[13px] italic text-[#9CA7A5]">
                        Chưa có tên để hiển thị
                      </p>
                    )}
                  </div>
                </div>
              </section>

              {/* ĐỊA ĐIỂM TỔ CHỨC */}

              <section className="rounded-[22px] border border-[#E7E2D9] bg-white p-5 shadow-sm sm:p-7">
                <div className="mb-6 flex items-center gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#F3F1E9] text-[#B8A27D]">
                    <MapPin size={21} />
                  </div>

                  <div>
                    <h2 className="text-[16px] font-semibold">
                      Địa điểm tổ chức
                    </h2>

                    <p className="mt-1 text-xs text-[#8C9A9C]">
                      Địa chỉ và Google Maps
                    </p>
                  </div>
                </div>

                <div className="space-y-5">
                  <div>
                    <label
                      htmlFor="venue-name"
                      className={labelClass}
                    >
                      Tên địa điểm
                    </label>

                    <input
                      id="venue-name"
                      className={inputClass}
                      value={draft.venue.name}
                      maxLength={150}
                      onChange={(event) =>
                        updateVenue(
                          "name",
                          event.target.value
                        )
                      }
                      placeholder="Ví dụ: Tư gia nhà trai"
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="venue-address"
                      className={labelClass}
                    >
                      Địa chỉ chi tiết
                    </label>

                    <textarea
                      id="venue-address"
                      rows={3}
                      maxLength={500}
                      value={draft.venue.address}
                      onChange={(event) =>
                        updateVenue(
                          "address",
                          event.target.value
                        )
                      }
                      placeholder="Nhập địa chỉ tổ chức"
                      className="w-full resize-y rounded-xl border border-[#E2E6E2] bg-white px-4 py-3 text-[14px] text-[#31566B] outline-none focus:border-[#B8A27D]"
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="venue-map"
                      className={labelClass}
                    >
                      Liên kết Google Maps
                    </label>

                    <input
                      id="venue-map"
                      type="url"
                      className={inputClass}
                      maxLength={1500}
                      value={draft.venue.mapUrl}
                      placeholder="https://maps.app.goo.gl/..."
                      onChange={(event) =>
                        updateVenue(
                          "mapUrl",
                          event.target.value
                        )
                      }
                    />

                    {isMapLink(
                      draft.venue.mapUrl
                    ) && (
                      <a
                        href={draft.venue.mapUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-3 inline-flex items-center gap-2 text-[12px] font-medium text-[#61726D] underline underline-offset-4 hover:text-[#31566B]"
                      >
                        <ExternalLink size={15} />
                        Kiểm tra chỉ đường
                      </a>
                    )}
                  </div>
                </div>
              </section>
            </div>

            {/* SIDEBAR */}

            <aside className="space-y-5">
              <section className="rounded-[22px] border border-[#E6DED0] bg-[#F5F1E8] p-5 sm:p-6">
                <div className="mb-4 flex items-center gap-2">
                  <House
                    size={18}
                    className="text-[#B8A27D]"
                  />

                  <h2 className="text-sm font-semibold">
                    Tóm tắt buổi lễ
                  </h2>
                </div>

                <div className="space-y-4">
                  <div>
                    <p className="text-xs text-[#8B9A9B]">
                      Bên tổ chức
                    </p>

                    <p className="mt-1 text-sm font-semibold">
                      {SIDE_LABELS[draft.side]}
                    </p>
                  </div>

                  <div>
                    <p className="text-xs text-[#8B9A9B]">
                      Buổi lễ
                    </p>

                    <p className="mt-1 text-sm font-medium">
                      {draft.eventTitle || "Chưa đặt tên"}
                    </p>
                  </div>

                  <div>
                    <p className="text-xs text-[#8B9A9B]">
                      Ngày tổ chức
                    </p>

                    <p className="mt-1 text-sm font-medium">
                      {formatDate(draft.eventDate)}
                    </p>
                  </div>

                  <div>
                    <p className="text-xs text-[#8B9A9B]">
                      Giờ tổ chức
                    </p>

                    <p className="mt-1 text-sm font-medium">
                      {draft.timeConfirmed &&
                      draft.eventTime
                        ? draft.eventTime
                        : "Chưa xác nhận"}
                    </p>
                  </div>

                  <div>
                    <p className="text-xs text-[#8B9A9B]">
                      Hiển thị cha mẹ
                    </p>

                    <p className="mt-1 text-sm font-medium">
                      {DISPLAY_OPTIONS.find(
                        (item) =>
                          item.value ===
                          draft.family.displayMode
                      )?.label ??
                        "Hiển thị cả cha và mẹ"}
                    </p>
                  </div>

                  <div>
                    <p className="text-xs text-[#8B9A9B]">
                      Địa điểm
                    </p>

                    <p className="mt-1 break-words text-sm font-medium">
                      {draft.venue.name ||
                        "Chưa cập nhật"}
                    </p>

                    <p className="mt-1 break-words text-xs leading-5 text-[#879596]">
                      {draft.venue.address ||
                        "Chưa có địa chỉ"}
                    </p>
                  </div>
                </div>
              </section>

              {/* EVENT STATUS */}

              <section className="rounded-[22px] border border-[#E7E2D9] bg-white p-5 sm:p-6">
                <div className="mb-4 flex items-center gap-2">
                  <ShieldCheck
                    size={18}
                    className="text-[#B8A27D]"
                  />

                  <h2 className="text-sm font-semibold">
                    Trạng thái buổi lễ
                  </h2>
                </div>

                <label className="flex cursor-pointer items-center gap-3">
                  <input
                    type="checkbox"
                    checked={draft.isActive}
                    onChange={(event) =>
                      update(
                        "isActive",
                        event.target.checked
                      )
                    }
                    className="h-4 w-4 accent-[#31566B]"
                  />

                  <span className="text-[13px]">
                    Kích hoạt buổi lễ
                  </span>
                </label>

                <p className="mt-4 text-xs leading-6 text-[#8B999A]">
                  Trạng thái được lưu trong cơ sở dữ liệu.
                  Website chỉ hiển thị sự kiện đang kích hoạt.
                </p>
              </section>

              <button
                type="submit"
                disabled={saving}
                className="inline-flex h-[52px] w-full items-center justify-center gap-2 rounded-xl bg-[#31566B] text-[14px] font-semibold text-white shadow-[0_8px_20px_rgba(49,86,107,0.15)] transition hover:bg-[#28495C] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {saving ? (
                  <LoaderCircle
                    size={18}
                    className="animate-spin"
                  />
                ) : (
                  <Save size={18} />
                )}

                {saving
                  ? "Đang lưu..."
                  : `Lưu ${SIDE_LABELS[draft.side]}`}
              </button>

              <div className="flex items-center justify-center gap-2 text-xs text-[#8F9A9B]">
                <Clock3 size={14} />
                Giờ Việt Nam (UTC+7)
              </div>
            </aside>
          </div>
        </form>
      )}
    </main>
  );
}
