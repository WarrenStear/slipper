import * as THREE from "three";
import type { NarrativeWorldState } from "../StoryScene";
import type { RenderQualityProfile } from "../renderQuality";
import type { WorldVisualState } from "../worldVisualState";

export type WorldPerformanceBudget = {
  quality: RenderQualityProfile["quality"];
  lightScale: number;
  beamScale: number;
  glowScale: number;
  bodyScale: number;
  shadows: boolean;
  particleScale: number;
  semanticScale: number;
  terrainDetailScale: number;
  weatherScale: number;
};

export type LanternDirectorState = {
  color: THREE.Color;
  lightScale: number;
  beamScale: number;
  glowScale: number;
  bodyScale: number;
  shadows: boolean;
  instability: number;
  steadiness: number;
  reach: number;
  guideBoost: number;
};

export type EnvironmentDirectorState = {
  fogColor: string;
  fogDensity: number;
  backgroundColor: string;
  ambientIntensity: number;
  directionalIntensity: number;
  hemisphereIntensity: number;
  groundOpacity: number;
  treeOpacity: number;
  weatherIntensity: number;
  semanticDensity: number;
  pathClarity: number;
  clearingGlow: number;
};

export type WorldDirectorState = {
  performance: WorldPerformanceBudget;
  lantern: LanternDirectorState;
  environment: EnvironmentDirectorState;
};

const WARM_COLOR = new THREE.Color("#ffd78a");
const FIRE_COLOR = new THREE.Color("#ff8a35");
const WATER_COLOR = new THREE.Color("#8bdcff");
const MEMORY_COLOR = new THREE.Color("#d8d0ff");

function clamp01(value: number) {
  return Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));
}

function resolveLanternColor(state: NarrativeWorldState) {
  const color = WARM_COLOR.clone();
  const balance = THREE.MathUtils.clamp(state.fireWaterBalance, -1, 1);
  const pressure = clamp01(state.memoryPressure);

  if (balance > 0.08) color.lerp(FIRE_COLOR, clamp01(balance));
  if (balance < -0.08) color.lerp(WATER_COLOR, clamp01(-balance));
  if (pressure > 0.52) color.lerp(MEMORY_COLOR, (pressure - 0.52) / 0.48);

  return color;
}

export function resolveWorldPerformanceBudget(qualityProfile: RenderQualityProfile): WorldPerformanceBudget {
  switch (qualityProfile.quality) {
    case "low":
      return {
        quality: "low",
        lightScale: 0.46,
        beamScale: 0.42,
        glowScale: 0.54,
        bodyScale: 0.82,
        shadows: false,
        particleScale: qualityProfile.particleMultiplier,
        semanticScale: qualityProfile.semanticDensityMultiplier,
        terrainDetailScale: 0.5,
        weatherScale: qualityProfile.weatherLayerMultiplier,
      };
    case "medium":
      return {
        quality: "medium",
        lightScale: 0.66,
        beamScale: 0.62,
        glowScale: 0.72,
        bodyScale: 0.9,
        shadows: false,
        particleScale: qualityProfile.particleMultiplier,
        semanticScale: qualityProfile.semanticDensityMultiplier,
        terrainDetailScale: 0.68,
        weatherScale: qualityProfile.weatherLayerMultiplier,
      };
    case "high":
      return {
        quality: "high",
        lightScale: 0.84,
        beamScale: 0.84,
        glowScale: 0.88,
        bodyScale: 1,
        shadows: false,
        particleScale: qualityProfile.particleMultiplier,
        semanticScale: qualityProfile.semanticDensityMultiplier,
        terrainDetailScale: 0.86,
        weatherScale: qualityProfile.weatherLayerMultiplier,
      };
    case "cinematic":
      return {
        quality: "cinematic",
        lightScale: 1,
        beamScale: 1,
        glowScale: 1,
        bodyScale: 1,
        shadows: qualityProfile.enableLanternShadows,
        particleScale: qualityProfile.particleMultiplier,
        semanticScale: qualityProfile.semanticDensityMultiplier,
        terrainDetailScale: 1,
        weatherScale: qualityProfile.weatherLayerMultiplier,
      };
    default:
      return resolveWorldPerformanceBudget({ ...qualityProfile, quality: "medium" });
  }
}

export function resolveLanternDirector({
  narrativeWorldState,
  qualityProfile,
  navigationGuidance = false,
}: {
  narrativeWorldState: NarrativeWorldState;
  qualityProfile: RenderQualityProfile;
  navigationGuidance?: boolean;
}): LanternDirectorState {
  const performance = resolveWorldPerformanceBudget(qualityProfile);
  const pressure = clamp01(narrativeWorldState.memoryPressure);
  const depth = clamp01(narrativeWorldState.explorationDepth);
  const symbolic = clamp01(narrativeWorldState.symbolicWeight);
  const crownPresence = clamp01(narrativeWorldState.crownCount / Math.max(1, narrativeWorldState.totalCount || 1));
  const instability = pressure * (0.28 + symbolic * 0.22) * (1 - crownPresence * 0.18);
  const steadiness = THREE.MathUtils.clamp(1 - instability * 0.24 + crownPresence * 0.08, 0.74, 1.08);
  const guideBoost = navigationGuidance ? 0.13 + depth * 0.2 : 0;

  return {
    color: resolveLanternColor(narrativeWorldState),
    lightScale: performance.lightScale,
    beamScale: performance.beamScale,
    glowScale: performance.glowScale,
    bodyScale: performance.bodyScale,
    shadows: performance.shadows,
    instability,
    steadiness,
    reach: THREE.MathUtils.clamp(13.8 + depth * 4.8 + guideBoost * 2.6 - pressure * 1.4 + crownPresence * 2.2, 10.5, 21),
    guideBoost,
  };
}

export function resolveEnvironmentDirector({
  visualState,
  qualityProfile,
}: {
  visualState: WorldVisualState;
  qualityProfile: RenderQualityProfile;
}): EnvironmentDirectorState {
  const performance = resolveWorldPerformanceBudget(qualityProfile);

  return {
    fogColor: visualState.fogColor,
    fogDensity: visualState.fogDensity,
    backgroundColor: visualState.backgroundColor,
    ambientIntensity: visualState.ambientIntensity,
    directionalIntensity: visualState.directionalIntensity,
    hemisphereIntensity: visualState.hemisphereIntensity,
    groundOpacity: visualState.groundOpacity,
    treeOpacity: visualState.treeOpacity,
    weatherIntensity: visualState.weatherIntensity * performance.weatherScale,
    semanticDensity: visualState.semanticDensity * performance.semanticScale,
    pathClarity: visualState.pathClarity,
    clearingGlow: visualState.clearingGlowIntensity,
  };
}

export function resolveWorldDirector({
  narrativeWorldState,
  visualState,
  qualityProfile,
  navigationGuidance = false,
}: {
  narrativeWorldState: NarrativeWorldState;
  visualState: WorldVisualState;
  qualityProfile: RenderQualityProfile;
  navigationGuidance?: boolean;
}): WorldDirectorState {
  return {
    performance: resolveWorldPerformanceBudget(qualityProfile),
    lantern: resolveLanternDirector({ narrativeWorldState, qualityProfile, navigationGuidance }),
    environment: resolveEnvironmentDirector({ visualState, qualityProfile }),
  };
}
