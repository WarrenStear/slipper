import assert from 'node:assert/strict';
import test from 'node:test';
import { terrainScatterRotation, MAX_SCATTER_TILT } from '../src/components/three/environment/terrainScatterRotation.ts';

// Independent matrix composition: XYZ Euler applies Rz, Ry, then Rx to vectors.
function rotate([x, y, z], [rx, ry, rz]) {
  [x, y] = [x * Math.cos(rz) - y * Math.sin(rz), x * Math.sin(rz) + y * Math.cos(rz)];
  [x, z] = [x * Math.cos(ry) + z * Math.sin(ry), -x * Math.sin(ry) + z * Math.cos(ry)];
  [y, z] = [y * Math.cos(rx) - z * Math.sin(rx), y * Math.sin(rx) + z * Math.cos(rx)];
  return [x, y, z];
}
function expectedUp(sx, sz, limit = MAX_SCATTER_TILT) {
  const slope = Math.hypot(sx, sz);
  if (!slope) return [0, 1, 0];
  const tilt = Math.min(Math.atan(slope), limit);
  return [-sx / slope * Math.sin(tilt), Math.cos(tilt), -sz / slope * Math.sin(tilt)];
}
const close = (a, b, tolerance = 1e-6) => a.forEach((value, i) => assert.ok(Math.abs(value - b[i]) < tolerance, `${a} != ${b}`));
const dot = (a, b) => a.reduce((sum, value, i) => sum + value * b[i], 0);

test('flat ground preserves heading and an upright plant', () => {
  for (const yaw of [0, .7, Math.PI / 2, Math.PI, -Math.PI / 2, Math.PI * 12 + .3]) {
    const rotation = terrainScatterRotation(0, 0, yaw);
    close(rotate([0, 1, 0], rotation), [0, 1, 0]);
    close(rotate([0, 0, 1], rotation), [Math.sin(yaw), 0, Math.cos(yaw)]);
  }
});
test('single-axis slopes lean toward the surface normal, not uphill', () => {
  for (const [sx, sz] of [[.2, 0], [-.2, 0], [0, .2], [0, -.2]]) {
    close(rotate([0, 1, 0], terrainScatterRotation(sx, sz, 0)), expectedUp(sx, sz));
  }
});
test('random headings cannot change slope alignment across 600 signed slope cases', () => {
  for (const sx of [-.3, -.1, 0, .1, .3]) for (const sz of [-.3, -.1, 0, .1, .3]) for (let i = 0; i < 24; i++) {
    close(rotate([0, 1, 0], terrainScatterRotation(sx, sz, i * Math.PI / 12)), expectedUp(sx, sz));
  }
});
test('total lean is capped without reversing the direction of the terrain normal', () => {
  for (const [sx, sz] of [[.6, .5], [-2, 8], [100, -100], [.1, .9]]) {
    const up = rotate([0, 1, 0], terrainScatterRotation(sx, sz, 1.37));
    close(up, expectedUp(sx, sz));
    assert.ok(Math.acos(Math.min(1, up[1])) <= MAX_SCATTER_TILT + 1e-7);
    assert.ok(up[0] * sx + up[2] * sz < 0);
  }
});
test('heading rotates the tangent frame without shearing it or changing the normal', () => {
  for (let i = 0; i < 80; i++) {
    const sx = Math.sin(i * 1.7) * .3, sz = Math.cos(i * 2.1) * .3;
    const rotation = terrainScatterRotation(sx, sz, i * .37);
    const right = rotate([1, 0, 0], rotation), up = rotate([0, 1, 0], rotation), forward = rotate([0, 0, 1], rotation);
    close([dot(right, up), dot(up, forward), dot(forward, right)], [0, 0, 0]);
    close([Math.hypot(...right), Math.hypot(...up), Math.hypot(...forward)], [1, 1, 1]);
    close(up, expectedUp(sx, sz));
  }
});
test('quarter-turn and near-gimbal headings retain the correct orientation', () => {
  for (const sx of [0, 1e-10, .2, -.2]) for (const sz of [0, .1, -.1]) for (const sign of [-1, 1]) for (const offset of [-1e-8, 0, 1e-8]) {
    close(rotate([0, 1, 0], terrainScatterRotation(sx, sz, sign * Math.PI / 2 + offset)), expectedUp(sx, sz));
  }
});
test('invalid input never creates non-finite instance rotations', () => {
  for (const value of [NaN, Infinity, -Infinity, Number.MAX_VALUE, -Number.MAX_VALUE]) {
    for (const rotation of [terrainScatterRotation(value, value, value), terrainScatterRotation(.2, -.1, 1, value)]) {
      assert.ok(rotation.every(Number.isFinite));
      assert.ok(rotate([0, 1, 0], rotation)[1] >= Math.cos(Math.PI / 4) - 1e-6);
    }
  }
});
test('a zero or negative tilt limit retains only the local heading', () => {
  for (const limit of [0, -1]) close(terrainScatterRotation(.5, .2, 1.2, limit), [0, 1.2, 0]);
});
test('reproduces and fixes the old mixed-Euler slope error', () => {
  const sx = .3, sz = .2, yaw = Math.PI / 2;
  const old = [Math.atan(sz), yaw, -Math.atan(sx)];
  assert.ok(Math.acos(dot(rotate([0, 1, 0], old), expectedUp(sx, sz))) > .25);
  close(rotate([0, 1, 0], terrainScatterRotation(sx, sz, yaw)), expectedUp(sx, sz));
});
