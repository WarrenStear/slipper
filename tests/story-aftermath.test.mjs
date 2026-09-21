import assert from "node:assert/strict";
import test from "node:test";
import { createStoryAftermathState, storyAftermathFor, enqueueStoryAftermath, advanceStoryAftermath, MAX_PENDING_AFTERMATH } from "../src/storyEvents/storyAftermath.ts";
import { createStoryAttentionSession } from "../src/storyEvents/storyAttentionSession.ts";
import { STORY_EVENTS } from "../src/storyEvents/storyEventRegistry.ts";
import fs from "node:fs";

const scene = "broken-floor.confession";
const first = "broken-floor.first-wipe", second = "broken-floor.forest-revealed", inversion = "broken-floor.inversion";
const start = () => createStoryAftermathState(scene);

test("rapid accepted actions preserve the caption already being witnessed", () => {
  const one = enqueueStoryAftermath(start(), scene, [first]);
  const two = enqueueStoryAftermath(one, scene, [second]);
  assert.equal(two.current, one.current);
  assert.equal(two.current.eventId, first);
  assert.deepEqual(two.pending.map(x => x.eventId), [second]);
  assert.equal(one.pending.length, 0);
});
test("a notification with multiple actions retains their causal order", () => {
  let state = enqueueStoryAftermath(start(), scene, [first, second, inversion]);
  for (const id of [first, second, inversion]) {
    assert.equal(state.current.eventId, id);
    state = advanceStoryAftermath(state, id);
  }
  assert.equal(state.current, null); assert.equal(state.pending.length, 0);
});
test("a late callback cannot dismiss the following moment", () => {
  let state = enqueueStoryAftermath(start(), scene, [first, second]);
  state = advanceStoryAftermath(state, first);
  assert.equal(advanceStoryAftermath(state, first), state);
  assert.equal(state.current.eventId, second);
});
test("duplicates neither restart nor requeue current or dismissed captions", () => {
  const one = enqueueStoryAftermath(start(), scene, [first, first]);
  assert.equal(one.pending.length, 0);
  assert.equal(enqueueStoryAftermath(one, scene, [first]), one);
  const done = advanceStoryAftermath(one, first);
  assert.equal(enqueueStoryAftermath(done, scene, [first]), done);
});
test("foreign scene notifications do not replace an active caption", () => {
  const state = enqueueStoryAftermath(start(), scene, [first]);
  assert.equal(enqueueStoryAftermath(state, "crowned.sovereignty", ["crown.recognised"]), state);
  assert.equal(storyAftermathFor(scene, "crown.recognised"), null);
});
test("unknown and internal event IDs never produce captions or grow the buffer", () => {
  const state = start();
  assert.equal(enqueueStoryAftermath(state, scene, ["unknown", "broken-floor.confession.enter"]), state);
  assert.equal(state.received.length, 0);
});
test("ordinary feedback remains 3.6 seconds while revelations receive 5.6 seconds", () => {
  assert.equal(storyAftermathFor(scene, first).durationMs, 3600);
  assert.equal(storyAftermathFor(scene, inversion).durationMs, 5600);
  assert.equal(storyAftermathFor("blue-moon.caged-bird", "blue-moon.cage-recognised").turningPoint, true);
});
test("all authored Heart alternatives receive identical presentation time", () => {
  const options = ["heart.rose.chosen", "heart.feather.chosen", "heart.reflection.chosen"].map(id => storyAftermathFor("climb.heart", id));
  assert.ok(options.every(x => x && x.turningPoint && x.durationMs === 5600));
  assert.equal(new Set(options.map(x => x.line)).size, 1);
});
test("sacred stillness and the final light sequence do not acquire a caption queue", () => {
  assert.equal(storyAftermathFor("river.release-surrender", "river.surrender"), null);
  assert.equal(storyAftermathFor("epilogue.constellation", "epilogue.reverse-light-complete"), null);
});
test("valid input cannot create unbounded pending captions", () => {
  for (const sceneId of new Set(STORY_EVENTS.map(e => e.sceneId))) {
    let state = createStoryAftermathState(sceneId);
    for (const event of STORY_EVENTS.filter(e => e.sceneId === sceneId)) {
      state = enqueueStoryAftermath(state, sceneId, [event.id]);
      assert.ok(state.pending.length <= MAX_PENDING_AFTERMATH);
    }
    assert.ok(state.received.length <= STORY_EVENTS.filter(e => e.sceneId === sceneId).length);
  }
});
test("overflow preserves the active moment and chronological order with a fixed bound", () => {
  const sceneId = "crowned.sovereignty";
  // Defensive overflow, not an assertion that mutually exclusive choices can be earned together.
  const ids = ["crown.recognised", "lantern.placed.mirror", "lantern.placed.reading-nook", "lantern.placed.fountain", "lantern.placed.window"];
  assert.ok(ids.every(id => storyAftermathFor(sceneId, id)));
  const state = enqueueStoryAftermath(createStoryAftermathState(sceneId), sceneId, ids);
  assert.equal(state.current.eventId, ids[0]);
  assert.equal(state.pending.length, MAX_PENDING_AFTERMATH);
  const order = state.pending.map(x => ids.indexOf(x.eventId));
  assert.deepEqual(order, [...order].sort((a,b) => a-b));
});
test("resetting the presentation creates no earned events and replays no memory", () => {
  const state = createStoryAftermathState("enchanted.rabbit-hole");
  assert.deepEqual(state, { sceneId: "enchanted.rabbit-hole", current: null, pending: [], received: [] });
});
test("holding or concealing a caption cannot spend its interval offscreen", () => {
  const clock = createStoryAttentionSession(5600, false);
  clock.setActive(true); clock.sample(0); clock.sample(600);
  clock.setActive(false); assert.equal(clock.sample(99000).completedNow, false);
  clock.setActive(true); assert.equal(clock.sample(100000).elapsedMs, 600);
  for (let i=1;i<5;i++) assert.equal(clock.sample(100000+i*1000).completedNow, false);
  assert.equal(clock.sample(105000).completedNow, true);
});
test("a cancelled caption cannot finish after a player deliberately continues", () => {
  const clock = createStoryAttentionSession(3600, false);
  clock.setActive(true); clock.sample(0); clock.cancel();
  assert.equal(clock.sample(4000).completedNow, false);
});
const read = path => fs.readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
test("caption controls never dispatch progression or persist presentation state", () => {
  const hook = read("src/hooks/useStoryAftermath.ts");
  assert.doesNotMatch(hook, /dispatchStoryEvent|completeScene|localStorage|sessionStorage|witnessEntry/);
  assert.match(hook, /sessionRef\.current\?\.cancel\(\)/);
  assert.match(hook, /control\.visible && !control\.held/);
});
test("same-scene transitions suspend guidance without destroying accepted aftermath", () => {
  const hook = read("src/hooks/useStoryAftermath.ts");
  assert.match(hook, /previous.sceneId === sceneId \? previous : createStoryAftermathState\(sceneId\)/);
  assert.doesNotMatch(hook, /\}, \[sceneId, active\]\)/);
  const guide = read("src/components/ui/GuidedStoryMoment.tsx");
  assert.match(guide, /available && !collapsed/);
  assert.match(guide, /aria-pressed=\{held\}/);
  assert.match(guide, /Continue past this moment/);
});
