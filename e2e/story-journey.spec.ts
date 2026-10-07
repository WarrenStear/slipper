import { expect, test, type Locator, type Page } from "@playwright/test";
import { completeNextCinematicEvent } from "./cinematic-story-controls";
import { readFileSync } from "node:fs";
import {
  JOURNEY_ENTRY_CONTEXT,
  JOURNEY_ENTRY_PROGRESS,
  JOURNEY_LANDMARK_IDS,
  JOURNEY_RITUAL_IDS,
  JOURNEY_WORLD_FLAG_IDS,
  getJourneyRitualBeat,
  journeyChapters,
  journeyScenes,
} from "../src/data/journeyBlueprint";
import {
  JOURNEY_RITUAL_PROGRESSION,
  applyJourneySceneRewards,
  canEnterNarrativeEntry,
} from "../src/lib/journeyProgression";
import {
  JOURNEY_PLAYER_ACTIONS,
  inferJourneyPlayerActionEvidence,
} from "../src/lib/journeyPlayerActions";
import { deriveLanternNarrative } from "../src/lib/lanternNarrative";
import {
  JOURNEY_ACT_IDS,
  JOURNEY_HISTORY_LIMIT,
  type JourneyActId,
  type LandmarkState,
  type ResonanceKey,
  type StoryJourneyInventory,
  type StoryJourneyState,
} from "../src/lib/storyJourneyState";
import { DEDICATION_ACKNOWLEDGEMENT_STORAGE_KEY } from "./story-first-fixtures";

type StoryEntryFixture = {
  id: string;
  title: string;
};

type SnapshotOptions = {
  sceneIndex: number;
  completedSceneCount?: number;
  witnessCurrent?: boolean;
  completedRitualIds?: string[];
  completedActs?: JourneyActId[];
  inventory?: Partial<StoryJourneyInventory>;
  worldFlags?: Record<string, boolean>;
  completedActionIds?: string[];
  actionChoiceIds?: Record<string, string>;
  landmarkStates?: Record<string, LandmarkState>;
  resonances?: Partial<Record<ResonanceKey, number>>;
  releasedWords?: string[];
  storyStarted?: boolean;
  storyCompleted?: boolean;
};

const JOURNEY_STORAGE_KEY = "sidtw:journey:v3";
const JOURNEY_PERSIST_VERSION = 6;
const FIXED_TIME = "2026-09-13T08:00:00.000Z";

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
] as const;

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
] as const;

const worldState = JSON.parse(
  readFileSync(new URL("../src/data/worldState.json", import.meta.url), "utf8"),
) as { entries: StoryEntryFixture[] };
const entryById = new Map(worldState.entries.map((entry) => [entry.id, entry]));
const sceneIndexById = new Map(
  journeyScenes.map((scene, index) => [scene.id, index] as const),
);

function unique(values: readonly string[]) {
  return [...new Set(values)];
}

function ritualIdsBeforeSceneCount(completedSceneCount: number) {
  return JOURNEY_RITUAL_PROGRESSION
    .filter((ritual) => {
      const ritualSceneIndex = sceneIndexById.get(ritual.sceneId);
      return ritualSceneIndex !== undefined && ritualSceneIndex < completedSceneCount;
    })
    .map((ritual) => ritual.ritualId);
}

function ritualArtifacts(completedRitualIds: readonly string[]) {
  const rituals = new Set(completedRitualIds);
  const worldFlags: Record<string, boolean> = {};
  const landmarkStates: Record<string, LandmarkState> = {};
  const resonances: Record<ResonanceKey, number> = { wolf: 0, swan: 0, seer: 0 };

  if (rituals.has("ritual.accept-lantern")) {
    worldFlags["path.first-wood-readable"] = true;
    worldFlags["guidance.fireflies-awake"] = true;
    landmarkStates["landmark.first-wood-lantern"] = "awakened";
    resonances.seer += 6;
  }
  if (rituals.has("ritual.accept-memory")) {
    worldFlags["archive.memory-carried"] = true;
    worldFlags["archive.nostalgia-loops-closed"] = true;
    landmarkStates["landmark.blue-moon-archive"] = "witnessed";
    resonances.swan += 12;
  }
  if (rituals.has("ritual.witness-mirror")) {
    worldFlags["mirror.reflections-truthful"] = true;
    worldFlags["path.reflected-route-visible"] = true;
    landmarkStates["landmark.mirror"] = "scarred";
    resonances.seer += 12;
  }
  if (rituals.has("ritual.recover-key")) {
    worldFlags["thorn-door.open"] = true;
    worldFlags["thorn-house.collapsed-wing"] = true;
    landmarkStates["landmark.thorn-door"] = "transformed";
    resonances.wolf += 10;
  }
  if (rituals.has("ritual.burn-boundary")) {
    worldFlags["fire.boundary-burned"] = true;
    landmarkStates["landmark.fire-river"] = "scarred";
    resonances.wolf += 9;
  }
  if (rituals.has("ritual.wash-grief")) {
    worldFlags["river.grief-washed"] = true;
    resonances.swan += 9;
  }
  if (rituals.has("ritual.release-river-memory")) {
    worldFlags["river.memory-released"] = true;
    worldFlags["birds.black-swarm-released"] = true;
    landmarkStates["landmark.fire-river"] = "released";
  }
  if (rituals.has("ritual.surrender")) {
    worldFlags["surrender.white-flag-raised"] = true;
    worldFlags["path.crowned-return-visible"] = true;
    resonances.wolf += 4;
    resonances.swan += 4;
    resonances.seer += 4;
  }
  if (rituals.has("ritual.place-lantern")) {
    worldFlags["lantern.placed-and-lit"] = true;
    landmarkStates["landmark.crowned-gate"] = "released";
  }

  return { worldFlags, landmarkStates, resonances };
}

function explicitActionArtifacts(
  completedActionIds: readonly string[],
  actionChoiceIds: Readonly<Record<string, string>>,
) {
  const worldFlagIds: string[] = [];
  const symbolicObjectIds: string[] = [];
  let lantern = false;

  for (const actionId of completedActionIds) {
    const action = JOURNEY_PLAYER_ACTIONS.find((candidate) => candidate.id === actionId);
    if (!action) throw new Error(`Unknown story action ${actionId}`);
    const choiceId = actionChoiceIds[actionId];
    const choice = action.choices?.find((candidate) => candidate.id === choiceId);
    if (action.choices && !choice) {
      throw new Error(`Story action ${actionId} requires an explicit choice`);
    }
    const outcomes = choice?.outcomes ?? action.outcomes ?? [];
    for (const outcome of outcomes) {
      if (outcome.type === "set-world-flag") worldFlagIds.push(outcome.flagId);
      if (outcome.type === "collect-symbolic-object") symbolicObjectIds.push(outcome.objectId);
      if (outcome.type === "award-lantern") lantern = true;
    }
  }

  return {
    lantern,
    worldFlagIds: unique(worldFlagIds),
    symbolicObjectIds: unique(symbolicObjectIds),
  };
}

function buildJourneySnapshot(options: SnapshotOptions): StoryJourneyState {
  const completedSceneCount = options.completedSceneCount ?? options.sceneIndex;
  const activeScene = journeyScenes[options.sceneIndex];
  if (!activeScene) throw new Error(`Unknown scene index ${options.sceneIndex}`);

  const activeEntryId = activeScene.keystoneEntryId;
  const activeProgress = JOURNEY_ENTRY_PROGRESS[activeEntryId];
  if (!activeProgress) throw new Error(`Missing progress context for ${activeEntryId}`);

  const completedScenes = journeyScenes.slice(0, completedSceneCount);
  const completedSceneIds = completedScenes.map((scene) => scene.id);
  const completedSceneIdSet = new Set(completedSceneIds);
  const completedChapterIds = journeyChapters
    .filter((chapter) => chapter.sceneIds.every((sceneId) => completedSceneIdSet.has(sceneId)))
    .map((chapter) => chapter.id);
  const completedEntryIds = unique(completedScenes.flatMap((scene) => scene.entryIds));
  const witnessedEntryIds = unique([
    ...completedEntryIds,
    ...(options.witnessCurrent ? [activeEntryId] : []),
  ]);
  const visitedEntryIds = unique([
    journeyScenes[0].keystoneEntryId,
    ...completedEntryIds,
    activeEntryId,
  ]);
  const completedRitualIds = unique(
    options.completedRitualIds ?? ritualIdsBeforeSceneCount(completedSceneCount),
  );
  const artifacts = ritualArtifacts(completedRitualIds);
  const actionEvidence = inferJourneyPlayerActionEvidence(completedSceneIds);
  const explicitActionEvidence = explicitActionArtifacts(
    options.completedActionIds ?? [],
    options.actionChoiceIds ?? {},
  );
  const baseInventory: StoryJourneyInventory = {
    lantern: completedRitualIds.includes("ritual.accept-lantern"),
    recoveredKeys: completedRitualIds.includes("ritual.recover-key")
      ? ["key.self-permission"]
      : [],
    symbolicObjects: completedRitualIds.includes("ritual.accept-memory")
      ? ["memory.blue-moon"]
      : [],
  };
  const sceneRewardInventory = completedScenes.reduce(
    (current, scene) => applyJourneySceneRewards(scene.id, current),
    baseInventory,
  );
  const inventory: StoryJourneyInventory = {
    lantern:
      options.inventory?.lantern ??
      (sceneRewardInventory.lantern || explicitActionEvidence.lantern),
    recoveredKeys: unique([
      ...sceneRewardInventory.recoveredKeys,
      ...(options.inventory?.recoveredKeys ?? []),
    ]),
    symbolicObjects: unique([
      ...sceneRewardInventory.symbolicObjects,
      ...actionEvidence.symbolicObjectIds,
      ...explicitActionEvidence.symbolicObjectIds,
      ...(options.inventory?.symbolicObjects ?? []),
    ]),
  };
  const resonances: Record<ResonanceKey, number> = {
    ...artifacts.resonances,
    ...options.resonances,
  };
  const storyStarted = options.storyStarted ?? true;
  const storyCompleted = options.storyCompleted ?? false;

  return {
    schemaVersion: 2,
    actId: activeProgress.actId,
    chapterId: activeProgress.chapterId,
    sceneId: activeProgress.sceneId,
    beatId: activeProgress.beatId,
    activeEntryId,
    history: visitedEntryIds.filter((entryId) => entryId !== activeEntryId).slice(-JOURNEY_HISTORY_LIMIT),
    visitedEntryIds,
    witnessedEntryIds,
    completedRitualIds,
    worldFlags: {
      ...artifacts.worldFlags,
      ...Object.fromEntries(actionEvidence.worldFlagIds.map((flagId) => [flagId, true])),
      ...Object.fromEntries(explicitActionEvidence.worldFlagIds.map((flagId) => [flagId, true])),
      ...options.worldFlags,
    },
    landmarkStates: options.landmarkStates ?? artifacts.landmarkStates,
    resonances,
    inventory,
    releasedWords:
      options.releasedWords ??
      (completedRitualIds.includes("ritual.release-river-memory") ? ["hope"] : []),
    completedActs: options.completedActs ?? [],
    completedChapterIds,
    completedSceneIds,
    storyStarted: storyStarted || storyCompleted,
    storyCompleted,
    storyStartedAt: storyStarted || storyCompleted ? FIXED_TIME : null,
    storyCompletedAt: storyCompleted ? FIXED_TIME : null,
    updatedAt: FIXED_TIME,
  };
}

function finalJourneySnapshot() {
  return buildJourneySnapshot({
    sceneIndex: journeyScenes.length - 1,
    completedSceneCount: journeyScenes.length,
    completedRitualIds: [...JOURNEY_RITUAL_IDS],
    completedActs: [...JOURNEY_ACT_IDS],
    inventory: {
      lantern: true,
      recoveredKeys: ["key.protection", "key.self-permission"],
      symbolicObjects: [
        "memory.blue-moon",
        "memory.chosen-heart",
        "memory.heart.selfhood",
        "creation.chosen-future",
        "creation.future.home",
      ],
    },
    worldFlags: Object.fromEntries(JOURNEY_WORLD_FLAG_IDS.map((flagId) => [flagId, true])),
    landmarkStates: Object.fromEntries(
      JOURNEY_LANDMARK_IDS.map((landmarkId) => [
        landmarkId,
        landmarkId === "landmark.fire-river" || landmarkId === "landmark.crowned-gate"
          ? "released"
          : "transformed",
      ]),
    ) as Record<string, LandmarkState>,
    resonances: { wolf: 74, swan: 81, seer: 69 },
    releasedWords: ["fear", "waiting", "permission"],
    storyCompleted: true,
  });
}

async function prepareSnapshotHarness(page: Page) {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/?welcome=1", { waitUntil: "domcontentloaded" });
  await page.evaluate(() => {
    localStorage.clear();
    sessionStorage.clear();
  });
}

async function seedPersistedJourney(page: Page, snapshot: StoryJourneyState) {
  // This is the same versioned local persistence envelope used in production.
  // The test never reaches into the Zustand module or a window-scoped test API.
  // Seed from a same-origin static document so the currently mounted app cannot
  // persist its previous in-memory snapshot over the fixture during navigation.
  await page.goto("/version.json", { waitUntil: "domcontentloaded" });
  await page.evaluate(
    ({ key, version, journey }) => {
      localStorage.setItem(
        key,
        JSON.stringify({
          state: {
            ...journey,
            bookmarkedEntryIds: [],
            lastSafeEntryId: journey.activeEntryId,
            playerPosition: null,
          },
          version,
        }),
      );
    },
    { key: JOURNEY_STORAGE_KEY, version: JOURNEY_PERSIST_VERSION, journey: snapshot },
  );
}

async function openSeededConstellation(page: Page, snapshot: StoryJourneyState) {
  await seedPersistedJourney(page, snapshot);
  await page.evaluate((key) => {
    localStorage.setItem(
      key,
      JSON.stringify({ version: 1, acknowledged: true }),
    );
  }, DEDICATION_ACKNOWLEDGEMENT_STORAGE_KEY);
  await page.goto("/", { waitUntil: "domcontentloaded" });

  const onboarding = page.getByRole("dialog");
  await expect(onboarding).toBeVisible();
  await onboarding
    .getByRole("button", { name: "Return to the Woods", exact: true })
    .click();
  await storyModeButton(page, "map").click();

  const root = page.locator("[data-experience-root]");
  const constellation = page.locator(".constellation-panel");
  await expect(root).toHaveAttribute("data-world-mode", "map");
  await expect(root).toHaveAttribute("data-active-entry", snapshot.activeEntryId);
  await expect(constellation).toBeVisible();
  return { root, constellation };
}

async function openSeededDirectedJourney(page: Page, snapshot: StoryJourneyState) {
  await seedPersistedJourney(page, snapshot);
  await page.evaluate((key) => localStorage.removeItem(key), DEDICATION_ACKNOWLEDGEMENT_STORAGE_KEY);
  await page.goto("/?accessible=1", { waitUntil: "domcontentloaded" });
  const threshold = page.getByRole("dialog");
  await expect(threshold).toBeVisible();
  await threshold.locator(".onboarding-actions button").click();
  const root = page.locator("[data-accessible-journey='true']");
  await expect(root).toBeVisible();
  await expect(page.locator("canvas")).toHaveCount(0);
  await expect(root).toHaveAttribute("data-active-entry", snapshot.activeEntryId);
  await expect(root).toHaveAttribute(
    "data-experience-mode",
    snapshot.storyStarted ? "returning-journey" : "first-journey",
  );
  return root;
}

async function completedSceneCountInStorage(page: Page) {
  return page.evaluate((key) => {
    const raw = localStorage.getItem(key);
    if (!raw) return -1;
    const parsed = JSON.parse(raw) as {
      state?: { completedSceneIds?: unknown };
    };
    return Array.isArray(parsed.state?.completedSceneIds)
      ? parsed.state.completedSceneIds.length
      : -1;
  }, JOURNEY_STORAGE_KEY);
}

async function expectSceneCount(constellation: Locator, completed: number) {
  await expect(constellation.locator(".constellation-story-summary")).toContainText(
    `${completed}/32 scenes`,
  );
}

type JourneyUiMode = "explore" | "read" | "map";

const JOURNEY_UI_MODES: Record<JourneyUiMode, string> = {
  explore: "Forest",
  read: "Fragment",
  map: "Constellation",
};

const PREFERRED_ACTION_CHOICES: Readonly<Record<string, string>> = {
  "action.climb.heart.choose-memory": "heart.selfhood",
  "action.climb.womb.choose-creation": "future.home",
};

function experienceRoot(page: Page) {
  return page.locator("[data-experience-root]");
}

function storyModeButton(page: Page, mode: JourneyUiMode) {
  return page
    .getByRole("group", { name: "Story modes" })
    .getByRole("button", { name: JOURNEY_UI_MODES[mode], exact: true });
}

async function chooseJourneyMode(page: Page, mode: JourneyUiMode) {
  const root = experienceRoot(page);
  if ((await root.getAttribute("data-world-mode")) !== mode) {
    await storyModeButton(page, mode).click();
  }
  await expect(root).toHaveAttribute("data-world-mode", mode);
}

async function enableAssistedStillnessThroughUi(page: Page) {
  // The exploration layout intentionally hides the floating settings trigger
  // at compact viewport heights; its documented comma shortcut remains the
  // production keyboard control for the same drawer.
  await page.keyboard.press("Comma");
  const settings = page.getByRole("dialog", { name: "Experience settings" });
  await expect(settings).toBeVisible();
  const assistedStillness = settings.getByRole("button", {
    name: /^Assisted Stillness/,
  });
  await expect(assistedStillness).toHaveAttribute("aria-pressed", "false");
  await assistedStillness.focus();
  await assistedStillness.press("Enter");
  await expect(assistedStillness).toHaveAttribute("aria-pressed", "true");
  await page.keyboard.press("Escape");
  await expect(settings).not.toBeVisible();
}

async function completeLegacyRitualThroughUi(page: Page, ritualId: string) {
  const ritual = page.locator(`aside.ritual-interaction[data-ritual-id="${ritualId}"]`);
  await expect(ritual).toBeVisible({ timeout: 30_000 });
  const inputMode = await ritual.getAttribute("data-story-moment-mode");
  const ritualLabel = getJourneyRitualBeat(ritualId)?.interactions.find(
    (interaction) => interaction.ritualId === ritualId,
  )?.label;
  expect(ritualLabel, `missing presentation label for ${ritualId}`).toBeTruthy();

  if (inputMode !== "stillness") {
    expect(["hold", "press"]).toContain(inputMode);
    const control = ritual.getByRole("button").first();
    await control.focus();
    await control.press("Enter");
  } else {
    // Assisted Stillness was enabled through the visible Settings UI. Its
    // intentional control keeps controller/physics drift from interrupting
    // the same production stillness timer.
    await ritual.getByRole("button", { name: /enter stillness/i }).click();
  }

  // The aside can temporarily disappear if physical proximity is being
  // reconciled. Completion feedback is the durable UI acknowledgement that
  // the ritual really resolved rather than merely becoming unavailable.
  await expect(page.locator(".ritual-feedback.is-visible")).toContainText(
    ritualLabel!,
    { timeout: inputMode === "stillness" ? 24_000 : 12_000 },
  );
  await expect(ritual).toHaveCount(0, { timeout: 12_000 });
}

async function completeStoryActionThroughUi(page: Page, actionId: string) {
  const action = page.locator(`aside.story-moment[data-story-action-id="${actionId}"]`);
  await expect(action).toBeVisible({ timeout: 30_000 });
  const mode = await action.getAttribute("data-story-action-mode");
  const descriptor = JOURNEY_PLAYER_ACTIONS.find((candidate) => candidate.id === actionId);
  expect(descriptor, `missing story-action descriptor for ${actionId}`).toBeTruthy();
  const assistedApproach = action.getByRole("button", {
    name: /^Use an assisted approach to /,
  });

  if (await assistedApproach.isVisible().catch(() => false)) {
    // The journey's explicit accessibility setting supplies a sequential
    // equivalent for object-space actions when precision navigation is not
    // available. This still uses the production control and state gate.
    await assistedApproach.click({ timeout: 15_000 });
  } else if (mode === "stillness") {
    // Scene proximity can flicker for a frame while Rapier settles a relocated
    // player. Dispatch to the visible production button without Playwright's
    // multi-frame stability wait; completion is still proven by the game's
    // own feedback and persisted progression below.
    await action
      .getByRole("button", { name: "Enter assisted stillness" })
      .dispatchEvent("click");
    await expect(
      action.getByRole("button", { name: "Release assisted stillness" }),
    ).toBeVisible({ timeout: 5_000 });
  } else if (mode === "dual-hold") {
    await action
      .getByRole("button", { name: "Use an accessible two-hand hold" })
      .click();
  } else if (mode === "choice") {
    const choiceId = PREFERRED_ACTION_CHOICES[actionId];
    expect(choiceId, `missing representative choice for ${actionId}`).toBeTruthy();
    await action.locator(`[data-story-choice-id="${choiceId}"]`).click();
  } else if (mode === "move" || mode === "turn-and-move") {
    const movementControl = action.locator('[data-story-action-mode="accessible-move"]');
    await movementControl.click({ timeout: 15_000 });
  } else {
    expect(["hold", "press"]).toContain(mode);
    const control = action.getByRole("button").first();
    await control.focus();
    await control.press("Enter");
  }

  // Reduced-motion feedback is intentionally brief and can be superseded by
  // scene/chapter reconciliation. Causality is proved by this action leaving,
  // the next required action appearing in the loop, and Continue story only
  // unlocking after the scene's complete action chain.
  await expect(action).toHaveCount(0, { timeout: 15_000 });
}

async function continueToCanonicalScene(page: Page, expectedEntryId: string) {
  const root = experienceRoot(page);
  const continueStory = page.getByRole("button", { name: "Continue story" });
  const deadline = Date.now() + 20_000;

  // At chapter boundaries the scene and chapter reconciliation effects can
  // settle on adjacent frames. Retrying the same production control models a
  // patient reader without bypassing the lock or writing test state.
  while (Date.now() < deadline) {
    if (await continueStory.isEnabled()) await continueStory.click();
    if ((await root.getAttribute("data-active-entry")) === expectedEntryId) return;
    await page.waitForTimeout(200);
  }

  await expect(root).toHaveAttribute("data-active-entry", expectedEntryId);
}

test.describe("canonical reconstructed story journey", () => {
  test("fresh root begins at the one-action threshold before opening the Broken Floor", async ({
    page,
  }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/", { waitUntil: "domcontentloaded" });

    const onboarding = page.getByRole("dialog");
    await expect(onboarding).toBeVisible();
    await expect(
      onboarding.getByRole("heading", {
        level: 1,
        name: "SLIPPER IN THE WOODS",
        exact: true,
      }),
    ).toBeVisible();
    await expect(onboarding.getByText("A journey to you.", { exact: true })).toBeVisible();
    await expect(onboarding.locator(".onboarding-actions button")).toHaveCount(1);
    await onboarding.getByRole("button", { name: "Begin", exact: true }).click();

    const root = page.locator("[data-experience-root]");
    await expect(root).toBeVisible();
    await expect(root).toHaveAttribute("data-active-entry", "fragment-001");
    await expect(root).toHaveAttribute("data-experience-mode", "first-journey");
    await expect(root).toHaveAttribute("data-prologue-resolved", "false");
    await expect(page.locator(".story-object-hud[data-story-scene='broken-floor.confession']")).toBeVisible();
    await expect(page.getByText("Look down. Drag across the wet floor.")).toBeVisible();
    await expect(
      page.getByRole("region", { name: "Slipper in the Woods navigation" }),
    ).toHaveCount(0);
    await expect(page.locator(".story-hud, .mini-map-hud, .contextual-nav-prompt")).toHaveCount(0);
    await expect(page.getByRole("link", { name: "Skip to story navigation" })).toHaveCount(0);
    const firstWipe = page.locator("button[data-story-event-id='broken-floor.first-wipe']");
    await expect(firstWipe).toBeVisible();
    await page.waitForTimeout(1_200);
    await expect(root).toHaveAttribute("data-prologue-resolved", "false");
    await expect(
      page.getByRole("region", { name: "Slipper in the Woods navigation" }),
    ).toHaveCount(0);
    await firstWipe.focus();
    await firstWipe.press("Enter");
    await expect(root).toHaveAttribute("data-prologue-resolved", "false");
    const secondWipe = page.locator("button[data-story-event-id='broken-floor.forest-revealed']");
    await expect(secondWipe).toBeVisible();
    await secondWipe.press("Enter");
    await expect(root).toHaveAttribute("data-prologue-resolved", "false");
    const touchReflection = page.locator("button[data-story-event-id='broken-floor.inversion']");
    await expect(touchReflection).toBeVisible();
    await touchReflection.press("Enter");
    await expect(root).toHaveAttribute("data-prologue-resolved", "true");
    await expect(
      page.getByRole("region", { name: "Slipper in the Woods navigation" }),
    ).toHaveCount(0);

    await page.reload({ waitUntil: "domcontentloaded" });
    await expect(onboarding).toBeVisible();
    await expect(
      onboarding.getByRole("button", { name: "Continue the Journey", exact: true }),
    ).toBeVisible();
  });

  test("completes the representative 32-scene journey through production UI controls", async ({
    page,
  }) => {
    test.setTimeout(600_000);
    await page.emulateMedia({ reducedMotion: "reduce" });

    // Playwright gives this test a fresh browser context. Deliberately do not
    // seed, clear, or otherwise write localStorage: all progress below is made
    // by the same accessible production controls available to a player.
    await page.goto("/?accessible=1", { waitUntil: "domcontentloaded" });
    await page.getByRole("button", { name: "Begin", exact: true }).click();

    const journey = page.locator("[data-accessible-journey='true']");
    await expect(journey).toBeVisible();

    for (const [sceneIndex, scene] of journeyScenes.entries()) {
      await test.step(String(sceneIndex + 1) + ". " + scene.title, async () => {
        await expect(journey).toHaveAttribute(
          "data-active-entry",
          scene.keystoneEntryId,
        );

        const witness = page.locator(
          '[data-accessible-witness="' + scene.keystoneEntryId + '"]',
        );
        if (await witness.isVisible().catch(() => false)) await witness.click();

        for (let moment = 0; moment < 40; moment += 1) {
          if (await completeNextCinematicEvent(page)) continue;
          const ritual = page.locator("[data-accessible-ritual-id]:visible");
          if (await ritual.count()) {
            await ritual.first().getByRole("button").click();
            continue;
          }

          const action = page.locator("[data-accessible-action-id]:visible");
          if (await action.count()) {
            const actionId = await action.first().getAttribute(
              "data-accessible-action-id",
            );
            const choiceId = actionId ? PREFERRED_ACTION_CHOICES[actionId] : undefined;
            if (choiceId) {
              await action
                .first()
                .locator('[data-accessible-choice-id="' + choiceId + '"]')
                .click();
            } else {
              await action.first().getByRole("button").first().click();
            }
            continue;
          }
          break;
        }

        if (sceneIndex < journeyScenes.length - 1) {
          const continueStory = page.getByRole("button", {
            name: "Continue the story",
          });
          await expect(continueStory).toBeEnabled({ timeout: 15_000 });
          await continueStory.click();
        }
      });
    }

    await expect(journey).toHaveAttribute("data-story-complete", "true", {
      timeout: 20_000,
    });
    await expect(page.locator(".accessible-story-coda h2")).toHaveText("I returned to myself.");
    await expect(page.locator("[data-gift-dedication='visible']")).toBeVisible();
    await expect(page.locator(".accessible-story-journey__progress")).toHaveCount(0);

    // A reload proves that the same production persistence path retains the
    // UI-earned result; the test still never writes or replaces stored state.
    await page.reload({ waitUntil: "domcontentloaded" });
    await expect(
      page.getByRole("button", { name: "Return to the Woods", exact: true }),
    ).toBeVisible();
  });

  test("hydrates the ordered 12-chapter, 32-scene route at every chapter boundary", async ({
    page,
  }) => {
    test.setTimeout(180_000);
    await prepareSnapshotHarness(page);

    expect(journeyChapters.map((chapter) => chapter.id)).toEqual(EXPECTED_CHAPTER_IDS);
    expect(journeyChapters.flatMap((chapter) => chapter.sceneIds)).toEqual(EXPECTED_SCENE_IDS);
    expect(journeyScenes.map((scene) => scene.id)).toEqual(EXPECTED_SCENE_IDS);
    expect(journeyScenes).toHaveLength(32);
    expect(Object.keys(JOURNEY_ENTRY_CONTEXT)).toHaveLength(66);

    for (const [chapterIndex, chapter] of journeyChapters.entries()) {
      await test.step(`${chapterIndex + 1}. ${chapter.title}`, async () => {
        const firstSceneIndex = sceneIndexById.get(chapter.sceneIds[0]);
        expect(firstSceneIndex).toBeDefined();
        const snapshot = buildJourneySnapshot({
          sceneIndex: firstSceneIndex!,
          completedSceneCount: firstSceneIndex!,
        });
        const root = await openSeededDirectedJourney(page, snapshot);
        await expect(root).toHaveAttribute("data-active-entry", snapshot.activeEntryId);
        await expect(page.locator(".constellation-panel, .constellation-node")).toHaveCount(0);
        await expect(
          page.getByRole("region", { name: "Slipper in the Woods navigation" }),
        ).toHaveCount(0);
      });
    }
  });

  test("keeps the ritual, Fork, climb, and Crown gates causal", async ({ page }) => {
    test.setTimeout(240_000);
    await prepareSnapshotHarness(page);

    const gateCases: Array<{
      name: string;
      blocked: StoryJourneyState;
      blockedCount: number;
      allowed: StoryJourneyState;
      allowedCount: number;
    }> = [];

    const openingRitual = buildJourneySnapshot({
      sceneIndex: 0,
      completedSceneCount: 0,
      witnessCurrent: true,
      completedRitualIds: [],
      inventory: { lantern: false },
    });
    gateCases.push({
      name: "the opening witness does not complete before lantern acceptance",
      blocked: openingRitual,
      blockedCount: 0,
      allowed: buildJourneySnapshot({
        sceneIndex: 0,
        completedSceneCount: 0,
        witnessCurrent: true,
        completedRitualIds: ["ritual.accept-lantern"],
        inventory: { lantern: true },
      }),
      allowedCount: 1,
    });

    const beforeWash = ritualIdsBeforeSceneCount(19);
    gateCases.push({
      name: "River wash remains behind the boundary fire",
      blocked: buildJourneySnapshot({
        sceneIndex: 19,
        completedSceneCount: 19,
        witnessCurrent: true,
        completedRitualIds: [
          ...beforeWash.filter((ritualId) => ritualId !== "ritual.burn-boundary"),
          "ritual.wash-grief",
        ],
      }),
      blockedCount: 19,
      allowed: buildJourneySnapshot({
        sceneIndex: 19,
        completedSceneCount: 19,
        witnessCurrent: true,
        completedRitualIds: [...beforeWash, "ritual.wash-grief"],
      }),
      allowedCount: 20,
    });

    const beforeRelease = ritualIdsBeforeSceneCount(20);
    gateCases.push({
      name: "release precedes surrender",
      blocked: buildJourneySnapshot({
        sceneIndex: 20,
        completedSceneCount: 20,
        witnessCurrent: true,
        completedRitualIds: [...beforeRelease, "ritual.release-river-memory"],
      }),
      blockedCount: 20,
      allowed: buildJourneySnapshot({
        sceneIndex: 20,
        completedSceneCount: 20,
        witnessCurrent: true,
        completedRitualIds: [
          ...beforeRelease,
          "ritual.release-river-memory",
          "ritual.surrender",
        ],
      }),
      allowedCount: 21,
    });

    const beforeFork = ritualIdsBeforeSceneCount(21);
    gateCases.push({
      name: "the Fork waits for surrender",
      blocked: buildJourneySnapshot({
        sceneIndex: 21,
        completedSceneCount: 21,
        witnessCurrent: true,
        completedRitualIds: beforeFork.filter((ritualId) => ritualId !== "ritual.surrender"),
      }),
      blockedCount: 21,
      allowed: buildJourneySnapshot({
        sceneIndex: 21,
        completedSceneCount: 21,
        witnessCurrent: true,
        completedActionIds: ["action.fork.weigh"],
      }),
      allowedCount: 22,
    });

    gateCases.push({
      name: "Heart waits for Mind",
      blocked: buildJourneySnapshot({
        sceneIndex: 26,
        completedSceneCount: 25,
        witnessCurrent: true,
      }),
      blockedCount: 25,
      allowed: buildJourneySnapshot({
        sceneIndex: 26,
        completedSceneCount: 26,
        witnessCurrent: true,
        completedActionIds: ["action.climb.heart.choose-memory"],
        actionChoiceIds: {
          "action.climb.heart.choose-memory": "heart.selfhood",
        },
      }),
      allowedCount: 27,
    });

    gateCases.push({
      name: "Womb waits for Heart",
      blocked: buildJourneySnapshot({
        sceneIndex: 27,
        completedSceneCount: 26,
        witnessCurrent: true,
      }),
      blockedCount: 26,
      allowed: buildJourneySnapshot({
        sceneIndex: 27,
        completedSceneCount: 27,
        witnessCurrent: true,
        completedActionIds: ["action.climb.womb.choose-creation"],
        actionChoiceIds: {
          "action.climb.womb.choose-creation": "future.home",
        },
      }),
      allowedCount: 28,
    });

    const crownedThreshold = buildJourneySnapshot({
      sceneIndex: 28,
      completedSceneCount: 28,
      witnessCurrent: true,
    });
    gateCases.push({
      name: "the Crown threshold recognises protection, chosen memory, and self-permission",
      blocked: {
        ...crownedThreshold,
        inventory: { ...crownedThreshold.inventory, recoveredKeys: [] },
      },
      blockedCount: 28,
      allowed: crownedThreshold,
      allowedCount: 29,
    });

    const beforeSovereignty = ritualIdsBeforeSceneCount(30);
    gateCases.push({
      name: "sovereignty completes only after the lantern is placed",
      blocked: buildJourneySnapshot({
        sceneIndex: 30,
        completedSceneCount: 30,
        witnessCurrent: true,
      }),
      blockedCount: 30,
      allowed: buildJourneySnapshot({
        sceneIndex: 30,
        completedSceneCount: 30,
        witnessCurrent: true,
        completedRitualIds: [...beforeSovereignty, "ritual.place-lantern"],
      }),
      allowedCount: 31,
    });

    for (const gate of gateCases) {
      await test.step(gate.name, async () => {
        if (canEnterNarrativeEntry(gate.blocked.activeEntryId, gate.blocked)) {
          await openSeededDirectedJourney(page, gate.blocked);
        } else {
          // Explicit Continue recovers a malformed locked position to an
          // admitted earlier clearing; it cannot supply the missing rite.
          await seedPersistedJourney(page, gate.blocked);
          await page.evaluate(key => localStorage.removeItem(key), DEDICATION_ACKNOWLEDGEMENT_STORAGE_KEY);
          await page.goto("/?accessible=1", { waitUntil: "domcontentloaded" });
          const threshold = page.getByRole("dialog");
          await expect(threshold).toBeVisible();
          const before = await page.evaluate(key => JSON.parse(localStorage.getItem(key)!).state, JOURNEY_STORAGE_KEY);
          const activeIndex = journeyScenes.findIndex(scene => scene.entryIds.includes(before.activeEntryId));
          const earlier = journeyScenes.slice(0, activeIndex).reverse()
            .filter(scene => canEnterNarrativeEntry(scene.keystoneEntryId, before));
          const remembered = new Set([before.lastSafeEntryId, ...before.history]);
          const recovered = earlier.find(scene => scene.entryIds.some(id => remembered.has(id))) ?? earlier[0];
          if (!recovered) throw new Error("No admitted earlier canonical clearing for the malformed fixture.");
          await threshold.getByRole("button", { name: "Continue the Journey", exact: true }).click();
          const root = page.locator("[data-accessible-journey='true']");
          await expect(root).toHaveAttribute("data-active-entry", recovered.keystoneEntryId);
          await expect(threshold).toBeHidden();
          const after = await page.evaluate(key => JSON.parse(localStorage.getItem(key)!).state, JOURNEY_STORAGE_KEY);
          for (const field of ["completedRitualIds", "completedSceneIds", "completedChapterIds", "completedActs", "witnessedEntryIds", "storyCompleted"]) {
            expect(after[field]).toEqual(before[field]);
          }
        }
        await page.waitForTimeout(400);
        expect(await completedSceneCountInStorage(page)).toBe(gate.blockedCount);
        await expect(page.locator(".constellation-panel")).toHaveCount(0);

        await page.goto("/?welcome=1", { waitUntil: "domcontentloaded" });
        await openSeededDirectedJourney(page, gate.allowed);
        await expect
          .poll(() => completedSceneCountInStorage(page), { timeout: 8_000 })
          .toBe(gate.allowedCount);
        await expect(page.locator(".constellation-panel")).toHaveCount(0);
      });
    }
  });

  test("keeps every lantern checkpoint resumable while only completion exposes the full constellation", async ({
    page,
  }) => {
    test.setTimeout(180_000);
    await prepareSnapshotHarness(page);

    const phaseCheckpoints: Array<{
      id: string;
      title: string;
      snapshot: StoryJourneyState;
    }> = [
      {
        id: "distant",
        title: "Distant light",
        snapshot: buildJourneySnapshot({
          sceneIndex: 0,
          completedSceneCount: 0,
          storyStarted: false,
          inventory: { lantern: false },
        }),
      },
      {
        id: "borrowed",
        title: "Borrowed light",
        snapshot: buildJourneySnapshot({
          sceneIndex: 0,
          completedSceneCount: 0,
          completedRitualIds: ["ritual.accept-lantern"],
          inventory: { lantern: true },
        }),
      },
      {
        id: "unstable",
        title: "Unstable light",
        snapshot: buildJourneySnapshot({ sceneIndex: 1, completedSceneCount: 1 }),
      },
      {
        id: "recognition",
        title: "Recognising light",
        snapshot: buildJourneySnapshot({ sceneIndex: 11, completedSceneCount: 11 }),
      },
      {
        id: "ownership",
        title: "Owned light",
        snapshot: buildJourneySnapshot({ sceneIndex: 23, completedSceneCount: 24 }),
      },
      {
        id: "integrated",
        title: "Integrated light",
        snapshot: buildJourneySnapshot({ sceneIndex: 25, completedSceneCount: 25 }),
      },
      {
        id: "released",
        title: "Released light",
        snapshot: finalJourneySnapshot(),
      },
    ];

    for (const phase of phaseCheckpoints.slice(0, -1)) {
      await test.step(phase.title, async () => {
        expect(deriveLanternNarrative(phase.snapshot).id).toBe(phase.id);

        const experienceRoot = await openSeededDirectedJourney(page, phase.snapshot);
        await expect(experienceRoot).toHaveAttribute(
          "data-active-entry",
          phase.snapshot.activeEntryId,
        );
        await expect(page.locator(".constellation-panel, .constellation-node")).toHaveCount(0);
      });
    }

    const final = phaseCheckpoints.at(-1)!.snapshot;
    const { constellation } = await openSeededConstellation(page, final);
    await expect(constellation).toHaveClass(/\bis-lantern-released\b/);
    await expect(constellation.locator(".constellation-lantern-phase")).toHaveText(
      "Released light",
    );
    await expect(constellation.locator(".constellation-progress-text")).toHaveText("100% witnessed");
    await expect(constellation.locator(".constellation-status")).toContainText(
      "66 memories shape the visible constellation.",
    );
    await expect(constellation.locator(".constellation-status")).toContainText(
      "12 of 12 chapters are complete.",
    );
    await expectSceneCount(constellation, 32);
    await expect(
      constellation.locator(".constellation-node:not(.is-guidance-ghost)"),
    ).toHaveCount(66);
    await expect(constellation.locator(".constellation-region")).toHaveCount(12);
    expect(await constellation.locator(".constellation-link").count()).toBeGreaterThanOrEqual(65);
    await expect(constellation.locator(".constellation-story-summary")).toContainText(
      `${JOURNEY_RITUAL_IDS.length} story moments`,
    );
  });
});
