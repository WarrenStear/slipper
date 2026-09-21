export const MOBILE_LOOK_SENSITIVITY_MIN = 0.5;
export const MOBILE_LOOK_SENSITIVITY_MAX = 1.6;
export const MOBILE_INPUT_RESET_EVENT = "sidtw:mobile-input-reset";

export type Point2D = {
  x: number;
  y: number;
};

export type JoystickVector = {
  moveX: number;
  moveZ: number;
  thumbX: number;
  thumbY: number;
  magnitude: number;
};

function finiteOr(value: number, fallback = 0) {
  return Number.isFinite(value) ? value : fallback;
}

export function clampFinite(value: number, min: number, max: number, fallback = 0) {
  return Math.max(min, Math.min(max, finiteOr(value, fallback)));
}

export function clampLookSensitivity(value: number) {
  return clampFinite(
    value,
    MOBILE_LOOK_SENSITIVITY_MIN,
    MOBILE_LOOK_SENSITIVITY_MAX,
    1,
  );
}

export function resolveJoystickVector({
  center,
  pointer,
  radius = 48,
  deadZone = 0.12,
}: {
  center: Point2D;
  pointer: Point2D;
  radius?: number;
  deadZone?: number;
}): JoystickVector {
  const centerX = finiteOr(center.x);
  const centerY = finiteOr(center.y);
  const pointerX = finiteOr(pointer.x, centerX);
  const pointerY = finiteOr(pointer.y, centerY);
  const safeRadius = Math.max(1, finiteOr(radius, 48));
  const safeDeadZone = clampFinite(deadZone, 0, 0.8, 0.12);
  const dx = pointerX - centerX;
  const dy = pointerY - centerY;
  const distance = Math.hypot(dx, dy);
  const limitedDistance = Math.min(distance, safeRadius);
  const directionX = distance > 0.0001 ? dx / distance : 0;
  const directionY = distance > 0.0001 ? dy / distance : 0;
  const rawMagnitude = clampFinite(limitedDistance / safeRadius, 0, 1);
  const magnitude =
    rawMagnitude <= safeDeadZone
      ? 0
      : clampFinite((rawMagnitude - safeDeadZone) / (1 - safeDeadZone), 0, 1);

  const moveX = directionX * magnitude;
  const moveZ = -directionY * magnitude;
  const thumbX = directionX * limitedDistance;
  const thumbY = directionY * limitedDistance;

  return {
    moveX: Math.abs(moveX) < Number.EPSILON ? 0 : moveX,
    moveZ: Math.abs(moveZ) < Number.EPSILON ? 0 : moveZ,
    thumbX: Math.abs(thumbX) < Number.EPSILON ? 0 : thumbX,
    thumbY: Math.abs(thumbY) < Number.EPSILON ? 0 : thumbY,
    magnitude,
  };
}

export function resolveLookDelta({
  deltaX,
  deltaY,
  sensitivity = 1,
  maxDelta = 72,
}: {
  deltaX: number;
  deltaY: number;
  sensitivity?: number;
  maxDelta?: number;
}) {
  const safeSensitivity = clampLookSensitivity(sensitivity);
  const safeMaxDelta = Math.max(8, finiteOr(maxDelta, 72));

  return {
    x: clampFinite(
      finiteOr(deltaX) * safeSensitivity,
      -safeMaxDelta,
      safeMaxDelta,
    ),
    y: clampFinite(
      finiteOr(deltaY) * safeSensitivity,
      -safeMaxDelta,
      safeMaxDelta,
    ),
  };
}

export function isPortraitViewport(width: number, height: number) {
  const safeWidth = finiteOr(width);
  const safeHeight = finiteOr(height);
  return safeWidth > 0 && safeHeight > 0 && safeHeight > safeWidth;
}
