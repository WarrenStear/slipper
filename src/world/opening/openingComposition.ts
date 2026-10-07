import { MathUtils } from "three";
import { openingMotionDelta, openingRoomTarget } from "../../cinematics/openingPresentation.ts";

/** Supplied time only: accepted narrative stages remain the caller's authority. */
export function advanceOpeningRoom(previous: number, stage: number, delta: number, active: boolean, reducedMotion: boolean) {
  const target = openingRoomTarget(stage);
  return reducedMotion && active ? target
    : MathUtils.damp(previous, target, 3 / 8, openingMotionDelta(delta, active));
}

export function openingRoomAppearance(value: number) {
  const progress = MathUtils.smootherstep(Number.isFinite(value) ? value : 0, 0, 1);
  return {
    progress,
    roomOpacity: 1 - MathUtils.smoothstep(progress, .46, .96),
    floorVisible: progress <= .70,
    floorY: -.16 - MathUtils.smoothstep(progress, .46, .70) * .48,
    apertureOpacity: .94 * (1 - MathUtils.smoothstep(progress, .72, .96)),
  };
}

/** The existing bough mesh moves around its own attachment, under the shared clock. */
export function openingBoughPose(time: number, motion: number, reduced: boolean) {
  const amount = Number.isFinite(motion) ? MathUtils.clamp(motion, 0, 1) : 0;
  if (reduced || !Number.isFinite(time) || amount === 0) return { x: 0, z: 0 };
  return { x: Math.sin(time * .31) * .0011 * amount, z: Math.sin(time * .23) * .0034 * amount };
}
