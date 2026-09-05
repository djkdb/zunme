"use client";

import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { createRng } from "@/game/random";
import { THEMES, type Theme } from "@/game/theme";
import { useGameStore } from "@/store/gameStore";

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
  uniform vec3 sunColor;
  varying vec3 vWorld;
  void main() {
    vec3 d = normalize(vWorld);
    float h = d.y;
    vec3 col = h > 0.0
      ? mix(horizonColor, topColor, pow(clamp(h, 0.0, 1.0), 0.55))
      : mix(horizonColor, bottomColor, pow(clamp(-h, 0.0, 1.0), 0.7));
    float sun = max(0.0, dot(d, normalize(sunDir)));
    col += sunColor * pow(sun, 120.0) * 1.2;
    col += sunColor * pow(sun, 8.0) * 0.18;
    col += sunColor * pow(sun, 2.0) * 0.05;
    gl_FragColor = vec4(col, 1.0);
  }
`;

const SEA_VERT = /* glsl */ `
  uniform float time;
  varying float vWave;
  varying float vDist;
  void main() {
    vec3 p = position;
    float w = sin(p.x * 0.06 + time * 0.8) * 0.8 + cos(p.y * 0.05 - time * 0.6) * 0.8 + sin((p.x + p.y) * 0.03 + time * 0.4) * 1.2;
    p.z += w;
    vWave = w;
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    vDist = length(mv.xyz);
    gl_Position = projectionMatrix * mv;
  }
`;
const SEA_FRAG = /* glsl */ `
  uniform vec3 shallow;
  uniform vec3 deep;
  uniform vec3 haze;
  uniform float hazeNear;
  uniform float hazeFar;
  varying float vWave;
  varying float vDist;
  void main() {
    float k = clamp(0.5 + vWave * 0.18, 0.0, 1.0);
    vec3 col = mix(deep, shallow, k);
    // gentle crest highlights
    col += vec3(1.0) * smoothstep(2.0, 2.8, vWave) * 0.12;
    // fade into the sky haze with distance (the sea sits ~90 m below the island)
    float f = smoothstep(hazeNear, hazeFar, vDist);
    col = mix(col, haze, f);
    gl_FragColor = vec4(col, 1.0);
  }
`;

export const SUN_POSITION: [number, number, number] = [26, 38, 14];
const tmpColor = new THREE.Color();

function lerpColor(target: THREE.Color, hex: string, k: number) {
  target.lerp(tmpColor.set(hex), k);
}

/** Smoothly blends every theme colour towards the current mode's theme. */
function useTheme(): { theme: Theme; ref: React.MutableRefObject<Theme> } {
  const mode = useGameStore((s) => s.state.mode);
  const theme = THEMES[mode];
  const ref = useRef(theme);
  useEffect(() => {
    ref.current = theme;
  }, [theme]);
  return { theme, ref };
}

function SkyDome({ themeRef }: { themeRef: React.MutableRefObject<Theme> }) {
  const uniforms = useMemo(
    () => ({
      topColor: { value: new THREE.Color(THEMES.SUMO.skyTop) },
      horizonColor: { value: new THREE.Color(THEMES.SUMO.skyHorizon) },
      bottomColor: { value: new THREE.Color(THEMES.SUMO.skyBottom) },
      sunDir: { value: new THREE.Vector3(...SUN_POSITION) },
      sunColor: { value: new THREE.Color("#fff0d0") },
    }),
    [],
  );
  useFrame((_, dt) => {
    const k = Math.min(1, dt * 1.5);
    const t = themeRef.current;
    lerpColor(uniforms.topColor.value, t.skyTop, k);
    lerpColor(uniforms.horizonColor.value, t.skyHorizon, k);
    lerpColor(uniforms.bottomColor.value, t.skyBottom, k);
    lerpColor(uniforms.sunColor.value, t.sun, k);
  });
  return (
    <mesh frustumCulled={false}>
      <sphereGeometry args={[600, 24, 16]} />
      <shaderMaterial vertexShader={SKY_VERT} fragmentShader={SKY_FRAG} uniforms={uniforms} side={THREE.BackSide} depthWrite={false} fog={false} />
    </mesh>
  );
}

/** Scene fog that follows the theme. */
function ThemedFog({ themeRef }: { themeRef: React.MutableRefObject<Theme> }) {
  const fogRef = useRef<THREE.Fog>(null);
  useFrame((_, dt) => {
    const fog = fogRef.current;
    if (!fog) return;
    const k = Math.min(1, dt * 1.5);
    const t = themeRef.current;
    lerpColor(fog.color, t.fog, k);
    fog.near = THREE.MathUtils.lerp(fog.near, t.fogNear, k);
    fog.far = THREE.MathUtils.lerp(fog.far, t.fogFar, k);
  });
  return <fog ref={fogRef} attach="fog" args={[THEMES.SUMO.fog, THEMES.SUMO.fogNear, THEMES.SUMO.fogFar]} />;
}

let glowTexture: THREE.CanvasTexture | null = null;
function getGlow(): THREE.CanvasTexture {
  if (glowTexture) return glowTexture;
  const c = document.createElement("canvas");
  c.width = c.height = 256;
  const ctx = c.getContext("2d");
  if (ctx) {
    const g = ctx.createRadialGradient(128, 128, 0, 128, 128, 128);
    g.addColorStop(0, "rgba(255,255,255,0.9)");
    g.addColorStop(0.25, "rgba(255,240,200,0.45)");
    g.addColorStop(1, "rgba(255,220,180,0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 256, 256);
  }
  glowTexture = new THREE.CanvasTexture(c);
  return glowTexture;
}

function SunGlow() {
  const texture = useMemo(() => getGlow(), []);
  const dir = useMemo(() => new THREE.Vector3(...SUN_POSITION).normalize().multiplyScalar(420), []);
  return (
    <sprite position={dir.toArray()} scale={[140, 140, 1]}>
      <spriteMaterial map={texture} transparent depthWrite={false} blending={THREE.AdditiveBlending} fog={false} />
    </sprite>
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

/** Drifting dust / sparkle motes around the play area. */
function Dust({ count, themeRef }: { count: number; themeRef: React.MutableRefObject<Theme> }) {
  const ref = useRef<THREE.Points>(null);
  const positions = useMemo(() => {
    const rng = createRng(7);
    const arr = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      arr[i * 3] = (rng() - 0.5) * 60;
      arr[i * 3 + 1] = -4 + rng() * 18;
      arr[i * 3 + 2] = (rng() - 0.5) * 60;
    }
    return arr;
  }, [count]);
  const material = useMemo(() => new THREE.PointsMaterial({ color: "#ffffff", size: 0.12, transparent: true, opacity: 0.55, depthWrite: false, sizeAttenuation: true }), []);
  useFrame(({ clock }, dt) => {
    const p = ref.current;
    if (!p) return;
    const t = clock.elapsedTime;
    p.rotation.y = t * 0.02;
    p.position.y = Math.sin(t * 0.3) * 0.4;
    lerpColor(material.color, themeRef.current.dust, Math.min(1, dt * 1.5));
  });
  return (
    <points ref={ref} material={material} frustumCulled={false}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
    </points>
  );
}

function Sea({ themeRef }: { themeRef: React.MutableRefObject<Theme> }) {
  const uniforms = useMemo(
    () => ({
      time: { value: 0 },
      shallow: { value: new THREE.Color(THEMES.SUMO.sea) },
      deep: { value: new THREE.Color(THEMES.SUMO.seaDeep) },
      haze: { value: new THREE.Color(THEMES.SUMO.fog) },
      hazeNear: { value: 80 },
      hazeFar: { value: 230 },
    }),
    [],
  );
  const mat = useRef<THREE.ShaderMaterial>(null);
  useFrame(({ clock }, dt) => {
    const u = mat.current?.uniforms;
    if (!u) return;
    u.time.value = clock.elapsedTime;
    const k = Math.min(1, dt * 1.5);
    lerpColor(u.shallow.value as THREE.Color, themeRef.current.sea, k);
    lerpColor(u.deep.value as THREE.Color, themeRef.current.seaDeep, k);
    lerpColor(u.haze.value as THREE.Color, themeRef.current.fog, k);
  });
  return (
    <mesh position={[0, -90, 0]} rotation={[-Math.PI / 2, 0, 0]}>
      <planeGeometry args={[900, 900, 48, 48]} />
      <shaderMaterial ref={mat} vertexShader={SEA_VERT} fragmentShader={SEA_FRAG} uniforms={uniforms} fog={false} />
    </mesh>
  );
}

export function Lighting({ mobile }: { mobile: boolean }) {
  const { ref } = useTheme();
  const sun = useRef<THREE.DirectionalLight>(null);
  const hemi = useRef<THREE.HemisphereLight>(null);
  useFrame((_, dt) => {
    const k = Math.min(1, dt * 1.5);
    const t = ref.current;
    if (sun.current) {
      lerpColor(sun.current.color, t.sun, k);
      sun.current.intensity = THREE.MathUtils.lerp(sun.current.intensity, t.sunIntensity, k);
    }
    if (hemi.current) {
      lerpColor(hemi.current.color, t.hemiSky, k);
      lerpColor(hemi.current.groundColor, t.hemiGround, k);
    }
  });
  return (
    <>
      <hemisphereLight ref={hemi} args={["#cfe8ff", "#ffd6a5", 0.75]} />
      <ambientLight intensity={0.3} />
      <directionalLight
        ref={sun}
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
  const { ref } = useTheme();
  return (
    <>
      <SkyDome themeRef={ref} />
      <ThemedFog themeRef={ref} />
      <SunGlow />
      <Clouds count={mobile ? 12 : 18} />
      <FarIslands />
      <Dust count={mobile ? 120 : 260} themeRef={ref} />
      <Sea themeRef={ref} />
    </>
  );
}
