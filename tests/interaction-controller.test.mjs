import assert from 'node:assert/strict';
import test, { afterEach } from 'node:test';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import vm from 'node:vm';
import React from 'react';
import ts from 'typescript';
import * as THREE from 'three';
import * as proximity from '../src/player/interactionProximity.ts';

const require = createRequire(import.meta.url), Reconciler = require('react-reconciler');
const { ConcurrentRoot, DefaultEventPriority } = require('react-reconciler/constants');
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
const OwnerContext = React.createContext(null), mounted = new Set();
afterEach(() => { for (const cpu of [...mounted]) cpu.unmount(); });
const fiber = {
  useThree: () => React.useContext(OwnerContext),
  useFrame(callback) {
    const state = React.useContext(OwnerContext), ref = React.useRef(callback); ref.current = callback;
    React.useLayoutEffect(() => { state.frames.add(ref); return () => state.frames.delete(ref); }, [state]);
  },
};
function actualController(source) {
  const modules = { react: React, '@react-three/fiber': fiber, three: THREE, './interactionProximity': proximity }, exports = {};
  vm.runInNewContext(ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022,
    module: ts.ModuleKind.CommonJS } }).outputText, {
    exports, require: name => { assert.ok(name in modules, `Unexpected physical owner dependency ${name}`); return modules[name]; },
  });
  return exports.InteractionController;
}
const Current = actualController(readFileSync(new URL('../src/player/InteractionController.tsx', import.meta.url), 'utf8'));
const Former = actualController(readFileSync(new URL('./fixtures/interaction-controller-before-acknowledgment.tsx.txt', import.meta.url), 'utf8'));
const renderer = Reconciler({
  supportsMutation: true, isPrimaryRenderer: false, supportsPersistence: false, supportsHydration: false,
  getRootHostContext: () => null, getChildHostContext: () => null, getPublicInstance: value => value,
  createInstance: () => ({ children: [] }), createTextInstance: text => ({ text }),
  appendInitialChild() {}, appendChild() {}, appendChildToContainer() {}, removeChild() {}, removeChildFromContainer() {},
  insertBefore() {}, insertInContainerBefore() {}, finalizeInitialChildren: () => false,
  prepareForCommit: () => null, resetAfterCommit() {}, preparePortalMount() {},
  shouldSetTextContent: () => false, prepareUpdate: () => true, commitUpdate() {}, commitTextUpdate() {},
  hideInstance() {}, unhideInstance() {}, hideTextInstance() {}, unhideTextInstance() {},
  getCurrentEventPriority: () => DefaultEventPriority, beforeActiveInstanceBlur() {}, afterActiveInstanceBlur() {},
  detachDeletedInstance() {}, clearContainer() {}, scheduleTimeout: setTimeout, cancelTimeout: clearTimeout, noTimeout: -1,
});
const targets = [{ id: 'a', position: [30, 0, 0], active: true }, { id: 'b', position: [0, 0, 0], active: false }];
function mount(Owner, response = () => undefined) {
  const backend = { camera: new THREE.PerspectiveCamera(), frames: new Set() }, samples = [], entered = [];
  let props = { enabled: true, targets, clearingRadius: 8.8,
    onSample: (facts, time) => samples.push({ facts: structuredClone(facts), time }), onTargetEntered: id => { entered.push(id); return response(id); } };
  const root = renderer.createContainer({}, ConcurrentRoot, null, true, null, '', error => { throw error; }, null);
  const render = child => React.act(() => renderer.flushSync(() => renderer.updateContainer(child, root, null, null)));
  const tree = () => React.createElement(React.StrictMode, null,
    React.createElement(OwnerContext.Provider, { value: backend }, React.createElement(Owner, props)));
  render(tree()); assert.equal(backend.frames.size, 1);
  const cpu = { samples, entered,
    frame(time, x = 0) { backend.camera.position.set(x, 1.7, 0);
      React.act(() => { for (const ref of backend.frames) ref.current({ clock: { elapsedTime: time } }); }); },
    configure(patch) { props = { ...props, ...patch }; render(tree()); assert.equal(backend.frames.size, 1); },
    unmount() { render(null); assert.equal(backend.frames.size, 0); mounted.delete(cpu); },
  };
  mounted.add(cpu); return cpu;
}

test('actual void/true consumers retain exact prior proximity math, 80ms cadence and threshold hysteresis', () => {
  const radius = proximity.NODE_ACTIVATION_RADIUS;
  for (const response of [undefined, true]) {
    const old = mount(Former, () => response), next = mount(Current, () => response);
    for (const [time, x] of [[0, 0], [.04, 0], [.081, 0], [.162, radius * 1.4], [.243, radius * 1.6],
      [.324, 0], [.405, 0], [.486, 20], [.567, 0]]) {
      old.frame(time, x); next.frame(time, x);
      assert.deepEqual(next.samples, old.samples); assert.deepEqual(next.entered, old.entered);
    }
    assert.deepEqual(next.entered, ['b', 'b', 'b']);
    old.configure({ enabled: false }); next.configure({ enabled: false });
    old.frame(.7); next.frame(.7); assert.deepEqual(next.samples, old.samples);
    old.unmount(); next.unmount();
  }
});

test('actual false acknowledgment retries only on the existing samples while standing and consumes only later synchronous acceptance', () => {
  let accepted = false;
  const cpu = mount(Current, () => accepted);
  cpu.frame(0); assert.deepEqual(cpu.entered, ['b']);
  cpu.frame(.04); cpu.frame(.079); assert.equal(cpu.entered.length, 1);
  cpu.frame(.081); cpu.frame(.162); assert.equal(cpu.entered.length, 3, 'Unprimed/queued reports remain retryable without movement');
  accepted = true; cpu.frame(.243); assert.equal(cpu.entered.length, 4);
  cpu.frame(.324); cpu.frame(.405); assert.equal(cpu.entered.length, 4, 'Synchronous acceptance preserves hysteresis');
  cpu.frame(.486, proximity.NODE_ACTIVATION_RADIUS * 1.6); cpu.frame(.567); assert.equal(cpu.entered.length, 5);
  cpu.unmount();
});

test('actual asynchronous report retries after disabled/restore and stops when its accepted target becomes active', () => {
  const cpu = mount(Current, () => false);
  cpu.frame(0); cpu.configure({ enabled: false }); cpu.frame(.2); assert.equal(cpu.entered.length, 1);
  cpu.configure({ enabled: true }); cpu.frame(.3); assert.equal(cpu.entered.length, 2, 'Standing after interruption can report again');
  cpu.configure({ targets: targets.map(target => ({ ...target, active: target.id === 'b' })) });
  cpu.frame(.4); cpu.frame(.5); assert.equal(cpu.entered.length, 2, 'The now-active target is no longer an inactive crossing candidate');
  cpu.unmount();
});
