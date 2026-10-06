import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { bindSceneAtmosphere } from "../src/world/atmosphere/atmosphereOwnership.ts";
import { sceneParticleCount, sceneParticlePositions, sceneParticleRegion } from "../src/world/atmosphere/sceneParticleModel.ts";
import { scenePresentationActive } from "../src/world/presentationActivity.ts";
import { advanceSceneMotion } from "../src/components/three/artDirection/sceneMotion.ts";
import { resolveSceneLook } from "../src/components/three/artDirection/SceneLookRegistry.ts";
import { RENDER_QUALITY_PROFILES } from "../src/components/three/renderQuality.ts";
import { openingEnclosed } from "../src/cinematics/openingPresentation.ts";

const baseline = JSON.parse(readFileSync(new URL("./fixtures/presentation-consolidation-baseline.json", import.meta.url), "utf8"));
const attending = { visible: true, focused: true, overlayOpen: false, mode: "explore", physicsPaused: false };
const movingFrame = look => ({ stillness: Number(look.stillness), motion: { ...look.motion }, time: { vegetation: 0, cloth: 0, water: 0, particles: 0, flame: 0 } });

test("canonical particles preserve every pre-consolidation scene and quality count", () => {
  assert.equal(baseline.counts.length, 32 * 4 * 2);
  for (const { id, quality, reduced, count } of baseline.counts) {
    const look = resolveSceneLook(id, quality, reduced);
    assert.equal(sceneParticleCount(look.particles.count, RENDER_QUALITY_PROFILES[quality].particleMultiplier, true, reduced, id), count, `${id} ${quality} reduced=${reduced}`);
  }
});

test("canonical particles retain the pre-consolidation Float32 positions and quality prefixes", () => {
  for (const { kind, points } of baseline.regions) {
    const region = sceneParticleRegion(kind);
    assert.deepEqual(Array.from(sceneParticlePositions(56, region)), points, kind);
    for (const count of [1, 7, 18, 30, 42]) {
      assert.deepEqual(Array.from(sceneParticlePositions(count, region)), points.slice(0, count * 3));
    }
  }
});

test("particle eligibility retains the wrapper's lantern-based opening rule and terminal gates", () => {
  const count = enabled => sceneParticleCount(42, 1, enabled, false, "enchanted.rabbit-hole");
  assert.equal(count(!openingEnclosed("broken-floor.confession", false)), 0);
  assert.equal(count(!openingEnclosed("broken-floor.confession", true)), 42);
  assert.equal(count(false), 0, "Map mode disables ambient particles");
  assert.equal(sceneParticleCount(42, 1, true, true, "enchanted.rabbit-hole"), 0);
  assert.equal(sceneParticleCount(42, 1, true, false, "epilogue.constellation"), 0);
  for (const scale of [0, -1, NaN, Infinity]) assert.equal(sceneParticleCount(42, scale, true, false, "enchanted.rabbit-hole"), 0);
  assert.equal(sceneParticleCount(200, 4, true, false, "enchanted.rabbit-hole"), 56);
});

for (const [label, interrupted] of Object.entries({
  hidden: { visible: false }, unfocused: { focused: false }, settings: { overlayOpen: true },
  reading: { mode: "read" }, map: { mode: "map" }, physics: { physicsPaused: true },
})) test(`shared presentation clocks stop while ${label} and resume without catch-up`, () => {
  const look = resolveSceneLook("blue-moon.sanctuary", "high");
  const frame = movingFrame(look);
  assert.equal(scenePresentationActive(attending), true);
  const snapshot = structuredClone(frame);
  for (let i = 0; i < 100; i++) {
    const dt = advanceSceneMotion(frame, look, 30, scenePresentationActive({ ...attending, ...interrupted }), false, false);
    assert.equal(dt, 0);
  }
  assert.deepEqual(frame, snapshot);
  const resumed = advanceSceneMotion(frame, look, 30, scenePresentationActive(attending), false, false);
  assert.equal(resumed, .05);
  const expected = movingFrame(look);
  advanceSceneMotion(expected, look, .05, true, false, false);
  assert.deepEqual(frame, expected);
});

test("atmosphere cleanup restores the previous values and supports StrictMode replay", () => {
  const previous = { background: { name: "texture" }, fog: { name: "previous fog" } };
  const scene = { ...previous }, background = {}, fog = {};
  const cleanup = bindSceneAtmosphere(scene, background, fog);
  assert.equal(scene.background, background); assert.equal(scene.fog, fog);
  cleanup(); cleanup();
  assert.deepEqual(scene, previous);
  const replay = bindSceneAtmosphere(scene, background, fog);
  replay(); assert.deepEqual(scene, previous);
});

test("stale atmosphere cleanup cannot displace a newer live owner or restore a dead owner", () => {
  const previous = { background: {}, fog: {} }, scene = { ...previous };
  const first = { background: {}, fog: {} }, second = { background: {}, fog: {} };
  const releaseFirst = bindSceneAtmosphere(scene, first.background, first.fog);
  const releaseSecond = bindSceneAtmosphere(scene, second.background, second.fog);
  releaseFirst(); assert.deepEqual(scene, second);
  releaseSecond(); assert.deepEqual(scene, previous);
});

test("a nested atmosphere releases to the still-live owner, preserving unrelated external changes", () => {
  const previous = { background: {}, fog: {} }, scene = { ...previous };
  const first = { background: {}, fog: {} }, second = { background: {}, fog: {} };
  const releaseFirst = bindSceneAtmosphere(scene, first.background, first.fog);
  const releaseSecond = bindSceneAtmosphere(scene, second.background, second.fog);
  releaseSecond(); assert.deepEqual(scene, first);
  const externalBackground = {}; scene.background = externalBackground;
  releaseFirst(); assert.equal(scene.background, externalBackground); assert.equal(scene.fog, previous.fog);
});
