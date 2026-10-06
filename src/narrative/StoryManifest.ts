import {
  journeyScenes,
  getJourneySceneForEntry,
  type JourneyChapterId,
  type JourneySceneId,
} from "../data/journeyNarrative.ts";
import { getJourneySceneLayout, type JourneySceneLayout } from "../data/journeyWorldLayout.ts";
import { getAuthoredSceneArrival } from "../cinematics/sceneArrival.ts";
import { eventsForScene, objectsForScene } from "../storyEvents/storyEventRegistry.ts";
import type { StoryEventTrigger } from "../storyEvents/storyEventTypes.ts";

type Point = readonly [number, number, number];
type SceneArrival = { position: [number, number, number]; focus: [number, number, number] };

export type SceneSpawnPolicy =
  | { readonly source: "authored-arrival"; readonly position: Point; readonly focus: Point }
  | { readonly source: "active-fragment-camera-offset" };

/** Presentation metadata only. Progression conditions, effects and prose stay in their registries. */
export type SceneManifest = {
  readonly sceneId: JourneySceneId;
  readonly chapterId: JourneyChapterId;
  readonly environmentId: string;
  readonly keystoneEntryId: string;
  readonly echoEntryIds: readonly string[];
  readonly layout: JourneySceneLayout;
  readonly spawn: SceneSpawnPolicy;
  /** Existing registry keys, not resolved values; dynamic state remains an argument to its owner. */
  readonly profiles: {
    readonly look: JourneySceneId;
    readonly lighting: JourneySceneId;
    readonly atmosphere: JourneySceneId;
    readonly camera: JourneySceneId;
    readonly audio: string;
  };
  readonly eventIds: readonly string[];
  readonly objectIds: readonly string[];
  readonly interactionTargetIds: readonly string[];
  readonly interactionBindings: readonly {
    readonly eventId: string;
    readonly trigger: StoryEventTrigger;
    readonly objectId?: string;
    readonly targetId?: string;
  }[];
};

export const SCENE_MANIFESTS: readonly SceneManifest[] = Object.freeze(journeyScenes.map(scene => {
  // Zero origin/yaw yields the existing authored local composition. A missing
  // composition remains the existing active-fragment cameraStart policy.
  const local = getAuthoredSceneArrival(scene.id, [0, 0, 0], 0);
  const events = eventsForScene(scene.id), objects = objectsForScene(scene.id);
  const spawn: SceneSpawnPolicy = local
    ? Object.freeze({ source: "authored-arrival", position: Object.freeze(local.position), focus: Object.freeze(local.focus) })
    : Object.freeze({ source: "active-fragment-camera-offset" });
  return Object.freeze({
    sceneId: scene.id,
    chapterId: scene.chapterId,
    environmentId: scene.environmentCue,
    keystoneEntryId: scene.keystoneEntryId,
    echoEntryIds: Object.freeze([...scene.echoEntryIds]),
    layout: getJourneySceneLayout(scene.id),
    spawn,
    profiles: Object.freeze({ look: scene.id, lighting: scene.id, atmosphere: scene.id,
      camera: scene.id, audio: scene.audioCue }),
    eventIds: Object.freeze(events.map(event => event.id)),
    objectIds: Object.freeze(objects.map(object => object.id)),
    interactionTargetIds: Object.freeze(Array.from(new Set([
      ...events.flatMap(event => event.targetId ? [event.targetId] : []),
      ...objects.flatMap(object => (object.targets ?? []).map(target => target.id)),
    ]))),
    interactionBindings: Object.freeze(events.map(event => Object.freeze({
      eventId: event.id, trigger: event.trigger,
      ...(event.objectId ? { objectId: event.objectId } : {}),
      ...(event.targetId ? { targetId: event.targetId } : {}),
    }))),
  });
}));

const BY_SCENE = new Map(SCENE_MANIFESTS.map(manifest => [manifest.sceneId, manifest]));

export function getSceneManifest(sceneId: JourneySceneId): SceneManifest {
  const manifest = BY_SCENE.get(sceneId);
  if (!manifest) throw new RangeError(`Unknown scene manifest: ${sceneId}`);
  return manifest;
}

export function getSceneManifestForEntry(entryId: string): SceneManifest | undefined {
  const scene = getJourneySceneForEntry(entryId);
  return scene ? getSceneManifest(scene.id) : undefined;
}

/**
 * Authored arrival transforms only. StoryScene retains explore/walk eligibility,
 * per-active-fragment fallback offsets, terrain grounding and saved-pose safety.
 */
export function resolveSceneManifestArrival(manifest: SceneManifest, origin: readonly number[], heading: number): SceneArrival | null {
  if (manifest.spawn.source !== "authored-arrival") return null;
  const world = ([x, y, z]: Point): [number, number, number] => [
    origin[0] + Math.cos(heading) * x + Math.sin(heading) * z,
    origin[1] + y,
    origin[2] - Math.sin(heading) * x + Math.cos(heading) * z,
  ];
  return { position: world(manifest.spawn.position), focus: world(manifest.spawn.focus) };
}
