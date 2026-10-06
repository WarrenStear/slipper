import type { JourneySceneId, StoryJourneyState } from "../lib/storyJourneyState.ts";
import type { StoryEventInput } from "../storyEvents/storyEventTypes.ts";
import type { StoryActionSink } from "./StoryActions.ts";

/** An opaque instance-local authorization; never serialized or inferred from mounting. */
export type StoryLease = Readonly<object>;
export type StoryPhysicalAttentionFacts = Readonly<{
  revision: number; observedAtMs: number | null; available: boolean; fresh: boolean;
  settled: boolean; inputEnabled: boolean; stillEligible: boolean;
}>;
export type StoryPhysicalCrossingFacts = StoryPhysicalAttentionFacts & Readonly<{
  thresholdEntryId: string | null; crossed: boolean;
}>;
export type StoryPhysicalPresenceFacts = Omit<StoryPhysicalAttentionFacts, "stillEligible">;
export type StoryRuntimeActivity = Readonly<{
  ready: boolean;
  foreground: boolean;
  overlayOpen: boolean;
  participating: boolean;
  reducedMotion?: boolean;
}>;
export type StoryCommandSink = StoryActionSink & {
  startStory(): void;
  navigateToEntry(entryId: string): void;
  goBack(): string | null;
  witnessEntry(entryId: string): void;
  enterBeat(actId: StoryJourneyState["actId"], beatId: string): void;
  completeScene(sceneId: JourneySceneId): void;
  completeChapter(chapterId: StoryJourneyState["chapterId"]): void;
  dispatchStoryEvent(input: StoryEventInput): string[];
};
export type StoryRuntimeStore = StoryJourneyState & StoryCommandSink & {
  sceneRelocationRevision?: number;
};
export type StoryIntent =
  | { type: "begin" }
  | { type: "continue" }
  | { type: "navigate"; entryId: string; expectedEntryId?: string; kind?: "explicit"; read?: boolean }
  | { type: "navigate"; entryId: string; expectedEntryId?: string; kind: "crossing"; lease: StoryLease;
      nowMs: number; facts: StoryPhysicalCrossingFacts; read?: boolean }
  | { type: "back"; expectedEntryId?: string; read?: boolean }
  | { type: "read"; entryId: string; lease: StoryLease }
  | { type: "witness"; entryId: string; lease: StoryLease }
  | { type: "presence"; entryId: string; lease: StoryLease; nowMs: number;
      facts: StoryPhysicalPresenceFacts & { insideClearing: boolean } }
  | { type: "event"; eventId: string; lease: StoryLease }
  | { type: "drop"; objectId: string; lease: StoryLease }
  | { type: "ritual"; ritualId: string; lease: StoryLease }
  | { type: "legacy-start"; actionId: string; lease: StoryLease }
  | { type: "legacy-action"; actionId: string; choiceId?: string; lease: StoryLease;
      actionToken?: StoryLease; source?: "semantic" | "physical"; playerLocalPosition?: readonly [number, number] };
export type StoryIntentResult = Readonly<{
  accepted: boolean;
  reason?: string;
  lease?: StoryLease;
  actionToken?: StoryLease;
  eventIds: readonly string[];
  messages: readonly string[];
  settled: number;
}>;
