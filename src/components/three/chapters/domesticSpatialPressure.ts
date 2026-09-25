import type { ConstructionPiece } from "./chapterArtGeometry.ts";
import { THORNED_HOUSE_MEMORY_SURFACES, type ThornedHouseColliderSpec } from "../../../lib/thornedHouseArchitecture.ts";

const unit = (value: number) => Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : 0;

/** Presentation of accepted evidence only; it cannot advance a domestic cycle. */
export function nestSpatialPressure(sceneId: string, compressed: boolean, resting: boolean) {
  if (resting || sceneId === "nest.protection") return .08;
  if (sceneId === "nest.unsupported-cycle") return compressed ? 1 : .38;
  return .16;
}

/** The protected rest at [-1, 3.5] and the central approach never move. */
export function nestDomesticLayout(pressure: number, reducedEffects: boolean) {
  const amount = unit(pressure);
  const timber: ConstructionPiece[] = [], linen: ConstructionPiece[] = [];
  const sideX = 3.82 - amount * .85;
  for (const side of [-1, 1]) {
    const x = side * sideX, z = side < 0 ? -.7 : .05;
    // Familiar slatted laundry benches: supported tops, aprons and four legs.
    for (const offset of [-.3, 0, .3]) timber.push({ position: [x, .76, z + offset], size: [1.4, .1, .285] });
    for (const dx of [-.56, .56]) for (const dz of [-.31, .31]) timber.push({ position: [x + dx, .36, z + dz], size: [.12, .72, .12] });
    timber.push({ position: [x, .61, z + .32], size: [1.28, .19, .085] });
    // A chair back interrupts peripheral sightlines, never the child-space.
    for (const dx of [-.56, .56]) timber.push({ position: [x + dx, 1.18, z + .37], size: [.1, .88, .1] });
    for (const y of [1.23, 1.54]) timber.push({ position: [x, y, z + .37], size: [1.16, .12, .07] });
    const layers = 1 + Math.floor(amount * (reducedEffects ? 2 : 3));
    for (let layer = 0; layer < layers; layer++) linen.push({
      position: [x + (layer % 2 ? .13 : -.09), .9 + layer * .16, z - .04],
      size: [1.05 - layer * .12, .15, .67], rotation: [0, side * (.06 + layer * .08), 0],
    });
  }
  // The accumulated objects occupy only the outer approach, not either rest target.
  const stacks = amount > .6 ? reducedEffects ? 2 : 4 : 0;
  for (let index = 0; index < stacks; index++) {
    const side = index % 2 ? 1 : -1;
    linen.push({ position: [side * (2.3 + Math.floor(index / 2) * .5), .16, -2.0 + Math.floor(index / 2) * .55], size: [.7, .3, .62], rotation: [0, side * .16, 0] });
  }
  return { timber, linen, pressure: amount };
}

/** The SceneLook director owns the refill-to-compression mapping. */
export function houseSpatialPressure(pathCompression: number, leaving: boolean) {
  return leaving ? 0 : unit(pathCompression / .6);
}

/** A table and its objects move together; the narrowest table keeps a .9 m half-route. */
export function houseSurfaceInset(index: number, pressure: number) {
  const surface = THORNED_HOUSE_MEMORY_SURFACES[index];
  if (!surface) return 0;
  const available = Math.max(0, Math.abs(surface.position[0]) - surface.size[0] / 2 - .9);
  return -Math.sign(surface.position[0]) * Math.min(.45 * unit(pressure), available);
}

export function houseClutterInset(index: number, pressure: number) {
  // Floor clutter retains the existing explicit release route and its colliders.
  if (index < 0 || index >= 14) return 0;
  return houseSurfaceInset(index < 4 ? 0 : index < 7 ? 1 : index < 10 ? 2 : 3, pressure);
}

export function housePressureCollider(spec: ThornedHouseColliderSpec, pressure: number): ThornedHouseColliderSpec {
  const index = Number(spec.id.split("-").at(-1));
  const inset = spec.role === "memory-surface" ? houseSurfaceInset(index, pressure)
    : spec.role === "memory-clutter" ? houseClutterInset(index, pressure) : 0;
  return inset ? { ...spec, position: [spec.position[0] + inset, spec.position[1], spec.position[2]] } : spec;
}

/** Overhead depth cues stay above a standing player, including on small screens. */
export function houseCeilingLayout(pressure: number, count: number) {
  const amount = unit(pressure), pieces: ConstructionPiece[] = [];
  const boundedCount = Math.max(4, Math.min(7, Math.floor(Number.isFinite(count) ? count : 4)));
  for (let index = 0; index < boundedCount; index++) {
    const t = index / (boundedCount - 1);
    const z = -1.25 + t * 7.7;
    const underside = 3.9 - amount * (1.1 + t * .55);
    const width = 3.55 - t * .45;
    pieces.push({ position: [0, underside + .14, z], size: [width, .28, .5] });
    // Deep plaster reveals shorten upward sightlines; timber edges retain room scale.
    pieces.push({ position: [0, underside + .48, z + .12], size: [width, .4, .15] });
  }
  return pieces;
}
