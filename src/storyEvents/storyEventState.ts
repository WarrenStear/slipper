import type { StoryJourneyState } from "../lib/storyJourneyState.ts";
import type { StoryEventAction, StoryEventInput } from "./storyEventTypes.ts";
import { getAvailableStoryEvents, getStoryObject } from "./storyEventRegistry.ts";
import { matchesStoryEventInput } from "./storyEventRuntime.ts";

export type StoryEventDispatchResult = { state: StoryJourneyState; eventIds: string[]; actions: StoryEventAction[] };
/** Pure, bounded reducer: input cannot supply outcomes or jump to another scene. */
export function dispatchStoryEventState(state: StoryJourneyState, input: StoryEventInput): StoryEventDispatchResult {
  const unchanged = { state, eventIds: [], actions: [] };
  if (state.sceneId !== input.sceneId) return unchanged;
  if (input.trigger === "drop" && input.objectId) {
    const object = getStoryObject(input.objectId);
    if (!object?.carryable || object.keepsake || !object.sceneIds.includes(state.sceneId) || state.storyObjectStates[object.id] !== "carried") return unchanged;
    return { state: { ...state, storyObjectStates: { ...state.storyObjectStates, [object.id]: "resting" } }, eventIds: [`${object.id}.drop`], actions: [] };
  }
  // Resolve from the pre-dispatch snapshot. A single wipe must never consume
  // both wipe stages simply because stage one became true during this call.
  const matches = getAvailableStoryEvents(state, input.sceneId).filter((event) => matchesStoryEventInput(event, input));
  if (matches.length === 0) return unchanged;
  const next: StoryJourneyState = { ...state, completedStoryEventIds: [...state.completedStoryEventIds], storyObjectStates: { ...state.storyObjectStates }, storyPlacementStates: { ...state.storyPlacementStates }, worldFlags: { ...state.worldFlags }, landmarkStates: { ...state.landmarkStates }, resonances: { ...state.resonances }, releasedWords: [...state.releasedWords], completedRitualIds: [...state.completedRitualIds], inventory: { ...state.inventory, recoveredKeys: [...state.inventory.recoveredKeys], symbolicObjects: [...state.inventory.symbolicObjects] } };
  const actions: StoryEventAction[] = [];
  for (const event of matches) {
    if (!next.completedStoryEventIds.includes(event.id)) next.completedStoryEventIds.push(event.id);
    for (const action of event.actions) {
      actions.push(action);
      switch (action.type) {
        case "object-state": next.storyObjectStates[action.objectId] = action.state; break;
        case "placement": next.storyPlacementStates[action.objectId] = action.targetId; break;
        case "world-flag": next.worldFlags[action.flagId] = true; break;
        case "ritual": if (!next.completedRitualIds.includes(action.ritualId)) next.completedRitualIds.push(action.ritualId); break;
        case "key": if (!next.inventory.recoveredKeys.includes(action.keyId)) next.inventory.recoveredKeys.push(action.keyId); break;
        case "symbol": if (!next.inventory.symbolicObjects.includes(action.objectId)) next.inventory.symbolicObjects.push(action.objectId); break;
        case "lantern": next.inventory.lantern = true; break;
        case "landmark": next.landmarkStates[action.landmarkId] = action.state; break;
        case "resonance": next.resonances[action.key] = Math.min(100, next.resonances[action.key] + action.amount); break;
        case "release-word": if (!next.releasedWords.includes(action.word)) next.releasedWords.push(action.word); break;
      }
    }
  }
  return { state: next, eventIds: matches.map((event) => event.id), actions };
}
