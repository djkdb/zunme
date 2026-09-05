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
        <div className="chip anim-fade px-3 py-1.5 text-[11px] font-black tracking-widest text-white">📱 ROTATE FOR THE BEST EXPERIENCE</div>
      </div>
    );
  }
  return (
    <div className="pointer-events-auto absolute inset-0 z-40 flex flex-col items-center justify-center bg-[#12142b]/92 px-8 text-center">
      <div className="anim-float text-6xl">📱</div>
      <div className="display mt-4 text-3xl text-white">ROTATE YOUR PHONE</div>
      <p className="mt-2 text-sm font-semibold text-white/70">DROPZONE plays in landscape.</p>
    </div>
  );
}
