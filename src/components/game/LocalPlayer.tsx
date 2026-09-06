"use client";

import { useFrame } from "@react-three/fiber";
import {
  CapsuleCollider,
  RigidBody,
  useBeforePhysicsStep,
  useRapier,
  type CollisionPayload,
  type RapierRigidBody,
} from "@react-three/rapier";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { TRAIL_COLORS, type Cosmetics } from "@/game/items";
import { Character, createAnim, type CharacterAnim } from "@/components/game/Character";
import {
  BOSS_DASH_COOLDOWN,
  BOSS_HIT_MULTIPLIER,
  BOSS_KNOCKBACK_RESIST,
  BOSS_MASS,
  BOSS_SCALE,
  BOSS_SPEED,
  AIR_HIT_MULTIPLIER,
  COYOTE_TIME_MS,
  DASH_COOLDOWN,
  DASH_DURATION,
  DASH_SELF_KNOCKBACK,
  DASH_SPEED,
  HIT_STUN_MS,
  JUMP_BUFFER_MS,
  JUMP_CUT_MULTIPLIER,
  OBSTACLE_STUN_MS,
  PUSH_RELATIVE_FACTOR,
  JUMP_FORCE,
  OBSTACLE_PUSH_IMPULSE,
  PLAYER_ACCEL,
  PLAYER_AIR_CONTROL,
  PLAYER_HEIGHT,
  PLAYER_LINEAR_DAMPING,
  PLAYER_MASS,
  PLAYER_RADIUS,
  PLAYER_SPEED,
  PUSH_IMPULSE,
  PUSH_IMPULSE_MAX,
  PUSH_UPWARD,
} from "@/game/config";
import { burst, shake } from "@/game/effects";
import { consumeDash, consumeJump, input, lastJumpPressAt } from "@/game/input";
import { GOGUN_CRASH_MS, GOGUN_JUMP_CUT, GOGUN_WIRE_MAX_MS, GOGUN_WIRE_RELEASE_BOOST, gogunRuntime } from "@/game/gogun";
import { livePoses, localPose } from "@/game/remote";
import { sound } from "@/game/audio";
import { raceRuntime } from "@/game/sync";
import { partyRuntime } from "@/game/party";
import { useGameStore } from "@/store/gameStore";
import { isRoundActive } from "@/game/clock";

/** Mode-specific behaviour injected by the scene. */
export interface PlayerRules {
  /** below this y the player has fallen */
  fallY: number;
  /** "eliminate" reports the fall to the host; "respawn" teleports to `respawnAt()` */
  onFall: "eliminate" | "respawn";
  respawnAt?: () => [number, number, number];
  /** called every physics step with the collider the player stands on */
  onGround?: (colliderHandle: number) => void;
  /** surface velocity of the collider stood on (conveyor belts) */
  surfaceVelocity?: (colliderHandle: number) => [number, number] | undefined;
  /** horizontal velocity offset applied while in a wind zone */
  wind?: () => [number, number];
  /** returns a queued vertical launch velocity once, 0 otherwise */
  consumeLaunch?: () => number;
  /** GOGUN RUN: auto-run + wire controller replaces normal movement */
  autoRun?: AutoRunRules;
  /** dynamic fall height (rising lava); overrides fallY when present */
  fallYAt?: () => number;
  /** called every physics step with the feet position (coins, zones, progress) */
  onStep?: (x: number, y: number, z: number, grounded: boolean) => void;
  /** touched another player's body */
  onContact?: (otherId: string) => void;
  /** about to respawn after a fall (respawn modes) */
  onRespawn?: () => void;
  /** movement speed multiplier (zombies, crown holder…) */
  speedScale?: () => number;
}

export interface AutoRunRules {
  /** forward speed for a distance along the course */
  speedAt: (distance: number) => number;
  jumpForce: number;
  laneHalf: number;
  startZ: number;
  /** find an anchor ahead to hook; null if none in range */
  findAnchor: (x: number, y: number, z: number) => { index: number; x: number; y: number; z: number } | null;
  /** called every step so the scene can collect coins / progress */
  onStep: (x: number, y: number, z: number, grounded: boolean) => void;
}

interface Props {
  id: string;
  nickname: string;
  colorHex: string;
  spawn: [number, number, number];
  showLabel: boolean;
  cosmetics: Cosmetics;
  rules: PlayerRules;
  /** this player is the BOSS this round */
  boss?: boolean;
}

interface BodyUserData {
  type: "player" | "spinner" | "wall" | "pole";
  id?: string;
}

const tmpVel = new THREE.Vector3();
const tmpDir = new THREE.Vector3();

export function LocalPlayer({ id, nickname, colorHex, spawn, showLabel, rules, cosmetics, boss = false }: Props) {
  const body = useRef<RapierRigidBody>(null);
  const animRef = useRef<CharacterAnim>(createAnim());
  const { world, rapier } = useRapier();
  const grounded = useRef(false);
  const fellReported = useRef(false);
  const rulesRef = useRef(rules);
  useEffect(() => {
    rulesRef.current = rules;
  }, [rules]);
  const lastRound = useRef(-1);
  const rayRef = useRef<InstanceType<typeof rapier.Ray> | null>(null);
  const scale = boss ? BOSS_SCALE : 1;
  const halfHeight = ((PLAYER_HEIGHT - PLAYER_RADIUS * 2) / 2) * scale;
  const radius = PLAYER_RADIUS * scale;
  const lastTrail = useRef(0);
  const lastGroundedAt = useRef(0);
  const jumpBufferedAt = useRef(0);
  const jumpCut = useRef(false);
  const dashDir = useRef({ x: 0, z: 1 });
  const blockedSince = useRef(0);
  const lastCommandedVz = useRef(0);
  const lastReportRetry = useRef(0);
  // Stable identity: rapier re-applies every mutable body option (position included) when this changes.
  const userData = useMemo(() => ({ type: "player", id }) satisfies BodyUserData, [id]);

  // Dev-only hook so e2e tests / the console can move the local player.
  useEffect(() => {
    if (process.env.NODE_ENV === "production") return;
    const w = window as unknown as { __dropzone?: Record<string, unknown> };
    if (!w.__dropzone) w.__dropzone = {};
    w.__dropzone.teleport = (x: number, y: number, z: number) => {
      body.current?.setTranslation({ x, y, z }, true);
      body.current?.setLinvel({ x: 0, y: 0, z: 0 }, true);
    };
    return () => {
      delete w.__dropzone?.teleport;
    };
  }, []);

  // Reset to the spawn point whenever a new round begins.
  useEffect(() => {
    const unsub = useGameStore.subscribe((s) => {
      const rb = body.current;
      if (!rb) return;
      if (s.state.status === "COUNTDOWN" && s.state.round !== lastRound.current) {
        lastRound.current = s.state.round;
        fellReported.current = false;
        raceRuntime.reset();
        gogunRuntime.reset();
        blockedSince.current = 0;
        lastCommandedVz.current = 0;
        localPose.dashUntil = 0;
        localPose.dashReadyAt = 0;
        localPose.stunUntil = 0;
        rb.setTranslation({ x: spawn[0], y: spawn[1], z: spawn[2] }, true);
        rb.setLinvel({ x: 0, y: 0, z: 0 }, true);
        animRef.current.yaw = Math.atan2(-spawn[0], -spawn[2]);
      }
    });
    return unsub;
  }, [spawn]);

  useBeforePhysicsStep(() => {
    const rb = body.current;
    if (!rb) return;
    const anim = animRef.current;
    const t = rb.translation();
    const v = rb.linvel();

    // Ground probe from the capsule centre.
    if (!rayRef.current) rayRef.current = new rapier.Ray({ x: 0, y: 0, z: 0 }, { x: 0, y: -1, z: 0 });
    const ray = rayRef.current;
    ray.origin.x = t.x;
    ray.origin.y = t.y;
    ray.origin.z = t.z;
    const hit = world.castRay(ray, (PLAYER_HEIGHT / 2) * scale + 0.12, true, undefined, undefined, undefined, rb);
    const wasGrounded = grounded.current;
    grounded.current = hit !== null && v.y <= 0.5;
    if (hit && grounded.current) rulesRef.current.onGround?.(hit.collider.handle);
    const surface = hit && grounded.current ? rulesRef.current.surfaceVelocity?.(hit.collider.handle) : undefined;
    const wind = rulesRef.current.wind?.();
    if (grounded.current && !wasGrounded && localPose.velocity.y < -4) {
      anim.landedAt = performance.now();
      burst({ position: { x: t.x, y: t.y - PLAYER_HEIGHT / 2, z: t.z }, color: "#ffffff", count: 6, speed: 2, life: 0.4, size: 0.12 });
    }

    const active = isRoundActive();
    const dt = 1 / 60;
    const now = performance.now();
    if (grounded.current) lastGroundedAt.current = now;
    const stunned = now < localPose.stunUntil;
    const dashing = now < localPose.dashUntil;
    const canControl = active && !stunned;

    // ── GOGUN RUN: auto-run, jump, wire swing ──
    const auto = rulesRef.current.autoRun;
    if (auto) {
      const wire = gogunRuntime.wire;
      let vx = v.x;
      let vy = v.y;
      let vz = v.z;
      const distance = Math.max(0, auto.startZ - t.z);
      const speed = active ? auto.speedAt(distance) : 0;
      const jumpPressed = consumeJump();
      consumeDash();

      if (wire.active) {
        // Rope constraint: keep within rope length, kill outward radial velocity, add gravity.
        const dx = t.x - wire.x;
        const dy = t.y - wire.y;
        const dz = t.z - wire.z;
        const dist = Math.hypot(dx, dy, dz);
        const nx = dx / dist;
        const ny = dy / dist;
        const nz = dz / dist;
        const radial = vx * nx + vy * ny + vz * nz;
        if (dist >= wire.length && radial > 0) {
          vx -= radial * nx;
          vy -= radial * ny;
          vz -= radial * nz;
          const over = dist - wire.length;
          rb.setTranslation({ x: t.x - nx * over, y: t.y - ny * over, z: t.z - nz * over }, true);
        }
        // pump forward a little so swings carry
        vz -= 4 * dt;
        lastCommandedVz.current = 0;
        const passed = t.z < wire.z - 0.5; // swung past the anchor
        const timeout = now - wire.since > GOGUN_WIRE_MAX_MS;
        if (jumpPressed || passed || timeout || grounded.current) {
          wire.active = false;
          vx *= GOGUN_WIRE_RELEASE_BOOST;
          vz *= GOGUN_WIRE_RELEASE_BOOST;
          vy = Math.max(vy, 2.5) + 2.5;
          sound.play("jump", { volume: 0.5 });
          burst({ position: { x: t.x, y: t.y, z: t.z }, color: ["#ffffff", "#ffd32a"], count: 8, speed: 2, life: 0.4, size: 0.1 });
        }
      } else {
        // steer sideways, auto-run forward
        const steer = canControl ? input.moveX : 0;
        const targetX = THREE.MathUtils.clamp(t.x + steer * 3, -auto.laneHalf, auto.laneHalf);
        vx = THREE.MathUtils.clamp((targetX - t.x) * 4, -6, 6);
        // Blocked by a wall / box: we commanded forward speed last step but the body barely moved.
        // While suspicious we only nudge forward (30%) so a wall can't hold us by friction, and we
        // release as soon as the body actually moves again (edge clips resolve themselves).
        const commanded = lastCommandedVz.current;
        const stalled = commanded < -0.5 && v.z > commanded * 0.35;
        const rising = v.y > 1.5;
        const blockedNow = active && !jumpPressed && !rising && (stalled || (blockedSince.current > 0 && v.z > -0.6));
        vz = active ? (blockedNow ? -speed * 0.3 : -speed) : 0;
        lastCommandedVz.current = vz;
        gogunRuntime.anchorInRange = !grounded.current && auto.findAnchor(t.x, t.y, t.z) !== null;
        if (jumpPressed && canControl) {
          if (grounded.current || now - lastGroundedAt.current < COYOTE_TIME_MS) {
            vy = auto.jumpForce;
            grounded.current = false;
            lastGroundedAt.current = 0;
            jumpCut.current = false;
            sound.play("jump", { volume: 0.6 });
            burst({ position: { x: t.x, y: t.y - PLAYER_HEIGHT / 2, z: t.z }, color: "#ffffff", count: 5, speed: 1.6, life: 0.35, size: 0.1 });
          } else {
            const a = auto.findAnchor(t.x, t.y, t.z);
            if (a) {
              wire.active = true;
              wire.anchor = a.index;
              wire.x = a.x;
              wire.y = a.y;
              wire.z = a.z;
              wire.length = Math.hypot(t.x - a.x, t.y - a.y, t.z - a.z);
              wire.since = now;
              sound.play("dash", { volume: 0.5 });
              shake(0.08);
            }
          }
        } else if (!grounded.current && vy > 2 && !input.jumpHeld && !jumpCut.current) {
          vy *= GOGUN_JUMP_CUT;
          jumpCut.current = true;
        }
        if (grounded.current) jumpCut.current = false;
        // Ran into a wall: the original punishes this with a fall.
        if (blockedNow) {
          if (!blockedSince.current) blockedSince.current = now;
          else if (now - blockedSince.current > GOGUN_CRASH_MS && !fellReported.current) {
            fellReported.current = true;
            localPose.stunUntil = now + 600;
            anim.stunUntil = localPose.stunUntil;
            shake(0.5);
            sound.play("elimination");
            burst({ position: { x: t.x, y: t.y, z: t.z }, color: ["#ffffff", "#ff5a3c"], count: 16, speed: 3, life: 0.6, size: 0.14 });
            // fling backwards off the roof
            vz = 5;
            vy = 4;
            rb.setTranslation({ x: t.x, y: t.y + 0.05, z: t.z + 0.3 }, true);
            useGameStore.getState().reportFall();
          }
        } else {
          blockedSince.current = 0;
        }
      }
      if (fellReported.current) {
        vz = Math.max(vz, 2);
      }
      rb.setLinvel({ x: vx, y: vy, z: vz }, true);
      anim.yaw = Math.PI; // always face -z
      anim.dashUntil = wire.active ? now + 50 : 0;
      auto.onStep(t.x, t.y - PLAYER_HEIGHT / 2, t.z, grounded.current);
      const r0 = rulesRef.current;
      if (t.y < r0.fallY && active && !fellReported.current) {
        fellReported.current = true;
        wire.active = false;
        useGameStore.getState().reportFall();
      } else if (!active && t.y < r0.fallY - 4) {
        // lobby / results playground: walked off the roof — put them back
        rb.setTranslation({ x: spawn[0], y: spawn[1], z: spawn[2] }, true);
        rb.setLinvel({ x: 0, y: 0, z: 0 }, true);
      }
      return;
    }

    let mx = canControl ? input.moveX : 0;
    let mz = canControl ? -input.moveY : 0;
    const len = Math.hypot(mx, mz);
    if (len > 1) {
      mx /= len;
      mz /= len;
    }

    // Dash: short burst in the move direction (or facing), with cooldown.
    if (consumeDash() && canControl && !dashing && now >= localPose.dashReadyAt) {
      const dx = len > 0.1 ? mx : Math.sin(anim.yaw);
      const dz = len > 0.1 ? mz : Math.cos(anim.yaw);
      dashDir.current = { x: dx, z: dz };
      localPose.dashUntil = now + DASH_DURATION;
      localPose.dashReadyAt = now + (boss ? BOSS_DASH_COOLDOWN : DASH_COOLDOWN);
      anim.dashUntil = localPose.dashUntil;
      anim.yaw = Math.atan2(dx, dz);
      sound.play("dash", { volume: 0.7 });
      shake(0.12);
      burst({ position: { x: t.x, y: t.y - PLAYER_HEIGHT / 2 + 0.2, z: t.z }, color: ["#ffffff", colorHex], count: 8, speed: 2.5, life: 0.35, size: 0.12, gravity: 2 });
    }

    let vx: number;
    let vz: number;
    if (now < localPose.dashUntil) {
      vx = dashDir.current.x * DASH_SPEED;
      vz = dashDir.current.z * DASH_SPEED;
    } else if (stunned) {
      // Knockback carries; only air drag.
      vx = v.x * (grounded.current ? 0.97 : 0.995);
      vz = v.z * (grounded.current ? 0.97 : 0.995);
    } else {
      const control = grounded.current ? 1 : PLAYER_AIR_CONTROL;
      const moveSpeed = (boss ? BOSS_SPEED : PLAYER_SPEED) * (rulesRef.current.speedScale?.() ?? 1);
      const targetX = mx * moveSpeed + (surface?.[0] ?? 0) + (wind?.[0] ?? 0);
      const targetZ = mz * moveSpeed + (surface?.[1] ?? 0) + (wind?.[1] ?? 0);
      const carried = Boolean(surface) || Boolean(wind && (wind[0] !== 0 || wind[1] !== 0));
      const maxDelta = PLAYER_ACCEL * control * dt;
      vx = v.x + THREE.MathUtils.clamp(targetX - v.x, -maxDelta, maxDelta);
      vz = v.z + THREE.MathUtils.clamp(targetZ - v.z, -maxDelta, maxDelta);
      // Extra ground friction when idle so shoves settle quickly.
      if (grounded.current && len < 0.05 && !carried) {
        vx *= 0.88;
        vz *= 0.88;
      }
    }

    let vy = v.y;
    // Jump: buffered presses, coyote time, and a shorter hop when released early.
    if (consumeJump()) jumpBufferedAt.current = lastJumpPressAt || now;
    const wantsJump = now - jumpBufferedAt.current < JUMP_BUFFER_MS && jumpBufferedAt.current > 0;
    const canJump = grounded.current || now - lastGroundedAt.current < COYOTE_TIME_MS;
    if (canControl && wantsJump && canJump && vy <= 0.5) {
      vy = JUMP_FORCE;
      grounded.current = false;
      lastGroundedAt.current = 0;
      jumpBufferedAt.current = 0;
      jumpCut.current = false;
      anim.landedAt = 0;
      sound.play("jump", { volume: 0.6 });
      burst({ position: { x: t.x, y: t.y - PLAYER_HEIGHT / 2, z: t.z }, color: "#ffffff", count: 5, speed: 1.6, life: 0.35, size: 0.1 });
    } else if (!grounded.current && vy > 2 && !input.jumpHeld && !jumpCut.current && !stunned) {
      vy *= JUMP_CUT_MULTIPLIER;
      jumpCut.current = true;
    }
    if (grounded.current) jumpCut.current = false;
    // Hazard impulses (meteors) queued from the scene.
    const pending = localPose.pendingImpulse;
    if (pending && active) {
      localPose.pendingImpulse = null;
      vx += pending.x;
      vz += pending.z;
      vy = Math.max(vy, pending.y);
      grounded.current = false;
      localPose.stunUntil = now + pending.stunMs;
      anim.stunUntil = localPose.stunUntil;
      anim.hitAt = now;
      sound.play("impact", { volume: 0.8, throttleMs: 100 });
    } else if (pending) {
      localPose.pendingImpulse = null;
    }
    const launch = active ? (rulesRef.current.consumeLaunch?.() ?? 0) : 0;
    if (launch > 0) {
      vy = launch;
      grounded.current = false;
      sound.play("jump", { volume: 0.9 });
      burst({ position: { x: t.x, y: t.y - PLAYER_HEIGHT / 2, z: t.z }, color: ["#ffd32a", "#ffffff"], count: 14, speed: 3, life: 0.5, size: 0.14 });
    }
    rb.setLinvel({ x: vx, y: vy, z: vz }, true);

    if (len > 0.1) anim.yaw = Math.atan2(mx, mz);

    const r = rulesRef.current;
    r.onStep?.(t.x, t.y - PLAYER_HEIGHT / 2, t.z, grounded.current);

    // Fell off
    const fallY = r.fallYAt ? r.fallYAt() : r.fallY;
    if (t.y < fallY && active) {
      if (r.onFall === "respawn" && r.respawnAt) {
        r.onRespawn?.();
        const [x, y, z] = r.respawnAt();
        rb.setTranslation({ x, y, z }, true);
        rb.setLinvel({ x: 0, y: 0, z: 0 }, true);
        anim.yaw = 0;
        burst({ position: { x, y: y - 0.5, z }, color: ["#ffffff", colorHex], count: 14, speed: 3, life: 0.5, size: 0.14 });
        shake(0.3);
        sound.play("elimination", { volume: 0.5 });
      } else if (!fellReported.current) {
        fellReported.current = true;
        useGameStore.getState().reportFall();
      }
    } else if (!active && t.y < fallY - 4) {
      // Lobby / results playground: walked off the edge — back to the spawn point
      // instead of falling forever until the next round.
      rb.setTranslation({ x: spawn[0], y: spawn[1], z: spawn[2] }, true);
      rb.setLinvel({ x: 0, y: 0, z: 0 }, true);
    }
  });

  useFrame(() => {
    const rb = body.current;
    if (!rb) return;
    const anim = animRef.current;
    const t = rb.translation();
    const v = rb.linvel();
    localPose.position.x = t.x;
    localPose.position.y = t.y - PLAYER_HEIGHT / 2;
    localPose.position.z = t.z;
    localPose.velocity.x = v.x;
    localPose.velocity.y = v.y;
    localPose.velocity.z = v.z;
    localPose.yaw = anim.yaw;
    localPose.grounded = grounded.current;
    livePoses.set(id, localPose.position);
    anim.speed = Math.hypot(v.x, v.z);
    anim.grounded = grounded.current;
    anim.vy = v.y;
    emitTrail(cosmetics.trail, localPose.position, anim.speed, grounded.current, lastTrail);

    // Reliability: if the host never acknowledged our fall / finish (lost event,
    // host handover), re-send it until the shared state reflects it.
    const store = useGameStore.getState();
    if (store.state.status === "PLAYING") {
      const now = performance.now();
      if (now - lastReportRetry.current > 1500) {
        const r = rulesRef.current;
        if (fellReported.current && r.onFall === "eliminate" && store.state.alive.includes(id)) {
          lastReportRetry.current = now;
          store.reportFall();
        } else if ((partyRuntime.finished || raceRuntime.finished || gogunRuntime.finished) && !store.state.finishOrder.includes(id)) {
          lastReportRetry.current = now;
          store.reportFinish();
        }
      }
    }

    useGameStore.getState().client?.sendSnapshot(() => ({
      p: [round(t.x), round(t.y - PLAYER_HEIGHT / 2), round(t.z)],
      r: round(anim.yaw),
      v: [round(v.x), round(v.y), round(v.z)],
      g: grounded.current,
    }));
  });

  const onCollisionEnter = (payload: CollisionPayload) => {
    const rb = body.current;
    const other = payload.other.rigidBody;
    if (!rb || !other) return;
    const anim = animRef.current;
    const data = (other.userData ?? {}) as BodyUserData;
    const me = rb.translation();
    const them = other.translation();
    const myVel = rb.linvel();
    const now = performance.now();

    if (data.type === "player") {
      if (data.id) rulesRef.current.onContact?.(data.id);
      tmpDir.set(me.x - them.x, 0, me.z - them.z);
      if (tmpDir.lengthSq() < 1e-4) tmpDir.set(Math.random() - 0.5, 0, Math.random() - 0.5);
      tmpDir.normalize();
      const otherVel = other.linvel();
      tmpVel.set(myVel.x - otherVel.x, 0, myVel.z - otherVel.z);
      const relative = tmpVel.length();
      const dashing = now < localPose.dashUntil;
      let strength = THREE.MathUtils.clamp(PUSH_IMPULSE + relative * PUSH_RELATIVE_FACTOR, PUSH_IMPULSE * 0.6, PUSH_IMPULSE_MAX) * PLAYER_MASS;
      if (!grounded.current) strength *= AIR_HIT_MULTIPLIER;
      if (dashing) strength *= DASH_SELF_KNOCKBACK; // attacker barely recoils
      const otherIsBoss = useGameStore.getState().state.bossId === data.id;
      if (otherIsBoss) strength *= BOSS_HIT_MULTIPLIER;
      if (boss) strength *= BOSS_KNOCKBACK_RESIST * (BOSS_MASS / PLAYER_MASS); // heavier: impulse scaled to mass, then resisted
      rb.applyImpulse({ x: tmpDir.x * strength, y: PUSH_UPWARD * strength, z: tmpDir.z * strength }, true);
      // Hard hits stun: control lost briefly so the shove really lands.
      if (!dashing && strength >= PUSH_IMPULSE * 1.6) {
        localPose.stunUntil = now + HIT_STUN_MS;
        anim.stunUntil = localPose.stunUntil;
      }
      anim.hitAt = now;
      localPose.lastImpactAt = now;
      const mid = { x: (me.x + them.x) / 2, y: me.y, z: (me.z + them.z) / 2 };
      burst({ position: mid, color: ["#ffffff", "#ffd32a", colorHex], count: 10, speed: 3, life: 0.45, size: 0.14 });
      shake(0.25 + Math.min(0.35, relative * 0.04));
      sound.play("impact", { volume: 0.7, throttleMs: 80 });
    } else if (data.type === "spinner") {
      // Tangential shove in the bar's direction of travel.
      tmpDir.set(me.z, 0, -me.x);
      if (tmpDir.lengthSq() < 1e-4) tmpDir.set(1, 0, 0);
      tmpDir.normalize();
      // Push slightly outward too, so it feels like being swept off.
      tmpVel.set(me.x, 0, me.z).normalize().multiplyScalar(0.35);
      tmpDir.add(tmpVel).normalize();
      rb.applyImpulse({ x: tmpDir.x * OBSTACLE_PUSH_IMPULSE, y: 2.2, z: tmpDir.z * OBSTACLE_PUSH_IMPULSE }, true);
      localPose.stunUntil = now + OBSTACLE_STUN_MS;
      anim.stunUntil = localPose.stunUntil;
      anim.hitAt = now;
      burst({ position: { x: me.x, y: me.y, z: me.z }, color: ["#ff5a3c", "#ffffff"], count: 12, speed: 3.5, life: 0.5, size: 0.14 });
      shake(0.45);
      sound.play("impact", { volume: 0.9, throttleMs: 120 });
    } else if (data.type === "wall") {
      // Push away from the wall's centre, horizontally.
      tmpDir.set(me.x - them.x, 0, me.z - them.z);
      if (tmpDir.lengthSq() < 1e-4) tmpDir.set(0, 0, 1);
      tmpDir.normalize();
      rb.applyImpulse({ x: tmpDir.x * OBSTACLE_PUSH_IMPULSE * 0.8, y: 1.5, z: tmpDir.z * OBSTACLE_PUSH_IMPULSE * 0.8 }, true);
      localPose.stunUntil = now + OBSTACLE_STUN_MS;
      anim.stunUntil = localPose.stunUntil;
      anim.hitAt = now;
      burst({ position: { x: me.x, y: me.y, z: me.z }, color: ["#3d8bff", "#ffffff"], count: 10, speed: 3, life: 0.45, size: 0.14 });
      shake(0.35);
      sound.play("impact", { volume: 0.8, throttleMs: 120 });
    }
  };

  return (
    <RigidBody
      ref={body}
      type="dynamic"
      colliders={false}
      position={spawn}
      mass={boss ? BOSS_MASS : PLAYER_MASS}
      linearDamping={PLAYER_LINEAR_DAMPING}
      angularDamping={1}
      enabledRotations={[false, false, false]}
      ccd
      canSleep={false}
      userData={userData}
      onCollisionEnter={onCollisionEnter}
    >
      <CapsuleCollider args={[halfHeight, radius]} friction={0.2} restitution={0.15} />
      <group position={[0, (-PLAYER_HEIGHT / 2) * scale, 0]}>
        <Character colorHex={colorHex} nickname={nickname} animRef={animRef} isLocal showLabel={showLabel} cosmetics={cosmetics} scale={scale} />
      </group>
    </RigidBody>
  );
}

/** Running trail particles for equipped trail cosmetics (throttled). */
export function emitTrail(trail: string, p: { x: number; y: number; z: number }, speed: number, grounded: boolean, last: { current: number }) {
  const colors = TRAIL_COLORS[trail];
  if (!colors || !grounded || speed < 2.5) return;
  const now = performance.now();
  if (now - last.current < 70) return;
  last.current = now;
  burst({ position: { x: p.x, y: p.y + 0.15, z: p.z }, color: colors, count: 2, speed: 1.2, life: 0.55, size: 0.11, gravity: trail === "fire" ? -3 : 1.5, spread: 0.6 });
}

function round(n: number): number {
  return Math.round(n * 100) / 100;
}
