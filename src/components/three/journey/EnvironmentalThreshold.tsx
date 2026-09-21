import { Html } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { CapsuleCollider, RigidBody } from "@react-three/rapier";
import { useMemo, useRef } from "react";
import * as THREE from "three";
import type { Vector3Tuple } from "../../../data/slipper3dTypes";

type ThresholdKind =
  | "wood"
  | "mirror"
  | "thorns"
  | "archive"
  | "fire-river"
  | "crown";

const LOCKED_BRANCH_LENGTH = 3.15;
const LOCKED_BRANCH_RADIUS = 0.065;
const LOCKED_BRANCH_COLLIDER_HALF_HEIGHT = LOCKED_BRANCH_LENGTH / 2 - LOCKED_BRANCH_RADIUS;
const LOCKED_BRANCH_ANGLE = 0.78;
const LOCKED_BRANCH_POSITION: Vector3Tuple = [0, 1.12, 0.24];
const LOCKED_BRANCH_ROTATIONS = [LOCKED_BRANCH_ANGLE, -LOCKED_BRANCH_ANGLE] as const;

export type EnvironmentalThresholdProps = {
  position: Vector3Tuple;
  chapter: string;
  chapterLabel?: string;
  title: string;
  color: string;
  isApproaching: boolean;
  isVisited: boolean;
  locked?: boolean;
  rotationY?: number;
};

function thresholdKind(chapter: string): ThresholdKind {
  if (chapter === "The Mirror Clearing") return "mirror";
  if (chapter === "The Thorned House") return "thorns";
  if (chapter === "The Blue Moon Archive") return "archive";
  if (chapter === "The Fire and River") return "fire-river";
  if (chapter === "The Crowned Return") return "crown";
  return "wood";
}

function WoodThreshold({ color }: { color: string }) {
  return (
    <>
      <mesh position={[-1.18, 1.18, 0]} rotation={[0.08, 0, -0.16]} castShadow>
        <cylinderGeometry args={[0.15, 0.24, 2.65, 7]} />
        <meshStandardMaterial color="#4b392d" roughness={0.95} />
      </mesh>
      <mesh position={[1.18, 1.12, 0]} rotation={[-0.06, 0, 0.19]} castShadow>
        <cylinderGeometry args={[0.14, 0.22, 2.52, 7]} />
        <meshStandardMaterial color="#4d3b2f" roughness={0.95} />
      </mesh>
      <mesh position={[0, 2.22, 0]} rotation={[0, 0, Math.PI / 2 + 0.04]} castShadow>
        <cylinderGeometry args={[0.1, 0.15, 2.28, 7]} />
        <meshStandardMaterial color="#4f3c2e" emissive={color} emissiveIntensity={0.025} roughness={0.94} />
      </mesh>
    </>
  );
}

function MirrorThreshold({ color }: { color: string }) {
  return (
    <>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.035, 0]} receiveShadow>
        <circleGeometry args={[1.38, 40]} />
        <meshStandardMaterial color="#253e48" emissive={color} emissiveIntensity={0.08} metalness={0.4} roughness={0.16} transparent opacity={0.72} />
      </mesh>
      {[-1, 1].map((side) => (
        <mesh key={side} position={[side * 1.28, 0.64, 0.06]} rotation={[0.04, side * 0.12, side * -0.08]} castShadow>
          <boxGeometry args={[0.34, 1.42, 0.3]} />
          <meshStandardMaterial color="#758088" emissive={color} emissiveIntensity={0.035} roughness={0.66} metalness={0.08} />
        </mesh>
      ))}
    </>
  );
}

function ThornThreshold({ color }: { color: string }) {
  return (
    <>
      {[-1, 1].map((side) => (
        <mesh key={side} position={[side * 1.15, 1.05, 0]} rotation={[0, 0, side * -0.08]} castShadow>
          <boxGeometry args={[0.28, 2.32, 0.34]} />
          <meshStandardMaterial color="#44372f" emissive={color} emissiveIntensity={0.025} roughness={0.96} />
        </mesh>
      ))}
      <mesh position={[0, 2.18, 0]} castShadow>
        <boxGeometry args={[2.5, 0.3, 0.36]} />
        <meshStandardMaterial color="#47372e" roughness={0.96} />
      </mesh>
      {[-0.72, -0.18, 0.38, 0.84].map((x, index) => (
        <mesh key={x} position={[x, 1.1 + (index % 2) * 0.18, 0.2]} rotation={[0, 0, index % 2 ? 0.52 : -0.46]}>
          <cylinderGeometry args={[0.018, 0.035, 2.45, 5]} />
          <meshStandardMaterial color="#624b45" emissive={color} emissiveIntensity={0.035} roughness={0.92} />
        </mesh>
      ))}
    </>
  );
}

function ArchiveThreshold({ color }: { color: string }) {
  return (
    <>
      <mesh position={[0, 1.24, 0]} rotation={[0, 0, Math.PI / 2]}>
        <torusGeometry args={[1.28, 0.055, 6, 36, Math.PI]} />
        <meshStandardMaterial color="#b6c6dc" emissive={color} emissiveIntensity={0.14} roughness={0.42} metalness={0.08} />
      </mesh>
      {[-1, 1].map((side) => (
        <group key={side} position={[side * 1.28, 0.22, 0]}>
          <mesh position={[0, 0.42, 0]}>
            <cylinderGeometry args={[0.055, 0.08, 0.84, 8]} />
            <meshStandardMaterial color="#d7c8ad" roughness={0.8} />
          </mesh>
          <mesh position={[0, 0.9, 0]}>
            <sphereGeometry args={[0.09, 8, 8]} />
            <meshBasicMaterial color="#ffe4aa" />
          </mesh>
        </group>
      ))}
    </>
  );
}

function FireRiverThreshold({ color }: { color: string }) {
  return (
    <>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.025, 0]}>
        <planeGeometry args={[2.7, 1.05, 1, 1]} />
        <meshStandardMaterial color="#31525a" emissive="#315f68" emissiveIntensity={0.09} metalness={0.26} roughness={0.2} transparent opacity={0.66} />
      </mesh>
      {[-1.18, -0.62, 0, 0.62, 1.18].map((x, index) => (
        <mesh key={x} position={[x, 0.14 + (index % 2) * 0.035, 0]} rotation={[0, index * 0.37, 0]} castShadow>
          <dodecahedronGeometry args={[0.22 + (index % 2) * 0.04, 0]} />
          <meshStandardMaterial color="#5b5348" emissive={index === 2 ? color : "#000000"} emissiveIntensity={index === 2 ? 0.12 : 0} roughness={0.92} />
        </mesh>
      ))}
    </>
  );
}

function CrownThreshold({ color }: { color: string }) {
  return (
    <>
      {[-1, 1].map((side) => (
        <mesh key={side} position={[side * 1.35, 1.05, 0]} castShadow>
          <cylinderGeometry args={[0.19, 0.3, 2.2, 6]} />
          <meshStandardMaterial color="#8c8067" emissive={color} emissiveIntensity={0.035} roughness={0.88} />
        </mesh>
      ))}
      <mesh position={[0, 2.2, 0]} rotation={[0, 0, Math.PI / 2]} castShadow>
        <cylinderGeometry args={[0.12, 0.18, 2.72, 6]} />
        <meshStandardMaterial color="#9c8d6e" emissive={color} emissiveIntensity={0.06} roughness={0.84} />
      </mesh>
      {[-0.88, -0.42, 0.38, 0.84].map((x, index) => (
        <mesh key={x} position={[x, 0.42 + (index % 2) * 0.1, 0.28]} rotation={[0, 0, index % 2 ? -0.08 : 0.08]}>
          <coneGeometry args={[0.08, 0.88, 5]} />
          <meshStandardMaterial color="#b59c61" emissive={color} emissiveIntensity={0.025} roughness={0.9} />
        </mesh>
      ))}
    </>
  );
}

function LockedThresholdBarrier() {
  return (
    <group name="locked-threshold-barrier" position={LOCKED_BRANCH_POSITION}>
      {LOCKED_BRANCH_ROTATIONS.map((rotation) => (
        <group key={rotation} rotation={[0, 0, rotation]}>
          <mesh castShadow>
            <cylinderGeometry
              args={[
                LOCKED_BRANCH_RADIUS * 0.42,
                LOCKED_BRANCH_RADIUS,
                LOCKED_BRANCH_LENGTH,
                5,
              ]}
            />
            <meshStandardMaterial color="#4d5940" roughness={0.98} />
          </mesh>
          <RigidBody type="fixed" colliders={false} name="locked-threshold-branch">
            <CapsuleCollider
              args={[LOCKED_BRANCH_COLLIDER_HALF_HEIGHT, LOCKED_BRANCH_RADIUS]}
              friction={1.2}
              restitution={0}
            />
          </RigidBody>
        </group>
      ))}
    </group>
  );
}

export function EnvironmentalThreshold({
  position,
  chapter,
  chapterLabel,
  title,
  color,
  isApproaching,
  isVisited,
  locked = false,
  rotationY,
}: EnvironmentalThresholdProps) {
  const thresholdVisualRef = useRef<THREE.Group>(null);
  const kind = useMemo(() => thresholdKind(chapter), [chapter]);
  const rotation = useMemo(
    () => rotationY ?? Math.sin(position[0] * 0.071 + position[2] * 0.037) * 0.11,
    [position, rotationY],
  );

  useFrame(({ clock }, delta) => {
    if (!thresholdVisualRef.current) return;
    const pulse = isApproaching && !locked ? 1 + Math.sin(clock.elapsedTime * 1.45) * 0.018 : 1;
    const target = locked ? 1 : isVisited ? 0.9 : pulse;
    const scale = THREE.MathUtils.lerp(thresholdVisualRef.current.scale.x, target, 1 - Math.exp(-delta * 4.2));
    thresholdVisualRef.current.scale.setScalar(scale);
  });

  return (
    <group
      position={[position[0], position[1] - 1.2, position[2]]}
      rotation={[0, rotation, 0]}
      userData={{ journeyThreshold: kind, locked }}
    >
      <group ref={thresholdVisualRef}>
        {kind === "wood" ? <WoodThreshold color={color} /> : null}
        {kind === "mirror" ? <MirrorThreshold color={color} /> : null}
        {kind === "thorns" ? <ThornThreshold color={color} /> : null}
        {kind === "archive" ? <ArchiveThreshold color={color} /> : null}
        {kind === "fire-river" ? <FireRiverThreshold color={color} /> : null}
        {kind === "crown" ? <CrownThreshold color={color} /> : null}
      </group>
      {/* The barrier stays outside the animated visual group so Rapier and the
          crossed branches always share the same fixed world transform. */}
      {locked ? <LockedThresholdBarrier /> : null}
      {isApproaching ? (
        <Html center position={[0, 2.78, 0]} distanceFactor={1.7} zIndexRange={[16, 0]}>
          <div className="environmental-threshold-label" aria-hidden="true">
            <span>{(chapterLabel ?? chapter).replace(/^The /, "")}</span>
            <strong>{title}</strong>
            <em>{locked ? "the way is not ready" : "cross the threshold"}</em>
          </div>
        </Html>
      ) : null}
    </group>
  );
}

export default EnvironmentalThreshold;
