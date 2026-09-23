import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Color, Object3D, MathUtils, type DirectionalLight, type HemisphereLight, type PointLight, type SpotLight } from "three";
import { getCurrentCinematicProfile } from "../../../cinematics/emotionalCinematography";
import { useSceneLook } from "./SceneLookContext";

/** One scene-anchored motivated key and one low sky/ground readability fill. */
export function SceneLighting() {
  const presentation = useSceneLook()!;
  const { look } = presentation;
  const key = useRef<DirectionalLight & SpotLight & PointLight>(null);
  const fill = useRef<HemisphereLight>(null);
  const target = useMemo(() => new Object3D(), []);
  const colors = useMemo(() => ({ key: new Color(), sky: new Color(), ground: new Color() }), []);
  useEffect(() => { target.position.set(...look.composition.focalPoint); target.updateMatrixWorld(); }, [target, look]);
  useFrame(({ gl }, delta) => {
    const profile = getCurrentCinematicProfile(), alpha = presentation.reducedMotion ? 1 : 1 - Math.exp(-Math.min(delta, .05) * 2.4);
    gl.toneMappingExposure = profile.exposure;
    colors.key.set(look.lighting.color); colors.sky.set(look.lighting.color); colors.ground.set(look.palette.ground);
    if (key.current) {
      key.current.color.lerp(colors.key, alpha);
      key.current.intensity = MathUtils.lerp(key.current.intensity, look.lighting.intensity, alpha);
    }
    if (fill.current) {
      fill.current.color.lerp(colors.sky, alpha); fill.current.groundColor.lerp(colors.ground, alpha);
      fill.current.intensity = MathUtils.lerp(fill.current.intensity, Math.max(.24, profile.fillIntensity * 1.8), alpha);
    }
  }, -1);
  const common = { position: look.lighting.position, color: look.lighting.color, intensity: look.lighting.intensity, ref: key };
  return <group name={`motivated-light:${look.lighting.source}`}>
    <primitive object={target} />
    <hemisphereLight ref={fill} args={[look.lighting.color, look.palette.ground, Math.max(.24, look.lighting.fill * 1.8)]} />
    {look.lighting.source === "domestic" ? <spotLight {...common} target={target} angle={1.05} penumbra={.9} distance={19} decay={2} castShadow={false} />
      : look.lighting.source === "fire" ? <pointLight {...common} distance={21} decay={2} castShadow={false} />
        : <directionalLight {...common} target={target} castShadow={look.lighting.shadowProfile}
          shadow-mapSize-width={1024} shadow-mapSize-height={1024} shadow-camera-left={-16} shadow-camera-right={16}
          shadow-camera-top={16} shadow-camera-bottom={-16} shadow-camera-near={.5} shadow-camera-far={85}
          shadow-bias={-.0003} shadow-normalBias={.035} />}
  </group>;
}
