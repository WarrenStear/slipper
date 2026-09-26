import type { JourneySceneId } from "../lib/storyJourneyState.ts";

type Point = [number, number, number];
type Arrival = { position: Point; focus: Point };

// These compositions have a central action. The old fragment camera offsets
// can land inside the Fork's side house or turn away from the sovereign mirror.
const ARRIVALS: Partial<Record<JourneySceneId, Arrival>> = {
  "enchanted.rabbit-hole": { position: [0, 0, -6.5], focus: [0, 1.9, 6.5] },
  "enchanted.friendship-meadow": { position: [0, 0, -7], focus: [-1.5, 1.2, 5] },
  "enchanted.masked-hearth": { position: [0, 0, -6.5], focus: [0, 1.5, 6] },
  "blue-moon.sanctuary": { position: [0, 0, -9], focus: [0, 1.9, 8] },
  "blue-moon.intimacy": { position: [0, 0, -8.5], focus: [0, 1.65, 6] },
  "blue-moon.caged-bird": { position: [0, 0, -8.5], focus: [0, 1.8, 5] },
  "nest.two-hands": { position: [0, 0, -6.5], focus: [0, 1.2, 3] },
  "nest.unsupported-cycle": { position: [0, 0, -6.5], focus: [0, 1.2, 3] },
  "nest.protection": { position: [0, 0, -6.5], focus: [0, 1.2, 3] },
  "sunset.warning-grove": { position: [0, 0, -7], focus: [0, 2.8, 5.4] },
  "sunset.true-mirror": { position: [0, 0, -7], focus: [0, 2.8, 5.4] },
  "sunset.stillness": { position: [0, 0, -7], focus: [0, 2.8, 5.4] },
  "thorned.locked-garden": { position: [0, 0, -6], focus: [0, 1.5, 4] },
  "thorned.old-memory-bedroom": { position: [0, 0, -2.7], focus: [0, 1.4, 4] },
  "thorned.self-owned-world": { position: [0, 0, -2.7], focus: [0, 1.8, 8] },
  "fire.boundary": { position: [0, 0, -6.5], focus: [0, 1.2, 4] },
  "river.wash": { position: [0, 0, -3.5], focus: [0, 1.4, 3] },
  "river.release-surrender": { position: [0, 0, -5.5], focus: [0, 1.5, 8] },
  "fork.weighing": { position: [0, 0, -5.5], focus: [0, 1.6, 3] },
  "fork.four-verbs": { position: [0, 0, -5.5], focus: [0, 1.6, 3] },
  "fork.relinquish-hope": { position: [0, 0, -3.5], focus: [0, 1.6, 3] },
  "crowned.sovereignty": { position: [0, 0, .5], focus: [0, 2.1, 4] },
};

export function getAuthoredSceneArrival(sceneId: JourneySceneId, origin: readonly number[], heading: number): Arrival | null {
  const arrival = ARRIVALS[sceneId];
  if (!arrival) return null;
  const world = ([x, y, z]: Point): Point => [
    origin[0] + Math.cos(heading) * x + Math.sin(heading) * z,
    origin[1] + y,
    origin[2] - Math.sin(heading) * x + Math.cos(heading) * z,
  ];
  return { position: world(arrival.position), focus: world(arrival.focus) };
}
