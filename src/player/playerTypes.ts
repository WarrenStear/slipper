import type { Vector3Tuple } from "../data/slipper3dTypes";

export type PlayerControls = "orbit" | "walk" | "none";
export type ExperienceMode = "explore" | "read" | "map";

/** Frame-local physics output. It is never persisted or published through React. */
export type PlayerPose = {
  position: { x: number; y: number; z: number };
  speedRatio: number;
  available: boolean;
};

export type PlayerPoseRef = { current: PlayerPose };

export function createPlayerPose(position: Vector3Tuple): PlayerPose {
  return {
    position: { x: position[0], y: position[1], z: position[2] },
    speedRatio: 0,
    available: false,
  };
}
