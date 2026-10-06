import { chromium } from '@playwright/test';
import { createServer } from 'vite';
import react from '@vitejs/plugin-react';
import { mkdir, writeFile, symlink } from 'node:fs/promises';
import { resolve } from 'node:path';
const repo=process.cwd(), out=resolve(process.env.REVIEW_OUT||'/private/tmp/slipper-tree-gallery');
const angle=process.env.REVIEW_ANGLE||'swiftshader';
if(!['metal','swiftshader'].includes(angle))throw Error('Invalid REVIEW_ANGLE');
const fixture=resolve(out,'fixture'); await mkdir(fixture,{recursive:true});
await symlink(repo+'/node_modules',fixture+'/node_modules','dir').catch(e=>{if(e.code!=='EEXIST')throw e;});
await writeFile(fixture+'/index.html','<!doctype html><html><head><style>html,body,#root{width:100%;height:100%;margin:0;overflow:hidden;background:#202827}.label{position:absolute;width:25%;text-align:center;color:#dde3d7;font:18px Georgia;pointer-events:none}</style></head><body><div id="root"></div><script type="module" src="/stage.tsx"></script></body></html>');
await writeFile(fixture+'/stage.tsx',`
import React,{useMemo,useRef} from 'react';
import {createRoot} from 'react-dom/client';
import {Canvas,useFrame,useThree} from '@react-three/fiber';
import {DoubleSide} from 'three';
import {FOREST_ARCHETYPES,createForestArchetypeGeometry,FOREST_REFERENCE_TRUNK_SCALE,FOREST_REFERENCE_CROWN_SCALE,FOREST_REFERENCE_CROWN_HEIGHT} from '/@fs/${repo}/src/world/forest/forestGeometry.ts';
const detail=Number(new URLSearchParams(location.search).get('detail')||0);
function Tree({type,index}){const shapes=useMemo(()=>createForestArchetypeGeometry(type,detail),[]);return <group position={[(index%4-1.5)*9,index<4?15.5:0,0]} rotation={[0,.35,0]}><mesh position={[0,6,0]} scale={FOREST_REFERENCE_TRUNK_SCALE} geometry={shapes.trunk}><meshStandardMaterial color='#8b7c69' roughness={.94} vertexColors/></mesh><mesh position={[0,FOREST_REFERENCE_CROWN_HEIGHT,0]} scale={FOREST_REFERENCE_CROWN_SCALE} geometry={shapes.crown}><meshStandardMaterial color='#63805b' roughness={.96} vertexColors side={DoubleSide}/></mesh></group>;}
function Evidence(){const {gl,scene,camera}=useThree(),frames=useRef(0);useFrame(()=>{camera.lookAt(0,14.5,0);camera.updateProjectionMatrix();if(++frames.current===12){let meshes=0;scene.traverse(o=>{if(o.isMesh)meshes++;});window.__evidence={detail,meshes,calls:gl.info.render.calls,triangles:gl.info.render.triangles,geometries:gl.info.memory.geometries,textures:gl.info.memory.textures,renderer:(()=>{const context=gl.getContext(),debug=context.getExtension('WEBGL_debug_renderer_info');return context.getParameter(debug?debug.UNMASKED_RENDERER_WEBGL:context.RENDERER);})()};document.body.dataset.ready='true';}});return null;}
createRoot(document.getElementById('root')).render(<><Canvas orthographic dpr={1} camera={{position:[0,14.5,45],zoom:47,near:.1,far:100}} gl={{antialias:true}}><color attach='background' args={['#202827']}/><hemisphereLight args={['#f1f4df','#283024',1.5]}/><directionalLight position={[-5,13,10]} intensity={2.4}/>{FOREST_ARCHETYPES.map((type,index)=><Tree key={type} type={type} index={index}/>)}<Evidence/></Canvas>{FOREST_ARCHETYPES.map((type,index)=><div className='label' key={type} style={{left:(index%4)*25+'%',top:index<4?'45.5%':'94%'}}>{type.replaceAll('-',' ')}</div>)}</>);
`);
let server,browser; const report={angle,source:repo,method:'Actual ordinary archetype geometry at reference physical scale. Neutral studio lights, no world visual approval.',captures:[],failures:[]};
try{server=await createServer({configFile:false,root:fixture,plugins:[react()],server:{host:'127.0.0.1',port:4225,strictPort:true,hmr:false,fs:{allow:[repo,out]}},resolve:{dedupe:['react','react-dom','three','@react-three/fiber']},optimizeDeps:{noDiscovery:true,entries:[],include:['react','react-dom/client','three','@react-three/fiber']}});await server.listen();browser=await chromium.launch({args:['--enable-webgl','--ignore-gpu-blocklist','--use-angle='+angle]});for(const detail of [0,2]){const context=await browser.newContext({viewport:{width:1800,height:1500},deviceScaleFactor:1}),page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});await page.goto('http://127.0.0.1:4225/?detail='+detail);await page.bringToFront();await page.locator('body[data-ready="true"]').waitFor({timeout:60000});const metrics=await page.evaluate(()=>window.__evidence);console.log(JSON.stringify({metrics,errors}));if(errors.length||metrics.meshes!==16||metrics.calls!==16)throw Error(errors.join('\n')||'Incomplete tree board');await page.screenshot({path:resolve(out,'archetypes-'+(detail===0?'low':'rich')+'.png')});report.captures.push(metrics);console.log(JSON.stringify(metrics));await context.close();}}
catch(e){report.failures.push(String(e));throw e;}
finally{await browser?.close();await server?.close();await writeFile(resolve(out,'gallery.json'),JSON.stringify(report,null,2));}
