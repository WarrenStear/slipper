#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const root = path.resolve(__dirname, "..");
const sourceFile = path.join(root, "src/data/slipperArchiveSource.ts");
const outputFile = path.join(root, "src/data/worldState.json");
const WORLD_VERSION = 11;
const CHECK_ONLY = process.argv.includes("--check-only");

const WORLD_DEFAULTS = {
  lantern: {
    count: 1,
    mode: "player-carried",
    intensity: 1.25,
    distance: 8.5,
    decay: 1.85,
    castShadow: false,
    emotionalFlicker: true,
  },
  rendering: {
    shadows: {
      mode: "player-frustum",
      mobileMapSize: 512,
      desktopMapSize: 1024,
      maxCasterRadius: 24,
    },
    forest: {
      lod: true,
      chunked: true,
      maxColliderCount: 96,
    },
    postprocessing: {
      readerBokeh: true,
      disableOnLowQuality: true,
    },
  },
};

function readRawArray(exportName) {
  const source = fs.readFileSync(sourceFile, "utf8");
  const marker = `export const ${exportName}`;
  const start = source.indexOf(marker);
  if (start < 0) throw new Error(`Could not find ${exportName} in ${sourceFile}`);

  const equals = source.indexOf("=", start);
  const arrayStart = source.indexOf("[", equals);
  let depth = 0;
  let quote = null;
  let escaped = false;

  for (let index = arrayStart; index < source.length; index += 1) {
    const char = source[index];

    if (quote) {
      if (escaped) escaped = false;
      else if (char === "\\") escaped = true;
      else if (char === quote) quote = null;
      continue;
    }

    if (char === '"' || char === "'" || char === "`") quote = char;
    else if (char === "[") depth += 1;
    else if (char === "]") depth -= 1;

    if (depth === 0) return evalArray(source.slice(arrayStart, index + 1), exportName);
  }

  throw new Error(`Could not parse ${exportName}`);
}

function evalArray(arraySource, exportName) {
  const sandbox = {};
  const script = new vm.Script(`result = (${arraySource});`, { filename: `${exportName}.vm.js` });
  vm.createContext(sandbox);
  script.runInContext(sandbox, { timeout: 5000 });
  return sandbox.result;
}

function declaredVisualId(entry) {
  const candidates = [
    entry.engine3d?.linkedVisualId,
    entry.linkedVisualId,
    entry.visualId,
    entry.heroVisualId,
  ];
  return candidates.find((candidate) => typeof candidate === "string" && candidate.trim())?.trim();
}

function validateEntries(rawEntries, rawVisuals) {
  const issues = [];
  const ids = new Set();
  const visualIds = new Set(rawVisuals.map((visual) => String(visual.id ?? "").trim()).filter(Boolean));

  rawEntries.forEach((entry, index) => {
    const label = `Entry ${index + 1}`;
    const id = String(entry.id ?? "").trim();
    const title = String(entry.title ?? "").trim();
    const body = String(entry.body ?? "").trim();
    const paragraphs = body.split(/\n{2,}/).map((paragraph) => paragraph.trim()).filter(Boolean);

    if (!id) issues.push(`${label}: missing id`);
    if (!title) issues.push(`${label}: missing title`);
    if (!body) issues.push(`${label}: missing body`);
    if (paragraphs.length < 1) issues.push(`${label}: no readable paragraphs`);
    const declaredVisualIds = new Set(
      [
        entry.engine3d?.linkedVisualId,
        entry.linkedVisualId,
        entry.visualId,
        entry.heroVisualId,
      ]
        .filter((candidate) => typeof candidate === "string" && candidate.trim())
        .map((candidate) => candidate.trim()),
    );
    const linkedVisualId = declaredVisualId(entry);
    if (!linkedVisualId) issues.push(`${label}: missing linked visual`);
    else if (declaredVisualIds.size > 1) issues.push(`${label}: conflicting linked visuals ${[...declaredVisualIds].join(", ")}`);
    else if (!visualIds.has(linkedVisualId)) issues.push(`${label}: missing visual ${linkedVisualId}`);

    if (id) {
      if (ids.has(id)) issues.push(`${label}: duplicate id ${id}`);
      ids.add(id);
    }
  });

  if (issues.length > 0) {
    console.error("[world:compile] Content validation failed.");
    issues.forEach((issue) => console.error(`- ${issue}`));
    process.exit(1);
  }
}

function normaliseEntry(rawEntry, index, visualIds, defaultWorldPosition) {
  const id = stableId(rawEntry.id, index);
  const body = String(rawEntry.body ?? "").trim();
  const paragraphs = body.split(/\n{2,}/).map((paragraph) => paragraph.trim()).filter(Boolean);
  const linkedVisualId = declaredVisualId(rawEntry);
  if (!linkedVisualId || !visualIds.has(linkedVisualId)) {
    throw new Error(`Entry ${id} does not resolve to a generated visual.`);
  }
  const engine3d = {
    ...inferEngine3D(rawEntry, index, paragraphs, defaultWorldPosition),
    linkedVisualId,
  };
  const {
    engine3d: _legacyEngine3d,
    linkedVisualId: _legacyLinkedVisualId,
    visualId: _legacyVisualId,
    heroVisualId: _legacyHeroVisualId,
    ...canonicalEntry
  } = rawEntry;

  return {
    ...canonicalEntry,
    id,
    sequence: rawEntry.sequence ?? index + 1,
    title: String(rawEntry.title ?? `Fragment ${index + 1}`).trim(),
    chapter: String(rawEntry.chapter ?? "The First Wood").trim(),
    tags: uniqueStrings(rawEntry.tags ?? []),
    body,
    paragraphs,
    engine3d,
  };
}

function inferEngine3D(entry, index, paragraphs, defaultWorldPosition) {
  const text = `${entry.title ?? ""} ${entry.chapter ?? ""} ${(entry.tags ?? []).join(" ")} ${entry.body ?? ""}`.toLowerCase();
  const tone = text.includes("fire") || text.includes("ash") || text.includes("ember")
    ? "fire"
    : text.includes("water") || text.includes("river") || text.includes("mirror")
      ? "water"
      : text.includes("door") || text.includes("threshold") || text.includes("house")
        ? "threshold"
        : text.includes("crown") || text.includes("return")
          ? "return"
          : text.includes("silence") || text.includes("quiet")
            ? "silence"
            : "memory";

  const densityMultiplier = clamp(bodyDensity(entry.body) + paragraphs.length * 0.035, 0.75, 1.8);

  return {
    ...(entry.engine3d ?? {}),
    emotionalTone: entry.engine3d?.emotionalTone ?? tone,
    densityMultiplier: entry.engine3d?.densityMultiplier ?? densityMultiplier,
    symbolicWeight: entry.engine3d?.symbolicWeight ?? symbolicWeightForTone(tone),
    worldPosition: entry.engine3d?.worldPosition ?? defaultWorldPosition,
  };
}

function normaliseVisual(rawVisual, index) {
  return {
    ...rawVisual,
    id: rawVisual.id || `visual-${index + 1}`,
    src: rawVisual.src || "/visuals/forest-threshold.svg",
    tags: uniqueStrings(rawVisual.tags ?? []),
  };
}

function compile() {
  const rawEntries = readRawArray("rawEntries");
  const rawVisuals = readRawArray("rawVisuals");

  validateEntries(rawEntries, rawVisuals);

  if (CHECK_ONLY) {
    console.log(`[content:qa] Passed ${rawEntries.length} narrative entries.`);
    return;
  }

  const visuals = rawVisuals.map(normaliseVisual);
  const visualIds = new Set(visuals.map((visual) => visual.id));
  const defaultWorldPositions = buildChapterMazePositions(rawEntries);
  const entries = rawEntries.map((entry, index) => normaliseEntry(entry, index, visualIds, defaultWorldPositions[index]));
  // Build time is optional metadata, not narrative input. Identical source must
  // emit identical bytes unless a reproducible timestamp is explicitly supplied.
  const epoch = process.env.SOURCE_DATE_EPOCH;
  let generatedAt;
  if (epoch !== undefined) {
    if (!/^\d+$/.test(epoch) || !Number.isSafeInteger(Number(epoch))) {
      throw new Error("SOURCE_DATE_EPOCH must be non-negative integer seconds.");
    }
    const date = new Date(Number(epoch) * 1000);
    if (!Number.isFinite(date.getTime())) throw new Error("SOURCE_DATE_EPOCH is outside the supported date range.");
    generatedAt = date.toISOString();
  }

  const worldState = {
    ...(generatedAt ? { generatedAt } : {}),
    version: WORLD_VERSION,
    defaults: WORLD_DEFAULTS,
    stats: {
      entries: entries.length,
      visuals: visuals.length,
      privateLines: entries.reduce((sum, entry) => sum + (entry.body.match(/\[private line held back in this public build\]/g)?.length ?? 0), 0),
      tones: countBy(entries, (entry) => entry.engine3d.emotionalTone),
    },
    entries,
    visuals,
  };

  fs.mkdirSync(path.dirname(outputFile), { recursive: true });
  fs.writeFileSync(outputFile, `${JSON.stringify(worldState, null, 2)}\n`);
  console.log(`[world:compile] Wrote ${path.relative(root, outputFile)} with ${entries.length} entries.`);
}

function stableId(value, index) {
  const clean = String(value ?? "").toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  return clean || `fragment-${String(index + 1).padStart(3, "0")}`;
}

function uniqueStrings(values) {
  return [...new Set(values.map((value) => String(value).trim()).filter(Boolean))];
}

function bodyDensity(body = "") {
  const words = String(body).trim().split(/\s+/).filter(Boolean);
  if (!words.length) return 1;
  return clamp(words.length / 160, 0.75, 1.8);
}

function symbolicWeightForTone(tone) {
  if (tone === "fire") return 5;
  if (tone === "return") return 5;
  if (tone === "threshold") return 4;
  if (tone === "silence") return 4;
  return 3;
}

function buildChapterMazePositions(entries) {
  const chapterOrder = [];
  const chapterEntries = new Map();
  entries.forEach((entry, index) => {
    const chapter = String(entry.chapter ?? "The First Wood").trim();
    if (!chapterEntries.has(chapter)) {
      chapterOrder.push(chapter);
      chapterEntries.set(chapter, []);
    }
    chapterEntries.get(chapter).push(index);
  });

  const positions = new Array(entries.length);
  const chapterCenter = (chapterOrder.length - 1) * 0.5;
  chapterOrder.forEach((chapter, chapterIndex) => {
    const memberIndices = chapterEntries.get(chapter) ?? [];
    // Alternate the local snake direction while keeping each act handoff on the
    // same x coordinate. This prevents a long exposed diagonal between regions.
    const chapterCenterX = (chapterIndex % 2 === 0 ? 0.5 : -0.5) * 11.8;
    memberIndices.forEach((entryIndex, laneIndex) => {
      const localRow = Math.floor(laneIndex / 4);
      const rowOffset = laneIndex % 4;
      const serpentineColumn = localRow % 2 === 0 ? rowOffset : 3 - rowOffset;
      const mirroredColumn = chapterIndex % 2 === 0 ? serpentineColumn : 3 - serpentineColumn;
      const x =
        chapterCenterX +
        (mirroredColumn - 1.5) * 11.8 +
        Math.sin((entryIndex + 1) * 1.91) * 0.34;
      const z =
        (chapterIndex - chapterCenter) * 31 +
        (localRow - 1) * 10.8 +
        Math.sin(mirroredColumn * 0.72 + chapterIndex * 0.83) * 0.38;
      positions[entryIndex] = [
        Number(x.toFixed(3)),
        0,
        Number(z.toFixed(3)),
      ];
    });
  });

  return positions;
}

function countBy(items, selector) {
  return items.reduce((acc, item) => {
    const key = selector(item) || "unknown";
    acc[key] = (acc[key] ?? 0) + 1;
    return acc;
  }, {});
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

compile();
