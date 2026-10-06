import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Color, Object3D, Vector3, type DirectionalLight, type HemisphereLight, type SpotLight } from "three";
import { getCurrentCinematicProfile } from "../../cinematics/emotionalCinematography";
import { useSceneLook } from "../../components/three/artDirection/SceneLookContext";
import { sceneSkyReturn } from "../../components/three/artDirection/sceneLightAccents";
import { skyReturnStrength } from "../../components/three/artDirection/lightingQuality";
import { blendWorldValue, worldTransitionAlpha } from "../../components/three/artDirection/worldVisualContinuity";
import type { LookPoint, LookQuality } from "../../components/three/artDirection/SceneLookRegistry";

/** One presentation owner. Stable constructor props cannot reset an eased light. */
export function SceneLighting({ quality = "medium" }: { quality?: LookQuality }) {
  const presentation = useSceneLook()!;
  const { look } = presentation;
  const key = useRef<DirectionalLight & SpotLight>(null);
  const fill = useRef<HemisphereLight>(null);
  const skyReturn = useRef<DirectionalLight>(null);
  const desiredReturn = useMemo(() => sceneSkyReturn(look.sceneId), [look.sceneId]);
  const desiredReturnStrength = skyReturnStrength(quality, presentation.reducedEffects);
  const localKey = look.lighting.source === "domestic" || look.lighting.source === "fire";
  // Re-seed only when the physical light type changes. A directional key and
  // a local spot use different intensity units; never interpolate between them.
  const initialKey = useMemo(() => ({
    position: [...look.lighting.position] as LookPoint, color: look.lighting.color,
    intensity: look.lighting.intensity, angle: look.lighting.source === "fire" ? 1.24 : 1.05,
  }), [localKey]);
  const initialFill = useMemo<[string, string, number]>(() => [look.lighting.color, look.lighting.groundColor, Math.max(look.lighting.fillFloor, look.lighting.fill * 1.05)], []);
  const returnEnabled = desiredReturnStrength > 0 && desiredReturn !== null;
  // Freeze only JSX starting values. The frame loop reads live targets below,
  // so a scene/quality change cannot overwrite an in-progress transition.
  const { accent, returnStrength } = useMemo(() => ({
    accent: desiredReturn, returnStrength: desiredReturnStrength,
  }), [returnEnabled]);
  const target = useMemo(() => {
    const object = new Object3D(); object.position.set(...look.composition.focalPoint); return object;
  }, []);
  const scratch = useMemo(() => ({ color: new Color(), position: new Vector3() }), []);
  useFrame(({ gl }, delta) => {
    const profile = getCurrentCinematicProfile(), alpha = worldTransitionAlpha(delta, presentation.reducedMotion);
    gl.toneMappingExposure = profile.exposure;
    target.position.lerp(scratch.position.set(...look.composition.focalPoint), alpha);
    target.updateMatrixWorld();
    if (key.current) {
      key.current.position.lerp(scratch.position.set(...look.lighting.position), alpha);
      key.current.color.lerp(scratch.color.set(look.lighting.color), alpha);
      key.current.intensity = blendWorldValue(key.current.intensity, look.lighting.intensity, alpha);
      if (localKey) key.current.angle = blendWorldValue(key.current.angle, look.lighting.source === "fire" ? 1.24 : 1.05, alpha);
    }
    if (fill.current) {
      fill.current.color.lerp(scratch.color.set(look.lighting.color), alpha);
      fill.current.groundColor.lerp(scratch.color.set(look.lighting.groundColor), alpha);
      fill.current.intensity = blendWorldValue(fill.current.intensity, Math.max(look.lighting.fillFloor, profile.fillIntensity * 1.05), alpha);
    }
    if (skyReturn.current && desiredReturn) {
      skyReturn.current.position.lerp(scratch.position.set(...desiredReturn.position), alpha);
      skyReturn.current.color.lerp(scratch.color.set(desiredReturn.color), alpha);
      skyReturn.current.intensity = blendWorldValue(skyReturn.current.intensity, desiredReturn.intensity * desiredReturnStrength * (1 - presentation.stillness * .7), alpha);
    }
  }, -1);
  const common = { position: initialKey.position, color: initialKey.color, intensity: initialKey.intensity, ref: key };
  return <group name={`motivated-light:${look.lighting.source}`}>
    <primitive object={target} />
    <hemisphereLight ref={fill} args={initialFill} />
    {localKey ? <spotLight {...common} target={target}
      angle={initialKey.angle} penumbra={.95} distance={21} decay={2}
      castShadow={look.lighting.shadowProfile} shadow-mapSize-width={1024} shadow-mapSize-height={1024}
      shadow-camera-near={.35} shadow-camera-far={21} shadow-bias={-.0003} shadow-normalBias={.025} />
      : <directionalLight {...common} target={target} castShadow={look.lighting.shadowProfile}
        shadow-mapSize-width={1024} shadow-mapSize-height={1024} shadow-camera-left={-16} shadow-camera-right={16}
        shadow-camera-top={16} shadow-camera-bottom={-16} shadow-camera-near={.5} shadow-camera-far={85}
        shadow-bias={-.0003} shadow-normalBias={.035} />}
    {returnStrength > 0 && accent ? <directionalLight ref={skyReturn} name="canopy-sky-return" target={target}
      position={accent.position} color={accent.color} intensity={accent.intensity * returnStrength} castShadow={false} /> : null}
  </group>;
}
