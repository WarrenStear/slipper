import assert from "node:assert/strict";
import test from "node:test";
import {
  JOURNEY_NARRATIVE_ACTION_FLAG_IDS,
  JOURNEY_RITUAL_IDS,
  JOURNEY_SYMBOLIC_OBJECT_IDS,
  JOURNEY_WORLD_FLAG_IDS,
  getJourneyScene,
  journeyChapters,
  journeyScenes,
} from "../src/data/journeyBlueprint.ts";
import {
  JOURNEY_RITUAL_PROGRESSION,
  applyJourneySceneRewards,
  canCompleteScene,
  isSceneAwake,
  sceneCompletionConditions,
} from "../src/lib/journeyProgression.ts";
import {
  getJourneySceneArrivalHeading,
} from "../src/data/journeyWorldLayout.ts";
import {
  availableJourneyPlayerActionsForScene,
  JOURNEY_PLAYER_ACTIONS,
  JOURNEY_PLAYER_ACTION_IDS,
  journeyPlayerActionChoiceAtTarget,
  journeyPlayerActionComplete,
  journeyPlayerActionsForScene,
  nearestJourneyPlayerActionChoice,
  nextJourneyPlayerAction,
  resolveJourneyPlayerActionTargetLocalPosition,
} from "../src/lib/journeyPlayerActions.ts";

const ACTION_FLAGS = [
  "blue-moon.candles-lit",
  "blue-moon.water-touched",
  "blue-moon.swan-followed",
  "blue-moon.flowers-placed",
  "blue-moon.beautiful-door-open",
  "nest.hand-held",
  "nest.hand-kept",
  "nest.unsupported-burden-held",
  "nest.unsupported-burden-released",
  "nest.protection-acknowledged",
  "thorn-house.space-cleared",
  "thorn-house.space-refilled",
  "thorn-house.reorganisation-released",
  "thorn-house.exit-crossed",
  "integration.swan-witnessed",
  "integration.wolf-witnessed",
  "integration.seer-witnessed",
  "integration.three-aspects-held",
  "fork.weighed",
  "fork.let-go",
  "fork.declined",
  "fork.departed",
  "fork.deleted",
  "fork.old-hope-relinquished",
  "lantern.owned",
  "climb.mind.questions-released",
  "climb.heart.memory-chosen",
  "climb.womb.creation-chosen",
];

const CHOICE_OBJECTS = [
  "memory.chosen-heart",
  "memory.heart.tenderness",
  "memory.heart.beauty",
  "memory.heart.selfhood",
  "creation.chosen-future",
  "creation.future.rest",
  "creation.future.home",
  "creation.future.voice",
];

function progressionState(overrides = {}) {
  return {
    activeEntryId: "fragment-001",
    witnessedEntryIds: [],
    completedRitualIds: [],
    worldFlags: {},
    inventory: {
      lantern: true,
      recoveredKeys: [],
      symbolicObjects: [],
    },
    completedActs: [],
    completedChapterIds: [],
    completedSceneIds: [],
    storyStarted: true,
    storyCompleted: false,
    ...overrides,
  };
}

function readyFor(sceneId, overrides = {}) {
  const sceneIndex = journeyScenes.findIndex((scene) => scene.id === sceneId);
  assert.ok(sceneIndex >= 0, `unknown test scene ${sceneId}`);
  const scene = journeyScenes[sceneIndex];
  const completedSceneIds = journeyScenes.slice(0, sceneIndex).map((candidate) => candidate.id);
  const completedSet = new Set(completedSceneIds);
  const chapterIndex = journeyChapters.findIndex((chapter) => chapter.id === scene.chapterId);
  const completedChapterIds = journeyChapters.slice(0, chapterIndex).map((chapter) => chapter.id);
  const completedRitualIds = JOURNEY_RITUAL_PROGRESSION
    .filter((ritual) => completedSet.has(ritual.sceneId))
    .map((ritual) => ritual.ritualId);

  return progressionState({
    activeEntryId: scene.keystoneEntryId,
    witnessedEntryIds: [scene.keystoneEntryId],
    completedSceneIds,
    completedChapterIds,
    completedRitualIds,
    inventory: {
      lantern: true,
      recoveredKeys: [
        ...(completedSet.has("nest.protection") ? ["key.protection"] : []),
        ...(completedSet.has("thorned.self-owned-world") ? ["key.self-permission"] : []),
      ],
      symbolicObjects: [
        ...(completedSet.has("blue-moon.caged-bird") ? ["memory.blue-moon"] : []),
        ...(completedSet.has("climb.heart") ? ["memory.chosen-heart", "memory.heart.selfhood"] : []),
        ...(completedSet.has("climb.womb") ? ["creation.chosen-future", "creation.future.home"] : []),
      ],
    },
    ...overrides,
  });
}

function withFlags(state, ...flagIds) {
  return {
    ...state,
    worldFlags: {
      ...state.worldFlags,
      ...Object.fromEntries(flagIds.map((flagId) => [flagId, true])),
    },
  };
}

function withObjects(state, ...objectIds) {
  return {
    ...state,
    inventory: {
      ...state.inventory,
      symbolicObjects: Array.from(new Set([...state.inventory.symbolicObjects, ...objectIds])),
    },
  };
}

test("major-chapter action outcomes are canonical save allowlists", () => {
  assert.deepEqual(JOURNEY_NARRATIVE_ACTION_FLAG_IDS, ACTION_FLAGS);
  for (const flagId of ACTION_FLAGS) {
    assert.ok(JOURNEY_WORLD_FLAG_IDS.includes(flagId), `${flagId} must survive snapshot sanitization`);
  }
  for (const objectId of CHOICE_OBJECTS) {
    assert.ok(JOURNEY_SYMBOLIC_OBJECT_IDS.includes(objectId), `${objectId} must survive snapshot sanitization`);
  }
  assert.ok(JOURNEY_RITUAL_IDS.includes("ritual.recover-key"));
});

test("every player-action outcome is allowlisted and every completion flag is emitted", () => {
  assert.equal(new Set(JOURNEY_PLAYER_ACTION_IDS).size, JOURNEY_PLAYER_ACTION_IDS.length);

  for (const action of JOURNEY_PLAYER_ACTIONS) {
    const outcomes = [
      ...(action.outcomes ?? []),
      ...(action.choices ?? []).flatMap((choice) => choice.outcomes),
    ];
    const emittedFlags = new Set(
      outcomes
        .filter((outcome) => outcome.type === "set-world-flag")
        .map((outcome) => outcome.flagId),
    );

    for (const flagId of action.completionFlagIds) {
      assert.ok(JOURNEY_WORLD_FLAG_IDS.includes(flagId), `${action.id} completion flag must be allowlisted`);
      assert.ok(emittedFlags.has(flagId), `${action.id} must emit its completion flag`);
    }
    for (const flagId of action.requiredFlagIds ?? []) {
      assert.ok(JOURNEY_WORLD_FLAG_IDS.includes(flagId), `${action.id} prerequisite must be allowlisted`);
    }
    for (const outcome of outcomes) {
      if (outcome.type === "set-world-flag") {
        assert.ok(JOURNEY_WORLD_FLAG_IDS.includes(outcome.flagId), `${action.id} emits an unknown flag`);
      }
      if (outcome.type === "collect-symbolic-object") {
        assert.ok(JOURNEY_SYMBOLIC_OBJECT_IDS.includes(outcome.objectId), `${action.id} emits an unknown object`);
      }
    }
  }
});

test("descriptor order exposes one embodied action at a time", () => {
  assert.equal(nextJourneyPlayerAction("blue-moon.sanctuary", {})?.id, "action.blue-moon.light-candles");
  assert.equal(
    nextJourneyPlayerAction("blue-moon.sanctuary", { "blue-moon.candles-lit": true })?.id,
    "action.blue-moon.touch-water",
  );
  assert.equal(nextJourneyPlayerAction("nest.two-hands", {})?.id, "action.nest.two-hands");
  assert.equal(
    journeyPlayerActionComplete(
      journeyPlayerActionsForScene("nest.two-hands")[0],
      { "nest.hand-held": true, "nest.hand-kept": true },
    ),
    true,
  );

  assert.equal(nextJourneyPlayerAction("nest.unsupported-cycle", {})?.id, "action.nest.bear-burden");
  assert.equal(
    nextJourneyPlayerAction("nest.unsupported-cycle", { "nest.unsupported-burden-held": true })?.id,
    "action.nest.release-burden",
  );

  assert.equal(nextJourneyPlayerAction("thorned.locked-garden", {})?.id, "action.thorned.clear-space");
  assert.equal(
    nextJourneyPlayerAction("thorned.locked-garden", { "thorn-house.space-cleared": true })?.id,
    "action.thorned.observe-refill",
  );

  assert.equal(nextJourneyPlayerAction("wolf-swan.false-choice", {})?.id, "action.integration.swan-alone");
  assert.deepEqual(
    availableJourneyPlayerActionsForScene("wolf-swan.false-choice", {}).map((action) => action.id),
    ["action.integration.swan-alone", "action.integration.wolf-alone"],
    "Swan and Wolf are both available before the Seer, so proximity may decide their order",
  );
  assert.equal(
    nextJourneyPlayerAction("wolf-swan.false-choice", { "integration.wolf-witnessed": true })?.id,
    "action.integration.swan-alone",
  );
  assert.equal(
    nextJourneyPlayerAction("wolf-swan.false-choice", { "integration.swan-witnessed": true })?.id,
    "action.integration.wolf-alone",
  );
  assert.equal(
    nextJourneyPlayerAction("wolf-swan.false-choice", {
      "integration.swan-witnessed": true,
      "integration.wolf-witnessed": true,
    })?.id,
    "action.integration.seer-alone",
  );

  assert.equal(nextJourneyPlayerAction("fork.four-verbs", {})?.id, "action.fork.let-go");
  assert.equal(
    nextJourneyPlayerAction("fork.four-verbs", { "fork.let-go": true })?.id,
    "action.fork.decline",
  );
  assert.equal(
    nextJourneyPlayerAction("fork.four-verbs", {
      "fork.let-go": true,
      "fork.declined": true,
      "fork.departed": true,
    })?.id,
    "action.fork.delete",
  );
});

test("Blue Moon beauty is playable before its contradictions close the chapter", () => {
  const sanctuary = readyFor("blue-moon.sanctuary");
  assert.equal(canCompleteScene("blue-moon.sanctuary", sanctuary), false);
  assert.equal(
    canCompleteScene("blue-moon.sanctuary", withFlags(sanctuary, "blue-moon.candles-lit")),
    false,
  );
  assert.equal(
    canCompleteScene(
      "blue-moon.sanctuary",
      withFlags(sanctuary, "blue-moon.candles-lit", "blue-moon.water-touched"),
    ),
    true,
  );

  const intimacy = readyFor("blue-moon.intimacy");
  const incomplete = withFlags(intimacy, "blue-moon.swan-followed", "blue-moon.flowers-placed");
  assert.equal(canCompleteScene("blue-moon.intimacy", incomplete), false);
  assert.equal(
    canCompleteScene("blue-moon.intimacy", withFlags(incomplete, "blue-moon.beautiful-door-open")),
    true,
  );

  for (const action of JOURNEY_PLAYER_ACTIONS.filter((candidate) => candidate.id.startsWith("action.blue-moon"))) {
    assert.ok(action.target, `${action.id} must belong to an authored sanctuary prop`);
    assert.ok(action.target.radius <= 2.25, `${action.id} target must stay local`);
  }
});

test("the Nest requires two hands, the burden cycle, and acknowledged protection", () => {
  const twoHands = readyFor("nest.two-hands");
  assert.equal(canCompleteScene("nest.two-hands", twoHands), false);
  assert.equal(canCompleteScene("nest.two-hands", withFlags(twoHands, "nest.hand-held")), false);
  assert.equal(
    canCompleteScene("nest.two-hands", withFlags(twoHands, "nest.hand-held", "nest.hand-kept")),
    true,
  );

  const burden = readyFor("nest.unsupported-cycle");
  assert.equal(canCompleteScene("nest.unsupported-cycle", burden), false);
  assert.equal(
    canCompleteScene("nest.unsupported-cycle", withFlags(burden, "nest.unsupported-burden-held")),
    false,
  );
  assert.equal(
    canCompleteScene(
      "nest.unsupported-cycle",
      withFlags(burden, "nest.unsupported-burden-held", "nest.unsupported-burden-released"),
    ),
    true,
  );

  const protection = readyFor("nest.protection");
  assert.equal(canCompleteScene("nest.protection", protection), false);
  assert.equal(
    canCompleteScene("nest.protection", withFlags(protection, "nest.protection-acknowledged")),
    true,
  );
  const rewarded = applyJourneySceneRewards("nest.protection", protection.inventory);
  assert.ok(rewarded.recoveredKeys.includes("key.protection"));
});

test("the Thorned House refills cleared space before self-permission can open its exit", () => {
  const garden = readyFor("thorned.locked-garden");
  assert.equal(canCompleteScene("thorned.locked-garden", withFlags(garden, "thorn-house.space-cleared")), false);
  assert.equal(
    canCompleteScene(
      "thorned.locked-garden",
      withFlags(garden, "thorn-house.space-cleared", "thorn-house.space-refilled"),
    ),
    true,
  );

  const bedroom = readyFor("thorned.old-memory-bedroom");
  assert.equal(canCompleteScene("thorned.old-memory-bedroom", bedroom), false);
  assert.equal(
    canCompleteScene("thorned.old-memory-bedroom", withFlags(bedroom, "thorn-house.reorganisation-released")),
    true,
  );

  const exit = withFlags(readyFor("thorned.self-owned-world"), "thorn-house.exit-crossed");
  assert.equal(canCompleteScene("thorned.self-owned-world", exit), false, "crossing alone cannot replace key realisation");
  const keyRealised = {
    ...exit,
    completedRitualIds: [...exit.completedRitualIds, "ritual.recover-key"],
    inventory: {
      ...exit.inventory,
      recoveredKeys: [...exit.inventory.recoveredKeys, "key.self-permission"],
    },
  };
  assert.equal(canCompleteScene("thorned.self-owned-world", keyRealised), true);

  assert.deepEqual(
    nextJourneyPlayerAction("thorned.self-owned-world", {
      "thorn-house.reorganisation-released": true,
    })?.target,
    {
      localPosition: [0, 7.35],
      radius: 2.15,
      label: "the open house door",
    },
    "leaving must happen at the visible architectural exit, not after arbitrary movement",
  );
});

test("Wolf, Swan, and Seer each prove insufficient alone before integration", () => {
  const falseChoice = readyFor("wolf-swan.false-choice");
  assert.equal(canCompleteScene("wolf-swan.false-choice", falseChoice), false);
  const twoAspects = withFlags(
    falseChoice,
    "integration.swan-witnessed",
    "integration.wolf-witnessed",
  );
  assert.equal(canCompleteScene("wolf-swan.false-choice", twoAspects), false);
  assert.equal(
    canCompleteScene("wolf-swan.false-choice", withFlags(twoAspects, "integration.seer-witnessed")),
    true,
  );

  const convergence = readyFor("wolf-swan.convergence");
  assert.equal(canCompleteScene("wolf-swan.convergence", convergence), false);
  assert.equal(
    canCompleteScene("wolf-swan.convergence", withFlags(convergence, "integration.three-aspects-held")),
    true,
  );
});

test("the Fork waits for weighing, all four embodied verbs, relinquished hope, and lantern ownership", () => {
  const weighing = readyFor("fork.weighing");
  assert.equal(canCompleteScene("fork.weighing", weighing), false);
  assert.equal(canCompleteScene("fork.weighing", withFlags(weighing, "fork.weighed")), true);

  const verbs = readyFor("fork.four-verbs");
  const firstThree = withFlags(verbs, "fork.let-go", "fork.declined", "fork.departed");
  assert.equal(canCompleteScene("fork.four-verbs", firstThree), false);
  assert.equal(canCompleteScene("fork.four-verbs", withFlags(firstThree, "fork.deleted")), true);

  const ownership = readyFor("fork.relinquish-hope");
  assert.equal(
    canCompleteScene("fork.relinquish-hope", withFlags(ownership, "fork.old-hope-relinquished")),
    false,
  );
  assert.equal(
    canCompleteScene(
      "fork.relinquish-hope",
      withFlags(ownership, "fork.old-hope-relinquished", "lantern.owned"),
    ),
    true,
  );
  for (const action of JOURNEY_PLAYER_ACTIONS.filter((candidate) => candidate.id.startsWith("action.fork"))) {
    assert.ok(action.target, `${action.id} must activate at its physical fork prop`);
    assert.ok(action.target.radius <= 2.35, `${action.id} target radius must not cover the clearing`);
  }
});

test("Mind, Heart, and Womb have distinct actions and symbolic outcomes", () => {
  const mind = readyFor("climb.mind");
  assert.equal(canCompleteScene("climb.mind", mind), false);
  assert.equal(
    canCompleteScene("climb.mind", withFlags(mind, "climb.mind.questions-released")),
    true,
  );

  const heart = readyFor("climb.heart");
  assert.equal(canCompleteScene("climb.heart", withFlags(heart, "climb.heart.memory-chosen")), false);
  const heartChoice = withObjects(
    withFlags(heart, "climb.heart.memory-chosen"),
    "memory.chosen-heart",
    "memory.heart.tenderness",
  );
  assert.equal(canCompleteScene("climb.heart", heartChoice), true);

  const womb = readyFor("climb.womb");
  assert.equal(isSceneAwake("climb.womb", womb), true);
  assert.equal(canCompleteScene("climb.womb", withFlags(womb, "climb.womb.creation-chosen")), false);
  const creationChoice = withObjects(
    withFlags(womb, "climb.womb.creation-chosen"),
    "creation.chosen-future",
    "creation.future.rest",
  );
  assert.equal(canCompleteScene("climb.womb", creationChoice), true);
});

test("Heart and Womb choices resolve only beside their physical authored objects", () => {
  for (const sceneId of ["climb.heart", "climb.womb"]) {
    const action = journeyPlayerActionsForScene(sceneId).find(
      (candidate) => candidate.mode === "choice",
    );
    assert.ok(action, `${sceneId} must expose its embodied choice action`);
    assert.equal(action.choices?.length, 3);
    const arrivalHeading = getJourneySceneArrivalHeading(sceneId);

    for (const choice of action.choices ?? []) {
      assert.equal(choice.target.frame, "arrival");
      assert.ok(choice.target.radius <= 1.2, `${choice.id} must remain a bounded target`);
      const targetPosition = resolveJourneyPlayerActionTargetLocalPosition(
        choice.target,
        arrivalHeading,
      );
      const nearest = nearestJourneyPlayerActionChoice(
        action,
        targetPosition,
        arrivalHeading,
      );
      assert.equal(nearest?.choice.id, choice.id);
      assert.equal(nearest?.atTarget, true);
      assert.equal(
        journeyPlayerActionChoiceAtTarget(action, targetPosition, arrivalHeading)?.id,
        choice.id,
      );
    }

    assert.equal(
      journeyPlayerActionChoiceAtTarget(action, [0, 0], arrivalHeading),
      null,
      `${sceneId} must not resolve a choice from the centre of the clearing`,
    );
  }
});

test("the Crown recognises an owned lantern and deliberately chosen future", () => {
  const threshold = readyFor("crowned.threshold");
  const withoutOwnership = {
    ...threshold,
    worldFlags: {},
  };
  assert.equal(isSceneAwake("crowned.threshold", withoutOwnership), false);

  const withoutFuture = withFlags({
    ...threshold,
    inventory: {
      ...threshold.inventory,
      symbolicObjects: threshold.inventory.symbolicObjects.filter(
        (objectId) => objectId !== "creation.chosen-future",
      ),
    },
  }, "lantern.owned");
  assert.equal(isSceneAwake("crowned.threshold", withoutFuture), false);

  assert.equal(isSceneAwake("crowned.threshold", withFlags(threshold, "lantern.owned")), true);
});

test("only the authored passive scenes gain action completion gates", () => {
  assert.deepEqual(sceneCompletionConditions("nest.two-hands"), [
    { type: "world-flag", flagId: "nest.hand-held" },
    { type: "world-flag", flagId: "nest.hand-kept" },
  ]);
  assert.deepEqual(sceneCompletionConditions("fork.four-verbs").map((condition) => condition.flagId), [
    "fork.let-go",
    "fork.declined",
    "fork.departed",
    "fork.deleted",
  ]);
  assert.deepEqual(sceneCompletionConditions("enchanted.rabbit-hole"), []);
  assert.equal(getJourneyScene("climb.womb")?.chapterId, "three-climbs");

  for (const scene of journeyScenes) {
    const gatedFlagIds = sceneCompletionConditions(scene.id)
      .filter((condition) => condition.type === "world-flag")
      .map((condition) => condition.flagId);
    const localActionFlagIds = journeyPlayerActionsForScene(scene.id)
      .flatMap((action) => action.completionFlagIds);
    for (const flagId of gatedFlagIds) {
      assert.ok(
        localActionFlagIds.includes(flagId),
        `${scene.id} must expose the action that satisfies ${flagId}`,
      );
    }
  }
});
