import { useFrame } from "@react-three/fiber";
import { memo, useEffect, useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { openingMotionDelta, openingRoomTarget, openingStage } from "../../../cinematics/openingPresentation";
import { useSettingsStore } from "../../../stores/useSettingsStore";
import { useWorldStore } from "../../../stores/useWorldStore";
import { TactileMaterial } from "../storyEvents/TactileMaterial";
import { useJourneyStore } from "../../../stores/useJourneyStore";
import { BrokenRoomDetails } from "../environment/EnvironmentDressing";
import { ChapterLightRig } from "../environment/ChapterLightRig";
import { roomShellWithoutFloor } from "../environment/chapterEnvironment";
import { WetFloorReveal } from "../storyEvents/WetFloorReveal";
import {
  FabricVeil,
  FlickerLight,
  LanternProp,
  SceneGround,
  TreeGrove,
} from "./ChapterPrimitives";
import type { ChapterSceneProps } from "./types";

/** Exact original board positions, one draw call instead of one per board. */
function OpeningFloorboards({ count }: { count: number }) {
  const boards = useRef<THREE.InstancedMesh>(null);
  useLayoutEffect(() => {
    if (!boards.current) return;
    const transform = new THREE.Object3D();
    const light = new THREE.Color("#2c251f"), dark = new THREE.Color("#211d19");
    for (let i = 0; i < count; i++) {
      transform.position.set(-7.2 + i * (14.4 / Math.max(1, count - 1)), 0, 0);
      transform.updateMatrix();
      boards.current.setMatrixAt(i, transform.matrix);
      boards.current.setColorAt(i, i % 3 === 0 ? light : dark);
    }
    boards.current.instanceMatrix.needsUpdate = true;
    if (boards.current.instanceColor) boards.current.instanceColor.needsUpdate = true;
    boards.current.computeBoundingBox(); boards.current.computeBoundingSphere();
  }, [count]);
  return <instancedMesh ref={boards} args={[undefined, undefined, count]} receiveShadow name="opening-original-floorboards">
    <boxGeometry args={[.96, .14, 16]} />
    <TactileMaterial surface="wood" color="#ffffff" roughness={.58} />
  </instancedMesh>;
}

function BrokenFloorChapterComponent({
  qualityProfile,
  reducedEffects,
  reducedMotion,
  openingResolved: openingResolvedProp = true,
}: ChapterSceneProps) {
  const floorState = useJourneyStore((state) => state.storyObjectStates?.["broken-floor.reflection"]);
  const eventIds = useJourneyStore((state) => state.completedStoryEventIds ?? []);
  const openingResolved = openingResolvedProp || floorState === "inverted";
  const revealStage = openingStage(floorState, eventIds, openingResolved);
  const plankCount = qualityProfile.quality === "low" ? 7 : 12;
  const inversionProgressRef = useRef(openingRoomTarget(revealStage));
  const reflectedForestRef = useRef<THREE.Group>(null);
  const roomShellRef = useRef<THREE.Group>(null);
  const roomMaterialRef = useRef<THREE.MeshStandardMaterial>(null);
  const roomGeometry = useMemo(() => {
    const geometry = new THREE.BoxGeometry(16.6, 6.9, 17);
    const index = geometry.getIndex();
    if (index) geometry.setIndex(roomShellWithoutFloor(index.array, geometry.getAttribute("normal").array));
    return geometry;
  }, []);
  useEffect(() => () => roomGeometry.dispose(), [roomGeometry]);
  const wallRemnantsRef = useRef<THREE.Group>(null);
  const lanternRef = useRef<THREE.Group>(null);

  useFrame((_, delta) => {
    const active = !document.hidden && document.hasFocus()
      && !useSettingsStore.getState().drawerOpen && useWorldStore.getState().mode === "explore";
    const targetProgress = openingResolved ? 1 : revealStage / 5;
    inversionProgressRef.current = reducedMotion && active ? targetProgress
      : THREE.MathUtils.damp(inversionProgressRef.current, targetProgress, 3 / 8, openingMotionDelta(delta, active));
    const progress = THREE.MathUtils.smootherstep(inversionProgressRef.current, 0, 1);

    if (reflectedForestRef.current) {
      reflectedForestRef.current.position.y = THREE.MathUtils.lerp(-10.5, -6.8, progress);
      const scale = THREE.MathUtils.lerp(0.42, 0.56, progress);
      reflectedForestRef.current.scale.set(scale, THREE.MathUtils.lerp(0.38, 0.54, progress), scale);
    }
    if (roomShellRef.current && roomMaterialRef.current) {
      const roomOpacity = 1 - THREE.MathUtils.smoothstep(progress, 0.46, 0.96);
      roomMaterialRef.current.opacity = roomOpacity;
      roomShellRef.current.position.y = THREE.MathUtils.lerp(0, 1.4, progress);
      roomShellRef.current.visible = roomOpacity > 0.012;
    }
    if (wallRemnantsRef.current) {
      wallRemnantsRef.current.visible = progress > 0.5;
      wallRemnantsRef.current.scale.y = THREE.MathUtils.lerp(0.02, 1, THREE.MathUtils.smoothstep(progress, 0.5, 1));
    }
    if (lanternRef.current) {
      lanternRef.current.position.z = THREE.MathUtils.lerp(5.6, 10.4, progress);
    }
  });

  return (
    <group name="broken-floor-progressive-inversion">
      <SceneGround radius={14} color="#171513" roughness={0.42} metalness={0.08} y={-0.28} />

      <group position={[0, -0.16, 0]}>
        <OpeningFloorboards count={plankCount} />
      </group>

      <WetFloorReveal stage={revealStage} reducedMotion={reducedMotion} />
      <group ref={reflectedForestRef} name="forest-beneath-wet-reflection" visible={revealStage >= 3} position={[0, -10.5, 0]} scale={[0.42, 0.38, 0.42]}>
        <TreeGrove
          qualityProfile={qualityProfile}
          reducedEffects={reducedEffects}
          tint="#101b1a"
          trunk="#10100f"
          radius={13}
        />
      </group>

      <group ref={roomShellRef} name="ordinary-room-yields-to-forest">
        <BrokenRoomDetails />
        <mesh name="broken-floor-room-shell" geometry={roomGeometry} position={[0, 3.18, 0]} receiveShadow>
          <meshStandardMaterial
            ref={roomMaterialRef}
            color="#302a23"
            emissive="#21150d"
            emissiveIntensity={0.3}
            roughness={0.99}
            transparent
            opacity={openingResolved ? 0 : 1}
            depthWrite={!openingResolved}
            side={THREE.BackSide}
          />
        </mesh>
      </group>

      <group ref={wallRemnantsRef} name="broken-floor-wall-remnants" visible={openingResolved} scale={[1, openingResolved ? 1 : 0.02, 1]}>
        <mesh position={[-8.1, 2.1, -2.4]} receiveShadow>
          <boxGeometry args={[0.34, 4.4, 11.8]} />
          <meshStandardMaterial color="#24211d" roughness={0.98} />
        </mesh>
        <mesh position={[8.1, 2.1, -2.4]} receiveShadow>
          <boxGeometry args={[0.34, 4.4, 11.8]} />
          <meshStandardMaterial color="#24211d" roughness={0.98} />
        </mesh>
        <mesh position={[0, 2.1, -8.2]} receiveShadow>
          <boxGeometry args={[16.4, 4.4, 0.34]} />
          <meshStandardMaterial color="#292621" roughness={0.98} />
        </mesh>
      </group>

      <group position={[-4.8, 0, -4.1]}>
        <mesh position={[0, 0.12, 0]}>
          <cylinderGeometry args={[1.05, 0.86, 0.24, 28]} />
          <meshStandardMaterial color="#5c5549" metalness={0.42} roughness={0.3} />
        </mesh>
        <mesh position={[0, 0.23, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <circleGeometry args={[0.8, 28]} />
          <meshPhysicalMaterial color="#283c48" metalness={0.48} roughness={0.08} />
        </mesh>
      </group>

      <FabricVeil
        position={[-5.5, 0.38, -1.7]}
        rotation={[-Math.PI / 2, 0, -0.22]}
        size={[2.7, 3.8]}
        color="#c6c0b6"
        opacity={0.64}
        reducedMotion={reducedMotion}
      />
      <group ref={lanternRef} name="distant-light-recedes-into-wood" position={[0, 0, openingResolved ? 10.4 : 5.6]}>
        <LanternProp position={[0, 0.1, 0]} scale={0.78} reducedMotion={reducedMotion} />
      </group>
      {!openingResolved ? (
        <FlickerLight
          position={[0, 1.5, 5.6]}
          color="#f1b86a"
          intensity={1.7}
          distance={11}
          reducedMotion={reducedMotion}
        />
      ) : null}
      <ChapterLightRig family="broken-floor" reducedMotion={reducedMotion} />
      <pointLight position={[0, -2.4, 1]} color="#6da2b8" intensity={reducedEffects ? 0.35 : 0.75} distance={18} />
    </group>
  );
}

export const BrokenFloorChapter = memo(BrokenFloorChapterComponent);
export default BrokenFloorChapter;
