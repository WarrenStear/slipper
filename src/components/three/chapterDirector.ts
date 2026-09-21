import type { Slipper3DEntry } from "../../data/slipper3dTypes";
import type { ChapterBiome } from "./worldVisualState";

const CHAPTER_MIRROR_CLEARING = "The Mirror Clearing";
const CHAPTER_THORNED_HOUSE = "The Thorned House";
const CHAPTER_BLUE_MOON_ARCHIVE = "The Blue Moon Archive";
const CHAPTER_FIRE_AND_RIVER = "The Fire and River";
const CHAPTER_CROWNED_RETURN = "The Crowned Return";

export type NavigationStyle = "subtle" | "reflected" | "narrow" | "orbital" | "duality" | "ascending";
export type FogMood = "soft" | "wet" | "compressed" | "celestial" | "split" | "open";

export type ChapterDirector = {
  biome: ChapterBiome;
  label: string;
  fogMood: FogMood;
  navigationStyle: NavigationStyle;
  forestDensity: number;
  objectDensity: number;
  particleDensity: number;
  pathClarity: number;
  skyOpenness: number;
  groundTrailOpacity: number;
  portalFarOpacity: number;
  portalNearOpacity: number;
  labelRevealDistance: number;
  lanternWarmth: number;
  lanternNarrowness: number;
  movementSpeedMultiplier: number;
  weatherMultiplier: number;
  starMultiplier: number;
  npcCeremony: number;
  centerQuietness: number;
};

export const CHAPTER_DIRECTORS: Record<ChapterBiome, ChapterDirector> = {
  firstWood: {
    biome: "firstWood",
    label: "The First Wood",
    fogMood: "soft",
    navigationStyle: "subtle",
    forestDensity: 0.86,
    objectDensity: 0.48,
    particleDensity: 0.58,
    pathClarity: 0.96,
    skyOpenness: 0.22,
    groundTrailOpacity: 0.72,
    portalFarOpacity: 0.04,
    portalNearOpacity: 0.38,
    labelRevealDistance: 6.4,
    lanternWarmth: 0.58,
    lanternNarrowness: 0.35,
    movementSpeedMultiplier: 1,
    weatherMultiplier: 0.46,
    starMultiplier: 0.55,
    npcCeremony: 0.28,
    centerQuietness: 0.9,
  },
  mirror: {
    biome: "mirror",
    label: "The Mirror Clearing",
    fogMood: "wet",
    navigationStyle: "reflected",
    forestDensity: 0.38,
    objectDensity: 0.55,
    particleDensity: 0.62,
    pathClarity: 1.02,
    skyOpenness: 0.36,
    groundTrailOpacity: 0.68,
    portalFarOpacity: 0.06,
    portalNearOpacity: 0.42,
    labelRevealDistance: 5.8,
    lanternWarmth: 0.28,
    lanternNarrowness: 0.26,
    movementSpeedMultiplier: 0.96,
    weatherMultiplier: 0.75,
    starMultiplier: 0.75,
    npcCeremony: 0.48,
    centerQuietness: 0.92,
  },
  thorned: {
    biome: "thorned",
    label: "The Thorned House",
    fogMood: "compressed",
    navigationStyle: "narrow",
    forestDensity: 0.78,
    objectDensity: 0.72,
    particleDensity: 0.42,
    pathClarity: 0.86,
    skyOpenness: 0.12,
    groundTrailOpacity: 0.64,
    portalFarOpacity: 0.05,
    portalNearOpacity: 0.36,
    labelRevealDistance: 4.8,
    lanternWarmth: 0.46,
    lanternNarrowness: 0.72,
    movementSpeedMultiplier: 0.92,
    weatherMultiplier: 0.5,
    starMultiplier: 0.38,
    npcCeremony: 0.72,
    centerQuietness: 0.86,
  },
  archive: {
    biome: "archive",
    label: "The Blue Moon Archive",
    fogMood: "celestial",
    navigationStyle: "orbital",
    forestDensity: 0.12,
    objectDensity: 0.64,
    particleDensity: 0.8,
    pathClarity: 1.06,
    skyOpenness: 0.74,
    groundTrailOpacity: 0.76,
    portalFarOpacity: 0.08,
    portalNearOpacity: 0.48,
    labelRevealDistance: 6.2,
    lanternWarmth: 0.22,
    lanternNarrowness: 0.3,
    movementSpeedMultiplier: 0.98,
    weatherMultiplier: 0.35,
    starMultiplier: 1.36,
    npcCeremony: 0.58,
    centerQuietness: 0.95,
  },
  fireRiver: {
    biome: "fireRiver",
    label: "The Fire and River",
    fogMood: "split",
    navigationStyle: "duality",
    forestDensity: 0.56,
    objectDensity: 0.68,
    particleDensity: 0.74,
    pathClarity: 0.92,
    skyOpenness: 0.38,
    groundTrailOpacity: 0.7,
    portalFarOpacity: 0.04,
    portalNearOpacity: 0.48,
    labelRevealDistance: 5.5,
    lanternWarmth: 0.78,
    lanternNarrowness: 0.42,
    movementSpeedMultiplier: 0.98,
    weatherMultiplier: 0.84,
    starMultiplier: 0.72,
    npcCeremony: 0.5,
    centerQuietness: 0.88,
  },
  crowned: {
    biome: "crowned",
    label: "The Crowned Return",
    fogMood: "open",
    navigationStyle: "ascending",
    forestDensity: 0.32,
    objectDensity: 0.7,
    particleDensity: 0.86,
    pathClarity: 1.12,
    skyOpenness: 0.92,
    groundTrailOpacity: 0.82,
    portalFarOpacity: 0.1,
    portalNearOpacity: 0.56,
    labelRevealDistance: 7.2,
    lanternWarmth: 0.7,
    lanternNarrowness: 0.2,
    movementSpeedMultiplier: 1.03,
    weatherMultiplier: 0.3,
    starMultiplier: 1.18,
    npcCeremony: 0.62,
    centerQuietness: 0.96,
  },
};

export function chapterBiomeFromChapterName(chapter?: string): ChapterBiome {
  if (chapter === CHAPTER_MIRROR_CLEARING) return "mirror";
  if (chapter === CHAPTER_THORNED_HOUSE) return "thorned";
  if (chapter === CHAPTER_BLUE_MOON_ARCHIVE) return "archive";
  if (chapter === CHAPTER_FIRE_AND_RIVER) return "fireRiver";
  if (chapter === CHAPTER_CROWNED_RETURN) return "crowned";
  return "firstWood";
}

export function resolveChapterDirector(entryOrBiome: Slipper3DEntry | ChapterBiome): ChapterDirector {
  const biome = typeof entryOrBiome === "string" ? entryOrBiome : chapterBiomeFromChapterName(entryOrBiome.chapter);
  return CHAPTER_DIRECTORS[biome];
}

export function blendChapterDirectors(active: ChapterDirector, nearest: ChapterDirector, proximity: number): ChapterDirector {
  const t = Math.max(0, Math.min(1, proximity));
  const blend = (a: number, b: number) => a + (b - a) * t;
  return {
    ...nearest,
    biome: t > 0.5 ? nearest.biome : active.biome,
    label: t > 0.5 ? nearest.label : active.label,
    fogMood: t > 0.5 ? nearest.fogMood : active.fogMood,
    navigationStyle: t > 0.5 ? nearest.navigationStyle : active.navigationStyle,
    forestDensity: blend(active.forestDensity, nearest.forestDensity),
    objectDensity: blend(active.objectDensity, nearest.objectDensity),
    particleDensity: blend(active.particleDensity, nearest.particleDensity),
    pathClarity: blend(active.pathClarity, nearest.pathClarity),
    skyOpenness: blend(active.skyOpenness, nearest.skyOpenness),
    groundTrailOpacity: blend(active.groundTrailOpacity, nearest.groundTrailOpacity),
    portalFarOpacity: blend(active.portalFarOpacity, nearest.portalFarOpacity),
    portalNearOpacity: blend(active.portalNearOpacity, nearest.portalNearOpacity),
    labelRevealDistance: blend(active.labelRevealDistance, nearest.labelRevealDistance),
    lanternWarmth: blend(active.lanternWarmth, nearest.lanternWarmth),
    lanternNarrowness: blend(active.lanternNarrowness, nearest.lanternNarrowness),
    movementSpeedMultiplier: blend(active.movementSpeedMultiplier, nearest.movementSpeedMultiplier),
    weatherMultiplier: blend(active.weatherMultiplier, nearest.weatherMultiplier),
    starMultiplier: blend(active.starMultiplier, nearest.starMultiplier),
    npcCeremony: blend(active.npcCeremony, nearest.npcCeremony),
    centerQuietness: blend(active.centerQuietness, nearest.centerQuietness),
  };
}
