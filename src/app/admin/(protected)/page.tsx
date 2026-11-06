
import { Suspense } from "react";
import { redirect } from "next/navigation";
import { connection } from "next/server";

import {
  CheckCircle2,
  Clock3,
  Heart,
  HelpCircle,
  Mail,
  MessageCircleHeart,
  Send,
  ShieldCheck,
  Users,
  UserCheck,
  UserX,
  type LucideIcon,
} from "lucide-react";

import {
  getCurrentAdmin,
  getAdminRoleLabel,
  type CurrentAdmin,
} from "@/lib/admin-auth";

import { getDatabase } from "@/lib/mongodb";

// ======================================================
// NAM & THU - ADMIN DASHBOARD
//
// BỐ CỤC MỚI:
//
// 1. Tổng quan hệ thống
//    - Tổng khách mời
//    - Tổng thiệp mời
//    - Tổng lời chúc
//
// 2. Khách mời & xác nhận tham dự
//    - Giữ nguyên thống kê Nhà trai / Nhà gái
//    - Giữ nguyên RSVP
//    - Giữ nguyên tình trạng gửi thiệp
//
// 3. Thống kê lời chúc
//    - Tổng lời chúc
//    - Chờ duyệt
//    - Đã duyệt
//    - Đã ẩn
//    - Tỷ lệ kiểm duyệt
//
// ĐÃ LOẠI BỎ:
// - Truy cập nhanh và các module.
// - Khối giới thiệu bảo mật hệ thống.
// - Thẻ vai trò hiện tại.
// - Thẻ phạm vi quản lý.
//
// GIỮ NGUYÊN:
// - Kiểm tra đăng nhập tại server.
// - Phân quyền theo vai trò Admin.
// - Truy vấn MongoDB.
// - Các số liệu RSVP.
// - Không hiển thị số liệu giả khi không có DB.
// ======================================================

// ======================================================
// TYPES
// ======================================================

interface GuestStatistics {
  total: number;
  groom: number;
  bride: number;
  attending: number;
  declined: number;
  unsure: number;
  noResponse: number;
}

interface InvitationStatistics {
  total: number;
  sent: number;
  notSent: number;
}

interface WishStatistics {
  total: number;
  pending: number;
  approved: number;
  hidden: number;
}

interface DashboardStatistics {
  guests: GuestStatistics | null;
  invitations: InvitationStatistics | null;
  wishes: WishStatistics | null;
  errors: string[];
}

// ======================================================
// MONGODB COLLECTION NAMES
//
// Giữ nguyên tên collection trong file gốc.
// Không tự thay đổi cấu trúc database.
// ======================================================

const COLLECTIONS = {
  guests: "guests",
  invitations: "invitations",
  wishes: "wishes",
} as const;

// ======================================================
// WELCOME TEXT
// ======================================================

function getWelcomeText(admin: CurrentAdmin) {
  if (admin.role === "super_admin") {
    return {
      title: "Chào mừng trở lại!",
      description:
        "Quản lý và theo dõi hoạt động thiệp cưới Nam & Thư tại một nơi.",
    };
  }

  if (admin.role === "groom_admin") {
    return {
      title: "Chào mừng Nhà trai!",
      description:
        "Theo dõi khách mời, thiệp mời và các nội dung thuộc phạm vi Nhà trai.",
    };
  }

  return {
    title: "Chào mừng Nhà gái!",
    description:
      "Theo dõi khách mời, thiệp mời và các nội dung thuộc phạm vi Nhà gái.",
  };
}

// ======================================================
// MONGODB FILTERS
// ======================================================

// Loại trừ bản ghi đã xóa mềm.
// Vẫn hỗ trợ dữ liệu cũ chưa có isDeleted.

const NOT_DELETED = {
  isDeleted: { $ne: true },
};

// ======================================================
// PHẠM VI THỐNG KÊ
//
// Quyền được xác định từ phiên đăng nhập,
// không lấy từ tham số phía client.
// ======================================================

function getSideFilter(admin: CurrentAdmin) {
  if (admin.role === "super_admin") {
    return {};
  }

  const side =
    admin.role === "groom_admin"
      ? "groom"
      : "bride";

  return { side };
}

// Lời chúc dùng trường guestSide,
// khác với guests và invitations.

function getWishSideFilter(admin: CurrentAdmin) {
  if (admin.role === "super_admin") {
    return {};
  }

  const guestSide =
    admin.role === "groom_admin"
      ? "groom"
      : "bride";

  return { guestSide };
}

// ======================================================
// LOAD DASHBOARD STATISTICS
//
// Giữ nguyên cách đọc dữ liệu từ MongoDB.
// Khi không có collection hoặc truy vấn lỗi,
// trả null thay vì đưa ra số 0 giả.
// ======================================================

async function getDashboardStatistics(
  admin: CurrentAdmin
): Promise<DashboardStatistics> {
  const result: DashboardStatistics = {
    guests: null,
    invitations: null,
    wishes: null,
    errors: [],
  };

  try {
    const db = await getDatabase();

    // Kiểm tra collection thực sự đang tồn tại.
    const collectionInfo = await db
      .listCollections(
        {},
        { nameOnly: true }
      )
      .toArray();

    const existingCollections = new Set(
      collectionInfo.map((item) => item.name)
    );

    const sideFilter = getSideFilter(admin);

    const wishSideFilter =
      getWishSideFilter(admin);

    // ==================================================
    // GUESTS & RSVP
    // ==================================================

    if (
      existingCollections.has(
        COLLECTIONS.guests
      )
    ) {
      try {
        const collection = db.collection(
          COLLECTIONS.guests
        );

        const baseFilter = {
          ...NOT_DELETED,
          ...sideFilter,
        };

        const [
          total,
          groom,
          bride,
          attending,
          declined,
          unsure,
          noResponse,
        ] = await Promise.all([
          collection.countDocuments(
            baseFilter
          ),

          collection.countDocuments({
            ...baseFilter,
            side: "groom",
          }),

          collection.countDocuments({
            ...baseFilter,
            side: "bride",
          }),

          collection.countDocuments({
            ...baseFilter,
            rsvpStatus: "attending",
          }),

          collection.countDocuments({
            ...baseFilter,
            rsvpStatus: "declined",
          }),

          collection.countDocuments({
            ...baseFilter,
            rsvpStatus: "unsure",
          }),

          // Hỗ trợ khách chưa phản hồi
          // và các bản ghi cũ chưa có rsvpStatus.

          collection.countDocuments({
            ...baseFilter,
            $or: [
              {
                rsvpStatus: "no_response",
              },
              {
                rsvpStatus: null,
              },
              {
                rsvpStatus: {
                  $exists: false,
                },
              },
            ],
          }),
        ]);

        result.guests = {
          total,
          groom,
          bride,
          attending,
          declined,
          unsure,
          noResponse,
        };
      } catch (error) {
        console.error(
          "[DASHBOARD GUESTS]",
          error
        );

        result.errors.push(
          "Không thể tải thống kê khách mời."
        );
      }
    } else {
      result.errors.push(
        'Không tìm thấy collection "guests".'
      );
    }

    // ==================================================
    // INVITATIONS
    // ==================================================

    if (
      existingCollections.has(
        COLLECTIONS.invitations
      )
    ) {
      try {
        const collection = db.collection(
          COLLECTIONS.invitations
        );

        const baseFilter = {
          ...NOT_DELETED,
          ...sideFilter,
        };

        const [
          total,
          sent,
          notSent,
        ] = await Promise.all([
          collection.countDocuments(
            baseFilter
          ),

          collection.countDocuments({
            ...baseFilter,
            deliveryStatus: "sent",
          }),

          collection.countDocuments({
            ...baseFilter,
            $or: [
              {
                deliveryStatus:
                  "not_sent",
              },
              {
                deliveryStatus: null,
              },
              {
                deliveryStatus: {
                  $exists: false,
                },
              },
            ],
          }),
        ]);

        result.invitations = {
          total,
          sent,
          notSent,
        };
      } catch (error) {
        console.error(
          "[DASHBOARD INVITATIONS]",
          error
        );

        result.errors.push(
          "Không thể tải thống kê thiệp mời."
        );
      }
    } else {
      result.errors.push(
        'Chưa xác nhận được collection "invitations".'
      );
    }

    // ==================================================
    // WISHES
    // ==================================================

    if (
      existingCollections.has(
        COLLECTIONS.wishes
      )
    ) {
      try {
        const collection = db.collection(
          COLLECTIONS.wishes
        );

        const baseFilter = {
          ...NOT_DELETED,
          ...wishSideFilter,
        };

        const [
          total,
          pending,
          approved,
          hidden,
        ] = await Promise.all([
          collection.countDocuments(
            baseFilter
          ),

          collection.countDocuments({
            ...baseFilter,
            status: "pending",
          }),

          collection.countDocuments({
            ...baseFilter,
            status: "approved",
          }),

          collection.countDocuments({
            ...baseFilter,
            status: "hidden",
          }),
        ]);

        result.wishes = {
          total,
          pending,
          approved,
          hidden,
        };
      } catch (error) {
        console.error(
          "[DASHBOARD WISHES]",
          error
        );

        result.errors.push(
          "Không thể tải thống kê lời chúc."
        );
      }
    } else {
      result.errors.push(
        'Chưa xác nhận được collection "wishes".'
      );
    }
  } catch (error) {
    console.error(
      "[DASHBOARD MONGODB]",
      error
    );

    result.errors.push(
      "Không thể kết nối hoặc đọc dữ liệu MongoDB."
    );
  }

  return result;
}

// ======================================================
// DISPLAY HELPERS
// ======================================================

function formatCount(
  value: number | null | undefined
): string {
  if (
    value === null ||
    value === undefined
  ) {
    return "—";
  }

  return value.toLocaleString("vi-VN");
}

// ======================================================
// SECTION HEADING
//
// Sử dụng chung cho 3 phần thống kê.
// ======================================================

function SectionHeading({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="mb-5">
      <h2 className="font-wedding-serif text-[27px] font-normal leading-tight text-[#31566B] sm:text-[31px]">
        {title}
      </h2>

      <p className="mt-1.5 text-xs leading-6 text-[#8F9D9F]">
        {description}
      </p>
    </div>
  );
}

// ======================================================
// STAT CARD
//
// Dùng cho Tổng quan, RSVP và lời chúc.
// ======================================================

function StatCard({
  icon: Icon,
  label,
  value,
  subtitle,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  subtitle: string;
}) {
  return (
    <div
      className="
        flex h-full flex-col
        rounded-[20px]
        border border-[#E8E3D9]
        bg-white p-5
        shadow-[0_5px_20px_rgba(49,86,107,0.035)]
        sm:p-6
      "
    >
      {/* ICON */}

      <div className="mb-5 flex h-11 w-11 items-center justify-center rounded-xl bg-[#F4F5F0] text-[#61726D]">
        <Icon
          size={20}
          strokeWidth={1.65}
        />
      </div>

      {/* LABEL */}

      <p className="text-xs font-medium text-[#87989A]">
        {label}
      </p>

      {/* VALUE */}

      <p className="mt-2 break-words text-[25px] font-semibold leading-tight tabular-nums text-[#31566B]">
        {value}
      </p>

      {/* SUBTITLE */}

      <p className="mt-2 text-[11px] leading-5 text-[#A0AAAB]">
        {subtitle}
      </p>
    </div>
  );
}

// ======================================================
// PROGRESS BAR
//
// Giữ nguyên biểu đồ dạng thanh từ file gốc.
// ======================================================

function ProgressBar({
  label,
  value,
  total,
  color,
}: {
  label: string;
  value: number;
  total: number;
  color: string;
}) {
  const percentage =
    total > 0
      ? Math.min(
          100,
          Math.max(
            0,
            (value / total) * 100
          )
        )
      : 0;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-3 text-[12px]">
        <span className="text-[#61726D]">
          {label}
        </span>

        <span className="shrink-0 font-semibold tabular-nums text-[#31566B]">
          {value.toLocaleString("vi-VN")}
          {" · "}
          {percentage.toFixed(1)}%
        </span>
      </div>

      <div className="h-2.5 overflow-hidden rounded-full bg-[#F0F1EB]">
        <div
          className={`h-full rounded-full transition-all duration-500 ${color}`}
          style={{
            width: `${percentage}%`,
          }}
        />
      </div>
    </div>
  );
}

// ======================================================
// OVERVIEW SECTION
//
// CHỈ CÒN 3 THẺ:
// - Tổng khách mời.
// - Tổng thiệp mời.
// - Tổng lời chúc.
//
// Không còn "Thiệp đã gửi" và
// "Lời chúc chờ duyệt" ở phần này.
// ======================================================

function OverviewSection({
  statistics,
}: {
  statistics: DashboardStatistics;
}) {
  return (
    <section
      aria-labelledby="dashboard-overview"
      className="mb-9"
    >
      <div id="dashboard-overview">
        <SectionHeading
          title="Tổng quan hệ thống"
          description="Số liệu trực tiếp từ cơ sở dữ liệu theo phạm vi tài khoản đang đăng nhập."
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <StatCard
          icon={Users}
          label="Tổng khách mời"
          value={formatCount(
            statistics.guests?.total
          )}
          subtitle="Số khách mời đang được quản lý"
        />

        <StatCard
          icon={Mail}
          label="Tổng thiệp mời"
          value={formatCount(
            statistics.invitations?.total
          )}
          subtitle="Số thiệp mời đã tạo trong hệ thống"
        />

        <StatCard
          icon={MessageCircleHeart}
          label="Tổng lời chúc"
          value={formatCount(
            statistics.wishes?.total
          )}
          subtitle="Số lời chúc đã nhận và chưa bị xóa"
        />
      </div>
    </section>
  );
}

// ======================================================
// GUEST & RSVP SECTION
//
// GIỮ NGUYÊN:
// - Khách Nhà trai.
// - Khách Nhà gái.
// - Sẽ tham dự.
// - Không tham dự.
// - Tỷ lệ phản hồi RSVP.
// - Tình trạng gửi thiệp.
// ======================================================

function GuestAndRsvpSection({
  guests,
  invitations,
}: {
  guests: GuestStatistics | null;
  invitations: InvitationStatistics | null;
}) {
  return (
    <section
      aria-labelledby="dashboard-rsvp"
      className="mb-9"
    >
      <div id="dashboard-rsvp">
        <SectionHeading
          title="Khách mời & xác nhận tham dự"
          description="Theo dõi số lượng khách và tình trạng RSVP."
        />
      </div>

      {/* THỐNG KÊ KHÁCH MỜI */}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          icon={Users}
          label="Khách Nhà trai"
          value={formatCount(
            guests?.groom
          )}
          subtitle="Khách thuộc danh sách Nhà trai"
        />

        <StatCard
          icon={Users}
          label="Khách Nhà gái"
          value={formatCount(
            guests?.bride
          )}
          subtitle="Khách thuộc danh sách Nhà gái"
        />

        <StatCard
          icon={UserCheck}
          label="Sẽ tham dự"
          value={formatCount(
            guests?.attending
          )}
          subtitle="Khách đã xác nhận tham dự"
        />

        <StatCard
          icon={UserX}
          label="Không tham dự"
          value={formatCount(
            guests?.declined
          )}
          subtitle="Khách đã từ chối tham dự"
        />
      </div>

      {/* RSVP & INVITATION PROGRESS */}

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        {/* RSVP STATUS */}

        <div className="rounded-[20px] border border-[#E8E3D9] bg-white p-5 shadow-sm sm:p-6">
          <div className="mb-6 flex items-center gap-2">
            <CheckCircle2
              size={19}
              className="text-[#B8A27D]"
            />

            <h3 className="text-[14px] font-semibold text-[#31566B]">
              Tỷ lệ phản hồi RSVP
            </h3>
          </div>

          {guests ? (
            <div className="space-y-5">
              <ProgressBar
                label="Sẽ tham dự"
                value={guests.attending}
                total={guests.total}
                color="bg-[#568567]"
              />

              <ProgressBar
                label="Không tham dự"
                value={guests.declined}
                total={guests.total}
                color="bg-[#C98792]"
              />

              <ProgressBar
                label="Chưa chắc chắn"
                value={guests.unsure}
                total={guests.total}
                color="bg-[#B8A27D]"
              />

              <ProgressBar
                label="Chưa phản hồi"
                value={guests.noResponse}
                total={guests.total}
                color="bg-[#92A8B2]"
              />
            </div>
          ) : (
            <p className="text-[13px] text-[#87989A]">
              Chưa có số liệu RSVP khả dụng.
            </p>
          )}
        </div>

        {/* INVITATION DELIVERY STATUS */}

        <div className="rounded-[20px] border border-[#E8E3D9] bg-white p-5 shadow-sm sm:p-6">
          <div className="mb-6 flex items-center gap-2">
            <Send
              size={19}
              className="text-[#B8A27D]"
            />

            <h3 className="text-[14px] font-semibold text-[#31566B]">
              Tình trạng gửi thiệp
            </h3>
          </div>

          {invitations ? (
            <div className="space-y-5">
              <ProgressBar
                label="Đã gửi"
                value={invitations.sent}
                total={invitations.total}
                color="bg-[#568567]"
              />

              <ProgressBar
                label="Chưa gửi"
                value={invitations.notSent}
                total={invitations.total}
                color="bg-[#B8A27D]"
              />

              <div className="border-t border-[#EEEAE4] pt-4">
                <p className="text-[12px] text-[#87989A]">
                  Tổng thiệp
                </p>

                <p className="mt-2 text-2xl font-semibold tabular-nums text-[#31566B]">
                  {formatCount(
                    invitations.total
                  )}
                </p>
              </div>
            </div>
          ) : (
            <p className="text-[13px] text-[#87989A]">
              Chưa có số liệu thiệp mời khả dụng.
            </p>
          )}
        </div>
      </div>
    </section>
  );
}

// ======================================================
// WISHES SECTION
//
// BỐ CỤC:
// - 4 thẻ thống kê.
// - Một khối tổng hợp tình trạng kiểm duyệt.
//
// Dùng dữ liệu MongoDB đang có.
// Không thêm trạng thái mới vào database.
// ======================================================

function WishesSection({
  wishes,
}: {
  wishes: WishStatistics | null;
}) {
  return (
    <section aria-labelledby="dashboard-wishes">
      <div id="dashboard-wishes">
        <SectionHeading
          title="Thống kê lời chúc"
          description="Theo dõi số lượng lời chúc và tiến độ kiểm duyệt trước khi hiển thị trên thiệp cưới."
        />
      </div>

      {/* 4 THẺ THỐNG KÊ */}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          icon={MessageCircleHeart}
          label="Tổng lời chúc"
          value={formatCount(
            wishes?.total
          )}
          subtitle="Tổng số lời chúc chưa bị xóa"
        />

        <StatCard
          icon={Clock3}
          label="Chờ duyệt"
          value={formatCount(
            wishes?.pending
          )}
          subtitle="Lời chúc đang chờ kiểm duyệt"
        />

        <StatCard
          icon={CheckCircle2}
          label="Đã duyệt"
          value={formatCount(
            wishes?.approved
          )}
          subtitle="Lời chúc đã được phê duyệt"
        />

        <StatCard
          icon={ShieldCheck}
          label="Đã ẩn"
          value={formatCount(
            wishes?.hidden
          )}
          subtitle="Lời chúc không hiển thị công khai"
        />
      </div>

      {/* TỔNG HỢP KIỂM DUYỆT */}

      <div className="mt-4 rounded-[20px] border border-[#E8E3D9] bg-white p-5 shadow-[0_5px_20px_rgba(49,86,107,0.035)] sm:p-6">
        <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <MessageCircleHeart
                size={19}
                className="text-[#B8A27D]"
              />

              <h3 className="text-[14px] font-semibold text-[#31566B]">
                Tình trạng kiểm duyệt lời chúc
              </h3>
            </div>

            <p className="mt-2 text-[12px] leading-6 text-[#87989A]">
              Tỷ lệ từng trạng thái trên tổng số lời chúc.
            </p>
          </div>

          {/* TỔNG SỐ */}

          <div className="rounded-xl bg-[#F6F7F2] px-4 py-3 text-center">
            <p className="text-[10px] font-medium text-[#87989A]">
              Tổng lời chúc
            </p>

            <p className="mt-1 text-[20px] font-semibold tabular-nums text-[#31566B]">
              {formatCount(
                wishes?.total
              )}
            </p>
          </div>
        </div>

        {wishes ? (
          <div className="space-y-5">
            <ProgressBar
              label="Chờ duyệt"
              value={wishes.pending}
              total={wishes.total}
              color="bg-[#B8A27D]"
            />

            <ProgressBar
              label="Đã duyệt"
              value={wishes.approved}
              total={wishes.total}
              color="bg-[#568567]"
            />

            <ProgressBar
              label="Đã ẩn"
              value={wishes.hidden}
              total={wishes.total}
              color="bg-[#C98792]"
            />

            {/* GHI CHÚ */}

            <div className="border-t border-[#EEEAE4] pt-4">
              <p className="text-[11px] leading-6 text-[#9AA7A7]">
                Số liệu được tổng hợp trực tiếp từ trạng thái
                lời chúc trong cơ sở dữ liệu và giới hạn theo phạm vi
                tài khoản đang đăng nhập.
              </p>
            </div>
          </div>
        ) : (
          <p className="text-[13px] text-[#87989A]">
            Chưa có số liệu kiểm duyệt lời chúc khả dụng.
          </p>
        )}
      </div>
    </section>
  );
}

// ======================================================
// DASHBOARD CONTENT
//
// CHỈ CÒN:
// - Welcome
// - Cảnh báo MongoDB nếu có
// - Tổng quan hệ thống
// - Khách mời & xác nhận tham dự
// - Thống kê lời chúc
// ======================================================

function DashboardContent({
  admin,
  statistics,
}: {
  admin: CurrentAdmin;
  statistics: DashboardStatistics;
}) {
  const welcome =
    getWelcomeText(admin);

  return (
    <main className="mx-auto w-full max-w-[1450px] px-4 py-7 sm:px-6 sm:py-9 xl:px-8">
      {/* ==========================================
          BREADCRUMB
      ========================================== */}

      <div className="mb-6 flex items-center gap-2 text-[12px] text-[#9AA7A7]">
        <span>Quản trị</span>
        <span>/</span>
        <span className="font-medium text-[#31566B]">
          Tổng quan
        </span>
      </div>

      {/* ==========================================
          WELCOME BANNER

          Giữ lại phần chào mừng và tài khoản.
          Không hiển thị thêm các thẻ phân quyền.
      ========================================== */}

      <section className="relative mb-7 overflow-hidden rounded-[24px] border border-[#E6E0D6] bg-gradient-to-br from-[#FFFFFF] via-[#FBF9F3] to-[#F4EDE9] px-6 py-8 sm:px-9 sm:py-10">
        <Heart
          aria-hidden="true"
          size={150}
          strokeWidth={0.6}
          className="pointer-events-none absolute -right-6 -top-7 rotate-[-17deg] text-[#E2B5BA]/30"
        />

        <div className="relative z-10">
          {/* ROLE BADGE TRONG BANNER */}

          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-[#E7DED0] bg-white/80 px-3 py-2">
            <ShieldCheck
              size={15}
              className="text-[#B8A27D]"
            />

            <span className="text-[11px] font-medium text-[#6D7F7D]">
              {getAdminRoleLabel(
                admin.role
              )}
            </span>
          </div>

          {/* WELCOME */}

          <h1 className="font-wedding-serif text-[35px] font-normal leading-tight text-[#31566B] sm:text-[45px]">
            {welcome.title}
          </h1>

          <p className="mt-3 max-w-2xl text-[13px] leading-7 text-[#74868A] sm:text-sm">
            {welcome.description}
          </p>

          <p className="mt-3 text-[12px] text-[#9BA6A7]">
            Đang đăng nhập tài khoản:{" "}
            <strong className="text-[#31566B]">
              {admin.username}
            </strong>
          </p>
        </div>
      </section>

      {/* ==========================================
          DATABASE WARNINGS

          Vẫn giữ cảnh báo để không che giấu
          trường hợp số liệu MongoDB bị lỗi.
      ========================================== */}

      {statistics.errors.length > 0 && (
        <section
          role="status"
          className="mb-7 rounded-[18px] border border-[#EADCC4] bg-[#FFF9EE] px-5 py-4"
        >
          <div className="flex items-start gap-3">
            <HelpCircle
              size={20}
              className="mt-0.5 shrink-0 text-[#B08B54]"
            />

            <div>
              <p className="text-[13px] font-semibold text-[#876C43]">
                Một số thống kê chưa khả dụng
              </p>

              <ul className="mt-2 list-disc space-y-1 pl-4 text-[12px] leading-6 text-[#987C55]">
                {statistics.errors.map(
                  (message, index) => (
                    <li key={index}>
                      {message}
                    </li>
                  )
                )}
              </ul>
            </div>
          </div>
        </section>
      )}

      {/* ==========================================
          1. TỔNG QUAN HỆ THỐNG
      ========================================== */}

      <OverviewSection
        statistics={statistics}
      />

      {/* ==========================================
          2. KHÁCH MỜI & XÁC NHẬN THAM DỰ
      ========================================== */}

      <GuestAndRsvpSection
        guests={statistics.guests}
        invitations={statistics.invitations}
      />

      {/* ==========================================
          3. THỐNG KÊ LỜI CHÚC
      ========================================== */}

      <WishesSection
        wishes={statistics.wishes}
      />

      {/* 
        ĐÃ BỎ:
        - Truy cập nhanh
        - Danh sách các module quản trị
        - Hệ thống quản trị được bảo vệ
        - Vai trò hiện tại
        - Phạm vi quản lý

        Không ảnh hưởng đến các trang Admin khác.
      */}
    </main>
  );
}

// ======================================================
// SERVER ACCESS
//
// Kiểm tra phiên đăng nhập tại máy chủ.
// Không thay đổi cơ chế xác thực.
// ======================================================

async function DashboardAccessGate() {
  // Bảo đảm dữ liệu được lấy trong request hiện tại.
  await connection();

  const admin =
    await getCurrentAdmin();

  if (!admin) {
    redirect("/admin/login");
  }

  const statistics =
    await getDashboardStatistics(admin);

  return (
    <DashboardContent
      admin={admin}
      statistics={statistics}
    />
  );
}

// ======================================================
// LOADING
// ======================================================

function DashboardLoading() {
  return (
    <div className="flex min-h-[70vh] items-center justify-center px-4">
      <div className="text-center">
        <div
          aria-hidden="true"
          className="mx-auto mb-4 h-9 w-9 animate-spin rounded-full border-[3px] border-[#E4E8E5] border-t-[#31566B]"
        />

        <p className="text-sm text-[#849396]">
          Đang tải thống kê cơ sở dữ liệu...
        </p>
      </div>
    </div>
  );
}

// ======================================================
// PAGE EXPORT
// ======================================================

export default function AdminDashboardPage() {
  return (
    <Suspense fallback={<DashboardLoading />}>
      <DashboardAccessGate />
    </Suspense>
  );
}
