import { NEUTRAL_CINEMATIC_PROFILE, type EmotionalProfile } from "./emotionalProfiles.ts";

export const CINEMATIC_CHANNELS = Object.keys(NEUTRAL_CINEMATIC_PROFILE) as (keyof EmotionalProfile)[];
const current: EmotionalProfile = { ...NEUTRAL_CINEMATIC_PROFILE };
let activeDirectors = 0;

/** One active world canvas; frame consumers read this without a React subscription. */
export function getCurrentCinematicProfile(): Readonly<EmotionalProfile> { return current; }
export function isCinematicProfileActive() { return activeDirectors > 0; }
export function activateCinematicProfile() {
  activeDirectors += 1;
  return () => { activeDirectors = Math.max(0, activeDirectors - 1); if (activeDirectors === 0) resetCinematicProfile(); };
}
export function resetCinematicProfile() { Object.assign(current, NEUTRAL_CINEMATIC_PROFILE); }
export function cinematicBlendAlpha(delta: number, rate = 0.62) {
  return 1 - Math.exp(-Math.max(0, Math.min(Number.isFinite(delta) ? delta : 0, 0.1)) * rate);
}
export function blendCinematicProfile(output: EmotionalProfile, target: Readonly<EmotionalProfile>, delta: number) {
  const alpha = cinematicBlendAlpha(delta);
  for (const key of CINEMATIC_CHANNELS) output[key] += (target[key] - output[key]) * alpha;
  return output;
}
export function advanceCinematicProfile(target: Readonly<EmotionalProfile>, delta: number) {
  return blendCinematicProfile(current, target, delta);
}
export function resolveCameraAttraction({ assistance, reducedMotion, secondsSinceInput, inputActive, attraction, facingDot }: {
  assistance: boolean; reducedMotion: boolean; secondsSinceInput: number; inputActive: boolean; attraction: number; facingDot: number;
}) {
  if (!assistance || reducedMotion || inputActive || secondsSinceInput < 2.4 || facingDot < 0.68) return 0;
  return Math.max(0, Math.min(0.018, attraction)) * Math.min(1, (secondsSinceInput - 2.4) / 2);
}
