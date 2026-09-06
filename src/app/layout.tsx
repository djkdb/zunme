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
  title: "ZUUUN — 친구랑 8인 파티 게임",
  description: "ZUN 캐릭터로 즐기는 15가지 파티 모드. 밀치기, 레이스, 감염, 폭탄 돌리기까지. 브라우저에서 바로 플레이.",
  openGraph: {
    title: "ZUUUN — 친구랑 8인 파티 게임",
    description: "ZUN 캐릭터로 즐기는 15가지 파티 모드.",
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
