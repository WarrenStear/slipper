import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import {
  getJourneyRitualBeat,
  getJourneyScene,
  getJourneySceneForEntry,
} from "../../../data/journeyBlueprint";
import {
  getJourneyEntryWorldPosition,
  getJourneySceneArrivalHeading,
  getJourneySceneLayout,
} from "../../../data/journeyWorldLayout";
import {
  nextResolvableRitualForEntry,
} from "../../../lib/journeyProgression";
import {
  availableJourneyPlayerActionsForScene,
  JOURNEY_PLAYER_ACTIONS,
  nearestJourneyPlayerActionChoice,
  nextJourneyPlayerAction,
  resolveJourneyPlayerActionTargetLocalPosition,
  type JourneyPlayerActionTarget,
  type JourneyPlayerActionOutcome,
} from "../../../lib/journeyPlayerActions";
import type {
  JourneySceneId,
} from "../../../lib/storyJourneyState";
import type { StoryLease } from "../../../narrative/StoryIntents";
import { useStoryRuntime, useStoryRuntimeHost } from "../../../experience/StoryRuntimeContext";
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

// Preserve historic imports while all access interpretation lives in the narrative domain.
export { canEnterJourneyEntry, journeyEntryLockMessage } from "../../../narrative/StorySelectors";

export type JourneyDirectorProps = {
  activeEntryId: string;
  mode: StorySceneMode;
  controls: StorySceneControls;
  proximity: SceneProximityState | null;
  reducedMotion?: boolean;
  suppressed?: boolean;
  onJourneyMessage?: (message: string) => void;
};

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
  const eventDriven = Boolean(getJourneySceneForEntry(activeEntryId));
  const runtime = useStoryRuntime();
  const host = useStoryRuntimeHost();
  const legacyOwner = useRef<{ sceneId: JourneySceneId; token: StoryLease } | null>(null);
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

  useLayoutEffect(() => {
    if (mode !== "explore" || controls !== "walk" || !storyActionScene || !storyAction) {
      if (legacyOwner.current) runtime?.cancelLegacyAction(legacyOwner.current.token);
      legacyOwner.current = null;
      return;
    }
    if (legacyOwner.current?.sceneId === storyActionScene.id) return;
    const lease = runtime?.currentLease();
    if (!runtime || !lease) return;
    const started = runtime.dispatch({ type: "legacy-start", actionId: storyAction.id, lease });
    if (started.actionToken) legacyOwner.current = { sceneId: storyActionScene.id, token: started.actionToken };
  }, [controls, mode, runtime, storyAction, storyActionScene]);

  const handleComplete = useCallback((ritualId: string) => {
    const lease = runtime?.currentLease();
    if (!runtime || !lease) return;
    const result = runtime.dispatch({ type: "ritual", ritualId, lease });
    if (result.accepted) for (const message of result.messages) onJourneyMessage?.(message);
  }, [onJourneyMessage, runtime]);

  const handleStoryActionComplete = useCallback((actionId: string,
    _outcomes: readonly JourneyPlayerActionOutcome[], _rememberedAs: string, choiceId?: string) => {
    const lease = runtime?.currentLease();
    if (!runtime || !lease) return;
    const action = JOURNEY_PLAYER_ACTIONS.find(candidate => candidate.id === actionId);
    const actionScene = action && getJourneyScene(action.sceneId);
    const origin = actionScene && getJourneyEntryWorldPosition(actionScene.keystoneEntryId);
    const facts = host?.readPhysical();
    const player = facts?.available && facts.fresh && facts.settled ? facts.position : undefined;
    const result = runtime.dispatch({ type: "legacy-action", actionId, choiceId, lease,
      actionToken: legacyOwner.current?.token, source: "physical",
      playerLocalPosition: actionScene && origin && player
        ? playerPositionInSceneLocalSpace(actionScene.id, origin, player) : undefined });
    if (result.accepted) for (const message of result.messages) onJourneyMessage?.(message);
  }, [host, onJourneyMessage, runtime]);

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
