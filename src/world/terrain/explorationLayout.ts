import type { ForestClearingSeed, ForestPathSeed } from "../../workers/forestWorker.types";

/** Geography only: these places are deliberately absent from the literary graph. */
export const WILLOW_REFUGE = { x: -53, z: -320, radius: 15 } as const;
export const WILLOW_POOL = { x: -63, z: -313, radiusX: 11, radiusZ: 8, surfaceOffset: -.14 } as const;

/** The shallow basin is cut into the shared terrain, including its worker collider. */
export function explorationDepressionAtPoint(x: number, z: number, clearings: readonly { id: string }[]) {
  const r = Math.hypot((x - WILLOW_POOL.x) / WILLOW_POOL.radiusX, (z - WILLOW_POOL.z) / WILLOW_POOL.radiusZ);
  if (r >= 1 || !clearings.some(clearing => clearing.id === "geography.willow-refuge")) return 0;
  return -.85 * (1 - r * r) ** 2;
}
export const WILLOW_ROUTE: readonly (readonly [number, number])[] = [
  [-8, -354], [-30, -347], [-48, -336], [-53, -320], [-46, -301], [-29, -287], [-14, -278],
];
// A second way out joins the meadow; neither route requires a witnessed fragment.
export const WILLOW_RETURN: readonly (readonly [number, number])[] = [[-53, -320], [-33, -317], [-13, -324], [10, -330]];

export function hasCanonicalGeography(entries: readonly { id: string }[]) {
  return entries.some(entry => entry.id === "fragment-001") && entries.some(entry => entry.id === "fragment-066");
}

export function explorationClearings(): ForestClearingSeed[] {
  return [{ id: "geography.willow-refuge", chapter: "The Enchanted Wood", position: [WILLOW_REFUGE.x, 0, WILLOW_REFUGE.z], radius: WILLOW_REFUGE.radius, biome: "firstWood" }];
}

export function explorationPaths(): ForestPathSeed[] {
  return [WILLOW_ROUTE, WILLOW_RETURN].flatMap(route => route.slice(1).map((point, i) => {
    const start = route[i], dx = point[0] - start[0], dz = point[1] - start[1];
    return {
      source: [start[0], start[1]], target: [point[0], point[1]],
      controlA: [start[0] + dx / 3, start[1] + dz / 3], controlB: [start[0] + dx * 2 / 3, start[1] + dz * 2 / 3],
      curveSeed: .43, curveLength: Math.hypot(dx, dz), sourceChapter: "The Enchanted Wood", targetChapter: "The Enchanted Wood",
      sourceY: 0, targetY: 0, crownRamp: false,
      minX: Math.min(start[0], point[0]) - 12, maxX: Math.max(start[0], point[0]) + 12,
      minZ: Math.min(start[1], point[1]) - 12, maxZ: Math.max(start[1], point[1]) + 12,
    };
  }));
}
