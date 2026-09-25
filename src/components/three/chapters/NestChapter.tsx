import { LegacyChapterLight } from "../artDirection/LegacyChapterLight";
import { memo, useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import {
  CandleField,
  FlickerLight,
  HouseShell,
  KeyProp,
  SceneGround,
  StonePath,
  TreeGrove,
  qualityStep,
} from "./ChapterPrimitives";
import type { ChapterSceneProps } from "./types";
import { useJourneyStore } from "../../../stores/useJourneyStore";

import type { ConstructionPiece } from "./chapterArtGeometry";
import { RestingThrow, TimberAssembly } from "./ChapterArt";
import { useSceneLook } from "../artDirection/SceneLookContext";
import { nestDomesticLayout, nestSpatialPressure } from "./domesticSpatialPressure";

type NestState = "repairing" | "burdened" | "protected";

function WovenNest({
  state,
  detail,
  reducedEffects,
}: {
  state: NestState;
  detail: number;
  reducedEffects: boolean;
}) {
  const weaveRef = useRef<THREE.InstancedMesh>(null);
  const strandCount = reducedEffects ? 10 : 14 + detail * 3;

  useLayoutEffect(() => {
    const dummy = new THREE.Object3D();
    const sag = .08; // Responsibility gathers outside; the protected centre never sags.

    for (let index = 0; index < strandCount; index += 1) {
      const angle = (index / strandCount) * Math.PI * 2;
      const alternating = index % 2 === 0 ? 1 : -1;
      const radius = 2.15 + alternating * 0.22;
      dummy.position.set(
        Math.cos(angle) * radius,
        0.68 - sag + Math.sin(angle * 3) * 0.08,
        Math.sin(angle) * radius * 0.65,
      );
      dummy.rotation.set(alternating * 0.08, -angle + alternating * 0.2, alternating * 0.12);
      dummy.scale.set(1.7 + (index % 3) * 0.18, 0.12, 0.12);
      dummy.updateMatrix();
      weaveRef.current?.setMatrixAt(index, dummy.matrix);
    }
    if (weaveRef.current) { weaveRef.current.instanceMatrix.needsUpdate = true; weaveRef.current.computeBoundingBox(); weaveRef.current.computeBoundingSphere(); }
  }, [state, strandCount]);

  return (
    <group name="nest-stable-shelter" position={[0, 0, 2.5]}>
      <mesh position={[0, .48, 0]}>
        <sphereGeometry args={[2.28, 24, 10, 0, Math.PI * 2, Math.PI * 0.5, Math.PI * 0.5]} />
        <meshStandardMaterial
          color="#8f7350"
          roughness={0.98}
          side={THREE.DoubleSide}
        />
      </mesh>
      <instancedMesh ref={weaveRef} args={[undefined, undefined, strandCount]} castShadow receiveShadow>
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial color={state === "protected" ? "#a28158" : "#806044"} roughness={1} />
      </instancedMesh>
      {/* The resting linen occupies the open centre; no solid plinth hides it. */}
    </group>
  );
}

/** Two joined supports take the weight at opposite edges of the same fragile centre. */
function SupportingTrestle({ side, balanced }: { side: -1 | 1; balanced: boolean }) {
  const pieces = useMemo<ConstructionPiece[]>(() => [
    { position: [0, .56, 0], size: [.32, .16, 1.8] },
    ...[-1, 1].map(end => ({ position: [side * .14, .27, end * .64] as [number, number, number], size: [.16, .54, .2] as [number, number, number], rotation: [0, 0, side * -.18] as [number, number, number] })),
    { position: [-side * .38, .63, 0], size: [1.12, .1, 1.24], rotation: [0, 0, side * (balanced ? .025 : .08)] },
    { position: [side * .16, .21, 0], size: [.12, .12, 1.48] },
  ], [side, balanced]);
  return <group name={`nest-shared-support:${side}`} position={[side * 2.65, 0, 2.5]}>
    <TimberAssembly pieces={pieces} color={side < 0 ? "#826447" : "#927251"} />
    <RestingThrow position={[-side * .33, .7, 0]} size={[1.05, 1.8]} maxDrop={.22} color="#c3b298" />
  </group>;
}

function TwoHandRepair({ balanced }: { balanced: boolean }) {
  return <group name="nest-two-supports-one-centre" userData={{ balanced }}>
    <SupportingTrestle side={-1} balanced={balanced} />
    <SupportingTrestle side={1} balanced={balanced} />
  </group>;
}

/** Familiar laundry and furniture occupy the edges; nothing hangs over the linen. */
function UnsupportedWeight({ pressure, reducedEffects }: { pressure: number; reducedEffects: boolean }) {
  const forms = useMemo(() => nestDomesticLayout(pressure, reducedEffects), [pressure, reducedEffects]);
  const { layers, sideX } = forms;
  return <group name="nest-occupied-domestic-edges" userData={{ pressure }}>
    <TimberAssembly pieces={forms.timber} color="#715940" />
    <TimberAssembly pieces={forms.linen} color="#bcaa8d" surface="linen" />
    {[-1, 1].map(side => <RestingThrow key={side}
      position={[side * sideX, .99 + (layers - 1) * .16, side < 0 ? -.7 : .05]}
      size={[1.08, 1.05]} maxDrop={.42} color={side < 0 ? "#c1ad94" : "#b7a18a"} />)}
  </group>;
}

/** A roof with open sides keeps the resting linen safe without marking a zone. */
function ProtectionShelter({ detail }: { detail: number }) {
  const pieces = useMemo<ConstructionPiece[]>(() => [
    ...[-1, 1].flatMap(side => [1.05, 3.95].map(z => ({ position: [side * 2.78, 1.67, z] as [number, number, number], size: [.12, 3.34, .14] as [number, number, number] }))),
    ...[1.05, 3.95].map(z => ({ position: [0, 3.37, z] as [number, number, number], size: [5.7, .14, .16] as [number, number, number] })),
    ...Array.from({ length: 3 + Math.min(detail, 2) }, (_, i) => ({ position: [-2.6 + i * 5.2 / (2 + Math.min(detail, 2)), 3.47, 2.5] as [number, number, number], size: [.08, .1, 3.05] as [number, number, number] })),
  ], [detail]);
  return <group name="nest-open-linen-shelter">
    <TimberAssembly pieces={pieces} color="#917958" />
    <RestingThrow position={[0, 3.55, 2.5]} size={[5.8, 4.9]} maxDrop={.32} color="#c8b99b" />
  </group>;
}

function NestChapterComponent({
  scene,
  qualityProfile,
  reducedEffects,
  reducedMotion,
}: ChapterSceneProps) {
  const state: NestState = scene.id === "nest.unsupported-cycle"
    ? "burdened"
    : scene.id === "nest.protection"
      ? "protected"
      : "repairing";
  const presentation = useSceneLook();
  const detail = qualityStep(qualityProfile);
  const isCycle = state === "burdened";
  const isProtection = state === "protected";
  const twoHandsBalanced = useJourneyStore(
    (journey) => journey.worldFlags["nest.hand-held"] === true && journey.worldFlags["nest.hand-kept"] === true,
  );
  const burdenReleased = useJourneyStore(
    (journey) => journey.worldFlags["nest.unsupported-burden-released"] === true,
  );
  const daysCompressed = useJourneyStore(journey => journey.storyObjectStates["nest.day"] === "compressed" || journey.worldFlags["nest.unsupported-burden-held"] === true);
  const responsibilityResting = useJourneyStore(journey => journey.storyObjectStates["nest.responsibility"] === "placed");
  const pressure = nestSpatialPressure(scene.id, daysCompressed, burdenReleased || responsibilityResting);
  const protectionAcknowledged = useJourneyStore(
    (journey) => journey.worldFlags["nest.protection-acknowledged"] === true,
  );

  return (
    <group>
      <SceneGround radius={16} color="#493b2d" />
      <TreeGrove
        qualityProfile={qualityProfile}
        reducedEffects={reducedEffects}
        tint={isProtection ? "#64704b" : "#5a6242"}
        trunk="#493525"
        radius={16}
      />
      <StonePath color={isProtection ? "#aa9168" : "#927c61"} count={9} length={13} />

      <group name="nest-unwavering-domestic-shelter">
        <HouseShell
          position={[0, 0, 3]}
          size={[9.5, isProtection ? 5 : 4.6, 6.8]}
          wallColor="#806747"
          roofColor={isProtection ? "#3b3023" : "#332920"}
        />
      </group>

      <WovenNest
        state={state}
        detail={detail}
        reducedEffects={reducedEffects}
      />
      {state === "repairing" ? <TwoHandRepair balanced={twoHandsBalanced} /> : null}
      <UnsupportedWeight pressure={pressure} reducedEffects={reducedEffects} />
      {isProtection ? <ProtectionShelter detail={reducedEffects ? 0 : detail} /> : null}

      <mesh position={[2.7, 1.25, 3.1]} rotation={[0, 0.03, 0]}>
        <boxGeometry args={[2.2, 1.5, 0.08]} />
        <meshStandardMaterial color="#ddd2b8" roughness={0.98} />
      </mesh>
      <mesh position={[2.7, 1.25, 3.04]}>
        <planeGeometry args={[1.7, 1.05]} />
        <meshBasicMaterial color={isProtection ? "#d6b36c" : "#c89b6f"} transparent opacity={.44} />
      </mesh>

      {isProtection ? (
        <KeyProp
          position={[0, protectionAcknowledged ? 1.62 : 1.42, 2.3]}
          scale={protectionAcknowledged ? 1.34 : 1.2}
          color={protectionAcknowledged ? "#f1cd72" : "#d6ad5c"}
        />
      ) : null}
      <CandleField
        qualityProfile={qualityProfile}
        reducedEffects={reducedEffects}
        count={isProtection ? 14 : isCycle ? 5 : 9}
        radius={isProtection ? 4.8 : 4.4}
        color={isProtection ? "#ffd28a" : "#ffb56b"}
        y={0.04}
      />
      <FlickerLight
        position={[-1, 2.5, 3.5]}
        color={presentation?.look.lighting.color ?? "#e3d0ac"}
        intensity={2.1}
        distance={isProtection ? 18 : 15}
        reducedMotion={reducedMotion}
      />
      <LegacyChapterLight><directionalLight
        position={[8, 11, -7]}
        color={isCycle ? "#b9aaa0" : "#ffd89f"}
        intensity={reducedEffects ? 0.42 : isProtection ? 1.02 : 0.86}
      /></LegacyChapterLight>
    </group>
  );
}

export const NestChapter = memo(NestChapterComponent);
export default NestChapter;
