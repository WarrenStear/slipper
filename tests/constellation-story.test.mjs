import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  JOURNEY_ENTRY_CONTEXT,
  JOURNEY_RITUAL_IDS,
  journeyChapters,
  journeyScenes,
} from "../src/data/journeyBlueprint.ts";
import {
  JOURNEY_CHAPTER_IDS,
  JOURNEY_HISTORY_LIMIT,
  JOURNEY_SCENE_IDS,
} from "../src/lib/storyJourneyState.ts";
import { sanitizeJourneySnapshot } from "../src/lib/journeySnapshot.ts";
import {
  buildStoryConstellationModel,
  isCompleteStoryConstellation,
  STORY_CONSTELLATION_ENTRY_COUNT,
} from "../src/lib/lanternNarrative.ts";

function constellationState(overrides = {}) {
  return {
    activeEntryId: "fragment-001",
    history: [],
    witnessedEntryIds: [],
    completedRitualIds: [],
    completedChapterIds: [],
    completedSceneIds: [],
    resonances: { wolf: 0, swan: 0, seer: 0 },
    releasedWords: [],
    landmarkStates: {},
    ...overrides,
  };
}

test("the initial constellation is one dim present point with no invented route", () => {
  const model = buildStoryConstellationModel(constellationState());

  assert.equal(model.isNearlyEmpty, true);
  assert.equal(model.nodes.length, 1);
  assert.equal(model.nodes[0].entryId, "fragment-001");
  assert.equal(model.nodes[0].witnessed, false);
  assert.equal(model.nodes[0].stage, "present");
  assert.equal(model.edges.length, 0);
  assert.deepEqual(model.routeEntryIds, ["fragment-001"]);
  assert.deepEqual(model.progress, {
    witnessedEntries: 0,
    completedRituals: 0,
    completedScenes: 0,
    completedChapters: 0,
    routeSteps: 0,
  });
});

test("travel edges reproduce actual history, including repeated crossings", () => {
  const model = buildStoryConstellationModel(constellationState({
    activeEntryId: "fragment-010",
    history: ["fragment-001", "fragment-008", "fragment-003", "fragment-008"],
    witnessedEntryIds: ["fragment-001"],
  }));

  assert.deepEqual(model.routeEntryIds, [
    "fragment-001",
    "fragment-008",
    "fragment-003",
    "fragment-008",
    "fragment-010",
  ]);
  assert.equal(model.nodes.length, 4);
  assert.equal(model.progress.routeSteps, 4);
  assert.equal(model.edges.length, 3);
  const repeated = model.edges.find((edge) =>
    new Set([edge.sourceEntryId, edge.targetEntryId]).has("fragment-003") &&
    new Set([edge.sourceEntryId, edge.targetEntryId]).has("fragment-008")
  );
  assert.ok(repeated);
  assert.equal(repeated.kind, "travel");
  assert.equal(repeated.traversalCount, 2);
});

test("ritual, resonance, release, and landmark state alter explicit model fields", () => {
  const model = buildStoryConstellationModel(constellationState({
    history: ["fragment-001"],
    activeEntryId: "fragment-002",
    witnessedEntryIds: ["fragment-001", "fragment-002"],
    completedRitualIds: ["ritual.accept-lantern"],
    completedSceneIds: ["broken-floor.confession"],
    resonances: { wolf: 60, swan: 30, seer: 90 },
    releasedWords: ["fear", "hope"],
    landmarkStates: { "landmark.first-wood-lantern": "awakened" },
  }));

  const ritualNode = model.nodes.find((node) => node.entryId === "fragment-001");
  assert.ok(ritualNode);
  assert.deepEqual(ritualNode.completedRitualIds, ["ritual.accept-lantern"]);
  assert.equal(ritualNode.landmarkState, "awakened");
  assert.equal(ritualNode.stage, "scene-complete");
  assert.deepEqual(model.resonance, { wolf: 60, swan: 30, seer: 90, energy: 0.6 });
  assert.equal(model.releasedWordCount, 2);
  assert.equal(model.releaseBloom, 2 / 7);
  assert.deepEqual(model.landmarkMemory, {
    activeCount: 1,
    transformedCount: 0,
    releasedCount: 0,
    strength: 0.24,
  });
  assert.equal(model.progress.completedRituals, 1);
  assert.equal(model.progress.completedScenes, 1);
  assert.equal(model.edges.some((edge) => edge.evidence.scene), true);
});

test("symbolic resonance, released words, and the protected Nest remain explicit visual data", () => {
  const nest = journeyChapters.find((chapter) => chapter.id === "nest");
  assert.ok(nest);
  const model = buildStoryConstellationModel(constellationState({
    activeEntryId: nest.entryIds.at(-1),
    history: nest.entryIds.slice(0, -1),
    witnessedEntryIds: nest.entryIds,
    completedChapterIds: ["nest"],
    resonances: { wolf: 62, swan: 48, seer: 77 },
    releasedWords: ["fear", "hope"],
  }));

  assert.deepEqual(
    model.resonanceNodes.map(({ id, label, strength, visible }) => ({ id, label, strength, visible })),
    [
      { id: "wolf", label: "Wolf", strength: 62, visible: true },
      { id: "swan", label: "Swan", strength: 48, visible: true },
      { id: "seer", label: "Seer", strength: 77, visible: true },
    ],
  );
  assert.ok(model.resonanceNodes.every((node) => node.intensity > 0.34));
  assert.deepEqual(model.releasedWords, ["fear", "hope"]);
  assert.deepEqual(model.protectedNest, {
    visible: true,
    protected: true,
    entryIds: nest.entryIds,
  });
});

test("the completed blueprint forms one connected 66-node authored constellation", () => {
  const entryIds = Object.keys(JOURNEY_ENTRY_CONTEXT);
  const model = buildStoryConstellationModel(constellationState({
    activeEntryId: entryIds.at(-1),
    witnessedEntryIds: entryIds,
    completedRitualIds: JOURNEY_RITUAL_IDS,
    completedChapterIds: JOURNEY_CHAPTER_IDS,
    completedSceneIds: JOURNEY_SCENE_IDS,
    resonances: { wolf: 74, swan: 81, seer: 69 },
    releasedWords: ["fear", "waiting", "permission"],
    landmarkStates: {
      "landmark.first-wood-lantern": "transformed",
      "landmark.mirror": "transformed",
      "landmark.fire-river": "released",
      "landmark.crowned-gate": "released",
    },
  }));

  assert.equal(STORY_CONSTELLATION_ENTRY_COUNT, 66);
  assert.equal(model.nodes.length, 66);
  assert.equal(model.chapters.length, 12);
  assert.equal(model.edges.length, 65, "the completed authored structure is a spanning route");
  assert.ok(model.nodes.every((node) => node.stage === "chapter-complete"));
  assert.equal(isCompleteStoryConstellation(model), true);

  const adjacency = new Map(model.nodes.map((node) => [node.entryId, []]));
  for (const edge of model.edges) {
    adjacency.get(edge.sourceEntryId).push(edge.targetEntryId);
    adjacency.get(edge.targetEntryId).push(edge.sourceEntryId);
  }
  const reached = new Set([model.nodes[0].entryId]);
  const queue = [model.nodes[0].entryId];
  while (queue.length > 0) {
    const current = queue.shift();
    for (const neighbor of adjacency.get(current)) {
      if (reached.has(neighbor)) continue;
      reached.add(neighbor);
      queue.push(neighbor);
    }
  }
  assert.equal(reached.size, 66);
  assert.equal(journeyChapters.length, 12);
  assert.equal(journeyScenes.length, 32);
});

test("a sanitized full journey plus revisits remains visible as the route actually walked", () => {
  const entryIds = Object.keys(JOURNEY_ENTRY_CONTEXT);
  const completeRouteWithRevisits = [
    ...entryIds,
    entryIds[7],
    entryIds[23],
    entryIds[7],
  ];
  const sanitized = sanitizeJourneySnapshot({
    schemaVersion: 2,
    activeEntryId: completeRouteWithRevisits.at(-1),
    history: completeRouteWithRevisits.slice(0, -1),
    visitedEntryIds: entryIds,
    witnessedEntryIds: entryIds,
    completedChapterIds: JOURNEY_CHAPTER_IDS,
    completedSceneIds: JOURNEY_SCENE_IDS,
  }, entryIds[0], entryIds);
  const model = buildStoryConstellationModel(constellationState(sanitized));

  assert.equal(JOURNEY_HISTORY_LIMIT, 512);
  assert.deepEqual(
    [...sanitized.history, sanitized.activeEntryId],
    completeRouteWithRevisits,
  );
  assert.deepEqual(model.routeEntryIds, completeRouteWithRevisits);
  assert.equal(model.progress.routeSteps, completeRouteWithRevisits.length - 1);
  assert.equal(model.nodes.length, 66);
  assert.equal(model.nodes.find((node) => node.entryId === entryIds[7])?.visitCount, 3);
});

test("the UI consumes the authored story model and does not classify archive keywords", () => {
  const source = readFileSync(
    new URL("../src/components/ui/ConstellationMap.tsx", import.meta.url),
    "utf8",
  );
  const finalTableau = readFileSync(
    new URL("../src/components/three/chapters/IntegratedFinalTableau.tsx", import.meta.url),
    "utf8",
  );
  assert.match(source, /buildStoryConstellationModel/);
  assert.match(source, /storyModel\.nodes\.map\(renderStoryNode\)/);
  assert.match(source, /storyModel\.edges\.map/);
  assert.match(source, /state\.witnessedEntryIds/);
  assert.match(source, /state\.completedRitualIds/);
  assert.match(source, /state\.completedChapterIds/);
  assert.match(source, /state\.completedSceneIds/);
  assert.match(source, /state\.resonances/);
  assert.match(source, /state\.releasedWords/);
  assert.match(source, /state\.landmarkStates/);
  assert.doesNotMatch(source, /entrySignal|classifyEntry|buildMazePathSegments/);
  assert.doesNotMatch(source, /entry\.tags|emotionalTone|sceneKind/);
  assert.match(source, /data-keyboard-landmark/);
  assert.match(source, /data-resonance-node=\{node\.id\}/);
  assert.match(source, /data-released-word=\{word\.word\}/);
  assert.match(source, /data-protected-nest=/);
  assert.match(finalTableau, /buildStoryConstellationModel/);
  assert.match(finalTableau, /name=\{`constellation-resonance-\$\{node\.id\}`\}/);
  assert.match(finalTableau, /wolf: \[-1\.8, -0\.58, 0\.03\]/);
  assert.match(finalTableau, /swan: \[0, 1\.42, 0\.05\]/);
  assert.match(finalTableau, /seer: \[1\.8, -0\.58, 0\.03\]/);
  assert.match(finalTableau, /name="constellation-protected-nest"/);
  assert.match(finalTableau, /name="constellation-released-words"/);
  assert.match(finalTableau, /name="constellation-formation-reveal"/);
  assert.match(finalTableau, /formationReady=\{\(lanternPlaced && \(!eventDriven \|\| reverseComplete\)\) \|\| storyCompleted\}/);
  assert.match(finalTableau, /formationMode: reducedMotion \? "immediate" : "gradual"/);
  assert.match(finalTableau, /beginsAfter: "lantern-placement-or-story-completion"/);
  assert.match(
    finalTableau,
    /THREE\.MathUtils\.damp\([\s\S]{0,120}formationProgressRef\.current,[\s\S]{0,80}target/,
  );
});
