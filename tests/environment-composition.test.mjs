import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { distantWoodlandLayout } from "../src/components/three/environment/distantWoodlandLayout.ts";
import { getAuthoredSceneArrival } from "../src/cinematics/sceneArrival.ts";

test("distant woodland keeps quality-stable gaps outside the playable chapter footprint", () => {
  const high = distantWoodlandLayout(96);
  assert.deepEqual(distantWoodlandLayout(40), high.slice(0, 40));
  assert.deepEqual(distantWoodlandLayout(64), high.slice(0, 64));
  assert.equal(distantWoodlandLayout(1000).length, 96);
  assert.deepEqual(distantWoodlandLayout(-1), []);
  assert.ok(new Set(high.map(tree => Math.floor(Math.hypot(tree.x, tree.z)))).size > 20,
    "multiple irregular depths must replace a single circular tree wall");
  for (const tree of high) {
    assert.ok(Object.values(tree).every(Number.isFinite));
    assert.ok(Math.max(Math.abs(tree.x), Math.abs(tree.z)) >= 42,
      "distant decoration must not occupy water, furniture or chapter routes");
    assert.ok(tree.height >= 10 && tree.height <= 20);
    assert.ok(tree.width > 0 && tree.crown > 0);
  }
});

test("new arrival compositions face their action through every chapter heading", () => {
  const scenes = ["enchanted.rabbit-hole", "enchanted.friendship-meadow", "enchanted.masked-hearth",
    "blue-moon.sanctuary", "blue-moon.intimacy", "blue-moon.caged-bird", "nest.two-hands",
    "nest.unsupported-cycle", "nest.protection", "sunset.warning-grove", "sunset.true-mirror",
    "sunset.stillness", "thorned.locked-garden", "thorned.old-memory-bedroom",
    "thorned.self-owned-world", "fire.boundary", "river.release-surrender"];
  for (const scene of scenes) {
    const local = getAuthoredSceneArrival(scene, [0, 0, 0], 0);
    assert.equal(local.position[0], 0, `${scene} starts on the authored centre route`);
    assert.ok(local.focus[2] > local.position[2]);
    for (const heading of [0, Math.PI / 2, Math.PI, 4.7]) {
      const world = getAuthoredSceneArrival(scene, [35, 7, -21], heading);
      for (const key of ["position", "focus"]) {
        const x = world[key][0] - 35, z = world[key][2] + 21;
        assert.ok(Math.abs(Math.cos(heading) * x - Math.sin(heading) * z - local[key][0]) < 1e-8);
        assert.ok(Math.abs(Math.sin(heading) * x + Math.cos(heading) * z - local[key][2]) < 1e-8);
        assert.equal(world[key][1], local[key][1] + 7);
      }
    }
  }
  assert.equal(getAuthoredSceneArrival("broken-floor.confession", [0, 0, 0], 0), null,
    "the exact tactile opening retains control of its own camera");
});

test("world prose uses witnessed state and canonical chapters own their foreground", () => {
  const source = readFileSync(new URL("../src/components/three/StoryScene.tsx", import.meta.url), "utf8");
  assert.match(source, /<SpatialProseDirector[^>]*witnessed=\{witnessedEntryIds\.includes\(entry\.id\)\}/);
  assert.doesNotMatch(source, /<SpatialProseDirector[^>]*witnessed=\{visitedEntryIds/);
  assert.match(source, /showClearingFrame=\{openingResolved && !narrativeScene\}/,
    "generic clearing trees must not collide with authored bridge or house geometry");
});
