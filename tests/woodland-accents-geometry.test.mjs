import assert from 'node:assert/strict';
import test from 'node:test';
import { createSaplingBarkGeometry, createSaplingLeafGeometry, createMossStoneGeometry, createFallenBranchGeometry } from '../src/components/three/environmentArt/woodlandAccentsGeometry.ts';

for (const [name, create, triangleBudget] of [
  ['forked bark', createSaplingBarkGeometry, 900],
  ['low leaf silhouettes', () => createSaplingLeafGeometry(false), 260],
  ['rich leaf silhouettes', () => createSaplingLeafGeometry(true), 480],
  ['moss stone', createMossStoneGeometry, 400],
  ['fallen branch', createFallenBranchGeometry, 250],
]) test(`${name}: finite attributes, valid indices and bounded geometry cost`, () => {
  const geometry = create();
  try {
    const position = geometry.getAttribute('position');
    assert.ok(position.count > 0);
    for (const attribute of Object.values(geometry.attributes)) assert.ok(Array.from(attribute.array).every(Number.isFinite));
    assert.equal(geometry.getAttribute('normal').count, position.count);
    assert.equal(geometry.getAttribute('uv').count, position.count);
    const count = geometry.index?.count ?? position.count;
    assert.equal(count % 3, 0); assert.ok(count / 3 <= triangleBudget, `${count / 3} exceeds ${triangleBudget}`);
    if (geometry.index) assert.ok(Array.from(geometry.index.array).every(index => index < position.count));
    assert.ok(geometry.boundingBox && geometry.boundingSphere);
    assert.ok(Number.isFinite(geometry.boundingSphere.radius) && geometry.boundingSphere.radius > 0);
    assert.ok(geometry.boundingBox.min.y > -.025);
  } finally { geometry.dispose(); }
});
test('moss stones are grounded exactly, without a detached moss shell', () => {
  const geometry = createMossStoneGeometry();
  try {
    assert.ok(Math.abs(geometry.boundingBox.min.y) < 1e-6);
    assert.equal(geometry.getAttribute('color').count, geometry.getAttribute('position').count);
    assert.ok(Array.from(geometry.getAttribute('color').array).every(value => value >= 0 && value <= 1));
  } finally { geometry.dispose(); }
});
test('sapling leaf bounds fit the tested route-clearance envelope', () => {
  for (const rich of [false, true]) {
    const geometry = createSaplingLeafGeometry(rich);
    try {
      const positions = geometry.getAttribute('position');
      for (let i = 0; i < positions.count; i++) assert.ok(Math.hypot(positions.getX(i), positions.getZ(i)) < 1.5);
      assert.ok(geometry.boundingBox.max.y < 4.5);
    } finally { geometry.dispose(); }
  }
});
