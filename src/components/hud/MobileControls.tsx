"use client";

import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { pressDash, setJoystick, setJumpButton } from "@/game/input";
import { useGameStore } from "@/store/gameStore";

const STICK_RADIUS = 60;

/**
 * Floating joystick (appears where the thumb lands on the left half) and a
 * large JUMP button. Writes straight into the input singleton.
 */
export function MobileControls() {
  const zone = useRef<HTMLDivElement>(null);
  const pointerId = useRef<number | null>(null);
  const origin = useRef({ x: 0, y: 0 });
  const [stick, setStick] = useState<{ x: number; y: number; dx: number; dy: number } | null>(null);
  const run = useGameStore((s) => s.state.mode === "GOGUN");

  const onDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (pointerId.current !== null) return;
    pointerId.current = e.pointerId;
    origin.current = { x: e.clientX, y: e.clientY };
    setStick({ x: e.clientX, y: e.clientY, dx: 0, dy: 0 });
    zone.current?.setPointerCapture(e.pointerId);
    setJoystick(0, 0, true);
  };
  const onMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (e.pointerId !== pointerId.current) return;
    let dx = e.clientX - origin.current.x;
    let dy = e.clientY - origin.current.y;
    const len = Math.hypot(dx, dy);
    if (len > STICK_RADIUS) {
      dx = (dx / len) * STICK_RADIUS;
      dy = (dy / len) * STICK_RADIUS;
    }
    const nx = dx / STICK_RADIUS;
    const ny = -dy / STICK_RADIUS;
    const dead = 0.12;
    const mag = Math.hypot(nx, ny);
    if (mag < dead) setJoystick(0, 0, true);
    else {
      const scaled = Math.min(1, (mag - dead) / (1 - dead));
      setJoystick((nx / mag) * scaled, (ny / mag) * scaled, true);
    }
    setStick({ x: origin.current.x, y: origin.current.y, dx, dy });
  };
  const onUp = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (e.pointerId !== pointerId.current) return;
    pointerId.current = null;
    setStick(null);
    setJoystick(0, 0, false);
  };

  useEffect(() => {
    return () => {
      setJoystick(0, 0, false);
      setJumpButton(false);
    };
  }, []);

  return (
    <div className="pointer-events-none absolute inset-0 z-10 select-none">
      <div
        ref={zone}
        className="pointer-events-auto absolute bottom-0 left-0 top-1/4 w-1/2"
        style={{ touchAction: "none" }}
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerCancel={onUp}
      >
        {stick && (
          <>
            <div
              className="absolute rounded-full border-2 border-white/40 bg-white/10 backdrop-blur-sm"
              style={{ left: stick.x - STICK_RADIUS, top: stick.y - STICK_RADIUS, width: STICK_RADIUS * 2, height: STICK_RADIUS * 2 }}
            />
            <div
              className="absolute rounded-full bg-white/85 shadow-lg"
              style={{ left: stick.x + stick.dx - 26, top: stick.y + stick.dy - 26, width: 52, height: 52 }}
            />
          </>
        )}
        {!stick && (
          <div className="absolute bottom-10 left-8 flex h-24 w-24 items-center justify-center rounded-full border-2 border-dashed border-white/30 text-[10px] font-black tracking-widest text-white/50">
            MOVE
          </div>
        )}
      </div>
      {!run && (
      <button
        className="pointer-events-auto absolute bottom-10 right-36 flex h-[72px] w-[72px] items-center justify-center rounded-full border-4 border-white/60 bg-[#3d8bff] text-[13px] font-black tracking-widest text-white shadow-2xl active:scale-90"
        style={{ touchAction: "none", marginBottom: "env(safe-area-inset-bottom)" }}
        onPointerDown={(e) => {
          e.preventDefault();
          pressDash();
        }}
        onContextMenu={(e) => e.preventDefault()}
      >
        DASH
      </button>
      )}
      <button
        className="pointer-events-auto absolute bottom-8 right-6 flex h-24 w-24 items-center justify-center rounded-full border-4 border-white/70 bg-brand text-lg font-black tracking-widest text-white shadow-2xl active:scale-90"
        style={{ touchAction: "none", marginBottom: "env(safe-area-inset-bottom)", marginRight: "env(safe-area-inset-right)" }}
        onPointerDown={(e) => {
          e.preventDefault();
          setJumpButton(true);
        }}
        onPointerUp={() => setJumpButton(false)}
        onPointerCancel={() => setJumpButton(false)}
        onPointerLeave={() => setJumpButton(false)}
        onContextMenu={(e) => e.preventDefault()}
      >
        JUMP
      </button>
    </div>
  );
}
