import { createLandscapeHeightIndex } from "./landscapeHeightIndex.ts";

/** Deterministic chapter-local landscape. Metres, +Y up; no story/store dependency. */
export type LandscapePoint = [number, number, number];
export type LandscapePlacement = { position: LandscapePoint; rotation: LandscapePoint; scale: LandscapePoint };
export type LandscapeFamily = "woodland" | "meadow" | "riverbank" | "upland" | "highland" | "home";
export type LandscapeSpec = Readonly<{
  family: LandscapeFamily; inner: number; outer: number; length: number;
  height: number; riverSide: -1 | 0 | 1; seed: number;
}>;
export type LandscapeBuffers = { positions: number[]; normals: number[]; uvs: number[]; colors: number[]; indices: number[] };
export const LANDSCAPE_GRID = Object.freeze({ across: 24, along: 40 });
export const LANDSCAPE_CAPACITY = Object.freeze({ trees: 30, stones: 40, timber: 8, reeds: 40 });
export const LANDSCAPE_WATER_Y = .94;
const GROUND_Y = -.24;
const FAMILIES: Record<LandscapeFamily, LandscapeSpec> = {
  woodland: { family: "woodland", inner: 18, outer: 38, length: 17, height: 4.8, riverSide: 1, seed: 11 },
  meadow: { family: "meadow", inner: 20, outer: 38, length: 16, height: 3.8, riverSide: 0, seed: 23 },
  riverbank: { family: "riverbank", inner: 26, outer: 44, length: 17, height: 5.8, riverSide: 0, seed: 37 },
  upland: { family: "upland", inner: 20, outer: 40, length: 17, height: 6.2, riverSide: 1, seed: 47 },
  highland: { family: "highland", inner: 23, outer: 43, length: 18, height: 8.2, riverSide: 0, seed: 59 },
  home: { family: "home", inner: 27, outer: 45, length: 16, height: 4.3, riverSide: -1, seed: 71 },
};
// Explicit inclusion avoids rivers in rooms, mirrors, the moon sanctuary or epilogue.
export const LANDSCAPE_SCENES: Readonly<Record<string, LandscapeFamily>> = Object.freeze({
  "enchanted.rabbit-hole": "woodland", "enchanted.friendship-meadow": "woodland", "enchanted.masked-hearth": "woodland",
  "nest.two-hands": "meadow", "nest.unsupported-cycle": "meadow", "nest.protection": "meadow",
  "wolf-swan.false-choice": "riverbank", "wolf-swan.convergence": "riverbank",
  "fire.boundary": "riverbank", "river.wash": "riverbank", "river.release-surrender": "riverbank",
  "fork.weighing": "upland", "fork.four-verbs": "upland", "fork.relinquish-hope": "upland",
  "climbs.arrival": "highland", "climb.mind": "highland", "climb.heart": "highland", "climb.womb": "highland",
  "crowned.threshold": "home", "crowned.home": "home", "crowned.sovereignty": "home",
});
for (const spec of Object.values(FAMILIES)) Object.freeze(spec);
export function landscapeForScene(sceneId: string): LandscapeSpec | null {
  // Preserve own-property checks without requiring an ES2022 browser API.
  return Object.prototype.hasOwnProperty.call(LANDSCAPE_SCENES, sceneId) ? FAMILIES[LANDSCAPE_SCENES[sceneId]] : null;
}
const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
const smooth = (a: number, b: number, v: number) => { const t = clamp01((v - a) / (b - a)); return t * t * (3 - 2 * t); };
const mix = (a: number, b: number, t: number) => a + (b - a) * t;
const unit = (seed: number) => { const n = Math.sin(seed * 127.1 + 37.7) * 43758.5453; return n - Math.floor(n); };
export function landscapeBudget(quality: string, reducedEffects = false) {
  const tier = reducedEffects ? 0 : Math.max(0, ["low", "medium", "high", "cinematic"].indexOf(quality));
  return { trees: [8, 14, 22, 30][tier], stones: [10, 18, 28, 40][tier], timber: [2, 4, 6, 8][tier], reeds: [10, 18, 28, 40][tier] };
}
export function landscapeRiverCentre(spec: LandscapeSpec, z: number) {
  return (spec.inner + spec.outer) * .5 + Math.sin(z * .16 + spec.seed * .1) * 1.6 + Math.sin(z * .31) * .45;
}
export function landscapeRiverWidth(spec: LandscapeSpec, z: number) {
  return 1.28 + .28 * Math.sin(z * .17 + spec.seed); // half-width, in metres
}
/** Analytic broad hills are independent of rendering quality. */
function landscapeHeight(spec: LandscapeSpec, x: number, z: number) {
  const r = Math.abs(x), side = Math.sign(x), span = spec.outer - spec.inner;
  const edge = smooth(0, 2.2, r - spec.inner) * smooth(0, 2.2, spec.outer - r);
  const end = smooth(0, 3.2, spec.length - Math.abs(z));
  const shoulderA = Math.exp(-((r - spec.inner - span * .72) ** 2 / 19 + (z - 4.5 * side) ** 2 / 74));
  const shoulderB = Math.exp(-((r - spec.inner - span * .37) ** 2 / 15 + (z + 8.3 * side) ** 2 / 39));
  const broad = .48 + spec.height * (shoulderA + shoulderB * .67);
  let height = broad;
  if (side === spec.riverSide) {
    const distance = Math.abs(r - landscapeRiverCentre(spec, z)), width = landscapeRiverWidth(spec, z);
    // A cut channel, not water laid over hills. Bed is below the surface;
    // shoreline vertices coincide with the water edge in every row.
    const bed = .56 + .36 * smooth(0, width, distance);
    const bank = Math.max(1.32, broad);
    height = distance <= width ? bed : mix(.92, bank, smooth(0, 2.2, distance - width));
    // River reaches continue to the edge, while the hill mass blends down.
    height = mix(height, .56 + .36 * smooth(0, width, distance), (1 - end) * (1 - smooth(width, width + 2.2, distance)));
  }
  return mix(GROUND_Y, height, edge * (side === spec.riverSide ? Math.max(end, 1 - smooth(0, 3, Math.abs(r - landscapeRiverCentre(spec, z)) - landscapeRiverWidth(spec, z))) : end));
}
function blank(): LandscapeBuffers { return { positions: [], normals: [], uvs: [], colors: [], indices: [] }; }
function accumulateNormals(data: LandscapeBuffers) {
  const { positions: p, indices, normals: n } = data;
  n.push(...new Array(p.length).fill(0));
  for (let i = 0; i < indices.length; i += 3) {
    const a = indices[i] * 3, b = indices[i + 1] * 3, c = indices[i + 2] * 3;
    const ux = p[b] - p[a], uy = p[b + 1] - p[a + 1], uz = p[b + 2] - p[a + 2];
    const vx = p[c] - p[a], vy = p[c + 1] - p[a + 1], vz = p[c + 2] - p[a + 2];
    const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
    for (const at of [a, b, c]) { n[at] += nx; n[at + 1] += ny; n[at + 2] += nz; }
  }
  for (let i = 0; i < n.length; i += 3) {
    const length = Math.hypot(n[i], n[i + 1], n[i + 2]) || 1;
    n[i] /= length; n[i + 1] /= length; n[i + 2] /= length;
  }
}
/** One combined land mesh, with both sides outside the authored clearing. */
export function createLandscapeTerrain(spec: LandscapeSpec): LandscapeBuffers {
  const data = blank(), { across, along } = LANDSCAPE_GRID;
  for (const side of [-1, 1]) {
    const base = data.positions.length / 3;
    for (let row = 0; row <= along; row++) {
      const z = mix(-spec.length, spec.length, row / along);
      const c = landscapeRiverCentre(spec, z), w = landscapeRiverWidth(spec, z);
      for (let col = 0; col <= across; col++) {
        let r = mix(spec.inner, spec.outer, col / across);
        if (side === spec.riverSide) r = col <= 10 ? mix(spec.inner, c - w, col / 10)
          : col <= 14 ? mix(c - w, c + w, (col - 10) / 4) : mix(c + w, spec.outer, (col - 14) / 10);
        const x = side * r, y = landscapeHeight(spec, x, z);
        data.positions.push(x, y, z); data.uvs.push(r * .12, z * .12);
        const damp = side === spec.riverSide ? 1 - smooth(w, w + 1.2, Math.abs(r - c)) : 0;
        const stone = smooth(spec.height * .44, spec.height * .92, y);
        const variation = .90 + .10 * Math.sin(r * .64 + z * .38);
        data.colors.push(mix(.70, .76, stone) * variation * (1 - damp * .18), mix(.77, .75, stone) * variation * (1 - damp * .16), mix(.54, .68, stone) * variation * (1 - damp * .12));
      }
    }
    for (let row = 0; row < along; row++) for (let col = 0; col < across; col++) {
      const a = base + row * (across + 1) + col, b = a + 1, c = a + across + 1, d = c + 1;
      if (side === 1) data.indices.push(a, c, b, b, c, d); else data.indices.push(a, b, c, b, d, c);
    }
  }
  accumulateNormals(data);
  return data;
}
/** Water geometry is XY because NarrativeWater applies its existing -PI/2 tilt. */
export function createLandscapeRiver(spec: LandscapeSpec): LandscapeBuffers | null {
  if (!spec.riverSide) return null;
  const data = blank(), rows = LANDSCAPE_GRID.along;
  for (let row = 0; row <= rows; row++) {
    const z = mix(-spec.length, spec.length, row / rows), centre = landscapeRiverCentre(spec, z), width = landscapeRiverWidth(spec, z);
    const left = spec.riverSide * centre - width, right = spec.riverSide * centre + width;
    for (const [x, u] of [[left, 0], [right, 1]]) {
      data.positions.push(x, -z, 0); data.normals.push(0, 0, 1); data.uvs.push(u, 1 - row / rows); data.colors.push(1, 1, 1);
    }
    if (row < rows) { const a = row * 2; data.indices.push(a, a + 2, a + 1, a + 1, a + 2, a + 3); }
  }
  return data;
}
/** Exact height on the rendered triangles, avoiding floating props on hill crests. */
export function heightOnLandscape(data: LandscapeBuffers, x: number, z: number): number | null {
  const p = data.positions;
  for (let i = 0; i < data.indices.length; i += 3) {
    const a = data.indices[i] * 3, b = data.indices[i + 1] * 3, c = data.indices[i + 2] * 3;
    if (x < Math.min(p[a], p[b], p[c]) - 1e-7 || x > Math.max(p[a], p[b], p[c]) + 1e-7 || z < Math.min(p[a + 2], p[b + 2], p[c + 2]) - 1e-7 || z > Math.max(p[a + 2], p[b + 2], p[c + 2]) + 1e-7) continue;
    const den = (p[b + 2] - p[c + 2]) * (p[a] - p[c]) + (p[c] - p[b]) * (p[a + 2] - p[c + 2]);
    const u = ((p[b + 2] - p[c + 2]) * (x - p[c]) + (p[c] - p[b]) * (z - p[c + 2])) / den;
    const v = ((p[c + 2] - p[a + 2]) * (x - p[c]) + (p[a] - p[c]) * (z - p[c + 2])) / den;
    if (u >= -1e-7 && v >= -1e-7 && u + v <= 1 + 1e-7) return u * p[a + 1] + v * p[b + 1] + (1 - u - v) * p[c + 1];
  }
  return null;
}
export function landscapeObjectRadius(kind: keyof typeof LANDSCAPE_CAPACITY, size: number) {
  return { trees: 1.5, stones: 1.12, timber: .84, reeds: .7 }[kind] * size;
}
/** Build the richest deterministic layout once; all quality levels draw its prefixes. */
export function createLandscapeObjects(spec: LandscapeSpec, terrain: LandscapeBuffers) {
  const { sampleHeight } = createLandscapeHeightIndex(terrain);
  const result: Record<keyof typeof LANDSCAPE_CAPACITY, LandscapePlacement[]> = { trees: [], stones: [], timber: [], reeds: [] };
  for (const kind of Object.keys(result) as (keyof typeof result)[]) {
    for (let trial = 0; trial < 1800 && result[kind].length < LANDSCAPE_CAPACITY[kind]; trial++) {
      const salt = spec.seed * 101 + trial * 7 + ["trees", "stones", "timber", "reeds"].indexOf(kind) * 271;
      const side = trial % 2 ? 1 : -1, size = kind === "trees" ? 1.28 + unit(salt) * .82 : kind === "stones" ? .48 + unit(salt) * .70 : kind === "timber" ? 1.1 + unit(salt) * 1.25 : .7 + unit(salt) * .55;
      const radius = landscapeObjectRadius(kind, size);
      const r = mix(spec.inner + radius + .3, spec.outer - radius - .3, unit(salt + 1));
      const z = mix(-spec.length + radius + 1.5, spec.length - radius - 1.5, unit(salt + 2));
      const distance = Math.abs(r - landscapeRiverCentre(spec, z));
      if (side === spec.riverSide && distance < landscapeRiverWidth(spec, z) + radius + .45) continue;
      const x = side * r, y = sampleHeight(x, z);
      if (y === null || y < .18) continue;
      if (kind === "trees" && result.trees.some(tree => Math.hypot(tree.position[0] - x, tree.position[2] - z) < (tree.scale[0] + size) * .88)) continue;
      result[kind].push({ position: [x, y - .035, z], rotation: [0, unit(salt + 3) * Math.PI * 2, 0], scale: [size, size * (kind === "trees" ? .88 + unit(salt + 4) * .38 : 1), size] });
    }
  }
  return result;
}