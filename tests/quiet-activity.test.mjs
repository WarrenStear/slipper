import assert from 'node:assert/strict';
import test from 'node:test';
import { createQuietActivityClock,connectQuietActivity } from '../src/ui/quietActivity.ts';
const active={participating:true,foreground:true,overlayOpen:false};
function clock(){const value=createQuietActivityClock(0);value.context(active,0);return value;}
test('the actual disclosure clock suppresses held keys and every pointer until release, without donating their hold time',()=>{
 const value=clock();assert.equal(value.sample(28000),28000);value.key('KeyW',true,28000);
 assert.equal(value.sample(228000),0);value.key('KeyW',false,228000);assert.equal(value.sample(229000),1000);
 value.pointer(7,true,229000);value.pointer(8,true,229100);assert.equal(value.sample(400000),0);
 value.pointer(7,false,400000);assert.equal(value.sample(401000),0);value.pointer(8,false,401000);assert.equal(value.sample(402000),1000);
});
test('foreground, participation and overlay boundaries reset disclosure origins and discard hidden gaps',()=>{
 const value=clock();assert.equal(value.sample(27000),27000);
 for(const boundary of [{...active,foreground:false},{...active,overlayOpen:true},{...active,participating:false}]){
  value.context(boundary,28000);assert.equal(value.sample(3600000),0);value.context(active,3600000);assert.equal(value.sample(3601000),1000);
  value.clear(0);
 }
 value.context({...active,foreground:false},0);value.key('KeyW',true,10);value.context(active,1000);
 assert.equal(value.held(),false,'Blur/unavailable ownership cannot strand held input');assert.equal(value.sample(2000),1000);
});
test('invalid or backward clocks cannot fabricate idle eligibility and ordinary physical activity resets only disclosure',()=>{
 const value=clock();assert.equal(value.sample(1000),1000);assert.equal(value.sample(500),0);assert.equal(value.sample(600),100);
 for(const now of [NaN,Infinity,-Infinity])assert.equal(value.sample(now),0);
 value.activity(10000);assert.equal(value.sample(10001),1);value.clear(11000);assert.equal(value.sample(11001),1);
});
class RecordedTarget extends EventTarget {
 records=[];
 addEventListener(type,listener,options){this.records.push({type,listener,options});super.addEventListener(type,listener,options);}
 removeEventListener(type,listener,options){this.records=this.records.filter(item=>item.type!==type||item.listener!==listener);super.removeEventListener(type,listener,options);}
}
const emit=(target,type,fields={})=>{const event=new Event(type);for(const [name,value]of Object.entries(fields))Object.defineProperty(event,name,{value});target.dispatchEvent(event);};
test('actual capture bridge observes mobile held fingers, look deltas, pagehide/focus edges and disposes the exact listener lifetime',()=>{
 const win=new RecordedTarget(),doc=new RecordedTarget(),value=clock();let now=0,context=active,resets=0;
 doc.pointerLockElement=null;
 const bridge=connectQuietActivity({clock:value,window:win,document:doc,now:()=>now,getContext:()=>context,onReset:()=>resets++});
 for(const event of ['keydown','keyup','pointerdown','pointerup','pointercancel','pointermove'])assert.equal(win.records.find(item=>item.type===event).options,true,event);
 now=28000;emit(win,'pointerdown',{pointerId:1});now=100000;assert.equal(value.sample(now),0);
 emit(win,'pointerup',{pointerId:1});now+=1000;assert.equal(value.sample(now),1000);
 doc.pointerLockElement={};now+=1000;emit(win,'pointermove',{movementX:3,movementY:0});assert.equal(value.sample(now),0);
 doc.pointerLockElement=null;now+=500;emit(win,'pointermove',{movementX:3,movementY:0});assert.equal(value.sample(now),500,'Unheld hover does not invent look activity');
 now+=100;emit(win,'pagehide');now+=3600000;bridge.refresh();assert.equal(value.sample(now),0);
 emit(win,'pageshow');now+=1000;assert.equal(value.sample(now),1000);
 context={...active,overlayOpen:true};bridge.refresh();now+=500000;assert.equal(value.sample(now),0);
 context=active;bridge.refresh();now+=1000;assert.equal(value.sample(now),1000);
 const lastReset=resets;bridge.dispose();bridge.dispose();assert.equal(win.records.length,0);assert.equal(doc.records.length,0);
 emit(win,'pointerdown',{pointerId:4});assert.equal(resets,lastReset);assert.equal(value.held(),false);
});
