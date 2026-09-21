import type { JourneySceneId } from "../lib/storyJourneyState.ts";
import { storyResponseFor } from "./guidedStory.ts";

export type StoryAftermathMoment = Readonly<{
  sceneId: JourneySceneId;
  eventId: string;
  line: string;
  durationMs: number;
  turningPoint: boolean;
}>;
export type StoryAftermathState = Readonly<{
  sceneId: JourneySceneId;
  current: StoryAftermathMoment | null;
  pending: readonly StoryAftermathMoment[];
  received: readonly string[];
}>;

// These are presentation intervals, not event prerequisites or forced waits.
// A player can hold or dismiss any caption without changing earned story state.
const TURNING_POINTS = new Set([
  "broken-floor.inversion", "enchanted.hearth-unease", "blue-moon.water-reveal",
  "blue-moon.cage-recognised", "thorn-house.refilled", "thorn-house.pattern-returned",
  "thorn-house.fixing-ended", "thorn-house.exit-crossed", "fire.true-memory.flame",
  "river.ash-washed", "integration.three-capacities", "lantern.owned", "crown.recognised",
]);
export const MAX_PENDING_AFTERMATH = 3;

export function createStoryAftermathState(sceneId: JourneySceneId): StoryAftermathState {
  return { sceneId, current: null, pending: [], received: [] };
}

export function storyAftermathFor(sceneId: JourneySceneId, eventId: string): StoryAftermathMoment | null {
  // This registry lookup rejects unknown and cross-scene IDs before any text is shown.
  const line = storyResponseFor(sceneId, [eventId]);
  if (!line) return null;
  const turningPoint = TURNING_POINTS.has(eventId)
    || eventId.startsWith("heart.") || eventId.startsWith("womb.") || eventId.startsWith("lantern.placed.");
  return { sceneId, eventId, line, durationMs: turningPoint ? 5_600 : 3_600, turningPoint };
}

/** Keep the currently witnessed response intact; never replace it mid-sentence. */
export function enqueueStoryAftermath(state: StoryAftermathState, sceneId: JourneySceneId, eventIds: readonly string[]): StoryAftermathState {
  if (state.sceneId !== sceneId) return state;
  let current = state.current;
  const pending = [...state.pending];
  const received = new Set(state.received);
  let changed = false;
  for (const id of eventIds) {
    if (received.has(id)) continue;
    const moment = storyAftermathFor(sceneId, id);
    if (!moment) continue;
    received.add(id);
    changed = true;
    if (!current) current = moment;
    else pending.push(moment);
    // Preserve causal order among retained moments, prioritising revelations over
    // routine feedback when rapid input exceeds the small presentation buffer.
    while (pending.length > MAX_PENDING_AFTERMATH) {
      const routine = pending.findIndex(item => !item.turningPoint);
      pending.splice(routine < 0 ? 0 : routine, 1);
    }
  }
  return changed ? { ...state, current, pending, received: [...received] } : state;
}

/** A late callback from an old caption may not dismiss the next caption. */
export function advanceStoryAftermath(state: StoryAftermathState, eventId: string): StoryAftermathState {
  if (state.current?.eventId !== eventId) return state;
  return { ...state, current: state.pending[0] ?? null, pending: state.pending.slice(1) };
}

/** Only visible, unattended captions spend their presentation interval. */
export function canReadStoryAftermath(context: Readonly<{
  available: boolean;
  collapsed: boolean;
  inView: boolean;
  focusWithin: boolean;
  nextStepOpen: boolean;
}>) {
  return context.available && !context.collapsed && context.inView
    && !context.focusWithin && !context.nextStepOpen;
}
