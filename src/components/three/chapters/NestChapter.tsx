import { LegacyChapterLight } from "../artDirection/LegacyChapterLight";
import { memo, useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import {
  Beam,
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

function SupportingHand({ side }: { side: -1 | 1 }) {
  const accent = side < 0 ? "#d6aa87" : "#c69475";
  return (
    <group position={[side * 3.35, 1.05, 2.45]} rotation={[0, 0, side * -0.2]} scale={[side, 1, 1]}>
      <mesh rotation={[0, 0, -0.54]} castShadow>
        <capsuleGeometry args={[0.26, 1.25, 6, 10]} />
        <meshStandardMaterial color={accent} roughness={0.88} />
      </mesh>
      <mesh position={[-0.74, 0.52, 0]} scale={[1.25, 0.68, 0.55]} castShadow>
        <sphereGeometry args={[0.55, 14, 10]} />
        <meshStandardMaterial color={accent} roughness={0.9} />
      </mesh>
      {[0, 1, 2, 3].map((finger) => (
        <mesh key={finger} position={[-1.14 - finger * 0.11, 0.78 - finger * 0.12, -0.24 + finger * 0.16]} rotation={[0, 0, -0.7]}>
          <capsuleGeometry args={[0.07, 0.52 - finger * 0.035, 4, 7]} />
          <meshStandardMaterial color={accent} roughness={0.9} />
        </mesh>
      ))}
    </group>
  );
}

function TwoHandRepair({ balanced }: { balanced: boolean }) {
  return (
    <group position={[0, balanced ? 0.12 : 0, 0]}>
      <SupportingHand side={-1} />
      <SupportingHand side={1} />
      <Beam from={[-2.25, 0.55, 2.3]} to={[-0.28, 0.94, 2.52]} radius={0.085} color="#a8784b" />
      <Beam from={[2.25, 0.55, 2.3]} to={[0.28, 0.94, 2.52]} radius={0.085} color="#a8784b" />
      <mesh position={[0, 0.98, 2.5]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.39, 0.055, 8, 20]} />
        <meshStandardMaterial
          color={balanced ? "#f0ca7e" : "#d1a45f"}
          emissive={balanced ? "#b5742c" : "#7a4a1e"}
          emissiveIntensity={balanced ? 0.72 : 0.32}
          roughness={0.5}
        />
      </mesh>
    </group>
  );
}

/** Familiar laundry and furniture occupy the edges; nothing hangs over the linen. */
function UnsupportedWeight({ pressure, reducedEffects }: { pressure: number; reducedEffects: boolean }) {
  const forms = useMemo(() => nestDomesticLayout(pressure, reducedEffects), [pressure, reducedEffects]);
  const layers = 1 + Math.floor(pressure * (reducedEffects ? 2 : 3));
  const sideX = 3.82 - pressure * .85;
  return <group name="nest-occupied-domestic-edges" userData={{ pressure }}>
    <TimberAssembly pieces={forms.timber} color="#715940" />
    <TimberAssembly pieces={forms.linen} color="#bcaa8d" surface="linen" />
    {[-1, 1].map(side => <RestingThrow key={side}
      position={[side * sideX, .99 + (layers - 1) * .16, side < 0 ? -.7 : .05]}
      size={[1.08, 1.05]} maxDrop={.42} color={side < 0 ? "#c1ad94" : "#b7a18a"} />)}
  </group>;
}

function ProtectionShelter({ detail }: { detail: number }) {
  const ribCount = 5 + detail;
  return (
    <group position={[0, 0, 2.5]}>
      {Array.from({ length: ribCount }, (_, index) => {
        const progress = ribCount <= 1 ? 0.5 : index / (ribCount - 1);
        const angle = -Math.PI * 0.72 + progress * Math.PI * 1.44;
        const foot: [number, number, number] = [Math.cos(angle) * 3.05, 0.05, Math.sin(angle) * 2.15];
        return <Beam key={index} from={foot} to={[0, 4.25, 0]} radius={0.09} color="#8d704c" />;
      })}
      <mesh position={[0, 4.3, 0]}>
        <sphereGeometry args={[0.22, 10, 8]} />
        <meshStandardMaterial color="#d3ae67" emissive="#845323" emissiveIntensity={0.5} roughness={0.48} />
      </mesh>
      <mesh position={[0, 0.12, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[2.8, 3.2, 32]} />
        <meshStandardMaterial color="#c28e4f" emissive="#6d3a19" emissiveIntensity={0.42} roughness={0.72} />
      </mesh>
    </group>
  );
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
