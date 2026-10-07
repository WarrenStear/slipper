import React,{useState,useRef,useLayoutEffect} from 'react';
import {createRoot} from 'react-dom/client';
import {Canvas,useFrame,useThree} from '@react-three/fiber';
import * as THREE from 'three';
import {KTX2Loader} from 'three/examples/jsm/loaders/KTX2Loader.js';
import {WetOakReviewReceiver} from './WetOakReviewReceiver';
import {PlasterReviewReceiver} from './PlasterReviewReceiver';
import {createConstructionGeometry as beforeConstruction} from './before-src/components/three/chapters/chapterArtGeometry';
import {createConstructionGeometry as afterConstruction} from './src/components/three/chapters/chapterArtGeometry';
import {TactileMaterial,TactileDetailProvider} from './src/components/three/storyEvents/TactileMaterial';
const faults=['missing','invalid','offline'];
const decodedSources=new Set(),textureRecords=new Map(),clone=THREE.Texture.prototype.clone;
THREE.Texture.prototype.clone=function(){const view=clone.call(this);if(decodedSources.has(this.uuid)){const record={source:this.uuid,view:view.uuid,disposed:false};textureRecords.set(view.uuid,record);view.addEventListener('dispose',()=>{record.disposed=true;});}return view;};
const memoryFor=name=>name==='wet'?{wetness:1}:name==='worn'?{wear:1}:name==='damaged'?{wear:.6,damage:.85}:name==='reintegrated'?{wear:.6,damage:.85,reintegrated:true}:{};
// Observe the actual original callback lifetime; production material delivery uses
// parse directly, while generic asset callers may use load which then calls parse.
window.__receiverDecodes={pending:0,started:0,completed:0,byMethod:{load:0,parse:0}};
for(const [method,loadedIndex,errorIndex]of [['load',1,3],['parse',1,2]]){
 const original=KTX2Loader.prototype[method];
 KTX2Loader.prototype[method]=function(...args){
  // Preserve undefined/default callback semantics for callers outside this bounded review.
  if(typeof args[loadedIndex]!=='function'||typeof args[errorIndex]!=='function')return original.apply(this,args);
  const observed=window.__receiverDecodes;observed.pending++;observed.started++;observed.byMethod[method]++;
  let settled=false;const settle=()=>{if(!settled){settled=true;observed.pending--;observed.completed++;}};
  const copied=[...args];for(const index of [loadedIndex,errorIndex]){const callback=args[index];copied[index]=function(...values){if(index===loadedIndex&&values[0]?.isTexture)decodedSources.add(values[0].uuid);settle();return callback?.apply(this,values);};}
  try{return original.apply(this,copied);}catch(error){settle();throw error;}
 };
}
let nativeSnapshot=()=>({live:0,created:0,deleted:0});
function trackNative(gl){const context=gl.getContext(),live=new Set();let created=0,deleted=0;const create=context.createTexture.bind(context),remove=context.deleteTexture.bind(context);context.createTexture=()=>{const texture=create();if(texture){created++;live.add(texture);}return texture;};context.deleteTexture=texture=>{if(live.delete(texture))deleted++;return remove(texture);};nativeSnapshot=()=>({live:live.size,created,deleted});}
function GeometryPair({side,quality,reducedEffects,memory}){
 const geometry=React.useMemo(()=>(side==='before'?beforeConstruction:afterConstruction)([{position:[0,0,0],size:[4.6,2.8,.16]},{position:[2.5,0,-.34],size:[.2,2.8,.8]}],true),[side]);
 React.useEffect(()=>()=>geometry.dispose(),[geometry]);
 return <TactileDetailProvider quality={quality} reducedEffects={reducedEffects}><mesh name={'actual-plaster-geometry-'+side} geometry={geometry} castShadow receiveShadow userData={{geometryOnly:true,deliveryStatus:'disabled'}}><TactileMaterial surface="plaster" color="#746251" roughness={.96} vertexColors memory={memory} maps={{}}/></mesh></TactileDetailProvider>;
}
function Probe({config}){
 const {scene,camera,gl}=useThree(),frames=useRef(0),last=useRef(-1),previous=useRef(null),glErrors=useRef([]);
 useLayoutEffect(()=>{gl.toneMapping=THREE.ACESFilmicToneMapping;gl.outputColorSpace=THREE.SRGBColorSpace;},[gl]);
 useFrame(()=>{const distance=camera.aspect<1?1.65:1;const v=config.view==='close'?[1.3,1.25,2.5]:config.view==='grazing'?[4.8,.4,1.7]:[3.5,2.4,6.2];camera.position.set(...v.map(value=>value*distance));camera.lookAt(0,.4,0);camera.fov=42;camera.updateProjectionMatrix();queueMicrotask(()=>{
  if(last.current!==config.revision){last.current=config.revision;frames.current=0;previous.current=null;}
  const meshes=[];scene.traverse(object=>{if(object.isMesh&&object.name.startsWith('review-actual-')||object.isMesh&&object.name==='external-unreviewed-plaster-receiver'||object.isMesh&&object.name.startsWith('actual-plaster-geometry-'))meshes.push(object);});
  const materials=meshes.map(mesh=>{const m=mesh.material,depth=mesh.customDepthMaterial,channels=['map','normalMap','roughnessMap','aoMap'];return {name:mesh.name,userData:mesh.userData,vertices:mesh.geometry.attributes.position.count,indexCount:mesh.geometry.index?.count,uv0:mesh.geometry.hasAttribute('uv'),uv1:mesh.geometry.hasAttribute('uv1'),channels:channels.filter(key=>!!m[key]),maps:Object.fromEntries(channels.filter(key=>m[key]).map(key=>{const t=m[key];return [key,{uuid:t.uuid,source:t.source.uuid,channel:t.channel,colorSpace:t.colorSpace,wrapS:t.wrapS,wrapT:t.wrapT,repeat:t.repeat.toArray(),offset:t.offset.toArray(),flipY:t.flipY,rotation:t.rotation,viewDisposed:textureRecords.get(t.uuid)?.disposed??false}];})),depthMap:depth?.map?.uuid??null,depthPresent:!!depth};});
  const admitted=config.mounted&&!config.reducedEffects&&['high','cinematic'].includes(config.quality)&&config.mode!=='geometry'&&(config.receiver!=='plaster'||config.mapsEnabled);
  const expected=admitted?(config.receiver==='plaster'?['map']:['map','normalMap','roughnessMap']):[];
  const failing=faults.includes(config.fault);
  const pending=(window.__receiverFetches?.pending??0)+(window.__receiverDecodes?.pending??0);
  const readyMaterial=!config.mounted||materials.length===1&&(failing?materials[0].channels.length===0:JSON.stringify(materials[0].channels)===JSON.stringify(expected))&&(config.receiver!=='plaster'||!config.mapsEnabled||!admitted||materials[0].userData.deliveryStatus!=='loading');
  window.__receiverPending={config,frames:frames.current,materials,pending,readyMaterial,fetches:window.__receiverFetches,decodes:window.__receiverDecodes};
  if(!readyMaterial||pending){frames.current=0;return;}frames.current++;
  const signature=JSON.stringify({memory:gl.info.memory,programs:gl.info.programs.length,native:nativeSnapshot().live,channels:materials.map(m=>m.channels)});
  if(previous.current?.signature!==signature)previous.current={signature,frame:frames.current};
  if(frames.current<96||frames.current-previous.current.frame<16)return;
  const context=gl.getContext(),errors=[];for(let i=0;i<16;i++){const error=context.getError();if(error===context.NO_ERROR)break;errors.push(error);glErrors.current.push(error);}
  const debug=context.getExtension('WEBGL_debug_renderer_info');
  window.__receiverEvidence={...config,frames:frames.current,materials,rendererMemory:{...gl.info.memory},programs:gl.info.programs.length,calls:gl.info.render.calls,triangles:gl.info.render.triangles,native:nativeSnapshot(),liveClones:Array.from(textureRecords.values()).filter(record=>!record.disposed),cloneRecords:Array.from(textureRecords.values()),glErrors:[...glErrors.current],renderer:context.getParameter(debug?debug.UNMASKED_RENDERER_WEBGL:context.RENDERER),camera:{position:camera.position.toArray(),quaternion:camera.quaternion.toArray(),fov:camera.fov,projection:camera.projectionMatrix.toArray()},fetches:{...window.__receiverFetches},decodes:{...window.__receiverDecodes,byMethod:{...window.__receiverDecodes.byMethod}}};
 });});return null;
}
function App(){const [config,setConfig]=useState({revision:0,mounted:false,receiver:'plaster',surface:'wet-wood',quality:'high',reducedEffects:false,mapsEnabled:false,mode:'actual',side:'after',memory:'dry',view:'distance',fault:'none'});
 window.__configureReceiver=next=>setConfig(previous=>({...previous,...next,revision:previous.revision+1}));
 const memory=memoryFor(config.memory);
 return <Canvas dpr={1} shadows camera={{fov:42,near:.05,far:60}} gl={{preserveDrawingBuffer:true}} onCreated={({gl})=>trackNative(gl)}><color attach="background" args={['#20272a']}/><hemisphereLight args={['#d5dbdc','#3c352d',1.1]}/><directionalLight position={[-3,4,2]} intensity={2.8} color="#eadccb" castShadow shadow-mapSize={[512,512]}/>{config.mounted&&(config.mode==='geometry'?<GeometryPair {...config} memory={memory}/>:config.receiver==='plaster'?<PlasterReviewReceiver {...config} memory={memory}/>:<WetOakReviewReceiver {...config} memory={memory}/>)}<Probe config={config}/></Canvas>;
}
createRoot(document.getElementById('root')).render(<App/>);
