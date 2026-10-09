import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {dirname,join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createRequire} from 'node:module';
import {runInNewContext} from 'node:vm';
const here=dirname(fileURLToPath(import.meta.url)),root=join(here,'..'),fixtures=join(here,'fixtures/transformation-art-baseline');
const require=createRequire(import.meta.url),ts=require('typescript'),THREE=require('three'),jsx=require('react/jsx-runtime');
const receipt=JSON.parse(readFileSync(join(fixtures,'provenance.json'),'utf8'));
const source=(name,before=false)=>readFileSync(before?join(fixtures,name):join(root,receipt.files.find(r=>r.fixture===name).path),'utf8');
const ordinary={worldFlags:{'story-events.started':true},inventory:{symbolicObjects:[]}};
const marker=new Proxy({}, {get:(_,name)=>String(name)});
function moduleSource(body,{state=ordinary,cleanups=[],dependencies={}}={}){
 const exports={};
 const react={memo:fn=>fn,useMemo:fn=>fn(),useEffect:fn=>{const cleanup=fn();if(cleanup)cleanups.push(cleanup);}};
 const localRequire=name=>dependencies[name]??(name==='react'?react:name==='react/jsx-runtime'?jsx:name==='three'?THREE:name.endsWith('useJourneyStore')?{useJourneyStore:select=>select(state)}:name.endsWith('journeyWorldLayout')?{getJourneySceneArrivalHeading:()=>.63}:marker);
 const js=ts.transpileModule(body,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX}}).outputText;
 runInNewContext(js,{exports,require:localRequire},{timeout:1000});return exports;
}
const load=(name,before=false,options={})=>moduleSource(source(name,before),options);
function nodes(tree){const found=[];function visit(v){if(Array.isArray(v))v.forEach(visit);else if(v&&typeof v==='object'&&v.props){found.push(v);visit(v.props.children);}}visit(tree);return found;}
const named=(tree,name)=>nodes(tree).find(n=>n.props.name===name);
const types=tree=>nodes(tree).map(n=>typeof n.type==='function'?n.type.name:n.type);
const json=v=>JSON.parse(JSON.stringify(v));
const chapterProps=id=>({scene:{id},qualityProfile:{quality:'high'},reducedEffects:false,reducedMotion:false});
const collect=(text,predicate)=>{const found=[],sf=ts.createSourceFile('source.tsx',text,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);function walk(n){if(predicate(n))found.push(n.getText(sf));ts.forEachChild(n,walk);}walk(sf);return found;};
const fn=(text,name)=>collect(text,n=>ts.isFunctionDeclaration(n)&&n.name?.text===name)[0];

test('frozen originals pin the actual source for every visual owner',()=>{
 for(const row of receipt.files)assert.equal(createHash('sha256').update(source(row.fixture,true)).digest('hex'),row.sha256,row.fixture);
});
test('Integration removes competing route discs, candles and ring while preserving real actors and water',()=>{
 const scene='wolf-swan.convergence',before=load('IntegrationChapter.tsx',true).IntegrationChapter(chapterProps(scene)),after=load('IntegrationChapter.tsx').IntegrationChapter(chapterProps(scene));
 assert.equal(types(before).filter(t=>t==='StonePath').length,2);assert.equal(types(after).filter(t=>t==='StonePath').length,0);
 for(const t of ['MoonDisc','CandleField','ReflectivePanel'])assert.ok(!types(after).includes(t),t);
 assert.equal(types(after).filter(t=>t==='WaterSurface').length,1);assert.equal(types(after).filter(t=>t==='TreeGrove').length,1);
 assert.ok(!named(after,'integrated-swan-node'));assert.ok(named(load('IntegrationChapter.tsx',false,{state:{...ordinary,worldFlags:{}}}).IntegrationChapter(chapterProps(scene)),'integrated-swan-node'));
 const choice=load('IntegrationChapter.tsx').IntegrationChapter(chapterProps('wolf-swan.false-choice'));assert.ok(!types(choice).includes('ringGeometry'));
});
test('Integration shoreline retains bounded counts and opens the central witness space',()=>{
 const render=before=>load('IntegrationChapter.tsx',before).IntegrationChapter(chapterProps('wolf-swan.convergence'));
 const oldStones=named(render(true),'wood-water-stone-passage').props.forms,newStones=named(render(false),'wood-water-stone-passage').props.forms;
 assert.equal(newStones.length,oldStones.length);assert.equal(newStones.length,15);
 for(const form of newStones){assert.ok(Math.abs(form.position[0])>4.8);assert.ok(form.position[1]<0);assert.ok(form.scale[1]<=.23);}
 const reeds=nodes(render(false)).find(n=>n.type==='BotanicalBatch').props.placements;assert.equal(reeds.length,10);assert.ok(reeds.every(p=>Math.abs(p.position[0])>5));
});
test('Fork removes legacy door/sign/veil duplicates only for active canonical story objects',()=>{
 for(const id of ['fork.four-verbs','fork.relinquish-hope']){
  const component=load('ForkChapter.tsx').ForkChapter,active=component(chapterProps(id));
  for(const type of ['DoorFrame','FabricVeil','TimberAssembly','LanternProp'])assert.ok(!types(active).includes(type),id+': '+type);
  assert.ok(types(active).includes('SittingStone'));assert.equal(types(active).filter(t=>t==='HouseShell').length,1);
  const fallback=load('ForkChapter.tsx',false,{state:{...ordinary,worldFlags:{}}}).ForkChapter(chapterProps(id));
  assert.ok(types(fallback).includes(id==='fork.four-verbs'?'DoorFrame':'LanternProp'));
 }
 assert.equal(fn(source('ForkChapter.tsx'),'SittingStone'),fn(source('ForkChapter.tsx',true),'SittingStone'));
});
test('Climbs retain canonical object ownership and legacy fallback without path discs or beam arrows',()=>{
 for(const id of ['climbs.arrival','climb.mind','climb.heart','climb.womb']){
  const active=load('ThreeClimbsChapter.tsx').ThreeClimbsChapter(chapterProps(id));assert.ok(!types(active).includes('StonePath'));assert.ok(!types(active).includes('Beam'));
  for(const t of ['HeartRoseMemory','HeartSwanFeatherMemory','HeartBlueMoonMemory','FutureRestSymbol','FutureHomeSymbol','FutureVoiceSymbol','KeyProp','MoonDisc'])assert.ok(!types(active).includes(t),id+': '+t);
 }
 for(const [id,type]of [['climb.heart','HeartRoseMemory'],['climb.womb','FutureRestSymbol']])assert.ok(types(load('ThreeClimbsChapter.tsx',false,{state:{...ordinary,worldFlags:{}}}).ThreeClimbsChapter(chapterProps(id))).includes(type));
 for(const name of ['HeartRoseMemory','HeartSwanFeatherMemory','HeartBlueMoonMemory','FutureRestSymbol','FutureHomeSymbol','FutureVoiceSymbol','ProtectedCreationSpace'])assert.equal(fn(source('ThreeClimbsChapter.tsx'),name),fn(source('ThreeClimbsChapter.tsx',true),name),name);
});
test('every existing readonly story selector and material/light/frame hook remains within the original owner set',()=>{
 for(const row of receipt.files){
  const before=source(row.fixture,true),after=source(row.fixture);
  for(const selector of collect(before,n=>ts.isCallExpression(n)&&n.expression.getText()==='useJourneyStore'))assert.ok(after.includes(selector),row.fixture+' selector');
  for(const hook of ['useFrame','useEffect'])assert.deepEqual(collect(after,n=>ts.isCallExpression(n)&&n.expression.getText()===hook),collect(before,n=>ts.isCallExpression(n)&&n.expression.getText()===hook),row.fixture+' '+hook);
  assert.ok((after.match(/<\w*Light\b/g)||[]).length<=(before.match(/<\w*Light\b/g)||[]).length);
  assert.doesNotMatch(after,/WebGLRenderTarget|new Texture|new .*Material\(|dispatchStoryEvent|setState\(/);
 }
});
test('actual Fork geometry keeps every position, index, normal and UV while making worn soil less uniform',()=>{
 const before=load('forkLandscapeGeometry.ts',true),after=load('forkLandscapeGeometry.ts');
 for(const future of [false,true]){
  const a=before.createForkPath(future),b=after.createForkPath(future);
  try{for(const attr of ['position','normal','uv'])assert.deepEqual(Array.from(b.attributes[attr].array),Array.from(a.attributes[attr].array),attr);
   assert.deepEqual(Array.from(b.index.array),Array.from(a.index.array));assert.equal(b.index.count,1152);assert.equal(b.attributes.position.count,245);
   const earth=new THREE.Color('#26241b'),energy=g=>Array.from(g.attributes.color.array).reduce((s,x,i)=>s+Math.abs(x-earth.toArray()[i%3]),0);
   assert.ok(energy(b)<energy(a)*.45);assert.ok(energy(b)>0);
   for(let i=0;i<49;i++)for(const side of [0,4])for(let axis=0;axis<3;axis++)assert.ok(Math.abs(b.attributes.color.array[(i*5+side)*3+axis]-earth.toArray()[axis])<1e-7);
  }finally{a.dispose();b.dispose();}
 }
});
test('Mind release opens the actual far boundary using fewer existing instances',()=>{
 const render=(before,released)=>load('ClimbLandscape.tsx',before).ClimbLandscape({kind:'mind',released});
 const stones=(before,released)=>named(render(before,released),'climb-authored-boundary').props.forms;
 assert.deepEqual(json(stones(false,false)),json(stones(true,false)));assert.equal(stones(false,false).length,24);
 const released=stones(false,true),old=stones(true,true);assert.equal(released.length,14);
 for(let i=0;i<released.length;i++){assert.ok(Math.abs(released[i].position[0])>Math.abs(old[i].position[0]));assert.ok(released[i].scale[1]<old[i].scale[1]);assert.equal(released[i].position[2],old[i].position[2]);}
});
test('Heart makes one curved shelter with the same stone batch and fewer perimeter plants',()=>{
 const render=before=>load('ClimbLandscape.tsx',before).ClimbLandscape({kind:'heart',released:false}),a=render(true),b=render(false);
 const stones=named(b,'climb-authored-boundary').props.forms;assert.equal(stones.length,17);assert.equal(stones.length,named(a,'climb-authored-boundary').props.forms.length);
 assert.ok(stones.every(s=>s.position[2]>5.3));assert.ok(Math.max(...stones.map(s=>s.scale[1]))>1.7);
 const plants=tree=>nodes(tree).find(n=>n.type==='BotanicalBatch').props.placements;assert.equal(plants(b).length,11);assert.equal(plants(a).length,17);
 assert.ok(plants(b).every(p=>p.position[2]>6));
});
test('Womb preserves exact walk-height earth geometry and releases the empty protected centre',()=>{
 const aClean=[],bClean=[],a=load('ClimbLandscape.tsx',true,{cleanups:aClean}).ClimbLandscape({kind:'womb',released:false}),b=load('ClimbLandscape.tsx',false,{cleanups:bClean}).ClimbLandscape({kind:'womb',released:false});
 const ga=named(a,'creation-soft-protected-earth').props.geometry,gb=named(b,'creation-soft-protected-earth').props.geometry;
 for(const attr of ['position','normal','uv'])assert.deepEqual(Array.from(gb.attributes[attr].array),Array.from(ga.attributes[attr].array));assert.deepEqual(Array.from(gb.index.array),Array.from(ga.index.array));
 const plants=nodes(b).find(n=>n.type==='BotanicalBatch').props.placements;assert.equal(plants.length,3);assert.ok(plants.every(p=>Math.hypot(p.position[0],p.position[2]-3)>9));
 let disposed=0;gb.addEventListener('dispose',()=>disposed++);bClean.forEach(fn=>fn());aClean.forEach(fn=>fn());assert.equal(disposed,1);
});
const actualArt=moduleSource(readFileSync(join(root,'src/components/three/environmentArt/authoredGeometry.ts'),'utf8'),{dependencies:{'three/examples/jsm/utils/BufferGeometryUtils.js':require('three/examples/jsm/utils/BufferGeometryUtils.js')}});
const actualChapterArt=moduleSource(readFileSync(join(root,'src/components/three/chapters/chapterArtGeometry.ts'),'utf8'),{dependencies:{'../environmentArt/authoredGeometry':actualArt,'../environmentArt/authoredGeometry.ts':actualArt}});
test('Fork keeps tier populations and actual joined wood while breaking planting into habitat pockets',()=>{
 for(const reducedEffects of [false,true]){
  const clean=[];
  const render=before=>load('ForkLandscape.tsx',before,{cleanups:clean,dependencies:{'./forkLandscapeGeometry':load('forkLandscapeGeometry.ts',before),'../environmentArt/authoredGeometry':actualArt}}).ForkLandscape({overgrown:true,established:true,reducedEffects});
  const a=render(true),b=render(false);
  for(const name of ['familiar-path-enclosing-trunks','familiar-path-low-canopy'])assert.deepEqual(json(named(b,name).props.forms),json(named(a,name).props.forms),name);
  const ga=named(a,'familiar-path-overhead-boughs').props.geometry,gb=named(b,'familiar-path-overhead-boughs').props.geometry;
  assert.deepEqual(Array.from(gb.attributes.position.array),Array.from(ga.attributes.position.array));assert.deepEqual(Array.from(gb.index.array),Array.from(ga.index.array));
  assert.equal(named(b,'familiar-path-enclosing-trunks').props.forms.length,reducedEffects?9:16);
  for(const name of ['fork-past-path-overgrowth','fork-future-path-established']){
   const oldPlants=nodes(named(a,name)).find(n=>n.type==='BotanicalBatch').props.placements,plants=nodes(named(b,name)).find(n=>n.type==='BotanicalBatch').props.placements;
   assert.equal(plants.length,oldPlants.length);assert.equal(plants.length,name.includes('overgrowth')?16:reducedEffects?12:30);
  }
  let disposed=0;gb.addEventListener('dispose',()=>disposed++);clean.forEach(fn=>fn());assert.equal(disposed,1);
 }
});
test('lower edge outcrops keep the exact merged topology and release their native allocation',()=>{
 function geometry(before){const cleanups=[],component=load('ThreeClimbsChapter.tsx',before,{cleanups,dependencies:{'../environmentArt/authoredGeometry':actualArt,'./chapterArtGeometry':actualChapterArt}}).ThreeClimbsChapter(chapterProps('climb.mind'));
  const owner=nodes(component).find(n=>typeof n.type==='function'&&n.type.name==='GroundedOutcrops');return {mesh:owner.type(),cleanups};}
 const a=geometry(true),b=geometry(false),ga=a.mesh.props.geometry,gb=b.mesh.props.geometry;
 try{assert.equal(gb.attributes.position.count,ga.attributes.position.count);assert.deepEqual(Array.from(gb.index.array),Array.from(ga.index.array));assert.deepEqual(Array.from(gb.attributes.uv.array),Array.from(ga.attributes.uv.array));
  ga.computeBoundingBox();gb.computeBoundingBox();assert.ok(gb.boundingBox.max.y<ga.boundingBox.max.y);assert.ok(gb.boundingBox.max.x>ga.boundingBox.max.x);
  let disposed=0;gb.addEventListener('dispose',()=>disposed++);b.cleanups.forEach(fn=>fn());assert.equal(disposed,1);
 }finally{a.cleanups.forEach(fn=>fn());}
});
