import { STORY_EVENTS } from "../../../storyEvents/storyEventRegistry.ts";

export type MaterialSound = "cloth" | "water" | "candle" | "petal" | "fire" | "key" | "wood" | "creation";
export type StoryEventAudioCue = {
  material?: MaterialSound;
  duration: number;
  gain: number;
  filterHz: number;
  toneHz?: number;
  /** Hold the ambient world at this gain, then gently return. */
  silenceFloor?: number;
  silenceHold?: number;
};

const MATERIAL_CUES: Record<MaterialSound, StoryEventAudioCue> = {
  cloth: { material: "cloth", duration: 0.85, gain: 0.027, filterHz: 1200 },
  water: { material: "water", duration: 1.35, gain: 0.036, filterHz: 1700, toneHz: 116 },
  candle: { material: "candle", duration: 0.28, gain: 0.018, filterHz: 2700 },
  petal: { material: "petal", duration: 0.45, gain: 0.018, filterHz: 800 },
  fire: { material: "fire", duration: 1.2, gain: 0.042, filterHz: 3300, toneHz: 63 },
  key: { material: "key", duration: 0.55, gain: 0.022, filterHz: 3900, toneHz: 740 },
  wood: { material: "wood", duration: 0.75, gain: 0.028, filterHz: 1050, toneHz: 83 },
  creation: { material: "creation", duration: 1.55, gain: 0.017, filterHz: 760, toneHz: 164.81 },
};

const NAMED_CUES: Record<string, StoryEventAudioCue> = {
  "cloth-water": MATERIAL_CUES.cloth,
  "water-close": MATERIAL_CUES.water,
  "restrained-ash": MATERIAL_CUES.fire,
  "wide-water": { ...MATERIAL_CUES.water, duration: 1.6, gain: 0.03 },
  "new-harmonic-layer": MATERIAL_CUES.creation,
  "past-stays-behind": { ...MATERIAL_CUES.wood, gain: 0.018 },
  "questions-fade-with-distance": { duration: 0, gain: 0, filterHz: 800, silenceFloor: 0.24, silenceHold: 1.5 },
  "missing-note": { ...MATERIAL_CUES.wood, silenceFloor: 0.08, silenceHold: 1.3 },
  "relief-without-abandonment": { ...MATERIAL_CUES.cloth, gain: 0.015, silenceFloor: 0.28, silenceHold: 1.6 },
  "flame-refuses-memory": { duration: 0, gain: 0, filterHz: 800, silenceFloor: 0, silenceHold: 2.8 },
  "world-stops": { duration: 0, gain: 0, filterHz: 800, silenceFloor: 0, silenceHold: 6 },
  "mourning-the-familiar": { duration: 0, gain: 0, filterHz: 800, silenceFloor: 0.1, silenceHold: 2 },
  "crown-recognition": { duration: 0, gain: 0, filterHz: 800, silenceFloor: 0, silenceHold: 3.5 },
  "placed-light": { duration: 0, gain: 0, filterHz: 800, silenceFloor: 0, silenceHold: 4.2 },
};

const EVENT_MATERIALS: Record<string, MaterialSound> = {
  "broken-floor.forest-revealed": "water",
  "blue-moon.candle-chain": "candle",
  "blue-moon.roses-carried": "petal",
  "blue-moon.roses-placed": "petal",
  "blue-moon.origami-awakened": "cloth",
  "nest.first-hand": "cloth",
  "nest.second-hand": "wood",
  "nest.linen-sheltered": "cloth",
  "nest.protection-recognised": "key",
  "thorn-house.space-cleared": "wood",
  "thorn-house.frame-rearranged": "wood",
  "thorn-house.key-recognised": "key",
  "river.ash-washed": "water",
  "fork.let-go": "water",
  "fork.declined": "wood",
  "fork.deleted": "cloth",
  "home.gate-recognises-keys": "key",
  "home.water.visited": "water",
  "home.book.visited": "cloth",
  "home.window.visited": "wood",
};
// A temporary contrast in the existing soundscape, not an added score or louder effect.
const DRAMATIC_CONTRAST: Record<string, { silenceFloor: number; silenceHold: number }> = {
  "enchanted.hearth-unease": { silenceFloor: 0.3, silenceHold: 2 },
  "blue-moon.cage-recognised": { silenceFloor: 0.12, silenceHold: 2.8 },
  "thorn-house.refilled": { silenceFloor: 0.24, silenceHold: 1.8 },
  "thorn-house.pattern-returned": { silenceFloor: 0.12, silenceHold: 2.8 },
  "thorn-house.fixing-ended": { silenceFloor: 0.18, silenceHold: 2.5 },
  "integration.three-capacities": { silenceFloor: 0.42, silenceHold: 2.5 },
};
const BY_EVENT = new Map(STORY_EVENTS.map(event => [event.id, event]));

export function resolveStoryEventAudioCue(eventId: string): StoryEventAudioCue | undefined {
  const event = BY_EVENT.get(eventId);
  if (!event) return undefined;
  for (const action of event.actions) {
    if ((action.type === "sound" || action.type === "silence") && NAMED_CUES[action.cue]) return NAMED_CUES[action.cue];
  }
  const material = EVENT_MATERIALS[eventId];
  const contrast = DRAMATIC_CONTRAST[eventId];
  if (contrast) return { duration: 0, gain: 0, filterHz: 1200, ...(material ? MATERIAL_CUES[material] : {}), ...contrast };
  return material ? MATERIAL_CUES[material] : undefined;
}

/** Save restores and already-completed events are silent; limit catch-up bursts. */
export function newAudibleStoryEvents(previous: ReadonlySet<string>, completed: readonly string[]) {
  const additions = completed.filter(id => !previous.has(id));
  if (additions.length > 6) return [];
  return additions.filter(id => Boolean(resolveStoryEventAudioCue(id))).slice(-3);
}

export function eventSilenceGain(seconds: number, hold: number, floor: number) {
  const boundedFloor = Math.max(0, Math.min(1, floor));
  if (seconds <= 0) return 1;
  if (seconds < 0.14) return 1 - (1 - boundedFloor) * (seconds / 0.14);
  if (seconds < hold + 0.14) return boundedFloor;
  return boundedFloor + (1 - boundedFloor) * Math.min(1, (seconds - hold - 0.14) / 1.8);
}

export const MAX_STORY_EVENT_VOICES = 3;
export const MAX_CACHED_EVENT_BUFFERS = 12;

/** Deterministic tactile noise, with no random network samples or score files. */
export function materialSoundSamples(cue: StoryEventAudioCue, sampleRate: number) {
  const data = new Float32Array(Math.ceil(sampleRate * cue.duration));
  let random = 0x531f3d + Math.round(cue.filterHz);
  let low = 0;
  for (let index = 0; index < data.length; index += 1) {
    random = (1664525 * random + 1013904223) >>> 0;
    const white = random / 0xffffffff * 2 - 1;
    low += (white - low) * 0.065;
    const time = index / sampleRate;
    const proportion = index / Math.max(1, data.length - 1);
    const envelope = Math.sin(Math.PI * proportion) ** 2;
    const friction = cue.material === "cloth" ? 0.65 + Math.sin(time * 19) * 0.2 : 1;
    const crackle = cue.material === "fire" ? (white > 0.87 ? white * 0.3 : low * 0.8) : low;
    const body = cue.toneHz ? Math.sin(time * Math.PI * 2 * cue.toneHz) * (cue.material === "key" ? 0.11 : 0.05) * Math.exp(-time * 5) : 0;
    data[index] = Math.max(-1, Math.min(1, (crackle * friction + body) * envelope));
  }
  return data;
}
