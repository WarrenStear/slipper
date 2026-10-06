import assert from "node:assert/strict";
import test from "node:test";
import { createPhysicalObservationPort, PHYSICAL_INPUT_IDLE_MS, PHYSICAL_POSE_MAX_AGE_MS,
  PHYSICAL_STILL_LINEAR_SPEED, PHYSICAL_STILL_ANGULAR_SPEED } from "../src/player/physicalObservation.ts";

const sample = (observedAtMs, x = 0, angle = 0, overrides = {}) => ({ observedAtMs, position: [x, 0, 0],
  quaternion: [0, Math.sin(angle / 2), 0, Math.cos(angle / 2)], inputEnabled: true, settled: true, ...overrides });
const setup = () => { const port = createPhysicalObservationPort(), lease = {}; assert.equal(port.bind(lease, 0), true); return { port, lease }; };
const prime = (port, lease, now = 500) => { port.publish(lease, sample(now)); port.publish(lease, sample(now + 75)); };
const close = (a, b, tolerance = 1e-9) => assert.ok(Math.abs(a-b) < tolerance, `${a} != ${b}`);

test("historical fixed displacement admits three different speeds while the normalized contract is explicit", () => {
  const actual = [];
  for (const fps of [30, 60, 120]) {
    let accumulated = 0, frames = 0;
    while (accumulated < .075) { accumulated += 1 / fps; frames++; }
    actual.push({ fps, frames, window: accumulated, limit: .03 / accumulated });
  }
  assert.deepEqual(actual.map(row => row.frames), [3, 5, 9]);
  actual.forEach((row, i) => close(row.limit, [.3, .36, .4][i]));
  assert.equal(PHYSICAL_STILL_LINEAR_SPEED, .4);
  close(PHYSICAL_STILL_ANGULAR_SPEED, .33731186585582046);
});

test("the same linear and angular trajectories admit the same physical attention at 30/60/120Hz", () => {
  for (const [speed, turn, eligible] of [[0, 0, true], [.38, .31, true], [.42, 0, false], [0, .36, false]]) {
    for (const fps of [30, 60, 120]) {
      const { port, lease } = setup();
      for (let frame = 0; frame <= fps * 2; frame++) {
        const now = frame * 1000 / fps; port.publish(lease, sample(now, speed * now / 1000, turn * now / 1000));
      }
      const facts = port.read(lease, 2000); close(facts.linearSpeed, speed); close(facts.angularSpeed, turn, 1e-7);
      assert.equal(facts.stillEligible, eligible, `${speed}/${turn} at ${fps}Hz`);
    }
  }
});

test("the first pose and arrival or unavailable input never manufacture physical stillness", () => {
  const { port, lease } = setup();
  assert.equal(port.read(lease, 500).available, false);
  port.publish(lease, sample(500)); assert.equal(port.read(lease, 500).stillEligible, false);
  port.publish(lease, sample(575)); assert.equal(port.read(lease, 575).stillEligible, true);
  port.publish(lease, sample(650, 0, 0, { settled: false })); assert.equal(port.read(lease, 650).stillEligible, false);
  port.publish(lease, sample(725)); assert.equal(port.read(lease, 725).stillEligible, false);
  port.publish(lease, sample(800)); assert.equal(port.read(lease, 800).stillEligible, true);
  port.publish(lease, sample(875, 0, 0, { inputEnabled: false })); assert.equal(port.read(lease, 875).stillEligible, false);
});

test("every held key blocks attention and repeated keydown does not create stuck counts", () => {
  for (const code of ["KeyW", "ArrowRight", "KeyE", "ShiftLeft", "UnmappedKey", ""]) {
    const { port, lease } = setup(); prime(port, lease);
    port.key(lease, code, true, 580); port.key(lease, code, true, 590);
    assert.equal(port.read(lease, 600).heldKeys, 1); assert.equal(port.read(lease, 600).stillEligible, false);
    port.key(lease, code, false, 610);
    assert.equal(port.read(lease, 610).heldKeys, 0);
    assert.equal(port.read(lease, 610 + PHYSICAL_INPUT_IDLE_MS).stillEligible, false);
    assert.equal(port.read(lease, 611 + PHYSICAL_INPUT_IDLE_MS).stillEligible, true);
  }
});

test("multiple pointers block independently and ending a joystick finger does not release a look finger", () => {
  const { port, lease } = setup(); prime(port, lease);
  port.pointer(lease, 1, true, 600); port.pointer(lease, 2, true, 605);
  assert.equal(port.read(lease, 610).heldPointers, 2); assert.equal(port.read(lease, 610).stillEligible, false);
  port.pointer(lease, 1, false, 615); assert.equal(port.read(lease, 620).heldPointers, 1);
  assert.equal(port.read(lease, 1000).stillEligible, false);
  port.pointer(lease, 2, false, 1010); assert.equal(port.read(lease, 1360).stillEligible, false);
  assert.equal(port.read(lease, 1361).stillEligible, true);
});

test("quaternion sign, non-unit length and shortest arc do not invent a turn", () => {
  const { port, lease } = setup();
  port.publish(lease, sample(500, 0, .4));
  const orientation = sample(575, 0, .4).quaternion.map(value => -value * 7);
  port.publish(lease, sample(575, 0, 0, { quaternion: orientation }));
  close(port.read(lease, 575).angularSpeed, 0, 1e-6);
  port.publish(lease, sample(650, 0, Math.PI - .01)); port.publish(lease, sample(725, 0, -Math.PI + .01));
  close(port.read(lease, 725).angularDisplacement, .02, 1e-9);
});

test("freshness expires independently of the render loop and backwards reader time cannot admit attention", () => {
  const { port, lease } = setup(); prime(port, lease);
  assert.equal(port.read(lease, 575 + PHYSICAL_POSE_MAX_AGE_MS).fresh, true);
  assert.equal(port.read(lease, 576 + PHYSICAL_POSE_MAX_AGE_MS).fresh, false);
  assert.equal(port.read(lease, 576 + PHYSICAL_POSE_MAX_AGE_MS).stillEligible, false);
  for (const now of [574, NaN, Infinity, -1]) assert.equal(port.read(lease, now).stillEligible, false);
});

test("invalid, repeated, backwards and stalled publisher times re-prime instead of donating attention", () => {
  for (const invalid of [NaN, Infinity, -1, 575, 574, 90000]) {
    const { port, lease } = setup(); prime(port, lease);
    port.publish(lease, sample(invalid)); assert.equal(port.read(lease, Math.max(600, invalid)).stillEligible, false);
  }
  const { port, lease } = setup(); prime(port, lease);
  port.publish(lease, sample(90000)); port.publish(lease, sample(90075));
  assert.equal(port.read(lease, 90075).stillEligible, true);
  // The clock's existing valid one-second sample is retained.
  port.publish(lease, sample(91075)); assert.equal(port.read(lease, 91075).available, true);
});

test("malformed positions and orientations cannot create finite-looking eligibility", () => {
  for (const overrides of [{ position: [NaN, 0, 0] }, { position: [Infinity, 0, 0] }, { position: [0, 0] },
    { quaternion: [0, 0, 0, 0] }, { quaternion: [NaN, 0, 0, 1] }, { quaternion: [0, 0, 1] }]) {
    const { port, lease } = setup(); prime(port, lease);
    assert.equal(port.publish(lease, sample(650, 0, 0, overrides)), false);
    assert.equal(port.read(lease, 650).stillEligible, false);
  }
  const { port, lease } = setup();
  port.publish(lease, sample(500, 0, 0, { quaternion: [Number.MAX_VALUE, 0, 0, Number.MAX_VALUE] }));
  port.publish(lease, sample(575, 0, 0, { quaternion: [Number.MIN_VALUE, 0, 0, Number.MIN_VALUE] }));
  assert.equal(port.read(lease, 575).available, true); close(port.read(lease, 575).angularSpeed, 0, 1e-6);
});

test("suspension cancels held inputs, primes resumed pose and preserves a fresh 350ms idle interval", () => {
  const { port, lease } = setup(); prime(port, lease);
  port.key(lease, "KeyW", true, 600); port.pointer(lease, 1, true, 601);
  port.suspend(lease, 610); const paused = port.read(lease, 620);
  assert.equal(paused.heldKeys, 0); assert.equal(paused.heldPointers, 0); assert.equal(paused.stillEligible, false);
  port.publish(lease, sample(630)); assert.equal(port.read(lease, 630).stillEligible, false);
  port.publish(lease, sample(705)); assert.equal(port.read(lease, 960).stillEligible, false);
  assert.equal(port.read(lease, 961).stillEligible, true);
});

test("a replacement scene lease rejects all old callbacks, cleanup and reads", () => {
  const { port, lease: old } = setup(); prime(port, old);
  const next = {}; port.bind(next, 700); prime(port, next, 1050);
  const before = port.read(next, 1125);
  assert.equal(port.publish(old, sample(1200, 40)), false); assert.equal(port.key(old, "KeyW", true, 1200), false);
  assert.equal(port.pointer(old, 2, true, 1200), false); assert.equal(port.suspend(old, 1200), false); assert.equal(port.release(old), false);
  assert.equal(port.read(old, 1200), null); assert.deepEqual(port.read(next, 1125), before);
  assert.equal(port.release(next), true); assert.equal(port.release(next), false); assert.equal(port.read(next, 1125), null);
});

test("reading does not advance or duplicate a physical revision and input sources never consume look deltas", () => {
  const { port, lease } = setup(); prime(port, lease);
  const first = port.read(lease, 575), later = port.read(lease, 600);
  assert.equal(first.revision, later.revision); assert.equal(first.observedAtMs, later.observedAtMs);
  assert.equal(first.dtMs, later.dtMs); assert.equal(first.linearSpeed, later.linearSpeed);
  // No input store or destructive consume API exists in this renderer-free port.
  assert.equal(port.consumeLookDelta, undefined); assert.equal(port.dispatch, undefined);
});

test("observations own numeric copies rather than borrowed camera arrays or mutable reader snapshots", () => {
  const { port, lease } = setup(), first = sample(500, 2, .3), next = sample(575, 2, .3);
  port.publish(lease, first); port.publish(lease, next);
  next.position[0] = 40; next.quaternion[0] = 90;
  const facts = port.read(lease, 575); assert.equal(facts.position[0], 2); assert.equal(facts.quaternion[0], 0);
  close(Math.hypot(...facts.quaternion), 1);
  facts.position[0] = -70; facts.quaternion[0] = 50;
  assert.equal(port.read(lease, 575).position[0], 2); assert.equal(port.read(lease, 575).quaternion[0], 0);
});

test("unknown time is explicit and overflowing displacement cannot poison numeric facts", () => {
  const { port, lease } = setup(); assert.equal(port.read(lease, 500).observedAtMs, null);
  port.publish(lease, sample(500, -Number.MAX_VALUE)); port.publish(lease, sample(575, Number.MAX_VALUE));
  const facts = port.read(lease, 575); assert.equal(facts.available, false); assert.equal(facts.stillEligible, false);
  for (const field of ["dtMs", "displacement", "angularDisplacement", "linearSpeed", "angularSpeed", "idleMs"]) assert.ok(Number.isFinite(facts[field]));
});
