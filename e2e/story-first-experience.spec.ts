import { expect, test, type Page } from "@playwright/test";
import { completeNextCinematicEvent } from "./cinematic-story-controls";
import { JOURNEY_ENTRY_PROGRESS, getJourneyRitualBeat, journeyChapters, journeyScenes } from "../src/data/journeyBlueprint";
import { STORY_EVENTS } from "../src/storyEvents/storyEventRegistry";
import { dispatchStoryEventState } from "../src/storyEvents/storyEventState";
import { deriveLanternNarrative } from "../src/lib/lanternNarrative";
import type { StoryJourneyState } from "../src/lib/storyJourneyState";
import {
  DEDICATION_ACKNOWLEDGEMENT_STORAGE_KEY,
  JOURNEY_STORAGE_KEY,
  clearStoryFirstStorage,
  completedStoryJourney,
  incompleteStoryJourney,
  seedStoryJourney,
} from "./story-first-fixtures";

const SOFTWARE_UI = [
  ".story-hud",
  ".mini-map-hud",
  ".contextual-nav-prompt",
  ".map-workspace",
  ".chapter-path",
  ".chapter-progress",
  ".journey-trail",
  ".portal-dock",
].join(", ");

type JourneyEvidence = StoryJourneyState & {
  bookmarkedEntryIds?: string[];
};

function restoredFirstWoodCloudJourney(): StoryJourneyState {
  const openingScene = journeyScenes[0], remoteScene = journeyScenes[1];
  if (!openingScene || !remoteScene) throw new Error("Missing canonical opening route.");
  const context = JOURNEY_ENTRY_PROGRESS[remoteScene.keystoneEntryId];
  if (!context) throw new Error("Missing canonical first-wood metadata.");
  let opening: StoryJourneyState = {
    ...incompleteStoryJourney(),
    completedRitualIds: [], completedStoryEventIds: [],
    storyObjectStates: {}, storyPlacementStates: {}, worldFlags: {}, landmarkStates: {},
    inventory: { lantern: false, recoveredKeys: [], symbolicObjects: [] },
    resonances: { wolf: 0, swan: 0, seer: 0 },
  };
  // Earn the prior scene through its real ordered reducer events. The restored
  // first-wood arrival has no future witness, ritual, or completion evidence.
  for (const event of STORY_EVENTS.filter(event => event.sceneId === openingScene.id)) {
    opening = dispatchStoryEventState(opening, {
      sceneId: event.sceneId, eventId: event.id, trigger: event.trigger,
      objectId: event.objectId, targetId: event.targetId,
    }).state;
  }
  return {
    ...opening,
    inventory: { ...opening.inventory, lantern: opening.completedRitualIds.some(ritualId =>
      getJourneyRitualBeat(ritualId)?.outcomes?.some(outcome => outcome.type === "award-lantern")) },
    actId: context.actId, chapterId: context.chapterId,
    sceneId: context.sceneId, beatId: context.beatId,
    activeEntryId: remoteScene.keystoneEntryId,
    history: [openingScene.keystoneEntryId],
    visitedEntryIds: [openingScene.keystoneEntryId, remoteScene.keystoneEntryId],
    witnessedEntryIds: [openingScene.keystoneEntryId],
    completedSceneIds: [openingScene.id],
    completedChapterIds: journeyChapters
      .filter(chapter => chapter.sceneIds.every(id => id === openingScene.id))
      .map(chapter => chapter.id),
    updatedAt: "2099-09-13T08:00:00.000Z",
  };
}

type EndingEvidence = {
  reveal: string | null;
  phase: string | null;
  prose: string | null;
  actions: string | null;
  audio: string | null;
  completionLineVisible: boolean;
  accessibleFormation: string | null;
  dedicationVisible: boolean;
};

const REPRESENTATIVE_CHOICES: Readonly<Record<string, string>> = {
  "action.climb.heart.choose-memory": "heart.selfhood",
  "action.climb.womb.choose-creation": "future.home",
};

async function readJourneyEvidence(page: Page) {
  return page.evaluate((key) => {
    const raw = localStorage.getItem(key);
    if (!raw) throw new Error("The persisted journey is missing.");
    return JSON.parse(raw).state as JourneyEvidence;
  }, JOURNEY_STORAGE_KEY);
}

async function observeEndingEvidence(page: Page) {
  await page.evaluate(() => {
    const instrumentedWindow = window as typeof window & {
      __sidtwEndingEvidence?: EndingEvidence[];
      __sidtwEndingObserver?: MutationObserver;
    };
    instrumentedWindow.__sidtwEndingObserver?.disconnect();
    instrumentedWindow.__sidtwEndingEvidence = [];

    const record = () => {
      const root = document.querySelector("[data-experience-root]");
      const accessibleFormation = document.querySelector(
        "[data-accessible-constellation-formation]",
      );
      const evidence: EndingEvidence = {
        reveal: root?.getAttribute("data-constellation-reveal") ?? null,
        phase: root?.getAttribute("data-story-transition") ?? null,
        prose: root?.getAttribute("data-story-prose") ?? null,
        actions: root?.getAttribute("data-story-actions") ?? null,
        audio: root?.getAttribute("data-narrative-audio") ?? null,
        completionLineVisible: Array.from(
          document.querySelectorAll(
            "[data-story-transition='departure'][data-story-scene='epilogue.constellation']",
          ),
        ).some((element) =>
          element.textContent?.includes(
            "The route becomes visible because it has been walked.",
          ),
        ),
        accessibleFormation:
          accessibleFormation?.getAttribute(
            "data-accessible-constellation-formation",
          ) ?? null,
        dedicationVisible: Boolean(
          document.querySelector("[data-gift-dedication='visible']"),
        ),
      };
      const previous = instrumentedWindow.__sidtwEndingEvidence?.at(-1);
      if (JSON.stringify(previous) !== JSON.stringify(evidence)) {
        instrumentedWindow.__sidtwEndingEvidence?.push(evidence);
      }
    };

    const observer = new MutationObserver(record);
    observer.observe(document.documentElement, {
      attributes: true,
      childList: true,
      subtree: true,
      attributeFilter: [
        "data-accessible-constellation-formation",
        "data-constellation-reveal",
        "data-gift-dedication",
        "data-narrative-audio",
        "data-story-actions",
        "data-story-prose",
        "data-story-transition",
      ],
    });
    instrumentedWindow.__sidtwEndingObserver = observer;
    record();
  });
}

async function readEndingEvidence(page: Page) {
  return page.evaluate(() => {
    const instrumentedWindow = window as typeof window & {
      __sidtwEndingEvidence?: EndingEvidence[];
      __sidtwEndingObserver?: MutationObserver;
    };
    instrumentedWindow.__sidtwEndingObserver?.disconnect();
    return instrumentedWindow.__sidtwEndingEvidence ?? [];
  });
}

async function expectStoryFirstThreshold(page: Page, actionLabel: string) {
  const threshold = page.getByRole("dialog");
  await expect(threshold).toBeVisible();
  await expect(
    threshold.getByRole("heading", {
      level: 1,
      name: "SLIPPER IN THE WOODS",
      exact: true,
    }),
  ).toBeVisible();
  await expect(threshold.getByText("A journey to you.", { exact: true })).toBeVisible();
  await expect(
    threshold.getByRole("button", { name: actionLabel, exact: true }),
  ).toBeVisible();
  await expect(threshold.locator(".onboarding-actions button")).toHaveCount(1);
  await expect(page.locator(SOFTWARE_UI)).toHaveCount(0);
  await expect(page.getByText(/\d+\s*(?:of|\/)\s*\d+\s+(?:memories|scenes|chapters)/i)).toHaveCount(0);
  return threshold;
}

test.beforeEach(async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await clearStoryFirstStorage(page);
});

test.describe("story-first gift experience", () => {
  test("fresh launch has one Begin, initialises audio, and enters the HUD-free Broken Floor", async ({
    page,
  }, testInfo) => {
    await page.addInitScript(() => {
      const AudioContextConstructor = window.AudioContext;
      if (!AudioContextConstructor) return;
      const prototype = AudioContextConstructor.prototype;
      const originalCreateBuffer = prototype.createBuffer;
      const originalStart = AudioBufferSourceNode.prototype.start;
      prototype.createBuffer = function (...args) {
        const instrumentedWindow = window as typeof window & {
          __sidtwAudioBufferCount?: number;
        };
        instrumentedWindow.__sidtwAudioBufferCount =
          (instrumentedWindow.__sidtwAudioBufferCount ?? 0) + 1;
        return Reflect.apply(originalCreateBuffer, this, args);
      };
      AudioBufferSourceNode.prototype.start = function (...args) {
        const instrumentedWindow = window as typeof window & {
          __sidtwAudioSourceStartCount?: number;
        };
        instrumentedWindow.__sidtwAudioSourceStartCount =
          (instrumentedWindow.__sidtwAudioSourceStartCount ?? 0) + 1;
        return Reflect.apply(originalStart, this, args);
      };
      window.addEventListener("sidtw:narrative-audio-activation", (event) => {
        const detail = (event as CustomEvent<{
          state?: AudioContextState;
          userActivationActive?: boolean;
        }>).detail;
        const instrumentedWindow = window as typeof window & {
          __sidtwAudioActivationState?: AudioContextState;
          __sidtwAudioActivationHadUserGesture?: boolean;
        };
        instrumentedWindow.__sidtwAudioActivationState = detail.state;
        instrumentedWindow.__sidtwAudioActivationHadUserGesture =
          instrumentedWindow.__sidtwAudioActivationHadUserGesture === true ||
          detail.userActivationActive === true;
      });
    });
    await page.goto("/", { waitUntil: "domcontentloaded" });
    const threshold = await expectStoryFirstThreshold(page, "Begin");

    await threshold
      .getByRole("button", { name: "Accessibility and sound settings", exact: true })
      .click();
    const settings = page.getByRole("dialog", { name: "Experience settings" });
    await expect(settings).toBeVisible();
    await expect(settings.getByRole("region", { name: "Current journey" })).toHaveCount(0);
    await expect(settings.getByRole("button", { name: /archive map/i })).toHaveCount(0);
    await expect(settings.getByRole("button", { name: "Reset journey", exact: true })).toHaveCount(0);
    await expect(settings.getByText(/steps remembered/i)).toHaveCount(0);
    await expect(settings.getByRole("button", { name: /guidance assistance/i })).toBeVisible();
    await settings.getByRole("button", { name: "Close settings", exact: true }).click();

    await threshold.getByRole("button", { name: "Begin", exact: true }).click();

    const journey = page.locator(
      "[data-experience-root], [data-accessible-journey='true']",
    );
    await expect(journey).toBeVisible();
    await expect(journey).toHaveAttribute("data-active-entry", "fragment-001");
    await expect(journey).toHaveAttribute("data-experience-mode", "first-journey");
    await expect(page.locator(".story-object-hud[data-story-scene='broken-floor.confession'], [data-accessible-story-objects='broken-floor.confession']").first()).toBeVisible();
    await expect(page.locator(SOFTWARE_UI)).toHaveCount(0);
    await expect(page.locator(".scene-compass")).toHaveCount(0);
    await expect(page.locator(".constellation-node")).toHaveCount(0);
    await expect(page.getByRole("button", { name: /archive|map/i })).toHaveCount(0);

    if (testInfo.project.name === "chromium") {
      await expect
        .poll(() =>
          page.evaluate(
            () =>
              (window as typeof window & {
                __sidtwAudioBufferCount?: number;
              }).__sidtwAudioBufferCount ?? 0,
          ),
        )
        .toBeGreaterThan(0);
      await expect
        .poll(() =>
          page.evaluate(
            () =>
              (window as typeof window & {
                __sidtwAudioSourceStartCount?: number;
              }).__sidtwAudioSourceStartCount ?? 0,
          ),
        )
        .toBeGreaterThan(0);
      await expect
        .poll(() =>
          page.evaluate(
            () =>
              (window as typeof window & {
                __sidtwAudioActivationState?: AudioContextState;
              }).__sidtwAudioActivationState,
          ),
        )
        .toBe("running");
      expect(await page.evaluate(
        () =>
          (window as typeof window & {
            __sidtwAudioActivationHadUserGesture?: boolean;
          }).__sidtwAudioActivationHadUserGesture,
      )).toBe(true);
    }
  });

  test("an unfinished journey reloads to Continue the Journey", async ({ page }) => {
    await page.goto("/?accessible=1", { waitUntil: "domcontentloaded" });
    const threshold = await expectStoryFirstThreshold(page, "Begin");
    await threshold.getByRole("button", { name: "Begin", exact: true }).click();
    await expect(page.locator("[data-accessible-journey='true']")).toBeVisible();

    await page.reload({ waitUntil: "domcontentloaded" });
    await expectStoryFirstThreshold(page, "Continue the Journey");
  });

  test("a newer incomplete cloud journey restores before the threshold resolves", async ({
    page,
  }) => {
    const remoteScene = journeyScenes[1];
    if (!remoteScene) throw new Error("The canonical journey needs a second scene.");
    const remoteJourney = {
      ...restoredFirstWoodCloudJourney(),
      cloudSchemaVersion: 2,
      migratedFromNavigation: false,
    };

    await page.route("**/api/load", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ ok: true, journey: remoteJourney }),
      });
    });
    await page.route("**/api/save", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ ok: true }),
      });
    });
    await page.evaluate(() => {
      const payload = window
        .btoa(JSON.stringify({ sub: "story-first-cloud-e2e" }))
        .replace(/\+/g, "-")
        .replace(/\//g, "_")
        .replace(/=+$/g, "");
      localStorage.setItem("sidtw:session-token", payload);
    });

    await page.goto("/?accessible=1", { waitUntil: "domcontentloaded" });
    const threshold = await expectStoryFirstThreshold(page, "Continue the Journey");
    await threshold
      .getByRole("button", { name: "Continue the Journey", exact: true })
      .click();
    await expect(page.locator("[data-accessible-journey='true']")).toHaveAttribute(
      "data-active-entry",
      remoteScene.keystoneEntryId,
    );
  });

  test("a direct archive URL cannot bypass first-journey disclosure", async ({ page }) => {
    await page.goto("/archive", { waitUntil: "domcontentloaded" });

    await expectStoryFirstThreshold(page, "Begin");
    await expect(page.locator("#archive-main")).toHaveCount(0);
    await expect(page.locator("[data-accessible-journey='true']")).toHaveCount(0);
  });

  test("accessible mode preserves the same gate, ordered disclosure, and hidden software UI", async ({
    page,
  }) => {
    await page.goto("/?accessible=1", { waitUntil: "domcontentloaded" });
    const threshold = await expectStoryFirstThreshold(page, "Begin");
    await threshold.getByRole("button", { name: "Begin", exact: true }).click();

    const journey = page.locator("[data-accessible-journey='true']");
    await expect(journey).toBeVisible();
    await expect(journey).toHaveAttribute("data-active-entry", "fragment-001");
    await expect(journey).toHaveAttribute("data-experience-mode", "first-journey");
    await expect(page.locator("canvas")).toHaveCount(0);
    await expect(page.locator(".accessible-story-journey__progress")).toHaveCount(0);
    await expect(page.getByRole("button", { name: /archive|map|back/i })).toHaveCount(0);
    await expect(page.locator("[data-gift-dedication='visible']")).toHaveCount(0);

    await expect(page.locator("[data-accessible-witness='fragment-001']")).toBeVisible();
    await expect(
      page.getByText("What a deluded illusion I keep turning to.", { exact: false }),
    ).toHaveCount(0);
    await page.locator("[data-accessible-witness='fragment-001']").click();
    await expect(
      page.getByText("What a deluded illusion I keep turning to.", { exact: false }),
    ).toBeVisible();
  });

  test("canonical order carries surrender, Fork ownership, the Three Climbs, Crown state, and lantern placement", async ({
    page,
  }, testInfo) => {
    // The 32-scene route includes real attention and finale sequences; hosted
    // WebKit reached the last stillness just before the former 180s deadline.
    test.setTimeout(process.env.CI ? 240_000 : 180_000);
    await page.goto("/?accessible=1", { waitUntil: "domcontentloaded" });
    await page.getByRole("button", { name: "Begin", exact: true }).click();

    const journey = page.locator("[data-accessible-journey='true']");
    const observedEntries: string[] = [];
    const observedActions: string[] = [];
    let sawSurrender = false;
    let sawForkOwnership = false;
    let sawLanternPlacement = false;

    for (const [sceneIndex, scene] of journeyScenes.entries()) {
      await expect(journey).toHaveAttribute(
        "data-active-entry",
        scene.keystoneEntryId,
      );
      observedEntries.push(scene.keystoneEntryId);

      const witness = page.locator(
        '[data-accessible-witness="' + scene.keystoneEntryId + '"]',
      );
      if (await witness.isVisible().catch(() => false)) await witness.click();

      if (scene.id === "crowned.threshold") {
        const crownEvidence = await readJourneyEvidence(page);
        expect(crownEvidence.completedRitualIds).toContain("ritual.surrender");
        expect(crownEvidence.worldFlags["lantern.owned"]).toBe(true);
        expect(crownEvidence.worldFlags["climb.heart.memory-chosen"]).toBe(true);
        expect(crownEvidence.worldFlags["climb.womb.creation-chosen"]).toBe(true);
        expect(crownEvidence.inventory.recoveredKeys).toEqual(
          expect.arrayContaining(["key.protection", "key.self-permission"]),
        );
      }

      for (let momentIndex = 0; momentIndex < 40; momentIndex += 1) {
        const beforeEvent = await readJourneyEvidence(page);
        const eventId = await completeNextCinematicEvent(page);
        if (eventId) {
          if (eventId === "mind.questions-left") observedActions.push("action.climb.mind.walk-on");
          if (eventId === "heart.feather.chosen") observedActions.push("action.climb.heart.choose-memory");
          if (eventId === "womb.light.created") observedActions.push("action.climb.womb.choose-creation");
          if (eventId === "river.surrender") {
            sawSurrender = true;
            await expect(page.locator(SOFTWARE_UI + ", .scene-compass")).toHaveCount(0);
            expect((await readJourneyEvidence(page)).worldFlags["surrender.white-flag-raised"]).toBe(true);
            if (testInfo.project.name === "chromium") {
              await page.goto("/", { waitUntil: "domcontentloaded" });
              await page.getByRole("button", { name: "Continue the Journey", exact: true }).click();
              await expect(page.locator("[data-experience-root]")).toHaveAttribute("data-experience-mode", "returning-journey");
              await expect(page.locator(SOFTWARE_UI + ", .scene-compass")).toHaveCount(0);
              await page.goto("/?accessible=1", { waitUntil: "domcontentloaded" });
              await page.getByRole("button", { name: "Continue the Journey", exact: true }).click();
              await expect(journey).toHaveAttribute("data-active-entry", scene.keystoneEntryId);
            }
          }
          if (eventId === "lantern.owned") {
            expect(deriveLanternNarrative(beforeEvent).id).not.toBe("ownership");
            expect(deriveLanternNarrative(await readJourneyEvidence(page)).id).toBe("ownership");
            sawForkOwnership = true;
          }
          if (eventId.startsWith("lantern.placed.")) {
            expect(deriveLanternNarrative(beforeEvent).presence).toBe("carried");
            const placed = await readJourneyEvidence(page);
            expect(placed.worldFlags["lantern.placed-and-lit"]).toBe(true);
            expect(deriveLanternNarrative(placed).presence).toBe("placed");
            sawLanternPlacement = true;
          }
          continue;
        }
        const ritual = page.locator("[data-accessible-ritual-id]:visible").first();
        if (await ritual.count()) {
          const ritualId = await ritual.getAttribute("data-accessible-ritual-id");
          if (ritualId === "ritual.surrender") {
            await expect(page.locator(SOFTWARE_UI + ", .scene-compass")).toHaveCount(0);
          }
          const beforePlacement =
            ritualId === "ritual.place-lantern"
              ? await readJourneyEvidence(page)
              : null;
          if (beforePlacement) {
            expect(deriveLanternNarrative(beforePlacement).presence).toBe("carried");
          }

          await ritual.getByRole("button").click();

          if (ritualId === "ritual.surrender") {
            sawSurrender = true;
            await expect
              .poll(async () => {
                const state = await readJourneyEvidence(page);
                return state.worldFlags["surrender.white-flag-raised"] === true;
              })
              .toBe(true);

            if (testInfo.project.name === "chromium") {
              await page.goto("/", { waitUntil: "domcontentloaded" });
              await page
                .getByRole("button", {
                  name: "Continue the Journey",
                  exact: true,
                })
                .click();
              const spatialJourney = page.locator("[data-experience-root]");
              await expect(spatialJourney).toHaveAttribute(
                "data-experience-mode",
                "returning-journey",
              );
              await expect(
                page.locator(SOFTWARE_UI + ", .scene-compass"),
              ).toHaveCount(0);

              await page.goto("/?accessible=1", {
                waitUntil: "domcontentloaded",
              });
              await page
                .getByRole("button", {
                  name: "Continue the Journey",
                  exact: true,
                })
                .click();
              await expect(journey).toHaveAttribute(
                "data-active-entry",
                scene.keystoneEntryId,
              );
            }
          }

          if (ritualId === "ritual.place-lantern") {
            sawLanternPlacement = true;
            await expect
              .poll(async () => {
                const state = await readJourneyEvidence(page);
                return state.worldFlags["lantern.placed-and-lit"] === true;
              })
              .toBe(true);
            const placedState = await readJourneyEvidence(page);
            expect(deriveLanternNarrative(placedState).presence).toBe("placed");
          }
          continue;
        }

        const action = page.locator("[data-accessible-action-id]:visible").first();
        if (await action.count()) {
          const actionId = await action.getAttribute("data-accessible-action-id");
          if (!actionId) throw new Error("Accessible action is missing its stable ID.");
          observedActions.push(actionId);

          const beforeAction = await readJourneyEvidence(page);
          const choiceId = REPRESENTATIVE_CHOICES[actionId];
          if (choiceId) {
            await action
              .locator('[data-accessible-choice-id="' + choiceId + '"]')
              .click();
          } else {
            await action.getByRole("button").first().click();
          }

          if (actionId === "action.fork.take-lantern") {
            expect(deriveLanternNarrative(beforeAction).id).not.toBe("ownership");
            await expect
              .poll(async () => {
                const state = await readJourneyEvidence(page);
                return deriveLanternNarrative(state).id;
              })
              .toBe("ownership");
            sawForkOwnership = true;
          }
          continue;
        }
        break;
      }

      if (sceneIndex < journeyScenes.length - 1) {
        const continueStory = page.getByRole("button", {
          name: "Continue the story",
        });
        await expect(continueStory).toBeEnabled();
        await continueStory.click();
      }
    }

    expect(observedEntries).toEqual(
      journeyScenes.map((scene) => scene.keystoneEntryId),
    );
    expect(observedActions.indexOf("action.climb.mind.walk-on")).toBeLessThan(
      observedActions.indexOf("action.climb.heart.choose-memory"),
    );
    expect(
      observedActions.indexOf("action.climb.heart.choose-memory"),
    ).toBeLessThan(
      observedActions.indexOf("action.climb.womb.choose-creation"),
    );
    expect(sawSurrender).toBe(true);
    expect(sawForkOwnership).toBe(true);
    expect(sawLanternPlacement).toBe(true);
    await expect(journey).toHaveAttribute("data-story-complete", "true");
  });

  test("completion reveals the dedication before unlocking Free Woods", async ({ page }) => {
    await seedStoryJourney(page, completedStoryJourney());
    await page.goto("/?accessible=1", { waitUntil: "domcontentloaded" });
    const threshold = await expectStoryFirstThreshold(page, "Return to the Woods");
    await observeEndingEvidence(page);
    await threshold
      .getByRole("button", { name: "Return to the Woods", exact: true })
      .click();

    await expect(
      page.locator("[data-accessible-constellation-formation='forming']"),
    ).toBeVisible();
    await expect(
      page.locator("[data-accessible-constellation-formation='complete']"),
    ).toBeVisible();
    const dedication = page.locator("[data-gift-dedication='visible']");
    await expect(dedication).toBeVisible({ timeout: 10_000 });
    const endingEvidence = await readEndingEvidence(page);
    const accessibleFormingIndex = endingEvidence.findIndex(
      (evidence) => evidence.accessibleFormation === "forming",
    );
    const accessibleFormationIndex = endingEvidence.findIndex(
      (evidence) => evidence.accessibleFormation === "complete",
    );
    const dedicationIndex = endingEvidence.findIndex(
      (evidence) => evidence.dedicationVisible,
    );
    expect(accessibleFormingIndex).toBeGreaterThanOrEqual(0);
    expect(accessibleFormationIndex).toBeGreaterThan(accessibleFormingIndex);
    expect(dedicationIndex).toBeGreaterThan(accessibleFormationIndex);
    await expect(dedication.getByText("For Kylie.", { exact: true })).toBeVisible();
    await expect(
      dedication.getByText("You gave these words a forest", { exact: true }),
    ).toBeVisible();
    await expect(
      dedication.getByText("long before it had trees.", { exact: true }),
    ).toBeVisible();
    await expect(
      dedication.getByText("I only built somewhere", { exact: true }),
    ).toBeVisible();
    await expect(
      dedication.getByText("for them to live.", { exact: true }),
    ).toBeVisible();

    const returnToWoods = dedication.getByRole("button", {
      name: "Return to the Woods",
      exact: true,
    });
    const journey = page.locator("[data-accessible-journey='true']");
    await expect(returnToWoods).toBeFocused();
    await expect(journey).toHaveAttribute("inert", "");
    await expect(journey).toHaveAttribute("aria-hidden", "true");
    await page.keyboard.press("Tab");
    await expect(returnToWoods).toBeFocused();
    await page.keyboard.press("Shift+Tab");
    await expect(returnToWoods).toBeFocused();

    await returnToWoods.click();

    await expect(journey).toHaveAttribute("data-experience-mode", "free-woods");
    await expect(page.getByRole("button", { name: "Archive", exact: true })).toBeVisible();
    await expect(page.locator(".accessible-story-journey__progress")).toBeVisible();
    await expect
      .poll(() =>
        page.evaluate(
          (key) => localStorage.getItem(key),
          DEDICATION_ACKNOWLEDGEMENT_STORAGE_KEY,
        ),
      )
      .toBe(JSON.stringify({ version: 1, acknowledged: true }));
  });

  test("the completed 3D world reveals its constellation before dedication, then exposes Archive and Constellation", async ({
    page,
  }, testInfo) => {
    test.skip(
      testInfo.project.name !== "chromium",
      "Chromium supplies the deterministic software-WebGL path; accessible completion is covered in every browser project.",
    );
    test.setTimeout(80_000);
    await page.emulateMedia({ reducedMotion: "no-preference" });

    await seedStoryJourney(page, completedStoryJourney());
    await page.goto("/", { waitUntil: "domcontentloaded" });
    const threshold = await expectStoryFirstThreshold(page, "Return to the Woods");
    await observeEndingEvidence(page);
    await threshold
      .getByRole("button", { name: "Return to the Woods", exact: true })
      .click();

    const root = page.locator("[data-experience-root]");
    await expect(root).toHaveAttribute("data-story-transition", "arrival");
    await expect(root).toHaveAttribute("data-constellation-reveal", "forming");
    await expect(page.locator("[data-gift-dedication='visible']")).toHaveCount(0);
    await expect(root).toHaveAttribute("data-story-actions", "suppressed");

    await expect(root).toHaveAttribute("data-constellation-reveal", "complete", {
      timeout: 40_000,
    });
    await expect(page.locator("[data-gift-dedication='visible']")).toHaveCount(0);

    const dedication = page.locator("[data-gift-dedication='visible']");
    await expect(dedication).toBeVisible({ timeout: 40_000 });
    const endingEvidence = await readEndingEvidence(page);
    const formingIndex = endingEvidence.findIndex(
      (evidence) => evidence.reveal === "forming",
    );
    const formationCompleteIndex = endingEvidence.findIndex(
      (evidence) => evidence.reveal === "complete",
    );
    const dedicationIndex = endingEvidence.findIndex(
      (evidence) => evidence.dedicationVisible,
    );
    const contemplationIndex = endingEvidence.findIndex(
      (evidence) =>
        evidence.phase === "contemplation" &&
        evidence.prose === "available" &&
        evidence.actions === "available",
    );
    const departureIndex = endingEvidence.findIndex(
      (evidence) =>
        evidence.phase === "departure" &&
        evidence.prose === "suppressed" &&
        evidence.actions === "suppressed" &&
        evidence.completionLineVisible,
    );
    const silenceIndex = endingEvidence.findIndex(
      (evidence) =>
        evidence.phase === "silence" && evidence.audio === "suppressed",
    );
    expect(formingIndex).toBeGreaterThanOrEqual(0);
    expect(contemplationIndex).toBeGreaterThan(formingIndex);
    expect(departureIndex).toBeGreaterThan(contemplationIndex);
    expect(silenceIndex).toBeGreaterThan(departureIndex);
    expect(formationCompleteIndex).toBeGreaterThan(formingIndex);
    expect(dedicationIndex).toBeGreaterThan(silenceIndex);
    expect(dedicationIndex).toBeGreaterThan(formationCompleteIndex);
    await dedication
      .getByRole("button", { name: "Return to the Woods", exact: true })
      .click();

    await expect(root).toHaveAttribute("data-experience-mode", "free-woods");
    const navigation = page.getByRole("region", {
      name: "Slipper in the Woods navigation",
    });
    await expect(
      navigation.getByRole("button", { name: "Archive", exact: true }),
    ).toBeVisible();
    const constellationButton = navigation.getByRole("button", {
      name: "Constellation",
      exact: true,
    });
    await expect(constellationButton).toBeVisible();
    await constellationButton.click();
    await expect(root).toHaveAttribute("data-world-mode", "map");
    await expect(page.locator(".constellation-panel")).toBeVisible();
  });
});
