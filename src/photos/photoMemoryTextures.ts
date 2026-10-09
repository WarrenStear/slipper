import * as THREE from 'three';
import { isLocalPhotograph } from './photoMemoryAdmission';

export const PHOTO_MEMORY_TEXTURE_BUDGET = Object.freeze({ maxBytes: 256 * 1024, maxDimension: 1280,
  maxPixels: 1280 * 1280, maxOwnedSources: 1, maxConcurrentLoads: 1 });
export type PhotoTextureResource = Readonly<{ texture: THREE.Texture; width: number; height: number; dispose: () => void }>;
export type PhotoTextureLoad = (src: string, signal: AbortSignal) => Promise<PhotoTextureResource | null>;

/** One admitted photograph per renderer. The last owner releases both GPU and decoded bitmap. */
export function createPhotoMemoryTexturePool(load: PhotoTextureLoad) {
  type Record = { src: string; refs: number; released: boolean; settled: boolean;
    abort: AbortController; resource: PhotoTextureResource | null;
    promise: Promise<PhotoTextureResource | null>; resolve: (value: PhotoTextureResource | null) => void };
  const records = new Map<string, Record>();
  let inFlight = 0;
  const valid = (resource: PhotoTextureResource) => Number.isSafeInteger(resource.width) && Number.isSafeInteger(resource.height)
    && resource.width > 0 && resource.height > 0 && resource.width <= PHOTO_MEMORY_TEXTURE_BUDGET.maxDimension
    && resource.height <= PHOTO_MEMORY_TEXTURE_BUDGET.maxDimension
    && resource.width * resource.height <= PHOTO_MEMORY_TEXTURE_BUDGET.maxPixels;
  const disposeResource = (resource: PhotoTextureResource) => { try { resource.dispose(); } catch { /* A presentation cleanup listener must not strand the bounded queue. */ } };
  const pump = () => {
    if (inFlight >= PHOTO_MEMORY_TEXTURE_BUDGET.maxConcurrentLoads) return;
    const record = [...records.values()].find(item => !item.settled && !item.released);
    if (!record) return;
    record.settled = true; inFlight++;
    Promise.resolve().then(() => load(record.src, record.abort.signal)).then(resource => {
      if (resource && (record.released || !valid(resource))) { disposeResource(resource); resource = null; }
      record.resource = resource; record.resolve(resource);
    }, () => record.resolve(null)).finally(() => { inFlight--; pump(); });
  };
  return {
    acquire(src: string) {
      let record = records.get(src);
      if (!record) {
        if (!isLocalPhotograph(src) || records.size >= PHOTO_MEMORY_TEXTURE_BUDGET.maxOwnedSources)
          return { promise: Promise.resolve(null), release() {} };
        let resolve!: Record['resolve']; const promise = new Promise<PhotoTextureResource | null>(complete => { resolve = complete; });
        record = { src, refs: 0, released: false, settled: false, abort: new AbortController(), resource: null, promise, resolve };
        records.set(src, record);
      }
      record.refs++;
      const owned = record; let released = false;
      pump();
      return { promise: owned.promise, release() {
        if (released) return; released = true; owned.refs--;
        if (owned.refs > 0) return;
        owned.released = true; owned.abort.abort(); records.delete(owned.src);
        if (owned.resource) disposeResource(owned.resource); owned.resource = null;
        if (!owned.settled) { owned.settled = true; owned.resolve(null); }
      } };
    },
    inspect() { return { ownedSources: records.size, inFlight,
      consumers: [...records.values()].reduce((sum,record) => sum + record.refs,0) }; },
  };
}

/** Network/decoding exists only behind an admitted owner. No prefetch or unbounded Drei cache. */
export async function loadPhotoMemoryTexture(src: string, signal: AbortSignal): Promise<PhotoTextureResource | null> {
  if (!isLocalPhotograph(src) || signal.aborted) return null;
  const response = await fetch(src, { signal, credentials: 'omit', mode: 'same-origin', redirect: 'error' });
  const announced = Number(response.headers.get('content-length'));
  const mime = (response.headers.get('content-type') ?? '').split(';')[0].trim().toLowerCase();
  if (!response.ok || response.redirected || Number.isFinite(announced) && announced > PHOTO_MEMORY_TEXTURE_BUDGET.maxBytes
    || !/^image\/(?:jpeg|png|webp)$/.test(mime) || typeof createImageBitmap !== 'function') {
    await response.body?.cancel().catch(() => undefined); return null;
  }
  const chunks: BlobPart[] = []; let bytes = 0;
  const reader = response.body?.getReader();
  if (!reader) return null;
  try {
    for (;;) {
      if (signal.aborted) { await reader.cancel(); return null; }
      const next = await reader.read(); if (next.done) break;
      bytes += next.value.byteLength;
      if (bytes > PHOTO_MEMORY_TEXTURE_BUDGET.maxBytes) { await reader.cancel(); return null; }
      chunks.push(new Uint8Array(next.value).buffer);
    }
  } catch (error) { await reader.cancel().catch(() => undefined); throw error; }
  finally { reader.releaseLock(); }
  if (signal.aborted || bytes === 0) return null;
  const blob = new Blob(chunks,{type:mime});
  // ImageBitmap uploads ignore UNPACK_FLIP_Y/PREMULTIPLY_ALPHA. Bake their
  // orientation/alpha choice at decode; retain Three's explicit sRGB interpretation.
  const bitmap = await createImageBitmap(blob,{imageOrientation:'flipY',premultiplyAlpha:'none',colorSpaceConversion:'none'});
  if (signal.aborted || bitmap.width <= 0 || bitmap.height <= 0
    || bitmap.width > PHOTO_MEMORY_TEXTURE_BUDGET.maxDimension || bitmap.height > PHOTO_MEMORY_TEXTURE_BUDGET.maxDimension
    || bitmap.width * bitmap.height > PHOTO_MEMORY_TEXTURE_BUDGET.maxPixels) { bitmap.close(); return null; }
  const texture = new THREE.Texture(bitmap);
  texture.flipY = false; texture.colorSpace = THREE.SRGBColorSpace; texture.wrapS = THREE.ClampToEdgeWrapping; texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.minFilter = THREE.LinearFilter; texture.magFilter = THREE.LinearFilter; texture.generateMipmaps = false; texture.needsUpdate = true;
  let disposed = false;
  return { texture, width: bitmap.width, height: bitmap.height, dispose() {
    if (disposed) return; disposed = true; texture.dispose(); bitmap.close();
  } };
}

const rendererPools = new WeakMap<object, ReturnType<typeof createPhotoMemoryTexturePool>>();
export function photoMemoryTexturePool(renderer: object) {
  let pool = rendererPools.get(renderer);
  if (!pool) { pool = createPhotoMemoryTexturePool(loadPhotoMemoryTexture); rendererPools.set(renderer,pool); }
  return pool;
}
