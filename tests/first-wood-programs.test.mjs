import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import * as React from "react";
import * as jsxRuntime from "react/jsx-runtime";
import * as THREE from "three";
import ts from "typescript";
import * as fiber from "@react-three/fiber";
import { FullScreenQuad } from "three/examples/jsm/postprocessing/Pass.js";
import { enqueueFirstWoodPrograms, FIRST_WOOD_PREPARATION_LIMITS } from "../src/components/three/artDirection/firstWoodPrograms.ts";
import { createMaterialMapGuard } from "../src/components/three/materials/productionMaterialRuntime.ts";
import * as continuity from "../src/components/three/artDirection/worldVisualContinuity.ts";

function fixture({ supported = true } = {}) {
  const scene = new THREE.Scene(), camera = new THREE.PerspectiveCamera(60, 1, .1, 100), visits = [], compiles = [];
  const renderer = { extensions: { has: () => supported }, compile(view, actualCamera, targetScene) {
    compiles.push({ view, actualCamera, targetScene });
    view.traverse(mesh => visits.push({ mesh, map: mesh.material.map, side: mesh.material.side }));
  } };
  function mesh(material = new THREE.MeshStandardMaterial()) {
    const result = new THREE.Mesh(new THREE.BoxGeometry(), material); result.position.z = -5; scene.add(result); return result;
  }
  return { scene, camera, renderer, mesh, visits, compiles, run: () => enqueueFirstWoodPrograms("enchanted.rabbit-hole", renderer, scene, camera) };
}

test("first-memory preparation visits actual visible standard receivers with the original scene lights and no ownership changes", () => {
  const f = fixture(), visible = f.mesh(), hidden = f.mesh(), culled = f.mesh(), otherLayer = f.mesh();
  hidden.visible = false; culled.position.x = 1000; otherLayer.layers.set(2);
  f.mesh(new THREE.MeshBasicMaterial()); f.mesh(new THREE.MeshPhysicalMaterial());
  const grouped = f.mesh(); grouped.material = [new THREE.MeshStandardMaterial()];
  const hiddenMaterial = f.mesh(); hiddenMaterial.material.visible = false;
  const parent = new THREE.Group(), nested = f.mesh(); parent.visible = false; parent.add(nested); f.scene.add(parent);
  const light = new THREE.DirectionalLight(); light.castShadow = true; f.scene.add(light);
  let objectCallbacks = 0, materialCallbacks = 0, shadowCallbacks = 0;
  visible.onBeforeRender = () => objectCallbacks++; visible.material.onBeforeRender = () => materialCallbacks++;
  visible.onBeforeShadow = () => shadowCallbacks++;
  assert.equal(f.run(), true); assert.deepEqual(f.visits.map(x => x.mesh), [visible]);
  assert.equal(f.compiles[0].actualCamera, f.camera); assert.equal(f.compiles[0].targetScene, f.scene);
  assert.equal(f.compiles[0].view.parent, null); let extraLights = 0; f.compiles[0].view.traverseVisible(() => extraLights++); assert.equal(extraLights, 0);
  assert.equal(visible.parent, f.scene); assert.equal(light.parent, f.scene);
  assert.deepEqual([objectCallbacks, materialCallbacks, shadowCallbacks], [0, 0, 0]);
});

test("registered guards prepare each actual geometry before its visit, preserving a shared material's valid and invalid UV variants", () => {
  const f = fixture(), map = new THREE.Texture(), material = new THREE.MeshStandardMaterial();
  material.onBeforeRender = createMaterialMapGuard({ map });
  const valid = f.mesh(material), invalid = f.mesh(material), empty = f.mesh(material);
  invalid.geometry.getAttribute("uv").setXY(0, NaN, 0); invalid.geometry.getAttribute("uv").needsUpdate = true;
  empty.geometry.deleteAttribute("uv");
  f.run(); assert.deepEqual(f.visits.map(x => x.map), [map, null, null]);
  assert.equal(map.version, 0); assert.equal(valid.material, material); assert.equal(invalid.material, material);
  let disposed = 0; map.addEventListener("dispose", () => disposed++); assert.equal(disposed, 0);
});

test("foreign scenes and unsupported parallel compilation keep the normal path without traversing or compiling", () => {
  const f = fixture(); f.mesh();
  f.scene.traverseVisible = () => assert.fail("foreign scene must not be visited");
  assert.equal(enqueueFirstWoodPrograms("fire.boundary", f.renderer, f.scene, f.camera), false);
  const unsupported = fixture({ supported: false }); unsupported.mesh();
  unsupported.scene.traverseVisible = () => assert.fail("unsupported context must not be visited");
  assert.equal(unsupported.run(), false); assert.equal(f.compiles.length + unsupported.compiles.length, 0);
});

test("material and receiver caps bail out before any map guard or compile runs", () => {
  for (const distinctMaterials of [false, true]) {
    const f = fixture(), shared = new THREE.MeshStandardMaterial(), map = new THREE.Texture();
    const bound = distinctMaterials ? FIRST_WOOD_PREPARATION_LIMITS.materials : FIRST_WOOD_PREPARATION_LIMITS.objects;
    for (let i = 0; i <= bound; i++) {
      const material = distinctMaterials ? new THREE.MeshStandardMaterial() : shared;
      material.onBeforeRender = createMaterialMapGuard({ map }); f.mesh(material);
    }
    assert.equal(f.run(), false); assert.equal(f.compiles.length, 0);
    assert.equal(shared.map, null); assert.ok(f.scene.children.every(mesh => mesh.material.map === null));
  }
});

test("removed and disposed receivers are not retained for a later batch, and compile failures remain visible", () => {
  const f = fixture(), mesh = f.mesh(); f.scene.remove(mesh); mesh.geometry.dispose(); mesh.material.dispose();
  assert.equal(f.run(), false); assert.equal(f.compiles.length, 0);
  f.mesh(); const error = new Error("actual shader hook failed"); f.renderer.compile = () => { throw error; };
  assert.throws(f.run, received => received === error);
});

function actualPostProcessing(presentation) {
  const source = readFileSync(new URL("../src/components/three/artDirection/ScenePostProcessing.tsx", import.meta.url), "utf8");
  const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText;
  const imports = { react: React, "react/jsx-runtime": jsxRuntime, three: THREE, "@react-three/fiber": fiber,
    "three/examples/jsm/postprocessing/Pass.js": { FullScreenQuad }, "./firstWoodPrograms": { enqueueFirstWoodPrograms },
    "./SceneLookContext": { useSceneLook: () => presentation.current }, "./worldVisualContinuity": continuity };
  const exports = {}; runInNewContext(code, { exports, require: id => { assert.ok(id in imports, id); return imports[id]; } }, { timeout: 1000 });
  return exports.ScenePostProcessing;
}

test("actual R3F beauty owner prepares once, resets for a quality resource, keeps same-frame renders, and unmounts its only subscriber", async () => {
  fiber.extend(THREE);
  const presentation = { current: { look: { budget: { finishing: false, finishingMaxDimension: 1440 }, grade: { contrast: 1, saturation: 1, vignette: 0, grain: 0 } }, reducedMotion: false } };
  const Component = actualPostProcessing(presentation), canvas = { width: 10, height: 10, style: {} }, f = fixture();
  let target = null, renders = 0, clears = 0, compileTarget = null;
  const gl = { ...f.renderer, compile(...args) { compileTarget = target; f.renderer.compile(...args); },
    extensions: { has: () => true }, capabilities: { maxSamples: 4 },
    getPixelRatio: () => 1, getRenderTarget: () => target, setRenderTarget: next => { target = next; }, clear: () => clears++,
    render: () => renders++, setSize() {}, setPixelRatio() {}, shadowMap: {}, xr: { addEventListener() {}, removeEventListener() {} }, info: { autoReset: true, reset() {} } };
  const previousAct = globalThis.IS_REACT_ACT_ENVIRONMENT; globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  const root = fiber.createRoot(canvas).configure({ gl, scene: f.scene, camera: f.camera, frameloop: "never", size: { width: 10, height: 10 }, dpr: 1 });
  const mesh = f.mesh(), originalParent = mesh.parent;
  const render = async sceneId => { await fiber.act(async () => root.render(React.createElement(React.StrictMode, null, React.createElement(Component, { sceneId, bloomIntensity: .1, vignetteIntensity: .1 })))); };
  const frame = () => { const state = fiber._roots.get(canvas).store.getState(); for (const subscriber of [...state.internal.subscribers]) subscriber.ref.current(state, 1 / 60); };
  try {
    await render("enchanted.rabbit-hole"); frame();
    assert.equal(f.compiles.length, 1); assert.ok(compileTarget?.isWebGLRenderTarget); assert.equal(renders, 2); assert.equal(clears, 1);
    frame(); assert.equal(f.compiles.length, 1); assert.equal(renders, 4);
    presentation.current.look.budget.finishing = true; await render("enchanted.rabbit-hole"); frame();
    assert.equal(f.compiles.length, 2); assert.equal(renders, 11); assert.equal(target, null); assert.equal(gl.info.autoReset, true);
    await render("fire.boundary"); frame(); assert.equal(f.compiles.length, 2); assert.equal(renders, 18);
    assert.equal(mesh.parent, originalParent);
    await fiber.act(async () => root.render(null));
    assert.equal(fiber._roots.get(canvas).store.getState().internal.subscribers.length, 0);
    frame(); assert.equal(f.compiles.length, 2); assert.equal(renders, 18);
  } finally {
    await fiber.act(async () => root.render(null)); fiber._roots.delete(canvas);
    if (previousAct === undefined) delete globalThis.IS_REACT_ACT_ENVIRONMENT; else globalThis.IS_REACT_ACT_ENVIRONMENT = previousAct;
  }
});
