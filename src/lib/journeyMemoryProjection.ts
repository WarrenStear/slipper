import { JOURNEY_ENTRY_WORLD_PLACEMENTS, getJourneyEntryWorldPosition } from "../data/journeyWorldLayout.ts";
import { JOURNEY_ENTRY_CONTEXT } from "../data/journeyNarrative.ts";

export type MemoryPoint = [number, number, number];
const positions = JOURNEY_ENTRY_WORLD_PLACEMENTS.map(entry => entry.position);
const minX = Math.min(...positions.map(point => point[0])), maxX = Math.max(...positions.map(point => point[0]));
const minZ = Math.min(...positions.map(point => point[2])), maxZ = Math.max(...positions.map(point => point[2]));
const centerX = (minX + maxX) / 2, centerZ = (minZ + maxZ) / 2;
const scale = Math.min(19.6 / Math.max(1, maxX - minX), 8.2 / Math.max(1, maxZ - minZ));

/** A fixed map projection preserves the actual geography, including Echo spurs. */
export function memoryStarPosition(entryId: string): MemoryPoint {
  const point = getJourneyEntryWorldPosition(entryId);
  if (!point) throw new Error(`Unknown journey memory: ${entryId}`);
  return [(point[0] - centerX) * scale, 9.6 - (point[2] - centerZ) * scale, -20 + point[1] * .025];
}

export function memoryGroundPosition(entryId: string): MemoryPoint {
  const point = memoryStarPosition(entryId);
  return [point[0], .35, -16 - (point[1] - 9.6) * 1.2];
}

/** Last encountered place lights first; revisits do not invent duplicate stars. */
export function reverseJourneyMemoryEntries(history: readonly string[]) {
  const seen = new Set<string>();
  const entries: string[] = [];
  for (let index = history.length - 1; index >= 0; index--) {
    const id = history[index];
    const context = JOURNEY_ENTRY_CONTEXT[id];
    if (!context || context.sceneId === "epilogue.constellation" || seen.has(id)) continue;
    seen.add(id);
    entries.push(id);
  }
  return entries;
}

export function reverseMemoryRevealAt(index: number, count: number) {
  return 800 + index * (21_600 / Math.max(1, count - 1));
}

export function reverseMemoryIllumination(elapsedMs: number, index: number, count: number) {
  return Math.max(0, Math.min(1, (elapsedMs - reverseMemoryRevealAt(index, count)) / 1100));
}
