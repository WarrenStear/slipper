import GuidedStoryMoment from "./components/ui/GuidedStoryMoment";
import "./ui/MemoryReturn.css";
import { ExperienceMenu } from "./ui/ExperienceMenu";
import { useQuietActivity } from "./ui/useQuietActivity";
import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { NarrativeWorldState, SceneProximityState, StorySceneControls, StorySceneMode } from "./components/three/StoryScene";
import type { StoryMapPane } from "./components/ui/ArchiveIndex";
import { FragmentReader } from "./ui/reader/FragmentReader";
import { MapWorkspace } from "./ui/map/MapWorkspace";
import { RememberedPaths } from "./ui/navigation/RememberedPaths";
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
import GiftDedication from "./components/ui/GiftDedication";
import { useCloudJourneySync } from "./hooks/useCloudJourneySync";
import { useMobileViewport } from "./hooks/useMobileViewport";
import { requestExperienceSettingsOpen } from "./lib/experiencePreferences";
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
const FIRST_ENTRY_ID = entries[0]?.id ?? "";
const VALID_ENTRY_IDS = entries.map((entry) => entry.id);

type AppMode = StorySceneMode;

function sceneLabel(entry?: Slipper3DEntry) {
  if (!entry) return "Unknown clearing";
  return entry.engine3d.sceneKind ?? entry.engine3d.mood ?? "fragment";
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
    () => canReadStoryEntry(resolvedActiveEntryId, { witnessedEntryIds })
      ? visuals.find((visual) => visual.id === activeEntry?.engine3d.linkedVisualId) : undefined,
    [activeEntry, resolvedActiveEntryId, witnessedEntryIds],
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

  const visitedCount = visitedEntryIds.length;
  const totalCount = entries.length;
  const canReadActiveEntry = canReadStoryEntry(resolvedActiveEntryId, { witnessedEntryIds });
  const isBookmarked = bookmarkedEntryIds.includes(resolvedActiveEntryId);
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
        navigationDetails={<RememberedPaths entries={entries} activeEntryId={resolvedActiveEntryId}
          witnessedEntryIds={witnessedEntryIds} sceneProximity={sceneProximity}
          recentEntries={recentBreadcrumbs} chapterEntries={currentChapterEntries} chapterProgress={chapterProgress}
          counts={{ visited: visitedCount, total: totalCount, visuals: contentDiagnostics.visualCount, chapters: journeyChapters.length }}
          mobile={mobileViewport.isMobile} controls={controls} showMiniMap={showMiniMap} showCompass={showCompass}
          showContextualGuidance={showContextualGuidance} mobileControlMode={mobileControlMode}
          onSettingChange={setSetting} onOpenEntry={entryId => navigateToEntry(entryId, "explore")}
          onGuideEntry={requestGuidance} onDismiss={() => changeMemories(false)} />}
      />

      {experienceCapabilities.allowConstellationView && mode === "map" ? <MapWorkspace
        capabilities={experienceCapabilities} entries={entries} activeEntryId={resolvedActiveEntryId}
        visitedEntryIds={visitedEntryIds} witnessedEntryIds={witnessedEntryIds} sceneProximity={sceneProximity} mobile={mobileViewport.isMobile}
        activePane={mobileMapPane} onChangePane={setMobileMapPane} workspaceRef={mapWorkspaceRef}
        onReturnToForest={() => setMode("explore")}
        onOpenEntry={entryId => openRememberedEntry(entryId, "read")} onGuideEntry={requestGuidance} /> : null}

      {mode === "read" && canReadActiveEntry ? <FragmentReader entry={activeEntry} witnessedEntryIds={witnessedEntryIds}
        focusNonce={readerFocusNonce} reducedMotion={reducedMotion} showMetrics={experienceCapabilities.showJourneyMetrics}
        sceneId={storySceneId} reducedEffects={reducedEffects} highContrast={highContrast}
        mobile={mobileViewport.isMobile} readerTheme={readerTheme}
        kicker={experienceCapabilities.showJourneyMetrics
          ? `${activeJourneyChapter?.title ?? activeEntry?.chapter} / ${sceneLabel(activeEntry)} / ${currentChapterProgress || 1} of ${currentChapterEntries.length || 1}`
          : activeNarrativeScene?.title ?? "A remembered fragment"}
        freeWoods={experienceMode === "free-woods"} constellationScope={experienceCapabilities.constellationScope}
        canContinue={canContinueAuthoredStory} bookmarked={isBookmarked}
        backAvailable={history.length > 0 || Boolean(adjacency?.previous)} nextAvailable={Boolean(nextEntry)}
        onReturnToForest={() => setMode("explore")} onFollow={() => requestGuidance(authoredJourneyTarget?.id)}
        onSettings={requestExperienceSettingsOpen} onConstellation={() => setMode("map")}
        onBookmark={() => toggleBookmark(resolvedActiveEntryId)} onBack={moveToPrevious} onNext={continueToNext}
        onContinue={continueAuthoredStory} onArchive={openArchive} /> : null}
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
