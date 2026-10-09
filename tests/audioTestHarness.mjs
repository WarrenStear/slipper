import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath,pathToFileURL } from 'node:url';
const overlay=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'),out=path.join(overlay,'tests/fixtures/audio-domain');
const THREE=await import(pathToFileURL(path.join(overlay,'node_modules/three/build/three.module.js')).href);
// Node24 boolean capture removal differs from browsers; normalize only the test backend to the equivalent options object.
export class RecordedTarget extends EventTarget {
 handlers=new Map();
 addEventListener(type,callback,options){const set=this.handlers.get(type)??new Map();set.set(callback,options);this.handlers.set(type,set);super.addEventListener(type,callback,typeof options==='boolean'?{capture:options}:options);}
 removeEventListener(type,callback,options){this.handlers.get(type)?.delete(callback);super.removeEventListener(type,callback,typeof options==='boolean'?{capture:options}:options);}
 count(){return[...this.handlers.values()].reduce((n,m)=>n+m.size,0);}
}
export function nativeAudioHarness(){
 const nodes=[],sources=[],buffers=[];
 const param=(value=0)=>({value,events:[],setValueAtTime(value,time){this.value=value;this.events.push(['set',value,time]);},setTargetAtTime(value,time){this.value=value;this.events.push(['target',value,time]);},linearRampToValueAtTime(value,time){this.value=value;this.events.push(['ramp',value,time]);},cancelScheduledValues(time){this.events.push(['cancel',time]);}});
 const context=new RecordedTarget();Object.assign(context,{state:'running',currentTime:12,sampleRate:8000,closeCalls:0,resumeCalls:0,
  resume(){this.resumeCalls++;this.state='running';return Promise.resolve();},close(){this.closeCalls++;return Promise.resolve();},
  createBuffer(channels,length,sampleRate){const data=Array.from({length:channels},()=>new Float32Array(length)),value={numberOfChannels:channels,length,sampleRate,duration:length/sampleRate,getChannelData:i=>data[i]};buffers.push(value);return value;},
 });
 function node(kind){const value={kind,context,connections:new Set(),gain:param(1),frequency:param(0),pan:param(0),connect(to){this.connections.add(to);return to;},disconnect(to){if(to){assert.ok(this.connections.has(to),'Disconnect must name an existing real graph edge');this.connections.delete(to);}else this.connections.clear();}};nodes.push(value);return value;}
 context.destination=node('destination');context.createGain=()=>node('gain');context.createBiquadFilter=()=>node('filter');context.createStereoPanner=()=>node('pan');
 context.createBufferSource=()=>{const source={...node('source'),detune:param(0),playbackRate:param(1),started:false,stopped:false,stops:[],start(){this.started=true;},stop(time){this.stops.push(time);if(time===undefined||time<=context.currentTime)this.stopped=true;}};sources.push(source);return source;};
 context.listener=Object.fromEntries(['positionX','positionY','positionZ','forwardX','forwardY','forwardZ','upX','upY','upZ'].map(name=>[name,param()]));
 THREE.AudioContext.setContext(context);const listener=new THREE.AudioListener();
 return{context,listener,nodes,sources,buffers,live:()=>sources.filter(x=>x.started&&!x.stopped&&!x.ended).length,connected:()=>nodes.filter(x=>x.connections.size>0)};
}
