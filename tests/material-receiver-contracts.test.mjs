import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createHash } from 'node:crypto';
import { runInNewContext } from 'node:vm';
import * as THREE from 'three';
import ts from 'typescript';
import * as buffers from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { admitsProductionMaterialMaps } from '../src/components/three/materials/materialMapAdmission.ts';
import { cloneMaterialMapSampler, cloneReviewedMaterialMaps } from '../src/components/three/materials/productionMaterialRuntime.ts';
import { MATERIAL_MAPS, MATERIAL_MAP_CHANNELS, approvedMaterialMaps } from '../src/components/three/materials/materialMapRegistry.ts';
import { projectPlasterMetreUvs, hasNondegeneratePlasterUvs } from '../src/components/three/environmentArt/plasterGeometry.ts';
import * as authored from '../src/components/three/environmentArt/authoredGeometry.ts';
import { createConstructionGeometry } from '../src/components/three/chapters/chapterArtGeometry.ts';
import { tactileDetailFor, STORY_SURFACES } from '../src/components/three/storyEvents/tactileShader.ts';
const sha = value => createHash('sha256').update(value).digest('hex');
function fixture(name, expected) { const source=fs.readFileSync(new URL('./fixtures/material-receivers/'+name,import.meta.url),'utf8');assert.equal(sha(source),expected,'immutable actual baseline');return source; }
function evaluate(source, imports, globals={}) {
  const code=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText,exports={};
  runInNewContext(code,{require:id=>{assert.ok(id in imports,'known immutable dependency '+id);return imports[id];},exports,...globals},{timeout:1000});return exports;
}
const baselineConstruction=evaluate(fixture('construction-before.txt','fb7801b11ebade5ff2e1a3b1428a9776ffa8b8596fcb73d0876b98a59d60a0a7'),{
  three:THREE,'three/examples/jsm/utils/BufferGeometryUtils.js':buffers,'../environmentArt/authoredGeometry.ts':authored,
}).createConstructionGeometry;
const baselineClone=evaluate(fixture('clone-sampler-before.txt','082654491b4ba3c63623780c9a30af268cfb325991869e2e51a7d860d555b6da'),{}, {
  approvedMaterialMaps, SRGBColorSpace:THREE.SRGBColorSpace,NoColorSpace:THREE.NoColorSpace,RepeatWrapping:THREE.RepeatWrapping,
  disposeMaterialMaps:maps=>Object.values(maps).forEach(texture=>texture?.dispose()),
}).cloneReviewedMaterialMaps;
function expanded(geometry,name){const attr=geometry.getAttribute(name),result=[];for(const vertex of geometry.index.array)for(let c=0;c<attr.itemSize;c++)result.push(attr.array[vertex*attr.itemSize+c]);return Buffer.from(new Float32Array(result).buffer);}
function exactArrayBytes(actual,expected){
  assert.equal(actual.constructor.name,expected.constructor.name);
  assert.equal(actual.length,expected.length);
  assert.deepEqual(Buffer.from(actual.buffer,actual.byteOffset,actual.byteLength),Buffer.from(expected.buffer,expected.byteOffset,expected.byteLength));
}

test('actual admission preserves inherited quality and explicit coordinate contracts without approving an asset',()=>{
  for(const quality of ['low','medium','high','cinematic'])for(const reduced of [false,true])for(const surface of STORY_SURFACES){
    const detail=tactileDetailFor(quality,reduced),enabled=!reduced&&['high','cinematic'].includes(quality);
    assert.equal(admitsProductionMaterialMaps(surface,detail,'relief',{constructionCoordinates:true,barkCoordinates:true,reviewedCoordinates:true}),enabled);
    assert.equal(admitsProductionMaterialMaps(surface,detail,'relief',{},true),false);
    assert.equal(admitsProductionMaterialMaps(surface,detail,'base',{constructionCoordinates:true,barkCoordinates:true,reviewedCoordinates:true}),false);
  }
  for(const surface of ['wood','wet-wood']){assert.equal(admitsProductionMaterialMaps(surface,'relief','relief',{reviewedCoordinates:true}),false);assert.equal(admitsProductionMaterialMaps(surface,'relief','relief',{constructionCoordinates:true}),true);}
  assert.equal(admitsProductionMaterialMaps('bark','relief','relief',{constructionCoordinates:true}),false);
  for(const surface of ['plaster','linen','metal','stone','earth','paper','velvet','ash']){assert.equal(admitsProductionMaterialMaps(surface,'relief','relief'),false);assert.equal(admitsProductionMaterialMaps(surface,'relief','relief',{reviewedCoordinates:true}),true);assert.equal(approvedMaterialMaps(MATERIAL_MAPS[surface]),null);}
});

test('approved oak and wet oak retain exact original clone sampler settings and source transforms on all channels',()=>{
  assert.deepEqual(MATERIAL_MAPS.wood.channels,MATERIAL_MAPS['wet-wood'].channels);
  for(const channel of MATERIAL_MAP_CHANNELS){
    const source=new THREE.Texture({width:256,height:256});source.repeat.set(4,7);source.offset.set(.3,.7);source.rotation=.2;source.flipY=true;
    const entry={...MATERIAL_MAPS.wood,channels:{[channel]:'/art/materials/oak/probe.ktx2'},repeat:[2,3],offset:[.1,.4],rotation:.3,...channel==='aoMap'?{aoUvChannel:1}:{}};
    const old=baselineClone({[channel]:source},entry)[channel],next=cloneReviewedMaterialMaps({[channel]:source},entry)[channel];
    for(const key of ['channel','colorSpace','wrapS','wrapT','rotation','flipY'])assert.equal(next[key],old[key],channel+':'+key);
    for(const key of ['repeat','offset','center','matrix'])assert.deepEqual(next[key].toArray(),old[key].toArray(),channel+':'+key);
    assert.notEqual(next,source);assert.equal(next.source,source.source);assert.deepEqual(source.repeat.toArray(),[4,7]);assert.deepEqual(source.offset.toArray(),[.3,.7]);assert.equal(source.rotation,.2);assert.equal(source.flipY,true);old.dispose();next.dispose();source.dispose();
  }
  assert.throws(()=>cloneReviewedMaterialMaps({},MATERIAL_MAPS.plaster),/Unreviewed/);
  const oversized=new THREE.Texture({width:2048,height:512});assert.throws(()=>cloneReviewedMaterialMaps({map:oversized},MATERIAL_MAPS.wood),/texture budget/);oversized.dispose();
});

test('sampler helper failure disposes its unreturned view and the approved transaction retires earlier views once',()=>{
  const source=new THREE.Texture({width:256,height:256}),failure=new THREE.Texture({width:256,height:256});let firstDisposed=0,brokenDisposed=0,sourceDisposed=0;
  source.addEventListener('dispose',()=>sourceDisposed++);failure.addEventListener('dispose',()=>sourceDisposed++);
  const clone=source.clone.bind(source);source.clone=()=>{const texture=clone();texture.addEventListener('dispose',()=>firstDisposed++);return texture;};
  const broken=failure.clone.bind(failure);failure.clone=()=>{const texture=broken();texture.addEventListener('dispose',()=>brokenDisposed++);texture.updateMatrix=()=>{throw Error('controlled configuration throw');};return texture;};
  assert.throws(()=>cloneReviewedMaterialMaps({map:source,normalMap:failure},{...MATERIAL_MAPS.wood,channels:{map:MATERIAL_MAPS.wood.channels.map,normalMap:MATERIAL_MAPS.wood.channels.normalMap}}),/configuration throw/);
  assert.deepEqual([firstDisposed,brokenDisposed,sourceDisposed],[1,1,0]);source.dispose();failure.dispose();
});

test('plaster metre projection fixes actual collapsed cap UVs while every indexed physical position/normal and bounds stays exact',()=>{
  for(const size of [[.34,4.4,11.8],[4.6,2.8,.16],[2.8,.14,3.1],[.0001,.0001,.0001],[40,.2,17]])for(const seed of [0,17,99]){
    const before=authored.createWeatheredPanelGeometry(size,seed),source=before.clone();let disposed=0;source.addEventListener('dispose',()=>disposed++);const after=projectPlasterMetreUvs(source);
    assert.equal(hasNondegeneratePlasterUvs(before),false,'actual old collapsed-cap negative control');assert.equal(hasNondegeneratePlasterUvs(after),true);
    for(const name of Object.keys(before.attributes).filter(name=>name!=='uv'))assert.deepEqual(expanded(after,name),expanded(before,name),name+' triangle order/bytes');
    assert.equal(after.index.count,before.index.count);assert.equal(after.index.count/3,60);assert.deepEqual(after.boundingBox,before.boundingBox);assert.deepEqual(after.boundingSphere,before.boundingSphere);assert.equal(disposed,1);assert.equal(after.hasAttribute('uv1'),false);before.dispose();after.dispose();
  }
});

test('actual construction assemblies preserve transformed plaster triangles, colours, batches and all unrelated timber buffers',()=>{
  const pieces=[{position:[0,1.4,2],size:[4.6,2.8,.16],color:'#746251'},{position:[-1.7,.3,-.2],size:[.22,3.1,1.2],rotation:[.1,.3,-.05],color:'#908271'},{position:[.1,3,1],size:[3.8,.14,2.9],rotation:[0,.6,0]}];
  for(const plaster of [false,true]){const before=baselineConstruction(pieces,plaster),after=createConstructionGeometry(pieces,plaster);
    for(const name of Object.keys(before.attributes).filter(name=>name!=='uv'))assert.deepEqual(expanded(after,name),expanded(before,name));
    assert.equal(after.index.count,before.index.count);assert.deepEqual(after.groups,before.groups);assert.deepEqual(after.boundingBox,before.boundingBox);assert.deepEqual(after.boundingSphere,before.boundingSphere);
    if(plaster)assert.equal(hasNondegeneratePlasterUvs(after),true);else{exactArrayBytes(after.index.array,before.index.array);for(const name of Object.keys(before.attributes)){const actual=after.getAttribute(name),expected=before.getAttribute(name);assert.equal(actual.itemSize,expected.itemSize);assert.equal(actual.normalized,expected.normalized);exactArrayBytes(actual.array,expected.array);}}
    before.dispose();after.dispose();
  }
});

test('strict receiver guard rejects one collapsed physical triangle, absent UV and nonfinite coordinates without manufacturing AO',()=>{
  const geometry=projectPlasterMetreUvs(authored.createWeatheredPanelGeometry([4.6,2.8,.16],17)),uv=geometry.getAttribute('uv'),index=geometry.index;
  assert.equal(hasNondegeneratePlasterUvs(geometry),true);assert.ok(Math.max(...uv.array)>1);
  const a=index.getX(0);for(const vertex of [index.getX(1),index.getX(2)])uv.setXY(vertex,uv.getX(a),uv.getY(a));assert.equal(hasNondegeneratePlasterUvs(geometry),false);
  uv.setXY(a,NaN,0);assert.equal(hasNondegeneratePlasterUvs(geometry),false);geometry.deleteAttribute('uv');assert.equal(hasNondegeneratePlasterUvs(geometry),false);assert.equal(geometry.hasAttribute('uv1'),false);geometry.dispose();
});

test('plaster metre sampler repeats UVs beyond one rather than smearing the default clamped decoded source edge',()=>{
  const source=new THREE.Texture({width:512,height:512}),view=cloneMaterialMapSampler(source,'map',{repeat:[1,1]});
  const uv=new THREE.Vector2(2.3,1.6),old=uv.clone(),next=uv.clone();source.transformUv(old);view.transformUv(next);
  assert.deepEqual(old.toArray(),[1,0]);assert.ok(Math.abs(next.x-.3)<1e-12);assert.ok(Math.abs(next.y-.6)<1e-12);assert.equal(view.flipY,false);assert.equal(view.colorSpace,THREE.SRGBColorSpace);assert.equal(view.source,source.source);view.dispose();source.dispose();
});
