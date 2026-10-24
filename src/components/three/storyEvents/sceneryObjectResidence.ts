import type { JourneySceneId } from "../../../lib/storyJourneyState.ts";
import { STORY_EVENTS } from "../../../storyEvents/storyEventRegistry.ts";
import type { StoryObjectDefinition } from "../../../storyEvents/storyEventTypes.ts";

const eventById = new Map(STORY_EVENTS.map(event => [event.id, event]));

/** A shared canonical object gets one scenery image, derived from existing evidence.
 * The active scene retains its established interaction presentation. No state is written.
 */
export function sceneryObjectResidence(object: StoryObjectDefinition, activeSceneId: JourneySceneId, acceptedIds: readonly string[]): JourneySceneId {
  if (object.sceneIds.includes(activeSceneId)) return activeSceneId;
  for (let i = acceptedIds.length - 1; i >= 0; i--) {
    const event = eventById.get(acceptedIds[i]);
    if (event && object.sceneIds.includes(event.sceneId) && event.actions.some(action => "objectId" in action && action.objectId === object.id)) return event.sceneId;
  }
  return object.sceneIds[0];
}
