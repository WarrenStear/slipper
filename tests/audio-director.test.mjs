import test,{after} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire,register } from 'node:module';
import { fileURLToPath,pathToFileURL } from 'node:url';
import vm from 'node:vm';
const overlay=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'),out=path.join(overlay,'tests/fixtures/audio-domain');
const require=createRequire(path.join(overlay,'package.json')),React=require('react'),jsx=require('react/jsx-runtime'),ts=require('typescript'),Reconciler=require('react-reconciler');
const {ConcurrentRoot,DefaultEventPriority}=require('react-reconciler/constants');
register(pathToFileURL(path.join(overlay,'tests/canonical-node-loader.mjs')),import.meta.url);
const load=rel=>import(pathToFileURL(path.join(overlay,rel)).href);
const THREE=await import(pathToFileURL(path.join(overlay,'node_modules/three/build/three.module.js')).href);
const runtime=await load('src/components/three/audio/narrativeAudioRuntime.ts'),profiles=await load('src/components/three/audio/narrativeAudioProfiles.ts'),volume=await load('src/lib/audioVolume.ts'),foreground=await load('src/components/three/audio/audioForeground.ts'),approach=await load('src/components/three/audio/audioApproach.ts'),events=await load('src/components/three/audio/storyEventAudio.ts'),loader=await load('src/components/three/audio/productionAudioLoader.ts'),blueprint=await load('src/data/journeyBlueprint.ts'),looks=await load('src/components/three/artDirection/SceneLookRegistry.ts');
const {RecordedTarget,nativeAudioHarness}=await import('./audioTestHarness.mjs');
globalThis.IS_REACT_ACT_ENVIRONMENT=true;
const priorGlobals={window:globalThis.window,document:globalThis.document};after(()=>{globalThis.window=priorGlobals.window;globalThis.document=priorGlobals.document;});
const Window=new RecordedTarget(),Document=new RecordedTarget();let focused=true,activatedContext=null,presentation=null;
Document.hidden=false;Document.hasFocus=()=>focused;globalThis.window=Window;globalThis.document=Document;
const frames=new Set(),accepted=new Set(),camera=new THREE.PerspectiveCamera();
function store(initial){let state=initial;const listeners=new Set();const value=selector=>React.useSyncExternalStore(callback=>{listeners.add(callback);return()=>listeners.delete(callback);},()=>selector(state));value.getState=()=>state;value.subscribe=callback=>{listeners.add(callback);return()=>listeners.delete(callback);};value.set=next=>{state={...state,...next};for(const callback of [...listeners])callback();};value.count=()=>listeners.size;return value;}
const useSettingsStore=store({audioEnabled:true,audioVolume:.65,reducedEffects:false,reducedMotion:false,drawerOpen:false});
const useJourneyStore=store({chapterId:'enchanted-wood',sceneId:'enchanted.rabbit-hole',resonances:{wolf:0,swan:0,seer:0},releasedWords:[],completedRitualIds:[]});
const activation={NARRATIVE_AUDIO_ACTIVATION_EVENT:'sidtw:narrative-audio-activation',getGestureActivatedNarrativeAudioContext:()=>activatedContext};
const film={audioPressure:1,silenceBias:0,lowpassHz:18000};
const fiber={useThree:()=>({camera}),useFrame(callback){const ref=React.useRef(callback);ref.current=callback;React.useLayoutEffect(()=>{frames.add(ref);return()=>frames.delete(ref);},[]);}};
function compiled(name,dependencies){const exports={};const source=fs.readFileSync(path.join(overlay,'src/components/three/audio',name),'utf8');vm.runInNewContext(ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText,{exports,require:id=>{assert.ok(id in dependencies,'Unexpected actual audio owner dependency '+id);return dependencies[id];},window:Window,document:Document,performance:globalThis.performance});return exports;}
const hook=compiled('useStoryEventAudio.ts',{react:React,'@react-three/fiber':fiber,'../../../storyEvents/acceptedStoryEvents':{subscribeAcceptedStoryEvents(callback){accepted.add(callback);return()=>accepted.delete(callback);}},'../../../lib/narrativeAudioActivation':activation,'./storyEventAudio':events,'./narrativeAudioRuntime':runtime,'./audioForeground':foreground});
const Director=compiled('NarrativeAudioDirector.tsx',{react:React,'react/jsx-runtime':jsx,'@react-three/fiber':fiber,three:THREE,'../../../stores/useJourneyStore':{useJourneyStore},'../../../stores/useSettingsStore':{useSettingsStore},'../../../lib/audioVolume':volume,'../../../lib/narrativeAudioActivation':activation,'../../../cinematics/emotionalCinematography':{getCurrentCinematicProfile:()=>film},'../../../data/journeyBlueprint':blueprint,'../artDirection/SceneLookContext':{useSceneLook:()=>presentation},'./useStoryEventAudio':hook,'./narrativeAudioRuntime':runtime,'./productionAudioLoader':loader,'./narrativeAudioProfiles':profiles,'./audioForeground':foreground,'./audioApproach':approach}).NarrativeAudioDirector;
const renderer=Reconciler({supportsMutation:true,isPrimaryRenderer:false,supportsPersistence:false,supportsHydration:false,getRootHostContext:()=>null,getChildHostContext:()=>null,getPublicInstance:x=>x,createInstance(type,props){const instance=type==='primitive'?props.object:new THREE.Group();instance.name=props.name??instance.name;instance.userData=props.userData??{};return instance;},createTextInstance:()=>({}),appendInitialChild:(p,c)=>p.add(c),appendChild:(p,c)=>p.add(c),appendChildToContainer:(p,c)=>p.children.push(c),removeChild:(p,c)=>p.remove(c),removeChildFromContainer:(p,c)=>{p.children=p.children.filter(x=>x!==c);},insertBefore:()=>{},insertInContainerBefore:()=>{},finalizeInitialChildren:()=>false,prepareForCommit:()=>null,resetAfterCommit:()=>{},preparePortalMount:()=>{},shouldSetTextContent:()=>false,prepareUpdate:()=>true,commitUpdate:()=>{},commitTextUpdate:()=>{},hideInstance:()=>{},unhideInstance:()=>{},hideTextInstance:()=>{},unhideTextInstance:()=>{},getCurrentEventPriority:()=>DefaultEventPriority,beforeActiveInstanceBlur:()=>{},afterActiveInstanceBlur:()=>{},detachDeletedInstance:()=>{},clearContainer:c=>{c.children=[];},scheduleTimeout:setTimeout,cancelTimeout:clearTimeout,noTimeout:-1});
function mount({strict=false,target=null,quality='high',gesture=true}={}){
 assert.equal(frames.size,0);assert.equal(accepted.size,0);assert.equal(Window.count(),0);assert.equal(Document.count(),0);assert.equal(useSettingsStore.count(),0);
 focused=true;Document.hidden=false;presentation={look:looks.SCENE_LOOKS['enchanted.rabbit-hole'],stillness:0};
 useSettingsStore.set({audioEnabled:true,audioVolume:.65,reducedEffects:false,reducedMotion:false,drawerOpen:false});
 useJourneyStore.set({chapterId:'enchanted-wood',sceneId:'enchanted.rabbit-hole',resonances:{wolf:0,swan:0,seer:0},releasedWords:[],completedRitualIds:[]});
 const h=nativeAudioHarness();h.listener.getInput().disconnect();activatedContext=gesture?h.context:null;
 const container={children:[]},root=renderer.createContainer(container,ConcurrentRoot,null,strict,null,'',e=>{throw e;},null);
 const render=element=>React.act(()=>renderer.flushSync(()=>renderer.updateContainer(element,root,null,null)));
 const tree=()=>React.createElement(Director,{qualityProfile:{quality},approachTarget:target});
 render(strict?React.createElement(React.StrictMode,null,tree()):tree());
 const voices=()=>container.children[0]?.children??[];
 return{...h,voices,render,tick(delta=1/60){React.act(()=>{h.context.currentTime+=delta;for(const ref of [...frames])ref.current({camera},delta);});},changeSettings(next){React.act(()=>useSettingsStore.set(next));},unmount(){render(null);assert.equal(frames.size,0);assert.equal(accepted.size,0);assert.equal(Window.count(),0);assert.equal(Document.count(),0);assert.equal(useSettingsStore.count(),0);assert.equal(camera.children.length,0);assert.equal(h.connected().length,0);assert.equal(h.context.closeCalls,0);}};
}
const publish=ids=>{for(const callback of [...accepted])callback({sceneId:'blue-moon.sanctuary',eventIds:ids});};
const loops=h=>h.sources.filter(x=>x.loop&&x.started&&!x.stopped&&!x.ended).length;
const transients=h=>h.sources.filter(x=>!x.loop&&x.started&&!x.stopped&&!x.ended).length;
test('actual owner preserves dry numeric gain/lowpass targets and exactly two existing frame subscribers',()=>{
 const h=mount();assert.equal(frames.size,2);assert.equal(h.voices().length,10);assert.equal(loops(h),10);assert.equal(h.buffers.length,10);assert.equal(h.nodes.filter(x=>x.kind==='pan').length,0);
 const profile=profiles.resolveNarrativeAudioProfile(useJourneyStore.getState()),expected=Object.fromEntries(profiles.NARRATIVE_AUDIO_STEM_IDS.map(id=>[id,{volume:0,cutoff:600}]));
 for(let frame=0;frame<120;frame++){
  h.tick();const blend=1-Math.exp(-(1/60)*1.8);
  for(const voice of h.voices()){const id=voice.name.split('.').at(-1),target=profiles.resolveNarrativeStemTarget({volume:0,lowpassHz:0},id,profile,presentation.look,0,film),e=expected[id];e.volume=THREE.MathUtils.lerp(e.volume,target.volume*.65,blend);if(target.volume===0&&e.volume<.00001)e.volume=0;e.cutoff=THREE.MathUtils.lerp(e.cutoff,Math.min(3600,target.lowpassHz),blend);assert.equal(voice.getVolume(),e.volume);assert.equal(voice.getFilter().frequency.value,e.cutoff);}
 }
 h.unmount();
});
test('actual StrictMode effect replay reuses the weak ten-buffer bank and releases every owned graph on each remount',()=>{
 for(let iteration=0;iteration<3;iteration++){const h=mount({strict:true});assert.equal(frames.size,2);assert.equal(loops(h),10);assert.equal(h.buffers.length,10);h.tick();h.unmount();assert.equal(h.context.resumeCalls,0);}
});
test('actual owner waits for the existing gesture context and pauses synchronously for focus/settings/hidden/pagehide without frames',()=>{
 const h=mount({gesture:false});assert.equal(loops(h),0);assert.equal(h.context.resumeCalls,0);assert.equal(transients(h),0);
 activatedContext=h.context;React.act(()=>Window.dispatchEvent(new Event(activation.NARRATIVE_AUDIO_ACTIVATION_EVENT)));assert.equal(loops(h),10);h.tick();
 publish(['blue-moon.candle-chain','blue-moon.roses-carried','nest.first-hand','nest.second-hand']);assert.equal(transients(h),3);
 const descendant=new Event('blur'),button=new EventTarget();button.dispatchEvent(descendant);for(const callback of Window.handlers.get('blur').keys())callback(descendant);assert.equal(loops(h),10);assert.equal(transients(h),3);
 React.act(()=>Window.dispatchEvent(new Event('blur')));assert.equal(loops(h),0);assert.equal(transients(h),0);assert.equal(camera.children[0].getMasterVolume(),0);publish(['nest.first-hand']);assert.equal(transients(h),0);
 React.act(()=>Window.dispatchEvent(new Event('focus')));assert.equal(loops(h),10);
 for(const value of [{drawerOpen:true},{audioEnabled:false},{audioVolume:0}]){h.changeSettings(value);assert.equal(loops(h),0);assert.equal(transients(h),0);h.changeSettings({drawerOpen:false,audioEnabled:true,audioVolume:.65});assert.equal(loops(h),10);}
 Document.hidden=true;React.act(()=>Document.dispatchEvent(new Event('visibilitychange')));assert.equal(loops(h),0);Document.hidden=false;React.act(()=>Document.dispatchEvent(new Event('visibilitychange')));assert.equal(loops(h),10);
 React.act(()=>Window.dispatchEvent(new Event('pagehide')));assert.equal(loops(h),0);React.act(()=>Window.dispatchEvent(new Event('pageshow')));assert.equal(loops(h),10);assert.equal(h.context.resumeCalls,0);h.unmount();
});
test('actual admitted approach uses existing voices only, respects reduced spatial gates and cannot fill shared quiet',()=>{
 const target={sceneId:'river.wash',position:[12,0,-6],water:true,wood:false,fire:false,cloth:true},h=mount({target});h.tick();assert.equal(loops(h),10);assert.equal(h.buffers.length,10);assert.equal(h.nodes.filter(x=>x.kind==='pan').length,2);assert.equal(frames.size,2);
 const water=h.voices().find(x=>x.name.endsWith('.water'));assert.ok(water.getFilters()[1].pan.value>0);h.changeSettings({reducedMotion:true});h.tick();assert.equal(water.getFilters().length,1);
 h.changeSettings({reducedMotion:false});presentation.stillness=1;h.tick();assert.equal(water.getFilters().length,1);assert.equal(h.buffers.length,10);h.unmount();
});
