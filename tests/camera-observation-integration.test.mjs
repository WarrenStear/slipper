import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import * as THREE from 'three';
import * as cameraModel from '../src/player/cameraModel.ts';
import * as cameraOwnership from '../src/player/cameraOwnership.ts';
import * as playerMovement from '../src/player/playerMovement.ts';
import { createPhysicalObservationPort } from '../src/player/physicalObservation.ts';

const baseline = readFileSync(new URL('./fixtures/camera-before-physical-observation.txt', import.meta.url), 'utf8');
const candidate = readFileSync(new URL('../src/player/CameraController.tsx', import.meta.url), 'utf8');
const getFrame = source => {
  const ast = ts.createSourceFile('CameraController.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  let call;
  function visit(node) { if (ts.isCallExpression(node) && node.expression.getText(ast) === 'useFrame') {
    assert.equal(call, undefined); call = node;
  } ts.forEachChild(node, visit); }
  visit(ast); assert.ok(call); return { ast, call, body: call.arguments[0].body };
};
const close = (a, b) => assert.ok(Math.abs(a - b) <= 1e-10, `${a} != ${b}`);
const poseBytes = camera => [...camera.position.toArray(), ...camera.quaternion.toArray(), camera.fov];

function mount(source, overrides = {}, publish = true) {
  const camera = new THREE.PerspectiveCamera(), frames = [], effects = [], layouts = [], cleanups = [], observed = [];
  let now = 0, inputEnabled = true, lookX = 0, lookY = 0, lookConsumes = 0, assistanceCalls = 0, bindingReads = 0;
  const window = new EventTarget(), document = new EventTarget(), canvas = new EventTarget();
  window.matchMedia = () => ({ matches: false });
  document.documentElement = { dataset: {}, classList: { contains: () => false }, requestPointerLock: () => {} };
  document.pointerLockElement = null;
  document.hidden = false; document.hasFocus = () => true;
  canvas.requestPointerLock = () => { document.pointerLockElement = canvas; document.dispatchEvent(new Event('pointerlockchange')); };
  document.exitPointerLock = () => { document.pointerLockElement = null; document.dispatchEvent(new Event('pointerlockchange')); };
  const port = createPhysicalObservationPort(), lease = {}; port.bind(lease, 0);
  const publisher = { ...port, publish(token, sample) {
    observed.push({ token, observedAtMs: sample.observedAtMs, inputEnabled: sample.inputEnabled, settled: sample.settled,
      position: [...sample.position], quaternion: [...sample.quaternion], positionArray: sample.position, quaternionArray: sample.quaternion });
    return port.publish(token, sample);
  } };
  const mobile = { consumeLookDelta(target) { lookConsumes++; target.x = lookX; target.y = lookY; lookX = lookY = 0; return target; } };
  const props = { mode: 'explore', controls: 'walk', movementEnabled: true, cameraReadyRef: { current: false },
    pose: { current: { position: { x: 2, y: 1, z: 3 }, available: true, speedRatio: .4 } },
    activePosition: [0, 0, 0], playerInitialPosition: [2, 1, 3], cameraStart: [0, 2, 5], cameraTarget: [0, 0, -1],
    fov: 65, guidanceLookTarget: [5, 2, -3], lowView: false, bobSuppression: .92,
    reducedMotion: false, reducedEffects: false, sceneId: 'test', cameraAssistance: true, openingShotOwned: false,
    inputActive: () => inputEnabled, presentationActive: () => inputEnabled,
    observation: publish ? () => { bindingReads++; return { port: publisher, lease }; } : undefined, ...overrides };
  const modules = {
    react: { useMemo: callback => callback(), useRef: current => ({ current }),
      useEffect: callback => effects.push(callback), useLayoutEffect: callback => layouts.push(callback) },
    '@react-three/fiber': { useFrame: (callback, priority) => frames.push({ callback, priority }), useThree: () => ({ camera, gl: { domElement: canvas } }) },
    '@react-three/drei': { OrbitControls: () => null }, three: THREE,
    '../stores/usePlayerInputStore': { usePlayerInputStore: { getState: () => mobile } },
    './playerMovement': playerMovement, './cameraOwnership': cameraOwnership, './cameraModel': cameraModel,
    './useCameraAssistance': { useCameraAssistance: args => (target, delta) => {
      assistanceCalls++; if (!args.isActive()) return;
      target.rotateY(delta * .015); target.fov += delta * .01;
    } },
  };
  const code = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022,
    module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText;
  modules['react/jsx-runtime'] = { jsx: () => null };
  const exports = {};
  vm.runInNewContext(code, { exports, require: name => { assert.ok(name in modules, `Unexpected camera dependency: ${name}`); return modules[name]; },
    document, window, navigator: { webdriver: false }, performance: { now: () => now },
    MutationObserver: class { observe() {} disconnect() {} } });
  exports.CameraController(props);
  for (const callback of [...layouts, ...effects]) { const cleanup = callback(); if (typeof cleanup === 'function') cleanups.push(cleanup); }
  assert.equal(frames.length, 1); assert.equal(frames[0].priority, -1);
  return { camera, props, port, lease, observed, frames,
    frame(delta = 1 / 60) { now += delta * 1000; frames[0].callback({}, delta); return poseBytes(camera); },
    now: () => now, input: enabled => { inputEnabled = enabled; }, mobile: (x, y) => { lookX = x; lookY = y; },
    mouse(x, y) { canvas.dispatchEvent(new Event('click')); const event = new Event('mousemove');
      Object.defineProperties(event, { movementX: { value: x }, movementY: { value: y } }); document.dispatchEvent(event); },
    consumes: () => lookConsumes, assistanceCalls: () => assistanceCalls, bindingReads: () => bindingReads,
    dispose() { for (const cleanup of cleanups.reverse()) cleanup(); },
  };
}

test('the actual camera keeps the entire existing frame application and one negative-priority subscriber', () => {
  const old = getFrame(baseline), next = getFrame(candidate);
  assert.equal(next.call.arguments[1].getText(next.ast), '-1');
  assert.equal(next.body.statements.length, 1); assert.ok(ts.isTryStatement(next.body.statements[0]));
  assert.deepEqual(next.body.statements[0].tryBlock.statements.map(node => node.getText(next.ast).replace(/\s+/g, ' ')),
    old.body.statements.map(node => node.getText(old.ast).replace(/\s+/g, ' ')), 'Every camera/arrival/look/bob/assistance statement is retained verbatim');
  assert.doesNotMatch(candidate, /dispatchStoryEvent|useJourneyStore|requestAnimationFrame|\.port\.(?:bind|release)\(/);
});

test('final publication preserves actual source trajectories, look consumption and camera readiness', () => {
  const configurations = [{}, { reducedMotion: true }, { reducedEffects: true }, { lowView: true, movementEnabled: false },
    { mode: 'read', controls: 'none' }, { controls: 'orbit' }, { pose: { current: { available: false, position: { x: 0, y: 0, z: 0 }, speedRatio: 0 } } }];
  for (const configuration of configurations) {
    const old = mount(baseline, configuration), next = mount(candidate, configuration);
    for (let frame = 0; frame < 120; frame++) {
      const enabled = frame < 70 || frame > 76; old.input(enabled); next.input(enabled);
      if (frame % 13 === 0) { old.mobile(7, -3); next.mobile(7, -3); old.mouse(4, 2); next.mouse(4, 2); }
      const delta = frame === 50 ? .5 : 1 / 60;
      const oldPose = old.frame(delta), nextPose = next.frame(delta); oldPose.forEach((value, i) => close(value, nextPose[i]));
      assert.equal(old.props.cameraReadyRef.current, next.props.cameraReadyRef.current);
      assert.equal(next.bindingReads(), frame + 1, 'The supplied getter is read exactly once per frame');
      assert.equal(next.observed.length, frame + 1, 'One publication per existing callback, including inactive and arrival branches');
      const observed = next.observed.at(-1); next.camera.getWorldPosition(new THREE.Vector3()).toArray().forEach((value, i) => close(value, observed.position[i]));
      next.camera.getWorldQuaternion(new THREE.Quaternion()).toArray().forEach((value, i) => close(value, observed.quaternion[i]));
      assert.equal(observed.inputEnabled, configuration.mode !== 'read' && enabled);
      assert.equal(observed.settled, next.props.cameraReadyRef.current);
      assert.equal(observed.token, next.lease); close(observed.observedAtMs, next.now());
    }
    assert.equal(old.consumes(), next.consumes()); assert.equal(old.assistanceCalls(), next.assistanceCalls());
    assert.equal(next.observed[0].positionArray, next.observed.at(-1).positionArray);
    assert.equal(next.observed[0].quaternionArray, next.observed.at(-1).quaternionArray);
    old.dispose(); next.dispose();
  }
});

test('low opening facts are not blocked by the walking/body gates, but require two settled samples', () => {
  const cpu = mount(candidate, { reducedMotion: true, lowView: true, movementEnabled: false,
    pose: { current: { available: false, position: { x: 0, y: 0, z: 0 }, speedRatio: 0 } } });
  cpu.frame(.4); assert.equal(cpu.port.read(cpu.lease, cpu.now()).available, false);
  cpu.frame(1 / 60); assert.equal(cpu.port.read(cpu.lease, cpu.now()).available, true);
  assert.equal(cpu.port.read(cpu.lease, cpu.now()).inputEnabled, true);
  cpu.dispose();
});

test('optional publication leaves review fixtures unchanged and stale publishers cannot affect a replacement', () => {
  const unbound = mount(candidate, {}, false); unbound.frame(); assert.equal(unbound.observed.length, 0); unbound.dispose();
  const cpu = mount(candidate, { reducedMotion: true }); cpu.frame(.5); cpu.frame(1 / 60);
  const next = {}; cpu.port.bind(next, cpu.now()); const before = cpu.port.read(next, cpu.now());
  cpu.frame(1 / 60); assert.deepEqual(cpu.port.read(next, before.observedAtMs ?? cpu.now()).position, before.position);
  assert.equal(cpu.port.read(next, cpu.now()).revision, before.revision, 'The old supplied lease is rejected by the actual port');
  cpu.dispose();
});
