import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { ENVIRONMENT_THEMES, environmentThemeForScene, BIOME_ECOLOGY_CAPACITY, biomeEcologyBudget } from '../src/components/three/environment/environmentThemes.ts';
import { createLandscapeEcology, ecologyRadius } from '../src/components/three/environment/landscapeEcology.ts';
import { LANDSCAPE_SCENES, landscapeForScene, createLandscapeTerrain, createLandscapeObjects, heightOnLandscape, landscapeRiverCentre, landscapeRiverWidth } from '../src/components/three/environment/landscapeGeography.ts';
import { AUTHORED_SHAFTS, sceneSkyReturn } from '../src/components/three/artDirection/sceneLightAccents.ts';

const quality = ['low', 'medium', 'high', 'cinematic'];
const source = file => readFileSync(new URL(`../src/components/three/${file}`, import.meta.url), 'utf8');
const fixtures = [...new Set(Object.keys(LANDSCAPE_SCENES).map(landscapeForScene))].map(spec => {
  const terrain = createLandscapeTerrain(spec), original = createLandscapeObjects(spec, terrain);
  return { spec, terrain, original, ecology: createLandscapeEcology(spec, terrain, original.trees) };
});

test('all existing outdoor scenes resolve to the matching immutable biome', () => {
  for (const [id, family] of Object.entries(LANDSCAPE_SCENES)) assert.equal(environmentThemeForScene(id), ENVIRONMENT_THEMES[family]);
  for (const id of ['blue-moon.sanctuary', 'blue-moon.intimacy', 'blue-moon.caged-bird']) assert.equal(environmentThemeForScene(id), ENVIRONMENT_THEMES.sanctuary);
  assert.ok(Object.isFrozen(ENVIRONMENT_THEMES));
  for (const theme of Object.values(ENVIRONMENT_THEMES)) {
    assert.ok(Object.isFrozen(theme) && Object.isFrozen(theme.water));
    for (const key of ['soil', 'moss', 'rock', 'bark', 'leaf', 'grass', 'flower', 'evergreen']) assert.match(theme[key], /^#[0-9a-f]{6}$/);
    assert.match(theme.water.color, /^#[0-9a-f]{6}$/);
    for (const key of ['flow', 'roughness', 'depth']) assert.ok(Number.isFinite(theme.water[key]) && theme.water[key] >= 0 && theme.water[key] <= 1);
  }
});
test('unknown, prototype and enclosed scene IDs never acquire outdoor ecology', () => {
  for (const id of ['constructor', '__proto__', 'toString', 'enchanted.unknown', '', 'broken-floor.confession', 'thorned.old-memory-bedroom', 'sunset.stillness', 'epilogue.constellation']) assert.equal(environmentThemeForScene(id), null);
});
test('sanctuary retains its original water appearance and no evergreen ecology', () => {
  assert.deepEqual(ENVIRONMENT_THEMES.sanctuary.water, { color: '#0b1720', flow: 0, roughness: .24, depth: .9 });
  assert.equal(ENVIRONMENT_THEMES.sanctuary.evergreenScale, 0);
  assert.equal(landscapeForScene('blue-moon.sanctuary'), null);
});
test('low, reduced effects and unknown quality have zero extra ecology', () => {
  const empty = { evergreens: 0, grass: 0, flowers: 0 };
  for (const q of [...quality, 'unknown']) assert.deepEqual(biomeEcologyBudget(q, true), empty);
  assert.deepEqual(biomeEcologyBudget('low'), empty); assert.deepEqual(biomeEcologyBudget('unknown'), empty);
});
test('all quality counts are monotonic integers bounded by fixed capacities', () => {
  let previous = biomeEcologyBudget('low');
  for (const q of quality) {
    const budget = biomeEcologyBudget(q);
    for (const kind of Object.keys(budget)) assert.ok(Number.isInteger(budget[kind]) && budget[kind] >= previous[kind] && budget[kind] <= BIOME_ECOLOGY_CAPACITY[kind]);
    previous = budget;
  }
  assert.deepEqual(biomeEcologyBudget('cinematic'), BIOME_ECOLOGY_CAPACITY);
});

for (const { spec, terrain, original, ecology } of fixtures) {
  test(`${spec.family}: ecology is deterministic and does not modify terrain or original props`, () => {
    const before = structuredClone({ terrain, original });
    assert.deepEqual(createLandscapeEcology(spec, terrain, original.trees), ecology);
    assert.deepEqual({ terrain, original }, before);
    assert.equal(ecology.evergreens.length, 10); assert.equal(ecology.grass.length, 72);
    assert.equal(ecology.flowers.length, ENVIRONMENT_THEMES[spec.family].meadowFlowers ? 24 : 0);
  });
  test(`${spec.family}: finite positive transforms stay grounded on the existing triangles`, () => {
    for (const items of Object.values(ecology)) for (const item of items) {
      assert.ok([...item.position, ...item.rotation, ...item.scale].every(Number.isFinite));
      assert.ok(item.scale.every(n => n > 0));
      const [x, y, z] = item.position, height = heightOnLandscape(terrain, x, z);
      assert.notEqual(height, null); assert.ok(Math.abs(y + .055 - height) < 1e-10);
    }
  });
  test(`${spec.family}: whole decoration envelopes exclude the clearing, terrain edges and river`, () => {
    for (const [kind, items] of Object.entries(ecology)) for (const item of items) {
      const [x, , z] = item.position, radius = ecologyRadius(kind, item.scale[0]);
      assert.ok(Math.abs(x) - radius >= spec.inner + .2);
      assert.ok(Math.abs(x) + radius <= spec.outer - .2);
      assert.ok(Math.abs(z) + radius <= spec.length - .4);
      if (Math.sign(x) === spec.riverSide) assert.ok(Math.abs(Math.abs(x) - landscapeRiverCentre(spec, z)) >= landscapeRiverWidth(spec, z) + radius + .55);
    }
    ecology.evergreens.forEach((tree, index) => {
      assert.equal(tree.rotation[0], 0); assert.equal(tree.rotation[2], 0);
      for (const other of [...original.trees, ...ecology.evergreens.slice(0, index)]) {
        const distance = Math.hypot(tree.position[0] - other.position[0], tree.position[2] - other.position[2]);
        assert.ok(distance >= ecologyRadius('evergreens', tree.scale[0]) + other.scale[0] * 1.5 + .3);
      }
    });
  });
  test(`${spec.family}: each quality draws stable layout prefixes on both sides`, () => {
    for (const q of quality) {
      const budget = biomeEcologyBudget(q);
      for (const kind of Object.keys(ecology)) {
        const active = ecology[kind].slice(0, budget[kind]);
        assert.deepEqual(active, createLandscapeEcology(spec, terrain, original.trees)[kind].slice(0, budget[kind]));
        if (active.length > 3) assert.equal(new Set(active.map(p => Math.sign(p.position[0]))).size, 2);
      }
    }
  });
}

test('additional lighting is weak, scene-local and does not leak into quiet chapters', () => {
  for (const id of ['fork.weighing', 'fork.four-verbs', 'climbs.arrival', 'climb.mind', 'climb.heart']) {
    const light = sceneSkyReturn(id); assert.ok(light);
    assert.ok(light.position.every(Number.isFinite)); assert.ok(light.intensity > 0 && light.intensity <= .22);
  }
  for (const id of ['sunset.stillness', 'river.release-surrender', 'climb.womb', 'epilogue.constellation', 'thorned.old-memory-bedroom', 'fire.boundary']) {
    assert.equal(sceneSkyReturn(id), null); assert.equal(AUTHORED_SHAFTS[id], undefined);
  }
  for (const shafts of Object.values(AUTHORED_SHAFTS)) {
    assert.ok(shafts.length <= 3);
    for (const shaft of shafts) {
      assert.ok([...shaft.from, ...shaft.to, shaft.radius, shaft.opacity].every(Number.isFinite));
      assert.ok(shaft.from[1] > shaft.to[1] && shaft.opacity <= .035 && shaft.radius <= 3.4);
    }
  }
});
test('ecology has bounded extra draws, no per-frame rebuild or new state authority', () => {
  const code = source('environment/OutdoorLandscape.tsx');
  assert.match(code, /extraDraws = ecology.evergreens > 0 \? \(theme.meadowFlowers \? 4 : 3\) : 0/);
  assert.match(code, /ecology.evergreens > 0 \? <LandscapeEcologyLayer/);
  assert.match(code, /createLandscapeEcology\(spec, data, trees\), \[spec, data, trees\]/);
  assert.match(code, /Object.values\(shapes\).forEach\(geometry => geometry.dispose\(\)\)/);
  assert.doesNotMatch(code, /useFrame|Date\.now|Math\.random|new WebGLRenderTarget|castShadow|dispatchStoryEvent/);
  for (const q of quality) for (const reduced of [false, true]) for (const theme of Object.values(ENVIRONMENT_THEMES)) {
    const budget = biomeEcologyBudget(q, reduced), extra = budget.evergreens > 0 ? (theme.meadowFlowers ? 4 : 3) : 0;
    assert.ok(extra >= 0 && extra <= 4);
    if (q === 'low' || reduced) assert.equal(extra, 0);
  }
});
