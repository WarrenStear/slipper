import type { Vector3Tuple } from "../data/slipper3dTypes";
import type { ExperienceMode, PlayerControls } from "./playerTypes";

export const PLAYER_EYE_HEIGHT = 0.64;
export const PLAYER_CAMERA_OFFSET_Y = 1.16;
export const PLAYER_LOOK_DOWN_LIMIT = Math.PI * 0.3;
export const PLAYER_LOOK_UP_LIMIT = Math.PI * 0.28;
export const HEAD_BOB_AMPLITUDE = 0.014;
export const HEAD_BOB_FREQUENCY = 6.8;

/** Arrival receives an authored pose, never a fragment or progression rule. */
export function resolveCameraArrival({ mode, controls, activePosition, playerInitialPosition, cameraStart, cameraTarget, guidanceLookTarget, lowView }: {
  mode: ExperienceMode; controls: PlayerControls; activePosition: Vector3Tuple; playerInitialPosition: Vector3Tuple;
  cameraStart: Vector3Tuple; cameraTarget: Vector3Tuple; guidanceLookTarget: Vector3Tuple | null; lowView: boolean;
}) {
  const isWalkMode = mode === "explore" && controls === "walk";
  const cameraOrigin: Vector3Tuple = isWalkMode
    ? [playerInitialPosition[0], playerInitialPosition[1] + (lowView ? .08 : PLAYER_CAMERA_OFFSET_Y), playerInitialPosition[2]]
    : [activePosition[0] + cameraStart[0], activePosition[1] + cameraStart[1], activePosition[2] + cameraStart[2]];
  const entryOffset = mode === "read" ? .22 : .36;
  const from: Vector3Tuple = [cameraOrigin[0] + entryOffset, cameraOrigin[1] + .04, cameraOrigin[2] + .65];
  const focus: Vector3Tuple = isWalkMode && guidanceLookTarget
    ? [guidanceLookTarget[0], Math.max(guidanceLookTarget[1], cameraOrigin[1] + .12), guidanceLookTarget[2]]
    : [activePosition[0] + cameraTarget[0], activePosition[1] + (isWalkMode ? Math.max(cameraTarget[1], PLAYER_EYE_HEIGHT * .82) : cameraTarget[1]), activePosition[2] + cameraTarget[2]];
  if (isWalkMode && lowView) {
    const dx = focus[0] - cameraOrigin[0], dz = focus[2] - cameraOrigin[2];
    const length = Math.max(.1, Math.hypot(dx, dz));
    focus[0] = cameraOrigin[0] + dx / length * 2.3;
    focus[1] = cameraOrigin[1] - .7;
    focus[2] = cameraOrigin[2] + dz / length * 2.3;
  }
  return { from, to: cameraOrigin, focus };
}

/** Arrival owns the shot until it settles; body follow cannot replace it early. */
export function cameraFrameAuthority(arrivalProgress: number, walkMode: boolean, poseAvailable: boolean) {
  if (arrivalProgress < 1) return "arrival" as const;
  return walkMode && poseAvailable ? "player" as const : "view" as const;
}

export function cameraLookPitch(pitch: number, delta: number, sensitivity: number) {
  return Math.max(-PLAYER_LOOK_DOWN_LIMIT, Math.min(PLAYER_LOOK_UP_LIMIT, pitch - delta * sensitivity));
}

export function cameraHeadBob(phase: number, speedRatio: number, suppression: number, reducedMotion: boolean, reducedEffects: boolean) {
  return reducedMotion || reducedEffects ? 0 : Math.sin(phase) * HEAD_BOB_AMPLITUDE * speedRatio * suppression;
}
