import type { StoryEventCondition, StoryEventStateInput } from "./storyEventTypes.ts";
import { CHAPTER_STORY_EVENTS } from "./chapterStoryEvents.ts";

export function storyEventConditionMet(state: StoryEventStateInput, condition: StoryEventCondition) {
  switch (condition.type) {
    case "event": {
      if (state.completedStoryEventIds?.includes(condition.id)) return true;
      const event = CHAPTER_STORY_EVENTS.find((candidate) => candidate.id === condition.id);
      return Boolean(event && state.completedSceneIds.includes(event.sceneId));
    }
    case "flag": return state.worldFlags[condition.id] === true;
    case "object": return state.storyObjectStates?.[condition.id] === condition.state;
    case "not-object": return state.storyObjectStates?.[condition.id] !== condition.state;
    case "key": return state.inventory.recoveredKeys.includes(condition.id);
  }
}
