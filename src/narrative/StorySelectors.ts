import {
  getJourneyActForEntry,
  getJourneyBeat,
  getJourneyChapterForEntry,
  getJourneySceneForEntry,
  journeyActs,
  journeyConditionMet,
} from "../data/journeyBlueprint.ts";
import {
  canEnterNarrativeEntry,
  type JourneyProgressionState,
} from "../lib/journeyProgression.ts";
import type { JourneyActId, StoryJourneyState } from "../lib/storyJourneyState.ts";

/** Older navigation callers may not yet carry the schema-v2 scene projection. */
export type JourneyAccessState = Pick<
  StoryJourneyState,
  "completedActs" | "inventory" | "visitedEntryIds"
> & Partial<Omit<JourneyProgressionState, "completedActs" | "inventory">>;

function hasNarrativeProgressionState(
  state: JourneyAccessState,
): state is JourneyAccessState & JourneyProgressionState {
  return Boolean(
    typeof state.activeEntryId === "string" &&
      Array.isArray(state.witnessedEntryIds) &&
      Array.isArray(state.completedRitualIds) &&
      state.worldFlags &&
      Array.isArray(state.completedChapterIds) &&
      Array.isArray(state.completedSceneIds) &&
      typeof state.storyStarted === "boolean" &&
      typeof state.storyCompleted === "boolean",
  );
}

/** Canonical scene gates, with the unchanged six-act navigation compatibility path. */
export function canEnterJourneyEntry(
  targetEntryId: string,
  currentEntryId: string,
  state: JourneyAccessState,
) {
  if (!targetEntryId || targetEntryId === currentEntryId) return true;
  if (hasNarrativeProgressionState(state)) return canEnterNarrativeEntry(targetEntryId, state);
  if (state.visitedEntryIds.includes(targetEntryId)) return true;

  const targetAct = getJourneyActForEntry(targetEntryId);
  const currentAct = getJourneyActForEntry(currentEntryId);
  if (!targetAct || !currentAct) return true;
  if (!state.inventory.lantern) return false;

  const targetIndex = journeyActs.findIndex((act) => act.id === targetAct.id);
  const currentIndex = journeyActs.findIndex((act) => act.id === currentAct.id);
  if (targetIndex <= currentIndex) return true;
  return journeyActs.slice(0, targetIndex).every((act) => state.completedActs.includes(act.id));
}

export function journeyEntryLockMessage(targetEntryId: string) {
  const chapter = getJourneyChapterForEntry(targetEntryId);
  const scene = getJourneySceneForEntry(targetEntryId);
  if (chapter && scene) {
    return `${chapter.title} is not open yet. ${scene.title} will awaken when the current memory has settled.`;
  }
  const act = getJourneyActForEntry(targetEntryId);
  return act
    ? `${act.title} is not open yet. The current act still has something to witness.`
    : "That part of the wood is not open yet.";
}

/** Navigation and physical proximity never grant permission to disclose prose. */
export function canReadStoryEntry(
  entryId: string,
  state: Pick<StoryJourneyState, "witnessedEntryIds">,
) {
  return Boolean(entryId && state.witnessedEntryIds.includes(entryId));
}

export function selectStoryLocation(
  state: Pick<StoryJourneyState, "activeEntryId" | "beatId">,
) {
  return {
    chapter: getJourneyChapterForEntry(state.activeEntryId),
    scene: getJourneySceneForEntry(state.activeEntryId),
    act: getJourneyActForEntry(state.activeEntryId),
    beat: getJourneyBeat(state.beatId),
  };
}

/** Existing saves retain each of the three durable ways the opening was released. */
export function selectOpeningReleased(
  state: Pick<StoryJourneyState, "storyObjectStates" | "inventory" | "completedRitualIds">,
) {
  return state.storyObjectStates["broken-floor.reflection"] === "inverted" ||
    state.inventory.lantern || state.completedRitualIds.includes("ritual.accept-lantern");
}

/** Return authored consequences only after the existing act conditions are earned. */
export function selectReadyActTransformation(actId: JourneyActId, state: StoryJourneyState) {
  const index = journeyActs.findIndex((act) => act.id === actId);
  const act = journeyActs[index];
  if (!act || state.completedActs.includes(actId) ||
    journeyActs.slice(0, index).some((priorAct) => !state.completedActs.includes(priorAct.id)) ||
    !act.completionRequirements.every((condition) => journeyConditionMet(condition, state))) {
    return undefined;
  }
  return act.mainBeatIds.map(getJourneyBeat).find((beat) => beat?.role === "transformation");
}
