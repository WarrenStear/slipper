import fs from "node:fs";
import path from "node:path";

const PATCH_MARKER = "worldEngineReshapeV1";
const FOREST_WORKER_PATH = path.resolve("src/workers/forestWorker.ts");
const WORLD_CANVAS_PATH = path.resolve("src/components/three/WorldCanvas.tsx");
const STORY_SCENE_WRAPPER_PATH = path.resolve("src/components/three/StorySceneWithMasterLantern.tsx");

function read(filePath) {
  return fs.existsSync(filePath) ? fs.readFileSync(filePath, "utf8") : "";
}

function writeIfChanged(filePath, next, label) {
  const current = read(filePath);
  if (current === next) {
    console.log(`[${PATCH_MARKER}] ${label}: already preserved`);
    return false;
  }

  fs.writeFileSync(filePath, next);
  console.log(`[${PATCH_MARKER}] ${label}: applied`);
  return true;
}

function replaceFunction(sourceText, functionName, replacement) {
  const start = sourceText.indexOf(functionName);
  if (start === -1) throw new Error(`[${PATCH_MARKER}] Could not find ${functionName}`);

  const paramsStart = sourceText.indexOf("(", start);
  if (paramsStart === -1) throw new Error(`[${PATCH_MARKER}] Could not find parameter list for ${functionName}`);

  let paramDepth = 0;
  let paramQuote = null;
  let paramEscaped = false;
  let braceStart = -1;

  for (let index = paramsStart; index < sourceText.length; index += 1) {
    const char = sourceText[index];
    if (paramQuote) {
      if (paramEscaped) paramEscaped = false;
      else if (char === "\\") paramEscaped = true;
      else if (char === paramQuote) paramQuote = null;
      continue;
    }
    if (char === '"' || char === "'" || char === "`") {
      paramQuote = char;
      continue;
    }
    if (char === "(") paramDepth += 1;
    if (char === ")") {
      paramDepth -= 1;
      if (paramDepth === 0) {
        braceStart = sourceText.indexOf("{", index);
        break;
      }
    }
  }

  if (braceStart === -1) throw new Error(`[${PATCH_MARKER}] Could not find opening body brace for ${functionName}`);

  let depth = 0;
  let quote = null;
  let escaped = false;
  let lineComment = false;
  let blockComment = false;

  for (let index = braceStart; index < sourceText.length; index += 1) {
    const char = sourceText[index];
    const next = sourceText[index + 1] ?? "";

    if (lineComment) {
      if (char === "\n") lineComment = false;
      continue;
    }
    if (blockComment) {
      if (char === "*" && next === "/") {
        blockComment = false;
        index += 1;
      }
      continue;
    }
    if (quote) {
      if (escaped) escaped = false;
      else if (char === "\\") escaped = true;
      else if (char === quote) quote = null;
      continue;
    }
    if (char === "/" && next === "/") {
      lineComment = true;
      index += 1;
      continue;
    }
    if (char === "/" && next === "*") {
      blockComment = true;
      index += 1;
      continue;
    }
    if (char === '"' || char === "'" || char === "`") {
      quote = char;
      continue;
    }
    if (char === "{") depth += 1;
    if (char === "}") {
      depth -= 1;
      if (depth === 0) return sourceText.slice(0, start) + replacement + sourceText.slice(index + 1);
    }
  }

  throw new Error(`[${PATCH_MARKER}] Could not find closing brace for ${functionName}`);
}

function patchForestWorker() {
  if (!fs.existsSync(FOREST_WORKER_PATH)) {
    console.log(`[${PATCH_MARKER}] forestWorker.ts missing; skipped`);
    return;
  }

  let source = read(FOREST_WORKER_PATH);

  source = source.replace(/const BEZIER_DISTANCE_SAMPLES = \d+;/, "const BEZIER_DISTANCE_SAMPLES = 24;");

  source = replaceFunction(
    source,
    "function terrainNoiseAtPoint",
    `function terrainNoiseAtPoint(x: number, z: number, explorationDepth = 0, memoryPressure = 0) {
  const broad = valueNoise2D(x * 0.01, z * 0.01, 31.4) * 2 - 1;
  const mid = valueNoise2D(x * 0.032 + 17.2, z * 0.032 - 8.5, 71.1) * 2 - 1;
  const fine = valueNoise2D(x * 0.074 - 4.2, z * 0.074 + 11.9, 113.7) * 2 - 1;
  const pressureRidge = 1 - Math.abs(valueNoise2D(x * 0.052 + 5.9, z * 0.052 - 2.1, 171.3) * 2 - 1);

  return broad * 0.82 + mid * 0.34 + fine * 0.12 + pressureRidge * memoryPressure * 0.2 + explorationDepth * 0.1;
}`,
  );

  source = replaceFunction(
    source,
    "function curvedPathPointAt",
    `function curvedPathPointAt(path: ForestPathSeed, t: number, config: TerrainSamplerConfig): Vec2 {
  const point = cubicBezierPoint(path, clamp01(t));
  const memoryPressure = clamp01(config.memoryPressure);
  const explorationDepth = clamp01(config.explorationDepth);
  if (memoryPressure <= 0.001 && explorationDepth <= 0.001) return point;

  const tangent = cubicBezierTangent(path, t);
  const normal: Vec2 = [-tangent[1], tangent[0]];
  const endpointFade = smoothstep(0.04, 0.22, t) * (1 - smoothstep(0.78, 0.96, t));
  const frequency = lerp(1.4, 4.6, memoryPressure) + explorationDepth * 0.8;
  const seedPhase = path.curveSeed * 0.013;
  const highWave = Math.sin(t * Math.PI * 2 * frequency + seedPhase);
  const lowWave = Math.sin(t * Math.PI * 2 * 1.15 + seedPhase * 0.37) * 0.24;
  const amplitude = endpointFade * (memoryPressure * 0.62 + explorationDepth * memoryPressure * 0.2);
  return [point[0] + normal[0] * (highWave + lowWave) * amplitude, point[1] + normal[1] * (highWave + lowWave) * amplitude];
}`,
  );

  source = replaceFunction(
    source,
    "function terrainElevationAtPoint",
    `function terrainElevationAtPoint(x: number, z: number, config: TerrainSamplerConfig) {
  const memoryPressure = clamp01(config.memoryPressure);
  const explorationDepth = clamp01(config.explorationDepth);
  const tuning = resolveWorldShapeTuning(config);
  let elevation = terrainNoiseAtPoint(x, z, explorationDepth, memoryPressure) * tuning.terrainAmplitude;

  let pathFlatten = 0;
  for (const path of config.paths) {
    const distance = Math.sqrt(distancePointToSegmentSq(x, z, path, config));
    const corridorWidth = config.corridorBaseWidth * tuning.corridorMultiplier;
    pathFlatten = Math.max(
      pathFlatten,
      1 - smoothstep(corridorWidth * 0.28, corridorWidth * tuning.corridorSoftness, distance),
    );
  }

  for (const clearing of config.clearings) {
    const dx = x - clearing.position[0];
    const dz = z - clearing.position[2];
    const distance = Math.sqrt(dx * dx + dz * dz);
    const clearingRadius = config.clearingSafeRadius * tuning.clearingMultiplier;
    pathFlatten = Math.max(
      pathFlatten,
      1 - smoothstep(clearingRadius * 0.26, clearingRadius * tuning.clearingSoftness, distance),
    );
  }

  const walkableFloorBias = -0.045 * pathFlatten;
  elevation = lerp(elevation, walkableFloorBias, pathFlatten * tuning.pathFlattenStrength);
  elevation = clamp(elevation, tuning.terrainClampMin, tuning.terrainClampMax);

  for (const path of config.paths) {
    const touchesCrown =
      path.sourceChapter === CHAPTER_CROWNED_RETURN ||
      path.targetChapter === CHAPTER_CROWNED_RETURN;
    if (!touchesCrown) continue;

    const t = segmentProjectionT(x, z, path, config);
    const distanceSq = distancePointToSegmentSq(x, z, path, config);
    const influence =
      1 - smoothstep(config.crownedRampWidth * 0.46, config.crownedRampWidth * 1.8, Math.sqrt(distanceSq));
    const segmentElevation = lerp(path.sourceY, path.targetY, t);
    elevation = lerp(elevation, Math.max(elevation, segmentElevation), influence);
  }

  for (const clearing of config.clearings) {
    if (clearing.chapter !== CHAPTER_CROWNED_RETURN) continue;
    const dx = x - clearing.position[0];
    const dz = z - clearing.position[2];
    const distance = Math.sqrt(dx * dx + dz * dz);
    const influence = 1 - smoothstep(8, 24, distance);
    elevation = lerp(elevation, Math.max(elevation, clearing.position[1]), influence);
  }

  return elevation;
}`,
  );

  writeIfChanged(FOREST_WORKER_PATH, source, "terrain shaping invariants");
}

function patchWorldCanvas() {
  if (!fs.existsSync(WORLD_CANVAS_PATH)) {
    console.log(`[${PATCH_MARKER}] WorldCanvas.tsx missing; skipped`);
    return;
  }

  let source = read(WORLD_CANVAS_PATH);
  source = source.replace(
    /<CuboidCollider args=\{\[420, 0\.(?:1|12), 420\]\} position=\{\[0, -1\.34, 0\]\} \/>/,
    '<CuboidCollider args={[420, 0.1, 420]} position={[0, -3, 0]} />',
  );
  source = source.replace(
    /<CuboidCollider args=\{\[420, 0\.(?:1|12), 420\]\} position=\{\[0, -3, 0\]\} \/>/,
    '<CuboidCollider args={[420, 0.1, 420]} position={[0, -3, 0]} />',
  );

  writeIfChanged(WORLD_CANVAS_PATH, source, "terrain safety floor");
}

function assertWorldEngineWrapper() {
  if (!fs.existsSync(STORY_SCENE_WRAPPER_PATH)) return;
  const source = read(STORY_SCENE_WRAPPER_PATH);
  if (!source.includes("WorldEngineLayer")) {
    throw new Error(`[${PATCH_MARKER}] StorySceneWithMasterLantern is no longer routed through WorldEngineLayer`);
  }
  console.log(`[${PATCH_MARKER}] world engine wrapper: preserved`);
}

patchForestWorker();
patchWorldCanvas();
assertWorldEngineWrapper();
