import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import {
  getJourneyBeat,
  getJourneyBeatForEntry,
  getJourneyRitualBeatsForEntry,
  JOURNEY_BEAT_IDS_BY_ACT,
  JOURNEY_ENTRY_PROGRESS,
  JOURNEY_LANDMARK_IDS,
  JOURNEY_RECOVERED_KEY_IDS,
  JOURNEY_RITUAL_IDS,
  JOURNEY_SYMBOLIC_OBJECT_IDS,
  JOURNEY_WORLD_FLAG_IDS,
  journeyActs,
  journeyBeats,
  journeyBlueprint,
  nextRequiredJourneyEntryId,
  ritualEntryId,
  validateJourneyBlueprint,
} from "../src/data/journeyBlueprint.ts";
import { rawEntries } from "../src/data/slipperArchiveSource.ts";
import {
  journeyBeatTransitionDelay,
  resolveJourneyBeatTransition,
} from "../src/lib/journeyBeatTransition.ts";
import { JOURNEY_PLAYER_ACTIONS } from "../src/lib/journeyPlayerActions.ts";
import {
  JOURNEY_ACT_IDS,
  RESONANCE_KEYS,
  RITUAL_VERBS,
} from "../src/lib/storyJourneyState.ts";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const blueprintSource = fs.readFileSync(
  path.join(ROOT, "src/data/journeyBlueprint.ts"),
  "utf8",
);
const canonicalSourceSha256 = createHash("sha256")
  .update(fs.readFileSync(path.join(ROOT, "src/data/slipperArchiveSource.ts")))
  .digest("hex");
const canonicalEntries = [...rawEntries].sort(
  (a, b) => (a.sequence ?? 0) - (b.sequence ?? 0) || a.id.localeCompare(b.id),
);
const canonicalEntryIds = canonicalEntries.map((entry) => entry.id);
const canonicalIdSet = new Set(canonicalEntryIds);
const actIdSet = new Set(JOURNEY_ACT_IDS);
const ritualIdSet = new Set(JOURNEY_RITUAL_IDS);
const worldFlagIdSet = new Set(JOURNEY_WORLD_FLAG_IDS);
const landmarkIdSet = new Set(JOURNEY_LANDMARK_IDS);
const recoveredKeyIdSet = new Set(JOURNEY_RECOVERED_KEY_IDS);
const symbolicObjectIdSet = new Set(JOURNEY_SYMBOLIC_OBJECT_IDS);

test("the frozen canonical archive source remains byte-for-byte unchanged", () => {
  assert.equal(
    canonicalSourceSha256,
    "9fa57107a43241b2da59ed70b2fd6d6aaeea662144bfb42971df40dfa651e471",
  );
});

test("player-facing compatibility rituals do not expose system language", () => {
  const visibleRitualVerbs = journeyBeats.flatMap((beat) =>
    (beat.interactions ?? []).map((ritual) => ritual.verb),
  );
  assert.ok(!visibleRitualVerbs.includes("unlock"));
});

function conditionKey(condition) {
  if (condition.type === "entry-witnessed") return `entry:${condition.entryId}`;
  if (condition.type === "ritual-complete") return `ritual:${condition.ritualId}`;
  if (condition.type === "world-flag") return `flag:${condition.flagId}:${condition.value ?? true}`;
  if (condition.type === "inventory-key") return `key:${condition.keyId}`;
  if (condition.type === "act-complete") return `act:${condition.actId}`;
  return condition.type;
}

function referencedConditions() {
  return [
    ...journeyBeats.flatMap((beat) => beat.requiredState ?? []),
    ...journeyActs.flatMap((act) => act.completionRequirements),
  ];
}

test("the authored blueprint assigns all 66 canonical entries exactly once", () => {
  assert.equal(journeyActs.length, 6);
  assert.deepEqual(journeyActs.map((act) => act.id), [...JOURNEY_ACT_IDS]);
  assert.deepEqual(Object.keys(journeyBlueprint), [...JOURNEY_ACT_IDS]);
  assert.equal(canonicalEntries.length, 66);

  const assignedEntryIds = journeyActs.flatMap((act) => act.entryIds);
  assert.equal(assignedEntryIds.length, 66);
  assert.equal(new Set(assignedEntryIds).size, 66);
  assert.deepEqual([...assignedEntryIds].sort(), [...canonicalEntryIds].sort());
  assert.deepEqual(Object.keys(JOURNEY_ENTRY_PROGRESS).sort(), [...canonicalEntryIds].sort());
  assert.deepEqual(validateJourneyBlueprint(canonicalEntryIds), []);
  assert.deepEqual(
    journeyActs.map((act) => act.entryIds.length),
    [8, 13, 13, 5, 12, 15],
    "save-compatible phases must inherit the story's uneven chapter lengths",
  );

  for (const act of journeyActs) {
    for (const entryId of act.entryIds) {
      assert.equal(JOURNEY_ENTRY_PROGRESS[entryId].actId, act.id);
      assert.equal(getJourneyBeatForEntry(entryId)?.entryId, entryId);
    }
  }

  const deliberatelyWrongCatalogue = [...canonicalEntryIds.slice(1), "fragment-unknown"];
  assert.ok(validateJourneyBlueprint(deliberatelyWrongCatalogue).some((issue) => issue.includes("fragment-001")));
  assert.ok(validateJourneyBlueprint(deliberatelyWrongCatalogue).some((issue) => issue.includes("fragment-unknown")));
});

test("compatibility phases inherit all 32 narrative keystones and preserve every Echo", () => {
  let keystoneCount = 0;
  for (const act of journeyActs) {
    assert.ok(act.keystoneEntryIds.length > 0);
    keystoneCount += act.keystoneEntryIds.length;

    const keystoneSet = new Set(act.keystoneEntryIds);
    const echoSet = new Set(act.echoEntryIds);
    assert.equal(keystoneSet.size, act.keystoneEntryIds.length);
    assert.equal(echoSet.size, act.echoEntryIds.length);
    assert.deepEqual(
      act.entryIds.filter((entryId) => keystoneSet.has(entryId)),
      act.keystoneEntryIds,
    );
    assert.deepEqual(
      act.entryIds.filter((entryId) => !keystoneSet.has(entryId)),
      act.echoEntryIds,
    );
    assert.equal([...keystoneSet].filter((entryId) => echoSet.has(entryId)).length, 0);

    for (const entryId of act.keystoneEntryIds) {
      assert.equal(getJourneyBeatForEntry(entryId)?.role, "keystone");
    }
    for (const entryId of act.echoEntryIds) {
      const beat = getJourneyBeatForEntry(entryId);
      assert.equal(beat?.role, "echo");
      assert.equal(beat?.optional, true);
    }
  }
  assert.ok(keystoneCount >= 24 && keystoneCount <= 32);
});

test("main beats place every ritual immediately after its authored entry", () => {
  for (const [actIndex, act] of journeyActs.entries()) {
    const expectedMainBeatIds = [`${act.id}.arrival`];
    for (const entryId of act.entryIds) {
      if (act.keystoneEntryIds.includes(entryId)) {
        expectedMainBeatIds.push(getJourneyBeatForEntry(entryId).id);
      }
      expectedMainBeatIds.push(
        ...getJourneyRitualBeatsForEntry(entryId).map((beat) => beat.id),
      );
    }
    expectedMainBeatIds.push(
      `${act.id}.transformation`,
      `${act.id}.threshold`,
      `${act.id}.departure`,
    );

    assert.deepEqual(act.mainBeatIds, expectedMainBeatIds);
    for (let beatIndex = 0; beatIndex < act.mainBeatIds.length - 1; beatIndex += 1) {
      const beat = getJourneyBeat(act.mainBeatIds[beatIndex]);
      assert.deepEqual(beat?.nextBeatIds, [act.mainBeatIds[beatIndex + 1]]);
    }

    const departure = getJourneyBeat(act.mainBeatIds.at(-1));
    const nextAct = journeyActs[actIndex + 1];
    assert.deepEqual(
      departure?.nextBeatIds,
      nextAct ? [`${nextAct.id}.arrival`] : [],
    );
  }
});

test("runtime beat transitions settle one authored phase at a time", () => {
  const firstAct = journeyActs[0];
  const nextAct = journeyActs[1];
  const transformation = getJourneyBeat(`${firstAct.id}.transformation`);
  const threshold = getJourneyBeat(`${firstAct.id}.threshold`);
  const departure = getJourneyBeat(`${firstAct.id}.departure`);
  const arrival = getJourneyBeat(`${nextAct.id}.arrival`);
  const nextEntryBeat = getJourneyBeatForEntry(nextAct.entryIds[0]);
  const common = {
    currentAct: firstAct,
    activeEntryBeatId: nextEntryBeat.id,
    activeEntryWitnessed: false,
    canWitnessActiveEntry: true,
    completedActs: [firstAct.id],
    storyCompleted: false,
  };

  assert.deepEqual(
    resolveJourneyBeatTransition({
      ...common,
      currentBeat: transformation,
      activeActId: firstAct.id,
    }),
    { actId: firstAct.id, beatId: threshold.id, kind: "threshold-open" },
  );
  assert.equal(
    resolveJourneyBeatTransition({
      ...common,
      currentBeat: threshold,
      activeActId: firstAct.id,
    }),
    null,
    "the threshold must persist until the next region is actually crossed",
  );
  assert.deepEqual(
    resolveJourneyBeatTransition({
      ...common,
      currentBeat: threshold,
      activeActId: nextAct.id,
    }),
    { actId: firstAct.id, beatId: departure.id, kind: "departure" },
  );
  assert.deepEqual(
    resolveJourneyBeatTransition({
      ...common,
      currentBeat: departure,
      activeActId: nextAct.id,
    }),
    { actId: nextAct.id, beatId: arrival.id, kind: "arrival" },
  );
  assert.equal(
    resolveJourneyBeatTransition({
      ...common,
      currentBeat: arrival,
      currentAct: nextAct,
      activeActId: nextAct.id,
    }),
    null,
    "arrival must remain current until its entry has been witnessed",
  );
  assert.deepEqual(
    resolveJourneyBeatTransition({
      ...common,
      currentBeat: arrival,
      currentAct: nextAct,
      activeActId: nextAct.id,
      activeEntryWitnessed: true,
    }),
    { actId: nextAct.id, beatId: nextEntryBeat.id, kind: "entry" },
  );

  for (const kind of ["threshold-open", "departure", "arrival", "entry"]) {
    assert.ok(journeyBeatTransitionDelay(kind, false) > 0);
    assert.ok(
      journeyBeatTransitionDelay(kind, true) <=
        journeyBeatTransitionDelay(kind, false),
    );
  }
});

test("act completion requires every keystone witnessed and every ritual complete", () => {
  for (const act of journeyActs) {
    const expectedRequirements = [
      ...act.keystoneEntryIds.map((entryId) => `entry:${entryId}`),
      ...act.ritualIds.map((ritualId) => `ritual:${ritualId}`),
    ];
    assert.deepEqual(act.completionRequirements.map(conditionKey), expectedRequirements);

    const transformation = act.mainBeatIds
      .map((beatId) => getJourneyBeat(beatId))
      .find((beat) => beat?.role === "transformation");
    assert.ok(transformation);
    assert.deepEqual(
      transformation.requiredState.map(conditionKey),
      expectedRequirements,
    );
    assert.ok(
      transformation.outcomes.some(
        (outcome) => outcome.type === "complete-act" && outcome.actId === act.id,
      ),
      `${act.id} transformation must complete its own act`,
    );
  }
});

test("ritual and beat references resolve to authored entries and outcomes", () => {
  assert.equal(new Set(journeyBeats.map((beat) => beat.id)).size, journeyBeats.length);
  assert.equal(new Set(JOURNEY_RITUAL_IDS).size, JOURNEY_RITUAL_IDS.length);
  assert.deepEqual(
    Object.fromEntries(JOURNEY_ACT_IDS.map((actId) => [actId, JOURNEY_BEAT_IDS_BY_ACT[actId]])),
    Object.fromEntries(
      JOURNEY_ACT_IDS.map((actId) => [
        actId,
        journeyBeats.filter((beat) => beat.actId === actId).map((beat) => beat.id),
      ]),
    ),
  );

  const allBeatIds = new Set(journeyBeats.map((beat) => beat.id));
  for (const beat of journeyBeats) {
    assert.ok(actIdSet.has(beat.actId));
    if (beat.entryId) assert.ok(canonicalIdSet.has(beat.entryId));
    for (const nextBeatId of beat.nextBeatIds) assert.ok(allBeatIds.has(nextBeatId));

    if (beat.role !== "ritual") continue;
    assert.equal(beat.interactions?.length, 1);
    const interaction = beat.interactions[0];
    assert.ok(ritualIdSet.has(interaction.ritualId));
    assert.ok(RITUAL_VERBS.includes(interaction.verb));
    assert.equal(ritualEntryId(interaction.ritualId), beat.entryId);
    assert.ok(
      beat.requiredState?.some(
        (condition) => condition.type === "entry-witnessed" && condition.entryId === beat.entryId,
      ),
    );
    assert.ok(
      beat.outcomes?.some(
        (outcome) => outcome.type === "complete-ritual" && outcome.ritualId === interaction.ritualId,
      ),
    );
  }

  for (const condition of referencedConditions()) {
    if (condition.type === "entry-witnessed") assert.ok(canonicalIdSet.has(condition.entryId));
    if (condition.type === "ritual-complete") assert.ok(ritualIdSet.has(condition.ritualId));
    if (condition.type === "world-flag") assert.ok(worldFlagIdSet.has(condition.flagId));
    if (condition.type === "inventory-key") assert.ok(recoveredKeyIdSet.has(condition.keyId));
    if (condition.type === "act-complete") assert.ok(actIdSet.has(condition.actId));
  }
});

test("persistent outcome allowlists include ritual and transformation references", () => {
  const outcomes = journeyBeats.flatMap((beat) => beat.outcomes ?? []);
  const actionOutcomes = JOURNEY_PLAYER_ACTIONS.flatMap((action) => [
    ...(action.outcomes ?? []),
    ...(action.choices?.flatMap((choice) => choice.outcomes) ?? []),
  ]);
  const emittedWorldFlags = [...outcomes, ...actionOutcomes]
    .filter((outcome) => outcome.type === "set-world-flag")
    .map((outcome) => outcome.flagId);
  assert.equal(worldFlagIdSet.size, JOURNEY_WORLD_FLAG_IDS.length);
  assert.deepEqual(new Set(emittedWorldFlags), worldFlagIdSet);
  assert.ok(worldFlagIdSet.has("path.house-exit-open"));

  for (const outcome of outcomes) {
    if (outcome.type === "complete-ritual") assert.ok(ritualIdSet.has(outcome.ritualId));
    if (outcome.type === "set-world-flag") assert.ok(worldFlagIdSet.has(outcome.flagId));
    if (outcome.type === "set-landmark-state") assert.ok(landmarkIdSet.has(outcome.landmarkId));
    if (outcome.type === "add-resonance") assert.ok(RESONANCE_KEYS.includes(outcome.resonance));
    if (outcome.type === "recover-key") assert.ok(recoveredKeyIdSet.has(outcome.keyId));
    if (outcome.type === "collect-symbolic-object") assert.ok(symbolicObjectIdSet.has(outcome.objectId));
    if (outcome.type === "complete-act") assert.ok(actIdSet.has(outcome.actId));
  }

  const storyCompletions = journeyBeats.filter((beat) =>
    beat.outcomes?.some((outcome) => outcome.type === "complete-story"),
  );
  assert.deepEqual(
    storyCompletions.map((beat) => [beat.actId, beat.role]),
    [["crowned-return", "transformation"]],
  );
});

test("journey structure is explicitly authored rather than derived from content keywords", () => {
  assert.match(blueprintSource, /const COMPATIBILITY_PHASES = \[/);
  assert.match(blueprintSource, /chapterIds: \["broken-floor", "enchanted-wood"\]/);
  assert.match(blueprintSource, /const AUTHORED_ACTS: readonly AuthoredAct\[\] = COMPATIBILITY_PHASES\.map/);
  assert.doesNotMatch(blueprintSource, /from ["'][^"']*(?:storyGraph|worldState|slipperArchiveSource)[^"']*["']/);
  assert.doesNotMatch(
    blueprintSource,
    /\.(?:filter|find|sort)\([^\n]*(?:keyword|similarity|semanticScore|\.tags)/i,
  );
});

test("lantern guidance follows authored keystones and pauses at rituals", () => {
  const emptyProgress = {
    witnessedEntryIds: [],
    completedRitualIds: [],
    completedActs: [],
  };
  assert.equal(nextRequiredJourneyEntryId(emptyProgress), "fragment-001");

  assert.equal(
    nextRequiredJourneyEntryId({
      ...emptyProgress,
      witnessedEntryIds: ["fragment-001"],
    }),
    "fragment-001",
    "the opening ritual must keep guidance at its authored memory",
  );

  assert.equal(
    nextRequiredJourneyEntryId({
      ...emptyProgress,
      witnessedEntryIds: ["fragment-001"],
      completedRitualIds: ["ritual.accept-lantern"],
    }),
    journeyActs[0].keystoneEntryIds[1],
  );

  const firstAct = journeyBlueprint["first-wood"];
  assert.equal(
    nextRequiredJourneyEntryId({
      witnessedEntryIds: firstAct.keystoneEntryIds,
      completedRitualIds: firstAct.ritualIds,
      completedActs: ["first-wood"],
    }),
    journeyActs[1].keystoneEntryIds[0],
  );

  assert.equal(
    nextRequiredJourneyEntryId({
      witnessedEntryIds: journeyActs.flatMap((act) => act.keystoneEntryIds),
      completedRitualIds: journeyActs.flatMap((act) => act.ritualIds),
      completedActs: journeyActs.map((act) => act.id),
    }),
    undefined,
  );
});
