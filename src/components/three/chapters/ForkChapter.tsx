import { memo } from "react";
import {
  DoorFrame,
  FabricVeil,
  FlickerLight,
  HouseShell,
  LanternProp,
  SceneGround,
  StonePath,
  TreeGrove,
  WaterSurface,
} from "./ChapterPrimitives";
import type { ChapterSceneProps } from "./types";
import { useJourneyStore } from "../../../stores/useJourneyStore";

const PAST_PATH_GROWTH = [
  [-4.4, 0.16, -4.8],
  [-3.5, 0.18, -1.7],
  [-5.2, 0.15, 1.5],
  [-4.05, 0.2, 4.4],
  [-6.1, 0.17, 7.2],
] as const;

const FUTURE_PATH_MARKERS = [
  [3.25, 0.18, -3.3],
  [4.25, 0.21, 0.2],
  [5.4, 0.24, 3.8],
  [6.75, 0.27, 7.1],
] as const;

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
      <SceneGround radius={20} color="#26241b" />
      <TreeGrove qualityProfile={qualityProfile} reducedEffects={reducedEffects} tint="#30392e" trunk="#2b2119" radius={27} />

      <group
        name="fork-past-path"
        position={[-3.1, 0, 1]}
        rotation={[0, -0.34, 0]}
        userData={{ memoryStage: pastPathOvergrown ? "partially-overgrown" : "open" }}
      >
        <StonePath color={pastPathOvergrown ? "#454838" : "#76644e"} count={10} length={17} fork={-0.5} />
      </group>
      {pastPathOvergrown ? (
        <group name="fork-past-path-overgrowth">
          {PAST_PATH_GROWTH.map(([x, y, z], index) => (
            <group key={`${x}:${z}`} position={[x, y, z]} rotation={[0, index * 1.31, 0]}>
              <mesh rotation={[0, 0, -0.28]}>
                <coneGeometry args={[0.2, 0.82, 5]} />
                <meshStandardMaterial color="#4d5d3d" roughness={0.98} />
              </mesh>
              <mesh position={[0.2, 0.04, 0.08]} rotation={[0, 0, 0.34]}>
                <coneGeometry args={[0.15, 0.62, 5]} />
                <meshStandardMaterial color="#354936" roughness={0.98} />
              </mesh>
            </group>
          ))}
        </group>
      ) : null}
      <group
        name="fork-future-path"
        position={[3.1, 0, 1]}
        rotation={[0, 0.34, 0]}
        userData={{ memoryStage: futurePathEstablished ? "established" : "uncertain" }}
      >
        <StonePath color={futurePathEstablished ? "#89918a" : "#3e4542"} count={10} length={17} fork={0.5} />
      </group>
      {futurePathEstablished ? (
        <group name="fork-future-path-established">
          {FUTURE_PATH_MARKERS.map(([x, y, z], index) => (
            <mesh key={`${x}:${z}`} position={[x, y, z]}>
              <sphereGeometry args={[0.1 + index * 0.012, 8, 6]} />
              <meshBasicMaterial color="#d7d2b5" transparent opacity={0.62 + index * 0.08} toneMapped={false} />
            </mesh>
          ))}
        </group>
      ) : null}

      <HouseShell
        position={[-9.5, 0, 8.5]}
        size={[6.4, 3.5, 4.8]}
        wallColor="#584534"
        roofColor="#29221c"
        openFront={false}
      />
      <FlickerLight position={[-8.2, 2.2, 6.1]} color="#dda466" intensity={1.5} distance={13} reducedMotion={reducedMotion} />

      <group position={[0, 0, -1.3]}>
        <mesh position={[0, 0.65, 0]} castShadow receiveShadow>
          <cylinderGeometry args={[1.25, 1.5, 1.3, 10]} />
          <meshStandardMaterial color="#514b40" roughness={1} />
        </mesh>
        <mesh position={[0, 1.38, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <circleGeometry args={[1.14, 10]} />
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
            <WaterSurface position={[-5.2, 0.03, -4]} size={[4.8, 4.8]} color="#243c43" opacity={0.8} circle />
            {!letGo ? (
              <mesh position={[-5.2, 0.48, -4]} castShadow>
                <dodecahedronGeometry args={[0.32, 0]} />
                <meshStandardMaterial color="#9a7557" roughness={0.94} />
              </mesh>
            ) : null}
          </group>
          <group name="fork-verb-decline-familiar-door">
            <DoorFrame position={[5.3, 0, -3.8]} width={2.5} height={3.7} depth={0.4} color="#4b3b2f" open={!declined} />
          </group>
          <group name="fork-verb-depart-turning-veil">
            <FabricVeil
              position={[-0.3, 2.6, 5.6]}
              size={[2.3, 4.3]}
              color="#b9b0a0"
              opacity={departed ? 0.18 : 0.52}
              reducedMotion={reducedMotion}
            />
          </group>
          <mesh name="fork-verb-delete-obsolete-marker" position={[6.2, 1.15, 3.5]}>
            <boxGeometry args={[0.2, 2.3, 1.5]} />
            <meshStandardMaterial
              color={deleted ? "#242420" : "#5c5143"}
              emissive={deleted ? "#000000" : "#49331f"}
              emissiveIntensity={deleted ? 0 : 0.24}
              roughness={0.94}
            />
          </mesh>
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
      <pointLight position={[8, 3, 8]} color="#73828a" intensity={0.42} distance={19} />
    </group>
  );
}

export const ForkChapter = memo(ForkChapterComponent);
export default ForkChapter;
