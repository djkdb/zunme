"use client";

import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import {
  CAMERA_FOLLOW_SMOOTH,
  CAMERA_LOOK_AHEAD,
  CAMERA_OFFSET,
  CAMERA_ZOOM_MAX,
  CAMERA_ZOOM_MIN,
} from "@/game/config";
import { focusEvents, shakeEvents } from "@/game/effects";
import { livePoses, localPose } from "@/game/remote";
import { useGameStore } from "@/store/gameStore";

type Mode = "follow" | "spectate" | "orbit-winner" | "lobby" | "focus";

/**
 * Third-person follow camera with a fixed world heading (so joystick
 * "up" is always away from the camera), smoothed follow, look-ahead,
 * dynamic zoom based on how spread out the players are, trauma-based
 * shake, plus spectator / result orbits.
 */
export function CameraController({ menu = false }: { menu?: boolean }) {
  const { camera } = useThree();
  const target = useRef(new THREE.Vector3(0, 0, 0));
  const desired = useRef(new THREE.Vector3());
  const lookAt = useRef(new THREE.Vector3());
  const smoothLook = useRef(new THREE.Vector3(0, 1, 0));
  const zoom = useRef(1);
  const trauma = useRef(0);
  const orbit = useRef(0);
  const focus = useRef<{ playerId: string | null; until: number; pos: THREE.Vector3 }>({ playerId: null, until: 0, pos: new THREE.Vector3() });
  const initialized = useRef(false);
  const shakeOffset = useMemo(() => new THREE.Vector3(), []);

  useEffect(() => {
    const offShake = shakeEvents.on((s) => {
      trauma.current = Math.min(1, trauma.current + s);
    });
    const offFocus = focusEvents.on(({ playerId, durationMs }) => {
      const p = playerId ? livePoses.get(playerId) : null;
      if (p) focus.current.pos.set(p.x, p.y, p.z);
      focus.current.playerId = playerId;
      focus.current.until = performance.now() + durationMs;
    });
    return () => {
      offShake();
      offFocus();
    };
  }, []);

  useFrame((_, dt) => {
    const store = useGameStore.getState();
    const { state, localId } = store;
    const now = performance.now();
    const localPlaying = state.alive.includes(localId) && (state.status === "PLAYING" || state.status === "COUNTDOWN");

    let mode: Mode = "lobby";
    if (menu) mode = "lobby";
    else if (focus.current.until > now && focus.current.playerId) mode = "focus";
    else if (state.status === "FINISHED" && state.winnerId && livePoses.has(state.winnerId)) mode = "orbit-winner";
    else if (localPlaying) mode = "follow";
    else if (state.status === "PLAYING" || state.status === "COUNTDOWN") mode = "spectate";

    const step = 1 - Math.exp(-CAMERA_FOLLOW_SMOOTH * dt);

    if (mode === "follow") {
      const p = localPose.position;
      target.current.set(p.x, p.y, p.z);
      // Zoom out when other players are far, so fights stay in frame.
      let far = 0;
      livePoses.forEach((pos, id) => {
        if (id === localId || !state.alive.includes(id)) return;
        far = Math.max(far, Math.hypot(pos.x - p.x, pos.z - p.z));
      });
      const targetZoom = THREE.MathUtils.clamp(0.95 + far / 26, CAMERA_ZOOM_MIN, CAMERA_ZOOM_MAX);
      zoom.current += (targetZoom - zoom.current) * step * 0.6;
      desired.current.set(
        target.current.x + CAMERA_OFFSET.x * zoom.current,
        Math.max(target.current.y, -1) + CAMERA_OFFSET.y * zoom.current,
        target.current.z + CAMERA_OFFSET.z * zoom.current,
      );
      lookAt.current.set(
        target.current.x + localPose.velocity.x * 0.08 * CAMERA_LOOK_AHEAD,
        target.current.y + 1.0,
        target.current.z + localPose.velocity.z * 0.08 * CAMERA_LOOK_AHEAD,
      );
    } else if (mode === "focus") {
      const p = focus.current.playerId ? livePoses.get(focus.current.playerId) : null;
      if (p) focus.current.pos.set(p.x, Math.max(p.y, -8), p.z);
      const f = focus.current.pos;
      desired.current.set(f.x * 0.6, Math.max(f.y, -2) + 6, f.z * 0.6 + 9);
      lookAt.current.set(f.x, f.y + 0.5, f.z);
    } else if (mode === "orbit-winner") {
      const p = livePoses.get(state.winnerId as string);
      orbit.current += dt * 0.5;
      const cx = p?.x ?? 0;
      const cz = p?.z ?? 0;
      const cy = p?.y ?? 0;
      desired.current.set(cx + Math.cos(orbit.current) * 6.5, cy + 3.2, cz + Math.sin(orbit.current) * 6.5);
      lookAt.current.set(cx, cy + 1.1, cz);
      zoom.current = 1;
    } else if (mode === "spectate") {
      // Centre of the surviving players, framed from higher up.
      let cx = 0;
      let cz = 0;
      let n = 0;
      livePoses.forEach((pos, id) => {
        if (!state.alive.includes(id)) return;
        cx += pos.x;
        cz += pos.z;
        n++;
      });
      if (n > 0) {
        cx /= n;
        cz /= n;
      }
      target.current.lerp(new THREE.Vector3(cx, 0, cz), step * 0.5);
      orbit.current += dt * 0.12;
      desired.current.set(target.current.x + Math.sin(orbit.current) * 4, 16, target.current.z + 20);
      lookAt.current.set(target.current.x, 0.5, target.current.z);
    } else {
      // lobby / menu: slow wide orbit around the island
      orbit.current += dt * (menu ? 0.08 : 0.12);
      const r = menu ? 30 : 26;
      desired.current.set(Math.cos(orbit.current) * r, menu ? 11 : 14, Math.sin(orbit.current) * r);
      lookAt.current.set(0, menu ? 1.5 : 0.5, 0);
    }

    if (!initialized.current) {
      camera.position.copy(desired.current);
      smoothLook.current.copy(lookAt.current);
      initialized.current = true;
    } else {
      const k = mode === "follow" ? step : 1 - Math.exp(-2.2 * dt);
      camera.position.lerp(desired.current, k);
      smoothLook.current.lerp(lookAt.current, mode === "follow" ? step * 1.4 : k);
    }

    // Shake: trauma^2 scaled random offset, decaying over time.
    if (trauma.current > 0) {
      const t = trauma.current * trauma.current;
      shakeOffset.set((Math.random() - 0.5) * t * 0.9, (Math.random() - 0.5) * t * 0.6, (Math.random() - 0.5) * t * 0.5);
      camera.position.add(shakeOffset);
      trauma.current = Math.max(0, trauma.current - dt * 2.2);
    }
    camera.lookAt(smoothLook.current);
  });

  return null;
}
