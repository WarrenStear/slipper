import React from "react";
import { createRequire } from "node:module";
const require=createRequire(import.meta.url), Reconciler=require("react-reconciler");
const { ConcurrentRoot, DefaultEventPriority }=require("react-reconciler/constants");
globalThis.IS_REACT_ACT_ENVIRONMENT=true;
export let focused=null;
export function clearFocused(){focused=null;}
const renderer=Reconciler({
  supportsMutation:true,isPrimaryRenderer:false,supportsPersistence:false,supportsHydration:false,
  getRootHostContext:()=>null,getChildHostContext:()=>null,getPublicInstance:value=>value,
  createInstance:(type,props)=>({type,props,children:[],isConnected:true,open:false,
    showModal(){this.open=true;},close(){this.open=false;},setAttribute(name){if(name==="open")this.open=true;},
    focus(){focused=this;},
    scrollHeight:1000,clientHeight:200,scrollTop:0,scrolls:[],captures:[],released:[],
    getBoundingClientRect(){return {left:0,top:0,width:420,height:420};},
    setPointerCapture(id){this.captures.push(id);},hasPointerCapture(id){return this.captures.includes(id);},
    releasePointerCapture(id){this.released.push(id);},
    scrollTo(options){this.scrolls.push(options);this.scrollTop=options.top;},}),createTextInstance:text=>({text,isConnected:true}),
  appendInitialChild:(parent,child)=>parent.children.push(child),appendChild:(parent,child)=>parent.children.push(child),
  appendChildToContainer:(parent,child)=>parent.children.push(child),
  removeChild:(parent,child)=>{parent.children=parent.children.filter(item=>item!==child);child.isConnected=false;},
  removeChildFromContainer:(parent,child)=>{parent.children=parent.children.filter(item=>item!==child);child.isConnected=false;},
  insertBefore(parent,child,before){parent.children=parent.children.filter(node=>node!==child);parent.children.splice(parent.children.indexOf(before),0,child);},insertInContainerBefore(parent,child,before){parent.children=parent.children.filter(node=>node!==child);parent.children.splice(parent.children.indexOf(before),0,child);},finalizeInitialChildren:()=>false,
  prepareForCommit:()=>null,resetAfterCommit(){},preparePortalMount(){},shouldSetTextContent:()=>false,
  prepareUpdate:()=>true,commitUpdate:(instance,payload,type,previous,next)=>{instance.props=next;},commitTextUpdate:(instance,old,text)=>{instance.text=text;},
  hideInstance(){},unhideInstance(){},hideTextInstance(){},unhideTextInstance(){},
  getCurrentEventPriority:()=>DefaultEventPriority,beforeActiveInstanceBlur(){},afterActiveInstanceBlur(){},
  detachDeletedInstance(){},clearContainer:container=>{container.children=[];},
  scheduleTimeout:setTimeout,cancelTimeout:clearTimeout,noTimeout:-1,
});
export const text=element=>element.text??element.children?.map(text).join("")??"";
export const all=element=>[element,...(element.children??[]).flatMap(all)];
export function mount(Component,props={}){
  let setProps;
  const container={children:[]};
  function Harness(){const [current,set]=React.useState(props);setProps=set;return React.createElement(Component,current);}
  const root=renderer.createContainer(container,ConcurrentRoot,null,true,null,"",error=>{throw error;},null);
  const render=child=>React.act(()=>renderer.flushSync(()=>renderer.updateContainer(child,root,null,null)));
  render(React.createElement(React.StrictMode,null,React.createElement(Harness)));
  return {container,async asyncAct(callback){await React.act(async()=>{await callback();for(let i=0;i<30;i++)await Promise.resolve();});},act(callback){React.act(()=>{renderer.flushSync(()=>{callback();});});},
    update(next){React.act(()=>{renderer.flushSync(()=>{setProps(current=>({...current,...next}));});});},
    elements:()=>all(container),button:label=>all(container).find(element=>element.type==="button"&&text(element)===label),
    unmount(){render(null);}};
}
