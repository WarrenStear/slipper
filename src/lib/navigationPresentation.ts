export type TrailState =
  | "inside-clearing"
  | "on-trail"
  | "edge-of-trail"
  | "lost";

export function rotateXZByYaw(dx: number, dz: number, yaw: number) {
  const cos = Math.cos(-yaw);
  const sin = Math.sin(-yaw);
  return {
    x: dx * cos - dz * sin,
    z: dx * sin + dz * cos,
  };
}

export function trailStateForDistance(
  distance: number,
  insideClearing = false,
): TrailState {
  if (insideClearing) return "inside-clearing";
  if (distance < 2.5) return "on-trail";
  if (distance < 5.5) return "edge-of-trail";
  return "lost";
}

export function trailStateLabel(state: TrailState) {
  if (state === "inside-clearing") return "inside";
  if (state === "on-trail") return "on trail";
  if (state === "edge-of-trail") return "edge";
  return "lost";
}
