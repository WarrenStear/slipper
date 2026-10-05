import { applyTerrainSurface, createTerrainGeometry, terrainColliderIndices } from "./terrainGeometry.ts";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { RigidBody, TrimeshCollider } from "@react-three/rapier";
import * as THREE from "three";
import { ForestSurfaceMaterial } from "../../components/three/environment/ForestSurfaceMaterial";
import type { Slipper3DEntry } from "../../data/slipper3dTypes.ts";
import type { ForestWorkerResponse, TerrainWorkerConfig } from "../../workers/forestWorker.types";
import { type WorldVisualState } from "../../components/three/worldVisualState.ts";
import { type RenderQualityProfile } from "../../components/three/renderQuality.ts";
import { type MazePathSegment } from "./worldPaths.ts";
import { type NarrativeWorldState } from "../worldTypes.ts";
import { type ForestTexturePack } from "../forest/useForestTextures.ts";
import { CORRIDOR_BASE_WIDTH, CROWNED_RETURN_RAMP_WIDTH, FOREST_CLEARING_RADIUS, TERRAIN_BASE_Y, TERRAIN_SEGMENTS, TERRAIN_SIZE } from "./worldConstants.ts";
import { packForestClearingSeeds, packForestPathSeeds } from "./terrainSampler.ts";

export function HillyForestGround({
  entries,
  pathSegments,
  narrativeWorldState,
  visualState,
  textures,
  qualityProfile,
  renderVisible = true,
}: {
  entries: Slipper3DEntry[];
  pathSegments: MazePathSegment[];
  narrativeWorldState: NarrativeWorldState;
  visualState: WorldVisualState;
  textures: ForestTexturePack;
  qualityProfile: RenderQualityProfile;
  renderVisible?: boolean;
}) {
  const geometry = useMemo(createTerrainGeometry, []);

  const workerRef = useRef<Worker | null>(null);
  const [workerError, setWorkerError] = useState<Error | null>(null);
  const requestIdRef = useRef(0);
  const colliderRevisionRef = useRef(0);
  const clearingSeeds = useMemo(() => packForestClearingSeeds(entries), [entries]);
  const pathSeeds = useMemo(() => packForestPathSeeds(pathSegments, entries), [entries, pathSegments]);
  const terrainShapeToken = useMemo(
    () => ({}),
    [
      clearingSeeds,
      narrativeWorldState.explorationDepth,
      narrativeWorldState.memoryPressure,
      pathSeeds,
    ],
  );
  const latestRequestShapeTokenRef = useRef(terrainShapeToken);
  const colliderShapeTokenRef = useRef<object | null>(null);
  const terrainIndices = useMemo(() => terrainColliderIndices(geometry), [geometry]);
  const [terrainSurface, setTerrainSurface] = useState<
    Extract<ForestWorkerResponse, { type: "TERRAIN_READY" }>
  >(() => ({
    type: "TERRAIN_READY",
    requestId: 0,
    positions: Float32Array.from(
      (geometry.getAttribute("position") as THREE.BufferAttribute).array,
    ),
    habitat: new Float32Array((geometry.getAttribute("position") as THREE.BufferAttribute).count * 4),
    colors: Float32Array.from(
      (geometry.getAttribute("color") as THREE.BufferAttribute).array,
    ),
  }));
  const [terrainColliderSurface, setTerrainColliderSurface] = useState<{
    revision: number;
    positions: Extract<
      ForestWorkerResponse,
      { type: "TERRAIN_READY" }
    >["positions"];
  }>(() => ({
    revision: 0,
    positions: Float32Array.from(
      (geometry.getAttribute("position") as THREE.BufferAttribute).array,
    ),
  }));

  useEffect(() => {
    const worker = new Worker(new URL("../../workers/forestWorker.ts", import.meta.url), { type: "module" });
    workerRef.current = worker;
    const handleWorkerFailure = () => {
      setWorkerError(new Error("The terrain could not be prepared. Please reload or continue with the text journey."));
    };
    worker.addEventListener("error", handleWorkerFailure);
    worker.addEventListener("messageerror", handleWorkerFailure);

    worker.onmessage = (event: MessageEvent<ForestWorkerResponse>) => {
      const result = event.data;
      if (result.type !== "TERRAIN_READY" || result.requestId !== requestIdRef.current) return;
      setTerrainSurface(result);
      const shapeToken = latestRequestShapeTokenRef.current;
      if (colliderShapeTokenRef.current !== shapeToken) {
        colliderShapeTokenRef.current = shapeToken;
        colliderRevisionRef.current += 1;
        setTerrainColliderSurface({
          revision: colliderRevisionRef.current,
          positions: result.positions,
        });
      }
    };

    return () => {
      worker.removeEventListener("error", handleWorkerFailure);
      worker.removeEventListener("messageerror", handleWorkerFailure);
      worker.onmessage = null;
      worker.terminate();
      workerRef.current = null;
    };
  }, []);

  useLayoutEffect(() => {
    applyTerrainSurface(geometry, terrainSurface);
  }, [geometry, terrainSurface]);

  useEffect(() => {
    const worker = workerRef.current;
    if (!worker) return;

    requestIdRef.current += 1;
    latestRequestShapeTokenRef.current = terrainShapeToken;

    const config: TerrainWorkerConfig = {
      terrainSize: TERRAIN_SIZE,
      terrainSegments: TERRAIN_SEGMENTS,
      terrainBaseY: TERRAIN_BASE_Y,
      clearingSafeRadius: FOREST_CLEARING_RADIUS,
      corridorBaseWidth: CORRIDOR_BASE_WIDTH,
      crownedRampWidth: CROWNED_RETURN_RAMP_WIDTH,
      explorationDepth: narrativeWorldState.explorationDepth,
      memoryPressure: narrativeWorldState.memoryPressure,
      groundColor: visualState.palette.ground,
      clearings: clearingSeeds,
      paths: pathSeeds,
    };

    worker.postMessage({
      type: "GENERATE_TERRAIN",
      requestId: requestIdRef.current,
      config,
    });
  }, [
    clearingSeeds,
    geometry,
    narrativeWorldState.explorationDepth,
    narrativeWorldState.memoryPressure,
    pathSeeds,
    terrainShapeToken,
    visualState.palette.ground,
  ]);

  useEffect(() => () => geometry.dispose(), [geometry]);

  // Worker errors are asynchronous; rethrow during render so the canvas can recover.
  if (workerError) throw workerError;

  return (
    <RigidBody type="fixed" colliders={false}>
      {terrainIndices.length > 0 ? (
        <TrimeshCollider
          key={`terrain-collider-${terrainColliderSurface.revision}`}
          args={[terrainColliderSurface.positions, terrainIndices]}
          friction={1.45}
        />
      ) : null}
      <mesh geometry={geometry} visible={renderVisible} receiveShadow>
        <ForestSurfaceMaterial finish="ground" qualityProfile={qualityProfile} map={textures.marshMap} vertexColors color="#ffffff" />
      </mesh>
    </RigidBody>
  );
}

