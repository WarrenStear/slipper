import GuidedStoryMoment from "./components/ui/GuidedStoryMoment";
import "./ui/MemoryReturn.css";
import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import type { NarrativeWorldState, SceneProximityState, StorySceneControls, StorySceneMode } from "./components/three/StoryScene";
import ArchiveIndex, {
  MapWorkspaceTabs,
  STORY_MAP_ARCHIVE_PANEL_ID,
  STORY_MAP_ARCHIVE_TAB_ID,
  STORY_MAP_CONSTELLATION_PANEL_ID,
  STORY_MAP_CONSTELLATION_TAB_ID,
  type StoryMapPane,
} from "./components/ui/ArchiveIndex";
import AccessibleArchive from "./components/ui/AccessibleArchive";
import AccessibleStoryJourney from "./components/ui/AccessibleStoryJourney";
import MobileExploreControls from "./components/ui/MobileExploreControls";
import OnboardingGate from "./components/ui/OnboardingGate";
import { RenderRecoveryBoundary } from "./components/ui/RenderRecovery";
import { TEXT_JOURNEY_REQUEST_EVENT, textJourneyUrl } from "./lib/textJourney";
import { resetPlayerInput } from "./stores/usePlayerInputStore";
import { journeyChapters } from "./data/journeyNarrative";
import { canReadStoryEntry, selectStoryLocation } from "./narrative/StorySelectors";
import { StoryRuntimeProvider, useStoryRuntimeShell } from "./experience/StoryRuntimeContext";
import { useStoryNavigation } from "./experience/useStoryNavigation";
import { contentDiagnostics, entries, visuals } from "./data/slipperContent";
import type { Slipper3DEntry, Vector3Tuple } from "./data/slipper3dTypes";
import { loadStoredJourney } from "./lib/journeyStorage";
import { nextRequiredEntry } from "./lib/journeyProgression";
import { MagicLinkSignIn } from "./components/auth/MagicLinkSignIn";
import GiftDedication from "./components/ui/GiftDedication";
import { useCloudJourneySync } from "./hooks/useCloudJourneySync";
import { useMobileViewport } from "./hooks/useMobileViewport";
import { requestExperienceSettingsOpen } from "./lib/experiencePreferences";
import {
  rotateXZByYaw,
  trailStateLabel,
} from "./lib/navigationPresentation";
import { useJourneyStore } from "./stores/useJourneyStore";
import { useSettingsStore } from "./stores/useSettingsStore";
import { useWorldStore } from "./stores/useWorldStore";
import type { WorldMemoryState } from "./components/three/worldMemory/WorldMemoryDirector";
import DiegeticProseDirector from "./components/three/storyText/DiegeticProseDirector";
import StoryTransitionDirector, { type StoryTransitionPhase } from "./components/three/journey/StoryTransitionDirector";
import JourneyDirector, {
  canEnterJourneyEntry,
} from "./components/three/journey/JourneyDirector";
import {
  getEntryAdjacency,
  getEntryById,
  getNextEntry,
  getOrderedEntries,
  getScenePortals,
} from "./lib/storyGraph";
import {
  getSlipperExperienceCapabilities,
  resolveSlipperExperienceMode,
  resolveSlipperStartState,
} from "./lib/experienceMode";
import {
  getGiftDedicationAcknowledged,
  subscribeGiftDedicationAcknowledgement,
} from "./lib/dedicationPresentation";
import { resolveStoryGuidance } from "./lib/storyGuidance";
import {
  storyTransitionAllowsAction,
  storyTransitionAllowsProse,
  storyTransitionSuppressesAudio,
} from "./lib/storyTransitionPacing";
import "./styles.css";
import { requiresAccessibleJourney } from "./experience/ExperienceRouter";

export { requiresAccessibleJourney } from "./experience/ExperienceRouter";

const WorldCanvas = lazy(() => import("./components/three/WorldCanvas"));
const ConstellationMap = lazy(
  () => import("./components/ui/ConstellationMap"),
);
const FIRST_ENTRY_ID = entries[0]?.id ?? "";
const VALID_ENTRY_IDS = entries.map((entry) => entry.id);

type AppMode = StorySceneMode;

function modeLabel(mode: AppMode) {
  if (mode === "explore") return "Forest";
  if (mode === "read") return "Fragment";
  return "Constellation";
}

function entryParagraphs(entry?: Slipper3DEntry) {
  if (!entry) return [];
  return entry.paragraphs?.length ? entry.paragraphs : [entry.body].filter(Boolean);
}

function shortTitle(title?: string, limit = 28) {
  if (!title) return "Unknown";
  return title.length > limit ? `${title.slice(0, limit - 1)}…` : title;
}

function sceneLabel(entry?: Slipper3DEntry) {
  if (!entry) return "Unknown clearing";
  return entry.engine3d.sceneKind ?? entry.engine3d.mood ?? "fragment";
}

const MINI_MAP_SIZE = 172;
const MINI_MAP_CENTER = MINI_MAP_SIZE / 2;
const MINI_MAP_RADIUS = 62;
const MINI_MAP_WORLD_RADIUS = 32;

function minimapVector(from?: Vector3Tuple | null, to?: Vector3Tuple | null, cameraYaw = 0) {
  if (!from || !to) return { x: MINI_MAP_CENTER, y: MINI_MAP_CENTER, distance: 0, hasTarget: false };

  const dx = to[0] - from[0];
  const dz = to[2] - from[2];
  const distance = Math.sqrt(dx * dx + dz * dz);
  const scale = distance > MINI_MAP_WORLD_RADIUS ? MINI_MAP_WORLD_RADIUS / Math.max(distance, 0.0001) : 1;
  const rotated = rotateXZByYaw(dx, dz, cameraYaw);

  return {
    x: MINI_MAP_CENTER + (rotated.x / MINI_MAP_WORLD_RADIUS) * MINI_MAP_RADIUS * scale,
    y: MINI_MAP_CENTER - (rotated.z / MINI_MAP_WORLD_RADIUS) * MINI_MAP_RADIUS * scale,
    distance,
    hasTarget: true,
  };
}

function miniMapShellStyle(): CSSProperties {
  return {
    position: "absolute",
    right: 22,
    bottom: 126,
    zIndex: 22,
    width: 218,
    padding: "14px 14px 12px",
    borderRadius: 22,
    border: "1px solid rgba(255,245,206,0.18)",
    background: "linear-gradient(180deg, rgba(9,10,12,0.78), rgba(5,6,8,0.58))",
    boxShadow: "0 22px 70px rgba(0,0,0,0.38)",
    backdropFilter: "blur(18px)",
    WebkitBackdropFilter: "blur(18px)",
    color: "#f6efe2",
    pointerEvents: "none",
  };
}

function MiniMapHUD({
  entries,
  activeEntryId,
  sceneProximity,
}: {
  entries: Slipper3DEntry[];
  activeEntryId: string;
  sceneProximity: SceneProximityState | null;
}) {
  const activeEntry = entries.find((entry) => entry.id === activeEntryId);
  const fallbackNearestEntryId = sceneProximity?.nearestEntryId && sceneProximity.nearestEntryId !== activeEntryId ? sceneProximity.nearestEntryId : null;
  const approachingEntryId = sceneProximity?.navigationTargetId ?? sceneProximity?.approachingEntryId ?? fallbackNearestEntryId;
  const approachingEntry = entries.find((entry) => entry.id === approachingEntryId);
  const playerPosition = sceneProximity?.playerPosition ?? sceneProximity?.activeWorldPosition ?? ([0, 0, 0] as Vector3Tuple);
  const targetPosition = sceneProximity?.navigationTargetWorldPosition ?? sceneProximity?.approachingWorldPosition ?? sceneProximity?.nearestWorldPosition ?? null;
  const blip = minimapVector(playerPosition, targetPosition, sceneProximity?.cameraYaw ?? 0);
  const approachingDistance = sceneProximity?.navigationTargetDistance && sceneProximity.navigationTargetDistance < 999 ? sceneProximity.navigationTargetDistance : sceneProximity?.approachingDistance && sceneProximity.approachingDistance < 999 ? sceneProximity.approachingDistance : blip.distance;
  const presence = Math.max(0.18, Math.min(1, sceneProximity?.uiPresence ?? 0.42));
  const sweepOpacity = 0.24 + presence * 0.44;
  const trailState = sceneProximity?.trailState ?? "on-trail";
  const trailLabel = trailStateLabel(trailState);

  return (
    <section className="mini-map-hud" style={miniMapShellStyle()} aria-label="Live mini-map">
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, marginBottom: 10 }}>
        <div>
          <p style={{ margin: 0, fontSize: 10, letterSpacing: "0.16em", textTransform: "uppercase", color: "rgba(246,239,226,0.58)" }}>live path</p>
          <strong style={{ display: "block", marginTop: 3, fontSize: 13, lineHeight: 1.2 }}>{shortTitle(activeEntry?.title, 24)}</strong>
        </div>
        <span style={{ fontSize: 11, color: "rgba(255,245,206,0.72)", border: "1px solid rgba(255,245,206,0.16)", borderRadius: 999, padding: "4px 7px" }}>
          {trailLabel}
        </span>
      </div>

      <svg width={MINI_MAP_SIZE} height={MINI_MAP_SIZE} viewBox={`0 0 ${MINI_MAP_SIZE} ${MINI_MAP_SIZE}`} role="img" aria-label="Player position and nearest clearing blip">
        <defs>
          <radialGradient id="mini-map-core" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#fff5ce" stopOpacity="0.34" />
            <stop offset="56%" stopColor="#d8d0ba" stopOpacity="0.08" />
            <stop offset="100%" stopColor="#050608" stopOpacity="0" />
          </radialGradient>
          <filter id="mini-map-glow" x="-80%" y="-80%" width="260%" height="260%">
            <feGaussianBlur stdDeviation="4" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
        <circle cx={MINI_MAP_CENTER} cy={MINI_MAP_CENTER} r={78} fill="url(#mini-map-core)" />
        <path d={`M ${MINI_MAP_CENTER - 8} ${MINI_MAP_CENTER - 60} L ${MINI_MAP_CENTER} ${MINI_MAP_CENTER - 75} L ${MINI_MAP_CENTER + 8} ${MINI_MAP_CENTER - 60} Z`} fill="rgba(255,245,206,0.2)" />
        <circle cx={MINI_MAP_CENTER} cy={MINI_MAP_CENTER} r={68} fill="none" stroke="rgba(255,245,206,0.16)" strokeWidth="1" />
        <circle cx={MINI_MAP_CENTER} cy={MINI_MAP_CENTER} r={43} fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth="1" strokeDasharray="3 6" />
        <path
          d={`M ${MINI_MAP_CENTER} ${MINI_MAP_CENTER} L ${MINI_MAP_CENTER + Math.cos(-Math.PI / 5) * 66} ${MINI_MAP_CENTER + Math.sin(-Math.PI / 5) * 66}`}
          stroke="rgba(255,245,206,0.12)"
          strokeWidth="1"
        />
        {blip.hasTarget ? (
          <>
            <line x1={MINI_MAP_CENTER} y1={MINI_MAP_CENTER} x2={blip.x} y2={blip.y} stroke="rgba(255,245,206,0.32)" strokeWidth="1.25" strokeDasharray="5 5" />
            <circle cx={blip.x} cy={blip.y} r={10 + presence * 4} fill="rgba(216,208,186,0.08)" stroke="rgba(255,245,206,0.24)" />
            <circle cx={blip.x} cy={blip.y} r={4.5} fill="#d8d0ba" filter="url(#mini-map-glow)" />
          </>
        ) : null}
        <circle cx={MINI_MAP_CENTER} cy={MINI_MAP_CENTER} r={14 + presence * 6} fill="rgba(255,245,206,0.08)" stroke={`rgba(255,245,206,${sweepOpacity})`} />
        <circle cx={MINI_MAP_CENTER} cy={MINI_MAP_CENTER} r={5.5} fill="#fff5ce" filter="url(#mini-map-glow)" />
        <circle cx={MINI_MAP_CENTER} cy={MINI_MAP_CENTER} r={2} fill="#ffffff" />
      </svg>

      <div style={{ display: "grid", gap: 4, marginTop: 8 }}>
        <span style={{ fontSize: 10, letterSpacing: "0.14em", textTransform: "uppercase", color: "rgba(246,239,226,0.46)" }}>guidance target</span>
        <strong style={{ fontSize: 12, lineHeight: 1.2 }}>{shortTitle(approachingEntry?.title ?? sceneProximity?.approachingTitle ?? sceneProximity?.nearestTitle ?? "Listening for a clearing", 31)}</strong>
        <em style={{ fontStyle: "normal", fontSize: 11, color: "rgba(246,239,226,0.56)" }}>
          {approachingDistance > 0 ? `${Math.max(1, Math.round(approachingDistance))} units / ${trailLabel}` : "standing in the active clearing"}
        </em>
      </div>
    </section>
  );
}

function ContextualNavigationPrompt({ sceneProximity }: { sceneProximity: SceneProximityState | null }) {
  const targetTitle = sceneProximity?.navigationTargetTitle ?? sceneProximity?.approachingTitle ?? sceneProximity?.nearestTitle ?? "The next clearing";
  const distance = sceneProximity?.navigationTargetDistance ?? sceneProximity?.approachingDistance ?? 0;
  const trailState = sceneProximity?.trailState ?? "on-trail";
  const label = trailStateLabel(trailState);
  const instruction =
    trailState === "lost"
      ? "Turn toward the bright mark and let the path reopen."
      : trailState === "edge-of-trail"
        ? "Ease back toward the centre of the trail."
        : sceneProximity?.insideClearing
          ? "This clearing is awake. Press F to read or follow the next signal."
          : "Walk forward when the blip sits above the centre mark.";

  return (
    <section className={`contextual-nav-prompt is-${trailState}`} aria-label="Current navigation guidance">
      <span>{label}</span>
      <strong>{shortTitle(targetTitle, 42)}</strong>
      <em>{distance > 0 && distance < 999 ? `${Math.max(1, Math.round(distance))} units away. ${instruction}` : instruction}</em>
    </section>
  );
}

function ExperienceApplication() {
  const legacyJourney = useMemo(() => loadStoredJourney(VALID_ENTRY_IDS, FIRST_ENTRY_ID), []);
  const mobileViewport = useMobileViewport();
  const [accessibleJourney, setAccessibleJourney] = useState(requiresAccessibleJourney);
  const [experienceStarted, setExperienceStarted] = useState(false);
  const [sessionJourneyMode, setSessionJourneyMode] = useState<"first-journey" | "returning-journey" | null>(null);
  const [archiveOpen, setArchiveOpen] = useState(false);
  const [readerProgress, setReaderProgress] = useState(0);
  const [readerFocusNonce, setReaderFocusNonce] = useState(0);
  const [guidanceEntryId, setGuidanceEntryId] = useState<string | null>(null);
  const [guidanceStatus, setGuidanceStatus] = useState("");
  const [sceneResetNonce, setSceneResetNonce] = useState(0);
  const [mobileMapPane, setMobileMapPane] = useState<StoryMapPane>("constellation");
  const [dedicationAcknowledged, setDedicationAcknowledged] = useState(
    getGiftDedicationAcknowledged,
  );
  const [storyTransitionPhase, setStoryTransitionPhase] = useState<StoryTransitionPhase>("idle");
  const [finalConstellationRevealed, setFinalConstellationRevealed] = useState(false);
  const [idleMs, setIdleMs] = useState(0);
  const [showMovementHint, setShowMovementHint] = useState(true);
  const lastActivityAtRef = useRef(
    typeof performance === "undefined" ? 0 : performance.now(),
  );
  const previousPlayerPositionRef = useRef<Vector3Tuple | null>(null);
  const readerRef = useRef<HTMLDivElement>(null);
  const forestRef = useRef<HTMLElement>(null);
  const mapWorkspaceRef = useRef<HTMLElement>(null);
  const constellationTriggerRef = useRef<HTMLButtonElement>(null);

  const reducedMotion = useSettingsStore((state) => state.reducedMotion);
  const reducedEffects = useSettingsStore((state) => state.reducedEffects);
  const audioEnabled = useSettingsStore((state) => state.audioEnabled);
  const highContrast = useSettingsStore((state) => state.highContrast);
  const textScale = useSettingsStore((state) => state.textScale);
  const readerTheme = useSettingsStore((state) => state.readerTheme);
  const showMiniMap = useSettingsStore((state) => state.showMiniMap);
  const showCompass = useSettingsStore((state) => state.showCompass);
  const showContextualGuidance = useSettingsStore((state) => state.showContextualGuidance);
  const mobileControlMode = useSettingsStore((state) => state.mobileControlMode);
  const mobileControlSide = useSettingsStore((state) => state.mobileControlSide);
  const mobileLookSensitivity = useSettingsStore((state) => state.mobileLookSensitivity);
  const mobileHaptics = useSettingsStore((state) => state.mobileHaptics && !state.reducedEffects);
  const setSetting = useSettingsStore((state) => state.setSetting);

  const initializeJourney = useJourneyStore((state) => state.initializeJourney);
  const activeEntryId = useJourneyStore((state) => state.activeEntryId);
  const history = useJourneyStore((state) => state.history);
  const visitedEntryIds = useJourneyStore((state) => state.visitedEntryIds);
  const bookmarkedEntryIds = useJourneyStore((state) => state.bookmarkedEntryIds);
  const lastSafeEntryId = useJourneyStore((state) => state.lastSafeEntryId);
  const journeyUpdatedAt = useJourneyStore((state) => state.updatedAt);
  const sceneRelocationRevision = useJourneyStore((state) => state.sceneRelocationRevision);
  const narrativeWorldState = useJourneyStore((state) => state.narrativeWorldState);
  const storyChapterId = useJourneyStore((state) => state.chapterId);
  const storySceneId = useJourneyStore((state) => state.sceneId);
  const storyBeatId = useJourneyStore((state) => state.beatId);
  const completedRitualIds = useJourneyStore((state) => state.completedRitualIds);
  const completedChapterIds = useJourneyStore((state) => state.completedChapterIds);
  const completedSceneIds = useJourneyStore((state) => state.completedSceneIds);
  const witnessedEntryIds = useJourneyStore((state) => state.witnessedEntryIds);
  const landmarkStates = useJourneyStore((state) => state.landmarkStates);
  const completedActs = useJourneyStore((state) => state.completedActs);
  const journeyInventory = useJourneyStore((state) => state.inventory);
  const worldFlags = useJourneyStore((state) => state.worldFlags);
  const resonances = useJourneyStore((state) => state.resonances);
  const releasedWords = useJourneyStore((state) => state.releasedWords);
  const storyStarted = useJourneyStore((state) => state.storyStarted);
  const storyCompleted = useJourneyStore((state) => state.storyCompleted);
  const journeyInitialized = useJourneyStore((state) => state.isInitialized);
  const toggleBookmark = useJourneyStore((state) => state.toggleBookmark);
  const setSafePosition = useJourneyStore((state) => state.setSafePosition);

  const cloudJourney = useCloudJourneySync();

  const persistedExperienceMode = resolveSlipperExperienceMode({
    storyStarted,
    storyCompleted,
    dedicationAcknowledged,
  });
  const experienceMode = persistedExperienceMode === "free-woods"
    ? persistedExperienceMode
    : sessionJourneyMode ?? persistedExperienceMode;
  const experienceCapabilities = getSlipperExperienceCapabilities(experienceMode);
  const startState = resolveSlipperStartState({ storyStarted, storyCompleted });

  const mode = useWorldStore((state) => state.mode) as AppMode;
  const previousViewRef = useRef(mode);
  const controls = useWorldStore((state) => state.controls) as StorySceneControls;
  const sceneProximity = useWorldStore((state) => state.sceneProximity);
  const setMode = useWorldStore((state) => state.setMode);
  const toggleControls = useWorldStore((state) => state.toggleControls);
  const setControls = useWorldStore((state) => state.setControls);
  const setSceneProximity = useWorldStore((state) => state.setSceneProximity);
  const setWorldNarrativeState = useWorldStore((state) => state.setNarrativeWorldState);
  const enterTextJourney = useCallback(() => {
    if (document.pointerLockElement) document.exitPointerLock?.();
    resetPlayerInput();
    setAccessibleJourney(true);
    setArchiveOpen(false);
    setStoryTransitionPhase("idle");
    setMode("explore");
    window.history.replaceState(window.history.state, "", textJourneyUrl());
  }, [setMode]);

  useEffect(() => {
    window.addEventListener(TEXT_JOURNEY_REQUEST_EVENT, enterTextJourney);
    return () => window.removeEventListener(TEXT_JOURNEY_REQUEST_EVENT, enterTextJourney);
  }, [enterTextJourney]);
  const handleSceneProximityChange = useCallback((next: SceneProximityState) => {
    const previous = previousPlayerPositionRef.current;
    const current = next.playerPosition;
    if (!previous) {
      previousPlayerPositionRef.current = [...current] as Vector3Tuple;
    } else if (Math.hypot(current[0] - previous[0], current[2] - previous[2]) > 0.08) {
      previousPlayerPositionRef.current = [...current] as Vector3Tuple;
      lastActivityAtRef.current = performance.now();
      setIdleMs(0);
      setShowMovementHint(false);
    }
    setSceneProximity(next);
  }, [setSceneProximity]);
  const prologueResolved =
    completedChapterIds.includes("broken-floor") ||
    completedRitualIds.includes("ritual.accept-lantern") ||
    journeyInventory.lantern;

  useEffect(() => {
    if (!FIRST_ENTRY_ID) return;
    initializeJourney({
      fallbackEntryId: FIRST_ENTRY_ID,
      validEntryIds: VALID_ENTRY_IDS,
      legacySnapshot: legacyJourney,
    });
  }, [initializeJourney, legacyJourney]);

  useEffect(() => {
    return subscribeGiftDedicationAcknowledgement(setDedicationAcknowledged);
  }, []);


  useEffect(() => {
    if (storySceneId !== "epilogue.constellation" || !experienceStarted) {
      setFinalConstellationRevealed(false);
    }
  }, [experienceStarted, storySceneId]);

  const handleFinalConstellationFormationComplete = useCallback(() => {
    if (useJourneyStore.getState().sceneId !== "epilogue.constellation") return;
    setFinalConstellationRevealed(true);
  }, []);

  useEffect(() => {
    const resetActivity = () => {
      lastActivityAtRef.current = performance.now();
      setIdleMs(0);
    };
    window.addEventListener("keydown", resetActivity, { passive: true });
    window.addEventListener("pointerdown", resetActivity, { passive: true });
    const interval = window.setInterval(() => {
      setIdleMs(Math.max(0, performance.now() - lastActivityAtRef.current));
    }, 1_000);
    return () => {
      window.removeEventListener("keydown", resetActivity);
      window.removeEventListener("pointerdown", resetActivity);
      window.clearInterval(interval);
    };
  }, []);

  useEffect(() => {
    const handlePopState = () => {
      const isArchiveRoute = experienceCapabilities.allowFullArchive && window.location.pathname.startsWith("/archive");
      setArchiveOpen(isArchiveRoute);
    };
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, [experienceCapabilities.allowFullArchive]);

  useEffect(() => {
    const root = document.documentElement;
    root.dataset.motion = reducedMotion ? "reduced" : "full";
    root.dataset.effects = reducedEffects ? "reduced" : "full";
    root.dataset.contrast = highContrast ? "high" : "standard";
    return () => {
      delete root.dataset.motion;
      delete root.dataset.effects;
      delete root.dataset.contrast;
    };
  }, [highContrast, reducedEffects, reducedMotion]);

  useEffect(() => {
    const root = document.documentElement;
    const safeTextScale = Math.max(0.9, Math.min(1.35, textScale));
    const readerScaleProperties = {
      "--reader-scale": `${safeTextScale}`,
      "--reader-text-min": `${(1.04 * safeTextScale).toFixed(3)}rem`,
      "--reader-text-fluid": `${(1.7 * safeTextScale).toFixed(3)}vw`,
      "--reader-text-max": `${(1.22 * safeTextScale).toFixed(3)}rem`,
      "--reader-mobile-text-size": `${(1.05 * safeTextScale).toFixed(3)}rem`,
      "--archive-reader-text-min": `${(1.05 * safeTextScale).toFixed(3)}rem`,
      "--archive-reader-text-fluid": `${(2.4 * safeTextScale).toFixed(3)}vw`,
      "--archive-reader-text-max": `${(1.25 * safeTextScale).toFixed(3)}rem`,
    };

    for (const [property, value] of Object.entries(readerScaleProperties)) {
      root.style.setProperty(property, value);
    }

    return () => {
      for (const property of Object.keys(readerScaleProperties)) {
        root.style.removeProperty(property);
      }
    };
  }, [textScale]);

  useEffect(() => {
    setWorldNarrativeState(narrativeWorldState);
  }, [narrativeWorldState, setWorldNarrativeState]);

  const activeEntry = useMemo(() => getEntryById(entries, activeEntryId) ?? entries[0], [activeEntryId]);
  const resolvedActiveEntryId = activeEntry?.id ?? FIRST_ENTRY_ID;
  const storyLocation = useMemo(
    () => selectStoryLocation({ activeEntryId: resolvedActiveEntryId, beatId: storyBeatId }),
    [resolvedActiveEntryId, storyBeatId],
  );
  const activeJourneyChapter = storyLocation.chapter;
  const activeNarrativeScene = storyLocation.scene;
  const transitionAllowsProse = storyTransitionAllowsProse(
    storyTransitionPhase,
  );
  const transitionAllowsAction = storyTransitionAllowsAction(
    storyTransitionPhase,
  );
  const returnToContinuation = useCallback(() => {
    if (document.pointerLockElement) document.exitPointerLock?.();
    resetPlayerInput();
    setArchiveOpen(false); setExperienceStarted(false);
  }, []);
  const runtimeHost = useStoryRuntimeShell({
    ready: journeyInitialized && cloudJourney.bootstrapReady,
    participating: experienceStarted,
    overlayOpen: archiveOpen,
    allowActions: accessibleJourney || transitionAllowsAction,
    onMessage: setGuidanceStatus,
    onAuthorizationLost: returnToContinuation,
  });
  const transitionSuppressesAudio = storyTransitionSuppressesAudio(
    storyTransitionPhase,
  );
  const finalConstellationRevealState =
    storySceneId === "epilogue.constellation" && experienceStarted
      ? finalConstellationRevealed
        ? "complete"
        : "forming"
      : "hidden";
  const currentChapterEntries = useMemo(
    () =>
      (activeJourneyChapter?.entryIds ?? [])
        .map((entryId) => getEntryById(entries, entryId))
        .filter((entry): entry is Slipper3DEntry => Boolean(entry)),
    [activeJourneyChapter],
  );
  const currentChapterIndex = currentChapterEntries.findIndex(
    (entry) => entry.id === resolvedActiveEntryId,
  );
  const currentChapterProgress = currentChapterIndex >= 0 ? currentChapterIndex + 1 : 0;
  const initialPlayerPosition = useMemo(() => {
    const journey = useJourneyStore.getState();
    return journey.lastSafeEntryId === resolvedActiveEntryId
      ? journey.playerPosition
      : null;
  }, [journeyUpdatedAt, resolvedActiveEntryId, sceneRelocationRevision, sceneResetNonce]);

  useEffect(() => {
    if (!sceneProximity?.insideClearing || !resolvedActiveEntryId) return;
    const position = sceneProximity.playerPosition;
    const timeout = window.setTimeout(() => {
      setSafePosition({ entryId: resolvedActiveEntryId, position });
    }, 650);
    return () => window.clearTimeout(timeout);
  }, [resolvedActiveEntryId, sceneProximity?.insideClearing, sceneProximity?.playerPosition, setSafePosition]);

  const activePortals = useMemo(() => (activeEntry ? getScenePortals(activeEntry, entries) : []), [activeEntry]);
  const nextEntry = useMemo(() => (activeEntry ? getNextEntry(entries, activeEntry.id) : undefined), [activeEntry]);
  const adjacency = useMemo(
    () => (activeEntry ? getEntryAdjacency(entries, activeEntry.id) : undefined),
    [activeEntry],
  );
  const chapterProgress = useMemo(() => {
    const visited = new Set(visitedEntryIds);
    return journeyChapters.map((chapter) => ({
      id: chapter.id,
      chapter: chapter.title,
      total: chapter.entryIds.length,
      visited: chapter.entryIds.filter((entryId) => visited.has(entryId)).length,
    }));
  }, [visitedEntryIds]);
  const activeVisual = useMemo(
    () => visuals.find((visual) => visual.id === activeEntry?.engine3d.linkedVisualId),
    [activeEntry],
  );
  const storyWorldMemory = useMemo<WorldMemoryState>(
    () => ({
      chapterId: storyChapterId,
      sceneId: storySceneId,
      completedRitualIds,
      completedActs,
      completedChapterIds,
      completedSceneIds,
      landmarkStates,
      inventory: journeyInventory,
      worldFlags,
      resonances,
      releasedWords,
      storyStarted,
      storyCompleted,
    }),
    [
      completedActs,
      completedChapterIds,
      completedRitualIds,
      completedSceneIds,
      journeyInventory,
      landmarkStates,
      releasedWords,
      resonances,
      storyCompleted,
      storyChapterId,
      storySceneId,
      storyStarted,
      worldFlags,
    ],
  );
  const lockedJourneyEntryIds = useMemo(
    () =>
      entries
        .filter(
          (candidate) =>
            !canEnterJourneyEntry(candidate.id, resolvedActiveEntryId, {
              activeEntryId: resolvedActiveEntryId,
              witnessedEntryIds,
              completedRitualIds,
              worldFlags,
              completedActs,
              inventory: journeyInventory,
              completedChapterIds,
              completedSceneIds,
              storyStarted,
              storyCompleted,
              visitedEntryIds,
            }),
        )
        .map((candidate) => candidate.id),
    [
      completedActs,
      completedChapterIds,
      completedRitualIds,
      completedSceneIds,
      journeyInventory,
      resolvedActiveEntryId,
      storyCompleted,
      storyStarted,
      visitedEntryIds,
      witnessedEntryIds,
      worldFlags,
    ],
  );

  const visitedSet = useMemo(() => new Set(visitedEntryIds), [visitedEntryIds]);
  const orderedEntries = useMemo(() => getOrderedEntries(entries), []);
  const nextUnreadEntry = useMemo(() => {
    const chapterCandidate = currentChapterEntries.find((candidate) => !visitedSet.has(candidate.id));
    return chapterCandidate ?? orderedEntries.find((candidate) => !visitedSet.has(candidate.id));
  }, [currentChapterEntries, orderedEntries, visitedSet]);
  const authoredJourneyTarget = useMemo(() => {
    const targetId = nextRequiredEntry({
      activeEntryId: resolvedActiveEntryId,
      witnessedEntryIds,
      completedRitualIds,
      worldFlags,
      inventory: journeyInventory,
      completedActs,
      completedChapterIds,
      completedSceneIds,
      storyStarted,
      storyCompleted,
    });
    return targetId ? getEntryById(entries, targetId) : undefined;
  }, [
    completedActs,
    completedChapterIds,
    completedRitualIds,
    completedSceneIds,
    journeyInventory,
    resolvedActiveEntryId,
    storyCompleted,
    storyStarted,
    witnessedEntryIds,
    worldFlags,
  ]);
  const canContinueAuthoredStory = Boolean(
    authoredJourneyTarget &&
      authoredJourneyTarget.id !== resolvedActiveEntryId &&
      canEnterJourneyEntry(
        authoredJourneyTarget.id,
        resolvedActiveEntryId,
        useJourneyStore.getState(),
      ),
  );
  const guidedTargetEntry = guidanceEntryId
    ? getEntryById(entries, guidanceEntryId)
    : authoredJourneyTarget ?? nextUnreadEntry ?? adjacency?.next ?? nextEntry;
  const storyGuidance = useMemo(
    () => resolveStoryGuidance({
      idleMs,
      guidanceDelayMs: activeNarrativeScene?.pacing.guidanceDelayMs,
      guidanceLines: activeNarrativeScene?.presentation.guidanceLines,
      assistanceEnabled: showContextualGuidance,
      suppressed:
        storyTransitionPhase !== "idle" ||
        storySceneId === "river.release-surrender" ||
        mode !== "explore",
    }),
    [activeNarrativeScene, idleMs, mode, showContextualGuidance, storySceneId, storyTransitionPhase],
  );
  const worldNavigationTargetEntryId = guidanceEntryId ?? (
    (storyGuidance.allowDirectionalCue || (experienceMode !== "free-woods" && canContinueAuthoredStory && storyTransitionPhase === "idle" && prologueResolved)) ? authoredJourneyTarget?.id ?? null : null
  );

  const recentBreadcrumbs = useMemo(
    () =>
      history
        .slice(-4)
        .map((entryId) => getEntryById(entries, entryId))
        .filter(Boolean) as Slipper3DEntry[],
    [history],
  );
  const mobileJourneyHistory = useMemo(
    () =>
      Array.from(new Set([...history].reverse()))
        .slice(0, 8)
        .map((entryId) => getEntryById(entries, entryId))
        .filter((entry): entry is Slipper3DEntry => Boolean(entry))
        .map((entry) => ({ id: entry.id, title: entry.title })),
    [history],
  );

  const {
    navigateToEntry, openArchive, enterForest, leaveForest, requestGuidance,
    openRememberedEntry, handlePortalSelect, handleMapSelectEntry,
    returnToLastClearing, returnToChapterPath, continueToNext,
    continueAuthoredStory, moveToPrevious, readActiveEntry,
  } = useStoryNavigation({
    host: runtimeHost, accessibleJourney, audioEnabled, capabilities: experienceCapabilities,
    experienceStarted, archiveOpen, prologueResolved, guidanceEntryId,
    setGuidanceEntryId, setGuidanceStatus, setArchiveOpen, setExperienceStarted,
    setSessionJourneyMode, setSceneResetNonce,
    requestReaderFocus: () => setReaderFocusNonce(value => value + 1),
  });

  const visitedCount = visitedEntryIds.length;
  const totalCount = entries.length;
  const canReadActiveEntry = canReadStoryEntry(resolvedActiveEntryId, { witnessedEntryIds });
  const paragraphs = canReadActiveEntry ? entryParagraphs(activeEntry) : [];
  const isBookmarked = bookmarkedEntryIds.includes(resolvedActiveEntryId);
  useEffect(() => {
    setReaderProgress(0);
    readerRef.current?.scrollTo({ top: 0, behavior: reducedMotion ? "auto" : "smooth" });
  }, [mode, reducedMotion, resolvedActiveEntryId]);

  useEffect(() => {
    if (mode === "read") {
      const focusTimer = window.setTimeout(() => readerRef.current?.focus(), 0);
      return () => window.clearTimeout(focusTimer);
    }
    return undefined;
  }, [mode, reducedMotion, resolvedActiveEntryId, readerFocusNonce]);

  useEffect(() => {
    const previous = previousViewRef.current;
    previousViewRef.current = mode;
    if (previous === mode || !experienceStarted || archiveOpen || accessibleJourney) return;
    const target = mode === "map" ? mapWorkspaceRef
      : mode === "explore" && (previous === "read" || previous === "map")
        ? { current: constellationTriggerRef.current ?? forestRef.current } : null;
    if (!target) return;
    const timer = window.setTimeout(() => target.current?.focus({ preventScroll: true }), 0);
    return () => window.clearTimeout(timer);
  }, [mode, experienceStarted, archiveOpen, accessibleJourney]);

  const updateReaderProgress = useCallback(() => {
    const element = readerRef.current;
    if (!element) return;
    const maximum = Math.max(1, element.scrollHeight - element.clientHeight);
    setReaderProgress(Math.max(0, Math.min(100, Math.round((element.scrollTop / maximum) * 100))));
  }, []);
  const hasDiagnosticsWarning =
    contentDiagnostics.entriesMissingParagraphs.length > 0 ||
    contentDiagnostics.duplicateEntryIds.length > 0 ||
    contentDiagnostics.duplicateVisualIds.length > 0;
  const isWalkingForest = mode === "explore" && controls === "walk";
  const floatingUiOpacity = isWalkingForest ? Math.max(0.06, Math.min(1, sceneProximity?.uiPresence ?? 1)) : 1;
  const floatingUiStyle = {
    opacity: floatingUiOpacity,
    pointerEvents: floatingUiOpacity > 0.35 ? "auto" : "none",
    transition: "opacity 700ms ease",
  } as const;
  const softUiStyle = {
    opacity: isWalkingForest ? Math.max(0.12, Math.min(0.92, (sceneProximity?.uiPresence ?? 1) * 0.82)) : 1,
    pointerEvents: isWalkingForest && (sceneProximity?.uiPresence ?? 1) < 0.3 ? "none" : "auto",
    transition: "opacity 700ms ease",
  } as const;

  const shellClasses = [
    "app-shell",
    `app-mode-${mode}`,
    highContrast ? "is-high-contrast" : "",
    reducedMotion ? "is-reduced-motion" : "",
    reducedEffects ? "is-reduced-effects" : "",
    `reader-theme-${readerTheme}`,
    isWalkingForest ? "is-walking-forest" : "",
    mobileViewport.isMobile ? "is-mobile-experience" : "",
    mobileViewport.isPortrait ? "is-mobile-portrait" : "is-mobile-landscape",
    prologueResolved ? "is-prologue-resolved" : "is-prologue-unresolved",
    `is-${experienceMode}`,
    storyCompleted && storySceneId === "epilogue.constellation" ? "is-returned-self" : "",
  ]
    .filter(Boolean)
    .join(" ");

  if (archiveOpen && experienceCapabilities.allowFullArchive) {
    return (
      <AccessibleArchive
        entries={entries}
        activeEntryId={resolvedActiveEntryId}
        visitedEntryIds={visitedEntryIds}
        witnessedEntryIds={witnessedEntryIds}
        bookmarkedEntryIds={bookmarkedEntryIds}
        onOpenEntry={(entryId) => openRememberedEntry(entryId, "read")}
        onGuideEntry={requestGuidance}
        onEnterForest={enterForest}
        onOpenSettings={requestExperienceSettingsOpen}
        textJourneyAvailable={accessibleJourney}
        canGuideEntry={(entryId) =>
          canEnterJourneyEntry(entryId, resolvedActiveEntryId, useJourneyStore.getState())
        }
      />
    );
  }

  if (!experienceStarted) {
    return (
      <OnboardingGate
        onBegin={enterForest}
        onOpenSettings={requestExperienceSettingsOpen}
        startState={startState}
        restoring={!journeyInitialized || !cloudJourney.bootstrapReady}
      />
    );
  }

  if (accessibleJourney) {
    return (
      <>
        <AccessibleStoryJourney
          entries={entries}
          activeEntryId={resolvedActiveEntryId}
          experienceMode={experienceMode}
          onOpenArchive={openArchive}
          onOpenSettings={requestExperienceSettingsOpen}
          onReturnToThreshold={leaveForest}
          onFinalConstellationFormationComplete={
            handleFinalConstellationFormationComplete
          }
        />
        {!dedicationAcknowledged ? (
          <GiftDedication
            storyCompleted={storyCompleted}
            inWorldConstellationRevealed={finalConstellationRevealed}
            transitionIdle
            onReturnToWoods={() => setDedicationAcknowledged(true)}
          />
        ) : null}
      </>
    );
  }

  return (
    <RenderRecoveryBoundary onContinueTextJourney={enterTextJourney}>
    <main
      ref={forestRef}
      tabIndex={-1}
      id="primary-experience"
      data-experience-root
      data-active-entry={resolvedActiveEntryId}
      data-guidance-target={guidanceEntryId ?? ""}
      data-player-x={sceneProximity?.playerPosition[0] ?? ""}
      data-player-y={sceneProximity?.playerPosition[1] ?? ""}
      data-player-z={sceneProximity?.playerPosition[2] ?? ""}
      data-camera-yaw={sceneProximity?.cameraYaw ?? ""}
      data-world-mode={mode}
      data-world-controls={controls}
      data-experience-mode={experienceMode}
      data-story-guidance-level={storyGuidance.level}
      data-constellation-reveal={finalConstellationRevealState}
      data-story-transition={storyTransitionPhase}
      data-story-prose={transitionAllowsProse ? "available" : "suppressed"}
      data-story-actions={transitionAllowsAction ? "available" : "suppressed"}
      data-narrative-audio={transitionSuppressesAudio ? "suppressed" : "available"}
      data-prologue-resolved={prologueResolved ? "true" : "false"}
      className={shellClasses}
    >
      {prologueResolved ? <a className="skip-link" href="#story-navigation">Skip to story navigation</a> : null}
      {experienceMode === "free-woods" ? <MagicLinkSignIn /> : null}

      {!prologueResolved && showContextualGuidance ? (
        <section
          className="broken-floor-prologue"
          aria-label="The Broken Floor"
          aria-live="polite"
        >
          <div className="broken-floor-prologue-lines">
            <p>“I’m so so broken”</p>
            <p>How is it possible to be so sorrowful and so numb at the same time.</p>
            <p>A silent cry A roaring river with rapids of nothingness.</p>
          </div>
          <span>Look into the reflection. The light is waiting.</span>
        </section>
      ) : null}

      {mode !== "map" ? (
        <Suspense fallback={<div className="forest-loader" role="status">Drawing the nearby wood…</div>}>
          <WorldCanvas
            key={`continuous-world:${sceneRelocationRevision}:${sceneResetNonce}`}
            entryId={resolvedActiveEntryId}
            entries={entries}
            visuals={visuals}
            visitedEntryIds={visitedEntryIds}
            initialPlayerPosition={initialPlayerPosition}
            navigationTargetEntryId={worldNavigationTargetEntryId}
            onPortalSelect={handlePortalSelect}
            onMapSelectEntry={handleMapSelectEntry}
            controls={controls}
            mode={mode}
            narrativeWorldState={narrativeWorldState}
            storyWorldMemory={storyWorldMemory}
            lockedEntryIds={lockedJourneyEntryIds}
            narrativeAudioSuppressed={transitionSuppressesAudio}
            onFinalConstellationFormationComplete={
              handleFinalConstellationFormationComplete
            }
            onPlayerProximityChange={handleSceneProximityChange}
            onContinueTextJourney={enterTextJourney}
          />
        </Suspense>
      ) : null}

      <StoryTransitionDirector
        chapter={activeJourneyChapter}
        scene={activeNarrativeScene}
        sceneCompleted={Boolean(
          activeNarrativeScene && completedSceneIds.includes(activeNarrativeScene.id)
        )}
        reducedMotion={reducedMotion}
        suppressed={mode !== "explore" || activeNarrativeScene?.id === "broken-floor.confession"}
        onPhaseChange={setStoryTransitionPhase}
      />

      <JourneyDirector
        activeEntryId={resolvedActiveEntryId}
        mode={mode}
        controls={controls}
        proximity={sceneProximity}
        reducedMotion={reducedMotion}
        suppressed={!transitionAllowsAction}
        onJourneyMessage={setGuidanceStatus}
      />

      {experienceMode !== "free-woods" && activeNarrativeScene && prologueResolved ? (
        <GuidedStoryMoment
          sceneId={activeNarrativeScene.id}
          active={mode === "explore" && storyTransitionPhase === "idle"}
          canRead={witnessedEntryIds.includes(resolvedActiveEntryId)}
          canFollow={canContinueAuthoredStory}
          onRead={readActiveEntry}
          onFollow={() => requestGuidance(authoredJourneyTarget?.id)}
        />
      ) : null}

      <DiegeticProseDirector
        entry={activeEntry}
        scene={activeNarrativeScene}
        witnessed={witnessedEntryIds.includes(resolvedActiveEntryId)}
        active={
          mode === "explore" &&
          experienceMode === "free-woods" &&
          showContextualGuidance &&
          transitionAllowsProse &&
          Boolean(sceneProximity?.insideClearing)
        }
        suppressed={storySceneId === "river.release-surrender"}
        onOpenReader={readActiveEntry}
      />

      {prologueResolved && mode === "explore" ? (
        <>
          {experienceMode === "free-woods" && showMiniMap ? <MiniMapHUD entries={entries} activeEntryId={resolvedActiveEntryId} sceneProximity={sceneProximity} /> : null}
          {showContextualGuidance ? <ContextualNavigationPrompt sceneProximity={sceneProximity} /> : null}
        </>
      ) : null}

      {prologueResolved && mobileViewport.isMobile && mode === "explore" && controls === "walk" ? (
        <MobileExploreControls
          mode={experienceMode === "free-woods" ? mobileControlMode : "direct"}
          freeWoods={experienceMode === "free-woods"}
          contemplativeIdle={experienceMode !== "free-woods" && idleMs > 6_500}
          controlSide={mobileControlSide}
          lookSensitivity={mobileLookSensitivity}
          hapticsEnabled={mobileHaptics}
          reducedEffects={reducedEffects}
          guidedTargetTitle={guidedTargetEntry?.title}
          guidanceActive={Boolean(guidanceEntryId)}
          canGoBack={history.length > 0 || Boolean(adjacency?.previous)}
          canGoNext={Boolean(nextEntry)}
          canFindUnread={Boolean(nextUnreadEntry)}
          canReturnToChapterPath={Boolean(currentChapterEntries.length || adjacency?.next)}
          journeyHistory={mobileJourneyHistory}
          onModeChange={(nextMode) => setSetting("mobileControlMode", nextMode)}
          onRead={readActiveEntry}
          onMap={() => {
            setMobileMapPane("constellation");
            setMode("map");
          }}
          onArchive={openArchive}
          onReturnToVisitedEntry={(entryId) => openRememberedEntry(entryId, "explore")}
          onBack={moveToPrevious}
          onNext={() => requestGuidance(nextEntry?.id)}
          onLastClearing={returnToLastClearing}
          onChapterPath={returnToChapterPath}
          onFindUnread={() => requestGuidance(nextUnreadEntry?.id)}
          onGuidedMove={() => requestGuidance(guidedTargetEntry?.id)}
          onCancelGuidance={() => {
            setGuidanceEntryId(null);
            setGuidanceStatus("Lantern guidance cancelled.");
          }}
          onOpenSettings={requestExperienceSettingsOpen}
          onLeaveForest={leaveForest}
        />
      ) : null}

      <p className="sr-only" role="status" aria-live="polite">{guidanceStatus}</p>

      {experienceMode !== "free-woods" && mode === "explore" && storyTransitionPhase === "idle" && prologueResolved && showMovementHint ? (
        <p className="first-input-hint" data-first-input-hint="movement">
          {mobileViewport.isMobile ? "Move to walk · drag to look" : "WASD / arrows to walk · F to read nearby words"}
        </p>
      ) : null}

      {experienceMode === "free-woods" && prologueResolved ? <section
        id="story-navigation"
        className="story-hud"
        aria-label="Slipper in the Woods navigation"
        tabIndex={-1}
        style={floatingUiStyle}
      >
        <div className="story-hud-copy">
          <p className="story-hud-kicker">Slipper in the Woods / walkable memory archive</p>
          <h2>{activeEntry?.title ?? "Unknown clearing"}</h2>
          <p>
            {activeJourneyChapter?.title ?? activeEntry?.chapter ?? "No chapter"}
            {activeEntry?.engine3d.mood ? ` / ${activeEntry.engine3d.mood}` : ""}
          </p>
          <p className="story-hud-stats">
            {visitedCount}/{totalCount} seen / {contentDiagnostics.visualCount} visuals / {journeyChapters.length} chapters
          </p>
          {guidanceEntryId ? (
            <p className="story-hud-guidance" aria-live="polite">
              Lantern guidance: {getEntryById(entries, guidanceEntryId)?.title ?? "selected clearing"}
            </p>
          ) : null}
        </div>

        <div className="story-mode-switch" role="group" aria-label="Story modes">
          {(["explore", "read", "map"] as AppMode[]).map((candidateMode) => (
            <button
              key={candidateMode}
              type="button"
              className={mode === candidateMode ? "is-active" : ""}
              onClick={() => candidateMode === "read" ? readActiveEntry() : setMode(candidateMode)}
              aria-pressed={mode === candidateMode}
            >
              {modeLabel(candidateMode)}
            </button>
          ))}
        </div>

        <div className="story-hud-actions">
          <button type="button" onClick={moveToPrevious} disabled={history.length === 0 && !adjacency?.previous}>
            Back
          </button>
          <button type="button" onClick={continueToNext} disabled={!nextEntry}>
            Next
          </button>
          <button type="button" onClick={openArchive}>Archive</button>
          <details className="story-hud-more">
            <summary aria-label="More journey actions">More</summary>
            <div
              className="story-hud-overflow"
              role="group"
              aria-label="More journey actions"
              onClick={(event) => event.currentTarget.closest("details")?.removeAttribute("open")}
            >
              <button type="button" onClick={returnToLastClearing}>Last clearing</button>
              <button type="button" onClick={() => requestGuidance(nextUnreadEntry?.id)} disabled={!nextUnreadEntry}>
                Find unread
              </button>
              <button type="button" onClick={returnToChapterPath}>Chapter path</button>
              <button type="button" onClick={requestExperienceSettingsOpen}>Settings</button>
              <button type="button" onClick={leaveForest}>Threshold</button>
              {!mobileViewport.isMobile ? (
                <button type="button" onClick={toggleControls}>
                  {controls === "walk" ? "Orbit" : "Walk"}
                </button>
              ) : null}
            </div>
          </details>
        </div>
      </section> : null}

      {experienceMode === "free-woods" && mode === "explore" && storyGuidance.poeticLine ? (
        <section
          className={`story-guidance story-guidance--level-${storyGuidance.level}`}
          aria-live="polite"
          data-guidance-directional={storyGuidance.allowDirectionalCue ? "true" : "false"}
        >
          <p>{storyGuidance.poeticLine}</p>
          {storyGuidance.allowDirectionalCue && guidedTargetEntry ? (
            <span>Follow the warmer edge of the lantern light.</span>
          ) : null}
        </section>
      ) : null}

      {experienceMode === "free-woods" && mode === "explore" && !isWalkingForest ? (
        <section className="journey-trail" aria-label="Recent remembered trail" style={floatingUiStyle}>
          <span className="journey-trail-label">Trail</span>
          {recentBreadcrumbs.map((entry) => (
            <button key={entry.id} type="button" onClick={() => navigateToEntry(entry.id, "explore")}>
              {shortTitle(entry.title, 18)}
            </button>
          ))}
          <strong>{shortTitle(activeEntry?.title, 24)}</strong>
        </section>
      ) : null}

      {experienceCapabilities.constellationScope === "witnessed-only" && mode === "explore" && prologueResolved && resolvedActiveEntryId !== "fragment-001" && canReadActiveEntry ? (
        <button ref={constellationTriggerRef} className="memory-return first-constellation-access" type="button" onClick={() => setMode("map")}>Constellation</button>
      ) : null}
      {experienceCapabilities.allowConstellationView && mode === "map" ? (
        <section ref={mapWorkspaceRef} tabIndex={-1} className={`map-workspace${experienceCapabilities.constellationScope === "witnessed-only" ? " is-partial-constellation" : ""}`} aria-label="Story map workspace" data-constellation-scope={experienceCapabilities.constellationScope}>
          {experienceCapabilities.constellationScope === "witnessed-only" ? <button className="memory-return" type="button" onClick={() => setMode("explore")}>Return to forest</button> : null}
          {mobileViewport.isMobile && experienceCapabilities.allowFullArchive ? (
            <MapWorkspaceTabs activePane={mobileMapPane} onChange={setMobileMapPane} />
          ) : null}

          <Suspense
            fallback={
              <div className="forest-loader" role="status">
                Charting the remembered clearings…
              </div>
            }
          >
            <ConstellationMap
              scope={experienceCapabilities.constellationScope}
              entries={entries}
              activeEntryId={resolvedActiveEntryId}
              visitedEntryIds={visitedEntryIds}
              sceneProximity={sceneProximity}
              onOpenEntry={experienceCapabilities.allowConstellationNavigation ? (entryId) => openRememberedEntry(entryId, "read") : undefined}
              onGuideEntry={experienceCapabilities.allowConstellationNavigation ? requestGuidance : undefined}
              panelId={
                mobileViewport.isMobile && experienceCapabilities.allowFullArchive
                  ? STORY_MAP_CONSTELLATION_PANEL_ID
                  : undefined
              }
              labelledBy={
                mobileViewport.isMobile && experienceCapabilities.allowFullArchive
                  ? STORY_MAP_CONSTELLATION_TAB_ID
                  : undefined
              }
              hidden={
                mobileViewport.isMobile && experienceCapabilities.allowFullArchive &&
                mobileMapPane !== "constellation"
              }
            />
          </Suspense>

          {experienceCapabilities.allowFullArchive ? <ArchiveIndex
            entries={entries}
            activeEntryId={resolvedActiveEntryId}
            visitedEntryIds={visitedEntryIds}
            onOpenEntry={(entryId) => openRememberedEntry(entryId, "read")}
            onGuideEntry={requestGuidance}
            panelId={mobileViewport.isMobile ? STORY_MAP_ARCHIVE_PANEL_ID : undefined}
            labelledBy={mobileViewport.isMobile ? STORY_MAP_ARCHIVE_TAB_ID : undefined}
            hidden={mobileViewport.isMobile && mobileMapPane !== "archive"}
          /> : null}
        </section>
      ) : null}

      {mode === "read" && canReadActiveEntry ? (
        <section className="reader-panel" id="story-content" aria-label="Focused reading mode">
          <div
            className="reader-panel-inner"
            ref={readerRef}
            role="document"
            aria-labelledby="focused-reader-title"
            tabIndex={-1}
            onScroll={updateReaderProgress}
          >
            {experienceCapabilities.showJourneyMetrics ? (
              <div
                className="reader-progress"
                role="progressbar"
                aria-label="Reading progress"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={readerProgress}
              >
                <i style={{ width: `${readerProgress}%` }} />
              </div>
            ) : null}
            <p className="reader-kicker">
              {experienceCapabilities.showJourneyMetrics
                ? `${activeJourneyChapter?.title ?? activeEntry?.chapter} / ${sceneLabel(activeEntry)} / ${currentChapterProgress || 1} of ${currentChapterEntries.length || 1}`
                : activeNarrativeScene?.title ?? "A remembered fragment"}
            </p>
            <h1 id="focused-reader-title">{activeEntry?.title}</h1>
            <div className="reader-body">
              {paragraphs.map((paragraph, index) => (
                <p key={`${activeEntry?.id}-reader-${index}`}>{paragraph}</p>
              ))}
            </div>
            <div className="reader-footer">
              <button type="button" onClick={() => setMode("explore")}>Return to forest</button>
              {experienceMode !== "free-woods" && canContinueAuthoredStory ? (
                <button type="button" onClick={() => requestGuidance(authoredJourneyTarget?.id)}>Follow the next path</button>
              ) : null}
              <button type="button" onClick={requestExperienceSettingsOpen}>Settings</button>
              {experienceCapabilities.constellationScope === "witnessed-only" ? <button type="button" onClick={() => setMode("map")}>Constellation</button> : null}
              {experienceMode === "free-woods" ? (
                <>
                  <button type="button" aria-pressed={isBookmarked} onClick={() => toggleBookmark(resolvedActiveEntryId)}>
                    {isBookmarked ? "Remove bookmark" : "Bookmark location"}
                  </button>
                  <button type="button" onClick={moveToPrevious} disabled={history.length === 0 && !adjacency?.previous}>Back</button>
                  <button type="button" onClick={continueToNext} disabled={!nextEntry}>Next fragment</button>
                  <button
                    type="button"
                    onClick={continueAuthoredStory}
                    disabled={!canContinueAuthoredStory}
                  >
                    Continue story
                  </button>
                  <button type="button" onClick={() => setMode("map")}>Open map</button>
                  <button type="button" onClick={openArchive}>Open archive</button>
                </>
              ) : null}
            </div>
          </div>
        </section>
      ) : null}

      {experienceMode === "free-woods" && mode === "explore" && !isWalkingForest ? (
        <section className="portal-dock" aria-label="Current clearing and next action" style={floatingUiStyle}>
          <div className="portal-dock-header">
            <div>
              <p>Current memory</p>
              <strong>{shortTitle(activeEntry?.title, 36)}</strong>
            </div>
            <span>{activeVisual?.orientation ?? "procedural"} visual</span>
          </div>
          <div className="portal-dock-list">
            <div className="portal-dock-card is-entry is-visited" aria-live="polite">
              <span className="portal-dock-shortcut">walk</span>
              <span className="portal-dock-copy">
                <small>{sceneProximity?.nearestEntryId === activeEntry?.id ? "clearing active" : "between clearings"}</small>
                <strong>{sceneProximity?.nearestTitle ?? activeEntry?.title ?? "The wood"}</strong>
                <em>Follow the golden thread or the visible clearing rings. The story wakes when you arrive physically.</em>
              </span>
            </div>
          </div>
        </section>
      ) : null}

      {experienceMode === "free-woods" && mode === "explore" && !isWalkingForest ? (
        <section className="chapter-path" aria-label="Current chapter path" style={floatingUiStyle}>
          <div className="chapter-path-header">
            <span>{activeJourneyChapter?.title ?? activeEntry?.chapter ?? "Chapter"}</span>
            <strong>{currentChapterProgress}/{currentChapterEntries.length}</strong>
          </div>
          <div className="chapter-path-nodes">
            {currentChapterEntries.map((entry, index) => {
              const isActive = entry.id === activeEntry?.id;
              const isVisited = visitedSet.has(entry.id);
              return (
                <button
                  key={entry.id}
                  type="button"
                  className={`${isActive ? "is-active" : ""}${isVisited ? " is-visited" : ""}`}
                  onClick={() => (isVisited ? openRememberedEntry(entry.id, "explore") : requestGuidance(entry.id))}
                  aria-label={isVisited ? `Return to ${entry.title}` : `Guide me to ${entry.title}`}
                  title={`${index + 1}. ${entry.title}`}
                >
                  {index + 1}
                </button>
              );
            })}
          </div>
        </section>
      ) : null}

      {experienceMode === "free-woods" && mode === "explore" && !isWalkingForest ? (
        <section className="chapter-progress" aria-label="Chapter path" style={floatingUiStyle}>
          {chapterProgress.map((chapter) => {
            const percentage = chapter.total > 0 ? Math.round((chapter.visited / chapter.total) * 100) : 0;
            return (
              <div className="chapter-progress-row" key={chapter.id}>
                <span>{chapter.chapter}</span>
                <strong>{chapter.visited}/{chapter.total}</strong>
                <i style={{ width: `${percentage}%` }} />
              </div>
            );
          })}
        </section>
      ) : null}

      {experienceMode === "free-woods" && mode === "explore" && !isWalkingForest && showCompass ? (
        <section className="scene-compass" aria-label="Scene compass" style={softUiStyle}>
          <span>{sceneLabel(activeEntry)}</span>
          <strong>{controls === "walk" ? "walk mode" : controls === "orbit" ? "drag to look" : "focus locked"}</strong>
          <em>{controls === "walk" ? "click the wood, then walk toward a nearby clearing" : "drag the forest, or choose a nearby clearing below"}</em>
        </section>
      ) : null}

      {hasDiagnosticsWarning ? (
        <section className="content-diagnostics" aria-label="Content diagnostics">
          <strong>Content check</strong>
          {contentDiagnostics.entriesMissingParagraphs.length > 0 ? (
            <span>{contentDiagnostics.entriesMissingParagraphs.length} entries need paragraphs</span>
          ) : null}
          {contentDiagnostics.duplicateEntryIds.length > 0 ? (
            <span>{contentDiagnostics.duplicateEntryIds.length} duplicate entry IDs</span>
          ) : null}
          {contentDiagnostics.duplicateVisualIds.length > 0 ? (
            <span>{contentDiagnostics.duplicateVisualIds.length} duplicate visual IDs</span>
          ) : null}
        </section>
      ) : null}

      {experienceMode === "free-woods" && prologueResolved ? <div className="story-instructions" aria-hidden="true">
        {mode === "explore"
          ? controls === "walk"
            ? mobileViewport.isMobile
              ? `Move with the analogue pad and drag Look to turn. Follow the lantern thread. ${visitedCount}/${totalCount} remembered.`
              : `Click the scene to give the wood your gaze. WASD / arrows move. Follow the lantern thread. F reads. ${visitedCount}/${totalCount} remembered.`
            : `The forest is quiet in orbit mode. Choose Walk to cross physically, F to read, or M for the constellation. ${visitedCount}/${totalCount} remembered.`
          : mode === "read"
            ? "Focused fragment mode. Esc returns to the forest. M opens the constellation."
            : "Constellation mode. Select a node, or Esc to return to the forest."}
      </div> : null}

      {!dedicationAcknowledged ? (
        <GiftDedication
          storyCompleted={storyCompleted}
          inWorldConstellationRevealed={finalConstellationRevealed}
          transitionIdle={storyTransitionPhase === "idle"}
          onReturnToWoods={() => {
            setDedicationAcknowledged(true);
            setMode("explore");
            setControls("walk");
          }}
        />
      ) : null}

    </main>
    </RenderRecoveryBoundary>
  );
}

export default function App() {
  return <StoryRuntimeProvider><ExperienceApplication /></StoryRuntimeProvider>;
}
