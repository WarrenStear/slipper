import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import * as React from "react";
import * as jsxRuntime from "react/jsx-runtime";
import * as THREE from "three";
import ts from "typescript";
import { act, createRoot, extend, _roots } from "@react-three/fiber";
import { attachMaterialShadow } from "../src/components/three/materials/materialShadowOwnership.ts";
import { createMaterialMapGuard } from "../src/components/three/materials/productionMaterialRuntime.ts";

extend(THREE);

// Execute the actual component's hooks and attach callback through the installed
// R3F reconciler. The renderer must never run; shader/network policy is irrelevant
// to parent-transfer ownership and is kept inert in this CPU-only fixture.
function tactileOwner() {
  const source = readFileSync(new URL("../src/components/three/storyEvents/TactileMaterial.tsx", import.meta.url), "utf8");
  const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText;
  const imports = {
    react: React, "react/jsx-runtime": jsxRuntime, three: THREE,
    "../materials/materialShadowOwnership": { attachMaterialShadow },
    "../materials/productionMaterialRuntime": { createMaterialMapGuard },
    "../materials/useProductionMaterialMaps": { useProductionMaterialMaps: () => undefined },
    "../materials/materialMapAdmission": { admitsProductionMaterialMaps: () => false },
    "../artDirection/SceneLookContext": { useSceneLook: () => null },
    "../materials/materialLibrary": {
      resolveSurfaceDefaults: () => ({ roughness: .8, metalness: 0 }),
      resolveMaterialMemory: () => ({ roughness: .8, brightness: 1, wetness: 0, wear: 0, damage: 0 }),
    },
    "./tactileShader": { tactileDetailFor: () => "relief", tactileProgramKey: () => "fixed-relief", applyTactileShader() {} },
  };
  const exports = {};
  runInNewContext(code, { exports, require: id => { assert.ok(id in imports, id); return imports[id]; } }, { timeout: 1000 });
  return exports.TactileMaterial;
}

function ownerHarness() {
  const Material = tactileOwner(), canvas = { width: 1, height: 1, style: {} }, scene = new THREE.Scene();
  const previousAct = globalThis.IS_REACT_ACT_ENVIRONMENT;
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  const gl = { render() { assert.fail("CPU owner fixture cannot render"); }, setSize() {}, setPixelRatio() {},
    shadowMap: {}, xr: { addEventListener() {}, removeEventListener() {} } };
  const root = createRoot(canvas).configure({ gl, scene, frameloop: "never", size: { width: 1, height: 1 }, dpr: 1 });
  const meshes = [];
  return {
    meshes,
    async render(counts) {
      await act(async () => root.render(React.createElement(React.StrictMode, null,
        ...counts.map((count, index) => React.createElement("instancedMesh", {
          key: index, ref: mesh => { if (mesh) meshes[index] = mesh; }, args: [undefined, undefined, count],
        }, React.createElement(Material, { surface: "wood", color: "#a38d73" }))))));
    },
    async close() {
      await act(async () => root.render(null));
      _roots.delete(canvas);
      if (previousAct === undefined) delete globalThis.IS_REACT_ACT_ENVIRONMENT;
      else globalThis.IS_REACT_ACT_ENVIRONMENT = previousAct;
    },
  };
}
const observeDisposal = resource => {
  let count = 0; resource.addEventListener("dispose", () => count++); return () => count;
};

test("actual R3F mesh reconstruction transfers one tactile depth owner and releases every former parent", async () => {
  const harness = ownerHarness(), owners = [];
  let source, sourceDisposals;
  try {
    for (const count of [14, 16, 14, 16, 14]) {
      await harness.render([count]);
      const mesh = harness.meshes[0], depth = mesh.customDepthMaterial;
      if (!source) { source = mesh.material; sourceDisposals = observeDisposal(source); }
      assert.equal(mesh.material, source, "R3F transfers the same material child between reconstructed meshes");
      assert.equal(sourceDisposals(), 0, "The attach owner must not dispose the borrowed source material");
      for (const previous of owners) {
        assert.equal(previous.disposals(), 1, "Former private depth owner must be disposed once before transfer completes");
        assert.equal(previous.mesh.customDepthMaterial, undefined, "Former parent cannot retain the disposed depth binding");
      }
      owners.push({ mesh, depth, disposals: observeDisposal(depth) });
      assert.equal(owners.at(-1).disposals(), 0);
    }
  } finally { await harness.close(); }
  assert.equal(sourceDisposals(), 1, "R3F retains normal ownership of the source material on final unmount");
  assert.deepEqual(owners.map(owner => owner.disposals()), [1, 1, 1, 1, 1]);
  assert.ok(owners.every(owner => owner.mesh.customDepthMaterial === undefined));
});

test("a tactile parent transfer does not release a sibling component's depth owner", async () => {
  const harness = ownerHarness(); let first, sibling, firstDisposals, siblingDisposals;
  try {
    await harness.render([14, 9]);
    [first, sibling] = harness.meshes.map(mesh => mesh.customDepthMaterial);
    firstDisposals = observeDisposal(first); siblingDisposals = observeDisposal(sibling);
    await harness.render([16, 9]);
    assert.equal(firstDisposals(), 1);
    assert.equal(harness.meshes[1].customDepthMaterial, sibling);
    assert.equal(siblingDisposals(), 0, "Component-local transfer ownership must preserve independently mounted materials");
  } finally { await harness.close(); }
  assert.equal(firstDisposals(), 1); assert.equal(siblingDisposals(), 1);
});
