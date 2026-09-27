#!/usr/bin/env node
import { spawn, execFileSync } from 'node:child_process';
import { createWriteStream } from 'node:fs';
import { readFile, mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { dirname, join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import {
  BIOME_REVIEW_CASES, BIOME_REVIEW_VIEWPORTS, assertBiomeSnapshot,
  assertQualityReuse, assertFrozenMotion, assertCompleteBiomeReview,
} from './biome-review-contract.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const digest = value => createHash('sha256').update(value).digest('hex');
const parent = resolve(process.env.REVIEW_OUT || join(tmpdir(), 'slipper-biome-review'));
await mkdir(parent, { recursive: true });
const out = await mkdtemp(join(parent, 'run-'));
const report = { scope: 'Production entry plus isolated biome source-component rendering; not a full gameplay or real-device FPS certification',
  check: { status: 'not-run' }, captures: [], entries: [], failures: [], output: out };
let browser, server, production;
const save = () => writeFile(join(out, 'review.json'), JSON.stringify(report, null, 2));

async function repositoryCheck() {
  const log = createWriteStream(join(out, 'repository-check.log'));
  try {
    await new Promise((accept, reject) => {
      const child = spawn(process.platform === 'win32' ? 'npm.cmd' : 'npm', ['run', 'check'], { cwd: root, stdio: ['ignore', 'pipe', 'pipe'] });
      child.stdout.pipe(log, { end: false }); child.stderr.pipe(log, { end: false });
      child.once('error', reject);
      child.once('close', code => code === 0 ? accept() : reject(new Error(`npm run check exited ${code}; see repository-check.log`)));
    });
    report.check.status = 'passed';
  } catch (error) { report.check.status = 'failed'; throw error; }
  finally { await new Promise(accept => log.end(accept)); await save(); }
}
function collectErrors(page) {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => {
    if (message.type() === 'error' || message.type() === 'warning' && /webgl|shader|context lost/i.test(message.text())) errors.push(message.text());
  });
  page.on('response', response => { if (response.status() >= 400) errors.push(`${response.status()} ${response.url()}`); });
  page.on('requestfailed', request => { if (request.failure()?.errorText !== 'net::ERR_ABORTED') errors.push(`${request.failure()?.errorText}: ${request.url()}`); });
  return errors;
}
async function settled(page, config, minimumFrames = 30) {
  await page.waitForFunction(({ config, minimumFrames }) => {
    const evidence = window.__biomeSnapshot;
    return evidence && evidence.frames >= minimumFrames && Object.entries(config).every(([key, value]) => evidence.config[key] === value);
  }, { config, minimumFrames }, { timeout: 90000 });
  return page.evaluate(() => window.__biomeSnapshot);
}
async function applySettings(page, config) {
  await page.getByLabel('Scene', { exact: true }).selectOption(config.sceneId);
  await page.getByLabel('Quality', { exact: true }).selectOption(config.quality);
  await page.getByLabel('Reduced effects', { exact: true }).setChecked(config.reducedEffects);
  await page.getByLabel('Reduced motion', { exact: true }).setChecked(config.reducedMotion);
}
async function productionEntry(viewport) {
  const context = await browser.newContext({ viewport, deviceScaleFactor: 1 }), page = await context.newPage();
  const errors = collectErrors(page), screenshot = `production-entry-${viewport.width}.png`;
  try {
    const response = await page.goto('http://127.0.0.1:4195/?accessible=1', { waitUntil: 'domcontentloaded', timeout: 45000 });
    if (!response?.ok() || digest(await response.body()) !== report.productionIndexHash) throw new Error('Production entry does not match the validated dist/index.html');
    if (!(await page.title()).toLowerCase().includes('slipper')) throw new Error('Wrong production page identity');
    await page.locator('.onboarding-gate[aria-busy="false"]').waitFor({ timeout: 60000 });
    await page.getByRole('button', { name: 'Begin', exact: true }).click();
    await page.locator('[data-accessible-journey="true"]').waitFor({ timeout: 30000 });
    if (await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)) throw new Error('Horizontal overflow');
    if (errors.length) throw new Error(errors.join('\n'));
    await page.screenshot({ path: join(out, screenshot) });
    report.entries.push({ ...viewport, passed: true, screenshot, interaction: 'Begin opens the accessible journey in the validated production build' });
  } catch (error) { report.failures.push({ scope: 'production-entry', ...viewport, error: String(error), errors }); }
  finally { await context.close(); await save(); }
}
async function biomeCase(scene, viewport) {
  const context = await browser.newContext({ viewport, deviceScaleFactor: 1 }), page = await context.newPage();
  const errors = collectErrors(page);
  const states = [
    ['high', 'high', false, false], ['medium', 'medium', false, false], ['cinematic', 'cinematic', false, false],
    ['effects-off', 'cinematic', true, false], ['motion-off', 'cinematic', false, true],
    ['low', 'low', false, false], ['restored', 'high', false, false],
  ];
  let before, first;
  try {
    await page.goto('http://127.0.0.1:4196/scripts/fixtures/biome-review.html', { waitUntil: 'domcontentloaded', timeout: 45000 });
    if (await page.title() !== 'Biome world component review') throw new Error('Wrong fixture page identity');
    await page.getByRole('heading', { name: 'Biome component review' }).waitFor();
    for (const [state, quality, reducedEffects, reducedMotion] of states) {
      const config = { sceneId: scene.sceneId, quality, reducedEffects, reducedMotion };
      await applySettings(page, config);
      let snapshot = assertBiomeSnapshot(await settled(page, config), config);
      if (await page.locator('vite-error-overlay').count()) throw new Error('Vite error overlay is visible');
      if (await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)) throw new Error('Fixture has horizontal overflow');
      if (before && (state === 'medium' || state === 'cinematic')) assertQualityReuse(before, snapshot);
      if (first && first.terrain !== snapshot.terrain) throw new Error('Settings rebuilt terrain');
      if (reducedMotion || reducedEffects) {
        const later = assertBiomeSnapshot(await settled(page, config, snapshot.frames + 15), config);
        assertFrozenMotion(snapshot, later); snapshot = later;
      }
      if (state === 'restored' && first) {
        for (const batch of snapshot.batches) {
          const original = first.batches.find(item => item.name === batch.name);
          if (original && batch.matrixHash !== original.matrixHash) throw new Error('Restoring quality changed deterministic placement');
        }
      }
      if (errors.length) throw new Error(errors.join('\n'));
      const screenshot = `${scene.family}-${state}-${viewport.width}.png`;
      await page.screenshot({ path: join(out, screenshot), timeout: 30000 });
      report.captures.push({ sceneId: scene.sceneId, family: scene.family, state, ...viewport, passed: true, screenshot, snapshot });
      before = snapshot; first ??= snapshot;
      await save();
    }
  } catch (error) {
    const name = `${scene.family}-failed-${viewport.width}`;
    await page.screenshot({ path: join(out, `${name}.png`), timeout: 5000 }).catch(() => {});
    await writeFile(join(out, `${name}.html.txt`), await page.content().catch(() => 'No DOM was available'));
    report.failures.push({ scope: 'biome-fixture', sceneId: scene.sceneId, ...viewport, error: String(error), errors });
  } finally { await context.close(); await save(); }
}
try {
  report.commit = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim();
  report.worktreeChanges = execFileSync('git', ['status', '--porcelain'], { cwd: root, encoding: 'utf8' }).trim();
  // Full tests, security checks, TypeScript, assets, build and Pages Functions.
  // No --skip-checks path: a failed prerequisite can never earn release approval.
  await repositoryCheck();
  report.productionIndexHash = digest(await readFile(join(root, 'dist/index.html')));
  report.worktreeAfterCheck = execFileSync('git', ['status', '--porcelain'], { cwd: root, encoding: 'utf8' }).trim();
  const { chromium } = await import('@playwright/test');
  const { createServer, preview } = await import('vite');
  const configFile = join(root, 'vite.config.ts');
  production = await preview({ root, configFile, preview: { host: '127.0.0.1', port: 4195, strictPort: true } });
  server = await createServer({ root, configFile, cacheDir: join(out, 'vite-cache'),
    server: { host: '127.0.0.1', port: 4196, strictPort: true },
    optimizeDeps: { entries: [join(root, 'scripts/fixtures/biome-review.html')] },
  });
  await server.listen();
  // Use the normal browser; an explicit software backend is for CI diagnostics,
  // not a real-device performance claim. No network or browser policy bypass.
  const angle = process.env.REVIEW_ANGLE;
  if (angle && !['swiftshader', 'metal'].includes(angle)) throw new Error('REVIEW_ANGLE must be swiftshader or metal');
  const args = angle ? [`--use-angle=${angle}`, ...(angle === 'swiftshader' ? ['--enable-unsafe-swiftshader'] : [])] : [];
  browser = await chromium.launch({ headless: process.env.REVIEW_HEADED !== '1', args });
  const probe = await browser.newPage();
  report.webgl2 = await probe.evaluate(() => Boolean(document.createElement('canvas').getContext('webgl2')));
  await probe.close();
  if (!report.webgl2) throw new Error('WebGL2 is unavailable; no rendering approval can be produced');
  for (const viewport of BIOME_REVIEW_VIEWPORTS) {
    await productionEntry(viewport);
    for (const scene of BIOME_REVIEW_CASES) await biomeCase(scene, viewport);
  }
  assertCompleteBiomeReview(report);
  report.status = 'passed';
} catch (error) { report.status = 'failed'; report.failures.push({ scope: 'release-review', error: String(error) }); process.exitCode = 1; }
finally {
  await browser?.close().catch(() => {});
  await server?.close().catch(() => {});
  if (production) await new Promise(accept => production.httpServer.close(accept));
  await save();
  console.log(`Biome review ${report.status}: ${join(out, 'review.json')}`);
}
