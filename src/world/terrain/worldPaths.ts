import * as THREE from "three";
import type { Slipper3DEntry, Vector3Tuple } from "../../data/slipper3dTypes.ts";
import { getJourneyEntryWorldPlacement, isJourneyEntryElevated } from "../../data/journeyWorldLayout.ts";
import { getOrderedEntries } from "../../lib/storyGraph.ts";
import { buildPhysicalStoryLinks, type PhysicalPathRole } from "../../lib/worldTopology.ts";
import { terrainCurvedPathPointAt as sampleTerrainCurvePoint, terrainCurvedPathTangentAt as sampleTerrainCurveTangent, terrainDistanceToPathSq as sampleTerrainPathDistanceSq, terrainPathProjectionT as sampleTerrainPathProjectionT, type TerrainCurveSeed } from "../../lib/terrainModel.ts";
import { CHAPTER_CROWNED_RETURN, CORRIDOR_BASE_WIDTH, TERRAIN_SEGMENT_BOUNDS_PADDING } from "./worldConstants.ts";
import { entryWorldPosition } from "./worldPlacement.ts";
import { hashString, seededUnit } from "../worldMath.ts";

export type MazeMorphOptions = {
  memoryPressure?: number;
  explorationDepth?: number;
};

export type MazePathSegment = {
  source: THREE.Vector2;
  controlA: THREE.Vector2;
  controlB: THREE.Vector2;
  target: THREE.Vector2;
  sourceEntry: Slipper3DEntry;
  targetEntry: Slipper3DEntry;
  key: string;
  role: PhysicalPathRole;
  curveSeed: number;
  curveLength: number;
  crownRamp: boolean;
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
};

const terrainCurveSeedCache = new WeakMap<
  MazePathSegment,
  TerrainCurveSeed
>();

export function terrainCurveSeedFor(segment: MazePathSegment) {
  let cached = terrainCurveSeedCache.get(segment);
  if (!cached) {
    cached = {
      source: [segment.source.x, segment.source.y],
      controlA: [segment.controlA.x, segment.controlA.y],
      controlB: [segment.controlB.x, segment.controlB.y],
      target: [segment.target.x, segment.target.y],
      curveSeed: segment.curveSeed,
      curveLength: segment.curveLength,
    };
    terrainCurveSeedCache.set(segment, cached);
  }
  return cached;
}

export type TreeCollider = {
  key: string;
  position: Vector3Tuple;
  args: Vector3Tuple;
};

export function cubicBezierPoint2D(source: THREE.Vector2, controlA: THREE.Vector2, controlB: THREE.Vector2, target: THREE.Vector2, t: number) {
  const u = 1 - t;
  const tt = t * t;
  const uu = u * u;
  const uuu = uu * u;
  const ttt = tt * t;
  return new THREE.Vector2(
    uuu * source.x + 3 * uu * t * controlA.x + 3 * u * tt * controlB.x + ttt * target.x,
    uuu * source.y + 3 * uu * t * controlA.y + 3 * u * tt * controlB.y + ttt * target.y,
  );
}

export function curvedPathPointAt(segment: MazePathSegment, t: number, morph: MazeMorphOptions = {}) {
  const point = sampleTerrainCurvePoint(
    terrainCurveSeedFor(segment),
    t,
    morph,
  );
  return new THREE.Vector2(point[0], point[1]);
}

export function curvedPathTangentAt(segment: MazePathSegment, t: number, morph: MazeMorphOptions = {}) {
  const tangent = sampleTerrainCurveTangent(
    terrainCurveSeedFor(segment),
    t,
    morph,
  );
  return new THREE.Vector2(tangent[0], tangent[1]);
}

export function segmentProjectionT(x: number, z: number, segment: MazePathSegment, morph: MazeMorphOptions = {}) {
  return sampleTerrainPathProjectionT(
    x,
    z,
    terrainCurveSeedFor(segment),
    morph,
  );
}

export function distancePointToSegmentSq(x: number, z: number, segment: MazePathSegment, morph: MazeMorphOptions = {}) {
  return sampleTerrainPathDistanceSq(
    x,
    z,
    terrainCurveSeedFor(segment),
    morph,
  );
}

export function nearestMazePathSegment(x: number, z: number, segments: MazePathSegment[], morph: MazeMorphOptions = {}) {
  let nearest: MazePathSegment | null = null;
  let distanceSq = Number.POSITIVE_INFINITY;
  let projectionT = 0;

  for (const segment of segments) {
    if (distanceToSegmentBoundsSq(x, z, segment, CORRIDOR_BASE_WIDTH * 2.4) > distanceSq) continue;
    const candidateT = segmentProjectionT(x, z, segment, morph);
    const point = curvedPathPointAt(segment, candidateT, morph);
    const dx = x - point.x;
    const dz = z - point.y;
    const candidateDistanceSq = dx * dx + dz * dz;

    if (candidateDistanceSq < distanceSq) {
      nearest = segment;
      distanceSq = candidateDistanceSq;
      projectionT = candidateT;
    }
  }

  return { segment: nearest, distanceSq, projectionT };
}

export function pathSegmentAngle(segment: MazePathSegment, t = 0.5, morph: MazeMorphOptions = {}) {
  const tangent = curvedPathTangentAt(segment, t, morph);
  return Math.atan2(tangent.y, tangent.x);
}

export function estimateCurveLength(source: THREE.Vector2, controlA: THREE.Vector2, controlB: THREE.Vector2, target: THREE.Vector2) {
  let length = 0;
  let previous = source.clone();
  for (let i = 1; i <= 32; i += 1) {
    const point = cubicBezierPoint2D(source, controlA, controlB, target, i / 32);
    length += point.distanceTo(previous);
    previous = point;
  }
  return length;
}

export function estimateCurveBounds(source: THREE.Vector2, controlA: THREE.Vector2, controlB: THREE.Vector2, target: THREE.Vector2, padding = TERRAIN_SEGMENT_BOUNDS_PADDING) {
  let minX = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let minZ = Number.POSITIVE_INFINITY;
  let maxZ = Number.NEGATIVE_INFINITY;

  for (let i = 0; i <= 20; i += 1) {
    const point = cubicBezierPoint2D(source, controlA, controlB, target, i / 20);
    minX = Math.min(minX, point.x);
    maxX = Math.max(maxX, point.x);
    minZ = Math.min(minZ, point.y);
    maxZ = Math.max(maxZ, point.y);
  }

  return { minX: minX - padding, maxX: maxX + padding, minZ: minZ - padding, maxZ: maxZ + padding };
}

export function distanceToSegmentBoundsSq(x: number, z: number, segment: MazePathSegment, padding = 0) {
  const clampedX = THREE.MathUtils.clamp(x, segment.minX - padding, segment.maxX + padding);
  const clampedZ = THREE.MathUtils.clamp(z, segment.minZ - padding, segment.maxZ + padding);
  const dx = x - clampedX;
  const dz = z - clampedZ;
  return dx * dx + dz * dz;
}

export function buildMazePathSegments(entries: Slipper3DEntry[]) {
  const entryMap = new Map(entries.map((entry) => [entry.id, entry]));
  const ordered = getOrderedEntries(entries);
  const orderIndexById = new Map(
    ordered.map((entry, index) => [entry.id, index]),
  );
  const segments: MazePathSegment[] = [];
  const seenKeys = new Set<string>();

  const addSegment = (source: Slipper3DEntry | undefined, target: Slipper3DEntry | undefined, role: PhysicalPathRole) => {
    if (!source || !target || source.id === target.id) return;
    const pairKey = [source.id, target.id].sort().join("::");
    if (seenKeys.has(pairKey)) return;
    seenKeys.add(pairKey);

    const a = entryWorldPosition(source, entries);
    const b = entryWorldPosition(target, entries);
    const sourcePoint = new THREE.Vector2(a[0], a[2]);
    const targetPoint = new THREE.Vector2(b[0], b[2]);
    const sourceIndex = orderIndexById.get(source.id) ?? -1;
    const targetIndex = orderIndexById.get(target.id) ?? -1;
    const sourcePlacement = getJourneyEntryWorldPlacement(source.id);
    const targetPlacement = getJourneyEntryWorldPlacement(target.id);
    const crownRamp = sourcePlacement && targetPlacement
      ? role === "backbone" &&
        (isJourneyEntryElevated(source.id) || isJourneyEntryElevated(target.id))
      : sourceIndex >= 0 &&
        targetIndex >= 0 &&
        Math.abs(sourceIndex - targetIndex) === 1 &&
        (source.chapter === CHAPTER_CROWNED_RETURN ||
          target.chapter === CHAPTER_CROWNED_RETURN);
    const direction = targetPoint.clone().sub(sourcePoint);
    const length = Math.max(0.001, direction.length());
    const tangent = direction.clone().normalize();
    const normal = new THREE.Vector2(-tangent.y, tangent.x);
    const seed = hashString(pairKey);
    const bendLimit = crownRamp ? 1.6 : 2.8;
    const secondaryBendLimit = crownRamp ? 0.9 : 1.8;
    const bend = (seededUnit(seed, 1) * 2 - 1) * Math.min(bendLimit, length * 0.18);
    const bendB = (seededUnit(seed, 2) * 2 - 1) * Math.min(secondaryBendLimit, length * 0.12);
    const tensionA = 0.28 + seededUnit(seed, 3) * 0.08;
    const tensionB = 0.64 + seededUnit(seed, 4) * 0.08;
    const controlA = sourcePoint
      .clone()
      .add(direction.clone().multiplyScalar(tensionA))
      .add(normal.clone().multiplyScalar(bend));
    const controlB = sourcePoint
      .clone()
      .add(direction.clone().multiplyScalar(tensionB))
      .add(normal.clone().multiplyScalar(-bend * 0.42 + bendB));

    const bounds = estimateCurveBounds(sourcePoint, controlA, controlB, targetPoint);
    segments.push({
      key: pairKey,
      role,
      source: sourcePoint,
      controlA,
      controlB,
      target: targetPoint,
      sourceEntry: source,
      targetEntry: target,
      crownRamp,
      curveSeed: seed / 2147483647,
      curveLength: estimateCurveLength(sourcePoint, controlA, controlB, targetPoint),
      ...bounds,
    });
  };

  const physicalLinks = buildPhysicalStoryLinks(entries.map((entry) => ({
    id: entry.id,
    chapter: entry.chapter,
    sequence: entry.sequence,
    position: entryWorldPosition(entry, entries),
  })));
  for (const link of physicalLinks) {
    addSegment(entryMap.get(link.sourceId), entryMap.get(link.targetId), link.role);
  }

  return segments;
}

