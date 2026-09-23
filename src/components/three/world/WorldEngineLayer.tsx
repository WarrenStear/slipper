import { useSceneLook } from "../artDirection/SceneLookContext";
import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import type { Vector3Tuple } from "../../../data/slipper3dTypes";
import { TERRAIN_BASE_Y } from "../../../lib/worldLayout";
import type { NarrativeWorldState } from "../StoryScene";
import type { RenderQualityProfile } from "../renderQuality";
import type { WorldDirectorState } from "../worldDirector/worldDirector";
import type { WorldVisualState } from "../worldVisualState";
import PerfectWorldGround from "./PerfectWorldGround";
import WorldEnvironmentParticles from "./WorldEnvironmentParticles";

type WorldEngineLayerProps = {
  worldDirector: WorldDirectorState;
  visualState: WorldVisualState;
  narrativeWorldState: NarrativeWorldState;
  qualityProfile: RenderQualityProfile;
  navigationTargetPosition?: Vector3Tuple | null;
  enabled?: boolean;
};

function clamp01(value: number) {
  return Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));
}

function PathGuidancePool({
  worldDirector,
  visualState,
  narrativeWorldState,
  qualityProfile,
  navigationTargetPosition,
  enabled,
}: WorldEngineLayerProps) {
  const presentation = useSceneLook();
  const groupRef = useRef<THREE.Group>(null);
  const ringMaterialRef = useRef<THREE.MeshBasicMaterial>(null);
  const moteMaterialRef = useRef<THREE.MeshBasicMaterial>(null);
  const destinationRef = useRef(new THREE.Vector3());
  const target = navigationTargetPosition;
  const lanternColor = worldDirector.lantern.color;
  const pressure = clamp01(narrativeWorldState.memoryPressure);
  const depth = clamp01(narrativeWorldState.explorationDepth);
  const targetOpacity = target && enabled ? 0.16 + depth * 0.1 + worldDirector.lantern.guideBoost * 0.5 : 0;

  useFrame(({ clock }, delta) => {
    const group = groupRef.current;
    if (!group) return;

    const smoothing = 1 - Math.exp(-Math.min(delta, 0.05) * 4.4);
    const destination = destinationRef.current;
    if (target) {
      destination.set(
        target[0],
        TERRAIN_BASE_Y + target[1] + 0.075,
        target[2],
      );
    } else {
      destination.set(0, TERRAIN_BASE_Y + 0.075, 0);
    }
    group.position.lerp(destination, smoothing);
    const ambientMotionEnabled = qualityProfile.particleMultiplier > 0;
    const time = presentation?.time.vegetation ?? clock.elapsedTime;
    group.rotation.z = ambientMotionEnabled ? time * (0.09 + pressure * 0.035) : 0;
    const breathing = ambientMotionEnabled ? 1 + Math.sin(time * 1.35) * 0.035 : 1;
    group.scale.setScalar(breathing);

    if (ringMaterialRef.current) {
      ringMaterialRef.current.color.lerp(lanternColor, smoothing);
      ringMaterialRef.current.opacity = THREE.MathUtils.lerp(ringMaterialRef.current.opacity, targetOpacity, smoothing);
    }

    if (moteMaterialRef.current) {
      moteMaterialRef.current.color.lerp(lanternColor, smoothing);
      moteMaterialRef.current.opacity = THREE.MathUtils.lerp(moteMaterialRef.current.opacity, targetOpacity * 1.6, smoothing);
    }
  });

  if (!enabled) return null;

  return (
    <group ref={groupRef} name="scene-path-guidance">
      <mesh rotation={[-Math.PI / 2, 0, 0]} renderOrder={14}>
        <ringGeometry args={[1.05, 1.34, 96]} />
        <meshBasicMaterial
          ref={ringMaterialRef}
          color={visualState.palette.accent}
          transparent
          opacity={0}
          depthWrite={false}
          side={THREE.DoubleSide}
        />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} renderOrder={15}>
        <circleGeometry args={[0.085, 28]} />
        <meshBasicMaterial ref={moteMaterialRef} color={visualState.palette.emissive} transparent opacity={0} depthWrite={false} />
      </mesh>
    </group>
  );
}

function BoundaryVeil({ worldDirector, visualState, narrativeWorldState, qualityProfile, enabled }: WorldEngineLayerProps) {
  const presentation = useSceneLook();
  const materialRef = useRef<THREE.MeshBasicMaterial>(null);
  const rotationRef = useRef<THREE.Mesh>(null);
  const pressure = clamp01(narrativeWorldState.memoryPressure);
  const depth = clamp01(narrativeWorldState.explorationDepth);
  const targetFogColor = useMemo(
    () => new THREE.Color(worldDirector.environment.fogColor),
    [worldDirector.environment.fogColor],
  );
  const boundaryOpacity = useMemo(() => {
    const qualityScalar = qualityProfile.quality === "low" ? 0.34 : qualityProfile.quality === "medium" ? 0.48 : 0.6;
    return (0.03 + pressure * 0.025 + (1 - depth) * 0.012) * qualityScalar;
  }, [depth, pressure, qualityProfile.quality]);

  useFrame(({ clock }, delta) => {
    if (!enabled) return;
    const smoothing = 1 - Math.exp(-Math.min(delta, 0.05) * 1.7);
    if (rotationRef.current) rotationRef.current.rotation.z = (presentation?.time.vegetation ?? clock.elapsedTime) * 0.011;
    if (materialRef.current) {
      materialRef.current.color.lerp(targetFogColor, smoothing);
      materialRef.current.opacity = THREE.MathUtils.lerp(materialRef.current.opacity, boundaryOpacity, smoothing);
    }
  });

  if (!enabled) return null;

  return (
    <mesh name="scene-boundary-veil" ref={rotationRef} position={[0, -1.18, 0]} rotation={[-Math.PI / 2, 0, 0]} renderOrder={1}>
      <ringGeometry args={[68, 86, 160]} />
      <meshBasicMaterial
        ref={materialRef}
        color={visualState.fogColor}
        transparent
        opacity={boundaryOpacity}
        depthWrite={false}
        side={THREE.DoubleSide}
      />
    </mesh>
  );
}

function StillnessBreathField({ worldDirector, visualState, narrativeWorldState, enabled }: WorldEngineLayerProps) {
  const presentation = useSceneLook();
  const materialRef = useRef<THREE.MeshBasicMaterial>(null);
  const meshRef = useRef<THREE.Mesh>(null);
  const pressure = clamp01(narrativeWorldState.memoryPressure);
  const semanticWeight = clamp01(narrativeWorldState.symbolicWeight);
  const baseOpacity = worldDirector.environment.semanticDensity * (0.008 + semanticWeight * 0.012);
  const targetEmissiveColor = useMemo(
    () => new THREE.Color(visualState.palette.emissive),
    [visualState.palette.emissive],
  );

  useFrame(({ clock }, delta) => {
    if (!enabled) return;
    const smoothing = 1 - Math.exp(-Math.min(delta, 0.05) * 1.9);
    const breath = 1 + Math.sin((presentation?.time.vegetation ?? clock.elapsedTime) * 0.52) * (0.018 + pressure * 0.012);
    if (meshRef.current) meshRef.current.scale.setScalar(breath);
    if (materialRef.current) {
      materialRef.current.color.lerp(targetEmissiveColor, smoothing);
      materialRef.current.opacity = THREE.MathUtils.lerp(materialRef.current.opacity, baseOpacity, smoothing);
    }
  });

  if (!enabled) return null;

  return (
    <mesh name="scene-breath-field" ref={meshRef} position={[0, -1.06, 0]} rotation={[-Math.PI / 2, 0, 0]} renderOrder={2}>
      <circleGeometry args={[32, 128]} />
      <meshBasicMaterial
        ref={materialRef}
        color={visualState.palette.emissive}
        transparent
        opacity={baseOpacity}
        depthWrite={false}
        side={THREE.DoubleSide}
      />
    </mesh>
  );
}

export function WorldEngineLayer(props: WorldEngineLayerProps) {
  const presentation = useSceneLook();
  const { worldDirector, visualState, qualityProfile, enabled: requested = true } = props;
  const enabled = requested && presentation?.look.sceneId !== "epilogue.constellation";
  const ambientEffectsEnabled = enabled && !presentation?.reducedEffects && qualityProfile.particleMultiplier > 0;

  return (
    <>
      <PerfectWorldGround {...props} enabled={enabled} />
      {ambientEffectsEnabled ? (
        <>
          <WorldEnvironmentParticles worldDirector={worldDirector} visualState={visualState} />
          <BoundaryVeil {...props} enabled />
          <StillnessBreathField {...props} enabled />
        </>
      ) : null}
      <PathGuidancePool {...props} enabled={enabled} />
    </>
  );
}

export default WorldEngineLayer;
