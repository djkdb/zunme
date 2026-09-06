"use client";

import { useFrame } from "@react-three/fiber";
import { useEffect, useRef } from "react";
import * as THREE from "three";
import { particleScale } from "@/game/quality";
import { burstEvents, type BurstRequest } from "@/game/effects";

const tmpObj = new THREE.Object3D();
const tmpColor = new THREE.Color();

interface Pool {
  max: number;
  pos: Float32Array;
  vel: Float32Array;
  life: Float32Array;
  maxLife: Float32Array;
  size: Float32Array;
  gravity: Float32Array;
  spin: Float32Array;
  alive: number;
}

function createPool(max: number): Pool {
  return {
    max,
    pos: new Float32Array(max * 3),
    vel: new Float32Array(max * 3),
    life: new Float32Array(max),
    maxLife: new Float32Array(max),
    size: new Float32Array(max),
    gravity: new Float32Array(max),
    spin: new Float32Array(max),
    alive: 0,
  };
}

/**
 * One pooled InstancedMesh for every burst in the game (impacts, tile
 * crumbles, elimination explosions, confetti). No allocations at runtime.
 */
export function Particles({ max = 600 }: { max?: number }) {
  const mesh = useRef<THREE.InstancedMesh>(null);
  const poolRef = useRef<Pool | null>(null);
  const getPool = (): Pool => {
    if (!poolRef.current || poolRef.current.max !== max) poolRef.current = createPool(max);
    return poolRef.current;
  };

  useEffect(() => {
    const spawn = (req: BurstRequest) => {
      const m = mesh.current;
      if (!m) return;
      const pool = getPool();
      const colors = Array.isArray(req.color) ? req.color : [req.color];
      const count = Math.max(1, Math.round(req.count * particleScale()));
      for (let n = 0; n < count; n++) {
        if (pool.alive >= max) break;
        const i = pool.alive++;
        const spread = req.spread ?? 1;
        // random direction, biased upward
        const theta = Math.random() * Math.PI * 2;
        const phi = Math.acos(1 - Math.random() * (1 + spread)) - Math.PI / 4;
        const speed = req.speed * (0.4 + Math.random() * 0.9);
        pool.pos[i * 3] = req.position.x + (Math.random() - 0.5) * 0.4;
        pool.pos[i * 3 + 1] = req.position.y + Math.random() * 0.4;
        pool.pos[i * 3 + 2] = req.position.z + (Math.random() - 0.5) * 0.4;
        pool.vel[i * 3] = Math.cos(theta) * Math.cos(phi) * speed;
        pool.vel[i * 3 + 1] = Math.abs(Math.sin(phi)) * speed + speed * 0.3;
        pool.vel[i * 3 + 2] = Math.sin(theta) * Math.cos(phi) * speed;
        pool.life[i] = req.life * (0.6 + Math.random() * 0.6);
        pool.maxLife[i] = pool.life[i];
        pool.size[i] = (req.size ?? 0.18) * (0.6 + Math.random() * 0.8);
        pool.gravity[i] = req.gravity ?? 9;
        pool.spin[i] = (Math.random() - 0.5) * 12;
        tmpColor.set(colors[Math.floor(Math.random() * colors.length)]);
        m.setColorAt(i, tmpColor);
      }
      if (m.instanceColor) m.instanceColor.needsUpdate = true;
    };
    return burstEvents.on(spawn);
  });

  useFrame((_, dt) => {
    const m = mesh.current;
    if (!m) return;
    const pool = getPool();
    const step = Math.min(dt, 0.05);
    let i = 0;
    while (i < pool.alive) {
      pool.life[i] -= step;
      if (pool.life[i] <= 0) {
        // swap with last
        const last = pool.alive - 1;
        if (i !== last) {
          for (let k = 0; k < 3; k++) {
            pool.pos[i * 3 + k] = pool.pos[last * 3 + k];
            pool.vel[i * 3 + k] = pool.vel[last * 3 + k];
          }
          pool.life[i] = pool.life[last];
          pool.maxLife[i] = pool.maxLife[last];
          pool.size[i] = pool.size[last];
          pool.gravity[i] = pool.gravity[last];
          pool.spin[i] = pool.spin[last];
          if (m.instanceColor) {
            m.getColorAt(last, tmpColor);
            m.setColorAt(i, tmpColor);
          }
        }
        pool.alive--;
        continue;
      }
      pool.vel[i * 3 + 1] -= pool.gravity[i] * step;
      pool.vel[i * 3] *= 1 - step * 0.8;
      pool.vel[i * 3 + 2] *= 1 - step * 0.8;
      pool.pos[i * 3] += pool.vel[i * 3] * step;
      pool.pos[i * 3 + 1] += pool.vel[i * 3 + 1] * step;
      pool.pos[i * 3 + 2] += pool.vel[i * 3 + 2] * step;
      const t = pool.life[i] / pool.maxLife[i];
      const s = pool.size[i] * (t < 0.3 ? t / 0.3 : 1);
      tmpObj.position.set(pool.pos[i * 3], pool.pos[i * 3 + 1], pool.pos[i * 3 + 2]);
      tmpObj.rotation.set(pool.spin[i] * pool.life[i], pool.spin[i] * 0.7 * pool.life[i], 0);
      tmpObj.scale.setScalar(s);
      tmpObj.updateMatrix();
      m.setMatrixAt(i, tmpObj.matrix);
      i++;
    }
    m.count = pool.alive;
    m.instanceMatrix.needsUpdate = true;
    if (m.instanceColor) m.instanceColor.needsUpdate = true;
  });

  return (
    <instancedMesh ref={mesh} args={[undefined, undefined, max]} frustumCulled={false} count={0}>
      <boxGeometry args={[1, 1, 1]} />
      <meshStandardMaterial roughness={0.6} toneMapped={false} />
    </instancedMesh>
  );
}
