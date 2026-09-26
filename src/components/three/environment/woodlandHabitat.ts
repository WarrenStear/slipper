/** Fixed compositions in chapter-local metres. The middle route, bridge, pond,
 * authored flowers and interaction anchors are not populated by this dressing. */
export type WoodlandVariant = "enchanted-wood" | "blue-moon";
export type HabitatPlacement = { position: [number, number, number]; rotation: [number, number, number]; scale: [number, number, number] };
const unit = (i: number) => { const n = Math.sin(i * 127.1 + 37.7) * 43758.5453; return n - Math.floor(n); };
export function habitatTier(quality: string, reducedEffects: boolean) {
  return reducedEffects ? 0 : Math.max(0, ["low", "medium", "high", "cinematic"].indexOf(quality));
}
export function woodlandHabitatLayout(variant: WoodlandVariant, quality: string, reducedEffects = false) {
  const tier = habitatTier(quality, reducedEffects), shore = variant === "blue-moon";
  const plants: HabitatPlacement[] = [], litter: HabitatPlacement[] = [], timber: HabitatPlacement[] = [];
  const count = [10, 16, 22, 26][tier];
  // Each prefix keeps both sides and three depth bands; quality does not reshuffle the image.
  for (let i = 0; i < count; i++) {
    const side = i % 2 ? 1 : -1, row = Math.floor(i / 2), band = row % 3;
    let x = side * (shore ? 10.7 + unit(i + 4) * .95 : 6.9 + unit(i + 4) * 1.5);
    const z = -5.3 + band * 4.3 + Math.floor(row / 3) * .72 + unit(i + 6) * .58;
    const size = (shore ? .7 : .85) + unit(i + 7) * (shore ? .35 : .48);
    if (!shore && x < 0 && Math.abs(z - 1.4) < 4.4) x = Math.min(x, -9.4);
    plants.push({ position: [x, -.2, z], rotation: [0, unit(i + 9) * Math.PI * 2, 0], scale: [size, size, size] });
  }
  for (let i = 0; i < [32, 52, 76, 92][tier]; i++) {
    const side = i % 2 ? 1 : -1;
    let x = side * (shore ? 10.65 + unit(i + 83) * 1.8 : 6.35 + unit(i + 83) * 2.7);
    const z = -6.4 + unit(i + 127) * 15.2;
    const size = .6 + unit(i + 92) * .9;
    if (!shore && Math.hypot(x + 4.8, z - 1.4) < 3.6) x = -8.7;
    litter.push({ position: [x, -.19, z], rotation: [0, unit(i + 94) * 6.28, 0], scale: [size, size, size] });
  }
  const positions: [number, number, number][] = shore
    ? [[11.1, -.16, -4.6], [-11.1, -.16, 5.4]]
    : [[8.35, -.16, -4.9], [-8.65, -.16, 7.3]];
  positions.forEach((position, i) => timber.push({ position, rotation: [0, i ? -.32 : .51, 0], scale: [1, 1, 1] }));
  return { plants, litter, timber };
}
