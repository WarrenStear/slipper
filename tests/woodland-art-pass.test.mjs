import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync, statSync } from 'node:fs';
import { forestFloorLayout, forestFloorBudget, FOREST_FLOOR_CAPACITY } from '../src/world/ecology/forestFloorLayout.ts';
import { normalizeGeneratedWorldState } from '../src/data/worldStateNormalization.ts';
import { packForestPathSeeds, packForestClearingSeeds, terrainElevationAtPoint } from '../src/world/terrain/terrainSampler.ts';
import { buildMazePathSegments } from '../src/world/terrain/worldPaths.ts';
import { terrainDistanceToPathSq } from '../src/lib/terrainModel.ts';
import { createForestTrunkLibrary } from '../src/world/forest/forestGeometry.ts';
import { createWillowBankStones } from '../src/world/ecology/willowGeometry.ts';
import { TERRAIN_BASE_Y } from '../src/world/terrain/worldConstants.ts';
const entries = normalizeGeneratedWorldState(JSON.parse(readFileSync(new URL('../src/data/worldState.json', import.meta.url)))).entries;
const paths = buildMazePathSegments(entries), seeds = packForestPathSeeds(paths, entries), clearings = packForestClearingSeeds(entries);

test('forest-floor colonies stay grounded and outside the real curved routes through terrain morphs', () => {
  for (const morph of [{}, { explorationDepth: .8, memoryPressure: .6 }]) {
    const ground = (x, z) => TERRAIN_BASE_Y + terrainElevationAtPoint(x, z, entries, paths, morph);
    for (const [x, z] of [[-66,-336],[-5,-368],[-14,-294],[10,-330]]) {
      const cx = Math.floor(x / 4.8), cz = Math.floor(z / 4.8);
      const layout = forestFloorLayout(cx, cz, seeds, clearings, ground, morph);
      assert.deepEqual(layout, forestFloorLayout(cx, cz, seeds, clearings, ground, morph));
      for (const kind of ['ferns','grass','saplings']) {
        assert.ok(layout[kind].length <= FOREST_FLOOR_CAPACITY[kind]);
        for (const plant of layout[kind]) {
          assert.equal(plant.y, ground(plant.x, plant.z));
          assert.ok(Object.values(plant).every(Number.isFinite));
          // Max radii: fern <1.8m, grass <.6m, young crown <2m. Keep 2m tread clear.
          const envelope = kind === 'grass' ? .6 : kind === 'saplings' ? 2 : 1.8;
          for (const path of seeds) {
            if (plant.x < path.minX || plant.x > path.maxX || plant.z < path.minZ || plant.z > path.maxZ) continue;
            assert.ok(Math.sqrt(terrainDistanceToPathSq(plant.x, plant.z, path, morph)) - envelope > 2);
          }
        }
      }
    }
  }
});

test('floor quality prefixes and low tree geometry have explicit cheaper ceilings', () => {
  let previous = 0;
  for (const quality of ['low','medium','high','cinematic']) {
    const budget = forestFloorBudget(quality);
    assert.ok(budget.ferns > previous && budget.ferns <= 150 && budget.grass <= 220 && budget.saplings <= 80); previous = budget.ferns;
  }
  const low = createForestTrunkLibrary(0), high = createForestTrunkLibrary(2);
  try {
    assert.equal(low.index.count / 3, 292); assert.equal(high.index.count / 3, 548);
    assert.equal(low.morphAttributes.position.length, 8); assert.equal(high.morphAttributes.position.length, 8);
    assert.deepEqual(low.userData.archetypeIds, high.userData.archetypeIds);
  } finally { low.dispose(); high.dispose(); }
});

test('willow bank stones remain deterministic, finite and bounded on both tiers', () => {
  const ground = (x, z) => TERRAIN_BASE_Y + terrainElevationAtPoint(x, z, entries, paths, {});
  for (const quality of ['low','high']) {
    const a = createWillowBankStones(quality, ground), b = createWillowBankStones(quality, ground);
    try {
      assert.deepEqual(a.attributes.position.array, b.attributes.position.array);
      assert.ok(a.index.count / 3 <= 44 * 320);
      for (const attribute of Object.values(a.attributes)) assert.ok([...attribute.array].every(Number.isFinite));
      assert.ok(a.boundingBox.max.y < 1);
    } finally { a.dispose(); b.dispose(); }
  }
});

test('generated stone texture stays below its 300KB transfer budget', () => {
  const path = new URL('../public/textures/forest/stone-albedo-v1.webp', import.meta.url);
  assert.ok(statSync(path).size <= 300000);
  assert.equal(readFileSync(path).subarray(8,12).toString(), 'WEBP');
});

test('all outdoor scenes retain twilight on every quality tier while enclosed rooms keep their authored air', async () => {
  const { SCENE_LOOKS, resolveSceneLook, TWILIGHT_SKY } = await import('../src/components/three/artDirection/SceneLookRegistry.ts');
  for (const [id, authored] of Object.entries(SCENE_LOOKS)) {
    const outdoor = !['window', 'domestic'].includes(authored.source);
    for (const quality of ['low','medium','high','cinematic']) for (const reduced of [false,true]) {
      const { atmosphere } = resolveSceneLook(id, quality, reduced);
      for (const field of ['sky','horizon','fog']) assert.equal(atmosphere[field], outdoor ? TWILIGHT_SKY[field] : authored[field]);
      assert.ok(Number.isFinite(atmosphere.density) && atmosphere.density <= .025);
    }
  }
});

test('overlapping forest-floor windows reuse grounded candidates with a bounded cache', () => {
  let samples = 0;
  const ground = (x, z) => { samples++; return TERRAIN_BASE_Y + terrainElevationAtPoint(x, z, entries, paths, {}); };
  const cache = new Map();
  const first = forestFloorLayout(-13, -70, seeds, clearings, ground, {}, cache);
  const uncached = forestFloorLayout(-13, -70, seeds, clearings, ground);
  assert.deepEqual(first, uncached);
  samples = 0;
  const again = forestFloorLayout(-13, -70, seeds, clearings, ground, {}, cache);
  assert.deepEqual(again, first);
  // Grass offsets are sampled independently; the expensive candidate/path work
  // and fern/sapling ground samples are shared across overlapping windows.
  assert.equal(samples, again.grass.length);
  forestFloorLayout(-12, -70, seeds, clearings, ground, {}, cache);
  assert.ok(cache.size < 400, 'adjacent cells add a strip, not a second complete window');
  for (let x = -20; x <= 20; x++) forestFloorLayout(x, -65, seeds, clearings, ground, {}, cache);
  assert.ok(cache.size <= 2048);
});

test('young-tree spray geometry fits the actual route-clearance envelope at maximum scale', async () => {
  const { createSaplingSprayGeometry } = await import('../src/components/three/environmentArt/woodlandAccentsGeometry.ts');
  const g = createSaplingSprayGeometry();
  try {
    assert.equal(g.index.count / 3, 120);
    const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) assert.ok(Math.hypot(p.getX(i), p.getZ(i)) * 1.45 * .85 < 2);
    for (const attribute of Object.values(g.attributes)) assert.ok([...attribute.array].every(Number.isFinite));
  } finally { g.dispose(); }
});
