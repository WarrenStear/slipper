import { NoColorSpace, RepeatWrapping, SRGBColorSpace, type BufferGeometry, type MeshStandardMaterial, type Texture } from "three";
import { approvedMaterialMaps, isLocalMaterialMapUrl, MATERIAL_MAP_CHANNELS, type MapChannel, type ReviewedMaterialMaps } from "./materialMapRegistry.ts";

export type MaterialMaps = Partial<Record<MapChannel, Texture | null>>;
type DecoderLease = { ktx2: { loadAsync(url: string): Promise<Texture> }; release(): void };
export const MAX_MATERIAL_SOURCE_MAPS = 44; // Eleven reviewed surface slots, at most four channels each.
export const MAX_MATERIAL_COMPRESSED_BYTES = 8 * 1024 * 1024;
export const MATERIAL_NETWORK_TIMEOUT_MS = 15_000;

/** Reject large/array/cube containers before invoking a transcoder. The decoder
 * still validates the complete KTX2 structure; decoded dimensions are checked too. */
export function validateMaterialKtx2Bytes(bytes: ArrayBuffer) {
  const signature = [0xab, 0x4b, 0x54, 0x58, 0x20, 0x32, 0x30, 0xbb, 0x0d, 0x0a, 0x1a, 0x0a];
  if (bytes.byteLength < 80 || bytes.byteLength > MAX_MATERIAL_COMPRESSED_BYTES || !signature.every((value, index) => new Uint8Array(bytes)[index] === value)) throw new Error("Invalid material KTX2 file or size");
  const view = new DataView(bytes), width = view.getUint32(20, true), height = view.getUint32(24, true), levels = view.getUint32(40, true);
  if (!width || !height || width > 1024 || height > 1024 || view.getUint32(28, true) !== 0 || view.getUint32(32, true) !== 0 || view.getUint32(36, true) !== 1 || !levels || levels > Math.floor(Math.log2(Math.max(width, height))) + 1) throw new Error("Material KTX2 must be a bounded 2D image");
}

/** FileLoader follows redirects. Fetch explicitly rejects them and caps the
 * streaming body before KTX2.parse, without owning a second decoder pool. */
export async function loadMaterialTexture(
  url: string,
  decoder: { parse(bytes: ArrayBuffer, onLoad: (texture: Texture) => void, onError: (error: unknown) => void): unknown },
  fetcher: typeof fetch = fetch,
) {
  if (!isLocalMaterialMapUrl(url)) throw new Error("Non-local material map URL");
  const controller = new AbortController(), timer = setTimeout(() => controller.abort(), MATERIAL_NETWORK_TIMEOUT_MS);
  let bytes: ArrayBuffer;
  try {
    const response = await fetcher(url, { signal: controller.signal, mode: "same-origin", credentials: "omit", redirect: "error" });
    if (!response.ok || response.redirected || Number(response.headers.get("content-length")) > MAX_MATERIAL_COMPRESSED_BYTES) {
      await response.body?.cancel().catch(() => undefined);
      throw new Error("Material texture response rejected");
    }
    const reader = response.body?.getReader();
    if (!reader) throw new Error("Missing material texture body");
    const chunks: Uint8Array[] = []; let length = 0;
    try {
      while (true) {
        const chunk = await reader.read(); if (chunk.done) break;
        length += chunk.value.byteLength;
        if (length > MAX_MATERIAL_COMPRESSED_BYTES) throw new Error("Material texture byte budget exceeded");
        chunks.push(chunk.value);
      }
    } catch (error) { await reader.cancel().catch(() => undefined); throw error; }
    finally { reader.releaseLock(); }
    const joined = new Uint8Array(length); let offset = 0;
    for (const chunk of chunks) { joined.set(chunk, offset); offset += chunk.byteLength; }
    bytes = joined.buffer;
  } finally { clearTimeout(timer); }
  validateMaterialKtx2Bytes(bytes);
  return new Promise<Texture>((resolve, reject) => { decoder.parse(bytes, resolve, reject); });
}

/** Pending zero-user caches remain reusable: remounts cannot overlap decoder pools. */
export function createMaterialMapCache<Renderer extends object>(acquireDecoders: (renderer: Renderer) => DecoderLease) {
  type Cache = { decoder: DecoderLease; users: number; pending: number; sources: Map<string, Promise<Texture>>; textures: Set<Texture> };
  const caches = new WeakMap<Renderer, Cache>();
  return (renderer: Renderer) => {
    let cache = caches.get(renderer);
    if (!cache) {
      cache = { decoder: acquireDecoders(renderer), users: 0, pending: 0, sources: new Map(), textures: new Set() };
      caches.set(renderer, cache);
    }
    const shared = cache;
    shared.users++;
    let released = false;
    const retire = () => queueMicrotask(() => {
      if (shared.users || shared.pending || caches.get(renderer) !== shared) return;
      caches.delete(renderer);
      shared.textures.forEach(texture => texture.dispose());
      shared.textures.clear(); shared.sources.clear(); shared.decoder.release();
    });
    return {
      load(url: string) {
        if (released) return Promise.reject(new Error("Material map lease was released"));
        const existing = shared.sources.get(url);
        if (existing) return existing;
        if (shared.sources.size >= MAX_MATERIAL_SOURCE_MAPS) return Promise.reject(new Error("Material source cache budget exceeded"));
        shared.pending++;
        const pending = Promise.resolve().then(() => shared.decoder.ktx2.loadAsync(url)).then(texture => {
          shared.textures.add(texture);
          return texture;
        }).finally(() => { shared.pending--; retire(); });
        shared.sources.set(url, pending);
        return pending;
      },
      release() { if (!released) { released = true; shared.users--; retire(); } },
    };
  };
}

/** An owned sampler view; this does not approve an asset or mutate its source.
 * Reviewed delivery validates metadata/dimensions first; explicit external art
 * auditions can share the sampler policy while retaining unreviewed provenance. */
export function cloneMaterialMapSampler(
  source: Texture,
  channel: MapChannel,
  metadata: Pick<ReviewedMaterialMaps, "repeat" | "offset" | "rotation" | "aoUvChannel">,
): Texture {
  const texture = source.clone();
  try {
    texture.colorSpace = channel === "map" ? SRGBColorSpace : NoColorSpace;
    texture.channel = channel === "aoMap" ? metadata.aoUvChannel! : 0;
    texture.wrapS = texture.wrapT = RepeatWrapping;
    texture.repeat.set(...metadata.repeat); texture.offset.set(...(metadata.offset ?? [0, 0]));
    texture.center.set(.5, .5); texture.rotation = metadata.rotation ?? 0;
    texture.flipY = false; texture.updateMatrix(); texture.needsUpdate = true;
    return texture;
  } catch (error) { texture.dispose(); throw error; }
}

/** Validate decoded dimensions before cloning. Source transforms remain intact. */
export function cloneReviewedMaterialMaps(sources: MaterialMaps, entry: ReviewedMaterialMaps): MaterialMaps {
  if (!approvedMaterialMaps(entry)) throw new Error("Unreviewed material maps");
  const channels = Object.keys(entry.channels) as MapChannel[];
  for (const channel of channels) {
    const source = sources[channel], image = source?.image;
    if (!source?.isTexture || !image || !Number.isInteger(image.width) || !Number.isInteger(image.height) || image.width < 1 || image.height < 1 || image.width > entry.maxDimension || image.height > entry.maxDimension) throw new Error("Material exceeds reviewed texture budget or has invalid dimensions");
  }
  const maps: MaterialMaps = {};
  try {
    for (const channel of channels) {
      maps[channel] = cloneMaterialMapSampler(sources[channel]!, channel, entry);
    }
    return maps;
  } catch (error) { disposeMaterialMaps(maps); throw error; }
}

export function disposeMaterialMaps(maps?: MaterialMaps) {
  if (maps) Object.values(maps).forEach(texture => texture?.dispose());
}

/** A late decode cannot publish maps or create clones after unmount/tier change. */
export function requestReviewedMaterialMaps(
  candidate: unknown,
  acquire: () => { load(url: string): Promise<Texture>; release(): void },
  onReady: (maps: MaterialMaps) => void,
  onFailure: () => void = () => undefined,
) {
  const entry = approvedMaterialMaps(candidate);
  let active = true, released = false, owned: MaterialMaps | undefined;
  let lease: ReturnType<typeof acquire>;
  if (!entry) return { settled: Promise.resolve(), dispose() {} };
  try { lease = acquire(); } catch { onFailure(); return { settled: Promise.resolve(), dispose() {} }; }
  const release = () => { if (!released) { released = true; lease.release(); } };
  const channels = Object.entries(entry.channels) as [MapChannel, string][];
  const settled = Promise.all(channels.map(async ([channel, url]) => [channel, await lease.load(url)] as const)).then(sources => {
    if (!active) return;
    owned = cloneReviewedMaterialMaps(Object.fromEntries(sources), entry);
    onReady(owned);
  }).catch(() => {
    disposeMaterialMaps(owned); owned = undefined;
    // The fallback may remain mounted for the whole chapter. Cache pending-work
    // ownership, not a failed consumer, keeps sibling transcodes alive safely.
    release();
    if (active) onFailure();
  });
  return { settled, dispose() { if (active) { active = false; disposeMaterialMaps(owned); release(); } } };
}

function usableUv(geometry: BufferGeometry, channel: number) {
  const position = geometry.getAttribute("position"), uv = geometry.getAttribute(channel === 0 ? "uv" : "uv1");
  if (!position || !uv || uv.itemSize !== 2 || uv.count !== position.count || uv.count < 3) return false;
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (let index = 0; index < uv.count; index++) {
    const x = uv.getX(index), y = uv.getY(index);
    if (!Number.isFinite(x) || !Number.isFinite(y)) return false;
    minX = Math.min(minX, x); maxX = Math.max(maxX, x); minY = Math.min(minY, y); maxY = Math.max(maxY, y);
  }
  return maxX > minX && maxY > minY;
}

/** Three calls this before program selection. No UV creation or story mutation;
 * checks are cached by attribute identity and mutation version, not material name. */
export function createMaterialMapGuard(maps?: MaterialMaps): MeshStandardMaterial["onBeforeRender"] {
  if (!maps) return function (this: MeshStandardMaterial) {
    if (this.map || this.normalMap || this.roughnessMap || this.aoMap) {
      this.map = this.normalMap = this.roughnessMap = this.aoMap = null; this.needsUpdate = true;
    }
  };
  type Attribute = ReturnType<BufferGeometry["getAttribute"]>;
  const version = (attribute?: Attribute) => attribute && ("version" in attribute ? attribute.version : attribute.data.version);
  const checked = new WeakMap<BufferGeometry, { position: Attribute; uv: Attribute; uv1: Attribute; version0: number | undefined; version1: number | undefined; count: number; valid0: boolean; valid1: boolean }>();
  return function (this: MeshStandardMaterial, _renderer, _scene, _camera, geometry) {
    const position = geometry.getAttribute("position"), uv = geometry.getAttribute("uv"), uv1 = geometry.getAttribute("uv1");
    let result = checked.get(geometry);
    if (!result || result.position !== position || result.uv !== uv || result.uv1 !== uv1 || result.version0 !== version(uv) || result.version1 !== version(uv1) || result.count !== position?.count) {
      result = { position, uv, uv1, version0: version(uv), version1: version(uv1), count: position?.count, valid0: !!maps && usableUv(geometry, 0), valid1: !!maps && usableUv(geometry, 1) };
      checked.set(geometry, result);
    }
    for (const channel of MATERIAL_MAP_CHANNELS) {
      const texture = maps?.[channel];
      const valid = texture && (texture.channel === 0 ? result.valid0 : channel === "aoMap" && texture.channel === 1 && result.valid1);
      const next = valid ? texture : null;
      if (this[channel] !== next) { this[channel] = next; this.needsUpdate = true; }
    }
  };
}
