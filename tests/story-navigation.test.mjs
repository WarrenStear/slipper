import assert from 'node:assert/strict';
import test, { after, afterEach } from 'node:test';
import { readFileSync } from 'node:fs';
import { createRequire, register } from 'node:module';
import vm from 'node:vm';
import React from 'react';
import * as THREE from 'three';
import * as jsxRuntime from 'react/jsx-runtime';
import ts from 'typescript';

register('./canonical-node-loader.mjs', import.meta.url);
register('./quiet-tsx-loader.mjs', import.meta.url);
const require = createRequire(import.meta.url), Reconciler = require('react-reconciler');
const { ConcurrentRoot, DefaultEventPriority } = require('react-reconciler/constants');
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
let activeCpu, mountedReader;
afterEach(() => activeCpu?.unmount());
class RecordedTarget extends EventTarget {
  listeners = new Map();
  addEventListener(type, callback, options) {
    const bucket = this.listeners.get(type) ?? new Set(); bucket.add(callback); this.listeners.set(type, bucket);
    super.addEventListener(type, callback, options);
  }
  removeEventListener(type, callback, options) {
    const bucket = this.listeners.get(type); bucket?.delete(callback); if (!bucket?.size) this.listeners.delete(type);
    super.removeEventListener(type, callback, options);
  }
  count() { return [...this.listeners.values()].reduce((sum, bucket) => sum + bucket.size, 0); }
}
const oldGlobals = { window: globalThis.window, document: globalThis.document };
const windowTarget = new RecordedTarget(), documentTarget = new RecordedTarget(), storage = new Map(), frames = new Map();
const focusTimers = new Map();
let now = 0, focused = true, frameId = 0;
windowTarget.localStorage = { getItem: key => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, value), removeItem: key => storage.delete(key) };
windowTarget.matchMedia = () => ({ matches: false, addEventListener() {}, removeEventListener() {} });
windowTarget.location = { pathname: '/', search: '' };
windowTarget.history = { state: null, pushState(_state, _title, url) {
  const parsed = new URL(url, 'https://example.test'); windowTarget.location.pathname = parsed.pathname; windowTarget.location.search = parsed.search;
} };
windowTarget.requestAnimationFrame = callback => { const id = ++frameId; frames.set(id, callback); return id; };
windowTarget.cancelAnimationFrame = id => frames.delete(id);
windowTarget.setTimeout = callback => { const id = ++frameId; focusTimers.set(id, callback); return id; };
windowTarget.clearTimeout = id => focusTimers.delete(id);
documentTarget.hidden = false; documentTarget.hasFocus = () => focused; documentTarget.pointerLockElement = null;
documentTarget.documentElement = { dataset: {}, classList: { toggle() {}, contains: () => false } };
globalThis.window = windowTarget; globalThis.document = documentTarget;
after(() => { globalThis.window = oldGlobals.window; globalThis.document = oldGlobals.document; });

const { useJourneyStore } = await import('../src/stores/useJourneyStore.ts');
const commandNames = ['startStory', 'navigateToEntry', 'goBack', 'witnessEntry', 'enterBeat', 'completeScene', 'completeChapter',
  'dispatchStoryEvent', 'completeRitual', 'setWorldFlag', 'setLandmarkState', 'addResonance', 'awardLantern', 'recoverKey',
  'collectSymbolicObject', 'releaseWord', 'completeAct', 'completeStory', 'setSafePosition'];
const originalCommands = Object.fromEntries(commandNames.map(name => [name, useJourneyStore.getState()[name]]));
const commandTrace = [];
const { useSettingsStore } = await import('../src/stores/useSettingsStore.ts');
const { useWorldStore } = await import('../src/stores/useWorldStore.ts');
const blueprint = await import('../src/data/journeyBlueprint.ts');
const { entries } = await import('../src/data/slipperContent.ts');
const { entryWorldPosition } = await import('../src/lib/worldLayout.ts');
const { getNextEntry, getEntryAdjacency } = await import('../src/lib/storyGraph.ts');
const { getSlipperExperienceCapabilities } = await import('../src/lib/experienceMode.ts');
const { canReadStoryEntry } = await import('../src/narrative/StorySelectors.ts');
const { createFreshStoryJourneyState, sanitizeStoryJourneyState } = await import('../src/lib/storyJourneyState.ts');
const { NODE_ACTIVATION_RADIUS_SQ } = await import('../src/player/interactionProximity.ts');
const { getSceneManifestForEntry, resolveSceneManifestArrival } = await import('../src/narrative/StoryManifest.ts');
const { getJourneyEntryWorldPosition } = await import('../src/data/journeyWorldLayout.ts');
const { STORY_EVENTS, getAvailableStoryEvents } = await import('../src/storyEvents/storyEventRegistry.ts');
const { dispatchStoryEventState } = await import('../src/storyEvents/storyEventState.ts');
const { incompleteStoryJourney } = await import('../e2e/story-first-fixtures.ts');

// Execute both actual TSX owners with installed React and their real imports.
// Only the DOM/frame backend changes. Canonical command tracing delegates to the
// original real store methods without replacing their reducers or behavior.
async function actualOwner(relative, overrides = {}) {
  const url = new URL(relative, import.meta.url), source = readFileSync(url, 'utf8');
  const ast = ts.createSourceFile(relative, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const modules = { react: React, 'react/jsx-runtime': jsxRuntime, ...overrides };
  for (const node of ast.statements) if (ts.isImportDeclaration(node) && !node.importClause?.isTypeOnly) {
    const name = node.moduleSpecifier.text;
    if (name in modules) continue;
    try { modules[name] = await import(new URL(/\.[a-z]+$/i.test(name) ? name : `${name}.ts`, url)); }
    catch (error) {
      if (error.code !== 'ERR_MODULE_NOT_FOUND' || /\.[a-z]+$/i.test(name)) throw error;
      modules[name] = await import(new URL(`${name}.tsx`, url));
    }
  }
  const exports = {};
  vm.runInNewContext(ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022,
    module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText, {
    exports, require: name => { assert.ok(name in modules, `Unexpected actual owner dependency ${name}`); return modules[name]; },
    window: windowTarget, document: documentTarget, performance: { now: () => now },
  });
  return exports;
}
const { StoryRuntimeProvider, useStoryRuntimeShell } = await actualOwner('../src/experience/StoryRuntimeContext.tsx');
const { useStoryNavigation } = await actualOwner('../src/experience/useStoryNavigation.ts');
const { FragmentReader } = await actualOwner('../src/ui/reader/FragmentReader.tsx');
const appSource = readFileSync(new URL('../src/App.tsx', import.meta.url), 'utf8');
const appAst = ts.createSourceFile('App.tsx', appSource, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
let fragmentClick;
function readerBindings(node) {
  if (ts.isJsxAttribute(node) && node.name.getText(appAst) === 'onFragment') fragmentClick = node.initializer.expression.getText(appAst);
  ts.forEachChild(node, readerBindings);
}
readerBindings(appAst); assert.ok(fragmentClick);
const readerExports = {};
vm.runInNewContext(ts.transpileModule(`export function fragmentButton(useJourneyStore,navigateToEntry) { return (${fragmentClick}); }`,
  { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } }).outputText,
{ exports: readerExports });
const cloudFixtureSource = readFileSync(new URL('../e2e/story-first-experience.spec.ts', import.meta.url), 'utf8');
const cloudFixtureAst = ts.createSourceFile('story-first-experience.spec.ts', cloudFixtureSource, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
const cloudFixture = cloudFixtureAst.statements.find(node => ts.isFunctionDeclaration(node) && node.name?.text === 'restoredFirstWoodCloudJourney');
assert.ok(cloudFixture);
const cloudExports = {};
vm.runInNewContext(ts.transpileModule(`export ${cloudFixture.getText(cloudFixtureAst)}`,
  { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } }).outputText,
{ exports: cloudExports, ...blueprint, incompleteStoryJourney, STORY_EVENTS, dispatchStoryEventState });
const interactionFrames = new Set(), interactionCamera = new THREE.PerspectiveCamera(), interactionReports = [];
const { InteractionController } = await actualOwner('../src/player/InteractionController.tsx', { three: THREE,
  '@react-three/fiber': { useThree: () => ({ camera: interactionCamera }), useFrame(callback) {
    const ref = React.useRef(callback); ref.current = callback;
    React.useLayoutEffect(() => { interactionFrames.add(ref); return () => interactionFrames.delete(ref); }, []);
  } } });
const sceneSource = readFileSync(new URL('../src/components/three/StoryScene.tsx', import.meta.url), 'utf8');
const sceneAst = ts.createSourceFile('StoryScene.tsx', sceneSource, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
let thresholdCallback, clearingCallback;
function findThreshold(node) {
  if (ts.isVariableDeclaration(node) && node.name.getText(sceneAst) === 'handleObservedThreshold') thresholdCallback = node.initializer.arguments[0].getText(sceneAst);
  if (ts.isVariableDeclaration(node) && node.name.getText(sceneAst) === 'handleObservedClearing') clearingCallback = node.initializer.arguments[0].getText(sceneAst);
  ts.forEachChild(node, findThreshold);
}
findThreshold(sceneAst); assert.ok(thresholdCallback); assert.ok(clearingCallback);
const thresholdExports = {};
vm.runInNewContext(ts.transpileModule(`export function threshold(runtimeHost,narrativeScene,observation,onPortalSelect) { return (${thresholdCallback}); }
  export function clearing(runtimeHost,narrativeScene,entry,sceneRelocationRevision,NODE_ACTIVATION_RADIUS_SQ) { return (${clearingCallback}); }`,
  { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } }).outputText, { exports: thresholdExports });
const entryIds = Object.keys(blueprint.JOURNEY_ENTRY_PROGRESS);
const snapshotOptions = { fallbackEntryId: entryIds[0], validEntryIds: entryIds, entryProgress: blueprint.JOURNEY_ENTRY_PROGRESS,
  beatIdsByAct: blueprint.JOURNEY_BEAT_IDS_BY_ACT, ritualIds: blueprint.JOURNEY_RITUAL_IDS,
  worldFlagIds: blueprint.JOURNEY_WORLD_FLAG_IDS, landmarkIds: blueprint.JOURNEY_LANDMARK_IDS,
  recoveredKeyIds: blueprint.JOURNEY_RECOVERED_KEY_IDS, symbolicObjectIds: blueprint.JOURNEY_SYMBOLIC_OBJECT_IDS,
  now: () => '2026-10-06T10:00:00.000Z' };
const fresh = overrides => ({ ...createFreshStoryJourneyState(snapshotOptions), ...overrides });
function completed(overrides = {}) {
  return sanitizeStoryJourneyState(fresh({ activeEntryId: 'fragment-008', storyStarted: true, storyCompleted: true,
    completedActs: blueprint.journeyActs.map(act => act.id), completedSceneIds: blueprint.journeyScenes.map(scene => scene.id),
    completedChapterIds: blueprint.journeyChapters.map(chapter => chapter.id), completedRitualIds: blueprint.JOURNEY_RITUAL_IDS,
    worldFlags: Object.fromEntries(blueprint.JOURNEY_WORLD_FLAG_IDS.map(id => [id, true])),
    inventory: { lantern: true, recoveredKeys: blueprint.JOURNEY_RECOVERED_KEY_IDS, symbolicObjects: blueprint.JOURNEY_SYMBOLIC_OBJECT_IDS },
    witnessedEntryIds: ['fragment-001', 'fragment-008'], ...overrides }), snapshotOptions);
}
function seed(snapshot = fresh()) {
  assert.equal(frames.size, 0, 'Previous host scheduler cleaned up'); now = 0; focused = true; documentTarget.hidden = false;
  commandTrace.length = 0;
  interactionReports.length = 0; assert.equal(interactionFrames.size, 0);
  assert.equal(focusTimers.size, 0); mountedReader = null;
  windowTarget.location.pathname = '/'; windowTarget.location.search = '';
  useSettingsStore.setState({ drawerOpen: false, reducedMotion: true, audioEnabled: false });
  useWorldStore.setState({ mode: 'explore', controls: 'walk', physicsPaused: false, sceneProximity: null });
  useJourneyStore.setState({ ...snapshot, ...Object.fromEntries(commandNames.map(name => [name,
    (...args) => { commandTrace.push(name); return originalCommands[name](...args); }])), isInitialized: true, sceneRelocationRevision: 0,
    playerPosition: null, lastSafeEntryId: snapshot.activeEntryId });
}
const el = React.createElement;
const renderer = Reconciler({
  supportsMutation: true, isPrimaryRenderer: false, supportsPersistence: false, supportsHydration: false,
  getRootHostContext: () => null, getChildHostContext: () => null, getPublicInstance: value => value,
  createInstance(type,props) {
    const instance={type,props,children:[],focused:false,focuses:0,scrolls:0,scrollTop:0,scrollHeight:1000,clientHeight:200,
      focus(){this.focused=true;this.focuses++;},scrollTo({top}){this.scrollTop=top;this.scrolls++;}};
    if(props.role==='document')mountedReader=instance;
    return instance;
  }, createTextInstance: text => ({ text }),
  appendInitialChild: (parent, child) => parent.children.push(child), appendChild: (parent, child) => parent.children.push(child),
  appendChildToContainer: (parent, child) => parent.children.push(child),
  removeChild: (parent, child) => { parent.children = parent.children.filter(item => item !== child); },
  removeChildFromContainer: (parent, child) => { parent.children = parent.children.filter(item => item !== child); },
  insertBefore() {}, insertInContainerBefore() {}, finalizeInitialChildren: () => false,
  prepareForCommit: () => null, resetAfterCommit() {}, preparePortalMount() {},
  shouldSetTextContent: () => false, prepareUpdate: () => true, commitUpdate(instance,_payload,_type,_previous,next){instance.props=next;}, commitTextUpdate() {},
  hideInstance() {}, unhideInstance() {}, hideTextInstance() {}, unhideTextInstance() {},
  getCurrentEventPriority: () => DefaultEventPriority, beforeActiveInstanceBlur() {}, afterActiveInstanceBlur() {},
  detachDeletedInstance() {}, clearContainer: container => { container.children = []; },
  scheduleTimeout: setTimeout, cancelTimeout: clearTimeout, noTimeout: -1,
});
function mount(initial = {}) {
  const listenerBaseline = windowTarget.count() + documentTarget.count();
  let navigation, host, ui, setUi;
  const reader = { focused: false, focuses: 0, scrolls: 0,
    focus() { this.focused = true; this.focuses++; }, scrollTo() { this.scrolls++; } };
  function Capture() {
    const journey = useJourneyStore();
    const mode = useWorldStore(state => state.mode);
    [ui, setUi] = React.useState({ ready: true, experienceStarted: false, archiveOpen: false, prologueResolved: false,
      accessibleJourney: false, guidanceEntryId: null, guidanceStatus: '', sessionJourneyMode: null, sceneResetNonce: 0,
      readerFocusNonce: 0, allowActions: true, ...initial });
    host = useStoryRuntimeShell({ ready: ui.ready, participating: ui.experienceStarted, overlayOpen: ui.archiveOpen, allowActions: ui.allowActions });
    const set = key => value => setUi(current => ({ ...current, [key]: typeof value === 'function' ? value(current[key]) : value }));
    navigation = useStoryNavigation({ host, accessibleJourney: ui.accessibleJourney, audioEnabled: false,
      capabilities: getSlipperExperienceCapabilities(journey.storyCompleted ? 'free-woods' : ui.sessionJourneyMode ?? 'first-journey'),
      experienceStarted: ui.experienceStarted, archiveOpen: ui.archiveOpen, prologueResolved: ui.prologueResolved,
      guidanceEntryId: ui.guidanceEntryId, setGuidanceEntryId: set('guidanceEntryId'), setGuidanceStatus: set('guidanceStatus'),
      setArchiveOpen: set('archiveOpen'), setExperienceStarted: set('experienceStarted'),
      setSessionJourneyMode: set('sessionJourneyMode'), setSceneResetNonce: set('sceneResetNonce'),
      requestReaderFocus: () => set('readerFocusNonce')(value => value + 1) });
    const focusedDocument = mode === 'read' && canReadStoryEntry(journey.activeEntryId,journey)
      ? el(FragmentReader,{entry:entries.find(entry=>entry.id===journey.activeEntryId),witnessedEntryIds:journey.witnessedEntryIds,
        focusNonce:ui.readerFocusNonce,reducedMotion:false,showMetrics:true,kicker:'Current fragment',freeWoods:journey.storyCompleted,
        constellationScope:journey.storyCompleted?'full':'witnessed-only',canContinue:true,bookmarked:false,backAvailable:true,nextAvailable:true,
        onReturnToForest:()=>useWorldStore.getState().setMode('explore'),onFollow:()=>{},onSettings:()=>{},onConstellation:()=>{},
        onBookmark:()=>{},onBack:()=>{},onNext:()=>{},onContinue:()=>{},onArchive:()=>{}}):null;
    if (!ui.physicalController) return focusedDocument;
    const ids = [ui.controllerOriginId, ui.controllerTargetId], scope = { entryId: journey.activeEntryId, sceneId: journey.sceneId, revision: journey.sceneRelocationRevision };
    const observeThreshold = thresholdExports.threshold(host, blueprint.getJourneySceneForEntry(journey.activeEntryId),
      () => host.physicalBinding(scope), id => interactionReports.push({ id, queued: navigation.handlePortalSelect(id) }));
    const observeClearing = thresholdExports.clearing(host, blueprint.getJourneySceneForEntry(journey.activeEntryId),
      entries.find(entry => entry.id === journey.activeEntryId), journey.sceneRelocationRevision, NODE_ACTIVATION_RADIUS_SQ);
    return el(React.Fragment,null,focusedDocument,el(InteractionController, { enabled: true, clearingRadius: 8.8,
      targets: ids.map(id => ({ id, position: entryWorldPosition(entries.find(entry => entry.id === id), entries), active: id === journey.activeEntryId })),
      onSample: observeClearing, onTargetEntered: observeThreshold }));
  }
  const root = renderer.createContainer({ children: [] }, ConcurrentRoot, null, true, null, '', error => { throw error; }, null);
  const render = child => React.act(() => renderer.flushSync(() => renderer.updateContainer(child, root, null, null)));
  render(el(React.StrictMode, null, el(StoryRuntimeProvider, null, el(Capture))));
  activeCpu = { get navigation() { return navigation; }, get host() { return host; }, get ui() { return ui; },
    get reader(){return mountedReader??reader;},
    get readerProgress(){return mountedReader?.children.find(child=>child.props?.role==='progressbar')?.props['aria-valuenow']??0;},
    setReaderProgress(value){React.act(()=>{assert.ok(mountedReader);mountedReader.scrollTop=value/100*(mountedReader.scrollHeight-mountedReader.clientHeight);mountedReader.props.onScroll();});},
    flushFocus() { const pending = [...focusTimers.values()]; focusTimers.clear(); for (const callback of pending) callback(); },
    modeButton(mode) { assert.equal(mode,"read"); this.reader.focused = false; return readerExports.fragmentButton(useJourneyStore,navigation.navigateToEntry); },
    act: callback => React.act(callback), configure: patch => React.act(() => setUi(current => ({ ...current, ...patch }))),
    unmount() { render(null); activeCpu = null; assert.equal(frames.size, 0); assert.equal(interactionFrames.size, 0); assert.equal(focusTimers.size, 0);
      assert.equal(windowTarget.count() + documentTarget.count(), listenerBaseline); } };
  return activeCpu;
}
function key(value, extra = {}) {
  const event = new Event('keydown', { cancelable: true });
  for (const [name, data] of Object.entries({ key: value, code: `Key${value.toUpperCase()}`,
    target: { closest: () => null, isContentEditable: false }, ...extra })) Object.defineProperty(event, name, { value: data });
  windowTarget.dispatchEvent(event); return event;
}
const state = () => useJourneyStore.getState();
const snapshot = () => state().getSnapshot();
function pose(cpu, position, time) {
  now = time; const binding = cpu.host.physicalBinding(); assert.ok(binding);
  assert.equal(binding.port.publish(binding.lease, { observedAtMs: time, position, quaternion: [0, 0, 0, 1], inputEnabled: true, settled: true }), true);
  return binding;
}
function enter(cpu) { cpu.act(() => cpu.navigation.enterForest()); assert.equal(cpu.ui.experienceStarted, true); assert.ok(cpu.host.runtime.currentLease()); }
function tick(time) {
  now = time; const pending = [...frames.values()]; frames.clear();
  React.act(() => { for (const callback of pending) callback(time); });
}
const scope = () => ({ entryId: state().activeEntryId, sceneId: state().sceneId, revision: state().sceneRelocationRevision });
function armOutside(cpu, target, center, time = 100) {
  const outside = [center[0] + Math.sqrt(NODE_ACTIVATION_RADIUS_SQ) * 1.7, center[1], center[2]];
  pose(cpu, outside, time); pose(cpu, outside, time + 100);
  assert.equal(cpu.host.observeThresholdDistance(scope(), target.id, center, NODE_ACTIVATION_RADIUS_SQ), true,
    'A current fresh numeric receipt outside the target earns its crossing edge');
  return time + 200;
}

test('actual fresh hook/StrictMode mount and keyboard are observational until explicit Begin; locked/unknown clicks remain private', () => {
  seed(); const before = snapshot(), cpu = mount();
  assert.deepEqual(snapshot(), before); assert.equal(cpu.host.runtime.currentLease(), null);
  assert.deepEqual(commandTrace, []);
  cpu.act(() => { for (const value of ['f', 'm', 'b', 'ArrowRight']) key(value); });
  assert.deepEqual(snapshot(), before);
  cpu.act(() => { assert.equal(cpu.navigation.navigateToEntry('unknown', 'read'), false);
    assert.equal(cpu.navigation.navigateToEntry('fragment-066', 'read'), false); cpu.navigation.openArchive(); });
  assert.deepEqual(snapshot(), before); assert.equal(cpu.ui.archiveOpen, false);
  assert.deepEqual(commandTrace, [], 'Fresh rejected UI input must call no canonical store command');
  enter(cpu); assert.equal(state().storyStarted, true); assert.deepEqual(state().witnessedEntryIds, []);
  assert.equal(cpu.ui.sessionJourneyMode, 'first-journey');
  const begun = snapshot(); cpu.configure({ prologueResolved: true });
  cpu.act(() => { key('m'); key('b'); assert.equal(cpu.navigation.requestGuidance('fragment-066'), false); });
  assert.deepEqual(snapshot(), begun); assert.equal(useWorldStore.getState().mode, 'explore');
  cpu.unmount();
});

test('actual directed M/I remain blocked before witnessing, then toggle only the earned viewer without commands or saved progress', () => {
  for (const storyStarted of [false, true]) {
    seed(fresh({ storyStarted })); const cpu = mount({ prologueResolved: true }); enter(cpu);
    const capabilities = getSlipperExperienceCapabilities(cpu.ui.sessionJourneyMode);
    assert.equal(capabilities.constellationScope, 'witnessed-only');
    assert.equal(capabilities.allowConstellationView, true);
    assert.equal(capabilities.allowConstellationNavigation, false);
    assert.equal(capabilities.allowFullArchive, false);
    assert.equal(capabilities.showGenericNavigation, false);
    const unearned = snapshot(), unearnedCommands = commandTrace.length;
    assert.deepEqual(unearned.witnessedEntryIds, []);
    for (const value of ['m', 'i']) {
      cpu.act(() => assert.equal(key(value).defaultPrevented, false));
      assert.equal(useWorldStore.getState().mode, 'explore');
      assert.deepEqual(snapshot(), unearned);
      assert.equal(commandTrace.length, unearnedCommands);
    }
    const lease = cpu.host.runtime.currentLease();
    cpu.act(() => assert.equal(cpu.host.runtime.dispatch({ type: 'witness', entryId: state().activeEntryId, lease }).accepted, true));
    assert.deepEqual(state().witnessedEntryIds, [state().activeEntryId], 'Only an explicit canonical witness earns the viewer');
    const earned = snapshot(), saved = storage.get('sidtw:journey:v3'), commands = commandTrace.length, earnedScope = scope();
    assert.ok(saved, 'The comparison must include the real persisted journey envelope');
    const unchanged = () => {
      assert.deepEqual(snapshot(), earned);
      assert.equal(storage.get('sidtw:journey:v3'), saved);
      assert.equal(commandTrace.length, commands, 'Viewing and returning must issue no canonical navigation, witness, event, beat, or outcome command');
      assert.deepEqual(scope(), earnedScope);
      assert.equal(cpu.host.runtime.currentLease(), lease);
      assert.equal(cpu.ui.archiveOpen, false);
      assert.equal(cpu.ui.guidanceEntryId, null);
      assert.equal(windowTarget.location.pathname, '/');
    };
    cpu.act(() => assert.equal(key('m').defaultPrevented, true));
    assert.equal(useWorldStore.getState().mode, 'map'); assert.equal(cpu.host.physicalActive(), false); unchanged();
    cpu.act(() => assert.equal(key('i').defaultPrevented, true));
    assert.equal(useWorldStore.getState().mode, 'explore'); unchanged();
    cpu.act(() => { key('b'); key('ArrowRight'); cpu.navigation.openArchive(); });
    assert.equal(useWorldStore.getState().mode, 'explore'); unchanged();
    cpu.unmount();
  }
});

test('actual directed M/I cannot donate map dwell to an earned canonical attention event or persistence', () => {
  const event = STORY_EVENTS.find(item => item.id === 'enchanted.meadow-warmth'); assert.ok(event?.durationMs);
  const scene = blueprint.journeyScenes.find(item => item.id === event.sceneId); assert.ok(scene);
  const priorScenes = blueprint.journeyScenes.slice(0, blueprint.journeyScenes.indexOf(scene)).map(item => item.id);
  seed(sanitizeStoryJourneyState(fresh({ activeEntryId: scene.keystoneEntryId, storyStarted: true,
    completedSceneIds: priorScenes,
    completedChapterIds: blueprint.journeyChapters.filter(chapter => chapter.sceneIds.every(id => priorScenes.includes(id))).map(chapter => chapter.id),
    completedRitualIds: blueprint.JOURNEY_RITUAL_IDS,
    worldFlags: Object.fromEntries(blueprint.JOURNEY_WORLD_FLAG_IDS.map(id => [id, true])),
    inventory: { lantern: true, recoveredKeys: blueprint.JOURNEY_RECOVERED_KEY_IDS, symbolicObjects: blueprint.JOURNEY_SYMBOLIC_OBJECT_IDS },
    completedStoryEventIds: STORY_EVENTS.filter(item => item.sceneId === scene.id && item.id !== event.id).map(item => item.id),
  }), snapshotOptions));
  const cpu = mount({ prologueResolved: true }); enter(cpu); assert.equal(cpu.ui.sessionJourneyMode, 'returning-journey');
  const lease = cpu.host.runtime.currentLease();
  cpu.act(() => assert.equal(cpu.host.runtime.dispatch({ type: 'witness', entryId: state().activeEntryId, lease }).accepted, true));
  assert.ok(getAvailableStoryEvents(state()).some(item => item.id === event.id));
  const attention = cpu.host.runtime.beginAttention(lease, event.id); assert.ok(attention);
  tick(0); tick(500); assert.equal(cpu.host.runtime.readAttention(attention).elapsedMs, 500);
  const before = snapshot(), saved = storage.get('sidtw:journey:v3'), commands = commandTrace.length;
  cpu.act(() => key('m')); assert.equal(useWorldStore.getState().mode, 'map');
  assert.equal(cpu.host.runtime.readAttention(attention).paused, true);
  assert.equal(cpu.host.runtime.readAttention(attention).elapsedMs, 0, 'Viewing interrupts continuous attention immediately');
  for (let time = 1000; time <= event.durationMs + 2500; time += 500) tick(time);
  assert.equal(cpu.host.runtime.readAttention(attention).elapsedMs, 0);
  assert.equal(cpu.host.runtime.readAttention(attention).completed, false);
  assert.deepEqual(snapshot(), before); assert.equal(storage.get('sidtw:journey:v3'), saved); assert.equal(commandTrace.length, commands);
  cpu.act(() => key('i')); assert.equal(useWorldStore.getState().mode, 'explore');
  tick(now + 500);
  assert.equal(cpu.host.runtime.readAttention(attention).elapsedMs, 0, 'Returning re-primes the clock; map time cannot be credited');
  assert.equal(cpu.host.runtime.readAttention(attention).completed, false);
  assert.deepEqual(snapshot(), before); assert.equal(storage.get('sidtw:journey:v3'), saved); assert.equal(commandTrace.length, commands);
  assert.equal(cpu.host.runtime.currentLease(), lease); assert.equal(state().activeEntryId, scene.keystoneEntryId);
  cpu.unmount();
});

test('actual completed-journey M/I retain the full viewer capability without changing earned progress', () => {
  seed(completed()); const cpu = mount({ prologueResolved: true }); enter(cpu);
  const capabilities = getSlipperExperienceCapabilities('free-woods');
  assert.equal(capabilities.constellationScope, 'full'); assert.equal(capabilities.allowConstellationNavigation, true);
  assert.equal(capabilities.allowFullArchive, true); assert.equal(capabilities.showGenericNavigation, true);
  const before = snapshot(), saved = storage.get('sidtw:journey:v3'), commands = commandTrace.length;
  cpu.act(() => key('m')); assert.equal(useWorldStore.getState().mode, 'map');
  cpu.act(() => key('i')); assert.equal(useWorldStore.getState().mode, 'explore');
  assert.deepEqual(snapshot(), before); assert.equal(storage.get('sidtw:journey:v3'), saved); assert.equal(commandTrace.length, commands);
  cpu.unmount();
});

test('actual retained keyboard/click callbacks consult latest canonical state and ignore interactive/modifier/Settings input', () => {
  seed(completed()); const cpu = mount({ prologueResolved: true }); enter(cpu);
  const callback = cpu.navigation.continueToNext, stable = cpu.navigation;
  const first = getNextEntry(entries, state().activeEntryId).id;
  cpu.act(() => callback()); assert.equal(state().activeEntryId, first); assert.equal(cpu.navigation, stable);
  const second = getNextEntry(entries, state().activeEntryId).id;
  cpu.act(() => { useWorldStore.getState().setMode('read'); key('ArrowRight'); });
  assert.equal(state().activeEntryId, second);
  const before = snapshot();
  cpu.act(() => { key('ArrowRight', { ctrlKey: true }); key('b', { target: { closest: () => ({}), isContentEditable: false } });
    useSettingsStore.getState().setDrawerOpen(true); key('f'); key('b'); });
  assert.deepEqual(snapshot(), before);
  cpu.act(() => useSettingsStore.getState().setDrawerOpen(false));
  cpu.act(() => key('b')); assert.equal(state().activeEntryId, first);
  cpu.unmount();
});

test('actual archive buttons hand off explicit witnessed navigation while physical/event actions and Settings stay blocked', () => {
  seed(completed()); const cpu = mount({ archiveOpen: true, prologueResolved: true });
  windowTarget.location.pathname = '/archive';
  assert.equal(cpu.host.physicalActive(), false);
  const before = snapshot();
  cpu.act(() => cpu.navigation.openRememberedEntry('fragment-002', 'read'));
  assert.deepEqual(snapshot(), before); assert.equal(cpu.ui.archiveOpen, true, 'Unwitnessed remembered links cannot disclose or close the archive');
  cpu.act(() => cpu.navigation.enterForest()); assert.equal(cpu.ui.archiveOpen, false); assert.equal(cpu.ui.experienceStarted, true);
  cpu.configure({ archiveOpen: true });
  const lease = cpu.host.runtime.currentLease(); assert.ok(lease);
  assert.equal(cpu.host.runtime.dispatch({ type: 'read', entryId: state().activeEntryId, lease }).accepted, false);
  assert.equal(cpu.host.physicalActive(), false);
  cpu.act(() => useSettingsStore.getState().setDrawerOpen(true));
  const settingsSnapshot = snapshot(); cpu.act(() => cpu.navigation.openRememberedEntry('fragment-001', 'read'));
  assert.deepEqual(snapshot(), settingsSnapshot); assert.equal(cpu.ui.archiveOpen, true);
  cpu.act(() => useSettingsStore.getState().setDrawerOpen(false));
  cpu.act(() => cpu.navigation.openRememberedEntry('fragment-001', 'read'));
  assert.equal(state().activeEntryId, 'fragment-001'); assert.equal(cpu.ui.archiveOpen, false);
  assert.equal(useWorldStore.getState().mode, 'read'); assert.equal(windowTarget.location.pathname, '/');
  assert.equal(canReadStoryEntry('fragment-001', state()), true); assert.equal(canReadStoryEntry('fragment-002', state()), false);
  cpu.unmount();
});

test('F from the actual map uses explicit current-entry reading without enabling map physical attention', () => {
  seed(completed()); const cpu = mount({ prologueResolved: true }); enter(cpu);
  cpu.act(() => { useWorldStore.getState().setMode('map'); }); assert.equal(cpu.host.physicalActive(), false);
  const active = state().activeEntryId;
  cpu.act(() => key('f')); assert.equal(useWorldStore.getState().mode, 'read'); assert.equal(state().activeEntryId, active);
  assert.equal(canReadStoryEntry(active, state()), true); cpu.unmount();
});

test('actual Fragment button and repeated F refocus accepted current reading without resetting scroll or saved progress', () => {
  seed(completed()); const cpu = mount({ prologueResolved: true }); enter(cpu);
  cpu.act(cpu.modeButton('read')); cpu.flushFocus();
  assert.equal(useWorldStore.getState().mode, 'read'); assert.equal(cpu.reader.focused, true);
  const initialLease = cpu.host.runtime.currentLease(), before = snapshot(), scrolls = cpu.reader.scrolls;
  cpu.setReaderProgress(72);
  assert.equal(cpu.readerProgress,72,'Actual owned reader records its scroll progress');
  for (const activate of [() => cpu.modeButton('read')(), () => key('f')]) {
    const priorFocuses = cpu.reader.focuses, priorNonce = cpu.ui.readerFocusNonce;
    cpu.reader.focused = false; cpu.act(activate); cpu.flushFocus();
    assert.equal(cpu.reader.focused, true); assert.equal(cpu.reader.focuses, priorFocuses + 1);
    assert.equal(cpu.ui.readerFocusNonce, priorNonce + 1); assert.equal(cpu.readerProgress, 72);
    assert.equal(cpu.reader.scrolls, scrolls, 'Repeated activation focuses the existing document without resetting its reading position');
    assert.deepEqual(snapshot(), before); assert.notEqual(cpu.host.runtime.currentLease(), initialLease);
  }
  assert.equal(canReadStoryEntry('fragment-002', state()), false, 'Refocusing cannot disclose another unwitnessed fragment');
  cpu.unmount();
});

test('actual Fragment button and read callbacks keep private/unready/background/Settings guards before focus', () => {
  seed(); const freshCpu = mount({ prologueResolved: true }); const untouched = snapshot();
  freshCpu.act(freshCpu.modeButton('read')); freshCpu.flushFocus();
  assert.equal(freshCpu.reader.focused, false); assert.equal(freshCpu.ui.readerFocusNonce, 0);
  assert.equal(useWorldStore.getState().mode, 'explore'); assert.deepEqual(snapshot(), untouched);
  assert.deepEqual(commandTrace, []); freshCpu.unmount();
  seed(completed()); const cpu = mount({ prologueResolved: true }); enter(cpu);
  cpu.act(cpu.modeButton('read')); cpu.flushFocus();
  const currentRead = cpu.navigation.readActiveEntry;
  for (const edge of ['arrival', 'background', 'settings', 'unready']) {
    if (edge === 'arrival') { cpu.act(() => useWorldStore.getState().setMode('explore')); cpu.configure({ allowActions: false }); }
    if (edge === 'background') focused = false;
    if (edge === 'settings') cpu.act(() => useSettingsStore.getState().setDrawerOpen(true));
    if (edge === 'unready') cpu.configure({ ready: false });
    const before = snapshot(), commands = commandTrace.length, nonce = cpu.ui.readerFocusNonce;
    cpu.reader.focused = false; cpu.act(() => assert.equal(currentRead(), false)); cpu.flushFocus();
    assert.equal(cpu.reader.focused, false, edge); assert.equal(cpu.ui.readerFocusNonce, nonce, edge);
    assert.deepEqual(snapshot(), before, edge); assert.equal(commandTrace.length, commands, edge);
    if (edge === 'arrival') cpu.configure({ allowActions: true });
    if (edge === 'background') focused = true;
    if (edge === 'settings') cpu.act(() => useSettingsStore.getState().setDrawerOpen(false));
    if (edge === 'unready') cpu.configure({ ready: true });
  }
  cpu.act(() => assert.equal(currentRead(), true)); cpu.flushFocus(); assert.equal(cpu.reader.focused, true);
  cpu.unmount();
});

test('actual remote fixture earns only the opening through canonical reducers before one explicit first-wood Continue', () => {
  const remote = cloudExports.restoredFirstWoodCloudJourney(), opening = blueprint.journeyScenes[0], next = blueprint.journeyScenes[1];
  const canonical = sanitizeStoryJourneyState(remote, snapshotOptions), context = blueprint.JOURNEY_ENTRY_PROGRESS[next.keystoneEntryId];
  assert.deepEqual(canonical.completedSceneIds, [opening.id]);
  assert.deepEqual(canonical.witnessedEntryIds, [opening.keystoneEntryId]);
  assert.equal(canonical.activeEntryId, next.keystoneEntryId);
  for (const field of ['actId', 'chapterId', 'sceneId', 'beatId']) assert.equal(canonical[field], context[field]);
  assert.deepEqual(canonical.completedStoryEventIds, STORY_EVENTS.filter(event => event.sceneId === opening.id).map(event => event.id));
  assert.equal(canonical.storyObjectStates['broken-floor.reflection'], 'inverted');
  assert.equal(canonical.inventory.lantern, true); assert.equal(canonical.resonances.seer, 6);
  assert.deepEqual(canonical.completedRitualIds, ['ritual.accept-lantern']);
  seed(canonical); const before = snapshot(), cpu = mount({ accessibleJourney: true, prologueResolved: true });
  assert.deepEqual(commandTrace, []); assert.deepEqual(snapshot(), before); enter(cpu);
  assert.equal(state().activeEntryId, next.keystoneEntryId); assert.equal(state().sceneId, next.id);
  assert.deepEqual(state().witnessedEntryIds, [opening.keystoneEntryId]);
  assert.deepEqual(state().completedSceneIds, [opening.id]); assert.deepEqual(state().completedRitualIds, ['ritual.accept-lantern']);
  assert.ok(commandTrace.includes('startStory')); assert.ok(!commandTrace.includes('navigateToEntry'));
  assert.equal(canReadStoryEntry(next.keystoneEntryId, state()), false, 'The cloud arrival does not manufacture a future witness');
  cpu.unmount();
});

test('actual crossing reports issue no canonical command until DOM RAF; stale/far/replayed poses cannot navigate or witness', () => {
  seed(completed()); const cpu = mount({ prologueResolved: true }); enter(cpu);
  const target = entries.find(entry => entry.id === 'fragment-001'), center = entryWorldPosition(target, entries);
  const before = snapshot();
  const commandsBeforeReports = commandTrace.length;
  cpu.act(() => { assert.equal(cpu.navigation.handlePortalSelect(target.id), false); assert.equal(cpu.navigation.handlePortalSelect('unknown'), false); });
  assert.deepEqual(snapshot(), before);
  pose(cpu, center, 100); pose(cpu, center, 200); now = 1201;
  cpu.act(() => assert.equal(cpu.navigation.handlePortalSelect(target.id), false)); assert.deepEqual(snapshot(), before);
  pose(cpu, [center[0] + 100, center[1], center[2]], 1300); pose(cpu, [center[0] + 100, center[1], center[2]], 1400);
  assert.equal(cpu.host.observeThresholdDistance(scope(), target.id, center, NODE_ACTIVATION_RADIUS_SQ), true);
  cpu.act(() => assert.equal(cpu.navigation.handlePortalSelect(target.id), true)); assert.deepEqual(snapshot(), before);
  tick(1410); assert.deepEqual(snapshot(), before, 'DOM scheduler rejects the current far-away numeric pose');
  const old = pose(cpu, center, 1500); pose(cpu, center, 1600);
  cpu.act(() => assert.equal(cpu.navigation.handlePortalSelect(target.id), true));
  assert.deepEqual(snapshot(), before, 'A render-frame crossing report cannot issue a story/store command');
  assert.equal(commandTrace.length, commandsBeforeReports, 'No canonical command may run on threshold enqueue');
  assert.equal(cpu.ui.guidanceEntryId, null); assert.equal(state().playerPosition, null);
  tick(1610);
  assert.equal(state().activeEntryId, target.id); assert.deepEqual(state().playerPosition, center);
  assert.deepEqual(state().witnessedEntryIds, before.witnessedEntryIds, 'Crossing is navigation, not a prose witness');
  assert.equal(old.port.publish(old.lease, { observedAtMs: 1700, position: center, quaternion: [0, 0, 0, 1], inputEnabled: true, settled: true }), false);
  const crossed = snapshot(); cpu.act(() => assert.equal(cpu.navigation.handlePortalSelect(target.id), false)); assert.deepEqual(snapshot(), crossed);
  cpu.unmount();
});

test('queued crossings re-read pose freshness and current distance and are cancelled by Settings, scope relocation, explicit navigation and unmount', () => {
  for (const edge of ['age', 'move', 'settings', 'relocation', 'explicit', 'unmount']) {
    seed(completed()); const cpu = mount({ prologueResolved: true }); enter(cpu);
    const target = entries.find(entry => entry.id === 'fragment-001'), center = entryWorldPosition(target, entries);
    armOutside(cpu, target, center, 0); pose(cpu, center, 150); pose(cpu, center, 200);
    cpu.act(() => assert.equal(cpu.navigation.handlePortalSelect(target.id), true));
    const before = snapshot();
    if (edge === 'move') { pose(cpu, [center[0] + 100, center[1], center[2]], 250); pose(cpu, [center[0] + 100, center[1], center[2]], 300); }
    if (edge === 'settings') cpu.act(() => useSettingsStore.getState().setDrawerOpen(true));
    if (edge === 'relocation') cpu.act(() => useJourneyStore.setState({ sceneRelocationRevision: state().sceneRelocationRevision + 1 }));
    if (edge === 'explicit') cpu.act(() => assert.equal(cpu.navigation.navigateToEntry('fragment-008', 'explore'), true));
    if (edge === 'unmount') { cpu.unmount(); cpu.host.sample(210); }
    else tick(edge === 'age' ? 1201 : 310);
    assert.equal(state().activeEntryId, before.activeEntryId, edge);
    assert.equal(state().playerPosition, null, `${edge}: cancelled report cannot write a safe position`);
    assert.deepEqual(state().witnessedEntryIds, before.witnessedEntryIds, edge);
    if (edge !== 'unmount') {
      const cancelled = snapshot();
      if (edge === 'settings') cpu.act(() => useSettingsStore.getState().setDrawerOpen(false));
      tick(1400); assert.deepEqual(snapshot(), cancelled, `${edge}: consumed or cancelled report cannot replay later`);
      cpu.unmount();
    }
  }
});

test('actual inactive-target crossing uses its own fresh numeric distance even when another scene node is nearer', () => {
  const radius = Math.sqrt(NODE_ACTIVATION_RADIUS_SQ);
  let pair;
  search: for (const target of entries) for (const neighbor of entries) {
    if (neighbor === target) continue;
    const a = entryWorldPosition(target, entries), b = entryWorldPosition(neighbor, entries), distance = Math.hypot(a[0] - b[0], a[2] - b[2]);
    if (distance > .1 && distance < radius * 1.8) { pair = { target, neighbor, a, b, distance }; break search; }
  }
  assert.ok(pair, 'Canonical authored/echo positions contain an actual overlapping activation neighborhood');
  const position = [pair.a[0] + (pair.b[0] - pair.a[0]) * .6, pair.a[1], pair.a[2] + (pair.b[2] - pair.a[2]) * .6];
  assert.ok(Math.hypot(position[0] - pair.a[0], position[2] - pair.a[2]) < radius);
  assert.ok(Math.hypot(position[0] - pair.b[0], position[2] - pair.b[2]) < Math.hypot(position[0] - pair.a[0], position[2] - pair.a[2]));
  const active = entries.find(entry => entry.id !== pair.target.id && entry.id !== pair.neighbor.id).id;
  seed(completed({ activeEntryId: active })); const cpu = mount({ prologueResolved: true }); enter(cpu);
  armOutside(cpu, pair.target, pair.a, 0);
  cpu.act(() => useWorldStore.setState({ sceneProximity: { nearestEntryId: pair.neighbor.id, nearestDistance: 0, playerPosition: position } }));
  pose(cpu, position, 150); pose(cpu, position, 200);
  const before = snapshot();
  cpu.act(() => assert.equal(cpu.navigation.handlePortalSelect(pair.target.id), true));
  assert.deepEqual(snapshot(), before);
  tick(210);
  assert.equal(state().activeEntryId, pair.target.id); cpu.unmount();
});

test('actual host admits scoped clearing presence only after Begin and two fresh numeric poses on DOM RAF', () => {
  seed(); const cpu = mount(), initial = snapshot();
  const scope = () => ({ entryId: state().activeEntryId, sceneId: state().sceneId, revision: state().sceneRelocationRevision });
  assert.equal(cpu.host.observeClearingPresence(scope(), true), true);
  assert.deepEqual(commandTrace, []); tick(0); assert.deepEqual(snapshot(), initial); assert.deepEqual(commandTrace, []);
  enter(cpu); const current = scope(), begun = snapshot(), admittedCommands = commandTrace.length;
  assert.equal(cpu.host.observeClearingPresence({ ...current, revision: current.revision + 1 }, true), false);
  assert.equal(cpu.host.observeClearingPresence(current, true), true);
  assert.equal(commandTrace.length, admittedCommands, 'A scoped geometry report cannot issue a canonical command');
  tick(50); assert.deepEqual(snapshot(), begun); assert.equal(commandTrace.length, admittedCommands);
  pose(cpu, [0, 1.7, 0], 100); tick(110);
  assert.deepEqual(snapshot(), begun); assert.equal(commandTrace.length, admittedCommands, 'One unprimed numeric pose cannot witness');
  // No new proximity/UI signature is reported between the two poses.
  pose(cpu, [0, 1.7, 0], 200);
  assert.deepEqual(snapshot(), begun); assert.equal(commandTrace.length, admittedCommands);
  tick(210); assert.deepEqual(state().witnessedEntryIds, ['fragment-001']); assert.equal(canReadStoryEntry('fragment-001', state()), true);
  const count = commandTrace.length; tick(220); assert.equal(commandTrace.length, count, 'A duplicate pose cannot apply another canonical command');
  cpu.unmount();
});

test('actual031/048 default and saved-inside arrivals remain stationary/private until an earned outside-to-inside crossing', () => {
  const target = entries.find(entry => entry.id === 'fragment-032'), center = entryWorldPosition(target, entries);
  for (const originId of ['fragment-031', 'fragment-048']) for (const saved of [false, true]) {
    const manifest = getSceneManifestForEntry(originId), anchor = getJourneyEntryWorldPosition(manifest.keystoneEntryId);
    const inside = resolveSceneManifestArrival(manifest, anchor, manifest.layout.anchor.headingRadians).position;
    assert.equal(manifest.keystoneEntryId, target.id);
    assert.ok(Math.abs(Math.hypot(inside[0] - center[0], inside[2] - center[2]) - 2.7) < 1e-10,
      'Execute the real authored arrival that reproduced the implicit crossing');
    seed(completed({ activeEntryId: originId }));
    if (saved) useJourneyStore.setState({ playerPosition: [...inside], lastSafeEntryId: originId });
    const cpu = mount({ prologueResolved: true, physicalController: true, controllerOriginId: originId, controllerTargetId: target.id }); enter(cpu);
    interactionCamera.position.set(...inside);
    const frame = time => cpu.act(() => { for (const ref of interactionFrames) ref.current({ clock: { elapsedTime: time } }); });
    const before = snapshot(), count = commandTrace.length, savedBefore = state().playerPosition;
    frame(0); assert.equal(interactionReports.at(-1).queued, false);
    pose(cpu, inside, 100); frame(.1); pose(cpu, inside, 200); frame(.2);
    assert.equal(interactionReports.at(-1).queued, false, 'Two fresh stationary inside samples cannot arm a crossing');
    tick(210); assert.deepEqual(snapshot(), before); assert.equal(commandTrace.length, count);
    assert.deepEqual(state().playerPosition, savedBefore); assert.equal(canReadStoryEntry(target.id, state()), false);
    const outside = [center[0] + Math.sqrt(NODE_ACTIVATION_RADIUS_SQ) * 1.7, inside[1], center[2]];
    interactionCamera.position.set(...outside);
    pose(cpu, outside, 300); frame(.3); pose(cpu, outside, 400); frame(.4);
    interactionCamera.position.set(...inside);
    pose(cpu, inside, 500); frame(.5); pose(cpu, inside, 600); frame(.6);
    assert.equal(interactionReports.at(-1).queued, true);
    assert.deepEqual(snapshot(), before); assert.equal(commandTrace.length, count, 'Actual R3F callbacks only report geometry/numeric facts');
    cpu.act(() => useSettingsStore.getState().setDrawerOpen(true)); tick(610); assert.deepEqual(snapshot(), before);
    cpu.act(() => useSettingsStore.getState().setDrawerOpen(false));
    pose(cpu, inside, 700); frame(.7); pose(cpu, inside, 800); frame(.8);
    assert.equal(interactionReports.at(-1).queued, false, 'Settings/restore clears the old outside receipt; remaining inside cannot replay it');
    tick(810); assert.deepEqual(snapshot(), before); assert.equal(commandTrace.length, count);
    interactionCamera.position.set(...outside);
    pose(cpu, outside, 900); frame(.9); pose(cpu, outside, 1000); frame(1);
    interactionCamera.position.set(...inside);
    pose(cpu, inside, 1100); frame(1.1); pose(cpu, inside, 1200); frame(1.2);
    assert.equal(interactionReports.at(-1).queued, true); assert.deepEqual(snapshot(), before); assert.equal(commandTrace.length, count);
    tick(1210); assert.equal(state().activeEntryId, target.id); assert.deepEqual(state().playerPosition, inside);
    assert.deepEqual(state().witnessedEntryIds, before.witnessedEntryIds, 'Accepted crossing still does not disclose the target prose');
    const reports = interactionReports.filter(report => report.id === target.id).length;
    frame(1.3); frame(1.4); assert.equal(interactionReports.filter(report => report.id === target.id).length, reports);
    assert.equal(interactionFrames.size, 1); cpu.unmount();
  }
});

test('actual anonymous full Guide status remains private until canonical witness while retaining the exact route and current-read continuity',()=>{
  seed(completed());const cpu=mount({prologueResolved:true});enter(cpu);
  const target=entries.find(entry=>entry.id==='fragment-012');assert.ok(target);
  const before=snapshot(),commands=commandTrace.length;
  cpu.act(()=>assert.equal(cpu.navigation.requestGuidance(target.id),true));
  assert.equal(cpu.ui.guidanceEntryId,target.id);assert.equal(cpu.ui.guidanceStatus,'Lantern guidance active: An unread memory');
  assert.equal(cpu.ui.guidanceStatus.includes(target.title),false);assert.deepEqual(snapshot(),before);assert.equal(commandTrace.length,commands);
  cpu.act(()=>useJourneyStore.setState({witnessedEntryIds:[...state().witnessedEntryIds,target.id]}));
  const earned=snapshot();cpu.act(()=>assert.equal(cpu.navigation.requestGuidance(target.id),true));
  assert.equal(cpu.ui.guidanceStatus,`Lantern guidance active: ${target.title}`);assert.deepEqual(snapshot(),earned);
  cpu.unmount();
});


test('actual anonymous guidance, accepted crossing and safe return never read an unwitnessed target title getter',()=>{
  seed(completed());const cpu=mount({prologueResolved:true});enter(cpu);
  const target=entries.find(entry=>entry.id==='fragment-012'),center=entryWorldPosition(target,entries);
  const descriptor=Object.getOwnPropertyDescriptor(target,'title');
  Object.defineProperty(target,'title',{configurable:true,get(){throw Error('Unwitnessed navigation title was read');}});
  try {
    const before=snapshot();cpu.act(()=>assert.equal(cpu.navigation.requestGuidance(target.id),true));
    assert.equal(cpu.ui.guidanceStatus,'Lantern guidance active: An unread memory');assert.deepEqual(snapshot(),before);
    armOutside(cpu,target,center,0);pose(cpu,center,250);pose(cpu,center,300);
    cpu.act(()=>assert.equal(cpu.navigation.handlePortalSelect(target.id),true));assert.deepEqual(snapshot(),before);
    tick(310);assert.equal(state().activeEntryId,target.id);assert.deepEqual(state().playerPosition,center);
    assert.deepEqual(state().witnessedEntryIds,before.witnessedEntryIds);assert.equal(cpu.ui.guidanceStatus,'Arrived at an unread memory.');
    const crossed=snapshot();cpu.act(()=>cpu.navigation.returnToLastClearing());
    assert.equal(cpu.ui.guidanceStatus,'Returned safely to the current clearing.');assert.deepEqual(snapshot(),crossed);
  } finally { Object.defineProperty(target,'title',descriptor);cpu.unmount(); }
});
