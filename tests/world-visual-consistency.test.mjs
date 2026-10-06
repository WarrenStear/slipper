import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { blendWorldValue, worldTransitionAlpha, WORLD_VISUAL_RESPONSE, WORLD_GRADE_FRAGMENT } from '../src/components/three/artDirection/worldVisualContinuity.ts';
import { MATERIAL_LIBRARY, SURFACE_DEFAULTS, resolveSurfaceDefaults, resolveMaterialMemory } from '../src/components/three/materials/materialLibrary.ts';
const source = path => readFileSync(new URL(path.startsWith("world/") ? `../src/${path}` : `../src/components/three/${path}`, import.meta.url), 'utf8');
const surfaces = ['wood','linen','paper','bark','stone','earth','wax','metal','wet-wood','charred-wood','painted-wood','plaster','velvet','ash','moss'];
const close = (a,b) => assert.ok(Math.abs(a-b)<1e-11, `${a} != ${b}`);

test('world visual response is finite, bounded and immutable', () => {
  assert.ok(Object.isFrozen(WORLD_VISUAL_RESPONSE));
  assert.ok(WORLD_VISUAL_RESPONSE.rate>0); assert.equal(WORLD_VISUAL_RESPONSE.maxDelta,.05);
  for(const dt of [NaN,Infinity,-Infinity,-4,0])assert.equal(worldTransitionAlpha(dt),0);
  for(const dt of [1/144,1/60,1/30,1,100])assert.ok(worldTransitionAlpha(dt)>0&&worldTransitionAlpha(dt)<1);
});
test('visual interpolation is independent of normal display refresh rate', () => {
  const finish = fps => {
    let value=.1; for(let frame=0;frame<fps*2;frame++)value=blendWorldValue(value,.92,worldTransitionAlpha(1/fps)); return value;
  };
  for(const fps of [30,60,90,120,144])close(finish(fps),.92-(.92-.1)*Math.exp(-WORLD_VISUAL_RESPONSE.rate*2));
});
test('resuming after a stalled frame uses the capped delta, not catch-up', () => {
  close(worldTransitionAlpha(9),worldTransitionAlpha(.05));
  close(worldTransitionAlpha(.02),1-Math.exp(-.02*WORLD_VISUAL_RESPONSE.rate));
});
test('reduced motion immediately applies visual settings without a tween', () => {
  for(const dt of [0,NaN,Infinity,1/60])assert.equal(worldTransitionAlpha(dt,true),1);
  assert.equal(blendWorldValue(.1,.9,worldTransitionAlpha(1/60,true)),.9);
});
test('changing targets midway preserves continuity and cannot overshoot', () => {
  let value=0;
  for(let i=0;i<30;i++){const prior=value;value=blendWorldValue(value,1,worldTransitionAlpha(1/60));assert.ok(value>=prior&&value<=1);}
  const start=value;
  for(let i=0;i<90;i++){const prior=value;value=blendWorldValue(value,.2,worldTransitionAlpha(1/60));assert.ok(value<=prior&&value>=.2);}
  assert.ok(start>.2&&value<start);
});
test('malformed scalar inputs cannot poison presentation uniforms', () => {
  assert.equal(blendWorldValue(NaN,.7,.5),.7);
  assert.equal(blendWorldValue(.7,Infinity,.5),.7);
  assert.equal(blendWorldValue(NaN,NaN,.5),0);
  assert.equal(blendWorldValue(0,1,NaN),0);
  assert.equal(blendWorldValue(0,1,-1),0);
  assert.equal(blendWorldValue(0,1,2),1);
  assert.equal(blendWorldValue(-Number.MAX_VALUE,Number.MAX_VALUE,.5),0);
});
test('all canonical surface kinds have one finite shared default', () => {
  assert.deepEqual(Object.keys(SURFACE_DEFAULTS).sort(),surfaces.toSorted());
  for(const surface of surfaces){
    const defaults=resolveSurfaceDefaults(surface);
    assert.ok(Number.isFinite(defaults.roughness)&&defaults.roughness>=0&&defaults.roughness<=1);
    assert.ok(Number.isFinite(defaults.metalness)&&defaults.metalness>=0&&defaults.metalness<=1);
    assert.deepEqual(defaults,{roughness:SURFACE_DEFAULTS[surface].roughness,metalness:SURFACE_DEFAULTS[surface].metalness});
  }
});
test('material defaults reuse the authored library instead of parallel constants', () => {
  assert.equal(SURFACE_DEFAULTS.linen,MATERIAL_LIBRARY.linen);
  assert.equal(SURFACE_DEFAULTS.bark,MATERIAL_LIBRARY.bark);
  assert.equal(SURFACE_DEFAULTS.stone,MATERIAL_LIBRARY.riverStone);
  assert.equal(SURFACE_DEFAULTS.metal,MATERIAL_LIBRARY.oxidisedBrass);
  assert.ok(resolveSurfaceDefaults('wet-wood').roughness<resolveSurfaceDefaults('wood').roughness);
  assert.ok(resolveSurfaceDefaults('linen').roughness>resolveSurfaceDefaults('wax').roughness);
});
test('explicit finish overrides including zero retain precedence', () => {
  for(const surface of surfaces){
    assert.deepEqual(resolveSurfaceDefaults(surface,.43,.27),{roughness:.43,metalness:.27});
    assert.deepEqual(resolveSurfaceDefaults(surface,0,0),{roughness:0,metalness:0});
    assert.deepEqual(resolveSurfaceDefaults(surface,2,-1),{roughness:1,metalness:0});
  }
});
test('missing or non-finite overrides return to the correct surface identity', () => {
  for(const surface of surfaces)for(const invalid of [undefined,NaN,Infinity,-Infinity]){
    assert.deepEqual(resolveSurfaceDefaults(surface,invalid,invalid),resolveSurfaceDefaults(surface));
  }
});
test('memory/weathering remains an independent layer with persistent damage', () => {
  const before=structuredClone(MATERIAL_LIBRARY);
  for(const surface of surfaces){
    const {roughness}=resolveSurfaceDefaults(surface), memory={wetness:.8,wear:.6,damage:.4,reintegrated:true};
    const result=resolveMaterialMemory(surface,roughness,memory);
    assert.equal(result.surface,surface);assert.equal(result.damage,.4);assert.equal(result.wear,.6);
    assert.ok(result.roughness>=.28&&result.roughness<=1);assert.ok(Number.isFinite(result.brightness));
    assert.deepEqual(memory,{wetness:.8,wear:.6,damage:.4,reintegrated:true});
  }
  assert.deepEqual(MATERIAL_LIBRARY,before);
});
test('one transition response is wired to lighting, sky, grade, mist and shafts', () => {
  for(const name of ['SceneLighting','SceneAtmosphere','ScenePostProcessing','GroundMist','VolumetricLightShaft']){
    const code=source(name === "SceneLighting" ? `world/lighting/${name}.tsx` : name === "ScenePostProcessing" ? `artDirection/${name}.tsx` : `world/atmosphere/${name}.tsx`);
    assert.match(code,/worldTransitionAlpha\(delta, presentation\.reducedMotion\)/);
    assert.doesNotMatch(code,/Math\.exp\(-Math\.min\(delta/);
    assert.doesNotMatch(code,/setState|requestAnimationFrame|Date\.now/);
  }
});
test('lighting freezes constructor values but follows live positions and colours', () => {
  const code=source('world/lighting/SceneLighting.tsx');
  assert.match(code,/position: initialKey\.position, color: initialKey\.color, intensity: initialKey\.intensity/);
  assert.match(code,/args=\{initialFill\}/);
  assert.match(code,/key\.current\.position\.lerp/);assert.match(code,/target\.position\.lerp/);
  assert.match(code,/key\.current\.color\.lerp/);assert.match(code,/fill\.current\.groundColor\.lerp/);
  assert.match(code,/\}\), \[localKey\]\)/);
  assert.match(code,/accent: desiredReturn, returnStrength: desiredReturnStrength/);
  assert.match(code,/desiredReturn\.intensity \* desiredReturnStrength/);
});
test('lighting retains quality gates and adds no shadow maps or light classes', () => {
  const code=source('world/lighting/SceneLighting.tsx');
  assert.match(code,/skyReturnStrength\(quality, presentation\.reducedEffects\)/);
  assert.match(code,/returnStrength > 0 && accent/);
  assert.match(code,/intensity=\{accent\.intensity \* returnStrength\} castShadow=\{false\}/);
  assert.equal((code.match(/<directionalLight /g)||[]).length,2);
  assert.equal((code.match(/<spotLight /g)||[]).length,1);
  assert.equal((code.match(/<hemisphereLight /g)||[]).length,1);
  assert.doesNotMatch(code,/<pointLight|<ambientLight|castShadow=\{true\}/);
});
test('High and Cinematic share one grade before tone mapping and output conversion', () => {
  const code=source('artDirection/ScenePostProcessing.tsx');
  const finish=code.match(/export const FINISH_FRAGMENT = \/\* glsl \*\/ `([\s\S]*?)`;/)?.[1];assert.ok(finish);
  const grade=finish.indexOf('${WORLD_GRADE_FRAGMENT}');assert.ok(grade>0);
  assert.ok(grade>finish.lastIndexOf('#endif'));
  assert.ok(grade<finish.indexOf('#include <tonemapping_fragment>'));
  assert.ok(finish.indexOf('#include <tonemapping_fragment>')<finish.indexOf('#include <colorspace_fragment>'));
  assert.equal((finish.match(/\$\{WORLD_GRADE_FRAGMENT\}/g)||[]).length,1);
  assert.match(WORLD_GRADE_FRAGMENT,/color=mix\(vec3\(luminance\),color,saturation\)/);
  assert.match(WORLD_GRADE_FRAGMENT,/color=\.18\*pow/);
});
test('grading survives resource changes and introduces no new render pass', () => {
  const code=source('artDirection/ScenePostProcessing.tsx');
  assert.ok(code.indexOf('const grade = useMemo')<code.indexOf('const resources = useMemo'));
  for(const field of ['contrast','saturation','vignette'])assert.match(code,new RegExp(`grade\\.${field} = blendWorldValue\\(grade\\.${field}`));
  assert.match(code,/levels = cinematic && hdr/);assert.match(code,/cinematic \? Math\.min\(4/);
  assert.equal((code.match(/new WebGLRenderTarget/g)||[]).length,2);
  assert.equal((code.match(/new FullScreenQuad/g)||[]).length,1);
});
test('materials keep texture, colour, memory and quality override behaviour', () => {
  const code=source('storyEvents/TactileMaterial.tsx');
  assert.match(code,/resolveSurfaceDefaults\(surface, roughness, metalness\)/);
  assert.match(code,/resolveMaterialMemory\(surface, finish\.roughness/);
  assert.match(code,/metalness=\{finish\.metalness\}/);
  assert.match(code,/new THREE\.Color\(color\)/);assert.match(code,/mapsAllowed && !maps && compatibleMapping/);
  assert.match(code,/memory \?\? \{ wetness:/);assert.match(code,/detail \?\? inherited/);
  assert.doesNotMatch(code,/useFrame|roughness = \.88|metalness = 0/);
});
test('local atmospheric effects retain the existing scene fog, clock and draw budgets', () => {
  for(const name of ['GroundMist','VolumetricLightShaft']){
    const code=source(name === "SceneLighting" ? `world/lighting/${name}.tsx` : name === "ScenePostProcessing" ? `artDirection/${name}.tsx` : `world/atmosphere/${name}.tsx`);
    assert.match(code,/uniforms\.tint\.value\.lerp\(tintTarget\.set/);
    assert.match(code,/uniforms\.opacity\.value = blendWorldValue/);
    assert.match(code,/presentation\.time\.vegetation/);
    assert.match(code,/readAtmosphereFogDensity\(scene\.fog\)/);
    assert.match(code,/look\.budget\.shafts/);assert.match(code,/depthWrite=\{false\}/);
  }
  assert.equal((source('world/atmosphere/GroundMist.tsx').match(/<instancedMesh /g)||[]).length,1);
  assert.match(source('world/atmosphere/VolumetricLightShaft.tsx'),/forceSinglePass/);
});
