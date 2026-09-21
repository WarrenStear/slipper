import type { JourneySceneId } from "../lib/storyJourneyState.ts";
import type { StoryEventDefinition, StoryEventStateInput, StoryObjectDefinition } from "./storyEventTypes.ts";
import { CHAPTER_STORY_EVENTS, STORY_OBJECTS } from "./chapterStoryEvents.ts";
import { storyEventConditionMet } from "./storyEventConditions.ts";

export const STORY_EVENTS: readonly StoryEventDefinition[] = CHAPTER_STORY_EVENTS;
export const STORY_OBJECT_DEFINITIONS: readonly StoryObjectDefinition[] = STORY_OBJECTS;
const eventsByScene = new Map<JourneySceneId, StoryEventDefinition[]>();
for (const event of STORY_EVENTS) eventsByScene.set(event.sceneId, [...eventsByScene.get(event.sceneId) ?? [], event]);
export function eventsForScene(sceneId: JourneySceneId) { return eventsByScene.get(sceneId) ?? []; }
export function objectsForScene(sceneId: JourneySceneId): readonly StoryObjectDefinition[] { return STORY_OBJECT_DEFINITIONS.filter((object) => object.sceneIds.includes(sceneId)); }
export function getStoryObject(objectId: string) { return STORY_OBJECT_DEFINITIONS.find((object) => object.id === objectId); }
export function getCarriedStoryObjects(state: Pick<StoryEventStateInput, "storyObjectStates">): readonly StoryObjectDefinition[] { return STORY_OBJECT_DEFINITIONS.filter((object) => state.storyObjectStates?.[object.id] === "carried"); }
export function storyCarryCapacity(sceneId: JourneySceneId) { return sceneId.startsWith("nest.") ? 2 : 1; }
export function canCarryStoryObject(state: StoryEventStateInput, object: StoryObjectDefinition) {
  if (!object.carryable) return false;
  if (object.keepsake) return true;
  return getCarriedStoryObjects(state).filter((item) => !item.keepsake).length < storyCarryCapacity(state.sceneId);
}
export function storyEventComplete(state: StoryEventStateInput, event: StoryEventDefinition) { return state.completedStoryEventIds?.includes(event.id) === true; }
export function getAvailableStoryEvents(state: StoryEventStateInput, sceneId: JourneySceneId = state.sceneId): readonly StoryEventDefinition[] {
  if (sceneId !== state.sceneId) return [];
  return eventsForScene(sceneId).filter((event) => {
    const object = event.objectId ? getStoryObject(event.objectId) : undefined;
    const repick = event.trigger === "pickup" && object && state.storyObjectStates?.[object.id] === "resting";
    if (storyEventComplete(state, event) && !repick) return false;
    if (!repick && event.completionGroup && STORY_EVENTS.some((candidate) => candidate.completionGroup === event.completionGroup && storyEventComplete(state, candidate))) return false;
    if (!(event.requires ?? []).every((condition) => storyEventConditionMet(state, condition))) return false;
    if (event.trigger === "pickup" && object && !canCarryStoryObject(state, object)) return false;
    return true;
  });
}
export function isSceneStoryComplete(state: StoryEventStateInput, sceneId: JourneySceneId = state.sceneId) {
  if (state.completedSceneIds.includes(sceneId)) return true;
  const required = eventsForScene(sceneId).filter((event) => !event.optional);
  return required.length > 0 && required.every((event) => event.completionGroup
    ? required.some((candidate) => candidate.completionGroup === event.completionGroup && storyEventComplete(state, candidate))
    : storyEventComplete(state, event));
}
export const STORY_EVENT_WORLD_FLAG_IDS = Array.from(new Set(STORY_EVENTS.flatMap((event) => event.actions.flatMap((action) => action.type === "world-flag" ? [action.flagId] : []))));
