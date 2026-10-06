import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import test from "node:test";
import ts from "typescript";
import * as THREE from "three";
import { SCENE_LOOKS, resolveSceneLook } from "../src/components/three/artDirection/SceneLookRegistry.ts";
import * as continuity from "../src/components/three/artDirection/worldVisualContinuity.ts";
import * as ownership from "../src/world/atmosphere/atmosphereOwnership.ts";
import * as atmosphereFog from "../src/world/atmosphere/atmosphereFog.ts";
import * as mistField from "../src/world/atmosphere/groundMistField.ts";
import * as depth from "../src/world/atmosphere/forestDepth.ts";

const looks = Object.entries(SCENE_LOOKS);
const tolerance = 1e-12;
const unit = value => Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : 0;
const corridor = composition => {
  const focal = composition?.focalPoint ?? [], x = Number.isFinite(focal[0]) ? focal[0] : 0, z = Number.isFinite(focal[2]) ? focal[2] : 0;
  const largest = Math.max(Math.abs(x), Math.abs(z));
  const length = largest ? Math.hypot(x / largest, z / largest) : 1;
  const forward = largest ? [x / largest / length, z / largest / length] : [0, 1];
  return { forward, normal: [forward[1], -forward[0]], clearance: 3.2 + 4.2 * unit(composition?.negativeSpace) + 2.4 * unit(composition?.horizonOpenness) };
};
const close = (actual, expected) => assert.ok(Math.abs(actual - expected) < tolerance, `${actual} != ${expected}`);

test("all 32 authored compositions clear air by the bounded factor without exceeding the original ceiling", () => {
  assert.equal(looks.length, 32);
  for (const [id, authored] of looks) {
    const look = resolveSceneLook(id, "high"), factor = depth.forestSightlineFactor(authored.composition);
    close(factor, 1 - .32 * authored.composition.horizonOpenness * authored.composition.negativeSpace);
    assert.ok(factor >= .68 && factor <= 1);
    for (const density of [0, .001, look.atmosphere.density, .025, .1, 1]) {
      const actual = depth.forestFogDensity(density, authored.composition);
      assert.ok(Number.isFinite(actual) && actual >= 0 && actual <= .025 && actual <= density);
      close(actual, Math.min(.025, density) * factor);
    }
  }
});

test("opening either composition axis never increases density, while a closed axis preserves authored air", () => {
  for (let fixed = 0; fixed <= 20; fixed++) {
    let previousHorizon = .025, previousSpace = .025;
    for (let value = 0; value <= 20; value++) {
      const h = depth.forestFogDensity(.04, { horizonOpenness: value / 20, negativeSpace: fixed / 20 });
      const n = depth.forestFogDensity(.04, { horizonOpenness: fixed / 20, negativeSpace: value / 20 });
      assert.ok(h <= previousHorizon + tolerance && n <= previousSpace + tolerance);
      previousHorizon = h; previousSpace = n;
    }
  }
  assert.equal(depth.forestFogDensity(.018, { horizonOpenness: 0, negativeSpace: 1 }), .018);
  assert.equal(depth.forestFogDensity(.018, { horizonOpenness: 1, negativeSpace: 0 }), .018);
  close(depth.forestFogDensity(.025, { horizonOpenness: 50, negativeSpace: 80 }), .017);
});

test("all authored mist banks retain population, dimensions, forward depth and side outside the focal corridor", () => {
  for (const [id, authored] of looks) {
    const original = mistField.groundMistPatches(id), before = original.map(patch => [...patch]);
    const composed = depth.composeGroundMist(original, authored.composition), { forward, normal, clearance } = corridor(authored.composition);
    assert.equal(composed.length, original.length);
    assert.deepEqual(original, before, "Compatibility generator arrays must remain untouched");
    assert.deepEqual(composed, depth.composeGroundMist(original, authored.composition));
    for (const [i, patch] of composed.entries()) {
      const [x, y, z, sx, sy, sz] = patch, previous = original[i];
      assert.ok(patch.every(Number.isFinite)); assert.ok(Math.hypot(x, z) < 40); assert.ok(sx > 0 && sy > 0 && sz > 0);
      assert.deepEqual([y, sx, sy, sz], [previous[1], previous[3], previous[4], previous[5]]);
      close(x * forward[0] + z * forward[1], previous[0] * forward[0] + previous[2] * forward[1]);
      const lateral = x * normal[0] + z * normal[1], oldLateral = previous[0] * normal[0] + previous[2] * normal[1];
      const radius = Math.hypot(normal[0] * sx, normal[1] * sz);
      assert.ok(Math.abs(lateral) - radius >= clearance + .2 - tolerance, `${id}: mist intersects its reserved sightline`);
      if (oldLateral) assert.equal(Math.sign(lateral), Math.sign(oldLateral));
    }
    if (!original.length) assert.equal(composed, original);
  }
});

test("negative, zero, tiny and exceptionally large focal directions stay finite and clear", () => {
  const points = [[0, 0, 0], [-4, 0, -8], [7, 0, -3], [-1, 0, 0], [0, 0, -1],
    [Number.MIN_VALUE, 0, -Number.MIN_VALUE], [Number.MAX_VALUE, 0, -Number.MAX_VALUE], [NaN, 0, Infinity]];
  for (const focalPoint of points) {
    const composition = { focalPoint, negativeSpace: .9, horizonOpenness: .8 }, { normal, clearance } = corridor(composition);
    const original = mistField.groundMistPatches("enchanted.rabbit-hole");
    const result = depth.composeGroundMist(original, composition);
    assert.equal(result.length, 3);
    for (const [x, y, z, sx, sy, sz] of result) {
      assert.ok([x, y, z, sx, sy, sz].every(Number.isFinite)); assert.ok(Math.hypot(x, z) < 40);
      assert.ok(Math.abs(x * normal[0] + z * normal[1]) - Math.hypot(normal[0] * sx, normal[1] * sz) >= clearance - tolerance);
    }
  }
});

test("adverse composition and patch values keep finite bounded output and never add banks", () => {
  const compositions = [undefined, null, {}, { focalPoint: [] }, { focalPoint: [NaN, Infinity, -Infinity], horizonOpenness: NaN, negativeSpace: Infinity },
    { focalPoint: [Infinity, NaN, 0], horizonOpenness: -Infinity, negativeSpace: -8 }, { focalPoint: [0, 0, 0], horizonOpenness: 8, negativeSpace: 6 }];
  const patches = [[NaN, NaN, Infinity, -1, 0, NaN], [Number.MAX_VALUE, -Infinity, -Number.MAX_VALUE, Infinity, Infinity, -Infinity]];
  for (const composition of compositions) {
    const factor = depth.forestSightlineFactor(composition); assert.ok(Number.isFinite(factor) && factor >= .68 && factor <= 1);
    for (const density of [NaN, Infinity, -Infinity, -1, 0, Number.MIN_VALUE, Number.MAX_VALUE]) {
      const actual = depth.forestFogDensity(density, composition); assert.ok(Number.isFinite(actual) && actual >= 0 && actual <= .025);
    }
    const result = depth.composeGroundMist(patches, composition); assert.equal(result.length, patches.length);
    for (const patch of result) {
      assert.ok(patch.every(Number.isFinite)); assert.ok(Math.hypot(patch[0], patch[2]) < 128);
      assert.ok(patch.slice(3).every(value => value > 0 && value <= 16));
    }
  }
});

test("zero-side banks alternate and already clear original placements remain fixed", () => {
  const composition = { focalPoint: [0, 0, 5], negativeSpace: 0, horizonOpenness: 0 };
  const source = [[0, .2, 6, 1, .3, 1], [0, .3, 7, 1, .4, 1], [-20, .4, 8, 2, .5, 3]];
  const result = depth.composeGroundMist(source, composition);
  assert.ok(result[0][0] < 0 && result[1][0] > 0); assert.deepEqual(result[2], source[2]);
  close(result[0][0], -4.4); close(result[1][0], 4.4);
});

function loadOwner(path, presentation, scene, profile) {
  const frames = [], cleanups = [], effects = [];
  const element = (type, props) => ({ type, props });
  const imports = {
    react: { useMemo: callback => callback(), useRef: value => ({ current: value }), useLayoutEffect: callback => {
      effects.push(callback); const cleanup = callback(); if (cleanup) cleanups.push(cleanup);
    } },
    "react/jsx-runtime": { jsx: element, jsxs: element }, three: THREE,
    "@react-three/fiber": { useThree: () => ({ scene }), useFrame: (callback, priority = 0) => frames.push({ callback, priority }) },
    "../../components/three/artDirection/SceneLookContext": { useSceneLook: () => presentation },
    "../../components/three/artDirection/worldVisualContinuity": continuity,
    "../../cinematics/emotionalCinematography": { getCurrentCinematicProfile: () => profile },
    "./atmosphereOwnership": ownership, "./atmosphereFog": atmosphereFog,
    "./groundMistField": mistField, "./forestDepth.ts": depth,
  };
  const exports = {};
  const source = readFileSync(new URL(`../src/world/atmosphere/${path}.tsx`, import.meta.url), "utf8");
  runInNewContext(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText,
    { exports, require: id => { assert.ok(id in imports, id); return imports[id]; } });
  return { owner: exports[path], frames, cleanups, effects };
}
const presentationFor = (id, quality = "high", reducedEffects = false) => ({ look: resolveSceneLook(id, quality, reducedEffects),
  reducedMotion: false, reducedEffects, time: { vegetation: 17 }, stillness: 0 });

test("actual atmosphere owner applies composition to its initial fog and existing ordered transition subscriber", () => {
  for (const [id] of looks) {
    const presentation = presentationFor(id), scene = new THREE.Scene(), previousFog = scene.fog, previousBackground = scene.background;
    const profile = { fogDensity: .018, visibility: 48 }, runtime = loadOwner("SceneAtmosphere", presentation, scene, profile);
    const element = runtime.owner({ heading: .7 });
    close(scene.fog.density, depth.forestFogDensity(presentation.look.atmosphere.density, presentation.look.composition));
    assert.equal(runtime.frames.length, 1); assert.equal(runtime.frames[0].priority, 0);
    const initial = scene.fog.density, target = depth.forestFogDensity(Math.min(.025, .018 * 1.3), presentation.look.composition);
    runtime.frames[0].callback({ camera: new THREE.PerspectiveCamera() }, .02);
    close(scene.fog.density, initial + (target - initial) * continuity.worldTransitionAlpha(.02, false));
    presentation.reducedMotion = true; profile.fogDensity = .01; profile.visibility = 120;
    runtime.frames[0].callback({ camera: new THREE.PerspectiveCamera() }, .016);
    close(scene.fog.density, depth.forestFogDensity(.01 * .75, presentation.look.composition));
    assert.equal(element.type, "mesh"); assert.deepEqual(Array.from(element.props.children[0].props.args), [170, 24, 12]);
    runtime.cleanups.forEach(cleanup => cleanup()); assert.equal(scene.fog, previousFog); assert.equal(scene.background, previousBackground);
  }
});

test("actual mist owner uses composed placements with the same shared geometry, shader, one draw and quality gates", () => {
  for (const [id, authored] of looks) for (const [quality, reducedEffects] of [["high", false], ["cinematic", false], ["low", false], ["medium", false], ["high", true]]) {
    const presentation = presentationFor(id, quality, reducedEffects), scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2("#ffffff", .012);
    const runtime = loadOwner("GroundMist", presentation, scene, {}), output = runtime.owner();
    const patches = depth.composeGroundMist(mistField.groundMistPatches(id), authored.composition);
    if (!presentation.look.budget.shafts || !patches.length) {
      assert.equal(output, null); assert.equal(runtime.frames.length, 0); continue;
    }
    assert.deepEqual(output.props.patches, patches);
    const batch = output.type(output.props); assert.equal(batch.type, "instancedMesh"); assert.equal(batch.props.args[2], patches.length);
    assert.equal(batch.props.userData.drawCallBudget, 1); assert.equal(batch.props.raycast(), undefined);
    const [geometry, material] = batch.props.children;
    assert.deepEqual(Array.from(geometry.props.args), [1, 12, 6]); assert.equal(material.props.vertexShader, mistField.GROUND_MIST_VERTEX);
    assert.equal(material.props.fragmentShader, mistField.GROUND_MIST_FRAGMENT); assert.equal(material.props.depthWrite, false);
    assert.equal(runtime.frames.length, 1); assert.equal(runtime.frames[0].priority, 0);
    runtime.frames[0].callback({ scene }, .016);
    assert.equal(material.props.uniforms.fogDensity.value, .012); assert.equal(material.props.uniforms.time.value, 17);
  }
});
