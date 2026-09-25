import assert from 'node:assert/strict';
import test from 'node:test';
import { Color } from 'three';
import { createForkPath } from '../src/components/three/environment/forkLandscapeGeometry.ts';
import { CINEMATIC_ACTOR_CUES, sampleActorCue } from '../src/cinematics/cinematicCueRegistry.ts';
import { objectsForScene } from '../src/storyEvents/storyEventRegistry.ts';

test('Fork margins meet the clearing, the future fades, and both routes retain the same flat walk surface', () => {
  const earth = new Color('#26241b').toArray();
  for (const future of [false, true]) {
    const geometry = createForkPath(future), p = geometry.getAttribute('position'), colors = geometry.getAttribute('color');
    assert.equal(geometry.index.count / 3, 384);
    for (let i = 0; i < p.count; i++) {
      assert.ok(Math.abs(p.getY(i) - .017) < 1e-7);
      assert.ok([p.getX(i), p.getZ(i)].every(Number.isFinite));
      if (i % 5 === 0 || i % 5 === 4) earth.forEach((v, channel) => assert.ok(Math.abs(colors.array[i * 3 + channel] - v) < 1e-7));
    }
    assert.equal(p.getZ(2), -6);
    assert.equal(p.getZ(p.count - 3), future ? 34 : -1);
    if (future) assert.ok(colors.getX(p.count - 3) < colors.getX(2), 'the future has no bright destination');
    geometry.dispose();
  }
});

test('Swan starts outside bridge rails and still reaches the unchanged physical story volume', () => {
  const sanctuary = CINEMATIC_ACTOR_CUES['blue-moon.sanctuary'].find(c => c.actor === 'swan');
  const sanctuaryPose = sampleActorCue(sanctuary, 0, [0, 0, -10], true, {});
  assert.ok(sanctuaryPose.x >= 5 && sanctuaryPose.z <= 1, 'sanctuary resting silhouette clears the bridge rails');
  assert.ok(Math.abs(sanctuaryPose.yaw + Math.PI / 2) < 1e-10);
  const cue = CINEMATIC_ACTOR_CUES['blue-moon.intimacy'].find(c => c.actor === 'swan');
  const object = objectsForScene('blue-moon.intimacy').find(o => o.id === 'blue-moon.swan');
  assert.ok(Math.abs(cue.from[0]) > 4 && cue.from[2] < 0);
  assert.deepEqual(object.localPosition, [-3, .2, 3]);
  assert.equal(object.radius, 2.2);
  assert.deepEqual(cue.to, [-4.4, .2, 3]);
  assert.ok(Math.hypot(...cue.to.map((value, i) => value - object.localPosition[i])) <= object.radius - .79,
    'the visible terminal pose keeps at least .79 m inside the unchanged interaction volume');
  const pose = sampleActorCue(cue, cue.duration, [0, 0, 0], false, {});
  assert.deepEqual([pose.x, pose.y, pose.z], cue.to);
  const reduced = sampleActorCue(cue, 0, [0, 0, 0], true, {});
  assert.deepEqual([reduced.x, reduced.y, reduced.z], cue.to, 'reduced motion keeps the Swan inside its physical interaction');
  assert.equal(reduced.yaw, Math.PI / 2);
  assert.equal(pose.yaw, Math.PI / 2);
  assert.equal(sampleActorCue(cue, cue.duration / 2, [0, 0, 0], false, {}).yaw, 0, 'the Swan keeps its swimming heading before settling into profile');
  assert.deepEqual(reduced, sampleActorCue(cue, 90, [0, 0, 0], true, {}));
});

test('a resting Wolf holds its authored orientation when the player circles it', () => {
  const cue = CINEMATIC_ACTOR_CUES['crowned.home'].find(c => c.actor === 'wolf');
  const a = sampleActorCue(cue, 0, [-4, 1.7, 0], false, {});
  const b = sampleActorCue(cue, 60, [4, 1.7, 8], false, {});
  assert.deepEqual(a, b);
});
