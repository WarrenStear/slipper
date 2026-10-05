// Browser regression for scene changes, reflection ownership, quality and stillness.
// Run from the repository root after installing Playwright Chromium.
import { readFile, mkdir, mkdtemp, writeFile, symlink, rm } from 'node:fs/promises';
import { spawn, execFileSync } from 'node:child_process';
import { resolve, join } from 'node:path';
import { tmpdir } from 'node:os';
import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';
const repo=process.cwd(), port=Number(process.env.REVIEW_PORT||4333);
const angle=process.env.REVIEW_ANGLE||'swiftshader';
if(!['swiftshader','metal'].includes(angle))throw Error('REVIEW_ANGLE must be swiftshader or metal');
const fixture=await mkdtemp(join(tmpdir(),'slipper-look-lifecycle-'));
const out=resolve(process.env.REVIEW_OUT||join(tmpdir(),'slipper-look-lifecycle-evidence'));
const baseURL='http://127.0.0.1:'+port;
await mkdir(fixture,{recursive:true});await mkdir(out,{recursive:true});
for(const name of ['src','public','node_modules'])try{await symlink(repo+'/'+name,fixture+'/'+name,'dir');}catch(e){if(e.code!=='EEXIST')throw e;}
await writeFile(fixture+'/index.html','<!doctype html><html><head><title>Scene look lifecycle QA</title><meta name="viewport" content="width=device-width, initial-scale=1"><style>body{margin:0;background:#121a20;color:white;font:14px sans-serif}#controls{position:absolute;top:0;z-index:10}button{padding:8px}#world{height:100vh}</style></head><body><div id="root"></div><script type="module" src="/stage.tsx"></script></body></html>');
const globalLayers=await readFile(new URL('./review-global-layers.txt',import.meta.url),'utf8');
await writeFile(fixture+'/stage.tsx',`
import React,{Suspense,useState,useEffect,useRef,useMemo} from 'react';
import {createRoot} from 'react-dom/client';
import {Canvas,useFrame,useThree} from '@react-three/fiber';
import {Physics} from '@react-three/rapier';
import * as THREE from 'three';
import {StorySceneWithMasterLantern} from './src/components/three/StorySceneWithMasterLantern';
import {SceneLookDirector} from './src/components/three/artDirection/SceneLookDirector';
import {CinematicCameraDirector} from './src/components/three/cinematics/CinematicCameraDirector';
import {useSceneLook} from './src/components/three/artDirection/SceneLookContext';
import {BrokenFloorChapter} from './src/components/three/chapters/BrokenFloorChapter';
import {LanternEpilogueChapter} from './src/components/three/chapters/LanternEpilogueChapter';
import {memoryStarPosition,memoryGroundPosition} from './src/lib/journeyMemoryProjection';
import {publishStorySequencePlayback} from './src/storyEvents/storyEventRuntime';
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

${globalLayers}
const EPILOGUE_ENTRY_ID=contentEntries.find(entry=>getJourneySceneForEntry(entry.id)?.id==='epilogue.constellation').id;
const EPILOGUE_HISTORY=['fragment-001','fragment-060','fragment-040','fragment-060'];
const EPILOGUE_WITNESSED=['fragment-001','fragment-060','fragment-040'];
const REMOVED_FINALE_OBJECTS=['realistic-final-blue-moon','resting-wolf','swan-on-moving-water','quiet-seer','remembered-ember-fire','distant-thorned-house','remembered-fork-landmark','remembered-three-climbs-landmark','protected-nest-child-space','recovered-journey-keys','self-owned-home','returned-self-inside-home','final-cracked-look-back-mirror','constellation-resonance-major-nodes','constellation-protected-nest','constellation-released-words','persistent-world-memory','completed-in-world-constellation'];
function Probe({id,offset,quality,reduced,turning=false,runtime=false}){
 const look=useSceneLook(),{camera,gl,scene}=useThree(),frames=useRef(0);
 const renderer=useMemo(()=>{const context=gl.getContext(),debug=context.getExtension('WEBGL_debug_renderer_info');return context.getParameter(debug?debug.UNMASKED_RENDERER_WEBGL:context.RENDERER);},[gl]);
 useEffect(()=>()=>{delete window.__look;},[]);
 useEffect(()=>{frames.current=0;if(runtime)return;if(id==='epilogue.constellation'){camera.position.set(offset,1.65,6.5);camera.lookAt(0,4.8,-15);}else{camera.position.set(offset,id.startsWith('broken')?2.7:1.65,id.startsWith('broken')?-2:-10);camera.lookAt(0,id.startsWith('broken')?-2:1.7,id.startsWith('broken')?4:5);}camera.updateProjectionMatrix();},[id,offset,quality,reduced,runtime]);
 // Sample after every useFrame subscriber, including dynamically mounted global layers.
 useFrame((_,delta)=>{if(turning&&id==='sunset.stillness'&&!runtime)camera.rotateY(Math.min(.05,delta)*.12);queueMicrotask(()=>{frames.current++;const floor=scene.getObjectByName('wipeable-wet-floor'),mirror=scene.getObjectByName('hero-reflection:mirror'),water=scene.getObjectByName('hero-reflection:moonwater');
 const globalNames=['scene-boundary-veil','scene-breath-field','scene-path-guidance','scene-clearing-breath','master-lantern-flame'];
 const motionObjects=Object.fromEntries(globalNames.map(n=>{const o=scene.getObjectByName(n);return[n,o?[...o.position.toArray(),...o.rotation.toArray().slice(0,3),...o.scale.toArray()]:null]}));
 const opacityObjects=Object.fromEntries(globalNames.map(n=>{const o=scene.getObjectByName(n);let sum=0;o?.traverse(c=>{if(c.material)sum+=c.material.opacity??0;});return[n,sum]}));
 let shadows=0,shafts=0,particleTime=null,particleOpacity=null,particles=0;scene.traverse(o=>{if(o.isLight&&o.castShadow)shadows++;if(o.name==='authored-light-shaft')shafts++;if(o.name.startsWith('scene-particulate:')){particles++;particleTime=o.material.uniforms.time.value;particleOpacity=o.material.uniforms.opacity.value;}});
 let authorities=0;scene.traverse(o=>{if(o.name==='scene-look-authority')authorities++});
 const skin=scene.getObjectByName('stillness-sensitive-mirror-surface'),waterRoute=scene.getObjectByName('reflection-only-water-route'),reverse=scene.getObjectByName('reverse-light-lived-places'),routeLights=scene.getObjectByName('reverse-actual-route-lights');
 const formation=scene.getObjectByName('constellation-formation-reveal'),walkedRoute=scene.getObjectByName('constellation-actual-walked-route'),skyBatches=[];
 formation?.traverse(object=>{if(object.isPoints)skyBatches.push(Array.from(object.geometry.attributes.position.array));});
 const competingFinaleObjects=REMOVED_FINALE_OBJECTS.filter(name=>scene.getObjectByName(name));
 scene.traverse(object=>{if(/^StoryActor:(wolf|swan|seer):/.test(object.name))competingFinaleObjects.push(object.name);});
 const finale={formation:formation?{...formation.userData,visible:formation.visible}:null,skyBatches,routePositions:walkedRoute?Array.from(walkedRoute.geometry.attributes.position.array):null,competingObjects:competingFinaleObjects,completions:window.__finaleCompletions??0,reverseElapsed:routeLights?.material.uniforms.elapsed.value??null};
 window.__look={renderer,finale,turning,stillness:look.stillness,skinDistortion:skin?.material.uniforms.uDistortion.value,waterRouteOpacity:waterRoute?.children[0]?.material.opacity,reverseEntryIds:reverse?.userData.reverseEntryIds,reversePositions:routeLights?Array.from(routeLights.geometry.attributes.position.array):null,semanticMirrorChildren:scene.getObjectByName('story-object:sunset.truth')?.children.length,runtime,authorities,shadows,shafts,particles,particleTime,particleOpacity,opacityObjects,motionObjects,finishing:scene.getObjectByName('scene-finishing-budget')?.userData??null,id,quality,reduced,offset,frames:frames.current,motion:{...look.motion},time:{...look.time},quiet:look.look.stillness,camera:camera.position.toArray(),memory:{...gl.info.memory},programs:gl.info.programs.length,reflection:mirror?.getRenderTarget().width??water?.getRenderTarget().width??0,disturbance:mirror?.material.uniforms.uDisturbance.value,floorDepth:floor?.material.uniforms.hasDepth.value??0,floorTexture:floor?.material.uniforms.liveForest.value.name??'',floorStage:floor?.material.uniforms.stage.value};
 });});return null;
}
function App(){const [runtime,setRuntime]=useState(false),[turning,setTurning]=useState(false);const [quality,setQuality]=useState('high'),[id,setId]=useState('broken-floor.confession'),[offset,setOffset]=useState(0),[reduced,setReduced]=useState(false),[mounted,setMounted]=useState(true);
 const scene=getJourneySceneLayout(id),Chapter=id.startsWith('broken')?BrokenFloorChapter:id.startsWith('sunset')?SunsetSeerChapter:id.startsWith('blue')?BlueMoonSanctuaryChapter:id.startsWith('epilogue')?LanternEpilogueChapter:FireRiverChapter;
 useEffect(()=>{const ending=id==='epilogue.constellation';window.__finaleCompletions=0;
 useJourneyStore.setState({sceneId:id,activeEntryId:ending?EPILOGUE_ENTRY_ID:contentEntries.find(entry=>getJourneySceneForEntry(entry.id)?.id===id).id,storyStarted:true,storyCompleted:false,worldFlags:{'story-events.started':true,'lantern.owned':true,...(ending?{'lantern.placed-and-lit':true}:{})},storyObjectStates:id.startsWith('broken')?{'broken-floor.reflection':'revealed'}:ending?{'lantern.master':'placed','epilogue.reverse-light':'running'}:{'lantern.master':'carried'},history:ending?EPILOGUE_HISTORY:[],witnessedEntryIds:ending?EPILOGUE_WITNESSED:[],completedSceneIds:ending?['broken-floor.confession','blue-moon.sanctuary','sunset.stillness']:[],completedChapterIds:[],completedRitualIds:[],completedStoryEventIds:[],storyPlacementStates:ending?{'lantern.master':'window'}:{}});
 if(ending)publishStorySequencePlayback(id,'epilogue.reverse-light-complete',12000,24000);
 useWorldStore.setState({mode:'explore',controls:'orbit',sceneProximity:{insideClearing:id.startsWith('sunset')}});useSettingsStore.setState({drawerOpen:false,cameraAssistance:false,reducedMotion:false,reducedEffects:reduced});},[id,reduced]);
 return <><div id="controls" data-runtime={String(runtime)} data-offset={offset} data-quality={quality} data-scene={id} data-reduced={String(reduced)}>{['low','medium','high','cinematic'].map(q=><button key={q} onClick={()=>setQuality(q)}>{q}</button>)}<button onClick={()=>setRuntime(v=>!v)}>Runtime</button><button onClick={()=>setOffset(v=>v+1)}>Move sideways</button><button onClick={()=>setId('sunset.stillness')}>Seer</button><button onClick={()=>setTurning(v=>!v)}>Turn camera</button><button onClick={()=>setId('epilogue.constellation')}>Epilogue</button><button onClick={()=>useJourneyStore.setState(state=>({storyObjectStates:{...state.storyObjectStates,'epilogue.reverse-light':'complete'}}))}>Complete reverse reveal</button><button onClick={()=>window.dispatchEvent(new CustomEvent(ASSISTED_STILLNESS_EVENT,{detail:{active:true,ritualId:'ritual.witness-mirror'}}))}>Settle mirror</button><button onClick={()=>setId('blue-moon.sanctuary')}>Blue Moon</button><button onClick={()=>setId('river.release-surrender')}>Surrender</button><button onClick={()=>useJourneyStore.setState(s=>({storyObjectStates:{...s.storyObjectStates,'river.birds':'released','river.white-fabric':'raised'}}))}>Raise cloth</button><button onClick={()=>setReduced(v=>!v)}>Reduce effects</button><button onClick={()=>setMounted(v=>!v)}>Toggle world</button></div><div id="world"><Canvas dpr={1} shadows camera={{fov:65,near:.05,far:180}} gl={{antialias:false,preserveDrawingBuffer:true}} onCreated={({gl})=>{gl.toneMapping=THREE.ACESFilmicToneMapping;gl.outputColorSpace=THREE.SRGBColorSpace;}}><Suspense fallback={null}>{mounted?runtime?<Physics paused><StorySceneWithMasterLantern entryId={contentEntries.find(e=>getJourneySceneForEntry(e.id)?.id===id).id} entries={contentEntries} visuals={[]} controls="none" qualityProfile={RENDER_QUALITY_PROFILES[quality]} reducedEffects={reduced} narrativeAudioSuppressed storyWorldMemory={{sceneId:id,chapterId:getJourneySceneForEntry(contentEntries.find(e=>getJourneySceneForEntry(e.id)?.id===id).id).chapterId,completedRitualIds:['ritual.accept-lantern'],completedActs:[],completedChapterIds:[],completedSceneIds:[],landmarkStates:{},worldFlags:{'lantern.owned':true},resonances:{},inventory:{lantern:true,recoveredKeys:[],symbolicObjects:[]},releasedWords:[],storyStarted:true,storyCompleted:false}}><Probe id={id} offset={offset} quality={quality} reduced={reduced} runtime/></StorySceneWithMasterLantern></Physics>:<SceneLookDirector sceneId={id} quality={quality} reducedMotion={false} reducedEffects={reduced} cameraAssistance={false}><CinematicCameraDirector sceneId={id} reducedMotion={false} cameraAssistance={false}/><ReviewGlobalLayers id={id} quality={quality} reduced={reduced}/><TactileDetailProvider quality={quality} reducedEffects={reduced}><Physics paused><Chapter scene={scene} qualityProfile={RENDER_QUALITY_PROFILES[quality]} reducedEffects={reduced} reducedMotion={false} openingResolved={false} onFinalConstellationFormationComplete={()=>{window.__finaleCompletions=(window.__finaleCompletions??0)+1;}}/></Physics><EnvironmentalChoreography sceneId={id} qualityProfile={RENDER_QUALITY_PROFILES[quality]} reducedEffects={reduced} reducedMotion={false}/><Probe id={id} offset={offset} quality={quality} reduced={reduced} turning={turning}/></TactileDetailProvider></SceneLookDirector>:null}</Suspense></Canvas></div></>;
}
window.__memoryExpected=Array.from(new Float32Array(['fragment-060','fragment-040','fragment-001'].flatMap(memoryGroundPosition)));
window.__skyExpected=Array.from(new Float32Array(EPILOGUE_WITNESSED.flatMap(memoryStarPosition)));
const expectedRoute=[...EPILOGUE_HISTORY,EPILOGUE_ENTRY_ID].map(memoryStarPosition);
window.__routeExpected=Array.from(new Float32Array(expectedRoute.slice(1).flatMap((point,index)=>[...expectedRoute[index],...point])));
createRoot(document.getElementById('root')).render(<App/>);
`);
await writeFile(fixture+'/vite.config.mjs',`export default {root:${JSON.stringify(fixture)},esbuild:{jsx:'automatic'},resolve:{preserveSymlinks:true}};`);
execFileSync(process.execPath,[repo+'/node_modules/vite/bin/vite.js','build','--config',fixture+'/vite.config.mjs','--outDir',fixture+'/dist'],{cwd:fixture,stdio:'pipe',timeout:120000});
const server=spawn(process.execPath,[repo+'/node_modules/vite/bin/vite.js','preview','--config',fixture+'/vite.config.mjs','--host','127.0.0.1','--port',String(port),'--strictPort'],{cwd:fixture,stdio:'pipe'});
let browser;const report={angle,renderer:null,cases:[],errors:[]};
try{
 for(let i=0;i<80;i++){try{if((await fetch(baseURL)).ok)break;}catch{}await new Promise(r=>setTimeout(r,250));}
 browser=await chromium.launch({args:['--enable-webgl','--ignore-gpu-blocklist','--use-angle='+angle]});const page=await browser.newPage({viewport:{width:1100,height:720}});
 page.on('pageerror',e=>report.errors.push(e.message));page.on('console',m=>{if(m.type()==='error')report.errors.push(m.text());});
 await page.goto(baseURL);await page.bringToFront();
 const stable=()=>page.waitForFunction(()=>{const control=document.getElementById('controls'),state=window.__look;return state?.frames>35&&String(state.offset)===control.dataset.offset&&state.quality===control.dataset.quality&&state.id===control.dataset.scene&&String(state.reduced)===control.dataset.reduced&&String(state.runtime)===control.dataset.runtime;},null,{timeout:60000});
 const snap=async name=>{await stable();const data=await page.evaluate(()=>window.__look);report.renderer=data.renderer;report.cases.push({name,...data});console.log(name,JSON.stringify(data));await page.screenshot({path:out+'/lifecycle-'+name+'.png'});return data;};
 let data=await snap('underfloor-high');assert.equal(data.floorDepth,1);assert.equal(data.floorTexture,'bounded-underfloor-world');
 await page.getByText('Move sideways',{exact:true}).click();data=await snap('underfloor-parallax');assert.equal(data.camera[0],1);assert.equal(data.floorDepth,1);
 await page.getByText('cinematic',{exact:true}).click();data=await snap('underfloor-cinematic');assert.equal(data.quality,'cinematic');
 await page.getByText('low',{exact:true}).click();data=await snap('underfloor-low');assert.equal(data.floorDepth,0);
 await page.getByText('medium',{exact:true}).click();data=await snap('underfloor-medium');assert.equal(data.floorDepth,0);
 await page.getByText('Seer',{exact:true}).click();await page.getByText('high',{exact:true}).click();data=await snap('seer-high');assert.equal(data.reflection,384);
 await page.getByText('Turn camera',{exact:true}).click();await page.waitForFunction(()=>window.__look?.turning&&!window.__look.quiet&&window.__look.motion.water>0,null,{timeout:30000});
 const movingSeer=await snap('seer-camera-turn');assert.equal(movingSeer.quiet,false);assert.ok(movingSeer.skinDistortion>0);
 await page.waitForFunction(f=>window.__look.frames>f+170,movingSeer.frames,{timeout:45000});assert.equal((await page.evaluate(()=>window.__look)).quiet,false,'Turning in place must not count as stillness');
 await page.getByText('Turn camera',{exact:true}).click();await page.waitForFunction(()=>window.__look?.quiet&&window.__look.stillness===1&&Object.values(window.__look.motion).every(x=>x===0),null,{timeout:45000});
 const stillSeer=await snap('seer-natural-stillness');assert.equal(stillSeer.disturbance,0);assert.equal(stillSeer.skinDistortion,0);assert.ok(stillSeer.waterRouteOpacity>movingSeer.waterRouteOpacity);
 await page.getByText('Turn camera',{exact:true}).click();await page.waitForFunction(()=>!window.__look.quiet&&window.__look.stillness<.5&&window.__look.disturbance>0,null,{timeout:45000});
 data=await snap('seer-movement-restored');assert.ok(data.motion.water>0&&data.motion.cloth>0);assert.ok(data.skinDistortion>0);assert.ok(data.waterRouteOpacity<stillSeer.waterRouteOpacity);
 await page.getByText('Settle mirror',{exact:true}).click();await page.waitForFunction(()=>window.__look?.quiet&&window.__look.stillness===1&&Object.values(window.__look.motion).every(x=>x===0)&&window.__look.disturbance===0,null,{timeout:45000});data=await snap('seer-settled');assert.equal(data.disturbance,0);
 await page.getByText('Blue Moon',{exact:true}).click();await page.getByText('cinematic',{exact:true}).click();data=await snap('moon-cinematic');assert.equal(data.reflection,768);
 await page.getByText('Reduce effects',{exact:true}).click();data=await snap('moon-reduced');assert.equal(data.reflection,0);assert.equal(data.finishing,null);assert.equal(data.particles,0);assert.equal(data.shafts,0);
 await page.getByText('Reduce effects',{exact:true}).click();await page.getByText('low',{exact:true}).click();await snap('moon-low-warmup');
 const memory=[];for(let i=0;i<3;i++){await page.getByText('cinematic',{exact:true}).click();await stable();await page.getByText('low',{exact:true}).click();await stable();memory.push((await page.evaluate(()=>window.__look)).memory);}
 assert.equal(memory[2].textures,memory[0].textures);assert.equal(memory[2].geometries,memory[0].geometries);report.qualityCycleMemory=memory;
 await page.getByText('Surrender',{exact:true}).click();await page.getByText('high',{exact:true}).click();data=await snap('surrender-before');assert.ok(data.motion.water>0);
 const pressureBefore=data;const camera=data.camera;await page.getByText('Raise cloth',{exact:true}).click();await page.waitForFunction(()=>window.__look?.quiet&&window.__look.stillness===1&&Object.values(window.__look.motion).every(x=>x===0),null,{timeout:45000});data=await snap('surrender-still');assert.deepEqual(data.camera,camera);assert.equal(data.particles,1);
 assert.ok(data.opacityObjects['scene-boundary-veil'] < pressureBefore.opacityObjects['scene-boundary-veil'] * .15, 'boundary pressure fades after Surrender');
 assert.ok(data.opacityObjects['scene-breath-field'] < pressureBefore.opacityObjects['scene-breath-field'] * .1, 'breathing field recedes');
 assert.ok(data.particleOpacity < .001, 'decorative particles become imperceptible');
 const frozen=data;await page.waitForFunction(f=>window.__look.frames>f+40,data.frames,{timeout:30000});data=await snap('surrender-held');assert.deepEqual(data.time,frozen.time);assert.equal(data.particleTime,frozen.particleTime);
 for(const name of ['scene-boundary-veil','scene-breath-field','scene-path-guidance','scene-clearing-breath','master-lantern-flame']){assert.ok(data.motionObjects[name],name+' must be mounted');data.motionObjects[name].forEach((v,i)=>assert.ok(Math.abs(v-frozen.motionObjects[name][i])<.000001,name+' must stop'));}
 await page.getByText('Blue Moon',{exact:true}).click();data=await snap('motion-resumed');assert.ok(data.motion.water>0&&data.time.water>frozen.time.water);assert.ok(data.particleOpacity > .001, "particle visibility restores in the next scene");

 // Reverse geometry is intentionally present only before constellation formation.
 await page.getByText('Epilogue',{exact:true}).click();data=await snap('actual-reverse-geography');
 assert.deepEqual(data.reverseEntryIds,['fragment-060','fragment-040','fragment-001']);assert.equal(data.reversePositions.length,9);
 const expected=await page.evaluate(()=>window.__memoryExpected);assert.deepEqual(data.reversePositions,expected);
 assert.equal(data.finale.reverseElapsed,12000);assert.equal(data.finale.formation.formationReady,false);assert.equal(data.finale.formation.formationComplete,false);assert.equal(data.finale.formation.visible,false);assert.equal(data.finale.completions,0);assert.deepEqual(data.finale.competingObjects,[]);
 await page.getByText('Complete reverse reveal',{exact:true}).click();
 await page.waitForFunction(()=>window.__look?.finale.formation?.formationReady&&window.__look.finale.formation.formationProgress>0&&window.__look.finale.formation.formationComplete===false,null,{timeout:30000});
 // Inspect immediately: snap() deliberately waits for stable lifecycle frames,
 // which could miss the bounded intermediate formation on a fast renderer.
 const forming=await page.evaluate(()=>window.__look);report.cases.push({name:'actual-route-forming',...forming});
 assert.equal(forming.reversePositions,null);assert.equal(forming.finale.completions,0);assert.deepEqual(forming.finale.competingObjects,[]);
 await page.waitForFunction(()=>window.__look?.finale.formation?.formationComplete===true&&window.__look.finale.completions===1,null,{timeout:30000});
 data=await snap('actual-constellation-complete');
 assert.equal(data.reversePositions,null);assert.equal(data.reverseEntryIds,undefined);assert.equal(data.finale.reverseElapsed,null);assert.equal(data.finale.formation.visible,true);assert.ok(data.finale.formation.formationProgress>=.995);assert.equal(data.finale.completions,1);assert.deepEqual(data.finale.competingObjects,[]);
 assert.equal(data.finale.skyBatches.length,2,'only actual witnessed locations and keystone accents become stars');
 assert.deepEqual(data.finale.skyBatches[0],await page.evaluate(()=>window.__skyExpected));
 assert.deepEqual(data.finale.routePositions,await page.evaluate(()=>window.__routeExpected),'actual route preserves repeated crossings and the active final entry');
 await page.waitForFunction(frames=>window.__look.frames>frames+40,data.frames,{timeout:30000});
 assert.equal((await page.evaluate(()=>window.__look)).finale.completions,1,'completed formation must not repeat its handoff');
 await page.getByText('Blue Moon',{exact:true}).click();await stable();
 await page.getByText('Toggle world',{exact:true}).click();await page.waitForFunction(()=>window.__look===undefined);await page.getByText('Toggle world',{exact:true}).click();await snap('remounted');
 await page.getByText('Surrender',{exact:true}).click();await page.getByText('Runtime',{exact:true}).click();data=await snap('canonical-runtime-moving');assert.equal(data.authorities,1);assert.ok(data.motionObjects['master-lantern-flame']);assert.ok(data.motionObjects['scene-boundary-veil']);
 await page.getByText('Raise cloth',{exact:true}).click();await page.waitForFunction(()=>window.__look.quiet&&window.__look.stillness===1&&Object.values(window.__look.motion).every(x=>x===0),null,{timeout:60000});data=await snap('canonical-runtime-still');
 const liveFrozen=data;await page.waitForFunction(f=>window.__look.frames>f+40,data.frames,{timeout:60000});data=await snap('canonical-runtime-held');assert.equal(data.particleTime,liveFrozen.particleTime);assert.deepEqual(data.time,liveFrozen.time);for(const n of ['scene-boundary-veil','scene-breath-field','master-lantern-flame'])assert.deepEqual(data.motionObjects[n],liveFrozen.motionObjects[n]);
 await page.getByText('Seer',{exact:true}).click();data=await snap('canonical-seer-single-mirror');assert.equal(data.reflection,384);assert.equal(data.semanticMirrorChildren,0,'semantic interaction anchor remains without a duplicate mirror model');assert.equal(data.authorities,1);
 await page.getByText('Reduce effects',{exact:true}).click();data=await snap('canonical-seer-reduced');assert.equal(data.reflection,0);assert.equal(data.finishing,null);assert.equal(data.semanticMirrorChildren,0);
 assert.ok(report.cases.every(c=>c.shadows<=1));assert.ok(report.cases.find(c=>c.name==='underfloor-cinematic').finishing.bloomTargets===4);assert.ok(report.cases.find(c=>c.name==='underfloor-high').finishing.method==='fxaa');assert.deepEqual(report.errors,[]);
}finally{await browser?.close();server.kill('SIGTERM');await writeFile(out+'/scene-look-lifecycle.json',JSON.stringify(report,null,2));await rm(fixture,{recursive:true,force:true});}
