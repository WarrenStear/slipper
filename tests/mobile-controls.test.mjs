import assert from "node:assert/strict";
import test from "node:test";
import {
  clampLookSensitivity,
  isPortraitViewport,
  resolveJoystickVector,
  resolveLookDelta,
} from "../src/lib/mobileControls.ts";
import { resolveAudioTargetVolume } from "../src/lib/audioVolume.ts";
import {
  RENDER_QUALITY_PROFILES,
  resolveEnvironmentalEffectsProfile,
} from "../src/components/three/renderQuality.ts";
import { resetPlayerInput, usePlayerInputStore } from "../src/stores/usePlayerInputStore.ts";

test("analogue joystick applies a radial dead zone", () => {
  const still = resolveJoystickVector({
    center: { x: 100, y: 100 },
    pointer: { x: 104, y: 103 },
    radius: 50,
    deadZone: 0.15,
  });

  assert.deepEqual(
    { moveX: still.moveX, moveZ: still.moveZ, magnitude: still.magnitude },
    { moveX: 0, moveZ: 0, magnitude: 0 },
  );
});

test("analogue joystick retains direction and proportional speed", () => {
  const partial = resolveJoystickVector({
    center: { x: 100, y: 100 },
    pointer: { x: 125, y: 75 },
    radius: 50,
    deadZone: 0,
  });
  const full = resolveJoystickVector({
    center: { x: 100, y: 100 },
    pointer: { x: 300, y: -100 },
    radius: 50,
    deadZone: 0,
  });

  assert.ok(partial.moveX > 0.49 && partial.moveX < 0.51);
  assert.ok(partial.moveZ > 0.49 && partial.moveZ < 0.51);
  assert.ok(partial.magnitude > 0.7 && partial.magnitude < 0.72);
  assert.equal(full.magnitude, 1);
  assert.ok(Math.hypot(full.moveX, full.moveZ) <= 1.000001);
});

test("touch look input is finite and sensitivity is bounded", () => {
  assert.equal(clampLookSensitivity(Number.NaN), 1);
  assert.equal(clampLookSensitivity(-100), 0.5);
  assert.equal(clampLookSensitivity(100), 1.6);
  assert.deepEqual(
    resolveLookDelta({ deltaX: Number.NaN, deltaY: Number.POSITIVE_INFINITY, sensitivity: 1.2 }),
    { x: 0, y: 0 },
  );
  assert.deepEqual(
    resolveLookDelta({ deltaX: 1_000, deltaY: -1_000, sensitivity: 100 }),
    { x: 72, y: -72 },
  );
});

test("viewport orientation rejects invalid dimensions", () => {
  assert.equal(isPortraitViewport(390, 844), true);
  assert.equal(isPortraitViewport(844, 390), false);
  assert.equal(isPortraitViewport(0, 844), false);
  assert.equal(isPortraitViewport(Number.NaN, 844), false);
});

test("audio volume scales narrative targets and reaches true silence", () => {
  assert.equal(resolveAudioTargetVolume(0.25, 1, true), 0.25);
  assert.equal(resolveAudioTargetVolume(0.25, 0.4, true), 0.1);
  assert.equal(resolveAudioTargetVolume(0.25, 0, true), 0);
  assert.equal(resolveAudioTargetVolume(0.25, 1, false), 0);
  assert.equal(resolveAudioTargetVolume(0.25, Number.NaN, true), 0);
});

test("reduced effects disables animated environment layers without mutating the selected profile", () => {
  const selected = RENDER_QUALITY_PROFILES.cinematic;
  const selectedPathLightMoteCount = selected.pathLightMoteCount;
  const reduced = resolveEnvironmentalEffectsProfile(selected, true);

  assert.equal(resolveEnvironmentalEffectsProfile(selected, false), selected);
  assert.ok(selectedPathLightMoteCount > 0);
  assert.equal(selected.pathLightMoteCount, selectedPathLightMoteCount);
  assert.equal(reduced.pathLightMoteCount, 0);
  assert.equal(reduced.weatherLayerMultiplier, 0);
  assert.equal(reduced.groundDetailMultiplier, 0);
  assert.equal(reduced.particleMultiplier, 0);
  assert.equal(reduced.enableCinematicVignette, false);
  assert.equal(reduced.enableBloomProxies, false);
  assert.equal(reduced.enableLanternShadows, false);
});

test("visual quality tiers add detail progressively while preserving the low-end budget", () => {
  const { low, medium, high, cinematic } = RENDER_QUALITY_PROFILES;

  assert.equal(low.decorationsPerCell, 0);
  assert.ok(medium.decorationsPerCell > low.decorationsPerCell);
  assert.ok(high.treesPerCell >= medium.treesPerCell);
  assert.ok(cinematic.groundDetailMultiplier > high.groundDetailMultiplier);
  assert.ok(cinematic.pathLightMoteCount > medium.pathLightMoteCount);
  assert.equal(high.enableMoonShadows, false);
  assert.equal(cinematic.enableMoonShadows, true);
});

test("transient input store combines movement and look then resets completely", () => {
  const input = usePlayerInputStore.getState();
  input.setMovement(0.4, -0.75);
  input.addLookDelta(12, -8);

  assert.equal(usePlayerInputStore.getState().moveX, 0.4);
  assert.equal(usePlayerInputStore.getState().moveZ, -0.75);
  const lookDelta = { x: 0, y: 0 };
  assert.equal(usePlayerInputStore.getState().consumeLookDelta(lookDelta), lookDelta);
  assert.deepEqual(lookDelta, { x: 12, y: -8 });
  assert.equal(usePlayerInputStore.getState().consumeLookDelta(lookDelta), lookDelta);
  assert.deepEqual(lookDelta, { x: 0, y: 0 });

  usePlayerInputStore.getState().addLookDelta(9, 5);
  resetPlayerInput();
  const reset = usePlayerInputStore.getState();
  assert.deepEqual(
    { moveX: reset.moveX, moveZ: reset.moveZ, lookX: reset.lookX, lookY: reset.lookY },
    { moveX: 0, moveZ: 0, lookX: 0, lookY: 0 },
  );
});
