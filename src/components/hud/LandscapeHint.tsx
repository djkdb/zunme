"use client";

export function LandscapeHint() {
  return (
    <div className="pointer-events-auto absolute inset-0 z-40 flex flex-col items-center justify-center bg-[#12142b]/92 px-8 text-center">
      <div className="anim-float text-6xl">📱</div>
      <div className="display mt-4 text-3xl text-white">ROTATE YOUR PHONE</div>
      <p className="mt-2 text-sm font-semibold text-white/70">DROPZONE plays best in landscape.</p>
    </div>
  );
}
