import { useMemo, useRef } from "react";
import { Sparkles } from "@react-three/drei";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import type { Slipper3DEntry, Vector3Tuple } from "../../data/slipper3dTypes.ts";
import { type WorldVisualState } from "../../components/three/worldVisualState.ts";
import { type RenderQualityProfile } from "../../components/three/renderQuality.ts";
import { type NarrativeWorldState } from "../worldTypes.ts";
import { clamp01, hashString } from "../worldMath.ts";

export type WeatherLayerConfig = {
  key: string;
  color: string;
  count: number;
  scale: Vector3Tuple;
  size: number;
  speed: number;
  opacity: number;
  y: number;
};

export function weatherLayersForBiome(visualState: WorldVisualState, narrativeWorldState: NarrativeWorldState): WeatherLayerConfig[] {
  const memory = clamp01(narrativeWorldState.memoryPressure);
  const depth = clamp01(narrativeWorldState.explorationDepth);
  const fireBias = clamp01(narrativeWorldState.fireWaterBalance * 0.5 + 0.5);
  const intensity = visualState.weatherIntensity;

  if (visualState.biome === "mirror") {
    return [
      { key: "mirror-mist", color: "#8fdcff", count: 96, scale: [16, 2.4, 16], size: 1.05, speed: 0.11, opacity: 0.34 + memory * 0.12, y: 0.86 },
      { key: "mirror-shards", color: "#d8f7ff", count: 34, scale: [10, 1.2, 10], size: 0.72, speed: 0.05, opacity: 0.2 + intensity * 0.12, y: 0.12 },
    ];
  }

  if (visualState.biome === "thorned") {
    return [
      { key: "thorn-ash", color: "#b69a8e", count: 76, scale: [13.5, 2.2, 13.5], size: 1.15, speed: 0.17, opacity: 0.28 + memory * 0.18, y: 0.72 },
      { key: "thorn-dust", color: "#4f3b31", count: 42, scale: [10, 1.0, 10], size: 0.82, speed: 0.08, opacity: 0.18 + memory * 0.08, y: -0.08 },
    ];
  }

  if (visualState.biome === "archive") {
    return [
      { key: "archive-stars", color: "#dbe6ff", count: 130, scale: [16, 4.2, 16], size: 0.96, speed: 0.08, opacity: 0.38 + intensity * 0.16, y: 1.54 },
      { key: "archive-paper", color: "#fff3ce", count: 48, scale: [12, 2.4, 12], size: 1.38, speed: 0.06, opacity: 0.2 + memory * 0.08, y: 0.46 },
    ];
  }

  if (visualState.biome === "fireRiver") {
    return [
      { key: "fire-river-embers", color: "#ff9a42", count: 86, scale: [14, 2.4, 14], size: 1.42, speed: 0.22 + fireBias * 0.1, opacity: 0.34 + fireBias * 0.18, y: 0.8 },
      { key: "fire-river-spray", color: "#7fd5ff", count: 58, scale: [13, 1.4, 13], size: 0.94, speed: 0.13, opacity: 0.18 + (1 - fireBias) * 0.16, y: 0.18 },
    ];
  }

  if (visualState.biome === "crowned") {
    return [
      { key: "crowned-gold-dust", color: "#ffe1a3", count: 118, scale: [16, 5.2, 16], size: 1.22 + depth * 0.32, speed: 0.1, opacity: 0.36 + intensity * 0.18, y: 1.72 },
      { key: "crowned-high-stars", color: "#fff7d8", count: 54, scale: [12, 6.2, 12], size: 1.6, speed: 0.04, opacity: 0.18 + depth * 0.12, y: 3.1 },
    ];
  }

  return [
    { key: "first-wood-pollen", color: "#d7c39a", count: 72, scale: [13.5, 2.4, 13.5], size: 0.96, speed: 0.08, opacity: 0.24 + memory * 0.1, y: 0.86 },
    { key: "first-wood-fireflies", color: "#ffd77a", count: 28, scale: [9, 1.8, 9], size: 1.4, speed: 0.12, opacity: 0.18 + intensity * 0.1, y: 0.3 },
  ];
}

export function BiomeWeatherField({
  activeEntry,
  narrativeWorldState,
  visualState,
  qualityProfile,
}: {
  activeEntry: Slipper3DEntry;
  narrativeWorldState: NarrativeWorldState;
  visualState: WorldVisualState;
  qualityProfile: RenderQualityProfile;
}) {
  const { camera } = useThree();
  const groupRef = useRef<THREE.Group>(null);
  const layers = useMemo(
    () => weatherLayersForBiome(visualState, narrativeWorldState),
    [
      visualState.biome,
      visualState.weatherIntensity,
      narrativeWorldState.memoryPressure,
      narrativeWorldState.explorationDepth,
      narrativeWorldState.fireWaterBalance,
    ],
  );

  useFrame(({ clock }) => {
    if (!groupRef.current) return;
    groupRef.current.position.copy(camera.position);
    groupRef.current.rotation.y = Math.sin(clock.elapsedTime * 0.035 + hashString(activeEntry.chapter) * 0.0001) * 0.08;
  });

  const density = qualityProfile.weatherLayerMultiplier * qualityProfile.particleMultiplier * visualState.weatherIntensity;
  if (density < 0.08) return null;

  return (
    <group ref={groupRef}>
      {layers.map((layer) => (
        <group key={`${visualState.biome}-${layer.key}`} position={[0, layer.y, 0]}>
          <Sparkles
            count={Math.max(6, Math.round(layer.count * density))}
            scale={layer.scale}
            size={layer.size * 0.14}
            speed={layer.speed}
            opacity={layer.opacity * 0.66 * Math.min(1, density + 0.22)}
            color={layer.color}
            noise={visualState.biome === "thorned" ? 2.2 : 1.55}
          />
        </group>
      ))}

      {qualityProfile.enableBloomProxies && visualState.biome === "crowned" ? (
        <group position={[0, 1.6, -5.2]} rotation={[0, 0, 0]}>
          {[0, 1, 2].map((index) => (
            <mesh key={`crowned-light-shaft-${index}`} position={[(index - 1) * 1.4, 1.3 + index * 0.46, -index * 0.35]} rotation={[0.18, 0, (index - 1) * 0.08]}>
              <planeGeometry args={[0.24 + index * 0.08, 4.4 + index * 0.9]} />
              <meshBasicMaterial color="#ffe1a3" transparent opacity={(0.034 + index * 0.012) * visualState.bloomIntensity} depthWrite={false} side={THREE.DoubleSide} toneMapped={false} />
            </mesh>
          ))}
        </group>
      ) : null}
    </group>
  );
}

