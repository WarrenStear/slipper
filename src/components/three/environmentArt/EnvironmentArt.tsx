import { HeroAssetSlot } from "../actors/HeroAssetSlot";
import { memo, useEffect, useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { TactileMaterial, useTactileDetail, type StorySurface } from "../storyEvents/TactileMaterial";
import { createWeatheredPanelGeometry, createWornTimberGeometry, mergeArtGeometries, type ArtVec3 } from "./authoredGeometry.ts";

import { createBotanicalGeometries, type BotanicalKind } from "./botanicalGeometry.ts";

type SurfacePieceProps = { position?: ArtVec3; rotation?: ArtVec3; size: ArtVec3; color: string; seed?: number; finish?: StorySurface; roughness?: number };
const ZERO: ArtVec3 = [0, 0, 0];
export const TimberPiece = memo(function TimberPiece({ position, rotation, size, color, seed = 0, finish = "wood", roughness = .86 }: SurfacePieceProps) {
  const geometry = useMemo(() => createWornTimberGeometry(size, seed), [size[0], size[1], size[2], seed]);
  useEffect(() => () => geometry.dispose(), [geometry]);
  return <mesh geometry={geometry} position={position} rotation={rotation} receiveShadow><TactileMaterial surface={finish} color={color} roughness={roughness} /></mesh>;
});

export const WeatheredPanel = memo(function WeatheredPanel({ position, rotation, size, color, seed = 0, finish = "plaster", roughness = .95 }: SurfacePieceProps) {
  const geometry = useMemo(() => createWeatheredPanelGeometry(size, seed), [size[0], size[1], size[2], seed]);
  useEffect(() => () => geometry.dispose(), [geometry]);
  return <mesh geometry={geometry} position={position} rotation={rotation} receiveShadow><TactileMaterial surface={finish} color={color} roughness={roughness} /></mesh>;
});

export type { BotanicalKind } from "./botanicalGeometry.ts";
export type BotanicalPlacement = { position: ArtVec3; rotation?: ArtVec3; scale?: number | ArtVec3; color?: string };

/** Each plant is authored once; an entire bed has at most three material draws. */

function PlantInstances({ geometry, placements, surface, color, roughness = .9, name, instanceColors = false }: { geometry: THREE.BufferGeometry; placements: readonly BotanicalPlacement[]; surface: StorySurface; color: string; roughness?: number; name?: string; instanceColors?: boolean }) {
  const mesh = useRef<THREE.InstancedMesh>(null);
  useLayoutEffect(() => {
    if (!mesh.current) return;
    const dummy = new THREE.Object3D(), tint = new THREE.Color();
    placements.forEach(({ position, rotation = ZERO, scale = 1, color: placementColor }, index) => {
      dummy.position.set(...position); dummy.rotation.set(...rotation);
      if (typeof scale === "number") dummy.scale.setScalar(scale); else dummy.scale.set(...scale);
      dummy.updateMatrix(); mesh.current!.setMatrixAt(index, dummy.matrix);
      if (instanceColors) mesh.current!.setColorAt(index, tint.set(placementColor ?? color));
    });
    mesh.current.instanceMatrix.needsUpdate = true;
    if (mesh.current.instanceColor) mesh.current.instanceColor.needsUpdate = true;
    mesh.current.computeBoundingBox(); mesh.current.computeBoundingSphere();
  }, [geometry, placements, color, instanceColors]);
  if (!geometry.getAttribute("position").count || !placements.length) return null;
  return <instancedMesh ref={mesh} name={name} args={[geometry, undefined, placements.length]} receiveShadow>
    <TactileMaterial surface={surface} color={instanceColors ? "#ffffff" : color} roughness={roughness} side={THREE.DoubleSide} />
  </instancedMesh>;
}

export const BotanicalBatch = memo(function BotanicalBatch({ kind, placements, seed = 0, color, burnt = false, name, mergeFoliage = false }: { kind: BotanicalKind; placements: readonly BotanicalPlacement[]; seed?: number; color?: string; burnt?: boolean; name?: string; mergeFoliage?: boolean }) {
  const detail = useTactileDetail();
  const shapes = useMemo(() => {
    const result = createBotanicalGeometries(kind, seed, detail);
    if (mergeFoliage) { result.stems = mergeArtGeometries([result.stems, result.leaves]); result.leaves = mergeArtGeometries([]); }
    return result;
  }, [kind, seed, detail, mergeFoliage]);
  const boundedPlacements = useMemo(() => placements.slice(0, 160).filter(item => item.position.every(Number.isFinite)), [placements]);
  useEffect(() => () => { shapes.stems.dispose(); shapes.leaves.dispose(); shapes.petals.dispose(); }, [shapes]);
  return <group name={`authored-${kind}-bed`}>
    <PlantInstances name={name && `${name}-stems`} geometry={shapes.stems} placements={boundedPlacements} surface={burnt ? "charred-wood" : "bark"} color={burnt ? "#302924" : "#43513a"} />
    <PlantInstances name={name && `${name}-leaves`} geometry={shapes.leaves} placements={boundedPlacements} surface={burnt ? "ash" : "linen"} color={burnt ? "#38302a" : kind === "lily" ? "#526650" : "#687050"} />
    <PlantInstances name={name && `${name}-blossoms`} instanceColors={!burnt} geometry={shapes.petals} placements={boundedPlacements} surface={burnt ? "ash" : "velvet"} color={burnt ? "#3a302b" : color ?? (kind === "rose" ? "#bb818e" : "#ddd7c6")} roughness={.85} />
  </group>;
});

export const BotanicalCluster = memo(function BotanicalCluster({ kind, position = ZERO, rotation = ZERO, scale = 1, seed, color, burnt }: Partial<BotanicalPlacement> & { kind: BotanicalKind; seed?: number; color?: string; burnt?: boolean }) {
  const placements = useMemo(() => [{ position, rotation, scale }], [position, rotation, scale]);
  const fallback = <BotanicalBatch kind={kind} placements={placements} seed={seed} color={color} burnt={burnt} />;
  return !burnt && (kind === "rose" || kind === "lily") ? <group position={position} rotation={rotation} scale={scale}>
    <HeroAssetSlot id={kind === "rose" ? "roses" : "lilies"}><BotanicalBatch kind={kind} placements={[{ position: ZERO }]} seed={seed} color={color} /></HeroAssetSlot>
  </group> : fallback;
});
