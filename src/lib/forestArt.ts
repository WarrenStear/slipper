/** Three species-like crown habits share branch geometry and existing draw calls. */
export function forestCrownHabit(seed: number): readonly [number, number, number] {
  return seed < 0.28 ? [0.78, 1.22, 0.84] : seed < 0.68 ? [1.12, 0.86, 1.08] : [1.04, 1.02, 0.8];
}
