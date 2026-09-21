export type StoryGuidanceLevel = 0 | 1 | 2 | 3 | 4;

export type StoryGuidanceState = {
  level: StoryGuidanceLevel;
  environmentalStrength: number;
  poeticLine: string | null;
  allowDirectionalCue: boolean;
};

export type ResolveStoryGuidanceInput = {
  idleMs: number;
  guidanceDelayMs?: number;
  guidanceLines?: readonly string[];
  assistanceEnabled?: boolean;
  suppressed?: boolean;
};

const DEFAULT_GUIDANCE_DELAY_MS = 36_000;

/**
 * Central story-guidance escalation. Levels one and two are communicated by
 * the environment; prose does not appear until sustained inactivity, and a
 * directional cue remains the last resort (or an explicit assistance choice).
 */
export function resolveStoryGuidance({
  idleMs,
  guidanceDelayMs = DEFAULT_GUIDANCE_DELAY_MS,
  guidanceLines = [],
  assistanceEnabled = false,
  suppressed = false,
}: ResolveStoryGuidanceInput): StoryGuidanceState {
  if (suppressed || !Number.isFinite(idleMs) || idleMs < 0) {
    return { level: 0, environmentalStrength: 0, poeticLine: null, allowDirectionalCue: false };
  }

  const baseDelay = Math.max(12_000, guidanceDelayMs);
  const assistanceScale = assistanceEnabled ? 0.72 : 1;
  const levelOneAt = baseDelay * assistanceScale;
  const levelTwoAt = (baseDelay + 16_000) * assistanceScale;
  const levelThreeAt = (baseDelay + 36_000) * assistanceScale;
  const levelFourAt = (baseDelay + 68_000) * assistanceScale;

  let level: StoryGuidanceLevel = 0;
  if (idleMs >= levelFourAt) level = 4;
  else if (idleMs >= levelThreeAt) level = 3;
  else if (idleMs >= levelTwoAt) level = 2;
  else if (idleMs >= levelOneAt) level = 1;

  const lineIndex = Math.max(0, Math.min(guidanceLines.length - 1, level - 3));
  return {
    level,
    environmentalStrength: level === 0 ? 0 : level === 1 ? 0.34 : level === 2 ? 0.68 : 1,
    poeticLine: level >= 3 && guidanceLines.length > 0 ? guidanceLines[lineIndex] ?? null : null,
    allowDirectionalCue: level === 4 || (assistanceEnabled && level >= 2),
  };
}
