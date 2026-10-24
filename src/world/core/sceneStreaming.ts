import { JOURNEY_SCENE_LAYOUTS, type JourneySceneId, type WorldPoint3 } from "../../data/journeyWorldLayout.ts";

export const SCENE_STREAM_CELL_SIZE = 8;
export const SCENE_STREAM_HYSTERESIS = 14;

export function sceneStreamBudget(quality: string, reducedEffects = false) {
  const tier = reducedEffects ? 0 : Math.max(0, ["low", "medium", "high", "cinematic"].indexOf(quality));
  return { radius: [48, 56, 64, 72][tier], maxScenery: [3, 4, 5, 6][tier] };
}

/** Distance to the authored footprint, so large buildings arrive before their centre. */
export function sceneFootprintDistanceSquared(sceneId: JourneySceneId, x: number, z: number) {
  const scene = JOURNEY_SCENE_LAYOUTS.find(scene => scene.id === sceneId)!;
  const dx = Math.max(scene.bounds.min[0] - x, 0, x - scene.bounds.max[0]);
  const dz = Math.max(scene.bounds.min[2] - z, 0, z - scene.bounds.max[2]);
  return dx * dx + dz * dz;
}

/** No progress, graph distance, event state, prose or store is an input here. */
export function resolveSpatialSceneWindow({ x, z, activeSceneId, quality, reducedEffects = false, previous = [] }: {
  x: number; z: number; activeSceneId: JourneySceneId; quality: string;
  reducedEffects?: boolean; previous?: readonly JourneySceneId[];
}): JourneySceneId[] {
  if (!Number.isFinite(x) || !Number.isFinite(z)) return [activeSceneId];
  const budget = sceneStreamBudget(quality, reducedEffects);
  const retained = new Set(previous);
  const nearby = JOURNEY_SCENE_LAYOUTS
    .map(scene => ({ id: scene.id, distance: Math.sqrt(sceneFootprintDistanceSquared(scene.id, x, z)) }))
    .filter(item => item.distance <= budget.radius + (retained.has(item.id) ? SCENE_STREAM_HYSTERESIS : 0))
    // A small retention bias prevents churn on an equidistant cell boundary.
    .sort((a, b) => (a.distance - (retained.has(a.id) ? 6 : 0)) - (b.distance - (retained.has(b.id) ? 6 : 0)) || a.id.localeCompare(b.id));
  const activeNearby = nearby.some(item => item.id === activeSceneId);
  const candidates = nearby.filter(item => item.id !== activeSceneId).slice(0, budget.maxScenery);
  const ids = new Set([...(activeNearby ? [activeSceneId] : []), ...candidates.map(item => item.id)]);
  return JOURNEY_SCENE_LAYOUTS.filter(scene => ids.has(scene.id)).map(scene => scene.id);
}

/** Each scene resolves its own ground; changing the narrative cannot translate its neighbours. */
export function sceneWorldOrigin(sceneId: JourneySceneId, sampleGroundY: (x: number, z: number) => number): WorldPoint3 {
  const scene = JOURNEY_SCENE_LAYOUTS.find(scene => scene.id === sceneId)!;
  const [x, , z] = scene.anchor.position;
  return [x, sampleGroundY(x, z) + .2, z];
}
