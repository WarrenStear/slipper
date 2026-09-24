import { HeroAssetSlot } from "../actors/HeroAssetSlot";
import { ClothboundBook } from "../storyEvents/StoryHeroProps";
import { LegacyChapterLight } from "../artDirection/LegacyChapterLight";
import { memo, useEffect, useMemo } from "react";
import { ExtrudeGeometry, Shape } from "three";
import {
  Beam,
  CandleField,
  DoorFrame,
  ReflectivePanel,
  SceneGround,
  StonePath,
  WaterSurface,
} from "./ChapterPrimitives";
import { BotanicalBatch, BotanicalCluster } from "../environmentArt/EnvironmentArt";
import { TimberAssembly, Upholstery, StoneBasin, WindowJoinery, WritingDesk, ShelvedBooks, RestingThrow } from "./ChapterArt";
import { TactileMaterial } from "../storyEvents/TactileMaterial";
import type { ConstructionPiece } from "./chapterArtGeometry";
import type { ChapterSceneProps } from "./types";
import { useJourneyStore } from "../../../stores/useJourneyStore";

const ROSES = Array.from({ length: 8 }, (_, i) => ({
  x: (i < 4 ? -1 : 1) * (6.15 + Math.sin(i * 2.1) * .2),
  z: 2.35 + (i % 4) * .37,
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
    <HeroAssetSlot id="fountain"><StoneBasin position={[0, .28, 0]} radius={1.05} /><TimberAssembly surface="stone" color="#807864" pieces={[{position:[0,.09,0],size:[1.4,.18,1.36]}, {position:[0,.73,.79],size:[.23,.8,.27]}, {position:[0,1.1,.54],size:[.2,.12,.68]}]} /></HeroAssetSlot>
    <WaterSurface position={[0, .52, 0]} size={[1.66, 1.66]} circle color="#304f57" opacity={.92} reducedEffects={reducedEffects} />

  </group>;
}

function BooksReadingAndWriting({ reducedEffects }: { reducedEffects: boolean }) {
  const shelf = useMemo<ConstructionPiece[]>(() => [
    { position: [0, 1.62, .72], size: [2.6, 3.24, .1] },
    ...[.3, 1.18, 2.06, 2.94].map(y => ({ position: [0, y, .4] as [number, number, number], size: [2.55, .12, .74] as [number, number, number] })),
    ...[-1.23, 1.23].map(x => ({ position: [x, 1.6, .3] as [number, number, number], size: [.12, 3.2, .66] as [number, number, number] })),
  ], []);
  return <group name="home-books-reading-writing" position={[4.9, .08, 8.85]} userData={{ practices: ["reading", "writing"] }}>
    <TimberAssembly color="#62503e" pieces={shelf} />
    <ShelvedBooks count={reducedEffects ? 6 : 11} startY={.63} rowHeight={.88} />
    <group name="home-writing-desk" position={[-.55, .78, -1.3]}>
      <WritingDesk />
      <group position={[.7, .13, .2]} rotation={[0, -.12, 0]} scale={.75}><ClothboundBook /></group>
      <mesh position={[-.24, .13, -.03]} rotation={[-Math.PI / 2, 0, -.1]}>
        <planeGeometry args={[.52, .37]} /><TactileMaterial surface="paper" color="#d4ccba" roughness={.95} side={2} />
      </mesh>
      <Beam from={[-.08, .139, -.08]} to={[.17, .141, .08]} radius={.009} color="#51433a" />
    </group>
  </group>;
}

function VelvetReadingNook() {
  return <group name="home-velvet-reading-nook" position={[-4.7, .06, 8.3]} rotation={[0, .16, 0]} userData={{ fabric: "velvet" }}>
    <Upholstery position={[.15,-.02,-.12]} size={[2.8,.025,2.2]} surface="linen" color="#7a7564" />
    <HeroAssetSlot id="reading-chair"><TimberAssembly color="#493d31" pieces={[
      { position: [0, .34, 0], size: [1.25, .16, 1.03] },
      ...[-1, 1].flatMap(x => [-1, 1].map(z => ({ position: [x * .5, .2, z * .4] as [number, number, number], size: [.105, .4, .11] as [number, number, number], rotation: [z * .07, 0, x * -.06] as [number, number, number] }))),
      ...[-1, 1].map(x => ({ position: [x * .58, .64, .06] as [number, number, number], size: [.08, .62, .73] as [number, number, number] })),
      { position: [0, .92, .43], size: [1.12, 1.1, .14], rotation: [.1, 0, 0] },
    ]} />
    <Upholstery position={[0, .51, -.04]} size={[1.1, .24, .93]} color="#705058" />
    <Upholstery position={[0, 1.02, .36]} rotation={[.13, 0, 0]} size={[1.05, .91, .23]} color="#654550" />
    {[-1, 1].map(side => <Upholstery key={side} position={[side * .6, .79, 0]} size={[.2, .2, .98]} color="#694952" />)}
    </HeroAssetSlot>
    <RestingThrow position={[-.27, .64, -.29]} rotation={[0, Math.PI + .11, 0]} size={[.63, 1.1]} color="#a19383" />
    <group position={[1.1, .49, -.13]} scale={.55} rotation={[0, .22, 0]}><ClothboundBook /></group>
    <TimberAssembly name="reading-side-table" color="#73604b" pieces={[
      {position:[1.1,.43,-.13],size:[.58,.07,.61]},
      ...[-1,1].flatMap(x=>[-1,1].map(z=>({position:[1.1+x*.22,.2,-.13+z*.23] as [number,number,number],size:[.05,.4,.05] as [number,number,number]}))),
    ]} />
  </group>;
}

function ProtectedChildSpace() {
  return <group name="home-protected-child-space" position={[1.6, .06, 9.35]} rotation={[0, -.03, 0]} userData={{ protected: true }}>
    <TimberAssembly color="#725d48" pieces={[
      { position: [0, .31, 0], size: [2.02, .13, 1.12] },
      ...[-1, 1].flatMap(x => [
        { position: [x * .96, .45, 0] as [number, number, number], size: [.085, .6, 1.12] as [number, number, number] },
        ...[-1,1].map(z=>({position:[x*.96,.29,z*.52] as [number,number,number],size:[.105,.58,.11] as [number,number,number]})),
      ]),
      {position:[0,.43,.51],size:[1.84,.14,.055]},
    ]} />
    <Upholstery position={[0, .46, 0]} size={[1.84, .18, 1.02]} color="#b5a994" surface="linen" />
    <Upholstery position={[-.56, .59, .08]} rotation={[0, .08, 0]} size={[.55, .17, .68]} color="#d0c8b4" surface="linen" />
    <RestingThrow position={[.3, .57, -.14]} rotation={[0, Math.PI, 0]} size={[1.06, 1.48]} maxDrop={.55} color="#999e88" />
  </group>;
}

function IntentionallyUnusedSpace() {
  return (
    <group name="home-intentionally-unused-space" position={[3.75, 0.11, 3.45]} userData={{ intentionallyEmpty: true, reservedFor: "what-may-come", furnished: false }}>

    </group>
  );
}

function KylieProtectiveShell() {
  const gable = useMemo(() => {
    const outline = new Shape();
    outline.moveTo(-7, 0); outline.lineTo(7, 0); outline.lineTo(0, 2.02); outline.closePath();
    return new ExtrudeGeometry(outline, { depth: .34, bevelEnabled: false, steps: 1 });
  }, []);
  useEffect(() => () => gable.dispose(), [gable]);
  const walls = useMemo<ConstructionPiece[]>(() => [
    // Actual openings around the two windows let sky and grazing light enter.
    { position: [0, .75, 10.9], size: [14, 1.5, .34] },
    { position: [0, 3.7, 10.9], size: [14, .8, .34] },
    { position: [0, 2.4, 10.9], size: [6.35, 1.8, .34] },
    ...[-6.1125, 6.1125].map(x => ({ position: [x, 2.4, 10.9] as [number, number, number], size: [1.775, 1.8, .34] as [number, number, number] })),
    ...[-7, 7].map(x => ({ position: [x, 2.05, 6] as [number, number, number], size: [.34, 4.1, 10] as [number, number, number] })),
  ], []);
  const roof = useMemo<ConstructionPiece[]>(() => [
    ...[-1, 1].map(side => ({ position: [side * 3.6, 5.14, 6] as [number, number, number], rotation: [0, 0, side * -.28] as [number, number, number], size: [7.5, .34, 10.7] as [number, number, number] })),
    { position: [0, 6.18, 6], size: [.18, .18, 10.8] },
  ], []);
  const joinery = useMemo<ConstructionPiece[]>(() => [
    ...[-6.8, 0, 6.8].map(x => ({ position: [x, 2.05, 10.62] as [number, number, number], size: [.17, 4.1, .16] as [number, number, number] })),
    ...[-1, 1].flatMap(side => [2, 6, 10].map(z => ({ position: [side * 3.6, 4.97, z] as [number, number, number], rotation: [0, 0, side * -.28] as [number, number, number], size: [7.4, .22, .19] as [number, number, number] }))),
    { position: [0, .14, 10.63], size: [13.6, .25, .16] },
    { position: [0, 1.45, 10.65], size: [13.6, .07, .09] },
    ...[-6.8, 6.8].map(x => ({ position: [x, .14, 6] as [number, number, number], size: [.16, .25, 9.7] as [number, number, number] })),
  ], []);
  const floor = useMemo<ConstructionPiece[]>(() => Array.from({ length: 18 }, (_, i) => {
    const lengths = i % 2 ? [1.57,3.18,3.18,1.62] : [3.18,3.18,3.19];
    let start = 1.225;
    return lengths.map((length,j) => { const piece: ConstructionPiece = { position: [-6.397+i*.752,-.017,start+length/2],size:[.74,.084,length-.012],color: ["#a59882","#b3a38a","#aa9d86"][(i+j)%3] };start+=length;return piece; });
  }).flat(), []);
  return <group name="home-open-front-architecture" userData={{ openFront: true, enclosure: "protective-not-confining" }}>
    <TimberAssembly pieces={walls} plaster color="#a7987c" />
    <mesh name="home-rear-gable-infill" geometry={gable} position={[0, 4.1, 10.73]} castShadow receiveShadow>
      <TactileMaterial surface="plaster" color="#a7987c" roughness={.97} />
    </mesh>
    <TimberAssembly pieces={roof} color="#45433b" />
    <TimberAssembly pieces={joinery} color="#675543" />
    <TimberAssembly pieces={floor} color="#8a795c" />
  </group>;
}

function KylieInnerHome({ qualityProfile, reducedEffects, arrivalHeading }: Pick<ChapterSceneProps, "qualityProfile" | "reducedEffects" | "reducedMotion"> & { sovereign: boolean; arrivalHeading: number }) {
  const roseCount = reducedEffects ? 4 : ROSES.length;
  return (
    <group
      name="kylie-self-owned-inner-home"
      position={[Math.sin(arrivalHeading) * 3, 0, Math.cos(arrivalHeading) * 3]}
      rotation={[0, arrivalHeading, 0]}
      userData={{ owner: "Kylie", openFront: true, stagedTowardArrival: true }}
    >
      <KylieProtectiveShell />
      <group name="home-high-protective-walls" userData={{ protective: true, height: 4.2 }}>
        <Beam from={[-7.08, 0, 1]} to={[-7.08, 4.2, 1]} radius={0.24} color="#655846" />
        <Beam from={[7.08, 0, 1]} to={[7.08, 4.2, 1]} radius={0.24} color="#655846" />
        <Beam from={[-7.08, 4.2, 1]} to={[7.08, 4.2, 1]} radius={0.2} color="#655846" />
      </group>
      <group name="home-open-light-windows" userData={{ atmosphere: "open-light" }}>
        {[-4.2, 4.2].map((x) => (
          <group key={x} position={[x, 2.4, 10.67]}>
            <mesh rotation={[0, Math.PI, 0]}><planeGeometry args={[2.05, 1.8]} /><meshStandardMaterial color="#c6d1cf" transparent opacity={.09} roughness={.18} depthWrite={false} side={2} /></mesh>
            <WindowJoinery width={2.05} height={1.8} />
          </group>
        ))}
        <LegacyChapterLight><pointLight position={[0, 5.2, 4.6]} color="#ffe0a8" intensity={reducedEffects ? 0.62 : 1.04} distance={15} /></LegacyChapterLight>
      </group>
      <group name="home-reflection-gallery">
        <ReflectivePanel position={[-.8, 2.2, 10.58]} rotation={[0, Math.PI, 0]} size={[2.1, 2.8]} cracked warm />
      </group>
      {/* The sovereign crown is painted only inside the interactive mirror in StoryObjectModel. */}
      <LivingWaterFountain reducedEffects={reducedEffects} />
      <BooksReadingAndWriting reducedEffects={reducedEffects} />
      <VelvetReadingNook />
      <ProtectedChildSpace />
      <IntentionallyUnusedSpace />
      <group name="home-candles-and-roses">
        <CandleField qualityProfile={qualityProfile} reducedEffects={reducedEffects} count={6} radius={6.15} color="#ffd18b" />
        <BotanicalBatch kind="rose" seed={41} placements={ROSES.slice(1, roseCount).map(rose => ({ position: [rose.x, .24, rose.z], scale: .8 }))} color="#c69398" />
        <BotanicalCluster kind="rose" position={[-6.15, .24, 2.35]} scale={.8} seed={41} color="#b49391" />
        <TimberAssembly name="shallow-window-planters" color="#71634d" pieces={[-1,1].flatMap(side => [
          {position:[side*6.15,.13,2.9],size:[.74,.22,1.95]},
          {position:[side*6.15,.26,2.9],size:[.64,.055,1.85],color:"#3c3c2a"},
        ])} />
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
