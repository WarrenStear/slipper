import type { StorySurface } from "../storyEvents/tactileShader.ts";
export type MapChannel = "map" | "normalMap" | "roughnessMap" | "aoMap";
export const MATERIAL_MAP_CHANNELS = ["map", "normalMap", "roughnessMap", "aoMap"] as const;
export type ReviewedMaterialMaps = {
  status: "procedural-fallback" | "reviewed-production" | "reviewed-generated";
  maxDimension: number;
  repeat: [number, number];
  channels: Partial<Record<MapChannel, string>>;
  offset?: [number, number];
  rotation?: number;
  /** Three r171: 0 uses geometry.uv; 1 uses geometry.uv1. Never invent UVs. */
  aoUvChannel?: 0 | 1;
  normalConvention?: "opengl";
  provenance?: string;
  licence?: string;
  reviewedBy?: string;
  reviewedAt?: string;
  revision?: string;
};
const fallback = (): ReviewedMaterialMaps => ({ status: "procedural-fallback", maxDimension: 1024, repeat: [1, 1], channels: {} });
/** Generated oak is admitted for construction meshes with metre-scaled UVs.
 * Source, packing and renderer-review evidence are recorded with the local asset. */
const oak = (): ReviewedMaterialMaps => ({
  status: "reviewed-generated", maxDimension: 512, repeat: [1, 1], normalConvention: "opengl",
  channels: { map: "/art/materials/oak/oak-albedo-v1.ktx2", normalMap: "/art/materials/oak/oak-normal-v1.ktx2", roughnessMap: "/art/materials/oak/oak-roughness-v1.ktx2" },
  provenance: "art-source/oak/source-record.json; OpenAI ImageGen generated material approximation, not a measured scan",
  licence: "Generated for this project through OpenAI ImageGen; no third-party texture source used.",
  reviewedBy: "Codex source and construction-surface review", reviewedAt: "2026-09-26", revision: "generated-oak-v1",
});
const bark = (): ReviewedMaterialMaps => ({
  status: "reviewed-generated", maxDimension: 512, repeat: [1, 1], normalConvention: "opengl",
  channels: { map: "/art/materials/bark/bark-albedo-v1.ktx2", normalMap: "/art/materials/bark/bark-normal-v1.ktx2", roughnessMap: "/art/materials/bark/bark-roughness-v1.ktx2" },
  provenance: "art-source/bark/source-record.json; OpenAI ImageGen generated material approximation, not a measured scan; green axis converted to OpenGL",
  licence: "Generated for this project through OpenAI ImageGen; no third-party texture source used.",
  reviewedBy: "Codex source and forest-surface review", reviewedAt: "2026-09-26", revision: "generated-bark-v1",
});
/** All remaining entries retain their existing procedural fallback. */
export const MATERIAL_MAPS: Partial<Record<StorySurface, ReviewedMaterialMaps>> = {
  "wet-wood": oak(), bark: bark(), plaster: fallback(), linen: fallback(), velvet: fallback(),
  stone: fallback(), earth: fallback(), ash: fallback(), metal: fallback(), paper: fallback(), wood: oak(),
};
const record = (value: unknown): value is Record<string, unknown> => !!value && typeof value === "object" && !Array.isArray(value);
const pair = (value: unknown, minimum: number, maximum: number) => Array.isArray(value) && value.length === 2 && value.every(v => typeof v === "number" && Number.isFinite(v) && v >= minimum && v <= maximum);
const text = (value: unknown) => typeof value === "string" && value.trim().length > 0 && value.length <= 1000;
export const isLocalMaterialMapUrl = (url: unknown): url is string => typeof url === "string" && /^\/art\/materials\/(?:[a-z0-9_-]+\/)*[a-z0-9_-]+\.ktx2$/.test(url);
export function approvedMaterialMaps(entry?: unknown): ReviewedMaterialMaps | null {
  if (!record(entry) || (entry.status !== "reviewed-production" && entry.status !== "reviewed-generated") || !Number.isInteger(entry.maxDimension) || Number(entry.maxDimension) > 1024 || Number(entry.maxDimension) < 1) return null;
  if (!pair(entry.repeat, Number.MIN_VALUE, 32) || (entry.offset !== undefined && !pair(entry.offset, -32, 32))) return null;
  if (entry.rotation !== undefined && (typeof entry.rotation !== "number" || !Number.isFinite(entry.rotation) || Math.abs(entry.rotation) > Math.PI * 2)) return null;
  if (![entry.provenance, entry.licence, entry.reviewedBy].every(text) || typeof entry.reviewedAt !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(entry.reviewedAt)) return null;
  const date = new Date(entry.reviewedAt);
  if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== entry.reviewedAt || (entry.revision !== undefined && !text(entry.revision))) return null;
  if (!record(entry.channels)) return null;
  const channels = Object.entries(entry.channels);
  if (!channels.length || channels.some(([channel, url]) => !(MATERIAL_MAP_CHANNELS as readonly string[]).includes(channel) || !isLocalMaterialMapUrl(url))) return null;
  if (entry.channels.aoMap && entry.aoUvChannel !== 0 && entry.aoUvChannel !== 1) return null;
  if (entry.aoUvChannel !== undefined && entry.aoUvChannel !== 0 && entry.aoUvChannel !== 1) return null;
  if (entry.channels.normalMap && entry.normalConvention !== "opengl") return null;
  return entry as ReviewedMaterialMaps;
}
