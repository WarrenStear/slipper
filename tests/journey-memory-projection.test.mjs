import assert from 'node:assert/strict';
import test from 'node:test';
import { JOURNEY_ENTRY_WORLD_PLACEMENTS, getJourneyEntryWorldPosition } from '../src/data/journeyWorldLayout.ts';
import { journeyScenes } from '../src/data/journeyNarrative.ts';
import { memoryStarPosition, memoryGroundPosition, reverseJourneyMemoryEntries, reverseMemoryIllumination } from '../src/lib/journeyMemoryProjection.ts';

test('the remembered sky is a fixed projection of all actual world locations, including Echo spurs', () => {
  const first = JOURNEY_ENTRY_WORLD_PLACEMENTS[0];
  const skyOrigin = memoryStarPosition(first.entryId);
  let ratio;
  for (const { entryId, position } of JOURNEY_ENTRY_WORLD_PLACEMENTS) {
    const sky = memoryStarPosition(entryId);
    assert.ok(sky.every(Number.isFinite));
    assert.ok(Math.abs(sky[0]) <= 9.8 && sky[1] >= 5.5 && sky[1] <= 13.71);
    const worldDistance = Math.hypot(position[0] - first.position[0], position[2] - first.position[2]);
    if (worldDistance > 0) {
      const projectedRatio = Math.hypot(sky[0] - skyOrigin[0], sky[1] - skyOrigin[1]) / worldDistance;
      ratio ??= projectedRatio;
      assert.ok(Math.abs(projectedRatio - ratio) < 1e-12, `${entryId} must retain geographic proportions`);
    }
    assert.equal(memoryGroundPosition(entryId)[0], sky[0]);
    assert.equal(sky[2], -20 + getJourneyEntryWorldPosition(entryId)[1] * .025);
  }
  assert.throws(() => memoryStarPosition('invented-memory'), /Unknown journey memory/);
});

test('reverse illumination follows actual most-recent visits without inventing unvisited locations', () => {
  const [a, b, c] = journeyScenes.slice(0, 3).map(scene => scene.keystoneEntryId);
  const finale = journeyScenes.find(scene => scene.id === 'epilogue.constellation').keystoneEntryId;
  assert.deepEqual(reverseJourneyMemoryEntries([a, b, c, b, 'unknown', finale]), [b, c, a]);
  assert.deepEqual(reverseJourneyMemoryEntries([]), []);
  assert.deepEqual(reverseJourneyMemoryEntries([finale]), []);
});

test('reverse light keeps the authored 24-second interval at every saved route length', () => {
  for (const count of [1, 16, 32, 65]) {
    for (let index = 0; index < count; index++) {
      assert.equal(reverseMemoryIllumination(0, index, count), 0);
      assert.equal(reverseMemoryIllumination(24_000, index, count), 1);
      if (index > 0) assert.ok(reverseMemoryIllumination(12_000, index - 1, count) >= reverseMemoryIllumination(12_000, index, count));
    }
    assert.ok(reverseMemoryIllumination(22_000, count - 1, count) < 1 || count === 1);
  }
});
