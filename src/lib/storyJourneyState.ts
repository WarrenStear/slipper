import { sanitizeStoryEventPersistence } from "../storyEvents/storyEventSchema.ts";
import { STORY_EVENT_WORLD_FLAG_IDS } from "../storyEvents/storyEventRegistry.ts";
import type { StoryEventPersistentState } from "../storyEvents/storyEventTypes.ts";
import { inferJourneyPlayerActionEvidence } from "./journeyPlayerActions.ts";

export const STORY_JOURNEY_SCHEMA_VERSION = 2 as const;
/** Keeps many full 66-fragment crossings while bounding persisted payload growth. */
export const JOURNEY_HISTORY_LIMIT = 512;

export const JOURNEY_ACT_IDS = [
  "first-wood",
  "mirror-clearing",
  "thorned-house",
  "blue-moon-archive",
  "fire-and-river",
  "crowned-return",
] as const;

export type JourneyActId = (typeof JOURNEY_ACT_IDS)[number];

/**
 * The authored narrative's twelve chapters. JourneyActId remains the stable
 * six-region physical-world contract during the storyline migration.
 */
export const JOURNEY_CHAPTER_IDS = [
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

export type JourneyChapterId = (typeof JOURNEY_CHAPTER_IDS)[number];
export type NarrativeChapterId = JourneyChapterId;

export const JOURNEY_SCENE_IDS = [
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

export type JourneySceneId = (typeof JOURNEY_SCENE_IDS)[number];

export const BEAT_ROLES = [
  "arrival",
  "keystone",
  "echo",
  "ritual",
  "threshold",
  "transformation",
  "departure",
] as const;

export type BeatRole = (typeof BEAT_ROLES)[number];

export const RITUAL_VERBS = [
  "witness",
  "touch",
  "hold",
  "wash",
  "burn",
  "release",
  "recover",
  "surrender",
  "plant",
  "leave",
  "place",
  "carry",
] as const;

export type RitualVerb = (typeof RITUAL_VERBS)[number];

export const LANDMARK_STATES = [
  "untouched",
  "awakened",
  "witnessed",
  "transformed",
  "scarred",
  "released",
] as const;

export type LandmarkState = (typeof LANDMARK_STATES)[number];

export const RESONANCE_KEYS = ["wolf", "swan", "seer"] as const;
export type ResonanceKey = (typeof RESONANCE_KEYS)[number];

export type StoryJourneyInventory = {
  lantern: boolean;
  recoveredKeys: string[];
  symbolicObjects: string[];
};

export type StoryJourneyState = StoryEventPersistentState & {
  schemaVersion: typeof STORY_JOURNEY_SCHEMA_VERSION;
  actId: JourneyActId;
  chapterId: JourneyChapterId;
  sceneId: JourneySceneId;
  beatId: string;
  activeEntryId: string;
  history: string[];
  visitedEntryIds: string[];
  witnessedEntryIds: string[];
  completedRitualIds: string[];
  worldFlags: Record<string, boolean>;
  landmarkStates: Record<string, LandmarkState>;
  resonances: Record<ResonanceKey, number>;
  inventory: StoryJourneyInventory;
  releasedWords: string[];
  completedActs: JourneyActId[];
  completedChapterIds: JourneyChapterId[];
  completedSceneIds: JourneySceneId[];
  storyStarted: boolean;
  storyCompleted: boolean;
  storyStartedAt: string | null;
  storyCompletedAt: string | null;
  updatedAt: string;
};

export type StoryJourneyProgressLocation = {
  actId: JourneyActId;
  chapterId: JourneyChapterId;
  sceneId: JourneySceneId;
  beatId: string;
};

export type StoryJourneyAllowlists = {
  validEntryIds?: readonly string[];
  entryProgress?: Readonly<Record<string, StoryJourneyProgressLocation>>;
  beatIdsByAct?: Partial<Record<JourneyActId, readonly string[]>>;
  chapterIds?: readonly JourneyChapterId[];
  sceneIds?: readonly JourneySceneId[];
  ritualIds?: readonly string[];
  worldFlagIds?: readonly string[];
  landmarkIds?: readonly string[];
  recoveredKeyIds?: readonly string[];
  symbolicObjectIds?: readonly string[];
};

export type StoryJourneySanitizeOptions = StoryJourneyAllowlists & {
  fallbackEntryId: string;
  now?: () => string;
  maxHistory?: number;
  maxEntryIds?: number;
  maxReleasedWords?: number;
  maxReleasedWordLength?: number;
};

const DEFAULT_MAX_HISTORY = JOURNEY_HISTORY_LIMIT;
const DEFAULT_MAX_ENTRY_IDS = 1_000;
const DEFAULT_MAX_RELEASED_WORDS = 64;
const DEFAULT_MAX_RELEASED_WORD_LENGTH = 48;
const MAX_OPAQUE_ID_LENGTH = 96;
const OPAQUE_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]*$/;
const LANDMARK_STATE_SET = new Set<string>(LANDMARK_STATES);
const ACT_ID_SET = new Set<string>(JOURNEY_ACT_IDS);
const CHAPTER_ID_SET = new Set<string>(JOURNEY_CHAPTER_IDS);
const SCENE_ID_SET = new Set<string>(JOURNEY_SCENE_IDS);

function asRecord(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function boundedInteger(value: unknown, minimum: number, maximum: number, fallback = minimum) {
  if (typeof value !== "number" || !Number.isFinite(value)) return fallback;
  return Math.max(minimum, Math.min(maximum, Math.round(value)));
}

function boundedOpaqueId(value: unknown) {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  if (
    normalized.length === 0 ||
    normalized.length > MAX_OPAQUE_ID_LENGTH ||
    !OPAQUE_ID_PATTERN.test(normalized)
  ) return null;
  return normalized;
}

function validIsoDate(value: unknown, fallback: string) {
  return typeof value === "string" && !Number.isNaN(Date.parse(value))
    ? value
    : fallback;
}

function nullableIsoDate(value: unknown) {
  return typeof value === "string" && !Number.isNaN(Date.parse(value))
    ? value
    : null;
}

function allowlist(values: readonly string[] | undefined) {
  return values === undefined ? null : new Set(values);
}

function sanitizeId(
  value: unknown,
  allowedValues: Set<string> | null,
) {
  const id = boundedOpaqueId(value);
  if (!id || (allowedValues && !allowedValues.has(id))) return null;
  return id;
}

function sanitizeIdArray(
  value: unknown,
  allowedValues: Set<string> | null,
  maximum: number,
  deduplicate = true,
) {
  if (!Array.isArray(value)) return [];
  const result: string[] = [];
  const seen = new Set<string>();
  for (const candidate of value) {
    const id = sanitizeId(candidate, allowedValues);
    if (!id || (deduplicate && seen.has(id))) continue;
    seen.add(id);
    result.push(id);
    if (result.length >= maximum) break;
  }
  return result;
}

function sanitizeReleasedWord(value: unknown, maximumLength: number) {
  if (typeof value !== "string") return null;
  const normalized = value
    .normalize("NFC")
    .replace(/[\u0000-\u001F\u007F-\u009F]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!normalized) return null;
  return Array.from(normalized).slice(0, maximumLength).join("");
}

function sanitizeReleasedWords(value: unknown, maximum: number, maximumLength: number) {
  if (!Array.isArray(value)) return [];
  const result: string[] = [];
  const seen = new Set<string>();
  for (const candidate of value) {
    const word = sanitizeReleasedWord(candidate, maximumLength);
    if (!word) continue;
    const identity = word.toLocaleLowerCase("en");
    if (seen.has(identity)) continue;
    seen.add(identity);
    result.push(word);
    if (result.length >= maximum) break;
  }
  return result;
}

function sanitizeActId(value: unknown, fallback: JourneyActId) {
  return typeof value === "string" && ACT_ID_SET.has(value)
    ? value as JourneyActId
    : fallback;
}

function configuredIdSet<T extends string>(
  values: readonly T[] | undefined,
  canonicalValues: readonly T[],
) {
  if (!values) return new Set<string>(canonicalValues);
  const requested = new Set<string>(values);
  return new Set<string>(canonicalValues.filter((value) => requested.has(value)));
}

function firstAllowedId<T extends string>(
  canonicalValues: readonly T[],
  allowedValues: Set<string>,
) {
  return canonicalValues.find((value) => allowedValues.has(value)) ?? canonicalValues[0];
}

function fallbackProgress(options: StoryJourneySanitizeOptions, activeEntryId: string) {
  const allowedChapterIds = configuredIdSet(options.chapterIds, JOURNEY_CHAPTER_IDS);
  const allowedSceneIds = configuredIdSet(options.sceneIds, JOURNEY_SCENE_IDS);
  const fallbackChapterId = firstAllowedId(JOURNEY_CHAPTER_IDS, allowedChapterIds);
  const fallbackSceneId = firstAllowedId(JOURNEY_SCENE_IDS, allowedSceneIds);
  const mapped = options.entryProgress?.[activeEntryId];
  if (mapped && ACT_ID_SET.has(mapped.actId) && boundedOpaqueId(mapped.beatId)) {
    return {
      actId: mapped.actId,
      chapterId: CHAPTER_ID_SET.has(mapped.chapterId) && allowedChapterIds.has(mapped.chapterId)
        ? mapped.chapterId
        : fallbackChapterId,
      sceneId: SCENE_ID_SET.has(mapped.sceneId) && allowedSceneIds.has(mapped.sceneId)
        ? mapped.sceneId
        : fallbackSceneId,
      beatId: mapped.beatId,
    };
  }
  const firstAct = JOURNEY_ACT_IDS[0];
  const firstBeat = options.beatIdsByAct?.[firstAct]?.[0] ?? BEAT_ROLES[0];
  return {
    actId: firstAct,
    chapterId: fallbackChapterId,
    sceneId: fallbackSceneId,
    beatId: firstBeat,
  };
}

function sanitizeBeatId(
  value: unknown,
  actId: JourneyActId,
  fallbackBeatId: string,
  options: StoryJourneySanitizeOptions,
) {
  const allowed = allowlist(options.beatIdsByAct?.[actId]);
  return sanitizeId(value, allowed) ?? sanitizeId(fallbackBeatId, allowed) ?? allowed?.values().next().value ?? BEAT_ROLES[0];
}

function sanitizeBooleanRecord(value: unknown, allowedValues: Set<string> | null) {
  const record = asRecord(value);
  if (!record) return {};
  return Object.fromEntries(
    Object.entries(record)
      .map(([key, candidate]) => [sanitizeId(key, allowedValues), candidate] as const)
      .filter((entry): entry is readonly [string, boolean] => Boolean(entry[0]) && typeof entry[1] === "boolean"),
  );
}

function sanitizeLandmarkRecord(value: unknown, allowedValues: Set<string> | null) {
  const record = asRecord(value);
  if (!record) return {};
  return Object.fromEntries(
    Object.entries(record)
      .map(([key, candidate]) => [sanitizeId(key, allowedValues), candidate] as const)
      .filter(
        (entry): entry is readonly [string, LandmarkState] =>
          Boolean(entry[0]) && typeof entry[1] === "string" && LANDMARK_STATE_SET.has(entry[1]),
      ),
  );
}

function completedActs(value: unknown) {
  if (!Array.isArray(value)) return [];
  const selected = new Set(
    value.filter((candidate): candidate is JourneyActId =>
      typeof candidate === "string" && ACT_ID_SET.has(candidate),
    ),
  );
  return JOURNEY_ACT_IDS.filter((actId) => selected.has(actId));
}

function completedChapterIds(value: unknown, options: StoryJourneySanitizeOptions) {
  const allowedValues = configuredIdSet(options.chapterIds, JOURNEY_CHAPTER_IDS);
  const selected = new Set(sanitizeIdArray(value, allowedValues, JOURNEY_CHAPTER_IDS.length));
  return JOURNEY_CHAPTER_IDS.filter((chapterId) => selected.has(chapterId));
}

function completedSceneIds(value: unknown, options: StoryJourneySanitizeOptions) {
  const allowedValues = configuredIdSet(options.sceneIds, JOURNEY_SCENE_IDS);
  const selected = new Set(sanitizeIdArray(value, allowedValues, JOURNEY_SCENE_IDS.length));
  return JOURNEY_SCENE_IDS.filter((sceneId) => selected.has(sceneId));
}

function sanitizeCurrentState(
  input: Record<string, unknown>,
  options: StoryJourneySanitizeOptions,
): StoryJourneyState {
  const timestamp = (options.now ?? (() => new Date().toISOString()))();
  const validEntryIds = allowlist(options.validEntryIds);
  const maxEntryIds = options.maxEntryIds ?? DEFAULT_MAX_ENTRY_IDS;
  const fallbackEntryId =
    sanitizeId(options.fallbackEntryId, validEntryIds) ??
    options.validEntryIds?.[0] ??
    "";
  const activeEntryId = sanitizeId(input.activeEntryId, validEntryIds) ?? fallbackEntryId;
  const progress = fallbackProgress(options, activeEntryId);
  const actId = sanitizeActId(input.actId, progress.actId);
  const beatId = sanitizeBeatId(input.beatId, actId, progress.actId === actId ? progress.beatId : BEAT_ROLES[0], options);
  const history = sanitizeIdArray(
    input.history,
    validEntryIds,
    options.maxHistory ?? DEFAULT_MAX_HISTORY,
    false,
  );
  const visitedEntryIds = sanitizeIdArray(input.visitedEntryIds, validEntryIds, maxEntryIds);
  if (fallbackEntryId && !visitedEntryIds.includes(fallbackEntryId)) visitedEntryIds.unshift(fallbackEntryId);
  if (activeEntryId && !visitedEntryIds.includes(activeEntryId)) visitedEntryIds.push(activeEntryId);
  const normalizedCompletedActs = completedActs(input.completedActs);
  const normalizedCompletedChapterIds = completedChapterIds(input.completedChapterIds, options);
  const normalizedCompletedSceneIds = completedSceneIds(input.completedSceneIds, options);
  const storyStarted = input.storyStarted === true;
  const everyActCompleted = JOURNEY_ACT_IDS.every((candidate) => normalizedCompletedActs.includes(candidate));
  const everyChapterCompleted = JOURNEY_CHAPTER_IDS.every((candidate) =>
    normalizedCompletedChapterIds.includes(candidate)
  );
  const storyCompleted = input.storyCompleted === true &&
    (everyChapterCompleted || (normalizedCompletedChapterIds.length === 0 && everyActCompleted));
  const inventory = asRecord(input.inventory);
  const resonances = asRecord(input.resonances);
  const allowedRecoveredKeyIds = allowlist(options.recoveredKeyIds);
  const allowedSymbolicObjectIds = allowlist(options.symbolicObjectIds);
  const recoveredKeys = sanitizeIdArray(
    inventory?.recoveredKeys,
    allowedRecoveredKeyIds,
    options.recoveredKeyIds?.length ?? 128,
  );
  const symbolicObjects = sanitizeIdArray(
    inventory?.symbolicObjects,
    allowedSymbolicObjectIds,
    options.symbolicObjectIds?.length ?? 128,
  );
  if (
    normalizedCompletedSceneIds.includes("nest.protection") &&
    (!allowedRecoveredKeyIds || allowedRecoveredKeyIds.has("key.protection")) &&
    !recoveredKeys.includes("key.protection")
  ) {
    recoveredKeys.push("key.protection");
  }
  if (
    normalizedCompletedSceneIds.includes("climb.heart") &&
    (!allowedSymbolicObjectIds || allowedSymbolicObjectIds.has("memory.chosen-heart")) &&
    !symbolicObjects.includes("memory.chosen-heart")
  ) {
    symbolicObjects.push("memory.chosen-heart");
  }
  const worldFlags = sanitizeBooleanRecord(
    input.worldFlags,
    allowlist(options.worldFlagIds ? [...options.worldFlagIds, ...STORY_EVENT_WORLD_FLAG_IDS] : undefined),
  );
  const inferredActionEvidence = inferJourneyPlayerActionEvidence(
    normalizedCompletedSceneIds,
  );
  const allowedWorldFlagIds = allowlist(options.worldFlagIds);
  for (const flagId of inferredActionEvidence.worldFlagIds) {
    if (!allowedWorldFlagIds || allowedWorldFlagIds.has(flagId)) {
      worldFlags[flagId] = true;
    }
  }
  for (const objectId of inferredActionEvidence.symbolicObjectIds) {
    if (
      (!allowedSymbolicObjectIds || allowedSymbolicObjectIds.has(objectId)) &&
      !symbolicObjects.includes(objectId)
    ) {
      symbolicObjects.push(objectId);
    }
  }

  const storyEvents = sanitizeStoryEventPersistence({ ...input, sceneId: progress.sceneId });
  // Existing saves retain earned carrying continuity. Never choose a Heart or
  // Womb symbol unless the old inventory already contains that exact choice.
  if (storyEvents.completedStoryEventIds.length === 0) {
    const place = storyEvents.storyObjectStates;
    if (normalizedCompletedSceneIds.includes("nest.two-hands") && !normalizedCompletedSceneIds.includes("nest.protection")) place["nest.protected-linen"] = "carried";
    if (normalizedCompletedSceneIds.includes("nest.two-hands") && !normalizedCompletedSceneIds.includes("nest.unsupported-cycle")) place["nest.responsibility"] = "carried";
    if (normalizedCompletedSceneIds.includes("fork.relinquish-hope") && !place["lantern.master"] && worldFlags["lantern.placed-and-lit"] !== true) place["lantern.master"] = "carried";
    for (const [legacy, objectId, meaning] of [
      ["memory.heart.tenderness", "heart.rose", "blush-rose"],
      ["memory.heart.beauty", "heart.feather", "swan-feather"],
      ["memory.heart.selfhood", "heart.reflection", "blue-moon-reflection"],
    ]) {
      if (symbolicObjects.includes(legacy) && !place["heart.memory"]) { place[objectId] = "carried"; place["heart.memory"] = meaning; }
    }
    for (const choice of ["rest", "home", "voice"]) {
      if (symbolicObjects.includes(`creation.future.${choice}`) && !place["womb.creation"]) place["womb.creation"] = choice;
    }
  }
  return {
    ...storyEvents,
    schemaVersion: STORY_JOURNEY_SCHEMA_VERSION,
    actId,
    // Narrative location follows the allowlisted entry context. Persisted or
    // cloud-supplied chapter/scene values cannot contradict activeEntryId.
    chapterId: progress.chapterId,
    sceneId: progress.sceneId,
    beatId,
    activeEntryId,
    history,
    visitedEntryIds,
    witnessedEntryIds: sanitizeIdArray(input.witnessedEntryIds, validEntryIds, maxEntryIds),
    completedRitualIds: sanitizeIdArray(
      input.completedRitualIds,
      allowlist(options.ritualIds),
      options.ritualIds?.length ?? 256,
    ),
    worldFlags,
    landmarkStates: sanitizeLandmarkRecord(input.landmarkStates, allowlist(options.landmarkIds)),
    resonances: {
      wolf: boundedInteger(resonances?.wolf, 0, 100),
      swan: boundedInteger(resonances?.swan, 0, 100),
      seer: boundedInteger(resonances?.seer, 0, 100),
    },
    inventory: {
      // A pre-action schema-v2 save may have completed the Fork before
      // explicit lantern ownership existed. That completed scene is durable
      // evidence that the player took it; never strand that save at Crown.
      lantern:
        inventory?.lantern === true ||
        normalizedCompletedSceneIds.includes("fork.relinquish-hope"),
      recoveredKeys,
      symbolicObjects,
    },
    releasedWords: sanitizeReleasedWords(
      input.releasedWords,
      options.maxReleasedWords ?? DEFAULT_MAX_RELEASED_WORDS,
      options.maxReleasedWordLength ?? DEFAULT_MAX_RELEASED_WORD_LENGTH,
    ),
    completedActs: normalizedCompletedActs,
    completedChapterIds: normalizedCompletedChapterIds,
    completedSceneIds: normalizedCompletedSceneIds,
    storyStarted: storyStarted || storyCompleted,
    storyCompleted,
    storyStartedAt: storyStarted || storyCompleted ? nullableIsoDate(input.storyStartedAt) : null,
    storyCompletedAt: storyCompleted ? nullableIsoDate(input.storyCompletedAt) : null,
    updatedAt: validIsoDate(input.updatedAt, timestamp),
  };
}

export function createFreshStoryJourneyState(
  options: StoryJourneySanitizeOptions,
): StoryJourneyState {
  return sanitizeCurrentState({}, options);
}

export function migrateLegacyStoryJourneyState(
  input: unknown,
  options: StoryJourneySanitizeOptions,
): StoryJourneyState {
  const value = asRecord(input) ?? {};
  const legacyHistory = Array.isArray(value.history) ? value.history : [];
  const legacyVisited = Array.isArray(value.visitedEntryIds) ? value.visitedEntryIds : [];
  const validEntryIds = allowlist(options.validEntryIds);
  const legacyActiveEntryId = sanitizeId(value.activeEntryId, validEntryIds);
  const openingEntryId = sanitizeId(options.fallbackEntryId, validEntryIds) ?? options.validEntryIds?.[0] ?? "";
  const hasLegacyProgress =
    legacyHistory.length > 0 ||
    legacyVisited.some((entryId) => entryId !== openingEntryId) ||
    Boolean(legacyActiveEntryId && legacyActiveEntryId !== openingEntryId);
  const legacyInventory = asRecord(value.inventory);
  const progress = fallbackProgress(
    options,
    legacyActiveEntryId ?? options.fallbackEntryId,
  );
  const current = sanitizeCurrentState(
    {
      ...value,
      schemaVersion: STORY_JOURNEY_SCHEMA_VERSION,
      actId: progress.actId,
      beatId: progress.beatId,
      witnessedEntryIds: value.witnessedEntryIds ?? legacyVisited,
      inventory: {
        ...(legacyInventory ?? {}),
        lantern: legacyInventory?.lantern === true || hasLegacyProgress,
      },
      storyStarted: value.storyStarted === true || hasLegacyProgress,
    },
    options,
  );
  return current;
}

export function migrateStoryJourneyStateV1(
  input: unknown,
  options: StoryJourneySanitizeOptions,
): StoryJourneyState {
  const value = asRecord(input);
  if (!value) return createFreshStoryJourneyState(options);
  return sanitizeCurrentState(
    {
      ...value,
      schemaVersion: STORY_JOURNEY_SCHEMA_VERSION,
    },
    options,
  );
}

export function sanitizeStoryJourneyState(
  input: unknown,
  options: StoryJourneySanitizeOptions,
): StoryJourneyState {
  const value = asRecord(input);
  if (!value) return createFreshStoryJourneyState(options);
  if (value.schemaVersion === STORY_JOURNEY_SCHEMA_VERSION) {
    return sanitizeCurrentState(value, options);
  }
  if (value.schemaVersion === 1) {
    return migrateStoryJourneyStateV1(value, options);
  }
  if (value.schemaVersion === undefined) {
    return migrateLegacyStoryJourneyState(value, options);
  }
  // Unknown and future schemas are not legacy saves. Recover safely instead of
  // interpreting an incompatible payload and potentially losing local state.
  return createFreshStoryJourneyState(options);
}

export type CloudJourneyStateInput = Partial<StoryJourneyState> & {
  cloudSchemaVersion?: unknown;
  migratedFromNavigation?: boolean;
};

export function mergeCloudJourneyState(
  current: StoryJourneyState,
  incoming: CloudJourneyStateInput,
  options: StoryJourneySanitizeOptions,
): StoryJourneyState {
  if (!isSupportedStoryJourneyState(incoming)) return current;

  if (incoming.migratedFromNavigation !== true) {
    return sanitizeStoryJourneyState(incoming, options);
  }

  const hydrated = sanitizeStoryJourneyState(
    {
      ...current,
      // The cloud sanitizer fills absent mechanics with empty defaults. Only
      // navigation is authoritative in a navigation-only record; retaining
      // the whole local story also preserves event gates and earned choices.
      activeEntryId: incoming.activeEntryId ?? current.activeEntryId,
      history: incoming.history ?? current.history,
      visitedEntryIds: incoming.visitedEntryIds ?? current.visitedEntryIds,
      updatedAt: incoming.updatedAt ?? current.updatedAt,
      schemaVersion: STORY_JOURNEY_SCHEMA_VERSION,
    },
    options,
  );

  const validEntryIds = allowlist(options.validEntryIds);
  const openingEntryId =
    sanitizeId(options.fallbackEntryId, validEntryIds) ??
    options.validEntryIds?.[0] ??
    "";
  const hasRestoredNavigationProgress = Boolean(
    (hydrated.activeEntryId && hydrated.activeEntryId !== openingEntryId) ||
      hydrated.history.some((entryId) => entryId !== openingEntryId) ||
      hydrated.visitedEntryIds.some((entryId) => entryId !== openingEntryId),
  );
  const hasLocalStoryMechanics = Boolean(
    current.completedStoryEventIds.length > 0 ||
      Object.keys(current.storyObjectStates).length > 0 ||
      current.storyCompleted ||
      current.completedActs.length > 0 ||
      current.completedChapterIds.length > 0 ||
      current.completedSceneIds.length > 0 ||
      current.completedRitualIds.length > 0 ||
      Object.keys(current.worldFlags).length > 0 ||
      Object.keys(current.landmarkStates).length > 0 ||
      Object.values(current.resonances).some((value) => value > 0) ||
      current.inventory.lantern ||
      current.inventory.recoveredKeys.length > 0 ||
      current.inventory.symbolicObjects.length > 0 ||
      current.releasedWords.length > 0 ||
      current.witnessedEntryIds.some((entryId) => entryId !== openingEntryId),
  );

  if (!hasRestoredNavigationProgress || hasLocalStoryMechanics) return hydrated;

  // A pre-v2 cloud record contains navigation only. Preserve any current local
  // mechanics while deriving the minimum recovery state for a pristine device.
  const progress = fallbackProgress(options, hydrated.activeEntryId);
  return sanitizeStoryJourneyState(
    {
      ...hydrated,
      actId: progress.actId,
      beatId: progress.beatId,
      inventory: { ...hydrated.inventory, lantern: true },
      storyStarted: true,
    },
    options,
  );
}

/** Compatibility wrapper for callers that are explicitly hydrating v1 navigation. */
export function mergeCloudJourneyNavigation(
  current: StoryJourneyState,
  incoming: Partial<Pick<StoryJourneyState, "activeEntryId" | "history" | "visitedEntryIds" | "updatedAt">>,
  options: StoryJourneySanitizeOptions,
) {
  return mergeCloudJourneyState(
    current,
    { ...incoming, migratedFromNavigation: true },
    options,
  );
}

export function isSupportedStoryJourneyState(input: unknown) {
  const value = asRecord(input);
  if (!value) return false;
  return value.schemaVersion === undefined ||
    value.schemaVersion === 1 ||
    value.schemaVersion === STORY_JOURNEY_SCHEMA_VERSION;
}

export function sanitizeReleasedJourneyWord(
  value: unknown,
  maximumLength = DEFAULT_MAX_RELEASED_WORD_LENGTH,
) {
  return sanitizeReleasedWord(value, maximumLength);
}
