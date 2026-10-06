import assert from "node:assert/strict";
import test from "node:test";
import * as THREE from "three";
import { WebGLShadowMap } from "three/src/renderers/webgl/WebGLShadowMap.js";
import { WebGLMaterials } from "three/src/renderers/webgl/WebGLMaterials.js";
import { attachMaterialShadow } from "../src/components/three/materials/materialShadowOwnership.ts";
import { createMaterialMapGuard } from "../src/components/three/materials/productionMaterialRuntime.ts";

// Exercise the installed shadow/material implementation without WebGL or a
// synthetic copy of getDepthMaterial. Only renderer calls are replaced by CPU
// observations; uniforms still refresh through Three's actual implementation.
function shadowHarness(...casters) {
  const scene = new THREE.Scene(), camera = new THREE.PerspectiveCamera();
  const light = new THREE.DirectionalLight(); light.position.set(0, 8, 2);
  scene.add(...casters, light, light.target);
  for (const caster of casters) { caster.castShadow = true; caster.frustumCulled = false; }
  scene.updateMatrixWorld(true); camera.updateMatrixWorld(true);
  const records = [], uniformsByMaterial = new WeakMap();
  const renderer = {
    getRenderTarget: () => null, getActiveCubeFace: () => 0, getActiveMipmapLevel: () => 0,
    setRenderTarget() {}, clear() {}, localClippingEnabled: false,
    state: { setBlending() {}, setScissorTest() {}, viewport() {},
      buffers: { color: { setClear() {} }, depth: { setTest() {} } } },
    renderBufferDirect(_camera, _scene, _geometry, material, object) {
      let uniforms = uniformsByMaterial.get(material);
      if (!uniforms) { uniforms = THREE.UniformsUtils.clone(THREE.ShaderLib.depth.uniforms); uniformsByMaterial.set(material, uniforms); }
      materials.refreshMaterialUniforms(uniforms, material, 1, 1, null);
      records.push({ object, material, version: material.version, map: material.map, uniformMap: uniforms.map.value });
    },
  };
  const materials = WebGLMaterials(renderer, { get: () => ({}) });
  const shadow = new WebGLShadowMap(renderer, { update: object => object.geometry }, { maxTextureSize: 4096 });
  shadow.enabled = true;
  return { records, render() { records.length = 0; shadow.render([light], scene, camera); return records; },
    dispose() { light.dispose(); for (const caster of casters) caster.geometry.dispose(); } };
}
const caster = () => new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshStandardMaterial());
const countDisposals = resource => {
  let count = 0; resource.addEventListener("dispose", () => count++); return () => count;
};

test("installed Three shared depth uniforms retain a disposed map after an unmapped caster", () => {
  const texture = new THREE.Texture(), mesh = caster(), harness = shadowHarness(mesh);
  mesh.material.map = texture;
  const first = harness.render()[0];
  assert.equal(first.uniformMap, texture);
  texture.dispose(); mesh.material.map = null;
  const second = harness.render()[0];
  assert.equal(second.material, first.material);
  assert.equal(second.version, first.version, "Three does not invalidate the recycled depth variant");
  assert.equal(second.map, null);
  assert.equal(second.uniformMap, texture, "An active cached map sampler can resurrect this disposed texture");
  harness.dispose(); mesh.material.dispose();
});

test("private shadow ownership isolates borrowed maps from subsequent plain casters", () => {
  const texture = new THREE.Texture(), mesh = caster(), plain = caster();
  const source = new THREE.MeshStandardMaterial(), original = mesh.material;
  const release = attachMaterialShadow(mesh, source, () => createMaterialMapGuard({ map: texture }));
  const privateDepth = mesh.customDepthMaterial;
  const harness = shadowHarness(mesh, plain);
  const records = harness.render();
  assert.equal(records[0].material, privateDepth);
  assert.equal(records[0].uniformMap, texture);
  assert.equal(privateDepth.depthPacking, THREE.RGBADepthPacking);
  assert.notEqual(records[1].material, privateDepth);
  assert.equal(records[1].uniformMap, null);
  release(); texture.dispose();
  assert.equal(mesh.material, original);
  assert.ok(harness.render().every(record => record.uniformMap === null));
  harness.dispose(); source.dispose(); original.dispose(); plain.material.dispose();
});

test("shadow draws run the current UV guard before sampling and refresh Three's earlier map copy", () => {
  const texture = new THREE.Texture(), mesh = caster(), source = new THREE.MeshStandardMaterial();
  let guard = createMaterialMapGuard({ map: texture });
  const release = attachMaterialShadow(mesh, source, () => guard), depth = mesh.customDepthMaterial;
  const harness = shadowHarness(mesh);
  assert.equal(source.map, null);
  assert.equal(harness.render()[0].map, texture, "Guard must populate depth after getDepthMaterial copied null");
  const mappedVersion = depth.version;
  mesh.geometry.deleteAttribute("uv");
  assert.equal(harness.render()[0].map, null);
  assert.equal(source.map, null);
  assert.equal(depth.version, mappedVersion + 1, "Removing the sampler invalidates the mapped depth shader");
  guard = createMaterialMapGuard();
  const unmappedVersion = depth.version;
  harness.render(); assert.equal(depth.version, unmappedVersion);
  release(); harness.dispose(); source.dispose(); texture.dispose();
});

test("same-feature texture identity changes update the uniform without needless variant invalidation", () => {
  const first = new THREE.Texture(), second = new THREE.Texture(), mesh = caster(), source = new THREE.MeshStandardMaterial();
  let guard = createMaterialMapGuard({ map: first });
  const release = attachMaterialShadow(mesh, source, () => guard), depth = mesh.customDepthMaterial;
  const harness = shadowHarness(mesh);
  assert.equal(harness.render()[0].uniformMap, first);
  const version = depth.version;
  guard = createMaterialMapGuard({ map: second });
  assert.equal(harness.render()[0].uniformMap, second);
  assert.equal(depth.version, version);
  first.dispose(); assert.equal(harness.render()[0].uniformMap, second);
  release(); harness.dispose(); source.dispose(); second.dispose();
});

test("private depth keeps Three's source alpha, displacement, clipping and shadow-side state", () => {
  const mesh = caster(), source = new THREE.MeshStandardMaterial(), alpha = new THREE.Texture(), displacement = new THREE.Texture();
  source.alphaMap = alpha; source.alphaTest = .3; source.displacementMap = displacement;
  source.displacementScale = .2; source.displacementBias = -.1; source.side = THREE.DoubleSide;
  source.clipShadows = true; source.clipIntersection = true; source.clippingPlanes = [new THREE.Plane()];
  const release = attachMaterialShadow(mesh, source, () => createMaterialMapGuard()), depth = mesh.customDepthMaterial;
  const harness = shadowHarness(mesh);
  harness.render();
  for (const field of ["alphaMap", "alphaTest", "displacementMap", "displacementScale", "displacementBias", "clipShadows", "clipIntersection", "clippingPlanes"]) {
    assert.equal(depth[field], source[field], field);
  }
  assert.equal(depth.side, THREE.DoubleSide);
  const alphaVersion = depth.version;
  source.alphaTest = .7; harness.render(); assert.equal(depth.version, alphaVersion);
  assert.equal(depth.alphaTest, .7);
  source.alphaTest = 0; harness.render(); assert.equal(depth.version, alphaVersion + 1);
  release(); harness.dispose(); source.dispose(); alpha.dispose(); displacement.dispose();
});

test("attachment preserves preceding callbacks, private lifetime and borrowed resources", () => {
  const mesh = caster(), previous = mesh.material, source = new THREE.MeshStandardMaterial(), texture = new THREE.Texture();
  const order = [];
  const callback = function () { assert.equal(this, mesh); order.push("previous"); };
  mesh.onBeforeShadow = callback;
  const guard = createMaterialMapGuard({ map: texture });
  const release = attachMaterialShadow(mesh, source, () => function (...args) { order.push("guard"); guard.apply(this, args); });
  const depth = mesh.customDepthMaterial, depthDisposals = countDisposals(depth);
  const sourceDisposals = countDisposals(source), textureDisposals = countDisposals(texture);
  const harness = shadowHarness(mesh); harness.render();
  assert.deepEqual(order, ["previous", "guard"]);
  release(); release();
  assert.equal(mesh.material, previous); assert.equal(mesh.customDepthMaterial, undefined); assert.equal(mesh.onBeforeShadow, callback);
  assert.equal(depthDisposals(), 1); assert.equal(sourceDisposals(), 0); assert.equal(textureDisposals(), 0);
  const replay = attachMaterialShadow(mesh, source, () => guard), replayDepth = mesh.customDepthMaterial;
  assert.notEqual(replayDepth, depth);
  replay(); assert.equal(mesh.onBeforeShadow, callback);
  harness.dispose(); source.dispose(); previous.dispose(); texture.dispose();
});

for (const order of ["old-first", "new-first"]) test(`shadow ownership restores only live claims with ${order} cleanup`, () => {
  const mesh = caster(), previous = { material: mesh.material, customDepthMaterial: mesh.customDepthMaterial, onBeforeShadow: mesh.onBeforeShadow };
  const first = new THREE.MeshStandardMaterial(), second = new THREE.MeshStandardMaterial(), guard = createMaterialMapGuard();
  const releaseFirst = attachMaterialShadow(mesh, first, () => guard), firstDepth = mesh.customDepthMaterial;
  const firstCallback = mesh.onBeforeShadow, firstDisposals = countDisposals(firstDepth);
  const releaseSecond = attachMaterialShadow(mesh, second, () => guard), secondDepth = mesh.customDepthMaterial;
  const secondCallback = mesh.onBeforeShadow, secondDisposals = countDisposals(secondDepth);
  if (order === "old-first") {
    releaseFirst(); assert.equal(mesh.material, second); assert.equal(mesh.customDepthMaterial, secondDepth); assert.equal(mesh.onBeforeShadow, secondCallback);
    releaseSecond();
  } else {
    releaseSecond(); assert.equal(mesh.material, first); assert.equal(mesh.customDepthMaterial, firstDepth); assert.equal(mesh.onBeforeShadow, firstCallback);
    releaseFirst();
  }
  assert.equal(mesh.material, previous.material); assert.equal(mesh.customDepthMaterial, previous.customDepthMaterial); assert.equal(mesh.onBeforeShadow, previous.onBeforeShadow);
  assert.equal(firstDisposals(), 1); assert.equal(secondDisposals(), 1);
  mesh.geometry.dispose(); previous.material.dispose(); first.dispose(); second.dispose();
});

test("cleanup preserves unrelated external material, depth and callback changes", () => {
  const mesh = caster(), source = new THREE.MeshStandardMaterial();
  const release = attachMaterialShadow(mesh, source, () => createMaterialMapGuard());
  const depth = mesh.customDepthMaterial, depthDisposals = countDisposals(depth);
  const externalMaterial = new THREE.MeshStandardMaterial(), externalDepth = new THREE.MeshDepthMaterial(), externalCallback = () => {};
  mesh.material = externalMaterial; mesh.customDepthMaterial = externalDepth; mesh.onBeforeShadow = externalCallback;
  release();
  assert.equal(mesh.material, externalMaterial); assert.equal(mesh.customDepthMaterial, externalDepth); assert.equal(mesh.onBeforeShadow, externalCallback);
  assert.equal(depthDisposals(), 1);
  mesh.geometry.dispose(); source.dispose(); externalMaterial.dispose(); externalDepth.dispose();
});

test("an explicit custom depth material retains its callback and disposal ownership", () => {
  const mesh = caster(), previous = mesh.material, source = new THREE.MeshStandardMaterial(), custom = new THREE.MeshDepthMaterial();
  const callback = () => {}, disposed = countDisposals(custom); let guardCalls = 0;
  mesh.customDepthMaterial = custom; mesh.onBeforeShadow = callback;
  const release = attachMaterialShadow(mesh, source, () => { guardCalls++; return createMaterialMapGuard(); });
  assert.equal(mesh.customDepthMaterial, custom); assert.equal(mesh.onBeforeShadow, callback);
  const harness = shadowHarness(mesh); harness.render();
  assert.equal(guardCalls, 0); release();
  assert.equal(mesh.material, previous); assert.equal(mesh.customDepthMaterial, custom); assert.equal(mesh.onBeforeShadow, callback); assert.equal(disposed(), 0);
  harness.dispose(); source.dispose(); previous.dispose(); custom.dispose();
});

test("an explicit custom depth owner introduced between claims is not displaced", () => {
  const mesh = caster(), previous = mesh.material, first = new THREE.MeshStandardMaterial(), second = new THREE.MeshStandardMaterial();
  const originalCallback = mesh.onBeforeShadow, guard = createMaterialMapGuard();
  const releaseFirst = attachMaterialShadow(mesh, first, () => guard), depth = mesh.customDepthMaterial;
  const custom = new THREE.MeshDepthMaterial(), disposed = countDisposals(custom);
  mesh.customDepthMaterial = custom;
  const releaseSecond = attachMaterialShadow(mesh, second, () => guard);
  assert.equal(mesh.customDepthMaterial, custom);
  releaseFirst(); releaseSecond();
  assert.equal(mesh.material, previous); assert.equal(mesh.customDepthMaterial, custom); assert.equal(mesh.onBeforeShadow, originalCallback); assert.equal(disposed(), 0);
  assert.notEqual(custom, depth);
  mesh.geometry.dispose(); first.dispose(); second.dispose(); previous.dispose(); custom.dispose();
});
