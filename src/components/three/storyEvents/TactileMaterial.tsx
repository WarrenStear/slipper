import { useProductionMaterialMaps } from "../materials/useProductionMaterialMaps";
import { createContext, memo, useCallback, useContext, useMemo, type ReactNode } from "react";
import * as THREE from "three";
import { applyTactileShader, tactileDetailFor, tactileProgramKey, type StorySurface, type TactileDetail } from "./tactileShader";
import { useSceneLook } from "../artDirection/SceneLookContext";
import { resolveMaterialMemory, type MaterialMemory } from "../materials/materialLibrary";

export { TACTILE_PATTERNS, TACTILE_RELIEF_NORMAL, tactileDetailFor } from "./tactileShader";
export type { StorySurface, TactileDetail } from "./tactileShader";
const TactileDetailContext = createContext<TactileDetail>("base");
export const useTactileDetail = () => useContext(TactileDetailContext);

/** One chapter-level policy; no per-material store subscription or animation loop. */
export function TactileDetailProvider({ quality, reducedEffects, children }: {
  quality: string; reducedEffects: boolean; children: ReactNode;
}) {
  return <TactileDetailContext.Provider value={tactileDetailFor(quality, reducedEffects)}>{children}</TactileDetailContext.Provider>;
}

type TactileMaterialProps = {
  surface: StorySurface;
  color: string;
  roughness?: number;
  metalness?: number;
  vertexColors?: boolean;
  side?: THREE.Side;
  transparent?: boolean;
  opacity?: number;
  depthWrite?: boolean;
  emissive?: string;
  emissiveIntensity?: number;
  /** Explicit overrides support isolated review components; the game inherits its tier. */
  detail?: TactileDetail;
  memory?: MaterialMemory;
  /** Borrowed maps, including KTX2 textures. The loading cache owns disposal. */
  maps?: Partial<Pick<THREE.MeshStandardMaterial, "map" | "normalMap" | "roughnessMap" | "aoMap">>;
};

/** Standard-lit surface finishes, without new texture downloads or render targets. */
export const TactileMaterial = memo(function TactileMaterial({ surface, detail, color, roughness = .88, metalness = 0, side = THREE.FrontSide, memory, maps, ...appearance }: TactileMaterialProps) {
  const inherited = useContext(TactileDetailContext);
  const look = useSceneLook();
  const state = resolveMaterialMemory(surface, roughness, memory ?? { wetness: look?.look.materials.wetness, wear: look?.look.materials.environmentalWear, damage: look?.look.materials.damage, reintegrated: look?.look.materials.reintegrated });
  const tint = useMemo(() => new THREE.Color(color).multiplyScalar(state.brightness), [color, state.brightness]);
  const resolved = detail ?? inherited;
  const productionMaps = useProductionMaterialMaps(surface, resolved === "relief" && !maps);
  const shaderMemory = useMemo(() => ({ value: [0, 0, 0, 0] }), []);
  shaderMemory.value[0] = state.wetness; shaderMemory.value[1] = state.wear;
  shaderMemory.value[2] = state.damage; shaderMemory.value[3] = (memory?.reintegrated ?? look?.look.materials.reintegrated) ? 1 : 0;
  const compile = useCallback((shader: Parameters<THREE.MeshStandardMaterial["onBeforeCompile"]>[0]) => {
    applyTactileShader(shader, surface, resolved, shaderMemory);
  }, [surface, resolved, shaderMemory]);
  const cacheKey = useCallback(() => tactileProgramKey(surface, resolved), [surface, resolved]);
  return <meshStandardMaterial key={cacheKey()} color={tint} roughness={state.roughness} metalness={metalness} side={side}
    {...(maps ?? productionMaps)} {...appearance} onBeforeCompile={compile} customProgramCacheKey={cacheKey} />;
});
