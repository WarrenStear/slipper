import test from 'node:test';
import assert from 'node:assert/strict';
import { ShaderLib } from 'three';
import { approvedMaterialMaps, MATERIAL_MAPS } from '../src/components/three/materials/materialMapRegistry.ts';
import { applyTactileShader } from '../src/components/three/storyEvents/tactileShader.ts';
import { createKeyGeometry, createLanternHousingGeometry } from '../src/components/three/environmentArt/heroGeometry.ts';
const reviewed = { status: 'reviewed-production', maxDimension: 1024, repeat: [2, 2], normalConvention: 'opengl', provenance: 'Test review contract only; no shipping asset', licence: 'Test fixture', reviewedBy: 'Material test', reviewedAt: '2026-09-26', channels: { map: '/art/materials/timber/albedo.ktx2', normalMap: '/art/materials/timber/normal.ktx2' } };

test('material maps require reviewed bounded local compressed assets', () => {
  for (const [surface, candidate] of Object.entries(MATERIAL_MAPS)) {
    const admitted = approvedMaterialMaps(candidate);
    if (['wood', 'wet-wood', 'bark'].includes(surface)) {
      assert.equal(admitted, candidate); assert.equal(candidate.maxDimension, 512);
      assert.equal(candidate.status, 'reviewed-generated');
      assert.deepEqual(Object.keys(candidate.channels), ['map','normalMap','roughnessMap']);
      assert.match(candidate.provenance, /generated material approximation/);
    } else assert.equal(admitted, null, surface);
  }
  const entry=reviewed;
  assert.equal(approvedMaterialMaps(entry),entry);
  for(const bad of [{status:'procedural-fallback'},{maxDimension:2048},{maxDimension:NaN},{repeat:[0,2]},{channels:{map:'https://example.com/albedo.ktx2'}},{channels:{map:'/art/materials/../secret.ktx2'}},{channels:{map:'/art/materials/albedo.png'}}])assert.equal(approvedMaterialMaps({...entry,...bad}),null);
});
test('generated approximations use the same eligibility contract without claiming production review', () => {
  const generated = { ...reviewed, status: 'reviewed-generated' };
  assert.equal(approvedMaterialMaps(generated), generated);
  for (const bad of [{ status: 'generated' }, { provenance: '' }, { licence: '' }, { reviewedBy: '' },
    { reviewedAt: '2026-02-30' }, { maxDimension: 2048 }, { normalConvention: 'directx' },
    { repeat: [0, 1] }, { channels: { map: 'https://example.com/map.ktx2' } },
    { channels: { aoMap: '/art/materials/ao.ktx2' } },
  ]) assert.equal(approvedMaterialMaps({ ...generated, ...bad }), null);
});
test('material memory updates uniforms without generating a shader variant for each history', () => {
  const memory={value:[.8,.7,.4,1]}, shader={vertexShader:ShaderLib.standard.vertexShader,fragmentShader:ShaderLib.standard.fragmentShader};
  applyTactileShader(shader,'wet-wood','relief',memory);
  assert.equal(shader.uniforms.storyMemory,memory);
  const program=shader.fragmentShader;memory.value[0]=0;
  assert.equal(shader.uniforms.storyMemory.value[0],0);assert.equal(shader.fragmentShader,program);
  assert.match(program,/scarLine[^;]+storyPlane/);assert.match(program,/storyMemory.z/);
  assert.match(program,/#include <lights_fragment_begin>/);
});
test('key and lantern housing are finite, bounded single material geometry', () => {
  for(const build of [createKeyGeometry,createLanternHousingGeometry]){
    const g=build(),p=g.getAttribute('position');g.computeBoundingBox();
    assert.ok(p.count>100&&p.count<12000);assert.ok(Array.from(p.array).every(Number.isFinite));
    assert.ok(g.boundingBox.max.y<1.3&&g.boundingBox.min.y>-.4);assert.equal(g.groups.length,0);g.dispose();
  }
});

test('material review metadata rejects malformed values without throwing or admitting traversal', () => {
  for (const bad of [null, true, [], 'reviewed-production', {}, { ...reviewed, repeat: null },
    ...[[], [1], [1, 2, 3], [NaN, 1], [Infinity, 1], ['1', 1]].map(repeat => ({ ...reviewed, repeat })),
    ...[null, [], 'map'].map(channels => ({ ...reviewed, channels })),
    ...['/art/materials//wood.ktx2', '/art/materials/../wood.ktx2', '/art/materials/%2e%2e/wood.ktx2', '//host/wood.ktx2', '/art/materials/wood.ktx2?x=1', '/art/materials/wood.ktx2#x'].map(map => ({ ...reviewed, channels: { map } })),
    { ...reviewed, provenance: '' }, { ...reviewed, licence: ' ' }, { ...reviewed, reviewedBy: null },
    { ...reviewed, reviewedAt: '2026-02-30' }, { ...reviewed, reviewedAt: 'yesterday' }, { ...reviewed, maxDimension: 1.5 },
    { ...reviewed, channels: { displacementMap: '/art/materials/height.ktx2' } },
    { ...reviewed, channels: { aoMap: '/art/materials/ao.ktx2' } },
    { ...reviewed, normalConvention: 'directx' }, { ...reviewed, rotation: Infinity }, { ...reviewed, offset: [1] },
  ]) assert.equal(approvedMaterialMaps(bad), null, JSON.stringify(bad));
});

import { BufferGeometry, Float32BufferAttribute, Texture, MeshStandardMaterial, SRGBColorSpace, NoColorSpace, RepeatWrapping } from 'three';
import { cloneReviewedMaterialMaps, createMaterialMapCache, createMaterialMapGuard, disposeMaterialMaps, requestReviewedMaterialMaps, MAX_MATERIAL_SOURCE_MAPS } from '../src/components/three/materials/productionMaterialRuntime.ts';
import { attachMaterialShadow } from '../src/components/three/materials/materialShadowOwnership.ts';
const texture = (width = 512, height = 512) => new Texture({ width, height });
const deferred = () => { let resolve, reject; const promise = new Promise((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject }; };
const tick = () => new Promise(resolve => setImmediate(resolve));

test('reviewed clones own transforms and channel color space without mutating sources', () => {
  const source = texture(), before = { repeat: source.repeat.toArray(), offset: source.offset.toArray(), colorSpace: source.colorSpace, channel: source.channel, rotation: source.rotation, flipY: source.flipY };
  const entry = { ...reviewed, repeat: [3, 2], offset: [.1, -.2], rotation: .4, aoUvChannel: 1, channels: { ...reviewed.channels, roughnessMap: '/art/materials/rough.ktx2', aoMap: '/art/materials/ao.ktx2' } };
  const maps = cloneReviewedMaterialMaps(Object.fromEntries(Object.keys(entry.channels).map(channel => [channel, source])), entry);
  assert.equal(new Set(Object.values(maps)).size, 4);
  for (const [channel, clone] of Object.entries(maps)) {
    assert.notEqual(clone, source); assert.equal(clone.source, source.source);
    assert.equal(clone.colorSpace, channel === 'map' ? SRGBColorSpace : NoColorSpace);
    assert.deepEqual(clone.repeat.toArray(), [3, 2]); assert.deepEqual(clone.offset.toArray(), [.1, -.2]);
    assert.equal(clone.rotation, .4); assert.equal(clone.channel, channel === 'aoMap' ? 1 : 0);
    assert.equal(clone.flipY, false); assert.equal(clone.wrapS, RepeatWrapping); assert.equal(clone.wrapT, RepeatWrapping);
  }
  assert.deepEqual({ repeat: source.repeat.toArray(), offset: source.offset.toArray(), colorSpace: source.colorSpace, channel: source.channel, rotation: source.rotation, flipY: source.flipY }, before);
  let disposed = 0, sourceDisposed = 0; source.addEventListener('dispose', () => sourceDisposed++);
  Object.values(maps).forEach(map => map.addEventListener('dispose', () => disposed++));
  disposeMaterialMaps(maps); assert.equal(disposed, 4); assert.equal(sourceDisposed, 0);
});

test('invalid decoded dimensions reject the entire set before creating clones', () => {
  for (const [width, height] of [[0, 1], [1, 0], [1025, 1], [1, 1025], [NaN, 1], [1, Infinity], [1.5, 1], [undefined, undefined]]) {
    const valid = texture(), invalid = texture(); invalid.image = { width, height };
    let clones = 0; valid.clone = () => { clones++; return texture(); };
    assert.throws(() => cloneReviewedMaterialMaps({ map: valid, normalMap: invalid }, reviewed), /dimensions|budget/);
    assert.equal(clones, 0);
  }
  assert.throws(() => cloneReviewedMaterialMaps({ map: texture(513, 512), normalMap: texture() }, { ...reviewed, maxDimension: 512 }), /budget/);
});

function uvGeometry() {
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new Float32BufferAttribute([0, 0, 0, 1, 0, 0, 0, 1, 0], 3));
  geometry.setAttribute('uv', new Float32BufferAttribute([0, 0, 1, 0, 0, 1], 2));
  return geometry;
}
const guard = (callback, material, geometry) => callback.call(material, null, null, null, geometry, null, null);

test('actual pre-render map guard requires UV0 and explicit AO channel; changed geometry falls back', () => {
  const geometry = uvGeometry(), material = new MeshStandardMaterial(), maps = { map: texture(), normalMap: texture(), roughnessMap: texture(), aoMap: texture() };
  maps.aoMap.channel = 1;
  const callback = createMaterialMapGuard(maps);
  guard(callback, material, geometry);
  assert.equal(material.map, maps.map); assert.equal(material.normalMap, maps.normalMap); assert.equal(material.roughnessMap, maps.roughnessMap);
  assert.equal(material.aoMap, null); assert.equal(geometry.hasAttribute('uv1'), false, 'missing AO coordinates are never fabricated');
  geometry.setAttribute('uv1', geometry.getAttribute('uv').clone()); guard(callback, material, geometry); assert.equal(material.aoMap, maps.aoMap);
  const version = material.version; guard(callback, material, geometry); assert.equal(material.version, version, 'stable attributes do not invalidate the program every draw');
  geometry.getAttribute('uv').setX(1, NaN); geometry.getAttribute('uv').needsUpdate = true;
  guard(callback, material, geometry); assert.equal(material.map, null); assert.equal(material.normalMap, null); assert.equal(material.aoMap, maps.aoMap);
  geometry.deleteAttribute('uv1'); guard(callback, material, geometry); assert.equal(material.aoMap, null);
  guard(createMaterialMapGuard(), material, geometry); assert.equal(material.roughnessMap, null);
});

test('UV guard rejects partial, collapsed, unsupported channels and non-finite UVs', () => {
  for (const uv of [new Float32BufferAttribute([0, 0, 1, 1], 2), new Float32BufferAttribute([0, 0, 0, 0, 0, 0], 2), new Float32BufferAttribute([0, 0, 1, 0, 0, Infinity], 2)]) {
    const geometry = uvGeometry(), material = new MeshStandardMaterial(); geometry.setAttribute('uv', uv);
    guard(createMaterialMapGuard({ map: texture() }), material, geometry); assert.equal(material.map, null);
  }
  const map = texture(); map.channel = 1;
  const geometry = uvGeometry(); geometry.setAttribute('uv1', geometry.getAttribute('uv').clone());
  const material = new MeshStandardMaterial(); guard(createMaterialMapGuard({ map }), material, geometry); assert.equal(material.map, null);
});

test('renderer caches share pending sources and retain decoder lease through zero-user remount', async () => {
  let acquisitions = 0, releases = 0, loads = 0;
  const waiting = deferred(), source = texture(); let disposed = 0; source.addEventListener('dispose', () => disposed++);
  const acquire = createMaterialMapCache(() => { acquisitions++; return { ktx2: { loadAsync: () => { loads++; return waiting.promise; } }, release: () => releases++ }; });
  const renderer = {}, first = acquire(renderer), pending = first.load('/art/materials/test.ktx2');
  first.release(); await tick();
  assert.equal(releases, 0); const second = acquire(renderer); assert.equal(second.load('/art/materials/test.ktx2'), pending);
  assert.equal(acquisitions, 1); assert.equal(loads, 1);
  waiting.resolve(source); await pending; await tick(); assert.equal(disposed, 0);
  second.release(); second.release(); await tick(); assert.equal(disposed, 1); assert.equal(releases, 1);
  const next = acquire(renderer), other = acquire({}); assert.equal(acquisitions, 3, 'new renderer configurations do not share support detection');
  next.release(); other.release(); await tick(); assert.equal(releases, 3);
});

test('late decode after disposal creates no consumer clones or state; sources retire once', async () => {
  const waiting = deferred(), source = texture(); let clones = 0, disposed = 0, released = 0, published = 0;
  source.clone = () => { clones++; return texture(); }; source.addEventListener('dispose', () => disposed++);
  const acquire = createMaterialMapCache(() => ({ ktx2: { loadAsync: () => waiting.promise }, release: () => released++ }));
  const renderer = {}, request = requestReviewedMaterialMaps({ ...reviewed, channels: { map: reviewed.channels.map } }, () => acquire(renderer), () => published++);
  request.dispose(); waiting.resolve(source); await request.settled; await tick();
  assert.deepEqual({ clones, disposed, released, published }, { clones: 0, disposed: 1, released: 1, published: 0 });
});

test('terminal failure releases its lease before unmount while sibling transcodes finish safely', async () => {
  const waiting = deferred(), source = texture(); let published = 0, failures = 0, clones = 0, disposed = 0, released = 0;
  source.clone = () => { clones++; return texture(); }; source.addEventListener('dispose', () => disposed++);
  const acquire = createMaterialMapCache(() => ({ ktx2: { loadAsync: url => url.includes('albedo') ? Promise.reject(new Error('404/invalid KTX2')) : waiting.promise }, release: () => released++ }));
  const request = requestReviewedMaterialMaps(reviewed, () => acquire({}), () => published++, () => failures++);
  await request.settled; assert.equal(released, 0, 'pending sibling still owns decoder lifetime after the failed consumer releases');
  waiting.resolve(source); await tick();
  assert.deepEqual({ published, failures, clones, disposed, released }, { published: 0, failures: 1, clones: 0, disposed: 1, released: 1 });
  request.dispose(); request.dispose(); await tick(); assert.equal(released, 1, 'later unmount cannot release the lease twice');
});

test('unreviewed files request nothing and source cache bounds unique requests/rejections', async () => {
  let acquisitions = 0, loads = 0;
  const acquire = createMaterialMapCache(() => { acquisitions++; return { ktx2: { loadAsync: () => { loads++; return Promise.reject(new Error('offline')); } }, release() {} }; });
  const renderer = {};
  await requestReviewedMaterialMaps({ ...reviewed, status: 'procedural-fallback' }, () => acquire(renderer), () => assert.fail()).settled;
  assert.equal(acquisitions, 0);
  const lease = acquire(renderer);
  for (let i = 0; i < MAX_MATERIAL_SOURCE_MAPS; i++) await assert.rejects(lease.load('/art/materials/map-' + i + '.ktx2'), /offline/);
  await assert.rejects(lease.load('/art/materials/map-0.ktx2'), /offline/);
  await assert.rejects(lease.load('/art/materials/overflow.ktx2'), /budget/);
  assert.equal(loads, MAX_MATERIAL_SOURCE_MAPS); lease.release(); await tick();
});

import { readFileSync } from 'node:fs';
import { loadMaterialTexture, validateMaterialKtx2Bytes, MAX_MATERIAL_COMPRESSED_BYTES } from '../src/components/three/materials/productionMaterialRuntime.ts';
const diagnosticBytes = () => { const bytes = readFileSync(new URL('./fixtures/production-delivery/diagnostic-etc1s.ktx2', import.meta.url)); return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength); };

test('the official ETC1S diagnostic fits the runtime envelope; huge and non-2D containers are rejected before decode', () => {
  assert.doesNotThrow(() => validateMaterialKtx2Bytes(diagnosticBytes()));
  for (const [offset, value] of [[20, 0], [20, 1025], [24, 1025], [28, 2], [32, 1], [36, 6], [40, 20]]) {
    const bytes = diagnosticBytes(); new DataView(bytes).setUint32(offset, value, true);
    assert.throws(() => validateMaterialKtx2Bytes(bytes), /bounded 2D/);
  }
  assert.throws(() => validateMaterialKtx2Bytes(new ArrayBuffer(80)), /Invalid/);
});

test('primary material fetch rejects redirects and bounds streaming bytes before decoding', async () => {
  let parses = 0, cancelled = 0;
  const decoder = { parse: (_bytes, resolve) => { parses++; resolve(texture()); } };
  const url = '/art/materials/test-diagnostic.ktx2';
  await loadMaterialTexture(url, decoder, async (requested, options) => {
    assert.equal(requested, url); assert.equal(options.redirect, 'error'); assert.equal(options.mode, 'same-origin'); assert.equal(options.credentials, 'omit');
    assert.ok(options.signal instanceof AbortSignal); return new Response(diagnosticBytes());
  });
  assert.equal(parses, 1);
  for (const response of [new Response('missing', { status: 404 }), new Response(null, { headers: { 'content-length': String(MAX_MATERIAL_COMPRESSED_BYTES + 1) } }), { ok: true, redirected: true }]) {
    await assert.rejects(loadMaterialTexture(url, decoder, async () => response), /rejected/);
  }
  const stream = new ReadableStream({ start(controller) { controller.enqueue(new Uint8Array(MAX_MATERIAL_COMPRESSED_BYTES + 1)); }, cancel() { cancelled++; } });
  await assert.rejects(loadMaterialTexture(url, decoder, async () => new Response(stream)), /budget/);
  assert.equal(cancelled, 1); assert.equal(parses, 1);
  await assert.rejects(loadMaterialTexture('https://other.invalid/asset.ktx2', decoder, async () => assert.fail()), /Non-local/);
  await assert.rejects(loadMaterialTexture(url, decoder, async () => new Response('invalid KTX2')), /Invalid/);
});

test('a valid delivery publishes owned clones and releases them exactly once on disposal', async () => {
  const source = texture(), owned = []; let releases = 0;
  const request = requestReviewedMaterialMaps(reviewed, () => ({ load: async () => source, release: () => releases++ }), maps => owned.push(...Object.values(maps)));
  await request.settled; assert.equal(owned.length, 2);
  let disposed = 0; owned.forEach(map => map.addEventListener('dispose', () => disposed++));
  request.dispose(); request.dispose(); assert.equal(disposed, 2); assert.equal(releases, 1);
});

import { runInNewContext } from 'node:vm';
import ts from 'typescript';
import * as THREE from 'three';
import * as tactileShader from '../src/components/three/storyEvents/tactileShader.ts';
import * as materialLibrary from '../src/components/three/materials/materialLibrary.ts';
import * as materialMapAdmission from '../src/components/three/materials/materialMapAdmission.ts';

test('the actual tactile component gates both automatic and override maps by chapter tier while preserving memory', () => {
  const code = ts.transpileModule(readFileSync(new URL('../src/components/three/storyEvents/TactileMaterial.tsx', import.meta.url), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText;
  let inherited = 'base', requested;
  const map = texture(), exports = {};
  const host = (type, props) => ({ type, props });
  const imports = {
    react: { createContext: value => ({ value }), memo: component => component, useContext: () => inherited, useMemo: callback => callback(), useCallback: callback => callback, useRef: value => ({ current: value }) },
    'react/jsx-runtime': { jsx: host, jsxs: host }, three: THREE,
    '../materials/useProductionMaterialMaps': { useProductionMaterialMaps: (_surface, enabled) => { requested = enabled; return enabled ? { map } : undefined; } },
    '../materials/productionMaterialRuntime': { createMaterialMapGuard },
    '../materials/materialShadowOwnership': { attachMaterialShadow },
    './tactileShader': tactileShader,
    '../artDirection/SceneLookContext': { useSceneLook: () => null },
    '../materials/materialLibrary': materialLibrary,
    '../materials/materialMapAdmission': materialMapAdmission,
  };
  runInNewContext(code, { exports, require: id => { assert.ok(id in imports, id); return imports[id]; } });
  for (const quality of ['low', 'medium', 'high', 'cinematic']) for (const reduced of [false, true]) for (const override of [false, true]) {
    inherited = tactileShader.tactileDetailFor(quality, reduced);
    const allowed = !reduced && ['high', 'cinematic'].includes(quality);
    const element = exports.TactileMaterial({ surface: 'wet-wood', constructionCoordinates: true, detail: 'relief', color: '#776644', memory: { wetness: .7, wear: .6, damage: .5, reintegrated: true }, ...(override ? { maps: { map } } : {}) });
    assert.equal(requested, allowed && !override, `${quality}/${reduced}: local relief detail cannot escalate map delivery`);
    const material = new MeshStandardMaterial(); guard(element.props.onBeforeRender, material, uvGeometry());
    assert.equal(material.map, allowed ? map : null);
    const shader = { vertexShader: ShaderLib.standard.vertexShader, fragmentShader: ShaderLib.standard.fragmentShader };
    element.props.onBeforeCompile(shader);
    assert.deepEqual(Array.from(shader.uniforms.storyMemory.value), [.7, .6, .5, 1]);
  }
  inherited = 'relief';
  const legacyWood = exports.TactileMaterial({surface:'wood', color:'#776644'});
  assert.equal(requested, false, 'legacy wood without reviewed construction UVs retains its procedural material');
  assert.equal(legacyWood.props.roughness, materialLibrary.SURFACE_DEFAULTS.wood.roughness);
  assert.equal(legacyWood.props.metalness, materialLibrary.SURFACE_DEFAULTS.wood.metalness);
});
