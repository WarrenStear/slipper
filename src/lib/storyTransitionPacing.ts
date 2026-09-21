import type { JourneyScene } from "../data/journeyNarrative";

export const STORY_TRANSITION_PHASES = [
  "idle",
  "arrival",
  "contemplation",
  "departure",
  "silence",
] as const;

export type StoryTransitionPhase = (typeof STORY_TRANSITION_PHASES)[number];

export type StoryTransitionDurations = Readonly<{
  arrival: number;
  contemplation: number;
  departure: number;
  silence: number;
}>;

const DEFAULT_ARRIVAL_QUIET_MS = 2_800;
const DEFAULT_MINIMUM_CONTEMPLATION_MS = 6_000;
const DEFAULT_COMPLETION_QUIET_MS = 2_800;
const REDUCED_MOTION_MIN_PHASE_MS = 60;
const REDUCED_MOTION_MAX_PHASE_MS = 160;

function finiteDuration(value: number | undefined, fallback: number) {
  return Number.isFinite(value) ? Math.max(0, value ?? fallback) : fallback;
}

function reducedMotionDuration(duration: number) {
  if (duration <= 0) return 0;
  return Math.min(
    REDUCED_MOTION_MAX_PHASE_MS,
    Math.max(REDUCED_MOTION_MIN_PHASE_MS, Math.round(duration * 0.02)),
  );
}

/**
 * Converts the authored scene pacing into a complete handoff timeline.
 * `minimumContemplationMs` is measured from arrival, so its phase receives
 * only the time remaining after the arrival presentation. Reduced motion
 * preserves every authored phase in the same order without making the reader
 * wait through cinematic timings.
 */
export function resolveStoryTransitionDurations(
  scene: Pick<JourneyScene, "pacing" | "presentation">,
  reducedMotion = false,
): StoryTransitionDurations {
  const arrival = finiteDuration(
    scene.pacing.arrivalQuietMs,
    DEFAULT_ARRIVAL_QUIET_MS,
  );
  const minimumContemplation = Math.max(
    arrival,
    finiteDuration(
      scene.pacing.minimumContemplationMs,
      DEFAULT_MINIMUM_CONTEMPLATION_MS,
    ),
  );
  const durations = {
    arrival,
    contemplation: minimumContemplation - arrival,
    departure: finiteDuration(
      scene.pacing.completionQuietMs,
      DEFAULT_COMPLETION_QUIET_MS,
    ),
    silence: finiteDuration(
      scene.presentation.silenceAfterCompletionMs,
      0,
    ),
  } satisfies StoryTransitionDurations;

  if (!reducedMotion) return durations;
  return {
    arrival: reducedMotionDuration(durations.arrival),
    contemplation: reducedMotionDuration(durations.contemplation),
    departure: reducedMotionDuration(durations.departure),
    silence: reducedMotionDuration(durations.silence),
  };
}

export function storyTransitionAllowsProse(phase: StoryTransitionPhase) {
  return phase === "idle" || phase === "contemplation";
}

export function storyTransitionAllowsAction(phase: StoryTransitionPhase) {
  return phase === "idle" || phase === "contemplation";
}

export function storyTransitionSuppressesAudio(phase: StoryTransitionPhase) {
  return phase === "silence";
}
