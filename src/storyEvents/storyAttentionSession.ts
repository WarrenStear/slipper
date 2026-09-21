import {
  advanceStoryAttentionClock,
  createStoryAttentionClock,
  pauseStoryAttentionClock,
} from "./storyEventRuntime.ts";

/** A cancellable owner for one authored interval; the existing clock remains the time authority. */
export function createStoryAttentionSession(durationMs: number, continuous = true) {
  if (!Number.isFinite(durationMs) || durationMs < 0) {
    throw new RangeError("Story attention duration must be finite and non-negative.");
  }
  const clock = createStoryAttentionClock(continuous);
  let active = false;
  let completed = false;
  let cancelled = false;

  return {
    setActive(next: boolean) {
      if (completed || cancelled) return;
      // Reset sampling at both edges. A modal can open and close between frames;
      // none of its wall time may be counted when the next frame arrives.
      if (!next || active !== next) pauseStoryAttentionClock(clock);
      active = next;
    },
    sample(nowMs: number) {
      if (completed || cancelled) return { elapsedMs: clock.elapsedMs, completedNow: false };
      const elapsedMs = advanceStoryAttentionClock(clock, nowMs, active);
      const completedNow = active && Number.isFinite(nowMs) && nowMs >= 0 && elapsedMs >= durationMs;
      if (completedNow) completed = true;
      return { elapsedMs, completedNow };
    },
    cancel() {
      cancelled = true;
      active = false;
      pauseStoryAttentionClock(clock);
    },
  };
}
