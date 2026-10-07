import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';
import * as THREE from 'three';
import { createUnderfloorGeometry } from '../src/world/opening/underfloorGeometry.ts';
import { createTaperedBranchGeometry, mergeArtGeometries } from '../src/components/three/environmentArt/authoredGeometry.ts';
import { createUnderfloorCaptureResources } from '../src/world/opening/underfloorCapture.ts';
import { vertexShader, fragmentShader } from '../src/world/opening/wetFloorShader.ts';

const sha = input => createHash('sha256').update(input).digest('hex');
const read = path => readFileSync(new URL(path, import.meta.url), 'utf8');
const provenance = JSON.parse(read('./fixtures/opening-art-foundation/provenance.json'));
function source(path) {
  const record = provenance.sources[path], text = read('./fixtures/opening-art-foundation/' + record.fixture);
  assert.equal(sha(text), record.sha256, 'Immutable source: ' + path); return text;
}
function priorGeometry() {
  const text = source('src/world/opening/underfloorGeometry.ts');
  const compiled = ts.transpileModule(text, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
  const exports = {};
  runInNewContext(compiled, { exports, require: id => {
    assert.equal(id, '../../components/three/environmentArt/authoredGeometry.ts');
    return { createTaperedBranchGeometry, mergeArtGeometries };
  } }, { timeout: 1000 });
  return exports.createUnderfloorGeometry();
}
const center = (form, t) => new THREE.Vector3(.13 * t * t, t - .5, Math.sin(t * 4) * .045)
  .multiply(new THREE.Vector3(...form.scale)).applyEuler(new THREE.Euler(...(form.rotation ?? [0, 0, 0])))
  .add(new THREE.Vector3(...form.position));
const near = (a, b, limit = 1e-6) => assert.ok(a.distanceTo(b) < limit, `${a.toArray()} does not join ${b.toArray()}`);
const withForest = fn => { const forest = createUnderfloorGeometry(); try { fn(forest); } finally { forest.branches.dispose(); } };

test('authored underfloor changes retain exact installed-Three geometry allocations and index/UV topology', () => {
  const old = priorGeometry();
  try { withForest(current => {
    assert.equal(current.trunks.length, old.trunks.length); assert.equal(current.crowns.length, old.crowns.length);
    assert.equal(current.trunks.length, 34); assert.equal(current.crowns.length, 30);
    assert.deepEqual(Object.keys(current.branches.attributes), Object.keys(old.branches.attributes));
    for (const name of Object.keys(old.branches.attributes)) {
      assert.equal(current.branches.attributes[name].count, old.branches.attributes[name].count);
      assert.equal(current.branches.attributes[name].itemSize, old.branches.attributes[name].itemSize);
      assert.equal(current.branches.attributes[name].array.byteLength, old.branches.attributes[name].array.byteLength);
    }
    assert.deepEqual(current.branches.index.array, old.branches.index.array);
    assert.deepEqual(current.branches.attributes.uv.array, old.branches.attributes.uv.array);
    assert.equal(current.branches.index.count / 3, 1008); assert.deepEqual(current.branches.groups, []);
  }); } finally { old.branches.dispose(); }
});

test('each actual primary stem starts on the existing floor and every fork begins on its transformed bole', () => withForest(({ trunks }) => {
  for (let i = 0; i < 17; i++) {
    const stem = trunks[i * 2], fork = trunks[i * 2 + 1];
    assert.ok(Math.abs(center(stem, 0).y + .3) < 1e-12, 'Grounded primary stem');
    near(center(fork, 0), center(stem, .58 + (i % 4) * .055), 1e-12);
    assert.ok(center(fork, 1).y > center(fork, 0).y, 'Upward attached fork');
    assert.ok(fork.scale[0] < stem.scale[0], 'Secondary growth is narrower');
  }
}));

test('seventeen rooted trees form irregular depth banks with a clear central lantern sightline', () => withForest(({ trunks }) => {
  const bases = trunks.filter((_, i) => i % 2 === 0).map(form => center(form, 0));
  assert.equal(new Set(bases.map(point => point.z.toFixed(6))).size, 17, 'No mirrored paired row');
  const gaps = bases.slice(1).map((point, i) => point.z - bases[i].z);
  assert.ok(Math.max(...gaps) - Math.min(...gaps) > 2, 'Unequal near/mid/far intervals');
  assert.ok(bases.some(point => point.z < 0) && bases.some(point => point.z > 60));
  assert.ok(bases.some((point, i) => i && Math.sign(point.x) === Math.sign(bases[i - 1].x)), 'Banks do not alternate mechanically');
  for (const point of bases) assert.ok(Math.abs(point.x) > 2.7, 'Existing central depth/lantern aperture remains unplanted');
}));

test('all thirty crowns are centered over actual transformed stem or fork tips', () => withForest(({ trunks, crowns }) => {
  assert.equal(crowns.length, trunks.length - 4);
  crowns.forEach((crown, i) => {
    const support = center(trunks[i + 4], 1); support.y -= .18;
    near(new THREE.Vector3(...crown.position), support, 1e-12);
    assert.ok(crown.scale.every(value => value > .65 && value < 1.3));
  });
}));

test('each of the six swept boughs begins inside the actual attached stem, with the former buffer topology', () => withForest(({ trunks, branches }) => {
  const attachments = [[0, .94], [1, .91], [2, .94], [3, .91], [8, .75], [14, .8]];
  const starts = [0, 102, 180, 282, 360, 438], position = branches.attributes.position;
  attachments.forEach(([index, t], limb) => {
    const ring = new THREE.Vector3();
    for (let i = 0; i < 6; i++) ring.add(new THREE.Vector3().fromBufferAttribute(position, starts[limb] + i));
    near(ring.divideScalar(6), center(trunks[index], t));
  });
  assert.ok([...position.array].every(Number.isFinite));
  for (let i = 0; i < branches.attributes.normal.count; i++) {
    const normal = new THREE.Vector3().fromBufferAttribute(branches.attributes.normal, i);
    assert.ok(Math.abs(normal.length() - 1) < 1e-5);
  }
}));

test('the existing private target gains deeper neutral fog without changing its allocation', () => {
  for (const size of [32, 64, 128, 256, 512]) {
    const { scene, target } = createUnderfloorCaptureResources(size);
    assert.equal(target.width, size); assert.equal(target.height, size); assert.equal(target.depthBuffer, true);
    assert.equal(target.texture.type, THREE.HalfFloatType); assert.equal(target.texture.name, 'bounded-underfloor-world');
    assert.equal(scene.fog.density, .035); assert.equal(scene.background.getHexString(), '101918');
    const extinction = distance => 1 - Math.exp(-(scene.fog.density ** 2) * distance ** 2);
    assert.ok(extinction(8) < .08); assert.ok(extinction(30) > .65 && extinction(30) < .7);
    assert.ok(extinction(60) > .98, 'Far-bank depth dissolves before its end');
    target.dispose();
  }
});

test('underfloor hooks, frame cadence, activity, cleanup, local light topology and motion are exact outside art values', () => {
  const current = read('../src/world/opening/UnderfloorForest.tsx');
  const former = source('src/world/opening/UnderfloorForest.tsx');
  const changes = [['#635e4c','#7b9183'],['#52634a','#506d59'],['#635c4c','#526258'],['#39473c','#4c604d'],
    ['[.65, .16, 15.5]','[.2, 2.1, 8]'],['#bbc1b1','#a5c1cd'],['#a7b6bb','#94b1c0']];
  let normalized = current; for (const [after, before] of changes) { assert.ok(normalized.includes(after)); normalized = normalized.replace(after, before); }
  assert.equal(normalized, former);
  const capture = read('../src/world/opening/underfloorCapture.ts')
    .replace("new Color('#101918'); scene.fog = new FogExp2('#24322e', .035)", "new Color('#081216'); scene.fog = new FogExp2('#101e23', .042)");
  assert.equal(capture, source('src/world/opening/underfloorCapture.ts'));
});

test('floor finishing keeps the vertex, uniform/sampler families and actual brush/projective/stage expressions', () => {
  const former = source('src/world/opening/wetFloorShader.ts');
  assert.equal(vertexShader, former.match(/vertexShader = `([\s\S]*?)`;/)[1]);
  const oldFragment = former.match(/fragmentShader = `([\s\S]*?)`;/)[1];
  const uniforms = source => [...source.matchAll(/uniform\s+\w+\s+\w+\s*;/g)].map(match => match[0]);
  assert.deepEqual(uniforms(fragmentShader), uniforms(oldFragment));
  for (const expression of [
    'float brushed=texture2D(coverageMask,vUv).r;',
    'float first=smoothstep(.1,1.,stage);float second=smoothstep(1.1,2.,stage);',
    'float mask=max(brushed,restored);float reveal=mask*(.42+first*.26+second*.4);',
    'vec2 parallaxUv=projectedFloor.xy/projectedFloor.w*.5+.5;',
    'vec3 color=mix(room,branches,clamp(reveal+smoothstep(2.,3.,stage),0.,1.));',
    'gl_FragColor=vec4(color,apertureOpacity);',
  ]) assert.ok(fragmentShader.includes(expression) && oldFragment.includes(expression), expression);
  assert.ok(!fragmentShader.includes('color+='), 'Wet boundary retains timber, never additive emission');
  assert.equal((fragmentShader.match(/texture2D\(/g) ?? []).length, (oldFragment.match(/texture2D\(/g) ?? []).length);
});

test('the complete BrokenFloor owner preserves ordinary boards, ten-step timing, authored lights and interaction-derived semantics', () => {
  assert.equal(read('../src/scenes/broken-floor/BrokenFloorScene.tsx'), source('src/scenes/broken-floor/BrokenFloorScene.tsx'));
});
