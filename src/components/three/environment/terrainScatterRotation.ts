export type ScatterRotation = [number, number, number];
export const MAX_SCATTER_TILT = .35;
const TAU = Math.PI * 2;

/** Align +Y to the capped terrain normal, then turn around that local +Y.
 * Returning XYZ Euler angles matches Object3D.rotation.set used by instance
 * batches. Mixing world slope angles with an Euler Y rotation does not: the
 * random heading changes the normal, and the old slope signs pointed uphill.
 * This runs only during layout construction; no Three.js objects are allocated.
 */
export function terrainScatterRotation(slopeX: number, slopeZ: number, heading: number, maxTilt = MAX_SCATTER_TILT): ScatterRotation {
  const sx = Number.isFinite(slopeX) ? slopeX : 0;
  const sz = Number.isFinite(slopeZ) ? slopeZ : 0;
  const yaw = Number.isFinite(heading) ? heading % TAU : 0;
  const limit = Number.isFinite(maxTilt) ? Math.max(0, Math.min(Math.PI / 4, maxTilt)) : MAX_SCATTER_TILT;
  // Scaling before normalization also keeps malformed enormous gradients finite.
  const scale = Math.max(1, Math.abs(sx), Math.abs(sz));
  const dx = sx / scale, dz = sz / scale, length = Math.hypot(dx, dz);
  if (length === 0 || limit === 0) return [0, yaw, 0];
  const tilt = Math.min(limit, Math.atan(length * scale));
  const halfSin = Math.sin(tilt / 2), halfCos = Math.cos(tilt / 2);
  // Shortest arc from [0,1,0] to normalize([-slopeX,1,-slopeZ]).
  const ax = -dz / length * halfSin, az = dx / length * halfSin;
  const sy = Math.sin(yaw / 2), cy = Math.cos(yaw / 2);
  // q = surfaceAlignment * localHeading: heading cannot change the up vector.
  const x = ax * cy - az * sy, y = halfCos * sy;
  const z = ax * sy + az * cy, w = halfCos * cy;
  const m11 = 1 - 2 * (y * y + z * z), m12 = 2 * (x * y - z * w);
  const m13 = 2 * (x * z + y * w), m22 = 1 - 2 * (x * x + z * z);
  const m23 = 2 * (y * z - x * w), m32 = 2 * (y * z + x * w);
  const m33 = 1 - 2 * (x * x + y * y);
  const ry = Math.asin(Math.max(-1, Math.min(1, m13)));
  return Math.abs(m13) < 1 - 1e-12
    ? [Math.atan2(-m23, m33), ry, Math.atan2(-m12, m11)]
    : [Math.atan2(m32, m22), ry, 0];
}
