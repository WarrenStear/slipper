import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import * as THREE from 'three';
import { buildForest } from '../src/workers/forestWorker.ts';
import {
  FOREST_ARCHETYPES, FOREST_REFERENCE_CROWN_HEIGHT, FOREST_REFERENCE_CROWN_SCALE,
  FOREST_REFERENCE_TRUNK_SCALE, createForestTrunkLibrary, createForestCrownLibrary,
  createOrganicCrownGeometry, getForestArchetypeBranchSupports,
} from '../src/world/forest/forestGeometry.ts';
import {
  applyRootedForestPresentation, disposeForestMorphWeights, forestArchetypeAtWorldPosition,
  forestReferenceCrownTransform, initializeForestMorphWeights, setForestArchetypeAt,
} from '../src/world/forest/forestInstancePresentation.ts';
import { distantWoodlandLayout } from '../src/components/three/environment/distantWoodlandLayout.ts';

const readMorph = (mesh, index) => {
  const scratch = { morphTargetInfluences: Array(FOREST_ARCHETYPES.length).fill(0) };
  mesh.getMorphAt(index, scratch);
  return scratch.morphTargetInfluences;
};
const createPair = (capacity = 243, detail = 0) => {
  const geometries = [createForestTrunkLibrary(), createForestCrownLibrary(detail)];
  const material = new THREE.MeshStandardMaterial();
  const meshes = geometries.map(geometry => new THREE.InstancedMesh(geometry, material, capacity));
  return { meshes, dispose: () => { meshes.forEach(mesh => mesh.dispose()); geometries.forEach(geometry => geometry.dispose()); material.dispose(); } };
};

test('full forest morph capacity survives active count zero and the last populated row', () => {
  const pair = createPair(), [trunks, crowns] = pair.meshes;
  try {
    for (const mesh of [trunks, crowns]) {
      mesh.count = 0;
      assert.equal(initializeForestMorphWeights(mesh), true);
      assert.equal(mesh.morphTexture.image.width, 9);
      assert.equal(mesh.morphTexture.image.height, 243);
      for (let index = 0; index < 243; index++) {
        const family = index % 8;
        setForestArchetypeAt(mesh, index, family);
        assert.deepEqual(readMorph(mesh, index), Array.from({ length: 8 }, (_, i) => Number(i === family)));
      }
      mesh.count = 243;
      assert.equal(readMorph(mesh, 242)[2], 1);
      assert.throws(() => setForestArchetypeAt(mesh, 243, 0), RangeError);
      assert.throws(() => setForestArchetypeAt(mesh, 0, 8), RangeError);
    }
  } finally { pair.dispose(); }
});

test('family selection follows world positions rather than packing, quality or numeric transport', () => {
  const positions = Array.from({ length: 256 }, (_, i) => [i * .79371 - 95.2, (i * 31 % 137) * .87234 - 58.1]);
  const families = positions.map(([x, z]) => forestArchetypeAtWorldPosition(x, z));
  assert.equal(new Set(families).size, 8);
  const byPosition = new Map(positions.map(([x, z], i) => [`${x}:${z}`, families[i]]));
  for (const [x, z] of [...positions].reverse()) {
    assert.equal(forestArchetypeAtWorldPosition(x, z), byPosition.get(`${x}:${z}`));
    assert.equal(forestArchetypeAtWorldPosition(Math.fround(x), Math.fround(z)), byPosition.get(`${x}:${z}`));
  }
});

const config = {
  cellSize: 7, cellRadius: 4, treesPerCell: 3, instanceCount: 243,
  clearingSafeRadius: 7.2, corridorBaseWidth: 5.2, corridorMinWidth: 3.6, treeColliderLimit: 36,
  terrainBaseY: -1.255, terrainColliderY: -1.34, terrainSize: 120, terrainSegments: 32,
  crownedRampWidth: 12, cameraX: 0, cameraZ: 0, cellX: 0, cellZ: 0,
  explorationDepth: .5, memoryPressure: .4, forestDensity: 1, pathClarity: .86,
  clearings: [{ id: 'wood', chapter: 'The First Wood', position: [0, 0, 0] }], paths: [],
};

test('actual worker payloads and colliders remain exact while paired crowns meet their authored branches', () => {
  for (const cellRadius of [2, 3, 4]) {
    const result = buildForest({ type: 'BUILD_FOREST', requestId: 1, config: { ...config, cellRadius } });
    const untouched = structuredClone(result), pair = createPair(243, cellRadius === 4 ? 2 : 0);
    const [trunks, crowns] = pair.meshes;
    try {
      assert.equal(result.trunkCount, result.crownCount); assert.ok(result.trunkCount > 0);
      for (const [mesh, matrices, colors, count] of [
        [trunks, result.trunkMatrices, result.trunkColors, result.trunkCount],
        [crowns, result.crownMatrices, result.crownColors, result.crownCount],
      ]) {
        mesh.count = count; mesh.instanceMatrix.array.set(matrices);
        mesh.instanceColor = new THREE.InstancedBufferAttribute(colors.slice(), 3);
      }
      applyRootedForestPresentation(trunks, crowns);
      assert.deepEqual(result, untouched, 'Presentation cannot mutate transferred worker buffers or colliders');
      assert.deepEqual(trunks.instanceMatrix.array, result.trunkMatrices);
      assert.deepEqual(trunks.instanceColor.array, result.trunkColors);
      assert.deepEqual(crowns.instanceColor.array, result.crownColors);
      assert.equal(trunks.count, result.trunkCount); assert.equal(crowns.count, result.crownCount);
      assert.notDeepEqual(crowns.instanceMatrix.array, result.crownMatrices, 'The authored canopy follows its skeleton instead of the old independent crown yaw');
      const trunkMatrix = new THREE.Matrix4(), crownMatrix = new THREE.Matrix4(), expectedMatrix = new THREE.Matrix4();
      for (let index = 0; index < trunks.count; index++) {
        trunks.getMatrixAt(index, trunkMatrix); crowns.getMatrixAt(index, crownMatrix);
        const family = forestArchetypeAtWorldPosition(trunkMatrix.elements[12], trunkMatrix.elements[14]);
        assert.deepEqual(readMorph(trunks, index), readMorph(crowns, index));
        assert.equal(readMorph(trunks, index)[family], 1);
        expectedMatrix.multiplyMatrices(trunkMatrix, forestReferenceCrownTransform());
        for (let element = 0; element < 16; element++) assert.ok(Math.abs(crownMatrix.elements[element] - expectedMatrix.elements[element]) < 1e-5);
        for (const support of getForestArchetypeBranchSupports(FOREST_ARCHETYPES[family])) {
          const branch = new THREE.Vector3(support[0] / FOREST_REFERENCE_TRUNK_SCALE[0], support[1] / FOREST_REFERENCE_TRUNK_SCALE[1] - .5, support[2] / FOREST_REFERENCE_TRUNK_SCALE[2]).applyMatrix4(trunkMatrix);
          const leaf = new THREE.Vector3(support[0] / FOREST_REFERENCE_CROWN_SCALE[0], (support[1] - FOREST_REFERENCE_CROWN_HEIGHT) / FOREST_REFERENCE_CROWN_SCALE[1], support[2] / FOREST_REFERENCE_CROWN_SCALE[2]).applyMatrix4(crownMatrix);
          assert.ok(branch.distanceTo(leaf) < 2e-5, 'World-space foliage support is retained through worker height, width, heading and lean');
        }
        const target = crowns.geometry.morphAttributes.position[family];
        for (let vertex = 0; vertex < target.count; vertex += 11) {
          const point = new THREE.Vector3().fromBufferAttribute(target, vertex).applyMatrix4(crownMatrix);
          assert.ok(crowns.boundingBox.containsPoint(point));
          assert.ok(point.distanceTo(crowns.boundingSphere.center) <= crowns.boundingSphere.radius + 1e-5);
        }
      }
    } finally { pair.dispose(); }
  }
});

test('morph weights reuse their capacity and release exactly once on replacement or native mesh disposal', () => {
  const pair = createPair(26), [mesh] = pair.meshes;
  try {
    initializeForestMorphWeights(mesh);
    const first = mesh.morphTexture; let firstDisposed = 0, secondDisposed = 0;
    first.addEventListener('dispose', () => firstDisposed++);
    for (const count of [0, 10, 16, 22, 26]) {
      mesh.count = count; initializeForestMorphWeights(mesh);
      assert.equal(mesh.morphTexture, first);
    }
    mesh.instanceMatrix = new THREE.InstancedBufferAttribute(new Float32Array(243 * 16), 16);
    initializeForestMorphWeights(mesh);
    assert.equal(firstDisposed, 1); assert.equal(mesh.morphTexture.image.height, 243);
    mesh.morphTexture.addEventListener('dispose', () => secondDisposed++);
    disposeForestMorphWeights(mesh); mesh.dispose();
    assert.equal(secondDisposed, 1); assert.equal(mesh.morphTexture, null);
    initializeForestMorphWeights(mesh);
    let nativeDisposed = 0; mesh.morphTexture.addEventListener('dispose', () => nativeDisposed++);
    mesh.dispose(); mesh.dispose();
    assert.equal(nativeDisposed, 1); assert.equal(mesh.morphTexture, null);
  } finally { pair.dispose(); }
});

test('ordinary distant crowns stay morph-free and preserve the existing two batches and population prefixes', () => {
  const geometry = createOrganicCrownGeometry(0), material = new THREE.MeshStandardMaterial(), mesh = new THREE.InstancedMesh(geometry, material, 96);
  try {
    assert.equal((geometry.index?.count ?? geometry.attributes.position.count) / 3, 140);
    assert.equal(initializeForestMorphWeights(mesh), false); assert.equal(mesh.morphTexture, null);
    for (const count of [16, 40, 64]) assert.deepEqual(distantWoodlandLayout(count), distantWoodlandLayout(96).slice(0, count));
    const source = readFileSync(new URL('../src/components/three/environment/DistantWoodland.tsx', import.meta.url), 'utf8');
    assert.equal((source.match(/<instancedMesh\s/g) ?? []).length, 2);
    assert.match(source, /quiet \? 16 : quality === "low" \? 40 : quality === "medium" \? 64 : 96/);
    assert.match(source, /createOrganicCrownGeometry\(0\)/);
  } finally { mesh.dispose(); geometry.dispose(); material.dispose(); }
});
