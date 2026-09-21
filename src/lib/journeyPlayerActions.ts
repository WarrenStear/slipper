import type { JourneySceneId } from "./storyJourneyState.ts";

/**
 * Story actions are the small, embodied decisions that belong to the authored
 * chapter spaces. They intentionally stay separate from the nine ceremonial
 * rituals: an action changes what the player has physically done, while a
 * ritual marks one of the story's larger transformations.
 */
export type JourneyPlayerActionMode =
  | "press"
  | "hold"
  | "dual-hold"
  | "stillness"
  | "move"
  | "turn-and-move"
  | "choice";

export type JourneyPlayerActionOutcome =
  | { type: "set-world-flag"; flagId: string }
  | { type: "collect-symbolic-object"; objectId: string }
  | { type: "award-lantern" };

export type JourneyPlayerActionChoice = {
  id: string;
  label: string;
  meaning: string;
  target: JourneyPlayerActionTarget;
  outcomes: readonly JourneyPlayerActionOutcome[];
};

export type JourneyPlayerActionTarget = {
  /** X/Z position in the target frame's authored local space. */
  localPosition: readonly [number, number];
  radius: number;
  label: string;
  /** Arrival-facing props are rotated toward the route entry inside the scene. */
  frame?: "scene" | "arrival";
};

export type JourneyPlayerAction = {
  id: string;
  sceneId: JourneySceneId;
  mode: JourneyPlayerActionMode;
  verb: string;
  label: string;
  instruction: string;
  completionFlagIds: readonly string[];
  requiredFlagIds?: readonly string[];
  durationMs?: number;
  distance?: number;
  turnRadians?: number;
  target?: JourneyPlayerActionTarget;
  keyCodes?: readonly string[];
  choices?: readonly JourneyPlayerActionChoice[];
  outcomes?: readonly JourneyPlayerActionOutcome[];
  rememberedAs: string;
};

const HEART_CHOICE_FLAG = "climb.heart.memory-chosen";
const WOMB_CHOICE_FLAG = "climb.womb.creation-chosen";

export const HEART_MEMORY_WORLD_TARGETS = {
  "heart.tenderness": {
    localPosition: [-2.45, 4.25],
    radius: 1.2,
    label: "the blush rose",
    frame: "arrival",
  },
  "heart.beauty": {
    localPosition: [0, 4.65],
    radius: 1.2,
    label: "the Swan feather",
    frame: "arrival",
  },
  "heart.selfhood": {
    localPosition: [2.45, 4.25],
    radius: 1.2,
    label: "the Blue Moon reflection",
    frame: "arrival",
  },
} as const satisfies Readonly<Record<string, JourneyPlayerActionTarget>>;

export const WOMB_FUTURE_WORLD_TARGETS = {
  "future.rest": {
    localPosition: [-2.05, 4.25],
    radius: 1.05,
    label: "the folded linen",
    frame: "arrival",
  },
  "future.home": {
    localPosition: [0, 4.65],
    radius: 1.05,
    label: "the lit threshold",
    frame: "arrival",
  },
  "future.voice": {
    localPosition: [2.05, 4.25],
    radius: 1.05,
    label: "the unwritten page",
    frame: "arrival",
  },
} as const satisfies Readonly<Record<string, JourneyPlayerActionTarget>>;

export const JOURNEY_PLAYER_ACTIONS = [
  {
    id: "action.blue-moon.light-candles",
    sceneId: "blue-moon.sanctuary",
    mode: "hold",
    verb: "light",
    label: "Wake the candle path",
    instruction: "Approach the waiting candles and hold E until their warmth reaches the bridge.",
    completionFlagIds: ["blue-moon.candles-lit"],
    durationMs: 1_200,
    keyCodes: ["KeyE"],
    target: { localPosition: [-4.2, -2], radius: 2.2, label: "the candle path" },
    outcomes: [{ type: "set-world-flag", flagId: "blue-moon.candles-lit" }],
    rememberedAs: "The candle path answered with warmth.",
  },
  {
    id: "action.blue-moon.touch-water",
    sceneId: "blue-moon.sanctuary",
    mode: "press",
    verb: "touch",
    label: "Touch the moonlit water",
    instruction: "Move to the water's edge and press E. Let beauty be true before asking what it conceals.",
    completionFlagIds: ["blue-moon.water-touched"],
    requiredFlagIds: ["blue-moon.candles-lit"],
    keyCodes: ["KeyE"],
    target: { localPosition: [4.2, 1.8], radius: 2.15, label: "the water's edge" },
    outcomes: [{ type: "set-world-flag", flagId: "blue-moon.water-touched" }],
    rememberedAs: "The Blue Moon remained beautiful in the water.",
  },
  {
    id: "action.blue-moon.follow-swan",
    sceneId: "blue-moon.intimacy",
    mode: "move",
    verb: "follow",
    label: "Follow the quiet swan",
    instruction: "Approach the swan, then walk with it rather than pulling it toward you.",
    completionFlagIds: ["blue-moon.swan-followed"],
    distance: 1,
    target: { localPosition: [-4.2, 3.2], radius: 2.2, label: "the swan" },
    outcomes: [{ type: "set-world-flag", flagId: "blue-moon.swan-followed" }],
    rememberedAs: "The swan led without promising escape.",
  },
  {
    id: "action.blue-moon.place-flowers",
    sceneId: "blue-moon.intimacy",
    mode: "hold",
    verb: "place",
    label: "Place the blush roses",
    instruction: "At the pavilion, hold E. Tenderness may be honoured without becoming a cage.",
    completionFlagIds: ["blue-moon.flowers-placed"],
    requiredFlagIds: ["blue-moon.swan-followed"],
    durationMs: 1_150,
    keyCodes: ["KeyE"],
    target: { localPosition: [3.6, 4.8], radius: 2, label: "the flower table" },
    outcomes: [{ type: "set-world-flag", flagId: "blue-moon.flowers-placed" }],
    rememberedAs: "The flowers held the tenderness without holding her there.",
  },
  {
    id: "action.blue-moon.open-door",
    sceneId: "blue-moon.intimacy",
    mode: "press",
    verb: "open",
    label: "Open the beautiful door",
    instruction: "Approach the pale door and press E. Notice what the reflection reveals a moment late.",
    completionFlagIds: ["blue-moon.beautiful-door-open"],
    requiredFlagIds: ["blue-moon.flowers-placed"],
    keyCodes: ["KeyE"],
    target: { localPosition: [0, 5.8], radius: 2, label: "the beautiful door" },
    outcomes: [{ type: "set-world-flag", flagId: "blue-moon.beautiful-door-open" }],
    rememberedAs: "The beautiful door opened; its reflected lock remained visible.",
  },
  {
    id: "action.nest.two-hands",
    sceneId: "nest.two-hands",
    mode: "dual-hold",
    verb: "hold and keep",
    label: "Two hands, together",
    instruction: "Hold Q and E together, or keep both touch points held. One hand holds; one hand keeps safe.",
    completionFlagIds: ["nest.hand-held", "nest.hand-kept"],
    durationMs: 1_800,
    keyCodes: ["KeyQ", "KeyE"],
    outcomes: [
      { type: "set-world-flag", flagId: "nest.hand-held" },
      { type: "set-world-flag", flagId: "nest.hand-kept" },
    ],
    rememberedAs: "Both hands carried what mattered.",
  },
  {
    id: "action.nest.bear-burden",
    sceneId: "nest.unsupported-cycle",
    mode: "hold",
    verb: "hold",
    label: "Feel the unsupported weight",
    instruction: "Hold E. Let the weight be named before anything is set down.",
    completionFlagIds: ["nest.unsupported-burden-held"],
    durationMs: 1_500,
    keyCodes: ["KeyE"],
    outcomes: [{ type: "set-world-flag", flagId: "nest.unsupported-burden-held" }],
    rememberedAs: "The unsupported weight was witnessed.",
  },
  {
    id: "action.nest.release-burden",
    sceneId: "nest.unsupported-cycle",
    mode: "press",
    verb: "set down",
    label: "Release what was never yours alone",
    instruction: "Press E to set down the unsupported weight without setting down the love.",
    completionFlagIds: ["nest.unsupported-burden-released"],
    requiredFlagIds: ["nest.unsupported-burden-held"],
    keyCodes: ["KeyE"],
    outcomes: [{ type: "set-world-flag", flagId: "nest.unsupported-burden-released" }],
    rememberedAs: "Responsibility remained sacred; unsupported weight did not.",
  },
  {
    id: "action.nest.protect",
    sceneId: "nest.protection",
    mode: "hold",
    verb: "shelter",
    label: "Acknowledge what you protect",
    instruction: "Hold E beside the Nest. Protection can include the one who protects.",
    completionFlagIds: ["nest.protection-acknowledged"],
    durationMs: 1_400,
    keyCodes: ["KeyE"],
    outcomes: [{ type: "set-world-flag", flagId: "nest.protection-acknowledged" }],
    rememberedAs: "Protection made room for the protector.",
  },
  {
    id: "action.thorned.clear-space",
    sceneId: "thorned.locked-garden",
    mode: "hold",
    verb: "clear",
    label: "Make one place for yourself",
    instruction: "Hold E to clear a single surface in the house.",
    completionFlagIds: ["thorn-house.space-cleared"],
    durationMs: 1_250,
    keyCodes: ["KeyE"],
    outcomes: [{ type: "set-world-flag", flagId: "thorn-house.space-cleared" }],
    rememberedAs: "A small space was cleared.",
  },
  {
    id: "action.thorned.observe-refill",
    sceneId: "thorned.locked-garden",
    mode: "stillness",
    verb: "notice",
    label: "Watch the room fill itself again",
    instruction: "Stay here without fixing. Let the old things reveal the pattern.",
    completionFlagIds: ["thorn-house.space-refilled"],
    requiredFlagIds: ["thorn-house.space-cleared"],
    durationMs: 2_200,
    outcomes: [{ type: "set-world-flag", flagId: "thorn-house.space-refilled" }],
    rememberedAs: "The cleared room filled itself with old memory.",
  },
  {
    id: "action.thorned.stop-rearranging",
    sceneId: "thorned.old-memory-bedroom",
    mode: "press",
    verb: "refuse",
    label: "Stop rearranging the past",
    instruction: "Press Q. The work is not to perfect this room.",
    completionFlagIds: ["thorn-house.reorganisation-released"],
    requiredFlagIds: ["thorn-house.space-refilled"],
    keyCodes: ["KeyQ"],
    outcomes: [{ type: "set-world-flag", flagId: "thorn-house.reorganisation-released" }],
    rememberedAs: "The house was allowed to remain unfinished.",
  },
  {
    id: "action.thorned.leave",
    sceneId: "thorned.self-owned-world",
    mode: "move",
    verb: "leave",
    label: "Walk out with the key already yours",
    instruction: "Walk forward. The house does not have to be destroyed for you to leave it.",
    completionFlagIds: ["thorn-house.exit-crossed"],
    requiredFlagIds: ["thorn-house.reorganisation-released"],
    distance: 0.9,
    target: {
      localPosition: [0, 7.35],
      radius: 2.15,
      label: "the open house door",
    },
    outcomes: [{ type: "set-world-flag", flagId: "thorn-house.exit-crossed" }],
    rememberedAs: "She left the house standing behind her.",
  },
  {
    id: "action.integration.swan-alone",
    sceneId: "wolf-swan.false-choice",
    mode: "hold",
    verb: "listen",
    label: "Stay with the Swan",
    instruction: "Approach the water and hold E. Tenderness alone cannot keep abandoning itself.",
    completionFlagIds: ["integration.swan-witnessed"],
    durationMs: 1_100,
    keyCodes: ["KeyE"],
    target: { localPosition: [5.2, 1.6], radius: 2.1, label: "the Swan" },
    outcomes: [{ type: "set-world-flag", flagId: "integration.swan-witnessed" }],
    rememberedAs: "The Swan's tenderness was true, and insufficient alone.",
  },
  {
    id: "action.integration.wolf-alone",
    sceneId: "wolf-swan.false-choice",
    mode: "hold",
    verb: "listen",
    label: "Stay with the Wolf",
    instruction: "Approach the roots and hold E. Protection alone cannot become a permanent war.",
    completionFlagIds: ["integration.wolf-witnessed"],
    durationMs: 1_100,
    keyCodes: ["KeyE"],
    target: { localPosition: [-5.4, 1.8], radius: 2.1, label: "the Wolf" },
    outcomes: [{ type: "set-world-flag", flagId: "integration.wolf-witnessed" }],
    rememberedAs: "The Wolf's boundary was true, and insufficient alone.",
  },
  {
    id: "action.integration.seer-alone",
    sceneId: "wolf-swan.false-choice",
    mode: "stillness",
    verb: "witness",
    label: "Meet the Seer's distance",
    instruction: "Approach the high mirror and become still. Discernment alone cannot remain detached.",
    completionFlagIds: ["integration.seer-witnessed"],
    requiredFlagIds: ["integration.swan-witnessed", "integration.wolf-witnessed"],
    durationMs: 1_850,
    target: { localPosition: [0, 6.1], radius: 2.25, label: "the Seer's mirror" },
    outcomes: [{ type: "set-world-flag", flagId: "integration.seer-witnessed" }],
    rememberedAs: "The Seer's truth was clear, and insufficient alone.",
  },
  {
    id: "action.integration.hold-three",
    sceneId: "wolf-swan.convergence",
    mode: "stillness",
    verb: "integrate",
    label: "Hold tenderness, boundary, and truth together",
    instruction: "Stand inside the meeting ring and become still. No part must defeat another.",
    completionFlagIds: ["integration.three-aspects-held"],
    durationMs: 2_200,
    target: { localPosition: [0, 0], radius: 2.7, label: "the meeting ring" },
    outcomes: [{ type: "set-world-flag", flagId: "integration.three-aspects-held" }],
    rememberedAs: "Wolf, Swan, and Seer became one integrated way of seeing.",
  },
  {
    id: "action.fork.weigh",
    sceneId: "fork.weighing",
    mode: "stillness",
    verb: "weigh",
    label: "Sit with every part of yourself",
    instruction: "Be still. Nothing appearing around you needs to be defeated.",
    completionFlagIds: ["fork.weighed"],
    durationMs: 3_200,
    target: { localPosition: [0, -1.3], radius: 2.35, label: "the weighing stone" },
    outcomes: [{ type: "set-world-flag", flagId: "fork.weighed" }],
    rememberedAs: "Every remembered self was allowed into the weighing.",
  },
  {
    id: "action.fork.let-go",
    sceneId: "fork.four-verbs",
    mode: "hold",
    verb: "let go",
    label: "Lower the old token into moving water",
    instruction: "Hold E until the current takes its weight.",
    completionFlagIds: ["fork.let-go"],
    durationMs: 1_500,
    keyCodes: ["KeyE"],
    target: { localPosition: [-5.2, -4], radius: 2.1, label: "the moving water" },
    outcomes: [{ type: "set-world-flag", flagId: "fork.let-go" }],
    rememberedAs: "One old weight entered moving water.",
  },
  {
    id: "action.fork.decline",
    sceneId: "fork.four-verbs",
    mode: "press",
    verb: "decline",
    label: "Close the familiar door",
    instruction: "Press Q. Familiarity is not an obligation.",
    completionFlagIds: ["fork.declined"],
    requiredFlagIds: ["fork.let-go"],
    keyCodes: ["KeyQ"],
    target: { localPosition: [5.3, -3.8], radius: 2.1, label: "the familiar door" },
    outcomes: [{ type: "set-world-flag", flagId: "fork.declined" }],
    rememberedAs: "The familiar door was declined.",
  },
  {
    id: "action.fork.depart",
    sceneId: "fork.four-verbs",
    mode: "turn-and-move",
    verb: "depart",
    label: "Turn away, then take the step",
    instruction: "Turn your view away from the known path and walk onward.",
    completionFlagIds: ["fork.departed"],
    requiredFlagIds: ["fork.declined"],
    distance: 0.65,
    turnRadians: 0.6,
    target: { localPosition: [5.3, -3.8], radius: 2.3, label: "the closed familiar door" },
    outcomes: [{ type: "set-world-flag", flagId: "fork.departed" }],
    rememberedAs: "Departure became a bodily choice.",
  },
  {
    id: "action.fork.delete",
    sceneId: "fork.four-verbs",
    mode: "hold",
    verb: "delete",
    label: "Erase the obsolete path mark",
    instruction: "Hold Delete or Backspace until the old instruction goes dark.",
    completionFlagIds: ["fork.deleted"],
    requiredFlagIds: ["fork.departed"],
    durationMs: 1_300,
    keyCodes: ["Delete", "Backspace"],
    target: { localPosition: [6.2, 3.5], radius: 2.1, label: "the obsolete path marker" },
    outcomes: [{ type: "set-world-flag", flagId: "fork.deleted" }],
    rememberedAs: "The obsolete path instruction was erased.",
  },
  {
    id: "action.fork.relinquish-old-hope",
    sceneId: "fork.relinquish-hope",
    mode: "hold",
    verb: "relinquish",
    label: "Release the old hope",
    instruction: "Hold E. Honour what the hope protected, then let its loop end.",
    completionFlagIds: ["fork.old-hope-relinquished"],
    requiredFlagIds: ["fork.let-go", "fork.declined", "fork.departed", "fork.deleted"],
    durationMs: 1_700,
    keyCodes: ["KeyE"],
    target: { localPosition: [0, 3.35], radius: 2.15, label: "the old hope" },
    outcomes: [{ type: "set-world-flag", flagId: "fork.old-hope-relinquished" }],
    rememberedAs: "The old hope was honoured and relinquished.",
  },
  {
    id: "action.fork.take-lantern",
    sceneId: "fork.relinquish-hope",
    mode: "press",
    verb: "take",
    label: "Take ownership of the lantern",
    instruction: "Press E. It no longer leads you from outside; its light is yours.",
    completionFlagIds: ["lantern.owned"],
    requiredFlagIds: ["fork.old-hope-relinquished"],
    keyCodes: ["KeyE"],
    target: { localPosition: [0, 3.2], radius: 2.15, label: "the waiting lantern" },
    outcomes: [
      { type: "award-lantern" },
      { type: "set-world-flag", flagId: "lantern.owned" },
    ],
    rememberedAs: "The lantern became hers by choice.",
  },
  {
    id: "action.climb.mind.walk-on",
    sceneId: "climb.mind",
    mode: "move",
    verb: "continue",
    label: "Walk onward without answering",
    instruction: "Keep walking. The questions may remain unanswered and still fall away.",
    completionFlagIds: ["climb.mind.questions-released"],
    distance: 1.2,
    outcomes: [{ type: "set-world-flag", flagId: "climb.mind.questions-released" }],
    rememberedAs: "Understanding everything was no longer required for release.",
  },
  {
    id: "action.climb.heart.choose-memory",
    sceneId: "climb.heart",
    mode: "choice",
    verb: "carry",
    label: "Choose one remembered object",
    instruction: "Walk among the three objects. Beside the one you mean to carry, press E.",
    completionFlagIds: [HEART_CHOICE_FLAG],
    keyCodes: ["KeyE"],
    choices: [
      {
        id: "heart.tenderness",
        label: "Blush rose",
        meaning: "Carry tenderness without rebuilding the room around it.",
        target: HEART_MEMORY_WORLD_TARGETS["heart.tenderness"],
        outcomes: [
          { type: "collect-symbolic-object", objectId: "memory.chosen-heart" },
          { type: "collect-symbolic-object", objectId: "memory.heart.tenderness" },
          { type: "set-world-flag", flagId: HEART_CHOICE_FLAG },
        ],
      },
      {
        id: "heart.beauty",
        label: "Swan feather",
        meaning: "Carry beauty as truth, not as a command to return.",
        target: HEART_MEMORY_WORLD_TARGETS["heart.beauty"],
        outcomes: [
          { type: "collect-symbolic-object", objectId: "memory.chosen-heart" },
          { type: "collect-symbolic-object", objectId: "memory.heart.beauty" },
          { type: "set-world-flag", flagId: HEART_CHOICE_FLAG },
        ],
      },
      {
        id: "heart.selfhood",
        label: "Blue Moon reflection",
        meaning: "Carry the self who loved, grieved, and stayed whole.",
        target: HEART_MEMORY_WORLD_TARGETS["heart.selfhood"],
        outcomes: [
          { type: "collect-symbolic-object", objectId: "memory.chosen-heart" },
          { type: "collect-symbolic-object", objectId: "memory.heart.selfhood" },
          { type: "set-world-flag", flagId: HEART_CHOICE_FLAG },
        ],
      },
    ],
    rememberedAs: "One memory was chosen without becoming a dwelling.",
  },
  {
    id: "action.climb.womb.choose-creation",
    sceneId: "climb.womb",
    mode: "choice",
    verb: "make room",
    label: "Approach one unwritten possibility",
    instruction: "Walk through the protected space. Beside one future form, press E to make room for it.",
    completionFlagIds: [WOMB_CHOICE_FLAG],
    keyCodes: ["KeyE"],
    choices: [
      {
        id: "future.rest",
        label: "Folded linen",
        meaning: "Protection includes enough room to rest.",
        target: WOMB_FUTURE_WORLD_TARGETS["future.rest"],
        outcomes: [
          { type: "collect-symbolic-object", objectId: "creation.chosen-future" },
          { type: "collect-symbolic-object", objectId: "creation.future.rest" },
          { type: "set-world-flag", flagId: WOMB_CHOICE_FLAG },
        ],
      },
      {
        id: "future.home",
        label: "Lit threshold",
        meaning: "Creation can be a place where no self must shrink.",
        target: WOMB_FUTURE_WORLD_TARGETS["future.home"],
        outcomes: [
          { type: "collect-symbolic-object", objectId: "creation.chosen-future" },
          { type: "collect-symbolic-object", objectId: "creation.future.home" },
          { type: "set-world-flag", flagId: WOMB_CHOICE_FLAG },
        ],
      },
      {
        id: "future.voice",
        label: "Unwritten page",
        meaning: "Creation can be speech, work, tenderness, and possibility.",
        target: WOMB_FUTURE_WORLD_TARGETS["future.voice"],
        outcomes: [
          { type: "collect-symbolic-object", objectId: "creation.chosen-future" },
          { type: "collect-symbolic-object", objectId: "creation.future.voice" },
          { type: "set-world-flag", flagId: WOMB_CHOICE_FLAG },
        ],
      },
    ],
    rememberedAs: "Protection opened room for a chosen future.",
  },
] as const satisfies readonly JourneyPlayerAction[];

export const JOURNEY_PLAYER_ACTION_IDS = JOURNEY_PLAYER_ACTIONS.map((action) => action.id);

const ACTIONS_BY_SCENE = new Map<JourneySceneId, JourneyPlayerAction[]>();
for (const action of JOURNEY_PLAYER_ACTIONS) {
  const sceneActions = ACTIONS_BY_SCENE.get(action.sceneId) ?? [];
  sceneActions.push(action);
  ACTIONS_BY_SCENE.set(action.sceneId, sceneActions);
}

export function journeyPlayerActionsForScene(sceneId: JourneySceneId) {
  return ACTIONS_BY_SCENE.get(sceneId) ?? [];
}

export function journeyPlayerActionComplete(
  action: JourneyPlayerAction,
  worldFlags: Readonly<Record<string, boolean>>,
) {
  return action.completionFlagIds.every((flagId) => worldFlags[flagId] === true);
}

export function nextJourneyPlayerAction(
  sceneId: JourneySceneId,
  worldFlags: Readonly<Record<string, boolean>>,
) {
  return availableJourneyPlayerActionsForScene(sceneId, worldFlags)[0];
}

export function journeyPlayerActionAvailable(
  action: JourneyPlayerAction,
  worldFlags: Readonly<Record<string, boolean>>,
) {
  return (
    !journeyPlayerActionComplete(action, worldFlags) &&
    (action.requiredFlagIds ?? []).every((flagId) => worldFlags[flagId] === true)
  );
}

export function availableJourneyPlayerActionsForScene(
  sceneId: JourneySceneId,
  worldFlags: Readonly<Record<string, boolean>>,
) {
  return journeyPlayerActionsForScene(sceneId).filter((action) =>
    journeyPlayerActionAvailable(action, worldFlags)
  );
}

export function resolveJourneyPlayerActionTargetLocalPosition(
  target: JourneyPlayerActionTarget,
  arrivalHeadingRadians = 0,
): readonly [number, number] {
  if (target.frame !== "arrival") return target.localPosition;
  const [localX, localZ] = target.localPosition;
  const cosine = Math.cos(arrivalHeadingRadians);
  const sine = Math.sin(arrivalHeadingRadians);
  return [
    localX * cosine + localZ * sine,
    -localX * sine + localZ * cosine,
  ];
}

export type JourneyPlayerActionChoiceProximity = {
  choice: JourneyPlayerActionChoice;
  distance: number;
  atTarget: boolean;
};

/**
 * A visual-mode choice is made by walking to one authored object. This helper
 * deliberately returns one nearest object, never a screen-space choice list.
 */
export function nearestJourneyPlayerActionChoice(
  action: JourneyPlayerAction,
  playerLocalPosition: readonly [number, number],
  arrivalHeadingRadians = 0,
): JourneyPlayerActionChoiceProximity | null {
  let nearest: JourneyPlayerActionChoiceProximity | null = null;
  for (const choice of action.choices ?? []) {
    const [targetX, targetZ] = resolveJourneyPlayerActionTargetLocalPosition(
      choice.target,
      arrivalHeadingRadians,
    );
    const distance = Math.hypot(
      playerLocalPosition[0] - targetX,
      playerLocalPosition[1] - targetZ,
    );
    if (!nearest || distance < nearest.distance) {
      nearest = {
        choice,
        distance,
        atTarget: distance <= choice.target.radius,
      };
    }
  }
  return nearest;
}

export function journeyPlayerActionChoiceAtTarget(
  action: JourneyPlayerAction,
  playerLocalPosition: readonly [number, number],
  arrivalHeadingRadians = 0,
) {
  const nearest = nearestJourneyPlayerActionChoice(
    action,
    playerLocalPosition,
    arrivalHeadingRadians,
  );
  return nearest?.atTarget ? nearest.choice : null;
}

/**
 * Schema-v2 saves created before embodied chapter actions existed can already
 * contain completed scenes. Completion is durable evidence that the scene's
 * terminal actions happened; restore only generic outcomes and never invent a
 * specific Heart or Womb choice.
 */
export function inferJourneyPlayerActionEvidence(
  completedSceneIds: readonly JourneySceneId[],
) {
  const completed = new Set<JourneySceneId>(completedSceneIds);
  const worldFlagIds = JOURNEY_PLAYER_ACTIONS
    .filter((action) => completed.has(action.sceneId))
    .flatMap((action) => [...action.completionFlagIds]);
  const symbolicObjectIds = [
    ...(completed.has("climb.heart") ? ["memory.chosen-heart"] : []),
    ...(completed.has("climb.womb") ? ["creation.chosen-future"] : []),
  ];
  return {
    worldFlagIds: Array.from(new Set(worldFlagIds)),
    symbolicObjectIds,
  };
}
