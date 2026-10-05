import { useMemo } from "react";
import { Sparkles } from "@react-three/drei";
import type { Slipper3DEntry, Vector3Tuple } from "../../data/slipper3dTypes.ts";
import { resolveChapterDirector } from "../../components/three/chapterDirector.ts";
import { type RenderQualityProfile } from "../../components/three/renderQuality.ts";
import { type NarrativeWorldState } from "../worldTypes.ts";
import { dominantSemanticTheme } from "../worldSemantics.ts";

export function weatherConfigForEntry(entry: Slipper3DEntry, narrativeWorldState: NarrativeWorldState) {
  const semantic = dominantSemanticTheme(entry);
  const pressure = narrativeWorldState.memoryPressure;
  const depth = narrativeWorldState.explorationDepth;

  if (semantic.theme === "fire") {
    return {
      key: "fire",
      color: "#ff7a2e",
      count: 72 + Math.round(depth * 32),
      scale: [7.8, 2.1, 7.8] as Vector3Tuple,
      size: 2.3 + semantic.score * 0.08,
      speed: 0.42,
      opacity: 0.54 + pressure * 0.16,
    };
  }

  if (semantic.theme === "water") {
    return {
      key: "water",
      color: "#82c9ff",
      count: 86 + Math.round(depth * 22),
      scale: [8.6, 1.8, 8.6] as Vector3Tuple,
      size: 1.55 + semantic.score * 0.045,
      speed: 0.24,
      opacity: 0.44 + pressure * 0.12,
    };
  }

  if (semantic.theme === "archive") {
    return {
      key: "archive",
      color: "#fff5ce",
      count: 104 + Math.round(pressure * 42),
      scale: [9.2, 2.9, 9.2] as Vector3Tuple,
      size: 1.75 + pressure * 0.8,
      speed: 0.16,
      opacity: 0.46 + pressure * 0.18,
    };
  }

  if (semantic.theme === "crown") {
    return {
      key: "crown",
      color: "#f3d37a",
      count: 96 + Math.round(depth * 28),
      scale: [8.4, 2.7, 8.4] as Vector3Tuple,
      size: 1.95 + depth * 0.9,
      speed: 0.2,
      opacity: 0.5 + pressure * 0.12,
    };
  }

  return {
    key: "threshold",
    color: "#f4efe2",
    count: 58 + Math.round(depth * 24),
    scale: [7.4, 2.0, 7.4] as Vector3Tuple,
    size: 1.6,
    speed: 0.18,
    opacity: 0.38 + pressure * 0.1,
  };
}

export function NarrativeWeather({
  entry,
  narrativeWorldState,
  qualityProfile,
}: {
  entry: Slipper3DEntry;
  narrativeWorldState: NarrativeWorldState;
  qualityProfile: RenderQualityProfile;
}) {
  const director = useMemo(() => resolveChapterDirector(entry), [entry]);
  const weather = useMemo(() => weatherConfigForEntry(entry, narrativeWorldState), [entry, narrativeWorldState]);
  const particleCount = Math.max(12, Math.round(weather.count * director.weatherMultiplier * qualityProfile.particleMultiplier));

  return (
    <group position={[0, 1.24, 0]}>
      <Sparkles
        key={`${entry.id}-${weather.key}`}
        count={particleCount}
        scale={weather.scale}
        size={weather.size * 0.09}
        speed={weather.speed}
        opacity={weather.opacity * 0.62}
        color={weather.color}
        noise={1.7}
      />
    </group>
  );
}

