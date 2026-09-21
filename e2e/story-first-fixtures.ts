import type { Page } from "@playwright/test";
import {
  JOURNEY_ENTRY_CONTEXT,
  JOURNEY_LANDMARK_IDS,
  JOURNEY_RECOVERED_KEY_IDS,
  JOURNEY_RITUAL_IDS,
  JOURNEY_SYMBOLIC_OBJECT_IDS,
  JOURNEY_WORLD_FLAG_IDS,
  journeyChapters,
  journeyScenes,
} from "../src/data/journeyBlueprint";
import type { LandmarkState, StoryJourneyState } from "../src/lib/storyJourneyState";

export const JOURNEY_STORAGE_KEY = "sidtw:journey:v3";
export const JOURNEY_STORAGE_VERSION = 6;
export const DEDICATION_ACKNOWLEDGEMENT_STORAGE_KEY =
  "sidtw:gift-dedication-acknowledgement:v1";

const FIXED_TIME = "2026-09-13T08:00:00.000Z";

export async function clearStoryFirstStorage(page: Page) {
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await page.evaluate(() => {
    localStorage.clear();
    sessionStorage.clear();
  });
}

export function incompleteStoryJourney(): StoryJourneyState {
  const openingScene = journeyScenes[0];
  if (!openingScene) throw new Error("The canonical journey has no opening scene.");
  const openingContext = JOURNEY_ENTRY_CONTEXT[openingScene.keystoneEntryId];
  if (!openingContext) {
    throw new Error("Missing journey context for the opening scene.");
  }

  return {
    schemaVersion: 2,
    actId: openingContext.actId,
    chapterId: openingContext.chapterId,
    sceneId: openingContext.sceneId,
    beatId: openingContext.beatId,
    activeEntryId: openingScene.keystoneEntryId,
    history: [],
    visitedEntryIds: [openingScene.keystoneEntryId],
    witnessedEntryIds: [openingScene.keystoneEntryId],
    completedRitualIds: ["ritual.accept-lantern"],
    worldFlags: {
      "path.first-wood-readable": true,
      "guidance.fireflies-awake": true,
    },
    landmarkStates: {
      "landmark.first-wood-lantern": "awakened",
    },
    resonances: { wolf: 0, swan: 0, seer: 6 },
    inventory: {
      lantern: true,
      recoveredKeys: [],
      symbolicObjects: [],
    },
    releasedWords: [],
    completedActs: [],
    completedChapterIds: [],
    completedSceneIds: [],
    storyStarted: true,
    storyCompleted: false,
    storyStartedAt: FIXED_TIME,
    storyCompletedAt: null,
    updatedAt: FIXED_TIME,
  };
}

export function completedStoryJourney(): StoryJourneyState {
  const finalScene = journeyScenes.at(-1);
  if (!finalScene) throw new Error("The canonical journey has no final scene.");
  const finalContext = JOURNEY_ENTRY_CONTEXT[finalScene.keystoneEntryId];
  if (!finalContext) {
    throw new Error(`Missing journey context for ${finalScene.keystoneEntryId}.`);
  }

  const allEntryIds = [...new Set(journeyScenes.flatMap((scene) => scene.entryIds))];

  return {
    schemaVersion: 2,
    actId: finalContext.actId,
    chapterId: finalContext.chapterId,
    sceneId: finalContext.sceneId,
    beatId: finalContext.beatId,
    activeEntryId: finalScene.keystoneEntryId,
    history: allEntryIds.filter((entryId) => entryId !== finalScene.keystoneEntryId),
    visitedEntryIds: allEntryIds,
    witnessedEntryIds: allEntryIds,
    completedRitualIds: [...JOURNEY_RITUAL_IDS],
    worldFlags: Object.fromEntries(
      JOURNEY_WORLD_FLAG_IDS.map((flagId) => [flagId, true]),
    ),
    landmarkStates: Object.fromEntries(
      JOURNEY_LANDMARK_IDS.map((landmarkId) => [landmarkId, "released"]),
    ) as Record<string, LandmarkState>,
    resonances: { wolf: 100, swan: 100, seer: 100 },
    inventory: {
      lantern: true,
      recoveredKeys: [...JOURNEY_RECOVERED_KEY_IDS],
      symbolicObjects: [...JOURNEY_SYMBOLIC_OBJECT_IDS],
    },
    releasedWords: ["fear", "waiting", "permission"],
    completedActs: [
      "first-wood",
      "mirror-clearing",
      "thorned-house",
      "blue-moon-archive",
      "fire-and-river",
      "crowned-return",
    ],
    completedChapterIds: journeyChapters.map((chapter) => chapter.id),
    completedSceneIds: journeyScenes.map((scene) => scene.id),
    storyStarted: true,
    storyCompleted: true,
    storyStartedAt: FIXED_TIME,
    storyCompletedAt: FIXED_TIME,
    updatedAt: FIXED_TIME,
  };
}

export async function seedStoryJourney(
  page: Page,
  journey: StoryJourneyState,
  options: { dedicationAcknowledged?: boolean } = {},
) {
  await page.evaluate(
    ({
      journeyStorageKey,
      journeyStorageVersion,
      dedicationStorageKey,
      snapshot,
      dedicationAcknowledged,
    }) => {
      localStorage.setItem(
        journeyStorageKey,
        JSON.stringify({
          state: {
            ...snapshot,
            bookmarkedEntryIds: [],
            lastSafeEntryId: snapshot.activeEntryId,
            playerPosition: null,
          },
          version: journeyStorageVersion,
        }),
      );

      if (dedicationAcknowledged) {
        localStorage.setItem(
          dedicationStorageKey,
          JSON.stringify({ version: 1, acknowledged: true }),
        );
      } else {
        localStorage.removeItem(dedicationStorageKey);
      }
    },
    {
      journeyStorageKey: JOURNEY_STORAGE_KEY,
      journeyStorageVersion: JOURNEY_STORAGE_VERSION,
      dedicationStorageKey: DEDICATION_ACKNOWLEDGEMENT_STORAGE_KEY,
      snapshot: journey,
      dedicationAcknowledged: options.dedicationAcknowledged ?? false,
    },
  );
}
