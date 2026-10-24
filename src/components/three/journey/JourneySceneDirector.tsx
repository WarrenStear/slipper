import { TactileDetailProvider } from "../storyEvents/TactileMaterial";
import { memo, useMemo, type ElementType } from "react";
import {
  resolveJourneyRenderWindow,
  type JourneySceneId,
  type NarrativeChapterId,
  type WorldPoint3
} from "../../../data/journeyWorldLayout.ts";
import { getSceneManifest } from "../../../narrative/StoryManifest.ts";
import { useJourneyStore } from "../../../stores/useJourneyStore";
import type { QuietGuidanceActivity } from "../../../ui/quietGuidancePresentation";
import { ScenePresence } from "../../../world/core/ScenePresence";
import { sceneWorldOrigin } from "../../../world/core/sceneStreaming";
import { useSpatialSceneWindow } from "../../../world/core/useSpatialSceneWindow";
import { BlueMoonSanctuaryChapter } from "../chapters/BlueMoonSanctuaryChapter";
import { BrokenFloorChapter } from "../chapters/BrokenFloorChapter";
import {
  type Vec3
} from "../chapters/ChapterPrimitives";
import { CrownedReturnChapter } from "../chapters/CrownedReturnChapter";
import { EnchantedWoodChapter } from "../chapters/EnchantedWoodChapter";
import { FireRiverChapter } from "../chapters/FireRiverChapter";
import { ForkChapter } from "../chapters/ForkChapter";
import { IntegrationChapter } from "../chapters/IntegrationChapter";
import { LanternEpilogueChapter } from "../chapters/LanternEpilogueChapter";
import { NestChapter } from "../chapters/NestChapter";
import { SunsetSeerChapter } from "../chapters/SunsetSeerChapter";
import { ThornedHouseChapter } from "../chapters/ThornedHouseChapter";
import { ThreeClimbsChapter } from "../chapters/ThreeClimbsChapter";
import type { ChapterSceneProps } from "../chapters/types";
import { OutdoorLandscape } from "../environment/OutdoorLandscape";
import type { RenderQualityProfile } from "../renderQuality";
import { RENDER_QUALITY_PROFILES } from "../renderQuality";
import { EnvironmentalChoreography } from "../storyEvents/EnvironmentalChoreography";
import { StoryActorDirector } from "../storyEvents/StoryActorDirector";
import { StoryEventDirector } from "../storyEvents/StoryEventDirector";
import { StoryObjectPresentation } from "../storyEvents/StoryObjectPresentation";

const CHAPTER_COMPONENTS: Record<NarrativeChapterId, ElementType<ChapterSceneProps>> = {
  "broken-floor": BrokenFloorChapter,
  "enchanted-wood": EnchantedWoodChapter,
  "blue-moon-sanctuary": BlueMoonSanctuaryChapter,
  nest: NestChapter,
  "sunset-seer": SunsetSeerChapter,
  "thorned-house": ThornedHouseChapter,
  "wolf-swan-seer": IntegrationChapter,
  "fire-river": FireRiverChapter,
  fork: ForkChapter,
  "three-climbs": ThreeClimbsChapter,
  "crowned-return": CrownedReturnChapter,
  "lantern-epilogue": LanternEpilogueChapter,
};

export type JourneySceneDirectorProps = {
  activeSceneId: JourneySceneId;
  qualityProfile: RenderQualityProfile;
  reducedEffects?: boolean;
  reducedMotion?: boolean;
  /**
   * Rebase the authored active-scene anchor to an existing world position.
   * Omit this once player navigation uses journeyWorldLayout coordinates.
   */
  activeOrigin?: WorldPoint3;
  sampleGroundY?: (x: number, z: number) => number;
  renderAdjacent?: boolean;
  openingResolved?: boolean;
  interactionsEnabled?: boolean;
  quietGuidanceActivity?: QuietGuidanceActivity;
  onFinalConstellationFormationComplete?: () => void;
};

function mutablePoint(point: WorldPoint3): Vec3 {
  return [point[0], point[1], point[2]];
}

export function ActiveStoryActors({ sceneId, qualityProfile, reducedEffects, reducedMotion }: { sceneId: JourneySceneId; qualityProfile: RenderQualityProfile; reducedEffects: boolean; reducedMotion: boolean }) {
  const lanternOwned = useJourneyStore(state => state.worldFlags["lantern.owned"] === true || ["carried", "placed"].includes(state.storyObjectStates["lantern.master"]));
  const lanternPlaced = useJourneyStore(state => state.storyObjectStates["lantern.master"] === "placed");
  const birdsReleased = useJourneyStore(state => state.storyObjectStates["river.birds"] === "released");
  const origamiAwakened = useJourneyStore(state => state.storyObjectStates["blue-moon.origami"] === "awakened");
  // The final tableau already contains its resting Wolf and free Swan.
  if (sceneId.startsWith("crowned.") || sceneId === "epilogue.constellation") return null;
  return <StoryActorDirector sceneId={sceneId} qualityProfile={qualityProfile} reducedEffects={reducedEffects} reducedMotion={reducedMotion} lanternOwned={lanternOwned} lanternPlaced={lanternPlaced} birdsReleased={birdsReleased} origamiAwakened={origamiAwakened} />;
}

function JourneySceneDirectorComponent({
  activeSceneId,
  qualityProfile,
  reducedEffects = false,
  reducedMotion = false,
  activeOrigin,
  sampleGroundY,
  renderAdjacent = true,
  openingResolved = true,
  interactionsEnabled = true,
  quietGuidanceActivity,
  onFinalConstellationFormationComplete,
}: JourneySceneDirectorProps) {
  const activeManifest = getSceneManifest(activeSceneId);
  const activeScene = activeManifest.layout;
  const renderWindow = useMemo(() => resolveJourneyRenderWindow(activeSceneId), [activeSceneId]);
  const spatialIds = useSpatialSceneWindow(activeSceneId, qualityProfile.quality, reducedEffects, Boolean(sampleGroundY && renderAdjacent));
  const sceneIds = sampleGroundY ? spatialIds : renderWindow.entries.filter(entry => entry.mode === "active" || renderAdjacent).map(entry => entry.sceneId);
  const worldOffset: Vec3 = activeOrigin && !sampleGroundY
    ? [
        activeOrigin[0] - activeScene.anchor.position[0],
        activeOrigin[1] - activeScene.anchor.position[1],
        activeOrigin[2] - activeScene.anchor.position[2],
      ]
    : [0, 0, 0];
  return (
    <group name="authored-journey-scene-window" position={worldOffset} userData={{ streaming: Boolean(sampleGroundY), sceneCount: sceneIds.length }}>
      {/* One input owner and carried-object presentation survives scenery eviction. */}
      {interactionsEnabled ? <group position={mutablePoint(sampleGroundY ? sceneWorldOrigin(activeSceneId, sampleGroundY) : activeScene.anchor.position)} rotation={[0, activeScene.anchor.headingRadians, 0]}>
        <StoryEventDirector sceneId={activeSceneId} reducedMotion={reducedMotion} renderWorldObjects={sceneIds.includes(activeSceneId)} quietGuidanceActivity={quietGuidanceActivity} />
      </group> : null}
      {sceneIds.map(sceneId => {
        const manifest = getSceneManifest(sceneId);
        const scene = manifest.layout;
        const active = sceneId === activeSceneId;
        const position = mutablePoint(sampleGroundY ? sceneWorldOrigin(sceneId, sampleGroundY) : scene.anchor.position);
        const Chapter = CHAPTER_COMPONENTS[manifest.chapterId];
        // Nearby scenery uses the same authored assets, with no secondary views,
        // authored actor choreography, prose, inputs or carried-object copies.
        const detail = active ? qualityProfile : RENDER_QUALITY_PROFILES.low;
        const reduced = active ? reducedEffects : true;
        return <ScenePresence.Provider key={sceneId} value={active}>
          <TactileDetailProvider quality={detail.quality} reducedEffects={reduced}>
          <group name={`journey-scene:${sceneId}`} userData={{ environmentId: manifest.environmentId, active, sceneryOnly: !active }}
            position={position} rotation={[0, scene.anchor.headingRadians, 0]}>
            {active && interactionsEnabled ? <ActiveStoryActors sceneId={sceneId} qualityProfile={qualityProfile} reducedEffects={reducedEffects} reducedMotion={reducedMotion} /> : null}
            {!active && scene.chapterId !== "broken-floor" && scene.chapterId !== "lantern-epilogue" ?
              <StoryObjectPresentation sceneId={sceneId} activeSceneId={activeSceneId} reducedMotion interactiveIdentity={false} /> : null}
            <EnvironmentalChoreography sceneId={sceneId} qualityProfile={detail} reducedEffects={reduced} reducedMotion={reducedMotion || !active} />
            <OutdoorLandscape sceneId={sceneId} quality={detail.quality} reducedEffects={reduced} reducedMotion={reducedMotion || !active} collidable={interactionsEnabled} sampleWorldGroundY={sampleGroundY} worldOrigin={position} headingRadians={scene.anchor.headingRadians} />
            <Chapter scene={scene} qualityProfile={detail} reducedEffects={reduced} reducedMotion={reducedMotion || !active}
              openingResolved={openingResolved} onFinalConstellationFormationComplete={active ? onFinalConstellationFormationComplete : undefined} />
          </group>
        </TactileDetailProvider>
        </ScenePresence.Provider>;
      })}
    </group>
  );
}

export const JourneySceneDirector = memo(JourneySceneDirectorComponent);
export default JourneySceneDirector;
