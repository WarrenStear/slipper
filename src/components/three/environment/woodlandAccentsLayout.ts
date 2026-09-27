import type { HabitatPlacement, WoodlandVariant } from "./woodlandHabitatLayout.ts";

/** Chapter-local decoration: no changes to navigation, collision or story anchors. */
const SAPLING_ANCHORS: readonly [number, number][] = [
  [8.8, -3.8], [-10.1, 6.1], [9, 4.6], [-10.4, -4.4],
  [7.9, 8.5], [-8.4, 9.8], [10.1, .1], [-10.9, .6],
];
const unit = (seed: number) => {
  const value = Math.sin(seed * 127.1 + 37.7) * 43758.5453;
  return value - Math.floor(value);
};

export function woodlandAccentTier(quality: string, reducedEffects: boolean) {
  return reducedEffects ? 0 : Math.max(0, ["low", "medium", "high", "cinematic"].indexOf(quality));
}

export function woodlandAccentsLayout(variant: WoodlandVariant, quality: string, reducedEffects = false) {
  const tier = woodlandAccentTier(quality, reducedEffects), shore = variant === "blue-moon";
  const saplings: HabitatPlacement[] = [], stones: HabitatPlacement[] = [], twigs: HabitatPlacement[] = [];
  // Sanctuary gets ground detail, not trees in the moon / bridge / Swan sightline.
  if (!shore) SAPLING_ANCHORS.slice(0, [2, 4, 6, 8][tier]).forEach(([x, z], i) => {
    const size = .76 + unit(i + 271) * .23;
    saplings.push({ position: [x, -.2, z], rotation: [0, unit(i + 287) * Math.PI * 2, 0], scale: [size, size, size] });
  });
  for (let i = 0; i < [4, 6, 8, 10][tier]; i++) {
    const side = i % 2 ? 1 : -1;
    const x = side * (shore ? 11.2 + unit(i + 311) * .7 : 8.2 + unit(i + 311) * 2.3);
    const z = -5.8 + unit(i + 331) * 12.8;
    const size = .36 + unit(i + 347) * .36;
    stones.push({ position: [x, -.2, z], rotation: [0, unit(i + 359) * Math.PI * 2, 0], scale: [size, size * (.76 + unit(i + 367) * .2), size] });
  }
  for (let i = 0; i < [6, 10, 14, 18][tier]; i++) {
    const side = i % 2 ? 1 : -1;
    let x = side * (shore ? 11 + unit(i + 401) * .9 : 7.3 + unit(i + 401) * 2.7);
    const z = -5.6 + unit(i + 419) * 13;
    // Preserve the existing pond and its authored flowers with an envelope,
    // not just a point test. Scatter remains deterministic across quality tiers.
    if (!shore && Math.hypot(x + 4.8, z - 1.4) < 4.8) x = -10.4;
    const size = .6 + unit(i + 433) * .65;
    twigs.push({ position: [x, -.19, z], rotation: [0, unit(i + 449) * Math.PI * 2, 0], scale: [size, size, size] });
  }
  return { saplings, stones, twigs };
}
