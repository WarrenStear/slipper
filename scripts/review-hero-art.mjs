// Isolated fallback inspection, lit and monochrome, with the same geometry/tier as the world.
// This complements the actual-world capture; its studio lighting is not scene evidence.
import { chromium } from '@playwright/test';
import { mkdtemp, mkdir, symlink, writeFile, readFile, rm } from 'node:fs/promises';
import { spawn, execFileSync } from 'node:child_process';
import { resolve, join } from 'node:path';
import { tmpdir } from 'node:os';
import assert from 'node:assert/strict';
import ts from 'typescript';
const dependencyRoot=process.cwd(),repo=resolve(process.env.REVIEW_ROOT||dependencyRoot);
const phase=process.env.REVIEW_PHASE||'heroes',out=resolve(process.env.REVIEW_OUT||join(tmpdir(),'slipper-hero-art')),port=Number(process.env.REVIEW_PORT||4385);
const angle=process.env.REVIEW_ANGLE||'swiftshader';
const registrySource=await readFile(join(repo,'src/components/three/actors/heroAssetRegistry.ts'),'utf8');
const registryCode=ts.transpileModule(registrySource,{compilerOptions:{module:ts.ModuleKind.ES2022,target:ts.ScriptTarget.ES2022}}).outputText;
const {HERO_ASSETS,productionHeroUrl}=await import('data:text/javascript;base64,'+Buffer.from(registryCode).toString('base64'));
const heroIds={lantern:'master-lantern',key:'key',wolf:'wolf','resting-wolf':'wolf-resting',swan:'swan',mirror:'cracked-mirror',bridge:'moon-bridge','seer-reflection':'seer-reflection',roses:'roses',lilies:'lilies','writing-desk':'writing-desk','reading-chair':'reading-chair',fountain:'fountain'};
assert.deepEqual(Object.values(heroIds).sort(),Object.keys(HERO_ASSETS).sort(),'Every hero registry slot needs one studio selector');
const variants=process.env.REVIEW_MATRIX==='1'?[{name:'desktop-low',quality:'low',width:900,height:700,reduced:false},{name:'desktop-high',quality:'high',width:900,height:700,reduced:false},{name:'desktop-reduced',quality:'high',width:900,height:700,reduced:true},{name:'portrait-low-reduced',quality:'low',width:393,height:851,reduced:true},{name:'landscape-high-reduced',quality:'high',width:851,height:393,reduced:true}]:[{name:'desktop-low',quality:'low',width:900,height:700,reduced:false},{name:'desktop-high',quality:'high',width:900,height:700,reduced:false}];
const selected=process.env.REVIEW_HEROES?.split(',')??Object.keys(heroIds);
for(const kind of selected)if(!heroIds[kind])throw Error('Unknown REVIEW_HEROES entry: '+kind);
if(!['swiftshader','metal'].includes(angle))throw Error('REVIEW_ANGLE must be swiftshader or metal');
const fixture=await mkdtemp(join(tmpdir(),'slipper-hero-art-'));
await mkdir(out,{recursive:true});
for(const [source,name] of [[repo+'/src','src'],[repo+'/public','public'],[dependencyRoot+'/node_modules','node_modules']])await symlink(source,join(fixture,name),'dir');
await writeFile(join(fixture,'index.html'),'<html><head><title>Hero fallback and reviewed art inspection</title><style>body{margin:0}#root{width:100vw;height:100vh}</style></head><body><div id="root"></div><script type="module" src="/stage.tsx"></script></body></html>');
await writeFile(join(fixture,'stage.tsx'),`
import React,{useLayoutEffect,useRef} from 'react';import {createRoot} from 'react-dom/client';import {Canvas,useFrame,useThree} from '@react-three/fiber';import * as THREE from 'three';
import {LanternProp,KeyProp} from './src/components/three/chapters/ChapterPrimitives';
import {WornSanctuaryBridge} from './src/components/three/chapters/BlueMoonSanctuaryChapter';
import {LivingWaterFountain,VelvetReadingNook} from './src/components/three/chapters/CrownedReturnChapter';
import {WritingDesk} from './src/components/three/chapters/ChapterArt';
import {BotanicalCluster} from './src/components/three/environmentArt/EnvironmentArt';
import {ReflectionApparition} from './src/components/three/reflections/ReflectionApparition';
import {ReflectionDirector} from './src/components/three/reflections/ReflectionDirector';
import {RENDER_QUALITY_PROFILES} from './src/components/three/renderQuality';
import {SceneLookContext,type ScenePresentation} from './src/components/three/artDirection/SceneLookContext';
import {resolveSceneLook} from './src/components/three/artDirection/SceneLookRegistry';
import {AuthoredNpcSilhouette} from './src/components/three/environmentArt/AuthoredNpc';
import {TactileDetailProvider} from './src/components/three/storyEvents/TactileMaterial';
import {useSettingsStore} from './src/stores/useSettingsStore';
import {HeroAssetSlot} from './src/components/three/actors/HeroAssetSlot';
import {HERO_ASSETS,type HeroAssetId} from './src/components/three/actors/heroAssetRegistry';
declare global {interface Window {__hero?: {mode:string;production:Record<string,unknown>|null;renderer:string;calls:number;triangles:number;geometries:number;textures:number}}}
const p=new URLSearchParams(location.search),kind=p.get('kind')||'lantern',mono=p.get('mono')==='1',quality=p.get('quality')||'high',reduced=p.get('reduced')==='1',mode=p.get('mode')||'fallback';
const ids:Record<string,HeroAssetId>=${JSON.stringify(heroIds)};const id=ids[kind];
for(const key of Object.keys(HERO_ASSETS) as HeroAssetId[])if(mode==='fallback'||key!==id)HERO_ASSETS[key]={...HERO_ASSETS[key],status:'authored-fallback'};
const reviewQuality=quality==='low'?'low':'high';
const mirrorLook=resolveSceneLook('sunset.true-mirror',reviewQuality,reduced);
const mirrorPresentation:ScenePresentation={look:mirrorLook,reducedMotion:true,reducedEffects:reduced,stillness:0,motion:{vegetation:0,cloth:0,water:0,particles:0,flame:0},time:{vegetation:0,cloth:0,water:0,particles:0,flame:0}};
useSettingsStore.setState({reducedMotion:true,reducedEffects:reduced});
function Probe(){const {camera,scene,gl}=useThree(),frames=useRef(0);
useLayoutEffect(()=>{const animal=kind==='wolf'||kind==='resting-wolf'||kind==='swan';const additions:Record<string,[[number,number,number],[number,number,number]]>={
 mirror:[[7.2,5.8,13],[0,3.18,0]],
 'seer-reflection':[[.45,1.05,3.8],[0,.88,0]],
 roses:[[.85,.7,1.25],[0,.26,0]],
 lilies:[[1,.85,1.3],[0,.055,0]],
 'writing-desk':[[3.9,2.65,5.4],[0,.5,0]],
 'reading-chair':[[4,2.65,-5.5],[.15,.67,0]],
 fountain:[[3.5,2.8,4.7],[0,.5,0]],
};const extra=additions[kind];const position:[number,number,number]=extra?.[0]??(kind==='bridge'?[12,7.5,18]:animal?[2.6,1.5,3.4]:kind==='key'?[.8,1.7,2.8]:[1.5,1.15,2.5]);camera.position.set(...position);const aim=new THREE.Vector3(...(extra?.[1]??(kind==='bridge'?[0,.4,0]:animal?[0,.64,0]:kind==='key'?[.4,0,0]:[0,.57,0])));if(extra&&camera instanceof THREE.PerspectiveCamera)camera.position.sub(aim).multiplyScalar(Math.max(1,.8/camera.aspect)).add(aim);camera.lookAt(aim);camera.updateProjectionMatrix();gl.toneMapping=THREE.ACESFilmicToneMapping;const material=mono?new THREE.MeshBasicMaterial({color:'#bbc1bd'}):null;scene.overrideMaterial=material;return()=>{scene.overrideMaterial=null;material?.dispose();};},[]);
useFrame(()=>{let production:Record<string,unknown>|null=null;scene.traverse(object=>{if(object.userData.reviewedHero?.id===id)production=object.userData.reviewedHero;});if(++frames.current>=25&&!window.__hero&&(mode==='fallback'||production)){const context=gl.getContext(),debug=context.getExtension('WEBGL_debug_renderer_info');window.__hero={mode,production,renderer:debug?context.getParameter(debug.UNMASKED_RENDERER_WEBGL):context.getParameter(context.RENDERER),calls:gl.info.render.calls,triangles:gl.info.render.triangles,geometries:gl.info.memory.geometries,textures:gl.info.memory.textures};document.body.dataset.ready='true';}});return null;}
const fallback=kind==='bridge'?<WornSanctuaryBridge/>:<AuthoredNpcSilhouette kind={kind==='swan'?'swan':'wolf'} resting={kind==='resting-wolf'}/>;
function StudioHero(){
 if(kind==='lantern')return <LanternProp position={[0,0,0]} reducedMotion/>;
 if(kind==='key')return <KeyProp position={[0,0,0]}/>;
 if(kind==='mirror')return <SceneLookContext.Provider value={mirrorPresentation}><group position={[0,3.18,0]} rotation={[0,-Math.PI,0]}><group position={[0,-3.15,-5.4]}><ReflectionDirector sceneId="sunset.true-mirror" qualityProfile={RENDER_QUALITY_PROFILES[reviewQuality]} reducedEffects={reduced} reducedMotion/></group></group></SceneLookContext.Provider>;
 if(kind==='seer-reflection')return <ReflectionApparition apparition/>;
 if(kind==='roses')return <BotanicalCluster kind="rose" seed={41} color="#b49391"/>;
 if(kind==='lilies')return <BotanicalCluster kind="lily" seed={23}/>;
 if(kind==='writing-desk')return <group position={[0,.78,0]}><WritingDesk/></group>;
 // Cancel only chapter placement; retain the actual water and companion props outside their slots.
 if(kind==='fountain')return <group position={[3.7,-.08,-4.9]}><LivingWaterFountain reducedEffects={reduced}/></group>;
 if(kind==='reading-chair')return <group rotation={[0,-.16,0]}><group position={[4.7,-.06,-8.3]}><VelvetReadingNook/></group></group>;
 return <HeroAssetSlot id={id}>{fallback}</HeroAssetSlot>;
}
createRoot(document.getElementById('root')!).render(<Canvas dpr={1} camera={{fov:39,near:.05,far:50}} gl={{preserveDrawingBuffer:true}}><color attach="background" args={['#252d31']}/><hemisphereLight args={['#dce3df','#574333',1.4]}/><directionalLight position={[-3,5,3]} intensity={3.2} color="#ead7b5"/><TactileDetailProvider quality={quality} reducedEffects={reduced}><StudioHero/></TactileDetailProvider><Probe/></Canvas>);
`);
await writeFile(join(fixture,'vite.config.mjs'),`export default {root:${JSON.stringify(fixture)},esbuild:{jsx:'automatic'},resolve:{preserveSymlinks:true}};`);
execFileSync(process.execPath,[dependencyRoot+'/node_modules/vite/bin/vite.js','build','--config',fixture+'/vite.config.mjs','--outDir',fixture+'/dist'],{cwd:fixture,stdio:'pipe',timeout:120000});
const server=spawn(process.execPath,[dependencyRoot+'/node_modules/vite/bin/vite.js','preview','--config',fixture+'/vite.config.mjs','--host','127.0.0.1','--port',String(port),'--strictPort'],{cwd:fixture,stdio:'pipe'});
let browser;const report={angle,method:'Matched fallback/registered-production inspection under fixed studio lighting. Production is captured only for an admitted registry entry and must actually mount. No synthetic asset is registered here. Isolated review is not actual-scene, sustained performance or physical-device evidence.',unavailable:selected.filter(kind=>!productionHeroUrl(HERO_ASSETS[heroIds[kind]])).map(kind=>({kind,id:heroIds[kind],reason:'No admitted reviewed production asset; production comparison unavailable'})),captures:[],errors:[]};
try{
 for(let i=0;i<100;i++){try{if((await fetch('http://127.0.0.1:'+port)).ok)break;}catch{}await new Promise(r=>setTimeout(r,200));}
 browser=await chromium.launch({args:['--enable-webgl','--ignore-gpu-blocklist','--use-angle='+angle]});
 for(const kind of selected)for(const variant of variants)for(const mono of [false,true])for(const mode of productionHeroUrl(HERO_ASSETS[heroIds[kind]])?['fallback','production']:['fallback']){
  const {quality,width,height,reduced}=variant;
  const page=await browser.newPage({viewport:{width,height}});page.on('pageerror',e=>report.errors.push(e.message));page.on('console',m=>{if(m.type()==='error')report.errors.push(m.text());});
  await page.goto('http://127.0.0.1:'+port+'/?'+new URLSearchParams({kind,quality,mono:mono?'1':'0',reduced:reduced?'1':'0',mode}));await page.waitForFunction(()=>document.body.dataset.ready==='true',null,{timeout:60000});
  const name=[phase,kind,variant.name,mono?'silhouette':'lit',mode].join('-');await page.screenshot({path:out+'/'+name+'.png'});const metrics=await page.evaluate(()=>window.__hero);if(mode==='production')assert.equal(metrics.production?.id,heroIds[kind]);report.captures.push({name,kind,quality,mono,width,height,reduced,...metrics});console.log(name,JSON.stringify(metrics));await page.close();
 }
 assert.deepEqual(report.errors,[]);
}finally{await browser?.close();server.kill('SIGTERM');await writeFile(out+'/'+phase+'.json',JSON.stringify(report,null,2));await rm(fixture,{recursive:true,force:true});}
