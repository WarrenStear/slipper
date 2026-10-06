import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { observeInteractionTarget } from "../src/player/interactionFacts.ts";

const eye = Object.freeze({ x: 2, y: 1.6, z: -4 });
const forward = Object.freeze({ x: 0, y: 0, z: 1 });

test("physical reach is grounded while gaze includes the object's height", () => {
  const low = observeInteractionTarget(eye, forward, { x: 2, y: 1.6, z: -1 }, 3);
  assert.deepEqual(low, { distance: 3, alignment: 1, inside: true, looking: true });
  const high = observeInteractionTarget(eye, forward, { x: 2, y: 20, z: -1 }, 3);
  assert.equal(high.inside, true);
  assert.equal(high.looking, false);
  assert.ok(high.alignment < .7);
  assert.equal(observeInteractionTarget(eye, forward, { x: 2, y: 1.6, z: -.99 }, 3).inside, false);
});

test("close targets retain comfortable reach without forcing a camera turn", () => {
  assert.equal(observeInteractionTarget(eye, forward, { x: 2, y: 1.6, z: -4.849 }, 1).looking, true);
  assert.equal(observeInteractionTarget(eye, forward, { x: 2, y: 1.6, z: -4.851 }, 1).looking, false);
  assert.equal(observeInteractionTarget({ x: 0, y: 0, z: 0 }, forward, { x: 0, y: 0, z: -.85 }, 1).looking, false);
  assert.deepEqual(observeInteractionTarget(eye, forward, eye, 0), {
    distance: 0, alignment: 1, inside: true, looking: true,
  });
});

test("range and gaze observations match the original physical math across representative poses", () => {
  for (const x of [-5, -.2, 0, 2, 8]) for (const y of [-2, 0, 1.6, 12]) for (const z of [-9, -4, -1, 3]) {
    const target = Object.freeze({ x, y, z });
    const dx = x - eye.x, dy = y - eye.y, dz = z - eye.z;
    const distance = Math.hypot(dx, dz);
    const lengthSquared = dx * dx + dy * dy + dz * dz;
    const alignment = lengthSquared > .001 ? dz * (1 / Math.sqrt(lengthSquared)) : 1;
    const facts = observeInteractionTarget(eye, forward, target, 3);
    assert.deepEqual(facts, { distance, alignment, inside: distance <= 3, looking: alignment > .7 || distance < .85 });
  }
});

test("malformed physical observations cannot focus an object", () => {
  for (const target of [{ x: NaN, y: 0, z: 0 }, { x: 0, y: Infinity, z: 0 }]) {
    assert.equal(observeInteractionTarget(eye, forward, target, 3).inside, false);
    assert.equal(observeInteractionTarget(eye, forward, target, 3).looking, false);
  }
  assert.equal(observeInteractionTarget(eye, forward, eye, -1).inside, false);
  assert.equal(observeInteractionTarget(eye, forward, eye, NaN).inside, false);
});

test("physical observation has no persistence, story eligibility, or consequence dependency", () => {
  const source = readFileSync(new URL("../src/player/interactionFacts.ts", import.meta.url), "utf8");
  assert.doesNotMatch(source, /(?:import|useJourneyStore|dispatchStoryEvent|completeRitual|witnessEntry|setWorldFlag)/);
  const director = readFileSync(new URL("../src/components/three/storyEvents/StoryEventDirector.tsx", import.meta.url), "utf8");
  assert.match(director, /observeInteractionTarget\(/);
  assert.match(director, /host\?\.readPhysical\(/);
  assert.match(director, /runtime\.publishPhysicalAttention\(lease, event\.id, facts,/);
  const frame = director.slice(director.indexOf("useFrame("), director.indexOf("const surrenderQuiet"));
  assert.doesNotMatch(frame, /dispatchStoryEvent|completeRitual|witnessEntry|setWorldFlag|runtime\.dispatch\(/);
  const port = readFileSync(new URL("../src/player/physicalObservation.ts", import.meta.url), "utf8");
  assert.doesNotMatch(port, /(?:^|\n)import\s|useJourneyStore|dispatchStoryEvent|completeRitual|witnessEntry|setWorldFlag/);
});
