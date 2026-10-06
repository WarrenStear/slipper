import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';
import ts from 'typescript';
import { createPhysicalObservationPort } from '../src/player/physicalObservation.ts';
import { connectPhysicalObservationInput } from '../src/player/physicalObservationInput.ts';

const repo = fileURLToPath(new URL('../', import.meta.url));
class RecordedTarget extends EventTarget {
  listeners = new Map(); registrations = [];
  addEventListener(type, listener, options) {
    this.registrations.push({ type, listener, options });
    const bucket = this.listeners.get(type) ?? new Map(); bucket.set(listener, options); this.listeners.set(type, bucket);
    super.addEventListener(type, listener, options);
  }
  removeEventListener(type, listener, options) {
    const bucket = this.listeners.get(type); assert.equal(options.capture, bucket?.get(listener)?.capture);
    bucket.delete(listener); if (bucket.size === 0) this.listeners.delete(type);
    super.removeEventListener(type, listener, options);
  }
}
const event = (type, fields = {}) => {
  const value = new Event(type, { bubbles: true, cancelable: true });
  for (const [key, item] of Object.entries(fields)) Object.defineProperty(value, key, { value: item });
  return value;
};
const pose = observedAtMs => ({ observedAtMs, position: [0, 0, 0], quaternion: [0, 0, 0, 1], inputEnabled: true, settled: true });
function host() {
  const windowTarget = new RecordedTarget(), documentTarget = new RecordedTarget(), port = createPhysicalObservationPort(), lease = {};
  port.bind(lease, 0);
  let now = 0, activity = true, binding = { port, lease }, notify, unsubscribed = 0;
  const signals = [];
  const bridge = connectPhysicalObservationInput({ windowTarget, documentTarget, getBinding: () => binding,
    getActivity: () => activity, now: () => now, onSignal: signal => signals.push(signal),
    subscribeActivity: callback => { notify = callback; return () => { unsubscribed++; }; } });
  return { windowTarget, documentTarget, port, lease, bridge, signals,
    time: value => { now = value; }, activity: value => { activity = value; notify(); },
    restore: () => notify(), binding: value => { binding = value; }, unsubscribed: () => unsubscribed,
    prime(value = 500) { now = value; port.publish(lease, pose(value)); now = value + 75; port.publish(lease, pose(now)); },
    facts: () => port.read(lease, now), send(type, fields) { windowTarget.dispatchEvent(event(type, fields)); },
  };
}

test('real EventTarget handlers register capture/passive observation and retain all independent held keys', () => {
  const h = host(); h.prime(); assert.equal(h.facts().stillEligible, true);
  for (const registration of [...h.windowTarget.registrations, ...h.documentTarget.registrations]) {
    assert.deepEqual(registration.options, { capture: true, passive: true });
  }
  h.time(600);
  for (const code of ['KeyW', 'ArrowRight', 'KeyE', 'ShiftLeft', 'UnmappedKey']) h.send('keydown', { code });
  h.send('keydown', { code: 'KeyW', repeat: true });
  assert.equal(h.facts().heldKeys, 5); assert.equal(h.facts().stillEligible, false);
  for (const code of ['KeyW', 'ArrowRight', 'KeyE', 'ShiftLeft', 'UnmappedKey']) h.send('keyup', { code });
  assert.equal(h.facts().heldKeys, 0);
  h.time(950); assert.equal(h.facts().stillEligible, false); h.time(951); assert.equal(h.facts().stillEligible, true);
  h.bridge.dispose();
});

test('pointer IDs survive independently; lost capture/cancel/up release the reported finger only', () => {
  const h = host(); h.prime(); h.time(600);
  h.send('pointerdown', { pointerId: 3 }); h.send('pointerdown', { pointerId: 7 }); h.send('pointerdown', { pointerId: 3 });
  assert.equal(h.facts().heldPointers, 2);
  h.send('lostpointercapture', { pointerId: 3 }); assert.equal(h.facts().heldPointers, 1);
  h.time(1000); assert.equal(h.facts().stillEligible, false);
  h.send('pointercancel', { pointerId: 7 }); assert.equal(h.facts().heldPointers, 0);
  h.send('pointerup', { pointerId: 7 });
  h.time(1350); assert.equal(h.facts().stillEligible, false); h.time(1351); assert.equal(h.facts().stillEligible, true);
  h.bridge.dispose();
});

test('blur/pagehide/hidden and their resume edges clear inputs and require fresh physical continuity', () => {
  for (const reason of ['blur', 'pagehide', 'hidden']) {
    const h = host(); h.prime(); h.time(600); h.send('keydown', { code: 'KeyW' }); h.send('pointerdown', { pointerId: 1 });
    if (reason === 'hidden') { h.documentTarget.hidden = true; h.documentTarget.dispatchEvent(event('visibilitychange')); }
    else h.send(reason);
    assert.equal(h.facts().heldKeys, 0); assert.equal(h.facts().heldPointers, 0); assert.equal(h.facts().available, false);
    h.time(700); h.send('keydown', { code: 'KeyE' }); assert.equal(h.facts().heldKeys, 0);
    h.time(800);
    if (reason === 'hidden') { h.documentTarget.hidden = false; h.documentTarget.dispatchEvent(event('visibilitychange')); }
    else h.send(reason === 'blur' ? 'focus' : 'pageshow');
    h.port.publish(h.lease, pose(810)); assert.equal(h.facts().available, false);
    h.time(900); h.port.publish(h.lease, pose(900)); assert.equal(h.facts().stillEligible, false);
    h.time(1150); assert.equal(h.facts().stillEligible, false); h.time(1151); assert.equal(h.facts().stillEligible, true);
    h.bridge.dispose();
  }
});

test('captured descendant focus preserves the current physical observation for a DOM action', () => {
  const h = host(); h.prime(); h.time(600);
  const before = h.facts(), signalCount = h.signals.length;
  const button = new EventTarget(), previousButton = new EventTarget();
  // A window capture listener receives descendant focus/blur with the original
  // target. EventTarget has no DOM tree, so retain that native event property.
  for (const [type, target] of [['blur', previousButton], ['focus', button]]) {
    h.send(type, { target });
    assert.deepEqual(h.facts(), before);
    assert.equal(h.signals.length, signalCount);
  }
  assert.equal(h.bridge.refreshActivity(), true);
  h.send('pointerdown', { pointerId: 4 }); h.send('pointerup', { pointerId: 4 });
  assert.equal(h.facts().available, true, 'Click keeps the current camera pose available');
  assert.equal(h.facts().inputEnabled, true);
  h.send('blur'); assert.equal(h.facts().available, false, 'Real window blur still suspends');
  h.send('focus'); assert.equal(h.facts().available, false, 'Real resume still requires fresh poses');
  h.bridge.dispose();
});

test('injected settings/mode/physics and active-to-active restoration reset between pose samples', () => {
  const h = host(); h.prime(); h.time(600); h.activity(false); h.time(650); h.activity(true);
  h.time(700); h.port.publish(h.lease, pose(700)); assert.equal(h.facts().available, false);
  h.time(775); h.port.publish(h.lease, pose(775)); assert.equal(h.facts().stillEligible, false);
  h.time(1100); assert.equal(h.facts().stillEligible, true);
  h.restore(); assert.equal(h.facts().available, false);
  h.time(1110); h.port.publish(h.lease, pose(1110)); assert.equal(h.facts().available, false);
  h.time(1185); h.port.publish(h.lease, pose(1185)); assert.equal(h.facts().stillEligible, false);
  h.time(1450); assert.equal(h.facts().stillEligible, false); h.time(1451); assert.equal(h.facts().stillEligible, true);
  h.bridge.dispose();
});

test('pointer-lock handoff keeps the former cancellation boundary without consuming look or owning capture', () => {
  const h = host(); h.prime(); h.time(600); h.send('keydown', { code: 'KeyE' }); h.send('pointerdown', { pointerId: 1 });
  h.documentTarget.dispatchEvent(event('pointerlockchange'));
  assert.equal(h.facts().heldKeys, 0); assert.equal(h.facts().heldPointers, 0); assert.equal(h.facts().available, false);
  h.time(675); h.port.publish(h.lease, pose(675)); assert.equal(h.facts().available, false);
  h.time(750); h.port.publish(h.lease, pose(750)); assert.equal(h.facts().stillEligible, false);
  h.time(951); assert.equal(h.facts().stillEligible, true);
  h.bridge.dispose();
});

test('old host activity/cleanup cannot touch a replacement lease; bridge never binds or releases one', () => {
  const h = host(); h.prime(); const next = {}; h.port.bind(next, 700);
  h.port.publish(next, pose(1050)); h.port.publish(next, pose(1125)); const before = h.port.read(next, 1125);
  h.time(1200); h.send('keydown', { code: 'KeyW' }); h.send('pointerdown', { pointerId: 9 }); h.restore(); h.bridge.dispose();
  assert.deepEqual(h.port.read(next, 1125), before); assert.equal(h.unsubscribed(), 1);
  h.bridge.dispose(); assert.equal(h.unsubscribed(), 1);
  assert.equal(h.windowTarget.listeners.size + h.documentTarget.listeners.size, 0);
  h.send('pointerdown', { pointerId: 4 }); assert.deepEqual(h.port.read(next, 1125), before);
  assert.equal(h.port.release(next), true, 'Root host retains sole release ownership');
});

test('unbound/no-active input never starts a lease or prevents the native action event', () => {
  const h = host(); h.binding(null); h.bridge.refreshActivity();
  const down = event('keydown', { code: 'KeyW' }); h.windowTarget.dispatchEvent(down);
  assert.equal(down.defaultPrevented, false); assert.equal(h.facts().heldKeys, 0); assert.equal(h.facts().available, false);
  h.bridge.dispose();
});

test('capture reaches both actual mobile pointerdown handlers before their stopPropagation boundary', () => {
  const source = readFileSync(`${repo}/src/components/ui/MobileExploreControls.tsx`, 'utf8');
  const ast = ts.createSourceFile('MobileExploreControls.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const handlers = [];
  function visit(node) {
    if (ts.isJsxAttribute(node) && node.name.getText(ast) === 'onPointerDown') handlers.push(node.initializer.expression);
    ts.forEachChild(node, visit);
  }
  visit(ast); assert.equal(handlers.length, 2);
  const h = host(); h.prime(); h.time(600); let bubbles = 0, joystickUpdates = 0;
  const scopes = { joystickPointerRef: { current: null }, lookPointerRef: { current: null },
    gentleHaptic: () => {}, hapticsEnabled: false, reducedEffects: false, updateJoystick: () => { joystickUpdates++; } };
  handlers.forEach((handler, i) => {
    const transpiled = ts.transpileModule(`const handler = ${handler.getText(ast)}; handler;`,
      { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None } }).outputText;
    const execute = vm.runInNewContext(transpiled, { ...scopes }), currentTarget = { setPointerCapture: () => {} };
    const down = event('pointerdown', { pointerId: i + 1, currentTarget, clientX: 20, clientY: 30 });
    // Explicit CPU propagation order: native capture, actual React target
    // handler, then bubble only if the real event has not stopped propagation.
    // This is not a browser DOM/emulation claim; root owns the trusted test.
    h.windowTarget.dispatchEvent(down); execute(down); if (!down.cancelBubble) bubbles++;
    assert.equal(down.cancelBubble, true); assert.equal(h.facts().heldPointers, i + 1);
  });
  assert.equal(bubbles, 0); assert.equal(joystickUpdates, 1); assert.equal(h.facts().stillEligible, false);
  h.bridge.dispose();
});
