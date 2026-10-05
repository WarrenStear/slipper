import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import type { Slipper3DEntry, Vector3Tuple } from "../../data/slipper3dTypes.ts";
import { type WorldVisualState } from "../../components/three/worldVisualState.ts";
import { type RenderQualityProfile } from "../../components/three/renderQuality.ts";
import { curvedPathPointAt, curvedPathTangentAt, type MazePathSegment } from "../terrain/worldPaths.ts";
import { type NarrativeWorldState } from "../worldTypes.ts";
import { guidedPathSegment } from "./routeGeometry.ts";
import { clamp01, hashString, seededUnit } from "../worldMath.ts";

export type PathLightMote = {
  position: Vector3Tuple;
  scale: number;
};

export function PathLightMotes({
  pathSegments,
  activeEntry,
  navigationTargetId,
  visualState,
  narrativeWorldState,
  qualityProfile,
  sampleGroundY,
}: {
  pathSegments: MazePathSegment[];
  activeEntry: Slipper3DEntry;
  navigationTargetId: string | null;
  visualState: WorldVisualState;
  narrativeWorldState: NarrativeWorldState;
  qualityProfile: RenderQualityProfile;
  sampleGroundY: (x: number, z: number) => number;
}) {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const haloRef = useRef<THREE.InstancedMesh>(null);
  const materialRef = useRef<THREE.MeshBasicMaterial>(null);
  const haloMaterialRef = useRef<THREE.MeshBasicMaterial>(null);
  const transformRef = useRef(new THREE.Object3D());

  const motes = useMemo<PathLightMote[]>(() => {
    const activeId = activeEntry.id;
    const targetId = navigationTargetId;
    const segment = guidedPathSegment(pathSegments, activeId, targetId);

    if (!segment) return [];
    const count = Math.max(10, Math.round(qualityProfile.pathLightMoteCount * visualState.pathGlowIntensity * 0.62));
    const reverse = targetId ? segment.sourceEntry.id === targetId : segment.targetEntry.id === activeId;
    const morph = {
      memoryPressure: narrativeWorldState.memoryPressure,
      explorationDepth: narrativeWorldState.explorationDepth,
    };
    const seed = hashString(segment.key + ':' + (targetId ?? activeId));
    const generated: PathLightMote[] = [];

    for (let index = 0; index < count; index += 1) {
      const progress = count <= 1 ? 0 : index / (count - 1);
      const t = reverse ? 1 - progress : progress;
      const point = curvedPathPointAt(segment, t, morph);
      const side = seededUnit(seed, index * 3 + 1) * 2 - 1;
      const lift = 0.18 + seededUnit(seed, index * 3 + 2) * 0.34;
      const tangent = curvedPathTangentAt(segment, t, morph);
      const normal = new THREE.Vector2(-tangent.y, tangent.x);
      const x = point.x + normal.x * side * 0.62;
      const z = point.y + normal.y * side * 0.62;
      generated.push({
        position: [x, sampleGroundY(x, z) + lift, z],
        scale: 0.032 + seededUnit(seed, index * 3 + 3) * 0.027,
      });
    }
    return generated;
  }, [activeEntry.id, navigationTargetId, narrativeWorldState.explorationDepth, narrativeWorldState.memoryPressure, pathSegments, qualityProfile.pathLightMoteCount, sampleGroundY, visualState.pathGlowIntensity]);

  useEffect(() => {
    const mesh = meshRef.current;
    const halo = haloRef.current;
    if (!mesh || !halo) return;
    const transform = transformRef.current;
    for (let index = 0; index < motes.length; index += 1) {
      const mote = motes[index];
      transform.position.set(...mote.position);
      transform.scale.setScalar(mote.scale);
      transform.updateMatrix();
      mesh.setMatrixAt(index, transform.matrix);
      transform.scale.setScalar(mote.scale * 2.9);
      transform.updateMatrix();
      halo.setMatrixAt(index, transform.matrix);
    }
    for (const target of [mesh, halo]) {
      target.count = motes.length;
      target.instanceMatrix.needsUpdate = true;
      target.computeBoundingBox();
      target.computeBoundingSphere();
    }
  }, [motes]);

  useFrame((state) => {
    const material = materialRef.current;
    if (!material) return;
    const pressure = clamp01(narrativeWorldState.memoryPressure);
    const pulse = 0.78 + Math.sin(state.clock.elapsedTime * (0.65 + pressure * 0.9)) * 0.16;
    material.opacity = THREE.MathUtils.clamp((0.22 + visualState.pathGlowIntensity * 0.36) * pulse, 0.12, 0.82);
    if (haloMaterialRef.current) {
      haloMaterialRef.current.opacity = THREE.MathUtils.clamp((0.025 + visualState.pathGlowIntensity * 0.05) * pulse, 0.018, 0.12);
    }
  });

  if (motes.length === 0) return null;

  return (
    <group>
      <instancedMesh ref={haloRef} args={[undefined as unknown as THREE.BufferGeometry, undefined as unknown as THREE.Material, motes.length]} frustumCulled renderOrder={21}>
        <sphereGeometry args={[1, 5, 5]} />
        <meshBasicMaterial ref={haloMaterialRef} color="#f2c86b" transparent opacity={0.06} depthWrite={false} blending={THREE.AdditiveBlending} toneMapped={false} />
      </instancedMesh>
      <instancedMesh ref={meshRef} args={[undefined as unknown as THREE.BufferGeometry, undefined as unknown as THREE.Material, motes.length]} frustumCulled renderOrder={22}>
        <sphereGeometry args={[1, 6, 6]} />
        <meshBasicMaterial ref={materialRef} color="#ffe3a1" transparent opacity={0.52} depthWrite={false} toneMapped={false} />
      </instancedMesh>
    </group>
  );
}

