import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { shotComposition, shotLens, settleLens, shotAimOffset, createShotSettle, resetShotSettle, advanceShotSettle, cameraPresentationActive, shotLensHeld } from '../src/cinematics/shotComposition.ts';
import { EMOTIONAL_PROFILES } from '../src/cinematics/emotionalProfiles.ts';
const source = p => readFileSync(p, 'utf8');
const base = { visible:true,focused:true,overlayOpen:false,mode:'explore',controls:'walk',physicsPaused:false,sceneCurrent:true };

test('all authored lenses stay finite and within comfortable bounds across viewport shapes',()=>{
  for(const [id,p]of Object.entries(EMOTIONAL_PROFILES))for(const aspect of [.25,.462,1,1.528,1.777,2.5,NaN,Infinity,0,-1]){
    const fov=shotLens(id,p.fov,aspect);assert.ok(Number.isFinite(fov)&&fov>=52&&fov<=78,`${id} ${aspect}`);
  }
});
test('portrait expands context without altering the authored landscape compression',()=>{
  for(const id of ['blue-moon.intimacy','thorned.old-memory-bedroom','enchanted.friendship-meadow','epilogue.constellation']){
    const p=EMOTIONAL_PROFILES[id];assert.ok(shotLens(id,p.fov,.462)>shotLens(id,p.fov,1.5));
  }
  assert.equal(shotLens('thorned.old-memory-bedroom',59,1.5),59);
});
test('unsupported chapters retain the original lens and no lateral composition',()=>{
  assert.equal(shotLens('river.release-surrender',68,.462),68);
  assert.deepEqual(shotAimOffset('river.release-surrender',8,68,1.5),[-0,-0]);
  assert.equal(shotComposition('__proto__').portraitExpansion,0);
  assert.equal(shotComposition('constructor').portraitExpansion,0);
});
test('comfort mode is stable 65 degrees at every aspect and never animates',()=>{
  for(const aspect of [.4,1,2]){
    assert.equal(shotLens('blue-moon.intimacy',62,aspect,true),65);
    assert.equal(settleLens(78,65,.016,true),65);
  }
});
test('invalid lenses and aspect values have finite fallbacks',()=>{
  assert.ok(Number.isFinite(shotLens('blue-moon.intimacy',NaN,NaN)));
  assert.equal(settleLens(NaN,65,.02),65);
  assert.equal(settleLens(63,72,NaN),63);
  assert.equal(settleLens(63,72,-1),63);
});
test('lens transitions are capped at three degrees per second and do not overshoot',()=>{
  let fov=59;
  for(let i=0;i<600;i++){const next=settleLens(fov,75,1/60);assert.ok(next>=fov&&next<=75);assert.ok(next-fov<=.05+1e-10);fov=next;}
  assert.ok(fov>74.9);
  assert.ok(settleLens(75,59,10)>=74.85);
});
test('equal-duration 30/60/120Hz lens changes approximately agree',()=>{
  const result=hz=>{let fov=63;for(let i=0;i<hz*6;i++)fov=settleLens(fov,69,1/hz);return fov;};
  assert.ok(Math.abs(result(30)-result(120))<.015);
});
test('settling uses a bounded soft envelope rather than an indefinite camera pull',()=>{
  const state=createShotSettle();const steps=[];
  for(let i=0;i<600;i++)steps.push(advanceShotSettle(state,1/60,.018,true));
  assert.ok(state.turned>0&&state.turned<=.045);assert.ok(state.elapsed<=4);
  assert.equal(advanceShotSettle(state,.05,.018,true),0);
  assert.ok(steps[0]<steps[90]);assert.ok(steps[230]<steps[90]);
});
test('held input cancels the current settling interval immediately',()=>{
  const state=createShotSettle();advanceShotSettle(state,.05,.018,true);
  assert.equal(advanceShotSettle(state,.05,.018,false),0);
  assert.deepEqual(state,{elapsed:0,turned:0});
});
test('zero attraction never introduces camera motion into silence or lantern-owned scenes',()=>{
  const state=createShotSettle();for(let i=0;i<1000;i++)assert.equal(advanceShotSettle(state,.05,0,true),0);
  assert.deepEqual(state,{elapsed:0,turned:0});
});
test('invalid and stalled frame inputs do not manufacture a camera jump',()=>{
  const state=createShotSettle();assert.equal(advanceShotSettle(state,NaN,.018,true),0);
  assert.equal(advanceShotSettle(state,.05,NaN,true),0);
  assert.ok(advanceShotSettle(state,1000,1000,true)<=.018*.05);
  resetShotSettle(state);assert.deepEqual(state,{elapsed:0,turned:0});
});
test('settling budget is deterministic and frame-rate independent within tolerance',()=>{
  const run=hz=>{const s=createShotSettle();for(let i=0;i<hz*8;i++)advanceShotSettle(s,1/hz,.018,true);return s.turned;};
  assert.ok(Math.abs(run(30)-run(120))<.0001);assert.equal(run(60),run(60));
});
test('screen composition offsets remain subtle and portrait lateral bias is reduced',()=>{
  const landscape=shotAimOffset('blue-moon.intimacy',10,65,1.5),portrait=shotAimOffset('blue-moon.intimacy',10,74,.462);
  assert.ok(Math.abs(portrait[0])<Math.abs(landscape[0]));assert.ok(landscape.every(x=>Math.abs(x)<.6));
  assert.deepEqual(shotAimOffset('blue-moon.intimacy',NaN,65,1),[0,0]);
});
for(const [label,override]of Object.entries({hidden:{visible:false},unfocused:{focused:false},settings:{overlayOpen:true},reading:{mode:'read'},map:{mode:'map'},orbit:{controls:'orbit'},paused:{physicsPaused:true},staleScene:{sceneCurrent:false}})){
  test(`camera yields to ${label}`,()=>{assert.equal(cameraPresentationActive(base),true);assert.equal(cameraPresentationActive({...base,...override}),false);});
}
test('camera consumer retains a single owner, explicit scene, multi-pointer input and cleanup',()=>{
  const s=source('src/player/useCameraAssistance.ts');
  assert.match(s,/new Set<number>/);assert.match(s,/heldPointers\.current\.delete\(event\.pointerId\)/);
  assert.match(s,/usePlayerInputStore\.subscribe/);assert.match(s,/unsubscribe\(\)/);
  assert.match(s,/openingOwned/);assert.match(s,/previousTarget/);
  assert.doesNotMatch(s,/camera\.position\.(set|copy|add|lerp)|dispatchStoryEvent|localStorage|gl\.render|useFrame\([^]*,\s*[1-9]\)/);
  assert.match(source('src/components/three/cinematics/EmotionalCinematographyDirector.tsx'),/CinematicCameraDirector sceneId=\{sceneId\}/);
  assert.match(source('src/components/three/cinematics/CinematicCameraDirector.tsx'), /if \(cameraHasAuthority\(camera\)\) return/);
});
test('bark, stone and wood detail remains on lit, derivative-filtered materials',()=>{
  const s=(source('src/components/three/storyEvents/TactileMaterial.tsx') + source('src/components/three/storyEvents/tactileShader.ts'));
  assert.match(s,/bark:/);assert.match(s,/stone:/);assert.match(s,/fwidth/);
  assert.match(s,/roughnessFactor = clamp/);assert.match(s,/sidtw-tactile-\$\{surface\}-v9/);
  assert.doesNotMatch(s,/TextureLoader|WebGLRenderTarget|requestAnimationFrame|useFrame/);
});
test('existing environment batches receive material detail without new instance batches',()=>{
  const s=source('src/components/three/environment/EnvironmentDressing.tsx');
  assert.match(s,/name="depth-trunks-and-branches"[^\n]*surface="bark"/);
  assert.match(s,/name="shoreline-stones"[^\n]*surface="stone"/);
});

test('review fixtures retain the opening lens and the original untextured environment baseline',()=>{
  const s=source('scripts/review-cinematography.mjs');
  assert.match(s,/\(before\|\|which==='broken'\)\?profile\.fov:shotLens/);
  assert.match(s,/before&&i>=3\?<meshStandardMaterial/);
  assert.match(s,/cacheDir: \$\{JSON\.stringify\(cwd/);
  assert.match(s,/\+\+frames\.current===25/);
  assert.match(s,/\['blue','house'\]\.includes\(which\)\)await capture\(which,390,844,'low',true\)/);
});


test('unbuttoned look input holds the lens throughout the handoff interval', () => {
  for (const since of [0, 10, 100, 349.999]) assert.equal(shotLensHeld(false, 1000 + since, 1000), true);
  assert.equal(shotLensHeld(false, 1350, 1000), false);
  assert.equal(shotLensHeld(false, 5000, 1000), false);
  assert.equal(shotLensHeld(true, 5000, 1000), true);
});
test('a sequence of pointer moves keeps the lens held without a mouse button', () => {
  let lastInput = 0;
  for (let now = 0; now < 2400; now += 16) {
    if (now % 160 === 0) lastInput = now;
    assert.equal(shotLensHeld(false, now, lastInput), true);
  }
  assert.equal(shotLensHeld(false, lastInput + 351, lastInput), false);
});
test('invalid or reversed timing cannot start an automatic lens move', () => {
  for (const [now, last] of [[NaN, 0], [0, NaN], [Infinity, 0], [100, 101]])
    assert.equal(shotLensHeld(false, now, last), true);
});
test('the camera consumes recent-input holding and yields on interrupted frames', () => {
  const s = source('src/player/useCameraAssistance.ts');
  assert.match(s, /shotLensHeld\(inputActive, now, lastInput\.current\)/);
  assert.match(s, /delta > \.25/);
  assert.match(s, /addEventListener\("pageshow", noteInput\)/);
  assert.match(s, /removeEventListener\("pageshow", noteInput\)/);
});
test('every material provides analytic height and a separate relief filter', () => {
  const s = (source('src/components/three/storyEvents/TactileMaterial.tsx') + source('src/components/three/storyEvents/tactileShader.ts'));
  assert.equal((s.match(/float storyHeight =/g) ?? []).length, 15);
  assert.equal((s.match(/float storyReliefFilter =/g) ?? []).length, 15);
  for (const line of s.split('\n').filter(line => line.includes('float storyHeight =')))
    assert.doesNotMatch(line, /fwidth|dFdx|dFdy|filtered|detail|grain/);
});
test('relief guards degenerate derivatives, slope, backfaces and far-distance shimmer', () => {
  const s = (source('src/components/three/storyEvents/TactileMaterial.tsx') + source('src/components/three/storyEvents/tactileShader.ts'));
  assert.match(s, /max\(abs\(storyDet\), 1e-8\)/);
  assert.match(s, /\.24 \/ max\(length\(storyGradient\), 1e-6\)/);
  assert.match(s, /faceDirection/);
  assert.match(s, /smoothstep\(20\.0, 48\.0, length\(vViewPosition\)\)/);
  assert.match(s, /normal_fragment_maps/);
});
test('instance variation is tied to static local layout, not camera or animation time', () => {
  const s = (source('src/components/three/storyEvents/TactileMaterial.tsx') + source('src/components/three/storyEvents/tactileShader.ts'));
  assert.match(s, /#ifdef USE_INSTANCING/);
  assert.match(s, /instanceMatrix\[3\]\.xyz/);
  assert.doesNotMatch(s, /modelMatrix\[3\]|Date\.now|Math\.random|uniform float time|displacementMap/);
});
