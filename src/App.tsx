import GuidedStoryMoment from "./components/ui/GuidedStoryMoment";
import "./ui/MemoryReturn.css";
import { ExperienceMenu } from "./ui/ExperienceMenu";
import { useQuietActivity } from "./ui/useQuietActivity";
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
  witnessedEntryIds,
}: {
  entries: Slipper3DEntry[];
  activeEntryId: string;
  witnessedEntryIds: readonly string[];
  sceneProximity: SceneProximityState | null;
}) {
  const activeEntry = entries.find((entry) => entry.id === activeEntryId);
  const fallbackNearestEntryId = sceneProximity?.nearestEntryId && sceneProximity.nearestEntryId !== activeEntryId ? sceneProximity.nearestEntryId : null;
  const approachingEntryId = sceneProximity?.navigationTargetId ?? sceneProximity?.approachingEntryId ?? fallbackNearestEntryId;
  const approachingEntry = approachingEntryId && witnessedEntryIds.includes(approachingEntryId)
    ? entries.find((entry) => entry.id === approachingEntryId) : undefined;
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
  const [memoriesOpen, setMemoriesOpen] = useState(false);
  const [detailRequested, setDetailRequested] = useState<boolean | null>(null);
  const drawerOpen = useSettingsStore(state => state.drawerOpen);
  const { idleMs, noteActivity } = useQuietActivity(experienceStarted, archiveOpen || memoriesOpen || drawerOpen);
  const quietGuidanceActivity = useMemo(() => ({ idleMs, detailRequested }), [idleMs, detailRequested]);
  const priorMenuPhysics = useRef<boolean | null>(null);
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
    setMemoriesOpen(false);
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
      noteActivity();
    }
    setSceneProximity(next);
  }, [setSceneProximity, noteActivity]);
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

  useEffect(() => { setDetailRequested(null); noteActivity(); }, [storySceneId, noteActivity]);
  useEffect(() => () => {
    if (priorMenuPhysics.current !== null) useWorldStore.getState().setPhysicsPaused(priorMenuPhysics.current);
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
    setArchiveOpen(false); setMemoriesOpen(false); setExperienceStarted(false);
  }, []);
  const runtimeHost = useStoryRuntimeShell({
    ready: journeyInitialized && cloudJourney.bootstrapReady,
    participating: experienceStarted,
    overlayOpen: archiveOpen || memoriesOpen,
    allowActions: accessibleJourney || transitionAllowsAction,
    onMessage: setGuidanceStatus,
    onAuthorizationLost: returnToContinuation,
  });
  const changeMemories = useCallback((open: boolean) => {
    const world = useWorldStore.getState();
    if (open) {
      if (document.pointerLockElement) document.exitPointerLock?.();
      resetPlayerInput();
      if (priorMenuPhysics.current === null) priorMenuPhysics.current = world.physicsPaused;
      world.setPhysicsPaused(true);
    } else if (priorMenuPhysics.current !== null) {
      world.setPhysicsPaused(priorMenuPhysics.current); priorMenuPhysics.current = null;
    }
    // Admission changes at the input edge, before a possible delayed React commit.
    runtimeHost?.configure({ ready: journeyInitialized && cloudJourney.bootstrapReady,
      participating: experienceStarted, overlayOpen: archiveOpen || open,
      allowActions: accessibleJourney || transitionAllowsAction,
      onMessage: setGuidanceStatus, onAuthorizationLost: returnToContinuation });
    noteActivity(); setMemoriesOpen(open);
  }, [runtimeHost, journeyInitialized, cloudJourney.bootstrapReady, experienceStarted,
      archiveOpen, accessibleJourney, transitionAllowsAction, returnToContinuation, noteActivity]);
  useEffect(() => { if (drawerOpen && memoriesOpen) changeMemories(false); }, [drawerOpen, memoriesOpen, changeMemories]);
  useEffect(() => {
    if (!experienceStarted || archiveOpen || accessibleJourney) {
      if (priorMenuPhysics.current !== null) {
        useWorldStore.getState().setPhysicsPaused(priorMenuPhysics.current); priorMenuPhysics.current = null;
      }
      setMemoriesOpen(false);
    }
  }, [experienceStarted, archiveOpen, accessibleJourney]);
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
      revealed: chapter.entryIds.some(entryId => witnessedEntryIds.includes(entryId)),
      visited: chapter.entryIds.filter((entryId) => visited.has(entryId)).length,
    }));
  }, [visitedEntryIds, witnessedEntryIds]);
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
    experienceStarted, archiveOpen: archiveOpen || memoriesOpen, prologueResolved, guidanceEntryId,
    setGuidanceEntryId, setGuidanceStatus, setArchiveOpen, setExperienceStarted,
    setSessionJourneyMode, setSceneResetNonce,
    requestReaderFocus: () => setReaderFocusNonce(value => value + 1),
  });

  const menuProximity = useMemo(() => {
    if (!sceneProximity) return null;
    const title = (id?: string | null) => id && witnessedEntryIds.includes(id)
      ? getEntryById(entries, id)?.title ?? "A remembered clearing" : "Unread memory";
    return { ...sceneProximity, nearestTitle: title(sceneProximity.nearestEntryId),
      approachingTitle: title(sceneProximity.approachingEntryId),
      navigationTargetTitle: title(sceneProximity.navigationTargetId) };
  }, [sceneProximity, witnessedEntryIds]);
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
    if (previous === mode || !experienceStarted || archiveOpen || memoriesOpen || accessibleJourney) return;
    const target = mode === "map" ? mapWorkspaceRef
      : mode === "explore" && (previous === "read" || previous === "map")
        ? { current: constellationTriggerRef.current ?? forestRef.current } : null;
    if (!target) return;
    const timer = window.setTimeout(() => target.current?.focus({ preventScroll: true }), 0);
    return () => window.clearTimeout(timer);
  }, [mode, experienceStarted, archiveOpen, memoriesOpen, accessibleJourney]);

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
      data-quiet-memories="true"
      data-memories-open={memoriesOpen ? "true" : "false"}
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
      <a className="skip-link" href="#experience-memories-trigger">Skip to memories</a>

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
            quietGuidanceActivity={quietGuidanceActivity}
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

      {activeNarrativeScene && prologueResolved ? (
        <GuidedStoryMoment
          sceneId={activeNarrativeScene.id}
          active={mode === "explore" && !memoriesOpen && storyTransitionPhase === "idle"}
          idleMs={idleMs}
          detailRequested={detailRequested}
          onDetailRequestedChange={setDetailRequested}
          onQuietFocusRequest={() => constellationTriggerRef.current?.focus({ preventScroll: true })}
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

      {prologueResolved && mobileViewport.isMobile && mode === "explore" && controls === "walk" ? (
        <MobileExploreControls
          mode={experienceMode === "free-woods" ? mobileControlMode : "direct"}
          freeWoods={experienceMode === "free-woods"}
          quietShell
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

      <ExperienceMenu
        open={memoriesOpen} onOpenChange={changeMemories} triggerRef={constellationTriggerRef}
        capabilities={experienceCapabilities} fragmentAvailable={canReadActiveEntry}
        constellationAvailable={witnessedEntryIds.length > 0}
        onFragment={() => {
          const state = useJourneyStore.getState();
          // Deliberate overlay navigation uses the existing bounded host port.
          return state.witnessedEntryIds.includes(state.activeEntryId) && navigateToEntry(state.activeEntryId, "read");
        }}
        onConstellation={() => { setMobileMapPane("constellation"); setMode("map"); }}
        onArchive={openArchive} onSettings={requestExperienceSettingsOpen}
        onHelp={() => {
          setDetailRequested(true);
        }}
        navigationActions={[
          { id: "back", label: "Back", disabled: history.length === 0 && !adjacency?.previous, onSelect: moveToPrevious },
          { id: "next", label: "Next", disabled: !nextEntry, onSelect: continueToNext },
          { id: "last-clearing", label: "Last clearing", onSelect: returnToLastClearing },
          { id: "unread", label: "Find unread", disabled: !nextUnreadEntry, onSelect: () => requestGuidance(nextUnreadEntry?.id) },
          { id: "chapter-path", label: "Chapter path", onSelect: returnToChapterPath },
          { id: "refresh-guidance", label: guidanceEntryId ? "Refresh route" : "Follow lantern", disabled: !guidedTargetEntry, onSelect: () => requestGuidance(guidedTargetEntry?.id) },
          { id: "cancel-guidance", label: "Cancel lantern guidance", disabled: !guidanceEntryId, onSelect: () => { setGuidanceEntryId(null); setGuidanceStatus("Lantern guidance cancelled."); } },
          { id: "controls", label: controls === "walk" ? "Orbit" : "Walk", disabled: mobileViewport.isMobile, onSelect: toggleControls },
          { id: "threshold", label: "Threshold", onSelect: leaveForest },
        ]}
        navigationDetails={<>
          <MagicLinkSignIn />
          <p>{visitedCount}/{totalCount} seen · {contentDiagnostics.visualCount} visuals · {journeyChapters.length} chapters</p>
          <p>{mobileViewport.isMobile ? "Move with the analogue pad and drag Look to turn." : "WASD / arrows walk. F reads. M or I opens the constellation. B goes back."}</p>
          <label><input type="checkbox" checked={showMiniMap} onChange={event => setSetting("showMiniMap", event.target.checked)} /> Mini-map in navigation details</label>
          {showMiniMap && canReadActiveEntry ? <div className="experience-menu__minimap"><MiniMapHUD entries={entries} activeEntryId={resolvedActiveEntryId} sceneProximity={menuProximity} witnessedEntryIds={witnessedEntryIds} /></div> : null}
          <label><input type="checkbox" checked={showCompass} onChange={event => setSetting("showCompass", event.target.checked)} /> Compass in navigation details</label>
          {showCompass ? <p>{controls === "walk" ? "Walk" : "Drag to look"} · {canReadActiveEntry ? sceneLabel(activeEntry) : "A path still forming"}</p> : null}
          {showContextualGuidance ? <ContextualNavigationPrompt sceneProximity={menuProximity} /> : null}
          <label><input type="radio" name="mobile-mode" checked={mobileControlMode === "direct"} onChange={() => setSetting("mobileControlMode", "direct")} /> Direct mobile controls</label>
          <label><input type="radio" name="mobile-mode" checked={mobileControlMode === "guided"} onChange={() => setSetting("mobileControlMode", "guided")} /> Guided mobile controls</label>
          <nav aria-label="Recent remembered trail">{recentBreadcrumbs.filter(entry => witnessedEntryIds.includes(entry.id)).map(entry =>
            <button key={entry.id} type="button" onClick={() => { if (navigateToEntry(entry.id, "explore")) changeMemories(false); }}>{entry.title}</button>)}</nav>
          <nav aria-label="Current chapter path">{currentChapterEntries.map((entry, index) =>
            <button key={entry.id} type="button" onClick={() => {
              const accepted = witnessedEntryIds.includes(entry.id) ? navigateToEntry(entry.id, "explore") : requestGuidance(entry.id);
              if (accepted) changeMemories(false);
            }}>{witnessedEntryIds.includes(entry.id) ? entry.title : `Unread memory ${index + 1}`}</button>)}</nav>
          <div aria-label="Chapter progress">{chapterProgress.map(chapter => <p key={chapter.id}>{chapter.revealed ? chapter.chapter : "A chapter still forming"} · {chapter.visited}/{chapter.total}</p>)}</div>
        </>}
      />

      {experienceCapabilities.allowConstellationView && mode === "map" ? (
        <section ref={mapWorkspaceRef} tabIndex={-1} className={`map-workspace${experienceCapabilities.constellationScope === "witnessed-only" ? " is-partial-constellation" : ""}`} aria-label="Story map workspace" data-constellation-scope={experienceCapabilities.constellationScope}>
          <button className="memory-return" type="button" onClick={() => setMode("explore")}>Return to forest</button>
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
