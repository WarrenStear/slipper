import { createContext, memo, useCallback, useContext, type ReactNode } from "react";
import * as THREE from "three";
import { applyTactileShader, tactileDetailFor, tactileProgramKey, type StorySurface, type TactileDetail } from "./tactileShader";

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
  side?: THREE.Side;
  transparent?: boolean;
  opacity?: number;
  depthWrite?: boolean;
  emissive?: string;
  emissiveIntensity?: number;
  /** Explicit overrides support isolated review components; the game inherits its tier. */
  detail?: TactileDetail;
};

/** Standard-lit surface finishes, without new texture downloads or render targets. */
export const TactileMaterial = memo(function TactileMaterial({ surface, detail, color, roughness = .88, metalness = 0, side = THREE.FrontSide, ...appearance }: TactileMaterialProps) {
  const inherited = useContext(TactileDetailContext);
  const resolved = detail ?? inherited;
  const compile = useCallback((shader: Parameters<THREE.MeshStandardMaterial["onBeforeCompile"]>[0]) => {
    applyTactileShader(shader, surface, resolved);
  }, [surface, resolved]);
  const cacheKey = useCallback(() => tactileProgramKey(surface, resolved), [surface, resolved]);
  return <meshStandardMaterial key={cacheKey()} color={color} roughness={roughness} metalness={metalness} side={side}
    {...appearance} onBeforeCompile={compile} customProgramCacheKey={cacheKey} />;
});
