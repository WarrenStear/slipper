import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import * as React from 'react';
import * as jsxRuntime from 'react/jsx-runtime';
import * as THREE from 'three';
import ts from 'typescript';
import {act,createRoot,extend,_roots,useFrame} from '@react-three/fiber';
import * as choreography from '../src/cinematics/environmentalChoreography.ts';
import {resolveSceneLook} from '../src/components/three/artDirection/SceneLookRegistry.ts';
import {RENDER_QUALITY_PROFILES} from '../src/components/three/renderQuality.ts';

extend(THREE);

function harness() {
  const source=readFileSync(new URL('../src/components/three/storyEvents/EnvironmentalChoreography.tsx',import.meta.url),'utf8');
  const code=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX}}).outputText;
  const state={storyObjectStates:{},sceneRelocationRevision:0};
  const presentation={time:{cloth:.27},motion:{cloth:.045},reducedEffects:false};
  const imports={
    react:React,'react/jsx-runtime':jsxRuntime,three:THREE,'@react-three/fiber':{useFrame},
    '../chapters/ChapterArt':{},'../artDirection/SceneLookContext':{useSceneLook:()=>presentation},
    '../../../stores/useJourneyStore':{useJourneyStore:selector=>selector(state)},
    '../../../cinematics/environmentalChoreography':choreography,
    '../../../cinematics/emotionalCinematography':{getCurrentCinematicProfile:()=>({airMovement:.045})},
    './StoryObjectModel':{},'../chapters/ChapterPrimitives':{Beam:()=>null},
    '../environmentArt/authoredGeometry.ts':{},'./TactileMaterial':{},
    '../../../storyEvents/acceptedStoryEvents':{},
  };
  // Actual component/hooks, installed R3F reconciler, Three geometry and actual
  // event-state resolver. Unrelated chapter children and the unchanged pole
  // are inert; this CPU fixture must never invoke a renderer or load assets.
  const exports={};
  runInNewContext(code,{exports,require:id=>{assert.ok(id in imports,id);return imports[id];}},{timeout:1000});
  const canvas={width:1,height:1,style:{}},scene=new THREE.Scene();
  const previousAct=globalThis.IS_REACT_ACT_ENVIRONMENT;globalThis.IS_REACT_ACT_ENVIRONMENT=true;
  const gl={render(){assert.fail('CPU cloth fixture cannot render');},setSize(){},setPixelRatio(){},shadowMap:{},xr:{addEventListener(){},removeEventListener(){}}};
  const root=createRoot(canvas).configure({gl,scene,frameloop:'never',size:{width:1,height:1},dpr:1});
  return {
    scene,state,presentation,
    async render({quality='high',reducedMotion=false,reducedEffects=false}={}){
      presentation.reducedEffects=reducedEffects;
      await act(async()=>root.render(React.createElement(React.StrictMode,null,React.createElement(exports.EnvironmentalChoreography,{sceneId:'river.release-surrender',qualityProfile:{...RENDER_QUALITY_PROFILES[quality]},reducedMotion,reducedEffects}))));
    },
    cloth(){return scene.getObjectByName('surrender-white-fabric-response').children.find(child=>child.isGroup);},
    mesh(){return this.cloth().children.find(child=>child.isMesh);},
    frames(){return _roots.get(canvas).store.getState().internal.subscribers;},
    frame(){const value=_roots.get(canvas).store.getState();for(const sub of value.internal.subscribers)sub.ref.current(value,1/60);},
    async close(){await act(async()=>root.render(null));assert.equal(this.frames().length,0);_roots.delete(canvas);if(previousAct===undefined)delete globalThis.IS_REACT_ACT_ENVIRONMENT;else globalThis.IS_REACT_ACT_ENVIRONMENT=previousAct;},
  };
}
const disposed=resource=>{let count=0;resource.addEventListener('dispose',()=>count++);return()=>count;};

test('actual cloth keeps one geometry/material/frame owner across quality and comfort changes and disposes once',async()=>{
 const h=harness();let mesh,geometry,material,gd,md;
 try {
  for(const quality of ['low','medium','high','cinematic'])for(const reducedEffects of [false,true])for(const reducedMotion of [false,true]){
   await h.render({quality,reducedEffects,reducedMotion});
   if(!mesh){mesh=h.mesh();geometry=mesh.geometry;material=mesh.material;gd=disposed(geometry);md=disposed(material);}
   assert.equal(h.mesh(),mesh);assert.equal(mesh.geometry,geometry);assert.equal(mesh.material,material);
   assert.equal(h.frames().length,1);assert.equal(gd(),0);assert.equal(md(),0);
   assert.equal(geometry.attributes.position.count,15);assert.equal(geometry.index.count/3,16);
   assert.equal(material.flatShading,false);assert.equal(material.transparent,false);assert.equal(material.emissive.getHex(),0);
   let lights=0;h.scene.traverse(node=>{if(node.isLight)lights++;});assert.equal(lights,0);
  }
 } finally {await h.close();}
 assert.equal(gd(),1);assert.equal(md(),1);
});

test('actual smooth geometry has finite shared normals and keeps the complete original outline and pole edge',async()=>{
 const h=harness();try {
  await h.render();const g=h.mesh().geometry,p=g.attributes.position,uv=g.attributes.uv,n=g.attributes.normal;
  const undeformed=new THREE.PlaneGeometry(2.4,1.25,4,2),original=undeformed.attributes.position;
  try {for(let i=0;i<p.count;i++){
   assert.equal(p.getX(i),original.getX(i));assert.equal(p.getY(i),original.getY(i));
   const u=uv.getX(i),v=uv.getY(i);if(u===0||u===1||v===0||v===1)assert.ok(Math.abs(p.getZ(i))<1e-15);
   assert.ok(Math.abs(p.getZ(i))<=.160001);assert.ok(Math.abs(new THREE.Vector3().fromBufferAttribute(n,i).length()-1)<1e-6);
  }} finally {undeformed.dispose();}
  assert.ok(g.index,'Adjacent faces share the same vertex normal rather than separate facet vertices');
  assert.ok(g.boundingBox.max.z-g.boundingBox.min.z>.2,'The shared geometry must retain actual folds, not a flat rectangle');
  assert.equal(h.mesh().position.x,.5);assert.equal(h.scene.getObjectByName('surrender-white-fabric-response').position.x,1);
 } finally {await h.close();}
});

test('actual event-state raise and relocation preserve their two heights while quiet and comfort stop rotation',async()=>{
 const h=harness();try {
  await h.render();assert.equal(h.cloth().position.y,.8);
  h.state.storyObjectStates={'river.white-fabric':'raised'};h.state.sceneRelocationRevision++;
  await h.render();assert.equal(h.cloth().position.y,2.3);
  h.presentation.motion.cloth=resolveSceneLook('river.release-surrender','high',false,{surrenderComplete:true}).motion.cloth;h.frame();assert.equal(h.cloth().rotation.z,0);assert.equal(h.cloth().position.y,2.3);
  h.state.storyObjectStates={};h.state.sceneRelocationRevision++;await h.render({reducedEffects:true,reducedMotion:true});h.frame();
  assert.equal(h.cloth().position.y,.8);assert.equal(h.cloth().rotation.z,0);
 } finally {await h.close();}
});
