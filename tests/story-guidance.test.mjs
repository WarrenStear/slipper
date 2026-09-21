import assert from "node:assert/strict";
import test from "node:test";
import { resolveStoryGuidance } from "../src/lib/storyGuidance.ts";

test("story guidance escalates from environment to prose to direction", () => {
  const input = { guidanceDelayMs: 30_000, guidanceLines: ["The water is still waiting."] };
  assert.equal(resolveStoryGuidance({ ...input, idleMs: 29_999 }).level, 0);
  assert.equal(resolveStoryGuidance({ ...input, idleMs: 30_000 }).level, 1);
  assert.equal(resolveStoryGuidance({ ...input, idleMs: 46_000 }).level, 2);
  assert.deepEqual(resolveStoryGuidance({ ...input, idleMs: 66_000 }), {
    level: 3,
    environmentalStrength: 1,
    poeticLine: "The water is still waiting.",
    allowDirectionalCue: false,
  });
  assert.equal(resolveStoryGuidance({ ...input, idleMs: 98_000 }).allowDirectionalCue, true);
});

test("sacred stillness suppresses navigation guidance", () => {
  assert.deepEqual(
    resolveStoryGuidance({ idleMs: 240_000, suppressed: true, guidanceLines: ["Unused"] }),
    { level: 0, environmentalStrength: 0, poeticLine: null, allowDirectionalCue: false },
  );
});
