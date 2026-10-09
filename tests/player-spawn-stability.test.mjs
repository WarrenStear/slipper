import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {dirname,join} from 'node:path';
import vm from 'node:vm';
import ts from 'typescript';
import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';
import {applyProps} from '@react-three/fiber';
import * as movement from '../src/player/playerMovement.ts';
import {buildNarrativeWorldState} from '../src/lib/narrativeJourneyState.ts';
import {dispatchStoryEventState} from '../src/storyEvents/storyEventState.ts';
import {normalizeGeneratedWorldState} from '../src/data/worldStateNormalization.ts';
import {buildMazePathSegments} from '../src/world/terrain/worldPaths.ts';
import {terrainElevationAtPoint} from '../src/world/terrain/terrainSampler.ts';
import {TERRAIN_BASE_Y} from '../src/world/terrain/worldConstants.ts';

await RAPIER.init();
const source=readFileSync(new URL('../src/player/PlayerController.tsx',import.meta.url),'utf8');
const require=createRequire(import.meta.url);
const adapter=readFileSync(join(dirname(require.resolve('@react-three/rapier')),'react-three-rapier.esm.js'),'utf8');
const ast=ts.createSourceFile('installed-rapier.js',adapter,ts.ScriptTarget.Latest,true,ts.ScriptKind.JS);
const selected=['rigidBodyTypeMap','rigidBodyTypeFromString','vectorToTuple','mutableRigidBodyOptions','mutableRigidBodyOptionKeys','setRigidBodyOptions','useUpdateRigidBodyOptions'];
const declarations=selected.map(name=>{
  const found=ast.statements.filter(s=>ts.isVariableStatement(s)&&s.declarationList.declarations.some(d=>d.name.getText(ast)===name));
  assert.equal(found.length,1,`Installed Rapier owner ${name} must be uniquely source-bound`);return found[0].getText(ast);
}).join('\n');
const equal=(a,b)=>a&&b&&a.length===b.length&&a.every((v,i)=>Object.is(v,b[i]));
// A bounded hook host preserves mount refs and dependency-driven effects. The
// component frame, installed Rapier option effect, body and KCC all run unchanged.
function hooks(){
  const slots=[];let cursor=0,pending=[];
  return {begin(){cursor=0;pending=[];},flush(){for(const fn of pending)fn();},dispose(){for(const s of slots)s?.cleanup?.();},
    useRef(value){const i=cursor++;return slots[i]??=( {current:value} );},
    useMemo(fn,deps){const i=cursor++;if(!slots[i]||!equal(slots[i].deps,deps))slots[i]={deps,value:fn()};return slots[i].value;},
    useEffect(fn,deps){const i=cursor++;if(!slots[i]||!equal(slots[i].deps,deps)){const prior=slots[i];slots[i]={deps};pending.push(()=>{prior?.cleanup?.();slots[i].cleanup=fn();});}},
  };
}
function mount(initialPosition,sampleGroundY){
  const owner=hooks(),options=hooks(),world=new RAPIER.World({x:0,y:-9.81,z:0});
  const body=world.createRigidBody(RAPIER.RigidBodyDesc.kinematicPositionBased());
  const collider=world.createCollider(RAPIER.ColliderDesc.capsule(movement.PLAYER_HALF_HEIGHT,movement.PLAYER_RADIUS),body);
  const object=new THREE.Object3D(),camera=new THREE.PerspectiveCamera();camera.rotation.y=Math.PI;
  const states=new Map([[body.handle,{object}]]),pose={current:{position:{x:0,y:0,z:0},available:false,speedRatio:0}};
  const input={moveX:0,moveZ:1,lookX:0,lookY:0,reset(){this.moveX=this.moveZ=this.lookX=this.lookY=0;}};
  const keys={current:{forward:false,backward:false,left:false,right:false}};
  let frame,oldPosition=null,rendered;
  const modules={react:owner,three:THREE,'@react-three/fiber':{useThree:()=>({camera}),useFrame:(fn,priority)=>{assert.equal(priority,-2);frame=fn;}},
    '@react-three/rapier':{RigidBody:'body',CapsuleCollider:'capsule',useRapier:()=>({world})},
    '../stores/usePlayerInputStore':{usePlayerInputStore:{getState:()=>input}},'./playerMovement':movement,
    './playerInput':{usePlayerControls:()=>keys,resetPlayerKeys:value=>Object.keys(value).forEach(k=>value[k]=false)},
    'react/jsx-runtime':{jsx:(type,props)=>({type,props})}};
  const exports={};vm.runInNewContext(ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX}}).outputText,
    {exports,require:name=>{assert.ok(name in modules,`Unexpected player dependency ${name}`);return modules[name];}});
  const {useUpdateRigidBodyOptions}=vm.runInNewContext(declarations+'\n;({useUpdateRigidBodyOptions})',{
    ...THREE,useMemo:options.useMemo,useEffect:options.useEffect,_matrix4:new THREE.Matrix4(),_position:new THREE.Vector3(),_rotation:new THREE.Quaternion(),_scale:new THREE.Vector3()});
  const props={enabled:true,movementEnabled:true,cameraReadyRef:{current:true},initialPosition,sampleGroundY,movementSpeed:()=>movement.PLAYER_SPEED,pose,inputActive:()=>true};
  function render(next={}){
    Object.assign(props,next);owner.begin();rendered=exports.PlayerController(props);assert.equal(rendered.type,'body');
    const p=rendered.props;assert.equal(p.children.type,'capsule');p.ref.current=body;p.children.props.ref.current=collider;
    if(!equal(oldPosition,p.position)){applyProps(object,{position:p.position});oldPosition=[...p.position];}
    options.begin();useUpdateRigidBodyOptions(()=>body,p,states);options.flush();owner.flush();
  }
  render();
  return {body,pose,render,props,spawn:()=>rendered.props.position,
    advance(count=45){for(let i=0;i<count;i++){frame({},1/60);world.step();object.position.copy(body.translation());object.quaternion.copy(body.rotation());}},
    dispose(){owner.dispose();options.dispose();world.free();}};
}
const original=JSON.parse(readFileSync(new URL('./fixtures/player-spawn-before-swan.json',import.meta.url))).state;
const accepted=dispatchStoryEventState(original,{sceneId:'blue-moon.intimacy',trigger:'volume-enter',objectId:'blue-moon.swan'});
assert.deepEqual(accepted.eventIds,['blue-moon.swan-followed']);
const entries=normalizeGeneratedWorldState(JSON.parse(readFileSync(new URL('../src/data/worldState.json',import.meta.url)))).entries;
const content={entryById:new Map(entries.map(entry=>[entry.id,entry])),totalCount:entries.length},segments=buildMazePathSegments(entries);
function terrain(state){
  const morph=buildNarrativeWorldState(state,content),ground=(x,z)=>TERRAIN_BASE_Y+terrainElevationAtPoint(x,z,entries,segments,morph);
  const [x,,z]=state.playerPosition;
  return {morph,ground,initial:[x,ground(x,z)+movement.PLAYER_FOOT_OFFSET+movement.PLAYER_GROUND_CLEARANCE,z]};
}
const before=terrain(original),after=terrain(accepted.state);

test('accepted Swan terrain changes do not rewind an already moving actual PlayerController body',()=>{
  assert.ok(after.morph.explorationDepth>before.morph.explorationDepth);
  assert.notEqual(after.initial[1],before.initial[1],'Actual accepted state changes the saved-position ground sample');
  assert.equal(after.initial[0],before.initial[0]);assert.equal(after.initial[2],before.initial[2]);
  const cpu=mount(before.initial,before.ground);
  try{
    cpu.advance();const travelled=cpu.body.translation();assert.ok(Math.hypot(travelled.x-before.initial[0],travelled.z-before.initial[2])>2);
    cpu.render({initialPosition:after.initial,sampleGroundY:after.ground});
    assert.deepEqual(cpu.body.translation(),travelled,'A changing initial ground Y must not reapply saved X/Z to the live body');
    assert.deepEqual([...cpu.spawn()],before.initial);
    cpu.advance(1);assert.ok(Math.hypot(cpu.body.translation().x-travelled.x,cpu.body.translation().z-travelled.z)<.1);
    assert.ok(Math.hypot(cpu.body.translation().x-before.initial[0],cpu.body.translation().z-before.initial[2])>2);
  }finally{cpu.dispose();}
});

test('spawn is cloned per mount; a fresh relocation mount takes the new supplied position',()=>{
  const caller=[...before.initial],cpu=mount(caller,before.ground);
  try{
    caller[0]+=10;cpu.render({initialPosition:caller});assert.deepEqual([...cpu.spawn()],before.initial);
    const relocated=[after.initial[0]+8,after.initial[1],after.initial[2]-7],fresh=mount(relocated,after.ground);
    try{assert.deepEqual([...fresh.spawn()],relocated);assert.equal(fresh.body.translation().x,Math.fround(relocated[0]));assert.equal(fresh.body.translation().z,Math.fround(relocated[2]));}
    finally{fresh.dispose();}
  }finally{cpu.dispose();}
});
