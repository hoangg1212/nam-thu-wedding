
"use client";

import {
  useEffect,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";

import { usePathname } from "next/navigation";

import {
  Check,
  Heart,
  LoaderCircle,
  Send,
} from "lucide-react";

import { wedding } from "@/data/wedding";

// ======================================================
// NAM & THU - WISHES + RSVP
//
// FIX ESLINT:
// - Tự điền tên khách từ props hoặc URL.
// - Tự chọn mối quan hệ Nhà trai / Nhà gái.
// - Khởi tạo và tải RSVP đã lưu.
// - Không gọi setState đồng bộ trong effect.
//
// GIỮ NGUYÊN:
// - Link thiệp cũ /invite/[token].
// - Link thiệp mới /invite/[slug]-[token].
// - Đọc trạng thái RSVP đã lưu.
// - Một API gửi cả lời chúc và RSVP.
// - Một nút gửi duy nhất.
// - Không gửi riêng /api/wishes hoặc POST /rsvp.
// - Honeypot chống bot.
// - Thiết kế Desktop / Mobile.
// - Background, hiệu ứng và màu sắc.
// - Trang trí nhẫn cưới.
// - Bố cục hai cột.
// - Nội dung từ wedding.ts.
// ======================================================

// ======================================================
// TYPES
// ======================================================

type GuestSide = "groom" | "bride";

type SubmitStatus =
  | "idle"
  | "loading"
  | "success"
  | "error";

type RsvpStatus =
  | "attending"
  | "declined"
  | "unsure";

interface WishesProps {
  guestName?: string;
  guestSide?: GuestSide;
}

interface SubmitResponse {
  success?: boolean;
  message?: string;
  rsvpStatus?: RsvpStatus;
}

interface SavedRsvpResponse {
  success?: boolean;
  rsvp?: {
    status: RsvpStatus | "no_response";
  };
}

// ======================================================
// RSVP OPTIONS
// ======================================================

const RSVP_OPTIONS: {
  value: RsvpStatus;
  label: string;
}[] = [
  {
    value: "attending",
    label: "Xác nhận tham dự",
  },
  {
    value: "declined",
    label: "Không thể tham dự",
  },
  {
    value: "unsure",
    label: "Chưa chắc chắn",
  },
];

// ======================================================
// WEDDING RINGS
// ======================================================

function WeddingRings() {
  return (
    <div
      aria-hidden="true"
      className="mx-auto w-full max-w-[360px]"
    >
      <svg
        viewBox="0 0 500 100"
        fill="none"
        className="h-[54px] w-full sm:h-[60px] md:h-[66px]"
      >
        <path
          d="M0 70 C35 52 58 86 91 69 C116 56 121 80 146 68 C162 60 170 59 188 63"
          stroke="#B8A27D"
          strokeWidth="1.2"
          opacity="0.55"
        />

        <path
          d="M312 63 C330 59 338 60 354 68 C379 80 384 56 409 69 C442 86 465 52 500 70"
          stroke="#B8A27D"
          strokeWidth="1.2"
          opacity="0.55"
        />

        <ellipse
          cx="220"
          cy="49"
          rx="48"
          ry="25"
          transform="rotate(-13 220 49)"
          stroke="#B8A27D"
          strokeWidth="1.6"
        />

        <ellipse
          cx="220"
          cy="49"
          rx="39"
          ry="18"
          transform="rotate(-13 220 49)"
          stroke="#B8A27D"
          strokeWidth="1"
          opacity="0.65"
        />

        <ellipse
          cx="280"
          cy="49"
          rx="48"
          ry="25"
          transform="rotate(13 280 49)"
          stroke="#B8A27D"
          strokeWidth="1.6"
        />

        <ellipse
          cx="280"
          cy="49"
          rx="39"
          ry="18"
          transform="rotate(13 280 49)"
          stroke="#B8A27D"
          strokeWidth="1"
          opacity="0.65"
        />
      </svg>
    </div>
  );
}

// ======================================================
// DECORATIVE DIVIDER
// ======================================================

function WishesDivider() {
  return (
    <div
      aria-hidden="true"
      className="
        flex items-center justify-center
        gap-3 lg:justify-start
      "
    >
      <span
        className="
          h-px w-11
          bg-gradient-to-r
          from-transparent to-[#B8A27D]/55
          sm:w-16
        "
      />

      <Heart
        size={12}
        strokeWidth={1.2}
        className="text-[#C98792]"
      />

      <span
        className="
          h-px w-11
          bg-gradient-to-l
          from-transparent to-[#B8A27D]/55
          sm:w-16
        "
      />
    </div>
  );
}

// ======================================================
// INTRODUCTION
//
// Nội dung lấy trực tiếp từ wedding.ts.
// Không hardcode nội dung phần giới thiệu.
// ======================================================

function WishesIntroduction() {
  const content = wedding.wishes;

  return (
    <div
      className="
        mx-auto w-full max-w-xl
        text-center lg:mx-0 lg:text-left
      "
    >
      <p
        className="
          text-[10px] font-medium uppercase
          tracking-[0.36em] text-[#C98792]
          sm:text-[11px]
        "
      >
        {content.eyebrow}
      </p>

      <h2
        className="
          font-wedding-serif
          mt-4 text-[43px] font-light
          leading-[1.12] tracking-[-0.02em]
          text-[#31566B]
          sm:text-5xl
          md:text-6xl
          lg:text-[68px]
        "
      >
        {content.title}{" "}

        <span className="italic text-[#587589]">
          {content.titleAccent}
        </span>
      </h2>

      <div className="mt-6">
        <WishesDivider />
      </div>

      <p
        className="
          font-wedding-serif
          mt-5 text-[16px] leading-7
          text-[#61726D]
          sm:text-lg sm:leading-8
          md:text-xl md:leading-9
        "
      >
        {content.description}
      </p>

      <p
        className="
          font-wedding-serif
          mt-3 text-[16px] leading-7
          text-[#61726D]/90
          sm:text-lg sm:leading-8
        "
      >
        {content.secondaryDescription}
      </p>

      <div
        className="
          mt-6 flex items-center
          justify-center gap-4
          lg:justify-start
        "
      >
        <span
          className="
            font-wedding
            text-[43px] leading-none
            text-[#587589] sm:text-5xl
          "
        >
          {wedding.groom.shortName}
        </span>

        <Heart
          size={13}
          fill="currentColor"
          strokeWidth={1}
          className="text-[#C98792]"
        />

        <span
          className="
            font-wedding
            text-[43px] leading-none
            text-[#587589] sm:text-5xl
          "
        >
          {wedding.bride.shortName}
        </span>
      </div>
    </div>
  );
}

// ======================================================
// FORM STYLES
// ======================================================

const fieldClassName = `
  w-full rounded-2xl
  border border-[#7A9CAC]/25
  bg-white/60 px-4 py-3.5

  font-wedding-serif
  text-[16px] text-[#31566B]

  outline-none
  placeholder:text-[#61726D]/45

  transition-all duration-300

  focus:border-[#7A9CAC]/60
  focus:bg-white
  focus:shadow-[0_8px_28px_rgba(49,86,107,0.07)]

  disabled:cursor-not-allowed
  disabled:opacity-65

  sm:px-5 sm:py-4
  sm:text-[17px]
`;

// ======================================================
// FORM LABEL
// ======================================================

function FormLabel({
  htmlFor,
  children,
}: {
  htmlFor: string;
  children: ReactNode;
}) {
  return (
    <label
      htmlFor={htmlFor}
      className="
        mb-2.5 flex items-center
        text-[10px] font-medium
        uppercase tracking-[0.18em]
        text-[#587589] sm:text-[11px]
      "
    >
      {children}
    </label>
  );
}

// ======================================================
// URL HELPERS
//
// Đọc các tham số phía client.
// Không đọc query string khi render phía server.
// ======================================================

function getUrlGuestName(): string {
  if (typeof window === "undefined") {
    return "";
  }

  const params = new URLSearchParams(
    window.location.search
  );

  return (
    params.get("guest")?.trim() ?? ""
  );
}

function getUrlGuestSide(): GuestSide | null {
  if (typeof window === "undefined") {
    return null;
  }

  const params = new URLSearchParams(
    window.location.search
  );

  const value = params.get("side");

  if (
    value === "groom" ||
    value === "bride"
  ) {
    return value;
  }

  return null;
}

// ======================================================
// WISHES FORM
// ======================================================

function WishesForm({
  invitationGuestName,
  invitationGuestSide,
}: {
  invitationGuestName?: string;
  invitationGuestSide?: GuestSide;
}) {
  const content = wedding.wishes;

  const pathname = usePathname();

  // ==================================================
  // INVITATION TOKEN
  //
  // LINK CŨ:
  // /invite/<48 ký tự hex>
  //
  // LINK MỚI:
  // /invite/<slug>-<48 ký tự hex>
  //
  // Chỉ nhận token từ pathname.
  // Backend tiếp tục xác minh bằng MongoDB.
  // ==================================================

  const tokenMatch = pathname.match(
    /^\/invite\/((?:[a-f0-9]{48})|(?:[a-z0-9]+(?:-[a-z0-9]+)*-[a-f0-9]{48}))\/?$/i
  );

  const invitationToken =
    tokenMatch?.[1] ?? null;

  // ==================================================
  // FORM STATE
  // ==================================================

  const [name, setName] = useState(
    invitationGuestName?.trim().slice(0, 100) ?? ""
  );

  const [relation, setRelation] = useState(
    content.relations[0] ?? ""
  );

  // Mặc định chưa chọn RSVP.
  const [rsvpStatus, setRsvpStatus] =
    useState<RsvpStatus | "">("");

  const [message, setMessage] =
    useState("");

  // Honeypot để phát hiện bot.
  const [website, setWebsite] =
    useState("");

  const [status, setStatus] =
    useState<SubmitStatus>("idle");

  const [feedback, setFeedback] =
    useState("");

  const [
    loadingSavedRsvp,
    setLoadingSavedRsvp,
  ] = useState(Boolean(invitationToken));

  const [
    hasSavedRsvp,
    setHasSavedRsvp,
  ] = useState(false);

  const isSubmitting =
    status === "loading";

  // ==================================================
  // FIX ESLINT #1
  //
  // TỰ ĐIỀN TÊN KHÁCH
  //
  // Ưu tiên:
  // 1. invitationGuestName từ WeddingPage.
  // 2. Tham số ?guest= trong URL.
  //
  // CODE CŨ:
  // useEffect gọi setName() trực tiếp.
  //
  // CODE MỚI:
  // - Đọc dữ liệu trong effect.
  // - Cập nhật state trong microtask.
  // - Có cleanup khi component unmount.
  // ==================================================

  useEffect(() => {
    let cancelled = false;

    const providedName =
      invitationGuestName?.trim();

    const nameFromUrl =
      getUrlGuestName();

    const finalName =
      providedName || nameFromUrl || "";

    if (!finalName) {
      return;
    }

    void Promise.resolve().then(() => {
      if (cancelled) {
        return;
      }

      const normalizedName =
        finalName.slice(0, 100);

      setName((current) =>
        current === normalizedName
          ? current
          : normalizedName
      );
    });

    return () => {
      cancelled = true;
    };
  }, [invitationGuestName]);

  // ==================================================
  // FIX ESLINT #2
  //
  // TỰ CHỌN MỐI QUAN HỆ
  //
  // Nhà trai: Bạn của chú rể.
  // Nhà gái: Bạn của cô dâu.
  //
  // Chỉ chọn khi tùy chọn này tồn tại
  // trong wedding.wishes.relations.
  //
  // Không gọi setRelation() trực tiếp
  // trong thân useEffect.
  // ==================================================

  useEffect(() => {
    let cancelled = false;

    const sideFromUrl =
      getUrlGuestSide();

    const side =
      invitationGuestSide ??
      sideFromUrl;

    const preferredRelation =
      side === "bride"
        ? "Bạn của cô dâu"
        : side === "groom"
          ? "Bạn của chú rể"
          : null;

    if (
      !preferredRelation ||
      !content.relations.includes(
        preferredRelation
      )
    ) {
      return;
    }

    void Promise.resolve().then(() => {
      if (cancelled) {
        return;
      }

      setRelation((current) =>
        current === preferredRelation
          ? current
          : preferredRelation
      );
    });

    return () => {
      cancelled = true;
    };
  }, [
    invitationGuestSide,
    content.relations,
  ]);

  // ==================================================
  // FIX ESLINT #3
  //
  // ĐỌC RSVP ĐÃ LƯU
  //
  // Nếu khách đã xác nhận:
  // - Hiển thị lại trạng thái RSVP.
  // - Cho phép thay đổi khi gửi lại.
  // - Không tự điền lời chúc cũ.
  //
  // Nếu không có invitationToken:
  // - Không gửi request.
  // - Tắt loading.
  // - Xóa dữ liệu RSVP cũ.
  //
  // Tất cả thao tác khởi tạo state được
  // chuyển sang callback bất đồng bộ.
  // ==================================================

  useEffect(() => {
    const controller =
      new AbortController();

    // ==================================================
    // KHÔNG CÓ TOKEN
    //
    // Không gọi setState đồng bộ
    // trong thân effect.
    // ==================================================

    if (!invitationToken) {
      void Promise.resolve().then(() => {
        if (controller.signal.aborted) {
          return;
        }

        setLoadingSavedRsvp(false);
        setHasSavedRsvp(false);
        setRsvpStatus("");
      });

      return () => {
        controller.abort();
      };
    }

    // ==================================================
    // CÓ TOKEN
    //
    // Đọc dữ liệu đã lưu qua GET /rsvp.
    // ==================================================

    async function loadSavedRsvp() {
      if (
        !invitationToken ||
        controller.signal.aborted
      ) {
        return;
      }

      setLoadingSavedRsvp(true);
      setHasSavedRsvp(false);
      setRsvpStatus("");

      try {
        const response = await fetch(
          `/api/invitations/${invitationToken}/rsvp`,
          {
            method: "GET",
            cache: "no-store",
            signal: controller.signal,
          }
        );

        if (!response.ok) {
          throw new Error(
            "Không thể tải trạng thái tham dự."
          );
        }

        const data: SavedRsvpResponse =
          await response.json();

        if (
          controller.signal.aborted
        ) {
          return;
        }

        const savedStatus =
          data.rsvp?.status;

        if (
          data.success &&
          (
            savedStatus === "attending" ||
            savedStatus === "declined" ||
            savedStatus === "unsure"
          )
        ) {
          setRsvpStatus(savedStatus);
          setHasSavedRsvp(true);
        }
      } catch {
        // Không đọc được RSVP cũ thì form
        // vẫn cho phép khách thao tác.
        //
        // Backend sẽ xác minh token khi
        // khách gửi lời chúc và RSVP.
      } finally {
        if (
          !controller.signal.aborted
        ) {
          setLoadingSavedRsvp(false);
        }
      }
    }

    // ==================================================
    // KHỞI CHẠY BẤT ĐỒNG BỘ
    //
    // Tránh gọi hàm có setState trực tiếp
    // từ thân useEffect.
    // ==================================================

    void Promise.resolve().then(() => {
      if (controller.signal.aborted) {
        return;
      }

      return loadSavedRsvp();
    });

    return () => {
      controller.abort();
    };
  }, [invitationToken]);

  // ==================================================
  // CLEAR FEEDBACK
  //
  // Khi khách sửa form, bỏ thông báo cũ
  // nhưng không hủy request đang gửi.
  // ==================================================

  function clearFeedback() {
    setFeedback("");

    setStatus((current) =>
      current === "loading"
        ? current
        : "idle"
    );
  }

  // ==================================================
  // VALIDATE FORM
  //
  // Kiểm tra:
  // 1. Họ và tên.
  // 2. Mối quan hệ.
  // 3. Trạng thái RSVP.
  // 4. Nội dung lời chúc.
  // 5. Honeypot.
  // 6. Token thiệp mời.
  // ==================================================

  function validateForm(): string | null {
    const cleanedName =
      name.trim();

    const cleanedMessage =
      message.trim();

    // Họ và tên.
    if (
      cleanedName.length < 2 ||
      cleanedName.length > 100
    ) {
      return (
        "Vui lòng nhập họ và tên " +
        "từ 2 đến 100 ký tự."
      );
    }

    // Mối quan hệ.
    if (
      !relation ||
      !content.relations.includes(
        relation
      )
    ) {
      return (
        "Vui lòng chọn mối quan hệ hợp lệ."
      );
    }

    // Bắt buộc chọn RSVP.
    if (!rsvpStatus) {
      return (
        "Vui lòng chọn một trong ba " +
        "trạng thái xác nhận tham dự."
      );
    }

    // Kiểm tra giá trị RSVP.
    if (
      rsvpStatus !== "attending" &&
      rsvpStatus !== "declined" &&
      rsvpStatus !== "unsure"
    ) {
      return (
        "Trạng thái xác nhận không hợp lệ."
      );
    }

    // Nội dung lời chúc.
    if (
      cleanedMessage.length < 2 ||
      cleanedMessage.length > 500
    ) {
      return (
        "Vui lòng nhập lời chúc " +
        "từ 2 đến 500 ký tự."
      );
    }

    // Honeypot chống bot.
    if (website.trim()) {
      return (
        "Không thể xử lý yêu cầu."
      );
    }

    // Bắt buộc dùng thiệp cá nhân hóa.
    if (!invitationToken) {
      return (
        "Vui lòng mở đường dẫn thiệp mời " +
        "cá nhân để gửi lời chúc và xác nhận tham dự."
      );
    }

    return null;
  }

  // ==================================================
  // SUBMIT
  //
  // CHỈ MỘT API:
  // POST /api/invitations/[token]/submit
  //
  // Không gọi riêng /api/wishes.
  // Không gọi POST /rsvp.
  //
  // Backend chịu trách nhiệm:
  // - Xác minh token.
  // - Lưu RSVP.
  // - Lưu lời chúc.
  // - Xử lý tránh dữ liệu trùng.
  // ==================================================

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    if (
      isSubmitting ||
      loadingSavedRsvp
    ) {
      return;
    }

    const validationError =
      validateForm();

    if (validationError) {
      setStatus("error");
      setFeedback(validationError);
      return;
    }

    if (
      !invitationToken ||
      !rsvpStatus
    ) {
      return;
    }

    const cleanedName =
      name.trim();

    const cleanedMessage =
      message.trim();

    setStatus("loading");
    setFeedback("");

    try {
      const response = await fetch(
        `/api/invitations/${invitationToken}/submit`,
        {
          method: "POST",
          credentials: "same-origin",
          cache: "no-store",
          headers: {
            "Content-Type":
              "application/json",
          },
          body: JSON.stringify({
            guestName: cleanedName,
            relation,
            rsvpStatus,
            message: cleanedMessage,
            website,
          }),
        }
      );

      const result: SubmitResponse =
        await response.json();

      if (
        !response.ok ||
        !result.success
      ) {
        throw new Error(
          result.message ||
            "Không thể gửi lời chúc lúc này."
        );
      }

      // ==================================================
      // GỬI THÀNH CÔNG
      //
      // Giữ họ tên, mối quan hệ và RSVP.
      // Chỉ xóa nội dung lời chúc.
      // ==================================================

      setStatus("success");

      setFeedback(
        result.message ||
          "Nam và Thư đã nhận được lời chúc và xác nhận tham dự của bạn."
      );

      setMessage("");
      setHasSavedRsvp(true);
    } catch (error) {
      setStatus("error");

      setFeedback(
        error instanceof Error
          ? error.message
          : "Đã xảy ra lỗi khi gửi thông tin."
      );
    }
  }

  // ==================================================
  // RENDER FORM
  // ==================================================

  return (
    <form
      onSubmit={(event) => {
        void handleSubmit(event);
      }}
      noValidate
      className="
        relative overflow-hidden
        rounded-[30px]

        border border-[#FFFDF8]/90
        bg-[#FFFDF8]/64

        p-6

        shadow-[0_30px_85px_rgba(49,86,107,0.10)]
        backdrop-blur-xl

        sm:p-8
        md:rounded-[38px] md:p-10
        lg:p-12
      "
    >
      {/* ==========================================
          DECORATIVE BACKGROUND
      ========================================== */}

      <div
        aria-hidden="true"
        className="
          pointer-events-none
          absolute -right-24 -top-24
          h-[240px] w-[240px]
          rounded-full bg-[#8FB4C7]/18
          blur-[85px]
        "
      />

      <div
        aria-hidden="true"
        className="
          pointer-events-none
          absolute -bottom-24 -left-24
          h-[250px] w-[250px]
          rounded-full bg-[#D9A5AE]/15
          blur-[90px]
        "
      />

      <div
        aria-hidden="true"
        className="
          pointer-events-none
          absolute inset-[6px]
          rounded-[25px]
          border border-[#B8A27D]/10
          md:rounded-[33px]
        "
      />

      {/* ==========================================
          FORM CONTENT
      ========================================== */}

      <div className="relative z-10">
        {/* ======================================
            FORM HEADING
        ====================================== */}

        <div className="mb-6 text-center md:mb-8">
          <WeddingRings />

          <h3
            className="
              font-wedding-serif
              mt-2 text-[27px]
              font-normal leading-tight
              text-[#31566B]

              sm:text-3xl md:mt-3
            "
          >
            {content.formTitle}
          </h3>

          <p
            className="
              font-wedding-serif
              mx-auto mt-2 max-w-md
              text-[13px] leading-5
              text-[#61726D]/85

              sm:text-[15px] sm:leading-6
            "
          >
            {content.formDescription}
          </p>
        </div>

        {/* ======================================
            HONEYPOT CHỐNG BOT
        ====================================== */}

        <div
          aria-hidden="true"
          className="
            absolute -left-[9999px]
            h-px w-px overflow-hidden
          "
        >
          <label htmlFor="wishes-website">
            Website
          </label>

          <input
            id="wishes-website"
            type="text"
            name="website"
            autoComplete="off"
            tabIndex={-1}
            value={website}
            onChange={(event) =>
              setWebsite(event.target.value)
            }
          />
        </div>

        {/* ======================================
            1. HỌ VÀ TÊN
        ====================================== */}

        <div className="mb-6 sm:mb-7">
          <FormLabel htmlFor="wishes-guest-name">
            Họ và tên *
          </FormLabel>

          <input
            id="wishes-guest-name"
            type="text"
            name="guestName"
            required
            minLength={2}
            maxLength={100}
            autoComplete="name"
            placeholder="Nhập họ và tên"
            value={name}
            disabled={isSubmitting}
            onChange={(event) => {
              setName(event.target.value);
              clearFeedback();
            }}
            className={fieldClassName}
          />
        </div>

        {/* ======================================
            2. MỐI QUAN HỆ
        ====================================== */}

        <div className="mb-6 sm:mb-7">
          <FormLabel htmlFor="wishes-relation">
            Mối quan hệ *
          </FormLabel>

          <select
            id="wishes-relation"
            name="relation"
            required
            value={relation}
            disabled={isSubmitting}
            onChange={(event) => {
              setRelation(event.target.value);
              clearFeedback();
            }}
            className={fieldClassName}
          >
            {content.relations.map((item) => (
              <option
                key={item}
                value={item}
              >
                {item}
              </option>
            ))}
          </select>
        </div>

        {/* ======================================
            3. XÁC NHẬN THAM DỰ
            CHỈ CHỌN MỘT PHƯƠNG ÁN
        ====================================== */}

        <fieldset className="mb-6 sm:mb-7">
          <legend
            className="
              mb-3 text-[10px]
              font-medium uppercase
              tracking-[0.18em]
              text-[#587589]
              sm:text-[11px]
            "
          >
            Xác nhận tham dự *
          </legend>

          <div className="grid gap-2.5">
            {RSVP_OPTIONS.map((option) => {
              const selected =
                rsvpStatus === option.value;

              return (
                <label
                  key={option.value}
                  className={`
                    group flex min-h-[49px]
                    cursor-pointer items-center
                    gap-3 rounded-xl border
                    px-4 py-3
                    transition-all duration-300

                    ${
                      selected
                        ? "border-[#B8A27D]/65 bg-[#F8F4EA]/85"
                        : "border-[#7A9CAC]/25 bg-white/45 hover:border-[#B8A27D]/55 hover:bg-white/70"
                    }

                    ${
                      isSubmitting ||
                      loadingSavedRsvp
                        ? "cursor-wait opacity-60"
                        : ""
                    }
                  `}
                >
                  {/* Radio input thật */}

                  <input
                    type="radio"
                    name="rsvpStatus"
                    value={option.value}
                    checked={selected}
                    disabled={
                      isSubmitting ||
                      loadingSavedRsvp
                    }
                    onChange={() => {
                      setRsvpStatus(
                        option.value
                      );

                      clearFeedback();
                    }}
                    className="sr-only"
                  />

                  {/* Ô tick hiển thị */}

                  <span
                    aria-hidden="true"
                    className={`
                      flex h-[20px] w-[20px]
                      shrink-0 items-center
                      justify-center rounded-[6px]
                      border transition-all duration-300

                      ${
                        selected
                          ? "border-[#31566B] bg-[#31566B] text-white"
                          : "border-[#9BAEB1] bg-white/80 text-transparent"
                      }

                      group-focus-within:ring-2
                      group-focus-within:ring-[#B8A27D]/45
                    `}
                  >
                    <Check
                      size={13}
                      strokeWidth={2.5}
                    />
                  </span>

                  <span
                    className={`
                      font-wedding-serif
                      text-[15px] leading-6
                      sm:text-[16px]

                      ${
                        selected
                          ? "font-medium text-[#31566B]"
                          : "text-[#61726D]"
                      }
                    `}
                  >
                    {option.label}
                  </span>
                </label>
              );
            })}
          </div>

          {/* Đang tải RSVP trước đó */}

          {loadingSavedRsvp && (
            <p className="font-wedding-serif mt-2 text-[12px] text-[#61726D]/75">
              Đang kiểm tra xác nhận trước đó...
            </p>
          )}

          {/* Khách đã từng xác nhận */}

          {hasSavedRsvp &&
            !loadingSavedRsvp && (
              <p className="font-wedding-serif mt-2 text-[12px] italic leading-5 text-[#61726D]/75">
                Bạn đã từng xác nhận tham dự.
                Có thể thay đổi lựa chọn khi gửi lại.
              </p>
            )}
        </fieldset>

        {/* ======================================
            4. LỜI CHÚC
        ====================================== */}

        <div className="mb-6 sm:mb-7">
          <FormLabel htmlFor="wishes-message">
            Lời chúc dành cho Nam &amp; Thư *
          </FormLabel>

          <textarea
            id="wishes-message"
            name="message"
            required
            minLength={2}
            maxLength={500}
            rows={5}
            value={message}
            disabled={isSubmitting}
            onChange={(event) => {
              setMessage(event.target.value);
              clearFeedback();
            }}
            placeholder={
              content.messagePlaceholder
            }
            className={`
              ${fieldClassName}
              min-h-[150px] resize-none
              py-4 leading-7
              sm:min-h-[170px]
            `}
          />

          <div
            className="
              mt-2 flex items-center
              justify-between gap-4
            "
          >
            <span
              className="
                font-wedding-serif
                text-[11px] italic
                text-[#61726D]/65
              "
            >
              {content.messageHint}{" "}

              <Heart
                size={10}
                fill="currentColor"
                strokeWidth={1}
                className="inline text-[#C98792]"
              />
            </span>

            <span
              className="
                text-[10px] font-medium
                tracking-[0.06em]
                text-[#587589]/70
              "
            >
              {message.length}/500
            </span>
          </div>
        </div>

        {/* ======================================
            THÔNG BÁO GỬI THÀNH CÔNG / LỖI
        ====================================== */}

        {feedback && (
          <div
            role={
              status === "error"
                ? "alert"
                : "status"
            }
            aria-live="polite"
            className={`
              mb-5 rounded-xl border
              px-4 py-3
              font-wedding-serif
              text-[13px] leading-6
              sm:text-[14px]

              ${
                status === "success"
                  ? "border-[#9CC8AF]/45 bg-[#EBF6EE]/80 text-[#4A7765]"
                  : "border-[#DDA7A8]/45 bg-[#FFF0F0]/80 text-[#B15C64]"
              }
            `}
          >
            {feedback}
          </div>
        )}

        {/* ======================================
            5. MỘT NÚT GỬI DUY NHẤT
        ====================================== */}

        <button
          type="submit"
          disabled={
            isSubmitting ||
            loadingSavedRsvp
          }
          className="
            group mt-2 flex
            min-h-[54px] w-full
            items-center justify-center
            gap-3 rounded-full

            bg-[#31566B]
            px-7 py-4

            text-[10px] font-medium
            uppercase tracking-[0.19em]
            text-white

            shadow-[0_14px_38px_rgba(49,86,107,0.18)]
            transition-all duration-300

            hover:-translate-y-0.5
            hover:bg-[#587589]

            disabled:cursor-wait
            disabled:opacity-60

            sm:text-[11px]
          "
        >
          {isSubmitting ? (
            <>
              <LoaderCircle
                size={17}
                className="animate-spin"
              />

              Đang gửi thông tin...
            </>
          ) : (
            <>
              <Heart
                size={14}
                fill="currentColor"
                strokeWidth={1}
                className="text-[#F1C5CB]"
              />

              {content.submitLabel}

              <Send
                size={14}
                strokeWidth={1.6}
              />
            </>
          )}
        </button>

        <p
          className="
            font-wedding-serif
            mt-3 text-center
            text-[11px] italic leading-5
            text-[#61726D]/65
          "
        >
          Vui lòng điền đầy đủ thông tin
          và xác nhận tham dự trước khi gửi.
        </p>
      </div>
    </form>
  );
}

// ======================================================
// MAIN WISHES
//
// GIỮ NGUYÊN:
// - Background gradient.
// - Decorative glow.
// - Desktop hai cột.
// - Mobile một cột.
// - Nội dung bên trái.
// - Form và nhẫn cưới bên phải.
// ======================================================

export default function Wishes({
  guestName,
  guestSide,
}: WishesProps) {
  return (
    <section
      id="wishes"
      className="
        relative -mt-px
        scroll-mt-16
        overflow-hidden

        bg-[linear-gradient(to_bottom,#EEF4F6_0%,#EEF4F6_18%,#F1F5F1_45%,#F5F5EC_73%,#FAF3EF_100%)]

        px-5 pb-12 pt-12
        sm:px-6 sm:pb-14 sm:pt-14
        md:px-8 md:pb-16 md:pt-16
        lg:pb-20 lg:pt-20
      "
    >
      {/* GLOW BÊN TRÁI */}

      <div
        aria-hidden="true"
        className="
          pointer-events-none
          absolute -left-40 top-[10%]
          h-[390px] w-[390px]
          rounded-full bg-[#8FB4C7]/12
          blur-[125px]
          md:h-[500px] md:w-[500px]
        "
      />

      {/* GLOW BÊN PHẢI */}

      <div
        aria-hidden="true"
        className="
          pointer-events-none
          absolute -right-40 bottom-[8%]
          h-[410px] w-[410px]
          rounded-full bg-[#D9A5AE]/12
          blur-[135px]
          md:h-[520px] md:w-[520px]
        "
      />

      {/* BỐ CỤC HAI CỘT */}

      <div
        className="
          relative z-10 mx-auto
          grid max-w-[1160px]
          items-center gap-10
          sm:gap-12
          lg:grid-cols-[0.82fr_1.18fr]
          lg:gap-12 xl:gap-16
        "
      >
        <WishesIntroduction />

        <WishesForm
          invitationGuestName={guestName}
          invitationGuestSide={guestSide}
        />
      </div>
    </section>
  );
}
