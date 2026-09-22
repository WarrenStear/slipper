import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Color, type HemisphereLight, type PointLight } from "three";
import { useJourneyStore } from "../../../stores/useJourneyStore";
import { environmentFamily } from "../environment/chapterEnvironment";
import { getCurrentCinematicProfile } from "../../../cinematics/emotionalCinematography";

export function CinematicLightingDirector() {
  const sceneId = useJourneyStore(state => state.sceneId);
  // Authored local rigs provide the key; keep this existing camera
  // light only as a low-intensity readability fill in those chapters.
  const localKey = environmentFamily(sceneId) !== null;
  const enclosed = sceneId === "broken-floor.confession" || sceneId.startsWith("thorned.");
  const key = useRef<PointLight>(null);
  const fill = useRef<HemisphereLight>(null);
  const colors = useMemo(() => ({ cool: new Color("#b6cad9"), warm: new Color("#e1bd91"), tint: new Color(), earth: new Color("#44382e"), night: new Color("#20292b") }), []);
  useFrame(({ camera, gl }) => {
    const profile = getCurrentCinematicProfile();
    gl.toneMappingExposure = profile.exposure;
    colors.tint.copy(colors.cool).lerp(colors.warm, profile.warmth);
    if (key.current) {
      key.current.position.copy(camera.position); key.current.position.x += 3; key.current.position.y += 4;
      key.current.color.copy(colors.tint); key.current.intensity = profile.keyIntensity * profile.contrast * (localKey ? .3 : 1);
    }
    if (fill.current) {
      fill.current.color.copy(colors.tint);
      // A restrained ground bounce reveals bevels and joinery in enclosed
      // rooms without lifting the background or adding another light source.
      fill.current.groundColor.copy(enclosed ? colors.earth : colors.night);
      fill.current.intensity = Math.max(enclosed ? .2 : .1, profile.fillIntensity / profile.contrast);
    }
  });
  return <group name="CinematicLightingDirector"><hemisphereLight ref={fill} args={["#c6d0d3", "#151717", 0.16]} /><pointLight ref={key} distance={28} decay={2} intensity={0.38} castShadow={false} /></group>;
}
