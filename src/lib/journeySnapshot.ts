import {
  sanitizeStoryJourneyState,
  STORY_JOURNEY_SCHEMA_VERSION,
  type StoryJourneyState,
} from "./storyJourneyState.ts";

/** Complete, versioned narrative state persisted through the cloud boundary. */
export type CloudJourneySnapshot = StoryJourneyState & {
  cloudSchemaVersion: typeof import("./storyJourneyState.ts").STORY_JOURNEY_SCHEMA_VERSION;
  migratedFromNavigation: boolean;
};

/** Backward-compatible name used by existing navigation consumers. */
export type JourneySnapshot = CloudJourneySnapshot;

export function sanitizeJourneySnapshot(
  snapshot: Partial<StoryJourneyState> | null | undefined,
  fallbackEntryId: string,
  validEntryIds: string[],
): JourneySnapshot {
  const sanitized = sanitizeStoryJourneyState(snapshot, {
    fallbackEntryId,
    validEntryIds,
  });
  const source = snapshot as (Partial<CloudJourneySnapshot> | null | undefined);
  return {
    ...sanitized,
    cloudSchemaVersion: STORY_JOURNEY_SCHEMA_VERSION,
    migratedFromNavigation: source?.migratedFromNavigation === true,
  };
}

export {
  BEAT_ROLES,
  STORY_JOURNEY_SCHEMA_VERSION,
  createFreshStoryJourneyState,
  isSupportedStoryJourneyState,
  JOURNEY_ACT_IDS,
  JOURNEY_CHAPTER_IDS,
  JOURNEY_HISTORY_LIMIT,
  JOURNEY_SCENE_IDS,
  LANDMARK_STATES,
  mergeCloudJourneyNavigation,
  mergeCloudJourneyState,
  migrateLegacyStoryJourneyState,
  RESONANCE_KEYS,
  RITUAL_VERBS,
  sanitizeReleasedJourneyWord,
  sanitizeStoryJourneyState,
  type BeatRole,
  type JourneyActId,
  type JourneyChapterId,
  type JourneySceneId,
  type LandmarkState,
  type ResonanceKey,
  type RitualVerb,
  type StoryJourneyAllowlists,
  type StoryJourneyInventory,
  type StoryJourneyProgressLocation,
  type StoryJourneySanitizeOptions,
  type StoryJourneyState,
} from "./storyJourneyState.ts";
