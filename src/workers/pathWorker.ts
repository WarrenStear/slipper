/// <reference lib="webworker" />

import type { Slipper3DEntry, Vector3Tuple } from "../data/slipper3dTypes.ts";
import { getJourneyEntryWorldPlacement, getJourneyEntryWorldPosition, isJourneyEntryElevated } from "../data/journeyWorldLayout.ts";
import { getOrderedEntries } from "../lib/storyGraph.ts";
import { buildPhysicalStoryLinks, type PhysicalPathRole } from "../lib/worldTopology.ts";
import { createPhysicalRouteGeometry } from "../lib/physicalPathGeometry.ts";

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

function hashString(value: string) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash += (hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24);
  }
  return Math.abs(hash >>> 0);
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

export function buildPathSegments(entries: Slipper3DEntry[]): SerializableMazePathSegment[] {
  const entryMap = new Map(entries.map((entry) => [entry.id, entry]));
  const ordered = getOrderedEntries(entries);
  const orderIndexById = new Map(ordered.map((entry, index) => [entry.id, index]));
  const segments: SerializableMazePathSegment[] = [];
  const seenKeys = new Set<string>();

  const addSegment = (source: Slipper3DEntry | undefined, target: Slipper3DEntry | undefined, role: PhysicalPathRole) => {
    if (!source || !target || source.id === target.id) return;

    const pairKey = [source.id, target.id].sort().join("::");
    if (seenKeys.has(pairKey)) return;
    seenKeys.add(pairKey);

    const a = entryWorldPosition(source, entries);
    const b = entryWorldPosition(target, entries);
    const sourcePoint = { x: a[0], y: a[2] };
    const targetPoint = { x: b[0], y: b[2] };
    const seed = hashString(pairKey);
    const sourcePlacement = getJourneyEntryWorldPlacement(source.id);
    const targetPlacement = getJourneyEntryWorldPlacement(target.id);
    const sourceIndex = orderIndexById.get(source.id) ?? -1;
    const targetIndex = orderIndexById.get(target.id) ?? -1;
    const crownRamp = sourcePlacement && targetPlacement
      ? role === "backbone" && (isJourneyEntryElevated(source.id) || isJourneyEntryElevated(target.id))
      : sourceIndex >= 0 && targetIndex >= 0 &&
        Math.abs(sourceIndex - targetIndex) === 1 &&
        (source.chapter === CHAPTER_CROWNED_RETURN || target.chapter === CHAPTER_CROWNED_RETURN);
    const route = createPhysicalRouteGeometry(sourcePoint, targetPoint, seed, crownRamp);
    const { controlA, controlB } = route;

    segments.push({
      key: pairKey,
      source: sourcePoint,
      controlA,
      controlB,
      target: targetPoint,
      sourceEntryId: source.id,
      targetEntryId: target.id,
      curveSeed: seed / 2147483647,
      curveLength: route.curveLength,
    });
  };

  for (const link of buildPhysicalStoryLinks(entries.map((entry) => ({
    id: entry.id,
    chapter: entry.chapter,
    sequence: entry.sequence,
    position: entryWorldPosition(entry, entries),
  })), { includeScenicLoops: true })) {
    addSegment(entryMap.get(link.sourceId), entryMap.get(link.targetId), link.role);
  }

  return segments;
}

// The builder can be imported by Node-based parity tests without a Web Worker.
if (typeof self !== "undefined") self.onmessage = (event: MessageEvent<PathWorkerRequest>) => {
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
