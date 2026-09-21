import type { ContextualRitual, ContextualRitualVerb, RitualInputMode } from "./ritualTypes";

const RITUAL_PRESENTATIONS: Record<string, ContextualRitual> = {
  "ritual.accept-lantern": {
    id: "ritual.accept-lantern",
    verb: "carry",
    label: "Accept the Lantern",
    instruction: "Acknowledge that you are willing to see what the wood remembers.",
    inputMode: "hold",
    durationMs: 1500,
  },
  "ritual.witness-mirror": {
    id: "ritual.witness-mirror",
    verb: "witness",
    label: "Witness without changing",
    instruction: "Do not force the reflection. Let it arrive while you remain still.",
    inputMode: "stillness",
    durationMs: 6200,
  },
  "ritual.recover-key": {
    id: "ritual.recover-key",
    verb: "recover",
    label: "Recover the Key",
    instruction: "Stop trying every door. Take back the permission that was always yours.",
    inputMode: "hold",
    durationMs: 1750,
  },
  "ritual.accept-memory": {
    id: "ritual.accept-memory",
    verb: "touch",
    label: "Accept the Memory",
    instruction: "Keep the beauty true without returning to the cage that held it.",
    inputMode: "press",
  },
  "ritual.burn-boundary": {
    id: "ritual.burn-boundary",
    verb: "burn",
    label: "Burn what cannot continue",
    instruction: "Give the fire one burden that no longer belongs in your hands.",
    inputMode: "hold",
    durationMs: 1800,
  },
  "ritual.wash-grief": {
    id: "ritual.wash-grief",
    verb: "wash",
    label: "Wash what still aches",
    instruction: "Let the river hold the tenderness without asking it to become a cage.",
    inputMode: "hold",
    durationMs: 1800,
  },
  "ritual.release-river-memory": {
    id: "ritual.release-river-memory",
    verb: "release",
    label: "Release the remembered words",
    instruction: "Allow the words to leave without erasing what they once meant.",
    inputMode: "press",
  },
  "ritual.surrender": {
    id: "ritual.surrender",
    verb: "surrender",
    label: "Surrender",
    instruction: "There is nothing left to force. Let the world move while you do not.",
    inputMode: "stillness",
    durationMs: 7600,
  },
  "ritual.place-lantern": {
    id: "ritual.place-lantern",
    verb: "place",
    label: "Place the Lantern",
    instruction: "Set the light down. The capacity to see does not leave when your hands open.",
    inputMode: "hold",
    durationMs: 2200,
  },
};

const DEFAULT_INPUT_BY_VERB: Record<ContextualRitualVerb, RitualInputMode> = {
  witness: "stillness",
  touch: "press",
  hold: "hold",
  wash: "hold",
  burn: "hold",
  release: "press",
  recover: "hold",
  surrender: "stillness",
  plant: "press",
  leave: "press",
  place: "hold",
  carry: "hold",
};

export function resolveRitualPresentation(
  ritualId: string,
  fallback?: {
    verb?: ContextualRitualVerb;
    label?: string;
    instruction?: string;
    inputMode?: RitualInputMode;
    durationMs?: number;
  },
): ContextualRitual {
  const authored = RITUAL_PRESENTATIONS[ritualId];
  if (authored) return authored;
  const verb = fallback?.verb ?? "touch";
  return {
    id: ritualId,
    verb,
    label: fallback?.label ?? verb.charAt(0).toUpperCase() + verb.slice(1),
    instruction: fallback?.instruction ?? "Stay with the object until the world answers.",
    inputMode: fallback?.inputMode ?? DEFAULT_INPUT_BY_VERB[verb],
    durationMs: fallback?.durationMs,
  };
}

export function isKnownRitualId(ritualId: string) {
  return Object.prototype.hasOwnProperty.call(RITUAL_PRESENTATIONS, ritualId);
}
