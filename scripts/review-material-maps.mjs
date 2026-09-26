// Development-only matched material review. No review controls enter the app.
import { chromium } from '@playwright/test';
import { mkdtemp, mkdir, symlink, writeFile, rm, copyFile } from 'node:fs/promises';
import { execFileSync, spawn } from 'node:child_process';
import { resolve, join } from 'node:path';
import { tmpdir } from 'node:os';
import assert from 'node:assert/strict';

const root = process.cwd(), repo = resolve(process.env.REVIEW_ROOT || root);
const out = resolve(process.env.REVIEW_OUT || join(tmpdir(), 'slipper-material-review'));
const angle = process.env.REVIEW_ANGLE || 'swiftshader', port = Number(process.env.REVIEW_PORT || 4386);
if (!['swiftshader', 'metal'].includes(angle)) throw Error('Invalid REVIEW_ANGLE');
const surfaces = (process.env.REVIEW_MATERIALS || 'wood,wet-wood,plaster,linen,metal').split(',');
const states = (process.env.REVIEW_STATES || 'dry,wet,worn,damaged,reintegrated').split(',');
const modes = (process.env.REVIEW_MODES || 'procedural,reviewed').split(',');
const uvMode = process.env.REVIEW_UV || 'uv0';
const allowedSurfaces = ['wood', 'wet-wood', 'bark', 'plaster', 'linen', 'velvet', 'stone', 'earth', 'ash', 'metal', 'paper'];
const allowedModes = ['procedural', 'reviewed', 'diagnostic', 'diagnostic-missing', 'diagnostic-invalid', 'diagnostic-offline', 'diagnostic-slow'];
assert.ok(surfaces.every(surface => allowedSurfaces.includes(surface)));
assert.ok(states.every(state => ['dry', 'wet', 'worn', 'damaged', 'reintegrated'].includes(state)));
assert.ok(modes.every(mode => allowedModes.includes(mode)));
assert.ok(['uv0', 'missing-uv', 'ao1'].includes(uvMode));
const variants = process.env.REVIEW_MATRIX === '1'
  ? [['low', 1100, 720, false], ['high', 1100, 720, false], ['high', 1100, 720, true], ['low', 393, 851, true], ['low', 851, 393, true]]
  : [['low', 1100, 720, false], ['high', 1100, 720, false]];
const fixture = await mkdtemp(join(tmpdir(), 'slipper-material-review-'));
const report = { root: repo, angle, uvMode, method: 'Fixed camera and identical studio lighting for procedural/reviewed comparison across dry, wet, worn, damaged and reintegrated memory. Registry authority is unchanged. Diagnostic modes use an explicitly test-only official Three ETC1S image in temporary output, not approved art. Missing reviewed assets are recorded as unavailable, never a production comparison. UV1 in ao1 mode is an explicit fixture atlas, not manufactured by the material runtime. Not physical-device certification.', captures: [], errors: [] };
let browser, server, serverLog = '';
try {
 await mkdir(out, { recursive: true });
 for (const [source, name] of [[repo + '/src', 'src'], [repo + '/public', 'public'], [root + '/node_modules', 'node_modules']]) await symlink(source, join(fixture, name), 'dir');
 await writeFile(join(fixture, 'index.html'), '<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><title>Development material review</title><style>body{margin:0;background:#20272a;color:#e4e6e3;font:14px system-ui}#root{width:100vw;height:100vh}aside{position:fixed;z-index:1;top:16px;left:16px;right:16px;pointer-events:none}small{display:block;margin-top:5px}</style></head><body><div id="root"></div><script type="module" src="/stage.tsx"></script></body></html>');
 await writeFile(join(fixture, 'stage.tsx'), `
import React,{useLayoutEffect,useRef} from 'react';import {createRoot} from 'react-dom/client';import {Canvas,useFrame,useThree} from '@react-three/fiber';import * as THREE from 'three';
import {TactileMaterial,TactileDetailProvider} from './src/components/three/storyEvents/TactileMaterial';
import {useProductionMaterialMapDelivery} from './src/components/three/materials/useProductionMaterialMaps';
import {MATERIAL_MAPS,approvedMaterialMaps} from './src/components/three/materials/materialMapRegistry';
const p=new URLSearchParams(location.search),surface=p.get('surface'),state=p.get('state'),mode=p.get('mode'),quality=p.get('quality'),reduced=p.get('reduced')==='1',uvMode=p.get('uv');
const diagnostic=mode.startsWith('diagnostic'),originalStatus=MATERIAL_MAPS[surface]?.status;
if(diagnostic)MATERIAL_MAPS[surface]={status:'reviewed-production',maxDimension:1024,repeat:[2,2],aoUvChannel:1,normalConvention:'opengl',provenance:'TEST ONLY: official Three r171 2d_etc1s decoder diagnostic, not final material art',licence:'Three MIT; fixture provenance record',reviewedBy:'Technical decoder fixture only',reviewedAt:'2026-09-26',channels:Object.fromEntries(['map','normalMap','roughnessMap','aoMap'].map(channel=>[channel,'/art/materials/test-diagnostic.ktx2']))};
const approved=!!approvedMaterialMaps(MATERIAL_MAPS[surface]),enabled=mode!=='procedural'&&quality==='high'&&!reduced;
const memory=state==='wet'?{wetness:1}:state==='worn'?{wear:1}:state==='damaged'?{wear:.6,damage:.85}:state==='reintegrated'?{wear:.6,damage:.85,reintegrated:true}:{};
const colors={wood:'#846444','wet-wood':'#6d5944',plaster:'#c0b9ac',linen:'#c7c0ae',metal:'#827e69',bark:'#615244',stone:'#85877e',earth:'#5f5343',paper:'#c7b995',velvet:'#694f58',ash:'#686762'};
function geometryUv(geometry){if(uvMode==='missing-uv')geometry.deleteAttribute('uv');else if(uvMode==='ao1')geometry.setAttribute('uv1',geometry.getAttribute('uv').clone());}
function Samples(){const delivery=useProductionMaterialMapDelivery(surface,enabled);return <><mesh position={[-1.1,0,0]} rotation={[0,.3,0]} name="material-box"><boxGeometry args={[1.6,1.8,.8]} onUpdate={geometryUv}/><TactileMaterial surface={surface} color={colors[surface]} roughness={.85} metalness={surface==='metal'?.72:0} memory={memory} maps={delivery.maps??{}}/></mesh><mesh position={[1.05,0,0]} name="material-sphere"><sphereGeometry args={[.92,quality==='high'?48:16,quality==='high'?32:12]} onUpdate={geometryUv}/><TactileMaterial surface={surface} color={colors[surface]} roughness={.85} metalness={surface==='metal'?.72:0} memory={memory} maps={delivery.maps??{}}/></mesh><Probe delivery={delivery}/></>;}
function Probe({delivery}){const {camera,scene,gl,setFrameloop}=useThree(),frames=useRef(0);
useLayoutEffect(()=>{const distance=camera.aspect<1?1.65:1;camera.position.set(3.5*distance,2.4*distance,6.2*distance);camera.lookAt(0,0,0);camera.updateProjectionMatrix();gl.toneMapping=THREE.ACESFilmicToneMapping;gl.outputColorSpace=THREE.SRGBColorSpace;},[]);
useFrame(()=>{if(delivery.status==='loading'){frames.current=0;return;}if(++frames.current!==36)return;const materials=['material-box','material-sphere'].map(name=>{const mesh=scene.getObjectByName(name),m=mesh.material;return {name,applied:['map','normalMap','roughnessMap','aoMap'].filter(channel=>!!m[channel]),channels:Object.fromEntries(['map','normalMap','roughnessMap','aoMap'].filter(channel=>m[channel]).map(channel=>[channel,m[channel].channel])),uv0:mesh.geometry.hasAttribute('uv'),uv1:mesh.geometry.hasAttribute('uv1')};});const context=gl.getContext(),debug=context.getExtension('WEBGL_debug_renderer_info');window.__materialEvidence={surface,state,mode,quality,reduced,uvMode,originalStatus,approved,deliveryStatus:delivery.status,productionComparisonAvailable:mode==='reviewed'&&delivery.status==='ready',diagnostic,materials,camera:camera.position.toArray(),calls:gl.info.render.calls,triangles:gl.info.render.triangles,textures:gl.info.memory.textures,renderer:debug?context.getParameter(debug.UNMASKED_RENDERER_WEBGL):context.getParameter(context.RENDERER)};document.body.dataset.ready='true';setFrameloop('never');});return null;}
createRoot(document.getElementById('root')).render(<><aside><b>{surface} · {state} · {mode}</b><small>{diagnostic?'TEST-ONLY TRANSCODER/UV DIAGNOSTIC — not production art':mode==='reviewed'&&!approved?'Reviewed production maps unavailable; procedural fallback shown':'Matched studio light and camera'} · {quality}{reduced?' / reduced effects':''}</small></aside><Canvas dpr={1} camera={{fov:42,near:.05,far:60}} gl={{preserveDrawingBuffer:true}}><color attach="background" args={['#20272a']}/><hemisphereLight args={['#d5dbdc','#3c352d',1.1]}/><directionalLight position={[-3,4,2]} intensity={2.8} color="#eadccb"/><TactileDetailProvider quality={quality} reducedEffects={reduced}><Samples/></TactileDetailProvider></Canvas></>);
`);
 await writeFile(join(fixture, 'vite.config.mjs'), `export default {root:${JSON.stringify(fixture)},cacheDir:${JSON.stringify(fixture + '/cache')},esbuild:{jsx:'automatic'},resolve:{preserveSymlinks:true}};`);
 execFileSync(process.execPath, [root + '/node_modules/vite/bin/vite.js', 'build', '--config', fixture + '/vite.config.mjs', '--outDir', fixture + '/dist'], { cwd: fixture, stdio: 'pipe', timeout: 120000 });
 if (modes.some(mode => mode.startsWith('diagnostic'))) {
  await mkdir(fixture + '/dist/art/materials', { recursive: true });
  await copyFile(repo + '/tests/fixtures/production-delivery/diagnostic-etc1s.ktx2', fixture + '/dist/art/materials/test-diagnostic.ktx2');
 }
 server = spawn(process.execPath, [root + '/node_modules/vite/bin/vite.js', 'preview', '--config', fixture + '/vite.config.mjs', '--host', '127.0.0.1', '--port', String(port), '--strictPort'], { cwd: fixture, stdio: 'pipe' });
 server.stdout.on('data', chunk => { serverLog += chunk; }); server.stderr.on('data', chunk => { serverLog += chunk; });
 for (let index = 0; index < 100; index++) { if (server.exitCode !== null) throw Error('Material review preview exited: ' + serverLog); try { if ((await fetch('http://127.0.0.1:' + port)).ok) break; } catch {} await new Promise(resolve => setTimeout(resolve, 200)); }
 browser = await chromium.launch({ args: ['--enable-webgl', '--ignore-gpu-blocklist', '--use-angle=' + angle] });
 for (const surface of surfaces) for (const state of states) for (const mode of modes) for (const [quality, width, height, reduced] of variants) {
  const name = [surface, state, mode, quality, width, height, reduced ? 'reduced' : 'full', uvMode].join('-');
  const context = await browser.newContext({ viewport: { width, height }, reducedMotion: 'reduce' });
  const page = await context.newPage(), errors = [], requests = [];
  page.on('pageerror', error => errors.push(error.message)); page.on('request', request => { if (/\/(?:art\/materials|basis)\//.test(request.url())) requests.push(new URL(request.url()).pathname); });
  page.on('console', message => { if (message.type() === 'error' && !(['diagnostic-missing', 'diagnostic-invalid', 'diagnostic-offline'].includes(mode) && message.text().startsWith('Failed to load resource:'))) errors.push(message.text()); });
  if (mode === 'diagnostic-missing') await page.route('**/art/materials/test-diagnostic.ktx2', route => route.fulfill({ status: 404, body: 'fixture missing file' }));
  if (mode === 'diagnostic-invalid') await page.route('**/art/materials/test-diagnostic.ktx2', route => route.fulfill({ status: 200, body: 'fixture invalid KTX2' }));
  if (mode === 'diagnostic-offline') await page.route('**/art/materials/test-diagnostic.ktx2', route => route.abort('internetdisconnected'));
  if (mode === 'diagnostic-slow') await page.route('**/art/materials/test-diagnostic.ktx2', async route => { await new Promise(resolve => setTimeout(resolve, 500)); await route.continue(); });
  try {
   await page.goto('http://127.0.0.1:' + port + '/?' + new URLSearchParams({ surface, state, mode, quality, reduced: reduced ? '1' : '0', uv: uvMode }));
   await page.waitForFunction(() => document.body.dataset.ready === 'true', null, { timeout: 60000 });
   const evidence = await page.evaluate(() => window.__materialEvidence);
   assert.deepEqual(errors, []); assert.ok(evidence.calls > 0);
   if (quality === 'low' || reduced || mode === 'procedural' || !evidence.approved) { assert.equal(requests.length, 0); assert.ok(evidence.materials.every(material => material.applied.length === 0)); }
   if (quality === 'high' && !reduced && mode.startsWith('diagnostic')) {
    const failure = ['diagnostic-missing', 'diagnostic-invalid', 'diagnostic-offline'].includes(mode);
    assert.equal(evidence.deliveryStatus, failure ? 'failed' : 'ready');
    const expected = failure || uvMode === 'missing-uv' ? [] : uvMode === 'ao1' ? ['map', 'normalMap', 'roughnessMap', 'aoMap'] : ['map', 'normalMap', 'roughnessMap'];
    evidence.materials.forEach(material => assert.deepEqual(material.applied, expected));
   }
   await page.screenshot({ path: join(out, name + '.png') }); report.captures.push({ name, width, height, requests, ...evidence }); console.log(name, JSON.stringify(evidence));
  } catch (error) { report.errors.push({ name, error: String(error), pageErrors: errors }); throw error; }
  finally { await context.close(); await writeFile(join(out, 'material-review.json'), JSON.stringify(report, null, 2)); }
 }
} finally { await browser?.close(); server?.kill('SIGTERM'); await rm(fixture, { recursive: true, force: true }); await writeFile(join(out, 'preview.log'), serverLog); await writeFile(join(out, 'material-review.json'), JSON.stringify(report, null, 2)); }
