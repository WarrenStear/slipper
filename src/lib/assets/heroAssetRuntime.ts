import type { WebGLRenderer } from "three";
import type { GLTF } from "three/examples/jsm/loaders/GLTFLoader.js";
import { approvedHeroAsset, type HeroAsset, type HeroAssetId } from "../../components/three/actors/heroAssetRegistry.ts";
import { acquireAssetDecoders } from "./assetDecoderPool.ts";
import { disposeHeroSource, HERO_MAX_COMPRESSED_BYTES, HERO_NETWORK_TIMEOUT_MS, validateHeroGlbBytes, validateHeroPresentation, type HeroAssetMetrics } from "./heroAssetValidation.ts";

export async function fetchHeroBytes(url: string, signal: AbortSignal, request: typeof fetch = fetch) {
  const response = await request(url, { signal, credentials: "same-origin", redirect: "error" });
  if (!response.ok) throw new Error(`Hero request failed (${response.status})`);
  const declared = Number(response.headers.get("content-length"));
  if (declared > HERO_MAX_COMPRESSED_BYTES) { await response.body?.cancel(); throw new Error("Hero exceeds compressed byte budget"); }
  if (!response.body) throw new Error("Hero response has no body");
  const reader = response.body.getReader(), chunks: Uint8Array[] = [];
  let size = 0;
  const cancel = () => { void reader.cancel().catch(() => undefined); };
  signal.addEventListener("abort", cancel, { once: true });
  try {
    while (true) {
      if (signal.aborted) throw new Error("Hero request aborted");
      const part = await reader.read();
      if (signal.aborted) throw new Error("Hero request aborted");
      if (part.done) break;
      size += part.value.byteLength;
      if (size > HERO_MAX_COMPRESSED_BYTES) throw new Error("Hero exceeds compressed byte budget");
      chunks.push(part.value);
    }
    const bytes = new Uint8Array(size);
    let offset = 0;
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
    return bytes.buffer;
  } finally { signal.removeEventListener("abort", cancel); await reader.cancel().catch(() => undefined); reader.releaseLock(); }
}

type LoadedHero = { asset: GLTF; metrics: HeroAssetMetrics & { compressedBytes: number } };
type RuntimeDependencies = {
  decoders: typeof acquireAssetDecoders;
  fetchBytes: typeof fetchHeroBytes;
  dispose: typeof disposeHeroSource;
};

/** Cache entries exist only while mounted users or their pending work need them.
 * The source is shared; each consumer owns its own material/skeleton clone. */
export function createHeroAssetRuntime(dependencies: RuntimeDependencies = { decoders: acquireAssetDecoders, fetchBytes: fetchHeroBytes, dispose: disposeHeroSource }) {
  type Entry = { users: number; pending: Promise<LoadedHero>; controller: AbortController; closing: boolean };
  const renderers = new WeakMap<WebGLRenderer, Map<string, Entry>>();
  return (renderer: WebGLRenderer, id: HeroAssetId, candidate: HeroAsset) => {
    const entry = approvedHeroAsset(candidate);
    if (!entry) throw new Error("Unreviewed hero asset");
    let cache = renderers.get(renderer);
    if (!cache) { cache = new Map(); renderers.set(renderer, cache); }
    const key = JSON.stringify([id, entry.url, entry.review]);
    let shared = cache.get(key);
    if (!shared) {
      if (cache.size >= 16) throw new Error("Too many active hero assets");
      const controller = new AbortController(), decoders = dependencies.decoders(renderer);
      let decoderReleased = false;
      const releaseDecoders = () => { if (!decoderReleased) { decoderReleased = true; decoders.release(); } };
      const pending = (async () => {
        let source: GLTF | undefined;
        const timer = setTimeout(() => controller.abort(), HERO_NETWORK_TIMEOUT_MS);
        try {
          let bytes: ArrayBuffer;
          try { bytes = await dependencies.fetchBytes(entry.url, controller.signal); }
          finally { clearTimeout(timer); }
          if (controller.signal.aborted) throw new Error("Hero request aborted");
          validateHeroGlbBytes(bytes, entry.review);
          // Parse/decode is not abortable. Its lease stays alive until this settles.
          source = await decoders.gltf.parseAsync(bytes, "");
          const metrics = { ...validateHeroPresentation(source, id, entry.review), compressedBytes: bytes.byteLength };
          return { asset: source, metrics };
        } catch (error) { if (source) dependencies.dispose(source); releaseDecoders(); throw error; }
        finally { clearTimeout(timer); }
      })();
      shared = { users: 0, pending, controller, closing: false };
      cache.set(key, shared);
      // Attach a rejection handler even if a component leaves before subscribing.
      void pending.catch(() => undefined);
      const sourceEntry = shared, sourceCache = cache;
      const releaseWhenUnused = () => {
        if (sourceEntry.users || sourceEntry.closing) return;
        sourceEntry.closing = true;
        sourceEntry.controller.abort();
        // Remove before a later mount retries; pending parse keeps its decoder lease.
        if (sourceCache.get(key) === sourceEntry) sourceCache.delete(key);
        void sourceEntry.pending.then(result => dependencies.dispose(result.asset), () => undefined).finally(releaseDecoders);
      };
      // A closure on the entry keeps cleanup tied to this exact source generation.
      Object.assign(shared, { releaseWhenUnused });
    }
    const current = shared as Entry & { releaseWhenUnused: () => void };
    current.users++;
    let released = false;
    return { pending: current.pending, release() {
      if (released) return;
      released = true; current.users--;
      queueMicrotask(current.releaseWhenUnused);
    } };
  };
}

export const acquireHeroAsset = createHeroAssetRuntime();
