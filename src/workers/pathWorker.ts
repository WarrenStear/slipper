/// <reference lib="webworker" />

import type { Slipper3DEntry, Vector3Tuple } from "../data/slipper3dTypes";
import { getJourneyEntryWorldPosition } from "../data/journeyWorldLayout";
import { getOrderedEntries } from "../lib/storyGraph";
import { buildPhysicalStoryLinks } from "../lib/worldTopology";

const CONSTELLATION_CENTER = 120;
const CONSTELLATION_WORLD_SCALE = 0.72;
const AUTHORED_WORLD_SCALE = 1.5;
const CHAPTER_CROWNED_RETURN = "The Crowned Return";
const CROWNED_RETURN_BASE_RISE = 2.6;
const CROWNED_RETURN_ASCENT_HEIGHT = 32;

type Point2D = { x: number; y: number };

export type SerializableMazePathSegment = {
  key: string;
  source: Point2D;
  controlA: Point2D;
  controlB: Point2D;
  target: Point2D;
  curveSeed: number;
  curveLength: number;
  sourceEntryId: string;
  targetEntryId: string;
};

export type PathWorkerRequest = {
  id: string;
  type: "BUILD_PATH_SEGMENTS";
  entries: Slipper3DEntry[];
};

export type PathWorkerResponse =
  | {
      id: string;
      type: "PATH_SEGMENTS_RESULT";
      segments: SerializableMazePathSegment[];
      durationMs: number;
    }
  | {
      id: string;
      type: "PATH_SEGMENTS_ERROR";
      error: string;
    };

function clamp01(value: number) {
  return Math.max(0, Math.min(1, value));
}

function hashString(value: string) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash += (hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24);
  }
  return Math.abs(hash >>> 0);
}

function seededUnit(seed: number, index: number) {
  const x = Math.sin(seed * 999 + index * 77.13) * 10000;
  return x - Math.floor(x);
}

function chapterProgress(entry: Slipper3DEntry, entries: Slipper3DEntry[], chapter: string) {
  const ordered = getOrderedEntries(entries).filter((candidate) => candidate.chapter === chapter);
  const index = ordered.findIndex((candidate) => candidate.id === entry.id);
  if (index < 0) return 0;
  return ordered.length <= 1 ? 1 : index / (ordered.length - 1);
}

function crownedReturnElevation(entry: Slipper3DEntry, entries: Slipper3DEntry[]) {
  if (entry.chapter !== CHAPTER_CROWNED_RETURN) return 0;
  const progress = chapterProgress(entry, entries, CHAPTER_CROWNED_RETURN);
  const eased = progress * progress * (3 - 2 * progress);
  return CROWNED_RETURN_BASE_RISE + eased * CROWNED_RETURN_ASCENT_HEIGHT;
}

function entryWorldPosition(entry: Slipper3DEntry, entries: Slipper3DEntry[]): Vector3Tuple {
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

function cubicBezierPoint(source: Point2D, controlA: Point2D, controlB: Point2D, target: Point2D, t: number): Point2D {
  const safeT = clamp01(t);
  const u = 1 - safeT;
  const tt = safeT * safeT;
  const uu = u * u;
  const uuu = uu * u;
  const ttt = tt * safeT;

  return {
    x: source.x * uuu + controlA.x * 3 * uu * safeT + controlB.x * 3 * u * tt + target.x * ttt,
    y: source.y * uuu + controlA.y * 3 * uu * safeT + controlB.y * 3 * u * tt + target.y * ttt,
  };
}

function distance(a: Point2D, b: Point2D) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function estimateCurveLength(source: Point2D, controlA: Point2D, controlB: Point2D, target: Point2D) {
  let length = 0;
  let previous = source;

  for (let index = 1; index <= 32; index += 1) {
    const point = cubicBezierPoint(source, controlA, controlB, target, index / 32);
    length += distance(point, previous);
    previous = point;
  }

  return length;
}

function buildControlPoints(source: Point2D, target: Point2D, seed: number) {
  const dx = target.x - source.x;
  const dy = target.y - source.y;
  const length = Math.max(0.001, Math.hypot(dx, dy));
  const directionX = dx / length;
  const directionY = dy / length;
  const normalX = -directionY;
  const normalY = directionX;

  const bend = (seededUnit(seed, 1) * 2 - 1) * Math.min(22, length * 0.24);
  const bendB = (seededUnit(seed, 2) * 2 - 1) * Math.min(18, length * 0.18);
  const tensionA = 0.26 + seededUnit(seed, 3) * 0.13;
  const tensionB = 0.64 + seededUnit(seed, 4) * 0.13;

  return {
    controlA: {
      x: source.x + dx * tensionA + normalX * bend,
      y: source.y + dy * tensionA + normalY * bend,
    },
    controlB: {
      x: source.x + dx * tensionB + normalX * (-bend * 0.45 + bendB),
      y: source.y + dy * tensionB + normalY * (-bend * 0.45 + bendB),
    },
  };
}

function buildPathSegments(entries: Slipper3DEntry[]): SerializableMazePathSegment[] {
  const entryMap = new Map(entries.map((entry) => [entry.id, entry]));
  const segments: SerializableMazePathSegment[] = [];
  const seenKeys = new Set<string>();

  const addSegment = (source?: Slipper3DEntry, target?: Slipper3DEntry) => {
    if (!source || !target || source.id === target.id) return;

    const pairKey = [source.id, target.id].sort().join("::");
    if (seenKeys.has(pairKey)) return;
    seenKeys.add(pairKey);

    const a = entryWorldPosition(source, entries);
    const b = entryWorldPosition(target, entries);
    const sourcePoint = { x: a[0], y: a[2] };
    const targetPoint = { x: b[0], y: b[2] };
    const seed = hashString(pairKey);
    const { controlA, controlB } = buildControlPoints(sourcePoint, targetPoint, seed);

    segments.push({
      key: pairKey,
      source: sourcePoint,
      controlA,
      controlB,
      target: targetPoint,
      sourceEntryId: source.id,
      targetEntryId: target.id,
      curveSeed: seed / 2147483647,
      curveLength: estimateCurveLength(sourcePoint, controlA, controlB, targetPoint),
    });
  };

  for (const link of buildPhysicalStoryLinks(entries.map((entry) => ({
    id: entry.id,
    chapter: entry.chapter,
    sequence: entry.sequence,
    position: entryWorldPosition(entry, entries),
  })))) {
    addSegment(entryMap.get(link.sourceId), entryMap.get(link.targetId));
  }

  return segments;
}

self.onmessage = (event: MessageEvent<PathWorkerRequest>) => {
  const message = event.data;
  if (message.type !== "BUILD_PATH_SEGMENTS") return;

  try {
    const start = performance.now();
    const segments = buildPathSegments(message.entries);
    const response: PathWorkerResponse = {
      id: message.id,
      type: "PATH_SEGMENTS_RESULT",
      segments,
      durationMs: performance.now() - start,
    };
    self.postMessage(response);
  } catch (error) {
    const response: PathWorkerResponse = {
      id: message.id,
      type: "PATH_SEGMENTS_ERROR",
      error: error instanceof Error ? error.message : "Unknown path worker error",
    };
    self.postMessage(response);
  }
};

export {};
