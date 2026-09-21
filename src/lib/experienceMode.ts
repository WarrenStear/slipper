export const SLIPPER_EXPERIENCE_MODES = [
  "first-journey",
  "returning-journey",
  "free-woods",
] as const;

export type SlipperExperienceMode = (typeof SLIPPER_EXPERIENCE_MODES)[number];

export type SlipperExperienceState = Readonly<{
  storyStarted: boolean;
  storyCompleted: boolean;
  dedicationAcknowledged: boolean;
}>;

export type SlipperStartStateId = "fresh" | "incomplete" | "completed";

export type SlipperStartState = Readonly<{
  id: SlipperStartStateId;
  actionLabel: "Begin" | "Continue the Journey" | "Return to the Woods";
}>;

export const SLIPPER_START_STATES = Object.freeze({
  fresh: Object.freeze({ id: "fresh", actionLabel: "Begin" }),
  incomplete: Object.freeze({
    id: "incomplete",
    actionLabel: "Continue the Journey",
  }),
  completed: Object.freeze({
    id: "completed",
    actionLabel: "Return to the Woods",
  }),
} satisfies Readonly<Record<SlipperStartStateId, SlipperStartState>>);

export type SlipperConstellationScope = "witnessed-only" | "full";

export type SlipperExperienceCapabilities = Readonly<{
  allowWalking: boolean;
  allowContextualReading: boolean;
  allowDiscoveredEchoes: boolean;
  allowStoryInteractions: boolean;
  allowSettings: boolean;
  allowAudioControls: boolean;
  allowSaveAndExit: boolean;
  allowResume: boolean;
  allowFullArchive: boolean;
  showArchiveInPrimaryNavigation: boolean;
  constellationScope: SlipperConstellationScope;
  showConstellationInPrimaryNavigation: boolean;
  allowConstellationNavigation: boolean;
  allowArbitraryEntryNavigation: boolean;
  allowSceneRevisiting: boolean;
  allowBookmarks: boolean;
  allowFreeExploration: boolean;
  showJourneyMetrics: boolean;
  showGenericNavigation: boolean;
}>;

const DIRECTED_JOURNEY_CAPABILITIES = Object.freeze({
  allowWalking: true,
  allowContextualReading: true,
  allowDiscoveredEchoes: true,
  allowStoryInteractions: true,
  allowSettings: true,
  allowAudioControls: true,
  allowSaveAndExit: true,
  allowResume: true,
  allowFullArchive: false,
  showArchiveInPrimaryNavigation: false,
  constellationScope: "witnessed-only",
  showConstellationInPrimaryNavigation: false,
  allowConstellationNavigation: false,
  allowArbitraryEntryNavigation: false,
  allowSceneRevisiting: false,
  allowBookmarks: false,
  allowFreeExploration: false,
  showJourneyMetrics: false,
  showGenericNavigation: false,
} satisfies SlipperExperienceCapabilities);

const FREE_WOODS_CAPABILITIES = Object.freeze({
  allowWalking: true,
  allowContextualReading: true,
  allowDiscoveredEchoes: true,
  allowStoryInteractions: true,
  allowSettings: true,
  allowAudioControls: true,
  allowSaveAndExit: true,
  allowResume: true,
  allowFullArchive: true,
  showArchiveInPrimaryNavigation: true,
  constellationScope: "full",
  showConstellationInPrimaryNavigation: true,
  allowConstellationNavigation: true,
  allowArbitraryEntryNavigation: true,
  allowSceneRevisiting: true,
  allowBookmarks: true,
  allowFreeExploration: true,
  showJourneyMetrics: true,
  showGenericNavigation: true,
} satisfies SlipperExperienceCapabilities);

const EXPERIENCE_CAPABILITIES = Object.freeze({
  "first-journey": DIRECTED_JOURNEY_CAPABILITIES,
  "returning-journey": DIRECTED_JOURNEY_CAPABILITIES,
  "free-woods": FREE_WOODS_CAPABILITIES,
} satisfies Readonly<Record<SlipperExperienceMode, SlipperExperienceCapabilities>>);

/**
 * Resolve the durable experience philosophy from narrative progress and the
 * separate presentation acknowledgement. Accessibility is intentionally not
 * an input: the same journey mode applies to both 3D and text renderers.
 */
export function resolveSlipperExperienceMode(
  state: SlipperExperienceState,
): SlipperExperienceMode {
  if (state.storyCompleted && state.dedicationAcknowledged) return "free-woods";
  if (state.storyStarted || state.storyCompleted) return "returning-journey";
  return "first-journey";
}

export function resolveSlipperStartState(
  state: Pick<SlipperExperienceState, "storyStarted" | "storyCompleted">,
): SlipperStartState {
  if (state.storyCompleted) return SLIPPER_START_STATES.completed;
  if (state.storyStarted) return SLIPPER_START_STATES.incomplete;
  return SLIPPER_START_STATES.fresh;
}

export function getSlipperExperienceCapabilities(
  mode: SlipperExperienceMode,
): SlipperExperienceCapabilities {
  return EXPERIENCE_CAPABILITIES[mode];
}

export function isDirectedJourneyMode(mode: SlipperExperienceMode) {
  return mode !== "free-woods";
}

export function canOpenFullArchive(mode: SlipperExperienceMode) {
  return getSlipperExperienceCapabilities(mode).allowFullArchive;
}

export function constellationScopeFor(
  mode: SlipperExperienceMode,
): SlipperConstellationScope {
  return getSlipperExperienceCapabilities(mode).constellationScope;
}

export type GiftDedicationGate = Readonly<{
  storyCompleted: boolean;
  inWorldConstellationRevealed: boolean;
  transitionIdle: boolean;
}>;

export function canPresentGiftDedication(gate: GiftDedicationGate) {
  return (
    gate.storyCompleted &&
    gate.inWorldConstellationRevealed &&
    gate.transitionIdle
  );
}
