import { memo, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

const MIRROR_VERTEX_SHADER = /* glsl */ `
  uniform float uTime;
  uniform float uDistortion;
  varying vec2 vUv;
  varying float vWave;

  void main() {
    vUv = uv;
    vec3 transformed = position;
    float slowWave = sin((uv.y * 8.0) + uTime * 0.43);
    float crossWave = sin((uv.x * 13.0) - uTime * 0.29);
    float edgeWeight = sin(uv.x * 3.14159265) * sin(uv.y * 3.14159265);
    vWave = (slowWave * 0.62 + crossWave * 0.38) * edgeWeight;
    transformed.z += vWave * uDistortion;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(transformed, 1.0);
  }
`;

const MIRROR_FRAGMENT_SHADER = /* glsl */ `
  uniform vec3 uDeepColor;
  uniform vec3 uSkyColor;
  uniform float uOpacity;
  uniform float uDistortion;
  varying vec2 vUv;
  varying float vWave;

  void main() {
    float horizon = smoothstep(0.05, 0.9, vUv.y);
    vec3 color = mix(uDeepColor, uSkyColor, horizon * 0.72);
    float tarnish = sin(vUv.x * 47.0 + vUv.y * 31.0) * 0.018;
    float disturbed = abs(vWave) * uDistortion * 0.42;
    color += tarnish + disturbed;
    float edge = smoothstep(0.0, 0.11, vUv.x)
      * smoothstep(0.0, 0.11, 1.0 - vUv.x)
      * smoothstep(0.0, 0.08, vUv.y)
      * smoothstep(0.0, 0.08, 1.0 - vUv.y);
    gl_FragColor = vec4(color, uOpacity * (0.86 + edge * 0.14));
  }
`;

export type MirrorMemorySurfaceProps = {
  width?: number;
  height?: number;
  warm?: boolean;
  still?: boolean;
  reducedMotion?: boolean;
  reducedEffects?: boolean;
};

/**
 * A translucent, GPU-distorted mirror skin. Its instability quietens in the
 * Stillness scene only after measured player stillness, so the story
 * consequence is readable without adding a live reflection render pass.
 */
function MirrorMemorySurfaceComponent({
  width = 5.4,
  height = 6,
  warm = false,
  still = false,
  reducedMotion = false,
  reducedEffects = false,
}: MirrorMemorySurfaceProps) {
  const materialRef = useRef<THREE.ShaderMaterial>(null);
  const targetDistortion = reducedMotion ? 0 : still ? 0.012 : warm ? 0.11 : 0.065;
  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uDistortion: { value: targetDistortion },
      uDeepColor: { value: new THREE.Color(warm ? "#2d1717" : "#101923") },
      uSkyColor: { value: new THREE.Color(warm ? "#a15a40" : "#7995a7") },
      uOpacity: { value: reducedEffects ? 0.62 : 0.54 },
    }),
    [reducedEffects, targetDistortion, warm],
  );

  useFrame(({ clock }, delta) => {
    const material = materialRef.current;
    if (!material) return;
    material.uniforms.uTime.value = reducedMotion ? 0 : clock.elapsedTime;
    material.uniforms.uDistortion.value = THREE.MathUtils.damp(
      material.uniforms.uDistortion.value,
      targetDistortion,
      3.4,
      Math.min(delta, 0.05),
    );
  });

  return (
    <mesh name="stillness-sensitive-mirror-surface" position={[0, 0, 0.12]} renderOrder={3}>
      <planeGeometry args={[width, height, reducedEffects ? 12 : 24, reducedEffects ? 14 : 28]} />
      <shaderMaterial
        ref={materialRef}
        uniforms={uniforms}
        vertexShader={MIRROR_VERTEX_SHADER}
        fragmentShader={MIRROR_FRAGMENT_SHADER}
        transparent
        depthWrite={false}
        side={THREE.DoubleSide}
        toneMapped={false}
      />
    </mesh>
  );
}

export const MirrorMemorySurface = memo(MirrorMemorySurfaceComponent);
export default MirrorMemorySurface;
