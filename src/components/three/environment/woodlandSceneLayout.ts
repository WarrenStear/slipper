import type { DressingForm, Point3 } from "./chapterEnvironment.ts";

/** Same flowers, positions, sizes and colours as the authored meadow. */
export function meadowFlowerForms(reducedEffects: boolean) {
  const stems: DressingForm[] = [], flowers: DressingForm[] = [];
  for (let i = 0; i < (reducedEffects ? 8 : 18); i++) {
    const x = (i % 2 === 0 ? -1 : 1) * (2.7 + (i % 5) * .72);
    const z = -6 + Math.floor(i / 2) * 1.3;
    stems.push({ position: [x, .28, z], scale: [1, .4, 1] });
    flowers.push({ position: [x, .5, z], scale: [1, 1, 1], color: i % 3 === 0 ? "#c697a5" : i % 3 === 1 ? "#d8d2b4" : "#8da38b" });
  }
  return { stems, flowers };
}

/** Flatten existing parent rotations into instance matrices. The home, sky,
 * actors, memory lights, and every original tree anchor stay where they were. */
export function finalWoodlandForms(positions: readonly Point3[], requestedCount: number) {
  const count = Math.min(8, positions.length, Math.max(0, Number.isFinite(requestedCount) ? Math.floor(requestedCount) : 0));
  const trunks: DressingForm[] = [], crowns: DressingForm[] = [], roots: DressingForm[] = [];
  for (let i = 0; i < count; i++) {
    const [px, py, pz] = positions[i], h = 6.4 + (i % 3) * 1.25;
    const angle = i * 1.37, c = Math.cos(angle), s = Math.sin(angle);
    const world = (x: number, y: number, z: number): Point3 => [px + x * c + z * s, py + y, pz - x * s + z * c];
    trunks.push({ position: world(0, h * .5, 0), scale: [1, h, 1], rotation: [0, angle, 0] });
    const offsets = [[-.7, h - .35, .18], [.58, h + .1, -.24], [0, h + 1.15, .05]];
    for (const [j, [x, y, z]] of offsets.entries()) {
      crowns.push({ position: world(x, y, z), scale: [1.6 + j * .14, 1.9, 1.45], rotation: [0, angle, 0], color: j === 1 ? "#2e3b34" : "#26322d" });
      const a = angle + j * Math.PI * 2 / 3;
      roots.push({ position: [px + Math.cos(a) * .45, py - .025, pz + Math.sin(a) * .45], scale: [1.15, .105, .24], rotation: [0, -a, 0] });
    }
  }
  return { trunks, crowns, roots };
}
