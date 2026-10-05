import { useEffect, useMemo, useRef } from "react";
import { useTexture } from "@react-three/drei";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { type WorldVisualState } from "../../components/three/worldVisualState.ts";

export const FIRST_WOOD_DEPTH_PLATE_PATH = "/textures/environment/forest-sky-horizon-v1.webp";

export function CinematicForestDepthPlate({ visualState }: { visualState: WorldVisualState }) {
  const texture = useTexture(FIRST_WOOD_DEPTH_PLATE_PATH);
  const meshRef = useRef<THREE.Mesh>(null);
  const offsetRef = useRef(new THREE.Vector3());
  const settlingTimeRef = useRef(0);
  const { camera } = useThree();
  const targetFogColorRef = useRef(new THREE.Color(visualState.fogColor));
  const targetSkyColorRef = useRef(new THREE.Color(visualState.moonColor));
  const targetOpacityRef = useRef(0.7);
  const targetFogStrengthRef = useRef(0.4);
  const uniforms = useMemo(
    () => ({
      plateMap: { value: texture },
      fogTint: { value: new THREE.Color(visualState.fogColor) },
      skyTint: { value: new THREE.Color(visualState.moonColor) },
      plateOpacity: { value: 0.7 },
      fogStrength: { value: 0.4 },
    }),
    [texture],
  );

  useEffect(() => {
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.wrapS = THREE.ClampToEdgeWrapping;
    texture.wrapT = THREE.ClampToEdgeWrapping;
    texture.minFilter = THREE.LinearMipmapLinearFilter;
    texture.magFilter = THREE.LinearFilter;
    texture.anisotropy = 2;
    texture.needsUpdate = true;
  }, [texture]);

  useEffect(() => {
    targetFogColorRef.current.set(visualState.fogColor);
    targetSkyColorRef.current.set(visualState.moonColor);
    targetOpacityRef.current = 0.58 + visualState.director.skyOpenness * 0.2;
    targetFogStrengthRef.current = THREE.MathUtils.clamp((visualState.fogDensity - 0.0032) / 0.0088, 0, 1);
  }, [visualState.director.skyOpenness, visualState.fogColor, visualState.fogDensity, visualState.moonColor]);

  useFrame((_, delta) => {
    const mesh = meshRef.current;
    if (!mesh) return;

    const smoothing = 1 - Math.exp(-Math.min(delta, 0.05) * 1.25);
    uniforms.fogTint.value.lerp(targetFogColorRef.current, smoothing);
    uniforms.skyTint.value.lerp(targetSkyColorRef.current, smoothing);
    uniforms.plateOpacity.value = THREE.MathUtils.lerp(
      uniforms.plateOpacity.value,
      targetOpacityRef.current,
      smoothing,
    );
    uniforms.fogStrength.value = THREE.MathUtils.lerp(uniforms.fogStrength.value, targetFogStrengthRef.current, smoothing);

    if (settlingTimeRef.current < 1.2) {
      settlingTimeRef.current += Math.min(delta, 0.05);
      camera.getWorldDirection(offsetRef.current);
      offsetRef.current.y = THREE.MathUtils.clamp(offsetRef.current.y, -0.04, 0.08);
      offsetRef.current.normalize().multiplyScalar(122);
      offsetRef.current.y -= 8.6;
      mesh.position.copy(camera.position).add(offsetRef.current);
      mesh.lookAt(camera.position);
      return;
    }
    mesh.position.copy(camera.position).add(offsetRef.current);
  });

  return (
    <mesh ref={meshRef} renderOrder={-28}>
      <planeGeometry args={[178, 100]} />
      <shaderMaterial
        uniforms={uniforms}
        transparent
        depthWrite={false}
        toneMapped
        vertexShader={`
          varying vec2 vPlateUv;
          void main() {
            vPlateUv = uv;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          }
        `}
        fragmentShader={`
          uniform sampler2D plateMap;
          uniform vec3 fogTint;
          uniform vec3 skyTint;
          uniform float plateOpacity;
          uniform float fogStrength;
          varying vec2 vPlateUv;
          void main() {
            vec3 plate = texture2D(plateMap, vPlateUv).rgb;
            float luminance = dot(plate, vec3(0.2126, 0.7152, 0.0722));
            plate = mix(vec3(luminance), plate, 0.8);

            float lowerBlend = 1.0 - smoothstep(0.04, 0.27, vPlateUv.y);
            float horizonHaze = 1.0 - smoothstep(0.0, 0.17, abs(vPlateUv.y - 0.47));
            float skyBlend = smoothstep(0.56, 0.9, vPlateUv.y);
            plate = mix(plate, fogTint, lowerBlend * 0.42 + horizonHaze * (0.2 + fogStrength * 0.34));
            plate = mix(plate, skyTint, skyBlend * 0.055);

            vec2 fromCenter = abs(vPlateUv - 0.5) * 2.0;
            float sideFeather = 1.0 - smoothstep(0.7, 1.0, fromCenter.x);
            float topFeather = 1.0 - smoothstep(0.76, 1.0, vPlateUv.y);
            float bottomFeather = smoothstep(0.01, 0.13, vPlateUv.y);
            float alpha = sideFeather * topFeather * bottomFeather * plateOpacity;
            gl_FragColor = vec4(plate, alpha);
            #include <tonemapping_fragment>
            #include <colorspace_fragment>
          }
        `}
      />
    </mesh>
  );
}

