import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import * as THREE from 'three';
import { createWornTimberGeometry, createWeatheredPanelGeometry, createTaperedBranchGeometry, createWaxCandleGeometry, createFlameGeometry } from '../src/components/three/environmentArt/authoredGeometry.ts';
import { createBotanicalGeometries } from '../src/components/three/environmentArt/botanicalGeometry.ts';
import { createWolfGeometries, createSwanGeometries, createPhantomGeometries } from '../src/components/three/environmentArt/npcGeometry.ts';
import { createChairGeometry, createNestGeometries, createSeedGeometry } from '../src/components/three/environmentArt/heroGeometry.ts';
import { cloneNpcPresentation, isPlaceholderNpcAsset } from '../src/lib/assets/npcAssetPolicy.ts';

const triangles = g => (g.index?.count ?? g.getAttribute('position').count) / 3;
function valid(g) {
  const p = g.getAttribute('position');
  for (const name of ['position','normal','uv']) assert.ok([...g.getAttribute(name).array].every(Number.isFinite), name);
  assert.equal(g.getAttribute('normal').count,p.count); assert.equal(g.getAttribute('uv').count,p.count);
  if(g.index) assert.ok([...g.index.array].every(i=>i>=0&&i<p.count));
  g.computeBoundingBox(); assert.ok(!g.boundingBox.isEmpty());
}
function signedVolume(g) {
  const p=g.getAttribute('position'),index=g.index?.array??Array.from({length:p.count},(_,i)=>i);
  let volume=0;const a=new THREE.Vector3(),b=new THREE.Vector3(),c=new THREE.Vector3();
  for(let i=0;i<index.length;i+=3) {a.fromBufferAttribute(p,index[i]);b.fromBufferAttribute(p,index[i+1]);c.fromBufferAttribute(p,index[i+2]);volume+=a.dot(b.cross(c))/6;}
  return volume;
}

test('worn timber and plaster stay inside all requested architectural bounds with outward faces',()=>{
  for(const builder of [createWornTimberGeometry,createWeatheredPanelGeometry]) for(const size of [[4,.12,1],[.2,3,.15],[.3,.2,5]]) for(const seed of [0,8,37]) {
    const g=builder(size,seed);valid(g);assert.equal(triangles(g),60);assert.ok(signedVolume(g)>0);
    const p=g.getAttribute('position');for(let i=0;i<p.count;i++) for(let axis=0;axis<3;axis++) assert.ok(Math.abs(p.array[i*3+axis])<=size[axis]/2+1e-6);
    assert.deepEqual(g.getAttribute('position').array,builder(size,seed).getAttribute('position').array);
    g.dispose();
  }
});
test('swept branches and melted wax have finite normals and outward winding',()=>{
  for(const g of [createTaperedBranchGeometry([[0,0,0],[.2,.6,.1],[.12,1,0]],.04,7),createWaxCandleGeometry(),createFlameGeometry()]) {
    valid(g); assert.ok(signedVolume(g)>0); assert.ok(triangles(g)<400);g.dispose();
  }
});
test('botanical material batches are deterministic and retain the complete low-tier silhouette',()=>{
  for(const kind of ['rose','lily','reeds']) {
    const low=createBotanicalGeometries(kind,5,'base'),high=createBotanicalGeometries(kind,5,'relief'),repeat=createBotanicalGeometries(kind,5,'base');
    assert.equal(Object.keys(low).length,3);
    let lowTriangles=0,highTriangles=0;
    for(const name of Object.keys(low)) {
      if(low[name].getAttribute('position').count)valid(low[name]);
      assert.deepEqual(low[name].getAttribute('position').array,repeat[name].getAttribute('position').array);
      lowTriangles+=triangles(low[name]);highTriangles+=triangles(high[name]);
      low[name].dispose(); high[name].dispose();repeat[name].dispose();
    }
    assert.ok(lowTriangles>250&&lowTriangles<800);assert.ok(highTriangles>lowTriangles&&highTriangles<1200);
  }
});
test('authored creatures have tier-bounded geometry and preserve grounded +Z-facing anatomy',()=>{
  for(const [name,build,budget] of [['wolf',d=>createWolfGeometries(false,d),3400],['swan',createSwanGeometries,1800],['phantom',createPhantomGeometries,650]]) {
    let last=0;
    for(const detail of ['base','relief']) {
      const shapes=build(detail), box=new THREE.Box3();let count=0;
      for(const g of Object.values(shapes)) {if(g.getAttribute('position').count){valid(g);box.union(g.boundingBox);}count+=triangles(g);g.dispose();}
      assert.ok(count>last&&count<budget,name);last=count;
      assert.ok(box.min.y>=-.01&&box.max.y<=2.35,name);assert.ok(box.max.x-box.min.x<1.2,name);
      if(name==='wolf'||name==='swan')assert.ok(box.max.z>1.05,name+' muzzle/beak');
    }
  }
  const rest=createWolfGeometries(true);rest.body.computeBoundingBox();assert.ok(rest.body.boundingBox.max.y<1.02);
});
test('chair, horizontal woven nest and seed retain interaction-scale bounds',()=>{
  const chair=createChairGeometry();valid(chair);assert.ok(triangles(chair)<1600);assert.ok(chair.boundingBox.min.y>=-.01);assert.ok(chair.boundingBox.max.y<1.3);
  for(const g of Object.values(createNestGeometries())) {valid(g);assert.ok(g.boundingBox.max.y<.2);assert.ok(Math.max(Math.abs(g.boundingBox.min.x),Math.abs(g.boundingBox.max.x))<.5);}
  const seed=createSeedGeometry();valid(seed);assert.ok(seed.boundingBox.max.y<=.151);
});
test('placeholder detection uses provenance rather than rejecting low-poly authored work',()=>{
  const scene=new THREE.Group();scene.add(new THREE.Mesh(new THREE.BoxGeometry(),new THREE.MeshStandardMaterial()));
  assert.equal(isPlaceholderNpcAsset({scene}),false);
  assert.equal(isPlaceholderNpcAsset({scene,asset:{generator:'SIDTW placeholder NPC generator'}}),true);
  assert.equal(isPlaceholderNpcAsset({scene,asset:{generator:'Artist export'}}),false);
  scene.userData.sidtwPlaceholder=true;assert.equal(isPlaceholderNpcAsset({scene}),true);
});
test('NPC instances own materials without changing source alpha or disposing cached resources',()=>{
  const scene=new THREE.Group(),geometry=new THREE.BoxGeometry(),material=new THREE.MeshStandardMaterial({opacity:.7,transparent:true,depthWrite:false});
  scene.add(new THREE.Mesh(geometry,material),new THREE.Mesh(geometry,material));
  const first=cloneNpcPresentation(scene,.5),second=cloneNpcPresentation(scene,1);
  assert.equal(first.scene.children[0].material.opacity,.35);assert.equal(second.scene.children[0].material.opacity,.7);
  assert.equal(material.opacity,.7);assert.equal(first.scene.children[0].material,first.scene.children[1].material);
  assert.notEqual(first.scene.children[0].material,second.scene.children[0].material);assert.equal(first.scene.children[0].geometry,geometry);
  let owned=0,cached=0;first.scene.children[0].material.addEventListener('dispose',()=>owned++);material.addEventListener('dispose',()=>cached++);geometry.addEventListener('dispose',()=>cached++);
  first.dispose();assert.equal(owned,1);assert.equal(cached,0);second.dispose();material.dispose();geometry.dispose();
});
test('art modules cannot write story progress, run timers, or allocate per frame',()=>{
  for(const name of ['authoredGeometry.ts','botanicalGeometry.ts','npcGeometry.ts','heroGeometry.ts','EnvironmentArt.tsx','HeroObjects.tsx','AuthoredNpc.tsx']) {
    const source=fs.readFileSync(new URL('../src/components/three/environmentArt/'+name,import.meta.url),'utf8');
    assert.doesNotMatch(source,/useJourneyStore|dispatchStoryEvent|localStorage|useFrame|Math\.random|Date\.now/);
  }
});
