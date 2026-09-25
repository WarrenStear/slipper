import { NARRATIVE_AUDIO_STEM_IDS, type NarrativeAudioStemId } from "./narrativeAudioProfiles.ts";

export type ProductionAudioSource = { url: string; format: "mp3" | "ogg" };
export type ReviewedProductionAudio = ProductionAudioSource & {
  status: "reviewed-production";
  /** Ordered alternatives, e.g. MP3 when this browser cannot decode the Ogg export. */
  alternatives?: readonly ProductionAudioSource[];
  loop: { startSeconds?: number; endSeconds?: number; edgeFadeSeconds?: number };
  /** Attenuation relative to the existing scene mix. Production files cannot boost it. */
  nominalLevelDb: number;
  provenance: string;
  reviewedBy: string;
  reviewedAt: string;
};
export type ProductionAudioAsset = ReviewedProductionAudio | {
  status: "procedural-fallback";
  url: null;
  provenance: string;
};
export type ProductionAudioRegistry = Readonly<Record<NarrativeAudioStemId, ProductionAudioAsset>>;

/** No reviewed recordings have been supplied. Filenames alone never enable a stem. */
export const PRODUCTION_AUDIO_REGISTRY: ProductionAudioRegistry = Object.freeze(
  Object.fromEntries(NARRATIVE_AUDIO_STEM_IDS.map(id => [id, Object.freeze({
    status: "procedural-fallback" as const,
    url: null,
    provenance: "Deterministic procedural sound; no reviewed production recording supplied.",
  })])) as Record<NarrativeAudioStemId, ProductionAudioAsset>,
);

export const MAX_PRODUCTION_AUDIO_BYTES = 2 * 1024 * 1024;
export const MAX_PRODUCTION_AUDIO_SAMPLES = 2_000_000;
export const PRODUCTION_AUDIO_LOAD_CONCURRENCY = 2;

function validSource(source: ProductionAudioSource) {
  return source && (source.format === "mp3" || source.format === "ogg") &&
    typeof source.url === "string" && !source.url.includes("..") &&
    /^\/audio\/(?:[\w-]+\/)*[\w.-]+\.(mp3|ogg)$/.test(source.url) &&
    source.url.endsWith(`.${source.format}`);
}

/** Admission is checked before fetch, including when metadata comes from future tooling. */
export function reviewedProductionAudio(asset: ProductionAudioAsset | undefined): ReviewedProductionAudio | null {
  if (!asset || asset.status !== "reviewed-production" || !validSource(asset)) return null;
  if (typeof asset.provenance !== "string" || !asset.provenance.trim() ||
      typeof asset.reviewedBy !== "string" || !asset.reviewedBy.trim() ||
      typeof asset.reviewedAt !== "string" || !Number.isFinite(Date.parse(asset.reviewedAt)) ||
      !asset.loop || typeof asset.loop !== "object") return null;
  if (!Number.isFinite(asset.nominalLevelDb) || asset.nominalLevelDb < -48 || asset.nominalLevelDb > 0) return null;
  const { startSeconds = 0, endSeconds, edgeFadeSeconds = .025 } = asset.loop ?? {};
  if (!Number.isFinite(startSeconds) || startSeconds < 0 ||
      (endSeconds !== undefined && (!Number.isFinite(endSeconds) || endSeconds <= startSeconds)) ||
      !Number.isFinite(edgeFadeSeconds) || edgeFadeSeconds < .005 || edgeFadeSeconds > .1) return null;
  if (asset.alternatives && (asset.alternatives.length > 2 || !asset.alternatives.every(validSource))) return null;
  return asset;
}
