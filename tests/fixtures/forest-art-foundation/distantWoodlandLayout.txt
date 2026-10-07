export const distantWoodlandUnit = (n: number) => { const x = Math.sin(n * 127.1 + 61.7) * 43758.5453; return x - Math.floor(x); };

/** Irregular patches, not a cylindrical horizon attached to the camera.
 * Stable prefixes keep gaps and depth on low quality; all geometry stays distant. */
export function distantWoodlandLayout(count: number) {
  return Array.from({ length: Math.min(96, Math.max(0, count)) }, (_, i) => {
    const bank = i % 4, row = Math.floor(i / 4);
    const cross = -68 + (row * 37 % 137) + (distantWoodlandUnit(i + 8) - .5) * 11;
    const depth = 42 + Math.floor(row / 6) * 22 + distantWoodlandUnit(i + 18) * 14;
    return {
      x: bank < 2 ? (bank ? 1 : -1) * depth : cross,
      z: bank < 2 ? cross : (bank === 2 ? 1 : -1) * depth,
      height: 10 + distantWoodlandUnit(i + 27) * 10,
      width: .28 + distantWoodlandUnit(i + 59) * .36,
      crown: 2.4 + distantWoodlandUnit(i + 71) * 2.6,
      yaw: distantWoodlandUnit(i + 83) * Math.PI * 2,
    };
  });
}
