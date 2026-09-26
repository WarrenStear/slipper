import assert from "node:assert/strict";
import test from "node:test";
import {
  buildForest,
  selectForestColliders,
} from "../src/workers/forestWorker.ts";

const ARCHIVE_CHAPTER = "The Blue Moon Archive";

function colliderCandidate({
  id,
  cellKey,
  distanceSq,
  edgeWall = false,
  ridgeWall = false,
  mazeEdgeInfluence = 0,
  marker,
}) {
  return {
    id,
    cellKey,
    distanceSq,
    edgeWall,
    ridgeWall,
    mazeEdgeInfluence,
    collider: {
      position: [marker, 0, 0],
      args: [0.5, 1, 0.5],
    },
  };
}

function archiveForestConfig() {
  const archivePath = {
    source: [-32, 0],
    controlA: [-12, 0],
    controlB: [12, 0],
    target: [32, 0],
    curveSeed: 0.37,
    curveLength: 64,
    sourceChapter: ARCHIVE_CHAPTER,
    targetChapter: ARCHIVE_CHAPTER,
    sourceY: 0,
    targetY: 0,
    crownRamp: false,
    minX: -40,
    maxX: 40,
    minZ: -8,
    maxZ: 8,
  };

  return {
    cellSize: 7,
    cellRadius: 4,
    treesPerCell: 3,
    instanceCount: 243,
    clearingSafeRadius: 7.2,
    corridorBaseWidth: 5.2,
    corridorMinWidth: 3.6,
    treeColliderLimit: 36,
    terrainBaseY: -1.255,
    terrainColliderY: -1.34,
    terrainSize: 120,
    terrainSegments: 32,
    crownedRampWidth: 12,
    cameraX: 0,
    cameraZ: 0,
    cellX: 0,
    cellZ: 0,
    explorationDepth: 0.5,
    memoryPressure: 0.4,
    forestDensity: 1,
    pathClarity: 0.86,
    clearings: [
      {
        id: "archive-clearing",
        chapter: ARCHIVE_CHAPTER,
        position: [0, 0, 0],
      },
    ],
    paths: [archivePath],
  };
}

test("collider selection favors authored wall samples and is order independent", () => {
  const candidates = [
    colliderCandidate({
      id: "ridge",
      cellKey: "0:0",
      distanceSq: 4,
      ridgeWall: true,
      mazeEdgeInfluence: 0.2,
      marker: 1,
    }),
    colliderCandidate({
      id: "edge",
      cellKey: "1:0",
      distanceSq: 6,
      edgeWall: true,
      mazeEdgeInfluence: 0.8,
      marker: 2,
    }),
    colliderCandidate({
      id: "edge-and-ridge",
      cellKey: "2:0",
      distanceSq: 7,
      edgeWall: true,
      ridgeWall: true,
      mazeEdgeInfluence: 0.9,
      marker: 3,
    }),
  ];

  const selected = selectForestColliders(candidates, 2, 10);
  const reversed = selectForestColliders([...candidates].reverse(), 2, 10);

  assert.deepEqual(selected, reversed);
  assert.deepEqual(
    selected.map((collider) => collider.position[0]),
    [3, 2],
  );
});

test("collider selection distributes its bounded budget across forest cells", () => {
  const candidates = [
    colliderCandidate({ id: "a1", cellKey: "0:0", distanceSq: 9, edgeWall: true, marker: 1 }),
    colliderCandidate({ id: "a2", cellKey: "0:0", distanceSq: 10, edgeWall: true, marker: 2 }),
    colliderCandidate({ id: "a3", cellKey: "0:0", distanceSq: 11, edgeWall: true, marker: 3 }),
    colliderCandidate({ id: "b1", cellKey: "1:0", distanceSq: 12, ridgeWall: true, marker: 4 }),
    colliderCandidate({ id: "b2", cellKey: "1:0", distanceSq: 13, ridgeWall: true, marker: 5 }),
  ];

  const selectedMarkers = selectForestColliders(candidates, 4, 10).map(
    (collider) => collider.position[0],
  );

  assert.equal(selectedMarkers.length, 4);
  assert.deepEqual(new Set(selectedMarkers), new Set([1, 2, 4, 5]));
  assert.ok(!selectedMarkers.includes(3), "one decorative cluster must not consume the collision budget");
});

test("the Archive retains a deterministic, traversable, physically bounded forest maze", () => {
  const config = archiveForestConfig();
  const request = { type: "BUILD_FOREST", requestId: 17, config };
  const result = buildForest(request);
  const repeated = buildForest(request);

  assert.equal(result.trunkCount, repeated.trunkCount);
  assert.deepEqual(result.colliders, repeated.colliders);
  assert.ok(result.trunkCount >= 120, "Archive should read as a continuous woodland, not isolated wall trees");
  assert.ok(result.colliders.length >= 24, "nearby Archive maze walls need physical coverage");
  assert.ok(result.colliders.length <= config.treeColliderLimit, "collision remains within its fixed budget");
  assert.ok(result.colliders.length < result.trunkCount, "visible trees must remain instanced rather than each owning a collider");

  const visibleTrunks = new Map();
  for (let index = 0; index < result.trunkCount; index += 1) {
    const offset = index * 16;
    const x = result.trunkMatrices[offset + 12];
    const z = result.trunkMatrices[offset + 14];
    const width = Math.hypot(
      result.trunkMatrices[offset + 0],
      result.trunkMatrices[offset + 1],
      result.trunkMatrices[offset + 2],
    );
    visibleTrunks.set(`${x.toFixed(5)}:${z.toFixed(5)}`, width);
  }

  for (const collider of result.colliders) {
    const [x, , z] = collider.position;
    const trunkWidth = visibleTrunks.get(`${Math.fround(x).toFixed(5)}:${Math.fround(z).toFixed(5)}`);
    assert.ok(trunkWidth, "every Archive wall collider must correspond to a visible trunk");
    assert.ok(
      collider.args[0] >= trunkWidth * 1.36,
      "collider must cover the visible tapered trunk base",
    );
    assert.equal(collider.args[0], collider.args[2]);
    assert.ok(Math.abs(z) > 2.2, "the authored central walking lane must remain open");
    assert.ok(Math.hypot(x, z) > 4.4, "the chapter clearing must remain traversable");
  }
});
