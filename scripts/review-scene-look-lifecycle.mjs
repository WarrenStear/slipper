// Browser regression for scene changes, reflection ownership, quality and stillness.
// Run from the repository root after installing Playwright Chromium.
import { mkdir, mkdtemp, writeFile, symlink, rm } from 'node:fs/promises';
import { spawn, execFileSync } from 'node:child_process';
import { resolve, join } from 'node:path';
import { tmpdir } from 'node:os';
import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';
const repo=process.cwd(), port=Number(process.env.REVIEW_PORT||4333);
const fixture=await mkdtemp(join(tmpdir(),'slipper-look-lifecycle-'));
const out=resolve(process.env.REVIEW_OUT||join(tmpdir(),'slipper-look-lifecycle-evidence'));
const baseURL='http://127.0.0.1:'+port;
await mkdir(fixture,{recursive:true});await mkdir(out,{recursive:true});
for(const name of ['src','public','node_modules'])try{await symlink(repo+'/'+name,fixture+'/'+name,'dir');}catch(e){if(e.code!=='EEXIST')throw e;}
await writeFile(fixture+'/index.html','<!doctype html><html><head><title>Scene look lifecycle QA</title><meta name="viewport" content="width=device-width, initial-scale=1"><style>body{margin:0;background:#121a20;color:white;font:14px sans-serif}#controls{position:absolute;top:0;z-index:10}button{padding:8px}#world{height:100vh}</style></head><body><div id="root"></div><script type="module" src="/stage.tsx"></script></body></html>');
await writeFile(fixture+'/stage.tsx',`
import React,{Suspense,useState,useEffect,useRef} from 'react';
import {createRoot} from 'react-dom/client';
import {Canvas,useFrame,useThree} from '@react-three/fiber';
import {Physics} from '@react-three/rapier';
import * as THREE from 'three';
import {SceneLookDirector} from './src/components/three/artDirection/SceneLookDirector';
import {useSceneLook} from './src/components/three/artDirection/SceneLookContext';
import {BrokenFloorChapter} from './src/components/three/chapters/BrokenFloorChapter';
import {SunsetSeerChapter} from './src/components/three/chapters/SunsetSeerChapter';
import {FireRiverChapter} from './src/components/three/chapters/FireRiverChapter';
import {BlueMoonSanctuaryChapter} from './src/components/three/chapters/BlueMoonSanctuaryChapter';
import {EnvironmentalChoreography} from './src/components/three/storyEvents/EnvironmentalChoreography';
import {TactileDetailProvider} from './src/components/three/storyEvents/TactileMaterial';
import {RENDER_QUALITY_PROFILES} from './src/components/three/renderQuality';
import {getJourneySceneLayout} from './src/data/journeyWorldLayout';
import {useJourneyStore} from './src/stores/useJourneyStore';
import {useWorldStore} from './src/stores/useWorldStore';
import {useSettingsStore} from './src/stores/useSettingsStore';
import {ASSISTED_STILLNESS_EVENT} from './src/components/three/rituals/RitualInteraction';

function Probe({id,offset,quality,reduced}){
 const look=useSceneLook(),{camera,gl,scene}=useThree(),frames=useRef(0);
 useEffect(()=>()=>{delete window.__look;},[]);
 useEffect(()=>{frames.current=0;camera.position.set(offset,id.startsWith('broken')?2.7:1.65,id.startsWith('broken')?-2:-10);camera.lookAt(0,id.startsWith('broken')?-2:1.7,id.startsWith('broken')?4:5);camera.updateProjectionMatrix();},[id,offset,quality,reduced]);
 useFrame(()=>{frames.current++;const floor=scene.getObjectByName('wipeable-wet-floor'),mirror=scene.getObjectByName('hero-reflection:mirror'),water=scene.getObjectByName('hero-reflection:moonwater');
 window.__look={id,quality,reduced,offset,frames:frames.current,motion:{...look.motion},time:{...look.time},quiet:look.look.stillness,camera:camera.position.toArray(),memory:{...gl.info.memory},programs:gl.info.programs.length,reflection:mirror?.getRenderTarget().width??water?.getRenderTarget().width??0,disturbance:mirror?.material.uniforms.uDisturbance.value,floorDepth:floor?.material.uniforms.hasDepth.value??0,floorTexture:floor?.material.uniforms.liveForest.value.name??'',floorStage:floor?.material.uniforms.stage.value};
 });return null;
}
function App(){const [quality,setQuality]=useState('high'),[id,setId]=useState('broken-floor.confession'),[offset,setOffset]=useState(0),[reduced,setReduced]=useState(false),[mounted,setMounted]=useState(true);
 const scene=getJourneySceneLayout(id),Chapter=id.startsWith('broken')?BrokenFloorChapter:id.startsWith('sunset')?SunsetSeerChapter:id.startsWith('blue')?BlueMoonSanctuaryChapter:FireRiverChapter;
 useEffect(()=>{useJourneyStore.setState({sceneId:id,worldFlags:{'story-events.started':true},storyObjectStates:id.startsWith('broken')?{'broken-floor.reflection':'revealed'}:{},completedStoryEventIds:[],storyPlacementStates:{}});useWorldStore.setState({mode:'explore',controls:'orbit',sceneProximity:{insideClearing:false}});useSettingsStore.setState({drawerOpen:false,cameraAssistance:false,reducedMotion:false,reducedEffects:reduced});},[id,reduced]);
 return <><div id="controls" data-offset={offset} data-quality={quality} data-scene={id} data-reduced={String(reduced)}>{['low','medium','high','cinematic'].map(q=><button key={q} onClick={()=>setQuality(q)}>{q}</button>)}<button onClick={()=>setOffset(v=>v+1)}>Move sideways</button><button onClick={()=>setId('sunset.stillness')}>Seer</button><button onClick={()=>window.dispatchEvent(new CustomEvent(ASSISTED_STILLNESS_EVENT,{detail:{active:true,ritualId:'ritual.witness-mirror'}}))}>Settle mirror</button><button onClick={()=>setId('blue-moon.sanctuary')}>Blue Moon</button><button onClick={()=>setId('river.release-surrender')}>Surrender</button><button onClick={()=>useJourneyStore.setState(s=>({storyObjectStates:{...s.storyObjectStates,'river.white-fabric':'raised'}}))}>Raise cloth</button><button onClick={()=>setReduced(v=>!v)}>Reduce effects</button><button onClick={()=>setMounted(v=>!v)}>Toggle world</button></div><div id="world"><Canvas dpr={1} shadows camera={{fov:65,near:.05,far:180}} gl={{antialias:true,preserveDrawingBuffer:true}} onCreated={({gl})=>{gl.toneMapping=THREE.ACESFilmicToneMapping;gl.outputColorSpace=THREE.SRGBColorSpace;}}><Suspense fallback={null}>{mounted?<SceneLookDirector sceneId={id} quality={quality} reducedMotion={false} reducedEffects={reduced} cameraAssistance={false}><TactileDetailProvider quality={quality} reducedEffects={reduced}><Physics paused><Chapter scene={scene} qualityProfile={RENDER_QUALITY_PROFILES[quality]} reducedEffects={reduced} reducedMotion={false} openingResolved={false}/></Physics><EnvironmentalChoreography sceneId={id} qualityProfile={RENDER_QUALITY_PROFILES[quality]} reducedEffects={reduced} reducedMotion={false}/><Probe id={id} offset={offset} quality={quality} reduced={reduced}/></TactileDetailProvider></SceneLookDirector>:null}</Suspense></Canvas></div></>;
}
createRoot(document.getElementById('root')).render(<App/>);
`);
await writeFile(fixture+'/vite.config.mjs',`export default {root:${JSON.stringify(fixture)},esbuild:{jsx:'automatic'},resolve:{preserveSymlinks:true}};`);
execFileSync(process.execPath,[repo+'/node_modules/vite/bin/vite.js','build','--config',fixture+'/vite.config.mjs','--outDir',fixture+'/dist'],{cwd:fixture,stdio:'pipe',timeout:120000});
const server=spawn(process.execPath,[repo+'/node_modules/vite/bin/vite.js','preview','--config',fixture+'/vite.config.mjs','--host','127.0.0.1','--port',String(port),'--strictPort'],{cwd:fixture,stdio:'pipe'});
let browser;const report={cases:[],errors:[]};
try{
 for(let i=0;i<80;i++){try{if((await fetch(baseURL)).ok)break;}catch{}await new Promise(r=>setTimeout(r,250));}
 browser=await chromium.launch({args:['--enable-webgl','--ignore-gpu-blocklist','--use-angle=swiftshader']});const page=await browser.newPage({viewport:{width:1100,height:720}});
 page.on('pageerror',e=>report.errors.push(e.message));page.on('console',m=>{if(m.type()==='error')report.errors.push(m.text());});
 await page.goto(baseURL);await page.bringToFront();
 const stable=()=>page.waitForFunction(()=>{const control=document.getElementById('controls'),state=window.__look;return state?.frames>35&&String(state.offset)===control.dataset.offset&&state.quality===control.dataset.quality&&state.id===control.dataset.scene&&String(state.reduced)===control.dataset.reduced;},null,{timeout:60000});
 const snap=async name=>{await stable();const data=await page.evaluate(()=>window.__look);report.cases.push({name,...data});console.log(name,JSON.stringify(data));await page.screenshot({path:out+'/lifecycle-'+name+'.png'});return data;};
 let data=await snap('underfloor-high');assert.equal(data.floorDepth,1);assert.equal(data.floorTexture,'bounded-underfloor-world');
 await page.getByText('Move sideways',{exact:true}).click();data=await snap('underfloor-parallax');assert.equal(data.camera[0],1);assert.equal(data.floorDepth,1);
 await page.getByText('cinematic',{exact:true}).click();data=await snap('underfloor-cinematic');assert.equal(data.quality,'cinematic');
 await page.getByText('low',{exact:true}).click();data=await snap('underfloor-low');assert.equal(data.floorDepth,0);
 await page.getByText('medium',{exact:true}).click();data=await snap('underfloor-medium');assert.equal(data.floorDepth,0);
 await page.getByText('Seer',{exact:true}).click();await page.getByText('high',{exact:true}).click();data=await snap('seer-high');assert.equal(data.reflection,384);
 await page.getByText('Settle mirror',{exact:true}).click();await page.waitForFunction(()=>window.__look?.quiet&&Object.values(window.__look.motion).every(x=>x===0)&&window.__look.disturbance<.0002,null,{timeout:45000});data=await snap('seer-settled');assert.ok(data.disturbance<.0002);
 await page.getByText('Blue Moon',{exact:true}).click();await page.getByText('cinematic',{exact:true}).click();data=await snap('moon-cinematic');assert.equal(data.reflection,768);
 await page.getByText('Reduce effects',{exact:true}).click();data=await snap('moon-reduced');assert.equal(data.reflection,0);
 await page.getByText('Reduce effects',{exact:true}).click();await page.getByText('low',{exact:true}).click();await snap('moon-low-warmup');
 const memory=[];for(let i=0;i<3;i++){await page.getByText('cinematic',{exact:true}).click();await stable();await page.getByText('low',{exact:true}).click();await stable();memory.push((await page.evaluate(()=>window.__look)).memory);}
 assert.equal(memory[2].textures,memory[0].textures);assert.equal(memory[2].geometries,memory[0].geometries);report.qualityCycleMemory=memory;
 await page.getByText('Surrender',{exact:true}).click();await page.getByText('high',{exact:true}).click();data=await snap('surrender-before');assert.ok(data.motion.water>0);
 const camera=data.camera;await page.getByText('Raise cloth',{exact:true}).click();await page.waitForFunction(()=>window.__look?.quiet&&Object.values(window.__look.motion).every(x=>x===0),null,{timeout:45000});data=await snap('surrender-still');assert.deepEqual(data.camera,camera);
 await page.getByText('Toggle world',{exact:true}).click();await page.waitForFunction(()=>window.__look===undefined);await page.getByText('Toggle world',{exact:true}).click();await snap('remounted');
 assert.deepEqual(report.errors,[]);
}finally{await browser?.close();server.kill('SIGTERM');await writeFile(out+'/scene-look-lifecycle.json',JSON.stringify(report,null,2));await rm(fixture,{recursive:true,force:true});}
