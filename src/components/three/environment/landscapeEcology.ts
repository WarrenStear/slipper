import { createLandscapeHeightIndex } from "./landscapeHeightIndex.ts";
import { landscapeRiverCentre, landscapeRiverWidth, type LandscapeBuffers, type LandscapePlacement, type LandscapeSpec } from "./landscapeGeography.ts";
import { BIOME_ECOLOGY_CAPACITY, ENVIRONMENT_THEMES } from "./environmentThemes.ts";
import { terrainScatterRotation, type ScatterRotation } from "./terrainScatterRotation.ts";

type EcologyKind = keyof typeof BIOME_ECOLOGY_CAPACITY;
const unit = (seed: number) => { const n = Math.sin(seed * 127.1 + 61.7) * 43758.5453; return n - Math.floor(n); };
export const ecologyRadius = (kind: EcologyKind, scale: number) => (kind === "evergreens" ? 1.3 : kind === "grass" ? .7 : .45) * scale;

/** Terrain-aware clustered ecology, not a second terrain generator. Every
 * placement samples the visible/collidable triangles, with dry-bank and slope
 * exclusions. Build maximum capacity once, then draw stable quality prefixes. */
export function createLandscapeEcology(spec: LandscapeSpec, terrain: LandscapeBuffers, existingTrees: readonly LandscapePlacement[]) {
  const theme = ENVIRONMENT_THEMES[spec.family], { sampleHeight } = createLandscapeHeightIndex(terrain);
  const result: Record<EcologyKind, LandscapePlacement[]> = { evergreens: [], grass: [], flowers: [] };
  for (const kind of Object.keys(result) as EcologyKind[]) {
    if (kind === "flowers" && !theme.meadowFlowers) continue;
    const capacity = BIOME_ECOLOGY_CAPACITY[kind];
    for (let trial = 0; trial < 2400 && result[kind].length < capacity; trial++) {
      const salt = spec.seed * 113 + trial * 17 + (kind === "evergreens" ? 0 : kind === "grass" ? 1301 : 2801);
      const scale = kind === "evergreens" ? theme.evergreenScale * (.88 + unit(salt) * .32) : kind === "grass" ? .72 + unit(salt) * .5 : .75 + unit(salt) * .4;
      const radius = ecologyRadius(kind, scale);
      const side = trial % 2 ? 1 : -1;
      let x = side * (spec.inner + radius + 1 + unit(salt + 1) * (spec.outer - spec.inner - radius * 2 - 2));
      let z = (unit(salt + 2) * 2 - 1) * (spec.length - radius - 2);
      // Low vegetation gathers beside existing trees; alternating trials retain
      // open-grass patches. Stable seeds keep both sides represented in each tier.
      if (kind !== "evergreens" && trial % 3 !== 0 && existingTrees.length) {
        const anchor = existingTrees[Math.floor(trial / 3) % existingTrees.length];
        const angle = unit(salt + 3) * Math.PI * 2, distance = 1.5 + unit(salt + 4) * 2.6;
        x = anchor.position[0] + Math.cos(angle) * distance;
        z = anchor.position[2] + Math.sin(angle) * distance;
      }
      if (Math.abs(x) - radius < spec.inner + .2 || Math.abs(x) + radius > spec.outer - .2 || Math.abs(z) + radius > spec.length - .4) continue;
      if (Math.sign(x) === spec.riverSide && Math.abs(Math.abs(x) - landscapeRiverCentre(spec, z)) < landscapeRiverWidth(spec, z) + radius + .55) continue;
      const y = sampleHeight(x, z), east = sampleHeight(x + radius * .5, z), north = sampleHeight(x, z + radius * .5);
      if (y === null || east === null || north === null || y < .25) continue;
      const slopeX = (east - y) / (radius * .5), slopeZ = (north - y) / (radius * .5);
      if (Math.hypot(slopeX, slopeZ) > (kind === "evergreens" ? .7 : .85)) continue;
      if (kind === "evergreens") {
        const tooClose = (tree: LandscapePlacement) => Math.hypot(x - tree.position[0], z - tree.position[2]) < radius + tree.scale[0] * 1.5 + .3;
        if (existingTrees.some(tooClose) || result.evergreens.some(tooClose)) continue;
      }
      if (result[kind].some(item => Math.hypot(x - item.position[0], z - item.position[2]) < radius * .65)) continue;
      // Keep the existing heading seed and upright trees. Low vegetation aligns
      // to the capped ground normal before a local heading turn; random heading
      // must not reverse the slope or lift one side of a cluster off the bank.
      const heading = unit(salt + 5) * Math.PI * 2;
      const rotation: ScatterRotation = kind === "evergreens" ? [0, heading, 0]
        : terrainScatterRotation(slopeX, slopeZ, heading);
      result[kind].push({ position: [x, y - .055, z], rotation, scale: [scale, scale, scale] });
    }
  }
  return result;
}
