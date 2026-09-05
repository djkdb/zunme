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
  title: "DROPZONE — Last One Standing",
  description: "Shove your friends off a floating island. 8 players, one survivor. Play instantly in your browser.",
  openGraph: {
    title: "DROPZONE — Last One Standing",
    description: "8 players. One floating island. Last one standing wins.",
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
    <html lang="en" className={`${display.variable} h-full antialiased`}>
      <body className="h-full">
        <AudioUnlocker />
        {children}
      </body>
    </html>
  );
}
