import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type MouseEvent as ReactMouseEvent,
} from "react";
import { RENDER_QUALITY_PROFILES, type RenderQuality } from "../../components/three/renderQuality";
import { useMobileViewport } from "../../hooks/useMobileViewport";
import { clearStoredJourney } from "../../lib/journeyStorage";
import {
  clearGiftDedicationAcknowledgement,
  getGiftDedicationAcknowledged,
  subscribeGiftDedicationAcknowledgement,
} from "../../lib/dedicationPresentation";
import {
  getSlipperExperienceCapabilities,
  resolveSlipperExperienceMode,
} from "../../lib/experienceMode";
import { activateNarrativeAudioFromGesture } from "../../lib/narrativeAudioActivation";
import { requestTextJourney } from "../../lib/textJourney";
import { useBreadcrumbStore } from "../../stores/useBreadcrumbStore";
import { resetPlayerInput } from "../../stores/usePlayerInputStore";
import {
  AUDIO_ENABLED_STORAGE_KEY,
  EXPERIENCE_SETTINGS_OPEN_REQUEST_EVENT,
  EXPERIENCE_SETTINGS_STORAGE_KEY,
  REDUCED_MOTION_STORAGE_KEY,
  RENDER_QUALITY_EVENT,
  RENDER_QUALITY_STORAGE_KEY,
  syncRenderQualityPreference,
  synchronizeExperienceSettingsFromStorage,
  useSettingsStore,
} from "../../stores/useSettingsStore";
import { useJourneyStore } from "../../stores/useJourneyStore";
import { useWorldStore } from "../../stores/useWorldStore";
import "./ExperienceSettingsDrawer.css";

const QUALITY_OPTIONS: RenderQuality[] = ["low", "medium", "high", "cinematic"];
const QUALITY_DESCRIPTIONS: Record<RenderQuality, string> = {
  low: "Longest battery life",
  medium: "Balanced detail",
  high: "Sharper forest",
  cinematic: "Full atmosphere",
};
const FOCUSABLE_SELECTOR = [
  "a[href]",
  "button:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  "[tabindex]:not([tabindex='-1'])",
].join(",");

type ExperienceSettingsDrawerProps = {
  initialEntryId: string;
};

function shortLabel(value: string | null | undefined, fallback = "Local") {
  if (!value) return fallback;
  return value.length > 28 ? `${value.slice(0, 25)}…` : value;
}

function visibleFocusableElements(dialog: HTMLDialogElement) {
  return Array.from(dialog.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter(
    (element) => !element.hidden && element.getAttribute("aria-hidden") !== "true" && element.offsetParent !== null,
  );
}

export function ExperienceSettingsDrawer({ initialEntryId }: ExperienceSettingsDrawerProps) {
  const mobileViewport = useMobileViewport();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const keepSettingsRef = useRef<HTMLButtonElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const qualityButtonRefs = useRef<
    Partial<Record<RenderQuality, HTMLButtonElement | null>>
  >({});
  const [confirmReset, setConfirmReset] = useState(false);
  const [confirmJourneyReset, setConfirmJourneyReset] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [dedicationAcknowledged, setDedicationAcknowledged] = useState(() =>
    getGiftDedicationAcknowledged(),
  );

  const drawerOpen = useSettingsStore((state) => state.drawerOpen);
  const quality = useSettingsStore((state) => state.performanceProfile);
  const audioEnabled = useSettingsStore((state) => state.audioEnabled);
  const audioVolume = useSettingsStore((state) => state.audioVolume);
  const reducedMotion = useSettingsStore((state) => state.reducedMotion);
  const reducedEffects = useSettingsStore((state) => state.reducedEffects);
  const cameraAssistance = useSettingsStore((state) => state.cameraAssistance);
  const assistedStillness = useSettingsStore((state) => state.assistedStillness);
  const highContrast = useSettingsStore((state) => state.highContrast);
  const textScale = useSettingsStore((state) => state.textScale);
  const readerTheme = useSettingsStore((state) => state.readerTheme);
  const mobileControlMode = useSettingsStore((state) => state.mobileControlMode);
  const mobileControlSide = useSettingsStore((state) => state.mobileControlSide);
  const mobileLookSensitivity = useSettingsStore((state) => state.mobileLookSensitivity);
  const mobileHaptics = useSettingsStore((state) => state.mobileHaptics);
  const showContextualGuidance = useSettingsStore((state) => state.showContextualGuidance);
  const setSetting = useSettingsStore((state) => state.setSetting);
  const resetSettings = useSettingsStore((state) => state.resetSettings);
  const setDrawerOpen = useSettingsStore((state) => state.setDrawerOpen);

  const activeEntryId = useJourneyStore((state) => state.activeEntryId);
  const history = useJourneyStore((state) => state.history);
  const narrativeWorldState = useJourneyStore((state) => state.narrativeWorldState);
  const cloudStatus = useJourneyStore((state) => state.cloudStatus);
  const cloudMessage = useJourneyStore((state) => state.cloudMessage);
  const cloudSubject = useJourneyStore((state) => state.cloudSubject);
  const storyStarted = useJourneyStore((state) => state.storyStarted);
  const storyCompleted = useJourneyStore((state) => state.storyCompleted);
  const resetJourney = useJourneyStore((state) => state.resetJourney);
  const clearBreadcrumbs = useBreadcrumbStore((state) => state.clearBreadcrumbs);
  const mode = useWorldStore((state) => state.mode);
  const controls = useWorldStore((state) => state.controls);
  const toggleControls = useWorldStore((state) => state.toggleControls);
  const setControls = useWorldStore((state) => state.setControls);
  const setMode = useWorldStore((state) => state.setMode);
  const setSceneProximity = useWorldStore((state) => state.setSceneProximity);
  const experienceMode = resolveSlipperExperienceMode({
    storyStarted,
    storyCompleted,
    dedicationAcknowledged,
  });
  const experienceCapabilities = getSlipperExperienceCapabilities(experienceMode);

  const handleQualityKeyDown = useCallback(
    (
      event: ReactKeyboardEvent<HTMLButtonElement>,
      currentQuality: RenderQuality,
    ) => {
      const currentIndex = QUALITY_OPTIONS.indexOf(currentQuality);
      let nextIndex: number | null = null;

      if (event.key === "ArrowRight" || event.key === "ArrowDown") {
        nextIndex = (currentIndex + 1) % QUALITY_OPTIONS.length;
      } else if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
        nextIndex =
          (currentIndex - 1 + QUALITY_OPTIONS.length) %
          QUALITY_OPTIONS.length;
      } else if (event.key === "Home") {
        nextIndex = 0;
      } else if (event.key === "End") {
        nextIndex = QUALITY_OPTIONS.length - 1;
      }

      if (nextIndex === null) return;
      event.preventDefault();
      const nextQuality = QUALITY_OPTIONS[nextIndex];
      setSetting("performanceProfile", nextQuality);
      qualityButtonRefs.current[nextQuality]?.focus();
    },
    [setSetting],
  );

  const closeDrawer = useCallback(() => setDrawerOpen(false), [setDrawerOpen]);
  const journeyProgress =
    narrativeWorldState.totalCount > 0
      ? Math.round((narrativeWorldState.visitedCount / narrativeWorldState.totalCount) * 100)
      : 0;
  const profile = RENDER_QUALITY_PROFILES[quality];
  const cloudTone =
    cloudStatus === "synced"
      ? "synced"
      : cloudStatus === "error"
        ? "error"
        : cloudStatus === "saving" || cloudStatus === "loading"
          ? "working"
          : "local";

  const journeySummary = useMemo(() => {
    const tone =
      narrativeWorldState.memoryPressure > 0.68
        ? "memory-heavy"
        : narrativeWorldState.explorationDepth > 0.62
          ? "deep trail"
          : Math.abs(narrativeWorldState.fireWaterBalance) > 0.35
            ? narrativeWorldState.fireWaterBalance > 0
              ? "fire-led"
              : "water-led"
            : "balanced";

    return {
      tone,
      progress: `${narrativeWorldState.visitedCount}/${narrativeWorldState.totalCount}`,
      trace: narrativeWorldState.traceCount,
    };
  }, [narrativeWorldState]);

  useEffect(() => {
    return subscribeGiftDedicationAcknowledgement(setDedicationAcknowledged);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const handleQualityEvent = (event: Event) => {
      syncRenderQualityPreference((event as CustomEvent<{ quality?: unknown }>).detail?.quality);
    };
    const handleStorage = (event: StorageEvent) => {
      if (
        event.key === EXPERIENCE_SETTINGS_STORAGE_KEY ||
        event.key === AUDIO_ENABLED_STORAGE_KEY ||
        event.key === REDUCED_MOTION_STORAGE_KEY
      ) {
        synchronizeExperienceSettingsFromStorage();
      }
      if (event.key === RENDER_QUALITY_STORAGE_KEY) {
        syncRenderQualityPreference(event.newValue);
      }
    };
    const handleOpenRequest = () => setDrawerOpen(true);
    const handleShortcut = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.ctrlKey || event.metaKey || event.altKey || event.isComposing) return;
      const target = event.target as HTMLElement | null;
      const isTyping =
        target?.tagName === "INPUT" ||
        target?.tagName === "TEXTAREA" ||
        target?.tagName === "SELECT" ||
        target?.isContentEditable;
      if (isTyping) return;
      if (event.key === "," || event.key.toLowerCase() === "o") {
        event.preventDefault();
        event.stopPropagation();
        setDrawerOpen(!useSettingsStore.getState().drawerOpen);
      }
    };

    window.addEventListener(RENDER_QUALITY_EVENT, handleQualityEvent);
    window.addEventListener("storage", handleStorage);
    window.addEventListener(EXPERIENCE_SETTINGS_OPEN_REQUEST_EVENT, handleOpenRequest);
    window.addEventListener("keydown", handleShortcut);

    return () => {
      window.removeEventListener(RENDER_QUALITY_EVENT, handleQualityEvent);
      window.removeEventListener("storage", handleStorage);
      window.removeEventListener(EXPERIENCE_SETTINGS_OPEN_REQUEST_EVENT, handleOpenRequest);
      window.removeEventListener("keydown", handleShortcut);
    };
  }, [setDrawerOpen]);

  useEffect(() => {
    if (mobileViewport.isMobile && controls !== "walk") {
      setControls("walk");
    }
  }, [controls, mobileViewport.isMobile, setControls]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (drawerOpen) {
      if (!dialog.open) {
        previousFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
        try {
          dialog.showModal();
        } catch {
          dialog.setAttribute("open", "");
        }
      }
      document.documentElement.classList.add("sidtw-settings-open");
      setConfirmReset(false);
      setConfirmJourneyReset(false);
      setStatusMessage(null);
      const focusFrame = window.requestAnimationFrame(() => closeButtonRef.current?.focus());
      return () => window.cancelAnimationFrame(focusFrame);
    }

    document.documentElement.classList.remove("sidtw-settings-open");
    if (dialog.open) dialog.close();
    const previousFocus = previousFocusRef.current;
    previousFocusRef.current = null;
    const previousInClosedMenu = previousFocus?.closest(".experience-menu:not([open])");
    const returnTarget = previousFocus?.isConnected && !previousInClosedMenu ? previousFocus
      : document.querySelector<HTMLElement>("[data-quiet-memories='true'] #experience-memories-trigger");
    if (returnTarget?.isConnected) window.requestAnimationFrame(() => returnTarget.focus());
  }, [drawerOpen]);

  useEffect(() => {
    if (!drawerOpen) return;

    const keepFocusInsideDialog = (event: FocusEvent) => {
      const dialog = dialogRef.current;
      const target = event.target;
      if (
        !dialog?.open ||
        !(target instanceof Node) ||
        dialog.contains(target)
      ) {
        return;
      }

      const fallback = visibleFocusableElements(dialog)[0] ?? dialog;
      fallback.focus();
    };

    document.addEventListener("focusin", keepFocusInsideDialog, true);
    return () =>
      document.removeEventListener("focusin", keepFocusInsideDialog, true);
  }, [drawerOpen]);

  useEffect(() => {
    if (drawerOpen && (confirmReset || confirmJourneyReset)) keepSettingsRef.current?.focus();
  }, [confirmJourneyReset, confirmReset, drawerOpen]);

  useEffect(
    () => () => {
      document.documentElement.classList.remove("sidtw-settings-open");
      if (dialogRef.current?.open) dialogRef.current.close();
      previousFocusRef.current?.focus();
    },
    [],
  );

  const handleDialogKeyDown = (event: ReactKeyboardEvent<HTMLDialogElement>) => {
    event.stopPropagation();

    if (event.key === "Escape") {
      event.preventDefault();
      closeDrawer();
      return;
    }

    if (event.key !== "Tab") return;
    const dialog = dialogRef.current;
    if (!dialog) return;
    const focusable = visibleFocusableElements(dialog);
    if (focusable.length === 0) {
      event.preventDefault();
      dialog.focus();
      return;
    }

    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    const active = document.activeElement;
    if (event.shiftKey && (active === first || active === dialog)) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && active === last) {
      event.preventDefault();
      first.focus();
    }
  };

  const handleDialogPointer = (event: ReactMouseEvent<HTMLDialogElement>) => {
    if (event.target === event.currentTarget) closeDrawer();
  };

  const restoreSafeDefaults = () => {
    resetSettings();
    setConfirmReset(false);
    setStatusMessage("Experience settings restored. Your journey, history, and visited fragments were kept.");
  };

  const resetJourneySafely = () => {
    const destination = initialEntryId || activeEntryId;
    if (!destination) {
      setStatusMessage("The journey could not be reset because no valid opening fragment is available.");
      setConfirmJourneyReset(false);
      return;
    }

    clearStoredJourney();
    clearGiftDedicationAcknowledgement();
    clearBreadcrumbs();
    resetJourney(destination);
    resetPlayerInput();
    setSceneProximity(null);
    setControls("walk");
    setMode("explore");
    setConfirmJourneyReset(false);
    setStatusMessage("Journey reset to the opening clearing. Experience settings were kept.");
  };

  return (
    <>
      <button
        type="button"
        className={`experience-settings-trigger${experienceCapabilities.allowFreeExploration ? "" : " is-story-safe"}`}
        aria-label="Settings"
        aria-expanded={drawerOpen}
        aria-controls="experience-settings-dialog"
        onClick={() => setDrawerOpen(!drawerOpen)}
      >
        {experienceCapabilities.allowFreeExploration ? (
          <>
            <span>Settings</span>
            <strong>{profile.label}</strong>
          </>
        ) : (
          <span className="experience-settings-trigger__story-mark" aria-hidden="true">◌</span>
        )}
      </button>

      <dialog
        id="experience-settings-dialog"
        ref={dialogRef}
        tabIndex={-1}
        className="experience-settings-dialog"
        aria-labelledby="experience-settings-title"
        aria-describedby="experience-settings-summary"
        data-initial-entry={initialEntryId || undefined}
        onCancel={(event) => {
          event.preventDefault();
          closeDrawer();
        }}
        onClose={() => {
          if (useSettingsStore.getState().drawerOpen) closeDrawer();
        }}
        onKeyDown={handleDialogKeyDown}
        onKeyUp={(event) => event.stopPropagation()}
        onMouseDown={handleDialogPointer}
      >
        <div className="experience-settings-drawer">
          <header>
            <div>
              <p>Slipper in the Woods</p>
              <h2 id="experience-settings-title">Experience settings</h2>
              <span id="experience-settings-summary">
                Adjust reading, movement, effects, and sound. Changes are saved on this device.
              </span>
            </div>
            <button ref={closeButtonRef} type="button" onClick={closeDrawer} aria-label="Close settings">
              Close
            </button>
          </header>

          {experienceCapabilities.showJourneyMetrics ? (
            <section className="experience-settings-card journey-card" aria-labelledby="journey-state-heading">
              <div>
                <span id="journey-state-heading">Current journey</span>
                <strong>{journeySummary.tone}</strong>
              </div>
              <div className="journey-meter" role="progressbar" aria-label="Journey progress" aria-valuemin={0} aria-valuemax={100} aria-valuenow={journeyProgress}>
                <i style={{ width: `${journeyProgress}%` }} />
              </div>
              <dl>
                <div>
                  <dt>Seen</dt>
                  <dd>{journeySummary.progress}</dd>
                </div>
                <div>
                  <dt>Trace</dt>
                  <dd>{journeySummary.trace}</dd>
                </div>
                <div>
                  <dt>Mode</dt>
                  <dd>{mode}</dd>
                </div>
                <div>
                  <dt>Controls</dt>
                  <dd>{controls}</dd>
                </div>
              </dl>
            </section>
          ) : null}

          <fieldset className="experience-settings-card">
            <legend>Display and reading</legend>
            <div className="settings-toggle-list">
              <button type="button" onClick={() => {
                // The destination owns focus after this presentation handoff.
                previousFocusRef.current = null;
                closeDrawer();
                requestTextJourney();
              }}>
                <span>Continue with text journey</span>
                <strong>No 3D</strong>
              </button>
            </div>
            <p className="settings-help">Follow the same story and choices through text. Your current place is kept.</p>
            <div className="settings-section-heading">
              <span>Render quality</span>
              <strong>{profile.label}</strong>
            </div>
            <div className="quality-grid" role="radiogroup" aria-label="Render quality">
              {QUALITY_OPTIONS.map((option) => {
                const optionProfile = RENDER_QUALITY_PROFILES[option];
                const isActive = option === quality;
                return (
                  <button
                    key={option}
                    ref={(element) => {
                      qualityButtonRefs.current[option] = element;
                    }}
                    type="button"
                    role="radio"
                    aria-checked={isActive}
                    tabIndex={isActive ? 0 : -1}
                    className={isActive ? "is-active" : ""}
                    onClick={() => setSetting("performanceProfile", option)}
                    onKeyDown={(event) =>
                      handleQualityKeyDown(event, option)
                    }
                  >
                    <strong>{optionProfile.label}</strong>
                    <span>{QUALITY_DESCRIPTIONS[option]}</span>
                  </button>
                );
              })}
            </div>

            <label className="settings-control-row">
              <span>Reading surface</span>
              <select value={readerTheme} onChange={(event) => setSetting("readerTheme", event.target.value as "ambient" | "clean")}>
                <option value="ambient">Ambient</option>
                <option value="clean">Clean, still page</option>
              </select>
            </label>

            <label className="settings-range-row">
              <span>Reading text size</span>
              <input
                type="range"
                min="0.9"
                max="1.35"
                step="0.05"
                value={textScale}
                onChange={(event) => setSetting("textScale", Number(event.target.value))}
              />
              <output>{Math.round(textScale * 100)}%</output>
            </label>

            <div className="settings-toggle-list">
              <button
                type="button"
                aria-pressed={reducedMotion}
                className={reducedMotion ? "is-active" : ""}
                onClick={() => setSetting("reducedMotion", !reducedMotion)}
              >
                <span>Reduced motion</span>
                <strong>{reducedMotion ? "On" : "Off"}</strong>
              </button>
              <button
                type="button"
                aria-pressed={reducedEffects}
                className={reducedEffects ? "is-active" : ""}
                onClick={() => setSetting("reducedEffects", !reducedEffects)}
              >
                <span>Reduced environmental effects</span>
                <strong>{reducedEffects ? "On" : "Off"}</strong>
              </button>
              <button
                type="button"
                aria-pressed={highContrast}
                className={highContrast ? "is-active" : ""}
                onClick={() => setSetting("highContrast", !highContrast)}
              >
                <span>High contrast</span>
                <strong>{highContrast ? "On" : "Off"}</strong>
              </button>
              <button
                type="button"
                aria-pressed={showContextualGuidance}
                className={showContextualGuidance ? "is-active" : ""}
                onClick={() => setSetting("showContextualGuidance", !showContextualGuidance)}
              >
                <span>Guidance assistance</span>
                <strong>{showContextualGuidance ? "On" : "Off"}</strong>
              </button>
              <button
                type="button"
                aria-pressed={cameraAssistance}
                onClick={() => setSetting("cameraAssistance", !cameraAssistance)}
              >
                <span>Gentle camera assistance</span>
                <strong>{cameraAssistance ? "On" : "Off"}</strong>
              </button>
              <button
                type="button"
                aria-pressed={assistedStillness}
                aria-describedby="assisted-stillness-help"
                className={assistedStillness ? "is-active" : ""}
                onClick={() => setSetting("assistedStillness", !assistedStillness)}
              >
                <span>Assisted Stillness</span>
                <strong>{assistedStillness ? "On" : "Off"}</strong>
              </button>
            </div>
            <p id="assisted-stillness-help" className="settings-help">
              Adds an intentional control for stillness moments, so touch, alternative input, or controller drift cannot interrupt them.
            </p>
          </fieldset>

          <fieldset className="experience-settings-card">
            <legend>Mobile exploration</legend>
            <label className="settings-control-row">
              <span>Movement style</span>
              <select
                value={mobileControlMode}
                onChange={(event) => setSetting("mobileControlMode", event.target.value as "direct" | "guided")}
              >
                <option value="direct">Direct touch movement</option>
                <option value="guided">Lantern-guided movement</option>
              </select>
            </label>
            <label className="settings-control-row">
              <span>Movement control side</span>
              <select
                value={mobileControlSide}
                onChange={(event) => setSetting("mobileControlSide", event.target.value as "left" | "right")}
              >
                <option value="left">Left side</option>
                <option value="right">Right side</option>
              </select>
            </label>
            <label className="settings-range-row">
              <span>Touch look sensitivity</span>
              <input
                type="range"
                min="0.5"
                max="1.6"
                step="0.1"
                value={mobileLookSensitivity}
                onChange={(event) => setSetting("mobileLookSensitivity", Number(event.target.value))}
              />
              <output>{mobileLookSensitivity.toFixed(1)}×</output>
            </label>
            <div className="settings-toggle-list">
              <button
                type="button"
                aria-pressed={mobileHaptics && !reducedEffects}
                aria-describedby={reducedEffects ? "haptics-disabled-reason" : undefined}
                className={mobileHaptics && !reducedEffects ? "is-active" : ""}
                disabled={reducedEffects}
                onClick={() => setSetting("mobileHaptics", !mobileHaptics)}
              >
                <span>Gentle haptics</span>
                <strong>{reducedEffects ? "Effects reduced" : mobileHaptics ? "On" : "Off"}</strong>
              </button>
            </div>
            {reducedEffects ? (
              <p id="haptics-disabled-reason" className="settings-help">
                Haptics stay off while reduced environmental effects is active.
              </p>
            ) : null}
          </fieldset>

          <fieldset className="experience-settings-card">
            <legend>{experienceCapabilities.allowFreeExploration ? "Sound and navigation" : "Sound"}</legend>
            <div className="settings-toggle-list">
              <button
                type="button"
                aria-pressed={audioEnabled}
                className={audioEnabled ? "is-active" : ""}
                onClick={() => {
                  const nextAudioEnabled = !audioEnabled;
                  if (nextAudioEnabled) activateNarrativeAudioFromGesture(true);
                  setSetting("audioEnabled", nextAudioEnabled);
                }}
              >
                <span>Audio atmosphere</span>
                <strong>{audioEnabled ? "On" : "Off"}</strong>
              </button>
              {experienceCapabilities.allowFreeExploration && !mobileViewport.isMobile ? (
                <button type="button" onClick={toggleControls}>
                  <span>Desktop movement mode</span>
                  <strong>{controls === "walk" ? "Walk" : "Orbit"}</strong>
                </button>
              ) : null}
              {experienceCapabilities.allowConstellationNavigation ? (
                <button type="button" onClick={() => setMode(mode === "map" ? "explore" : "map")}>
                  <span>Archive map</span>
                  <strong>{mode === "map" ? "Close" : "Open"}</strong>
                </button>
              ) : null}
            </div>
            <label className="settings-range-row">
              <span>Audio volume</span>
              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={audioVolume}
                disabled={!audioEnabled}
                onChange={(event) => setSetting("audioVolume", Number(event.target.value))}
              />
              <output>{Math.round(audioVolume * 100)}%</output>
            </label>
          </fieldset>

          <section className={`experience-settings-card cloud-card is-${cloudTone}`} aria-labelledby="cloud-settings-heading">
            <div>
              <span id="cloud-settings-heading">Cloud journey</span>
              <strong>{cloudStatus}</strong>
            </div>
            <p>
              {cloudMessage ??
                (cloudSubject
                  ? `Connected as ${shortLabel(cloudSubject)}`
                  : "Local journey only until cloud persistence is activated.")}
            </p>
          </section>

          <footer>
            <div>
              <button
                className="settings-reset-button"
                type="button"
                onClick={() => {
                  setConfirmJourneyReset(false);
                  setConfirmReset(true);
                }}
              >
                Restore safe defaults
              </button>
              {experienceCapabilities.allowFreeExploration ? (
                <button
                  className="settings-reset-button settings-journey-reset-button"
                  type="button"
                  onClick={() => {
                    setConfirmReset(false);
                    setConfirmJourneyReset(true);
                  }}
                >
                  Reset journey
                </button>
              ) : null}
              {experienceCapabilities.showJourneyMetrics ? (
                <span>
                  {history.length} steps remembered
                  {activeEntryId ? " / journey retained" : ""}
                </span>
              ) : null}
            </div>

            {confirmReset ? (
              <div className="settings-confirmation" role="alertdialog" aria-labelledby="settings-reset-title" aria-describedby="settings-reset-copy">
                <strong id="settings-reset-title">Restore experience settings?</strong>
                <p id="settings-reset-copy">
                  Display, sound, accessibility, and mobile-control preferences will return to safe defaults. Journey history and visited fragments will not be erased.
                </p>
                <div>
                  <button ref={keepSettingsRef} type="button" onClick={() => setConfirmReset(false)}>
                    Keep current settings
                  </button>
                  <button className="settings-reset-confirm" type="button" onClick={restoreSafeDefaults}>
                    Restore defaults
                  </button>
                </div>
              </div>
            ) : null}

            {experienceCapabilities.allowFreeExploration && confirmJourneyReset ? (
              <div
                className="settings-confirmation"
                role="alertdialog"
                aria-labelledby="journey-reset-title"
                aria-describedby="journey-reset-copy"
              >
                <strong id="journey-reset-title">Reset the whole journey?</strong>
                <p id="journey-reset-copy">
                  This clears visited fragments, breadcrumbs, bookmarks, and the saved recovery position, then returns to the opening clearing. Your accessibility and control settings stay unchanged.
                </p>
                <div>
                  <button ref={keepSettingsRef} type="button" onClick={() => setConfirmJourneyReset(false)}>
                    Keep journey
                  </button>
                  <button className="settings-reset-confirm" type="button" onClick={resetJourneySafely}>
                    Reset journey
                  </button>
                </div>
              </div>
            ) : null}

            {statusMessage ? <p className="settings-status" role="status" aria-live="polite">{statusMessage}</p> : null}
          </footer>
        </div>
      </dialog>
    </>
  );
}

export default ExperienceSettingsDrawer;
