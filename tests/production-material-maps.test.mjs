import test from 'node:test';
import assert from 'node:assert/strict';
import { ShaderLib } from 'three';
import { approvedMaterialMaps, MATERIAL_MAPS } from '../src/components/three/materials/materialMapRegistry.ts';
import { applyTactileShader } from '../src/components/three/storyEvents/tactileShader.ts';
import { createKeyGeometry, createLanternHousingGeometry } from '../src/components/three/environmentArt/heroGeometry.ts';

test('material maps require reviewed bounded local compressed assets', () => {
  Object.values(MATERIAL_MAPS).forEach(entry => assert.equal(approvedMaterialMaps(entry), null));
  const entry={status:'reviewed-production',maxDimension:1024,repeat:[2,2],channels:{map:'/art/materials/timber/albedo.ktx2',normalMap:'/art/materials/timber/normal.ktx2'}};
  assert.equal(approvedMaterialMaps(entry),entry);
  for(const bad of [{status:'procedural-fallback'},{maxDimension:2048},{maxDimension:NaN},{repeat:[0,2]},{channels:{map:'https://example.com/albedo.ktx2'}},{channels:{map:'/art/materials/../secret.ktx2'}},{channels:{map:'/art/materials/albedo.png'}}])assert.equal(approvedMaterialMaps({...entry,...bad}),null);
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
