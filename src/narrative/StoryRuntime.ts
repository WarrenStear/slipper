import {
  nextJourneyProgressionOutcome,
  nextRequiredEntry,
  nextRequiredScene,
  nextResolvableRitualForEntry,
  type JourneyProgressionState,
} from "../lib/journeyProgression.ts";
import { deriveLanternNarrative } from "../lib/lanternNarrative.ts";
import type { StoryJourneyState } from "../lib/storyJourneyState.ts";
import { resolveGuidedStory } from "../storyEvents/guidedStory.ts";
import { getAvailableStoryEvents, getCarriedStoryObjects } from "../storyEvents/storyEventRegistry.ts";
import { canReadStoryEntry, selectOpeningReleased, selectStoryLocation } from "./StorySelectors.ts";

/** Read the canonical progression once; evaluating it cannot apply an outcome. */
export function selectStoryProgression(state: JourneyProgressionState) {
  return {
    nextScene: nextRequiredScene(state),
    nextEntryId: nextRequiredEntry(state),
    nextRitual: nextResolvableRitualForEntry(state.activeEntryId, state),
    nextOutcome: nextJourneyProgressionOutcome(state),
  };
}

/** Renderer-independent interpretation shared by Forest, Fragment and accessibility. */
export function deriveStoryRuntime(state: StoryJourneyState) {
  return {
    location: selectStoryLocation(state),
    progression: selectStoryProgression(state),
    availableEvents: getAvailableStoryEvents(state),
    carriedObjects: getCarriedStoryObjects(state),
    guidedMoment: resolveGuidedStory(state),
    lantern: deriveLanternNarrative(state),
    openingReleased: selectOpeningReleased(state),
    canReadActiveEntry: canReadStoryEntry(state.activeEntryId, state),
  };
}

export type StoryRuntime = ReturnType<typeof deriveStoryRuntime>;
