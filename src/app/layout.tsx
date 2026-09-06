import type { Metadata, Viewport } from "next";
import { Rubik } from "next/font/google";
import type { ReactNode } from "react";
import "./globals.css";
import { AudioUnlocker } from "@/components/hud/AudioUnlocker";

const display = Rubik({
  variable: "--font-display",
  subsets: ["latin"],
  weight: ["500", "700", "800", "900"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "드롭존 — 최후의 1인",
  description: "떠 있는 섬에서 친구들을 밀어 떨어뜨리세요. 8인 파티 게임, 15개 모드. 브라우저에서 바로 플레이.",
  openGraph: {
    title: "드롭존 — 최후의 1인",
    description: "8명, 떠 있는 섬 하나. 마지막까지 남는 사람이 승리.",
    type: "website",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
  themeColor: "#12142b",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="ko" className={`${display.variable} h-full antialiased`}>
      <body className="h-full">
        <AudioUnlocker />
        {children}
      </body>
    </html>
  );
}
