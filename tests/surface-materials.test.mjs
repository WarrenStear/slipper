import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import { STORY_SURFACES, TACTILE_PATTERNS, TACTILE_BASE_PATTERNS, tactileDetailFor, tactileProgramKey, applyTactileShader } from '../src/components/three/storyEvents/tactileShader.ts';
import { stonePathLayout, veilFoldDepth } from '../src/components/three/chapters/surfaceGeometry.ts';

const template = () => ({ vertexShader: '#include <common>\nvoid main(){\n#include <begin_vertex>\n}', fragmentShader: '#include <common>\nvoid main(){\n#include <color_fragment>\n#include <roughnessmap_fragment>\n#include <normal_fragment_maps>\n#include <tonemapping_fragment>\n#include <colorspace_fragment>\n#include <fog_fragment>\n}' });
const read = p => fs.readFileSync(new URL('../'+p, import.meta.url),'utf8');
test('low, medium and reduced effects omit micro-relief', () => {
  for (const q of ['low','medium','high','cinematic','unknown']) {
    assert.equal(tactileDetailFor(q,true),'base');
    assert.equal(tactileDetailFor(q,false),['high','cinematic'].includes(q)?'relief':'base');
  }
});
test('all fifteen finishes provide both base and relief patterns', () => {
  assert.equal(STORY_SURFACES.length,15);
  for (const s of STORY_SURFACES) {
    assert.ok(TACTILE_BASE_PATTERNS[s]); assert.ok(TACTILE_PATTERNS[s]);
    assert.match(TACTILE_PATTERNS[s],/float storyHeight =/);
    assert.match(TACTILE_PATTERNS[s],/float storyReliefFilter =/);
  }
});
test('surface/detail combinations have independent stable program keys', () => {
  const keys=STORY_SURFACES.flatMap(s=>['base','relief'].map(d=>tactileProgramKey(s,d)));
  assert.equal(new Set(keys).size,STORY_SURFACES.length*2);
  assert.equal(tactileProgramKey('wood','base'),tactileProgramKey('wood','base'));
});
test('base compilation excludes normal-gradient work for every finish', () => {
  for(const surface of STORY_SURFACES) {
    const s=applyTactileShader(template(),surface,'base');
    assert.doesNotMatch(s.fragmentShader,/storyGradient|storyHeight|dFdx\(|dFdy\(/);
    assert.match(s.fragmentShader,/#include <normal_fragment_maps>/);
    assert.match(s.fragmentShader,/roughnessFactor = clamp/);
  }
});
test('both variants preserve standard fog, colour and tone mapping', () => {
  for(const surface of STORY_SURFACES) for(const detail of ['base','relief']) {
    const s=applyTactileShader(template(),surface,detail);
    for(const chunk of ['tonemapping_fragment','colorspace_fragment','fog_fragment']) assert.ok(s.fragmentShader.includes('#include <'+chunk+'>'));
    assert.doesNotMatch(s.fragmentShader,/gl_FragColor\s*=/);
    assert.match(s.vertexShader,/instanceMatrix\[3\]\.xyz/);
    assert.match(s.vertexShader,/length\(instanceMatrix\[0\]\.xyz\)/);
  }
});
test('vertical and horizontal textile faces use two varying coordinates', () => {
  for(const surface of ['linen','paper']) {
    const s=applyTactileShader(template(),surface,'relief');
    assert.match(s.fragmentShader,/\? p\.xy/);assert.match(s.fragmentShader,/\? p\.xz : p\.zy/);
    assert.match(TACTILE_PATTERNS[surface],/storyPlane\.x/);assert.match(TACTILE_PATTERNS[surface],/storyPlane\.y/);
  }
});
test('every relief height is analytic and not a derivative of a derivative', () => {
  for(const pattern of Object.values(TACTILE_PATTERNS)) {
    const height=pattern.split('\n').find(l=>l.includes('float storyHeight'));
    assert.doesNotMatch(height,/fwidth|dFdx|dFdy|filtered|detail|grain/);
  }
});
test('geometry and matrices are unchanged by material compilation', () => {
  const s=applyTactileShader(template(),'bark','relief');
  assert.doesNotMatch(s.vertexShader,/transformed\s*[+*/-]?=|gl_Position\s*=|instanceMatrix\[\d\].*=/);
  assert.match(s.fragmentShader,/max\(abs\(storyDet\), 1e-8\)/);
  assert.match(s.fragmentShader,/\.24 \/ max\(length\(storyGradient\), 1e-6\)/);
});
test('one chapter policy wraps all scene and interaction renderers', () => {
  const s=read('src/components/three/journey/JourneyWorldComposition.tsx');
  assert.match(s,/<TactileDetailProvider quality=\{qualityProfile.quality\} reducedEffects=\{reducedEffects\}>/);
  assert.ok(s.indexOf('<TactileDetailProvider')<s.indexOf('<JourneySceneDirector'));
  assert.ok(s.indexOf('</TactileDetailProvider>')>s.indexOf('<JourneySceneDirector'));
});
test('finish changes introduce no texture fetch, render loop or story write', () => {
  const s=read('src/components/three/storyEvents/TactileMaterial.tsx')+read('src/components/three/storyEvents/tactileShader.ts');
  assert.doesNotMatch(s,/TextureLoader|WebGLRenderTarget|requestAnimationFrame|useFrame|useJourneyStore|dispatchStoryEvent|localStorage|Date\.now|Math\.random/);
  assert.match(s,/key=\{cacheKey\(\)\}/);assert.match(s,/customProgramCacheKey=\{cacheKey\}/);
});
test('batched path stones preserve every original position, orientation and radius', () => {
  for(const count of [1,8,9,14]) for(const length of [8.8,12,15]) for(const fork of [0,.62,-.4]) {
    const forms=stonePathLayout(count,length,fork,.02);assert.equal(forms.length,count);
    forms.forEach((f,i)=>{
      const p=count<=1?0:i/(count-1),radius=.72+i%3*.11;
      assert.deepEqual(f.position,[fork*Math.max(0,p-.42)*6+Math.sin(i*2.2)*.18,.02,-length*.5+p*length]);
      assert.deepEqual(f.rotation,[-Math.PI/2,0,i*.27]);assert.deepEqual(f.scale,[radius,radius,1]);
    });
  }
});
test('invalid paths are empty and defensive counts are bounded', () => {
  assert.deepEqual(stonePathLayout(NaN),[]);assert.deepEqual(stonePathLayout(9,Infinity),[]);
  assert.deepEqual(stonePathLayout(-1),[]);assert.equal(stonePathLayout(100000).length,256);
});
test('shared stone paths use one instance batch with refreshed bounds', () => {
  const s=read('src/components/three/chapters/ChapterPrimitives.tsx').split('export const StonePath =')[1].split('export const ThornBranches =')[0];
  assert.equal((s.match(/<instancedMesh/g)||[]).length,1);assert.doesNotMatch(s,/<mesh[ >]/);
  assert.match(s,/computeBoundingSphere/);assert.match(s,/computeBoundingBox/);
  assert.match(s,/createSteppingStoneGeometry/);assert.match(s,/geometry=\{geometry\}/);
});

test('folds pin the hanging edge and stay inside their depth budget', () => {
  for(const width of [.2,1,2.1,6.8]) for(let i=0;i<=20;i++) {
    const u=i/20; assert.equal(veilFoldDepth(u,1,width),0);
    for(let j=0;j<=20;j++) assert.ok(Math.abs(veilFoldDepth(u,j/20,width))<=Math.min(.1,width*.04)+1e-10);
  }
  assert.equal(veilFoldDepth(NaN,0,2),0);
});
test('fold geometry is disposed and reduced motion restores the authored pose', () => {
  const s=read('src/components/three/chapters/ChapterPrimitives.tsx').split('export const FabricVeil =')[1].split('export const FloatingMotes =')[0];
  assert.match(s,/geometry.dispose/);assert.match(s,/computeVertexNormals/);
  assert.match(s,/reducedMotion.*rotation.set/);
  assert.doesNotMatch(s,/useJourneyStore|dispatchStoryEvent|setState/);
});

test('chapter comparison fixtures use the candidate quality policy without changing the historical baseline', () => {
  const s=read('scripts/review-cinematography.mjs');
  assert.match(s,/dir===root\?withMaterialPolicy\(stage\):stage/);
  assert.match(s,/<TactileDetailProvider quality=\{quality\} reducedEffects=\{quality==='low'\}>/);
  assert.match(s,/Material review fixture anchor missing/);
});


test('construction grain programs use explicit piece attributes without changing object-space fallbacks', () => {
  const assembled=applyTactileShader(template(),'wood','relief',undefined,true);
  const ordinary=applyTactileShader(template(),'wood','relief');
  assert.match(assembled.vertexShader,/attribute vec3 storySurfacePosition/);
  assert.match(assembled.vertexShader,/vStoryPosition = storySurfacePosition/);
  assert.match(assembled.fragmentShader,/float cutEnd/);
  assert.doesNotMatch(ordinary.vertexShader,/attribute vec3 storySurfacePosition/);
  assert.doesNotMatch(ordinary.fragmentShader,/float cutEnd/);
  assert.notEqual(tactileProgramKey('wood','relief',true),tactileProgramKey('wood','relief'));
});
