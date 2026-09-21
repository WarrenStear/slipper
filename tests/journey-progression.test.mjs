import assert from "node:assert/strict";
import test from "node:test";
import {
  journeyChapters,
  journeyScenes,
} from "../src/data/journeyBlueprint.ts";
import {
  JOURNEY_RITUAL_PROGRESSION,
  applyJourneySceneRewards,
  canCompleteChapter,
  canCompleteScene,
  canResolveRitual,
  isKeystoneAvailable,
  isSceneAwake,
  journeyProgressionConditionMet,
  journeyProgressionConditionsMet,
  nextJourneyProgressionOutcome,
  nextRequiredEntry,
  nextRequiredScene,
  requiredRitualIdsForScene,
} from "../src/lib/journeyProgression.ts";
import {
  journeyPlayerActionsForScene,
} from "../src/lib/journeyPlayerActions.ts";

function applyPlayerActionsForScene(state, sceneId) {
  let next = state;
  for (const action of journeyPlayerActionsForScene(sceneId)) {
    const outcomes = action.outcomes ?? action.choices?.[0]?.outcomes ?? [];
    for (const outcome of outcomes) {
      if (outcome.type === "set-world-flag") {
        next = {
          ...next,
          worldFlags: { ...next.worldFlags, [outcome.flagId]: true },
        };
      } else if (outcome.type === "collect-symbolic-object") {
        next = {
          ...next,
          inventory: {
            ...next.inventory,
            symbolicObjects: Array.from(new Set([
              ...next.inventory.symbolicObjects,
              outcome.objectId,
            ])),
          },
        };
      } else {
        next = {
          ...next,
          inventory: { ...next.inventory, lantern: true },
        };
      }
    }
  }
  return next;
}

function progressionState(overrides = {}) {
  return {
    activeEntryId: "fragment-001",
    witnessedEntryIds: [],
    completedRitualIds: [],
    worldFlags: {},
    inventory: {
      lantern: false,
      recoveredKeys: [],
      symbolicObjects: [],
    },
    completedActs: [],
    completedChapterIds: [],
    completedSceneIds: [],
    storyStarted: false,
    storyCompleted: false,
    ...overrides,
  };
}

function progressBefore(sceneId, overrides = {}) {
  const targetIndex = journeyScenes.findIndex((scene) => scene.id === sceneId);
  assert.ok(targetIndex >= 0, `unknown test scene ${sceneId}`);
  const completedSceneIds = journeyScenes
    .slice(0, targetIndex)
    .map((scene) => scene.id);
  const completedSet = new Set(completedSceneIds);
  const targetChapterId = journeyScenes[targetIndex].chapterId;
  const targetChapterIndex = journeyChapters.findIndex(
    (chapter) => chapter.id === targetChapterId,
  );
  const completedChapterIds = journeyChapters
    .slice(0, targetChapterIndex)
    .map((chapter) => chapter.id);
  const completedRitualIds = JOURNEY_RITUAL_PROGRESSION
    .filter((ritual) => completedSet.has(ritual.sceneId))
    .map((ritual) => ritual.ritualId);
  const completedActionFlags = journeyScenes
    .filter((scene) => completedSet.has(scene.id))
    .flatMap((scene) => journeyPlayerActionsForScene(scene.id))
    .flatMap((action) => action.completionFlagIds);

  return progressionState({
    completedSceneIds,
    completedChapterIds,
    completedRitualIds,
    worldFlags: Object.fromEntries(completedActionFlags.map((flagId) => [flagId, true])),
    inventory: {
      lantern: true,
      recoveredKeys: [
        ...(completedSet.has("nest.protection") ? ["key.protection"] : []),
        ...(completedSet.has("thorned.self-owned-world") ? ["key.self-permission"] : []),
      ],
      symbolicObjects: [
        ...(completedSet.has("blue-moon.caged-bird") ? ["memory.blue-moon"] : []),
        ...(completedSet.has("climb.heart") ? ["memory.chosen-heart"] : []),
        ...(completedSet.has("climb.womb") ? ["creation.chosen-future"] : []),
      ],
    },
    ...overrides,
  });
}

test("the opening scene waits for its ritual while Echoes remain non-blocking", () => {
  const fresh = progressionState();
  assert.equal(isSceneAwake("broken-floor.confession", fresh), true);
  assert.equal(isSceneAwake("enchanted.rabbit-hole", fresh), false);
  assert.equal(isKeystoneAvailable("fragment-001", fresh), true);
  assert.equal(isKeystoneAvailable("fragment-002", fresh), false);
  assert.equal(nextRequiredScene(fresh)?.id, "broken-floor.confession");
  assert.equal(nextRequiredEntry(fresh), "fragment-001");

  const witnessed = progressionState({ witnessedEntryIds: ["fragment-001"] });
  assert.equal(canResolveRitual("ritual.accept-lantern", witnessed), true);
  assert.equal(canCompleteScene("broken-floor.confession", witnessed), false);
  assert.equal(nextRequiredEntry(witnessed), "fragment-001");

  const resolved = progressionState({
    witnessedEntryIds: ["fragment-001"],
    completedRitualIds: ["ritual.accept-lantern"],
    inventory: { lantern: true, recoveredKeys: [], symbolicObjects: [] },
  });
  assert.equal(canCompleteScene("broken-floor.confession", resolved), true);
  assert.deepEqual(nextJourneyProgressionOutcome(resolved), {
    type: "complete-scene",
    sceneId: "broken-floor.confession",
  });
});

test("scene and chapter markers form one linear wake-up sequence", () => {
  const sceneComplete = progressionState({
    witnessedEntryIds: ["fragment-001"],
    completedRitualIds: ["ritual.accept-lantern"],
    completedSceneIds: ["broken-floor.confession"],
    inventory: { lantern: true, recoveredKeys: [], symbolicObjects: [] },
  });
  assert.equal(isSceneAwake("enchanted.rabbit-hole", sceneComplete), false);
  assert.equal(canCompleteChapter("broken-floor", sceneComplete), true);
  assert.deepEqual(nextJourneyProgressionOutcome(sceneComplete), {
    type: "complete-chapter",
    chapterId: "broken-floor",
  });

  const chapterComplete = {
    ...sceneComplete,
    completedChapterIds: ["broken-floor"],
  };
  assert.equal(isSceneAwake("enchanted.rabbit-hole", chapterComplete), true);
  assert.equal(isSceneAwake("enchanted.friendship-meadow", chapterComplete), false);

  const rabbitWitnessed = {
    ...chapterComplete,
    witnessedEntryIds: ["fragment-001", "fragment-008"],
  };
  assert.equal(
    canCompleteScene("enchanted.rabbit-hole", rabbitWitnessed),
    true,
    "fragment-003 is an Echo and must never block the scene",
  );
});

test("Fire and River resolves boundary, wash, release, then surrender", () => {
  const boundary = progressBefore("fire.boundary", {
    activeEntryId: "fragment-053",
    witnessedEntryIds: ["fragment-053"],
  });
  assert.equal(isSceneAwake("fire.boundary", boundary), true);
  assert.equal(canResolveRitual("ritual.burn-boundary", boundary), true);
  assert.equal(isSceneAwake("river.wash", boundary), false);

  const wash = {
    ...boundary,
    activeEntryId: "fragment-034",
    witnessedEntryIds: ["fragment-053", "fragment-034"],
    completedRitualIds: [
      ...boundary.completedRitualIds,
      "ritual.burn-boundary",
    ],
    completedSceneIds: [...boundary.completedSceneIds, "fire.boundary"],
  };
  assert.equal(isSceneAwake("river.wash", wash), true);
  assert.equal(canResolveRitual("ritual.wash-grief", wash), true);
  assert.equal(isSceneAwake("river.release-surrender", wash), false);

  const release = {
    ...wash,
    activeEntryId: "fragment-057",
    witnessedEntryIds: ["fragment-053", "fragment-034", "fragment-057"],
    completedRitualIds: [...wash.completedRitualIds, "ritual.wash-grief"],
    completedSceneIds: [...wash.completedSceneIds, "river.wash"],
  };
  assert.equal(isSceneAwake("river.release-surrender", release), true);
  assert.equal(canResolveRitual("ritual.release-river-memory", release), true);
  assert.equal(canResolveRitual("ritual.surrender", release), false);

  const released = {
    ...release,
    completedRitualIds: [
      ...release.completedRitualIds,
      "ritual.release-river-memory",
    ],
  };
  assert.equal(canResolveRitual("ritual.surrender", released), true);
  assert.deepEqual(requiredRitualIdsForScene("river.release-surrender"), [
    "ritual.release-river-memory",
    "ritual.surrender",
  ]);
});

test("the Fork remains closed until release and surrender resolve", () => {
  const beforeFork = progressBefore("fork.weighing");
  const withoutSurrender = {
    ...beforeFork,
    completedRitualIds: beforeFork.completedRitualIds.filter(
      (ritualId) => ritualId !== "ritual.surrender",
    ),
  };
  assert.equal(isSceneAwake("fork.weighing", withoutSurrender), false);
  assert.equal(isSceneAwake("fork.weighing", beforeFork), true);
  assert.equal(isSceneAwake("fork.four-verbs", beforeFork), false);

  const weighed = {
    ...beforeFork,
    witnessedEntryIds: ["fragment-059"],
    completedSceneIds: [...beforeFork.completedSceneIds, "fork.weighing"],
  };
  assert.equal(isSceneAwake("fork.four-verbs", weighed), true);
  assert.equal(isSceneAwake("fork.relinquish-hope", weighed), false);
});

test("Mind, Heart, and Womb awaken in that order", () => {
  const arrival = progressBefore("climbs.arrival", {
    witnessedEntryIds: ["fragment-043"],
  });
  assert.equal(isSceneAwake("climbs.arrival", arrival), true);
  assert.equal(isSceneAwake("climb.mind", arrival), false);

  const mind = {
    ...arrival,
    completedSceneIds: [...arrival.completedSceneIds, "climbs.arrival"],
  };
  assert.equal(isSceneAwake("climb.mind", mind), true);
  assert.equal(isSceneAwake("climb.heart", mind), false);

  const heart = {
    ...mind,
    completedSceneIds: [...mind.completedSceneIds, "climb.mind"],
  };
  assert.equal(isSceneAwake("climb.heart", heart), true);
  assert.equal(isSceneAwake("climb.womb", heart), false);

  const womb = {
    ...heart,
    completedSceneIds: [...heart.completedSceneIds, "climb.heart"],
    inventory: applyJourneySceneRewards("climb.heart", heart.inventory),
  };
  assert.equal(isSceneAwake("climb.womb", womb), true);
  assert.ok(womb.inventory.recoveredKeys.includes("key.protection"));
  assert.ok(womb.inventory.symbolicObjects.includes("memory.chosen-heart"));
});

test("the Crown gate recognises protection, chosen memory, self-permission, and surrender", () => {
  const atGate = progressBefore("crowned.threshold");
  const noProtection = {
    ...atGate,
    inventory: {
      ...atGate.inventory,
      recoveredKeys: atGate.inventory.recoveredKeys.filter((keyId) => keyId !== "key.protection"),
    },
  };
  const noPermission = {
    ...atGate,
    inventory: {
      ...atGate.inventory,
      recoveredKeys: atGate.inventory.recoveredKeys.filter((keyId) => keyId !== "key.self-permission"),
    },
  };
  const noChosenMemory = {
    ...atGate,
    inventory: {
      ...atGate.inventory,
      symbolicObjects: atGate.inventory.symbolicObjects.filter((objectId) => objectId !== "memory.chosen-heart"),
    },
  };
  assert.equal(isSceneAwake("crowned.threshold", noProtection), false);
  assert.equal(isSceneAwake("crowned.threshold", noPermission), false);
  assert.equal(isSceneAwake("crowned.threshold", noChosenMemory), false);
  assert.equal(isSceneAwake("crowned.threshold", atGate), true);

  const sovereignty = progressBefore("crowned.sovereignty", {
    activeEntryId: "fragment-044",
    witnessedEntryIds: ["fragment-044"],
  });
  assert.equal(canResolveRitual("ritual.place-lantern", sovereignty), true);
  assert.equal(canCompleteScene("crowned.sovereignty", sovereignty), false);
  const lanternPlaced = {
    ...sovereignty,
    completedRitualIds: [
      ...sovereignty.completedRitualIds,
      "ritual.place-lantern",
    ],
  };
  assert.equal(canCompleteScene("crowned.sovereignty", lanternPlaced), true);
});

test("condition helpers cover authored state without mutating it", () => {
  const state = progressionState({
    witnessedEntryIds: ["fragment-001"],
    completedRitualIds: ["ritual.accept-lantern"],
    worldFlags: { "path.first-wood-readable": true },
    inventory: {
      lantern: true,
      recoveredKeys: ["key.self-permission"],
      symbolicObjects: ["memory.blue-moon"],
    },
    completedActs: ["first-wood"],
    completedChapterIds: ["broken-floor"],
    completedSceneIds: ["broken-floor.confession"],
  });
  const conditions = [
    { type: "entry-witnessed", entryId: "fragment-001" },
    { type: "ritual-complete", ritualId: "ritual.accept-lantern" },
    { type: "world-flag", flagId: "path.first-wood-readable" },
    { type: "inventory-lantern" },
    { type: "inventory-key", keyId: "key.self-permission" },
    { type: "inventory-object", objectId: "memory.blue-moon" },
    { type: "act-complete", actId: "first-wood" },
    { type: "scene-complete", sceneId: "broken-floor.confession" },
    { type: "chapter-complete", chapterId: "broken-floor" },
  ];
  assert.equal(journeyProgressionConditionsMet(conditions, state), true);
  assert.equal(
    journeyProgressionConditionMet(
      { type: "world-flag", flagId: "path.first-wood-readable", value: false },
      state,
    ),
    false,
  );
});

test("a fully reconciled chapter sequence yields story completion once", () => {
  const complete = progressionState({
    completedSceneIds: journeyScenes.map((scene) => scene.id),
    completedChapterIds: journeyChapters.map((chapter) => chapter.id),
  });
  assert.deepEqual(nextJourneyProgressionOutcome(complete), {
    type: "complete-story",
  });
  assert.equal(
    nextJourneyProgressionOutcome({ ...complete, storyCompleted: true }),
    undefined,
  );
  assert.equal(nextRequiredScene(complete), undefined);
  assert.equal(nextRequiredEntry(complete), undefined);
});

test("all 32 scenes can resolve linearly without witnessing a single Echo", () => {
  let state = progressionState();

  for (const chapter of journeyChapters) {
    for (const sceneId of chapter.sceneIds) {
      const scene = journeyScenes.find((candidate) => candidate.id === sceneId);
      assert.ok(scene);
      assert.equal(isSceneAwake(scene.id, state), true, `${scene.id} should awaken in order`);
      assert.equal(nextRequiredEntry(state), scene.keystoneEntryId);

      state = {
        ...state,
        activeEntryId: scene.keystoneEntryId,
        witnessedEntryIds: [...state.witnessedEntryIds, scene.keystoneEntryId],
      };

      for (const ritualId of requiredRitualIdsForScene(scene.id)) {
        assert.equal(canResolveRitual(ritualId, state), true, `${ritualId} should resolve at ${scene.id}`);
        state = {
          ...state,
          completedRitualIds: [...state.completedRitualIds, ritualId],
          inventory: {
            ...state.inventory,
            lantern: state.inventory.lantern || ritualId === "ritual.accept-lantern",
            recoveredKeys: ritualId === "ritual.recover-key"
              ? [...state.inventory.recoveredKeys, "key.self-permission"]
              : state.inventory.recoveredKeys,
            symbolicObjects: ritualId === "ritual.accept-memory"
              ? [...state.inventory.symbolicObjects, "memory.blue-moon"]
              : state.inventory.symbolicObjects,
          },
        };
      }

      state = applyPlayerActionsForScene(state, scene.id);

      assert.equal(canCompleteScene(scene.id, state), true);
      assert.deepEqual(nextJourneyProgressionOutcome(state), {
        type: "complete-scene",
        sceneId: scene.id,
      });
      state = {
        ...state,
        completedSceneIds: [...state.completedSceneIds, scene.id],
        inventory: applyJourneySceneRewards(scene.id, state.inventory),
      };
    }

    assert.equal(canCompleteChapter(chapter.id, state), true);
    assert.deepEqual(nextJourneyProgressionOutcome(state), {
      type: "complete-chapter",
      chapterId: chapter.id,
    });
    state = {
      ...state,
      completedChapterIds: [...state.completedChapterIds, chapter.id],
    };
  }

  assert.equal(state.witnessedEntryIds.length, 32);
  assert.deepEqual(nextJourneyProgressionOutcome(state), {
    type: "complete-story",
  });
});
