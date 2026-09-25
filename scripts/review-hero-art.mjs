// Isolated fallback inspection, lit and monochrome, with the same geometry/tier as the world.
// This complements the actual-world capture; its studio lighting is not scene evidence.
import { chromium } from '@playwright/test';
import { mkdtemp, mkdir, symlink, writeFile, rm } from 'node:fs/promises';
import { spawn, execFileSync } from 'node:child_process';
import { resolve, join } from 'node:path';
import { tmpdir } from 'node:os';
import assert from 'node:assert/strict';
const dependencyRoot=process.cwd(),repo=resolve(process.env.REVIEW_ROOT||dependencyRoot);
const phase=process.env.REVIEW_PHASE||'heroes',out=resolve(process.env.REVIEW_OUT||join(tmpdir(),'slipper-hero-art')),port=Number(process.env.REVIEW_PORT||4385);
const angle=process.env.REVIEW_ANGLE||'swiftshader';
if(!['swiftshader','metal'].includes(angle))throw Error('REVIEW_ANGLE must be swiftshader or metal');
const fixture=await mkdtemp(join(tmpdir(),'slipper-hero-art-'));
await mkdir(out,{recursive:true});
for(const [source,name] of [[repo+'/src','src'],[repo+'/public','public'],[dependencyRoot+'/node_modules','node_modules']])await symlink(source,join(fixture,name),'dir');
await writeFile(join(fixture,'index.html'),'<html><head><title>Hero fallback art inspection</title><style>body{margin:0}#root{width:100vw;height:100vh}</style></head><body><div id="root"></div><script type="module" src="/stage.tsx"></script></body></html>');
await writeFile(join(fixture,'stage.tsx'),`
import React,{useLayoutEffect,useRef} from 'react';import {createRoot} from 'react-dom/client';import {Canvas,useFrame,useThree} from '@react-three/fiber';import * as THREE from 'three';
import {LanternProp,KeyProp,ReflectivePanel} from './src/components/three/chapters/ChapterPrimitives';
import {WornSanctuaryBridge} from './src/components/three/chapters/BlueMoonSanctuaryChapter';
import {AuthoredNpcSilhouette} from './src/components/three/environmentArt/AuthoredNpc';
import {TactileDetailProvider} from './src/components/three/storyEvents/TactileMaterial';
import {useSettingsStore} from './src/stores/useSettingsStore';
const p=new URLSearchParams(location.search),kind=p.get('kind'),mono=p.get('mono')==='1',quality=p.get('quality')||'high';
useSettingsStore.setState({reducedMotion:true,reducedEffects:false});
function Probe(){const {camera,scene,gl}=useThree(),frames=useRef(0);
useLayoutEffect(()=>{const animal=kind==='wolf'||kind==='resting-wolf'||kind==='swan';camera.position.set(...(kind==='bridge'?[12,7.5,18]:kind==='mirror'?[4,3.4,7]:animal?[2.6,1.5,3.4]:kind==='key'?[.8,1.7,2.8]:[1.5,1.15,2.5]));camera.lookAt(...(kind==='bridge'?[0,.4,0]:kind==='mirror'?[0,1.8,0]:animal?[0,.64,0]:kind==='key'?[.4,0,0]:[0,.57,0]));camera.updateProjectionMatrix();gl.toneMapping=THREE.ACESFilmicToneMapping;const material=mono?new THREE.MeshBasicMaterial({color:'#bbc1bd'}):null;scene.overrideMaterial=material;return()=>{scene.overrideMaterial=null;material?.dispose();};},[]);
useFrame(()=>{if(++frames.current===25){const context=gl.getContext(),debug=context.getExtension('WEBGL_debug_renderer_info');window.__hero={renderer:debug?context.getParameter(debug.UNMASKED_RENDERER_WEBGL):context.getParameter(context.RENDERER),calls:gl.info.render.calls,triangles:gl.info.render.triangles,geometries:gl.info.memory.geometries,textures:gl.info.memory.textures};document.body.dataset.ready='true';}});return null;}
createRoot(document.getElementById('root')).render(<Canvas dpr={1} camera={{fov:39,near:.05,far:50}} gl={{preserveDrawingBuffer:true}}><color attach="background" args={['#252d31']}/><hemisphereLight args={['#dce3df','#574333',1.4]}/><directionalLight position={[-3,5,3]} intensity={3.2} color="#ead7b5"/><TactileDetailProvider quality={quality} reducedEffects={false}>{kind==='lantern'?<LanternProp position={[0,0,0]} reducedMotion/>:kind==='key'?<KeyProp position={[0,0,0]}/>:kind==='bridge'?<WornSanctuaryBridge/>:kind==='mirror'?<ReflectivePanel position={[0,1.8,0]} size={[2.4,3.6]}/>:<AuthoredNpcSilhouette kind={kind==='swan'?'swan':'wolf'} resting={kind==='resting-wolf'}/>}</TactileDetailProvider><Probe/></Canvas>);
`);
await writeFile(join(fixture,'vite.config.mjs'),`export default {root:${JSON.stringify(fixture)},esbuild:{jsx:'automatic'},resolve:{preserveSymlinks:true}};`);
execFileSync(process.execPath,[dependencyRoot+'/node_modules/vite/bin/vite.js','build','--config',fixture+'/vite.config.mjs','--outDir',fixture+'/dist'],{cwd:fixture,stdio:'pipe',timeout:120000});
const server=spawn(process.execPath,[dependencyRoot+'/node_modules/vite/bin/vite.js','preview','--config',fixture+'/vite.config.mjs','--host','127.0.0.1','--port',String(port),'--strictPort'],{cwd:fixture,stdio:'pipe'});
let browser;const report={angle,method:'Isolated geometry/material inspection with fixed studio lighting; not sustained physical-device performance.',captures:[],errors:[]};
try{
 for(let i=0;i<100;i++){try{if((await fetch('http://127.0.0.1:'+port)).ok)break;}catch{}await new Promise(r=>setTimeout(r,200));}
 browser=await chromium.launch({args:['--enable-webgl','--ignore-gpu-blocklist','--use-angle='+angle]});
 for(const kind of (process.env.REVIEW_HEROES?.split(',')??['lantern','key','wolf','resting-wolf','swan','mirror','bridge']))for(const quality of ['low','high'])for(const mono of [false,true]){
  const page=await browser.newPage({viewport:{width:900,height:700}});page.on('pageerror',e=>report.errors.push(e.message));page.on('console',m=>{if(m.type()==='error')report.errors.push(m.text());});
  await page.goto('http://127.0.0.1:'+port+'/?'+new URLSearchParams({kind,quality,mono:mono?'1':'0'}));await page.waitForFunction(()=>document.body.dataset.ready==='true',null,{timeout:60000});
  const name=[phase,kind,quality,mono?'silhouette':'lit'].join('-');await page.screenshot({path:out+'/'+name+'.png'});const metrics=await page.evaluate(()=>window.__hero);report.captures.push({name,kind,quality,mono,...metrics});console.log(name,JSON.stringify(metrics));await page.close();
 }
 assert.deepEqual(report.errors,[]);
}finally{await browser?.close();server.kill('SIGTERM');await writeFile(out+'/'+phase+'.json',JSON.stringify(report,null,2));await rm(fixture,{recursive:true,force:true});}
