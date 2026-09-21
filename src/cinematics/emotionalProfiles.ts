import type { JourneySceneId } from "../lib/storyJourneyState.ts";

/** Authored film language, separate from progression and archive tags. */
export type EmotionalProfile = {
  fov: number;
  movementWeight: number;
  cameraDamping: number;
  horizonStability: number;
  gazeAttraction: number;
  framingBias: number;
  exposure: number;
  contrast: number;
  warmth: number;
  fogDensity: number;
  visibility: number;
  airMovement: number;
  particleActivity: number;
  audioPressure: number;
  silenceBias: number;
  lowpassHz: number;
  pathCompression: number;
  keyIntensity: number;
  fillIntensity: number;
};

export const NEUTRAL_CINEMATIC_PROFILE: Readonly<EmotionalProfile> = Object.freeze({
  fov: 65, movementWeight: 1, cameraDamping: 1, horizonStability: 1,
  gazeAttraction: 0, framingBias: 0, exposure: 1.12, contrast: 1,
  warmth: 0.5, fogDensity: 0.008, visibility: 90, airMovement: 0.35,
  particleActivity: 0.2, audioPressure: 1, silenceBias: 0, lowpassHz: 18000,
  pathCompression: 0, keyIntensity: 0.38, fillIntensity: 0.16,
});

const film = (values: Partial<EmotionalProfile>): Readonly<EmotionalProfile> =>
  Object.freeze({ ...NEUTRAL_CINEMATIC_PROFILE, ...values });

// Warmth is not a morality scale: the familiar Fork and coercive House retain
// warmth, while the freer future remains clear, undecorated and uncertain.
export const EMOTIONAL_PROFILES = {
  "broken-floor.confession": film({ fov: 69, exposure: 0.88, contrast: 1.35, warmth: 0.35, fogDensity: 0.014, visibility: 42, airMovement: 0.04, particleActivity: 0, silenceBias: 0.4, fillIntensity: 0.07, movementWeight: 1.08 }),
  "enchanted.rabbit-hole": film({ fov: 67, gazeAttraction: 0.018, framingBias: 0.08, warmth: 0.65, airMovement: 0.35, fogDensity: 0.01, cameraDamping: 1.15 }),
  "enchanted.friendship-meadow": film({ fov: 68, warmth: 0.62, visibility: 110, fogDensity: 0.006, fillIntensity: 0.23, airMovement: 0.22, gazeAttraction: 0.006 }),
  "enchanted.masked-hearth": film({ fov: 65, warmth: 0.7, contrast: 1.22, fillIntensity: 0.1, framingBias: -0.12, gazeAttraction: 0.012, airMovement: 0.14 }),
  "blue-moon.sanctuary": film({ fov: 63, warmth: 0.42, exposure: 1.03, contrast: 1.2, gazeAttraction: 0.017, fogDensity: 0.012, visibility: 75, airMovement: 0.18, fillIntensity: 0.15 }),
  "blue-moon.intimacy": film({ fov: 62, warmth: 0.55, exposure: 1.04, gazeAttraction: 0.014, framingBias: 0.08, fogDensity: 0.013, visibility: 65, airMovement: 0.12, silenceBias: 0.06 }),
  "blue-moon.caged-bird": film({ fov: 60, warmth: 0.54, exposure: 0.99, contrast: 1.3, gazeAttraction: 0.006, framingBias: -0.13, fogDensity: 0.014, airMovement: 0.08, lowpassHz: 7600, pathCompression: 0.3 }),
  "nest.two-hands": film({ fov: 64, warmth: 0.7, movementWeight: 1.06, fillIntensity: 0.26, airMovement: 0.14, visibility: 65, audioPressure: 0.94 }),
  "nest.unsupported-cycle": film({ fov: 61, warmth: 0.69, movementWeight: 1.19, cameraDamping: 1.35, fillIntensity: 0.23, airMovement: 0.27, audioPressure: 1.16, pathCompression: 0.26, lowpassHz: 11000 }),
  "nest.protection": film({ fov: 65, warmth: 0.69, movementWeight: 1.02, fillIntensity: 0.25, airMovement: 0.08, audioPressure: 0.74, silenceBias: 0.12 }),
  "sunset.warning-grove": film({ fov: 64, warmth: 0.59, exposure: 0.99, contrast: 1.4, fillIntensity: 0.065, framingBias: -0.18, visibility: 125, fogDensity: 0.005, airMovement: 0.08 }),
  "sunset.true-mirror": film({ fov: 63, warmth: 0.5, exposure: 1.03, contrast: 1.25, framingBias: -0.08, visibility: 130, fogDensity: 0.005, airMovement: 0.06, silenceBias: 0.15 }),
  "sunset.stillness": film({ fov: 64, warmth: 0.5, visibility: 145, fogDensity: 0.0035, airMovement: 0.02, particleActivity: 0, silenceBias: 0.52 }),
  "thorned.locked-garden": film({ fov: 65, warmth: 0.7, fillIntensity: 0.22, visibility: 60, fogDensity: 0.009, lowpassHz: 13000, pathCompression: 0.08 }),
  "thorned.old-memory-bedroom": film({ fov: 59, warmth: 0.67, exposure: 0.94, fillIntensity: 0.11, visibility: 38, fogDensity: 0.016, movementWeight: 1.12, lowpassHz: 1800, audioPressure: 1.08, pathCompression: 0.6, airMovement: 0.02 }),
  "thorned.self-owned-world": film({ fov: 66, warmth: 0.54, exposure: 1.1, visibility: 100, fogDensity: 0.006, silenceBias: 0.15, lowpassHz: 15000, airMovement: 0.22 }),
  "wolf-swan.false-choice": film({ fov: 65, warmth: 0.5, contrast: 1.2, framingBias: 0, airMovement: 0.2, audioPressure: 1.05 }),
  "wolf-swan.convergence": film({ fov: 67, warmth: 0.52, visibility: 115, fogDensity: 0.005, airMovement: 0.08, silenceBias: 0.2, fillIntensity: 0.2 }),
  "fire.boundary": film({ fov: 64, warmth: 0.6, exposure: 0.95, contrast: 1.65, fillIntensity: 0.045, keyIntensity: 0.48, airMovement: 0.08, particleActivity: 0.12, silenceBias: 0.18, visibility: 72 }),
  "river.wash": film({ fov: 69, warmth: 0.43, exposure: 1.08, contrast: 0.92, fillIntensity: 0.24, airMovement: 0.13, visibility: 125, fogDensity: 0.0045, audioPressure: 0.82, movementWeight: 1.06 }),
  "river.release-surrender": film({ fov: 68, warmth: 0.48, exposure: 1.08, contrast: 0.98, visibility: 130, fogDensity: 0.004, airMovement: 0.045, particleActivity: 0.02, silenceBias: 0.7, audioPressure: 0.32 }),
  "fork.weighing": film({ fov: 65, warmth: 0.64, contrast: 1.12, framingBias: -0.12, airMovement: 0.15, movementWeight: 1.08, fogDensity: 0.01, visibility: 70 }),
  "fork.four-verbs": film({ fov: 65, warmth: 0.56, contrast: 1.16, airMovement: 0.1, movementWeight: 1.04, silenceBias: 0.16, fogDensity: 0.008, visibility: 80 }),
  "fork.relinquish-hope": film({ fov: 67, warmth: 0.5, contrast: 1.08, airMovement: 0.18, silenceBias: 0.24, fogDensity: 0.005, visibility: 115 }),
  "climbs.arrival": film({ fov: 68, warmth: 0.5, fogDensity: 0.005, visibility: 125, airMovement: 0.24 }),
  "climb.mind": film({ fov: 65, warmth: 0.46, contrast: 1.12, audioPressure: 1.14, particleActivity: 0, fogDensity: 0.009, visibility: 75, pathCompression: 0.14 }),
  "climb.heart": film({ fov: 68, warmth: 0.55, exposure: 1.04, contrast: 1.12, airMovement: 0.12, audioPressure: 0.8, silenceBias: 0.16, fogDensity: 0.006, visibility: 110 }),
  "climb.womb": film({ fov: 70, warmth: 0.54, exposure: 1.16, fillIntensity: 0.24, visibility: 160, fogDensity: 0.003, airMovement: 0.25, silenceBias: 0.12 }),
  "crowned.threshold": film({ fov: 70, warmth: 0.54, exposure: 1.15, visibility: 170, fogDensity: 0.003, fillIntensity: 0.24, airMovement: 0.22 }),
  "crowned.home": film({ fov: 70, warmth: 0.55, exposure: 1.17, visibility: 170, fogDensity: 0.003, fillIntensity: 0.25, airMovement: 0.2, silenceBias: 0.18 }),
  "crowned.sovereignty": film({ fov: 70, warmth: 0.54, exposure: 1.17, visibility: 170, fogDensity: 0.003, fillIntensity: 0.25, airMovement: 0.14, silenceBias: 0.6 }),
  "epilogue.constellation": film({ fov: 70, warmth: 0.46, exposure: 1.04, visibility: 230, fogDensity: 0.002, fillIntensity: 0.13, airMovement: 0.08, particleActivity: 0, silenceBias: 0.5 }),
} satisfies Record<JourneySceneId, Readonly<EmotionalProfile>>;

export type CinematicStoryState = { lanternOwned?: boolean; surrenderComplete?: boolean; compression?: number; mindReleased?: boolean; creationComplete?: boolean; nestHandsOccupied?: number; nestBurdenResting?: boolean };

export function resolveCinematicProfile(sceneId: JourneySceneId, state: CinematicStoryState = {}): EmotionalProfile {
  const profile = { ...EMOTIONAL_PROFILES[sceneId] };
  if (state.lanternOwned) profile.gazeAttraction = 0;
  if (sceneId.startsWith("nest.") && state.nestHandsOccupied !== undefined) {
    profile.movementWeight = state.nestBurdenResting ? 1.02 : 1 + Math.min(2, Math.max(0, state.nestHandsOccupied)) * (sceneId === "nest.unsupported-cycle" ? 0.09 : 0.055);
    if (state.nestBurdenResting) { profile.audioPressure = 0.74; profile.pathCompression = 0; profile.fov = 65; }
  }
  if (sceneId === "river.release-surrender" && state.surrenderComplete) {
    profile.airMovement = 0.006;
    profile.particleActivity = 0;
    profile.silenceBias = 1;
  }
  if (sceneId === "thorned.old-memory-bedroom") {
    const compression = Math.max(0, Math.min(1, state.compression ?? 1));
    profile.fov = 65 - 6 * compression;
    profile.pathCompression = compression * 0.6;
    profile.lowpassHz = 13000 - 11200 * compression;
  }
  if (sceneId === "climb.mind" && state.mindReleased) {
    profile.visibility = 145; profile.fogDensity = 0.0035; profile.audioPressure = 0.5; profile.pathCompression = 0;
  }
  if (sceneId === "climb.womb" && state.creationComplete) { profile.visibility = 185; profile.fov = 72; }
  return profile;
}
