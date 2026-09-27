import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { createMushroomClusterBuffers } from '../src/components/three/environmentArt/woodlandGrowthBuffers.ts';
import { woodlandAccentsLayout } from '../src/components/three/environment/woodlandAccentsLayout.ts';
import { createFireflyField, fireflyCount, FIREFLY_VERTEX, FIREFLY_FRAGMENT } from '../src/components/three/environment/woodlandFireflyField.ts';
import { groundMistPatches, GROUND_MIST_VERTEX, GROUND_MIST_FRAGMENT } from '../src/components/three/artDirection/groundMistField.ts';
const source = path => readFileSync(new URL(`../src/components/three/${path}`, import.meta.url), 'utf8');
const cross = (a,b) => [a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const sub = (a,b) => a.map((v,i)=>v-b[i]);
const dot = (a,b) => a.reduce((sum,v,i)=>sum+v*b[i],0);
for (const rich of [false,true]) {
  test(`mushrooms ${rich ? 'rich' : 'base'}: deterministic finite and aligned buffers`, () => {
    const data=createMushroomClusterBuffers(rich), vertices=data.positions.length/3;
    assert.deepEqual(data,createMushroomClusterBuffers(rich));
    for(const values of Object.values(data))assert.ok(values.every(Number.isFinite));
    assert.equal(data.normals.length,vertices*3);assert.equal(data.colors.length,vertices*3);assert.equal(data.uvs.length,vertices*2);
    assert.ok(data.indices.every(i=>Number.isInteger(i)&&i>=0&&i<vertices));assert.equal(data.indices.length%3,0);
  });
  test(`mushrooms ${rich ? 'rich' : 'base'}: grounded, compact and within triangle budget`, () => {
    const {positions,indices}=createMushroomClusterBuffers(rich);
    let floor=Infinity,ceiling=-Infinity;
    for(let i=0;i<positions.length;i+=3){
      assert.ok(Math.hypot(positions[i],positions[i+2])<.52);
      floor=Math.min(floor,positions[i+1]);ceiling=Math.max(ceiling,positions[i+1]);
    }
    assert.equal(floor,0);assert.ok(ceiling<.5);assert.ok(indices.length/3<=650);
  });
  test(`mushrooms ${rich ? 'rich' : 'base'}: non-degenerate outward triangles and unit normals`, () => {
    const data=createMushroomClusterBuffers(rich);let volume=0;
    for(let i=0;i<data.normals.length;i+=3)assert.ok(Math.abs(Math.hypot(...data.normals.slice(i,i+3))-1)<1e-6);
    for(let i=0;i<data.indices.length;i+=3){
      const ids=data.indices.slice(i,i+3), [a,b,c]=ids.map(j=>data.positions.slice(j*3,j*3+3));
      const face=cross(sub(b,a),sub(c,a));assert.ok(Math.hypot(...face)>1e-9);
      const normal=ids.map(j=>data.normals.slice(j*3,j*3+3)).reduce((sum,n)=>sum.map((v,k)=>v+n[k]),[0,0,0]);
      assert.ok(dot(face,normal)>0,`inward triangle at ${i/3}`);volume+=dot(a,cross(b,c))/6;
    }
    assert.ok(volume>0);
  });
  test(`mushrooms ${rich ? 'rich' : 'base'}: linear vertex colours stay bounded`, () => {
    assert.ok(createMushroomClusterBuffers(rich).colors.every(c=>c>=0&&c<=1));
  });
}
test('rich mushroom contours increase detail without adding more objects',()=>{
  const low=createMushroomClusterBuffers(false),high=createMushroomClusterBuffers(true);
  assert.ok(high.indices.length>low.indices.length);assert.ok(high.positions.length>low.positions.length);
});
test('all new layout prefixes remain stable across quality levels',()=>{
  for(const variant of ['enchanted-wood','blue-moon']){
    const full=woodlandAccentsLayout(variant,'cinematic');
    for(const q of ['low','medium','high','cinematic'])for(const [kind,items]of Object.entries(woodlandAccentsLayout(variant,q))){
      assert.deepEqual(items,full[kind].slice(0,items.length));
    }
  }
});
test('mushroom clusters and taller trees respect full clearance envelopes',()=>{
  const radius={saplings:1.65,stones:1.15,twigs:.85,fungi:.7};
  for(const variant of ['enchanted-wood','blue-moon'])for(const [kind,items]of Object.entries(woodlandAccentsLayout(variant,'cinematic'))){
    for(const item of items){
      const [x,y,z]=item.position,r=radius[kind]*Math.max(item.scale[0],item.scale[2]);
      assert.ok(Math.hypot(x,z)+r<16,`${variant}/${kind} outside ground`);
      assert.ok(Math.abs(x)-r>(variant==='blue-moon'?9.5:6),`${variant}/${kind} in route`);
      if(variant==='enchanted-wood')assert.ok(Math.hypot(x+4.8,z-1.4)-r>3.6,`${kind} in pond`);
      assert.ok(y>=-.2&&y<=-.19);
    }
  }
});
test('low/reduced effects allocate no mushrooms; sanctuary receives no new trees',()=>{
  for(const q of ['low','medium','high','cinematic'])for(const variant of ['enchanted-wood','blue-moon']){
    const low=woodlandAccentsLayout(variant,'low');assert.equal(low.fungi.length,0);
    assert.deepEqual(woodlandAccentsLayout(variant,q,true),low);
  }
  assert.equal(woodlandAccentsLayout('blue-moon','cinematic').saplings.length,0);
  assert.equal(woodlandAccentsLayout('enchanted-wood','cinematic').saplings.length,12);
  assert.equal(woodlandAccentsLayout('enchanted-wood','high').saplings.length,8);
});
test('firefly arrays are finite, capped and stable when quality changes',()=>{
  for(const count of [NaN,Infinity,-Infinity,-5,0])assert.equal(createFireflyField(count).seeds.length,0);
  assert.equal(createFireflyField(1e6).seeds.length,18);assert.equal(createFireflyField(4.9).seeds.length,4);
  const a=createFireflyField(12),b=createFireflyField(18);
  assert.deepEqual(a.positions,b.positions.slice(0,36));assert.deepEqual(a.seeds,b.seeds.slice(0,12));
  assert.deepEqual(b,createFireflyField(18));assert.ok([...b.positions,...b.seeds].every(Number.isFinite));
});
test('firefly motion envelope stays clear of the path, pond and ground',()=>{
  const {positions}=createFireflyField(18);
  for(let i=0;i<positions.length;i+=3){
    const [x,y,z]=Array.from(positions.slice(i,i+3));
    assert.ok(Math.abs(x)-.45>8.8);assert.ok(y-.45>0);
    assert.ok(Math.hypot(x,z)+.45<16);assert.ok(Math.hypot(x+4.8,z-1.4)-.45>3.6);
  }
});
test('fireflies only appear in the two authored dark woodland scenes',()=>{
  for(const id of ['enchanted.rabbit-hole','enchanted.masked-hearth']){
    assert.equal(fireflyCount(id,'high'),12);assert.equal(fireflyCount(id,'cinematic'),18);
    for(const q of ['low','medium','unknown'])assert.equal(fireflyCount(id,q),0);
    assert.equal(fireflyCount(id,'cinematic',true),0);assert.equal(fireflyCount(id,'cinematic',false,true),0);
  }
  for(const id of ['enchanted.friendship-meadow','enchanted.unknown','blue-moon.sanctuary','sunset.stillness','river.release-surrender','epilogue.constellation',''])assert.equal(fireflyCount(id,'cinematic'),0);
});
test('mist retains original patch placements and positive scales',()=>{
  assert.deepEqual(groundMistPatches('enchanted.rabbit-hole'),[[-8,.27,10,6,.4,3.4],[8,.3,12,5,.48,4],[-1,.18,17,8,.32,3]]);
  assert.deepEqual(groundMistPatches('blue-moon.sanctuary'),[[-8.4,.15,4,2.4,.3,5.5],[8.8,.2,6,2.1,.35,4.2]]);
  assert.deepEqual(groundMistPatches('river.wash'),[[8,.17,7,3.5,.3,6],[10,.15,14,4,.3,5]]);
  assert.equal(groundMistPatches('crowned.home').length,0);
  for(const patch of groundMistPatches('enchanted.rabbit-hole'))assert.ok(patch.every(Number.isFinite)&&patch.slice(3).every(v=>v>0));
});
test('mist batching wires shared instancing, proper normals and one bounded draw',()=>{
  const code=source('artDirection/GroundMist.tsx');
  assert.equal((code.match(/<instancedMesh /g)||[]).length,1);assert.equal((code.match(/<shaderMaterial /g)||[]).length,1);
  for(const pattern of [/drawCallBudget: 1/,/computeBoundingBox/,/computeBoundingSphere/,/look\.budget\.shafts/,/presentation\.time\.vegetation/])assert.match(code,pattern);
  assert.match(GROUND_MIST_VERTEX,/normal \/ max\(instanceScale/);assert.match(GROUND_MIST_FRAGMENT,/float nearby=smoothstep/);
  assert.doesNotMatch(code,/patches\.map|requestAnimationFrame|setState/);
});
test('fireflies use the shared scene clock and have no per-point lights or CPU loops',()=>{
  const code=source('environment/WoodlandFireflies.tsx');
  assert.match(code,/presentation\.time\.particles/);assert.match(code,/expandByScalar\(\.45\)/);
  assert.match(code,/depthWrite=\{false\}/);assert.match(FIREFLY_VERTEX,/time \* \.26/);
  assert.match(FIREFLY_FRAGMENT,/nearFade/);assert.match(FIREFLY_FRAGMENT,/fogFade/);
  assert.doesNotMatch(code,/pointLight|spotLight|Date\.now|requestAnimationFrame|setState|Math\.random/);
});
test('static geometry lifetimes are not coupled to leaf quality',()=>{
  const code=source('environment/WoodlandAccents.tsx');
  assert.match(code,/useMemo\(createMossStoneGeometry, \[\]\)/);assert.match(code,/useMemo\(createFallenBranchGeometry, \[\]\)/);
  for(const name of ['bark','leaves','stone','branch','fungi'])assert.match(code,new RegExp(`(?:${name}\\??\\.dispose\\(\\))`));
  assert.doesNotMatch(code,/Object\.values\(shapes\)/);
});

test('medium sky return is restrained and disabled for low/reduced-effects',async()=>{
  const {skyReturnStrength}=await import('../src/components/three/artDirection/lightingQuality.ts');
  assert.equal(skyReturnStrength('medium',false),.55);
  for(const q of ['high','cinematic'])assert.equal(skyReturnStrength(q,false),1);
  for(const q of ['unknown','low'])assert.equal(skyReturnStrength(q,false),0);
  for(const q of ['low','medium','high','cinematic','unknown'])assert.equal(skyReturnStrength(q,true),0);
});
test('lighting tier reaches the sole scene lighting owner',()=>{
  assert.match(source('artDirection/SceneLookDirector.tsx'),/<SceneLighting quality=\{quality\}/);
  const code=source('artDirection/SceneLighting.tsx');
  assert.match(code,/skyReturnStrength\(quality, presentation\.reducedEffects\)/);
  assert.match(code,/returnStrength > 0 && accent/);
  assert.match(code,/intensity=\{accent\.intensity \* returnStrength\} castShadow=\{false\}/);
});
test('low-detail sky bypasses cloud noise without adding a rendering pass',()=>{
  const code=source('artDirection/SceneAtmosphere.tsx');
  assert.match(code,/if \(structure > \.001\) \{\s*float veil=cloud/);
  assert.equal((code.match(/<shaderMaterial /g)||[]).length,1);
});
