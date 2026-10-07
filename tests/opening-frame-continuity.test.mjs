import test from 'node:test';
import assert from 'node:assert/strict';
import { advanceOpeningRoom, openingRoomAppearance } from '../src/world/opening/openingComposition.ts';
import { openingMotionDelta, openingRoomTarget } from '../src/cinematics/openingPresentation.ts';

// Execute the actual supplied-time owner; rendering acceptance is separate.
function roomStep(current, target, delta, active = true) {
  const stage = target === 1 ? 3 : target * 5;
  return advanceOpeningRoom(current, stage, delta, active, false);
}

for (const delta of [.251, .5, 1, 20]) {
  test(`an active ${delta}s frame advances a bounded slice instead of freezing`, () => {
    assert.equal(openingMotionDelta(delta, true), .05);
    const next = roomStep(0, 1, delta);
    assert.ok(next > 0, 'an earned reveal must not stop on consistently slow rendering');
    assert.ok(next < .02, 'a delayed frame must not fast-forward the room');
  });
}

for (const stage of [1, 2, 3]) {
  test(`stage ${stage} keeps converging during sustained slow rendering`, () => {
    const target = openingRoomTarget(stage);
    let current = 0;
    for (let frame = 0; frame < 300; frame += 1) {
      const previous = current;
      current = roomStep(current, target, .5);
      assert.ok(current > previous);
      assert.ok(current <= target);
    }
    assert.ok(current / target > .99, 'progress converges without a target snap');
  });
}

test('paused frames never accrue room time, including a stalled frame', () => {
  for (const delta of [0, 1 / 60, .25, .251, .5, 20, NaN, Infinity]) {
    assert.equal(openingMotionDelta(delta, false), 0);
    assert.equal(roomStep(.2, 1, delta, false), .2);
  }
});

test('resuming after a pause consumes one bounded frame, not missed wall time', () => {
  let current = .2;
  for (let frame = 0; frame < 50; frame += 1) {
    current = roomStep(current, 1, 20, false);
  }
  assert.equal(current, .2);
  assert.equal(roomStep(current, 1, 20), roomStep(current, 1, .05));
});

test('invalid or non-positive durations cannot advance the room', () => {
  for (const delta of [NaN, Infinity, -Infinity, -1, -0, 0]) {
    assert.equal(openingMotionDelta(delta, true), 0);
    assert.equal(roomStep(.2, 1, delta), .2);
  }
});

test('normal frame cadence retains the existing authored damping', () => {
  for (const delta of [1 / 144, 1 / 60, 1 / 30, .05]) {
    assert.equal(openingMotionDelta(delta, true), delta);
    const expected = .2 + .8 * (1 - Math.exp(-(3 / 8) * delta));
    assert.ok(Math.abs(roomStep(.2, 1, delta) - expected) <= 1e-15);
  }
});

test('the old 250ms cutoff has no discontinuity', () => {
  for (const delta of [.249, .25, .251]) {
    assert.equal(openingMotionDelta(delta, true), .05);
  }
});

test('an already settled room does not drift', () => {
  for (const stage of [0, 1, 2, 3]) {
    const target = openingRoomTarget(stage);
    for (const delta of [1 / 60, .5, 20]) assert.equal(roomStep(target, target, delta), target);
  }
});


test('the aperture cannot expose ordinary boards during the shared room yield', () => {
  for (let value = 0; value <= 1; value += .001) {
    const appearance = openingRoomAppearance(value);
    if (appearance.floorVisible) assert.equal(appearance.apertureOpacity, .94);
    if (appearance.apertureOpacity < .94) assert.equal(appearance.floorVisible, false);
    assert.ok(appearance.roomOpacity >= 0 && appearance.roomOpacity <= 1);
  }
  assert.equal(openingRoomAppearance(.4).apertureOpacity, .94);
  assert.equal(openingRoomAppearance(1).apertureOpacity, 0);
});
test('reduced motion and restored entered state start at the same final composition', () => {
  const reduced = advanceOpeningRoom(.4, 3, 1/60, true, true);
  assert.equal(reduced, 1);
  assert.deepEqual(openingRoomAppearance(reduced), openingRoomAppearance(openingRoomTarget(3)));
  assert.equal(advanceOpeningRoom(.4, 3, 1/60, false, true), .4);
});
