import { sceneryObjectResidence } from '../src/components/three/storyEvents/sceneryObjectResidence.ts';
import { STORY_EVENTS, STORY_OBJECT_DEFINITIONS } from '../src/storyEvents/storyEventRegistry.ts';
import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import RAPIER from '@dimforge/rapier3d-compat';
import { PLAYER_KCC_OFFSET, PLAYER_STEP_HEIGHT, PLAYER_MIN_STEP_WIDTH, PLAYER_GROUND_SNAP, PLAYER_SLOPE_LIMIT_RADIANS, PLAYER_SLIDE_LIMIT_RADIANS, PLAYER_GRAVITY, groundedBodyHeight } from '../src/player/playerMovement.ts';
import { JOURNEY_SCENE_LAYOUTS } from '../src/data/journeyWorldLayout.ts';
import { resolveSpatialSceneWindow, sceneStreamBudget, sceneWorldOrigin } from '../src/world/core/sceneStreaming.ts';
import { explorationPaths, WILLOW_REFUGE, WILLOW_POOL } from '../src/world/terrain/explorationLayout.ts';
import { packForestPathSeeds, packForestClearingSeeds, resolveTerrainSamplerConfig } from '../src/world/terrain/terrainSampler.ts';
import { buildMazePathSegments } from '../src/world/terrain/worldPaths.ts';
import { normalizeGeneratedWorldState } from '../src/data/worldStateNormalization.ts';
import { createExplorationPathGeometry, createWillowGeometry, createWillowPoolGeometry } from '../src/world/ecology/willowGeometry.ts';
import { TERRAIN_BASE_Y } from '../src/world/terrain/worldConstants.ts';
import { SANCTUARY_BRIDGE_DECK, SANCTUARY_BRIDGE_STEPS } from '../src/world/terrain/sanctuaryBridgeLayout.ts';

const entries = normalizeGeneratedWorldState(JSON.parse(readFileSync(new URL('../src/data/worldState.json', import.meta.url), 'utf8'))).entries;
const paths = buildMazePathSegments(entries);

test('every destination is physically resident with an unrelated narrative scene, at every quality', () => {
  for (const quality of ['low', 'medium', 'high', 'cinematic']) for (const scene of JOURNEY_SCENE_LAYOUTS) {
    const activeSceneId = scene.id === 'broken-floor.confession' ? 'epilogue.constellation' : 'broken-floor.confession';
    const ids = resolveSpatialSceneWindow({ x: scene.anchor.position[0], z: scene.anchor.position[2], activeSceneId, quality });
    assert.ok(ids.includes(scene.id));
    if (Math.abs(scene.anchor.position[2] - JOURNEY_SCENE_LAYOUTS.find(s => s.id === activeSceneId).anchor.position[2]) > 200) assert.ok(!ids.includes(activeSceneId), "offscreen chapter colliders are evicted");
    assert.ok(ids.length <= sceneStreamBudget(quality).maxScenery + 1);
    assert.equal(ids.length, new Set(ids).size);
  }
});

test('a long return walk stays bounded and never rebases a remembered place', () => {
  let previous = [], changes = 0;
  const ground = (x,z) => Math.sin(x*.01)+Math.cos(z*.01);
  const origins = new Map(JOURNEY_SCENE_LAYOUTS.map(scene => [scene.id, sceneWorldOrigin(scene.id, ground)]));
  for (const z of [...Array.from({length:200},(_,i)=>-395+i*4), ...Array.from({length:200},(_,i)=>401-i*4)]) {
    const ids = resolveSpatialSceneWindow({x:0,z,activeSceneId:'enchanted.rabbit-hole',quality:'high',previous});
    changes += Number(ids.join() !== previous.join());
    assert.ok(ids.length <= 6);
    for (const id of ids) assert.deepEqual(sceneWorldOrigin(id,ground),origins.get(id));
    previous = ids;
  }
  assert.ok(changes < 130, 'hysteresis avoids continual remounts');
  assert.deepEqual(resolveSpatialSceneWindow({x:NaN,z:0,activeSceneId:'enchanted.rabbit-hole',quality:'high'}),['enchanted.rabbit-hole']);
});

test('optional routes share forest exclusion and terrain seeds without adding canonical entries or graph links', () => {
  assert.equal(entries.length,66);assert.equal(paths.length,65);
  assert.deepEqual(packForestPathSeeds(paths,entries).slice(paths.length),explorationPaths());
  const clearings = packForestClearingSeeds(entries);
  assert.equal(clearings.filter(seed=>seed.id.startsWith('fragment-')).length,66);
  assert.ok(clearings.some(seed=>seed.id==='geography.willow-refuge'&&seed.position[0]===WILLOW_REFUGE.x));
  const config=resolveTerrainSamplerConfig(entries,paths,{});
  const ribbon=createExplorationPathGeometry(config.sample,{});
  const p=ribbon.getAttribute('position');
  for(let i=0;i<p.count;i++) assert.ok(Math.abs(p.getY(i)-config.sample(p.getX(i),p.getZ(i))-.025)<.0001);
  ribbon.dispose();
});

test('willow geometry is finite, bounded, deterministic and scales within a fixed triangle budget', () => {
  let previous = 0;
  for(const quality of ['low','high']) {
    const a=createWillowGeometry(quality,()=>0),b=createWillowGeometry(quality,()=>0);
    let triangles=0;
    for(const key of ['wood','leaves']) {
      assert.deepEqual(a[key].getAttribute('position').array,b[key].getAttribute('position').array);
      assert.ok([...a[key].getAttribute('position').array].every(Number.isFinite));
      triangles+=a[key].index.count/3;a[key].dispose();b[key].dispose();
    }
    assert.ok(triangles>previous&&triangles<54000);previous=triangles;
  }
});

test('the actual Rapier capsule walks onto, across and back off the sanctuary bridge', async () => {
  await RAPIER.init();
  const world=new RAPIER.World({x:0,y:-9.81,z:0});
  try {
    world.createCollider(RAPIER.ColliderDesc.cuboid(12,.1,24).setTranslation(0,-.1,0));
    const deck=SANCTUARY_BRIDGE_DECK;
    world.createCollider(RAPIER.ColliderDesc.cuboid(...deck.halfExtents).setTranslation(deck.position[0],deck.position[1]+.5,deck.position[2]));
    for(const step of SANCTUARY_BRIDGE_STEPS)world.createCollider(RAPIER.ColliderDesc.cuboid(...step.size.map(n=>n/2)).setTranslation(step.position[0],step.position[1]+.5,step.position[2]));
    const body=world.createRigidBody(RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(0,.84,-10));
    const capsule=world.createCollider(RAPIER.ColliderDesc.capsule(.54,.28),body);
    const controller=world.createCharacterController(PLAYER_KCC_OFFSET);controller.enableAutostep(PLAYER_STEP_HEIGHT,PLAYER_MIN_STEP_WIDTH,true);controller.enableSnapToGround(PLAYER_GROUND_SNAP);controller.setMaxSlopeClimbAngle(PLAYER_SLOPE_LIMIT_RADIANS);controller.setMinSlopeSlideAngle(PLAYER_SLIDE_LIMIT_RADIANS);
    world.step();let highest=0, velocity=0;
    for(const sign of [1,-1])for(let i=0;i<370;i++) {
      velocity -= PLAYER_GRAVITY / 60;
      controller.computeColliderMovement(capsule,{x:0,y:velocity/60,z:sign*.06});
      if(controller.computedGrounded())velocity=0;
      const p=body.translation(),m=controller.computedMovement();
      const support=groundedBodyHeight({bodyY:p.y+m.y,groundY:0,verticalVelocity:velocity,grounded:controller.computedGrounded(),moving:true});
      if(support.snap)velocity=0;
      body.setNextKinematicTranslation({x:p.x+m.x,y:support.bodyY,z:p.z+m.z});world.step();highest=Math.max(highest,body.translation().y);
      if(sign===1&&i===369)assert.ok(body.translation().z>10,'crossed the complete span');
    }
    assert.ok(highest>1.4&&highest<1.6,'capsule stood on the visible deck');
    assert.ok(body.translation().z<-9.8,'returned by walking');
    assert.ok(Math.abs(body.translation().y-.84)<.06,'returned to terrain height');
    world.removeCharacterController(controller);
  } finally {world.free();}
});

test('the quiet pool is below its shoreline and its water edge meets shared collider triangles', () => {
  const sample=resolveTerrainSamplerConfig(entries,paths,{}).sample;
  const ground=(x,z)=>TERRAIN_BASE_Y+sample(x,z),waterY=TERRAIN_BASE_Y+WILLOW_POOL.surfaceOffset;
  assert.ok(ground(WILLOW_POOL.x,WILLOW_POOL.z)<waterY-.1);
  const pool=createWillowPoolGeometry(ground),p=pool.getAttribute('position');
  for(let i=1;i<p.count;i++)assert.ok(Math.abs(ground(WILLOW_POOL.x+p.getX(i),WILLOW_POOL.z-p.getY(i))-waterY)<.0001);
  pool.dispose();
});

test('Rapier support above terrain is authoritative for raised stepping surfaces', () => {
  for(const height of [.15,.24,.3,.6])assert.equal(groundedBodyHeight({bodyY:.855+height,groundY:0,verticalVelocity:0,grounded:true,moving:true}).snap,false);
});

test('shared objects have one scenery residence without changing active interaction presentation', () => {
  const accepted=STORY_EVENTS.map(event=>event.id);
  for(const object of STORY_OBJECT_DEFINITIONS) {
    if(!object.sceneIds.length)continue;
    for(const scene of JOURNEY_SCENE_LAYOUTS) {
      const owner=sceneryObjectResidence(object,scene.id,accepted);
      assert.ok(object.sceneIds.includes(owner));
      if(object.sceneIds.includes(scene.id))assert.equal(owner,scene.id);
      assert.equal(object.sceneIds.filter(id=>id===owner).length,1);
    }
  }
  const lantern=STORY_OBJECT_DEFINITIONS.find(object=>object.id==='lantern.master');
  assert.equal(sceneryObjectResidence(lantern,'epilogue.constellation',accepted),'crowned.sovereignty');
  assert.deepEqual(accepted,STORY_EVENTS.map(event=>event.id),'projection never modifies accepted evidence');
});
