/** Transient input only. Durable reveal stages remain in the story event ledger. */
export const FLOOR_MASK_SIZE = 64;
export const FLOOR_BRUSH_RADIUS = 0.065;
// The floor spans 12.8 m: a natural close-camera hand sweep covers only
// about 0.02 UV. Require both new surface coverage and deliberate span, not
// a half-metre wipe or raw accumulated cursor distance.
const MIN_STROKE_SPAN = 0.015;
const MIN_STROKE_CELLS = 24;

// Keep the small stamp buffer for compatibility/debugging; the mask never forgets
// earlier marks when that buffer wraps. GPU storage stays fixed at four KiBi.
export const floorBrush = {
  points: new Float32Array(48), count: 0, revision: 0,
  coverage: new Uint8Array(FLOOR_MASK_SIZE * FLOOR_MASK_SIZE),
};
const stroke = {
  active: false, cells: new Uint8Array(FLOOR_MASK_SIZE * FLOOR_MASK_SIZE), count: 0,
  minU: Infinity, maxU: -Infinity, minV: Infinity, maxV: -Infinity,
  lastU: NaN, lastV: NaN, maxSpan: 0,
};

export function beginFloorStroke() {
  stroke.active = true;
  stroke.cells.fill(0); stroke.count = 0; stroke.maxSpan = 0;
  stroke.minU = stroke.minV = Infinity;
  stroke.maxU = stroke.maxV = -Infinity;
  breakFloorStroke();
}

/** Leaving the mesh breaks interpolation; it must not draw across empty space. */
export function breakFloorStroke() {
  stroke.lastU = stroke.lastV = NaN;
  stroke.minU = stroke.minV = Infinity; stroke.maxU = stroke.maxV = -Infinity;
}
export function cancelFloorStroke() { stroke.active = false; breakFloorStroke(); }
export function floorStrokeReady() {
  return stroke.active && stroke.count >= MIN_STROKE_CELLS
    && stroke.maxSpan >= MIN_STROKE_SPAN;
}

function stamp(u: number, v: number) {
  const size = FLOOR_MASK_SIZE;
  const left = Math.max(0, Math.floor((u - FLOOR_BRUSH_RADIUS) * size));
  const right = Math.min(size - 1, Math.ceil((u + FLOOR_BRUSH_RADIUS) * size));
  const bottom = Math.max(0, Math.floor((v - FLOOR_BRUSH_RADIUS) * size));
  const top = Math.min(size - 1, Math.ceil((v + FLOOR_BRUSH_RADIUS) * size));
  for (let y = bottom; y <= top; y++) for (let x = left; x <= right; x++) {
    const distance = Math.hypot((x + .5) / size - u, (y + .5) / size - v);
    if (distance >= FLOOR_BRUSH_RADIUS) continue;
    const t = Math.min(1, distance / FLOOR_BRUSH_RADIUS);
    const strength = Math.round(255 * (1 - t * t * (3 - 2 * t)));
    const index = y * size + x;
    floorBrush.coverage[index] = Math.max(floorBrush.coverage[index], strength);
    if (stroke.active && strength >= 90 && !stroke.cells[index]) {
      stroke.cells[index] = 1; stroke.count++;
    }
  }
}

export function brushFloor(u: number, v: number) {
  if (!Number.isFinite(u) || !Number.isFinite(v) || u < 0 || u > 1 || v < 0 || v > 1) {
    breakFloorStroke(); return;
  }
  // Bound work for both dense pointer streams and a single very long sweep.
  if (stroke.active && Number.isFinite(stroke.lastU)) {
    const steps = Math.min(64, Math.max(1, Math.ceil(Math.hypot(u - stroke.lastU, v - stroke.lastV) / .02)));
    for (let i = 1; i <= steps; i++) stamp(stroke.lastU + (u - stroke.lastU) * i / steps, stroke.lastV + (v - stroke.lastV) * i / steps);
  } else stamp(u, v);
  const index = floorBrush.count % 24;
  floorBrush.points[index * 2] = u;
  floorBrush.points[index * 2 + 1] = v;
  floorBrush.count++;
  floorBrush.revision++;
  if (stroke.active) {
    stroke.lastU = u; stroke.lastV = v;
    stroke.minU = Math.min(stroke.minU, u); stroke.maxU = Math.max(stroke.maxU, u);
    stroke.minV = Math.min(stroke.minV, v); stroke.maxV = Math.max(stroke.maxV, v);
    stroke.maxSpan = Math.max(stroke.maxSpan, Math.hypot(stroke.maxU - stroke.minU, stroke.maxV - stroke.minV));
  }
}

export function resetFloorBrush() {
  floorBrush.points.fill(0); floorBrush.coverage.fill(0);
  floorBrush.count = 0; floorBrush.revision++;
  cancelFloorStroke();
}
