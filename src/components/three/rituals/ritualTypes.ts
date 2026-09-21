import type { Vector3Tuple } from "../../../data/slipper3dTypes";

export type ContextualRitualVerb =
  | "witness"
  | "touch"
  | "hold"
  | "wash"
  | "burn"
  | "release"
  | "recover"
  | "surrender"
  | "plant"
  | "leave"
  | "place"
  | "carry";

export type RitualInputMode = "press" | "hold" | "stillness";

export type ContextualRitual = {
  id: string;
  verb: ContextualRitualVerb;
  label: string;
  instruction: string;
  inputMode: RitualInputMode;
  durationMs?: number;
};

export type RitualPresence = {
  insideClearing: boolean;
  playerPosition: Vector3Tuple | null;
};
