import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import {
  PLAYER_FOOT_OFFSET, PLAYER_GROUND_CLEARANCE, PLAYER_GROUND_SNAP,
  groundedBodyHeight, playerFrameDelta, requestedMovementMagnitude,
} from "../src/player/playerMovement.ts";
import {
  PLAYER_CAMERA_OFFSET_Y, PLAYER_LOOK_DOWN_LIMIT, PLAYER_LOOK_UP_LIMIT,
  cameraFrameAuthority, cameraHeadBob, cameraLookPitch, resolveCameraArrival,
} from "../src/player/cameraModel.ts";
import { cameraHasAuthority, claimCameraAuthority } from "../src/player/cameraOwnership.ts";
import { resetPlayerKeys, setPlayerKey } from "../src/player/playerInput.ts";
import {
  NODE_ACTIVATION_RADIUS, detectInteractionProximity, observedThresholdEntry,
} from "../src/player/interactionProximity.ts";

const source = path => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("partial analogue travel remains proportional and simultaneous keyboard input stays bounded", () => {
  assert.equal(requestedMovementMagnitude(false, .3, .4), .5);
  assert.equal(requestedMovementMagnitude(false, 0, .08), .08);
  assert.equal(requestedMovementMagnitude(false, 1, 1), 1);
  assert.equal(requestedMovementMagnitude(true, .3, .4), 1);
  assert.equal(requestedMovementMagnitude(false, 0, 0), 0);
});

test("movement frame duration is bounded without accepting invalid physics time", () => {
  for (const delta of [NaN, Infinity, -Infinity, -1, 0]) assert.equal(playerFrameDelta(delta), 0);
  assert.equal(playerFrameDelta(1 / 60), 1 / 60);
  for (const delta of [.25, 1, 10]) assert.equal(playerFrameDelta(delta), .05);
});

test("the terrain guard supports a capsule while the terrain collider is still arriving", () => {
  for (const groundY of [-8, -1.255, 0, 6]) {
    const support = groundY + PLAYER_FOOT_OFFSET + PLAYER_GROUND_CLEARANCE;
    const guarded = groundedBodyHeight({ bodyY: support - .02, groundY, verticalVelocity: -4, grounded: false, moving: false });
    assert.deepEqual(guarded, { bodyY: support, snap: true });
  }
});

test("terrain snap retains descending steps but does not pull a rising or stationary body down", () => {
  const support = PLAYER_FOOT_OFFSET + PLAYER_GROUND_CLEARANCE;
  const input = { bodyY: support + PLAYER_GROUND_SNAP / 2, groundY: 0, verticalVelocity: -1, grounded: false, moving: true };
  assert.deepEqual(groundedBodyHeight(input), { bodyY: support, snap: true });
  assert.deepEqual(groundedBodyHeight({ ...input, verticalVelocity: 2 }), { bodyY: input.bodyY, snap: false });
  assert.deepEqual(groundedBodyHeight({ ...input, moving: false }), { bodyY: input.bodyY, snap: false });
  const high = { ...input, bodyY: support + PLAYER_GROUND_SNAP + .001 };
  assert.deepEqual(groundedBodyHeight(high), { bodyY: high.bodyY, snap: false });
});

test("keyboard aliases share a state and interruption clears every held direction", () => {
  const keys = { forward: false, backward: false, left: false, right: false };
  for (const code of ["KeyW", "ArrowDown", "KeyA", "ArrowRight"]) assert.equal(setPlayerKey(keys, code, true), true);
  assert.ok(Object.values(keys).every(Boolean));
  assert.equal(setPlayerKey(keys, "KeyE", true), false);
  resetPlayerKeys(keys);
  assert.ok(Object.values(keys).every(value => value === false));
  assert.equal(setPlayerKey(keys, "ArrowUp", true), true);
  assert.equal(setPlayerKey(keys, "KeyW", false), true);
  assert.equal(keys.forward, false);
});

const arrival = {
  mode: "explore", controls: "walk", activePosition: [10, 2, 20], playerInitialPosition: [12, 1.5, 23],
  cameraStart: [0, 1, 0], cameraTarget: [0, 0, -1], guidanceLookTarget: [14, -4, 17], lowView: false,
};

test("the floor view receives a low eye and downward focus without knowing a narrative ID", () => {
  const shot = resolveCameraArrival({ ...arrival, lowView: true });
  assert.deepEqual(shot.to, [12, 1.58, 23]);
  assert.ok(Math.abs(shot.focus[1] - .88) < 1e-12);
  assert.ok(Math.abs(Math.hypot(shot.focus[0] - 12, shot.focus[2] - 23) - 2.3) < 1e-10);
});

test("forest arrival retains the eye offset and lifts a terrain-sampled focus to the horizon", () => {
  const shot = resolveCameraArrival(arrival);
  assert.deepEqual(shot.to, [12, 1.5 + PLAYER_CAMERA_OFFSET_Y, 23]);
  assert.deepEqual(shot.focus, [14, shot.to[1] + .12, 17]);
  assert.deepEqual(shot.from, [shot.to[0] + .36, shot.to[1] + .04, shot.to[2] + .65]);
});

test("focused reading receives its own camera origin instead of following a physics body", () => {
  const shot = resolveCameraArrival({ ...arrival, mode: "read" });
  assert.deepEqual(shot.to, [10, 3, 20]);
  assert.deepEqual(shot.focus, [10, 2, 19]);
  assert.deepEqual(shot.from, [10.22, 3.04, 20.65]);
});

test("arrival owns every unsettled frame, including while the body has already mounted", () => {
  for (const progress of [0, .25, .5, .999]) {
    assert.equal(cameraFrameAuthority(progress, true, true), "arrival");
    assert.equal(cameraFrameAuthority(progress, false, true), "arrival");
  }
  assert.equal(cameraFrameAuthority(1, true, true), "player");
  assert.equal(cameraFrameAuthority(1, true, false), "view");
  assert.equal(cameraFrameAuthority(1, false, true), "view");
});

test("touch and mouse look preserve comfortable pitch bounds", () => {
  for (const sensitivity of [.0019, .0032, .0032 * .72]) {
    assert.equal(cameraLookPitch(0, 100000, sensitivity), -PLAYER_LOOK_DOWN_LIMIT);
    assert.equal(cameraLookPitch(0, -100000, sensitivity), PLAYER_LOOK_UP_LIMIT);
    assert.equal(cameraLookPitch(.1, 10, sensitivity), .1 - 10 * sensitivity);
  }
});

test("walking camera motion reaches true stillness for either comfort preference", () => {
  assert.notEqual(cameraHeadBob(Math.PI / 2, 1, 1, false, false), 0);
  assert.equal(cameraHeadBob(Math.PI / 2, 1, 1, true, false), 0);
  assert.equal(cameraHeadBob(Math.PI / 2, 1, 1, false, true), 0);
  assert.equal(cameraHeadBob(Math.PI / 2, 0, 1, false, false), 0);
  assert.equal(cameraHeadBob(Math.PI / 2, 1, .82, false, false), .014 * .82);
});

test("a standalone review camera yields to live ownership and resumes after cleanup", () => {
  const camera = {}, otherCanvas = {};
  const release = claimCameraAuthority(camera);
  assert.equal(cameraHasAuthority(camera), true);
  assert.equal(cameraHasAuthority(otherCanvas), false);
  release();
  assert.equal(cameraHasAuthority(camera), false);
  const nextRelease = claimCameraAuthority(camera);
  release(); // An old cleanup must not remove a newer StrictMode mount.
  assert.equal(cameraHasAuthority(camera), true);
  nextRelease();
  assert.equal(cameraHasAuthority(camera), false);
});

test("overlapping lifecycle claims cannot release another camera owner's guard", () => {
  const camera = {};
  const a = claimCameraAuthority(camera), b = claimCameraAuthority(camera);
  a(); assert.equal(cameraHasAuthority(camera), true);
  b(); assert.equal(cameraHasAuthority(camera), false);
});

test("physical proximity reports horizontal range and no progression interpretation", () => {
  const targets = [{ id: "a", position: [0, -100, 0], active: true }, { id: "b", position: [3, 80, 4], active: false }];
  const facts = detectInteractionProximity(targets, [0, 10, 0], .5, 8.8);
  assert.equal(facts.nearest.id, "a");
  assert.equal(facts.nearestInactive.id, "b");
  assert.equal(facts.nearestInactive.distance, 5);
  assert.equal(facts.insideClearing, true);
  assert.equal(facts.active.id, "a");
  assert.equal(facts.cameraYaw, .5);
  assert.deepEqual(facts.playerPosition, [0, 10, 0]);
  assert.deepEqual(detectInteractionProximity([], [0, 0, 0], 0, 8.8), {
    active: null, nearest: null, nearestInactive: null, playerPosition: [0, 0, 0], cameraYaw: 0, insideClearing: false,
  });
});

test("threshold observations have exact reach and hysteresis without deciding story access", () => {
  const at = distance => ({ id: "b", active: false, position: [0, 0, 0], distance, distanceSq: distance * distance });
  assert.deepEqual(observedThresholdEntry(at(NODE_ACTIVATION_RADIUS), null), { enteredId: "b", lastEnteredId: "b" });
  assert.deepEqual(observedThresholdEntry(at(0), "b"), { enteredId: null, lastEnteredId: "b" });
  assert.deepEqual(observedThresholdEntry(at(NODE_ACTIVATION_RADIUS * 1.4), "b"), { enteredId: null, lastEnteredId: "b" });
  assert.deepEqual(observedThresholdEntry(at(NODE_ACTIVATION_RADIUS * 1.6), "b"), { enteredId: null, lastEnteredId: null });
  assert.equal(observedThresholdEntry(at(NODE_ACTIVATION_RADIUS + .01), null).enteredId, null);
});

test("the physical controllers depend on observed facts and numeric tuning only", () => {
  for (const path of ["src/player/PlayerController.tsx", "src/player/InteractionController.tsx", "src/player/interactionProximity.ts"]) {
    assert.doesNotMatch(source(path), /useJourneyStore|journeyNarrative|journeyProgression|completedRitualIds|storyObjectStates|dispatchStoryEvent|fragment-001/);
  }
  assert.match(source("src/player/PlayerController.tsx"), /movementSpeed\(\)/);
  assert.doesNotMatch(source("src/player/PlayerController.tsx"), /camera\.(?:position|quaternion)\.(?:set|copy|lerp|rotateTowards)/);
});

test("the camera frame runs after movement and canonical lighting mounts no second camera", () => {
  const camera = source("src/player/CameraController.tsx");
  const player = source("src/player/PlayerController.tsx");
  assert.equal((camera.match(/useFrame\(/g) ?? []).length, 1);
  assert.match(player, /\}, -2\)/);
  assert.match(camera, /\}, -1\)/);
  assert.match(camera, /if \(hasInitialisedRef\.current\) \{ cameraReadyRef\.current = progressRef\.current >= 1/);
  assert.match(camera, /if \(!inputActive\(\)\)[\s\S]*consumeLookDelta/);
  assert.doesNotMatch(source("src/components/three/artDirection/SceneLookDirector.tsx"), /<CinematicCameraDirector\b/);
  assert.doesNotMatch(source("src/player/useCameraAssistance.ts"), /useFrame|useJourneyStore|useWorldStore/);
});
