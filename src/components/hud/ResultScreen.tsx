"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { formatClock } from "@/components/hud/GameHUD";
import { computeRanking } from "@/game/authority";
import { sound } from "@/game/audio";
import { roomShareUrl } from "@/lib/room";
import { selectIsHost, selectPlayers, useGameStore } from "@/store/gameStore";

const MEDALS = ["🥇", "🥈", "🥉"];

export function ResultScreen({ roomCode }: { roomCode: string }) {
  const router = useRouter();
  const players = useGameStore(selectPlayers);
  const state = useGameStore((s) => s.state);
  const isHost = useGameStore(selectIsHost);
  const localId = useGameStore((s) => s.localId);
  const playAgain = useGameStore((s) => s.playAgain);
  const returnToLobby = useGameStore((s) => s.returnToLobby);
  const leave = useGameStore((s) => s.leave);
  const [phase, setPhase] = useState<"hold" | "splash" | "panel">("hold");
  const [shared, setShared] = useState(false);

  // Let the final elimination land (slow-mo + banner) before the WINNER splash, then the panel.
  useEffect(() => {
    const a = setTimeout(() => setPhase("splash"), 1600);
    const b = setTimeout(() => setPhase("panel"), 4200);
    return () => {
      clearTimeout(a);
      clearTimeout(b);
    };
  }, []);
  const showPanel = phase === "panel";

  const name = (id: string) => players.find((p) => p.id === id)?.nickname ?? "???";
  const color = (id: string) => players.find((p) => p.id === id)?.colorHex ?? "#ffffff";
  const ranking = computeRanking(state);
  const winner = state.winnerId;
  const survived = formatClock(state.endAt - state.startAt);
  const eliminations = state.eliminationOrder.length;
  const lastToFall = state.eliminationOrder[state.eliminationOrder.length - 1];
  const youWon = winner === localId;

  const share = async () => {
    sound.play("click");
    const url = roomShareUrl(roomCode);
    const headline = winner ? `🏆 ${name(winner)} won DROPZONE!` : "💀 Nobody survived DROPZONE!";
    const text = `${headline}\n${state.participants.length} players · survived ${survived} · ${eliminations} eliminations\nPlay: ${url}`;
    if (navigator.share) {
      try {
        await navigator.share({ title: "DROPZONE", text, url });
        return;
      } catch {
        /* cancelled */
      }
    }
    try {
      await navigator.clipboard.writeText(text);
      setShared(true);
      setTimeout(() => setShared(false), 1500);
    } catch {
      /* ignore */
    }
  };

  return (
    <div className="pointer-events-none absolute inset-0 z-20 flex flex-col safe-pad">
      {/* Winner splash */}
      {phase === "splash" && (
        <div className="flex flex-1 flex-col items-center justify-center">
          <div className="anim-slam display text-6xl text-brand-2 hud-text sm:text-8xl">{winner ? "WINNER" : "DRAW"}</div>
          {winner && (
            <div className="anim-rise delay-2 display mt-3 text-4xl text-white hud-text sm:text-5xl" style={{ color: color(winner) }}>
              {name(winner)}
            </div>
          )}
        </div>
      )}

      {showPanel && (
        <div className="flex min-h-0 flex-1 overflow-y-auto px-3 py-3 short:px-2 short:py-2">
          <div className="panel anim-rise pointer-events-auto m-auto w-full max-w-md p-5 sm:p-6 short:max-w-2xl short:p-4">
            <div className="text-center">
              <div className="text-[11px] font-black tracking-[0.4em] text-white/60">DROPZONE</div>
              <div className="display mt-1 text-2xl text-brand-2">{winner ? "🏆 WINNER" : "💀 NO SURVIVORS"}</div>
              {winner && (
                <div className="display mt-1 text-4xl sm:text-5xl" style={{ color: color(winner) }}>
                  {name(winner)}
                  {youWon && <span className="ml-2 text-lg text-white/70">(you!)</span>}
                </div>
              )}
            </div>

            <div className="my-4 grid grid-cols-3 gap-2 border-y border-white/15 py-3 text-center">
              <div>
                <div className="display text-xl text-white">{state.participants.length}</div>
                <div className="text-[10px] font-bold tracking-widest text-white/55">PLAYERS</div>
              </div>
              <div>
                <div className="display text-xl text-white">{survived}</div>
                <div className="text-[10px] font-bold tracking-widest text-white/55">SURVIVED</div>
              </div>
              <div>
                <div className="display text-xl text-white">{eliminations}</div>
                <div className="text-[10px] font-bold tracking-widest text-white/55">ELIMINATIONS</div>
              </div>
            </div>

            {lastToFall && (
              <div className="mb-3 flex items-center justify-center gap-2 text-sm font-bold text-white/80">
                <span>💀 LAST TO FALL</span>
                <span style={{ color: color(lastToFall) }}>{name(lastToFall)}</span>
              </div>
            )}

            <ol className="max-h-40 space-y-1 overflow-y-auto pr-1 short:grid short:max-h-24 short:grid-cols-2 short:gap-1 short:space-y-0">
              {ranking.map((id, i) => (
                <li key={id} className={`flex items-center gap-2 rounded-xl px-3 py-1.5 text-sm font-bold ${i === 0 ? "bg-brand-2/20 text-white" : "bg-white/5 text-white/85"}`}>
                  <span className="w-6 text-center">{MEDALS[i] ?? `${i + 1}.`}</span>
                  <span className="h-3 w-3 rounded-full" style={{ background: color(id) }} />
                  <span className="truncate">{name(id)}</span>
                  {id === localId && <span className="text-white/50">(you)</span>}
                </li>
              ))}
            </ol>

            <div className="mt-4 flex flex-col gap-2">
              {isHost ? (
                <button className="btn btn-primary w-full text-lg" onClick={() => { sound.play("click"); playAgain(); }}>
                  PLAY AGAIN
                </button>
              ) : (
                <div className="anim-pulse rounded-2xl bg-white/10 p-3 text-center text-sm font-bold text-white/80">Waiting for host to start the next round…</div>
              )}
              <div className="flex gap-2">
                <button className="btn btn-accent min-h-12 flex-1 text-sm" onClick={share}>
                  {shared ? "COPIED ✓" : "SHARE RESULT"}
                </button>
                <button className="btn btn-ghost min-h-12 flex-1 text-sm" onClick={() => { sound.play("click"); returnToLobby(); }}>
                  {isHost ? "RETURN TO LOBBY" : "LOBBY"}
                </button>
              </div>
              <button className="text-center text-xs font-bold text-white/50" onClick={() => { leave(); router.push("/"); }}>
                Leave room
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
