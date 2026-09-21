import {
  getMobileViewportSnapshot,
  installMobileViewportLifecycle,
} from "./hooks/useMobileViewport";
import { resetPlayerInput } from "./stores/usePlayerInputStore";

const LEGACY_MOBILE_OVERLAY_ID = "sidtw-mobile-controls";
const RENDER_QUALITY_STORAGE_KEY = "sidtw-render-quality";

function syncMobileRenderQualityDefault() {
  if (!getMobileViewportSnapshot().isMobile) return;

  const params = new URLSearchParams(window.location.search);
  if (params.has("quality")) return;
  try {
    if (window.localStorage.getItem(RENDER_QUALITY_STORAGE_KEY)) return;

    const nav = navigator as Navigator & {
      deviceMemory?: number;
      hardwareConcurrency?: number;
    };
    const memory = nav.deviceMemory ?? 4;
    const cores = nav.hardwareConcurrency ?? 4;
    const defaultQuality = memory <= 6 || cores <= 6 ? "low" : "medium";
    window.localStorage.setItem(RENDER_QUALITY_STORAGE_KEY, defaultQuality);
  } catch {
    // Storage is an enhancement; the renderer can still choose its own profile.
  }
}

function removeLegacyMobileControls() {
  document.getElementById(LEGACY_MOBILE_OVERLAY_ID)?.remove();
  document.documentElement.classList.remove(
    "sidtw-app-explore",
    "sidtw-app-read",
    "sidtw-app-map",
  );
  resetPlayerInput();
}

export function installMobileEnhancements() {
  if (typeof window === "undefined") return;

  installMobileViewportLifecycle();
  syncMobileRenderQualityDefault();
  removeLegacyMobileControls();
}

installMobileEnhancements();
