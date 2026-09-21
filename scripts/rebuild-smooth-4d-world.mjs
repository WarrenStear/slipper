import fs from "node:fs";
import path from "node:path";

const PATCH_MARKER = "smooth4DWorldRebuildV1";
const STORY_SCENE_PATH = path.resolve("src/components/three/StoryScene.tsx");
const FOREST_WORKER_PATH = path.resolve("src/workers/forestWorker.ts");
const RENDER_QUALITY_PATH = path.resolve("src/components/three/renderQuality.ts");
const WORLD_CANVAS_PATH = path.resolve("src/components/three/WorldCanvas.tsx");

function read(filePath) {
  return fs.existsSync(filePath) ? fs.readFileSync(filePath, "utf8") : "";
}

function writeIfChanged(filePath, next, label) {
  const current = read(filePath);
  if (current === next) {
    console.log(`[${PATCH_MARKER}] ${label}: already clean`);
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

function replaceSequence(source, pattern, values) {
  let index = 0;
  return source.replace(pattern, (match) => {
    const value = values[Math.min(index, values.length - 1)];
    index += 1;
    return match.replace(/: [0-9.]+,/, `: ${value},`);
  });
}

function addMarker(source, anchor, comment) {
  if (source.includes(PATCH_MARKER)) return source;
  if (source.includes(anchor)) return source.replace(anchor, `${anchor}\n${comment}`);
  return `${comment}\n${source}`;
}

function patchForestWorker() {
  if (!fs.existsSync(FOREST_WORKER_PATH)) return console.log(`[${PATCH_MARKER}] forestWorker.ts missing; skipped`);
  let source = read(FOREST_WORKER_PATH);

  source = addMarker(
    source,
    "const BEZIER_DISTANCE_SAMPLES = 22;",
    `// ${PATCH_MARKER}: rebuilt terrain for smooth, broad, stable, realistic walkable surfaces.`,
  );

  source = replaceFunction(
    source,
    "function terrainNoiseAtPoint",
    `function terrainNoiseAtPoint(x: number, z: number, explorationDepth = 0, memoryPressure = 0) {
  // Broad, low-frequency relief only. This avoids lumpy collision jitter and keeps the forest floor believable.
  const continent = valueNoise2D(x * 0.0065, z * 0.0065, 11.7) * 2 - 1;
  const broad = valueNoise2D(x * 0.014, z * 0.014, 31.4) * 2 - 1;
  const mid = valueNoise2D(x * 0.032 + 17.2, z * 0.032 - 8.5, 71.1) * 2 - 1;
  const fine = valueNoise2D(x * 0.068 - 4.2, z * 0.068 + 11.9, 113.7) * 2 - 1;
  const emotionalUndulation = 1 - Math.abs(valueNoise2D(x * 0.04 + 5.9, z * 0.04 - 2.1, 171.3) * 2 - 1);

  return (
    continent * 0.82 +
    broad * 0.72 +
    mid * 0.28 +
    fine * 0.055 +
    emotionalUndulation * memoryPressure * 0.12 +
    explorationDepth * 0.1
  );
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
  const endpointFade = smoothstep(0.08, 0.28, t) * (1 - smoothstep(0.72, 0.94, t));
  const frequency = 1.2 + memoryPressure * 1.9 + explorationDepth * 0.35;
  const seedPhase = path.curveSeed * 0.009;
  const wave = Math.sin(t * Math.PI * 2 * frequency + seedPhase) * 0.72 + Math.sin(t * Math.PI * 2 * 0.75 + seedPhase * 0.37) * 0.28;
  const amplitude = endpointFade * memoryPressure * (0.42 + explorationDepth * 0.16);

  return [point[0] + normal[0] * wave * amplitude, point[1] + normal[1] * wave * amplitude];
}`,
  );

  source = replaceFunction(
    source,
    "function terrainElevationAtPoint",
    `function terrainElevationAtPoint(x: number, z: number, config: TerrainSamplerConfig) {
  const memoryPressure = clamp01(config.memoryPressure);
  const explorationDepth = clamp01(config.explorationDepth);
  let elevation = terrainNoiseAtPoint(x, z, explorationDepth, memoryPressure);

  let pathFlatten = 0;
  let pathTread = 0;
  for (const path of config.paths) {
    const distance = Math.sqrt(distancePointToSegmentSq(x, z, path, config));
    const core = config.corridorBaseWidth * 0.88;
    const shoulder = config.corridorBaseWidth * (2.6 + explorationDepth * 0.12);
    const influence = 1 - smoothstep(core, shoulder, distance);
    const tread = 1 - smoothstep(config.corridorBaseWidth * 0.18, config.corridorBaseWidth * 1.08, distance);
    pathFlatten = Math.max(pathFlatten, influence);
    pathTread = Math.max(pathTread, tread);
  }

  let clearingFlatten = 0;
  for (const clearing of config.clearings) {
    const dx = x - clearing.position[0];
    const dz = z - clearing.position[2];
    const distance = Math.sqrt(dx * dx + dz * dz);
    clearingFlatten = Math.max(
      clearingFlatten,
      1 - smoothstep(config.clearingSafeRadius * 0.58, config.clearingSafeRadius * 1.95, distance),
    );
  }

  const flattenStrength = Math.min(0.965, pathFlatten * 0.9 + clearingFlatten * 0.94);
  elevation *= 1 - flattenStrength;
  elevation -= pathTread * 0.018;

  for (const path of config.paths) {
    const touchesCrown =
      path.sourceChapter === CHAPTER_CROWNED_RETURN ||
      path.targetChapter === CHAPTER_CROWNED_RETURN;
    if (!touchesCrown) continue;

    const t = segmentProjectionT(x, z, path, config);
    const distanceSq = distancePointToSegmentSq(x, z, path, config);
    const influence = 1 - smoothstep(config.crownedRampWidth * 0.6, config.crownedRampWidth * 2.2, Math.sqrt(distanceSq));
    const segmentElevation = lerp(path.sourceY, path.targetY, t);
    elevation = lerp(elevation, Math.max(elevation, segmentElevation), influence);
  }

  for (const clearing of config.clearings) {
    if (clearing.chapter !== CHAPTER_CROWNED_RETURN) continue;
    const dx = x - clearing.position[0];
    const dz = z - clearing.position[2];
    const distance = Math.sqrt(dx * dx + dz * dz);
    const influence = 1 - smoothstep(10, 30, distance);
    elevation = lerp(elevation, Math.max(elevation, clearing.position[1]), influence);
  }

  return elevation;
}`,
  );

  source = source
    .replace(/const pathBrightening = pathInfluence \* \([^)]+\);/g, "const pathBrightening = pathInfluence * (0.24 + explorationDepth * 0.08);")
    .replace(/const clearingSoftening = clearingInfluence \* [0-9.]+;/g, "const clearingSoftening = clearingInfluence * 0.18;")
    .replace(/const elevationShade = Math\.max\(-[0-9.]+, Math\.min\([0-9.]+, lift \* [0-9.]+\)\);/g, "const elevationShade = Math.max(-0.055, Math.min(0.085, lift * 0.018));")
    .replace(/const noiseShade = \(rootNoise - 0\.5\) \* [0-9.]+ \+ \(microNoise - 0\.5\) \* [0-9.]+;/g, "const noiseShade = (rootNoise - 0.5) * 0.048 + (microNoise - 0.5) * 0.01;")
    .replace(/const memoryDarken = memoryPressure \* \([^)]+\);/g, "const memoryDarken = memoryPressure * (0.038 + (1 - pathInfluence) * 0.038);");

  writeIfChanged(FOREST_WORKER_PATH, source, "terrain worker rebuild");
}

function patchStoryScene() {
  if (!fs.existsSync(STORY_SCENE_PATH)) return console.log(`[${PATCH_MARKER}] StoryScene.tsx missing; skipped`);
  let source = read(STORY_SCENE_PATH);
  source = addMarker(source, "import \"./StoryScene.css\";", `// ${PATCH_MARKER}: smooth, realistic, low-glitch 4D world rebuild.`);

  const replacements = [
    [/const PLAYER_SPEED = [0-9.]+;/g, "const PLAYER_SPEED = 4.05;"],
    [/const PLAYER_ACCELERATION = [0-9.]+;/g, "const PLAYER_ACCELERATION = 8.4;"],
    [/const PLAYER_LINEAR_DAMPING = [0-9.]+;/g, "const PLAYER_LINEAR_DAMPING = 13;"],
    [/const HEAD_BOB_AMPLITUDE = [0-9.]+;/g, "const HEAD_BOB_AMPLITUDE = 0.01;"],
    [/const HEAD_BOB_FREQUENCY = [0-9.]+;/g, "const HEAD_BOB_FREQUENCY = 6.6;"],
    [/const NODE_ACTIVATION_RADIUS = [0-9.]+;/g, "const NODE_ACTIVATION_RADIUS = 3.55;"],
    [/const NODE_APPROACH_RADIUS = [0-9.]+;/g, "const NODE_APPROACH_RADIUS = 11.25;"],
    [/const FOREST_CELL_RADIUS = [0-9]+;/g, "const FOREST_CELL_RADIUS = 4;"],
    [/const FOREST_TREES_PER_CELL = [0-9]+;/g, "const FOREST_TREES_PER_CELL = 3;"],
    [/const DECORATION_CELL_RADIUS = [0-9]+;/g, "const DECORATION_CELL_RADIUS = 4;"],
    [/const DECORATIONS_PER_CELL = [0-9]+;/g, "const DECORATIONS_PER_CELL = 1;"],
    [/const GROUND_DETAIL_CELL_SIZE = [0-9.]+;/g, "const GROUND_DETAIL_CELL_SIZE = 7.2;"],
    [/const GROUND_DETAIL_CELL_RADIUS = [0-9]+;/g, "const GROUND_DETAIL_CELL_RADIUS = 3;"],
    [/const GROUND_DETAILS_PER_CELL = [0-9]+;/g, "const GROUND_DETAILS_PER_CELL = 1;"],
    [/const TERRAIN_SEGMENT_BOUNDS_PADDING = [0-9.]+;/g, "const TERRAIN_SEGMENT_BOUNDS_PADDING = 22;"],
    [/const CLEARING_SAFE_RADIUS = [0-9.]+;/g, "const CLEARING_SAFE_RADIUS = 7.4;"],
    [/const CORRIDOR_BASE_WIDTH = [0-9.]+;/g, "const CORRIDOR_BASE_WIDTH = 5.8;"],
    [/const CORRIDOR_MIN_WIDTH = [0-9.]+;/g, "const CORRIDOR_MIN_WIDTH = 3.2;"],
    [/const TREE_COLLIDER_LIMIT = [0-9]+;/g, "const TREE_COLLIDER_LIMIT = 56;"],
    [/const PORTAL_TRIGGER_RADIUS = [0-9.]+;/g, "const PORTAL_TRIGGER_RADIUS = 1.08;"],
    [/const CROWNED_RETURN_RAMP_WIDTH = [0-9.]+;/g, "const CROWNED_RETURN_RAMP_WIDTH = 10.2;"],
    [/const PLAYER_GROUND_SNAP = [0-9.]+;/g, "const PLAYER_GROUND_SNAP = 0.46;"],
    [/const PLAYER_STEP_HEIGHT = [0-9.]+;/g, "const PLAYER_STEP_HEIGHT = 0.52;"],
    [/const PLAYER_MIN_STEP_WIDTH = [0-9.]+;/g, "const PLAYER_MIN_STEP_WIDTH = 0.24;"],
  ];

  for (const [pattern, replacement] of replacements) source = source.replace(pattern, replacement);

  source = source.replace(
    /const PLAYER_SLOPE_LIMIT_RADIANS = THREE\.MathUtils\.degToRad\([0-9.]+\);/g,
    "const PLAYER_SLOPE_LIMIT_RADIANS = THREE.MathUtils.degToRad(42);",
  );
  source = source.replace(
    /controller\.setMinSlopeSlideAngle\(THREE\.MathUtils\.degToRad\([0-9.]+\)\);/g,
    "controller.setMinSlopeSlideAngle(THREE.MathUtils.degToRad(50));",
  );

  writeIfChanged(STORY_SCENE_PATH, source, "StoryScene smooth-world rebuild");
}

function patchRenderQuality() {
  if (!fs.existsSync(RENDER_QUALITY_PATH)) return console.log(`[${PATCH_MARKER}] renderQuality.ts missing; skipped`);
  let source = read(RENDER_QUALITY_PATH);
  source = addMarker(source, "export const RENDER_QUALITY_STORAGE_KEY", `// ${PATCH_MARKER}: stable quality budgets for a realistic, non-glitchy 4D world.`);

  source = replaceSequence(source, /particleMultiplier: [0-9.]+,/g, [0.34, 0.48, 0.62, 0.76]);
  source = replaceSequence(source, /semanticDensityMultiplier: [0-9.]+,/g, [0.36, 0.46, 0.58, 0.68]);
  source = replaceSequence(source, /starMultiplier: [0-9.]+,/g, [0.26, 0.38, 0.52, 0.66]);
  source = replaceSequence(source, /pixelRatioCap: [0-9.]+,/g, [0.86, 0.96, 1.06, 1.14]);
  source = replaceSequence(source, /groundDetailMultiplier: [0-9.]+,/g, [0.18, 0.28, 0.38, 0.5]);
  source = replaceSequence(source, /weatherLayerMultiplier: [0-9.]+,/g, [0.26, 0.42, 0.58, 0.72]);
  source = replaceSequence(source, /landmarkSilhouetteMultiplier: [0-9.]+,/g, [0.42, 0.54, 0.68, 0.8]);
  source = replaceSequence(source, /pathLightMoteCount: [0-9]+,/g, [16, 22, 30, 38]);
  source = replaceSequence(source, /shadowMapSize: [0-9]+,/g, [384, 512, 640, 768]);

  source = source.replace(
    /const capMultiplier = clamp\(1 - memoryPressurePenalty - elementalInstabilityPenalty \+ clarityLift, [0-9.]+, [0-9.]+\);/g,
    "const capMultiplier = clamp(1 - memoryPressurePenalty - elementalInstabilityPenalty + clarityLift, 0.68, 1.02);",
  );
  source = source.replace(
    /const narrativePixelRatioCap = clamp\(qualityProfile\.pixelRatioCap \* capMultiplier, [0-9.]+, qualityProfile\.pixelRatioCap \* [0-9.]+\);/g,
    "const narrativePixelRatioCap = clamp(qualityProfile.pixelRatioCap * capMultiplier, 0.64, qualityProfile.pixelRatioCap * 1.02);",
  );
  source = source.replace(
    /const effectivePixelRatio = clamp\(Math\.min\(devicePixelRatio, narrativePixelRatioCap\), [0-9.]+, [0-9.]+\);/g,
    "const effectivePixelRatio = clamp(Math.min(devicePixelRatio, narrativePixelRatioCap), 0.62, 1.16);",
  );

  writeIfChanged(RENDER_QUALITY_PATH, source, "render-quality smooth-world rebuild");
}

function patchWorldCanvas() {
  if (!fs.existsSync(WORLD_CANVAS_PATH)) return console.log(`[${PATCH_MARKER}] WorldCanvas.tsx missing; skipped`);
  let source = read(WORLD_CANVAS_PATH);
  // Put the marker after the last import. Never insert it into the type alias declaration.
  source = addMarker(source, "import type { NarrativeWorldState, SceneProximityState, StorySceneControls, StorySceneMode } from \"./StoryScene\";", `// ${PATCH_MARKER}: renderer stability profile for smooth 4D terrain.`);

  source = source.replace(
    /const canvasDpr = useMemo<\[number, number\]>\(\(\) => \[[^\]]+\], \[renderScale\.effectivePixelRatio\]\);/g,
    "const canvasDpr = useMemo<[number, number]>(() => [0.62, Math.max(0.66, Math.min(1.12, renderScale.effectivePixelRatio))], [renderScale.effectivePixelRatio]);",
  );
  source = source.replace(
    /gl\.setPixelRatio\([^;]+\);/g,
    "gl.setPixelRatio(THREE.MathUtils.clamp(renderScale.effectivePixelRatio, 0.62, qualityProfile.quality === \"cinematic\" ? 1.14 : 1.08));",
  );
  source = source.replace(
    /gl=\{\{ antialias: false, alpha: false, powerPreference: "high-performance", failIfMajorPerformanceCaveat: false(?:, stencil: false, depth: true)? \}\}/g,
    'gl={{ antialias: false, alpha: false, powerPreference: "high-performance", failIfMajorPerformanceCaveat: false, stencil: false, depth: true }}',
  );
  source = source.replace(/performance=\{\{ min: [0-9.]+, debounce: [0-9]+ \}\}/g, "performance={{ min: 0.32, debounce: 640 }}");
  source = source.replace(/<fog attach="fog" args=\{\["#030305", [0-9.]+, [0-9.]+\]\} \/>/g, '<fog attach="fog" args={["#030305", 13, 38]} />');
  source = source.replace(/<ambientLight intensity=\{[0-9.]+\} \/>/g, "<ambientLight intensity={0.62} />");
  source = source.replace(/<Stars radius=\{32\} depth=\{18\} count=\{1800\} factor=\{2\.4\} saturation=\{0\} fade speed=\{0\.08\} \/>/g, "<Stars radius={30} depth={14} count={720} factor={1.8} saturation={0} fade speed={0.035} />");

  if (/type WorldCanvasProps =\s*\/\/ smooth4DWorldRebuildV1/.test(source)) {
    throw new Error(`[${PATCH_MARKER}] Marker was inserted inside WorldCanvasProps type declaration`);
  }

  writeIfChanged(WORLD_CANVAS_PATH, source, "WorldCanvas smooth-world rebuild");
}

patchForestWorker();
patchStoryScene();
patchRenderQuality();
patchWorldCanvas();
