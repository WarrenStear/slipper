import assert from 'node:assert/strict';
import test,{afterEach,after} from 'node:test';
import {register} from 'node:module';
register('./canonical-node-loader.mjs',import.meta.url);
register('./quiet-tsx-loader.mjs',import.meta.url);
import {mount,text,focused,clearFocused} from './ui-owner-harness.mjs';
const previous={window:globalThis.window,document:globalThis.document};
const timers=new Map();let nextTimer=0,cpu=null;
const win=new EventTarget();win.localStorage={getItem(){return null;},setItem(){throw Error('Trace must not persist');},removeItem(){}};
win.setTimeout=callback=>{const id=++nextTimer;timers.set(id,callback);return id;};win.clearTimeout=id=>timers.delete(id);
globalThis.window=win;globalThis.document=new EventTarget();
after(()=>Object.assign(globalThis,previous));afterEach(()=>{cpu?.unmount();cpu=null;assert.equal(timers.size,0);clearFocused();});
const {entries}=await import('../src/data/slipperContent.ts');
const {getJourneySceneForEntry}=await import('../src/data/journeyNarrative.ts');
const {FragmentReader}=await import('../src/ui/reader/FragmentReader.tsx');
const noop=()=>{};
const base={focusNonce:0,reducedMotion:true,reducedEffects:false,highContrast:false,mobile:false,readerTheme:'ambient',showMetrics:true,kicker:'Remembered fragment',freeWoods:false,constellationScope:'witnessed-only',canContinue:true,bookmarked:false,backAvailable:false,nextAvailable:true,onReturnToForest:noop,onFollow:noop,onSettings:noop,onConstellation:noop,onBookmark:noop,onBack:noop,onNext:noop,onContinue:noop,onArchive:noop};
test('all 66 actual reader documents keep exact prose and one anonymous trace after witness admission',()=>{
 for(const entry of entries){
  cpu=mount(FragmentReader,{...base,entry,sceneId:getJourneySceneForEntry(entry.id).id,witnessedEntryIds:[entry.id]});
  const body=cpu.elements().find(element=>element.props?.className==='reader-body');
  assert.deepEqual(body.children.map(text),entry.paragraphs?.length?entry.paragraphs:[entry.body].filter(Boolean));
  const traces=cpu.elements().filter(element=>element.props?.['data-fragment-trace']);assert.equal(traces.length,1);
  assert.equal(traces[0].props['aria-hidden'],'true');assert.equal(text(traces[0]),'');assert.equal(traces[0].props['data-trace-motion'],'static');
  assert.equal(timers.size,1);cpu.unmount();cpu=null;assert.equal(timers.size,0);
 }
});
test('trace preferences do not reset reader scroll/focus or commands; revoked witness removes the entire document',()=>{
 const entry=entries.find(entry=>getJourneySceneForEntry(entry.id).id==='river.wash');
 cpu=mount(FragmentReader,{...base,entry,sceneId:getJourneySceneForEntry(entry.id).id,witnessedEntryIds:[entry.id],reducedMotion:false});
 const document=cpu.elements().find(element=>element.props?.role==='document');
 cpu.act(()=>{for(const [id,callback]of timers){timers.delete(id);callback();}});assert.equal(focused,document);
 document.scrollTop=420;const scrolls=document.scrolls.length;
 for(const patch of [{mobile:true},{reducedEffects:true},{highContrast:true},{readerTheme:'clean'}]){
  cpu.update({...base,reducedMotion:false,...patch});assert.equal(document.scrollTop,420);assert.equal(document.scrolls.length,scrolls);assert.equal(focused,document);assert.equal(timers.size,0);
  const traces=cpu.elements().filter(element=>element.props?.['data-fragment-trace']);assert.equal(traces.length,patch.mobile?1:0);if(patch.mobile)assert.equal(traces[0].props['data-trace-motion'],'static');
 }
 cpu.update({witnessedEntryIds:[]});assert.equal(text(cpu.container),'');assert.equal(timers.size,0);
});
