import { memo, useEffect, useLayoutEffect, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import { AdditiveBlending, BufferGeometry, Color, Float32BufferAttribute } from "three";
import { useSceneLook } from "../artDirection/SceneLookContext";
import { readAtmosphereFogDensity } from "../artDirection/atmosphereFog";
import { boundedDrawCount, effectPixelRatio, FIREFLY_CAPACITY } from "./woodlandRuntimeBudget";
import { createFireflyField, fireflyCount, FIREFLY_FRAGMENT, FIREFLY_VERTEX } from "./woodlandFireflyField";

const IGNORE_RAYCAST = () => undefined;
function FireflyBatch({ count }: { count: number }) {
  const presentation = useSceneLook()!;
  const geometry = useMemo(() => {
    const data = createFireflyField(FIREFLY_CAPACITY), result = new BufferGeometry();
    result.setAttribute("position", new Float32BufferAttribute(data.positions, 3));
    result.setAttribute("fireflySeed", new Float32BufferAttribute(data.seeds, 1));
    result.computeBoundingBox(); result.computeBoundingSphere();
    result.boundingBox?.expandByScalar(.45);
    if (result.boundingSphere) result.boundingSphere.radius += .45;
    result.setDrawRange(0, 0);
    return result;
  }, []);
  useLayoutEffect(() => {
    // High/Cinematic reuse the same GPU buffers and stable point positions.
    geometry.setDrawRange(0, boundedDrawCount(count, FIREFLY_CAPACITY));
  }, [geometry, count]);
  useEffect(() => () => geometry.dispose(), [geometry]);
  const uniforms = useMemo(() => ({ time: { value: 0 }, pointScale: { value: 65 }, pointSizeMin: { value: 1 }, pointSizeMax: { value: 14 }, opacity: { value: .62 }, fogDensity: { value: .02 }, tint: { value: new Color("#ffda91") } }), []);
  useFrame(({ gl, scene }) => {
    uniforms.time.value = presentation.time.particles;
    const pixelRatio = effectPixelRatio(gl.getPixelRatio());
    uniforms.pointScale.value = 65 * pixelRatio;
    uniforms.pointSizeMin.value = pixelRatio;
    uniforms.pointSizeMax.value = 14 * pixelRatio;
    uniforms.opacity.value = .62 * (1 - presentation.stillness);
    // Match the active, interpolated scene fog rather than the target look.
    uniforms.fogDensity.value = readAtmosphereFogDensity(scene.fog);
  });
  return <points name="woodland-firefly-field" geometry={geometry} raycast={IGNORE_RAYCAST} renderOrder={4} userData={{ decorativeOnly: true, drawCallBudget: 1 }}>
    <shaderMaterial uniforms={uniforms} vertexShader={FIREFLY_VERTEX} fragmentShader={FIREFLY_FRAGMENT} transparent depthWrite={false} blending={AdditiveBlending} />
  </points>;
}

/** Disabled effects do not retain a geometry, material or animation subscriber. */
export const WoodlandFireflies = memo(function WoodlandFireflies({ quality, reducedEffects }: { quality: string; reducedEffects: boolean }) {
  const presentation = useSceneLook();
  const count = fireflyCount(presentation?.look.sceneId ?? "", quality, reducedEffects || Boolean(presentation?.reducedEffects), Boolean(presentation?.reducedMotion));
  return count > 0 ? <FireflyBatch count={count} /> : null;
});
