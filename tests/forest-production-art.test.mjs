import assert from 'node:assert/strict';
import test from 'node:test';
import { claimForestBuild } from '../src/lib/forestBuildSchedule.ts';
import { createForestTrunkGeometry, createOrganicCrownGeometry } from '../src/components/three/environment/forestGeometry.ts';
import { createPhysicalPathGeometry } from '../src/components/three/environment/livingPathGeometry.ts';
import { generateTerrain } from '../src/workers/forestWorker.ts';
import { createTerrainSurfaceSampler, sampleTerrainElevation } from '../src/lib/terrainModel.ts';

const curve={source:[-24,-10],controlA:[-8,18],controlB:[12,-16],target:[28,12],curveSeed:.371,curveLength:72,sourceChapter:'The First Wood',targetChapter:'The Mirror Clearing',sourceY:0,targetY:0,crownRamp:false,minX:-30,maxX:35,minZ:-20,maxZ:20};
const config={terrainSize:100,terrainSegments:16,terrainBaseY:-1.255,clearingSafeRadius:7.2,corridorBaseWidth:5.2,crownedRampWidth:12,explorationDepth:.3,memoryPressure:.2,groundColor:'#344432',clearings:[{id:'wood',chapter:'The First Wood',position:[0,0,0]}],paths:[curve]};

test('shared rooted forest geometry is finite, deterministic, and within its instance budget',()=>{
 for(const build of [createForestTrunkGeometry,()=>createOrganicCrownGeometry(0),()=>createOrganicCrownGeometry(1),()=>createOrganicCrownGeometry(2)]){
  const a=build(),b=build(),position=a.getAttribute('position');
  assert.deepEqual(position.array,b.getAttribute('position').array);
  for(const value of position.array)assert.ok(Number.isFinite(value));
  assert.ok((a.index?.count??position.count)/3<=600);
  assert.ok(a.boundingSphere.radius<6);
  a.dispose();b.dispose();
 }
});

test('terrain material masks never alter canonical terrain elevations',()=>{
 const terrain=generateTerrain({type:'GENERATE_TERRAIN',requestId:1,config});
 assert.equal(terrain.habitat.length,17*17*4);
 for(let i=0;i<terrain.positions.length/3;i++){
  const [x,y,z]=terrain.positions.slice(i*3,i*3+3);
  assert.equal(y,Math.fround(config.terrainBaseY+sampleTerrainElevation(x,z,config)));
 }
 for(const mask of terrain.habitat)assert.ok(mask>=0&&mask<=1);
 const recolored=generateTerrain({type:'GENERATE_TERRAIN',requestId:2,config:{...config,groundColor:'#8a632f'}});
 assert.deepEqual(terrain.positions,recolored.positions);
 assert.deepEqual(terrain.habitat,recolored.habitat);
});

test('worn path hugs the exact triangulated collision surface through terrain morphs',()=>{
 for(const memoryPressure of [0,.8]){
  const morph={...config,memoryPressure},sample=createTerrainSurfaceSampler(morph,config.terrainSize,config.terrainSegments);
  const ground=(x,z)=>config.terrainBaseY+sample(x,z),geometry=createPhysicalPathGeometry(curve,morph,ground),position=geometry.getAttribute('position');
  assert.equal(position.count,98);assert.equal(geometry.index.count/3,96);
  for(let i=0;i<position.count;i++)assert.ok(Math.abs(position.getY(i)-ground(position.getX(i),position.getZ(i))-.027)<1e-5);
  for(const value of geometry.getAttribute('normal').array)assert.ok(Number.isFinite(value));
  geometry.dispose();
 }
});


test('a frame before worker creation cannot consume the initial forest request',()=>{
 const last={cellX:NaN,cellZ:NaN,depth:NaN,pressure:NaN,entryCount:NaN,quality:'',forestDensity:NaN,pathClarity:NaN};
 const frame=(ready,x=0)=>claimForestBuild(ready,last,x,0,20,10,1,'low',70,80);
 assert.equal(frame(false),false);
 assert.ok(Number.isNaN(last.cellX),'An unavailable worker must leave the cell unclaimed');
 assert.equal(frame(true),true,'The unchanged first cell builds when the worker becomes available');
 assert.equal(frame(true),false,'A ready unchanged forest does not repeatedly rebuild');
 assert.equal(frame(true,1),true,'Moving to another cell schedules a new build');
 const snapshot={...last};
 assert.equal(frame(false,2),false);assert.deepEqual(last,snapshot,'Unavailable workers also preserve pending later cells');
 assert.equal(frame(true,2),true);
});
