import assert from 'node:assert/strict';
import test, { after, afterEach } from 'node:test';
import { register } from 'node:module';
register('./canonical-node-loader.mjs', import.meta.url);
register('./quiet-tsx-loader.mjs', import.meta.url);
import { mount, text, focused, clearFocused } from './ui-owner-harness.mjs';

const previous={window:globalThis.window,document:globalThis.document};
const timers=new Map();let nextTimer=0, persistenceWrites=0, cpu=null;
const win=new EventTarget();win.localStorage={getItem(){return null;},setItem(){persistenceWrites++;},removeItem(){}};
win.matchMedia=()=>({matches:false,addEventListener(){},removeEventListener(){}});
win.setTimeout=callback=>{const id=++nextTimer;timers.set(id,callback);return id;};win.clearTimeout=id=>timers.delete(id);
win.innerWidth=1280;win.innerHeight=900;win.location={pathname:'/'};
const doc=new EventTarget();doc.documentElement={dataset:{},style:{setProperty(){},removeProperty(){}},classList:{toggle(){}}};doc.hasFocus=()=>true;doc.hidden=false;
globalThis.window=win;globalThis.document=doc;
after(()=>{globalThis.window=previous.window;globalThis.document=previous.document;});
afterEach(()=>{cpu?.unmount();cpu=null;assert.equal(timers.size,0,'owned focus timer must release');clearFocused();});
const {entries}=await import('../src/data/slipperContent.ts');
const {useJourneyStore}=await import('../src/stores/useJourneyStore.ts');
const {useSettingsStore}=await import('../src/stores/useSettingsStore.ts');
const {getSlipperExperienceCapabilities}=await import('../src/lib/experienceMode.ts');
const {FragmentReader}=await import('../src/ui/reader/FragmentReader.tsx');
const {MapWorkspace}=await import('../src/ui/map/MapWorkspace.tsx');
const {RememberedPaths}=await import('../src/ui/navigation/RememberedPaths.tsx');
const a=entries[7], b=entries[8];
const noop=()=>{};
function snapshot(){return useJourneyStore.getState().getSnapshot();}
function seed(witnesses=[a.id]){useJourneyStore.setState({activeEntryId:a.id,witnessedEntryIds:witnesses,visitedEntryIds:[a.id,b.id]});}
const readerProps={entry:a,witnessedEntryIds:[a.id],focusNonce:0,reducedMotion:false,showMetrics:true,kicker:'Current fragment',freeWoods:false,constellationScope:'witnessed-only',canContinue:true,bookmarked:false,backAvailable:true,nextAvailable:true,onReturnToForest:noop,onFollow:noop,onSettings:noop,onConstellation:noop,onBookmark:noop,onBack:noop,onNext:noop,onContinue:noop,onArchive:noop};
function flushTimers(){cpu.act(()=>{for(const [id,callback] of [...timers]){timers.delete(id);callback();}});}

test('FragmentReader denies unwitnessed content before reading private title/prose and before scheduling focus',()=>{
 seed([]);const before=snapshot();const denied=new Proxy(a,{get(target,key){if(['title','body','paragraphs'].includes(key))throw Error('Private content read');return Reflect.get(target,key);}});
 cpu=mount(FragmentReader,{...readerProps,entry:denied,witnessedEntryIds:[]});
 assert.equal(text(cpu.container),'');assert.equal(timers.size,0);assert.deepEqual(snapshot(),before);
});

test('FragmentReader renders all 66 canonical paragraphs verbatim under canonical witness admission without commands or persistence',()=>{
 seed(entries.map(entry=>entry.id));const before=snapshot(),writes=persistenceWrites;
 for(const entry of entries){
  cpu=mount(FragmentReader,{...readerProps,entry,witnessedEntryIds:[entry.id]});
  const title=cpu.elements().find(element=>element.type==='h1');assert.equal(text(title),entry.title);
  const body=cpu.elements().find(element=>element.props?.className==='reader-body');
  assert.deepEqual(body.children.map(text),entry.paragraphs?.length?entry.paragraphs:[entry.body].filter(Boolean));
  const document=cpu.elements().find(element=>element.props?.role==='document');assert.equal(document.props['aria-labelledby'],title.props.id);assert.equal(document.props.tabIndex,-1);
  assert.equal(timers.size,1,'Strict Mode retains a single pending focus callback');
  cpu.unmount();cpu=null;assert.equal(timers.size,0);
 }
 assert.deepEqual(snapshot(),before);assert.equal(persistenceWrites,writes);
});

test('reader owns actual clamped scroll progress, entry reset, reduced-motion reset, focus nonce and cancelled focus timer',()=>{
 seed([a.id,b.id]);const before=snapshot();cpu=mount(FragmentReader,readerProps);
 let document=cpu.elements().find(element=>element.props?.role==='document');assert.deepEqual(document.scrolls.at(-1),{top:0,behavior:'smooth'});
 flushTimers();assert.equal(focused,document);
 for(const [scrollTop,expected] of [[400,50],[900,100],[-10,0]]){document.scrollTop=scrollTop;cpu.act(()=>document.props.onScroll());assert.equal(cpu.elements().find(element=>element.props?.role==='progressbar').props['aria-valuenow'],expected);}
 cpu.update({entry:b,witnessedEntryIds:[a.id,b.id],reducedMotion:true});document=cpu.elements().find(element=>element.props?.role==='document');assert.deepEqual(document.scrolls.at(-1),{top:0,behavior:'auto'});assert.equal(cpu.elements().find(element=>element.props?.role==='progressbar').props['aria-valuenow'],0);
 cpu.update({focusNonce:2});assert.equal(timers.size,1);flushTimers();assert.equal(focused,document);
 clearFocused();cpu.update({focusNonce:3});cpu.unmount();cpu=null;assert.equal(timers.size,0);assert.equal(focused,null);assert.deepEqual(snapshot(),before);
});

test('revoking witness during a pending focus removes the document and prevents an orphan focus handoff',()=>{
 seed();cpu=mount(FragmentReader,readerProps);assert.equal(timers.size,1);cpu.update({witnessedEntryIds:[]});assert.equal(timers.size,0);assert.equal(text(cpu.container),'');assert.equal(focused,null);
});

test('reader footer keeps directed and completed capabilities and delegates every accepted action to the shell',()=>{
 seed();const before=snapshot(),calls=[];const props={...readerProps};for(const key of ['onReturnToForest','onFollow','onSettings','onConstellation','onBookmark','onBack','onNext','onContinue','onArchive'])props[key]=()=>calls.push(key);
 cpu=mount(FragmentReader,props);assert.deepEqual(cpu.elements().filter(element=>element.type==='button').map(text),['Return to forest','Follow the next path','Settings','Constellation']);
 for(const label of ['Return to forest','Follow the next path','Settings','Constellation'])cpu.act(()=>cpu.button(label).props.onClick());assert.deepEqual(calls,['onReturnToForest','onFollow','onSettings','onConstellation']);
 cpu.update({freeWoods:true,constellationScope:'full',bookmarked:true,backAvailable:false,nextAvailable:false,canContinue:false});
 assert.deepEqual(cpu.elements().filter(element=>element.type==='button').map(text),['Return to forest','Settings','Remove bookmark','Back','Next fragment','Continue story','Open map','Open archive']);
 assert.equal(cpu.button('Remove bookmark').props['aria-pressed'],true);for(const label of ['Back','Next fragment','Continue story'])assert.equal(cpu.button(label).props.disabled,true);
 for(const label of ['Remove bookmark','Open map','Open archive'])cpu.act(()=>cpu.button(label).props.onClick());assert.deepEqual(calls.slice(-3),['onBookmark','onConstellation','onArchive']);assert.deepEqual(snapshot(),before);
});

const mapProps={capabilities:getSlipperExperienceCapabilities('first-journey'),entries,activeEntryId:a.id,visitedEntryIds:entries.map(entry=>entry.id),sceneProximity:null,mobile:true,activePane:'constellation',onChangePane:noop,workspaceRef:{current:null},onReturnToForest:noop,onOpenEntry:noop,onGuideEntry:noop};
async function waitForLazyMapOwner(){
 const mounted=()=>cpu.elements().some(element=>element.type==='aside'&&element.props?.className?.startsWith('constellation-panel'))
  && !cpu.elements().some(element=>element.props?.className==='forest-loader');
 const deadline=Date.now()+10_000;
 // The actual lazy TSX import needs loader I/O, not only resolved microtasks.
 // Keep first-use Suspense and yield until its production owner replaces it.
 while(!mounted()&&Date.now()<deadline)await cpu.asyncAct(()=>new Promise(resolve=>setImmediate(resolve)));
 assert.ok(mounted(),'Actual lazy ConstellationMap must mount and remove its Suspense fallback within 10 seconds');
}
test('actual directed MapWorkspace retains one named read-only panel and reveals exactly witnessed entries despite all visited IDs',async()=>{
 seed([a.id]);const before=snapshot(),calls=[],ref={current:null};cpu=mount(MapWorkspace,{...mapProps,workspaceRef:ref,onReturnToForest:()=>calls.push('forest'),onOpenEntry:id=>calls.push(id),onGuideEntry:id=>calls.push(id)});await waitForLazyMapOwner();
 assert.equal(ref.current.props['aria-label'],'Story map workspace');assert.equal(ref.current.props.tabIndex,-1);assert.equal(ref.current.props['data-constellation-scope'],'witnessed-only');
 assert.equal(cpu.elements().filter(element=>element.props?.role==='tablist').length,0);assert.equal(cpu.elements().filter(element=>element.props?.role==='tabpanel').length,0);
 assert.equal(cpu.elements().filter(element=>element.props?.className==='archive-index').length,0);
 assert.deepEqual(cpu.elements().filter(element=>element.props?.['data-constellation-entry-id']).map(element=>element.props['data-constellation-entry-id']),[a.id]);
 for(const entry of entries.filter(entry=>entry.id!==a.id))assert.equal(text(cpu.container).includes(entry.title),false,entry.id);
 assert.equal(cpu.elements().some(element=>element.props?.['data-constellation-future']==='true'),true);
 cpu.act(()=>cpu.button('Return to forest').props.onClick());assert.deepEqual(calls,['forest']);assert.deepEqual(snapshot(),before);
});

test('actual full mobile workspace preserves controlled tab selection, keyboard focus and linked panel IDs without progression',async()=>{
 seed([a.id]);const before=snapshot(),changes=[];cpu=mount(MapWorkspace,{...mapProps,capabilities:getSlipperExperienceCapabilities('free-woods'),visitedEntryIds:[a.id],onChangePane:pane=>changes.push(pane)});await waitForLazyMapOwner();
 const tabs=cpu.elements().filter(element=>element.props?.role==='tab');assert.equal(tabs.length,2);const first=tabs[0],second=tabs[1];
 assert.equal(first.props['aria-selected'],true);assert.equal(first.props.tabIndex,0);assert.equal(second.props.tabIndex,-1);
 let prevented=0;cpu.act(()=>first.props.onKeyDown({key:'End',preventDefault(){prevented++;}}));assert.deepEqual(changes,['archive']);assert.equal(prevented,1);assert.equal(focused,second);
 cpu.update({activePane:'archive'});
 const panels=cpu.elements().filter(element=>element.props?.role==='tabpanel');assert.equal(panels.length,2);
 for(const panel of panels){const tab=cpu.elements().find(element=>element.props?.id===panel.props['aria-labelledby']);assert.ok(tab);assert.equal(tab.props['aria-controls'],panel.props.id);assert.equal(panel.props.hidden,tab.props['aria-selected']!==true);}
 assert.deepEqual(snapshot(),before);
});

test('desktop workspace omits mobile tab semantics and delegates full archive callbacks without altering target IDs',async()=>{
 seed([a.id]);const calls=[];cpu=mount(MapWorkspace,{...mapProps,mobile:false,capabilities:getSlipperExperienceCapabilities('free-woods'),entries:[a,b],visitedEntryIds:[a.id],onOpenEntry:id=>calls.push(['open',id]),onGuideEntry:id=>calls.push(['guide',id])});await waitForLazyMapOwner();
 assert.equal(cpu.elements().filter(element=>element.props?.role==='tablist'||element.props?.role==='tabpanel').length,0);
 const cards=cpu.elements().filter(element=>element.props?.className?.startsWith('archive-index-card'));
 cpu.act(()=>cards[0].props.onClick());cpu.act(()=>cards[1].props.onClick());assert.deepEqual(calls,[['open',a.id],['guide',b.id]]);
});

const pathProps={entries:[a,b],activeEntryId:a.id,witnessedEntryIds:[a.id],sceneProximity:null,recentEntries:[a,b],chapterEntries:[a,b],chapterProgress:[{id:'earned',chapter:'Known chapter',revealed:true,visited:1,total:2},{id:'private',chapter:'HIDDEN FUTURE CHAPTER',revealed:false,visited:0,total:2}],counts:{visited:2,total:66,visuals:34,chapters:12},mobile:false,controls:'walk',showMiniMap:false,showCompass:false,showContextualGuidance:false,mobileControlMode:'direct',onSettingChange:noop,onOpenEntry:()=>true,onGuideEntry:()=>true,onDismiss:noop};
test('remembered paths disclose only witnessed trail/chapter titles and keep unread route labels anonymous',()=>{
 seed();const before=snapshot(),writes=persistenceWrites;cpu=mount(RememberedPaths,pathProps);
 assert.equal(text(cpu.container).includes(a.title),true);assert.equal(text(cpu.container).includes(b.title),false);assert.equal(text(cpu.container).includes('HIDDEN FUTURE CHAPTER'),false);assert.equal(text(cpu.container).includes('Unread memory 2'),true);
 const recent=cpu.elements().find(element=>element.props?.['aria-label']==='Recent remembered trail');assert.equal(recent.children.length,1);assert.equal(text(recent.children[0]),a.title);
 assert.deepEqual(snapshot(),before);assert.equal(persistenceWrites,writes);
});

test('remembered route actions retain exact target IDs and dismiss only accepted navigation or guidance',()=>{
 seed();const calls=[];let allow=false;cpu=mount(RememberedPaths,{...pathProps,onOpenEntry:id=>{calls.push(['open',id]);return true;},onGuideEntry:id=>{calls.push(['guide',id]);return allow;},onDismiss:()=>calls.push(['dismiss'])});
 cpu.act(()=>cpu.button('Unread memory 2').props.onClick());assert.deepEqual(calls,[['guide',b.id]]);
 allow=true;cpu.act(()=>cpu.button('Unread memory 2').props.onClick());assert.deepEqual(calls.slice(-2),[['guide',b.id],['dismiss']]);
 const recent=cpu.elements().find(element=>element.props?.['aria-label']==='Recent remembered trail');cpu.act(()=>recent.children[0].props.onClick());assert.deepEqual(calls.slice(-2),[['open',a.id],['dismiss']]);
});

test('opt-in map/compass and mobile preferences retain actual settings callbacks while an unwitnessed active entry stays anonymous',()=>{
 seed([]);const before=snapshot(),settings=[];const privateEntry=new Proxy(a,{get(target,key){if(['title','chapter','body','paragraphs','engine3d'].includes(key))throw Error('Unwitnessed lookup');return Reflect.get(target,key);}});
 cpu=mount(RememberedPaths,{...pathProps,entries:[privateEntry],witnessedEntryIds:[],recentEntries:[],chapterEntries:[],showMiniMap:true,showCompass:true,mobile:true,onSettingChange:(key,value)=>settings.push([key,value])});
 assert.equal(cpu.elements().filter(element=>element.props?.className==='mini-map-hud').length,0);assert.equal(text(cpu.container).includes('A path still forming'),true);assert.equal(text(cpu.container).includes('analogue pad'),true);
 const inputs=cpu.elements().filter(element=>element.type==='input');cpu.act(()=>inputs[0].props.onChange({target:{checked:false}}));cpu.act(()=>inputs[1].props.onChange({target:{checked:false}}));cpu.act(()=>inputs[3].props.onChange());assert.deepEqual(settings,[['showMiniMap',false],['showCompass',false],['mobileControlMode','guided']]);assert.deepEqual(snapshot(),before);
});
