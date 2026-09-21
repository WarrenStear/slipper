import type { StoryJourneyState } from "../lib/storyJourneyState.ts";
import { applyJourneySceneRewards, nextJourneyProgressionOutcome } from "../lib/journeyProgression.ts";

/** Settle already-earned legacy outcomes before the first new event opts in.
 * No interaction, personal choice, event ID, or final tableau is invented.
 */
export function reconcileLegacyStoryEventEntry(state: StoryJourneyState): StoryJourneyState {
  if (state.worldFlags["story-events.started"] || state.completedStoryEventIds.length > 0) return state;
  let next = state;
  // At most one outcome per authored scene and chapter (32 + 12).
  for (let index = 0; index < 44; index++) {
    const outcome = nextJourneyProgressionOutcome(next);
    if (!outcome || outcome.type === "complete-story") break;
    if (outcome.type === "complete-scene") {
      next = {
        ...next,
        completedSceneIds: [...next.completedSceneIds, outcome.sceneId],
        inventory: applyJourneySceneRewards(outcome.sceneId, next.inventory),
      };
    } else {
      next = { ...next, completedChapterIds: [...next.completedChapterIds, outcome.chapterId] };
    }
  }
  if (next !== state) {
    const objects = { ...next.storyObjectStates };
    // These completed legacy scenes have unambiguous carrying outcomes.
    // Recover them before scene-enter adds the first event ID, after which
    // the normal sanitizer correctly stops inferring legacy object states.
    if (next.completedSceneIds.includes("nest.two-hands") && !next.completedSceneIds.includes("nest.protection")) objects["nest.protected-linen"] = "carried";
    if (next.completedSceneIds.includes("nest.two-hands") && !next.completedSceneIds.includes("nest.unsupported-cycle")) objects["nest.responsibility"] = "carried";
    if (next.completedSceneIds.includes("fork.relinquish-hope") && !objects["lantern.master"] && !next.worldFlags["lantern.placed-and-lit"]) objects["lantern.master"] = "carried";
    next = { ...next, storyObjectStates: objects };
  }
  return next;
}
