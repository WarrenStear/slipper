import type { JourneySceneId, StoryJourneyState, LandmarkState, ResonanceKey } from "../lib/storyJourneyState.ts";

export type StoryEventTrigger = "scene-enter" | "volume-enter" | "volume-exit" | "gaze" | "inspect" | "touch" | "pickup" | "place" | "drop" | "open" | "close" | "wipe" | "light" | "extinguish" | "burn" | "wash" | "plant" | "release" | "stillness" | "scene-complete" | "sequence-complete";
export type StoryEventInput = { sceneId: JourneySceneId; trigger: StoryEventTrigger; /** Optional for legacy callers; physical/semantic controls bind the chosen event. */ eventId?: string; objectId?: string; targetId?: string; /** Milliseconds of witnessed attention (continuous for gaze/stillness). */ duration?: number };
export type StoryObjectKind = "water" | "lantern" | "candle" | "rose" | "origami" | "door" | "mirror" | "fabric" | "basket" | "chair" | "frame" | "book" | "key" | "wolf" | "swan" | "fire" | "letter" | "feather" | "marker" | "seed" | "page" | "nest" | "birds" | "path";
export type StoryPlacementTarget = { id: string; label: string; localPosition: [number, number, number]; radius: number };
export type StoryObjectDefinition = { id: string; label: string; kind: StoryObjectKind; sceneIds: readonly JourneySceneId[]; localPosition: [number, number, number]; radius: number; verbs: readonly StoryEventTrigger[]; targets?: readonly StoryPlacementTarget[]; carryable?: boolean; keepsake?: boolean };
export type StoryEventCondition = { type: "event"; id: string } | { type: "flag"; id: string } | { type: "object"; id: string; state: string } | { type: "key"; id: string } | { type: "not-object"; id: string; state: string };
export type StoryEventAction =
  | { type: "object-state"; objectId: string; state: string }
  | { type: "placement"; objectId: string; targetId: string }
  | { type: "world-flag"; flagId: string }
  | { type: "ritual"; ritualId: string }
  | { type: "key"; keyId: string }
  | { type: "symbol"; objectId: string }
  | { type: "lantern" }
  | { type: "landmark"; landmarkId: string; state: LandmarkState }
  | { type: "resonance"; key: ResonanceKey; amount: number }
  | { type: "release-word"; word: string }
  | { type: "actor"; actor: "lantern" | "wolf" | "swan" | "seer" | "birds"; cue: string }
  | { type: "camera" | "sound" | "silence" | "lighting" | "environment" | "prose" | "path"; cue: string };
export type StoryEventDefinition = { id: string; sceneId: JourneySceneId; trigger: StoryEventTrigger; objectId?: string; targetId?: string; durationMs?: number; requires?: readonly StoryEventCondition[]; actions: readonly StoryEventAction[]; /** Alternate choices share a terminal group. */ completionGroup?: string; optional?: boolean };
export type StoryEventPersistentState = { completedStoryEventIds: string[]; storyObjectStates: Record<string, string>; storyPlacementStates: Record<string, string> };
export type StoryEventStateInput = Pick<StoryJourneyState, "sceneId" | "completedSceneIds" | "worldFlags" | "inventory"> & Partial<StoryEventPersistentState>;
