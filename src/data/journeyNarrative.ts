import {
  JOURNEY_CHAPTER_IDS,
  JOURNEY_SCENE_IDS,
  type JourneyChapterId,
  type JourneySceneId,
} from "../lib/storyJourneyState.ts";

export const JOURNEY_TECHNICAL_BIOMES = [
  "firstWood",
  "mirror",
  "thorned",
  "archive",
  "fireRiver",
  "crowned",
] as const;

export type JourneyTechnicalBiome = (typeof JOURNEY_TECHNICAL_BIOMES)[number];
export type JourneyNarrativeEntryRole = "keystone" | "echo";
export type JourneySceneRole =
  | "arrival"
  | "memory"
  | "echo"
  | "ritual"
  | "transition"
  | "reflection"
  | "architectural"
  | "climb"
  | "finale";

export type JourneyInteractionDensity = "none" | "low" | "focused" | "ritual";
export type JourneyTransitionStyle = "walk" | "fade" | "environment" | "reflection" | "silence";

export type JourneyScenePresentation = {
  arrivalLine?: string;
  guidanceLines?: readonly string[];
  completionLine?: string;
  silenceAfterCompletionMs?: number;
  chapterTitleTreatment?: "none" | "subtle" | "full";
  proseTreatment?: "ambient" | "reflected" | "water" | "ash" | "wall" | "constellation";
};

export type StoryPacingProfile = {
  arrivalQuietMs?: number;
  minimumContemplationMs?: number;
  completionQuietMs?: number;
  interactionDensity: JourneyInteractionDensity;
  guidanceDelayMs?: number;
  transitionStyle: JourneyTransitionStyle;
};

export type JourneyScene = {
  id: JourneySceneId;
  chapterId: JourneyChapterId;
  title: string;
  biome: JourneyTechnicalBiome;
  role: JourneySceneRole;
  entryIds: readonly string[];
  keystoneEntryId: string;
  echoEntryIds: readonly string[];
  environmentCue: string;
  audioCue: string;
  presentation: JourneyScenePresentation;
  pacing: StoryPacingProfile;
  nextSceneIds: readonly JourneySceneId[];
};

export type JourneyChapter = {
  id: JourneyChapterId;
  title: string;
  dramaticFunction: string;
  biome: JourneyTechnicalBiome;
  sceneIds: readonly JourneySceneId[];
  entryIds: readonly string[];
  keystoneEntryIds: readonly string[];
  echoEntryIds: readonly string[];
  nextChapterId?: JourneyChapterId;
};

export type JourneyEntryContext = {
  chapterId: JourneyChapterId;
  sceneId: JourneySceneId;
  role: JourneyNarrativeEntryRole;
  chapterIndex: number;
  sceneIndex: number;
  entryIndex: number;
};

type AuthoredScene = Omit<
  JourneyScene,
  "chapterId" | "echoEntryIds" | "nextSceneIds" | "presentation" | "pacing"
>;

type AuthoredChapter = {
  id: JourneyChapterId;
  title: string;
  dramaticFunction: string;
  biome: JourneyTechnicalBiome;
  scenes: readonly AuthoredScene[];
};

// This catalogue is intentionally independent of archive tags and the six
// physical JourneyActs. Narrative meaning determines placement; technical
// regions remain a compatibility layer until authored geography consumes it.
const AUTHORED_NARRATIVE_CHAPTERS = [
  {
    id: "broken-floor",
    title: "Prologue — The Broken Floor",
    dramaticFunction: "Confession, fracture, and the first willingness to stand.",
    biome: "firstWood",
    scenes: [
      {
        id: "broken-floor.confession",
        title: "The Broken Floor",
        biome: "firstWood",
        role: "arrival",
        entryIds: ["fragment-001", "fragment-002"],
        keystoneEntryId: "fragment-001",
        environmentCue: "broken-floor-gives-way",
        audioCue: "broken-floor-confession",
      },
    ],
  },
  {
    id: "enchanted-wood",
    title: "The Enchanted Wood",
    dramaticFunction: "Attraction, warmth, friendship, and the first unspoken contradiction.",
    biome: "firstWood",
    scenes: [
      {
        id: "enchanted.rabbit-hole",
        title: "The Rabbit Hole",
        biome: "firstWood",
        role: "memory",
        entryIds: ["fragment-008", "fragment-003"],
        keystoneEntryId: "fragment-008",
        environmentCue: "enchanted-rabbit-hole-blooms",
        audioCue: "enchanted-curiosity",
      },
      {
        id: "enchanted.friendship-meadow",
        title: "The Friendship Meadow",
        biome: "firstWood",
        role: "memory",
        entryIds: ["fragment-010", "fragment-012"],
        keystoneEntryId: "fragment-010",
        environmentCue: "enchanted-meadow-warms",
        audioCue: "enchanted-friendship",
      },
      {
        id: "enchanted.masked-hearth",
        title: "The Masked Hearth",
        biome: "firstWood",
        role: "transition",
        entryIds: ["fragment-006", "fragment-009"],
        keystoneEntryId: "fragment-006",
        environmentCue: "enchanted-hearth-contradiction",
        audioCue: "wolf-swan-first-motif",
      },
    ],
  },
  {
    id: "blue-moon-sanctuary",
    title: "The Blue Moon Sanctuary",
    dramaticFunction: "Beauty, intimacy, safety, and the recognition that beauty can still be wrong.",
    biome: "archive",
    scenes: [
      {
        id: "blue-moon.sanctuary",
        title: "The Sanctuary",
        biome: "archive",
        role: "architectural",
        entryIds: ["fragment-060", "fragment-058", "fragment-049"],
        keystoneEntryId: "fragment-060",
        environmentCue: "blue-moon-sanctuary-awakens",
        audioCue: "blue-moon-sanctuary",
      },
      {
        id: "blue-moon.intimacy",
        title: "Powdered Wings",
        biome: "archive",
        role: "memory",
        entryIds: ["fragment-063", "fragment-061", "fragment-023"],
        keystoneEntryId: "fragment-063",
        environmentCue: "blue-moon-intimacy-reflects",
        audioCue: "swan-intimacy",
      },
      {
        id: "blue-moon.caged-bird",
        title: "The Caged Bird",
        biome: "archive",
        role: "transition",
        entryIds: ["fragment-062", "fragment-050"],
        keystoneEntryId: "fragment-062",
        environmentCue: "blue-moon-cage-becomes-visible",
        audioCue: "blue-moon-missing-note",
      },
    ],
  },
  {
    id: "nest",
    title: "The Nest",
    dramaticFunction: "Motherhood, protection, exhaustion, support, and the first owned key.",
    biome: "firstWood",
    scenes: [
      {
        id: "nest.two-hands",
        title: "Two Hands",
        biome: "firstWood",
        role: "ritual",
        entryIds: ["fragment-017", "fragment-014"],
        keystoneEntryId: "fragment-017",
        environmentCue: "nest-two-hands-balance",
        audioCue: "nest-protection",
      },
      {
        id: "nest.unsupported-cycle",
        title: "The Unsupported Cycle",
        biome: "firstWood",
        role: "memory",
        entryIds: ["fragment-026", "fragment-055"],
        keystoneEntryId: "fragment-026",
        environmentCue: "nest-weight-accumulates",
        audioCue: "nest-exhaustion",
      },
      {
        id: "nest.protection",
        title: "Protection",
        biome: "firstWood",
        role: "ritual",
        entryIds: ["fragment-051"],
        keystoneEntryId: "fragment-051",
        environmentCue: "nest-protection-key-awakens",
        audioCue: "key-protection",
      },
    ],
  },
  {
    id: "sunset-seer",
    title: "The Sunset Seer",
    dramaticFunction: "Warnings, words against actions, stillness, and the truth already known.",
    biome: "mirror",
    scenes: [
      {
        id: "sunset.warning-grove",
        title: "The Warning Grove",
        biome: "mirror",
        role: "reflection",
        entryIds: ["fragment-011", "fragment-039"],
        keystoneEntryId: "fragment-011",
        environmentCue: "sunset-seer-warnings-gather",
        audioCue: "seer-warning",
      },
      {
        id: "sunset.true-mirror",
        title: "The True Mirror",
        biome: "mirror",
        role: "reflection",
        entryIds: ["fragment-025", "fragment-029", "fragment-020"],
        keystoneEntryId: "fragment-025",
        environmentCue: "sunset-mirror-resolves",
        audioCue: "reflection-tells-truth",
      },
      {
        id: "sunset.stillness",
        title: "Stillness",
        biome: "mirror",
        role: "ritual",
        entryIds: ["fragment-040", "fragment-013"],
        keystoneEntryId: "fragment-040",
        environmentCue: "sunset-stillness-deepens",
        audioCue: "seer-stillness",
      },
    ],
  },
  {
    id: "thorned-house",
    title: "The Thorned House",
    dramaticFunction: "False sanctuary, compression, accommodation, and self-permission.",
    biome: "thorned",
    scenes: [
      {
        id: "thorned.locked-garden",
        title: "The Locked Garden",
        biome: "thorned",
        role: "architectural",
        entryIds: ["fragment-005", "fragment-007"],
        keystoneEntryId: "fragment-005",
        environmentCue: "thorned-house-locked-garden",
        audioCue: "keys-behind-walls",
      },
      {
        id: "thorned.old-memory-bedroom",
        title: "The Old-Memory Bedroom",
        biome: "thorned",
        role: "architectural",
        entryIds: ["fragment-032", "fragment-048", "fragment-031"],
        keystoneEntryId: "fragment-032",
        environmentCue: "thorned-house-compresses",
        audioCue: "house-old-memories",
      },
      {
        id: "thorned.self-owned-world",
        title: "The Self-Owned World",
        biome: "thorned",
        role: "transition",
        entryIds: ["fragment-054"],
        keystoneEntryId: "fragment-054",
        environmentCue: "thorned-house-exit-opens",
        audioCue: "self-permission-key",
      },
    ],
  },
  {
    id: "wolf-swan-seer",
    title: "Wolf, Swan & Seer",
    dramaticFunction: "Tenderness, boundary, and discernment integrated without a binary choice.",
    biome: "mirror",
    scenes: [
      {
        id: "wolf-swan.false-choice",
        title: "The False Choice",
        biome: "mirror",
        role: "memory",
        entryIds: ["fragment-027", "fragment-021", "fragment-024"],
        keystoneEntryId: "fragment-027",
        environmentCue: "wolf-swan-paths-converge",
        audioCue: "wolf-swan-counterpoint",
      },
      {
        id: "wolf-swan.convergence",
        title: "The Convergence",
        biome: "mirror",
        role: "ritual",
        entryIds: ["fragment-028", "fragment-064"],
        keystoneEntryId: "fragment-028",
        environmentCue: "seer-integrates-wolf-swan",
        audioCue: "three-aspects-resolve",
      },
    ],
  },
  {
    id: "fire-river",
    title: "Fire and River",
    dramaticFunction: "Boundary, grief, release, and surrender without erasing memory.",
    biome: "fireRiver",
    scenes: [
      {
        id: "fire.boundary",
        title: "The Boundary Fire",
        biome: "fireRiver",
        role: "ritual",
        entryIds: ["fragment-053", "fragment-004", "fragment-041", "fragment-036"],
        keystoneEntryId: "fragment-053",
        environmentCue: "fire-boundary-burns",
        audioCue: "boundary-fire",
      },
      {
        id: "river.wash",
        title: "The River Wash",
        biome: "fireRiver",
        role: "ritual",
        entryIds: ["fragment-034", "fragment-052"],
        keystoneEntryId: "fragment-034",
        environmentCue: "river-residue-clears",
        audioCue: "river-holds-memory",
      },
      {
        id: "river.release-surrender",
        title: "Release and Surrender",
        biome: "fireRiver",
        role: "ritual",
        entryIds: ["fragment-057"],
        keystoneEntryId: "fragment-057",
        environmentCue: "black-birds-depart-white-flag-rises",
        audioCue: "release-surrender",
      },
    ],
  },
  {
    id: "fork",
    title: "The Fork in the Woods",
    dramaticFunction: "Weighing the self, ending the loop, and taking ownership of the lantern.",
    biome: "firstWood",
    scenes: [
      {
        id: "fork.weighing",
        title: "The Weighing",
        biome: "firstWood",
        role: "ritual",
        entryIds: ["fragment-059", "fragment-037"],
        keystoneEntryId: "fragment-059",
        environmentCue: "fork-paths-wait",
        audioCue: "fork-weighing",
      },
      {
        id: "fork.four-verbs",
        title: "Four Verbs",
        biome: "firstWood",
        role: "ritual",
        entryIds: ["fragment-018", "fragment-016"],
        keystoneEntryId: "fragment-018",
        environmentCue: "fork-actions-enter-world",
        audioCue: "let-go-decline-depart-delete",
      },
      {
        id: "fork.relinquish-hope",
        title: "Relinquish Hope",
        biome: "firstWood",
        role: "transition",
        entryIds: ["fragment-056"],
        keystoneEntryId: "fragment-056",
        environmentCue: "fork-owned-lantern-brightens",
        audioCue: "hope-loop-ends",
      },
    ],
  },
  {
    id: "three-climbs",
    title: "The Three Climbs",
    dramaticFunction: "Mind, heart, and womb faced as distinct climbs into sovereignty.",
    biome: "crowned",
    scenes: [
      {
        id: "climbs.arrival",
        title: "Three Climbs Ahead",
        biome: "crowned",
        role: "arrival",
        entryIds: ["fragment-043", "fragment-015"],
        keystoneEntryId: "fragment-043",
        environmentCue: "three-climbs-reveal",
        audioCue: "climbs-arrival",
      },
      {
        id: "climb.mind",
        title: "The Mind",
        biome: "crowned",
        role: "climb",
        entryIds: ["fragment-022"],
        keystoneEntryId: "fragment-022",
        environmentCue: "mind-climb-questions-fade",
        audioCue: "mind-climb",
      },
      {
        id: "climb.heart",
        title: "The Heart",
        biome: "crowned",
        role: "climb",
        entryIds: ["fragment-030"],
        keystoneEntryId: "fragment-030",
        environmentCue: "heart-climb-sanctuary-visible",
        audioCue: "heart-climb",
      },
      {
        id: "climb.womb",
        title: "The Womb",
        biome: "crowned",
        role: "climb",
        entryIds: ["fragment-066", "fragment-042"],
        keystoneEntryId: "fragment-066",
        environmentCue: "womb-climb-creation-opens",
        audioCue: "womb-climb",
      },
    ],
  },
  {
    id: "crowned-return",
    title: "The Crowned Return",
    dramaticFunction: "A self-owned crown, an already-whole home, and room without dependence.",
    biome: "crowned",
    scenes: [
      {
        id: "crowned.threshold",
        title: "The Crowned Threshold",
        biome: "crowned",
        role: "transition",
        entryIds: ["fragment-035", "fragment-065"],
        keystoneEntryId: "fragment-035",
        environmentCue: "crowned-gate-recognises-key",
        audioCue: "crowned-threshold",
      },
      {
        id: "crowned.home",
        title: "The Home She Made",
        biome: "crowned",
        role: "architectural",
        entryIds: ["fragment-038", "fragment-019"],
        keystoneEntryId: "fragment-038",
        environmentCue: "crowned-home-becomes-whole",
        audioCue: "crowned-home",
      },
      {
        id: "crowned.sovereignty",
        title: "Sovereignty",
        biome: "crowned",
        role: "finale",
        entryIds: ["fragment-044"],
        keystoneEntryId: "fragment-044",
        environmentCue: "crown-waits-unclaimed",
        audioCue: "crown-self-owned",
      },
    ],
  },
  {
    id: "lantern-epilogue",
    title: "Epilogue — The Lanterns Left Along the Way",
    dramaticFunction: "The travelled world gathers into a constellation of remembered light.",
    biome: "crowned",
    scenes: [
      {
        id: "epilogue.constellation",
        title: "The Lantern Constellation",
        biome: "crowned",
        role: "finale",
        entryIds: ["fragment-046", "fragment-045", "fragment-033", "fragment-047"],
        keystoneEntryId: "fragment-046",
        environmentCue: "lantern-constellation-completes",
        audioCue: "lantern-epilogue",
      },
    ],
  },
] as const satisfies readonly AuthoredChapter[];

type AuthoredSceneExperience = {
  presentation: JourneyScenePresentation;
  pacing: StoryPacingProfile;
};

const AUTHORED_SCENE_EXPERIENCE = {
  "broken-floor.confession": {
    presentation: {
      arrivalLine: "Water first. Then the shape of trees inside it.",
      guidanceLines: ["The reflection is keeping something.", "The light has moved ahead."],
      completionLine: "The room gives way to the wood.",
      silenceAfterCompletionMs: 3_600,
      chapterTitleTreatment: "full",
      proseTreatment: "reflected",
    },
    pacing: { arrivalQuietMs: 2_700, minimumContemplationMs: 7_500, completionQuietMs: 3_600, interactionDensity: "low", guidanceDelayMs: 28_000, transitionStyle: "reflection" },
  },
  "enchanted.rabbit-hole": {
    presentation: {
      arrivalLine: "Warmth gathers between the trees.",
      guidanceLines: ["A small light moves deeper into the leaves."],
      completionLine: "The path keeps the warmth and continues.",
      chapterTitleTreatment: "subtle",
      proseTreatment: "ambient",
    },
    pacing: { arrivalQuietMs: 2_200, minimumContemplationMs: 5_500, completionQuietMs: 2_400, interactionDensity: "none", guidanceDelayMs: 32_000, transitionStyle: "walk" },
  },
  "enchanted.friendship-meadow": {
    presentation: {
      arrivalLine: "The clearing has made room.",
      guidanceLines: ["The leaves turn toward the quieter path."],
      completionLine: "The meadow remains warm behind you.",
      chapterTitleTreatment: "none",
      proseTreatment: "ambient",
    },
    pacing: { arrivalQuietMs: 2_000, minimumContemplationMs: 6_000, completionQuietMs: 2_400, interactionDensity: "none", guidanceDelayMs: 34_000, transitionStyle: "walk" },
  },
  "enchanted.masked-hearth": {
    presentation: {
      arrivalLine: "Something in the warmth no longer settles.",
      guidanceLines: ["The firelight leans away from the hearth."],
      completionLine: "The contradiction follows without explanation.",
      chapterTitleTreatment: "none",
      proseTreatment: "ambient",
    },
    pacing: { arrivalQuietMs: 2_600, minimumContemplationMs: 6_500, completionQuietMs: 3_200, interactionDensity: "low", guidanceDelayMs: 36_000, transitionStyle: "environment" },
  },
  "blue-moon.sanctuary": {
    presentation: {
      arrivalLine: "The bridge enters blue light.",
      guidanceLines: ["Candles are waiting beside the water.", "The Swan crosses the reflection without hurry."],
      completionLine: "The sanctuary is beautiful before it is questioned.",
      silenceAfterCompletionMs: 3_800,
      chapterTitleTreatment: "full",
      proseTreatment: "water",
    },
    pacing: { arrivalQuietMs: 4_200, minimumContemplationMs: 10_000, completionQuietMs: 3_800, interactionDensity: "low", guidanceDelayMs: 42_000, transitionStyle: "environment" },
  },
  "blue-moon.intimacy": {
    presentation: {
      arrivalLine: "Moonlight rests on fabric, flowers, and water.",
      guidanceLines: ["The Swan has moved beyond the candles.", "One reflection arrives a breath late."],
      completionLine: "The first inconsistency remains small enough to notice.",
      chapterTitleTreatment: "none",
      proseTreatment: "water",
    },
    pacing: { arrivalQuietMs: 3_800, minimumContemplationMs: 11_000, completionQuietMs: 4_200, interactionDensity: "focused", guidanceDelayMs: 45_000, transitionStyle: "reflection" },
  },
  "blue-moon.caged-bird": {
    presentation: {
      arrivalLine: "The same beauty now holds a second shape.",
      guidanceLines: ["The quiet has gathered around the closed door."],
      completionLine: "The Swan is no less beautiful for being seen clearly.",
      silenceAfterCompletionMs: 4_600,
      chapterTitleTreatment: "none",
      proseTreatment: "reflected",
    },
    pacing: { arrivalQuietMs: 3_500, minimumContemplationMs: 9_000, completionQuietMs: 4_600, interactionDensity: "low", guidanceDelayMs: 46_000, transitionStyle: "silence" },
  },
  "nest.two-hands": {
    presentation: {
      arrivalLine: "Morning has reached the small shelter.",
      guidanceLines: ["A soft sound comes from beneath the canopy."],
      completionLine: "The tenderness remains sacred.",
      chapterTitleTreatment: "subtle",
      proseTreatment: "ambient",
    },
    pacing: { arrivalQuietMs: 3_400, minimumContemplationMs: 8_000, completionQuietMs: 3_400, interactionDensity: "ritual", guidanceDelayMs: 40_000, transitionStyle: "environment" },
  },
  "nest.unsupported-cycle": {
    presentation: {
      arrivalLine: "The shelter is warm. The carrying has weight.",
      guidanceLines: ["Tiny footprints continue toward the open side."],
      completionLine: "Love and unsupported carrying are not the same thing.",
      chapterTitleTreatment: "none",
      proseTreatment: "ambient",
    },
    pacing: { arrivalQuietMs: 3_000, minimumContemplationMs: 8_500, completionQuietMs: 3_600, interactionDensity: "none", guidanceDelayMs: 42_000, transitionStyle: "walk" },
  },
  "nest.protection": {
    presentation: {
      arrivalLine: "The key is already inside the shelter.",
      guidanceLines: ["Warm light gathers around the place kept safe."],
      completionLine: "Protection stays with the one who carries it.",
      chapterTitleTreatment: "none",
      proseTreatment: "ambient",
    },
    pacing: { arrivalQuietMs: 2_800, minimumContemplationMs: 7_000, completionQuietMs: 4_000, interactionDensity: "ritual", guidanceDelayMs: 42_000, transitionStyle: "environment" },
  },
  "sunset.warning-grove": {
    presentation: {
      arrivalLine: "Direct sight leaves part of the clearing unread.",
      guidanceLines: ["The surface stills when the path does."],
      completionLine: "The warning remains in the reflection.",
      chapterTitleTreatment: "subtle",
      proseTreatment: "reflected",
    },
    pacing: { arrivalQuietMs: 3_800, minimumContemplationMs: 8_500, completionQuietMs: 3_400, interactionDensity: "none", guidanceDelayMs: 48_000, transitionStyle: "reflection" },
  },
  "sunset.true-mirror": {
    presentation: {
      arrivalLine: "The mirror keeps what movement scatters.",
      guidanceLines: ["The water has become quieter than the trees."],
      completionLine: "The reflected path is now readable.",
      chapterTitleTreatment: "none",
      proseTreatment: "reflected",
    },
    pacing: { arrivalQuietMs: 3_500, minimumContemplationMs: 9_000, completionQuietMs: 3_800, interactionDensity: "low", guidanceDelayMs: 52_000, transitionStyle: "reflection" },
  },
  "sunset.stillness": {
    presentation: {
      arrivalLine: "Nothing here needs to be hurried.",
      guidanceLines: ["The last ripple is almost gone."],
      completionLine: "Stillness leaves the truth undisturbed.",
      silenceAfterCompletionMs: 4_800,
      chapterTitleTreatment: "none",
      proseTreatment: "reflected",
    },
    pacing: { arrivalQuietMs: 4_000, minimumContemplationMs: 9_500, completionQuietMs: 4_800, interactionDensity: "ritual", guidanceDelayMs: 58_000, transitionStyle: "silence" },
  },
  "thorned.locked-garden": {
    presentation: {
      arrivalLine: "The house is warm enough to enter.",
      guidanceLines: ["One door has been left open."],
      completionLine: "The rooms begin to keep their own measure.",
      chapterTitleTreatment: "subtle",
      proseTreatment: "wall",
    },
    pacing: { arrivalQuietMs: 3_200, minimumContemplationMs: 8_000, completionQuietMs: 3_500, interactionDensity: "low", guidanceDelayMs: 40_000, transitionStyle: "walk" },
  },
  "thorned.old-memory-bedroom": {
    presentation: {
      arrivalLine: "The corridor has narrowed without announcing it.",
      guidanceLines: ["A little exterior sound remains beyond the next room."],
      completionLine: "The space refills when accommodation stops.",
      chapterTitleTreatment: "none",
      proseTreatment: "wall",
    },
    pacing: { arrivalQuietMs: 3_200, minimumContemplationMs: 9_500, completionQuietMs: 4_000, interactionDensity: "focused", guidanceDelayMs: 45_000, transitionStyle: "environment" },
  },
  "thorned.self-owned-world": {
    presentation: {
      arrivalLine: "The exit does not require the house to disappear.",
      guidanceLines: ["Outside sound has returned to one doorway."],
      completionLine: "The house remains. The path does not.",
      silenceAfterCompletionMs: 4_000,
      chapterTitleTreatment: "none",
      proseTreatment: "wall",
    },
    pacing: { arrivalQuietMs: 3_000, minimumContemplationMs: 7_500, completionQuietMs: 4_000, interactionDensity: "focused", guidanceDelayMs: 42_000, transitionStyle: "walk" },
  },
  "wolf-swan.false-choice": {
    presentation: {
      arrivalLine: "Water and roots meet in the same clearing.",
      guidanceLines: ["One presence waits near water. Another keeps to the roots."],
      completionLine: "Tenderness and boundary have both been witnessed.",
      chapterTitleTreatment: "subtle",
      proseTreatment: "ambient",
    },
    pacing: { arrivalQuietMs: 3_500, minimumContemplationMs: 8_500, completionQuietMs: 3_800, interactionDensity: "focused", guidanceDelayMs: 48_000, transitionStyle: "environment" },
  },
  "wolf-swan.convergence": {
    presentation: {
      arrivalLine: "The third presence waits where the paths meet.",
      guidanceLines: ["The centre of the clearing has become still."],
      completionLine: "No part has to defeat another.",
      silenceAfterCompletionMs: 4_200,
      chapterTitleTreatment: "none",
      proseTreatment: "ambient",
    },
    pacing: { arrivalQuietMs: 3_600, minimumContemplationMs: 8_000, completionQuietMs: 4_200, interactionDensity: "ritual", guidanceDelayMs: 50_000, transitionStyle: "silence" },
  },
  "fire.boundary": {
    presentation: {
      arrivalLine: "The fire path is narrow and direct.",
      guidanceLines: ["Heat gathers along one edge of the clearing."],
      completionLine: "What entered the flame remains as ember.",
      chapterTitleTreatment: "subtle",
      proseTreatment: "ash",
    },
    pacing: { arrivalQuietMs: 3_200, minimumContemplationMs: 8_000, completionQuietMs: 3_800, interactionDensity: "ritual", guidanceDelayMs: 42_000, transitionStyle: "environment" },
  },
  "river.wash": {
    presentation: {
      arrivalLine: "The river makes a wider place for grief.",
      guidanceLines: ["The current brightens beyond the stones."],
      completionLine: "The water continues without erasing what it held.",
      chapterTitleTreatment: "none",
      proseTreatment: "water",
    },
    pacing: { arrivalQuietMs: 3_500, minimumContemplationMs: 9_000, completionQuietMs: 4_000, interactionDensity: "ritual", guidanceDelayMs: 46_000, transitionStyle: "walk" },
  },
  "river.release-surrender": {
    presentation: {
      arrivalLine: "The birds rise. Everything else becomes quiet.",
      guidanceLines: [],
      completionLine: "The white fabric remains in the clearing.",
      silenceAfterCompletionMs: 6_000,
      chapterTitleTreatment: "none",
      proseTreatment: "ambient",
    },
    pacing: { arrivalQuietMs: 4_500, minimumContemplationMs: 10_000, completionQuietMs: 6_000, interactionDensity: "ritual", guidanceDelayMs: 90_000, transitionStyle: "silence" },
  },
  "fork.weighing": {
    presentation: {
      arrivalLine: "The old path sounds familiar from here.",
      guidanceLines: ["The unknown side has kept one quiet opening."],
      completionLine: "Every remembered self is allowed into the pause.",
      chapterTitleTreatment: "subtle",
      proseTreatment: "ambient",
    },
    pacing: { arrivalQuietMs: 4_200, minimumContemplationMs: 9_500, completionQuietMs: 4_200, interactionDensity: "ritual", guidanceDelayMs: 52_000, transitionStyle: "silence" },
  },
  "fork.four-verbs": {
    presentation: {
      arrivalLine: "Only the next act is visible.",
      guidanceLines: ["The light has moved to one object in the clearing."],
      completionLine: "The known path has gone dark.",
      chapterTitleTreatment: "none",
      proseTreatment: "ambient",
    },
    pacing: { arrivalQuietMs: 3_200, minimumContemplationMs: 9_000, completionQuietMs: 4_000, interactionDensity: "focused", guidanceDelayMs: 46_000, transitionStyle: "environment" },
  },
  "fork.relinquish-hope": {
    presentation: {
      arrivalLine: "The waiting light no longer pulls.",
      guidanceLines: ["The lantern has become steady."],
      completionLine: "The light follows intention now.",
      silenceAfterCompletionMs: 4_600,
      chapterTitleTreatment: "none",
      proseTreatment: "ambient",
    },
    pacing: { arrivalQuietMs: 3_600, minimumContemplationMs: 8_000, completionQuietMs: 4_600, interactionDensity: "focused", guidanceDelayMs: 50_000, transitionStyle: "environment" },
  },
  "climbs.arrival": {
    presentation: {
      arrivalLine: "One ascent opens in three movements.",
      guidanceLines: ["The path continues upward through the nearest rise."],
      completionLine: "The forest is visible below.",
      chapterTitleTreatment: "subtle",
      proseTreatment: "ambient",
    },
    pacing: { arrivalQuietMs: 3_800, minimumContemplationMs: 7_500, completionQuietMs: 3_500, interactionDensity: "none", guidanceDelayMs: 46_000, transitionStyle: "walk" },
  },
  "climb.mind": {
    presentation: {
      arrivalLine: "Questions gather along the path.",
      guidanceLines: ["The questions do not block the next step."],
      completionLine: "The unanswered words remain behind.",
      chapterTitleTreatment: "none",
      proseTreatment: "ambient",
    },
    pacing: { arrivalQuietMs: 3_200, minimumContemplationMs: 8_500, completionQuietMs: 3_800, interactionDensity: "low", guidanceDelayMs: 48_000, transitionStyle: "walk" },
  },
  "climb.heart": {
    presentation: {
      arrivalLine: "Several true things wait without asking to be named.",
      guidanceLines: ["One remembered object has caught the light."],
      completionLine: "One memory travels onward without becoming a dwelling.",
      chapterTitleTreatment: "none",
      proseTreatment: "water",
    },
    pacing: { arrivalQuietMs: 3_800, minimumContemplationMs: 9_000, completionQuietMs: 4_000, interactionDensity: "focused", guidanceDelayMs: 50_000, transitionStyle: "environment" },
  },
  "climb.womb": {
    presentation: {
      arrivalLine: "The future has not been written into this space.",
      guidanceLines: ["A protected opening remains ahead."],
      completionLine: "There is room for what can still be made.",
      silenceAfterCompletionMs: 4_400,
      chapterTitleTreatment: "none",
      proseTreatment: "ambient",
    },
    pacing: { arrivalQuietMs: 4_000, minimumContemplationMs: 9_000, completionQuietMs: 4_400, interactionDensity: "focused", guidanceDelayMs: 54_000, transitionStyle: "silence" },
  },
  "crowned.threshold": {
    presentation: {
      arrivalLine: "The gate opens onto a home already whole.",
      guidanceLines: ["Open light is resting beyond the gate."],
      completionLine: "Nothing inside is waiting to confer permission.",
      chapterTitleTreatment: "subtle",
      proseTreatment: "ambient",
    },
    pacing: { arrivalQuietMs: 4_200, minimumContemplationMs: 9_500, completionQuietMs: 4_200, interactionDensity: "none", guidanceDelayMs: 58_000, transitionStyle: "walk" },
  },
  "crowned.home": {
    presentation: {
      arrivalLine: "Water, books, roses, and quiet have found their places.",
      guidanceLines: ["The mirror keeps one small change."],
      completionLine: "One beautiful space remains simply available.",
      chapterTitleTreatment: "none",
      proseTreatment: "ambient",
    },
    pacing: { arrivalQuietMs: 4_800, minimumContemplationMs: 11_000, completionQuietMs: 4_800, interactionDensity: "none", guidanceDelayMs: 64_000, transitionStyle: "environment" },
  },
  "crowned.sovereignty": {
    presentation: {
      arrivalLine: "The crown is visible only in reflection.",
      guidanceLines: ["The mirror is holding the last recognition."],
      completionLine: "Nothing here has awarded what was already hers.",
      silenceAfterCompletionMs: 5_200,
      chapterTitleTreatment: "none",
      proseTreatment: "reflected",
    },
    pacing: { arrivalQuietMs: 4_800, minimumContemplationMs: 10_000, completionQuietMs: 5_200, interactionDensity: "low", guidanceDelayMs: 66_000, transitionStyle: "reflection" },
  },
  "epilogue.constellation": {
    presentation: {
      arrivalLine: "The lantern can remain lit without being carried.",
      guidanceLines: ["The view is opening behind the flame."],
      completionLine: "The route becomes visible because it has been walked.",
      silenceAfterCompletionMs: 7_000,
      chapterTitleTreatment: "none",
      proseTreatment: "constellation",
    },
    pacing: { arrivalQuietMs: 5_000, minimumContemplationMs: 12_000, completionQuietMs: 7_000, interactionDensity: "ritual", guidanceDelayMs: 72_000, transitionStyle: "silence" },
  },
} as const satisfies Record<JourneySceneId, AuthoredSceneExperience>;

const authoredChapters: readonly AuthoredChapter[] = AUTHORED_NARRATIVE_CHAPTERS;
const authoredScenes = authoredChapters.flatMap((chapter) =>
  chapter.scenes.map((scene) => ({
    ...scene,
    ...AUTHORED_SCENE_EXPERIENCE[scene.id],
    chapterId: chapter.id,
  })),
);

export const journeyScenes = authoredScenes.map((scene, sceneIndex) => ({
  ...scene,
  echoEntryIds: scene.entryIds.filter((entryId) => entryId !== scene.keystoneEntryId),
  nextSceneIds: authoredScenes[sceneIndex + 1]
    ? [authoredScenes[sceneIndex + 1].id]
    : [],
})) as readonly JourneyScene[];

const SCENE_BY_ID = new Map(journeyScenes.map((scene) => [scene.id, scene]));

export const journeyChapters = authoredChapters.map((chapter, chapterIndex) => {
  const scenes = chapter.scenes.map((scene) => SCENE_BY_ID.get(scene.id)).filter(
    (scene): scene is JourneyScene => Boolean(scene),
  );
  const entryIds = scenes.flatMap((scene) => scene.entryIds);
  const keystoneEntryIds = scenes.map((scene) => scene.keystoneEntryId);
  const keystoneSet = new Set(keystoneEntryIds);
  return {
    id: chapter.id,
    title: chapter.title,
    dramaticFunction: chapter.dramaticFunction,
    biome: chapter.biome,
    sceneIds: scenes.map((scene) => scene.id),
    entryIds,
    keystoneEntryIds,
    echoEntryIds: entryIds.filter((entryId) => !keystoneSet.has(entryId)),
    nextChapterId: authoredChapters[chapterIndex + 1]?.id,
  } satisfies JourneyChapter;
}) as readonly JourneyChapter[];

const CHAPTER_BY_ID = new Map(journeyChapters.map((chapter) => [chapter.id, chapter]));

export const JOURNEY_ENTRY_CONTEXT = Object.fromEntries(
  journeyChapters.flatMap((chapter, chapterIndex) =>
    chapter.sceneIds.flatMap((sceneId, sceneIndex) => {
      const scene = SCENE_BY_ID.get(sceneId);
      if (!scene) return [];
      return scene.entryIds.map((entryId, entryIndex) => [
        entryId,
        {
          chapterId: chapter.id,
          sceneId,
          role: entryId === scene.keystoneEntryId ? "keystone" : "echo",
          chapterIndex,
          sceneIndex,
          entryIndex,
        } satisfies JourneyEntryContext,
      ] as const);
    }),
  ),
) as Readonly<Record<string, JourneyEntryContext>>;

export const JOURNEY_NARRATIVE_ANCHORS = [
  { entryId: "fragment-001", chapterId: "broken-floor", sceneId: "broken-floor.confession" },
  { entryId: "fragment-060", chapterId: "blue-moon-sanctuary", sceneId: "blue-moon.sanctuary" },
  { entryId: "fragment-017", chapterId: "nest", sceneId: "nest.two-hands" },
  { entryId: "fragment-025", chapterId: "sunset-seer", sceneId: "sunset.true-mirror" },
  { entryId: "fragment-027", chapterId: "wolf-swan-seer", sceneId: "wolf-swan.false-choice" },
  { entryId: "fragment-053", chapterId: "fire-river", sceneId: "fire.boundary" },
  { entryId: "fragment-018", chapterId: "fork", sceneId: "fork.four-verbs" },
  { entryId: "fragment-043", chapterId: "three-climbs", sceneId: "climbs.arrival" },
  { entryId: "fragment-044", chapterId: "crowned-return", sceneId: "crowned.sovereignty" },
  { entryId: "fragment-046", chapterId: "lantern-epilogue", sceneId: "epilogue.constellation" },
] as const satisfies readonly {
  entryId: string;
  chapterId: JourneyChapterId;
  sceneId: JourneySceneId;
}[];

export function getJourneyChapter(chapterId: JourneyChapterId) {
  return CHAPTER_BY_ID.get(chapterId);
}

export function getJourneyScene(sceneId: JourneySceneId) {
  return SCENE_BY_ID.get(sceneId);
}

export function getJourneyEntryContext(entryId: string) {
  return JOURNEY_ENTRY_CONTEXT[entryId];
}

export function getJourneyChapterForEntry(entryId: string) {
  const context = getJourneyEntryContext(entryId);
  return context ? CHAPTER_BY_ID.get(context.chapterId) : undefined;
}

export function getJourneySceneForEntry(entryId: string) {
  const context = getJourneyEntryContext(entryId);
  return context ? SCENE_BY_ID.get(context.sceneId) : undefined;
}

export function validateNarrativeJourneyBlueprint(validEntryIds: readonly string[]) {
  const issues: string[] = [];
  const expectedEntryIds = new Set(validEntryIds);
  const assignedEntryIds = new Set<string>();
  const assignedSceneIds = new Set<JourneySceneId>();

  if (journeyChapters.length !== JOURNEY_CHAPTER_IDS.length) {
    issues.push(`expected ${JOURNEY_CHAPTER_IDS.length} narrative chapters, found ${journeyChapters.length}`);
  }
  JOURNEY_CHAPTER_IDS.forEach((chapterId, index) => {
    if (journeyChapters[index]?.id !== chapterId) {
      issues.push(`narrative chapter ${index + 1} must be ${chapterId}`);
    }
  });

  if (journeyScenes.length !== JOURNEY_SCENE_IDS.length) {
    issues.push(`expected ${JOURNEY_SCENE_IDS.length} authored scenes, found ${journeyScenes.length}`);
  }
  JOURNEY_SCENE_IDS.forEach((sceneId, index) => {
    if (journeyScenes[index]?.id !== sceneId) {
      issues.push(`authored scene ${index + 1} must be ${sceneId}`);
    }
  });

  for (const chapter of journeyChapters) {
    for (const sceneId of chapter.sceneIds) {
      const scene = SCENE_BY_ID.get(sceneId);
      if (!scene) {
        issues.push(`${chapter.id} references missing scene ${sceneId}`);
        continue;
      }
      if (assignedSceneIds.has(sceneId)) issues.push(`${sceneId} is assigned to more than one chapter`);
      assignedSceneIds.add(sceneId);
      if (scene.chapterId !== chapter.id) {
        issues.push(`${sceneId} belongs to ${scene.chapterId}, not ${chapter.id}`);
      }
      if (scene.entryIds.length === 0) issues.push(`${sceneId} has no archive fragments`);
      if (!scene.entryIds.includes(scene.keystoneEntryId)) {
        issues.push(`${sceneId} does not contain its keystone ${scene.keystoneEntryId}`);
      }
      for (const entryId of scene.entryIds) {
        if (!expectedEntryIds.has(entryId)) issues.push(`${sceneId} references unknown entry ${entryId}`);
        if (assignedEntryIds.has(entryId)) issues.push(`${entryId} is assigned to more than one narrative scene`);
        assignedEntryIds.add(entryId);
        const context = JOURNEY_ENTRY_CONTEXT[entryId];
        if (!context || context.chapterId !== chapter.id || context.sceneId !== scene.id) {
          issues.push(`${entryId} has inconsistent narrative context`);
        }
      }
    }
  }

  if (assignedEntryIds.size !== 66) {
    issues.push(`the narrative blueprint must assign 66 unique entries, found ${assignedEntryIds.size}`);
  }
  for (const entryId of expectedEntryIds) {
    if (!assignedEntryIds.has(entryId)) issues.push(`${entryId} is missing from the narrative blueprint`);
  }

  const keystoneCount = journeyScenes.length;
  if (keystoneCount < 24 || keystoneCount > 32) {
    issues.push(`the narrative journey must contain 24-32 keystone memories, found ${keystoneCount}`);
  }

  if (
    journeyChapters[0]?.id !== "broken-floor" ||
    journeyScenes[0]?.id !== "broken-floor.confession" ||
    journeyScenes[0]?.entryIds[0] !== "fragment-001"
  ) {
    issues.push("fragment-001 must open the broken-floor confession scene");
  }

  for (const anchor of JOURNEY_NARRATIVE_ANCHORS) {
    const context = JOURNEY_ENTRY_CONTEXT[anchor.entryId];
    if (
      context?.chapterId !== anchor.chapterId ||
      context.sceneId !== anchor.sceneId ||
      context.role !== "keystone"
    ) {
      issues.push(`${anchor.entryId} must remain the keystone of ${anchor.sceneId}`);
    }
  }

  for (const [sceneIndex, scene] of journeyScenes.entries()) {
    const expectedNext = journeyScenes[sceneIndex + 1]?.id;
    const actualNext = scene.nextSceneIds[0];
    if (scene.nextSceneIds.length > (expectedNext ? 1 : 0) || actualNext !== expectedNext) {
      issues.push(`${scene.id} does not follow the canonical authored scene order`);
    }
  }

  return issues;
}

export {
  JOURNEY_CHAPTER_IDS,
  JOURNEY_SCENE_IDS,
};
export type {
  JourneyChapterId,
  JourneySceneId,
};
