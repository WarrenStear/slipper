import { getJourneySceneForEntry } from "../../../data/journeyBlueprint.ts";
import { CINEMATIC_ACTOR_CUES } from "../../../cinematics/cinematicCueRegistry.ts";
import { canEnterNarrativeEntry, type JourneyProgressionState } from "../../../lib/journeyProgression.ts";
import type { JourneySceneId } from "../../../lib/storyJourneyState.ts";
import type { NarrativeAudioStemId, NarrativeStemTarget } from "./narrativeAudioProfiles.ts";

export type AudioApproachTarget = Readonly<{
  sceneId: JourneySceneId;
  position: readonly [number, number, number];
  water: boolean; wood: boolean; fire: boolean; cloth: boolean;
}>;
export type AudioApproachFacts = Readonly<{
  distance: number; rightBearing: number; currentSceneId: string; sharedStillness: number;
  spatialEnabled: boolean;
  film: { audioPressure: number; silenceBias: number; lowpassHz: number };
}>;
export type AudioApproachMix = { addition: number; pan: number; lowpassHz: number };
export const AUDIO_APPROACH_RADIUS = 36;
export const AUDIO_APPROACH_NEAR_RADIUS = 6;
export const AUDIO_APPROACH_MAX_PAN = .6;
const LEVELS = { water: .028, wood: .016, fire: .026, cloth: .014 } as const;
const CUTOFFS = { water: 1250, wood: 900, fire: 2200, cloth: 1100 } as const;
function clamp01(value: number) { return Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0)); }

/** Presentation admission reads existing rules; it never witnesses, enters or completes a scene. */
export function createAudioApproachTarget(
  currentSceneId: string, entryId: string | null | undefined,
  position: readonly [number, number, number] | null, state: JourneyProgressionState,
): AudioApproachTarget | null {
  if (!entryId || !position || position.length !== 3 || !position.every(Number.isFinite) || !state.storyStarted ||
    state.storyCompleted || !canEnterNarrativeEntry(entryId, state)) return null;
  const scene = getJourneySceneForEntry(entryId);
  if (!scene || scene.id === currentSceneId || scene.id.startsWith("broken-floor.")) return null;
  // Fire and River share a technical biome; their authored scenes retain different sound materials.
  const water = scene.id.startsWith("river.") || scene.chapterId === "blue-moon-sanctuary" || scene.chapterId === "sunset-seer";
  const fire = scene.id.startsWith("fire.");
  const wood = scene.chapterId === "enchanted-wood" || scene.chapterId === "nest" || scene.chapterId === "thorned-house";
  const cloth = (CINEMATIC_ACTOR_CUES[scene.id] ?? []).some(cue => cue.actor === "swan");
  return water || fire || wood || cloth ? { sceneId: scene.id, position, water, wood, fire, cloth } : null;
}

/** Fill a reusable target from live camera facts on the existing audio frame. No timer or store. */
export function resolveAudioApproachMix(
  output: AudioApproachMix, id: NarrativeAudioStemId, target: AudioApproachTarget | null,
  facts: AudioApproachFacts,
) {
  output.addition = 0; output.pan = 0; output.lowpassHz = 600;
  if (!target || facts.currentSceneId.startsWith("broken-floor.") ||
    facts.currentSceneId === "sunset.stillness" || facts.currentSceneId === "river.release-surrender" ||
    !(id in LEVELS) || !Number.isFinite(facts.distance) || facts.distance < 0 ||
    facts.distance >= AUDIO_APPROACH_RADIUS || target.sceneId === facts.currentSceneId) return output;
  const material = id as keyof typeof LEVELS;
  if (!target[material]) return output;
  const phase = clamp01((AUDIO_APPROACH_RADIUS - facts.distance) / (AUDIO_APPROACH_RADIUS - AUDIO_APPROACH_NEAR_RADIUS));
  const proximity = phase * phase * (3 - 2 * phase);
  const quiet = clamp01(facts.sharedStillness);
  const pressure = Number.isFinite(facts.film.audioPressure) ? Math.max(0, Math.min(1.25, facts.film.audioPressure)) : 0;
  output.addition = LEVELS[material] * proximity * Math.pow(1 - quiet, 2) * pressure * (1 - clamp01(facts.film.silenceBias));
  // At the source, direction fades rather than flipping as the visitor walks through it.
  output.pan = output.addition > 0 && facts.spatialEnabled && Number.isFinite(facts.rightBearing)
    ? Math.max(-1, Math.min(1, facts.rightBearing)) * AUDIO_APPROACH_MAX_PAN * clamp01(facts.distance / 4) : 0;
  output.lowpassHz = Math.max(80, Math.min(CUTOFFS[material], Number.isFinite(facts.film.lowpassHz) ? facts.film.lowpassHz : CUTOFFS[material]));
  return output;
}

/** Dry targets are byte-identical when no approach contributes. */
export function applyAudioApproachMix(target: NarrativeStemTarget, mix: AudioApproachMix) {
  if (mix.addition <= 0) return target;
  const total = target.volume + mix.addition;
  target.lowpassHz = (target.lowpassHz * target.volume + mix.lowpassHz * mix.addition) / total;
  target.volume = total;
  return target;
}
