type SomaticTone = "fire" | "water" | "memory" | "threshold" | "return" | "silence" | "wood" | string;

export type SomaticSpacingInput = {
  emotionalTone?: SomaticTone;
  densityMultiplier?: number;
  symbolicWeight?: number;
  paragraphIndex: number;
  paragraphCount: number;
  mode: "explore" | "read" | "map";
};

export function resolveSomaticParagraphOffset(input: SomaticSpacingInput) {
  const tone = input.emotionalTone ?? "memory";
  const density = clamp(input.densityMultiplier ?? 1, 0.65, 1.85);
  const weight = clamp(input.symbolicWeight ?? 3, 1, 5);

  const toneBreath: Record<string, number> = {
    fire: 0.86,
    water: 1.16,
    memory: 1.28,
    threshold: 1.08,
    return: 1.18,
    silence: 1.42,
    wood: 1,
  };

  const base = input.mode === "read" ? 0.42 : 0.34;
  const toneScale = toneBreath[tone] ?? 1;
  const densityScale = 1 / density;
  const weightScale = 1 + (weight - 3) * 0.045;
  const openingBreath = input.paragraphIndex === 0 ? 0.18 : 0;
  const finalBreath = input.paragraphIndex === input.paragraphCount - 1 ? 0.24 : 0;

  return base * toneScale * densityScale * weightScale + openingBreath + finalBreath;
}

export function resolveSomaticOpacity(input: { emotionalTone?: SomaticTone; paragraphIndex: number; paragraphCount: number }) {
  const edgeFade = input.paragraphIndex === 0 || input.paragraphIndex === input.paragraphCount - 1 ? 0.88 : 1;
  if (input.emotionalTone === "silence") return 0.82 * edgeFade;
  if (input.emotionalTone === "fire") return 0.96 * edgeFade;
  return 0.9 * edgeFade;
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}
