import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';
import * as jsx from 'react/jsx-runtime';
import { createForestImageSampler } from '../src/world/forest/forestImageSampler.ts';
import { createGeometryTemplateCache } from '../src/components/three/environmentArt/geometryTemplateCache.ts';
import { createConstructionGeometry } from '../src/components/three/chapters/chapterArtGeometry.ts';
import { sanctuaryShorelineLayout } from '../src/components/three/chapters/sanctuaryShorelineLayout.ts';
import { createMossStoneGeometry } from '../src/components/three/environmentArt/woodlandAccentsGeometry.ts';
import { createRushGeometry } from '../src/components/three/environmentArt/woodlandHabitatGeometry.ts';

test('CPU templates retain independent caller buffers across edits, disposal and LRU eviction', () => {
  const cache = createGeometryTemplateCache(2, 65536); let builds = 0;
  const build = () => { builds++; return new THREE.BoxGeometry(); };
  const a = cache.get('a', build), original = a.attributes.position.array.slice();
  a.translate(100, 0, 0); a.dispose();
  const again = cache.get('a', build);
  assert.equal(builds, 1); assert.deepEqual(again.attributes.position.array, original);
  assert.notEqual(again.attributes.position.array.buffer, a.attributes.position.array.buffer);
  const b = cache.get('b', build), touch = cache.get('a', build), c = cache.get('c', build);
  assert.equal(cache.stats.entries, 2); assert.ok(cache.stats.bytes <= 65536);
  const rebuilt = cache.get('b', build); assert.equal(builds, 4, 'least recently used b was evicted');
  cache.clear(); assert.deepEqual(cache.stats, { entries: 0, bytes: 0 });
  assert.deepEqual(again.attributes.position.array, original, 'clearing templates does not mutate live consumers');
  [again, b, touch, c, rebuilt].forEach(g => g.dispose());
});

test('template byte limits reject large data and evict smaller entries before admitting replacements', () => {
  const small = () => new THREE.PlaneGeometry();
  const cache = createGeometryTemplateCache(64, 300);
  for (let i = 0; i < 10; i++) { const g = cache.get(String(i), small); g.dispose(); assert.ok(cache.stats.bytes <= 300); }
  const before = cache.stats;
  const big = cache.get('large', () => new THREE.SphereGeometry(1, 32, 16)); big.dispose();
  assert.deepEqual(cache.stats, before); cache.clear();
});

test('cached construction preserves all attributes and transforms while each mesh owns its geometry', () => {
  const pieces = [{ position: [1, 2, 3], size: [.2, 2.5, .3], rotation: [.1, .4, -.2], color: '#83765d' }];
  for (const plaster of [false, true]) {
    const first = createConstructionGeometry(pieces, plaster), second = createConstructionGeometry(structuredClone(pieces), plaster);
    try {
      assert.notEqual(first, second); assert.deepEqual(first.index.array, second.index.array);
      for (const [name, attribute] of Object.entries(first.attributes)) {
        assert.deepEqual(attribute.array, second.attributes[name].array);
        assert.notEqual(attribute.array.buffer, second.attributes[name].array.buffer);
      }
      first.translate(3, 0, 0); assert.notDeepEqual(first.attributes.position.array, second.attributes.position.array);
    } finally { first.dispose(); second.dispose(); }
  }
});

test('instanced shore dressing retains deterministic banks, bridge clearance and bounded upload geometry', () => {
  const layout = sanctuaryShorelineLayout(); assert.deepEqual(layout, sanctuaryShorelineLayout());
  assert.equal(layout.rocks.length, 40); assert.equal(layout.plants.length, 40); assert.ok(layout.gravel.length <= 96);
  for (const [kind, items] of Object.entries(layout)) for (const item of items) {
    assert.ok([...item.position, ...item.scale, item.yaw].every(Number.isFinite));
    assert.ok(item.scale.every(n => n > 0));
    if (kind === 'gravel') assert.ok(Math.abs(item.position[0]) >= 2, 'bridge landings remain open');
    else assert.ok(Math.abs(item.position[0]) > 10, 'larger forms remain outside the water');
  }
  const templates = [createMossStoneGeometry(), createMossStoneGeometry(0), createRushGeometry()];
  try {
    const bytes = templates.reduce((sum, g) => sum + g.index.array.byteLength + Object.values(g.attributes).reduce((n, a) => n + a.array.byteLength, 0), 0);
    assert.ok(bytes < 60000, `shared shore geometry uses ${bytes} bytes`);
    for (const g of templates) for (const a of Object.values(g.attributes)) assert.ok([...a.array].every(Number.isFinite));
    assert.ok(Math.abs(templates[0].boundingBox.min.y) < 1e-6);
  } finally { templates.forEach(g => g.dispose()); }
});


function loadComponent(relative, mocks) {
  const code = ts.transpileModule(readFileSync(new URL(relative, import.meta.url), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  const module = { exports: {} };
  runInNewContext(code, { module, exports: module.exports, document: { hidden: false }, require(name) {
    if (name === 'react/jsx-runtime') return jsx;
    if (name === 'three') return THREE;
    if (name in mocks) return mocks[name];
    throw new Error(name);
  } });
  return module.exports;
}

test('local practical lighting preserves active intensity and contributes no light from nearby scenery', () => {
  let active = true;
  const { LocalStoryLight } = loadComponent('../src/world/core/LocalStoryLight.tsx', {
    react: { forwardRef: render => render }, './ScenePresence': { useActiveScenePresence: () => active },
  });
  const props = { position: [0, -2.4, 1], color: '#6da2b8', intensity: .75, distance: 18 }, ref = {};
  const light = LocalStoryLight(props, ref);
  assert.equal(light.type, 'pointLight'); assert.equal(light.props.intensity, .75); assert.equal(light.ref, ref);
  assert.deepEqual(light.props.position, props.position);
  active = false; assert.equal(LocalStoryLight(props, ref), null);
  active = true; assert.equal(LocalStoryLight({ ...props, intensity: .35 }, ref).props.intensity, .35);
});

test('comfort water keeps static relief and owned uniforms while authored stillness settles the surface', () => {
  for (const reducedEffects of [false, true]) {
    const frame = [], presentation = { look: { atmosphere: { horizon: '#536780', sky: '#162340' }, lighting: { source: 'canopy', color: '#abcdee' } },
      stillness: 0, reducedMotion: true, time: { water: 0 } };
    const { NarrativeWater } = loadComponent('../src/components/three/environment/SanctuaryWater.tsx', {
      react: { memo: f => f, useMemo: f => f(), useCallback: f => f, useRef: current => ({ current }), useEffect: f => f() },
      '@react-three/fiber': { useFrame: f => frame.push(f) },
      '../artDirection/SceneLookContext': { useSceneLook: () => presentation },
      '../reflections/HeroReflectionSurface': {}, './chapterEnvironment': {},
      '../storyEvents/TactileMaterial': { useTactileDetail: () => 'relief' },
      './waterShader': { applyWaterShader() {} }, '../artDirection/worldVisualContinuity': { worldTransitionAlpha: () => 1 },
      './environmentThemes': {}, './waterSkyResponse': { writeWaterSkyTarget: (target, horizon) => target.copy(horizon) },
    });
    const tree = NarrativeWater({ reducedMotion: true, reducedEffects }), shader = { uniforms: {} };
    tree.props.children[1].props.onBeforeCompile(shader);
    const detail = shader.uniforms.waterDetail, time = shader.uniforms.waterTime, moon = shader.uniforms.waterMoon;
    for (let i = 0; i < 120; i++) frame[0]({}, 1 / 60);
    assert.equal(time.value, 0); assert.equal(detail.value, reducedEffects ? .5 : 1); assert.equal(moon.value, 1);
    presentation.stillness = 1; frame[0]({}, 1 / 60); assert.equal(detail.value, 0);
    presentation.stillness = 0; presentation.look.lighting.source = 'domestic'; frame[0]({}, 1 / 60);
    assert.equal(moon.value, 0); assert.equal(shader.uniforms.waterDetail, detail); assert.equal(shader.uniforms.waterTime, time);
  }
});

test('streamed image samplers own transforms and disposal without dirtying shared source pixels', () => {
  const source = new THREE.Texture({ width: 4, height: 4 }); source.needsUpdate = true;
  const version = source.source.version, sourceRepeat = source.repeat.toArray();
  let sourceDisposals = 0; source.addEventListener('dispose', () => sourceDisposals++);
  const a = createForestImageSampler(source, [1.4, 2.6], 8), b = createForestImageSampler(source, [3, 4]);
  assert.equal(a.source, source.source); assert.equal(b.image, source.image);
  assert.equal(source.source.version, version); assert.equal(a.version, 1);
  assert.deepEqual(a.repeat.toArray(), [1.4, 2.6]); assert.equal(a.anisotropy, 8);
  assert.equal(a.colorSpace, THREE.SRGBColorSpace); assert.equal(a.wrapS, THREE.RepeatWrapping);
  a.repeat.set(9, 8); a.offset.set(.3, .2); a.dispose();
  assert.deepEqual(b.repeat.toArray(), [3, 4]); assert.deepEqual(source.repeat.toArray(), sourceRepeat);
  assert.equal(sourceDisposals, 0); assert.equal(source.source.version, version);
  for (let i = 0; i < 100; i++) createForestImageSampler(source).dispose();
  assert.equal(source.source.version, version, 'remounting immutable image views never marks shared pixels dirty');
  const canopy = createForestImageSampler(source, [1, 1], 4, true); assert.equal(canopy.wrapS, THREE.ClampToEdgeWrapping);
  b.dispose(); canopy.dispose(); source.dispose();
});
