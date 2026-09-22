import { ForestDepth } from "../environment/EnvironmentDressing";
import { ChapterLightRig } from "../environment/ChapterLightRig";
import { SanctuaryWater } from "../environment/SanctuaryWater";
import { memo, useMemo } from "react";
import { SwanModel } from "../storyEvents/SwanModel";
import { BotanicalBatch } from "../environmentArt/EnvironmentArt";
import { TimberAssembly } from "./ChapterArt";
import type { ConstructionPiece } from "./chapterArtGeometry";
import {
  Beam,
  CandleField,
  DoorFrame,
  FabricVeil,
  FloatingMotes,
  MoonDisc,
  SceneGround,
  StonePath,
} from "./ChapterPrimitives";
import type { ChapterSceneProps } from "./types";
import { useJourneyStore } from "../../../stores/useJourneyStore";
import { ObservedSanctuaryReflection } from "../storyEvents/ObservedSanctuaryReflection";

const BRIDGE_PLANKS = Array.from({ length: 13 }, (_, index) => index);
const LILIES = Array.from({ length: 16 }, (_, index) => ({
  x: -7 + (index * 2.3) % 14,
  z: -5 + (index * 3.7) % 10,
  scale: 0.45 + (index % 4) * 0.08,
}));

function WornSanctuaryBridge() {
  const boards = useMemo<ConstructionPiece[]>(() => BRIDGE_PLANKS.map(index => ({
    position: [0, Math.sin(index * .45) * .08, -7.2 + index * 1.2], size: [3.8, .2, .92],
    color: index % 2 ? "#9b8976" : "#bfaa8c",
  })), []);
  const supports = useMemo<ConstructionPiece[]>(() => [-1, 1].flatMap(side => [
    { position: [side * 1.65, -.24, 0] as [number, number, number], size: [.16, .3, 15.4] as [number, number, number] },
    ...[-6, 0, 6].map(z => ({ position: [side * 2.1, .24 + (z + 8) / 15.4 * .65, z] as [number, number, number], size: [.14, .85, .14] as [number, number, number] })),
  ]), []);
  return <group position={[0, .3, 0]} name="weathered-sanctuary-bridge">
    <TimberAssembly pieces={boards} color="#685441" surface="wet-wood" />
    <TimberAssembly pieces={supports} color="#3c332a" surface="wet-wood" />
    <Beam from={[-2.1, .1, -8]} to={[-2.1, .75, 7.4]} radius={.1} color="#302b27" surface="wet-wood" />
    <Beam from={[2.1, .1, -8]} to={[2.1, .75, 7.4]} radius={.1} color="#302b27" surface="wet-wood" />
  </group>;
}

function SanctuaryMoon({
  qualityProfile,
  reducedEffects,
  reducedMotion,
}: Pick<ChapterSceneProps, "qualityProfile" | "reducedEffects" | "reducedMotion">) {
  return (
    <group name="blue-moon-sanctuary-moon" position={[6, 18, 38]} userData={{ worldAnchored: true }}>
      <MoonDisc
        position={[0, 0, 0]}
        radius={2.8}
        color="#dceaf4"
        intensity={1.5}
        qualityProfile={qualityProfile}
        reducedEffects={reducedEffects}
        reducedMotion={reducedMotion}
      />
    </group>
  );
}

function SanctuarySwan({ position = [0, 0, 0] as [number, number, number] }) {
  return (
    <group name="blue-moon-guiding-swan" position={position}>
      <group rotation={[0, Math.PI / 2, 0]}><SwanModel /></group>
    </group>
  );
}

function BlueMoonSanctuaryChapterComponent({
  scene,
  qualityProfile,
  reducedEffects,
  reducedMotion,
}: ChapterSceneProps) {
  const isIntimacy = scene.id === "blue-moon.intimacy";
  const isCagedBird = scene.id === "blue-moon.caged-bird";
  const eventDriven = useJourneyStore((journey) => journey.worldFlags["story-events.started"] === true);
  const candlesLit = useJourneyStore((journey) => journey.worldFlags["blue-moon.candles-lit"] === true);
  const waterTouched = useJourneyStore((journey) => journey.worldFlags["blue-moon.water-touched"] === true);
  const swanFollowed = useJourneyStore((journey) => journey.worldFlags["blue-moon.swan-followed"] === true);
  const flowersPlaced = useJourneyStore((journey) => journey.worldFlags["blue-moon.flowers-placed"] === true);
  const beautifulDoorOpen = useJourneyStore((journey) => journey.worldFlags["blue-moon.beautiful-door-open"] === true);
  const lilyCount = reducedEffects ? 6 : 10 + qualityProfile.decorationsPerCell * 3;

  return (
    <group>
      <SceneGround radius={21} color="#15202a" />
      <SanctuaryWater reducedMotion={reducedMotion} reducedEffects={reducedEffects} />
      <ForestDepth quality={qualityProfile.quality} reducedEffects={reducedEffects} />
      <SanctuaryMoon
        qualityProfile={qualityProfile}
        reducedEffects={reducedEffects}
        reducedMotion={reducedMotion}
      />

      <WornSanctuaryBridge />
      <BotanicalBatch kind="lily" seed={23} color="#d5c8cf" placements={LILIES.slice(0, lilyCount).map((lily, index) => ({ position: [lily.x, .1, lily.z], scale: lily.scale * 1.4, rotation: [0, index * .7, 0] }))} />

      {!eventDriven ? <group name="blue-moon-candle-path" position={[-4.2, 0, -2]}>
        {candlesLit ? (
          <CandleField qualityProfile={qualityProfile} reducedEffects={reducedEffects} count={22} radius={8.2} color="#ffd49a" />
        ) : (
          [-0.8, -0.25, 0.3, 0.82].map((x) => (
            <mesh key={x} position={[x, 0.18, 0]}>
              <cylinderGeometry args={[0.055, 0.065, 0.36, 8]} />
              <meshStandardMaterial color="#918c82" roughness={0.9} />
            </mesh>
          ))
        )}
      </group> : null}
      {waterTouched ? (
        <group name="candle-that-died-without-wind" position={[2.8, 0, -2.4]}>
          <mesh position={[0, 0.18, 0]}>
            <cylinderGeometry args={[0.055, 0.065, 0.36, 8]} />
            <meshStandardMaterial color="#b7afa0" roughness={0.9} />
          </mesh>
          <mesh position={[0, 0.4, 0]}>
            <sphereGeometry args={[0.035, 7, 5]} />
            <meshStandardMaterial color="#151718" roughness={1} />
          </mesh>
        </group>
      ) : null}
      <FabricVeil position={[-5.8, 3.6, 2]} rotation={[0, 0.18, 0]} color="#dce2e3" reducedMotion={reducedMotion} />
      <FabricVeil position={[5.6, 3.2, 1]} rotation={[0, -0.22, 0]} color="#d7dde0" reducedMotion={reducedMotion} phase={2.1} />

      {isIntimacy ? (
        <group>
          {!eventDriven ? <SanctuarySwan position={[-4.2, 0.15, 3.2]} /> : null}
          <group name="blue-moon-flower-table" position={[3.6, 0, 4.8]}>
            <TimberAssembly color="#655644" pieces={[
              { position: [0, 1.02, 0], size: [1.44, .16, 1.25] },
              { position: [0, .48, 0], size: [.2, .94, .2] },
              { position: [0, .09, 0], size: [1.25, .12, .16] },
              { position: [0, .09, 0], size: [.16, .12, 1.12] },
            ]} />
            {flowersPlaced ? <BotanicalBatch kind="rose" seed={7} color="#c9959d" placements={[-.32, 0, .3].map((x, index) => ({ position: [x, 1.1, 0], rotation: [0, index, .3], scale: .58 }))} /> : null}
          </group>
          <DoorFrame position={[0, 0.15, 5.8]} width={3.1} height={4.8} depth={0.46} color="#716257" open={beautifulDoorOpen} />
          <ObservedSanctuaryReflection delayed={waterTouched} reducedMotion={reducedMotion} />
          <group position={[0, 0.15, 5.8]}>
          <Beam from={[-3.8, 0, 0]} to={[-3.8, 4.8, 0]} radius={0.16} color="#4b4035" />
          <Beam from={[3.8, 0, 0]} to={[3.8, 4.8, 0]} radius={0.16} color="#4b4035" />
          <Beam from={[-3.8, 4.8, 0]} to={[3.8, 4.8, 0]} radius={0.18} color="#4b4035" />
          <FabricVeil position={[0, 2.5, 0.05]} size={[6.8, 4.4]} color="#d9d8d2" opacity={0.58} reducedMotion={reducedMotion} />
          </group>
        </group>
      ) : null}

      {isCagedBird ? (
        <>
          <DoorFrame position={[0, 0.1, -5.8]} width={2.8} height={4.3} depth={0.4} color="#51483f" open={false} />
          <group name="bridge-that-loops" position={[5.2, 0.08, -2.2]} rotation={[0, 1.08, 0]}>
            <StonePath color="#667078" count={8} length={8.8} fork={0.62} />
          </group>
        </>
      ) : null}

      {isCagedBird && !eventDriven ? (
        <group name="blue-moon-caged-swan" position={[0, 1.7, 4.8]}>
          {[0, 0.42, 0.84, 1.26, 1.68, 2.1, 2.52].map((rotation) => (
            <mesh key={rotation} rotation={[Math.PI / 2, rotation, 0]}>
              <torusGeometry args={[1.45, 0.035, 5, 24, Math.PI]} />
              <meshStandardMaterial color="#6f6b61" metalness={0.6} roughness={0.38} />
            </mesh>
          ))}
          <group position={[0, -.65, 0]} scale={.65}><SwanModel /></group>
        </group>
      ) : null}

      {isIntimacy && swanFollowed ? (
        <mesh name="swan-path-lingers" position={[-2.4, 0.035, 4.2]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[4.8, 0.32]} />
          <meshBasicMaterial color="#d9e9f2" transparent opacity={0.2} depthWrite={false} toneMapped={false} />
        </mesh>
      ) : null}

      <FloatingMotes
        qualityProfile={qualityProfile}
        reducedEffects={reducedEffects}
        reducedMotion={reducedMotion}
        color="#c8ddeb"
        radius={11}
        height={7}
      />
      <ChapterLightRig family="blue-moon" reducedMotion={reducedMotion} />
    </group>
  );
}

export const BlueMoonSanctuaryChapter = memo(BlueMoonSanctuaryChapterComponent);
export default BlueMoonSanctuaryChapter;
