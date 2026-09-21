import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  deriveLanternNarrative,
  deriveLanternPhaseId,
  LANTERN_PHASE_IDS,
  LANTERN_PHASES,
} from "../src/lib/lanternNarrative.ts";

function lanternState(overrides = {}) {
  return {
    chapterId: "broken-floor",
    sceneId: "broken-floor.confession",
    completedActs: [],
    completedChapterIds: [],
    completedSceneIds: [],
    completedRitualIds: [],
    worldFlags: {},
    landmarkStates: {},
    inventory: { lantern: false, recoveredKeys: [], symbolicObjects: [] },
    storyStarted: false,
    storyCompleted: false,
    ...overrides,
  };
}

test("the lantern exposes seven explicit, ordered capacity phases", () => {
  assert.deepEqual(LANTERN_PHASE_IDS, [
    "distant",
    "borrowed",
    "unstable",
    "recognition",
    "ownership",
    "integrated",
    "released",
  ]);
  assert.equal(LANTERN_PHASES.length, 7);
  assert.deepEqual(LANTERN_PHASES.map((phase) => phase.order), [0, 1, 2, 3, 4, 5, 6]);
  assert.equal(LANTERN_PHASES[0].presence, "distant");
  assert.equal(LANTERN_PHASES.at(-1).presence, "placed");
  assert.ok(LANTERN_PHASES.at(-1).reach > LANTERN_PHASES[1].reach);
  assert.ok(LANTERN_PHASES.at(-1).stability > LANTERN_PHASES[2].stability);
  assert.ok(LANTERN_PHASES.at(-1).flicker < LANTERN_PHASES[2].flicker);
});

test("authored progress moves the lantern through every phase without granting ownership early", () => {
  const states = [
    lanternState(),
    lanternState({ inventory: { lantern: true, recoveredKeys: [], symbolicObjects: [] } }),
    lanternState({
      chapterId: "enchanted-wood",
      sceneId: "enchanted.rabbit-hole",
      inventory: { lantern: true, recoveredKeys: [], symbolicObjects: [] },
    }),
    lanternState({
      chapterId: "sunset-seer",
      sceneId: "sunset.true-mirror",
      inventory: { lantern: true, recoveredKeys: [], symbolicObjects: [] },
    }),
    lanternState({
      chapterId: "fork",
      sceneId: "fork.relinquish-hope",
      inventory: { lantern: true, recoveredKeys: [], symbolicObjects: [] },
      worldFlags: { "lantern.owned": true },
    }),
    lanternState({
      chapterId: "three-climbs",
      sceneId: "climb.mind",
      inventory: { lantern: true, recoveredKeys: [], symbolicObjects: [] },
    }),
    lanternState({
      chapterId: "lantern-epilogue",
      sceneId: "epilogue.constellation",
      inventory: { lantern: true, recoveredKeys: [], symbolicObjects: [] },
      worldFlags: { "lantern.owned": true, "lantern.placed-and-lit": true },
    }),
  ];

  assert.deepEqual(states.map(deriveLanternPhaseId), LANTERN_PHASE_IDS);
  assert.equal(deriveLanternNarrative(states[4]).title, "Owned light");
  assert.equal(
    deriveLanternPhaseId(lanternState({
      chapterId: "fork",
      sceneId: "fork.weighing",
      inventory: { lantern: true, recoveredKeys: [], symbolicObjects: [] },
    })),
    "recognition",
  );
});

test("starting the Broken Floor story does not grant or advance the lantern", () => {
  assert.equal(
    deriveLanternPhaseId(lanternState({ storyStarted: true })),
    "distant",
  );
  assert.equal(
    deriveLanternPhaseId(lanternState({
      storyStarted: true,
      completedRitualIds: ["ritual.accept-lantern"],
    })),
    "borrowed",
  );
});

test("authored rituals and outcomes preserve phase progress while revisiting earlier chapters", () => {
  const revisitingStart = {
    chapterId: "broken-floor",
    sceneId: "broken-floor.confession",
    inventory: { lantern: true, recoveredKeys: [], symbolicObjects: [] },
  };
  assert.equal(
    deriveLanternPhaseId(lanternState({
      ...revisitingStart,
      completedRitualIds: ["ritual.witness-mirror"],
    })),
    "recognition",
  );
  assert.equal(
    deriveLanternPhaseId(lanternState({
      ...revisitingStart,
      completedRitualIds: ["ritual.surrender"],
    })),
    "recognition",
  );
  assert.equal(
    deriveLanternPhaseId(lanternState({
      ...revisitingStart,
      completedRitualIds: ["ritual.surrender"],
      worldFlags: { "lantern.owned": true },
    })),
    "ownership",
  );
  assert.equal(
    deriveLanternPhaseId(lanternState({
      ...revisitingStart,
      completedSceneIds: ["climb.womb"],
    })),
    "integrated",
  );
  assert.equal(
    deriveLanternPhaseId(lanternState({
      ...revisitingStart,
      completedRitualIds: ["ritual.place-lantern"],
    })),
    "released",
  );
  assert.equal(
    deriveLanternPhaseId(lanternState({
      ...revisitingStart,
      landmarkStates: { "landmark.crowned-gate": "released" },
    })),
    "released",
  );
});

test("lantern phases are authored from state IDs rather than archive keyword matching", () => {
  const source = readFileSync(
    new URL("../src/lib/lanternNarrative.ts", import.meta.url),
    "utf8",
  );
  assert.doesNotMatch(source, /entry\.tags|emotionalTone|sceneKind/);
  assert.doesNotMatch(source, /fire\|ember|water\|mirror|crown\|return/);
});
