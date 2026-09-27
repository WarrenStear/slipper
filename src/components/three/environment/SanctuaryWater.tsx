import { HeroReflectionSurface } from "../reflections/HeroReflectionSurface";
import { useSceneLook } from "../artDirection/SceneLookContext";
import { memo, useCallback, useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { environmentTime } from "./chapterEnvironment";
import { useTactileDetail } from "../storyEvents/TactileMaterial";
import { applyWaterShader } from "./waterShader";
import { worldTransitionAlpha } from "../artDirection/worldVisualContinuity";
import { ENVIRONMENT_THEMES } from "./environmentThemes";
import { writeWaterSkyTarget } from "./waterSkyResponse";

type Shader = Parameters<THREE.MeshStandardMaterial["onBeforeCompile"]>[0];
export type NarrativeWaterProps = {
  width?: number; depth?: number; color?: string; opacity?: number; roughness?: number;
  circle?: boolean; flow?: number; warm?: boolean;
  /** Only a curved open-ended river opts into two-bank shallows. */
  riverBanks?: boolean;
  reducedMotion?: boolean; reducedEffects?: boolean;
  /** Borrowed XY geometry with normalized UVs; the caller owns its lifetime. */
  geometry?: THREE.BufferGeometry;
};

/** One lit, opaque dielectric surface. Reflected sky is an approximation;
 * there is no scene capture, transmission, framebuffer copy, or extra pass. */
export const NarrativeWater = memo(function NarrativeWater({
  width = 20, depth = 17, color = "#1b3540", opacity = .9, roughness = .24,
  circle = false, flow = 0, warm = false, reducedMotion = false, reducedEffects = false, geometry, riverBanks = false,
}: NarrativeWaterProps) {
  const detail = useTactileDetail();
  const presentation = useSceneLook();
  const time = useRef(0), skyReady = useRef(false);
  const hasSceneLook = Boolean(presentation);
  const sky = useMemo(() => ({ horizon: new THREE.Color(), key: new THREE.Color(), target: new THREE.Color() }), []);
  // Never replace a compiled material's uniform objects when settings change.
  const uniforms = useMemo(() => ({ waterTime: { value: 0 }, waterDetail: { value: 1 } }), []);
  const appearance = useMemo(() => ({
    waterSize: { value: new THREE.Vector2() },
    waterFlow: { value: 0 }, waterFine: { value: 0 }, waterCircle: { value: 0 },
    waterRiverBanks: { value: 0 }, waterDepth: { value: .9 }, waterSky: { value: new THREE.Color() },
  }), []);
  useEffect(() => {
    appearance.waterSize.value.set(Math.max(.1, width), Math.max(.1, circle ? width : depth));
    appearance.waterFlow.value = THREE.MathUtils.clamp(flow, -1, 1);
    appearance.waterFine.value = reducedEffects || detail === "base" ? 0 : detail === "relief" ? 1 : .5;
    appearance.waterCircle.value = circle ? 1 : 0;
    appearance.waterRiverBanks.value = riverBanks && !circle ? 1 : 0;
    // The legacy opacity control now describes depth; the water remains opaque.
    appearance.waterDepth.value = THREE.MathUtils.clamp(opacity, 0, 1);
    // Standalone/legacy water retains its original palette. Canonical water is
    // updated from the scene below; resizing it must not reset an ongoing fade.
    if (!hasSceneLook) appearance.waterSky.value.set(warm ? "#baa08c" : "#a1bbc2");
  }, [appearance, circle, depth, detail, flow, opacity, reducedEffects, warm, width, hasSceneLook, riverBanks]);
  const compile = useCallback((shader: Shader) => {
    Object.assign(shader.uniforms, uniforms, appearance);
    applyWaterShader(shader);
  }, [appearance, uniforms]);
  useFrame((_, delta) => {
    if (presentation) {
      sky.horizon.set(presentation.look.atmosphere.horizon);
      sky.key.set(presentation.look.lighting.color);
      writeWaterSkyTarget(sky.target, sky.horizon, sky.key, warm);
      const alpha = worldTransitionAlpha(delta, reducedMotion || presentation.reducedMotion || !skyReady.current);
      appearance.waterSky.value.lerp(sky.target, alpha);
      skyReady.current = true;
    } else {
      skyReady.current = false;
      time.current = environmentTime(time.current, delta, !document.hidden, reducedMotion || reducedEffects);
    }
    uniforms.waterTime.value = reducedMotion || reducedEffects ? 0 : presentation ? presentation.time.water * 3 : time.current;
    uniforms.waterDetail.value = reducedEffects ? .5 : presentation ? Math.min(1, presentation.motion.water * 4) : 1;
  });
  return <mesh name={flow ? "directional-river-water" : "still-reflective-water"} rotation={[-Math.PI / 2, 0, 0]} geometry={geometry} receiveShadow>
    {geometry ? null : circle ? <circleGeometry args={[width * .5, 48]} /> : <planeGeometry args={[width, depth]} />}
    <meshStandardMaterial color={color} roughness={roughness} metalness={0}
      onBeforeCompile={compile} customProgramCacheKey={() => "sidtw-narrative-water-v3"} />
  </mesh>;
});

export const SanctuaryWater = memo(function SanctuaryWater({ reducedMotion, reducedEffects }: { reducedMotion: boolean; reducedEffects: boolean }) {
  const theme = ENVIRONMENT_THEMES.sanctuary.water;
  return <group name="moonlit-sanctuary-water" position={[0, .01, 0]}>
    <NarrativeWater reducedMotion={reducedMotion} reducedEffects={reducedEffects} color={theme.color} flow={theme.flow} opacity={theme.depth} roughness={theme.roughness} />
    <HeroReflectionSurface kind="moonwater" size={[20, 17]} position={[0, .012, 0]} rotation={[-Math.PI / 2, 0, 0]} />
  </group>;
});
