import { observeMaterialFetches } from './fixtures/material-receivers/observe-material-fetches.mjs';
// Native review of actual construction/material owners. External generated asset audition only.
import {chromium} from '@playwright/test';
import {mkdtemp,mkdir,symlink,writeFile,readFile,copyFile,rm} from 'node:fs/promises';
import {execFileSync,spawn} from 'node:child_process';
import {resolve,join} from 'node:path';
import {tmpdir} from 'node:os';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {RepeatWrapping,SRGBColorSpace} from 'three';
const root=process.cwd(),repo=resolve(process.env.REVIEW_ROOT||root),before=process.env.REVIEW_BEFORE&&resolve(process.env.REVIEW_BEFORE);
const out=resolve(process.env.REVIEW_OUT||join(tmpdir(),'slipper-material-receivers'));
const asset=process.env.REVIEW_PLASTER_ASSET&&resolve(process.env.REVIEW_PLASTER_ASSET),angle=process.env.REVIEW_ANGLE||'metal',port=Number(process.env.REVIEW_PORT||4393);
assert.ok(before,'REVIEW_BEFORE must identify immutable source before UV repair.');assert.ok(asset,'REVIEW_PLASTER_ASSET must explicitly name generated-unreviewed external audition bytes.');assert.ok(['metal','swiftshader'].includes(angle));
const fixture=await mkdtemp(join(tmpdir(),'slipper-material-receivers-')),report={status:'running',repo,before,asset,angle,method:'Actual TactileMaterial/geometry owners; generated plaster is borrowed unreviewed audition, no registry status mutation. Retained Canvas equalwarm lifecycle. Visual review fixtures do not prove earned progression or physical-device certification.',captures:[],errors:[]};
const base='http://127.0.0.1:'+port;let browser,server,serverLog='';
const variants=[['low',1100,720,false],['medium',1100,720,false],['high',1100,720,false],['cinematic',1100,720,false],['high',1100,720,true],['low',393,851,true],['high',393,851,false]];
const phases=(process.env.REVIEW_PHASES||'geometry,gallery,failure,lifecycle').split(',');assert.ok(phases.every(phase=>['geometry','gallery','failure','lifecycle'].includes(phase)));report.phases=phases;
const states=['dry','wet','worn','damaged','reintegrated'];
const lifecycleReceivers=(process.env.REVIEW_LIFECYCLE_RECEIVERS||'oak,plaster').split(',');assert.ok(lifecycleReceivers.every(receiver=>['oak','plaster'].includes(receiver)));report.lifecycleReceivers=lifecycleReceivers;
const persist=()=>writeFile(join(out,'receiver-review.json'),JSON.stringify(report,null,2));
const counts=e=>({geometries:e.rendererMemory.geometries,textures:e.rendererMemory.textures,programs:e.programs,nativeTextures:e.native.live,liveClones:e.liveClones.length});
try{
 await mkdir(out,{recursive:true});
 assert.equal(createHash('sha256').update(await readFile(asset)).digest('hex'),'cb88b1c0b28c7aad9c7b8c709199dd5fe7d270d49acbcd87882239ab32993ecd','immutable generated-unreviewed plaster packed source');
 for(const [source,name]of[[repo+'/src','src'],[before+'/src','before-src'],[root+'/node_modules','node_modules']])await symlink(source,join(fixture,name),'dir');
 for(const name of ['WetOakReviewReceiver.tsx','PlasterReviewReceiver.tsx','stage.tsx'])await writeFile(join(fixture,name),await readFile(new URL('./fixtures/material-receivers/'+name,import.meta.url),'utf8'));
 await writeFile(join(fixture,'index.html'),'<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><title>Actual material receiver audition</title><style>body{margin:0;background:#20272a}#root{height:100vh}</style></head><body><div id="root"></div><script type="module" src="/stage.tsx"></script></body></html>');
 await writeFile(join(fixture,'vite.config.mjs'),`export default {root:${JSON.stringify(fixture)},cacheDir:${JSON.stringify(fixture+'/cache')},esbuild:{jsx:'automatic'},resolve:{preserveSymlinks:true}}`);
 await symlink(repo+'/public',join(fixture,'public'),'dir');
 execFileSync(process.execPath,[root+'/node_modules/vite/bin/vite.js','build','--config',fixture+'/vite.config.mjs','--outDir',fixture+'/dist'],{cwd:fixture,stdio:'pipe',timeout:120000});
 // Staged build output is private; canonical public and registry remain unchanged.
 await mkdir(fixture+'/dist/art/materials/plaster',{recursive:true});await copyFile(asset,fixture+'/dist/art/materials/plaster/plaster-albedo-v1.ktx2');
 server=spawn(process.execPath,[root+'/node_modules/vite/bin/vite.js','preview','--config',fixture+'/vite.config.mjs','--host','127.0.0.1','--port',String(port),'--strictPort'],{cwd:fixture,stdio:'pipe'});server.stdout.on('data',x=>serverLog+=x);server.stderr.on('data',x=>serverLog+=x);
 let listening=false;for(let i=0;i<100;i++){if(server.exitCode!==null)throw Error('Preview exited '+serverLog);try{if((await fetch(base)).ok){listening=true;break;}}catch{}await new Promise(r=>setTimeout(r,200));}assert.ok(listening,'bounded preview startup');
 browser=await chromium.launch({args:['--enable-webgl','--ignore-gpu-blocklist','--use-angle='+angle]});
 async function contextFor(width=1100,height=720,fault='none'){
  const context=await browser.newContext({viewport:{width,height},reducedMotion:'reduce'}),page=await context.newPage(),errors=[],requests=[];
  page.on('pageerror',error=>errors.push(error.message));page.on('console',message=>{if(message.type()==='error'&&!(['missing','invalid','offline'].includes(fault)&&message.text().startsWith('Failed to load resource:')))errors.push(message.text());});
  page.on('request',request=>{if(request.url().includes('/art/materials/'))requests.push(new URL(request.url()).pathname);});
  await page.addInitScript(observeMaterialFetches);
  if(fault!=='none')await page.route('**/art/materials/**',async route=>{if(fault==='missing')return route.fulfill({status:404,body:'fixture missing'});if(fault==='invalid')return route.fulfill({status:200,body:'invalid KTX2'});if(fault==='offline')return route.abort('internetdisconnected');if(fault==='slow'){await new Promise(r=>setTimeout(r,500));return route.continue();}});
  await page.goto(base);await page.waitForFunction(()=>!!window.__configureReceiver,null,{timeout:60000});return{context,page,errors,requests};
 }
 async function capture(session,name,config,screenshot=true){
  const revision=await session.page.evaluate(next=>{window.__configureReceiver(next);return window.__receiverEvidence?.revision??-1;},config);
  try { await session.page.waitForFunction(({old,next})=>window.__receiverEvidence&&window.__receiverEvidence.revision>old&&Object.entries(next).every(([k,v])=>window.__receiverEvidence[k]===v),{old:revision,next:config},{timeout:60000}); }
  catch(error) { const diagnostic=await session.page.evaluate(()=>({evidence:window.__receiverEvidence,pending:window.__receiverPending,body:document.body.innerText}));await session.page.screenshot({path:join(out,name+'-failed.png')});report.errors.push({name,config,diagnostic,errors:session.errors,requests:session.requests});await persist();throw error; }
  const evidence=await session.page.evaluate(()=>window.__receiverEvidence);assert.equal(evidence.fetches.pending,0,name+' actual fetch settled');assert.equal(evidence.decodes.pending,0,name+' actual decoder callbacks settled');assert.equal(evidence.decodes.started,evidence.decodes.completed,name+' callback lifetime settled once');assert.deepEqual(session.errors,[],name+' page errors');assert.deepEqual(evidence.glErrors,[],name+' native GL errors');assert.ok(evidence.materials.every(m=>Object.values(m.maps).every(t=>!t.viewDisposed)),name+' cannot bind retired views');
  if(config.mounted===false)assert.equal(evidence.materials.length,0);else assert.equal(evidence.materials.length,1);
  for(const material of evidence.materials){assert.equal(material.depthPresent,true,name+' actual private shadow owner');assert.equal(material.depthMap,material.maps.map?.uuid??null,name+' private shadow must borrow current guarded view');for(const texture of Object.values(material.maps)){assert.equal(texture.wrapS,RepeatWrapping);assert.equal(texture.wrapT,RepeatWrapping);assert.equal(texture.flipY,false);assert.equal(texture.channel,0);}if(material.maps.map)assert.equal(material.maps.map.colorSpace,SRGBColorSpace);}
  if(screenshot)await session.page.screenshot({path:join(out,name+'.png')});assert.deepEqual(session.errors,[],name+' postcapture page errors');report.captures.push({name,requests:[...session.requests],...evidence});await persist();console.log(name,JSON.stringify(counts(evidence)));return evidence;
 }
 // Exact physical geometry comparison plus paired native map-off images.
 if(phases.includes('geometry'))for(const [quality,width,height,reducedEffects]of variants){const session=await contextFor(width,height);try{const common={mounted:true,receiver:'plaster',mode:'geometry',quality,reducedEffects,mapsEnabled:false,memory:'dry',fault:'none'};const a=await capture(session,'geometry-before-'+quality+'-'+width+'-'+reducedEffects,{...common,side:'before'});const b=await capture(session,'geometry-after-'+quality+'-'+width+'-'+reducedEffects,{...common,side:'after'});assert.equal(a.triangles,b.triangles);assert.equal(a.calls,b.calls);assert.deepEqual(a.camera,b.camera);assert.equal(a.materials[0].indexCount,b.materials[0].indexCount);}finally{await session.context.close();}}
 if(phases.includes('gallery'))for(const receiver of ['wood','wet-wood','plaster'])for(const memory of states)for(const mapsEnabled of receiver==='plaster'?[false,true]:[true])for(const [quality,width,height,reducedEffects]of variants){const session=await contextFor(width,height);try{const e=await capture(session,[receiver,memory,mapsEnabled?'mapped':'procedural',quality,width,reducedEffects?'reduced':'full'].join('-'),{mounted:true,receiver:receiver==='plaster'?'plaster':'oak',surface:receiver,mode:'actual',quality,reducedEffects,mapsEnabled,memory,fault:'none'});const enabled=mapsEnabled&&!reducedEffects&&['high','cinematic'].includes(quality);assert.equal(session.requests.length>0,enabled);if(enabled)assert.ok(e.decodes.byMethod.parse>0,'actual production loader parse callback was observed');assert.deepEqual(e.materials[0].channels,enabled?(receiver==='plaster'?['map']:['map','normalMap','roughnessMap']):[]);if(receiver==='plaster')assert.equal(e.materials[0].userData.approvedProductionComparison,false);}finally{await session.context.close();}}
 if(phases.includes('gallery'))for(const view of ['close','grazing']){const session=await contextFor();try{await capture(session,'plaster-'+view,{mounted:true,receiver:'plaster',mode:'actual',quality:'high',reducedEffects:false,mapsEnabled:true,memory:'dry',view,fault:'none'});}finally{await session.context.close();}}
 if(phases.includes('failure'))for(const receiver of ['oak','plaster'])for(const fault of ['missing','invalid','offline']){const session=await contextFor(1100,720,fault);try{const e=await capture(session,'fallback-'+receiver+'-'+fault,{mounted:true,receiver,surface:'wet-wood',mode:'actual',quality:'high',reducedEffects:false,mapsEnabled:true,memory:'dry',fault});assert.ok(session.requests.length>0);assert.deepEqual(e.materials[0].channels,[]);}finally{await session.context.close();}}
 if(phases.includes('lifecycle'))for(const receiver of lifecycleReceivers){
  const session=await contextFor();try{
   const baseCase={mounted:true,receiver,surface:'wet-wood',mode:'actual',memory:'wet',mapsEnabled:true,fault:'none',view:'distance'};
   const sequence=[['high',false],['low',false],['medium',false],['cinematic',false],['high',false],['high',true],['high',false]];
   for(let epoch=0;epoch<3;epoch++){
    // Warm full shader/quality set inside EACH mount epoch; no cross-epoch cache equality assumption.
    for(const [quality,reducedEffects]of sequence)await capture(session,receiver+'-epoch'+epoch+'-warm-'+quality+'-'+reducedEffects,{...baseCase,quality,reducedEffects},false);
    const expected=new Map();
    // Compare the same position in each full sequence: the same visible tier
    // reached via a new material and via retained cinematic material has a
    // different legitimate shader cache history, even after all IO settles.
    for(let cycle=0;cycle<3;cycle++)for(const [stepIndex,[quality,reducedEffects]]of sequence.entries()){
     const name=receiver+'-epoch'+epoch+'-cycle'+cycle+'-step'+stepIndex+'-'+quality+'-'+reducedEffects;
     const e=await capture(session,name,{...baseCase,quality,reducedEffects},false),key=stepIndex+':'+quality+':'+reducedEffects;
     if(expected.has(key))assert.deepEqual(counts(e),expected.get(key),name+' exact same-history warmed resource plateau');else expected.set(key,counts(e));
    }
    const empty=await capture(session,receiver+'-epoch'+epoch+'-empty',{mounted:false},false);assert.equal(empty.liveClones.length,0);if(epoch===0)session.emptyCounts=counts(empty);else assert.deepEqual(counts(empty),session.emptyCounts,'warm empty cleanup plateau');
   }
  }finally{await session.context.close();}
 }
 if(phases.includes('failure'))for(const receiver of ['oak','plaster'])for(const cancelled of ['disable','unmount']){const session=await contextFor(1100,720,'slow');try{const requestPending=session.page.waitForRequest(request=>request.url().includes('/art/materials/'),{timeout:30000});await session.page.evaluate(receiver=>window.__configureReceiver({mounted:true,receiver,surface:'wet-wood',quality:'high',reducedEffects:false,mapsEnabled:true,mode:'actual',fault:'slow'}),receiver);await requestPending;const e=await capture(session,'slow-'+receiver+'-'+cancelled,cancelled==='unmount'?{mounted:false}:{quality:'low',mapsEnabled:false},false);assert.equal(e.liveClones.length,0);if(cancelled==='disable')assert.deepEqual(e.materials[0].channels,[]);}finally{await session.context.close();}}
 report.status='passed-technical-native-art-review-required';
}catch(error){report.status='failed';report.errors.push({message:String(error),stack:error.stack});throw error;}
finally{await browser?.close();server?.kill('SIGTERM');await rm(fixture,{recursive:true,force:true});await mkdir(out,{recursive:true});await writeFile(join(out,'preview.log'),serverLog);await persist();}
