import assert from 'node:assert/strict';
import test, { after, afterEach } from 'node:test';
import { createRequire,register } from 'node:module';
import React from 'react';
register('./canonical-node-loader.mjs',import.meta.url);
register('./quiet-tsx-loader.mjs',import.meta.url);
const oldWindow=globalThis.window,storage=new Map();
globalThis.window=Object.assign(new EventTarget(),{localStorage:{getItem:key=>storage.get(key)??null,setItem:(key,value)=>storage.set(key,value),removeItem:key=>storage.delete(key)},
  location:{search:'',pathname:'/'},matchMedia:()=>({matches:false})});
after(()=>{globalThis.window=oldWindow;});
const { useJourneyStore }=await import('../src/stores/useJourneyStore.ts');
const { useBreadcrumbStore }=await import('../src/stores/useBreadcrumbStore.ts');
const { useSettingsStore }=await import('../src/stores/useSettingsStore.ts');
const { ConstellationMap }=await import('../src/components/ui/ConstellationMap.tsx');
const { entries:canonicalEntries }=await import('../src/data/slipperContent.ts');
const { journeyScenes,journeyChapters }=await import('../src/data/journeyNarrative.ts');
const entries=canonicalEntries.map(entry=>({...entry,title:`Private memory title ${entry.id}`,body:`PRIVATE_BODY_${entry.id}`,paragraphs:[`PRIVATE_PARAGRAPH_${entry.id}`]}));
const ids=entries.map(entry=>entry.id),require=createRequire(import.meta.url),Reconciler=require('react-reconciler');
const {ConcurrentRoot,DefaultEventPriority}=require('react-reconciler/constants');
globalThis.IS_REACT_ACT_ENVIRONMENT=true;
let activeCpu=null;
afterEach(()=>activeCpu?.unmount());
const commandNames=['startStory','navigateToEntry','goBack','witnessEntry','dispatchStoryEvent','completeScene','completeChapter','completeRitual','setSafePosition'];
const original=Object.fromEntries(commandNames.map(name=>[name,useJourneyStore.getState()[name]]));
const commands=[];
function seed(patch={}){
  useJourneyStore.setState({activeEntryId:ids[0],chapterId:'broken-floor',sceneId:'broken-floor.confession',history:[],visitedEntryIds:ids,
    witnessedEntryIds:[],completedActs:[],completedRitualIds:[],completedChapterIds:[],completedSceneIds:[],worldFlags:{},landmarkStates:{},
    resonances:{wolf:0,swan:0,seer:0},inventory:{lantern:false,recoveredKeys:[],symbolicObjects:[]},releasedWords:[],storyStarted:true,storyCompleted:false,
    ...patch,...Object.fromEntries(commandNames.map(name=>[name,(...args)=>{commands.push(name);return original[name](...args);}]))});
  useSettingsStore.setState({reducedMotion:false});
  useBreadcrumbStore.setState({traces:ids.map((id,index)=>({id:`trace-${id}`,activeEntryId:id,position:[index,0,index],kind:'footprint',scale:1,intensity:1}))});
  commands.length=0;
}
const renderer=Reconciler({
  supportsMutation:true,isPrimaryRenderer:false,supportsPersistence:false,supportsHydration:false,
  getRootHostContext:()=>null,getChildHostContext:()=>null,getPublicInstance:value=>value,
  createInstance:(type,props)=>({type,props,children:[],captures:[],released:[],
    getBoundingClientRect:()=>({left:0,top:0,width:420,height:420}),setPointerCapture(id){this.captures.push(id);},
    hasPointerCapture(id){return this.captures.includes(id);},releasePointerCapture(id){this.released.push(id);}}),createTextInstance:text=>({text}),
  appendInitialChild:(parent,child)=>parent.children.push(child),appendChild:(parent,child)=>parent.children.push(child),
  appendChildToContainer:(parent,child)=>parent.children.push(child),removeChild:(parent,child)=>{parent.children=parent.children.filter(item=>item!==child);},
  removeChildFromContainer:(parent,child)=>{parent.children=parent.children.filter(item=>item!==child);},
  insertBefore(parent,child,before){parent.children=parent.children.filter(item=>item!==child);parent.children.splice(parent.children.indexOf(before),0,child);},
  insertInContainerBefore(parent,child,before){parent.children=parent.children.filter(item=>item!==child);parent.children.splice(parent.children.indexOf(before),0,child);},finalizeInitialChildren:()=>false,
  prepareForCommit:()=>null,resetAfterCommit(){},preparePortalMount(){},shouldSetTextContent:()=>false,prepareUpdate:()=>true,
  commitUpdate:(instance,payload,type,previous,next)=>{instance.props=next;},commitTextUpdate:(instance,old,text)=>{instance.text=text;},
  hideInstance(){},unhideInstance(){},hideTextInstance(){},unhideTextInstance(){},getCurrentEventPriority:()=>DefaultEventPriority,
  beforeActiveInstanceBlur(){},afterActiveInstanceBlur(){},detachDeletedInstance(){},clearContainer:container=>{container.children=[];},
  scheduleTimeout:setTimeout,cancelTimeout:clearTimeout,noTimeout:-1,
});
const all=element=>[element,...(element.children??[]).flatMap(all)];
const text=element=>element.text??element.children?.map(text).join('')??'';
const hasClass=(element,name)=>(element.props?.className??'').split(' ').includes(name);
function mount(props={}){
  const opened=[],guided=[],container={children:[]};let setProps;
  function Harness(){const[current,set]=React.useState({entries,activeEntryId:ids[0],visitedEntryIds:ids,
    onOpenEntry:id=>opened.push(id),onGuideEntry:id=>guided.push(id),...props});setProps=set;return React.createElement(ConstellationMap,current);}
  const root=renderer.createContainer(container,ConcurrentRoot,null,true,null,'',error=>{throw error;},null);
  const render=child=>React.act(()=>renderer.flushSync(()=>renderer.updateContainer(child,root,null,null)));
  const before=useJourneyStore.getState().getSnapshot(),saved=storage.get('sidtw:journey:v3');
  render(React.createElement(React.StrictMode,null,React.createElement(Harness)));
  assert.deepEqual(useJourneyStore.getState().getSnapshot(),before);assert.equal(storage.get('sidtw:journey:v3'),saved);assert.deepEqual(commands,[]);
  activeCpu={container,opened,guided,all:()=>all(container),act:callback=>React.act(()=>renderer.flushSync(callback)),
    update:next=>React.act(()=>renderer.flushSync(()=>setProps(current=>({...current,...next})))),
    unmount(){render(null);activeCpu=null;assert.deepEqual(commands,[]);}};
  return activeCpu;
}
function assertPrivate(cpu,witnessed,{anonymousGuide=false}={}){
  const elements=cpu.all(),output=text(cpu.container)+' '+elements.map(element=>[element.props?.['aria-label'],element.props?.title].filter(Boolean).join(' ')).join(' ');
  for(const entry of entries){assert.equal(output.includes(entry.body),false);assert.equal(output.includes(entry.paragraphs[0]),false);
    if(!witnessed.includes(entry.id))assert.equal(output.includes(entry.title),false,`Future title ${entry.id} must stay private`);}
  const named=elements.filter(element=>element.props?.['data-constellation-entry-id']);
  assert.deepEqual(named.map(element=>element.props['data-constellation-entry-id']).sort(),[...witnessed].sort());
  const rows=elements.filter(element=>hasClass(element,'constellation-row'));assert.equal(rows.length,witnessed.length);
  const future=elements.filter(element=>element.props?.['data-constellation-future']==='true');assert.equal(future.length,66-witnessed.length);
  for(const dot of future){assert.equal(dot.type,'circle');assert.equal(dot.props['aria-hidden'],'true');
    for(const field of ['role','tabIndex','aria-label','title','data-constellation-entry-id'])assert.equal(dot.props[field],undefined);}
  const guide=elements.filter(element=>hasClass(element,'constellation-guidance-point'));
  assert.equal(guide.length,anonymousGuide?1:0);for(const point of guide){assert.equal(point.props['data-constellation-entry-id'],undefined);assert.equal(point.props['aria-label'],'Guide through the forest to an unread memory');}
}

test('actual full/default and partial React map keep merely visited/current/completed/history titles private',()=>{
  for(const scope of [undefined,'full','witnessed-only']){
    seed({history:ids,completedSceneIds:journeyScenes.map(scene=>scene.id),completedChapterIds:journeyChapters.map(chapter=>chapter.id)});
    const cpu=mount({scope,sceneProximity:{activeEntryId:ids[0],navigationTargetId:ids[20],playerPosition:[0,0,0],cameraYaw:0}});
    assertPrivate(cpu,[],{anonymousGuide:scope!=='witnessed-only'});
    assert.equal(cpu.all().find(element=>element.type==='aside').props['data-constellation-growth'],'dark');cpu.unmount();
  }
});

test('actual full anonymous unread Guide retains navigation capability without exposing a title, chapter or prose',()=>{
  seed({witnessedEntryIds:[ids[0]]});const cpu=mount({sceneProximity:{activeEntryId:ids[0],navigationTargetId:ids[20],playerPosition:[0,0,0],cameraYaw:0}});
  assertPrivate(cpu,[ids[0]],{anonymousGuide:true});
  const ghost=cpu.all().find(element=>hasClass(element,'constellation-guidance-point'));
  assert.equal(ghost.props.tabIndex,0);let prevented=0;
  cpu.act(()=>ghost.props.onKeyDown({key:'Enter',preventDefault(){prevented++;}}));
  cpu.act(()=>ghost.props.onKeyDown({key:' ',preventDefault(){prevented++;}}));cpu.act(()=>ghost.props.onClick());
  assert.equal(prevented,2);assert.deepEqual(cpu.guided,[ids[20],ids[20],ids[20]]);assert.deepEqual(cpu.opened,[]);cpu.unmount();
});

test('actual66 earned rows/node receipts, completed callbacks, panel labels and keyboard activation survive extraction',()=>{
  seed({witnessedEntryIds:ids,history:ids.slice(0,-1),completedSceneIds:journeyScenes.map(scene=>scene.id),completedChapterIds:journeyChapters.map(chapter=>chapter.id)});
  const cpu=mount({panelId:'memory-panel',labelledBy:'memory-tab'});assertPrivate(cpu,ids);
  const panel=cpu.all().find(element=>element.type==='aside');assert.equal(panel.props.id,'memory-panel');assert.equal(panel.props.role,'tabpanel');assert.equal(panel.props['aria-labelledby'],'memory-tab');
  const active=cpu.all().find(element=>element.props?.['data-constellation-entry-id']===ids[0]);assert.equal(active.props.tabIndex,0);
  cpu.act(()=>active.props.onKeyDown({key:'Enter',preventDefault(){}}));cpu.act(()=>active.props.onKeyDown({key:' ',preventDefault(){}}));
  for(const row of cpu.all().filter(element=>hasClass(element,'constellation-row')))cpu.act(()=>row.props.onClick());
  assert.equal(cpu.opened.length,68);assert.deepEqual(cpu.guided,[]);assert.equal(panel.props['data-constellation-growth'],'whole');cpu.unmount();
});

test('actual retained remembered and anonymous callbacks recheck current witnesses after restore instead of switching action semantics',()=>{
  seed({witnessedEntryIds:[ids[0],ids[7]]});const cpu=mount({sceneProximity:{activeEntryId:ids[0],navigationTargetId:ids[20],playerPosition:[0,0,0],cameraYaw:0}});
  const remembered=cpu.all().find(element=>hasClass(element,'constellation-row')).props.onClick;
  const guide=cpu.all().find(element=>hasClass(element,'constellation-guidance-point')).props.onClick;
  cpu.act(()=>useJourneyStore.setState({witnessedEntryIds:[ids[20]]}));
  cpu.act(()=>{remembered();guide();});assert.deepEqual(cpu.opened,[]);assert.deepEqual(cpu.guided,[]);
  assertPrivate(cpu,[ids[20]]);cpu.unmount();
});

test('actual readonly partial viewer cannot open or guide; deprecated callback remains remembered-only',()=>{
  seed({witnessedEntryIds:[ids[0],ids[7]]});const readonly=mount({scope:'witnessed-only',onOpenEntry:undefined,onGuideEntry:undefined});
  assertPrivate(readonly,[ids[0],ids[7]]);for(const row of readonly.all().filter(element=>hasClass(element,'constellation-row'))){assert.equal(row.props.disabled,true);readonly.act(()=>row.props.onClick());}
  assert.deepEqual(readonly.opened,[]);assert.deepEqual(readonly.guided,[]);readonly.unmount();
  const selected=[];seed({witnessedEntryIds:[ids[0]]});const legacy=mount({onOpenEntry:undefined,onGuideEntry:undefined,onSelectEntry:id=>selected.push(id)});
  legacy.act(()=>legacy.all().find(element=>hasClass(element,'constellation-row')).props.onClick());assert.deepEqual(selected,[ids[0]]);legacy.unmount();
});

test('actual pointer capture/pan/zoom/reset and reduced-motion view changes alter no story progress or persisted envelope',()=>{
  seed({witnessedEntryIds:[ids[0],ids[7]]});const cpu=mount();const before=useJourneyStore.getState().getSnapshot(),saved=storage.get('sidtw:journey:v3');
  const svg=cpu.all().find(element=>element.type==='svg');
  cpu.act(()=>svg.props.onPointerDown({target:{closest:()=>null},currentTarget:svg,pointerId:4,clientX:10,clientY:10}));
  cpu.act(()=>svg.props.onPointerMove({pointerId:4,clientX:30,clientY:45}));
  cpu.act(()=>svg.props.onPointerUp({currentTarget:svg,pointerId:4}));assert.deepEqual(svg.captures,[4]);assert.deepEqual(svg.released,[4]);
  cpu.act(()=>svg.props.onWheel({preventDefault(){},clientX:100,clientY:100,deltaY:-10000}));
  assert.ok(cpu.all().some(element=>element.props?.transform?.includes('scale(3.400)')));
  cpu.act(()=>cpu.all().find(element=>hasClass(element,'constellation-map-reset')).props.onClick());
  assert.ok(cpu.all().some(element=>element.props?.transform==='translate(0.0 0.0) scale(1.000)'));
  cpu.act(()=>useSettingsStore.setState({reducedMotion:true}));assert.equal(cpu.all().find(element=>element.type==='aside').props['data-constellation-motion'],'reduced');
  assert.deepEqual(useJourneyStore.getState().getSnapshot(),before);assert.equal(storage.get('sidtw:journey:v3'),saved);cpu.unmount();
});
