"use client";

import dynamic from "next/dynamic";

const RoomView = dynamic(() => import("@/components/lobby/RoomView").then((m) => m.RoomView), {
  ssr: false,
  loading: () => (
    <div className="flex h-full w-full items-center justify-center bg-[#8fc6ff]">
      <div className="panel anim-pulse px-6 py-4 text-sm font-black tracking-widest text-white">불러오는 중…</div>
    </div>
  ),
});

export function RoomViewLoader({ roomCode }: { roomCode: string }) {
  return <RoomView roomCode={roomCode} />;
}
