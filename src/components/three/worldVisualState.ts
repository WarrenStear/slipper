import { SCENE_LOOKS } from "./artDirection/SceneLookRegistry";
import { getJourneySceneForEntry } from "../../data/journeyNarrative";
import * as THREE from "three";
import type { Slipper3DEntry } from "../../data/slipper3dTypes";
import { blendChapterDirectors, resolveChapterDirector, type ChapterDirector } from "./chapterDirector";

export type NarrativeWorldStateLike = {
  visitedCount: number;
  totalCount: number;
  traceCount: number;
  fireCount: number;
  waterCount: number;
  memoryCount: number;
  thresholdCount: number;
  crownCount: number;
  fireWaterBalance: number;
  explorationDepth: number;
  memoryPressure: number;
  symbolicWeight: number;
};

export type ChapterBiome = "firstWood" | "mirror" | "thorned" | "archive" | "fireRiver" | "crowned";

export type ChapterPalette = {
  background: string;
  fog: string;
  ground: string;
  trunk: string;
  leaf: string;
  accent: string;
  emissive: string;
  portal: string;
  particle: string;
  shrine: string;
};

export type WorldVisualState = {
  biome: ChapterBiome;
  palette: ChapterPalette;
  backgroundColor: string;
  fogColor: string;
  fogDensity: number;
  ambientIntensity: number;
  directionalIntensity: number;
  hemisphereIntensity: number;
  exposure: number;
  moonColor: string;
  moonIntensity: number;
  moonPosition: [number, number, number];
  rimColor: string;
  rimIntensity: number;
  rimPosition: [number, number, number];
  lanternReach: number;
  lanternStability: number;
  pathGlowIntensity: number;
  clearingGlowIntensity: number;
  shadowStrength: number;
  domeOpacity: number;
  groundOpacity: number;
  treeOpacity: number;
  crownOpacity: number;
  semanticDensity: number;
  semanticOpacity: number;
  particleIntensity: number;
  vignetteIntensity: number;
  bloomIntensity: number;
  silhouetteContrast: number;
  groundDetailIntensity: number;
  weatherIntensity: number;
  starCount: number;
  starFactor: number;
  showStars: boolean;
  pathClarity: number;
  centerQuietness: number;
  director: ChapterDirector;
};

const CHAPTER_FIRST_WOOD = "The First Wood";
const CHAPTER_MIRROR_CLEARING = "The Mirror Clearing";
const CHAPTER_THORNED_HOUSE = "The Thorned House";
const CHAPTER_BLUE_MOON_ARCHIVE = "The Blue Moon Archive";
const CHAPTER_FIRE_AND_RIVER = "The Fire and River";
const CHAPTER_CROWNED_RETURN = "The Crowned Return";

export const CHAPTER_PALETTES: Record<ChapterBiome, ChapterPalette> = {
  firstWood: {
    background: "#03080d",
    fog: "#0d1d24",
    ground: "#111710",
    trunk: "#9a6c4b",
    leaf: "#477358",
    accent: "#d9c592",
    emissive: "#d69d52",
    portal: "#ead6a4",
    particle: "#f0d9a5",
    shrine: "#e2c88d",
  },
  mirror: {
    background: "#03111a",
    fog: "#0e3340",
    ground: "#0d1916",
    trunk: "#3b5051",
    leaf: "#28525c",
    accent: "#bfe8ee",
    emissive: "#5eb6c8",
    portal: "#c8f1f4",
    particle: "#dcf8fb",
    shrine: "#d4eef0",
  },
  thorned: {
    background: "#09070a",
    fog: "#21151b",
    ground: "#120c0c",
    trunk: "#4a2f29",
    leaf: "#33211f",
    accent: "#b69a87",
    emissive: "#75483a",
    portal: "#c9aa92",
    particle: "#ddc0ae",
    shrine: "#c7a58e",
  },
  archive: {
    background: "#03091a",
    fog: "#102b55",
    ground: "#090e20",
    trunk: "#33415e",
    leaf: "#283c62",
    accent: "#d6e2ff",
    emissive: "#789cf3",
    portal: "#c8d8ff",
    particle: "#f0f5ff",
    shrine: "#e0e9ff",
  },
  fireRiver: {
    background: "#130704",
    fog: "#3a1b10",
    ground: "#160c07",
    trunk: "#63331d",
    leaf: "#4a2c18",
    accent: "#ffb06a",
    emissive: "#ff7045",
    portal: "#ffc17d",
    particle: "#ffd59a",
    shrine: "#ffb777",
  },
  crowned: {
    background: "#0d0b05",
    fog: "#362b16",
    ground: "#151108",
    trunk: "#5b4823",
    leaf: "#4a4b22",
    accent: "#f0cd73",
    emissive: "#e2b657",
    portal: "#ffe18d",
    particle: "#ffe9b4",
    shrine: "#f0d17c",
  },
};

function clamp01(value: number) {
  return Math.max(0, Math.min(1, value));
}

function mixColor(a: string, b: string, t: number) {
  return new THREE.Color(a).lerp(new THREE.Color(b), clamp01(t)).getStyle();
}

export function chapterBiomeFromEntry(entry: Slipper3DEntry): ChapterBiome {
  if (entry.chapter === CHAPTER_MIRROR_CLEARING) return "mirror";
  if (entry.chapter === CHAPTER_THORNED_HOUSE) return "thorned";
  if (entry.chapter === CHAPTER_BLUE_MOON_ARCHIVE) return "archive";
  if (entry.chapter === CHAPTER_FIRE_AND_RIVER) return "fireRiver";
  if (entry.chapter === CHAPTER_CROWNED_RETURN) return "crowned";
  if (entry.chapter === CHAPTER_FIRST_WOOD) return "firstWood";
  return "firstWood";
}

export function resolveWorldVisualState({
  entry,
  nearestEntry,
  nearestDistance = 999,
  narrativeWorldState,
}: {
  entry: Slipper3DEntry;
  nearestEntry?: Slipper3DEntry | null;
  nearestDistance?: number;
  narrativeWorldState: NarrativeWorldStateLike;
}): WorldVisualState {
  const activeBiome = chapterBiomeFromEntry(entry);
  const nearestBiome = nearestEntry ? chapterBiomeFromEntry(nearestEntry) : activeBiome;
  const proximity = nearestEntry ? clamp01(1 - nearestDistance / 38) : 0;
  const biome = proximity > 0.18 ? nearestBiome : activeBiome;
  const activePalette = CHAPTER_PALETTES[activeBiome];
  const nearestPalette = CHAPTER_PALETTES[nearestBiome];
  const palette = CHAPTER_PALETTES[biome];
  const activeDirector = resolveChapterDirector(activeBiome);
  const nearestDirector = resolveChapterDirector(nearestBiome);
  const director = nearestEntry
    ? blendChapterDirectors(activeDirector, nearestDirector, proximity * 0.86)
    : activeDirector;

  const depth = clamp01(narrativeWorldState.explorationDepth);
  const memory = clamp01(narrativeWorldState.memoryPressure);
  const fireWater = Math.max(-1, Math.min(1, narrativeWorldState.fireWaterBalance));
  const symbolic = clamp01(narrativeWorldState.symbolicWeight / 5);
  const crownPresence = clamp01(narrativeWorldState.crownCount / Math.max(1, narrativeWorldState.totalCount || 1));

  const fireBias = clamp01(fireWater * 0.5 + 0.5);
  const baseBackground = nearestEntry
    ? mixColor(activePalette.background, nearestPalette.background, proximity * 0.78)
    : palette.background;
  const baseFog = nearestEntry
    ? mixColor(activePalette.fog, nearestPalette.fog, proximity * 0.86)
    : palette.fog;

  const emotionalWarmth = mixColor("#6ba5bc", "#e27b45", fireBias);
  const backgroundColor = mixColor(baseBackground, emotionalWarmth, 0.055 + memory * 0.03);
  const fogColor = mixColor(baseFog, emotionalWarmth, 0.06 + memory * 0.035);

  const biomeFogBase: Record<ChapterBiome, number> = {
    firstWood: 0.0062,
    mirror: 0.0074,
    thorned: 0.0084,
    archive: 0.0068,
    fireRiver: 0.008,
    crowned: 0.0048,
  };

  const fogDensity = THREE.MathUtils.clamp(
    biomeFogBase[biome] * 0.82 + depth * 0.0015 + memory * 0.0013 + proximity * 0.0004 - director.skyOpenness * 0.0015,
    0.0032,
    0.012,
  );

  const pathClarity = THREE.MathUtils.clamp(director.pathClarity + 0.13 - memory * 0.055 - depth * 0.025 + crownPresence * 0.25, 0.72, 1.28);
  const centerQuietness = THREE.MathUtils.clamp(director.centerQuietness + pathClarity * 0.11, 0.82, 0.99);

  const ambientIntensity = THREE.MathUtils.clamp(0.76 - depth * 0.03 - memory * 0.02 + crownPresence * 0.16 + director.skyOpenness * 0.2, 0.6, 1.02);
  const directionalIntensity = THREE.MathUtils.clamp(0.58 - depth * 0.012 + fireBias * 0.06 + crownPresence * 0.18 + director.skyOpenness * 0.16, 0.4, 0.92);
  const hemisphereIntensity = THREE.MathUtils.clamp(0.38 + memory * 0.025 + crownPresence * 0.12 + director.skyOpenness * 0.12, 0.32, 0.68);

  const biomeMoonColor: Record<ChapterBiome, string> = {
    firstWood: "#e2e7cf",
    mirror: "#bceefa",
    thorned: "#c19b83",
    archive: "#d1deff",
    fireRiver: "#a6d8ff",
    crowned: "#ffe4a1",
  };
  const biomeMoonPosition: Record<ChapterBiome, [number, number, number]> = {
    firstWood: [5, 5.2, -14],
    mirror: [-5, 6, -14],
    thorned: [-6, 4.5, -13],
    archive: [4, 7, -14],
    fireRiver: [6, 4.5, -14],
    crowned: [-4, 7.5, -14],
  };
  const biomeRimPosition: Record<ChapterBiome, [number, number, number]> = {
    firstWood: [-5, 2.8, -7],
    mirror: [6, 3.2, -8],
    thorned: [7, 2.6, 4],
    archive: [-6, 5.5, 8],
    fireRiver: [-8, 2.8, 6],
    crowned: [4, 6.5, -8],
  };

  const exposure = THREE.MathUtils.clamp(
    1.34 - memory * 0.07 - depth * 0.012 + crownPresence * 0.24 + director.skyOpenness * 0.1 + (biome === "fireRiver" ? fireBias * 0.1 : 0),
    1.16,
    1.52,
  );
  const baseMoonColor = biome === "fireRiver"
    ? mixColor(biomeMoonColor.fireRiver, "#ffc081", fireBias)
    : biomeMoonColor[biome];
  const moonColor = mixColor(baseMoonColor, emotionalWarmth, biome === "fireRiver" ? 0.18 : memory * 0.055);
  const moonIntensity = THREE.MathUtils.clamp(directionalIntensity * (1.34 + director.skyOpenness * 0.48 + crownPresence * 0.38), 0.36, 1.18);
  const rimColor = mixColor(palette.accent, biome === "mirror" || biome === "archive" ? "#d4ebff" : "#ffd897", biome === "fireRiver" ? fireBias * 0.52 : 0.24);
  const rimIntensity = THREE.MathUtils.clamp(0.14 + director.pathClarity * 0.12 + crownPresence * 0.14 - memory * 0.015, 0.1, 0.42);
  const lanternReach = THREE.MathUtils.clamp(13.8 + director.pathClarity * 8.8 + crownPresence * 3.6 - memory * 1.0 + depth * 0.9, 12, 25);
  const lanternStability = THREE.MathUtils.clamp(1 - memory * 0.46 + crownPresence * 0.24 + director.centerQuietness * 0.14, 0.45, 1);
  const pathGlowIntensity = THREE.MathUtils.clamp(0.82 + pathClarity * 0.82 + crownPresence * 0.48 - memory * 0.08, 0.7, 2.05);
  const clearingGlowIntensity = THREE.MathUtils.clamp(0.66 + symbolic * 0.34 + crownPresence * 0.62 + director.skyOpenness * 0.32, 0.58, 1.86);
  const shadowStrength = THREE.MathUtils.clamp(0.045 + memory * 0.026 + depth * 0.01 - crownPresence * 0.04, 0.016, 0.1);

  const semanticDensity = THREE.MathUtils.clamp((0.18 + symbolic * 0.08 + memory * 0.04 - pathClarity * 0.025) * (0.48 + director.objectDensity * 0.8), 0.08, 0.52);
  const semanticOpacity = THREE.MathUtils.clamp(0.34 + memory * 0.08 + symbolic * 0.05 + director.objectDensity * 0.1, 0.32, 0.56);
  const particleIntensity = THREE.MathUtils.clamp((0.3 + memory * 0.16 + symbolic * 0.08 - crownPresence * 0.04) * (0.65 + director.particleDensity * 0.65), 0.18, 0.62);
  const vignetteIntensity = THREE.MathUtils.clamp(
    0.1 + memory * 0.11 + depth * 0.035 + (biome === "thorned" ? 0.035 : 0) - crownPresence * 0.12 - director.skyOpenness * 0.055,
    0.045,
    0.29,
  );
  const bloomIntensity = THREE.MathUtils.clamp(
    0.36 + clearingGlowIntensity * 0.38 + pathGlowIntensity * 0.12 + (biome === "archive" || biome === "crowned" ? 0.18 : 0) + (biome === "fireRiver" ? fireBias * 0.18 : 0),
    0.32,
    1.24,
  );
  const silhouetteContrast = THREE.MathUtils.clamp(0.28 + memory * 0.1 + depth * 0.045 - director.skyOpenness * 0.12 + (biome === "thorned" ? 0.04 : 0), 0.18, 0.56);
  const groundDetailIntensity = THREE.MathUtils.clamp(0.24 + director.objectDensity * 0.2 + pathClarity * 0.08 + memory * 0.025, 0.22, 0.52);
  const weatherIntensity = THREE.MathUtils.clamp(0.35 + particleIntensity * director.weatherMultiplier * (0.8 + memory * 0.2), 0.18, 0.9);

  const showStars = biome === "archive" || biome === "crowned" || entry.engine3d.mood === "archive" || entry.engine3d.mood === "threshold" || entry.engine3d.mood === "return";
  const starCount = Math.round((biome === "archive" ? 1450 : biome === "crowned" ? 1050 : 780) * director.starMultiplier);
  const starFactor = (1.25 + memory * 0.4 + crownPresence * 0.18) * director.starMultiplier;

  const narrative = getJourneySceneForEntry(entry.id);
  const authored = narrative ? SCENE_LOOKS[narrative.id] : null;
  return {
    biome,
    palette: authored ? { ...palette, background: authored.sky, fog: authored.fog, ground: authored.ground, leaf: authored.leaf, trunk: "#514d3f" } : palette,
    backgroundColor: authored?.sky ?? backgroundColor,
    fogColor: authored?.fog ?? fogColor,
    fogDensity,
    ambientIntensity,
    directionalIntensity,
    hemisphereIntensity,
    exposure,
    moonColor,
    moonIntensity,
    moonPosition: biomeMoonPosition[biome],
    rimColor,
    rimIntensity,
    rimPosition: biomeRimPosition[biome],
    lanternReach,
    lanternStability,
    pathGlowIntensity,
    clearingGlowIntensity,
    shadowStrength,
    domeOpacity: THREE.MathUtils.clamp(0.34 + memory * 0.065 + symbolic * 0.045 - crownPresence * 0.08, 0.22, 0.48),
    groundOpacity: THREE.MathUtils.clamp(0.94 - crownPresence * 0.025, 0.88, 0.98),
    treeOpacity: THREE.MathUtils.clamp(0.82 - crownPresence * 0.06 + depth * 0.015, 0.72, 0.88),
    crownOpacity: THREE.MathUtils.clamp(0.11 + memory * 0.04 - crownPresence * 0.03, 0.06, 0.18),
    semanticDensity,
    semanticOpacity,
    particleIntensity,
    vignetteIntensity,
    bloomIntensity,
    silhouetteContrast,
    groundDetailIntensity,
    weatherIntensity,
    starCount,
    starFactor,
    showStars: authored ? false : showStars,
    pathClarity,
    centerQuietness,
    director: authored ? { ...director, skyOpenness: authored.composition.horizonOpenness, forestDensity: Math.min(director.forestDensity, .25 + authored.composition.foregroundDensity * .65) } : director,
  };
}
