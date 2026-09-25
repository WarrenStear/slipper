import { chromium } from '@playwright/test';
import { spawn, execFileSync } from 'node:child_process';
import { mkdir, writeFile, readFile, symlink, rm } from 'node:fs/promises';

// Verified main before the restraint/finale pass; earlier review SHAs lack these source paths.
// An explicit override must contain every required baseline file; never fall back silently.
const baseline = process.env.VISUAL_REVIEW_BASELINE || '2fe438ed0d3f29860ee225f1fe6269eaced0ef79';
const angle = process.env.REVIEW_ANGLE ?? 'swiftshader';
if (!['swiftshader', 'metal'].includes(angle)) throw new Error('REVIEW_ANGLE must be swiftshader or metal');
const root = process.cwd(), out = '/tmp/slipper-cinematography-review';
const beforeRoot = '/tmp/slipper-cinematography-baseline';
const fixtureName = '.cinematography-review';
const processes = []; let browser;
const report = { candidate: execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(), baseline, requestedAngle: angle,
  method: 'Identical scene states, camera positions and directions. Baseline uses settled authored FOV; candidate uses responsive shot FOV except the opening, which retains its authored lens. Environment motion is reduced and the light profile is pre-settled; comparisons wait 25 completed render frames. Actual camera/input lifecycle is exercised separately in a lightweight fixture. Not an unassisted gameplay or FPS certification.', captures: [], interactions: [], failures: [] };
const stage = `import React,{Suspense,useLayoutEffect,useRef} from 'react';
import {createRoot} from 'react-dom/client';import {Canvas,useFrame,useThree} from '@react-three/fiber';import {Physics} from '@react-three/rapier';
import {BrokenFloorChapter} from '../src/components/three/chapters/BrokenFloorChapter';
import {BlueMoonSanctuaryChapter} from '../src/components/three/chapters/BlueMoonSanctuaryChapter';
import {ThornedHouseChapter} from '../src/components/three/chapters/ThornedHouseChapter';
import {EnchantedWoodChapter} from '../src/components/three/chapters/EnchantedWoodChapter';
import {IntegratedFinalTableau} from '../src/components/three/chapters/IntegratedFinalTableau';
import {CinematicCameraDirector} from '../src/components/three/cinematics/CinematicCameraDirector';
import {CinematicAtmosphereDirector} from '../src/components/three/cinematics/CinematicAtmosphereDirector';
import {CinematicLightingDirector} from '../src/components/three/cinematics/CinematicLightingDirector';
import {TactileMaterial} from '../src/components/three/storyEvents/TactileMaterial';
import {StoryObjectModel} from '../src/components/three/storyEvents/StoryObjectModel';
import {getJourneySceneLayout} from '../src/data/journeyWorldLayout';import {objectsForScene} from '../src/storyEvents/storyEventRegistry';
import {journeyChapters,journeyScenes} from '../src/data/journeyNarrative';
import {RENDER_QUALITY_PROFILES} from '../src/components/three/renderQuality';
import {useJourneyStore} from '../src/stores/useJourneyStore';import {useWorldStore} from '../src/stores/useWorldStore';import {useSettingsStore} from '../src/stores/useSettingsStore';
import {resolveCinematicProfile} from '../src/cinematics/emotionalProfiles';import {advanceCinematicProfile} from '../src/cinematics/emotionalCinematography';
import {shotLens} from './shotComposition';
const params=new URLSearchParams(location.search),which=params.get('case')||'blue',before=params.get('before')==='1',quality=params.get('quality')||'high';
const rig=which==='rig',detail=which==='details',id={broken:'broken-floor.confession',blue:'blue-moon.intimacy',house:'thorned.old-memory-bedroom',meadow:'enchanted.friendship-meadow',ending:'epilogue.constellation'}[which]||'blue-moon.sanctuary';
const ending=which==='ending',scene=getJourneySceneLayout(id),entries=journeyChapters.flatMap(c=>c.entryIds);
useJourneyStore.setState({sceneId:id,storyStarted:true,storyCompleted:false,storyObjectStates:ending?{'epilogue.reverse-light':'complete','lantern.master':'placed'}:which==='broken'?{'broken-floor.reflection':'revealed'}:{},worldFlags:{'story-events.started':true},completedStoryEventIds:which==='broken'?['broken-floor.first-wipe','broken-floor.forest-revealed']:[],storyPlacementStates:{},history:ending?entries:[],witnessedEntryIds:ending?entries:[],completedSceneIds:ending?journeyScenes.map(s=>s.id):[],completedChapterIds:ending?journeyChapters.map(c=>c.id):[]});
useWorldStore.setState({mode:'explore',controls:'walk',physicsPaused:false});useSettingsStore.setState({drawerOpen:false,reducedMotion:false,cameraAssistance:true});
const profile=resolveCinematicProfile(id,{});for(let i=0;i<300;i++)advanceCinematicProfile(profile,.1);
const Chapter={broken:BrokenFloorChapter,blue:BlueMoonSanctuaryChapter,house:ThornedHouseChapter,meadow:EnchantedWoodChapter,ending:IntegratedFinalTableau}[which];
function Evidence(){const {camera,scene,gl}=useThree(),frames=useRef(0);
 useLayoutEffect(()=>{
  if(rig){camera.position.set(0,1.6,2);camera.lookAt(.9,1.3,-5);}
  else if(detail){camera.position.set(2.5,1.6,4);camera.lookAt(0,.65,0);}
  else if(which==='broken'){camera.position.set(0,2.3,-4);camera.lookAt(0,.2,2);}
  else if(which==='blue'){camera.position.set(0,3.2,-10);camera.lookAt(0,2.4,7);}
  else if(which==='house'){camera.position.set(.65,2.1,-1.65);camera.lookAt(0,1.5,5);}
  else if(which==='meadow'){camera.position.set(0,2.7,-8);camera.lookAt(0,2.8,6);}
  else{camera.position.set(0,3.3,6.5);camera.lookAt(0,4.8,-15);}
  if(!rig)camera.fov=detail?50:(before||which==='broken')?profile.fov:shotLens(id,profile.fov,camera.aspect);camera.updateProjectionMatrix();
 },[camera]);
 useFrame(()=>{if(rig||++frames.current===25){let lights=0,shadowLights=0;scene.traverse(o=>{if(o.isLight){lights++;if(o.castShadow)shadowLights++;}});window.__shotEvidence={calls:gl.info.render.calls,triangles:gl.info.render.triangles,lights,shadowLights,fov:camera.fov,position:camera.position.toArray(),quaternion:camera.quaternion.toArray(),sceneId:id};document.body.dataset.ready='true';}});return null;
}
function Rig(){const reducedMotion=useSettingsStore(s=>s.reducedMotion),cameraAssistance=useSettingsStore(s=>s.cameraAssistance);return <CinematicCameraDirector sceneId={id} reducedMotion={reducedMotion} cameraAssistance={cameraAssistance} focusPosition={[0,1.3,-5]}/>;}
function Controls(){return rig?<div style={{position:'fixed',top:8,left:8,zIndex:10}}><button onClick={()=>useSettingsStore.setState({drawerOpen:true})}>Open settings</button><button onClick={()=>useSettingsStore.setState({drawerOpen:false})}>Close settings</button><button onClick={()=>useSettingsStore.setState({reducedMotion:true})}>Reduce motion</button><button onClick={()=>useWorldStore.setState({controls:'orbit'})}>Orbit</button></div>:null;}
function Details(){return <group>{['wood','linen','paper','bark','stone'].map((surface,i)=><mesh key={i} position={[(i-2)*.75,.55,0]}><boxGeometry args={[.6,1.1,.5]}/>{before&&i>=3?<meshStandardMaterial color={['#4a4b36','#65726f'][i-3]} roughness={.98}/>:<TactileMaterial surface={surface} color={['#79604a','#ded9ca','#d8cfbc','#4a4b36','#65726f'][i]} roughness={i>=3?.98:.82}/>}</mesh>)}</group>;}
createRoot(document.getElementById('root')).render(<><Canvas dpr={1} camera={{fov:65,near:.05,far:150}} gl={{antialias:true,preserveDrawingBuffer:true}}><color attach='background' args={['#080e11']}/><hemisphereLight args={['#b9c8cf','#30251e',.65]}/><directionalLight position={detail?[3,5,4]:[-4,8,-5]} color='#c4d0d4' intensity={detail?1.5:.65}/><Suspense fallback={null}>{rig?<><mesh position={[0,1.3,-5]}><boxGeometry/><meshStandardMaterial color='#c9baa1'/></mesh><Rig/></>:detail?<Details/>:<><Physics paused><Chapter scene={scene} qualityProfile={RENDER_QUALITY_PROFILES[quality]} reducedEffects={quality==='low'} reducedMotion openingResolved={false}/>{['blue','house'].includes(which)?objectsForScene(id).filter(o=>!['path','water','door','lantern'].includes(o.kind)).map(o=><group key={o.id} position={o.localPosition}><StoryObjectModel kind={o.kind} reducedMotion/></group>):null}</Physics><CinematicLightingDirector/><CinematicAtmosphereDirector/></>}<Evidence/></Suspense></Canvas><Controls/></>);`;
async function server(cwd, port, preview=false) {
  const reviewConfig = cwd+'/'+fixtureName+'/vite.config.ts';
  // The source worktrees share locked dependencies, never Vite's mutable prebundle cache.
  // Otherwise the baseline optimizer can replace the candidate's lazy Rapier chunks.
  if (!preview) await writeFile(reviewConfig, `import original from '../vite.config.ts';\nexport default { ...original, cacheDir: ${JSON.stringify(cwd+'/'+fixtureName+'/vite-cache')}, optimizeDeps: { ...original.optimizeDeps, entries: [${JSON.stringify(fixtureName+'/index.html')}] } };\n`);
  const child=spawn(process.execPath,[root+'/node_modules/vite/bin/vite.js',...(preview?['preview']:['--config',reviewConfig]),'--host','127.0.0.1','--port',String(port),'--strictPort'],{cwd,stdio:['ignore','pipe','pipe']});
  processes.push(child);let log='';child.stdout.on('data',b=>log+=b);child.stderr.on('data',b=>log+=b);
  for(let i=0;i<120;i++){if(child.exitCode!==null)throw new Error(log);try{if((await fetch('http://127.0.0.1:'+port)).ok)return;}catch{}await new Promise(r=>setTimeout(r,250));}throw new Error(log||'Server unavailable');
}
const persist=()=>writeFile(out+'/review.json',JSON.stringify(report,null,2));
// Match the prior appearance reviews' 25-frame warm-up. Real camera timing is
// exercised separately; source-component captures do not certify gameplay.
async function capture(which,width,height,quality,before) {
 const ctx=await browser.newContext({viewport:{width,height},deviceScaleFactor:1,reducedMotion:'reduce'}),page=await ctx.newPage(),errors=[];
 const name=`${before?'before':'after'}-${which}-${quality}-${width}`;
 page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 try{await page.goto(`http://127.0.0.1:${before?4205:4204}/${fixtureName}/?case=${which}&quality=${quality}&before=${before?1:0}`,{waitUntil:'domcontentloaded'});if(errors.length)throw new Error(errors.join('\n'));await Promise.race([page.locator('body[data-ready="true"]').waitFor({timeout:90000}),new Promise((_,reject)=>page.once('pageerror',reject))]);await page.screenshot({path:out+'/'+name+'.png',timeout:60000});const stats=await page.evaluate(()=>window.__shotEvidence);if(!stats.calls||errors.length)throw new Error(errors.join('\n')||'Empty render');report.captures.push({name,which,width,height,quality,before,scope:'seeded scene or material fixture',...stats});}
 catch(error){report.failures.push({name,error:String(error),errors});}finally{await ctx.close();await persist();console.log('capture checkpoint',name,report.captures.length,report.failures.length);}
}
async function testRig(){
 const ctx=await browser.newContext({viewport:{width:1100,height:720}}),page=await ctx.newPage(),errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 const read=()=>page.evaluate(()=>window.__shotEvidence);
 const quaternionDistance=(a,b)=>Math.hypot(...a.quaternion.map((v,i)=>v-b.quaternion[i]));
 try{
  await page.goto(`http://127.0.0.1:4204/${fixtureName}/?case=rig`);await page.bringToFront();await page.locator('body[data-ready="true"]').waitFor();
  const start=await read();await page.waitForTimeout(6200);const settled=await read();
  if(quaternionDistance(start,settled)<.001||quaternionDistance(start,settled)>.025)throw new Error('Idle settle missing or exceeds angular bound');
  if(start.position.some((v,i)=>v!==settled.position[i]))throw new Error('Camera position changed');
  // Mouse-look under pointer lock does not require a held button. Exercise the
  // same pointermove path while portrait requests a wider lens, then release it.
  await page.setViewportSize({width:390,height:844});
  let lookHold;
  for(let i=0;i<8;i++){
    await page.mouse.move(300+i*4,600);await page.waitForTimeout(70);
    const sample=await read();
    if(!lookHold)lookHold=sample;
    if(Math.abs(sample.fov-lookHold.fov)>1e-6)throw new Error('Unbuttoned pointer input did not hold the lens');
  }
  await page.waitForTimeout(1200);const releasedLook=await read();
  if(releasedLook.fov<=lookHold.fov+.1)throw new Error('Lens did not resume after the input handoff');
  if(start.position.some((v,i)=>v!==releasedLook.position[i]))throw new Error('Portrait handoff translated the camera');
  await page.setViewportSize({width:1100,height:720});
  await page.mouse.wheel(0,3);await page.waitForTimeout(50);const wheelHold=await read();
  await page.waitForTimeout(150);const wheelEnd=await read();
  if(Math.abs(wheelHold.fov-wheelEnd.fov)>1e-6)throw new Error('Wheel handoff did not hold the lens');
  await page.keyboard.down('KeyW');await page.waitForTimeout(100);const held=await read();await page.waitForTimeout(500);const heldEnd=await read();await page.keyboard.up('KeyW');
  if(quaternionDistance(held,heldEnd)>1e-8||held.fov!==heldEnd.fov)throw new Error('Held input did not freeze lens and aim');
  await page.getByRole('button',{name:'Open settings',exact:true}).click();await page.waitForTimeout(100);const paused=await read();await page.waitForTimeout(500);const pausedEnd=await read();
  if(quaternionDistance(paused,pausedEnd)>1e-8||paused.fov!==pausedEnd.fov)throw new Error('Settings did not freeze camera');
  await page.getByRole('button',{name:'Close settings',exact:true}).click();await page.getByRole('button',{name:'Reduce motion',exact:true}).click();await page.waitForTimeout(100);const comfort=await read();await page.waitForTimeout(500);const comfortEnd=await read();
  if(comfort.fov!==65||quaternionDistance(comfort,comfortEnd)>1e-8)throw new Error('Reduced motion is not stable');
  if(errors.length)throw new Error(errors.join('\n'));report.interactions.push({name:'actual camera director',start,settled,checks:['bounded idle settling','no camera translation','unbuttoned pointer input freezes lens','portrait lens resumes after handoff','wheel input freezes lens','held input freezes aim and lens','Settings freezes camera','reduced motion snaps to stable 65 degrees']});
 }catch(error){report.failures.push({name:'camera lifecycle',error:String(error),errors});}finally{await ctx.close();await persist();}
}
async function entry(width,height){const ctx=await browser.newContext({viewport:{width,height},reducedMotion:'no-preference'}),page=await ctx.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 try{await page.goto('http://127.0.0.1:4203/?accessible=1');await page.locator('.onboarding-gate[aria-busy="false"]').waitFor();const begin=page.getByRole('button',{name:'Begin',exact:true});await begin.waitFor();await page.waitForTimeout(2600);if(await page.locator('#onboarding-title').innerText()!=='SLIPPER IN THE WOODS'||await page.locator('#onboarding-description').innerText()!=='A journey to you.')throw new Error('Entry copy changed');if(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth))throw new Error('Entry overflow');await page.screenshot({path:out+'/entry-'+width+'.png'});await begin.click();await page.locator('[data-accessible-journey="true"]').waitFor();if(errors.length)throw new Error(errors.join('\n'));report.captures.push({name:'entry-'+width,scope:'production entry',width,height,interaction:'Begin opens accessible journey'});}
 catch(error){report.failures.push({name:'entry-'+width,error:String(error),errors});}finally{await ctx.close();await persist();}}
function withMaterialPolicy(source) {
 const replacements = [
  ["import {TactileMaterial}", "import {TactileMaterial,TactileDetailProvider}"],
  ["<Suspense fallback={null}>", "<Suspense fallback={null}><TactileDetailProvider quality={quality} reducedEffects={quality==='low'}>"],
  ["<Evidence/></Suspense>", "<Evidence/></TactileDetailProvider></Suspense>"],
 ];
 for (const [before, after] of replacements) {
  if (!source.includes(before)) throw new Error('Material review fixture anchor missing: '+before);
  source = source.replace(before, after);
 }
 return source;
}
try{
 await mkdir(out,{recursive:true});
 execFileSync('git',['cat-file','-e',`${baseline}^{commit}`]);
 const baselineFiles=new Set(execFileSync('git',['ls-tree','-r','--name-only',baseline],{encoding:'utf8'}).trim().split('\n'));
 // The full-worktree fixture imports both TS and TSX modules; validate each before starting Vite.
 const baselineImports=[...stage.matchAll(/from ['"]\.\.\/(src\/[^'"]+)['"]/g)].map(match=>match[1]);
 for(const required of ['vite.config.ts',...baselineImports]) {
   if(![required,required+'.ts',required+'.tsx'].some(file=>baselineFiles.has(file))) throw new Error(`Baseline ${baseline} lacks required fixture source ${required}`);
 }
 execFileSync('git',['worktree','add','--detach',beforeRoot,baseline]);await symlink(root+'/node_modules',beforeRoot+'/node_modules','dir');
 for(const dir of [root,beforeRoot]){await mkdir(dir+'/'+fixtureName,{recursive:true});await writeFile(dir+'/'+fixtureName+'/index.html','<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><title>Cinematography review fixture</title><style>html,body,#root{width:100%;height:100%;margin:0;overflow:hidden}button{padding:8px;margin:4px}</style></head><body><div id="root"></div><script type="module" src="./stage.tsx"></script></body></html>');await writeFile(dir+'/'+fixtureName+'/stage.tsx',dir===root?withMaterialPolicy(stage):stage);await writeFile(dir+'/'+fixtureName+'/shotComposition.ts',await readFile(root+'/src/cinematics/shotComposition.ts'));}
 await server(root,4203,true);await server(root,4204);await server(beforeRoot,4205);
 browser=await chromium.launch({args:['--enable-webgl','--ignore-gpu-blocklist',`--use-angle=${angle}`]});
 await testRig();await entry(1280,800);await entry(390,844);
 await capture('details',1100,720,'high',true);await capture('details',1100,720,'high',false);
 for(const which of ['broken','blue','house','meadow','ending']){
   await capture(which,1100,720,'high',true);await capture(which,1100,720,'high',false);
   await capture(which,1100,720,'low',false);
   if(['blue','house'].includes(which))await capture(which,390,844,'low',true);
   await capture(which,390,844,'low',false);
 }
 for(const after of report.captures.filter(c=>c.scope==='seeded scene or material fixture'&&!c.before&&c.quality==='high'&&c.width===1100)){
  const before=report.captures.find(c=>c.which===after.which&&c.before);if(!before)throw new Error('Missing baseline');
  after.delta={calls:after.calls-before.calls,triangles:after.triangles-before.triangles,lights:after.lights-before.lights};
  // FOV may expose additional existing geometry. Exact per-frame values are reported,
  // while added geometry/light topology is protected by source/unit checks.
  if(after.delta.calls>12||after.delta.lights>0||after.shadowLights>before.shadowLights)report.failures.push({name:after.name,error:'Unexpected draw-call/light growth',delta:after.delta});
 }
}catch(error){report.failures.push({name:'harness',error:String(error)});}
finally{if(browser)await browser.close();for(const p of processes)p.kill('SIGTERM');await rm(root+'/'+fixtureName,{recursive:true,force:true});try{execFileSync('git',['worktree','remove','--force',beforeRoot]);}catch{}await persist();console.log(JSON.stringify({captures:report.captures.length,interactions:report.interactions,failures:report.failures},null,2));if(report.failures.length)process.exitCode=1;}
