import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { HERO_ASSETS, approvedHeroAsset, productionHeroUrl } from '../src/components/three/actors/heroAssetRegistry.ts';
import { createAssetDecoderPool, createAssetOperationTracker, guardGltfParserLifetime } from '../src/lib/assets/assetDecoderPool.ts';
import { createHeroAssetRuntime, fetchHeroBytes } from '../src/lib/assets/heroAssetRuntime.ts';
import { validateHeroGlbBytes, validateHeroPresentation, disposeHeroSource, HERO_MAX_COMPRESSED_BYTES } from '../src/lib/assets/heroAssetValidation.ts';
import { cloneNpcPresentation, isPlaceholderNpcAsset } from '../src/lib/assets/npcAssetPolicy.ts';

// Synthetic unit fixtures are never copied into public/ or marked as shipping art.
const review = () => ({ provenance:'Synthetic test fixture only', licence:'Test fixture', reviewedBy:'Automated fixture test', reviewedAt:'2026-09-26T00:00:00Z', revision:'fixture-1', maxTriangles:5000, maxMaterials:3, maxTextures:2, maxTextureDimension:1024, bounds:{min:[-1,-.01,-1],max:[1,2,1]}, baseY:{value:0,tolerance:.01} });
const entry = () => ({status:'reviewed-production',url:'/art/heroes/test-only.glb',contract:'Test fixture only; metres',review:review()});
const tick = () => new Promise(resolve => queueMicrotask(resolve));
function glb(extra = {}) {
  const json={asset:{version:'2.0',generator:'Synthetic unit fixture'},scene:0,scenes:[{nodes:[0]}],nodes:[{mesh:0}],meshes:[{primitives:[{attributes:{POSITION:0}}]}],buffers:[{byteLength:36}],bufferViews:[{buffer:0,byteOffset:0,byteLength:36}],accessors:[{bufferView:0,componentType:5126,count:3,type:'VEC3',min:[-.2,0,0],max:[.2,.8,0]}],...extra};
  const encoded=new TextEncoder().encode(JSON.stringify(json));const padded=(encoded.length+3)&~3;
  const bytes=new ArrayBuffer(12+8+padded+8+36),v=new DataView(bytes),u=new Uint8Array(bytes);v.setUint32(0,0x46546c67,true);v.setUint32(4,2,true);v.setUint32(8,bytes.byteLength,true);v.setUint32(12,padded,true);v.setUint32(16,0x4e4f534a,true);u.fill(32,20,20+padded);u.set(encoded,20);v.setUint32(20+padded,36,true);v.setUint32(24+padded,0x004e4942,true);new Float32Array(bytes,28+padded).set([-.2,0,0,.2,0,0,0,.8,0]);return bytes;
}
function asset() {const scene=new THREE.Group();scene.add(new THREE.Mesh(new THREE.BoxGeometry(.4,.8,.4).translate(0,.4,0),new THREE.MeshStandardMaterial()));return{scene,scenes:[scene],cameras:[],animations:[],asset:{version:'2.0'}};}

test('all shipping heroes remain fallback; review admission rejects malformed metadata and path escapes',()=>{
  assert.equal(Object.keys(HERO_ASSETS).length,13);Object.values(HERO_ASSETS).forEach(a=>assert.equal(productionHeroUrl(a),null));
  assert.equal(productionHeroUrl(entry()),entry().url);
  for(const value of [null,undefined,[],{},42,{...entry(),review:null},{...entry(),status:'authored-fallback'}])assert.equal(approvedHeroAsset(value),null);
  for(const url of ['/models/wolf.glb','https://example.org/a.glb','//example.org/art/heroes/a.glb','/art/heroes/../x.glb','/art/heroes/%2e%2e/x.glb','/art/heroes/x.glb?foo','/art/heroes/x.glb#foo','/art/heroes/x\\y.glb','/art/heroes/a.svg'])assert.equal(productionHeroUrl({...entry(),url}),null,url);
  for(const patch of [{provenance:''},{licence:''},{reviewedBy:''},{revision:''},{reviewedAt:'not-a-date'},{reviewedAt:'2026-02-30T00:00:00Z'},{maxTriangles:NaN},{maxMaterials:0},{maxTextures:33},{maxTextureDimension:4096},{bounds:null},{bounds:{min:[0,0],max:[1,1,1]}},{bounds:{min:[0,0,0],max:[Infinity,1,1]}},{baseY:{value:0,tolerance:10}},{allowSceneLights:'yes'}])assert.equal(approvedHeroAsset({...entry(),review:{...review(),...patch}}),null,JSON.stringify(patch));
});

test('self-contained uncompressed GLB parses with the actual Three loader and retains a valid low-poly model',async()=>{
  const bytes=glb();validateHeroGlbBytes(bytes,review());
  const parsed=await new GLTFLoader().parseAsync(bytes,'');const metrics=validateHeroPresentation(parsed,'wolf',review());
  assert.equal(metrics.triangles,1);assert.equal(metrics.meshes,1);assert.equal(isPlaceholderNpcAsset(parsed),false);disposeHeroSource(parsed);
});

test('GLB preflight rejects invalid containers, external dependencies and explicit placeholders before parse',()=>{
  for(const bytes of [new ArrayBuffer(0),new ArrayBuffer(24),glb().slice(0,-4)])assert.throws(()=>validateHeroGlbBytes(bytes,review()));
  for(const extra of [{buffers:[{uri:'https://host/x.bin'}]},{images:[{uri:'/art/x.png'}]},{images:[{uri:'data:image/png;base64,AA=='}]},{asset:{version:'2.0',generator:'SIDTW placeholder prop generator'}},{nodes:[{extras:{sidtwPlaceholder:true}}]},{cameras:[{type:'perspective'}]},{extensions:{KHR_lights_punctual:{lights:[{type:'point'}]}}}])assert.throws(()=>validateHeroGlbBytes(glb(extra),review()));
  assert.doesNotThrow(()=>validateHeroGlbBytes(glb({extensions:{KHR_lights_punctual:{lights:[{type:'point'}]}}}),{...review(),allowSceneLights:true}));
});

test('runtime rejects non-finite, empty, excessive or mis-scaled geometry and misplaced origin',()=>{
  const mutate=[a=>a.scene.clear(),a=>a.scene.children[0].geometry.getAttribute('position').setX(0,NaN),a=>a.scene.scale.setScalar(1000),a=>a.scene.position.y=1,a=>a.scene.children[0].geometry.setIndex([0,1,999]),a=>a.scene.children[0].geometry.setIndex([0,1]),a=>a.scene.children[0].material.roughness=NaN];
  for(const change of mutate){const a=asset();change(a);assert.throws(()=>validateHeroPresentation(a,'wolf',review()));disposeHeroSource(a);}
  const a=asset();assert.throws(()=>validateHeroPresentation(a,'wolf',{...review(),maxTriangles:1}));assert.throws(()=>validateHeroPresentation(a,'master-lantern',review()));disposeHeroSource(a);
});

test('cameras/lights/placeholders are rejected, with an explicit light exception never applying to lanterns',()=>{
  for(const extra of [new THREE.PerspectiveCamera(),new THREE.PointLight(),Object.assign(new THREE.Group(),{userData:{placeholder:true}})]) {const a=asset();a.scene.add(extra);assert.throws(()=>validateHeroPresentation(a,'wolf',review()));disposeHeroSource(a);}
  const a=asset();a.scene.add(new THREE.PointLight());assert.doesNotThrow(()=>validateHeroPresentation(a,'wolf',{...review(),allowSceneLights:true}));assert.throws(()=>validateHeroPresentation(a,'master-lantern',{...review(),allowSceneLights:true}));disposeHeroSource(a);
});

test('texture channels require matching UVs and bounded dimensions, and key glow is forbidden',()=>{
  const a=asset(),mesh=a.scene.children[0],texture=new THREE.DataTexture(new Uint8Array(16),2,2);mesh.material.map=texture;
  assert.equal(validateHeroPresentation(a,'wolf',review()).textures,1);
  texture.channel=1;assert.throws(()=>validateHeroPresentation(a,'wolf',review()),/missing uv1/);
  texture.channel=0;texture.image.width=2048;assert.throws(()=>validateHeroPresentation(a,'wolf',review()),/dimensions/);
  mesh.material.map=null;mesh.material.emissive.set('red');assert.throws(()=>validateHeroPresentation(a,'key',review()),/glow/);disposeHeroSource(a);texture.dispose();
});

test('missing referenced image maps reject a resolved GLTF while unreferenced material extras are ignored',()=>{
  const a=asset(),material=a.scene.children[0].material;
  a.parser={json:{materials:[{pbrMetallicRoughness:{baseColorTexture:{index:0}}},{normalTexture:{index:1}}]},associations:new Map([[material,{materials:0}]])};
  assert.throws(()=>validateHeroPresentation(a,'wolf',review()),/required material texture failed/);
  material.map=new THREE.DataTexture(new Uint8Array(16),2,2);
  assert.doesNotThrow(()=>validateHeroPresentation(a,'wolf',review()));
  a.parser.json.materials[0].extensions={KHR_materials_clearcoat:{clearcoatNormalTexture:{index:2}}};
  assert.throws(()=>validateHeroPresentation(a,'wolf',review()),/clearcoatNormalMap/);disposeHeroSource(a);
});

test('instances isolate skeleton bones/inverses and materials, while their disposal leaves cached resources alive',()=>{
  const a=asset(),old=a.scene.children[0];a.scene.remove(old);
  const geometry=old.geometry,material=old.material,count=geometry.attributes.position.count;
  geometry.setAttribute('skinIndex',new THREE.Uint16BufferAttribute(new Uint16Array(count*4),4));const weights=new Float32Array(count*4);for(let i=0;i<count;i++)weights[i*4]=1;geometry.setAttribute('skinWeight',new THREE.Float32BufferAttribute(weights,4));
  const mesh=new THREE.SkinnedMesh(geometry,material),bone=new THREE.Bone();mesh.add(bone);mesh.bind(new THREE.Skeleton([bone]));a.scene.add(mesh);
  const first=cloneNpcPresentation(a.scene,.5),second=cloneNpcPresentation(a.scene),x=first.scene.children[0],y=second.scene.children[0];
  x.skeleton.bones[0].position.y=3;x.skeleton.boneInverses[0].elements[0]=4;
  assert.equal(y.skeleton.bones[0].position.y,0);assert.equal(mesh.skeleton.bones[0].position.y,0);assert.equal(y.skeleton.boneInverses[0].elements[0],1);assert.equal(mesh.skeleton.boneInverses[0].elements[0],1);
  let sourceDisposals=0,instanceDisposals=0;geometry.addEventListener('dispose',()=>sourceDisposals++);material.addEventListener('dispose',()=>sourceDisposals++);x.material.addEventListener('dispose',()=>instanceDisposals++);
  first.dispose();first.dispose();assert.equal(instanceDisposals,1);assert.equal(sourceDisposals,0);second.dispose();disposeHeroSource(a);assert.equal(sourceDisposals,2);
});

test('decoder pool isolates renderers, shares a renderer, survives StrictMode and releases idempotently',async()=>{
  let creates=0,disposes=0;const acquire=createAssetDecoderPool(()=>{creates++;return{gltf:{},ktx2:{},dispose(){disposes++;}};}),r1={},r2={};
  const a=acquire(r1),b=acquire(r1),c=acquire(r2);assert.equal(creates,2);assert.equal(a.ktx2,b.ktx2);assert.notEqual(a.ktx2,c.ktx2);
  a.release();b.release();const replay=acquire(r1);await tick();assert.equal(disposes,0);replay.release();replay.release();c.release();await tick();assert.equal(disposes,2);
});

function runtimeFixture(parse = async()=>asset()) {
  let loads=0,releases=0,disposals=0,acquisitions=0;
  const acquire=createHeroAssetRuntime({decoders:()=>{acquisitions++;return{gltf:{parseAsync:parse},release(){releases++;}};},fetchBytes:async()=>{loads++;return glb();},dispose:a=>{disposals++;disposeHeroSource(a);}});
  return {acquire,counts:()=>({loads,releases,disposals,acquisitions})};
}
test('hero cache coalesces simultaneous consumers but disposes source only after the last lease',async()=>{
  const f=runtimeFixture(),renderer={},a=f.acquire(renderer,'wolf',entry()),b=f.acquire(renderer,'wolf',entry());assert.equal(a.pending,b.pending);await a.pending;
  a.release();await tick();assert.deepEqual(f.counts(),{loads:1,releases:0,disposals:0,acquisitions:1});b.release();b.release();await tick();await tick();assert.deepEqual(f.counts(),{loads:1,releases:1,disposals:1,acquisitions:1});
});
test('StrictMode replay reuses pending hero source; last departure waits for non-abortable parse before decoder disposal',async()=>{
  let resolve;const f=runtimeFixture(()=>new Promise(r=>resolve=r)),renderer={},a=f.acquire(renderer,'wolf',entry());await tick();
  a.release();const b=f.acquire(renderer,'wolf',entry());assert.equal(a.pending,b.pending);await tick();b.release();await tick();assert.equal(f.counts().releases,0);resolve(asset());await b.pending;await tick();await tick();assert.equal(f.counts().disposals,1);assert.equal(f.counts().releases,1);
});
test('rejected model disposes its parsed resources and releases decoder lease without adopting presentation',async()=>{
  const f=runtimeFixture(async()=>{const a=asset();a.scene.add(new THREE.PointLight());return a;}),lease=f.acquire({},'wolf',entry());await assert.rejects(lease.pending,/light/);lease.release();await tick();await tick();assert.equal(f.counts().disposals,1);assert.equal(f.counts().releases,1);
});
test('parse failure and renderer/revision changes have independent cache generations',async()=>{
  const f=runtimeFixture(async()=>{throw Error('invalid Draco payload');}),r={},a=f.acquire(r,'wolf',entry()),b=f.acquire({},'wolf',entry()),c=f.acquire(r,'wolf',{...entry(),review:{...review(),revision:'fixture-2'}});
  await Promise.all([a,b,c].map(x=>assert.rejects(x.pending,/invalid Draco/)));[a,b,c].forEach(x=>x.release());await tick();await tick();assert.equal(f.counts().loads,3);assert.equal(f.counts().releases,3);assert.equal(f.counts().disposals,0);
});
test('bounded hero fetch rejects 404, oversize headers/streams and cancels a stalled body on abort',async()=>{
  const signal=new AbortController().signal;await assert.rejects(fetchHeroBytes('/art/heroes/x.glb',signal,async(url,options)=>{assert.equal(options.redirect,'error');assert.equal(options.credentials,'same-origin');return new Response('',{status:404});}),/404/);
  await assert.rejects(fetchHeroBytes('/art/heroes/x.glb',signal,async()=>new Response('',{headers:{'content-length':String(HERO_MAX_COMPRESSED_BYTES+1)}})),/budget/);
  await assert.rejects(fetchHeroBytes('/art/heroes/x.glb',signal,async()=>new Response(new Uint8Array(HERO_MAX_COMPRESSED_BYTES+1))),/budget/);
  let cancelled=false;const controller=new AbortController(),body=new ReadableStream({cancel(){cancelled=true;}});const pending=fetchHeroBytes('/art/heroes/x.glb',controller.signal,async()=>new Response(body));await tick();controller.abort();await assert.rejects(pending,/aborted/);assert.equal(cancelled,true);
});
test('hero slot uses effect-owned presentation without animation, collision or story controllers',()=>{
  const slot=readFileSync(new URL('../src/components/three/actors/HeroAssetSlot.tsx',import.meta.url),'utf8');assert.match(slot,/useHeroPresentation\(id\)/);assert.match(slot,/: <>{children}<\/>/);assert.match(slot,/dispose={null}/);assert.doesNotMatch(slot,/AnimationMixer|useAnimations|RigidBody|dispatchStoryEvent|useJourneyStore/);
});


test('hero request deadline aborts stalled network and immediately releases its decoder lease',async t=>{
  t.mock.timers.enable({apis:['setTimeout']});
  let released=0,aborted=false;
  const acquire=createHeroAssetRuntime({decoders:()=>({gltf:{},release(){released++;}}),fetchBytes:async(url,signal)=>new Promise((resolve,reject)=>signal.addEventListener('abort',()=>{aborted=true;reject(Error('request aborted'));},{once:true})),dispose(){assert.fail('No parsed source exists');}});
  const lease=acquire({},'wolf',entry());const rejected=assert.rejects(lease.pending,/aborted/);
  t.mock.timers.tick(15000);await rejected;assert.equal(aborted,true);assert.equal(released,1);lease.release();await tick();await tick();assert.equal(released,1);
});
test('hero cache aborts abandoned network work and retries a fresh generation on the next mount',async()=>{
  let requested=0,aborted=0,released=0;
  const acquire=createHeroAssetRuntime({decoders:()=>({gltf:{parseAsync:async()=>asset()},release(){released++;}}),fetchBytes:async(url,signal)=>{requested++;if(requested>1)return glb();return new Promise((resolve,reject)=>signal.addEventListener('abort',()=>{aborted++;reject(Error('abandoned'));},{once:true}));},dispose:disposeHeroSource});
  const renderer={},first=acquire(renderer,'wolf',entry());const rejected=assert.rejects(first.pending,/abandoned/);first.release();await tick();await rejected;const next=acquire(renderer,'wolf',entry());await next.pending;next.release();await tick();await tick();assert.equal(requested,2);assert.equal(aborted,1);assert.equal(released,2);
});


test('hero admission rejects alternate scenes and non-triangle primitives but preserves strip/fan support',async()=>{
  for(const mode of [0,1,2,3])assert.throws(()=>validateHeroGlbBytes(glb({meshes:[{primitives:[{attributes:{POSITION:0}},{attributes:{POSITION:0},mode}]}]}),review()),/must be triangles/);
  assert.throws(()=>validateHeroGlbBytes(glb({scenes:[{nodes:[0]},{nodes:[0]}]}),review()),/exactly one scene/);
  for(const mode of [4,5,6]){
    const bytes=glb({meshes:[{primitives:[{attributes:{POSITION:0},mode}]}]});validateHeroGlbBytes(bytes,review());
    const parsed=await new GLTFLoader().parseAsync(bytes,'');assert.equal(validateHeroPresentation(parsed,'wolf',review()).triangles,1);disposeHeroSource(parsed);
  }
});
test('defensive validation and disposal cover rejected point/line resources and alternate scenes',()=>{
  for(const extra of [new THREE.Points(new THREE.BufferGeometry().setAttribute('position',new THREE.Float32BufferAttribute([0,0,0],3)),new THREE.PointsMaterial()),new THREE.LineSegments(new THREE.BufferGeometry().setAttribute('position',new THREE.Float32BufferAttribute([0,0,0,1,1,1],3)),new THREE.LineBasicMaterial())]){
    const a=asset();a.scene.add(extra);const texture=new THREE.Texture();extra.material.map=texture;
    let disposed=0;[extra.geometry,extra.material,texture].forEach(value=>value.addEventListener('dispose',()=>disposed++));
    assert.throws(()=>validateHeroPresentation(a,'wolf',review()),/non-mesh/);disposeHeroSource(a);assert.equal(disposed,3);
  }
  const a=asset(),other=asset().scene;a.scenes.push(other);let disposed=0;other.children[0].geometry.addEventListener('dispose',()=>disposed++);
  assert.throws(()=>validateHeroPresentation(a,'wolf',review()),/exactly one scene/);disposeHeroSource(a);assert.equal(disposed,1);
});
test('actual GLTF early failure waits for a pending sibling and disposes partial decoded resources before decoder teardown',async()=>{
  let resolveMaterial,siblingStarted=false,disposedMaterial=0,disposedGeometry=0,releases=0,settled=false;
  const material=new THREE.MeshStandardMaterial();material.addEventListener('dispose',()=>disposedMaterial++);
  const loader=new GLTFLoader().register(parser=>{
    guardGltfParserLifetime(parser);
    const load=parser.loadGeometries.bind(parser);
    parser.loadGeometries=primitives=>load(primitives).then(geometries=>{for(const geometry of new Set(geometries))geometry.addEventListener('dispose',()=>disposedGeometry++);return geometries;});
    return{name:'TEST_ONLY_early_failure',loadMaterial(index){if(index===0)return Promise.reject(Error('first material failed'));siblingStarted=true;return new Promise(resolve=>resolveMaterial=resolve);}};
  });
  const bytes=glb({materials:[{},{}],meshes:[{primitives:[{attributes:{POSITION:0},material:0},{attributes:{POSITION:0},material:1}]}]});
  const acquire=createHeroAssetRuntime({decoders:()=>({gltf:loader,release(){releases++;}}),fetchBytes:async()=>bytes,dispose:disposeHeroSource});
  const lease=acquire({},'wolf',entry());const rejected=assert.rejects(lease.pending.finally(()=>settled=true),/first material failed/);
  for(let i=0;i<64&&!siblingStarted;i++)await tick();assert.equal(siblingStarted,true);
  lease.release();await tick();await tick();assert.equal(settled,false);assert.equal(releases,0);
  resolveMaterial(material);await rejected;await tick();await tick();
  assert.equal(disposedMaterial,1);assert.equal(disposedGeometry,1);assert.equal(releases,1);
});
test('shared decoder teardown waits for direct operations and permits another consumer while draining',async()=>{
  let finishFirst,finishSecond,disposed=0;const work=createAssetOperationTracker();
  const acquire=createAssetDecoderPool(()=>({gltf:{},ktx2:{},whenIdle:work.whenIdle,dispose(){disposed++;}}));
  const renderer={},first=acquire(renderer);work.track(new Promise(resolve=>finishFirst=resolve));first.release();await tick();assert.equal(disposed,0);
  const second=acquire(renderer);finishFirst();await tick();await tick();assert.equal(disposed,0);
  work.track(new Promise(resolve=>finishSecond=resolve));second.release();await tick();assert.equal(disposed,0);finishSecond();
  for(let i=0;i<8;i++)await tick();assert.equal(disposed,1);
});
