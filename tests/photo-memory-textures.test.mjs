import assert from 'node:assert/strict';
import test from 'node:test';
import {register}from 'node:module';
import *as THREE from 'three';
register('./canonical-node-loader.mjs',import.meta.url);
const {createPhotoMemoryTexturePool,loadPhotoMemoryTexture,PHOTO_MEMORY_TEXTURE_BUDGET}=await import('../src/photos/photoMemoryTextures.ts');
const deferred=()=>{let resolve,reject;const promise=new Promise((yes,no)=>{resolve=yes;reject=no;});return{promise,resolve,reject};};
const flush=async()=>{for(let i=0;i<8;i++)await Promise.resolve();};
function resource(width=640,height=800){let disposed=0;return{texture:new THREE.Texture(),width,height,dispose(){disposed++;},get disposed(){return disposed;}};}
const src='/visuals/existing.jpg';
test('rejected HTTP, redirects, announced size, MIME and unavailable decoder cancel unread bodies without decoding',async()=>{
 const priorFetch=globalThis.fetch,priorBitmap=globalThis.createImageBitmap;
 try{
  for(const reason of ['http','redirect','size','mime','decoder']){
   let cancelled=0,decoded=0,options;
   const response=new Response(new ReadableStream({cancel(){cancelled++;}}),{status:reason==='http'?404:200,
    headers:{'content-type':reason==='mime'?'text/html':'image/jpeg','content-length':String(reason==='size'?PHOTO_MEMORY_TEXTURE_BUDGET.maxBytes+1:20)}});
   if(reason==='redirect')Object.defineProperty(response,'redirected',{value:true});
   globalThis.fetch=async(_url,init)=>{options=init;return response;};
   globalThis.createImageBitmap=reason==='decoder'?undefined:async()=>{decoded++;throw Error('Rejected body decoded');};
   assert.equal(await loadPhotoMemoryTexture(src,new AbortController().signal),null,reason);
   assert.equal(cancelled,1,reason);assert.equal(decoded,0,reason);
   assert.equal(options.mode,'same-origin');assert.equal(options.redirect,'error');
  }
 }finally{globalThis.fetch=priorFetch;globalThis.createImageBitmap=priorBitmap;}
});
test('one shared source request is borrowed by concurrent consumers and disposed exactly once by the last owner',async()=>{
 const pending=deferred(),calls=[];const pool=createPhotoMemoryTexturePool((url,signal)=>{calls.push({url,signal});return pending.promise;});
 const first=pool.acquire(src),second=pool.acquire(src);await flush();assert.equal(calls.length,1);assert.deepEqual(pool.inspect(),{ownedSources:1,inFlight:1,consumers:2});
 const photo=resource();pending.resolve(photo);assert.equal(await first.promise,photo);assert.equal(await second.promise,photo);await flush();
 first.release();first.release();assert.equal(photo.disposed,0);second.release();second.release();assert.equal(photo.disposed,1);assert.equal(calls[0].signal.aborted,true);
 assert.deepEqual(pool.inspect(),{ownedSources:0,inFlight:0,consumers:0});
});
test('release aborts pending work, rejects late decoded ownership and bounds URL replacements to a single concurrent load',async()=>{
 const tasks=[],pool=createPhotoMemoryTexturePool((url,signal)=>{const task={url,signal,...deferred()};tasks.push(task);return task.promise;});
 const old=pool.acquire(src);await flush();old.release();assert.equal(tasks[0].signal.aborted,true);
 const current=pool.acquire('/visuals/current.jpg'),rejected=pool.acquire('/visuals/third.jpg');assert.equal(await rejected.promise,null);await flush();assert.equal(tasks.length,1);
 const abandoned=resource();tasks[0].resolve(abandoned);assert.equal(await old.promise,null);await flush();assert.equal(abandoned.disposed,1);assert.equal(tasks.length,2);assert.equal(pool.inspect().inFlight,1);
 const live=resource();tasks[1].resolve(live);assert.equal(await current.promise,live);await flush();current.release();assert.equal(live.disposed,1);assert.equal(pool.inspect().ownedSources,0);
});
test('oversized/invalid sources, decode failure and queued cancellation never leave an owned texture or blocked queue',async()=>{
 const tasks=[],pool=createPhotoMemoryTexturePool((url,signal)=>{const task={url,signal,...deferred()};tasks.push(task);return task.promise;});
 const invalid=pool.acquire('https://bad.test/p.jpg');assert.equal(await invalid.promise,null);assert.equal(tasks.length,0);
 const first=pool.acquire(src);await flush();const oversized=resource(1281,2);tasks[0].resolve(oversized);assert.equal(await first.promise,null);await flush();assert.equal(oversized.disposed,1);first.release();
 const second=pool.acquire(src);await flush();tasks[1].reject(new Error('decode unavailable'));assert.equal(await second.promise,null);await flush();second.release();
 const old=pool.acquire(src);await flush();old.release();const queued=pool.acquire('/visuals/queued.jpg');queued.release();assert.equal(await queued.promise,null);tasks[2].resolve(null);await old.promise;await flush();assert.equal(tasks.length,3);
 assert.deepEqual(pool.inspect(),{ownedSources:0,inFlight:0,consumers:0});
});
test('a throwing presentation disposal listener cannot strand the replacement queue',async()=>{
 const pending=deferred(),pool=createPhotoMemoryTexturePool(()=>pending.promise);const owned=pool.acquire(src);await flush();owned.release();
 pending.resolve({texture:new THREE.Texture(),width:10,height:10,dispose(){throw Error('disposed observer');}});assert.equal(await owned.promise,null);await flush();assert.equal(pool.inspect().inFlight,0);
});
test('actual loader caps encoded streaming bytes before decode, rejects nonimages, and closes aborted/oversized decoded bitmaps',async()=>{
 const previous={fetch:globalThis.fetch,createImageBitmap:globalThis.createImageBitmap};let decodes=0,closed=0;
 try{
  globalThis.createImageBitmap=async()=>{decodes++;return{width:853,height:1280,close(){closed++;}};};
  globalThis.fetch=async()=>new Response(new Uint8Array(PHOTO_MEMORY_TEXTURE_BUDGET.maxBytes+1),{headers:{'content-type':'image/jpeg'}});
  assert.equal(await loadPhotoMemoryTexture(src,new AbortController().signal),null);assert.equal(decodes,0);
  globalThis.fetch=async()=>new Response('notimage',{headers:{'content-type':'text/html'}});assert.equal(await loadPhotoMemoryTexture(src,new AbortController().signal),null);assert.equal(decodes,0);
  const controller=new AbortController();globalThis.fetch=async()=>new Response(new Uint8Array(3),{headers:{'content-type':'image/jpeg'}});
  globalThis.createImageBitmap=async()=>{decodes++;controller.abort();return{width:853,height:1280,close(){closed++;}};};
  assert.equal(await loadPhotoMemoryTexture(src,controller.signal),null);assert.equal(closed,1);
  globalThis.createImageBitmap=async()=>{decodes++;return{width:1281,height:2,close(){closed++;}};};
  assert.equal(await loadPhotoMemoryTexture(src,new AbortController().signal),null);assert.equal(closed,2);
 }finally{Object.assign(globalThis,previous);}
});
test('actual loader configures owned sRGB/clamped nonmipmapped texture and releases GPU/bitmap exactly once',async()=>{
 const previous={fetch:globalThis.fetch,createImageBitmap:globalThis.createImageBitmap};let closed=0,disposed=0;
 try{globalThis.fetch=async()=>new Response(new Uint8Array(3),{headers:{'content-type':'image/jpeg','content-length':'3'}});
  let decodeOptions;globalThis.createImageBitmap=async(_blob,options)=>{decodeOptions=options;return{width:853,height:1280,close(){closed++;}};};
  const photo=await loadPhotoMemoryTexture(src,new AbortController().signal);assert.ok(photo);assert.equal(photo.texture.colorSpace,THREE.SRGBColorSpace);
  assert.equal(photo.texture.wrapS,THREE.ClampToEdgeWrapping);assert.equal(photo.texture.wrapT,THREE.ClampToEdgeWrapping);assert.equal(photo.texture.generateMipmaps,false);
  assert.equal(photo.texture.flipY,false);assert.deepEqual(decodeOptions,{imageOrientation:'flipY',premultiplyAlpha:'none',colorSpaceConversion:'none'});
  assert.equal(photo.texture.minFilter,THREE.LinearFilter);photo.texture.addEventListener('dispose',()=>disposed++);photo.dispose();photo.dispose();assert.equal(disposed,1);assert.equal(closed,1);
 }finally{Object.assign(globalThis,previous);}
});
