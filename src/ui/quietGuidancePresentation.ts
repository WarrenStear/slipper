import { getJourneyScene } from "../data/journeyNarrative.ts";
import type { JourneySceneId } from "../lib/storyJourneyState.ts";
import type { GuidedStoryBeat } from "../storyEvents/guidedStory.ts";

export type QuietGuidanceActivity = Readonly<{ idleMs: number; detailRequested?: boolean | null }>;

export type QuietGuidanceInput = Readonly<{
  sceneId: JourneySceneId;
  kind: GuidedStoryBeat["kind"];
  instruction: string;
  active: boolean;
  inline?: boolean;
  idleMs: number;
  assistanceEnabled?: boolean;
  /** Null follows idle/preference; false is an explicit temporary quiet choice. */
  detailRequested?: boolean | null;
  consequenceLine?: string | null;
}>;

/** Presentation only: current authored text, existing idle thresholds, no commands. */
export function resolveQuietGuidance(input: QuietGuidanceInput) {
  const scene = getJourneyScene(input.sceneId);
  const quiet = input.kind === "quiet" || input.kind === "sequence";
  const suppressed = !input.active || !input.inline && quiet;
  const idle = Number.isFinite(input.idleMs) && input.idleMs >= 0 ? input.idleMs : 0;
  const delay = Math.max(12_000, scene?.pacing.guidanceDelayMs ?? 36_000);
  const explicit = input.inline === true || input.detailRequested === true;
  const automatic = input.assistanceEnabled === true || idle >= delay + 68_000;
  const opening = input.sceneId === "broken-floor.confession" && input.kind !== "complete";
  let openingStage: 0 | 1 | 2 | 3 = 0;
  if (opening) {
    if (explicit || input.detailRequested !== false && (input.assistanceEnabled || idle >= delay + 36_000)) openingStage = 3;
    else if (idle >= delay + 16_000) openingStage = 2;
    else if (idle >= delay) openingStage = 1;
  }
  const detailsOpen = input.inline === true || input.detailRequested === true
    || input.detailRequested !== false && (automatic || openingStage === 3);
  const authoredLine = scene?.presentation.guidanceLines?.[0] ?? null;
  let line = input.consequenceLine ?? authoredLine;
  if (opening && !input.consequenceLine) {
    line = openingStage === 0 ? null : openingStage === 1 ? "Look down."
      : openingStage === 2 ? authoredLine : input.instruction;
  }
  return {
    visible: !suppressed && Boolean(line || detailsOpen),
    line: suppressed ? null : line,
    detailsOpen: !suppressed && detailsOpen,
    openingStage: suppressed ? 0 as const : openingStage,
  };
}
