import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import * as THREE from 'three';
import { normalizeGeneratedWorldState } from '../src/data/worldStateNormalization.ts';
import { buildMazePathSegments, curvedPathPointAt, terrainCurveSeedFor } from '../src/world/terrain/worldPaths.ts';
import { entryWorldPosition } from '../src/world/terrain/worldPlacement.ts';
import { packForestClearingSeeds, packForestPathSeeds, resolveTerrainSamplerConfig, terrainElevationAtPoint } from '../src/world/terrain/terrainSampler.ts';
import { applyTerrainSurface, createTerrainGeometry, terrainColliderIndices } from '../src/world/terrain/terrainGeometry.ts';
import { TERRAIN_BASE_Y, TERRAIN_SIZE, TERRAIN_SEGMENTS } from '../src/world/terrain/worldConstants.ts';
import { generateTerrain } from '../src/workers/forestWorker.ts';
import { RENDER_QUALITY_PROFILES, resolveEnvironmentalEffectsProfile } from '../src/components/three/renderQuality.ts';
import { landscapeForScene, createLandscapeTerrain, createLandscapeObjects, landscapeBudget } from '../src/components/three/environment/landscapeGeography.ts';
import { createLandscapeEcology } from '../src/components/three/environment/landscapeEcology.ts';
import { biomeEcologyBudget } from '../src/components/three/environment/environmentThemes.ts';

const baseline = JSON.parse(readFileSync(new URL('./fixtures/world-extraction-baseline.json', import.meta.url), 'utf8'));
const archive = JSON.parse(readFileSync(new URL('../src/data/worldState.json', import.meta.url), 'utf8'));
const entries = normalizeGeneratedWorldState(archive).entries;
const paths = buildMazePathSegments(entries);
const read = p => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');

function assertPackedPathSnapshot(actual, expected) {
  // Native trigonometric results differ by a few trillionths between the Mac
  // and Linux/Node 22. Keep every seed, endpoint, bound and topology flag exact;
  // allow only 1e-10 world units for derived controls and integrated arc length.
  const {controlA,controlB,curveLength,...metadata}=actual;
  const {controlA:expectedA,controlB:expectedB,curveLength:expectedLength,...expectedMetadata}=expected;
  assert.deepEqual(metadata,expectedMetadata);
  for(const [point,reference] of [[controlA,expectedA],[controlB,expectedB]]) {
    assert.equal(point.length,reference.length);
    for(let i=0;i<point.length;i++) assert.ok(Number.isFinite(point[i])&&Math.abs(point[i]-reference[i])<=1e-10,
      `Seeded path control changed: ${point[i]} versus ${reference[i]}`);
  }
  assert.ok(Number.isFinite(curveLength)&&Math.abs(curveLength-expectedLength)<=1e-10,
    `Integrated path length changed: ${curveLength} versus ${expectedLength}`);
}

test('extracted production path packing preserves every authored placement, seeded control point and crown ramp', () => {
  assert.equal(entries.length, 66);
  assert.equal(paths.length, 65);
  assert.deepEqual(packForestClearingSeeds(entries), baseline.clearings);
  const packed=packForestPathSeeds(paths, entries);
  assert.equal(packed.length,baseline.paths.length);
  packed.forEach((path,index)=>assertPackedPathSnapshot(path,baseline.paths[index]));
  for (const path of paths) {
    const seed = terrainCurveSeedFor(path);
    assert.equal(terrainCurveSeedFor(path), seed, 'Curve packing must reuse the same immutable segment cache');
    assert.deepEqual(curvedPathPointAt(path, 0, {}).toArray(), seed.source);
    assert.deepEqual(curvedPathPointAt(path, 1, {}).toArray(), seed.target);
    const source = entryWorldPosition(path.sourceEntry, entries);
    assert.deepEqual(source.filter((_, i) => i !== 1), seed.source);
  }
});

test('live terrain sampling matches the independently executed pre-extraction production values', () => {
  for (const {x, z, depth, pressure, elevation} of baseline.samples) {
    assert.equal(terrainElevationAtPoint(x, z, entries, paths, {explorationDepth:depth,memoryPressure:pressure}), elevation);
  }
  const current = resolveTerrainSamplerConfig(entries, paths, {explorationDepth:.35,memoryPressure:.2});
  assert.equal(resolveTerrainSamplerConfig(entries, paths, {explorationDepth:.35,memoryPressure:.2}), current);
  const clamped = resolveTerrainSamplerConfig(entries, paths, {explorationDepth:4,memoryPressure:-1});
  assert.equal(clamped.config.explorationDepth, 1);
  assert.equal(clamped.config.memoryPressure, 0);
  assert.equal(resolveTerrainSamplerConfig(entries, paths, {explorationDepth:1,memoryPressure:0}), clamped);
  assert.notEqual(resolveTerrainSamplerConfig(entries, [...paths], {explorationDepth:1,memoryPressure:0}), clamped);
});

test('the actual terrain renderer uploads the identical collider vertices and indices through morphs and recoloring', () => {
  const geometry = createTerrainGeometry();
  const indices = terrainColliderIndices(geometry);
  assert.deepEqual(indices, Uint32Array.from(geometry.index.array));
  assert.equal(indices.length / 3, 32768);
  const material = new THREE.MeshBasicMaterial({side:THREE.DoubleSide});
  const mesh = new THREE.Mesh(geometry, material);
  const ray = new THREE.Raycaster();
  for (const morph of [{explorationDepth:0,memoryPressure:0},{explorationDepth:.6,memoryPressure:.8}]) {
    const sampler = resolveTerrainSamplerConfig(entries, paths, morph);
    const config = {...sampler.config,terrainSize:TERRAIN_SIZE,terrainSegments:TERRAIN_SEGMENTS,terrainBaseY:TERRAIN_BASE_Y,groundColor:'#344432'};
    const surface = generateTerrain({type:'GENERATE_TERRAIN',requestId:1,config});
    applyTerrainSurface(geometry, surface);
    assert.deepEqual(geometry.getAttribute('position').array, surface.positions);
    assert.deepEqual(geometry.getAttribute('color').array, surface.colors);
    assert.deepEqual(geometry.getAttribute('terrainHabitat').array, surface.habitat);
    assert.deepEqual(terrainColliderIndices(geometry), indices);
    mesh.updateMatrixWorld();
    for (const {x,z} of baseline.samples) {
      ray.set(new THREE.Vector3(x,100,z),new THREE.Vector3(0,-1,0));
      const hit = ray.intersectObject(mesh)[0];
      assert.ok(hit, `Visible terrain must contain collider sample ${x},${z}`);
      const expected = TERRAIN_BASE_Y + sampler.sample(x,z);
      assert.ok(Math.abs(hit.point.y-expected)<2e-5, `Rendered/collision triangle differs at ${x},${z}`);
    }
    const recolored = generateTerrain({type:'GENERATE_TERRAIN',requestId:2,config:{...config,groundColor:'#8a632f'}});
    assert.deepEqual(recolored.positions,surface.positions,'Color changes must not deform the existing collider');
    applyTerrainSurface(geometry,recolored);
    assert.deepEqual(geometry.getAttribute('position').array,surface.positions);
    assert.notDeepEqual(recolored.colors,surface.colors);
  }
  geometry.dispose(); material.dispose();
});

test('quality and reduced effects leave the continuous terrain grid and collider topology unchanged', () => {
  const reference=createTerrainGeometry(),vertices=reference.getAttribute('position').array,indices=terrainColliderIndices(reference);
  for (const quality of ['low','medium','high','cinematic']) for (const reduced of [false,true]) {
    const profile=resolveEnvironmentalEffectsProfile(RENDER_QUALITY_PROFILES[quality],reduced);
    assert.ok(profile.forestCellRadius<=4&&profile.treesPerCell<=3);
    const geometry=createTerrainGeometry();
    assert.deepEqual(geometry.getAttribute('position').array,vertices);
    assert.deepEqual(terrainColliderIndices(geometry),indices);
    geometry.dispose();
  }
  reference.dispose();
  const ground=read('src/world/terrain/HillyForestGround.tsx');
  assert.match(ground,/useMemo\(createTerrainGeometry, \[\]\)/);
  assert.match(ground,/args=\{\[terrainColliderSurface\.positions, terrainIndices\]\}/);
  assert.match(ground,/result\.requestId !== requestIdRef\.current/);
  assert.match(ground,/colliderShapeTokenRef\.current !== shapeToken/);
  assert.match(ground,/positions: result\.positions/);
  assert.match(ground,/applyTerrainSurface\(geometry, terrainSurface\)/);
});

test('new landscape and ecology quality prefixes keep their authored placement and reduced-effect rules', () => {
  const spec=landscapeForScene('enchanted.friendship-meadow');
  const terrain=createLandscapeTerrain(spec),objects=createLandscapeObjects(spec,terrain),ecology=createLandscapeEcology(spec,terrain,objects.trees);
  const highObjects=Object.fromEntries(Object.entries(objects).map(([kind,items])=>[kind,items.slice(0,landscapeBudget('cinematic')[kind])]));
  const highEcology=Object.fromEntries(Object.entries(ecology).map(([kind,items])=>[kind,items.slice(0,biomeEcologyBudget('cinematic')[kind])]));
  for (const quality of ['low','medium','high','cinematic']) {
    for(const [kind,items]of Object.entries(objects))assert.deepEqual(items.slice(0,landscapeBudget(quality)[kind]),highObjects[kind].slice(0,landscapeBudget(quality)[kind]));
    for(const [kind,items]of Object.entries(ecology))assert.deepEqual(items.slice(0,biomeEcologyBudget(quality)[kind]),highEcology[kind].slice(0,biomeEcologyBudget(quality)[kind]));
    assert.deepEqual(biomeEcologyBudget(quality,true),{evergreens:0,grass:0,flowers:0});
    assert.deepEqual(landscapeBudget(quality,true),landscapeBudget('low'));
  }
});

test('StoryScene mounts real world owners while physics, canonical atmosphere and route observation keep their gates', () => {
  const scene=read('src/components/three/StoryScene.tsx'),forest=read('src/world/forest/ContinuousForestBed.tsx'),frame=read('src/world/forest/ClearingForestFrame.tsx');
  assert.match(scene,/from "\.\.\/\.\.\/world\/forest\/ContinuousForestBed\.tsx"/);
  assert.match(scene,/<ContinuousForestBed[\s\S]*renderVisible=\{exteriorVisible\}/);
  assert.doesNotMatch(scene,/function (?:HillyForestGround|ContinuousForestBed|ClearingForestFrame|SceneAtmosphere|CelestialMoon|AtmosphericForestPanorama|buildMazePathSegments)\b/);
  assert.match(forest,/<HillyForestGround renderVisible=\{renderVisible\}/);
  assert.match(forest,/<group name="continuous-forest-visuals" visible=\{renderVisible\}>/);
  assert.match(forest,/worker\.terminate\(\)/);
  assert.match(forest,/claimForestBuild\([\s\S]*workerRef\.current !== null/);
  assert.match(frame,/const portraitFrame = viewportAspect < 0\.78/);
  assert.match(frame,/routeOpeningHalfAngle = portraitFrame \? 0\.46 : 0\.36/);
  for (const owner of ['LegacySceneAtmosphere','NarrativeLightingRig','AtmosphericForestPanorama'])assert.match(scene,new RegExp(`narrativeScene \\? null : <${owner}`));
  assert.match(scene,/<GuidanceController/);
  const guidance=read('src/world/guidance/GuidanceController.tsx');
  assert.match(guidance,/from "\.\.\/terrain\/worldPaths"/);
  assert.match(guidance,/from "\.\.\/\.\.\/lib\/navigationResolver"/);
  assert.doesNotMatch(guidance,/useJourneyStore|dispatchStoryEvent|StoryActions/);
  for(const owner of ['src/world/terrain/worldPaths.ts','src/world/terrain/terrainSampler.ts','src/world/forest/ContinuousForestBed.tsx'])assert.doesNotMatch(read(owner),/from .*StoryScene/);
});
