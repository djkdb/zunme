"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { MenuBackground } from "@/components/menu/MenuBackground";
import { MuteButton } from "@/components/hud/MuteButton";
import { ShopButton } from "@/components/shop/ShopButton";
import { CharacterPreview } from "@/components/shop/CharacterPreview";
import { MusicDirector } from "@/components/hud/MusicDirector";
import { useIsMobile } from "@/hooks/useIsMobile";
import { GAME_MODES, NICKNAME_MAX_LENGTH } from "@/game/config";
import { sound } from "@/game/audio";
import { generateRoomCode, isValidRoomCode, normalizeRoomCode, randomNickname, sanitizeNickname } from "@/lib/room";
import { isSupabaseConfigured } from "@/lib/supabase";
import { useGameStore } from "@/store/gameStore";
import { useWalletStore } from "@/store/walletStore";
import type { GameMode } from "@/types";

const FEATURED: GameMode[] = ["SUMO", "RACE", "COLOR", "TAG", "BOMB", "GOGUN"];

export function MainMenu() {
  const router = useRouter();
  const mobile = useIsMobile();
  const storedNickname = useGameStore((s) => s.nickname);
  const setNickname = useGameStore((s) => s.setNickname);
  const leave = useGameStore((s) => s.leave);
  const equipped = useWalletStore((s) => s.equipped);
  const [nickname, setLocalNickname] = useState(storedNickname);
  const [joining, setJoining] = useState(false);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [sharedGame, setSharedGame] = useState(false);
  const shareGame = async () => {
    sound.play("click");
    const url = window.location.origin;
    const text = "ZUUUN — 설치 없이 브라우저에서 친구랑 8인 파티 게임. 밀치기·레이스·감염·폭탄 돌리기!";
    if (navigator.share) {
      try {
        await navigator.share({ title: "ZUUUN", text, url });
        return;
      } catch {
        /* cancelled */
      }
    }
    try {
      await navigator.clipboard.writeText(`${text} ${url}`);
      setSharedGame(true);
      setTimeout(() => setSharedGame(false), 1500);
    } catch {
      /* ignore */
    }
  };

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

  const rollName = () => {
    sound.play("click");
    const next = randomNickname();
    setLocalNickname(next);
    setNickname(next);
  };

  const offline = !isSupabaseConfigured();

  return (
    <div className="relative h-full w-full overflow-hidden bg-[#8fc6ff]">
      <MenuBackground mobile={mobile} />
      <MusicDirector screen="menu" />
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-[#12142b]/40 via-transparent to-[#12142b]/70" />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_50%_35%,rgba(255,211,42,0.18),transparent_55%)]" />

      <div className="absolute right-3 top-3 z-20 flex items-center gap-2 safe-pad">
        <ShopButton tab="records" compact />
        <ShopButton />
        <MuteButton />
      </div>

      <div className="relative z-10 flex h-full w-full flex-col items-center justify-center px-4 safe-pad">
        {/* logo */}
        <div className="anim-rise flex flex-col items-center text-center">
          <div className="pill mb-3 tracking-[0.2em] text-white/85 short:mb-1">
            <span>👥 8인</span>
            <span className="text-white/40">·</span>
            <span>🎮 15개 모드</span>
            <span className="text-white/40">·</span>
            <span>🎲 파티 믹스</span>
          </div>
          <h1 className="display gradient-shadow text-[76px] sm:text-[112px] md:text-[136px] short:text-[56px]" aria-label="ZUUUN">
            {"ZUUUN".split("").map((ch, i) => (
              <span key={i} className="title-letter text-gradient" style={{ animationDelay: `${i * 0.06}s` }}>
                {ch}
              </span>
            ))}
          </h1>
          <p className="shimmer mt-1 text-sm font-extrabold tracking-[0.2em] sm:text-base short:hidden">친구랑 즐기는 8인 파티 게임</p>
        </div>

        {/* card */}
        <div className="anim-rise delay-2 glass mt-5 flex w-full max-w-2xl items-stretch gap-4 p-4 sm:p-5 short:mt-3 short:gap-3 short:p-3">
          <div className="relative hidden w-36 shrink-0 overflow-hidden rounded-2xl bg-gradient-to-b from-white/10 to-white/0 sm:block short:hidden">
            <CharacterPreview cosmetics={equipped} colorHex="#3d8bff" />
            <div className="pointer-events-none absolute inset-x-0 bottom-2 text-center text-[10px] font-black tracking-widest text-white/60">내 ZUN</div>
          </div>

          <div className="flex min-w-0 flex-1 flex-col justify-center gap-3 short:gap-2">
            <div>
              <div className="mb-1 flex items-center justify-between text-[11px] font-bold tracking-widest text-white/60">
                <span>닉네임</span>
                <span className="text-white/35">{nickname.length} / {NICKNAME_MAX_LENGTH}</span>
              </div>
              <div className="flex gap-2">
                <input
                  value={nickname}
                  maxLength={NICKNAME_MAX_LENGTH}
                  onChange={(e) => setLocalNickname(e.target.value)}
                  onBlur={commitNickname}
                  className="input text-center text-lg"
                  placeholder="이름"
                  autoComplete="off"
                />
                <button className="chip flex h-[52px] w-[52px] shrink-0 items-center justify-center text-xl active:scale-90" onClick={rollName} aria-label="랜덤 닉네임" title="랜덤 닉네임">
                  🎲
                </button>
              </div>
            </div>

            {!joining ? (
              <div className="flex flex-col gap-2.5 short:flex-row">
                <button className="btn btn-primary btn-lg w-full short:min-h-[52px] short:text-base" onClick={createRoom} disabled={busy}>
                  <span className="btn-icon">🚀</span> 방 만들기
                </button>
                <button className="btn btn-secondary w-full short:min-h-[52px] short:text-base" onClick={() => { sound.play("click"); setJoining(true); }} disabled={busy}>
                  <span className="btn-icon">🔗</span> 코드로 참가
                </button>
              </div>
            ) : (
              <div className="anim-pop flex flex-col gap-2.5">
                <input
                  value={code}
                  onChange={(e) => setCode(normalizeRoomCode(e.target.value))}
                  onKeyDown={(e) => e.key === "Enter" && joinRoom()}
                  placeholder="방 코드"
                  autoFocus
                  autoCapitalize="characters"
                  autoComplete="off"
                  className="input text-center font-mono text-3xl font-black tracking-[0.35em] short:text-2xl"
                />
                <div className="flex gap-2">
                  <button className="btn btn-ghost min-h-12 flex-1 text-base" onClick={() => setJoining(false)} disabled={busy}>
                    뒤로
                  </button>
                  <button className="btn btn-primary min-h-12 flex-[2] text-base" onClick={joinRoom} disabled={busy || !isValidRoomCode(code)}>
                    참가하기
                  </button>
                </div>
              </div>
            )}

            <div className="flex flex-wrap items-center gap-1.5 short:hidden">
              {FEATURED.map((m) => (
                <span key={m} className="pill">
                  <span>{GAME_MODES[m].icon}</span>
                  {GAME_MODES[m].name}
                </span>
              ))}
              <span className="pill text-white/60">+9</span>
            </div>
          </div>
        </div>

        <div className="anim-fade delay-4 mt-4 flex flex-col items-center gap-1.5 text-center text-[12px] font-semibold text-white/75 hud-text short:mt-2">
          {mobile ? (
            <p>조이스틱으로 이동 · 점프 · 대시로 밀치기</p>
          ) : (
            <p className="flex items-center gap-1.5">
              <span className="kbd">W</span>
              <span className="kbd">A</span>
              <span className="kbd">S</span>
              <span className="kbd">D</span> 이동 <span className="kbd">SPACE</span> 점프 <span className="kbd">SHIFT</span> 대시
            </p>
          )}
          {offline && <p className="rounded-full bg-[#ffd32a]/90 px-3 py-1 text-[11px] font-black text-[#12142b]">로컬 모드 — 같은 기기의 탭끼리만 플레이할 수 있어요</p>}
          <button className="pointer-events-auto mt-1 rounded-full bg-white/10 px-3 py-1 text-[11px] font-black tracking-widest text-white/80 active:scale-95" onClick={shareGame}>
            {sharedGame ? "링크 복사됨 ✓" : "📤 친구에게 ZUUUN 알리기"}
          </button>
        </div>
      </div>
    </div>
  );
}
