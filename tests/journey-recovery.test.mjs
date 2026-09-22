import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import test, { after } from "node:test";
import { build } from "vite";
import {
  JOURNEY_BEAT_IDS_BY_ACT,
  JOURNEY_ENTRY_PROGRESS,
  JOURNEY_LANDMARK_IDS,
  JOURNEY_RECOVERED_KEY_IDS,
  JOURNEY_RITUAL_IDS,
  JOURNEY_SYMBOLIC_OBJECT_IDS,
  JOURNEY_WORLD_FLAG_IDS,
} from "../src/data/journeyBlueprint.ts";
import { sanitizeJourneySnapshot } from "../src/lib/journeySnapshot.ts";
import { buildNarrativeWorldState } from "../src/lib/narrativeJourneyState.ts";
import {
  createFreshStoryJourneyState,
  JOURNEY_ACT_IDS,
  JOURNEY_HISTORY_LIMIT,
  mergeCloudJourneyNavigation,
  mergeCloudJourneyState,
  sanitizeStoryJourneyState,
} from "../src/lib/storyJourneyState.ts";
import { useBreadcrumbStore } from "../src/stores/useBreadcrumbStore.ts";

const validIds = ["threshold", "clearing", "river", "return"];
const fallbackEntryId = validIds[0];

const journeyStorageKey = "sidtw:journey:v3";
const canonicalEntryIds = Object.keys(JOURNEY_ENTRY_PROGRESS);
const storeTestDirectory = mkdtempSync(join(tmpdir(), "sidtw-journey-tests-"));
after(() => rmSync(storeTestDirectory, { recursive: true, force: true }));
let storeBundle;
let storeInstance = 0;

async function loadJourneyStore(t, storage) {
  // Use the app's bundler for extensionless imports and its import.meta.glob
  // content boundary, then exercise a fresh instance of the actual store.
  storeBundle ??= build({
    configFile: false,
    root: fileURLToPath(new URL("../", import.meta.url)),
    logLevel: "silent",
    define: { "process.env.NODE_ENV": '"test"' },
    build: {
      write: false,
      minify: false,
      lib: { entry: "src/stores/useJourneyStore.ts", formats: ["es"] },
      rollupOptions: { output: { inlineDynamicImports: true } },
    },
  }).then((result) => {
    const output = (Array.isArray(result) ? result[0] : result).output;
    const chunk = output.find((item) => item.type === "chunk");
    assert.ok(chunk);
    const filename = join(storeTestDirectory, "journey-store.mjs");
    writeFileSync(filename, chunk.code);
    return pathToFileURL(filename).href;
  });
  const browser = {};
  Object.defineProperty(browser, "localStorage", { configurable: true, get: () => storage() });
  for (const [key, descriptor] of [
    ["window", { configurable: true, value: browser }],
    ["localStorage", { configurable: true, get: () => storage() }],
  ]) {
    const previous = Object.getOwnPropertyDescriptor(globalThis, key);
    Object.defineProperty(globalThis, key, descriptor);
    t.after(() => {
      if (previous) Object.defineProperty(globalThis, key, previous);
      else delete globalThis[key];
    });
  }
  return (await import(`${await storeBundle}?instance=${++storeInstance}`)).useJourneyStore;
}

function memoryJourneyStorage(initial = []) {
  const values = new Map(initial);
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => { values.set(key, value); },
    removeItem: (key) => { values.delete(key); },
  };
}

function initializeStore(store, legacySnapshot) {
  store.getState().initializeJourney({
    fallbackEntryId: canonicalEntryIds[0],
    validEntryIds: canonicalEntryIds,
    legacySnapshot,
  });
}

test("a missing modern save imports legacy navigation instead of replacing it with a fresh opening", async (t) => {
  const storage = memoryJourneyStorage();
  const store = await loadJourneyStore(t, () => storage);
  assert.equal(store.getState().activeEntryId, "");
  assert.equal(store.getState().hasLocalJourney, false);

  initializeStore(store, {
    activeEntryId: "fragment-008",
    history: ["fragment-001", "fragment-003", "fragment-001"],
    visitedEntryIds: ["fragment-001", "fragment-003", "fragment-008"],
  });

  assert.equal(store.getState().activeEntryId, "fragment-008");
  assert.deepEqual(store.getState().history, ["fragment-001", "fragment-003", "fragment-001"]);
  assert.equal(store.getState().inventory.lantern, true);
  assert.equal(store.getState().hasLocalJourney, true);
  assert.equal(JSON.parse(storage.getItem(journeyStorageKey)).state.activeEntryId, "fragment-008");
});

test("a valid modern journey takes priority over legacy navigation", async (t) => {
  const storage = memoryJourneyStorage([[journeyStorageKey, JSON.stringify({
    version: 6,
    state: { schemaVersion: 2, activeEntryId: "fragment-008" },
  })]]);
  const store = await loadJourneyStore(t, () => storage);
  initializeStore(store, { activeEntryId: "fragment-003" });
  assert.equal(store.getState().activeEntryId, "fragment-008");
  assert.equal(store.getState().hasLocalJourney, true);
});

test("synthesized opening state differs from intentional local progress and reset", async (t) => {
  const storage = memoryJourneyStorage();
  const store = await loadJourneyStore(t, () => storage);
  initializeStore(store);
  assert.equal(store.getState().hasLocalJourney, false);
  assert.equal(store.getState().storyStarted, false);
  store.getState().startStory();
  assert.equal(store.getState().hasLocalJourney, true);
  store.getState().resetJourney("fragment-001");
  assert.equal(store.getState().storyStarted, false);
  assert.equal(store.getState().hasLocalJourney, true);
  assert.equal("hasLocalJourney" in store.getState().getSnapshot(), false);
  assert.equal(JSON.parse(storage.getItem(journeyStorageKey)).state.hasLocalJourney, true);
});

test("resetting an untouched journey is an intentional local change", async (t) => {
  const storage = memoryJourneyStorage();
  const store = await loadJourneyStore(t, () => storage);
  initializeStore(store);
  assert.equal(store.getState().hasLocalJourney, false);
  store.getState().resetJourney("fragment-001");
  assert.equal(store.getState().storyStarted, false);
  assert.equal(store.getState().hasLocalJourney, true);
});

test("generated opening provenance survives reload while an intentional reset stays authoritative", async (t) => {
  const storage = memoryJourneyStorage();
  await t.test("failed restore persists only a generated opening", async (subtest) => {
    const store = await loadJourneyStore(subtest, () => storage);
    initializeStore(store);
    store.getState().setCloudState({ cloudStatus: "error", cloudMessage: "Offline" });
    assert.equal(JSON.parse(storage.getItem(journeyStorageKey)).state.hasLocalJourney, false);
  });
  await t.test("reloading still permits recovery of an older cloud journey", async (subtest) => {
    const store = await loadJourneyStore(subtest, () => storage);
    initializeStore(store);
    assert.equal(store.getState().hasLocalJourney, false);
    store.getState().resetJourney("fragment-001");
    assert.equal(JSON.parse(storage.getItem(journeyStorageKey)).state.hasLocalJourney, true);
  });
  await t.test("reloading an intentional reset preserves local precedence", async (subtest) => {
    const store = await loadJourneyStore(subtest, () => storage);
    initializeStore(store);
    assert.equal(store.getState().hasLocalJourney, true);
    assert.equal(store.getState().storyStarted, false);
    assert.equal("hasLocalJourney" in store.getState().getSnapshot(), false);
  });
});

test("malformed persisted objects cannot hide a valid legacy journey", async (t) => {
  for (const [version, state] of [
    [6, {}],
    [5, {}],
    [6, { schemaVersion: 2, activeEntryId: "unknown", history: ["unknown"] }],
    [6, { schemaVersion: 2, activeEntryId: "fragment-001", hasLocalJourney: false }],
  ]) {
    await t.test(JSON.stringify({ version, state }), async (subtest) => {
      const storage = memoryJourneyStorage([[journeyStorageKey, JSON.stringify({ version, state })]]);
      const store = await loadJourneyStore(subtest, () => storage);
      initializeStore(store, { activeEntryId: "fragment-008", history: ["fragment-001"] });
      assert.equal(store.getState().activeEntryId, "fragment-008");
      assert.equal(store.getState().hasLocalJourney, true);
    });
  }
});

test("blocked storage never interrupts journey actions or reset and saving can recover", async (t) => {
  for (const failure of ["getter", "getItem", "setItem", "removeItem"]) {
    await t.test(failure, async (subtest) => {
      const storage = memoryJourneyStorage();
      let blocked = true;
      const failingStorage = Object.fromEntries(Object.entries(storage).map(([name, method]) => [
        name,
        (...args) => {
          if (blocked && name === failure) throw new Error(`storage ${name} denied`);
          return method(...args);
        },
      ]));
      const store = await loadJourneyStore(subtest, () => {
        if (blocked && failure === "getter") throw new Error("storage getter denied");
        return failingStorage;
      });

      assert.doesNotThrow(() => {
        initializeStore(store);
        store.getState().startStory();
        store.getState().witnessEntry("fragment-001");
        store.getState().navigateToEntry("fragment-008");
        store.getState().toggleBookmark("fragment-008");
      });
      assert.equal(store.getState().activeEntryId, "fragment-008");
      assert.deepEqual(store.getState().witnessedEntryIds, ["fragment-001"]);
      assert.deepEqual(store.getState().bookmarkedEntryIds, ["fragment-008"]);
      assert.doesNotThrow(() => store.getState().resetJourney("fragment-001"));
      assert.equal(store.getState().activeEntryId, "fragment-001");
      assert.deepEqual(store.getState().bookmarkedEntryIds, []);
      assert.deepEqual(store.getState().witnessedEntryIds, []);
      assert.doesNotThrow(() => store.persist.clearStorage());

      blocked = false;
      store.getState().navigateToEntry("fragment-008");
      assert.equal(JSON.parse(storage.getItem(journeyStorageKey)).state.activeEntryId, "fragment-008");
    });
  }
});

test("malformed saved JSON recovers without claiming an existing local journey", async (t) => {
  const storage = memoryJourneyStorage([[journeyStorageKey, "{invalid"]]);
  const store = await loadJourneyStore(t, () => storage);
  initializeStore(store);
  assert.equal(store.getState().activeEntryId, "fragment-001");
  assert.equal(store.getState().hasLocalJourney, false);
  store.getState().resetJourney("fragment-001");
  assert.equal(JSON.parse(storage.getItem(journeyStorageKey)).state.activeEntryId, "fragment-001");
});

const storyOptions = {
  fallbackEntryId,
  validEntryIds: validIds,
  entryProgress: {
    threshold: { actId: "first-wood", chapterId: "broken-floor", sceneId: "broken-floor.confession", beatId: "arrival" },
    clearing: { actId: "mirror-clearing", chapterId: "sunset-seer", sceneId: "sunset.true-mirror", beatId: "keystone" },
    river: { actId: "fire-and-river", chapterId: "fire-river", sceneId: "river.wash", beatId: "transformation" },
    return: { actId: "crowned-return", chapterId: "crowned-return", sceneId: "crowned.home", beatId: "departure" },
  },
  beatIdsByAct: Object.fromEntries(
    JOURNEY_ACT_IDS.map((actId) => [actId, ["arrival", "keystone", "transformation", "departure"]]),
  ),
  ritualIds: ["wash-at-mirror"],
  worldFlagIds: ["mirror-awake"],
  landmarkIds: ["mirror-pool"],
  recoveredKeyIds: ["blue-key"],
  symbolicObjectIds: ["white-feather"],
  now: () => "2026-09-12T00:00:00.000Z",
};

test("fresh story state starts before the prologue without granting a lantern", () => {
  const state = createFreshStoryJourneyState(storyOptions);

  assert.equal(state.schemaVersion, 2);
  assert.equal(state.actId, "first-wood");
  assert.equal(state.beatId, "arrival");
  assert.equal(state.storyStarted, false);
  assert.equal(state.storyCompleted, false);
  assert.equal(state.inventory.lantern, false);
  assert.deepEqual(state.resonances, { wolf: 0, swan: 0, seer: 0 });
  assert.deepEqual(state.witnessedEntryIds, []);
  assert.deepEqual(state.completedRitualIds, []);
  assert.deepEqual(state.worldFlags, {});
  assert.deepEqual(state.landmarkStates, {});
  assert.deepEqual(state.inventory.recoveredKeys, []);
  assert.deepEqual(state.inventory.symbolicObjects, []);
  assert.deepEqual(state.releasedWords, []);
  assert.deepEqual(state.completedActs, []);
  assert.deepEqual(state.completedChapterIds, []);
  assert.deepEqual(state.completedSceneIds, []);
  assert.equal(state.storyStartedAt, null);
  assert.equal(state.storyCompletedAt, null);
});

test("legacy journey migration preserves navigation progress and grants its existing lantern", () => {
  const state = sanitizeStoryJourneyState(
    {
      activeEntryId: "river",
      history: ["threshold", "clearing"],
      visitedEntryIds: ["threshold", "clearing", "river"],
      updatedAt: "2026-09-01T12:00:00.000Z",
    },
    storyOptions,
  );

  assert.equal(state.actId, "fire-and-river");
  assert.equal(state.beatId, "transformation");
  assert.equal(state.storyStarted, true);
  assert.equal(state.inventory.lantern, true);
  assert.deepEqual(state.witnessedEntryIds, ["threshold", "clearing", "river"]);
  assert.deepEqual(state.completedRitualIds, []);
  assert.equal(state.storyStartedAt, null);
});

test("versioned story sanitizer bounds hidden mechanics and filters blueprint IDs", () => {
  const state = sanitizeStoryJourneyState(
    {
      schemaVersion: 1,
      activeEntryId: "return",
      actId: "crowned-return",
      beatId: "departure",
      history: [],
      visitedEntryIds: ["return"],
      witnessedEntryIds: ["return", "unknown"],
      completedRitualIds: ["wash-at-mirror", "unknown"],
      worldFlags: { "mirror-awake": true, unknown: true },
      landmarkStates: { "mirror-pool": "released", unknown: "scarred", bad: "invalid" },
      resonances: { wolf: 140.4, swan: -8, seer: Number.NaN, unknown: 99 },
      inventory: {
        lantern: true,
        recoveredKeys: ["blue-key", "unknown"],
        symbolicObjects: ["white-feather", "unknown"],
      },
      releasedWords: ["  Surrender\u0000 now  ", "surrender now", ""],
      completedActs: ["crowned-return", "invalid"],
      storyStarted: true,
      storyCompleted: true,
      updatedAt: "invalid",
    },
    storyOptions,
  );

  assert.deepEqual(state.witnessedEntryIds, ["return"]);
  assert.deepEqual(state.completedRitualIds, ["wash-at-mirror"]);
  assert.deepEqual(state.worldFlags, { "mirror-awake": true });
  assert.deepEqual(state.landmarkStates, { "mirror-pool": "released" });
  assert.deepEqual(state.resonances, { wolf: 100, swan: 0, seer: 0 });
  assert.deepEqual(state.inventory.recoveredKeys, ["blue-key"]);
  assert.deepEqual(state.inventory.symbolicObjects, ["white-feather"]);
  assert.deepEqual(state.releasedWords, ["Surrender now"]);
  assert.equal(state.storyCompleted, false, "all six acts are required before story completion");
  assert.equal(state.updatedAt, storyOptions.now());
});

test("authored blueprint allowlists retain known story mechanics and reject unknown IDs", () => {
  const activeEntryId = "fragment-001";
  const progress = JOURNEY_ENTRY_PROGRESS[activeEntryId];
  assert.ok(progress);
  const ritualId = JOURNEY_RITUAL_IDS[0];
  const flagId = JOURNEY_WORLD_FLAG_IDS[0];
  const landmarkId = JOURNEY_LANDMARK_IDS[0];
  const recoveredKeyId = JOURNEY_RECOVERED_KEY_IDS[0];
  const symbolicObjectId = JOURNEY_SYMBOLIC_OBJECT_IDS[0];

  const state = sanitizeStoryJourneyState(
    {
      schemaVersion: 1,
      activeEntryId,
      actId: progress.actId,
      beatId: progress.beatId,
      history: [],
      visitedEntryIds: [activeEntryId],
      witnessedEntryIds: [activeEntryId, "unknown-entry"],
      completedRitualIds: [ritualId, "ritual.unknown"],
      worldFlags: { [flagId]: true, "flag.unknown": true },
      landmarkStates: { [landmarkId]: "awakened", "landmark.unknown": "scarred" },
      resonances: { wolf: 1, swan: 2, seer: 3 },
      inventory: {
        lantern: true,
        recoveredKeys: [recoveredKeyId, "key.unknown"],
        symbolicObjects: [symbolicObjectId, "memory.unknown"],
      },
      releasedWords: [],
      completedActs: [],
      storyStarted: true,
      storyCompleted: false,
      updatedAt: storyOptions.now(),
    },
    {
      fallbackEntryId: activeEntryId,
      validEntryIds: Object.keys(JOURNEY_ENTRY_PROGRESS),
      entryProgress: JOURNEY_ENTRY_PROGRESS,
      beatIdsByAct: JOURNEY_BEAT_IDS_BY_ACT,
      ritualIds: JOURNEY_RITUAL_IDS,
      worldFlagIds: JOURNEY_WORLD_FLAG_IDS,
      landmarkIds: JOURNEY_LANDMARK_IDS,
      recoveredKeyIds: JOURNEY_RECOVERED_KEY_IDS,
      symbolicObjectIds: JOURNEY_SYMBOLIC_OBJECT_IDS,
      now: storyOptions.now,
    },
  );

  assert.deepEqual(state.completedRitualIds, [ritualId]);
  assert.deepEqual(state.worldFlags, { [flagId]: true });
  assert.deepEqual(state.landmarkStates, { [landmarkId]: "awakened" });
  assert.deepEqual(state.inventory.recoveredKeys, [recoveredKeyId]);
  assert.deepEqual(state.inventory.symbolicObjects, [symbolicObjectId]);

  const sceneRewardRecovery = sanitizeStoryJourneyState(
    {
      ...state,
      inventory: { lantern: false, recoveredKeys: [], symbolicObjects: [] },
      completedSceneIds: [
        "nest.protection",
        "fork.relinquish-hope",
        "climb.heart",
        "climb.womb",
      ],
    },
    {
      fallbackEntryId: activeEntryId,
      validEntryIds: Object.keys(JOURNEY_ENTRY_PROGRESS),
      entryProgress: JOURNEY_ENTRY_PROGRESS,
      beatIdsByAct: JOURNEY_BEAT_IDS_BY_ACT,
      ritualIds: JOURNEY_RITUAL_IDS,
      worldFlagIds: JOURNEY_WORLD_FLAG_IDS,
      landmarkIds: JOURNEY_LANDMARK_IDS,
      recoveredKeyIds: JOURNEY_RECOVERED_KEY_IDS,
      symbolicObjectIds: JOURNEY_SYMBOLIC_OBJECT_IDS,
      now: storyOptions.now,
    },
  );
  assert.ok(sceneRewardRecovery.inventory.recoveredKeys.includes("key.protection"));
  assert.equal(sceneRewardRecovery.inventory.lantern, true);
  assert.ok(sceneRewardRecovery.inventory.symbolicObjects.includes("memory.chosen-heart"));
  assert.ok(sceneRewardRecovery.inventory.symbolicObjects.includes("creation.chosen-future"));
  assert.equal(sceneRewardRecovery.worldFlags["nest.protection-acknowledged"], true);
  assert.equal(sceneRewardRecovery.worldFlags["fork.old-hope-relinquished"], true);
  assert.equal(sceneRewardRecovery.worldFlags["lantern.owned"], true);
  assert.equal(sceneRewardRecovery.worldFlags["climb.heart.memory-chosen"], true);
  assert.equal(sceneRewardRecovery.worldFlags["climb.womb.creation-chosen"], true);
});

test("explicit story mechanics take priority over legacy entry keywords", () => {
  const fieryEntry = {
    id: "ember-entry",
    tags: ["fire", "ember", "flame"],
    engine3d: { symbolicWeight: 4 },
  };
  const content = {
    entryById: new Map([[fieryEntry.id, fieryEntry]]),
    totalCount: 66,
  };
  const navigation = {
    activeEntryId: fieryEntry.id,
    history: [],
    visitedEntryIds: [fieryEntry.id],
  };

  const legacy = buildNarrativeWorldState(navigation, content);
  assert.equal(legacy.fireCount, 1);
  assert.equal(legacy.waterCount, 0);

  const explicit = buildNarrativeWorldState(
    {
      ...navigation,
      completedRitualIds: ["ritual.accept-memory"],
      completedActs: ["blue-moon-archive"],
      worldFlags: { "archive.memory-carried": true },
      resonances: { wolf: 0, swan: 50, seer: 25 },
    },
    content,
  );
  assert.equal(explicit.fireCount, 0, "legacy fire keywords must not override authored progress");
  assert.ok(explicit.waterCount > 0);
  assert.ok(explicit.memoryCount > explicit.waterCount);
  assert.ok(explicit.explorationDepth > 0);
});

test("cloud navigation hydration cannot erase local story mechanics", () => {
  const local = sanitizeStoryJourneyState(
    {
      schemaVersion: 1,
      activeEntryId: "clearing",
      actId: "mirror-clearing",
      beatId: "keystone",
      history: ["threshold"],
      visitedEntryIds: ["threshold", "clearing"],
      witnessedEntryIds: ["clearing"],
      completedRitualIds: ["wash-at-mirror"],
      worldFlags: { "mirror-awake": true },
      landmarkStates: { "mirror-pool": "released" },
      resonances: { wolf: 2, swan: 8, seer: 5 },
      inventory: { lantern: true, recoveredKeys: ["blue-key"], symbolicObjects: ["white-feather"] },
      releasedWords: ["fear"],
      completedActs: ["first-wood"],
      storyStarted: true,
      storyCompleted: false,
      updatedAt: "2026-09-11T00:00:00.000Z",
    },
    storyOptions,
  );
  const hydrated = mergeCloudJourneyNavigation(
    local,
    {
      activeEntryId: "river",
      history: ["threshold", "clearing"],
      visitedEntryIds: ["threshold", "clearing", "river"],
      updatedAt: "2026-09-12T00:00:00.000Z",
    },
    storyOptions,
  );

  assert.equal(hydrated.activeEntryId, "river");
  assert.deepEqual(hydrated.completedRitualIds, local.completedRitualIds);
  assert.deepEqual(hydrated.worldFlags, local.worldFlags);
  assert.deepEqual(hydrated.landmarkStates, local.landmarkStates);
  assert.deepEqual(hydrated.resonances, local.resonances);
  assert.deepEqual(hydrated.inventory, local.inventory);
  assert.deepEqual(hydrated.releasedWords, local.releasedWords);
  assert.deepEqual(hydrated.completedActs, local.completedActs);
});

test("progressed cloud navigation gives a pristine local story only its recovery lantern", () => {
  const local = createFreshStoryJourneyState(storyOptions);
  const hydrated = mergeCloudJourneyNavigation(
    local,
    {
      activeEntryId: "river",
      history: ["threshold", "clearing"],
      visitedEntryIds: ["threshold", "clearing", "river"],
      updatedAt: "2026-09-12T00:00:00.000Z",
    },
    storyOptions,
  );

  assert.equal(hydrated.activeEntryId, "river");
  assert.equal(hydrated.actId, "fire-and-river");
  assert.equal(hydrated.beatId, "transformation");
  assert.equal(hydrated.storyStarted, true);
  assert.equal(hydrated.inventory.lantern, true);
  assert.deepEqual(hydrated.witnessedEntryIds, []);
  assert.deepEqual(hydrated.completedRitualIds, []);
  assert.deepEqual(hydrated.worldFlags, {});
  assert.deepEqual(hydrated.landmarkStates, {});
  assert.deepEqual(hydrated.resonances, { wolf: 0, swan: 0, seer: 0 });
  assert.deepEqual(hydrated.inventory.recoveredKeys, []);
  assert.deepEqual(hydrated.inventory.symbolicObjects, []);
  assert.deepEqual(hydrated.releasedWords, []);
  assert.deepEqual(hydrated.completedActs, []);
  assert.equal(hydrated.storyCompleted, false);
});

test("opening-only cloud navigation does not bypass the lantern ritual", () => {
  const local = createFreshStoryJourneyState(storyOptions);
  const hydrated = mergeCloudJourneyNavigation(
    local,
    {
      activeEntryId: fallbackEntryId,
      history: [],
      visitedEntryIds: [fallbackEntryId],
      updatedAt: "2026-09-12T00:00:00.000Z",
    },
    storyOptions,
  );

  assert.equal(hydrated.storyStarted, false);
  assert.equal(hydrated.inventory.lantern, false);
});

test("versioned cloud hydration restores the complete meaningful journey state", () => {
  const local = createFreshStoryJourneyState(storyOptions);
  const remote = sanitizeStoryJourneyState(
    {
      schemaVersion: 2,
      activeEntryId: "river",
      history: ["threshold", "clearing"],
      visitedEntryIds: ["threshold", "clearing", "river"],
      witnessedEntryIds: ["clearing", "river"],
      completedRitualIds: ["wash-at-mirror"],
      worldFlags: { "mirror-awake": true },
      landmarkStates: { "mirror-pool": "released" },
      resonances: { wolf: 12, swan: 34, seer: 56 },
      inventory: { lantern: true, recoveredKeys: ["blue-key"], symbolicObjects: ["white-feather"] },
      releasedWords: ["fear"],
      completedActs: ["first-wood"],
      completedChapterIds: ["broken-floor"],
      completedSceneIds: ["broken-floor.confession"],
      storyStarted: true,
      storyCompleted: false,
      updatedAt: "2026-09-12T00:00:00.000Z",
    },
    storyOptions,
  );

  const hydrated = mergeCloudJourneyState(
    local,
    { ...remote, cloudSchemaVersion: 2, migratedFromNavigation: false },
    storyOptions,
  );

  assert.deepEqual(hydrated, remote);
  assert.deepEqual(hydrated.completedRitualIds, ["wash-at-mirror"]);
  assert.deepEqual(hydrated.completedChapterIds, ["broken-floor"]);
  assert.deepEqual(hydrated.completedSceneIds, ["broken-floor.confession"]);
  assert.deepEqual(hydrated.inventory.recoveredKeys, ["blue-key"]);
});

test("scene relocation actions invalidate the mounted world without remounting physical crossings", () => {
  const appSource = readFileSync(
    new URL("../src/App.tsx", import.meta.url),
    "utf8",
  );
  const storeSource = readFileSync(
    new URL("../src/stores/useJourneyStore.ts", import.meta.url),
    "utf8",
  );

  assert.match(
    appSource,
    /key=\{`continuous-world:\$\{sceneRelocationRevision\}:\$\{sceneResetNonce\}`\}/,
    "the physics canvas must remount for both store-driven relocations and explicit UI jumps",
  );
  assert.match(
    storeSource,
    /goBack: \(\) => \{[\s\S]*?sceneRelocationRevision: state\.sceneRelocationRevision \+ 1,/,
  );
  assert.match(
    storeSource,
    /hydrateJourney: \(snapshot, options\) => \{[\s\S]*?sceneRelocationRevision: current\.sceneRelocationRevision \+ 1,/,
  );
  assert.match(
    storeSource,
    /resetJourney: \(initialEntryId\) => \{[\s\S]*?sceneRelocationRevision: state\.sceneRelocationRevision \+ 1,/,
  );

  const navigateAction = storeSource.match(
    /navigateToEntry: \(entryId\) => \{([\s\S]*?)\n        \},\n\n        markVisited:/,
  )?.[1];
  assert.ok(navigateAction);
  assert.doesNotMatch(
    navigateAction,
    /sceneRelocationRevision/,
    "physical clearing crossings use navigateToEntry and must remain continuous",
  );

  const cloudSnapshotBuilder = storeSource.match(
    /function cloudSnapshotFrom\(state: StoryJourneyState\): CloudJourneySnapshot \{([\s\S]*?)\n\}/,
  )?.[1];
  assert.ok(cloudSnapshotBuilder);
  assert.match(cloudSnapshotBuilder, /\.\.\.storySnapshotFrom\(state\)/);
  assert.match(cloudSnapshotBuilder, /cloudSchemaVersion: STORY_JOURNEY_SCHEMA_VERSION/);
  assert.match(cloudSnapshotBuilder, /migratedFromNavigation: false/);

  const storySnapshotBuilder = storeSource.match(
    /function storySnapshotFrom\(state: StoryJourneyState\): StoryJourneyState \{([\s\S]*?)\n\}/,
  )?.[1];
  assert.ok(storySnapshotBuilder);
  for (const field of [
    "witnessedEntryIds",
    "completedRitualIds",
    "worldFlags",
    "landmarkStates",
    "resonances",
    "inventory",
    "releasedWords",
    "completedChapterIds",
    "completedSceneIds",
    "storyCompleted",
  ]) {
    assert.match(storySnapshotBuilder, new RegExp(`${field}: state\\.${field}`));
  }
});

test("invalid persisted journey state recovers to a valid clearing", () => {
  const snapshot = sanitizeJourneySnapshot(
    {
      activeEntryId: "../../invalid",
      history: ["missing", validIds[1], validIds[1]],
      visitedEntryIds: ["missing", validIds[1], validIds[1]],
      updatedAt: "not-a-date",
    },
    fallbackEntryId,
    validIds,
  );

  assert.equal(snapshot.activeEntryId, fallbackEntryId);
  assert.deepEqual(snapshot.history, [validIds[1], validIds[1]]);
  assert.deepEqual(snapshot.visitedEntryIds, [fallbackEntryId, validIds[1]]);
  assert.ok(!Number.isNaN(Date.parse(snapshot.updatedAt)));
});

test("journey sanitizer retains the complete 66-fragment route and revisits in order", () => {
  const canonicalEntryIds = Object.keys(JOURNEY_ENTRY_PROGRESS);
  const completeRouteWithRevisits = [
    ...canonicalEntryIds,
    canonicalEntryIds[8],
    canonicalEntryIds[2],
    canonicalEntryIds[41],
    canonicalEntryIds[8],
  ];
  const snapshot = sanitizeJourneySnapshot(
    {
      schemaVersion: 2,
      activeEntryId: completeRouteWithRevisits.at(-1),
      history: [...completeRouteWithRevisits.slice(0, -1), "unknown"],
      visitedEntryIds: [...canonicalEntryIds, "unknown"],
      updatedAt: new Date(0).toISOString(),
    },
    canonicalEntryIds[0],
    canonicalEntryIds,
  );

  assert.equal(canonicalEntryIds.length, 66);
  assert.deepEqual(
    [...snapshot.history, snapshot.activeEntryId],
    completeRouteWithRevisits,
    "history must preserve the whole canonical route, repeat visits, and their order",
  );
  assert.deepEqual(snapshot.visitedEntryIds, canonicalEntryIds);
  assert.equal(snapshot.history.includes("unknown"), false);
});

test("journey sanitizer still applies the shared 512-step history bound", () => {
  const canonicalEntryIds = Object.keys(JOURNEY_ENTRY_PROGRESS);
  const overlongHistory = Array.from(
    { length: JOURNEY_HISTORY_LIMIT + 40 },
    (_, index) => canonicalEntryIds[index % canonicalEntryIds.length],
  );
  const snapshot = sanitizeJourneySnapshot(
    {
      schemaVersion: 2,
      activeEntryId: canonicalEntryIds.at(-1),
      history: overlongHistory,
      visitedEntryIds: canonicalEntryIds,
    },
    canonicalEntryIds[0],
    canonicalEntryIds,
  );

  assert.equal(snapshot.history.length, JOURNEY_HISTORY_LIMIT);
  assert.deepEqual(snapshot.history, overlongHistory.slice(0, JOURNEY_HISTORY_LIMIT));
});

test("the whole-journey reset clears transient breadcrumb traces", () => {
  const breadcrumbs = useBreadcrumbStore.getState();
  breadcrumbs.clearBreadcrumbs();
  breadcrumbs.addBreadcrumb({
    position: [2, 0, 4],
    yaw: 0,
    kind: "footprint",
    intensity: 1,
    scale: 1,
    activeEntryId: fallbackEntryId,
    trailState: "on-trail",
  });
  assert.equal(useBreadcrumbStore.getState().traces.length, 1);

  const drawerSource = readFileSync(
    new URL(
      "../src/components/ui/ExperienceSettingsDrawer.tsx",
      import.meta.url,
    ),
    "utf8",
  );
  const resetHandler = drawerSource.match(
    /const resetJourneySafely = \(\) => \{([\s\S]*?)\n  \};/,
  )?.[1];
  assert.ok(resetHandler, "the journey reset handler should remain available");
  assert.match(
    resetHandler,
    /clearStoredJourney\(\);\s+clearGiftDedicationAcknowledgement\(\);\s+clearBreadcrumbs\(\);\s+resetJourney\(destination\);/,
    "the reset handler should clear persisted journey state, presentation acknowledgement, and transient traces before rebuilding the journey",
  );

  breadcrumbs.clearBreadcrumbs();
  assert.deepEqual(useBreadcrumbStore.getState().traces, []);
});

test("global shortcuts and focusable reading surfaces keep their accessibility guards", () => {
  const appSource = readFileSync(
    new URL("../src/App.tsx", import.meta.url),
    "utf8",
  );
  const appStyles = readFileSync(
    new URL("../src/styles.css", import.meta.url),
    "utf8",
  );
  const archiveSource = readFileSync(
    new URL("../src/components/ui/AccessibleArchive.tsx", import.meta.url),
    "utf8",
  );

  assert.match(appSource, /if \(event\.defaultPrevented\) return;/);
  assert.match(appSource, /\[role='button'\].*\[role='tab'\].*\[role='radio'\]/);
  assert.match(appSource, /"--reader-text-min"/);
  assert.match(appSource, /role="document"\s+aria-labelledby="focused-reader-title"/);
  assert.match(appSource, /id="story-navigation"[\s\S]*?tabIndex=\{-1\}/);
  assert.match(
    archiveSource,
    /id="archive-fragments"\s+tabIndex=\{-1\}/,
  );
  assert.match(
    appStyles,
    /\.story-hud:focus-within\s*\{[\s\S]*?opacity: 1 !important;[\s\S]*?pointer-events: auto !important;/,
  );
});

test("mobile settings cannot strand the journey in desktop orbit mode", () => {
  const drawerSource = readFileSync(
    new URL(
      "../src/components/ui/ExperienceSettingsDrawer.tsx",
      import.meta.url,
    ),
    "utf8",
  );

  assert.match(drawerSource, /useMobileViewport\(\)/);
  assert.match(
    drawerSource,
    /mobileViewport\.isMobile && controls !== "walk"[\s\S]*?setControls\("walk"\)/,
  );
  assert.match(
    drawerSource,
    /experienceCapabilities\.allowFreeExploration && !mobileViewport\.isMobile \? \([\s\S]*?Desktop movement mode/,
  );
  assert.match(drawerSource, /tabIndex=\{isActive \? 0 : -1\}/);
  assert.match(drawerSource, /event\.key === "ArrowRight"/);
  assert.match(drawerSource, /QUALITY_DESCRIPTIONS\[option\]/);
});

test("the SVG map limits keyboard landmarks without removing pointer activation", () => {
  const mapSource = readFileSync(
    new URL("../src/components/ui/ConstellationMap.tsx", import.meta.url),
    "utf8",
  );

  assert.match(
    mapSource,
    /const isKeyboardLandmark = isActive \|\| isTarget;/,
  );
  assert.match(
    mapSource,
    /tabIndex=\{isKeyboardLandmark && actionAvailable \? 0 : -1\}/,
  );
  assert.match(
    mapSource,
    /aria-hidden=\{isKeyboardLandmark \? undefined : true\}/,
  );
  assert.match(mapSource, /onClick=\{\(\) => activateEntry\(storyNode\.entryId\)\}/);
});

test("threshold and archive paths defer scene-only map and image work", () => {
  const appSource = readFileSync(
    new URL("../src/App.tsx", import.meta.url),
    "utf8",
  );
  const viteSource = readFileSync(
    new URL("../vite.config.ts", import.meta.url),
    "utf8",
  );
  const packageJson = JSON.parse(
    readFileSync(new URL("../package.json", import.meta.url), "utf8"),
  );

  assert.match(
    appSource,
    /const ConstellationMap = lazy\([\s\S]*?import\("\.\/components\/ui\/ConstellationMap"\)/,
  );
  assert.match(
    appSource,
    /if \(!experienceStarted \|\| archiveOpen \|\| mode === "map"\) return;/,
  );
  assert.match(
    appSource,
    /from "\.\/lib\/navigationPresentation"/,
  );
  assert.doesNotMatch(
    appSource,
    /from "\.\/lib\/navigationResolver"/,
  );
  assert.match(viteSource, /return "react-vendor";/);
  assert.match(viteSource, /id\.includes\("vite\/preload-helper"\)/);
  assert.match(packageJson.scripts.build, /vite --config vite\.config\.ts build/);
});
