import assert from "node:assert/strict";
import test from "node:test";
import { journeyScenes, journeyChapters, JOURNEY_ENTRY_PROGRESS, JOURNEY_RITUAL_IDS } from "../src/data/journeyBlueprint.ts";
import { createFreshStoryJourneyState, sanitizeStoryJourneyState, mergeCloudJourneyState } from "../src/lib/storyJourneyState.ts";
import { sanitizeJourney } from "../functions/_shared/session.ts";
import { STORY_EVENTS, STORY_OBJECT_DEFINITIONS, eventsForScene, objectsForScene, getAvailableStoryEvents, getCarriedStoryObjects, isSceneStoryComplete } from "../src/storyEvents/storyEventRegistry.ts";
import { dispatchStoryEventState } from "../src/storyEvents/storyEventState.ts";
import { reconcileLegacyStoryEventEntry } from "../src/storyEvents/storyEventRecovery.ts";
import { canCompleteScene } from "../src/lib/journeyProgression.ts";
import { sanitizeStoryEventPersistence, STORY_EVENT_SCHEMA } from "../src/storyEvents/storyEventSchema.ts";

const options = { fallbackEntryId: "fragment-001", entryProgress: JOURNEY_ENTRY_PROGRESS };
function fresh(sceneId = "broken-floor.confession") {
  const scene = journeyScenes.find((item) => item.id === sceneId);
  return { ...createFreshStoryJourneyState(options), sceneId, activeEntryId: scene.keystoneEntryId, chapterId: scene.chapterId };
}
function send(state, trigger, objectId, targetId, duration) {
  return dispatchStoryEventState(state, { sceneId: state.sceneId, trigger, objectId, targetId, duration });
}
function eventInput(state, event) {
  return { sceneId: state.sceneId, trigger: event.trigger, objectId: event.objectId, targetId: event.targetId, duration: event.durationMs };
}

test("every scene has authored completion, every persisted outcome has finite shared allowlists", () => {
  assert.equal(new Set(STORY_EVENTS.map((event) => event.id)).size, STORY_EVENTS.length);
  assert.deepEqual(new Set(STORY_EVENT_SCHEMA.eventIds), new Set(STORY_EVENTS.map((event) => event.id)));
  for (const scene of journeyScenes) assert.ok(eventsForScene(scene.id).some((event) => !event.optional), scene.id);
  for (const event of STORY_EVENTS) {
    if (event.objectId) assert.ok(objectsForScene(event.sceneId).some((object) => object.id === event.objectId), event.id);
    for (const action of event.actions) {
      if (action.type === "object-state") assert.ok(STORY_EVENT_SCHEMA.objectStates[action.objectId]?.includes(action.state), event.id);
      if (action.type === "placement") assert.ok(STORY_EVENT_SCHEMA.placements[action.objectId]?.includes(action.targetId), event.id);
      if (action.type === "ritual") assert.ok(JOURNEY_RITUAL_IDS.includes(action.ritualId));
    }
  }
});

test("Broken Floor requires two separate wipes then touch and never replays its inversion", () => {
  let state = fresh();
  assert.deepEqual(send(state, "touch", "broken-floor.reflection").eventIds, []);
  state = send(state, "wipe", "broken-floor.reflection").state;
  assert.equal(state.storyObjectStates["broken-floor.reflection"], "clearing");
  state = send(state, "wipe", "broken-floor.reflection").state;
  assert.equal(state.storyObjectStates["broken-floor.reflection"], "revealed");
  const inversion = send(state, "touch", "broken-floor.reflection");
  assert.equal(inversion.state.storyObjectStates["broken-floor.reflection"], "inverted");
  assert.deepEqual(send(inversion.state, "touch", "broken-floor.reflection").eventIds, []);
  assert.equal(send(inversion.state, "touch", "broken-floor.reflection").state, inversion.state);
  assert.deepEqual(dispatchStoryEventState(state, { sceneId: "crowned.sovereignty", trigger: "gaze", objectId: "home.crown-mirror", duration: 9000 }).eventIds, []);
});

test("full authored physical route survives local and cloud round trips after every action", () => {
  let state = fresh();
  let count = 0;
  for (const scene of journeyScenes) {
    state = { ...state, sceneId: scene.id, activeEntryId: scene.keystoneEntryId, chapterId: scene.chapterId };
    state = send(state, "scene-enter").state;
    let budget = 40;
    while (!isSceneStoryComplete(state, scene.id) && --budget > 0) {
      const available = getAvailableStoryEvents(state).filter((event) => !event.optional);
      assert.ok(available.length, `stranded in ${scene.id}: ${JSON.stringify(state.storyObjectStates)}`);
      const event = available[0];
      const outcome = dispatchStoryEventState(state, eventInput(state, event));
      assert.ok(outcome.eventIds.length, event.id);
      state = sanitizeStoryJourneyState(sanitizeJourney(outcome.state), options);
      count++;
    }
    assert.ok(isSceneStoryComplete(state, scene.id), scene.id);
    state = { ...state, completedSceneIds: [...state.completedSceneIds, scene.id] };
  }
  assert.ok(count > 75);
  assert.equal(state.storyObjectStates["fire.true-memory"], "preserved");
  assert.equal(state.storyObjectStates["river.soot"], "washed");
  assert.equal(state.storyObjectStates["heart.memory"], "blush-rose");
  assert.equal(state.storyObjectStates["heart.rose"], "carried");
  assert.equal(state.storyObjectStates["heart.feather"], undefined);
  assert.equal(state.storyObjectStates["womb.creation"], "rest");
  assert.equal(state.storyPlacementStates["lantern.master"], "mirror");
  assert.equal(getCarriedStoryObjects(state).some((object) => object.id === "lantern.master"), false);
  assert.equal(state.storyObjectStates["epilogue.reverse-light"], "complete");
  assert.ok(JOURNEY_RITUAL_IDS.every((id) => state.completedRitualIds.includes(id)));
});

test("carrying is bounded, drop can recover, and fire refuses the beautiful memory", () => {
  let state = fresh("fire.boundary");
  state = send(state, "pickup", "fire.false-promise").state;
  assert.deepEqual(send(state, "pickup", "fire.old-marker").eventIds, []);
  state = send(state, "drop", "fire.false-promise").state;
  state = send(state, "pickup", "fire.false-promise").state;
  assert.equal(state.storyObjectStates["fire.false-promise"], "carried");
  state = send(state, "burn", "fire.false-promise", "fire.flame").state;
  assert.equal(state.storyObjectStates["fire.false-promise"], "burned");
  state = send(state, "pickup", "fire.true-memory").state;
  const first = send(state, "burn", "fire.true-memory", "fire.flame");
  const second = send(state, "burn", "fire.true-memory", "fire.flame");
  assert.deepEqual(first.actions, second.actions, "actor/camera/audio actions are deterministic");
  assert.equal(first.state.storyObjectStates["fire.true-memory"], "preserved");
  assert.ok(first.actions.some((action) => action.type === "silence"));
});

test("Heart choice excludes its alternatives while allowing constructive Womb carrying", () => {
  let state = fresh("climb.heart");
  state = send(state, "pickup", "heart.feather").state;
  assert.deepEqual(send(state, "pickup", "heart.rose").eventIds, []);
  state = { ...state, sceneId: "climb.womb" };
  state = send(state, "pickup", "womb.page").state;
  assert.equal(state.storyObjectStates["womb.page"], "carried");
  state = send(state, "drop", "womb.page").state;
  state = send(state, "pickup", "womb.page").state;
  state = send(state, "place", "womb.page", "womb.writing-place").state;
  assert.equal(state.storyObjectStates["womb.creation"], "voice");
  assert.equal(state.storyObjectStates["heart.memory"], "swan-feather");
});

test("Surrender includes the quiet clearing without an undisclosed standing target and retains its duration", () => {
  const fabric = STORY_OBJECT_DEFINITIONS.find(object => object.id === "river.white-fabric");
  for (const [x, z] of [[0, 0], [-5, 0], [5, 1], [0, -5]]) {
    assert.ok(Math.hypot(x - fabric.localPosition[0], z - fabric.localPosition[2]) < fabric.radius);
  }
  const state = fresh("river.release-surrender");
  state.completedStoryEventIds = ["river.birds-released"];
  assert.deepEqual(send(state, "stillness", fabric.id, undefined, 7599).eventIds, []);
  const accepted = send(state, "stillness", fabric.id, undefined, 7600);
  assert.ok(accepted.eventIds.includes("river.surrender"));
  assert.equal(accepted.state.storyObjectStates[fabric.id], "raised");
});

test("stillness and reverse-light must finish before constellation can be witnessed", () => {
  let state = fresh("epilogue.constellation");
  state.worldFlags["lantern.placed-and-lit"] = true;
  state = send(state, "scene-enter").state;
  assert.deepEqual(send(state, "stillness", undefined, undefined, 5000).eventIds, []);
  assert.deepEqual(send(state, "sequence-complete", undefined, undefined, 23999).eventIds, []);
  assert.deepEqual(send(state, "sequence-complete", undefined, undefined, Infinity).eventIds, []);
  state = send(state, "sequence-complete", undefined, undefined, 24000).state;
  state = send(state, "stillness", undefined, undefined, 4200).state;
  assert.equal(isSceneStoryComplete(state), true);
});

test("finite persistence rejects arbitrary objects, strings, placement injection and excessive carrying", () => {
  const state = sanitizeStoryEventPersistence({
    sceneId: "fire.boundary",
    completedStoryEventIds: ["broken-floor.inversion", "private-secret", "broken-floor.inversion"],
    storyObjectStates: { "fire.true-memory": "burned", "fire.false-promise": "carried", "fire.old-marker": "carried", "heart.feather": "carried", unknown: "private text" },
    storyPlacementStates: { "lantern.master": "window", "fire.false-promise": "arbitrary", private: "secret" },
  });
  assert.deepEqual(state.completedStoryEventIds, ["broken-floor.inversion"]);
  assert.equal(state.storyObjectStates["fire.true-memory"], undefined);
  assert.equal(state.storyObjectStates["fire.old-marker"], "resting");
  assert.equal(state.storyObjectStates["heart.feather"], "carried");
  assert.deepEqual(state.storyPlacementStates, { "lantern.master": "window" });
});

test("old completed scenes remain traversable without inventing private choices", () => {
  const state = sanitizeStoryJourneyState({
    schemaVersion: 2, activeEntryId: "fragment-044", completedSceneIds: ["climb.heart", "climb.womb", "fork.relinquish-hope"],
    completedStoryEventIds: [], inventory: { lantern: true, recoveredKeys: [], symbolicObjects: ["memory.chosen-heart", "creation.chosen-future"] },
  }, options);
  assert.equal(isSceneStoryComplete(state, "climb.heart"), true);
  assert.equal(state.storyObjectStates["heart.memory"], undefined);
  assert.equal(state.storyObjectStates["womb.creation"], undefined);
  assert.equal(state.storyObjectStates["lantern.master"], "carried");
});


test("navigation-only cloud restore cannot replace local event evidence with empty defaults", () => {
  let current = send(fresh(), "scene-enter").state;
  current = send(current, "wipe", "broken-floor.reflection").state;
  const remote = sanitizeJourney({ activeEntryId: "fragment-003", history: ["fragment-001"], visitedEntryIds: ["fragment-001", "fragment-003"] });
  assert.equal(remote.migratedFromNavigation, true);
  const merged = mergeCloudJourneyState(current, remote, options);
  assert.deepEqual(merged.completedStoryEventIds, current.completedStoryEventIds);
  assert.deepEqual(merged.storyObjectStates, current.storyObjectStates);
  assert.deepEqual(merged.worldFlags, current.worldFlags);
});

test("first event entry reconciles earned legacy completion without synthesizing interactions", () => {
  const waiting = { ...fresh(), witnessedEntryIds: ["fragment-001"] };
  assert.equal(reconcileLegacyStoryEventEntry(waiting), waiting);
  const accepted = {
    ...waiting,
    completedRitualIds: ["ritual.accept-lantern"],
    worldFlags: { "path.first-wood-readable": true, "guidance.fireflies-awake": true },
    inventory: { ...waiting.inventory, lantern: true },
  };
  assert.equal(canCompleteScene(waiting.sceneId, accepted), true);
  const recovered = reconcileLegacyStoryEventEntry(accepted);
  assert.ok(recovered.completedSceneIds.includes("broken-floor.confession"));
  assert.ok(recovered.completedChapterIds.includes("broken-floor"));
  assert.deepEqual(recovered.completedStoryEventIds, []);
  assert.deepEqual(recovered.storyObjectStates, {});
  assert.equal(recovered.storyCompleted, false);
  const entered = send(recovered, "scene-enter").state;
  assert.equal(isSceneStoryComplete(entered), true);
  assert.deepEqual(entered.completedStoryEventIds, ["broken-floor.confession.enter"]);

  // An event-enabled run must still perform its own two wipes and touch,
  // even if it happens to have the old coarse ritual flag.
  const current = send(accepted, "scene-enter").state;
  assert.equal(reconcileLegacyStoryEventEntry(current), current);
  assert.equal(canCompleteScene(current.sceneId, current), false);
});

test("navigation-only cloud restore retains the final light gate and local earned mechanics", () => {
  const current = sanitizeStoryJourneyState({
    ...fresh("epilogue.constellation"),
    completedStoryEventIds: ["epilogue.constellation.enter", "epilogue.reverse-light-started"],
    completedRitualIds: ["ritual.place-lantern", "ritual.surrender"],
    storyObjectStates: { "lantern.master": "placed", "lantern.final-placement": "window", "epilogue.reverse-light": "running", "heart.memory": "blush-rose", "heart.rose": "carried", "womb.creation": "voice" },
    storyPlacementStates: { "lantern.master": "window" },
    worldFlags: { "story-events.started": true, "lantern.placed-and-lit": true, "lantern.owned": true },
    inventory: { lantern: true, recoveredKeys: ["key.protection", "key.self-permission"], symbolicObjects: ["memory.heart.tenderness", "creation.future.voice"] },
    landmarkStates: { "landmark.crowned-gate": "released" },
    resonances: { wolf: 30, swan: 35, seer: 27 },
    releasedWords: ["hope"],
    storyStarted: true,
  }, options);
  const remote = sanitizeJourney({ activeEntryId: current.activeEntryId, history: [], visitedEntryIds: [current.activeEntryId] });
  const merged = mergeCloudJourneyState(current, remote, options);
  for (const key of ["worldFlags", "completedRitualIds", "inventory", "landmarkStates", "resonances", "releasedWords", "storyObjectStates", "storyPlacementStates", "completedStoryEventIds"]) assert.deepEqual(merged[key], current[key], key);
  assert.equal(isSceneStoryComplete(merged), false);
  assert.deepEqual(send(merged, "drop", "lantern.master").eventIds, []);
  assert.deepEqual(send(merged, "sequence-complete", undefined, undefined, 23999).eventIds, []);
  assert.deepEqual(send(merged, "stillness", undefined, undefined, 99999).eventIds, []);
  assert.equal(send(merged, "sequence-complete", undefined, undefined, 24000).state.storyObjectStates["epilogue.reverse-light"], "complete");
});

test("legacy Fork completion transfers its earned lantern into physical carrying before event opt-in", () => {
  const completedSceneIds = journeyScenes.slice(0, journeyScenes.findIndex(scene => scene.id === "fork.relinquish-hope")).map(scene => scene.id);
  const current = {
    ...fresh("fork.relinquish-hope"),
    completedSceneIds,
    completedChapterIds: journeyChapters.filter(chapter => chapter.sceneIds.every(id => completedSceneIds.includes(id))).map(chapter => chapter.id),
    worldFlags: { "fork.old-hope-relinquished": true, "lantern.owned": true },
    witnessedEntryIds: [journeyScenes.find(scene => scene.id === "fork.relinquish-hope").keystoneEntryId],
  };
  const recovered = reconcileLegacyStoryEventEntry(current);
  assert.ok(recovered.completedSceneIds.includes("fork.relinquish-hope"));
  assert.equal(recovered.storyObjectStates["lantern.master"], "carried");
  assert.deepEqual(recovered.completedStoryEventIds, []);
  assert.equal(send(recovered, "scene-enter").state.storyObjectStates["lantern.master"], "carried");
});

test("navigation-only cloud restore preserves a chosen material's drop and recovery", () => {
  let current = send(fresh("climb.womb"), "scene-enter").state;
  current = send(current, "pickup", "womb.linen").state;
  current = send(current, "drop", "womb.linen").state;
  const remote = sanitizeJourney({ activeEntryId: current.activeEntryId, history: [], visitedEntryIds: [current.activeEntryId] });
  let merged = mergeCloudJourneyState(current, remote, options);
  assert.equal(merged.worldFlags["story-events.started"], true);
  assert.equal(merged.storyObjectStates["womb.linen"], "resting");
  merged = send(merged, "pickup", "womb.linen").state;
  assert.equal(merged.storyObjectStates["womb.linen"], "carried");
  merged = send(merged, "place", "womb.linen", "womb.rest-space").state;
  assert.equal(merged.storyObjectStates["womb.creation"], "rest");
});


test("Nest objects can be set down and recovered across its adjacent scene areas", () => {
  let state = fresh("nest.two-hands");
  state = send(state, "pickup", "nest.protected-linen").state;
  state = send(state, "pickup", "nest.responsibility").state;
  state = { ...state, sceneId: "nest.unsupported-cycle", completedSceneIds: ["nest.two-hands"] };
  state = send(state, "drop", "nest.responsibility").state;
  assert.equal(state.storyObjectStates["nest.responsibility"], "resting");
  state = send(state, "pickup", "nest.responsibility").state;
  assert.equal(state.storyObjectStates["nest.responsibility"], "carried");
  state = { ...state, sceneId: "nest.protection" };
  state = send(state, "drop", "nest.protected-linen").state;
  state = send(state, "pickup", "nest.protected-linen").state;
  assert.equal(state.storyObjectStates["nest.protected-linen"], "carried");
});
