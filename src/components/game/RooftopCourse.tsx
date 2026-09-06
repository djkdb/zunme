"use client";

import { useFrame } from "@react-three/fiber";
import { CuboidCollider, RigidBody } from "@react-three/rapier";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { buildCourse, gogunRuntime, type Course } from "@/game/gogun";
import { createRng } from "@/game/random";
import { livePoses } from "@/game/remote";
import { useGameStore } from "@/store/gameStore";

const tmpObj = new THREE.Object3D();

/** Course for the current seed, shared by the scene and the controller. */
export function useCourse(): Course {
  const seed = useGameStore((s) => s.state.seed);
  const course = useMemo(() => buildCourse(seed), [seed]);
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") {
      const w = window as unknown as { __dropzone?: Record<string, unknown> };
      w.__dropzone = { ...(w.__dropzone ?? {}), course };
    }
  }, [course]);
  return course;
}

function Windows({ course }: { course: Course }) {
  const ref = useRef<THREE.InstancedMesh>(null);
  const windows = useMemo(() => {
    const rng = createRng(99);
    const list: { x: number; y: number; z: number; rot: number; lit: boolean }[] = [];
    for (const b of course.buildings) {
      const rows = Math.floor((b.top + 12) / 1.6);
      const colsX = Math.floor(b.w / 1.4);
      const colsZ = Math.floor(b.d / 1.4);
      for (let r = 0; r < rows; r++) {
        const y = b.top - 0.9 - r * 1.6;
        for (let c = 0; c < colsX; c++) {
          const x = b.x - b.w / 2 + 0.7 + c * 1.4;
          list.push({ x, y, z: b.zStart + 0.01, rot: 0, lit: rng() < 0.55 });
          list.push({ x, y, z: b.zEnd - 0.01, rot: Math.PI, lit: rng() < 0.55 });
        }
        for (let c = 0; c < colsZ; c++) {
          const z = b.zStart - 0.7 - c * 1.4;
          list.push({ x: b.x - b.w / 2 - 0.01, y, z, rot: -Math.PI / 2, lit: rng() < 0.55 });
          list.push({ x: b.x + b.w / 2 + 0.01, y, z, rot: Math.PI / 2, lit: rng() < 0.55 });
        }
      }
    }
    return list.slice(0, 4000);
  }, [course]);

  useEffect(() => {
    const m = ref.current;
    if (!m) return;
    const lit = new THREE.Color("#ffd27a");
    const dark = new THREE.Color("#1a1f3a");
    windows.forEach((w, i) => {
      tmpObj.position.set(w.x, w.y, w.z);
      tmpObj.rotation.set(0, w.rot, 0);
      tmpObj.scale.set(1, 1, 1);
      tmpObj.updateMatrix();
      m.setMatrixAt(i, tmpObj.matrix);
      m.setColorAt(i, w.lit ? lit : dark);
    });
    m.instanceMatrix.needsUpdate = true;
    if (m.instanceColor) m.instanceColor.needsUpdate = true;
  }, [windows]);

  return (
    <instancedMesh ref={ref} args={[undefined, undefined, windows.length]} frustumCulled={false}>
      <planeGeometry args={[0.8, 1.0]} />
      <meshStandardMaterial emissive="#ffd27a" emissiveIntensity={0.9} color="#000000" roughness={1} toneMapped={false} />
    </instancedMesh>
  );
}

function Coins({ course }: { course: Course }) {
  const ref = useRef<THREE.InstancedMesh>(null);
  const lastRound = useRef(-1);
  useEffect(() => {
    const m = ref.current;
    if (!m) return;
    const gold = new THREE.Color("#ffd32a");
    const silver = new THREE.Color("#dfe6f2");
    course.coins.forEach((c, i) => {
      tmpObj.position.set(c.x, c.y, c.z);
      tmpObj.rotation.set(Math.PI / 2, 0, 0);
      tmpObj.scale.setScalar(c.gold ? 1.3 : 1);
      tmpObj.updateMatrix();
      m.setMatrixAt(i, tmpObj.matrix);
      m.setColorAt(i, c.gold ? gold : silver);
    });
    m.instanceMatrix.needsUpdate = true;
    if (m.instanceColor) m.instanceColor.needsUpdate = true;
  }, [course]);

  useFrame(({ clock }) => {
    const m = ref.current;
    if (!m) return;
    const round = useGameStore.getState().state.round;
    if (round !== lastRound.current) {
      lastRound.current = round;
      gogunRuntime.collected.clear();
    }
    const t = clock.elapsedTime;
    course.coins.forEach((c, i) => {
      const taken = gogunRuntime.collected.has(i);
      tmpObj.position.set(c.x, c.y + Math.sin(t * 3 + i) * 0.08, c.z);
      tmpObj.rotation.set(Math.PI / 2, 0, t * 2 + i);
      tmpObj.scale.setScalar(taken ? 0.0001 : c.gold ? 1.3 : 1);
      tmpObj.updateMatrix();
      m.setMatrixAt(i, tmpObj.matrix);
    });
    m.instanceMatrix.needsUpdate = true;
  });

  return (
    <instancedMesh ref={ref} args={[undefined, undefined, course.coins.length]} frustumCulled={false}>
      <cylinderGeometry args={[0.38, 0.38, 0.1, 14]} />
      <meshStandardMaterial roughness={0.3} metalness={0.7} emissive="#7a5a10" emissiveIntensity={0.35} />
    </instancedMesh>
  );
}

/** The wire from the local player's hand to the hooked anchor. */
function WireLine() {
  const ref = useRef<THREE.Line>(null);
  const geom = useMemo(() => new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]), []);
  useFrame(() => {
    const line = ref.current;
    if (!line) return;
    const w = gogunRuntime.wire;
    const p = livePoses.get(useGameStore.getState().localId);
    line.visible = w.active && Boolean(p);
    if (!w.active || !p) return;
    const pos = line.geometry.attributes.position as THREE.BufferAttribute;
    pos.setXYZ(0, p.x, p.y + 1.2, p.z);
    pos.setXYZ(1, w.x, w.y, w.z);
    pos.needsUpdate = true;
  });
  return (
    <primitive object={useMemo(() => new THREE.Line(geom, new THREE.LineBasicMaterial({ color: "#ffffff" })), [geom])} ref={ref} />
  );
}

/** Night-city rooftops for ROOFTOP RUNNER. */
export function RooftopCourse({ course }: { course: Course }) {
  const anchorRefs = useRef<(THREE.Mesh | null)[]>([]);
  useFrame(({ clock }) => {
    const w = gogunRuntime.wire;
    anchorRefs.current.forEach((m, i) => {
      if (!m) return;
      const mat = m.material as THREE.MeshStandardMaterial;
      const hooked = w.active && w.anchor === i;
      mat.emissiveIntensity = hooked ? 2.5 : 0.9 + Math.sin(clock.elapsedTime * 4 + i) * 0.3;
      m.rotation.y = clock.elapsedTime * (hooked ? 6 : 1.2);
    });
  });

  return (
    <group>
      <RigidBody type="fixed" colliders={false} userData={{ type: "ground" }}>
        {course.buildings.map((b) => {
          const h = b.top + 14;
          return (
            <group key={b.index}>
              <CuboidCollider args={[b.w / 2, h / 2, b.d / 2]} position={[b.x, b.top - h / 2, b.z]} friction={0.9} />
              <mesh castShadow receiveShadow position={[b.x, b.top - h / 2, b.z]}>
                <boxGeometry args={[b.w, h, b.d]} />
                <meshStandardMaterial color={b.color} roughness={0.9} />
              </mesh>
              {/* roof rim */}
              <mesh position={[b.x, b.top + 0.08, b.z]}>
                <boxGeometry args={[b.w + 0.3, 0.16, b.d + 0.3]} />
                <meshStandardMaterial color="#20243d" roughness={0.9} />
              </mesh>
            </group>
          );
        })}
        {course.obstacles.map((o, i) => (
          <group key={i}>
            <CuboidCollider args={[o.w / 2, o.h / 2, o.d / 2]} position={[o.x, o.top + o.h / 2, o.z]} />
            <mesh castShadow position={[o.x, o.top + o.h / 2, o.z]}>
              <boxGeometry args={[o.w, o.h, o.d]} />
              <meshStandardMaterial color="#8a6a52" roughness={0.9} flatShading />
            </mesh>
          </group>
        ))}
      </RigidBody>

      {/* wire anchors: lantern poles */}
      {course.anchors.map((a, i) => (
        <group key={a.index} position={[a.x, a.y, a.z]}>
          <mesh ref={(m) => { anchorRefs.current[i] = m; }}>
            <torusGeometry args={[0.55, 0.12, 8, 20]} />
            <meshStandardMaterial color="#ffd32a" emissive="#ffb020" emissiveIntensity={1} roughness={0.4} toneMapped={false} />
          </mesh>
          <mesh position={[0, 0, 0]}>
            <sphereGeometry args={[0.22, 8, 6]} />
            <meshStandardMaterial color="#fff6c2" emissive="#ffd32a" emissiveIntensity={2} toneMapped={false} />
          </mesh>
          {/* hanging cable from far above */}
          <mesh position={[0, 6, 0]}>
            <cylinderGeometry args={[0.03, 0.03, 12, 5]} />
            <meshStandardMaterial color="#c9b79c" />
          </mesh>
        </group>
      ))}

      <Windows course={course} />
      <Coins course={course} />
      <WireLine />

      {/* goal gate */}
      <group position={[0, roofAt(course, course.goalZ), course.goalZ - 4]}>
        {[-1, 1].map((s) => (
          <mesh key={s} position={[s * 5, 2.5, 0]}>
            <boxGeometry args={[0.6, 5, 0.6]} />
            <meshStandardMaterial color="#ffd32a" emissive="#ffb020" emissiveIntensity={0.6} />
          </mesh>
        ))}
        <mesh position={[0, 5.2, 0]}>
          <boxGeometry args={[10.6, 0.6, 0.6]} />
          <meshStandardMaterial color="#ffd32a" emissive="#ffb020" emissiveIntensity={0.6} />
        </mesh>
      </group>

      {/* far city silhouettes */}
      <FarCity />
    </group>
  );
}

function roofAt(course: Course, z: number): number {
  for (const b of course.buildings) if (z <= b.zStart + 0.01 && z >= b.zEnd - 0.01) return b.top;
  return 0;
}

function FarCity() {
  const ref = useRef<THREE.InstancedMesh>(null);
  const blocks = useMemo(() => {
    const rng = createRng(4242);
    const list: { x: number; z: number; h: number; w: number }[] = [];
    for (let i = 0; i < 160; i++) {
      const side = i % 2 === 0 ? -1 : 1;
      list.push({ x: side * (18 + rng() * 40), z: 20 - rng() * 520, h: 8 + rng() * 28, w: 5 + rng() * 8 });
    }
    return list;
  }, []);
  useEffect(() => {
    const m = ref.current;
    if (!m) return;
    blocks.forEach((b, i) => {
      tmpObj.position.set(b.x, b.h / 2 - 12, b.z);
      tmpObj.scale.set(b.w, b.h, b.w);
      tmpObj.rotation.set(0, 0, 0);
      tmpObj.updateMatrix();
      m.setMatrixAt(i, tmpObj.matrix);
    });
    m.instanceMatrix.needsUpdate = true;
  }, [blocks]);
  return (
    <instancedMesh ref={ref} args={[undefined, undefined, blocks.length]} frustumCulled={false}>
      <boxGeometry args={[1, 1, 1]} />
      <meshStandardMaterial color="#141a3a" roughness={1} />
    </instancedMesh>
  );
}
