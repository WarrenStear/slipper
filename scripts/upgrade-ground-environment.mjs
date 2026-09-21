import fs from "node:fs";
import path from "node:path";

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

function patchForestWorker() {
  const filePath = path.resolve("src/workers/forestWorker.ts");
  let source = fs.readFileSync(filePath, "utf8");
  const original = source;

  if (!source.includes("const BIOME_GROUND_TINTS")) {
    source = source.replace(
      `function hexToRgb01(value: string): [number, number, number] {
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
`,
      `function hexToRgb01(value: string): [number, number, number] {
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

const BIOME_GROUND_TINTS: Record<WorkerBiome, [number, number, number]> = {
  firstWood: [0.08, 0.105, 0.07],
  mirror: [0.055, 0.13, 0.135],
  thorned: [0.105, 0.075, 0.062],
  archive: [0.045, 0.066, 0.13],
  fireRiver: [0.13, 0.072, 0.04],
  crowned: [0.14, 0.122, 0.065],
};

function mixRgb(a: [number, number, number], b: [number, number, number], t: number): [number, number, number] {
  const amount = clamp01(t);
  return [lerp(a[0], b[0], amount), lerp(a[1], b[1], amount), lerp(a[2], b[2], amount)];
}

function nearestClearingBlend(x: number, z: number, config: { clearings: ForestClearingSeed[] }) {
  let nearestChapter = "";
  let nearestDistanceSq = Number.POSITIVE_INFINITY;

  for (const clearing of config.clearings) {
    const dx = x - clearing.position[0];
    const dz = z - clearing.position[2];
    const distanceSq = dx * dx + dz * dz;
    if (distanceSq < nearestDistanceSq) {
      nearestDistanceSq = distanceSq;
      nearestChapter = clearing.chapter;
    }
  }

  return {
    biome: biomeFromChapter(nearestChapter),
    influence: 1 - smoothstep(18, 72, Math.sqrt(nearestDistanceSq)),
  };
}

function pathInfluenceAtPoint(x: number, z: number, config: TerrainSamplerConfig) {
  let influence = 0;
  for (const path of config.paths) {
    const distance = Math.sqrt(distancePointToSegmentSq(x, z, path, config));
    influence = Math.max(influence, 1 - smoothstep(config.corridorBaseWidth * 0.42, config.corridorBaseWidth * 1.9, distance));
  }
  return influence;
}

function clearingInfluenceAtPoint(x: number, z: number, config: TerrainSamplerConfig) {
  let influence = 0;
  for (const clearing of config.clearings) {
    const dx = x - clearing.position[0];
    const dz = z - clearing.position[2];
    const distance = Math.sqrt(dx * dx + dz * dz);
    influence = Math.max(influence, 1 - smoothstep(config.clearingSafeRadius * 0.52, config.clearingSafeRadius * 1.55, distance));
  }
  return influence;
}
`,
    );
  }

  source = replaceFunction(source, "function generateTerrain", `function generateTerrain(request: GenerateTerrainWorkerRequest): GenerateTerrainWorkerResponse {
  const config = request.config;
  const grid = Math.max(1, Math.floor(config.terrainSegments));
  const vertexSide = grid + 1;
  const vertexCount = vertexSide * vertexSide;
  const positions = new Float32Array(vertexCount * 3);
  const colors = new Float32Array(vertexCount * 3);
  const baseGround = hexToRgb01(config.groundColor);
  const half = config.terrainSize * 0.5;
  const step = config.terrainSize / grid;
  const memoryPressure = clamp01(config.memoryPressure);
  const explorationDepth = clamp01(config.explorationDepth);

  let cursor = 0;
  for (let iz = 0; iz <= grid; iz += 1) {
    const z = iz * step - half;
    for (let ix = 0; ix <= grid; ix += 1) {
      const x = ix * step - half;
      const lift = terrainElevationAtPoint(x, z, config);
      const biomeBlend = nearestClearingBlend(x, z, config);
      const pathInfluence = pathInfluenceAtPoint(x, z, config);
      const clearingInfluence = clearingInfluenceAtPoint(x, z, config);
      const biomeTint = BIOME_GROUND_TINTS[biomeBlend.biome] ?? BIOME_GROUND_TINTS.firstWood;
      const lichenNoise = valueNoise2D(x * 0.19 + 22.4, z * 0.19 - 7.7, 241.5);
      const rootNoise = valueNoise2D(x * 0.052 - 13.1, z * 0.052 + 18.8, 281.7);
      const microNoise = valueNoise2D(x * 0.31 + 4.5, z * 0.31 - 5.1, 331.2);
      const dampness = biomeBlend.biome === "mirror" ? 0.24 : biomeBlend.biome === "archive" ? 0.14 : 0.04;
      const warmth = biomeBlend.biome === "fireRiver" ? 0.2 : biomeBlend.biome === "crowned" ? 0.18 : 0;
      const pathBrightening = pathInfluence * (0.16 + explorationDepth * 0.06);
      const clearingSoftening = clearingInfluence * 0.1;
      const elevationShade = Math.max(-0.12, Math.min(0.18, lift * 0.032));
      const noiseShade = (rootNoise - 0.5) * 0.12 + (microNoise - 0.5) * 0.035;
      const memoryDarken = memoryPressure * (0.08 + (1 - pathInfluence) * 0.07);
      const shade = Math.max(0.54, Math.min(1.2, 0.86 + noiseShade + elevationShade + pathBrightening + clearingSoftening - memoryDarken));
      const tintStrength = 0.34 + biomeBlend.influence * 0.42 + dampness * 0.32 + warmth * 0.22;
      const ground = mixRgb(baseGround, biomeTint, tintStrength);
      const moss = Math.max(0, lichenNoise - 0.54) * (biomeBlend.biome === "fireRiver" ? 0.18 : 0.34);
      const ash = biomeBlend.biome === "fireRiver" ? Math.max(0, microNoise - 0.6) * 0.16 : 0;
      const goldDust = biomeBlend.biome === "crowned" ? Math.max(0, lichenNoise - 0.48) * 0.18 : 0;
      const offset = cursor * 3;

      positions[offset + 0] = x;
      positions[offset + 1] = config.terrainBaseY + lift;
      positions[offset + 2] = z;

      colors[offset + 0] = Math.max(0, Math.min(1, ground[0] * shade + warmth * 0.08 + goldDust * 0.18 - ash * 0.08));
      colors[offset + 1] = Math.max(0, Math.min(1, ground[1] * shade + moss * 0.12 + goldDust * 0.13));
      colors[offset + 2] = Math.max(0, Math.min(1, ground[2] * shade + dampness * 0.1 - ash * 0.06));
      cursor += 1;
    }
  }

  return {
    type: "TERRAIN_READY",
    requestId: request.requestId,
    positions,
    colors,
  };
}`);

  if (source !== original) {
    fs.writeFileSync(filePath, source);
    console.log("Upgraded procedural terrain colour, biome blending, path clarity, and ground micro-detail.");
  } else {
    console.log("Ground/environment worker upgrade already present.");
  }
}

function patchWorldVisualState() {
  const filePath = path.resolve("src/components/three/worldVisualState.ts");
  let source = fs.readFileSync(filePath, "utf8");
  const original = source;

  source = source
    .replace(/firstWood: 0\.010,/g, "firstWood: 0.009,")
    .replace(/mirror: 0\.013,/g, "mirror: 0.012,")
    .replace(/thorned: 0\.017,/g, "thorned: 0.015,")
    .replace(/archive: 0\.014,/g, "archive: 0.012,")
    .replace(/fireRiver: 0\.015,/g, "fireRiver: 0.013,")
    .replace(/crowned: 0\.007,/g, "crowned: 0.006,")
    .replace(
      /biomeFogBase\[biome\] \+ depth \* 0\.010 \+ memory \* 0\.006 \+ proximity \* 0\.002 - director\.skyOpenness \* 0\.006,/,
      "biomeFogBase[biome] + depth * 0.008 + memory * 0.0045 + proximity * 0.0016 - director.skyOpenness * 0.007,",
    )
    .replace(
      /0\.48 - depth \* 0\.14 - memory \* 0\.055 \+ crownPresence \* 0\.1 \+ director\.skyOpenness \* 0\.12,/,
      "0.5 - depth * 0.11 - memory * 0.045 + crownPresence * 0.12 + director.skyOpenness * 0.14,",
    )
    .replace(
      /0\.26 - depth \* 0\.055 \+ fireBias \* 0\.05 \+ crownPresence \* 0\.12 \+ director\.skyOpenness \* 0\.09,/,
      "0.28 - depth * 0.045 + fireBias * 0.055 + crownPresence * 0.13 + director.skyOpenness * 0.1,",
    )
    .replace(
      /0\.12 \+ memory \* 0\.03 \+ crownPresence \* 0\.085 \+ director\.skyOpenness \* 0\.05,/,
      "0.14 + memory * 0.024 + crownPresence * 0.09 + director.skyOpenness * 0.06,",
    )
    .replace(
      /0\.82 - crownPresence \* 0\.08,/,
      "0.86 - crownPresence * 0.06,",
    )
    .replace(
      /0\.72 - crownPresence \* 0\.14 \+ depth \* 0\.04,/,
      "0.7 - crownPresence * 0.1 + depth * 0.035,",
    )
    .replace(
      /0\.3 \+ director\.objectDensity \* 0\.38 \+ pathClarity \* 0\.16 \+ memory \* 0\.08,/,
      "0.34 + director.objectDensity * 0.34 + pathClarity * 0.22 + memory * 0.055,",
    );

  if (source !== original) {
    fs.writeFileSync(filePath, source);
    console.log("Upgraded environment lighting, fog readability, and ground/environment visual balance.");
  } else {
    console.log("World visual-state environment upgrade already present.");
  }
}

patchForestWorker();
patchWorldVisualState();
