import { LegacyChapterLight } from "../artDirection/LegacyChapterLight";
import { HouseWallDetails } from "../environment/EnvironmentDressing";
import { ChapterLightRig } from "../environment/ChapterLightRig";
import { TactileMaterial } from "../storyEvents/TactileMaterial";
import { CuboidCollider, RigidBody } from "@react-three/rapier";
import { memo, useLayoutEffect, useRef, useMemo, useEffect } from "react";
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { BotanicalBatch, TimberPiece } from "../environmentArt/EnvironmentArt";
import { createTaperedBranchGeometry } from "../environmentArt/authoredGeometry";
import { RestingThrow, TimberAssembly, Upholstery, WindowJoinery } from "./ChapterArt";
import { WindowLinen } from "./DomesticDetails";
import { createStorageCaseGeometry } from "./storageCaseGeometry";
import type { ConstructionPiece } from "./chapterArtGeometry";
import {
  THORNED_HOUSE_MEMORY_OBJECTS as MEMORY_OBJECTS,
  THORNED_HOUSE_MEMORY_SURFACES as MEMORY_SURFACES,
  THORNED_HOUSE_ROOM_MODULES as ROOM_MODULES,
  resolveThornedHouseColliderLayout,
  thornedHouseClutterCount,
  thornedHouseClutterTransform,
  thornedHouseCorridorCount,
  thornedHouseRoomCount,
  thornedHouseSurfaceCount,
  type ThornedHouseExitStage as ExitStage,
  type ThornedHouseStage as HouseStage,
} from "../../../lib/thornedHouseArchitecture";
import { useJourneyStore } from "../../../stores/useJourneyStore";
import {
  Beam,
  CandleField,
  DoorFrame,
  HouseShell,
  KeyProp,
  qualityStep,
  SceneGround,
  ThornBranches,
  type Vec3,
} from "./ChapterPrimitives";
import type { ChapterSceneProps } from "./types";
import { useSceneLook } from "../artDirection/SceneLookContext";
import { houseCeilingLayout, houseClutterInset, housePressureCollider, houseSpatialPressure, houseSurfaceInset } from "./domesticSpatialPressure";

const WALL_MEMORY_MARKS = [
  { position: [-5.32, 2.15, -0.25] as Vec3, rotation: [0, Math.PI / 2, 0] as Vec3, size: [1.2, 1.7] as [number, number] },
  { position: [4.72, 2.02, 1.75] as Vec3, rotation: [0, -Math.PI / 2, 0] as Vec3, size: [1.45, 1.05] as [number, number] },
  { position: [-3.75, 1.86, 3.55] as Vec3, rotation: [0, Math.PI / 2, 0] as Vec3, size: [0.92, 1.38] as [number, number] },
  { position: [3.25, 1.72, 4.92] as Vec3, rotation: [0, -Math.PI / 2, 0] as Vec3, size: [1.1, 0.82] as [number, number] },
  { position: [0, 2.1, 7.18] as Vec3, rotation: [0, 0, 0] as Vec3, size: [1.18, 1.46] as [number, number] },
] as const;

const ARCHITECTURAL_THORNS = [
  { from: [-6.1, 1.1, -2.4] as Vec3, to: [-2.25, 4.5, -0.25] as Vec3 },
  { from: [5.8, 3.85, -1.4] as Vec3, to: [2.2, 0.65, 1.55] as Vec3 },
  { from: [-4.95, 3.45, 1.1] as Vec3, to: [1.1, 3.65, 2.5] as Vec3 },
  { from: [4.55, 0.45, 2.25] as Vec3, to: [-0.7, 3.3, 3.8] as Vec3 },
  { from: [-3.85, 0.35, 4.1] as Vec3, to: [1.55, 3.05, 5.15] as Vec3 },
  { from: [3.45, 3.0, 4.45] as Vec3, to: [-1.2, 0.5, 5.95] as Vec3 },
  { from: [-2.9, 2.7, 5.65] as Vec3, to: [1.25, 2.92, 6.68] as Vec3 },
  { from: [2.7, 0.25, 6.0] as Vec3, to: [-0.9, 2.7, 7.0] as Vec3, blocksExit: true },
  { from: [-2.45, 0.55, 6.6] as Vec3, to: [1.1, 2.6, 7.34] as Vec3, blocksExit: true },
  { from: [1.95, 2.55, 6.72] as Vec3, to: [-1.6, 1.1, 7.5] as Vec3, blocksExit: true },
] as const;

const GARDEN_FLOWERS = [
  [-4.5, 0.22, -4.18],
  [-3.25, 0.2, -3.72],
  [-1.85, 0.24, -4.22],
  [1.85, 0.2, -3.75],
  [3.15, 0.23, -4.2],
  [4.45, 0.2, -3.68],
  [-0.85, 0.22, -4.5],
  [0.8, 0.24, -4.42],
] as const;

function ModularRooms({ stage, detail, reducedEffects }: { stage: HouseStage; detail: number; reducedEffects: boolean }) {
  const count = thornedHouseRoomCount(detail, reducedEffects);
  const compression = stage === "bedroom" ? 1 : stage === "garden" ? 0.42 : 0.68;

  const pieces = useMemo(() => {
    const walls: ConstructionPiece[] = [], lintels: ConstructionPiece[] = [];
    ROOM_MODULES.slice(0, count).forEach((room, index) => {
      const width = room.width - compression * index * .22, height = room.height - compression * index * .1;
      const depth = index === 0 ? 1.65 : 1.2;
      for (const side of [-1, 1]) walls.push({ position: [room.offset * compression + side * width / 2, height / 2, room.z], size: [.26, height, depth], color: index % 2 ? "#8b857b" : "#b2aa9c" });
      lintels.push({ position: [room.offset * compression, height, room.z], size: [width + .26, .22, depth] });
    });
    return { walls, lintels };
  }, [count, compression]);
  return <group name="thorned-house-modular-rooms">
    <TimberAssembly pieces={pieces.walls} plaster color="#8c867a" />
    <TimberAssembly pieces={pieces.lintels} color="#493a30" />
  </group>;
}

function RepeatingHall({ stage, detail, reducedEffects }: { stage: HouseStage; detail: number; reducedEffects: boolean }) {
  const count = thornedHouseCorridorCount(detail, reducedEffects);
  const compressed = stage === "bedroom";
  return (
    <group name="thorned-house-repeating-corridor" position={[0, 0, -1.65]}>
      {ROOM_MODULES.slice(0, count).map((_, index) => {
        const progress = count <= 1 ? 0 : index / (count - 1);
        const z = index * 1.52;
        const narrowing = compressed ? progress * 1.12 : stage === "leaving" ? -progress * 0.3 : progress * 0.38;
        return (
          <group key={index} position={[Math.sin(index * 1.7) * (compressed ? 0.18 : 0.08), 0, z]}>
            <DoorFrame
              width={3.7 - narrowing}
              height={4.25 - Math.max(0, narrowing) * 1.08}
              depth={0.3}
              color={index % 2 === 0 ? "#49372e" : "#3e3029"}
            />
          </group>
        );
      })}
      <mesh position={[0, -0.04, 2.75]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[stage === "bedroom" ? 3.05 : 3.6, 10.5]} />
        <meshStandardMaterial color="#382d27" roughness={1} />
      </mesh>
    </group>
  );
}

function CompressionCeiling({ pressure, detail, reducedEffects }: { pressure: number; detail: number; reducedEffects: boolean }) {
  const pieces = useMemo(() => houseCeilingLayout(pressure, thornedHouseCorridorCount(detail, reducedEffects)), [pressure, detail, reducedEffects]);
  return <group name="house-occupied-overhead-space" userData={{ pressure, minimumHeadroom: 2.25 }}>
    <TimberAssembly pieces={pieces} color="#655e52" />
  </group>;
}

function RefilledSurfaces({
  pressure,
  stage,
  detail,
  reducedEffects,
  cleared,
  refilled,
  reorganisationReleased,
}: {
  pressure: number;
  stage: HouseStage;
  detail: number;
  reducedEffects: boolean;
  cleared: boolean;
  refilled: boolean;
  reorganisationReleased: boolean;
}) {
  const clutterRef = useRef<THREE.InstancedMesh>(null);
  const fittingsRef = useRef<THREE.InstancedMesh>(null);
  const clutterGeometry = useMemo(createStorageCaseGeometry, []);
  useEffect(() => () => { clutterGeometry.wood.dispose(); clutterGeometry.fittings.dispose(); }, [clutterGeometry]);
  const surfaceCount = thornedHouseSurfaceCount(stage, reducedEffects);
  const clutterCount = thornedHouseClutterCount({
    stage,
    detail,
    reducedEffects,
    cleared,
    refilled,
  });

  useLayoutEffect(() => {
    const dummy = new THREE.Object3D();
    for (let index = 0; index < clutterCount; index += 1) {
      const transform = thornedHouseClutterTransform(
        index,
        stage,
        reorganisationReleased,
      );
      if (!transform) continue;
      dummy.position.set(transform.position[0] + houseClutterInset(index, pressure), transform.position[1], transform.position[2]);
      dummy.rotation.set(...transform.rotation);
      dummy.scale.set(...transform.size);
      dummy.updateMatrix();
      clutterRef.current?.setMatrixAt(index, dummy.matrix);
      fittingsRef.current?.setMatrixAt(index, dummy.matrix);
    }
    for (const mesh of [clutterRef.current, fittingsRef.current]) if (mesh) {
      mesh.instanceMatrix.needsUpdate = true; mesh.computeBoundingSphere(); mesh.computeBoundingBox();
    }
  }, [clutterCount, reorganisationReleased, stage, pressure]);

  return (
    <group name="thorned-house-refilled-surfaces">
      {MEMORY_SURFACES.slice(0, surfaceCount).map((surface, index) => (
        <group key={surface.position.join(":")} position={[houseSurfaceInset(index, pressure), 0, 0]}>
          <TimberPiece position={surface.position} size={surface.size} seed={index} color={index % 2 === 0 ? "#614738" : "#49362d"} />
          <TimberAssembly name="memory-table-four-legs-and-apron" color="#79604b" pieces={[
            ...[-1, 1].flatMap(x => [-1, 1].map(z => ({
              position: [surface.position[0] + x * surface.size[0] * .37, (surface.position[1] - surface.size[1] / 2) / 2, surface.position[2] + z * surface.size[2] * .35] as Vec3,
              size: [.1, surface.position[1] - surface.size[1] / 2, .1] as Vec3,
            }))),
            ...[-1, 1].map(z => ({ position: [surface.position[0], surface.position[1] - .16, surface.position[2] + z * surface.size[2] * .35] as Vec3, size: [surface.size[0] * .78, .18, .065] as Vec3 })),
          ]} />
        </group>
      ))}
      <instancedMesh name="memory-storage-cases" ref={clutterRef} geometry={clutterGeometry.wood} args={[undefined, undefined, clutterCount]} castShadow={!reducedEffects} receiveShadow>
        <TactileMaterial surface="wood" color="#867660" roughness={.86} vertexColors />
      </instancedMesh>
      <instancedMesh name="memory-storage-case-grips" ref={fittingsRef} geometry={clutterGeometry.fittings} args={[undefined, undefined, clutterCount]} receiveShadow>
        <TactileMaterial surface="metal" color="#7b7568" metalness={.42} roughness={.68} />
      </instancedMesh>
      {WALL_MEMORY_MARKS.slice(0, reducedEffects ? 2 : 3 + Math.min(2, detail)).map((memory, index) => (
        <mesh key={memory.position.join(":")} position={memory.position} rotation={memory.rotation}>
          <planeGeometry args={memory.size} />
          <meshStandardMaterial
            color={index % 2 === 0 ? "#2f2724" : "#6b4f46"}
            roughness={0.98}
            transparent
            opacity={stage === "garden" ? 0.56 : 0.88}
          />
        </mesh>
      ))}
    </group>
  );
}

function ThornedHouseCollisionArchitecture({
  pressure,
  stage,
  exitStage,
  detail,
  reducedEffects,
  shellSize,
  cleared,
  refilled,
  reorganisationReleased,
}: {
  pressure: number;
  stage: HouseStage;
  exitStage: ExitStage;
  detail: number;
  reducedEffects: boolean;
  shellSize: Vec3;
  cleared: boolean;
  refilled: boolean;
  reorganisationReleased: boolean;
}) {
  const colliderSpecs = resolveThornedHouseColliderLayout({
    stage,
    exitStage,
    detail,
    reducedEffects,
    shellSize,
    cleared,
    refilled,
    reorganisationReleased,
  }).filter(spec => !(cleared && spec.id === "locked-garden-door"))
    .map(spec => housePressureCollider(spec, pressure));

  return (
    <RigidBody
      name="thorned-house-fixed-collision"
      type="fixed"
      colliders={false}
      userData={{ colliderCount: colliderSpecs.length, exitStage }}
    >
      {colliderSpecs.map((spec) => (
        <CuboidCollider
          key={spec.id}
          name={`thorned-house-${spec.role}:${spec.id}`}
          args={spec.args}
          position={spec.position}
          rotation={spec.rotation}
          friction={0.92}
          restitution={0}
        />
      ))}
    </RigidBody>
  );
}

function ArchitecturalThorns({ stage, detail, reducedEffects }: { stage: HouseStage; detail: number; reducedEffects: boolean }) {
  const count = reducedEffects ? 5 : Math.min(ARCHITECTURAL_THORNS.length, 6 + detail);
  const branches = ARCHITECTURAL_THORNS
    .slice(0, count)
    // Once leaving, keep the wall-grown thorns but clear the visible walking
    // corridor as well as the threshold; these decorative branches have no collider.
    .filter((branch, index) => stage !== "leaving" || (index < 2 && !("blocksExit" in branch && branch.blocksExit)));

  const geometry = useMemo(() => {
    const pieces: THREE.BufferGeometry[] = [];
    branches.forEach((branch, index) => {
      const midpoint: Vec3 = [(branch.from[0] + branch.to[0]) / 2, (branch.from[1] + branch.to[1]) / 2 + .2, (branch.from[2] + branch.to[2]) / 2 + .12];
      pieces.push(createTaperedBranchGeometry([branch.from, midpoint, branch.to], .075 + index % 3 * .018, index));
      if (index < (reducedEffects ? 2 : 3 + detail)) pieces.push(createTaperedBranchGeometry([branch.to, [branch.to[0] + (index % 2 ? -.62 : .62), branch.to[1] - .78, branch.to[2] + .34]], .036, index));
    });
    const merged = mergeGeometries(pieces, false)!; pieces.forEach(piece => piece.dispose()); return merged;
  }, [stage, detail, reducedEffects]);
  useEffect(() => () => geometry.dispose(), [geometry]);
  return <group name="thorned-house-invasive-thorns">
    <mesh geometry={geometry}><TactileMaterial surface="bark" color={stage === "leaving" ? "#49382e" : "#251916"} roughness={.96} /></mesh>
  </group>;
}

function ExitThreshold({ stage }: { stage: ExitStage; reducedEffects: boolean }) {
  const openAmount = stage === "sealed" ? 0 : stage === "glimpsed" ? 0.24 : 1.12;
  const glow = stage === "open" ? "#eed6a7" : stage === "glimpsed" ? "#846c50" : "#17110f";
  return (
    <group name={`thorned-house-exit:${stage}`} position={[0, 0, 7.35]}>
      {stage !== "open" ? <mesh position={[0, 2.3, 0.08]}>
        <planeGeometry args={[3.7, 4.65]} />
        <meshStandardMaterial
          color={glow}
          emissive={glow}
          emissiveIntensity={stage === "glimpsed" ? 0.06 : 0}
          roughness={0.86}
          side={THREE.DoubleSide}
        />
      </mesh> : null}
      <DoorFrame width={4.25} height={4.9} depth={0.54} color="#5a4436" />
      {stage === "open" ? null : (
        <group position={[-1.72, 2.18, -0.1]} rotation={[0, -openAmount, 0]}>
          <TimberAssembly color="#4c3d31" pieces={[
            ...Array.from({ length: 6 }, (_, i) => ({ position: [.286 + i * .5733, 0, 0] as Vec3, size: [.56, 4.34, .17] as Vec3 })),
            ...[-1.42, 1.42].map(y => ({ position: [1.72, y, -.087] as Vec3, size: [3.38, .18, .026] as Vec3 })),
          ]} />
          <mesh position={[3.1, 0, -0.15]}>
            <sphereGeometry args={[0.09, 8, 6]} />
            <meshStandardMaterial color="#b38a4f" metalness={0.72} roughness={0.3} />
          </mesh>
        </group>
      )}
      {stage === "open" ? (
        <>
          <LegacyChapterLight><pointLight position={[0, 2.8, 1.5]} color="#cbd8d9" intensity={1.45} distance={15} /></LegacyChapterLight>
        </>
      ) : null}
    </group>
  );
}

function LockedGarden({ reducedEffects, entryOpen }: { reducedEffects: boolean; entryOpen: boolean }) {
  return (
    <group name="thorned-house-locked-garden">
      <DoorFrame position={[0, 0, -3.62]} width={4.2} height={5.05} depth={0.55} color="#49372d" open={entryOpen} />
      <BotanicalBatch kind="rose" seed={43} color="#965e67" placements={GARDEN_FLOWERS.slice(0, reducedEffects ? 5 : GARDEN_FLOWERS.length).map(position => ({ position: [position[0], position[1] - .16, position[2]], scale: 1.1 }))} />
    </group>
  );
}

function OldMemoryBedroom({ reducedEffects }: { reducedEffects: boolean }) {
  return (
    <group name="thorned-house-old-memory-bedroom" position={[-3.22, 0.36, 2.72]}>
      <TimberAssembly color="#594136" pieces={[
        ...[-1, 1].map(side => ({ position: [0, .5, side * 1.24] as Vec3, size: [4.05, .38, .14] as Vec3 })),
        ...[-1, 1].map(side => ({ position: [side * 1.94, .24, 0] as Vec3, size: [.16, 1.2, 2.62] as Vec3 })),
        ...[-1, 1].flatMap(x => [-1, 1].map(z => ({ position: [x * 1.86, .03, z * 1.16] as Vec3, size: [.18, .78, .18] as Vec3 }))),
      ]} />
      <Upholstery position={[0, .76, -.08]} size={[3.9, .14, 2.48]} color="#9c8f7e" surface="linen" />
      <Upholstery position={[-1.28, .9, -.03]} size={[.8, .15, 1.5]} color="#bab19c" surface="linen" />
      <RestingThrow position={[.48, .85, -.12]} size={[2.1, 2.9]} maxDrop={.57} color="#817c69" />
      {MEMORY_OBJECTS.slice(14, reducedEffects ? 17 : 20).map((_, index) => (
        <mesh key={index} position={[-1.25 + index * 0.68, 0.12 + (index % 2) * 0.06, 1.68 + (index % 3) * 0.32]} rotation={[0, index * 0.56, 0]}>
          <boxGeometry args={[0.54 + (index % 2) * 0.18, 0.22 + (index % 3) * 0.08, 0.7]} />
          <meshStandardMaterial color="#29211e" roughness={1} />
        </mesh>
      ))}
    </group>
  );
}

function DarkeningWindows({ stage }: { stage: HouseStage }) {
  const width = stage === "bedroom" ? 1 : 1.35, height = stage === "bedroom" ? 1.58 : 2.1;
  const color = stage === "garden" ? "#785d49" : stage === "bedroom" ? "#100d0c" : "#89908b";
  const emissiveIntensity = stage === "leaving" ? 0.28 : stage === "garden" ? 0.04 : 0;
  return (
    <group name="thorned-house-darkening-windows">
      {[-1, 1].map((side) => (
        <group key={side} position={[side * 5.65, 2.55, 1.1]} rotation={[0, side * -Math.PI / 2, 0]}>
          <mesh><planeGeometry args={[width, height]} /><meshStandardMaterial color={color} emissive={color} emissiveIntensity={emissiveIntensity} roughness={.72} side={THREE.DoubleSide} /></mesh>
          <group rotation={[0, Math.PI, 0]}><WindowJoinery width={width} height={height} color="#584535" linenRail /></group>
          <group rotation={[0, Math.PI, 0]}><WindowLinen width={width} height={height} color={stage === "leaving" ? "#b4ab93" : "#938675"} railInJoinery /></group>
        </group>
      ))}
    </group>
  );
}

function ThornedHouseChapterComponent({
  scene,
  qualityProfile,
  reducedEffects,
  reducedMotion,
}: ChapterSceneProps) {
  const isGarden = scene.id === "thorned.locked-garden";
  const isBedroom = scene.id === "thorned.old-memory-bedroom";
  const isLeaving = scene.id === "thorned.self-owned-world";
  const stage: HouseStage = isBedroom ? "bedroom" : isLeaving ? "leaving" : "garden";
  const presentation = useSceneLook();
  const acceptedCompression = useJourneyStore(journey => {
    const table = journey.storyObjectStates["thorn-house.table"];
    return table === "refilled-twice" || table === "waiting-again" ? 1 : table === "refilled" ? .5 : 0;
  });
  const pressure = houseSpatialPressure(Math.max(presentation?.look.emotional.pathCompression ?? 0, acceptedCompression * .6), isLeaving);
  const detail = qualityStep(qualityProfile);
  const shellSize: Vec3 = stage === "garden" ? [13.5, 5.45, 11] : stage === "bedroom" ? [12.2, 4.75, 11.8] : [12.8, 5.05, 11.4];
  const thornDensity = reducedEffects ? 0.34 : stage === "bedroom" ? 1 : stage === "garden" ? 0.72 : 0.48;
  const spaceCleared = useJourneyStore(
    (journey) => journey.worldFlags["thorn-house.space-cleared"] === true,
  );
  const spaceRefilled = useJourneyStore(
    (journey) => journey.worldFlags["thorn-house.space-refilled"] === true,
  );
  const reorganisationReleased = useJourneyStore(
    (journey) => journey.worldFlags["thorn-house.reorganisation-released"] === true,
  );
  const exitCrossed = useJourneyStore(
    (journey) => journey.worldFlags["thorn-house.exit-crossed"] === true,
  );
  const thornDoorOpen = useJourneyStore(
    (journey) => journey.worldFlags["thorn-door.open"] === true,
  );
  const houseExitOpen = useJourneyStore(
    (journey) => journey.worldFlags["path.house-exit-open"] === true,
  );
  const exitUnlocked = thornDoorOpen || houseExitOpen || exitCrossed;
  const exitStage: ExitStage = isBedroom
    ? "glimpsed"
    : isLeaving && exitUnlocked
      ? "open"
      : isLeaving
        ? "glimpsed"
        : "sealed";

  return (
    <group name={`thorned-house:${stage}`}>
      <SceneGround radius={17} color="#30251e" />
      <HouseShell rearOpening={4.6} position={[0, 0, 2.35]} size={shellSize} wallColor={stage === "bedroom" ? "#44352e" : "#4f3d31"} roofColor="#211b18" />
      <ThornedHouseCollisionArchitecture
        pressure={pressure}
        stage={stage}
        exitStage={exitStage}
        detail={detail}
        reducedEffects={reducedEffects}
        shellSize={shellSize}
        cleared={spaceCleared}
        refilled={spaceRefilled}
        reorganisationReleased={reorganisationReleased}
      />
      <ModularRooms stage={stage} detail={detail} reducedEffects={reducedEffects} />
      <HouseWallDetails stage={stage} detail={detail} reducedEffects={reducedEffects} />
      <RepeatingHall stage={stage} detail={detail} reducedEffects={reducedEffects} />
      <CompressionCeiling pressure={pressure} detail={detail} reducedEffects={reducedEffects} />
      <RefilledSurfaces
        pressure={pressure}
        stage={stage}
        detail={detail}
        reducedEffects={reducedEffects}
        cleared={spaceCleared}
        refilled={spaceRefilled}
        reorganisationReleased={reorganisationReleased}
      />
      <DarkeningWindows stage={stage} />
      <ThornBranches density={thornDensity} color={isLeaving ? "#44342b" : "#2b1d1a"} />
      <ArchitecturalThorns stage={stage} detail={detail} reducedEffects={reducedEffects} />

      {isGarden ? <LockedGarden reducedEffects={reducedEffects} entryOpen={spaceCleared} /> : null}
      {isBedroom ? <OldMemoryBedroom reducedEffects={reducedEffects} /> : null}
      <ExitThreshold stage={exitStage} reducedEffects={reducedEffects} />

      {isLeaving ? (
        <KeyProp
          position={[-1.15, exitCrossed ? 1.38 : 1.14, 5.95]}
          color={exitCrossed ? "#b8a077" : "#9a825d"}
          scale={exitCrossed ? 1.24 : 1.1}
        />
      ) : null}

      <CandleField
        qualityProfile={qualityProfile}
        reducedEffects={reducedEffects}
        count={stage === "garden" ? 5 : 3}
        radius={stage === "bedroom" ? 4.2 : 5.8}
        color="#e5aa68"
      />
      <ChapterLightRig family="thorned-house" reducedMotion={reducedMotion} />
      <LegacyChapterLight><hemisphereLight args={[stage === "leaving" ? "#b9b6a3" : "#8b7460", "#1a1210", reducedEffects ? 0.14 : 0.24]} /></LegacyChapterLight>
    </group>
  );
}

export const ThornedHouseChapter = memo(ThornedHouseChapterComponent);
export default ThornedHouseChapter;
