import assert from "node:assert/strict";
import test from "node:test";
import { nearestPathDistanceSq } from "../src/workers/forestWorker.ts";
import { terrainDistanceToPathSq } from "../src/lib/terrainModel.ts";

test("forest worker skips irrelevant curves without changing near-corridor distances",()=>{
 const path={source:[-32,0],controlA:[-12,0],controlB:[12,0],target:[32,0],curveSeed:.37,curveLength:64,sourceChapter:"The Blue Moon Archive",targetChapter:"The Blue Moon Archive",sourceY:0,targetY:0,crownRamp:false,minX:-40,maxX:40,minZ:-8,maxZ:8};
 const distant={...path,source:[990,995],controlA:[1005,1000],controlB:[1020,1000],target:[1040,1005],minX:960,maxX:1070,minZ:950,maxZ:1050};
 const config={terrainSize:120,terrainSegments:32,terrainBaseY:-1.255,clearingSafeRadius:7.2,corridorBaseWidth:5.2,crownedRampWidth:12,explorationDepth:.5,memoryPressure:.4,clearings:[],paths:[path,distant]};
 const influence=5.2*2.72;
 for(let x of [-55,-25,-8,0,15,32,60,110])for(let z of [-65,-25,-10,-4,0,4,10,25,60]){
  const original=nearestPathDistanceSq(x,z,config.paths,config);
  const bounded=nearestPathDistanceSq(x,z,config.paths,config,0,influence);
  assert.equal(original<5.2**2,bounded<5.2**2);
  if(original<=influence**2)assert.ok(Math.abs(original-bounded)<1e-7);
  else assert.ok(bounded>=influence**2);
 }
 assert.equal(nearestPathDistanceSq(10000,10000,config.paths,config,0,influence),Infinity);
});
