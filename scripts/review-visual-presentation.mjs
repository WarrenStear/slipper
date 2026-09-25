import { chromium } from '@playwright/test';
import { spawn, execFileSync } from 'node:child_process';
import { mkdir, writeFile, rm } from 'node:fs/promises';
import { resolve } from 'node:path';

// Review scaffolding lives only in this process/CI checkout. Nothing below is
// imported by the app or included in the production dist. Fixture screenshots
// establish appearance, not journey completion, collision, or performance QA.
const out = '/tmp/slipper-visual-review';
// Verified main before the restraint/finale pass; earlier review SHAs lack these source paths.
// An explicit override must contain every required baseline file; never fall back silently.
const baseline = process.env.VISUAL_REVIEW_BASELINE || '2fe438ed0d3f29860ee225f1fe6269eaced0ef79';
const angle = process.env.REVIEW_ANGLE ?? 'swiftshader';
if (!['swiftshader', 'metal'].includes(angle)) throw new Error('REVIEW_ANGLE must be swiftshader or metal');
const fixture = resolve('.visual-review');
const modelPath = 'src/components/three/storyEvents/StoryObjectModel.tsx';
const floorPath = 'src/components/three/storyEvents/WetFloorReveal.tsx';
const oldModelPath = 'src/components/three/storyEvents/BaselineStoryObjectModel.tsx';
const oldFloorPath = 'src/components/three/storyEvents/BaselineWetFloorReveal.tsx';
const report = { candidate: execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(), baseline, requestedAngle: angle, method: 'Production entry controls plus isolated source-component fixtures; not full gameplay certification.', captures: [], failures: [] };
let browser;
const processes = [];

async function server(args, port) {
  const child = spawn(process.execPath, ['node_modules/vite/bin/vite.js', ...args, '--host','127.0.0.1','--port',String(port),'--strictPort'], { stdio: ['ignore','pipe','pipe'] });
  processes.push(child);
  let log = '';
  child.stdout.on('data', chunk => { log += chunk; }); child.stderr.on('data', chunk => { log += chunk; });
  for (let i=0;i<120;i++) {
    if (child.exitCode !== null) throw new Error(`Server ${port} exited: ${log}`);
    try { if ((await fetch(`http://127.0.0.1:${port}/`)).ok) return; } catch {}
    await new Promise(done=>setTimeout(done,250));
  }
  throw new Error(`Server ${port} did not become ready: ${log}`);
}

const stageSource = `import React, { Suspense, useLayoutEffect, useRef } from 'react';
import { createRoot } from 'react-dom/client';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Physics } from '@react-three/rapier';
import { StoryObjectModel } from '../src/components/three/storyEvents/StoryObjectModel';
import { StoryObjectModel as BaselineModel } from '../src/components/three/storyEvents/BaselineStoryObjectModel';
import { WetFloorReveal } from '../src/components/three/storyEvents/WetFloorReveal';
import { WetFloorReveal as BaselineFloor } from '../src/components/three/storyEvents/BaselineWetFloorReveal';
import { BlueMoonSanctuaryChapter } from '../src/components/three/chapters/BlueMoonSanctuaryChapter';
import { ThornedHouseChapter } from '../src/components/three/chapters/ThornedHouseChapter';
import { getJourneySceneLayout } from '../src/data/journeyWorldLayout';
import { journeyScenes } from '../src/data/journeyBlueprint';
import { objectsForScene } from '../src/storyEvents/storyEventRegistry';
import { RENDER_QUALITY_PROFILES } from '../src/components/three/renderQuality';
import { useJourneyStore } from '../src/stores/useJourneyStore';
import { useWorldStore } from '../src/stores/useWorldStore';
const params = new URLSearchParams(location.search);
const which = params.get('case') || 'props';
const isBase = params.get('baseline') === '1';
const Model = isBase ? BaselineModel : StoryObjectModel;
const Floor = isBase ? BaselineFloor : WetFloorReveal;
const id = which === 'blue' ? 'blue-moon.intimacy' : journeyScenes.find(item=>item.id.startsWith('thorned.'))?.id;
const scene = getJourneySceneLayout(id || 'thorned.self-owned-world');
useWorldStore.setState({ mode: 'explore' });
useJourneyStore.setState({ sceneId: scene.sceneId ?? id, storyObjectStates: {}, completedStoryEventIds: [], storyPlacementStates: {}, worldFlags: {} });
function CameraAndEvidence() {
  const { camera, scene, gl } = useThree(); const frames = useRef(0);
  useLayoutEffect(()=>{
    if(which.startsWith('floor')) {camera.position.set(0,2.8,-3.4);camera.lookAt(0,0,1);}
    else if(which==='blue') {camera.position.set(1,2.7,-7);camera.lookAt(0,1.5,4.5);}
    else if(which==='house') {camera.position.set(.7,2.1,-1.6);camera.lookAt(0,1.35,4.5);}
    else {camera.position.set(0,2.5,innerWidth<600?13:5.8);camera.lookAt(0,.4,0);}
    camera.updateProjectionMatrix();
  },[camera]);
  useFrame(()=>{
    if(++frames.current===25) {
      const names=[]; scene.traverse(item=>{if(item.name)names.push(item.name);});
      window.__visualEvidence={calls:gl.info.render.calls,triangles:gl.info.render.triangles,names};
      document.body.dataset.ready='true';
    }
  }); return null;
}
function Props() {
 const list=['rose','feather','origami','fabric','book','letter','chair','frame'];
 return <group>{list.map((kind,i)=><group key={kind} position={[(i%4-1.5)*1.05,i<4?.18:.05,i<4?.9:-.7]} rotation={[0,kind==='frame'?Math.PI:0,0]} scale={kind==='chair'||kind==='frame'?.58:1}><Model kind={kind} reducedMotion /></group>)}</group>;
}
function Stage() {
 if(which.startsWith('floor'))return <Floor stage={which==='floor2'?2:0} reducedMotion />;
 if(which==='blue'||which==='house') {
  const Chapter=which==='blue'?BlueMoonSanctuaryChapter:ThornedHouseChapter;
  return <Physics paused><Chapter scene={scene} qualityProfile={RENDER_QUALITY_PROFILES.low} reducedEffects reducedMotion openingResolved />{objectsForScene(id).filter(item=>!['path','water','door'].includes(item.kind)).map(item=><group key={item.id} position={item.localPosition}><Model kind={item.kind} reducedMotion /></group>)}</Physics>;
 }
 return <><Props/><mesh rotation={[-Math.PI/2,0,0]} position={[0,-.04,0]}><planeGeometry args={[100,100]}/><meshStandardMaterial color='#151b1b' roughness={.92}/></mesh></>;
}
createRoot(document.getElementById('root')).render(<Canvas dpr={1} camera={{fov:42,near:.05,far:130}} gl={{antialias:true,preserveDrawingBuffer:true}}><color attach='background' args={['#080e11']}/><hemisphereLight args={['#b9d1da','#3d3026',1.3]}/><directionalLight position={[3,6,3]} color='#f1d5ac' intensity={2.5}/><directionalLight position={[-4,3,-2]} color='#afc8dc' intensity={1.2}/><Suspense fallback={null}><Stage/><CameraAndEvidence/></Suspense></Canvas>);`;

async function captureFixture(which, width, height, isBase=false) {
  const context=await browser.newContext({viewport:{width,height},deviceScaleFactor:1,reducedMotion:'reduce'});
  const page=await context.newPage(); const errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  page.on('console',message=>{if(message.type()==='error')errors.push(message.text());});
  const name=`${isBase?'before':'after'}-${which}-${width}`;
  try {
    await page.goto(`http://127.0.0.1:4174/.visual-review/?case=${which}&baseline=${isBase?1:0}`,{waitUntil:'domcontentloaded',timeout:45000});
    await page.locator('body[data-ready="true"]').waitFor({timeout:90000});
    await page.screenshot({path:`${out}/${name}.png`,timeout:60000});
    const stats=await page.evaluate(()=>window.__visualEvidence);
    if(errors.length)throw new Error(errors.join('\n'));
    report.captures.push({name,width,height,scope:'isolated component fixture',...stats});
  } catch(error) { report.failures.push({name,error:String(error),errors}); }
  finally { await context.close(); }
}
async function captureEntry(width,height) {
  const context=await browser.newContext({viewport:{width,height},deviceScaleFactor:1,reducedMotion:'no-preference'});
  const page=await context.newPage(); const errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  const name=`entry-${width}`;
  try {
    await page.goto('http://127.0.0.1:4173/?accessible=1',{waitUntil:'domcontentloaded',timeout:45000});
    await page.locator('.onboarding-gate[aria-busy="false"]').waitFor({timeout:20000});
    const button=page.getByRole('button',{name:'Begin',exact:true});
    await button.waitFor({state:'visible',timeout:15000});
    await page.waitForTimeout(2500);
    const title=await page.locator('#onboarding-title').innerText();
    const subtitle=await page.locator('#onboarding-description').innerText();
    const measure=await page.evaluate(()=>({width:innerWidth,scrollWidth:document.documentElement.scrollWidth,buttonOpacity:getComputedStyle(document.querySelector('.onboarding-actions')).opacity,cardCentre:document.querySelector('.onboarding-card').getBoundingClientRect().top+document.querySelector('.onboarding-card').getBoundingClientRect().height/2,height:innerHeight}));
    if(title!=='SLIPPER IN THE WOODS'||subtitle!=='A journey to you.')throw new Error('Canonical title/subtitle changed');
    if(measure.scrollWidth>measure.width||Number(measure.buttonOpacity)<.95||Math.abs(measure.cardCentre-measure.height/2)>30)throw new Error('Overflow or invisible primary action');
    await page.screenshot({path:`${out}/${name}.png`,timeout:30000});
    await button.click({timeout:15000});
    await page.locator('[data-accessible-journey="true"]').waitFor({timeout:20000});
    if(errors.length)throw new Error(errors.join('\n'));
    report.captures.push({name,width,height,scope:'production entry; normal motion',identity:await page.title(),title,subtitle,measure,interaction:'Begin opens the accessible journey'});
  } catch(error){report.failures.push({name,error:String(error),errors});await page.screenshot({path:`${out}/${name}-failure.png`,timeout:10000}).catch(()=>{});}
  finally{await context.close();}
}
try {
  await mkdir(out,{recursive:true});
  execFileSync('git',['cat-file','-e',`${baseline}^{commit}`]);
  for (const required of [modelPath, floorPath]) execFileSync('git',['cat-file','-e',`${baseline}:${required}`]);
  await mkdir(fixture,{recursive:true});
  for(const [original,temporary] of [[modelPath,oldModelPath],[floorPath,oldFloorPath]]) await writeFile(temporary,execFileSync('git',['show',`${baseline}:${original}`]));
  await writeFile(`${fixture}/index.html`,'<!doctype html><html><head><meta name="viewport" content="width=device-width, initial-scale=1"><title>Isolated visual component review</title><style>html,body,#root{margin:0;width:100%;height:100%;overflow:hidden;background:#080e11}</style></head><body><div id="root"></div><script type="module" src="./stage.tsx"></script></body></html>');
  await writeFile(`${fixture}/stage.tsx`,stageSource);
  await server(['preview'],4173); await server(['--config','vite.config.ts'],4174);
  browser=await chromium.launch({args:['--enable-webgl','--ignore-gpu-blocklist',`--use-angle=${angle}`]});
  await captureEntry(1280,800);await captureEntry(390,844);await captureEntry(844,390);
  for(const which of ['props','floor0','floor2']) {await captureFixture(which,1100,720,true);await captureFixture(which,1100,720);}
  await captureFixture('blue',1100,720);await captureFixture('house',1100,720);
  await captureFixture('props',390,844);await captureFixture('floor2',390,844);
} catch(error){report.failures.push({name:'harness',error:String(error)});}
finally {
  if(browser)await browser.close();for(const child of processes)child.kill('SIGTERM');
  await rm(fixture,{recursive:true,force:true});await rm(oldModelPath,{force:true});await rm(oldFloorPath,{force:true});
  await writeFile(`${out}/review.json`,JSON.stringify(report,null,2));
  console.log(JSON.stringify({captures:report.captures.map(({name,scope})=>({name,scope})),failures:report.failures},null,2));
  if(report.failures.length)process.exitCode=1;
}
