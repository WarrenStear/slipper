import fs from "node:fs";
import path from "node:path";

const PATCH_MARKER = "visualCleanOptimiseV1";
const STORY_SCENE_PATH = path.resolve("src/components/three/StoryScene.tsx");
const VISUAL_STATE_PATH = path.resolve("src/components/three/worldVisualState.ts");
const RENDER_QUALITY_PATH = path.resolve("src/components/three/renderQuality.ts");

function read(filePath) {
  return fs.existsSync(filePath) ? fs.readFileSync(filePath, "utf8") : "";
}

function write(filePath, content, label) {
  fs.writeFileSync(filePath, content);
  console.log(`${label} applied.`);
}

function replaceAllLiteral(source, replacements) {
  let next = source;
  for (const [from, to] of replacements) {
    next = next.split(from).join(to);
  }
  return next;
}

function removeUnsafeSparklesKeyInjection(source) {
  // Previous cleanup builds inserted a fixed key into all <Sparkles> tags. Some
  // Sparkles instances already carry a React key, which creates TS17001 duplicate
  // JSX attributes after prebuild. Keep Sparkles untouched and strip only the
  // synthetic key if a generated file already contains it.
  return source.replace(/<Sparkles\s+key="clean-visual-sparkles"\s+/g, "<Sparkles ");
}

function patchVisualState() {
  if (!fs.existsSync(VISUAL_STATE_PATH)) {
    console.log("worldVisualState.ts not found; skipping visual state cleanup.");
    return;
  }

  const original = read(VISUAL_STATE_PATH);
  if (original.includes(PATCH_MARKER)) {
    console.log("Visual state cleanup already present.");
    return;
  }

  let source = original;

  source = source.replace(
    "import * as THREE from \"three\";",
    `import * as THREE from "three";\n// ${PATCH_MARKER}: calmer, cleaner visual stack tuned for lantern readability and lower scene noise.`,
  );

  source = replaceAllLiteral(source, [
    ["firstWood: 0.009,", "firstWood: 0.0075,"],
    ["mirror: 0.012,", "mirror: 0.0095,"],
    ["thorned: 0.015,", "thorned: 0.012,"],
    ["archive: 0.012,", "archive: 0.0095,"],
    ["fireRiver: 0.013,", "fireRiver: 0.0105,"],
    ["crowned: 0.006,", "crowned: 0.0052,"],
    ["biomeFogBase[biome] + depth * 0.008 + memory * 0.0045 + proximity * 0.0016 - director.skyOpenness * 0.007,", "biomeFogBase[biome] + depth * 0.0065 + memory * 0.0035 + proximity * 0.0012 - director.skyOpenness * 0.008,"],
    ["0.5 - depth * 0.11 - memory * 0.045 + crownPresence * 0.12 + director.skyOpenness * 0.14,", "0.54 - depth * 0.09 - memory * 0.035 + crownPresence * 0.13 + director.skyOpenness * 0.15,"],
    ["0.28 - depth * 0.045 + fireBias * 0.055 + crownPresence * 0.13 + director.skyOpenness * 0.1,", "0.31 - depth * 0.035 + fireBias * 0.05 + crownPresence * 0.135 + director.skyOpenness * 0.11,"],
    ["0.14 + memory * 0.024 + crownPresence * 0.09 + director.skyOpenness * 0.06,", "0.155 + memory * 0.018 + crownPresence * 0.095 + director.skyOpenness * 0.065,"],
    ["0.86 - crownPresence * 0.06,", "0.88 - crownPresence * 0.045,"],
    ["0.7 - crownPresence * 0.1 + depth * 0.035,", "0.68 - crownPresence * 0.085 + depth * 0.03,"],
    ["0.34 + director.objectDensity * 0.34 + pathClarity * 0.22 + memory * 0.055,", "0.3 + director.objectDensity * 0.28 + pathClarity * 0.2 + memory * 0.04,"],
  ]);

  if (source !== original) write(VISUAL_STATE_PATH, source, "Visual state cleanup");
  else console.log("No visual-state cleanup targets found; skipped.");
}

function patchRenderQuality() {
  if (!fs.existsSync(RENDER_QUALITY_PATH)) {
    console.log("renderQuality.ts not found; skipping quality cleanup.");
    return;
  }

  const original = read(RENDER_QUALITY_PATH);
  if (original.includes(PATCH_MARKER)) {
    console.log("Render quality cleanup already present.");
    return;
  }

  let source = original.replace(
    "import",
    `// ${PATCH_MARKER}: scene-density cleanup preserves atmosphere while reducing overdraw/noise.\nimport`,
  );

  source = source
    .replace(/treeDensityMultiplier:\s*1,/g, "treeDensityMultiplier: 0.86,")
    .replace(/treeDensityMultiplier:\s*0\.75,/g, "treeDensityMultiplier: 0.68,")
    .replace(/treeDensityMultiplier:\s*0\.55,/g, "treeDensityMultiplier: 0.48,")
    .replace(/decorationDensityMultiplier:\s*1,/g, "decorationDensityMultiplier: 0.82,")
    .replace(/decorationDensityMultiplier:\s*0\.72,/g, "decorationDensityMultiplier: 0.62,")
    .replace(/decorationDensityMultiplier:\s*0\.48,/g, "decorationDensityMultiplier: 0.4,")
    .replace(/semanticDensityMultiplier:\s*1,/g, "semanticDensityMultiplier: 0.78,")
    .replace(/semanticDensityMultiplier:\s*0\.7,/g, "semanticDensityMultiplier: 0.58,")
    .replace(/semanticDensityMultiplier:\s*0\.45,/g, "semanticDensityMultiplier: 0.34,")
    .replace(/shadowMapSize:\s*2048,/g, "shadowMapSize: 1536,")
    .replace(/shadowMapSize:\s*1024,/g, "shadowMapSize: 768,")
    .replace(/shadowMapSize:\s*512,/g, "shadowMapSize: 512,");

  if (source !== original) write(RENDER_QUALITY_PATH, source, "Render quality density cleanup");
  else console.log("No render-quality cleanup targets found; skipped.");
}

function patchStoryScene() {
  if (!fs.existsSync(STORY_SCENE_PATH)) {
    console.log("StoryScene.tsx not found; skipping scene cleanup.");
    return;
  }

  const original = read(STORY_SCENE_PATH);
  if (original.includes(PATCH_MARKER)) {
    const sanitized = removeUnsafeSparklesKeyInjection(original);
    if (sanitized !== original) write(STORY_SCENE_PATH, sanitized, "StoryScene duplicate Sparkles key cleanup");
    else console.log("StoryScene visual cleanup already present.");
    return;
  }

  let source = original;
  source = source.replace(
    "import \"./StoryScene.css\";",
    `import "./StoryScene.css";\n// ${PATCH_MARKER}: reduce visual clutter, tune light/fog readability, and keep object density performance-safe.`,
  );

  source = replaceAllLiteral(source, [
    ["const FOREST_TREES_PER_CELL = 5;", "const FOREST_TREES_PER_CELL = 4;"],
    ["const DECORATIONS_PER_CELL = 2;", "const DECORATIONS_PER_CELL = 1;"],
    ["const GROUND_DETAILS_PER_CELL = 3;", "const GROUND_DETAILS_PER_CELL = 2;"],
    ["const TREE_COLLIDER_LIMIT = 96;", "const TREE_COLLIDER_LIMIT = 72;"],
    ["const SEMANTIC_SENSOR_LIMIT = 36;", "const SEMANTIC_SENSOR_LIMIT = 28;"],
    ["const STORY_NODE_DETAIL_RADIUS = 42;", "const STORY_NODE_DETAIL_RADIUS = 38;"],
    ["const STORY_NODE_VISITED_RADIUS = 54;", "const STORY_NODE_VISITED_RADIUS = 48;"],
    ["const GATEWAY_VISIBILITY_RADIUS = 46;", "const GATEWAY_VISIBILITY_RADIUS = 42;"],
    ["const GATEWAY_VISITED_RADIUS = 62;", "const GATEWAY_VISITED_RADIUS = 54;"],
    ["distance={420}", "distance={360}"],
    ["count={4000}", "count={2600}"],
    ["count={2600}", "count={1900}"],
    ["count={1800}", "count={1300}"],
  ]);

  source = removeUnsafeSparklesKeyInjection(source);

  // Make the fallback/base ground less visually flat when present, while keeping the existing physics untouched.
  source = source.replace(
    /<meshStandardMaterial\n\s*color=\{visualState\.palette\.ground\}\n\s*roughness=\{0\.96\}\n\s*metalness=\{0\.015\}\n\s*emissive=\{visualState\.palette\.emissive\}\n\s*emissiveIntensity=\{0\.012 \+ narrativeWorldState\.symbolicWeight \* 0\.01\}\n\s*transparent\n\s*opacity=\{visualState\.groundOpacity\}\n\s*\/>/,
    `<meshStandardMaterial
          color={visualState.palette.ground}
          roughness={0.985}
          metalness={0.008}
          emissive={visualState.palette.emissive}
          emissiveIntensity={0.008 + narrativeWorldState.symbolicWeight * 0.006}
          transparent
          opacity={Math.min(0.94, visualState.groundOpacity)}
        />`,
  );

  if (source !== original) write(STORY_SCENE_PATH, source, "StoryScene visual cleanup");
  else console.log("No StoryScene visual cleanup targets found; skipped.");
}

patchVisualState();
patchRenderQuality();
patchStoryScene();
