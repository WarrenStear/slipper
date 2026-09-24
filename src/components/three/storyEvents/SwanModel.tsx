import { memo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import type { Group } from "three";
import { AuthoredNpcSilhouette } from "../environmentArt/AuthoredNpc";
import { useSceneLook } from "../artDirection/SceneLookContext";

/** Ownership stays outside this fallback. Only the canonical water clock can move it. */
export const SwanModel = memo(function SwanModel() {
  const body = useRef<Group>(null);
  const presentation = useSceneLook();
  const onWater = presentation?.look.sceneId.startsWith("blue-moon.") ?? false;
  useFrame(() => {
    if (!body.current) return;
    const t = presentation?.time.water ?? 0;
    const moving = onWater && !presentation?.reducedMotion;
    body.current.position.y = moving ? Math.sin(t * .7) * .009 : 0;
    body.current.rotation.z = moving ? Math.sin(t * .49) * .005 : 0;
  });
  return <group name="sculpted-story-swan">
    <group ref={body}><AuthoredNpcSilhouette kind="swan" /></group>
    {onWater && !presentation?.reducedEffects ? <mesh name="swan-waterline-wake" position={[0, .016, -.3]} rotation={[-Math.PI / 2, 0, 0]} scale={[.72, 1, 1]}>
      <ringGeometry args={[.79, .802, 40, 1, .38, Math.PI * 1.76]} />
      <meshBasicMaterial color="#8caaa9" transparent opacity={.12} depthWrite={false} />
    </mesh> : null}
  </group>;
});
