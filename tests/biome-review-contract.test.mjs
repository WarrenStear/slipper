import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, readdirSync, cpSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';
import {
  BIOME_REVIEW_CASES, BIOME_REVIEW_VIEWPORTS, expectedBiomeCounts,
  assertBiomeSnapshot, assertQualityReuse, assertFrozenMotion, assertCompleteBiomeReview,
} from '../scripts/biome-review-contract.mjs';

const config = (patch = {}) => ({ sceneId: 'enchanted.rabbit-hole', quality: 'high', reducedEffects: false, reducedMotion: false, ...patch });
function sample(settings = config()) {
  const expected = expectedBiomeCounts(settings);
  const batch = (name, count) => ({ name, count, visible: true, geometry: `${name}-geometry`, matrixVersion: 1, matrixHash: 'abc12', finite: true, bounded: true });
  const batches = [], drawn = [];
  if (expected.scene.family !== 'sanctuary') {
    batches.push(batch('hillside-tree-trunks', expected.trees), batch('hillside-tree-canopies', expected.trees));
    drawn.push('rolling-hills-and-carved-riverbanks');
  }
  if (expected.evergreens) batches.push(batch('wind-shaped-evergreen-trunks', expected.evergreens), batch('layered-evergreen-boughs', expected.evergreens));
  if (expected.grass) batches.push(batch('clustered-hillside-tussocks', expected.grass));
  if (expected.flowers) batches.push(batch('meadow-wildflower-drifts', expected.flowers));
  drawn.push(...batches.map(item => item.name));
  const water = [];
  if (expected.scene.river || expected.scene.family === 'sanctuary') {
    water.push({ banks: Number(expected.scene.river), time: settings.reducedEffects || settings.reducedMotion ? 0 : .25 });
    drawn.push(expected.scene.river ? 'directional-river-water' : 'still-reflective-water');
  }
  return { config: settings, revision: 1, webgl2: true, contextLost: false, frames: 30,
    calls: 15, triangles: 18000, pixelColors: 15, shaderErrors: [], glError: 0, batches, drawn, water,
    terrain: expected.scene.family === 'sanctuary' ? null : 'terrain-1',
    time: { vegetation: .4, cloth: .2, water: .3, particles: .1, flame: .2 },
  };
}

test('the acceptance matrix covers six landscapes and the unchanged sanctuary material', () => {
  assert.equal(BIOME_REVIEW_CASES.length, 7); assert.equal(new Set(BIOME_REVIEW_CASES.map(s => s.family)).size, 7);
  assert.deepEqual(BIOME_REVIEW_VIEWPORTS.map(v => v.width), [1440, 390]);
  assert.ok(Object.isFrozen(BIOME_REVIEW_CASES) && BIOME_REVIEW_CASES.every(Object.isFrozen));
});
test('all quality/accessibility configurations accept structurally valid rendered evidence', () => {
  for (const scene of BIOME_REVIEW_CASES) for (const quality of ['low','medium','high','cinematic']) {
    for (const reducedEffects of [false,true]) for (const reducedMotion of [false,true]) {
      const settings = config({ sceneId: scene.sceneId, quality, reducedEffects, reducedMotion });
      assert.doesNotThrow(() => assertBiomeSnapshot(sample(settings), settings));
    }
  }
});
test('unknown configurations are rejected rather than mapped to a passing fallback', () => {
  for (const settings of [null, {}, config({ sceneId: 'constructor' }), config({ sceneId: '__proto__' }), config({ quality: 'ultra' }), config({ reducedEffects: 'false' })]) {
    assert.throws(() => expectedBiomeCounts(settings), /Unknown or malformed/);
  }
});
for (const [name, mutate, error] of [
  ['no WebGL2', s => s.webgl2 = false, /WebGL2/],
  ['lost context', s => s.contextLost = true, /context/],
  ['too few frames', s => s.frames = 2, /frames/],
  ['stale quality', s => s.config.quality = 'low', /Stale quality/],
  ['no draw calls', s => s.calls = 0, /render calls/],
  ['excessive calls', s => s.calls = 41, /render calls/],
  ['empty triangles', s => s.triangles = 0, /geometry render/],
  ['nonfinite triangle count', s => s.triangles = NaN, /geometry render/],
  ['flat canvas', s => s.pixelColors = 1, /image variation/],
  ['shader compilation failure', s => s.shaderErrors.push('link failed'), /compiler/],
  ['missing shader check', s => delete s.shaderErrors, /compiler/],
  ['GL error', s => s.glError = 1282, /WebGL error/],
  ['wrong instance count', s => s.batches[0].count = 999, /active count/],
  ['invalid transforms', s => s.batches[0].finite = false, /transforms/],
  ['invalid bounds', s => s.batches[0].bounded = false, /bounds/],
  ['missing geometry identity', s => delete s.batches[0].geometry, /identity/],
  ['missing upload version', s => delete s.batches[0].matrixVersion, /upload/],
  ['missing matrix hash', s => delete s.batches[0].matrixHash, /matrix hash/],
  ['allocated but not drawn', s => s.drawn = [], /actually rendered|not drawn/],
  ['missing terrain', s => s.terrain = null, /terrain/],
  ['missing water', s => s.water = [], /water surface/],
  ['missing water uniforms', s => delete s.water[0].time, /uniforms/],
  ['river bank mode missing', s => s.water[0].banks = 0, /bank mode/],
]) test(`render evidence fails closed: ${name}`, () => {
  const snapshot = sample(); mutate(snapshot);
  assert.throws(() => assertBiomeSnapshot(snapshot, config()), error);
});
test('a missing snapshot cannot pass', () => { for (const empty of [null,undefined]) assert.throws(() => assertBiomeSnapshot(empty, config()), /missing/); });
test('reduced effects reject even allocated-but-hidden ecology', () => {
  const settings = config({ reducedEffects: true }), snapshot = sample(settings);
  snapshot.batches.push({ ...sample().batches[2], count: 0, visible: false });
  assert.throws(() => assertBiomeSnapshot(snapshot, settings), /should not be allocated/);
});
test('sanctuary rejects river mode and extra terrain', () => {
  const settings = config({ sceneId: 'blue-moon.sanctuary' }), snapshot = sample(settings);
  snapshot.water[0].banks = 1; snapshot.terrain = 'unexpected';
  assert.throws(() => assertBiomeSnapshot(snapshot, settings), /Sanctuary unexpectedly|bank mode/);
});
test('reduced motion rejects a moving water uniform', () => {
  const settings = config({ reducedMotion: true }), snapshot = sample(settings);
  snapshot.water[0].time = .01;
  assert.throws(() => assertBiomeSnapshot(snapshot, settings), /kept moving/);
});
test('quality-only changes permit count changes without resource rebuilds', () => {
  assert.doesNotThrow(() => assertQualityReuse(sample(), sample(config({ quality: 'medium' }))));
});
for (const [field, value] of [['geometry', 'replaced'], ['matrixVersion', 2], ['matrixHash','bad']]) {
  test(`quality checks reject changed ${field}`, () => {
    const before = sample(), after = sample(config({ quality: 'medium' })); after.batches[2][field] = value;
    assert.throws(() => assertQualityReuse(before, after), /rebuilt or uploaded/);
  });
}
test('quality checks reject terrain rebuilds and incomparable scenes', () => {
  const before = sample(), after = sample(); after.terrain = 'new';
  assert.throws(() => assertQualityReuse(before, after), /terrain/);
  after.config.sceneId = 'crowned.home'; assert.throws(() => assertQualityReuse(before, after), /different scenes/);
});
test('freeze checks require fresh matching-state frames and actually frozen clocks', () => {
  const before = sample(config({ reducedMotion: true })), after = structuredClone(before); after.frames = 45;
  assert.doesNotThrow(() => assertFrozenMotion(before, after));
  after.time.water += .001; assert.throws(() => assertFrozenMotion(before, after), /water clock/);
  after.time.water = before.time.water; after.revision++; assert.throws(() => assertFrozenMotion(before, after), /fresh frames/);
  after.revision = before.revision; after.frames = before.frames; assert.throws(() => assertFrozenMotion(before, after), /fresh frames/);
});
function completeReport() {
  return { check: { status: 'passed' }, failures: [], entries: BIOME_REVIEW_VIEWPORTS.map(v => ({ ...v, passed: true })),
    captures: BIOME_REVIEW_VIEWPORTS.flatMap(v => BIOME_REVIEW_CASES.flatMap(s =>
      ['high','medium','cinematic','effects-off','motion-off','low','restored'].map(state => ({ width: v.width, sceneId: s.sceneId, state, passed: true, screenshot: 'evidence.png' })))),
  };
}
test('complete coverage requires 98 captures plus both production entry interactions', () => {
  const report = completeReport(); assert.equal(report.captures.length, 98);
  assert.doesNotThrow(() => assertCompleteBiomeReview(report));
});
for (const [name, mutate] of [
  ['missing full check', r => r.check.status = 'not-run'], ['failed check', r => r.check.status = 'failed'],
  ['failure record', r => r.failures.push('failed')], ['missing diagnostics', r => delete r.failures],
  ['missing entry interaction', r => r.entries.pop()], ['missing capture', r => r.captures.pop()],
  ['duplicate capture', r => r.captures.push(r.captures[0])], ['missing screenshot', r => delete r.captures[0].screenshot],
]) test(`review completion rejects ${name}`, () => { const report = completeReport(); mutate(report); assert.throws(() => assertCompleteBiomeReview(report)); });

test('runner preserves a failed prerequisite as a failed report without launching browsers', () => {
  const root = mkdtempSync(join(tmpdir(), 'biome-review-negative-'));
  try {
    mkdirSync(join(root, 'scripts'));
    for (const file of ['review-biome-world.mjs', 'biome-review-contract.mjs']) cpSync(new URL(`../scripts/${file}`, import.meta.url), join(root, 'scripts', file));
    writeFileSync(join(root, 'package.json'), JSON.stringify({ private: true, scripts: { check: 'node -e "console.error(\'INTENTIONAL_PREREQUISITE_FAILURE\'); process.exit(7)"' } }));
    execFileSync('git', ['init','--quiet'], { cwd: root });
    execFileSync('git', ['-c','user.name=QA Fixture','-c','user.email=qa@example.invalid','-c','commit.gpgsign=false','commit','--allow-empty','-m','fixture','--quiet'], { cwd: root });
    const output = join(root, 'evidence');
    const result = spawnSync(process.execPath, ['scripts/review-biome-world.mjs'], { cwd: root, encoding: 'utf8', timeout: 30000, env: { ...process.env, REVIEW_OUT: output } });
    assert.equal(result.status, 1, result.stderr);
    const run = readdirSync(output).find(name => name.startsWith('run-'));
    const report = JSON.parse(readFileSync(join(output, run, 'review.json'), 'utf8'));
    assert.equal(report.status, 'failed'); assert.equal(report.check.status, 'failed');
    assert.equal(report.captures.length, 0); assert.equal(report.entries.length, 0);
    assert.equal(report.webgl2, undefined); assert.match(report.failures[0].error, /npm run check exited/);
    assert.match(readFileSync(join(output, run, 'repository-check.log'), 'utf8'), /INTENTIONAL_PREREQUISITE_FAILURE/);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('fixture uses the real components and production shader hooks without a story-state shortcut', () => {
  const fixture = readFileSync(new URL('../scripts/fixtures/biome-review-stage.jsx', import.meta.url), 'utf8');
  for (const token of ['<OutdoorLandscape', '<NarrativeWater', '<SceneLighting', '<AuthoredLightShafts', '<GroundMist', 'original.call(this, shader, renderer)', 'gl.render(scene, camera)', 'context.readPixels']) assert.ok(fixture.includes(token), token);
  assert.doesNotMatch(fixture, /useJourneyStore|localStorage|dispatchStoryEvent|setState\(\{sceneId/);
  assert.match(fixture, /collidable=\{false\}/);
});
test('fixture points toward the actual river side rather than hiding the home water', () => {
  const fixture = readFileSync(new URL('../scripts/fixtures/biome-review-stage.jsx', import.meta.url), 'utf8');
  assert.match(fixture, /camera.lookAt\(\(spec.riverSide \|\| 1\) \* \(spec.inner \+ spec.outer\)/);
});
