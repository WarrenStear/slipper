import type { Vector3Tuple } from "../data/slipper3dTypes";

export type WorkerBiome =
  | "firstWood"
  | "mirror"
  | "thorned"
  | "archive"
  | "fireRiver"
  | "crowned";

export type ForestClearingSeed = {
  id: string;
  chapter: string;
  position: Vector3Tuple;
  /** Authored footprint for substantial scenes; omitted for legacy layouts. */
  radius?: number;
  biome?: WorkerBiome;
  elevated?: boolean;
};

export type ForestPathSeed = {
  source: [number, number];
  controlA: [number, number];
  controlB: [number, number];
  target: [number, number];
  curveSeed: number;
  curveLength: number;
  sourceChapter: string;
  targetChapter: string;
  sourceY: number;
  targetY: number;
  crownRamp: boolean;
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
};

export type ForestWorkerConfig = {
  cellSize: number;
  cellRadius: number;
  treesPerCell: number;
  instanceCount: number;

  clearingSafeRadius: number;
  corridorBaseWidth: number;
  corridorMinWidth: number;
  treeColliderLimit: number;

  terrainBaseY: number;
  terrainColliderY: number;
  terrainSize: number;
  terrainSegments: number;
  crownedRampWidth: number;

  cameraX: number;
  cameraZ: number;
  cellX: number;
  cellZ: number;

  explorationDepth: number;
  memoryPressure: number;
  forestDensity?: number;
  pathClarity?: number;

  clearings: ForestClearingSeed[];
  paths: ForestPathSeed[];
};

export type TerrainWorkerConfig = {
  terrainSize: number;
  terrainSegments: number;
  terrainBaseY: number;
  clearingSafeRadius: number;
  corridorBaseWidth: number;
  crownedRampWidth: number;
  explorationDepth: number;
  memoryPressure: number;
  groundColor: string;
  clearings: ForestClearingSeed[];
  paths: ForestPathSeed[];
};

export type PackedForestCollider = {
  position: [number, number, number];
  args: [number, number, number];
};

export type BuildForestWorkerRequest = {
  type: "BUILD_FOREST";
  requestId: number;
  config: ForestWorkerConfig;
};

export type GenerateTerrainWorkerRequest = {
  type: "GENERATE_TERRAIN";
  requestId: number;
  config: TerrainWorkerConfig;
};

export type ForestWorkerRequest = BuildForestWorkerRequest | GenerateTerrainWorkerRequest;

export type BuildForestWorkerResponse = {
  type: "FOREST_READY";
  requestId: number;

  trunkMatrices: Float32Array;
  crownMatrices: Float32Array;
  marshMatrices: Float32Array;
  ruinMatrices: Float32Array;

  trunkColors: Float32Array;
  crownColors: Float32Array;
  marshColors: Float32Array;
  ruinColors: Float32Array;

  trunkCount: number;
  crownCount: number;
  marshCount: number;
  ruinCount: number;

  colliders: PackedForestCollider[];
};

export type GenerateTerrainWorkerResponse = {
  type: "TERRAIN_READY";
  requestId: number;
  positions: Float32Array;
  colors: Float32Array;
  /** Compression, moisture, moss, and ash; shading only, never terrain height. */
  habitat: Float32Array;
};

export type ForestWorkerResponse = BuildForestWorkerResponse | GenerateTerrainWorkerResponse;

export type ForestWorkerMessage = ForestWorkerRequest | ForestWorkerResponse;
