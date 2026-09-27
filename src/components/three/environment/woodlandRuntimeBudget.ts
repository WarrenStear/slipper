/** Allocation ceilings, not visible counts. Quality changes only the active prefix. */
export const WOODLAND_BATCH_CAPACITY = Object.freeze({ saplings: 12, stones: 10, twigs: 18, fungi: 12 });
export const FIREFLY_CAPACITY = 18;

export function boundedDrawCount(requested: number, capacity: number): number {
  if (!Number.isFinite(requested) || !Number.isFinite(capacity)) return 0;
  return Math.max(0, Math.min(Math.floor(requested), Math.floor(capacity)));
}

/** Clamp against the actual allocated matrix buffer, not an assumed quality tier. */
export function setActiveInstanceCount(mesh: { count: number; instanceMatrix: { count: number } }, requested: number): number {
  const count = boundedDrawCount(requested, mesh.instanceMatrix.count);
  mesh.count = count;
  return count;
}

/** Keep the point sprite's size limits in the same pixel space as its attenuation. */
export function effectPixelRatio(value: number): number {
  return Number.isFinite(value) && value > 0 ? Math.max(.5, Math.min(2, value)) : 1;
}
