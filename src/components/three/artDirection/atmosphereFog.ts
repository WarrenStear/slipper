/** Transparent local effects share the active FogExp2 state with opaque surfaces.
 * Do not use a target look here: the scene fog is interpolated during transitions.
 * A missing/linear fog has no exponential density; malformed values fail clear.
 */
export function readAtmosphereFogDensity(fog: unknown): number {
  if (!fog || typeof fog !== "object" || !("density" in fog)) return 0;
  const density = fog.density;
  return typeof density === "number" && Number.isFinite(density) ? Math.max(0, density) : 0;
}
