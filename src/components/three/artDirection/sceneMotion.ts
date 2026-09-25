import type { SceneLook } from "./SceneLookRegistry.ts";

export const SCENE_MOTION_CHANNELS = ["vegetation", "cloth", "water", "particles", "flame"] as const;
export type SceneMotionFrame = {
  motion: SceneLook["motion"];
  time: Record<typeof SCENE_MOTION_CHANNELS[number], number>;
  stillness: number;
};

/** Mutates the one presentation frame; consumers never need their own clock. */
export function advanceSceneMotion(frame: SceneMotionFrame, look: SceneLook, delta: number, active: boolean, reducedMotion: boolean, reducedEffects: boolean) {
  const dt = active && Number.isFinite(delta) ? Math.max(0, Math.min(.05, delta)) : 0;
  const ease = 1 - Math.exp(-dt * 1.3);
  const quiet = look.stillness ? 1 : 0;
  // Acoustic continuity remains gradual under visual accessibility settings.
  frame.stillness += (quiet - frame.stillness) * ease;
  if (Math.abs(quiet - frame.stillness) < .0005) frame.stillness = quiet;
  for (const channel of SCENE_MOTION_CHANNELS) {
    const value = reducedMotion || reducedEffects ? 0 : look.motion[channel];
    frame.motion[channel] += (value - frame.motion[channel]) * (reducedMotion || reducedEffects ? 1 : ease);
    if (value === 0 && frame.motion[channel] < .0005) frame.motion[channel] = 0;
    frame.time[channel] += dt * frame.motion[channel];
  }
  return dt;
}
