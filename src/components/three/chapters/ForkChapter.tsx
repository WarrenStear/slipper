import { ClothboundBook, StoryLinen } from "../storyEvents/StoryHeroProps";
import { TimberAssembly } from "./ChapterArt";
import { ForkLandscape } from "../environment/ForkLandscape";
import { memo } from "react";
import {
  DoorFrame,
  FabricVeil,
  FlickerLight,
  HouseShell,
  LanternProp,
  SceneGround,
  WaterSurface,
} from "./ChapterPrimitives";
import type { ChapterSceneProps } from "./types";
import { useJourneyStore } from "../../../stores/useJourneyStore";

function ForkChapterComponent({
  scene,
  qualityProfile,
  reducedEffects,
  reducedMotion,
}: ChapterSceneProps) {
  const fourVerbs = scene.id === "fork.four-verbs";
  const ownershipScene = scene.id === "fork.relinquish-hope";
  const weighed = useJourneyStore((journey) => journey.worldFlags["fork.weighed"] === true);
  const letGo = useJourneyStore((journey) => journey.worldFlags["fork.let-go"] === true);
  const declined = useJourneyStore((journey) => journey.worldFlags["fork.declined"] === true);
  const departed = useJourneyStore((journey) => journey.worldFlags["fork.departed"] === true);
  const deleted = useJourneyStore((journey) => journey.worldFlags["fork.deleted"] === true);
  const oldHopeRelinquished = useJourneyStore(
    (journey) => journey.worldFlags["fork.old-hope-relinquished"] === true,
  );
  const lanternOwned = useJourneyStore((journey) => journey.worldFlags["lantern.owned"] === true);
  const storyActorsActive = useJourneyStore((journey) => journey.worldFlags["story-events.started"] === true);
  const pastPathOvergrown = departed || deleted || oldHopeRelinquished || lanternOwned;
  const futurePathEstablished = deleted || oldHopeRelinquished || lanternOwned;
  const rememberFourVerbs = fourVerbs || letGo || declined || departed || deleted;
  const rememberOwnership = ownershipScene || oldHopeRelinquished || lanternOwned;

  return (
    <group
      name="fork-memory-landscape"
      userData={{
        pastPathStage: pastPathOvergrown ? "partially-overgrown" : "open",
        futurePathStage: futurePathEstablished ? "established" : "uncertain",
        lanternStage: lanternOwned ? "owned" : "guided",
      }}
    >
      <SceneGround radius={42} color="#26241b" />
      <ForkLandscape overgrown={pastPathOvergrown} established={futurePathEstablished} reducedEffects={reducedEffects || qualityProfile.quality === "low"} />

      <HouseShell
        position={[-9.5, 0, 8.5]}
        size={[6.4, 3.5, 4.8]}
        wallColor="#584534"
        roofColor="#29221c"
        openFront={false}
      />
      <FlickerLight position={[-8.2, 2.2, 6.1]} color="#dda466" intensity={1.5} distance={13} reducedMotion={reducedMotion} />

      <group position={[0, 0, -1.3]}>
        <mesh position={[0, 0.02, 0]} scale={[1, .22, .82]} castShadow receiveShadow>
          <sphereGeometry args={[1.3, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2]} />
          <meshStandardMaterial color="#514b40" roughness={1} />
        </mesh>
        <mesh position={[0, 0.315, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <circleGeometry args={[.62, 16]} />
          <meshStandardMaterial
            color={weighed ? "#8d7d61" : "#676052"}
            emissive={weighed ? "#4e3a20" : "#000000"}
            emissiveIntensity={weighed ? 0.38 : 0}
            roughness={0.98}
          />
        </mesh>
      </group>

      {rememberFourVerbs ? (
        <group
          name="fork-four-verbs-memory"
          userData={{ letGo, declined, departed, deleted }}
        >
          <group name="fork-verb-let-go-moving-water">
            <WaterSurface reducedMotion={reducedMotion} reducedEffects={reducedEffects} position={[-5.2, 0.03, -4]} size={[4.8, 4.8]} color="#243c43" opacity={0.8} circle />
            {!letGo ? (
              <group position={[-5.2, .12, -4]} rotation={[0, -.3, 0]} scale={.8}><StoryLinen /><group position={[.04,.06,0]} scale={.72}><ClothboundBook /></group></group>
            ) : null}
          </group>
          <group name="fork-verb-decline-familiar-door">
            <DoorFrame position={[5.3, 0, -3.8]} width={2.5} height={3.7} depth={0.4} color="#4b3b2f" open={!declined} />
          </group>
          <group name="fork-verb-depart-turning-veil">
            <TimberAssembly color="#695e4b" pieces={[
              {position:[-1.55,2.3,5.65],size:[.1,4.6,.12],rotation:[0,0,-.018]},
              {position:[.96,2.28,5.65],size:[.12,4.56,.11],rotation:[0,0,.025]},
              {position:[-.3,4.55,5.65],size:[2.8,.09,.12]},
            ]} />
            <FabricVeil
              position={[-0.3, 2.6, 5.6]}
              size={[2.3, 4.3]}
              color="#b9b0a0"
              opacity={departed ? 0.18 : 0.52}
              reducedMotion={reducedMotion}
            />
          </group>
          <group name="fork-verb-delete-obsolete-marker" position={[6.2, 0, 3.5]} rotation={[0,.12,-.04]}>
            <TimberAssembly color={deleted ? "#554d40" : "#655442"} pieces={[
              {position:[0,.8,0],size:[.12,1.6,.12]}, {position:[0,1.2,0],size:[1.2,.3,.09]},
              {position:[.03,.8,0],size:[.8,.22,.095]},
            ]} />
          </group>
        </group>
      ) : null}

      {rememberOwnership ? (
        <group name="fork-lantern-ownership-memory" userData={{ oldHopeRelinquished, lanternOwned }}>
          {!oldHopeRelinquished ? (
            <FabricVeil position={[0, 1.85, 3.35]} size={[1.35, 2.5]} color="#c5b7a2" opacity={0.42} reducedMotion={reducedMotion} />
          ) : null}
          {!storyActorsActive ? <>
            <LanternProp position={[0, lanternOwned ? 1.32 : 1.1, 3.2]} scale={lanternOwned ? 1.24 : 1.1} reducedMotion={reducedMotion} />
            {lanternOwned ? <pointLight position={[0, 2.05, 3.2]} color="#ffd88f" intensity={1.35} distance={10} /> : null}
          </> : null}
        </group>
      ) : null}
    </group>
  );
}

export const ForkChapter = memo(ForkChapterComponent);
export default ForkChapter;
