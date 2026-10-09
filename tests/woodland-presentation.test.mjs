import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { meadowFlowerForms, finalWoodlandForms } from '../src/components/three/environment/woodlandSceneLayout.ts';
import { forestDepthLayout, environmentBudget, environmentFamily, CHAPTER_ENVIRONMENTS } from '../src/components/three/environment/chapterEnvironment.ts';
const source = p => readFileSync(p, 'utf8');
const anchors = [[-14.5,0,-15],[10.5,0,-16.5],[-16,0,-21.5],[13.5,0,-22],[-12.5,0,-27],[8.5,0,-27],[-18,0,-28],[16.5,0,-28]];
const close = (a,b) => assert.ok(Math.abs(a-b)<1e-10, `${a} != ${b}`);

test('meadow batching preserves all flower locations, sizes and authored colours', () => {
  for (const reduced of [false,true]) {
    const { stems, flowers } = meadowFlowerForms(reduced);
    assert.equal(flowers.length, reduced ? 8 : 18); assert.equal(stems.length, flowers.length);
    flowers.forEach((f,i) => {
      const x=(i%2===0?-1:1)*(2.7+(i%5)*.72),z=-6+Math.floor(i/2)*1.3;
      assert.deepEqual(f.position,[x,.5,z]); assert.deepEqual(f.scale,[1,1,1]);
      assert.equal(f.color,['#c697a5','#d8d2b4','#8da38b'][i%3]);
      assert.deepEqual(stems[i].position,[x,.28,z]); assert.deepEqual(stems[i].scale,[1,.4,1]);
    });
  }
});
test('reduced-effects meadow is a stable prefix, not a reshuffled composition', () => {
  const low=meadowFlowerForms(true),full=meadowFlowerForms(false);
  assert.deepEqual(low.stems,full.stems.slice(0,8));assert.deepEqual(low.flowers,full.flowers.slice(0,8));
});
test('ending tree instancing preserves every original trunk anchor and rotation', () => {
  const forms=finalWoodlandForms(anchors,8);
  forms.trunks.forEach((form,i)=>{
    const h=6.4+(i%3)*1.25;
    assert.deepEqual(form.position,[anchors[i][0],h*.5,anchors[i][2]]);
    assert.deepEqual(form.scale,[1,h,1]); assert.deepEqual(form.rotation,[0,i*1.37,0]);
  });
});
test('ending crown transforms preserve parent rotation, dimensions and colour', () => {
  const { crowns }=finalWoodlandForms(anchors,8);
  assert.equal(crowns.length,24);
  crowns.forEach((form,n)=>{
    const i=Math.floor(n/3),j=n%3,angle=i*1.37,h=6.4+(i%3)*1.25;
    const [x,y,z]=[[-.7,h-.35,.18],[.58,h+.1,-.24],[0,h+1.15,.05]][j];
    close(form.position[0],anchors[i][0]+x*Math.cos(angle)+z*Math.sin(angle));
    close(form.position[1],y); close(form.position[2],anchors[i][2]-x*Math.sin(angle)+z*Math.cos(angle));
    assert.deepEqual(form.scale,[1.6+j*.14,1.9,1.45]);
    assert.deepEqual(form.rotation,[0,angle,0]);assert.equal(form.color,j===1?'#2e3b34':'#26322d');
  });
});
test('ending layouts are deterministic and do not mutate input anchors', () => {
  const input=structuredClone(anchors),before=structuredClone(input);
  assert.deepEqual(finalWoodlandForms(input,8),finalWoodlandForms(input,8));assert.deepEqual(input,before);
});
test('ending layout allocation is finite and capped at eight original trees', () => {
  for(const n of [NaN,Infinity,-Infinity,-20])assert.equal(finalWoodlandForms(anchors,n).trunks.length,0);
  assert.equal(finalWoodlandForms(anchors,1e9).trunks.length,8);
  assert.equal(finalWoodlandForms(anchors.slice(0,2),7).trunks.length,2);
  assert.equal(finalWoodlandForms(anchors,3.8).trunks.length,3);
});
test('ending low-tier prefix preserves geometry while quality changes', () => {
  const low=finalWoodlandForms(anchors,4),high=finalWoodlandForms(anchors,8);
  assert.deepEqual(low.trunks,high.trunks.slice(0,4));assert.deepEqual(low.crowns,high.crowns.slice(0,12));
});
test('new roots remain at existing tree bases away from home and central sky', () => {
  for(const root of finalWoodlandForms(anchors,8).roots){
    assert.ok(Math.abs(root.position[0])>7.9);assert.ok(root.position[2]<-14);
    assert.ok(root.position[1]<.1);assert.ok(root.scale.every(n=>Number.isFinite(n)&&n>0));
  }
});
test('Enchanted Wood retains three depth bands at every quality and reduced-effects tier', () => {
  for(const q of ['low','medium','high','cinematic'])for(const reduced of [false,true]){
    const trees=forestDepthLayout(environmentBudget(q,reduced).trees,'enchanted-wood');
    assert.equal(new Set(trees.map(t=>t.layer)).size,3);
    for(const t of trees){assert.ok(Math.abs(t.base[0])>=9.6);assert.ok(t.height>6&&t.height<15);assert.ok(t.base.every(Number.isFinite));}
  }
});
test('Enchanted Wood quality prefixes are stable and do not change sanctuary defaults', () => {
  assert.deepEqual(forestDepthLayout(12,'enchanted-wood'),forestDepthLayout(30,'enchanted-wood').slice(0,12));
  assert.deepEqual(forestDepthLayout(30),forestDepthLayout(30,'blue-moon'));
  assert.notDeepEqual(forestDepthLayout(12),forestDepthLayout(12,'enchanted-wood'));
});
test('only explicit additional scene IDs get woodland or ending light and fog', () => {
  for(const id of ['enchanted.rabbit-hole','enchanted.friendship-meadow','enchanted.masked-hearth'])assert.equal(environmentFamily(id),'enchanted-wood');
  assert.equal(environmentFamily('epilogue.constellation'),'lantern-epilogue');
  for(const id of ['crowned.home','enchanted.unknown','epilogue.unknown'])assert.equal(environmentFamily(id),null);
  const end=CHAPTER_ENVIRONMENTS['lantern-epilogue'];close(end.keyIntensity*end.reducedKeyScale,.38);
});
test('batch data has finite positive transforms and valid colours', () => {
  for(const group of [...Object.values(finalWoodlandForms(anchors,8)),...Object.values(meadowFlowerForms(false))])for(const form of group){
    assert.ok(form.position.every(Number.isFinite));assert.ok(form.scale.every(n=>Number.isFinite(n)&&n>0));
    if(form.color)assert.match(form.color,/^#[0-9a-f]{6}$/);
  }
});
test('shared instances upload colour changes, clear stale colours and recompute bounds', () => {
  const code=source('src/components/three/environment/EnvironmentDressing.tsx');
  for(const pattern of [/target\.setColorAt/,/form\.color \?\? "#ffffff"/,/instanceColor\.needsUpdate = true/,/computeBoundingSphere/,/computeBoundingBox/])assert.match(code,pattern);
  assert.doesNotMatch(code,/useFrame|dispatchStoryEvent|localStorage|RigidBody/);
});
test('woodland details remain decorative, static and free of extra light or fog owners', () => {
  const code=source('src/components/three/environment/WoodlandDetails.tsx');
  assert.doesNotMatch(code,/useFrame|useJourneyStore|setState|dispatchStoryEvent|localStorage|Light|scene\.fog|RigidBody/);
  assert.match(code,/drawCallBudget: 2/);assert.match(code,/drawCallBudget: 3/);
});
test('scene wiring retains existing landmarks and completion callbacks', () => {
  const end=source('src/components/three/chapters/IntegratedFinalTableau.tsx');
  for(const pattern of [/name="final-woods-remain"/,/<WitnessedMemoryConstellation/,/<ReverseMemoryLights/,/onFormationComplete=\{onFinalConstellationFormationComplete\}/,/<FinalWoodlandDetails/,/<ChapterLightRig family="lantern-epilogue"/])assert.match(end,pattern);
  const wood=source('src/scenes/first-wood/FirstWoodScene.tsx');
  // The decorative Meadow pond was retired; narrative landmarks remain.
  for(const pattern of [/<MeadowFlowers/,/variant="enchanted-wood"/,/<FabricVeil/,/<LanternProp/])assert.match(wood,pattern);
  assert.doesNotMatch(wood,/StonePath/);
});

// Conservative crown-envelope checks complement screenshots. They do not prove
// occlusion, lighting or full gameplay visibility, but reject off-camera layouts.
function visibleCrownBands(aspect) {
  const bands = new Set(), tangent = Math.tan(65 * Math.PI / 360);
  forestDepthLayout(12, 'enchanted-wood').forEach((tree, i) => {
    for (let j = 0; j < 3; j++) {
      const angle = i * 2.4 + j * 2.1;
      const x = tree.base[0] + tree.lean + Math.cos(angle) * 2.1;
      const y = tree.height * (.69 + j * .075) + .9 - 2.7;
      const depth = tree.base[2] + .38 + Math.sin(angle) * 1.8 + 8;
      if (depth > 0 && Math.abs(x) - 2 < depth * tangent * aspect && Math.abs(y) - 2 < depth * tangent) bands.add(tree.layer);
    }
  });
  return bands;
}
test('low-detail woodland puts all depth bands in the desktop approach envelope', () => {
  assert.equal(visibleCrownBands(1100 / 720).size, 3);
});
test('portrait approach retains background crown envelopes without camera changes', () => {
  assert.ok(visibleCrownBands(390 / 844).size >= 2);
});

test('every quality keeps tree bases and root envelopes on the existing ground', () => {
  for (const tree of forestDepthLayout(30, 'enchanted-wood')) {
    assert.ok(Math.hypot(tree.base[0], tree.base[2]) + 1 < 16);
    assert.ok(tree.base[0] * tree.lean < 0, 'crowns should lean inward');
    assert.ok(Math.abs(tree.base[0] + tree.lean * .4) > 7.8, 'lower trunk clears existing objects');
  }
});
