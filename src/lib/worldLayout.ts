import * as THREE from "three";
import type { Slipper3DEntry, Vector3Tuple, EulerTuple } from "../data/slipper3dTypes";
import {
  getJourneyEntryClearingRadius,
  getJourneyEntryWorldPlacement,
  getJourneyEntryWorldPosition,
  isJourneyEntryElevated,
} from "../data/journeyWorldLayout";
import { getOrderedEntries } from "./storyGraph";
import { buildPhysicalStoryLinks, type PhysicalPathRole } from "./worldTopology";
import {
  createTerrainSurfaceSampler,
  sampleTerrainNoise,
  terrainCurvedPathPointAt as sampleTerrainCurvePoint,
  terrainCurvedPathTangentAt as sampleTerrainCurveTangent,
  terrainDistanceToPathSq as sampleTerrainPathDistanceSq,
  terrainPathProjectionT as sampleTerrainPathProjectionT,
  type TerrainCurveSeed,
  type TerrainSamplerConfig,
} from "./terrainModel";

export const CONSTELLATION_CENTER = 120;
export const CONSTELLATION_WORLD_SCALE = 0.72;
export const AUTHORED_WORLD_SCALE = 1.5;
export const CLEARING_SAFE_RADIUS = 8.8;
export const FOREST_CLEARING_RADIUS = 7.2;
export const CORRIDOR_BASE_WIDTH = 5.2;
export const CORRIDOR_MIN_WIDTH = 3.6;
export const CHAPTER_FIRST_WOOD = "The First Wood";
export const CHAPTER_MIRROR_CLEARING = "The Mirror Clearing";
export const CHAPTER_THORNED_HOUSE = "The Thorned House";
export const CHAPTER_BLUE_MOON_ARCHIVE = "The Blue Moon Archive";
export const CHAPTER_FIRE_AND_RIVER = "The Fire and River";
export const CHAPTER_CROWNED_RETURN = "The Crowned Return";
export const CROWNED_RETURN_BASE_RISE = 0.6;
export const CROWNED_RETURN_ASCENT_HEIGHT = 6;
export const TERRAIN_BASE_Y = -1.255;
export const TERRAIN_COLLIDER_Y = -1.34;
export const CROWNED_RETURN_RAMP_WIDTH = 12;
export const CROWNED_RETURN_RAMP_THICKNESS = 0.34;

const TERRAIN_SIZE = 860;
const TERRAIN_SEGMENTS = 128;

export type ChapterBiome = "firstWood" | "mirror" | "thorned" | "archive" | "fireRiver" | "crowned";

export type SpatialStoryNode = {
  entry: Slipper3DEntry;
  position: Vector3Tuple;
  isActive: boolean;
  isVisited: boolean;
  graphDistance: 0 | 1 | 2;
};

export type MazeMorphOptions = {
  memoryPressure?: number;
  explorationDepth?: number;
};

export type MazePathSegment = {
  key: string;
  role: PhysicalPathRole;
  source: THREE.Vector2;
  controlA: THREE.Vector2;
  controlB: THREE.Vector2;
  target: THREE.Vector2;
  curveSeed: number;
  curveLength: number;
  crownRamp: boolean;
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
  sourceEntry: Slipper3DEntry;
  targetEntry: Slipper3DEntry;
};

const TERRAIN_PATH_BOUNDS_PADDING = 24;

const terrainCurveSeedCache = new WeakMap<
  MazePathSegment,
  TerrainCurveSeed
>();

function terrainCurveSeedFor(segment: MazePathSegment) {
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

export type CrownRampSegment = {
  key: string;
  source: Vector3Tuple;
  target: Vector3Tuple;
  position: Vector3Tuple;
  rotation: EulerTuple;
  args: Vector3Tuple;
  visualScale: Vector3Tuple;
  color: string;
};

export function clamp01(value: number) {
  return Math.max(0, Math.min(1, value));
}

function fract(value: number) {
  return value - Math.floor(value);
}

export function hashString(value: string) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash += (hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24);
  }
  return Math.abs(hash >>> 0);
}

export function seededUnit(seed: number, index: number) {
  const x = Math.sin(seed * 999 + index * 77.13) * 10000;
  return x - Math.floor(x);
}

export function worldSeededUnit(x: number, z: number, salt = 0) {
  return fract(Math.sin(x * 127.1 + z * 311.7 + salt * 74.7) * 43758.5453123);
}

export function smoothstep(edge0: number, edge1: number, value: number) {
  const x = clamp01((value - edge0) / Math.max(0.0001, edge1 - edge0));
  return x * x * (3 - 2 * x);
}

export function isChapter(entry: Slipper3DEntry, chapter: string) {
  return entry.chapter === chapter;
}

export function chapterBiome(entry: Slipper3DEntry): ChapterBiome {
  if (isChapter(entry, CHAPTER_MIRROR_CLEARING)) return "mirror";
  if (isChapter(entry, CHAPTER_THORNED_HOUSE)) return "thorned";
  if (isChapter(entry, CHAPTER_BLUE_MOON_ARCHIVE)) return "archive";
  if (isChapter(entry, CHAPTER_FIRE_AND_RIVER)) return "fireRiver";
  if (isChapter(entry, CHAPTER_CROWNED_RETURN)) return "crowned";
  return "firstWood";
}

export function chapterProgress(entry: Slipper3DEntry, entries: Slipper3DEntry[], chapter: string) {
  const ordered = getOrderedEntries(entries).filter((candidate) => candidate.chapter === chapter);
  const index = ordered.findIndex((candidate) => candidate.id === entry.id);
  if (index < 0) return 0;
  return ordered.length <= 1 ? 1 : index / (ordered.length - 1);
}

export function crownedReturnElevation(entry: Slipper3DEntry, entries: Slipper3DEntry[]) {
  if (!isChapter(entry, CHAPTER_CROWNED_RETURN)) return 0;
  const progress = chapterProgress(entry, entries, CHAPTER_CROWNED_RETURN);
  const eased = progress * progress * (3 - 2 * progress);
  return CROWNED_RETURN_BASE_RISE + eased * CROWNED_RETURN_ASCENT_HEIGHT;
}

export function entryWorldPosition(entry: Slipper3DEntry, entries: Slipper3DEntry[]): Vector3Tuple {
  const narrativePosition = getJourneyEntryWorldPosition(entry.id);
  if (narrativePosition) return [...narrativePosition];

  const authored = entry.engine3d.worldPosition;
  const manual = entry.engine3d.constellationPosition;
  const y = crownedReturnElevation(entry, entries);

  if (authored) {
    return [
      authored[0] * AUTHORED_WORLD_SCALE,
      authored[1] + y,
      authored[2] * AUTHORED_WORLD_SCALE,
    ];
  }

  if (manual) {
    return [
      (manual[0] - CONSTELLATION_CENTER) * CONSTELLATION_WORLD_SCALE,
      y,
      (manual[1] - CONSTELLATION_CENTER) * CONSTELLATION_WORLD_SCALE,
    ];
  }

  const index = Math.max(0, entries.findIndex((candidate) => candidate.id === entry.id));
  const angle = index * 2.399963229728653;
  const radius = 8 + Math.sqrt(index + 1) * 5.2;
  return [Math.cos(angle) * radius, y, Math.sin(angle) * radius];
}

export function nearestEntryByXZ(x: number, z: number, entries: Slipper3DEntry[]) {
  let nearest: Slipper3DEntry | null = null;
  let nearestDistanceSq = Number.POSITIVE_INFINITY;

  for (const entry of entries) {
    const position = entryWorldPosition(entry, entries);
    const dx = x - position[0];
    const dz = z - position[2];
    const distanceSq = dx * dx + dz * dz;
    if (distanceSq < nearestDistanceSq) {
      nearest = entry;
      nearestDistanceSq = distanceSq;
    }
  }

  return { entry: nearest, distanceSq: nearestDistanceSq };
}

export function buildSpatialStoryNodes({
  activeEntryId,
  entries,
  visitedEntryIds,
}: {
  activeEntryId: string;
  entries: Slipper3DEntry[];
  visitedEntryIds: string[];
}): SpatialStoryNode[] {
  const links = buildPhysicalStoryLinks(entries.map((entry) => ({
    id: entry.id,
    chapter: entry.chapter,
    sequence: entry.sequence,
    position: entryWorldPosition(entry, entries),
  })));
  const neighborIds = new Set<string>();

  for (const link of links) {
    if (link.sourceId === activeEntryId) neighborIds.add(link.targetId);
    if (link.targetId === activeEntryId) neighborIds.add(link.sourceId);
  }

  const visitedSet = new Set(visitedEntryIds);

  return entries.map((entry): SpatialStoryNode => {
    const isActive = entry.id === activeEntryId;
    return {
      entry,
      position: entryWorldPosition(entry, entries),
      isActive,
      isVisited: visitedSet.has(entry.id),
      graphDistance: isActive ? 0 : neighborIds.has(entry.id) ? 1 : 2,
    };
  });
}

export function allClearingPositions(entries: Slipper3DEntry[]): Vector3Tuple[] {
  return entries.map((entry) => entryWorldPosition(entry, entries));
}

function buildOrganicControlPoints(
  source: THREE.Vector2,
  target: THREE.Vector2,
  seed: number,
  crownRamp = false,
) {
  const delta = target.clone().sub(source);
  const length = Math.max(0.001, delta.length());
  const direction = delta.clone().multiplyScalar(1 / length);
  const normal = new THREE.Vector2(-direction.y, direction.x);

  // Keep this mathematically aligned with StoryScene.tsx until the scene is fully
  // refactored to import this canonical helper directly. The world map, trail
  // state resolver, and physical forest corridors must all describe the same
  // route geometry, otherwise the UI can guide the player along a path that the
  // 3D world does not actually render.
  const bendLimit = crownRamp ? 1.6 : 2.8;
  const secondaryBendLimit = crownRamp ? 0.9 : 1.8;
  const bend = (seededUnit(seed, 1) * 2 - 1) * Math.min(bendLimit, length * 0.18);
  const bendB = (seededUnit(seed, 2) * 2 - 1) * Math.min(secondaryBendLimit, length * 0.12);
  const tensionA = 0.28 + seededUnit(seed, 3) * 0.08;
  const tensionB = 0.64 + seededUnit(seed, 4) * 0.08;

  return {
    controlA: source.clone().addScaledVector(delta, tensionA).addScaledVector(normal, bend),
    controlB: source.clone().addScaledVector(delta, tensionB).addScaledVector(normal, -bend * 0.42 + bendB),
  };
}

export function cubicBezierPoint2D(
  source: THREE.Vector2,
  controlA: THREE.Vector2,
  controlB: THREE.Vector2,
  target: THREE.Vector2,
  t: number,
  out = new THREE.Vector2(),
) {
  const u = 1 - t;
  const tt = t * t;
  const uu = u * u;
  const uuu = uu * u;
  const ttt = tt * t;
  out.set(0, 0);
  out.addScaledVector(source, uuu);
  out.addScaledVector(controlA, 3 * uu * t);
  out.addScaledVector(controlB, 3 * u * tt);
  out.addScaledVector(target, ttt);
  return out;
}

export function cubicBezierTangent2D(
  source: THREE.Vector2,
  controlA: THREE.Vector2,
  controlB: THREE.Vector2,
  target: THREE.Vector2,
  t: number,
  out = new THREE.Vector2(),
) {
  const u = 1 - t;
  out.set(0, 0);
  out.addScaledVector(controlA.clone().sub(source), 3 * u * u);
  out.addScaledVector(controlB.clone().sub(controlA), 6 * u * t);
  out.addScaledVector(target.clone().sub(controlB), 3 * t * t);
  if (out.lengthSq() <= 0.000001) out.copy(target).sub(source);
  return out.normalize();
}

export function curvedPathPointAt(segment: MazePathSegment, t: number, morph: MazeMorphOptions = {}, out = new THREE.Vector2()) {
  const point = sampleTerrainCurvePoint(
    terrainCurveSeedFor(segment),
    t,
    morph,
  );
  out.set(point[0], point[1]);
  return out;
}

export function curvedPathTangentAt(segment: MazePathSegment, t: number, morph: MazeMorphOptions = {}, out = new THREE.Vector2()) {
  const tangent = sampleTerrainCurveTangent(
    terrainCurveSeedFor(segment),
    t,
    morph,
  );
  return out.set(tangent[0], tangent[1]);
}

function approximateBezierLength(segment: Omit<MazePathSegment, "curveLength">) {
  let length = 0;
  let previous = segment.source.clone();
  const current = new THREE.Vector2();
  const lengthSamples = 32;
  for (let index = 1; index <= lengthSamples; index += 1) {
    cubicBezierPoint2D(segment.source, segment.controlA, segment.controlB, segment.target, index / lengthSamples, current);
    length += current.distanceTo(previous);
    previous = current.clone();
  }
  return length;
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
    const seed = hashString(pairKey);
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
    const { controlA, controlB } = buildOrganicControlPoints(
      sourcePoint,
      targetPoint,
      seed,
      crownRamp,
    );
    const minX =
      Math.min(sourcePoint.x, controlA.x, controlB.x, targetPoint.x) -
      TERRAIN_PATH_BOUNDS_PADDING;
    const maxX =
      Math.max(sourcePoint.x, controlA.x, controlB.x, targetPoint.x) +
      TERRAIN_PATH_BOUNDS_PADDING;
    const minZ =
      Math.min(sourcePoint.y, controlA.y, controlB.y, targetPoint.y) -
      TERRAIN_PATH_BOUNDS_PADDING;
    const maxZ =
      Math.max(sourcePoint.y, controlA.y, controlB.y, targetPoint.y) +
      TERRAIN_PATH_BOUNDS_PADDING;
    const segmentWithoutLength = {
      key: pairKey,
      role,
      source: sourcePoint,
      controlA,
      controlB,
      target: targetPoint,
      curveSeed: seed / 2147483647,
      crownRamp,
      minX,
      maxX,
      minZ,
      maxZ,
      sourceEntry: source,
      targetEntry: target,
    };

    segments.push({
      ...segmentWithoutLength,
      curveLength: approximateBezierLength(segmentWithoutLength),
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

export function dynamicCorridorWidth(baseWidth: number, minWidth: number, morph: MazeMorphOptions = {}) {
  const memoryPressure = clamp01(morph.memoryPressure ?? 0);
  const explorationDepth = clamp01(morph.explorationDepth ?? 0);
  const pressure = clamp01(explorationDepth * 0.62 + memoryPressure * 0.58);
  const narrowing = Math.pow(memoryPressure, 1.35) * 0.38;
  return THREE.MathUtils.lerp(baseWidth, minWidth, pressure + narrowing);
}

export function valueNoise2D(x: number, z: number, salt = 0) {
  const ix = Math.floor(x);
  const iz = Math.floor(z);
  const fx = x - ix;
  const fz = z - iz;
  const smoothX = fx * fx * (3 - 2 * fx);
  const smoothZ = fz * fz * (3 - 2 * fz);
  const a = worldSeededUnit(ix, iz, salt);
  const b = worldSeededUnit(ix + 1, iz, salt);
  const c = worldSeededUnit(ix, iz + 1, salt);
  const d = worldSeededUnit(ix + 1, iz + 1, salt);
  const ab = THREE.MathUtils.lerp(a, b, smoothX);
  const cd = THREE.MathUtils.lerp(c, d, smoothX);
  return THREE.MathUtils.lerp(ab, cd, smoothZ);
}

export function terrainNoiseAtPoint(x: number, z: number) {
  return sampleTerrainNoise(x, z);
}

type CachedWorldLayoutTerrainSampler = {
  segments: MazePathSegment[];
  explorationDepth: number;
  memoryPressure: number;
  sample: ReturnType<typeof createTerrainSurfaceSampler>;
};

const terrainSamplerCache = new WeakMap<
  Slipper3DEntry[],
  CachedWorldLayoutTerrainSampler
>();

function resolveWorldLayoutTerrainSampler(
  entries: Slipper3DEntry[],
  segments: MazePathSegment[],
  morph: MazeMorphOptions,
) {
  const explorationDepth = clamp01(morph.explorationDepth ?? 0);
  const memoryPressure = clamp01(morph.memoryPressure ?? 0);
  const cached = terrainSamplerCache.get(entries);
  if (
    cached &&
    cached.segments === segments &&
    cached.explorationDepth === explorationDepth &&
    cached.memoryPressure === memoryPressure
  ) {
    return cached.sample;
  }

  const config: TerrainSamplerConfig = {
    clearingSafeRadius: FOREST_CLEARING_RADIUS,
    corridorBaseWidth: CORRIDOR_BASE_WIDTH,
    crownedRampWidth: CROWNED_RETURN_RAMP_WIDTH,
    explorationDepth,
    memoryPressure,
    clearings: entries.map((entry) => ({
      id: entry.id,
      chapter: entry.chapter,
      position: entryWorldPosition(entry, entries),
      radius: getJourneyEntryClearingRadius(entry.id),
      elevated: getJourneyEntryWorldPlacement(entry.id)?.elevated,
    })),
    paths: segments.map((segment) => {
      const source = entryWorldPosition(segment.sourceEntry, entries);
      const target = entryWorldPosition(segment.targetEntry, entries);
      return {
        source: [source[0], source[2]],
        controlA: [segment.controlA.x, segment.controlA.y],
        controlB: [segment.controlB.x, segment.controlB.y],
        target: [target[0], target[2]],
        curveSeed: segment.curveSeed,
        curveLength: segment.curveLength,
        sourceChapter: segment.sourceEntry.chapter,
        targetChapter: segment.targetEntry.chapter,
        sourceY: source[1],
        targetY: target[1],
        crownRamp: segment.crownRamp,
        minX: segment.minX,
        maxX: segment.maxX,
        minZ: segment.minZ,
        maxZ: segment.maxZ,
      };
    }),
  };
  const sample = createTerrainSurfaceSampler(
    config,
    TERRAIN_SIZE,
    TERRAIN_SEGMENTS,
  );
  terrainSamplerCache.set(entries, {
    segments,
    explorationDepth,
    memoryPressure,
    sample,
  });
  return sample;
}

export function terrainElevationAtPoint(
  x: number,
  z: number,
  entries: Slipper3DEntry[],
  segments: MazePathSegment[],
  morph: MazeMorphOptions = {},
) {
  return resolveWorldLayoutTerrainSampler(entries, segments, morph)(x, z);
}

export function buildCrownRampSegments(entries: Slipper3DEntry[]): CrownRampSegment[] {
  const ordered = getOrderedEntries(entries);
  const rampSegments: CrownRampSegment[] = [];

  for (let index = 0; index < ordered.length - 1; index += 1) {
    const sourceEntry = ordered[index];
    const targetEntry = ordered[index + 1];
    const touchesCrown = isChapter(sourceEntry, CHAPTER_CROWNED_RETURN) || isChapter(targetEntry, CHAPTER_CROWNED_RETURN);
    if (!touchesCrown) continue;

    const source = entryWorldPosition(sourceEntry, entries);
    const target = entryWorldPosition(targetEntry, entries);
    const dx = target[0] - source[0];
    const dy = target[1] - source[1];
    const dz = target[2] - source[2];
    const horizontalLength = Math.sqrt(dx * dx + dz * dz);
    if (horizontalLength < 0.001) continue;

    const pitch = -Math.atan2(dy, horizontalLength);
    const yaw = Math.atan2(dx, dz);
    const length = Math.sqrt(horizontalLength * horizontalLength + dy * dy);
    const midX = (source[0] + target[0]) * 0.5;
    const midY = TERRAIN_COLLIDER_Y + (source[1] + target[1]) * 0.5;
    const midZ = (source[2] + target[2]) * 0.5;

    rampSegments.push({
      key: "crown-ramp-" + sourceEntry.id + "-" + targetEntry.id,
      source,
      target,
      position: [midX, midY, midZ],
      rotation: [pitch, yaw, 0],
      args: [CROWNED_RETURN_RAMP_WIDTH * 0.5, CROWNED_RETURN_RAMP_THICKNESS, length * 0.5],
      visualScale: [CROWNED_RETURN_RAMP_WIDTH, CROWNED_RETURN_RAMP_THICKNESS * 2, length],
      color: targetEntry.engine3d.environmentGradient?.[1] ?? "#16120b",
    });
  }

  return rampSegments;
}

export type WorldMapProjection = {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
  scale: number;
  project: (position: Vector3Tuple | [number, number]) => { x: number; y: number };
};

export function fitWorldToMap(points: Vector3Tuple[], size = 300, padding = 28): WorldMapProjection {
  if (points.length === 0) {
    return { project: () => ({ x: size / 2, y: size / 2 }), minX: 0, maxX: 0, minZ: 0, maxZ: 0, scale: 1 };
  }

  let minX = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let minZ = Number.POSITIVE_INFINITY;
  let maxZ = Number.NEGATIVE_INFINITY;

  for (const point of points) {
    minX = Math.min(minX, point[0]);
    maxX = Math.max(maxX, point[0]);
    minZ = Math.min(minZ, point[2]);
    maxZ = Math.max(maxZ, point[2]);
  }

  const spanX = Math.max(1, maxX - minX);
  const spanZ = Math.max(1, maxZ - minZ);
  const scale = Math.min((size - padding * 2) / spanX, (size - padding * 2) / spanZ);
  const offsetX = (size - spanX * scale) / 2;
  const offsetY = (size - spanZ * scale) / 2;

  return {
    minX,
    maxX,
    minZ,
    maxZ,
    scale,
    project: (position: Vector3Tuple | [number, number]) => {
      const x = Array.isArray(position) && position.length === 2 ? position[0] : (position as Vector3Tuple)[0];
      const z = Array.isArray(position) && position.length === 2 ? position[1] : (position as Vector3Tuple)[2];
      return {
        x: offsetX + (x - minX) * scale,
        y: offsetY + (z - minZ) * scale,
      };
    },
  };
}
