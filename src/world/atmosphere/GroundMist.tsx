import { useLayoutEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Color, FrontSide, Object3D, type InstancedMesh } from "three";
import { useSceneLook } from "../../components/three/artDirection/SceneLookContext";
import { readAtmosphereFogDensity } from "./atmosphereFog";
import { blendWorldValue, worldTransitionAlpha } from "../../components/three/artDirection/worldVisualContinuity";
import { groundMistPatches, GROUND_MIST_FRAGMENT, GROUND_MIST_VERTEX, type MistPatch } from "./groundMistField";
import { composeGroundMist } from "./forestDepth.ts";

const IGNORE_RAYCAST = () => undefined;
function MistBatch({ patches }: { patches: readonly MistPatch[] }) {
  const presentation = useSceneLook()!;
  const ref = useRef<InstancedMesh>(null);
  const uniforms = useMemo(() => ({ tint: { value: new Color(presentation.look.atmosphere.horizon) }, time: { value: 0 }, opacity: { value: 0 }, fogDensity: { value: 0 } }), []);
  useLayoutEffect(() => {
    const mesh = ref.current; if (!mesh) return;
    const transform = new Object3D();
    patches.forEach(([x, y, z, sx, sy, sz], i) => {
      transform.position.set(x, y, z); transform.scale.set(sx, sy, sz); transform.updateMatrix();
      mesh.setMatrixAt(i, transform.matrix);
    });
    mesh.instanceMatrix.needsUpdate = true;
    mesh.computeBoundingBox(); mesh.computeBoundingSphere();
  }, [patches]);
  const tintTarget = useMemo(() => new Color(), []);
  useFrame(({ scene }, delta) => {
    const alpha = worldTransitionAlpha(delta, presentation.reducedMotion);
    uniforms.tint.value.lerp(tintTarget.set(presentation.look.atmosphere.horizon), alpha);
    uniforms.time.value = presentation.time.vegetation;
    uniforms.fogDensity.value = readAtmosphereFogDensity(scene.fog);
    uniforms.opacity.value = blendWorldValue(uniforms.opacity.value, (presentation.look.sceneId.startsWith("blue-moon.") ? .065 : .085) * (1 - presentation.stillness * .8), alpha);
  });
  return <instancedMesh ref={ref} name="scene-local-ground-mist" args={[undefined, undefined, patches.length]} renderOrder={2} raycast={IGNORE_RAYCAST} userData={{ decorativeOnly: true, drawCallBudget: 1, patches: patches.length }}>
    <sphereGeometry args={[1, 12, 6]} />
    <shaderMaterial uniforms={uniforms} side={FrontSide} transparent depthWrite={false} vertexShader={GROUND_MIST_VERTEX} fragmentShader={GROUND_MIST_FRAGMENT} />
  </instancedMesh>;
}

/** One shared draw, geometry and shader. Disabled mist retains no frame subscriber. */
export function GroundMist() {
  const presentation = useSceneLook()!;
  const patches = useMemo(() => composeGroundMist(groundMistPatches(presentation.look.sceneId), presentation.look.composition), [presentation.look.sceneId, presentation.look.composition]);
  return presentation.look.budget.shafts && patches.length ? <MistBatch patches={patches} /> : null;
}
