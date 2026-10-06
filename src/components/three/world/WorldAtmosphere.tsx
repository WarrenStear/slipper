import { useSceneLook } from "../artDirection/SceneLookContext";
import { useEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import type { WorldDirectorState } from "../worldDirector/worldDirector";
import type { WorldVisualState } from "../worldVisualState";

type WorldAtmosphereProps = {
  worldDirector: WorldDirectorState;
  visualState: WorldVisualState;
  enabled?: boolean;
};

function clamp01(value: number) {
  return Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));
}

/** Standalone compatibility; suppress before subscribing when SceneLook owns the scene. */
export function WorldAtmosphere(props: WorldAtmosphereProps) {
  const presentation = useSceneLook();
  return presentation || props.enabled === false ? null : <LegacyWorldAtmosphere {...props} />;
}

function LegacyWorldAtmosphere({ worldDirector, visualState, enabled = true }: WorldAtmosphereProps) {
  const { scene } = useThree();
  const backgroundRef = useRef(new THREE.Color(worldDirector.environment.backgroundColor));
  const fogRef = useRef(new THREE.FogExp2(worldDirector.environment.fogColor, worldDirector.environment.fogDensity));
  const targetBackground = useMemo(() => new THREE.Color(worldDirector.environment.backgroundColor), [worldDirector.environment.backgroundColor]);
  const targetFog = useMemo(() => new THREE.Color(worldDirector.environment.fogColor), [worldDirector.environment.fogColor]);

  useEffect(() => {
    if (!enabled) return;
    scene.background = backgroundRef.current;
    scene.fog = fogRef.current;
  }, [enabled, scene]);

  useFrame((_, delta) => {
    if (!enabled) return;

    const step = Math.min(delta, 0.05);
    const smoothing = 1 - Math.exp(-step * 1.8);
    const fog = fogRef.current;
    const directorFog = worldDirector.environment.fogDensity;
    const openness = clamp01(visualState.director.skyOpenness);
    const narrativeDensity = THREE.MathUtils.clamp(directorFog * (1 - openness * 0.12), 0.0035, 0.032);

    backgroundRef.current.lerp(targetBackground, smoothing);
    fog.color.lerp(targetFog, smoothing);
    fog.density = THREE.MathUtils.lerp(fog.density, narrativeDensity, smoothing);

    scene.background = backgroundRef.current;
    scene.fog = fog;
  });

  return null;
}

export default WorldAtmosphere;
