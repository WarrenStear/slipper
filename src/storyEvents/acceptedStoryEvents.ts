import type { JourneySceneId } from "../lib/storyJourneyState.ts";

export type AcceptedStoryEvent = Readonly<{ sceneId: JourneySceneId; eventIds: readonly string[] }>;
const listeners = new Set<(event: AcceptedStoryEvent) => void>();

/** Transient presentation notification, not save state or a second progression authority. */
export function subscribeAcceptedStoryEvents(listener: (event: AcceptedStoryEvent) => void) {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

/** Only the successful input dispatcher publishes. Hydration and replay never do. */
export function publishAcceptedStoryEvents(sceneId: JourneySceneId, eventIds: readonly string[]) {
  if (!eventIds.length) return;
  const event = Object.freeze({ sceneId, eventIds: Object.freeze([...eventIds]) });
  for (const listener of [...listeners]) {
    try { listener(event); } catch (error) { console.warn("Story presentation notification failed", error); }
  }
}
