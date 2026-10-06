import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { readAtmosphereFogDensity } from '../src/world/atmosphere/atmosphereFog.ts';
import { GROUND_MIST_FRAGMENT } from '../src/world/atmosphere/groundMistField.ts';
import { FIREFLY_FRAGMENT } from '../src/components/three/environment/woodlandFireflyField.ts';

const source = path => readFileSync(new URL(path.startsWith("world/") ? `../src/${path}` : `../src/components/three/${path}`, import.meta.url), 'utf8');
const shaft = source('world/atmosphere/VolumetricLightShaft.tsx');
const shaftFragment = shaft.match(/fragmentShader=\{`([\s\S]*?)`\}/)?.[1];

for (const [name, fog] of [
  ['null', null], ['undefined', undefined], ['linear fog', { near: 1, far: 40 }],
  ['NaN', { density: NaN }], ['infinity', { density: Infinity }],
  ['negative infinity', { density: -Infinity }], ['negative', { density: -.01 }],
  ['text density', { density: '.02' }], ['primitive', .02],
]) test(`invalid or non-exponential fog resolves safely: ${name}`, () => {
  assert.equal(readAtmosphereFogDensity(fog), 0);
});

test('active scene density is read on each call rather than cached from a target look', () => {
  const fog = { density: .012 };
  assert.equal(readAtmosphereFogDensity(fog), .012);
  fog.density = .019;
  assert.equal(readAtmosphereFogDensity(fog), .019);
});

test('finite positive densities and a clear scene are preserved without clamping the authored fog', () => {
  for (const density of [0, .001, .01, .025, .1, 1]) {
    const fog = Object.freeze({ density });
    assert.equal(readAtmosphereFogDensity(fog), density);
    assert.deepEqual(fog, { density });
  }
});

for (const [name, code] of [['mist', GROUND_MIST_FRAGMENT], ['shaft', shaftFragment]]) {
  test(`${name} fades alpha using positive view depth and exponential scene fog`, () => {
    assert.equal(typeof code, 'string');
    assert.match(code, /float depth\s*=\s*max\(0\.,\s*(viewPosition|vView)\.z\)/);
    assert.match(code, /exp\(-fogDensity\s*\*\s*fogDensity\s*\*\s*depth\s*\*\s*depth\)/);
    assert.match(code, /visibility\s*=\s*opacity\s*\*\s*nearby\s*\*\s*fogFade/);
    assert.match(code, /gl_FragColor\s*=\s*vec4\(tint,\s*visibility\s*\*/);
  });
  test(`${name} skips negligible contributions before evaluating expensive noise`, () => {
    const main = code.slice(code.indexOf('void main()'));
    assert.match(main, /if\s*\(visibility\s*<=\s*\.0005\)\s*discard/);
    assert.ok(main.indexOf('discard') < main.indexOf('noise('));
    assert.match(main, /#include <tonemapping_fragment>/);
    assert.match(main, /#include <colorspace_fragment>/);
  });
}

for (const path of ['world/atmosphere/GroundMist.tsx', 'world/atmosphere/VolumetricLightShaft.tsx', 'environment/WoodlandFireflies.tsx']) {
  test(`${path} updates a stable uniform from the active scene without claiming fog ownership`, () => {
    const code = source(path);
    assert.match(code, /fogDensity: \{ value: /);
    assert.match(code, /uniforms\.fogDensity\.value = readAtmosphereFogDensity\(scene\.fog\)/);
    assert.doesNotMatch(code, /scene\.fog\s*=|new Fog|attach="fog"|setState|requestAnimationFrame/);
    assert.match(code, /depthWrite=\{false\}/);
    assert.match(code, /presentation\.time\.(vegetation|particles)/);
  });
}

test('firefly attenuation retains the existing formula and the atmosphere keeps its single mist draw', () => {
  assert.match(FIREFLY_FRAGMENT, /exp\(-fogDensity \* fogDensity \* viewDepth \* viewDepth\)/);
  const mist = source('world/atmosphere/GroundMist.tsx');
  assert.equal((mist.match(/<instancedMesh /g) || []).length, 1);
  assert.match(mist, /drawCallBudget: 1/);
  assert.match(mist, /presentation\.look\.budget\.shafts && patches\.length/);
  assert.match(shaft, /forceSinglePass/);
});
