import assert from 'node:assert/strict';
import test, { after } from 'node:test';
import { readFileSync } from 'node:fs';
import { createRequire, register } from 'node:module';
import vm from 'node:vm';
import React from 'react';
import * as jsxRuntime from 'react/jsx-runtime';
import ts from 'typescript';

register('./canonical-node-loader.mjs', import.meta.url);
const require = createRequire(import.meta.url), Reconciler = require('react-reconciler');
const { ConcurrentRoot, DefaultEventPriority } = require('react-reconciler/constants');
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
class RecordedTarget extends EventTarget {
  listeners = new Map();
  addEventListener(type, callback, options) {
    const bucket = this.listeners.get(type) ?? new Map(); bucket.set(callback, options); this.listeners.set(type, bucket);
    super.addEventListener(type, callback, options);
  }
  removeEventListener(type, callback, options) {
    const bucket = this.listeners.get(type); bucket?.delete(callback); if (bucket?.size === 0) this.listeners.delete(type);
    super.removeEventListener(type, callback, options);
  }
  listenerCount() { return [...this.listeners.values()].reduce((sum, bucket) => sum + bucket.size, 0); }
}
const oldGlobals = { window: globalThis.window, document: globalThis.document };
const values = new Map(), windowTarget = new RecordedTarget(), documentTarget = new RecordedTarget();
let now = 0, focused = true, nextFrame = 0;
const frames = new Map();
windowTarget.localStorage = { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value), removeItem: key => values.delete(key) };
windowTarget.matchMedia = () => ({ matches: false, addEventListener() {}, removeEventListener() {} });
windowTarget.location = { search: '' };
windowTarget.requestAnimationFrame = callback => { const id = ++nextFrame; frames.set(id, callback); return id; };
windowTarget.cancelAnimationFrame = id => frames.delete(id);
documentTarget.hidden = false; documentTarget.hasFocus = () => focused;
documentTarget.documentElement = { dataset: {}, classList: { toggle() {}, contains: () => false } };
globalThis.window = windowTarget; globalThis.document = documentTarget;
after(() => { globalThis.window = oldGlobals.window; globalThis.document = oldGlobals.document; });

const runtimeModule = await import('../src/narrative/StoryRuntime.ts');
const physicalModule = await import('../src/player/physicalObservation.ts');
const inputModule = await import('../src/player/physicalObservationInput.ts');
const journeyModule = await import('../src/stores/useJourneyStore.ts');
const settingsModule = await import('../src/stores/useSettingsStore.ts');
const worldModule = await import('../src/stores/useWorldStore.ts');
const blueprint = await import('../src/data/journeyBlueprint.ts');
const { createFreshStoryJourneyState, sanitizeStoryJourneyState } = await import('../src/lib/storyJourneyState.ts');
const { STORY_EVENTS } = await import('../src/storyEvents/storyEventRegistry.ts');
const { useJourneyStore } = journeyModule, { useSettingsStore } = settingsModule, { useWorldStore } = worldModule;

const source = readFileSync(new URL('../src/experience/StoryRuntimeContext.tsx', import.meta.url), 'utf8');
const modules = { react: React, 'react/jsx-runtime': jsxRuntime,
  '../narrative/StoryRuntime': runtimeModule, '../player/physicalObservation': physicalModule,
  '../player/physicalObservationInput': inputModule, '../stores/useJourneyStore': journeyModule,
  '../stores/useSettingsStore': settingsModule, '../stores/useWorldStore': worldModule };
const exports = {};
vm.runInNewContext(ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022,
  module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText, {
  exports, require: name => { assert.ok(name in modules, `Unexpected actual host dependency ${name}`); return modules[name]; },
  window: windowTarget, document: documentTarget, performance: { now: () => now },
});
const { StoryRuntimeProvider, useStoryRuntimeShell, physicalScopeCurrent } = exports;

const entryIds = Object.keys(blueprint.JOURNEY_ENTRY_PROGRESS);
const options = { fallbackEntryId: entryIds[0], validEntryIds: entryIds, entryProgress: blueprint.JOURNEY_ENTRY_PROGRESS,
  beatIdsByAct: blueprint.JOURNEY_BEAT_IDS_BY_ACT, ritualIds: blueprint.JOURNEY_RITUAL_IDS,
  worldFlagIds: blueprint.JOURNEY_WORLD_FLAG_IDS, landmarkIds: blueprint.JOURNEY_LANDMARK_IDS,
  recoveredKeyIds: blueprint.JOURNEY_RECOVERED_KEY_IDS, symbolicObjectIds: blueprint.JOURNEY_SYMBOLIC_OBJECT_IDS,
  now: () => '2026-10-06T10:00:00.000Z' };
const fresh = overrides => ({ ...createFreshStoryJourneyState(options), ...overrides });
const commandNames = ['startStory', 'navigateToEntry', 'goBack', 'witnessEntry', 'enterBeat', 'completeScene', 'completeChapter',
  'dispatchStoryEvent', 'completeRitual', 'setWorldFlag', 'setLandmarkState', 'addResonance', 'awardLantern', 'recoverKey',
  'collectSymbolicObject', 'releaseWord', 'completeAct', 'completeStory'];
const originalCommands = Object.fromEntries(commandNames.map(name => [name, useJourneyStore.getState()[name]]));
function sceneFixture(scene, overrides = {}) {
  const prior = blueprint.journeyScenes.slice(0, blueprint.journeyScenes.indexOf(scene)).map(item => item.id);
  return sanitizeStoryJourneyState(fresh({ activeEntryId: scene.keystoneEntryId, storyStarted: true, completedSceneIds: prior,
    completedChapterIds: blueprint.journeyChapters.filter(chapter => chapter.sceneIds.every(id => prior.includes(id))).map(chapter => chapter.id),
    completedRitualIds: blueprint.JOURNEY_RITUAL_IDS,
    worldFlags: Object.fromEntries(blueprint.JOURNEY_WORLD_FLAG_IDS.map(id => [id, true])),
    inventory: { lantern: true, recoveredKeys: blueprint.JOURNEY_RECOVERED_KEY_IDS, symbolicObjects: blueprint.JOURNEY_SYMBOLIC_OBJECT_IDS },
    ...overrides }), options);
}
function fixture(snapshot = fresh()) {
  assert.equal(frames.size, 0, 'Previous actual host removed its DOM scheduler');
  now = 0; focused = true; documentTarget.hidden = false;
  useSettingsStore.setState({ drawerOpen: false, reducedMotion: false });
  useWorldStore.setState({ mode: 'explore', controls: 'walk', physicsPaused: false });
  const commands = [];
  useJourneyStore.setState({ ...snapshot, ...Object.fromEntries(commandNames.filter(name => typeof originalCommands[name] === 'function')
    .map(name => [name, (...args) => { commands.push([name, ...args]); return originalCommands[name](...args); }])),
    sceneRelocationRevision: 0, isInitialized: true, playerPosition: null, lastSafeEntryId: snapshot.activeEntryId });
  return commands;
}
const el = React.createElement;
const renderer = Reconciler({
  supportsMutation: true, isPrimaryRenderer: false, supportsPersistence: false, supportsHydration: false,
  getRootHostContext: () => null, getChildHostContext: () => null, getPublicInstance: value => value,
  createInstance: () => ({ children: [] }), createTextInstance: text => ({ text }),
  appendInitialChild: (parent, child) => parent.children.push(child), appendChild: (parent, child) => parent.children.push(child),
  appendChildToContainer: (parent, child) => parent.children.push(child),
  removeChild: (parent, child) => { parent.children = parent.children.filter(item => item !== child); },
  removeChildFromContainer: (parent, child) => { parent.children = parent.children.filter(item => item !== child); },
  insertBefore: () => {}, insertInContainerBefore: () => {}, finalizeInitialChildren: () => false,
  prepareForCommit: () => null, resetAfterCommit: () => {}, preparePortalMount: () => {},
  shouldSetTextContent: () => false, prepareUpdate: () => true, commitUpdate: () => {}, commitTextUpdate: () => {},
  hideInstance: () => {}, unhideInstance: () => {}, hideTextInstance: () => {}, unhideTextInstance: () => {},
  getCurrentEventPriority: () => DefaultEventPriority, beforeActiveInstanceBlur: () => {}, afterActiveInstanceBlur: () => {},
  detachDeletedInstance: () => {}, clearContainer: container => { container.children = []; },
  scheduleTimeout: setTimeout, cancelTimeout: clearTimeout, noTimeout: -1,
});
function mount({ strict = false, activity = {} } = {}) {
  let host, shell = { ready: true, participating: true, overlayOpen: false, allowActions: true, ...activity };
  function Capture() { host = useStoryRuntimeShell(shell); return null; }
  const root = renderer.createContainer({ children: [] }, ConcurrentRoot, null, strict, null, '', error => { throw error; }, null);
  const tree = () => el(StoryRuntimeProvider, null, el(Capture));
  const render = child => React.act(() => renderer.flushSync(() => renderer.updateContainer(child, root, null, null)));
  render(strict ? el(React.StrictMode, null, tree()) : tree());
  return { get host() { return host; }, render, tree,
    configure(next) { shell = { ...shell, ...next }; render(strict ? el(React.StrictMode, null, tree()) : tree()); },
    unmount() { render(null); assert.equal(frames.size, 0); },
  };
}
function tick(time) {
  now = time; const pending = [...frames.values()]; frames.clear();
  React.act(() => { for (const callback of pending) callback(time); });
}
const scope = () => { const state = useJourneyStore.getState(); return { entryId: state.activeEntryId, sceneId: state.sceneId, revision: state.sceneRelocationRevision }; };
const pose = observedAtMs => ({ observedAtMs, position: [0, 1.7, 0], quaternion: [0, 0, 0, 1], inputEnabled: true, settled: true });
function publish(host, time) { now = time; const binding = host.physicalBinding(scope()); assert.ok(binding);
  binding.port.publish(binding.lease, pose(time)); return host.readPhysical(scope(), time); }
function enter(host, type = 'begin') { const result = host.runtime.dispatch({ type }); assert.equal(result.accepted, true, result.reason); return result.lease; }
function eventFixture(id) {
  const event = STORY_EVENTS.find(item => item.id === id); assert.ok(event);
  const scene = blueprint.journeyScenes.find(item => item.id === event.sceneId);
  fixture(sceneFixture(scene, { completedStoryEventIds: STORY_EVENTS.filter(item => item.sceneId === scene.id && item.id !== id).map(item => item.id) }));
  return event;
}

test('actual host construction, StrictMode binding, sampling and cleanup issue zero canonical commands', () => {
  for (const snapshot of [fresh(), sceneFixture(blueprint.journeyScenes[7]), sceneFixture(blueprint.journeyScenes.at(-1),
    { storyCompleted: true, completedSceneIds: blueprint.journeyScenes.map(scene => scene.id), completedChapterIds: blueprint.journeyChapters.map(chapter => chapter.id) })]) {
    const commands = fixture(snapshot), before = useJourneyStore.getState().getSnapshot();
    const cpu = mount({ strict: true }); assert.equal(cpu.host.runtime.currentLease(), null); assert.equal(frames.size, 1);
    for (let frame = 0; frame < 240; frame++) { tick(frame * 1000 / 60); assert.equal(frames.size, 1); assert.equal(cpu.host.physicalBinding(), null); }
    cpu.unmount(); assert.deepEqual(commands, []); assert.deepEqual(useJourneyStore.getState().getSnapshot(), before);
  }
});

test('actual host scopes entry/scene/relocation and caches one numeric binding without progression', () => {
  const commands = fixture(), cpu = mount(); enter(cpu.host); const before = commands.length;
  const currentScope = scope(), first = cpu.host.physicalBinding(currentScope);
  assert.ok(first); assert.equal(cpu.host.physicalBinding({ ...currentScope }), first);
  for (const stale of [{ ...currentScope, entryId: 'fragment-002' }, { ...currentScope, sceneId: 'other' }, { ...currentScope, revision: 1 }]) {
    assert.equal(physicalScopeCurrent(stale, useJourneyStore.getState()), false);
    assert.equal(cpu.host.physicalBinding(stale), null); assert.equal(cpu.host.readPhysical(stale, 500), null);
  }
  assert.equal(cpu.host.readPhysical(currentScope, 500).available, false);
  publish(cpu.host, 500); assert.equal(publish(cpu.host, 575).available, true); assert.equal(commands.length, before);
  React.act(() => useJourneyStore.setState({ sceneRelocationRevision: 1 }));
  assert.equal(cpu.host.physicalBinding(currentScope), null); assert.equal(cpu.host.physicalBinding(), null);
  assert.equal(first.port.publish(first.lease, pose(650)), false); assert.equal(first.port.read(first.lease, 650), null);
  cpu.unmount();
});

test('actual provider retained Suspense reconnect renews explicit authority without another scene entry', async () => {
  const commands = fixture(); let host, suspend, resolvePending, ready = false, authorizationLosses = 0;
  const onAuthorizationLost = () => { authorizationLosses++; };
  const pending = new Promise(resolve => { resolvePending = () => { ready = true; resolve(); }; });
  function Capture() { host = useStoryRuntimeShell({ ready: true, participating: true, overlayOpen: false,
    allowActions: true, onAuthorizationLost }); return null; }
  function Parent() { const [blocked, setBlocked] = React.useState(false); suspend = () => setBlocked(true);
    if (blocked && !ready) throw pending; return el(StoryRuntimeProvider, null, el(Capture)); }
  const root = renderer.createContainer({ children: [] }, ConcurrentRoot, null, false, null, '', error => { throw error; }, null);
  const render = child => React.act(() => renderer.flushSync(() => renderer.updateContainer(child, root, null, null)));
  render(el(React.Suspense, { fallback: null }, el(Parent))); const oldLease = enter(host), binding = host.physicalBinding();
  tick(0);
  const before = useJourneyStore.getState().getSnapshot(), commandCount = commands.length;
  React.act(() => renderer.flushSync(suspend)); assert.equal(frames.size, 0); assert.equal(host.runtime.currentLease(), null);
  await React.act(async () => { resolvePending(); await pending; });
  assert.equal(frames.size, 1); assert.ok(host.runtime.currentLease()); assert.notEqual(host.runtime.currentLease(), oldLease);
  const next = host.physicalBinding(); assert.notEqual(next.lease, binding.lease);
  assert.equal(next.port.read(next.lease, now).available, false); assert.equal(binding.port.publish(binding.lease, pose(500)), false);
  tick(500); assert.equal(authorizationLosses, 0, 'Retained layout reconnect renews the lease before the DOM scheduler samples');
  assert.equal(commands.length, commandCount); assert.deepEqual(useJourneyStore.getState().getSnapshot(), before);
  render(null); assert.equal(frames.size, 0);
});

test('actual host subscribers suspend between-frame settings/world/shell edges immediately', () => {
  fixture(); const cpu = mount(); enter(cpu.host); publish(cpu.host, 500); assert.equal(publish(cpu.host, 575).available, true);
  const edge = (down, up) => {
    now += 10; React.act(down); assert.equal(cpu.host.readPhysical(now).available, false);
    now += 10; React.act(up); assert.equal(cpu.host.readPhysical(now).available, false);
    publish(cpu.host, now + 10); assert.equal(cpu.host.readPhysical(now).available, false);
    assert.equal(publish(cpu.host, now + 75).available, true);
  };
  edge(() => useSettingsStore.getState().setDrawerOpen(true), () => useSettingsStore.getState().setDrawerOpen(false));
  edge(() => useWorldStore.getState().setMode('map'), () => useWorldStore.getState().setMode('explore'));
  edge(() => useWorldStore.getState().setPhysicsPaused(true), () => useWorldStore.getState().setPhysicsPaused(false));
  edge(() => useWorldStore.getState().setControls('none'), () => useWorldStore.getState().setControls('walk'));
  edge(() => cpu.configure({ overlayOpen: true }), () => cpu.configure({ overlayOpen: false }));
  cpu.unmount();
});

test('actual host lifecycle edges pause semantic continuous time and retain only witnessed sequence time', () => {
  for (const id of ['enchanted.meadow-warmth', 'epilogue.reverse-light-complete']) {
    const event = eventFixture(id), cpu = mount(), lease = enter(cpu.host, 'continue');
    const attention = cpu.host.runtime.beginAttention(lease, id); assert.ok(attention);
    tick(0); tick(500); assert.equal(cpu.host.runtime.readAttention(attention).elapsedMs, 500);
    now = 600; focused = false; windowTarget.dispatchEvent(new Event('blur'));
    assert.equal(cpu.host.runtime.readAttention(attention).elapsedMs, event.trigger === 'sequence-complete' ? 500 : 0);
    now = 700; focused = true; windowTarget.dispatchEvent(new Event('focus'));
    tick(900); assert.equal(cpu.host.runtime.readAttention(attention).elapsedMs, event.trigger === 'sequence-complete' ? 500 : 0);
    tick(1200); assert.equal(cpu.host.runtime.readAttention(attention).elapsedMs, event.trigger === 'sequence-complete' ? 800 : 300);
    now = 1250; windowTarget.dispatchEvent(new Event('pagehide')); now = 1300; windowTarget.dispatchEvent(new Event('pageshow'));
    const retained = cpu.host.runtime.readAttention(attention).elapsedMs; tick(1400);
    assert.equal(cpu.host.runtime.readAttention(attention).elapsedMs, retained, 'The page-hidden gap cannot contribute elapsed time');
    cpu.unmount();
  }
});

test('actual capture bridge cancels physical attention immediately without another camera sample', () => {
  const event = eventFixture('enchanted.meadow-warmth'), cpu = mount(), lease = enter(cpu.host, 'continue');
  cpu.host.physicalBinding(scope());
  publish(cpu.host, 500); let facts = publish(cpu.host, 600);
  assert.equal(facts.stillEligible, true);
  const attention = cpu.host.runtime.beginAttention(lease, event.id, 'physical'); assert.ok(attention);
  cpu.host.runtime.samplePhysicalAttention(attention, facts, 600, true);
  assert.equal(cpu.host.runtime.publishPhysicalAttention(lease, event.id, facts, true), true); tick(600);
  facts = publish(cpu.host, 700); cpu.host.runtime.samplePhysicalAttention(attention, facts, 700, true);
  assert.equal(cpu.host.runtime.readAttention(attention).elapsedMs, 100);
  cpu.host.runtime.publishPhysicalAttention(lease, event.id, facts, true); tick(700);
  const before = cpu.host.readPhysical(700); now = 710;
  const down = new Event('pointerdown', { cancelable: true }); Object.defineProperty(down, 'pointerId', { value: 7 });
  windowTarget.dispatchEvent(down); assert.equal(down.defaultPrevented, false);
  assert.equal(cpu.host.readPhysical(710).observedAtMs, before.observedAtMs); assert.equal(cpu.host.readPhysical(710).heldPointers, 1);
  assert.equal(cpu.host.runtime.readAttention(attention).elapsedMs, 0, 'Input cancels elapsed time before another pose or host tick');
  tick(750); assert.ok(!useJourneyStore.getState().completedStoryEventIds.includes(event.id));
  assert.equal(cpu.host.readPhysical(750).stillEligible, false); cpu.unmount();
});

test('actual unmounted provider rejects a late RAF callback and removes only its own lifetime', () => {
  const commands = fixture(), cpu = mount(); const callback = [...frames.values()][0];
  let unrelatedInputs = 0; const unrelated = () => { unrelatedInputs++; };
  windowTarget.addEventListener('keydown', unrelated);
  assert.equal(frames.size, 1); cpu.unmount(); const count = commands.length;
  callback(5000); assert.equal(frames.size, 0); assert.equal(commands.length, count);
  windowTarget.dispatchEvent(new Event('keydown')); assert.equal(unrelatedInputs, 1);
  assert.equal(windowTarget.listenerCount(), 1); assert.equal(documentTarget.listenerCount(), 0);
  windowTarget.removeEventListener('keydown', unrelated); assert.equal(windowTarget.listenerCount(), 0);
  assert.equal(cpu.host.physicalBinding(), null); assert.equal(cpu.host.runtime.dispatch({ type: 'begin' }).accepted, false);
});

test('actual Archive Continue/read navigation is explicit while ordinary actions and physical activity remain blocked', () => {
  fixture(fresh({ storyStarted: true })); const cpu = mount({ activity: { overlayOpen: true } });
  assert.equal(cpu.host.physicalActive(), false); assert.equal(cpu.host.runtime.dispatch({ type: 'continue' }).accepted, false);
  const continued = cpu.host.dispatchNavigation({ type: 'continue' }); assert.equal(continued.accepted, true, continued.reason);
  const observations = [], navigate = useJourneyStore.getState().navigateToEntry;
  useJourneyStore.setState({ navigateToEntry: entryId => { observations.push(cpu.host.physicalActive()); return navigate(entryId); } });
  const read = cpu.host.dispatchNavigation({ type: 'navigate', entryId: 'fragment-001', read: true });
  assert.equal(read.accepted, true, read.reason); assert.ok(useJourneyStore.getState().witnessedEntryIds.includes('fragment-001'));
  assert.deepEqual(observations, [false], 'The Archive exception never admits physical activity, including inside the command');
  assert.equal(cpu.host.physicalActive(), false); const lease = cpu.host.runtime.currentLease(), before = useJourneyStore.getState().getSnapshot();
  for (const intent of [{ type: 'read', entryId: 'fragment-001', lease }, { type: 'witness', entryId: 'fragment-001', lease },
    { type: 'event', eventId: 'broken-floor.first-wipe', lease }]) assert.equal(cpu.host.runtime.dispatch(intent).accepted, false);
  tick(500); assert.deepEqual(useJourneyStore.getState().getSnapshot(), before);
  useSettingsStore.getState().setDrawerOpen(true);
  assert.equal(cpu.host.dispatchNavigation({ type: 'continue' }).accepted, false, 'Settings remains authoritative during archive navigation');
  useSettingsStore.getState().setDrawerOpen(false); focused = false;
  assert.equal(cpu.host.dispatchNavigation({ type: 'continue' }).accepted, false, 'Foreground remains authoritative'); focused = true;
  cpu.configure({ ready: false }); assert.equal(cpu.host.dispatchNavigation({ type: 'continue' }).accepted, false, 'Readiness remains authoritative');
  cpu.unmount();
});

test('Archive keeps existing and newly prepared semantic/physical attention paused', () => {
  const event = eventFixture('enchanted.meadow-warmth'), cpu = mount(), lease = enter(cpu.host, 'continue');
  const semantic = cpu.host.runtime.beginAttention(lease, event.id); assert.ok(semantic);
  tick(0); tick(500); assert.equal(cpu.host.runtime.readAttention(semantic).elapsedMs, 500);
  cpu.configure({ overlayOpen: true }); assert.equal(cpu.host.runtime.readAttention(semantic).elapsedMs, 0);
  for (const source of ['semantic', 'physical']) {
    const token = cpu.host.runtime.beginAttention(lease, event.id, source); assert.ok(token);
    assert.equal(cpu.host.runtime.readAttention(token).paused, true);
    assert.equal(cpu.host.runtime.readAttention(token).elapsedMs, 0);
  }
  for (const kind of ['continue', 'navigate']) {
    const intent = kind === 'continue' ? { type: kind } : { type: kind, entryId: useJourneyStore.getState().activeEntryId, read: true };
    assert.equal(cpu.host.dispatchNavigation(intent).accepted, true);
    assert.equal(cpu.host.physicalActive(), false);
    const token = cpu.host.runtime.beginAttention(cpu.host.runtime.currentLease(), event.id, 'physical'); assert.ok(token);
    assert.equal(cpu.host.runtime.readAttention(token).paused, true);
  }
  tick(5000); assert.ok(!useJourneyStore.getState().completedStoryEventIds.includes(event.id)); cpu.unmount();
});

test('same-entry late cloud restore revokes Begin authority and returns to explicit Continue once', () => {
  // Restore can arrive before the first DOM sample or after a settled camera.
  // Neither timing may let the UI keep using an authority donated by Begin.
  for (const sampledBeforeRestore of [false, true]) {
    const commands = fixture(); let authorizationLosses = 0, continuationShown = false, cpu;
    cpu = mount({ strict: true, activity: { onAuthorizationLost: () => {
      authorizationLosses++; continuationShown = true;
      // Mirror the shell-only response in App. This never invokes a story command.
      cpu.configure({ participating: false, overlayOpen: false });
    } } });
    const begun = cpu.host.dispatchNavigation({ type: 'begin' }); assert.equal(begun.accepted, true, begun.reason);
    const oldLease = begun.lease, oldScope = scope(), oldBinding = cpu.host.physicalBinding(oldScope);
    publish(cpu.host, 500); const oldFacts = publish(cpu.host, 575); assert.equal(oldFacts.available, true);
    if (sampledBeforeRestore) tick(600);
    const commandCount = commands.length;
    const incoming = { ...useJourneyStore.getState().getSnapshot(), updatedAt: '2099-01-01T00:00:00.000Z' };
    now = 650;
    React.act(() => useJourneyStore.getState().hydrateJourney(incoming, { source: 'cloud' }));
    const restoredScope = scope(), restored = useJourneyStore.getState().getSnapshot();
    assert.equal(restoredScope.entryId, oldScope.entryId); assert.equal(restoredScope.sceneId, oldScope.sceneId);
    assert.equal(restoredScope.revision, oldScope.revision + 1, 'Actual hydration relocates even when its entry is unchanged');
    assert.equal(restored.updatedAt, incoming.updatedAt); assert.equal(cpu.host.runtime.currentLease(), null);
    assert.equal(cpu.host.physicalBinding(oldScope), null); assert.equal(cpu.host.physicalBinding(restoredScope), null);
    assert.equal(oldBinding.port.publish(oldBinding.lease, pose(675)), false);
    assert.equal(cpu.host.observeClearingPresence(oldScope, true), false);
    assert.equal(cpu.host.observeThresholdDistance(restoredScope, 'fragment-002', [0, 0, 0], 1), false);
    assert.equal(cpu.host.observeCrossing({ entryId: 'fragment-002', expectedEntryId: oldScope.entryId,
      targetPosition: [0, 0, 0], radiusSq: 1, onAccepted: () => assert.fail('A restored stale crossing must not be consumed') }), false);
    for (const intent of [{ type: 'read', entryId: oldScope.entryId, lease: oldLease },
      { type: 'witness', entryId: oldScope.entryId, lease: oldLease },
      { type: 'event', eventId: 'broken-floor.first-wipe', lease: oldLease },
      { type: 'ritual', ritualId: blueprint.JOURNEY_RITUAL_IDS[0], lease: oldLease }]) {
      assert.equal(cpu.host.runtime.dispatch(intent).accepted, false);
    }
    assert.equal(cpu.host.runtime.beginAttention(oldLease, 'broken-floor.first-wipe', 'physical'), null);
    assert.equal(cpu.host.runtime.publishPhysicalAttention(oldLease, 'broken-floor.first-wipe', oldFacts, true), false);
    assert.equal(commands.length, commandCount, 'Restore and all rejected adapters issue zero canonical commands');
    tick(700); assert.equal(authorizationLosses, 1); assert.equal(continuationShown, true);
    assert.equal(cpu.host.physicalActive(), false); assert.equal(cpu.host.runtime.currentLease(), null);
    for (const time of [800, 1400, 5000]) tick(time);
    assert.equal(authorizationLosses, 1, 'One revoked authorization causes one shell transition');
    assert.equal(commands.length, commandCount); assert.deepEqual(useJourneyStore.getState().getSnapshot(), restored);

    const continued = cpu.host.dispatchNavigation({ type: 'continue' }); assert.equal(continued.accepted, true, continued.reason);
    assert.notEqual(continued.lease, oldLease); cpu.configure({ participating: true });
    const next = cpu.host.physicalBinding(restoredScope); assert.ok(next); assert.notEqual(next.lease, oldBinding.lease);
    assert.equal(next.port.read(next.lease, now).available, false, 'Continue requires fresh camera poses after relocation');
    assert.equal(publish(cpu.host, 5100).available, false); assert.equal(publish(cpu.host, 5175).available, true);
    assert.equal(oldBinding.port.publish(oldBinding.lease, pose(5200)), false);
    tick(5250); assert.equal(authorizationLosses, 1); cpu.unmount();
  }
});

test('accepted explicit navigation replaces authority synchronously without a restore UI transition', () => {
  fixture(sceneFixture(blueprint.journeyScenes[1])); let authorizationLosses = 0;
  const cpu = mount({ activity: { onAuthorizationLost: () => { authorizationLosses++; } } });
  const continued = cpu.host.dispatchNavigation({ type: 'continue' }); assert.equal(continued.accepted, true, continued.reason);
  tick(0); const oldScope = scope(), oldBinding = cpu.host.physicalBinding(oldScope);
  const target = blueprint.journeyScenes[0].keystoneEntryId, observedDuringCommand = [];
  const navigate = useJourneyStore.getState().navigateToEntry;
  useJourneyStore.setState({ navigateToEntry: entryId => {
    observedDuringCommand.push(cpu.host.runtime.currentLease()); return navigate(entryId);
  } });
  const navigated = cpu.host.dispatchNavigation({ type: 'navigate', entryId: target, expectedEntryId: oldScope.entryId, read: true });
  assert.equal(navigated.accepted, true, navigated.reason); assert.deepEqual(observedDuringCommand, [null]);
  assert.equal(useJourneyStore.getState().activeEntryId, target); assert.ok(cpu.host.runtime.currentLease());
  assert.notEqual(cpu.host.runtime.currentLease(), continued.lease); assert.equal(cpu.host.physicalBinding(oldScope), null);
  assert.equal(oldBinding.port.publish(oldBinding.lease, pose(500)), false);
  for (const time of [500, 1000, 1500]) tick(time);
  assert.equal(authorizationLosses, 0, 'A transient null lease inside accepted navigation is not sampled as a lost authorization');
  assert.equal(cpu.host.physicalActive(), true); cpu.unmount();
});
