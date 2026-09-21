import fs from "node:fs";
import path from "node:path";

const PATCH_MARKER = "fourDWorldMasterPolishV3";
const WORLD_CANVAS_PATH = path.resolve("src/components/three/WorldCanvas.tsx");
const STORY_SCENE_PATH = path.resolve("src/components/three/StoryScene.tsx");
const VISUAL_STATE_PATH = path.resolve("src/components/three/worldVisualState.ts");
const RENDER_QUALITY_PATH = path.resolve("src/components/three/renderQuality.ts");
const WORLD_DIRECTOR_PATH = path.resolve("src/components/three/worldDirector/worldDirector.ts");

function read(filePath) {
  return fs.existsSync(filePath) ? fs.readFileSync(filePath, "utf8") : "";
}

function writeIfChanged(filePath, next, label) {
  const current = read(filePath);
  if (current === next) {
    console.log(`${label} already clean.`);
    return false;
  }
  fs.writeFileSync(filePath, next);
  console.log(`${label} applied.`);
  return true;
}

function replaceAll(source, replacements) {
  let next = source;
  for (const [from, to] of replacements) next = next.split(from).join(to);
  return next;
}

function mark(source, needle, comment) {
  if (source.includes(PATCH_MARKER)) return source;
  if (source.includes(needle)) return source.replace(needle, `${needle}\n${comment}`);
  return `${comment}\n${source}`;
}

function patchWorldCanvas() {
  if (!fs.existsSync(WORLD_CANVAS_PATH)) return console.log("WorldCanvas.tsx not found; skipping 4D renderer polish.");
  const original = read(WORLD_CANVAS_PATH);
  if (original.includes(PATCH_MARKER)) return console.log("4D renderer polish already present.");

  let source = mark(
    original,
    "import { Component, Suspense, useEffect, useMemo, type ErrorInfo, type ReactNode } from \"react\";",
    `// ${PATCH_MARKER}: master renderer tuning for a smoother, cleaner, cinematic 4D world.`,
  );

  source = replaceAll(source, [
    ["<fog attach=\"fog\" args={[\"#030305\", 8, 26]} />", "<fog attach=\"fog\" args={[\"#030305\", 11, 34]} />"],
    ["<ambientLight intensity={0.75} />", "<ambientLight intensity={0.58} />"],
    ["<Stars radius={32} depth={18} count={1800} factor={2.4} saturation={0} fade speed={0.08} />", "<Stars radius={30} depth={14} count={860} factor={1.9} saturation={0} fade speed={0.035} />"],
    ["const canvasDpr = useMemo<[number, number]>(() => [0.72, Math.max(0.72, renderScale.effectivePixelRatio)], [renderScale.effectivePixelRatio]);", "const canvasDpr = useMemo<[number, number]>(() => [0.64, Math.max(0.68, Math.min(1.12, renderScale.effectivePixelRatio))], [renderScale.effectivePixelRatio]);"],
    ["        gl={{ antialias: false, alpha: false, powerPreference: \"high-performance\", failIfMajorPerformanceCaveat: false }}", "        gl={{ antialias: false, alpha: false, powerPreference: \"high-performance\", failIfMajorPerformanceCaveat: false, stencil: false, depth: true }}"],
    ["        performance={{ min: 0.45, debounce: 220 }}", "        performance={{ min: 0.34, debounce: 520 }}"],
    ["      gl.setPixelRatio(renderScale.effectivePixelRatio);", "      gl.setPixelRatio(THREE.MathUtils.clamp(renderScale.effectivePixelRatio, 0.64, qualityProfile.quality === \"cinematic\" ? 1.16 : 1.08));"],
  ]);

  writeIfChanged(WORLD_CANVAS_PATH, source, "4D renderer polish");
}

function patchRenderQuality() {
  if (!fs.existsSync(RENDER_QUALITY_PATH)) return console.log("renderQuality.ts not found; skipping 4D quality polish.");
  const original = read(RENDER_QUALITY_PATH);
  if (original.includes(PATCH_MARKER)) return console.log("4D render-quality polish already present.");

  let source = mark(
    original,
    "import { useEffect, useMemo, useState } from \"react\";",
    `// ${PATCH_MARKER}: balanced quality budgets for beauty without stutter.`,
  );

  source = replaceAll(source, [
    ["particleMultiplier: 0.46,", "particleMultiplier: 0.42,"],
    ["particleMultiplier: 0.64,", "particleMultiplier: 0.6,"],
    ["particleMultiplier: 0.82,", "particleMultiplier: 0.76,"],
    ["semanticDensityMultiplier: 0.58,", "semanticDensityMultiplier: 0.48,"],
    ["semanticDensityMultiplier: 0.68,", "semanticDensityMultiplier: 0.58,"],
    ["semanticDensityMultiplier: 0.82,", "semanticDensityMultiplier: 0.72,"],
    ["semanticDensityMultiplier: 0.94,", "semanticDensityMultiplier: 0.82,"],
    ["starMultiplier: 0.42,", "starMultiplier: 0.34,"],
    ["starMultiplier: 0.64,", "starMultiplier: 0.52,"],
    ["starMultiplier: 0.82,", "starMultiplier: 0.7,"],
    ["pixelRatioCap: 1.0,", "pixelRatioCap: 0.9,"],
    ["pixelRatioCap: 1.05,", "pixelRatioCap: 1.0,"],
    ["pixelRatioCap: 1.18,", "pixelRatioCap: 1.08,"],
    ["pixelRatioCap: 1.35,", "pixelRatioCap: 1.18,"],
    ["groundDetailMultiplier: 0.34,", "groundDetailMultiplier: 0.24,"],
    ["groundDetailMultiplier: 0.58,", "groundDetailMultiplier: 0.38,"],
    ["groundDetailMultiplier: 0.78,", "groundDetailMultiplier: 0.52,"],
    ["groundDetailMultiplier: 1,", "groundDetailMultiplier: 0.68,"],
    ["landmarkSilhouetteMultiplier: 0.58,", "landmarkSilhouetteMultiplier: 0.5,"],
    ["landmarkSilhouetteMultiplier: 0.76,", "landmarkSilhouetteMultiplier: 0.66,"],
    ["landmarkSilhouetteMultiplier: 0.92,", "landmarkSilhouetteMultiplier: 0.82,"],
    ["landmarkSilhouetteMultiplier: 1.08,", "landmarkSilhouetteMultiplier: 0.96,"],
    ["pathLightMoteCount: 26,", "pathLightMoteCount: 20,"],
    ["pathLightMoteCount: 34,", "pathLightMoteCount: 28,"],
    ["pathLightMoteCount: 48,", "pathLightMoteCount: 38,"],
    ["pathLightMoteCount: 64,", "pathLightMoteCount: 48,"],
    ["shadowMapSize: 1024,", "shadowMapSize: 768,"],
    ["const effectivePixelRatio = clamp(Math.min(devicePixelRatio, narrativePixelRatioCap), 0.72, 1.45);", "const effectivePixelRatio = clamp(Math.min(devicePixelRatio, narrativePixelRatioCap), 0.64, 1.18);"],
  ]);

  writeIfChanged(RENDER_QUALITY_PATH, source, "4D render-quality polish");
}

function patchVisualState() {
  if (!fs.existsSync(VISUAL_STATE_PATH)) return console.log("worldVisualState.ts not found; skipping 4D atmosphere polish.");
  const original = read(VISUAL_STATE_PATH);
  if (original.includes(PATCH_MARKER)) return console.log("4D atmosphere polish already present.");

  let source = mark(
    original,
    "import * as THREE from \"three\";",
    `// ${PATCH_MARKER}: refined atmosphere, clearer path read, and stronger emotional biome transitions.`,
  );

  source = replaceAll(source, [
    ["firstWood: 0.010,", "firstWood: 0.0062,"],
    ["mirror: 0.013,", "mirror: 0.0078,"],
    ["thorned: 0.017,", "thorned: 0.0096,"],
    ["archive: 0.014,", "archive: 0.008,"],
    ["fireRiver: 0.015,", "fireRiver: 0.0088,"],
    ["crowned: 0.007,", "crowned: 0.0044,"],
    ["biomeFogBase[biome] + depth * 0.010 + memory * 0.006 + proximity * 0.002 - director.skyOpenness * 0.006,", "biomeFogBase[biome] + depth * 0.0048 + memory * 0.0028 + proximity * 0.0009 - director.skyOpenness * 0.009,"],
    ["0.004,\n    0.036,", "0.0035,\n    0.024,"],
    ["director.pathClarity - memory * 0.12 - depth * 0.08 + crownPresence * 0.2", "director.pathClarity - memory * 0.075 - depth * 0.045 + crownPresence * 0.22"],
    ["0.48 - depth * 0.14 - memory * 0.055 + crownPresence * 0.1 + director.skyOpenness * 0.12", "0.57 - depth * 0.085 - memory * 0.032 + crownPresence * 0.12 + director.skyOpenness * 0.15"],
    ["0.26 - depth * 0.055 + fireBias * 0.05 + crownPresence * 0.12 + director.skyOpenness * 0.09", "0.33 - depth * 0.032 + fireBias * 0.045 + crownPresence * 0.12 + director.skyOpenness * 0.115"],
    ["0.12 + memory * 0.03 + crownPresence * 0.085 + director.skyOpenness * 0.05", "0.16 + memory * 0.014 + crownPresence * 0.088 + director.skyOpenness * 0.064"],
    ["0.94 - memory * 0.19 - depth * 0.045 + crownPresence * 0.22 + director.skyOpenness * 0.08", "0.98 - memory * 0.13 - depth * 0.03 + crownPresence * 0.22 + director.skyOpenness * 0.092"],
    ["const semanticDensity = THREE.MathUtils.clamp((0.46 + symbolic * 0.18 + memory * 0.12 - pathClarity * 0.08) * director.objectDensity * 1.45, 0.22, 0.78);", "const semanticDensity = THREE.MathUtils.clamp((0.34 + symbolic * 0.14 + memory * 0.07 - pathClarity * 0.06) * director.objectDensity * 1.1, 0.16, 0.58);"],
  ]);

  writeIfChanged(VISUAL_STATE_PATH, source, "4D atmosphere polish");
}

function patchWorldDirector() {
  if (!fs.existsSync(WORLD_DIRECTOR_PATH)) return console.log("worldDirector.ts not found; skipping 4D director polish.");
  const original = read(WORLD_DIRECTOR_PATH);
  if (original.includes(PATCH_MARKER)) return console.log("4D director polish already present.");

  let source = mark(original, "import * as THREE from \"three\";", `// ${PATCH_MARKER}: steadier lantern and more graceful performance budgeting.`);
  source = replaceAll(source, [
    ["lightScale: 0.46,", "lightScale: 0.5,"],
    ["beamScale: 0.42,", "beamScale: 0.46,"],
    ["glowScale: 0.54,", "glowScale: 0.58,"],
    ["lightScale: 0.66,", "lightScale: 0.7,"],
    ["beamScale: 0.62,", "beamScale: 0.68,"],
    ["glowScale: 0.72,", "glowScale: 0.76,"],
    ["semanticScale: 0.94,", "semanticScale: 0.82,"],
    ["terrainDetailScale: 1,", "terrainDetailScale: 0.78,"],
    ["weatherScale: 1,", "weatherScale: 0.86,"],
    ["const instability = pressure * (0.28 + symbolic * 0.22) * (1 - crownPresence * 0.18);", "const instability = pressure * (0.18 + symbolic * 0.16) * (1 - crownPresence * 0.26);"],
    ["reach: THREE.MathUtils.clamp(13.8 + depth * 4.8 + guideBoost * 2.6 - pressure * 1.4 + crownPresence * 2.2, 10.5, 21),", "reach: THREE.MathUtils.clamp(14.5 + depth * 4.1 + guideBoost * 2.8 - pressure * 0.9 + crownPresence * 2.6, 11, 22),"],
  ]);

  writeIfChanged(WORLD_DIRECTOR_PATH, source, "4D director polish");
}

function patchStoryScene() {
  if (!fs.existsSync(STORY_SCENE_PATH)) return console.log("StoryScene.tsx not found; skipping 4D world polish.");
  const original = read(STORY_SCENE_PATH);
  if (original.includes(PATCH_MARKER)) return console.log("4D StoryScene polish already present.");

  let source = mark(original, "import \"./StoryScene.css\";", `// ${PATCH_MARKER}: smoother walking surface, cleaner forest silhouette, and calmer procedural terrain.`);
  source = replaceAll(source, [
    ["const PLAYER_SPEED = 5.0;", "const PLAYER_SPEED = 4.35;"],
    ["const PLAYER_SPEED = 5;", "const PLAYER_SPEED = 4.35;"],
    ["const PLAYER_SPEED = 4.65;", "const PLAYER_SPEED = 4.35;"],
    ["const PLAYER_ACCELERATION = 12;", "const PLAYER_ACCELERATION = 9.2;"],
    ["const PLAYER_LINEAR_DAMPING = 9;", "const PLAYER_LINEAR_DAMPING = 11;"],
    ["const HEAD_BOB_AMPLITUDE = 0.035;", "const HEAD_BOB_AMPLITUDE = 0.018;"],
    ["const HEAD_BOB_FREQUENCY = 9.5;", "const HEAD_BOB_FREQUENCY = 7.8;"],
    ["const FOREST_CELL_RADIUS = 6;", "const FOREST_CELL_RADIUS = 5;"],
    ["const FOREST_TREES_PER_CELL = 5;", "const FOREST_TREES_PER_CELL = 4;"],
    ["const DECORATION_CELL_RADIUS = 6;", "const DECORATION_CELL_RADIUS = 5;"],
    ["const DECORATIONS_PER_CELL = 2;", "const DECORATIONS_PER_CELL = 1;"],
    ["const GROUND_DETAIL_CELL_RADIUS = 5;", "const GROUND_DETAIL_CELL_RADIUS = 4;"],
    ["const GROUND_DETAILS_PER_CELL = 3;", "const GROUND_DETAILS_PER_CELL = 2;"],
    ["const CLEARING_SAFE_RADIUS = 5.2;", "const CLEARING_SAFE_RADIUS = 6.35;"],
    ["const CORRIDOR_BASE_WIDTH = 3.7;", "const CORRIDOR_BASE_WIDTH = 4.65;"],
    ["const CORRIDOR_MIN_WIDTH = 1.55;", "const CORRIDOR_MIN_WIDTH = 2.55;"],
    ["const TREE_COLLIDER_LIMIT = 96;", "const TREE_COLLIDER_LIMIT = 64;"],
    ["const SEMANTIC_SENSOR_LIMIT = 36;", "const SEMANTIC_SENSOR_LIMIT = 18;"],
    ["const STORY_NODE_DETAIL_RADIUS = 42;", "const STORY_NODE_DETAIL_RADIUS = 36;"],
    ["const STORY_NODE_VISITED_RADIUS = 54;", "const STORY_NODE_VISITED_RADIUS = 46;"],
    ["const GATEWAY_VISIBILITY_RADIUS = 46;", "const GATEWAY_VISIBILITY_RADIUS = 40;"],
    ["const GATEWAY_VISITED_RADIUS = 62;", "const GATEWAY_VISITED_RADIUS = 52;"],
    ["const geometry = new THREE.PlaneGeometry(860, 860, 128, 128);", "const geometry = new THREE.PlaneGeometry(760, 760, 96, 96);"],
    ["terrainSize: 860,", "terrainSize: 760,"],
    ["terrainSegments: 128,", "terrainSegments: 96,"],
    ["return broad * 2.7 + mid * 1.25 + fine * 0.42 + pressureRidge * memoryPressure * 1.3 + explorationDepth * 0.45;", "return broad * 1.18 + mid * 0.48 + fine * 0.11 + pressureRidge * memoryPressure * 0.38 + explorationDepth * 0.18;"],
    ["const pathOuter = CORRIDOR_BASE_WIDTH * 1.8;", "const pathOuter = CORRIDOR_BASE_WIDTH * 2.25;"],
    ["elevation *= 1 - pathFlatten * 0.72;", "elevation *= 1 - pathFlatten * 0.88;"],
  ]);

  writeIfChanged(STORY_SCENE_PATH, source, "4D StoryScene polish");
}

patchVisualState();
patchRenderQuality();
patchWorldDirector();
patchWorldCanvas();
patchStoryScene();
