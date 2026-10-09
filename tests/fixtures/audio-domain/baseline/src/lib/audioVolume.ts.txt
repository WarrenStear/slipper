function clamp01(value: number) {
  return Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));
}

export function resolveAudioTargetVolume(
  narrativeTarget: number,
  userVolume: number,
  enabled: boolean,
) {
  if (!enabled) return 0;
  return Math.max(0, Number.isFinite(narrativeTarget) ? narrativeTarget : 0) *
    clamp01(userVolume);
}
