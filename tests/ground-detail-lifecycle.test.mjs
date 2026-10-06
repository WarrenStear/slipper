import assert from 'node:assert/strict';
import test, { after } from 'node:test';
import { readFileSync } from 'node:fs';
import { mkdtemp, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';
import React from 'react';
import * as THREE from 'three';
import ts from 'typescript';
import { build } from 'esbuild';
import { normalizeGeneratedWorldState } from '../src/data/worldStateNormalization.ts';
import { buildMazePathSegments, curvedPathPointAt } from '../src/world/terrain/worldPaths.ts';
import { terrainElevationAtPoint } from '../src/world/terrain/terrainSampler.ts';
import { RENDER_QUALITY_PROFILES } from '../src/components/three/renderQuality.ts';

const require = createRequire(import.meta.url), Reconciler = require('react-reconciler');
const { ConcurrentRoot, DefaultEventPriority } = require('react-reconciler/constants');
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
const OwnerContext = React.createContext(null), el = React.createElement;
globalThis.__slipperGroundDetailCpu = {
  useThree: () => React.useContext(OwnerContext),
  // Like R3F, the frame pump subscribes in a layout effect, with a live callback.
  useFrame(callback) {
    const state = React.useContext(OwnerContext), ref = React.useRef(callback); ref.current = callback;
    React.useLayoutEffect(() => { state.frames.add(ref); return () => state.frames.delete(ref); }, [state]);
  },
};

const repo = resolve(fileURLToPath(new URL('../', import.meta.url)));
const source = readFileSync(new URL('../src/components/three/StoryScene.tsx', import.meta.url), 'utf8');
const ast = ts.createSourceFile('StoryScene.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
const ownerNode = ast.statements.find(node => ts.isFunctionDeclaration(node) && node.name?.text === 'NarrativeGroundDetailField');
assert.ok(ownerNode);
const initializer = ownerNode.body.statements.find(node => ts.isExpressionStatement(node)
  && ts.isCallExpression(node.expression) && ['useEffect', 'useLayoutEffect'].includes(node.expression.expression.getText(ast))
  && node.getText(ast).includes('rootRef.current'));
assert.ok(initializer);
const oldInitializer = readFileSync(new URL('./fixtures/ground-detail-passive-initializer.txt', import.meta.url), 'utf8').trim();
const functions = ['groundDetailKindForBiome', 'groundDetailTint', 'useGroundDetailGeometries'];
const constants = ['GROUND_DETAIL_CELL_SIZE', 'GROUND_DETAIL_CELL_RADIUS', 'GROUND_DETAILS_PER_CELL', 'GROUND_DETAIL_INSTANCE_COUNT'];
const dependencies = ast.statements.filter(node => ts.isFunctionDeclaration(node) && functions.includes(node.name?.text)
  || ts.isVariableStatement(node) && node.declarationList.declarations.some(declaration => constants.includes(declaration.name.getText(ast))))
  .map(node => node.getText(ast)).join('\n');
const currentOwner = ownerNode.getText(ast);
const formerOwner = currentOwner.replace(initializer.getText(ast), oldInitializer);
// This negative control reproduces the retained-layout bug in a layout-only fix.
const assignment = initializer.expression.arguments[0].body.statements.find(node => ts.isExpressionStatement(node)
  && node.getText(ast).startsWith('lastCellRef.current ='));
assert.ok(assignment);
const noInvalidationOwner = currentOwner.replace(assignment.getText(ast), '');
const fixture = await mkdtemp(join(tmpdir(), 'slipper-ground-owner-cpu-'));
await symlink(join(repo, 'node_modules'), join(fixture, 'node_modules'), 'dir');
after(async () => { delete globalThis.__slipperGroundDetailCpu; await rm(fixture, { recursive: true, force: true }); });

async function loadOwner(name, declaration) {
  // Execute declarations extracted by the TypeScript AST from the actual owner,
  // with its real placement/material helpers. Only the host/frame backend changes.
  const code = `import React,{useEffect,useLayoutEffect,useMemo,useRef} from 'react';
    import * as THREE from 'three';
    import {resolveWorldVisualState} from ${JSON.stringify(join(repo, 'src/components/three/worldVisualState.ts'))};
    import {hashString,worldSeededUnit} from ${JSON.stringify(join(repo, 'src/world/worldMath.ts'))};
    import {nearestEntryByXZ} from ${JSON.stringify(join(repo, 'src/world/terrain/worldPlacement.ts'))};
    import {nearestMazePathSegment,pathSegmentAngle} from ${JSON.stringify(join(repo, 'src/world/terrain/worldPaths.ts'))};
    import {CLEARING_SAFE_RADIUS,CORRIDOR_BASE_WIDTH,TERRAIN_BASE_Y} from ${JSON.stringify(join(repo, 'src/world/terrain/worldConstants.ts'))};
    import {terrainElevationAtPoint} from ${JSON.stringify(join(repo, 'src/world/terrain/terrainSampler.ts'))};
    const {useThree,useFrame}=globalThis.__slipperGroundDetailCpu;
    ${dependencies}\n${declaration}\nexport {NarrativeGroundDetailField};`;
  const result = await build({ stdin: { contents: code, resolveDir: repo, sourcefile: `${name}.tsx`, loader: 'tsx' },
    bundle: true, platform: 'node', format: 'esm', packages: 'external', write: false,
    jsxFactory: 'React.createElement', jsxFragment: 'React.Fragment', logLevel: 'silent' });
  const path = join(fixture, `${name}.mjs`); await writeFile(path, result.outputFiles[0].text);
  return (await import(pathToFileURL(path).href)).NarrativeGroundDetailField;
}
const Current = await loadOwner('current-owner', currentOwner), Former = await loadOwner('former-passive-owner', formerOwner);
const NoInvalidation = await loadOwner('layout-without-cache-invalidation', noInvalidationOwner);

const entries = normalizeGeneratedWorldState(JSON.parse(readFileSync(new URL('../src/data/worldState.json', import.meta.url), 'utf8'))).entries;
const pathSegments = buildMazePathSegments(entries), activeEntry = entries.find(entry => entry.id === 'fragment-008');
const narrativeWorldState = { visitedCount: 4, totalCount: entries.length, traceCount: 0, fireCount: 0, waterCount: 0,
  memoryCount: 0, thresholdCount: 0, crownCount: 0, fireWaterBalance: 0, explorationDepth: .12, memoryPressure: .05, symbolicWeight: 0 };
const route = pathSegments.find(segment => segment.key === 'fragment-008::fragment-010');
const point = curvedPathPointAt(route, .3, narrativeWorldState);
const camera = new THREE.PerspectiveCamera(); camera.position.set(point.x,
  -1.255 + terrainElevationAtPoint(point.x, point.y, entries, pathSegments, narrativeWorldState) + 1.7, point.y);
const props = quality => ({ entries, pathSegments, activeEntry, narrativeWorldState, qualityProfile: RENDER_QUALITY_PROFILES[quality] });
let cpuRenderer;

function createCpuRoot(strict = false) {
  const append = (parent, child) => { if (child.isMaterial) parent.material = child; else if (parent.isObject3D) parent.add(child); else parent.children.push(child); };
  const remove = (parent, child) => { if (parent.isObject3D && child.isObject3D) parent.remove(child); else if (parent.children) parent.children = parent.children.filter(item => item !== child); };
  const update = (instance, values) => {
    for (const [key, value] of Object.entries(values)) {
      if (['children', 'args', 'ref', 'key'].includes(key)) continue;
      if (instance[key]?.isColor) instance[key].set(value); else instance[key] = value;
    }
  };
  const renderer = cpuRenderer ??= Reconciler({
    createInstance(type, values) {
      const instance = type === 'group' ? new THREE.Group() : type === 'instancedMesh'
        ? new THREE.InstancedMesh(...values.args) : type === 'meshStandardMaterial'
          ? new THREE.MeshStandardMaterial() : type === 'meshBasicMaterial' ? new THREE.MeshBasicMaterial() : null;
      assert.ok(instance, `Unexpected actual ground owner host: ${type}`); update(instance, values); return instance;
    },
    createTextInstance: text => ({ text }), appendInitialChild: append, appendChild: append, appendChildToContainer: append,
    removeChild: remove, removeChildFromContainer: remove, insertBefore: append, insertInContainerBefore: append,
    supportsMutation: true, isPrimaryRenderer: false, supportsPersistence: false, supportsHydration: false,
    getRootHostContext: () => null, getChildHostContext: () => null, getPublicInstance: instance => instance,
    finalizeInitialChildren: () => false, prepareForCommit: () => null, resetAfterCommit: () => {}, preparePortalMount: () => {},
    shouldSetTextContent: () => false, prepareUpdate: () => true,
    commitUpdate: (instance, _payload, _type, _old, values) => update(instance, values), commitTextUpdate: () => {},
    hideInstance: instance => { instance.visible = false; }, unhideInstance: instance => { instance.visible = true; },
    hideTextInstance: () => {}, unhideTextInstance: () => {}, getCurrentEventPriority: () => DefaultEventPriority,
    beforeActiveInstanceBlur: () => {}, afterActiveInstanceBlur: () => {}, detachDeletedInstance: () => {},
    clearContainer: container => { container.children = []; }, scheduleTimeout: setTimeout, cancelTimeout: clearTimeout, noTimeout: -1,
  });
  const container = { children: [] }, state = { camera: camera.clone(), frames: new Set() };
  const root = renderer.createContainer(container, ConcurrentRoot, null, strict, null, '', error => { throw error; }, null);
  const meshes = () => container.children.flatMap(group => group.isGroup ? group.children : []).filter(mesh => mesh.isInstancedMesh);
  const snapshot = () => meshes().map(mesh => ({ count: mesh.count, capacity: mesh.instanceMatrix.count,
    version: mesh.instanceMatrix.version, usage: mesh.instanceMatrix.usage,
    geometry: mesh.geometry, positions: Array.from(mesh.geometry.attributes.position.array),
    indices: mesh.geometry.index ? Array.from(mesh.geometry.index.array) : null, matrices: Array.from(mesh.instanceMatrix.array) }));
  const frame = () => { for (const ref of [...state.frames]) ref.current({ camera: state.camera }, 1 / 60); return snapshot(); };
  const wrap = child => el(OwnerContext.Provider, { value: state }, strict ? el(React.StrictMode, null, child) : child);
  return { state, renderer, snapshot, meshes, frame,
    render(child, firstFrame = false) {
      let beforePassive;
      React.act(() => renderer.flushSync(() => renderer.updateContainer(wrap(child), root, null,
        () => { if (firstFrame) beforePassive = frame(); })));
      renderer.flushPassiveEffects(); return beforePassive;
    },
    flush: callback => React.act(() => renderer.flushSync(callback)),
  };
}
const counts = snapshot => snapshot.map(mesh => mesh.count);
const bytes = snapshot => snapshot.map(({ count, capacity, matrices, positions, indices }) => ({ count, capacity, matrices, positions, indices }));

test('actual cold ground owner survives a frame before passive effects; the former owner loses the upload', () => {
  const former = createCpuRoot(), current = createCpuRoot();
  const oldFirst = former.render(el(Former, props('high')), true), first = current.render(el(Current, props('high')), true);
  assert.deepEqual(counts(first), [11, 2, 2, 0, 0, 0]);
  assert.deepEqual(bytes(oldFirst), bytes(first), 'Authored cold placement math and buffers are unchanged');
  assert.deepEqual(counts(former.snapshot()), [0, 0, 0, 0, 0, 0], 'The installed React passive effect reproduces the captured cold defect');
  assert.deepEqual(bytes(current.snapshot()), bytes(first));
  assert.deepEqual(counts(former.frame()), [0, 0, 0, 0, 0, 0], 'A valid cached cell prevents the former owner from recovering');
  assert.equal(current.state.frames.size, 1); current.render(null); former.render(null);
});

test('actual StrictMode layout replay rebuilds identical populations on the existing next frame', () => {
  const cpu = createCpuRoot(true), first = cpu.render(el(Current, props('high')), true);
  const rebuilt = cpu.frame();
  assert.deepEqual(bytes(rebuilt), bytes(first)); assert.equal(cpu.state.frames.size, 1);
  assert.ok(rebuilt.every(mesh => mesh.capacity === 98 && mesh.usage === THREE.DynamicDrawUsage));
  cpu.render(null); assert.equal(cpu.state.frames.size, 0);
});

test('actual owner preserves exact authored matrices through all quality tiers and return', () => {
  const current = createCpuRoot(), former = createCpuRoot();
  current.render(el(Current, props('high')), true); former.render(el(Former, props('high')), true);
  const currentGeometries = current.snapshot().map(mesh => mesh.geometry);
  for (const quality of ['low', 'medium', 'cinematic', 'high', 'low', 'high']) {
    current.render(el(Current, props(quality))); former.render(el(Former, props(quality)));
    assert.deepEqual(bytes(current.frame()), bytes(former.frame()), `Warm ${quality} seed/geometry/population/matrix parity`);
    assert.deepEqual(current.snapshot().map(mesh => mesh.geometry), currentGeometries);
    assert.equal(current.state.frames.size, 1);
  }
  current.render(null); former.render(null);
});

test('a retained Suspense owner invalidates its cached cell when layout reconnects', async () => {
  for (const [Owner, shouldRecover] of [[Current, true], [NoInvalidation, false]]) {
    const cpu = createCpuRoot(); let suspend, resolvePending, ready = false;
    const pending = new Promise(resolvePromise => { resolvePending = () => { ready = true; resolvePromise(); }; });
    function Parent() {
      const [blocked, setBlocked] = React.useState(false); suspend = () => setBlocked(true);
      if (blocked && !ready) throw pending;
      return el(Owner, props('high'));
    }
    const first = cpu.render(el(React.Suspense, { fallback: null }, el(Parent)), true);
    cpu.flush(suspend); assert.equal(cpu.state.frames.size, 0, 'Retained layout frame subscription disconnects');
    await React.act(async () => { resolvePending(); await pending; }); cpu.renderer.flushPassiveEffects();
    assert.equal(cpu.state.frames.size, 1, 'Exactly one original frame subscriber reconnects');
    const restored = cpu.frame();
    if (shouldRecover) assert.deepEqual(bytes(restored), bytes(first));
    else assert.deepEqual(counts(restored), [0, 0, 0, 0, 0, 0], 'A layout-only reset without cache invalidation reproduces the retained defect');
    cpu.render(null);
  }
});

test('reduced-effect unmount/remount returns cold authored counts and disposes actual owner geometry', () => {
  const cpu = createCpuRoot(), first = cpu.render(el(Current, props('high')), true);
  const disposed = first.map(mesh => { const item = { count: 0 }; mesh.geometry.addEventListener('dispose', () => item.count++); return item; });
  cpu.render(null); assert.equal(cpu.state.frames.size, 0); assert.ok(disposed.every(item => item.count === 1));
  const remounted = cpu.render(el(Current, props('high')), true);
  assert.deepEqual(bytes(remounted), bytes(first)); assert.deepEqual(bytes(cpu.snapshot()), bytes(first));
  cpu.render(null);
});
