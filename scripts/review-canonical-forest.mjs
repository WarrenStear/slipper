import { chromium } from '@playwright/test';
import { createServer } from 'vite';
import react from '@vitejs/plugin-react';
import { mkdir, writeFile, symlink, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

// The actual canonical wrapper, chapter, workers, route planting and far wood.
// Fixed-camera evidence is separate from physical input and hardware FPS tests.
const repo = process.cwd(), source = resolve(process.env.REVIEW_ROOT || repo);
const out = resolve(process.env.REVIEW_OUT || '/private/tmp/slipper-canonical-forest');
const phase = process.env.REVIEW_PHASE || 'before';
const filter = process.env.REVIEW_SHOTS?.split(',');
const angle = process.env.REVIEW_ANGLE || 'swiftshader';
if (!['swiftshader', 'metal'].includes(angle)) throw Error('Invalid REVIEW_ANGLE');
if (!/^[a-z0-9-]+$/.test(phase)) throw Error('Invalid REVIEW_PHASE');
const fixture = resolve(out, 'fixture-' + phase);
await mkdir(fixture, { recursive: true });
await symlink(repo + '/node_modules', fixture + '/node_modules', 'dir').catch(error => { if (error.code !== 'EEXIST') throw error; });
await writeFile(fixture + '/index.html', '<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>html,body,#root{margin:0;width:100%;height:100%;overflow:hidden}</style></head><body><div id="root"></div><script type="module" src="/stage.tsx"></script></body></html>');
await writeFile(fixture + '/stage.tsx', `
import React,{Suspense,useRef,useLayoutEffect,useState,useMemo} from 'react';
import {createRoot} from 'react-dom/client';
import {Canvas,useFrame,useThree} from '@react-three/fiber';
import {Physics} from '@react-three/rapier';
import {StorySceneWithMasterLantern} from '/@fs/${source}/src/components/three/StorySceneWithMasterLantern.tsx';
import {entries,visuals} from '/@fs/${source}/src/data/slipperContent.ts';
import {getJourneyScene} from '/@fs/${source}/src/data/journeyNarrative.ts';
import {getJourneyEntryWorldPosition,getJourneySceneLayout} from '/@fs/${source}/src/data/journeyWorldLayout.ts';
import {SCENE_LOOKS} from '/@fs/${source}/src/components/three/artDirection/SceneLookRegistry.ts';
import {RENDER_QUALITY_PROFILES,resolveEnvironmentalEffectsProfile} from '/@fs/${source}/src/components/three/renderQuality.ts';
import {buildMazePathSegments,curvedPathPointAt} from '/@fs/${source}/src/world/terrain/worldPaths.ts';
import {terrainElevationAtPoint} from '/@fs/${source}/src/world/terrain/terrainSampler.ts';
import {useJourneyStore} from '/@fs/${source}/src/stores/useJourneyStore.ts';
import {useWorldStore} from '/@fs/${source}/src/stores/useWorldStore.ts';
import {useSettingsStore} from '/@fs/${source}/src/stores/useSettingsStore.ts';
const p=new URLSearchParams(location.search),id=p.get('scene')||'enchanted.rabbit-hole',quality=p.get('quality')||'high',view=p.get('view')||'arrival',reduced=p.get('reduced')==='1',motion=p.get('motion')!=='0';
const scene=getJourneyScene(id),layout=getJourneySceneLayout(id),entry=entries.find(e=>e.id===scene.keystoneEntryId),paths=buildMazePathSegments(entries);
const path=paths.find(s=>s.sourceEntry.id===entry.id),target=path?.targetEntry.id||null;
const state={visitedCount:4,totalCount:66,traceCount:0,fireCount:0,waterCount:0,memoryCount:0,thresholdCount:0,crownCount:0,fireWaterBalance:0,explorationDepth:.12,memoryPressure:.05,symbolicWeight:0};
const ground=(x,z)=>-1.255+terrainElevationAtPoint(x,z,entries,paths,state);
const anchor=getJourneyEntryWorldPosition(entry.id),origin=[anchor[0],ground(anchor[0],anchor[2])+.2,anchor[2]],heading=layout.anchor.headingRadians;
const local=v=>[origin[0]+v[0]*Math.cos(heading)+v[2]*Math.sin(heading),origin[1]+v[1],origin[2]-v[0]*Math.sin(heading)+v[2]*Math.cos(heading)];
let at=local([0,1.65,-11]),aim=local(SCENE_LOOKS[id].composition.focalPoint);
if(view==='ground'){at=local([3,1.8,-5]);aim=local([2,.05,2]);}
if(view==='route'&&path){const point=curvedPathPointAt(path,.3,state),ahead=curvedPathPointAt(path,.38,state);at=[point.x,ground(point.x,point.y)+1.7,point.y];aim=[ahead.x,ground(ahead.x,ahead.y)+2.1,ahead.y];}
const inventory={lantern:true,recoveredKeys:[],symbolicObjects:[]},flags={'story-events.started':true,'lantern.owned':true};
useJourneyStore.setState({sceneId:id,activeEntryId:entry.id,storyStarted:true,storyCompleted:false,inventory,worldFlags:flags,storyObjectStates:{'lantern.master':'carried'},completedStoryEventIds:[],witnessedEntryIds:[]});
useWorldStore.setState({mode:'explore',controls:'orbit',physicsPaused:false});
useSettingsStore.setState({reducedEffects:reduced,reducedMotion:!motion,cameraAssistance:false,audioEnabled:false});
const memory={chapterId:scene.chapterId,sceneId:id,completedRitualIds:['ritual.accept-lantern'],completedActs:[],completedSceneIds:[],completedChapterIds:[],landmarkStates:{},worldFlags:flags,resonances:{wolf:0,swan:0,seer:0},inventory,releasedWords:[],storyStarted:true,storyCompleted:false};
function Evidence({reviewQuality}){const {camera,scene:world,gl}=useThree(),frames=useRef(0),stable=useRef(0),captured=useRef(false),samples=useRef([]),draws=useRef({calls:0,triangles:0});
useLayoutEffect(()=>{frames.current=0;stable.current=0;captured.current=false;samples.current=[];delete window.__forestEvidence;delete document.body.dataset.ready;},[reviewQuality]);
useLayoutEffect(()=>{const context=gl.getContext(),originals={};for(const name of ['drawArrays','drawElements','drawArraysInstanced','drawElementsInstanced']){const original=context[name];if(!original)continue;originals[name]=original;context[name]=function(...args){draws.current.calls++;if(args[0]===context.TRIANGLES){const count=name.startsWith('drawArrays')?args[2]:args[1],instances=name.endsWith('Instanced')?args.at(-1):1;draws.current.triangles+=count/3*instances;}return original.apply(this,args);};}return()=>{for(const name in originals)context[name]=originals[name];};},[gl]);
useFrame(()=>{const completedDraws=draws.current;draws.current={calls:0,triangles:0};camera.position.fromArray(at);camera.lookAt(...aim);camera.fov=65;camera.updateProjectionMatrix();let forest=false,terrain=false,far=0,understory=0,morphs=[];
world.traverse(o=>{if(o.isInstancedMesh&&o.instanceMatrix.count===243&&o.instanceMatrix.version>0)forest=true;if(o.isMesh&&o.geometry.attributes.position?.count===16641&&o.geometry.boundingBox?.max.y-o.geometry.boundingBox?.min.y>.001)terrain=true;if(o.name==='world-anchored-distant-woodland')far++;if(o.name==='contextual-path-understory'||o.name==='moonlit-path-understory'||(o.isInstancedMesh&&o.geometry.attributes.position?.count===522&&!o.geometry.index&&[8,16,24,28].includes(o.instanceMatrix.count)))understory++;if(o.isInstancedMesh&&o.morphTexture)morphs.push({name:o.name,capacity:o.morphTexture.image.height,count:o.count});});
stable.current=forest&&terrain?stable.current+1:0;
if(++frames.current>=90&&stable.current>=3&&!captured.current){samples.current.push(completedDraws);if(samples.current.length<8)return;captured.current=true;const costs={calls:Math.max(...samples.current.map(s=>s.calls)),triangles:Math.max(...samples.current.map(s=>s.triangles)),drawSamples:samples.current};let lights=0,authorities=0,shadows=0;world.traverse(o=>{if(o.isLight){lights++;if(o.castShadow)shadows++;}if(o.name==='scene-look-authority')authorities++;});window.__forestEvidence={...costs,geometries:gl.info.memory.geometries,textures:gl.info.memory.textures,programs:gl.info.programs.length,lights,shadows,authorities,far,understory,morphs,workerReady:forest,terrainReady:terrain,camera:camera.position.toArray(),quaternion:camera.quaternion.toArray(),fov:camera.fov,projection:camera.projectionMatrix.toArray()};document.body.dataset.ready='true';}
},-.5);return null;}
function ReviewStage(){const[reviewQuality,setReviewQuality]=useState(quality),profile=useMemo(()=>resolveEnvironmentalEffectsProfile(RENDER_QUALITY_PROFILES[reviewQuality],reduced),[reviewQuality]);window.__setReviewQuality=q=>{delete document.body.dataset.ready;setReviewQuality(q);};return <Canvas dpr={1} camera={{fov:65,near:.12,far:520}} gl={{antialias:false}} shadows={profile.enableMoonShadows?'soft':false}><Suspense fallback={null}><Physics paused><StorySceneWithMasterLantern entryId={entry.id} entries={entries} visuals={visuals} controls='orbit' mode='explore' narrativeWorldState={state} storyWorldMemory={memory} navigationTargetEntryId={target} qualityProfile={profile} reducedEffects={reduced} narrativeAudioSuppressed><Evidence reviewQuality={reviewQuality}/></StorySceneWithMasterLantern></Physics></Suspense></Canvas>;}
createRoot(document.getElementById('root')).render(<ReviewStage/>);
`);
let server, browser;
const report = { source, phase, angle, method: 'Actual canonical wrapper and chapter, both workers ready, fixed camera and 65-degree lens, each cold, alternate-quality and requested-quality stage waits at least 90 frames plus eight consecutive completed GL draw samples. Final comparisons use identically warmed material lifetimes, and cold costs are retained separately. Costs report the peak across the existing reflection cadence. No hardware FPS claim.', captures: [], failures: [] };
if (filter) {
  const previous = JSON.parse(await readFile(resolve(out,phase+'.json'),'utf8'));
  if (previous.source !== source || previous.angle !== angle) throw Error('Filtered capture source mismatch');
  report.captures = previous.captures.filter(c => !filter.includes(c.scene+':'+c.view));
  report.priorFailures = [...(previous.priorFailures || []), ...previous.failures];
}
try {
  server = await createServer({ configFile: false, root: fixture, publicDir: source + '/public', plugins: [react()], server: { host: '127.0.0.1', port: 4224, strictPort: true, hmr: false, fs: { allow: [repo, source, out] } }, resolve: { dedupe: ['react','react-dom','three','@react-three/fiber','@react-three/drei','@react-three/rapier','zustand'] }, optimizeDeps: { noDiscovery: true, entries: [], include: ['react','react-dom/client','three','@react-three/fiber','@react-three/drei','@react-three/rapier','zustand','zustand/middleware'] }, worker: { format: 'es' } });
  await server.listen();
  browser = await chromium.launch({ args: ['--enable-webgl','--ignore-gpu-blocklist','--use-angle=' + angle] });
  const shots = [
    ['enchanted.rabbit-hole','arrival','high',1100,720,false,true],
    ['enchanted.rabbit-hole','route','high',1100,720,false,true],
    ['enchanted.friendship-meadow','ground','high',1100,720,false,true],
    ['blue-moon.sanctuary','route','high',1100,720,false,true],
    ['river.wash','route','high',1100,720,false,true],
    ['fire.boundary','ground','high',1100,720,false,true],
    ['river.wash','ground','high',1100,720,false,true],
    ['crowned.threshold','arrival','high',1100,720,false,true],
    ['enchanted.rabbit-hole','arrival','cinematic',1100,720,false,true],
    ['enchanted.rabbit-hole','arrival','low',393,851,false,true],
    ['enchanted.rabbit-hole','arrival','low',851,393,false,true],
    ['enchanted.rabbit-hole','arrival','high',393,851,true,true],
    ['enchanted.rabbit-hole','arrival','high',1100,720,false,false],
  ];
  for (const [scene,view,quality,width,height,reduced,motion] of shots.filter(s => !filter || filter.includes(s[0]+':'+s[1]))) {
    const name = [phase,scene,view,quality,width,reduced?'reduced':'full',motion?'motion':'still'].join('-');
    const context = await browser.newContext({ viewport: {width,height}, deviceScaleFactor: 1 });
    const page = await context.newPage(), errors = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
    try {
      await page.goto('http://127.0.0.1:4224/?' + new URLSearchParams({scene,view,quality,reduced:String(Number(reduced)),motion:String(Number(motion))}), {waitUntil:'domcontentloaded'});
      await page.bringToFront();
      await page.locator('body[data-ready="true"]').waitFor({timeout:120000});
      const coldMetrics = await page.evaluate(() => window.__forestEvidence);
      for (const warmQuality of [quality === 'low' ? 'high' : 'low', quality]) {
        await page.evaluate(q => window.__setReviewQuality(q), warmQuality);
        await page.locator('body[data-ready="true"]').waitFor({timeout:120000});
      }
      const metrics = await page.evaluate(() => window.__forestEvidence);
      if (errors.length || !metrics?.calls || metrics.authorities !== 1 || metrics.far !== 1 || metrics.understory !== 1 || !metrics.workerReady || !metrics.terrainReady) throw Error(errors.join('\n') || 'Invalid canonical forest');
      if (phase === 'after' && (metrics.morphs.length !== 2 || metrics.morphs.some(m => m.capacity !== 243 || m.count <= 0 || m.count > 243))) throw Error('Invalid canonical forest morph capacity');
      await page.screenshot({path:resolve(out,name+'.png'),timeout:30000});
      report.captures.push({name,scene,view,quality,width,height,reduced,motion,coldMetrics,...metrics});
      console.log(name, JSON.stringify(metrics));
    } catch (error) { report.failures.push({name,error:String(error),errors}); throw error; }
    finally { await context.close(); }
  }
  if (phase === 'after') {
    const reference = JSON.parse(await readFile(resolve(out,'before.json'),'utf8'));
    const key = c => JSON.stringify([c.scene,c.view,c.quality,c.width,c.height,c.reduced,c.motion]);
    report.comparisons = report.captures.map(candidate => {
      const before = reference.captures.find(c => key(c) === key(candidate));
      if (!before) throw Error('Missing paired canonical baseline: '+candidate.name);
      const delta = Object.fromEntries(['calls','triangles','geometries','textures','programs','lights','shadows'].map(k => [k,candidate[k]-before[k]]));
      if (delta.calls > 0 || delta.triangles > 13000 || delta.lights > 0 || delta.shadows > 0 || delta.textures > 4) throw Error('Exceeded canonical forest budget: '+candidate.name+' '+JSON.stringify(delta));
      if (JSON.stringify(candidate.camera) !== JSON.stringify(before.camera) || JSON.stringify(candidate.quaternion) !== JSON.stringify(before.quaternion) || JSON.stringify(candidate.projection) !== JSON.stringify(before.projection)) throw Error('Canonical camera mismatch');
      return {name:candidate.name,delta};
    });
  }
} catch (error) {
  report.failures.push({scope:'review',error:String(error)});
  throw error;
} finally {
  await browser?.close(); await server?.close();
  await writeFile(resolve(out,phase+'.json'),JSON.stringify(report,null,2));
}
