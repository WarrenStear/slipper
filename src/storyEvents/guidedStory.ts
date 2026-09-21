import { getJourneyScene } from "../data/journeyNarrative.ts";
import { getAvailableStoryEvents, getStoryObject, isSceneStoryComplete, STORY_EVENTS } from "./storyEventRegistry.ts";
import type { StoryEventDefinition, StoryEventStateInput, StoryEventTrigger } from "./storyEventTypes.ts";

export type GuidedStoryBeat = {
  sceneId: StoryEventStateInput["sceneId"];
  kind: "action" | "choice" | "quiet" | "sequence" | "complete" | "waiting";
  title: string;
  instruction: string;
  hint: string;
  eventIds: readonly string[];
  targetLabel: string | null;
};

const INTERNAL = new Set<StoryEventTrigger>(["scene-enter", "scene-complete"]);
const VERBS: Partial<Record<StoryEventTrigger, string>> = {
  wipe: "Wipe", touch: "Touch", pickup: "Carry", place: "Place", open: "Open", close: "Close",
  light: "Light", extinguish: "Extinguish", burn: "Bring", wash: "Wash in", release: "Release",
  plant: "Plant", inspect: "Look closely at", gaze: "Look toward", stillness: "Rest beside",
  "volume-enter": "Walk toward", "volume-exit": "Walk away from",
};
const DIRECTIONS: Record<string, [string, string]> = {
  "broken-floor.first-wipe": ["Wipe the wet floor.", "Drag across the water. A deliberate sweep clears more than a small repeated movement."],
  "broken-floor.forest-revealed": ["Wipe again. Stay with what is beneath the water.", "Make a second, separate sweep across the wet floor."],
  "broken-floor.inversion": ["Touch the forest in the reflection.", "Release your gesture, then touch the cleared floor once."],
  "enchanted.follow-light": ["Follow the distant lantern.", "Walk toward its light. It waits for you; there is no need to run."],
  "thorn-house.first-departure": ["Step outside through the front doorway.", "Leave the room through the open front door, then return to see what remains."],
  "thorn-house.second-departure": ["Step outside once more.", "Use the front doorway. Return when you are ready to look again."],
  "thorn-house.refilled": ["Return through the doorway.", "Look at the space you cleared."],
  "thorn-house.pattern-returned": ["Return to the room.", "Look at the frame you moved."],
  "thorn-house.fixing-ended": ["Stop rearranging. Be still beside the frame.", "Remain near the frame without moving. This moment does not ask you to fix it again."],
  "mind.questions-left": ["Walk beyond the questions.", "You can notice the pages without answering them. The onward path is the required step."],
  "river.birds-released": ["Release the birds.", "Approach them, then release. What follows does not ask you to chase them."],
};
const CHOICES: Record<string, string> = {
  "heart.choice": "Choose one memory to carry forward.",
  "womb.material": "Choose one material for what comes next.",
  "womb.creation": "Give your chosen material a place.",
  "lantern.placement": "Choose where the lantern will remain.",
};

function instructionFor(event: StoryEventDefinition) {
  const object = event.objectId ? getStoryObject(event.objectId) : undefined;
  const target = object?.targets?.find(item => item.id === event.targetId);
  const name = object?.label ?? "this place";
  if (DIRECTIONS[event.id]) return DIRECTIONS[event.id];
  const instruction = `${VERBS[event.trigger] ?? "Notice"} ${name}${target ? ` — ${target.label}` : ""}.`;
  if (event.trigger === "gaze") return [instruction, "Move closer and keep it in view. Looking away interrupts this moment."];
  if (event.trigger === "stillness") return [instruction, "Settle near it and stop moving. You can leave the moment at any time."];
  if (event.trigger === "volume-enter") return [instruction, "Move closer. The moment unfolds when you arrive."];
  if (event.trigger === "volume-exit") return [instruction, "Approach it first, then walk away through the path beyond it."];
  if (target) return [instruction, `Carry it to ${target.label}, then use the action that appears there.`];
  return [instruction, "Move close and look toward it. Use the action that appears, or interact with the object itself."];
}

/** Advice only: never completes an event, changes order, or exposes a future scene. */
export function resolveGuidedStory(state: StoryEventStateInput): GuidedStoryBeat {
  const scene = getJourneyScene(state.sceneId);
  const base = { sceneId: state.sceneId, title: scene?.title ?? "This place", eventIds: [] as string[], targetLabel: null };
  if (isSceneStoryComplete(state)) return { ...base, kind: "complete", instruction: scene?.presentation.completionLine ?? "This moment remains with you.", hint: "You can read this memory or follow the next path when you are ready." };
  const available = getAvailableStoryEvents(state).filter(event => !INTERNAL.has(event.trigger));
  const sequence = available.find(event => event.trigger === "sequence-complete");
  if (sequence) return { ...base, kind: "sequence", instruction: "Let the remembered places return in light.", hint: "The sequence waits when you leave this page.", eventIds: [sequence.id] };
  const event = available.find(event => !event.optional) ?? available.find(event => event.trigger === "pickup");
  if (!event) return { ...base, kind: "waiting", instruction: "Stay with this place.", hint: "Read the current memory, or look around while the moment settles." };
  // Never turn Surrender, the last constellation or a choice into a target-chasing task.
  const quiet = (state.sceneId === "river.release-surrender" && event.trigger === "stillness") || state.sceneId === "epilogue.constellation";
  if (quiet) return { ...base, kind: "quiet", instruction: "Remain here in stillness.", hint: "There is nothing to chase or collect in this interval.", eventIds: [event.id] };
  const options = event.completionGroup ? available.filter(item => item.completionGroup === event.completionGroup) : [event];
  if (options.length > 1) return { ...base, kind: "choice", instruction: CHOICES[event.completionGroup!] ?? "Choose what you will carry forward.", hint: "Only one choice is needed. The alternatives are not unfinished tasks.", eventIds: options.map(item => item.id) };
  const [instruction, hint] = instructionFor(event);
  const object = event.objectId ? getStoryObject(event.objectId) : undefined;
  const target = object?.targets?.find(item => item.id === event.targetId);
  return { ...base, kind: "action", instruction, hint, eventIds: [event.id], targetLabel: target?.label ?? object?.label ?? null };
}

/** Environmental captions, not replacements for or quotations of the canonical writing. */
export const STORY_RESPONSES: Readonly<Record<string, string>> = {
  "broken-floor.first-wipe": "A clear patch opens in the water.",
  "broken-floor.forest-revealed": "The branches were beneath you all along.",
  "broken-floor.inversion": "The room becomes the reflection. The forest is now around you.",
  "enchanted.follow-light": "The light waits. A presence crosses the path.",
  "enchanted.meadow-warmth": "For a moment, the clearing makes room for rest.",
  "enchanted.hearth-unease": "The warmth is still here. Something in it no longer settles.",
  "blue-moon.candle-chain": "One small flame calls the others into light.",
  "blue-moon.water-reveal": "The reflection does not quite move with you.",
  "blue-moon.roses-placed": "The flowers remain where you chose to place them.",
  "blue-moon.origami-awakened": "Folded paper becomes movement.",
  "blue-moon.door-opened": "The door opens. A note is missing from the quiet.",
  "blue-moon.cage-recognised": "The beauty remains. So does the cage.",
  "nest.burden-set-down": "The weight can rest without leaving the shelter unprotected.",
  "nest.linen-sheltered": "What you carried now has a safe place.",
  "sunset.truth.seen": "Stillness leaves the truth undisturbed.",
  "thorn-house.refilled": "You moved it. The room has returned it.",
  "thorn-house.pattern-returned": "Again. The frame has returned, and the room is closer.",
  "thorn-house.fixing-ended": "You stop. The house does not need to agree.",
  "thorn-house.exit-crossed": "The house remains behind you.",
  "integration.three-capacities": "Tenderness, boundary and truth remain in the same clearing.",
  "fire.true-memory.flame": "The flame falls quiet. This memory remains intact.",
  "river.ash-washed": "The residue loosens. The memory is not erased.",
  "fork.declined": "The door closes. The past stays on its own side.",
  "fork.deleted": "The mark fades from the surface.",
  "lantern.owned": "The light follows intention now.",
  "mind.questions-left": "The unanswered questions remain behind you.",
  "crown.recognised": "The reflection holds what was already there.",
};
const EVENTS = new Map(STORY_EVENTS.map(event => [event.id, event]));
export function storyResponseFor(sceneId: string, eventIds: readonly string[]): string | null {
  for (const id of [...eventIds].reverse()) {
    const event = EVENTS.get(id);
    if (!event || event.sceneId !== sceneId || INTERNAL.has(event.trigger)) continue;
    if (STORY_RESPONSES[id]) return STORY_RESPONSES[id];
    if (event.completionGroup === "heart.choice") return "The chosen memory comes with you. The others do not need to be taken.";
    if (event.completionGroup === "womb.creation") return "Something new has a place in the world.";
    if (event.completionGroup === "lantern.placement") return "The lantern remains lit where you placed it.";
  }
  return null;
}
