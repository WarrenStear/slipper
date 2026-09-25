/** Visual attention only: this never awards or changes a story event. */
export function advancePresentationStillness(elapsed: number, delta: number, active: boolean, insideClearing: boolean, speed: number, turnSpeed: number, stillSpeed = .025) {
  if (!active || !insideClearing || !Number.isFinite(delta) || delta <= 0 || delta > .25
    || !Number.isFinite(speed) || !Number.isFinite(turnSpeed) || speed >= stillSpeed || turnSpeed >= .035) return 0;
  return elapsed + Math.min(delta, .05);
}
