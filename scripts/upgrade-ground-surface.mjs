import fs from "node:fs";
import path from "node:path";

const STORY_SCENE_PATH = path.resolve("src/components/three/StoryScene.tsx");
const FOREST_WORKER_PATH = path.resolve("src/workers/forestWorker.ts");
const PATCH_MARKER = "walkableGroundSurfaceV3";

function readSource(filePath) {
  return fs.readFileSync(filePath, "utf8");
}

function writeIfChanged(filePath, nextSource, label) {
  const currentSource = readSource(filePath);
  if (currentSource === nextSource) {
    console.log(`${label} already present.`);
    return false;
  }
  fs.writeFileSync(filePath, nextSource);
  console.log(`${label} applied.`);
  return true;
}

function replaceAll(source, replacements) {
  let next = source;
  for (const [pattern, replacement] of replacements) {
    next = next.replace(pattern, replacement);
  }
  return next;
}

function replaceFunction(sourceText, functionName, replacement) {
  const start = sourceText.indexOf(functionName);
  if (start === -1) throw new Error(`Could not find ${functionName}`);

  const paramsStart = sourceText.indexOf("(", start);
  if (paramsStart === -1) throw new Error(`Could not find parameter list for ${functionName}`);

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

  if (braceStart === -1) throw new Error(`Could not find opening body brace for ${functionName}`);

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

  throw new Error(`Could not find closing brace for ${functionName}`);
}

function patchStorySceneGroundSurface() {
  if (!fs.existsSync(STORY_SCENE_PATH)) {
    console.log("StoryScene.tsx not found; skipping ground surface patch.");
    return;
  }

  let source = readSource(STORY_SCENE_PATH);
  const original = source;

  if (!source.includes(PATCH_MARKER)) {
    source = source.replace(
      "import \"./StoryScene.css\";",
      `import "./StoryScene.css";\n// ${PATCH_MARKER}: smoother walkable ground, wider flattened paths, and lighter floor detail.`,
    );
  }

  source = replaceAll(source, [
    [/const CLEARING_SAFE_RADIUS = 5\.2;/g, "const CLEARING_SAFE_RADIUS = 6.15;"],
    [/const CORRIDOR_BASE_WIDTH = 3\.7;/g, "const CORRIDOR_BASE_WIDTH = 4.65;"],
    [/const CORRIDOR_MIN_WIDTH = 1\.55;/g, "const CORRIDOR_MIN_WIDTH = 2.25;"],
    [/const CROWNED_RETURN_RAMP_WIDTH = 7\.4;/g, "const CROWNED_RETURN_RAMP_WIDTH = 8.6;"],
    [/const TERRAIN_SEGMENT_BOUNDS_PADDING = 14;/g, "const TERRAIN_SEGMENT_BOUNDS_PADDING = 18;"],
    [/const GROUND_DETAIL_CELL_SIZE = 5\.2;/g, "const GROUND_DETAIL_CELL_SIZE = 6.1;"],
    [/const GROUND_DETAIL_CELL_RADIUS = 5;/g, "const GROUND_DETAIL_CELL_RADIUS = 4;"],
    [/const GROUND_DETAIL_CELL_RADIUS = 4;/g, "const GROUND_DETAIL_CELL_RADIUS = 4;"],
    [/const GROUND_DETAILS_PER_CELL = 3;/g, "const GROUND_DETAILS_PER_CELL = 2;"],
  ]);

  const flatGroundPattern = /<planeGeometry args=\{\[840, 840, 1, 1\]\} \/>\s*<meshBasicMaterial color=\{visualState\.palette\.ground\} transparent opacity=\{visualState\.groundOpacity\} \/>/;
  const enhancedGround = `<planeGeometry args={[900, 900, 8, 8]} />
        {/* ${PATCH_MARKER}: lit, low-frequency terrain base so the floor reads clearly without noisy geometry. */}
        <meshStandardMaterial
          color={visualState.palette.ground}
          roughness={0.98}
          metalness={0.01}
          emissive={visualState.palette.emissive}
          emissiveIntensity={0.01 + narrativeWorldState.symbolicWeight * 0.008}
          transparent
          opacity={visualState.groundOpacity}
        />`;

  if (flatGroundPattern.test(source)) {
    source = source.replace(flatGroundPattern, enhancedGround);
  } else {
    const groundMaterialPattern = /<meshBasicMaterial color=\{visualState\.palette\.ground\} transparent opacity=\{visualState\.groundOpacity\} \/>/;
    if (groundMaterialPattern.test(source)) {
      source = source
        .replace(/<planeGeometry args=\{\[840, 840, 1, 1\]\} \/>/, `<planeGeometry args={[900, 900, 8, 8]} />`)
        .replace(groundMaterialPattern, `{/* ${PATCH_MARKER}: lit, low-noise terrain base. */}\n        <meshStandardMaterial\n          color={visualState.palette.ground}\n          roughness={0.98}\n          metalness={0.01}\n          emissive={visualState.palette.emissive}\n          emissiveIntensity={0.01 + narrativeWorldState.symbolicWeight * 0.008}\n          transparent\n          opacity={visualState.groundOpacity}\n        />`);
    }
  }

  if (source === original) {
    console.log("No StoryScene ground targets found; existing terrain system left unchanged.");
    return;
  }

  writeIfChanged(STORY_SCENE_PATH, source, "Walkable ground surface upgrade");
}

function patchForestWorkerTerrain() {
  if (!fs.existsSync(FOREST_WORKER_PATH)) {
    console.log("forestWorker.ts not found; skipping terrain worker patch.");
    return;
  }

  let source = readSource(FOREST_WORKER_PATH);
  const original = source;

  if (!source.includes(PATCH_MARKER)) {
    source = source.replace(
      "const BEZIER_DISTANCE_SAMPLES = 22;",
      `const BEZIER_DISTANCE_SAMPLES = 22;\n// ${PATCH_MARKER}: smoother walkable terrain with broader trail flattening and less foot jitter.`,
    );
  }

  source = replaceFunction(
    source,
    "function terrainNoiseAtPoint",
    `function terrainNoiseAtPoint(x: number, z: number, explorationDepth = 0, memoryPressure = 0) {
  // Keep broad hills, but remove the harsh fine ridges that make first-person walking feel sticky.
  const broad = valueNoise2D(x * 0.01, z * 0.01, 31.4) * 2 - 1;
  const mid = valueNoise2D(x * 0.028 + 17.2, z * 0.028 - 8.5, 71.1) * 2 - 1;
  const fine = valueNoise2D(x * 0.072 - 4.2, z * 0.072 + 11.9, 113.7) * 2 - 1;
  const pressureRidge = 1 - Math.abs(valueNoise2D(x * 0.052 + 5.9, z * 0.052 - 2.1, 171.3) * 2 - 1);
  return broad * 1.55 + mid * 0.72 + fine * 0.16 + pressureRidge * memoryPressure * 0.42 + explorationDepth * 0.26;
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
    const corridorCore = config.corridorBaseWidth * 0.72;
    const corridorShoulder = config.corridorBaseWidth * (2.25 + explorationDepth * 0.16);
    const influence = 1 - smoothstep(corridorCore, corridorShoulder, distance);
    const tread = 1 - smoothstep(config.corridorBaseWidth * 0.2, config.corridorBaseWidth * 0.95, distance);
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
      1 - smoothstep(config.clearingSafeRadius * 0.5, config.clearingSafeRadius * 1.72, distance),
    );
  }

  const flattenStrength = Math.min(0.94, pathFlatten * 0.84 + clearingFlatten * 0.92);
  elevation *= 1 - flattenStrength;
  elevation -= pathTread * (0.025 + memoryPressure * 0.018);

  for (const path of config.paths) {
    const touchesCrown =
      path.sourceChapter === CHAPTER_CROWNED_RETURN ||
      path.targetChapter === CHAPTER_CROWNED_RETURN;
    if (!touchesCrown) continue;

    const t = segmentProjectionT(x, z, path, config);
    const distanceSq = distancePointToSegmentSq(x, z, path, config);
    const influence =
      1 - smoothstep(config.crownedRampWidth * 0.5, config.crownedRampWidth * 1.9, Math.sqrt(distanceSq));
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

  source = replaceAll(source, [
    [/const pathBrightening = pathInfluence \* \(0\.16 \+ explorationDepth \* 0\.06\);/g, "const pathBrightening = pathInfluence * (0.2 + explorationDepth * 0.075);"],
    [/const clearingSoftening = clearingInfluence \* 0\.1;/g, "const clearingSoftening = clearingInfluence * 0.14;"],
    [/const elevationShade = Math\.max\(-0\.12, Math\.min\(0\.18, lift \* 0\.032\)\);/g, "const elevationShade = Math.max(-0.08, Math.min(0.12, lift * 0.024));"],
    [/const noiseShade = \(rootNoise - 0\.5\) \* 0\.12 \+ \(microNoise - 0\.5\) \* 0\.035;/g, "const noiseShade = (rootNoise - 0.5) * 0.075 + (microNoise - 0.5) * 0.018;"],
    [/const memoryDarken = memoryPressure \* \(0\.08 \+ \(1 - pathInfluence\) \* 0\.07\);/g, "const memoryDarken = memoryPressure * (0.055 + (1 - pathInfluence) * 0.055);"],
  ]);

  if (source === original) {
    console.log("Walkable terrain worker upgrade already present.");
    return;
  }

  writeIfChanged(FOREST_WORKER_PATH, source, "Walkable terrain worker upgrade");
}

patchStorySceneGroundSurface();
patchForestWorkerTerrain();
