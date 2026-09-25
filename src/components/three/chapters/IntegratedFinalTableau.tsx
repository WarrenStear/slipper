import { LegacyChapterLight } from "../artDirection/LegacyChapterLight";
import { AuthoredNpcSilhouette } from "../environmentArt/AuthoredNpc";
import { TimberAssembly, Upholstery, WritingDesk, ShelvedBooks } from "./ChapterArt";
import { TactileMaterial } from "../storyEvents/TactileMaterial";
import { FinalWoodlandDetails } from "../environment/WoodlandDetails";
import { ChapterLightRig } from "../environment/ChapterLightRig";
import { ReverseMemoryLights } from "../storyEvents/ReverseMemoryLights";
import { memoryStarPosition } from "../../../lib/journeyMemoryProjection";
import { memo, useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { JOURNEY_ENTRY_CONTEXT, journeyChapters } from "../../../data/journeyNarrative.ts";
import {
  buildStoryConstellationModel,
  type ConstellationResonanceNode,
  type ConstellationStoryModel,
} from "../../../lib/lanternNarrative.ts";
import { useJourneyStore } from "../../../stores/useJourneyStore";
import type { RenderQualityProfile } from "../renderQuality";
import {
  Beam,
  DoorFrame,
  FlickerLight,
  HouseShell,
  KeyProp,
  LanternProp,
  MoonDisc,
  ReflectivePanel,
  SceneGround,
  StonePath,
  ThornBranches,
  WaterSurface,
  qualityStep,
  type Vec3,
} from "./ChapterPrimitives";

type FinalTableauProps = {
  qualityProfile: RenderQualityProfile;
  reducedEffects: boolean;
  reducedMotion: boolean;
  onFinalConstellationFormationComplete?: () => void;
};

const CANONICAL_ENTRY_IDS = journeyChapters.flatMap((chapter) => chapter.entryIds);
const CANONICAL_ENTRY_ID_SET = new Set<string>(CANONICAL_ENTRY_IDS);
const CONSTELLATION_FORMATION_CENTER: Vec3 = [0, 9.6, -20];
const CONSTELLATION_FORMATION_COMPLETE_THRESHOLD = 0.995;
const CONSTELLATION_MAX_FRAME_DELTA = 0.25;

const FINAL_TREE_POSITIONS: readonly Vec3[] = [
  [-14.5, 0, -15],
  [10.5, 0, -16.5],
  [-16, 0, -21.5],
  [13.5, 0, -22],
  [-12.5, 0, -27],
  [8.5, 0, -27],
  [-18, 0, -28],
  [16.5, 0, -28],
];

function pointsGeometry(points: readonly Vec3[]) {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute(
    "position",
    new THREE.Float32BufferAttribute(points.flatMap((point) => point), 3),
  );
  return geometry;
}

function lineGeometry(points: readonly Vec3[]) {
  const coordinates: number[] = [];
  for (let index = 1; index < points.length; index += 1) {
    coordinates.push(...points[index - 1], ...points[index]);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(coordinates, 3));
  return geometry;
}

function pointsCentroid(points: readonly Vec3[]): Vec3 {
  if (points.length === 0) return [0, 9.5, -20];
  const total = points.reduce(
    (sum, point) => [sum[0] + point[0], sum[1] + point[1], sum[2] + point[2]] as Vec3,
    [0, 0, 0] as Vec3,
  );
  return [total[0] / points.length, total[1] / points.length, total[2] / points.length];
}

const RESONANCE_SKY_OFFSETS = {
  wolf: [-1.8, -0.58, 0.03],
  swan: [0, 1.42, 0.05],
  seer: [1.8, -0.58, 0.03],
} as const satisfies Readonly<Record<ConstellationResonanceNode["id"], Vec3>>;

const RESONANCE_SKY_COLOURS = {
  wolf: "#d48951",
  swan: "#dce9ed",
  seer: "#b99dce",
} as const satisfies Readonly<Record<ConstellationResonanceNode["id"], string>>;

function ConstellationResonanceLights({
  nodes,
  anchor,
  reducedEffects,
}: {
  nodes: readonly ConstellationResonanceNode[];
  anchor: Vec3;
  reducedEffects: boolean;
}) {
  const visibleNodes = nodes.filter((node) => node.visible);
  return (
    <group name="constellation-resonance-major-nodes">
      {visibleNodes.map((node) => {
        const offset = RESONANCE_SKY_OFFSETS[node.id];
        const position: Vec3 = [
          anchor[0] + offset[0],
          anchor[1] + offset[1],
          anchor[2] + offset[2],
        ];
        const color = RESONANCE_SKY_COLOURS[node.id];
        const radius = (reducedEffects ? 0.1 : 0.13) + node.intensity * 0.11;
        return (
          <group
            key={node.id}
            name={`constellation-resonance-${node.id}`}
            position={position}
            userData={{ resonance: node.id, strength: node.strength }}
          >
            <mesh>
              <sphereGeometry args={[radius, reducedEffects ? 8 : 14, reducedEffects ? 6 : 10]} />
              <meshBasicMaterial color={color} toneMapped={false} />
            </mesh>
            <mesh position={[0, 0, -0.01]}>
              <ringGeometry args={[radius * 1.9, radius * 2.15, 28]} />
              <meshBasicMaterial color={color} transparent opacity={0.34 + node.intensity * 0.22} depthWrite={false} toneMapped={false} />
            </mesh>
          </group>
        );
      })}
    </group>
  );
}

function ReleasedWordConstellation({
  words,
  anchor,
  reducedEffects,
  reducedMotion,
}: {
  words: readonly string[];
  anchor: Vec3;
  reducedEffects: boolean;
  reducedMotion: boolean;
}) {
  const driftRef = useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    if (!driftRef.current || reducedMotion) return;
    driftRef.current.position.y = Math.sin(clock.elapsedTime * 0.28) * 0.16;
    driftRef.current.rotation.z = Math.sin(clock.elapsedTime * 0.16) * 0.018;
  });
  const visibleWords = reducedEffects ? words.slice(-5) : words;

  if (visibleWords.length === 0) return null;
  return (
    <group
      name="constellation-released-words"
      position={anchor}
      userData={{ releasedWords: [...visibleWords] }}
    >
      <group ref={driftRef}>
        {visibleWords.map((word, index) => {
          const angle = index * 2.399963 + word.length * 0.27;
          const radius = 0.72 + index * 0.18;
          return (
            <group
              key={`${word}:${index}`}
              position={[Math.cos(angle) * radius, Math.sin(angle) * radius * 0.62, 0.08 + (index % 3) * 0.025]}
              userData={{ releasedWord: word }}
            >
              <mesh>
                <sphereGeometry args={[0.035 + (index % 2) * 0.012, 8, 6]} />
                <meshBasicMaterial color="#bdd9df" transparent opacity={0.82} depthWrite={false} toneMapped={false} />
              </mesh>
              <mesh position={[0, 0, -0.012]}>
                <ringGeometry args={[0.075, 0.09, 14]} />
                <meshBasicMaterial color="#8db6c0" transparent opacity={0.28} depthWrite={false} toneMapped={false} />
              </mesh>
            </group>
          );
        })}
      </group>
    </group>
  );
}

function ConstellationProtectedNest({ points }: { points: readonly Vec3[] }) {
  const center = pointsCentroid(points);
  const radius = Math.max(
    0.5,
    ...points.map((point) => Math.hypot(point[0] - center[0], point[1] - center[1]) + 0.28),
  );
  return (
    <group name="constellation-protected-nest" position={[center[0], center[1], center[2] + 0.03]}>
      <mesh>
        <ringGeometry args={[radius, radius + 0.045, 42]} />
        <meshBasicMaterial color="#e3bea0" transparent opacity={0.58} depthWrite={false} toneMapped={false} />
      </mesh>
      <mesh>
        <ringGeometry args={[radius + 0.13, radius + 0.15, 42]} />
        <meshBasicMaterial color="#a98166" transparent opacity={0.24} depthWrite={false} toneMapped={false} />
      </mesh>
    </group>
  );
}

/**
 * The epilogue sky is not a decorative, fixed star chart. Its nodes and lines
 * are built from the memories the current save has actually witnessed, in the
 * order they were encountered. Keystone memories retain a warmer prominence.
 */
const WitnessedMemoryConstellation = memo(function WitnessedMemoryConstellation({
  model,
  formationReady,
  reducedEffects,
  reducedMotion,
  onFormationComplete,
}: {
  model: ConstellationStoryModel;
  formationReady: boolean;
  reducedEffects: boolean;
  reducedMotion: boolean;
  onFormationComplete?: () => void;
}) {
  const formationRef = useRef<THREE.Group>(null);
  const formationProgressRef = useRef(reducedMotion && formationReady ? 1 : 0);
  const formationCompleteReportedRef = useRef(false);
  const onFormationCompleteRef = useRef(onFormationComplete);

  useEffect(() => {
    onFormationCompleteRef.current = onFormationComplete;
  }, [onFormationComplete]);
  const witnessedNodes = useMemo(
    () => model.nodes.filter((node) => node.witnessed && CANONICAL_ENTRY_ID_SET.has(node.entryId)),
    [model.nodes],
  );
  const historyPoints = useMemo(
    () => witnessedNodes.map((node) => memoryStarPosition(node.entryId)),
    [witnessedNodes],
  );
  const keystonePoints = useMemo(
    () => witnessedNodes
      .filter((node) => JOURNEY_ENTRY_CONTEXT[node.entryId]?.role === "keystone")
      .map((node) => memoryStarPosition(node.entryId)),
    [witnessedNodes],
  );
  const ritualPoints = useMemo(
    () => witnessedNodes
      .filter((node) => node.completedRitualIds.length > 0)
      .map((node) => memoryStarPosition(node.entryId)),
    [witnessedNodes],
  );
  const transformedLandmarkPoints = useMemo(
    () => witnessedNodes
      .filter((node) => node.landmarkState === "transformed" || node.landmarkState === "released")
      .map((node) => memoryStarPosition(node.entryId)),
    [witnessedNodes],
  );
  const routePoints = useMemo(
    () => model.routeEntryIds.filter((entryId) => CANONICAL_ENTRY_ID_SET.has(entryId)).map(memoryStarPosition),
    [model.routeEntryIds],
  );
  const nestPoints = useMemo(
    () => model.protectedNest.entryIds.map(memoryStarPosition),
    [model.protectedNest.entryIds],
  );
  const historyGeometry = useMemo(() => pointsGeometry(historyPoints), [historyPoints]);
  const keystoneGeometry = useMemo(() => pointsGeometry(keystonePoints), [keystonePoints]);
  const ritualGeometry = useMemo(() => pointsGeometry(ritualPoints), [ritualPoints]);
  const transformedLandmarkGeometry = useMemo(
    () => pointsGeometry(transformedLandmarkPoints),
    [transformedLandmarkPoints],
  );
  const threadGeometry = useMemo(() => lineGeometry(routePoints), [routePoints]);
  const symbolicAnchor = useMemo(() => {
    const integrationPoints = witnessedNodes
      .filter((node) => node.chapterId === "wolf-swan-seer")
      .map((node) => memoryStarPosition(node.entryId));
    return pointsCentroid(integrationPoints);
  }, [witnessedNodes]);
  const releasedWordAnchor = useMemo(() => {
    const releasePoints = witnessedNodes
      .filter((node) => node.chapterId === "fire-river")
      .map((node) => memoryStarPosition(node.entryId));
    return pointsCentroid(releasePoints);
  }, [witnessedNodes]);

  useFrame((_, delta) => {
    const formation = formationRef.current;
    if (!formation) return;
    const target = formationReady ? 1 : 0;
    const progress = reducedMotion
      ? target
      : THREE.MathUtils.damp(
          formationProgressRef.current,
          target,
          0.85,
          Math.min(delta, CONSTELLATION_MAX_FRAME_DELTA),
        );
    formationProgressRef.current = progress;
    const eased = THREE.MathUtils.smootherstep(progress, 0, 1);
    formation.visible = eased > 0.003;
    formation.scale.setScalar(0.02 + eased * 0.98);
    formation.position.y = CONSTELLATION_FORMATION_CENTER[1] - (1 - eased) * 0.7;
    formation.rotation.z = (1 - eased) * 0.06;
    formation.userData.formationProgress = Number(eased.toFixed(3));
    const formationComplete =
      formationReady &&
      (reducedMotion || eased >= CONSTELLATION_FORMATION_COMPLETE_THRESHOLD);
    formation.userData.formationComplete = formationComplete;
    if (formationComplete && !formationCompleteReportedRef.current) {
      formationCompleteReportedRef.current = true;
      onFormationCompleteRef.current?.();
    } else if (!formationReady) {
      formationCompleteReportedRef.current = false;
    }
  });

  if (witnessedNodes.length === 0) return null;

  return (
    <group
      name="witnessed-memory-constellation"
      userData={{
        witnessedCount: witnessedNodes.length,
        completedChapterCount: model.progress.completedChapters,
        completedRitualCount: model.progress.completedRituals,
        transformedLandmarkCount: model.landmarkMemory.transformedCount + model.landmarkMemory.releasedCount,
        routeStepCount: model.progress.routeSteps,
        source: "journey-store-history",
      }}
    >
      <group
        ref={formationRef}
        name="constellation-formation-reveal"
        position={CONSTELLATION_FORMATION_CENTER}
        scale={reducedMotion && formationReady ? 1 : 0.02}
        visible={formationReady}
        userData={{
          formationReady,
          formationMode: reducedMotion ? "immediate" : "gradual",
          formationComplete: reducedMotion && formationReady,
          beginsAfter: "lantern-placement-or-story-completion",
        }}
      >
        <group position={[-CONSTELLATION_FORMATION_CENTER[0], -CONSTELLATION_FORMATION_CENTER[1], -CONSTELLATION_FORMATION_CENTER[2]]}>
      <points geometry={historyGeometry}>
        <pointsMaterial
          color="#dce9f1"
          size={reducedEffects ? 0.1 : 0.135}
          transparent
          opacity={0.9}
          depthWrite={false}
          sizeAttenuation
          toneMapped={false}
        />
      </points>
      <points geometry={keystoneGeometry}>
        <pointsMaterial
          color="#e2b269"
          size={reducedEffects ? 0.145 : 0.205}
          transparent
          opacity={0.98}
          depthWrite={false}
          sizeAttenuation
          toneMapped={false}
        />
      </points>
      {ritualPoints.length > 0 ? (
        <points name="constellation-completed-story-moments" geometry={ritualGeometry}>
          <pointsMaterial
            color="#c7a8d8"
            size={reducedEffects ? 0.16 : 0.235}
            transparent
            opacity={0.9}
            depthWrite={false}
            sizeAttenuation
            toneMapped={false}
          />
        </points>
      ) : null}
      {transformedLandmarkPoints.length > 0 ? (
        <points name="constellation-transformed-landmarks" geometry={transformedLandmarkGeometry}>
          <pointsMaterial
            color="#bcd8c0"
            size={reducedEffects ? 0.19 : 0.27}
            transparent
            opacity={0.92}
            depthWrite={false}
            sizeAttenuation
            toneMapped={false}
          />
        </points>
      ) : null}
      {routePoints.length > 1 ? (
        <lineSegments name="constellation-actual-walked-route" geometry={threadGeometry}>
          <lineBasicMaterial
            color="#8ca7b7"
            transparent
            opacity={reducedEffects ? 0.22 : 0.38}
            depthWrite={false}
            toneMapped={false}
          />
        </lineSegments>
      ) : null}
      {model.protectedNest.visible && model.protectedNest.protected && nestPoints.length > 0 ? (
        <ConstellationProtectedNest points={nestPoints} />
      ) : null}
      <ConstellationResonanceLights
        nodes={model.resonanceNodes}
        anchor={symbolicAnchor}
        reducedEffects={reducedEffects}
      />
      <ReleasedWordConstellation
        words={model.releasedWords}
        anchor={releasedWordAnchor}
        reducedEffects={reducedEffects}
        reducedMotion={reducedMotion}
      />
        </group>
      </group>
    </group>
  );
});

function ProtectedChildNest({ reducedEffects }: { reducedEffects: boolean }) {
  const twigCount = reducedEffects ? 8 : 14;
  return (
    <group name="protected-nest-child-space" position={[-4.1, 0.5, -5.2]} rotation={[0, 0.3, 0]} scale={0.56}>
      <mesh position={[0, 0.22, 0]} scale={[1.65, 0.5, 1.18]} receiveShadow>
        <sphereGeometry args={[1, 20, 10, 0, Math.PI * 2, 0, Math.PI * 0.52]} />
        <meshStandardMaterial color="#8c6c4c" roughness={1} side={THREE.DoubleSide} />
      </mesh>
      {Array.from({ length: twigCount }, (_, index) => {
        const angle = (index / twigCount) * Math.PI * 2;
        return (
          <mesh
            key={index}
            position={[Math.cos(angle) * 1.5, 0.5 + Math.sin(angle * 3) * 0.06, Math.sin(angle) * 1.03]}
            rotation={[0.08 * Math.sin(angle), -angle, 0.1 * Math.cos(angle)]}
          >
            <capsuleGeometry args={[0.055, 1.55, 3, 6]} />
            <meshStandardMaterial color={index % 2 === 0 ? "#7c593c" : "#a27b54"} roughness={1} />
          </mesh>
        );
      })}
      <mesh position={[0, 0.55, 0]} scale={[1.1, 0.2, 0.72]}>
        <sphereGeometry args={[1, 18, 9]} />
        <meshStandardMaterial color="#b78e7c" roughness={0.98} />
      </mesh>
      <mesh position={[0, 1.18, 0.08]}>
        <sphereGeometry args={[0.26, 14, 10]} />
        <meshStandardMaterial color="#c8a28c" roughness={0.92} />
      </mesh>
      <group name="nest-protection-canopy">
        <Beam from={[-1.85, 0, -0.2]} to={[-1.25, 2.7, 0]} radius={0.1} color="#67503b" />
        <Beam from={[1.85, 0, -0.2]} to={[1.25, 2.7, 0]} radius={0.1} color="#67503b" />
        <Beam from={[-1.25, 2.7, 0]} to={[1.25, 2.7, 0]} radius={0.09} color="#67503b" />
        <mesh position={[0, 2.25, 0.02]} rotation={[0, 0, Math.PI / 2]}>
          <coneGeometry args={[1.4, 2.6, 16, 1, true]} />
          <meshStandardMaterial color="#6e705f" roughness={0.98} transparent opacity={0.74} side={THREE.DoubleSide} />
        </mesh>
      </group>
      <pointLight position={[0, 1.25, 0]} color="#ffd29b" intensity={0.62} distance={5.5} decay={2} />
    </group>
  );
}

function FinalWoodlandFrame({
  qualityProfile,
  reducedEffects,
}: Pick<FinalTableauProps, "qualityProfile" | "reducedEffects">) {
  const count = reducedEffects ? 4 : Math.min(FINAL_TREE_POSITIONS.length, 5 + qualityStep(qualityProfile));
  return (
    <group name="final-woods-remain">
      <FinalWoodlandDetails positions={FINAL_TREE_POSITIONS} count={count} />
    </group>
  );
}

function RestingWolf({ reducedMotion }: { reducedMotion: boolean }) {
  const breathRef = useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    if (!breathRef.current || reducedMotion) return;
    breathRef.current.scale.y = 1.3 * (1 + Math.sin(clock.elapsedTime * 1.25) * 0.018);
  });
  return <group name="resting-wolf" position={[-2.8, 1.02, -6.25]} rotation={[0, .52, 0]} scale={.55}>
    <group ref={breathRef} position={[0, -.35, 0]} rotation={[0, Math.PI / 2, 0]} scale={1.3}>
      <AuthoredNpcSilhouette kind="wolf" resting />
    </group>
  </group>;
}

function MovingRiver({ qualityProfile, reducedMotion }: Pick<FinalTableauProps, "qualityProfile" | "reducedMotion">) {
  return <group name="living-final-river" position={[3.85, .04, -6.4]} rotation={[0, -.08, 0]}>
    <WaterSurface position={[0, 0, 0]} size={[4.3, 13.5]} flow={.65} color="#243e46" opacity={.92}
      reducedMotion={reducedMotion} reducedEffects={qualityProfile.quality === "low"} />
  </group>;
}

function SwanOnWater({ reducedMotion }: { reducedMotion: boolean }) {
  const swanRef = useRef<THREE.Group>(null);
  const rippleRef = useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    if (reducedMotion) return;
    const time = clock.elapsedTime;
    if (swanRef.current) {
      swanRef.current.position.y = 0.45 + Math.sin(time * 1.35) * 0.045;
      swanRef.current.rotation.z = Math.sin(time * 0.47) * 0.022;
    }
    if (rippleRef.current) {
      const pulse = 1 + (Math.sin(time * 1.1) * 0.5 + 0.5) * 0.18;
      rippleRef.current.scale.setScalar(pulse);
    }
  });
  return (
    <group name="swan-on-moving-water" position={[3.65, 0.12, -5.5]} rotation={[0, -0.32, 0]} scale={0.56}>
      <group ref={rippleRef} position={[0, 0.1, 0]}>
        {[0.85, 1.28].map((radius, index) => (
          <mesh key={radius} rotation={[-Math.PI / 2, 0, 0]}>
            <ringGeometry args={[radius, radius + 0.035, 32]} />
            <meshBasicMaterial color="#a9c5d2" transparent opacity={index === 0 ? 0.32 : 0.18} depthWrite={false} />
          </mesh>
        ))}
      </group>
      <group ref={swanRef} position={[0, .45, 0]} rotation={[0, Math.PI / 2, 0]}>
        <AuthoredNpcSilhouette kind="swan" />
      </group>
    </group>
  );
}

function QuietSeer() {
  return <group name="quiet-seer" position={[5.15, .46, -6.05]} rotation={[0, -.5, 0]} scale={.6}>
    <AuthoredNpcSilhouette kind="phantom" />
  </group>;
}

function EmberFire({ reducedEffects, reducedMotion }: Pick<FinalTableauProps, "reducedEffects" | "reducedMotion">) {
  const emberRef = useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    if (!emberRef.current || reducedMotion) return;
    emberRef.current.scale.y = 0.9 + Math.sin(clock.elapsedTime * 4.2) * 0.1;
  });
  return (
    <group name="remembered-ember-fire" position={[2.3, 0.38, -5.15]} scale={0.7}>
      {[0, Math.PI / 2].map((rotation) => (
        <mesh key={rotation} position={[0, 0.17, 0]} rotation={[Math.PI / 2, 0, rotation]}>
          <cylinderGeometry args={[0.12, 0.16, 1.35, 7]} />
          <meshStandardMaterial color="#35251d" roughness={1} />
        </mesh>
      ))}
      <group ref={emberRef}>
        {[[-0.28, 0.05], [0.05, -0.16], [0.3, 0.18]].map(([x, z], index) => (
          <mesh key={index} position={[x, 0.36 + index * 0.04, z]}>
            <octahedronGeometry args={[0.18 + index * 0.035, 0]} />
            <meshBasicMaterial color={index === 1 ? "#ffc06d" : "#c65f32"} toneMapped={false} />
          </mesh>
        ))}
      </group>
      {reducedEffects ? null : (
        <FlickerLight position={[0, 0.72, 0]} color="#f0914e" intensity={1.35} distance={7} reducedMotion={reducedMotion} />
      )}
    </group>
  );
}

function DistantThornedHouse({ reducedEffects }: { reducedEffects: boolean }) {
  return (
    <group name="distant-thorned-house" position={[6.6, 1.05, -13.4]} rotation={[0, -0.42, 0]} scale={0.44}>
      <HouseShell size={[7.2, 4.6, 5.2]} wallColor="#4c3b32" roofColor="#211b19" openFront={false} />
      <group scale={0.68} position={[0, 0, 0.2]}>
        <ThornBranches density={reducedEffects ? 0.45 : 0.78} color="#2b1e1d" />
      </group>
      <mesh position={[0.75, 2.25, -2.66]}>
        <planeGeometry args={[0.92, 1.18]} />
        <meshBasicMaterial color="#6e3933" transparent opacity={0.42} toneMapped={false} />
      </mesh>
    </group>
  );
}

function FinalCrackedLookBackMirror() {
  return (
    <group
      name="final-cracked-look-back-mirror"
      position={[-5.5, 0.12, -9.45]}
      rotation={[0, 0.38, 0]}
      scale={0.56}
      userData={{ role: "look-back", cracked: true, reflectsPastWithoutHoldingIt: true }}
    >
      <ReflectivePanel position={[0, 2.08, 0]} size={[2.45, 3.85]} cracked warm />
      <group name="mirror-remembered-path-reflection" position={[0, 0.28, -0.09]} scale={0.32}>
        <StonePath color="#a69278" count={4} length={4.8} />
      </group>
      <mesh position={[0, 0.08, 0.14]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[1.15, 1.25, 26, 1, 0.45, Math.PI * 1.2]} />
        <meshStandardMaterial color="#75634e" roughness={0.95} />
      </mesh>
    </group>
  );
}

function RememberedForkLandmark() {
  return (
    <group
      name="remembered-fork-landmark"
      position={[-6.3, 0.08, -12.5]}
      rotation={[0, 0.22, 0]}
      scale={0.48}
      userData={{ landmark: "fork", paths: 2, remembered: true }}
    >
      <group name="remembered-fork-left-path" rotation={[0, -0.32, 0]}>
        <StonePath color="#57554e" count={6} length={7} fork={-0.72} />
      </group>
      <group name="remembered-fork-right-path" rotation={[0, 0.32, 0]}>
        <StonePath color="#6a665b" count={6} length={7} fork={0.72} />
      </group>
      <group name="remembered-fork-weighing-stone" position={[0, 0.58, 0.25]}>
        <mesh scale={[1.15, 0.72, 0.88]}>
          <dodecahedronGeometry args={[0.82, 0]} />
          <meshStandardMaterial color="#71695a" roughness={1} />
        </mesh>
        <Beam from={[0, 0.58, 0]} to={[0, 2.45, 0]} radius={0.07} color="#5a4937" />
        <Beam from={[-0.9, 2.24, 0]} to={[0.9, 2.24, 0]} radius={0.06} color="#5a4937" />
      </group>
    </group>
  );
}

function RememberedThreeClimbsLandmark() {
  const climbs = [
    { name: "remembered-climb-mind", position: [-2.2, 0.55, 0] as Vec3, color: "#5f686b" },
    { name: "remembered-climb-heart", position: [0, 1.15, -0.6] as Vec3, color: "#7b6563" },
    { name: "remembered-climb-womb", position: [2.2, 1.8, -1.2] as Vec3, color: "#897654" },
  ];
  return (
    <group
      name="remembered-three-climbs-landmark"
      position={[6.25, 0.05, -12.2]}
      rotation={[0, -0.2, 0]}
      scale={0.56}
      userData={{ landmark: "three-climbs", remembered: true, climbCount: 3 }}
    >
      {climbs.map((climb, index) => (
        <group key={climb.name} name={climb.name} position={climb.position} userData={{ sequence: index + 1 }}>
          <mesh position={[0, 0.22, 0]} receiveShadow>
            <cylinderGeometry args={[1.28, 1.65, 0.44, 10]} />
            <meshStandardMaterial color={climb.color} roughness={1} />
          </mesh>
          <mesh position={[0, 1.15, 0]}>
            <coneGeometry args={[1.06, 1.95, 9]} />
            <meshStandardMaterial color={climb.color} roughness={1} />
          </mesh>
          <mesh position={[0, 2.15, 0]}>
            <sphereGeometry args={[0.12 + index * 0.025, 9, 7]} />
            <meshBasicMaterial color={index === 0 ? "#bdccd0" : index === 1 ? "#d4a7a0" : "#e1bf78"} toneMapped={false} />
          </mesh>
        </group>
      ))}
      <Beam from={[-2.2, 0.86, 0]} to={[0, 1.48, -0.6]} radius={0.08} color="#877d6b" />
      <Beam from={[0, 1.48, -0.6]} to={[2.2, 2.1, -1.2]} radius={0.08} color="#877d6b" />
    </group>
  );
}

function SelfOwnedHome({ reducedEffects }: { reducedEffects: boolean }) {
  const bookCount = reducedEffects ? 4 : 8;
  return (
    <group name="self-owned-home" position={[0.7, 0.08, -7.25]} scale={0.43}>
      <group rotation={[0, Math.PI, 0]}>
        <TimberAssembly plaster color="#8b7e69" pieces={[
          { position: [0, 2.25, 2.9], size: [8.4, 4.5, .28] },
          ...[-4.2, 4.2].map(x => ({ position: [x, 2.25, 0] as Vec3, size: [.28, 4.5, 5.8] as Vec3 })),
        ]} />
        <TimberAssembly color="#48463d" pieces={[-1, 1].map(side => ({ position: [side * 1.85, 5.08, 0], rotation: [0, 0, side * -.52], size: [4.9, .3, 6.35] }))} />
        <DoorFrame position={[0, 0, -3.08]} width={3.6} height={3.8} depth={0.28} color="#5c4d3f" open />
        <mesh name="self-owned-home-interior-floor" position={[0, 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
          <planeGeometry args={[7.7, 5.3]} />
          <meshStandardMaterial color="#6f604a" roughness={0.96} />
        </mesh>
        <group name="final-home-library-and-writing" position={[-2.6, 0.1, 1.72]} userData={{ practices: ["reading", "writing"] }}>
          <mesh position={[0, 1.7, 0.62]}>
            <boxGeometry args={[2.05, 3.4, 0.34]} />
            <meshStandardMaterial color="#44372e" roughness={0.96} />
          </mesh>
          {[0.72, 1.48, 2.24, 3].map((y) => (
            <mesh key={y} position={[0, y, 0.35]}>
              <boxGeometry args={[2, 0.1, 0.56]} />
              <meshStandardMaterial color="#66503c" roughness={0.94} />
            </mesh>
          ))}
          <ShelvedBooks count={bookCount} spacing={.45} rowHeight={.76} startX={-.72} startY={1.04} z={.08} scale={.82} />
          <group position={[.48, .78, -.72]}><WritingDesk width={2.2} depth={.92} /></group>
          <mesh position={[0.24, 0.87, -0.75]} rotation={[-Math.PI / 2, 0, 0.08]}>
            <planeGeometry args={[0.9, 0.56]} />
            <meshStandardMaterial color="#d1c8b3" roughness={0.98} side={THREE.DoubleSide} />
          </mesh>
        </group>
        <group name="final-home-velvet-reading-nook" position={[2.7, 0.1, 1]} userData={{ fabric: "velvet" }}>
          <Upholstery position={[0, .52, 0]} size={[1.8, .5, 1.2]} color="#653645" />
          <Upholstery position={[0, 1.18, .36]} size={[1.45, 1.3, .45]} color="#733d4e" />
          <mesh position={[-0.82, 0.36, -0.54]} rotation={[-Math.PI / 2, 0, -0.18]}>
            <planeGeometry args={[0.82, 0.54]} />
            <meshStandardMaterial color="#cbbfa8" roughness={0.98} side={THREE.DoubleSide} />
          </mesh>
        </group>
        <group name="final-home-protected-reading-light" position={[-0.1, 0.1, 1.65]} userData={{ protected: true }}>
          <mesh position={[0, 0.26, 0]}>
            <cylinderGeometry args={[0.09, 0.11, 0.52, 8]} />
            <meshStandardMaterial color="#ded3bf" roughness={0.84} />
          </mesh>
          <mesh position={[0, 0.6, 0]}>
            <sphereGeometry args={[0.08, 8, 6]} />
            <meshBasicMaterial color="#ffd18a" toneMapped={false} />
          </mesh>
        </group>
        <group
          name="final-reserved-empty-space"
          position={[2.65, 0.04, -1.55]}
          userData={{ intentionallyEmpty: true, reservedFor: "what-may-come", furnished: false }}
        >
          <mesh rotation={[-Math.PI / 2, 0, 0]}>
            <ringGeometry args={[1.05, 1.1, 40]} />
            <TactileMaterial surface="wood" color="#99886a" roughness={.95} />
          </mesh>
          <mesh position={[0, 0.01, 0]} rotation={[-Math.PI / 2, 0, 0]}>
            <circleGeometry args={[1.02, 40]} />
            <TactileMaterial surface="wood" color="#75684e" roughness={.98} />
          </mesh>
        </group>
        {[-2.82, 2.82].map((x) => (
          <group key={x} position={[x, 2.45, 2.74]}>
            <mesh>
              <planeGeometry args={[1.15, 1.35]} />
              <meshBasicMaterial color="#d7a663" transparent opacity={0.62} side={THREE.DoubleSide} toneMapped={false} />
            </mesh>
            <Beam from={[-0.56, 0, 0.02]} to={[0.56, 0, 0.02]} radius={0.025} color="#40372f" />
            <Beam from={[0, -0.66, 0.02]} to={[0, 0.66, 0.02]} radius={0.025} color="#40372f" />
          </group>
        ))}
        <pointLight position={[0, 2.2, -1.6]} color="#ffd090" intensity={1.15} distance={10} decay={2} />
      </group>
    </group>
  );
}

function ReturnedSelf({ crowned }: { crowned: boolean }) {
  return (
    <group name="returned-self-inside-home" userData={{ crownedInReflection: crowned }} position={[0.38, 0.18, -6.72]} rotation={[0, 0.12, 0]} scale={0.56}>
      <mesh position={[0, 0.9, 0]} rotation={[0.06, 0, 0]} castShadow>
        <coneGeometry args={[0.58, 1.65, 12]} />
        <meshStandardMaterial color="#4b4243" roughness={0.96} />
      </mesh>
      <mesh position={[0, 1.83, 0]}>
        <sphereGeometry args={[0.3, 14, 10]} />
        <meshStandardMaterial color="#a78674" roughness={0.93} />
      </mesh>
      <mesh position={[0.02, 2.02, 0.02]} scale={[0.88, 1.05, 0.84]}>
        <sphereGeometry args={[0.34, 13, 9, 0, Math.PI * 2, 0, Math.PI * 0.62]} />
        <meshStandardMaterial color="#2b2525" roughness={1} side={THREE.DoubleSide} />
      </mesh>
      {/* Crown recognition belongs to the mirror, never a wearable reward. */}
    </group>
  );
}

export const IntegratedFinalTableau = memo(function IntegratedFinalTableau({
  qualityProfile,
  reducedEffects,
  reducedMotion,
  onFinalConstellationFormationComplete,
}: FinalTableauProps) {
  const activeEntryId = useJourneyStore((state) => state.activeEntryId);
  const history = useJourneyStore((state) => state.history);
  const witnessedEntryIds = useJourneyStore((state) => state.witnessedEntryIds);
  const completedChapterIds = useJourneyStore((state) => state.completedChapterIds);
  const completedSceneIds = useJourneyStore((state) => state.completedSceneIds);
  const completedRitualIds = useJourneyStore((state) => state.completedRitualIds);
  const resonances = useJourneyStore((state) => state.resonances);
  const releasedWords = useJourneyStore((state) => state.releasedWords);
  const landmarkStates = useJourneyStore((state) => state.landmarkStates);
  const recoveredKeys = useJourneyStore((state) => state.inventory.recoveredKeys);
  const lanternPlacedFlag = useJourneyStore((state) => state.worldFlags["lantern.placed-and-lit"] === true);
  const storyCompleted = useJourneyStore((state) => state.storyCompleted);
  const reverseComplete = useJourneyStore((state) => state.storyObjectStates["epilogue.reverse-light"] === "complete");
  const eventDriven = useJourneyStore((state) => state.worldFlags["story-events.started"] === true);
  const placementId = useJourneyStore((state) => state.storyPlacementStates["lantern.master"]);
  const lanternOffset: [number, number, number] = placementId === "reading-nook" ? [2.4, 0, .5] : placementId === "fountain" ? [-2.8, 0, 1.7] : placementId === "window" ? [3.1, .6, -1.1] : [0, 0, 0];

  const recoveredKeySet = useMemo(() => new Set(recoveredKeys), [recoveredKeys]);
  const completedSceneSet = useMemo(() => new Set(completedSceneIds), [completedSceneIds]);
  const completedRitualSet = useMemo(() => new Set(completedRitualIds), [completedRitualIds]);
  const constellationModel = useMemo(
    () => buildStoryConstellationModel({
      activeEntryId,
      history,
      witnessedEntryIds,
      completedRitualIds,
      completedChapterIds,
      completedSceneIds,
      resonances,
      releasedWords,
      landmarkStates,
    }),
    [
      activeEntryId,
      completedChapterIds,
      completedRitualIds,
      completedSceneIds,
      history,
      landmarkStates,
      releasedWords,
      resonances,
      witnessedEntryIds,
    ],
  );
  const lanternPlaced = storyCompleted || lanternPlacedFlag || completedRitualSet.has("ritual.place-lantern");
  const crowned = storyCompleted || completedSceneSet.has("crowned.sovereignty");
  const showProtectionKey = recoveredKeySet.has("key.protection");
  const showPermissionKey = recoveredKeySet.has("key.self-permission");

  return (
    <group
      name="integrated-final-tableau"
      userData={{
        witnessedCount: witnessedEntryIds.length,
        lanternPlaced,
        recoveredKeyCount: recoveredKeys.length,
        crowned,
        lookBackComplete: true,
        reservedSpace: "what-may-come",
        constellationFormation: reducedMotion ? "immediate" : "gradual",
      }}
    >
      <SceneGround radius={26} color="#151919" roughness={0.98} />
      <FinalWoodlandFrame qualityProfile={qualityProfile} reducedEffects={reducedEffects} />
      <group name="clearly-visible-homeward-path">
        <StonePath color="#7a776b" count={reducedEffects ? 8 : 12} length={14} y={0.015} />
      </group>
      <MovingRiver qualityProfile={qualityProfile} reducedMotion={reducedMotion} />
      <group name="realistic-final-blue-moon">
        <MoonDisc
          position={[-8.35, 9.6, -20.6]}
          radius={4.4}
          color="#d8e8f2"
          intensity={1.62}
          qualityProfile={qualityProfile}
          reducedEffects={reducedEffects}
          reducedMotion={reducedMotion}
        />
      </group>
      <WitnessedMemoryConstellation
        model={constellationModel}
        formationReady={(lanternPlaced && (!eventDriven || reverseComplete)) || storyCompleted}
        reducedEffects={reducedEffects}
        reducedMotion={reducedMotion}
        onFormationComplete={onFinalConstellationFormationComplete}
      />

      {eventDriven ? <ReverseMemoryLights reducedMotion={reducedMotion} /> : null}
      <FinalCrackedLookBackMirror />
      <RememberedForkLandmark />
      <RememberedThreeClimbsLandmark />
      <SelfOwnedHome reducedEffects={reducedEffects} />
      <ReturnedSelf crowned={crowned} />
      {lanternPlaced ? (
        <group name="placed-lit-lantern-beside-home" position={lanternOffset} userData={{ placementId }}>
          <LanternProp
            position={[1.18, 0.34, -6.32]}
            scale={0.78}
            reducedMotion={reducedMotion}
            light
            color="#ffd18a"
          />
          <mesh name="placed-lantern-visible-flame" position={[1.18, 0.98, -6.18]}>
            <sphereGeometry args={[0.21, 12, 9]} />
            <meshBasicMaterial color="#ffd18a" toneMapped={false} />
          </mesh>
          {reducedEffects ? null : (
            <mesh position={[1.18, 0.98, -6.18]} scale={2.15}>
              <sphereGeometry args={[0.25, 12, 9]} />
              <meshBasicMaterial
                color="#efad55"
                transparent
                opacity={0.14}
                depthWrite={false}
                blending={THREE.AdditiveBlending}
                toneMapped={false}
              />
            </mesh>
          )}
        </group>
      ) : null}
      {showProtectionKey || showPermissionKey ? (
        <group name="recovered-journey-keys" position={[1.1, 0.42, -5.62]}>
          <mesh position={[0, 0.05, 0]} rotation={[-Math.PI / 2, 0, 0]}>
            <circleGeometry args={[0.9, 24]} />
            <meshStandardMaterial color="#50473b" metalness={0.18} roughness={0.74} />
          </mesh>
          {showProtectionKey ? (
            <group name="recovered-key-protection">
              <KeyProp position={[-0.56, 0.2, 0]} scale={0.34} color="#c49b59" />
            </group>
          ) : null}
          {showPermissionKey ? (
            <group name="recovered-key-self-permission">
              <KeyProp position={[0.24, 0.2, 0]} scale={0.34} color="#d6bd86" />
            </group>
          ) : null}
        </group>
      ) : null}

      <ProtectedChildNest reducedEffects={reducedEffects} />
      <RestingWolf reducedMotion={reducedMotion} />
      <EmberFire reducedEffects={reducedEffects} reducedMotion={reducedMotion} />
      <SwanOnWater reducedMotion={reducedMotion} />
      <QuietSeer />
      <DistantThornedHouse reducedEffects={reducedEffects} />

      <LegacyChapterLight><hemisphereLight args={["#b5cad5", "#111513", reducedEffects ? 0.34 : 0.5]} /></LegacyChapterLight>
      <ChapterLightRig family="lantern-epilogue" reducedMotion={reducedMotion} reducedEffects={reducedEffects} />
    </group>
  );
});

export default IntegratedFinalTableau;
