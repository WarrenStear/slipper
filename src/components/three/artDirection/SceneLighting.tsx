import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Color, Object3D, MathUtils, type DirectionalLight, type HemisphereLight, type PointLight, type SpotLight } from "three";
import { getCurrentCinematicProfile } from "../../../cinematics/emotionalCinematography";
import { useSceneLook } from "./SceneLookContext";
import { sceneSkyReturn } from "./sceneLightAccents";

/** One motivated key, sky/ground fill, and a bounded non-shadowing outdoor return. */
export function SceneLighting() {
  const presentation = useSceneLook()!;
  const { look } = presentation;
  const key = useRef<DirectionalLight & SpotLight & PointLight>(null);
  const fill = useRef<HemisphereLight>(null);
  const skyReturn = useRef<DirectionalLight>(null);
  const accent = useMemo(() => sceneSkyReturn(look.sceneId), [look.sceneId]);
  const target = useMemo(() => new Object3D(), []);
  const colors = useMemo(() => ({ key: new Color(), sky: new Color(), ground: new Color(), return: new Color() }), []);
  useEffect(() => { target.position.set(...look.composition.focalPoint); target.updateMatrixWorld(); }, [target, look]);
  useFrame(({ gl }, delta) => {
    const profile = getCurrentCinematicProfile(), alpha = presentation.reducedMotion ? 1 : 1 - Math.exp(-Math.min(delta, .05) * 2.4);
    gl.toneMappingExposure = profile.exposure;
    colors.key.set(look.lighting.color); colors.sky.set(look.lighting.color); colors.ground.set(look.lighting.groundColor);
    if (key.current) {
      key.current.color.lerp(colors.key, alpha);
      key.current.intensity = MathUtils.lerp(key.current.intensity, look.lighting.intensity, alpha);
    }
    if (fill.current) {
      fill.current.color.lerp(colors.sky, alpha); fill.current.groundColor.lerp(colors.ground, alpha);
      fill.current.intensity = MathUtils.lerp(fill.current.intensity, Math.max(look.lighting.fillFloor, profile.fillIntensity * 1.05), alpha);
    }
    if (skyReturn.current && accent) {
      colors.return.set(accent.color); skyReturn.current.color.lerp(colors.return, alpha);
      skyReturn.current.intensity = MathUtils.lerp(skyReturn.current.intensity, accent.intensity * (1 - presentation.stillness * .7), alpha);
    }
  }, -1);
  const common = { position: look.lighting.position, color: look.lighting.color, intensity: look.lighting.intensity, ref: key };
  return <group name={`motivated-light:${look.lighting.source}`}>
    <primitive object={target} />
    <hemisphereLight ref={fill} args={[look.lighting.color, look.lighting.groundColor, Math.max(look.lighting.fillFloor, look.lighting.fill * 1.05)]} />
    {look.lighting.source === "domestic" || look.lighting.source === "fire" ? <spotLight {...common} target={target}
      angle={look.lighting.source === "fire" ? 1.24 : 1.05} penumbra={.95} distance={21} decay={2}
      castShadow={look.lighting.shadowProfile} shadow-mapSize-width={1024} shadow-mapSize-height={1024}
      shadow-camera-near={.35} shadow-camera-far={21} shadow-bias={-.0003} shadow-normalBias={.025} />
      : <directionalLight {...common} target={target} castShadow={look.lighting.shadowProfile}
        shadow-mapSize-width={1024} shadow-mapSize-height={1024} shadow-camera-left={-16} shadow-camera-right={16}
        shadow-camera-top={16} shadow-camera-bottom={-16} shadow-camera-near={.5} shadow-camera-far={85}
        shadow-bias={-.0003} shadow-normalBias={.035} />}
    {look.budget.shafts && accent ? <directionalLight ref={skyReturn} name="canopy-sky-return" target={target}
      position={accent.position} color={accent.color} intensity={accent.intensity} castShadow={false} /> : null}
  </group>;
}
