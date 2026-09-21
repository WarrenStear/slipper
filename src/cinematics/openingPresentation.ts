/** Presentation derived from accepted evidence; this module never awards progress. */
export type OpeningPhase = "room" | "first-reveal" | "forest-revealed" | "entered";

export function openingStage(floorState: string | undefined, eventIds: readonly string[], resolved = false): number {
  if (resolved || floorState === "inverted") return 3;
  if (floorState === "revealed") return 2;
  return eventIds.includes("broken-floor.first-wipe") ? 1 : 0;
}

export function openingPhase(stage: number): OpeningPhase {
  return stage >= 3 ? "entered" : stage >= 2 ? "forest-revealed" : stage >= 1 ? "first-reveal" : "room";
}

export function openingRoomTarget(stage: number): number {
  if (!Number.isFinite(stage)) return 0;
  return stage >= 3 ? 1 : Math.max(0, stage) / 5;
}

/** Ignore unwitnessed/stalled time; normal interpolation retains Three's damp. */
export function openingMotionDelta(delta: number, active: boolean): number {
  return active && Number.isFinite(delta) && delta > 0 && delta <= .25 ? Math.min(delta, .05) : 0;
}

export function openingEnclosed(sceneId: string | null | undefined, resolved: boolean): boolean {
  return sceneId === "broken-floor.confession" && !resolved;
}

export type OpeningPointerHandoff = { enclosedAtPress: boolean };
export function createOpeningPointerHandoff(): OpeningPointerHandoff { return { enclosedAtPress: false }; }
export function beginOpeningPointer(handoff: OpeningPointerHandoff, enclosed: boolean): void {
  handoff.enclosedAtPress = enclosed;
}
export function resetOpeningPointer(handoff: OpeningPointerHandoff): void { handoff.enclosedAtPress = false; }
/** The click following the inversion touch still belongs to the floor, not mouse-look. */
export function consumeOpeningClick(handoff: OpeningPointerHandoff, enclosed: boolean): boolean {
  const owned = handoff.enclosedAtPress || enclosed;
  resetOpeningPointer(handoff);
  return owned;
}
