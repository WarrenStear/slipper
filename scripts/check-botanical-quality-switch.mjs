import assert from "node:assert/strict";
import { mkdir, symlink, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { chromium } from "@playwright/test";
import { createServer } from "vite";
import react from "@vitejs/plugin-react";
import * as THREE from "three";

// Real R3F reconciliation with stable placements: a fresh-mount geometry test
// cannot detect lost instance transforms when a material tier changes.
const root = process.cwd();
const output = process.env.BOTANICAL_REVIEW_OUT || "/private/tmp/slipper-botanical-quality-switch";
const fixture = resolve(output, "fixture");
const placements = [
  { position: [-2, .1, .7], rotation: [0, .4, .1], scale: .8, color: "#efbcb2" },
  { position: [2, .05, -1], rotation: [.1, -.3, 0], scale: [1.1, .9, 1.2], color: "#bfd3a2" },
];
const snapshots = [];
let server, browser;
try {
  await mkdir(fixture, { recursive: true });
  await symlink(resolve(root, "node_modules"), resolve(fixture, "node_modules"), "dir").catch(error => {
    if (error.code !== "EEXIST") throw error;
  });
  await writeFile(resolve(fixture, "index.html"), '<!doctype html><html><body style="margin:0"><div id="root" style="width:320px;height:240px"></div><script type="module" src="/stage.tsx"></script></body></html>');
  await writeFile(resolve(fixture, "stage.tsx"), `
import React, {useLayoutEffect, useState} from 'react';
import {createRoot} from 'react-dom/client';
import {Canvas, useFrame, useThree} from '@react-three/fiber';
import {BotanicalBatch} from '/@fs/${root}/src/components/three/environmentArt/EnvironmentArt.tsx';
import {TactileDetailProvider} from '/@fs/${root}/src/components/three/storyEvents/TactileMaterial.tsx';
const placements = ${JSON.stringify(placements)};
function Probe({quality}) {
  const {scene, gl} = useThree();
  useLayoutEffect(() => {window.__botanicalQuality = quality;}, [quality]);
  useFrame(() => {window.__botanicalRenderedQuality = quality;});
  useLayoutEffect(() => {
    window.__readBotanical = () => {
      const result = [];
      scene.traverse(mesh => {
        if (!mesh.isInstancedMesh || !mesh.name) return;
        result.push({name:mesh.name, count:mesh.count, geometry:mesh.geometry.uuid,
          triangles:mesh.geometry.index.count/3, matrices:Array.from(mesh.instanceMatrix.array),
          colors:mesh.instanceColor ? Array.from(mesh.instanceColor.array) : null,
          box:mesh.boundingBox?.toArray ? mesh.boundingBox.toArray() : mesh.boundingBox ? [mesh.boundingBox.min.toArray(),mesh.boundingBox.max.toArray()] : null,
          geometryBox:[mesh.geometry.boundingBox.min.toArray(),mesh.geometry.boundingBox.max.toArray()],
          sphere:mesh.boundingSphere ? [...mesh.boundingSphere.center.toArray(),mesh.boundingSphere.radius] : null,
          uploaded:mesh.instanceMatrix.version});
      });
      return {meshes:result.sort((a,b)=>a.name.localeCompare(b.name)), calls:gl.info.render.calls};
    };
    return () => {delete window.__readBotanical;};
  }, [scene, gl]);
  return null;
}
function Fixture() {
  const [quality,setQuality] = useState('medium');
  useLayoutEffect(() => {window.__setBotanicalQuality = setQuality;}, []);
  return <Canvas frameloop="demand" dpr={1} camera={{position:[0,3,7],fov:50}}>
    <ambientLight intensity={1.5}/><directionalLight position={[3,5,4]} intensity={2}/>
    <TactileDetailProvider quality={quality} reducedEffects={false}>
      <BotanicalBatch name="roses" kind="rose" placements={placements}/>
      <BotanicalBatch name="meadow" kind="rose" placements={placements} mergeFoliage/>
    </TactileDetailProvider>
    <Probe quality={quality}/>
  </Canvas>;
}
createRoot(document.getElementById('root')).render(<Fixture/>);
`);
  server = await createServer({
    configFile: false, root: fixture, publicDir: false, cacheDir: resolve(fixture, "vite-cache"),
    plugins: [react()], server: { host: "127.0.0.1", port: 4288, strictPort: true, hmr: false, fs: { allow: [root, output] } },
    resolve: { dedupe: ["react", "react-dom", "three", "@react-three/fiber"] },
    optimizeDeps: { noDiscovery: true, entries: [], include: ["react", "react-dom/client", "three", "@react-three/fiber"] },
  });
  await server.listen();
  browser = await chromium.launch({ args: ["--enable-webgl", "--ignore-gpu-blocklist", "--use-angle=swiftshader"] });
  const page = await browser.newPage({ viewport: { width: 320, height: 240 } });
  const errors = [];
  page.on("pageerror", error => errors.push(error.message));
  page.on("console", message => { if (message.type() === "error") errors.push(message.text()); });
  await page.goto("http://127.0.0.1:4288", { waitUntil: "domcontentloaded" });
  for (const quality of ["medium", "high", "medium"]) {
    await page.waitForFunction(() => typeof window.__setBotanicalQuality === "function");
    await page.evaluate(value => window.__setBotanicalQuality(value), quality);
    await page.waitForFunction(value => window.__botanicalQuality === value && window.__botanicalRenderedQuality === value && typeof window.__readBotanical === "function", quality);
    const snapshot = await page.evaluate(() => window.__readBotanical());
    snapshots.push({ quality, ...snapshot });
    assert.equal(snapshot.meshes.length, 5, "three flower draws plus two merged-foliage draws");
    for (const mesh of snapshot.meshes) {
      assert.equal(mesh.count, placements.length, mesh.name);
      assert.ok(mesh.triangles > 0 && mesh.uploaded > 0, `${quality}: ${mesh.name} has uploaded geometry and matrices`);
      const expectedBounds = new THREE.Box3();
      placements.forEach((placement, index) => {
        const scale = typeof placement.scale === "number" ? new THREE.Vector3().setScalar(placement.scale) : new THREE.Vector3(...placement.scale);
        const transform = new THREE.Matrix4().compose(new THREE.Vector3(...placement.position), new THREE.Quaternion().setFromEuler(new THREE.Euler(...placement.rotation)), scale);
        transform.elements.forEach((value, component) => assert.ok(Math.abs(value - mesh.matrices[index * 16 + component]) < 1e-6, `${quality}: ${mesh.name} retains plant ${index} transform`));
        const localBounds = new THREE.Box3(new THREE.Vector3(...mesh.geometryBox[0]), new THREE.Vector3(...mesh.geometryBox[1]));
        expectedBounds.union(localBounds.applyMatrix4(transform));
        if (mesh.name.endsWith("blossoms")) new THREE.Color(placement.color).toArray().forEach((value, channel) => assert.ok(Math.abs(value - mesh.colors?.[index * 3 + channel]) < 1e-6, `${quality}: ${mesh.name} retains plant ${index} tint`));
      });
      assert.ok(mesh.box && mesh.sphere?.every(Number.isFinite) && mesh.sphere[3] > 0, `${quality}: ${mesh.name} retains finite nonempty bounds`);
      const bounds = new THREE.Box3(new THREE.Vector3(...mesh.box[0]), new THREE.Vector3(...mesh.box[1]));
      assert.ok(!bounds.isEmpty() && bounds.min.distanceTo(expectedBounds.min) < 1e-5 && bounds.max.distanceTo(expectedBounds.max) < 1e-5, `${quality}: ${mesh.name} bounds cover its unchanged placements`);
    }
    assert.deepEqual(errors, [], "browser has no shader or runtime errors");
  }
  const petals = snapshots.map(snapshot => snapshot.meshes.find(mesh => mesh.name === "roses-blossoms"));
  assert.ok(petals[1].triangles > petals[0].triangles, "relief really replaced the base geometry");
  assert.equal(petals[2].triangles, petals[0].triangles, "returning to base restores its geometry budget");
  assert.notEqual(petals[0].geometry, petals[1].geometry);
  assert.notEqual(petals[1].geometry, petals[2].geometry);
  console.log("PASS: botanical base → relief → base preserves all five batches' stable transforms, petal colours, and bounds.");
} finally {
  await browser?.close();
  await server?.close();
  await writeFile(resolve(output, "report.json"), JSON.stringify({ snapshots }, null, 2));
}
