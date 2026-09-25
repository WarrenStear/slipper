import { NARRATIVE_AUDIO_STEM_IDS, type NarrativeAudioStemId } from "./narrativeAudioProfiles.ts";
import {
  MAX_PRODUCTION_AUDIO_BYTES, MAX_PRODUCTION_AUDIO_SAMPLES, PRODUCTION_AUDIO_LOAD_CONCURRENCY,
  PRODUCTION_AUDIO_REGISTRY, reviewedProductionAudio,
  type ProductionAudioRegistry, type ReviewedProductionAudio,
} from "./productionAudioRegistry.ts";

type CachedLoop = { signature: string; buffer: AudioBuffer };
type ProductionBank = { loops: Map<NarrativeAudioStemId, CachedLoop>; loading: number; wake: Set<() => void> };
// At most one reviewed loop per stem/context. Discarded contexts remain collectible.
const banks = new WeakMap<BaseAudioContext, ProductionBank>();
export const PRODUCTION_AUDIO_NETWORK_TIMEOUT_MS = 15_000;

/** Trim to the reviewed loop region; a tiny cosine edge makes the wrap continuous. */
export function prepareProductionAudioLoop(context: BaseAudioContext, decoded: AudioBuffer, asset: ReviewedProductionAudio) {
  if (!reviewedProductionAudio(asset) || decoded.numberOfChannels < 1 || decoded.numberOfChannels > 2 ||
      !Number.isFinite(decoded.sampleRate) || decoded.sampleRate <= 0 ||
      decoded.length * decoded.numberOfChannels > MAX_PRODUCTION_AUDIO_SAMPLES) throw new Error("Unsupported production audio buffer");
  const duration = decoded.length / decoded.sampleRate;
  const start = asset.loop.startSeconds ?? 0;
  const end = asset.loop.endSeconds ?? duration;
  if (start >= duration || end > duration || end - start < .1) throw new Error("Production audio loop region is outside the recording");
  const first = Math.floor(start * decoded.sampleRate);
  const length = Math.min(decoded.length, Math.floor(end * decoded.sampleRate)) - first;
  const buffer = context.createBuffer(decoded.numberOfChannels, length, decoded.sampleRate);
  const level = Math.pow(10, asset.nominalLevelDb / 20);
  const edge = Math.min(Math.floor((asset.loop.edgeFadeSeconds ?? .025) * decoded.sampleRate), Math.floor(length / 2));
  for (let channel = 0; channel < decoded.numberOfChannels; channel += 1) {
    const input = decoded.getChannelData(channel);
    const output = buffer.getChannelData(channel);
    for (let index = 0; index < length; index += 1) {
      const sample = input[first + index];
      if (!Number.isFinite(sample)) throw new Error("Non-finite production audio sample");
      output[index] = sample * level;
    }
    for (let index = 0; index < edge; index += 1) {
      const gain = .5 - .5 * Math.cos(Math.PI * index / edge);
      output[index] *= gain;
      output[length - 1 - index] *= gain;
    }
  }
  return buffer;
}

async function boundedAudioBytes(response: Response, signal: AbortSignal) {
  const advertised = Number(response.headers.get("content-length"));
  if (!response.ok || advertised > MAX_PRODUCTION_AUDIO_BYTES) {
    await response.body?.cancel();
    throw new Error("Production audio request failed or exceeds its delivery budget");
  }
  if (!response.body) throw new Error("Production audio response has no body");
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let length = 0;
  const cancel = () => { void reader.cancel().catch(() => {}); };
  signal.addEventListener("abort", cancel, { once: true });
  if (signal.aborted) cancel();
  try {
    while (true) {
      signal.throwIfAborted();
      const next = await reader.read();
      signal.throwIfAborted();
      if (next.done) break;
      length += next.value.byteLength;
      if (length > MAX_PRODUCTION_AUDIO_BYTES) {
        await reader.cancel();
        throw new Error("Production audio file exceeds its delivery budget");
      }
      chunks.push(next.value);
    }
  } finally {
    signal.removeEventListener("abort", cancel);
    reader.releaseLock();
  }
  const bytes = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  return bytes.buffer;
}

/** Optional files never block rendering or procedural playback. No gesture or resume ownership. */
export function createProductionAudioLoader({ context, active, ready, registry = PRODUCTION_AUDIO_REGISTRY, fetchFile = fetch }: {
  context: BaseAudioContext;
  active: () => boolean;
  ready: (id: NarrativeAudioStemId, buffer: AudioBuffer) => void;
  registry?: ProductionAudioRegistry;
  fetchFile?: typeof fetch;
}) {
  let disposed = false;
  let generation = 0;
  const queue: NarrativeAudioStemId[] = [];
  const pending = new Map<NarrativeAudioStemId, AbortController>();
  const delivered = new Set<NarrativeAudioStemId>();
  const failed = new Set<NarrativeAudioStemId>();
  const assets = new Map(NARRATIVE_AUDIO_STEM_IDS.flatMap(id => {
    const asset = reviewedProductionAudio(registry[id]);
    return asset ? [[id, { asset, signature: JSON.stringify(asset) }] as const] : [];
  }));
  let bank = banks.get(context);
  if (!bank) { bank = { loops: new Map(), loading: 0, wake: new Set() }; banks.set(context, bank); }
  const shared = bank;
  const cache = shared.loops;

  const pump = () => {
    if (disposed || !active()) return;
    while (queue.length && shared.loading < PRODUCTION_AUDIO_LOAD_CONCURRENCY) {
      const id = queue.shift()!;
      const entry = assets.get(id)!;
      const controller = new AbortController();
      const version = generation;
      pending.set(id, controller);
      shared.loading += 1;
      const valid = () => !disposed && version === generation && !controller.signal.aborted;
      void (async () => {
        for (const source of [entry.asset, ...(entry.asset.alternatives ?? [])]) {
          const attempt = new AbortController();
          const abort = () => attempt.abort();
          controller.signal.addEventListener("abort", abort, { once: true });
          if (controller.signal.aborted) abort();
          // One deadline covers headers and body for this codec, never its decode.
          const timer = setTimeout(abort, PRODUCTION_AUDIO_NETWORK_TIMEOUT_MS);
          try {
            const response = await fetchFile(source.url, { signal: attempt.signal, credentials: "same-origin" });
            if (attempt.signal.aborted) {
              await response.body?.cancel();
              attempt.signal.throwIfAborted();
            }
            if (!valid() || !active()) { await response.body?.cancel(); return; }
            const bytes = await boundedAudioBytes(response, attempt.signal);
            clearTimeout(timer);
            if (!valid() || !active()) return;
            const decoded = await context.decodeAudioData(bytes);
            // decodeAudioData cannot be aborted. A late result must create no buffer/voice.
            if (!valid() || !active()) return;
            const buffer = prepareProductionAudioLoop(context, decoded, entry.asset);
            cache.set(id, { signature: entry.signature, buffer });
            delivered.add(id);
            ready(id, buffer);
            return;
          } catch {
            if (!valid() || !active()) return;
            // Try an explicitly reviewed alternative codec; otherwise retain synthesis.
          } finally {
            clearTimeout(timer);
            controller.signal.removeEventListener("abort", abort);
          }
        }
        failed.add(id);
      })().finally(() => {
        if (pending.get(id) === controller) pending.delete(id);
        shared.loading -= 1;
        for (const wake of shared.wake) wake();
      });
    }
  };
  shared.wake.add(pump);
  const cancel = () => {
    generation += 1;
    queue.length = 0;
    for (const controller of pending.values()) controller.abort();
    // Non-abortable decodes retain a shared slot, even across StrictMode/remounts.
  };
  return {
    request(id: NarrativeAudioStemId) {
      const entry = assets.get(id);
      if (!entry || disposed || !active() || delivered.has(id) || failed.has(id) || pending.has(id) || queue.includes(id)) return;
      const cached = cache.get(id);
      if (cached?.signature === entry.signature) {
        delivered.add(id);
        ready(id, cached.buffer);
        return;
      }
      queue.push(id);
      pump();
    },
    pause: cancel,
    dispose() { if (!disposed) { disposed = true; shared.wake.delete(pump); cancel(); } },
  };
}
