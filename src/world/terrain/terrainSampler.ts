import type { Slipper3DEntry } from "../../data/slipper3dTypes.ts";
import { getJourneyEntryBiome, getJourneyEntryClearingRadius, getJourneyEntryWorldPlacement } from "../../data/journeyWorldLayout.ts";
import type { ForestClearingSeed, ForestPathSeed } from "../../workers/forestWorker.types";
import { createTerrainSurfaceSampler, type TerrainSamplerConfig } from "../../lib/terrainModel.ts";
import { entryWorldPosition } from "./worldPlacement.ts";
import { type MazeMorphOptions, type MazePathSegment } from "./worldPaths.ts";
import { clamp01 } from "../worldMath.ts";
import { CORRIDOR_BASE_WIDTH, CROWNED_RETURN_RAMP_WIDTH, FOREST_CLEARING_RADIUS, TERRAIN_SEGMENTS, TERRAIN_SIZE } from "./worldConstants.ts";

export function packForestClearingSeeds(entries: Slipper3DEntry[]): ForestClearingSeed[] {
  return entries.map((entry) => ({
    id: entry.id,
    chapter: entry.chapter,
    position: entryWorldPosition(entry, entries),
    radius: getJourneyEntryClearingRadius(entry.id),
    biome: getJourneyEntryBiome(entry.id),
    elevated: getJourneyEntryWorldPlacement(entry.id)?.elevated,
  }));
}

export function packForestPathSeeds(pathSegments: MazePathSegment[], entries: Slipper3DEntry[]): ForestPathSeed[] {
  return pathSegments.map((segment) => {
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
      // Only the authored chapter sequence forms a physical ascent. Portal
      // return links from the crowned chapter remain navigable, but must not
      // raise unrelated paths into walls where the graph crosses itself.
      crownRamp: segment.crownRamp,
      minX: segment.minX,
      maxX: segment.maxX,
      minZ: segment.minZ,
      maxZ: segment.maxZ,
    };
  });
}

export type CachedTerrainSampler = {
  segments: MazePathSegment[];
  explorationDepth: number;
  memoryPressure: number;
  config: TerrainSamplerConfig;
  sample: ReturnType<typeof createTerrainSurfaceSampler>;
};

const terrainSamplerCache = new WeakMap<Slipper3DEntry[], CachedTerrainSampler>();

export function resolveTerrainSamplerConfig(
  entries: Slipper3DEntry[],
  segments: MazePathSegment[],
  morph: MazeMorphOptions = {},
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
    return cached;
  }

  const config: TerrainSamplerConfig = {
    clearingSafeRadius: FOREST_CLEARING_RADIUS,
    corridorBaseWidth: CORRIDOR_BASE_WIDTH,
    crownedRampWidth: CROWNED_RETURN_RAMP_WIDTH,
    explorationDepth,
    memoryPressure,
    clearings: packForestClearingSeeds(entries),
    paths: packForestPathSeeds(segments, entries),
  };

  const sampler: CachedTerrainSampler = {
    segments,
    explorationDepth,
    memoryPressure,
    config,
    sample: createTerrainSurfaceSampler(
      config,
      TERRAIN_SIZE,
      TERRAIN_SEGMENTS,
    ),
  };
  terrainSamplerCache.set(entries, sampler);

  return sampler;
}

export function terrainElevationAtPoint(
  x: number,
  z: number,
  entries: Slipper3DEntry[],
  segments: MazePathSegment[],
  morph: MazeMorphOptions = {},
) {
  return resolveTerrainSamplerConfig(entries, segments, morph).sample(x, z);
}

