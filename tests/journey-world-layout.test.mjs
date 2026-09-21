import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import {
  ECHO_SPUR_ATTACHMENTS,
  JOURNEY_CHAPTER_LAYOUTS,
  JOURNEY_MAIN_ROUTE,
  JOURNEY_SCENE_IDS,
  JOURNEY_SCENE_LAYOUTS,
  JOURNEY_WORLD_LAYOUT,
  NARRATIVE_CHAPTER_IDS,
  PROCEDURAL_TREE_EXCLUSION_VOLUMES,
  TECHNICAL_BIOMES,
  assertValidJourneyWorldLayout,
  getJourneySceneLayout,
  isJourneySceneId,
  resolveJourneyRenderWindow,
  validateJourneyWorldLayout,
} from "../src/data/journeyWorldLayout.ts";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const EXPECTED_CHAPTER_IDS = [
  "broken-floor",
  "enchanted-wood",
  "blue-moon-sanctuary",
  "nest",
  "sunset-seer",
  "thorned-house",
  "wolf-swan-seer",
  "fire-river",
  "fork",
  "three-climbs",
  "crowned-return",
  "lantern-epilogue",
];

const EXPECTED_SCENE_IDS = [
  "broken-floor.confession",
  "enchanted.rabbit-hole",
  "enchanted.friendship-meadow",
  "enchanted.masked-hearth",
  "blue-moon.sanctuary",
  "blue-moon.intimacy",
  "blue-moon.caged-bird",
  "nest.two-hands",
  "nest.unsupported-cycle",
  "nest.protection",
  "sunset.warning-grove",
  "sunset.true-mirror",
  "sunset.stillness",
  "thorned.locked-garden",
  "thorned.old-memory-bedroom",
  "thorned.self-owned-world",
  "wolf-swan.false-choice",
  "wolf-swan.convergence",
  "fire.boundary",
  "river.wash",
  "river.release-surrender",
  "fork.weighing",
  "fork.four-verbs",
  "fork.relinquish-hope",
  "climbs.arrival",
  "climb.mind",
  "climb.heart",
  "climb.womb",
  "crowned.threshold",
  "crowned.home",
  "crowned.sovereignty",
  "epilogue.constellation",
];

const EXPECTED_CHAPTER_BIOMES = {
  "broken-floor": "firstWood",
  "enchanted-wood": "firstWood",
  "blue-moon-sanctuary": "archive",
  nest: "firstWood",
  "sunset-seer": "mirror",
  "thorned-house": "thorned",
  "wolf-swan-seer": "mirror",
  "fire-river": "fireRiver",
  fork: "firstWood",
  "three-climbs": "crowned",
  "crowned-return": "crowned",
  "lantern-epilogue": "crowned",
};

function pointInsideBounds(point, bounds) {
  return point.every((value, axis) => value >= bounds.min[axis] && value <= bounds.max[axis]);
}

test("authors the exact twelve chapters and canonical thirty-two scene IDs", () => {
  assert.deepEqual([...NARRATIVE_CHAPTER_IDS], EXPECTED_CHAPTER_IDS);
  assert.deepEqual([...JOURNEY_SCENE_IDS], EXPECTED_SCENE_IDS);
  assert.equal(JOURNEY_CHAPTER_LAYOUTS.length, 12);
  assert.equal(JOURNEY_SCENE_LAYOUTS.length, 32);
  assert.deepEqual([...TECHNICAL_BIOMES], [
    "firstWood",
    "mirror",
    "thorned",
    "archive",
    "fireRiver",
    "crowned",
  ]);

  assert.deepEqual(
    Object.fromEntries(JOURNEY_CHAPTER_LAYOUTS.map((chapter) => [chapter.id, chapter.biome])),
    EXPECTED_CHAPTER_BIOMES,
  );

  for (const chapter of JOURNEY_CHAPTER_LAYOUTS) {
    assert.ok(chapter.sceneIds.length > 0, `${chapter.id} must own at least one scene`);
    assert.ok(chapter.sceneIds.includes(chapter.anchorSceneId));
    assert.deepEqual(
      chapter.sceneIds,
      JOURNEY_SCENE_LAYOUTS
        .filter((scene) => scene.chapterId === chapter.id)
        .map((scene) => scene.id),
    );
  }
});

test("provides one stable persistent-memory anchor for every authored chapter", () => {
  assert.equal(JOURNEY_CHAPTER_LAYOUTS.length, EXPECTED_CHAPTER_IDS.length);
  assert.deepEqual(
    JOURNEY_CHAPTER_LAYOUTS.map((chapter) => chapter.id),
    EXPECTED_CHAPTER_IDS,
  );

  const anchorSceneIds = new Set();
  for (const chapter of JOURNEY_CHAPTER_LAYOUTS) {
    const anchorScene = getJourneySceneLayout(chapter.anchorSceneId);
    assert.equal(anchorScene.chapterId, chapter.id);
    assert.deepEqual(chapter.anchor, anchorScene.anchor);
    assert.equal(anchorSceneIds.has(chapter.anchorSceneId), false);
    anchorSceneIds.add(chapter.anchorSceneId);
  }
});

test("keeps geography serializable and independent of Three.js", () => {
  const serialized = JSON.stringify(JOURNEY_WORLD_LAYOUT);
  assert.ok(serialized.length > 0);
  assert.deepEqual(JSON.parse(serialized), JOURNEY_WORLD_LAYOUT);

  const source = fs.readFileSync(path.join(ROOT, "src/data/journeyWorldLayout.ts"), "utf8");
  assert.doesNotMatch(source, /from\s+["']three["']/);
  assert.doesNotMatch(source, /@react-three/);
  assert.doesNotMatch(source, /THREE\./);
});

test("orders finite authored anchors and connects every consecutive scene through gateways", () => {
  assert.equal(JOURNEY_MAIN_ROUTE.length, JOURNEY_SCENE_LAYOUTS.length - 1);

  for (let index = 0; index < JOURNEY_SCENE_LAYOUTS.length; index += 1) {
    const scene = JOURNEY_SCENE_LAYOUTS[index];
    assert.equal(scene.order, index);
    assert.ok(scene.anchor.position.every(Number.isFinite));
    assert.ok(Number.isFinite(scene.anchor.headingRadians));
    assert.ok(pointInsideBounds(scene.anchor.position, scene.bounds));
    assert.equal(scene.gateways.length, 2);
    for (const gateway of scene.gateways) {
      assert.ok(pointInsideBounds(gateway.position, scene.bounds), `${gateway.id} must lie inside its scene`);
    }

    if (index > 0) {
      assert.ok(
        scene.anchor.position[2] > JOURNEY_SCENE_LAYOUTS[index - 1].anchor.position[2],
        `${scene.id} must advance along the authored journey axis`,
      );
    }
  }

  JOURNEY_MAIN_ROUTE.forEach((segment, index) => {
    const source = JOURNEY_SCENE_LAYOUTS[index];
    const target = JOURNEY_SCENE_LAYOUTS[index + 1];
    assert.equal(segment.order, index);
    assert.equal(segment.fromSceneId, source.id);
    assert.equal(segment.toSceneId, target.id);
    assert.ok(source.gateways.some((gateway) => gateway.id === segment.fromGatewayId));
    assert.ok(target.gateways.some((gateway) => gateway.id === segment.toGatewayId));
    assert.equal(source.gateways[1].connectsToSceneId, target.id);
    assert.equal(target.gateways[0].connectsToSceneId, source.id);
  });
});

test("reserves authored clearings, interiors, and every primary-route corridor from procedural trees", () => {
  const coreVolumes = PROCEDURAL_TREE_EXCLUSION_VOLUMES.filter((volume) => volume.id.endsWith(".core"));
  const corridorVolumes = PROCEDURAL_TREE_EXCLUSION_VOLUMES.filter((volume) => volume.kind === "corridor");

  assert.equal(coreVolumes.length, JOURNEY_SCENE_LAYOUTS.length);
  assert.equal(corridorVolumes.length, JOURNEY_MAIN_ROUTE.length);
  assert.deepEqual(
    new Set(coreVolumes.flatMap((volume) => volume.sceneIds)),
    new Set(JOURNEY_SCENE_IDS),
  );

  for (const sceneId of [
    "broken-floor.confession",
    "nest.two-hands",
    "thorned.old-memory-bedroom",
    "crowned.home",
  ]) {
    const volume = coreVolumes.find((candidate) => candidate.sceneIds[0] === sceneId);
    assert.equal(volume?.kind, "box", `${sceneId} should reserve an architectural volume`);
  }

  for (const volume of corridorVolumes) {
    assert.equal(volume.sceneIds.length, 2);
    assert.ok(volume.radius >= 4, `${volume.id} must preserve a walkable route`);
    assert.ok(volume.start.every(Number.isFinite));
    assert.ok(volume.end.every(Number.isFinite));
  }
});

test("provides bounded echo-spur attachments without making echoes part of the main route", () => {
  assert.equal(new Set(ECHO_SPUR_ATTACHMENTS.map((spur) => spur.id)).size, ECHO_SPUR_ATTACHMENTS.length);
  assert.equal(
    ECHO_SPUR_ATTACHMENTS.reduce((capacity, spur) => capacity + spur.maxEchoes, 0),
    34,
    "the authored spurs can hold the archive remainder without adding physical route nodes",
  );

  const routeSceneIds = new Set(JOURNEY_MAIN_ROUTE.flatMap((segment) => [segment.fromSceneId, segment.toSceneId]));
  for (const spur of ECHO_SPUR_ATTACHMENTS) {
    const scene = getJourneySceneLayout(spur.sceneId);
    assert.ok(routeSceneIds.has(spur.sceneId));
    assert.ok(pointInsideBounds(spur.attachmentPosition, scene.bounds));
    assert.ok(spur.length > 0);
    assert.ok(spur.width > 0);
    assert.ok(Number.isInteger(spur.maxEchoes));
  }
});

test("resolves one active scene and only its immediate route neighbors", () => {
  assert.deepEqual(resolveJourneyRenderWindow("broken-floor.confession"), {
    activeSceneId: "broken-floor.confession",
    activeSceneIds: ["broken-floor.confession"],
    adjacentSceneIds: ["enchanted.rabbit-hole"],
    entries: [
      { sceneId: "broken-floor.confession", mode: "active", routeOffset: 0 },
      { sceneId: "enchanted.rabbit-hole", mode: "adjacent", routeOffset: 1 },
    ],
  });

  assert.deepEqual(resolveJourneyRenderWindow("wolf-swan.convergence"), {
    activeSceneId: "wolf-swan.convergence",
    activeSceneIds: ["wolf-swan.convergence"],
    adjacentSceneIds: ["wolf-swan.false-choice", "fire.boundary"],
    entries: [
      { sceneId: "wolf-swan.false-choice", mode: "adjacent", routeOffset: -1 },
      { sceneId: "wolf-swan.convergence", mode: "active", routeOffset: 0 },
      { sceneId: "fire.boundary", mode: "adjacent", routeOffset: 1 },
    ],
  });

  assert.deepEqual(resolveJourneyRenderWindow("epilogue.constellation").adjacentSceneIds, [
    "crowned.sovereignty",
  ]);

  for (const sceneId of JOURNEY_SCENE_IDS) {
    const window = resolveJourneyRenderWindow(sceneId);
    assert.equal(window.activeSceneIds.length, 1);
    assert.ok(window.adjacentSceneIds.length <= 2);
    assert.ok(window.entries.length <= 3);
  }

  assert.throws(() => resolveJourneyRenderWindow("unknown.scene"), /Unknown journey scene/);
  assert.equal(isJourneySceneId("climb.heart"), true);
  assert.equal(isJourneySceneId("unknown.scene"), false);
});

test("validates canonical invariants and reports malformed geography", () => {
  assert.deepEqual(validateJourneyWorldLayout(), []);
  assert.doesNotThrow(() => assertValidJourneyWorldLayout());

  const malformed = structuredClone(JOURNEY_WORLD_LAYOUT);
  malformed.mainRoute[0].toSceneId = "epilogue.constellation";
  malformed.scenes[1].chapterId = "not-a-chapter";
  malformed.proceduralTreeExclusions = malformed.proceduralTreeExclusions.filter(
    (volume) => volume.id !== "tree-exclusion.enchanted.rabbit-hole.core",
  );

  const issueCodes = new Set(validateJourneyWorldLayout(malformed).map((issue) => issue.code));
  assert.ok(issueCodes.has("route.sequence"));
  assert.ok(issueCodes.has("scene.chapter.unknown"));
  assert.ok(issueCodes.has("tree-exclusion.core-missing"));
  assert.throws(() => assertValidJourneyWorldLayout(malformed), /Invalid journey world layout/);
});
