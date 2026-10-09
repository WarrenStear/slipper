import { RootThreshold } from "../../components/three/environment/WoodlandHabitat";
import { LegacyChapterLight } from "../../components/three/artDirection/LegacyChapterLight";
import { memo } from "react";
import { getStoryObject } from "../../storyEvents/storyEventRegistry";
import { CuboidCollider, RigidBody } from "@react-three/rapier";
import { useJourneyStore } from "../../stores/useJourneyStore";
import {
  CandleField,
  FabricVeil,
  FloatingMotes,
  LanternProp,
  SceneGround,
} from "../../components/three/chapters/ChapterPrimitives";
import { ForestDepth } from "../../components/three/environment/EnvironmentDressing";
import { MeadowFlowers } from "../../components/three/environment/WoodlandDetails";
import { ChapterLightRig } from "../../components/three/environment/ChapterLightRig";
import type { ChapterSceneProps } from "../../components/three/chapters/types";

// The object registry keeps its physical volume/event pose. This scene owns
// only the grounded image at that canonical horizontal location.
const rabbitGuide = (() => {
  const guide = getStoryObject("enchanted.guide");
  if (!guide) throw new Error("The canonical First Wood guide is missing.");
  return guide;
})();
const rabbitGuideGroundPosition: [number, number, number] = [rabbitGuide.localPosition[0], .15, rabbitGuide.localPosition[2]];

function FirstWoodSceneComponent({
  scene,
  qualityProfile,
  reducedEffects,
  reducedMotion,
}: ChapterSceneProps) {
  const isRabbitHole = scene.id === "enchanted.rabbit-hole";
  const isMeadow = scene.id === "enchanted.friendship-meadow";
  const eventDriven = useJourneyStore(state => state.worldFlags["story-events.started"] === true);

  return (
    <group>
      <SceneGround radius={16} color="#8a886c" textured />
      <ForestDepth quality={qualityProfile.quality} reducedEffects={reducedEffects} variant="enchanted-wood" />
      {!isRabbitHole ? <FloatingMotes
        qualityProfile={qualityProfile}
        reducedEffects={reducedEffects}
        reducedMotion={reducedMotion}
        color="#d6b66d"
        radius={9}
      /> : null}

      {isRabbitHole ? <RootThreshold /> : null}
      {isRabbitHole ? <RigidBody type="fixed" colliders={false}>
        <CuboidCollider args={[.66, 1.4, .66]} position={[-2.9, 1.2, 2.55]} />
        <CuboidCollider args={[.58, 1.4, .58]} position={[3, 1.2, 2.95]} />
      </RigidBody> : null}

      {isMeadow ? (
        <MeadowFlowers reducedEffects={reducedEffects} />
      ) : !eventDriven ? (
        <CandleField qualityProfile={qualityProfile} reducedEffects={reducedEffects} count={10} radius={4.8} />
      ) : null}

      {!eventDriven && !isRabbitHole ? (
        <FabricVeil
          position={[-4.7, 3.2, -1]}
          rotation={[0, 0.24, 0]}
          size={[1.8, 4.7]}
          color="#d2c9b5"
          opacity={0.58}
          reducedMotion={reducedMotion}
        />
      ) : null}
      {isRabbitHole ? <group name="first-wood-distant-guide" userData={{ storyObjectId: rabbitGuide.id }}>
        <LanternProp position={rabbitGuideGroundPosition} scale={0.78} reducedMotion={reducedMotion} light={false} />
      </group> : !eventDriven ? <LanternProp position={[0.4, 0.15, 7.6]} scale={0.78} reducedMotion={reducedMotion} /> : null}
      <ChapterLightRig family="enchanted-wood" reducedMotion={reducedMotion} reducedEffects={reducedEffects} />
      <LegacyChapterLight><hemisphereLight args={["#b6c3ad", "#15160f", reducedEffects ? 0.18 : 0.34]} /></LegacyChapterLight>
    </group>
  );
}

export const FirstWoodScene = memo(FirstWoodSceneComponent);
export const EnchantedWoodChapter = FirstWoodScene;
export default FirstWoodScene;
