import assert from 'node:assert/strict';
import test from 'node:test';
import { createStorageCaseGeometry } from '../src/components/three/chapters/storageCaseGeometry.ts';

test('closed storage cases and handles remain inside their original unit collider in two material batches', () => {
  const first = createStorageCaseGeometry(), second = createStorageCaseGeometry();
  let triangles = 0;
  try {
    for (const key of ['wood', 'fittings']) {
      const geometry = first[key], positions = geometry.getAttribute('position');
      assert.ok([...positions.array].every(Number.isFinite));
      assert.deepEqual(positions.array, second[key].getAttribute('position').array);
      assert.equal(geometry.groups.length, 0);
      for (const axis of ['x', 'y', 'z']) {
        assert.ok(geometry.boundingBox.min[axis] >= -.500001, `${key} ${axis} lower bound`);
        assert.ok(geometry.boundingBox.max[axis] <= .500001, `${key} ${axis} upper bound`);
      }
      assert.ok(Number.isFinite(geometry.boundingSphere.radius));
      triangles += geometry.index.count / 3;
    }
    assert.ok(triangles <= 700, `bounded shared geometry: ${triangles} triangles`);
    assert.ok(first.wood.getAttribute('storySurfacePosition'), 'wood keeps construction grain mapping');
  } finally {
    Object.values(first).forEach(geometry => geometry.dispose());
    Object.values(second).forEach(geometry => geometry.dispose());
  }
});
