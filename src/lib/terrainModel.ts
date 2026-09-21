export type TerrainClearingSeed = {
  id: string;
  chapter: string;
  position: [number, number, number];
  radius?: number;
  elevated?: boolean;
};

export type TerrainCurveSeed = {
  source: [number, number];
  controlA: [number, number];
  controlB: [number, number];
  target: [number, number];
  curveSeed: number;
  curveLength: number;
};

export type TerrainPathSeed = TerrainCurveSeed & {
  sourceChapter: string;
  targetChapter: string;
  sourceY: number;
  targetY: number;
  crownRamp: boolean;
  minX?: number;
  maxX?: number;
  minZ?: number;
  maxZ?: number;
};

export type TerrainMorphState = {
  explorationDepth?: number;
  memoryPressure?: number;
};

export type TerrainSamplerConfig = Required<TerrainMorphState> & {
  clearingSafeRadius: number;
  corridorBaseWidth: number;
  crownedRampWidth: number;
  clearings: TerrainClearingSeed[];
  paths: TerrainPathSeed[];
};

export type TerrainShapeTuning = {
  pressure: number;
  terrainAmplitude: number;
  terrainClampMin: number;
  terrainClampMax: number;
  pathFlattenStrength: number;
  corridorMultiplier: number;
  clearingMultiplier: number;
  corridorSoftness: number;
  clearingSoftness: number;
  ridgeThresholdLift: number;
  forestDensityScale: number;
  colliderScale: number;
  thornDensityScale: number;
  objectHeightScale: number;
};

const CHAPTER_CROWNED_RETURN = "The Crowned Return";
const BEZIER_DISTANCE_SAMPLES = 24;
const BEZIER_REFINE_PASSES = 7;

type Vec2 = [number, number];

export function clampTerrainValue(
  value: number,
  min: number,
  max: number,
) {
  return Math.max(min, Math.min(max, Number.isFinite(value) ? value : min));
}

export function clampTerrainUnit(value: number) {
  return clampTerrainValue(value, 0, 1);
}

export function lerpTerrainValue(a: number, b: number, t: number) {
  return a + (b - a) * clampTerrainUnit(t);
}

function fract(value: number) {
  return value - Math.floor(value);
}

export function terrainSeededUnit(x: number, z: number, salt = 0) {
  return fract(
    Math.sin(x * 127.1 + z * 311.7 + salt * 74.7) * 43758.5453123,
  );
}

function valueNoise2D(x: number, z: number, salt = 0) {
  const ix = Math.floor(x);
  const iz = Math.floor(z);
  const fx = x - ix;
  const fz = z - iz;
  const smoothX = fx * fx * (3 - 2 * fx);
  const smoothZ = fz * fz * (3 - 2 * fz);
  const a = terrainSeededUnit(ix, iz, salt);
  const b = terrainSeededUnit(ix + 1, iz, salt);
  const c = terrainSeededUnit(ix, iz + 1, salt);
  const d = terrainSeededUnit(ix + 1, iz + 1, salt);
  return lerpTerrainValue(
    lerpTerrainValue(a, b, smoothX),
    lerpTerrainValue(c, d, smoothX),
    smoothZ,
  );
}

function smoothstep(edge0: number, edge1: number, value: number) {
  const x = clampTerrainUnit(
    (value - edge0) / Math.max(0.0001, edge1 - edge0),
  );
  return x * x * (3 - 2 * x);
}

function distanceToPathBoundsSq(
  x: number,
  z: number,
  path: TerrainPathSeed,
) {
  if (
    path.minX === undefined ||
    path.maxX === undefined ||
    path.minZ === undefined ||
    path.maxZ === undefined
  ) {
    return 0;
  }

  const clampedX = clampTerrainValue(x, path.minX, path.maxX);
  const clampedZ = clampTerrainValue(z, path.minZ, path.maxZ);
  const dx = x - clampedX;
  const dz = z - clampedZ;
  return dx * dx + dz * dz;
}

export function resolveTerrainShapeTuning(
  config: TerrainSamplerConfig,
): TerrainShapeTuning {
  const depth = clampTerrainUnit(config.explorationDepth);
  const memoryPressure = clampTerrainUnit(config.memoryPressure);
  const pressure = clampTerrainUnit(depth * 0.34 + memoryPressure * 0.42);

  return {
    pressure,
    terrainAmplitude: lerpTerrainValue(
      0.18,
      0.34,
      depth * 0.24 + memoryPressure * 0.16,
    ),
    terrainClampMin: -0.24,
    terrainClampMax: lerpTerrainValue(0.32, 0.58, pressure),
    pathFlattenStrength: lerpTerrainValue(0.985, 0.995, memoryPressure),
    corridorMultiplier:
      lerpTerrainValue(1.46, 1.26, memoryPressure) + depth * 0.04,
    clearingMultiplier: lerpTerrainValue(
      1.46,
      1.68,
      1 - memoryPressure * 0.22,
    ),
    corridorSoftness: lerpTerrainValue(2.28, 2.62, 1 - memoryPressure),
    clearingSoftness: lerpTerrainValue(1.68, 1.94, 1 - memoryPressure),
    ridgeThresholdLift: lerpTerrainValue(
      0.1,
      0.17,
      1 - memoryPressure * 0.25,
    ),
    forestDensityScale:
      lerpTerrainValue(0.82, 0.98, depth) *
      lerpTerrainValue(1, 0.88, memoryPressure),
    colliderScale:
      lerpTerrainValue(0.72, 0.86, depth) *
      lerpTerrainValue(1, 0.86, memoryPressure),
    thornDensityScale: lerpTerrainValue(0.52, 0.66, memoryPressure),
    objectHeightScale: lerpTerrainValue(0.76, 0.9, depth),
  };
}

export function sampleTerrainNoise(
  x: number,
  z: number,
  explorationDepth = 0,
  memoryPressure = 0,
) {
  const broad = valueNoise2D(x * 0.0075, z * 0.0075, 31.4) * 2 - 1;
  const mid =
    valueNoise2D(x * 0.021 + 17.2, z * 0.021 - 8.5, 71.1) * 2 - 1;
  const fine =
    valueNoise2D(x * 0.045 - 4.2, z * 0.045 + 11.9, 113.7) * 2 - 1;
  const pressureRidge =
    1 -
    Math.abs(
      valueNoise2D(x * 0.032 + 5.9, z * 0.032 - 2.1, 171.3) * 2 - 1,
    );

  return (
    broad * 0.66 +
    mid * 0.22 +
    fine * 0.045 +
    pressureRidge * memoryPressure * 0.08 +
    explorationDepth * 0.035
  );
}

function cubicBezierPoint(path: TerrainCurveSeed, t: number): Vec2 {
  const u = 1 - t;
  const tt = t * t;
  const uu = u * u;
  const uuu = uu * u;
  const ttt = tt * t;
  return [
    path.source[0] * uuu +
      path.controlA[0] * 3 * uu * t +
      path.controlB[0] * 3 * u * tt +
      path.target[0] * ttt,
    path.source[1] * uuu +
      path.controlA[1] * 3 * uu * t +
      path.controlB[1] * 3 * u * tt +
      path.target[1] * ttt,
  ];
}

function cubicBezierTangent(path: TerrainCurveSeed, t: number): Vec2 {
  const u = 1 - t;
  const x =
    (path.controlA[0] - path.source[0]) * 3 * u * u +
    (path.controlB[0] - path.controlA[0]) * 6 * u * t +
    (path.target[0] - path.controlB[0]) * 3 * t * t;
  const z =
    (path.controlA[1] - path.source[1]) * 3 * u * u +
    (path.controlB[1] - path.controlA[1]) * 6 * u * t +
    (path.target[1] - path.controlB[1]) * 3 * t * t;
  const length = Math.sqrt(x * x + z * z) || 1;
  return [x / length, z / length];
}

export function terrainCurvedPathPointAt(
  path: TerrainCurveSeed,
  t: number,
  morph: TerrainMorphState = {},
): Vec2 {
  const point = cubicBezierPoint(path, clampTerrainUnit(t));
  const memoryPressure = clampTerrainUnit(morph.memoryPressure ?? 0);
  const explorationDepth = clampTerrainUnit(morph.explorationDepth ?? 0);
  if (memoryPressure <= 0.015 && explorationDepth <= 0.015) return point;

  const tangent = cubicBezierTangent(path, t);
  const normal: Vec2 = [-tangent[1], tangent[0]];
  const frequency =
    3.2 + memoryPressure * 9.5 + explorationDepth * 2.4;
  const amplitude =
    Math.min(9.5, 1.35 + path.curveLength * 0.015) *
    (0.22 + memoryPressure * 0.78);
  const wave =
    Math.sin(t * Math.PI * frequency + path.curveSeed * 11.73) *
    amplitude;
  const secondary =
    Math.sin(
      t * Math.PI * (frequency * 0.43 + 1.8) +
        path.curveSeed * 5.1,
    ) *
    amplitude *
    explorationDepth *
    0.34;
  return [
    point[0] + normal[0] * (wave + secondary),
    point[1] + normal[1] * (wave + secondary),
  ];
}

export function terrainCurvedPathTangentAt(
  path: TerrainCurveSeed,
  t: number,
  morph: TerrainMorphState = {},
): Vec2 {
  const delta = 0.018;
  const a = terrainCurvedPathPointAt(
    path,
    clampTerrainUnit(t - delta),
    morph,
  );
  const b = terrainCurvedPathPointAt(
    path,
    clampTerrainUnit(t + delta),
    morph,
  );
  const x = b[0] - a[0];
  const z = b[1] - a[1];
  const length = Math.sqrt(x * x + z * z);
  return length > 0.00001
    ? [x / length, z / length]
    : cubicBezierTangent(path, t);
}

export function terrainPathProjectionT(
  x: number,
  z: number,
  path: TerrainCurveSeed,
  morph: TerrainMorphState = {},
) {
  let bestT = 0;
  let bestDistanceSq = Number.POSITIVE_INFINITY;

  for (let index = 0; index <= BEZIER_DISTANCE_SAMPLES; index += 1) {
    const t = index / BEZIER_DISTANCE_SAMPLES;
    const point = terrainCurvedPathPointAt(path, t, morph);
    const dx = x - point[0];
    const dz = z - point[1];
    const distanceSq = dx * dx + dz * dz;
    if (distanceSq < bestDistanceSq) {
      bestDistanceSq = distanceSq;
      bestT = t;
    }
  }

  let low = clampTerrainUnit(bestT - 1 / BEZIER_DISTANCE_SAMPLES);
  let high = clampTerrainUnit(bestT + 1 / BEZIER_DISTANCE_SAMPLES);
  for (let pass = 0; pass < BEZIER_REFINE_PASSES; pass += 1) {
    const left = lerpTerrainValue(low, high, 1 / 3);
    const right = lerpTerrainValue(low, high, 2 / 3);
    const leftPoint = terrainCurvedPathPointAt(path, left, morph);
    const rightPoint = terrainCurvedPathPointAt(path, right, morph);
    const leftDistanceSq =
      (x - leftPoint[0]) ** 2 + (z - leftPoint[1]) ** 2;
    const rightDistanceSq =
      (x - rightPoint[0]) ** 2 + (z - rightPoint[1]) ** 2;
    if (leftDistanceSq < rightDistanceSq) high = right;
    else low = left;
  }

  return clampTerrainUnit((low + high) * 0.5);
}

export function terrainDistanceToPathSq(
  x: number,
  z: number,
  path: TerrainCurveSeed,
  morph: TerrainMorphState = {},
) {
  const t = terrainPathProjectionT(x, z, path, morph);
  const point = terrainCurvedPathPointAt(path, t, morph);
  const dx = x - point[0];
  const dz = z - point[1];
  return dx * dx + dz * dz;
}

export function terrainWalkableInfluenceAtPoint(
  x: number,
  z: number,
  config: TerrainSamplerConfig,
  tuning = resolveTerrainShapeTuning(config),
) {
  let influence = 0;

  for (const path of config.paths) {
    const corridorWidth =
      config.corridorBaseWidth * tuning.corridorMultiplier;
    const outerRadius = corridorWidth * tuning.corridorSoftness;
    if (distanceToPathBoundsSq(x, z, path) > outerRadius * outerRadius) {
      continue;
    }

    const distance = Math.sqrt(
      terrainDistanceToPathSq(x, z, path, config),
    );
    influence = Math.max(
      influence,
      1 -
        smoothstep(
          corridorWidth * 0.36,
          corridorWidth * tuning.corridorSoftness,
          distance,
        ),
    );
    if (influence >= 0.9999) break;
  }

  for (const clearing of config.clearings) {
    if (influence >= 0.9999) break;
    const dx = x - clearing.position[0];
    const dz = z - clearing.position[2];
    const distance = Math.sqrt(dx * dx + dz * dz);
    const clearingRadius =
      (clearing.radius ?? config.clearingSafeRadius) * tuning.clearingMultiplier;
    influence = Math.max(
      influence,
      1 -
        smoothstep(
          clearingRadius * 0.34,
          clearingRadius * tuning.clearingSoftness,
          distance,
        ),
    );
  }

  return clampTerrainUnit(influence);
}

export function sampleTerrainElevation(
  x: number,
  z: number,
  config: TerrainSamplerConfig,
) {
  const memoryPressure = clampTerrainUnit(config.memoryPressure);
  const explorationDepth = clampTerrainUnit(config.explorationDepth);
  const tuning = resolveTerrainShapeTuning(config);
  const walkableInfluence = terrainWalkableInfluenceAtPoint(
    x,
    z,
    config,
    tuning,
  );
  const baseNoise = sampleTerrainNoise(
    x,
    z,
    explorationDepth,
    memoryPressure,
  );
  const secondaryNoise =
    sampleTerrainNoise(
      x + 37.4,
      z - 16.9,
      explorationDepth,
      memoryPressure,
    ) * 0.08;
  let elevation =
    (baseNoise + secondaryNoise) * tuning.terrainAmplitude;

  const walkableFloorBias = -0.025 * walkableInfluence;
  elevation = lerpTerrainValue(
    elevation,
    walkableFloorBias,
    walkableInfluence * tuning.pathFlattenStrength,
  );
  elevation = clampTerrainValue(
    elevation,
    tuning.terrainClampMin,
    tuning.terrainClampMax,
  );

  let crownRampProtection = 0;
  for (const clearing of config.clearings) {
    const elevated = clearing.elevated ?? clearing.chapter === CHAPTER_CROWNED_RETURN;
    if (elevated) continue;
    const dx = x - clearing.position[0];
    const dz = z - clearing.position[2];
    const distance = Math.sqrt(dx * dx + dz * dz);
    const protectedClearingRadius = (clearing.radius ?? config.clearingSafeRadius) * 1.35;
    crownRampProtection = Math.max(
      crownRampProtection,
      1 -
        smoothstep(
          protectedClearingRadius * 0.52,
          protectedClearingRadius,
          distance,
        ),
    );
  }

  for (const path of config.paths) {
    if (!path.crownRamp) continue;

    const outerRadius = config.crownedRampWidth * 2.05;
    if (distanceToPathBoundsSq(x, z, path) > outerRadius * outerRadius) {
      continue;
    }

    const t = terrainPathProjectionT(x, z, path, config);
    const projectedPoint = terrainCurvedPathPointAt(path, t, config);
    const distanceSq =
      (x - projectedPoint[0]) ** 2 + (z - projectedPoint[1]) ** 2;
    const influence =
      1 -
      smoothstep(
        config.crownedRampWidth * 0.5,
        config.crownedRampWidth * 2.05,
        Math.sqrt(distanceSq),
      );
    const protectedInfluence = influence * (1 - crownRampProtection);
    const segmentElevation = lerpTerrainValue(
      path.sourceY,
      path.targetY,
      t,
    );
    elevation = lerpTerrainValue(
      elevation,
      Math.max(elevation, segmentElevation),
      protectedInfluence,
    );
  }

  for (const clearing of config.clearings) {
    const elevated = clearing.elevated ?? clearing.chapter === CHAPTER_CROWNED_RETURN;
    if (!elevated) continue;
    const dx = x - clearing.position[0];
    const dz = z - clearing.position[2];
    const distance = Math.sqrt(dx * dx + dz * dz);
    const authoredRadius = clearing.radius ?? config.clearingSafeRadius;
    const crownInnerRadius = authoredRadius * 0.72;
    const crownOuterRadius = authoredRadius * 2.2;
    const influence =
      (1 - smoothstep(crownInnerRadius, crownOuterRadius, distance)) *
      (1 - crownRampProtection);
    elevation = lerpTerrainValue(
      elevation,
      Math.max(elevation, clearing.position[1]),
      influence,
    );
  }

  return elevation;
}

/**
 * Builds a sampler for the exact triangle surface emitted by THREE.PlaneGeometry.
 *
 * Terrain vertices are quantized to Float32 because the worker transfers a
 * Float32Array to both the visible mesh and Rapier. Sampling the same diagonal
 * split here keeps player grounding and object placement on that collider
 * surface instead of on the continuous noise function between vertices.
 */
export function createTerrainSurfaceSampler(
  config: TerrainSamplerConfig,
  terrainSize: number,
  terrainSegments: number,
) {
  const size = Math.max(1, Number.isFinite(terrainSize) ? terrainSize : 1);
  const segments = Math.max(
    1,
    Math.round(Number.isFinite(terrainSegments) ? terrainSegments : 1),
  );
  const halfSize = size * 0.5;
  const cellSize = size / segments;
  const rowLength = segments + 1;
  const vertexCache = new Map<number, number>();

  const vertexElevation = (column: number, row: number) => {
    const key = row * rowLength + column;
    const cached = vertexCache.get(key);
    if (cached !== undefined) return cached;

    const elevation = Math.fround(
      sampleTerrainElevation(
        -halfSize + column * cellSize,
        -halfSize + row * cellSize,
        config,
      ),
    );
    vertexCache.set(key, elevation);
    return elevation;
  };

  return (x: number, z: number) => {
    const normalizedX =
      (clampTerrainValue(x, -halfSize, halfSize) + halfSize) / cellSize;
    const normalizedZ =
      (clampTerrainValue(z, -halfSize, halfSize) + halfSize) / cellSize;
    const column = Math.min(
      segments - 1,
      Math.max(0, Math.floor(normalizedX)),
    );
    const row = Math.min(
      segments - 1,
      Math.max(0, Math.floor(normalizedZ)),
    );
    const u = clampTerrainUnit(normalizedX - column);
    const v = clampTerrainUnit(normalizedZ - row);

    const a = vertexElevation(column, row);
    const b = vertexElevation(column, row + 1);
    const c = vertexElevation(column + 1, row + 1);
    const d = vertexElevation(column + 1, row);

    if (u + v <= 1) {
      return a + (d - a) * u + (b - a) * v;
    }

    return (
      c +
      (b - c) * (1 - u) +
      (d - c) * (1 - v)
    );
  };
}
