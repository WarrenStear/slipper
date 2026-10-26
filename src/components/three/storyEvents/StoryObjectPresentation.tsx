import { useExplorationLanternCarried } from "../../../player/explorationLantern";
import { memo, useMemo } from "react";
import { sceneryObjectResidence } from "./sceneryObjectResidence";
import type { JourneySceneId } from "../../../lib/storyJourneyState";
import { useJourneyStore } from "../../../stores/useJourneyStore";
import { eventsForScene, objectsForScene } from "../../../storyEvents/storyEventRegistry";
import type { StoryObjectDefinition } from "../../../storyEvents/storyEventTypes";
import { StoneBasin, TimberAssembly } from "../chapters/ChapterArt";
import type { ConstructionPiece } from "../chapters/chapterArtGeometry";
import { StoryObjectModel } from "./StoryObjectModel";
import { StoryObjectPose } from "./StoryObjectPose";

// Stable construction data avoids rebuilding this merged mesh as focus changes.
// The semantic mirror stays at its authored height; joined feet reach Y=0.
const CROWN_MIRROR_STAND: readonly ConstructionPiece[] = [
  ...[-.61, .61].flatMap(x => [
    { position: [x, -.38, 0] as [number, number, number], size: [.12, 2.44, .16] as [number, number, number] },
    { position: [x, -1.55, 0] as [number, number, number], size: [.25, .1, .9] as [number, number, number] },
  ]),
  { position: [0, -.92, 0], size: [1.22, .12, .13] },
];

/** Read-only object projection shared by the active scene and revisitable scenery.
 * No input listeners, attention clocks, carried-object copies, HUD or dispatch.
 */
export const StoryObjectPresentation = memo(function StoryObjectPresentation({ sceneId, reducedMotion, interactiveIdentity = true, activeSceneId = sceneId }: {
  sceneId: JourneySceneId; reducedMotion: boolean; interactiveIdentity?: boolean; activeSceneId?: JourneySceneId;
}) {
  const explorationCarried = useExplorationLanternCarried();
  const objects = useMemo(() => objectsForScene(sceneId), [sceneId]);
  const objectStates = useJourneyStore(state => state.storyObjectStates);
  const acceptedIds = useJourneyStore(state => state.completedStoryEventIds);
  const placements = useJourneyStore(state => state.storyPlacementStates);
  const surfaces = useMemo(() => {
    const targetIds = new Set(eventsForScene(sceneId).flatMap(event => event.targetId ? [event.targetId] : []));
    const uniqueTargets = new Map<string, NonNullable<StoryObjectDefinition["targets"]>[number]>();
    for (const object of objects) for (const target of object.targets ?? []) {
      if (targetIds.has(target.id) && !objects.some(item => item.id === target.id)) uniqueTargets.set(target.id, target);
    }
    return [...uniqueTargets.values()];
  }, [sceneId, objects]);
  return <group name={interactiveIdentity ? "active-story-object-presentation" : `remembered-scene-objects:${sceneId}`}>
    {objects.map(object => {
      if (!interactiveIdentity && sceneryObjectResidence(object, activeSceneId, acceptedIds) !== sceneId) return null;
      const state = objectStates[object.id];
      if (object.id === "lantern.master" && explorationCarried) return null;
      if (object.id === "broken-floor.reflection" || object.kind === "path" || ["carried", "burned", "released"].includes(state ?? "")) return null;
      // The actor/player lantern owns guidance and carrying. Only the chosen
      // placed light is rendered by the object system.
      if (object.kind === "lantern" && !(object.id === "lantern.master" && state === "placed")) return null;
      if (object.id === "thorn-house.threshold") return null;
      // Keep semantic poses for input while the chapter/actor owns the image.
      // A second miniature Swan at its destination competes with the real bird
      // and overlaps it when reduced motion parks the actor at that location.
      // SanctuaryWater also owns the touch surface; a metallic object disk
      // floats above it and obscures the moon reflection.
      const chapterOwnsVisual = (sceneId.startsWith("sunset.") && object.kind === "mirror")
        || (sceneId === "blue-moon.intimacy" && object.kind === "swan")
        || (sceneId === "blue-moon.sanctuary" && object.id === "blue-moon.water")
        || (sceneId === "river.wash" && object.id === "river.water")
        || (sceneId === "fire.boundary" && object.id === "fire.flame")
        || (sceneId === "fork.weighing" && object.id === "fork.weighing-stone");
      const placement = state === "reset" || state === "resting" ? undefined : object.targets?.find(item => item.id === placements[object.id]);
      const preservedAt = state === "preserved" ? object.targets?.[0]?.localPosition : undefined;
      const location: [number, number, number] = preservedAt ? [preservedAt[0] + .8, preservedAt[1] + .2, preservedAt[2]] : placement?.localPosition ?? object.localPosition;
      return <StoryObjectPose key={object.id} object={object} state={state} position={location} placementId={placements[object.id]} reducedMotion={reducedMotion} interactiveIdentity={interactiveIdentity}>
        {chapterOwnsVisual ? null : <StoryObjectModel objectId={object.id} kind={object.kind} state={state ?? (object.id === "fork.door" ? "open" : undefined)} reducedMotion={reducedMotion} />}
        {object.id === "home.crown-mirror" ? <TimberAssembly name="crown-mirror-grounded-stand" color="#66503d" pieces={CROWN_MIRROR_STAND} /> : null}
        {object.id === "home.water" ? <group name="home-water-basin-support"><StoneBasin position={[0, -.16, 0]} radius={1.12} height={.34} color="#827b69" /></group> : null}
      </StoryObjectPose>;
    })}
    {surfaces.map(surface => <group key={surface.id} name={`${interactiveIdentity ? "story-placement" : "scenery-placement"}:${surface.id}`} position={surface.localPosition} userData={{ targetId: surface.id }}>
      <mesh position={[0, -.07, 0]} receiveShadow><boxGeometry args={[.95, .1, .7]} /><meshStandardMaterial color="#635648" roughness={.96} /></mesh>
    </group>)}
  </group>;
});
