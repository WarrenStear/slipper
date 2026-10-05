import { useMemo } from "react";
import * as THREE from "three";
import { type WorldVisualState } from "../../components/three/worldVisualState.ts";
import { type RenderQualityProfile } from "../../components/three/renderQuality.ts";
import { type SpatialStoryNode } from "../terrain/worldPlacement.ts";
import { type NarrativeWorldState } from "../worldTypes.ts";

export function ClearingLightHalo({
  nodes,
  navigationTargetId,
  approachingEntryId,
  visualState,
  narrativeWorldState,
  qualityProfile,
}: {
  nodes: SpatialStoryNode[];
  navigationTargetId: string | null;
  approachingEntryId: string | null;
  visualState: WorldVisualState;
  narrativeWorldState: NarrativeWorldState;
  qualityProfile: RenderQualityProfile;
}) {
  const haloNodes = useMemo(() => {
    const ranked = nodes
      .filter((node) => node.isActive || node.entry.id === navigationTargetId || node.entry.id === approachingEntryId)
      .sort((a, b) => {
        const rank = (node: SpatialStoryNode) => (node.isActive ? -3 : node.entry.id === navigationTargetId ? -2 : node.entry.id === approachingEntryId ? -1 : 0);
        return rank(a) - rank(b);
      });
    return ranked.slice(0, qualityProfile.clearingGlowResolution === "low" ? 2 : 3);
  }, [approachingEntryId, navigationTargetId, nodes, qualityProfile.clearingGlowResolution]);

  if (haloNodes.length === 0) return null;

    const haloOpacity = THREE.MathUtils.clamp(0.04 + visualState.clearingGlowIntensity * 0.07 + narrativeWorldState.symbolicWeight * 0.015, 0.04, 0.16);
  const showHeroLight = qualityProfile.clearingGlowResolution === "high";

  return (
    <group>
      {haloNodes.map((node) => {
        const isTarget = node.entry.id === navigationTargetId;
        const isActive = node.isActive;
        const radius = isActive ? 5.2 : isTarget ? 4.4 : 3.8;
        const opacity = haloOpacity * (isActive ? 1.18 : isTarget ? 1 : 0.72);
        const y = node.position[1] - 1.13;
        return (
          <group key={'light-halo-' + node.entry.id} position={[node.position[0], y, node.position[2]]}>
            {showHeroLight && (isActive || isTarget) ? (
              <pointLight
                color={visualState.palette.portal}
                intensity={visualState.clearingGlowIntensity * (isActive ? 0.44 : 0.3)}
                distance={14}
                decay={2.1}
                position={[0, 1.7, 0]}
                castShadow={false}
              />
            ) : null}
            <mesh rotation={[Math.PI / 2, 0, 0]} renderOrder={18}>
              <circleGeometry args={[radius, qualityProfile.clearingGlowResolution === "low" ? 36 : 72]} />
              <meshBasicMaterial color={visualState.palette.portal} transparent opacity={opacity * 0.24} depthWrite={false} side={THREE.DoubleSide} toneMapped={false} />
            </mesh>
            <mesh rotation={[Math.PI / 2, 0, 0]} renderOrder={19}>
              <ringGeometry args={[radius * 0.68, radius, qualityProfile.clearingGlowResolution === "low" ? 40 : 88]} />
              <meshBasicMaterial color={visualState.palette.particle} transparent opacity={opacity * 0.62} depthWrite={false} side={THREE.DoubleSide} toneMapped={false} />
            </mesh>
          </group>
        );
      })}
    </group>
  );
}

