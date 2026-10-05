import type { Slipper3DEntry, Vector3Tuple } from "../../data/slipper3dTypes.ts";
import { getJourneyEntryWorldPosition } from "../../data/journeyWorldLayout.ts";
import { getOrderedEntries } from "../../lib/storyGraph.ts";
import { buildPhysicalStoryLinks } from "../../lib/worldTopology.ts";
import { AUTHORED_WORLD_SCALE, CHAPTER_BLUE_MOON_ARCHIVE, CHAPTER_CROWNED_RETURN, CHAPTER_FIRE_AND_RIVER, CHAPTER_MIRROR_CLEARING, CHAPTER_THORNED_HOUSE, CONSTELLATION_CENTER, CONSTELLATION_WORLD_SCALE, CROWNED_RETURN_ASCENT_HEIGHT, CROWNED_RETURN_BASE_RISE } from "./worldConstants.ts";

export type ChapterBiome = "firstWood" | "mirror" | "thorned" | "archive" | "fireRiver" | "crowned";

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

  // Compiled archives carry a deliberate 3D placement. Honour it before the
  // 2D constellation projection or procedural fallback so the walkable world
  // keeps its authored scale, spacing, and short opening route.
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

export type SpatialStoryNode = {
  entry: Slipper3DEntry;
  position: Vector3Tuple;
  isActive: boolean;
  isVisited: boolean;
  graphDistance: 0 | 1 | 2;
};

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

const clearingPositionCache = new WeakMap<Slipper3DEntry[], Vector3Tuple[]>();

export function getCachedClearingPositions(entries: Slipper3DEntry[]) {
  let cached = clearingPositionCache.get(entries);
  if (!cached) {
    cached = entries.map((entry) => entryWorldPosition(entry, entries));
    clearingPositionCache.set(entries, cached);
  }
  return cached;
}

