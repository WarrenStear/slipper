import type { NarrativeWorldStateLike } from "../worldVisualState";

export type WorldMoodState = {
  memory: number;
  depth: number;
  balance: number;
  symbol: number;
  crown: number;
  warmth: number;
  water: number;
  motion: number;
  clarity: number;
  ascent: number;
};

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, Number.isFinite(value) ? value : min));
}

function clamp01(value: number) {
  return clamp(value, 0, 1);
}

export function resolveWorldMoodState(state: NarrativeWorldStateLike): WorldMoodState {
  const memory = clamp01(state.memoryPressure);
  const depth = clamp01(state.explorationDepth);
  const balance = clamp(state.fireWaterBalance, -1, 1);
  const symbol = clamp01(state.symbolicWeight / 5);
  const crown = clamp01(state.crownCount / Math.max(1, state.totalCount || 1));
  const warmth = clamp01(balance * 0.5 + 0.5);
  const water = clamp01(-balance);
  const motion = clamp01(memory * 0.68 + Math.abs(balance) * memory * 0.2 + symbol * 0.12);
  const clarity = clamp01(0.42 + depth * 0.28 + crown * 0.34 - memory * 0.26);
  const ascent = clamp01(crown * 0.72 + depth * 0.22);

  return { memory, depth, balance, symbol, crown, warmth, water, motion, clarity, ascent };
}
