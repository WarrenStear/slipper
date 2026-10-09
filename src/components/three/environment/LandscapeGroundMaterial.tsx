import { Component, Suspense, memo, useCallback, useEffect, useMemo, type ReactNode } from "react";
import { useTexture } from "@react-three/drei";
import { Color, Vector4, SRGBColorSpace, RepeatWrapping, type Texture, type MeshStandardMaterial } from "three";
import { useTactileDetail } from "../storyEvents/TactileMaterial";
import { ENVIRONMENT_THEMES } from "./environmentThemes";
import type { LandscapeSpec } from "./landscapeGeography";
import { applyBiomeGroundShader } from "./biomeGroundShader";

const GroundMaterial = memo(function GroundMaterial({ spec, map }: { spec: LandscapeSpec; map?: Texture }) {
  const relief = useTactileDetail() === "relief", theme = ENVIRONMENT_THEMES[spec.family], mapped = Boolean(map);
  // Uniform identities are stable across shader recompiles and quality changes.
  const uniforms = useMemo(() => ({
    biomeMoss: { value: new Color() }, biomeRock: { value: new Color() },
    biomeChannel: { value: new Vector4() },
  }), []);
  uniforms.biomeMoss.value.set(theme.moss); uniforms.biomeRock.value.set(theme.rock);
  uniforms.biomeChannel.value.set(spec.riverSide, (spec.inner + spec.outer) * .5, spec.seed, spec.height);
  const compile = useCallback((shader: Parameters<MeshStandardMaterial["onBeforeCompile"]>[0]) => {
    Object.assign(shader.uniforms, uniforms); applyBiomeGroundShader(shader, relief, mapped);
  }, [relief, uniforms, mapped]);
  const cacheKey = useCallback(() => `sidtw-biome-ground-v1-${relief}${mapped ? "-mapped" : ""}`, [relief, mapped]);
  return <meshStandardMaterial key={cacheKey()} map={map ?? null} color={theme.soil} roughness={.96} metalness={0}
    onBeforeCompile={compile} customProgramCacheKey={cacheKey} />;
});

class GroundMapBoundary extends Component<{ children: ReactNode; fallback: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() { return this.state.failed ? this.props.fallback : this.props.children; }
}

function MappedWoodlandGround({ spec }: { spec: LandscapeSpec }) {
  const source = useTexture("/textures/forest/ground-albedo-v3.webp");
  const map = useMemo(() => {
    const texture = source.clone();
    texture.colorSpace = SRGBColorSpace;
    texture.wrapS = texture.wrapT = RepeatWrapping;
    // Landscape UVs already encode metres at .12 units/metre: one repeat is 3.4m.
    texture.repeat.set(1 / (.12 * 3.4), 1 / (.12 * 3.4));
    texture.anisotropy = 4; texture.needsUpdate = true;
    return texture;
  }, [source]);
  useEffect(() => () => map.dispose(), [map]);
  return <GroundMaterial spec={spec} map={map} />;
}

/** Optional existing woodland albedo; other families and local failure retain
 * the original untextured material. Each consumer owns only its transform clone. */
export const LandscapeGroundMaterial = memo(function LandscapeGroundMaterial({ spec }: { spec: LandscapeSpec }) {
  const fallback = <GroundMaterial spec={spec} />;
  if (spec.family !== "woodland") return fallback;
  return <GroundMapBoundary fallback={fallback}><Suspense fallback={fallback}><MappedWoodlandGround spec={spec} /></Suspense></GroundMapBoundary>;
});
