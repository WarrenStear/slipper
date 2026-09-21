import { memo } from "react";
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

function Rose({ x, z, index }: { x: number; z: number; index: number }) {
  return (
    <group position={[x, 0.1, z]}>
      <mesh position={[0, 0.32, 0]}>
        <cylinderGeometry args={[0.025, 0.04, 0.65, 5]} />
        <meshStandardMaterial color="#506241" roughness={1} />
      </mesh>
      <mesh position={[0, 0.7, 0]}>
        <sphereGeometry args={[0.18, 8, 6]} />
        <meshStandardMaterial color={index % 2 === 0 ? "#a8656b" : "#d0a3a2"} roughness={0.88} />
      </mesh>
    </group>
  );
}

function LivingWaterFountain({ reducedEffects }: { reducedEffects: boolean }) {
  return (
    <group name="home-living-water-fountain" position={[-3.7, 0.08, 4.9]} userData={{ element: "water" }}>
      <mesh position={[0, 0.28, 0]} receiveShadow>
        <cylinderGeometry args={[1.5, 1.68, 0.45, 24]} />
        <meshStandardMaterial color="#706756" roughness={0.78} metalness={0.12} />
      </mesh>
      <WaterSurface position={[0, 0.52, 0]} size={[2.62, 2.62]} circle color="#466d79" opacity={0.92} />
      <mesh position={[0, 0.84, 0]}>
        <cylinderGeometry args={[0.22, 0.34, 0.68, 14]} />
        <meshStandardMaterial color="#726957" roughness={0.75} />
      </mesh>
      <mesh position={[0, 1.2, 0]}>
        <sphereGeometry args={[0.18, 12, 8]} />
        <meshBasicMaterial color="#9fc7d0" transparent opacity={0.72} toneMapped={false} />
      </mesh>
      {reducedEffects ? null : <pointLight position={[0, 1.1, 0]} color="#9bc1c7" intensity={0.44} distance={5} />}
    </group>
  );
}

function BooksReadingAndWriting({ reducedEffects }: { reducedEffects: boolean }) {
  const books = reducedEffects ? 6 : 11;
  return (
    <group name="home-books-reading-writing" position={[4.45, 0.08, 7.1]} userData={{ practices: ["reading", "writing"] }}>
      <mesh position={[0, 2.08, 0.72]}>
        <boxGeometry args={[2.6, 4.16, 0.42]} />
        <meshStandardMaterial color="#493b31" roughness={0.96} />
      </mesh>
      {[0.82, 1.78, 2.74, 3.7].map((y) => (
        <mesh key={y} position={[0, y, 0.4]}>
          <boxGeometry args={[2.55, 0.12, 0.74]} />
          <meshStandardMaterial color="#62503e" roughness={0.94} />
        </mesh>
      ))}
      {Array.from({ length: books }, (_, index) => (
        <mesh key={index} position={[-0.98 + (index % 4) * 0.51, 1.15 + Math.floor(index / 4) * 0.96, 0.03]} rotation={[0, 0, (index % 3 - 1) * 0.05]}>
          <boxGeometry args={[0.34, 0.62 + (index % 2) * 0.12, 0.46]} />
          <meshStandardMaterial color={index % 3 === 0 ? "#78594e" : index % 3 === 1 ? "#536260" : "#8a744f"} roughness={0.9} />
        </mesh>
      ))}
      <group name="home-writing-desk" position={[-0.55, 0.78, -1.3]}>
        <mesh>
          <boxGeometry args={[2.8, 0.18, 1.34]} />
          <meshStandardMaterial color="#5f4938" roughness={0.92} />
        </mesh>
        {[-1.08, 1.08].map((x) => (
          <Beam key={x} from={[x, -0.68, -0.42]} to={[x, 0, -0.42]} radius={0.09} color="#49372c" />
        ))}
        <mesh position={[-0.24, 0.13, -0.03]} rotation={[-Math.PI / 2, 0, -0.1]}>
          <planeGeometry args={[1.28, 0.82]} />
          <meshStandardMaterial color="#d4ccba" roughness={0.95} side={2} />
        </mesh>
        <Beam from={[0.38, 0.22, 0.05]} to={[0.82, 0.84, 0.08]} radius={0.025} color="#51433a" />
      </group>
    </group>
  );
}

function VelvetReadingNook({ reducedMotion }: { reducedMotion: boolean }) {
  return (
    <group name="home-velvet-reading-nook" position={[-4.4, 0.08, 8.2]} userData={{ fabric: "velvet" }}>
      <mesh position={[0, 0.48, 0]} scale={[1.45, 0.58, 1.1]}>
        <sphereGeometry args={[0.8, 16, 10]} />
        <meshStandardMaterial color="#6e3948" roughness={0.88} />
      </mesh>
      <mesh position={[0, 1.22, 0.52]} scale={[1.38, 1.18, 0.4]}>
        <sphereGeometry args={[0.76, 16, 10]} />
        <meshStandardMaterial color="#633443" roughness={0.9} />
      </mesh>
      <FabricVeil position={[-1.18, 2.32, 0.55]} size={[1.55, 3.45]} color="#7b4151" opacity={0.68} reducedMotion={reducedMotion} phase={0.7} />
      <mesh position={[1.18, 0.34, -0.48]} rotation={[-Math.PI / 2, 0, 0.22]}>
        <planeGeometry args={[1.05, 0.72]} />
        <meshStandardMaterial color="#d0c4aa" roughness={0.96} side={2} />
      </mesh>
    </group>
  );
}

function ProtectedChildSpace({ reducedMotion }: { reducedMotion: boolean }) {
  return (
    <group name="home-protected-child-space" position={[0.6, 0.08, 8.55]} userData={{ protected: true }}>
      <mesh position={[0, 0.4, 0]} scale={[1.55, 0.42, 1.04]}>
        <sphereGeometry args={[0.72, 16, 9]} />
        <meshStandardMaterial color="#a97f72" roughness={0.98} />
      </mesh>
      <mesh position={[0, 0.73, 0]} scale={[1.24, 0.18, 0.78]}>
        <sphereGeometry args={[0.72, 14, 8]} />
        <meshStandardMaterial color="#cfb8a1" roughness={1} />
      </mesh>
      <Beam from={[-1.18, 0, 0]} to={[-0.82, 2.85, 0]} radius={0.09} color="#5e4e40" />
      <Beam from={[1.18, 0, 0]} to={[0.82, 2.85, 0]} radius={0.09} color="#5e4e40" />
      <Beam from={[-0.82, 2.85, 0]} to={[0.82, 2.85, 0]} radius={0.075} color="#5e4e40" />
      <FabricVeil position={[0, 2.04, 0.04]} size={[2.05, 1.55]} color="#d2c0a1" opacity={0.54} reducedMotion={reducedMotion} phase={1.9} />
    </group>
  );
}

function IntentionallyUnusedSpace() {
  return (
    <group name="home-intentionally-unused-space" position={[3.75, 0.11, 3.45]} userData={{ intentionallyEmpty: true, reservedFor: "what-may-come", furnished: false }}>
      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[1.62, 1.69, 48]} />
        <meshBasicMaterial color="#ddc58b" transparent opacity={0.34} toneMapped={false} />
      </mesh>
      <mesh position={[0, 0.012, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[1.58, 48]} />
        <meshStandardMaterial color="#756b55" emissive="#816d42" emissiveIntensity={0.08} roughness={0.98} />
      </mesh>
      <pointLight position={[0, 2.4, 0]} color="#f7daa2" intensity={0.4} distance={5.5} />
    </group>
  );
}

function KylieProtectiveShell() {
  return (
    <group name="home-open-front-architecture" userData={{ openFront: true, enclosure: "protective-not-confining" }}>
      <mesh position={[0, 3.1, 10.9]} castShadow receiveShadow>
        <boxGeometry args={[14, 6.2, 0.34]} />
        <meshStandardMaterial color="#81735d" roughness={0.96} />
      </mesh>
      {[-7, 7].map((x) => (
        <mesh key={x} position={[x, 3.1, 6]} castShadow receiveShadow>
          <boxGeometry args={[0.34, 6.2, 10]} />
          <meshStandardMaterial color="#81735d" roughness={0.96} />
        </mesh>
      ))}
      {[-1, 1].map((side) => (
        <mesh key={side} position={[side * 3.15, 7.35, 6]} rotation={[0, 0, side * -0.43]} castShadow>
          <boxGeometry args={[8.3, 0.34, 10.7]} />
          <meshStandardMaterial color="#45433b" roughness={0.97} />
        </mesh>
      ))}
      <mesh position={[0, 0.025, 6]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[13.55, 9.55]} />
        <meshStandardMaterial color="#75684f" roughness={0.98} side={2} />
      </mesh>
    </group>
  );
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
          <mesh key={x} position={[x, 3.25, 10.82]}>
            <planeGeometry args={[2.05, 2.45]} />
            <meshBasicMaterial color="#f4d49c" transparent opacity={0.68} toneMapped={false} />
          </mesh>
        ))}
        <pointLight position={[0, 5.2, 4.6]} color="#ffe0a8" intensity={reducedEffects ? 0.62 : 1.04} distance={15} />
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
        {ROSES.slice(0, roseCount).map((rose, index) => <Rose key={index} x={rose.x} z={rose.z} index={index} />)}
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
      <directionalLight position={[-9, 13, -8]} color="#ffe1a9" intensity={reducedEffects ? 0.62 : 1.08} />
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
