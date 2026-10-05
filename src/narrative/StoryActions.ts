import type { JourneyOutcome } from "../data/journeyBlueprint.ts";
import type { JourneyPlayerActionOutcome } from "../lib/journeyPlayerActions.ts";
import type { JourneyActId, LandmarkState, ResonanceKey } from "../lib/storyJourneyState.ts";

/** The canonical store supplies these commands; this domain owns no second state. */
export type StoryActionSink = {
  completeRitual: (ritualId: string) => void;
  setWorldFlag: (flagId: string, value?: boolean) => void;
  setLandmarkState: (landmarkId: string, state: LandmarkState) => void;
  addResonance: (key: ResonanceKey, amount?: number) => void;
  awardLantern: () => void;
  recoverKey: (keyId: string) => void;
  collectSymbolicObject: (objectId: string) => void;
  releaseWord: (word: string) => void;
  completeAct: (actId: JourneyActId) => void;
  completeStory: () => void;
};

export type StoryPlayerActionSink = Pick<StoryActionSink,
  "setWorldFlag" | "collectSymbolicObject" | "awardLantern"
>;

/** Translate canonical authored outcomes without interpreting eligibility or inventing rewards. */
export function applyJourneyOutcome(outcome: JourneyOutcome, actions: StoryActionSink) {
  switch (outcome.type) {
    case "complete-ritual": actions.completeRitual(outcome.ritualId); break;
    case "set-world-flag": actions.setWorldFlag(outcome.flagId, outcome.value); break;
    case "set-landmark-state": actions.setLandmarkState(outcome.landmarkId, outcome.state); break;
    case "add-resonance": actions.addResonance(outcome.resonance, outcome.amount); break;
    case "award-lantern": actions.awardLantern(); break;
    case "recover-key": actions.recoverKey(outcome.keyId); break;
    case "collect-symbolic-object": actions.collectSymbolicObject(outcome.objectId); break;
    case "release-word": actions.releaseWord(outcome.word); break;
    case "complete-act": actions.completeAct(outcome.actId); break;
    case "complete-story": actions.completeStory(); break;
    default: {
      const unsupported: never = outcome;
      return unsupported;
    }
  }
}

export function applyPlayerActionOutcome(outcome: JourneyPlayerActionOutcome, actions: StoryPlayerActionSink) {
  switch (outcome.type) {
    case "set-world-flag": actions.setWorldFlag(outcome.flagId); break;
    case "collect-symbolic-object": actions.collectSymbolicObject(outcome.objectId); break;
    case "award-lantern": actions.awardLantern(); break;
    default: {
      const unsupported: never = outcome;
      return unsupported;
    }
  }
}
