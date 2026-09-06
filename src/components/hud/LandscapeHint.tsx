"use client";

/**
 * Portrait handling on phones: a full-screen prompt while a round is running
 * (the joystick needs the width), and a slim reminder elsewhere so the lobby
 * and results stay usable.
 */
export function LandscapeHint({ blocking }: { blocking: boolean }) {
  if (!blocking) {
    return (
      <div className="pointer-events-none absolute left-1/2 top-16 z-40 -translate-x-1/2 safe-pad">
        <div className="chip anim-fade px-3 py-1.5 text-[11px] font-black tracking-widest text-white">📱 가로로 돌리면 더 좋아요</div>
      </div>
    );
  }
  return (
    <div className="pointer-events-auto absolute inset-0 z-40 flex flex-col items-center justify-center bg-[#12142b]/92 px-8 text-center">
      <div className="anim-float text-6xl">📱</div>
      <div className="display mt-4 text-3xl text-white">휴대폰을 가로로 돌려주세요</div>
      <p className="mt-2 text-sm font-semibold text-white/70">드롭존은 가로 모드로 플레이해요.</p>
    </div>
  );
}
