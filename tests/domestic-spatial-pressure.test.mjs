import assert from 'node:assert/strict';
import test from 'node:test';
import { nestSpatialPressure, nestDomesticLayout, houseSpatialPressure, houseCeilingLayout, houseSurfaceInset, houseClutterInset, housePressureCollider } from '../src/components/three/chapters/domesticSpatialPressure.ts';
import { THORNED_HOUSE_MEMORY_SURFACES, resolveThornedHouseColliderLayout } from '../src/lib/thornedHouseArchitecture.ts';

test('Nest accumulation follows accepted days and releases with safe placement, including restored placement', () => {
  const initial = nestSpatialPressure('nest.two-hands', false, false);
  const arrival = nestSpatialPressure('nest.unsupported-cycle', false, false);
  const compressed = nestSpatialPressure('nest.unsupported-cycle', true, false);
  assert.ok(initial < arrival && arrival < compressed);
  assert.equal(compressed, 1);
  assert.equal(nestSpatialPressure('nest.unsupported-cycle', true, true), .08);
  assert.equal(nestSpatialPressure('nest.protection', true, false), .08);
});

test('domestic accumulation occupies the approach edges while keeping the centre and both rest targets untouched', () => {
  for (const reduced of [false, true]) {
    const initial = nestDomesticLayout(.16, reduced), full = nestDomesticLayout(1, reduced);
    assert.equal(full.timber.length, initial.timber.length, 'core furniture remains on every tier');
    assert.ok(full.linen.length > initial.linen.length, 'responsibility visibly accumulates');
    assert.ok(Math.abs(full.timber[0].position[0]) < Math.abs(initial.timber[0].position[0]), 'the existing bench moves inward');
    for (const pressure of [0, .16, .38, 1, 2, NaN]) {
      const forms = nestDomesticLayout(pressure, reduced);
      for (const item of [...forms.timber, ...forms.linen]) {
        assert.ok([...item.position, ...item.size].every(Number.isFinite));
        const angle = item.rotation?.[1] ?? 0;
        const extentX = Math.abs(Math.cos(angle)) * item.size[0] / 2 + Math.abs(Math.sin(angle)) * item.size[2] / 2;
        assert.ok(Math.abs(item.position[0]) - extentX > 1.5, 'more than 3 m of central approach stays open');
        assert.ok(item.position[2] + Math.hypot(item.size[0], item.size[2]) / 2 < 1.3, 'no added form reaches linen, basket or rest positions');
      }
    }
  }
});

test('House ceilings progressively shorten sightlines above standing height and fully release', () => {
  assert.equal(houseSpatialPressure(.3, false), .5);
  assert.equal(houseSpatialPressure(.6, false), 1);
  assert.equal(houseSpatialPressure(.6, true), 0);
  assert.equal(houseSpatialPressure(NaN, false), 0);
  for (const count of [4, 5, 6, 7]) {
    const open = houseCeilingLayout(0, count), half = houseCeilingLayout(.5, count), full = houseCeilingLayout(1, count);
    assert.equal(full.length, count * 2);
    for (let i = 0; i < full.length; i++) {
      assert.ok(open[i].position[1] > half[i].position[1] && half[i].position[1] > full[i].position[1]);
      assert.ok(full[i].position[1] - full[i].size[1] / 2 >= 2.25 - 1e-12);
      assert.deepEqual(full[i].size, open[i].size, 'the same physical timber is retained');
    }
  }
});

test('House furniture and its collisions move together without moving architecture, exit or released floor clutter', () => {
  const specs = resolveThornedHouseColliderLayout({ stage: 'bedroom', exitStage: 'glimpsed', detail: 3, reducedEffects: false, shellSize: [12.2, 4.75, 11.8], cleared: true, refilled: true, reorganisationReleased: false });
  const snapshot = structuredClone(specs);
  for (const pressure of [0, .5, 1]) {
    const shifted = specs.map(spec => housePressureCollider(spec, pressure));
    assert.deepEqual(shifted.map(spec => spec.id), specs.map(spec => spec.id));
    for (let index = 0; index < THORNED_HOUSE_MEMORY_SURFACES.length; index++) {
      const surface = THORNED_HOUSE_MEMORY_SURFACES[index];
      const x = surface.position[0] + houseSurfaceInset(index, pressure);
      assert.ok(Math.abs(x) - surface.size[0] / 2 >= .9 - 1e-12);
      assert.equal(shifted.find(spec => spec.id === `surface-${index}`).position[0], x);
    }
    for (let index = 0; index < shifted.length; index++) {
      const before = specs[index], after = shifted[index];
      assert.deepEqual(after.args, before.args);
      assert.deepEqual(after.rotation, before.rotation);
      if (before.role === 'memory-clutter') {
        const object = Number(before.id.split('-').at(-1));
        assert.equal(after.position[0], before.position[0] + houseClutterInset(object, pressure));
        if (object >= 14) assert.deepEqual(after, before, 'floor route remains owned by existing release logic');
      } else if (before.role !== 'memory-surface') assert.deepEqual(after, before);
    }
  }
  assert.deepEqual(specs, snapshot, 'the canonical collider layout is not mutated');
  assert.equal(houseClutterInset(0, 1), houseSurfaceInset(0, 1));
  assert.equal(houseClutterInset(6, 1), houseSurfaceInset(1, 1));
  assert.equal(houseClutterInset(9, 1), houseSurfaceInset(2, 1));
  assert.equal(houseClutterInset(13, 1), houseSurfaceInset(3, 1));
});
