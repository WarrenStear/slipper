// Synthetic decoder/lifecycle diagnostics only. Nothing generated here is production art.
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, cp, symlink, writeFile, readFile, rm } from 'node:fs/promises';
import { spawn, execFileSync } from 'node:child_process';
import { resolve, join } from 'node:path';
import { tmpdir } from 'node:os';
import { chromium } from '@playwright/test';
import { Document, NodeIO } from '@gltf-transform/core';
import { KHRDracoMeshCompression, KHRTextureBasisu } from '@gltf-transform/extensions';
import draco from 'draco3dgltf';
import { BoxGeometry } from 'three';

const root = resolve(process.env.REVIEW_ROOT || process.cwd()), dependencies = process.cwd();
const out = resolve(process.env.REVIEW_OUT || join(tmpdir(), 'slipper-production-delivery'));
const port = Number(process.env.REVIEW_PORT || 4393), angle = process.env.REVIEW_ANGLE || 'swiftshader';
if (!['swiftshader', 'metal'].includes(angle)) throw Error('REVIEW_ANGLE must be swiftshader or metal');
if (!Number.isInteger(port) || port < 1024 || port > 65535) throw Error('Invalid REVIEW_PORT');
const fixture = await mkdtemp(join(tmpdir(), 'slipper-production-delivery-'));
const report = { requestedAngle: angle, passed: false, method: 'Temporary synthetic 12-triangle GLBs through the actual HeroAssetSlot, shared decoder pool and renderer-scoped cache. Two instances under React StrictMode; compressed diagnostics exercise local Draco/Basis delivery. Browser plugin not available; Playwright is used.',
  limitations: 'Technical decoder/fallback/ownership evidence only; no generated fixture is production art or artistic approval. One headless Chromium viewport at DPR 1, not mobile certification, sustained memory pressure or a guarantee of physical-device performance. Offline case aborts the model request while the already loaded fixture remains online.',
  generated: [], cases: [], errors: [], preparedOnly: process.env.REVIEW_PREPARE_ONLY === '1' };
let server, browser;
const serverOutput = [];
try {
  await mkdir(out, { recursive: true });
  for (const [source, name] of [[root + '/src', 'src'], [dependencies + '/node_modules', 'node_modules']]) await symlink(source, join(fixture, name), 'dir');
  await mkdir(join(fixture, 'public/art/heroes'), { recursive: true });
  for (const name of ['draco', 'basis']) await cp(join(root, 'public', name), join(fixture, 'public', name), { recursive: true });
  const ktx = await readFile(join(root, 'tests/fixtures/production-delivery/diagnostic-etc1s.ktx2'));
  assert.equal(ktx.length, 6629, 'Expected the documented upstream technical sample');
  const io = new NodeIO().registerExtensions([KHRDracoMeshCompression, KHRTextureBasisu]).registerDependencies({ 'draco3d.encoder': await draco.createEncoderModule() });
  const makeDocument = ({ compressed = false, textured = false, placeholder = false } = {}) => {
    const document = new Document(), storage = document.createBuffer();
    const geometry = new BoxGeometry(.5, .8, .5).translate(0, .4, 0);
    const primitive = document.createPrimitive();
    for (const [semantic, name, type] of [['POSITION', 'position', 'VEC3'], ['NORMAL', 'normal', 'VEC3'], ['TEXCOORD_0', 'uv', 'VEC2']]) {
      const array = geometry.getAttribute(name).array;
      primitive.setAttribute(semantic, document.createAccessor().setType(type).setArray(new Float32Array(array)).setBuffer(storage));
    }
    primitive.setIndices(document.createAccessor().setType('SCALAR').setArray(new Uint16Array(geometry.index.array)).setBuffer(storage));
    const material = document.createMaterial('Diagnostic material').setBaseColorFactor([.25, .65, .72, 1]).setRoughnessFactor(.8).setMetallicFactor(0);
    if (textured) {
      document.createExtension(KHRTextureBasisu).setRequired(true);
      material.setBaseColorTexture(document.createTexture('Official technical ETC1S sample').setMimeType('image/ktx2').setImage(new Uint8Array(ktx)));
    }
    primitive.setMaterial(material);
    const mesh = document.createMesh('Diagnostic cube, not art').addPrimitive(primitive);
    const node = document.createNode('Diagnostic cube').setMesh(mesh).setExtras({ diagnosticOnly: true, ...(placeholder ? { sidtwPlaceholder: true } : {}) });
    document.createScene('Temporary technical test').addChild(node);
    if (compressed) document.createExtension(KHRDracoMeshCompression).setRequired(true).setEncoderOptions({ method: KHRDracoMeshCompression.EncoderMethod.EDGEBREAKER, encodeSpeed: 5, decodeSpeed: 5 });
    geometry.dispose();
    return document;
  };
  const data = new Map();
  for (const [name, options] of [['plain', {}], ['draco', { compressed: true }], ['basis', { textured: true }], ['placeholder', { placeholder: true }]]) {
    const bytes = await io.writeBinary(makeDocument(options)); data.set(name, bytes);
    await writeFile(join(fixture, 'public/art/heroes', `${name}.glb`), bytes);
    report.generated.push({ name, bytes: bytes.length, synthetic: true, options });
  }
  // Keep the valid GLB container and map declaration; break only its embedded KTX identifier.
  const damaged = data.get('basis').slice(), view = new DataView(damaged.buffer, damaged.byteOffset, damaged.byteLength);
  const jsonLength = view.getUint32(12, true), json = JSON.parse(new TextDecoder().decode(damaged.subarray(20, 20 + jsonLength)));
  const imageView = json.bufferViews[json.images[0].bufferView], imageStart = 28 + jsonLength + (imageView.byteOffset || 0);
  damaged.fill(0, imageStart, imageStart + 12);
  await writeFile(join(fixture, 'public/art/heroes/invalid-ktx.glb'), damaged);
  await writeFile(join(fixture, 'public/art/heroes/invalid.glb'), 'not a glTF asset');
  await writeFile(join(fixture, 'index.html'), '<!doctype html><html lang="en"><meta charset="utf-8"><title>Production delivery diagnostic — never art approval</title><style>body{margin:0;background:#17232a;color:white;font:14px system-ui}#controls{position:absolute;z-index:2;padding:12px}button{padding:8px;margin:4px}#canvas{width:100vw;height:100vh}</style><div id="root"></div><script type="module" src="/stage.jsx"></script></html>');
  await writeFile(join(fixture, 'stage.jsx'), `
import React,{StrictMode,useEffect,useRef,useState} from 'react';
import {createRoot} from 'react-dom/client';
import {Canvas,useFrame,useThree} from '@react-three/fiber';
import * as THREE from 'three';
import {GLTFLoader} from 'three/examples/jsm/loaders/GLTFLoader.js';
import {HeroAssetSlot} from './src/components/three/actors/HeroAssetSlot';
import {HERO_ASSETS} from './src/components/three/actors/heroAssetRegistry';
const kind=new URLSearchParams(location.search).get('case')||'plain';
const files={draco:'draco',basis:'basis','missing-draco':'draco','missing-basis':'basis','invalid-ktx':'invalid-ktx',placeholder:'placeholder',invalid:'invalid',missing:'missing'};
const asset={status:'reviewed-production',url:'/art/heroes/'+(files[kind]||'plain')+'.glb',contract:'Temporary diagnostic cube in metres; no art approval.',review:{provenance:'Generated technical test only; embedded texture is the upstream MIT Three.js r171 decoder sample.',licence:'Technical fixture; Three.js MIT sample',reviewedBy:'Automated delivery diagnostic, not artistic approval',reviewedAt:'2026-09-26T00:00:00Z',revision:'diagnostic-'+kind,maxTriangles:12,maxMaterials:1,maxTextures:1,maxTextureDimension:1024,bounds:{min:[-.3,-.01,-.3],max:[.3,.81,.3]},baseY:{value:0,tolerance:.01}}};
HERO_ASSETS.key=kind==='unapproved'?{...asset,status:'authored-fallback'}:kind==='invalid-metadata'?{...asset,review:{...asset.review,provenance:''}}:asset;
const state=window.__delivery={frames:0,snapshot:null,fetches:[],parse:{started:0,pending:0,finished:0,failed:0},disposed:{materials:[],geometries:[],textures:[]},mounted:true};
const originalFetch=window.fetch.bind(window);
window.fetch=async(...args)=>{const url=String(args[0]?.url??args[0]);const entry={url,settled:false};state.fetches.push(entry);try{const response=await originalFetch(...args);entry.status=response.status;return response;}catch(error){entry.error=String(error);throw error;}finally{entry.settled=true;}};
const parse=GLTFLoader.prototype.parseAsync;
GLTFLoader.prototype.parseAsync=function(...args){state.parse.started++;state.parse.pending++;return parse.apply(this,args).then(value=>{state.parse.finished++;return value;},error=>{state.parse.failed++;throw error;}).finally(()=>{state.parse.pending--;});};
for(const [type,key] of [[THREE.Material,'materials'],[THREE.BufferGeometry,'geometries'],[THREE.Texture,'textures']]){const original=type.prototype.dispose;type.prototype.dispose=function(){state.disposed[key].push(this.uuid);return original.call(this);};}
function Probe(){const {scene,gl}=useThree();useFrame(()=>{state.frames++;const roots=[],fallbacks=[],lights=[];scene.traverse(object=>{if(object.userData.reviewedHero)roots.push(object);if(object.name.startsWith('diagnostic-fallback-'))fallbacks.push(object);if(object.isLight)lights.push(object);});const meshes=roots.map(root=>{let first;root.traverse(object=>{if(object.isMesh&&!first)first=object;});return first;});const context=gl.getContext(),debug=context.getExtension('WEBGL_debug_renderer_info');state.snapshot={frame:state.frames,hidden:document.hidden,visibility:document.visibilityState,contextLost:gl.getContext().isContextLost(),models:roots.length,fallbacks:fallbacks.length,lights:lights.length,triangles:gl.info.render.triangles,calls:gl.info.render.calls,geometries:gl.info.memory.geometries,textures:gl.info.memory.textures,renderer:debug?context.getParameter(debug.UNMASKED_RENDERER_WEBGL):context.getParameter(context.RENDERER),roots:roots.map(root=>root.uuid),metrics:roots.map(root=>root.userData.reviewedHero),materials:meshes.map(mesh=>mesh.material.uuid),geometryIds:meshes.map(mesh=>mesh.geometry.uuid),colors:meshes.map(mesh=>mesh.material.color?.getHexString())};state.mutate=()=>{meshes[0]?.material.color.set('#ff3333');};});return null;}
function Fallback({index}){return <group name={'diagnostic-fallback-'+index}><mesh position={[0,.4,0]}><boxGeometry args={[.5,.8,.5]}/><meshStandardMaterial color="#b58b52" roughness={1}/></mesh></group>;}
function App(){const [mounted,setMounted]=useState(true);useEffect(()=>{state.mounted=mounted;},[mounted]);return <><div id="controls"><strong>Synthetic delivery diagnostic — not production art</strong><br/><button onClick={()=>setMounted(value=>!value)}>{mounted?'Unmount':'Mount'} pair</button><button onClick={()=>state.mutate?.()}>Mutate first material</button></div><div id="canvas"><Canvas dpr={1} camera={{position:[1.8,1.5,3.4],fov:40,near:.1,far:20}} gl={{preserveDrawingBuffer:true}}><color attach="background" args={['#17232a']}/><hemisphereLight intensity={2}/><directionalLight position={[3,5,4]} intensity={2}/>{mounted&&[-.65,.65].map((x,index)=><group key={index} position={[x,0,0]}><HeroAssetSlot id="key"><Fallback index={index}/></HeroAssetSlot></group>)}<Probe/></Canvas></div></>;}
createRoot(document.getElementById('root')).render(<StrictMode><App/></StrictMode>);
`);
  await writeFile(join(fixture, 'vite.config.mjs'), `export default {root:${JSON.stringify(fixture)},cacheDir:${JSON.stringify(join(fixture, '.vite'))},esbuild:{jsx:'automatic'},resolve:{preserveSymlinks:true},server:{fs:{allow:[${JSON.stringify(fixture)},${JSON.stringify(root)},${JSON.stringify(dependencies)}]}}};`);
  // Build only this small diagnostic entry, never the application's dist directory.
  execFileSync(process.execPath, [dependencies + '/node_modules/vite/bin/vite.js', 'build', '--config', fixture + '/vite.config.mjs', '--outDir', fixture + '/dist'], { cwd: fixture, stdio: 'pipe', timeout: 120000 });
  if (report.preparedOnly) {
    report.preparation = 'Generated all diagnostics and built the isolated entry successfully; browser checks were not run.';
    console.log(report.preparation);
  } else {
    // Development entry deliberately exercises StrictMode effect cleanup/setup replay.
    server = spawn(process.execPath, [dependencies + '/node_modules/vite/bin/vite.js', '--config', fixture + '/vite.config.mjs', '--host', '127.0.0.1', '--port', String(port), '--strictPort'], { cwd: fixture, stdio: 'pipe' });
    for (const stream of [server.stdout, server.stderr]) stream.on('data', data => serverOutput.push(String(data)));
    let listening = false;
    for (let i = 0; i < 100; i++) { try { if ((await fetch(`http://127.0.0.1:${port}/`)).ok) { listening = true; break; } } catch {} await new Promise(resolve => setTimeout(resolve, 200)); }
    assert.ok(listening, 'Isolated fixture server did not become ready');
    browser = await chromium.launch({ args: ['--enable-webgl', '--ignore-gpu-blocklist', '--use-angle=' + angle] });
    const cases = ['unapproved', 'invalid-metadata', 'plain', 'draco', 'basis', 'slow', 'missing', 'offline', 'invalid', 'placeholder', 'missing-draco', 'missing-basis', 'invalid-ktx', 'lifecycle'];
    const success = new Set(['plain', 'draco', 'basis', 'slow', 'lifecycle']);
    const failure = new Set(['missing', 'offline', 'invalid', 'placeholder', 'missing-draco', 'missing-basis', 'invalid-ktx']);
    for (const name of cases) {
      const page = await browser.newPage({ viewport: { width: 800, height: 600 }, deviceScaleFactor: 1 });
      const entry = { name, passed: false, requests: [], expectedConsoleErrors: [], unexpectedConsoleErrors: [], pageErrors: [], checkpoints: [] };
      report.cases.push(entry);
      let releaseSlow, slowReleased = false;
      const held = new Promise(resolve => { releaseSlow = () => { slowReleased = true; resolve(); }; });
      page.on('pageerror', error => entry.pageErrors.push(error.message));
      page.on('console', message => {
        if (message.type() !== 'error') return;
        const text = message.text();
        const expected = failure.has(name) && /Failed to load resource|THREE\.GLTFLoader: Couldn't load texture/.test(text);
        (expected ? entry.expectedConsoleErrors : entry.unexpectedConsoleErrors).push(text);
      });
      page.on('request', request => { const url = request.url(); if (/\/art\/heroes\/|\/draco\/|\/basis\//.test(url)) entry.requests.push({ url, type: request.resourceType() }); });
      await page.route('**/favicon.ico', route => route.fulfill({ status: 204 }));
      if (name === 'missing') await page.route('**/art/heroes/*.glb', route => route.fulfill({ status: 404, contentType: 'text/plain', body: 'Intentional diagnostic missing model' }));
      if (name === 'offline') await page.route('**/art/heroes/*.glb', route => route.abort('internetdisconnected'));
      if (name === 'missing-draco' || name === 'missing-basis') await page.route(`**/${name === 'missing-draco' ? 'draco' : 'basis'}/*`, route => route.fulfill({ status: 404, contentType: 'text/plain', body: 'Intentional diagnostic missing decoder' }));
      if (name === 'slow' || name === 'lifecycle') await page.route('**/art/heroes/*.glb', async route => { if (!slowReleased) await held; try { await route.continue(); } catch { /* Unmount can intentionally abort the held request. */ } });
      const snap = () => page.evaluate(() => window.__delivery.snapshot);
      const settle = async () => {
        await page.waitForFunction(() => window.__delivery?.frames >= 30 && window.__delivery.parse.pending === 0 && window.__delivery.fetches.every(request => request.settled), null, { timeout: 60000 });
        const frame = await page.evaluate(() => window.__delivery.frames);
        await page.waitForFunction(frame => window.__delivery.frames >= frame + 12, frame, { timeout: 30000 });
      };
      const assertPair = async () => {
        await page.waitForFunction(() => window.__delivery?.snapshot?.models === 2 && window.__delivery.snapshot.fallbacks === 0, null, { timeout: 60000 });
        await settle();
        const actual = await snap();
        assert.equal(new Set(actual.roots).size, 2, 'Instances must be distinct scene clones');
        assert.equal(new Set(actual.materials).size, 2, 'Instances must own independent materials');
        assert.equal(new Set(actual.geometryIds).size, 1, 'Instances must share the cached source geometry');
        assert.equal(actual.lights, 2); assert.equal(actual.calls, 2); assert.equal(actual.triangles, 24);
        assert.ok(actual.geometries <= 2); assert.ok(actual.textures <= 1);
        for (const hero of actual.metrics) { assert.equal(hero.metrics.triangles, 12); assert.equal(hero.metrics.materials, 1); assert.equal(hero.metrics.drawCalls, 1); }
        return actual;
      };
      try {
        await page.bringToFront();
        await page.goto(`http://127.0.0.1:${port}/?case=${name}`);
        await page.bringToFront();
        await page.waitForFunction(() => !document.hidden);
        await page.waitForFunction(() => window.__delivery?.frames >= 20, null, { timeout: 60000 });
        if (name === 'slow' || name === 'lifecycle') {
          const pending = await snap(); assert.equal(pending.models, 0); assert.equal(pending.fallbacks, 2); entry.checkpoints.push({ phase: 'pending-retains-authored-fallbacks', ...pending });
          assert.equal(entry.requests.filter(request => request.url.endsWith('.glb')).length, 1, 'Two pending instances must share a request');
          if (name === 'lifecycle') {
            await page.getByRole('button', { name: 'Unmount pair', exact: true }).click();
            await page.waitForFunction(() => window.__delivery.snapshot.models === 0 && window.__delivery.snapshot.fallbacks === 0);
          }
          releaseSlow();
          if (name === 'lifecycle') {
            await settle(); entry.checkpoints.push({ phase: 'pending-unmount', ...await snap() });
            await page.getByRole('button', { name: 'Mount pair', exact: true }).click();
          }
        }
        if (success.has(name)) {
          entry.initial = await assertPair();
          const expectedRequests = name === 'lifecycle' ? 2 : 1;
          assert.equal(entry.requests.filter(request => request.url.endsWith('.glb')).length, expectedRequests, 'Model requests must coalesce across two mounted slots');
          if (name === 'basis') { assert.equal(entry.initial.metrics[0].metrics.textures, 1); assert.equal(entry.initial.textures, 1); }
          const before = entry.initial.colors;
          await page.getByRole('button', { name: 'Mutate first material', exact: true }).click();
          await page.waitForFunction(() => window.__delivery.snapshot.colors[0] === 'ff3333');
          assert.equal((await snap()).colors[1], before[1], 'Changing one clone must not alter the other');
          if (['plain', 'draco', 'basis'].includes(name)) await page.screenshot({ path: join(out, `${name}.png`), timeout: 30000 });
          for (let cycle = 0; cycle < (name === 'lifecycle' ? 3 : 1); cycle++) {
            await page.getByRole('button', { name: 'Unmount pair', exact: true }).click();
            await settle(); const empty = await snap();
            assert.equal(empty.models, 0); assert.equal(empty.fallbacks, 0); assert.equal(empty.geometries, 0); assert.equal(empty.textures, 0);
            entry.checkpoints.push({ phase: 'unmounted', cycle, ...empty });
            await page.getByRole('button', { name: 'Mount pair', exact: true }).click();
            entry.checkpoints.push({ phase: 'remounted', cycle, ...await assertPair() });
          }
        } else {
          await settle(); entry.initial = await snap();
          assert.equal(entry.initial.models, 0); assert.equal(entry.initial.fallbacks, 2);
          assert.equal(entry.initial.lights, 2); assert.equal(entry.initial.calls, 2); assert.equal(entry.initial.triangles, 24);
          assert.ok(entry.initial.geometries <= 2); assert.equal(entry.initial.textures, 0);
          assert.equal(entry.requests.filter(request => request.url.endsWith('.glb')).length, failure.has(name) ? 1 : 0);
          if (!failure.has(name)) assert.deepEqual(entry.requests, [], 'No admitted asset means no model or decoder traffic');
          if (name === 'missing-basis' || name === 'placeholder') await page.screenshot({ path: join(out, `${name}-fallback.png`), timeout: 30000 });
        }
        const decoderRequests = entry.requests.filter(request => /\/(?:draco|basis)\//.test(request.url));
        for (const request of decoderRequests) assert.ok(request.url.startsWith(`http://127.0.0.1:${port}/`), 'Decoder delivery must stay local');
        if (name === 'draco' || name === 'missing-draco') assert.ok(decoderRequests.some(request => request.url.includes('/draco/')), 'Draco case must exercise the real decoder');
        if (name === 'basis' || name === 'missing-basis') assert.ok(decoderRequests.some(request => request.url.includes('/basis/')), 'Basis case must exercise the real transcoder');
        entry.final = await page.evaluate(() => ({ snapshot: window.__delivery.snapshot, parse: window.__delivery.parse, fetches: window.__delivery.fetches, disposed: Object.fromEntries(Object.entries(window.__delivery.disposed).map(([key, values]) => [key, values.length])) }));
        if (name === 'missing') assert.equal(entry.final.fetches.find(request => request.url.endsWith('/missing.glb'))?.status, 404, 'Missing model must exercise actual HTTP404, not the Vite HTML fallback');
        assert.deepEqual(entry.pageErrors, []); assert.deepEqual(entry.unexpectedConsoleErrors, []);
        entry.passed = true;
        console.log(name, 'passed', JSON.stringify({ requests: entry.requests.length, metrics: entry.initial, checkpoints: entry.checkpoints.length }));
      } catch (error) {
        entry.error = String(error); report.errors.push(`${name}: ${error}`);
        try { entry.failureState = await page.evaluate(() => ({ snapshot: window.__delivery?.snapshot, parse: window.__delivery?.parse, fetches: window.__delivery?.fetches })); await page.screenshot({ path: join(out, `${name}-failure.png`), timeout: 30000 }); } catch {}
        console.error(name, String(error));
      } finally { releaseSlow(); await page.close(); }
    }
    assert.deepEqual(report.errors, []);
    report.passed = true;
  }
} catch (error) {
  report.errors.push(String(error)); throw error;
} finally {
  await browser?.close(); server?.kill('SIGTERM');
  await mkdir(out, { recursive: true });
  await writeFile(join(out, 'review.json'), JSON.stringify(report, null, 2));
  if (serverOutput.length) await writeFile(join(out, 'server.log'), serverOutput.join(''));
  await rm(fixture, { recursive: true, force: true });
}
