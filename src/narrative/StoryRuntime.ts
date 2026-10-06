import {
  nextJourneyProgressionOutcome,
  nextRequiredEntry,
  nextRequiredScene,
  nextResolvableRitualForEntry,
  type JourneyProgressionState,
} from "../lib/journeyProgression.ts";
import { deriveLanternNarrative } from "../lib/lanternNarrative.ts";
import type { StoryJourneyState } from "../lib/storyJourneyState.ts";
import { resolveGuidedStory } from "../storyEvents/guidedStory.ts";
import { getAvailableStoryEvents, getCarriedStoryObjects } from "../storyEvents/storyEventRegistry.ts";
import { canReadStoryEntry, selectOpeningReleased, selectStoryLocation } from "./StorySelectors.ts";

/** Read the canonical progression once; evaluating it cannot apply an outcome. */
export function selectStoryProgression(state: JourneyProgressionState) {
  return {
    nextScene: nextRequiredScene(state),
    nextEntryId: nextRequiredEntry(state),
    nextRitual: nextResolvableRitualForEntry(state.activeEntryId, state),
    nextOutcome: nextJourneyProgressionOutcome(state),
  };
}

/** Renderer-independent interpretation shared by Forest, Fragment and accessibility. */
export function deriveStoryRuntime(state: StoryJourneyState) {
  return {
    location: selectStoryLocation(state),
    progression: selectStoryProgression(state),
    availableEvents: getAvailableStoryEvents(state),
    carriedObjects: getCarriedStoryObjects(state),
    guidedMoment: resolveGuidedStory(state),
    lantern: deriveLanternNarrative(state),
    openingReleased: selectOpeningReleased(state),
    canReadActiveEntry: canReadStoryEntry(state.activeEntryId, state),
  };
}

export type StoryRuntime = ReturnType<typeof deriveStoryRuntime>;

import {
  getJourneyAct, getJourneyActForEntry, getJourneyBeat, getJourneyBeatForEntry,
  getJourneyRitualBeat, journeyActs, journeyBeatAvailable,
  journeyChapters, journeyScenes, JOURNEY_ENTRY_PROGRESS,
} from "../data/journeyBlueprint.ts";
import { getJourneySceneArrivalHeading } from "../data/journeyWorldLayout.ts";
import { canEnterNarrativeEntry, canResolveRitual } from "../lib/journeyProgression.ts";
import { journeyBeatTransitionDelay, resolveJourneyBeatTransition } from "../lib/journeyBeatTransition.ts";
import {
  JOURNEY_PLAYER_ACTIONS, journeyPlayerActionAvailable, journeyPlayerActionChoiceAtTarget,
  nextJourneyPlayerAction, type JourneyPlayerAction,
} from "../lib/journeyPlayerActions.ts";
import { createStoryAttentionSession } from "../storyEvents/storyAttentionSession.ts";
import type { StoryEventDefinition } from "../storyEvents/storyEventTypes.ts";
import { clearStorySequencePlayback, publishStorySequencePlayback } from "../storyEvents/storyEventRuntime.ts";
import { applyJourneyOutcome, applyPlayerActionOutcome } from "./StoryActions.ts";
import { selectReadyActTransformation } from "./StorySelectors.ts";
import type { StoryIntent, StoryIntentResult, StoryLease, StoryPhysicalAttentionFacts, StoryPhysicalPresenceFacts, StoryRuntimeActivity, StoryRuntimeStore } from "./StoryIntents.ts";
export type { StoryIntent, StoryIntentResult, StoryLease, StoryRuntimeActivity, StoryRuntimeStore } from "./StoryIntents.ts";

type OwnedScene = { token: StoryLease; entryId: string; sceneId: StoryJourneyState["sceneId"]; revision: number };
type OwnedAttention = { token: StoryLease; lease: StoryLease; eventId: string; source: "semantic" | "physical";
  physicalRevision: number; elapsedMs: number; durationMs: number; eligible: boolean; paused: boolean;
  facts: StoryPhysicalAttentionFacts | null; session: ReturnType<typeof createStoryAttentionSession> };
type OwnedBeat = { lease: StoryLease; fromBeatId: string; key: string; session: ReturnType<typeof createStoryAttentionSession> };
type OwnedPhysicalPresence = { lease: StoryLease; entryId: string; insideClearing: boolean; facts: StoryPhysicalPresenceFacts };
const rejected = (reason: string): StoryIntentResult => ({ accepted: false, reason, eventIds: [], messages: [], settled: 0 });
const PHYSICAL_AUTOMATIC = new Set(["volume-enter", "volume-exit", "gaze", "stillness", "scene-complete", "sequence-complete"]);
const attentionDuration = (event: StoryEventDefinition) => event.durationMs ?? (event.trigger === "gaze" ? 1100 : event.trigger === "stillness" ? 4500 : 0);

/**
 * Instance-local intent authority around the existing command sink. Construction,
 * subscription and presentation observations never infer entry or apply outcomes.
 * The host supplies foreground edges and a scheduler; this module owns no renderer,
 * DOM listener, wall timer, bus, persistent state or second journey reducer.
 */
export function createStoryRuntime({ getState, getActivity, subscribe }: {
  getState: () => StoryRuntimeStore;
  getActivity: () => StoryRuntimeActivity;
  subscribe?: (listener: () => void) => () => void;
}) {
  let connected = false, disposed = false, connection: object | null = null;
  let owned: OwnedScene | null = null;
  let authorization: Omit<OwnedScene, "token"> | null = null;
  let unsubscribe: (() => void) | null = null;
  let preserveLegacyCrossing = false;
  let presence = false;
  let physicalPresence: OwnedPhysicalPresence | null = null;
  let presenceRevision = -1;
  let presenceAdmitted = false;
  let crossingRevision = -1;
  let beat: OwnedBeat | null = null;
  const attention = new Map<StoryLease, OwnedAttention>();
  const automatic = new Map<string, StoryLease>();
  const completedAttention = new Map<StoryLease, { elapsedMs: number; durationMs: number; paused: boolean; completed: boolean; result: StoryIntentResult }>();
  const legacy = new Map<StoryLease, { actionId: string; sceneId: StoryJourneyState["sceneId"] }>();

  const activityAllows = (participating = true) => {
    const activity = getActivity();
    return connected && !disposed && activity.ready && activity.foreground && !activity.overlayOpen
      && (!participating || activity.participating);
  };
  function clearIntervals() {
    if (owned) clearStorySequencePlayback(owned.sceneId);
    for (const item of attention.values()) item.session.cancel();
    attention.clear(); automatic.clear(); completedAttention.clear(); beat?.session.cancel(); beat = null;
  }
  function invalidate(clearLegacy = true) {
    clearIntervals(); owned = null; presence = false; physicalPresence = null;
    presenceRevision = crossingRevision = -1; presenceAdmitted = false;
    if (clearLegacy) legacy.clear();
  }
  function ownershipCurrent(token?: StoryLease) {
    if (!owned || token && owned.token !== token) return false;
    const state = getState();
    if (state.activeEntryId !== owned.entryId || state.sceneId !== owned.sceneId
      || (state.sceneRelocationRevision ?? 0) !== owned.revision) {
      authorization = null; invalidate(!preserveLegacyCrossing); return false;
    }
    return true;
  }
  function issueLease() {
    const state = getState();
    owned = { token: Object.freeze({}), entryId: state.activeEntryId, sceneId: state.sceneId,
      revision: state.sceneRelocationRevision ?? 0 };
    authorization = { entryId: owned.entryId, sceneId: owned.sceneId, revision: owned.revision };
    return owned.token;
  }
  function enterCurrent() {
    const state = getState();
    return state.dispatchStoryEvent({ sceneId: state.sceneId, trigger: "scene-enter" });
  }
  function settle(messages: string[]) {
    let count = 0;
    const limit = journeyActs.length + journeyScenes.length + journeyChapters.length + 2;
    while (count < limit) {
      const state = getState();
      const transformation = journeyActs.map(act => selectReadyActTransformation(act.id, state)).find(Boolean);
      if (transformation) {
        state.enterBeat(transformation.actId, transformation.id);
        for (const outcome of transformation.outcomes ?? []) applyJourneyOutcome(outcome, getState());
        if (!getState().completedActs.includes(transformation.actId)) break;
        messages.push(`${getJourneyAct(transformation.actId)?.title ?? "This act"} has changed. The path opens.`);
        count++; continue;
      }
      const outcome = selectStoryProgression(state).nextOutcome;
      if (!outcome) break;
      if (outcome.type === "complete-scene") state.completeScene(outcome.sceneId);
      else if (outcome.type === "complete-chapter") state.completeChapter(outcome.chapterId);
      else state.completeStory();
      if (getState() === state) break;
      count++;
      if (outcome.type === "complete-scene") messages.push(`${journeyScenes.find(scene => scene.id === outcome.sceneId)?.title ?? "The scene"} settles into memory.`);
      else if (outcome.type === "complete-chapter") messages.push(`${journeyChapters.find(chapter => chapter.id === outcome.chapterId)?.title ?? "This part of the path"} settles into memory.`);
      else messages.push("The lantern constellation is whole.");
    }
    return count;
  }
  function accepted(eventIds: readonly string[] = [], messages: string[] = [], retryEntry = false): StoryIntentResult {
    // Only a successful explicit action earns newly available current-scene continuity.
    const continuation = retryEntry && ownershipCurrent() ? enterCurrent() : [];
    return { accepted: true, lease: owned?.token, eventIds: [...eventIds, ...continuation], messages,
      settled: settle(messages) };
  }
  function witness(entryId: string) {
    const state = getState();
    if (entryId !== state.activeEntryId || !canEnterNarrativeEntry(entryId, state)) return false;
    const freshOpening = state.witnessedEntryIds.length === 0 && state.completedActs.length === 0
      && journeyActs[0]?.entryIds[0] === entryId;
    state.witnessEntry(entryId);
    const entryBeat = getJourneyBeatForEntry(entryId), activeAct = getJourneyActForEntry(entryId);
    const currentBeat = getJourneyBeat(getState().beatId);
    const opening = journeyActs[0] && getJourneyBeat(journeyActs[0].mainBeatIds[0]);
    if (freshOpening && opening) getState().enterBeat(opening.actId, opening.id);
    else if (entryBeat && !getState().completedActs.includes(entryBeat.actId)
      && !(currentBeat && ["transformation", "threshold", "departure", "arrival"].includes(currentBeat.role)
        && (currentBeat.actId === activeAct?.id || getJourneyAct(currentBeat.actId)?.nextActId === activeAct?.id))) {
      getState().enterBeat(entryBeat.actId, entryBeat.id);
    }
    presence = true;
    return true;
  }
  function legacyAction(actionId: string, token?: StoryLease, physical = false): JourneyPlayerAction | undefined {
    const state = getState();
    const action = (JOURNEY_PLAYER_ACTIONS as readonly JourneyPlayerAction[]).find(candidate => candidate.id === actionId);
    const held = token && legacy.get(token);
    if (!action || held && held.sceneId !== action.sceneId || token && !held
      || !held && state.sceneId !== action.sceneId
      || state.completedSceneIds.includes(action.sceneId)
      || !state.witnessedEntryIds.includes(journeyScenes.find(scene => scene.id === action.sceneId)?.keystoneEntryId ?? "")
      || !journeyPlayerActionAvailable(action, state.worldFlags)
      || !held && !physical && nextJourneyPlayerAction(action.sceneId, state.worldFlags)?.id !== actionId) return undefined;
    return action;
  }
  function dispatch(intent: StoryIntent): StoryIntentResult {
    if (!activityAllows(intent.type !== "begin" && intent.type !== "continue" && intent.type !== "navigate" && intent.type !== "back")) return rejected("inactive");
    if (intent.type === "begin" || intent.type === "continue") {
      const state = getState();
      if (!Object.prototype.hasOwnProperty.call(JOURNEY_ENTRY_PROGRESS, state.activeEntryId)
        || !canEnterNarrativeEntry(state.activeEntryId, state)) return rejected("entry-locked");
      invalidate(); state.startStory(); issueLease();
      return accepted(enterCurrent());
    }
    if (intent.type === "navigate" || intent.type === "back") {
      const state = getState();
      if (intent.type === "navigate" && intent.kind === "crossing") {
        if (!ownershipCurrent(intent.lease)) return rejected("stale-lease");
        const facts = intent.facts, observed = facts.observedAtMs;
        if (!Number.isSafeInteger(facts.revision) || facts.revision <= crossingRevision) return rejected("stale-observation");
        crossingRevision = facts.revision;
        if (observed === null || !Number.isFinite(observed) || observed < 0 || !Number.isFinite(intent.nowMs)
          || intent.nowMs < observed || intent.nowMs - observed > 1000 || !facts.available || !facts.fresh
          || !facts.settled || !facts.inputEnabled || !facts.crossed || facts.thresholdEntryId !== intent.entryId) return rejected("unsettled-crossing");
      }
      const target = intent.type === "back" ? state.history[state.history.length - 1] : intent.entryId;
      if (!state.storyStarted || intent.expectedEntryId && intent.expectedEntryId !== state.activeEntryId) return rejected("stale-entry");
      if (!target || !Object.prototype.hasOwnProperty.call(JOURNEY_ENTRY_PROGRESS, target) || !canEnterNarrativeEntry(target, state)) return rejected("entry-locked");
      preserveLegacyCrossing = intent.type === "navigate" && intent.kind === "crossing";
      invalidate(!preserveLegacyCrossing);
      try {
        if (intent.type === "back") state.goBack(); else state.navigateToEntry(target);
      } finally { preserveLegacyCrossing = false; }
      if (getState().activeEntryId !== target) return rejected("navigation-rejected");
      issueLease(); const events = enterCurrent();
      if (intent.read) witness(target);
      return accepted(events);
    }
    if (!ownershipCurrent(intent.lease)) return rejected("stale-lease");
    if (!canEnterNarrativeEntry(getState().activeEntryId, getState())) return rejected("entry-locked");
    if (intent.type === "presence") {
      const facts = intent.facts;
      if (!Number.isSafeInteger(facts.revision) || facts.revision <= presenceRevision) return rejected("stale-observation");
      presenceRevision = facts.revision;
      const observed = facts.observedAtMs;
      if (observed === null || !Number.isFinite(observed) || observed < 0 || !Number.isFinite(intent.nowMs)
        || intent.nowMs < observed || intent.nowMs - observed > 1000
        || !facts.fresh || !facts.available || !facts.settled || !facts.inputEnabled) {
        presence = false; return rejected("unsettled-observation");
      }
      presence = facts.insideClearing && intent.entryId === getState().activeEntryId;
      if (presenceAdmitted) return rejected("presence-already-admitted");
      if (!presence || !witness(intent.entryId)) return rejected("not-present");
      presenceAdmitted = true;
      return accepted();
    }
    if (intent.type === "read" || intent.type === "witness") {
      if (!witness(intent.entryId)) return rejected("stale-entry");
      return accepted();
    }
    if (intent.type === "event") {
      const event = getAvailableStoryEvents(getState()).find(candidate => candidate.id === intent.eventId);
      if (!event || event.trigger === "scene-enter" || event.durationMs) return rejected("event-unavailable");
      const ids = getState().dispatchStoryEvent({ sceneId: event.sceneId, eventId: event.id,
        trigger: event.trigger, objectId: event.objectId, targetId: event.targetId });
      return ids.length ? accepted(ids, [], true) : rejected("event-rejected");
    }
    if (intent.type === "drop") {
      const item = getCarriedStoryObjects(getState()).find(object => object.id === intent.objectId);
      if (!item || item.keepsake || !item.sceneIds.includes(getState().sceneId)) return rejected("drop-unavailable");
      const ids = getState().dispatchStoryEvent({ sceneId: getState().sceneId, trigger: "drop", objectId: item.id });
      return ids.length ? accepted(ids, [], true) : rejected("drop-rejected");
    }
    if (intent.type === "ritual") {
      const state = getState(), ritualBeat = getJourneyRitualBeat(intent.ritualId);
      const ritual = ritualBeat?.interactions?.find(item => item.ritualId === intent.ritualId);
      if (!ritualBeat || !ritual || nextResolvableRitualForEntry(state.activeEntryId, state)?.ritualId !== intent.ritualId
        || !canResolveRitual(intent.ritualId, state)) return rejected("ritual-unavailable");
      if (ritualBeat.entryId === state.activeEntryId) state.enterBeat(ritualBeat.actId, ritualBeat.id);
      for (const outcome of ritualBeat.outcomes ?? []) applyJourneyOutcome(outcome, getState());
      return accepted([], [`The world remembers: ${ritual.label}.`], true);
    }
    const action = legacyAction(intent.actionId, intent.type === "legacy-action" ? intent.actionToken : undefined,
      intent.type === "legacy-start" || intent.source === "physical");
    if (!action) return rejected("action-unavailable");
    if (intent.type === "legacy-start") {
      const token = Object.freeze({}); legacy.set(token, { actionId: action.id, sceneId: action.sceneId });
      return { accepted: true, lease: owned?.token, actionToken: token, eventIds: [], messages: [], settled: 0 };
    }
    const choice = action.choices?.find(item => item.id === intent.choiceId);
    if (action.mode === "choice") {
      if (!choice) return rejected("choice-unavailable");
      if (intent.source === "physical" && (!intent.playerLocalPosition
        || !intent.playerLocalPosition.every(Number.isFinite)
        || journeyPlayerActionChoiceAtTarget(action, intent.playerLocalPosition, getJourneySceneArrivalHeading(action.sceneId))?.id !== choice.id)) return rejected("choice-unreached");
    } else if (intent.choiceId) return rejected("choice-unavailable");
    const outcomes = choice?.outcomes ?? action.outcomes ?? [];
    if (!outcomes.length) return rejected("action-unavailable");
    for (const outcome of outcomes) applyPlayerActionOutcome(outcome, getState());
    return accepted([], [choice ? `${action.rememberedAs} ${choice.label}.` : action.rememberedAs], true);
  }

  function sampleAttention(token: StoryLease, nowMs: number, eligible: boolean, physical = false) {
    const item = attention.get(token);
    if (!item || !ownershipCurrent(item.lease)) return { elapsedMs: 0, result: rejected("stale-attention") };
    if (physical !== (item.source === "physical")) return { elapsedMs: 0, result: rejected("attention-source-mismatch") };
    const event = getAvailableStoryEvents(getState()).find(candidate => candidate.id === item.eventId);
    if (!event) { item.session.cancel(); attention.delete(token); return { elapsedMs: 0, result: rejected("event-unavailable") }; }
    item.session.setActive(activityAllows() && eligible && canEnterNarrativeEntry(getState().activeEntryId, getState()));
    item.paused = !(activityAllows() && eligible);
    const sample = item.session.sample(nowMs);
    item.elapsedMs = sample.elapsedMs;
    if (event.trigger === "sequence-complete") publishStorySequencePlayback(event.sceneId, event.id, sample.elapsedMs, item.durationMs);
    if (!sample.completedNow) return { elapsedMs: sample.elapsedMs, result: rejected("attention-pending") };
    attention.delete(token);
    const ids = getState().dispatchStoryEvent({ sceneId: event.sceneId, eventId: event.id, trigger: event.trigger,
      objectId: event.objectId, targetId: event.targetId, duration: sample.elapsedMs });
    const result = ids.length ? accepted(ids, [], true) : rejected("event-rejected");
    automatic.delete(item.eventId);
    completedAttention.set(token, { elapsedMs: sample.elapsedMs, durationMs: item.durationMs, paused: false, completed: true, result });
    return { elapsedMs: sample.elapsedMs, result };
  }

  return {
    dispatch,
    currentLease() { return ownershipCurrent() ? owned?.token ?? null : null; },
    bind() {
      if (disposed) return () => {};
      unsubscribe?.(); const token = {}; connection = token; connected = true;
      // Reconnection can re-prime existing explicit authorization, never story entry.
      const state = getState();
      if (authorization?.entryId === state.activeEntryId && authorization.sceneId === state.sceneId
        && authorization.revision === (state.sceneRelocationRevision ?? 0) && !owned) issueLease();
      unsubscribe = subscribe?.(() => { ownershipCurrent(); }) ?? null;
      return () => {
        if (connection !== token) return;
        unsubscribe?.(); unsubscribe = null; connected = false; connection = null; invalidate();
      };
    },
    refreshActivity() {
      if (!activityAllows()) {
        if (physicalPresence) { physicalPresence = null; presence = false; }
        for (const item of attention.values()) { item.session.setActive(false); item.paused = true; item.elapsedMs = item.session.sample(Number.NaN).elapsedMs; }
        beat?.session.setActive(false);
      }
    },
    cancelAttention(token: StoryLease) {
      if (completedAttention.delete(token)) return true;
      const item = attention.get(token); if (!item) return false;
      if (automatic.get(item.eventId) === token) automatic.delete(item.eventId);
      item.session.cancel(); attention.delete(token); return true;
    },
    cancelLegacyAction(token: StoryLease) { return legacy.delete(token); },
    beginAttention(lease: StoryLease, eventId: string, source: "semantic" | "physical" = "semantic") {
      if (!connected || disposed || !ownershipCurrent(lease)) return null;
      const event = getAvailableStoryEvents(getState()).find(item => item.id === eventId);
      if (!event || !(event.durationMs || source === "physical" && PHYSICAL_AUTOMATIC.has(event.trigger))) return null;
      const token = Object.freeze({});
      const durationMs = attentionDuration(event);
      attention.set(token, { token, lease, eventId, source, physicalRevision: -1, elapsedMs: 0, durationMs,
        eligible: true, paused: false, facts: null, session: createStoryAttentionSession(durationMs, event.trigger !== "sequence-complete") });
      return token;
    },
    sampleAttention(token: StoryLease, nowMs: number, eligible: boolean) { return sampleAttention(token, nowMs, eligible); },
    setAttentionEligible(token: StoryLease, eligible: boolean) {
      const item = attention.get(token); if (!item) return false;
      item.eligible = eligible;
      if (!eligible) { item.session.setActive(false); item.paused = true; item.elapsedMs = item.session.sample(Number.NaN).elapsedMs; }
      return true;
    },
    readAttention(token: StoryLease) {
      const done = completedAttention.get(token); if (done) return done;
      const item = attention.get(token);
      return item ? { elapsedMs: item.elapsedMs, durationMs: item.durationMs, paused: item.paused || !activityAllows(), completed: false } : null;
    },
    /** Record measured eligibility only; the host's single sample loop advances it. */
    publishPhysicalAttention(lease: StoryLease, eventId: string, facts: StoryPhysicalAttentionFacts, targetEligible: boolean) {
      if (!ownershipCurrent(lease)) return false;
      const event = getAvailableStoryEvents(getState()).find(candidate => candidate.id === eventId);
      if (!event || !PHYSICAL_AUTOMATIC.has(event.trigger)) return false;
      let token = automatic.get(eventId);
      if (!token) { token = this.beginAttention(lease, eventId, "physical") ?? undefined; if (!token) return false; automatic.set(eventId, token); }
      const item = attention.get(token); if (!item) return false;
      item.facts = { ...facts }; item.eligible = targetEligible; return true;
    },
    suspendPhysicalAttention() {
      if (physicalPresence) { physicalPresence = null; presence = false; }
      for (const item of attention.values()) if (item.source === "physical") {
        item.eligible = false; item.facts = null; item.paused = true;
        item.session.setActive(false); item.elapsedMs = item.session.sample(Number.NaN).elapsedMs;
      }
    },
    samplePhysicalAttention(token: StoryLease, facts: StoryPhysicalAttentionFacts, nowMs: number, targetEligible: boolean) {
      const item = attention.get(token);
      if (!item || !ownershipCurrent(item.lease)) return { elapsedMs: 0, result: rejected("stale-attention") };
      if (item.source !== "physical") return { elapsedMs: 0, result: rejected("attention-source-mismatch") };
      const event = getAvailableStoryEvents(getState()).find(candidate => candidate.id === item.eventId);
      const observed = facts.observedAtMs;
      const eligible = activityAllows() && Boolean(event) && targetEligible && facts.available && facts.fresh
        && facts.settled && facts.inputEnabled && (event?.trigger !== "stillness" || facts.stillEligible)
        && observed !== null && Number.isFinite(observed) && observed >= 0 && Number.isFinite(nowMs)
        && nowMs >= observed && nowMs - observed <= 1000;
      // Input/overlay/staleness changes can arrive without any new camera revision.
      // Pause before duplicate suppression so those edges cannot donate wall time.
      if (!eligible) {
        item.session.setActive(false);
        item.elapsedMs = item.session.sample(Number.NaN).elapsedMs;
      }
      if (!Number.isSafeInteger(facts.revision) || facts.revision <= item.physicalRevision) {
        return { elapsedMs: item.elapsedMs, result: rejected("stale-observation") };
      }
      item.physicalRevision = facts.revision;
      return sampleAttention(token, observed ?? Number.NaN, eligible, true);
    },
    /** Ephemeral beat-presence fact only. Durable witnessing requires an explicit intent. */
    observePresence(lease: StoryLease, entryId: string, present: boolean) {
      if (!ownershipCurrent(lease) || entryId !== getState().activeEntryId) return false;
      if (!present) physicalPresence = null;
      presence = present; return true;
    },
    /** Scoped geometry and numeric observations only; admitting them belongs to sample(). */
    publishPhysicalPresence(lease: StoryLease, entryId: string, facts: StoryPhysicalPresenceFacts, insideClearing: boolean) {
      if (!ownershipCurrent(lease) || entryId !== getState().activeEntryId) return false;
      physicalPresence = { lease, entryId, insideClearing, facts: { ...facts } };
      return true;
    },
    sampleBeat(lease: StoryLease, nowMs: number): StoryIntentResult {
      if (!ownershipCurrent(lease)) return rejected("stale-lease");
      const state = getState(), currentBeat = getJourneyBeat(state.beatId);
      const transition = resolveJourneyBeatTransition({ currentBeat, currentAct: getJourneyAct(state.actId),
        activeActId: getJourneyActForEntry(state.activeEntryId)?.id, activeEntryBeatId: getJourneyBeatForEntry(state.activeEntryId)?.id,
        activeEntryWitnessed: state.witnessedEntryIds.includes(state.activeEntryId), canWitnessActiveEntry: presence,
        completedActs: state.completedActs, storyCompleted: state.storyCompleted });
      if (!transition || !currentBeat) { beat?.session.cancel(); beat = null; return rejected("no-transition"); }
      const key = `${currentBeat.id}:${transition.actId}:${transition.beatId}:${transition.kind}:${Boolean(getActivity().reducedMotion)}`;
      if (!beat || beat.key !== key || beat.lease !== lease) {
        beat?.session.cancel(); beat = { lease, fromBeatId: currentBeat.id, key,
          session: createStoryAttentionSession(journeyBeatTransitionDelay(transition.kind, Boolean(getActivity().reducedMotion)), false) };
      }
      beat.session.setActive(activityAllows() && canEnterNarrativeEntry(getState().activeEntryId, getState()));
      if (!beat.session.sample(nowMs).completedNow) return rejected("transition-pending");
      // Re-derived above from the latest canonical entry, presence and beat.
      const target = getJourneyBeat(transition.beatId);
      beat = null;
      if (!target || !journeyBeatAvailable(target, getState())) return rejected("transition-unavailable");
      getState().enterBeat(transition.actId, transition.beatId);
      return { accepted: true, lease, eventIds: [], messages: [], settled: 0 };
    },
    /** One host DOM scheduler, independent of whether any renderer is mounted. */
    sample(nowMs: number): StoryIntentResult[] {
      const results: StoryIntentResult[] = [];
      const observedPresence = physicalPresence;
      if (observedPresence && ownershipCurrent(observedPresence.lease)) {
        const facts = observedPresence.facts, observed = facts.observedAtMs;
        const eligible = activityAllows() && Number.isSafeInteger(facts.revision) && facts.revision >= 0
          && facts.revision >= presenceRevision && (facts.revision > presenceRevision || presenceAdmitted)
          && facts.available && facts.fresh && facts.settled && facts.inputEnabled
          && observed !== null && Number.isFinite(observed) && observed >= 0 && Number.isFinite(nowMs)
          && nowMs >= observed && nowMs - observed <= 1000;
        // Suspension/staleness must revoke ephemeral beat presence even with no new pose.
        this.observePresence(observedPresence.lease, observedPresence.entryId, eligible && observedPresence.insideClearing);
        if (eligible && Number.isSafeInteger(facts.revision) && facts.revision > presenceRevision) {
          if (presenceAdmitted) presenceRevision = facts.revision;
          else {
            const result = dispatch({ type: "presence", lease: observedPresence.lease, entryId: observedPresence.entryId,
              nowMs, facts: { ...facts, insideClearing: observedPresence.insideClearing } });
            if (result.accepted) results.push(result);
          }
        } else if (Number.isSafeInteger(facts.revision) && facts.revision > presenceRevision) presenceRevision = facts.revision;
      }
      for (const item of [...attention.values()]) {
        const sampled = item.source === "physical"
          ? item.facts && this.samplePhysicalAttention(item.token, item.facts, nowMs, item.eligible)
          : sampleAttention(item.token, nowMs, item.eligible);
        if (sampled && sampled.result.accepted) results.push(sampled.result);
      }
      const lease = this.currentLease();
      if (lease) { const result = this.sampleBeat(lease, nowMs); if (result.accepted) results.push(result); }
      return results;
    },
    dispose() {
      if (disposed) return;
      disposed = true; connected = false; connection = null; authorization = null;
      unsubscribe?.(); unsubscribe = null; invalidate();
    },
  };
}

export type StoryRuntimeSession = ReturnType<typeof createStoryRuntime>;
