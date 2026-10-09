import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {runInNewContext} from 'node:vm';
import {register} from 'node:module';
import ts from 'typescript';
import * as THREE from 'three';
import * as emotional from '../src/cinematics/emotionalProfiles.ts';
import * as narrative from '../src/data/journeyNarrative.ts';
import * as themes from '../src/components/three/environment/environmentThemes.ts';
import * as scatter from '../src/components/three/environment/terrainScatterRotation.ts';
import * as worldMath from '../src/world/worldMath.ts';
import * as pathsAPI from '../src/world/terrain/worldPaths.ts';
import * as habitat from '../src/world/guidance/pathUnderstoryHabitat.ts';
import * as forest from '../src/world/forest/forestInstancePresentation.ts';
import * as forestGeometry from '../src/world/forest/forestGeometry.ts';
import {getJourneySceneLayout} from '../src/data/journeyWorldLayout.ts';
import {normalizeGeneratedWorldState} from '../src/data/worldStateNormalization.ts';
import {resolveSceneLook} from '../src/components/three/artDirection/SceneLookRegistry.ts';
import {advanceSceneMotion,SCENE_MOTION_CHANNELS} from '../src/components/three/artDirection/sceneMotion.ts';
register(new URL('./canonical-node-loader.mjs',import.meta.url));
const story={...await import('../src/data/journeyBlueprint.ts'),...await import('../src/lib/storyJourneyState.ts'),...await import('../src/storyEvents/storyEventState.ts'),...await import('../src/storyEvents/storyEventRegistry.ts')};
const plain=x=>JSON.parse(JSON.stringify(x));
const pins=JSON.parse(readFileSync(new URL('./fixtures/phase10-restraint/baseline.json',import.meta.url),'utf8'));
function baseline(name,imports){const file=name+'.txt',source=readFileSync(new URL('./fixtures/phase10-restraint/'+file,import.meta.url),'utf8');assert.equal(createHash('sha256').update(source).digest('hex'),pins[file].sha256);const exports={};runInNewContext(ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText,{exports,require:id=>{assert.ok(id in imports,id);return imports[id];}},{timeout:1000});return exports;}
const oldLook=baseline('SceneLookRegistry.ts',{'../../../cinematics/emotionalProfiles.ts':emotional});
const oldForest=baseline('forestInstancePresentation.ts',{three:THREE,'./forestGeometry.ts':forestGeometry});
const oldHabitat=baseline('pathUnderstoryHabitat.ts',{three:THREE,'../../data/journeyNarrative.ts':narrative,'../../components/three/environment/environmentThemes.ts':themes,'../../components/three/environment/terrainScatterRotation.ts':scatter,'../worldMath.ts':worldMath,'../terrain/worldPaths.ts':pathsAPI});
const entries=normalizeGeneratedWorldState(JSON.parse(readFileSync(new URL('../src/data/worldState.json',import.meta.url),'utf8'))).entries,paths=pathsAPI.buildMazePathSegments(entries);
const snapshots=[];let current=story.createFreshStoryJourneyState({fallbackEntryId:'fragment-001',entryProgress:story.JOURNEY_ENTRY_PROGRESS});
for(const scene of story.journeyScenes){
 current={...current,...story.JOURNEY_ENTRY_PROGRESS[scene.keystoneEntryId],sceneId:scene.id,chapterId:scene.chapterId,activeEntryId:scene.keystoneEntryId,storyStarted:true,witnessedEntryIds:[...new Set([...current.witnessedEntryIds,scene.keystoneEntryId])]};
 const dispatch=input=>{const next=story.dispatchStoryEventState(current,input);assert.ok(next.eventIds.length);current=next.state;snapshots.push(structuredClone(current));};
 dispatch({sceneId:scene.id,trigger:'scene-enter'});
 for(let n=0;!story.isSceneStoryComplete(current)&&n<60;n++){const e=story.getAvailableStoryEvents(current).find(e=>!e.optional);assert.ok(e);dispatch({sceneId:scene.id,eventId:e.id,trigger:e.trigger,objectId:e.objectId,targetId:e.targetId,duration:e.durationMs});}
 assert.ok(story.isSceneStoryComplete(current));current={...current,completedSceneIds:[...new Set([...current.completedSceneIds,scene.id])],history:[...current.history,scene.keystoneEntryId]};
}
const raised=snapshots.findIndex(s=>s.storyObjectStates['river.white-fabric']==='raised');assert.ok(raised>0);
const projected=s=>({surrenderComplete:s.storyObjectStates['river.white-fabric']==='raised'});
const later=id=>/^(fork\.|climb\.|climbs\.|crowned\.|epilogue\.)/.test(id);
test('actual accepted Surrender outcome modestly restrains only later ambient rates and preserves every other look field',()=>{
 for(const scene of story.journeyScenes)for(const quality of ['low','medium','high','cinematic'])for(const reduced of [false,true])for(const s of [snapshots[raised-1],snapshots[raised]]){
  const state=projected(s),before=plain(oldLook.resolveSceneLook(scene.id,quality,reduced,state)),after=plain(resolveSceneLook(scene.id,quality,reduced,state));
  const factor=state.surrenderComplete&&later(scene.id)?.84:1;
  for(const channel of SCENE_MOTION_CHANNELS)assert.equal(after.motion[channel],before.motion[channel]*factor,scene.id+'/'+channel);
  delete before.motion;delete after.motion;assert.deepEqual(after,before,'No audio/camera/lighting/reflection/material/budget change');
 }
});
test('earlier restoration and nonboolean flags cannot keep unearned motion memory; accessibility still freezes all channels',()=>{
 for(const state of [{},{surrenderComplete:false},{surrenderComplete:'true'}])assert.deepEqual(plain(resolveSceneLook('crowned.home','high',false,state)),plain(oldLook.resolveSceneLook('crowned.home','high',false,state)));
 const look=resolveSceneLook('crowned.home','high',false,projected(snapshots[raised]));
 for(const [motion,effects]of [[true,false],[false,true]]){
  const frame={motion:{...look.motion},time:Object.fromEntries(SCENE_MOTION_CHANNELS.map(c=>[c,7])),stillness:0};
  advanceSceneMotion(frame,look,.05,true,motion,effects);assert.ok(SCENE_MOTION_CHANNELS.every(c=>frame.motion[c]===0&&frame.time[c]===7));
 }
 assert.equal(resolveSceneLook('river.release-surrender','high',false,projected(snapshots[raised])).stillness,true);
});
const start=getJourneySceneLayout('sunset.stillness').anchor.position,end=getJourneySceneLayout('thorned.locked-garden').anchor.position;
const at=t=>[start[0]+(end[0]-start[0])*t,start[2]+(end[2]-start[2])*t];
test('the canonical House approach field rises gradually, is bounded, and vanishes outside its authored axis',()=>{
 let previous=0;for(let n=0;n<=100;n++){const p=at(n/100),value=forest.houseApproachRhythmAtWorldPosition(...p);assert.ok(value>=previous-1e-12&&value<=1);previous=value;}
 assert.ok(previous>.999);assert.equal(forest.houseApproachRhythmAtWorldPosition(...at(-.01)),0);assert.equal(forest.houseApproachRhythmAtWorldPosition(...at(1.36)),0);
 const p=at(.8);assert.equal(forest.houseApproachRhythmAtWorldPosition(p[0]+40,p[1]),0);
});
test('existing narrow-reaching trunks gain a local architectural rhythm without changing identities elsewhere or numeric transport',()=>{
 let biased=0,beforeNarrow=0,total=0;
 for(let z=-100;z<10;z+=.75)for(let x=-45;x<40;x+=.75){
  const h=forest.houseApproachRhythmAtWorldPosition(Math.round(Math.fround(x)*16)/16,Math.round(Math.fround(z)*16)/16),before=oldForest.forestArchetypeAtWorldPosition(x,z),after=forest.forestArchetypeAtWorldPosition(x,z);
  assert.ok(Number.isInteger(after)&&after>=0&&after<8);assert.equal(after,forest.forestArchetypeAtWorldPosition(Math.fround(x),Math.fround(z)));
  if(h===0)assert.equal(after,before);if(h>.65){total++;biased+=Number(after===1);beforeNarrow+=Number(before===1);}
 }
 assert.ok(total>50&&biased>beforeNarrow*2,'Real coordinate set must increasingly use the existing upright family');
});
test('all actual routes retain exact population, root coordinates, terrain attachment and clearance across tiers and morphs',()=>{
 let modified=0;
 for(const path of paths)for(const quality of ['low','medium','high','cinematic'])for(const morph of [{},{explorationDepth:.75,memoryPressure:.6}]){
  const sample=(x,z)=>.13*x-.08*z;const before=plain(oldHabitat.createPathUnderstoryInstances(path,quality,morph,sample)),after=habitat.createPathUnderstoryInstances(path,quality,morph,sample);
  assert.equal(after.length,before.length);
  const house=path.role==='backbone'&&narrative.getJourneySceneForEntry(path.sourceEntry.id)?.id==='sunset.stillness'&&narrative.getJourneySceneForEntry(path.targetEntry.id)?.id==='thorned.locked-garden';
  if(!house)assert.deepEqual(after,before,'All unrelated routes remain byte-equivalent data');else modified++;
  for(let i=0;i<after.length;i++){
   assert.deepEqual(after[i].position,before[i].position);assert.equal(after[i].t,before[i].t);assert.equal(after[i].offset,before[i].offset);assert.deepEqual(after[i].habitat.palette,before[i].habitat.palette);
   assert.ok(after[i].offset-.9*Math.max(...after[i].scale)>1,'Same full conservative footprint clears the physical ribbon');
   const up=new THREE.Vector3(0,1,0).applyEuler(new THREE.Euler(...after[i].rotation));assert.ok(up.distanceTo(new THREE.Vector3(-.13,1,.08).normalize())<1e-8);
   assert.ok(after[i].habitat.weights.filter(v=>v>0).length<=3);
  }
 }
 assert.equal(modified,8,'Only the actual House entry backbone is changed at all four tiers/two morphs');
});
test('the same seven floor forms, shader and buffers are retained while near-House timber becomes dominant',()=>{
 assert.deepEqual(habitat.createPathUnderstoryBuffers(),plain(oldHabitat.createPathUnderstoryBuffers()));
 const a={vertexShader:THREE.ShaderLib.standard.vertexShader},b={...a};habitat.applyPathUnderstoryShader(a);oldHabitat.applyPathUnderstoryShader(b);assert.equal(a.vertexShader,b.vertexShader);
 const path=paths.find(p=>p.role==='backbone'&&narrative.getJourneySceneForEntry(p.sourceEntry.id)?.id==='sunset.stillness'&&narrative.getJourneySceneForEntry(p.targetEntry.id)?.id==='thorned.locked-garden');assert.ok(path);
 const values=habitat.createPathUnderstoryInstances(path,'cinematic',{},()=>0),near=values.filter(i=>i.t>.75),far=values.filter(i=>i.t<.2);
 assert.ok(near.filter(i=>i.habitat.weights[4]>0).length>near.length/2);
 assert.ok(near.reduce((n,i)=>n+i.habitat.weights[0]+i.habitat.weights[1],0)/near.length<far.reduce((n,i)=>n+i.habitat.weights[0]+i.habitat.weights[1],0)/far.length);
});
