import type { StorySurface } from "../storyEvents/tactileShader.ts";
export type MapChannel = "map" | "normalMap" | "roughnessMap" | "aoMap";
export type ReviewedMaterialMaps = {
  status: "procedural-fallback" | "reviewed-production";
  maxDimension: number;
  repeat: [number, number];
  channels: Partial<Record<MapChannel, string>>;
};
const fallback = (): ReviewedMaterialMaps => ({ status: "procedural-fallback", maxDimension: 1024, repeat: [1, 1], channels: {} });
/** Opt in only after licence, UV scale, color-space and on-device inspection. */
export const MATERIAL_MAPS: Partial<Record<StorySurface, ReviewedMaterialMaps>> = {
  "wet-wood": fallback(), bark: fallback(), plaster: fallback(), linen: fallback(), velvet: fallback(),
  stone: fallback(), earth: fallback(), ash: fallback(), metal: fallback(), paper: fallback(), wood: fallback(),
};
export function approvedMaterialMaps(entry?: ReviewedMaterialMaps) {
  if (!entry || entry.status !== "reviewed-production" || !Number.isFinite(entry.maxDimension) || entry.maxDimension > 1024 || entry.maxDimension < 1) return null;
  if (!entry.repeat.every(v => Number.isFinite(v) && v > 0 && v <= 32)) return null;
  const channels = Object.entries(entry.channels);
  if (!channels.length || channels.some(([channel, url]) => !["map", "normalMap", "roughnessMap", "aoMap"].includes(channel) || !/^\/art\/materials\/[a-z0-9/_-]+\.ktx2$/.test(url))) return null;
  return entry;
}
