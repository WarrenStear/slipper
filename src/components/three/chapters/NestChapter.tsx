import { LegacyChapterLight } from "../artDirection/LegacyChapterLight";
import { memo, useLayoutEffect, useRef } from "react";
import { useFrame } from "@react-three/fiber";
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

type NestState = "repairing" | "burdened" | "protected";

const DOMESTIC_OBJECTS = [
  [-2.8, 0.28, 1.1],
  [-2.15, 0.22, 1.5],
  [-1.45, 0.34, 1.12],
  [2.7, 0.2, 1.6],
  [3.25, 0.26, 1.15],
  [2.3, 0.34, 0.92],
] as const;

function WovenNest({
  state,
  detail,
  reducedEffects,
  reducedMotion,
}: {
  state: NestState;
  detail: number;
  reducedEffects: boolean;
  reducedMotion: boolean;
}) {
  const groupRef = useRef<THREE.Group>(null);
  const weaveRef = useRef<THREE.InstancedMesh>(null);
  const strandCount = reducedEffects ? 10 : 14 + detail * 3;

  useLayoutEffect(() => {
    const dummy = new THREE.Object3D();
    const sag = state === "burdened" ? 0.34 : state === "protected" ? 0.04 : 0.16;

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
    if (weaveRef.current) weaveRef.current.instanceMatrix.needsUpdate = true;
  }, [state, strandCount]);

  useFrame(({ clock }) => {
    if (!groupRef.current || reducedMotion) return;
    const time = clock.getElapsedTime();
    const strain = state === "burdened" ? Math.sin(time * 1.65) * 0.035 : Math.sin(time * 0.52) * 0.012;
    groupRef.current.position.y = strain;
    groupRef.current.rotation.z = state === "burdened" ? Math.sin(time * 0.72) * 0.012 : 0;
  });

  return (
    <group ref={groupRef} position={[0, 0, 2.5]}>
      <mesh position={[0, state === "burdened" ? 0.32 : 0.48, 0]} scale={[1, state === "burdened" ? 0.72 : 1, 1]}>
        <sphereGeometry args={[2.28, 24, 10, 0, Math.PI * 2, Math.PI * 0.5, Math.PI * 0.5]} />
        <meshStandardMaterial
          color={state === "protected" ? "#8f7350" : "#71543c"}
          roughness={0.98}
          side={THREE.DoubleSide}
        />
      </mesh>
      <instancedMesh ref={weaveRef} args={[undefined, undefined, strandCount]} castShadow receiveShadow>
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial color={state === "protected" ? "#a28158" : "#806044"} roughness={1} />
      </instancedMesh>
      <mesh position={[0, state === "burdened" ? 0.42 : 0.68, 0]} scale={[1, state === "burdened" ? 0.82 : 1, 1]}>
        <cylinderGeometry args={[1.5, 1.82, 0.42, 20]} />
        <meshStandardMaterial color="#b98a73" roughness={1} />
      </mesh>
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

function UnsupportedWeight({ detail, reducedMotion, released }: { detail: number; reducedMotion: boolean; released: boolean }) {
  const strainRef = useRef<THREE.Group>(null);
  const bundleCount = 3 + detail;

  useFrame(({ clock }) => {
    if (!strainRef.current || reducedMotion) return;
    const time = clock.getElapsedTime();
    strainRef.current.rotation.z = released ? 0 : Math.sin(time * 1.25) * 0.018;
    strainRef.current.position.y = (released ? -0.72 : 0) + (released ? 0 : Math.sin(time * 1.7) * 0.035);
  });

  return (
    <group ref={strainRef} scale={released ? 0.82 : 1}>
      <Beam from={[-4.25, 4.7, 3.1]} to={[-1.82, 0.72, 2.6]} radius={0.045} color="#5b4635" />
      <Beam from={[4.25, 4.7, 3.1]} to={[1.82, 0.72, 2.6]} radius={0.075} color="#9a6d42" />
      <Beam from={[-4.25, 4.7, 3.1]} to={[-3.38, 2.7, 2.82]} radius={0.035} color="#4f3d30" />
      {Array.from({ length: bundleCount }, (_, index) => (
        <group key={index} position={[-1.15 + index * (2.3 / Math.max(1, bundleCount - 1)), 1.2 + (index % 2) * 0.34, 2.5]}>
          <mesh rotation={[0.1, index * 0.48, index % 2 === 0 ? 0.12 : -0.12]} castShadow>
            <dodecahedronGeometry args={[0.48 + (index % 3) * 0.08, 0]} />
            <meshStandardMaterial color={index % 2 === 0 ? "#5d4a3c" : "#7d6248"} roughness={1} />
          </mesh>
          <mesh rotation={[Math.PI / 2, 0, 0]}>
            <torusGeometry args={[0.38, 0.025, 5, 12]} />
            <meshStandardMaterial color="#b28b5d" roughness={0.9} />
          </mesh>
        </group>
      ))}
      {[0, 1, 2].map((layer) => (
        <mesh key={layer} position={[0, 0.35 - layer * 0.11, 2.5]} rotation={[Math.PI / 2, 0, layer * 0.35]}>
          <torusGeometry args={[2.45 + layer * 0.28, 0.035, 6, 30]} />
          <meshStandardMaterial color="#513d30" transparent opacity={0.62 - layer * 0.12} roughness={1} />
        </mesh>
      ))}
    </group>
  );
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
  const detail = qualityStep(qualityProfile);
  const isCycle = state === "burdened";
  const isProtection = state === "protected";
  const twoHandsBalanced = useJourneyStore(
    (journey) => journey.worldFlags["nest.hand-held"] === true && journey.worldFlags["nest.hand-kept"] === true,
  );
  const burdenReleased = useJourneyStore(
    (journey) => journey.worldFlags["nest.unsupported-burden-released"] === true,
  );
  const protectionAcknowledged = useJourneyStore(
    (journey) => journey.worldFlags["nest.protection-acknowledged"] === true,
  );

  return (
    <group>
      <SceneGround radius={16} color={isCycle ? "#3b3129" : isProtection ? "#51422e" : "#493b2d"} />
      <TreeGrove
        qualityProfile={qualityProfile}
        reducedEffects={reducedEffects}
        tint={isProtection ? "#64704b" : "#5a6242"}
        trunk="#493525"
        radius={16}
      />
      <StonePath color={isProtection ? "#aa9168" : "#927c61"} count={9} length={13} />

      <group rotation={[isCycle ? 0.025 : 0, 0, isCycle ? -0.035 : 0]}>
        <HouseShell
          position={[0, 0, 3]}
          size={[9.5, isProtection ? 5 : 4.6, 6.8]}
          wallColor={isCycle ? "#59483b" : isProtection ? "#806747" : "#68533d"}
          roofColor={isProtection ? "#3b3023" : "#332920"}
        />
      </group>

      <WovenNest
        state={state}
        detail={detail}
        reducedEffects={reducedEffects}
        reducedMotion={reducedMotion}
      />
      {state === "repairing" ? <TwoHandRepair balanced={twoHandsBalanced} /> : null}
      {isCycle ? <UnsupportedWeight detail={detail} reducedMotion={reducedMotion} released={burdenReleased} /> : null}
      {isProtection ? <ProtectionShelter detail={reducedEffects ? 0 : detail} /> : null}

      <mesh position={[2.7, 1.25, 3.1]} rotation={[0, 0.03, 0]}>
        <boxGeometry args={[2.2, 1.5, 0.08]} />
        <meshStandardMaterial color={isCycle ? "#9e9382" : "#ddd2b8"} roughness={0.98} />
      </mesh>
      <mesh position={[2.7, 1.25, 3.04]}>
        <planeGeometry args={[1.7, 1.05]} />
        <meshBasicMaterial color={isProtection ? "#d6b36c" : "#c89b6f"} transparent opacity={isCycle ? 0.22 : 0.44} />
      </mesh>

      {DOMESTIC_OBJECTS.slice(0, reducedEffects ? 3 : DOMESTIC_OBJECTS.length).map((position, index) => (
        <mesh
          key={index}
          position={[position[0], isCycle ? position[1] + index * 0.055 : position[1], position[2]]}
          rotation={[isCycle ? 0.08 * (index % 2 === 0 ? -1 : 1) : 0, index * 0.7, isCycle ? 0.1 : 0]}
        >
          <boxGeometry args={[0.45 + (index % 2) * 0.18, 0.45 + (index % 3) * 0.12, 0.45]} />
          <meshStandardMaterial color={index % 2 === 0 ? "#9b7651" : "#755844"} roughness={0.92} />
        </mesh>
      ))}

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
        position={[0, isCycle ? 1.65 : 2.5, 3.5]}
        color={isProtection ? "#ffd38b" : isCycle ? "#d87c4d" : "#ffc784"}
        intensity={isCycle ? 1.25 : isProtection ? 2.55 : 2.1}
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
