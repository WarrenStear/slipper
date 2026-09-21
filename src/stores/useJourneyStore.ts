import { publishAcceptedStoryEvents } from "../storyEvents/acceptedStoryEvents";
import { dispatchStoryEventState } from "../storyEvents/storyEventState";
import { reconcileLegacyStoryEventEntry } from "../storyEvents/storyEventRecovery";
import { STORY_EVENT_WORLD_FLAG_IDS } from "../storyEvents/storyEventRegistry";
import type { StoryEventInput } from "../storyEvents/storyEventTypes";
import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type { NarrativeWorldState } from "../components/three/StoryScene";
import type { Vector3Tuple } from "../data/slipper3dTypes";
import {
  JOURNEY_BEAT_IDS_BY_ACT,
  JOURNEY_ENTRY_PROGRESS,
  JOURNEY_LANDMARK_IDS,
  JOURNEY_RECOVERED_KEY_IDS,
  JOURNEY_RITUAL_IDS,
  JOURNEY_SYMBOLIC_OBJECT_IDS,
  JOURNEY_WORLD_FLAG_IDS,
} from "../data/journeyBlueprint";
import { entries } from "../data/slipperContent";
import {
  createFreshStoryJourneyState,
  JOURNEY_ACT_IDS,
  JOURNEY_CHAPTER_IDS,
  JOURNEY_HISTORY_LIMIT,
  LANDMARK_STATES,
  mergeCloudJourneyState,
  sanitizeJourneySnapshot,
  sanitizeReleasedJourneyWord,
  sanitizeStoryJourneyState,
  STORY_JOURNEY_SCHEMA_VERSION,
  type JourneyActId,
  type JourneyChapterId,
  type JourneySceneId,
  type LandmarkState,
  type ResonanceKey,
  type StoryJourneyState,
  type CloudJourneySnapshot,
  type JourneySnapshot,
} from "../lib/journeySnapshot";
import {
  applyJourneySceneRewards,
  canCompleteChapter,
  canCompleteScene,
} from "../lib/journeyProgression";
import {
  buildNarrativeWorldState as deriveNarrativeWorldState,
  type NarrativeJourneyStateInput,
} from "../lib/narrativeJourneyState";

export { sanitizeJourneySnapshot };
export type { CloudJourneySnapshot, JourneySnapshot };

export type JourneyCloudStatus = "local" | "loading" | "saving" | "synced" | "signed-out" | "error";

type InitializeJourneyInput = {
  fallbackEntryId: string;
  validEntryIds: string[];
  legacySnapshot?: Partial<JourneySnapshot> | null;
};

export type JourneyStore = StoryJourneyState & {
  bookmarkedEntryIds: string[];
  lastSafeEntryId: string;
  playerPosition: Vector3Tuple | null;
  sceneRelocationRevision: number;
  isInitialized: boolean;
  narrativeWorldState: NarrativeWorldState;
  cloudStatus: JourneyCloudStatus;
  cloudMessage: string | null;
  cloudSubject: string | null;
  cloudLoadedAt: string | null;
  cloudSavedAt: string | null;
  initializeJourney: (input: InitializeJourneyInput) => void;
  setActiveEntry: (entryId: string) => void;
  navigateToEntry: (entryId: string) => void;
  markVisited: (entryId: string) => void;
  toggleBookmark: (entryId: string) => void;
  setSafePosition: (input: { entryId: string; position?: Vector3Tuple | null }) => void;
  goBack: () => string | null;
  hydrateJourney: (snapshot: Partial<JourneySnapshot>, options?: { source?: "local" | "cloud" }) => void;
  resetJourney: (initialEntryId: string) => void;
  startStory: () => void;
  enterBeat: (actId: JourneyActId, beatId: string) => void;
  witnessEntry: (entryId: string) => void;
  completeRitual: (ritualId: string) => void;
  dispatchStoryEvent: (input: StoryEventInput) => string[];
  setWorldFlag: (flagId: string, value?: boolean) => void;
  setLandmarkState: (landmarkId: string, landmarkState: LandmarkState) => void;
  addResonance: (key: ResonanceKey, amount?: number) => void;
  awardLantern: () => void;
  recoverKey: (keyId: string) => void;
  collectSymbolicObject: (objectId: string) => void;
  releaseWord: (word: string) => void;
  completeAct: (actId: JourneyActId) => void;
  completeScene: (sceneId: JourneySceneId) => void;
  completeChapter: (chapterId: JourneyChapterId) => void;
  completeStory: () => void;
  setCloudState: (input: Partial<Pick<JourneyStore, "cloudStatus" | "cloudMessage" | "cloudSubject" | "cloudLoadedAt" | "cloudSavedAt">>) => void;
  getSnapshot: () => CloudJourneySnapshot;
};

const FALLBACK_NARRATIVE_WORLD_STATE: NarrativeWorldState = {
  visitedCount: 1,
  totalCount: entries.length || 1,
  traceCount: 1,
  fireCount: 0,
  waterCount: 0,
  memoryCount: 0,
  thresholdCount: 0,
  crownCount: 0,
  fireWaterBalance: 0,
  explorationDepth: 0,
  memoryPressure: 0,
  symbolicWeight: 0.5,
};

const ENTRY_MAP = new Map(entries.map((entry) => [entry.id, entry]));
const ALL_ENTRY_IDS = entries.map((entry) => entry.id);
const DEFAULT_MAX_BOOKMARKS = 200;

const JOURNEY_RITUAL_ID_SET = new Set<string>(JOURNEY_RITUAL_IDS);
const JOURNEY_WORLD_FLAG_ID_SET = new Set<string>([...JOURNEY_WORLD_FLAG_IDS, ...STORY_EVENT_WORLD_FLAG_IDS]);
const JOURNEY_LANDMARK_ID_SET = new Set<string>(JOURNEY_LANDMARK_IDS);
const JOURNEY_RECOVERED_KEY_ID_SET = new Set<string>(JOURNEY_RECOVERED_KEY_IDS);
const JOURNEY_SYMBOLIC_OBJECT_ID_SET = new Set<string>(JOURNEY_SYMBOLIC_OBJECT_IDS);

function storySanitizeOptions(fallbackEntryId = ALL_ENTRY_IDS[0] ?? "") {
  return {
    fallbackEntryId,
    validEntryIds: ALL_ENTRY_IDS,
    entryProgress: JOURNEY_ENTRY_PROGRESS,
    beatIdsByAct: JOURNEY_BEAT_IDS_BY_ACT,
    ritualIds: JOURNEY_RITUAL_IDS,
    worldFlagIds: JOURNEY_WORLD_FLAG_IDS,
    landmarkIds: JOURNEY_LANDMARK_IDS,
    recoveredKeyIds: JOURNEY_RECOVERED_KEY_IDS,
    symbolicObjectIds: JOURNEY_SYMBOLIC_OBJECT_IDS,
  };
}

function unique(values: string[]) {
  return Array.from(new Set(values.filter(Boolean)));
}

function now() {
  return new Date().toISOString();
}

function sanitizePosition(value: unknown): Vector3Tuple | null {
  if (!Array.isArray(value) || value.length !== 3) return null;
  if (!value.every((item) => typeof item === "number" && Number.isFinite(item) && Math.abs(item) <= 10_000)) return null;
  return [value[0], value[1], value[2]];
}

function sanitizeEntryIds(value: unknown, validIds: Set<string>, maximum: number) {
  if (!Array.isArray(value)) return [];
  return unique(
    value.filter((entryId): entryId is string => typeof entryId === "string" && validIds.has(entryId)),
  ).slice(-maximum);
}

export function buildNarrativeWorldState(state: NarrativeJourneyStateInput): NarrativeWorldState {
  return deriveNarrativeWorldState(state, {
    entryById: ENTRY_MAP,
    totalCount: entries.length,
  });
}

function validIdSet(validEntryIds?: string[]) {
  const source = validEntryIds?.length ? validEntryIds : ALL_ENTRY_IDS;
  return new Set(source);
}

function withNarrativeWorldState(snapshot: StoryJourneyState) {
  return {
    ...snapshot,
    narrativeWorldState: buildNarrativeWorldState(snapshot),
  };
}

function storySnapshotFrom(state: StoryJourneyState): StoryJourneyState {
  return {
    schemaVersion: STORY_JOURNEY_SCHEMA_VERSION,
    completedStoryEventIds: state.completedStoryEventIds,
    storyObjectStates: state.storyObjectStates,
    storyPlacementStates: state.storyPlacementStates,
    actId: state.actId,
    chapterId: state.chapterId,
    sceneId: state.sceneId,
    beatId: state.beatId,
    activeEntryId: state.activeEntryId,
    history: state.history,
    visitedEntryIds: state.visitedEntryIds,
    witnessedEntryIds: state.witnessedEntryIds,
    completedRitualIds: state.completedRitualIds,
    worldFlags: state.worldFlags,
    landmarkStates: state.landmarkStates,
    resonances: state.resonances,
    inventory: state.inventory,
    releasedWords: state.releasedWords,
    completedActs: state.completedActs,
    completedChapterIds: state.completedChapterIds,
    completedSceneIds: state.completedSceneIds,
    storyStarted: state.storyStarted,
    storyCompleted: state.storyCompleted,
    storyStartedAt: state.storyStartedAt,
    storyCompletedAt: state.storyCompletedAt,
    updatedAt: state.updatedAt,
  };
}

function cloudSnapshotFrom(state: StoryJourneyState): CloudJourneySnapshot {
  return {
    ...storySnapshotFrom(state),
    cloudSchemaVersion: STORY_JOURNEY_SCHEMA_VERSION,
    migratedFromNavigation: false,
  };
}

export const useJourneyStore = create<JourneyStore>()(
  persist(
    (set, get) => {
      const freshStory = createFreshStoryJourneyState(storySanitizeOptions());
      const commitStory = (snapshot: StoryJourneyState) => {
        const state = get();
        const sanitized = sanitizeStoryJourneyState(snapshot, storySanitizeOptions(snapshot.activeEntryId));
        set({
          ...withNarrativeWorldState(sanitized),
          cloudStatus: state.cloudSubject ? "saving" : state.cloudStatus,
        });
      };
      const updateStory = (update: (snapshot: StoryJourneyState, timestamp: string) => StoryJourneyState) => {
        const state = get();
        const timestamp = now();
        commitStory(update(storySnapshotFrom(state), timestamp));
      };

      return {
        ...freshStory,
        activeEntryId: "",
        visitedEntryIds: [],
        bookmarkedEntryIds: [],
        lastSafeEntryId: "",
        playerPosition: null,
        sceneRelocationRevision: 0,
        isInitialized: false,
        narrativeWorldState: FALLBACK_NARRATIVE_WORLD_STATE,
        cloudStatus: "local",
        cloudMessage: null,
        cloudSubject: null,
        cloudLoadedAt: null,
        cloudSavedAt: null,

        initializeJourney: ({ fallbackEntryId, validEntryIds, legacySnapshot }) => {
          const current = get();
          const validIds = validIdSet(validEntryIds);
          const currentIsValid = Boolean(current.activeEntryId && validIds.has(current.activeEntryId));
          const source = currentIsValid ? storySnapshotFrom(current) : legacySnapshot;
          const snapshot = source
            ? sanitizeStoryJourneyState(source, {
                ...storySanitizeOptions(fallbackEntryId),
                validEntryIds,
              })
            : createFreshStoryJourneyState({
                ...storySanitizeOptions(fallbackEntryId),
                validEntryIds,
              });
          set({ ...withNarrativeWorldState(snapshot), isInitialized: true });
        },

        setActiveEntry: (entryId) => {
          get().navigateToEntry(entryId);
        },

        navigateToEntry: (entryId) => {
          if (!entryId || !ENTRY_MAP.has(entryId)) return;
          const state = get();
          if (entryId === state.activeEntryId) {
            if (!state.visitedEntryIds.includes(entryId)) get().markVisited(entryId);
            return;
          }

          const nextHistory = state.activeEntryId
            ? [...state.history, state.activeEntryId].slice(-JOURNEY_HISTORY_LIMIT)
            : state.history.slice(-JOURNEY_HISTORY_LIMIT);
          const snapshot = sanitizeStoryJourneyState(
            {
              ...storySnapshotFrom(state),
              activeEntryId: entryId,
              history: nextHistory,
              visitedEntryIds: unique([...state.visitedEntryIds, entryId]),
              updatedAt: now(),
            },
            storySanitizeOptions(entryId),
          );

          set({
            ...withNarrativeWorldState(snapshot),
            lastSafeEntryId: entryId,
            playerPosition: null,
            cloudStatus: state.cloudSubject ? "saving" : state.cloudStatus,
          });
        },

        markVisited: (entryId) => {
          if (!entryId || !ENTRY_MAP.has(entryId)) return;
          const state = get();
          if (state.visitedEntryIds.includes(entryId)) return;
          updateStory((snapshot, timestamp) => ({
            ...snapshot,
            visitedEntryIds: unique([...snapshot.visitedEntryIds, entryId]),
            updatedAt: timestamp,
          }));
        },

        toggleBookmark: (entryId) => {
          if (!entryId || !ENTRY_MAP.has(entryId)) return;
          const state = get();
          const bookmarkedEntryIds = state.bookmarkedEntryIds.includes(entryId)
            ? state.bookmarkedEntryIds.filter((candidate) => candidate !== entryId)
            : unique([...state.bookmarkedEntryIds, entryId]).slice(-DEFAULT_MAX_BOOKMARKS);
          set({ bookmarkedEntryIds });
        },

        setSafePosition: ({ entryId, position }) => {
          if (!entryId || !ENTRY_MAP.has(entryId)) return;
          const state = get();
          const nextPosition = sanitizePosition(position);
          const currentPosition = state.playerPosition;
          const unchanged =
            state.lastSafeEntryId === entryId &&
            ((!currentPosition && !nextPosition) ||
              (currentPosition &&
                nextPosition &&
                currentPosition.every((value, index) => Math.abs(value - nextPosition[index]) < 0.35)));
          if (unchanged) return;
          set({ lastSafeEntryId: entryId, playerPosition: nextPosition });
        },

        goBack: () => {
          const state = get();
          const previousEntryId = state.history[state.history.length - 1];
          if (!previousEntryId || !ENTRY_MAP.has(previousEntryId)) return null;
          const snapshot = sanitizeStoryJourneyState(
            {
              ...storySnapshotFrom(state),
              activeEntryId: previousEntryId,
              history: state.history.slice(0, -1),
              visitedEntryIds: unique([...state.visitedEntryIds, previousEntryId]),
              updatedAt: now(),
            },
            storySanitizeOptions(previousEntryId),
          );
          set({
            ...withNarrativeWorldState(snapshot),
            lastSafeEntryId: previousEntryId,
            playerPosition: null,
            sceneRelocationRevision: state.sceneRelocationRevision + 1,
            cloudStatus: state.cloudSubject ? "saving" : state.cloudStatus,
          });
          return previousEntryId;
        },

        hydrateJourney: (snapshot, options) => {
          const current = get();
          const hydrated = mergeCloudJourneyState(
            storySnapshotFrom(current),
            snapshot,
            storySanitizeOptions(current.activeEntryId || ALL_ENTRY_IDS[0] || ""),
          );
          set({
            ...withNarrativeWorldState(hydrated),
            lastSafeEntryId: hydrated.activeEntryId,
            playerPosition: null,
            sceneRelocationRevision: current.sceneRelocationRevision + 1,
            isInitialized: true,
            cloudLoadedAt: options?.source === "cloud" ? now() : current.cloudLoadedAt,
          });
        },

        resetJourney: (initialEntryId) => {
          const state = get();
          const snapshot = createFreshStoryJourneyState(storySanitizeOptions(initialEntryId));
          set({
            ...withNarrativeWorldState(snapshot),
            bookmarkedEntryIds: [],
            lastSafeEntryId: snapshot.activeEntryId,
            playerPosition: null,
            sceneRelocationRevision: state.sceneRelocationRevision + 1,
            cloudStatus: state.cloudSubject ? "saving" : state.cloudStatus,
          });
        },

        startStory: () => {
          if (get().storyStarted) return;
          updateStory((snapshot, timestamp) => ({
            ...snapshot,
            storyStarted: true,
            storyStartedAt: timestamp,
            updatedAt: timestamp,
          }));
        },

        enterBeat: (actId, beatId) => {
          if (!JOURNEY_ACT_IDS.includes(actId) || !JOURNEY_BEAT_IDS_BY_ACT[actId].includes(beatId)) return;
          const state = get();
          if (state.actId === actId && state.beatId === beatId) return;
          updateStory((snapshot, timestamp) => ({ ...snapshot, actId, beatId, updatedAt: timestamp }));
        },

        witnessEntry: (entryId) => {
          if (!ENTRY_MAP.has(entryId) || get().witnessedEntryIds.includes(entryId)) return;
          updateStory((snapshot, timestamp) => ({
            ...snapshot,
            witnessedEntryIds: [...snapshot.witnessedEntryIds, entryId],
            updatedAt: timestamp,
          }));
        },

        dispatchStoryEvent: (input) => {
          const snapshot = storySnapshotFrom(get());
          const ready = input.trigger === "scene-enter" && input.sceneId === snapshot.sceneId
            ? reconcileLegacyStoryEventEntry(snapshot)
            : snapshot;
          const result = dispatchStoryEventState(ready, input);
          if (result.eventIds.length === 0) return [];
          commitStory({ ...result.state, updatedAt: now() });
          publishAcceptedStoryEvents(input.sceneId, result.eventIds.filter(id => !snapshot.completedStoryEventIds.includes(id)));
          return result.eventIds;
        },

        completeRitual: (ritualId) => {
          if (!JOURNEY_RITUAL_ID_SET.has(ritualId) || get().completedRitualIds.includes(ritualId)) return;
          updateStory((snapshot, timestamp) => ({
            ...snapshot,
            completedRitualIds: [...snapshot.completedRitualIds, ritualId],
            updatedAt: timestamp,
          }));
        },

        setWorldFlag: (flagId, value = true) => {
          if (!JOURNEY_WORLD_FLAG_ID_SET.has(flagId) || get().worldFlags[flagId] === value) return;
          updateStory((snapshot, timestamp) => ({
            ...snapshot,
            worldFlags: { ...snapshot.worldFlags, [flagId]: value },
            updatedAt: timestamp,
          }));
        },

        setLandmarkState: (landmarkId, landmarkState) => {
          if (!JOURNEY_LANDMARK_ID_SET.has(landmarkId) || !LANDMARK_STATES.includes(landmarkState) || get().landmarkStates[landmarkId] === landmarkState) return;
          updateStory((snapshot, timestamp) => ({
            ...snapshot,
            landmarkStates: { ...snapshot.landmarkStates, [landmarkId]: landmarkState },
            updatedAt: timestamp,
          }));
        },

        addResonance: (key, amount = 1) => {
          if (!Number.isFinite(amount) || amount === 0) return;
          const current = get().resonances[key];
          const next = Math.max(0, Math.min(100, Math.round(current + amount)));
          if (next === current) return;
          updateStory((snapshot, timestamp) => ({
            ...snapshot,
            resonances: { ...snapshot.resonances, [key]: next },
            updatedAt: timestamp,
          }));
        },

        awardLantern: () => {
          if (get().inventory.lantern) return;
          updateStory((snapshot, timestamp) => ({
            ...snapshot,
            inventory: { ...snapshot.inventory, lantern: true },
            updatedAt: timestamp,
          }));
        },

        recoverKey: (keyId) => {
          if (!JOURNEY_RECOVERED_KEY_ID_SET.has(keyId) || get().inventory.recoveredKeys.includes(keyId)) return;
          updateStory((snapshot, timestamp) => ({
            ...snapshot,
            inventory: {
              ...snapshot.inventory,
              recoveredKeys: [...snapshot.inventory.recoveredKeys, keyId],
            },
            updatedAt: timestamp,
          }));
        },

        collectSymbolicObject: (objectId) => {
          if (!JOURNEY_SYMBOLIC_OBJECT_ID_SET.has(objectId) || get().inventory.symbolicObjects.includes(objectId)) return;
          updateStory((snapshot, timestamp) => ({
            ...snapshot,
            inventory: {
              ...snapshot.inventory,
              symbolicObjects: [...snapshot.inventory.symbolicObjects, objectId],
            },
            updatedAt: timestamp,
          }));
        },

        releaseWord: (word) => {
          const releasedWord = sanitizeReleasedJourneyWord(word);
          if (!releasedWord || get().releasedWords.some((candidate) => candidate.toLocaleLowerCase("en") === releasedWord.toLocaleLowerCase("en"))) return;
          updateStory((snapshot, timestamp) => ({
            ...snapshot,
            releasedWords: [...snapshot.releasedWords, releasedWord],
            updatedAt: timestamp,
          }));
        },

        completeAct: (actId) => {
          const actIndex = JOURNEY_ACT_IDS.indexOf(actId);
          const state = get();
          if (
            actIndex < 0 ||
            state.completedActs.includes(actId) ||
            JOURNEY_ACT_IDS.slice(0, actIndex).some((candidate) => !state.completedActs.includes(candidate))
          ) return;
          updateStory((snapshot, timestamp) => ({
            ...snapshot,
            completedActs: [...snapshot.completedActs, actId],
            updatedAt: timestamp,
          }));
        },

        completeScene: (sceneId) => {
          const state = get();
          if (!canCompleteScene(sceneId, state)) return;
          updateStory((snapshot, timestamp) => ({
            ...snapshot,
            completedSceneIds: [...snapshot.completedSceneIds, sceneId],
            inventory: applyJourneySceneRewards(sceneId, snapshot.inventory),
            updatedAt: timestamp,
          }));
        },

        completeChapter: (chapterId) => {
          const state = get();
          if (!canCompleteChapter(chapterId, state)) return;
          updateStory((snapshot, timestamp) => ({
            ...snapshot,
            completedChapterIds: [...snapshot.completedChapterIds, chapterId],
            updatedAt: timestamp,
          }));
        },

        completeStory: () => {
          const state = get();
          const narrativeComplete = JOURNEY_CHAPTER_IDS.every((chapterId) =>
            state.completedChapterIds.includes(chapterId)
          );
          const legacyComplete =
            state.completedChapterIds.length === 0 &&
            JOURNEY_ACT_IDS.every((actId) => state.completedActs.includes(actId));
          if (state.storyCompleted || (!narrativeComplete && !legacyComplete)) return;
          updateStory((snapshot, timestamp) => ({
            ...snapshot,
            storyStarted: true,
            storyCompleted: true,
            storyStartedAt: snapshot.storyStartedAt ?? timestamp,
            storyCompletedAt: timestamp,
            updatedAt: timestamp,
          }));
        },

        setCloudState: (input) => {
          set((state) => ({
            cloudStatus: input.cloudStatus ?? state.cloudStatus,
            cloudMessage: input.cloudMessage === undefined ? state.cloudMessage : input.cloudMessage,
            cloudSubject: input.cloudSubject === undefined ? state.cloudSubject : input.cloudSubject,
            cloudLoadedAt: input.cloudLoadedAt === undefined ? state.cloudLoadedAt : input.cloudLoadedAt,
            cloudSavedAt: input.cloudSavedAt === undefined ? state.cloudSavedAt : input.cloudSavedAt,
          }));
        },

        getSnapshot: () => cloudSnapshotFrom(get()),
      };
    },
    {
      name: "sidtw:journey:v3",
      version: 6,
      storage: createJSONStorage(() => localStorage),
      // Persist v6 adds the schema-v2 narrative chapter/scene projection. The
      // story sanitizer performs the explicit v1 migration without widening
      // the navigation-only cloud contract. Layouts before v4 also discard the
      // one player coordinate that belonged to the earlier physical world.
      migrate: (persistedState, version) => {
        let migrated = persistedState;
        if (
          version < 4 &&
          persistedState &&
          typeof persistedState === "object"
        ) {
          migrated = { ...persistedState, playerPosition: null };
        }
        if (version < 6 && migrated && typeof migrated === "object") {
          const story = sanitizeStoryJourneyState(migrated, storySanitizeOptions());
          return { ...migrated, ...story };
        }
        return migrated;
      },
      partialize: (state) => ({
        ...storySnapshotFrom(state),
        bookmarkedEntryIds: state.bookmarkedEntryIds,
        lastSafeEntryId: state.lastSafeEntryId,
        playerPosition: state.playerPosition,
      }),
      merge: (persisted, current) => {
        const persistedSnapshot = persisted as
          | (Partial<StoryJourneyState> & {
              bookmarkedEntryIds?: unknown;
              lastSafeEntryId?: unknown;
              playerPosition?: unknown;
            })
          | undefined;
        const snapshot = sanitizeStoryJourneyState(persistedSnapshot, storySanitizeOptions());
        const validIds = validIdSet(ALL_ENTRY_IDS);
        const lastSafeEntryId =
          typeof persistedSnapshot?.lastSafeEntryId === "string" && validIds.has(persistedSnapshot.lastSafeEntryId)
            ? persistedSnapshot.lastSafeEntryId
            : snapshot.activeEntryId;
        return {
          ...current,
          ...withNarrativeWorldState(snapshot),
          bookmarkedEntryIds: sanitizeEntryIds(persistedSnapshot?.bookmarkedEntryIds, validIds, DEFAULT_MAX_BOOKMARKS),
          lastSafeEntryId,
          playerPosition: sanitizePosition(persistedSnapshot?.playerPosition),
        };
      },
    },
  ),
);
