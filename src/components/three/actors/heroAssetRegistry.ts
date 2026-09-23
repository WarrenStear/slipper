export type HeroAssetId = "master-lantern" | "wolf" | "wolf-resting" | "swan" | "seer-reflection" | "cracked-mirror" | "moon-bridge" | "key" | "roses" | "lilies" | "writing-desk" | "reading-chair" | "fountain";
export type HeroAsset = {
  status: "authored-fallback" | "reviewed-production";
  url: string | null;
  /** Assets must match the fallback's metres, origin and forward axis. */
  contract: string;
};

// Placeholder /models/*.glb files deliberately do not opt into production.
// Review silhouette, licence, textures and coordinate contract before changing status.
export const HERO_ASSETS: Record<HeroAssetId, Readonly<HeroAsset>> = {
  "master-lantern": { status: "authored-fallback", url: null, contract: "Base at origin, handle up, warm core; retain external light and ownership motion." },
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

export function productionHeroUrl(asset: HeroAsset): string | null {
  return asset.status === "reviewed-production" && asset.url?.startsWith("/art/heroes/") && /\.glb$/.test(asset.url) ? asset.url : null;
}
