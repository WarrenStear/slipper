import { getJourneyScene } from "../../../data/journeyBlueprint.ts";
import type { JourneyChapterId, JourneySceneId, ResonanceKey } from "../../../lib/storyJourneyState.ts";
import type { SceneLook } from "../artDirection/SceneLookRegistry.ts";

export const NARRATIVE_AUDIO_STEM_IDS = [
  "room",
  "wind",
  "water",
  "fire",
  "glass",
  "warmth",
  "whisper",
  "birds",
  "cloth",
  "wood",
] as const;

export type NarrativeAudioStemId = (typeof NARRATIVE_AUDIO_STEM_IDS)[number];

export type NarrativeAudioProfile = {
  cue: string;
  master: number;
  stems: Record<NarrativeAudioStemId, number>;
};

export type NarrativeAudioState = {
  chapterId: JourneyChapterId;
  sceneId: JourneySceneId;
  resonances: Record<ResonanceKey, number>;
  releasedWords: readonly string[];
  surrenderComplete: boolean;
};

const CHAPTER_MIXES: Record<JourneyChapterId, Record<NarrativeAudioStemId, number>> = {
  "broken-floor": { room: 0.28, wind: 0, water: 0.055, fire: 0, glass: 0, warmth: 0, whisper: 0, birds: 0, cloth: 0.055, wood: 0.07 },
  "enchanted-wood": { room: 0, wind: 0.2, water: 0.02, fire: 0.008, glass: 0, warmth: 0.02, whisper: 0, birds: 0.032, cloth: 0, wood: 0.035 },
  "blue-moon-sanctuary": { room: 0, wind: 0.028, water: 0.26, fire: 0.018, glass: 0.005, warmth: 0.018, whisper: 0, birds: 0.01, cloth: 0.012, wood: 0.06 },
  nest: { room: 0.075, wind: 0.11, water: 0.015, fire: 0.025, glass: 0, warmth: 0.1, whisper: 0.018, birds: 0.045, cloth: 0.06, wood: 0.045 },
  "sunset-seer": { room: 0.01, wind: 0.045, water: 0.1, fire: 0, glass: 0.024, warmth: 0, whisper: 0, birds: 0, cloth: 0, wood: 0.012 },
  "thorned-house": { room: 0.2, wind: 0.012, water: 0, fire: 0.008, glass: 0, warmth: 0.02, whisper: 0, birds: 0, cloth: 0.045, wood: 0.095 },
  "wolf-swan-seer": { room: 0, wind: 0.12, water: 0.075, fire: 0.06, glass: 0.055, warmth: 0.03, whisper: 0.03, birds: 0.025, cloth: 0, wood: 0.02 },
  "fire-river": { room: 0, wind: 0.08, water: 0.14, fire: 0.18, glass: 0.01, warmth: 0.015, whisper: 0.025, birds: 0.03, cloth: 0.035, wood: 0.015 },
  fork: { room: 0, wind: 0.16, water: 0.025, fire: 0.025, glass: 0.02, warmth: 0.02, whisper: 0.045, birds: 0.018, cloth: 0, wood: 0.035 },
  "three-climbs": { room: 0, wind: 0.2, water: 0.035, fire: 0.035, glass: 0.04, warmth: 0.025, whisper: 0.025, birds: 0.028, cloth: 0.025, wood: 0.018 },
  "crowned-return": { room: 0, wind: 0.18, water: 0.025, fire: 0.015, glass: 0.04, warmth: 0.08, whisper: 0.008, birds: 0.065, cloth: 0.03, wood: 0.04 },
  "lantern-epilogue": { room: 0, wind: 0.12, water: 0.02, fire: 0.015, glass: 0.075, warmth: 0.095, whisper: 0, birds: 0.035, cloth: 0, wood: 0.02 },
};

function clamp01(value: number) {
  return Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));
}

export function resolveNarrativeAudioProfile(state: NarrativeAudioState): NarrativeAudioProfile {
  const scene = getJourneyScene(state.sceneId);
  const stems = { ...CHAPTER_MIXES[state.chapterId] };
  const wolf = clamp01(state.resonances.wolf / 100);
  const swan = clamp01(state.resonances.swan / 100);
  const seer = clamp01(state.resonances.seer / 100);

  stems.fire += wolf * 0.025;
  stems.water += swan * 0.025;
  stems.glass += seer * 0.02;
  stems.whisper *= 1 - Math.min(0.72, state.releasedWords.length * 0.09);

  if (state.sceneId === "fire.boundary") {
    stems.fire = Math.max(stems.fire, 0.25);
    stems.water *= 0.28;
  } else if (state.sceneId === "river.wash") {
    stems.water = Math.max(stems.water, 0.28);
    stems.fire *= 0.22;
  } else if (state.sceneId === "river.release-surrender") {
    stems.fire *= 0.16;
    stems.water *= 0.3;
    stems.wind *= 0.2;
    stems.whisper = 0;
    stems.birds = state.surrenderComplete ? 0 : Math.max(stems.birds, 0.08);
    stems.cloth = state.surrenderComplete ? 0 : Math.max(stems.cloth, 0.07);
  } else if (state.sceneId === "sunset.stillness") {
    stems.room *= 0.2;
    stems.wind *= 0.3;
    stems.glass *= 0.7;
    stems.whisper *= 0.32;
  } else if (state.sceneId === "climb.mind") {
    stems.whisper = Math.max(stems.whisper, 0.07);
    stems.glass *= 0.5;
  } else if (state.sceneId === "climb.heart") {
    stems.warmth = Math.max(stems.warmth, 0.08);
    stems.water = Math.max(stems.water, 0.065);
  } else if (state.sceneId === "climb.womb") {
    stems.room = Math.max(stems.room, 0.045);
    stems.warmth = Math.max(stems.warmth, 0.095);
  }

  return {
    cue: scene?.audioCue ?? `${state.chapterId}-ambient`,
    master: state.sceneId === "river.release-surrender"
      ? state.surrenderComplete ? 0 : 0.14
      : 1,
    stems,
  };
}

export type NarrativeStemTarget = { volume: number; lowpassHz: number };
const STEM_LOWPASS: Record<NarrativeAudioStemId, number> = {
  room: 340, wind: 4200, water: 2600, fire: 4800, glass: 2600,
  warmth: 750, whisper: 1200, birds: 6000, cloth: 1400, wood: 1200,
};

/** Fill an existing target: the frame loop allocates no objects and owns no story clock. */
export function resolveNarrativeStemTarget(
  output: NarrativeStemTarget,
  id: NarrativeAudioStemId,
  profile: NarrativeAudioProfile,
  look: Pick<SceneLook, "sceneId" | "audio"> | null,
  sharedStillness: number,
  film: { audioPressure: number; silenceBias: number; lowpassHz: number },
) {
  let volume = profile.stems[id] * profile.master;
  let lowpassHz = STEM_LOWPASS[id];
  const sceneId = look?.sceneId ?? "";
  const quiet = clamp01(sharedStillness);

  if (sceneId.startsWith("broken-floor.")) {
    const reveal = look!.audio.openingInverted ? 1 : clamp01(look!.audio.openingReveal);
    if (id === "room" || id === "wood" || id === "cloth") volume *= 1 - reveal * .68;
    if (id === "wind") volume = .105 * reveal;
    if (id === "birds") volume = .012 * reveal;
    // The forest is first heard through the wet floor; no opening musical motif.
    if (id === "glass" || id === "warmth" || id === "whisper" || id === "fire") volume = 0;
    if (id === "water") lowpassHz = 850 + reveal * 500;
    if (id === "wind" || id === "birds") lowpassHz = 900 + reveal * 1500;
    if (id === "wood") lowpassHz = 700;
    if (id === "room") lowpassHz = 260;
  } else if (sceneId.startsWith("blue-moon.")) {
    // Broad low water, with timber and cloth remaining close to the listener.
    if (id === "water") lowpassHz = 900;
    if (id === "wind") lowpassHz = 1800;
    if (id === "glass" || id === "warmth") volume *= .35;
  } else if (sceneId.startsWith("thorned.")) {
    const compression = clamp01(look!.audio.domesticCompression);
    if (id === "room") volume *= .7 + compression * .3;
    if (id === "wood") volume *= .78 + compression * .22;
    if (id === "wind") volume *= 1 - compression * .8;
    lowpassHz = Math.min(lowpassHz, 1600 - compression * 850);
    if (id === "room") lowpassHz = 300 - compression * 100;
  }

  if (sceneId === "sunset.stillness") {
    // Camera and embodied stillness ease this same value in SceneLookDirector.
    volume *= 1 - quiet * (id === "water" ? .82 : .94);
    lowpassHz = Math.min(lowpassHz, 1600 - quiet * 1100);
  } else if (sceneId === "river.release-surrender") {
    // SceneLook already supplies the quiet cinematic pressure. Its shared fade replaces
    // the legacy immediate master switch instead of multiplying a third mute onto it.
    volume = profile.stems[id];
    // Higher detail leaves first; water is the last layer. No elapsed-audio timer.
    const exponent = id === "birds" || id === "glass" ? 4
      : id === "cloth" || id === "fire" ? 3 : id === "water" ? 1.5 : 2;
    volume *= Math.pow(1 - quiet, exponent);
    lowpassHz = Math.min(lowpassHz, 2400 - quiet * 2100);
  } else if (quiet > 0 && sceneId.startsWith("fork.")) {
    // Shared stillness carries across a scene change: outside air returns first.
    volume *= Math.pow(1 - quiet, id === "wind" ? .5 : 2);
  }

  const pressure = Number.isFinite(film.audioPressure) ? Math.max(0, Math.min(1.25, film.audioPressure)) : 0;
  output.volume = Math.max(0, volume * pressure * (1 - clamp01(film.silenceBias)));
  output.lowpassHz = Math.max(80, Math.min(lowpassHz, Number.isFinite(film.lowpassHz) ? film.lowpassHz : lowpassHz));
  return output;
}
