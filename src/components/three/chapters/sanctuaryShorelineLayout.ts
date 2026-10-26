import { artNoise } from "../environmentArt/authoredGeometry.ts";
export type ShorelineInstance = { position: [number, number, number]; scale: [number, number, number]; yaw: number };
/** The established shoreline transforms, stored as bounded instance data. */
export function sanctuaryShorelineLayout() {
  const rocks: ShorelineInstance[] = [], plants: ShorelineInstance[] = [], gravel: ShorelineInstance[] = [];
  for (let i = 0; i < 40; i++) {
    const side = i % 2 ? 1 : -1, x = side * (10.05 + artNoise(43, i) * 1.1), z = -7 + artNoise(58, i) * 14;
    const scale = .13 + artNoise(69, i) ** 2 * .52, size = .5 + artNoise(91, i) * .8;
    rocks.push({ position: [x, -.055, z], scale: [scale * 1.3, scale * .65, scale], yaw: i * 2.4 });
    plants.push({ position: [side * (10.7 + artNoise(11, i) * .7), -.1, z], scale: [size, size, size], yaw: i * 1.7 });
  }
  for (let i = 0; i < 96; i++) {
    const side = i % 4, along = (artNoise(114, i) * 2 - 1) * (side < 2 ? 8 : 10.4);
    if (side >= 2 && Math.abs(along) < 2) continue;
    const across = (side < 2 ? 9.9 : 7.8) + artNoise(117, i) * .9;
    const x = side < 2 ? (side === 0 ? -across : across) : along;
    const z = side < 2 ? along : (side === 2 ? -across : across);
    const scale = .035 + artNoise(121, i) * .095;
    gravel.push({ position: [x, -.012, z], scale: [scale * 1.4, scale * .65, scale], yaw: i * 2.4 });
  }
  return { rocks, plants, gravel };
}
