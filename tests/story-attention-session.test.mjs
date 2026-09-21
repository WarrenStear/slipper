import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { createStoryAttentionSession } from "../src/storyEvents/storyAttentionSession.ts";

function run(session, from, to, step = 100) {
  let result;
  for (let now = from; now <= to; now += step) result = session.sample(now);
  return result;
}

test("an attention session starts inactive and requires a foreground sample", () => {
  const session = createStoryAttentionSession(1000);
  assert.equal(run(session, 0, 3000).elapsedMs, 0);
  session.setActive(true);
  assert.deepEqual(session.sample(90000), { elapsedMs: 0, completedNow: false });
  assert.equal(run(session, 90100, 90900).completedNow, false);
  assert.equal(session.sample(91000).completedNow, true);
});

test("continuous stillness restarts after opening settings", () => {
  const session = createStoryAttentionSession(1000);
  session.setActive(true);
  assert.equal(run(session, 0, 800).elapsedMs, 800);
  session.setActive(false);
  assert.equal(run(session, 900, 4000).elapsedMs, 0);
  session.setActive(true);
  assert.equal(run(session, 4100, 5000).completedNow, false);
  assert.equal(session.sample(5100).completedNow, true);
});

test("opening and closing settings between frames still interrupts continuous attention", () => {
  const session = createStoryAttentionSession(1000);
  session.setActive(true);
  run(session, 0, 900);
  session.setActive(false);
  session.setActive(true);
  assert.deepEqual(session.sample(1000), { elapsedMs: 0, completedNow: false });
});

test("sequence playback keeps witnessed time but excludes all overlay time", () => {
  const session = createStoryAttentionSession(2000, false);
  session.setActive(true);
  run(session, 0, 800);
  session.setActive(false);
  assert.deepEqual(run(session, 900, 6000), { elapsedMs: 800, completedNow: false });
  session.setActive(true);
  assert.equal(session.sample(6100).elapsedMs, 800);
  assert.equal(run(session, 6200, 7200).completedNow, false);
  assert.equal(session.sample(7300).completedNow, true);
});

test("a brief overlay between frames cannot donate time to a sequence", () => {
  const session = createStoryAttentionSession(1000, false);
  session.setActive(true);
  run(session, 0, 900);
  session.setActive(false);
  session.setActive(true);
  assert.deepEqual(session.sample(1500), { elapsedMs: 900, completedNow: false });
  assert.equal(session.sample(1600).completedNow, true);
});

test("repeated active notifications do not keep restarting the interval", () => {
  const session = createStoryAttentionSession(1000);
  for (let time = 0; time <= 900; time += 100) {
    session.setActive(true);
    assert.equal(session.sample(time).completedNow, false);
  }
  session.setActive(true);
  assert.equal(session.sample(1000).completedNow, true);
});

test("completion is emitted exactly once despite duplicate callbacks", () => {
  const session = createStoryAttentionSession(500);
  session.setActive(true);
  assert.equal(run(session, 0, 500).completedNow, true);
  for (let time = 500; time < 2000; time += 100) {
    session.setActive(false);
    session.setActive(true);
    assert.equal(session.sample(time).completedNow, false);
  }
});

test("cancellation rejects a queued completion and cannot be reactivated", () => {
  const session = createStoryAttentionSession(500);
  session.setActive(true);
  run(session, 0, 400);
  session.cancel();
  session.setActive(true);
  assert.equal(run(session, 500, 2000).completedNow, false);
});

test("cancelling one scene cannot affect its replacement session", () => {
  const old = createStoryAttentionSession(500);
  old.setActive(true);
  run(old, 0, 400);
  old.cancel();
  const replacement = createStoryAttentionSession(500);
  replacement.setActive(true);
  assert.equal(old.sample(500).completedNow, false);
  assert.equal(run(replacement, 500, 1000).completedNow, true);
});

test("browser suspension cannot fast-forward a sequence", () => {
  const session = createStoryAttentionSession(1000, false);
  session.setActive(true);
  run(session, 0, 400);
  assert.deepEqual(session.sample(90000), { elapsedMs: 400, completedNow: false });
  assert.equal(run(session, 90100, 90600).completedNow, true);
});

test("a stalled frame restarts continuous attention", () => {
  const session = createStoryAttentionSession(1000);
  session.setActive(true);
  run(session, 0, 900);
  assert.deepEqual(session.sample(90000), { elapsedMs: 0, completedNow: false });
});

test("invalid and backwards timestamps never manufacture completion", () => {
  for (const invalid of [NaN, Infinity, -1]) {
    const session = createStoryAttentionSession(1000);
    session.setActive(true);
    run(session, 0, 900);
    assert.equal(session.sample(invalid).completedNow, false);
    assert.equal(session.sample(1000).completedNow, false);
  }
  const session = createStoryAttentionSession(1000);
  session.setActive(true);
  run(session, 1000, 1900);
  assert.deepEqual(session.sample(1800), { elapsedMs: 0, completedNow: false });
});

test("invalid authored durations fail before a session can run", () => {
  for (const duration of [NaN, Infinity, -1, "1000", undefined]) {
    assert.throws(() => createStoryAttentionSession(duration), RangeError);
  }
});

test("a zero-duration event still requires active valid input and completes once", () => {
  const session = createStoryAttentionSession(0);
  assert.equal(session.sample(0).completedNow, false);
  session.setActive(true);
  assert.equal(session.sample(NaN).completedNow, false);
  assert.equal(session.sample(0).completedNow, true);
  assert.equal(session.sample(1).completedNow, false);
});

test("semantic controls wire overlay, focus and page lifecycle with matching cleanup", () => {
  const source = readFileSync(new URL("../src/components/ui/AccessibleStoryObjects.tsx", import.meta.url), "utf8");
  assert.match(source, /createStoryAttentionSession\(duration, !isSequence\)/);
  assert.match(source, /useSettingsStore\.subscribe/);
  assert.match(source, /next\.drawerOpen !== previous\.drawerOpen/);
  assert.match(source, /session\.cancel\(\)/);
  assert.match(source, /unsubscribeSettings\(\)/);
  assert.match(source, /!useSettingsStore\.getState\(\)\.drawerOpen/);
  for (const name of ["blur", "focus", "pagehide", "pageshow"]) {
    assert.ok(source.includes(`addEventListener("${name}"`));
    assert.ok(source.includes(`removeEventListener("${name}"`));
  }
});
