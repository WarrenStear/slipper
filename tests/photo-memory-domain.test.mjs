import assert from 'node:assert/strict';
import test from 'node:test';
import {register}from 'node:module';
import {readFileSync,readdirSync}from 'node:fs';
import {createHash}from 'node:crypto';
register('./canonical-node-loader.mjs',import.meta.url);
const {entries,visuals}=await import('../src/data/slipperContent.ts');
const {getJourneySceneForEntry,journeyScenes}=await import('../src/data/journeyNarrative.ts');
const {resolvePhotoMemory,isLocalPhotograph,photoMemorySize}=await import('../src/photos/photoMemoryAdmission.ts');
const {createPhotoMemoryFrame}=await import('../src/photos/photoMemoryGeometry.ts');
const {PHOTO_MEMORY_TEXTURE_BUDGET}=await import('../src/photos/photoMemoryTextures.ts');
const {resolveFragmentTrace}=await import('../src/ui/reader/fragmentTracePresentation.ts');
const {SCENE_LOOKS}=await import('../src/components/three/artDirection/SceneLookRegistry.ts');
const target=entries.find(entry=>entry.id==='fragment-008'),scene=getJourneySceneForEntry(target.id);
const gate=changes=>({entryId:target.id,activeEntryId:target.id,sceneId:scene.id,witnessedEntryIds:[target.id],
 openingResolved:true,participating:true,foreground:true,overlayOpen:false,mode:'explore',quality:'high',reducedEffects:false,mobile:false,intent:'inspection',...changes});
const explicit={...target,linkedVisualId:target.engine3d.linkedVisualId};
const privateRegistry=new Proxy([],{get(){throw new Error('Asset registry touched before privacy/availability admission');}});
const trace=changes=>({entryId:target.id,sceneId:scene.id,witnessedEntryIds:[target.id],reducedMotion:false,reducedEffects:false,highContrast:false,mobile:false,readerTheme:'ambient',...changes});

test('all66 actual fallback photo relationships remain dormant and all canonical data/IDs/prose remain untouched',()=>{
 const before=JSON.stringify({entries,visuals});assert.equal(entries.length,66);assert.equal(visuals.length,34);
 for(const entry of entries){const actualScene=getJourneySceneForEntry(entry.id);assert.ok(actualScene);
  assert.equal(resolvePhotoMemory(gate({entryId:entry.id,activeEntryId:entry.id,sceneId:actualScene.id,witnessedEntryIds:[entry.id]}),entries,visuals),null,entry.id);
 }
 assert.equal(JSON.stringify({entries,visuals}),before);
});
test('witness, opening, mobile/reduced/quality/live scope and deliberate intent gates precede registry lookup',()=>{
 for(const changes of [{intent:null},{intent:'unknown'},{witnessedEntryIds:[]},{openingResolved:false},{sceneId:'broken-floor.confession'},
  {participating:false},{foreground:false},{overlayOpen:true},{mode:'read'},{mode:'map'},{mobile:true},{reducedEffects:true},{quality:'low'},{quality:'medium'},
  {entryId:'unknown'},{activeEntryId:'fragment-001'},{sceneId:'blue-moon.intimacy'}])
  assert.equal(resolvePhotoMemory(gate(changes),privateRegistry,privateRegistry),null,JSON.stringify(changes));
});
test('only an existing explicit link matching the compiled binding can admit its exact known local photograph',()=>{
 const expected=visuals.find(visual=>visual.id===explicit.linkedVisualId),view=resolvePhotoMemory(gate(),[explicit],visuals);
 assert.deepEqual(view,{entryId:target.id,visualId:expected.id,src:expected.src,orientation:expected.orientation,alt:expected.alt});assert.ok(Object.isFrozen(view));
 assert.equal(resolvePhotoMemory(gate(),[{...explicit,linkedVisualId:'visual-002'}],visuals),null);
 assert.equal(resolvePhotoMemory(gate(),[explicit],[]),null);
 for(const src of ['https://example.test/a.jpg','/visuals/../private.jpg','/visuals/%2e%2e.jpg','/visuals/x%2Fsecret.jpg','/visuals/forest-threshold.svg','/visuals/p.jpg?q=x','/visuals/p.jpg#secret','/textures/photo.jpg'])assert.equal(isLocalPhotograph(src),false,src);
 for(const mode of ['inspection','stillness'])assert.equal(resolvePhotoMemory(gate({intent:mode}),[explicit],visuals).visualId,expected.id);
 assert.equal(resolvePhotoMemory(gate(),[explicit],[{...expected,src:'/visuals/forest-threshold.svg'}]),null);
});
test('actual assets match the immutable34-photo inventory and stay within the explicit encoded/decoded budget',()=>{
 const inventory=JSON.parse(readFileSync(new URL('./fixtures/photo-memory/asset-inventory.json',import.meta.url),'utf8'));
 const files=readdirSync(new URL('../public/visuals/',import.meta.url)).filter(file=>file.endsWith('.jpg'));
 assert.equal(files.length,34);assert.equal(inventory.photos.length,34);assert.equal(inventory.explicitAuthoredEntryLinkCount,0);
 for(const photo of inventory.photos){const bytes=readFileSync(new URL('../public'+photo.path,import.meta.url));
  assert.equal(bytes.byteLength,photo.bytes);assert.equal(createHash('sha256').update(bytes).digest('hex'),photo.sha256);
  assert.ok(photo.bytes<=PHOTO_MEMORY_TEXTURE_BUDGET.maxBytes);assert.ok(photo.width<=PHOTO_MEMORY_TEXTURE_BUDGET.maxDimension);assert.ok(photo.height<=PHOTO_MEMORY_TEXTURE_BUDGET.maxDimension);
  assert.ok(photo.width*photo.height<=PHOTO_MEMORY_TEXTURE_BUDGET.maxPixels);
 }
});
test('photo fitting retains the source aspect inside original size bounds, with one finite joined48-triangle frame',()=>{
 for(const orientation of ['portrait','landscape','square'])for(const aspect of [.25,.6,1,1.5,4]){
  const size=photoMemorySize(orientation,aspect);assert.ok(Math.abs(size.width/size.height-aspect)<1e-10);assert.ok(size.width<=2.75&&size.height<=2.75);
  const geometry=createPhotoMemoryFrame(size.width,size.height);assert.equal(geometry.index.count/3,48);
  for(const name of ['position','normal','uv'])for(const value of geometry.getAttribute(name).array)assert.ok(Number.isFinite(value),name);
  assert.ok(geometry.boundingBox);assert.ok(geometry.boundingSphere.radius<2.5);geometry.dispose();
 }
 for(const dimensions of [[NaN,1],[1,Infinity],[0,1],[-1,2],[3,2]])assert.throws(()=>createPhotoMemoryFrame(...dimensions),RangeError);
});
test('all32 reader traces use only their actual canonical scene identity and authored palette, never a photograph, title or prose',()=>{
 const before=JSON.stringify({entries,visuals});for(const current of journeyScenes){const entryId=current.keystoneEntryId;
  const view=resolveFragmentTrace(trace({entryId,sceneId:current.id,witnessedEntryIds:[entryId]}));assert.ok(view,current.id);
  assert.equal(view.ground,SCENE_LOOKS[current.id].ground);assert.equal(view.light,SCENE_LOOKS[current.id].keyColor);assert.ok(Object.isFrozen(view));
  assert.deepEqual(Object.keys(view).sort(),['family','ground','light','motion']);assert.equal(JSON.stringify(view).includes('/visuals/'),false);
 }
 assert.equal(JSON.stringify({entries,visuals}),before);
});
test('reader privacy/stale identity/clean/reduced/highcontrast gates are immediate, and all preferences retain a static restrained identity',()=>{
 for(const changes of [{witnessedEntryIds:[]},{entryId:'unknown',witnessedEntryIds:['unknown']},{sceneId:'river.release-surrender'},
  {reducedEffects:true},{highContrast:true},{readerTheme:'clean'}])assert.equal(resolveFragmentTrace(trace(changes)),null);
 const river=journeyScenes.find(scene=>scene.id==='river.release-surrender');const input=trace({entryId:river.keystoneEntryId,sceneId:river.id,witnessedEntryIds:[river.keystoneEntryId]});
 assert.equal(resolveFragmentTrace(input).family,'river');assert.equal(resolveFragmentTrace(input).motion,false);
 for(const changes of [{mobile:true},{reducedMotion:true}]){const view=resolveFragmentTrace({...input,...changes});assert.equal(view.family,'river');assert.equal(view.motion,false);}
});
test('opaque reader foundation and capped authored trace keep a conservative text contrast margin without image filters or prose mutation',()=>{
 const css=readFileSync(new URL('../src/ui/reader/FragmentTrace.css',import.meta.url),'utf8');
 assert.ok(css.includes('pointer-events:none'));assert.ok(css.includes('opacity:.07'));assert.ok(css.includes('background:linear-gradient(180deg,#101415,#0a0e10)!important'));
 assert.equal(/url\(|backdrop-filter:(?!none)|filter:blur/i.test(css),false);
 const rgb=hex=>[1,3,5].map(offset=>parseInt(hex.slice(offset,offset+2),16)/255),mix=(base,top,alpha)=>base.map((value,index)=>value*(1-alpha)+top[index]*alpha);
 const luminance=color=>color.map(value=>value<=.04045?value/12.92:((value+.055)/1.055)**2.4).reduce((sum,value,index)=>sum+value*[.2126,.7152,.0722][index],0);
 for(const scene of journeyScenes){const background=mix(rgb('#101415'),rgb(SCENE_LOOKS[scene.id].keyColor),.1),text=mix(background,[1,.973,.91],.82);
  assert.ok((luminance(text)+.05)/(luminance(background)+.05)>=7,scene.id);
 }
});
