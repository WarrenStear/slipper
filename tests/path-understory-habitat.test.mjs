import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import test from "node:test";
import ts from "typescript";
import * as THREE from "three";
import { normalizeGeneratedWorldState } from "../src/data/worldStateNormalization.ts";
import { getJourneySceneForEntry } from "../src/data/journeyNarrative.ts";
import { buildMazePathSegments, curvedPathPointAt, curvedPathTangentAt } from "../src/world/terrain/worldPaths.ts";
import { TERRAIN_BASE_Y } from "../src/world/terrain/worldConstants.ts";
import { terrainElevationAtPoint } from "../src/world/terrain/terrainSampler.ts";
import { ENVIRONMENT_THEMES } from "../src/components/three/environment/environmentThemes.ts";
import * as habitat from "../src/world/guidance/pathUnderstoryHabitat.ts";
import * as routes from "../src/world/guidance/routeGeometry.ts";

const archive = JSON.parse(readFileSync(new URL("../src/data/worldState.json", import.meta.url), "utf8"));
const entries = normalizeGeneratedWorldState(archive).entries, paths = buildMazePathSegments(entries);
const entryScene = entry => getJourneySceneForEntry(entry.id)?.id;
const morphology = [{ explorationDepth: 0, memoryPressure: 0 }, { explorationDepth: .75, memoryPressure: .6 }];
const cross = (a, b) => [a[1]*b[2]-a[2]*b[1], a[2]*b[0]-a[0]*b[2], a[0]*b[1]-a[1]*b[0]];
const sub = (a, b) => a.map((v, i) => v-b[i]);
const componentSource = readFileSync(new URL("../src/world/guidance/MoonlitPathUnderstory.tsx", import.meta.url), "utf8");
let cleanups = [], elementEffects = [];
const host = (type, props) => ({ type, props });
const imports = {
  react: { useEffect: callback => { const cleanup = callback(); if(cleanup)cleanups.push(cleanup); }, useLayoutEffect: callback => elementEffects.push(callback),
    useMemo: callback => callback(), useRef: value => ({ current: value }) },
  "react/jsx-runtime": { jsx: host, jsxs: host }, three: THREE,
  "./routeGeometry.ts": routes, "./pathUnderstoryHabitat.ts": habitat,
};
const component = {};
runInNewContext(ts.transpileModule(componentSource, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText,
  { exports: component, require: id => { assert.ok(id in imports, id); return imports[id]; } });

test("floor geometry has seven distinct compact grounded real forms under the single cluster budget", () => {
  const buffers = habitat.createPathUnderstoryBuffers(), geometry = component.createPathUnderstoryGeometry();
  assert.deepEqual(buffers, habitat.createPathUnderstoryBuffers());
  assert.equal(geometry.getAttribute("position").count, buffers.forms.length);
  assert.equal(geometry.getAttribute("color").count, buffers.forms.length);
  assert.equal(geometry.getAttribute("understoryForm").count, buffers.forms.length);
  assert.ok(buffers.positions.length/9 <= 230);
  assert.equal(new Set(buffers.forms).size, 7);
  for (const data of Object.values(buffers)) assert.ok(data.every(Number.isFinite));
  for (let i = 0; i < buffers.positions.length; i += 3) {
    const [x,y,z] = buffers.positions.slice(i,i+3);
    assert.ok(Math.hypot(x,z) < .9); assert.ok(y >= 0 && y < .5);
  }
  for (let i = 0; i < buffers.positions.length; i += 9) {
    const [a,b,c] = [0,3,6].map(offset=>buffers.positions.slice(i+offset,i+offset+3));
    assert.ok(Math.hypot(...cross(sub(b,a),sub(c,a)))>1e-8, "Authored form triangles must not be degenerate");
  }
  const p=geometry.getAttribute("position"),n=geometry.getAttribute("normal"),f=geometry.getAttribute("understoryForm");
  for(let i=0;i<n.count;i++)assert.ok(Math.abs(Math.hypot(n.getX(i),n.getY(i),n.getZ(i))-1)<1e-5);
  for(const form of [3,4,6])for(let i=0;i<f.count;i++)if(f.getX(i)===form)assert.ok(p.getY(i)<.08,"Litter, deadwood and charred forms stay flat");
  geometry.dispose();
});

test("Fire and River keep separate physical floor signatures despite their shared technical biome", () => {
  const fire=habitat.pathHabitatForScene("fire.boundary"),river=habitat.pathHabitatForScene("river.wash");
  assert.equal(fire.weights[6],1); assert.equal(fire.weights[0],0); assert.equal(fire.weights[2],0); assert.equal(fire.weights[5],0);
  assert.equal(river.weights[6],0); assert.equal(river.weights[5],1); assert.ok(river.weights[1]>.5);
  assert.deepEqual(river.palette.earth,new THREE.Color(ENVIRONMENT_THEMES.riverbank.soil).toArray());
  const home=habitat.pathHabitatForScene("crowned.home");assert.ok(home.weights[2]>.5);assert.equal(home.weights[5],0);
  assert.deepEqual(home.palette.flower,new THREE.Color(ENVIRONMENT_THEMES.home.flower).toArray());
});

test("route habitats blend continuously with exact endpoints and bounded linear palettes", () => {
  const fire=habitat.pathHabitatForScene("fire.boundary"),river=habitat.pathHabitatForScene("river.wash");
  assert.deepEqual(habitat.blendPathHabitats(fire,river,0),fire);
  assert.deepEqual(habitat.blendPathHabitats(fire,river,1),river);
  assert.deepEqual(habitat.blendPathHabitats(fire,river,-5),fire);
  assert.deepEqual(habitat.blendPathHabitats(fire,river,8),river);
  const woodland=habitat.pathHabitatForScene("enchanted.rabbit-hole"),home=habitat.pathHabitatForScene("crowned.home");
  assert.deepEqual(habitat.blendPathHabitats(woodland,home,0),woodland);
  assert.deepEqual(habitat.blendPathHabitats(woodland,home,1),home);
  let previous=fire;
  for(let i=1;i<=100;i++){
    const next=habitat.blendPathHabitats(fire,river,i/100);
    assert.ok(next.weights[6]<=previous.weights[6]&&next.weights[5]>=previous.weights[5]);
    for(let j=0;j<7;j++)assert.ok(Math.abs(next.weights[j]-previous.weights[j])<.016);
    for(const color of Object.values(next.palette))assert.ok(color.every(v=>Number.isFinite(v)&&v>=0&&v<=1));
    previous=next;
  }
});

test("seeded habitat patches select varied compatible forms instead of seven repeated fields", () => {
  const woodland=habitat.pathHabitatForScene("enchanted.rabbit-hole"),seen=new Set(),signatures=new Set();
  for(let index=0;index<28;index++){
    const patch=habitat.patchPathHabitat(woodland,197,index,(index+.7)/28.4);
    assert.deepEqual(patch,habitat.patchPathHabitat(woodland,197,index,(index+.7)/28.4));
    assert.ok(patch.weights.filter(weight=>weight>0).length<=3);
    for(let form=0;form<7;form++)if(patch.weights[form]>0){seen.add(form);assert.ok(patch.weights[form]<=woodland.weights[form]);}
    assert.equal(patch.weights[5],0);assert.equal(patch.weights[6],0);signatures.add(patch.weights.map(v=>v>0?1:0).join(""));
  }
  assert.ok(seen.size>=3);assert.ok(signatures.size>=4);
});

test("all actual route endpoints and existing tier counts feed canonical curved placement and ground height", () => {
  for(const morph of morphology)for(const path of paths)for(const [quality,count]of [["low",8],["medium",16],["high",24],["cinematic",28]]){
    const sample=(x,z)=>TERRAIN_BASE_Y+terrainElevationAtPoint(x,z,entries,paths,morph);
    const instances=habitat.createPathUnderstoryInstances(path,quality,morph,sample);
    assert.equal(instances.length,count);assert.deepEqual(instances,habitat.createPathUnderstoryInstances(path,quality,morph,sample));
    assert.ok(instances.at(-1).t-instances[0].t>.7);
    assert.equal(new Set(instances.map((_,i)=>i%2)).size,2);
    for(const instance of instances){
      const [x,y,z]=instance.position,point=curvedPathPointAt(path,instance.t,morph),tangent=curvedPathTangentAt(path,instance.t,morph);
      assert.ok(Math.abs(Math.hypot(x-point.x,z-point.y)-instance.offset)<1e-7);
      assert.ok(instance.offset>=2.25&&instance.offset<4.1);assert.equal(y,sample(x,z)+.018);
      assert.ok([...instance.position,...instance.rotation,...instance.scale,...instance.habitat.weights].every(Number.isFinite));
      assert.ok(instance.habitat.weights.some(weight=>weight>0),"Every retained cluster contains a real selected form");
      // The full small plant envelope stays outside the existing ~1m visual ribbon.
      const radius=.9*Math.max(...instance.scale);assert.ok(instance.offset-radius>1);
      assert.ok(Math.abs((x-point.x)*tangent.x+(z-point.y)*tangent.y)<1e-7);
    }
  }
});

test("route scene IDs drive ecology rather than the active entry's global palette",()=>{
  const path=paths.find(p=>entryScene(p.sourceEntry)==="fire.boundary"&&entryScene(p.targetEntry)?.startsWith("river."));assert.ok(path);
  const source=habitat.pathHabitatForScene(entryScene(path.sourceEntry)),target=habitat.pathHabitatForScene(entryScene(path.targetEntry));
  const instances=habitat.createPathUnderstoryInstances(path,"cinematic",{},()=>0);
  for(const instance of instances)assert.deepEqual(instance.habitat.palette,habitat.blendPathHabitats(source,target,instance.t).palette);
  assert.ok(instances.slice(0,8).some(i=>i.habitat.weights[6]>0));assert.ok(instances.slice(-8).some(i=>i.habitat.weights[5]>0));
});

test("instance orientation follows the actual terrain plane for every route heading",()=>{
  const sample=(x,z)=>.2*x-.12*z+.8,normal=new THREE.Vector3(-.2,1,.12).normalize();
  for(const path of paths.slice(0,8))for(const instance of habitat.createPathUnderstoryInstances(path,"low",{},sample)){
    const up=new THREE.Vector3(0,1,0).applyEuler(new THREE.Euler(...instance.rotation));assert.ok(up.distanceTo(normal)<1e-8);
    assert.equal(instance.position[1],sample(instance.position[0],instance.position[2])+.018);
  }
});

test("quality cycles retain the same six instanced attribute buffers and clear unused tails",()=>{
  const geometry=component.createPathUnderstoryGeometry(),path=paths[0];
  const full=habitat.createPathUnderstoryInstances(path,"cinematic",{},()=>0),low=habitat.createPathUnderstoryInstances(path,"low",{},()=>0);
  component.uploadPathUnderstoryHabitat(geometry,full);
  const names=["understoryWeightsA","understoryWeightsB","understoryLeaf","understoryFlower","understoryEarth","understoryWood"];
  const attributes=names.map(name=>geometry.getAttribute(name));
  for(const list of [low,full,low,full,[]]){
    component.uploadPathUnderstoryHabitat(geometry,list);
    for(const [i,name]of names.entries()){
      const attribute=geometry.getAttribute(name);assert.equal(attribute,attributes[i]);assert.equal(attribute.count,28);
      assert.ok(Array.from(attribute.array).slice(list.length*attribute.itemSize).every(v=>v===0));
    }
  }
  geometry.dispose();
});

test("the actual single material shader adjusts positions isotropically at Three's standard chunks",()=>{
  const shader={vertexShader:THREE.ShaderLib.standard.vertexShader,fragmentShader:THREE.ShaderLib.standard.fragmentShader};
  const originalFragment=shader.fragmentShader;habitat.applyPathUnderstoryShader(shader);
  assert.equal(shader.fragmentShader,originalFragment,"Standard lighting/fog/shadow fragment code remains intact");
  assert.equal((shader.vertexShader.match(/transformed \*= understoryWeight\(\)/g)||[]).length,1);
  assert.ok(shader.vertexShader.indexOf("#include <begin_vertex>")<shader.vertexShader.indexOf("transformed *= understoryWeight()"));
  assert.ok(shader.vertexShader.indexOf("#include <color_vertex>")<shader.vertexShader.indexOf("vColor *= understoryTint()"));
  const expand=source=>source.replace(/#include <([\w_]+)>/g,(_,key)=>{assert.ok(key in THREE.ShaderChunk,key);return expand(THREE.ShaderChunk[key]);});
  const compiled=expand(shader.vertexShader);assert.ok(!compiled.includes("#include"));
  for(const name of ["understoryForm","understoryWeightsA","understoryWeightsB","understoryLeaf","understoryFlower","understoryEarth","understoryWood"]){
    assert.equal((compiled.match(new RegExp("attribute (?:float|vec[234]) "+name+";","g"))||[]).length,1,name);
  }
  assert.ok(compiled.includes("transformedNormal"));assert.ok(compiled.includes("vFogDepth"));
});

test("actual component preserves one decorative receiving draw and material with no glow or frame subscription",()=>{
  cleanups=[];elementEffects=[];
  const element=component.MoonlitPathUnderstory({pathSegments:paths,activeEntry:entries[0],navigationTargetId:entries[1].id,
    narrativeWorldState:{memoryPressure:0,explorationDepth:0},qualityProfile:{quality:"low"},sampleGroundY:()=>0});
  assert.equal(element.type,"instancedMesh");assert.equal(element.props.args[2],8);assert.equal(element.props.receiveShadow,true);
  assert.equal(element.props.userData.decorativeOnly,true);assert.equal(element.props.raycast(),undefined);
  assert.equal(element.props.children.type,"meshStandardMaterial");assert.equal(element.props.children.props.emissive,undefined);
  assert.equal(element.props.children.props.side,THREE.DoubleSide);assert.equal(elementEffects.length,1);
  const geometry=element.props.args[0];let disposed=0;geometry.addEventListener("dispose",()=>disposed++);
  cleanups.forEach(cleanup=>cleanup());assert.equal(disposed,1);
});
