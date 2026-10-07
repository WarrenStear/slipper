import { useFrame } from "@react-three/fiber";
import { memo, useEffect, useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { openingRoomTarget, openingStage } from "../../cinematics/openingPresentation";
import { useSettingsStore } from "../../stores/useSettingsStore";
import { useWorldStore } from "../../stores/useWorldStore";
import { StoneBasin, TimberAssembly } from "../../components/three/chapters/ChapterArt";
import type { ConstructionPiece } from "../../components/three/chapters/chapterArtGeometry";
import { applyTactileShader, tactileProgramKey } from "../../components/three/storyEvents/tactileShader";
import { TactileMaterial, useTactileDetail } from "../../components/three/storyEvents/TactileMaterial";
import { useJourneyStore } from "../../stores/useJourneyStore";
import { BrokenRoomDetails } from "../../components/three/environment/EnvironmentDressing";
import { ChapterLightRig } from "../../components/three/environment/ChapterLightRig";
import { roomShellWithoutFloor } from "../../components/three/environment/chapterEnvironment";
import { WetFloorReveal } from "../../world/opening/WetFloorReveal";
import { advanceOpeningRoom, openingRoomAppearance } from "../../world/opening/openingComposition";
import { scenePresentationActive } from "../../world/presentationActivity";
import {
  FabricVeil,
  FlickerLight,
  LanternProp,
  SceneGround,
  TreeGrove,
} from "../../components/three/chapters/ChapterPrimitives";
import type { ChapterSceneProps } from "../../components/three/chapters/types";

/** Exact original board centres and envelope, merged for per-board metre UVs. */
function OpeningFloorboards({ count }: { count: number }) {
  const pieces = useMemo<ConstructionPiece[]>(() => Array.from({ length: count }, (_, i) => ({
    position: [-7.2 + i * (14.4 / Math.max(1, count - 1)), 0, 0],
    size: [.96, .14, 16],
    color: i % 3 === 0 ? "#a5967f" : "#91836f",
  })), [count]);
  return <TimberAssembly name="opening-original-floorboards" pieces={pieces} color="#796b55" surface="wet-wood" />;
}

function BrokenFloorChapterComponent({
  qualityProfile,
  reducedEffects,
  reducedMotion,
  openingResolved: openingResolvedProp = true,
}: ChapterSceneProps) {
  const tactileDetail = useTactileDetail();
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
    geometry.computeBoundingBox(); geometry.computeBoundingSphere();
    return geometry;
  }, []);
  useEffect(() => () => roomGeometry.dispose(), [roomGeometry]);
  const ordinaryFloorRef = useRef<THREE.Group>(null);
  const roomAppearanceRef = useRef(openingRoomAppearance(inversionProgressRef.current));
  const roomMaterials = useRef<THREE.Material[]>([]);
  useLayoutEffect(() => {
    const materials = new Set<THREE.Material>();
    roomShellRef.current?.traverse(object => {
      if (!(object instanceof THREE.Mesh)) return;
      for (const material of [object.material].flat()) {
        material.transparent = true; material.opacity = roomAppearanceRef.current.roomOpacity;
        material.depthWrite = material.opacity > .98; materials.add(material);
      }
    });
    roomMaterials.current = [...materials];
    return () => { roomMaterials.current = []; };
  }, []);
  const wallRemnantsRef = useRef<THREE.Group>(null);
  const lanternRef = useRef<THREE.Group>(null);

  useFrame((_, delta) => {
    const world = useWorldStore.getState();
    const active = scenePresentationActive({ visible: !document.hidden, focused: document.hasFocus(),
      overlayOpen: useSettingsStore.getState().drawerOpen, mode: world.mode, physicsPaused: world.physicsPaused });
    inversionProgressRef.current = advanceOpeningRoom(inversionProgressRef.current, revealStage, delta, active, reducedMotion);
    const appearance = openingRoomAppearance(inversionProgressRef.current);
    roomAppearanceRef.current = appearance;
    const { progress, roomOpacity } = appearance;
    if (ordinaryFloorRef.current) {
      ordinaryFloorRef.current.visible = appearance.floorVisible;
      ordinaryFloorRef.current.position.y = appearance.floorY;
    }
    for (const material of roomMaterials.current) {
      material.opacity = roomOpacity;
      material.depthWrite = roomOpacity > .98;
    }

    if (reflectedForestRef.current) {
      reflectedForestRef.current.position.y = THREE.MathUtils.lerp(-10.5, -6.8, progress);
      const scale = THREE.MathUtils.lerp(0.42, 0.56, progress);
      reflectedForestRef.current.scale.set(scale, THREE.MathUtils.lerp(0.38, 0.54, progress), scale);
    }
    if (roomShellRef.current && roomMaterialRef.current) {
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
      <group ref={ordinaryFloorRef} name="ordinary-timber-yields-with-aperture" visible={roomAppearanceRef.current.floorVisible} position={[0, roomAppearanceRef.current.floorY, 0]}>
        <SceneGround radius={14} color="#171513" roughness={0.42} metalness={0.08} y={-0.12} />
        <OpeningFloorboards count={plankCount} />
      </group>

      <WetFloorReveal stage={revealStage} reducedMotion={reducedMotion} apertureOpacity={() => roomAppearanceRef.current.apertureOpacity} />
      <group ref={reflectedForestRef} name="forest-beneath-wet-reflection" visible={revealStage >= 3} position={[0, -10.5, 0]} scale={[0.42, 0.38, 0.42]}>
        <TreeGrove
          qualityProfile={qualityProfile}
          reducedEffects={reducedEffects}
          tint="#101b1a"
          trunk="#10100f"
          radius={13}
        />
      </group>

      <group ref={roomShellRef} name="ordinary-room-yields-to-forest" visible={roomAppearanceRef.current.roomOpacity > .012}>
        <BrokenRoomDetails />
        <mesh name="broken-floor-room-shell" geometry={roomGeometry} position={[0, 3.18, 0]} receiveShadow>
          <meshStandardMaterial
            key={tactileProgramKey("plaster", tactileDetail)}
            ref={roomMaterialRef}
            onBeforeCompile={shader => applyTactileShader(shader, "plaster", tactileDetail)}
            customProgramCacheKey={() => tactileProgramKey("plaster", tactileDetail)}
            color="#716d62"
            emissive="#21150d"
            emissiveIntensity={0.2}
            roughness={0.99}
            transparent
            opacity={roomAppearanceRef.current.roomOpacity}
            depthWrite={roomAppearanceRef.current.roomOpacity > .98}
            side={THREE.BackSide}
          />
        </mesh>
      </group>

      <group ref={wallRemnantsRef} name="broken-floor-wall-remnants" visible={openingResolved} scale={[1, openingResolved ? 1 : 0.02, 1]}>
        <TimberAssembly plaster color="#46433a" pieces={[
          { position: [-8.1, 2.1, -2.4], size: [.34, 4.4, 11.8] },
          { position: [8.1, 2.1, -2.4], size: [.34, 4.4, 11.8] },
          { position: [0, 2.1, -8.2], size: [16.4, 4.4, .34] },
        ]} />
      </group>

      <group position={[-4.8, 0, -4.1]}>
        <StoneBasin position={[0, .12, 0]} radius={1.05} height={.24} color="#5c5549" metal />
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
        <group visible={revealStage >= 1}>
          <LanternProp position={[0, 0.1, 0]} scale={0.78} reducedMotion={reducedMotion} light={false} />
        </group>
        {/* Keep the existing lamp light in the renderer from the first frame.
            Its former parent transform is .1 + .64 * .78; only geometry hides. */}
        <FlickerLight position={[0, .5992, 0]} color="#ffc778"
          intensity={revealStage >= 1 ? 1.8 : 0} distance={9} reducedMotion={reducedMotion} />
      </group>
      {/* A zero-intensity practical preserves the point-light shader variant
          across both reveal and inversion without lighting the unearned stage. */}
      <FlickerLight
        position={[0, 1.5, 5.6]}
        color="#f1b86a"
        intensity={!openingResolved && revealStage >= 1 ? 1.7 : 0}
        distance={11}
        reducedMotion={reducedMotion}
      />
      <ChapterLightRig family="broken-floor" reducedMotion={reducedMotion} />
      <pointLight position={[0, -2.4, 1]} color="#6da2b8" intensity={reducedEffects ? 0.35 : 0.75} distance={18} />
    </group>
  );
}

export const BrokenFloorChapter = memo(BrokenFloorChapterComponent);
export default BrokenFloorChapter;
