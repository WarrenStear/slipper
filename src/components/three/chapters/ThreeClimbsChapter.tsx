import { TimberAssembly, Upholstery, RestingThrow, StoneBasin } from "./ChapterArt";
import { ClothboundBook, MemoryFeather } from "../storyEvents/StoryHeroProps";
import { ClimbLandscape } from "../environment/ClimbLandscape";
import { LegacyChapterLight } from "../artDirection/LegacyChapterLight";
import { BotanicalCluster } from "../environmentArt/EnvironmentArt";
import { mergeArtGeometries } from "../environmentArt/authoredGeometry";
import { createWeatheredBoulderGeometry } from "./chapterArtGeometry";
import { TactileMaterial } from "../storyEvents/TactileMaterial";
import { memo, useEffect, useMemo } from "react";
import {
  Beam,
  FabricVeil,
  KeyProp,
  MoonDisc,
  SceneGround,
  StonePath,
  WaterSurface,
} from "./ChapterPrimitives";
import type { ChapterSceneProps } from "./types";
import { useJourneyStore } from "../../../stores/useJourneyStore";
import { getJourneySceneArrivalHeading } from "../../../data/journeyWorldLayout";
import {
  HEART_MEMORY_WORLD_TARGETS,
  WOMB_FUTURE_WORLD_TARGETS,
} from "../../../lib/journeyPlayerActions";

const PAPER_FRAGMENTS = Array.from({ length: 16 }, (_, index) => ({
  position: [
    -5 + (index * 2.7) % 10,
    1.2 + (index % 5) * 0.85,
    -5 + Math.floor(index / 4) * 2.8,
  ] as [number, number, number],
  rotation: [0.2 * (index % 3), index * 0.51, 0.16 * (index % 4)] as [number, number, number],
}));
const SCENIC_BOULDER_INDICES = [0, 1, 2, 3, 4, 5] as const;
const NO_SCENIC_BOULDERS: readonly number[] = [];

function GroundedOutcrops() {
  const geometry = useMemo(() => mergeArtGeometries(SCENIC_BOULDER_INDICES.map(index => {
    const rock = createWeatheredBoulderGeometry(13 + index * 3);
    rock.scale(1.3 + index % 2 * .3, 1.5 + index % 3 * .28, 1.3 + index % 3 * .16);
    rock.rotateY(index * .93);
    rock.translate((index % 2 === 0 ? -1 : 1) * (4.8 + index % 3), 0, -6 + index * 2.6);
    return rock;
  })), []);
  useEffect(() => () => geometry.dispose(), [geometry]);
  return <mesh name="grounded-weathered-climb-outcrops" geometry={geometry} receiveShadow>
    <TactileMaterial surface="stone" color="#60645b" roughness={.98} />
  </mesh>;
}

function MemoryPedestal({ selected }: { selected: boolean }) {
  return <StoneBasin position={[0,.15,0]} radius={.83} height={.3} color={selected ? "#8f816b" : "#6a665a"} />;
}

function HeartRoseMemory({ selected, reducedEffects }: { selected: boolean; reducedEffects: boolean }) {
  const target = HEART_MEMORY_WORLD_TARGETS["heart.tenderness"];
  return (
    <group
      name="heart-memory-tenderness-rose"
      position={[target.localPosition[0], 0, target.localPosition[1]]}
      userData={{
        symbolicObjectId: "memory.heart.tenderness",
        worldChoiceId: "heart.tenderness",
        interaction: "approach-and-press",
        interactionRadius: target.radius,
        selected,
      }}
    >
      <MemoryPedestal selected={selected} />
      <BotanicalCluster kind="rose" position={[0, .36, 0]} scale={2.15} seed={41} color={selected ? "#d49aa3" : "#a36f78"} />
      {selected && !reducedEffects ? (
        <pointLight position={[0, 1.75, 0]} color="#d9a0a8" intensity={0.74} distance={5} />
      ) : null}
    </group>
  );
}

function HeartSwanFeatherMemory({ selected, reducedEffects }: { selected: boolean; reducedEffects: boolean }) {
  const target = HEART_MEMORY_WORLD_TARGETS["heart.beauty"];
  return (
    <group
      name="heart-memory-beauty-swan-feather"
      position={[target.localPosition[0], 0, target.localPosition[1]]}
      userData={{
        symbolicObjectId: "memory.heart.beauty",
        worldChoiceId: "heart.beauty",
        interaction: "approach-and-press",
        interactionRadius: target.radius,
        selected,
      }}
    >
      <MemoryPedestal selected={selected} />
      <group position={[0,.37,0]} rotation={[.15,-.24,-.45]} scale={2.1}><MemoryFeather /></group>
      {selected && !reducedEffects ? (
        <pointLight position={[0, 1.45, 0]} color="#dce8ed" intensity={0.7} distance={5} />
      ) : null}
    </group>
  );
}

function HeartBlueMoonMemory({ selected, reducedEffects }: { selected: boolean; reducedEffects: boolean }) {
  const target = HEART_MEMORY_WORLD_TARGETS["heart.selfhood"];
  return (
    <group
      name="heart-memory-selfhood-blue-moon-reflection"
      position={[target.localPosition[0], 0, target.localPosition[1]]}
      userData={{
        symbolicObjectId: "memory.heart.selfhood",
        worldChoiceId: "heart.selfhood",
        interaction: "approach-and-press",
        interactionRadius: target.radius,
        selected,
      }}
    >
      <MemoryPedestal selected={selected} />
      <mesh position={[0, 1.22, 0]}>
        <circleGeometry args={[0.72, 32]} />
        <meshPhysicalMaterial
          color={selected ? "#afcfdf" : "#647f8d"}
          emissive={selected ? "#426e86" : "#000000"}
          emissiveIntensity={selected ? 0.48 : 0}
          metalness={0.54}
          roughness={0.12}
          clearcoat={0.78}
          side={2}
        />
      </mesh>
      <mesh position={[0.2, 1.38, -0.025]} scale={0.42}>
        <circleGeometry args={[0.72, 24]} />
        <meshBasicMaterial color="#e3edf2" transparent opacity={selected ? 0.9 : 0.55} toneMapped={false} side={2} />
      </mesh>
      {selected && !reducedEffects ? (
        <pointLight position={[0, 1.3, 0.4]} color="#a7cede" intensity={0.76} distance={5} />
      ) : null}
    </group>
  );
}

function FutureRestSymbol({
  selected,
  reducedEffects,
  reducedMotion,
}: {
  selected: boolean;
  reducedEffects: boolean;
  reducedMotion: boolean;
}) {
  const target = WOMB_FUTURE_WORLD_TARGETS["future.rest"];
  return (
    <group
      name="womb-future-rest"
      position={[target.localPosition[0], 0.05, target.localPosition[1]]}
      userData={{
        symbolicObjectId: "creation.future.rest",
        worldChoiceId: "future.rest",
        interaction: "approach-and-press",
        interactionRadius: target.radius,
        selected,
        approachable: true,
      }}
    >
      <Upholstery position={[0, .13, 0]} size={[1.58,.24,1.04]} color={selected ? "#b2a38c" : "#998c7b"} surface="linen" />
      <Upholstery position={[-.47,.31,.06]} size={[.54,.17,.78]} color="#c2b7a2" surface="linen" />
      <RestingThrow position={[.2,.27,-.09]} rotation={[0,Math.PI,0]} size={[.77,1.22]} maxDrop={.24} color="#918d78" />
    </group>
  );
}

function FutureHomeSymbol({ selected, reducedEffects }: { selected: boolean; reducedEffects: boolean }) {
  const target = WOMB_FUTURE_WORLD_TARGETS["future.home"];
  return (
    <group
      name="womb-future-home"
      position={[target.localPosition[0], 0.05, target.localPosition[1]]}
      userData={{
        symbolicObjectId: "creation.future.home",
        worldChoiceId: "future.home",
        interaction: "approach-and-press",
        interactionRadius: target.radius,
        selected,
        approachable: true,
      }}
    >
      <TimberAssembly name="joined-model-of-an-open-home" color={selected ? "#a5906d" : "#857354"} pieces={[
        {position:[0,.025,0],size:[1.54,.05,1.16]},
        {position:[-.65,.42,0],size:[.075,.79,1]}, {position:[.65,.42,0],size:[.075,.79,1]},
        {position:[0,.42,.48],size:[1.25,.79,.055]},
        {position:[-.39,.93,0],size:[.95,.055,1.22],rotation:[0,0,.33]},
        {position:[.39,.93,0],size:[.95,.055,1.22],rotation:[0,0,-.33]},
        {position:[0,.78,-.49],size:[1.27,.06,.06]},
      ]} />
    </group>
  );
}

function FutureVoiceSymbol({ selected, reducedEffects }: { selected: boolean; reducedEffects: boolean }) {
  const target = WOMB_FUTURE_WORLD_TARGETS["future.voice"];
  return (
    <group
      name="womb-future-voice"
      position={[target.localPosition[0], 0.05, target.localPosition[1]]}
      userData={{
        symbolicObjectId: "creation.future.voice",
        worldChoiceId: "future.voice",
        interaction: "approach-and-press",
        interactionRadius: target.radius,
        selected,
        approachable: true,
      }}
    >
      <group position={[0,.06,0]} rotation={[0,.2,0]}><ClothboundBook open /></group>
      <Beam from={[-.25,.14,-.07]} to={[.3,.15,.18]} radius={.012} color={selected ? "#786044" : "#514938"} />
    </group>
  );
}

function ProtectedCreationSpace({
  reducedEffects,
  reducedMotion,
  chosen,
}: {
  reducedEffects: boolean;
  reducedMotion: boolean;
  chosen: boolean;
}) {
  const ribIndices = [0, 1];
  return (
    <group
      name="womb-protected-creation-space"
      position={[0, 0.1, 4.5]}
      userData={{ protectedByRecoveredKey: true }}
    >
      {ribIndices.map((index) => {
        const angle = 2.18 + index * .36;
        return (
          <Beam
            key={index}
            from={[Math.cos(angle) * 4.65, 0, Math.sin(angle) * 3]}
            to={[Math.cos(angle) * 4.55, .46, Math.sin(angle) * 2.95]}
            radius={0.075}
            color="#7a6446"
          />
        );
      })}
      <FabricVeil
        position={[-3.25, .4, 2.15]}
        rotation={[0, .72, 0]}
        size={[1.6, .52]}
        color="#d8c6a2"
        opacity={chosen ? 0.48 : 0.26}
        reducedMotion={reducedMotion}
      />

    </group>
  );
}

function ThreeClimbsChapterComponent({
  scene,
  qualityProfile,
  reducedEffects,
  reducedMotion,
}: ChapterSceneProps) {
  const isArrival = scene.id === "climbs.arrival";
  const isMind = scene.id === "climb.mind";
  const isHeart = scene.id === "climb.heart";
  const isWomb = scene.id === "climb.womb";
  const questionsReleased = useJourneyStore(
    (journey) => journey.worldFlags["climb.mind.questions-released"] === true,
  );
  const heartMemoryChosen = useJourneyStore(
    (journey) => journey.worldFlags["climb.heart.memory-chosen"] === true,
  );
  const creationChosen = useJourneyStore(
    (journey) => journey.worldFlags["climb.womb.creation-chosen"] === true,
  );
  const tendernessSelected = useJourneyStore(
    (journey) => journey.inventory.symbolicObjects.includes("memory.heart.tenderness"),
  );
  const beautySelected = useJourneyStore(
    (journey) => journey.inventory.symbolicObjects.includes("memory.heart.beauty"),
  );
  const selfhoodSelected = useJourneyStore(
    (journey) => journey.inventory.symbolicObjects.includes("memory.heart.selfhood"),
  );
  const restSelected = useJourneyStore(
    (journey) => journey.inventory.symbolicObjects.includes("creation.future.rest"),
  );
  const homeSelected = useJourneyStore(
    (journey) => journey.inventory.symbolicObjects.includes("creation.future.home"),
  );
  const voiceSelected = useJourneyStore(
    (journey) => journey.inventory.symbolicObjects.includes("creation.future.voice"),
  );
  const paperCount = questionsReleased
    ? 0
    : reducedEffects ? 5 : qualityProfile.quality === "low" ? 8 : PAPER_FRAGMENTS.length;
  const scenicBoulderIndices = isHeart || isWomb ? NO_SCENIC_BOULDERS : SCENIC_BOULDER_INDICES;
  const arrivalHeading = getJourneySceneArrivalHeading(scene.id);

  return (
    <group>
      {isMind || isHeart || isWomb ? <group rotation={[0, arrivalHeading, 0]}><ClimbLandscape kind={isMind ? "mind" : isHeart ? "heart" : "womb"} released={questionsReleased} /></group> : null}
      <SceneGround radius={19} color={isWomb ? "#64583f" : "#373936"} />
      {isWomb ? null : <group rotation={[-0.16, 0, 0]} position={[0, 0.3, 0]}>
        <StonePath color={isHeart ? "#777e81" : "#66645d"} count={12} length={19} />
      </group>}
      {scenicBoulderIndices.length ? <group position={[0, 0, isArrival ? -5 : 0]}><GroundedOutcrops /></group> : null}

      {isArrival ? (
        <group position={[0, 0.3, 4]}>
          <Beam from={[0, 0, 0]} to={[-5.5, 5.5, 5]} radius={0.22} color="#5d5d58" />
          <Beam from={[0, 0, 0]} to={[0, 7.2, 6.2]} radius={0.22} color="#77746c" />
          <Beam from={[0, 0, 0]} to={[5.5, 9, 5]} radius={0.22} color="#8b7856" />
        </group>
      ) : null}

      {isMind ? (
        <group>
          {PAPER_FRAGMENTS.slice(0, paperCount).map((paper, index) => (
            <mesh key={index} position={paper.position} rotation={paper.rotation}>
              <planeGeometry args={[1.15, 0.72]} />
              <meshStandardMaterial color="#c9c5b8" roughness={0.96} side={2} />
            </mesh>
          ))}
          <LegacyChapterLight><directionalLight position={[-8, 8, -4]} color="#abb7c2" intensity={0.7} /></LegacyChapterLight>
        </group>
      ) : null}

      {isHeart ? (
        <group
          name="heart-three-physical-memories"
          rotation={[0, arrivalHeading, 0]}
          userData={{ choiceCount: 3, selected: heartMemoryChosen, stagedTowardArrival: true }}
        >
          <WaterSurface reducedMotion={reducedMotion} reducedEffects={reducedEffects} position={[0, 0.02, 5]} size={[12, 7]} color="#1e3543" opacity={0.84} />
          <MoonDisc
            position={[0, 9, 13]}
            radius={3.3}
            qualityProfile={qualityProfile}
            reducedEffects={reducedEffects}
            reducedMotion={reducedMotion}
          />
          <HeartRoseMemory selected={tendernessSelected} reducedEffects={reducedEffects} />
          <HeartSwanFeatherMemory selected={beautySelected} reducedEffects={reducedEffects} />
          <HeartBlueMoonMemory selected={selfhoodSelected} reducedEffects={reducedEffects} />
          <LegacyChapterLight><hemisphereLight args={["#a9c1ce", "#241b1d", reducedEffects ? 0.48 : 0.72]} /></LegacyChapterLight>
        </group>
      ) : null}

      {isWomb ? (
        <group
          name="womb-three-approachable-futures"
          rotation={[0, arrivalHeading, 0]}
          userData={{ choiceCount: 3, selected: creationChosen, stagedTowardArrival: true }}
        >
          <ProtectedCreationSpace reducedEffects={reducedEffects} reducedMotion={reducedMotion} chosen={creationChosen} />
          <FutureRestSymbol selected={restSelected} reducedEffects={reducedEffects} reducedMotion={reducedMotion} />
          <FutureHomeSymbol selected={homeSelected} reducedEffects={reducedEffects} />
          <FutureVoiceSymbol selected={voiceSelected} reducedEffects={reducedEffects} />
          <Upholstery position={[.22,.055,3]} size={[1.06,.05,.64]} surface="linen" color="#aaa291" />
          <KeyProp position={[0, .1, 3]} scale={0.52} color={creationChosen ? "#f1cb73" : "#d0ad63"} />
          <LegacyChapterLight><directionalLight position={[8, 12, -8]} color="#ffd89f" intensity={creationChosen ? 1.24 : 0.95} /></LegacyChapterLight>
          <LegacyChapterLight><hemisphereLight args={["#ead5ad", "#2f271d", reducedEffects ? 0.44 : 0.66]} /></LegacyChapterLight>
        </group>
      ) : null}
    </group>
  );
}

export const ThreeClimbsChapter = memo(ThreeClimbsChapterComponent);
export default ThreeClimbsChapter;
