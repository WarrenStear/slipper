import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { createThornThicketGeometry } from "../src/world/forest/thornThicketGeometry.ts";

test("thorned forest renders deterministic sculpted branches within original worker footprint",()=>{
 for(const tier of ["base","detail"]){
  const g=createThornThicketGeometry(tier),repeat=createThornThicketGeometry(tier);
  const p=g.getAttribute("position"),n=g.getAttribute("normal");
  assert.deepEqual(p.array,repeat.getAttribute("position").array);
  assert.ok(g.index.count/3<(tier==="base"?850:1600));
  assert.ok(g.boundingSphere.radius<.92);
  for(const a of Object.values(g.attributes))assert.ok([...a.array].every(Number.isFinite));
  for(let i=0;i<n.count;i++)assert.ok(Math.hypot(n.getX(i),n.getY(i),n.getZ(i))>.8);
  g.dispose();repeat.dispose();
 }
});
test("continuous forest keeps one decorative thorn instance batch and the old worker/collider geometry",()=>{
 const s=readFileSync(new URL("../src/world/forest/ContinuousForestBed.tsx",import.meta.url),"utf8");
 const worker=readFileSync(new URL("../src/workers/forestWorker.ts",import.meta.url),"utf8");
 assert.match(s,/ref=\{ruinRef\} geometry=\{thicketGeometry\}/);
 assert.match(s,/continuous-thorned-understory/);
 assert.match(s,/thicketGeometry\.dispose\(\)/);
 assert.match(worker,/writeMatrix\(ruinMatrices/);
 assert.match(worker,/pushCollider\(/);
});
