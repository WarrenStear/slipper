import { useEffect, useMemo, useRef } from "react";
import { useTexture } from "@react-three/drei";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { type WorldVisualState } from "../../components/three/worldVisualState.ts";
import { CinematicForestDepthPlate } from "./CinematicForestDepthPlate.tsx";

export const FIRST_WOOD_PANORAMA_PATH = "/textures/environment/first-wood-panorama-v3.webp";

export function AtmosphericForestPanorama({
  radius,
  visualState,
  showDepthPlate,
}: {
  radius: number;
  visualState: WorldVisualState;
  showDepthPlate: boolean;
}) {
  const texture = useTexture(FIRST_WOOD_PANORAMA_PATH);
  const meshRef = useRef<THREE.Mesh>(null);
  const { camera } = useThree();
  const targetFogColorRef = useRef(new THREE.Color(visualState.fogColor));
  const targetSkyColorRef = useRef(new THREE.Color(visualState.backgroundColor));
  const targetSkyOpennessRef = useRef(visualState.director.skyOpenness);
  const targetForestOpacityRef = useRef(0.72);
  const targetFogStrengthRef = useRef(0.4);
  const uniforms = useMemo(
    () => ({
      panoramaMap: { value: texture },
      fogTint: { value: new THREE.Color(visualState.fogColor) },
      skyTint: { value: new THREE.Color(visualState.backgroundColor) },
      skyOpenness: { value: visualState.director.skyOpenness },
      forestOpacity: { value: 0.72 },
      fogStrength: { value: 0.4 },
    }),
    [texture],
  );

  useEffect(() => {
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.ClampToEdgeWrapping;
    texture.anisotropy = 2;
    texture.needsUpdate = true;
  }, [texture]);

  useEffect(() => {
    targetFogColorRef.current.set(visualState.fogColor);
    targetSkyColorRef.current.set(visualState.backgroundColor);
    targetSkyOpennessRef.current = visualState.director.skyOpenness;
    targetForestOpacityRef.current = THREE.MathUtils.clamp(
      0.12 + visualState.director.forestDensity * visualState.director.forestDensity * 0.62,
      0.12,
      0.62,
    );
    targetFogStrengthRef.current = THREE.MathUtils.clamp((visualState.fogDensity - 0.0032) / 0.0088, 0, 1);
  }, [
    visualState.backgroundColor,
    visualState.director.forestDensity,
    visualState.director.skyOpenness,
    visualState.fogColor,
    visualState.fogDensity,
  ]);

  useFrame((_, delta) => {
    if (meshRef.current) meshRef.current.position.copy(camera.position);
    const smoothing = 1 - Math.exp(-Math.min(delta, 0.05) * 1.1);
    uniforms.fogTint.value.lerp(targetFogColorRef.current, smoothing);
    uniforms.skyTint.value.lerp(targetSkyColorRef.current, smoothing);
    uniforms.skyOpenness.value = THREE.MathUtils.lerp(
      uniforms.skyOpenness.value,
      targetSkyOpennessRef.current,
      smoothing,
    );
    uniforms.forestOpacity.value = THREE.MathUtils.lerp(uniforms.forestOpacity.value, targetForestOpacityRef.current, smoothing);
    uniforms.fogStrength.value = THREE.MathUtils.lerp(uniforms.fogStrength.value, targetFogStrengthRef.current, smoothing);
  });

  return (
    <>
      <mesh ref={meshRef} rotation={[0, Math.PI / 2, 0]} renderOrder={-30}>
        <sphereGeometry args={[radius, 48, 28]} />
        <shaderMaterial
          uniforms={uniforms}
          side={THREE.BackSide}
          depthWrite={false}
          toneMapped
          vertexShader={`
          varying vec2 vPanoramaUv;
          varying float vLocalHeight;
          void main() {
            vPanoramaUv = uv;
            vLocalHeight = normalize(position).y * 0.5 + 0.5;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          }
          `}
          fragmentShader={`
          uniform sampler2D panoramaMap;
          uniform vec3 fogTint;
          uniform vec3 skyTint;
          uniform float skyOpenness;
          uniform float forestOpacity;
          uniform float fogStrength;
          varying vec2 vPanoramaUv;
          varying float vLocalHeight;
          void main() {
            vec3 panorama = texture2D(panoramaMap, vPanoramaUv).rgb;
            float luminance = dot(panorama, vec3(0.2126, 0.7152, 0.0722));
            panorama = mix(vec3(luminance), panorama, 0.76);
            panorama *= vec3(0.78, 0.87, 1.0);

            float lowerForest = 1.0 - smoothstep(0.34, 0.58, vLocalHeight);
            float horizonMist = exp(-abs(vLocalHeight - 0.47) * 13.0);
            float seamDistance = min(vPanoramaUv.x, 1.0 - vPanoramaUv.x);
            float seamVeil = 1.0 - smoothstep(0.0, 0.055, seamDistance);
            float haze = clamp(
              lowerForest * 0.72 +
              horizonMist * (0.26 + fogStrength * 0.34) +
              seamVeil * 0.34,
              0.0,
              0.9
            );
            vec3 graded = mix(panorama, fogTint, haze);
            graded = mix(graded, skyTint, smoothstep(0.48, 0.74, vLocalHeight) * 0.12);

            float canopyStart = 0.57 + skyOpenness * 0.075;
            float canopyFade = 1.0 - smoothstep(canopyStart, canopyStart + 0.18, vLocalHeight);
            float groundFade = smoothstep(0.08, 0.28, vLocalHeight);
            float alpha = canopyFade * groundFade * forestOpacity;
            alpha *= 1.0 - seamVeil * 0.28;

            gl_FragColor = vec4(graded, alpha);
            #include <tonemapping_fragment>
            #include <colorspace_fragment>
          }
          `}
          transparent
        />
      </mesh>
      {showDepthPlate ? <CinematicForestDepthPlate visualState={visualState} /> : null}
    </>
  );
}
useTexture.preload(FIRST_WOOD_PANORAMA_PATH);
