import assert from "node:assert/strict";
import test from "node:test";
import { createRequire, register } from "node:module";
import React from "react";

register("./canonical-node-loader.mjs", import.meta.url);
register("./quiet-tsx-loader.mjs", import.meta.url);
const { ExperienceMenu } = await import("../src/ui/ExperienceMenu.tsx");
const { QuietGuidance } = await import("../src/ui/QuietGuidance.tsx");
const { OpeningGuidance } = await import("../src/ui/OpeningGuidance.tsx");
const { getSlipperExperienceCapabilities } = await import("../src/lib/experienceMode.ts");
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
  insertBefore(){},insertInContainerBefore(){},finalizeInitialChildren:()=>false,
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
  return {container,act(callback){React.act(()=>{renderer.flushSync(()=>{callback();});});},
    update(next){React.act(()=>{renderer.flushSync(()=>{setProps(current=>({...current,...next}));});});},
    elements:()=>all(container),button:label=>all(container).find(element=>element.type==="button"&&text(element)===label),
    unmount(){render(null);}};
}

test("actual controlled Memories opens/closes its native dialog, returns focus on dismiss, and cleanup closes only its lifetime",()=>{
  let cpu;
  const props={open:false,onOpenChange:open=>cpu.update({open}),capabilities:getSlipperExperienceCapabilities("free-woods"),
    fragmentAvailable:true,onFragment(){},onConstellation(){},onArchive(){},onSettings(){}};
  cpu=mount(ExperienceMenu,props);
  const trigger=cpu.button("Memories"),dialog=cpu.elements().find(element=>element.type==="dialog");
  assert.equal(dialog.open,false);cpu.act(()=>trigger.props.onClick());assert.equal(dialog.open,true);
  let prevented=false;cpu.act(()=>dialog.props.onCancel({preventDefault(){prevented=true;}}));
  assert.equal(prevented,true);assert.equal(dialog.open,false);assert.equal(focused,trigger);
  cpu.act(()=>trigger.props.onClick());cpu.act(()=>dialog.props.onClick({target:dialog,currentTarget:dialog}));
  assert.equal(dialog.open,false);assert.equal(focused,trigger);
  cpu.act(()=>trigger.props.onClick());cpu.act(()=>dialog.props.onKeyDown({key:"Escape",preventDefault(){}}));
  assert.equal(dialog.open,false);assert.equal(focused,trigger);
  cpu.act(()=>trigger.props.onClick());assert.equal(dialog.open,true);cpu.unmount();assert.equal(dialog.open,false);
});
test("a rejected Fragment remains in Memories; accepted explicit actions hand focus to their destination without restoring to a removed menu",()=>{
  let cpu,accepted=false;const calls=[],destination={focus(){focused=this;}};
  cpu=mount(ExperienceMenu,{open:true,onOpenChange:open=>cpu.update({open}),
    capabilities:getSlipperExperienceCapabilities("free-woods"),fragmentAvailable:true,
    onFragment(){calls.push("fragment");if(!accepted)return false;destination.focus();return true;},
    onConstellation(){calls.push("constellation");destination.focus();},onArchive(){calls.push("archive");},onSettings(){calls.push("settings");destination.focus();}});
  const dialog=cpu.elements().find(element=>element.type==="dialog");
  cpu.act(()=>cpu.button("Fragment").props.onClick());assert.equal(dialog.open,true);assert.deepEqual(calls,["fragment"]);
  accepted=true;cpu.act(()=>cpu.button("Fragment").props.onClick());assert.equal(dialog.open,false);assert.equal(focused,destination);
  cpu.update({open:true});cpu.act(()=>cpu.button("Settings").props.onClick());assert.equal(dialog.open,false);assert.equal(focused,destination);
  assert.deepEqual(calls,["fragment","fragment","settings"]);cpu.unmount();
});
test('Memories keyboard wrap ignores controls with no visible layout inside collapsed paths',()=>{
  const cpu=mount(ExperienceMenu,{open:true,onOpenChange(){},capabilities:getSlipperExperienceCapabilities('free-woods'),
    fragmentAvailable:true,onFragment(){},onConstellation(){},onArchive(){},onSettings(){}});
  const dialog=cpu.elements().find(element=>element.type==='dialog');
  const first=cpu.button('Close'),last={hidden:false,offsetParent:dialog,closest:()=>null,getClientRects:()=>[{width:120,height:44}],focus(){focused=this;}};
  first.hidden=false;first.offsetParent=dialog;first.getClientRects=()=>[{width:44,height:44}];
  first.closest=()=>null;
  let pathsClosed=true;
  const closedDetails={querySelector:()=>last};
  last.contains=element=>element===last;
  last.closest=()=>pathsClosed?closedDetails:null;
  const collapsed={hidden:false,offsetParent:dialog,closest:()=>pathsClosed?closedDetails:null,getClientRects:()=>[{width:100,height:44}],focus(){focused=this;}};
  dialog.querySelectorAll=()=>[first,last,collapsed];
  const prior=globalThis.document;globalThis.document={activeElement:first};
  try{
    let prevented=false;
    cpu.act(()=>dialog.props.onKeyDown({key:'Tab',shiftKey:true,currentTarget:dialog,preventDefault(){prevented=true;}}));
    assert.equal(prevented,true);assert.equal(focused,last);
    globalThis.document.activeElement=last;prevented=false;
    cpu.act(()=>dialog.props.onKeyDown({key:'Tab',shiftKey:false,currentTarget:dialog,preventDefault(){prevented=true;}}));
    assert.equal(prevented,true);assert.equal(focused,first);
    pathsClosed=false;globalThis.document.activeElement=first;
    cpu.act(()=>dialog.props.onKeyDown({key:'Tab',shiftKey:true,currentTarget:dialog,preventDefault(){}}));
    assert.equal(focused,collapsed,'Open disclosure admits its visible route controls');
  }finally{cpu.unmount();globalThis.document=prior;}
});
test('opening guidance focuses only explicit Help after its actual paragraph commits',()=>{
  focused=null;
  const cpu=mount(OpeningGuidance,{line:'Look down.',hint:'Drag across the water.',detailed:false,stage:1,focusRequested:false});
  assert.equal(focused,null,'Idle disclosure does not take focus');
  cpu.update({detailed:true,stage:3,focusRequested:true});
  const paragraph=cpu.elements().find(element=>element.type==='p');
  assert.equal(focused,paragraph);
  focused=null;cpu.update({line:'Wipe the wet floor.'});
  assert.equal(focused,null,'Presentation renders do not refocus the requested paragraph');
  cpu.unmount();
});
test("the actual QuietGuidance preserves deliberate aftermath hold/dismiss, next-step disclosure, and scene changes reset only view state",()=>{
  const calls=[];let cpu;
  const consequence={eventId:"broken-floor.first-wipe",line:"A clear patch opens in the water.",held:false,
    onHeldChange:held=>calls.push(["hold",held]),onDismiss:()=>calls.push(["dismiss"])};
  cpu=mount(QuietGuidance,{sceneId:"broken-floor.confession",kind:"action",eventIds:[consequence.eventId],line:consequence.line,
    instruction:"Wipe the wet floor.",hint:"Drag across the water.",detailsOpen:true,onCloseDetails:()=>calls.push(["less"]),
    consequence,onNextStepOpenChange:open=>calls.push(["step",open])});
  calls.length=0;
  cpu.act(()=>cpu.button("Stay with this moment").props.onClick());cpu.act(()=>cpu.button("Show my next step").props.onClick());
  assert.deepEqual(calls,[["hold",true],["step",true]]);
  const section=cpu.elements().find(element=>element.type==="section");assert.equal(section.props.hidden,false);
  cpu.update({onNextStepOpenChange:open=>calls.push(["new-step",open])});assert.equal(section.props.hidden,false,"callback identity cannot close an explicitly opened step");
  cpu.act(()=>cpu.button("Continue").props.onClick());assert.ok(calls.some(call=>call[0]==="dismiss"));
  cpu.update({sceneId:"enchanted.rabbit-hole",consequence:null,line:"A small light moves deeper into the leaves."});
  assert.equal(cpu.button("Continue"),undefined);assert.ok(calls.some(call=>call[0]==="new-step"&&call[1]===false));
  cpu.unmount();
});

test('actual GuidedStoryMoment discloses current authored help only on request, retains fresh action guards, and Less guidance moves focus before removing controls',async()=>{
 const previous={window:globalThis.window,document:globalThis.document};const win=new EventTarget(),doc=new EventTarget();
 win.localStorage={getItem(){return null;},setItem(){},removeItem(){}};win.matchMedia=()=>({matches:false});doc.hidden=false;doc.hasFocus=()=>true;doc.documentElement={classList:{toggle(){}},dataset:{}};
 globalThis.window=win;globalThis.document=doc;
 const {default:Guide}=await import('../src/components/ui/GuidedStoryMoment.tsx');
 const {useJourneyStore}=await import('../src/stores/useJourneyStore.ts');const {useSettingsStore}=await import('../src/stores/useSettingsStore.ts');
 const {getJourneyScene}=await import('../src/data/journeyNarrative.ts');let cpu;const calls=[];
 useJourneyStore.setState({sceneId:'enchanted.masked-hearth'});useSettingsStore.setState({drawerOpen:false,showContextualGuidance:false,reducedMotion:true});
 const before=useJourneyStore.getState().getSnapshot();
 try{
  cpu=mount(Guide,{sceneId:'enchanted.masked-hearth',canRead:true,onRead:()=>calls.push('read'),detailRequested:null,
    onQuietFocusRequest:()=>calls.push('focus-memories'),onDetailRequestedChange:requested=>{calls.push(['detail',requested]);cpu.update({detailRequested:requested});}});
  assert.equal(cpu.elements().filter(el=>el.type==='button').length,0);assert.ok(text(cpu.container).includes(getJourneyScene('enchanted.masked-hearth').presentation.guidanceLines[0]));
  cpu.update({detailRequested:true});const read=cpu.button('Read this memory');assert.ok(read);cpu.act(()=>read.props.onClick());assert.deepEqual(calls,['read']);
  cpu.act(()=>cpu.button('Less guidance').props.onClick());assert.deepEqual(calls.slice(-2),['focus-memories',['detail',false]]);assert.equal(cpu.button('Read this memory'),undefined);
  cpu.update({detailRequested:true});const oldRead=cpu.button('Read this memory').props.onClick;
  cpu.act(()=>useSettingsStore.setState({drawerOpen:true}));assert.equal(text(cpu.container),'');cpu.act(()=>oldRead());assert.equal(calls.filter(call=>call==='read').length,1);
  assert.deepEqual(useJourneyStore.getState().getSnapshot(),before);assert.equal(useSettingsStore.getState().showContextualGuidance,false,'Help did not persist stronger assistance');
 }finally{cpu?.unmount();globalThis.window=previous.window;globalThis.document=previous.document;}
});
test('actual accepted aftermath queue survives quiet disclosure, held/dismissed controls remain presentation-only, and cleanup releases its clock',async()=>{
 const previous={window:globalThis.window,document:globalThis.document,requestAnimationFrame:globalThis.requestAnimationFrame,cancelAnimationFrame:globalThis.cancelAnimationFrame};
 const win=new EventTarget(),doc=new EventTarget(),frames=new Map();let frameId=0;
 win.localStorage={getItem(){return null;},setItem(){},removeItem(){}};doc.hidden=false;doc.hasFocus=()=>true;doc.documentElement={classList:{toggle(){}},dataset:{}};
 globalThis.window=win;globalThis.document=doc;globalThis.requestAnimationFrame=fn=>{const id=++frameId;frames.set(id,fn);return id;};globalThis.cancelAnimationFrame=id=>frames.delete(id);
 const {default:Guide}=await import('../src/components/ui/GuidedStoryMoment.tsx');const {useJourneyStore}=await import('../src/stores/useJourneyStore.ts');const {useSettingsStore}=await import('../src/stores/useSettingsStore.ts');
 const {publishAcceptedStoryEvents}=await import('../src/storyEvents/acceptedStoryEvents.ts');const {storyAftermathFor}=await import('../src/storyEvents/storyAftermath.ts');
 let cpu;useJourneyStore.setState({sceneId:'enchanted.masked-hearth'});useSettingsStore.setState({drawerOpen:false,showContextualGuidance:false,reducedMotion:true});
 const before=useJourneyStore.getState().getSnapshot(),event='enchanted.hearth-unease',moment=storyAftermathFor('enchanted.masked-hearth',event);assert.ok(moment);
 try{
  cpu=mount(Guide,{sceneId:'enchanted.masked-hearth',detailRequested:null});cpu.act(()=>publishAcceptedStoryEvents('enchanted.masked-hearth',[event]));
  assert.ok(text(cpu.container).includes(moment.line));assert.equal(cpu.button('Stay with this moment'),undefined,'Default consequence remains a single line');
  cpu.update({detailRequested:true});cpu.act(()=>cpu.button('Stay with this moment').props.onClick());
  assert.equal(cpu.button('Stay with this moment').props['aria-pressed'],true);
  for(let now=0;now<8000;now+=100){const pending=[...frames.values()];frames.clear();cpu.act(()=>pending.forEach(fn=>fn(now)));}
  assert.ok(text(cpu.container).includes(moment.line),'An explicitly held caption cannot expire');
  cpu.act(()=>cpu.button('Show my next step').props.onClick());assert.equal(cpu.elements().find(el=>el.type==='section').props.hidden,false);
  cpu.act(()=>cpu.button('Continue').props.onClick());assert.equal(text(cpu.container).includes(moment.line),false);assert.equal(frames.size,0);
  assert.deepEqual(useJourneyStore.getState().getSnapshot(),before);cpu.unmount();cpu=null;assert.equal(frames.size,0);
 }finally{cpu?.unmount();Object.assign(globalThis,previous);}
});
test('the actual inline semantic adapter keeps immediate authored controls, Hide/Show, focus return and held captions without discovery delays',async()=>{
 const previous={window:globalThis.window,document:globalThis.document,requestAnimationFrame:globalThis.requestAnimationFrame,cancelAnimationFrame:globalThis.cancelAnimationFrame};
 const win=new EventTarget(),doc=new EventTarget(),frames=new Map();let id=0;
 win.localStorage={getItem(){return null;},setItem(){},removeItem(){}};doc.hidden=false;doc.hasFocus=()=>true;doc.documentElement={classList:{toggle(){}},dataset:{}};
 globalThis.window=win;globalThis.document=doc;globalThis.requestAnimationFrame=fn=>{frames.set(++id,fn);return id;};globalThis.cancelAnimationFrame=id=>frames.delete(id);
 const {default:Guide}=await import('../src/components/ui/GuidedStoryMoment.tsx');const {useJourneyStore}=await import('../src/stores/useJourneyStore.ts');const {useSettingsStore}=await import('../src/stores/useSettingsStore.ts');const {publishAcceptedStoryEvents}=await import('../src/storyEvents/acceptedStoryEvents.ts');
 let cpu;useJourneyStore.setState({sceneId:'broken-floor.confession'});useSettingsStore.setState({drawerOpen:false,showContextualGuidance:false});const before=useJourneyStore.getState().getSnapshot();
 try{
  cpu=mount(Guide,{sceneId:'broken-floor.confession',inline:true,idleMs:0});
  assert.ok(text(cpu.container).includes('Wipe the wet floor.'));assert.ok(cpu.button('What do I do?'));
  cpu.act(()=>publishAcceptedStoryEvents('broken-floor.confession',['broken-floor.first-wipe']));cpu.act(()=>cpu.button('Stay with this moment').props.onClick());
  const hide=cpu.elements().find(el=>el.type==='button'&&el.props['aria-label']==='Hide story guidance');assert.ok(hide);cpu.act(()=>hide.props.onClick());
  const show=cpu.button('Show story guidance');assert.ok(show);assert.equal(focused,show);
  for(let now=0;now<5000;now+=100){const pending=[...frames.values()];frames.clear();cpu.act(()=>pending.forEach(fn=>fn(now)));}
  cpu.act(()=>show.props.onClick());assert.ok(text(cpu.container).includes('A clear patch opens in the water.'));assert.equal(cpu.button('Stay with this moment').props['aria-pressed'],true);
  assert.deepEqual(useJourneyStore.getState().getSnapshot(),before);assert.equal(useSettingsStore.getState().showContextualGuidance,false);
 }finally{cpu?.unmount();assert.equal(frames.size,0);Object.assign(globalThis,previous);}
});
