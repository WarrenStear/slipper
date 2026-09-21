import fs from "node:fs";
import path from "node:path";

const PATCH_MARKER = "smooth4DWorldRebuildV1";
const RENDER_QUALITY_PATH = path.resolve("src/components/three/renderQuality.ts");
const WORLD_CANVAS_PATH = path.resolve("src/components/three/WorldCanvas.tsx");
const RENDER_QUALITY_IMPORT = `import { useEffect, useMemo, useState } from "react";`;
const WORLD_CANVAS_IMPORT = `import type { NarrativeWorldState, SceneProximityState, StorySceneControls, StorySceneMode } from "./StoryScene";`;
const RENDER_QUALITY_STORAGE_DECLARATION = `export const RENDER_QUALITY_STORAGE_KEY = "sidtw-render-quality";`;
const RENDER_QUALITY_EVENT_DECLARATION = `export const RENDER_QUALITY_EVENT = "sidtw-render-quality-change";`;

function stripSmoothMarkers(source) {
  return source
    .split("\n")
    .filter((line) => !line.includes(PATCH_MARKER))
    .join("\n");
}

function insertAfter(source, anchor, comment) {
  if (source.includes(comment)) return source;
  if (!source.includes(anchor)) return `${comment}\n${source}`;
  return source.replace(anchor, `${anchor}\n${comment}`);
}

function normalizeRenderQualityStorageDeclaration(source) {
  let next = source;

  // Repair the exact malformed state caused when the smooth-world marker was inserted
  // between the const name and its initializer, then stripped during cleanup.
  next = next.replace(
    /export const RENDER_QUALITY_STORAGE_KEY(?:\s*=\s*["']sidtw-render-quality["'];)?\s*(?=export const RENDER_QUALITY_EVENT)/,
    `${RENDER_QUALITY_STORAGE_DECLARATION}\n`,
  );

  if (!next.includes(RENDER_QUALITY_STORAGE_DECLARATION)) {
    next = next.replace(
      RENDER_QUALITY_EVENT_DECLARATION,
      `${RENDER_QUALITY_STORAGE_DECLARATION}\n${RENDER_QUALITY_EVENT_DECLARATION}`,
    );
  }

  return next;
}

function assertRenderQualityIsValid(source) {
  if (!source.includes(RENDER_QUALITY_STORAGE_DECLARATION)) {
    throw new Error("[fix-smooth-world-markers] RENDER_QUALITY_STORAGE_KEY initializer is missing");
  }

  if (/export const RENDER_QUALITY_STORAGE_KEY\s*(?:\/\/|\n\s*\/\/)/.test(source)) {
    throw new Error("[fix-smooth-world-markers] RENDER_QUALITY_STORAGE_KEY marker is still inside the const declaration");
  }

  if (/export const RENDER_QUALITY_STORAGE_KEY\s*\n\s*export const RENDER_QUALITY_EVENT/.test(source)) {
    throw new Error("[fix-smooth-world-markers] RENDER_QUALITY_STORAGE_KEY is still missing its initializer");
  }
}

function repairFile(filePath, repair, label) {
  if (!fs.existsSync(filePath)) {
    console.log(`[fix-smooth-world-markers] ${label}: missing, skipped`);
    return;
  }

  const current = fs.readFileSync(filePath, "utf8");
  const next = repair(current);

  if (current === next) {
    console.log(`[fix-smooth-world-markers] ${label}: already clean`);
    return;
  }

  fs.writeFileSync(filePath, next);
  console.log(`[fix-smooth-world-markers] ${label}: repaired`);
}

repairFile(
  RENDER_QUALITY_PATH,
  (source) => {
    let next = stripSmoothMarkers(source);
    next = normalizeRenderQualityStorageDeclaration(next);
    next = insertAfter(
      next,
      RENDER_QUALITY_IMPORT,
      `// ${PATCH_MARKER}: stable quality budgets for a realistic, non-glitchy 4D world.`,
    );

    assertRenderQualityIsValid(next);

    return next;
  },
  "renderQuality marker",
);

repairFile(
  WORLD_CANVAS_PATH,
  (source) => {
    let next = stripSmoothMarkers(source);
    next = insertAfter(
      next,
      WORLD_CANVAS_IMPORT,
      `// ${PATCH_MARKER}: renderer stability profile for smooth 4D terrain.`,
    );

    if (/type WorldCanvasProps =\s*(?:\/\/|\n\s*\/\/)/.test(next)) {
      throw new Error("[fix-smooth-world-markers] WorldCanvas marker is still inside the type declaration");
    }

    return next;
  },
  "WorldCanvas marker",
);

// Run last so the new world-engine shape survives older repair passes that still
// execute earlier in the prebuild chain.
await import("./reshape-world-engine.mjs");
