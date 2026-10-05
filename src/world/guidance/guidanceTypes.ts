import type { Vector3Tuple } from "../../data/slipper3dTypes";
import type { TrailState } from "../../lib/navigationResolver";

/** Compatibility projection for existing UI, lantern and safe-clearing persistence. */
export type SceneProximityState = {
  activeEntryId: string; nearestEntryId: string | null; nearestTitle: string | null; distance: number;
  uiPresence: number; insideClearing: boolean; playerPosition: Vector3Tuple;
  activeWorldPosition: Vector3Tuple | null; nearestWorldPosition: Vector3Tuple | null;
  approachingEntryId: string | null; approachingTitle: string | null; approachingDistance: number;
  approachingWorldPosition: Vector3Tuple | null; cameraYaw: number;
  navigationTargetId: string | null; navigationTargetTitle: string | null;
  navigationTargetWorldPosition: Vector3Tuple | null; navigationTargetDistance: number;
  navigationTargetReason: string | null; nearestPathDistance: number; trailState: TrailState;
};

export type PlayerSpatialWindow = {
  position: Vector3Tuple; cameraYaw: number; navigationTargetId: string | null;
  nearestPathDistance: number; trailState: TrailState;
};
