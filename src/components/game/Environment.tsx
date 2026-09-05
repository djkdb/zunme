"use client";

import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { createRng } from "@/game/random";

const SKY_VERT = /* glsl */ `
  varying vec3 vWorld;
  void main() {
    vec4 wp = modelMatrix * vec4(position, 1.0);
    vWorld = wp.xyz;
    gl_Position = projectionMatrix * viewMatrix * wp;
  }
`;
const SKY_FRAG = /* glsl */ `
  uniform vec3 topColor;
  uniform vec3 horizonColor;
  uniform vec3 bottomColor;
  uniform vec3 sunDir;
  varying vec3 vWorld;
  void main() {
    vec3 d = normalize(vWorld);
    float h = d.y;
    vec3 col = h > 0.0
      ? mix(horizonColor, topColor, pow(clamp(h, 0.0, 1.0), 0.55))
      : mix(horizonColor, bottomColor, pow(clamp(-h, 0.0, 1.0), 0.7));
    float sun = max(0.0, dot(d, normalize(sunDir)));
    col += vec3(1.0, 0.92, 0.75) * pow(sun, 90.0) * 0.9;
    col += vec3(1.0, 0.85, 0.7) * pow(sun, 6.0) * 0.12;
    gl_FragColor = vec4(col, 1.0);
  }
`;

const SUN_POSITION: [number, number, number] = [26, 38, 14];

function SkyDome() {
  const uniforms = useMemo(
    () => ({
      topColor: { value: new THREE.Color("#4f9cff") },
      horizonColor: { value: new THREE.Color("#ffd9c9") },
      bottomColor: { value: new THREE.Color("#8fc6ff") },
      sunDir: { value: new THREE.Vector3(...SUN_POSITION) },
    }),
    [],
  );
  return (
    <mesh frustumCulled={false}>
      <sphereGeometry args={[600, 24, 16]} />
      <shaderMaterial vertexShader={SKY_VERT} fragmentShader={SKY_FRAG} uniforms={uniforms} side={THREE.BackSide} depthWrite={false} fog={false} />
    </mesh>
  );
}

const tmp = new THREE.Object3D();

/** Instanced puffy clouds drifting slowly around the island. */
function Clouds({ count = 18 }: { count?: number }) {
  const ref = useRef<THREE.InstancedMesh>(null);
  const puffs = useMemo(() => {
    const rng = createRng(20240905);
    const list: { pos: THREE.Vector3; scale: number }[] = [];
    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2 + rng() * 0.4;
      const radius = 55 + rng() * 90;
      const cx = Math.cos(angle) * radius;
      const cz = Math.sin(angle) * radius;
      const cy = -6 + rng() * 30;
      const n = 3 + Math.floor(rng() * 3);
      for (let k = 0; k < n; k++) {
        list.push({
          pos: new THREE.Vector3(cx + (rng() - 0.5) * 9, cy + (rng() - 0.5) * 2.2, cz + (rng() - 0.5) * 9),
          scale: 2.2 + rng() * 3.2,
        });
      }
    }
    return list;
  }, [count]);

  useEffect(() => {
    const mesh = ref.current;
    if (!mesh) return;
    puffs.forEach((p, i) => {
      tmp.position.copy(p.pos);
      tmp.scale.setScalar(p.scale);
      tmp.updateMatrix();
      mesh.setMatrixAt(i, tmp.matrix);
    });
    mesh.instanceMatrix.needsUpdate = true;
  }, [puffs]);

  useFrame((_, dt) => {
    if (ref.current) ref.current.rotation.y += dt * 0.006;
  });

  return (
    <instancedMesh ref={ref} args={[undefined, undefined, puffs.length]} frustumCulled={false}>
      <sphereGeometry args={[1, 7, 5]} />
      <meshStandardMaterial color="#ffffff" roughness={1} flatShading />
    </instancedMesh>
  );
}

/** Distant floating islands for depth. */
function FarIslands() {
  const group = useRef<THREE.Group>(null);
  const islands = useMemo(
    () =>
      [0, 1, 2, 3, 4, 5].map((i) => {
        const a = (i / 6) * Math.PI * 2 + 0.5;
        const r = 48 + (i % 3) * 16;
        return { x: Math.cos(a) * r, z: Math.sin(a) * r, y: -14 + (i % 2) * 10, s: 3 + (i % 3) * 1.5, phase: i };
      }),
    [],
  );
  useFrame(({ clock }) => {
    const g = group.current;
    if (!g) return;
    g.children.forEach((child, i) => {
      child.position.y = islands[i].y + Math.sin(clock.elapsedTime * 0.4 + islands[i].phase) * 0.6;
    });
  });
  return (
    <group ref={group}>
      {islands.map((isl, i) => (
        <group key={i} position={[isl.x, isl.y, isl.z]} scale={isl.s}>
          <mesh position={[0, 0.25, 0]}>
            <cylinderGeometry args={[1.4, 1.1, 0.5, 7]} />
            <meshStandardMaterial color="#79d48a" roughness={1} flatShading />
          </mesh>
          <mesh position={[0, -0.8, 0]}>
            <coneGeometry args={[1.2, 2, 7]} />
            <meshStandardMaterial color="#8a6a52" roughness={1} flatShading />
          </mesh>
          <mesh position={[0.3, 0.9, 0.1]}>
            <coneGeometry args={[0.35, 0.9, 5]} />
            <meshStandardMaterial color="#3fae5d" roughness={1} flatShading />
          </mesh>
        </group>
      ))}
    </group>
  );
}

export function Lighting({ mobile }: { mobile: boolean }) {
  return (
    <>
      <hemisphereLight args={["#cfe8ff", "#ffd6a5", 0.75]} />
      <ambientLight intensity={0.35} />
      <directionalLight
        position={SUN_POSITION}
        intensity={2.4}
        color="#fff4e0"
        castShadow
        shadow-mapSize={mobile ? [1024, 1024] : [2048, 2048]}
        shadow-camera-left={-18}
        shadow-camera-right={18}
        shadow-camera-top={18}
        shadow-camera-bottom={-18}
        shadow-camera-near={5}
        shadow-camera-far={90}
        shadow-bias={-0.0004}
        shadow-normalBias={0.03}
      />
    </>
  );
}

export function Environment({ mobile }: { mobile: boolean }) {
  return (
    <>
      <SkyDome />
      <fog attach="fog" args={["#ffd9c9", 70, 260]} />
      <Clouds count={mobile ? 12 : 18} />
      <FarIslands />
      {/* Sea far below, to give the fall a sense of height */}
      <mesh position={[0, -90, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[900, 900]} />
        <meshStandardMaterial color="#5fb0ea" roughness={0.9} />
      </mesh>
    </>
  );
}
