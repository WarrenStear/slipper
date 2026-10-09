import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { chromium, expect } from '@playwright/test';

// Run against an already-built preview or a development server. No source fixture,
// app store mutation, exposed production hook, or relaxed autoplay policy is used.
const baseURL = process.env.AUDIO_REVIEW_BASE_URL ?? process.env.PLAYWRIGHT_TEST_BASE_URL ?? 'http://127.0.0.1:4173';
const out = resolve(process.env.AUDIO_REVIEW_OUT ?? '/private/tmp/slipper-audio-lifecycle-review');
const angle = process.env.REVIEW_ANGLE ?? 'swiftshader';
if (!['swiftshader', 'metal'].includes(angle)) throw new Error('REVIEW_ANGLE must be swiftshader or metal');
const report = {
  baseURL, requestedAngle: angle, renderer: null, startedAt: new Date().toISOString(),
  method: 'Production UI with pre-load native Web Audio instrumentation. Fresh context starts with the saved audio preference off. Enable, Begin, pause, mute, volume, and text handoff use trusted Playwright UI input. No story events are synthesized.',
  limitations: [
    'Visibility uses a test-only document property/event fixture to exercise the real visibility handler synchronously; it does not certify native OS backgrounding or browser suspension policy.',
    'Live source and connection counts are instrumented Web Audio state, not a heap or device-performance measurement. The review intentionally retains node references for inspection.',
    'Focus and visibility use test-only document properties/events to exercise real handlers; native OS backgrounding remains a separate acceptance check.',
    'This is lifecycle and resource evidence, not a listening test or acoustic-quality certification. The requested ANGLE backend and actual renderer are recorded separately; mounting the production world is not a device-performance certification.',
  ],
  audioParamTiming: {
    method: 'Assert synchronous stop/disconnect and a zero-gain command at currentTime, then require the native AudioParam.value getter to reach exactly zero within 2 seconds. The getter may still expose the preceding audio render quantum in the same JavaScript task.',
    references: ['https://www.w3.org/TR/webaudio-1.0/#dom-audioparam-value', 'https://www.w3.org/TR/webaudio-1.0/#asynchronous-operations'],
  },
  checkpoints: [], pageErrors: [], consoleErrors: [], warnings: [], failures: [],
};

function installAudioProbe() {
  const Context = window.AudioContext ?? window.webkitAudioContext;
  if (!Context) throw new Error('Web Audio is required for the lifecycle review');
  // An isolated browser context is used. Only the starting sound preference is seeded.
  try { localStorage.setItem('sidtw:audio-enabled:v1', 'false'); } catch { /* about:blank */ }
  let nextId = 0, maxLiveLoops = 0, maxLiveOneShots = 0, automationSequence = 0;
  const ids = new WeakMap(), contexts = new Map(), buffers = [], nodes = new Map(), sources = [];
  const gainOwners = new WeakMap();
  const activations = [], resumes = [], visibility = [];
  const id = object => {
    if (!ids.has(object)) ids.set(object, ++nextId);
    return ids.get(object);
  };
  const contextInfo = context => {
    const key = id(context);
    if (!contexts.has(key)) contexts.set(key, { id: key, context, closeCalls: 0 });
    return contexts.get(key);
  };
  const rememberNode = (node, type) => {
    const key = id(node);
    if (!nodes.has(key)) nodes.set(key, { id: key, node, type, contextId: contextInfo(node.context).id, connections: new Set(), automation: [] });
    if (type === 'gain') gainOwners.set(node.gain, nodes.get(key));
    return node;
  };
  for (const method of ['cancelScheduledValues', 'setValueAtTime', 'setTargetAtTime']) {
    const original = AudioParam.prototype[method];
    AudioParam.prototype[method] = function(...args) {
      const result = Reflect.apply(original, this, args);
      const owner = gainOwners.get(this);
      // Only retain the last few listener commands; per-frame stem automation
      // is deliberately excluded so instrumentation stays bounded.
      if (owner?.connections.has(id(owner.node.context.destination))) {
        owner.automation.push({ sequence: ++automationSequence, method, args, contextTime: owner.node.context.currentTime });
        if (owner.automation.length > 8) owner.automation.shift();
      }
      return result;
    };
  }
  const live = loop => sources.filter(source => source.started && !source.stopped && !source.ended && source.node.loop === loop).length;
  const peaks = () => {
    maxLiveLoops = Math.max(maxLiveLoops, live(true));
    maxLiveOneShots = Math.max(maxLiveOneShots, live(false));
  };
  const prototype = Context.prototype;
  const createBuffer = prototype.createBuffer;
  prototype.createBuffer = function(...args) {
    const buffer = Reflect.apply(createBuffer, this, args);
    buffers.push({ id: id(buffer), contextId: contextInfo(this).id, channels: buffer.numberOfChannels,
      length: buffer.length, sampleRate: buffer.sampleRate, duration: buffer.duration });
    return buffer;
  };
  for (const [method, type] of [['createGain', 'gain'], ['createBiquadFilter', 'filter'], ['createStereoPanner', 'pan']]) {
    const original = prototype[method];
    prototype[method] = function(...args) { return rememberNode(Reflect.apply(original, this, args), type); };
  }
  const createSource = prototype.createBufferSource;
  prototype.createBufferSource = function(...args) {
    const source = rememberNode(Reflect.apply(createSource, this, args), 'source');
    const entry = { node: source, id: id(source), started: false, stopped: false, ended: false };
    sources.push(entry);
    const start = source.start, stop = source.stop;
    source.start = function(...startArgs) {
      const result = Reflect.apply(start, this, startArgs);
      entry.started = true;
      peaks();
      return result;
    };
    source.stop = function(...stopArgs) {
      const result = Reflect.apply(stop, this, stopArgs);
      // Application stops are immediate. Preserve future scheduled stops if introduced.
      if ((stopArgs[0] ?? 0) <= this.context.currentTime) entry.stopped = true;
      return result;
    };
    source.addEventListener('ended', () => { entry.ended = true; });
    return source;
  };
  const connect = AudioNode.prototype.connect, disconnect = AudioNode.prototype.disconnect;
  AudioNode.prototype.connect = function(...args) {
    const result = Reflect.apply(connect, this, args);
    nodes.get(id(this))?.connections.add(id(args[0]));
    return result;
  };
  AudioNode.prototype.disconnect = function(...args) {
    const result = Reflect.apply(disconnect, this, args);
    const connections = nodes.get(id(this))?.connections;
    if (args.length === 0 || typeof args[0] === 'number') connections?.clear();
    else connections?.delete(id(args[0]));
    return result;
  };
  const resume = prototype.resume, close = prototype.close;
  prototype.resume = function(...args) {
    resumes.push({ contextId: contextInfo(this).id, userActivationActive: navigator.userActivation?.isActive ?? false });
    return Reflect.apply(resume, this, args);
  };
  prototype.close = function(...args) {
    contextInfo(this).closeCalls++;
    return Reflect.apply(close, this, args);
  };
  window.addEventListener('sidtw:narrative-audio-activation', event => activations.push({ ...event.detail }));
  document.addEventListener('visibilitychange', () => visibility.push({ hidden: document.hidden, state: document.visibilityState }));
  window.__audioLifecycleReview = {
    snapshot() {
      peaks();
      const ambient = buffers.filter(buffer => [4.2, 6.4, 7.6].some(duration => Math.abs(buffer.duration - duration) <= 1 / buffer.sampleRate));
      const connected = [...nodes.values()].filter(node => node.connections.size > 0);
      const masterGains = connected.filter(node => node.type === 'gain' && node.connections.has(id(node.node.context.destination)))
        .map(node => ({ id: node.id, gain: node.node.gain.value, automation: [...node.automation] }));
      return {
        buffers: [...buffers], ambientBufferIds: ambient.map(buffer => buffer.id),
        ambientSeconds: ambient.reduce((total, buffer) => total + buffer.duration, 0),
        ambientBytes: ambient.reduce((total, buffer) => total + buffer.length * buffer.channels * 4, 0),
        liveLoops: live(true), liveOneShots: live(false), maxLiveLoops, maxLiveOneShots,
        connectedNodes: connected.map(node => ({ id: node.id, type: node.type, destinations: [...node.connections] })),
        masterGains, sourcesCreated: sources.length,
        contexts: [...contexts.values()].map(value => ({ id: value.id, state: value.context.state, sampleRate: value.context.sampleRate, closeCalls: value.closeCalls })),
        activations: [...activations], resumes: [...resumes], visibility: [...visibility],
      };
    },
    setFocusFixture(focused) {
      const previousAutomationSequence = automationSequence;
      Object.defineProperty(document, 'hasFocus', { configurable: true, value: () => focused });
      window.dispatchEvent(new FocusEvent(focused ? 'focus' : 'blur'));
      return { ...this.snapshot(), previousAutomationSequence };
    },
    descendantFocusFixture() {
      document.querySelector('button')?.dispatchEvent(new FocusEvent('blur'));
      return this.snapshot();
    },
    setVisibilityFixture(hidden) {
      const previousAutomationSequence = automationSequence;
      if (hidden) {
        Object.defineProperty(document, 'hidden', { configurable: true, value: true });
        Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'hidden' });
      } else {
        delete document.hidden;
        delete document.visibilityState;
      }
      document.dispatchEvent(new Event('visibilitychange'));
      return { ...this.snapshot(), previousAutomationSequence };
    },
  };
}

let browser, context, page;
await mkdir(out, { recursive: true });
try {
  browser = await chromium.launch({ headless: true, args: [
    '--enable-webgl', '--ignore-gpu-blocklist', `--use-angle=${angle}`,
    '--autoplay-policy=document-user-activation-required',
  ] });
  context = await browser.newContext({ viewport: { width: 1100, height: 760 }, reducedMotion: 'reduce' });
  await context.addInitScript(installAudioProbe);
  page = await context.newPage();
  page.setDefaultTimeout(20_000);
  page.on('pageerror', error => report.pageErrors.push(error.message));
  page.on('console', message => {
    if (message.type() === 'error') report.consoleErrors.push(message.text());
    if (message.type() === 'warning' || message.type() === 'warn') report.warnings.push(message.text());
  });
  const read = () => page.evaluate(() => window.__audioLifecycleReview.snapshot());
  const checkpoint = async (name, value) => {
    const snapshot = value ?? await read();
    assert.ok(snapshot.maxLiveLoops <= 10, `${name}: more than ten ambient loops were live`);
    assert.ok(snapshot.maxLiveOneShots <= 3, `${name}: event voice cap exceeded`);
    report.checkpoints.push({ name, ...snapshot });
    console.log(`${name}: ${snapshot.liveLoops} loops, ${snapshot.ambientBufferIds.length} ambient buffers, ${snapshot.connectedNodes.length} connected nodes`);
    return snapshot;
  };
  const loops = count => expect.poll(async () => (await read()).liveLoops, { timeout: 45_000 }).toBe(count);
  const exactMasterZero = () => expect.poll(async () => {
    const snapshot = await read();
    return snapshot.masterGains.length > 0 && snapshot.masterGains.every(master => master.gain === 0);
  }, { timeout: 2_000, intervals: [10, 20, 50], message: 'native listener AudioParam must reach exactly zero after its scheduled mute' }).toBe(true);
  const dialog = () => page.getByRole('dialog', { name: 'Experience settings', exact: true });
  const audio = () => dialog().getByRole('button', { name: /Audio atmosphere/ });
  const openSettings = async () => {
    await page.getByRole('button', { name: 'Memories', exact: true }).click();
    const menu = page.getByRole('dialog', { name: 'Memories', exact: true });
    await expect(menu).toBeVisible();
    await menu.getByRole('button', { name: 'Settings', exact: true }).click();
    await expect(menu).not.toBeVisible();
    await expect(dialog()).toBeVisible();
    // The drawer schedules its initial keyboard focus on the next frame. Wait
    // for that handoff before focusing the slider, or it can steal Home/End.
    await expect(dialog().getByRole('button', { name: 'Close settings', exact: true })).toBeFocused();
  };
  const closeSettings = async () => {
    await dialog().getByRole('button', { name: 'Close settings', exact: true }).click();
    await expect(dialog()).not.toBeVisible();
  };
  let cachedIds;
  const sameBank = snapshot => {
    assert.deepEqual(snapshot.ambientBufferIds, cachedIds, 'ambient bank was rebuilt within the same AudioContext');
    assert.equal(snapshot.buffers.length, 10, 'UI lifecycle checks must not allocate extra audio buffers');
    assert.ok(Math.abs(snapshot.ambientSeconds - 47.6) < .001);
    assert.ok(snapshot.buffers.every(buffer => buffer.channels === 1));
    assert.equal(snapshot.contexts.length, 1, 'lifecycle created a second context');
    assert.equal(snapshot.contexts[0].closeCalls, 0, 'shared gesture context was closed');
  };

  await page.goto(new URL('/?quality=low', baseURL).href, { waitUntil: 'domcontentloaded', timeout: 60_000 });
  await page.bringToFront();
  await expect(page).toHaveTitle(/Slipper in the Woods/);
  await expect(page.locator('.onboarding-gate')).toHaveAttribute('aria-busy', 'false');
  const threshold = await checkpoint('threshold-before-audio-gesture');
  assert.equal(threshold.buffers.length, 0);
  assert.equal(threshold.contexts.length, 0);
  await page.getByRole('button', { name: 'Accessibility and sound settings', exact: true }).click();
  await expect(audio()).toHaveAttribute('aria-pressed', 'false');
  await audio().click();
  await expect(audio()).toHaveAttribute('aria-pressed', 'true');
  await expect.poll(async () => (await read()).activations.some(value => value.userActivationActive === true)).toBe(true);
  await closeSettings();
  await page.getByRole('button', { name: 'Begin', exact: true }).click();
  await expect(page.locator('canvas').first()).toBeVisible({ timeout: 60_000 });
  await expect(page.locator('vite-error-overlay, canvas dialog')).toHaveCount(0);
  await loops(10);
  report.renderer = await page.locator('canvas').first().evaluate(canvas => {
    // The mounted R3F world already owns this context. getContext returns it;
    // these capability reads do not create a renderer or mutate its draw state.
    const gl = canvas.getContext('webgl2');
    if (!gl) return { available: false, reason: 'Mounted canvas did not expose its WebGL2 context' };
    try {
      const debug = gl.getExtension('WEBGL_debug_renderer_info');
      return {
        available: true,
        renderer: gl.getParameter(gl.RENDERER), vendor: gl.getParameter(gl.VENDOR),
        unmaskedRenderer: debug ? gl.getParameter(debug.UNMASKED_RENDERER_WEBGL) : null,
        unmaskedVendor: debug ? gl.getParameter(debug.UNMASKED_VENDOR_WEBGL) : null,
        version: gl.getParameter(gl.VERSION), shadingLanguage: gl.getParameter(gl.SHADING_LANGUAGE_VERSION),
      };
    } catch (error) { return { available: false, reason: String(error) }; }
  });
  const playing = await checkpoint('trusted-enable-and-begin');
  cachedIds = playing.ambientBufferIds;
  assert.equal(cachedIds.length, 10);
  sameBank(playing);
  assert.equal(playing.contexts[0].state, 'running');

  await openSettings();
  await loops(0);
  await exactMasterZero();
  const paused = await checkpoint('settings-paused');
  assert.ok(paused.masterGains.length > 0 && paused.masterGains.every(master => master.gain === 0));
  sameBank(paused);
  await audio().click();
  await expect(audio()).toHaveAttribute('aria-pressed', 'false');
  await expect.poll(async () => (await read()).connectedNodes.length).toBe(0);
  await closeSettings();
  await loops(0);
  sameBank(await checkpoint('muted-and-audio-director-unmounted'));

  await openSettings();
  await audio().click();
  await expect(audio()).toHaveAttribute('aria-pressed', 'true');
  await closeSettings();
  await loops(10);
  sameBank(await checkpoint('unmuted-bank-reused'));

  await openSettings();
  const volume = dialog().getByRole('slider', { name: 'Audio volume' });
  await volume.focus();
  await expect(volume).toBeFocused();
  await volume.press('Home');
  await expect(volume).toHaveValue('0');
  await closeSettings();
  await loops(0);
  sameBank(await checkpoint('zero-volume-remains-silent-after-settings-close'));
  await openSettings();
  await volume.focus();
  await expect(volume).toBeFocused();
  await volume.press('End');
  await expect(volume).toHaveValue('1');
  await closeSettings();
  await loops(10);
  sameBank(await checkpoint('volume-restored'));

  const hidden = await page.evaluate(() => window.__audioLifecycleReview.setVisibilityFixture(true));
  sameBank(await checkpoint('visibility-fixture-hidden-synchronous', hidden));
  assert.equal(hidden.liveLoops, 0, 'visibility pause must stop sources synchronously without another animation frame');
  assert.ok(hidden.connectedNodes.every(node => node.type !== 'source'), 'visibility pause must detach the stopped sources synchronously');
  assert.ok(hidden.masterGains.length > 0);
  for (const master of hidden.masterGains) {
    const commands = master.automation.filter(command => command.sequence > hidden.previousAutomationSequence);
    const cancel = commands.find(command => command.method === 'cancelScheduledValues');
    const zero = commands.find(command => command.method === 'setValueAtTime' && command.args[0] === 0);
    assert.ok(cancel && zero && cancel.sequence < zero.sequence, 'visibility must cancel prior automation before scheduling an exact zero');
    assert.ok(zero.args[1] <= zero.contextTime, 'visibility mute must be scheduled now, not after a fade');
  }
  await exactMasterZero();
  const hiddenSettled = await checkpoint('visibility-fixture-hidden-render-quantum');
  assert.equal(hiddenSettled.liveLoops, 0);
  assert.ok(hiddenSettled.masterGains.length > 0 && hiddenSettled.masterGains.every(master => master.gain === 0));
  sameBank(hiddenSettled);
  await page.evaluate(() => window.__audioLifecycleReview.setVisibilityFixture(false));
  await loops(10);
  sameBank(await checkpoint('visibility-fixture-restored'));

  const descendant = await page.evaluate(() => window.__audioLifecycleReview.descendantFocusFixture());
  sameBank(await checkpoint('descendant-button-blur-does-not-pause', descendant));
  assert.equal(descendant.liveLoops, 10);
  const blurred = await page.evaluate(() => window.__audioLifecycleReview.setFocusFixture(false));
  sameBank(await checkpoint('window-blur-fixture-synchronous', blurred));
  assert.equal(blurred.liveLoops, 0, 'window blur must stop voices without an animation frame');
  assert.ok(blurred.connectedNodes.every(node => node.type !== 'source'));
  await exactMasterZero();
  await page.evaluate(() => window.__audioLifecycleReview.setFocusFixture(true));
  await loops(10);
  sameBank(await checkpoint('window-focus-fixture-restored'));
  await openSettings();
  await dialog().getByRole('button', { name: 'Continue with text journey' }).click();
  await expect(page.locator('[data-accessible-journey="true"]')).toBeVisible();
  await expect(page.locator('canvas')).toHaveCount(0);
  await loops(0);
  await expect.poll(async () => (await read()).connectedNodes.length).toBe(0);
  sameBank(await checkpoint('text-handoff-canvas-unmounted'));
  // A later ordinary trusted input must not resurrect the disposed audio director.
  await page.keyboard.press('Tab');
  await page.waitForTimeout(300);
  const disposed = await checkpoint('after-unmount-trusted-input');
  assert.equal(disposed.liveLoops, 0);
  assert.equal(disposed.liveOneShots, 0);
  assert.equal(disposed.connectedNodes.length, 0);
  sameBank(disposed);
  assert.deepEqual(report.pageErrors, []);
  assert.deepEqual(report.consoleErrors, []);
  report.passed = true;
} catch (error) {
  report.passed = false;
  report.failures.push({ message: String(error), stack: error.stack });
  if (page && !page.isClosed()) {
    try { report.failureState = await page.evaluate(() => window.__audioLifecycleReview?.snapshot()); } catch { /* page unavailable */ }
    try { await page.screenshot({ path: resolve(out, 'failure.png'), timeout: 10_000 }); } catch { /* preserve original failure */ }
  }
  process.exitCode = 1;
} finally {
  report.finishedAt = new Date().toISOString();
  await writeFile(resolve(out, 'review.json'), JSON.stringify(report, null, 2));
  await context?.close();
  await browser?.close();
  console.log(`Audio lifecycle ${report.passed ? 'passed' : 'failed'}: ${resolve(out, 'review.json')}`);
}
