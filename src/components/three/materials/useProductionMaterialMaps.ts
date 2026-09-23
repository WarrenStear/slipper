import { useEffect, useState } from "react";
import { useThree } from "@react-three/fiber";
import { NoColorSpace, RepeatWrapping, SRGBColorSpace, type Texture, type WebGLRenderer } from "three";
import { KTX2Loader } from "three/examples/jsm/loaders/KTX2Loader.js";
import { BASIS_TRANSCODER_PATH } from "../../../lib/assets/gltfLoaders";
import type { StorySurface } from "../storyEvents/tactileShader";
import { approvedMaterialMaps, MATERIAL_MAPS, type MapChannel } from "./materialMapRegistry";

type MapCache = { loader: KTX2Loader; maps: Map<string, Promise<Texture>>; users: number };
const caches = new WeakMap<WebGLRenderer, MapCache>();
type Maps = Partial<Record<MapChannel, Texture>>;

/** Failed/unreviewed maps leave the procedural material intact. Mounted materials
 * own transform/color-space clones; the last consumer releases shared sources and
 * transcoder workers. No loader or fetch exists until a reviewed map is requested. */
export function useProductionMaterialMaps(surface: StorySurface, enabled: boolean) {
  const gl = useThree(s => s.gl), entry = enabled ? approvedMaterialMaps(MATERIAL_MAPS[surface]) : null;
  const [loaded, setLoaded] = useState<{ entry: typeof entry; maps: Maps } | null>(null);
  useEffect(() => {
    setLoaded(null);
    if (!entry) return;
    let active = true;
    const owned: Texture[] = [];
    let cache = caches.get(gl);
    if (!cache) {
      cache = { loader: new KTX2Loader().setTranscoderPath(BASIS_TRANSCODER_PATH).setWorkerLimit(2).detectSupport(gl), maps: new Map(), users: 0 };
      caches.set(gl, cache);
    }
    const shared = cache;
    shared.users++;
    const disposeOwned = () => { owned.forEach(t => t.dispose()); owned.length = 0; };
    Promise.all(Object.entries(entry.channels).map(async ([channel, url]) => {
      let pending = shared.maps.get(url);
      if (!pending) { pending = shared.loader.loadAsync(url); shared.maps.set(url, pending); }
      const source = await pending;
      if (source.image.width > entry.maxDimension || source.image.height > entry.maxDimension) throw new Error("Material exceeds reviewed texture budget");
      if (!active) return null;
      const texture = source.clone(); owned.push(texture);
      texture.colorSpace = channel === "map" ? SRGBColorSpace : NoColorSpace;
      texture.wrapS = texture.wrapT = RepeatWrapping;
      texture.repeat.set(...entry.repeat); texture.needsUpdate = true;
      return [channel, texture] as const;
    })).then(entries => {
      if (active) setLoaded({ entry, maps: Object.fromEntries(entries.filter(e => e !== null)) });
    }).catch(() => {
      if (active) setLoaded(null);
      // Other channels may still be loading. Stop them from creating orphan clones.
      active = false;
      disposeOwned();
    });
    return () => {
      active = false; disposeOwned(); shared.users--;
      // A StrictMode remount or another material in this commit can reuse the cache.
      queueMicrotask(() => {
        if (shared.users !== 0 || caches.get(gl) !== shared) return;
        caches.delete(gl);
        const pending = [...shared.maps.values()];
        shared.maps.clear();
        pending.forEach(p => { void p.then(texture => texture.dispose(), () => undefined); });
        // Let in-flight transcodes complete before shutting down their workers.
        void Promise.allSettled(pending).then(() => shared.loader.dispose());
      });
    };
  }, [entry, gl]);
  return loaded?.entry === entry ? loaded?.maps : undefined;
}
