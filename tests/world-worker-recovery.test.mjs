import assert from 'node:assert/strict';
import test from 'node:test';
import { createRequire } from 'node:module';
import React from 'react';
import {
  WorldWorkerFailureContext,
  WorldWorkerFailureGuard,
  reportCurrentWorldWorkerFailure,
  useReportWorldWorkerFailure,
} from '../src/world/workerFailure.ts';

const require = createRequire(import.meta.url);
const Reconciler = require('react-reconciler');
const { ConcurrentRoot, DefaultEventPriority } = require('react-reconciler/constants');
const el = React.createElement;
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
let cpuRenderer;

// Exercise the installed React reconciler's retained Suspense branch without a
// DOM, browser, animation frame or GPU. This renderer only records visible nodes.
function createCpuRoot() {
  const append = (parent, child) => parent.children.push(child);
  const remove = (parent, child) => { parent.children = parent.children.filter(item => item !== child); };
  const insert = (parent, child, before) => {
    remove(parent, child); parent.children.splice(parent.children.indexOf(before), 0, child);
  };
  const renderer = cpuRenderer ??= Reconciler({
    createInstance: (type, props) => ({ type, props, children: [], hidden: false }),
    createTextInstance: text => ({ type: 'text', text, children: [] }),
    appendInitialChild: append, appendChild: append, appendChildToContainer: append,
    removeChild: remove, removeChildFromContainer: remove,
    insertBefore: insert, insertInContainerBefore: insert,
    supportsMutation: true, isPrimaryRenderer: false, supportsPersistence: false, supportsHydration: false,
    getRootHostContext: () => null, getChildHostContext: () => null,
    getPublicInstance: instance => instance, finalizeInitialChildren: () => false,
    prepareForCommit: () => null, resetAfterCommit: () => {}, preparePortalMount: () => {},
    shouldSetTextContent: () => false, prepareUpdate: () => true,
    commitUpdate: (instance, _payload, _type, _old, props) => { instance.props = props; },
    commitTextUpdate: (instance, _old, text) => { instance.text = text; },
    hideInstance: instance => { instance.hidden = true; }, unhideInstance: instance => { instance.hidden = false; },
    hideTextInstance: instance => { instance.hidden = true; }, unhideTextInstance: instance => { instance.hidden = false; },
    getCurrentEventPriority: () => DefaultEventPriority,
    beforeActiveInstanceBlur: () => {}, afterActiveInstanceBlur: () => {}, detachDeletedInstance: () => {},
    clearContainer: container => { container.children = []; },
    scheduleTimeout: setTimeout, cancelTimeout: clearTimeout, noTimeout: -1,
  });
  const container = { children: [] };
  const root = renderer.createContainer(container, ConcurrentRoot, null, false, null, '', error => { throw error; }, null);
  return {
    renderer,
    render: element => {
      React.act(() => renderer.flushSync(() => renderer.updateContainer(element, root, null, () => {})));
      renderer.flushPassiveEffects();
    },
    flush: callback => React.act(() => renderer.flushSync(callback)),
    visible: () => container.children.filter(item => !item.hidden).map(item => item.type),
  };
}

class RecoveryBoundary extends React.Component {
  state = { error: false };
  static getDerivedStateFromError() { return { error: true }; }
  componentDidCatch(error) { this.props.onError?.(error); }
  render() { return this.state.error ? el('recovery') : this.props.children; }
}

test('a terminated or superseded worker cannot publish a failure to the canvas', () => {
  const worker = {}, replacement = {}, error = new Error('worker failure');
  const local = [], canvas = [];
  const report = current => reportCurrentWorldWorkerFailure(worker, current, error, item => local.push(item), item => canvas.push(item));
  assert.equal(report(null), false);
  assert.equal(report(replacement), false);
  assert.deepEqual(local, []); assert.deepEqual(canvas, []);
  assert.equal(report(worker), true);
  assert.equal(local[0], error); assert.equal(canvas[0], error);
});

test('a worker failure escapes a retained loading branch without waiting for its asset promise', async () => {
  const originalConsole = console.error;
  console.error = () => {}; // Expected error-boundary diagnostics.
  try {
    for (const withProvider of [false, true]) {
      const cpu = createCpuRoot(), caught = [], worker = {}, error = new Error('worker failed');
      let suspendParent, failWorker, resolvePending, ready = false;
      const pending = new Promise(resolve => { resolvePending = () => { ready = true; resolve(); }; });
      function WorkerOwner() {
        const [localError, setLocalError] = React.useState(null);
        const report = useReportWorldWorkerFailure();
        React.useEffect(() => {
          failWorker = () => reportCurrentWorldWorkerFailure(worker, worker, error, setLocalError, report);
        }, [report]);
        if (localError) throw localError;
        return el('forest');
      }
      function PendingScene() {
        const [blocked, setBlocked] = React.useState(false);
        suspendParent = () => setBlocked(true);
        if (blocked && !ready) throw pending;
        return el(WorkerOwner);
      }
      function CanvasOwner() {
        const [failure, setFailure] = React.useState(null);
        const report = React.useCallback(item => setFailure(current => current ?? item), []);
        const scene = el(React.Suspense, { fallback: el('loading') }, el(PendingScene));
        return el(WorldWorkerFailureGuard, { error: failure }, withProvider
          ? el(WorldWorkerFailureContext.Provider, { value: report }, scene) : scene);
      }
      cpu.render(el(RecoveryBoundary, { onError: item => caught.push(item) }, el(CanvasOwner)));
      assert.deepEqual(cpu.visible(), ['forest']);
      cpu.flush(suspendParent);
      assert.deepEqual(cpu.visible(), ['loading']);
      cpu.flush(failWorker);
      assert.deepEqual(cpu.visible(), withProvider ? ['recovery'] : ['loading']);
      if (withProvider) assert.equal(caught[0], error, 'The DOM owner receives the original worker error immediately');
      await React.act(async () => { resolvePending(); await pending; });
      cpu.renderer.flushPassiveEffects();
      assert.deepEqual(cpu.visible(), ['recovery'], 'A direct fixture still recovers from its local render-time throw');
      assert.equal(caught[0], error);
      cpu.render(null);
    }
  } finally { console.error = originalConsole; }
});

test('changing the canvas reporter keeps the worker callback stable and uses its current owner', () => {
  const cpu = createCpuRoot(), callbacks = [], messages = [];
  let mounted = 0, cleaned = 0;
  function WorkerOwner() {
    const report = useReportWorldWorkerFailure();
    callbacks.push(report);
    React.useEffect(() => { mounted++; return () => { cleaned++; }; }, [report]);
    return el('forest');
  }
  const render = reporter => cpu.render(el(WorldWorkerFailureContext.Provider, { value: reporter }, el(WorkerOwner)));
  render(error => messages.push(['first', error]));
  const callback = callbacks[0], error = new Error('later failure');
  render(item => messages.push(['current', item]));
  assert.equal(callbacks.at(-1), callback);
  assert.equal(mounted, 1); assert.equal(cleaned, 0);
  callback(error);
  assert.deepEqual(messages, [['current', error]]);
  cpu.render(null);
  assert.equal(cleaned, 1);
});
