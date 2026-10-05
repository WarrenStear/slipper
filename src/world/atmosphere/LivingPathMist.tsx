import { useEffect, useLayoutEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import type { Slipper3DEntry, Vector3Tuple } from "../../data/slipper3dTypes.ts";
import { type RenderQualityProfile } from "../../components/three/renderQuality.ts";
import { useSettingsStore } from "../../stores/useSettingsStore.ts";
import { curvedPathPointAt, curvedPathTangentAt, type MazePathSegment } from "../terrain/worldPaths.ts";
import { type NarrativeWorldState } from "../worldTypes.ts";
import { createSoftMistTexture } from "./atmosphericTextures.ts";
import { guidedPathSegment } from "../guidance/routeGeometry.ts";
import { hashString, seededUnit } from "../worldMath.ts";

export type LivingMistPatch = {
  position: Vector3Tuple;
  rotation: number;
  scale: [number, number, number];
};

export function LivingPathMist({
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
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const materialRef = useRef<THREE.MeshBasicMaterial>(null);
  const dummyRef = useRef(new THREE.Object3D());
  const reducedMotion = useSettingsStore((state) => state.reducedMotion);
  const texture = useMemo(
    () => (typeof document === "undefined" ? null : createSoftMistTexture()),
    [],
  );
  const patchCount = qualityProfile.weatherLayerMultiplier < 0.25
    ? 0
    : qualityProfile.quality === "medium"
      ? 2
      : 3;
  const patches = useMemo<LivingMistPatch[]>(() => {
    const segment = guidedPathSegment(pathSegments, activeEntry.id, navigationTargetId);
    if (!segment || patchCount === 0) return [];

    const reverse = navigationTargetId
      ? segment.sourceEntry.id === navigationTargetId
      : segment.targetEntry.id === activeEntry.id;
    const morph = {
      memoryPressure: narrativeWorldState.memoryPressure,
      explorationDepth: narrativeWorldState.explorationDepth,
    };
    const seed = hashString(`${segment.key}:living-mist`);
    const generated: LivingMistPatch[] = [];

    for (let index = 0; index < patchCount; index += 1) {
      const progress = 0.18 + (index / Math.max(1, patchCount - 1)) * 0.48;
      const t = reverse ? 1 - progress : progress;
      const point = curvedPathPointAt(segment, t, morph);
      const tangent = curvedPathTangentAt(segment, t, morph);
      const lateral = (seededUnit(seed, index + 31) - 0.5) * 3.1;
      const normal = new THREE.Vector2(-tangent.y, tangent.x);
      const x = point.x + normal.x * lateral;
      const z = point.y + normal.y * lateral;
      generated.push({
        position: [x, sampleGroundY(x, z) + 0.13 + index * 0.015, z],
        rotation: Math.atan2(tangent.y, tangent.x),
        scale: [3.15 + seededUnit(seed, index + 67) * 1.35, 1.3 + seededUnit(seed, index + 83) * 0.7, 1],
      });
    }

    return generated;
  }, [activeEntry.id, narrativeWorldState.explorationDepth, narrativeWorldState.memoryPressure, navigationTargetId, patchCount, pathSegments, sampleGroundY]);

  useLayoutEffect(() => {
    const mesh = meshRef.current;
    if (!mesh) return;
    const dummy = dummyRef.current;
    for (let index = 0; index < patches.length; index += 1) {
      const patch = patches[index];
      dummy.position.set(...patch.position);
      dummy.rotation.set(-Math.PI / 2, 0, patch.rotation);
      dummy.scale.set(...patch.scale);
      dummy.updateMatrix();
      mesh.setMatrixAt(index, dummy.matrix);
    }
    mesh.count = patches.length;
    mesh.instanceMatrix.needsUpdate = true;
    mesh.computeBoundingBox();
    mesh.computeBoundingSphere();
  }, [patches]);

  useFrame(({ clock }) => {
    if (!materialRef.current) return;
    const breath = reducedMotion ? 1 : 0.9 + Math.sin(clock.elapsedTime * 0.22) * 0.1;
    materialRef.current.opacity = (0.028 + narrativeWorldState.memoryPressure * 0.012) * qualityProfile.weatherLayerMultiplier * breath;
  });

  useEffect(() => () => texture?.dispose(), [texture]);

  if (!texture || patches.length === 0) return null;

  return (
    <instancedMesh ref={meshRef} args={[undefined, undefined, patches.length]} frustumCulled renderOrder={3}>
      <planeGeometry args={[1, 1, 1, 1]} />
      <meshBasicMaterial ref={materialRef} map={texture} color="#a8c3d9" transparent opacity={0.025} depthWrite={false} side={THREE.DoubleSide} blending={THREE.AdditiveBlending} toneMapped={false} />
    </instancedMesh>
  );
}

