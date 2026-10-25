/**
 * One deterministic route geometry contract for the 3D forest, map/navigation,
 * streamed terrain seeds and Web Worker. These functions have no Three.js,
 * React, DOM, worker, or save-state dependencies.
 */
export type PhysicalPathPoint = { x: number; y: number };

function routeUnit(seed: number, index: number) {
  const value = Math.sin(seed * 999 + index * 77.13) * 10000;
  return value - Math.floor(value);
}

/** The established gently bending woodland route, with restrained crown ramps. */
export function createPhysicalRouteGeometry(
  source: PhysicalPathPoint,
  target: PhysicalPathPoint,
  seed: number,
  crownRamp = false,
) {
  const dx = target.x - source.x;
  const dy = target.y - source.y;
  const distance = Math.sqrt(dx * dx + dy * dy);
  const normalX = distance > 0 ? -dy / distance : 0;
  const normalY = distance > 0 ? dx / distance : 0;
  const length = Math.max(0.001, distance);
  const bendLimit = crownRamp ? 1.6 : 2.8;
  const secondaryBendLimit = crownRamp ? 0.9 : 1.8;
  const bend = (routeUnit(seed, 1) * 2 - 1) * Math.min(bendLimit, length * 0.18);
  const bendB = (routeUnit(seed, 2) * 2 - 1) * Math.min(secondaryBendLimit, length * 0.12);
  const tensionA = 0.28 + routeUnit(seed, 3) * 0.08;
  const tensionB = 0.64 + routeUnit(seed, 4) * 0.08;
  const controlA = {
    x: source.x + dx * tensionA + normalX * bend,
    y: source.y + dy * tensionA + normalY * bend,
  };
  const controlB = {
    x: source.x + dx * tensionB + normalX * (-bend * 0.42 + bendB),
    y: source.y + dy * tensionB + normalY * (-bend * 0.42 + bendB),
  };
  return {
    controlA,
    controlB,
    curveLength: physicalRouteLength(source, controlA, controlB, target),
  };
}

/** Matches the 32-interval authored curve length used for terrain, guidance and art. */
export function physicalRouteLength(
  source: PhysicalPathPoint,
  controlA: PhysicalPathPoint,
  controlB: PhysicalPathPoint,
  target: PhysicalPathPoint,
) {
  let distance = 0;
  let previousX = source.x;
  let previousY = source.y;
  for (let index = 1; index <= 32; index++) {
    const t = index / 32;
    const u = 1 - t;
    const tt = t * t;
    const uu = u * u;
    const uuu = uu * u;
    const ttt = tt * t;
    const x = uuu * source.x + 3 * uu * t * controlA.x + 3 * u * tt * controlB.x + ttt * target.x;
    const y = uuu * source.y + 3 * uu * t * controlA.y + 3 * u * tt * controlB.y + ttt * target.y;
    distance += Math.hypot(x - previousX, y - previousY);
    previousX = x;
    previousY = y;
  }
  return distance;
}
