import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { createLandscapeHeightIndex } from '../src/components/three/environment/landscapeHeightIndex.ts';
import { writeWaterSkyTarget } from '../src/components/three/environment/waterSkyResponse.ts';
import { worldTransitionAlpha, blendWorldValue } from '../src/components/three/artDirection/worldVisualContinuity.ts';
import { LANDSCAPE_SCENES, LANDSCAPE_CAPACITY, landscapeForScene, createLandscapeTerrain, createLandscapeObjects, heightOnLandscape } from '../src/components/three/environment/landscapeGeography.ts';

const fixtures = [...new Set(Object.keys(LANDSCAPE_SCENES).map(landscapeForScene))].map(spec => {
  const terrain = createLandscapeTerrain(spec);
  return { spec, terrain, index: createLandscapeHeightIndex(terrain) };
});
const read = name => readFileSync(new URL(`../src/components/three/environment/${name}`, import.meta.url), 'utf8');
const unit = n => { const x = Math.sin(n * 78.233 + 1.7) * 43758.5453; return x - Math.floor(x); };
const same = (actual, expected) => {
  if (expected === null) assert.equal(actual, null);
  else { assert.notEqual(actual, null); assert.ok(Math.abs(actual - expected) < 1e-10, `${actual} != ${expected}`); }
};
for (const { spec, terrain, index } of fixtures) {
  test(`${spec.family}: indexed heights equal full scans over 600 deterministic interior/exterior queries`, () => {
    for (let i = 0; i < 600; i++) {
      const x = (unit(i + spec.seed) * 2 - 1) * (spec.outer + 2);
      const z = (unit(i + 4001) * 2 - 1) * (spec.length + 2);
      same(index.sampleHeight(x, z), heightOnLandscape(terrain, x, z));
    }
  });
  test(`${spec.family}: every terrain vertex, including river and patch seams, retains its exact height`, () => {
    for (let i = 0; i < terrain.positions.length; i += 3) {
      const [x, y, z] = terrain.positions.slice(i, i + 3);
      same(index.sampleHeight(x, z), y);
      for (const offset of [-5e-8, 5e-8]) same(index.sampleHeight(x + offset, z), heightOnLandscape(terrain, x + offset, z));
    }
  });
  test(`${spec.family}: bounded candidate lists replace whole-mesh queries`, () => {
    assert.equal(index.stats.triangles, 3840);
    assert.ok(index.stats.cells <= 2560);
    assert.ok(index.stats.references < 25000);
    assert.ok(index.stats.maxCandidates <= 24);
  });
  test(`${spec.family}: index construction and queries do not mutate render/collision data`, () => {
    const before = structuredClone(terrain);
    const again = createLandscapeHeightIndex(terrain);
    again.sampleHeight(spec.inner + 4, 0);
    assert.deepEqual(terrain, before);
  });
  test(`${spec.family}: every scenery batch keeps grounded deterministic placements at its existing cap`, () => {
    const objects = createLandscapeObjects(spec, terrain);
    assert.deepEqual(objects, createLandscapeObjects(spec, terrain));
    for (const [kind, items] of Object.entries(objects)) {
      assert.equal(items.length, LANDSCAPE_CAPACITY[kind]);
      for (const item of items) same(item.position[1] + .035, heightOnLandscape(terrain, item.position[0], item.position[2]));
    }
  });
}
test('malformed coordinates and empty or degenerate surfaces fail without poisoning queries', () => {
  for (const { index } of fixtures) for (const n of [NaN, Infinity, -Infinity]) {
    assert.equal(index.sampleHeight(n, 0), null); assert.equal(index.sampleHeight(0, n), null);
  }
  for (const data of [
    { positions: [], indices: [] },
    { positions: [0, 0, 0], indices: [0, 0, 0] },
    { positions: [NaN, 0, 0, 1, 0, 0, 0, 0, 1], indices: [0, 1, 2] },
    { positions: [0, 0, 0], indices: [-1, 1.5, 999] },
  ]) assert.equal(createLandscapeHeightIndex(data).sampleHeight(0, 0), null);
});
test('overlapping faces retain original first-hit order; invalid faces do not hide valid ones', () => {
  const data = { positions: [0, 2, 0, 1, 2, 0, 0, 2, 1, 0, 7, 0, 1, 7, 0, 0, 7, 1], indices: [0, 0, 0, 0, 1, 2, 3, 4, 5] };
  const index = createLandscapeHeightIndex(data);
  assert.equal(index.sampleHeight(.2, .2), 2); assert.equal(index.stats.triangles, 2);
});
test('typed-array render buffers and plain arrays produce matching samples', () => {
  const data = { positions: [0, 2, 0, 1, 3, 0, 0, 4, 1], indices: [0, 1, 2] };
  const typed = { positions: new Float32Array(data.positions), indices: new Uint32Array(data.indices) };
  same(createLandscapeHeightIndex(data).sampleHeight(.2, .3), createLandscapeHeightIndex(typed).sampleHeight(.2, .3));
});
test('indices belong to individual surfaces and cannot leak a previous scene height', () => {
  const a = createLandscapeHeightIndex({ positions: [0, 2, 0, 1, 2, 0, 0, 2, 1], indices: [0, 1, 2] });
  const b = createLandscapeHeightIndex({ positions: [0, 8, 0, 1, 8, 0, 0, 8, 1], indices: [0, 1, 2] });
  assert.equal(a.sampleHeight(.2, .2), 2); assert.equal(b.sampleHeight(.2, .2), 8);
});
test('water reflection targets follow linear scene colours without changing their inputs', () => {
  const h = Object.freeze({ r: .2, g: .3, b: .4 }), k = Object.freeze({ r: .8, g: .7, b: .6 });
  const out = { r: 0, g: 0, b: 0 }; writeWaterSkyTarget(out, h, k);
  for (const channel of ['r', 'g', 'b']) same(out[channel], h[channel] * .92 + k[channel] * .08);
});
test('night reflections remain dimmer than daylight; warmth is an explicit bounded tint', () => {
  const night = { r: 0, g: 0, b: 0 }, day = { ...night }, warm = { ...night };
  const key = { r: .8, g: .85, b: .9 };
  writeWaterSkyTarget(night, { r: .01, g: .025, b: .045 }, key);
  writeWaterSkyTarget(day, { r: .45, g: .5, b: .55 }, key);
  writeWaterSkyTarget(warm, { r: .45, g: .5, b: .55 }, key, true);
  for (const c of ['r', 'g', 'b']) { assert.ok(night[c] < day[c]); assert.ok(warm[c] >= 0 && warm[c] <= 1); }
  assert.ok(warm.r > day.r && warm.b < day.b);
});
test('malformed reflection channels never produce non-finite GPU colour values', () => {
  const out = { r: 0, g: 0, b: 0 };
  for (const value of [NaN, Infinity, -Infinity, -1, 2]) {
    writeWaterSkyTarget(out, { r: value, g: value, b: value }, { r: value, g: value, b: value }, true);
    assert.ok(Object.values(out).every(c => Number.isFinite(c) && c >= 0 && c <= 1));
  }
});
test('water uses the same frame-rate-aware transition policy and reduced-motion snap', () => {
  const advance = fps => {
    let value = .04;
    for (let frame = 0; frame < fps; frame++) value = blendWorldValue(value, .6, worldTransitionAlpha(1 / fps));
    return value;
  };
  same(advance(30), advance(60)); same(advance(60), advance(120));
  assert.equal(worldTransitionAlpha(1 / 60, true), 1);
});
test('object generation constructs one local index and no longer calls the full scan per object', () => {
  const body = read('landscapeGeography.ts').split('export function createLandscapeObjects')[1];
  assert.match(body, /createLandscapeHeightIndex\(terrain\)/); assert.match(body, /y = sampleHeight\(x, z\)/);
  assert.doesNotMatch(body, /heightOnLandscape\(/);
});
test('quality-only count updates neither upload transforms nor recalculate full bounds', () => {
  const body = read('OutdoorLandscape.tsx').split('const LandscapeInstances = memo')[1].split('function LandscapeBasin')[0];
  const effects = [...body.matchAll(/useLayoutEffect\(\(\) => \{([\s\S]*?)\}, \[([^\]]*)\]\)/g)];
  assert.equal(effects.length, 3);
  assert.match(effects[0][1], /setMatrixAt/); assert.match(effects[0][1], /setColorAt/);
  assert.equal(effects[0][2], 'placements, capacity');
  assert.doesNotMatch(effects[1][1], /setMatrixAt|setColorAt|needsUpdate/);
  assert.match(effects[1][1], /mesh.count = available; mesh.computeBoundingBox\(\); mesh.computeBoundingSphere\(\)/);
  assert.equal(effects[1][2], 'geometry, placements, capacity, finish');
  assert.match(effects[2][1], /mesh.count = Math.min\(available, count\)/);
  assert.doesNotMatch(effects[2][1], /setMatrixAt|setColorAt|computeBounding|needsUpdate/);
  assert.match(body, /Number.isFinite\(requestedCount\)/); assert.match(body, /mesh.visible = mesh.count > 0/);
});
test('water keeps stable uniforms, first-frame initialization and its standalone fallback', () => {
  const code = read('SanctuaryWater.tsx');
  assert.match(code, /writeWaterSkyTarget\(sky.target, sky.horizon, sky.key, warm\)/);
  assert.match(code, /worldTransitionAlpha\(delta, reducedMotion \|\| presentation.reducedMotion \|\| !skyReady.current\)/);
  assert.match(code, /appearance.waterSky.value.lerp\(sky.target, alpha\)/);
  assert.match(code, /if \(!hasSceneLook\) appearance.waterSky.value.set/);
  const frame = code.split('useFrame((_, delta) => {')[1].split('return <mesh')[0];
  assert.doesNotMatch(frame, /new THREE|requestAnimationFrame|setState/);
  assert.match(frame, /presentation.time.water \* 3/);
  assert.equal((code.match(/useFrame\(/g) || []).length, 1);
});
test('landscape keeps terrain/collision topology, resource disposal and rendering budgets', () => {
  const code = read('OutdoorLandscape.tsx');
  assert.match(code, /colliderArgs: \[vertices, indices\]/);
  assert.match(code, /args=\{land.colliderArgs\}/); assert.match(code, /createLandscapeTerrain\(spec\), \[spec\]/);
  assert.match(code, /drawCallBudget: river \? 7 : 6/); assert.match(code, /expandByScalar\(\.4\)/);
  assert.match(code, /args=\{\[undefined, undefined, capacity\]\}/);
  assert.doesNotMatch(code, /useFrame|pointLight|spotLight|new WebGLRenderTarget|dispatchStoryEvent/);
  for (const name of ['bark', 'leaves', 'stone', 'timber', 'reeds']) assert.match(code, new RegExp(`${name}\\.dispose\\(\\)`));
});
