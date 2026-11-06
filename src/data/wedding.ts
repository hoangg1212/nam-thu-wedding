
/**
 * NAM & THƯ - WEDDING DATA
 *
 * Dữ liệu dùng chung cho website thiệp cưới.
 *
 * Lưu ý:
 * - Giữ tương thích với các component hiện tại.
 * - Gallery và Love Story còn được dùng làm dữ liệu khởi tạo MongoDB.
 * - Không thay thế thông tin chưa xác nhận bằng dữ liệu giả.
 */

// ======================================================
// TYPES
// ======================================================

export type GuestSide = "bride" | "groom";

export interface WeddingPerson {
  shortName: string;
  fullName: string;
  illustration: string;
  parents: {
    father: string;
    mother: string;
  };
}

export interface WeddingLocation {
  title: string;
  family: string;
  address: string;
  mapUrl: string;
  time: string;
  eventDate: string;
  eventTitle: string;
  weekdayLabel: string;
}

export interface HeroSection {
  eyebrow: string;
  quote: string;
  ctaText: string;
  ctaHref: string;
  desktopBackground: string;
  mobileBackground: string;
  backgroundAlt: string;
}

export interface WeddingInvitationData {
  title: string;
  detailsTitle: string;
  subtitle: string;
  message: string;
  ceremonyText: string;
  closingMessage: string;
}

export interface WeddingCalendarData {
  month: number;
  year: number;
  monthLabel: string;
  highlightedDates: number[];
  backgroundImage: string;
  note: string;
}

export interface WeddingStorySection {
  eyebrow: string;
  title: string;
  description: string;
  closingMessage: string;
}

export interface LoveStoryItem {
  id: string;
  date: string;
  title: string;
  description: string;
  image: string;
}

export interface WeddingWishesData {
  eyebrow: string;
  title: string;
  titleAccent: string;
  description: string;
  secondaryDescription: string;
  formTitle: string;
  formDescription: string;
  relations: string[];
  messagePlaceholder: string;
  messageHint: string;
  submitLabel: string;
  successMessage: string;
}

export interface ThankYouData {
  title: string;
  message: string;
  backgroundImage: string;
}

export interface WeddingData {
  groom: WeddingPerson;
  bride: WeddingPerson;

  date: string;
  displayDate: string;

  heroImage: string;
  heroSection: HeroSection;

  musicUrl: string;

  invitation: WeddingInvitationData;
  calendar: WeddingCalendarData;

  locations: {
    bride: WeddingLocation;
    groom: WeddingLocation;
  };

  gallery: string[];

  storySection: WeddingStorySection;
  stories: LoveStoryItem[];

  wishes: WeddingWishesData;
  thankYou: ThankYouData;
}

// ======================================================
// MAIN DATA
// ======================================================

export const wedding: WeddingData = {
  // ----------------------------------------------------
  // CÔ DÂU & CHÚ RỂ
  // ----------------------------------------------------

  groom: {
    shortName: "Nam",
    fullName: "Nguyễn Nam",
    illustration: "/images/chure.png",
    parents: {
      father: "Tên thân phụ chú rể",
      mother: "Tên thân mẫu chú rể",
    },
  },

  bride: {
    shortName: "Thư",
    fullName: "Huỳnh Thư",
    illustration: "/images/codau.png",
    parents: {
      father: "Tên thân phụ cô dâu",
      mother: "Tên thân mẫu cô dâu",
    },
  },

  // ----------------------------------------------------
  // NGÀY CƯỚI
  // ----------------------------------------------------

  // 10:00 là mốc tạm cho Countdown,
  // chưa phải giờ tổ chức chính thức.
  date: "2026-12-26T10:00:00+07:00",

  displayDate: "26 – 27.12.2026",

  // ----------------------------------------------------
  // HERO
  // ----------------------------------------------------

  heroImage: "/images/hero.jpg",

  heroSection: {
    eyebrow: "THE WEDDING OF",

    quote:
      "Từ những điều bình dị, chúng mình đã tìm thấy nhau, " +
      "để rồi cùng viết tiếp một hành trình yêu thương.",

    ctaText: "Xem thư mời",
    ctaHref: "#invitation",

    desktopBackground: "/images/hero.jpg",
    mobileBackground: "/images/hero.jpg",
    backgroundAlt: "Ảnh cưới của Nam và Thư",
  },

  // ----------------------------------------------------
  // NHẠC NỀN
  // ----------------------------------------------------

  musicUrl: "/audio/wedding.mp3",

  // ----------------------------------------------------
  // THƯ MỜI
  // ----------------------------------------------------

  invitation: {
    title: "Thư mời tham dự lễ cưới",
    detailsTitle: "Thông Tin Hôn Lễ",
    subtitle: "THE WEDDING INVITATION",

    message:
      "Trân trọng kính mời Quý khách đến chung vui " +
      "và chứng kiến ngày hạnh phúc của chúng mình.",

    ceremonyText: "Hôn lễ được cử hành tại tư gia",

    closingMessage:
      "Sự hiện diện của Quý khách là niềm vui " +
      "và vinh hạnh đối với hai gia đình chúng mình.",
  },

  // ----------------------------------------------------
  // LỊCH CƯỚI
  // ----------------------------------------------------

  calendar: {
    month: 12,
    year: 2026,
    monthLabel: "Tháng 12",
    highlightedDates: [26, 27],
    backgroundImage:
      "/images/wedding-details-calendar-bg.jpg",

    note:
      "26 · Bữa tiệc chung vui  |  " +
      "27 · Lễ thành hôn",
  },

  // ----------------------------------------------------
  // ĐỊA ĐIỂM - DỮ LIỆU MẶC ĐỊNH
  // ----------------------------------------------------

  locations: {
    bride: {
      title: "Tư Gia Nhà Gái",
      family: "Gia đình nhà gái",
      address: "",
      mapUrl: "",
      time: "",
      eventDate: "2026-12-26",
      eventTitle: "Bữa tiệc chung vui",
      weekdayLabel: "Thứ Bảy",
    },

    groom: {
      title: "Tư Gia Nhà Trai",
      family: "Gia đình nhà trai",
      address: "",
      mapUrl: "",
      time: "",
      eventDate: "2026-12-27",
      eventTitle: "Lễ thành hôn",
      weekdayLabel: "Chủ nhật",
    },
  },

  // ----------------------------------------------------
  // GALLERY - DỮ LIỆU KHỞI TẠO / DỰ PHÒNG
  //
  // Chưa xóa vì Gallery.tsx và
  // wedding-gallery.ts vẫn sử dụng.
  // ----------------------------------------------------

  gallery: [
    "/images/album-01.jpg",
    "/images/album-02.jpg",
    "/images/album-03.jpg",
    "/images/album-04.jpg",
    "/images/album-05.jpg",
    "/images/album-06.jpg",
    "/images/album-07.jpg",
    "/images/album-08.jpg",
  ],

  // ----------------------------------------------------
  // LOVE STORY - NỘI DUNG SECTION
  // ----------------------------------------------------

  storySection: {
    eyebrow: "NHỮNG DẤU MỐC YÊU THƯƠNG",
    title: "Hành trình của chúng mình",

    description:
      "Mỗi chặng đường đều có những kỷ niệm riêng. " +
      "Có những ngày thật vui, cũng có những lúc " +
      "cần thêm một chút thấu hiểu, nhưng chính " +
      "tất cả những điều ấy đã giúp chúng mình " +
      "ngày càng gần nhau hơn.",

    closingMessage:
      "Và từ đây, chúng mình sẽ cùng viết tiếp " +
      "một hành trình mới.",
  },

  // ----------------------------------------------------
  // LOVE STORY - DỮ LIỆU KHỞI TẠO MONGODB
  //
  // Chưa xóa vì wedding-stories.ts
  // đang sử dụng wedding.stories.
  // ----------------------------------------------------

  stories: [
    {
      id: "1",
      date: "Ngày đầu gặp gỡ",
      title: "Ngày chúng mình gặp nhau",

      description:
        "Một cuộc gặp gỡ rất đỗi bình thường " +
        "đã mở đầu cho một mối duyên thật đẹp. " +
        "Khi ấy, cả hai chưa biết rằng người " +
        "đang đứng trước mặt rồi sẽ trở thành " +
        "người cùng mình đi qua rất nhiều " +
        "ngày tháng về sau.",

      image: "/images/story-1.jpg",
    },

    {
      id: "2",
      date: "Những ngày đầu bên nhau",
      title: "Khi tình yêu bắt đầu",

      description:
        "Từ những cuộc trò chuyện, những lần " +
        "hẹn đầu tiên và những điều giản dị " +
        "được sẻ chia mỗi ngày, chúng mình " +
        "dần hiểu nhau nhiều hơn. Tình cảm " +
        "cũng lớn lên thật tự nhiên từ sự " +
        "quan tâm và cảm giác bình yên khi " +
        "có nhau bên cạnh.",

      image: "/images/story-2.jpg",
    },

    {
      id: "3",
      date: "Những năm tháng đồng hành",
      title: "Cùng nhau trưởng thành",

      description:
        "Chúng mình đã cùng nhau trải qua " +
        "những ngày vui, những thử thách và " +
        "cả những lần học cách nhường nhịn. " +
        "Qua từng chặng đường, cả hai càng " +
        "hiểu rằng tình yêu không chỉ là " +
        "những khoảnh khắc đẹp, mà còn là " +
        "sự lắng nghe, tin tưởng và luôn " +
        "có nhau khi cần.",

      image: "/images/story-3.jpg",
    },

    {
      id: "4",
      date: "26 – 27.12.2026",
      title: "Một chặng đường mới",

      description:
        "Sau những tháng năm cùng nhau vun " +
        "đắp tình cảm, chúng mình quyết định " +
        "nắm tay nhau bước tiếp. Từ đây, " +
        "không chỉ cùng nhau gìn giữ một " +
        "tình yêu, chúng mình còn mong muốn " +
        "xây dựng một mái ấm bằng sự sẻ chia, " +
        "trách nhiệm và yêu thương.",

      image: "/images/story-4.jpg",
    },
  ],

  // ----------------------------------------------------
  // LỜI CHÚC
  // ----------------------------------------------------

  wishes: {
    eyebrow: "GỬI ĐÔI LỜI ĐẾN CHÚNG MÌNH",
    title: "Lưu lại một lời",
    titleAccent: "chúc thật đẹp",

    description:
      "Những lời chúc được gửi đến trong ngày đặc biệt này " +
      "đều là những tình cảm quý giá mà Nam và Thư " +
      "sẽ trân trọng lưu giữ.",

    secondaryDescription:
      "Dù là một lời chúc ngắn hay vài dòng chân thành, " +
      "mỗi lời nhắn đều sẽ góp thêm một kỷ niệm đẹp " +
      "cho ngày chúng mình chính thức về chung một nhà.",

    formTitle: "Lời chúc dành cho Nam & Thư",

    formDescription:
      "Một vài dòng chân thành cũng đủ để ngày vui " +
      "thêm phần ý nghĩa.",

    relations: [
      "Bạn của cô dâu",
      "Bạn của chú rể",
      "Bạn của cả hai",
      "Đồng nghiệp",
      "Người thân",
      "Khách mời",
    ],

    messagePlaceholder:
      "Gửi một lời chúc đến Nam và Thư...",

    messageHint:
      "Gửi đến Nam & Thư một lời chúc",

    submitLabel: "Gửi lời chúc",

    successMessage:
      "Nam và Thư đã nhận được lời chúc của bạn. " +
      "Chúng mình xin chân thành cảm ơn!",
  },

  // ----------------------------------------------------
  // LỜI CẢM ƠN
  // ----------------------------------------------------

  thankYou: {
    title: "Lời Cảm Ơn",

    backgroundImage: "/images/thank-you-banner.jpg",

    message:
      "Chúng mình xin gửi lời cảm ơn chân thành " +
      "đến gia đình, bạn bè và những người thân yêu " +
      "đã luôn quan tâm, yêu thương và đồng hành. " +
      "Sự hiện diện cùng những lời chúc tốt đẹp " +
      "của mọi người sẽ là những kỷ niệm vô cùng " +
      "đáng trân trọng trong ngày hạnh phúc " +
      "của chúng mình.",
  },
};

// ======================================================
// HELPER FUNCTIONS
// ======================================================

// Lấy địa điểm tổ chức theo bên.
export function getWeddingLocation(
  side: GuestSide
): WeddingLocation {
  return wedding.locations[side];
}

// Chuyển YYYY-MM-DD thành DD/MM/YYYY.
export function formatWeddingDate(
  date: string
): string {
  const [year, month, day] = date.split("-");
  return `${day}/${month}/${year}`;
}

// Lấy ngày tổ chức theo bên.
export function getWeddingDay(
  side: GuestSide
): number {
  return Number(
    wedding.locations[side].eventDate.split("-")[2]
  );
}
