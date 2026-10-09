import {runInNewContext} from 'node:vm';
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createRequire, register } from 'node:module';
import crypto from 'node:crypto';
const overlay=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'),out=path.join(overlay,'tests/fixtures/audio-domain');
register(pathToFileURL(path.join(overlay,'tests/canonical-node-loader.mjs')),import.meta.url);
const require=createRequire(path.join(overlay,'package.json')),ts=require('typescript');
const load=rel=>import(pathToFileURL(path.join(overlay,rel)).href);
const profiles=await load('src/components/three/audio/narrativeAudioProfiles.ts'),runtime=await load('src/components/three/audio/narrativeAudioRuntime.ts');
const approach=await load('src/components/three/audio/audioApproach.ts'),blueprint=await load('src/data/journeyBlueprint.ts');
const stateModule=await load('src/lib/storyJourneyState.ts'),lookModule=await load('src/components/three/artDirection/SceneLookRegistry.ts');
const eventRegistry=await load('src/storyEvents/storyEventRegistry.ts'),eventAudio=await load('src/components/three/audio/storyEventAudio.ts');
const THREE=await import(pathToFileURL(path.join(overlay,'node_modules/three/build/three.module.js')).href);
function former(rel,deps) {
 const source=fs.readFileSync(path.join(out,'baseline',rel+'.txt'),'utf8'),exports={};
 runInNewContext(ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports,require:id=>{
  if(id==='three')return THREE;if(id.includes('journeyBlueprint'))return blueprint;if(id.includes('narrativeAudioProfiles'))return profiles;if(id.includes('storyEventRegistry'))return eventRegistry;
  return deps?.(id)??assert.fail('Unexpected frozen dependency '+id);
 }},{timeout:1000});return exports;
}
const oldProfiles=former('src/components/three/audio/narrativeAudioProfiles.ts');
const oldRuntime=former('src/components/three/audio/narrativeAudioRuntime.ts');
const oldEvent=former('src/components/three/audio/storyEventAudio.ts');
const json=value=>JSON.parse(JSON.stringify(value));
const resonances={wolf:0,swan:0,seer:0};
const film={audioPressure:1,silenceBias:0,lowpassHz:18000};
test('immutable source hashes, existing owners and exact asset admission/loader source are retained',async()=>{
 const manifest=JSON.parse(fs.readFileSync(path.join(out,'manifest.json'),'utf8'));
 for(const[rel,hash]of Object.entries(manifest.files))assert.equal(crypto.createHash('sha256').update(fs.readFileSync(path.join(out,'baseline',rel+'.txt'))).digest('hex'),hash,rel);
 for(const name of ['productionAudioLoader','productionAudioRegistry'])assert.equal(fs.readFileSync(path.join(overlay,'src/components/three/audio',name+'.ts'),'utf8'),fs.readFileSync(path.join(out,'baseline/src/components/three/audio',name+'.ts.txt'),'utf8'));
 for(const name of ['narrativeAudioActivation','audioVolume'])assert.equal(fs.readFileSync(path.join(overlay,'src/lib',name+'.ts'),'utf8'),fs.readFileSync(path.join(out,'baseline/src/lib',name+'.ts.txt'),'utf8'));
 assert.equal(fs.existsSync(path.join(overlay,'src/audio')),false,'No replacement audio domain is introduced.');
 assert.equal(fs.readFileSync(path.join(overlay,'src/components/three/audio/narrativeAudioProfiles.ts'),'utf8'),fs.readFileSync(path.join(out,'baseline/src/components/three/audio/narrativeAudioProfiles.ts.txt'),'utf8'));
});
test('frozen current profile and every shared presentation policy are exact across all 32 scenes, resonance/release/quiet/film states',()=>{
 let comparisons=0;
 for(const scene of blueprint.journeyScenes)for(const resonance of [0,47,100])for(const complete of [false,true]){
  const state={chapterId:scene.chapterId,sceneId:scene.id,resonances:{wolf:resonance,swan:resonance,seer:resonance},releasedWords:resonance?['past','fear','hope']:[],surrenderComplete:complete};
  const before=oldProfiles.resolveNarrativeAudioProfile(state),after=profiles.resolveNarrativeAudioProfile(state);assert.deepEqual(json(after),json(before));
  for(const quiet of [0,.37,1])for(const atmospheric of [film,{audioPressure:1.25,silenceBias:.42,lowpassHz:900},{audioPressure:NaN,silenceBias:1,lowpassHz:NaN}])for(const id of profiles.NARRATIVE_AUDIO_STEM_IDS){
   const look=lookModule.SCENE_LOOKS[scene.id],a=oldProfiles.resolveNarrativeStemTarget({volume:0,lowpassHz:0},id,before,look,quiet,atmospheric),b=profiles.resolveNarrativeStemTarget({volume:0,lowpassHz:0},id,after,look,quiet,atmospheric);
   assert.deepEqual(json(b),json(a));const dry={...b};assert.equal(approach.applyAudioApproachMix(b,{addition:0,pan:.5,lowpassHz:80}),b);assert.deepEqual(b,dry);comparisons++;
  }
 }
 assert.equal(comparisons,17280);
});
function pcmContext(rate){return{sampleRate:rate,allocations:0,createBuffer(channels,length,sampleRate){this.allocations++;const samples=Array.from({length:channels},()=>new Float32Array(length));return{numberOfChannels:channels,length,sampleRate,duration:length/sampleRate,getChannelData:i=>samples[i]};}};}
test('actual existing procedural generator retains exact deterministic PCM and the weak ten-slot bank',()=>{
 for(const rate of [8000,22050,48000]){
  const a=pcmContext(rate),b=pcmContext(rate),first=runtime.getNarrativeStemBuffers(b);assert.equal(first,runtime.getNarrativeStemBuffers(b));assert.equal(b.allocations,10);
  for(const id of profiles.NARRATIVE_AUDIO_STEM_IDS){const before=oldRuntime.createStemBuffer(a,id),after=first.get(id);assert.equal(after.length,before.length);assert.equal(after.duration,before.duration);assert.deepEqual(Buffer.from(after.getChannelData(0).buffer),Buffer.from(before.getChannelData(0).buffer));}
  assert.ok(Math.abs([...first.values()].reduce((sum,x)=>sum+x.duration,0)-47.6)<1/rate);
 }
});
test('every accepted-event cue and material waveform is exact; no new hydration or prose sound is admitted',()=>{
 for(const event of eventRegistry.STORY_EVENTS){const before=oldEvent.resolveStoryEventAudioCue(event.id),after=eventAudio.resolveStoryEventAudioCue(event.id);assert.deepEqual(json(after??null),json(before??null));if(after&&after.duration){assert.deepEqual(Buffer.from(eventAudio.materialSoundSamples(after,8000).buffer),Buffer.from(oldEvent.materialSoundSamples(before,8000).buffer));}}
});
const options={fallbackEntryId:'fragment-001',validEntryIds:Object.keys(blueprint.JOURNEY_ENTRY_PROGRESS),entryProgress:blueprint.JOURNEY_ENTRY_PROGRESS,beatIdsByAct:blueprint.JOURNEY_BEAT_IDS_BY_ACT,ritualIds:blueprint.JOURNEY_RITUAL_IDS,worldFlagIds:blueprint.JOURNEY_WORLD_FLAG_IDS,landmarkIds:blueprint.JOURNEY_LANDMARK_IDS,recoveredKeyIds:blueprint.JOURNEY_RECOVERED_KEY_IDS,symbolicObjectIds:blueprint.JOURNEY_SYMBOLIC_OBJECT_IDS};
const fresh=()=>stateModule.createFreshStoryJourneyState(options);
const admitted=()=>({...fresh(),storyStarted:true,completedSceneIds:blueprint.journeyScenes.map(x=>x.id),completedChapterIds:blueprint.journeyChapters.map(x=>x.id),completedRitualIds:blueprint.JOURNEY_RITUAL_IDS,completedActs:stateModule.JOURNEY_ACT_IDS,worldFlags:Object.fromEntries(blueprint.JOURNEY_WORLD_FLAG_IDS.map(id=>[id,true])),inventory:{lantern:true,recoveredKeys:blueprint.JOURNEY_RECOVERED_KEY_IDS,symbolicObjects:blueprint.JOURNEY_SYMBOLIC_OBJECT_IDS}});
test('guidance admission is canonical, nonmutating and distinguishes Fire/River despite their shared biome',()=>{
 const state=admitted(),before=json(state),target=id=>approach.createAudioApproachTarget('enchanted.rabbit-hole',blueprint.journeyScenes.find(x=>x.id===id).keystoneEntryId,[20,1,-4],state);
 const fire=target('fire.boundary'),water=target('river.wash');assert.equal(fire.fire,true);assert.equal(fire.water,false);assert.equal(water.fire,false);assert.equal(water.water,true);
 for(const args of [[null,[0,0,0],state],['unknown',[0,0,0],state],['fragment-001',[0,0,0],state],[blueprint.journeyScenes.find(x=>x.id==='river.wash').keystoneEntryId,[0,0,0],{...fresh(),storyStarted:true}],['fragment-008',[NaN,0,0],state],['fragment-008',[0,0,0],fresh()],['fragment-008',[0,0,0],{...state,storyCompleted:true}]])assert.equal(approach.createAudioApproachTarget('enchanted.rabbit-hole',...args),null);
 assert.deepEqual(json(state),before);
});
test('actual Swan actor metadata admits a restrained cloth preview; only four existing materials qualify',()=>{
 let swans=0;for(const scene of blueprint.journeyScenes){const target=approach.createAudioApproachTarget('other',scene.keystoneEntryId,[20,0,0],admitted());if(target?.cloth)swans++;if(target){const facts={distance:12,rightBearing:1,currentSceneId:'enchanted.friendship-meadow',sharedStillness:0,spatialEnabled:true,film};for(const id of profiles.NARRATIVE_AUDIO_STEM_IDS){const output=approach.resolveAudioApproachMix({addition:0,pan:0,lowpassHz:0},id,target,facts);if(output.addition>0)assert.ok(['water','wood','fire','cloth'].includes(id));assert.ok(output.addition<=.035);assert.ok(Math.abs(output.pan)<=.6);}}}assert.ok(swans>=2);
});
test('distance, bearing, adverse inputs and exact opening/stillness/Surrender silence use no separate clock',()=>{
 const target={sceneId:'river.wash',position:[0,0,0],water:true,wood:false,fire:false,cloth:false};
 const base={distance:12,rightBearing:1,currentSceneId:'fire.boundary',sharedStillness:0,spatialEnabled:true,film};
 const mix=changes=>({...approach.resolveAudioApproachMix({addition:0,pan:0,lowpassHz:0},'water',target,{...base,...changes})});
 const far=mix({distance:36}),middle=mix({distance:21}),near=mix({distance:6});assert.equal(far.addition,0);assert.ok(middle.addition>0&&middle.addition<near.addition);assert.equal(near.addition,.028);
 assert.equal(mix({rightBearing:-1}).pan,-mix({rightBearing:1}).pan);assert.equal(mix({distance:0}).pan,0);assert.equal(mix({spatialEnabled:false}).pan,0);
 for(const scene of ['broken-floor.confession','sunset.stillness','river.release-surrender'])assert.equal(mix({currentSceneId:scene}).addition,0);
 for(const invalid of [-1,NaN,Infinity])assert.equal(mix({distance:invalid}).addition,0);
 assert.equal(mix({sharedStillness:1}).addition,0);assert.equal(mix({film:{...film,silenceBias:1}}).addition,0);assert.equal(mix({rightBearing:NaN}).pan,0);
 assert.ok(mix({sharedStillness:.5}).addition<mix({}).addition);
});
