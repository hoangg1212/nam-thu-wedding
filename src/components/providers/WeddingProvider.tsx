
"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

import {
  wedding,
  type GuestSide,
  type WeddingData,
} from "@/data/wedding";

import {
  mergeWeddingData,
  type WeddingEventsResponse,
  type LiveWeddingEvent,
} from "@/lib/wedding-data-sync";

// ======================================================
// NAM & THU - WEDDING PROVIDER
//
// GIAI ĐOẠN 3.11 - FIX ESLINT
//
// Chức năng:
// 1. Quản lý trạng thái mở thiệp cưới.
// 2. Phát, tạm dừng và bật/tắt nhạc.
// 3. Đồng bộ thông tin lễ cưới từ MongoDB.
// 4. Đồng bộ avatar cô dâu và chú rể.
// 5. Cung cấp dữ liệu chung qua React Context.
//
// ĐÃ SỬA:
// - react-hooks/set-state-in-effect.
// - Không gọi refreshWeddingData đồng bộ
//   trong thân useEffect.
// - Giữ cơ chế AbortController.
// - Không thay đổi cấu trúc dữ liệu và API.
//
// Các component sử dụng dữ liệu chung.
// Không cần gọi lại API ở từng component.
// ======================================================

// ======================================================
// TYPES
// ======================================================

interface CoupleAvatars {
  groom: string | null;
  bride: string | null;
}

interface WeddingAvatarsResponse {
  success?: boolean;
  avatars?: CoupleAvatars;
}

interface WeddingContextType {
  // Trạng thái thiệp
  invitationOpened: boolean;

  // Trạng thái nhạc
  musicPlaying: boolean;

  // Điều khiển thiệp
  finishInvitation: () => void;

  // Điều khiển nhạc
  playMusic: () => Promise<void>;
  pauseMusic: () => void;
  toggleMusic: () => Promise<void>;

  // Dữ liệu lễ cưới
  weddingData: WeddingData;
  weddingEvents: LiveWeddingEvent[];
  activeSides: GuestSide[];

  // Trạng thái tải dữ liệu
  weddingLoading: boolean;
  weddingLoaded: boolean;
  weddingError: string | null;

  // Tải lại dữ liệu
  refreshWeddingData: () => Promise<void>;
}

// ======================================================
// CONTEXT
// ======================================================

const WeddingContext =
  createContext<WeddingContextType | null>(null);

// ======================================================
// VALIDATE PUBLIC AVATAR
//
// Chỉ chấp nhận Data URL ảnh hợp lệ:
// - JPEG
// - PNG
// - WebP
//
// Không chấp nhận:
// - JavaScript URL
// - SVG
// - URL tùy ý
//
// Giữ nguyên giới hạn để tương thích
// với API avatar hiện tại.
// ======================================================

function safeAvatar(
  value: unknown
): string | null {
  if (typeof value !== "string") {
    return null;
  }

  if (
    value.length > 350050 ||
    !/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/]+={0,2}$/.test(
      value
    )
  ) {
    return null;
  }

  return value;
}

// ======================================================
// MAIN WEDDING PROVIDER
// ======================================================

export function WeddingProvider({
  children,
}: {
  children: ReactNode;
}) {
  // ==================================================
  // 1. TRẠNG THÁI MỞ THIỆP
  // ==================================================

  const [
    invitationOpened,
    setInvitationOpened,
  ] = useState(false);

  // ==================================================
  // 2. TRẠNG THÁI NHẠC
  // ==================================================

  const [
    musicPlaying,
    setMusicPlaying,
  ] = useState(false);

  const audioRef =
    useRef<HTMLAudioElement | null>(null);

  // ==================================================
  // 3. DỮ LIỆU LỄ CƯỚI
  // ==================================================

  const [
    weddingEvents,
    setWeddingEvents,
  ] = useState<LiveWeddingEvent[]>([]);

  // ==================================================
  // 4. AVATAR CÔ DÂU / CHÚ RỂ
  //
  // Avatar lấy từ hồ sơ tài khoản Admin.
  // Không ghi đè vào file wedding.ts.
  // ==================================================

  const [
    coupleAvatars,
    setCoupleAvatars,
  ] = useState<CoupleAvatars>({
    groom: null,
    bride: null,
  });

  // ==================================================
  // 5. TRẠNG THÁI TẢI DỮ LIỆU
  // ==================================================

  const [
    weddingLoading,
    setWeddingLoading,
  ] = useState(true);

  const [
    weddingLoaded,
    setWeddingLoaded,
  ] = useState(false);

  const [
    weddingError,
    setWeddingError,
  ] = useState<string | null>(null);

  // ==================================================
  // 6. REQUEST CONTROLLER
  //
  // Dùng để:
  // - Hủy request cũ khi tải lại.
  // - Tránh kết quả cũ ghi đè kết quả mới.
  // - Hủy request khi component unmount.
  // ==================================================

  const requestController =
    useRef<AbortController | null>(null);

  // ==================================================
  // 7. ĐỒNG BỘ DỮ LIỆU TỪ API
  //
  // Hai request chạy song song:
  //
  // GET /api/wedding-events
  // GET /api/wedding-avatars
  //
  // Promise.allSettled cho phép:
  // - API avatar lỗi, lễ cưới vẫn hoạt động.
  // - API lễ cưới lỗi, avatar vẫn xử lý.
  //
  // Khi tải lại:
  // - Hủy request trước.
  // - Tạo AbortController mới.
  // - Cập nhật dữ liệu sau khi có kết quả.
  // ==================================================

  const refreshWeddingData = useCallback(
    async (): Promise<void> => {
      // Hủy các request trước đó.
      requestController.current?.abort();

      // Tạo controller mới.
      const controller =
        new AbortController();

      requestController.current =
        controller;

      // Bắt đầu trạng thái loading.
      setWeddingLoading(true);
      setWeddingError(null);

      // ==================================================
      // REQUEST SONG SONG
      // ==================================================

      const [
        eventsResult,
        avatarsResult,
      ] = await Promise.allSettled([
        // ================================================
        // REQUEST 1: THÔNG TIN LỄ CƯỚI
        // ================================================

        fetch("/api/wedding-events", {
          method: "GET",
          cache: "no-store",
          signal: controller.signal,
        }).then(async (response) => {
          const result:
            WeddingEventsResponse =
            await response.json();

          if (
            !response.ok ||
            result.success !== true ||
            !Array.isArray(result.events)
          ) {
            throw new Error(
              result.message ||
                "Không thể tải thông tin lễ cưới."
            );
          }

          return result.events;
        }),

        // ================================================
        // REQUEST 2: AVATAR CÔ DÂU / CHÚ RỂ
        // ================================================

        fetch("/api/wedding-avatars", {
          method: "GET",
          cache: "default",
          signal: controller.signal,
        }).then(async (response) => {
          const result:
            WeddingAvatarsResponse =
            await response.json();

          if (
            !response.ok ||
            result.success !== true ||
            !result.avatars
          ) {
            throw new Error(
              "Không thể tải ảnh cô dâu/chú rể."
            );
          }

          return result.avatars;
        }),
      ]);

      // ==================================================
      // KIỂM TRA REQUEST ĐÃ BỊ HỦY
      //
      // Không cập nhật state nếu request
      // không còn hợp lệ.
      // ==================================================

      if (controller.signal.aborted) {
        return;
      }

      // ==================================================
      // 8. XỬ LÝ DỮ LIỆU LỄ CƯỚI
      // ==================================================

      if (eventsResult.status === "fulfilled") {
        // Chỉ nhận dữ liệu Nhà trai / Nhà gái.
        const events = eventsResult.value.filter(
          (event) =>
            event.side === "groom" ||
            event.side === "bride"
        );

        // Cập nhật danh sách lễ cưới.
        setWeddingEvents(events);

        // Đánh dấu đã tải thành công.
        setWeddingLoaded(true);

        // Xóa lỗi cũ.
        setWeddingError(null);
      } else {
        // Ghi log để hỗ trợ debug API.
        console.error(
          "[WEDDING EVENTS SYNC]",
          eventsResult.reason
        );

        // Cập nhật thông báo lỗi.
        setWeddingError(
          eventsResult.reason instanceof Error
            ? eventsResult.reason.message
            : "Không thể tải thông tin lễ cưới."
        );
      }

      // ==================================================
      // 9. XỬ LÝ AVATAR
      // ==================================================

      if (avatarsResult.status === "fulfilled") {
        const avatars = avatarsResult.value;

        // Kiểm tra Data URL trước khi sử dụng.
        setCoupleAvatars({
          groom: safeAvatar(avatars.groom),
          bride: safeAvatar(avatars.bride),
        });
      } else {
        console.error(
          "[WEDDING AVATARS SYNC]",
          avatarsResult.reason
        );

        // Nếu API avatar lỗi:
        // - Không làm hỏng dữ liệu lễ cưới.
        // - Trở về ảnh mặc định trong wedding.ts.
        setCoupleAvatars({
          groom: null,
          bride: null,
        });
      }

      // ==================================================
      // HOÀN THÀNH TẢI DỮ LIỆU
      // ==================================================

      setWeddingLoading(false);
    },
    []
  );

  // ==================================================
  // 10. TẢI DỮ LIỆU KHI WEBSITE KHỞI TẠO
  //
  // FIX ESLINT:
  // react-hooks/set-state-in-effect
  //
  // CODE CŨ:
  //
  // useEffect(() => {
  //   void refreshWeddingData();
  //
  //   return () => {
  //     requestController.current?.abort();
  //     requestController.current = null;
  //   };
  // }, [refreshWeddingData]);
  //
  // VẤN ĐỀ:
  // refreshWeddingData() gọi setWeddingLoading(true)
  // và setWeddingError(null) ngay khi được gọi.
  //
  // GIẢI PHÁP:
  // - Chuyển lời gọi sang microtask.
  // - Dùng biến cancelled cho cleanup.
  // - Không gọi refreshWeddingData nếu effect
  //   đã bị cleanup.
  // - Giữ AbortController để hủy request.
  //
  // Không cần tắt quy tắc ESLint.
  // ==================================================

  useEffect(() => {
    let cancelled = false;

    // Tách lời gọi khỏi quá trình chạy
    // đồng bộ của effect.
    void Promise.resolve().then(() => {
      // React Strict Mode có thể cleanup effect
      // trước khi microtask được thực thi.
      if (cancelled) {
        return;
      }

      // Bắt đầu tải dữ liệu lễ cưới.
      return refreshWeddingData();
    });

    // Cleanup khi component unmount
    // hoặc effect được thiết lập lại.
    return () => {
      cancelled = true;

      requestController.current?.abort();

      requestController.current = null;
    };
  }, [refreshWeddingData]);

  // ==================================================
  // 11. TẠO DỮ LIỆU WEDDING HOÀN CHỈNH
  //
  // Nguồn dữ liệu:
  // - wedding.ts: dữ liệu mặc định.
  // - API: dữ liệu lễ cưới từ MongoDB.
  // - API avatar: ảnh cô dâu và chú rể.
  //
  // Ưu tiên avatar:
  // 1. Avatar lấy từ hồ sơ Admin.
  // 2. Ảnh mặc định trong wedding.ts.
  //
  // Không sửa trực tiếp object wedding gốc.
  // ==================================================

  const weddingData = useMemo<WeddingData>(
    () => {
      // Kết hợp dữ liệu mặc định và API.
      const merged = mergeWeddingData(
        weddingEvents,
        wedding
      );

      return {
        ...merged,

        // ============================================
        // CHÚ RỂ
        // ============================================

        groom: {
          ...merged.groom,

          illustration:
            coupleAvatars.groom ||
            merged.groom.illustration,
        },

        // ============================================
        // CÔ DÂU
        // ============================================

        bride: {
          ...merged.bride,

          illustration:
            coupleAvatars.bride ||
            merged.bride.illustration,
        },
      };
    },
    [weddingEvents, coupleAvatars]
  );

  // ==================================================
  // 12. DANH SÁCH BÊN ĐANG HOẠT ĐỘNG
  //
  // Chỉ tính sau khi tải dữ liệu thành công.
  //
  // Dùng Set để loại bỏ giá trị trùng nhau.
  // ==================================================

  const activeSides = useMemo<GuestSide[]>(
    () => {
      if (!weddingLoaded) {
        return [];
      }

      return Array.from(
        new Set(
          weddingEvents.map(
            (event) => event.side
          )
        )
      );
    },
    [weddingEvents, weddingLoaded]
  );

  // ==================================================
  // 13. KHỞI TẠO AUDIO
  //
  // Cấu hình:
  // - Lấy URL nhạc từ wedding.ts.
  // - Lặp lại khi phát hết.
  // - Âm lượng 45%.
  // - Tải trước dữ liệu âm thanh.
  //
  // Không tự phát nhạc khi khởi tạo.
  // ==================================================

  useEffect(() => {
    const audio = new Audio(
      wedding.musicUrl
    );

    audio.loop = true;
    audio.volume = 0.45;
    audio.preload = "auto";

    audioRef.current = audio;

    // ==================================================
    // AUDIO EVENT HANDLERS
    // ==================================================

    const handlePlay = () => {
      setMusicPlaying(true);
    };

    const handlePause = () => {
      setMusicPlaying(false);
    };

    const handleEnded = () => {
      setMusicPlaying(false);
    };

    const handleError = () => {
      setMusicPlaying(false);
    };

    // ==================================================
    // ĐĂNG KÝ AUDIO EVENTS
    // ==================================================

    audio.addEventListener(
      "play",
      handlePlay
    );

    audio.addEventListener(
      "pause",
      handlePause
    );

    audio.addEventListener(
      "ended",
      handleEnded
    );

    audio.addEventListener(
      "error",
      handleError
    );

    // ==================================================
    // CLEANUP AUDIO
    //
    // Dừng nhạc, hủy listeners và giải phóng audio.
    // ==================================================

    return () => {
      audio.pause();

      audio.removeEventListener(
        "play",
        handlePlay
      );

      audio.removeEventListener(
        "pause",
        handlePause
      );

      audio.removeEventListener(
        "ended",
        handleEnded
      );

      audio.removeEventListener(
        "error",
        handleError
      );

      audio.removeAttribute("src");
      audio.load();

      if (audioRef.current === audio) {
        audioRef.current = null;
      }
    };
  }, []);

  // ==================================================
  // 14. KHÓA CUỘN NỀN TRƯỚC KHI MỞ THIỆP
  //
  // Khi chưa mở thiệp:
  // - Khóa cuộn document.body.
  //
  // Khi mở thiệp:
  // - Khôi phục khả năng cuộn.
  //
  // Giữ nguyên overflow trước đó.
  // ==================================================

  useEffect(() => {
    if (invitationOpened) {
      return;
    }

    const previousOverflow =
      document.body.style.overflow;

    document.body.style.overflow =
      "hidden";

    return () => {
      document.body.style.overflow =
        previousOverflow;
    };
  }, [invitationOpened]);

  // ==================================================
  // 15. HOÀN THÀNH MỞ THIỆP
  // ==================================================

  const finishInvitation = useCallback(
    () => {
      setInvitationOpened(true);
    },
    []
  );

  // ==================================================
  // 16. PHÁT NHẠC
  //
  // Gọi audio.play().
  // Browser có thể từ chối nếu chưa có
  // tương tác từ người dùng.
  // ==================================================

  const playMusic = useCallback(
    async (): Promise<void> => {
      const audio = audioRef.current;

      if (!audio) {
        return;
      }

      try {
        await audio.play();
      } catch (error) {
        console.warn(
          "Không thể phát nhạc:",
          error
        );

        setMusicPlaying(false);
      }
    },
    []
  );

  // ==================================================
  // 17. TẠM DỪNG NHẠC
  // ==================================================

  const pauseMusic = useCallback(() => {
    const audio = audioRef.current;

    if (!audio) {
      return;
    }

    audio.pause();
  }, []);

  // ==================================================
  // 18. BẬT / TẮT NHẠC
  //
  // Nếu nhạc đang dừng => phát.
  // Nếu nhạc đang phát => tạm dừng.
  // ==================================================

  const toggleMusic = useCallback(
    async (): Promise<void> => {
      const audio = audioRef.current;

      if (!audio) {
        return;
      }

      if (audio.paused) {
        await playMusic();
      } else {
        pauseMusic();
      }
    },
    [playMusic, pauseMusic]
  );

  // ==================================================
  // 19. TẠO CONTEXT VALUE
  //
  // useMemo giúp tránh tạo lại object Context
  // khi các dependency không thay đổi.
  // ==================================================

  const contextValue =
    useMemo<WeddingContextType>(
      () => ({
        // Trạng thái mở thiệp
        invitationOpened,

        // Trạng thái phát nhạc
        musicPlaying,

        // Điều khiển mở thiệp
        finishInvitation,

        // Điều khiển nhạc
        playMusic,
        pauseMusic,
        toggleMusic,

        // Dữ liệu lễ cưới
        weddingData,
        weddingEvents,
        activeSides,

        // Trạng thái tải dữ liệu
        weddingLoading,
        weddingLoaded,
        weddingError,

        // Làm mới dữ liệu
        refreshWeddingData,
      }),
      [
        invitationOpened,
        musicPlaying,
        finishInvitation,
        playMusic,
        pauseMusic,
        toggleMusic,
        weddingData,
        weddingEvents,
        activeSides,
        weddingLoading,
        weddingLoaded,
        weddingError,
        refreshWeddingData,
      ]
    );

  // ==================================================
  // 20. CONTEXT PROVIDER
  // ==================================================

  return (
    <WeddingContext.Provider
      value={contextValue}
    >
      {children}
    </WeddingContext.Provider>
  );
}

// ======================================================
// 21. HOOK CHÍNH
//
// Cho phép component truy cập WeddingContext.
//
// Phải dùng trong cây component được
// bao bọc bởi WeddingProvider.
// ======================================================

export function useWedding() {
  const context = useContext(
    WeddingContext
  );

  if (!context) {
    throw new Error(
      "useWedding phải được sử dụng trong WeddingProvider"
    );
  }

  return context;
}

// ======================================================
// 22. HOOK DỮ LIỆU LỄ CƯỚI
//
// Chỉ trả về dữ liệu liên quan đến lễ cưới.
//
// Dành cho các component:
// - WeddingDetails
// - Countdown
// - Các phần cần ngày giờ và sự kiện
// ======================================================

export function useWeddingData() {
  const {
    weddingData,
    weddingEvents,
    activeSides,
    weddingLoading,
    weddingLoaded,
    weddingError,
    refreshWeddingData,
  } = useWedding();

  return {
    weddingData,
    weddingEvents,
    activeSides,
    weddingLoading,
    weddingLoaded,
    weddingError,
    refreshWeddingData,
  };
}
