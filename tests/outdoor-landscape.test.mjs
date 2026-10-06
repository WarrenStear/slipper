import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import {
  landscapeForScene, LANDSCAPE_SCENES, landscapeBudget, createLandscapeTerrain, createLandscapeRiver,
  createLandscapeObjects, heightOnLandscape, landscapeRiverCentre, landscapeRiverWidth, landscapeObjectRadius,
  LANDSCAPE_WATER_Y, LANDSCAPE_CAPACITY, LANDSCAPE_GRID,
} from '../src/components/three/environment/landscapeGeography.ts';
const source = p => readFileSync(new URL(`../src/components/three/${p}`, import.meta.url), 'utf8');
const specs = [...new Set(Object.keys(LANDSCAPE_SCENES).map(landscapeForScene))];
const fixtures = specs.map(spec => { const terrain = createLandscapeTerrain(spec); return { spec, terrain, objects: createLandscapeObjects(spec, terrain), river: createLandscapeRiver(spec) }; });
const close = (a,b,t=1e-6) => assert.ok(Math.abs(a-b)<=t,`${a} != ${b}`);
function face(data,i) {
  const [a,b,c]=data.indices.slice(i,i+3).map(j=>data.positions.slice(j*3,j*3+3));
  const u=b.map((v,j)=>v-a[j]),v=c.map((n,j)=>n-a[j]);
  return [u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0]];
}
test('21 explicit outdoor scenes share six region profiles; indoor and hero reflection scenes are excluded',()=>{
  assert.equal(Object.keys(LANDSCAPE_SCENES).length,21);assert.equal(specs.length,6);
  for(const id of ['broken-floor.confession','blue-moon.sanctuary','blue-moon.intimacy','blue-moon.caged-bird','sunset.warning-grove','sunset.true-mirror','sunset.stillness','thorned.locked-garden','thorned.old-memory-bedroom','thorned.self-owned-world','epilogue.constellation','enchanted.unknown','__proto__','constructor',''])assert.equal(landscapeForScene(id),null);
  assert.equal(landscapeForScene('enchanted.rabbit-hole'),landscapeForScene('enchanted.friendship-meadow'));
  assert.ok(specs.every(Object.isFrozen));
});
test('terrain buffers are deterministic, finite, aligned and bounded',()=>{
  for(const {spec,terrain:d}of fixtures){
    assert.deepEqual(d,createLandscapeTerrain(spec));
    const count=d.positions.length/3;
    assert.equal(count,2050);assert.equal(d.indices.length/3,3840);
    assert.equal(d.normals.length,count*3);assert.equal(d.uvs.length,count*2);assert.equal(d.colors.length,count*3);
    for(const values of Object.values(d))assert.ok(values.every(Number.isFinite));
    assert.ok(d.indices.every(i=>Number.isInteger(i)&&i>=0&&i<count));
    assert.ok(d.colors.every(c=>c>=0&&c<=1));
  }
});
test('every terrain triangle faces upwards and is non-degenerate',()=>{
  for(const {terrain:d}of fixtures)for(let i=0;i<d.indices.length;i+=3){const normal=face(d,i);assert.ok(normal[1]>1e-7);}
});
test('terrain normals are unit length on hill slopes and banks',()=>{
  for(const {terrain:d}of fixtures)for(let i=0;i<d.normals.length;i+=3){close(Math.hypot(...d.normals.slice(i,i+3)),1);assert.ok(d.normals[i+1]>0);}
});
test('terrain stays outside the central clearing and within its local rectangle',()=>{
  for(const {spec,terrain:d}of fixtures)for(let i=0;i<d.positions.length;i+=3){
    const [x,y,z]=d.positions.slice(i,i+3);assert.ok(Math.abs(x)>=spec.inner-1e-7&&Math.abs(x)<=spec.outer+1e-7);
    assert.ok(Math.abs(z)<=spec.length+1e-7);assert.ok(y>=-.24-1e-7&&y<10);
  }
});
test('hill shoulders have genuine height and their lateral edges meet the existing base',()=>{
  for(const {spec,terrain}of fixtures){
    assert.ok(Math.max(...terrain.positions.filter((_,i)=>i%3===1))>spec.height*.8);
    for(const side of [-1,1])for(const r of [spec.inner,spec.outer])for(const z of [-spec.length,0,spec.length])close(heightOnLandscape(terrain,side*r,z),-.24);
  }
});
test('river families generate finite XY ribbons with normalized UVs and a consistent face direction',()=>{
  for(const {spec,river}of fixtures){
    if(!spec.riverSide){assert.equal(river,null);continue;}
    assert.ok(river);assert.equal(river.indices.length/3,80);
    for(const values of Object.values(river))assert.ok(values.every(Number.isFinite));
    assert.ok(river.uvs.every(v=>v>=0&&v<=1));
    for(let i=0;i<river.positions.length;i+=3){close(river.positions[i+2],0);assert.ok(Math.abs(river.positions[i])>spec.inner);}
    for(let i=0;i<river.indices.length;i+=3)assert.ok(face(river,i)[2]>0);
  }
});
test('water edges match the cut river channel and the full width stays below the surface',()=>{
  for(const {spec,terrain,river}of fixtures){
    if(!river)continue;
    for(let row=0;row<=LANDSCAPE_GRID.along;row++){
      const z=-river.positions[row*6+1], centre=spec.riverSide*landscapeRiverCentre(spec,z), w=landscapeRiverWidth(spec,z);
      close(river.positions[row*6],centre-w);close(river.positions[row*6+3],centre+w);
      for(const fraction of [-1,-.75,-.5,0,.5,.75,1])assert.ok(heightOnLandscape(terrain,centre+w*fraction,z)<LANDSCAPE_WATER_Y);
      for(const x of [centre-w,centre+w])close(heightOnLandscape(terrain,x,z),.92);
    }
  }
});
test('river channels bend and vary their width instead of using a rectangular plane',()=>{
  for(const {spec,river}of fixtures){if(!river)continue;
    const centres=[],widths=[];for(let i=0;i<river.positions.length;i+=6){centres.push((river.positions[i]+river.positions[i+3])/2);widths.push(river.positions[i+3]-river.positions[i]);}
    assert.ok(Math.max(...centres)-Math.min(...centres)>2);assert.ok(Math.max(...widths)-Math.min(...widths)>.5);
  }
});
test('height queries interpolate the actual rendered triangles and reject positions outside the patches',()=>{
  for(const {terrain:d}of fixtures){
    for(let i=0;i<d.indices.length;i+=231){const ids=d.indices.slice(i,i+3);if(ids.length<3)continue;
      const pts=ids.map(j=>d.positions.slice(j*3,j*3+3)),avg=[0,1,2].map(k=>pts.reduce((s,p)=>s+p[k],0)/3);
      close(heightOnLandscape(d,avg[0],avg[2]),avg[1]);
    }
    for(const [x,z]of [[0,0],[1000,0],[NaN,0],[0,Infinity]])assert.equal(heightOnLandscape(d,x,z),null);
  }
});
test('all object batches reach their hard caps with finite positive transforms',()=>{
  for(const {objects}of fixtures)for(const [kind,items]of Object.entries(objects)){
    assert.equal(items.length,LANDSCAPE_CAPACITY[kind]);
    for(const item of items){assert.ok([...item.position,...item.rotation,...item.scale].every(Number.isFinite));assert.ok(item.scale.every(v=>v>0));}
  }
});
test('object transforms are deterministic and quality prefixes are stable',()=>{
  for(const {spec,terrain,objects}of fixtures){
    assert.deepEqual(objects,createLandscapeObjects(spec,terrain));
    for(const quality of ['low','medium','high','cinematic']){const budget=landscapeBudget(quality);
      for(const [kind,items]of Object.entries(objects)){assert.ok(budget[kind]<=items.length);assert.deepEqual(items.slice(0,budget[kind]),objects[kind].slice(0,budget[kind]));}
    }
  }
});
test('tree and prop bases sit on the rendered hill triangles with slight grounding overlap',()=>{
  for(const {terrain,objects}of fixtures)for(const items of Object.values(objects))for(const item of items){
    close(item.position[1]+.035,heightOnLandscape(terrain,item.position[0],item.position[2]));
  }
});
test('full object envelopes avoid the main route, patch edges and river channel',()=>{
  for(const {spec,objects}of fixtures)for(const [kind,items]of Object.entries(objects))for(const item of items){
    const [x,y,z]=item.position,r=landscapeObjectRadius(kind,item.scale[0]);
    assert.ok(Math.abs(x)-r>=spec.inner);assert.ok(Math.abs(x)+r<=spec.outer);assert.ok(Math.abs(z)+r<spec.length);
    if(Math.sign(x)===spec.riverSide)assert.ok(Math.abs(Math.abs(x)-landscapeRiverCentre(spec,z))>landscapeRiverWidth(spec,z)+r+.44);
  }
});
test('quality budgets are bounded, monotonic, and reduced effects chooses the low layout',()=>{
  let previous={trees:0,stones:0,timber:0,reeds:0};
  for(const quality of ['low','medium','high','cinematic']){
    const budget=landscapeBudget(quality);for(const key of Object.keys(budget)){assert.ok(budget[key]>=previous[key]&&budget[key]<=LANDSCAPE_CAPACITY[key]);}
    assert.deepEqual(landscapeBudget(quality,true),landscapeBudget('low'));previous=budget;
  }
  assert.deepEqual(landscapeBudget('unknown'),landscapeBudget('low'));
});
test('landscape mounts only in the active chapter transform and preserves story and adjacent wiring',()=>{
  const code=source('journey/JourneySceneDirector.tsx');
  assert.equal((code.match(/<OutdoorLandscape /g)||[]).length,1);
  assert.match(code,/const activeManifest = getSceneManifest\(activeSceneId\)/);
  assert.match(code,/const activeScene = activeManifest\.layout/);
  assert.match(code,/const ActiveChapter = CHAPTER_COMPONENTS\[activeManifest\.chapterId\]/);
  assert.match(code,/const manifest = getSceneManifest\(entry\.sceneId\)/);
  assert.match(code,/const scene = manifest\.layout/);
  assert.match(code,/const position = mutablePoint\(scene\.anchor\.position\)/);
  const active=code.slice(code.indexOf('if (entry.mode === "active")'),code.indexOf('if (!renderAdjacent)'));
  assert.match(active,/<OutdoorLandscape sceneId=\{manifest\.sceneId\}/);assert.match(active,/collidable=\{interactionsEnabled\}/);
  assert.match(active,/position=\{position\}/);assert.match(active,/rotation=\{\[0, scene\.anchor\.headingRadians, 0\]\}/);
  assert.match(active,/userData=\{\{ environmentId: manifest\.environmentId \}\}/);
  for(const component of ['StoryEventDirector','ActiveStoryActors','EnvironmentalChoreography','ActiveChapter'])assert.match(active,new RegExp(`<${component}`));
});
test('terrain collision uses the exact visible arrays and stays independent of quality',()=>{
  const code=source('environment/OutdoorLandscape.tsx');
  assert.match(code,/colliderArgs: \[vertices, indices\]/);assert.match(code,/args=\{land\.colliderArgs\}/);
  assert.match(code,/new THREE\.BufferAttribute\(vertices, 3\)/);assert.match(code,/new THREE\.BufferAttribute\(indices, 1\)/);
  assert.match(code,/createLandscapeTerrain\(spec\), \[spec\]/);
  assert.match(code,/<RigidBody type="fixed" colliders=\{false\}/);
});
test('new water reuses the existing material and scene clock without new reflection or lighting passes',()=>{
  const code=source('environment/OutdoorLandscape.tsx'),water=source('environment/SanctuaryWater.tsx');
  assert.match(code,/<NarrativeWater geometry=\{river\.geometry\}/);assert.match(water,/geometry\?: THREE\.BufferGeometry/);
  assert.match(water,/geometry \? null : circle \? <circleGeometry/);assert.match(water,/presentation\.time\.water/);
  assert.match(code,/reducedMotion=\{reducedMotion\} reducedEffects=\{reducedEffects\}/);
  assert.doesNotMatch(code,/useFrame|new ShaderMaterial|pointLight|spotLight|directionalLight|new WebGLRenderTarget|scene\.fog|dispatchStoryEvent|useJourneyStore|Math\.random/);
});
test('instance buffers, wind bounds and geometry disposal are explicit',()=>{
  const code=source('environment/OutdoorLandscape.tsx');
  for(const pattern of [/args=\{\[undefined, undefined, capacity\]\}/,/instanceMatrix\.needsUpdate/,/computeBoundingBox/,/computeBoundingSphere/,/expandByScalar\(\.4\)/,/mesh\.count = Math.min\(available, count\)/])assert.match(code,pattern);
  for(const name of ['bark','leaves','stone','timber','reeds'])assert.match(code,new RegExp(`${name}\\.dispose\\(\\)`));
  assert.match(code,/land\.geometry\.dispose/);assert.match(code,/river\?\.geometry\.dispose/);
});
