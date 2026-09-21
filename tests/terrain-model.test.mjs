import assert from "node:assert/strict";
import test from "node:test";
import {
  createTerrainSurfaceSampler,
  sampleTerrainElevation,
  terrainCurvedPathPointAt,
  terrainCurvedPathTangentAt,
  terrainPathProjectionT,
} from "../src/lib/terrainModel.ts";

const path = {
  source: [-24, -10],
  controlA: [-8, 18],
  controlB: [12, -16],
  target: [28, 12],
  curveSeed: 0.371,
  curveLength: 72,
  sourceChapter: "The First Wood",
  targetChapter: "The Mirror Clearing",
  sourceY: 0,
  targetY: 0,
  crownRamp: false,
};

const config = {
  clearingSafeRadius: 11.8,
  corridorBaseWidth: 9.4,
  crownedRampWidth: 12,
  explorationDepth: 0.64,
  memoryPressure: 0.57,
  clearings: [
    {
      id: "clearing",
      chapter: "The First Wood",
      position: [0, 0, 0],
    },
  ],
  paths: [path],
};

function expectedTriangleHeight(x, z, size, segments) {
  const half = size * 0.5;
  const cell = size / segments;
  const normalizedX = (Math.max(-half, Math.min(half, x)) + half) / cell;
  const normalizedZ = (Math.max(-half, Math.min(half, z)) + half) / cell;
  const column = Math.min(segments - 1, Math.max(0, Math.floor(normalizedX)));
  const row = Math.min(segments - 1, Math.max(0, Math.floor(normalizedZ)));
  const u = Math.max(0, Math.min(1, normalizedX - column));
  const v = Math.max(0, Math.min(1, normalizedZ - row));
  const heightAt = (gridX, gridZ) =>
    Math.fround(
      sampleTerrainElevation(
        -half + gridX * cell,
        -half + gridZ * cell,
        config,
      ),
    );
  const a = heightAt(column, row);
  const b = heightAt(column, row + 1);
  const c = heightAt(column + 1, row + 1);
  const d = heightAt(column + 1, row);

  return u + v <= 1
    ? a + (d - a) * u + (b - a) * v
    : c + (b - c) * (1 - u) + (d - c) * (1 - v);
}

test("surface sampler follows both PlaneGeometry triangle diagonals", () => {
  const size = 80;
  const segments = 8;
  const sampleSurface = createTerrainSurfaceSampler(config, size, segments);
  const points = [
    [-40, -40],
    [40, 40],
    [-13.75, -6.25],
    [-11.25, -3.75],
    [4.999, 5.001],
    [17.2, -22.8],
    [0, 0],
  ];

  for (const [x, z] of points) {
    assert.ok(
      Math.abs(
        sampleSurface(x, z) -
          expectedTriangleHeight(x, z, size, segments),
      ) < 1e-12,
      `surface mismatch at ${x}, ${z}`,
    );
  }
});

test("surface sampling is deterministic, finite, and bounded off crown ramps", () => {
  const sampleSurface = createTerrainSurfaceSampler(config, 860, 128);
  for (let index = 0; index < 120; index += 1) {
    const x = -390 + ((index * 47.31) % 780);
    const z = -390 + ((index * 83.17) % 780);
    const first = sampleSurface(x, z);
    const second = sampleSurface(x, z);
    assert.equal(first, second);
    assert.ok(Number.isFinite(first));
    assert.ok(first >= -0.240001);
    assert.ok(first <= 0.580001);
  }
});

test("curve, tangent, and projection share one morph-aware path model", () => {
  const base = terrainCurvedPathPointAt(path, 0.42);
  const belowMorphThreshold = terrainCurvedPathPointAt(path, 0.42, {
    explorationDepth: 0.01,
    memoryPressure: 0.01,
  });
  const morphed = terrainCurvedPathPointAt(path, 0.42, {
    explorationDepth: 0.64,
    memoryPressure: 0.57,
  });
  assert.deepEqual(belowMorphThreshold, base);
  assert.ok(Math.hypot(morphed[0] - base[0], morphed[1] - base[1]) > 0.1);

  const tangent = terrainCurvedPathTangentAt(path, 0.42, config);
  assert.ok(Math.abs(Math.hypot(tangent[0], tangent[1]) - 1) < 1e-10);

  const projectedT = terrainPathProjectionT(
    morphed[0],
    morphed[1],
    path,
    config,
  );
  assert.ok(Math.abs(projectedT - 0.42) < 0.01);
});

test("crowned paths cannot lift an earlier clearing sanctuary", () => {
  const crownPath = {
    source: [-50, 0],
    controlA: [-20, 0],
    controlB: [20, 0],
    target: [50, 0],
    curveSeed: 0.2,
    curveLength: 100,
    sourceChapter: "The Crowned Return",
    targetChapter: "The Crowned Return",
    sourceY: 6,
    targetY: 6,
    crownRamp: true,
  };
  const sanctuaryConfig = {
    ...config,
    explorationDepth: 0,
    memoryPressure: 0,
    paths: [crownPath],
  };

  assert.ok(sampleTerrainElevation(0, 0, sanctuaryConfig) < 0.2);
  assert.ok(sampleTerrainElevation(30, 0, sanctuaryConfig) > 5.5);
});

test("non-sequential crown return links stay navigable without raising crossed terrain", () => {
  const returnLink = {
    source: [-50, 0],
    controlA: [-20, 0],
    controlB: [20, 0],
    target: [50, 0],
    curveSeed: 0.2,
    curveLength: 100,
    sourceChapter: "The Crowned Return",
    targetChapter: "The First Wood",
    sourceY: 6,
    targetY: 0,
    crownRamp: false,
    minX: -74,
    maxX: 74,
    minZ: -24,
    maxZ: 24,
  };
  const returnConfig = {
    ...config,
    explorationDepth: 0.32,
    memoryPressure: 0.55,
    paths: [returnLink],
  };
  const sampleSurface = createTerrainSurfaceSampler(returnConfig, 860, 128);

  for (const x of [-24, -8, 0, 8, 24]) {
    assert.ok(sampleTerrainElevation(x, 0, returnConfig) < 0.6);
    assert.ok(sampleSurface(x, 0) < 0.6);
  }
});
