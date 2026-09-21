import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import { normalizeGeneratedWorldState } from "../src/data/worldStateNormalization.ts";
import {
  JOURNEY_ENTRY_CONTEXT,
  journeyChapters,
  journeyScenes,
} from "../src/data/journeyNarrative.ts";
import {
  JOURNEY_ENTRY_WORLD_PLACEMENTS,
  JOURNEY_SCENE_LAYOUTS,
  getJourneyEntryWorldPosition,
} from "../src/data/journeyWorldLayout.ts";
import { buildPhysicalStoryLinks } from "../src/lib/worldTopology.ts";

const generatedWorld = normalizeGeneratedWorldState(
  JSON.parse(fs.readFileSync(new URL("../src/data/worldState.json", import.meta.url), "utf8")),
);

const nodes = generatedWorld.entries.map((entry) => ({
  id: entry.id,
  chapter: entry.chapter,
  sequence: entry.sequence,
  position: getJourneyEntryWorldPosition(entry.id),
}));

const links = buildPhysicalStoryLinks(nodes);
const nodeIds = new Set(nodes.map((node) => node.id));

function linkKey(sourceId, targetId) {
  return [sourceId, targetId].sort().join("::");
}

function buildAdjacency(candidateLinks) {
  const adjacency = new Map(nodes.map((node) => [node.id, new Set()]));
  for (const link of candidateLinks) {
    assert.ok(adjacency.has(link.sourceId), `unknown source node ${link.sourceId}`);
    assert.ok(adjacency.has(link.targetId), `unknown target node ${link.targetId}`);
    adjacency.get(link.sourceId).add(link.targetId);
    adjacency.get(link.targetId).add(link.sourceId);
  }
  return adjacency;
}

function reachableFrom(startId, adjacency) {
  const visited = new Set([startId]);
  const queue = [startId];
  while (queue.length > 0) {
    const current = queue.shift();
    for (const neighbor of adjacency.get(current) ?? []) {
      if (visited.has(neighbor)) continue;
      visited.add(neighbor);
      queue.push(neighbor);
    }
  }
  return visited;
}

test("the canonical world places all 66 fragments across twelve chapters and 32 substantial scenes", () => {
  assert.equal(journeyChapters.length, 12);
  assert.equal(journeyScenes.length, 32);
  assert.equal(JOURNEY_ENTRY_WORLD_PLACEMENTS.length, 66);
  assert.equal(nodeIds.size, 66);

  const placementIds = new Set(JOURNEY_ENTRY_WORLD_PLACEMENTS.map((placement) => placement.entryId));
  assert.deepEqual(placementIds, nodeIds);
  const coordinateKeys = new Set();
  for (const placement of JOURNEY_ENTRY_WORLD_PLACEMENTS) {
    assert.ok(placement.position.every(Number.isFinite), `${placement.entryId} needs a finite position`);
    assert.ok(Math.abs(placement.position[0]) < 430);
    assert.ok(Math.abs(placement.position[2]) < 430);
    coordinateKeys.add(placement.position.join(":"));
    assert.equal(placement.sceneId, JOURNEY_ENTRY_CONTEXT[placement.entryId].sceneId);
  }
  assert.equal(coordinateKeys.size, 66, "every fragment needs a distinct encounter point");

  for (const scene of journeyScenes) {
    assert.deepEqual(
      getJourneyEntryWorldPosition(scene.keystoneEntryId),
      JOURNEY_SCENE_LAYOUTS.find((layout) => layout.id === scene.id).anchor.position,
      `${scene.id} Keystone must own the substantial scene anchor`,
    );
  }
});

test("physical links are deterministic and independent of archive input order", () => {
  assert.deepEqual(buildPhysicalStoryLinks(nodes), links);
  assert.deepEqual(buildPhysicalStoryLinks([...nodes].reverse()), links);

  const shuffled = [...nodes].sort((a, b) => {
    const rankA = (a.sequence * 37) % 67;
    const rankB = (b.sequence * 37) % 67;
    return rankA - rankB;
  });
  assert.deepEqual(buildPhysicalStoryLinks(shuffled), links);
  assert.equal(new Set(links.map((link) => linkKey(link.sourceId, link.targetId))).size, links.length);
});

test("the ground graph is a readable 32-scene spine with 34 finite Echo branches", () => {
  const backbone = links.filter((link) => link.role === "backbone");
  const echoBranches = links.filter((link) => link.role === "shortcut");

  assert.equal(backbone.length, journeyScenes.length - 1);
  assert.equal(echoBranches.length, 34);
  assert.equal(links.length, 65);

  for (let index = 0; index < journeyScenes.length - 1; index += 1) {
    assert.deepEqual(backbone[index], {
      sourceId: journeyScenes[index].keystoneEntryId,
      targetId: journeyScenes[index + 1].keystoneEntryId,
      role: "backbone",
    });
  }

  const adjacency = buildAdjacency(links);
  assert.equal(reachableFrom(journeyScenes[0].keystoneEntryId, adjacency).size, 66);
  assert.ok([...adjacency.values()].every((neighbors) => neighbors.size <= 3));
  assert.ok(
    [...adjacency.values()].filter((neighbors) => neighbors.size === 1).length >= 20,
    "Echo branches should produce meaningful dead ends instead of an open plaza",
  );
});

test("every Echo remains attached only to its own scene branch", () => {
  const linkKeys = new Set(links.map((link) => linkKey(link.sourceId, link.targetId)));
  for (const scene of journeyScenes) {
    let previousId = scene.keystoneEntryId;
    for (const echoId of scene.echoEntryIds) {
      assert.ok(linkKeys.has(linkKey(previousId, echoId)), `${echoId} must hang from ${scene.id}`);
      assert.equal(JOURNEY_ENTRY_CONTEXT[echoId].role, "echo");
      assert.equal(JOURNEY_ENTRY_CONTEXT[echoId].sceneId, scene.id);
      previousId = echoId;
    }
  }
});

test("chapter thresholds follow the exact twelve-chapter narrative order", () => {
  const backboneKeys = new Set(
    links.filter((link) => link.role === "backbone").map((link) => linkKey(link.sourceId, link.targetId)),
  );

  for (let index = 0; index < journeyChapters.length - 1; index += 1) {
    const sourceChapter = journeyChapters[index];
    const targetChapter = journeyChapters[index + 1];
    const sourceScene = journeyScenes.find((scene) => scene.id === sourceChapter.sceneIds.at(-1));
    const targetScene = journeyScenes.find((scene) => scene.id === targetChapter.sceneIds[0]);
    assert.ok(sourceScene && targetScene);
    assert.ok(
      backboneKeys.has(linkKey(sourceScene.keystoneEntryId, targetScene.keystoneEntryId)),
      `missing threshold from ${sourceChapter.id} to ${targetChapter.id}`,
    );
  }
});

test("Mind, Heart, Womb, Crown and constellation form one authored ascent", () => {
  const ascentSceneIds = [
    "climbs.arrival",
    "climb.mind",
    "climb.heart",
    "climb.womb",
    "crowned.threshold",
    "crowned.home",
    "crowned.sovereignty",
    "epilogue.constellation",
  ];
  const ascentScenes = ascentSceneIds.map((sceneId) => journeyScenes.find((scene) => scene.id === sceneId));
  assert.ok(ascentScenes.every(Boolean));

  for (let index = 0; index < ascentScenes.length - 1; index += 1) {
    const source = ascentScenes[index];
    const target = ascentScenes[index + 1];
    const sourcePosition = getJourneyEntryWorldPosition(source.keystoneEntryId);
    const targetPosition = getJourneyEntryWorldPosition(target.keystoneEntryId);
    assert.ok(targetPosition[1] > sourcePosition[1], `${target.id} must rise above ${source.id}`);
    assert.ok(
      links.some((link) =>
        link.role === "backbone" &&
        link.sourceId === source.keystoneEntryId &&
        link.targetId === target.keystoneEntryId),
    );
  }
});
