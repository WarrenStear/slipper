import { useSceneLook } from "../artDirection/SceneLookContext";
import { useEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import type { Vector3Tuple } from "../../../data/slipper3dTypes";
import type { NarrativeWorldState } from "../StoryScene";
import type { RenderQualityProfile } from "../renderQuality";
import type { WorldDirectorState } from "../worldDirector/worldDirector";
import type { WorldVisualState } from "../worldVisualState";
import { TERRAIN_BASE_Y } from "../../../lib/worldLayout";

type PerfectWorldGroundProps = {
  worldDirector: WorldDirectorState;
  visualState: WorldVisualState;
  narrativeWorldState: NarrativeWorldState;
  qualityProfile: RenderQualityProfile;
  navigationTargetPosition?: Vector3Tuple | null;
  enabled?: boolean;
};

function clamp01(value: number) {
  return Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));
}

function buildPathRibbonGeometry(width = 0.58, segments = 42) {
  const positions = new Float32Array((segments + 1) * 2 * 3);
  const uvs = new Float32Array((segments + 1) * 2 * 2);
  const indices: number[] = [];

  for (let index = 0; index <= segments; index += 1) {
    const t = index / segments;
    const row = index * 2;
    positions[(row + 0) * 3 + 0] = -width * 0.5;
    positions[(row + 0) * 3 + 1] = 0;
    positions[(row + 0) * 3 + 2] = t - 0.5;
    positions[(row + 1) * 3 + 0] = width * 0.5;
    positions[(row + 1) * 3 + 1] = 0;
    positions[(row + 1) * 3 + 2] = t - 0.5;

    uvs[(row + 0) * 2 + 0] = 0;
    uvs[(row + 0) * 2 + 1] = t;
    uvs[(row + 1) * 2 + 0] = 1;
    uvs[(row + 1) * 2 + 1] = t;

    if (index < segments) {
      indices.push(row, row + 1, row + 2, row + 1, row + 3, row + 2);
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute("uv", new THREE.BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

function NavigationRibbon({ navigationTargetPosition, visualState, narrativeWorldState, qualityProfile, enabled }: PerfectWorldGroundProps) {
  const presentation = useSceneLook();
  const { camera } = useThree();
  const meshRef = useRef<THREE.Mesh>(null);
  const materialRef = useRef<THREE.MeshBasicMaterial>(null);
  const geometry = useMemo(() => buildPathRibbonGeometry(), []);
  const startRef = useRef(new THREE.Vector3());
  const endRef = useRef(new THREE.Vector3());
  const directionRef = useRef(new THREE.Vector3());
  const midpointRef = useRef(new THREE.Vector3());
  const rightRef = useRef(new THREE.Vector3());
  const upRef = useRef(new THREE.Vector3());
  const rotationMatrixRef = useRef(new THREE.Matrix4());
  const targetPathColor = useMemo(
    () => new THREE.Color(visualState.palette.particle),
    [visualState.palette.particle],
  );

  useEffect(() => () => geometry.dispose(), [geometry]);

  useFrame(({ clock }, delta) => {
    if (!meshRef.current || !materialRef.current) return;
    const smoothing = 1 - Math.exp(-Math.min(delta, 0.05) * 5.5);
    const target = navigationTargetPosition;
    const visible = Boolean(enabled && target);
    materialRef.current.opacity = THREE.MathUtils.lerp(
      materialRef.current.opacity,
      visible ? 0.022 + visualState.pathGlowIntensity * 0.012 : 0,
      smoothing,
    );
    materialRef.current.color.lerp(targetPathColor, smoothing);

    if (!target || !enabled) return;

    startRef.current.set(
      camera.position.x,
      Math.max(TERRAIN_BASE_Y + 0.075, camera.position.y - 1.94),
      camera.position.z,
    );
    endRef.current.set(
      target[0],
      TERRAIN_BASE_Y + target[1] + 0.075,
      target[2],
    );
    const direction = directionRef.current.copy(endRef.current).sub(startRef.current);
    const distance = Math.max(0.001, direction.length());
    midpointRef.current.copy(startRef.current).add(endRef.current).multiplyScalar(0.5);
    meshRef.current.position.lerp(midpointRef.current, smoothing);
    direction.multiplyScalar(1 / distance);
    rightRef.current.set(direction.z, 0, -direction.x);
    if (rightRef.current.lengthSq() <= 0.000001) rightRef.current.set(1, 0, 0);
    else rightRef.current.normalize();
    upRef.current.copy(direction).cross(rightRef.current).normalize();
    rotationMatrixRef.current.makeBasis(
      rightRef.current,
      upRef.current,
      direction,
    );
    meshRef.current.quaternion.setFromRotationMatrix(rotationMatrixRef.current);
    const pulse = qualityProfile.particleMultiplier > 0 ? 1 + Math.sin((presentation?.time.vegetation ?? clock.elapsedTime) * 1.2) * 0.035 : 1;
    meshRef.current.scale.set(
      THREE.MathUtils.lerp(meshRef.current.scale.x, pulse, smoothing),
      THREE.MathUtils.lerp(meshRef.current.scale.y, 1, smoothing),
      THREE.MathUtils.lerp(meshRef.current.scale.z, distance, smoothing),
    );
  });

  if (!enabled) return null;

  return (
    <mesh ref={meshRef} geometry={geometry} renderOrder={8} frustumCulled={false}>
      <meshBasicMaterial
        ref={materialRef}
        color={visualState.palette.particle}
        transparent
        opacity={0}
        depthWrite={false}
        depthTest
        side={THREE.DoubleSide}
      />
    </mesh>
  );
}

function ClearingBreathRings({ worldDirector, visualState, narrativeWorldState, qualityProfile, navigationTargetPosition, enabled }: PerfectWorldGroundProps) {
  const presentation = useSceneLook();
  const groupRef = useRef<THREE.Group>(null);
  const innerRef = useRef<THREE.MeshBasicMaterial>(null);
  const outerRef = useRef<THREE.MeshBasicMaterial>(null);
  const destinationRef = useRef(new THREE.Vector3());
  const targetAccentColor = useMemo(
    () => new THREE.Color(visualState.palette.accent),
    [visualState.palette.accent],
  );
  const targetParticleColor = useMemo(
    () => new THREE.Color(visualState.palette.particle),
    [visualState.palette.particle],
  );
  const targetOpacity = enabled ? 0.012 + worldDirector.environment.clearingGlow * 0.012 : 0;

  useFrame(({ clock }, delta) => {
    if (!groupRef.current) return;
    const smoothing = 1 - Math.exp(-Math.min(delta, 0.05) * 3.8);
    const destination = destinationRef.current;
    if (navigationTargetPosition) {
      destination.set(
        navigationTargetPosition[0],
        TERRAIN_BASE_Y + navigationTargetPosition[1] + 0.08,
        navigationTargetPosition[2],
      );
    } else {
      destination.set(0, TERRAIN_BASE_Y + 0.08, 0);
    }
    groupRef.current.position.lerp(destination, smoothing);
    const ambientMotionEnabled = qualityProfile.particleMultiplier > 0;
    groupRef.current.rotation.z = ambientMotionEnabled ? (presentation?.time.vegetation ?? clock.elapsedTime) * 0.035 : 0;
    const breath = ambientMotionEnabled
      ? 1 + Math.sin((presentation?.time.vegetation ?? clock.elapsedTime) * 0.78) * (0.025 + clamp01(narrativeWorldState.memoryPressure) * 0.02)
      : 1;
    groupRef.current.scale.setScalar(breath);

    if (innerRef.current) {
      innerRef.current.color.lerp(targetAccentColor, smoothing);
      innerRef.current.opacity = THREE.MathUtils.lerp(innerRef.current.opacity, targetOpacity * 1.4, smoothing);
    }
    if (outerRef.current) {
      outerRef.current.color.lerp(targetParticleColor, smoothing);
      outerRef.current.opacity = THREE.MathUtils.lerp(outerRef.current.opacity, targetOpacity, smoothing);
    }
  });

  if (!enabled) return null;

  return (
    <group name="scene-clearing-breath" ref={groupRef}>
      <mesh rotation={[-Math.PI / 2, 0, 0]} renderOrder={6}>
        <ringGeometry args={[3.1, 3.22, 120]} />
        <meshBasicMaterial ref={innerRef} color={visualState.palette.accent} transparent opacity={targetOpacity} depthWrite={false} side={THREE.DoubleSide} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} renderOrder={5}>
        <ringGeometry args={[5.6, 5.74, 140]} />
        <meshBasicMaterial ref={outerRef} color={visualState.palette.particle} transparent opacity={targetOpacity * 0.7} depthWrite={false} side={THREE.DoubleSide} />
      </mesh>
    </group>
  );
}

export function PerfectWorldGround(props: PerfectWorldGroundProps) {
  if (!props.enabled) return null;

  return (
    <>
      <NavigationRibbon {...props} />
      <ClearingBreathRings {...props} />
    </>
  );
}

export default PerfectWorldGround;
