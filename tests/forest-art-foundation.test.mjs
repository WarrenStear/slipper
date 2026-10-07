import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';
import * as THREE from 'three';
import * as forest from '../src/world/forest/forestGeometry.ts';
import * as habitat from '../src/world/guidance/pathUnderstoryHabitat.ts';
import { buildForest } from '../src/workers/forestWorker.ts';
import { forestArchetypeAtWorldPosition } from '../src/world/forest/forestInstancePresentation.ts';
import * as distant from '../src/components/three/environment/distantWoodlandLayout.ts';
import * as narrative from '../src/data/journeyNarrative.ts';
import * as themes from '../src/components/three/environment/environmentThemes.ts';
import * as rotation from '../src/components/three/environment/terrainScatterRotation.ts';
import * as worldMath from '../src/world/worldMath.ts';
import * as worldPaths from '../src/world/terrain/worldPaths.ts';
import { normalizeGeneratedWorldState } from '../src/data/worldStateNormalization.ts';

const fixture = name => new URL(`./fixtures/forest-art-foundation/${name}`, import.meta.url);
const provenance = JSON.parse(readFileSync(fixture('provenance.json'), 'utf8'));
const pinned = {
  'forestGeometry.txt': 'd47a2fb8339ed212778dc3a5fab9e26b3e4c7b573f5091bc1e49112bc281f6b4',
  'pathUnderstoryHabitat.txt': '0b12fc20e01f10ec4b6010ed2e2b4d0e4f9f052cf2976e0af3c6929b00183baa',
  'distantWoodlandLayout.txt': '94d63e16437e2aa675025bf9278028ebdbf5a7f4cda9b5bc12778de334726ebd',
};
const dependencies = {
  three: THREE,
  '../../data/journeyNarrative.ts': narrative,
  '../../components/three/environment/environmentThemes.ts': themes,
  '../../components/three/environment/terrainScatterRotation.ts': rotation,
  '../worldMath.ts': worldMath,
  '../terrain/worldPaths.ts': worldPaths,
};
function baseline(name) {
  const source = readFileSync(fixture(name), 'utf8');
  assert.equal(createHash('sha256').update(source).digest('hex'), pinned[name], `${name}: immutable real owner`);
  assert.equal(provenance.sources[name].sha256, pinned[name]);
  const exports = {};
  runInNewContext(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText,
    { exports, require: id => { assert.ok(id in dependencies, id); return dependencies[id]; } },
    { filename: provenance.sources[name].source, timeout: 1000 });
  return exports;
}
const oldForest = baseline('forestGeometry.txt'), oldHabitat = baseline('pathUnderstoryHabitat.txt'), oldDistant = baseline('distantWoodlandLayout.txt');
const toHost = value => JSON.parse(JSON.stringify(value));
const archive = JSON.parse(readFileSync(new URL('../src/data/worldState.json', import.meta.url), 'utf8'));
const entries = normalizeGeneratedWorldState(archive).entries, routes = worldPaths.buildMazePathSegments(entries);
const metre = (geometry, index) => new THREE.Vector3().fromBufferAttribute(geometry.attributes.position, index)
  .multiply(new THREE.Vector3(...forest.FOREST_REFERENCE_TRUNK_SCALE)).add(new THREE.Vector3(0, 6, 0));
const destroy = pair => Object.values(pair).forEach(geometry => geometry.dispose());

test('all 24 actual archetype/tier pairs retain exact topology, vertex allocation and separate material surfaces', () => {
  assert.deepEqual(forest.FOREST_ARCHETYPES, Array.from(oldForest.FOREST_ARCHETYPES));
  for (const type of forest.FOREST_ARCHETYPES) for (const detail of [0, 1, 2]) {
    const before = oldForest.createForestArchetypeGeometry(type, detail), after = forest.createForestArchetypeGeometry(type, detail);
    try {
      for (const part of ['trunk', 'crown']) {
        assert.deepEqual(after[part].index.array, before[part].index.array);
        assert.deepEqual(Object.keys(after[part].attributes), Object.keys(before[part].attributes));
        for (const key of Object.keys(after[part].attributes)) {
          assert.equal(after[part].attributes[key].count, before[part].attributes[key].count);
          assert.equal(after[part].attributes[key].array.byteLength, before[part].attributes[key].array.byteLength);
        }
        assert.equal(after[part].groups.length, 0);
      }
      assert.notDeepEqual(after.trunk.attributes.position.array, before.trunk.attributes.position.array);
    } finally { destroy(before); destroy(after); }
  }
});

test('the existing lower bole rings now describe basal shoulders within the old complete rooted footprint', () => {
  for (const type of forest.FOREST_ARCHETYPES) {
    const before = oldForest.createForestArchetypeGeometry(type, 0), after = forest.createForestArchetypeGeometry(type, 0);
    try {
      // The first two real indexed tube rows: nine vertices include the UV twin.
      const oldFirstRise = Array.from({ length: 8 }, (_, i) => metre(before.trunk, 9 + i).y);
      const newFirstRise = Array.from({ length: 8 }, (_, i) => metre(after.trunk, 9 + i).y);
      assert.ok(Math.max(...newFirstRise) < Math.min(...oldFirstRise) * .4, type);
      const oldFootprint = Math.max(...Array.from({ length: before.trunk.attributes.position.count }, (_, i) => {
        const p = metre(before.trunk, i); return p.y < 1 ? Math.hypot(p.x, p.z) : 0;
      }));
      for (let i = 0; i < 18; i++) {
        const p = metre(after.trunk, i); assert.ok(Math.hypot(p.x, p.z) < oldFootprint, type);
      }
      const firstColors = after.trunk.attributes.color.array.slice(0, 27);
      assert.notDeepEqual(firstColors, before.trunk.attributes.color.array.slice(0, 27));
    } finally { destroy(before); destroy(after); }
  }
});

test('reused old-limb geometry gives every form two finite short age scars with no new triangles', () => {
  for (const type of forest.FOREST_ARCHETYPES) {
    const pair = forest.createForestArchetypeGeometry(type, 2);
    try {
      const indices = pair.trunk.userData.oldLimbTipVertexIndices;
      assert.equal(indices.length, 2);
      const tips = indices.map(index => metre(pair.trunk, index));
      for (const p of tips) { assert.ok(p.y > 3 && p.y < 5.4); assert.ok(Math.hypot(p.x, p.z) < 1); }
      assert.ok(tips[1].y - tips[0].y > 1);
      assert.equal(pair.trunk.index.count / 3, 292);
    } finally { destroy(pair); }
  }
});

test('mature crowns gain unequal lower foliage strata with exact limb-to-island joins and no solid crown core', () => {
  for (const type of ['old-broad', 'broken', 'twisted', 'leaning', 'partially-dead']) {
    const before = oldForest.createForestArchetypeGeometry(type, 2), after = forest.createForestArchetypeGeometry(type, 2);
    try {
      assert.ok(after.crown.boundingBox.min.y < before.crown.boundingBox.min.y - .35, type);
      const support = forest.getForestArchetypeBranchSupports(type);
      for (const [i, anchor] of support.entries()) {
        const actual = metre(after.trunk, after.trunk.userData.branchTipVertexIndices[i]);
        assert.ok(actual.distanceTo(new THREE.Vector3(...anchor)) < 1e-6);
      }
      for (let face = 0; face < after.crown.index.count; face += 3) {
        const indices = Array.from(after.crown.index.array.slice(face, face + 3));
        assert.equal(new Set(indices.map(index => Math.floor(index / 4))).size, 1);
      }
    } finally { destroy(before); destroy(after); }
  }
});

test('each canonical route keeps its exact tier population while companions form four pockets with unplanted intervals', () => {
  for (const route of routes) for (const quality of ['low', 'medium', 'high', 'cinematic']) {
    const old = oldHabitat.createPathUnderstoryInstances(route, quality, {}, () => 0);
    const next = habitat.createPathUnderstoryInstances(route, quality, {}, () => 0);
    assert.equal(next.length, old.length);
    assert.deepEqual(next, habitat.createPathUnderstoryInstances(route, quality, {}, () => 0));
    const gaps = next.slice(1).map((item, i) => item.t - next[i].t);
    assert.equal(gaps.filter(gap => gap > .12).length, 3);
    assert.ok(next.at(-1).t - next[0].t > .7);
    for (const item of next) {
      assert.ok(item.offset - .9 * Math.max(...item.scale) > 1);
      assert.ok(item.habitat.weights.some(value => value > 0));
    }
  }
});

test('low quality retains the same four ecology banks, scene signatures and transitions as richer tiers', () => {
  for (const route of routes) {
    const low = habitat.createPathUnderstoryInstances(route, 'low', {}, () => 0);
    const full = habitat.createPathUnderstoryInstances(route, 'cinematic', {}, () => 0);
    for (let pocket = 0; pocket < 4; pocket++) {
      const average = list => list.reduce((sum, item) => sum + item.t, 0) / list.length;
      assert.ok(Math.abs(average(low.slice(pocket * 2, pocket * 2 + 2)) - average(full.slice(pocket * 7, pocket * 7 + 7))) < .01);
    }
  }
  for (const id of narrative.journeyScenes?.map(scene => scene.id) ?? ['fire.boundary', 'river.wash', 'crowned.home', 'enchanted.rabbit-hole']) {
    assert.deepEqual(habitat.pathHabitatForScene(id), toHost(oldHabitat.pathHabitatForScene(id)));
  }
});

test('all seven floor forms and the existing single material shader remain byte-equivalent to the real baseline', () => {
  assert.deepEqual(habitat.createPathUnderstoryBuffers(), toHost(oldHabitat.createPathUnderstoryBuffers()));
  const before = { vertexShader: THREE.ShaderLib.standard.vertexShader }, after = { ...before };
  oldHabitat.applyPathUnderstoryShader(before); habitat.applyPathUnderstoryShader(after);
  assert.equal(after.vertexShader, before.vertexShader);
  assert.equal(habitat.UNDERSTORY_CAPACITY, oldHabitat.UNDERSTORY_CAPACITY);
});

test('far woodland has the same world-anchored populations with three non-overlapping depths in every quality prefix', () => {
  const full = distant.distantWoodlandLayout(96);
  for (const count of [16, 40, 64, 96]) {
    const next = distant.distantWoodlandLayout(count), old = oldDistant.distantWoodlandLayout(count);
    assert.equal(next.length, old.length); assert.deepEqual(next, full.slice(0, count));
    const ranges = new Set(next.map(tree => Math.floor((Math.max(Math.abs(tree.x), Math.abs(tree.z)) - 44) / 25)));
    // Cross-axis grove offsets can exceed the nearest bank depth, but the three
    // actual bank support ranges remain present even in the quiet 16-tree prefix.
    assert.ok(ranges.has(0) && ranges.has(1) && ranges.has(2));
    for (const tree of next) { assert.ok(Math.max(Math.abs(tree.x), Math.abs(tree.z)) >= 44); assert.ok(tree.height >= 10 && tree.height <= 20); }
  }
});

// Worker saplings can be less than four metres tall. Reference-space heights
// cannot establish head clearance: compare actual transformed scar vertices.
test('complete age-scar envelopes stay inside the earlier rooted footprint under actual worker matrices', () => {
  const config={cellSize:7,cellRadius:4,treesPerCell:3,instanceCount:243,clearingSafeRadius:7.2,corridorBaseWidth:5.2,corridorMinWidth:3.6,treeColliderLimit:36,
    terrainBaseY:-1.255,terrainColliderY:-1.34,terrainSize:120,terrainSegments:32,crownedRampWidth:12,cameraX:0,cameraZ:0,cellX:0,cellZ:0,
    explorationDepth:0,memoryPressure:0,forestDensity:1,pathClarity:.86,clearings:[{id:'wood',chapter:'The First Wood',position:[0,0,0]}],paths:[]};
  const before=forest.FOREST_ARCHETYPES.map(type=>oldForest.createForestArchetypeGeometry(type,0));
  const after=forest.FOREST_ARCHETYPES.map(type=>forest.createForestArchetypeGeometry(type,0));
  const matrix=new THREE.Matrix4();let sampled=0;
  try {
    for(const explorationDepth of [0,.9])for(const cellX of [-3,0,4]){
      const result=buildForest({type:'BUILD_FOREST',requestId:1,config:{...config,explorationDepth,cellX}});
      for(let instance=0;instance<result.trunkCount;instance++){
        matrix.fromArray(result.trunkMatrices,instance*16);
        const family=forestArchetypeAtWorldPosition(matrix.elements[12],matrix.elements[14]);
        const foot=new THREE.Vector3(0,-.5,0).applyMatrix4(matrix),a=before[family].trunk,b=after[family].trunk;
        let oldRadius=0;
        for(let i=0;i<a.attributes.position.count;i++)if(metre(a,i).y<1){
          const point=new THREE.Vector3().fromBufferAttribute(a.attributes.position,i).applyMatrix4(matrix);
          oldRadius=Math.max(oldRadius,Math.hypot(point.x-foot.x,point.z-foot.z));
        }
        // Both complete final tubes: caps and sides, not merely their tips.
        for(let i=b.attributes.position.count-20;i<b.attributes.position.count;i++){
          const point=new THREE.Vector3().fromBufferAttribute(b.attributes.position,i).applyMatrix4(matrix);
          assert.ok(Math.hypot(point.x-foot.x,point.z-foot.z)<oldRadius);
        }
        sampled++;
      }
    }
    assert.ok(sampled>100);
  }finally{before.forEach(destroy);after.forEach(destroy);}
});
