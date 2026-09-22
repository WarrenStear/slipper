// Repeatable chapter art evidence. Use REVIEW_ROOT for an immutable baseline checkout;
// REVIEW_MATRIX=1 checks every tier, reduced effects, portrait and landscape.
import { chromium } from '@playwright/test';
import { resolve, join } from 'node:path';
import { tmpdir } from 'node:os';
import { spawn, execFileSync } from 'node:child_process';
import { mkdir, writeFile, symlink, rm } from 'node:fs/promises';
const dependencyRoot=process.cwd();
const repo=resolve(process.env.REVIEW_ROOT||dependencyRoot), phase=process.env.REVIEW_PHASE||'before', out=process.env.REVIEW_OUT||join(tmpdir(),'slipper-production-art'), port=Number(process.env.REVIEW_PORT||4211);
if(!/^[a-z0-9-]+$/.test(phase))throw Error('REVIEW_PHASE must contain only lowercase letters, numbers and hyphens');
const fixture=join(tmpdir(),'slipper-art-fixture-'+phase);
const names=['BrokenFloor','EnchantedWood','BlueMoonSanctuary','Nest','SunsetSeer','ThornedHouse','Integration','FireRiver','Fork','ThreeClimbs','CrownedReturn','LanternEpilogue'];
const cases={broken:['broken-floor.confession','BrokenFloor'],wood:['enchanted.friendship-meadow','EnchantedWood'],blue:['blue-moon.intimacy','BlueMoonSanctuary'],nest:['nest.protection','Nest'],seer:['sunset.true-mirror','SunsetSeer'],house:['thorned.old-memory-bedroom','ThornedHouse'],integration:['wolf-swan.convergence','Integration'],fire:['fire.boundary','FireRiver'],fork:['fork.weighing','Fork'],climbs:['climb.heart','ThreeClimbs'],crowned:['crowned.home','CrownedReturn'],epilogue:['epilogue.constellation','LanternEpilogue'],finale:['epilogue.constellation','LanternEpilogue'],reveal:['broken-floor.confession','BrokenFloor'],river:['river.release-surrender','FireRiver']};
const imports=names.map(n=>`import {${n}Chapter} from './src/components/three/chapters/${n}Chapter';`).join('\n');
const stage=`import React,{Suspense,useLayoutEffect,useRef} from 'react';
import {createRoot} from 'react-dom/client';import {Canvas,useFrame,useThree} from '@react-three/fiber';import {Physics} from '@react-three/rapier';
import * as THREE from 'three';
${imports}
import {TactileDetailProvider} from './src/components/three/storyEvents/TactileMaterial';
import {CinematicAtmosphereDirector} from './src/components/three/cinematics/CinematicAtmosphereDirector';
import {CinematicLightingDirector} from './src/components/three/cinematics/CinematicLightingDirector';
import {StoryObjectModel} from './src/components/three/storyEvents/StoryObjectModel';
import {journeyChapters,journeyScenes} from './src/data/journeyNarrative';
import {getJourneySceneLayout} from './src/data/journeyWorldLayout';import {objectsForScene} from './src/storyEvents/storyEventRegistry';
import {RENDER_QUALITY_PROFILES} from './src/components/three/renderQuality';
import {useJourneyStore} from './src/stores/useJourneyStore';import {useWorldStore} from './src/stores/useWorldStore';import {useSettingsStore} from './src/stores/useSettingsStore';
import {resolveCinematicProfile} from './src/cinematics/emotionalProfiles';import {advanceCinematicProfile} from './src/cinematics/emotionalCinematography';
const p=new URLSearchParams(location.search),which=p.get('case')||'blue',quality=p.get('quality')||'high',view=p.get('view')||'arrival',reduced=p.get('reduced')==='1';
const cases=${JSON.stringify(cases)};
const [id,key]=cases[which];const Chapter={${names.map(n=>`${n}:${n}Chapter`).join(',')}}[key];
const layout=getJourneySceneLayout(id),profile=resolveCinematicProfile(id,{});
const ending=which==='finale',entries=journeyChapters.flatMap(c=>c.entryIds);
useJourneyStore.setState({sceneId:id,worldFlags:{'story-events.started':true},completedStoryEventIds:which==='reveal'?['broken-floor.first-wipe','broken-floor.forest-revealed']:[],storyObjectStates:ending?{'epilogue.reverse-light':'complete','lantern.master':'placed'}:which==='reveal'?{'broken-floor.reflection':'revealed'}:{},storyPlacementStates:{},history:ending?entries:[],witnessedEntryIds:ending?entries:[],completedSceneIds:ending?journeyScenes.map(s=>s.id):[],completedChapterIds:ending?journeyChapters.map(c=>c.id):[],storyCompleted:ending});
useWorldStore.setState({mode:'explore',controls:'orbit'});useSettingsStore.setState({reducedMotion:true,reducedEffects:reduced,cameraAssistance:false});
for(let i=0;i<300;i++)advanceCinematicProfile(profile,.1);
const cameras={reveal:[[0,1.65,-4],[0,.2,2]],finale:[[0,1.65,6.5],[0,4.8,-15]],broken:[[0,1.65,-4],[0,.2,2]],blue:[[0,1.65,-10],[0,1.5,7]],house:[[.65,1.65,-1.65],[0,1.5,5]],crowned:[[0,1.65,-11],[0,2,4]],epilogue:[[0,1.65,6.5],[0,4.8,-15]]};
function Evidence(){const {camera,scene,gl}=useThree(),frames=useRef(0),times=useRef([]),last=useRef(0);
useLayoutEffect(()=>{let [at,aim]=cameras[which]||[[0,1.65,-11],[0,1.5,4]];if(view==='detail'){at=which==='house'?[.4,1.65,.4]:[3.5,1.65,-2.8];aim=which==='house'?[-3,1.2,1]:[0,1.1,3];}if(view==='departure'){at=which==='house'?[0,1.65,5]:[0,1.65,11];aim=[0,1.4,0];}if(which==='crowned'&&view==='interior'){const g=layout.gateways.find(g=>g.role==='entry'||g.role==='origin');const h=g?Math.atan2(g.position[0]-layout.anchor.position[0],g.position[2]-layout.anchor.position[2])-layout.anchor.headingRadians:Math.PI;const home=v=>[Math.sin(h)*3+v[0]*Math.cos(h)+v[2]*Math.sin(h),v[1],Math.cos(h)*3-v[0]*Math.sin(h)+v[2]*Math.cos(h)];at=home([-2.2,2.2,3.5]);aim=home([.6,1.8,8]);}camera.position.set(...at);camera.lookAt(...aim);camera.updateProjectionMatrix();gl.toneMapping=THREE.ACESFilmicToneMapping;gl.outputColorSpace=THREE.SRGBColorSpace;},[camera]);
useFrame(()=>{const now=performance.now();frames.current++;if(frames.current>25&&last.current)times.current.push(now-last.current);last.current=now;if(frames.current===61){let lights=0,shadows=0,meshes=0;scene.traverse(o=>{if(o.isLight){lights++;if(o.castShadow)shadows++;}if(o.isMesh)meshes++;});const sorted=[...times.current].sort((a,b)=>a-b);window.__artEvidence={calls:gl.info.render.calls,triangles:gl.info.render.triangles,geometries:gl.info.memory.geometries,textures:gl.info.memory.textures,programs:gl.info.programs.length,lights,shadows,meshes,frameMedianMs:sorted[Math.floor(sorted.length*.5)],frameP95Ms:sorted[Math.floor(sorted.length*.95)],camera:camera.position.toArray(),targetScene:id};document.body.dataset.ready='true';}});return null;}
createRoot(document.getElementById('root')).render(<Canvas dpr={1} camera={{fov:65,near:.05,far:180}} gl={{antialias:true,preserveDrawingBuffer:true}}><color attach='background' args={['#10171a']}/><hemisphereLight args={['#b9c8cf','#30251e',.65]}/><directionalLight position={[-4,8,-5]} color='#c4d0d4' intensity={.65}/><Suspense fallback={null}><TactileDetailProvider quality={quality} reducedEffects={reduced}><Physics paused><Chapter scene={layout} qualityProfile={RENDER_QUALITY_PROFILES[quality]} reducedEffects={reduced} reducedMotion openingResolved={false}/>{objectsForScene(id).filter(o=>!['path','water','door','lantern'].includes(o.kind)).map(o=><group key={o.id} position={o.localPosition}><StoryObjectModel kind={o.kind} reducedMotion/></group>)}</Physics><CinematicLightingDirector/><CinematicAtmosphereDirector/><Evidence/></TactileDetailProvider></Suspense></Canvas>);`;
await mkdir(out,{recursive:true});await rm(fixture,{recursive:true,force:true});await mkdir(fixture,{recursive:true});
for(const [src,dst] of [[repo+'/src','src'],[repo+'/public','public'],[dependencyRoot+'/node_modules','node_modules']])try{await symlink(src,fixture+'/'+dst,'dir');}catch(e){if(e.code!=='EEXIST')throw e;}
await writeFile(fixture+'/index.html','<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><title>Production environment comparison</title><style>html,body,#root{width:100%;height:100%;margin:0;overflow:hidden}</style></head><body><div id="root"></div><script type="module" src="/stage.tsx"></script></body></html>');
await writeFile(fixture+'/stage.tsx',stage);
await writeFile(fixture+'/vite.config.mjs',`export default {root:${JSON.stringify(fixture)},cacheDir:${JSON.stringify(fixture+'/cache')},esbuild:{jsx:'automatic',jsxImportSource:'react'},resolve:{preserveSymlinks:true},server:{fs:{allow:${JSON.stringify([repo,fixture,dependencyRoot])}},host:'127.0.0.1',port:${port},strictPort:true},optimizeDeps:{include:['react','react-dom/client','three','@react-three/fiber','@react-three/drei','@react-three/rapier','zustand']}};`);
// Precompile once: per-scene cold dependency discovery must not reload a capture.
execFileSync(process.execPath,[dependencyRoot+'/node_modules/vite/bin/vite.js','build','--config',fixture+'/vite.config.mjs','--outDir',fixture+'/dist','--emptyOutDir'],{cwd:fixture,stdio:'pipe',timeout:120000});
const server=spawn(process.execPath,[dependencyRoot+'/node_modules/vite/bin/vite.js','preview','--config',fixture+'/vite.config.mjs','--host','127.0.0.1','--port',String(port),'--strictPort'],{cwd:fixture,stdio:['ignore','pipe','pipe']});let log='';server.stdout.on('data',b=>log+=b);server.stderr.on('data',b=>log+=b);
const report={phase,root:repo,method:'Precompiled same-camera actual chapter components; 25 warm-up frames then36 frame samples; DPR1, software WebGL. Renderer topology measurements, not physical-device FPS certification.',captures:[],failures:[]};let browser;
try{for(let i=0;i<160;i++){if(server.exitCode!==null)throw Error(log);try{if((await fetch('http://127.0.0.1:'+port)).ok)break;}catch{}await new Promise(r=>setTimeout(r,250));}
browser=await chromium.launch({args:['--enable-webgl','--ignore-gpu-blocklist','--use-angle=swiftshader']});
const selected=(process.env.REVIEW_CASES||'broken,wood,blue,nest,seer,house,integration,fire,fork,climbs,crowned,epilogue').split(',');const views=(process.env.REVIEW_VIEWS||'arrival,detail,departure').split(',');
const mobileVariants=[['low',393,851,true],['low',851,393,true]];
const variants=process.env.REVIEW_MOBILE_ONLY==='1'?mobileVariants:process.env.REVIEW_MATRIX==='1'?[['low',1100,720,false],['medium',1100,720,false],['high',1100,720,false],['cinematic',1100,720,false],['high',1100,720,true],...mobileVariants]:[['high',1100,720,false],mobileVariants[0]];
// A requested single detail/interior view also applies to mobile. The default
// three-view pass keeps one mobile arrival per chapter to bound its duration.
for(const which of selected)for(const [quality,width,height,reduced]of variants)for(const view of (width!==1100&&views.length>1?['arrival']:views)){
 const name=[phase,which,view,quality,width,reduced?'reduced':'full'].join('-'),errors=[];const context=await browser.newContext({viewport:{width,height},deviceScaleFactor:1,reducedMotion:'reduce'});const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 try{await page.goto('http://127.0.0.1:'+port+'/?'+new URLSearchParams({case:which,quality,view,reduced:reduced?'1':'0'}),{waitUntil:'domcontentloaded'});await page.bringToFront();await Promise.race([page.locator('body[data-ready="true"]').waitFor({timeout:60000}),new Promise((_,reject)=>page.once('pageerror',reject))]);await page.screenshot({path:out+'/'+name+'.png',timeout:45000});const metrics=await page.evaluate(()=>window.__artEvidence);if(errors.length||!metrics?.calls)throw Error(errors.join('\n')||'Empty render');report.captures.push({name,which,view,quality,width,height,reduced,...metrics});console.log(name,JSON.stringify(metrics));}catch(e){report.failures.push({name,error:String(e),errors});console.log('FAILED',name,String(e),errors);if(report.failures.length>2)throw e;}finally{await context.close();await writeFile(out+'/'+phase+'.json',JSON.stringify(report,null,2));}
}
}finally{if(browser)await browser.close();server.kill('SIGTERM');await writeFile(out+'/'+phase+'-server.log',log);await rm(fixture,{recursive:true,force:true});await writeFile(out+'/'+phase+'.json',JSON.stringify(report,null,2));console.log(JSON.stringify({captures:report.captures.length,failures:report.failures}));if(report.failures.length)process.exitCode=1;}
