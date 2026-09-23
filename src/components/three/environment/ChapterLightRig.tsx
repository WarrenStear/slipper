import { useSceneLook } from "../artDirection/SceneLookContext";
import { memo, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { CHAPTER_ENVIRONMENTS, environmentTime, type EnvironmentFamily } from "./chapterEnvironment";

/** Replaces a chapter's existing key light; no new shadow maps or global fog. */
export const ChapterLightRig = memo(function ChapterLightRig({ family, reducedMotion = false, reducedEffects = false }: { family: EnvironmentFamily; reducedMotion?: boolean; reducedEffects?: boolean }) {
  const presentation = useSceneLook();
  const preset = CHAPTER_ENVIRONMENTS[family];
  const intensity = preset.keyIntensity * (reducedEffects ? preset.reducedKeyScale ?? 1 : 1);
  const target = useMemo(() => {
    const object = new THREE.Object3D(); object.position.set(...preset.keyTarget); return object;
  }, [preset]);
  const light = useRef<THREE.SpotLight>(null), time = useRef(0);
  useFrame((_, delta) => {
    if (!light.current) return;
    time.current = environmentTime(time.current, delta, !document.hidden, reducedMotion || reducedEffects);
    light.current.intensity = intensity * (reducedMotion || reducedEffects ? 1 : 1 + Math.sin(time.current * .8) * .025);
  });
  if (presentation) return null;
  return <group name={`chapter-key:${family}`} userData={{ shadowMaps: 0, anchored: true }}>
    <primitive object={target} />
    {preset.keyType === "spot" ? <spotLight ref={light} position={preset.keyPosition} target={target} color={preset.keyColor} intensity={intensity} distance={15} decay={2} angle={1.02} penumbra={1} castShadow={false} />
      : <directionalLight position={preset.keyPosition} target={target} color={preset.keyColor} intensity={intensity} castShadow={false} />}
  </group>;
});
