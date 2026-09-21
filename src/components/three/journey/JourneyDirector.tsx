import { useCallback, useEffect, useLayoutEffect, useMemo, useState } from "react";
import {
  getJourneyAct,
  getJourneyActForEntry,
  getJourneyBeat,
  getJourneyBeatForEntry,
  getJourneyChapter,
  getJourneyChapterForEntry,
  getJourneyRitualBeat,
  getJourneyScene,
  getJourneySceneForEntry,
  journeyActs,
  journeyBeatAvailable,
  journeyConditionMet,
  type JourneyAct,
  type JourneyOutcome,
} from "../../../data/journeyBlueprint";
import {
  getJourneyEntryWorldPosition,
  getJourneySceneArrivalHeading,
  getJourneySceneLayout,
} from "../../../data/journeyWorldLayout";
import {
  journeyBeatTransitionDelay,
  resolveJourneyBeatTransition,
} from "../../../lib/journeyBeatTransition";
import {
  canEnterNarrativeEntry,
  canResolveRitual,
  nextJourneyProgressionOutcome,
  nextResolvableRitualForEntry,
  type JourneyProgressionState,
} from "../../../lib/journeyProgression";
import {
  availableJourneyPlayerActionsForScene,
  JOURNEY_PLAYER_ACTIONS,
  journeyPlayerActionChoiceAtTarget,
  journeyPlayerActionAvailable,
  nearestJourneyPlayerActionChoice,
  nextJourneyPlayerAction,
  resolveJourneyPlayerActionTargetLocalPosition,
  type JourneyPlayerActionTarget,
  type JourneyPlayerActionOutcome,
} from "../../../lib/journeyPlayerActions";
import type {
  JourneyActId,
  JourneySceneId,
  StoryJourneyState,
} from "../../../lib/storyJourneyState";
import { useJourneyStore } from "../../../stores/useJourneyStore";
import { useSettingsStore } from "../../../stores/useSettingsStore";
import type {
  SceneProximityState,
  StorySceneControls,
  StorySceneMode,
} from "../StoryScene";
import { resolveRitualPresentation } from "../rituals/RitualDirector";
import RitualInteraction from "../rituals/RitualInteraction";
import StoryMomentInteraction from "../moments/StoryMomentInteraction";

type JourneyAccessState = Pick<
  StoryJourneyState,
  "completedActs" | "inventory" | "visitedEntryIds"
> & Partial<Omit<JourneyProgressionState, "completedActs" | "inventory">>;

export type JourneyDirectorProps = {
  activeEntryId: string;
  mode: StorySceneMode;
  controls: StorySceneControls;
  proximity: SceneProximityState | null;
  reducedMotion?: boolean;
  suppressed?: boolean;
  onJourneyMessage?: (message: string) => void;
};

function actIndex(actId: JourneyActId) {
  return journeyActs.findIndex((act) => act.id === actId);
}

function playerPositionInSceneLocalSpace(
  sceneId: JourneySceneId,
  origin: readonly [number, number, number],
  player: readonly [number, number, number],
): readonly [number, number] {
  const heading = getJourneySceneLayout(sceneId).anchor.headingRadians;
  const cosine = Math.cos(heading);
  const sine = Math.sin(heading);
  const deltaX = player[0] - origin[0];
  const deltaZ = player[2] - origin[2];
  return [
    deltaX * cosine - deltaZ * sine,
    deltaX * sine + deltaZ * cosine,
  ];
}

function distanceToJourneyActionTarget(
  sceneId: JourneySceneId,
  target: JourneyPlayerActionTarget,
  origin: readonly [number, number, number],
  player: readonly [number, number, number],
) {
  const playerLocalPosition = playerPositionInSceneLocalSpace(sceneId, origin, player);
  const [targetX, targetZ] = resolveJourneyPlayerActionTargetLocalPosition(
    target,
    getJourneySceneArrivalHeading(sceneId),
  );
  return Math.hypot(
    playerLocalPosition[0] - targetX,
    playerLocalPosition[1] - targetZ,
  );
}

function hasNarrativeProgressionState(
  state: JourneyAccessState,
): state is JourneyAccessState & JourneyProgressionState {
  return Boolean(
    typeof state.activeEntryId === "string" &&
      Array.isArray(state.witnessedEntryIds) &&
      Array.isArray(state.completedRitualIds) &&
      state.worldFlags &&
      Array.isArray(state.completedChapterIds) &&
      Array.isArray(state.completedSceneIds) &&
      typeof state.storyStarted === "boolean" &&
      typeof state.storyCompleted === "boolean",
  );
}

/**
 * The semantic archive may connect related memories, but unwitnessed scenes
 * awaken in narrative order. The six-region check remains as a compatibility
 * fallback for callers that have not yet hydrated schema-v2 progression.
 */
export function canEnterJourneyEntry(
  targetEntryId: string,
  currentEntryId: string,
  state: JourneyAccessState,
) {
  if (!targetEntryId || targetEntryId === currentEntryId) return true;

  if (hasNarrativeProgressionState(state)) {
    return canEnterNarrativeEntry(targetEntryId, state);
  }

  if (state.visitedEntryIds.includes(targetEntryId)) return true;

  const targetAct = getJourneyActForEntry(targetEntryId);
  const currentAct = getJourneyActForEntry(currentEntryId);
  if (!targetAct || !currentAct) return true;

  // The opening acknowledgement is what makes the first path readable.
  if (!state.inventory.lantern) return false;

  const targetIndex = actIndex(targetAct.id);
  const currentIndex = actIndex(currentAct.id);
  if (targetIndex <= currentIndex) return true;

  return journeyActs
    .slice(0, targetIndex)
    .every((act) => state.completedActs.includes(act.id));
}

export function journeyEntryLockMessage(targetEntryId: string) {
  const chapter = getJourneyChapterForEntry(targetEntryId);
  const scene = getJourneySceneForEntry(targetEntryId);
  if (chapter && scene) {
    return `${chapter.title} is not open yet. ${scene.title} will awaken when the current memory has settled.`;
  }
  const act = getJourneyActForEntry(targetEntryId);
  return act
    ? `${act.title} is not open yet. The current act still has something to witness.`
    : "That part of the wood is not open yet.";
}

function applyJourneyOutcome(outcome: JourneyOutcome) {
  const journey = useJourneyStore.getState();
  if (outcome.type === "complete-ritual") journey.completeRitual(outcome.ritualId);
  if (outcome.type === "set-world-flag") journey.setWorldFlag(outcome.flagId, outcome.value);
  if (outcome.type === "set-landmark-state") journey.setLandmarkState(outcome.landmarkId, outcome.state);
  if (outcome.type === "add-resonance") journey.addResonance(outcome.resonance, outcome.amount);
  if (outcome.type === "award-lantern") journey.awardLantern();
  if (outcome.type === "recover-key") journey.recoverKey(outcome.keyId);
  if (outcome.type === "collect-symbolic-object") journey.collectSymbolicObject(outcome.objectId);
  if (outcome.type === "release-word") journey.releaseWord(outcome.word);
  if (outcome.type === "complete-act") journey.completeAct(outcome.actId);
  if (outcome.type === "complete-story") journey.completeStory();
}

function transformationBeatForAct(act: JourneyAct) {
  return act.mainBeatIds
    .map((beatId) => getJourneyBeat(beatId))
    .find((beat) => beat?.role === "transformation");
}

function journeyCueLabel(cue: string | undefined) {
  if (!cue) return "";
  const phrase = cue.replace(/-/g, " ");
  return `${phrase.charAt(0).toUpperCase()}${phrase.slice(1)}.`;
}

function journeyTransitionMessage(beatId: string) {
  const beat = getJourneyBeat(beatId);
  if (!beat) return "";
  const cue = journeyCueLabel(beat.environmentCue);
  if (beat.role === "threshold") return cue || "A threshold opens.";
  if (beat.role === "departure") return cue || "The wood releases the path behind you.";
  if (beat.role === "arrival") return cue || "A new part of the wood receives you.";
  return "";
}

function completeReadyAct(actId: JourneyActId) {
  const act = getJourneyAct(actId);
  const state = useJourneyStore.getState();
  if (!act || state.completedActs.includes(actId)) return false;
  const index = actIndex(actId);
  if (
    index < 0 ||
    journeyActs
      .slice(0, index)
      .some((priorAct) => !state.completedActs.includes(priorAct.id))
  ) {
    return false;
  }
  if (!act.completionRequirements.every((condition) => journeyConditionMet(condition, state))) {
    return false;
  }

  const transformation = transformationBeatForAct(act);
  if (!transformation) return false;
  state.enterBeat(act.id, transformation.id);
  for (const outcome of transformation.outcomes ?? []) applyJourneyOutcome(outcome);
  return useJourneyStore.getState().completedActs.includes(act.id);
}

export function JourneyDirector({
  activeEntryId,
  mode,
  controls,
  proximity,
  reducedMotion = false,
  suppressed = false,
  onJourneyMessage,
}: JourneyDirectorProps) {
  const witnessedEntryIds = useJourneyStore((state) => state.witnessedEntryIds);
  const completedRitualIds = useJourneyStore((state) => state.completedRitualIds);
  const worldFlags = useJourneyStore((state) => state.worldFlags);
  const inventory = useJourneyStore((state) => state.inventory);
  const completedActs = useJourneyStore((state) => state.completedActs);
  const completedChapterIds = useJourneyStore((state) => state.completedChapterIds);
  const completedSceneIds = useJourneyStore((state) => state.completedSceneIds);
  const completedStoryEventIds = useJourneyStore((state) => state.completedStoryEventIds);
  const storyObjectStates = useJourneyStore((state) => state.storyObjectStates);
  const storyPlacementStates = useJourneyStore((state) => state.storyPlacementStates);
  const eventDriven = Boolean(getJourneySceneForEntry(activeEntryId));
  const storyActId = useJourneyStore((state) => state.actId);
  const storyBeatId = useJourneyStore((state) => state.beatId);
  const storyCompleted = useJourneyStore((state) => state.storyCompleted);
  const witnessEntry = useJourneyStore((state) => state.witnessEntry);
  const enterBeat = useJourneyStore((state) => state.enterBeat);
  const assistedStillness = useSettingsStore((state) => state.assistedStillness);
  const [openingRitualReady, setOpeningRitualReady] = useState(
    () => activeEntryId !== "fragment-001",
  );
  const [presentedStorySceneId, setPresentedStorySceneId] =
    useState<JourneySceneId | null>(null);

  const isPhysicallyPresent = Boolean(
    proximity?.insideClearing && proximity.nearestEntryId === activeEntryId,
  );
  const hasWitnessedActiveEntry = witnessedEntryIds.includes(activeEntryId);
  const canWitnessActiveEntry = mode === "read" || isPhysicallyPresent;

  useEffect(() => {
    const openingAlreadyResolved = completedRitualIds.includes("ritual.accept-lantern");
    if (activeEntryId !== "fragment-001" || openingAlreadyResolved) {
      setOpeningRitualReady(true);
      return;
    }

    setOpeningRitualReady(false);
    const timeout = window.setTimeout(
      () => setOpeningRitualReady(true),
      reducedMotion ? 600 : 8_000,
    );
    return () => window.clearTimeout(timeout);
  }, [activeEntryId, completedRitualIds, reducedMotion]);

  useEffect(() => {
    if (!activeEntryId || !canWitnessActiveEntry) return;
    const entryBeat = getJourneyBeatForEntry(activeEntryId);
    const activeAct = getJourneyActForEntry(activeEntryId);
    const currentState = useJourneyStore.getState();
    const currentBeat = getJourneyBeat(currentState.beatId);
    const firstAct = journeyActs[0];
    const openingArrival = firstAct ? getJourneyBeat(firstAct.mainBeatIds[0]) : undefined;
    const isUnwitnessedOpening = Boolean(
      openingArrival &&
        activeAct?.id === firstAct?.id &&
        activeEntryId === firstAct?.entryIds[0] &&
        currentState.witnessedEntryIds.length === 0 &&
        currentState.completedActs.length === 0,
    );

    witnessEntry(activeEntryId);

    if (isUnwitnessedOpening && openingArrival) {
      enterBeat(openingArrival.actId, openingArrival.id);
      return;
    }

    const transitionOwnsEntry = Boolean(
      currentBeat &&
        ["transformation", "threshold", "departure", "arrival"].includes(currentBeat.role) &&
        (currentBeat.actId === activeAct?.id ||
          getJourneyAct(currentBeat.actId)?.nextActId === activeAct?.id),
    );
    if (
      !transitionOwnsEntry &&
      entryBeat &&
      !useJourneyStore.getState().completedActs.includes(entryBeat.actId)
    ) {
      enterBeat(entryBeat.actId, entryBeat.id);
    }
  }, [activeEntryId, canWitnessActiveEntry, enterBeat, storyBeatId, witnessEntry]);

  // Reconcile one narrative outcome per state change. Keeping this bounded
  // avoids update cascades while still advancing migrated progress naturally.
  useEffect(() => {
    const state = useJourneyStore.getState();
    const outcome = nextJourneyProgressionOutcome(state);
    if (!outcome) return;

    if (outcome.type === "complete-scene") {
      state.completeScene(outcome.sceneId);
      if (useJourneyStore.getState().completedSceneIds.includes(outcome.sceneId)) {
        const scene = getJourneyScene(outcome.sceneId);
        onJourneyMessage?.(`${scene?.title ?? "The scene"} settles into memory.`);
      }
      return;
    }

    if (outcome.type === "complete-chapter") {
      state.completeChapter(outcome.chapterId);
      if (useJourneyStore.getState().completedChapterIds.includes(outcome.chapterId)) {
        const chapter = getJourneyChapter(outcome.chapterId);
        onJourneyMessage?.(`${chapter?.title ?? "This part of the path"} settles into memory.`);
      }
      return;
    }

    state.completeStory();
    if (useJourneyStore.getState().storyCompleted) {
      onJourneyMessage?.("The lantern constellation is whole.");
    }
  }, [
    completedChapterIds,
    completedRitualIds,
    completedSceneIds,
    completedStoryEventIds,
    storyObjectStates,
    storyPlacementStates,
    inventory,
    onJourneyMessage,
    storyCompleted,
    witnessedEntryIds,
    worldFlags,
  ]);

  // A ritual may happen before the final keystone in its act. Reconcile the
  // transformation whenever witnessing or ritual state changes, not only at
  // the instant an interaction finishes.
  useEffect(() => {
    for (const act of journeyActs) {
      if (completeReadyAct(act.id)) {
        onJourneyMessage?.(`${act.title} has changed. The path opens.`);
        break;
      }
    }
  }, [completedActs, completedRitualIds, onJourneyMessage, witnessedEntryIds]);

  useEffect(() => {
    const currentState = useJourneyStore.getState();
    const currentBeat = getJourneyBeat(currentState.beatId);
    const currentAct = getJourneyAct(currentState.actId);
    const activeAct = getJourneyActForEntry(activeEntryId);
    const activeEntryBeat = getJourneyBeatForEntry(activeEntryId);
    const transition = resolveJourneyBeatTransition({
      currentBeat,
      currentAct,
      activeActId: activeAct?.id,
      activeEntryBeatId: activeEntryBeat?.id,
      activeEntryWitnessed: currentState.witnessedEntryIds.includes(activeEntryId),
      canWitnessActiveEntry,
      completedActs: currentState.completedActs,
      storyCompleted: currentState.storyCompleted,
    });
    if (!transition) return;

    const timeout = window.setTimeout(() => {
      const latest = useJourneyStore.getState();
      if (latest.actId !== currentBeat?.actId || latest.beatId !== currentBeat.id) return;
      const targetBeat = getJourneyBeat(transition.beatId);
      if (!targetBeat || !journeyBeatAvailable(targetBeat, latest)) return;
      latest.enterBeat(transition.actId, transition.beatId);
      const message = journeyTransitionMessage(transition.beatId);
      if (message) onJourneyMessage?.(message);
    }, journeyBeatTransitionDelay(transition.kind, reducedMotion));

    return () => window.clearTimeout(timeout);
  }, [
    activeEntryId,
    canWitnessActiveEntry,
    completedActs,
    hasWitnessedActiveEntry,
    onJourneyMessage,
    reducedMotion,
    storyActId,
    storyBeatId,
    storyCompleted,
  ]);

  const ritualProgression = useMemo(
    () => {
      const candidate = nextResolvableRitualForEntry(
        activeEntryId,
        useJourneyStore.getState(),
      );
      return candidate?.ritualId === "ritual.accept-lantern" && !openingRitualReady
        ? undefined
        : candidate;
    },
    [
      activeEntryId,
      completedActs,
      completedChapterIds,
      completedRitualIds,
      completedSceneIds,
      hasWitnessedActiveEntry,
      inventory,
      openingRitualReady,
      worldFlags,
    ],
  );
  const ritualBeat = ritualProgression
    ? getJourneyRitualBeat(ritualProgression.ritualId)
    : undefined;
  const ritualInteraction = ritualBeat?.interactions?.find(
    (interaction) => !completedRitualIds.includes(interaction.ritualId),
  );
  const ritual = useMemo(
    () =>
      ritualInteraction
        ? resolveRitualPresentation(ritualInteraction.ritualId, {
            verb: ritualInteraction.verb,
            label: ritualInteraction.label,
            instruction: ritualInteraction.instruction,
            inputMode: ritualInteraction.inputMode,
            durationMs: ritualInteraction.durationMs,
          })
        : null,
    [ritualInteraction],
  );

  const activeNarrativeScene = getJourneySceneForEntry(activeEntryId);
  const presentedStoryScene = presentedStorySceneId
    ? getJourneyScene(presentedStorySceneId)
    : undefined;
  const storyActionScene = presentedStoryScene ?? activeNarrativeScene;
  const storyAction = useMemo(() => {
    if (
      !storyActionScene ||
      completedSceneIds.includes(storyActionScene.id) ||
      !witnessedEntryIds.includes(storyActionScene.keystoneEntryId)
    ) {
      return null;
    }
    const available = availableJourneyPlayerActionsForScene(storyActionScene.id, worldFlags);
    if (
      storyActionScene.id !== "wolf-swan.false-choice" ||
      available.length < 2 ||
      !proximity?.playerPosition
    ) {
      return available[0] ?? nextJourneyPlayerAction(storyActionScene.id, worldFlags) ?? null;
    }

    const origin = getJourneyEntryWorldPosition(storyActionScene.keystoneEntryId);
    if (!origin) return available[0] ?? null;
    const player = proximity.playerPosition;
    return [...available].sort((left, right) => {
      const distanceTo = (action: typeof left) => {
        if (!action.target) return Number.POSITIVE_INFINITY;
        return distanceToJourneyActionTarget(
          storyActionScene.id,
          action.target,
          origin,
          player,
        );
      };
      return distanceTo(left) - distanceTo(right);
    })[0] ?? null;
  }, [completedSceneIds, proximity?.playerPosition, storyActionScene, witnessedEntryIds, worldFlags]);

  const storyActionChoiceProximity = useMemo(() => {
    if (
      storyAction?.mode !== "choice" ||
      !storyActionScene ||
      !proximity?.playerPosition
    ) {
      return null;
    }
    const origin = getJourneyEntryWorldPosition(storyActionScene.keystoneEntryId);
    if (!origin) return null;
    return nearestJourneyPlayerActionChoice(
      storyAction,
      playerPositionInSceneLocalSpace(
        storyActionScene.id,
        origin,
        proximity.playerPosition,
      ),
      getJourneySceneArrivalHeading(storyActionScene.id),
    );
  }, [proximity?.playerPosition, storyAction, storyActionScene]);
  const storyActionChoice = storyActionChoiceProximity?.choice ?? null;

  // Nearby clearing boundaries can update activeEntryId while the player is
  // reading or reaching for an authored control. Once that control is
  // presented, keep the whole scene's action chain stable until it resolves.
  // Deliberately leaving Explore mode releases the presentation immediately.
  useLayoutEffect(() => {
    if (mode !== "explore" || controls !== "walk") {
      if (presentedStorySceneId) setPresentedStorySceneId(null);
      return;
    }

    if (presentedStorySceneId) {
      if (completedSceneIds.includes(presentedStorySceneId)) {
        setPresentedStorySceneId(null);
      }
      return;
    }

    if (storyAction && storyActionScene) {
      setPresentedStorySceneId(storyActionScene.id);
    }
  }, [
    completedSceneIds,
    controls,
    mode,
    presentedStorySceneId,
    storyAction,
    storyActionScene,
  ]);

  const storyActionTargetPresence = useMemo(() => {
    const target = storyActionChoice?.target ?? storyAction?.target;
    if (!target || !storyActionScene) {
      return { atTarget: true, targetDistance: null, targetLabel: null };
    }
    const origin = getJourneyEntryWorldPosition(storyActionScene.keystoneEntryId);
    const player = proximity?.playerPosition;
    if (!origin || !player) {
      return {
        atTarget: false,
        targetDistance: null,
        targetLabel: target.label,
      };
    }
    const targetDistance = distanceToJourneyActionTarget(
      storyActionScene.id,
      target,
      origin,
      player,
    );
    return {
      atTarget: targetDistance <= target.radius,
      targetDistance,
      targetLabel: target.label,
    };
  }, [proximity?.playerPosition, storyAction, storyActionChoice, storyActionScene]);

  const handleComplete = useCallback(
    (ritualId: string) => {
      const beat = getJourneyRitualBeat(ritualId);
      const interaction = beat?.interactions?.find((candidate) => candidate.ritualId === ritualId);
      if (!beat || !interaction || completedRitualIds.includes(ritualId)) return;
      const currentState = useJourneyStore.getState();
      const activeRitual = nextResolvableRitualForEntry(activeEntryId, currentState);
      if (activeRitual?.ritualId !== ritualId || !canResolveRitual(ritualId, currentState)) return;

      // Some narrative rituals moved to a more faithful canonical fragment.
      // Only claim the legacy beat when its old entry anchor still matches.
      if (beat.entryId === activeEntryId) currentState.enterBeat(beat.actId, beat.id);
      for (const outcome of beat.outcomes ?? []) applyJourneyOutcome(outcome);
      completeReadyAct(beat.actId);
      onJourneyMessage?.(`The world remembers: ${interaction.label}.`);
    },
    [activeEntryId, completedRitualIds, onJourneyMessage],
  );

  const handleStoryActionComplete = useCallback(
    (
      actionId: string,
      outcomes: readonly JourneyPlayerActionOutcome[],
      rememberedAs: string,
      choiceId?: string,
    ) => {
      const currentState = useJourneyStore.getState();
      const completedAction = JOURNEY_PLAYER_ACTIONS.find(
        (candidate) => candidate.id === actionId,
      );
      if (!completedAction) return;
      const actionScene = getJourneyScene(completedAction.sceneId);
      // An intentionally started interaction remains owned by its authored
      // scene when physics crosses a nearby portal. Validate it against that
      // scene's current durable evidence rather than the latest active entry.
      if (
        !actionScene ||
        currentState.completedSceneIds.includes(actionScene.id) ||
        !currentState.witnessedEntryIds.includes(actionScene.keystoneEntryId)
      ) return;
      if (!journeyPlayerActionAvailable(completedAction, currentState.worldFlags)) return;

      let resolvedOutcomes = outcomes;
      if (completedAction.mode === "choice") {
        const selectedChoice = completedAction.choices?.find(
          (choice) => choice.id === choiceId,
        );
        const origin = getJourneyEntryWorldPosition(actionScene.keystoneEntryId);
        const player = proximity?.playerPosition;
        if (!selectedChoice || !origin || !player) return;
        const physicallyReachedChoice = journeyPlayerActionChoiceAtTarget(
          completedAction,
          playerPositionInSceneLocalSpace(completedAction.sceneId, origin, player),
          getJourneySceneArrivalHeading(completedAction.sceneId),
        );
        if (physicallyReachedChoice?.id !== selectedChoice.id) return;
        resolvedOutcomes = selectedChoice.outcomes;
      }

      for (const outcome of resolvedOutcomes) {
        if (outcome.type === "set-world-flag") {
          useJourneyStore.getState().setWorldFlag(outcome.flagId);
        } else if (outcome.type === "collect-symbolic-object") {
          useJourneyStore.getState().collectSymbolicObject(outcome.objectId);
        } else {
          useJourneyStore.getState().awardLantern();
        }
      }
      onJourneyMessage?.(rememberedAs);
    },
    [onJourneyMessage, proximity?.playerPosition],
  );

  return (
    <>
      <RitualInteraction
        ritual={ritual}
        active={
          !suppressed && !eventDriven &&
          mode === "explore" &&
          controls === "walk" &&
          isPhysicallyPresent
        }
        completed={Boolean(ritual && completedRitualIds.includes(ritual.id))}
        presence={{
          insideClearing: isPhysicallyPresent,
          playerPosition: proximity?.playerPosition ?? null,
        }}
        reducedMotion={reducedMotion}
        onComplete={handleComplete}
      />
      <StoryMomentInteraction
        action={ritual ? null : storyAction}
        choice={ritual ? null : storyActionChoice}
        active={
          !suppressed && !eventDriven &&
          mode === "explore" &&
          controls === "walk" &&
          isPhysicallyPresent
        }
        presence={{
          insideClearing: isPhysicallyPresent,
          playerPosition: proximity?.playerPosition ?? null,
          cameraYaw: proximity?.cameraYaw ?? null,
          ...storyActionTargetPresence,
        }}
        reducedMotion={reducedMotion}
        assistedStillness={assistedStillness}
        onComplete={handleStoryActionComplete}
      />
    </>
  );
}

export default JourneyDirector;
