import { useEffect, useMemo, useState } from "react";
import { useThree } from "@react-three/fiber";
import type { Texture, WebGLRenderer } from "three";
import { acquireAssetDecoders } from "./src/lib/assets/assetDecoderPool";
import { cloneMaterialMapSampler, loadMaterialTexture } from "./src/components/three/materials/productionMaterialRuntime";
import { createConstructionGeometry } from "./src/components/three/chapters/chapterArtGeometry";
import { hasNondegeneratePlasterUvs } from "./src/components/three/environmentArt/plasterGeometry";
import { TactileMaterial, TactileDetailProvider } from "./src/components/three/storyEvents/TactileMaterial";
import type { MaterialMemory } from "./src/components/three/materials/materialLibrary";

/** External asset audition: no fabricated approved registry entry and no source activation. */
function useExternalPlasterAlbedo(enabled: boolean) {
  const renderer = useThree(state => state.gl);
  const [loaded, setLoaded] = useState<{ renderer: WebGLRenderer; map?: Texture; status: "ready" | "failed" } | null>(null);
  useEffect(() => {
    setLoaded(null); if (!enabled) return;
    const decoders = acquireAssetDecoders(renderer);
    let active = true, released = false, ownedSource: Texture | undefined, ownedView: Texture | undefined;
    const release = () => { if (!released) { released = true; decoders.release(); } };
    const disposeOwned = () => { ownedView?.dispose(); ownedView = undefined; ownedSource?.dispose(); ownedSource = undefined; };
    const pending = loadMaterialTexture("/art/materials/plaster/plaster-albedo-v1.ktx2", decoders.ktx2).then(source => {
      if (!active) { source.dispose(); return; }
      ownedSource = source;
      if (source.image?.width !== 512 || source.image?.height !== 512) throw new Error("Plaster audition dimensions do not match its immutable source record");
      // Exact production-owned view sampler, without a fabricated approval entry.
      ownedView = cloneMaterialMapSampler(source, "map", { repeat: [1, 1] });
      setLoaded({ renderer, map: ownedView, status: "ready" });
    }).catch(() => { disposeOwned(); release(); if (active) setLoaded({ renderer, status: "failed" }); });
    return () => { active = false; disposeOwned(); void pending.then(release); };
  }, [enabled, renderer]);
  if (!enabled) return { map: undefined, status: "disabled" as const };
  return loaded?.renderer === renderer ? loaded : { map: undefined, status: "loading" as const };
}

export function PlasterReviewReceiver({ quality, reducedEffects, mapsEnabled, memory = {} }: {
  quality: "low" | "medium" | "high" | "cinematic";
  reducedEffects: boolean;
  mapsEnabled: boolean;
  memory?: MaterialMemory;
}) {
  const geometry = useMemo(() => createConstructionGeometry([
    { position: [0, 0, 0], size: [4.6, 2.8, .16] },
    { position: [2.5, 0, -.34], size: [.2, 2.8, .8] },
  ], true), []);
  useEffect(() => () => geometry.dispose(), [geometry]);
  const uvValid = useMemo(() => hasNondegeneratePlasterUvs(geometry), [geometry]);
  const enabled = mapsEnabled && uvValid && !reducedEffects && (quality === "high" || quality === "cinematic");
  const delivery = useExternalPlasterAlbedo(enabled);
  return <TactileDetailProvider quality={quality} reducedEffects={reducedEffects}>
    <mesh name="external-unreviewed-plaster-receiver" geometry={geometry} receiveShadow castShadow
      userData={{ reviewStatus: "generated-unreviewed", uvValid, deliveryStatus: delivery.status, approvedProductionComparison: false }}>
      <TactileMaterial surface="plaster" color="#746251" roughness={.96} vertexColors memory={memory}
        maps={delivery.map ? { map: delivery.map } : {}} />
    </mesh>
  </TactileDetailProvider>;
}
