import { BotanicalCluster } from "../environmentArt/EnvironmentArt";
import { memo } from "react";
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

function MemoryPedestal({ selected }: { selected: boolean }) {
  return (
    <>
      <mesh position={[0, 0.16, 0]} receiveShadow>
        <cylinderGeometry args={[0.86, 1.02, 0.32, 18]} />
        <meshStandardMaterial
          color={selected ? "#9d825d" : "#59554d"}
          emissive={selected ? "#73502a" : "#000000"}
          emissiveIntensity={selected ? 0.34 : 0}
          roughness={0.92}
        />
      </mesh>
      <mesh position={[0, 0.34, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.62, 0.72, 24]} />
        <meshBasicMaterial
          color={selected ? "#efca83" : "#888174"}
          transparent
          opacity={selected ? 0.82 : 0.34}
        />
      </mesh>
    </>
  );
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
      <BotanicalCluster kind="rose" position={[0, .36, 0]} scale={3.25} seed={41} color={selected ? "#d49aa3" : "#a36f78"} />
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
      <group position={[0, 1.26, 0]} rotation={[0.08, -0.24, -0.32]} scale={1.08}>
        <Beam from={[0, -0.72, 0]} to={[0, 0.86, 0]} radius={0.035} color={selected ? "#f2eee5" : "#c9c8c1"} />
        {[-0.46, -0.18, 0.1, 0.38, 0.62].map((y, index) => {
          const reach = 0.58 - index * 0.075;
          return (
            <group key={y}>
              <Beam from={[0, y, 0]} to={[-reach, y + 0.22, 0]} radius={0.022} color="#e4e2db" opacity={selected ? 0.96 : 0.66} />
              <Beam from={[0, y, 0]} to={[reach, y + 0.22, 0]} radius={0.022} color="#e4e2db" opacity={selected ? 0.96 : 0.66} />
            </group>
          );
        })}
      </group>
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
      <mesh position={[0.2, 1.38, 0.025]} scale={0.42}>
        <circleGeometry args={[0.72, 24]} />
        <meshBasicMaterial color="#e3edf2" transparent opacity={selected ? 0.9 : 0.55} toneMapped={false} side={2} />
      </mesh>
      {!reducedEffects ? (
        <mesh position={[0, 1.22, -0.02]} scale={1.28}>
          <ringGeometry args={[0.62, 0.69, 32]} />
          <meshBasicMaterial
            color="#95b9ca"
            transparent
            opacity={selected ? 0.5 : 0.18}
            depthWrite={false}
            toneMapped={false}
            side={2}
          />
        </mesh>
      ) : null}
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
      position={[target.localPosition[0], 0.46, target.localPosition[1]]}
      userData={{
        symbolicObjectId: "creation.future.rest",
        worldChoiceId: "future.rest",
        interaction: "approach-and-press",
        interactionRadius: target.radius,
        selected,
        approachable: true,
      }}
    >
      <mesh position={[0, 0.28, 0]} scale={[1.35, 0.28, 0.88]}>
        <sphereGeometry args={[0.72, 14, 9]} />
        <meshStandardMaterial
          color={selected ? "#c8a898" : "#8c756a"}
          emissive={selected ? "#70483d" : "#000000"}
          emissiveIntensity={selected ? 0.26 : 0}
          roughness={1}
        />
      </mesh>
      <mesh position={[-0.72, 0.55, 0]} scale={[0.5, 0.22, 0.68]}>
        <sphereGeometry args={[0.7, 12, 8]} />
        <meshStandardMaterial color="#d6c8b7" roughness={1} />
      </mesh>
      {!reducedEffects ? (
        <FabricVeil
          position={[0, 1.22, 0.28]}
          size={[2.2, 1.18]}
          color="#b99689"
          opacity={0.34}
          reducedMotion={reducedMotion}
        />
      ) : null}
      {selected && !reducedEffects ? (
        <pointLight position={[0, 1.1, 0]} color="#e4bd9d" intensity={0.64} distance={5} />
      ) : null}
    </group>
  );
}

function FutureHomeSymbol({ selected, reducedEffects }: { selected: boolean; reducedEffects: boolean }) {
  const target = WOMB_FUTURE_WORLD_TARGETS["future.home"];
  return (
    <group
      name="womb-future-home"
      position={[target.localPosition[0], 0.38, target.localPosition[1]]}
      userData={{
        symbolicObjectId: "creation.future.home",
        worldChoiceId: "future.home",
        interaction: "approach-and-press",
        interactionRadius: target.radius,
        selected,
        approachable: true,
      }}
    >
      <mesh position={[0, 0.72, 0]}>
        <boxGeometry args={[1.62, 1.38, 1.16]} />
        <meshStandardMaterial
          color={selected ? "#a88d68" : "#76664f"}
          emissive={selected ? "#64451f" : "#000000"}
          emissiveIntensity={selected ? 0.3 : 0}
          roughness={0.96}
        />
      </mesh>
      <mesh position={[0, 1.55, 0]} rotation={[0, 0, Math.PI / 4]}>
        <boxGeometry args={[1.24, 1.24, 1.32]} />
        <meshStandardMaterial color="#4d493d" roughness={0.98} />
      </mesh>
      <mesh position={[0, 0.6, -0.6]}>
        <boxGeometry args={[0.48, 0.82, 0.08]} />
        <meshBasicMaterial color={selected ? "#f1c57b" : "#7d6d55"} toneMapped={false} />
      </mesh>
      {selected && !reducedEffects ? (
        <pointLight position={[0, 1.2, -0.8]} color="#f2c97e" intensity={0.7} distance={5} />
      ) : null}
    </group>
  );
}

function FutureVoiceSymbol({ selected, reducedEffects }: { selected: boolean; reducedEffects: boolean }) {
  const target = WOMB_FUTURE_WORLD_TARGETS["future.voice"];
  return (
    <group
      name="womb-future-voice"
      position={[target.localPosition[0], 0.34, target.localPosition[1]]}
      userData={{
        symbolicObjectId: "creation.future.voice",
        worldChoiceId: "future.voice",
        interaction: "approach-and-press",
        interactionRadius: target.radius,
        selected,
        approachable: true,
      }}
    >
      <mesh position={[0, 0.5, 0]} rotation={[-0.08, 0.2, 0]}>
        <boxGeometry args={[1.8, 0.08, 1.22]} />
        <meshStandardMaterial
          color={selected ? "#d7d0bf" : "#9a9488"}
          emissive={selected ? "#75684d" : "#000000"}
          emissiveIntensity={selected ? 0.2 : 0}
          roughness={0.92}
        />
      </mesh>
      <Beam from={[-0.5, 0.58, 0.05]} to={[0.58, 1.3, -0.05]} radius={0.045} color="#4f4033" />
      {[0.45, 0.72, 0.99].map((radius, index) => (
        <mesh key={radius} position={[0.72, 1.35, 0]}>
          <ringGeometry args={[radius, radius + 0.025, 24, 1, -0.65, 1.3]} />
          <meshBasicMaterial
            color="#b9d1d4"
            transparent
            opacity={selected ? 0.48 - index * 0.1 : 0.16}
            depthWrite={false}
            toneMapped={false}
            side={2}
          />
        </mesh>
      ))}
      {selected && !reducedEffects ? (
        <pointLight position={[0, 1.25, 0.4]} color="#b9d5d8" intensity={0.64} distance={5} />
      ) : null}
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
  const ribIndices = reducedEffects ? [0, 2, 4] : [0, 1, 2, 3, 4];
  return (
    <group
      name="womb-protected-creation-space"
      position={[0, 0.1, 4.5]}
      userData={{ protectedByRecoveredKey: true }}
    >
      {ribIndices.map((index) => {
        const angle = -Math.PI * 0.8 + index * (Math.PI * 1.6) / 4;
        return (
          <Beam
            key={index}
            from={[Math.cos(angle) * 3.65, 0, Math.sin(angle) * 2]}
            to={[Math.cos(angle) * 1.05, 4.05, Math.sin(angle) * 0.7]}
            radius={0.075}
            color="#7a6446"
          />
        );
      })}
      <FabricVeil
        position={[0, 2.1, 0]}
        rotation={[0, 0, 0]}
        size={[5.4, 2.75]}
        color="#d8c6a2"
        opacity={chosen ? 0.48 : 0.26}
        reducedMotion={reducedMotion}
      />
      <mesh position={[0, 0.18, 0]} scale={[0.9, 1, 0.8]}>
        <cylinderGeometry args={[2.8, 3.2, 0.36, 18]} />
        <meshStandardMaterial
          color={chosen ? "#8f774f" : "#67563f"}
          emissive={chosen ? "#5b3b18" : "#000000"}
          emissiveIntensity={chosen ? 0.28 : 0}
          roughness={0.98}
        />
      </mesh>
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
      <SceneGround radius={19} color={isWomb ? "#64583f" : "#373936"} />
      <group rotation={[-0.16, 0, 0]} position={[0, 0.3, 0]}>
        <StonePath color={isHeart ? "#777e81" : "#66645d"} count={12} length={19} />
      </group>
      {scenicBoulderIndices.map((index) => (
        <mesh key={index} position={[(index % 2 === 0 ? -1 : 1) * (4.8 + (index % 3)), index * 0.58, -6 + index * 2.6]}>
          <dodecahedronGeometry args={[1.3 + (index % 2) * 0.45, 0]} />
          <meshStandardMaterial color={isWomb ? "#77684b" : "#4c504f"} roughness={1} />
        </mesh>
      ))}

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
          <directionalLight position={[-8, 8, -4]} color="#abb7c2" intensity={0.7} />
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
          <FabricVeil position={[0, 4.4, 7.4]} size={[7, 2.6]} color="#dadde0" opacity={0.22} reducedMotion={reducedMotion} />
          <HeartRoseMemory selected={tendernessSelected} reducedEffects={reducedEffects} />
          <HeartSwanFeatherMemory selected={beautySelected} reducedEffects={reducedEffects} />
          <HeartBlueMoonMemory selected={selfhoodSelected} reducedEffects={reducedEffects} />
          <hemisphereLight args={["#a9c1ce", "#241b1d", reducedEffects ? 0.48 : 0.72]} />
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
          <KeyProp position={[0, creationChosen ? 1.42 : 1.2, 3]} scale={0.52} color={creationChosen ? "#f1cb73" : "#d0ad63"} />
          <directionalLight position={[8, 12, -8]} color="#ffd89f" intensity={creationChosen ? 1.24 : 0.95} />
          <hemisphereLight args={["#ead5ad", "#2f271d", reducedEffects ? 0.44 : 0.66]} />
        </group>
      ) : null}
    </group>
  );
}

export const ThreeClimbsChapter = memo(ThreeClimbsChapterComponent);
export default ThreeClimbsChapter;
