import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { FOREST_LIFECYCLE_SCENES, forestLifecycleProblems, forestResourceCounts, inspectForestMorphRows, resourcePlateauProblems } from '../scripts/forest-lifecycle-contracts.mjs';
import { getJourneyScene, getJourneySceneForEntry } from '../src/data/journeyNarrative.ts';
import { normalizeGeneratedWorldState } from '../src/data/worldStateNormalization.ts';
import { buildMazePathSegments } from '../src/world/terrain/worldPaths.ts';
import { guidedPathSegment } from '../src/world/guidance/routeGeometry.ts';

test('every browser review scene uses an actual canonical keystone and resolvable physical route', () => {
  const entries = normalizeGeneratedWorldState(JSON.parse(readFileSync(new URL('../src/data/worldState.json', import.meta.url), 'utf8'))).entries;
  const segments = buildMazePathSegments(entries), scenes = FOREST_LIFECYCLE_SCENES;
  for (const id of Object.values(scenes)) {
    const scene = getJourneyScene(id);
    assert.ok(scene, `Noncanonical fixture scene: ${id}`); assert.equal(scene.id, id);
    assert.ok(entries.some(entry => entry.id === scene.keystoneEntryId));
    assert.equal(getJourneySceneForEntry(scene.keystoneEntryId).id, id);
  }
  for (const [source, target] of [[scenes.rabbit, scenes.meadow], [scenes.rabbit, scenes.previous],
    [scenes.fire, scenes.river], [scenes.river, scenes.surrender]]) {
    const entry = getJourneyScene(source).keystoneEntryId, targetId = getJourneyScene(target).keystoneEntryId;
    const route = guidedPathSegment(segments, entry, targetId);
    assert.ok(route && [route.sourceEntry.id, route.targetEntry.id].includes(entry));
  }
  const active = getJourneyScene(scenes.rabbit).keystoneEntryId;
  assert.notEqual(guidedPathSegment(segments, active, getJourneyScene(scenes.meadow).keystoneEntryId).key,
    guidedPathSegment(segments, active, getJourneyScene(scenes.previous).keystoneEntryId).key,
    'Alternate target must exercise a real first-segment replacement');
});

function weightImage() {
  const data = new Float32Array(243 * 9);
  for (let row = 0; row < 243; row++) data[row * 9 + 1 + row % 8] = 1;
  return { width: 9, height: 243, data };
}

test('browser morph evidence checks every constructor row, including inactive tail rows', () => {
  const image = weightImage(), valid = inspectForestMorphRows(image, 243);
  assert.equal(valid.valid, true); assert.equal(valid.rows, 243); assert.equal(valid.families[242], 2);
  image.data[242 * 9 + 3] = NaN;
  const invalid = inspectForestMorphRows(image, 243);
  assert.equal(invalid.valid, false); assert.match(invalid.problems.join(' '), /Row 242/);
  assert.equal(inspectForestMorphRows({ ...image, height: 0 }, 243).valid, false);
  assert.equal(inspectForestMorphRows({ ...image, data: new Uint8Array(image.data.length) }, 243).valid, false);
});

test('morph evidence rejects fractional, duplicate and nonzero base weights', () => {
  for (const mutation of [data => { data[0] = 1; }, data => { data[2] = 1; },
    data => { data[1] = .5; }, data => { data[1] = Infinity; }, data => { data[1] = 0; }]) {
    const image = weightImage(); mutation(image.data);
    assert.equal(inspectForestMorphRows(image, 243).valid, false);
  }
});

function sample(mounted = true) {
  const mesh = { capacity: 243, count: 77, matrixVersion: 1, morphTargets: 8,
    visible: true, finite: true, weights: inspectForestMorphRows(weightImage(), 243) };
  return { mounted, sceneId: 'enchanted.rabbit-hole', quality: 'high', glErrors: [], workerErrors: [],
    authorities: mounted ? [{ sceneId: 'enchanted.rabbit-hole', quality: 'high' }] : [],
    workersReady: mounted, terrainReady: mounted, liveWorkers: mounted ? 2 : 0,
    memory: { geometries: mounted ? 10 : 0, textures: mounted ? 12 : 1 },
    programs: mounted ? 18 : 0,
    native: { live: mounted ? 12 : 1, kinds: mounted ? { 'forest-morph-target': 2, 'forest-morph-weights': 2 } : {} },
    route: { key: 'actual-route' }, expected: { understoryCount: 24, farCount: 96 },
    forest: { trunks: mounted ? structuredClone(mesh) : null, crowns: mounted ? structuredClone(mesh) : null,
      pairProblems: [], rawTrunkHash: 'same', uploadedTrunkHash: 'same', rawColorHash: 'color', uploadedColorHash: 'color' },
    forestGeometries: [{ uuid: 'tracked-crown', disposed: !mounted }],
    understory: mounted ? { count: 24, matrixVersion: 1, finite: true, visible: true } : null,
    far: mounted ? { batches: 2, counts: [96, 96], morphTextures: 0, morphTargets: 0 } : null };
}

test('live review evidence rejects stale uploads, detached families and missing actual route ownership', () => {
  assert.deepEqual(forestLifecycleProblems(sample()), []);
  for (const mutation of [
    value => { value.workersReady = false; }, value => { value.terrainReady = false; },
    value => { value.forest.uploadedTrunkHash = 'stale'; }, value => { value.forest.uploadedColorHash = 'stale'; },
    value => { value.forest.pairProblems = ['Instance 12 canopy support transform is detached']; },
    value => { value.forest.crowns.weights.valid = false; }, value => { value.forest.trunks.capacity = 77; },
    value => { value.forest.trunks.visible = false; }, value => { value.understory = null; },
    value => { value.far.batches = 3; }, value => { value.native.kinds['forest-morph-weights'] = 3; },
    value => { value.authorities[0].sceneId = 'river.wash'; }, value => { value.glErrors = ['0x502']; },
  ]) {
    const value = sample(); mutation(value);
    assert.ok(forestLifecycleProblems(value).length, 'Invalid browser evidence must not be accepted');
  }
});

test('unmount evidence requires worker termination and native morph plus observed geometry disposal', () => {
  assert.deepEqual(forestLifecycleProblems(sample(false)), []);
  for (const mutation of [value => { value.liveWorkers = 1; },
    value => { value.native.kinds['forest-morph-target'] = 1; },
    value => { value.native.kinds['forest-morph-weights'] = 1; },
    value => { value.forestGeometries[0].disposed = false; },
    value => { value.understory = {}; }]) {
    const value = sample(false); mutation(value);
    assert.ok(forestLifecycleProblems(value).length);
  }
});

test('same-case resource comparisons catch retained geometry, target and weight texture growth', () => {
  const before = sample(), after = sample();
  assert.deepEqual(resourcePlateauProblems(before, after), []);
  // Total allocation/deletion counts may increase legitimately; live resources must settle.
  after.native.created = 80; after.native.deleted = 68;
  assert.deepEqual(resourcePlateauProblems(before, after), []);
  after.memory.geometries++; after.memory.textures++; after.native.live++;
  after.programs++;
  after.native.kinds['forest-morph-target']++; after.native.kinds['forest-morph-weights']++;
  assert.equal(resourcePlateauProblems(before, after).length, 6);
  assert.deepEqual(forestResourceCounts(before), { geometries: 10, textures: 12, programs: 18, nativeTextures: 12, morphTargets: 2, morphWeights: 2 });
});
