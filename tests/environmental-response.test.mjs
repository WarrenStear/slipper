import assert from 'node:assert/strict';
import test from 'node:test';
import { acceptedWaterWave, environmentalResponseDelta } from '../src/cinematics/environmentalChoreography.ts';

test('environmental responses use only active shared-clock time and bound resumption', () => {
  assert.equal(environmentalResponseDelta(4, 4, .12), 0, 'settings or focus pause');
  assert.equal(environmentalResponseDelta(0, 4, .12), 0, 'scene clock reset');
  assert.equal(environmentalResponseDelta(4, 3, 0), 0, 'reduced motion or settled scene');
  assert.equal(environmentalResponseDelta(4, 3, .12), .05, 'resume cannot catch up wall time');
  assert.ok(Math.abs(environmentalResponseDelta(4.001, 4, .1) - .01) < 1e-10);
  assert.equal(environmentalResponseDelta(NaN, 0, .1), 0);
});

test('accepted water touch has three finite wavefronts and a quiet restored aftermath', () => {
  const frame = { scale: 0, opacity: 0 };
  for (const index of [0, 1, 2]) {
    assert.equal(acceptedWaterWave(0, index, frame).opacity, 0);
    assert.ok(acceptedWaterWave(2.8, index, frame).opacity > 0);
    assert.equal(acceptedWaterWave(8, index, frame).opacity, 0, 'restored or settled state');
    assert.equal(acceptedWaterWave(80, index, frame).opacity, 0, 'ripples never loop');
    assert.equal(acceptedWaterWave(3, index, frame), frame, 'the renderer reuses its frame object');
    assert.ok(frame.scale >= .5 && frame.scale <= 4.1);
  }
});
