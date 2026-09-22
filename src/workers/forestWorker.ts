import { forestCrownHabit } from "../lib/forestArt.ts";
import type {
  BuildForestWorkerRequest,
  BuildForestWorkerResponse,
  ForestClearingSeed,
  ForestPathSeed,
  ForestWorkerConfig,
  ForestWorkerRequest,
  GenerateTerrainWorkerRequest,
  GenerateTerrainWorkerResponse,
  PackedForestCollider,
  TerrainWorkerConfig,
  WorkerBiome,
} from "./forestWorker.types";
import {
  createTerrainSurfaceSampler,
  resolveTerrainShapeTuning as resolveWorldShapeTuning,
  sampleTerrainElevation as terrainElevationAtPoint,
  sampleTerrainNoise as terrainNoiseAtPoint,
  terrainDistanceToPathSq as distancePointToSegmentSq,
  terrainWalkableInfluenceAtPoint as walkableInfluenceAtPoint,
} from "../lib/terrainModel.ts";

const CHAPTER_MIRROR_CLEARING = "The Mirror Clearing";
const CHAPTER_THORNED_HOUSE = "The Thorned House";
const CHAPTER_BLUE_MOON_ARCHIVE = "The Blue Moon Archive";
const CHAPTER_FIRE_AND_RIVER = "The Fire and River";
const CHAPTER_CROWNED_RETURN = "The Crowned Return";

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, Number.isFinite(value) ? value : min));
}

function clamp01(value: number) {
  return clamp(value, 0, 1);
}

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * clamp01(t);
}

function fract(value: number) {
  return value - Math.floor(value);
}

function worldSeededUnit(x: number, z: number, salt = 0) {
  return fract(Math.sin(x * 127.1 + z * 311.7 + salt * 74.7) * 43758.5453123);
}

function biomeFromChapter(chapter?: string): WorkerBiome {
  if (chapter === CHAPTER_MIRROR_CLEARING) return "mirror";
  if (chapter === CHAPTER_THORNED_HOUSE) return "thorned";
  if (chapter === CHAPTER_BLUE_MOON_ARCHIVE) return "archive";
  if (chapter === CHAPTER_FIRE_AND_RIVER) return "fireRiver";
  if (chapter === CHAPTER_CROWNED_RETURN) return "crowned";
  return "firstWood";
}

function nearestClearingBiome(x: number, z: number, config: { clearings: ForestClearingSeed[] }): WorkerBiome {
  let nearestBiome: WorkerBiome = "firstWood";
  let nearestDistanceSq = Number.POSITIVE_INFINITY;

  for (const clearing of config.clearings) {
    const dx = x - clearing.position[0];
    const dz = z - clearing.position[2];
    const distanceSq = dx * dx + dz * dz;
    if (distanceSq < nearestDistanceSq) {
      nearestDistanceSq = distanceSq;
      nearestBiome = clearing.biome ?? biomeFromChapter(clearing.chapter);
    }
  }

  return nearestBiome;
}

function valueNoise2D(x: number, z: number, salt = 0) {
  const ix = Math.floor(x);
  const iz = Math.floor(z);
  const fx = x - ix;
  const fz = z - iz;
  const smoothX = fx * fx * (3 - 2 * fx);
  const smoothZ = fz * fz * (3 - 2 * fz);
  const a = worldSeededUnit(ix, iz, salt);
  const b = worldSeededUnit(ix + 1, iz, salt);
  const c = worldSeededUnit(ix, iz + 1, salt);
  const d = worldSeededUnit(ix + 1, iz + 1, salt);
  return lerp(lerp(a, b, smoothX), lerp(c, d, smoothX), smoothZ);
}

function ridgeMazeNoise(x: number, z: number, depth: number, memoryPressure: number) {
  const n1 = valueNoise2D(x * 0.024, z * 0.024, 2.1);
  const n2 = valueNoise2D(x * 0.049 + 19.4, z * 0.049 - 4.7, 9.8);
  const n3 = valueNoise2D(x * 0.082 - 11.2, z * 0.082 + 6.8, 21.3);
  const blended = n1 * 0.66 + n2 * 0.26 + n3 * 0.08;
  const ridge = 1 - Math.abs(blended * 2 - 1);
  return clamp01(ridge + depth * 0.08 + memoryPressure * 0.05);
}

function smoothstep(edge0: number, edge1: number, value: number) {
  const x = clamp01((value - edge0) / Math.max(0.0001, edge1 - edge0));
  return x * x * (3 - 2 * x);
}

function distanceToPathBoundsSq(x: number, z: number, path: ForestPathSeed) {
  const clampedX = clamp(x, path.minX, path.maxX);
  const clampedZ = clamp(z, path.minZ, path.maxZ);
  const dx = x - clampedX;
  const dz = z - clampedZ;
  return dx * dx + dz * dz;
}

function nearestPathDistanceSq(
  x: number,
  z: number,
  paths: ForestPathSeed[],
  morph: TerrainWorkerConfig | ForestWorkerConfig,
  stopAtSq = 0,
) {
  let nearestDistanceSq = Number.POSITIVE_INFINITY;
  for (const path of paths) {
    if (distanceToPathBoundsSq(x, z, path) > nearestDistanceSq) continue;
    nearestDistanceSq = Math.min(
      nearestDistanceSq,
      distancePointToSegmentSq(x, z, path, morph),
    );
    if (nearestDistanceSq <= stopAtSq) break;
  }
  return nearestDistanceSq;
}

function hexToRgb01(value: string): [number, number, number] {
  const fallback: [number, number, number] = [0.13, 0.15, 0.13];
  const normalized = value.trim().replace(/^#/, "");
  if (!/^[0-9a-fA-F]{6}$/.test(normalized)) return fallback;
  const numberValue = Number.parseInt(normalized, 16);
  return [
    ((numberValue >> 16) & 255) / 255,
    ((numberValue >> 8) & 255) / 255,
    (numberValue & 255) / 255,
  ];
}

export function generateTerrain(request: GenerateTerrainWorkerRequest): GenerateTerrainWorkerResponse {
  const config = request.config;
  const grid = Math.max(1, Math.floor(config.terrainSegments));
  const vertexSide = grid + 1;
  const vertexCount = vertexSide * vertexSide;
  const positions = new Float32Array(vertexCount * 3);
  const colors = new Float32Array(vertexCount * 3);
  const habitat = new Float32Array(vertexCount * 4);
  const [baseR, baseG, baseB] = hexToRgb01(config.groundColor);
  const half = config.terrainSize * 0.5;
  const step = config.terrainSize / grid;
  const tuning = resolveWorldShapeTuning(config);

  let cursor = 0;
  for (let iz = 0; iz <= grid; iz += 1) {
    const z = iz * step - half;
    for (let ix = 0; ix <= grid; ix += 1) {
      const x = ix * step - half;
      const lift = terrainElevationAtPoint(x, z, config);
      const walkable = walkableInfluenceAtPoint(x, z, config, tuning);
      const noise = terrainNoiseAtPoint(x + 19.2, z - 13.5, config.explorationDepth, config.memoryPressure);
      const shade = clamp(0.94 + noise * 0.025 + walkable * 0.008, 0.86, 0.99);
      const offset = cursor * 3;

      positions[offset + 0] = x;
      positions[offset + 1] = config.terrainBaseY + lift;
      positions[offset + 2] = z;
      colors[offset + 0] = clamp((0.9 + baseR * 0.1) * shade + walkable * 0.01, 0, 1);
      colors[offset + 1] = clamp((0.9 + baseG * 0.1) * shade + walkable * 0.007, 0, 1);
      colors[offset + 2] = clamp((0.9 + baseB * 0.1) * shade + walkable * 0.004, 0, 1);
      const biome = nearestClearingBiome(x, z, config);
      const moisture = biome === "mirror" ? .82 : biome === "fireRiver" ? .35 : .56;
      habitat[cursor * 4] = walkable;
      habitat[cursor * 4 + 1] = moisture;
      habitat[cursor * 4 + 2] = biome === "fireRiver" ? .15 : biome === "crowned" ? .5 : .82;
      habitat[cursor * 4 + 3] = biome === "fireRiver" ? .6 : 0;
      cursor += 1;
    }
  }

  return { type: "TERRAIN_READY", requestId: request.requestId, positions, colors, habitat };
}

function writeHiddenMatrix(target: Float32Array, index: number) {
  const offset = index * 16;
  target.fill(0, offset, offset + 16);
  target[offset + 15] = 1;
}

function writeMatrix(
  target: Float32Array,
  index: number,
  px: number,
  py: number,
  pz: number,
  rx: number,
  ry: number,
  rz: number,
  sx: number,
  sy: number,
  sz: number,
) {
  const offset = index * 16;
  const cx = Math.cos(rx);
  const sxn = Math.sin(rx);
  const cy = Math.cos(ry);
  const syn = Math.sin(ry);
  const cz = Math.cos(rz);
  const szn = Math.sin(rz);
  const m11 = cy * cz;
  const m12 = sxn * syn * cz + cx * szn;
  const m13 = -cx * syn * cz + sxn * szn;
  const m21 = -cy * szn;
  const m22 = -sxn * syn * szn + cx * cz;
  const m23 = cx * syn * szn + sxn * cz;
  const m31 = syn;
  const m32 = -sxn * cy;
  const m33 = cx * cy;

  target[offset + 0] = m11 * sx;
  target[offset + 1] = m12 * sx;
  target[offset + 2] = m13 * sx;
  target[offset + 3] = 0;
  target[offset + 4] = m21 * sy;
  target[offset + 5] = m22 * sy;
  target[offset + 6] = m23 * sy;
  target[offset + 7] = 0;
  target[offset + 8] = m31 * sz;
  target[offset + 9] = m32 * sz;
  target[offset + 10] = m33 * sz;
  target[offset + 11] = 0;
  target[offset + 12] = px;
  target[offset + 13] = py;
  target[offset + 14] = pz;
  target[offset + 15] = 1;
}

function writeColor(target: Float32Array, index: number, r: number, g: number, b: number) {
  const offset = index * 3;
  target[offset + 0] = r;
  target[offset + 1] = g;
  target[offset + 2] = b;
}

export type ForestColliderCandidate = {
  id: string;
  cellKey: string;
  distanceSq: number;
  edgeWall: boolean;
  ridgeWall: boolean;
  mazeEdgeInfluence: number;
  collider: PackedForestCollider;
};

const MAX_COLLIDERS_PER_FOREST_CELL = 2;
const ROOTED_TRUNK_COLLIDER_SCALE = 1.72;
const EDGE_ROOT_COLLIDER_BONUS = 0.48;

function colliderWallPriority(candidate: ForestColliderCandidate) {
  return (
    (candidate.edgeWall ? 2 : 0) +
    (candidate.ridgeWall ? 1 : 0) +
    clamp01(candidate.mazeEdgeInfluence)
  );
}

/**
 * Keeps collision bounded while preserving the authored maze walls nearest the
 * player. Selection is deterministic and takes at most two samples from a
 * generated forest cell before filling unused capacity. That prevents a dense
 * decorative cluster from consuming the entire local collision budget.
 */
export function selectForestColliders(
  candidates: ForestColliderCandidate[],
  requestedLimit: number,
  distanceBandSize: number,
) {
  const limit = Math.max(0, Math.floor(requestedLimit));
  if (limit === 0 || candidates.length === 0) return [];

  const safeBandSize = Math.max(1, distanceBandSize);
  const ranked = [...candidates].sort((left, right) => {
    const leftBand = Math.floor(Math.sqrt(left.distanceSq) / safeBandSize);
    const rightBand = Math.floor(Math.sqrt(right.distanceSq) / safeBandSize);
    if (leftBand !== rightBand) return leftBand - rightBand;

    const priorityDelta = colliderWallPriority(right) - colliderWallPriority(left);
    if (Math.abs(priorityDelta) > 1e-9) return priorityDelta;
    if (left.distanceSq !== right.distanceSq) return left.distanceSq - right.distanceSq;
    return left.id.localeCompare(right.id);
  });

  const selected: ForestColliderCandidate[] = [];
  const selectedIds = new Set<string>();
  const selectedPerCell = new Map<string, number>();
  const candidatesByBand = new Map<number, ForestColliderCandidate[]>();
  for (const candidate of ranked) {
    const band = Math.floor(Math.sqrt(candidate.distanceSq) / safeBandSize);
    const members = candidatesByBand.get(band) ?? [];
    members.push(candidate);
    candidatesByBand.set(band, members);
  }

  for (const band of [...candidatesByBand.keys()].sort((a, b) => a - b)) {
    const members = candidatesByBand.get(band) ?? [];
    for (let pass = 0; pass < MAX_COLLIDERS_PER_FOREST_CELL; pass += 1) {
      for (const candidate of members) {
        if (selectedIds.has(candidate.id)) continue;
        if ((selectedPerCell.get(candidate.cellKey) ?? 0) !== pass) continue;
        selected.push(candidate);
        selectedIds.add(candidate.id);
        selectedPerCell.set(candidate.cellKey, pass + 1);
        if (selected.length >= limit) return selected.map((entry) => entry.collider);
      }
    }
  }

  for (const candidate of ranked) {
    if (selectedIds.has(candidate.id)) continue;
    selected.push(candidate);
    if (selected.length >= limit) break;
  }

  return selected.map((entry) => entry.collider);
}

export function buildForest(request: BuildForestWorkerRequest): BuildForestWorkerResponse {
  const config = request.config;
  const matrixLength = config.instanceCount * 16;
  const colorLength = config.instanceCount * 3;
  const trunkMatrices = new Float32Array(matrixLength);
  const crownMatrices = new Float32Array(matrixLength);
  const marshMatrices = new Float32Array(matrixLength);
  const ruinMatrices = new Float32Array(matrixLength);
  const trunkColors = new Float32Array(colorLength);
  const crownColors = new Float32Array(colorLength);
  const marshColors = new Float32Array(colorLength);
  const ruinColors = new Float32Array(colorLength);
  const colliderCandidates: ForestColliderCandidate[] = [];

  const pushCollider = (
    id: string,
    cellKey: string,
    x: number,
    z: number,
    edgeWall: boolean,
    ridgeWall: boolean,
    mazeEdgeInfluence: number,
    collider: PackedForestCollider,
  ) => {
    const dx = x - config.cameraX;
    const dz = z - config.cameraZ;
    colliderCandidates.push({
      id,
      cellKey,
      distanceSq: dx * dx + dz * dz,
      edgeWall,
      ridgeWall,
      mazeEdgeInfluence,
      collider,
    });
  };

  const depth = clamp01(config.explorationDepth);
  const memoryPressure = clamp01(config.memoryPressure);
  const tuning = resolveWorldShapeTuning(config);
  const sampleTerrainSurface = createTerrainSurfaceSampler(
    config,
    config.terrainSize,
    config.terrainSegments,
  );
  const pressure = tuning.pressure;
  const forestDensity = clamp((config.forestDensity ?? 1) * tuning.forestDensityScale, 0.4, 1.24);
  const pathClarity = config.pathClarity ?? 0.86;
  const corridorBoost = 1 + clamp((pathClarity - 0.72) * 0.46, -0.12, 0.28);
  // The authored physical graph uses narrow, readable walking lanes. Forest
  // edges can therefore close in around the route without trees intruding into
  // the player/collision sanctuary.
  const baseCorridorWidth = lerp(config.corridorBaseWidth * 0.44, config.corridorMinWidth * 0.5, pressure) * corridorBoost;
  const baseClearingRadius = lerp(config.clearingSafeRadius * 0.76, config.clearingSafeRadius * 0.62, pressure);
  const depthDarken = 1 - depth * 0.2 - memoryPressure * 0.1;
  const instanceCapacity = config.instanceCount;
  let trunkCount = 0;
  let crownCount = 0;
  let marshCount = 0;
  let ruinCount = 0;

  for (let gx = -config.cellRadius; gx <= config.cellRadius; gx += 1) {
    for (let gz = -config.cellRadius; gz <= config.cellRadius; gz += 1) {
      const worldCellX = config.cellX + gx;
      const worldCellZ = config.cellZ + gz;
      for (let treeIndex = 0; treeIndex < config.treesPerCell; treeIndex += 1) {
        const salt = treeIndex * 17.17;
        const jitterX = worldSeededUnit(worldCellX, worldCellZ, salt);
        const jitterZ = worldSeededUnit(worldCellX, worldCellZ, salt + 4.31);
        const x = (worldCellX + jitterX) * config.cellSize;
        const z = (worldCellZ + jitterZ) * config.cellSize;
        const biome = nearestClearingBiome(x, z, config);
        const cellKey = `${worldCellX}:${worldCellZ}`;
        const candidateId = `${cellKey}:${treeIndex}`;

        const terrainLift = sampleTerrainSurface(x, z);
        const groundY = config.terrainBaseY + terrainLift;
        const colliderGroundY = config.terrainColliderY + terrainLift;
        const chapterPressure = biome === "thorned" ? pressure * 1.06 : pressure;
        const corridorWidth = biome === "crowned" ? Math.max(baseCorridorWidth * 1.24, config.crownedRampWidth * 0.76) : baseCorridorWidth;
        const clearingRadius = biome === "crowned" ? baseClearingRadius + 5.4 : baseClearingRadius;
        const tooCloseToClearing = config.clearings.some((clearing) => {
          const dx = x - clearing.position[0];
          const dz = z - clearing.position[2];
          const authoredRadius = clearing.radius ?? clearingRadius;
          const protectedRadius = Math.max(
            clearingRadius,
            authoredRadius * lerp(0.92, 0.8, pressure),
          );
          return dx * dx + dz * dz < protectedRadius * protectedRadius;
        });
        const nearestPathDistance = Math.sqrt(
          nearestPathDistanceSq(
            x,
            z,
            config.paths,
            config,
            corridorWidth * corridorWidth,
          ),
        );
        const nearCorridor = nearestPathDistance < corridorWidth;
        const mazeEdgeInfluence = Number.isFinite(nearestPathDistance)
          ? 1 - smoothstep(corridorWidth * 1.04, corridorWidth * 2.72, nearestPathDistance)
          : 0;
        const mazeWallScore = ridgeMazeNoise(x, z, depth, memoryPressure);
        const wallThresholdBase =
          biome === "mirror" ? 0.78 : biome === "crowned" ? 0.74 : biome === "thorned" ? 0.58 : lerp(0.62, 0.54, pressure);
        const wallThreshold = wallThresholdBase + tuning.ridgeThresholdLift - clamp((forestDensity - 0.62) * 0.08, -0.04, 0.06);
        const randomA = worldSeededUnit(worldCellX, worldCellZ, salt + 71.3);
        const randomB = worldSeededUnit(worldCellX, worldCellZ, salt + 81.9);
        const edgeWallChance = (0.52 + mazeEdgeInfluence * 0.44) * Math.min(1.08, forestDensity + 0.16);
        const edgeWallCandidate = mazeEdgeInfluence > 0.035 && randomB < edgeWallChance;
        const ridgeWallCandidate = mazeWallScore > wallThreshold;
        const baseVisible = !tooCloseToClearing && !nearCorridor && (edgeWallCandidate || ridgeWallCandidate);

        if (biome === "mirror") {
          const marshVisible = !tooCloseToClearing && !nearCorridor && randomA > 0.48;
          if (marshVisible && marshCount < instanceCapacity) {
            const marshScale = 0.95 + randomB * 1.85;
            const yaw = worldSeededUnit(worldCellX, worldCellZ, salt + 91.5) * Math.PI * 2;
            writeMatrix(marshMatrices, marshCount, x, groundY + 0.018, z, -Math.PI / 2, 0, yaw, marshScale * 1.05, marshScale * 0.5, 1);
            writeColor(marshColors, marshCount, 0.18 + randomA * 0.08, 0.31 + randomB * 0.08, 0.34 + randomA * 0.12);
            marshCount += 1;
          }
        }

        const sparseTreeMultiplier =
          (biome === "mirror" ? 0.36 : biome === "archive" ? 0.54 : biome === "crowned" ? 0.42 : biome === "fireRiver" ? 0.66 : 0.8) * forestDensity;
        const treeVisible = baseVisible && randomA < Math.min(0.96, sparseTreeMultiplier + mazeEdgeInfluence * 0.34);

        if ((biome === "firstWood" || biome === "mirror" || biome === "archive" || biome === "fireRiver" || biome === "crowned") && treeVisible) {
          const edgeScale = 1 + mazeEdgeInfluence * 0.08;
          const trunkHeight = (7.8 + worldSeededUnit(worldCellX, worldCellZ, salt + 8.8) * (7.4 + chapterPressure * 1.4)) * tuning.objectHeightScale * edgeScale;
          const trunkWidth = (0.2 + worldSeededUnit(worldCellX, worldCellZ, salt + 9.7) * 0.14) * (1 + mazeEdgeInfluence * 0.12);
          const lean = (worldSeededUnit(worldCellX, worldCellZ, salt + 12.2) - 0.5) * (0.075 + chapterPressure * 0.045);
          const crownScale = (1.18 + worldSeededUnit(worldCellX, worldCellZ, salt + 19.4) * (1.12 + chapterPressure * 0.36)) * tuning.objectHeightScale * edgeScale;
          const yawA = worldSeededUnit(worldCellX, worldCellZ, salt + 15.5) * Math.PI * 2;
          const yawB = worldSeededUnit(worldCellX, worldCellZ, salt + 27.2) * Math.PI * 2;
          const crownedTint = biome === "crowned" ? 1.2 : 1;
          const fireTint = biome === "fireRiver" ? 0.78 : 1;
          const archiveTint = biome === "archive" ? 1.12 : 1;

          if (trunkCount < instanceCapacity) {
            writeMatrix(trunkMatrices, trunkCount, x, groundY + trunkHeight * 0.5, z, lean, yawA, lean * 0.42, trunkWidth, trunkHeight, trunkWidth);
            writeColor(
              trunkColors,
              trunkCount,
              (0.74 + randomA * 0.16) * depthDarken * fireTint,
              (0.7 + randomB * 0.14) * depthDarken * crownedTint,
              (0.66 + randomA * 0.1) * depthDarken * archiveTint,
            );
            trunkCount += 1;
          }
          if (crownCount < instanceCapacity) {
            const habit = forestCrownHabit(randomB);
            writeMatrix(crownMatrices, crownCount, x, groundY + trunkHeight * 0.8 + crownScale * 0.32, z, lean * 0.28, yawB, -lean * 0.28, crownScale * 1.04 * habit[0], crownScale * 1.18 * habit[1], crownScale * habit[2]);
            writeColor(
              crownColors,
              crownCount,
              (0.68 + randomB * 0.12) * depthDarken * fireTint,
              (0.78 + randomA * 0.16) * depthDarken * crownedTint,
              (0.7 + randomB * 0.12) * depthDarken * archiveTint,
            );
            crownCount += 1;
          }
          const colliderRadius = Math.max(
            0.42,
            trunkWidth * (ROOTED_TRUNK_COLLIDER_SCALE + mazeEdgeInfluence * EDGE_ROOT_COLLIDER_BONUS),
          );
          pushCollider(
            `${candidateId}:tree`,
            cellKey,
            x,
            z,
            edgeWallCandidate,
            ridgeWallCandidate,
            mazeEdgeInfluence,
            {
              position: [x, colliderGroundY + trunkHeight * 0.5 + 0.12, z],
              args: [colliderRadius, trunkHeight * 0.47, colliderRadius],
            },
          );
        }

        if (biome === "thorned" && baseVisible && randomA < tuning.thornDensityScale) {
          const wallHeight = (0.56 + randomA * 1.32 + pressure * 0.34) * tuning.objectHeightScale;
          const wallWidth = 0.1 + randomB * 0.2;
          const wallDepth = 0.34 + worldSeededUnit(worldCellX, worldCellZ, salt + 84.2) * 0.74;
          const yaw = worldSeededUnit(worldCellX, worldCellZ, salt + 85.1) * Math.PI * 2;
          const lean = (worldSeededUnit(worldCellX, worldCellZ, salt + 86.5) - 0.5) * 0.14;
          if (ruinCount < instanceCapacity) {
            writeMatrix(ruinMatrices, ruinCount, x, groundY + wallHeight * 0.5, z, lean, yaw, lean * 0.42, wallWidth, wallHeight, wallDepth);
            writeColor(ruinColors, ruinCount, 0.7 * depthDarken, 0.66 * depthDarken, 0.62 * depthDarken);
            ruinCount += 1;
          }
          pushCollider(
            `${candidateId}:thorn`,
            cellKey,
            x,
            z,
            edgeWallCandidate,
            ridgeWallCandidate,
            mazeEdgeInfluence,
            {
              position: [x, colliderGroundY + wallHeight * 0.5 + 0.14, z],
              args: [Math.max(0.2, wallWidth * 0.86), wallHeight * 0.4, Math.max(0.28, wallDepth * 0.44)],
            },
          );
        }
      }
    }
  }

  for (let index = trunkCount; index < instanceCapacity; index += 1) writeHiddenMatrix(trunkMatrices, index);
  for (let index = crownCount; index < instanceCapacity; index += 1) writeHiddenMatrix(crownMatrices, index);
  for (let index = marshCount; index < instanceCapacity; index += 1) writeHiddenMatrix(marshMatrices, index);
  for (let index = ruinCount; index < instanceCapacity; index += 1) writeHiddenMatrix(ruinMatrices, index);

  const colliderLimit = Math.min(
    config.treeColliderLimit,
    Math.max(24, Math.round(config.treeColliderLimit * Math.max(0.78, tuning.colliderScale))),
  );
  const colliders = selectForestColliders(
    colliderCandidates,
    colliderLimit,
    config.cellSize * 1.1,
  );

  return {
    type: "FOREST_READY",
    requestId: request.requestId,
    trunkMatrices,
    crownMatrices,
    marshMatrices,
    ruinMatrices,
    trunkColors,
    crownColors,
    marshColors,
    ruinColors,
    trunkCount,
    crownCount,
    marshCount,
    ruinCount,
    colliders,
  };
}

if (typeof self !== "undefined") self.onmessage = (event: MessageEvent<ForestWorkerRequest>) => {
  const message = event.data;
  if (message.type === "BUILD_FOREST") {
    const response = buildForest(message);
    const transferList = [
      response.trunkMatrices.buffer,
      response.crownMatrices.buffer,
      response.marshMatrices.buffer,
      response.ruinMatrices.buffer,
      response.trunkColors.buffer,
      response.crownColors.buffer,
      response.marshColors.buffer,
      response.ruinColors.buffer,
    ] as unknown as Transferable[];
    (self as unknown as { postMessage: (message: unknown, transfer: Transferable[]) => void }).postMessage(response, transferList);
    return;
  }

  if (message.type === "GENERATE_TERRAIN") {
    const response = generateTerrain(message);
    const transferList = [response.positions.buffer, response.colors.buffer, response.habitat.buffer] as unknown as Transferable[];
    (self as unknown as { postMessage: (message: unknown, transfer: Transferable[]) => void }).postMessage(response, transferList);
  }
};

export {};
