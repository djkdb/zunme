"use client";

import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import {
  CAMERA_FOV,
  CAMERA_FOLLOW_SMOOTH,
  CAMERA_LOOK_AHEAD,
  CAMERA_OFFSET,
  CAMERA_ZOOM_MAX,
  CAMERA_ZOOM_MIN,
} from "@/game/config";
import { focusEvents, shakeEvents } from "@/game/effects";
import { livePoses, localPose } from "@/game/remote";
import { getPhase } from "@/game/phase";
import { hasFinishLine, isScoreMode } from "@/game/authority";
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
  const fovKick = useRef(0);
  const prevVy = useRef(0);
  const tmpCentre = useMemo(() => new THREE.Vector3(), []);

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

  useFrame((frame, dt) => {
    const store = useGameStore.getState();
    const { state, localId } = store;
    const now = performance.now();
    const localPlaying = state.alive.includes(localId) && (state.status === "PLAYING" || state.status === "COUNTDOWN");

    const gameMode = state.mode;
    const race = gameMode === "RACE" || gameMode === "TIPTOE";
    const run = gameMode === "GOGUN";
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
      // Tighter framing when it is down to the last two, and in the final seconds.
      const duel = state.alive.length === 2 && state.participants.length > 2 && !hasFinishLine(gameMode) && !isScoreMode(gameMode);
      const phase = getPhase(state, useGameStore.getState().client?.now() ?? Date.now());
      const tension = (duel ? 0.92 : 1) * (phase === "FINAL" ? 0.95 : 1);
      const targetZoom = race || run ? 1 : THREE.MathUtils.clamp((0.95 + far / 26) * tension, CAMERA_ZOOM_MIN, CAMERA_ZOOM_MAX);
      zoom.current += (targetZoom - zoom.current) * step * 0.6;
      const offY = run ? 5.5 : race ? 8 : CAMERA_OFFSET.y;
      const offZ = run ? 10 : race ? 11 : CAMERA_OFFSET.z;
      const ahead = race || run ? CAMERA_LOOK_AHEAD * 2.2 : CAMERA_LOOK_AHEAD;
      desired.current.set(
        target.current.x * (race || run ? 0.6 : 1) + CAMERA_OFFSET.x * zoom.current,
        Math.max(target.current.y, -1) + offY * zoom.current,
        target.current.z + offZ * zoom.current,
      );
      lookAt.current.set(
        target.current.x + localPose.velocity.x * 0.08 * ahead,
        target.current.y + 1.0,
        target.current.z + localPose.velocity.z * 0.08 * ahead - (race ? 2.5 : run ? 4 : 0),
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
      desired.current.set(cx + Math.cos(orbit.current) * 7.5, cy + 3.6, cz + Math.sin(orbit.current) * 7.5);
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
      target.current.lerp(tmpCentre.set(cx, 0, cz), step * 0.5);
      orbit.current += dt * 0.12;
      desired.current.set(target.current.x + Math.sin(orbit.current) * 4, 16, target.current.z + 20);
      lookAt.current.set(target.current.x, 0.5, target.current.z);
    } else {
      // lobby / menu: slow wide orbit around the map
      orbit.current += dt * (menu ? 0.08 : 0.12);
      const r = menu ? 30 : race ? 34 : run ? 30 : 26;
      const cz = gameMode === "TIPTOE" ? -12 : race ? -22 : run ? -18 : 0;
      desired.current.set(Math.cos(orbit.current) * r, menu ? 11 : race ? 18 : 14, cz + Math.sin(orbit.current) * r);
      lookAt.current.set(0, menu ? 1.5 : 0.5, cz);
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

    // FOV kick while dashing, tiny dip on landing.
    const cam = frame.camera as THREE.PerspectiveCamera;
    const dashing = performance.now() < localPose.dashUntil;
    const targetKick = mode === "follow" && dashing ? 9 : 0;
    fovKick.current = THREE.MathUtils.lerp(fovKick.current, targetKick, 1 - Math.exp(-(dashing ? 18 : 6) * dt));
    const fov = CAMERA_FOV + fovKick.current;
    if (Math.abs(cam.fov - fov) > 0.01) {
      cam.fov = fov;
      cam.updateProjectionMatrix();
    }
    if (mode === "follow" && localPose.grounded && prevVy.current < -7) trauma.current = Math.min(1, trauma.current + 0.12);
    prevVy.current = localPose.grounded ? 0 : localPose.velocity.y;
  });

  return null;
}
