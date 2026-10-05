import { useEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { type WorldVisualState } from "../../components/three/worldVisualState.ts";
import { type RenderQualityProfile } from "../../components/three/renderQuality.ts";

export function DistantForestSilhouetteRing({
  visualState,
  qualityProfile,
}: {
  visualState: WorldVisualState;
  qualityProfile: RenderQualityProfile;
}) {
  const meshRef = useRef<THREE.Mesh>(null);
  const { camera } = useThree();
  const targetNearColorRef = useRef(new THREE.Color(visualState.palette.trunk));
  const targetFarColorRef = useRef(new THREE.Color(visualState.fogColor));
  const targetOpacityRef = useRef(0.32);
  const uniforms = useMemo(
    () => ({
      nearColor: { value: new THREE.Color(visualState.palette.trunk) },
      farColor: { value: new THREE.Color(visualState.fogColor) },
      silhouetteOpacity: { value: 0.32 },
    }),
    [],
  );

  useEffect(() => {
    targetNearColorRef.current
      .set(visualState.backgroundColor)
      .lerp(new THREE.Color(visualState.fogColor), 0.38)
      .lerp(new THREE.Color(visualState.palette.trunk), 0.045);
    targetFarColorRef.current
      .set(visualState.backgroundColor)
      .lerp(new THREE.Color(visualState.fogColor), 0.52);
    targetOpacityRef.current = THREE.MathUtils.clamp(
      0.1 + visualState.director.forestDensity * 0.21,
      0.12,
      0.3,
    );
  }, [
    visualState.backgroundColor,
    visualState.director.forestDensity,
    visualState.fogColor,
    visualState.palette.trunk,
  ]);

  useFrame((_, delta) => {
    const mesh = meshRef.current;
    if (!mesh) return;
    mesh.position.copy(camera.position);
    mesh.position.y -= 9.5;
    const smoothing = 1 - Math.exp(-Math.min(delta, 0.05) * 1.2);
    uniforms.nearColor.value.lerp(targetNearColorRef.current, smoothing);
    uniforms.farColor.value.lerp(targetFarColorRef.current, smoothing);
    uniforms.silhouetteOpacity.value = THREE.MathUtils.lerp(
      uniforms.silhouetteOpacity.value,
      targetOpacityRef.current,
      smoothing,
    );
  });

  return (
    <mesh ref={meshRef} renderOrder={-24} frustumCulled={false}>
      <cylinderGeometry args={[74, 74, 54, qualityProfile.quality === "low" ? 72 : 112, 1, true]} />
      <shaderMaterial
        side={THREE.BackSide}
        transparent
        depthWrite={false}
        toneMapped
        uniforms={uniforms}
        vertexShader={`
          varying vec2 vSilhouetteUv;
          void main() {
            vSilhouetteUv = uv;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          }
        `}
        fragmentShader={`
          uniform vec3 nearColor;
          uniform vec3 farColor;
          uniform float silhouetteOpacity;
          varying vec2 vSilhouetteUv;

          void main() {
            float angle = vSilhouetteUv.x * 6.2831853;
            float broad = sin(angle * 7.0 + 0.8) * 0.5 + 0.5;
            float middle = sin(angle * 19.0 - 1.4) * 0.5 + 0.5;
            float needles = pow(sin(angle * 47.0 + 2.1) * 0.5 + 0.5, 10.0);
            float distantNeedles = pow(sin(angle * 31.0 - 0.45) * 0.5 + 0.5, 8.0);
            float ridge = 0.6 + broad * 0.075 + middle * 0.055 + needles * 0.09 + distantNeedles * 0.045;
            float silhouette = 1.0 - smoothstep(ridge - 0.012, ridge + 0.018, vSilhouetteUv.y);
            float baseMist = smoothstep(0.05, 0.34, vSilhouetteUv.y);
            float crownMist = smoothstep(0.24, 0.82, vSilhouetteUv.y);
            vec3 color = mix(farColor, nearColor, crownMist * 0.78);
            float alpha = silhouette * baseMist * silhouetteOpacity;
            if (alpha < 0.002) discard;
            gl_FragColor = vec4(color, alpha);
            #include <tonemapping_fragment>
            #include <colorspace_fragment>
          }
        `}
      />
    </mesh>
  );
}

