import { resolveCinematicProfile, type CinematicStoryState } from "../../../cinematics/emotionalProfiles.ts";
import type { JourneySceneId } from "../../../lib/storyJourneyState.ts";

export type LookQuality = "low" | "medium" | "high" | "cinematic";
export type LookPoint = [number, number, number];
export type HeroReflection = "none" | "floor" | "moonwater" | "mirror";
type LightSource = "window" | "canopy" | "moon" | "dawn" | "sunset" | "domestic" | "fire" | "sky" | "remembered";
type Composition = { heroLandmark: string; focalPoint: LookPoint; negativeSpace: number; foregroundDensity: number; horizonOpenness: number };
type AuthoredLook = {
  source: LightSource; keyColor: string; keyPosition: LookPoint; keyIntensity: number;
  sky: string; horizon: string; fog: string; ground: string; leaf: string;
  reflection: HeroReflection; wetness: number; wear: number; saturation: number;
  composition: Composition;
};

// Emotional intensity, camera, audio and progression remain in emotionalProfiles.
// These are physical choices: where light comes from, what fills the frame, and
// which single surface may justify a secondary view of the world.
const worlds = {
  room: { source: "window", keyColor: "#b5c8d2", keyPosition: [5.8, 5.2, -6], keyIntensity: 1.2, sky: "#11161a", horizon: "#252c30", fog: "#1c262d", ground: "#211e19", leaf: "#23372f", reflection: "floor", wetness: .8, wear: .8, saturation: .82 },
  wood: { source: "canopy", keyColor: "#d6d9b9", keyPosition: [-7, 13, 8], keyIntensity: 1.35, sky: "#10202b", horizon: "#53635a", fog: "#253c3d", ground: "#222b21", leaf: "#354e3e", reflection: "none", wetness: .28, wear: .7, saturation: .86 },
  moon: { source: "moon", keyColor: "#cadfe9", keyPosition: [6, 18, 38], keyIntensity: 2, sky: "#050c17", horizon: "#182e40", fog: "#162b35", ground: "#101b22", leaf: "#23393c", reflection: "moonwater", wetness: .72, wear: .74, saturation: .8 },
  nest: { source: "dawn", keyColor: "#e3d0ac", keyPosition: [8, 11, -7], keyIntensity: 1.6, sky: "#657b8a", horizon: "#b1ac91", fog: "#7e8e87", ground: "#373c2a", leaf: "#526447", reflection: "none", wetness: .08, wear: .65, saturation: .88 },
  seer: { source: "sunset", keyColor: "#dbb08c", keyPosition: [-16, 5, 10], keyIntensity: 1.5, sky: "#192b3e", horizon: "#967465", fog: "#35434c", ground: "#252c2a", leaf: "#374640", reflection: "mirror", wetness: .54, wear: .9, saturation: .7 },
  house: { source: "domestic", keyColor: "#e8c69b", keyPosition: [-3.8, 3.1, -.4], keyIntensity: 28, sky: "#151b20", horizon: "#343c40", fog: "#302a24", ground: "#2d2720", leaf: "#3b4234", reflection: "none", wetness: .12, wear: .9, saturation: .76 },
  integration: { source: "sky", keyColor: "#c5d3d1", keyPosition: [-8, 14, 5], keyIntensity: 1.4, sky: "#405a6d", horizon: "#889a99", fog: "#506464", ground: "#323b30", leaf: "#425b43", reflection: "none", wetness: .35, wear: .65, saturation: .85 },
  fire: { source: "fire", keyColor: "#ebbd8c", keyPosition: [-6.8, 2, 4.1], keyIntensity: 30, sky: "#0d1a27", horizon: "#3b515d", fog: "#263840", ground: "#272b26", leaf: "#304236", reflection: "none", wetness: .22, wear: .95, saturation: .8 },
  river: { source: "moon", keyColor: "#c5d5db", keyPosition: [12, 18, 6], keyIntensity: 1.3, sky: "#1e3346", horizon: "#637b87", fog: "#3d545c", ground: "#29352d", leaf: "#3a5143", reflection: "none", wetness: .64, wear: .7, saturation: .76 },
  fork: { source: "sky", keyColor: "#c9d2d0", keyPosition: [14, 12, 10], keyIntensity: 1.3, sky: "#3b5669", horizon: "#a2b0ad", fog: "#687e81", ground: "#404535", leaf: "#52634a", reflection: "none", wetness: .15, wear: .72, saturation: .77 },
  climb: { source: "sky", keyColor: "#d9dcd4", keyPosition: [-6, 18, 8], keyIntensity: 1.5, sky: "#5c7b94", horizon: "#b3beb6", fog: "#81958f", ground: "#414b3c", leaf: "#56684d", reflection: "none", wetness: .14, wear: .6, saturation: .87 },
  home: { source: "dawn", keyColor: "#eadcc2", keyPosition: [-12, 9, -6], keyIntensity: 2.2, sky: "#7696b2", horizon: "#c0c9be", fog: "#9fac9f", ground: "#4a5138", leaf: "#63744b", reflection: "none", wetness: .1, wear: .6, saturation: .94 },
  epilogue: { source: "remembered", keyColor: "#b5c6d2", keyPosition: [-7, 12, -7], keyIntensity: .38, sky: "#070f19", horizon: "#172b36", fog: "#18282f", ground: "#242b24", leaf: "#293d32", reflection: "none", wetness: .1, wear: .6, saturation: .77 },
} satisfies Record<string, Omit<AuthoredLook, "composition">>;

function image(world: keyof typeof worlds, heroLandmark: string, focalPoint: LookPoint, negativeSpace: number, foregroundDensity: number, horizonOpenness: number, overrides: Partial<Omit<AuthoredLook, "composition">> = {}): Readonly<AuthoredLook> {
  return { ...worlds[world], ...overrides, composition: { heroLandmark, focalPoint, negativeSpace, foregroundDensity, horizonOpenness } };
}

/** Every canonical scene has an authored image, even when it shares a biome. */
export const SCENE_LOOKS = {
  "broken-floor.confession": image("room", "forest beneath ordinary wet timber", [0, 0, 3], .8, .1, 0),
  "enchanted.rabbit-hole": image("wood", "distant lantern through layered trunks", [0, 1.5, 9], .4, .8, .16),
  "enchanted.friendship-meadow": image("wood", "warm clearing inside cool woodland", [-2, 1, 5], .55, .5, .35, { keyIntensity: 1.65 }),
  "enchanted.masked-hearth": image("wood", "small domestic light behind branches", [0, 1.5, 6], .5, .72, .18, { keyIntensity: .9 }),
  "blue-moon.sanctuary": image("moon", "narrow bridge beneath the moon", [0, 2, 9], .85, .2, .65),
  "blue-moon.intimacy": image("moon", "white cloth and Swan against black water", [-3, 1.2, 4], .75, .18, .6),
  "blue-moon.caged-bird": image("moon", "familiar bridge held by closed architecture", [0, 2, 5], .68, .3, .5, { keyIntensity: 1.65 }),
  "nest.two-hands": image("nest", "protected linen centre in morning light", [0, 1, 3], .48, .3, .3),
  "nest.unsupported-cycle": image("nest", "warm child space inside occupied edges", [0, 1, 3], .28, .75, .18, { keyIntensity: 1.3 }),
  "nest.protection": image("nest", "safe centre with breathing room", [0, 1.5, 3], .6, .28, .45),
  "sunset.warning-grove": image("seer", "one cracked mirror against a dying horizon", [0, 3, 5.4], .8, .18, .75),
  "sunset.true-mirror": image("seer", "unchanged scar in reflected landscape", [0, 3, 5.4], .86, .12, .78, { keyIntensity: 1.25 }),
  "sunset.stillness": image("seer", "a truthful mirror in settled water", [0, 3, 5.4], .9, .08, .85, { keyIntensity: 1.2 }),
  "thorned.locked-garden": image("house", "warm invitation inside enclosing walls", [0, 1.6, 4], .3, .65, .12),
  "thorned.old-memory-bedroom": image("house", "room that leaves too little space", [0, 1.4, 4], .15, .9, .04),
  "thorned.self-owned-world": image("house", "outside air through a readable exit", [0, 1.8, 8], .62, .35, .55, { source: "window", keyPosition: [0, 5, 12], keyIntensity: 1.5, keyColor: "#cbd8d9" }),
  "wolf-swan.false-choice": image("integration", "wood and water sharing the same stone", [0, 1.5, 4], .55, .38, .55),
  "wolf-swan.convergence": image("integration", "one open passage through three familiar materials", [0, 1.5, 8], .72, .24, .72),
  "fire.boundary": image("fire", "contained fire beside a broad dark river", [-5, 1.5, 4], .6, .3, .52),
  "river.wash": image("river", "open water with remembered embers in view", [5, .2, 5], .78, .2, .74),
  "river.release-surrender": image("river", "still cloth between water and extinguished ash", [0, 1.8, 8], .9, .12, .8, { saturation: .66, keyIntensity: 1.1 }),
  "fork.weighing": image("fork", "enclosed familiar bend beside an unreadable horizon", [0, 1, 9], .72, .38, .85),
  "fork.four-verbs": image("fork", "warmth held behind a chosen door", [0, 1, 6], .76, .3, .86),
  "fork.relinquish-hope": image("fork", "waiting light beside an unpromised horizon", [0, 1.2, 4], .84, .25, .9),
  "climbs.arrival": image("climb", "continuous ascent above remembered places", [0, 3, 12], .65, .35, .75),
  "climb.mind": image("climb", "angular repetition yielding to clear space", [0, 2, 9], .45, .7, .5, { keyIntensity: 1.35 }),
  "climb.heart": image("climb", "one tender object within intimate curved shelter", [0, 1.2, 4], .62, .3, .65, { keyColor: "#ddd4c4" }),
  "climb.womb": image("climb", "protected empty earth under diffuse sky", [0, .5, 5], .9, .15, .95, { keyIntensity: 1.3 }),
  "crowned.threshold": image("home", "ordinary morning through an already-owned gate", [0, 2, 7], .75, .25, .9),
  "crowned.home": image("home", "inhabited timber home open to morning", [0, 2, 8], .68, .3, .9),
  "crowned.sovereignty": image("home", "recognition in the mirror beside placed light", [0, 1.6, 7], .78, .22, .92),
  "epilogue.constellation": image("epilogue", "the actual remembered route lit in reverse", [0, 5, -15], .94, .1, 1),
} satisfies Record<JourneySceneId, Readonly<AuthoredLook>>;

export function sceneRenderBudget(quality: LookQuality, reducedEffects = false) {
  const high = !reducedEffects && (quality === "high" || quality === "cinematic");
  const cinematic = !reducedEffects && quality === "cinematic";
  return {
    reflectionSize: high ? cinematic ? 768 : 384 : 0,
    reflectionEveryFrames: cinematic ? 1 : 2,
    maxHeroCaptures: high ? 1 : 0,
    reflectionFar: 64,
    finishing: cinematic,
    finishingMaxDimension: 1920,
    samples: cinematic ? 4 : 0,
  };
}

export function resolveSceneLook(sceneId: JourneySceneId, quality: LookQuality = "medium", reducedEffects = false, state: CinematicStoryState & { mirrorStill?: boolean } = {}) {
  const authored = SCENE_LOOKS[sceneId];
  const emotional = resolveCinematicProfile(sceneId, state);
  const quiet = (sceneId === "river.release-surrender" && state.surrenderComplete) || (sceneId === "sunset.stillness" && state.mirrorStill);
  return {
    sceneId, emotional, stillness: Boolean(quiet), budget: sceneRenderBudget(quality, reducedEffects),
    lighting: { source: authored.source, color: authored.keyColor, position: authored.keyPosition, intensity: authored.keyIntensity, fill: emotional.fillIntensity, shadowProfile: quality === "cinematic" && !reducedEffects },
    atmosphere: { sky: authored.sky, horizon: authored.horizon, fog: authored.fog, density: Math.min(.025, emotional.fogDensity * Math.min(1.3, 90 / emotional.visibility)), visibility: emotional.visibility },
    grade: { exposure: emotional.exposure, contrast: 1 + (emotional.contrast - 1) * .16, saturation: authored.saturation, warmth: emotional.warmth, vignette: reducedEffects ? 0 : .09, grain: reducedEffects ? 0 : .0012 },
    materials: { wetness: authored.wetness, roughnessBias: quiet ? .03 : 0, environmentalWear: authored.wear },
    composition: authored.composition,
    palette: { ground: authored.ground, leaf: authored.leaf },
    reflection: { mode: authored.reflection },
    motion: { vegetation: quiet ? 0 : emotional.airMovement, cloth: quiet ? 0 : emotional.airMovement, water: quiet ? 0 : emotional.airMovement, particles: reducedEffects || quiet ? 0 : emotional.particleActivity, flame: quiet ? 0 : emotional.airMovement },
  };
}
export type SceneLook = ReturnType<typeof resolveSceneLook>;
