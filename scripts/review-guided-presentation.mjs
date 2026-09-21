import { chromium, expect } from '@playwright/test';
import { createServer } from 'vite';
import { execFileSync } from 'node:child_process';
import { mkdir, writeFile, rm } from 'node:fs/promises';

const root = process.cwd();
const fixture = '.guided-story-review';
const out = '/tmp/slipper-guided-presentation';
const report = { candidate: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
  method: 'Actual guide, transition and 3D event components in a seeded review fixture. Separate built-app tests earn the opening and text-route continuation. No unassisted full-journey or real-device qualification.', captures: [], checks: [], failures: [] };
let server, browser;
const stage = `import React,{Suspense,useState,useLayoutEffect} from 'react';
import {createRoot} from 'react-dom/client';
import {Canvas,useThree} from '@react-three/fiber';
import {Physics} from '@react-three/rapier';
import GuidedStoryMoment from '../src/components/ui/GuidedStoryMoment';
import StoryTransitionDirector from '../src/components/three/journey/StoryTransitionDirector';
import {BlueMoonSanctuaryChapter} from '../src/components/three/chapters/BlueMoonSanctuaryChapter';
import {StoryEventDirector} from '../src/components/three/storyEvents/StoryEventDirector';
import {getJourneyScene,getJourneyChapter} from '../src/data/journeyNarrative';
import {getJourneySceneLayout} from '../src/data/journeyWorldLayout';
import {RENDER_QUALITY_PROFILES} from '../src/components/three/renderQuality';
import {useJourneyStore} from '../src/stores/useJourneyStore';
import {useWorldStore} from '../src/stores/useWorldStore';
import {useSettingsStore} from '../src/stores/useSettingsStore';
const transitionMode=new URLSearchParams(location.search).get('case')==='transition';
const blue=getJourneyScene('blue-moon.sanctuary');
useJourneyStore.setState({sceneId:blue.id,chapterId:blue.chapterId,activeEntryId:blue.keystoneEntryId,storyStarted:true,storyCompleted:false,completedSceneIds:[],completedStoryEventIds:[],worldFlags:{'story-events.started':true},storyObjectStates:{},storyPlacementStates:{}});
useSettingsStore.setState({drawerOpen:false,showContextualGuidance:true,reducedMotion:false});
useWorldStore.setState({mode:'explore',controls:'walk',physicsPaused:false});
function View({near}){const {camera}=useThree();useLayoutEffect(()=>{camera.position.set(...(near?[-3,1.4,-3]:[0,3.2,-10]));camera.lookAt(...(near?[-3,.7,-1.5]:[0,2.4,7]));camera.updateProjectionMatrix();},[camera,near]);return null;}
function App(){const [near,setNear]=useState(false),[phase,setPhase]=useState('arrival'),[suppressed,setSuppressed]=useState(false),[complete,setComplete]=useState(false),[guideSuspended,setGuideSuspended]=useState(false);
 const id=useJourneyStore(s=>s.sceneId),settings=useSettingsStore(s=>s.drawerOpen);
 const scene=getJourneyScene(id),chapter=getJourneyChapter(scene.chapterId);
 return <main className='app-shell is-first-journey' data-review-phase={phase} data-review-scene={id}>
 <nav aria-label='Fixture controls' style={{position:'fixed',right:8,bottom:8,zIndex:70,display:'flex',gap:4,background:'#111',padding:6}}>
 <button onClick={()=>useSettingsStore.setState({drawerOpen:!settings})}>{settings?'Close settings':'Open settings'}</button>
 {transitionMode?<><button onClick={()=>setSuppressed(v=>!v)}>{suppressed?'Resume reading':'Read pause'}</button><button onClick={()=>setComplete(true)}>Complete fixture</button></>:<><button onClick={()=>setGuideSuspended(v=>!v)}>{guideSuspended?'Resume guide':'Pause guide'}</button><button onClick={()=>setNear(true)}>Approach candle</button><button onClick={()=>useJourneyStore.setState({sceneId:'river.release-surrender',chapterId:'fire-river',activeEntryId:getJourneyScene('river.release-surrender').keystoneEntryId,completedStoryEventIds:['river.birds-released'],storyObjectStates:{'river.birds':'released'},worldFlags:{'story-events.started':true}})}>Quiet fixture</button></>}
 </nav>
 {transitionMode?<StoryTransitionDirector chapter={chapter} scene={scene} sceneCompleted={complete} suppressed={suppressed} onPhaseChange={setPhase}/>:<>
 <Canvas dpr={1} camera={{fov:65,near:.05,far:120}} gl={{antialias:true,preserveDrawingBuffer:true}}><color attach='background' args={['#080e11']}/><hemisphereLight args={['#b9c8cf','#30251e',.65]}/><Suspense fallback={null}><Physics paused><BlueMoonSanctuaryChapter scene={getJourneySceneLayout(blue.id)} qualityProfile={RENDER_QUALITY_PROFILES.low} reducedEffects reducedMotion/><StoryEventDirector key={id} sceneId={id} reducedMotion/></Physics><View near={near}/></Suspense></Canvas>
 <GuidedStoryMoment sceneId={id} active={!guideSuspended}/>
 <section className='contextual-nav-prompt'>Legacy navigation prompt</section>
 </>}
 </main>;
}
createRoot(document.getElementById('root')).render(<App/>);`;
async function persist() { await writeFile(out+'/review.json', JSON.stringify(report,null,2)); }
async function run(name, width, task) {
  const ctx=await browser.newContext({viewport:{width,height:width===390?844:800},deviceScaleFactor:1});
  const page=await ctx.newPage(), errors=[];
  page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
  try { await task(page);expect(errors).toEqual([]);report.checks.push({name,width,result:'passed'}); }
  catch(error) { report.failures.push({name,width,error:String(error),errors}); }
  finally { await ctx.close();await persist(); }
}
async function capture(page,name) { await page.screenshot({path:out+'/'+name+'.png',timeout:30000});report.captures.push({name,scope:'seeded component review'}); }
try {
 await mkdir(out,{recursive:true});await mkdir(root+'/'+fixture,{recursive:true});
 await writeFile(root+'/'+fixture+'/index.html','<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><title>Guided story review</title><style>html,body,#root,main{width:100%;height:100%;margin:0}body{background:#080e11;color:#eee;font-family:Georgia}nav button{padding:8px;min-height:44px}</style></head><body><div id="root"></div><script type="module" src="./stage.tsx"></script></body></html>');
 await writeFile(root+'/'+fixture+'/stage.tsx',stage);
 server=await createServer({configFile:false,root,cacheDir:'/tmp/slipper-guided-vite-cache',server:{host:'127.0.0.1',port:4230,strictPort:true},esbuild:{jsx:'automatic'},optimizeDeps:{entries:[fixture+'/stage.tsx']}});await server.listen();
 browser=await chromium.launch({args:['--enable-webgl','--ignore-gpu-blocklist','--use-angle=swiftshader']});
 await run('foreground transition owns visible fading',1280,async page=>{
  await page.goto('http://127.0.0.1:4230/'+fixture+'/?case=transition');await page.bringToFront();
  await expect(page).toHaveTitle('Guided story review');
  const transition=page.locator('[data-story-transition="arrival"]'),root=page.locator('main');
  await expect(transition).toBeVisible();await page.waitForTimeout(700);
  await page.getByRole('button',{name:'Open settings',exact:true}).click();await page.waitForTimeout(150);
  const read=()=>transition.evaluate(e=>({delay:getComputedStyle(e).animationDelay,opacity:getComputedStyle(e).opacity}));
  const start=await read();await page.waitForTimeout(4600);const end=await read();expect(end).toEqual(start);
  await expect(root).toHaveAttribute('data-review-phase','arrival');
  await capture(page,'paused-arrival');await page.getByRole('button',{name:'Close settings',exact:true}).click();
  await expect(root).toHaveAttribute('data-review-phase','contemplation',{timeout:8000});
  await page.getByRole('button',{name:'Read pause',exact:true}).click();await page.waitForTimeout(6600);
  await expect(root).toHaveAttribute('data-review-phase','idle'); // exposed state is idle while presentation is suppressed
  await page.getByRole('button',{name:'Resume reading',exact:true}).click();
  await expect(root).toHaveAttribute('data-review-phase','contemplation');
  await expect(root).toHaveAttribute('data-review-phase','idle',{timeout:10000});
  await page.getByRole('button',{name:'Complete fixture',exact:true}).click();
  await expect(root).toHaveAttribute('data-review-phase','departure');
  await expect(root).toHaveAttribute('data-review-phase','silence',{timeout:7000});
  await expect(root).toHaveAttribute('data-review-phase','idle',{timeout:7000});
 });
 for(const width of [1280,390])await run('3D intention, label ownership and quiet',width,async page=>{
  await page.goto('http://127.0.0.1:4230/'+fixture+'/');await page.bringToFront();
  await expect(page).toHaveTitle('Guided story review');const guide=page.locator('[data-guided-story="blue-moon.sanctuary"]');
  await expect(guide).toBeVisible();await expect(guide).toContainText('Light First candle.');
  const label=page.locator('.story-guided-target');await expect(label).toBeVisible({timeout:60000});
  await page.waitForTimeout(800);await capture(page,'sanctuary-guide-'+width);
  await page.getByRole('button',{name:'Open settings',exact:true}).click();await expect(guide).toBeHidden();await expect(label).toBeHidden();
  await page.getByRole('button',{name:'Close settings',exact:true}).click();await expect(guide).toBeVisible();await expect(label).toBeVisible();
  await page.getByRole('button',{name:'Approach candle',exact:true}).click();
  const action=page.locator('button[data-story-event-id="blue-moon.candle-chain"]');await expect(action).toBeVisible();await expect(label).toBeHidden();
  await action.click();await expect(guide).toContainText('One small flame calls the others into light.');
  await expect(guide).toHaveAttribute('data-guided-event','blue-moon.water-reveal');
  await page.getByRole('button',{name:'Pause guide',exact:true}).click();await expect(guide).toBeHidden();
  await page.waitForTimeout(4100);
  await page.getByRole('button',{name:'Resume guide',exact:true}).click();
  await expect(guide).toHaveAttribute('data-aftermath-event','blue-moon.candle-chain');
  await guide.getByRole('button',{name:'Stay with this moment',exact:true}).click();
  await expect(guide).toHaveAttribute('data-aftermath-held','true');
  await capture(page,'sanctuary-held-aftermath-'+width);
  await guide.getByRole('button',{name:'Continue past this moment',exact:true}).click();
  await expect(guide).toHaveAttribute('data-guided-response','false');
  await page.getByRole('button',{name:'Quiet fixture',exact:true}).click();
  await expect(page.locator('[data-guided-story]')).toHaveCount(0);await expect(page.locator('.story-guided-target')).toHaveCount(0);
  await expect(page.locator('.contextual-nav-prompt')).toBeHidden();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
  await expect(page.locator('vite-error-overlay')).toHaveCount(0);
 });
} catch(error) { report.failures.push({name:'harness',error:String(error)}); }
finally { if(browser)await browser.close();if(server)await server.close();await rm(root+'/'+fixture,{recursive:true,force:true});await persist();console.log(JSON.stringify(report,null,2));if(report.failures.length)process.exitCode=1; }
