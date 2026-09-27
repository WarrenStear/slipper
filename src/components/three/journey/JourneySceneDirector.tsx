import { OutdoorLandscape } from "../environment/OutdoorLandscape";
import { EnvironmentalChoreography } from "../storyEvents/EnvironmentalChoreography";
import { StoryEventDirector } from "../storyEvents/StoryEventDirector";
import { StoryActorDirector } from "../storyEvents/StoryActorDirector";
import { useJourneyStore } from "../../../stores/useJourneyStore";
import { memo, useMemo, type ElementType } from "react";
import {
  getJourneySceneLayout,
  resolveJourneyRenderWindow,
  type JourneySceneId,
  type JourneySceneLayout,
  type NarrativeChapterId,
  type WorldPoint3,
} from "../../../data/journeyWorldLayout.ts";
import { BlueMoonSanctuaryChapter } from "../chapters/BlueMoonSanctuaryChapter";
import { BrokenFloorChapter } from "../chapters/BrokenFloorChapter";
import {
  CHAPTER_PALETTES,
  SceneGround,
  type Vec3,
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
import type { RenderQualityProfile } from "../renderQuality";

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
  renderAdjacent?: boolean;
  openingResolved?: boolean;
  interactionsEnabled?: boolean;
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

function AdjacentSceneProxy({
  scene,
  reducedEffects,
}: {
  scene: JourneySceneLayout;
  reducedEffects: boolean;
}) {
  const palette = CHAPTER_PALETTES[scene.chapterId];
  const architectural = scene.role === "architectural" || scene.role === "finale";
  const reflective = scene.role === "reflection" || scene.biome === "mirror" || scene.biome === "archive";

  return (
    <group>
      <SceneGround radius={reducedEffects ? 4.5 : 6.2} color={palette.ground} y={-0.24} />
      <mesh position={[0, architectural ? 2.15 : 1.2, 0]} scale={architectural ? [2.7, 4.3, 1.5] : [2.4, 1.6, 2.4]}>
        {architectural ? <boxGeometry args={[1, 1, 1]} /> : <dodecahedronGeometry args={[1, 0]} />}
        <meshStandardMaterial
          color={palette.mid}
          emissive={palette.deep}
          emissiveIntensity={0.15}
          roughness={reflective ? 0.32 : 0.96}
          metalness={reflective ? 0.28 : 0}
          transparent
          opacity={reducedEffects ? 0.3 : 0.42}
          depthWrite={false}
        />
      </mesh>
      <mesh position={[0, architectural ? 5.1 : 2.75, 0]}>
        <sphereGeometry args={[0.17, 9, 7]} />
        <meshBasicMaterial color={palette.accent} transparent opacity={0.72} depthWrite={false} toneMapped={false} />
      </mesh>
    </group>
  );
}

function JourneySceneDirectorComponent({
  activeSceneId,
  qualityProfile,
  reducedEffects = false,
  reducedMotion = false,
  activeOrigin,
  renderAdjacent = true,
  openingResolved = true,
  interactionsEnabled = true,
  onFinalConstellationFormationComplete,
}: JourneySceneDirectorProps) {
  const activeScene = getJourneySceneLayout(activeSceneId);
  const renderWindow = useMemo(() => resolveJourneyRenderWindow(activeSceneId), [activeSceneId]);
  const worldOffset: Vec3 = activeOrigin
    ? [
        activeOrigin[0] - activeScene.anchor.position[0],
        activeOrigin[1] - activeScene.anchor.position[1],
        activeOrigin[2] - activeScene.anchor.position[2],
      ]
    : [0, 0, 0];
  const ActiveChapter = CHAPTER_COMPONENTS[activeScene.chapterId];

  return (
    <group name="authored-journey-scene-window" position={worldOffset}>
      {renderWindow.entries.map((entry) => {
        const scene = getJourneySceneLayout(entry.sceneId);
        const position = mutablePoint(scene.anchor.position);
        if (entry.mode === "active") {
          return (
            <group
              key={entry.sceneId}
              name={`journey-scene:${entry.sceneId}`}
              position={position}
              rotation={[0, scene.anchor.headingRadians, 0]}
            >
              {interactionsEnabled ? <StoryEventDirector sceneId={entry.sceneId} reducedMotion={reducedMotion} /> : null}
              {interactionsEnabled ? <ActiveStoryActors sceneId={entry.sceneId} qualityProfile={qualityProfile} reducedEffects={reducedEffects} reducedMotion={reducedMotion} /> : null}
              <EnvironmentalChoreography sceneId={entry.sceneId} qualityProfile={qualityProfile} reducedEffects={reducedEffects} reducedMotion={reducedMotion} />
              <OutdoorLandscape sceneId={entry.sceneId} quality={qualityProfile.quality} reducedEffects={reducedEffects} reducedMotion={reducedMotion} collidable={interactionsEnabled} />
              <ActiveChapter
                scene={scene}
                qualityProfile={qualityProfile}
                reducedEffects={reducedEffects}
                reducedMotion={reducedMotion}
                openingResolved={openingResolved}
                onFinalConstellationFormationComplete={
                  onFinalConstellationFormationComplete
                }
              />
            </group>
          );
        }
        if (!renderAdjacent) return null;
        return (
          <group
            key={entry.sceneId}
            name={`journey-proxy:${entry.sceneId}`}
            position={position}
            rotation={[0, scene.anchor.headingRadians, 0]}
          >
            <AdjacentSceneProxy scene={scene} reducedEffects={reducedEffects} />
          </group>
        );
      })}
    </group>
  );
}

export const JourneySceneDirector = memo(JourneySceneDirectorComponent);
export default JourneySceneDirector;
