type LinearRGB = { r: number; g: number; b: number };
const channel = (value: number) => Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : 0;

/** Low-cost sky reflection approximation, not a scene capture. Inputs and output
 * are linear RGB, like Three.js Color. Mutate a retained target without allocating
 * a new colour each frame; the caller applies the world's transition response.
 */
export function writeWaterSkyTarget(target: LinearRGB, horizon: LinearRGB, key: LinearRGB, warm = false): void {
  const r = channel(horizon.r) * .92 + channel(key.r) * .08;
  const g = channel(horizon.g) * .92 + channel(key.g) * .08;
  const b = channel(horizon.b) * .92 + channel(key.b) * .08;
  target.r = channel(r * (warm ? 1.06 : 1));
  target.g = channel(g * (warm ? .97 : 1));
  target.b = channel(b * (warm ? .82 : 1));
}
