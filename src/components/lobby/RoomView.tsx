"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { GameCanvas } from "@/components/game/GameCanvas";
import { GameScene } from "@/components/game/GameScene";
import { Countdown } from "@/components/hud/Countdown";
import { EliminationBanner } from "@/components/hud/EliminationBanner";
import { FinishBanner } from "@/components/hud/FinishBanner";
import { GameHUD } from "@/components/hud/GameHUD";
import { LandscapeHint } from "@/components/hud/LandscapeHint";
import { MobileControls } from "@/components/hud/MobileControls";
import { ResultScreen } from "@/components/hud/ResultScreen";
import { ScreenEffects } from "@/components/hud/ScreenEffects";
import { Lobby } from "@/components/lobby/Lobby";
import { NICKNAME_MAX_LENGTH } from "@/game/config";
import { attachKeyboard, resetInput } from "@/game/input";
import { resetEffects } from "@/game/effects";
import { sound } from "@/game/audio";
import { useIsMobile, useIsPortrait } from "@/hooks/useIsMobile";
import { sanitizeNickname } from "@/lib/room";
import { useGameStore } from "@/store/gameStore";

function hasStoredNickname(): boolean {
  try {
    return Boolean(localStorage.getItem("dropzone:nickname"));
  } catch {
    return false;
  }
}

/**
 * The room page: a persistent 3D canvas with phase-dependent overlays.
 * LOBBY → COUNTDOWN/PLAYING (HUD + controls) → FINISHED (results).
 */
export function RoomView({ roomCode }: { roomCode: string }) {
  const router = useRouter();
  const mobile = useIsMobile();
  const portrait = useIsPortrait();
  const join = useGameStore((s) => s.join);
  const setNickname = useGameStore((s) => s.setNickname);
  const storedNickname = useGameStore((s) => s.nickname);
  const connected = useGameStore((s) => s.connected);
  const connecting = useGameStore((s) => s.connecting);
  const error = useGameStore((s) => s.error);
  const status = useGameStore((s) => s.state.status);
  const viewingLobby = useGameStore((s) => s.viewingLobby);
  const localId = useGameStore((s) => s.localId);
  const alive = useGameStore((s) => s.state.alive);
  const participants = useGameStore((s) => s.state.participants);

  const [needsName, setNeedsName] = useState(() => !hasStoredNickname());
  const [draftName, setDraftName] = useState(storedNickname);

  useEffect(() => {
    if (!needsName) void join(roomCode);
    // Only auto-join on mount; the nickname prompt joins explicitly.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [join, roomCode]);

  useEffect(() => {
    const detach = attachKeyboard();
    return () => {
      detach();
      resetInput();
      resetEffects();
    };
  }, []);

  const confirmName = () => {
    const clean = sanitizeNickname(draftName);
    setNickname(clean);
    setNeedsName(false);
    sound.unlock();
    sound.play("click");
    void join(roomCode, clean);
  };

  const inRound = status === "COUNTDOWN" || status === "PLAYING";
  const isParticipant = participants.includes(localId);
  const localAlive = alive.includes(localId);
  const showLobby = status === "LOBBY" || viewingLobby || (inRound && !isParticipant);
  const showControls = mobile && inRound && localAlive;

  return (
    <div className="relative h-full w-full overflow-hidden bg-[#8fc6ff]">
      <GameCanvas mobile={mobile}>
        <GameScene mobile={mobile} />
      </GameCanvas>
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-[#12142b]/25 to-transparent" style={{ height: "30%" }} />

      {needsName && (
        <div className="absolute inset-0 z-30 flex items-center justify-center bg-[#12142b]/60 px-4 backdrop-blur-sm">
          <div className="panel anim-pop w-full max-w-sm p-6 text-center">
            <div className="display text-3xl text-white">DROPZONE</div>
            <p className="mt-1 text-xs font-bold tracking-widest text-white/60">JOINING ROOM {roomCode}</p>
            <input
              value={draftName}
              maxLength={NICKNAME_MAX_LENGTH}
              onChange={(e) => setDraftName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && confirmName()}
              autoFocus
              className="mt-5 w-full rounded-2xl border-2 border-white/25 bg-[#12142b]/60 px-4 py-3 text-center text-lg font-extrabold text-white outline-none focus:border-brand-2"
              placeholder="Your name"
            />
            <button className="btn btn-primary mt-3 w-full text-lg" onClick={confirmName}>
              JOIN
            </button>
          </div>
        </div>
      )}

      {!needsName && connecting && (
        <div className="absolute inset-0 z-30 flex items-center justify-center">
          <div className="panel anim-pulse px-6 py-4 text-sm font-black tracking-widest text-white">CONNECTING…</div>
        </div>
      )}

      {error && (
        <div className="absolute inset-0 z-30 flex items-center justify-center px-4">
          <div className="panel anim-pop w-full max-w-sm p-6 text-center">
            <div className="display text-2xl text-brand">CONNECTION FAILED</div>
            <p className="mt-2 text-sm font-semibold text-white/75">{error}</p>
            <div className="mt-4 flex gap-2">
              <button className="btn btn-secondary flex-1 text-sm" onClick={() => void join(roomCode)}>
                RETRY
              </button>
              <button className="btn btn-ghost flex-1 text-sm" onClick={() => router.push("/")}>
                HOME
              </button>
            </div>
          </div>
        </div>
      )}

      {connected && showLobby && <Lobby roomCode={roomCode} />}
      {connected && inRound && isParticipant && !viewingLobby && (
        <>
          <ScreenEffects />
          <GameHUD />
          <Countdown />
          <EliminationBanner />
          <FinishBanner />
          {showControls && <MobileControls />}
        </>
      )}
      {connected && status === "FINISHED" && !viewingLobby && <ResultScreen roomCode={roomCode} />}

      {mobile && portrait && <LandscapeHint blocking={inRound && isParticipant && localAlive} />}
    </div>
  );
}
