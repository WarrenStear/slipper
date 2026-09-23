import { getCurrentCinematicProfile, isCinematicProfileActive } from "../../cinematics/emotionalCinematography";
import { useSettingsStore } from "../../stores/useSettingsStore";
import { useEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import type { Vector3Tuple } from "../../data/slipper3dTypes";
import type { LanternPhase } from "../../lib/lanternNarrative";
import { TERRAIN_BASE_Y } from "../../lib/worldLayout";
import type { NarrativeWorldState } from "./StoryScene";
import type { RenderQualityProfile } from "./renderQuality";
import { resolveLanternDirector } from "./worldDirector/worldDirector";

type MasterPlayerLanternProps = {
  narrativeWorldState: NarrativeWorldState;
  qualityProfile: RenderQualityProfile;
  narrativePhase?: LanternPhase;
  navigationTargetPosition?: Vector3Tuple | null;
  enabled?: boolean;
  reducedEffects?: boolean;
};

const SHADOW_NEAR = 0.18;
const SHADOW_FAR = 18;
const BASE_LOCAL_POSITION = new THREE.Vector3(0.38, -0.4, -1.08);
const BASE_AIM = new THREE.Vector3(0, -0.22, -4.8);

function clamp01(value: number) {
  return Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));
}

function ease(current: number, target: number, delta: number, speed: number) {
  return THREE.MathUtils.lerp(current, target, 1 - Math.exp(-delta * speed));
}

export function MasterPlayerLantern({
  narrativeWorldState,
  qualityProfile,
  narrativePhase,
  navigationTargetPosition = null,
  enabled = true,
  reducedEffects = false,
}: MasterPlayerLanternProps) {
  const { camera, size } = useThree();
  const reducedMotion = useSettingsStore(state => state.reducedMotion);
  const rootRef = useRef<THREE.Group>(null);
  const targetRef = useRef<THREE.Object3D>(null);
  const spotLightRef = useRef<THREE.SpotLight>(null);
  const pointLightRef = useRef<THREE.PointLight>(null);
  const glowRef = useRef<THREE.Mesh>(null);
  const flameRef = useRef<THREE.Mesh>(null);
  const glassRef = useRef<THREE.Mesh>(null);
  const bodyRef = useRef<THREE.Group>(null);

  const currentColorRef = useRef(new THREE.Color("#ffd78a"));
  const targetWorldRef = useRef(new THREE.Vector3());
  const targetLocalRef = useRef(new THREE.Vector3());
  const desiredLocalRef = useRef(BASE_LOCAL_POSITION.clone());
  const currentLocalRef = useRef(BASE_LOCAL_POSITION.clone());
  const velocityRef = useRef(new THREE.Vector3());
  const aimRef = useRef(BASE_AIM.clone());
  const springDeltaRef = useRef(new THREE.Vector3());
  const targetObject = useMemo(() => new THREE.Object3D(), []);
  const guidanceActive = Boolean(navigationTargetPosition && enabled);
  const compactPortrait = size.width < 600 && size.height > size.width;
  const director = useMemo(
    () =>
      resolveLanternDirector({
        narrativeWorldState,
        qualityProfile,
        navigationGuidance: guidanceActive,
      }),
    [guidanceActive, narrativeWorldState, qualityProfile],
  );

  const materials = useMemo(() => {
    const flame = new THREE.MeshBasicMaterial({
      color: "#ffd78a",
      vertexColors: true,
      transparent: true,
      opacity: 0.92,
      depthWrite: false,
      toneMapped: true,
    });
    const glass = new THREE.MeshStandardMaterial({
      color: "#fff0bd",
      emissive: "#ffd78a",
      emissiveIntensity: 0.12,
      roughness: 0.14,
      metalness: 0,
      transparent: true,
      opacity: 0.13,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    const metal = new THREE.MeshStandardMaterial({
      color: "#21160e",
      emissive: "#160c05",
      emissiveIntensity: 0.025,
      roughness: 0.62,
      metalness: 0.54,
    });
    const glow = new THREE.ShaderMaterial({
      uniforms: {
        glowColor: { value: new THREE.Color("#ffd78a") },
        glowOpacity: { value: 0.075 },
      },
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      depthTest: true,
      vertexShader: `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform vec3 glowColor;
        uniform float glowOpacity;
        varying vec2 vUv;
        void main() {
          float radius = length((vUv - 0.5) * 2.0);
          float falloff = pow(1.0 - smoothstep(0.08, 1.0, radius), 2.35);
          gl_FragColor = vec4(glowColor, falloff * glowOpacity);
        }
      `,
    });

    return { flame, glass, metal, glow };
  }, []);

  const geometries = useMemo(() => {
    const glow = new THREE.PlaneGeometry(0.54, 0.54);
    const glass = new THREE.CylinderGeometry(0.115, 0.13, 0.23, 20, 1, true);
    glass.translate(0, 0.01, 0);

    const flame = new THREE.LatheGeometry(
      [
        new THREE.Vector2(0, -0.09),
        new THREE.Vector2(0.043, -0.065),
        new THREE.Vector2(0.052, -0.018),
        new THREE.Vector2(0.038, 0.042),
        new THREE.Vector2(0.017, 0.098),
        new THREE.Vector2(0, 0.135),
      ],
      12,
    );
    const position = flame.getAttribute("position");
    const flameColors: number[] = [];
    const pale = new THREE.Color("#ffd88a");
    const amber = new THREE.Color("#ff9b32");
    const ember = new THREE.Color("#bd3b12");
    const sampleColor = new THREE.Color();
    for (let index = 0; index < position.count; index += 1) {
      const height = THREE.MathUtils.clamp((position.getY(index) + 0.09) / 0.225, 0, 1);
      if (height < 0.58) sampleColor.copy(pale).lerp(amber, height / 0.58);
      else sampleColor.copy(amber).lerp(ember, (height - 0.58) / 0.42);
      flameColors.push(sampleColor.r, sampleColor.g, sampleColor.b);
    }
    flame.setAttribute("color", new THREE.Float32BufferAttribute(flameColors, 3));

    const metalParts: THREE.BufferGeometry[] = [];
    const addMetalPart = (
      geometry: THREE.BufferGeometry,
      translation: Vector3Tuple = [0, 0, 0],
      rotation: Vector3Tuple = [0, 0, 0],
    ) => {
      geometry.rotateX(rotation[0]);
      geometry.rotateY(rotation[1]);
      geometry.rotateZ(rotation[2]);
      geometry.translate(translation[0], translation[1], translation[2]);
      metalParts.push(geometry);
    };

    addMetalPart(new THREE.CylinderGeometry(0.155, 0.185, 0.075, 18), [0, -0.17, 0]);
    addMetalPart(new THREE.CylinderGeometry(0.128, 0.154, 0.075, 18), [0, -0.105, 0]);
    addMetalPart(new THREE.CylinderGeometry(0.118, 0.1, 0.045, 18), [0, 0.145, 0]);
    addMetalPart(new THREE.CylinderGeometry(0.072, 0.094, 0.035, 16), [0, 0.182, 0]);
    addMetalPart(new THREE.TorusGeometry(0.148, 0.011, 7, 28, Math.PI), [0, 0.17, 0]);
    addMetalPart(new THREE.TorusGeometry(0.127, 0.008, 6, 20), [0, -0.09, 0], [Math.PI / 2, 0, 0]);
    addMetalPart(new THREE.TorusGeometry(0.116, 0.008, 6, 20), [0, 0.115, 0], [Math.PI / 2, 0, 0]);
    addMetalPart(new THREE.CylinderGeometry(0.008, 0.008, 0.225, 6), [-0.12, 0.012, 0]);
    addMetalPart(new THREE.CylinderGeometry(0.008, 0.008, 0.225, 6), [0.12, 0.012, 0]);
    addMetalPart(new THREE.CylinderGeometry(0.008, 0.008, 0.225, 6), [0, 0.012, -0.12]);
    addMetalPart(new THREE.CylinderGeometry(0.008, 0.008, 0.225, 6), [0, 0.012, 0.12]);

    const metal = mergeGeometries(metalParts, false) ?? new THREE.BufferGeometry();
    metal.computeVertexNormals();
    metalParts.forEach((part) => part.dispose());

    return { glow, glass, flame, metal };
  }, []);

  useEffect(() => {
    const spot = spotLightRef.current;
    const target = targetRef.current;
    if (!spot || !target) return;

    spot.target = target;
    spot.shadow.camera.near = SHADOW_NEAR;
    spot.shadow.camera.far = SHADOW_FAR;
    spot.shadow.camera.fov = 34;
    spot.shadow.bias = -0.00006;
    spot.shadow.normalBias = 0.016;
    spot.shadow.mapSize.set(qualityProfile.shadowMapSize, qualityProfile.shadowMapSize);
  }, [qualityProfile.shadowMapSize]);

  useEffect(
    () => () => {
      materials.flame.dispose();
      materials.glass.dispose();
      materials.metal.dispose();
      materials.glow.dispose();
      geometries.glow.dispose();
      geometries.glass.dispose();
      geometries.flame.dispose();
      geometries.metal.dispose();
    },
    [geometries, materials],
  );

  useFrame((state, delta) => {
    const root = rootRef.current;
    const target = targetRef.current;
    if (!root || !target) return;

    const elapsed = state.clock.elapsedTime;
    const step = Math.min(delta, 0.05);
    const pressure = clamp01(narrativeWorldState.memoryPressure);
    const depth = clamp01(narrativeWorldState.explorationDepth);
    const activeScale = enabled ? 1 : 0;
    const guideActive = navigationTargetPosition && enabled ? 1 : 0;
    const phaseStability = narrativePhase?.stability ?? 1;
    const phaseIntensity = narrativePhase?.intensity ?? 1;
    const phaseReach = narrativePhase?.reach ?? 1;
    const phaseFlicker = narrativePhase?.flicker ?? 0.2;
    const phaseMovement = narrativePhase?.movement ?? 0.2;
    const instability = clamp01(director.instability * 0.58 + (1 - phaseStability) * 0.42);
    const steadiness = clamp01(director.steadiness * 0.72 + phaseStability * 0.28);
    const air = isCinematicProfileActive() ? getCurrentCinematicProfile().airMovement : 1;
    const environmentalMotion = air < .01 ? 0 : Math.min(1, air * 5);
    const motionScale = environmentalMotion * (reducedMotion ? 0 : reducedEffects ? 0.12 : 1) * (0.38 + phaseMovement * 0.62);
    const baseX = compactPortrait ? 0.14 : BASE_LOCAL_POSITION.x;
    const baseY = compactPortrait ? -0.28 : BASE_LOCAL_POSITION.y;
    const baseZ = compactPortrait ? -1.12 : BASE_LOCAL_POSITION.z;

    desiredLocalRef.current.set(
      baseX + Math.sin(elapsed * 1.38) * (0.009 + instability * 0.014) * motionScale,
      baseY + Math.cos(elapsed * 1.95) * (0.013 + instability * 0.016) * motionScale,
      baseZ + Math.sin(elapsed * 1.1 + 0.4) * (0.009 + instability * 0.011) * motionScale,
    );

    if (navigationTargetPosition) {
      targetWorldRef.current.set(
        navigationTargetPosition[0],
        TERRAIN_BASE_Y + navigationTargetPosition[1] + 1.12,
        navigationTargetPosition[2],
      );
      targetLocalRef.current.copy(targetWorldRef.current);
      camera.worldToLocal(targetLocalRef.current);
      desiredLocalRef.current.x += THREE.MathUtils.clamp(targetLocalRef.current.x * 0.013, -0.052, 0.052);
      desiredLocalRef.current.y += THREE.MathUtils.clamp(targetLocalRef.current.y * 0.008, -0.028, 0.036);
    }

    const spring = 12.5 + depth * 3.1;
    const damping = 1 - Math.exp(-step * (8.2 + pressure * 1.45));
    springDeltaRef.current.copy(desiredLocalRef.current).sub(currentLocalRef.current);
    velocityRef.current.addScaledVector(springDeltaRef.current, spring * step);
    velocityRef.current.multiplyScalar(1 - damping * 0.78);
    currentLocalRef.current.addScaledVector(velocityRef.current, step);

    root.position.copy(camera.position);
    root.quaternion.copy(camera.quaternion);
    root.translateX(currentLocalRef.current.x);
    root.translateY(currentLocalRef.current.y);
    root.translateZ(currentLocalRef.current.z);
    root.rotation.z += Math.sin(elapsed * 1.22) * (0.012 + instability * 0.011) * motionScale;
    root.rotation.x += Math.cos(elapsed * 0.98) * (0.005 + instability * 0.008) * motionScale;

    currentColorRef.current.lerp(director.color, 1 - Math.exp(-step * 4.4));

    materials.flame.color.copy(currentColorRef.current);
    materials.glass.color.copy(currentColorRef.current);
    materials.glass.emissive.copy(currentColorRef.current);
    materials.glow.uniforms.glowColor.value.copy(currentColorRef.current);

    const flamePulse =
      1 +
      Math.sin(elapsed * (6.4 + pressure * 2.8)) * (0.012 + instability * 0.026) * motionScale +
      Math.sin(elapsed * 14.8) * (0.004 + instability * 0.012) * motionScale;
    const baseIntensity =
      activeScale *
      director.lightScale *
      steadiness *
      flamePulse *
      (0.58 + phaseIntensity * 0.52);

    const spotLight = spotLightRef.current;
    if (spotLight) {
      spotLight.color.copy(currentColorRef.current);
      spotLight.intensity = ease(spotLight.intensity, (1.18 + depth * 0.78 + director.guideBoost) * baseIntensity, step, 6.8);
      spotLight.distance = director.reach * (0.62 + phaseReach * 0.46);
      spotLight.angle = THREE.MathUtils.lerp(0.5, 0.32, Number(guideActive) * 0.68);
      spotLight.penumbra = 0.82;
      spotLight.decay = 2.08;
      spotLight.castShadow = Boolean(enabled && director.shadows);
    }

    const pointLight = pointLightRef.current;
    if (pointLight) {
      pointLight.color.copy(currentColorRef.current);
      pointLight.intensity = ease(
        pointLight.intensity,
        (0.32 + depth * 0.16 + director.guideBoost * 0.07) * baseIntensity,
        step,
        5.6,
      );
      pointLight.distance = 4.6 + depth * 0.7;
      pointLight.decay = 2;
    }

    if (navigationTargetPosition) {
      aimRef.current.copy(targetLocalRef.current);
      if (aimRef.current.lengthSq() > 0.001) aimRef.current.normalize().multiplyScalar(5.95);
      aimRef.current.y = THREE.MathUtils.clamp(aimRef.current.y, -0.72, 0.88);
    } else {
      aimRef.current.copy(BASE_AIM);
    }
    target.position.lerp(aimRef.current, 1 - Math.exp(-step * 3.5));

    const body = bodyRef.current;
    if (body) {
      const bodyScale =
        director.bodyScale *
        (0.88 + phaseIntensity * 0.12) *
        (compactPortrait ? 0.46 : 0.5) *
        (enabled ? 1 : 0.001);
      body.scale.setScalar(bodyScale);
    }

    const flame = flameRef.current;
    if (flame) {
      const flickerScale = 0.28 + phaseFlicker * 0.92;
      const width = (0.92 + (flamePulse - 1) * 1.4 * flickerScale + pressure * 0.018) * activeScale;
      const height = (0.94 + (flamePulse - 1) * 2.6 * flickerScale + pressure * 0.026) * activeScale;
      flame.scale.set(width, height, width);
      flame.rotation.y = reducedMotion || reducedEffects ? 0 : Math.sin(elapsed * 2.3) * 0.08 * environmentalMotion;
    }

    const glow = glowRef.current;
    if (glow) {
      glow.scale.setScalar((1.04 + pressure * 0.22 + depth * 0.12) * director.glowScale);
      materials.glow.uniforms.glowOpacity.value = THREE.MathUtils.clamp(
        (0.062 + pressure * 0.052 + director.guideBoost * 0.06) * director.glowScale * activeScale,
        0,
        0.16,
      );
    }

    const glass = glassRef.current;
    if (glass) {
      glass.rotation.y = reducedMotion ? 0 : Math.sin(elapsed * 0.4) * 0.055 * environmentalMotion;
      materials.glass.opacity = THREE.MathUtils.clamp((0.13 + depth * 0.035 - pressure * 0.02) * activeScale, 0, 0.18);
    }
  });

  return (
    <group ref={rootRef} name={`MasterPlayerLanternSingleRealistic:${narrativePhase?.id ?? "legacy"}`} frustumCulled={false} visible={enabled}>
      <primitive ref={targetRef} object={targetObject} position={[0, -0.22, -4.8]} />

      <spotLight ref={spotLightRef} position={[0, 0.03, -0.02]} intensity={1.08} distance={14} angle={0.44} penumbra={0.82} decay={2.08} />
      <pointLight ref={pointLightRef} position={[0, 0.015, 0]} intensity={0.32} distance={4.6} decay={2} castShadow={false} />

      <group ref={bodyRef}>
        <mesh ref={glowRef} geometry={geometries.glow} material={materials.glow} position={[0, 0.01, 0.035]} renderOrder={59} />
        <mesh geometry={geometries.metal} material={materials.metal} renderOrder={60} />
        <mesh ref={flameRef} geometry={geometries.flame} material={materials.flame} position={[0, -0.005, 0]} renderOrder={61} />
        <mesh ref={glassRef} geometry={geometries.glass} material={materials.glass} renderOrder={62} />
      </group>
    </group>
  );
}

export default MasterPlayerLantern;
