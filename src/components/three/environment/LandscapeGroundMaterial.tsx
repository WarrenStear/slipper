import { memo, useCallback, useMemo } from "react";
import { Color, Vector4, type MeshStandardMaterial } from "three";
import { useTactileDetail } from "../storyEvents/TactileMaterial";
import { ENVIRONMENT_THEMES } from "./environmentThemes";
import type { LandscapeSpec } from "./landscapeGeography";
import { applyBiomeGroundShader } from "./biomeGroundShader";

export const LandscapeGroundMaterial = memo(function LandscapeGroundMaterial({ spec }: { spec: LandscapeSpec }) {
  const relief = useTactileDetail() === "relief", theme = ENVIRONMENT_THEMES[spec.family];
  // Uniform identities are stable across shader recompiles and quality changes.
  const uniforms = useMemo(() => ({
    biomeMoss: { value: new Color() }, biomeRock: { value: new Color() },
    biomeChannel: { value: new Vector4() },
  }), []);
  uniforms.biomeMoss.value.set(theme.moss); uniforms.biomeRock.value.set(theme.rock);
  uniforms.biomeChannel.value.set(spec.riverSide, (spec.inner + spec.outer) * .5, spec.seed, spec.height);
  const compile = useCallback((shader: Parameters<MeshStandardMaterial["onBeforeCompile"]>[0]) => {
    Object.assign(shader.uniforms, uniforms); applyBiomeGroundShader(shader, relief);
  }, [relief, uniforms]);
  const cacheKey = useCallback(() => `sidtw-biome-ground-v1-${relief}`, [relief]);
  return <meshStandardMaterial key={cacheKey()} color={theme.soil} roughness={.96} metalness={0}
    onBeforeCompile={compile} customProgramCacheKey={cacheKey} />;
});
