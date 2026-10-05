import { useEffect, useMemo, useRef } from "react";
import { useTexture } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import type { Slipper3DEntry, Vector3Tuple } from "../../data/slipper3dTypes.ts";
import { type RenderQualityProfile } from "../../components/three/renderQuality.ts";
import { useSettingsStore } from "../../stores/useSettingsStore.ts";
import { curvedPathPointAt, curvedPathTangentAt, type MazePathSegment } from "../terrain/worldPaths.ts";
import { type NarrativeWorldState } from "../worldTypes.ts";
import { createMoonShaftTexture } from "../atmosphere/atmosphericTextures.ts";
import { guidedPathSegment } from "./routeGeometry.ts";
import { hashString, seededUnit } from "../worldMath.ts";

export const MEMORY_BLOOM_TEXTURE_PATH = "/textures/forest/memory-bloom-v1.png";

export function MemoryBloomLandmark({
  pathSegments,
  activeEntry,
  navigationTargetId,
  narrativeWorldState,
  qualityProfile,
  sampleGroundY,
}: {
  pathSegments: MazePathSegment[];
  activeEntry: Slipper3DEntry;
  navigationTargetId: string | null;
  narrativeWorldState: NarrativeWorldState;
  qualityProfile: RenderQualityProfile;
  sampleGroundY: (x: number, z: number) => number;
}) {
  const texture = useTexture(MEMORY_BLOOM_TEXTURE_PATH);
  const shaftTexture = useMemo(
    () => (typeof document === "undefined" ? null : createMoonShaftTexture()),
    [],
  );
  const groupRef = useRef<THREE.Group>(null);
  const bloomMaterialRef = useRef<THREE.SpriteMaterial>(null);
  const glowMaterialRef = useRef<THREE.SpriteMaterial>(null);
  const shaftMaterialRef = useRef<THREE.SpriteMaterial>(null);
  const reducedMotion = useSettingsStore((state) => state.reducedMotion);
  const pose = useMemo(() => {
    const segment = guidedPathSegment(pathSegments, activeEntry.id, navigationTargetId);
    if (!segment) return null;
    const reverse = navigationTargetId
      ? segment.sourceEntry.id === navigationTargetId
      : segment.targetEntry.id === activeEntry.id;
    const morph = {
      memoryPressure: narrativeWorldState.memoryPressure,
      explorationDepth: narrativeWorldState.explorationDepth,
    };
    // Keep the bloom beyond the opening foreground so it reads as a quiet
    // destination marker instead of occluding the route at portrait viewports.
    const t = reverse ? 0.56 : 0.44;
    const point = curvedPathPointAt(segment, t, morph);
    const tangent = curvedPathTangentAt(segment, t, morph);
    const normal = new THREE.Vector2(-tangent.y, tangent.x);
    const side = seededUnit(hashString(`${segment.key}:memory-bloom`), 17) > 0.5 ? 1 : -1;
    const x = point.x + normal.x * side * 1.08;
    const z = point.y + normal.y * side * 1.08;
    return {
      position: [x, sampleGroundY(x, z) + 1.42, z] as Vector3Tuple,
      groundOffset: -1.41,
    };
  }, [activeEntry.id, narrativeWorldState.explorationDepth, narrativeWorldState.memoryPressure, navigationTargetId, pathSegments, sampleGroundY]);

  useEffect(() => {
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.wrapS = THREE.ClampToEdgeWrapping;
    texture.wrapT = THREE.ClampToEdgeWrapping;
    texture.minFilter = THREE.LinearMipmapLinearFilter;
    texture.magFilter = THREE.LinearFilter;
    texture.needsUpdate = true;
  }, [texture]);

  useEffect(() => () => shaftTexture?.dispose(), [shaftTexture]);

  useFrame(({ clock }) => {
    const group = groupRef.current;
    if (!group || !pose) return;
    const pulse = reducedMotion ? 1 : 1 + Math.sin(clock.elapsedTime * 0.62) * 0.025;
    group.scale.setScalar(pulse);
    group.position.y = pose.position[1] + (reducedMotion ? 0 : Math.sin(clock.elapsedTime * 0.4) * 0.012);
    if (bloomMaterialRef.current) {
      bloomMaterialRef.current.opacity = 0.82 + Math.sin(clock.elapsedTime * 0.48) * (reducedMotion ? 0 : 0.06);
    }
    if (glowMaterialRef.current) {
      glowMaterialRef.current.opacity = qualityProfile.enableBloomProxies
        ? 0.075 + Math.sin(clock.elapsedTime * 0.38) * (reducedMotion ? 0 : 0.018)
        : 0;
    }
    if (shaftMaterialRef.current) {
      shaftMaterialRef.current.opacity = qualityProfile.enableBloomProxies
        ? 0.065 + narrativeWorldState.explorationDepth * 0.018
        : 0;
    }
  });

  if (!pose) return null;

  return (
    <group ref={groupRef} position={pose.position} renderOrder={18}>
      {shaftTexture && qualityProfile.enableBloomProxies ? (
        <sprite position={[0, 3.35, -0.14]} scale={[2.9, 8.4, 1]}>
          <spriteMaterial ref={shaftMaterialRef} map={shaftTexture} color="#9dbddd" transparent opacity={0.04} depthWrite={false} blending={THREE.AdditiveBlending} toneMapped={false} />
        </sprite>
      ) : null}
      <sprite scale={[1.48, 2.22, 1]}>
        <spriteMaterial ref={bloomMaterialRef} map={texture} color="#f1ddb0" transparent opacity={0.86} alphaTest={0.035} depthWrite={false} toneMapped={false} />
      </sprite>
      {qualityProfile.enableBloomProxies ? (
        <sprite position={[0, 0, -0.03]} scale={[1.72, 2.58, 1]}>
          <spriteMaterial ref={glowMaterialRef} map={texture} color="#f3c96e" transparent opacity={0.08} alphaTest={0.012} depthWrite={false} blending={THREE.AdditiveBlending} toneMapped={false} />
        </sprite>
      ) : null}
      <mesh position={[0, pose.groundOffset, 0]} rotation={[-Math.PI / 2, 0, 0]} renderOrder={17}>
        <circleGeometry args={[0.7, 32]} />
        <meshBasicMaterial color="#dfc06d" transparent opacity={0.045} side={THREE.DoubleSide} depthWrite={false} blending={THREE.AdditiveBlending} toneMapped={false} />
      </mesh>
    </group>
  );
}
useTexture.preload(MEMORY_BLOOM_TEXTURE_PATH);
