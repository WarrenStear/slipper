import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { resolveChapterDirector } from "../../components/three/chapterDirector";
import { type RenderQualityProfile } from "../../components/three/renderQuality";
import { resolveWorldVisualState, type WorldVisualState } from "../../components/three/worldVisualState";
import type { Slipper3DEntry } from "../../data/slipper3dTypes";
import { classifyRouteSegment, routeClassWeight } from "../../lib/navigationResolver";
import { terrainElevationAtPoint } from "../terrain/terrainSampler.ts";
import { CLEARING_SAFE_RADIUS, CORRIDOR_BASE_WIDTH, TERRAIN_BASE_Y } from "../terrain/worldConstants.ts";
import { curvedPathPointAt, curvedPathTangentAt, nearestMazePathSegment, pathSegmentAngle, type MazePathSegment } from "../terrain/worldPaths.ts";
import { nearestEntryByXZ, type ChapterBiome } from "../terrain/worldPlacement.ts";
import { hashString, worldSeededUnit } from "../worldMath.ts";
import { dominantSemanticTheme } from "../worldSemantics.ts";
import { type NarrativeWorldState } from "../worldTypes.ts";

const GROUND_DETAIL_CELL_SIZE = 6.4;
const GROUND_DETAIL_CELL_RADIUS = 3;
const GROUND_DETAILS_PER_CELL = 2;
const GROUND_DETAIL_INSTANCE_COUNT = (GROUND_DETAIL_CELL_RADIUS * 2 + 1) * (GROUND_DETAIL_CELL_RADIUS * 2 + 1) * GROUND_DETAILS_PER_CELL;

type GroundDetailKind = "root" | "leaf" | "stone" | "puddle" | "ash" | "gold";

function groundDetailKindForBiome(biome: ChapterBiome, roll: number): GroundDetailKind {
  if (biome === "mirror") return roll < 0.42 ? "puddle" : roll < 0.68 ? "stone" : "leaf";
  if (biome === "thorned") return roll < 0.44 ? "ash" : roll < 0.78 ? "root" : "stone";
  if (biome === "archive") return roll < 0.48 ? "leaf" : roll < 0.74 ? "stone" : "gold";
  if (biome === "fireRiver") return roll < 0.34 ? "ash" : roll < 0.58 ? "puddle" : roll < 0.82 ? "root" : "gold";
  if (biome === "crowned") return roll < 0.56 ? "gold" : roll < 0.78 ? "leaf" : "stone";
  return roll < 0.42 ? "root" : roll < 0.74 ? "leaf" : "stone";
}

function groundDetailTint(kind: GroundDetailKind, visualState: WorldVisualState) {
  if (kind === "root") return visualState.biome === "firstWood" ? "#46372d" : visualState.palette.trunk;
  if (kind === "leaf") return visualState.biome === "archive" ? "#f2e7ce" : visualState.palette.leaf;
  if (kind === "stone") return visualState.biome === "mirror" ? "#8daab0" : "#6d6254";
  if (kind === "puddle") return visualState.biome === "fireRiver" ? "#6aa7b8" : "#9fd4dd";
  if (kind === "ash") return visualState.biome === "thorned" ? "#4e3b33" : "#6c5445";
  return "#e2bd63";
}

function useGroundDetailGeometries() {
  const geometries = useMemo(
    () => ({
      root: new THREE.CylinderGeometry(0.055, 0.085, 1, 6),
      leaf: new THREE.PlaneGeometry(0.62, 0.28, 1, 1),
      stone: new THREE.DodecahedronGeometry(0.32, 0),
      puddle: new THREE.CircleGeometry(1, 36),
      ash: new THREE.CircleGeometry(0.8, 24),
      gold: new THREE.RingGeometry(0.28, 0.42, 32),
    }),
    [],
  );

  useEffect(
    () => () => {
      Object.values(geometries).forEach((geometry) => geometry.dispose());
    },
    [geometries],
  );

  return geometries;
}

export function NarrativeGroundDetailField({
  entries,
  pathSegments,
  activeEntry,
  narrativeWorldState,
  qualityProfile,
}: {
  entries: Slipper3DEntry[];
  pathSegments: MazePathSegment[];
  activeEntry: Slipper3DEntry;
  narrativeWorldState: NarrativeWorldState;
  qualityProfile: RenderQualityProfile;
}) {
  const { camera } = useThree();
  const rootRef = useRef<THREE.InstancedMesh>(null);
  const leafRef = useRef<THREE.InstancedMesh>(null);
  const stoneRef = useRef<THREE.InstancedMesh>(null);
  const puddleRef = useRef<THREE.InstancedMesh>(null);
  const ashRef = useRef<THREE.InstancedMesh>(null);
  const goldRef = useRef<THREE.InstancedMesh>(null);
  const dummyRef = useRef(new THREE.Object3D());
  const lastCellRef = useRef({
    cellX: Number.NaN,
    cellZ: Number.NaN,
    biome: "",
    quality: "",
    memory: Number.NaN,
    depth: Number.NaN,
  });
  const visualState = useMemo(
    () => resolveWorldVisualState({ entry: activeEntry, narrativeWorldState }),
    [activeEntry, narrativeWorldState],
  );
  const geometries = useGroundDetailGeometries();
  const terrainMorph = useMemo(
    () => ({
      memoryPressure: narrativeWorldState.memoryPressure,
      explorationDepth: narrativeWorldState.explorationDepth,
    }),
    [narrativeWorldState.memoryPressure, narrativeWorldState.explorationDepth],
  );

  useLayoutEffect(() => {
    // An animation frame can precede passive effects. Reconnecting a retained
    // layout also needs a fresh build after resetting its populated batches.
    lastCellRef.current = {
      cellX: Number.NaN, cellZ: Number.NaN, biome: "", quality: "",
      memory: Number.NaN, depth: Number.NaN,
    };
    for (const mesh of [rootRef.current, leafRef.current, stoneRef.current, puddleRef.current, ashRef.current, goldRef.current]) {
      if (!mesh) continue;
      mesh.count = 0;
      mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    }
  }, []);

  const finalizeGroundMeshes = (counts: Record<GroundDetailKind, number>) => {
    const targets: Array<[THREE.InstancedMesh | null, GroundDetailKind]> = [
      [rootRef.current, "root"],
      [leafRef.current, "leaf"],
      [stoneRef.current, "stone"],
      [puddleRef.current, "puddle"],
      [ashRef.current, "ash"],
      [goldRef.current, "gold"],
    ];

    for (const [mesh, kind] of targets) {
      if (!mesh) continue;
      mesh.count = counts[kind];
      mesh.instanceMatrix.needsUpdate = true;
      mesh.computeBoundingSphere();
    }
  };

  const rebuildGroundDetails = (cellX: number, cellZ: number) => {
    const refs: Record<GroundDetailKind, { current: THREE.InstancedMesh | null }> = {
      root: rootRef,
      leaf: leafRef,
      stone: stoneRef,
      puddle: puddleRef,
      ash: ashRef,
      gold: goldRef,
    };
    const counts: Record<GroundDetailKind, number> = {
      root: 0,
      leaf: 0,
      stone: 0,
      puddle: 0,
      ash: 0,
      gold: 0,
    };
    const dummy = dummyRef.current;
    const radius = Math.max(2, Math.round(GROUND_DETAIL_CELL_RADIUS * (0.42 + qualityProfile.groundDetailMultiplier * 0.58)));
    const perCell = Math.max(1, Math.round(GROUND_DETAILS_PER_CELL * (0.6 + qualityProfile.groundDetailMultiplier * 0.6)));
    const density = visualState.groundDetailIntensity * qualityProfile.groundDetailMultiplier;
    const detailSeed = hashString(`${activeEntry.chapter}-${visualState.biome}`);

    for (let dx = -radius; dx <= radius; dx += 1) {
      for (let dz = -radius; dz <= radius; dz += 1) {
        const worldCellX = cellX + dx;
        const worldCellZ = cellZ + dz;

        for (let localIndex = 0; localIndex < perCell; localIndex += 1) {
          const roll = worldSeededUnit(worldCellX, worldCellZ, detailSeed + localIndex * 17.1);
          if (roll > density + 0.08) continue;

          const x = (worldCellX + worldSeededUnit(worldCellX, worldCellZ, detailSeed + localIndex * 3.3)) * GROUND_DETAIL_CELL_SIZE;
          const z = (worldCellZ + worldSeededUnit(worldCellX, worldCellZ, detailSeed + localIndex * 5.7)) * GROUND_DETAIL_CELL_SIZE;
          const nearestPath = nearestMazePathSegment(x, z, pathSegments, terrainMorph);
          const pathDistance = Math.sqrt(nearestPath.distanceSq);
          const nearPath = !!nearestPath.segment && pathDistance < CORRIDOR_BASE_WIDTH * (visualState.pathClarity > 0.8 ? 1.9 : 1.45);
          const clearingPenalty = nearestEntryByXZ(x, z, entries).distanceSq < CLEARING_SAFE_RADIUS * CLEARING_SAFE_RADIUS * 0.58;

          if (!nearPath && roll > density * 0.42) continue;
          if (clearingPenalty && roll > 0.22) continue;

          const kind = groundDetailKindForBiome(visualState.biome, worldSeededUnit(worldCellX, worldCellZ, detailSeed + localIndex * 11.9));
          const mesh = refs[kind].current;
          const index = counts[kind];
          if (!mesh || index >= GROUND_DETAIL_INSTANCE_COUNT) continue;

          const y = TERRAIN_BASE_Y + terrainElevationAtPoint(x, z, entries, pathSegments, terrainMorph);
          const angle = nearestPath.segment
            ? pathSegmentAngle(nearestPath.segment, nearestPath.projectionT, terrainMorph)
            : worldSeededUnit(worldCellX, worldCellZ, detailSeed + localIndex * 2.1) * Math.PI * 2;
          const edgeLift = nearPath ? THREE.MathUtils.smoothstep(pathDistance, CORRIDOR_BASE_WIDTH * 0.2, CORRIDOR_BASE_WIDTH * 1.7) : 0;
          const scaleJitter = 0.72 + worldSeededUnit(worldCellX, worldCellZ, detailSeed + localIndex * 13.4) * 0.68;
          const side = worldSeededUnit(worldCellX, worldCellZ, detailSeed + localIndex * 23.4) > 0.5 ? 1 : -1;

          dummy.position.set(x, y + 0.018 + edgeLift * 0.012, z);
          dummy.rotation.set(0, angle + side * (0.25 + roll * 0.7), 0);

          if (kind === "root") {
            dummy.rotation.set(0, angle + side * (0.25 + roll * 0.7), Math.PI / 2);
            dummy.scale.set(0.72 + scaleJitter * 0.38, 0.78 + scaleJitter * 1.05, 0.72 + scaleJitter * 0.38);
          } else if (kind === "leaf") {
            dummy.rotation.set(-Math.PI / 2 + (roll - 0.5) * 0.08, 0, angle + roll * Math.PI);
            dummy.scale.set(scaleJitter * 0.9, scaleJitter * 0.72, 1);
          } else if (kind === "stone") {
            dummy.position.y += 0.055;
            dummy.scale.set(scaleJitter * 0.32, scaleJitter * 0.18, scaleJitter * 0.26);
          } else if (kind === "puddle") {
            dummy.rotation.set(-Math.PI / 2, 0, angle);
            dummy.position.y += 0.012;
            dummy.scale.set(scaleJitter * 0.64, scaleJitter * 0.38, 1);
          } else if (kind === "ash") {
            dummy.rotation.set(-Math.PI / 2, 0, angle);
            dummy.position.y += 0.01;
            dummy.scale.set(scaleJitter * 0.52, scaleJitter * 0.34, 1);
          } else {
            dummy.rotation.set(-Math.PI / 2, 0, angle);
            dummy.position.y += 0.018 + visualState.pathGlowIntensity * 0.006;
            dummy.scale.set(scaleJitter * 0.48, scaleJitter * 0.48, 1);
          }

          dummy.updateMatrix();
          mesh.setMatrixAt(index, dummy.matrix);
          counts[kind] += 1;
        }
      }
    }

    finalizeGroundMeshes(counts);
  };

  useFrame(() => {
    const cellX = Math.floor(camera.position.x / GROUND_DETAIL_CELL_SIZE);
    const cellZ = Math.floor(camera.position.z / GROUND_DETAIL_CELL_SIZE);
    const quality = qualityProfile.quality;
    const memory = Math.round(narrativeWorldState.memoryPressure * 20);
    const depth = Math.round(narrativeWorldState.explorationDepth * 20);
    const last = lastCellRef.current;

    if (
      last.cellX === cellX &&
      last.cellZ === cellZ &&
      last.biome === visualState.biome &&
      last.quality === quality &&
      last.memory === memory &&
      last.depth === depth
    ) {
      return;
    }

    last.cellX = cellX;
    last.cellZ = cellZ;
    last.biome = visualState.biome;
    last.quality = quality;
    last.memory = memory;
    last.depth = depth;

    rebuildGroundDetails(cellX, cellZ);
  });

  return (
    <group>
      <instancedMesh ref={rootRef} args={[geometries.root, undefined, GROUND_DETAIL_INSTANCE_COUNT]} frustumCulled>
        <meshStandardMaterial color={groundDetailTint("root", visualState)} roughness={0.86} metalness={0.03} transparent opacity={0.42 + visualState.silhouetteContrast * 0.22} />
      </instancedMesh>
      <instancedMesh ref={leafRef} args={[geometries.leaf, undefined, GROUND_DETAIL_INSTANCE_COUNT]} frustumCulled>
        <meshStandardMaterial color={groundDetailTint("leaf", visualState)} roughness={0.78} metalness={0.02} transparent opacity={0.28 + visualState.groundDetailIntensity * 0.24} side={THREE.DoubleSide} depthWrite={false} />
      </instancedMesh>
      <instancedMesh ref={stoneRef} args={[geometries.stone, undefined, GROUND_DETAIL_INSTANCE_COUNT]} frustumCulled>
        <meshStandardMaterial color={groundDetailTint("stone", visualState)} roughness={0.92} metalness={0.04} transparent opacity={0.42 + visualState.silhouetteContrast * 0.12} />
      </instancedMesh>
      <instancedMesh ref={puddleRef} args={[geometries.puddle, undefined, GROUND_DETAIL_INSTANCE_COUNT]} frustumCulled>
        <meshStandardMaterial color={groundDetailTint("puddle", visualState)} emissive={visualState.palette.emissive} emissiveIntensity={0.08 + visualState.bloomIntensity * 0.04} roughness={0.12} metalness={0.16} transparent opacity={0.24 + visualState.pathGlowIntensity * 0.04} side={THREE.DoubleSide} depthWrite={false} />
      </instancedMesh>
      <instancedMesh ref={ashRef} args={[geometries.ash, undefined, GROUND_DETAIL_INSTANCE_COUNT]} frustumCulled>
        <meshBasicMaterial color={groundDetailTint("ash", visualState)} transparent opacity={0.16 + narrativeWorldState.memoryPressure * 0.09} side={THREE.DoubleSide} depthWrite={false} />
      </instancedMesh>
      <instancedMesh ref={goldRef} args={[geometries.gold, undefined, GROUND_DETAIL_INSTANCE_COUNT]} frustumCulled>
        <meshBasicMaterial color={groundDetailTint("gold", visualState)} transparent opacity={0.18 + visualState.bloomIntensity * 0.12} side={THREE.DoubleSide} depthWrite={false} toneMapped={false} />
      </instancedMesh>
    </group>
  );
}

export function NarrativeGroundTrails({
  entries,
  pathSegments,
  activeEntry,
  narrativeWorldState,
  qualityProfile,
  visitedEntryIds,
  navigationTargetId,
}: {
  entries: Slipper3DEntry[];
  pathSegments: MazePathSegment[];
  activeEntry: Slipper3DEntry;
  narrativeWorldState: NarrativeWorldState;
  qualityProfile: RenderQualityProfile;
  visitedEntryIds: string[];
  navigationTargetId?: string | null;
}) {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const visitedSet = useMemo(() => new Set(visitedEntryIds), [visitedEntryIds]);
  const visualState = useMemo(
    () => resolveWorldVisualState({ entry: activeEntry, narrativeWorldState }),
    [activeEntry, narrativeWorldState],
  );

  const trailInstances = useMemo(() => {
    const instances: Array<{
      x: number;
      y: number;
      z: number;
      angle: number;
      width: number;
      length: number;
    }> = [];
    const maxInstances = qualityProfile.quality === "low" ? 120 : qualityProfile.quality === "medium" ? 190 : 280;
    const morph = { memoryPressure: narrativeWorldState.memoryPressure, explorationDepth: narrativeWorldState.explorationDepth };

    for (const segment of pathSegments) {
      const length = segment.curveLength;
      if (length < 0.001) continue;

      const routeClass = classifyRouteSegment({ segment, activeEntryId: activeEntry.id, navigationTargetId, visitedEntryIds: visitedSet });
      const routeWeight = routeClassWeight(routeClass);
      const semantic = dominantSemanticTheme(segment.targetEntry);
      const director = resolveChapterDirector(segment.targetEntry);
      const baseSteps = Math.max(3, Math.min(24, Math.floor(length / (director.navigationStyle === "ascending" ? 2.9 : 3.4))));
      // The living ribbon owns active navigation. These circular traces are
      // reserved for travelled memory only; showing every adjacent route at
      // once creates overlapping loops and spends fill-rate on false choices.
      if (routeClass !== "visited") continue;
      const steps = Math.max(2, Math.round(baseSteps * (0.42 + routeWeight * 0.58)));
      for (let index = 1; index < steps; index += 1) {
        if (instances.length >= maxInstances) break;
        const t = index / steps;
        const rhythm = worldSeededUnit(Math.floor(segment.source.x + index * 13), Math.floor(segment.source.y - index * 17), semantic.score + 33.2);
        if (rhythm < 0.18 && director.groundTrailOpacity < 0.3) continue;

        const point = curvedPathPointAt(segment, t, morph);
        const tangent = curvedPathTangentAt(segment, t, morph);
        const angle = Math.atan2(tangent.y, tangent.x);
        const x = point.x;
        const z = point.y;
        const terrainLift = terrainElevationAtPoint(x, z, entries, pathSegments, morph);
        const routeScale = 0.46;
        const width = THREE.MathUtils.lerp(0.55, 0.94, director.pathClarity) * (0.86 + rhythm * 0.18) * routeScale;
        const patchLength = THREE.MathUtils.lerp(1.75, 2.68, director.pathClarity) * (0.84 + rhythm * 0.16) * (0.9 + routeScale * 0.1);

        instances.push({
          x,
          y: TERRAIN_BASE_Y + terrainLift + 0.028,
          z,
          angle,
          width,
          length: patchLength,
        });
      }
    }

    return instances;
  }, [activeEntry.id, entries, navigationTargetId, narrativeWorldState.explorationDepth, narrativeWorldState.memoryPressure, pathSegments, qualityProfile.quality, visitedSet]);

  useEffect(() => {
    const mesh = meshRef.current;
    if (!mesh) return;

    for (let index = 0; index < trailInstances.length; index += 1) {
      const trail = trailInstances[index];
      dummy.position.set(trail.x, trail.y, trail.z);
      dummy.rotation.set(-Math.PI / 2, 0, trail.angle);
      dummy.scale.set(trail.length, trail.width, 1);
      dummy.updateMatrix();
      mesh.setMatrixAt(index, dummy.matrix);
    }

    mesh.count = trailInstances.length;
    mesh.instanceMatrix.needsUpdate = true;
    mesh.computeBoundingBox();
    mesh.computeBoundingSphere();
  }, [dummy, trailInstances]);

  if (trailInstances.length === 0) return null;

  const opacity = Math.min(
    0.14,
    0.025 + visualState.director.groundTrailOpacity * visualState.pathClarity * qualityProfile.semanticDensityMultiplier * 0.13,
  );

  return (
    <instancedMesh ref={meshRef} args={[undefined, undefined, trailInstances.length]} frustumCulled>
      <circleGeometry args={[0.5, 12]} />
      <meshBasicMaterial
        color="#b8af9b"
        transparent
        opacity={opacity}
        side={THREE.DoubleSide}
        depthWrite={false}
        toneMapped={false}
        polygonOffset
        polygonOffsetFactor={-1}
      />
    </instancedMesh>
  );
}
