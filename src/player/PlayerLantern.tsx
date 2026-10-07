import { useEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { useSceneLook } from "../components/three/artDirection/SceneLookContext";
import { HeroAssetSlot } from "../components/three/actors/HeroAssetSlot";
import { resolveLanternDirector } from "../components/three/worldDirector/worldDirector";
import { getCurrentCinematicProfile, isCinematicProfileActive } from "../cinematics/emotionalCinematography";
import { useSettingsStore } from "../stores/useSettingsStore";
import { TERRAIN_BASE_Y } from "../lib/worldLayout";
import type { Vector3Tuple } from "../data/slipper3dTypes";
import type { LanternPhase } from "../lib/lanternNarrative";
import type { NarrativeWorldState } from "../world/worldTypes";
import type { RenderQualityProfile } from "../components/three/renderQuality";
import { createReviewedPlayerLanternGeometries } from "./playerLanternGeometry.ts";
import { createPlayerLanternMaterials } from "./playerLanternMaterials.ts";
import { createPlayerLanternPose, advancePlayerLanternPose } from "./playerLanternPose.ts";
import { configurePlayerLanternSpot, createPlayerLanternResourceRelease } from "./playerLanternResources.ts";

export type PlayerLanternProps = {
  narrativeWorldState: NarrativeWorldState;
  qualityProfile: RenderQualityProfile;
  narrativePhase?: LanternPhase;
  navigationTargetPosition?: Vector3Tuple | null;
  enabled?: boolean;
  reducedEffects?: boolean;
  /** Review can inject the explicit original baseline without changing ownership. */
  geometryFactory?: () => ReturnType<typeof createReviewedPlayerLanternGeometries>;
};

/** The existing carried frame owner. StorySceneWithMasterLantern retains the
 * canonical ownership gate and interpretation; this owner applies pose/light
 * output and releases only its own geometry/material resources.
 */
export function PlayerLantern({ narrativeWorldState, qualityProfile, narrativePhase,
  navigationTargetPosition = null, enabled = true, reducedEffects = false,
  geometryFactory = createReviewedPlayerLanternGeometries }: PlayerLanternProps) {
  const presentation = useSceneLook();
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
  const targetLocal = useMemo(() => new THREE.Vector3(), []);
  const targetObject = useMemo(() => new THREE.Object3D(), []);
  const pose = useMemo(createPlayerLanternPose, []);
  const materials = useMemo(createPlayerLanternMaterials, []);
  const geometries = useMemo(geometryFactory, [geometryFactory]);
  const guidanceActive = Boolean(navigationTargetPosition && enabled);
  const compactPortrait = size.width < 600 && size.height > size.width;
  const director = useMemo(() => resolveLanternDirector({ narrativeWorldState, qualityProfile,
    navigationGuidance: guidanceActive }), [guidanceActive, narrativeWorldState, qualityProfile]);

  useEffect(() => {
    const spot = spotLightRef.current, target = targetRef.current;
    if (spot && target) configurePlayerLanternSpot(spot, target, qualityProfile.shadowMapSize);
  }, [qualityProfile.shadowMapSize]);
  useEffect(() => createPlayerLanternResourceRelease(geometries, materials), [geometries, materials]);

  // CameraController remains the final camera writer at -1. This unchanged
  // default-priority subscriber follows that camera and the shared look at -3.
  useFrame((state, delta) => {
    const root = rootRef.current, target = targetRef.current;
    if (!root || !target) return;
    if (navigationTargetPosition) {
      targetLocal.set(navigationTargetPosition[0], TERRAIN_BASE_Y + navigationTargetPosition[1] + 1.12,
        navigationTargetPosition[2]);
      camera.worldToLocal(targetLocal);
    }
    advancePlayerLanternPose(pose, {
      elapsed: presentation?.time.flame ?? state.clock.elapsedTime, delta,
      pressure: narrativeWorldState.memoryPressure, depth: narrativeWorldState.explorationDepth,
      enabled, compactPortrait, reducedMotion, reducedEffects, hasPresentation: Boolean(presentation),
      sharedFlameMotion: presentation?.motion.flame ?? 0,
      airMovement: isCinematicProfileActive() ? getCurrentCinematicProfile().airMovement : 1,
      phase: narrativePhase, style: director, navigationLocal: navigationTargetPosition ? targetLocal : null,
    });
    root.position.copy(camera.position); root.quaternion.copy(camera.quaternion);
    root.translateX(pose.position.x); root.translateY(pose.position.y); root.translateZ(pose.position.z);
    root.rotation.z += pose.tiltZ; root.rotation.x += pose.tiltX;
    target.position.copy(pose.target);
    materials.flame.color.copy(pose.color).multiplyScalar(3.2);
    materials.glow.uniforms.glowColor.value.copy(pose.color);
    const spot = spotLightRef.current;
    if (spot) {
      spot.color.copy(pose.color); spot.intensity = pose.spotIntensity; spot.distance = pose.spotDistance;
      spot.angle = pose.spotAngle; spot.penumbra = .82; spot.decay = 2.08; spot.castShadow = pose.spotShadow;
    }
    const point = pointLightRef.current;
    if (point) {
      point.color.copy(pose.color); point.intensity = pose.pointIntensity;
      point.distance = pose.pointDistance; point.decay = 2;
    }
    bodyRef.current?.scale.setScalar(pose.bodyScale);
    const flame = flameRef.current;
    if (flame) { flame.scale.copy(pose.flameScale); flame.rotation.y = pose.flameRotation; }
    glowRef.current?.scale.setScalar(pose.glowScale);
    materials.glow.uniforms.glowOpacity.value = pose.glowOpacity;
    if (glassRef.current) {
      glassRef.current.rotation.y = pose.glassRotation; materials.glass.opacity = pose.glassOpacity;
    }
  });

  return <group ref={rootRef} name={`MasterPlayerLanternSingleRealistic:${narrativePhase?.id ?? "legacy"}`}
    frustumCulled={false} visible={enabled}>
    <primitive ref={targetRef} object={targetObject} position={[0, -.22, -4.8]} />
    <spotLight ref={spotLightRef} position={[0, .03, -.02]} intensity={1.08} distance={14}
      angle={.44} penumbra={.82} decay={2.08} />
    <pointLight ref={pointLightRef} position={[0, .015, 0]} intensity={.32} distance={4.6}
      decay={2} castShadow={false} />
    <group ref={bodyRef}>
      <mesh ref={glowRef} geometry={geometries.glow} material={materials.glow}
        position={[0, .01, .035]} renderOrder={59} />
      <HeroAssetSlot id="master-lantern" assetPosition={[0, -.208, 0]} assetScale={.44}>
        <mesh geometry={geometries.metal} material={materials.metal} renderOrder={60} />
      </HeroAssetSlot>
      <mesh name="master-lantern-flame" ref={flameRef} geometry={geometries.flame}
        material={materials.flame} position={[0, -.005, 0]} renderOrder={61} />
      <mesh ref={glassRef} geometry={geometries.glass} material={materials.glass} renderOrder={62} />
    </group>
  </group>;
}

export default PlayerLantern;
