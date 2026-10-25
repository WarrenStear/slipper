import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { createPhysicalRouteGeometry } from "../src/lib/physicalPathGeometry.ts";
import { normalizeGeneratedWorldState } from "../src/data/worldStateNormalization.ts";
import { buildMazePathSegments } from "../src/world/terrain/worldPaths.ts";
import { buildPathSegments } from "../src/workers/pathWorker.ts";

const source = path => readFileSync(new URL(path, import.meta.url), "utf8");
const entries = normalizeGeneratedWorldState(
  JSON.parse(source("../src/data/worldState.json")),
).entries;

test("physical route math yields deterministic finite woodland and crown geometry", () => {
  const a = { x: -8, y: -354 }, b = { x: -6, y: -306 };
  for (const crownRamp of [false, true]) {
    const first = createPhysicalRouteGeometry(a, b, 72341, crownRamp);
    const second = createPhysicalRouteGeometry(a, b, 72341, crownRamp);
    assert.deepEqual(first, second);
    assert.ok(first.curveLength > 45 && first.curveLength < 54);
    assert.ok([...Object.values(first.controlA), ...Object.values(first.controlB), first.curveLength].every(Number.isFinite));
  }
});

test("worker output matches scene terrain geometry on every canonical and scenic route", () => {
  const scene = buildMazePathSegments(entries);
  const worker = buildPathSegments(entries);
  assert.equal(scene.length, 68);
  assert.equal(worker.length, scene.length);
  for (let index = 0; index < scene.length; index++) {
    const a = scene[index], b = worker[index];
    assert.equal(a.key, b.key, `path order mismatch at ${index}`);
    assert.equal(a.sourceEntry.id, b.sourceEntryId);
    assert.equal(a.targetEntry.id, b.targetEntryId);
    for (const field of ["source", "controlA", "controlB", "target"]) {
      assert.ok(Math.abs(a[field].x - b[field].x) < 1e-8, `${b.key} ${field}.x must be aligned`);
      assert.ok(Math.abs(a[field].y - b[field].y) < 1e-8, `${b.key} ${field}.y must be aligned`);
    }
    assert.ok(Math.abs(a.curveLength - b.curveLength) < 1e-8, `${b.key} route length mismatch`);
  }
});

test("the forest scene, map and worker consume one shared physical path contract", () => {
  for (const path of [
    "../src/world/terrain/worldPaths.ts",
    "../src/world/terrain/worldPaths.ts",
    "../src/workers/pathWorker.ts",
  ]) {
    const code = source(path);
    assert.match(code, /createPhysicalRouteGeometry\(/);
    assert.doesNotMatch(code, /const bendLimit = crownRamp/);
    assert.doesNotMatch(code, /Math\.min\(22, length \* 0\.24\)/);
  }
});
