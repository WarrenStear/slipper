import { admitsProductionMaterialMaps } from "../materials/materialMapAdmission";
import { useProductionMaterialMaps } from "../materials/useProductionMaterialMaps";
import { createContext, memo, useCallback, useContext, useMemo, useRef, type ReactNode } from "react";
import * as THREE from "three";
import { applyTactileShader, tactileDetailFor, tactileProgramKey, type StorySurface, type TactileDetail } from "./tactileShader";
import { useSceneLook } from "../artDirection/SceneLookContext";
import { resolveMaterialMemory, resolveSurfaceDefaults, type MaterialMemory } from "../materials/materialLibrary";
import { createMaterialMapGuard } from "../materials/productionMaterialRuntime";
import { attachMaterialShadow } from "../materials/materialShadowOwnership";

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
  /** Geometry supplies per-piece metre coordinates before assembly transforms. */
  constructionCoordinates?: boolean;
  /** Only reviewed bark geometry opts in to the local bark set. */
  barkCoordinates?: boolean;
  /** Opt-in after actual receiving-mesh UV review; it never approves an asset. */
  reviewedCoordinates?: boolean;
  memory?: MaterialMemory;
  /** Borrowed maps, including KTX2 textures. The loading cache owns disposal. */
  maps?: Partial<Pick<THREE.MeshStandardMaterial, "map" | "normalMap" | "roughnessMap" | "aoMap">>;
};

/** Standard-lit surface finishes using the shared optional map delivery path. */
export const TactileMaterial = memo(function TactileMaterial({ surface, detail, color, roughness, metalness, side = THREE.FrontSide, memory, maps, constructionCoordinates = false, barkCoordinates = false, reviewedCoordinates = false, ...appearance }: TactileMaterialProps) {
  const inherited = useContext(TactileDetailContext);
  const look = useSceneLook();
  const finish = resolveSurfaceDefaults(surface, roughness, metalness);
  const state = resolveMaterialMemory(surface, finish.roughness, memory ?? { wetness: look?.look.materials.wetness, wear: look?.look.materials.environmentalWear, damage: look?.look.materials.damage, reintegrated: look?.look.materials.reintegrated });
  const resolved = detail ?? inherited;
  // A local shader-detail override must not bypass the chapter's delivery tier.
  const mapsAllowed = inherited === "relief" && resolved === "relief";
  // Generated oak was reviewed on construction UVs. Unmapped legacy props keep
  // their complete procedural finish instead of stretching a board texture.
  const productionEnabled = admitsProductionMaterialMaps(surface, inherited, resolved,
    { constructionCoordinates, barkCoordinates, reviewedCoordinates }, !!maps);
  const productionMaps = useProductionMaterialMaps(surface, productionEnabled);
  const hasAuthoredAlbedo = !!productionMaps?.map && (barkCoordinates || constructionCoordinates && ["wood", "wet-wood"].includes(surface));
  // The oak image supplies its own base colour. Retain a restrained authored tint
  // and vertex variation instead of multiplying three dark albedos together.
  const tint = useMemo(() => {
    const result = new THREE.Color(color);
    if (hasAuthoredAlbedo) result.lerp(new THREE.Color("#ffffff"), .72);
    return result.multiplyScalar(state.brightness);
  }, [color, state.brightness, hasAuthoredAlbedo]);
  const mapGuard = useMemo(() => createMaterialMapGuard(mapsAllowed ? maps ?? productionMaps : undefined), [maps, productionMaps, mapsAllowed]);
  const mapGuardRef = useRef(mapGuard);
  mapGuardRef.current = mapGuard;
  // R3F's attach interface describes generic instances; this material belongs
  // to a mesh, and the callback identity survives map readiness/tier changes.
  // R3F can move this material to a reconstructed mesh when its args change.
  // That transfer replaces the previous attach cleanup, so release our former
  // parent before establishing the component's next private depth owner.
  const attachmentRef = useRef<ReturnType<typeof attachMaterialShadow>>();
  const attach = useCallback((mesh: unknown, material: unknown) => {
    attachmentRef.current?.();
    const release = attachMaterialShadow(mesh as THREE.Mesh, material as THREE.MeshStandardMaterial, () => mapGuardRef.current);
    attachmentRef.current = release;
    return () => {
      release();
      if (attachmentRef.current === release) attachmentRef.current = undefined;
    };
  }, []);
  const shaderMemory = useMemo(() => ({ value: [0, 0, 0, 0] }), []);
  shaderMemory.value[0] = state.wetness; shaderMemory.value[1] = state.wear;
  shaderMemory.value[2] = state.damage; shaderMemory.value[3] = (memory?.reintegrated ?? look?.look.materials.reintegrated) ? 1 : 0;
  const compile = useCallback((shader: Parameters<THREE.MeshStandardMaterial["onBeforeCompile"]>[0]) => {
    applyTactileShader(shader, surface, resolved, shaderMemory, constructionCoordinates);
  }, [surface, resolved, shaderMemory, constructionCoordinates]);
  const cacheKey = useCallback(() => tactileProgramKey(surface, resolved, constructionCoordinates), [surface, resolved, constructionCoordinates]);
  const normalScale = useMemo(() => new THREE.Vector2(.24, .24), []);
  return <meshStandardMaterial attach={attach} key={cacheKey()} normalScale={normalScale} color={tint} roughness={state.roughness} metalness={finish.metalness} side={side}
    {...appearance} onBeforeRender={mapGuard} onBeforeCompile={compile} customProgramCacheKey={cacheKey} />;
});
