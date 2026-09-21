import { isSceneStoryComplete } from "../storyEvents/storyEventRegistry.ts";
import {
  JOURNEY_ENTRY_CONTEXT,
  getJourneyChapter,
  getJourneyScene,
  journeyChapters,
  journeyScenes,
  type JourneyScene,
} from "../data/journeyBlueprint.ts";
import type {
  JourneyActId,
  JourneyChapterId,
  JourneySceneId,
  StoryJourneyInventory,
  StoryJourneyState,
} from "./storyJourneyState.ts";

export type JourneyProgressionState = Pick<
  StoryJourneyState,
  | "activeEntryId"
  | "witnessedEntryIds"
  | "completedRitualIds"
  | "worldFlags"
  | "inventory"
  | "completedActs"
  | "completedChapterIds"
  | "completedSceneIds"
  | "storyStarted"
  | "storyCompleted"
> & Partial<Pick<StoryJourneyState, "completedStoryEventIds" | "storyObjectStates" | "storyPlacementStates">>;

export type JourneyProgressionCondition =
  | { type: "entry-witnessed"; entryId: string }
  | { type: "ritual-complete"; ritualId: string }
  | { type: "world-flag"; flagId: string; value?: boolean }
  | { type: "inventory-lantern" }
  | { type: "inventory-key"; keyId: string }
  | { type: "inventory-object"; objectId: string }
  | { type: "act-complete"; actId: JourneyActId }
  | { type: "scene-complete"; sceneId: JourneySceneId }
  | { type: "chapter-complete"; chapterId: JourneyChapterId };

export type JourneyRitualProgression = {
  ritualId: string;
  sceneId: JourneySceneId;
  entryId: string;
  requiredState: readonly JourneyProgressionCondition[];
};

export type JourneyProgressionOutcome =
  | { type: "complete-scene"; sceneId: JourneySceneId }
  | { type: "complete-chapter"; chapterId: JourneyChapterId }
  | { type: "complete-story" };

const SCENE_INDEX_BY_ID = new Map(
  journeyScenes.map((scene, index) => [scene.id, index] as const),
);
const CHAPTER_INDEX_BY_ID = new Map(
  journeyChapters.map((chapter, index) => [chapter.id, index] as const),
);

const SCENE_AWAKENING_CONDITIONS: Partial<
  Record<JourneySceneId, readonly JourneyProgressionCondition[]>
> = {
  "river.wash": [
    { type: "scene-complete", sceneId: "fire.boundary" },
    { type: "ritual-complete", ritualId: "ritual.burn-boundary" },
  ],
  "river.release-surrender": [
    { type: "scene-complete", sceneId: "river.wash" },
    { type: "ritual-complete", ritualId: "ritual.wash-grief" },
  ],
  "fork.weighing": [
    { type: "scene-complete", sceneId: "river.release-surrender" },
    { type: "ritual-complete", ritualId: "ritual.surrender" },
  ],
  "fork.four-verbs": [
    { type: "scene-complete", sceneId: "fork.weighing" },
  ],
  "fork.relinquish-hope": [
    { type: "scene-complete", sceneId: "fork.four-verbs" },
  ],
  "climb.mind": [
    { type: "scene-complete", sceneId: "climbs.arrival" },
  ],
  "climb.heart": [
    { type: "scene-complete", sceneId: "climb.mind" },
  ],
  "climb.womb": [
    { type: "scene-complete", sceneId: "climb.heart" },
    { type: "inventory-key", keyId: "key.protection" },
    { type: "inventory-object", objectId: "memory.chosen-heart" },
  ],
  "crowned.threshold": [
    { type: "inventory-key", keyId: "key.protection" },
    { type: "inventory-key", keyId: "key.self-permission" },
    { type: "inventory-object", objectId: "memory.chosen-heart" },
    { type: "inventory-object", objectId: "creation.chosen-future" },
    { type: "world-flag", flagId: "lantern.owned" },
    { type: "ritual-complete", ritualId: "ritual.surrender" },
  ],
};

const SCENE_COMPLETION_CONDITIONS: Partial<
  Record<JourneySceneId, readonly JourneyProgressionCondition[]>
> = {
  "blue-moon.sanctuary": [
    { type: "world-flag", flagId: "blue-moon.candles-lit" },
    { type: "world-flag", flagId: "blue-moon.water-touched" },
  ],
  "blue-moon.intimacy": [
    { type: "world-flag", flagId: "blue-moon.swan-followed" },
    { type: "world-flag", flagId: "blue-moon.flowers-placed" },
    { type: "world-flag", flagId: "blue-moon.beautiful-door-open" },
  ],
  "nest.two-hands": [
    { type: "world-flag", flagId: "nest.hand-held" },
    { type: "world-flag", flagId: "nest.hand-kept" },
  ],
  "nest.unsupported-cycle": [
    { type: "world-flag", flagId: "nest.unsupported-burden-held" },
    { type: "world-flag", flagId: "nest.unsupported-burden-released" },
  ],
  "nest.protection": [
    { type: "world-flag", flagId: "nest.protection-acknowledged" },
  ],
  "thorned.locked-garden": [
    { type: "world-flag", flagId: "thorn-house.space-cleared" },
    { type: "world-flag", flagId: "thorn-house.space-refilled" },
  ],
  "thorned.old-memory-bedroom": [
    { type: "world-flag", flagId: "thorn-house.reorganisation-released" },
  ],
  "thorned.self-owned-world": [
    { type: "world-flag", flagId: "thorn-house.exit-crossed" },
  ],
  "wolf-swan.false-choice": [
    { type: "world-flag", flagId: "integration.swan-witnessed" },
    { type: "world-flag", flagId: "integration.wolf-witnessed" },
    { type: "world-flag", flagId: "integration.seer-witnessed" },
  ],
  "wolf-swan.convergence": [
    { type: "world-flag", flagId: "integration.three-aspects-held" },
  ],
  "fork.weighing": [
    { type: "world-flag", flagId: "fork.weighed" },
  ],
  "fork.four-verbs": [
    { type: "world-flag", flagId: "fork.let-go" },
    { type: "world-flag", flagId: "fork.declined" },
    { type: "world-flag", flagId: "fork.departed" },
    { type: "world-flag", flagId: "fork.deleted" },
  ],
  "fork.relinquish-hope": [
    { type: "world-flag", flagId: "fork.old-hope-relinquished" },
    { type: "world-flag", flagId: "lantern.owned" },
  ],
  "climb.mind": [
    { type: "world-flag", flagId: "climb.mind.questions-released" },
  ],
  "climb.heart": [
    { type: "world-flag", flagId: "climb.heart.memory-chosen" },
    { type: "inventory-object", objectId: "memory.chosen-heart" },
  ],
  "climb.womb": [
    { type: "world-flag", flagId: "climb.womb.creation-chosen" },
    { type: "inventory-key", keyId: "key.protection" },
    { type: "inventory-object", objectId: "memory.chosen-heart" },
    { type: "inventory-object", objectId: "creation.chosen-future" },
  ],
};

/**
 * Scene rewards are explicit narrative facts rather than generic pickups.
 * They are derived during scene completion so local and cloud snapshots carry
 * the Nest's protection and the Heart's deliberately chosen memory.
 */
export function applyJourneySceneRewards(
  sceneId: JourneySceneId,
  inventory: StoryJourneyInventory,
): StoryJourneyInventory {
  const recoveredKeys = sceneId === "nest.protection"
    ? Array.from(new Set([...inventory.recoveredKeys, "key.protection"]))
    : inventory.recoveredKeys;
  const symbolicObjects = sceneId === "climb.heart"
    ? Array.from(new Set([...inventory.symbolicObjects, "memory.chosen-heart"]))
    : inventory.symbolicObjects;
  if (
    recoveredKeys === inventory.recoveredKeys &&
    symbolicObjects === inventory.symbolicObjects
  ) {
    return inventory;
  }
  return { ...inventory, recoveredKeys, symbolicObjects };
}

/**
 * Ritual presentation remains sourced from the six-region beat catalogue, but
 * these bindings place each ritual at its canonical narrative scene.
 */
export const JOURNEY_RITUAL_PROGRESSION = [
  {
    ritualId: "ritual.accept-lantern",
    sceneId: "broken-floor.confession",
    entryId: "fragment-001",
    requiredState: [{ type: "entry-witnessed", entryId: "fragment-001" }],
  },
  {
    ritualId: "ritual.accept-memory",
    sceneId: "blue-moon.caged-bird",
    entryId: "fragment-062",
    requiredState: [{ type: "entry-witnessed", entryId: "fragment-062" }],
  },
  {
    ritualId: "ritual.witness-mirror",
    sceneId: "sunset.stillness",
    entryId: "fragment-040",
    requiredState: [{ type: "entry-witnessed", entryId: "fragment-040" }],
  },
  {
    ritualId: "ritual.recover-key",
    sceneId: "thorned.self-owned-world",
    entryId: "fragment-054",
    requiredState: [{ type: "entry-witnessed", entryId: "fragment-054" }],
  },
  {
    ritualId: "ritual.burn-boundary",
    sceneId: "fire.boundary",
    entryId: "fragment-053",
    requiredState: [{ type: "entry-witnessed", entryId: "fragment-053" }],
  },
  {
    ritualId: "ritual.wash-grief",
    sceneId: "river.wash",
    entryId: "fragment-034",
    requiredState: [
      { type: "entry-witnessed", entryId: "fragment-034" },
      { type: "ritual-complete", ritualId: "ritual.burn-boundary" },
    ],
  },
  {
    ritualId: "ritual.release-river-memory",
    sceneId: "river.release-surrender",
    entryId: "fragment-057",
    requiredState: [
      { type: "entry-witnessed", entryId: "fragment-057" },
      { type: "ritual-complete", ritualId: "ritual.wash-grief" },
    ],
  },
  {
    ritualId: "ritual.surrender",
    sceneId: "river.release-surrender",
    entryId: "fragment-057",
    requiredState: [
      { type: "entry-witnessed", entryId: "fragment-057" },
      { type: "ritual-complete", ritualId: "ritual.release-river-memory" },
    ],
  },
  {
    ritualId: "ritual.place-lantern",
    sceneId: "crowned.sovereignty",
    entryId: "fragment-044",
    requiredState: [
      { type: "entry-witnessed", entryId: "fragment-044" },
      { type: "inventory-lantern" },
      { type: "inventory-key", keyId: "key.self-permission" },
      { type: "ritual-complete", ritualId: "ritual.surrender" },
    ],
  },
] as const satisfies readonly JourneyRitualProgression[];

const RITUAL_BY_ID = new Map<string, JourneyRitualProgression>(
  JOURNEY_RITUAL_PROGRESSION.map((ritual) => [ritual.ritualId, ritual] as const),
);
const RITUALS_BY_ENTRY_ID = new Map<string, JourneyRitualProgression[]>();
const REQUIRED_RITUALS_BY_SCENE_ID = new Map<JourneySceneId, string[]>();

for (const ritual of JOURNEY_RITUAL_PROGRESSION) {
  const entryRituals = RITUALS_BY_ENTRY_ID.get(ritual.entryId) ?? [];
  entryRituals.push(ritual);
  RITUALS_BY_ENTRY_ID.set(ritual.entryId, entryRituals);

  const sceneRituals = REQUIRED_RITUALS_BY_SCENE_ID.get(ritual.sceneId) ?? [];
  sceneRituals.push(ritual.ritualId);
  REQUIRED_RITUALS_BY_SCENE_ID.set(ritual.sceneId, sceneRituals);
}

export function journeyProgressionConditionMet(
  condition: JourneyProgressionCondition,
  state: JourneyProgressionState,
) {
  if (condition.type === "entry-witnessed") {
    return state.witnessedEntryIds.includes(condition.entryId);
  }
  if (condition.type === "ritual-complete") {
    return state.completedRitualIds.includes(condition.ritualId);
  }
  if (condition.type === "world-flag") {
    return state.worldFlags[condition.flagId] === (condition.value ?? true);
  }
  if (condition.type === "inventory-lantern") return state.inventory.lantern;
  if (condition.type === "inventory-key") {
    return state.inventory.recoveredKeys.includes(condition.keyId);
  }
  if (condition.type === "inventory-object") {
    return state.inventory.symbolicObjects.includes(condition.objectId);
  }
  if (condition.type === "act-complete") {
    return state.completedActs.includes(condition.actId);
  }
  if (condition.type === "scene-complete") {
    return state.completedSceneIds.includes(condition.sceneId);
  }
  return state.completedChapterIds.includes(condition.chapterId);
}

export function journeyProgressionConditionsMet(
  conditions: readonly JourneyProgressionCondition[] | undefined,
  state: JourneyProgressionState,
) {
  return (conditions ?? []).every((condition) =>
    journeyProgressionConditionMet(condition, state)
  );
}

export function sceneAwakeningConditions(sceneId: JourneySceneId) {
  return SCENE_AWAKENING_CONDITIONS[sceneId] ?? [];
}

export function sceneCompletionConditions(sceneId: JourneySceneId) {
  return SCENE_COMPLETION_CONDITIONS[sceneId] ?? [];
}

export function requiredRitualIdsForScene(sceneId: JourneySceneId) {
  return REQUIRED_RITUALS_BY_SCENE_ID.get(sceneId) ?? [];
}

export function isSceneAwake(
  sceneId: JourneySceneId,
  state: JourneyProgressionState,
) {
  if (state.completedSceneIds.includes(sceneId)) return true;
  const sceneIndex = SCENE_INDEX_BY_ID.get(sceneId);
  const scene = getJourneyScene(sceneId);
  if (sceneIndex === undefined || !scene) return false;

  for (let index = 0; index < sceneIndex; index += 1) {
    if (!state.completedSceneIds.includes(journeyScenes[index].id)) return false;
  }

  const chapterIndex = CHAPTER_INDEX_BY_ID.get(scene.chapterId);
  if (chapterIndex === undefined) return false;
  if (
    chapterIndex > 0 &&
    journeyChapters[chapterIndex - 1] &&
    !state.completedChapterIds.includes(journeyChapters[chapterIndex - 1].id)
  ) {
    return false;
  }

  return journeyProgressionConditionsMet(
    sceneAwakeningConditions(sceneId),
    state,
  );
}

export function isKeystoneAvailable(
  entryId: string,
  state: JourneyProgressionState,
) {
  const context = JOURNEY_ENTRY_CONTEXT[entryId];
  return context?.role === "keystone" && isSceneAwake(context.sceneId, state);
}

export function canEnterNarrativeEntry(
  entryId: string,
  state: JourneyProgressionState,
) {
  const context = JOURNEY_ENTRY_CONTEXT[entryId];
  if (!context) return true;
  if (!isSceneAwake(context.sceneId, state)) return false;
  return context.role === "echo" || isKeystoneAvailable(entryId, state);
}

export function canResolveRitual(
  ritualId: string,
  state: JourneyProgressionState,
) {
  if (state.completedRitualIds.includes(ritualId)) return false;
  const ritual = RITUAL_BY_ID.get(ritualId);
  return Boolean(
    ritual &&
    isSceneAwake(ritual.sceneId, state) &&
    journeyProgressionConditionsMet(ritual.requiredState, state),
  );
}

export function nextResolvableRitualForEntry(
  entryId: string,
  state: JourneyProgressionState,
) {
  return RITUALS_BY_ENTRY_ID.get(entryId)?.find((ritual) =>
    canResolveRitual(ritual.ritualId, state)
  );
}

export function canCompleteScene(
  sceneId: JourneySceneId,
  state: JourneyProgressionState,
) {
  if (state.completedSceneIds.includes(sceneId) || !isSceneAwake(sceneId, state)) {
    return false;
  }
  const scene = getJourneyScene(sceneId);
  if (!scene || !state.witnessedEntryIds.includes(scene.keystoneEntryId)) return false;
  if (state.worldFlags["story-events.started"] && !isSceneStoryComplete({ ...state, sceneId }, sceneId)) return false;
  return (
    requiredRitualIdsForScene(sceneId).every((ritualId) =>
      state.completedRitualIds.includes(ritualId)
    ) &&
    journeyProgressionConditionsMet(sceneCompletionConditions(sceneId), state)
  );
}

export function canCompleteChapter(
  chapterId: JourneyChapterId,
  state: JourneyProgressionState,
) {
  if (state.completedChapterIds.includes(chapterId)) return false;
  const chapterIndex = CHAPTER_INDEX_BY_ID.get(chapterId);
  const chapter = getJourneyChapter(chapterId);
  if (chapterIndex === undefined || !chapter) return false;
  for (let index = 0; index < chapterIndex; index += 1) {
    if (!state.completedChapterIds.includes(journeyChapters[index].id)) return false;
  }
  return chapter.sceneIds.every((sceneId) =>
    state.completedSceneIds.includes(sceneId)
  );
}

export function nextRequiredScene(
  state: JourneyProgressionState,
): JourneyScene | undefined {
  return journeyScenes.find((scene) =>
    !state.completedSceneIds.includes(scene.id)
  );
}

export function nextRequiredSceneId(state: JourneyProgressionState) {
  return nextRequiredScene(state)?.id;
}

export function nextRequiredEntry(state: JourneyProgressionState) {
  const scene = nextRequiredScene(state);
  if (!scene) return undefined;
  if (!state.witnessedEntryIds.includes(scene.keystoneEntryId)) {
    return scene.keystoneEntryId;
  }
  const pendingRitual = JOURNEY_RITUAL_PROGRESSION.find(
    (ritual) =>
      ritual.sceneId === scene.id &&
      !state.completedRitualIds.includes(ritual.ritualId),
  );
  return pendingRitual?.entryId ?? scene.keystoneEntryId;
}

export function nextJourneyProgressionOutcome(
  state: JourneyProgressionState,
): JourneyProgressionOutcome | undefined {
  for (const chapter of journeyChapters) {
    if (state.completedChapterIds.includes(chapter.id)) continue;
    const nextScene = chapter.sceneIds
      .map((sceneId) => getJourneyScene(sceneId))
      .find((scene): scene is JourneyScene =>
        Boolean(scene && !state.completedSceneIds.includes(scene.id))
      );
    if (nextScene) {
      return canCompleteScene(nextScene.id, state)
        ? { type: "complete-scene", sceneId: nextScene.id }
        : undefined;
    }
    return canCompleteChapter(chapter.id, state)
      ? { type: "complete-chapter", chapterId: chapter.id }
      : undefined;
  }

  return state.storyCompleted ? undefined : { type: "complete-story" };
}
