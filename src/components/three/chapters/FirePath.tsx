import { useSceneLook } from "../artDirection/SceneLookContext";
import { AuthoredNpcSilhouette } from "../environmentArt/AuthoredNpc";
import { memo, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import type { RenderQualityProfile } from "../renderQuality";
import {
  Beam,
  CandleField,
  FlickerLight,
  StonePath,
  qualityStep,
} from "./ChapterPrimitives";

const FIRE_RECOVERY_SHOOTS = [
  [-1.48, 0.36, 2.85, -0.16],
  [-0.72, 0.42, 4.2, 0.18],
  [0.12, 0.34, 2.5, -0.08],
  [0.78, 0.46, 3.72, 0.22],
  [1.52, 0.38, 4.48, -0.2],
] as const;

type FirePathProps = {
  actorsEnabled?: boolean;
  qualityProfile: RenderQualityProfile;
  reducedEffects: boolean;
  reducedMotion: boolean;
  active: boolean;
  resolved: boolean;
  surrendered: boolean;
};

function EmberAndAsh({
  qualityProfile,
  reducedEffects,
  reducedMotion,
  active,
  resolved,
}: Pick<FirePathProps, "qualityProfile" | "reducedEffects" | "reducedMotion" | "active" | "resolved">) {
  const presentation = useSceneLook();
  const emberRef = useRef<THREE.Points>(null);
  const ashRef = useRef<THREE.Points>(null);
  const count = reducedEffects ? 8 : 16 + qualityStep(qualityProfile) * 10;
  const emberCount = active ? count : Math.max(6, Math.floor(count * 0.38));

  const emberPositions = useMemo(() => {
    const positions = new Float32Array(emberCount * 3);
    for (let index = 0; index < emberCount; index += 1) {
      const angle = index * 2.399963;
      const radius = 0.35 + ((index * 31) % 100) / 100 * 2.45;
      positions[index * 3] = Math.cos(angle) * radius;
      positions[index * 3 + 1] = 0.4 + ((index * 47) % 100) / 100 * 4.2;
      positions[index * 3 + 2] = Math.sin(angle) * radius;
    }
    return positions;
  }, [emberCount]);

  const ashPositions = useMemo(() => {
    const positions = new Float32Array(count * 3);
    for (let index = 0; index < count; index += 1) {
      const angle = index * 1.618 + 0.6;
      const radius = 1.1 + ((index * 19) % 100) / 100 * 4.6;
      positions[index * 3] = Math.cos(angle) * radius;
      positions[index * 3 + 1] = 0.25 + ((index * 61) % 100) / 100 * 3.8;
      positions[index * 3 + 2] = Math.sin(angle) * radius;
    }
    return positions;
  }, [count]);

  useFrame(({ clock }, delta) => {
    const activity = presentation ? Math.min(1, presentation.motion.particles * 4) : 1;
    const time = presentation?.time.particles ?? clock.elapsedTime;
    if (emberRef.current) (emberRef.current.material as THREE.PointsMaterial).opacity = (active ? .65 : .35) * activity;
    if (ashRef.current) (ashRef.current.material as THREE.PointsMaterial).opacity = .24 * activity;
    if (reducedMotion) return;
    if (emberRef.current) {
      emberRef.current.rotation.y += Math.min(delta, 0.05) * activity * (active ? 0.22 : 0.08);
      emberRef.current.position.y = Math.sin(time * 0.8) * 0.08;
    }
    if (ashRef.current) {
      ashRef.current.rotation.y -= Math.min(delta, 0.05) * activity * 0.035;
      ashRef.current.position.y = Math.sin(time * 0.24 + 1.2) * 0.12;
    }
  });

  return (
    <group position={[0, 0, 3.5]}>
      {resolved ? null : (
        <points ref={emberRef}>
          <bufferGeometry>
            <bufferAttribute attach="attributes-position" args={[emberPositions, 3]} />
          </bufferGeometry>
          <pointsMaterial
            color={active ? "#ff873f" : "#b35432"}
            size={active ? 0.105 : 0.07}
            transparent
            opacity={active ? 0.92 : 0.5}
            depthWrite={false}
            toneMapped={false}
          />
        </points>
      )}
      <points ref={ashRef}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[ashPositions, 3]} />
        </bufferGeometry>
        <pointsMaterial color="#6a625d" size={0.075} transparent opacity={0.34} depthWrite={false} />
      </points>
    </group>
  );
}

function CharredThreshold({ active }: { active: boolean }) {
  const branches = [
    [[-3.8, 0, 1.4], [-1.8, 4.4, 3.4]],
    [[3.7, 0, 1.6], [1.7, 4.9, 3.1]],
    [[-2.8, 2.6, 2.4], [2.8, 3.7, 3.3]],
    [[-3.2, 0.1, 5.9], [2.4, 2.7, 4.7]],
  ] as const;

  return (
    <group>
      {branches.map(([from, to], index) => (
        <Beam
          key={index}
          surface="charred-wood"
          from={[...from]}
          to={[...to]}
          radius={0.105 + (index % 2) * 0.035}
          color={active ? "#1b1411" : "#28201c"}
        />
      ))}
    </group>
  );
}

function WolfGuardian({ resting }: { resting: boolean }) {
  return (
    <group
      name="fire-wolf-guardian"
      position={resting ? [-3, 0.2, 4.7] : [-3.2, 0.25, 4.5]}
      rotation={resting ? [0, 0.62, 0.02] : [0, 0.52, 0]}
      scale={resting ? [1, 0.72, 1] : 1}
    >
      <group rotation={[0, Math.PI / 2, 0]} scale={1.35}><AuthoredNpcSilhouette kind="wolf" resting={resting} /></group>
    </group>
  );
}

function FirePathComponent({
  qualityProfile,
  reducedEffects,
  reducedMotion,
  active,
  resolved,
  surrendered,
  actorsEnabled = true,
}: FirePathProps) {
  const intensity = surrendered ? 0.2 : resolved ? 0.28 : active ? 3.2 : 1.45;
  const flameCount = active ? 24 : 14;

  return (
    <group
      name="fire-path"
      position={[-5.8, 0, 0.8]}
      rotation={[0, -0.36, 0]}
      userData={{ storyRoute: "fire", ritual: "burn-what-cannot-continue", active, resolved }}
    >
      <StonePath color={resolved ? "#53514a" : active ? "#5d3a2b" : "#49382f"} count={10} length={17} fork={-0.28} />
      <mesh position={[0, 0.02, 3.5]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <ringGeometry args={[2.6, 3.25, 32]} />
        <meshStandardMaterial color={resolved ? "#45413b" : active ? "#44231a" : "#30241f"} roughness={1} />
      </mesh>
      <mesh position={[0, 0.22, 3.5]} receiveShadow>
        <cylinderGeometry args={[2.55, 2.9, 0.42, 24]} />
        <meshStandardMaterial color="#191513" roughness={1} />
      </mesh>
      <group position={[0, 0.28, 3.5]}>
        {resolved ? null : (
          <CandleField
            qualityProfile={qualityProfile}
            reducedEffects={reducedEffects}
            count={flameCount}
            radius={2.25}
            color={active ? "#ff7436" : "#ba4f2d"}
          />
        )}
      </group>
      <CharredThreshold active={active && !resolved} />
      <EmberAndAsh
        qualityProfile={qualityProfile}
        reducedEffects={reducedEffects}
        reducedMotion={reducedMotion}
        active={active}
        resolved={resolved}
      />
      {resolved ? (
        <group name="fire-path-new-growth" position={[0, 0, 3.5]}>
          {FIRE_RECOVERY_SHOOTS.map(([x, y, z, rotation]) => (
            <mesh key={`${x}:${z}`} position={[x, y, z - 3.5]} rotation={[0, rotation, rotation * 0.75]}>
              <coneGeometry args={[0.09, y * 1.7, 5]} />
              <meshStandardMaterial color="#6b8055" emissive="#31432b" emissiveIntensity={0.06} roughness={0.94} />
            </mesh>
          ))}
        </group>
      ) : null}
      {surrendered || !actorsEnabled ? null : <WolfGuardian resting={resolved} />}
      <FlickerLight
        position={[0, 1.3, 3.4]}
        color={resolved ? "#8d765c" : active ? "#ff6b31" : "#b94f2e"}
        intensity={intensity}
        distance={active ? 22 : 14}
        reducedMotion={reducedMotion}
      />
    </group>
  );
}

export const FirePath = memo(FirePathComponent);
export default FirePath;
