import assert from 'node:assert/strict';
import test,{afterEach,after} from 'node:test';
import {createRequire,register} from 'node:module';
import {readFileSync}from 'node:fs';
import vm from 'node:vm';
import React from 'react';
import *as jsxRuntime from 'react/jsx-runtime';
import ts from 'typescript';
register('./canonical-node-loader.mjs',import.meta.url);register('./quiet-tsx-loader.mjs',import.meta.url);
const require=createRequire(import.meta.url), Reconciler=require("react-reconciler");
const { ConcurrentRoot, DefaultEventPriority }=require("react-reconciler/constants");
globalThis.IS_REACT_ACT_ENVIRONMENT=true;
let focused=null;
const renderer=Reconciler({
  supportsMutation:true,isPrimaryRenderer:false,supportsPersistence:false,supportsHydration:false,
  getRootHostContext:()=>null,getChildHostContext:()=>null,getPublicInstance:value=>value,
  createInstance:(type,props)=>({type,props,children:[],isConnected:true,open:false,
    showModal(){this.open=true;},close(){this.open=false;},setAttribute(name){if(name==="open")this.open=true;},
    focus(){focused=this;}}),createTextInstance:text=>({text,isConnected:true}),
  appendInitialChild:(parent,child)=>parent.children.push(child),appendChild:(parent,child)=>parent.children.push(child),
  appendChildToContainer:(parent,child)=>parent.children.push(child),
  removeChild:(parent,child)=>{parent.children=parent.children.filter(item=>item!==child);child.isConnected=false;},
  removeChildFromContainer:(parent,child)=>{parent.children=parent.children.filter(item=>item!==child);child.isConnected=false;},
  insertBefore(parent,child,before){parent.children=parent.children.filter(node=>node!==child);parent.children.splice(parent.children.indexOf(before),0,child);},insertInContainerBefore(parent,child,before){parent.children=parent.children.filter(node=>node!==child);parent.children.splice(parent.children.indexOf(before),0,child);},finalizeInitialChildren:()=>false,
  prepareForCommit:()=>null,resetAfterCommit(){},preparePortalMount(){},shouldSetTextContent:()=>false,
  prepareUpdate:()=>true,commitUpdate:(instance,payload,type,previous,next)=>{instance.props=next;},commitTextUpdate:(instance,old,text)=>{instance.text=text;},
  hideInstance(){},unhideInstance(){},hideTextInstance(){},unhideTextInstance(){},
  getCurrentEventPriority:()=>DefaultEventPriority,beforeActiveInstanceBlur(){},afterActiveInstanceBlur(){},
  detachDeletedInstance(){},clearContainer:container=>{container.children=[];},
  scheduleTimeout:setTimeout,cancelTimeout:clearTimeout,noTimeout:-1,
});
const text=element=>element.text??element.children?.map(text).join("")??"";
const all=element=>[element,...(element.children??[]).flatMap(all)];
function mount(Component,props={}){
  let setProps;
  const container={children:[]};
  function Harness(){const [current,set]=React.useState(props);setProps=set;return React.createElement(Component,current);}
  const root=renderer.createContainer(container,ConcurrentRoot,null,true,null,"",error=>{throw error;},null);
  const render=child=>React.act(()=>renderer.flushSync(()=>renderer.updateContainer(child,root,null,null)));
  render(React.createElement(React.StrictMode,null,React.createElement(Harness)));
  return {container,async asyncAct(callback){await React.act(async()=>{await callback();for(let i=0;i<30;i++)await Promise.resolve();});},act(callback){React.act(()=>{renderer.flushSync(()=>{callback();});});},
    update(next){React.act(()=>{renderer.flushSync(()=>{setProps(current=>({...current,...next}));});});},
    elements:()=>all(container),button:label=>all(container).find(element=>element.type==="button"&&text(element)===label),
    unmount(){render(null);}};
}
class RecordedTarget extends EventTarget{records=[];addEventListener(type,listener,options){this.records.push({type,listener,options});super.addEventListener(type,listener,options);}removeEventListener(type,listener,options){this.records=this.records.filter(item=>item.type!==type||item.listener!==listener);super.removeEventListener(type,listener,options);}}
const previous={window:globalThis.window,document:globalThis.document,fetch:globalThis.fetch,createImageBitmap:globalThis.createImageBitmap};
const semanticNodes=[];
const win=new RecordedTarget(),doc=new RecordedTarget();
doc.createElement=tag=>({tag,attributes:{},setAttribute(name,value){this.attributes[name]=value;},remove(){const index=semanticNodes.indexOf(this);if(index>=0)semanticNodes.splice(index,1);}});let hasFocus=true,requests=0,bitmapClosed=0,activeCpu=null;
win.localStorage={getItem(){return null;},setItem(){},removeItem(){}};win.matchMedia=()=>({matches:false});doc.hidden=false;doc.hasFocus=()=>hasFocus;doc.documentElement={classList:{toggle(){}},dataset:{}};
globalThis.window=win;globalThis.document=doc;globalThis.fetch=async()=>{requests++;return new Response(new Uint8Array(3),{headers:{'content-type':'image/jpeg'}});};globalThis.createImageBitmap=async()=>({width:853,height:1280,close(){bitmapClosed++;}});
after(()=>Object.assign(globalThis,previous));afterEach(()=>{activeCpu?.unmount();activeCpu=null;assert.equal(win.records.length,0);assert.equal(doc.records.length,0);assert.equal(semanticNodes.length,0,'Admitted alt removed with owner');});
const journey=await import('../src/stores/useJourneyStore.ts'),settings=await import('../src/stores/useSettingsStore.ts'),world=await import('../src/stores/useWorldStore.ts'),content=await import('../src/data/slipperContent.ts'),narrative=await import('../src/data/journeyNarrative.ts');
const admission=await import('../src/photos/photoMemoryAdmission.ts'),geometry=await import('../src/photos/photoMemoryGeometry.ts'),textures=await import('../src/photos/photoMemoryTextures.ts');
const {FragmentTrace}=await import('../src/ui/reader/FragmentTrace.tsx');
const source=readFileSync(new URL('../src/photos/PhotoMemory.tsx',import.meta.url),'utf8');
const exports={},rendererKey={domElement:{ownerDocument:doc,parentElement:{appendChild:node=>semanticNodes.push(node)}}};let lease={};let mobile=false;
const modules={'react':React,'react/jsx-runtime':jsxRuntime,'three':await import('three'),
 '@react-three/fiber':{useThree:()=>({gl:rendererKey})},
 '../hooks/useMobileViewport':{useMobileViewport:()=>({isMobile:mobile})},'../data/slipperContent':content,
 '../experience/StoryRuntimeContext':{useStoryRuntimeHost:()=>({runtime:{currentLease:()=>lease}})},
 '../stores/useJourneyStore':journey,'../stores/useSettingsStore':settings,'../stores/useWorldStore':world,
 './photoMemoryAdmission':admission,'./photoMemoryGeometry':geometry,'./photoMemoryTextures':textures};
vm.runInNewContext(ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX}}).outputText,
 {exports,require:name=>{assert.ok(name in modules,name);return modules[name];},window:win,document:doc});
const {PhotoMemory,MemoryShrine}=exports;
const entry=content.entries.find(entry=>entry.id==='fragment-008'),scene=narrative.getJourneySceneForEntry(entry.id),explicit={...entry,linkedVisualId:entry.engine3d.linkedVisualId};
function seed(){hasFocus=true;doc.hidden=false;requests=0;bitmapClosed=0;lease={};mobile=false;journey.useJourneyStore.setState({activeEntryId:entry.id,sceneId:scene.id,witnessedEntryIds:[entry.id],inventory:{...journey.useJourneyStore.getState().inventory,lantern:true}});settings.useSettingsStore.setState({drawerOpen:false,reducedEffects:false,reducedMotion:true});world.useWorldStore.setState({mode:'explore',physicsPaused:false});}
const props={entryId:entry.id,intent:'inspection',position:[0,.42,-6.15],quality:'high',entries:[explicit],visuals:content.visuals};

test('an explicitly supplied URL replacement with the same visual ID immediately retires the previous image',async()=>{
 seed();activeCpu=mount(PhotoMemory,props);await activeCpu.asyncAct(()=>{});
 const oldImage=activeCpu.elements().find(el=>el.type==='mesh'&&el.props.material.map);
 assert.ok(oldImage);const oldTexture=oldImage.props.material.map;let disposed=0;
 oldTexture.addEventListener('dispose',()=>disposed++);
 const previousDecode=globalThis.createImageBitmap;let complete;
 globalThis.createImageBitmap=()=>new Promise(resolve=>{complete=resolve;});
 try{
  const replacement=content.visuals.map(visual=>visual.id===explicit.linkedVisualId?{...visual,src:'/visuals/replacement-capability-fixture.jpg'}:visual);
  activeCpu.update({visuals:replacement});
  assert.equal(activeCpu.elements().filter(el=>el.type==='mesh').length,0,'Prior disposed map cannot remain bound during replacement');
  assert.equal(disposed,1);await activeCpu.asyncAct(()=>{});assert.equal(requests,2);
  await activeCpu.asyncAct(()=>complete({width:853,height:1280,close(){bitmapClosed++;}}));
  const next=activeCpu.elements().find(el=>el.type==='mesh'&&el.props.material.map);
  assert.ok(next);assert.notEqual(next.props.material.map,oldTexture);
 }finally{globalThis.createImageBitmap=previousDecode;}
});

test('actual PhotoMemory/legacy adapter mount and current canonical maps issue no photo request without an authored explicit relationship',async()=>{
 seed();const before=journey.useJourneyStore.getState().getSnapshot();
 activeCpu=mount(PhotoMemory,{...props,entries:content.entries});await activeCpu.asyncAct(()=>{});assert.equal(requests,0);assert.equal(activeCpu.elements().filter(el=>el.type==='mesh').length,0);activeCpu.unmount();activeCpu=null;
 activeCpu=mount(MemoryShrine,{entry,visual:content.visuals.find(visual=>visual.id===entry.engine3d.linkedVisualId),intent:'inspection'});await activeCpu.asyncAct(()=>{});assert.equal(requests,0);assert.deepEqual(journey.useJourneyStore.getState().getSnapshot(),before);
});
test('actual rendered photo has two bounded draws and an admitted semantic image; hidden/overlay/restore disposal releases owned texture, bitmap, geometry and materials',async()=>{
 seed();const before=journey.useJourneyStore.getState().getSnapshot();activeCpu=mount(PhotoMemory,props);await activeCpu.asyncAct(()=>{});
 assert.equal(requests,1);const meshes=activeCpu.elements().filter(el=>el.type==='mesh');assert.equal(meshes.length,2);
 assert.equal(meshes.reduce((sum,mesh)=>sum+mesh.props.geometry.index.count/3,0),50);
 assert.equal(semanticNodes.length,1);const image=semanticNodes[0];assert.equal(image.attributes.role,'img');assert.equal(image.attributes['aria-label'],content.visuals.find(visual=>visual.id===entry.engine3d.linkedVisualId).alt);
 const resources=meshes.flatMap(mesh=>[mesh.props.geometry,mesh.props.material]);const counts=new Map(resources.map(resource=>[resource,0]));for(const resource of resources)resource.addEventListener('dispose',()=>counts.set(resource,counts.get(resource)+1));
 let textureDisposed=0;meshes[1].props.material.map.addEventListener('dispose',()=>textureDisposed++);
 activeCpu.act(()=>settings.useSettingsStore.setState({drawerOpen:true}));assert.equal(activeCpu.elements().filter(el=>el.type==='mesh').length,0);assert.equal(textureDisposed,1);assert.equal(bitmapClosed,1);assert.equal(semanticNodes.length,0);
 for(const count of counts.values())assert.equal(count,1);assert.deepEqual(textures.photoMemoryTexturePool(rendererKey).inspect(),{ownedSources:0,inFlight:0,consumers:0});
 assert.deepEqual(journey.useJourneyStore.getState().getSnapshot(),before);
});
test('actual photo gates opening/mobile/low/reduced/unwitnessed/stale scope before metadata or texture work',async()=>{
 seed();const denied=new Proxy([],{get(){throw Error('Denied metadata read');}});
 for(const setup of [()=>journey.useJourneyStore.setState({sceneId:'broken-floor.confession'}),()=>{mobile=true;},()=>settings.useSettingsStore.setState({reducedEffects:true}),()=>journey.useJourneyStore.setState({witnessedEntryIds:[]}),()=>{lease=null;},()=>{hasFocus=false;}]){
  seed();setup();activeCpu=mount(PhotoMemory,{...props,entries:denied,visuals:denied});await activeCpu.asyncAct(()=>{});assert.equal(requests,0);assert.equal(activeCpu.elements().filter(el=>el.type==='mesh').length,0);activeCpu.unmount();activeCpu=null;
 }
 seed();activeCpu=mount(PhotoMemory,{...props,quality:'low',entries:denied,visuals:denied});await activeCpu.asyncAct(()=>{});assert.equal(requests,0);
});
test('actual FragmentTrace DOM is decorative, contains no IDs/titles/prose/photos and retains static mobile/reduced preferences without persistence changes',()=>{
 seed();const before=journey.useJourneyStore.getState().getSnapshot();const input={entryId:entry.id,sceneId:scene.id,witnessedEntryIds:[entry.id],reducedMotion:false,reducedEffects:false,highContrast:false,mobile:false,readerTheme:'ambient'};
 activeCpu=mount(FragmentTrace,input);let span=activeCpu.elements().find(el=>el.type==='span');assert.ok(span);assert.equal(span.props['aria-hidden'],'true');assert.equal(span.props.role,undefined);assert.equal(span.props.tabIndex,undefined);
 assert.equal(text(activeCpu.container),'');assert.equal(JSON.stringify(span.props).includes('/visuals/'),false);assert.equal(JSON.stringify(span.props).includes(entry.id),false);assert.equal(JSON.stringify(span.props).includes(entry.title),false);
 activeCpu.update({mobile:true});span=activeCpu.elements().find(el=>el.type==='span');assert.equal(span.props['data-trace-motion'],'static');
 for(const patch of [{witnessedEntryIds:[]},{highContrast:true},{readerTheme:'clean'},{reducedEffects:true}]){activeCpu.update({...input,...patch});assert.equal(activeCpu.elements().filter(el=>el.type==='span').length,0);}
 assert.deepEqual(journey.useJourneyStore.getState().getSnapshot(),before);
});
test('actual photo unmount aborts an in-progress decode and a late bitmap cannot populate the replacement private view',async()=>{
 seed();const previousDecode=globalThis.createImageBitmap;let complete,started=0;
 globalThis.createImageBitmap=()=>{started++;return new Promise(resolve=>{complete=resolve;});};
 try{
  activeCpu=mount(PhotoMemory,props);await activeCpu.asyncAct(()=>{});assert.equal(started,1);assert.equal(requests,1);
  const before=journey.useJourneyStore.getState().getSnapshot();activeCpu.update({entryId:'fragment-001'});
  assert.equal(activeCpu.elements().filter(el=>el.type==='mesh').length,0);assert.equal(textures.photoMemoryTexturePool(rendererKey).inspect().ownedSources,0);
  await activeCpu.asyncAct(()=>complete({width:853,height:1280,close(){bitmapClosed++;}}));
  assert.equal(bitmapClosed,1);assert.deepEqual(textures.photoMemoryTexturePool(rendererKey).inspect(),{ownedSources:0,inFlight:0,consumers:0});
  assert.equal(activeCpu.elements().filter(el=>el.type==='mesh').length,0);assert.equal(requests,1);assert.deepEqual(journey.useJourneyStore.getState().getSnapshot(),before);
 }finally{globalThis.createImageBitmap=previousDecode;}
});
test('actual photo pagehide ownership cannot reopen from a misleading visibility event, and only pageshow restores availability',async()=>{
 seed();activeCpu=mount(PhotoMemory,props);await activeCpu.asyncAct(()=>{});assert.equal(requests,1);
 activeCpu.act(()=>win.dispatchEvent(new Event('pagehide')));assert.equal(activeCpu.elements().filter(el=>el.type==='mesh').length,0);assert.equal(bitmapClosed,1);
 activeCpu.act(()=>doc.dispatchEvent(new Event('visibilitychange')));await activeCpu.asyncAct(()=>{});assert.equal(requests,1,'Page-hidden visibility cannot start another request');
 activeCpu.act(()=>win.dispatchEvent(new Event('pageshow')));await activeCpu.asyncAct(()=>{});assert.equal(requests,2);assert.equal(activeCpu.elements().filter(el=>el.type==='mesh').length,2);
});
