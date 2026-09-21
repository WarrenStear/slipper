import { useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import { Color, FogExp2 } from "three";
import { getCurrentCinematicProfile } from "../../../cinematics/emotionalCinematography";
import { useJourneyStore } from "../../../stores/useJourneyStore";
import { useSettingsStore } from "../../../stores/useSettingsStore";
import { CHAPTER_ENVIRONMENTS, environmentFamily, environmentFogDensity } from "../environment/chapterEnvironment";

export function CinematicAtmosphereDirector() {
  const sceneId = useJourneyStore(state => state.sceneId);
  const reducedEffects = useSettingsStore(state => state.reducedEffects);
  const reducedMotion = useSettingsStore(state => state.reducedMotion);
  const family = environmentFamily(sceneId);
  const chapterColor = useMemo(() => family ? new Color(CHAPTER_ENVIRONMENTS[family].fogColor) : null, [family]);
  const palette = useMemo(() => ({ cool: new Color("#19242b"), warm: new Color("#30291f"), fog: new FogExp2("#19242b", 0.008) }), []);
  useFrame(({ scene }, delta) => {
    const profile = getCurrentCinematicProfile();
    if (!(scene.fog instanceof FogExp2)) scene.fog = palette.fog;
    const fog = scene.fog as FogExp2;
    const alpha = reducedMotion ? 1 : 1 - Math.exp(-Math.max(0, Math.min(delta, .05)) * 2);
    if (chapterColor) {
      fog.color.lerp(chapterColor, alpha);
    } else {
      fog.color.copy(palette.cool).lerp(palette.warm, profile.warmth);
    }
    const density = environmentFogDensity(profile.fogDensity, profile.visibility, family, reducedEffects);
    fog.density = family ? fog.density + (density - fog.density) * alpha : density;
  });
  return null;
}
