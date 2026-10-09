import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync, existsSync } from 'node:fs';
import { createRequire, register } from 'node:module';
import { pathToFileURL } from 'node:url';
import * as THREE from 'three';
import ts from 'typescript';
import { distantTrunkFitsTerrain } from '../src/components/three/environment/distantWoodlandBounds.ts';
import { createTerrainGeometry } from '../src/world/terrain/terrainGeometry.ts';
import { TERRAIN_SIZE } from '../src/world/terrain/worldConstants.ts';
register(new URL('./canonical-node-loader.mjs', import.meta.url));
const { journeyScenes } = await import('../src/data/journeyBlueprint.ts');
const { getJourneyEntryWorldPosition } = await import('../src/data/journeyWorldLayout.ts');

// Exercise the actual layout effect and JSX geometry on the CPU. Only React's
// scheduling is replaced; instance matrices and active counts come from source.
const require = createRequire(import.meta.url), effects = [];
const hookKey = '__distantWoodlandBoundaryHooks';
globalThis[hookKey] = {
  memo: fn => fn, useRef: () => ({ current: null }), useMemo: fn => fn(),
  useEffect: () => {}, useLayoutEffect: fn => effects.push(fn),
};
const sourceURL = new URL('../src/components/three/environment/DistantWoodland.tsx', import.meta.url);
const source = readFileSync(sourceURL, 'utf8');
let compiled = ts.transpileModule(source, { compilerOptions: {
  jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022,
} }).outputText;
compiled = compiled.replace(/import \{[^}]+\} from "react";/, `const {memo,useEffect,useLayoutEffect,useMemo,useRef}=globalThis.${hookKey};`);
compiled = compiled.replace(/from "([^"]+)"/g, (_, specifier) => {
  let url;
  if (specifier.startsWith('.')) { url = new URL(specifier, sourceURL); if (!existsSync(url)) url = new URL(specifier + '.ts', sourceURL); }
  else url = pathToFileURL(require.resolve(specifier));
  return `from ${JSON.stringify(url.href)}`;
});
const { DistantWoodland } = await import('data:text/javascript;base64,' + Buffer.from(compiled).toString('base64'));
delete globalThis[hookKey];

function render(origin, quality = 'high', quiet = false) {
  effects.length = 0;
  const group = DistantWoodland({ origin, quality, quiet, sampleGroundY: () => 11 });
  const meshes = group.props.children.map(element => {
    const children = [element.props.children].flat();
    const shape = children.find(child => child?.type === 'cylinderGeometry');
    const geometry = element.props.args[0] ?? new THREE.CylinderGeometry(...shape.props.args);
    const mesh = new THREE.InstancedMesh(geometry, new THREE.MeshStandardMaterial(), element.props.args[2]);
    element.ref.current = mesh;
    return mesh;
  });
  effects.forEach(fn => fn());
  return { meshes, dispose() { for (const mesh of meshes) { mesh.geometry.dispose(); mesh.material.dispose(); mesh.dispose(); } } };
}
function roots(geometry, matrix) {
  const position = geometry.getAttribute('position');
  const points = Array.from({ length: position.count }, (_, index) => new THREE.Vector3().fromBufferAttribute(position, index));
  const bottom = Math.min(...points.map(point => point.y));
  return new THREE.Box3().setFromPoints(points.filter(point => point.y === bottom).map(point => point.applyMatrix4(matrix)));
}
function instanceRows(mesh) {
  return Array.from({ length: mesh.count }, (_, index) => { const matrix = new THREE.Matrix4(); mesh.getMatrixAt(index, matrix); return matrix; });
}
const terrain = createTerrainGeometry(); terrain.computeBoundingBox();
const bounds = terrain.boundingBox;
function inside(box) { return box.min.x >= bounds.min.x - 1e-5 && box.max.x <= bounds.max.x + 1e-5 && box.min.z >= bounds.min.z - 1e-5 && box.max.z <= bounds.max.z + 1e-5; }

test('finite terrain edge rejects roots that cross any edge or corner even with an inside centre', () => {
  assert.equal(bounds.min.x, -TERRAIN_SIZE / 2); assert.equal(bounds.max.z, TERRAIN_SIZE / 2);
  const geometry = new THREE.CylinderGeometry(.35, 1, 1, 5, 1), object = new THREE.Object3D();
  let straddlingInside = 0;
  for (const edge of [-1, 1]) for (const axis of ['x', 'z']) for (const offset of [-1.1, -.2, 0, .2, 1.1]) {
    object.position.set(0, 4, 0); object.position[axis] = edge * (TERRAIN_SIZE / 2 + offset);
    object.rotation.set(.035, .73, -.025); object.scale.set(.6, 20, .6); object.updateMatrix();
    const root = roots(geometry, object.matrix), expected = inside(root);
    assert.equal(distantTrunkFitsTerrain(geometry, object.matrix), expected, `${axis}/${edge}/${offset}`);
    if (offset < 0 && !expected) straddlingInside++;
  }
  assert.ok(straddlingInside >= 2, 'A centre-only test would incorrectly keep actual overhanging roots');
  for (const x of [-430, 430]) for (const z of [-430, 430]) {
    object.position.set(x, 4, z); object.updateMatrix();
    assert.equal(distantTrunkFitsTerrain(geometry, object.matrix), false);
  }
  geometry.dispose();
});

test('every rendered far trunk fits actual terrain at all 32 canonical scene centres and all quality prefixes', () => {
  assert.equal(journeyScenes.length, 32);
  for (const scene of journeyScenes) {
    const [x, , z] = getJourneyEntryWorldPosition(scene.keystoneEntryId);
    const high = render([x, 0, z]);
    try {
      const [trunks, crowns] = high.meshes, highRows = instanceRows(trunks);
      assert.equal(trunks.count, crowns.count);
      assert.ok(trunks.count <= 96);
      assert.ok(highRows.every(matrix => inside(roots(trunks.geometry, matrix))), scene.id);
      assert.equal(new Set(highRows.map(matrix => `${matrix.elements[12]}:${matrix.elements[14]}`)).size, trunks.count, 'No clamped tree stack');
      for (const [quality, quiet, capacity] of [['low', false, 40], ['medium', false, 64], ['high', true, 16]]) {
        const small = render([x, 0, z], quality, quiet);
        try {
          const rows = instanceRows(small.meshes[0]);
          assert.ok(rows.length <= capacity);
          assert.deepEqual(rows.map(row => row.elements), highRows.slice(0, rows.length).map(row => row.elements), scene.id + ' stable retained prefix');
          assert.deepEqual(instanceRows(small.meshes[1]).map(row => row.elements), instanceRows(crowns).slice(0, rows.length).map(row => row.elements), scene.id + ' original crown shapes survive packing');
          for (let i = 0; i < rows.length; i++) {
            const smallColor = new THREE.Color(), highColor = new THREE.Color(); small.meshes[1].getColorAt(i, smallColor); crowns.getColorAt(i, highColor);
            assert.deepEqual(smallColor, highColor, scene.id + ' original tints survive packing');
          }
        } finally { small.dispose(); }
      }
    } finally { high.dispose(); }
  }
});

test('Crown excludes the native floating trunk witnesses while preserving the unaffected centre woodland', () => {
  const crown = render([10, 28.40598739269168, 394]), centre = render([0, 0, 0]);
  try {
    assert.equal(centre.meshes[0].count, 96, 'Interior far population remains complete');
    const matrices = instanceRows(crown.meshes[0]);
    assert.ok(matrices.length < 96 && matrices.length > 0);
    for (const [x, z] of [[-9.783528594802844, 443.8516307991493], [-5.573598878066646, 468.01661259419717], [-10.533560184381914, 495.22145624437064], [-11.946178843186331, 466.19586332358455], [-5.685223558185887, 489.62647979735357]]) {
      assert.ok(!matrices.some(matrix => Math.abs(matrix.elements[12] - x) < .0001 && Math.abs(matrix.elements[14] - z) < .0001), 'Native floating witness must be absent');
    }
    assert.match(source, /distantTrunkFitsTerrain\(trunks\.current!\.geometry, dummy\.matrix\)/);
  } finally { crown.dispose(); centre.dispose(); terrain.dispose(); }
});
