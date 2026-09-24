import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import { createKeyGeometry, createLanternHousingGeometry, createLanternGlassGeometry, createMirrorFrameGeometry, createApparitionGeometry } from '../src/components/three/environmentArt/heroGeometry.ts';
import { createWeatheredBoulderGeometry } from '../src/components/three/chapters/chapterArtGeometry.ts';

function intersections(geometry, x, y) {
  const material = new THREE.MeshBasicMaterial({ side: THREE.DoubleSide });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.updateMatrixWorld();
  const hits = new THREE.Raycaster(new THREE.Vector3(x, y, 2), new THREE.Vector3(0, 0, -1)).intersectObject(mesh);
  material.dispose();
  return hits;
}

test('hero fallback construction retains finite indexed geometry and bounded triangle costs', () => {
  for (const [build, budget] of [[createKeyGeometry, 1400], [createLanternHousingGeometry, 3000], [createLanternGlassGeometry, 400], [createMirrorFrameGeometry, 600], [createApparitionGeometry, 150]]) {
    const g = build();
    assert.ok(g.index && g.index.count / 3 <= budget);
    for (const attribute of Object.values(g.attributes)) assert.ok([...attribute.array].every(Number.isFinite));
    assert.ok([...g.index.array].every(i => i >= 0 && i < g.attributes.position.count));
    assert.equal(g.groups.length, 0, 'one draw per material, including merged extrusion inputs');
    g.dispose();
  }
});

test('key bow and mirror opening remain physical holes rather than opaque inset patches', () => {
  const key = createKeyGeometry(), frame = createMirrorFrameGeometry();
  assert.equal(intersections(key, -.07, .01).length, 0, 'open bow');
  assert.ok(intersections(key, .6, .01).length > 0, 'solid key barrel');
  assert.equal(intersections(frame, 0, 0).length, 0, 'unobstructed live reflection');
  assert.ok(intersections(frame, 2.84, 0).length > 0, 'deep solid frame profile');
  key.dispose(); frame.dispose();
});

test('lantern housing leaves the chimney clear and glass stays within its supporting frame', () => {
  const housing = createLanternHousingGeometry(), glass = createLanternGlassGeometry();
  housing.computeBoundingBox(); glass.computeBoundingBox();
  assert.equal(intersections(housing, 0, .5).length, 0, 'no opaque cylinder across the flame');
  assert.ok(intersections(glass, 0, .5).length > 0, 'separate glass enclosure');
  assert.ok(housing.boundingBox.min.y >= 0 && housing.boundingBox.max.y < 1.21);
  assert.ok(glass.boundingBox.min.y > .21 && glass.boundingBox.max.y < .75);
  for (const axis of ['x', 'z']) assert.ok(glass.boundingBox.max[axis] < housing.boundingBox.max[axis]);
  assert.equal(housing.attributes.color.count, housing.attributes.position.count);
  housing.dispose(); glass.dispose();
});

test('weathered outcrops have a flat ground base and remain a small indexed mesh', () => {
  for (let seed = 13; seed <= 28; seed += 3) {
    const geometry = createWeatheredBoulderGeometry(seed);
    assert.equal(geometry.boundingBox.min.y, 0);
    assert.ok(geometry.boundingBox.max.y > .9 && geometry.boundingBox.max.y < 1);
    assert.ok(geometry.index.count / 3 <= 120);
    for (const attribute of Object.values(geometry.attributes)) assert.ok([...attribute.array].every(Number.isFinite));
    geometry.dispose();
  }
});
