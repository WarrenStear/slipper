import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import * as THREE from 'three';
import { createFlameGeometry, createSectionGeometry, createWaxCandleGeometry, mergeArtGeometries } from '../src/components/three/environmentArt/authoredGeometry.ts';
import { createBotanicalGeometries } from '../src/components/three/environmentArt/botanicalGeometry.ts';
import { createChairGeometry, createSeedGeometry } from '../src/components/three/environmentArt/heroGeometry.ts';
import { createPhantomGeometries, createSwanGeometries, createWolfGeometries } from '../src/components/three/environmentArt/npcGeometry.ts';

const baseline = JSON.parse(readFileSync(new URL('./fixtures/authored-art-baseline.json', import.meta.url), 'utf8'));
const triangles = geometry => (geometry.index?.count ?? geometry.getAttribute('position').count) / 3;
const retainedBytes = geometry => Object.values(geometry.attributes).reduce((sum, attribute) => sum + attribute.array.byteLength, 0) + (geometry.index?.array.byteLength ?? 0);

function expandedAttributes(geometry) {
  const count = geometry.index?.count ?? geometry.getAttribute('position').count;
  return Object.fromEntries(Object.entries(geometry.attributes).map(([name, attribute]) => {
    const values = new attribute.array.constructor(count * attribute.itemSize);
    for (let index = 0; index < count; index++) {
      const vertex = geometry.index ? geometry.index.getX(index) : index;
      for (let component = 0; component < attribute.itemSize; component++) values[index * attribute.itemSize + component] = attribute.array[vertex * attribute.itemSize + component];
    }
    return [name, values];
  }));
}

test('mixed geometry merges retain indices, exact attributes and UV/normal seams, and release their inputs', () => {
  const indexed = new THREE.BoxGeometry(.4, .2, .8);
  const sourceIndex = [...indexed.index.array];
  const expanded = new THREE.BoxGeometry(.3, .5, .7).toNonIndexed();
  expanded.translate(1, 0, 0);
  // These vertices share a position but must not be welded across the seam.
  expanded.getAttribute('uv').setX(3, Math.fround(.12345678));
  expanded.getAttribute('normal').setY(3, Math.fround(.00000001));
  for (const geometry of [indexed, expanded]) {
    const colors = new Uint8Array(geometry.getAttribute('position').count * 3).fill(128);
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3, true));
  }
  const before = [indexed, expanded].map(expandedAttributes);
  let disposed = 0;
  for (const geometry of [indexed, expanded]) geometry.addEventListener('dispose', () => disposed++);
  const merged = mergeArtGeometries([indexed, expanded]);
  assert.ok(merged.index, 'mixed indexed and extruded inputs remain indexed');
  assert.deepEqual([...indexed.index.array], sourceIndex, 'existing indices are retained');
  assert.equal(disposed, 2, 'each temporary input is disposed once');
  assert.equal(merged.getAttribute('color').normalized, true);
  for (const [name, actual] of Object.entries(expandedAttributes(merged))) {
    const expected = new actual.constructor(before[0][name].length + before[1][name].length);
    expected.set(before[0][name]); expected.set(before[1][name], before[0][name].length);
    assert.deepEqual(actual, expected, `${name} is bit-for-bit preserved after expansion`);
  }
  merged.dispose();
});

const builders = {
  chair: () => ({ shape: createChairGeometry() }),
  wax: () => ({ shape: createWaxCandleGeometry() }),
  flame: () => ({ shape: createFlameGeometry() }),
  seed: () => ({ shape: createSeedGeometry() }),
};
for (const detail of ['base', 'relief']) {
  builders[`wolf-${detail}`] = () => createWolfGeometries(false, detail);
  builders[`resting-wolf-${detail}`] = () => createWolfGeometries(true, detail);
  builders[`swan-${detail}`] = () => createSwanGeometries(detail);
  builders[`phantom-${detail}`] = () => createPhantomGeometries(detail);
}
for (const kind of ['rose', 'lily', 'reeds']) builders[`${kind}-relief`] = () => createBotanicalGeometries(kind, 5, 'relief');

test('indexed forms expand to the approved art positions, normals and UVs in their original triangle order', () => {
  for (const [name, build] of Object.entries(builders)) {
    const shapes = build(), reference = baseline.cases[name];
    assert.equal(Object.values(shapes).reduce((sum, geometry) => sum + triangles(geometry), 0), reference.triangles, name);
    for (const [part, geometry] of Object.entries(shapes)) {
      for (const [attribute, values] of Object.entries(expandedAttributes(geometry))) {
        assert.ok([...values].every(Number.isFinite), `${name}/${part}/${attribute}`);
        const hash = createHash('sha256').update(new Uint8Array(values.buffer)).digest('hex');
        assert.equal(hash, reference.attributes[part][attribute], `${name}/${part}/${attribute} matches ${baseline.baseline}`);
      }
      geometry.dispose();
    }
  }
});

test('chair indexing reduces retained storage without reducing the authored triangle silhouette', () => {
  const geometry = createChairGeometry();
  assert.equal(triangles(geometry), 1432);
  assert.ok(geometry.index && geometry.getAttribute('position').count < 1000, 'baseline held 4,296 vertex records');
  assert.ok(retainedBytes(geometry) < 40000, 'baseline held 137,472 geometry bytes');
  geometry.dispose();
});

test('revolved poles have one triangle per fan sector and no collapsed referenced faces', () => {
  const sides = 12;
  const geometry = createSectionGeometry([[-1, 0, 0, 0], [0, .4, .3, 0], [1, 0, 0, 0]], sides);
  assert.equal(triangles(geometry), sides * 2);
  const p = geometry.getAttribute('position'), normal = geometry.getAttribute('normal');
  const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3(), ab = new THREE.Vector3(), ac = new THREE.Vector3();
  for (let index = 0; index < geometry.index.count; index += 3) {
    a.fromBufferAttribute(p, geometry.index.getX(index)); b.fromBufferAttribute(p, geometry.index.getX(index + 1)); c.fromBufferAttribute(p, geometry.index.getX(index + 2));
    assert.ok(ab.subVectors(b, a).cross(ac.subVectors(c, a)).lengthSq() > 0, 'every remaining face has area');
    for (let offset = 0; offset < 3; offset++) assert.ok(Math.abs(a.fromBufferAttribute(normal, geometry.index.getX(index + offset)).length() - 1) < 1e-6, 'every referenced normal is finite and unit length');
  }
  geometry.dispose();
  // A very thin, nonzero ring is not a pole and must keep both quad triangles.
  const thin = createSectionGeometry([[-1, 1e-9, 1e-9, 0], [0, .4, .3, 0], [1, 1e-9, 1e-9, 0]], sides);
  assert.equal(triangles(thin), sides * 4);
  thin.dispose();
});

function connectedParts(geometry) {
  const count = geometry.getAttribute('position').count;
  const parent = Array.from({ length: count }, (_, index) => index);
  const root = index => parent[index] === index ? index : (parent[index] = root(parent[index]));
  for (let index = 0; index < geometry.index.count; index += 3) {
    const a = root(geometry.index.getX(index));
    parent[root(geometry.index.getX(index + 1))] = a;
    parent[root(geometry.index.getX(index + 2))] = a;
  }
  return new Set(parent.map((_, index) => root(index))).size;
}

test('base plants keep every petal, leaf and stem with fewer samples and baseline-scale bounds', () => {
  const parts = { rose: { stems: 1, leaves: 3, petals: 9 }, lily: { stems: 0, leaves: 3, petals: 9 }, reeds: { stems: 5, leaves: 5, petals: 0 } };
  const budgets = { rose: 356, lily: 288, reeds: 460 };
  for (const kind of ['rose', 'lily', 'reeds']) for (const seed of [0, 5, 43, 51]) {
    const shapes = createBotanicalGeometries(kind, seed, 'base');
    assert.equal(Object.values(shapes).reduce((sum, geometry) => sum + triangles(geometry), 0), budgets[kind]);
    for (const [part, geometry] of Object.entries(shapes)) {
      assert.equal(connectedParts(geometry), parts[kind][part], `${kind} preserves all ${part}`);
      for (const attribute of Object.values(geometry.attributes)) assert.ok([...attribute.array].every(Number.isFinite));
      assert.ok([...geometry.index.array].every(index => index >= 0 && index < geometry.getAttribute('position').count));
      if (seed === 5 && parts[kind][part]) {
        const actual = [geometry.boundingBox.min.toArray(), geometry.boundingBox.max.toArray()];
        const expected = baseline.botanicalBaseBounds[kind][part];
        for (let side = 0; side < 2; side++) for (let axis = 0; axis < 3; axis++) assert.ok(Math.abs(actual[side][axis] - expected[side][axis]) < .003, `${kind}/${part} remains within 3mm of baseline bounds`);
      }
      geometry.dispose();
    }
  }
});
