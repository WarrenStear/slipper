import assert from 'node:assert/strict';
import test from 'node:test';
import { JOURNEY_SCENE_IDS } from '../src/lib/storyJourneyState.ts';
import { SCENE_LOOKS, resolveSceneLook, sceneRenderBudget } from '../src/components/three/artDirection/SceneLookRegistry.ts';
import { EMOTIONAL_PROFILES } from '../src/cinematics/emotionalProfiles.ts';
import { HERO_ASSETS, productionHeroUrl } from '../src/components/three/actors/heroAssetRegistry.ts';
import { resolveMaterialMemory } from '../src/components/three/materials/materialLibrary.ts';

test('every canonical scene has one distinct image and finite bounded presentation', () => {
  assert.deepEqual(Object.keys(SCENE_LOOKS), [...JOURNEY_SCENE_IDS]);
  assert.equal(new Set(Object.values(SCENE_LOOKS).map(s => s.composition.heroLandmark)).size, 32);
  for (const id of JOURNEY_SCENE_IDS) {
    const look = resolveSceneLook(id, 'cinematic');
    assert.ok(look.lighting.position.every(Number.isFinite), id);
    assert.ok(look.atmosphere.density >= 0 && look.atmosphere.density <= .025, id);
    assert.ok(look.grade.saturation >= .6 && look.grade.saturation <= 1, id);
    assert.ok(look.composition.focalPoint.every(Number.isFinite), id);
    assert.equal(look.emotional.horizonStability, 1, id);
  }
});

test('only the three authored hero locations enable a secondary world view', () => {
  const eligible = JOURNEY_SCENE_IDS.filter(id => resolveSceneLook(id).reflection.mode !== 'none');
  assert.deepEqual(eligible, ['broken-floor.confession', 'blue-moon.sanctuary', 'blue-moon.intimacy', 'blue-moon.caged-bird', 'sunset.warning-grove', 'sunset.true-mirror', 'sunset.stillness']);
  for (const quality of ['low', 'medium', 'high', 'cinematic']) {
    const reduced = sceneRenderBudget(quality, true);
    assert.equal(reduced.reflectionSize, 0);
    assert.equal(reduced.maxHeroCaptures, 0);
    assert.equal(reduced.finishing, false);
  }
  assert.equal(sceneRenderBudget('medium').reflectionSize, 0);
  assert.equal(sceneRenderBudget('high').reflectionSize, 384);
  assert.equal(sceneRenderBudget('high').reflectionEveryFrames, 2);
  assert.equal(sceneRenderBudget('cinematic').reflectionSize, 768);
  assert.equal(sceneRenderBudget('cinematic').maxHeroCaptures, 1);
  assert.equal(sceneRenderBudget('cinematic').finishingMaxDimension, 1920);
});

test('stillness is a consequence, and leaving it restores authored movement', () => {
  const before = structuredClone(EMOTIONAL_PROFILES);
  for (const [id, state] of [['river.release-surrender', { surrenderComplete: true }], ['sunset.stillness', { mirrorStill: true }]]) {
    assert.ok(resolveSceneLook(id).motion.water > 0);
    const quiet = resolveSceneLook(id, 'high', false, state);
    assert.equal(quiet.stillness, true);
    assert.ok(Object.values(quiet.motion).every(value => value === 0));
    assert.ok(resolveSceneLook('crowned.home', 'high', false, state).motion.water > 0);
  }
  assert.deepEqual(EMOTIONAL_PROFILES, before, 'resolution must not mutate shared profiles');
});

test('material weathering preserves identity and cannot poison GPU values', () => {
  const dry = resolveMaterialMemory('wood', .9), wet = resolveMaterialMemory('wood', .9, { wetness: 1 });
  assert.equal(wet.surface, dry.surface);
  assert.ok(wet.roughness < dry.roughness && wet.brightness < dry.brightness);
  assert.equal(resolveMaterialMemory('paper', .9, { wetness: 1 }).wetness, 0);
  assert.equal(resolveMaterialMemory('charred-wood', .9, { damage: .8, reintegrated: true }).damage, .8);
  for (const value of [NaN, Infinity, -9, 9]) {
    const result = resolveMaterialMemory('stone', value, { wetness: value, wear: value, damage: value });
    assert.ok(Number.isFinite(result.roughness) && result.roughness >= .28 && result.roughness <= 1);
    assert.ok(Number.isFinite(result.brightness));
  }
});

test('production assets require both an explicit review and the hero namespace', () => {
  for (const asset of Object.values(HERO_ASSETS)) assert.equal(productionHeroUrl(asset), null);
  const asset = { status: 'reviewed-production', url: '/art/heroes/wolf.glb', contract: 'metres', review: { provenance: 'Test-only review', licence: 'Fixture', reviewedBy: 'Test', reviewedAt: '2026-09-26T00:00:00Z', revision: '1', maxTriangles: 5000, maxMaterials: 3, maxTextures: 0, maxTextureDimension: 1024, bounds: { min: [-1, 0, -1], max: [1, 2, 1] } } };
  assert.equal(productionHeroUrl(asset), asset.url);
  assert.equal(productionHeroUrl({ ...asset, status: 'authored-fallback' }), null);
  assert.equal(productionHeroUrl({ ...asset, url: '/models/wolf.glb' }), null);
  assert.equal(productionHeroUrl({ ...asset, url: 'https://example.com/wolf.glb' }), null);
  assert.equal(productionHeroUrl({ ...asset, url: null }), null);
});

test('airborne matter and fill follow scene intent with bounded quality gates', () => {
  for (const id of JOURNEY_SCENE_IDS) {
    const look = resolveSceneLook(id, 'cinematic');
    assert.ok(look.particles.count <= 56 && look.particles.count >= 0);
    assert.ok(look.lighting.fillFloor >= 0 && look.lighting.fillFloor <= .32);
  }
  assert.equal(resolveSceneLook('thorned.old-memory-bedroom').particles.count, 0);
  assert.equal(resolveSceneLook('epilogue.constellation').particles.count, 0);
  assert.equal(resolveSceneLook('fire.boundary').particles.kind, 'ash');
  assert.ok(resolveSceneLook('crowned.home').lighting.fillFloor > resolveSceneLook('broken-floor.confession').lighting.fillFloor);
  for (const quality of ['low', 'medium', 'high', 'cinematic']) {
    assert.equal(sceneRenderBudget(quality, true).edgeSmoothing, false);
    assert.equal(sceneRenderBudget(quality, true).shafts, false);
    assert.equal(resolveSceneLook('fire.boundary', quality).lighting.shadowProfile, quality === 'cinematic');
  }
  assert.equal(sceneRenderBudget('high').edgeSmoothing, true);
  assert.equal(sceneRenderBudget('high').finishing, false);
});
