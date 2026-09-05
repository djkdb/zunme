"use client";

import dynamic from "next/dynamic";

/** The game is client-only (WebGL + local identity), so skip SSR for the interactive menu. */
export const MainMenuLoader = dynamic(() => import("@/components/menu/MainMenu").then((m) => m.MainMenu), {
  ssr: false,
  loading: () => <div className="h-full w-full bg-[#8fc6ff]" />,
});
