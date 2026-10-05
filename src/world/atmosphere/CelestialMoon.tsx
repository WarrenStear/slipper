import { useEffect, useMemo, useRef } from "react";
import { useTexture } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { type WorldVisualState } from "../../components/three/worldVisualState.ts";
import { type RenderQualityProfile } from "../../components/three/renderQuality.ts";
import { anchorMoonOffsetToOpening } from "./openingMoon.ts";

export const MOON_ALBEDO_PATH = "/textures/environment/moon-albedo-v1.png";

export function CelestialMoon({
  visualState,
  qualityProfile,
  radius,
}: {
  visualState: WorldVisualState;
  qualityProfile: RenderQualityProfile;
  radius: number;
}) {
  const texture = useTexture(MOON_ALBEDO_PATH);
  const groupRef = useRef<THREE.Group>(null);
  const discMaterialRef = useRef<THREE.ShaderMaterial>(null);
  const haloMaterialRef = useRef<THREE.ShaderMaterial>(null);
  const distance = Math.max(42, radius * 0.88);
  const moonOffsetRef = useRef(new THREE.Vector3(...visualState.moonPosition).normalize().multiplyScalar(distance));
  const targetOffsetRef = useRef(moonOffsetRef.current.clone());
  const moonRightRef = useRef(new THREE.Vector3());
  const moonUpRef = useRef(new THREE.Vector3());
  const hasAnchoredMoonRef = useRef(false);
  const targetColor = useMemo(
    () => new THREE.Color(visualState.moonColor),
    [visualState.moonColor],
  );
  const targetDiscColor = useMemo(
    () => new THREE.Color("#eef1e8").lerp(targetColor, 0.22),
    [targetColor],
  );
  const moonUniforms = useMemo(
    () => ({
      moonMap: { value: texture },
      moonColor: { value: new THREE.Color("#eef1e8").lerp(new THREE.Color(visualState.moonColor), 0.22) },
      moonOpacity: { value: 0.9 },
      veilStrength: { value: qualityProfile.enableBloomProxies ? 0.18 : 0.08 },
      time: { value: 0 },
    }),
    [texture],
  );
  const haloUniforms = useMemo(
    () => ({
      haloColor: { value: new THREE.Color(visualState.moonColor) },
      haloOpacity: { value: qualityProfile.enableBloomProxies ? 0.056 : 0.026 },
      time: { value: 0 },
    }),
    [],
  );
  const moonScale = qualityProfile.quality === "low" ? 0.78 : 0.92;

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
    hasAnchoredMoonRef.current = false;
  }, [distance, visualState.moonPosition]);

  useFrame(({ camera, clock }, delta) => {
    const group = groupRef.current;
    if (!group) return;

    const smoothing = 1 - Math.exp(-Math.min(delta, 0.05) * 1.7);
    if (!hasAnchoredMoonRef.current) {
      anchorMoonOffsetToOpening(
        camera,
        visualState.moonPosition,
        distance,
        targetOffsetRef.current,
        moonRightRef.current,
        moonUpRef.current,
      );
      moonOffsetRef.current.copy(targetOffsetRef.current);
      hasAnchoredMoonRef.current = true;
    }
    moonOffsetRef.current.lerp(targetOffsetRef.current, smoothing);
    group.position.copy(camera.position).add(moonOffsetRef.current);
    group.lookAt(camera.position);

    const fogTransmittance = THREE.MathUtils.clamp(1 - visualState.fogDensity * 27, 0.64, 0.88);
    moonUniforms.moonColor.value.lerp(targetDiscColor, smoothing);
    moonUniforms.moonOpacity.value = THREE.MathUtils.lerp(
      moonUniforms.moonOpacity.value,
      fogTransmittance,
      smoothing,
    );
    moonUniforms.veilStrength.value = THREE.MathUtils.lerp(
      moonUniforms.veilStrength.value,
      qualityProfile.enableBloomProxies ? 0.18 : 0.08,
      smoothing,
    );
    moonUniforms.time.value = qualityProfile.particleMultiplier > 0 ? clock.elapsedTime : 0;
    if (haloMaterialRef.current) {
      haloMaterialRef.current.uniforms.haloColor.value.lerp(targetColor, smoothing);
      const breath = qualityProfile.particleMultiplier > 0
        ? 0.056 + Math.sin(clock.elapsedTime * 0.19) * 0.005
        : 0.052;
      haloMaterialRef.current.uniforms.haloOpacity.value = THREE.MathUtils.lerp(
        haloMaterialRef.current.uniforms.haloOpacity.value,
        (qualityProfile.enableBloomProxies ? breath : 0.026) * fogTransmittance,
        smoothing,
      );
      haloMaterialRef.current.uniforms.time.value = moonUniforms.time.value;
    }
  });

  return (
    <group ref={groupRef} scale={[moonScale, moonScale, moonScale]}>
      <mesh renderOrder={-4}>
        <circleGeometry args={[0.74, 48]} />
        <shaderMaterial
          ref={discMaterialRef}
          uniforms={moonUniforms}
          transparent
          alphaTest={0.015}
          depthWrite={false}
          fog={false}
          toneMapped={false}
          vertexShader={`
            varying vec2 vMoonUv;
            void main() {
              vMoonUv = uv;
              gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
            }
          `}
          fragmentShader={`
            uniform sampler2D moonMap;
            uniform vec3 moonColor;
            uniform float moonOpacity;
            uniform float veilStrength;
            uniform float time;
            varying vec2 vMoonUv;

            float moonHash(vec2 point) {
              return fract(sin(dot(point, vec2(127.1, 311.7))) * 43758.5453);
            }

            float moonNoise(vec2 point) {
              vec2 cell = floor(point);
              vec2 local = fract(point);
              local = local * local * (3.0 - 2.0 * local);
              return mix(
                mix(moonHash(cell), moonHash(cell + vec2(1.0, 0.0)), local.x),
                mix(moonHash(cell + vec2(0.0, 1.0)), moonHash(cell + vec2(1.0, 1.0)), local.x),
                local.y
              );
            }

            void main() {
              vec2 point = (vMoonUv - 0.5) * 2.0;
              float radiusSquared = dot(point, point);
              if (radiusSquared > 1.0) discard;

              vec4 albedoSample = texture2D(moonMap, vMoonUv);
              float sphereDepth = sqrt(max(0.0, 1.0 - radiusSquared));
              vec3 sphereNormal = normalize(vec3(point, sphereDepth));
              vec3 lightDirection = normalize(vec3(-0.24, 0.18, 0.96));
              float diffuse = clamp(dot(sphereNormal, lightDirection), 0.0, 1.0);
              float limb = smoothstep(0.02, 0.34, sphereDepth);

              float albedoLuminance = dot(albedoSample.rgb, vec3(0.2126, 0.7152, 0.0722));
              vec3 lunarAlbedo = mix(vec3(albedoLuminance), albedoSample.rgb, 0.74);
              float veilNoise = moonNoise(vec2(vMoonUv.x * 3.2 + time * 0.006, vMoonUv.y * 11.0));
              float veilBand = smoothstep(0.58, 0.8, veilNoise + sin((vMoonUv.y + vMoonUv.x * 0.16) * 34.0) * 0.1);
              float illumination = (0.48 + diffuse * 0.52) * mix(1.0, 0.68, veilBand * veilStrength);
              vec3 color = lunarAlbedo * moonColor * illumination;
              float alpha = albedoSample.a * limb * moonOpacity;

              gl_FragColor = vec4(color, alpha);
              #include <colorspace_fragment>
            }
          `}
        />
      </mesh>
      <mesh position={[0, 0, -0.025]} renderOrder={-5}>
        <circleGeometry args={[2.9, 44]} />
        <shaderMaterial
          ref={haloMaterialRef}
          uniforms={haloUniforms}
          transparent
          blending={THREE.AdditiveBlending}
          depthWrite={false}
          toneMapped={false}
          vertexShader={`
            varying vec2 vHaloUv;
            void main() {
              vHaloUv = uv;
              gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
            }
          `}
          fragmentShader={`
            uniform vec3 haloColor;
            uniform float haloOpacity;
            uniform float time;
            varying vec2 vHaloUv;
            void main() {
              vec2 point = (vHaloUv - 0.5) * 2.0;
              float radius = length(point);
              float falloff = pow(1.0 - smoothstep(0.035, 1.0, radius), 3.1);
              float asymmetry = 0.86 + 0.14 * sin(point.y * 11.0 + point.x * 4.0 + time * 0.035);
              float innerCorona = 1.0 - smoothstep(0.06, 0.34, radius);
              float alpha = (falloff * asymmetry + innerCorona * 0.24) * haloOpacity;
              gl_FragColor = vec4(haloColor, alpha);
              #include <colorspace_fragment>
            }
          `}
        />
      </mesh>
    </group>
  );
}
useTexture.preload(MOON_ALBEDO_PATH);
