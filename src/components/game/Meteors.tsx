"use client";

import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";
import { buildMeteorSchedule } from "@/game/arena";
import { METEOR_IMPULSE, METEOR_RADIUS, METEOR_WARNING_MS, OBSTACLE_STUN_MS } from "@/game/config";
import { elapsedSinceStart } from "@/game/clock";
import { burst, shake } from "@/game/effects";
import { localPose } from "@/game/remote";
import { sound } from "@/game/audio";
import { useGameStore } from "@/store/gameStore";

const MAX_VISIBLE = 3;
const FALL_MS = 600;
const FALL_HEIGHT = 26;

/**
 * Meteor strikes on the DROPZONE island: a pulsing warning ring, then a
 * boulder slams down and flings anyone inside the radius. Purely
 * clock+seed driven so every client sees the same strikes; the knockback
 * is applied to the local player only (each client handles its own body).
 */
export function Meteors() {
  const seed = useGameStore((s) => s.state.seed);
  const mainMs = useGameStore((s) => Math.max(10_000, s.state.endAt - s.state.startAt));
  const strikes = useMemo(() => buildMeteorSchedule(seed, mainMs), [seed, mainMs]);
  const rings = useRef<(THREE.Mesh | null)[]>(Array(MAX_VISIBLE).fill(null));
  const rocks = useRef<(THREE.Mesh | null)[]>(Array(MAX_VISIBLE).fill(null));
  const hitDone = useRef<Set<number>>(new Set());
  const warned = useRef<Set<number>>(new Set());
  const lastRound = useRef(-1);
  const scorches = useRef<(THREE.Mesh | null)[]>(Array(MAX_VISIBLE).fill(null));
  const scorchAt = useRef<number[]>(Array(MAX_VISIBLE).fill(0));
  const scorchSlot = useRef(0);

  useFrame(() => {
    const state = useGameStore.getState().state;
    if (state.round !== lastRound.current) {
      lastRound.current = state.round;
      hitDone.current.clear();
      warned.current.clear();
    }
    const active = state.status === "PLAYING";
    const elapsed = active ? elapsedSinceStart(state) : -Infinity;
    let slot = 0;
    for (let i = 0; i < strikes.length && slot < MAX_VISIBLE; i++) {
      const s = strikes[i];
      const dt = elapsed - s.at; // negative = incoming
      if (dt < -METEOR_WARNING_MS || dt > 500) continue;
      const ring = rings.current[slot];
      const rock = rocks.current[slot];
      slot++;
      if (!warned.current.has(i)) {
        warned.current.add(i);
        sound.play("warning", { volume: 0.5, throttleMs: 400 });
      }
      if (ring) {
        ring.visible = dt < 0;
        ring.position.set(s.x, 0.03, s.z);
        const k = 1 + dt / METEOR_WARNING_MS; // 0..1 as impact nears
        const pulse = 0.85 + 0.15 * Math.sin(performance.now() * (0.01 + k * 0.03));
        ring.scale.setScalar(pulse);
        (ring.material as THREE.MeshBasicMaterial).opacity = 0.35 + 0.55 * k;
      }
      if (rock) {
        const fall = THREE.MathUtils.clamp((dt + FALL_MS) / FALL_MS, 0, 1);
        rock.visible = dt >= -FALL_MS && dt < 400;
        const y = dt < 0 ? FALL_HEIGHT * (1 - fall * fall) + 0.9 : Math.max(0.2, 0.9 - dt / 400);
        rock.position.set(s.x, y, s.z);
        rock.rotation.x += 0.2;
        rock.rotation.z += 0.13;
        const settle = dt >= 0 ? 1 - dt / 800 : 1;
        rock.scale.setScalar(Math.max(0.01, settle));
      }
      if (dt >= 0 && !hitDone.current.has(i)) {
        hitDone.current.add(i);
        burst({ position: { x: s.x, y: 0.3, z: s.z }, color: ["#8a6a52", "#ff7a3c", "#ffd32a", "#ffffff"], count: 36, speed: 6, life: 0.9, size: 0.18, gravity: 12, spread: 1.2 });
        shake(0.45);
        sound.play("heavy", { volume: 1 });
        // scorch mark where it landed (recycled, fades over a few seconds)
        const k = scorchSlot.current++ % MAX_VISIBLE;
        const sc = scorches.current[k];
        if (sc) {
          sc.visible = true;
          sc.position.set(s.x, 0.02, s.z);
          sc.rotation.z = Math.random() * Math.PI;
          scorchAt.current[k] = performance.now();
        }
        const p = localPose.position;
        const dx = p.x - s.x;
        const dz = p.z - s.z;
        const d = Math.hypot(dx, dz);
        if (d < METEOR_RADIUS && p.y > -1) {
          const k = 1 - (d / METEOR_RADIUS) * 0.5;
          const nx = d > 0.05 ? dx / d : 1;
          const nz = d > 0.05 ? dz / d : 0;
          localPose.pendingImpulse = { x: nx * METEOR_IMPULSE * k, y: 5 * k, z: nz * METEOR_IMPULSE * k, stunMs: OBSTACLE_STUN_MS };
          shake(0.6);
        }
      }
    }
    for (; slot < MAX_VISIBLE; slot++) {
      const ring = rings.current[slot];
      const rock = rocks.current[slot];
      if (ring) ring.visible = false;
      if (rock) rock.visible = false;
    }
    const now = performance.now();
    for (let k = 0; k < MAX_VISIBLE; k++) {
      const sc = scorches.current[k];
      if (!sc || !sc.visible) continue;
      const age = (now - scorchAt.current[k]) / 6000;
      if (age >= 1 || !active) sc.visible = false;
      else (sc.material as THREE.MeshBasicMaterial).opacity = 0.55 * (1 - age);
    }
  });

  return (
    <group>
      {Array.from({ length: MAX_VISIBLE }, (_, i) => (
        <mesh key={`scorch-${i}`} ref={(m) => { scorches.current[i] = m; }} visible={false} rotation={[-Math.PI / 2, 0, 0]}>
          <circleGeometry args={[METEOR_RADIUS * 0.7, 20]} />
          <meshBasicMaterial color="#1b1410" transparent opacity={0.5} depthWrite={false} />
        </mesh>
      ))}
      {Array.from({ length: MAX_VISIBLE }, (_, i) => (
        <group key={i}>
          <mesh ref={(m) => { rings.current[i] = m; }} visible={false} rotation={[-Math.PI / 2, 0, 0]}>
            <ringGeometry args={[METEOR_RADIUS - 0.35, METEOR_RADIUS, 32]} />
            <meshBasicMaterial color="#ff3b3b" transparent opacity={0.6} side={THREE.DoubleSide} depthWrite={false} />
          </mesh>
          <mesh ref={(m) => { rocks.current[i] = m; }} visible={false} castShadow>
            <dodecahedronGeometry args={[0.9, 0]} />
            <meshStandardMaterial color="#6b4f3a" emissive="#ff5a3c" emissiveIntensity={0.5} roughness={0.9} flatShading />
          </mesh>
        </group>
      ))}
    </group>
  );
}
