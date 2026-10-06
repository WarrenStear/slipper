import { createContext, useContext, useLayoutEffect, useRef, type ReactNode } from "react";
import { createStoryRuntime, type StoryRuntimeSession } from "../narrative/StoryRuntime";
import type { StoryIntent, StoryIntentResult } from "../narrative/StoryIntents";
import { createPhysicalObservationPort, type PhysicalObservationBinding, type NumericPosition } from "../player/physicalObservation";
import { connectPhysicalObservationInput } from "../player/physicalObservationInput";
import { useJourneyStore } from "../stores/useJourneyStore";
import { useSettingsStore } from "../stores/useSettingsStore";
import { useWorldStore } from "../stores/useWorldStore";

export type RuntimePhysicalScope = Readonly<{ entryId: string; sceneId: string; revision: number }>;
export type RuntimeShellActivity = Readonly<{
  ready: boolean;
  participating: boolean;
  overlayOpen: boolean;
  allowActions: boolean;
  onMessage?: (message: string) => void;
  onAuthorizationLost?: () => void;
}>;
type ExplicitNavigationIntent = Extract<StoryIntent, { type: "begin" | "continue" | "back" }>
  | Extract<StoryIntent, { type: "navigate"; kind?: "explicit" }>;
type CrossingObservation = Readonly<{
  entryId: string; expectedEntryId: string; targetPosition: NumericPosition; radiusSq: number;
  onAccepted: (position: NumericPosition) => void;
}>;

/** Old rendered camera/interaction owners cannot publish into a newly entered scene. */
export function physicalScopeCurrent(scope: RuntimePhysicalScope, state: {
  activeEntryId: string; sceneId: string; sceneRelocationRevision?: number;
}) {
  return scope.entryId === state.activeEntryId && scope.sceneId === state.sceneId
    && scope.revision === (state.sceneRelocationRevision ?? 0);
}

function createHost() {
  let shell: RuntimeShellActivity = { ready: false, participating: false, overlayOpen: false, allowActions: false };
  let pageHidden = false;
  let archiveNavigation = false;
  let binding: PhysicalObservationBinding | null = null;
  let refreshInput: ((forceReset?: boolean) => void) | null = null;
  let crossing: (CrossingObservation & { lease: object; scope: RuntimePhysicalScope }) | null = null;
  let clearing: { scope: RuntimePhysicalScope; present: boolean } | null = null;
  let thresholdLease: object | null = null;
  const armedThresholds = new Set<string>();
  let previouslyAuthorized = false;
  const clearThresholds = () => { armedThresholds.clear(); thresholdLease = null; };
  const physical = createPhysicalObservationPort();
  const foreground = () => !pageHidden && !document.hidden && document.hasFocus();
  const runtime = createStoryRuntime({
    getState: useJourneyStore.getState,
    subscribe: listener => useJourneyStore.subscribe(listener),
    getActivity: () => ({
      ready: shell.ready && useJourneyStore.getState().isInitialized,
      foreground: foreground(),
      overlayOpen: shell.overlayOpen && !archiveNavigation || useSettingsStore.getState().drawerOpen,
      participating: shell.participating && shell.allowActions && useWorldStore.getState().mode !== "map",
      reducedMotion: useSettingsStore.getState().reducedMotion,
    }),
  });
  function physicalBinding(scope?: RuntimePhysicalScope): PhysicalObservationBinding | null {
    if (scope && !physicalScopeCurrent(scope, useJourneyStore.getState())) return null;
    const lease = runtime.currentLease();
    if (!lease) {
      clearThresholds();
      if (binding) physical.release(binding.lease);
      binding = null;
      return null;
    }
    if (binding?.lease !== lease) {
      clearThresholds();
      if (binding) physical.release(binding.lease);
      physical.bind(lease, performance.now());
      binding = { port: physical, lease };
    }
    return binding;
  }
  function readPhysical(nowOrScope?: number | RuntimePhysicalScope, suppliedNow?: number) {
    const scope = typeof nowOrScope === "object" ? nowOrScope : undefined;
    const nowMs = typeof nowOrScope === "number" ? nowOrScope : suppliedNow ?? performance.now();
    const current = physicalBinding(scope);
    return current ? current.port.read(current.lease, nowMs) : null;
  }
  function physicalActive() {
    const world = useWorldStore.getState();
    return shell.ready && shell.participating && shell.allowActions && !shell.overlayOpen
      && foreground() && !useSettingsStore.getState().drawerOpen
      && world.mode === "explore" && world.controls !== "none" && !world.physicsPaused;
  }
  return {
    runtime,
    /** Archive buttons may navigate while the archive is open; physical and timed actions remain suspended. */
    dispatchNavigation(intent: ExplicitNavigationIntent) {
      crossing = null; clearing = null; clearThresholds();
      archiveNavigation = true;
      try {
        const result = runtime.dispatch(intent);
        if (result.accepted) previouslyAuthorized = true;
        return result;
      }
      finally { archiveNavigation = false; }
    },
    physicalBinding,
    readPhysical,
    observeClearingPresence(scope: RuntimePhysicalScope, present: boolean) {
      if (!physicalScopeCurrent(scope, useJourneyStore.getState())) return false;
      clearing = { scope: { ...scope }, present }; return true;
    },
    /** Initial/saved arrivals inside a neighboring radius are not crossing edges. */
    observeThresholdDistance(scope: RuntimePhysicalScope, entryId: string, position: NumericPosition, radiusSq: number) {
      const facts = readPhysical(scope), lease = runtime.currentLease();
      if (!physicalActive() || !lease || !facts?.available || !facts.fresh || !facts.settled || !facts.inputEnabled) return false;
      if (thresholdLease !== lease) { armedThresholds.clear(); thresholdLease = lease; }
      const dx = facts.position[0] - position[0], dz = facts.position[2] - position[2];
      if (dx * dx + dz * dz > radiusSq) armedThresholds.add(entryId);
      return armedThresholds.has(entryId);
    },
    /** A render-frame threshold report is consumed only by the existing DOM scheduler. */
    observeCrossing(observation: CrossingObservation) {
      const state = useJourneyStore.getState(), lease = runtime.currentLease();
      const facts = readPhysical();
      if (!physicalActive() || !lease || !facts?.available || !facts.fresh || !facts.settled
        || !facts.inputEnabled || state.activeEntryId !== observation.expectedEntryId
        || thresholdLease !== lease || !armedThresholds.has(observation.entryId)) return false;
      crossing = { ...observation, targetPosition: [...observation.targetPosition], lease,
        scope: { entryId: state.activeEntryId, sceneId: state.sceneId, revision: state.sceneRelocationRevision ?? 0 } };
      return true;
    },
    sample(nowMs: number) {
      const results: StoryIntentResult[] = [];
      if (runtime.currentLease()) previouslyAuthorized = true;
      else if (shell.participating && previouslyAuthorized) {
        previouslyAuthorized = false; crossing = null; clearing = null; clearThresholds();
        shell.onAuthorizationLost?.();
      }
      const observed = crossing; crossing = null;
      if (observed && physicalActive() && runtime.currentLease() === observed.lease
        && thresholdLease === observed.lease && armedThresholds.has(observed.entryId)) {
        const facts = readPhysical(observed.scope, nowMs);
        if (facts) {
          const dx = facts.position[0] - observed.targetPosition[0], dz = facts.position[2] - observed.targetPosition[2];
          const result = runtime.dispatch({ type: "navigate", kind: "crossing", entryId: observed.entryId,
            expectedEntryId: observed.expectedEntryId, lease: observed.lease, nowMs,
            facts: { ...facts, thresholdEntryId: observed.entryId, crossed: dx * dx + dz * dz <= observed.radiusSq } });
          if (result.accepted) { results.push(result); clearing = null; clearThresholds(); observed.onAccepted(facts.position); }
        }
      }
      const lease = runtime.currentLease();
      if (lease && clearing) {
        const facts = readPhysical(clearing.scope, nowMs);
        if (facts && physicalActive()) runtime.publishPhysicalPresence(lease, clearing.scope.entryId, facts, clearing.present);
        else runtime.observePresence(lease, clearing.scope.entryId, false);
      }
      return [...results, ...runtime.sample(nowMs)];
    },
    physicalActive,
    configure(next: RuntimeShellActivity) {
      const changed = shell.ready !== next.ready || shell.participating !== next.participating
        || shell.overlayOpen !== next.overlayOpen || shell.allowActions !== next.allowActions;
      shell = next;
      if (changed) { crossing = null; clearing = null; clearThresholds(); runtime.refreshActivity(); refreshInput?.(true); }
    },
    setPageHidden(hidden: boolean) { pageHidden = hidden; crossing = null; clearing = null; clearThresholds(); runtime.refreshActivity(); refreshInput?.(true); },
    setInputRefresh(callback: typeof refreshInput) { refreshInput = callback; if (!callback) { crossing = null; clearing = null; clearThresholds(); } },
    signalPhysicalInput(kind: "input" | "suspend") {
      if (kind === "suspend") { crossing = null; clearing = null; clearThresholds(); }
      runtime.suspendPhysicalAttention(); runtime.refreshActivity();
    },
    message(message: string) { shell.onMessage?.(message); },
  };
}

export type StoryRuntimeHost = ReturnType<typeof createHost>;
const StoryRuntimeContext = createContext<StoryRuntimeHost | null>(null);

/** Rendering fixtures without this host stay observational and cannot advance a journey. */
export function useStoryRuntimeHost() { return useContext(StoryRuntimeContext); }
export function useStoryRuntime(): StoryRuntimeSession | null { return useStoryRuntimeHost()?.runtime ?? null; }

/** One transient DOM lifetime. Binding and cleanup never infer a story action. */
export function StoryRuntimeProvider({ children }: { children: ReactNode }) {
  const hostRef = useRef<StoryRuntimeHost | null>(null);
  if (!hostRef.current) hostRef.current = createHost();
  const host = hostRef.current;
  useLayoutEffect(() => {
    const disconnect = host.runtime.bind();
    const input = connectPhysicalObservationInput({
      windowTarget: window, documentTarget: document,
      getBinding: () => host.physicalBinding(), getActivity: () => host.physicalActive(),
      now: () => performance.now(),
      subscribeActivity: notify => {
        const stopSettings = useSettingsStore.subscribe((state, previous) => {
          if (state.drawerOpen !== previous.drawerOpen) notify();
        });
        const stopWorld = useWorldStore.subscribe((state, previous) => {
          if (state.mode !== previous.mode || state.controls !== previous.controls
            || state.physicsPaused !== previous.physicsPaused) notify();
        });
        const stopJourney = useJourneyStore.subscribe((state, previous) => {
          if (state.activeEntryId !== previous.activeEntryId || state.sceneId !== previous.sceneId
            || state.sceneRelocationRevision !== previous.sceneRelocationRevision) notify();
        });
        return () => { stopSettings(); stopWorld(); stopJourney(); };
      },
      onSignal: ({ kind }) => host.signalPhysicalInput(kind),
    });
    host.setInputRefresh(input.refreshActivity);
    const hide = () => host.setPageHidden(true), show = () => host.setPageHidden(false);
    window.addEventListener("pagehide", hide); window.addEventListener("pageshow", show);
    let frame = 0, disposed = false;
    const sample = (now: number) => {
      if (disposed) return;
      const results = host.sample(now);
      for (const result of results) if (result.accepted) {
        for (const message of result.messages) host.message(message);
      }
      frame = window.requestAnimationFrame(sample);
    };
    frame = window.requestAnimationFrame(sample);
    return () => {
      disposed = true; window.cancelAnimationFrame(frame);
      window.removeEventListener("pagehide", hide); window.removeEventListener("pageshow", show);
      host.setInputRefresh(null); input.dispose(); disconnect(); host.physicalBinding();
    };
  }, [host]);
  return <StoryRuntimeContext.Provider value={host}>{children}</StoryRuntimeContext.Provider>;
}

/** Shell readiness is an activity fact, not permission to enter or witness a scene. */
export function useStoryRuntimeShell(activity: RuntimeShellActivity) {
  const host = useStoryRuntimeHost();
  useLayoutEffect(() => { host?.configure(activity); }, [host, activity.ready, activity.participating,
    activity.overlayOpen, activity.allowActions, activity.onMessage, activity.onAuthorizationLost]);
  return host;
}
