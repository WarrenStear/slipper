import { terrainDistanceToPathSq, terrainSeededUnit, type TerrainMorphState } from "../../lib/terrainModel.ts";
import type { ForestClearingSeed, ForestPathSeed } from "../../workers/forestWorker.types";
import { WILLOW_POOL } from "../terrain/explorationLayout.ts";
import { TERRAIN_BASE_Y } from "../terrain/worldConstants.ts";

export const FOREST_FLOOR_CAPACITY = { ferns: 150, grass: 220 } as const;
export type ForestFloorPlant = { x: number; y: number; z: number; scale: number; yaw: number; seed: number };
/** Stable world-grid clusters. Camera cells only select an overlapping window;
 * changing quality never moves an existing plant or fills a walking corridor. */
export function forestFloorLayout(cellX: number, cellZ: number, paths: readonly ForestPathSeed[], clearings: readonly ForestClearingSeed[], ground: (x: number, z: number) => number, morph: TerrainMorphState = {}) {
  const ferns: ForestFloorPlant[] = [], grass: ForestFloorPlant[] = [];
  const candidates: ForestFloorPlant[] = [];
  for (let dz = -8; dz <= 8; dz++) for (let dx = -8; dx <= 8; dx++) {
    const gx = cellX * 2 + dx, gz = cellZ * 2 + dz;
    const seed = terrainSeededUnit(gx, gz, 41);
    if (seed < .12) continue;
    const x = gx * 2.4 + (terrainSeededUnit(gx, gz, 42) - .5) * 2.2;
    const z = gz * 2.4 + (terrainSeededUnit(gx, gz, 43) - .5) * 2.2;
    // This pass dresses the first woodland and its refuge, not later biomes.
    if (z < -392 || z > -254 || Math.abs(x) > 112) continue;
    if (clearings.some(c => Math.hypot(x - c.position[0], z - c.position[2]) < (c.id === "geography.willow-refuge" ? 4 : Math.max(7.8, (c.radius ?? 0) * .55)))) continue;
    if (paths.some(path => x >= path.minX && x <= path.maxX && z >= path.minZ && z <= path.maxZ && terrainDistanceToPathSq(x, z, path, morph) < 4 ** 2)) continue;
    const y = ground(x, z);
    if (Math.hypot((x - WILLOW_POOL.x) / 12.5, (z - WILLOW_POOL.z) / 9.5) < 1 || y < TERRAIN_BASE_Y - .12) continue;
    candidates.push({ x, y, z, scale: .8 + terrainSeededUnit(gx, gz, 44) * .65, yaw: seed * Math.PI * 2, seed });
  }
  candidates.sort((a, b) => a.seed - b.seed);
  for (const plant of candidates) {
    if (ferns.length < FOREST_FLOOR_CAPACITY.ferns) ferns.push(plant);
    if (grass.length < FOREST_FLOOR_CAPACITY.grass) {
      const x = plant.x + .55, z = plant.z + .5;
      grass.push({ ...plant, x, z, y: ground(x, z), scale: plant.scale * .8 });
    }
  }
  return { ferns, grass };
}
export function forestFloorBudget(quality: string) {
  return quality === "cinematic" ? { ferns: 150, grass: 220 } : quality === "high" ? { ferns: 130, grass: 180 } : quality === "medium" ? { ferns: 80, grass: 120 } : { ferns: 48, grass: 72 };
}
