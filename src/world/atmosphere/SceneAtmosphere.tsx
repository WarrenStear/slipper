import { useEffect, useMemo, useRef } from "react";
import { Stars } from "@react-three/drei";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import type { Slipper3DEntry } from "../../data/slipper3dTypes.ts";
import { resolveWorldVisualState } from "../../components/three/worldVisualState.ts";
import { type RenderQualityProfile } from "../../components/three/renderQuality.ts";
import { type NarrativeWorldState } from "../worldTypes.ts";
import { hasAuthoredChapterMoon } from "../worldPresentationPolicy.ts";
import { nearestEntryByXZ } from "../terrain/worldPlacement.ts";
import { CelestialMoon } from "./CelestialMoon.tsx";
import { DEFAULT_ENVIRONMENT_RADIUS } from "../terrain/worldConstants.ts";

export function SceneAtmosphere({
  cinematicActive = false,
  entry,
  entries,
  narrativeWorldState,
  qualityProfile,
}: {
  entry: Slipper3DEntry;
  entries: Slipper3DEntry[];
  narrativeWorldState: NarrativeWorldState;
  qualityProfile: RenderQualityProfile;
  cinematicActive?: boolean;
}) {
  const { camera, scene } = useThree();
  const starsRef = useRef<THREE.Group>(null);
  const activeVisualState = useMemo(
    () => resolveWorldVisualState({ entry, nearestEntry: entry, nearestDistance: 0, narrativeWorldState }),
    [entry, narrativeWorldState],
  );
  const bgColorRef = useRef(new THREE.Color(activeVisualState.backgroundColor));
  const fogColorRef = useRef(new THREE.Color(activeVisualState.fogColor));
  const targetBgColorRef = useRef(new THREE.Color(activeVisualState.backgroundColor));
  const targetFogColorRef = useRef(new THREE.Color(activeVisualState.fogColor));
  const sampledVisualStateRef = useRef(activeVisualState);
  const lastAtmosphereSampleRef = useRef(Number.NEGATIVE_INFINITY);
  const suppressAmbientMoon = hasAuthoredChapterMoon(entry.id);

  useEffect(() => {
    sampledVisualStateRef.current = activeVisualState;
    lastAtmosphereSampleRef.current = Number.NEGATIVE_INFINITY;
    targetBgColorRef.current.set(activeVisualState.backgroundColor);
    targetFogColorRef.current.set(activeVisualState.fogColor);
    if (!(scene.background instanceof THREE.Color)) {
      scene.background = bgColorRef.current.clone();
    }
    if (!(scene.fog instanceof THREE.FogExp2)) {
      scene.fog = new THREE.FogExp2(fogColorRef.current.clone(), activeVisualState.fogDensity);
    }
  }, [activeVisualState.backgroundColor, activeVisualState.fogColor, activeVisualState.fogDensity, scene]);

  useFrame((state, delta) => {
    if (starsRef.current) starsRef.current.position.copy(camera.position);

    let visualState = sampledVisualStateRef.current;
    if (state.clock.elapsedTime - lastAtmosphereSampleRef.current >= 0.16) {
      const nearest = nearestEntryByXZ(camera.position.x, camera.position.z, entries);
      const nearestDistance = Math.sqrt(nearest.distanceSq);
      const nearestEntry = nearest.entry && nearestDistance < 38 ? nearest.entry : entry;
      visualState = resolveWorldVisualState({ entry, nearestEntry, nearestDistance, narrativeWorldState });
      sampledVisualStateRef.current = visualState;
      lastAtmosphereSampleRef.current = state.clock.elapsedTime;
    }

    const lerpSpeed = 1 - Math.exp(-delta * 0.92);

    targetBgColorRef.current.set(visualState.backgroundColor);
    targetFogColorRef.current.set(visualState.fogColor);

    if (!(scene.background instanceof THREE.Color)) {
      scene.background = bgColorRef.current.clone();
    }

    bgColorRef.current.copy(scene.background as THREE.Color);
    bgColorRef.current.lerp(targetBgColorRef.current, lerpSpeed);
    (scene.background as THREE.Color).copy(bgColorRef.current);

    if (!(scene.fog instanceof THREE.FogExp2)) {
      scene.fog = new THREE.FogExp2(fogColorRef.current.clone(), visualState.fogDensity);
    }

    if (cinematicActive) return;
    const fog = scene.fog as THREE.FogExp2;
    fog.color.lerp(targetFogColorRef.current, lerpSpeed);
    fog.density = THREE.MathUtils.lerp(fog.density, visualState.fogDensity, lerpSpeed);
  });

  return (
    <>
      {suppressAmbientMoon ? null : (
        <CelestialMoon
          visualState={activeVisualState}
          qualityProfile={qualityProfile}
          radius={entry.engine3d.environmentRadius ?? DEFAULT_ENVIRONMENT_RADIUS}
        />
      )}
      {activeVisualState.showStars && qualityProfile.starMultiplier > 0 ? (
        <group ref={starsRef} renderOrder={-35}>
          <Stars
            radius={204}
            depth={22}
            count={Math.max(120, Math.round(activeVisualState.starCount * qualityProfile.starMultiplier))}
            factor={activeVisualState.starFactor * qualityProfile.starMultiplier}
            saturation={0}
            fade
            speed={0.12 + narrativeWorldState.memoryPressure * 0.05}
          />
        </group>
      ) : null}
    </>
  );
}

