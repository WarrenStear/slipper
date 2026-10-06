import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  JOURNEY_BEAT_IDS_BY_ACT, JOURNEY_ENTRY_PROGRESS, JOURNEY_LANDMARK_IDS,
  JOURNEY_RECOVERED_KEY_IDS, JOURNEY_RITUAL_IDS, JOURNEY_SYMBOLIC_OBJECT_IDS,
  JOURNEY_WORLD_FLAG_IDS, journeyActs, journeyBeats, journeyChapters, journeyScenes,
  getJourneyChapterForEntry, getJourneySceneForEntry,
} from "../src/data/journeyBlueprint.ts";
import {
  canEnterNarrativeEntry, nextJourneyProgressionOutcome, nextRequiredEntry,
  nextRequiredScene, nextResolvableRitualForEntry,
} from "../src/lib/journeyProgression.ts";
import { JOURNEY_PLAYER_ACTIONS } from "../src/lib/journeyPlayerActions.ts";
import { deriveLanternNarrative } from "../src/lib/lanternNarrative.ts";
import { createFreshStoryJourneyState, sanitizeStoryJourneyState } from "../src/lib/storyJourneyState.ts";
import { getAvailableStoryEvents, getCarriedStoryObjects } from "../src/storyEvents/storyEventRegistry.ts";
import { dispatchStoryEventState } from "../src/storyEvents/storyEventState.ts";
import { resolveGuidedStory } from "../src/storyEvents/guidedStory.ts";
import { applyJourneyOutcome, applyPlayerActionOutcome } from "../src/narrative/StoryActions.ts";
import {
  canEnterJourneyEntry, canReadStoryEntry, journeyEntryLockMessage,
  selectOpeningReleased, selectReadyActTransformation, selectStoryLocation,
} from "../src/narrative/StorySelectors.ts";
import { deriveStoryRuntime, selectStoryProgression } from "../src/narrative/StoryRuntime.ts";

const entryIds = Object.keys(JOURNEY_ENTRY_PROGRESS);
const options = {
  fallbackEntryId: "fragment-001", validEntryIds: entryIds,
  entryProgress: JOURNEY_ENTRY_PROGRESS, beatIdsByAct: JOURNEY_BEAT_IDS_BY_ACT,
  ritualIds: JOURNEY_RITUAL_IDS, worldFlagIds: JOURNEY_WORLD_FLAG_IDS,
  landmarkIds: JOURNEY_LANDMARK_IDS, recoveredKeyIds: JOURNEY_RECOVERED_KEY_IDS,
  symbolicObjectIds: JOURNEY_SYMBOLIC_OBJECT_IDS,
  now: () => "2026-10-05T17:00:00.000Z",
};

function freeze(value) {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    for (const child of Object.values(value)) freeze(child);
    Object.freeze(value);
  }
  return value;
}

function fresh(overrides = {}) {
  return { ...createFreshStoryJourneyState(options), ...overrides };
}

function traceSink() {
  const calls = [];
  const actions = Object.fromEntries([
    "completeRitual", "setWorldFlag", "setLandmarkState", "addResonance", "awardLantern",
    "recoverKey", "collectSymbolicObject", "releaseWord", "completeAct", "completeStory",
  ].map(name => [name, (...args) => calls.push([name, ...args])]));
  return { calls, actions };
}

const commandFor = {
  "complete-ritual": outcome => ["completeRitual", outcome.ritualId],
  "set-world-flag": outcome => ["setWorldFlag", outcome.flagId, outcome.value],
  "set-landmark-state": outcome => ["setLandmarkState", outcome.landmarkId, outcome.state],
  "add-resonance": outcome => ["addResonance", outcome.resonance, outcome.amount],
  "award-lantern": () => ["awardLantern"],
  "recover-key": outcome => ["recoverKey", outcome.keyId],
  "collect-symbolic-object": outcome => ["collectSymbolicObject", outcome.objectId],
  "release-word": outcome => ["releaseWord", outcome.word],
  "complete-act": outcome => ["completeAct", outcome.actId],
  "complete-story": () => ["completeStory"],
};

test("runtime interpretation cannot witness or progress a fresh, restored, or completed frozen journey", () => {
  const migrated = sanitizeStoryJourneyState({
    activeEntryId: "fragment-008", history: ["fragment-001", "fragment-003"],
    visitedEntryIds: ["fragment-001", "fragment-003", "fragment-008"],
  }, options);
  const completed = fresh({
    activeEntryId: "fragment-066", completedChapterIds: journeyChapters.map(chapter => chapter.id),
    completedSceneIds: journeyScenes.map(scene => scene.id), witnessedEntryIds: entryIds,
    storyCompleted: true,
  });
  for (const fixture of [fresh(), migrated, completed]) {
    const state = freeze(fixture);
    const before = JSON.stringify(state);
    const first = deriveStoryRuntime(state);
    for (let frame = 0; frame < 240; frame++) assert.deepEqual(deriveStoryRuntime(state), first);
    assert.equal(JSON.stringify(state), before);
    assert.equal(first.canReadActiveEntry, state.witnessedEntryIds.includes(state.activeEntryId));
    assert.deepEqual(first.lantern, deriveLanternNarrative(state));
  }
  assert.equal(deriveStoryRuntime(freeze(fresh())).canReadActiveEntry, false);
});

test("all canonical scene interpretations agree with existing progression and event authorities", () => {
  assert.equal(entryIds.length, 66);
  assert.equal(journeyScenes.length, 32);
  assert.equal(journeyChapters.length, 12);
  for (const [index, scene] of journeyScenes.entries()) {
    const priorScenes = journeyScenes.slice(0, index).map(item => item.id);
    const priorChapterIds = journeyChapters.filter(chapter => chapter.sceneIds.every(id => priorScenes.includes(id))).map(item => item.id);
    const state = freeze(sanitizeStoryJourneyState(fresh({
      activeEntryId: scene.keystoneEntryId,
      completedSceneIds: priorScenes, completedChapterIds: priorChapterIds,
      witnessedEntryIds: journeyScenes.slice(0, index).map(item => item.keystoneEntryId),
    }), options));
    const runtime = deriveStoryRuntime(state);
    assert.equal(runtime.location.scene, getJourneySceneForEntry(state.activeEntryId));
    assert.equal(runtime.location.chapter, getJourneyChapterForEntry(state.activeEntryId));
    assert.equal(runtime.progression.nextScene, nextRequiredScene(state));
    assert.equal(runtime.progression.nextEntryId, nextRequiredEntry(state));
    assert.equal(runtime.progression.nextRitual, nextResolvableRitualForEntry(state.activeEntryId, state));
    assert.deepEqual(runtime.progression.nextOutcome, nextJourneyProgressionOutcome(state));
    assert.deepEqual(runtime.availableEvents, getAvailableStoryEvents(state));
    assert.deepEqual(runtime.carriedObjects, getCarriedStoryObjects(state));
    assert.deepEqual(runtime.guidedMoment, resolveGuidedStory(state));
    for (const entryId of entryIds) {
      assert.equal(canEnterJourneyEntry(entryId, state.activeEntryId, state),
        entryId === state.activeEntryId || canEnterNarrativeEntry(entryId, state));
    }
  }
});

test("visited navigation and eligible scenes do not disclose unwitnessed fragments", () => {
  const state = freeze(fresh({ visitedEntryIds: entryIds, history: entryIds.slice(0, 4) }));
  assert.equal(canEnterJourneyEntry("fragment-002", state.activeEntryId, state), true);
  for (const entryId of entryIds) assert.equal(canReadStoryEntry(entryId, state), false);
  assert.equal(canReadStoryEntry("", state), false);
  const witnessed = freeze({ ...state, witnessedEntryIds: ["fragment-001"] });
  assert.equal(canReadStoryEntry("fragment-001", witnessed), true);
  assert.equal(canReadStoryEntry("fragment-002", witnessed), false);
  assert.equal(canReadStoryEntry("fragment-008", witnessed), false);
});

test("navigation-only compatibility keeps the existing lantern and ordered-act gates", () => {
  const navigation = freeze({ completedActs: [], inventory: fresh().inventory, visitedEntryIds: ["fragment-001"] });
  assert.equal(canEnterJourneyEntry("fragment-008", "fragment-001", navigation), false);
  assert.equal(canEnterJourneyEntry("fragment-001", "fragment-001", navigation), true);
  const visited = freeze({ ...navigation, visitedEntryIds: ["fragment-001", "fragment-008"] });
  assert.equal(canEnterJourneyEntry("fragment-008", "fragment-001", visited), true);
  const withLantern = { ...navigation, inventory: { ...navigation.inventory, lantern: true } };
  for (const [index, act] of journeyActs.entries()) {
    const earned = freeze({ ...withLantern, completedActs: journeyActs.slice(0, index).map(prior => prior.id) });
    assert.equal(canEnterJourneyEntry(act.entryIds[0], "fragment-001", earned), true, act.id);
    if (index > 0) assert.equal(canEnterJourneyEntry(act.entryIds[0], "fragment-001", freeze(withLantern)), false, act.id);
  }
  const migrated = freeze(sanitizeStoryJourneyState({
    schemaVersion: 1, activeEntryId: "fragment-040", history: ["fragment-001", "fragment-008"],
    visitedEntryIds: ["fragment-001", "fragment-008", "fragment-040"],
  }, options));
  assert.equal(migrated.schemaVersion, 2);
  assert.equal(selectStoryLocation(migrated).scene.id, migrated.sceneId);
  assert.equal(selectStoryProgression(migrated).nextEntryId, nextRequiredEntry(migrated));
});

test("each durable opening release path survives without granting lantern ownership", () => {
  assert.equal(selectOpeningReleased(freeze(fresh())), false);
  for (const evidence of [
    { storyObjectStates: { "broken-floor.reflection": "inverted" } },
    { inventory: { ...fresh().inventory, lantern: true } },
    { completedRitualIds: ["ritual.accept-lantern"] },
  ]) assert.equal(selectOpeningReleased(freeze(fresh(evidence))), true);
  let state = fresh();
  for (const eventId of ["broken-floor.first-wipe", "broken-floor.forest-revealed", "broken-floor.inversion"]) {
    state = dispatchStoryEventState(state, {
      sceneId: state.sceneId, eventId, trigger: eventId.endsWith("inversion") ? "touch" : "wipe",
      objectId: "broken-floor.reflection",
    }).state;
  }
  assert.equal(deriveStoryRuntime(freeze(state)).openingReleased, true);
  assert.equal(state.inventory.lantern, false);
});

test("legacy act transformations require all authored conditions and every prior act", () => {
  for (const [index, act] of journeyActs.entries()) {
    const state = fresh({
      completedActs: journeyActs.slice(0, index).map(prior => prior.id),
      witnessedEntryIds: entryIds, completedRitualIds: JOURNEY_RITUAL_IDS,
      worldFlags: Object.fromEntries(JOURNEY_WORLD_FLAG_IDS.map(id => [id, true])),
      inventory: { lantern: true, recoveredKeys: [...JOURNEY_RECOVERED_KEY_IDS], symbolicObjects: [] },
    });
    const ready = selectReadyActTransformation(act.id, freeze(state));
    assert.equal(ready?.role, "transformation", act.id);
    assert.ok(ready.outcomes.some(outcome => outcome.type === "complete-act" && outcome.actId === act.id));
    assert.equal(selectReadyActTransformation(act.id, freeze({ ...state, completedActs: [...state.completedActs, act.id] })), undefined);
    if (index) assert.equal(selectReadyActTransformation(act.id, freeze({ ...state, completedActs: [] })), undefined);
    for (const condition of act.completionRequirements) {
      const missing = structuredClone(state);
      if (condition.type === "entry-witnessed") missing.witnessedEntryIds = missing.witnessedEntryIds.filter(id => id !== condition.entryId);
      if (condition.type === "ritual-complete") missing.completedRitualIds = missing.completedRitualIds.filter(id => id !== condition.ritualId);
      if (condition.type === "world-flag") missing.worldFlags[condition.flagId] = !(condition.value ?? true);
      if (condition.type === "inventory-lantern") missing.inventory.lantern = false;
      if (condition.type === "inventory-key") missing.inventory.recoveredKeys = missing.inventory.recoveredKeys.filter(id => id !== condition.keyId);
      if (condition.type === "act-complete") missing.completedActs = missing.completedActs.filter(id => id !== condition.actId);
      assert.equal(selectReadyActTransformation(act.id, freeze(missing)), undefined, `${act.id}: ${condition.type}`);
    }
  }
});

test("shared dispatch preserves every authored outcome and explicit false flag value", () => {
  const outcomes = journeyBeats.flatMap(beat => beat.outcomes ?? []);
  outcomes.push({ type: "set-world-flag", flagId: "path.first-wood-readable", value: false });
  const before = JSON.stringify(outcomes);
  const { calls, actions } = traceSink();
  for (const outcome of outcomes) applyJourneyOutcome(freeze(outcome), actions);
  assert.deepEqual(calls, outcomes.map(outcome => commandFor[outcome.type](outcome)));
  assert.equal(JSON.stringify(outcomes), before);
  assert.deepEqual(new Set(outcomes.map(outcome => outcome.type)), new Set(Object.keys(commandFor)));
});

test("physical and accessible action outcomes use the same canonical command translation", () => {
  for (const action of JOURNEY_PLAYER_ACTIONS) {
    for (const outcomes of [action.outcomes ?? [], ...(action.choices ?? []).map(choice => choice.outcomes)]) {
      const physical = traceSink(), accessible = traceSink();
      const before = JSON.stringify(outcomes);
      for (const outcome of outcomes) {
        applyPlayerActionOutcome(freeze(outcome), physical.actions);
        applyPlayerActionOutcome(outcome, accessible.actions);
      }
      assert.deepEqual(physical.calls, accessible.calls, action.id);
      assert.deepEqual(physical.calls, outcomes.map(outcome => outcome.type === "set-world-flag"
        ? ["setWorldFlag", outcome.flagId] : commandFor[outcome.type](outcome)));
      assert.equal(JSON.stringify(outcomes), before);
    }
  }
});

test("narrative boundaries have no renderer, storage, timers, or alternate store and both journeys consume them", () => {
  for (const name of ["StorySelectors", "StoryActions", "StoryRuntime"]) {
    const source = readFileSync(new URL(`../src/narrative/${name}.ts`, import.meta.url), "utf8");
    assert.doesNotMatch(source, /from ["'][^"']*(?:react|three|zustand|stores|components)[^"']*["']/);
    assert.doesNotMatch(source, /\b(?:localStorage|sessionStorage|useFrame|setTimeout|setInterval|requestAnimationFrame)\b/);
  }
  const runtime = readFileSync(new URL("../src/narrative/StoryRuntime.ts", import.meta.url), "utf8");
  assert.match(runtime, /applyJourneyOutcome\(outcome, getState\(\)\)/);
  assert.match(runtime, /applyPlayerActionOutcome\(outcome, getState\(\)\)/);
  for (const name of ["components/three/journey/JourneyDirector", "components/ui/AccessibleStoryJourney",
    "components/three/storyEvents/StoryEventDirector", "components/ui/AccessibleStoryObjects"]) {
    const source = readFileSync(new URL(`../src/${name}.tsx`, import.meta.url), "utf8");
    assert.match(source, /useStoryRuntime/);
    assert.doesNotMatch(source, /function apply(?:Journey|Ritual|PlayerAction)Outcome/);
    assert.doesNotMatch(source, /\.(?:dispatchStoryEvent|witnessEntry|enterBeat|completeScene|completeChapter|completeStory)\(/);
  }
  assert.equal(journeyEntryLockMessage("unknown"), "That part of the wood is not open yet.");
  assert.match(journeyEntryLockMessage("fragment-008"), /will awaken when the current memory has settled/);
});
