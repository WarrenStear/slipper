import assert from 'node:assert/strict';
import test, { after } from 'node:test';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { createHash } from 'node:crypto';
import { runInNewContext } from 'node:vm';
import React from 'react';
import * as THREE from 'three';
import ts from 'typescript';
import { createUnderfloorGeometry } from '../src/world/opening/underfloorGeometry.ts';
import { createTaperedBranchGeometry, mergeArtGeometries } from '../src/components/three/environmentArt/authoredGeometry.ts';
import { createUnderfloorCaptureResources, captureUnderfloorFrame } from '../src/world/opening/underfloorCapture.ts';
import { createWetFloorTextureView, createWetFloorMask, createWetFloorUniforms } from '../src/world/opening/wetFloorResources.ts';
import { advanceWetFloorUniforms } from '../src/world/opening/wetFloorMotion.ts';
import { openingBoughPose, openingRoomAppearance } from '../src/world/opening/openingComposition.ts';
import { vertexShader, fragmentShader } from '../src/world/opening/wetFloorShader.ts';
import { scenePresentationActive } from '../src/world/presentationActivity.ts';
import * as brushRuntime from '../src/components/three/storyEvents/storyInteractionRuntime.ts';

// Immutable CPU outputs from the actual 21ce695 constructor/shader literals.
// Provenance and source extraction are retained in external phase-c preparation.
// Only the accepted supplied aperture alpha is excluded from RGB shader parity.
const BASELINE = {
  vertexShader: '16135b43f513c37ca5a37c48aa861885437a72672a30aa9ef0f713ac32e8fb06',
  fragmentShader: 'd019b935b1d76e6585dd749bfeed87a536d1bfa4b10be2fd1bfc00a9b157bdbf',
  trunks: '510f6e4c472606d2a58b52433a8b48526bfabe04158477a71f0525cc759c3923',
  crowns: '4d0174ef64b440e1cd9b05ef5cd4ab51599f17bb5b3246222b16b0af91d3b637',
  attributes: {
    position: { itemSize: 3, count: 516, hash: 'eccbbafa5b4b6833e2b3c76e702681d43692dd2c101d8ed5a9550ba5743937a3' },
    uv: { itemSize: 2, count: 516, hash: 'b5705540a0b43fe11a5dc44533d7b7a9905884a9df3f64b444f8d81e2cf360c3' },
    normal: { itemSize: 3, count: 516, hash: 'bd6bed85b4b3bb3b5926ab6045aa64504b31a087df2bf194d80ce9d9817ec126' },
  },
  index: { count: 3024, hash: '5a01d671271a1d2a9c5c91d8d495cd8c5e726a2825a9550256db2cb461f0c004' },
};
const hash = value => createHash('sha256').update(value).digest('hex');
const arrayBytes = values => new Uint8Array(values.buffer, values.byteOffset, values.byteLength);
const shaderHash = source => hash(source.replace(/\/\/.*$/gm, '').replace(/\s/g, ''));
const close = (actual, expected, tolerance = 1e-12) => assert.ok(Math.abs(actual - expected) <= tolerance, `${actual} != ${expected}`);
const require = createRequire(import.meta.url), Reconciler = require('react-reconciler');
const { ConcurrentRoot, DefaultEventPriority } = require('react-reconciler/constants');
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
const CpuContext = React.createContext(null), el = React.createElement;
let currentState, cpuRenderer;
const documentBefore = globalThis.document;
globalThis.document = { get hidden() { return currentState?.hidden ?? false; }, hasFocus: () => currentState?.focused ?? true };
after(() => { if (documentBefore === undefined) delete globalThis.document; else globalThis.document = documentBefore; brushRuntime.resetFloorBrush(); });
const useFrame = (callback, priority = 0) => {
  const state = React.useContext(CpuContext), ref = React.useRef(callback); ref.current = callback;
  React.useLayoutEffect(() => { const record = { ref, priority }; state.frames.add(record); return () => state.frames.delete(record); }, [state]);
};
const leaf = name => props => el('group', { name, ...props });
const mockImports = {
  react: React,
  three: THREE,
  '@react-three/fiber': { useFrame, createPortal: (children, scene) => cpuRenderer.createPortal(children, scene, null) },
  '@react-three/drei': { useTexture: () => React.useContext(CpuContext).source },
  '../presentationActivity': { scenePresentationActive },
  '../../stores/useSettingsStore': { useSettingsStore: { getState: () => ({ drawerOpen: currentState.overlayOpen }) } },
  '../../stores/useWorldStore': { useWorldStore: { getState: () => ({ mode: currentState.mode, physicsPaused: currentState.physicsPaused }) } },
  '../../components/three/artDirection/SceneLookContext': { useSceneLook: () => React.useContext(CpuContext).presentation },
  '../../components/three/storyEvents/TactileMaterial': { TactileMaterial: () => null },
  '../../components/three/chapters/ChapterPrimitives': { LanternProp: leaf('cpu-lantern-leaf'), SceneGround: leaf('cpu-ground-leaf') },
  '../../components/three/environment/EnvironmentDressing': { Forms: leaf('cpu-forms-leaf') },
  '../../components/three/storyEvents/storyInteractionRuntime': brushRuntime,
  './openingComposition': { openingBoughPose },
  './underfloorCapture': { createUnderfloorCaptureResources, captureUnderfloorFrame },
  './underfloorGeometry': { createUnderfloorGeometry },
  './wetFloorMotion': { advanceWetFloorUniforms },
  './wetFloorResources': { createWetFloorTextureView, createWetFloorMask, createWetFloorUniforms },
  './wetFloorShader': { vertexShader, fragmentShader },
};
function compileActual(relative, replacement) {
  let source = readFileSync(new URL(`../src/world/opening/${relative}`, import.meta.url), 'utf8');
  if (replacement) source = replacement(source);
  const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText;
  const exports = {};
  runInNewContext(compiled, { exports, document: globalThis.document, require: id => {
    if (id === 'react/jsx-runtime') return require(id);
    assert.ok(id in mockImports, `Unrecognized actual owner dependency ${id}`); return mockImports[id];
  } });
  return exports;
}
const CurrentUnderfloor = compileActual('UnderfloorForest.tsx').useUnderfloorForest;
// Installed-React negative control: recreate the former passive validity reset.
const PassiveUnderfloor = compileActual('UnderfloorForest.tsx', source => {
  const ast = ts.createSourceFile('UnderfloorForest.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  let reset;
  function visit(node) {
    if (ts.isCallExpression(node) && node.expression.getText(ast) === 'useLayoutEffect' && node.getText(ast).includes('valid.current = false')) reset = node;
    ts.forEachChild(node, visit);
  }
  visit(ast); assert.ok(reset, 'Control targets the actual target validity effect');
  return source.slice(0, reset.expression.getStart(ast)) + 'useEffect' + source.slice(reset.expression.end);
}).useUnderfloorForest;
mockImports['./UnderfloorForest'] = { useUnderfloorForest: CurrentUnderfloor };
const WetFloorReveal = compileActual('WetFloorReveal.tsx').WetFloorReveal;
function UnderfloorProbe({ stage = 1, reducedMotion = false, visible = true, passive = false }) {
  const state = React.useContext(CpuContext), hook = passive ? PassiveUnderfloor : CurrentUnderfloor;
  const surface = React.useMemo(() => ({ current: state.surface }), [state]);
  state.result = hook(surface, stage, { reducedMotion, visible: () => visible });
  return state.result.portal;
}
function createGl() {
  const previous = new THREE.WebGLRenderTarget(8, 8), log = [], captures = [];
  let target = previous;
  const gl = {
    domElement: { dataset: {} }, extensions: { has: () => true }, xr: { enabled: true }, shadowMap: { autoUpdate: true },
    log, captures, previous, fail: null,
    getRenderTarget: () => target,
    setRenderTarget(value) { log.push(['target', value]); target = value; },
    clear() { log.push(['clear']); if (gl.fail === 'clear') throw new Error('controlled capture clear failure'); },
    render(scene, camera) { log.push(['render', scene, camera]); captures.push({ scene, camera, target }); if (gl.fail === 'render') throw new Error('controlled capture render failure'); },
  };
  return gl;
}
function createCpuRoot(strict = false) {
  const append = (parent, child) => {
    if (child.isMaterial) parent.material = child;
    else if (child.isBufferGeometry) parent.geometry = child;
    else if (parent.isObject3D && child.isObject3D) parent.add(child);
    else parent.children.push(child);
  };
  const remove = (parent, child) => {
    if (parent.isObject3D && child.isObject3D) parent.remove(child);
    else if (parent.children) parent.children = parent.children.filter(item => item !== child);
  };
  const update = (instance, values) => {
    for (const [key, value] of Object.entries(values)) {
      if (['children', 'args', 'ref', 'key'].includes(key)) continue;
      if (key === 'scale' && typeof value === 'number') instance.scale.setScalar(value);
      else if (['position', 'rotation', 'scale'].includes(key) && Array.isArray(value)) instance[key].set(...value);
      else if (instance[key]?.isColor) instance[key].set(value);
      else instance[key] = value;
    }
  };
  cpuRenderer ??= Reconciler({
    createInstance(type, values) {
      const object = type === 'group' ? new THREE.Group() : type === 'mesh' ? new THREE.Mesh()
        : type === 'shaderMaterial' ? new THREE.ShaderMaterial() : type === 'planeGeometry' ? new THREE.PlaneGeometry(...values.args)
          : type === 'hemisphereLight' ? new THREE.HemisphereLight(...values.args) : type === 'pointLight' ? new THREE.PointLight() : null;
      assert.ok(object, `Unexpected actual opening host ${type}`); update(object, values); return object;
    },
    createTextInstance: text => ({ text }), appendInitialChild: append, appendChild: append, appendChildToContainer: append,
    removeChild: remove, removeChildFromContainer: remove, insertBefore: append, insertInContainerBefore: append,
    supportsMutation: true, isPrimaryRenderer: false, supportsPersistence: false, supportsHydration: false,
    getRootHostContext: () => null, getChildHostContext: () => null, getPublicInstance: value => value,
    finalizeInitialChildren: () => false, prepareForCommit: () => null, resetAfterCommit: () => {}, preparePortalMount: () => {},
    shouldSetTextContent: () => false, prepareUpdate: () => true, commitUpdate: (instance, _payload, _type, _old, values) => update(instance, values),
    commitTextUpdate: () => {}, hideInstance: instance => { instance.visible = false; }, unhideInstance: instance => { instance.visible = true; },
    hideTextInstance: () => {}, unhideTextInstance: () => {}, getCurrentEventPriority: () => DefaultEventPriority,
    beforeActiveInstanceBlur: () => {}, afterActiveInstanceBlur: () => {}, detachDeletedInstance: () => {},
    clearContainer: container => { container.children = []; }, scheduleTimeout: setTimeout, cancelTimeout: clearTimeout, noTimeout: -1,
  });
  const parent = new THREE.Group(), surface = new THREE.Mesh(); parent.position.set(3, -4, 7); parent.rotation.y = .644; parent.add(surface);
  const state = { frames: new Set(), source: new THREE.Texture(), gl: createGl(), camera: new THREE.PerspectiveCamera(), surface,
    hidden: false, focused: true, overlayOpen: false, mode: 'explore', physicsPaused: false,
    presentation: { look: { budget: { reflectionSize: 64, reflectionEveryFrames: 9 } }, time: { vegetation: 3 }, motion: { vegetation: .7 }, reducedMotion: false, reducedEffects: false } };
  const container = { children: [] }, renderer = cpuRenderer;
  const root = renderer.createContainer(container, ConcurrentRoot, null, strict, null, '', error => { throw error; }, null);
  const frame = (delta = 1 / 60) => { currentState = state; for (const { ref } of [...state.frames].sort((a, b) => a.priority - b.priority)) ref.current({ gl: state.gl, camera: state.camera }, delta); };
  const wrap = child => el(CpuContext.Provider, { value: state }, strict ? el(React.StrictMode, null, child) : child);
  const nodes = () => { const result = []; for (const item of container.children) item.traverse?.(node => result.push(node)); return result; };
  return { state, container, nodes, frame,
    render(child, frameBeforePassive = false) {
      currentState = state;
      React.act(() => renderer.flushSync(() => renderer.updateContainer(wrap(child), root, null, () => { if (frameBeforePassive) frame(); })));
      renderer.flushPassiveEffects();
    },
    dispose() { this.render(null); state.source.dispose(); state.gl.previous.dispose(); state.surface.geometry.dispose(); state.surface.material.dispose(); },
  };
}
const disposed = object => { const record = { count: 0 }; object.addEventListener('dispose', () => record.count++); return record; };

function immutableUnderfloorGeometry() {
  const source = readFileSync(new URL('./fixtures/underfloor-before-extraction.txt', import.meta.url), 'utf8');
  assert.equal(hash(source), 'af5e5d5e334fc422042d941f783e1029166dfd8416e55c238cdf0cdef687a67b', 'the exact 21ce695 source fixture is immutable');
  const ast = ts.createSourceFile('UnderfloorForest.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  let constructor;
  function visit(node) {
    if (ts.isCallExpression(node) && node.expression.getText(ast) === 'useMemo'
      && node.arguments[0]?.getText(ast).includes('const trunks: DressingForm[]')) constructor = node.arguments[0];
    ts.forEachChild(node, visit);
  }
  visit(ast); assert.ok(constructor, 'execute the original actual constructor, not a re-created expected algorithm');
  const compiled = ts.transpileModule(`export const createBaseline = ${constructor.getText(ast)};`,
    { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
  const exports = {};
  runInNewContext(compiled, { exports, enabled: true, createTaperedBranchGeometry, mergeArtGeometries });
  return exports.createBaseline();
}

test('authored underfloor retains immutable population and six-limb allocation, UV and index topology', () => {
  const forest = createUnderfloorGeometry();
  // Math.sin's last bits differ between the native macOS and Linux runtimes.
  // Execute the hash-pinned original on this backend. Art positions/normals may
  // change; population, allocations, UVs, indices and single draw group stay exact.
  const baseline = immutableUnderfloorGeometry();
  assert.equal(forest.trunks.length, 34); assert.equal(forest.crowns.length, 30);
  assert.notEqual(JSON.stringify(forest.trunks), JSON.stringify(baseline.trunks));
  assert.notEqual(JSON.stringify(forest.crowns), JSON.stringify(baseline.crowns));
  assert.deepEqual(Object.keys(forest.branches.attributes).sort(), Object.keys(BASELINE.attributes).sort());
  for (const [name, expected] of Object.entries(BASELINE.attributes)) {
    const attribute = forest.branches.getAttribute(name);
    assert.equal(attribute.itemSize, expected.itemSize); assert.equal(attribute.count, expected.count);
    if (name === 'uv') assert.equal(hash(arrayBytes(attribute.array)), hash(arrayBytes(baseline.branches.getAttribute(name).array)), `${name} bytes`);
    else { assert.ok([...attribute.array].every(Number.isFinite)); assert.notEqual(hash(arrayBytes(attribute.array)), hash(arrayBytes(baseline.branches.getAttribute(name).array)), `${name} authored coordinates`); }
  }
  assert.equal(forest.branches.index.count, BASELINE.index.count); assert.equal(hash(arrayBytes(forest.branches.index.array)), BASELINE.index.hash);
  assert.equal(hash(arrayBytes(forest.branches.index.array)), hash(arrayBytes(baseline.branches.index.array)));
  assert.deepEqual(forest.branches.groups, []); forest.branches.dispose(); baseline.branches.dispose();
});

test('floor art changes preserve the original projective, accumulated-mask, stage, sampling and resource code', () => {
  assert.equal(shaderHash(vertexShader), BASELINE.vertexShader);
  const originalAlpha = fragmentShader.replace('uniform float apertureOpacity;', '').replace('vec4(color,apertureOpacity)', 'vec4(color,.94)')
    .replace(/vec2 dampDistance=[\s\S]*?float restored=.*?;/, 'float restored=(1.-smoothstep(.045,.17+second*.1,distance(vUv,vec2(.5,.56))))*first*(.6+second*.4);')
    .replace('vec3(.152,.128,.101),vec3(.24,.208,.17)', 'vec3(.14,.125,.105),vec3(.22,.194,.158)')
    .replace('room*=1.-damp*.24;', 'room*=1.-damp*.19;')
    .replace('float edge=mask*(1.-mask);color=mix(color,room,edge*(.18-second*.1));', 'float edge=mask*(1.-mask);color+=sRGBTransferEOTF(vec4(.09,.12,.13,1.)).rgb*edge;');
  assert.equal(shaderHash(originalAlpha), BASELINE.fragmentShader);
  const forest = new THREE.Texture(), mask = createWetFloorMask(new Uint8Array(4096), 64);
  for (const stage of [0, 1, 2]) {
    const uniforms = createWetFloorUniforms(forest, mask, stage);
    assert.equal(uniforms.stage.value, stage); assert.equal(uniforms.time.value, 0); assert.equal(uniforms.apertureOpacity.value, .94);
  }
  mask.dispose(); forest.dispose();
});

test('supplied stage/time helper matches the frozen numeric frame statements across normal, stalled and invalid deltas', () => {
  // Frozen actual 21ce695 frame statements, independent of the extracted helper.
  function original(uniforms, stage, delta, reducedMotion) {
    const dt = Number.isFinite(delta) && delta >= 0 ? Math.min(delta, .1) : 0;
    uniforms.stage.value = reducedMotion ? stage : THREE.MathUtils.damp(uniforms.stage.value, stage, 2.5, dt);
    if (!reducedMotion) uniforms.time.value += Math.min(dt, .05);
  }
  for (const reduced of [false, true]) {
    const current = { stage: { value: 0 }, time: { value: 0 } }, previous = structuredClone(current);
    for (const stage of [0, 1, 2, 3, 2, 0]) for (const delta of [1 / 144, 1 / 60, 1 / 30, .25, .251, 20, NaN, Infinity, -1, 0]) {
      original(previous, stage, delta, reduced); advanceWetFloorUniforms(current, stage, delta, reduced);
      assert.deepEqual(current, previous);
    }
  }
});

test('private texture view and fixed-size mask borrow source/coverage storage without mutating or disposing it', () => {
  const source = new THREE.Texture(), sourceDispose = disposed(source);
  source.colorSpace = THREE.NoColorSpace; const sourceVersion = source.version, sourceImage = source.image;
  const view = createWetFloorTextureView(source), coverage = new Uint8Array(64 * 64), mask = createWetFloorMask(coverage, 64);
  assert.notEqual(view, source); assert.equal(view.source, source.source); assert.equal(view.colorSpace, THREE.SRGBColorSpace);
  assert.equal(source.colorSpace, THREE.NoColorSpace); assert.equal(source.version, sourceVersion); assert.equal(source.image, sourceImage);
  assert.equal(mask.image.data, coverage); assert.equal(mask.image.width, 64); assert.equal(mask.image.height, 64);
  assert.equal(mask.format, THREE.RedFormat); assert.equal(mask.minFilter, THREE.LinearFilter); assert.equal(mask.magFilter, THREE.LinearFilter); assert.equal(mask.unpackAlignment, 1);
  view.dispose(); mask.dispose(); assert.equal(sourceDispose.count, 0); source.dispose();
});

test('actual capture restores renderer state and original physical parent transform on both success and exceptions', () => {
  for (const failure of [null, 'clear', 'render']) for (const floatColor of [true, false]) {
    const resources = createUnderfloorCaptureResources(128), root = new THREE.Group(), parent = new THREE.Group(), surface = new THREE.Mesh();
    parent.position.set(8, -3, 2); parent.rotation.set(.13, .644, -.07); parent.scale.set(1.2, .8, .9); parent.add(surface);
    const gl = createGl(), camera = new THREE.PerspectiveCamera(), valid = { current: false };
    gl.fail = failure; gl.extensions.has = () => floatColor;
    assert.equal(resources.target.width, 128); assert.equal(resources.target.height, 128); assert.equal(resources.target.depthBuffer, true);
    assert.equal(resources.scene.background.getHexString(), '101918'); assert.equal(resources.scene.fog.color.getHexString(), '24322e'); assert.equal(resources.scene.fog.density, .035);
    if (failure) assert.throws(() => captureUnderfloorFrame(gl, camera, resources, root, surface, valid), /controlled capture/);
    else captureUnderfloorFrame(gl, camera, resources, root, surface, valid);
    assert.deepEqual(root.matrix.elements, parent.matrixWorld.elements); assert.equal(root.matrixWorldNeedsUpdate, true);
    assert.equal(gl.getRenderTarget(), gl.previous); assert.equal(gl.xr.enabled, true); assert.equal(gl.shadowMap.autoUpdate, true);
    assert.equal(valid.current, !failure); assert.equal(resources.target.texture.type, floatColor ? THREE.HalfFloatType : THREE.UnsignedByteType);
    resources.target.dispose(); gl.previous.dispose(); surface.geometry.dispose(); surface.material.dispose();
  }
});

test('installed React cold capture remains valid after passive effects; the old passive reset erases readiness', () => {
  for (const passive of [false, true]) {
    const cpu = createCpuRoot(); cpu.render(el(UnderfloorProbe, { passive }), true);
    assert.equal(cpu.state.gl.captures.length, 1); assert.equal(cpu.state.frames.size, 1);
    assert.equal(cpu.state.result.valid.current, !passive, passive ? 'Former passive reset reproduces the captured readiness race' : 'Current layout initialization precedes capture');
    cpu.dispose(); assert.equal(cpu.state.frames.size, 0);
  }
});

test('quality change resets actual target validity before a pre-passive frame; old reset can skip an uninitialized new target', () => {
  for (const passive of [false, true]) {
    const cpu = createCpuRoot(); cpu.render(el(UnderfloorProbe, { passive })); cpu.frame();
    const firstTarget = cpu.state.gl.captures.at(-1).target, firstDisposed = disposed(firstTarget);
    const branch = cpu.state.gl.captures.at(-1).scene.getObjectByName('underfloor-near-boughs').geometry, branchDisposed = disposed(branch);
    cpu.state.presentation.look.budget.reflectionSize = 128;
    cpu.render(el(UnderfloorProbe, { passive }), true);
    assert.equal(firstDisposed.count, 1); assert.equal(branchDisposed.count, 0, 'Resolution changes retain the actual authored geometry');
    assert.equal(cpu.state.gl.captures.length, passive ? 1 : 2);
    assert.equal(cpu.state.result.valid.current, !passive);
    if (!passive) assert.equal(cpu.state.gl.captures.at(-1).target.width, 128);
    cpu.dispose(); assert.equal(branchDisposed.count, 1);
  }
});

test('actual retained frame pauses for all presentation exclusions and recaptures immediately on resume despite cadence', () => {
  const cpu = createCpuRoot(); cpu.render(el(UnderfloorProbe)); cpu.frame();
  assert.equal(cpu.state.gl.captures.length, 1);
  cpu.frame(); assert.equal(cpu.state.gl.captures.length, 1, 'Ordinary retained capture uses the existing nine-frame budget');
  for (const [key, blocked] of [['hidden', true], ['focused', false], ['overlayOpen', true], ['mode', 'read'], ['physicsPaused', true]]) {
    const previous = cpu.state[key], count = cpu.state.gl.captures.length;
    cpu.state[key] = blocked; cpu.frame(); assert.equal(cpu.state.gl.captures.length, count);
    cpu.state[key] = previous; cpu.frame(); assert.equal(cpu.state.gl.captures.length, count + 1, `${key} resume forces the first meaningful capture`);
    assert.equal(cpu.state.frames.size, 1);
  }
  let count = cpu.state.gl.captures.length;
  cpu.render(el(UnderfloorProbe, { visible: false })); cpu.frame(); assert.equal(cpu.state.gl.captures.length, count);
  cpu.render(el(UnderfloorProbe, { visible: true })); cpu.frame(); assert.equal(cpu.state.gl.captures.length, ++count);
  cpu.render(el(UnderfloorProbe, { stage: 0 })); cpu.frame(); assert.equal(cpu.state.gl.captures.length, count);
  cpu.render(el(UnderfloorProbe, { stage: 1 })); cpu.frame(); assert.equal(cpu.state.gl.captures.length, count + 1);
  cpu.dispose();
});

test('actual owner recovers from a failed initial capture and does not claim depth before a successful render', () => {
  const cpu = createCpuRoot(); cpu.render(el(UnderfloorProbe)); cpu.state.gl.fail = 'render';
  assert.throws(() => cpu.frame(), /controlled capture render failure/); assert.equal(cpu.state.result.valid.current, false);
  assert.equal(cpu.state.gl.getRenderTarget(), cpu.state.gl.previous); assert.equal(cpu.state.gl.xr.enabled, true); assert.equal(cpu.state.gl.shadowMap.autoUpdate, true);
  cpu.state.gl.fail = null; cpu.frame(); assert.equal(cpu.state.result.valid.current, true);
  assert.equal(cpu.state.gl.captures.length, 2); cpu.dispose();
});

test('actual StrictMode quality cycles dispose each target/owned branch lifetime and retain one original subscriber', () => {
  const cpu = createCpuRoot(true); cpu.render(el(UnderfloorProbe)); cpu.frame();
  const targetRecords = [], branchRecords = [];
  const track = () => {
    const capture = cpu.state.gl.captures.at(-1), branch = capture.scene.getObjectByName('underfloor-near-boughs').geometry;
    targetRecords.push(disposed(capture.target)); branchRecords.push(disposed(branch));
  };
  track();
  for (const resolution of [128, 32, 64]) {
    cpu.state.presentation.look.budget.reflectionSize = resolution; cpu.render(el(UnderfloorProbe)); cpu.frame();
    assert.equal(cpu.state.frames.size, 1); track();
  }
  assert.deepEqual(targetRecords.map(record => record.count), [1, 1, 1, 0]);
  assert.ok(branchRecords.every(record => record.count === 0));
  cpu.state.presentation.look.budget.reflectionSize = 0; cpu.render(el(UnderfloorProbe)); cpu.frame();
  assert.ok(targetRecords.every(record => record.count === 1)); assert.ok(branchRecords.every(record => record.count === 1));
  assert.equal(cpu.state.result.texture, undefined); assert.equal(cpu.state.result.valid.current, false);
  cpu.state.presentation.look.budget.reflectionSize = 64; cpu.render(el(UnderfloorProbe)); cpu.frame();
  const remount = cpu.state.gl.captures.at(-1), finalTarget = disposed(remount.target), finalBranch = disposed(remount.scene.getObjectByName('underfloor-near-boughs').geometry);
  assert.equal(cpu.state.result.valid.current, true); assert.equal(cpu.state.frames.size, 1);
  cpu.dispose(); assert.equal(cpu.state.frames.size, 0); assert.equal(finalTarget.count, 1); assert.equal(finalBranch.count, 1);
});

test('shared-clock bough comfort is bounded and the actual hook respects every reduced motion/effect exclusion', () => {
  for (let time = 0; time <= 120; time += .25) {
    const pose = openingBoughPose(time, .8, false);
    assert.ok(Math.abs(pose.x) <= .0011 * .8); assert.ok(Math.abs(pose.z) <= .0034 * .8);
    assert.deepEqual(openingBoughPose(time, .8, true), { x: 0, z: 0 });
  }
  for (const time of [NaN, Infinity, -Infinity]) assert.deepEqual(openingBoughPose(time, 1, false), { x: 0, z: 0 });
  const cpu = createCpuRoot(); cpu.render(el(UnderfloorProbe)); cpu.frame();
  const bough = cpu.state.gl.captures.at(-1).scene.getObjectByName('underfloor-shared-clock-bough-motion');
  let expected = openingBoughPose(3, .7, false); close(bough.rotation.x, expected.x); close(bough.rotation.z, expected.z);
  for (const key of ['reducedMotion', 'reducedEffects']) {
    cpu.state.presentation[key] = true; cpu.frame(); assert.equal(bough.rotation.x, 0); assert.equal(bough.rotation.z, 0);
    cpu.state.presentation[key] = false;
  }
  cpu.render(el(UnderfloorProbe, { reducedMotion: true })); cpu.frame(); assert.equal(bough.rotation.x, 0); assert.equal(bough.rotation.z, 0);
  cpu.render(el(UnderfloorProbe)); cpu.state.presentation.time.vegetation = 11; cpu.frame();
  expected = openingBoughPose(11, .7, false); close(bough.rotation.x, expected.x); close(bough.rotation.z, expected.z);
  assert.equal(cpu.state.frames.size, 1); cpu.dispose();
});

test('actual wet-floor owner retains stage/time activity, uploads real brush coverage, publishes only drawn readiness and releases private textures', () => {
  const cpu = createCpuRoot(), sourceDispose = disposed(cpu.state.source);
  cpu.state.presentation.look.budget.reflectionSize = 0;
  let appearance = openingRoomAppearance(.4);
  cpu.render(el(WetFloorReveal, { stage: 2, apertureOpacity: () => appearance.apertureOpacity }));
  const surface = cpu.nodes().find(node => node.name === 'wipeable-wet-floor'), uniforms = surface.material.uniforms;
  const view = uniforms.forest.value, mask = uniforms.coverageMask.value, viewDispose = disposed(view), maskDispose = disposed(mask);
  assert.notEqual(view, cpu.state.source); assert.equal(mask.image.data, brushRuntime.floorBrush.coverage);
  assert.equal(surface.geometry.parameters.width, 12.8); assert.equal(surface.geometry.parameters.height, 12.5);
  assert.equal(cpu.state.frames.size, 2, 'Existing capture and floor frame owners remain the only subscriptions');
  cpu.frame(); assert.equal(uniforms.stage.value, 2); close(uniforms.time.value, 1 / 60); assert.equal(uniforms.hasDepth.value, 0);
  assert.equal(cpu.state.gl.domElement.dataset.openingRenderedStage, undefined);
  surface.onAfterRender(cpu.state.gl); assert.equal(cpu.state.gl.domElement.dataset.openingRenderedStage, '2');
  const maskVersion = mask.version; brushRuntime.beginFloorStroke(); brushRuntime.brushFloor(.45, .56); brushRuntime.brushFloor(.49, .56);
  cpu.frame(); assert.ok(mask.version > maskVersion); assert.ok(mask.image.data.some(value => value > 0));
  cpu.render(el(WetFloorReveal, { stage: 3, apertureOpacity: () => appearance.apertureOpacity }));
  const before = uniforms.stage.value, time = uniforms.time.value;
  cpu.state.overlayOpen = true; cpu.frame(.5); assert.equal(uniforms.stage.value, before); assert.equal(uniforms.time.value, time);
  cpu.state.overlayOpen = false; cpu.state.physicsPaused = true; cpu.frame(.5); assert.equal(uniforms.stage.value, before);
  cpu.state.physicsPaused = false; cpu.frame(.5); assert.ok(uniforms.stage.value > before); close(uniforms.time.value - time, .05);
  surface.onAfterRender(cpu.state.gl); assert.equal(cpu.state.gl.domElement.dataset.openingRenderedStage, '2', 'Unsettled stage cannot publish a drawn stage 3');
  appearance = openingRoomAppearance(.87); cpu.frame(); assert.equal(uniforms.apertureOpacity.value, appearance.apertureOpacity);
  cpu.render(el(WetFloorReveal, { stage: 3, reducedMotion: true, apertureOpacity: () => appearance.apertureOpacity }));
  const reducedTime = uniforms.time.value; cpu.frame(); assert.equal(uniforms.stage.value, 3); assert.equal(uniforms.time.value, reducedTime);
  surface.onAfterRender(cpu.state.gl); assert.equal(cpu.state.gl.domElement.dataset.openingRenderedStage, '3');
  cpu.render(null); assert.equal(viewDispose.count, 1); assert.equal(maskDispose.count, 1); assert.equal(sourceDispose.count, 0);
  assert.equal(cpu.state.gl.domElement.dataset.openingRenderedStage, undefined); assert.equal(cpu.state.frames.size, 0);
  cpu.dispose();
});
