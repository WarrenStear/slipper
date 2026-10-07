import { MathUtils } from 'three';

/** Exact current numeric stage/time application. Activity remains supplied by
 * the real scene owner; no interaction or durable evidence is inferred here. */
export function advanceWetFloorUniforms(uniforms: { stage: { value: number }; time: { value: number } },
  stage: number, delta: number, reducedMotion: boolean) {
  const dt = Number.isFinite(delta) && delta >= 0 ? Math.min(delta, .1) : 0;
  uniforms.stage.value = reducedMotion ? stage : MathUtils.damp(uniforms.stage.value, stage, 2.5, dt);
  if (!reducedMotion) uniforms.time.value += Math.min(dt, .05);
}
