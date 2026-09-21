import { getJourneyScene } from "../../../data/journeyBlueprint.ts";
import type { JourneyChapterId, JourneySceneId, ResonanceKey } from "../../../lib/storyJourneyState.ts";

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
  "broken-floor": { room: 0.28, wind: 0, water: 0.1, fire: 0, glass: 0.015, warmth: 0, whisper: 0.025, birds: 0, cloth: 0, wood: 0.03 },
  "enchanted-wood": { room: 0, wind: 0.22, water: 0.02, fire: 0.015, glass: 0, warmth: 0.075, whisper: 0.03, birds: 0.055, cloth: 0, wood: 0.025 },
  "blue-moon-sanctuary": { room: 0.02, wind: 0.035, water: 0.24, fire: 0.035, glass: 0.035, warmth: 0.085, whisper: 0.02, birds: 0.015, cloth: 0.025, wood: 0.01 },
  nest: { room: 0.075, wind: 0.11, water: 0.015, fire: 0.025, glass: 0, warmth: 0.1, whisper: 0.018, birds: 0.045, cloth: 0.06, wood: 0.045 },
  "sunset-seer": { room: 0.015, wind: 0.06, water: 0.11, fire: 0, glass: 0.12, warmth: 0.018, whisper: 0.055, birds: 0, cloth: 0, wood: 0.015 },
  "thorned-house": { room: 0.22, wind: 0.025, water: 0, fire: 0.015, glass: 0.018, warmth: 0.025, whisper: 0.07, birds: 0, cloth: 0.035, wood: 0.09 },
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
