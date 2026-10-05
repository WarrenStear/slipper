import type { Vector3Tuple } from "../data/slipper3dTypes";

export const NODE_ACTIVATION_RADIUS = 3.15;
export const NODE_ACTIVATION_RADIUS_SQ = NODE_ACTIVATION_RADIUS * NODE_ACTIVATION_RADIUS;
export const INTERACTION_SAMPLE_INTERVAL = 0.08;

export type PhysicalInteractionTarget = { id: string; position: Vector3Tuple; active: boolean };
export type NearbyPhysicalTarget = PhysicalInteractionTarget & { distance: number; distanceSq: number };
export type InteractionProximity = {
  playerPosition: Vector3Tuple; cameraYaw: number; insideClearing: boolean;
  active: PhysicalInteractionTarget | null; nearest: NearbyPhysicalTarget | null; nearestInactive: NearbyPhysicalTarget | null;
};

/** Range facts only: no chapter, lock, visit, ritual, or outcome knowledge. */
export function detectInteractionProximity(targets: readonly PhysicalInteractionTarget[], playerPosition: Vector3Tuple, cameraYaw: number, clearingRadius: number): InteractionProximity {
  let active: PhysicalInteractionTarget | null = null;
  let closest: PhysicalInteractionTarget | null = null;
  let closestInactive: PhysicalInteractionTarget | null = null;
  let nearestDistanceSq = Infinity;
  let nearestInactiveDistanceSq = Infinity;
  for (const target of targets) {
    if (target.active && !active) active = target;
    const dx = playerPosition[0] - target.position[0], dz = playerPosition[2] - target.position[2];
    const distanceSq = dx * dx + dz * dz;
    if (distanceSq < nearestDistanceSq) { closest = target; nearestDistanceSq = distanceSq; }
    if (!target.active && distanceSq < nearestInactiveDistanceSq) { closestInactive = target; nearestInactiveDistanceSq = distanceSq; }
  }
  const nearest = closest ? { ...closest, distanceSq: nearestDistanceSq, distance: Math.sqrt(nearestDistanceSq) } : null;
  const nearestInactive = closestInactive ? { ...closestInactive, distanceSq: nearestInactiveDistanceSq, distance: Math.sqrt(nearestInactiveDistanceSq) } : null;
  return { active, nearest, nearestInactive, playerPosition, cameraYaw, insideClearing: Boolean(nearest && nearest.distance <= clearingRadius) };
}

/** An entry observation has hysteresis, so standing at a threshold emits once. */
export function observedThresholdEntry(nearestInactive: NearbyPhysicalTarget | null, lastEnteredId: string | null) {
  if (nearestInactive && nearestInactive.distanceSq <= NODE_ACTIVATION_RADIUS_SQ && nearestInactive.id !== lastEnteredId) {
    return { enteredId: nearestInactive.id, lastEnteredId: nearestInactive.id };
  }
  if (!nearestInactive || nearestInactive.distanceSq > NODE_ACTIVATION_RADIUS_SQ * 2.25) {
    return { enteredId: null, lastEnteredId: null };
  }
  return { enteredId: null, lastEnteredId };
}
