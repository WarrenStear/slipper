/** Metres and seconds; keep the established capsule and terrain response. */
export const PLAYER_RADIUS = 0.28;
export const PLAYER_HALF_HEIGHT = 0.54;
export const PLAYER_FOOT_OFFSET = PLAYER_HALF_HEIGHT + PLAYER_RADIUS;
export const PLAYER_GROUND_CLEARANCE = 0.035;
export const PLAYER_KCC_OFFSET = 0.045;
export const PLAYER_SPEED = 4.08;
export const PLAYER_ACCELERATION = 10.8;
export const PLAYER_GRAVITY = 18;
export const PLAYER_MAX_FALL_SPEED = 22;
export const PLAYER_GROUND_SNAP = 0.34;
export const PLAYER_STEP_HEIGHT = 0.42;
export const PLAYER_MIN_STEP_WIDTH = 0.18;
export const PLAYER_SLOPE_LIMIT_RADIANS = 48 * Math.PI / 180;
export const PLAYER_SLIDE_LIMIT_RADIANS = 58 * Math.PI / 180;

export function playerFrameDelta(delta: number) {
  return Number.isFinite(delta) && delta > 0 ? Math.min(delta, 0.05) : 0;
}

export function requestedMovementMagnitude(keyboardActive: boolean, moveX: number, moveZ: number) {
  const mobileMagnitude = Math.min(1, Math.hypot(moveX, moveZ));
  return Math.max(keyboardActive ? 1 : 0, mobileMagnitude);
}

/** Defensive terrain support while a collider mounts or misses a steep triangle. */
export function groundedBodyHeight({ bodyY, groundY, verticalVelocity, grounded, moving }: {
  bodyY: number; groundY: number; verticalVelocity: number; grounded: boolean; moving: boolean;
}) {
  const minimumBodyY = groundY + PLAYER_FOOT_OFFSET + PLAYER_GROUND_CLEARANCE;
  const groundDelta = bodyY - minimumBodyY;
  const isFallingOrGrounded = verticalVelocity <= 0 || grounded;
  const snap = groundDelta < -0.012 || (isFallingOrGrounded && groundDelta < PLAYER_GROUND_SNAP && moving);
  return { bodyY: snap ? minimumBodyY : bodyY, snap };
}
