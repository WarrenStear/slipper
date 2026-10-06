import { useSceneLook } from "../artDirection/SceneLookContext";
import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import type { WorldDirectorState } from "../worldDirector/worldDirector";
import type { WorldVisualState } from "../worldVisualState";

type WorldLightingRigProps = {
  worldDirector: WorldDirectorState;
  visualState: WorldVisualState;
  enabled?: boolean;
};

function ease(current: number, target: number, delta: number, speed: number) {
  return THREE.MathUtils.lerp(current, target, 1 - Math.exp(-delta * speed));
}

function resolveShadowRadius(quality: WorldDirectorState["performance"]["quality"]) {
  if (quality === "cinematic") return 18;
  if (quality === "high") return 15;
  return 12;
}

/** Standalone compatibility; suppress before subscribing when SceneLook owns the scene. */
export function WorldLightingRig(props: WorldLightingRigProps) {
  const presentation = useSceneLook();
  return presentation || props.enabled === false ? null : <LegacyWorldLightingRig {...props} />;
}

function LegacyWorldLightingRig({ worldDirector, visualState, enabled = true }: WorldLightingRigProps) {
  const ambientRef = useRef<THREE.AmbientLight>(null);
  const hemiRef = useRef<THREE.HemisphereLight>(null);
  const moonRef = useRef<THREE.DirectionalLight>(null);
  const rimRef = useRef<THREE.DirectionalLight>(null);
  const moonTarget = useMemo(() => new THREE.Object3D(), []);
  const moonPositionRef = useRef(new THREE.Vector3(...visualState.moonPosition));
  const rimPositionRef = useRef(new THREE.Vector3(...visualState.rimPosition));
  const targetPositionRef = useRef(new THREE.Vector3());

  const moonColor = useMemo(() => new THREE.Color(visualState.moonColor), [visualState.moonColor]);
  const rimColor = useMemo(() => new THREE.Color(visualState.rimColor), [visualState.rimColor]);
  const groundColor = useMemo(() => new THREE.Color(visualState.palette.ground), [visualState.palette.ground]);
  const fogColor = useMemo(() => new THREE.Color(worldDirector.environment.fogColor), [worldDirector.environment.fogColor]);

  useFrame(({ camera }, delta) => {
    if (!enabled) return;

    const step = Math.min(delta, 0.05);
    const moon = moonRef.current;
    const rim = rimRef.current;
    const ambient = ambientRef.current;
    const hemi = hemiRef.current;
    const smoothing = 1 - Math.exp(-step * 2.35);

    if (ambient) {
      ambient.color.lerp(fogColor, smoothing);
      ambient.intensity = ease(ambient.intensity, worldDirector.environment.ambientIntensity * 0.64, step, 2.6);
    }

    if (hemi) {
      hemi.color.lerp(moonColor, smoothing);
      hemi.groundColor.lerp(groundColor, smoothing);
      hemi.intensity = ease(hemi.intensity, worldDirector.environment.hemisphereIntensity * 0.92, step, 2.6);
    }

    if (moon) {
      targetPositionRef.current.set(camera.position.x, 0, camera.position.z);
      moonTarget.position.lerp(targetPositionRef.current, smoothing);
      moonTarget.updateMatrixWorld();

      moonPositionRef.current.set(
        camera.position.x + visualState.moonPosition[0],
        visualState.moonPosition[1],
        camera.position.z + visualState.moonPosition[2],
      );
      moon.color.lerp(moonColor, smoothing);
      moon.intensity = ease(moon.intensity, visualState.moonIntensity, step, 2.4);
      moon.position.lerp(moonPositionRef.current, smoothing);
      moon.target = moonTarget;
      moon.castShadow = Boolean(worldDirector.performance.quality === "cinematic" && worldDirector.performance.shadows);

      if (moon.castShadow) {
        const radius = resolveShadowRadius(worldDirector.performance.quality);
        const shadowCamera = moon.shadow.camera as THREE.OrthographicCamera;
        shadowCamera.left = -radius;
        shadowCamera.right = radius;
        shadowCamera.top = radius;
        shadowCamera.bottom = -radius;
        shadowCamera.near = 1;
        shadowCamera.far = 44;
        shadowCamera.updateProjectionMatrix();
        moon.shadow.bias = -0.00024;
        moon.shadow.normalBias = 0.018;
      }
    }

    if (rim) {
      rimPositionRef.current.set(
        camera.position.x + visualState.rimPosition[0],
        visualState.rimPosition[1],
        camera.position.z + visualState.rimPosition[2],
      );
      rim.color.lerp(rimColor, smoothing);
      rim.intensity = ease(rim.intensity, visualState.rimIntensity * 1.34, step, 2.4);
      rim.position.lerp(rimPositionRef.current, smoothing);
    }
  });

  return (
    <>
      <primitive object={moonTarget} />
      <ambientLight ref={ambientRef} intensity={worldDirector.environment.ambientIntensity * 0.64} color={worldDirector.environment.fogColor} />
      <hemisphereLight
        ref={hemiRef}
        args={[visualState.moonColor, visualState.palette.ground, worldDirector.environment.hemisphereIntensity * 0.92]}
      />
      <directionalLight
        ref={moonRef}
        color={visualState.moonColor}
        intensity={visualState.moonIntensity}
        position={visualState.moonPosition}
        castShadow={false}
        shadow-mapSize-width={768}
        shadow-mapSize-height={768}
        shadow-camera-near={1}
        shadow-camera-far={44}
        shadow-camera-left={-18}
        shadow-camera-right={18}
        shadow-camera-top={18}
        shadow-camera-bottom={-18}
      />
      <directionalLight
        ref={rimRef}
        color={visualState.rimColor}
        intensity={visualState.rimIntensity * 1.34}
        position={visualState.rimPosition}
      />
    </>
  );
}

export default WorldLightingRig;
