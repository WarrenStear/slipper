import {
  JOURNEY_ENTRY_CONTEXT,
  journeyChapters,
  journeyScenes,
  type JourneyTechnicalBiome,
} from "../data/journeyNarrative.ts";
import { journeyBeats } from "../data/journeyBlueprint.ts";
import {
  JOURNEY_CHAPTER_IDS,
  JOURNEY_SCENE_IDS,
  type JourneyActId,
  type JourneyChapterId,
  type JourneySceneId,
  type LandmarkState,
  type ResonanceKey,
  type StoryJourneyState,
} from "./storyJourneyState.ts";

export const LANTERN_PHASE_IDS = [
  "distant",
  "borrowed",
  "unstable",
  "recognition",
  "ownership",
  "integrated",
  "released",
] as const;

export type LanternPhaseId = (typeof LANTERN_PHASE_IDS)[number];
export type LanternPresence = "distant" | "carried" | "placed";

export type LanternPhase = {
  id: LanternPhaseId;
  order: number;
  title: string;
  meaning: string;
  presence: LanternPresence;
  reach: number;
  intensity: number;
  stability: number;
  flicker: number;
  movement: number;
  warmth: number;
};

const LANTERN_PHASE_DEFINITIONS: Readonly<Record<LanternPhaseId, LanternPhase>> = {
  distant: {
    id: "distant",
    order: 0,
    title: "Distant light",
    meaning: "The capacity to see exists, but has not yet been carried.",
    presence: "distant",
    reach: 0.12,
    intensity: 0.16,
    stability: 0.72,
    flicker: 0.08,
    movement: 0.08,
    warmth: 0.46,
  },
  borrowed: {
    id: "borrowed",
    order: 1,
    title: "Borrowed light",
    meaning: "The lantern is carried as guidance that still feels external.",
    presence: "carried",
    reach: 0.34,
    intensity: 0.42,
    stability: 0.46,
    flicker: 0.58,
    movement: 0.54,
    warmth: 0.88,
  },
  unstable: {
    id: "unstable",
    order: 2,
    title: "Unstable light",
    meaning: "Avoided memories narrow the beam and disturb its movement.",
    presence: "carried",
    reach: 0.44,
    intensity: 0.5,
    stability: 0.3,
    flicker: 0.82,
    movement: 0.74,
    warmth: 0.84,
  },
  recognition: {
    id: "recognition",
    order: 3,
    title: "Recognising light",
    meaning: "Truth makes the light quieter, clearer, and more coherent.",
    presence: "carried",
    reach: 0.58,
    intensity: 0.62,
    stability: 0.64,
    flicker: 0.4,
    movement: 0.36,
    warmth: 0.78,
  },
  ownership: {
    id: "ownership",
    order: 4,
    title: "Owned light",
    meaning: "The lantern is no longer permission borrowed from elsewhere.",
    presence: "carried",
    reach: 0.73,
    intensity: 0.76,
    stability: 0.8,
    flicker: 0.22,
    movement: 0.22,
    warmth: 0.72,
  },
  integrated: {
    id: "integrated",
    order: 5,
    title: "Integrated light",
    meaning: "Tenderness, boundary, and truth illuminate the same path.",
    presence: "carried",
    reach: 0.9,
    intensity: 0.9,
    stability: 0.94,
    flicker: 0.08,
    movement: 0.1,
    warmth: 0.66,
  },
  released: {
    id: "released",
    order: 6,
    title: "Released light",
    meaning: "The lantern remains lit when it is placed down.",
    presence: "placed",
    reach: 1,
    intensity: 1,
    stability: 0.99,
    flicker: 0.02,
    movement: 0.02,
    warmth: 0.62,
  },
};

export const LANTERN_PHASES = LANTERN_PHASE_IDS.map(
  (phaseId) => LANTERN_PHASE_DEFINITIONS[phaseId],
) as readonly LanternPhase[];

export type LanternNarrativeState = Pick<
  StoryJourneyState,
  | "chapterId"
  | "sceneId"
  | "completedActs"
  | "completedChapterIds"
  | "completedSceneIds"
  | "completedRitualIds"
  | "worldFlags"
  | "landmarkStates"
  | "inventory"
  | "storyStarted"
  | "storyCompleted"
>;

const CHAPTER_INDEX = new Map<JourneyChapterId, number>(
  JOURNEY_CHAPTER_IDS.map((chapterId, index) => [chapterId, index]),
);
const SCENE_CHAPTER = new Map<JourneySceneId, JourneyChapterId>(
  journeyScenes.map((scene) => [scene.id, scene.chapterId]),
);
const ACT_PHASE_FLOORS: Readonly<Partial<Record<JourneyActId, LanternPhaseId>>> = {
  "first-wood": "unstable",
  "mirror-clearing": "unstable",
  "thorned-house": "recognition",
  "blue-moon-archive": "recognition",
  "fire-and-river": "recognition",
  "crowned-return": "integrated",
};

function phaseForChapterIndex(chapterIndex: number): LanternPhaseId {
  // Entering a place is not evidence that its transformation has happened.
  // Release and ownership are action-backed below; later chapters can only be
  // entered after those gates have been satisfied.
  if (chapterIndex >= 9) return "integrated";
  if (chapterIndex >= 4) return "recognition";
  if (chapterIndex >= 1) return "unstable";
  return "borrowed";
}

function laterPhase(a: LanternPhaseId, b: LanternPhaseId) {
  return LANTERN_PHASE_DEFINITIONS[a].order >= LANTERN_PHASE_DEFINITIONS[b].order ? a : b;
}

export function deriveLanternPhaseId(state: LanternNarrativeState): LanternPhaseId {
  const rituals = new Set(state.completedRitualIds);
  const completedChapters = new Set(state.completedChapterIds);
  const completedScenes = new Set(state.completedSceneIds);
  const lanternPlaced =
    state.storyCompleted ||
    rituals.has("ritual.place-lantern") ||
    state.worldFlags["lantern.placed-and-lit"] === true ||
    state.landmarkStates["landmark.crowned-gate"] === "released" ||
    completedChapters.has("lantern-epilogue") ||
    completedScenes.has("epilogue.constellation");
  if (lanternPlaced) return "released";

  const carriesLantern =
    state.inventory.lantern ||
    rituals.has("ritual.accept-lantern");
  if (!carriesLantern) return "distant";

  let phase: LanternPhaseId = "borrowed";
  const chapterEvidence = new Set<JourneyChapterId>([
    state.chapterId,
    ...state.completedChapterIds,
  ]);
  for (const sceneId of state.completedSceneIds) {
    const chapterId = SCENE_CHAPTER.get(sceneId);
    if (chapterId) chapterEvidence.add(chapterId);
  }
  const currentSceneChapter = SCENE_CHAPTER.get(state.sceneId);
  if (currentSceneChapter) chapterEvidence.add(currentSceneChapter);
  for (const chapterId of chapterEvidence) {
    phase = laterPhase(phase, phaseForChapterIndex(CHAPTER_INDEX.get(chapterId) ?? 0));
  }
  for (const actId of state.completedActs) {
    const floor = ACT_PHASE_FLOORS[actId];
    if (floor) phase = laterPhase(phase, floor);
  }

  if (rituals.has("ritual.witness-mirror")) phase = laterPhase(phase, "recognition");
  if (rituals.has("ritual.surrender")) phase = laterPhase(phase, "recognition");
  if (state.worldFlags["lantern.owned"] === true) {
    phase = laterPhase(phase, "ownership");
  }
  if (
    completedScenes.has("climb.womb") ||
    completedScenes.has("crowned.home") ||
    completedScenes.has("crowned.sovereignty")
  ) {
    phase = laterPhase(phase, "integrated");
  }
  return phase;
}

export function deriveLanternNarrative(state: LanternNarrativeState): LanternPhase {
  return LANTERN_PHASE_DEFINITIONS[deriveLanternPhaseId(state)];
}

export type ConstellationStoryState = Pick<
  StoryJourneyState,
  | "activeEntryId"
  | "history"
  | "witnessedEntryIds"
  | "completedRitualIds"
  | "completedChapterIds"
  | "completedSceneIds"
  | "resonances"
  | "releasedWords"
  | "landmarkStates"
>;

export type ConstellationNodeStage =
  | "present"
  | "travelled"
  | "witnessed"
  | "ritual-complete"
  | "scene-complete"
  | "chapter-complete";

export type ConstellationStoryNode = {
  entryId: string;
  chapterId: JourneyChapterId;
  sceneId: JourneySceneId;
  biome: JourneyTechnicalBiome;
  stage: ConstellationNodeStage;
  witnessed: boolean;
  visitCount: number;
  firstVisitOrder: number | null;
  completedRitualIds: readonly string[];
  landmarkState: LandmarkState | null;
  intensity: number;
};

export type ConstellationEdgeKind = "scene" | "chapter" | "travel";

export type ConstellationStoryEdge = {
  id: string;
  sourceEntryId: string;
  targetEntryId: string;
  kind: ConstellationEdgeKind;
  order: number;
  traversalCount: number;
  evidence: {
    travel: boolean;
    scene: boolean;
    chapter: boolean;
  };
};

export type ConstellationChapterThread = {
  id: JourneyChapterId;
  title: string;
  biome: JourneyTechnicalBiome;
  completed: boolean;
  totalEntryCount: number;
  visibleEntryIds: readonly string[];
};

export type ConstellationResonanceNode = {
  id: ResonanceKey;
  label: "Wolf" | "Swan" | "Seer";
  strength: number;
  intensity: number;
  visible: boolean;
};

export type ConstellationProtectedNest = {
  visible: boolean;
  protected: boolean;
  entryIds: readonly string[];
};

export type ConstellationStoryModel = {
  nodes: readonly ConstellationStoryNode[];
  edges: readonly ConstellationStoryEdge[];
  chapters: readonly ConstellationChapterThread[];
  routeEntryIds: readonly string[];
  isNearlyEmpty: boolean;
  progress: {
    witnessedEntries: number;
    completedRituals: number;
    completedScenes: number;
    completedChapters: number;
    routeSteps: number;
  };
  resonance: Record<ResonanceKey, number> & { energy: number };
  resonanceNodes: readonly ConstellationResonanceNode[];
  releasedWords: readonly string[];
  releasedWordCount: number;
  releaseBloom: number;
  protectedNest: ConstellationProtectedNest;
  landmarkMemory: {
    activeCount: number;
    transformedCount: number;
    releasedCount: number;
    strength: number;
  };
};

type RitualAnchor = {
  ritualId: string;
  entryId: string;
  landmarkId: string | null;
};

const BLUEPRINT_ENTRY_IDS = journeyScenes.flatMap((scene) => scene.entryIds);
const BLUEPRINT_ENTRY_ID_SET = new Set(BLUEPRINT_ENTRY_IDS);
const SCENE_BY_ID = new Map(journeyScenes.map((scene) => [scene.id, scene]));
const RITUAL_ANCHORS: readonly RitualAnchor[] = journeyBeats.flatMap((beat) => {
  if (!beat.entryId || !beat.interactions?.length) return [];
  return beat.interactions.map((interaction) => ({
    ritualId: interaction.ritualId,
    entryId: beat.entryId as string,
    landmarkId: beat.landmarkId ?? null,
  }));
});
const RITUAL_ANCHORS_BY_ENTRY = new Map<string, RitualAnchor[]>();
for (const anchor of RITUAL_ANCHORS) {
  const anchors = RITUAL_ANCHORS_BY_ENTRY.get(anchor.entryId) ?? [];
  anchors.push(anchor);
  RITUAL_ANCHORS_BY_ENTRY.set(anchor.entryId, anchors);
}
const RITUAL_ID_SET = new Set(RITUAL_ANCHORS.map((anchor) => anchor.ritualId));

const LANDMARK_STATE_STRENGTH: Readonly<Record<LandmarkState, number>> = {
  untouched: 0,
  awakened: 0.24,
  witnessed: 0.42,
  scarred: 0.58,
  transformed: 0.78,
  released: 1,
};

const NODE_STAGE_STRENGTH: Readonly<Record<ConstellationNodeStage, number>> = {
  present: 0.14,
  travelled: 0.24,
  witnessed: 0.46,
  "ritual-complete": 0.64,
  "scene-complete": 0.8,
  "chapter-complete": 1,
};

function clamp01(value: number) {
  return Math.max(0, Math.min(1, value));
}

function validRoute(history: readonly string[], activeEntryId: string) {
  const route = [...history, activeEntryId].filter((entryId) => BLUEPRINT_ENTRY_ID_SET.has(entryId));
  return route.filter((entryId, index) => index === 0 || entryId !== route[index - 1]);
}

function normalizedResonance(resonances: StoryJourneyState["resonances"]) {
  const values = {
    wolf: Math.max(0, Math.min(100, resonances.wolf)),
    swan: Math.max(0, Math.min(100, resonances.swan)),
    seer: Math.max(0, Math.min(100, resonances.seer)),
  };
  return {
    ...values,
    energy: clamp01((values.wolf + values.swan + values.seer) / 300),
  };
}

const RESONANCE_NODE_LABELS = {
  wolf: "Wolf",
  swan: "Swan",
  seer: "Seer",
} as const satisfies Readonly<Record<ResonanceKey, ConstellationResonanceNode["label"]>>;

function landmarkMemorySummary(landmarkStates: Readonly<Record<string, LandmarkState>>) {
  const values = Object.values(landmarkStates);
  const active = values.filter((state) => state !== "untouched");
  const transformedCount = values.filter((state) => state === "transformed").length;
  const releasedCount = values.filter((state) => state === "released").length;
  const strength = active.length > 0
    ? active.reduce((sum, state) => sum + LANDMARK_STATE_STRENGTH[state], 0) / active.length
    : 0;
  return { activeCount: active.length, transformedCount, releasedCount, strength };
}

function nodeStage({
  chapterComplete,
  sceneComplete,
  ritualComplete,
  witnessed,
  travelled,
}: {
  chapterComplete: boolean;
  sceneComplete: boolean;
  ritualComplete: boolean;
  witnessed: boolean;
  travelled: boolean;
}): ConstellationNodeStage {
  if (chapterComplete) return "chapter-complete";
  if (sceneComplete) return "scene-complete";
  if (ritualComplete) return "ritual-complete";
  if (witnessed) return "witnessed";
  if (travelled) return "travelled";
  return "present";
}

type MutableEdge = ConstellationStoryEdge;

function edgePairKey(sourceEntryId: string, targetEntryId: string) {
  return sourceEntryId < targetEntryId
    ? `${sourceEntryId}|${targetEntryId}`
    : `${targetEntryId}|${sourceEntryId}`;
}

export function buildStoryConstellationModel(
  state: ConstellationStoryState,
): ConstellationStoryModel {
  const witnessed = new Set(state.witnessedEntryIds.filter((entryId) => BLUEPRINT_ENTRY_ID_SET.has(entryId)));
  const completedRituals = new Set(state.completedRitualIds);
  const completedChapters = new Set(state.completedChapterIds);
  const completedScenes = new Set(state.completedSceneIds);
  const routeEntryIds = validRoute(state.history, state.activeEntryId);
  const travelledEntryIds = new Set(
    state.history.filter((entryId) => BLUEPRINT_ENTRY_ID_SET.has(entryId)),
  );
  const visibleEntryIds = new Set<string>([...witnessed, ...routeEntryIds]);
  if (BLUEPRINT_ENTRY_ID_SET.has(state.activeEntryId)) visibleEntryIds.add(state.activeEntryId);

  const visitStats = new Map<string, { count: number; firstOrder: number }>();
  routeEntryIds.forEach((entryId, order) => {
    const current = visitStats.get(entryId);
    visitStats.set(entryId, {
      count: (current?.count ?? 0) + 1,
      firstOrder: current?.firstOrder ?? order,
    });
  });

  const resonance = normalizedResonance(state.resonances);
  const resonanceNodes = (Object.keys(RESONANCE_NODE_LABELS) as ResonanceKey[]).map(
    (id): ConstellationResonanceNode => ({
      id,
      label: RESONANCE_NODE_LABELS[id],
      strength: resonance[id],
      intensity: clamp01(0.34 + (resonance[id] / 100) * 0.66),
      visible: resonance[id] > 0,
    }),
  );
  const releasedWords = state.releasedWords.filter((word) => word.length > 0);
  const releasedWordCount = releasedWords.length;
  const releaseBloom = clamp01(releasedWordCount / 7);
  const landmarkMemory = landmarkMemorySummary(state.landmarkStates);

  const nodes = BLUEPRINT_ENTRY_IDS.flatMap((entryId): ConstellationStoryNode[] => {
    if (!visibleEntryIds.has(entryId)) return [];
    const context = JOURNEY_ENTRY_CONTEXT[entryId];
    const scene = context ? SCENE_BY_ID.get(context.sceneId) : undefined;
    if (!context || !scene) return [];
    const ritualAnchors = RITUAL_ANCHORS_BY_ENTRY.get(entryId) ?? [];
    const nodeRitualIds = ritualAnchors
      .filter((anchor) => completedRituals.has(anchor.ritualId))
      .map((anchor) => anchor.ritualId);
    const landmarkState = ritualAnchors
      .map((anchor) => anchor.landmarkId ? state.landmarkStates[anchor.landmarkId] : undefined)
      .find((candidate): candidate is LandmarkState => Boolean(candidate)) ?? null;
    const stage = nodeStage({
      chapterComplete: completedChapters.has(context.chapterId),
      sceneComplete: completedScenes.has(context.sceneId),
      ritualComplete: nodeRitualIds.length > 0,
      witnessed: witnessed.has(entryId),
      travelled: travelledEntryIds.has(entryId),
    });
    const intensity = clamp01(
      NODE_STAGE_STRENGTH[stage] * 0.76 +
      resonance.energy * 0.08 +
      (landmarkState ? LANDMARK_STATE_STRENGTH[landmarkState] : 0) * 0.1 +
      releaseBloom * 0.06,
    );
    return [{
      entryId,
      chapterId: context.chapterId,
      sceneId: context.sceneId,
      biome: scene.biome,
      stage,
      witnessed: witnessed.has(entryId),
      visitCount: visitStats.get(entryId)?.count ?? 0,
      firstVisitOrder: visitStats.get(entryId)?.firstOrder ?? null,
      completedRitualIds: nodeRitualIds,
      landmarkState,
      intensity,
    }];
  });

  const edgeMap = new Map<string, MutableEdge>();
  const addEdge = (
    sourceEntryId: string,
    targetEntryId: string,
    kind: ConstellationEdgeKind,
    order: number,
  ) => {
    if (
      sourceEntryId === targetEntryId ||
      !visibleEntryIds.has(sourceEntryId) ||
      !visibleEntryIds.has(targetEntryId)
    ) return;
    const pairKey = edgePairKey(sourceEntryId, targetEntryId);
    const existing = edgeMap.get(pairKey);
    if (existing) {
      existing.evidence[kind] = true;
      if (kind === "travel") {
        existing.kind = "travel";
        existing.traversalCount += 1;
        existing.order = Math.min(existing.order, order);
      } else if (kind === "chapter" && existing.kind === "scene") {
        existing.kind = "chapter";
      }
      return;
    }
    edgeMap.set(pairKey, {
      id: pairKey,
      sourceEntryId,
      targetEntryId,
      kind,
      order,
      traversalCount: kind === "travel" ? 1 : 0,
      evidence: {
        travel: kind === "travel",
        scene: kind === "scene",
        chapter: kind === "chapter",
      },
    });
  };

  routeEntryIds.slice(1).forEach((targetEntryId, index) => {
    addEdge(routeEntryIds[index], targetEntryId, "travel", index);
  });

  journeyScenes.forEach((scene, sceneIndex) => {
    if (!completedScenes.has(scene.id)) return;
    scene.entryIds.slice(1).forEach((targetEntryId, index) => {
      addEdge(scene.entryIds[index], targetEntryId, "scene", sceneIndex * 10 + index);
    });
  });

  journeyChapters.forEach((chapter, chapterIndex) => {
    if (!completedChapters.has(chapter.id)) return;
    const sceneKeystones = chapter.sceneIds.flatMap((sceneId) => {
      const scene = SCENE_BY_ID.get(sceneId);
      return scene ? [scene.keystoneEntryId] : [];
    });
    sceneKeystones.slice(1).forEach((targetEntryId, index) => {
      addEdge(sceneKeystones[index], targetEntryId, "chapter", 1_000 + chapterIndex * 10 + index);
    });

    const nextChapter = journeyChapters[chapterIndex + 1];
    if (!nextChapter || !completedChapters.has(nextChapter.id)) return;
    const lastScene = SCENE_BY_ID.get(chapter.sceneIds[chapter.sceneIds.length - 1]);
    const firstNextScene = SCENE_BY_ID.get(nextChapter.sceneIds[0]);
    if (lastScene && firstNextScene) {
      addEdge(
        lastScene.keystoneEntryId,
        firstNextScene.keystoneEntryId,
        "chapter",
        2_000 + chapterIndex,
      );
    }
  });

  const edges = [...edgeMap.values()].sort((a, b) => {
    const kindOrder = { scene: 0, chapter: 1, travel: 2 } as const;
    return kindOrder[a.kind] - kindOrder[b.kind] || a.order - b.order || a.id.localeCompare(b.id);
  });
  const chapters = journeyChapters.flatMap((chapter): ConstellationChapterThread[] => {
    const visible = chapter.entryIds.filter((entryId) => visibleEntryIds.has(entryId));
    if (visible.length === 0) return [];
    return [{
      id: chapter.id,
      title: chapter.title,
      biome: chapter.biome,
      completed: completedChapters.has(chapter.id),
      totalEntryCount: chapter.entryIds.length,
      visibleEntryIds: visible,
    }];
  });
  const nestChapter = journeyChapters.find((chapter) => chapter.id === "nest");
  const protectedNestEntryIds = nestChapter?.entryIds.filter((entryId) => visibleEntryIds.has(entryId)) ?? [];
  const protectedNest: ConstellationProtectedNest = {
    visible: protectedNestEntryIds.length > 0,
    protected: completedChapters.has("nest"),
    entryIds: protectedNestEntryIds,
  };

  return {
    nodes,
    edges,
    chapters,
    routeEntryIds,
    isNearlyEmpty:
      nodes.length <= 1 &&
      edges.length === 0 &&
      witnessed.size === 0 &&
      resonanceNodes.every((node) => !node.visible) &&
      releasedWords.length === 0,
    progress: {
      witnessedEntries: witnessed.size,
      completedRituals: [...completedRituals].filter((ritualId) => RITUAL_ID_SET.has(ritualId)).length,
      completedScenes: JOURNEY_SCENE_IDS.filter((sceneId) => completedScenes.has(sceneId)).length,
      completedChapters: JOURNEY_CHAPTER_IDS.filter((chapterId) => completedChapters.has(chapterId)).length,
      routeSteps: Math.max(0, routeEntryIds.length - 1),
    },
    resonance,
    resonanceNodes,
    releasedWords,
    releasedWordCount,
    releaseBloom,
    protectedNest,
    landmarkMemory,
  };
}

export function isCompleteStoryConstellation(model: ConstellationStoryModel) {
  return model.nodes.length === BLUEPRINT_ENTRY_IDS.length &&
    model.progress.completedScenes === JOURNEY_SCENE_IDS.length &&
    model.progress.completedChapters === JOURNEY_CHAPTER_IDS.length;
}

export const STORY_CONSTELLATION_ENTRY_COUNT = BLUEPRINT_ENTRY_IDS.length;
