import assert from 'node:assert/strict';
import test from 'node:test';
import { createSanctuaryShorelineGeometry } from '../src/components/three/chapters/sanctuaryShorelineGeometry.ts';

test('sanctuary banks face the sky and retain an unobstructed bridge and water interaction', () => {
  const geometry = createSanctuaryShorelineGeometry();
  try {
    const positions = geometry.getAttribute('position'), normals = geometry.getAttribute('normal');
    assert.ok(geometry.index.count / 3 <= 1200, 'one bounded secondary landscape batch');
    for (let i = 0; i < positions.count; i++) {
      const x = positions.getX(i), y = positions.getY(i), z = positions.getZ(i);
      assert.ok([x, y, z, normals.getY(i)].every(Number.isFinite));
      assert.ok(normals.getY(i) > .9, 'opaque sediment must be visible from the walking camera');
      assert.ok(y >= -.156 && y <= .042, 'bank remains a shallow cosmetic contact surface');
      assert.ok(Math.abs(x) > 9 || Math.abs(z) > 7.1, 'water touch, swan and central bridge remain clear');
    }
    const repeated = createSanctuaryShorelineGeometry();
    try { assert.deepEqual(positions.array, repeated.getAttribute('position').array); }
    finally { repeated.dispose(); }
  } finally { geometry.dispose(); }
});
