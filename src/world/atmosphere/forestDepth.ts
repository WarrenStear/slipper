import type { MistPatch } from "./groundMistField.ts";

type ForestDepthComposition = {
  readonly negativeSpace?: number;
  readonly horizonOpenness?: number;
  readonly focalPoint?: readonly number[];
};

const unit = (value: number | undefined) => Number.isFinite(value) ? Math.max(0, Math.min(1, value!)) : 0;
const finiteBounded = (value: number, fallback: number, min: number, max: number) => Number.isFinite(value) ? Math.max(min, Math.min(max, value)) : fallback;

/** Composition can clear an open sightline, never thicken its authored air. */
export function forestSightlineFactor(composition?: ForestDepthComposition | null): number {
  return Math.max(.68, 1 - .32 * unit(composition?.horizonOpenness) * unit(composition?.negativeSpace));
}

/** The canonical .025 density ceiling remains in force before composition. */
export function forestFogDensity(density: number, composition?: ForestDepthComposition | null): number {
  return finiteBounded(density, 0, 0, .025) * forestSightlineFactor(composition);
}

/** Move the existing axis-aligned banks beside the local focal corridor.
 * Translation alone preserves their flattened geometry, normal correction and
 * shader. Their original forward depth, height and dimensions stay intact.
 */
export function composeGroundMist(patches: readonly MistPatch[], composition?: ForestDepthComposition | null): readonly MistPatch[] {
  if (!patches.length) return patches;
  const focal = composition?.focalPoint;
  const x = Number.isFinite(focal?.[0]) ? focal![0] : 0;
  const z = Number.isFinite(focal?.[2]) ? focal![2] : 0;
  // Scale first so even a finite, exceptionally long focal vector normalises.
  const magnitude = Math.max(Math.abs(x), Math.abs(z));
  const length = magnitude > 0 ? Math.hypot(x / magnitude, z / magnitude) : 1;
  const forwardX = magnitude > 0 ? x / magnitude / length : 0;
  const forwardZ = magnitude > 0 ? z / magnitude / length : 1;
  const normalX = forwardZ, normalZ = -forwardX;
  const clearance = 3.2 + 4.2 * unit(composition?.negativeSpace) + 2.4 * unit(composition?.horizonOpenness);
  return patches.map((patch, index): MistPatch => {
    const px = finiteBounded(patch[0], 0, -64, 64), pz = finiteBounded(patch[2], 0, -64, 64);
    const sx = finiteBounded(patch[3], 1, .001, 16), sz = finiteBounded(patch[5], 1, .001, 16);
    const lateral = px * normalX + pz * normalZ;
    const side = lateral < 0 ? -1 : lateral > 0 ? 1 : index % 2 ? 1 : -1;
    // Support radius of the scaled sphere along the corridor's lateral axis.
    const radius = Math.hypot(normalX * sx, normalZ * sz);
    const shift = side * Math.max(0, clearance + radius + .2 - Math.abs(lateral));
    return [px + normalX * shift, finiteBounded(patch[1], .2, -16, 16), pz + normalZ * shift,
      sx, finiteBounded(patch[4], .3, .001, 16), sz];
  });
}
