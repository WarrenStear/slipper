import { HeroAssetSlot } from "../actors/HeroAssetSlot";
import { ClothboundBook } from "../storyEvents/StoryHeroProps";
import { LegacyChapterLight } from "../artDirection/LegacyChapterLight";
import { memo, useMemo } from "react";
import {
  Beam,
  CandleField,
  DoorFrame,
  FabricVeil,
  ReflectivePanel,
  SceneGround,
  StonePath,
  WaterSurface,
} from "./ChapterPrimitives";
import { BotanicalBatch, BotanicalCluster } from "../environmentArt/EnvironmentArt";
import { TimberAssembly, Upholstery, StoneBasin, WindowJoinery, WritingDesk, ShelvedBooks } from "./ChapterArt";
import { TactileMaterial } from "../storyEvents/TactileMaterial";
import type { ConstructionPiece } from "./chapterArtGeometry";
import type { ChapterSceneProps } from "./types";
import { useJourneyStore } from "../../../stores/useJourneyStore";

const ROSES = Array.from({ length: 14 }, (_, index) => ({
  x: (index % 2 === 0 ? -1 : 1) * (2.6 + (index % 4) * 0.82),
  z: 2.4 + Math.floor(index / 2) * 1.08,
}));

function arrivalHeadingForScene(scene: ChapterSceneProps["scene"]) {
  const entryGateway = scene.gateways.find((gateway) => gateway.role === "entry" || gateway.role === "origin");
  if (!entryGateway) return Math.PI;
  const worldHeading = Math.atan2(
    entryGateway.position[0] - scene.anchor.position[0],
    entryGateway.position[2] - scene.anchor.position[2],
  );
  const localHeading = worldHeading - scene.anchor.headingRadians;
  return Math.atan2(Math.sin(localHeading), Math.cos(localHeading));
}



function LivingWaterFountain({ reducedEffects }: { reducedEffects: boolean }) {
  return <group name="home-living-water-fountain" position={[-3.7, .08, 4.9]} userData={{ element: "water" }}>
    <HeroAssetSlot id="fountain"><StoneBasin position={[0, .28, 0]} /><StoneBasin position={[0, .89, 0]} radius={.34} height={.68} color="#726957" /></HeroAssetSlot>
    <WaterSurface position={[0, .52, 0]} size={[2.62, 2.62]} circle color="#304f57" opacity={.92} reducedEffects={reducedEffects} />

  </group>;
}

function BooksReadingAndWriting({ reducedEffects }: { reducedEffects: boolean }) {
  const shelf = useMemo<ConstructionPiece[]>(() => [
    { position: [0, 2.08, .72], size: [2.6, 4.16, .42] },
    ...[.82, 1.78, 2.74, 3.7].map(y => ({ position: [0, y, .4] as [number, number, number], size: [2.55, .12, .74] as [number, number, number] })),
    ...[-1.23, 1.23].map(x => ({ position: [x, 2.08, .3] as [number, number, number], size: [.12, 4.16, .66] as [number, number, number] })),
  ], []);
  return <group name="home-books-reading-writing" position={[4.45, .08, 7.1]} userData={{ practices: ["reading", "writing"] }}>
    <TimberAssembly color="#62503e" pieces={shelf} />
    <ShelvedBooks count={reducedEffects ? 6 : 11} />
    <group name="home-writing-desk" position={[-.55, .78, -1.3]}>
      <WritingDesk />
      <group position={[.7, .13, .2]} rotation={[0, -.12, 0]} scale={.75}><ClothboundBook /></group>
      <mesh position={[-.24, .13, -.03]} rotation={[-Math.PI / 2, 0, -.1]}>
        <planeGeometry args={[1.28, .82]} /><TactileMaterial surface="paper" color="#d4ccba" roughness={.95} side={2} />
      </mesh>
      <Beam from={[.38, .22, .05]} to={[.82, .84, .08]} radius={.025} color="#51433a" />
    </group>
  </group>;
}

function VelvetReadingNook({ reducedMotion }: { reducedMotion: boolean }) {
  return <group name="home-velvet-reading-nook" position={[-4.4, .08, 8.2]} userData={{ fabric: "velvet" }}>
    <HeroAssetSlot id="reading-chair"><TimberAssembly color="#493d31" pieces={[
      { position: [0, .25, 0], size: [2.2, .18, 1.5] },
      ...[-1, 1].flatMap(x => [-1, 1].map(z => ({ position: [x * .92, .14, z * .54] as [number, number, number], size: [.15, .28, .15] as [number, number, number] }))),
    ]} />
    <Upholstery position={[0, .48, 0]} size={[2.25, .38, 1.57]} color="#6e3948" />
    <Upholstery position={[0, 1.22, .52]} rotation={[-.08, 0, 0]} size={[2.05, 1.6, .53]} color="#633443" />
    <Upholstery position={[-1, .85, 0]} size={[.24, .58, 1.45]} color="#673745" />
    <Upholstery position={[1, .85, 0]} size={[.24, .58, 1.45]} color="#673745" />
    </HeroAssetSlot>
    <FabricVeil position={[-.7, 1.15, -.25]} size={[1.05, 1.45]} color="#7b4151" opacity={.68} reducedMotion={reducedMotion} phase={.7} />
    <mesh position={[1.18, .34, -.48]} rotation={[-Math.PI / 2, 0, .22]}>
      <planeGeometry args={[1.05, .72]} /><TactileMaterial surface="paper" color="#d0c4aa" roughness={.96} side={2} />
    </mesh>
  </group>;
}

function ProtectedChildSpace({ reducedMotion }: { reducedMotion: boolean }) {
  return <group name="home-protected-child-space" position={[.6, .08, 8.55]} userData={{ protected: true }}>
    <TimberAssembly color="#725749" pieces={[
      { position: [0, .37, 0], size: [2.1, .23, 1.35] },
      ...[-1, 1].map(x => ({ position: [x * 1.02, .5, 0] as [number, number, number], size: [.1, .58, 1.35] as [number, number, number] })),
    ]} />
    <Upholstery position={[0, .64, 0]} size={[1.98, .2, 1.22]} color="#cfb8a1" surface="linen" />
    <Beam from={[-1.18, 0, 0]} to={[-.82, 2.85, 0]} radius={.09} color="#5e4e40" />
    <Beam from={[1.18, 0, 0]} to={[.82, 2.85, 0]} radius={.09} color="#5e4e40" />
    <Beam from={[-.82, 2.85, 0]} to={[.82, 2.85, 0]} radius={.075} color="#5e4e40" />
    <FabricVeil position={[0, 2.04, .04]} size={[2.05, 1.55]} color="#d2c0a1" opacity={.54} reducedMotion={reducedMotion} phase={1.9} />
  </group>;
}

function IntentionallyUnusedSpace() {
  return (
    <group name="home-intentionally-unused-space" position={[3.75, 0.11, 3.45]} userData={{ intentionallyEmpty: true, reservedFor: "what-may-come", furnished: false }}>

    </group>
  );
}

function KylieProtectiveShell() {
  const walls = useMemo<ConstructionPiece[]>(() => [
    // Actual openings around the two windows let sky and grazing light enter.
    { position: [0, 1.0125, 10.9], size: [14, 2.025, .34] },
    { position: [0, 5.3375, 10.9], size: [14, 1.725, .34] },
    { position: [0, 3.25, 10.9], size: [6.35, 2.45, .34] },
    ...[-6.1125, 6.1125].map(x => ({ position: [x, 3.25, 10.9] as [number, number, number], size: [1.775, 2.45, .34] as [number, number, number] })),
    ...[-7, 7].map(x => ({ position: [x, 3.1, 6] as [number, number, number], size: [.34, 6.2, 10] as [number, number, number] })),
  ], []);
  const roof = useMemo<ConstructionPiece[]>(() => [-1, 1].map(side => ({ position: [side * 3.15, 7.35, 6], rotation: [0, 0, side * -.43], size: [8.3, .34, 10.7] })), []);
  const joinery = useMemo<ConstructionPiece[]>(() => [
    ...[-6.8, 0, 6.8].map(x => ({ position: [x, 3.1, 10.62] as [number, number, number], size: [.22, 6.2, .16] as [number, number, number] })),
    ...[-1, 1].flatMap(side => [2, 6, 10].map(z => ({ position: [side * 3.15, 7.15, z] as [number, number, number], rotation: [0, 0, side * -.43] as [number, number, number], size: [8.2, .22, .19] as [number, number, number] }))),
    { position: [0, .14, 10.63], size: [13.6, .25, .16] },
    { position: [0, 2.02, 10.65], size: [13.6, .07, .09] },
    ...[-6.8, 6.8].map(x => ({ position: [x, .14, 6] as [number, number, number], size: [.16, .25, 9.7] as [number, number, number] })),
  ], []);
  const floor = useMemo<ConstructionPiece[]>(() => Array.from({ length: 18 }, (_, i) => {
    const lengths = i % 2 ? [1.57,3.18,3.18,1.62] : [3.18,3.18,3.19];
    let start = 1.225;
    return lengths.map((length,j) => { const piece: ConstructionPiece = { position: [-6.397+i*.752,-.017,start+length/2],size:[.74,.084,length-.012],color: ["#a59882","#b3a38a","#aa9d86"][(i+j)%3] };start+=length;return piece; });
  }).flat(), []);
  return <group name="home-open-front-architecture" userData={{ openFront: true, enclosure: "protective-not-confining" }}>
    <TimberAssembly pieces={walls} plaster color="#a7987c" />
    <TimberAssembly pieces={roof} color="#45433b" />
    <TimberAssembly pieces={joinery} color="#675543" />
    <TimberAssembly pieces={floor} color="#8a795c" />
  </group>;
}

function KylieInnerHome({ qualityProfile, reducedEffects, reducedMotion, sovereign, arrivalHeading }: Pick<ChapterSceneProps, "qualityProfile" | "reducedEffects" | "reducedMotion"> & { sovereign: boolean; arrivalHeading: number }) {
  const roseCount = reducedEffects ? 5 : qualityProfile.quality === "low" ? 8 : ROSES.length;
  return (
    <group
      name="kylie-self-owned-inner-home"
      position={[Math.sin(arrivalHeading) * 3, 0, Math.cos(arrivalHeading) * 3]}
      rotation={[0, arrivalHeading, 0]}
      userData={{ owner: "Kylie", openFront: true, stagedTowardArrival: true }}
    >
      <KylieProtectiveShell />
      <group name="home-high-protective-walls" userData={{ protective: true, height: 8.2 }}>
        <Beam from={[-7.08, 0, 1]} to={[-7.08, 8.2, 1]} radius={0.24} color="#655846" />
        <Beam from={[7.08, 0, 1]} to={[7.08, 8.2, 1]} radius={0.24} color="#655846" />
        <Beam from={[-7.08, 8.2, 1]} to={[7.08, 8.2, 1]} radius={0.2} color="#655846" />
      </group>
      <group name="home-open-light-windows" userData={{ atmosphere: "open-light" }}>
        {[-4.2, 4.2].map((x) => (
          <group key={x} position={[x, 3.25, 10.67]}>
            <mesh rotation={[0, Math.PI, 0]}><planeGeometry args={[2.05, 2.45]} /><meshStandardMaterial color="#c6d1cf" transparent opacity={.09} roughness={.18} depthWrite={false} side={2} /></mesh>
            <WindowJoinery width={2.05} height={2.45} />
          </group>
        ))}
        <LegacyChapterLight><pointLight position={[0, 5.2, 4.6]} color="#ffe0a8" intensity={reducedEffects ? 0.62 : 1.04} distance={15} /></LegacyChapterLight>
      </group>
      <group name="home-reflection-gallery">
        <ReflectivePanel position={[-1.75, 3.22, 10.66]} rotation={[0, Math.PI, 0]} size={[2.5, 4.6]} warm />
        <ReflectivePanel position={[1.75, 3.22, 10.66]} rotation={[0, Math.PI, 0]} size={[2.5, 4.6]} warm />
        <ReflectivePanel position={[0, 3.36, 10.58]} rotation={[0, Math.PI, 0]} size={[3.5, 5.1]} cracked warm />
      </group>
      {/* The sovereign crown is painted only inside the interactive mirror in StoryObjectModel. */}
      <LivingWaterFountain reducedEffects={reducedEffects} />
      <BooksReadingAndWriting reducedEffects={reducedEffects} />
      <VelvetReadingNook reducedMotion={reducedMotion} />
      <ProtectedChildSpace reducedMotion={reducedMotion} />
      <IntentionallyUnusedSpace />
      <group name="home-candles-and-roses">
        <CandleField qualityProfile={qualityProfile} reducedEffects={reducedEffects} count={12} radius={6.15} color="#ffd18b" />
        <BotanicalBatch kind="rose" seed={41} placements={ROSES.slice(1, roseCount).map(rose => ({ position: [rose.x, .1, rose.z], scale: 1.5 }))} color="#c69398" />
        <BotanicalCluster kind="rose" position={[-2.6, .1, 2.4]} scale={1.5} seed={41} color="#c69398" />
      </group>
    </group>
  );
}

function CrownedReturnChapterComponent({ scene, qualityProfile, reducedEffects, reducedMotion }: ChapterSceneProps) {
  const atThreshold = scene.id === "crowned.threshold";
  const atHome = scene.id === "crowned.home";
  const sovereign = scene.id === "crowned.sovereignty";
  const arrivalHeading = arrivalHeadingForScene(scene);
  const gateRecognisesJourney = useJourneyStore((journey) =>
    journey.inventory.recoveredKeys.includes("key.protection")
      && journey.inventory.recoveredKeys.includes("key.self-permission")
      && journey.inventory.symbolicObjects.includes("memory.chosen-heart")
      && journey.inventory.symbolicObjects.includes("creation.chosen-future")
      && journey.worldFlags["lantern.owned"] === true
      && journey.completedRitualIds.includes("ritual.surrender"),
  );

  return (
    <group>
      <SceneGround radius={24} color="#75694a" />
      <StonePath color="#a49a7f" count={13} length={22} />
      <LegacyChapterLight><directionalLight position={[-9, 13, -8]} color="#ffe1a9" intensity={reducedEffects ? 0.62 : 1.08} /></LegacyChapterLight>
      {atThreshold ? (
        <group
          name="crowned-gate-recognises-accumulated-state"
          position={[Math.sin(arrivalHeading) * 5, 0, Math.cos(arrivalHeading) * 5]}
          rotation={[0, arrivalHeading, 0]}
          userData={{ gateOpen: gateRecognisesJourney, requiredJourneyState: "keys-heart-womb-lantern-surrender", stagedTowardArrival: true }}
        >
          <DoorFrame width={6.4} height={7.2} depth={1.15} color="#6e6453" open={gateRecognisesJourney} />
          <Beam from={[-5, 0, 0]} to={[-5, 6.8, 0]} radius={0.42} color="#6c6557" />
          <Beam from={[5, 0, 0]} to={[5, 6.8, 0]} radius={0.42} color="#6c6557" />
          <Beam from={[-5, 6.8, 0]} to={[5, 6.8, 0]} radius={0.42} color="#6c6557" />
        </group>
      ) : null}
      {atHome || sovereign ? (
        <KylieInnerHome qualityProfile={qualityProfile} reducedEffects={reducedEffects} reducedMotion={reducedMotion} sovereign={sovereign} arrivalHeading={arrivalHeading} />
      ) : null}

    </group>
  );
}

export const CrownedReturnChapter = memo(CrownedReturnChapterComponent);
export default CrownedReturnChapter;
