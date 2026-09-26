import { useEffect, useState } from "react";
import { useThree } from "@react-three/fiber";
import { acquireAssetDecoders } from "../../../lib/assets/assetDecoderPool";
import type { StorySurface } from "../storyEvents/tactileShader";
import { approvedMaterialMaps, MATERIAL_MAPS } from "./materialMapRegistry";
import { createMaterialMapCache, loadMaterialTexture, requestReviewedMaterialMaps, type MaterialMaps } from "./productionMaterialRuntime";
import type { WebGLRenderer } from "three";

const acquireMaps = createMaterialMapCache((renderer: WebGLRenderer) => {
  const decoder = acquireAssetDecoders(renderer);
  return { ktx2: { loadAsync: (url: string) => loadMaterialTexture(url, decoder.ktx2) }, release: decoder.release };
});

/** Optional delivery never suspends the scene or changes material-memory state. */
export function useProductionMaterialMapDelivery(surface: StorySurface, enabled: boolean) {
  const gl = useThree(s => s.gl), entry = enabled ? approvedMaterialMaps(MATERIAL_MAPS[surface]) : null;
  const [loaded, setLoaded] = useState<{ entry: typeof entry; renderer: typeof gl; maps?: MaterialMaps; status: "ready" | "failed" } | null>(null);
  useEffect(() => {
    setLoaded(null);
    if (!entry) return;
    const request = requestReviewedMaterialMaps(entry, () => acquireMaps(gl),
      maps => setLoaded({ entry, renderer: gl, maps, status: "ready" }),
      () => setLoaded({ entry, renderer: gl, status: "failed" }));
    return request.dispose;
  }, [entry, gl]);
  if (!enabled) return { maps: undefined, status: "disabled" as const };
  if (!entry) return { maps: undefined, status: "unavailable" as const };
  if (loaded?.entry === entry && loaded.renderer === gl) return { maps: loaded.maps, status: loaded.status };
  return { maps: undefined, status: "loading" as const };
}

export function useProductionMaterialMaps(surface: StorySurface, enabled: boolean) {
  return useProductionMaterialMapDelivery(surface, enabled).maps;
}
