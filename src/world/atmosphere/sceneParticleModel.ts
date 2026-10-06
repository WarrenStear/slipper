export type ParticleRegion = { center: readonly number[]; size: readonly number[] };

export function sceneParticleRegion(kind: string | undefined): ParticleRegion {
  return kind === "ash" ? { center: [0, .1, 4], size: [2.5, 3, 2.5] }
    : kind === "pollen" ? { center: [-1.8, .6, 5], size: [5, 5.5, 7] }
    : kind === "dust" ? { center: [-1.5, .8, 4], size: [4, 2.5, 4] }
    : { center: [5, .1, 5], size: [3, 1.1, 9] };
}

export function sceneParticleCount(authoredCount: number, particleScale: number, enabled: boolean, reducedEffects: boolean, sceneId: string) {
  if (!enabled || reducedEffects || sceneId === "epilogue.constellation" || !Number.isFinite(particleScale) || particleScale <= 0) return 0;
  return Math.min(56, Math.round(authoredCount * Math.min(1, particleScale)));
}

/** Preserve the bounded coprime seeds; changing quality keeps the surviving points. */
export function sceneParticlePositions(count: number, region: ParticleRegion) {
  const points = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    points[i * 3] = region.center[0] + ((i * 17 % 59) / 59 - .5) * region.size[0];
    points[i * 3 + 1] = region.center[1] + (i * 23 % 61) / 61 * region.size[1];
    points[i * 3 + 2] = region.center[2] + ((i * 31 % 67) / 67 - .5) * region.size[2];
  }
  return points;
}
