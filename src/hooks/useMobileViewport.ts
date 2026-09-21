import { useSyncExternalStore } from "react";
import {
  isPortraitViewport,
  MOBILE_INPUT_RESET_EVENT,
} from "../lib/mobileControls";
import { resetPlayerInput } from "../stores/usePlayerInputStore";

export type MobileViewportState = {
  isMobile: boolean;
  isCoarsePointer: boolean;
  isPortrait: boolean;
};

const SERVER_VIEWPORT_STATE: MobileViewportState = {
  isMobile: false,
  isCoarsePointer: false,
  isPortrait: false,
};

let viewportState = SERVER_VIEWPORT_STATE;
let lifecycleInstalled = false;
let lifecycleCleanup: (() => void) | null = null;
const listeners = new Set<() => void>();

function viewportDimensions() {
  const viewport = window.visualViewport;
  const innerWidth = Math.max(1, Math.round(window.innerWidth));
  const innerHeight = Math.max(1, Math.round(window.innerHeight));
  if (!viewport) {
    return { width: innerWidth, height: innerHeight };
  }

  const visualWidth = Math.max(1, Math.round(viewport.width));
  const visualHeight = Math.max(1, Math.round(viewport.height));
  const visualIsPortrait = visualWidth <= visualHeight;
  const innerIsPortrait = innerWidth <= innerHeight;

  // During orientation changes some mobile engines publish the window resize
  // before VisualViewport catches up. Do not retain a stale orientation for
  // that frame; a later VisualViewport event will refine the browser-chrome
  // dimensions once both APIs agree again.
  if (visualIsPortrait !== innerIsPortrait) {
    return { width: innerWidth, height: innerHeight };
  }

  return {
    width: visualWidth,
    height: visualHeight,
  };
}

function readViewportState(width: number, height: number): MobileViewportState {
  const isCoarsePointer =
    window.matchMedia?.("(pointer: coarse)").matches === true ||
    navigator.maxTouchPoints > 0;

  return {
    isMobile: isCoarsePointer || width <= 860,
    isCoarsePointer,
    isPortrait: isPortraitViewport(width, height),
  };
}

function statesMatch(a: MobileViewportState, b: MobileViewportState) {
  return (
    a.isMobile === b.isMobile &&
    a.isCoarsePointer === b.isCoarsePointer &&
    a.isPortrait === b.isPortrait
  );
}

function publishViewport() {
  const { width, height } = viewportDimensions();
  const next = readViewportState(width, height);
  const root = document.documentElement;

  root.style.setProperty("--app-height", `${height}px`);
  root.style.setProperty("--app-width", `${width}px`);
  root.style.setProperty("--sidtw-vh", `${height * 0.01}px`);
  root.dataset.mobile = next.isMobile ? "true" : "false";
  root.dataset.orientation = next.isPortrait ? "portrait" : "landscape";
  root.classList.toggle("sidtw-touch-device", next.isMobile);

  if (statesMatch(viewportState, next)) return;
  viewportState = next;
  for (const listener of listeners) listener();
}

export function resetMobileInput() {
  resetPlayerInput();
  window.dispatchEvent(new Event(MOBILE_INPUT_RESET_EVENT));
}

export function getMobileViewportSnapshot() {
  return viewportState;
}

export function installMobileViewportLifecycle() {
  if (typeof window === "undefined" || lifecycleInstalled) return lifecycleCleanup;

  lifecycleInstalled = true;
  publishViewport();

  const handleViewportChange = () => {
    resetMobileInput();
    publishViewport();
  };
  const handleVisibilityChange = () => {
    if (document.visibilityState !== "visible") resetMobileInput();
    publishViewport();
  };

  window.addEventListener("resize", handleViewportChange, { passive: true });
  window.addEventListener("orientationchange", handleViewportChange, { passive: true });
  window.addEventListener("blur", resetMobileInput);
  window.addEventListener("pagehide", resetMobileInput);
  document.addEventListener("visibilitychange", handleVisibilityChange);
  window.visualViewport?.addEventListener("resize", handleViewportChange, {
    passive: true,
  });
  window.visualViewport?.addEventListener("scroll", handleViewportChange, {
    passive: true,
  });

  lifecycleCleanup = () => {
    resetMobileInput();
    window.removeEventListener("resize", handleViewportChange);
    window.removeEventListener("orientationchange", handleViewportChange);
    window.removeEventListener("blur", resetMobileInput);
    window.removeEventListener("pagehide", resetMobileInput);
    document.removeEventListener("visibilitychange", handleVisibilityChange);
    window.visualViewport?.removeEventListener("resize", handleViewportChange);
    window.visualViewport?.removeEventListener("scroll", handleViewportChange);
    lifecycleInstalled = false;
    lifecycleCleanup = null;
  };

  return lifecycleCleanup;
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  installMobileViewportLifecycle();
  return () => listeners.delete(listener);
}

export function useMobileViewport() {
  return useSyncExternalStore(
    subscribe,
    getMobileViewportSnapshot,
    () => SERVER_VIEWPORT_STATE,
  );
}
