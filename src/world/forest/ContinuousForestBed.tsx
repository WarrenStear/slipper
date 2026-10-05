import { claimForestBuild } from "../../lib/forestBuildSchedule.ts";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CuboidCollider, RigidBody } from "@react-three/rapier";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { createForestTrunkGeometry, createOrganicCrownGeometry } from "../../components/three/environment/forestGeometry.ts";
import { ForestSurfaceMaterial } from "../../components/three/environment/ForestSurfaceMaterial";
import type { Slipper3DEntry } from "../../data/slipper3dTypes.ts";
import type { ForestPathSeed, ForestWorkerConfig, ForestWorkerResponse, PackedForestCollider } from "../../workers/forestWorker.types";
import { resolveWorldVisualState } from "../../components/three/worldVisualState.ts";
import { type RenderQualityProfile } from "../../components/three/renderQuality.ts";
import { curvedPathTangentAt, type MazePathSegment } from "../terrain/worldPaths.ts";
import { type NarrativeWorldState } from "../worldTypes.ts";
import { useSafeForestTextures } from "./useForestTextures.ts";
import { packForestClearingSeeds, packForestPathSeeds, terrainElevationAtPoint } from "../terrain/terrainSampler.ts";
import { entryWorldPosition } from "../terrain/worldPlacement.ts";
import { CORRIDOR_BASE_WIDTH, CORRIDOR_MIN_WIDTH, CROWNED_RETURN_RAMP_WIDTH, FOREST_CLEARING_RADIUS, TERRAIN_BASE_Y, TERRAIN_COLLIDER_Y, TERRAIN_SEGMENTS, TERRAIN_SIZE } from "../terrain/worldConstants.ts";
import { FOREST_CELL_RADIUS, FOREST_CELL_SIZE, FOREST_INSTANCE_COUNT, FOREST_TREES_PER_CELL, TREE_COLLIDER_LIMIT } from "./forestConstants.ts";
import { HillyForestGround } from "../terrain/HillyForestGround.tsx";
import { ClearingForestFrame } from "./ClearingForestFrame.tsx";
import { hashString } from "../worldMath.ts";

export function ContinuousForestBed({
  entries,
  pathSegments,
  narrativeWorldState,
  activeEntry,
  qualityProfile,
  showClearingFrame = true,
  renderVisible = true,
}: {
  entries: Slipper3DEntry[];
  pathSegments: MazePathSegment[];
  narrativeWorldState: NarrativeWorldState;
  activeEntry: Slipper3DEntry;
  qualityProfile: RenderQualityProfile;
  showClearingFrame?: boolean;
  renderVisible?: boolean;
}) {
  const { camera } = useThree();

  const trunkRef = useRef<THREE.InstancedMesh>(null);
  const crownRef = useRef<THREE.InstancedMesh>(null);
  const marshRef = useRef<THREE.InstancedMesh>(null);
  const ruinRef = useRef<THREE.InstancedMesh>(null);
  const trunkGeometry = useMemo(() => createForestTrunkGeometry(), []);
  const crownGeometry = useMemo(() => createOrganicCrownGeometry(qualityProfile.quality === "high" || qualityProfile.quality === "cinematic" ? 2 : 0), [qualityProfile.quality]);
  const clearingCrownGeometry = useMemo(() => createOrganicCrownGeometry(qualityProfile.quality === "low" ? 0 : 1), [qualityProfile.quality]);

  const workerRef = useRef<Worker | null>(null);
  const [workerError, setWorkerError] = useState<Error | null>(null);
  const requestIdRef = useRef(0);
  const lastCellRef = useRef({
    cellX: Number.NaN,
    cellZ: Number.NaN,
    depth: Number.NaN,
    pressure: Number.NaN,
    entryCount: Number.NaN,
    quality: "",
    forestDensity: Number.NaN,
    pathClarity: Number.NaN,
  });
  const visualState = useMemo(
    () => resolveWorldVisualState({ entry: activeEntry, narrativeWorldState }),
    [activeEntry, narrativeWorldState],
  );

  // Safe procedural fallback textures prevent a black screen when production KTX2 assets
  // have not yet been uploaded to /public/textures/forest. The material slots remain
  // compatible with real map/normal/roughness textures later.
  const forestTextures = useSafeForestTextures();

  const [treeColliders, setTreeColliders] = useState<PackedForestCollider[]>([]);

  const clearingSeeds = useMemo(() => packForestClearingSeeds(entries), [entries]);

  const pathSeeds = useMemo<ForestPathSeed[]>(
    () => packForestPathSeeds(pathSegments, entries),
    [entries, pathSegments],
  );
  const activePosition = useMemo(
    () => entryWorldPosition(activeEntry, entries),
    [activeEntry, entries],
  );
  const forestTerrainMorph = useMemo(
    () => ({
      memoryPressure: narrativeWorldState.memoryPressure,
      explorationDepth: narrativeWorldState.explorationDepth,
    }),
    [narrativeWorldState.explorationDepth, narrativeWorldState.memoryPressure],
  );
  const forestGroundYAt = useCallback(
    (x: number, z: number) =>
      TERRAIN_BASE_Y + terrainElevationAtPoint(x, z, entries, pathSegments, forestTerrainMorph),
    [entries, forestTerrainMorph, pathSegments],
  );
  const clearingOpeningAngles = useMemo(() => {
    const angles: number[] = [];
    const morph = {
      memoryPressure: narrativeWorldState.memoryPressure,
      explorationDepth: narrativeWorldState.explorationDepth,
    };

    for (const segment of pathSegments) {
      const activeIsSource = segment.sourceEntry.id === activeEntry.id;
      const activeIsTarget = segment.targetEntry.id === activeEntry.id;
      if (!activeIsSource && !activeIsTarget) continue;
      const tangent = curvedPathTangentAt(segment, activeIsSource ? 0 : 1, morph);
      if (activeIsTarget) tangent.multiplyScalar(-1);
      const angle = Math.atan2(tangent.y, tangent.x);
      const duplicatesExisting = angles.some((candidate) =>
        Math.abs(Math.atan2(Math.sin(angle - candidate), Math.cos(angle - candidate))) < 0.16,
      );
      if (!duplicatesExisting) angles.push(angle);
    }

    return angles;
  }, [
    activeEntry.id,
    narrativeWorldState.explorationDepth,
    narrativeWorldState.memoryPressure,
    pathSegments,
  ]);

  useEffect(() => () => trunkGeometry.dispose(), [trunkGeometry]);
  useEffect(() => () => crownGeometry.dispose(), [crownGeometry]);
  useEffect(() => () => clearingCrownGeometry.dispose(), [clearingCrownGeometry]);

  useEffect(() => {
    for (const mesh of [trunkRef.current, crownRef.current, marshRef.current, ruinRef.current]) {
      if (!mesh) continue;
      mesh.count = 0;
      mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    }

    const worker = new Worker(new URL("../../workers/forestWorker.ts", import.meta.url), { type: "module" });
    workerRef.current = worker;
    const handleWorkerFailure = () => {
      setWorkerError(new Error("The forest could not be prepared. Please reload or continue with the text journey."));
    };
    worker.addEventListener("error", handleWorkerFailure);
    worker.addEventListener("messageerror", handleWorkerFailure);

    worker.onmessage = (event: MessageEvent<ForestWorkerResponse>) => {
      const result = event.data;
      if (result.type !== "FOREST_READY" || result.requestId !== requestIdRef.current) return;

      const meshes = [
        { mesh: trunkRef.current, matrices: result.trunkMatrices, colors: result.trunkColors, count: result.trunkCount },
        { mesh: crownRef.current, matrices: result.crownMatrices, colors: result.crownColors, count: result.crownCount },
        { mesh: marshRef.current, matrices: result.marshMatrices, colors: result.marshColors, count: result.marshCount },
        { mesh: ruinRef.current, matrices: result.ruinMatrices, colors: result.ruinColors, count: result.ruinCount },
      ];

      for (const item of meshes) {
        if (!item.mesh) continue;
        item.mesh.count = Math.min(item.count, FOREST_INSTANCE_COUNT);
        item.mesh.instanceMatrix.array.set(item.matrices);
        item.mesh.instanceMatrix.needsUpdate = true;

        if (!item.mesh.instanceColor) {
          item.mesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(FOREST_INSTANCE_COUNT * 3), 3);
        }

        item.mesh.instanceColor.array.set(item.colors);
        item.mesh.instanceColor.needsUpdate = true;
        item.mesh.computeBoundingBox();
        item.mesh.computeBoundingSphere();
      }

      setTreeColliders(result.colliders);
    };

    return () => {
      worker.removeEventListener("error", handleWorkerFailure);
      worker.removeEventListener("messageerror", handleWorkerFailure);
      worker.onmessage = null;
      worker.terminate();
      workerRef.current = null;
    };
  }, []);

  const requestForestBuild = (cellX: number, cellZ: number) => {
    const worker = workerRef.current;
    if (!worker) return;

    requestIdRef.current += 1;

    const config: ForestWorkerConfig = {
      cellSize: FOREST_CELL_SIZE,
      cellRadius: Math.min(FOREST_CELL_RADIUS, qualityProfile.forestCellRadius),
      treesPerCell: Math.min(FOREST_TREES_PER_CELL, qualityProfile.treesPerCell),
      instanceCount: FOREST_INSTANCE_COUNT,
      clearingSafeRadius: FOREST_CLEARING_RADIUS,
      corridorBaseWidth: CORRIDOR_BASE_WIDTH,
      corridorMinWidth: CORRIDOR_MIN_WIDTH,
      treeColliderLimit: TREE_COLLIDER_LIMIT,
      terrainBaseY: TERRAIN_BASE_Y,
      terrainColliderY: TERRAIN_COLLIDER_Y,
      terrainSize: TERRAIN_SIZE,
      terrainSegments: TERRAIN_SEGMENTS,
      crownedRampWidth: CROWNED_RETURN_RAMP_WIDTH,
      cameraX: camera.position.x,
      cameraZ: camera.position.z,
      cellX,
      cellZ,
      explorationDepth: narrativeWorldState.explorationDepth,
      memoryPressure: narrativeWorldState.memoryPressure,
      forestDensity: visualState.director.forestDensity,
      pathClarity: visualState.pathClarity,
      clearings: clearingSeeds,
      paths: pathSeeds,
    };

    worker.postMessage({ type: "BUILD_FOREST", requestId: requestIdRef.current, config });
  };

  useFrame(() => {
    const cameraPosition = camera.position;
    const cellX = Math.floor(cameraPosition.x / FOREST_CELL_SIZE);
    const cellZ = Math.floor(cameraPosition.z / FOREST_CELL_SIZE);
    const depth = Math.round(narrativeWorldState.explorationDepth * 100);
    const pressure = Math.round(narrativeWorldState.memoryPressure * 100);
    const entryCount = entries.length;
    const quality = qualityProfile.quality;
    const forestDensity = Math.round(visualState.director.forestDensity * 100);
    const pathClarity = Math.round(visualState.pathClarity * 100);
    // A frame may precede passive effects; only a ready worker can claim a cell.
    if (!claimForestBuild(
      workerRef.current !== null, lastCellRef.current,
      cellX, cellZ, depth, pressure, entryCount, quality, forestDensity, pathClarity,
    )) return;

    requestForestBuild(cellX, cellZ);
  });

  if (workerError) throw workerError;

  return (
    <group>
      <RigidBody type="fixed" colliders={false}>
        {treeColliders.map((collider, index) => (
          <CuboidCollider key={`forest-collider-${index}`} args={collider.args} position={collider.position} friction={1.4} />
        ))}
      </RigidBody>

      <HillyForestGround renderVisible={renderVisible} qualityProfile={qualityProfile} entries={entries} pathSegments={pathSegments} narrativeWorldState={narrativeWorldState} visualState={visualState} textures={forestTextures} />
      {/* Keep terrain/forest workers and collisions mounted while the opening
          room occludes the exterior; only its visual submissions are deferred. */}
      <group name="continuous-forest-visuals" visible={renderVisible}>
      {showClearingFrame ? (
        <ClearingForestFrame
          center={activePosition}
          openingAngles={clearingOpeningAngles}
          visualState={visualState}
          qualityProfile={qualityProfile}
          textures={forestTextures}
          seed={hashString(`${activeEntry.id}-clearing-frame`)}
          trunkGeometry={trunkGeometry}
          crownGeometry={clearingCrownGeometry}
          groundYAt={forestGroundYAt}
        />
      ) : null}
      <instancedMesh name="continuous-forest-trunks" ref={trunkRef} args={[trunkGeometry, undefined, FOREST_INSTANCE_COUNT]} frustumCulled castShadow={qualityProfile.enableMoonShadows} receiveShadow>
        <ForestSurfaceMaterial finish="bark" qualityProfile={qualityProfile} map={forestTextures.barkMap} vertexColors color="#948579" emissive={visualState.palette.trunk} emissiveIntensity={0.03} />
      </instancedMesh>

      <instancedMesh name="continuous-forest-crowns" ref={crownRef} args={[crownGeometry, undefined, FOREST_INSTANCE_COUNT]} frustumCulled castShadow={qualityProfile.enableMoonShadows} receiveShadow>
        <ForestSurfaceMaterial finish="canopy" qualityProfile={qualityProfile} map={forestTextures.crownMap} vertexColors color="#dce4d8" emissive={visualState.palette.leaf} emissiveIntensity={0.03} />
      </instancedMesh>

      <instancedMesh ref={marshRef} args={[undefined, undefined, FOREST_INSTANCE_COUNT]} frustumCulled receiveShadow>
        <circleGeometry args={[1, 24]} />
        <meshStandardMaterial map={forestTextures.marshMap} normalMap={forestTextures.marshNormalMap} roughnessMap={forestTextures.marshRoughnessMap} vertexColors color={visualState.palette.accent} emissive={visualState.palette.emissive} emissiveIntensity={0.07} metalness={0.22} roughness={0.28} transparent opacity={0.28 * visualState.semanticOpacity} side={THREE.DoubleSide} depthWrite={false} />
      </instancedMesh>

      <instancedMesh ref={ruinRef} args={[undefined, undefined, FOREST_INSTANCE_COUNT]} frustumCulled castShadow receiveShadow>
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial map={forestTextures.ruinMap} normalMap={forestTextures.ruinNormalMap} roughnessMap={forestTextures.ruinRoughnessMap} vertexColors color="#ffffff" roughness={0.9} metalness={0.045} transparent opacity={0.64 * visualState.semanticOpacity} />
      </instancedMesh>
      </group>
    </group>
  );
}

