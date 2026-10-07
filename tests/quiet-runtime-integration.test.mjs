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
    modules[name] = await import(new URL(/\.[a-z]+$/i.test(name) ? name : `${name}.ts`, url));
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
    fragmentButton() { return readerExports.fragmentButton(useJourneyStore,navigation.navigateToEntry); },
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

test('actual candidate Fragment callback uses bounded explicit host navigation from Memories, preserves reader focus and never admits physical actions through the overlay', () => {
  seed(completed()); const cpu = mount({ prologueResolved:true }); enter(cpu);
  cpu.act(()=>assert.equal(cpu.navigation.requestGuidance('fragment-012'),true));
  assert.equal(cpu.ui.guidanceEntryId,'fragment-012');
  const acceptedEntry=state().activeEntryId, before=snapshot(), oldLease=cpu.host.runtime.currentLease();
  cpu.configure({archiveOpen:true});
  const commands=commandTrace.length;
  assert.equal(cpu.host.physicalActive(),false);
  assert.equal(cpu.host.runtime.dispatch({type:'read',entryId:acceptedEntry,lease:oldLease}).accepted,false);
  assert.equal(cpu.host.runtime.dispatch({type:'event',eventId:'enchanted.meadow-warmth',lease:oldLease}).accepted,false);
  key('f'); key('m'); key('b');
  assert.deepEqual(snapshot(),before); assert.equal(commandTrace.length,commands);
  cpu.act(()=>assert.equal(cpu.fragmentButton()(),true));
  assert.equal(useWorldStore.getState().mode,'read'); assert.equal(state().activeEntryId,acceptedEntry);
  cpu.flushFocus(); assert.equal(cpu.reader.focused,true); assert.ok(cpu.reader.focuses>0);
  assert.equal(cpu.ui.guidanceEntryId,'fragment-012','Current Fragment retains the selected physical destination');
  for(const field of ['witnessedEntryIds','completedStoryEventIds','completedRitualIds','completedSceneIds','completedChapterIds','storyObjectStates','storyPlacementStates','inventory','worldFlags','resonances','releasedWords'])
    assert.deepEqual(snapshot()[field],before[field],field);
  assert.equal(cpu.host.physicalActive(),false,'Overlay remains authoritative until shell closes it');
  cpu.unmount();
});
test('actual candidate Fragment privacy reads fresh canonical witnesses and rejects an unearned or restored entry without closing its overlay or mutating saves', () => {
  seed(fresh()); const cpu=mount({prologueResolved:true}); enter(cpu); cpu.configure({archiveOpen:true});
  const before=snapshot(), persisted=storage.get('sidtw:journey:v3'), commands=commandTrace.length;
  cpu.act(()=>assert.equal(cpu.fragmentButton()(),false));
  assert.deepEqual(snapshot(),before);assert.equal(storage.get('sidtw:journey:v3'),persisted);assert.equal(commandTrace.length,commands);
  assert.equal(cpu.ui.archiveOpen,true); assert.equal(useWorldStore.getState().mode,'explore');
  cpu.configure({archiveOpen:false}); const lease=cpu.host.runtime.currentLease();
  cpu.act(()=>assert.equal(cpu.host.runtime.dispatch({type:'witness',entryId:state().activeEntryId,lease}).accepted,true));
  cpu.configure({archiveOpen:true}); useSettingsStore.setState({drawerOpen:true});
  const earnedBefore=snapshot(), earnedPersisted=storage.get('sidtw:journey:v3');
  cpu.act(()=>assert.equal(cpu.fragmentButton()(),false));
  assert.deepEqual(snapshot(),earnedBefore); assert.equal(storage.get('sidtw:journey:v3'),earnedPersisted);
  assert.equal(cpu.ui.archiveOpen,true); useSettingsStore.setState({drawerOpen:false});cpu.unmount();
});
test('actual candidate preserves F focus on canonical first read after runtime explicitly witnesses, without requiring a default Read billboard', () => {
  seed(fresh()); const cpu=mount({prologueResolved:true});enter(cpu);
  const lease=cpu.host.runtime.currentLease();cpu.act(()=>assert.equal(cpu.host.runtime.dispatch({type:'witness',entryId:state().activeEntryId,lease}).accepted,true));
  cpu.act(()=>key('f'));cpu.flushFocus();assert.equal(useWorldStore.getState().mode,'read');assert.equal(cpu.reader.focused,true);
  assert.equal(state().witnessedEntryIds.includes(state().activeEntryId),true);cpu.unmount();
});
