import assert from 'node:assert/strict';
import test,{after,afterEach} from 'node:test';
import {register} from 'node:module';
register('./canonical-node-loader.mjs',import.meta.url);register('./quiet-tsx-loader.mjs',import.meta.url);
import {mount,text} from './ui-owner-harness.mjs';
const old=globalThis.window,storage=new Map();globalThis.window=Object.assign(new EventTarget(),{localStorage:{getItem:key=>storage.get(key)??null,setItem:(key,value)=>storage.set(key,value),removeItem:key=>storage.delete(key)},location:{search:'',pathname:'/'},matchMedia:()=>({matches:false})});
after(()=>{globalThis.window=old;});let cpu=null;afterEach(()=>{cpu?.unmount();cpu=null;});
const {entries:canonical}=await import('../src/data/slipperContent.ts');
const {journeyChapters,getJourneyChapterForEntry}=await import('../src/data/journeyNarrative.ts');
const {useJourneyStore}=await import('../src/stores/useJourneyStore.ts');
const {useBreadcrumbStore}=await import('../src/stores/useBreadcrumbStore.ts');
const {getSlipperExperienceCapabilities}=await import('../src/lib/experienceMode.ts');
const {ArchiveIndex}=await import('../src/components/ui/ArchiveIndex.tsx');
const {MapWorkspace}=await import('../src/ui/map/MapWorkspace.tsx');
const entries=canonical.map((entry,index)=>({...entry,title:`PRIVATE_TITLE_${index}`,body:`PRIVATE_BODY_${index}`,paragraphs:[`PRIVATE_PARAGRAPH_${index}`],tags:[`PRIVATE_TAG_${index}`]}));
const ids=entries.map(entry=>entry.id),a=entries[0],b=entries[1];
const snapshot=()=>useJourneyStore.getState().getSnapshot();
function seed(witnesses=[]){useJourneyStore.setState({activeEntryId:a.id,witnessedEntryIds:witnesses,visitedEntryIds:ids,history:ids,completedChapterIds:journeyChapters.map(chapter=>chapter.id)});useBreadcrumbStore.setState({traces:[]});}
const props={entries,activeEntryId:a.id,visitedEntryIds:ids,witnessedEntryIds:[a.id],onOpenEntry(){},onGuideEntry(){}};
async function waitForLazyMapOwner(){
 const mounted=()=>cpu.elements().some(element=>element.type==='aside'&&element.props?.className?.startsWith('constellation-panel'))
  && !cpu.elements().some(element=>element.props?.className==='forest-loader');
 const deadline=Date.now()+10_000;
 // The actual lazy TSX import needs loader I/O, not only resolved microtasks.
 // Keep first-use Suspense and yield until its production owner replaces it.
 while(!mounted()&&Date.now()<deadline)await cpu.asyncAct(()=>new Promise(resolve=>setImmediate(resolve)));
 assert.ok(mounted(),'Actual lazy ConstellationMap must mount and remove its Suspense fallback within 10 seconds');
}

const cards=()=>cpu.elements().filter(element=>element.props?.className?.startsWith('archive-index-card'));
const query=()=>cpu.elements().find(element=>element.type==='input');
function assertPrivate(output,witnesses){for(const entry of entries.filter(entry=>!witnesses.includes(entry.id)))for(const content of [entry.title,entry.body,...entry.paragraphs,...entry.tags])assert.equal(output.includes(content),false,entry.id);}

test('actual ArchiveIndex admits titles/prose/search/chapters only by canonical witnesses even when all entries are visited',()=>{
 seed([a.id]);const before=snapshot(),saved=storage.get('sidtw:journey:v3');cpu=mount(ArchiveIndex,props);assertPrivate(text(cpu.container),[a.id]);assert.equal(cards().length,66);assert.equal(cards().filter(card=>card.props.className.includes('is-visited')).length,1);
 const options=cpu.elements().filter(element=>element.type==='option');assert.deepEqual(options.map(text),['All',getJourneyChapterForEntry(a.id).title]);assert.deepEqual(snapshot(),before);assert.equal(storage.get('sidtw:journey:v3'),saved);
});

test('unwitnessed record getters are never read for display or search; remembered queries and anonymous unread routing remain usable',()=>{
 seed([a.id]);const guarded=entries.map(entry=>entry.id===a.id?entry:new Proxy(entry,{get(target,key){if(['title','body','paragraphs','tags','chapter','engine3d'].includes(key))throw Error('Private metadata read');return Reflect.get(target,key);}}));cpu=mount(ArchiveIndex,{...props,entries:guarded});
 for(const value of [b.title,b.body,b.tags[0],b.paragraphs[0]]){cpu.act(()=>query().props.onChange({target:{value}}));assert.equal(cards().length,0);}
 cpu.act(()=>query().props.onChange({target:{value:a.title}}));assert.equal(cards().length,1);assert.equal(text(cards()[0]).includes(a.title),true);
 cpu.act(()=>query().props.onChange({target:{value:'unread memory'}}));assert.equal(cards().length,65);
});

test('actual archive uses exact remembered/anonymous Guide target IDs and retained callbacks cannot switch intent after witness restoration',()=>{
 seed([a.id]);const calls=[];cpu=mount(ArchiveIndex,{...props,onOpenEntry:id=>calls.push(['open',id]),onGuideEntry:id=>calls.push(['guide',id])});
 const oldOpen=cards()[0].props.onClick,oldGuide=cards()[1].props.onClick;
 cpu.act(()=>oldOpen());cpu.act(()=>oldGuide());assert.deepEqual(calls,[['open',a.id],['guide',b.id]]);
 cpu.update({witnessedEntryIds:[b.id]});calls.length=0;cpu.act(()=>oldOpen());cpu.act(()=>oldGuide());assert.deepEqual(calls,[]);
 cpu.act(()=>cards()[0].props.onClick());cpu.act(()=>cards()[1].props.onClick());assert.deepEqual(calls,[['guide',a.id],['open',b.id]]);
});

test('legacy visited-only archive calls fail closed for private content while deprecated witnessed selection stays remembered-only',()=>{
 seed([]);const selected=[],guided=[];cpu=mount(ArchiveIndex,{entries,activeEntryId:a.id,visitedEntryIds:ids,onSelectEntry:id=>selected.push(id),onGuideEntry:id=>guided.push(id)});assertPrivate(text(cpu.container),[]);cpu.act(()=>cards()[0].props.onClick());assert.deepEqual(selected,[]);assert.deepEqual(guided,[a.id]);
 cpu.update({witnessedEntryIds:[a.id]});cpu.act(()=>cards()[0].props.onClick());assert.deepEqual(selected,[a.id]);
});

test('all66 canonical witnesses retain all fragment callbacks, full search and the 12 canonical chapter filters',()=>{
 seed(ids);const opened=[];cpu=mount(ArchiveIndex,{...props,witnessedEntryIds:ids,onOpenEntry:id=>opened.push(id)});assert.equal(cards().length,66);assert.equal(cpu.elements().filter(element=>element.type==='option').length,13);
 for(const card of cards())cpu.act(()=>card.props.onClick());assert.deepEqual(opened,ids);
 cpu.act(()=>query().props.onChange({target:{value:entries[65].paragraphs[0]}}));assert.equal(cards().length,1);assert.equal(text(cards()[0]).includes(entries[65].title),true);
});

test('the full actual desktop workspace keeps its Constellation and sibling Archive private under completed/visited legacy state',async()=>{
 seed([a.id]);const before=snapshot(),saved=storage.get('sidtw:journey:v3');cpu=mount(MapWorkspace,{capabilities:getSlipperExperienceCapabilities('free-woods'),entries,activeEntryId:a.id,visitedEntryIds:ids,witnessedEntryIds:[a.id],sceneProximity:null,mobile:false,activePane:'constellation',onChangePane(){},workspaceRef:{current:null},onReturnToForest(){},onOpenEntry(){},onGuideEntry(){}});await waitForLazyMapOwner();
 assertPrivate(text(cpu.container),[a.id]);assert.equal(cards().length,66);assert.deepEqual(cpu.elements().filter(element=>element.props?.['data-constellation-entry-id']).map(element=>element.props['data-constellation-entry-id']),[a.id]);assert.deepEqual(snapshot(),before);assert.equal(storage.get('sidtw:journey:v3'),saved);
});

test('hidden mobile Archive panel follows witness privacy too, with controlled tabs and no future metadata in its DOM',async()=>{
 seed([a.id]);cpu=mount(MapWorkspace,{capabilities:getSlipperExperienceCapabilities('free-woods'),entries,activeEntryId:a.id,visitedEntryIds:ids,witnessedEntryIds:[a.id],sceneProximity:null,mobile:true,activePane:'constellation',onChangePane(){},workspaceRef:{current:null},onReturnToForest(){},onOpenEntry(){},onGuideEntry(){}});await waitForLazyMapOwner();assertPrivate(text(cpu.container),[a.id]);const archive=cpu.elements().find(element=>element.props?.className==='archive-index');assert.equal(archive.props.hidden,true);assert.equal(archive.props.role,'tabpanel');cpu.update({activePane:'archive'});assert.equal(archive.props.hidden,false);assertPrivate(text(cpu.container),[a.id]);
});

const {RememberedPaths}=await import('../src/ui/navigation/RememberedPaths.tsx');
const pathProps={entries:[a,b],activeEntryId:a.id,witnessedEntryIds:[a.id],sceneProximity:null,recentEntries:[],chapterEntries:[],chapterProgress:[],counts:{visited:66,total:66,visuals:34,chapters:12},mobile:false,controls:'walk',showMiniMap:true,showCompass:false,showContextualGuidance:true,mobileControlMode:'direct',onSettingChange(){},onOpenEntry(){return true;},onGuideEntry(){return true;},onDismiss(){}};
function proximity(targetId){const value={navigationTargetId:targetId,approachingEntryId:a.id,nearestEntryId:a.id,playerPosition:[0,0,0],navigationTargetWorldPosition:[0,0,25],navigationTargetDistance:25,cameraYaw:0,trailState:'edge-of-trail',uiPresence:.6};for(const key of ['navigationTargetTitle','approachingTitle','nearestTitle'])Object.defineProperty(value,key,{get(){throw Error('Proximity title getter read');}});return value;}

test('remembered mini-map and contextual disclosure never read unread entry/proximity title fallbacks and preserve numeric route/yaw/range',()=>{
 seed([a.id]);const before=snapshot();const denied=new Proxy(b,{get(target,key){if(key==='title')throw Error('Unread title getter read');return Reflect.get(target,key);}});cpu=mount(RememberedPaths,{...pathProps,entries:[a,denied],sceneProximity:proximity(b.id)});
 assert.equal(text(cpu.container).includes('Unread memory'),true);assert.equal(text(cpu.container).includes('25 units'),true);assert.equal(text(cpu.container).includes(b.title),false);
 const target=cpu.elements().find(element=>element.type==='circle'&&element.props.r===4.5);assert.ok(target);assert.equal(target.props.cx,86);assert.equal(target.props.cy,86-25/32*62);
 assert.equal(text(cpu.container).includes('Ease back toward the centre of the trail.'),true);
 cpu.update({entries:[a,b],witnessedEntryIds:[a.id,b.id]});assert.equal(text(cpu.container).includes(b.title),true);assert.deepEqual(snapshot(),before);
});

test('untethered proximity titles cannot supply a route name when no exact target identifier exists',()=>{
 seed([a.id]);const facts=proximity(null);facts.approachingEntryId=null;facts.nearestEntryId=null;cpu=mount(RememberedPaths,{...pathProps,sceneProximity:facts});assert.equal(text(cpu.container).includes('The next clearing'),true);assert.equal(text(cpu.container).includes('Listening for a clearing'),true);assert.equal(text(cpu.container).includes(b.title),false);
});


test('the entire lazy full MapWorkspace rejects unwitnessed title/prose/tag getters before any display or hidden-panel search',async()=>{
 seed([a.id]);const before=snapshot();const guarded=entries.map(entry=>entry.id===a.id?entry:new Proxy(entry,{get(target,key){if(['title','body','paragraphs','tags'].includes(key))throw Error('Unwitnessed workspace metadata read');return Reflect.get(target,key);}}));
 const facts={activeEntryId:a.id,navigationTargetId:b.id,playerPosition:[0,0,0],cameraYaw:0};
 for(const key of ['navigationTargetTitle','nearestTitle','approachingTitle'])Object.defineProperty(facts,key,{get(){throw Error('Proximity title getter read');}});
 cpu=mount(MapWorkspace,{capabilities:getSlipperExperienceCapabilities('free-woods'),entries:guarded,activeEntryId:a.id,visitedEntryIds:ids,witnessedEntryIds:[a.id],sceneProximity:facts,mobile:true,activePane:'constellation',onChangePane(){},workspaceRef:{current:null},onReturnToForest(){},onOpenEntry(){},onGuideEntry(){}});
 await waitForLazyMapOwner();assertPrivate(text(cpu.container),[a.id]);
 cpu.act(()=>query().props.onChange({target:{value:'PRIVATE_BODY'}}));assert.equal(cards().length,1);assertPrivate(text(cpu.container),[a.id]);
 assert.deepEqual(snapshot(),before);
});
