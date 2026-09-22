import { chromium } from '@playwright/test';
import { spawn, execFileSync } from 'node:child_process';
import { mkdir, writeFile, rm } from 'node:fs/promises';
import { resolve } from 'node:path';

const baseline = process.env.VISUAL_REVIEW_BASELINE || '475b16cbe5533178f8fc3ee5fb7620ab4205b3ec';
const out = '/tmp/slipper-environment-review', fixture = resolve('.environment-review');
const originals = [
  'chapters/BrokenFloorChapter', 'chapters/BlueMoonSanctuaryChapter', 'chapters/ThornedHouseChapter',
  'storyEvents/WetFloorReveal', 'cinematics/CinematicAtmosphereDirector', 'cinematics/CinematicLightingDirector',
];
const copies = originals.map(path => [`src/components/three/${path}.tsx`, `src/components/three/${path.replace(/([^/]+)$/, 'EnvironmentBaseline$1')}.tsx`]);
const report = { candidate: execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(), baseline, method: 'Same-camera reduced-motion chapter fixtures with settled authored profiles and 25 rendered warm-up frames; production entry controls. Not full gameplay or real-device FPS certification.', captures: [], failures: [] };
const processes = []; let browser;
async function server(args, port) {
  if (args[0] !== 'preview') {
    const config = fixture + '/vite.config.ts';
    await writeFile(config, `import original from '../vite.config.ts';\nexport default { ...original, cacheDir: ${JSON.stringify(fixture + '/vite-cache')}, optimizeDeps: { ...original.optimizeDeps, entries: ['.environment-review/index.html'] } };\n`);
    args = ['--config', config];
  }
  const child = spawn(process.execPath,['node_modules/vite/bin/vite.js',...args,'--host','127.0.0.1','--port',String(port),'--strictPort'],{stdio:['ignore','pipe','pipe']});
  processes.push(child); let log='';child.stdout.on('data',b=>log+=b);child.stderr.on('data',b=>log+=b);
  for(let i=0;i<120;i++){if(child.exitCode!==null)throw new Error(log);try{if((await fetch(`http://127.0.0.1:${port}`)).ok)return;}catch{}await new Promise(r=>setTimeout(r,250));}
  throw new Error(`Server failed: ${log}`);
}
const stage = `import React,{Suspense,useLayoutEffect,useRef} from 'react';
import {createRoot} from 'react-dom/client';import {Canvas,useFrame,useThree} from '@react-three/fiber';import {Physics} from '@react-three/rapier';
import {BrokenFloorChapter} from '../src/components/three/chapters/BrokenFloorChapter';
import {BrokenFloorChapter as BeforeBroken} from '../src/components/three/chapters/EnvironmentBaselineBrokenFloorChapter';
import {BlueMoonSanctuaryChapter} from '../src/components/three/chapters/BlueMoonSanctuaryChapter';
import {BlueMoonSanctuaryChapter as BeforeBlue} from '../src/components/three/chapters/EnvironmentBaselineBlueMoonSanctuaryChapter';
import {ThornedHouseChapter} from '../src/components/three/chapters/ThornedHouseChapter';
import {ThornedHouseChapter as BeforeHouse} from '../src/components/three/chapters/EnvironmentBaselineThornedHouseChapter';
import {CinematicAtmosphereDirector} from '../src/components/three/cinematics/CinematicAtmosphereDirector';
import {CinematicAtmosphereDirector as BeforeFog} from '../src/components/three/cinematics/EnvironmentBaselineCinematicAtmosphereDirector';
import {CinematicLightingDirector} from '../src/components/three/cinematics/CinematicLightingDirector';
import {CinematicLightingDirector as BeforeLight} from '../src/components/three/cinematics/EnvironmentBaselineCinematicLightingDirector';
import {StoryObjectModel} from '../src/components/three/storyEvents/StoryObjectModel';
import {getJourneySceneLayout} from '../src/data/journeyWorldLayout';import {objectsForScene} from '../src/storyEvents/storyEventRegistry';
import {RENDER_QUALITY_PROFILES} from '../src/components/three/renderQuality';import {useJourneyStore} from '../src/stores/useJourneyStore';import {useSettingsStore} from '../src/stores/useSettingsStore';import {useWorldStore} from '../src/stores/useWorldStore';
import {resolveCinematicProfile} from '../src/cinematics/emotionalProfiles';import {advanceCinematicProfile} from '../src/cinematics/emotionalCinematography';
const p=new URLSearchParams(location.search), which=p.get('case')||'blue', before=p.get('before')==='1', quality=p.get('quality')||'low';
const sceneId=which==='broken'?'broken-floor.confession':which==='blue'?'blue-moon.intimacy':'thorned.old-memory-bedroom';
const scene=getJourneySceneLayout(sceneId); const reducedEffects=quality==='low';
useJourneyStore.setState({sceneId,storyObjectStates:which==='broken'?{'broken-floor.reflection':'revealed'}:{},worldFlags:{'story-events.started':true},completedStoryEventIds:which==='broken'?['broken-floor.first-wipe','broken-floor.forest-revealed']:[],storyPlacementStates:{}});
useSettingsStore.setState({reducedMotion:true,reducedEffects});useWorldStore.setState({mode:'explore'});
const Chapter=which==='broken'?(before?BeforeBroken:BrokenFloorChapter):which==='blue'?(before?BeforeBlue:BlueMoonSanctuaryChapter):(before?BeforeHouse:ThornedHouseChapter);
const Fog=before?BeforeFog:CinematicAtmosphereDirector, Light=before?BeforeLight:CinematicLightingDirector;
const profile=resolveCinematicProfile(sceneId,{});
// Compare settled authored lighting, not machine-dependent transition progress.
for(let i=0;i<300;i++)advanceCinematicProfile(profile,.1);
function Evidence(){const {camera,scene,gl}=useThree(),frames=useRef(0);
 useLayoutEffect(()=>{if(which==='broken'){camera.position.set(0,2.3,-4);camera.lookAt(0,.2,2);}else if(which==='blue'){camera.position.set(0,3.2,-10);camera.lookAt(0,2.4,7);}else if(which==='house-side'){camera.position.set(-.3,2,-1.1);camera.lookAt(-3.3,1.3,.8);}else{camera.position.set(.65,2.1,-1.65);camera.lookAt(0,1.5,5);}camera.updateProjectionMatrix();},[camera]);
 useFrame((_,delta)=>advanceCinematicProfile(profile,delta),-2);
 useFrame(()=>{if(++frames.current===25){const names=[];let lights=0,shadowLights=0;scene.traverse(o=>{if(o.name)names.push(o.name);if(o.isLight){lights++;if(o.castShadow)shadowLights++;}});window.__environmentEvidence={calls:gl.info.render.calls,triangles:gl.info.render.triangles,lights,shadowLights,names,fog:{density:scene.fog?.density,color:scene.fog?.color.getHexString()},camera:camera.position.toArray()};document.body.dataset.ready='true';}});return null;}
createRoot(document.getElementById('root')).render(<Canvas dpr={1} camera={{fov:65,near:.05,far:150}} gl={{antialias:true,preserveDrawingBuffer:true}}><color attach='background' args={['#080e11']}/><hemisphereLight args={['#b9c8cf','#30251e',.65]}/><directionalLight position={[-4,8,-5]} color='#c4d0d4' intensity={.65}/><Suspense fallback={null}><Physics paused><Chapter scene={scene} qualityProfile={RENDER_QUALITY_PROFILES[quality]} reducedEffects={reducedEffects} reducedMotion openingResolved={false}/>{which!=='broken'?objectsForScene(sceneId).filter(o=>!['path','water','door','lantern'].includes(o.kind)).map(o=><group key={o.id} position={o.localPosition}><StoryObjectModel kind={o.kind} reducedMotion/></group>):null}</Physics><Light/><Fog/><Evidence/></Suspense></Canvas>);`;
async function capture(which,width,height,quality='low',before=false){
 const ctx=await browser.newContext({viewport:{width,height},deviceScaleFactor:1,reducedMotion:'reduce'}),page=await ctx.newPage(),errors=[];
 const name=`${before?'before':'after'}-${which}-${quality}-${width}`;
 page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 try{await page.goto(`http://127.0.0.1:4184/.environment-review/?case=${which}&quality=${quality}&before=${before?1:0}`,{waitUntil:'domcontentloaded',timeout:45000});await page.locator('body[data-ready="true"]').waitFor({timeout:90000});await page.screenshot({path:`${out}/${name}.png`,timeout:60000});const stats=await page.evaluate(()=>window.__environmentEvidence);if(errors.length)throw new Error(errors.join('\n'));report.captures.push({name,which,width,height,quality,before,scope:'chapter fixture',...stats});}
 catch(e){report.failures.push({name,error:String(e),errors});}finally{await ctx.close();await writeFile(out+'/review.json',JSON.stringify(report,null,2));}
}
async function entry(width,height){const ctx=await browser.newContext({viewport:{width,height},deviceScaleFactor:1,reducedMotion:'no-preference'}),page=await ctx.newPage(),errors=[];const name=`entry-${width}`;page.on('pageerror',e=>errors.push(e.message));
 try{await page.goto('http://127.0.0.1:4183/?accessible=1',{waitUntil:'domcontentloaded'});await page.locator('.onboarding-gate[aria-busy="false"]').waitFor();const button=page.getByRole('button',{name:'Begin',exact:true});await button.waitFor();await page.waitForTimeout(2600);if(await page.locator('#onboarding-title').innerText()!=='SLIPPER IN THE WOODS')throw new Error('Title changed');if(await page.locator('#onboarding-description').innerText()!=='A journey to you.')throw new Error('Subtitle changed');if(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth))throw new Error('Overflow');await page.screenshot({path:`${out}/${name}.png`});await button.click();await page.locator('[data-accessible-journey="true"]').waitFor();if(errors.length)throw new Error(errors.join('\n'));report.captures.push({name,width,height,scope:'production entry',interaction:'Begin opens accessible journey'});}
 catch(e){report.failures.push({name,error:String(e),errors});}finally{await ctx.close();await writeFile(out+'/review.json',JSON.stringify(report,null,2));}}
try{
 await mkdir(out,{recursive:true});await mkdir(fixture,{recursive:true});
 for(const [original,copy] of copies){let text=execFileSync('git',['show',baseline+':'+original],{encoding:'utf8'});if(original.endsWith('BrokenFloorChapter.tsx'))text=text.replace('../storyEvents/WetFloorReveal','../storyEvents/EnvironmentBaselineWetFloorReveal');await writeFile(copy,text);}
 await writeFile(fixture+'/index.html','<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><title>Environment component comparison</title><style>html,body,#root{width:100%;height:100%;margin:0;overflow:hidden}</style></head><body><div id="root"></div><script type="module" src="./stage.tsx"></script></body></html>');await writeFile(fixture+'/stage.tsx',stage);
 await server(['preview'],4183);await server(['--config','vite.config.ts'],4184);
 browser=await chromium.launch({args:['--enable-webgl','--ignore-gpu-blocklist','--use-angle=swiftshader']});
 await entry(1280,800);await entry(390,844);
 for(const which of ['broken','blue','house']){for(const quality of ['low','high']){await capture(which,1100,720,quality,true);await capture(which,1100,720,quality);}await capture(which,390,844);}
 await capture('house-side',1100,720,'low',true);await capture('house-side',1100,720);
 for(const after of report.captures.filter(c=>c.scope==='chapter fixture'&&!c.before&&c.width===1100)){
  const before=report.captures.find(c=>c.which===after.which&&c.quality===after.quality&&c.before);
  if(!before)continue;
  const limit=after.which==='blue'?5:after.which.startsWith('house')?3:1;
  after.delta={calls:after.calls-before.calls,triangles:after.triangles-before.triangles,lights:after.lights-before.lights};
  if(after.delta.calls>limit||after.shadowLights>before.shadowLights||after.delta.lights>0)report.failures.push({name:after.name,error:'Exceeded added draw-call/light/shadow budget',delta:after.delta});
 }
}catch(e){report.failures.push({name:'harness',error:String(e)});}
finally{if(browser)await browser.close();for(const child of processes)child.kill('SIGTERM');await rm(fixture,{recursive:true,force:true});for(const [,copy]of copies)await rm(copy,{force:true});await writeFile(out+'/review.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));if(report.failures.length)process.exitCode=1;}
