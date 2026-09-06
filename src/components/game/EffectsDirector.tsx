"use client";

import { useEffect, useRef } from "react";
import { ELIMINATION_SLOWMO_DURATION, ELIMINATION_SLOWMO_SCALE, PLAYER_COLORS } from "@/game/config";
import { burst, focusEvents, haptic, shake, slowMotion } from "@/game/effects";
import { livePoses } from "@/game/remote";
import { sound } from "@/game/audio";
import { useGameStore } from "@/store/gameStore";

/**
 * Listens to game-state transitions and fires the matching presentation:
 * GO! burst, elimination slow-mo + explosion, winner confetti.
 * Lives inside the Canvas so it can reference live positions.
 */
export function EffectsDirector() {
  const lastStatus = useRef(useGameStore.getState().state.status);
  const lastElimSeq = useRef(useGameStore.getState().eliminationSeq);
  const lastFinishSeq = useRef(useGameStore.getState().finishSeq);
  const lastChampion = useRef<string | null>(null);
  const confettiTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    const unsub = useGameStore.subscribe((s) => {
      const status = s.state.status;
      if (status !== lastStatus.current) {
        const prev = lastStatus.current;
        lastStatus.current = status;
        if (status === "PLAYING" && prev === "COUNTDOWN") {
          shake(0.5);
          sound.play("go");
          livePoses.forEach((p) => {
            burst({ position: { x: p.x, y: p.y + 0.5, z: p.z }, color: ["#ffffff", "#ffd32a", "#18dcff"], count: 18, speed: 4, life: 0.7, size: 0.16 });
          });
        }
        if (status === "FINISHED") {
          if (confettiTimer.current) clearInterval(confettiTimer.current);
          const winner = s.state.winnerId;
          if (winner) {
            sound.play("win");
            shake(0.3);
            const colors = PLAYER_COLORS.map((c) => c.hex);
            let shots = 0;
            confettiTimer.current = setInterval(() => {
              const p = livePoses.get(winner) ?? { x: 0, y: 0, z: 0 };
              burst({ position: { x: p.x, y: p.y + 2.5, z: p.z }, color: colors, count: 34, speed: 5, life: 2.4, size: 0.08, gravity: 3.5, spread: 1.4 });
              if (++shots >= 8 && confettiTimer.current) {
                clearInterval(confettiTimer.current);
                confettiTimer.current = null;
              }
            }, 350);
          }
        }
        if (status === "LOBBY" || status === "COUNTDOWN") {
          if (confettiTimer.current) {
            clearInterval(confettiTimer.current);
            confettiTimer.current = null;
          }
        }
      }

      // Series champion: a longer, bigger confetti shower on the champion.
      const champion = s.state.seriesChampion;
      if (champion !== lastChampion.current) {
        lastChampion.current = champion;
        if (champion) {
          sound.play("win");
          const colors = PLAYER_COLORS.map((c) => c.hex);
          let shots = 0;
          if (confettiTimer.current) clearInterval(confettiTimer.current);
          confettiTimer.current = setInterval(() => {
            const p = livePoses.get(champion) ?? { x: 0, y: 0, z: 0 };
            burst({ position: { x: p.x, y: p.y + 3, z: p.z }, color: colors, count: 44, speed: 6, life: 2.6, size: 0.09, gravity: 3, spread: 2 });
            if (++shots >= 16 && confettiTimer.current) {
              clearInterval(confettiTimer.current);
              confettiTimer.current = null;
            }
          }, 300);
        }
      }

      if (s.finishSeq !== lastFinishSeq.current && s.lastFinish) {
        lastFinishSeq.current = s.finishSeq;
        const { playerId, colorHex } = s.lastFinish;
        if (playerId !== s.localId) {
          const p = livePoses.get(playerId);
          if (p) burst({ position: { x: p.x, y: p.y + 1.2, z: p.z }, color: [colorHex, "#ffd32a", "#ffffff"], count: 24, speed: 4, life: 1, size: 0.13, gravity: 6 });
          sound.play("go", { volume: 0.6 });
        }
      }

      if (s.eliminationSeq !== lastElimSeq.current && s.lastElimination) {
        lastElimSeq.current = s.eliminationSeq;
        const { playerId, colorHex } = s.lastElimination;
        const p = livePoses.get(playerId);
        const pos = p ? { x: p.x, y: Math.max(p.y, -3), z: p.z } : { x: 0, y: 0, z: 0 };
        burst({ position: pos, color: [colorHex, "#ffffff", "#2b2d42"], count: 40, speed: 7, life: 1.1, size: 0.2, gravity: 10, spread: 1.2 });
        shake(0.7);
        if (playerId === s.localId) haptic(120);
        slowMotion(ELIMINATION_SLOWMO_SCALE, ELIMINATION_SLOWMO_DURATION);
        sound.play("elimination");
        if (playerId !== s.localId) focusEvents.emit({ playerId, durationMs: 1100 });
      }
    });
    return () => {
      unsub();
      if (confettiTimer.current) clearInterval(confettiTimer.current);
    };
  }, []);

  return null;
}
