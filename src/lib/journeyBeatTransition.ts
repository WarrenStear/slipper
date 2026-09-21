import type { JourneyAct, JourneyBeat } from "../data/journeyBlueprint";
import type { JourneyActId } from "./storyJourneyState";

export type JourneyBeatTransitionKind =
  | "threshold-open"
  | "departure"
  | "arrival"
  | "entry";

export type JourneyBeatTransition = {
  actId: JourneyActId;
  beatId: string;
  kind: JourneyBeatTransitionKind;
};

export type JourneyBeatTransitionInput = {
  currentBeat?: JourneyBeat;
  currentAct?: JourneyAct;
  activeActId?: JourneyActId;
  activeEntryBeatId?: string;
  activeEntryWitnessed: boolean;
  canWitnessActiveEntry: boolean;
  completedActs: readonly JourneyActId[];
  storyCompleted: boolean;
};

/** Resolve one authored phase at a time so chained transitions stay observable. */
export function resolveJourneyBeatTransition({
  currentBeat,
  currentAct,
  activeActId,
  activeEntryBeatId,
  activeEntryWitnessed,
  canWitnessActiveEntry,
  completedActs,
  storyCompleted,
}: JourneyBeatTransitionInput): JourneyBeatTransition | null {
  if (!currentBeat || !currentAct) return null;
  const nextBeatId = currentBeat.nextBeatIds[0];
  if (!nextBeatId) return null;

  if (
    currentBeat.role === "transformation" &&
    completedActs.includes(currentBeat.actId)
  ) {
    return { actId: currentBeat.actId, beatId: nextBeatId, kind: "threshold-open" };
  }

  if (currentBeat.role === "threshold") {
    const crossedIntoNextAct = Boolean(
      currentAct.nextActId && activeActId === currentAct.nextActId,
    );
    const finalThresholdResolved = !currentAct.nextActId && storyCompleted;
    return crossedIntoNextAct || finalThresholdResolved
      ? { actId: currentBeat.actId, beatId: nextBeatId, kind: "departure" }
      : null;
  }

  if (
    currentBeat.role === "departure" &&
    currentAct.nextActId &&
    activeActId === currentAct.nextActId &&
    canWitnessActiveEntry
  ) {
    return { actId: currentAct.nextActId, beatId: nextBeatId, kind: "arrival" };
  }

  if (
    currentBeat.role === "arrival" &&
    activeActId === currentBeat.actId &&
    activeEntryWitnessed &&
    canWitnessActiveEntry &&
    activeEntryBeatId &&
    activeEntryBeatId !== currentBeat.id
  ) {
    return {
      actId: currentBeat.actId,
      beatId: activeEntryBeatId,
      kind: "entry",
    };
  }

  return null;
}

const TRANSITION_DELAYS_MS: Record<JourneyBeatTransitionKind, number> = {
  "threshold-open": 900,
  departure: 420,
  arrival: 620,
  entry: 720,
};

export function journeyBeatTransitionDelay(
  kind: JourneyBeatTransitionKind,
  reducedMotion: boolean,
) {
  const delay = TRANSITION_DELAYS_MS[kind];
  return reducedMotion ? Math.min(delay, 240) : delay;
}
