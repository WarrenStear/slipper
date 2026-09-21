import type {
  JourneyActId,
  LandmarkState,
  ResonanceKey,
  RitualVerb,
  StoryJourneyProgressLocation,
  StoryJourneyState,
} from "../lib/storyJourneyState";
import {
  JOURNEY_ENTRY_CONTEXT,
  journeyChapters,
  validateNarrativeJourneyBlueprint,
  type JourneyChapterId,
} from "./journeyNarrative.ts";

export {
  JOURNEY_CHAPTER_IDS,
  JOURNEY_ENTRY_CONTEXT,
  JOURNEY_NARRATIVE_ANCHORS,
  JOURNEY_SCENE_IDS,
  JOURNEY_TECHNICAL_BIOMES,
  getJourneyChapter,
  getJourneyChapterForEntry,
  getJourneyEntryContext,
  getJourneyScene,
  getJourneySceneForEntry,
  journeyChapters,
  journeyScenes,
  validateNarrativeJourneyBlueprint,
} from "./journeyNarrative.ts";
export type {
  JourneyChapter,
  JourneyChapterId,
  JourneyEntryContext,
  JourneyNarrativeEntryRole,
  JourneyScene,
  JourneySceneId,
  JourneySceneRole,
  JourneyTechnicalBiome,
} from "./journeyNarrative.ts";

export type JourneyBeatRole =
  | "arrival"
  | "keystone"
  | "echo"
  | "ritual"
  | "threshold"
  | "transformation"
  | "departure";

export type JourneyCondition =
  | { type: "entry-witnessed"; entryId: string }
  | { type: "ritual-complete"; ritualId: string }
  | { type: "world-flag"; flagId: string; value?: boolean }
  | { type: "inventory-lantern" }
  | { type: "inventory-key"; keyId: string }
  | { type: "act-complete"; actId: JourneyActId };

export type JourneyOutcome =
  | { type: "complete-ritual"; ritualId: string }
  | { type: "set-world-flag"; flagId: string; value: boolean }
  | { type: "set-landmark-state"; landmarkId: string; state: LandmarkState }
  | { type: "add-resonance"; resonance: ResonanceKey; amount: number }
  | { type: "award-lantern" }
  | { type: "recover-key"; keyId: string }
  | { type: "collect-symbolic-object"; objectId: string }
  | { type: "release-word"; word: string }
  | { type: "complete-act"; actId: JourneyActId }
  | { type: "complete-story" };

export type JourneyInteraction = {
  id: string;
  ritualId: string;
  verb: RitualVerb;
  label: string;
  instruction: string;
  inputMode: "press" | "hold" | "stillness";
  durationMs?: number;
};

export type JourneyBeat = {
  id: string;
  actId: JourneyActId;
  entryId?: string;
  role: JourneyBeatRole;
  requiredState?: JourneyCondition[];
  interactions?: JourneyInteraction[];
  outcomes?: JourneyOutcome[];
  nextBeatIds: string[];
  landmarkId?: string;
  audioCue?: string;
  environmentCue?: string;
  optional?: boolean;
};

export type JourneyAct = {
  id: JourneyActId;
  title: string;
  dramaticFunction: string;
  regionCue: string;
  entryIds: string[];
  keystoneEntryIds: string[];
  echoEntryIds: string[];
  mainBeatIds: string[];
  ritualIds: string[];
  completionRequirements: JourneyCondition[];
  nextActId?: JourneyActId;
};

type AuthoredRitual = JourneyInteraction & {
  afterEntryId: string;
  landmarkId: string;
  requiredState?: JourneyCondition[];
  outcomes: JourneyOutcome[];
  environmentCue: string;
  audioCue: string;
};

type AuthoredAct = {
  id: JourneyActId;
  title: string;
  dramaticFunction: string;
  regionCue: string;
  entries: readonly string[];
  keystones: readonly string[];
  rituals: readonly AuthoredRitual[];
  transformation: {
    landmarkId: string;
    environmentCue: string;
    audioCue: string;
    outcomes: JourneyOutcome[];
  };
};

type LegacyRegionTemplate = Omit<AuthoredAct, "entries" | "keystones">;

// These six identifiers are retained as a save-compatible technical layer.
// Canonical fragment placement and player-facing progression live exclusively
// in the uneven twelve-chapter catalogue in journeyNarrative.ts.
const LEGACY_REGION_TEMPLATES: readonly LegacyRegionTemplate[] = [
  {
    id: "first-wood",
    title: "The First Wood",
    dramaticFunction: "Fracture, entry, and the willingness to see.",
    regionCue: "dense-mist-weak-lantern",
    rituals: [
      {
        id: "interaction.accept-lantern",
        ritualId: "ritual.accept-lantern",
        afterEntryId: "fragment-001",
        verb: "carry",
        label: "Accept the Lantern",
        instruction: "Acknowledge that you are willing to see what the wood remembers.",
        inputMode: "hold",
        durationMs: 1500,
        landmarkId: "landmark.first-wood-lantern",
        audioCue: "lantern-first-breath",
        environmentCue: "first-path-awakens",
        outcomes: [
          { type: "complete-ritual", ritualId: "ritual.accept-lantern" },
          { type: "award-lantern" },
          { type: "set-world-flag", flagId: "path.first-wood-readable", value: true },
          { type: "set-world-flag", flagId: "guidance.fireflies-awake", value: true },
          { type: "set-landmark-state", landmarkId: "landmark.first-wood-lantern", state: "awakened" },
          { type: "add-resonance", resonance: "seer", amount: 6 },
        ],
      },
    ],
    transformation: {
      landmarkId: "landmark.first-wood-lantern",
      environmentCue: "mist-parts-around-first-threshold",
      audioCue: "wood-opens",
      outcomes: [
        { type: "set-landmark-state", landmarkId: "landmark.first-wood-lantern", state: "transformed" },
        { type: "complete-act", actId: "first-wood" },
      ],
    },
  },
  {
    id: "mirror-clearing",
    title: "The Mirror Clearing",
    dramaticFunction: "Recognition, reflection, and truth without force.",
    regionCue: "cool-water-delayed-reflections",
    rituals: [
      {
        id: "interaction.witness-mirror",
        ritualId: "ritual.witness-mirror",
        afterEntryId: "fragment-040",
        verb: "witness",
        label: "Witness without changing",
        instruction: "Do not force the reflection. Let it arrive while you remain still.",
        inputMode: "stillness",
        durationMs: 6200,
        landmarkId: "landmark.mirror",
        audioCue: "reflection-resolves",
        environmentCue: "truthful-reflections",
        outcomes: [
          { type: "complete-ritual", ritualId: "ritual.witness-mirror" },
          { type: "set-world-flag", flagId: "mirror.reflections-truthful", value: true },
          { type: "set-world-flag", flagId: "path.reflected-route-visible", value: true },
          { type: "set-landmark-state", landmarkId: "landmark.mirror", state: "scarred" },
          { type: "add-resonance", resonance: "seer", amount: 12 },
        ],
      },
    ],
    transformation: {
      landmarkId: "landmark.mirror",
      environmentCue: "mirror-readable-crack-remains",
      audioCue: "water-tells-truth",
      outcomes: [
        { type: "set-landmark-state", landmarkId: "landmark.mirror", state: "transformed" },
        { type: "complete-act", actId: "mirror-clearing" },
      ],
    },
  },
  {
    id: "thorned-house",
    title: "The Thorned House",
    dramaticFunction: "False sanctuary, compression, and recovered agency.",
    regionCue: "warm-house-folding-passages",
    rituals: [
      {
        id: "interaction.recover-key",
        ritualId: "ritual.recover-key",
        afterEntryId: "fragment-054",
        verb: "recover",
        label: "Recover the Key",
        instruction: "Stop trying every door. Take back the permission that was always yours.",
        inputMode: "hold",
        durationMs: 1750,
        landmarkId: "landmark.thorn-door",
        audioCue: "key-recognises-lock",
        environmentCue: "thorn-door-opens",
        outcomes: [
          { type: "complete-ritual", ritualId: "ritual.recover-key" },
          { type: "recover-key", keyId: "key.self-permission" },
          { type: "set-world-flag", flagId: "thorn-door.open", value: true },
          { type: "set-world-flag", flagId: "thorn-house.collapsed-wing", value: true },
          { type: "set-landmark-state", landmarkId: "landmark.thorn-door", state: "transformed" },
          { type: "add-resonance", resonance: "wolf", amount: 10 },
        ],
      },
    ],
    transformation: {
      landmarkId: "landmark.thorn-door",
      environmentCue: "brambles-retreat-forest-returns",
      audioCue: "outside-air-through-house",
      outcomes: [
        { type: "set-world-flag", flagId: "path.house-exit-open", value: true },
        { type: "complete-act", actId: "thorned-house" },
      ],
    },
  },
  {
    id: "blue-moon-archive",
    title: "The Blue Moon Archive",
    dramaticFunction: "Beauty, intimacy, longing, and memory carried forward.",
    regionCue: "powder-blue-moon-swans-candles",
    rituals: [
      {
        id: "interaction.accept-memory",
        ritualId: "ritual.accept-memory",
        afterEntryId: "fragment-062",
        verb: "touch",
        label: "Accept the Memory",
        instruction: "Keep the beauty true without returning to the cage that held it.",
        inputMode: "press",
        landmarkId: "landmark.blue-moon-archive",
        audioCue: "swan-motif-resolves",
        environmentCue: "nostalgia-loops-close",
        outcomes: [
          { type: "complete-ritual", ritualId: "ritual.accept-memory" },
          { type: "collect-symbolic-object", objectId: "memory.blue-moon" },
          { type: "set-world-flag", flagId: "archive.memory-carried", value: true },
          { type: "set-world-flag", flagId: "archive.nostalgia-loops-closed", value: true },
          { type: "set-landmark-state", landmarkId: "landmark.blue-moon-archive", state: "witnessed" },
          { type: "add-resonance", resonance: "swan", amount: 12 },
        ],
      },
    ],
    transformation: {
      landmarkId: "landmark.blue-moon-archive",
      environmentCue: "beautiful-archive-exit-revealed",
      audioCue: "missing-note-returns-changed",
      outcomes: [
        { type: "set-landmark-state", landmarkId: "landmark.blue-moon-archive", state: "transformed" },
        { type: "complete-act", actId: "blue-moon-archive" },
      ],
    },
  },
  {
    id: "fire-and-river",
    title: "The Fire and River",
    dramaticFunction: "Boundary, grief, release, and surrender.",
    regionCue: "ember-river-fork-black-birds",
    rituals: [
      {
        id: "interaction.burn-boundary",
        ritualId: "ritual.burn-boundary",
        afterEntryId: "fragment-053",
        verb: "burn",
        label: "Burn what cannot continue",
        instruction: "Give the fire one burden that no longer belongs in your hands.",
        inputMode: "hold",
        durationMs: 1800,
        landmarkId: "landmark.fire-river",
        audioCue: "boundary-fire",
        environmentCue: "fire-settles-to-ash",
        outcomes: [
          { type: "complete-ritual", ritualId: "ritual.burn-boundary" },
          { type: "set-world-flag", flagId: "fire.boundary-burned", value: true },
          { type: "set-landmark-state", landmarkId: "landmark.fire-river", state: "scarred" },
          { type: "add-resonance", resonance: "wolf", amount: 9 },
        ],
      },
      {
        id: "interaction.wash-grief",
        ritualId: "ritual.wash-grief",
        afterEntryId: "fragment-034",
        verb: "wash",
        label: "Wash what still aches",
        instruction: "Let the river hold the tenderness without asking it to become a cage.",
        inputMode: "hold",
        durationMs: 1800,
        landmarkId: "landmark.fire-river",
        requiredState: [{ type: "ritual-complete", ritualId: "ritual.burn-boundary" }],
        audioCue: "river-accepts-grief",
        environmentCue: "water-clears",
        outcomes: [
          { type: "complete-ritual", ritualId: "ritual.wash-grief" },
          { type: "set-world-flag", flagId: "river.grief-washed", value: true },
          { type: "add-resonance", resonance: "swan", amount: 9 },
        ],
      },
      {
        id: "interaction.release-river-memory",
        ritualId: "ritual.release-river-memory",
        afterEntryId: "fragment-057",
        verb: "release",
        label: "Release the remembered words",
        instruction: "Allow the words to leave without erasing what they once meant.",
        inputMode: "press",
        landmarkId: "landmark.fire-river",
        requiredState: [{ type: "ritual-complete", ritualId: "ritual.wash-grief" }],
        audioCue: "birds-unbind",
        environmentCue: "black-birds-depart",
        outcomes: [
          { type: "complete-ritual", ritualId: "ritual.release-river-memory" },
          { type: "release-word", word: "hope" },
          { type: "set-world-flag", flagId: "river.memory-released", value: true },
          { type: "set-world-flag", flagId: "birds.black-swarm-released", value: true },
          { type: "set-landmark-state", landmarkId: "landmark.fire-river", state: "released" },
        ],
      },
      {
        id: "interaction.surrender",
        ritualId: "ritual.surrender",
        afterEntryId: "fragment-057",
        verb: "surrender",
        label: "Surrender",
        instruction: "There is nothing left to force. Let the world move while you do not.",
        inputMode: "stillness",
        durationMs: 7600,
        landmarkId: "landmark.fire-river",
        requiredState: [{ type: "ritual-complete", ritualId: "ritual.release-river-memory" }],
        audioCue: "white-flag-silence",
        environmentCue: "fire-water-coexist",
        outcomes: [
          { type: "complete-ritual", ritualId: "ritual.surrender" },
          { type: "set-world-flag", flagId: "surrender.white-flag-raised", value: true },
          { type: "set-world-flag", flagId: "path.crowned-return-visible", value: true },
          { type: "add-resonance", resonance: "wolf", amount: 4 },
          { type: "add-resonance", resonance: "swan", amount: 4 },
          { type: "add-resonance", resonance: "seer", amount: 4 },
        ],
      },
    ],
    transformation: {
      landmarkId: "landmark.fire-river",
      environmentCue: "ash-settles-river-clears-route-ascends",
      audioCue: "fire-and-water-concord",
      outcomes: [
        { type: "complete-act", actId: "fire-and-river" },
      ],
    },
  },
  {
    id: "crowned-return",
    title: "The Crowned Return",
    dramaticFunction: "Integration, sovereignty, home, and return to self.",
    regionCue: "open-sky-golden-ascent",
    rituals: [
      {
        id: "interaction.place-lantern",
        ritualId: "ritual.place-lantern",
        afterEntryId: "fragment-044",
        verb: "place",
        label: "Place the Lantern",
        instruction: "Set the light down. The capacity to see does not leave when your hands open.",
        inputMode: "hold",
        durationMs: 2200,
        landmarkId: "landmark.crowned-gate",
        requiredState: [
          { type: "inventory-key", keyId: "key.self-permission" },
          { type: "ritual-complete", ritualId: "ritual.surrender" },
        ],
        audioCue: "lantern-set-down-still-burning",
        environmentCue: "constellation-completes-over-wood",
        outcomes: [
          { type: "complete-ritual", ritualId: "ritual.place-lantern" },
          { type: "set-world-flag", flagId: "lantern.placed-and-lit", value: true },
          { type: "set-landmark-state", landmarkId: "landmark.crowned-gate", state: "released" },
        ],
      },
    ],
    transformation: {
      landmarkId: "landmark.crowned-gate",
      environmentCue: "whole-journey-visible-from-home",
      audioCue: "completed-constellation",
      outcomes: [
        { type: "complete-act", actId: "crowned-return" },
        { type: "complete-story" },
      ],
    },
  },
] as const;

type CompatibilityPhaseDefinition = {
  id: JourneyActId;
  title: string;
  dramaticFunction: string;
  regionCue: string;
  chapterIds: readonly JourneyChapterId[];
  ritualIds: readonly string[];
  transformationSourceId: JourneyActId;
};

// v1/v2 cloud saves still carry one of the six original act IDs. Those IDs now
// describe uneven compatibility phases assembled from the authoritative
// twelve-chapter story. They no longer partition the archive into six equal
// sequence buckets and they never determine player-facing chapter labels.
const COMPATIBILITY_PHASES = [
  {
    id: "first-wood",
    title: "The Broken Floor and Enchanted Wood",
    dramaticFunction: "Confession, entry, warmth, and the first contradiction.",
    regionCue: "broken-floor-to-enchanted-wood",
    chapterIds: ["broken-floor", "enchanted-wood"],
    ritualIds: ["ritual.accept-lantern"],
    transformationSourceId: "first-wood",
  },
  {
    id: "mirror-clearing",
    title: "The Blue Moon and the Nest",
    dramaticFunction: "Beauty remembered alongside protection, labour, and care.",
    regionCue: "blue-moon-to-sunrise-nest",
    chapterIds: ["blue-moon-sanctuary", "nest"],
    ritualIds: ["ritual.accept-memory"],
    transformationSourceId: "blue-moon-archive",
  },
  {
    id: "thorned-house",
    title: "The Seer and the Thorned House",
    dramaticFunction: "Truth becomes readable, and self-permission opens the way out.",
    regionCue: "sunset-seer-to-thorned-house",
    chapterIds: ["sunset-seer", "thorned-house"],
    ritualIds: ["ritual.witness-mirror", "ritual.recover-key"],
    transformationSourceId: "thorned-house",
  },
  {
    id: "blue-moon-archive",
    title: "Wolf, Swan and Seer",
    dramaticFunction: "Tenderness, boundary, and discernment are held together.",
    regionCue: "three-aspects-converge",
    chapterIds: ["wolf-swan-seer"],
    ritualIds: [],
    transformationSourceId: "mirror-clearing",
  },
  {
    id: "fire-and-river",
    title: "Fire, River and the Fork",
    dramaticFunction: "Boundary, grief, release, surrender, and chosen departure.",
    regionCue: "fire-river-to-fork",
    chapterIds: ["fire-river", "fork"],
    ritualIds: [
      "ritual.burn-boundary",
      "ritual.wash-grief",
      "ritual.release-river-memory",
      "ritual.surrender",
    ],
    transformationSourceId: "fire-and-river",
  },
  {
    id: "crowned-return",
    title: "The Three Climbs and Crowned Return",
    dramaticFunction: "Mind, heart, and creation return home as integrated sovereignty.",
    regionCue: "three-climbs-to-returned-home",
    chapterIds: ["three-climbs", "crowned-return", "lantern-epilogue"],
    ritualIds: ["ritual.place-lantern"],
    transformationSourceId: "crowned-return",
  },
] as const satisfies readonly CompatibilityPhaseDefinition[];

const LEGACY_REGION_TEMPLATE_BY_ID = new Map(
  LEGACY_REGION_TEMPLATES.map((template) => [template.id, template] as const),
);
const AUTHORED_RITUAL_CATALOGUE_BY_ID = new Map(
  LEGACY_REGION_TEMPLATES.flatMap((template) =>
    template.rituals.map((ritual) => [ritual.ritualId, ritual] as const)
  ),
);

function chaptersForCompatibilityPhase(chapterIds: readonly JourneyChapterId[]) {
  const selected = new Set<JourneyChapterId>(chapterIds);
  return journeyChapters.filter((chapter) => selected.has(chapter.id));
}

const AUTHORED_ACTS: readonly AuthoredAct[] = COMPATIBILITY_PHASES.map((phase) => {
  const base = LEGACY_REGION_TEMPLATE_BY_ID.get(phase.id);
  const transformationSource = LEGACY_REGION_TEMPLATE_BY_ID.get(
    phase.transformationSourceId,
  );
  if (!base || !transformationSource) {
    throw new Error(`Missing compatibility template for ${phase.id}`);
  }
  const chapters = chaptersForCompatibilityPhase(phase.chapterIds);
  const rituals = phase.ritualIds.map((ritualId) => {
    const ritual = AUTHORED_RITUAL_CATALOGUE_BY_ID.get(ritualId);
    if (!ritual) throw new Error(`Missing authored ritual ${ritualId}`);
    return ritual;
  });
  const outcomes = transformationSource.transformation.outcomes.map((outcome) =>
    outcome.type === "complete-act"
      ? { ...outcome, actId: phase.id }
      : outcome
  );

  return {
    ...base,
    id: phase.id,
    title: phase.title,
    dramaticFunction: phase.dramaticFunction,
    regionCue: phase.regionCue,
    entries: chapters.flatMap((chapter) => chapter.entryIds),
    keystones: chapters.flatMap((chapter) => chapter.keystoneEntryIds),
    rituals,
    transformation: {
      ...transformationSource.transformation,
      outcomes,
    },
  };
});

function beatId(actId: JourneyActId, role: JourneyBeatRole, suffix?: string) {
  return `${actId}.${role}${suffix ? `.${suffix}` : ""}`;
}

const mutableBeats: JourneyBeat[] = [];
const mutableActs: JourneyAct[] = [];
const entryProgress: Record<string, StoryJourneyProgressLocation> = {};
const ritualEntry = new Map<string, string>();

AUTHORED_ACTS.forEach((act, actIndex) => {
  const nextAct = AUTHORED_ACTS[actIndex + 1];
  const completionRequirements: JourneyCondition[] = [
    ...act.keystones.map((entryId) => ({ type: "entry-witnessed" as const, entryId })),
    ...act.rituals.map((ritual) => ({ type: "ritual-complete" as const, ritualId: ritual.ritualId })),
  ];
  const mainBeatIds: string[] = [];
  const arrivalId = beatId(act.id, "arrival");
  mutableBeats.push({
    id: arrivalId,
    actId: act.id,
    role: "arrival",
    requiredState: actIndex === 0 ? [] : [{ type: "act-complete", actId: AUTHORED_ACTS[actIndex - 1].id }],
    nextBeatIds: [],
    landmarkId: act.transformation.landmarkId,
    environmentCue: act.regionCue,
    audioCue: `${act.id}-arrival`,
  });
  for (const entryId of act.entries) {
    const isKeystone = act.keystones.includes(entryId);
    const id = beatId(act.id, isKeystone ? "keystone" : "echo", entryId);
    mutableBeats.push({
      id,
      actId: act.id,
      entryId,
      role: isKeystone ? "keystone" : "echo",
      nextBeatIds: [],
      optional: !isKeystone,
      environmentCue: isKeystone ? `${act.id}-keystone` : `${act.id}-echo`,
      audioCue: isKeystone ? `${act.id}-memory-awakens` : `${act.id}-whisper`,
    });
    const narrativeContext = JOURNEY_ENTRY_CONTEXT[entryId];
    if (!narrativeContext) {
      throw new Error(`${entryId} is missing from the authored narrative catalogue`);
    }
    entryProgress[entryId] = {
      actId: act.id,
      chapterId: narrativeContext.chapterId,
      sceneId: narrativeContext.sceneId,
      beatId: id,
    };
  }

  for (const ritual of act.rituals) {
    const id = beatId(act.id, "ritual", ritual.ritualId.replace(/^ritual\./, ""));
    mutableBeats.push({
      id,
      actId: act.id,
      entryId: ritual.afterEntryId,
      role: "ritual",
      requiredState: [
        { type: "entry-witnessed", entryId: ritual.afterEntryId },
        ...(ritual.requiredState ?? []),
      ],
      interactions: [ritual],
      outcomes: ritual.outcomes,
      nextBeatIds: [],
      landmarkId: ritual.landmarkId,
      audioCue: ritual.audioCue,
      environmentCue: ritual.environmentCue,
    });
    ritualEntry.set(ritual.ritualId, ritual.afterEntryId);
  }

  // Main-story rituals occur at their authored memory, rather than being
  // appended after every keystone in the act. Echoes remain discoverable but
  // do not interrupt the primary story chain.
  mainBeatIds.length = 0;
  mainBeatIds.push(arrivalId);
  for (const entryId of act.entries) {
    if (act.keystones.includes(entryId)) {
      mainBeatIds.push(beatId(act.id, "keystone", entryId));
    }
    for (const ritual of act.rituals) {
      if (ritual.afterEntryId !== entryId) continue;
      mainBeatIds.push(beatId(act.id, "ritual", ritual.ritualId.replace(/^ritual\./, "")));
    }
  }

  const transformationId = beatId(act.id, "transformation");
  const thresholdId = beatId(act.id, "threshold");
  const departureId = beatId(act.id, "departure");
  mutableBeats.push({
    id: transformationId,
    actId: act.id,
    role: "transformation",
    requiredState: completionRequirements,
    outcomes: act.transformation.outcomes,
    nextBeatIds: [thresholdId],
    landmarkId: act.transformation.landmarkId,
    audioCue: act.transformation.audioCue,
    environmentCue: act.transformation.environmentCue,
  });
  mutableBeats.push({
    id: thresholdId,
    actId: act.id,
    role: "threshold",
    requiredState: [{ type: "act-complete", actId: act.id }],
    nextBeatIds: [departureId],
    landmarkId: act.transformation.landmarkId,
    audioCue: `${act.id}-threshold-opens`,
    environmentCue: nextAct ? `${act.id}-to-${nextAct.id}` : "final-room-opens",
  });
  mutableBeats.push({
    id: departureId,
    actId: act.id,
    role: "departure",
    requiredState: [{ type: "act-complete", actId: act.id }],
    nextBeatIds: nextAct ? [beatId(nextAct.id, "arrival")] : [],
    landmarkId: act.transformation.landmarkId,
    audioCue: `${act.id}-departure`,
    environmentCue: nextAct ? nextAct.regionCue : "completed-constellation",
  });
  mainBeatIds.push(transformationId, thresholdId, departureId);

  for (let index = 0; index < mainBeatIds.length - 1; index += 1) {
    const beat = mutableBeats.find((candidate) => candidate.id === mainBeatIds[index]);
    if (beat && beat.nextBeatIds.length === 0) beat.nextBeatIds = [mainBeatIds[index + 1]];
  }

  mutableActs.push({
    id: act.id,
    title: act.title,
    dramaticFunction: act.dramaticFunction,
    regionCue: act.regionCue,
    entryIds: [...act.entries],
    keystoneEntryIds: [...act.keystones],
    echoEntryIds: act.entries.filter((entryId) => !act.keystones.includes(entryId)),
    mainBeatIds,
    ritualIds: act.rituals.map((ritual) => ritual.ritualId),
    completionRequirements,
    nextActId: nextAct?.id,
  });
});

export const journeyBeats = mutableBeats as readonly JourneyBeat[];
export const journeyActs = mutableActs as readonly JourneyAct[];
export const journeyBlueprint = Object.fromEntries(journeyActs.map((act) => [act.id, act])) as Readonly<Record<JourneyActId, JourneyAct>>;

const BEAT_BY_ID = new Map(journeyBeats.map((beat) => [beat.id, beat]));
const ACT_BY_ID = new Map(journeyActs.map((act) => [act.id, act]));
const ACT_BY_ENTRY_ID = new Map(journeyActs.flatMap((act) => act.entryIds.map((entryId) => [entryId, act] as const)));

export const JOURNEY_ENTRY_PROGRESS = entryProgress as Readonly<Record<string, StoryJourneyProgressLocation>>;
export const JOURNEY_BEAT_IDS_BY_ACT = Object.fromEntries(
  journeyActs.map((act) => [act.id, journeyBeats.filter((beat) => beat.actId === act.id).map((beat) => beat.id)]),
) as Record<JourneyActId, string[]>;
export const JOURNEY_RITUAL_IDS = AUTHORED_ACTS.flatMap((act) => act.rituals.map((ritual) => ritual.ritualId));
export const JOURNEY_NARRATIVE_ACTION_FLAG_IDS = [
  "blue-moon.candles-lit",
  "blue-moon.water-touched",
  "blue-moon.swan-followed",
  "blue-moon.flowers-placed",
  "blue-moon.beautiful-door-open",
  "nest.hand-held",
  "nest.hand-kept",
  "nest.unsupported-burden-held",
  "nest.unsupported-burden-released",
  "nest.protection-acknowledged",
  "thorn-house.space-cleared",
  "thorn-house.space-refilled",
  "thorn-house.reorganisation-released",
  "thorn-house.exit-crossed",
  "integration.swan-witnessed",
  "integration.wolf-witnessed",
  "integration.seer-witnessed",
  "integration.three-aspects-held",
  "fork.weighed",
  "fork.let-go",
  "fork.declined",
  "fork.departed",
  "fork.deleted",
  "fork.old-hope-relinquished",
  "lantern.owned",
  "climb.mind.questions-released",
  "climb.heart.memory-chosen",
  "climb.womb.creation-chosen",
] as const;

export const JOURNEY_WORLD_FLAG_IDS = [...new Set([
  ...JOURNEY_NARRATIVE_ACTION_FLAG_IDS,
  ...AUTHORED_ACTS.flatMap((act) => [
    ...act.rituals.flatMap((ritual) => ritual.outcomes),
    ...act.transformation.outcomes,
  ])
    .filter((outcome): outcome is Extract<JourneyOutcome, { type: "set-world-flag" }> => outcome.type === "set-world-flag")
    .map((outcome) => outcome.flagId),
])];
export const JOURNEY_LANDMARK_IDS = [...new Set(AUTHORED_ACTS.map((act) => act.transformation.landmarkId))];
export const JOURNEY_RECOVERED_KEY_IDS = ["key.protection", "key.self-permission"] as const;
export const JOURNEY_SYMBOLIC_OBJECT_IDS = [
  "memory.blue-moon",
  "memory.chosen-heart",
  "memory.heart.tenderness",
  "memory.heart.beauty",
  "memory.heart.selfhood",
  "creation.chosen-future",
  "creation.future.rest",
  "creation.future.home",
  "creation.future.voice",
] as const;

export function getJourneyAct(actId: JourneyActId) {
  return ACT_BY_ID.get(actId);
}

export function getJourneyActForEntry(entryId: string) {
  return ACT_BY_ENTRY_ID.get(entryId);
}

export function getJourneyBeat(beatId: string) {
  return BEAT_BY_ID.get(beatId);
}

export function getJourneyBeatForEntry(entryId: string) {
  const progress = JOURNEY_ENTRY_PROGRESS[entryId];
  return progress ? BEAT_BY_ID.get(progress.beatId) : undefined;
}

export function getJourneyRitualBeat(ritualId: string) {
  return journeyBeats.find((beat) => beat.interactions?.some((interaction) => interaction.ritualId === ritualId));
}

export function getJourneyRitualBeatsForEntry(entryId: string) {
  return journeyBeats.filter((beat) => beat.entryId === entryId && beat.role === "ritual");
}

export function journeyConditionMet(condition: JourneyCondition, state: StoryJourneyState) {
  if (condition.type === "entry-witnessed") return state.witnessedEntryIds.includes(condition.entryId);
  if (condition.type === "ritual-complete") return state.completedRitualIds.includes(condition.ritualId);
  if (condition.type === "world-flag") return state.worldFlags[condition.flagId] === (condition.value ?? true);
  if (condition.type === "inventory-lantern") return state.inventory.lantern;
  if (condition.type === "inventory-key") return state.inventory.recoveredKeys.includes(condition.keyId);
  return state.completedActs.includes(condition.actId);
}

export function journeyBeatAvailable(beat: JourneyBeat, state: StoryJourneyState) {
  return (beat.requiredState ?? []).every((condition) => journeyConditionMet(condition, state));
}

export function nextAvailableRitualForEntry(entryId: string, state: StoryJourneyState) {
  return getJourneyRitualBeatsForEntry(entryId).find(
    (beat) =>
      journeyBeatAvailable(beat, state) &&
      beat.interactions?.some((interaction) => !state.completedRitualIds.includes(interaction.ritualId)),
  );
}

export function ritualEntryId(ritualId: string) {
  return ritualEntry.get(ritualId);
}

export type JourneyGuidanceState = Pick<
  StoryJourneyState,
  "witnessedEntryIds" | "completedRitualIds" | "completedActs"
>;

/**
 * Resolves the next authored story destination without turning optional echo
 * memories into objectives. The physical maze remains explorable, while the
 * lantern-guided route follows the canonical beat order and pauses at rituals.
 */
export function nextRequiredJourneyEntryId(state: JourneyGuidanceState) {
  const witnessed = new Set(state.witnessedEntryIds);
  const completedRituals = new Set(state.completedRitualIds);
  const completedActs = new Set(state.completedActs);

  for (const act of journeyActs) {
    if (completedActs.has(act.id)) continue;
    for (const beatId of act.mainBeatIds) {
      const beat = getJourneyBeat(beatId);
      if (!beat) continue;
      if (beat.role === "keystone" && beat.entryId && !witnessed.has(beat.entryId)) {
        return beat.entryId;
      }
      if (
        beat.role === "ritual" &&
        beat.entryId &&
        beat.interactions?.some((interaction) => !completedRituals.has(interaction.ritualId))
      ) {
        return beat.entryId;
      }
    }

    // Completion is normally reconciled immediately by JourneyDirector. Keep
    // guidance grounded at the final authored keystone during that brief gap.
    return act.keystoneEntryIds[act.keystoneEntryIds.length - 1];
  }

  return undefined;
}

export function validateJourneyBlueprint(validEntryIds: readonly string[]) {
  const issues: string[] = [];
  const expected = new Set(validEntryIds);
  const assigned = new Set<string>();
  for (const act of journeyActs) {
    if (act.keystoneEntryIds.length === 0) issues.push(`${act.id} has no compatibility keystones`);
    for (const entryId of act.entryIds) {
      if (!expected.has(entryId)) issues.push(`${act.id} references unknown entry ${entryId}`);
      if (assigned.has(entryId)) issues.push(`${entryId} is assigned to more than one act`);
      assigned.add(entryId);
    }
  }
  for (const entryId of expected) {
    if (!assigned.has(entryId)) issues.push(`${entryId} is missing from the journey blueprint`);
  }
  if (journeyActs.reduce((sum, act) => sum + act.keystoneEntryIds.length, 0) < 24 || journeyActs.reduce((sum, act) => sum + act.keystoneEntryIds.length, 0) > 32) {
    issues.push("the journey must contain 24-32 keystone memories");
  }
  issues.push(...validateNarrativeJourneyBlueprint(validEntryIds));
  return issues;
}
