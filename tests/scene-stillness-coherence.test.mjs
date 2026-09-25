import assert from 'node:assert/strict';
import test from 'node:test';
import { advancePresentationStillness } from '../src/lib/presentationStillness.ts';
import { resolveSceneLook } from '../src/components/three/artDirection/SceneLookRegistry.ts';
import { advanceSceneMotion } from '../src/components/three/artDirection/sceneMotion.ts';

const frameFor = look => ({ stillness: Number(look.stillness), motion: { ...look.motion }, time: { vegetation: 0, cloth: 0, water: 0, particles: 0, flame: 0 } });

test('Seer visual attention requires still position and orientation in a witnessed clearing', () => {
  let elapsed = 0;
  for (let i = 0; i < 150; i++) elapsed = advancePresentationStillness(elapsed, 1/60, true, true, 0, 0);
  assert.ok(elapsed >= 2.4);
  assert.equal(advancePresentationStillness(elapsed, 1/60, true, true, 0, .08), 0, 'Turning in place must disturb the reflection');
  assert.equal(advancePresentationStillness(elapsed, 1/60, true, true, .03, 0), 0);
  for (const [active, inside, delta] of [[false, true, .05], [true, false, .05], [true, true, 4], [true, true, NaN]]) {
    assert.equal(advancePresentationStillness(elapsed, delta, active, inside, 0, 0), 0);
  }
});

test('one eased quietness stops every environmental clock and motion resumes without a time jump', () => {
  const moving = resolveSceneLook('sunset.stillness', 'high');
  const quiet = resolveSceneLook('sunset.stillness', 'high', false, { mirrorStill: true });
  const frame = frameFor(moving);
  for (let i = 0; i < 600; i++) advanceSceneMotion(frame, quiet, 1/60, true, false, false);
  assert.equal(frame.stillness, 1);
  assert.ok(Object.values(frame.motion).every(value => value === 0));
  const held = structuredClone(frame);
  for (let i = 0; i < 90; i++) advanceSceneMotion(frame, quiet, 1/60, true, false, false);
  assert.deepEqual(frame, held);
  advanceSceneMotion(frame, moving, 1/60, true, false, false);
  assert.ok(frame.stillness < 1 && frame.stillness > .9);
  assert.ok(frame.motion.water > 0 && frame.time.water > held.time.water);
  assert.ok(frame.time.water - held.time.water < .001);
});

test('completed Surrender retains zero motion, pauses cleanly and releases gradually in the next scene', () => {
  const quiet = resolveSceneLook('river.release-surrender', 'cinematic', false, { surrenderComplete: true });
  const frame = frameFor(quiet);
  const snapshot = structuredClone(frame);
  const next = resolveSceneLook('fork.weighing', 'high');
  advanceSceneMotion(frame, next, 20, false, false, false);
  assert.deepEqual(frame, snapshot, 'Hidden or settings-paused frames do not run');
  advanceSceneMotion(frame, next, 1/60, true, true, false);
  assert.ok(frame.stillness > .9 && frame.stillness < 1, 'Audio shares a gradual release even with reduced motion');
  assert.ok(Object.values(frame.motion).every(value => value === 0));
  assert.deepEqual(frame.time, snapshot.time);
});

test('SceneLook exposes scene-scoped acoustic consequence targets without changing the story', () => {
  assert.equal(resolveSceneLook('broken-floor.confession', 'high', false, { openingReveal: .5 }).audio.openingReveal, .5);
  const still = resolveSceneLook('sunset.stillness', 'low', true, { mirrorStill: true });
  assert.equal(still.audio.mirrorStillness, 1);
  assert.equal(still.budget.reflectionSize, 0);
  assert.equal(resolveSceneLook('crowned.home', 'high', false, { surrenderComplete: true }).audio.surrenderRelease, 0);
  assert.equal(resolveSceneLook('thorned.self-owned-world', 'high', false, { compression: 1 }).audio.domesticCompression, 0);
});
