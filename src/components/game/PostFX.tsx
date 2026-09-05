"use client";

import { Bloom, EffectComposer, Vignette } from "@react-three/postprocessing";

/** Subtle bloom + vignette. Skipped on mobile to keep frame rate. */
export function PostFX({ enabled }: { enabled: boolean }) {
  if (!enabled) return null;
  return (
    <EffectComposer multisampling={4}>
      <Bloom luminanceThreshold={0.82} luminanceSmoothing={0.25} intensity={0.55} mipmapBlur />
      <Vignette eskil={false} offset={0.25} darkness={0.55} />
    </EffectComposer>
  );
}
