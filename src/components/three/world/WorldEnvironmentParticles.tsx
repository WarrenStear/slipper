import { useMemo, useRef } from "react";
import { Sparkles } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import type { WorldDirectorState } from "../worldDirector/worldDirector";
import type { WorldVisualState } from "../worldVisualState";

type WorldEnvironmentParticlesProps = {
  worldDirector: WorldDirectorState;
  visualState: WorldVisualState;
  enabled?: boolean;
};

export function WorldEnvironmentParticles({ worldDirector, visualState, enabled = true }: WorldEnvironmentParticlesProps) {
  const groupRef = useRef<THREE.Group>(null);
  const followPositionRef = useRef(new THREE.Vector3());
  const particleBudget = worldDirector.performance.particleScale;
  const weather = Math.max(0, worldDirector.environment.weatherIntensity) * particleBudget;
  const count = useMemo(() => Math.round(30 + weather * 104), [weather]);

  useFrame(({ camera }, delta) => {
    const group = groupRef.current;
    if (!group || !enabled) return;
    const smoothing = 1 - Math.exp(-Math.min(delta, 0.05) * 2.4);
    followPositionRef.current.set(camera.position.x, camera.position.y + 1.3, camera.position.z - 1.8);
    group.position.lerp(followPositionRef.current, smoothing);
  });

  if (!enabled) return null;

  return (
    <group ref={groupRef}>
      {weather > 0.08 ? (
        <Sparkles
          count={count}
          scale={[26, 8, 26]}
          size={0.1 + visualState.particleIntensity * 0.06}
          speed={0.08 + visualState.weatherIntensity * 0.08}
          opacity={Math.min(0.52, 0.12 + weather * 0.3)}
          color={visualState.palette.particle}
          position={[0, 0, 0]}
        />
      ) : null}
    </group>
  );
}

export default WorldEnvironmentParticles;
