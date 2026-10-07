import { useEffect, useMemo, useRef, type Dispatch, type SetStateAction } from "react";
import { entries } from "../data/slipperContent";
import { getJourneyChapterForEntry } from "../data/journeyNarrative";
import { getEntryAdjacency, getEntryById, getNextEntry } from "../lib/storyGraph";
import { nextRequiredEntry } from "../lib/journeyProgression";
import { resolveSlipperStartState, type SlipperExperienceCapabilities } from "../lib/experienceMode";
import { isExperienceSettingsOpen, setOnboardingComplete } from "../lib/experiencePreferences";
import { activateNarrativeAudioFromGesture } from "../lib/narrativeAudioActivation";
import { canEnterJourneyEntry, journeyEntryLockMessage } from "../narrative/StorySelectors";
import { useJourneyStore } from "../stores/useJourneyStore";
import { useWorldStore, type WorldMode } from "../stores/useWorldStore";
import { entryWorldPosition } from "../lib/worldLayout";
import { NODE_ACTIVATION_RADIUS_SQ } from "../player/interactionProximity";
import type { StoryRuntimeHost } from "./StoryRuntimeContext";

type Setter<T> = Dispatch<SetStateAction<T>>;
export type StoryNavigationOptions = {
  host: StoryRuntimeHost | null;
  accessibleJourney: boolean;
  audioEnabled: boolean;
  capabilities: SlipperExperienceCapabilities;
  experienceStarted: boolean;
  archiveOpen: boolean;
  prologueResolved: boolean;
  guidanceEntryId: string | null;
  setGuidanceEntryId: Setter<string | null>;
  setGuidanceStatus: Setter<string>;
  setArchiveOpen: Setter<boolean>;
  setExperienceStarted: Setter<boolean>;
  setSessionJourneyMode: Setter<"first-journey" | "returning-journey" | null>;
  setSceneResetNonce: Setter<number>;
  requestReaderFocus: () => void;
};

/** Clicks and keyboard use the same fresh command path; this owns no story state. */
export function useStoryNavigation(options: StoryNavigationOptions) {
  const optionsRef = useRef(options); optionsRef.current = options;
  const navigation = useMemo(() => {
    const clearGuidance = () => {
      const config = optionsRef.current;
      config.setGuidanceEntryId(null); config.setGuidanceStatus("");
    };
    const openRoot = () => {
      if (window.location.pathname !== "/") window.history.pushState({}, "",
        optionsRef.current.accessibleJourney ? "/?accessible=1" : "/");
    };
    function readActiveEntry() {
      const config = optionsRef.current, state = useJourneyStore.getState();
      const mode = useWorldStore.getState().mode;
      if (mode === "map" || mode === "read") return navigateToEntry(state.activeEntryId, "read");
      const lease = config.host?.runtime.currentLease();
      if (!lease || !config.host?.runtime.dispatch({ type: "read", entryId: state.activeEntryId, lease }).accepted) return false;
      useWorldStore.getState().setMode("read"); config.requestReaderFocus(); return true;
    }
    function navigateToEntry(entryId: string, nextMode = useWorldStore.getState().mode) {
      const config = optionsRef.current, state = useJourneyStore.getState();
      if (!getEntryById(entries, entryId)) return false;
      const result = config.host?.dispatchNavigation({ type: "navigate", entryId,
        expectedEntryId: state.activeEntryId, kind: "explicit", read: nextMode === "read" });
      if (!result?.accepted) { config.setGuidanceStatus(journeyEntryLockMessage(entryId)); return false; }
      clearGuidance();
      if (entryId !== state.activeEntryId) config.setSceneResetNonce(value => value + 1);
      useWorldStore.getState().setMode(nextMode);
      if (nextMode === "read") config.requestReaderFocus();
      return true;
    }
    function goBack() {
      const config = optionsRef.current, state = useJourneyStore.getState();
      const result = config.host?.dispatchNavigation({ type: "back", expectedEntryId: state.activeEntryId,
        read: useWorldStore.getState().mode === "read" });
      if (result?.accepted) clearGuidance();
      return Boolean(result?.accepted);
    }
    function moveToPrevious() {
      const state = useJourneyStore.getState();
      if (state.history.length) return goBack();
      const previous = getEntryAdjacency(entries, state.activeEntryId).previous;
      return previous ? navigateToEntry(previous.id) : false;
    }
    function continueToNext() {
      const next = getNextEntry(entries, useJourneyStore.getState().activeEntryId);
      return next ? navigateToEntry(next.id) : false;
    }
    function requestGuidance(entryId: string | undefined) {
      const config = optionsRef.current, state = useJourneyStore.getState();
      const target = entryId ? getEntryById(entries, entryId) : undefined;
      if (!target || target.id === state.activeEntryId) {
        config.setGuidanceEntryId(null);
        config.setGuidanceStatus(target ? "You are already at that clearing." : "No unread clearing is available for guidance.");
        return false;
      }
      if (!canEnterJourneyEntry(target.id, state.activeEntryId, state)) {
        config.setGuidanceEntryId(null); config.setGuidanceStatus(journeyEntryLockMessage(target.id)); return false;
      }
      if (config.accessibleJourney && !navigateToEntry(target.id, "read")) return false;
      config.setGuidanceEntryId(target.id);
      config.setGuidanceStatus(config.accessibleJourney ? `${target.title} is ready to witness in the text journey.`
        : `Lantern guidance active: ${target.title}`);
      config.setArchiveOpen(false); config.setExperienceStarted(true);
      const world = useWorldStore.getState(); world.setMode(config.accessibleJourney ? "read" : "explore"); world.setControls("walk");
      openRoot(); return true;
    }
    function openRememberedEntry(entryId: string, nextMode: WorldMode = "read") {
      const config = optionsRef.current;
      if (!useJourneyStore.getState().witnessedEntryIds.includes(entryId) || !navigateToEntry(entryId, nextMode)) return;
      config.setArchiveOpen(false); config.setExperienceStarted(true); openRoot();
    }
    function handlePortalSelect(entryId: string) {
      const config = optionsRef.current, state = useJourneyStore.getState();
      const target = getEntryById(entries, entryId);
      if (!target || target.id === state.activeEntryId) return false;
      return config.host?.observeCrossing({ entryId, expectedEntryId: state.activeEntryId,
        targetPosition: entryWorldPosition(target, entries), radiusSq: NODE_ACTIVATION_RADIUS_SQ,
        onAccepted: position => {
          const current = optionsRef.current;
          useJourneyStore.getState().setSafePosition({ entryId, position: [...position] });
          const completedGuidance = entryId === current.guidanceEntryId;
          current.setGuidanceEntryId(null); useWorldStore.getState().setMode("explore");
          if (completedGuidance) current.setGuidanceStatus(`Arrived at ${target.title}.`);
        },
      }) ?? false;
    }
    function handleMapSelectEntry(entryId: string) {
      if (useJourneyStore.getState().witnessedEntryIds.includes(entryId)) openRememberedEntry(entryId, "map");
      else requestGuidance(entryId);
    }
    function returnToLastClearing() {
      const config = optionsRef.current, state = useJourneyStore.getState();
      const target = getEntryById(entries, state.lastSafeEntryId)?.id ?? state.activeEntryId;
      if (!navigateToEntry(target, "explore")) return;
      config.setGuidanceStatus(`Returned safely to ${getEntryById(entries, target)?.title ?? "the current clearing"}.`);
      useWorldStore.getState().setControls("walk");
      if (target === state.activeEntryId) config.setSceneResetNonce(value => value + 1);
    }
    function returnToChapterPath() {
      const state = useJourneyStore.getState();
      const chapter = getJourneyChapterForEntry(state.activeEntryId);
      const target = nextRequiredEntry(state) ?? chapter?.entryIds.find(id => !state.visitedEntryIds.includes(id))
        ?? getEntryAdjacency(entries, state.activeEntryId).next?.id;
      requestGuidance(target);
    }
    function continueAuthoredStory() {
      const config = optionsRef.current, state = useJourneyStore.getState(), target = nextRequiredEntry(state);
      if (!target) { config.setGuidanceStatus(state.storyCompleted ? "The remembered path now lies open." : "Stay with this clearing until it answers."); return; }
      if (target === state.activeEntryId) { config.setGuidanceStatus("This clearing still asks something of you."); useWorldStore.getState().setMode("explore"); return; }
      navigateToEntry(target, "read");
    }
    function openArchive() {
      const config = optionsRef.current;
      if (!config.capabilities.allowFullArchive) return;
      config.setArchiveOpen(true);
      if (!window.location.pathname.startsWith("/archive")) window.history.pushState({}, "", config.accessibleJourney ? "/archive?accessible=1" : "/archive");
    }
    function enterForest() {
      const config = optionsRef.current, start = resolveSlipperStartState(useJourneyStore.getState());
      const result = config.host?.dispatchNavigation({ type: start.id === "fresh" ? "begin" : "continue" });
      if (!result?.accepted) return;
      if (!config.accessibleJourney) activateNarrativeAudioFromGesture(config.audioEnabled);
      config.setSessionJourneyMode(start.id === "fresh" ? "first-journey" : "returning-journey");
      setOnboardingComplete(true); config.setArchiveOpen(false); config.setExperienceStarted(true);
      useWorldStore.getState().setControls("walk"); useWorldStore.getState().setMode("explore"); openRoot();
    }
    function leaveForest() {
      if (document.pointerLockElement) document.exitPointerLock?.();
      const config = optionsRef.current; clearGuidance();
      const world = useWorldStore.getState(); world.setSceneProximity(null); world.setControls("walk"); world.setMode("explore");
      config.setExperienceStarted(false);
    }
    return { readActiveEntry, navigateToEntry, goBack, moveToPrevious, continueToNext,
      requestGuidance, openRememberedEntry, handlePortalSelect, handleMapSelectEntry,
      returnToLastClearing, returnToChapterPath, continueAuthoredStory, openArchive, enterForest, leaveForest };
  }, []);
  useEffect(() => {
    const keyDown = (event: KeyboardEvent) => {
      const config = optionsRef.current;
      if (!config.experienceStarted || config.archiveOpen || !config.prologueResolved || isExperienceSettingsOpen()) return;
      if (event.ctrlKey || event.metaKey || event.altKey || event.isComposing || event.defaultPrevented) return;
      const target = event.target as HTMLElement | null;
      if (target?.isContentEditable || target?.closest("input, textarea, select, button, a, summary, [role='button'], [role='tab'], [role='radio'], [role='slider'], [role='checkbox'], [role='switch'], [role='menuitem'], [role='option'], [role='dialog']")) return;
      const world = useWorldStore.getState(), key = event.key.toLowerCase(), walking = world.mode === "explore" && world.controls === "walk";
      if (key === "escape" || key === "e") { event.preventDefault(); world.setMode("explore"); }
      else if (key === "f") { event.preventDefault(); navigation.readActiveEntry(); }
      else if ((key === "m" || key === "i") && config.capabilities.allowConstellationNavigation) {
        event.preventDefault(); world.setMode(world.mode === "map" ? "explore" : "map");
      } else if (config.capabilities.showGenericNavigation && (key === "b" || key === "arrowleft" && !walking)) {
        event.preventDefault(); navigation.moveToPrevious();
      } else if (config.capabilities.showGenericNavigation && key === "arrowright" && !walking) {
        event.preventDefault(); navigation.continueToNext();
      }
    };
    window.addEventListener("keydown", keyDown);
    return () => window.removeEventListener("keydown", keyDown);
  }, [navigation]);
  return navigation;
}
