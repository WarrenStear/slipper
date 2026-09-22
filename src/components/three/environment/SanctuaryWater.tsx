import { memo, useCallback, useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { environmentTime } from "./chapterEnvironment";
import { useTactileDetail } from "../storyEvents/TactileMaterial";
import { applyWaterShader } from "./waterShader";

type Shader = Parameters<THREE.MeshStandardMaterial["onBeforeCompile"]>[0];
export type NarrativeWaterProps = {
  width?: number; depth?: number; color?: string; opacity?: number;
  circle?: boolean; flow?: number; warm?: boolean;
  reducedMotion?: boolean; reducedEffects?: boolean;
};

/** One lit, opaque dielectric surface. Reflected sky is an approximation;
 * there is no scene capture, transmission, framebuffer copy, or extra pass. */
export const NarrativeWater = memo(function NarrativeWater({
  width = 20, depth = 17, color = "#1b3540", opacity = .9,
  circle = false, flow = 0, warm = false, reducedMotion = false, reducedEffects = false,
}: NarrativeWaterProps) {
  const detail = useTactileDetail();
  const time = useRef(0);
  // Never replace a compiled material's uniform objects when settings change.
  const uniforms = useMemo(() => ({ waterTime: { value: 0 }, waterDetail: { value: 1 } }), []);
  const appearance = useMemo(() => ({
    waterSize: { value: new THREE.Vector2() },
    waterFlow: { value: 0 }, waterFine: { value: 0 }, waterCircle: { value: 0 },
    waterDepth: { value: .9 }, waterSky: { value: new THREE.Color() },
  }), []);
  useEffect(() => {
    appearance.waterSize.value.set(Math.max(.1, width), Math.max(.1, circle ? width : depth));
    appearance.waterFlow.value = THREE.MathUtils.clamp(flow, -1, 1);
    appearance.waterFine.value = reducedEffects || detail === "base" ? 0 : detail === "relief" ? 1 : .5;
    appearance.waterCircle.value = circle ? 1 : 0;
    // The legacy opacity control now describes depth; the water remains opaque.
    appearance.waterDepth.value = THREE.MathUtils.clamp(opacity, 0, 1);
    appearance.waterSky.value.set(warm ? "#baa08c" : "#a1bbc2");
  }, [appearance, circle, depth, detail, flow, opacity, reducedEffects, warm, width]);
  const compile = useCallback((shader: Shader) => {
    Object.assign(shader.uniforms, uniforms, appearance);
    applyWaterShader(shader);
  }, [appearance, uniforms]);
  useFrame((_, delta) => {
    time.current = environmentTime(time.current, delta, !document.hidden, reducedMotion || reducedEffects);
    uniforms.waterTime.value = reducedMotion || reducedEffects ? 0 : time.current;
    uniforms.waterDetail.value = reducedEffects ? .5 : 1;
  });
  return <mesh name={flow ? "directional-river-water" : "still-reflective-water"} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
    {circle ? <circleGeometry args={[width * .5, 48]} /> : <planeGeometry args={[width, depth]} />}
    <meshStandardMaterial color={color} roughness={.24} metalness={0}
      onBeforeCompile={compile} customProgramCacheKey={() => "sidtw-narrative-water-v2"} />
  </mesh>;
});

export const SanctuaryWater = memo(function SanctuaryWater({ reducedMotion, reducedEffects }: { reducedMotion: boolean; reducedEffects: boolean }) {
  return <group name="moonlit-sanctuary-water" position={[0, .01, 0]}>
    <NarrativeWater reducedMotion={reducedMotion} reducedEffects={reducedEffects} />
  </group>;
});
