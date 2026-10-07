import { useSceneLook } from "../artDirection/SceneLookContext";
import { AuthoredNpcSilhouette } from "../environmentArt/AuthoredNpc";
import { memo, useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { createFlameGeometry } from "../environmentArt/authoredGeometry";
import { TactileMaterial } from "../storyEvents/TactileMaterial";
import { TimberAssembly } from "./ChapterArt";
import type { ConstructionPiece } from "./chapterArtGeometry";
import { FIRE_SOURCE_LOCAL_POSITION, firePathPlacement } from "./firePathLayout";
import type { RenderQualityProfile } from "../renderQuality";
import {
  Beam,
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

  useFrame(({ clock }) => {
    const activity = presentation ? Math.min(1, presentation.motion.particles * 4) : 1;
    const time = presentation?.time.particles ?? clock.elapsedTime;
    if (emberRef.current) (emberRef.current.material as THREE.PointsMaterial).opacity = (active ? .65 : .35) * activity;
    if (ashRef.current) (ashRef.current.material as THREE.PointsMaterial).opacity = .24 * activity;
    if (reducedMotion) return;
    if (emberRef.current) {
      emberRef.current.rotation.y = time * (active ? 0.22 : 0.08);
      emberRef.current.position.y = Math.sin(time * 0.8) * 0.08;
    }
    if (ashRef.current) {
      ashRef.current.rotation.y = -time * 0.035;
      ashRef.current.position.y = Math.sin(time * 0.24 + 1.2) * 0.12;
    }
  });

  return (
    <group position={FIRE_SOURCE_LOCAL_POSITION}>
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

/** One concentrated fire reads against quiet ash, with no candle-ring proxy. */
function BoundaryFire({ resolved, reducedMotion, active }: { resolved: boolean; reducedMotion: boolean; active: boolean }) {
  const presentation = useSceneLook();
  const tongues = useRef<THREE.InstancedMesh>(null);
  const transform = useMemo(() => new THREE.Object3D(), []);
  const geometry = useMemo(() => {
    const flame = createFlameGeometry(1, 1), p = flame.getAttribute("position");
    const colors = new Float32Array(p.count * 3), color = new THREE.Color();
    const base = new THREE.Color("#ffe1a2"), tip = new THREE.Color("#d65b24");
    for (let i = 0; i < p.count; i++) {
      color.copy(base).lerp(tip, Math.min(1, Math.max(0, p.getY(i) + .5))).multiplyScalar(1.5);
      color.toArray(colors, i * 3);
    }
    flame.setAttribute("color", new THREE.BufferAttribute(colors, 3)); return flame;
  }, []);
  const ash = useMemo(() => {
    const ground = new THREE.CircleGeometry(3, 40), p = ground.getAttribute("position");
    for (let i = 1; i < p.count; i++) {
      const angle = Math.atan2(p.getY(i), p.getX(i));
      const radius = .92 + Math.sin(angle * 5) * .07 + Math.cos(angle * 9) * .025;
      p.setXYZ(i, p.getX(i) * radius, p.getY(i) * radius * .79, 0);
    }
    ground.computeVertexNormals(); return ground;
  }, []);
  const logs = useMemo<ConstructionPiece[]>(() => Array.from({ length: 7 }, (_, i) => ({
    position: [Math.sin(i * 2.7) * .55, .1 + i % 2 * .12, Math.cos(i * 2.7) * .4],
    size: [1.7 + i % 3 * .25, .2, .23], rotation: [0, i * .82, Math.sin(i * 3) * .075],
  })), []);
  useEffect(() => () => { geometry.dispose(); ash.dispose(); }, [geometry, ash]);
  useFrame(() => {
    if (!tongues.current) return;
    const time = reducedMotion ? 0 : presentation?.time.flame ?? 0;
    for (let i = 0; i < 7; i++) {
      const height = (active ? 1 : .46) * (1.3 + i % 3 * .32) * (1 + Math.sin(time * (5.1 + i * .43) + i) * .08);
      transform.position.set(Math.sin(i * 2.4) * .55, .22 + height * .5, Math.cos(i * 2.4) * .42);
      transform.scale.set(.24 + i % 3 * .055, height, .22 + i % 2 * .035);
      transform.rotation.set(Math.sin(time * 2 + i) * .035, i * .9, Math.cos(time * 2.7 + i) * .04);
      transform.updateMatrix(); tongues.current.setMatrixAt(i, transform.matrix);
    }
    tongues.current.instanceMatrix.needsUpdate = true;
  });
  return <group name="contained-ash-and-timber-fire" position={FIRE_SOURCE_LOCAL_POSITION}>
    <mesh geometry={ash} position={[0, .014, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow><TactileMaterial surface="ash" color="#3e3b32" roughness={1} /></mesh>
    <TimberAssembly pieces={logs} color="#302823" surface="charred-wood" />
    {resolved ? null : <instancedMesh ref={tongues} geometry={geometry} args={[undefined, undefined, 7]} frustumCulled={false}><meshBasicMaterial vertexColors color={active ? "#ffffff" : "#665548"} /></instancedMesh>}
  </group>;
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
  const intensity = surrendered ? 0.2 : resolved ? 0.28 : active ? 3.2 : .34;
  const placement = firePathPlacement(active);

  return (
    <group
      name="fire-path"
      position={placement.position}
      rotation={placement.rotation}
      userData={{ storyRoute: "fire", ritual: "burn-what-cannot-continue", active, resolved }}
    >
      {active ? <StonePath color={resolved ? "#53514a" : active ? "#5d3a2b" : "#49382f"} count={10} length={17} fork={-0.28} /> : null}
      <BoundaryFire resolved={resolved} reducedMotion={reducedMotion || !active} active={active} />
      <CharredThreshold active={active && !resolved} />
      {active ? <EmberAndAsh
        qualityProfile={qualityProfile}
        reducedEffects={reducedEffects}
        reducedMotion={reducedMotion}
        active={active}
        resolved={resolved}
      /> : null}
      {resolved ? (
        <group name="fire-path-new-growth" position={FIRE_SOURCE_LOCAL_POSITION}>
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
        reducedMotion={reducedMotion || !active}
      />
    </group>
  );
}

export const FirePath = memo(FirePathComponent);
export default FirePath;
