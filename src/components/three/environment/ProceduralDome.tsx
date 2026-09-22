import { useSettingsStore } from "../../../stores/useSettingsStore";
import { useEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import type { Slipper3DEntry } from "../../../data/slipper3dTypes";
import type { NarrativeWorldState } from "../StoryScene";
import type { WorldVisualState } from "../worldVisualState";
import type { RenderQualityProfile } from "../renderQuality";

export function ProceduralDome({
  entry,
  visualState,
  radius,
  narrativeWorldState,
  qualityProfile,
}: {
  entry: Slipper3DEntry;
  visualState: WorldVisualState;
  radius: number;
  narrativeWorldState: NarrativeWorldState;
  qualityProfile: RenderQualityProfile;
}) {
  const reducedMotion = useSettingsStore((state) => state.reducedMotion);
  const materialRef = useRef<THREE.ShaderMaterial>(null);
  const meshRef = useRef<THREE.Mesh>(null);
  const { camera } = useThree();
  const targetZenithRef = useRef(new THREE.Color(visualState.backgroundColor));
  const targetUpperRef = useRef(new THREE.Color(visualState.palette.fog));
  const targetHorizonRef = useRef(new THREE.Color(visualState.fogColor));
  const targetCloudRef = useRef(new THREE.Color(visualState.moonColor));
  const targetSkyOpennessRef = useRef(visualState.director.skyOpenness);
  const targetCloudAmountRef = useRef(0.48);
  const targetCloudDetailRef = useRef(0);
  const targetMoodWeightRef = useRef(visualState.domeOpacity);
  const [authoredLow, authoredMid, authoredHigh = visualState.moonColor] = entry.engine3d.environmentGradient ?? [
    visualState.backgroundColor,
    visualState.palette.fog,
    visualState.moonColor,
  ];
  const uniforms = useMemo(
    () => ({
      colorZenith: { value: new THREE.Color(visualState.backgroundColor) },
      colorUpper: { value: new THREE.Color(visualState.palette.fog) },
      colorHorizon: { value: new THREE.Color(visualState.fogColor) },
      cloudColor: { value: new THREE.Color(visualState.moonColor) },
      skyOpenness: { value: visualState.director.skyOpenness },
      cloudAmount: { value: 0.48 },
      cloudDetail: { value: 0 },
      moodWeight: { value: visualState.domeOpacity },
      journeyDepth: { value: narrativeWorldState.explorationDepth },
      fireWaterBalance: { value: narrativeWorldState.fireWaterBalance },
      memoryPressure: { value: narrativeWorldState.memoryPressure },
      time: { value: 0 },
    }),
    [],
  );

  useEffect(() => {
    targetZenithRef.current
      .set(visualState.backgroundColor)
      .lerp(new THREE.Color(authoredLow), 0.26)
      .multiplyScalar(0.74);
    targetUpperRef.current
      .set(visualState.palette.fog)
      .lerp(new THREE.Color(authoredMid), 0.24)
      .lerp(new THREE.Color(visualState.backgroundColor), 0.34);
    targetHorizonRef.current
      .set(visualState.fogColor)
      .lerp(new THREE.Color(authoredHigh), 0.075)
      .lerp(new THREE.Color(visualState.moonColor), 0.04 + visualState.director.skyOpenness * 0.03);
    targetCloudRef.current.set(visualState.moonColor).multiplyScalar(0.62);
    targetSkyOpennessRef.current = visualState.director.skyOpenness;
    targetCloudAmountRef.current = THREE.MathUtils.clamp(
      0.34 + visualState.weatherIntensity * 0.34 + (1 - visualState.director.skyOpenness) * 0.14,
      0.3,
      0.72,
    );
    targetCloudDetailRef.current =
      qualityProfile.particleMultiplier <= 0 || qualityProfile.quality === "low"
        ? 0
        : qualityProfile.quality === "medium"
          ? 0.55
          : 1;
    targetMoodWeightRef.current = visualState.domeOpacity;
  }, [
    authoredHigh,
    authoredLow,
    authoredMid,
    qualityProfile.particleMultiplier,
    qualityProfile.quality,
    visualState.backgroundColor,
    visualState.director.skyOpenness,
    visualState.domeOpacity,
    visualState.fogColor,
    visualState.moonColor,
    visualState.palette.fog,
    visualState.weatherIntensity,
  ]);

  useFrame(({ clock }, delta) => {
    if (meshRef.current) meshRef.current.position.copy(camera.position);
    const lerpSpeed = 1 - Math.exp(-Math.min(delta, 0.05) * 1.35);
    uniforms.colorZenith.value.lerp(targetZenithRef.current, lerpSpeed);
    uniforms.colorUpper.value.lerp(targetUpperRef.current, lerpSpeed);
    uniforms.colorHorizon.value.lerp(targetHorizonRef.current, lerpSpeed);
    uniforms.cloudColor.value.lerp(targetCloudRef.current, lerpSpeed);
    uniforms.skyOpenness.value = THREE.MathUtils.lerp(uniforms.skyOpenness.value, targetSkyOpennessRef.current, lerpSpeed);
    uniforms.cloudAmount.value = THREE.MathUtils.lerp(uniforms.cloudAmount.value, targetCloudAmountRef.current, lerpSpeed);
    uniforms.cloudDetail.value = THREE.MathUtils.lerp(uniforms.cloudDetail.value, targetCloudDetailRef.current, lerpSpeed);
    uniforms.moodWeight.value = THREE.MathUtils.lerp(uniforms.moodWeight.value, targetMoodWeightRef.current, lerpSpeed);
    uniforms.journeyDepth.value = THREE.MathUtils.lerp(uniforms.journeyDepth.value, narrativeWorldState.explorationDepth, lerpSpeed);
    uniforms.fireWaterBalance.value = THREE.MathUtils.lerp(uniforms.fireWaterBalance.value, narrativeWorldState.fireWaterBalance, lerpSpeed);
    uniforms.memoryPressure.value = THREE.MathUtils.lerp(uniforms.memoryPressure.value, narrativeWorldState.memoryPressure, lerpSpeed);
    uniforms.time.value = !reducedMotion && qualityProfile.particleMultiplier > 0 ? clock.elapsedTime : 0;
  });

  return (
    <mesh ref={meshRef} renderOrder={-40} frustumCulled={false}>
      <sphereGeometry args={[radius, 40, 20]} />
      <shaderMaterial
        ref={materialRef}
        side={THREE.BackSide}
        depthWrite={false}
        depthTest={false}
        toneMapped
        uniforms={uniforms}
        vertexShader={`
          varying vec3 vSkyDirection;
          void main() {
            vSkyDirection = normalize(position);
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          }
        `}
        fragmentShader={`
          uniform vec3 colorZenith;
          uniform vec3 colorUpper;
          uniform vec3 colorHorizon;
          uniform vec3 cloudColor;
          uniform float skyOpenness;
          uniform float cloudAmount;
          uniform float cloudDetail;
          uniform float moodWeight;
          uniform float journeyDepth;
          uniform float fireWaterBalance;
          uniform float memoryPressure;
          uniform float time;
          varying vec3 vSkyDirection;

          float skyHash(vec2 point) {
            point = fract(point * vec2(123.34, 456.21));
            point += dot(point, point + 45.32);
            return fract(point.x * point.y);
          }

          float skyNoise(vec2 point) {
            vec2 cell = floor(point);
            vec2 local = fract(point);
            local = local * local * (3.0 - 2.0 * local);
            return mix(
              mix(skyHash(cell), skyHash(cell + vec2(1.0, 0.0)), local.x),
              mix(skyHash(cell + vec2(0.0, 1.0)), skyHash(cell + vec2(1.0, 1.0)), local.x),
              local.y
            );
          }

          float skyFbmLow(vec2 point) {
            float value = skyNoise(point) * 0.62;
            value += skyNoise(point * 2.03 + vec2(7.13, 3.71)) * 0.3;
            return value;
          }

          float skyFbmHigh(vec2 point) {
            float value = 0.0;
            float amplitude = 0.56;
            for (int octave = 0; octave < 4; octave++) {
              value += skyNoise(point) * amplitude;
              point = point * 2.03 + vec2(7.13, 3.71);
              amplitude *= 0.48;
            }
            return value;
          }

          void main() {
            vec3 direction = normalize(vSkyDirection);
            float height = direction.y;
            float horizon = exp(-abs(height + 0.025) * 8.8);
            float upperBlend = smoothstep(-0.12, 0.38, height);
            float zenithBlend = smoothstep(0.2, 0.94, height);
            vec3 sky = mix(colorHorizon, colorUpper, upperBlend);
            sky = mix(sky, colorZenith, zenithBlend * (0.82 + skyOpenness * 0.12));

            vec3 fireTint = vec3(1.0, 0.36, 0.16);
            vec3 waterTint = vec3(0.22, 0.48, 0.76);
            vec3 memoryTint = vec3(0.42, 0.32, 0.62);
            float axis = fireWaterBalance * 0.5 + 0.5;
            vec3 axisTint = mix(waterTint, fireTint, clamp(axis, 0.0, 1.0));

            if (cloudDetail > 0.01) {
              vec2 cloudUv =
                direction.xz * (2.7 / (0.72 + max(height, 0.0))) +
                vec2(height * 0.42, -height * 0.28) +
                vec2(time * 0.0017, time * 0.00042);
              float cloudNoise = skyFbmLow(cloudUv);
              if (cloudDetail > 0.78) {
                vec2 warp = vec2(skyNoise(cloudUv * .58 + 8.4), skyNoise(cloudUv * .58 - 3.7)) - .5;
                cloudNoise = skyFbmHigh(cloudUv + warp * .72);
              }
              float cloudThreshold = 0.68 - cloudAmount * 0.24;
              float clouds = smoothstep(cloudThreshold, cloudThreshold + 0.26, cloudNoise);
              float cloudZone = smoothstep(-0.1, 0.08, height) * (1.0 - smoothstep(0.64, 0.94, height));
              // Broad irregular strata instead of equally spaced horizontal bands.
              float strata = .82 + .18 * skyNoise(vec2(cloudUv.x * .54, height * 3.1 + cloudNoise));
              clouds *= cloudZone * strata;
              float moonFacing = pow(max(0., dot(direction, normalize(vec3(-.42, .56, -.7)))), 10.);
              float silverEdge = (1. - smoothstep(.24, .68, clouds)) * moonFacing;
              vec3 litCloud = mix(colorUpper * .84, cloudColor, .28 + horizon * .12 + silverEdge * .2);
              sky = mix(sky, litCloud, clouds * (.14 + cloudAmount * .16));
            }

            float horizonVeil = horizon * (0.1 + (1.0 - skyOpenness) * 0.13);
            sky = mix(sky, colorHorizon, horizonVeil);
            sky = mix(sky, axisTint, abs(fireWaterBalance) * journeyDepth * 0.075);
            sky = mix(sky, memoryTint, memoryPressure * 0.055);
            sky *= 1.0 - journeyDepth * (0.025 + moodWeight * 0.035);

            float dither = (skyHash(gl_FragCoord.xy) - 0.5) / 255.0;
            sky += dither;

            gl_FragColor = vec4(sky, 1.0);
            #include <tonemapping_fragment>
            #include <colorspace_fragment>
          }
        `}
      />
    </mesh>
  );
}
