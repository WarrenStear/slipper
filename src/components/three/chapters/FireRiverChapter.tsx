import { LegacyChapterLight } from "../artDirection/LegacyChapterLight";
import { memo } from "react";
import {
  SceneGround,
  StonePath,
  TreeGrove,
} from "./ChapterPrimitives";
import { FirePath } from "./FirePath";
import { RiverPath } from "./RiverPath";
import { SurrenderClearing } from "./SurrenderClearing";
import type { ChapterSceneProps } from "./types";
import { useJourneyStore } from "../../../stores/useJourneyStore";

function FireRiverChapterComponent({
  scene,
  qualityProfile,
  reducedEffects,
  reducedMotion,
}: ChapterSceneProps) {
  const atFire = scene.id === "fire.boundary";
  const atRiver = scene.id === "river.wash";
  const atSurrender = scene.id === "river.release-surrender";
  const storyActorsActive = useJourneyStore(journey => journey.worldFlags["story-events.started"] === true);
  const fireResolved = useJourneyStore(
    (journey) =>
      journey.worldFlags["fire.boundary-burned"] === true ||
      journey.completedRitualIds.includes("ritual.burn-boundary"),
  );
  const riverResolved = useJourneyStore(
    (journey) =>
      journey.worldFlags["river.grief-washed"] === true ||
      journey.completedRitualIds.includes("ritual.wash-grief"),
  );
  const surrendered = useJourneyStore(
    (journey) =>
      journey.worldFlags["surrender.white-flag-raised"] === true ||
      journey.completedRitualIds.includes("ritual.surrender"),
  );

  return (
    <group
      name="fire-river-geographical-fork"
      userData={{
        activeRoute: atFire ? "fire" : atRiver ? "river" : "surrender",
        fireStage: fireResolved ? "ash-and-growth" : "boundary-flame",
        riverStage: riverResolved ? "clear-flow" : "dark-flow",
        surrenderStage: surrendered ? "released" : "held",
      }}
    >
      <SceneGround radius={23} color={surrendered ? "#282826" : "#24201d"} />
      <TreeGrove
        qualityProfile={qualityProfile}
        reducedEffects={reducedEffects}
        tint={surrendered ? "#303531" : "#292d29"}
        trunk="#211a17"
        radius={23}
      />

      <group name="fork-threshold" position={[0, 0, -3.7]}>
        <StonePath color="#5c554a" count={6} length={8.5} />
        <mesh position={[0, 0.035, 3.9]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
          <ringGeometry args={[1.8, 2.15, 32]} />
          <meshStandardMaterial color="#6d6252" roughness={0.96} />
        </mesh>
      </group>

      <FirePath
        qualityProfile={qualityProfile}
        reducedEffects={reducedEffects}
        reducedMotion={reducedMotion}
        active={atFire}
        resolved={fireResolved}
        surrendered={surrendered}
        actorsEnabled={!storyActorsActive}
      />
      <RiverPath
        qualityProfile={qualityProfile}
        reducedEffects={reducedEffects}
        reducedMotion={reducedMotion}
        active={atRiver}
        resolved={riverResolved}
        actorsEnabled={!storyActorsActive}
      />
      <SurrenderClearing
        qualityProfile={qualityProfile}
        reducedEffects={reducedEffects}
        reducedMotion={reducedMotion}
        active={atSurrender}
        resolved={surrendered}
        actorsEnabled={!storyActorsActive}
      />

      <LegacyChapterLight><hemisphereLight
        args={[surrendered ? "#d8dcda" : "#aebfc7", surrendered ? "#24221e" : "#27150f", reducedEffects ? 0.2 : 0.38]}
      /></LegacyChapterLight>
    </group>
  );
}

export const FireRiverChapter = memo(FireRiverChapterComponent);
export default FireRiverChapter;
