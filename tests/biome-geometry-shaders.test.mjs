import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { createEvergreenBuffers, createTussockBuffers, createMeadowFlowerBuffers } from '../src/components/three/environment/biomeGeometry.ts';
import { applyBiomeGroundShader } from '../src/components/three/environment/biomeGroundShader.ts';
import { applyWaterShader } from '../src/components/three/environment/waterShader.ts';

const source = name => readFileSync(new URL(`../src/components/three/environment/${name}`, import.meta.url), 'utf8');
for (const [name, create, maxTriangles, radius, maxHeight] of [
  ['evergreen bark', () => createEvergreenBuffers().bark, 20, 1.3, 5.2],
  ['evergreen boughs', () => createEvergreenBuffers().leaves, 300, 1.3, 5.2],
  ['grass tussocks', createTussockBuffers, 60, .7, .7],
  ['meadow flowers', createMeadowFlowerBuffers, 40, .45, .7],
]) {
  test(`${name}: deterministic finite buffers, normalized normals and valid triangle indices`, () => {
    const data = create(), count = data.positions.length / 3;
    assert.deepEqual(data, create());
    assert.ok(count > 0 && data.indices.length / 3 <= maxTriangles);
    assert.equal(data.indices.length % 3, 0);
    assert.equal(data.normals.length, count * 3); assert.equal(data.colors.length, count * 3); assert.equal(data.uvs.length, count * 2);
    for (const values of Object.values(data)) assert.ok(values.every(Number.isFinite));
    assert.ok(data.indices.every(index => Number.isInteger(index) && index >= 0 && index < count));
    assert.ok(data.colors.every(n => n >= 0 && n <= 1));
    assert.ok(data.uvs.every(n => n >= 0 && n <= 1));
    for (let i = 0; i < count; i++) {
      assert.ok(Math.abs(Math.hypot(...data.normals.slice(i * 3, i * 3 + 3)) - 1) < 1e-10);
      assert.ok(Math.hypot(data.positions[i * 3], data.positions[i * 3 + 2]) < radius);
      assert.ok(data.positions[i * 3 + 1] >= 0 && data.positions[i * 3 + 1] < maxHeight);
    }
  });
}
test('all maximum extra instances stay below 8000 triangles before shadow-free instancing', () => {
  const tree = createEvergreenBuffers();
  const maximum = (tree.bark.indices.length + tree.leaves.indices.length) / 3 * 10 + createTussockBuffers().indices.length / 3 * 72 + createMeadowFlowerBuffers().indices.length / 3 * 24;
  assert.ok(maximum <= 8000); assert.equal(maximum, 7872);
});

function shaderFixture() {
  return { vertexShader: '#include <common>\nvoid main(){\n#include <begin_vertex>\n}', fragmentShader: '#include <common>\nvoid main(){\n#include <color_fragment>\n#include <roughnessmap_fragment>\n#include <normal_fragment_maps>\n#include <opaque_fragment>\n}' };
}
test('ground shader patches standard material hooks without moving vertices', () => {
  for (const rich of [false, true]) {
    const shader = applyBiomeGroundShader(shaderFixture(), rich);
    for (const hook of ['common', 'color_fragment', 'roughnessmap_fragment', 'normal_fragment_maps', 'opaque_fragment']) assert.equal(shader.fragmentShader.split(`#include <${hook}>`).length - 1, 1);
    assert.match(shader.fragmentShader, /biomeWetness/); assert.match(shader.fragmentShader, /biomeMossCover/); assert.match(shader.fragmentShader, /biomeRockCover/);
    assert.doesNotMatch(shader.vertexShader, /transformed\s*[+*\/-]?=|displacement|time/);
    assert.equal(shader.fragmentShader.includes('float biomeRelief'), rich);
    assert.equal(shader.fragmentShader.includes('biomeDerivative'), rich);
  }
});
test('river shader keeps legacy ponds opt-in and no artificial shore at open river ends', () => {
  const shader = shaderFixture(); applyWaterShader(shader);
  assert.match(shader.fragmentShader, /uniform float waterRiverBanks/);
  assert.match(shader.fragmentShader, /sideBanks=min\(vWaterUv.x,1.-vWaterUv.x\)\*waterSize.x/);
  assert.match(shader.fragmentShader, /mix\(mix\(rectangle,radial,waterCircle\),sideBanks,waterRiverBanks\)/);
  assert.match(shader.fragmentShader, /mix\(originalDepth,riverDepth,waterRiverBanks\)/);
  assert.match(shader.fragmentShader, /waterRiverBanks\*waterFine\*abs\(waterFlow\)/);
  const water = source('SanctuaryWater.tsx');
  assert.match(water, /riverBanks = false/);
  assert.match(water, /waterRiverBanks: \{ value: 0 \}/);
  assert.match(water, /waterRiverBanks.value = riverBanks && !circle \? 1 : 0/);
  assert.match(water, /sidtw-narrative-water-v3/);
});
test('water shading is bounded and legacy bank/depth equations are unchanged when opt-out', () => {
  const mix = (a, b, t) => a * (1 - t) + b * t;
  const smooth = (a, b, v) => { const t = Math.min(1, Math.max(0, (v - a) / (b - a))); return t * t * (3 - 2 * t); };
  for (const circle of [0, 1]) for (const u of [0, .01, .1, .5, .99, 1]) for (const v of [0, .05, .5, 1]) {
    const rectangle = Math.min(Math.min(u, 1 - u) * 20, Math.min(v, 1 - v) * 17);
    const radial = (1 - Math.hypot((u - .5) * 2, (v - .5) * 2)) * 10;
    const oldBank = smooth(0, 1.35, mix(rectangle, radial, circle));
    const newBank = smooth(0, mix(1.35, .92, 0), mix(mix(rectangle, radial, circle), Math.min(u, 1 - u) * 20, 0));
    assert.equal(oldBank, newBank);
    const originalDepth = mix(.53, 1.02, oldBank), riverDepth = mix(1.12, .92, newBank);
    assert.equal(mix(originalDepth, riverDepth, 0), originalDepth);
  }
});
test('ground finish has stable uniforms, distance-filtered detail and no new animation loop', () => {
  const code = source('LandscapeGroundMaterial.tsx');
  assert.match(code, /useTactileDetail\(\) === "relief"/);
  assert.match(code, /Object.assign\(shader.uniforms, uniforms\)/);
  assert.match(code, /customProgramCacheKey=\{cacheKey\}/);
  assert.doesNotMatch(code, /useFrame|useState|TextureLoader|WebGLRenderTarget|scene\.fog|light/);
  assert.match(source('biomeGroundShader.ts'), /biomeFilter=1.-smoothstep/);
});
