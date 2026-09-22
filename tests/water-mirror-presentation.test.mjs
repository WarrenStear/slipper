import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { ShaderLib } from 'three';
import { applyWaterShader } from '../src/components/three/environment/waterShader.ts';
const read = name => readFileSync(new URL(name, import.meta.url), 'utf8');

test('single-pass water integrates with the installed standard-light shader at every required stage', () => {
  const shader = { vertexShader: ShaderLib.standard.vertexShader, fragmentShader: ShaderLib.standard.fragmentShader };
  applyWaterShader(shader);
  for (const code of ['vWaterUv=uv', 'varying vec2 vWaterUv']) assert.ok(shader.vertexShader.includes(code));
  for (const code of ['float waterHeight', 'float waterBank', 'roughnessFactor=clamp', 'float waterDet', 'float fresnel', 'outgoingLight=mix']) assert.ok(shader.fragmentShader.includes(code), code);
  assert.ok(shader.fragmentShader.indexOf('float h=waterHeight') < shader.fragmentShader.indexOf('float sheen='));
  assert.match(shader.fragmentShader, /#include <lights_fragment_begin>/);
  assert.match(shader.fragmentShader, /#include <tonemapping_fragment>/);
  assert.match(shader.fragmentShader, /#include <fog_fragment>/);
  // StandardMaterial owns optional texture samplers; the water extension must
  // not add a reflection target, discard pass, or depth-writing workaround.
  assert.doesNotMatch(read('../src/components/three/environment/waterShader.ts'), /sampler2D|discard|gl_FragDepth/);
});

test('water remains opaque and dielectric, freezes comfort motion, and keeps uniform identity', () => {
  const source = read('../src/components/three/environment/SanctuaryWater.tsx');
  assert.match(source, /metalness=\{0\}/);
  assert.doesNotMatch(source, /WebGLRenderTarget|transmission=|transparent\s|setState/);
  assert.match(source, /environmentTime\([^;]+reducedMotion \|\| reducedEffects\)/);
  assert.match(source, /Object.assign\(shader.uniforms, uniforms, appearance\)/);
  assert.match(source, /appearance.waterSize.value.set/);
  assert.match(source, /circle \? width : depth/);
  assert.match(source, /detail === "base" \? 0/);
  assert.match(source, /customProgramCacheKey/);
});

test('mirror skin keeps view-dependent ageing and controlled stillness without live reflections', () => {
  const source = read('../src/components/three/reflections/MirrorMemorySurface.tsx');
  assert.match(source, /normalMatrix \* normal/);
  assert.match(source, /float fresnel/);
  assert.match(source, /float edgeAge/);
  for (const chunk of ['fog_pars_vertex', 'fog_vertex', 'fog_pars_fragment', 'fog_fragment']) assert.ok(source.includes(`#include <${chunk}>`));
  assert.match(source, /UniformsUtils.clone\(THREE.UniformsLib.fog\)/);
  assert.match(source, /fwidth\(scratchP.x\)/);
  assert.match(source, /still \? 0.004/);
  assert.match(source, /reducedMotion \|\| reducedEffects \? 0/);
  assert.doesNotMatch(source, /WebGLRenderTarget|Reflector|useFBO|dispatchStoryEvent/);
  const director = read('../src/components/three/reflections/ReflectionDirector.tsx');
  assert.match(director, /name="memory-reflection-director"[^\n]+rotation=\{\[0, Math.PI, 0\]\}/);
  assert.match(director, /frameGeometry.dispose\(\)/);
});
