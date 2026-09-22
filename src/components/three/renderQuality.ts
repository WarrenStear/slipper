import { useEffect, useMemo, useState } from "react";

import {
  isRenderQuality, normalizeDevicePixelRatio, persistRenderQuality,
  RENDER_QUALITY_EVENT, RENDER_QUALITY_STORAGE_KEY, resolveInitialRenderQuality,
  type RenderQuality,
} from "./renderPreferences.ts";
export {
  getStoredRenderQuality, isRenderQuality, RENDER_QUALITY_EVENT,
  RENDER_QUALITY_STORAGE_KEY, resolveInitialRenderQuality, setPreferredRenderQuality,
  type RenderQuality,
} from "./renderPreferences.ts";

export type RenderQualityProfile = {
  quality: RenderQuality;
  label: string;
  forestCellRadius: number;
  treesPerCell: number;
  semanticCellRadius: number;
  decorationsPerCell: number;
  particleMultiplier: number;
  semanticDensityMultiplier: number;
  starMultiplier: number;
  pixelRatioCap: number;
  enableLanternShadows: boolean;
  enableMoonShadows: boolean;
  enableCinematicVignette: boolean;
  enableBloomProxies: boolean;
  groundDetailMultiplier: number;
  weatherLayerMultiplier: number;
  landmarkSilhouetteMultiplier: number;
  pathLightMoteCount: number;
  clearingGlowResolution: "low" | "medium" | "high";
  shadowMapSize: number;
  showDebugByDefault: boolean;
};

export type NarrativeRenderQualityState = {
  memoryPressure: number;
  explorationDepth: number;
  fireWaterBalance: number;
  symbolicWeight: number;
};

export type NarrativeRenderScale = {
  /** The physical browser DPR before narrative scaling. */
  devicePixelRatio: number;
  /** The selected quality preset cap before narrative scaling. */
  basePixelRatioCap: number;
  /** The DPR cap after memory/fog/clarity modulation. */
  narrativePixelRatioCap: number;
  /** The final DPR applied to the WebGL renderer. */
  effectivePixelRatio: number;
  /** 0-1: how much high memory pressure is reducing sharpness. */
  memoryPressurePenalty: number;
  /** 0-1: how much clarity/depth is restoring sharpness. */
  clarityLift: number;
  /** Human-readable reason for debug overlays. */
  label: string;
};

export const RENDER_QUALITY_PROFILES: Record<RenderQuality, RenderQualityProfile> = {
  low: {
    quality: "low",
    label: "Low",
    forestCellRadius: 3,
    treesPerCell: 2,
    semanticCellRadius: 2,
    decorationsPerCell: 0,
    particleMultiplier: 0.3,
    semanticDensityMultiplier: 0.34,
    starMultiplier: 0.34,
    pixelRatioCap: 0.95,
    enableLanternShadows: false,
    enableMoonShadows: false,
    enableCinematicVignette: false,
    enableBloomProxies: false,
    groundDetailMultiplier: 0.16,
    weatherLayerMultiplier: 0.18,
    landmarkSilhouetteMultiplier: 0.52,
    pathLightMoteCount: 12,
    clearingGlowResolution: "low",
    shadowMapSize: 512,
    showDebugByDefault: false,
  },
  medium: {
    quality: "medium",
    label: "Medium",
    forestCellRadius: 4,
    treesPerCell: 2,
    semanticCellRadius: 3,
    decorationsPerCell: 1,
    particleMultiplier: 0.52,
    semanticDensityMultiplier: 0.56,
    starMultiplier: 0.64,
    pixelRatioCap: 1.05,
    enableLanternShadows: false,
    enableMoonShadows: false,
    enableCinematicVignette: true,
    enableBloomProxies: true,
    groundDetailMultiplier: 0.46,
    weatherLayerMultiplier: 0.42,
    landmarkSilhouetteMultiplier: 0.78,
    pathLightMoteCount: 24,
    clearingGlowResolution: "medium",
    shadowMapSize: 512,
    showDebugByDefault: false,
  },
  high: {
    quality: "high",
    label: "High",
    forestCellRadius: 4,
    treesPerCell: 3,
    semanticCellRadius: 4,
    decorationsPerCell: 1,
    particleMultiplier: 0.72,
    semanticDensityMultiplier: 0.74,
    starMultiplier: 0.82,
    pixelRatioCap: 1.18,
    enableLanternShadows: false,
    enableMoonShadows: false,
    enableCinematicVignette: true,
    enableBloomProxies: true,
    groundDetailMultiplier: 0.68,
    weatherLayerMultiplier: 0.62,
    landmarkSilhouetteMultiplier: 0.96,
    pathLightMoteCount: 32,
    clearingGlowResolution: "high",
    shadowMapSize: 768,
    showDebugByDefault: false,
  },
  cinematic: {
    quality: "cinematic",
    label: "Cinematic",
    forestCellRadius: 4,
    treesPerCell: 3,
    semanticCellRadius: 4,
    decorationsPerCell: 2,
    particleMultiplier: 0.9,
    semanticDensityMultiplier: 0.9,
    starMultiplier: 1,
    pixelRatioCap: 1.35,
    enableLanternShadows: false,
    enableMoonShadows: true,
    enableCinematicVignette: true,
    enableBloomProxies: true,
    groundDetailMultiplier: 0.9,
    weatherLayerMultiplier: 0.8,
    landmarkSilhouetteMultiplier: 1.08,
    pathLightMoteCount: 42,
    clearingGlowResolution: "high",
    shadowMapSize: 1024,
    showDebugByDefault: false,
  },
};

export function resolveEnvironmentalEffectsProfile(
  profile: RenderQualityProfile,
  reducedEffects: boolean,
): RenderQualityProfile {
  if (!reducedEffects) return profile;

  return {
    ...profile,
    label: `${profile.label} · reduced effects`,
    decorationsPerCell: 0,
    particleMultiplier: 0,
    semanticDensityMultiplier: Math.min(profile.semanticDensityMultiplier, 0.45),
    starMultiplier: 0,
    enableLanternShadows: false,
    enableMoonShadows: false,
    enableCinematicVignette: false,
    enableBloomProxies: false,
    groundDetailMultiplier: 0,
    weatherLayerMultiplier: 0,
    pathLightMoteCount: 0,
    clearingGlowResolution: "low",
  };
}

const FALLBACK_NARRATIVE_RENDER_STATE: NarrativeRenderQualityState = {
  memoryPressure: 0,
  explorationDepth: 0,
  fireWaterBalance: 0,
  symbolicWeight: 0.5,
};

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function clamp01(value: number) {
  return clamp(Number.isFinite(value) ? value : 0, 0, 1);
}

export function getRenderQualityProfile(quality: RenderQuality): RenderQualityProfile {
  return RENDER_QUALITY_PROFILES[quality] ?? RENDER_QUALITY_PROFILES.medium;
}

export function useRenderQualityProfile() {
  const [quality, setQuality] = useState<RenderQuality>(() => resolveInitialRenderQuality());
  const profile = useMemo(() => getRenderQualityProfile(quality), [quality]);

  useEffect(() => {
    persistRenderQuality(quality);
  }, [quality]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const handleQualityChange = (event: Event) => {
      const nextQuality = (event as CustomEvent<{ quality?: unknown }>).detail?.quality;
      if (typeof nextQuality === "string" && isRenderQuality(nextQuality)) setQuality(nextQuality);
    };

    const handleStorage = (event: StorageEvent) => {
      if (event.key === RENDER_QUALITY_STORAGE_KEY && isRenderQuality(event.newValue)) setQuality(event.newValue);
    };

    window.addEventListener(RENDER_QUALITY_EVENT, handleQualityChange);
    window.addEventListener("storage", handleStorage);

    return () => {
      window.removeEventListener(RENDER_QUALITY_EVENT, handleQualityChange);
      window.removeEventListener("storage", handleStorage);
    };
  }, []);

  return profile;
}

export function getDevicePixelRatio() {
  if (typeof window === "undefined") return 1;
  return normalizeDevicePixelRatio(window.devicePixelRatio);
}

export function resolveNarrativeRenderScale({
  qualityProfile,
  narrativeWorldState = FALLBACK_NARRATIVE_RENDER_STATE,
  devicePixelRatio = getDevicePixelRatio(),
}: {
  qualityProfile: RenderQualityProfile;
  narrativeWorldState?: Partial<NarrativeRenderQualityState> | null;
  devicePixelRatio?: number;
}): NarrativeRenderScale {
  const memoryPressure = clamp01(narrativeWorldState?.memoryPressure ?? FALLBACK_NARRATIVE_RENDER_STATE.memoryPressure);
  const explorationDepth = clamp01(narrativeWorldState?.explorationDepth ?? FALLBACK_NARRATIVE_RENDER_STATE.explorationDepth);
  const symbolicWeight = clamp01(narrativeWorldState?.symbolicWeight ?? FALLBACK_NARRATIVE_RENDER_STATE.symbolicWeight);
  const fireWaterBalance = clamp(narrativeWorldState?.fireWaterBalance ?? FALLBACK_NARRATIVE_RENDER_STATE.fireWaterBalance, -1, 1);

  // Narrative rule:
  // - High memoryPressure means fog/confusion: soften the render by reducing DPR.
  // - High explorationDepth with low memoryPressure means clarity: allow a small sharpness lift.
  // - Extreme fire/water imbalance adds a tiny instability reduction so intense scenes stay stable.
  const memoryPressurePenalty = memoryPressure * 0.24;
  const clarityLift = explorationDepth * (1 - memoryPressure) * (0.045 + symbolicWeight * 0.035);
  const elementalInstabilityPenalty = Math.abs(fireWaterBalance) * memoryPressure * 0.035;
  const capMultiplier = clamp(1 - memoryPressurePenalty - elementalInstabilityPenalty + clarityLift, 0.72, 1.08);
  const narrativePixelRatioCap = clamp(qualityProfile.pixelRatioCap * capMultiplier, 0.72, qualityProfile.pixelRatioCap * 1.08);
  const safeDevicePixelRatio = normalizeDevicePixelRatio(devicePixelRatio);
  const effectivePixelRatio = clamp(Math.min(safeDevicePixelRatio, narrativePixelRatioCap), 0.72, 1.45);

  let label = "stable";
  if (memoryPressure > 0.68) label = "fog-softened";
  else if (clarityLift > 0.035) label = "clarity-sharpened";
  else if (Math.abs(fireWaterBalance) > 0.72 && memoryPressure > 0.35) label = "elemental-stabilized";

  return {
    devicePixelRatio: safeDevicePixelRatio,
    basePixelRatioCap: qualityProfile.pixelRatioCap,
    narrativePixelRatioCap,
    effectivePixelRatio,
    memoryPressurePenalty,
    clarityLift,
    label,
  };
}

export function shouldShowDebugOverlay() {
  if (typeof window === "undefined") return false;
  const params = new URLSearchParams(window.location.search);
  return params.get("debug") === "true" || params.get("debug") === "1";
}
