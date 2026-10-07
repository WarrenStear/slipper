import assert from "node:assert/strict";

import test from "node:test";

import { readFileSync } from "node:fs";

import { runInNewContext } from "node:vm";

import ts from "typescript";

import * as THREE from "three";

import * as originalHero from "../src/components/three/environmentArt/heroGeometry.ts";

import { createPlayerLanternGeometries, createBaselinePlayerLanternGeometries, createReviewedPlayerLanternGeometries } from "../src/player/playerLanternGeometry.ts";

import * as geometryModule from "../src/player/playerLanternGeometry.ts";

import * as authoredGeometry from "../src/components/three/environmentArt/authoredGeometry.ts";

import { createReviewedLanternHousingGeometry } from "../src/player/playerLanternArt.ts";

import { createPlayerLanternMaterials } from "../src/player/playerLanternMaterials.ts";

import { createPlayerLanternPose, advancePlayerLanternPose } from "../src/player/playerLanternPose.ts";

import { configurePlayerLanternSpot, createPlayerLanternResourceRelease } from "../src/player/playerLanternResources.ts";

import * as poseModule from "../src/player/playerLanternPose.ts";

import * as resourceModule from "../src/player/playerLanternResources.ts";


const source = readFileSync(new URL("./fixtures/player-lantern-before-extraction.txt", import.meta.url), "utf8");

const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText;

const ownerSource = readFileSync(new URL("../src/player/PlayerLantern.tsx", import.meta.url), "utf8");

const compiledOwner = ts.transpileModule(ownerSource, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText;

// Immutable exact native constructor used in the accepted studio/carried review.
// Its historical candidate label is retained; production uses the reviewed owner.
const reviewedSource = readFileSync(new URL("./fixtures/player-lantern-reviewed-art.txt", import.meta.url), "utf8");
const reviewedExports = {};
runInNewContext(ts.transpileModule(reviewedSource, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, {
  exports: reviewedExports, require: id => {
    const modules = { three: THREE, "./heroGeometry.ts": originalHero, "./authoredGeometry.ts": authoredGeometry };
    assert.ok(id in modules, id); return modules[id];
  },
});

const baseStyle = () => ({ color: new THREE.Color("#edbd75"), lightScale: .88, glowScale: .75, bodyScale: .94,
  shadows: true, instability: .28, steadiness: .96, reach: 17, guideBoost: .2 });

const close = (actual, expected, tolerance = 1e-10) => assert.ok(Math.abs(actual - expected) <= tolerance, `${actual} != ${expected}`);

const vectorClose = (actual, expected) => actual.toArray().forEach((value, i) => close(value, expected.toArray()[i]));


function reference(config = {}, extracted = false) {
  const options = { pressure: .5, depth: .4, reducedMotion: false, reducedEffects: false, compactPortrait: false,
    hasPresentation: true, sharedFlameMotion: .12, airMovement: .16, enabled: true, navigation: [4, .5, 11], ...config };
  const camera = new THREE.PerspectiveCamera(65, 1.5, .05, 180);
  camera.position.set(-2, 1.6, -4); camera.rotation.set(.08, .3, .015); camera.updateMatrixWorld();
  const presentation = options.hasPresentation ? { time: { flame: 0 }, motion: { flame: options.sharedFlameMotion } } : null;
  const style = baseStyle(), effects = [], memos = [], frames = [], cleanups = [];
  const element = (type, props) => ({ type, props });
  const imports = {
    react: { useMemo: fn => { const value = fn(); memos.push(value); return value; }, useRef: current => ({ current }), useEffect: fn => effects.push(fn) },
    "react/jsx-runtime": { jsx: element, jsxs: element }, three: THREE,
    "@react-three/fiber": { useThree: () => ({ camera, size: options.compactPortrait ? { width: 393, height: 851 } : { width: 1100, height: 760 } }), useFrame: fn => frames.push(fn) },
    "./artDirection/SceneLookContext": { useSceneLook: () => presentation },
    "./actors/HeroAssetSlot": { HeroAssetSlot: props => props.children },
    "../../cinematics/emotionalCinematography": { isCinematicProfileActive: () => true, getCurrentCinematicProfile: () => ({ airMovement: options.airMovement }) },
    "../../stores/useSettingsStore": { useSettingsStore: fn => fn({ reducedMotion: options.reducedMotion }) },
    "./environmentArt/heroGeometry": originalHero, "../../lib/worldLayout": { TERRAIN_BASE_Y: -1.255 },
    "./worldDirector/worldDirector": { resolveLanternDirector: () => style },
  };
  Object.assign(imports, {
    "../components/three/artDirection/SceneLookContext": imports["./artDirection/SceneLookContext"],
    "../components/three/actors/HeroAssetSlot": imports["./actors/HeroAssetSlot"],
    "../components/three/worldDirector/worldDirector": imports["./worldDirector/worldDirector"],
    "../cinematics/emotionalCinematography": imports["../../cinematics/emotionalCinematography"],
    "../stores/useSettingsStore": imports["../../stores/useSettingsStore"],
    "../lib/worldLayout": imports["../../lib/worldLayout"],
    "./playerLanternGeometry.ts": geometryModule,
    "./playerLanternMaterials.ts": { createPlayerLanternMaterials },
    "./playerLanternPose.ts": poseModule,
    "./playerLanternResources.ts": resourceModule,
  });
  const exports = {};
  runInNewContext(extracted ? compiledOwner : compiled, { exports, require: id => { assert.ok(id in imports, id); return imports[id]; } });
  const tree = (extracted ? exports.PlayerLantern : exports.MasterPlayerLantern)({ narrativeWorldState: { memoryPressure: options.pressure, explorationDepth: options.depth },
    qualityProfile: { shadowMapSize: 512 }, narrativePhase: options.phase, navigationTargetPosition: options.navigation,
    enabled: options.enabled, reducedEffects: options.reducedEffects, geometryFactory: options.geometryFactory });
  function mount(node) {
    if (!node) return null;
    if (typeof node.type === "function") return mount(node.type(node.props));
    const p = node.props, object = node.type === "group" ? new THREE.Group()
      : node.type === "primitive" ? p.object : node.type === "mesh" ? new THREE.Mesh(p.geometry, p.material)
        : node.type === "spotLight" ? new THREE.SpotLight(p.color, p.intensity, p.distance, p.angle, p.penumbra, p.decay)
          : node.type === "pointLight" ? new THREE.PointLight(p.color, p.intensity, p.distance, p.decay) : null;
    assert.ok(object, node.type);
    if (p.position) object.position.set(...p.position); if (typeof p.scale === "number") object.scale.setScalar(p.scale);
    if (p.visible !== undefined) object.visible = p.visible; if (p.name) object.name = p.name;
    if (p.ref) p.ref.current = object;
    for (const child of Array.isArray(p.children) ? p.children : [p.children]) { const mounted = mount(child); if (mounted) object.add(mounted); }
    return object;
  }
  const root = mount(tree); effects.forEach(fn => { const cleanup = fn(); if (cleanup) cleanups.push(cleanup); });
  return { options, camera, presentation, style, root, frames, effects,
    materials: memos.find(value => value?.flame?.isMaterial), geometries: memos.find(value => value?.flame?.isBufferGeometry),
    dispose: () => cleanups.forEach(cleanup => cleanup()) };
}

function geometryEqual(actual, expected) {
  assert.deepEqual(Object.keys(actual.attributes), Object.keys(expected.attributes));
  for (const name of Object.keys(actual.attributes)) assert.deepEqual(actual.getAttribute(name).array, expected.getAttribute(name).array, name);
  assert.deepEqual(actual.index?.array, expected.index?.array); assert.deepEqual(actual.groups, expected.groups);
}

const counts = geometry => (geometry.index?.count ?? geometry.getAttribute("position").count) / 3;

function intersections(geometry, x, y) {
  const material = new THREE.MeshBasicMaterial({ side: THREE.DoubleSide }), mesh = new THREE.Mesh(geometry, material);
  mesh.updateMatrixWorld(); const result = new THREE.Raycaster(new THREE.Vector3(x, y, 2), new THREE.Vector3(0, 0, -1)).intersectObject(mesh);
  material.dispose(); return result;
}


test("extracted owned geometry is byte-equivalent to the active source constructor body", () => {
  const actual = createPlayerLanternGeometries(), frozen = reference();
  for (const name of ["metal", "glass", "flame", "glow"]) geometryEqual(actual[name], frozen.geometries[name]);
  assert.ok(counts(actual.metal) <= 3000); assert.ok(counts(actual.glass) <= 400);
  createPlayerLanternResourceRelease(actual, createPlayerLanternMaterials())(); frozen.dispose();
});

test("actual carried default is byte-equivalent to the accepted native art with exactly240 added housing triangles", () => {
  const owner = reference({}, true), baseline = createBaselinePlayerLanternGeometries();
  const accepted = createBaselinePlayerLanternGeometries(reviewedExports.createCandidateLanternHousingGeometry);
  reviewedExports.shapeCandidateLanternFlame(accepted.flame);
  for (const name of ["metal", "glass", "flame", "glow"]) geometryEqual(owner.geometries[name], accepted[name]);
  assert.equal(counts(owner.geometries.metal), 2856); assert.equal(counts(baseline.metal), 2616);
  assert.equal(counts(owner.geometries.metal) - counts(baseline.metal), 240);
  assert.equal(counts(owner.geometries.glass), 288); assert.equal(counts(owner.geometries.flame), 120);
  assert.equal(counts(owner.geometries.glow), 2);
  let meshes = 0, lights = 0;
  owner.root.traverse(object => { if (object.isMesh) meshes++; if (object.isLight) lights++; });
  assert.equal(meshes, 4); assert.equal(lights, 2); assert.equal(owner.frames.length, 1);
  for (const material of Object.values(owner.materials)) {
    for (const value of Object.values(material)) assert.ok(!value?.isTexture, "Reviewed geometry must not add a sampler");
  }
  owner.dispose(); for (const geometry of [...Object.values(baseline), ...Object.values(accepted)]) geometry.dispose();
});

test("reviewed housing remains finite indexed single-draw art with open chimney, usableUVs and contained physical detail", () => {
  const housing = createReviewedLanternHousingGeometry(), repeated = createReviewedLanternHousingGeometry();
  geometryEqual(housing, repeated); assert.equal(housing.groups.length, 0); assert.ok(counts(housing) <= 3000);
  for (const attribute of Object.values(housing.attributes)) assert.ok(Array.from(attribute.array).every(Number.isFinite));
  assert.ok(Array.from(housing.index.array).every(index => index >= 0 && index < housing.getAttribute("position").count));
  assert.ok(housing.boundingBox.min.y >= 0); assert.ok(housing.boundingBox.max.y < 1.21);
  for (const axis of ["x", "z"]) assert.ok(Math.max(Math.abs(housing.boundingBox.min[axis]), Math.abs(housing.boundingBox.max[axis])) < .29);
  for (const y of [.34, .45, .5, .57, .67]) assert.equal(intersections(housing, 0, y).length, 0);
  const glass = originalHero.createLanternGlassGeometry(); assert.ok(intersections(glass, 0, .5).length > 0);
  const uv = housing.getAttribute("uv"), color = housing.getAttribute("color");
  assert.equal(uv.itemSize, 2); assert.equal(uv.count, housing.getAttribute("position").count);
  assert.ok(Math.max(...uv.array) > Math.min(...uv.array));
  assert.equal(color.count, housing.getAttribute("position").count);
  assert.ok(Array.from(color.array).every(value => value >= 0 && value <= 1));
  housing.dispose(); repeated.dispose(); glass.dispose();
});

test("reviewed wick shape preserves flame topology/colour and the exact glass/glow with its tip contained in the chimney", () => {
  const reviewed = createReviewedPlayerLanternGeometries(), baseline = createBaselinePlayerLanternGeometries();
  geometryEqual(reviewed.glass, baseline.glass); geometryEqual(reviewed.glow, baseline.glow);
  assert.deepEqual(reviewed.flame.index.array, baseline.flame.index.array);
  assert.deepEqual(reviewed.flame.getAttribute("color").array, baseline.flame.getAttribute("color").array);
  assert.notDeepEqual(reviewed.flame.getAttribute("position").array, baseline.flame.getAttribute("position").array);
  reviewed.glass.computeBoundingBox(); reviewed.flame.computeBoundingBox();
  assert.ok(reviewed.flame.boundingBox.min.y - .005 > reviewed.glass.boundingBox.min.y);
  assert.ok(reviewed.flame.boundingBox.max.y - .005 < reviewed.glass.boundingBox.max.y);
  assert.ok(Math.max(Math.abs(reviewed.flame.boundingBox.min.x), Math.abs(reviewed.flame.boundingBox.max.x)) < .06);
  for (const geometry of [...Object.values(reviewed), ...Object.values(baseline)]) geometry.dispose();
});


test("material flags and exact glow shaders remain stable with the reviewed metal finish", () => {
  const actual = createPlayerLanternMaterials(), frozen = reference();
  for (const name of ["metal", "glass", "flame", "glow"]) {
    for (const key of ["type", "transparent", "opacity", "depthWrite", "depthTest", "side", "blending", "toneMapped", "vertexColors", "roughness", "metalness", "emissiveIntensity", "vertexShader", "fragmentShader"]) assert.equal(actual[name][key], frozen.materials[name][key], `${name}.${key}`);
    if (actual[name].color) vectorClose(actual[name].color, name === "metal" ? new THREE.Color("#5b523d") : frozen.materials[name].color);
    if (actual[name].emissive) vectorClose(actual[name].emissive, frozen.materials[name].emissive);
  }
  assert.equal(actual.glow.uniforms.glowOpacity.value, .075);
  assert.equal(actual.glass.emissiveIntensity, 0); assert.equal(actual.glass.depthWrite, false);
  for (const material of Object.values(actual)) material.dispose(); frozen.dispose();
});


test("pure pose reproduces the real component's spring, aim, light and flame outputs over sustained frame histories", () => {
  const configs = [ {}, { compactPortrait: true }, { reducedMotion: true }, { reducedEffects: true },
    { navigation: null }, { enabled: false }, { hasPresentation: false, airMovement: .006 },
    { hasPresentation: false, airMovement: .4 }, { sharedFlameMotion: 0 }, { pressure: 0, depth: 0 }, { pressure: 1, depth: 1 },
    { phase: { id: "borrowed", stability: .46, intensity: .8, reach: .7, flicker: .7, movement: .5 } } ];
  for (const config of configs) {
    const original = reference(config), pose = createPlayerLanternPose(), options = original.options;
    const [target, spot, point, body] = original.root.children, [glow, metal, flame, glass] = body.children;
    assert.equal(original.frames.length, 1);
    for (let frame = 0; frame < 180; frame++) {
      const elapsed = frame / 60, delta = frame % 53 === 0 ? .5 : 1 / 60;
      original.camera.position.x = -2 + Math.sin(elapsed * .2); original.camera.rotation.y = .3 + elapsed * .1; original.camera.updateMatrixWorld();
      if (original.presentation) original.presentation.time.flame = elapsed;
      original.frames[0]({ clock: { elapsedTime: elapsed } }, delta);
      const navigationLocal = options.navigation ? new THREE.Vector3(options.navigation[0], -1.255 + options.navigation[1] + 1.12, options.navigation[2]) : null;
      if (navigationLocal) original.camera.worldToLocal(navigationLocal);
      advancePlayerLanternPose(pose, { elapsed, delta, pressure: options.pressure, depth: options.depth, enabled: options.enabled,
        compactPortrait: options.compactPortrait, reducedMotion: options.reducedMotion, reducedEffects: options.reducedEffects,
        hasPresentation: options.hasPresentation, sharedFlameMotion: options.sharedFlameMotion, airMovement: options.airMovement,
        phase: options.phase, style: original.style, navigationLocal });
      const expectedRoot = new THREE.Group(); expectedRoot.position.copy(original.camera.position); expectedRoot.quaternion.copy(original.camera.quaternion);
      expectedRoot.translateX(pose.position.x); expectedRoot.translateY(pose.position.y); expectedRoot.translateZ(pose.position.z);
      expectedRoot.rotation.z += pose.tiltZ; expectedRoot.rotation.x += pose.tiltX;
      vectorClose(original.root.position, expectedRoot.position); vectorClose(original.root.quaternion, expectedRoot.quaternion);
      vectorClose(target.position, pose.target); close(spot.intensity, pose.spotIntensity); close(spot.distance, pose.spotDistance);
      close(spot.angle, pose.spotAngle); assert.equal(spot.castShadow, pose.spotShadow); close(point.intensity, pose.pointIntensity);
      close(point.distance, pose.pointDistance); close(body.scale.x, pose.bodyScale); vectorClose(flame.scale, pose.flameScale);
      close(flame.rotation.y, pose.flameRotation); close(glow.scale.x, pose.glowScale);
      close(original.materials.glow.uniforms.glowOpacity.value, pose.glowOpacity); close(glass.rotation.y, pose.glassRotation);
      close(original.materials.glass.opacity, pose.glassOpacity); vectorClose(original.materials.flame.color, pose.color.clone().multiplyScalar(3.2));
    }
    original.dispose();
  }
});


test("quiet and comfort modes remove the residual spring without removing deliberate route aiming", () => {
  const pose = createPlayerLanternPose(), input = { elapsed: 3, delta: .016, pressure: .8, depth: .7, enabled: true, compactPortrait: true,
    reducedMotion: false, reducedEffects: false, hasPresentation: true, sharedFlameMotion: .2, airMovement: .4,
    navigationLocal: new THREE.Vector3(30, 10, -20), style: baseStyle() };
  for (let i = 0; i < 80; i++) advancePlayerLanternPose(pose, { ...input, elapsed: i * .016 });
  assert.ok(pose.velocity.length() > 0);
  advancePlayerLanternPose(pose, { ...input, sharedFlameMotion: 0 });
  assert.equal(pose.velocity.length(), 0); vectorClose(pose.position, pose.desired);
  assert.ok(pose.target.x > 0); close(pose.tiltX, 0); close(pose.tiltZ, 0);
  close(pose.flameRotation, 0); close(pose.glassRotation, 0);
});


test("each cleanup lease releases only its owned eight resources once and a replay gets a fresh cleanup", () => {
  const geometry = createPlayerLanternGeometries(), material = createPlayerLanternMaterials(), resources = [...Object.values(geometry), ...Object.values(material)];
  const events = resources.map(() => 0); resources.forEach((resource, i) => resource.addEventListener("dispose", () => events[i]++));
  const borrowed = new THREE.Texture(); let borrowedDisposed = 0; borrowed.addEventListener("dispose", () => borrowedDisposed++); material.metal.map = borrowed;
  const release = createPlayerLanternResourceRelease(geometry, material); release(); release(); assert.deepEqual(events, Array(8).fill(1));
  const replayRelease = createPlayerLanternResourceRelease(geometry, material); replayRelease(); replayRelease(); assert.deepEqual(events, Array(8).fill(2));
  assert.equal(borrowedDisposed, 0); borrowed.dispose();
});


test("spot target and bounded shadow settings preserve the existing configuration without owning targets", () => {
  const spot = new THREE.SpotLight(), target = new THREE.Object3D(); configurePlayerLanternSpot(spot, target, 512);
  assert.equal(spot.target, target); assert.equal(spot.shadow.camera.near, .18); assert.equal(spot.shadow.camera.far, 18);
  assert.equal(spot.shadow.camera.fov, 34); assert.equal(spot.shadow.bias, -.00006); assert.equal(spot.shadow.normalBias, .016);
  assert.equal(spot.shadow.mapSize.x, 512); assert.equal(spot.shadow.mapSize.y, 512); assert.equal(spot.shadow.map, null);
});


test("actual source fallback remains four mesh materials and two local lights with no production registry admission", () => {
  const original = reference(); let meshes = 0, lights = 0;
  original.root.traverse(object => { if (object.isMesh) meshes++; if (object.isLight) lights++; });
  assert.equal(meshes, 4); assert.equal(lights, 2);
  assert.equal(original.materials.glass.map, null); assert.equal(original.materials.metal.map, null);
  assert.equal(original.frames.length, 1); original.dispose();
});


test("explicit baseline and reviewed default preserve all 2160 actual carried pose, light and material frame samples", () => {
  const configs = [ {}, { compactPortrait: true }, { reducedMotion: true }, { reducedEffects: true },
    { navigation: null }, { enabled: false }, { hasPresentation: false, airMovement: .006 },
    { hasPresentation: false, airMovement: .4 }, { sharedFlameMotion: 0 }, { pressure: 0, depth: 0 }, { pressure: 1, depth: 1 },
    { phase: { id: "borrowed", stability: .46, intensity: .8, reach: .7, flicker: .7, movement: .5 } } ];
  let compared = 0;
  for (const config of configs) {
    const original = reference(config), owner = reference({ ...config, geometryFactory: createBaselinePlayerLanternGeometries }, true), reviewed = reference(config, true);
    assert.equal(original.frames.length, 1); assert.equal(owner.frames.length, 1);
    assert.equal(original.root.name, owner.root.name); assert.equal(original.root.visible, owner.root.visible);
    for (const key of ["metal", "glass", "flame", "glow"]) geometryEqual(owner.geometries[key], original.geometries[key]);
    for (let frame = 0; frame < 180; frame++) {
      const elapsed = frame / 60, delta = frame % 53 === 0 ? .5 : 1 / 60;
      for (const fixture of [original, owner, reviewed]) {
        fixture.camera.position.x = -2 + Math.sin(elapsed * .2);
        fixture.camera.rotation.y = .3 + elapsed * .1; fixture.camera.updateMatrixWorld();
        if (fixture.presentation) fixture.presentation.time.flame = elapsed;
        fixture.frames[0]({ clock: { elapsedTime: elapsed } }, delta);
      }
      const compareObject = (actual, expected) => {
        assert.equal(actual.type, expected.type); assert.equal(actual.children.length, expected.children.length);
        vectorClose(actual.position, expected.position); vectorClose(actual.quaternion, expected.quaternion);
        vectorClose(actual.scale, expected.scale); assert.equal(actual.visible, expected.visible);
        if (actual.isLight) {
          vectorClose(actual.color, expected.color);
          for (const key of ["intensity", "distance", "angle", "penumbra", "decay"]) {
            if (expected[key] !== undefined) close(actual[key], expected[key]);
          }
          assert.equal(actual.castShadow, expected.castShadow);
        }
        actual.children.forEach((child, i) => compareObject(child, expected.children[i]));
      };
      for (const actual of [owner, reviewed]) {
        compareObject(actual.root, original.root);
        vectorClose(actual.materials.flame.color, original.materials.flame.color);
        vectorClose(actual.materials.glow.uniforms.glowColor.value, original.materials.glow.uniforms.glowColor.value);
        close(actual.materials.glow.uniforms.glowOpacity.value, original.materials.glow.uniforms.glowOpacity.value);
        close(actual.materials.glass.opacity, original.materials.glass.opacity);
      }
      compared++;
    }
    original.dispose(); owner.dispose(); reviewed.dispose();
  }
  assert.equal(compared, 2160);
});

test("selected housing injection constructs one native housing without a discarded baseline", () => {
  let calls = 0; const selected = new THREE.BoxGeometry(.1, .2, .1);
  const geometries = createPlayerLanternGeometries(() => { calls++; return selected; });
  assert.equal(calls, 1); assert.equal(geometries.metal, selected);
  let factoryCalls = 0;
  const owner = reference({ geometryFactory: () => { factoryCalls++; return geometries; } }, true);
  assert.equal(factoryCalls, 1); assert.equal(owner.geometries.metal, selected);
  assert.equal(owner.frames.length, 1); owner.dispose();
});

test("actual owner effect replay releases its eight resources per lifetime and preserves borrowed maps", () => {
  const owner = reference({}, true), resources = [...Object.values(owner.materials), ...Object.values(owner.geometries)];
  const released = Array(8).fill(0); resources.forEach((resource, i) => resource.addEventListener("dispose", () => released[i]++));
  const borrowed = new THREE.Texture(); let borrowedReleases = 0;
  borrowed.addEventListener("dispose", () => borrowedReleases++); owner.materials.metal.map = borrowed;
  owner.dispose(); owner.dispose(); assert.deepEqual(released, Array(8).fill(1));
  const replayCleanups = owner.effects.map(setup => setup()).filter(Boolean);
  owner.frames[0]({ clock: { elapsedTime: 2 } }, 1 / 60);
  replayCleanups.forEach(cleanup => { cleanup(); cleanup(); });
  assert.deepEqual(released, Array(8).fill(2)); assert.equal(borrowedReleases, 0);
  assert.equal(owner.root.children.filter(child => child.isLight).length, 2); assert.equal(owner.frames.length, 1);
  borrowed.dispose();
});

test("the physical carrying model and real frame owner have no story command or camera authority", () => {
  const ownerAst = ts.createSourceFile("PlayerLantern.tsx", ownerSource, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  let subscribers = 0;
  const inspect = node => {
    if (ts.isCallExpression(node) && ts.isIdentifier(node.expression) && node.expression.text === "useFrame") {
      subscribers++; assert.equal(node.arguments.length, 1, "Existing default-priority subscriber must not take renderer ownership");
    }
    ts.forEachChild(node, inspect);
  };
  inspect(ownerAst); assert.equal(subscribers, 1);
  for (const name of ["playerLanternPose.ts", "playerLanternGeometry.ts", "playerLanternArt.ts", "playerLanternMaterials.ts", "playerLanternResources.ts"]) {
    const helper = readFileSync(new URL(`../src/player/${name}`, import.meta.url), "utf8");
    assert.doesNotMatch(helper, /useFrame|useJourneyStore|useWorldStore|dispatchStoryEvent|completeRitual|applyJourneyOutcome|window\.|document\./);
  }
  assert.doesNotMatch(ownerSource, /useJourneyStore|useWorldStore|dispatchStoryEvent|completeRitual|applyJourneyOutcome/);
  assert.doesNotMatch(ownerSource, /camera\.(?:position|quaternion|rotation)\.(?:set|copy|add)|camera\.lookAt/);
});
