import { useEffect, useState } from "react";
import { useThree } from "@react-three/fiber";
import { HERO_ASSETS, approvedHeroAsset, type HeroAssetId } from "../../components/three/actors/heroAssetRegistry.ts";
import { acquireHeroAsset } from "./heroAssetRuntime.ts";
import { cloneNpcPresentation } from "./npcAssetPolicy.ts";
import type { GLTF } from "three/examples/jsm/loaders/GLTFLoader.js";
export { acquireAssetDecoders, DRACO_DECODER_PATH, BASIS_TRANSCODER_PATH } from "./assetDecoderPool.ts";

/** Optional heroes never suspend the scene. Effects own loads and instance clones,
 * so abandoned renders and StrictMode cannot leave orphan materials or workers. */
export function useHeroPresentation(id: HeroAssetId) {
  const gl = useThree(state => state.gl), entry = approvedHeroAsset(HERO_ASSETS[id]);
  const [loaded, setLoaded] = useState<{ entry: typeof entry; renderer: typeof gl; model: ReturnType<typeof cloneNpcPresentation> } | null>(null);
  useEffect(() => {
    if (!entry) return;
    let active = true, model: ReturnType<typeof cloneNpcPresentation> | undefined;
    let lease: ReturnType<typeof acquireHeroAsset>;
    try { lease = acquireHeroAsset(gl, id, entry); }
    catch { return; }
    void lease.pending.then(result => {
      if (!active) return;
      model = cloneNpcPresentation(result.asset.scene);
      model.scene.userData.reviewedHero = { id, url: entry.url, revision: entry.review.revision, metrics: result.metrics };
      setLoaded({ entry, renderer: gl, model });
    }).catch(() => { if (active) setLoaded(null); });
    return () => { active = false; model?.dispose(); lease.release(); };
  }, [entry, gl, id]);
  return loaded && loaded.entry === entry && loaded.renderer === gl ? loaded.model.scene : null;
}

/** Legacy callers also require registry approval; replacing a /models/ placeholder
 * file cannot opt into production. Their authored fallback renders immediately. */
export function useCompressedGLTF(path: string): GLTF | null {
  const gl = useThree(state => state.gl);
  const match = (Object.entries(HERO_ASSETS) as [HeroAssetId, (typeof HERO_ASSETS)[HeroAssetId]][]).find(([, value]) => approvedHeroAsset(value)?.url === path);
  const id = match?.[0], entry = match?.[1];
  const [loaded, setLoaded] = useState<{ asset: GLTF; entry: typeof entry; renderer: typeof gl } | null>(null);
  useEffect(() => {
    if (!entry || !id) return;
    let active = true;
    let lease: ReturnType<typeof acquireHeroAsset>;
    try { lease = acquireHeroAsset(gl, id, entry); } catch { return; }
    void lease.pending.then(result => { if (active) setLoaded({ asset: result.asset, entry, renderer: gl }); }, () => { if (active) setLoaded(null); });
    return () => { active = false; lease.release(); };
  }, [entry, id, gl]);
  return loaded && loaded.entry === entry && loaded.renderer === gl ? loaded.asset : null;
}
