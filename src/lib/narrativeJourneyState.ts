import type { NarrativeWorldState } from "../components/three/StoryScene";
import {
  JOURNEY_RITUAL_IDS,
  JOURNEY_WORLD_FLAG_IDS,
} from "../data/journeyBlueprint.ts";
import {
  JOURNEY_ACT_IDS,
  type StoryJourneyState,
} from "./storyJourneyState.ts";

export type NarrativeJourneyStateInput = Pick<
  StoryJourneyState,
  "activeEntryId" | "history" | "visitedEntryIds"
> & Partial<Pick<
  StoryJourneyState,
  "completedRitualIds" | "completedActs" | "worldFlags" | "resonances"
>>;

export type NarrativeWorldEntry = {
  id: string;
  tags: readonly string[];
  engine3d: {
    emotionalTone?: string;
    mood?: string;
    sceneKind?: string;
    symbolicWeight?: number;
  };
};

export type NarrativeWorldContent = {
  entryById: ReadonlyMap<string, NarrativeWorldEntry>;
  totalCount: number;
};

const FIRE_RITUAL_IDS = new Set(["ritual.burn-boundary"]);
const WATER_RITUAL_IDS = new Set(["ritual.witness-mirror", "ritual.wash-grief"]);
const MEMORY_RITUAL_IDS = new Set(["ritual.accept-memory", "ritual.release-river-memory"]);
const THRESHOLD_RITUAL_IDS = new Set(["ritual.accept-lantern", "ritual.recover-key", "ritual.surrender"]);
const CROWN_RITUAL_IDS = new Set(["ritual.surrender", "ritual.place-lantern"]);

const FIRE_FLAG_IDS = new Set(["fire.boundary-burned"]);
const WATER_FLAG_IDS = new Set(["mirror.reflections-truthful", "river.grief-washed"]);
const MEMORY_FLAG_IDS = new Set([
  "archive.memory-carried",
  "archive.nostalgia-loops-closed",
  "river.memory-released",
  "birds.black-swarm-released",
]);
const THRESHOLD_FLAG_IDS = new Set([
  "path.first-wood-readable",
  "path.reflected-route-visible",
  "thorn-door.open",
  "thorn-house.collapsed-wing",
  "path.house-exit-open",
  "path.crowned-return-visible",
]);
const CROWN_FLAG_IDS = new Set(["surrender.white-flag-raised", "lantern.placed-and-lit"]);

const RELEASE_RITUAL_IDS = new Set(["ritual.release-river-memory", "ritual.surrender", "ritual.place-lantern"]);
const RELEASE_FLAG_IDS = new Set([
  "archive.nostalgia-loops-closed",
  "river.memory-released",
  "birds.black-swarm-released",
  "surrender.white-flag-raised",
  "lantern.placed-and-lit",
]);

function clamp01(value: number) {
  return Math.max(0, Math.min(1, value));
}

function finiteOrZero(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function countSelected(selected: ReadonlySet<string>, category: ReadonlySet<string>) {
  let count = 0;
  for (const id of selected) {
    if (category.has(id)) count += 1;
  }
  return count;
}

function entrySignal(entry: NarrativeWorldEntry) {
  return `${entry.tags.join(" ")} ${entry.engine3d.emotionalTone ?? ""} ${entry.engine3d.mood ?? ""} ${entry.engine3d.sceneKind ?? ""}`.toLowerCase();
}

function legacyNarrativeWorldState(
  content: NarrativeWorldContent,
  journeyTrace: NarrativeWorldEntry[],
  uniqueVisited: ReadonlySet<string>,
): NarrativeWorldState {
  let fire = 0;
  let water = 0;
  let memory = 0;
  let threshold = 0;
  let crown = 0;
  let symbolicWeight = 0;

  for (const entry of journeyTrace) {
    const signal = entrySignal(entry);
    if (/fire|ember|ash|burn|flame/.test(signal)) fire += 1;
    if (/water|mirror|river|pool|reflection/.test(signal)) water += 1;
    if (/memory|archive|moon|night|stars|silence/.test(signal)) memory += 1;
    if (/threshold|house|door|first|crossing/.test(signal)) threshold += 1;
    if (/crown|return|exit|revelation/.test(signal)) crown += 1;
    symbolicWeight += entry.engine3d.symbolicWeight ?? 3;
  }

  const traceCount = Math.max(1, journeyTrace.length);
  const weightedAverage = symbolicWeight > 0 ? symbolicWeight / traceCount / 5 : 0.5;
  const fireWaterTotal = Math.max(1, fire + water);
  const fireWaterBalance = Math.max(-1, Math.min(1, (fire - water) / fireWaterTotal));
  const explorationDepth = clamp01(
    Math.log2(traceCount + 1) / 6 +
    (uniqueVisited.size / Math.max(1, content.totalCount)) * 0.35 +
    weightedAverage * 0.15,
  );
  const memoryPressure = clamp01((memory + threshold * 0.55 + crown * 0.8) / traceCount);

  return {
    visitedCount: uniqueVisited.size,
    totalCount: content.totalCount,
    traceCount,
    fireCount: fire,
    waterCount: water,
    memoryCount: memory,
    thresholdCount: threshold,
    crownCount: crown,
    fireWaterBalance,
    explorationDepth,
    memoryPressure,
    symbolicWeight: weightedAverage,
  };
}

export function hasExplicitNarrativeProgress(state: NarrativeJourneyStateInput) {
  if ((state.completedRitualIds?.length ?? 0) > 0 || (state.completedActs?.length ?? 0) > 0) return true;
  if (Object.values(state.worldFlags ?? {}).some((value) => value === true)) return true;
  return Object.values(state.resonances ?? {}).some((value) => finiteOrZero(value) > 0);
}

export function buildNarrativeWorldState(
  state: NarrativeJourneyStateInput,
  content: NarrativeWorldContent,
): NarrativeWorldState {
  const journeyTrace = [...state.history, state.activeEntryId]
    .map((entryId) => content.entryById.get(entryId))
    .filter((entry): entry is NarrativeWorldEntry => Boolean(entry));
  const uniqueVisited = new Set(
    state.visitedEntryIds.filter((entryId) => content.entryById.has(entryId)),
  );

  if (!hasExplicitNarrativeProgress(state)) {
    return legacyNarrativeWorldState(content, journeyTrace, uniqueVisited);
  }

  const rituals = new Set(state.completedRitualIds ?? []);
  const acts = new Set(state.completedActs ?? []);
  const trueFlags = new Set(
    Object.entries(state.worldFlags ?? {})
      .filter(([, value]) => value === true)
      .map(([flagId]) => flagId),
  );
  const wolf = clamp01(finiteOrZero(state.resonances?.wolf) / 100);
  const swan = clamp01(finiteOrZero(state.resonances?.swan) / 100);
  const seer = clamp01(finiteOrZero(state.resonances?.seer) / 100);

  const fireSignal =
    countSelected(rituals, FIRE_RITUAL_IDS) +
    countSelected(trueFlags, FIRE_FLAG_IDS) +
    (acts.has("fire-and-river") ? 1 : 0) +
    wolf * 2;
  const waterSignal =
    countSelected(rituals, WATER_RITUAL_IDS) +
    countSelected(trueFlags, WATER_FLAG_IDS) +
    (acts.has("mirror-clearing") ? 1 : 0) +
    (acts.has("fire-and-river") ? 1 : 0) +
    swan * 2;
  const memorySignal =
    countSelected(rituals, MEMORY_RITUAL_IDS) +
    countSelected(trueFlags, MEMORY_FLAG_IDS) +
    (acts.has("blue-moon-archive") ? 1.5 : 0) +
    (swan + seer) * 1.5;
  const thresholdSignal =
    countSelected(rituals, THRESHOLD_RITUAL_IDS) +
    countSelected(trueFlags, THRESHOLD_FLAG_IDS) +
    acts.size * 0.75 +
    wolf;
  const crownSignal =
    countSelected(rituals, CROWN_RITUAL_IDS) +
    countSelected(trueFlags, CROWN_FLAG_IDS) +
    (acts.has("crowned-return") ? 2 : 0) +
    seer * 2;

  const actProgress = acts.size / JOURNEY_ACT_IDS.length;
  const ritualProgress = rituals.size / Math.max(1, JOURNEY_RITUAL_IDS.length);
  const flagProgress = trueFlags.size / Math.max(1, JOURNEY_WORLD_FLAG_IDS.length);
  const visitedProgress = uniqueVisited.size / Math.max(1, content.totalCount);
  const resonanceMean = (wolf + swan + seer) / 3;
  const releaseProgress = clamp01(
    (
      countSelected(rituals, RELEASE_RITUAL_IDS) +
      countSelected(trueFlags, RELEASE_FLAG_IDS) +
      (acts.has("fire-and-river") ? 1 : 0) +
      (acts.has("crowned-return") ? 1 : 0)
    ) / (RELEASE_RITUAL_IDS.size + RELEASE_FLAG_IDS.size + 2),
  );
  const memoryActivation = clamp01(
    ((swan + seer) / 2) * 0.42 +
    (memorySignal / Math.max(1, MEMORY_RITUAL_IDS.size + MEMORY_FLAG_IDS.size + 1.5)) * 0.58,
  );
  const traceCount = Math.max(1, journeyTrace.length);
  const countCap = Math.max(1, content.totalCount);
  const asCount = (signal: number) => Math.min(countCap, Math.max(0, Math.round(signal)));

  return {
    visitedCount: uniqueVisited.size,
    totalCount: content.totalCount,
    traceCount,
    fireCount: asCount(fireSignal),
    waterCount: asCount(waterSignal),
    memoryCount: asCount(memorySignal),
    thresholdCount: asCount(thresholdSignal),
    crownCount: asCount(crownSignal),
    fireWaterBalance: Math.max(
      -1,
      Math.min(1, (fireSignal - waterSignal) / Math.max(1, fireSignal + waterSignal)),
    ),
    explorationDepth: clamp01(
      visitedProgress * 0.3 + actProgress * 0.32 + ritualProgress * 0.26 + flagProgress * 0.12,
    ),
    memoryPressure: clamp01(memoryActivation * (1 - releaseProgress * 0.58)),
    symbolicWeight: clamp01(
      0.45 + resonanceMean * 0.22 + ritualProgress * 0.16 + actProgress * 0.12 + flagProgress * 0.05,
    ),
  };
}
