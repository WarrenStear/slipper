import type { RenderQuality } from "../components/three/renderQuality";
import {
  applyExperiencePreferenceClasses,
  AUDIO_ENABLED_EVENT,
  AUDIO_ENABLED_STORAGE_KEY,
  closeExperienceSettings,
  EXPERIENCE_SETTINGS_CHANGED_EVENT,
  EXPERIENCE_SETTINGS_OPEN_REQUEST_EVENT,
  EXPERIENCE_SETTINGS_STORAGE_KEY,
  EXPERIENCE_SETTINGS_VISIBILITY_EVENT,
  getExperienceSettingsSnapshot,
  isExperienceSettingsOpen,
  ONBOARDING_COMPLETE_STORAGE_KEY,
  openExperienceSettings,
  REDUCED_MOTION_EVENT,
  REDUCED_MOTION_STORAGE_KEY,
  requestExperienceSettingsOpen,
  resetExperienceSettings,
  selectAudioEnabled,
  selectMobileControlMode,
  selectMobileControlSide,
  selectMobileHaptics,
  selectMobileLookSensitivity,
  selectPerformanceProfile,
  selectReducedEffects,
  selectReducedMotion,
  selectSettingsDrawerOpen,
  updateExperienceSettings,
  useSettingsStore,
  type ExperienceSettings,
  type MobileControlMode,
  type MobileControlSide,
  type SettingsStore,
} from "../stores/useSettingsStore";

export {
  AUDIO_ENABLED_EVENT,
  AUDIO_ENABLED_STORAGE_KEY,
  closeExperienceSettings,
  EXPERIENCE_SETTINGS_CHANGED_EVENT,
  EXPERIENCE_SETTINGS_OPEN_REQUEST_EVENT,
  EXPERIENCE_SETTINGS_STORAGE_KEY,
  EXPERIENCE_SETTINGS_VISIBILITY_EVENT,
  getExperienceSettingsSnapshot,
  isExperienceSettingsOpen,
  ONBOARDING_COMPLETE_STORAGE_KEY,
  openExperienceSettings,
  REDUCED_MOTION_EVENT,
  REDUCED_MOTION_STORAGE_KEY,
  requestExperienceSettingsOpen,
  resetExperienceSettings,
  selectAudioEnabled,
  selectMobileControlMode,
  selectMobileControlSide,
  selectMobileHaptics,
  selectMobileLookSensitivity,
  selectPerformanceProfile,
  selectReducedEffects,
  selectReducedMotion,
  selectSettingsDrawerOpen,
  updateExperienceSettings,
  useSettingsStore,
};

export type { ExperienceSettings, MobileControlMode, MobileControlSide, SettingsStore };

export function getAudioEnabledPreference() {
  return useSettingsStore.getState().audioEnabled;
}

export function setAudioEnabledPreference(enabled: boolean) {
  useSettingsStore.getState().setSetting("audioEnabled", enabled);
}

export function getReducedMotionPreference() {
  return useSettingsStore.getState().reducedMotion;
}

export function setReducedMotionPreference(enabled: boolean) {
  useSettingsStore.getState().setSetting("reducedMotion", enabled);
}

export function getReducedEffectsPreference() {
  return useSettingsStore.getState().reducedEffects;
}

export function setReducedEffectsPreference(enabled: boolean) {
  useSettingsStore.getState().setSetting("reducedEffects", enabled);
}

export function applyStoredMotionPreference() {
  applyExperiencePreferenceClasses(getExperienceSettingsSnapshot());
}

export function getOnboardingComplete() {
  if (typeof window === "undefined") return true;
  return useSettingsStore.getState().onboardingComplete;
}

export function setOnboardingComplete(complete = true) {
  useSettingsStore.getState().setSetting("onboardingComplete", complete);
}

export function getPreferredQuality() {
  return useSettingsStore.getState().performanceProfile;
}

export function setPreferredQuality(quality: RenderQuality) {
  useSettingsStore.getState().setSetting("performanceProfile", quality);
}

export function getMobileControlMode() {
  return useSettingsStore.getState().mobileControlMode;
}

export function setMobileControlMode(mode: MobileControlMode) {
  useSettingsStore.getState().setSetting("mobileControlMode", mode);
}

export function getMobileControlSide() {
  return useSettingsStore.getState().mobileControlSide;
}

export function setMobileControlSide(side: MobileControlSide) {
  useSettingsStore.getState().setSetting("mobileControlSide", side);
}

export function getMobileLookSensitivity() {
  return useSettingsStore.getState().mobileLookSensitivity;
}

export function setMobileLookSensitivity(sensitivity: number) {
  useSettingsStore.getState().setSetting("mobileLookSensitivity", sensitivity);
}

export function getMobileHapticsPreference() {
  const state = useSettingsStore.getState();
  return state.mobileHaptics && !state.reducedEffects;
}

export function setMobileHapticsPreference(enabled: boolean) {
  useSettingsStore.getState().setSetting("mobileHaptics", enabled);
}

export function subscribeExperiencePreferences(listener: (settings: ExperienceSettings) => void) {
  return useSettingsStore.subscribe((state, previous) => {
    if (state === previous) return;
    listener(getExperienceSettingsSnapshot());
  });
}
