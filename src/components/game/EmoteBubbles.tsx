"use client";

import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { EMOTES, EMOTE_DURATION_MS, activeEmotes, pruneEmotes, showEmote } from "@/game/emotes";
import { livePoses } from "@/game/remote";
import { onGameplayEvent } from "@/game/sync";

const POOL = 8;
const textures = new Map<string, THREE.CanvasTexture>();

/** Emoji drawn once onto a small canvas → sprite texture (no DOM per frame, no external assets). */
function emojiTexture(emoji: string): THREE.CanvasTexture {
  let tex = textures.get(emoji);
  if (tex) return tex;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 128;
  const ctx = canvas.getContext("2d");
  if (ctx) {
    ctx.beginPath();
    ctx.arc(64, 64, 58, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(255,255,255,0.92)";
    ctx.fill();
    ctx.lineWidth = 6;
    ctx.strokeStyle = "#12142b";
    ctx.stroke();
    ctx.font = "72px system-ui, 'Apple Color Emoji', 'Segoe UI Emoji', 'Noto Color Emoji', sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(emoji, 64, 70);
  }
  tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  textures.set(emoji, tex);
  return tex;
}

/** Pooled sprites that float above whoever is emoting. */
export function EmoteBubbles() {
  const sprites = useRef<(THREE.Sprite | null)[]>(Array(POOL).fill(null));
  const materials = useMemo(() => Array.from({ length: POOL }, () => new THREE.SpriteMaterial({ transparent: true, depthTest: false, depthWrite: false })), []);

  useEffect(() => {
    const off = onGameplayEvent((evt) => {
      if (evt.k === "emote") showEmote(evt.id, evt.e);
    });
    return () => {
      off();
      materials.forEach((m) => m.dispose());
    };
  }, [materials]);

  useFrame(() => {
    const now = performance.now();
    pruneEmotes(now);
    let slot = 0;
    activeEmotes.forEach((a, id) => {
      if (slot >= POOL) return;
      const p = livePoses.get(id);
      const sprite = sprites.current[slot];
      if (!p || !sprite) return;
      const age = (now - a.since) / EMOTE_DURATION_MS;
      const pop = age < 0.12 ? age / 0.12 : 1;
      const fade = age > 0.8 ? 1 - (age - 0.8) / 0.2 : 1;
      sprite.visible = true;
      sprite.position.set(p.x, p.y + 2.5 + Math.sin(now * 0.006) * 0.08 + age * 0.4, p.z);
      const s = 1.1 * (0.6 + 0.4 * pop);
      sprite.scale.set(s, s, 1);
      const mat = materials[slot];
      const tex = emojiTexture(EMOTES[a.e]);
      if (mat.map !== tex) {
        mat.map = tex;
        mat.needsUpdate = true;
      }
      mat.opacity = fade;
      slot++;
    });
    for (; slot < POOL; slot++) {
      const sprite = sprites.current[slot];
      if (sprite) sprite.visible = false;
    }
  });

  return (
    <group renderOrder={999}>
      {materials.map((m, i) => (
        <sprite key={i} ref={(s) => { sprites.current[i] = s; }} material={m} visible={false} />
      ))}
    </group>
  );
}
