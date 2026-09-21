import { readBrowserStorage, writeBrowserStorage } from "../../lib/safeStorage.ts";

export type RenderQuality = "low" | "medium" | "high" | "cinematic";
export const RENDER_QUALITY_STORAGE_KEY = "sidtw-render-quality";
export const RENDER_QUALITY_EVENT = "sidtw-render-quality-change";

export function isRenderQuality(value: string | null): value is RenderQuality {
  return value === "low" || value === "medium" || value === "high" || value === "cinematic";
}

export function getStoredRenderQuality() {
  const stored = readBrowserStorage(RENDER_QUALITY_STORAGE_KEY);
  return isRenderQuality(stored) ? stored : null;
}

export function persistRenderQuality(quality: RenderQuality) {
  return isRenderQuality(quality) && writeBrowserStorage(RENDER_QUALITY_STORAGE_KEY, quality);
}

/** The current tab still responds when persistence is denied or full. */
export function setPreferredRenderQuality(quality: RenderQuality) {
  if (typeof window === "undefined" || !isRenderQuality(quality)) return;
  persistRenderQuality(quality);
  window.dispatchEvent(new CustomEvent(RENDER_QUALITY_EVENT, { detail: { quality } }));
}

function hardwareHint(name: "deviceMemory" | "hardwareConcurrency") {
  try {
    const nav = typeof navigator === "undefined" ? null : navigator as Navigator & { deviceMemory?: number };
    const value = nav?.[name];
    return typeof value === "number" && Number.isFinite(value) && value > 0 ? value : 8;
  } catch { return 8; }
}

export function resolveInitialRenderQuality(): RenderQuality {
  if (typeof window !== "undefined") {
    const query = new URLSearchParams(window.location.search).get("quality");
    if (isRenderQuality(query)) return query;
    const stored = getStoredRenderQuality();
    if (stored) return stored;
  }
  const memory = hardwareHint("deviceMemory"), cores = hardwareHint("hardwareConcurrency");
  if (memory <= 4 || cores <= 4) return "low";
  if (memory <= 12 || cores <= 8) return "medium";
  return "high";
}

export function normalizeDevicePixelRatio(value: number | undefined): number {
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? value : 1;
}
