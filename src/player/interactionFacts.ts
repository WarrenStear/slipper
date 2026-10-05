/** Coordinates in one physical reference frame; no story state is accepted. */
export type InteractionVector = Readonly<{ x: number; y: number; z: number }>;

export type InteractionFacts = Readonly<{
  distance: number;
  alignment: number;
  inside: boolean;
  looking: boolean;
}>;

/**
 * Grounded reach uses the horizontal plane; gaze includes the target's height.
 * This observation cannot accept an interaction or apply a narrative outcome.
 */
export function observeInteractionTarget(
  observer: InteractionVector,
  forward: InteractionVector,
  target: InteractionVector,
  radius: number,
): InteractionFacts {
  const x = target.x - observer.x;
  const y = target.y - observer.y;
  const z = target.z - observer.z;
  const lengthSquared = x * x + y * y + z * z;
  if (!Number.isFinite(lengthSquared) || !Number.isFinite(radius) || radius < 0 ||
    ![forward.x, forward.y, forward.z].every(Number.isFinite)) {
    return { distance: Infinity, alignment: 0, inside: false, looking: false };
  }
  const distance = Math.hypot(x, z);
  const inverseLength = lengthSquared > .001 ? 1 / Math.sqrt(lengthSquared) : 0;
  const alignment = lengthSquared > .001
    ? x * inverseLength * forward.x + y * inverseLength * forward.y + z * inverseLength * forward.z
    : 1;
  return { distance, alignment, inside: distance <= radius, looking: alignment > .7 || distance < .85 };
}
