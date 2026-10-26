import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { queueSceneryPreparation, prepareStreamedScenery, SCENERY_COMPILE_LEAD_MS } from '../src/world/core/sceneryPreparation.ts';

function fixture(parallel = true) {
  const scene = new THREE.Scene(), camera = new THREE.PerspectiveCamera(), compiled = [];
  const renderer = { extensions: { has: () => parallel }, compile(view, c, target) {
    assert.equal(c, camera); assert.equal(target, scene);
    const meshes = []; view.traverse(o => meshes.push(o)); compiled.push(meshes);
    view.traverseVisible(() => assert.fail('the traversal view must never duplicate scene lights'));
  } };
  const group = () => { const root = new THREE.Group(); root.add(new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshStandardMaterial())); scene.add(root); return root; };
  return { scene, camera, compiled, group, run: now => prepareStreamedScenery(renderer, scene, camera, now) };
}

test('streamed scenery compiles original receivers in bounded batches before visibility, without cloning or reparenting', () => {
  const f = fixture(), a = f.group(), b = f.group();
  const stopA = queueSceneryPreparation(f.scene, a), stopB = queueSceneryPreparation(f.scene, b);
  assert.equal(a.visible, false); f.run(0);
  assert.deepEqual(f.compiled, [[a.children[0]]]); assert.equal(a.visible, false); assert.equal(b.visible, false);
  f.run(16); assert.deepEqual(f.compiled[1], [b.children[0]]);
  f.run(SCENERY_COMPILE_LEAD_MS); assert.equal(a.visible, true); assert.equal(b.visible, false);
  f.run(SCENERY_COMPILE_LEAD_MS + 16); assert.equal(b.visible, true);
  f.run(1000); assert.equal(f.compiled.length, 2);
  assert.equal(a.parent, f.scene); assert.equal(b.parent, f.scene); stopA(); stopB();
});

test('eviction and active-scene promotion cancel preparation without later accesses to disposed objects', () => {
  for (const started of [false, true]) {
    const f = fixture(), root = f.group(); const cancel = queueSceneryPreparation(f.scene, root);
    if (started) f.run(0);
    cancel(); assert.equal(root.visible, true); f.scene.remove(root);
    root.children[0].geometry.dispose(); root.children[0].material.dispose();
    root.traverse = () => assert.fail('cancelled region cannot be revisited');
    f.run(1000); assert.equal(f.compiled.length, started ? 1 : 0);
  }
});

test('unsupported drivers and oversized batches keep normal rendering without a readiness wait', () => {
  const f = fixture(false), root = f.group(); const cancel = queueSceneryPreparation(f.scene, root);
  f.run(0); assert.equal(root.visible, true); assert.equal(f.compiled.length, 0); cancel();
  const big = fixture(), overflow = big.group();
  for (let i = 0; i < 128; i++) overflow.add(new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshStandardMaterial()));
  const stop = queueSceneryPreparation(big.scene, overflow); big.run(0);
  assert.equal(overflow.visible, true); assert.equal(big.compiled.length, 0); stop();
});
