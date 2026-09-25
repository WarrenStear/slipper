import type { JourneySceneId } from "../lib/storyJourneyState.ts";

export type StoryActorId = "lantern" | "wolf" | "swan" | "seer";
export type StoryActorCue = "lead" | "wait" | "watch" | "cross" | "guard" | "rest" | "reveal" | "captive";
export type ActorCueDefinition = { actor: StoryActorId; cue: StoryActorCue; from: [number, number, number]; to: [number, number, number]; duration: number; waitDistance: number; terminalYaw?: number };
const cue = (actor: StoryActorId, behavior: StoryActorCue, from: ActorCueDefinition["from"], to = from, duration = 14, waitDistance = 10): ActorCueDefinition => ({ actor, cue: behavior, from, to, duration, waitDistance });
const lantern = cue("lantern", "lead", [0.8, 1.3, 2], [0, 1.3, 5], 18, 9);
const wolf = cue("wolf", "watch", [-5.5, 0, 4]);
const swan = cue("swan", "lead", [3.5, 0.12, 1], [4, 0.12, 4], 22, 8);
const seer = cue("seer", "reveal", [0, 0, 3]);

export const CINEMATIC_ACTOR_CUES: Partial<Record<JourneySceneId, readonly ActorCueDefinition[]>> = {
  "enchanted.rabbit-hole": [lantern, cue("wolf", "cross", [-6, 0, 4], [6, 0, 4], 24)],
  "enchanted.friendship-meadow": [lantern, swan],
  "enchanted.masked-hearth": [lantern, wolf],
  // The first pale form is on open water beside the near bridge. Its destination
  // still meets the existing story volume; rails no longer hide its arrival.
  "blue-moon.sanctuary": [lantern, { ...cue("swan", "lead", [3.8, 0.12, -3.5], [5, 0.12, 1], 30, 8), terminalYaw: -Math.PI / 2 }],
  "blue-moon.intimacy": [{ ...cue("swan", "lead", [-4.4, 0.2, -2.2], [-4.4, 0.2, 3], 28), terminalYaw: Math.PI / 2 }, lantern],
  "blue-moon.caged-bird": [cue("swan", "captive", [3.1, 0.1, -2.8]), wolf],
  "sunset.warning-grove": [seer, wolf],
  "sunset.true-mirror": [seer],
  "sunset.stillness": [seer],
  "wolf-swan.false-choice": [cue("wolf", "guard", [-4, 0, 2]), cue("swan", "lead", [4, 0.12, 1], [4, 0.12, 2], 18), cue("seer", "reveal", [0, 0, 5])],
  "wolf-swan.convergence": [cue("wolf", "rest", [-4, 0, 2]), swan, seer],
  "fire.boundary": [cue("wolf", "guard", [-4.7, 0, 1.4])],
  "river.wash": [cue("swan", "lead", [3.4, 0.1, 2], [4.3, 0.1, 6], 26)],
  "river.release-surrender": [cue("wolf", "rest", [-5, 0, 2])],
  "fork.weighing": [cue("lantern", "wait", [1.6, 0.25, -1.8])],
  "fork.four-verbs": [cue("lantern", "wait", [1.6, 0.25, -1.8])],
  "fork.relinquish-hope": [cue("lantern", "wait", [1, 1, 3])],
  "climb.heart": [cue("swan", "wait", [3.8, 0.1, -3])],
  "crowned.home": [cue("wolf", "rest", [-5, 0, 3]), swan],
  "crowned.sovereignty": [cue("wolf", "rest", [-5, 0, 3])],
  "epilogue.constellation": [cue("wolf", "rest", [-5, 0, 3])],
};

export type ActorPose = { x: number; y: number; z: number; yaw: number; visible: boolean };
export function sampleActorCue(definition: ActorCueDefinition, seconds: number, player: readonly number[], reducedMotion: boolean, output: ActorPose): ActorPose {
  const [x, y, z] = definition.from;
  const moving = definition.cue === "lead" || definition.cue === "cross";
  // Choreography pauses at the end of each path; callers pause its clock when
  // the player falls behind. No actor chases or attacks the player.
  const phase = Math.min(1, Math.max(0, seconds / definition.duration));
  const smooth = phase * phase * (3 - 2 * phase);
  // A stationary guiding Swan waits at its destination under reduced motion,
  // beside the same interaction volume the moving version eventually reaches.
  const amount = moving ? (reducedMotion ? (definition.actor === "swan" ? 1 : 0) : smooth) : 0;
  output.x = x + (definition.to[0] - x) * amount;
  output.y = y + (definition.to[1] - y) * amount;
  output.z = z + (definition.to[2] - z) * amount;
  output.yaw = moving || definition.cue === "rest"
    ? Math.atan2(definition.to[0] - x, definition.to[2] - z)
    : Math.atan2(player[0] - output.x, player[2] - output.z);
  if (moving && definition.terminalYaw !== undefined) {
    const turn = Math.min(1, Math.max(0, (amount - .7) / .3));
    const angle = definition.terminalYaw - output.yaw;
    output.yaw += Math.atan2(Math.sin(angle), Math.cos(angle)) * turn * turn * (3 - 2 * turn);
  }
  output.visible = true;
  if (definition.actor === "wolf" && definition.cue !== "rest") {
    const dx = output.x - player[0], dz = output.z - player[2];
    const distance = Math.hypot(dx, dz);
    if (distance < 3) {
      const length = Math.max(distance, 0.001);
      output.x += (distance < 0.001 ? 1 : dx / length) * (3 - distance);
      output.z += dz / length * (3 - distance);
      output.yaw = Math.atan2(dx || 1, dz);
    }
  }
  if (definition.actor === "lantern" && definition.cue === "lead" && !reducedMotion) {
    // The actor briefly disappears into the authored tree line, then waits.
    output.visible = !(phase > 0.53 && phase < 0.61);
  }
  return output;
}

export function flockInstanceCount(quality: string, reducedEffects: boolean, origami = false) {
  const counts: Record<string, number> = origami ? { low: 12, medium: 24, high: 36, cinematic: 48 } : { low: 64, medium: 128, high: 192, cinematic: 256 };
  return reducedEffects ? (origami ? 6 : 24) : (counts[quality] ?? counts.medium);
}

export type FlockPose = { x: number; y: number; z: number; yaw: number; flap: number; scale: number };
export function sampleFlockPose(index: number, seconds: number, release: number, origami: boolean, reducedMotion: boolean, output: FlockPose): FlockPose {
  const phase = index * 2.3999632297;
  const seed = ((index * 73 + 19) % 101) / 101;
  const spread = Math.max(0, Math.min(1, (release - seed * 0.35) / 0.65));
  const spatialSpread = reducedMotion ? 0 : spread;
  const time = reducedMotion ? 0 : seconds;
  const radius = (origami ? 1.3 : 2.4) + seed * 1.8 + spatialSpread * (16 + seed * 24);
  const angle = phase + time * (origami ? 0.055 : 0.15) * (1 - spatialSpread);
  output.x = Math.cos(angle) * radius;
  output.y = (origami ? 3 : 5.5) + Math.sin(phase * 1.3) * 1.2 + spatialSpread * (9 + seed * 11);
  output.z = 3 + Math.sin(angle) * radius * 0.62 + spatialSpread * 13;
  output.yaw = -angle;
  output.flap = reducedMotion ? 0.2 : Math.sin(time * (origami ? 1.7 : 5.4) + phase) * 0.7;
  output.scale = (origami ? 0.26 : 0.15) * (reducedMotion ? 1 - release : Math.min(1, (1 - spread) * 4));
  return output;
}
