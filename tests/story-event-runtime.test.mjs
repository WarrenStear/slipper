import assert from "node:assert/strict";
import test from "node:test";
import {
  advanceStoryAttentionClock, beginStoryPointerGesture, cancelStoryPointerGesture,
  clearStorySequencePlayback, createStoryAttentionClock, createStoryPointerGesture,
  finishStoryPointerGesture, matchesStoryEventInput, ownsStoryPointerGesture,
  pauseStoryAttentionClock, publishStorySequencePlayback, readStorySequencePlayback,
} from "../src/storyEvents/storyEventRuntime.ts";

const firstWipe = { id: "broken-floor.first-wipe", sceneId: "broken-floor.confession", trigger: "wipe", objectId: "broken-floor.reflection", actions: [] };
const secondWipe = { ...firstWipe, id: "broken-floor.forest-revealed" };
const input = { sceneId: firstWipe.sceneId, trigger: firstWipe.trigger, objectId: firstWipe.objectId, eventId: firstWipe.id };

test("a captured first wipe cannot become a second wipe after eligibility changes", () => {
  assert.equal(matchesStoryEventInput(firstWipe, input), true);
  assert.equal(matchesStoryEventInput(secondWipe, input), false);
  assert.equal(matchesStoryEventInput(secondWipe, { ...input, eventId: secondWipe.id }), true);
});

test("legacy callers without an event ID retain the authored matching contract", () => {
  const { eventId: _eventId, ...legacy } = input;
  assert.equal(matchesStoryEventInput(firstWipe, legacy), true);
  assert.equal(matchesStoryEventInput(secondWipe, legacy), true);
});

test("event identity does not bypass scene, trigger, object, or target checks", () => {
  for (const field of ["eventId", "sceneId", "trigger", "objectId", "targetId"]) {
    assert.equal(matchesStoryEventInput(firstWipe, { ...input, [field]: "unrelated" }), false, field);
  }
  assert.equal(matchesStoryEventInput(firstWipe, { ...input, eventId: "" }), false);
});

test("an authored duration accepts only sufficient finite attention", () => {
  const event = { ...firstWipe, durationMs: 4500 };
  for (const duration of [undefined, -1, 0, 4499, NaN, Infinity, "4500"]) {
    assert.equal(matchesStoryEventInput(event, { ...input, duration }), false, String(duration));
  }
  assert.equal(matchesStoryEventInput(event, { ...input, duration: 4500 }), true);
  assert.equal(matchesStoryEventInput(event, { ...input, duration: 5000 }), true);
});

test("an attention clock starts on a witnessed sample, not on page uptime", () => {
  const clock = createStoryAttentionClock();
  assert.equal(advanceStoryAttentionClock(clock, 90000, true), 0);
  assert.equal(advanceStoryAttentionClock(clock, 90500, true), 500);
  assert.equal(advanceStoryAttentionClock(clock, 91000, true), 1000);
});

test("gaze and stillness require a fresh uninterrupted interval after pause", () => {
  const clock = createStoryAttentionClock();
  advanceStoryAttentionClock(clock, 0, true);
  advanceStoryAttentionClock(clock, 900, true);
  pauseStoryAttentionClock(clock);
  assert.equal(clock.elapsedMs, 0);
  assert.equal(advanceStoryAttentionClock(clock, 100000, true), 0);
  assert.equal(advanceStoryAttentionClock(clock, 100400, true), 400);
});

test("inactive samples cannot finish a timed event", () => {
  const clock = createStoryAttentionClock();
  advanceStoryAttentionClock(clock, 0, true);
  advanceStoryAttentionClock(clock, 500, true);
  assert.equal(advanceStoryAttentionClock(clock, 1000, false), 0);
  assert.equal(advanceStoryAttentionClock(clock, 100000, false), 0);
  assert.equal(advanceStoryAttentionClock(clock, 100001, true), 0);
});

test("the reverse-light sequence pauses without erasing already witnessed light", () => {
  const clock = createStoryAttentionClock(false);
  advanceStoryAttentionClock(clock, 0, true);
  advanceStoryAttentionClock(clock, 900, true);
  assert.equal(advanceStoryAttentionClock(clock, 1000, false), 900);
  assert.equal(advanceStoryAttentionClock(clock, 100000, false), 900);
  assert.equal(advanceStoryAttentionClock(clock, 100010, true), 900);
  assert.equal(advanceStoryAttentionClock(clock, 100510, true), 1400);
});

test("a suspended frame cannot fast-forward a sequence", () => {
  const clock = createStoryAttentionClock(false);
  advanceStoryAttentionClock(clock, 0, true);
  advanceStoryAttentionClock(clock, 500, true);
  assert.equal(advanceStoryAttentionClock(clock, 60000, true), 500);
  assert.equal(advanceStoryAttentionClock(clock, 60300, true), 800);
});

test("a stalled frame breaks continuous attention rather than completing it", () => {
  const clock = createStoryAttentionClock();
  advanceStoryAttentionClock(clock, 0, true);
  advanceStoryAttentionClock(clock, 900, true);
  assert.equal(advanceStoryAttentionClock(clock, 60000, true), 0);
  assert.equal(advanceStoryAttentionClock(clock, 60200, true), 200);
});

test("repeated timestamps and a backwards clock cannot manufacture attention", () => {
  const clock = createStoryAttentionClock();
  advanceStoryAttentionClock(clock, 500, true);
  assert.equal(advanceStoryAttentionClock(clock, 500, true), 0);
  assert.equal(advanceStoryAttentionClock(clock, 800, true), 300);
  assert.equal(advanceStoryAttentionClock(clock, 700, true), 0);
  assert.equal(advanceStoryAttentionClock(clock, 900, true), 200);
});

test("invalid time samples safely interrupt attention", () => {
  for (const now of [NaN, Infinity, -1]) {
    const clock = createStoryAttentionClock();
    advanceStoryAttentionClock(clock, 0, true);
    advanceStoryAttentionClock(clock, 500, true);
    assert.equal(advanceStoryAttentionClock(clock, now, true), 0);
    assert.equal(clock.lastSampleMs, null);
  }
});

test("low frame rates still accumulate valid foreground time", () => {
  const clock = createStoryAttentionClock();
  for (let time = 0; time <= 5000; time += 1000) advanceStoryAttentionClock(clock, time, true);
  assert.equal(clock.elapsedMs, 5000);
});

test("a second pointer cannot replace the first pointer's story object", () => {
  const gesture = createStoryPointerGesture();
  assert.equal(beginStoryPointerGesture(gesture, 7, firstWipe, 20, 30), true);
  assert.equal(beginStoryPointerGesture(gesture, 9, secondWipe, 80, 90), false);
  assert.equal(gesture.pointerId, 7);
  assert.equal(gesture.event, firstWipe);
  assert.equal(gesture.x, 20);
});

test("releasing another finger cannot complete or cancel the active wipe", () => {
  const gesture = createStoryPointerGesture();
  beginStoryPointerGesture(gesture, 7, firstWipe, 20, 30);
  gesture.length = 180;
  assert.equal(ownsStoryPointerGesture(gesture, 9), false);
  assert.equal(finishStoryPointerGesture(gesture, 9), null);
  assert.equal(gesture.event, firstWipe);
  const result = finishStoryPointerGesture(gesture, 7);
  assert.equal(result.event, firstWipe);
  assert.equal(result.length, 180);
  assert.equal(gesture.pointerId, null);
  assert.equal(finishStoryPointerGesture(gesture, 7), null);
});

test("a cancelled gesture cannot complete when a delayed pointerup arrives", () => {
  const gesture = createStoryPointerGesture();
  beginStoryPointerGesture(gesture, 1, firstWipe, 20, 30);
  gesture.length = 180;
  cancelStoryPointerGesture(gesture);
  assert.equal(finishStoryPointerGesture(gesture, 1), null);
  assert.equal(gesture.event, null);
  assert.equal(gesture.length, 0);
});

test("right and middle mouse buttons do not start story interactions", () => {
  const gesture = createStoryPointerGesture();
  assert.equal(beginStoryPointerGesture(gesture, 1, firstWipe, 0, 0, 2), false);
  assert.equal(beginStoryPointerGesture(gesture, 1, firstWipe, 0, 0, 1), false);
  assert.equal(gesture.pointerId, null);
});

test("pointer zero is a valid owner and looking without an object remains harmless", () => {
  const gesture = createStoryPointerGesture();
  assert.equal(beginStoryPointerGesture(gesture, 0, null, 0, 0), true);
  assert.equal(ownsStoryPointerGesture(gesture, 0), true);
  assert.equal(finishStoryPointerGesture(gesture, 0).event, null);
});

test("a finished gesture keeps its original event when the next stage begins", () => {
  const gesture = createStoryPointerGesture();
  beginStoryPointerGesture(gesture, 1, firstWipe, 0, 0);
  const first = finishStoryPointerGesture(gesture, 1);
  beginStoryPointerGesture(gesture, 1, secondWipe, 10, 20);
  assert.equal(first.event, firstWipe);
  assert.equal(gesture.event, secondWipe);
  assert.equal(matchesStoryEventInput(secondWipe, { ...input, eventId: first.event.id }), false);
});

test("reverse-light rendering reads the director's clock and cannot leak into another scene", () => {
  publishStorySequencePlayback("epilogue.constellation", "reverse", 2300, 24000);
  assert.equal(readStorySequencePlayback("epilogue.constellation", "reverse"), 2300);
  assert.equal(readStorySequencePlayback("broken-floor.confession", "reverse"), 0);
  assert.equal(readStorySequencePlayback("epilogue.constellation", "other"), 0);
  clearStorySequencePlayback("broken-floor.confession");
  assert.equal(readStorySequencePlayback("epilogue.constellation", "reverse"), 2300);
  clearStorySequencePlayback("epilogue.constellation");
  assert.equal(readStorySequencePlayback("epilogue.constellation", "reverse"), 0);
});

test("reverse-light progress is bounded to its authored duration", () => {
  publishStorySequencePlayback("epilogue.constellation", "reverse", 99999, 24000);
  assert.equal(readStorySequencePlayback("epilogue.constellation", "reverse"), 24000);
  publishStorySequencePlayback("epilogue.constellation", "reverse", -100, 24000);
  assert.equal(readStorySequencePlayback("epilogue.constellation", "reverse"), 0);
  clearStorySequencePlayback("epilogue.constellation");
});
