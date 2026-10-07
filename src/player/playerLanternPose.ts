import { Color, MathUtils, Vector3 } from "three";

export const PLAYER_LANTERN_LOCAL_POSITION = [.38, -.4, -1.08] as const;
export const PLAYER_LANTERN_AIM = [0, -.22, -4.8] as const;
type LanternPhaseMotion = { stability?: number; intensity?: number; reach?: number; flicker?: number; movement?: number };
type LanternPhysicalStyle = { color: Color; lightScale: number; glowScale: number; bodyScale: number;
  shadows: boolean; instability: number; steadiness: number; reach: number; guideBoost: number };
export type PlayerLanternPoseInput = {
  elapsed: number; delta: number; pressure: number; depth: number;
  enabled: boolean; compactPortrait: boolean; reducedMotion: boolean; reducedEffects: boolean;
  hasPresentation: boolean; sharedFlameMotion: number; airMovement: number;
  navigationLocal: Vector3 | null; phase?: LanternPhaseMotion; style: LanternPhysicalStyle;
};
export function createPlayerLanternPose() {
  return {
    desired: new Vector3(...PLAYER_LANTERN_LOCAL_POSITION), position: new Vector3(...PLAYER_LANTERN_LOCAL_POSITION),
    velocity: new Vector3(), springDelta: new Vector3(), aim: new Vector3(...PLAYER_LANTERN_AIM),
    target: new Vector3(...PLAYER_LANTERN_AIM), color: new Color("#ffd78a"),
    tiltX: 0, tiltZ: 0, spotIntensity: 1.08, spotDistance: 14, spotAngle: .44, spotShadow: false,
    pointIntensity: .32, pointDistance: 4.6, bodyScale: 1,
    flameScale: new Vector3(1, 1, 1), flameRotation: 0, glowScale: 1, glowOpacity: .075,
    glassRotation: 0, glassOpacity: .045,
  };
}
export type PlayerLanternPose = ReturnType<typeof createPlayerLanternPose>;
const clamp01 = (value: number) => Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));
const ease = (current: number, target: number, delta: number, speed: number) => MathUtils.lerp(current, target, 1 - Math.exp(-delta * speed));

/** Exact current carrying/spring/light formulas, driven by supplied shared time.
 * This CPU model owns no story interpretation, camera, frame or resource.
 */
export function advancePlayerLanternPose(state: PlayerLanternPose, input: PlayerLanternPoseInput): PlayerLanternPose {
  const { elapsed, enabled, compactPortrait, reducedMotion, reducedEffects, navigationLocal, style } = input;
  const step = Math.min(input.delta, .05), pressure = clamp01(input.pressure), depth = clamp01(input.depth);
  const activeScale = enabled ? 1 : 0, guideActive = navigationLocal && enabled ? 1 : 0;
  const phaseStability = input.phase?.stability ?? 1, phaseIntensity = input.phase?.intensity ?? 1;
  const phaseReach = input.phase?.reach ?? 1, phaseFlicker = input.phase?.flicker ?? .2, phaseMovement = input.phase?.movement ?? .2;
  const instability = clamp01(style.instability * .58 + (1 - phaseStability) * .42);
  const steadiness = clamp01(style.steadiness * .72 + phaseStability * .28);
  const environmentalMotion = input.hasPresentation ? Math.min(1, input.sharedFlameMotion * 5)
    : input.airMovement < .01 ? 0 : Math.min(1, input.airMovement * 5);
  const motionScale = environmentalMotion * (reducedMotion || reducedEffects ? 0 : 1) * (.38 + phaseMovement * .62);
  const baseX = compactPortrait ? .14 : PLAYER_LANTERN_LOCAL_POSITION[0];
  const baseY = compactPortrait ? -.28 : PLAYER_LANTERN_LOCAL_POSITION[1];
  const baseZ = compactPortrait ? -1.12 : PLAYER_LANTERN_LOCAL_POSITION[2];
  state.desired.set(
    baseX + Math.sin(elapsed * 1.38) * (.009 + instability * .014) * motionScale,
    baseY + Math.cos(elapsed * 1.95) * (.013 + instability * .016) * motionScale,
    baseZ + Math.sin(elapsed * 1.1 + .4) * (.009 + instability * .011) * motionScale,
  );
  if (navigationLocal) {
    state.desired.x += MathUtils.clamp(navigationLocal.x * .013, -.052, .052);
    state.desired.y += MathUtils.clamp(navigationLocal.y * .008, -.028, .036);
  }
  const spring = 12.5 + depth * 3.1, damping = 1 - Math.exp(-step * (8.2 + pressure * 1.45));
  state.springDelta.copy(state.desired).sub(state.position);
  state.velocity.addScaledVector(state.springDelta, spring * step);
  state.velocity.multiplyScalar(1 - damping * .78);
  state.position.addScaledVector(state.velocity, step);
  if (environmentalMotion === 0 || reducedMotion || reducedEffects) {
    state.position.copy(state.desired); state.velocity.set(0, 0, 0);
  }
  state.tiltZ = Math.sin(elapsed * 1.22) * (.012 + instability * .011) * motionScale;
  state.tiltX = Math.cos(elapsed * .98) * (.005 + instability * .008) * motionScale;
  state.color.lerp(style.color, 1 - Math.exp(-step * 4.4));
  const flamePulse = 1 + Math.sin(elapsed * (6.4 + pressure * 2.8)) * (.012 + instability * .026) * motionScale
    + Math.sin(elapsed * 14.8) * (.004 + instability * .012) * motionScale;
  const baseIntensity = activeScale * style.lightScale * steadiness * flamePulse * (.58 + phaseIntensity * .52);
  state.spotIntensity = ease(state.spotIntensity, (1.18 + depth * .78 + style.guideBoost) * baseIntensity, step, 6.8);
  state.spotDistance = style.reach * (.62 + phaseReach * .46);
  state.spotAngle = MathUtils.lerp(.5, .32, Number(guideActive) * .68);
  state.spotShadow = Boolean(!input.hasPresentation && enabled && style.shadows);
  state.pointIntensity = ease(state.pointIntensity, (.32 + depth * .16 + style.guideBoost * .07) * baseIntensity, step, 5.6);
  state.pointDistance = 4.6 + depth * .7;
  if (navigationLocal) {
    state.aim.copy(navigationLocal);
    if (state.aim.lengthSq() > .001) state.aim.normalize().multiplyScalar(5.95);
    state.aim.y = MathUtils.clamp(state.aim.y, -.72, .88);
  } else state.aim.set(...PLAYER_LANTERN_AIM);
  state.target.lerp(state.aim, 1 - Math.exp(-step * 3.5));
  state.bodyScale = style.bodyScale * (.88 + phaseIntensity * .12) * (compactPortrait ? .46 : .5) * (enabled ? 1 : .001);
  const flickerScale = .28 + phaseFlicker * .92;
  const width = (.92 + (flamePulse - 1) * 1.4 * flickerScale + pressure * .018) * activeScale;
  const height = (.94 + (flamePulse - 1) * 2.6 * flickerScale + pressure * .026) * activeScale;
  state.flameScale.set(width, height, width);
  state.flameRotation = reducedMotion || reducedEffects ? 0 : Math.sin(elapsed * 2.3) * .08 * environmentalMotion;
  state.glowScale = (1.04 + pressure * .22 + depth * .12) * style.glowScale;
  state.glowOpacity = MathUtils.clamp((.062 + pressure * .052 + style.guideBoost * .06) * style.glowScale * activeScale, 0, .16);
  state.glassRotation = reducedMotion ? 0 : Math.sin(elapsed * .4) * .055 * environmentalMotion;
  state.glassOpacity = MathUtils.clamp((.045 + depth * .01 - pressure * .008) * activeScale, 0, .18);
  return state;
}
