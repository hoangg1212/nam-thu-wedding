
"use client";

import {
  useWedding,
} from "@/components/providers/WeddingProvider";

export default function MusicPlayer() {
  const {
    invitationOpened,
    musicPlaying,
    toggleMusic,
  } = useWedding();

  // Chưa mở thiệp thì không hiển thị
  if (!invitationOpened) {
    return null;
  }

  return (
    <button
      type="button"
      onClick={() => void toggleMusic()}
      aria-label={
        musicPlaying ? "Tạm dừng nhạc" : "Phát nhạc"
      }
      title={
        musicPlaying ? "Tạm dừng nhạc" : "Phát nhạc"
      }
      aria-pressed={musicPlaying}
      className={`
        group

        fixed
        bottom-20
        right-4

        z-[300]

        flex
        h-12
        w-12

        items-center
        justify-center

        overflow-visible
        rounded-full

        border

        shadow-[0_10px_35px_rgba(101,67,57,0.12)]

        backdrop-blur-xl

        transition-all
        duration-500

        hover:-translate-y-1

        sm:bottom-24
        sm:right-6

        md:h-[52px]
        md:w-[52px]

        ${musicPlaying
          ? `
              border-[#b77969]/35
              bg-[#fff4ef]/90
              text-[#a86f62]
              shadow-[0_12px_38px_rgba(170,105,90,0.16)]
            `
          : `
              border-[#b98b7b]/25
              bg-[#fffaf7]/90
              text-[#8f6257]
            `
        }
      `}
    >
      {/* =====================================
          ACTIVE GLOW
      ===================================== */}

      {musicPlaying && (
        <span
          className="
            music-player-glow

            pointer-events-none

            absolute
            -inset-[5px]

            rounded-full

            border
            border-[#c99586]/20
          "
        />
      )}

      {/* =====================================
          INNER RING
      ===================================== */}

      <span
        className="
          pointer-events-none

          absolute
          inset-[4px]

          rounded-full

          border
          border-[#b88b7b]/10

          transition-all
          duration-300

          group-hover:border-[#b88b7b]/20
        "
      />

      {/* =====================================
          SOFT LIGHT
      ===================================== */}

      <span
        className="
          pointer-events-none

          absolute

          h-8
          w-8

          rounded-full

          bg-[#ecc7ba]/20

          blur-lg

          transition-transform
          duration-500

          group-hover:scale-150
        "
      />

      {/* =====================================
          ICON
      ===================================== */}

      <span
        className="
          relative
          z-10

          flex
          h-full
          w-full

          items-center
          justify-center
        "
      >
        {musicPlaying ? (
          // =================================
          // MUSIC EQUALIZER
          // =================================
          <span
            className="
              flex
              h-5

              items-end
              justify-center

              gap-[3px]
            "
          >
            <i
              className="
                music-bar
                music-bar-1

                block
                h-[8px]
                w-[2px]

                rounded-full
                bg-current
              "
            />

            <i
              className="
                music-bar
                music-bar-2

                block
                h-[15px]
                w-[2px]

                rounded-full
                bg-current
              "
            />

            <i
              className="
                music-bar
                music-bar-3

                block
                h-[11px]
                w-[2px]

                rounded-full
                bg-current
              "
            />

            <i
              className="
                music-bar
                music-bar-4

                block
                h-[17px]
                w-[2px]

                rounded-full
                bg-current
              "
            />
          </span>
        ) : (
          // =================================
          // MUSIC NOTE
          // =================================
          <span
            className="
              font-wedding-serif

              -mt-[1px]

              text-[22px]
              font-light

              leading-none

              transition-transform
              duration-300

              group-hover:rotate-[-8deg]
              group-hover:scale-110
            "
          >
            ♪
          </span>
        )}
      </span>

      {/* =====================================
          SMALL ACTIVE DOT
      ===================================== */}

      {musicPlaying && (
        <span
          className="
            absolute
            right-[2px]
            top-[2px]

            h-[7px]
            w-[7px]

            rounded-full

            border
            border-[#fffaf7]

            bg-[#ba796b]

            shadow-[0_0_8px_rgba(186,121,107,0.5)]
          "
        />
      )}
    </button>
  );
}
