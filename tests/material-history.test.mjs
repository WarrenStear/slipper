import assert from 'node:assert/strict';
import test from 'node:test';
import {register} from 'node:module';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import ts from 'typescript';
import * as React from 'react';
import * as jsxRuntime from 'react/jsx-runtime';
import * as THREE from 'three';
import {act,createRoot,extend,_roots} from '@react-three/fiber';
import * as library from '../src/components/three/materials/materialLibrary.ts';
import * as tactile from '../src/components/three/storyEvents/tactileShader.ts';
import {resolveSceneLook} from '../src/components/three/artDirection/SceneLookRegistry.ts';
import {attachMaterialShadow} from '../src/components/three/materials/materialShadowOwnership.ts';
import {createMaterialMapGuard} from '../src/components/three/materials/productionMaterialRuntime.ts';
register(new URL('./canonical-node-loader.mjs',import.meta.url));
const api={...await import('../src/data/journeyBlueprint.ts'),...await import('../src/lib/storyJourneyState.ts'),...await import('../src/storyEvents/storyEventState.ts'),...await import('../src/storyEvents/storyEventRegistry.ts')};
const snapshots=new Map();
let current=api.createFreshStoryJourneyState({fallbackEntryId:'fragment-001',entryProgress:api.JOURNEY_ENTRY_PROGRESS});
const dispatch=input=>{
 const result=api.dispatchStoryEventState(current,input);assert.ok(result.eventIds.length,'Actual reducer rejected '+JSON.stringify(input));
 current=result.state; for(const id of result.eventIds)snapshots.set(id,structuredClone(current));
};
for(const scene of api.journeyScenes){
 // Only review scene handoffs/witnesses are scaffolded; material outcomes below
 // always come from the real registry/reducer, never patched history booleans.
 current={...current,...api.JOURNEY_ENTRY_PROGRESS[scene.keystoneEntryId],sceneId:scene.id,chapterId:scene.chapterId,activeEntryId:scene.keystoneEntryId,storyStarted:true,
  witnessedEntryIds:[...new Set([...current.witnessedEntryIds,scene.keystoneEntryId])]};
 dispatch({sceneId:scene.id,trigger:'scene-enter'});
 for(let n=0;!api.isSceneStoryComplete(current)&&n<60;n++){
  const e=api.getAvailableStoryEvents(current).find(e=>!e.optional);assert.ok(e,scene.id);
  dispatch({sceneId:scene.id,eventId:e.id,trigger:e.trigger,objectId:e.objectId,targetId:e.targetId,duration:e.durationMs});
 }
 assert.ok(api.isSceneStoryComplete(current),scene.id);
 current={...current,completedSceneIds:[...new Set([...current.completedSceneIds,scene.id])],history:[...current.history,scene.keystoneEntryId]};
}
const history=state=>library.resolveMaterialHistory(state.storyObjectStates,state.worldFlags);
const look=(state,scene='crowned.home',quality='high',reduced=false)=>resolveSceneLook(scene,quality,reduced,{materialHistory:history(state),surrenderComplete:state.storyObjectStates['river.white-fabric']==='raised'});
const memory=(state,surface='wood',receiver='remembered-frame',scene='crowned.home',quality='high',reduced=false)=>{
 const m=look(state,scene,quality,reduced).materials;
 return library.resolveMaterialMemory(surface,.9,{wetness:m.wetness,wear:m.environmentalWear,damage:m.damage,reintegrated:m.reintegrated,history:m.history,receiver,rememberedScene:m.rememberedScene});
};

test('history is admitted only by actual canonical outcomes, never scene name/completion/visits',()=>{
 const fresh=api.createFreshStoryJourneyState({fallbackEntryId:'fragment-001',entryProgress:api.JOURNEY_ENTRY_PROGRESS});
 assert.deepEqual(history(fresh),{fireTouched:false,soot:0,washed:false,mirrorScarred:false,integrated:false});
 assert.deepEqual(history({...fresh,sceneId:'crowned.home',storyCompleted:true,completedSceneIds:api.journeyScenes.map(s=>s.id),visitedEntryIds:['fragment-038']}),history(fresh));
 assert.equal(resolveSceneLook('crowned.home').materials.reintegrated,false);
 assert.deepEqual(library.resolveMaterialHistory({'river.soot':'washed'},{'river.grief-washed':'true','fire.boundary-burned':'true'}),history(fresh),'Truthy strings do not invent acceptance');
 assert.equal(history(snapshots.get('integration.three-capacities')).integrated,true);
 assert.equal(history(snapshots.get('sunset.truth.seen')).mirrorScarred,true);
});

test('real Fire outcomes darken existing remnants; washing reduces soot but retains scars',()=>{
 const before=snapshots.get('fire.false-promise.take'),burn=snapshots.get('fire.false-promise.flame'),enter=snapshots.get('river.entered'),wash=snapshots.get('river.ash-washed');
 assert.equal(history(before).fireTouched,false);assert.equal(history(burn).fireTouched,true);
 assert.ok(history(burn).soot>history(enter).soot&&history(enter).soot>history(wash).soot&&history(wash).soot>0);
 for(const surface of ['charred-wood','ash']){
  const clean=memory(before,surface,undefined,'fire.boundary'),burned=memory(burn,surface,undefined,'fire.boundary'),washed=memory(wash,surface,undefined,'fire.boundary');
  assert.ok(burned.brightness<clean.brightness);assert.equal(burned.damage,.32);assert.equal(washed.damage,burned.damage);
  assert.equal(burned.wetness,0);assert.equal(washed.wetness,.3);assert.ok(washed.brightness>burned.brightness,'Washing lifts soot but leaves a darker damp remnant');
  assert.ok(washed.brightness<clean.brightness);
 }
});

test('only explicitly remembered later wood frames retain the earlier mirror scar and washing',()=>{
 const after=snapshots.get('river.ash-washed'),before=snapshots.get('broken-floor.confession.enter');
 const frame=memory(after);assert.equal(frame.damage,.38);assert.equal(frame.wetness,.22);
 for(const surface of tactile.STORY_SURFACES.filter(s=>!['charred-wood','ash'].includes(s))){
  const ordinary=memory(after,surface,null),m=look(after).materials;
  assert.deepEqual(ordinary,library.resolveMaterialMemory(surface,.9,{wetness:m.wetness,wear:m.environmentalWear,damage:m.damage,reintegrated:m.reintegrated}));
 }
 assert.equal(memory(after,'wood','remembered-frame','climb.heart').damage,0,'The newly introduced Heart choice does not inherit later-world history treatment');
 assert.equal(memory(before).damage,0);assert.equal(memory(before).wetness,.1);
 assert.equal(memory(after,'metal','remembered-frame').wetness,0);
});

test('restore and actual optional Crowned integration retain material identity and earned scars',()=>{
 const washed=snapshots.get('river.ash-washed'),home=snapshots.get('crown.recognised');
 const integrated=api.dispatchStoryEventState(home,{sceneId:'crowned.sovereignty',eventId:'crown.integrated',trigger:'touch',objectId:'home.crown-mirror'});
 assert.deepEqual(integrated.eventIds,['crown.integrated']);
 const before=memory(home),after=memory(integrated.state);assert.equal(after.surface,'wood');assert.equal(after.damage,before.damage);assert.equal(after.wetness,before.wetness);
 assert.equal(after.damage,.38);assert.equal(memory(structuredClone(washed)).damage,.38);
 assert.equal(memory(snapshots.get('fire.false-promise.take'),'charred-wood',undefined,'fire.boundary').damage,0,'Restoring an earlier save removes unearned later traces');
});

test('history response is consistent across all tiers/reduced effects and changes no shader source or cache key',()=>{
 const state=snapshots.get('river.ash-washed'),expected=memory(state);
 for(const quality of ['low','medium','high','cinematic'])for(const reduced of [false,true]){
  assert.deepEqual(memory(state,'wood','remembered-frame','crowned.home',quality,reduced),expected);
  for(const surface of ['wood','charred-wood','ash']){
   const detail=tactile.tactileDetailFor(quality,reduced),a={vertexShader:THREE.ShaderLib.standard.vertexShader,fragmentShader:THREE.ShaderLib.standard.fragmentShader},b={...a};
   tactile.applyTactileShader(a,surface,detail,{value:[0,0,0,0]});tactile.applyTactileShader(b,surface,detail,{value:[.22,.6,.38,1]});
   assert.equal(a.vertexShader,b.vertexShader);assert.equal(a.fragmentShader,b.fragmentShader);
   assert.equal(tactile.tactileProgramKey(surface,detail),tactile.tactileProgramKey(surface,detail));
  }
 }
});

extend(THREE);
test('actual R3F material updates shared memory in place and preserves private-depth lifetime on restore/remount',async()=>{
 const Look=React.createContext(null),exports={},requests=[];
 const code=ts.transpileModule(readFileSync(new URL('../src/components/three/storyEvents/TactileMaterial.tsx',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX}}).outputText;
 const imports={react:React,'react/jsx-runtime':jsxRuntime,three:THREE,'../materials/materialLibrary':library,'./tactileShader':tactile,
  '../artDirection/SceneLookContext':{useSceneLook:()=>React.useContext(Look)},'../materials/materialShadowOwnership':{attachMaterialShadow},'../materials/productionMaterialRuntime':{createMaterialMapGuard},
  '../materials/useProductionMaterialMaps':{useProductionMaterialMaps:(_surface,enabled)=>{requests.push(enabled);return undefined;}},'../materials/materialMapAdmission':{admitsProductionMaterialMaps:()=>false}};
 runInNewContext(code,{exports,require:id=>{assert.ok(id in imports,id);return imports[id];}},{timeout:1000});
 const canvas={width:1,height:1,style:{}},scene=new THREE.Scene(),previousAct=globalThis.IS_REACT_ACT_ENVIRONMENT;
 globalThis.IS_REACT_ACT_ENVIRONMENT=true;
 const gl={render(){assert.fail('CPU fixture cannot render');},setSize(){},setPixelRatio(){},shadowMap:{},xr:{addEventListener(){},removeEventListener(){}}};
 const root=createRoot(canvas).configure({gl,scene,frameloop:'never',size:{width:1,height:1},dpr:1});
 let mesh,material,depth,uniform,sourceDisposed=0,depthDisposed=0;
 try{
  for(const state of [snapshots.get('fire.false-promise.take'),snapshots.get('fire.false-promise.flame'),snapshots.get('river.ash-washed'),snapshots.get('fire.false-promise.take')]){
   const value={look:look(state)};
   await act(async()=>root.render(React.createElement(React.StrictMode,null,React.createElement(Look.Provider,{value},React.createElement('mesh',{ref:x=>{if(x)mesh=x;}},React.createElement('boxGeometry'),React.createElement(exports.TactileMaterial,{surface:'wood',color:'#66503d',roughness:.9,memoryReceiver:'remembered-frame'}))))));
   if(!material){material=mesh.material;depth=mesh.customDepthMaterial;material.addEventListener('dispose',()=>sourceDisposed++);depth.addEventListener('dispose',()=>depthDisposed++);}
   assert.equal(mesh.material,material);assert.equal(mesh.customDepthMaterial,depth);assert.equal(sourceDisposed,0);assert.equal(depthDisposed,0);
   const shader={vertexShader:THREE.ShaderLib.standard.vertexShader,fragmentShader:THREE.ShaderLib.standard.fragmentShader};material.onBeforeCompile(shader);
   if(!uniform)uniform=shader.uniforms.storyMemory;assert.equal(shader.uniforms.storyMemory,uniform);
   const expected=memory(state);assert.deepEqual(Array.from(uniform.value),[expected.wetness,expected.wear,expected.damage,Number(value.look.materials.reintegrated)]);
   assert.equal(material.roughness,expected.roughness);
  }
  await act(async()=>root.render(null));assert.equal(sourceDisposed,1);assert.equal(depthDisposed,1);
  await act(async()=>root.render(React.createElement(Look.Provider,{value:{look:look(snapshots.get('river.ash-washed'))}},React.createElement('mesh',{ref:x=>{if(x)mesh=x;}},React.createElement('boxGeometry'),React.createElement(exports.TactileMaterial,{surface:'wood',color:'#66503d',memoryReceiver:'remembered-frame'})))));
  assert.notEqual(mesh.material,material);assert.notEqual(mesh.customDepthMaterial,depth);
  assert.ok(requests.every(enabled=>enabled===false),'History must not turn on material downloads');
 }finally{await act(async()=>root.render(null));_roots.delete(canvas);if(previousAct===undefined)delete globalThis.IS_REACT_ACT_ENVIRONMENT;else globalThis.IS_REACT_ACT_ENVIRONMENT=previousAct;}
});

test('all32 scene lighting/atmosphere/reflection/motion/quality budgets remain exact against the hash-pinned current owner',async()=>{
 const {createHash}=await import('node:crypto'),profiles=await import('../src/cinematics/emotionalProfiles.ts');
 const baseline=readFileSync(new URL('./fixtures/material-history/SceneLookRegistry.ts',import.meta.url),'utf8');
 const provenance=JSON.parse(readFileSync(new URL('./fixtures/material-history/provenance.json',import.meta.url),'utf8'));
 assert.equal(createHash('sha256').update(baseline).digest('hex'),provenance.sha256);
 const exports={},code=ts.transpileModule(baseline,{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText;
 runInNewContext(code,{exports,require:id=>{assert.equal(id,'../../../cinematics/emotionalProfiles.ts');return profiles;}},{timeout:1000});
 for(const scene of api.journeyScenes)for(const quality of ['low','medium','high','cinematic'])for(const reduced of [false,true]){
  const state={surrenderComplete:true,mirrorStill:true,materialHistory:history(snapshots.get('river.ash-washed'))};
  const before=exports.resolveSceneLook(scene.id,quality,reduced,state),after=resolveSceneLook(scene.id,quality,reduced,state);
  delete before.materials;delete after.materials;
  assert.deepEqual(JSON.parse(JSON.stringify(after)),JSON.parse(JSON.stringify(before)),scene.id+'/'+quality+'/'+reduced);
 }
});
