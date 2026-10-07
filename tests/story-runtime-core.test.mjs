import assert from "node:assert/strict";
import test from "node:test";
import { register } from "node:module";
register("./canonical-node-loader.mjs", import.meta.url);
const { createStoryRuntime, deriveStoryRuntime } = await import("../src/narrative/StoryRuntime.ts");
const { useJourneyStore } = await import("../src/stores/useJourneyStore.ts");
const {
  JOURNEY_BEAT_IDS_BY_ACT, JOURNEY_ENTRY_PROGRESS, JOURNEY_LANDMARK_IDS,
  JOURNEY_RECOVERED_KEY_IDS, JOURNEY_RITUAL_IDS, JOURNEY_SYMBOLIC_OBJECT_IDS,
  JOURNEY_WORLD_FLAG_IDS, getJourneyRitualBeat, getJourneyBeat, journeyBeats,
  journeyActs, journeyChapters, journeyScenes,
} = await import("../src/data/journeyBlueprint.ts");
const { createFreshStoryJourneyState, sanitizeStoryJourneyState } = await import("../src/lib/storyJourneyState.ts");
const { JOURNEY_PLAYER_ACTIONS, resolveJourneyPlayerActionTargetLocalPosition } = await import("../src/lib/journeyPlayerActions.ts");
const { getJourneySceneArrivalHeading } = await import("../src/data/journeyWorldLayout.ts");
const { STORY_EVENTS, getAvailableStoryEvents } = await import("../src/storyEvents/storyEventRegistry.ts");
const { journeyBeatTransitionDelay } = await import("../src/lib/journeyBeatTransition.ts");
const { JOURNEY_RITUAL_PROGRESSION } = await import("../src/lib/journeyProgression.ts");
const { dispatchStoryEventState } = await import("../src/storyEvents/storyEventState.ts");
const { applyJourneyOutcome, applyPlayerActionOutcome } = await import("../src/narrative/StoryActions.ts");
const { createPhysicalObservationPort } = await import("../src/player/physicalObservation.ts");

const entryIds = Object.keys(JOURNEY_ENTRY_PROGRESS);
const options = { fallbackEntryId: entryIds[0], validEntryIds: entryIds,
  entryProgress: JOURNEY_ENTRY_PROGRESS, beatIdsByAct: JOURNEY_BEAT_IDS_BY_ACT,
  ritualIds: JOURNEY_RITUAL_IDS, worldFlagIds: JOURNEY_WORLD_FLAG_IDS,
  landmarkIds: JOURNEY_LANDMARK_IDS, recoveredKeyIds: JOURNEY_RECOVERED_KEY_IDS,
  symbolicObjectIds: JOURNEY_SYMBOLIC_OBJECT_IDS, now: () => "2026-10-06T10:00:00.000Z" };
const values = new Map();
globalThis.window = { localStorage: { getItem: key => values.get(key) ?? null,
  setItem: (key,value) => values.set(key,value), removeItem: key => values.delete(key) } };
const fresh = (overrides={}) => ({ ...createFreshStoryJourneyState(options), ...overrides });
function setFixture(snapshot=fresh()) {
  useJourneyStore.setState({ ...snapshot, sceneRelocationRevision: 0, isInitialized: true,
    playerPosition: null, lastSafeEntryId: snapshot.activeEntryId });
}
function fixtureFor(scene, extra={}) {
  const index=journeyScenes.indexOf(scene), prior=journeyScenes.slice(0,index).map(s=>s.id);
  return sanitizeStoryJourneyState(fresh({ activeEntryId:scene.keystoneEntryId,
    storyStarted:true, completedSceneIds:prior,
    completedChapterIds:journeyChapters.filter(c=>c.sceneIds.every(id=>prior.includes(id))).map(c=>c.id),
    completedRitualIds:JOURNEY_RITUAL_IDS,
    worldFlags:Object.fromEntries(JOURNEY_WORLD_FLAG_IDS.map(id=>[id,true])),
    inventory:{lantern:true,recoveredKeys:JOURNEY_RECOVERED_KEY_IDS,symbolicObjects:JOURNEY_SYMBOLIC_OBJECT_IDS},
    ...extra }),options);
}
function runtime(snapshot=fresh(),trace=null,traceNames=null) {
  setFixture(snapshot);
  const activity={ready:true,foreground:true,overlayOpen:false,participating:true,reducedMotion:false};
  let cachedState=null,cachedView=null;
  const names=traceNames??["completeRitual","setWorldFlag","setLandmarkState","addResonance","awardLantern","recoverKey","collectSymbolicObject","releaseWord","completeAct","completeStory"];
  const getState=()=>{
    const state=useJourneyStore.getState();if(!trace)return state;
    if(state!==cachedState){cachedState=state;cachedView={...state,...Object.fromEntries(names.map(name=>[name,(...args)=>{trace.push([name,...args]);return state[name](...args);}]))};}
    return cachedView;
  };
  const session=createStoryRuntime({getState,getActivity:()=>activity,
    subscribe:listener=>useJourneyStore.subscribe(listener)});
  const disconnect=session.bind();
  return { session,activity,disconnect,state:useJourneyStore.getState };
}
function begin(context,type="begin") {
  const result=context.session.dispatch({type});assert.equal(result.accepted,true,result.reason);return result.lease;
}
function executeEvent(context,event,lease=context.session.currentLease()) {
  if (!event.durationMs) return context.session.dispatch({type:"event",eventId:event.id,lease});
  const token=context.session.beginAttention(lease,event.id);assert.ok(token,event.id);
  context.session.sampleAttention(token,0,true);
  let result;
  for(let now=100;now<=event.durationMs+100;now+=100){result=context.session.sampleAttention(token,now,true);if(result.result.accepted)return result.result;}
  return result.result;
}

test("construction/binding/subscriptions/reading/disconnecting/disposal never progress or serialize session state",()=>{
  for(const snapshot of [fresh(),fixtureFor(journeyScenes[7]),fixtureFor(journeyScenes.at(-1),{storyCompleted:true,completedSceneIds:journeyScenes.map(s=>s.id),completedChapterIds:journeyChapters.map(c=>c.id)})]){
    setFixture(snapshot);const before=JSON.stringify(useJourneyStore.getState().getSnapshot());
    const session=createStoryRuntime({getState:useJourneyStore.getState,getActivity:()=>({ready:true,foreground:true,overlayOpen:false,participating:true}),subscribe:l=>useJourneyStore.subscribe(l)});
    const release=session.bind();
    for(let frame=0;frame<240;frame++){deriveStoryRuntime(useJourneyStore.getState());assert.equal(session.currentLease(),null);session.refreshActivity();}
    release();session.bind()();session.dispose();
    assert.equal(JSON.stringify(useJourneyStore.getState().getSnapshot()),before);
    assert.equal(session.dispatch({type:"begin"}).accepted,false);
  }
});

test("only explicit Begin creates scene entry; it does not witness prose, and fresh gates reject stale/locked navigation",()=>{
  const c=runtime();const lease=begin(c);
  assert.equal(c.state().storyStarted,true);assert.ok(c.state().completedStoryEventIds.includes("broken-floor.confession.enter"));
  assert.deepEqual(c.state().witnessedEntryIds,[]);
  const before=c.state().getSnapshot();
  for(const intent of [{type:"navigate",entryId:"unknown"},{type:"navigate",entryId:"fragment-066"},{type:"navigate",entryId:"fragment-002",expectedEntryId:"fragment-003"},{type:"read",entryId:"fragment-003",lease}])assert.equal(c.session.dispatch(intent).accepted,false);
  assert.deepEqual(c.state().getSnapshot(),before);
  assert.equal(c.session.dispatch({type:"read",entryId:"fragment-001",lease}).accepted,true);
  assert.ok(c.state().witnessedEntryIds.includes("fragment-001"));c.session.dispose();
});

test("every canonical scene has an explicit entry edge, and all34 authored entry events retain their reducer outcomes",()=>{
  const authored=STORY_EVENTS.filter(e=>e.trigger==="scene-enter");assert.equal(authored.length,34);
  const seen=new Set();
  for(const scene of journeyScenes){
    const c=runtime(fixtureFor(scene));const before=c.state();
    const expected=dispatchStoryEventState(before,{sceneId:scene.id,trigger:"scene-enter"});
    const result=c.session.dispatch({type:"continue"});assert.equal(result.accepted,true,scene.id);
    for(const id of expected.eventIds){assert.ok(result.eventIds.includes(id));seen.add(id);}
    for(const id of authored.filter(e=>e.sceneId===scene.id).map(e=>e.id))assert.ok(c.state().completedStoryEventIds.includes(id),id);
    assert.deepEqual(c.state().storyObjectStates,expected.state.storyObjectStates,scene.id);
    c.session.dispose();
  }
  assert.equal(seen.size,34);
});

test("only explicit foreground Continue recovers a locked River to admitted Fire without earning missing rites or completion",()=>{
  const river=journeyScenes.find(scene=>scene.id==="river.wash"),fire=journeyScenes.find(scene=>scene.id==="fire.boundary");
  const names=["startStory","navigateToEntry","dispatchStoryEvent","witnessEntry","enterBeat","completeRitual","completeScene","completeChapter","completeAct","completeStory"];
  for(const legacy of [false,true]){
    const trace=[],snapshot=fixtureFor(river,{history:[fire.keystoneEntryId,"fragment-066"],
      completedRitualIds:JOURNEY_RITUAL_IDS.filter(id=>id!=="ritual.burn-boundary"),
      completedStoryEventIds:legacy?[]:["broken-floor.confession.enter"],
      witnessedEntryIds:[fire.keystoneEntryId,river.keystoneEntryId]});
    const c=runtime(snapshot,trace,names),before=c.state().getSnapshot();
    c.state().lastSafeEntryId="fragment-066";
    assert.equal(c.session.currentLease(),null);c.session.sample(5000);
    assert.deepEqual(trace,[]);assert.deepEqual(c.state().getSnapshot(),before,"Binding/sampling cannot infer recovery");
    assert.equal(c.session.dispatch({type:"begin"}).accepted,false);assert.deepEqual(trace,[]);
    for(const denial of [{ready:false},{foreground:false},{overlayOpen:true}]){
      Object.assign(c.activity,denial);assert.equal(c.session.dispatch({type:"continue"}).accepted,false);
      assert.deepEqual(c.state().getSnapshot(),before);assert.deepEqual(trace,[]);
      Object.assign(c.activity,{ready:true,foreground:true,overlayOpen:false});
    }
    const revision=c.state().sceneRelocationRevision,result=c.session.dispatch({type:"continue"});
    assert.equal(result.accepted,true);assert.equal(result.settled,0);assert.ok(result.lease);
    assert.equal(c.state().activeEntryId,fire.keystoneEntryId);assert.equal(c.state().sceneId,fire.id);
    assert.equal(c.state().sceneRelocationRevision,revision,"Recovery uses the normal canonical navigation revision contract");
    assert.equal(c.session.currentLease(),result.lease);
    assert.ok(result.eventIds.every(id=>STORY_EVENTS.some(event=>event.id===id&&event.sceneId===fire.id&&event.trigger==="scene-enter")));
    for(const field of ["completedRitualIds","completedSceneIds","completedChapterIds","completedActs","witnessedEntryIds","inventory","resonances","releasedWords","storyCompleted"]){
      assert.deepEqual(c.state().getSnapshot()[field],before[field],field);
    }
    assert.ok(!c.state().completedRitualIds.includes("ritual.burn-boundary"));assert.ok(!c.state().completedSceneIds.includes(river.id));
    assert.deepEqual(trace.map(([name])=>name),["navigateToEntry","startStory","dispatchStoryEvent"]);
    assert.ok(!c.state().completedStoryEventIds.includes("river.entered"));c.session.dispose();
  }
});

test("valid Continue retains its canonical entry path and unknown restored entries remain nonmutating",()=>{
  const names=["startStory","navigateToEntry","dispatchStoryEvent","witnessEntry"];
  for(const scene of journeyScenes){
    const trace=[],c=runtime(fixtureFor(scene),trace,names),active=c.state().activeEntryId,revision=c.state().sceneRelocationRevision;
    const result=c.session.dispatch({type:"continue"});assert.equal(result.accepted,true,scene.id);
    assert.equal(c.state().activeEntryId,active);assert.equal(c.state().sceneRelocationRevision,revision);
    assert.equal(trace.filter(([name])=>name==="navigateToEntry").length,0);
    assert.deepEqual(trace.slice(0,2).map(([name])=>name),["startStory","dispatchStoryEvent"]);
    assert.equal(trace.filter(([name])=>name==="witnessEntry").length,0);c.session.dispose();
  }
  const trace=[],c=runtime(fresh({activeEntryId:"unknown"}),trace,names),before=c.state().getSnapshot();
  assert.equal(c.session.dispatch({type:"continue"}).accepted,false);assert.deepEqual(trace,[]);
  assert.deepEqual(c.state().getSnapshot(),before);assert.equal(c.session.currentLease(),null);c.session.dispose();
});

test("accepted lantern placement earns reverse-light only on explicit epilogue entry, preserving strict scene ownership",()=>{
  const scene=journeyScenes.find(s=>s.id==="crowned.sovereignty");
  const c=runtime(fixtureFor(scene,{worldFlags:{"story-events.started":true},storyObjectStates:{"lantern.master":"carried"},completedStoryEventIds:["crown.recognised"],storyPlacementStates:{},witnessedEntryIds:[scene.keystoneEntryId]}));
  const placement=STORY_EVENTS.find(e=>e.id==="lantern.placed.mirror");
  assert.ok(placement);
  const lease=begin(c,"continue");assert.ok(!c.state().completedStoryEventIds.includes("epilogue.reverse-light-started"));
  const before=c.state().getSnapshot();c.session.refreshActivity();assert.equal(c.session.dispatch({type:"event",eventId:"unknown",lease}).accepted,false);
  assert.deepEqual(c.state().getSnapshot(),before);
  const result=executeEvent(c,placement,lease);assert.equal(result.accepted,true,result.reason);
  assert.ok(!result.eventIds.includes("epilogue.reverse-light-started"));
  const entered=c.session.dispatch({type:"navigate",entryId:journeyScenes.at(-1).keystoneEntryId});
  assert.equal(entered.accepted,true,entered.reason);assert.ok(entered.eventIds.includes("epilogue.reverse-light-started"));
  assert.equal(c.state().storyObjectStates["epilogue.reverse-light"],"running");c.session.dispose();
});

test("manual input cannot supply duration to bypass an authored attention interval",()=>{
  const event=STORY_EVENTS.find(e=>e.id==="enchanted.meadow-warmth"),scene=journeyScenes.find(s=>s.id===event.sceneId);
  const c=runtime(fixtureFor(scene));const lease=begin(c,"continue");const before=c.state().getSnapshot();
  assert.equal(c.session.dispatch({type:"event",eventId:event.id,lease,duration:1e9}).accepted,false);
  assert.deepEqual(c.state().getSnapshot(),before);c.session.dispose();
});

test("all17 authored attention durations complete equivalently at30/60/120Hz and exactly once",()=>{
  const timed=STORY_EVENTS.filter(e=>e.durationMs);assert.equal(timed.length,17);
  for(const event of timed)for(const hz of [30,60,120]){
    const scene=journeyScenes.find(s=>s.id===event.sceneId);
    const prerequisites=STORY_EVENTS.filter(e=>e.sceneId===scene.id&&e.id!==event.id).map(e=>e.id);
    const c=runtime(fixtureFor(scene,{completedStoryEventIds:prerequisites}));const lease=begin(c,"continue");
    assert.ok(getAvailableStoryEvents(c.state()).some(e=>e.id===event.id),event.id);
    const token=c.session.beginAttention(lease,event.id);assert.ok(token,event.id);let count=0,finished=0;
    for(let frame=0;frame<Math.ceil(event.durationMs*hz/1000)+3;frame++){
      const now=frame*1000/hz,result=c.session.sampleAttention(token,now,true);
      if(result.result.accepted){count++;finished=now;}
    }
    assert.equal(count,1,`${event.id}@${hz}`);assert.ok(finished>=event.durationMs);assert.ok(finished-event.durationMs<=1000/hz+1e-6);
    assert.equal(c.state().completedStoryEventIds.filter(id=>id===event.id).length,1);c.session.dispose();
  }
});

test("between-sample overlay edges reset continuous attention and retain only witnessed sequence time",()=>{
  for(const id of ["enchanted.meadow-warmth","epilogue.reverse-light-complete"]){
    const event=STORY_EVENTS.find(e=>e.id===id),scene=journeyScenes.find(s=>s.id===event.sceneId);
    const c=runtime(fixtureFor(scene,{completedStoryEventIds:STORY_EVENTS.filter(e=>e.sceneId===scene.id&&e.id!==id).map(e=>e.id)}));
    const lease=begin(c,"continue"),token=c.session.beginAttention(lease,id);assert.ok(token);
    c.session.sampleAttention(token,0,true);assert.equal(c.session.sampleAttention(token,500,true).elapsedMs,500);
    c.activity.overlayOpen=true;c.session.refreshActivity();c.activity.overlayOpen=false;c.session.refreshActivity();
    assert.equal(c.session.sampleAttention(token,900,true).elapsedMs,event.trigger==="sequence-complete"?500:0);
    assert.equal(c.session.sampleAttention(token,1200,true).elapsedMs,event.trigger==="sequence-complete"?800:300);c.session.dispose();
  }
});

test("external hydrate/reset, entry changes without relocation revision, stale cleanup and disposal invalidate old tokens",()=>{
  const c=runtime();const old=begin(c);const cleanup=c.session.bind();const replacementCleanup=c.session.bind();cleanup();
  assert.equal(c.session.dispatch({type:"read",entryId:"fragment-001",lease:old}).accepted,true);
  c.state().navigateToEntry("fragment-002");assert.equal(c.state().sceneRelocationRevision,0);assert.equal(c.session.currentLease(),null);
  const before=c.state().getSnapshot();assert.equal(c.session.dispatch({type:"read",entryId:"fragment-001",lease:old}).accepted,false);assert.deepEqual(c.state().getSnapshot(),before);
  const next=begin(c,"continue");c.state().hydrateJourney(c.state().getSnapshot(),{source:"cloud"});assert.equal(c.session.currentLease(),null);
  assert.equal(c.session.dispatch({type:"witness",entryId:"fragment-002",lease:next}).accepted,false);
  replacementCleanup();c.session.bind();begin(c,"continue");c.state().resetJourney("fragment-001");assert.equal(c.session.currentLease(),null);c.session.dispose();
});

test("every legacy choice resolves canonical outcomes; wrong physical target and stale choice are rejected",()=>{
  for(const action of JOURNEY_PLAYER_ACTIONS.filter(a=>a.mode==="choice"))for(const choice of action.choices){
    const scene=journeyScenes.find(s=>s.id===action.sceneId);
    const flags=Object.fromEntries(JOURNEY_WORLD_FLAG_IDS.map(id=>[id,true]));for(const id of action.completionFlagIds)delete flags[id];
    const currentChoiceObjects=new Set(action.choices.flatMap(item=>item.outcomes.filter(o=>o.type==="collect-symbolic-object").map(o=>o.objectId)));
    const c=runtime(fixtureFor(scene,{worldFlags:flags,witnessedEntryIds:[scene.keystoneEntryId],inventory:{lantern:true,recoveredKeys:JOURNEY_RECOVERED_KEY_IDS,symbolicObjects:JOURNEY_SYMBOLIC_OBJECT_IDS.filter(id=>!currentChoiceObjects.has(id))}}));const lease=begin(c,"continue");
    const before=c.state().getSnapshot();assert.equal(c.session.dispatch({type:"legacy-action",actionId:action.id,choiceId:choice.id,source:"physical",playerLocalPosition:[1000,1000],lease}).accepted,false);
    assert.deepEqual(c.state().getSnapshot(),before);
    const target=resolveJourneyPlayerActionTargetLocalPosition(choice.target,getJourneySceneArrivalHeading(scene.id));
    const result=c.session.dispatch({type:"legacy-action",actionId:action.id,choiceId:choice.id,source:"physical",playerLocalPosition:target,lease});assert.equal(result.accepted,true,result.reason);
    for(const outcome of choice.outcomes){if(outcome.type==="collect-symbolic-object")assert.ok(c.state().inventory.symbolicObjects.includes(outcome.objectId));else if(outcome.type==="set-world-flag")assert.equal(c.state().worldFlags[outcome.flagId],true);}
    assert.equal(c.session.dispatch({type:"legacy-action",actionId:action.id,choiceId:choice.id,lease}).accepted,false);c.session.dispose();
  }
});

test("ritual intent applies the original canonical beat outcomes through actual store commands",()=>{
  for(const {ritualId,sceneId,entryId} of JOURNEY_RITUAL_PROGRESSION){
    const ritualBeat=getJourneyRitualBeat(ritualId);assert.ok(ritualBeat);
    const scene=journeyScenes.find(s=>s.id===sceneId);
    const snapshot=fixtureFor(scene,{activeEntryId:entryId,witnessedEntryIds:entryIds,completedRitualIds:JOURNEY_RITUAL_IDS.filter(id=>id!==ritualId)});
    const trace=[],c=runtime(snapshot,trace);const lease=begin(c,"continue");trace.length=0;
    const expected=[],sink=Object.fromEntries(["completeRitual","setWorldFlag","setLandmarkState","addResonance","awardLantern","recoverKey","collectSymbolicObject","releaseWord","completeAct","completeStory"].map(name=>[name,(...args)=>expected.push([name,...args])]));
    for(const outcome of ritualBeat.outcomes??[])applyJourneyOutcome(outcome,sink);
    const result=c.session.dispatch({type:"ritual",ritualId,lease});
    assert.equal(result.accepted,true,`${ritualId}: ${result.reason}`);assert.ok(c.state().completedRitualIds.includes(ritualId));
    assert.deepEqual(trace.slice(0,expected.length),expected,ritualId);
    assert.equal(c.session.dispatch({type:"ritual",ritualId,lease}).accepted,false);
    c.session.dispose();
  }
});

test("foreground beat timing is leased, pauses hidden intervals, and re-derives presence before committing",()=>{
  const transformation=journeyBeats.find(b=>b.role==="transformation");const act=journeyActs.find(a=>a.id===transformation.actId);
  const c=runtime(fresh({storyStarted:true,completedActs:[act.id],beatId:transformation.id}));const lease=begin(c,"continue");
  c.session.sampleBeat(lease,0);c.session.sampleBeat(lease,300);
  c.activity.foreground=false;c.session.refreshActivity();c.activity.foreground=true;
  assert.equal(c.session.sampleBeat(lease,1500).accepted,false);assert.equal(c.state().beatId,transformation.id);
  const delay=journeyBeatTransitionDelay("threshold-open",false);
  assert.equal(c.session.sampleBeat(lease,1500+delay-300).accepted,true);
  assert.equal(c.state().beatId,transformation.nextBeatIds[0]);
  c.state().navigateToEntry("fragment-002");const before=c.state().getSnapshot();assert.equal(c.session.sampleBeat(lease,5000).accepted,false);assert.deepEqual(c.state().getSnapshot(),before);c.session.dispose();
});

test("physical numeric port shares the opaque lease and stale readers cannot advance authored attention",()=>{
  const c=runtime(),lease=begin(c),port=createPhysicalObservationPort();port.bind(lease,0);
  assert.equal(port.read(lease,100).observedAtMs,null);
  port.publish(lease,{observedAtMs:100,position:[0,0,0],quaternion:[0,0,0,1],inputEnabled:true,settled:true});
  const first=port.read(lease,100);for(let i=0;i<10;i++)assert.equal(port.read(lease,100+i).revision,first.revision);
  const replacement=begin(c,"continue");port.bind(replacement,500);assert.equal(port.read(lease,700),null);assert.equal(port.release(lease),false);assert.equal(port.read(replacement,700).observedAtMs,null);c.session.dispose();
});

test("reconnect after same-entry hydration while disconnected requires explicit Continue and cannot reuse old physical authorization",()=>{
  const c=runtime(),old=begin(c),before=c.state().getSnapshot();c.disconnect();
  c.state().hydrateJourney(before,{source:"cloud"});const restored=c.state().getSnapshot();
  c.session.bind();assert.equal(c.session.currentLease(),null);assert.deepEqual(c.state().getSnapshot(),restored);
  assert.equal(c.session.observePresence(old,"fragment-001",true),false);
  assert.equal(c.session.dispatch({type:"presence",entryId:"fragment-001",lease:old,nowMs:200,facts:{revision:2,observedAtMs:200,fresh:true,available:true,settled:true,inputEnabled:true,insideClearing:true}}).accepted,false);
  const next=begin(c,"continue");assert.notEqual(next,old);c.session.dispose();
});

test("physical presence admits only a fresh settled new numeric revision; observing/mounting/stale first samples never witness",()=>{
  const c=runtime(),lease=begin(c),before=c.state().getSnapshot();
  assert.equal(c.session.observePresence(lease,"fragment-001",true),true);assert.deepEqual(c.state().getSnapshot(),before);
  const submit=facts=>c.session.dispatch({type:"presence",entryId:"fragment-001",lease,nowMs:500,facts:{revision:1,observedAtMs:500,fresh:true,available:true,settled:true,inputEnabled:true,insideClearing:true,...facts}});
  for(const [revision,extra] of [[1,{observedAtMs:null}],[2,{available:false}],[3,{settled:false}],[4,{fresh:false}],[5,{observedAtMs:2000}],[6,{insideClearing:false}]]){
    assert.equal(submit({revision,...extra}).accepted,false);assert.deepEqual(c.state().getSnapshot(),before);
  }
  assert.equal(submit({revision:7}).accepted,true);assert.ok(c.state().witnessedEntryIds.includes("fragment-001"));
  const witnessed=c.state().getSnapshot();assert.equal(submit({revision:7}).accepted,false);assert.deepEqual(c.state().getSnapshot(),witnessed);c.session.dispose();
});

test("rendered presence publications are observational; the host admits witnessing once and stable new samples preserve the arrival beat delay",()=>{
  const trace=[],c=runtime(fresh(),trace,["witnessEntry","enterBeat"]),lease=begin(c),baseline=c.state().getSnapshot();
  const facts={revision:1,observedAtMs:0,available:true,fresh:true,settled:true,inputEnabled:true};
  trace.length=0;
  const publish=(revision,now,extra={})=>c.session.publishPhysicalPresence(lease,"fragment-001",{...facts,revision,observedAtMs:now,...extra},true);
  for(const [revision,extra] of [[1,{observedAtMs:null}],[2,{available:false}],[3,{settled:false}],[4,{inputEnabled:false}],[5,{fresh:false}]]){
    assert.equal(publish(revision,0,extra),true);assert.deepEqual(c.state().getSnapshot(),baseline);
    assert.deepEqual(c.session.sample(0),[]);assert.deepEqual(c.state().getSnapshot(),baseline);
  }
  // Re-reading or changing eligibility on the first unavailable revision is not a new pose.
  publish(5,0);assert.deepEqual(c.session.sample(0),[]);assert.deepEqual(c.state().getSnapshot(),baseline);
  publish(6,100);assert.deepEqual(c.state().getSnapshot(),baseline);
  assert.equal(c.session.sample(100).filter(result=>result.accepted).length,1);
  const arrival=journeyActs[0].mainBeatIds[0];assert.equal(c.state().beatId,arrival);
  assert.deepEqual(trace.map(item=>item[0]),["witnessEntry","enterBeat"]);
  for(let now=200;now<=800;now+=100){
    publish(now/100+5,now);assert.deepEqual(c.session.sample(now),[]);
    assert.equal(c.state().beatId,arrival,"later presence cannot bypass or restart the authored arrival delay");
    assert.equal(trace.filter(item=>item[0]==="witnessEntry").length,1);
  }
  publish(14,900);assert.equal(c.session.sample(900).filter(result=>result.accepted).length,1);
  assert.equal(c.state().beatId,JOURNEY_ENTRY_PROGRESS["fragment-001"].beatId);
  assert.equal(trace.filter(item=>item[0]==="witnessEntry").length,1);
  assert.equal(trace.filter(item=>item[0]==="enterBeat").length,2);
  const accepted=c.state().getSnapshot();assert.deepEqual(c.session.sample(950),[]);assert.deepEqual(c.state().getSnapshot(),accepted);c.session.dispose();
});

test("published presence is revoked on suspension, old scoped callbacks and same-entry restore cannot reactivate it",()=>{
  const c=runtime(),lease=begin(c),baseline=c.state().getSnapshot();
  const facts={revision:1,observedAtMs:100,available:true,fresh:true,settled:true,inputEnabled:true};
  assert.equal(c.session.publishPhysicalPresence(lease,"fragment-001",facts,true),true);
  c.session.suspendPhysicalAttention();assert.deepEqual(c.session.sample(100),[]);assert.deepEqual(c.state().getSnapshot(),baseline);
  c.session.publishPhysicalPresence(lease,"fragment-001",facts,true);c.activity.overlayOpen=true;c.session.refreshActivity();
  c.activity.overlayOpen=false;assert.deepEqual(c.session.sample(100),[]);assert.deepEqual(c.state().getSnapshot(),baseline);
  c.session.publishPhysicalPresence(lease,"fragment-001",facts,true);c.session.observePresence(lease,"fragment-001",false);
  assert.deepEqual(c.session.sample(100),[]);assert.deepEqual(c.state().getSnapshot(),baseline);
  c.session.publishPhysicalPresence(lease,"fragment-001",facts,true);c.state().hydrateJourney(baseline,{source:"cloud"});
  const restored=c.state().getSnapshot();assert.equal(c.session.currentLease(),null);
  assert.equal(c.session.publishPhysicalPresence(lease,"fragment-001",{...facts,revision:2,observedAtMs:200},true),false);
  assert.deepEqual(c.session.sample(200),[]);assert.deepEqual(c.state().getSnapshot(),restored);
  const next=begin(c,"continue");assert.notEqual(next,lease);
  const continued=c.state().getSnapshot();assert.equal(c.session.publishPhysicalPresence(next,"fragment-002",facts,true),false);
  c.session.publishPhysicalPresence(next,"fragment-001",facts,true);assert.deepEqual(c.session.sample(2000),[]);assert.deepEqual(c.state().getSnapshot(),continued);
  c.session.publishPhysicalPresence(next,"fragment-001",{...facts,revision:2,observedAtMs:2000},true);
  assert.equal(c.session.sample(2000).filter(result=>result.accepted).length,1);assert.ok(c.state().witnessedEntryIds.includes("fragment-001"));c.session.dispose();
});

test("physical attention samples observed time only, tolerate eligible duplicate reads, and pause changed input before revision suppression",()=>{
  const event=STORY_EVENTS.find(e=>e.id==="enchanted.meadow-warmth"),scene=journeyScenes.find(s=>s.id===event.sceneId);
  const c=runtime(fixtureFor(scene)),lease=begin(c,"continue"),port=createPhysicalObservationPort();port.bind(lease,0);
  const token=c.session.beginAttention(lease,event.id,"physical");assert.ok(token);
  assert.equal(c.session.sampleAttention(token,1e9,true).result.accepted,false);
  let finished=0;
  for(let frame=0;frame<110;frame++){
    const now=frame*1000/30;
    port.publish(lease,{observedAtMs:now,position:[0,0,0],quaternion:[0,0,0,1],inputEnabled:true,settled:true});
    const facts=port.read(lease,now),result=c.session.samplePhysicalAttention(token,facts,now,true);
    if(result.result.accepted)finished++;
    const duplicate=c.session.samplePhysicalAttention(token,facts,now+10,true);
    assert.equal(duplicate.result.accepted,false);
  }
  assert.equal(finished,1);c.session.dispose();
  const d=runtime(fixtureFor(scene)),next=begin(d,"continue"),physical=createPhysicalObservationPort();physical.bind(next,0);
  const interval=d.session.beginAttention(next,event.id,"physical");let facts;
  for(const now of [0,400,600]){physical.publish(next,{observedAtMs:now,position:[0,0,0],quaternion:[0,0,0,1],inputEnabled:true,settled:true});facts=physical.read(next,now);d.session.samplePhysicalAttention(interval,facts,now,true);}
  physical.key(next,"KeyQ",true,650);const held=physical.read(next,650);assert.equal(held.revision,facts.revision);
  assert.equal(d.session.samplePhysicalAttention(interval,held,650,true).elapsedMs,0);
  assert.ok(!d.state().completedStoryEventIds.includes(event.id));d.session.dispose();
});

test("invalid/backward/hidden/stalled attention cannot grant an event and navigation cancels queued completions",()=>{
  const event=STORY_EVENTS.find(e=>e.id==="enchanted.meadow-warmth"),scene=journeyScenes.find(s=>s.id===event.sceneId);
  const c=runtime(fixtureFor(scene)),lease=begin(c,"continue"),token=c.session.beginAttention(lease,event.id);
  c.session.sampleAttention(token,500,true);c.session.sampleAttention(token,1000,true);
  for(const time of [NaN,Infinity,-1,5000,4000])assert.equal(c.session.sampleAttention(token,time,true).result.accepted,false);
  c.activity.foreground=false;c.session.refreshActivity();assert.equal(c.session.sampleAttention(token,5000,true).elapsedMs,0);
  c.activity.foreground=true;c.session.sampleAttention(token,6000,true);
  const target=journeyScenes[journeyScenes.indexOf(scene)-1];assert.equal(c.session.dispatch({type:"navigate",entryId:target.keystoneEntryId}).accepted,true);
  const before=c.state().getSnapshot();assert.equal(c.session.sampleAttention(token,1e6,true).result.accepted,false);assert.deepEqual(c.state().getSnapshot(),before);c.session.dispose();
});

test("explicit crossing preserves only an intentionally started legacy action; ordinary navigation cancels it",()=>{
  const action=JOURNEY_PLAYER_ACTIONS[0],scene=journeyScenes.find(s=>s.id===action.sceneId),prior=journeyScenes[journeyScenes.indexOf(scene)-1];
  for(const kind of ["crossing","explicit"]){
    const flags=Object.fromEntries(JOURNEY_WORLD_FLAG_IDS.map(id=>[id,true]));for(const id of action.completionFlagIds)delete flags[id];
    const c=runtime(fixtureFor(scene,{worldFlags:flags,witnessedEntryIds:[scene.keystoneEntryId]})),lease=begin(c,"continue");
    const started=c.session.dispatch({type:"legacy-start",actionId:action.id,lease});assert.equal(started.accepted,true,started.reason);
    const physical=kind==="crossing"?{lease,nowMs:500,facts:{revision:2,observedAtMs:500,fresh:true,available:true,settled:true,inputEnabled:true,stillEligible:true,thresholdEntryId:prior.keystoneEntryId,crossed:true}}:{};
    const nav=c.session.dispatch({type:"navigate",entryId:prior.keystoneEntryId,kind,...physical});assert.equal(nav.accepted,true,nav.reason);
    const result=c.session.dispatch({type:"legacy-action",actionId:action.id,actionToken:started.actionToken,lease:nav.lease});
    assert.equal(result.accepted,kind==="crossing",result.reason);for(const id of action.completionFlagIds)assert.equal(c.state().worldFlags[id]===true,kind==="crossing");c.session.dispose();
  }
});

test("actual store serialization retains original key/version/schema and never includes tokens, clocks or runtime fields",()=>{
  const c=runtime(),lease=begin(c);c.session.dispatch({type:"witness",entryId:"fragment-001",lease});
  const saved=JSON.parse(values.get("sidtw:journey:v3"));assert.equal(saved.version,6);assert.equal(saved.state.schemaVersion,2);
  for(const key of ["lease","authorization","attention","presenceRevision","beat","token","elapsedMs","revision"])assert.equal(Object.hasOwn(saved.state,key),false,key);
  c.session.dispose();
});

test("the fresh32-scene route completes through actual store commands and bounded canonical settlement without mount progress",()=>{
  const c=runtime();begin(c);let maximum=0,actions=0;
  for(const scene of journeyScenes){
    if(c.state().activeEntryId!==scene.keystoneEntryId){const nav=c.session.dispatch({type:"navigate",entryId:scene.keystoneEntryId});assert.equal(nav.accepted,true,`${scene.id}: ${nav.reason}`);maximum=Math.max(maximum,nav.settled);}
    const witness=c.session.dispatch({type:"witness",entryId:scene.keystoneEntryId,lease:c.session.currentLease()});assert.equal(witness.accepted,true);maximum=Math.max(maximum,witness.settled);
    for(let step=0;step<80&&!c.state().completedSceneIds.includes(scene.id);step++){
      const event=getAvailableStoryEvents(c.state()).find(e=>!e.optional&&e.trigger!=="scene-enter");
      assert.ok(event,`${scene.id} missing earned event at step${step}`);
      const result=executeEvent(c,event);assert.equal(result.accepted,true,`${event.id}: ${result.reason}`);maximum=Math.max(maximum,result.settled);actions++;
    }
    assert.ok(c.state().completedSceneIds.includes(scene.id),scene.id);
  }
  assert.deepEqual(c.state().completedSceneIds,journeyScenes.map(s=>s.id));assert.deepEqual(c.state().completedChapterIds,journeyChapters.map(ch=>ch.id));
  assert.equal(c.state().storyCompleted,true);assert.ok(actions>60);assert.ok(maximum>0&&maximum<=52);c.session.dispose();
});

test("every legacy action uses its canonical authored outcomes, with no passed outcome payload authority",()=>{
  for(const action of JOURNEY_PLAYER_ACTIONS){
    const scene=journeyScenes.find(s=>s.id===action.sceneId);
    const sceneActions=JOURNEY_PLAYER_ACTIONS.filter(a=>a.sceneId===scene.id);
    const flags=Object.fromEntries(JOURNEY_WORLD_FLAG_IDS.map(id=>[id,true]));
    const index=sceneActions.indexOf(action);for(const pending of sceneActions.slice(index))for(const id of pending.completionFlagIds)delete flags[id];
    const choice=action.choices?.[0],outcomes=choice?.outcomes??action.outcomes??[];
    const objects=outcomes.filter(o=>o.type==="collect-symbolic-object").map(o=>o.objectId);
    const c=runtime(fixtureFor(scene,{worldFlags:flags,witnessedEntryIds:[scene.keystoneEntryId],inventory:{lantern:!outcomes.some(o=>o.type==="award-lantern"),recoveredKeys:JOURNEY_RECOVERED_KEY_IDS,symbolicObjects:JOURNEY_SYMBOLIC_OBJECT_IDS.filter(id=>!objects.includes(id))}}));
    const lease=begin(c,"continue"),before=c.state().getSnapshot();
    for(const outcome of outcomes)applyPlayerActionOutcome(outcome,c.state());
    const expected={worldFlags:c.state().worldFlags,inventory:c.state().inventory};
    setFixture(before);
    const result=c.session.dispatch({type:"legacy-action",actionId:action.id,choiceId:choice?.id,lease,outcomes:[{type:"set-world-flag",flagId:"lantern.placed-and-lit"}]});
    assert.equal(result.accepted,true,`${action.id}: ${result.reason}`);
    assert.deepEqual(c.state().worldFlags,expected.worldFlags,action.id);assert.deepEqual(c.state().inventory,expected.inventory,action.id);c.session.dispose();
  }
});

test("drop and repick retain actual reducer semantics even when pickup event ID was already completed",()=>{
  const scene=journeyScenes.find(s=>s.id==="climb.womb"),c=runtime(fixtureFor(scene,{completedStoryEventIds:[],storyObjectStates:{}}));const lease=begin(c,"continue");
  const pickup=STORY_EVENTS.find(e=>e.sceneId===scene.id&&e.trigger==="pickup"&&e.objectId==="womb.linen");assert.ok(pickup);
  const first=executeEvent(c,pickup,lease);assert.equal(first.accepted,true,first.reason);
  assert.equal(c.session.dispatch({type:"drop",objectId:pickup.objectId,lease}).accepted,true);
  assert.equal(c.state().storyObjectStates[pickup.objectId],"resting");
  const second=executeEvent(c,pickup,lease);assert.equal(second.accepted,true,second.reason);
  assert.equal(c.state().storyObjectStates[pickup.objectId],"carried");assert.equal(c.state().completedStoryEventIds.filter(id=>id===pickup.id).length,1);c.session.dispose();
});

test("physical crossings require a current lease and fresh settled real threshold evidence, including the first mounted sample",()=>{
  const scene=journeyScenes[2],target=journeyScenes[1],c=runtime(fixtureFor(scene)),lease=begin(c,"continue");
  const baseline=c.state().getSnapshot(),port=createPhysicalObservationPort();port.bind(lease,0);
  const travel=(facts,nowMs=500)=>c.session.dispatch({type:"navigate",entryId:target.keystoneEntryId,kind:"crossing",lease,nowMs,
    facts:{...facts,thresholdEntryId:target.keystoneEntryId,crossed:true}});
  assert.equal(travel(port.read(lease,0),0).accepted,false);
  port.publish(lease,{observedAtMs:100,position:[0,0,0],quaternion:[0,0,0,1],inputEnabled:true,settled:true});
  assert.equal(travel(port.read(lease,100),100).accepted,false);assert.deepEqual(c.state().getSnapshot(),baseline);
  const valid={revision:3,observedAtMs:500,available:true,fresh:true,settled:true,inputEnabled:true,stillEligible:true};
  for(const [revision,override] of [[3,{settled:false}],[4,{fresh:false}],[5,{observedAtMs:2000}],[6,{inputEnabled:false}]]){
    assert.equal(travel({...valid,revision,...override}).accepted,false);assert.deepEqual(c.state().getSnapshot(),baseline);
  }
  const wrong=c.session.dispatch({type:"navigate",entryId:target.keystoneEntryId,kind:"crossing",lease,nowMs:500,facts:{...valid,revision:7,thresholdEntryId:scene.keystoneEntryId,crossed:true}});
  assert.equal(wrong.accepted,false);assert.deepEqual(c.state().getSnapshot(),baseline);
  assert.equal(travel({...valid,revision:8}).accepted,true);assert.equal(c.state().activeEntryId,target.keystoneEntryId);
  const arrived=c.state().getSnapshot();assert.equal(travel({...valid,revision:9}).accepted,false);assert.deepEqual(c.state().getSnapshot(),arrived);c.session.dispose();
});

test("published renderer facts never progress until the single host sample accepts measured attention",()=>{
  const event=STORY_EVENTS.find(e=>e.id==="enchanted.meadow-warmth"),scene=journeyScenes.find(s=>s.id===event.sceneId);
  const c=runtime(fixtureFor(scene)),lease=begin(c,"continue"),baseline=c.state().getSnapshot();
  const facts={revision:1,observedAtMs:0,available:true,fresh:true,settled:true,inputEnabled:true,stillEligible:true};
  assert.equal(c.session.publishPhysicalAttention(lease,event.id,facts,true),true);assert.deepEqual(c.state().getSnapshot(),baseline);
  assert.deepEqual(c.session.sample(0),[]);
  let count=0;
  for(let now=100;now<=event.durationMs+100;now+=100){
    c.session.publishPhysicalAttention(lease,event.id,{...facts,revision:now/100+1,observedAtMs:now},true);
    count+=c.session.sample(now).filter(result=>result.eventIds.includes(event.id)).length;
  }
  assert.equal(count,1);assert.equal(c.state().completedStoryEventIds.filter(id=>id===event.id).length,1);
  const accepted=c.state().getSnapshot();assert.deepEqual(c.session.sample(10000),[]);assert.deepEqual(c.state().getSnapshot(),accepted);c.session.dispose();
});

test("host semantic intervals expose read-only progress and immediate suspension resets continuous but preserves sequences",()=>{
  for(const id of ["enchanted.meadow-warmth","epilogue.reverse-light-complete"]){
    const event=STORY_EVENTS.find(e=>e.id===id),scene=journeyScenes.find(s=>s.id===event.sceneId);
    const c=runtime(fixtureFor(scene,{completedStoryEventIds:STORY_EVENTS.filter(e=>e.sceneId===scene.id&&e.id!==id).map(e=>e.id)})),lease=begin(c,"continue");
    const token=c.session.beginAttention(lease,id);const baseline=c.state().getSnapshot();c.session.sample(0);c.session.sample(500);
    assert.equal(c.session.readAttention(token).elapsedMs,500);for(let i=0;i<20;i++)c.session.readAttention(token);assert.deepEqual(c.state().getSnapshot(),baseline);
    c.activity.overlayOpen=true;c.session.refreshActivity();c.activity.overlayOpen=false;c.session.refreshActivity();c.session.sample(900);
    assert.equal(c.session.readAttention(token).elapsedMs,event.trigger==="sequence-complete"?500:0);
    c.session.cancelAttention(token);assert.equal(c.session.readAttention(token),null);c.session.dispose();
  }
});

test("fresh scene gates are rechecked at attention completion and a rejected event never settles earned unrelated progress",()=>{
  const event=STORY_EVENTS.find(e=>e.id==="enchanted.meadow-warmth"),scene=journeyScenes.find(s=>s.id===event.sceneId),c=runtime(fixtureFor(scene)),lease=begin(c,"continue");
  const token=c.session.beginAttention(lease,event.id);c.session.sampleAttention(token,0,true);
  useJourneyStore.setState({completedSceneIds:[]});
  const baseline=c.state().getSnapshot();for(let now=500;now<5000;now+=500)assert.equal(c.session.sampleAttention(token,now,true).result.accepted,false);
  assert.deepEqual(c.state().getSnapshot(),baseline);c.session.dispose();
});
