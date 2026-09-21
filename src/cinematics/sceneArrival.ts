import type { JourneySceneId } from "../lib/storyJourneyState.ts";

type Point = [number, number, number];
type Arrival = { position: Point; focus: Point };

// These compositions have a central action. The old fragment camera offsets
// can land inside the Fork's side house or turn away from the sovereign mirror.
const ARRIVALS: Partial<Record<JourneySceneId, Arrival>> = {
  "river.wash": { position: [0, 0, -3.5], focus: [0, 1.4, 3] },
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
