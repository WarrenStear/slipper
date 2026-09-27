/** Shared visual response for the canonical world. Does not change story or clocks. */
export const WORLD_VISUAL_RESPONSE = Object.freeze({ rate: 2.4, maxDelta: .05 });

export function worldTransitionAlpha(delta: number, reducedMotion = false): number {
  if (reducedMotion) return 1;
  const dt = Number.isFinite(delta) ? Math.max(0, Math.min(WORLD_VISUAL_RESPONSE.maxDelta, delta)) : 0;
  return -Math.expm1(-dt * WORLD_VISUAL_RESPONSE.rate);
}

/** Finite scalar interpolation with no overshoot or allocations in the frame loop. */
export function blendWorldValue(current: number, target: number, alpha: number): number {
  const destination = Number.isFinite(target) ? target : Number.isFinite(current) ? current : 0;
  const start = Number.isFinite(current) ? current : destination;
  const amount = Number.isFinite(alpha) ? Math.max(0, Math.min(1, alpha)) : 0;
  return amount === 1 ? destination : amount === 0 ? start : start * (1 - amount) + destination * amount;
}

/** The same linear-space grade follows either FXAA or cinematic finishing.
 * Quality changes rendering detail, not the chapter's colour language. */
export const WORLD_GRADE_FRAGMENT = /* glsl */ `
  float luminance=dot(color,vec3(.2126,.7152,.0722));
  color=mix(vec3(luminance),color,saturation);
  color=.18*pow(max(color/.18,vec3(0.)),vec3(contrast));
  vec2 edge=(vUv-.5)*2.;color*=1.-vignette*smoothstep(.35,1.45,dot(edge,edge));
`;
