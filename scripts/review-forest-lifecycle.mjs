// Actual canonical forest lifecycle evidence, using one retained Canvas.
// Run from the repository root: REVIEW_ANGLE=metal REVIEW_OUT=/absolute/evidence node scripts/review-forest-lifecycle.mjs
import assert from 'node:assert/strict';
import { spawn, execFileSync } from 'node:child_process';
import { mkdir, mkdtemp, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { chromium } from '@playwright/test';
import { FOREST_LIFECYCLE_SCENES as scenes, forestLifecycleProblems, forestResourceCounts, resourcePlateauProblems } from './forest-lifecycle-contracts.mjs';

const repo = process.cwd(), port = Number(process.env.REVIEW_PORT || 4341);
const angle = process.env.REVIEW_ANGLE || 'swiftshader';
const out = resolve(process.env.REVIEW_OUT || join(tmpdir(), 'slipper-forest-lifecycle-evidence'));
const readyTimeout = Number(process.env.REVIEW_READY_TIMEOUT || 90000);
assert.ok(['swiftshader', 'metal'].includes(angle), 'REVIEW_ANGLE must be swiftshader or metal');
assert.ok(Number.isInteger(port) && port > 1024 && port < 65536, 'Invalid REVIEW_PORT');
assert.ok(Number.isFinite(readyTimeout) && readyTimeout >= 1000 && readyTimeout <= 180000, 'Invalid REVIEW_READY_TIMEOUT');
const fixture = await mkdtemp(join(tmpdir(), 'slipper-forest-lifecycle-'));
const report = {
  method: 'Built canonical StorySceneWithMasterLantern in one retained Canvas, actual forest/terrain workers and native texture observations. Each case waits at least 48 frames and six consecutive sampled resource plateaus. Full 243-row one-hot weights, paired world-coordinate shapes and supported crown uploads are inspected. Bootstrap loads all exercised scene/quality assets. Each of three world mount lifetimes then follows the same scene warmup and two complete quality/reduced-effect waves before strict matching-phase comparisons. The first lifetime repeats the measured wave three times; fresh lifetimes compare only after the same warmup history.',
  scope: 'Trusted canonical scene/lantern seeding, paused Rapier and fixed canonical route camera. No physical progression, device FPS, full opening, or recovery claim. Native tracking starts at Canvas onCreated, after renderer bootstrap textures. Shared loader images and renderer caches may remain after unmount; repeated fully warmed empty cases must match and forest morph textures must be gone.',
  source: repo, angle, port, started: new Date().toISOString(), cases: [], comparisons: [], errors: [], requests: [],
};
let browser, page, server, serverLog = '';
const baseURL = `http://127.0.0.1:${port}`;

function workerObservation() {
  const fingerprint = array => {
    if (!array?.buffer) return null;
    const bytes = new Uint8Array(array.buffer, array.byteOffset, array.byteLength);
    let hash = 0x811c9dc5;
    for (const byte of bytes) hash = Math.imul(hash ^ byte, 0x01000193);
    return `${bytes.length}:${(hash >>> 0).toString(16)}`;
  };
  window.__forestFingerprint = fingerprint;
  window.__forestWorkers = [];
  const NativeWorker = window.Worker;
  window.Worker = class extends NativeWorker {
    constructor(...args) {
      super(...args);
      const record = { id: window.__forestWorkers.length + 1, url: String(args[0]),
        created: performance.now(), terminated: false, posts: [], responses: [], errors: [] };
      window.__forestWorkers.push(record);
      this.reviewRecord = record;
      // Observe native events and payloads without delaying, dispatching or replacing them.
      this.addEventListener('message', ({ data }) => {
        const response = { type: data.type, requestId: data.requestId, received: performance.now(),
          trunkCount: data.trunkCount, crownCount: data.crownCount, marshCount: data.marshCount, ruinCount: data.ruinCount,
          positions: data.positions?.length, colors: data.colors?.length, habitat: data.habitat?.length,
          colliders: data.colliders?.length, trunkHash: fingerprint(data.trunkMatrices),
          colorHash: fingerprint(data.trunkColors), positionHash: fingerprint(data.positions) };
        record.responses.push(response); record.lastResponse = response;
      });
      this.addEventListener('error', event => record.errors.push(event.message || 'Native worker error'));
      this.addEventListener('messageerror', () => record.errors.push('Native worker messageerror'));
    }
    postMessage(message, ...rest) {
      const keys = ['cellX', 'cellZ', 'cellSize', 'cellRadius', 'treesPerCell', 'instanceCount',
        'terrainSegments', 'terrainSize', 'cameraX', 'cameraZ', 'explorationDepth', 'memoryPressure'];
      const post = { type: message.type, requestId: message.requestId, posted: performance.now(),
        config: Object.fromEntries(keys.filter(key => key in (message.config ?? {})).map(key => [key, message.config[key]])) };
      this.reviewRecord.posts.push(post); this.reviewRecord.lastPost = post;
      return super.postMessage(message, ...rest);
    }
    terminate() {
      this.reviewRecord.terminated = true; this.reviewRecord.terminatedAt = performance.now();
      return super.terminate();
    }
  };
}

async function waitForServer() {
  const deadline = Date.now() + 30000;
  while (Date.now() < deadline) {
    if (server.exitCode !== null) throw new Error(`Fixture preview exited (${server.exitCode}): ${serverLog}`);
    try { if ((await fetch(baseURL)).ok) return; } catch { /* Preview has not bound its port yet. */ }
    await new Promise(resolveWait => setTimeout(resolveWait, 150));
  }
  throw new Error(`Fixture preview did not become available: ${serverLog}`);
}

async function capture(name, patch = {}, screenshot = false) {
  const started = Date.now();
  const revision = await page.evaluate(update => {
    const previous = window.__forestLifecycle?.revision ?? -1;
    window.__forestSet(update);
    return previous;
  }, patch);
  await page.waitForFunction(previous => window.__forestLifecycle?.revision > previous
    && window.__forestLifecycle.ready, revision, { timeout: readyTimeout });
  const sample = await page.evaluate(() => window.__forestLifecycle);
  assert.deepEqual(forestLifecycleProblems(sample), [], `${name}: invalid live forest evidence`);
  assert.deepEqual(report.errors, [], `${name}: browser errors`);
  const data = { name, elapsedMs: Date.now() - started, ...sample };
  report.cases.push(data);
  if (screenshot) { data.screenshot = `${name}.png`; await page.screenshot({ path: join(out, data.screenshot) }); }
  console.log(name, JSON.stringify({ elapsedMs: data.elapsedMs, sceneId: data.sceneId, quality: data.quality,
    reduced: data.reduced, mounted: data.mounted, resources: forestResourceCounts(data),
    population: data.forest.trunks?.count ?? 0, workers: data.liveWorkers, route: data.route?.key,
    calls: data.calls, triangles: data.triangles }));
  await writeFile(join(out, 'forest-lifecycle.json'), JSON.stringify(report, null, 2));
  return data;
}

function compare(name, before, after) {
  assert.equal(after.sceneId, before.sceneId, `${name}: comparison scene differs`);
  assert.equal(after.targetSceneId, before.targetSceneId, `${name}: comparison target differs`);
  assert.equal(after.quality, before.quality, `${name}: comparison quality differs`);
  assert.equal(after.reduced, before.reduced, `${name}: comparison reduced-effects state differs`);
  assert.equal(after.mounted, before.mounted, `${name}: comparison mount state differs`);
  const problems = resourcePlateauProblems(before, after);
  report.comparisons.push({ name, reference: before.name, current: after.name,
    before: forestResourceCounts(before), after: forestResourceCounts(after), problems });
  assert.deepEqual(problems, [], `${name}: resources did not return to the warmed plateau`);
  if (before.mounted) {
    assert.equal(after.forest.trunks.count, before.forest.trunks.count, `${name}: tree population changed`);
    assert.equal(after.forest.uploadedTrunkHash, before.forest.uploadedTrunkHash, `${name}: canonical worker positions changed`);
    assert.deepEqual(after.camera, before.camera, `${name}: fixed camera changed`);
    assert.deepEqual(after.quaternion, before.quaternion, `${name}: fixed camera heading changed`);
    assert.deepEqual(after.lens, before.lens, `${name}: fixed lens changed`);
    assert.deepEqual(after.projection, before.projection, `${name}: fixed projection changed`);
    assert.deepEqual(after.journeyPresentation, before.journeyPresentation, `${name}: seeded journey presentation changed`);
    assert.deepEqual(after.forest.trunks.weights.families.slice(0, after.forest.trunks.count),
      before.forest.trunks.weights.families.slice(0, before.forest.trunks.count), `${name}: stable world families changed`);
  }
}

try {
  await mkdir(out, { recursive: true });
  for (const name of ['src', 'public', 'node_modules', 'scripts']) await symlink(join(repo, name), join(fixture, name), 'dir');
  await writeFile(join(fixture, 'index.html'), '<!doctype html><html><head><title>Canonical forest lifecycle QA</title><meta name="viewport" content="width=device-width,initial-scale=1"><style>html,body,#root{margin:0;width:100%;height:100%;overflow:hidden;background:#121a20}</style></head><body><div id="root"></div><script type="module" src="/scripts/fixtures/forest-lifecycle-stage.jsx"></script></body></html>');
  await writeFile(join(fixture, 'vite.config.mjs'), `export default {root:${JSON.stringify(fixture)},esbuild:{jsx:'automatic'},resolve:{preserveSymlinks:true},worker:{format:'es'}};`);
  const vite = join(repo, 'node_modules/vite/bin/vite.js');
  try {
    const buildLog = execFileSync(process.execPath, [vite, 'build', '--config', join(fixture, 'vite.config.mjs'), '--outDir', join(fixture, 'dist')],
      { cwd: fixture, encoding: 'utf8', timeout: 180000, maxBuffer: 10 * 1024 * 1024 });
    await writeFile(join(out, 'fixture-build.log'), buildLog);
  } catch (error) {
    await writeFile(join(out, 'fixture-build.log'), `${error.stdout ?? ''}\n${error.stderr ?? ''}`);
    throw error;
  }
  server = spawn(process.execPath, [vite, 'preview', '--config', join(fixture, 'vite.config.mjs'), '--host', '127.0.0.1', '--port', String(port), '--strictPort'], { cwd: fixture });
  server.stdout.on('data', data => { serverLog += data; }); server.stderr.on('data', data => { serverLog += data; });
  await waitForServer();
  browser = await chromium.launch({ args: ['--enable-webgl', '--ignore-gpu-blocklist', `--use-angle=${angle}`] });
  page = await browser.newPage({ viewport: { width: 1100, height: 720 }, deviceScaleFactor: 1 });
  page.on('pageerror', error => report.errors.push({ type: 'pageerror', message: error.message }));
  page.on('console', message => { if (message.type() === 'error') report.errors.push({ type: 'console', message: message.text() }); });
  page.on('requestfailed', request => report.requests.push({ url: request.url(), failure: request.failure()?.errorText }));
  await page.addInitScript(workerObservation);
  await page.goto(baseURL, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForFunction(() => typeof window.__forestSet === 'function' && window.__forestLifecycle, null, { timeout: readyTimeout });
  const emptyInitial = await capture('initial-empty', {}, true);
  assert.equal(emptyInitial.liveWorkers, 0);

  const rabbit = { sceneId: scenes.rabbit, targetSceneId: scenes.meadow, mounted: true, reduced: false };
  const wave = [
    { quality: 'high', reduced: false }, { quality: 'low', reduced: false },
    { quality: 'medium', reduced: false }, { quality: 'cinematic', reduced: false },
    { quality: 'high', reduced: false }, { quality: 'low', reduced: false },
    { quality: 'high', reduced: true }, { quality: 'high', reduced: false },
  ];
  report.sequence = { worldMountLifetimes: 3, warmWavesPerLifetime: 2,
    measuredWavesPerLifetime: [3, 1, 1], phases: wave,
    comparisons: 'Exact resources, camera, worker payload, families and journey state at the same phase after identical warmup. Three.js releases each disposed material\'s cached shader variants, so cold remounts are recorded rather than compared with an earlier live-material cache.' };
  async function captureWave(prefix, screenshots = false) {
    const samples = [];
    for (const [step, phase] of wave.entries()) samples.push(await capture(
      `${prefix}-${step}-${phase.quality}${phase.reduced ? '-reduced' : ''}`,
      { ...rabbit, ...phase }, screenshots && [0, 5, 6, 7].includes(step)));
    return samples;
  }
  async function sceneWarmup(prefix, canonical, screenshots = false) {
    const changed = await capture(`${prefix}-target-change`, { ...rabbit, quality: 'high', targetSceneId: scenes.previous }, screenshots);
    assert.notEqual(changed.targetEntryId, canonical.targetEntryId, 'Route target change must select a different actual target');
    assert.notEqual(changed.route?.key, canonical.route?.key, 'Route target change must select a different actual physical segment');
    assert.ok(changed.route && changed.understory, 'Changed target must resolve the actual route and understory');
    await capture(`${prefix}-fire`, { sceneId: scenes.fire, targetSceneId: scenes.river, mounted: true, quality: 'high', reduced: false }, screenshots);
    await capture(`${prefix}-river`, { sceneId: scenes.river, targetSceneId: scenes.surrender, mounted: true, quality: 'low', reduced: false }, screenshots);
    await capture(`${prefix}-rabbit-returned`, { ...rabbit, quality: 'high' }, screenshots);
  }
  // Populate shared loader caches before measuring any mount lifetime. Material
  // shader caches are intentionally released at the following real unmount.
  const bootstrap = await capture('bootstrap-cold-high', { ...rabbit, quality: 'high' });
  await sceneWarmup('bootstrap', bootstrap);
  await captureWave('bootstrap-wave');
  const emptyWarm = await capture('bootstrap-empty', { ...rabbit, quality: 'high', mounted: false }, true);
  let firstReferences;
  for (let lifetime = 1; lifetime <= 3; lifetime++) {
    const prefix = `lifetime-${lifetime}`;
    const cold = await capture(`${prefix}-cold-high`, { ...rabbit, quality: 'high' }, true);
    await sceneWarmup(`${prefix}-scene-warm`, cold, lifetime === 1);
    await captureWave(`${prefix}-warm-wave-1`);
    const references = await captureWave(`${prefix}-warm-wave-2`, lifetime === 1);
    if (!firstReferences) firstReferences = references;
    else references.forEach((sample, step) => compare(`${prefix}-phase-${step}-remount-plateau`, firstReferences[step], sample));
    for (let cycle = 1; cycle <= (lifetime === 1 ? 3 : 1); cycle++) {
      const measured = await captureWave(`${prefix}-cycle-${cycle}`, lifetime === 3);
      measured.forEach((sample, step) => compare(`${prefix}-cycle-${cycle}-phase-${step}-plateau`, references[step], sample));
    }
    const empty = await capture(`${prefix}-empty`, { ...rabbit, quality: 'high', mounted: false }, true);
    compare(`${prefix}-empty-plateau`, emptyWarm, empty);
  }
  assert.deepEqual(report.errors, []);
  assert.deepEqual(report.requests, [], 'Fixture resources must load without failed requests');
  report.passed = true;
} catch (error) {
  report.passed = false;
  report.failure = { error: String(error), snapshot: await page?.evaluate(() => window.__forestLifecycle).catch(() => null) };
  await page?.screenshot({ path: join(out, 'forest-lifecycle-failure.png') }).catch(() => {});
  console.error(String(error));
  process.exitCode = 1;
} finally {
  await browser?.close(); server?.kill('SIGTERM');
  report.finished = new Date().toISOString();
  await mkdir(out, { recursive: true });
  await writeFile(join(out, 'forest-lifecycle.json'), JSON.stringify(report, null, 2));
  await writeFile(join(out, 'fixture-preview.log'), serverLog);
  await rm(fixture, { recursive: true, force: true });
  console.log('Forest lifecycle report:', join(out, 'forest-lifecycle.json'));
}
