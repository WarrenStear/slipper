import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath,pathToFileURL } from 'node:url';
import { register } from 'node:module';
const overlay=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'),out=path.join(overlay,'tests/fixtures/audio-domain');
register(pathToFileURL(path.join(overlay,'tests/canonical-node-loader.mjs')),import.meta.url);
const load=rel=>import(pathToFileURL(path.join(overlay,rel)).href);
const THREE=await import(pathToFileURL(path.join(overlay,'node_modules/three/build/three.module.js')).href);
const audio=await load('src/components/three/audio/narrativeAudioRuntime.ts'),{observeAudioForeground}=await load('src/components/three/audio/audioForeground.ts');
const {RecordedTarget,nativeAudioHarness}=await import('./audioTestHarness.mjs');
function stem(h){return{...audio.createNarrativeStemVoice(h.listener,h.context.createBuffer(1,8000,8000)),volume:.2};}
test('actual Three dry voice remains the original graph; four lazy panners never create additional sources/buffers',()=>{
 const h=nativeAudioHarness(),stems=Array.from({length:10},()=>stem(h));for(const voice of stems)voice.sound.play();assert.equal(h.live(),10);assert.equal(h.nodes.filter(x=>x.kind==='pan').length,0);
 for(const voice of stems.slice(0,4)){audio.setNarrativeStemPan(voice,.6,true);assert.ok(voice.sound instanceof THREE.Audio);assert.deepEqual(voice.sound.getFilters(),[voice.filter,voice.pan]);assert.ok(voice.pan.connections.has(voice.sound.getOutput()));}
 assert.equal(h.nodes.filter(x=>x.kind==='pan').length,4);assert.equal(h.buffers.length,10);assert.equal(h.sources.length,10);
 for(let i=0;i<100;i++)for(const voice of stems.slice(0,4))audio.setNarrativeStemPan(voice,i%2?-.6:.6,true);
 assert.equal(h.nodes.filter(x=>x.kind==='pan').length,4);for(const voice of stems.slice(0,4)){audio.setNarrativeStemPan(voice,NaN,false);assert.deepEqual(voice.sound.getFilters(),[voice.filter]);assert.equal(voice.pan.connections.size,0);}
 audio.disposeNarrativeAudioNodes(h.listener,stems);assert.equal(h.connected().length,0);assert.equal(h.live(),0);assert.equal(h.context.closeCalls,0);
});
test('actual Three panner rewiring preserves the owned production crossfade graph and bounded retiring voice',()=>{
 const h=nativeAudioHarness(),voice=stem(h);voice.sound.setVolume(.2);voice.sound.play();audio.setNarrativeStemPan(voice,.4,true);
 const former=voice.sound,formerPan=voice.pan,next=h.context.createBuffer(1,8000,8000);assert.equal(audio.replaceNarrativeStemBuffer(h.listener,voice,next),true);
 assert.equal(voice.retiring.sound,former);assert.notEqual(voice.pan,formerPan);assert.equal(h.live(),2);assert.equal(voice.pan.pan.value,.4);
 const incomingFade=voice.fade,outgoingFade=voice.retiring.fade;assert.ok(voice.sound.getOutput().connections.has(incomingFade));assert.ok(voice.retiring.sound.getOutput().connections.has(outgoingFade));
 audio.setNarrativeStemPan(voice,-.3,false);audio.setNarrativeStemPan(voice,.3,true);audio.setNarrativeStemPan(voice.retiring,-.3,true);
 assert.deepEqual([...voice.sound.getOutput().connections],[incomingFade]);assert.deepEqual([...voice.retiring.sound.getOutput().connections],[outgoingFade]);assert.ok(incomingFade.connections.has(h.listener.getInput()));
 h.context.currentTime+=.35;h.sources[0].ended=true;h.sources[0].onended();assert.equal(voice.retiring,undefined);assert.equal(formerPan.connections.size,0);assert.equal(h.live(),1);
 for(let i=0;i<5;i++){audio.replaceNarrativeStemBuffer(h.listener,voice,h.context.createBuffer(1,8000,8000));assert.equal(h.live(),2);const previous=h.sources.at(-2);previous.ended=true;previous.onended();assert.equal(h.live(),1);}
 audio.pauseNarrativeAudioNodes(h.listener,[voice]);assert.equal(h.live(),0);assert.equal(voice.spatialConnected,false);assert.equal(voice.pan.connections.size,0);voice.sound.play();assert.equal(h.live(),1);assert.deepEqual(voice.sound.getFilters(),[voice.filter]);
 audio.disposeNarrativeAudioNodes(h.listener,[voice]);assert.equal(h.connected().length,0);assert.equal(h.context.closeCalls,0);
});
test('pause, repeated disposal and interruption during replacement release private graph and retain shared context',()=>{
 const h=nativeAudioHarness(),voice=stem(h);voice.sound.play();audio.setNarrativeStemPan(voice,-.4,true);const former=voice.sound;
 const create=h.context.createBufferSource;h.context.createBufferSource=()=>{const value=create();value.start=()=>{throw new Error('Interrupted context');};return value;};
 assert.equal(audio.replaceNarrativeStemBuffer(h.listener,voice,h.context.createBuffer(1,8000,8000)),false);assert.equal(voice.sound,former);assert.equal(voice.sound.isPlaying,true);
 h.context.createBufferSource=create;audio.pauseNarrativeAudioNodes(h.listener,[voice]);audio.disposeNarrativeAudioNodes(h.listener,[voice]);audio.disposeNarrativeAudioNodes(h.listener,[voice]);assert.equal(h.connected().length,0);assert.equal(h.context.closeCalls,0);
});
test('actual EventTarget focus observers capture only window edges and release all callbacks',()=>{
 const win=new RecordedTarget(),doc=new RecordedTarget(),changes=[];let focus=true;doc.hidden=false;doc.hasFocus=()=>focus;
 const cleanup=observeAudioForeground(win,doc,value=>changes.push(value));assert.equal(win.handlers.get('blur').values().next().value,true);assert.equal(win.handlers.get('focus').values().next().value,true);
 const button=new EventTarget(),event=new Event('blur');button.dispatchEvent(event);for(const callback of win.handlers.get('blur').keys())callback(event);assert.deepEqual(changes,[],'Capture from a descendant button must not interrupt audio');
 win.dispatchEvent(new Event('blur'));assert.deepEqual(changes,[false],'Blur must pause synchronously even while hasFocus has not updated');focus=false;win.dispatchEvent(new Event('focus'));assert.equal(changes.at(-1),false);focus=true;win.dispatchEvent(new Event('focus'));assert.equal(changes.at(-1),true);
 doc.hidden=true;doc.dispatchEvent(new Event('visibilitychange'));assert.equal(changes.at(-1),false);doc.hidden=false;doc.dispatchEvent(new Event('visibilitychange'));assert.equal(changes.at(-1),true);win.dispatchEvent(new Event('pagehide'));assert.equal(changes.at(-1),false);
 cleanup();cleanup();assert.equal(win.count(),0);assert.equal(doc.count(),0);
});
