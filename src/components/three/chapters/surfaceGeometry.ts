export type StonePathForm = {
  position: [number, number, number];
  rotation: [number, number, number];
  scale: [number, number, number];
};

/** The original path transforms, expressed for one shared eight-sided circle. */
export function stonePathLayout(count = 9, length = 12, fork = 0, y = 0): StonePathForm[] {
  if (![count, length, fork, y].every(Number.isFinite)) return [];
  const visible = Math.min(256, Math.max(0, Math.floor(count)));
  return Array.from({ length: visible }, (_, index) => {
    const progress = visible <= 1 ? 0 : index / (visible - 1);
    const radius = .72 + (index % 3) * .11;
    return {
      position: [fork * Math.max(0, progress - .42) * 6 + Math.sin(index * 2.2) * .18, y, -length * .5 + progress * length],
      rotation: [-Math.PI / 2, 0, index * .27],
      scale: [radius, radius, 1],
    };
  });
}

/** Static hanging folds: the upper edge stays pinned, with at most 10 cm depth. */
export function veilFoldDepth(u: number, v: number, width: number): number {
  if (![u, v, width].every(Number.isFinite)) return 0;
  const down = 1 - Math.min(1, Math.max(0, v));
  if (down === 0) return 0;
  const amplitude = Math.min(.1, Math.abs(width) * .04);
  return Math.sin(u * Math.PI * 7 + down * .65) * amplitude * down;
}
