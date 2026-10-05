import { useMemo } from "react";
import { PhysicalPathRibbon } from "../../components/three/environment/LivingPathRibbon";
import type { Slipper3DEntry } from "../../data/slipper3dTypes.ts";
import { type RenderQualityProfile } from "../../components/three/renderQuality.ts";
import { terrainCurveSeedFor, type MazePathSegment } from "../terrain/worldPaths.ts";
import { type NarrativeWorldState } from "../worldTypes.ts";
import { guidedPathSegment } from "./routeGeometry.ts";

export function LivingPathRibbon({ pathSegments, activeEntry, navigationTargetId, narrativeWorldState, sampleGroundY, qualityProfile }: {
  pathSegments: MazePathSegment[]; activeEntry: Slipper3DEntry; navigationTargetId: string | null;
  narrativeWorldState: NarrativeWorldState; sampleGroundY: (x: number, z: number) => number; qualityProfile: RenderQualityProfile;
}) {
  const curve = useMemo(() => {
    const segment = guidedPathSegment(pathSegments, activeEntry.id, navigationTargetId);
    return segment ? terrainCurveSeedFor(segment) : null;
  }, [pathSegments, activeEntry.id, navigationTargetId]);
  return <PhysicalPathRibbon curve={curve} morph={narrativeWorldState} sampleGroundY={sampleGroundY} qualityProfile={qualityProfile} />;
}

