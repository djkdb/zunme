"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { MenuBackground } from "@/components/menu/MenuBackground";
import { MuteButton } from "@/components/hud/MuteButton";
import { ShopButton } from "@/components/shop/ShopButton";
import { useIsMobile } from "@/hooks/useIsMobile";
import { NICKNAME_MAX_LENGTH } from "@/game/config";
import { sound } from "@/game/audio";
import { generateRoomCode, isValidRoomCode, normalizeRoomCode, sanitizeNickname } from "@/lib/room";
import { isSupabaseConfigured } from "@/lib/supabase";
import { useGameStore } from "@/store/gameStore";

export function MainMenu() {
  const router = useRouter();
  const mobile = useIsMobile();
  const storedNickname = useGameStore((s) => s.nickname);
  const setNickname = useGameStore((s) => s.setNickname);
  const leave = useGameStore((s) => s.leave);
  const [nickname, setLocalNickname] = useState(storedNickname);
  const [joining, setJoining] = useState(false);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);

  // Arriving at the menu always means leaving any previous room.
  useEffect(() => {
    leave();
  }, [leave]);

  const commitNickname = () => {
    const clean = sanitizeNickname(nickname);
    setNickname(clean);
    return clean;
  };

  const createRoom = () => {
    sound.play("click");
    commitNickname();
    setBusy(true);
    router.push(`/room/${generateRoomCode()}`);
  };

  const joinRoom = () => {
    const normalized = normalizeRoomCode(code);
    if (!isValidRoomCode(normalized)) return;
    sound.play("click");
    commitNickname();
    setBusy(true);
    router.push(`/room/${normalized}`);
  };

  const offline = !isSupabaseConfigured();

  return (
    <div className="relative h-full w-full overflow-hidden bg-[#8fc6ff]">
      <MenuBackground mobile={mobile} />
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-[#12142b]/35 via-transparent to-[#12142b]/60" />

      <div className="absolute right-3 top-3 z-20 flex items-center gap-2 safe-pad">
        <ShopButton />
        <MuteButton />
      </div>

      <div className="relative z-10 flex h-full w-full flex-col items-center justify-center px-5 safe-pad">
        <div className="anim-rise flex flex-col items-center text-center">
          <div className="chip mb-4 px-3 py-1 text-[11px] font-bold tracking-[0.3em] text-white/80">8 PLAYERS · 3 GAME MODES</div>
          <h1 className="display gradient-shadow text-[64px] sm:text-[96px] md:text-[120px]" aria-label="DROPZONE">
            {"DROPZONE".split("").map((ch, i) => (
              <span key={i} className="title-letter text-gradient" style={{ animationDelay: `${i * 0.06}s` }}>
                {ch}
              </span>
            ))}
          </h1>
          <p className="shimmer mt-2 text-sm font-extrabold tracking-[0.45em] sm:text-lg">LAST ONE STANDING</p>
        </div>

        <div className="anim-rise delay-2 mt-8 w-full max-w-sm">
          <label className="mb-1 block text-[11px] font-bold tracking-widest text-white/70">NICKNAME</label>
          <input
            value={nickname}
            maxLength={NICKNAME_MAX_LENGTH}
            onChange={(e) => setLocalNickname(e.target.value)}
            onBlur={commitNickname}
            className="w-full rounded-2xl border-2 border-white/25 bg-[#12142b]/60 px-4 py-3 text-center text-lg font-extrabold text-white outline-none backdrop-blur focus:border-brand-2"
            placeholder="Your name"
            autoComplete="off"
          />
        </div>

        {!joining ? (
          <div className="anim-rise delay-3 mt-4 flex w-full max-w-sm flex-col gap-3">
            <button className="btn btn-primary w-full text-xl" onClick={createRoom} disabled={busy}>
              CREATE ROOM
            </button>
            <button className="btn btn-secondary w-full text-xl" onClick={() => { sound.play("click"); setJoining(true); }} disabled={busy}>
              JOIN ROOM
            </button>
          </div>
        ) : (
          <div className="anim-pop mt-4 flex w-full max-w-sm flex-col gap-3">
            <input
              value={code}
              onChange={(e) => setCode(normalizeRoomCode(e.target.value))}
              onKeyDown={(e) => e.key === "Enter" && joinRoom()}
              placeholder="ROOM CODE"
              autoFocus
              autoCapitalize="characters"
              autoComplete="off"
              className="w-full rounded-2xl border-2 border-white/25 bg-[#12142b]/60 px-4 py-3 text-center font-mono text-3xl font-black tracking-[0.35em] text-white outline-none backdrop-blur focus:border-brand-2"
            />
            <button className="btn btn-primary w-full text-xl" onClick={joinRoom} disabled={busy || !isValidRoomCode(code)}>
              JOIN
            </button>
            <button className="btn btn-ghost w-full" onClick={() => setJoining(false)} disabled={busy}>
              BACK
            </button>
          </div>
        )}

        <div className="anim-fade delay-4 mt-6 flex flex-col items-center gap-1 text-center text-[12px] font-semibold text-white/75 hud-text">
          <p>🥊 Sumo island · 🏁 Obstacle race · 🔥 Vanishing floors</p>
          <p className="text-white/55">{mobile ? "Joystick to move · JUMP · DASH to shove" : "WASD move · SPACE jump · SHIFT dash into people"}</p>
          {offline && <p className="mt-2 rounded-full bg-[#ffd32a]/90 px-3 py-1 text-[11px] font-black text-[#12142b]">LOCAL MODE — same-device tabs only. Add Supabase keys for online play</p>}
        </div>
      </div>
    </div>
  );
}
