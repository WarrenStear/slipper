// Real StoryScene review; test controls exist only in this disposable fixture.
// Browser plugin unavailable: use the repository's pinned Playwright Chromium.
import { mkdtemp, mkdir, writeFile, symlink, rm, realpath } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { createServer } from 'vite';
import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';

const repo = await realpath(resolve(process.env.REVIEW_ROOT || process.cwd()));
const out = resolve(process.env.REVIEW_OUT || join(tmpdir(), 'slipper-continuous-world'));
const baseline = process.env.REVIEW_BASELINE === '1', angle = process.env.REVIEW_ANGLE || 'metal';
if (!['metal', 'swiftshader'].includes(angle)) throw Error('Unsupported REVIEW_ANGLE');
const fixture = await realpath(await mkdtemp(join(tmpdir(), 'slipper-continuous-stage-')));
await mkdir(out, { recursive: true });
for (const name of ['src', 'node_modules']) await symlink(join(repo, name), join(fixture, name), 'dir');
await writeFile(join(fixture, 'index.html'), '<!doctype html><html><head><title>Slipper in the Woods — art review</title><link rel="icon" href="data:,"><meta name="viewport" content="width=device-width, initial-scale=1"><style>html,body,#root{margin:0;width:100%;height:100%;overflow:hidden;background:#192420}</style></head><body><div id="root"></div><script type="module" src="/stage.tsx"></script></body></html>');
await writeFile(join(fixture, 'stage.tsx'), `
import React,{Suspense,useState,useEffect,useRef} from 'react';
import {createRoot} from 'react-dom/client';
import {Canvas,useThree,useFrame} from '@react-three/fiber';
import {Physics} from '@react-three/rapier';
import * as THREE from 'three';
import {StorySceneWithMasterLantern} from './src/components/three/StorySceneWithMasterLantern';
import {RENDER_QUALITY_PROFILES} from './src/components/three/renderQuality';
import {entries} from './src/data/slipperContent';
import {getJourneySceneForEntry} from './src/data/journeyNarrative';
import {JOURNEY_SCENE_LAYOUTS} from './src/data/journeyWorldLayout';
import {buildMazePathSegments} from './src/world/terrain/worldPaths';
import {terrainElevationAtPoint} from './src/world/terrain/terrainSampler';
import {TERRAIN_BASE_Y} from './src/world/terrain/worldConstants';
import {useJourneyStore} from './src/stores/useJourneyStore';
import {useWorldStore} from './src/stores/useWorldStore';
import {useSettingsStore} from './src/stores/useSettingsStore';
import './src/components/three/StoryScene.css';
const paths=buildMazePathSegments(entries);
const ground=(x,z)=>TERRAIN_BASE_Y+terrainElevationAtPoint(x,z,entries,paths,{});
window.__layouts=JOURNEY_SCENE_LAYOUTS.map(s=>({id:s.id,position:s.anchor.position}));
function Probe(){
 const {camera,scene,gl}=useThree(),frames=useRef(0),samples=useRef([]);
 useEffect(()=>{window.__view=(x,z,tx,tz,height=1.65)=>{window.__pose=[x,ground(x,z)+height,z,tx,ground(tx,tz)+1.8,tz];samples.current=[];};
 window.__sky=()=>{const [x,y,z]=camera.position.toArray();window.__pose=[x,y,z,x+27,y+36,z+91];samples.current=[];};
 window.__state=()=>{const s=useJourneyStore.getState();return {events:s.completedStoryEventIds,scenes:s.completedSceneIds,objects:s.storyObjectStates};};},[]);
 useFrame((_,dt)=>{if(window.__pose){camera.position.set(...window.__pose.slice(0,3));camera.lookAt(...window.__pose.slice(3));}
 samples.current.push(dt*1000);if(samples.current.length>120)samples.current.shift();
 queueMicrotask(()=>{frames.current++;const context=gl.getContext(),debug=context.getExtension('WEBGL_debug_renderer_info');
 const groups=[],worldPositions={},lights=[],lanterns=[],placedLanterns=[];scene.traverse(o=>{if(o.name.startsWith('journey-scene:')){groups.push(o.name.slice(14));worldPositions[o.name.slice(14)]=o.getWorldPosition(new THREE.Vector3()).toArray();}if(o.name.startsWith('MasterPlayerLanternSingleRealistic:'))lanterns.push(camera.worldToLocal(o.getWorldPosition(new THREE.Vector3())).toArray());if(o.userData.objectId==='lantern.master')placedLanterns.push(o.name);if(o.isLight)lights.push({name:o.name,shadow:o.castShadow});});
 const sorted=[...samples.current].sort((a,b)=>a-b);
 window.__snapshot={frames:frames.current,groups,worldPositions,lanterns,placedLanterns,blueMoon:scene.getObjectByName('scene-directed-sky')?.material.uniforms.blueMoon.value,willow:!!scene.getObjectByName('willow-refuge'),camera:camera.position.toArray(),draws:gl.info.render.calls,triangles:gl.info.render.triangles,geometries:gl.info.memory.geometries,textures:gl.info.memory.textures,lights:lights.length,shadowLights:lights.filter(l=>l.shadow).length,p50ms:sorted[Math.floor(sorted.length*.5)],p95ms:sorted[Math.floor(sorted.length*.95)],renderer:context.getParameter(debug?debug.UNMASKED_RENDERER_WEBGL:context.RENDERER),bridge:!!scene.getObjectByName('sanctuary-bridge-support')};});
 },0);return null;
}
function App(){const [id,setId]=useState('enchanted.rabbit-hole'),[quality,setQuality]=useState('high'),[mounted,setMounted]=useState(true),[freeWoods,setFreeWoods]=useState(false),[completed,setCompleted]=useState(false);
 useEffect(()=>{window.__setScene=setId;window.__setQuality=setQuality;window.__mount=setMounted;window.__setFreeWoods=setFreeWoods;window.__endStory=()=>{setCompleted(true);setId('crowned.sovereignty');useJourneyStore.setState({activeSceneId:'crowned.sovereignty',storyObjectStates:{'lantern.master':'placed'},completedRitualIds:['ritual.accept-lantern','ritual.place-lantern']});};
 useJourneyStore.setState({activeSceneId:'enchanted.rabbit-hole',worldFlags:{'story-events.started':true,'lantern.owned':true,'lantern.claimed-and-lit':true},storyObjectStates:{'broken-floor.reflection':'revealed','lantern.master':'carried'},completedStoryEventIds:[],completedSceneIds:[],completedChapterIds:[],completedRitualIds:['ritual.accept-lantern'],storyPlacementStates:{}});
 useWorldStore.setState({mode:'explore',controls:'orbit',physicsPaused:false});useSettingsStore.setState({drawerOpen:false,cameraAssistance:false,reducedMotion:true,showContextualGuidance:false});},[]);
 const entry=entries.find(e=>getJourneySceneForEntry(e.id)?.id===id)||entries[1];
 const memory={sceneId:id,chapterId:getJourneySceneForEntry(entry.id).chapterId,completedRitualIds:['ritual.accept-lantern'],completedActs:[],completedChapterIds:[],completedSceneIds:[],landmarkStates:{},worldFlags:{'lantern.owned':true},resonances:{},inventory:{lantern:true,recoveredKeys:[],symbolicObjects:[]},releasedWords:[],storyStarted:true,storyCompleted:completed};
 return <Canvas dpr={1} shadows camera={{fov:62,near:.05,far:220}} gl={{antialias:true,preserveDrawingBuffer:true}} onCreated={({gl})=>{gl.toneMapping=THREE.ACESFilmicToneMapping;gl.outputColorSpace=THREE.SRGBColorSpace;}}><Suspense fallback={null}><Physics paused>{mounted?<StorySceneWithMasterLantern freeWoods={freeWoods} entryId={entry.id} entries={entries} visuals={[]} controls="none" qualityProfile={RENDER_QUALITY_PROFILES[quality]} reducedEffects={quality==='low'} narrativeAudioSuppressed storyWorldMemory={memory}><Probe/></StorySceneWithMasterLantern>:null}</Physics></Suspense></Canvas>;
}createRoot(document.getElementById('root')).render(<App/>);
`);
let server, browser, page;
const errors = [], shots = [], resources = [];
try {
  server = await createServer({ configFile: false, root: fixture, publicDir: join(repo, 'public'), server: { host: '127.0.0.1', port: Number(process.env.REVIEW_PORT || 4341), hmr: false, watch: null, fs: { allow: [repo, fixture] } }, resolve: { dedupe: ['react', 'react-dom', 'three', '@react-three/fiber'] }, optimizeDeps: { noDiscovery: true, entries: [], include: ['react','react/jsx-dev-runtime','react-dom/client','three','@react-three/fiber','@react-three/drei','@react-three/rapier','zustand','zustand/middleware'] }, worker: { format: 'es' }, esbuild: { jsx: 'automatic' } });
  await server.listen();
  browser = await chromium.launch({ headless: true, channel: "chromium", args: ['--use-angle=' + angle, '--enable-webgl', ...(angle === 'swiftshader' ? ['--enable-unsafe-swiftshader'] : [])] });
  page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  page.on('pageerror', error => { errors.push(String(error)); console.error(error); });
  page.on('console', message => { if (message.type() === 'error') { errors.push(message.text()); console.error(message.text()); } });
  await page.goto(server.resolvedUrls.local[0], { waitUntil: 'networkidle', timeout: 120000 });
  await page.bringToFront();
  await page.waitForFunction(() => window.__snapshot?.frames > 30, null, { timeout: 45000 });
  const initial = await page.evaluate(() => window.__state());
  for (const [name, pose] of [['wood', [-5,-368,-8,-350]], ['willow', [-66,-336,-52,-320]], ['sanctuary-from-wood', [-14,-294,-14,-276]], ['meadow-return', [-18,-331,10,-330]]]) {
    await page.evaluate(pose => window.__view(...pose), pose);
    await page.waitForTimeout(3000);
    await page.screenshot({ path: join(out, name + '.png') });
    const snapshot = await page.evaluate(() => window.__snapshot); shots.push({ name, ...snapshot });
    if (!baseline) { assert.equal(snapshot.lanterns.length,1,'one carried lantern');assert.ok(snapshot.blueMoon>.99,'outdoor blue moon enabled');assert.ok(snapshot.lanterns[0][2]<-.5 && snapshot.lanterns[0][2]>-2,'lantern remains in front of the moving camera'); assert.ok(snapshot.groups.length <= 6); if (name === 'willow') assert.equal(snapshot.willow, true); if (name === 'sanctuary-from-wood') assert.ok(snapshot.groups.includes('blue-moon.sanctuary')); }
  }
  if (!baseline) {
    await page.evaluate(()=>window.__view(-66,-336,-52,-320));await page.waitForTimeout(500);
    await page.evaluate(()=>window.__sky());await page.waitForTimeout(2000);
    await page.screenshot({path:join(out,'twilight-blue-moon.png')});shots.push({name:'twilight-blue-moon',...await page.evaluate(()=>window.__snapshot)});
  }
  assert.deepEqual(await page.evaluate(() => window.__state()), initial, 'Scenery inspection cannot advance or mutate story');
  if (!baseline) {
    if (process.env.REVIEW_QUICK !== '1') for (const quality of ['low','medium','high','cinematic']) {
      await page.evaluate(q=>window.__setQuality(q),quality);await page.waitForTimeout(900);
      for (const layout of await page.evaluate(()=>window.__layouts)) {
        await page.evaluate(p=>window.__view(p[0],p[2]-4,p[0],p[2]+2),layout.position);
        await page.waitForFunction(({id,z})=>window.__snapshot?.groups.includes(id)&&Math.abs(window.__snapshot.camera[2]-z)<.1,{id:layout.id,z:layout.position[2]-4},{timeout:30000});
        const snap=await page.evaluate(()=>window.__snapshot);
        assert.ok(snap.groups.includes(layout.id),quality+': '+layout.id+' physically resident');
        assert.ok(snap.groups.length<=[4,5,6,7][['low','medium','high','cinematic'].indexOf(quality)]);
      }
    }
    assert.deepEqual(await page.evaluate(()=>window.__state()),initial);
    await page.evaluate(()=>window.__setQuality('high'));
    for (let cycle=0;cycle<3;cycle++) {
      for (const pose of [[-5,-368,-8,-350],[-14,-294,-14,-276],[-66,-336,-52,-320]]) {
        await page.evaluate(p=>window.__view(...p),pose);await page.waitForTimeout(1600);
      }
      resources.push(await page.evaluate(()=>({geometries:window.__snapshot.geometries,textures:window.__snapshot.textures,groups:window.__snapshot.groups})));
    }
    assert.ok(resources[2].geometries<=resources[1].geometries+2,'repeat route must not accumulate geometry');
    assert.ok(resources[2].textures<=resources[1].textures+2,'repeat route must not accumulate textures');
    await page.setViewportSize({width:390,height:844});await page.evaluate(()=>{window.__setQuality('low');window.__view(-66,-336,-52,-320)});await page.waitForTimeout(2000);
    await page.screenshot({path:join(out,'willow-mobile-low.png')});shots.push({name:'willow-mobile-low',...await page.evaluate(()=>window.__snapshot)});
    await page.evaluate(()=>{window.__setQuality('high');window.__endStory();const layout=window.__layouts.find(l=>l.id==='crowned.sovereignty');window.__view(layout.position[0],layout.position[2]-4,layout.position[0],layout.position[2]+2)});
    await page.waitForFunction(()=>window.__snapshot?.lanterns.length===0 && window.__snapshot.placedLanterns.length===1,null,{timeout:30000});
    const ending=await page.evaluate(()=>window.__state());
    await page.evaluate(()=>window.__setFreeWoods(true));
    await page.waitForFunction(()=>window.__snapshot?.lanterns.length===1 && window.__snapshot.placedLanterns.length===0,null,{timeout:30000});
    assert.deepEqual(await page.evaluate(()=>window.__state()),ending,'Free Woods carries the lantern without rewriting the placed ending');
    await page.evaluate(()=>window.__view(-66,-336,-52,-320));await page.waitForTimeout(1500);
    assert.equal((await page.evaluate(()=>window.__snapshot)).lanterns.length,1,'Free Woods keeps the carried light on return');
    assert.deepEqual(await page.evaluate(()=>window.__state()),ending);
    await page.screenshot({path:join(out,'free-woods-carried-lantern.png')});
  }
  await writeFile(join(out,'measurements.json'),JSON.stringify({baseline,angle,viewport:{width:1440,height:900,dpr:1},shots,resources,errors},null,2));
  assert.deepEqual(errors,[]);
  console.log(JSON.stringify({out,shots:shots.map(s=>({name:s.name,draws:s.draws,triangles:s.triangles,p50ms:s.p50ms})),errors}));
} catch(error) { if(page) await page.screenshot({path:join(out,"failure.png")}).catch(()=>{}); await writeFile(join(out,"review-failure.json"),JSON.stringify({message:String(error),shots,resources,errors},null,2)); console.error(JSON.stringify({errors})); throw error; } finally { if(browser)await browser.close();if(server)await server.close();await rm(fixture,{recursive:true,force:true}); }
