"use client";

import { Html } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useMemo, useRef, type RefObject } from "react";
import * as THREE from "three";
import { DEFAULT_COSMETICS, type Cosmetics } from "@/game/items";

/** Mutable animation input written by the owning controller every frame. */
export interface CharacterAnim {
  yaw: number;
  /** horizontal speed m/s */
  speed: number;
  grounded: boolean;
  vy: number;
  /** performance.now() of the last landing, for squash */
  landedAt: number;
  /** performance.now() of the last hit, for a flinch */
  hitAt: number;
  /** performance.now() until which the character is stunned (spins) */
  stunUntil: number;
  /** performance.now() until which the character is dashing (leans) */
  dashUntil: number;
  /** performance.now() of the last jump take-off (stretch) */
  jumpedAt: number;
  /** performance.now() until which the character celebrates (winner dance) */
  celebrateUntil: number;
}

export function createAnim(): CharacterAnim {
  return { yaw: 0, speed: 0, grounded: true, vy: 0, landedAt: 0, hitAt: 0, stunUntil: 0, dashUntil: 0, jumpedAt: 0, celebrateUntil: 0 };
}

interface Props {
  colorHex: string;
  nickname: string;
  animRef: RefObject<CharacterAnim>;
  isLocal?: boolean;
  showLabel?: boolean;
  cosmetics?: Cosmetics;
  /** uniform scale (the BOSS is bigger) */
  scale?: number;
}

// ── ZUN palette ──────────────────────────────────────────────────────
const CAP = "#1d2a5c";
const CAP_DARK = "#141d42";
const HAIR = "#15161f";
const SKIN = "#ffe3c4";
const BLUSH = "#ffb3b3";
const PANTS = "#1a1b26";
const SHOE = "#f5f5f5";
const SHOE_ACCENT = "#2f6fd6";
const STRING = "#f2f2f2";

const CAP_COLORS: Record<string, [string, string]> = {
  cap_zun: [CAP, CAP_DARK],
  cap_red: ["#d63447", "#a8283a"],
  cap_gold: ["#e6b422", "#b48a12"],
};

function shade(hex: string, amount: number): string {
  const c = new THREE.Color(hex);
  const hsl = { h: 0, s: 0, l: 0 };
  c.getHSL(hsl);
  c.setHSL(hsl.h, Math.min(1, hsl.s * 1.05), THREE.MathUtils.clamp(hsl.l + amount, 0, 1));
  return `#${c.getHexString()}`;
}

const zunLabels = new Map<string, THREE.CanvasTexture>();
/** "ZUN" cap logo, drawn once per cap colour into a canvas texture. */
function getZunLabel(bg: string): THREE.CanvasTexture {
  const cached = zunLabels.get(bg);
  if (cached) return cached;
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 96;
  const ctx = canvas.getContext("2d");
  if (ctx) {
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, 256, 96);
    ctx.fillStyle = "#ffffff";
    ctx.font = "900 62px system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("ZUN", 128, 52);
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  zunLabels.set(bg, tex);
  return tex;
}

/**
 * ZUN-style chibi: navy "ZUN" cap, black hair, hoodie in the player colour,
 * black pants, white sneakers. `cosmetics` picks the hat / face / back items
 * from the shop so every player reads as a different ZUN.
 * Feet at y=0, cap top ≈ 1.55 (fits the 1.5 m capsule).
 */
export function Character({ colorHex, nickname, animRef, isLocal = false, showLabel = true, cosmetics = DEFAULT_COSMETICS, scale = 1 }: Props) {
  const root = useRef<THREE.Group>(null);
  const body = useRef<THREE.Group>(null);
  const head = useRef<THREE.Group>(null);
  const armL = useRef<THREE.Group>(null);
  const armR = useRef<THREE.Group>(null);
  const legL = useRef<THREE.Group>(null);
  const legR = useRef<THREE.Group>(null);
  const phase = useRef(-1);
  const spin = useRef(0);

  const colors = useMemo(
    () => ({
      hoodie: colorHex,
      hoodieDark: shade(colorHex, -0.12),
      hoodieLight: shade(colorHex, 0.1),
    }),
    [colorHex],
  );
  const capColors = CAP_COLORS[cosmetics.hat] ?? CAP_COLORS.cap_zun;
  const label = useMemo(() => getZunLabel(capColors[0]), [capColors]);
  const cape = useRef<THREE.Mesh>(null);
  const halo = useRef<THREE.Mesh>(null);
  const flames = useRef<THREE.Group>(null);

  useFrame((_, dt) => {
    const g = root.current;
    const anim = animRef.current;
    if (!g || !anim) return;
    if (phase.current < 0) phase.current = Math.random() * Math.PI * 2;
    const now = performance.now();
    const stunned = now < anim.stunUntil;
    const dashing = now < anim.dashUntil;
    const celebrating = now < anim.celebrateUntil;
    if (stunned) spin.current += dt * 14;
    else if (celebrating) spin.current += dt * 5;
    else spin.current = THREE.MathUtils.lerp(spin.current, Math.round(spin.current / (Math.PI * 2)) * Math.PI * 2, dt * 12);
    g.rotation.y = anim.yaw + spin.current;

    const moving = anim.speed > 0.4;
    const target = moving ? Math.min(1, anim.speed / 7) : 0;
    phase.current += dt * (6 + anim.speed * 1.4) * (moving || !anim.grounded ? 1 : 0.5);
    const swing = Math.sin(phase.current) * 0.9 * target;

    const sinceLand = (now - anim.landedAt) / 1000;
    const sinceJump = (now - anim.jumpedAt) / 1000;
    // Landing squashes, take-off stretches (negative squash = taller and thinner).
    const stretch = sinceJump < 0.22 ? Math.sin((sinceJump / 0.22) * Math.PI) * 0.14 : 0;
    const squash = (sinceLand < 0.25 ? Math.sin((sinceLand / 0.25) * Math.PI) * 0.18 : 0) - stretch;
    const sinceHit = (now - anim.hitAt) / 1000;
    const flinch = sinceHit < 0.3 ? Math.sin((sinceHit / 0.3) * Math.PI) * 0.35 : 0;

    if (celebrating) {
      // winner dance: arms up, pumping
      const pump = Math.sin(now * 0.012);
      if (armL.current) armL.current.rotation.x = -2.6 + pump * 0.4;
      if (armR.current) armR.current.rotation.x = -2.6 - pump * 0.4;
      if (armL.current) armL.current.rotation.z = 0.6;
      if (armR.current) armR.current.rotation.z = -0.6;
      if (legL.current) legL.current.rotation.x = pump * 0.5;
      if (legR.current) legR.current.rotation.x = -pump * 0.5;
    } else if (anim.grounded) {
      if (legL.current) legL.current.rotation.x = swing;
      if (legR.current) legR.current.rotation.x = -swing;
      if (armL.current) armL.current.rotation.x = -swing * 0.8;
      if (armR.current) armR.current.rotation.x = swing * 0.8;
      if (armL.current) armL.current.rotation.z = THREE.MathUtils.lerp(armL.current.rotation.z, 0.1, dt * 10);
      if (armR.current) armR.current.rotation.z = THREE.MathUtils.lerp(armR.current.rotation.z, -0.1, dt * 10);
    } else {
      const up = THREE.MathUtils.clamp(anim.vy / 8, -1, 1);
      if (legL.current) legL.current.rotation.x = THREE.MathUtils.lerp(legL.current.rotation.x, 0.5, dt * 10);
      if (legR.current) legR.current.rotation.x = THREE.MathUtils.lerp(legR.current.rotation.x, -0.3, dt * 10);
      if (armL.current) armL.current.rotation.x = THREE.MathUtils.lerp(armL.current.rotation.x, -2.4 + up * 0.4, dt * 10);
      if (armR.current) armR.current.rotation.x = THREE.MathUtils.lerp(armR.current.rotation.x, -2.4 - up * 0.4, dt * 10);
      if (armL.current) armL.current.rotation.z = 0.4;
      if (armR.current) armR.current.rotation.z = -0.4;
    }

    if (body.current) {
      const bob = celebrating ? Math.abs(Math.sin(now * 0.012)) * 0.35 : anim.grounded ? Math.abs(Math.sin(phase.current)) * 0.05 * target : 0;
      body.current.position.y = bob - squash * 0.5;
      body.current.scale.set(1 + squash * 0.6, 1 - squash, 1 + squash * 0.6);
      body.current.rotation.x = THREE.MathUtils.lerp(body.current.rotation.x, target * 0.14 - flinch * 0.6 + (dashing ? 0.55 : 0) + (stunned ? -0.5 : 0), dt * (dashing ? 20 : 8));
    }
    if (head.current) {
      head.current.rotation.z = Math.sin(phase.current * 0.5) * 0.06 * target;
      head.current.rotation.x = -flinch * 0.4 + (anim.grounded ? 0 : -0.15);
    }
    // cosmetic idle motion
    if (cape.current) cape.current.rotation.x = 0.25 + target * 0.9 + Math.sin(phase.current * 0.8) * 0.08 + (anim.grounded ? 0 : 0.6);
    if (halo.current) halo.current.position.y = 0.78 + Math.sin(now * 0.003) * 0.04;
    if (flames.current) flames.current.scale.y = 0.8 + Math.random() * 0.4;
  });

  return (
    <group ref={root} scale={scale}>
      <group ref={body}>
        {/* ── hoodie torso ── */}
        <mesh castShadow receiveShadow position={[0, 0.56, 0]}>
          <boxGeometry args={[0.6, 0.5, 0.4]} />
          <meshStandardMaterial color={colors.hoodie} roughness={0.7} flatShading />
        </mesh>
        {/* kangaroo pocket */}
        <mesh position={[0, 0.42, 0.205]}>
          <boxGeometry args={[0.36, 0.16, 0.02]} />
          <meshStandardMaterial color={colors.hoodieDark} roughness={0.8} />
        </mesh>
        {/* hood collar */}
        <mesh position={[0, 0.8, -0.06]}>
          <boxGeometry args={[0.5, 0.12, 0.34]} />
          <meshStandardMaterial color={colors.hoodieDark} roughness={0.8} flatShading />
        </mesh>
        {/* drawstrings */}
        {[-0.07, 0.07].map((x) => (
          <mesh key={x} position={[x, 0.66, 0.21]}>
            <boxGeometry args={[0.025, 0.2, 0.02]} />
            <meshStandardMaterial color={STRING} roughness={0.9} />
          </mesh>
        ))}

        {/* ── head (chibi: big) ── */}
        <group ref={head} position={[0, 1.08, 0]}>
          <mesh castShadow position={[0, 0, 0]}>
            <boxGeometry args={[0.68, 0.56, 0.62]} />
            <meshStandardMaterial color={SKIN} roughness={0.6} />
          </mesh>
          {/* hair: back + sides + fringe */}
          <mesh position={[0, 0.06, -0.06]}>
            <boxGeometry args={[0.72, 0.5, 0.56]} />
            <meshStandardMaterial color={HAIR} roughness={0.85} flatShading />
          </mesh>
          <mesh position={[0, 0.16, 0.24]}>
            <boxGeometry args={[0.7, 0.22, 0.2]} />
            <meshStandardMaterial color={HAIR} roughness={0.85} flatShading />
          </mesh>
          {[-0.22, 0.22].map((x) => (
            <mesh key={x} position={[x, 0.02, 0.22]}>
              <boxGeometry args={[0.16, 0.24, 0.18]} />
              <meshStandardMaterial color={HAIR} roughness={0.85} flatShading />
            </mesh>
          ))}
          {/* face plate in front of the hair */}
          <mesh position={[0, -0.08, 0.27]}>
            <boxGeometry args={[0.56, 0.36, 0.1]} />
            <meshStandardMaterial color={SKIN} roughness={0.6} />
          </mesh>
          {/* eyes */}
          {[-0.13, 0.13].map((x) => (
            <mesh key={x} position={[x, -0.06, 0.325]}>
              <boxGeometry args={[0.09, 0.13, 0.02]} />
              <meshStandardMaterial color="#15161f" roughness={0.3} />
            </mesh>
          ))}
          {[-0.115, 0.145].map((x) => (
            <mesh key={x} position={[x, -0.03, 0.34]}>
              <boxGeometry args={[0.03, 0.04, 0.01]} />
              <meshStandardMaterial color="#ffffff" />
            </mesh>
          ))}
          {/* blush + mouth */}
          {[-0.24, 0.24].map((x) => (
            <mesh key={x} position={[x, -0.15, 0.325]}>
              <boxGeometry args={[0.08, 0.04, 0.01]} />
              <meshStandardMaterial color={BLUSH} roughness={0.9} />
            </mesh>
          ))}
          <mesh position={[0.02, -0.2, 0.325]}>
            <boxGeometry args={[0.07, 0.025, 0.01]} />
            <meshStandardMaterial color="#8a4b4b" roughness={0.9} />
          </mesh>

          {/* ── hat slot ── */}
          {(cosmetics.hat === "cap_zun" || cosmetics.hat === "cap_red" || cosmetics.hat === "cap_gold" || cosmetics.hat === "cat_ears") && (
            <group>
              <mesh castShadow position={[0, 0.34, -0.02]}>
                <boxGeometry args={[0.76, 0.2, 0.7]} />
                <meshStandardMaterial color={capColors[0]} roughness={0.75} flatShading />
              </mesh>
              <mesh position={[0, 0.46, -0.02]}>
                <boxGeometry args={[0.62, 0.08, 0.56]} />
                <meshStandardMaterial color={capColors[0]} roughness={0.75} flatShading />
              </mesh>
              <mesh castShadow position={[0, 0.27, 0.42]}>
                <boxGeometry args={[0.64, 0.05, 0.34]} />
                <meshStandardMaterial color={capColors[1]} roughness={0.7} />
              </mesh>
              <mesh position={[0, 0.35, 0.336]}>
                <planeGeometry args={[0.42, 0.15]} />
                <meshStandardMaterial map={label} roughness={0.7} />
              </mesh>
              <mesh position={[0, 0.52, -0.02]}>
                <sphereGeometry args={[0.05, 6, 5]} />
                <meshStandardMaterial color={capColors[1]} />
              </mesh>
              {cosmetics.hat === "cat_ears" &&
                [-0.24, 0.24].map((x) => (
                  <group key={x} position={[x, 0.58, -0.02]} rotation={[0, 0, x < 0 ? 0.25 : -0.25]}>
                    <mesh castShadow>
                      <coneGeometry args={[0.13, 0.28, 4]} />
                      <meshStandardMaterial color={CAP} roughness={0.8} flatShading />
                    </mesh>
                    <mesh position={[0, -0.02, 0.03]}>
                      <coneGeometry args={[0.07, 0.16, 4]} />
                      <meshStandardMaterial color="#ff9ad5" roughness={0.8} />
                    </mesh>
                  </group>
                ))}
            </group>
          )}
          {cosmetics.hat === "beanie" && (
            <group>
              <mesh castShadow position={[0, 0.36, -0.02]}>
                <boxGeometry args={[0.76, 0.26, 0.7]} />
                <meshStandardMaterial color="#ff5a3c" roughness={0.95} flatShading />
              </mesh>
              <mesh position={[0, 0.5, -0.02]}>
                <boxGeometry args={[0.6, 0.14, 0.54]} />
                <meshStandardMaterial color="#ff5a3c" roughness={0.95} flatShading />
              </mesh>
              <mesh position={[0, 0.3, -0.02]}>
                <boxGeometry args={[0.8, 0.12, 0.74]} />
                <meshStandardMaterial color="#fff3d6" roughness={0.95} />
              </mesh>
              <mesh position={[0, 0.62, -0.02]}>
                <sphereGeometry args={[0.1, 8, 6]} />
                <meshStandardMaterial color="#fff3d6" roughness={0.95} />
              </mesh>
            </group>
          )}
          {cosmetics.hat === "party" && (
            <group position={[0.08, 0.5, 0]} rotation={[0, 0, -0.15]}>
              <mesh castShadow position={[0, 0.25, 0]}>
                <coneGeometry args={[0.2, 0.55, 12]} />
                <meshStandardMaterial color="#a55eea" roughness={0.6} />
              </mesh>
              {[0.08, 0.28].map((y) => (
                <mesh key={y} position={[0, y, 0]}>
                  <cylinderGeometry args={[0.2 - y * 0.34, 0.2 - (y - 0.04) * 0.34, 0.05, 12]} />
                  <meshStandardMaterial color="#ffd32a" roughness={0.6} />
                </mesh>
              ))}
              <mesh position={[0, 0.54, 0]}>
                <sphereGeometry args={[0.06, 6, 5]} />
                <meshStandardMaterial color="#ff6bcb" />
              </mesh>
            </group>
          )}
          {cosmetics.hat === "halo" && (
            <mesh ref={halo} position={[0, 0.78, 0]} rotation={[Math.PI / 2, 0, 0]}>
              <torusGeometry args={[0.28, 0.05, 8, 24]} />
              <meshStandardMaterial color="#ffe066" emissive="#ffd32a" emissiveIntensity={0.9} roughness={0.3} />
            </mesh>
          )}
          {cosmetics.hat === "crown" && (
            <group position={[0, 0.34, -0.02]}>
              <mesh castShadow position={[0, 0.06, 0]}>
                <cylinderGeometry args={[0.34, 0.36, 0.22, 8]} />
                <meshStandardMaterial color="#e6b422" roughness={0.35} metalness={0.5} flatShading />
              </mesh>
              {[0, 1, 2, 3, 4].map((i) => {
                const a = (i / 5) * Math.PI * 2;
                return (
                  <mesh key={i} position={[Math.cos(a) * 0.3, 0.26, Math.sin(a) * 0.3]}>
                    <coneGeometry args={[0.07, 0.2, 4]} />
                    <meshStandardMaterial color="#e6b422" roughness={0.35} metalness={0.5} flatShading />
                  </mesh>
                );
              })}
              <mesh position={[0, 0.06, 0.36]}>
                <sphereGeometry args={[0.06, 6, 5]} />
                <meshStandardMaterial color="#ff4757" roughness={0.3} />
              </mesh>
            </group>
          )}

          {/* ── face slot ── */}
          {cosmetics.face === "sunglasses" && (
            <mesh position={[0, -0.05, 0.345]}>
              <boxGeometry args={[0.5, 0.12, 0.03]} />
              <meshStandardMaterial color="#0b0c14" roughness={0.2} metalness={0.4} />
            </mesh>
          )}
          {cosmetics.face === "visor" && (
            <mesh position={[0, -0.05, 0.35]}>
              <boxGeometry args={[0.58, 0.16, 0.04]} />
              <meshStandardMaterial color="#18dcff" emissive="#18dcff" emissiveIntensity={0.5} transparent opacity={0.75} roughness={0.2} />
            </mesh>
          )}
          {cosmetics.face === "glasses" && (
            <group position={[0, -0.05, 0.345]}>
              {[-0.13, 0.13].map((x) => (
                <mesh key={x} position={[x, 0, 0]}>
                  <torusGeometry args={[0.085, 0.018, 6, 16]} />
                  <meshStandardMaterial color="#2b2d42" roughness={0.4} />
                </mesh>
              ))}
              <mesh>
                <boxGeometry args={[0.08, 0.02, 0.02]} />
                <meshStandardMaterial color="#2b2d42" />
              </mesh>
            </group>
          )}
          {cosmetics.face === "headphones" && (
            <group>
              {[-0.37, 0.37].map((x) => (
                <mesh key={x} position={[x, -0.04, 0]} rotation={[0, 0, Math.PI / 2]}>
                  <cylinderGeometry args={[0.13, 0.13, 0.08, 10]} />
                  <meshStandardMaterial color="#2b3a7a" roughness={0.5} metalness={0.2} />
                </mesh>
              ))}
              <mesh position={[0, 0.3, 0]}>
                <boxGeometry args={[0.82, 0.06, 0.1]} />
                <meshStandardMaterial color="#2b3a7a" roughness={0.5} />
              </mesh>
            </group>
          )}
        </group>

        {/* ── arms (hoodie sleeves + hands) ── */}
        {[-1, 1].map((s) => (
          <group key={s} ref={s < 0 ? armL : armR} position={[s * 0.38, 0.74, 0]}>
            <mesh castShadow position={[0, -0.2, 0]}>
              <boxGeometry args={[0.16, 0.4, 0.16]} />
              <meshStandardMaterial color={colors.hoodie} roughness={0.7} flatShading />
            </mesh>
            <mesh position={[0, -0.44, 0]}>
              <boxGeometry args={[0.15, 0.1, 0.15]} />
              <meshStandardMaterial color={SKIN} roughness={0.6} />
            </mesh>
          </group>
        ))}

        {/* ── back / neck slot ── */}
        {cosmetics.back === "backpack" && (
          <group position={[0, 0.58, -0.28]}>
            <mesh castShadow>
              <boxGeometry args={[0.42, 0.4, 0.18]} />
              <meshStandardMaterial color="#5b4636" roughness={0.9} flatShading />
            </mesh>
            <mesh position={[0, 0.1, -0.1]}>
              <boxGeometry args={[0.3, 0.16, 0.04]} />
              <meshStandardMaterial color="#8a6a52" roughness={0.9} />
            </mesh>
          </group>
        )}
        {cosmetics.back === "scarf" && (
          <group>
            <mesh position={[0, 0.82, 0.04]}>
              <boxGeometry args={[0.66, 0.14, 0.5]} />
              <meshStandardMaterial color="#ff4757" roughness={0.95} flatShading />
            </mesh>
            <mesh position={[0.12, 0.6, -0.3]} rotation={[0.2, 0, 0.1]}>
              <boxGeometry args={[0.14, 0.42, 0.05]} />
              <meshStandardMaterial color="#ff4757" roughness={0.95} />
            </mesh>
          </group>
        )}
        {cosmetics.back === "cape" && (
          <group position={[0, 0.82, -0.2]}>
            <mesh ref={cape} castShadow position={[0, 0, 0]} rotation={[0.25, 0, 0]}>
              <boxGeometry args={[0.66, 0.05, 0.05]} />
              <meshStandardMaterial color={colors.hoodieDark} />
              <mesh position={[0, -0.45, 0]}>
                <boxGeometry args={[0.7, 0.9, 0.04]} />
                <meshStandardMaterial color="#ff4757" roughness={0.9} side={THREE.DoubleSide} />
              </mesh>
            </mesh>
          </group>
        )}
        {cosmetics.back === "jetpack" && (
          <group position={[0, 0.55, -0.3]}>
            {[-0.13, 0.13].map((x) => (
              <mesh key={x} castShadow position={[x, 0, 0]}>
                <cylinderGeometry args={[0.1, 0.12, 0.5, 10]} />
                <meshStandardMaterial color="#c9c9c9" roughness={0.3} metalness={0.7} />
              </mesh>
            ))}
            <group ref={flames} position={[0, -0.28, 0]}>
              {[-0.13, 0.13].map((x) => (
                <mesh key={x} position={[x, -0.12, 0]} rotation={[Math.PI, 0, 0]}>
                  <coneGeometry args={[0.08, 0.28, 8]} />
                  <meshStandardMaterial color="#ffb020" emissive="#ff5a3c" emissiveIntensity={1.2} />
                </mesh>
              ))}
            </group>
          </group>
        )}
        {cosmetics.back === "wings" && (
          <group position={[0, 0.72, -0.24]}>
            {[-1, 1].map((s) => (
              <group key={s} rotation={[0, s * 0.5, s * 0.35]}>
                <mesh castShadow position={[s * 0.35, 0.05, 0]}>
                  <boxGeometry args={[0.6, 0.28, 0.04]} />
                  <meshStandardMaterial color="#ffffff" roughness={0.8} />
                </mesh>
                <mesh position={[s * 0.5, -0.12, 0]}>
                  <boxGeometry args={[0.4, 0.18, 0.04]} />
                  <meshStandardMaterial color="#e8f1ff" roughness={0.8} />
                </mesh>
              </group>
            ))}
          </group>
        )}
      </group>

      {/* ── legs: pants + sneakers ── */}
      {[-1, 1].map((s) => (
        <group key={s} ref={s < 0 ? legL : legR} position={[s * 0.14, 0.34, 0]}>
          <mesh castShadow position={[0, -0.14, 0]}>
            <boxGeometry args={[0.18, 0.3, 0.2]} />
            <meshStandardMaterial color={PANTS} roughness={0.8} flatShading />
          </mesh>
          <mesh position={[0, -0.3, 0.04]}>
            <boxGeometry args={[0.2, 0.1, 0.3]} />
            <meshStandardMaterial color={SHOE} roughness={0.6} />
          </mesh>
          <mesh position={[0, -0.3, 0.14]}>
            <boxGeometry args={[0.21, 0.06, 0.1]} />
            <meshStandardMaterial color={SHOE_ACCENT} roughness={0.6} />
          </mesh>
        </group>
      ))}

      {showLabel && (
        <Html position={[0, 1.95, 0]} center distanceFactor={14 * scale} zIndexRange={[1, 0]} style={{ pointerEvents: "none" }}>
          <div
            className={`whitespace-nowrap rounded-full px-2.5 py-0.5 text-[13px] font-bold tracking-wide shadow-lg backdrop-blur-sm ${
              isLocal ? "bg-white/90 text-slate-900" : "bg-slate-900/70 text-white"
            }`}
            style={{ borderBottom: `3px solid ${colorHex}` }}
          >
            {nickname}
          </div>
        </Html>
      )}
    </group>
  );
}
