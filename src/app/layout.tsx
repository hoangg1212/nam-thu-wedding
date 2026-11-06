import type { Metadata } from "next";

import {
  Great_Vibes,
  Cormorant_Garamond,
  Montserrat,
} from "next/font/google";

import "./globals.css";

const greatVibes = Great_Vibes({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-great-vibes",
  display: "swap",
});

const cormorant = Cormorant_Garamond({
  subsets: ["latin", "vietnamese"],
  variable: "--font-cormorant",
  display: "swap",
});

const montserrat = Montserrat({
  subsets: ["latin", "vietnamese"],
  variable: "--font-montserrat",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Nam & Thư | Wedding Invitation",
  description:
    "Trân trọng kính mời bạn đến chung vui " +
    "trong ngày hạnh phúc của Nam và Thư.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="vi">
      <body
        suppressHydrationWarning
        className={[
          greatVibes.variable,
          cormorant.variable,
          montserrat.variable,
        ].join(" ")}
      >
        {children}
      </body>
    </html>
  );
}