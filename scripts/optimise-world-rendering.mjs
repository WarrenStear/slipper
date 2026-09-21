import fs from "node:fs";
import path from "node:path";

const PATCH_MARKER = "worldRenderingOptimiseV1";
const WORLD_CANVAS_PATH = path.resolve("src/components/three/WorldCanvas.tsx");
const RENDER_QUALITY_PATH = path.resolve("src/components/three/renderQuality.ts");
const VITE_CONFIG_PATH = path.resolve("vite.config.ts");

function read(filePath) {
  return fs.existsSync(filePath) ? fs.readFileSync(filePath, "utf8") : "";
}

function write(filePath, source, label) {
  fs.writeFileSync(filePath, source);
  console.log(`${label} applied.`);
}

function patchWorldCanvas() {
  if (!fs.existsSync(WORLD_CANVAS_PATH)) {
    console.log("WorldCanvas.tsx not found; skipping renderer patch.");
    return;
  }

  const original = read(WORLD_CANVAS_PATH);
  if (original.includes(PATCH_MARKER)) {
    console.log("WorldCanvas renderer optimisation already present.");
    return;
  }

  let source = original;

  source = source.replace(
    "import { Component, Suspense, useEffect, useMemo, type ErrorInfo, type ReactNode } from \"react\";",
    "import { Component, Suspense, useEffect, useMemo, useRef, type ErrorInfo, type ReactNode } from \"react\";",
  );

  source = source.replace(
    "function CanvasRenderQualityController({\n  qualityProfile,\n  narrativeWorldState,\n}: {",
    `function CanvasRenderQualityController({\n  qualityProfile,\n  narrativeWorldState,\n}: {`,
  );

  source = source.replace(
    "  const { gl } = useThree();\n  const renderScale = useMemo(",
    `  const { gl, scene, performance } = useThree();\n  const lastPixelRatioRef = useRef(0);\n  const lastShadowStateRef = useRef<boolean | null>(null);\n  const renderScale = useMemo(`,
  );

  source = source.replace(
    /  useEffect\(\(\) => \{\n    gl\.setPixelRatio\(renderScale\.effectivePixelRatio\);\n    gl\.toneMapping = THREE\.ACESFilmicToneMapping;\n    gl\.toneMappingExposure = THREE\.MathUtils\.clamp\(\n      0\.94 - narrativeWorldState\.memoryPressure \* 0\.16 \+ narrativeWorldState\.explorationDepth \* 0\.05,\n      0\.72,\n      1\.1,\n    \);\n    gl\.outputColorSpace = THREE\.SRGBColorSpace;\n    gl\.shadowMap\.enabled = qualityProfile\.enableMoonShadows \|\| qualityProfile\.enableLanternShadows;\n    gl\.shadowMap\.type = THREE\.PCFSoftShadowMap;\n  \}, \[\n    gl,\n    qualityProfile\.enableLanternShadows,\n    qualityProfile\.enableMoonShadows,\n    renderScale\.effectivePixelRatio,\n    narrativeWorldState\.memoryPressure,\n    narrativeWorldState\.explorationDepth,\n  \]\);/,
    `  useEffect(() => {\n    // ${PATCH_MARKER}: avoid expensive renderer state churn and keep the world crisp under load.\n    const nextPixelRatio = THREE.MathUtils.clamp(renderScale.effectivePixelRatio, 0.66, qualityProfile.quality === "cinematic" ? 1.24 : 1.12);\n    if (Math.abs(lastPixelRatioRef.current - nextPixelRatio) > 0.025) {\n      gl.setPixelRatio(nextPixelRatio);\n      lastPixelRatioRef.current = nextPixelRatio;\n    }\n\n    gl.toneMapping = THREE.ACESFilmicToneMapping;\n    gl.toneMappingExposure = THREE.MathUtils.clamp(\n      0.98 - narrativeWorldState.memoryPressure * 0.11 + narrativeWorldState.explorationDepth * 0.035,\n      0.78,\n      1.08,\n    );\n    gl.outputColorSpace = THREE.SRGBColorSpace;\n    gl.setClearColor("#050506", 1);\n    gl.autoClear = true;\n\n    const shadowsEnabled = qualityProfile.enableMoonShadows || qualityProfile.enableLanternShadows;\n    if (lastShadowStateRef.current !== shadowsEnabled) {\n      gl.shadowMap.enabled = shadowsEnabled;\n      gl.shadowMap.type = THREE.PCFSoftShadowMap;\n      gl.shadowMap.autoUpdate = shadowsEnabled;\n      lastShadowStateRef.current = shadowsEnabled;\n    }\n\n    scene.matrixWorldAutoUpdate = true;\n\n    if (narrativeWorldState.memoryPressure > 0.72 || renderScale.effectivePixelRatio < 0.82) {\n      performance.regress();\n    }\n  }, [\n    gl,\n    scene,\n    performance,\n    qualityProfile.quality,\n    qualityProfile.enableLanternShadows,\n    qualityProfile.enableMoonShadows,\n    renderScale.effectivePixelRatio,\n    narrativeWorldState.memoryPressure,\n    narrativeWorldState.explorationDepth,\n  ]);`,
  );

  source = source.replace(
    "  const canvasDpr = useMemo<[number, number]>(() => [0.72, Math.max(0.72, renderScale.effectivePixelRatio)], [renderScale.effectivePixelRatio]);",
    "  const canvasDpr = useMemo<[number, number]>(() => [0.66, Math.max(0.72, Math.min(1.18, renderScale.effectivePixelRatio))], [renderScale.effectivePixelRatio]);",
  );

  source = source.replace(
    "        gl={{ antialias: false, alpha: false, powerPreference: \"high-performance\", failIfMajorPerformanceCaveat: false }}",
    "        gl={{ antialias: false, alpha: false, depth: true, stencil: false, preserveDrawingBuffer: false, powerPreference: \"high-performance\", failIfMajorPerformanceCaveat: false }}",
  );

  source = source.replace(
    "        performance={{ min: 0.45, debounce: 220 }}",
    "        performance={{ min: 0.35, debounce: 360 }}",
  );

  if (source !== original) write(WORLD_CANVAS_PATH, source, "WorldCanvas renderer optimisation");
  else console.log("No WorldCanvas renderer targets found; skipped.");
}

function patchRenderQuality() {
  if (!fs.existsSync(RENDER_QUALITY_PATH)) {
    console.log("renderQuality.ts not found; skipping render quality patch.");
    return;
  }

  const original = read(RENDER_QUALITY_PATH);
  if (original.includes(PATCH_MARKER)) {
    console.log("Render-quality optimisation already present.");
    return;
  }

  let source = original.replace(
    "import { useEffect, useMemo, useState } from \"react\";",
    `import { useEffect, useMemo, useState } from "react";\n// ${PATCH_MARKER}: tighter caps for smoother world rendering on Cloudflare/browser GPUs.`,
  );

  source = source
    .replace("pixelRatioCap: 1.0,", "pixelRatioCap: 0.92,")
    .replace("pixelRatioCap: 1.05,", "pixelRatioCap: 1.0,")
    .replace("pixelRatioCap: 1.18,", "pixelRatioCap: 1.08,")
    .replace("pixelRatioCap: 1.35,", "pixelRatioCap: 1.2,")
    .replace("particleMultiplier: 0.46,", "particleMultiplier: 0.38,")
    .replace("particleMultiplier: 0.64,", "particleMultiplier: 0.54,")
    .replace("particleMultiplier: 0.82,", "particleMultiplier: 0.68,")
    .replace("particleMultiplier: 1,", "particleMultiplier: 0.82,")
    .replace("starMultiplier: 0.42,", "starMultiplier: 0.32,")
    .replace("starMultiplier: 0.64,", "starMultiplier: 0.5,")
    .replace("starMultiplier: 0.82,", "starMultiplier: 0.66,")
    .replace("starMultiplier: 1,", "starMultiplier: 0.78,")
    .replace("weatherLayerMultiplier: 0.42,", "weatherLayerMultiplier: 0.34,")
    .replace("weatherLayerMultiplier: 0.64,", "weatherLayerMultiplier: 0.52,")
    .replace("weatherLayerMultiplier: 0.86,", "weatherLayerMultiplier: 0.68,")
    .replace("weatherLayerMultiplier: 1,", "weatherLayerMultiplier: 0.8,")
    .replace("const memoryPressurePenalty = memoryPressure * 0.24;", "const memoryPressurePenalty = memoryPressure * 0.3;")
    .replace("const clarityLift = explorationDepth * (1 - memoryPressure) * (0.045 + symbolicWeight * 0.035);", "const clarityLift = explorationDepth * (1 - memoryPressure) * (0.032 + symbolicWeight * 0.026);")
    .replace("const elementalInstabilityPenalty = Math.abs(fireWaterBalance) * memoryPressure * 0.035;", "const elementalInstabilityPenalty = Math.abs(fireWaterBalance) * memoryPressure * 0.05;")
    .replace("const capMultiplier = clamp(1 - memoryPressurePenalty - elementalInstabilityPenalty + clarityLift, 0.72, 1.08);", "const capMultiplier = clamp(1 - memoryPressurePenalty - elementalInstabilityPenalty + clarityLift, 0.66, 1.04);")
    .replace("const narrativePixelRatioCap = clamp(qualityProfile.pixelRatioCap * capMultiplier, 0.72, qualityProfile.pixelRatioCap * 1.08);", "const narrativePixelRatioCap = clamp(qualityProfile.pixelRatioCap * capMultiplier, 0.66, qualityProfile.pixelRatioCap * 1.04);")
    .replace("const effectivePixelRatio = clamp(Math.min(devicePixelRatio, narrativePixelRatioCap), 0.72, 1.45);", "const effectivePixelRatio = clamp(Math.min(devicePixelRatio, narrativePixelRatioCap), 0.66, 1.24);");

  if (source !== original) write(RENDER_QUALITY_PATH, source, "Render quality world-rendering optimisation");
  else console.log("No render-quality targets found; skipped.");
}

function patchViteConfig() {
  if (!fs.existsSync(VITE_CONFIG_PATH)) {
    console.log("vite.config.ts not found; skipping Vite patch.");
    return;
  }

  const original = read(VITE_CONFIG_PATH);
  if (original.includes(PATCH_MARKER)) {
    console.log("Vite rendering chunk optimisation already present.");
    return;
  }

  let source = original.replace(
    "import react from \"@vitejs/plugin-react\";",
    `import react from "@vitejs/plugin-react";\n// ${PATCH_MARKER}: keep render-heavy dependencies isolated for faster startup and better cache reuse.`,
  );

  source = source.replace(
    "chunkSizeWarningLimit: 1400,",
    "chunkSizeWarningLimit: 1100,",
  );

  source = source.replace(
    "if (id.includes(\"@react-three/fiber\") || id.includes(\"@react-three/drei\")) return \"r3f\";\n          if (id.includes(\"/node_modules/three/\")) return \"three\";",
    "if (id.includes(\"@react-three/fiber\")) return \"r3f-core\";\n          if (id.includes(\"@react-three/drei\")) return \"r3f-drei\";\n          if (id.includes(\"three/examples/jsm/loaders\")) return \"three-loaders\";\n          if (id.includes(\"three/examples/jsm\")) return \"three-extras\";\n          if (id.includes(\"/node_modules/three/\")) return \"three\";",
  );

  if (source !== original) write(VITE_CONFIG_PATH, source, "Vite world-rendering chunk optimisation");
  else console.log("No Vite chunk targets found; skipped.");
}

patchWorldCanvas();
patchRenderQuality();
patchViteConfig();
