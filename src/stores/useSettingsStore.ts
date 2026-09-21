import { create } from "zustand";
import {
  isRenderQuality,
  RENDER_QUALITY_EVENT,
  RENDER_QUALITY_STORAGE_KEY,
  resolveInitialRenderQuality,
  setPreferredRenderQuality,
  type RenderQuality,
} from "../components/three/renderQuality.ts";

export type ReaderTheme = "ambient" | "clean";
export type MobileControlMode = "direct" | "guided";
export type MobileControlSide = "left" | "right";

export type ExperienceSettings = {
  performanceProfile: RenderQuality;
  reducedMotion: boolean;
  reducedEffects: boolean;
  assistedStillness: boolean;
  cameraAssistance: boolean;
  highContrast: boolean;
  textScale: number;
  readerTheme: ReaderTheme;
  audioEnabled: boolean;
  audioVolume: number;
  showMiniMap: boolean;
  showCompass: boolean;
  showContextualGuidance: boolean;
  mobileControlMode: MobileControlMode;
  mobileControlSide: MobileControlSide;
  mobileLookSensitivity: number;
  mobileHaptics: boolean;
  onboardingComplete: boolean;
};

export type SettingsStore = ExperienceSettings & {
  drawerOpen: boolean;
  setSetting: <Key extends keyof ExperienceSettings>(key: Key, value: ExperienceSettings[Key]) => void;
  updateSettings: (settings: Partial<ExperienceSettings>) => void;
  resetSettings: () => void;
  setDrawerOpen: (open: boolean) => void;
};

type StoredSettingsEnvelope = {
  state?: Partial<ExperienceSettings> & Record<string, unknown>;
  version?: number;
};

type SettingsInput = Partial<ExperienceSettings> & {
  renderQuality?: unknown;
  explorationMode?: unknown;
  controlHandedness?: unknown;
  lookSensitivity?: unknown;
  hapticsEnabled?: unknown;
};

export const EXPERIENCE_SETTINGS_STORAGE_KEY = "sidtw:settings:v2";
export const EXPERIENCE_SETTINGS_CHANGED_EVENT = "sidtw:experience-settings-change";
export const EXPERIENCE_SETTINGS_OPEN_REQUEST_EVENT = "sidtw:experience-settings-open-request";
export const EXPERIENCE_SETTINGS_VISIBILITY_EVENT = "sidtw:experience-settings-visibility";

export const AUDIO_ENABLED_STORAGE_KEY = "sidtw:audio-enabled:v1";
export const AUDIO_ENABLED_EVENT = "sidtw-audio-enabled-change";
export const REDUCED_MOTION_STORAGE_KEY = "sidtw:reduced-motion:v1";
export const REDUCED_MOTION_EVENT = "sidtw-reduced-motion-change";
export const ONBOARDING_COMPLETE_STORAGE_KEY = "sidtw:onboarding-complete:v1";

const SETTINGS_STORAGE_VERSION = 5;
const MIN_LOOK_SENSITIVITY = 0.5;
const MAX_LOOK_SENSITIVITY = 1.6;

function mediaPreference(query: string) {
  return typeof window !== "undefined" && typeof window.matchMedia === "function" && window.matchMedia(query).matches;
}

function clamp(value: number, min: number, max: number, fallback: number) {
  return Math.max(min, Math.min(max, Number.isFinite(value) ? value : fallback));
}

function safeStorageGet(key: string) {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function safeStorageSet(key: string, value: string) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // Settings remain available in memory when storage is unavailable or full.
  }
}

function storedBoolean(key: string) {
  const value = safeStorageGet(key);
  if (value === "true") return true;
  if (value === "false") return false;
  return undefined;
}

function resolveSafeDefaultQuality(): RenderQuality {
  if (typeof navigator === "undefined") return "medium";
  const nav = navigator as Navigator & { deviceMemory?: number; hardwareConcurrency?: number };
  const memory = nav.deviceMemory ?? 8;
  const cores = nav.hardwareConcurrency ?? 8;
  return memory <= 4 || cores <= 4 ? "low" : "medium";
}

function resolveStoredOrInitialQuality(): RenderQuality {
  const storedQuality = safeStorageGet(RENDER_QUALITY_STORAGE_KEY);
  if (isRenderQuality(storedQuality)) return storedQuality;
  try {
    return resolveInitialRenderQuality();
  } catch {
    return resolveSafeDefaultQuality();
  }
}

export function createDefaultSettings(options: { preserveOnboarding?: boolean; useStoredQuality?: boolean } = {}): ExperienceSettings {
  const reducedMotion = mediaPreference("(prefers-reduced-motion: reduce)");
  const onboardingComplete = options.preserveOnboarding
    ? storedBoolean(ONBOARDING_COMPLETE_STORAGE_KEY) ?? false
    : false;

  return {
    performanceProfile: options.useStoredQuality
      ? resolveStoredOrInitialQuality()
      : resolveSafeDefaultQuality(),
    reducedMotion,
    reducedEffects: reducedMotion,
    assistedStillness: false,
    cameraAssistance: true,
    highContrast: mediaPreference("(prefers-contrast: more)"),
    textScale: 1,
    readerTheme: "ambient",
    // The soundscape is ready by default, but cannot start until the visitor's
    // explicit Begin gesture mounts the world and satisfies browser audio policy.
    audioEnabled: true,
    audioVolume: 0.65,
    showMiniMap: false,
    showCompass: false,
    showContextualGuidance: false,
    mobileControlMode: "direct",
    mobileControlSide: "left",
    mobileLookSensitivity: 1,
    mobileHaptics: false,
    onboardingComplete,
  };
}

function sanitizeSettings(input: SettingsInput | null | undefined, defaults: ExperienceSettings): ExperienceSettings {
  const requestedPerformanceProfile = input?.performanceProfile;
  const migratedRenderQuality = input?.renderQuality;
  let performanceProfile: RenderQuality = defaults.performanceProfile;
  if (typeof requestedPerformanceProfile === "string" && isRenderQuality(requestedPerformanceProfile)) {
    performanceProfile = requestedPerformanceProfile;
  } else if (typeof migratedRenderQuality === "string" && isRenderQuality(migratedRenderQuality)) {
    performanceProfile = migratedRenderQuality;
  }
  const reducedMotion = typeof input?.reducedMotion === "boolean" ? input.reducedMotion : defaults.reducedMotion;
  const reducedEffects = typeof input?.reducedEffects === "boolean" ? input.reducedEffects : defaults.reducedEffects;
  const mobileControlMode = input?.mobileControlMode ?? input?.explorationMode;
  const mobileControlSide = input?.mobileControlSide ?? input?.controlHandedness;
  const mobileLookSensitivity = input?.mobileLookSensitivity ?? input?.lookSensitivity;
  const requestedHaptics = input?.mobileHaptics ?? input?.hapticsEnabled;

  return {
    performanceProfile,
    reducedMotion,
    reducedEffects,
    assistedStillness:
      typeof input?.assistedStillness === "boolean"
        ? input.assistedStillness
        : defaults.assistedStillness,
    cameraAssistance: typeof input?.cameraAssistance === "boolean" ? input.cameraAssistance : defaults.cameraAssistance,
    highContrast: typeof input?.highContrast === "boolean" ? input.highContrast : defaults.highContrast,
    textScale: clamp(typeof input?.textScale === "number" ? input.textScale : defaults.textScale, 0.9, 1.35, defaults.textScale),
    readerTheme: input?.readerTheme === "clean" || input?.readerTheme === "ambient" ? input.readerTheme : defaults.readerTheme,
    audioEnabled: typeof input?.audioEnabled === "boolean" ? input.audioEnabled : defaults.audioEnabled,
    audioVolume: clamp(typeof input?.audioVolume === "number" ? input.audioVolume : defaults.audioVolume, 0, 1, defaults.audioVolume),
    showMiniMap: typeof input?.showMiniMap === "boolean" ? input.showMiniMap : defaults.showMiniMap,
    showCompass: typeof input?.showCompass === "boolean" ? input.showCompass : defaults.showCompass,
    showContextualGuidance:
      typeof input?.showContextualGuidance === "boolean" ? input.showContextualGuidance : defaults.showContextualGuidance,
    mobileControlMode: mobileControlMode === "guided" || mobileControlMode === "direct" ? mobileControlMode : defaults.mobileControlMode,
    mobileControlSide: mobileControlSide === "right" || mobileControlSide === "left" ? mobileControlSide : defaults.mobileControlSide,
    mobileLookSensitivity: clamp(
      typeof mobileLookSensitivity === "number" ? mobileLookSensitivity : defaults.mobileLookSensitivity,
      MIN_LOOK_SENSITIVITY,
      MAX_LOOK_SENSITIVITY,
      defaults.mobileLookSensitivity,
    ),
    mobileHaptics: reducedEffects
      ? false
      : typeof requestedHaptics === "boolean"
        ? requestedHaptics
        : defaults.mobileHaptics,
    onboardingComplete:
      typeof input?.onboardingComplete === "boolean" ? input.onboardingComplete : defaults.onboardingComplete,
  };
}

function readUnifiedSettings(): SettingsInput | null {
  const raw = safeStorageGet(EXPERIENCE_SETTINGS_STORAGE_KEY);
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as StoredSettingsEnvelope | SettingsInput;
    if (parsed && typeof parsed === "object" && "state" in parsed) {
      return (parsed as StoredSettingsEnvelope).state ?? null;
    }
    return parsed as SettingsInput;
  } catch {
    return null;
  }
}

function readInitialSettings() {
  const defaults = createDefaultSettings({ preserveOnboarding: true, useStoredQuality: true });
  const unified = readUnifiedSettings();
  const legacyQuality = safeStorageGet(RENDER_QUALITY_STORAGE_KEY);
  const migratedLegacy: SettingsInput = {
    performanceProfile: isRenderQuality(legacyQuality) ? legacyQuality : defaults.performanceProfile,
    audioEnabled: storedBoolean(AUDIO_ENABLED_STORAGE_KEY) ?? defaults.audioEnabled,
    reducedMotion: storedBoolean(REDUCED_MOTION_STORAGE_KEY) ?? defaults.reducedMotion,
    onboardingComplete: storedBoolean(ONBOARDING_COMPLETE_STORAGE_KEY) ?? defaults.onboardingComplete,
  };

  return sanitizeSettings({ ...migratedLegacy, ...unified }, defaults);
}

function settingsFromState(state: SettingsStore): ExperienceSettings {
  return {
    performanceProfile: state.performanceProfile,
    reducedMotion: state.reducedMotion,
    reducedEffects: state.reducedEffects,
    assistedStillness: state.assistedStillness,
    cameraAssistance: state.cameraAssistance,
    highContrast: state.highContrast,
    textScale: state.textScale,
    readerTheme: state.readerTheme,
    audioEnabled: state.audioEnabled,
    audioVolume: state.audioVolume,
    showMiniMap: state.showMiniMap,
    showCompass: state.showCompass,
    showContextualGuidance: state.showContextualGuidance,
    mobileControlMode: state.mobileControlMode,
    mobileControlSide: state.mobileControlSide,
    mobileLookSensitivity: state.mobileLookSensitivity,
    mobileHaptics: state.mobileHaptics,
    onboardingComplete: state.onboardingComplete,
  };
}

export function applyExperiencePreferenceClasses(settings: ExperienceSettings) {
  if (typeof document === "undefined") return;
  document.documentElement.classList.toggle("sidtw-reduced-motion", settings.reducedMotion);
  document.documentElement.classList.toggle("sidtw-reduced-effects", settings.reducedEffects);
  document.documentElement.classList.toggle("sidtw-high-contrast", settings.highContrast);
}

function persistSettings(settings: ExperienceSettings, previous?: ExperienceSettings) {
  safeStorageSet(
    EXPERIENCE_SETTINGS_STORAGE_KEY,
    JSON.stringify({ state: settings, version: SETTINGS_STORAGE_VERSION }),
  );

  // These keys are compatibility mirrors for existing render, audio, and
  // onboarding consumers. The unified settings record above is authoritative.
  safeStorageSet(AUDIO_ENABLED_STORAGE_KEY, settings.audioEnabled ? "true" : "false");
  safeStorageSet(REDUCED_MOTION_STORAGE_KEY, settings.reducedMotion ? "true" : "false");
  safeStorageSet(ONBOARDING_COMPLETE_STORAGE_KEY, settings.onboardingComplete ? "true" : "false");

  if (typeof window !== "undefined") {
    if (!previous || previous.performanceProfile !== settings.performanceProfile) {
      try {
        setPreferredRenderQuality(settings.performanceProfile);
      } catch {
        safeStorageSet(RENDER_QUALITY_STORAGE_KEY, settings.performanceProfile);
      }
    } else {
      safeStorageSet(RENDER_QUALITY_STORAGE_KEY, settings.performanceProfile);
    }

    if (!previous || previous.audioEnabled !== settings.audioEnabled) {
      window.dispatchEvent(new CustomEvent(AUDIO_ENABLED_EVENT, { detail: { enabled: settings.audioEnabled } }));
    }
    if (!previous || previous.reducedMotion !== settings.reducedMotion) {
      window.dispatchEvent(new CustomEvent(REDUCED_MOTION_EVENT, { detail: { enabled: settings.reducedMotion } }));
    }
    window.dispatchEvent(new CustomEvent(EXPERIENCE_SETTINGS_CHANGED_EVENT, { detail: { settings } }));
  }

  applyExperiencePreferenceClasses(settings);
}

const initialSettings = readInitialSettings();

export const useSettingsStore = create<SettingsStore>((set, get) => {
  const commit = (partial: Partial<ExperienceSettings>) => {
    const previous = settingsFromState(get());
    const next = sanitizeSettings({ ...previous, ...partial }, previous);
    set(next);
    persistSettings(next, previous);
  };

  return {
    ...initialSettings,
    drawerOpen: false,
    setSetting: (key, value) => commit({ [key]: value } as Partial<ExperienceSettings>),
    updateSettings: (settings) => commit(settings),
    resetSettings: () => {
      const previous = settingsFromState(get());
      const next = createDefaultSettings();
      next.onboardingComplete = previous.onboardingComplete;
      set(next);
      persistSettings(next, previous);
    },
    setDrawerOpen: (drawerOpen) => {
      if (get().drawerOpen === drawerOpen) return;
      set({ drawerOpen });
      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent(EXPERIENCE_SETTINGS_VISIBILITY_EVENT, { detail: { open: drawerOpen } }));
      }
    },
  };
});

persistSettings(initialSettings);

export function getExperienceSettingsSnapshot() {
  return settingsFromState(useSettingsStore.getState());
}

export function updateExperienceSettings(settings: Partial<ExperienceSettings>) {
  useSettingsStore.getState().updateSettings(settings);
  return getExperienceSettingsSnapshot();
}

export function resetExperienceSettings() {
  useSettingsStore.getState().resetSettings();
  return getExperienceSettingsSnapshot();
}

export function synchronizeExperienceSettingsFromStorage() {
  const previous = getExperienceSettingsSnapshot();
  const next = readInitialSettings();
  if (JSON.stringify(previous) === JSON.stringify(next)) return previous;
  useSettingsStore.setState(next);
  applyExperiencePreferenceClasses(next);
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(EXPERIENCE_SETTINGS_CHANGED_EVENT, { detail: { settings: next } }));
  }
  return next;
}

export function openExperienceSettings() {
  useSettingsStore.getState().setDrawerOpen(true);
}

export function closeExperienceSettings() {
  useSettingsStore.getState().setDrawerOpen(false);
}

export function requestExperienceSettingsOpen() {
  openExperienceSettings();
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(EXPERIENCE_SETTINGS_OPEN_REQUEST_EVENT));
  }
}

export function isExperienceSettingsOpen() {
  return useSettingsStore.getState().drawerOpen;
}

export function syncRenderQualityPreference(value: unknown) {
  if (typeof value === "string" && isRenderQuality(value) && useSettingsStore.getState().performanceProfile !== value) {
    useSettingsStore.getState().setSetting("performanceProfile", value);
  }
}

export const selectSettingsDrawerOpen = (state: SettingsStore) => state.drawerOpen;
export const selectPerformanceProfile = (state: SettingsStore) => state.performanceProfile;
export const selectReducedMotion = (state: SettingsStore) => state.reducedMotion;
export const selectReducedEffects = (state: SettingsStore) => state.reducedEffects;
export const selectAssistedStillness = (state: SettingsStore) => state.assistedStillness;
export const selectAudioEnabled = (state: SettingsStore) => state.audioEnabled;
export const selectMobileControlMode = (state: SettingsStore) => state.mobileControlMode;
export const selectMobileControlSide = (state: SettingsStore) => state.mobileControlSide;
export const selectMobileLookSensitivity = (state: SettingsStore) => state.mobileLookSensitivity;
export const selectMobileHaptics = (state: SettingsStore) => state.mobileHaptics && !state.reducedEffects;

export { RENDER_QUALITY_EVENT, RENDER_QUALITY_STORAGE_KEY };
