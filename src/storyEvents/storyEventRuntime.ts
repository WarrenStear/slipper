import type { StoryEventDefinition, StoryEventInput } from "./storyEventTypes.ts";

/** Bind an input to the event the player actually began, not a newly eligible stage. */
export function matchesStoryEventInput(event: StoryEventDefinition, input: StoryEventInput) {
  return (input.eventId === undefined || input.eventId === event.id)
    && event.sceneId === input.sceneId
    && event.trigger === input.trigger
    && event.objectId === input.objectId
    && event.targetId === input.targetId
    && (!event.durationMs || (typeof input.duration === "number"
      && Number.isFinite(input.duration) && input.duration >= event.durationMs));
}

export type StoryAttentionClock = {
  elapsedMs: number;
  lastSampleMs: number | null;
  continuous: boolean;
};

/** Transient attention only. Neither wall time nor animation frames belong in a save. */
export function createStoryAttentionClock(continuous = true): StoryAttentionClock {
  return { elapsedMs: 0, lastSampleMs: null, continuous };
}

export function pauseStoryAttentionClock(clock: StoryAttentionClock) {
  clock.lastSampleMs = null;
  if (clock.continuous) clock.elapsedMs = 0;
}

/** A stalled/suspended frame cannot pay off an authored interval on return. */
export function advanceStoryAttentionClock(clock: StoryAttentionClock, nowMs: number, active: boolean) {
  if (!active || !Number.isFinite(nowMs) || nowMs < 0) {
    pauseStoryAttentionClock(clock);
    return clock.elapsedMs;
  }
  const previous = clock.lastSampleMs;
  clock.lastSampleMs = nowMs;
  if (previous === null) return clock.elapsedMs;
  const delta = nowMs - previous;
  if (delta < 0 || delta > 1000) {
    if (clock.continuous) clock.elapsedMs = 0;
    return clock.elapsedMs;
  }
  clock.elapsedMs += delta;
  return clock.elapsedMs;
}

export type StoryPointerGesture<T> = {
  pointerId: number | null;
  event: T | null;
  length: number;
  x: number;
  y: number;
};

export function createStoryPointerGesture<T>(): StoryPointerGesture<T> {
  return { pointerId: null, event: null, length: 0, x: 0, y: 0 };
}

export function beginStoryPointerGesture<T>(
  gesture: StoryPointerGesture<T>,
  pointerId: number,
  event: T | null,
  x: number,
  y: number,
  button = 0,
) {
  if (gesture.pointerId !== null || button !== 0) return false;
  gesture.pointerId = pointerId;
  gesture.event = event;
  gesture.length = 0;
  gesture.x = x;
  gesture.y = y;
  return true;
}

export function ownsStoryPointerGesture<T>(gesture: StoryPointerGesture<T>, pointerId: number) {
  return gesture.pointerId !== null && gesture.pointerId === pointerId;
}

export function cancelStoryPointerGesture<T>(gesture: StoryPointerGesture<T>) {
  gesture.pointerId = null;
  gesture.event = null;
  gesture.length = 0;
}

/** Releasing a joystick finger must not complete a wipe made by the other finger. */
export function finishStoryPointerGesture<T>(gesture: StoryPointerGesture<T>, pointerId: number) {
  if (!ownsStoryPointerGesture(gesture, pointerId)) return null;
  const finished = { ...gesture };
  cancelStoryPointerGesture(gesture);
  return finished;
}

// One bounded, non-persistent playback projection. The 3D finale reads the
// director's accepted attention clock instead of advancing an independent clock.
const sequencePlayback = { sceneId: "", eventId: "", elapsedMs: 0, durationMs: 0 };

export function publishStorySequencePlayback(sceneId: string, eventId: string, elapsedMs: number, durationMs: number) {
  sequencePlayback.sceneId = sceneId;
  sequencePlayback.eventId = eventId;
  sequencePlayback.elapsedMs = Math.max(0, Math.min(durationMs, elapsedMs));
  sequencePlayback.durationMs = durationMs;
}

export function readStorySequencePlayback(sceneId: string, eventId: string) {
  return sequencePlayback.sceneId === sceneId && sequencePlayback.eventId === eventId
    ? sequencePlayback.elapsedMs : 0;
}

export function clearStorySequencePlayback(sceneId: string) {
  if (sequencePlayback.sceneId !== sceneId) return;
  sequencePlayback.sceneId = "";
  sequencePlayback.eventId = "";
  sequencePlayback.elapsedMs = 0;
  sequencePlayback.durationMs = 0;
}
