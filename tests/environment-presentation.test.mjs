import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { CHAPTER_ENVIRONMENTS, environmentFamily, environmentBudget, environmentFogDensity, environmentTime, forestDepthLayout, shorelineLayout, roomShellWithoutFloor } from '../src/components/three/environment/chapterEnvironment.ts';
const source = p => readFileSync(p, 'utf8');

test('only explicitly supported chapter scenes receive the authored atmosphere', () => {
  for (const id of ['broken-floor.confession','blue-moon.sanctuary','blue-moon.intimacy','blue-moon.caged-bird','thorned.locked-garden','thorned.old-memory-bedroom','thorned.self-owned-world','enchanted.rabbit-hole','enchanted.friendship-meadow','enchanted.masked-hearth','epilogue.constellation']) assert.ok(environmentFamily(id));
  for (const id of ['epilogue.unknown','river.wash','blue-moon.unknown','enchanted.unknown','nest.protection','']) assert.equal(environmentFamily(id), null);
});
test('chapter keys and fog are finite authored values', () => {
  for (const preset of Object.values(CHAPTER_ENVIRONMENTS)) {
    assert.match(preset.fogColor, /^#[0-9a-f]{6}$/); assert.ok(preset.fogScale > 0 && preset.fogScale < 2);
    assert.ok(preset.keyIntensity > 0 && preset.keyIntensity <= 22);
    for (const v of [...preset.keyPosition,...preset.keyTarget]) assert.ok(Number.isFinite(v));
  }
});
test('quality budgets are bounded and reduced-effects keeps the low-tier layout', () => {
  let previous = 0;
  for (const quality of ['low','medium','high','cinematic']) {
    const b = environmentBudget(quality,false); assert.ok(b.trees >= previous && b.trees <= 30); previous = b.trees;
    assert.deepEqual(environmentBudget(quality,true), environmentBudget('low',false));
  }
});
test('low-tier forest keeps all three depth bands without moving existing trees', () => {
  const low = forestDepthLayout(12), full = forestDepthLayout(30);
  assert.deepEqual(low, full.slice(0,12)); assert.equal(new Set(low.map(t=>t.layer)).size,3);
});
test('forest dressing leaves the authored central corridor and objects clear', () => {
  for (const t of forestDepthLayout(30)) {
    assert.ok(Math.abs(t.base[0]) >= 11.6); assert.ok(t.height > 7 && t.height < 19);
    assert.ok([...t.base,t.height,t.width,t.lean].every(Number.isFinite));
  }
});
test('shoreline dressing stays off the bridge and has positive finite scales', () => {
  for (const reeds of [false,true]) for (const t of shorelineLayout(40,reeds)) {
    assert.ok(Math.abs(t.position[0]) >= 9.9); assert.ok(t.scale.every(v=>Number.isFinite(v)&&v>0));
    assert.ok(t.position.every(Number.isFinite));
  }
});
test('invalid or excessive layout requests cannot allocate unbounded objects', () => {
  for (const n of [NaN,Infinity,-1,-Infinity]) {assert.equal(forestDepthLayout(n).length,0);assert.equal(shorelineLayout(n).length,0);}
  assert.equal(forestDepthLayout(1e8).length,30); assert.equal(shorelineLayout(1e8).length,40);
});
test('fog retains the existing non-target scene formula and stays bounded elsewhere', () => {
  assert.ok(Math.abs(environmentFogDensity(.01,60,null) - .013) < 1e-12);
  for (const family of Object.keys(CHAPTER_ENVIRONMENTS)) for (const visibility of [0,38,75,100,NaN]) {
    const density=environmentFogDensity(.016,visibility,family);
    assert.ok(Number.isFinite(density)&&density>=0&&density<=.025);
    assert.ok(environmentFogDensity(.016,visibility,family,true)<=density);
  }
});
test('atmospheric motion freezes in reduced motion and hidden tabs without catch-up', () => {
  assert.equal(environmentTime(4,5,false,false),4);assert.equal(environmentTime(4,5,true,true),4);
  assert.equal(environmentTime(4,5,true,false),4.05);assert.equal(environmentTime(4,NaN,true,false),4);
});
test('dressing uses opaque instances with updated bounds and no game-state writes', () => {
  const code=source('src/components/three/environment/EnvironmentDressing.tsx');
  assert.match(code,/instancedMesh/);assert.match(code,/computeBoundingSphere/);assert.match(code,/computeBoundingBox/);
  assert.doesNotMatch(code,/useFrame|transparent|setState|dispatchStoryEvent|localStorage|RigidBody/);
});
test('new lights and water introduce no extra shadow maps or reflection targets', () => {
  const lights=source('src/components/three/environment/ChapterLightRig.tsx'), water=source('src/components/three/environment/SanctuaryWater.tsx');
  assert.match(lights,/castShadow=\{false\}/); assert.doesNotMatch(lights,/castShadow=\{true\}/);
  assert.doesNotMatch(water,/WebGLRenderTarget|transmission=|transparent\s|dispatchStoryEvent/);
});
test('chapter depth does not create a competing fog owner', () => {
  for (const p of ['ChapterLightRig','EnvironmentDressing','SanctuaryWater']) assert.doesNotMatch(source(`src/components/three/environment/${p}.tsx`),/scene\.fog|attach="fog"/);
  assert.match(source('src/components/three/cinematics/CinematicAtmosphereDirector.tsx'),/environmentFogDensity/);
});

test('water settings update the compiled uniform objects instead of orphaning them', () => {
  const water=source('src/components/three/environment/SanctuaryWater.tsx');
  assert.match(water,/waterDetail: \{ value: 1 \} \}\), \[\]\)/);
  assert.match(water,/uniforms\.waterDetail\.value = reducedEffects \? \.5 : presentation \? Math.min\(1, presentation.motion.water \* 4\) : 1/);
});

test('room shell removes only downward triangles without changing the interactive floor', () => {
  const normals=[0,-1,0, 0,-1,0, 0,-1,0, 0,1,0, 1,0,0, 0,0,1];
  const indices=[0,1,2, 3,4,5];
  assert.deepEqual(roomShellWithoutFloor(indices,normals),[3,4,5]);
  assert.deepEqual(indices,[0,1,2,3,4,5]);
  const chapter=source('src/components/three/chapters/BrokenFloorChapter.tsx');
  assert.match(chapter,/geometry=\{roomGeometry\}/);
  assert.match(chapter,/<WetFloorReveal stage=\{revealStage\}/);
  assert.match(source('src/components/three/storyEvents/WetFloorReveal.tsx'),/planeGeometry args=\{\[12\.8, 12\.5\]\}/);
});
test('reduced motion snaps chapter fog without an extra transition', () => {
  assert.match(source('src/components/three/cinematics/CinematicAtmosphereDirector.tsx'),/const alpha = reducedMotion \? 1/);
});
