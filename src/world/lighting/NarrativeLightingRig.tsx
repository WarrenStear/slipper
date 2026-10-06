import { useSceneLook } from "../../components/three/artDirection/SceneLookContext";
import { type ComponentProps, useEffect, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { type WorldVisualState } from "../../components/three/worldVisualState.ts";
import { type RenderQualityProfile } from "../../components/three/renderQuality.ts";
import { anchorMoonOffsetToOpening } from "../atmosphere/openingMoon.ts";

function LegacyNarrativeLightingRig({
  visualState,
  qualityProfile,
}: {
  visualState: WorldVisualState;
  qualityProfile: RenderQualityProfile;
}) {
  const { camera } = useThree();
  const moonRef = useRef<THREE.DirectionalLight>(null);
  const moonTargetRef = useRef<THREE.Object3D>(null);
  const rimRef = useRef<THREE.DirectionalLight>(null);
  const moonColorRef = useRef(new THREE.Color(visualState.moonColor));
  const rimColorRef = useRef(new THREE.Color(visualState.rimColor));
  const targetMoonColorRef = useRef(new THREE.Color(visualState.moonColor));
  const targetRimColorRef = useRef(new THREE.Color(visualState.rimColor));
  const moonOffsetRef = useRef(new THREE.Vector3(...visualState.moonPosition));
  const targetMoonOffsetRef = useRef(new THREE.Vector3(...visualState.moonPosition));
  const moonRightRef = useRef(new THREE.Vector3());
  const moonUpRef = useRef(new THREE.Vector3());
  const hasAnchoredMoonRef = useRef(false);
  const rimOffsetRef = useRef(new THREE.Vector3(...visualState.rimPosition));
  const targetRimOffsetRef = useRef(new THREE.Vector3(...visualState.rimPosition));

  useEffect(() => {
    if (!moonRef.current || !moonTargetRef.current) return;
    moonRef.current.target = moonTargetRef.current;
    moonTargetRef.current.updateMatrixWorld();
  }, []);

  useEffect(() => {
    hasAnchoredMoonRef.current = false;
  }, [visualState.moonPosition]);

  useFrame((state, delta) => {
    const moon = moonRef.current;
    const moonTarget = moonTargetRef.current;
    const rim = rimRef.current;
    const lerp = 1 - Math.exp(-delta * 2.6);
    const pressurePulse = 1 + Math.sin(state.clock.elapsedTime * 0.42) * visualState.shadowStrength * 0.05;

    targetMoonColorRef.current.set(visualState.moonColor);
    targetRimColorRef.current.set(visualState.rimColor);
    moonColorRef.current.lerp(targetMoonColorRef.current, lerp);
    rimColorRef.current.lerp(targetRimColorRef.current, lerp);

    if (!hasAnchoredMoonRef.current) {
      anchorMoonOffsetToOpening(
        camera,
        visualState.moonPosition,
        18,
        targetMoonOffsetRef.current,
        moonRightRef.current,
        moonUpRef.current,
      );
      moonOffsetRef.current.copy(targetMoonOffsetRef.current);
      hasAnchoredMoonRef.current = true;
    }
    targetRimOffsetRef.current.fromArray(visualState.rimPosition);
    moonOffsetRef.current.lerp(targetMoonOffsetRef.current, lerp);
    rimOffsetRef.current.lerp(targetRimOffsetRef.current, lerp);

    if (moonTarget) {
      moonTarget.position.copy(camera.position);
      moonTarget.updateMatrixWorld();
    }

    if (moon) {
      moon.color.copy(moonColorRef.current);
      moon.intensity = THREE.MathUtils.lerp(
        moon.intensity,
        visualState.moonIntensity * pressurePulse * 0.52,
        lerp,
      );
      moon.position.copy(camera.position).add(moonOffsetRef.current);
      moon.updateMatrixWorld();
    }

    if (rim) {
      rim.color.copy(rimColorRef.current);
      rim.intensity = THREE.MathUtils.lerp(rim.intensity, visualState.rimIntensity, lerp);
      rim.position.copy(camera.position).add(rimOffsetRef.current);
      rim.updateMatrixWorld();
    }
  });

  const enableMoonShadow = qualityProfile.enableMoonShadows;
  const mapSize = qualityProfile.shadowMapSize;

  return (
    <>
      <object3D ref={moonTargetRef} />
      <ambientLight intensity={visualState.ambientIntensity * 0.42} color={visualState.moonColor} />
      <hemisphereLight args={[visualState.moonColor, visualState.palette.ground, visualState.hemisphereIntensity * 1.16]} />
      <directionalLight
        ref={moonRef}
        position={visualState.moonPosition}
        color={visualState.moonColor}
        intensity={visualState.moonIntensity}
        castShadow={enableMoonShadow}
        shadow-mapSize-width={mapSize}
        shadow-mapSize-height={mapSize}
        shadow-camera-near={0.5}
        shadow-camera-far={40}
        shadow-camera-left={-12}
        shadow-camera-right={12}
        shadow-camera-top={12}
        shadow-camera-bottom={-12}
        shadow-bias={-0.00085}
        shadow-normalBias={0.045}
      />
      <directionalLight ref={rimRef} position={visualState.rimPosition} color={visualState.rimColor} intensity={visualState.rimIntensity} />
    </>
  );
}


/** Historical procedural fallback, never mounted below the canonical look. */
export function NarrativeLightingRig(props: ComponentProps<typeof LegacyNarrativeLightingRig>) {
  const presentation = useSceneLook();
  return presentation ? null : <LegacyNarrativeLightingRig {...props} />;
}
