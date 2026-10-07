import { chromium } from '@playwright/test';
import { spawn, execFileSync } from 'node:child_process';
import { mkdir, writeFile, rm } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

// Verified main before the restraint/finale pass; earlier review SHAs lack these source paths.
// An explicit override must contain every required baseline file; never fall back silently.
const baseline = process.env.VISUAL_REVIEW_BASELINE || '2fe438ed0d3f29860ee225f1fe6269eaced0ef79';
const angle = process.env.REVIEW_ANGLE ?? 'swiftshader';
if (!['swiftshader', 'metal'].includes(angle)) throw new Error('REVIEW_ANGLE must be swiftshader or metal');
const out = '/tmp/slipper-woodland-review', fixture = resolve('.woodland-review');
const originals = [
  'chapters/EnchantedWoodChapter.tsx', 'chapters/IntegratedFinalTableau.tsx',
  'cinematics/CinematicAtmosphereDirector.tsx', 'cinematics/CinematicLightingDirector.tsx',
  'environment/chapterEnvironment.ts',
];
const firstWoodOwner = 'src/scenes/first-wood/FirstWoodScene.tsx';
const firstWoodBaselineOwner = 'src/scenes/first-wood/WoodlandBaselineFirstWoodScene.tsx';
const copies = originals.map(p => [`src/components/three/${p}`, `src/components/three/${p.replace(/([^/]+)$/, 'WoodlandBaseline$1')}`]);
const report = {
  candidate: execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(), baseline, requestedAngle: angle,
  candidateFirstWoodOwner: firstWoodOwner,
  method: 'Same-camera, settled-profile source-component fixtures. Seeded ending state is appearance evidence only, not an earned gameplay completion. No real-device FPS claim.',
  captures: [], failures: [],
};
const processes = []; let browser;
async function server(args, port) {
  const child=spawn(process.execPath,['node_modules/vite/bin/vite.js',...args,'--host','127.0.0.1','--port',String(port),'--strictPort'],{stdio:['ignore','pipe','pipe']});
  processes.push(child);let log='';child.stdout.on('data',b=>log+=b);child.stderr.on('data',b=>log+=b);
  for(let i=0;i<120;i++){
    if(child.exitCode!==null)throw new Error(log);
    try{if((await fetch(`http://127.0.0.1:${port}`)).ok)return;}catch{}
    await new Promise(r=>setTimeout(r,250));
  }
  throw new Error(`Server failed: ${log}`);
}
const stage = `import React,{Suspense,useLayoutEffect,useRef} from 'react';
import {createRoot} from 'react-dom/client';import {Canvas,useFrame,useThree} from '@react-three/fiber';
import {Physics} from '@react-three/rapier';
import {FirstWoodScene} from '../src/scenes/first-wood/FirstWoodScene';
import {EnchantedWoodChapter as BeforeWood} from '../src/components/three/chapters/WoodlandBaselineEnchantedWoodChapter';
import {IntegratedFinalTableau} from '../src/components/three/chapters/IntegratedFinalTableau';
import {IntegratedFinalTableau as BeforeEnd} from '../src/components/three/chapters/WoodlandBaselineIntegratedFinalTableau';
import {CinematicAtmosphereDirector} from '../src/components/three/cinematics/CinematicAtmosphereDirector';
import {CinematicAtmosphereDirector as BeforeFog} from '../src/components/three/cinematics/WoodlandBaselineCinematicAtmosphereDirector';
import {CinematicLightingDirector} from '../src/components/three/cinematics/CinematicLightingDirector';
import {CinematicLightingDirector as BeforeLight} from '../src/components/three/cinematics/WoodlandBaselineCinematicLightingDirector';
import {getJourneySceneLayout} from '../src/data/journeyWorldLayout';
import {journeyChapters,journeyScenes} from '../src/data/journeyNarrative';
import {RENDER_QUALITY_PROFILES} from '../src/components/three/renderQuality';
import {useJourneyStore} from '../src/stores/useJourneyStore';import {useSettingsStore} from '../src/stores/useSettingsStore';import {useWorldStore} from '../src/stores/useWorldStore';
import {resolveCinematicProfile} from '../src/cinematics/emotionalProfiles';import {advanceCinematicProfile} from '../src/cinematics/emotionalCinematography';
const p=new URLSearchParams(location.search),which=p.get('case')||'meadow',before=p.get('before')==='1',quality=p.get('quality')||'low';
const ending=which==='ending',sceneId=ending?'epilogue.constellation':which==='meadow'?'enchanted.friendship-meadow':'enchanted.rabbit-hole';
const scene=getJourneySceneLayout(sceneId),entries=journeyChapters.flatMap(c=>c.entryIds);
// Explicitly seeded visual states, never a replacement for physical or semantic tests.
useJourneyStore.setState({sceneId,storyCompleted:false,storyObjectStates:ending?{'epilogue.reverse-light':'complete','lantern.master':'placed'}:{},worldFlags:ending?{'story-events.started':true,'lantern.placed-and-lit':true}:{},storyPlacementStates:{},history:ending?entries:[],witnessedEntryIds:ending?entries:[],completedSceneIds:ending?journeyScenes.map(s=>s.id):[],completedChapterIds:ending?journeyChapters.map(c=>c.id):[]});
useSettingsStore.setState({reducedMotion:true,reducedEffects:quality==='low'});useWorldStore.setState({mode:'explore'});
const Chapter=ending?(before?BeforeEnd:IntegratedFinalTableau):(before?BeforeWood:FirstWoodScene);
const Fog=before?BeforeFog:CinematicAtmosphereDirector,Light=before?BeforeLight:CinematicLightingDirector;
const profile=resolveCinematicProfile(sceneId,{});for(let i=0;i<300;i++)advanceCinematicProfile(profile,.1);
function Evidence(){const {camera,scene,gl}=useThree(),frames=useRef(0);
 useLayoutEffect(()=>{if(ending){camera.position.set(0,3.3,6.5);camera.lookAt(0,4.8,-15);}else{camera.position.set(0,2.7,-8);camera.lookAt(0,2.8,6);}camera.updateProjectionMatrix();},[camera]);
 useFrame((_,delta)=>advanceCinematicProfile(profile,delta),-2);
 useFrame(()=>{if(++frames.current===25){let lights=0,shadowLights=0;const names=[],batches=[];scene.traverse(o=>{if(o.name)names.push(o.name);if(o.isLight){lights++;if(o.castShadow)shadowLights++;}if(o.isInstancedMesh)batches.push({name:o.name,count:o.count});});window.__woodlandEvidence={calls:gl.info.render.calls,triangles:gl.info.render.triangles,lights,shadowLights,names,batches,camera:camera.position.toArray(),fog:{density:scene.fog?.density,color:scene.fog?.color.getHexString()}};document.body.dataset.ready='true';}});return null;}
createRoot(document.getElementById('root')).render(<Canvas dpr={1} camera={{fov:65,near:.05,far:150}} gl={{antialias:true,preserveDrawingBuffer:true}}><color attach='background' args={['#080e11']}/><hemisphereLight args={['#b9c8cf','#30251e',.45]}/><Suspense fallback={null}><Physics paused><Chapter scene={scene} qualityProfile={RENDER_QUALITY_PROFILES[quality]} reducedEffects={quality==='low'} reducedMotion/></Physics><Light/><Fog/><Evidence/></Suspense></Canvas>);`;
async function capture(which,width,height,quality,before){
  const ctx=await browser.newContext({viewport:{width,height},deviceScaleFactor:1,reducedMotion:'reduce'}),page=await ctx.newPage(),errors=[];
  const name=`${before?'before':'after'}-${which}-${quality}-${width}`;
  page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
  try{
    await page.goto(`http://127.0.0.1:4194/.woodland-review/?case=${which}&quality=${quality}&before=${before?1:0}`,{waitUntil:'domcontentloaded',timeout:45000});
    await page.locator('body[data-ready="true"]').waitFor({timeout:90000});
    await page.screenshot({path:`${out}/${name}.png`,timeout:60000});
    const stats=await page.evaluate(()=>window.__woodlandEvidence);
    if(!stats.calls||errors.length)throw new Error(errors.join('\n')||'Empty render');
    if(!before){
      if(which==='ending'&&!stats.names.includes('final-woodland-batches'))throw new Error('Ending batches absent');
      if(which!=='ending'&&!stats.names.includes('enchanted-layered-forest'))throw new Error('Forest depth absent');
      if(which==='meadow'&&stats.batches.find(b=>b.name==='meadow-blossoms')?.count!==(quality==='low'?8:18))throw new Error('Meadow instance count mismatch');
    }
    report.captures.push({name,which,width,height,quality,before,scope:'seeded chapter fixture',...stats});
  }catch(e){report.failures.push({name,error:String(e),errors});}
  finally{await ctx.close();await writeFile(out+'/review.json',JSON.stringify(report,null,2));}
}
async function entry(width,height){
  const ctx=await browser.newContext({viewport:{width,height},deviceScaleFactor:1,reducedMotion:'no-preference'}),page=await ctx.newPage(),errors=[];
  const name=`entry-${width}`;page.on('pageerror',e=>errors.push(e.message));
  try{
    await page.goto('http://127.0.0.1:4193/?accessible=1',{waitUntil:'domcontentloaded'});
    await page.locator('.onboarding-gate[aria-busy="false"]').waitFor();
    const button=page.getByRole('button',{name:'Begin',exact:true});await button.waitFor();await page.waitForTimeout(2600);
    if(await page.locator('#onboarding-title').innerText()!=='SLIPPER IN THE WOODS'||await page.locator('#onboarding-description').innerText()!=='A journey to you.')throw new Error('Entry copy changed');
    if(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth))throw new Error('Overflow');
    await page.screenshot({path:`${out}/${name}.png`});await button.click();await page.locator('[data-accessible-journey="true"]').waitFor();
    if(errors.length)throw new Error(errors.join('\n'));report.captures.push({name,width,height,scope:'production entry',interaction:'Begin opens accessible journey'});
  }catch(e){report.failures.push({name,error:String(e),errors});}finally{await ctx.close();await writeFile(out+'/review.json',JSON.stringify(report,null,2));}
}
try{
  await mkdir(out,{recursive:true});
  execFileSync('git',['cat-file','-e',`${baseline}^{commit}`]);
  for(const [required] of copies) execFileSync('git',['cat-file','-e',`${baseline}:${required}`]);
  // Older baselines contain the actual chapter body. Newer baselines contain
  // only the compatibility export: copy their immutable scene body as well,
  // never let a baseline adapter resolve the current candidate's composition.
  const baselineWood = execFileSync('git',['show',baseline+':src/components/three/chapters/EnchantedWoodChapter.tsx'],{encoding:'utf8'});
  const usesFirstWoodOwner = baselineWood.includes('scenes/first-wood/FirstWoodScene');
  if(usesFirstWoodOwner){
    execFileSync('git',['cat-file','-e',`${baseline}:${firstWoodOwner}`]);
    copies.push([firstWoodOwner,firstWoodBaselineOwner]);
  }
  await mkdir(fixture,{recursive:true});
  for(const [original,copy]of copies){
    let text=execFileSync('git',['show',baseline+':'+original],{encoding:'utf8'});
    if(original==='src/components/three/chapters/EnchantedWoodChapter.tsx' && usesFirstWoodOwner)
      text=text.replace('scenes/first-wood/FirstWoodScene','scenes/first-wood/WoodlandBaselineFirstWoodScene');
    if(original.includes('/cinematics/'))text=text.replace('../environment/chapterEnvironment','../environment/WoodlandBaselinechapterEnvironment');
    await mkdir(dirname(copy),{recursive:true});
    await writeFile(copy,text);
  }
  await writeFile(fixture+'/index.html','<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><title>Woodland component comparison</title><style>html,body,#root{width:100%;height:100%;margin:0;overflow:hidden}</style></head><body><div id="root"></div><script type="module" src="./stage.tsx"></script></body></html>');
  await writeFile(fixture+'/stage.tsx',stage);
  // Other review harnesses share dependencies, never Vite's mutable prebundle cache.
  await writeFile(fixture+'/vite.config.ts', `import original from '../vite.config.ts'; export default { ...original, cacheDir: ${JSON.stringify(fixture+'/vite-cache')}, optimizeDeps: { ...original.optimizeDeps, entries: [${JSON.stringify(fixture+'/index.html')}] } };`);
  await server(['preview'],4193);await server(['--config',fixture+'/vite.config.ts'],4194);
  browser=await chromium.launch({args:['--enable-webgl','--ignore-gpu-blocklist',`--use-angle=${angle}`]});
  await entry(1280,800);await entry(390,844);
  for(const which of ['meadow','rabbit','ending']){
    for(const quality of ['low','high']){await capture(which,1100,720,quality,true);await capture(which,1100,720,quality,false);}
    await capture(which,390,844,'low',false);
  }
  for(const after of report.captures.filter(c=>c.scope==='seeded chapter fixture'&&!c.before&&c.width===1100)){
    const before=report.captures.find(c=>c.which===after.which&&c.quality===after.quality&&c.before);
    if(!before)continue;
    after.delta={calls:after.calls-before.calls,triangles:after.triangles-before.triangles,lights:after.lights-before.lights};
    const ceiling=after.which==='rabbit'?3:0;
    if(after.delta.calls>ceiling||after.delta.triangles>13000||after.delta.lights>0||after.shadowLights>before.shadowLights)report.failures.push({name:after.name,error:'Exceeded draw-call, geometry or light budget',delta:after.delta});
  }
}catch(e){report.failures.push({name:'harness',error:String(e)});}
finally{
  if(browser)await browser.close();for(const child of processes)child.kill('SIGTERM');
  await rm(fixture,{recursive:true,force:true});for(const [,copy]of copies)await rm(copy,{force:true});
  await writeFile(out+'/review.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));if(report.failures.length)process.exitCode=1;
}
