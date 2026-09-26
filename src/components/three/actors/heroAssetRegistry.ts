export type HeroAssetId = "master-lantern" | "wolf" | "wolf-resting" | "swan" | "seer-reflection" | "cracked-mirror" | "moon-bridge" | "key" | "roses" | "lilies" | "writing-desk" | "reading-chair" | "fountain";
export type HeroAssetReview = {
  artist?: string;
  provenance: string;
  licence: string;
  reviewedBy: string;
  reviewedAt: string;
  revision: string;
  maxTriangles: number;
  maxMaterials: number;
  maxTextures: number;
  maxTextureDimension: number;
  /** Reviewed envelope in local metres; not an automatic rescale operation. */
  bounds: { min: [number, number, number]; max: [number, number, number] };
  /** Ground-contact assets can require a measured base; waterline assets use their reviewed envelope. */
  baseY?: { value: number; tolerance: number };
  allowSceneLights?: boolean;
};
export type HeroAsset = {
  status: "authored-fallback" | "reviewed-production";
  url: string | null;
  /** Assets must match the fallback's metres, origin and forward axis. */
  contract: string;
  review?: HeroAssetReview;
};

// Placeholder /models/*.glb files deliberately do not opt into production.
// Review silhouette, licence, textures and coordinate contract before changing status.
export const HERO_ASSETS: Record<HeroAssetId, Readonly<HeroAsset>> = {
  "master-lantern": { status: "authored-fallback", url: null, contract: "Housing only, base Y=0, handle Y=1.18, radius .29m. Core, glass, light and ownership motion remain external; carried housing scales .44 at Y=-.208." },
  wolf: { status: "authored-fallback", url: null, contract: "Feet on Y=0, forward +Z; external cue owns translation and visibility." },
  "wolf-resting": { status: "authored-fallback", url: null, contract: "Resting pose at origin; do not substitute the standing model." },
  swan: { status: "authored-fallback", url: null, contract: "Waterline Y=0, forward +Z; cue owns water displacement." },
  "seer-reflection": { status: "authored-fallback", url: null, contract: "Mirror-local apparition only; never a free-standing NPC." },
  "cracked-mirror": { status: "authored-fallback", url: null, contract: "Frame only; preserve live reflection, scar and interaction surface." },
  "moon-bridge": { status: "authored-fallback", url: null, contract: "Preserve deck elevation, width and existing physical walkway." },
  key: { status: "authored-fallback", url: null, contract: "Match current key scale and interaction origin." },
  roses: { status: "authored-fallback", url: null, contract: "Stem root at origin; retain instancing for beds." },
  lilies: { status: "authored-fallback", url: null, contract: "Waterline at origin; retain instancing for beds." },
  "writing-desk": { status: "authored-fallback", url: null, contract: "Match existing desk footprint; retain papers and selected-memory props." },
  "reading-chair": { status: "authored-fallback", url: null, contract: "Feet at origin; preserve open reading-space circulation." },
  fountain: { status: "authored-fallback", url: null, contract: "Basin geometry only; retain water, sound and chapter placement." },
};

const record = (value: unknown): value is Record<string, unknown> => !!value && typeof value === "object" && !Array.isArray(value);
const text = (value: unknown) => typeof value === "string" && value.trim().length > 0 && value.length <= 2048;
const reviewDate = (value: unknown): boolean => {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(value)) return false;
  const date = new Date(value);
  return Number.isFinite(date.getTime()) && date.toISOString() === (value.includes(".") ? value : value.replace("Z", ".000Z"));
};
const integer = (value: unknown, min: number, max: number) => Number.isInteger(value) && Number(value) >= min && Number(value) <= max;
const vector = (value: unknown): value is [number, number, number] => Array.isArray(value) && value.length === 3 && value.every(n => typeof n === "number" && Number.isFinite(n) && Math.abs(n) <= 100);

export function isLocalHeroUrl(url: unknown): url is string {
  return typeof url === "string" && !url.includes("..") && /^\/art\/heroes\/(?:[A-Za-z0-9_-]+\/)*[A-Za-z0-9_-][A-Za-z0-9_.-]*\.glb$/.test(url);
}

/** Registry admission is explicit and safe for malformed JSON/review input. */
export function approvedHeroAsset(asset: unknown): HeroAsset & { url: string; review: HeroAssetReview } | null {
  if (!record(asset) || asset.status !== "reviewed-production" || !isLocalHeroUrl(asset.url) || !text(asset.contract)) return null;
  const review = asset.review;
  if (!record(review) || ![review.provenance, review.licence, review.reviewedBy, review.revision].every(text)
    || (review.artist !== undefined && !text(review.artist))
    || !reviewDate(review.reviewedAt)
    || !integer(review.maxTriangles, 1, 200_000) || !integer(review.maxMaterials, 1, 32)
    || !integer(review.maxTextures, 0, 32) || !integer(review.maxTextureDimension, 1, 2048)
    || (review.allowSceneLights !== undefined && typeof review.allowSceneLights !== "boolean")
    || !record(review.bounds) || !vector(review.bounds.min) || !vector(review.bounds.max)) return null;
  const min = review.bounds.min, max = review.bounds.max;
  if (min.some((v, i) => max[i] <= v || max[i] - v > 100)) return null;
  if (review.baseY !== undefined && (!record(review.baseY) || typeof review.baseY.value !== "number" || !Number.isFinite(review.baseY.value)
    || Math.abs(review.baseY.value) > 100 || typeof review.baseY.tolerance !== "number" || !Number.isFinite(review.baseY.tolerance)
    || review.baseY.tolerance < 0 || review.baseY.tolerance > .1)) return null;
  return asset as unknown as HeroAsset & { url: string; review: HeroAssetReview };
}

export function productionHeroUrl(asset: unknown): string | null { return approvedHeroAsset(asset)?.url ?? null; }
