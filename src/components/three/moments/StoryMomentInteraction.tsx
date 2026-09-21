import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import type {
  JourneyPlayerAction,
  JourneyPlayerActionChoice,
  JourneyPlayerActionOutcome,
} from "../../../lib/journeyPlayerActions";
import type { Vector3Tuple } from "../../../data/slipper3dTypes";
import "./StoryMomentInteraction.css";

type StoryMomentPresence = {
  insideClearing: boolean;
  playerPosition: Vector3Tuple | null;
  cameraYaw: number | null;
  atTarget?: boolean;
  targetDistance?: number | null;
  targetLabel?: string | null;
};

type StoryMomentInteractionProps = {
  action: JourneyPlayerAction | null;
  choice?: JourneyPlayerActionChoice | null;
  active: boolean;
  presence: StoryMomentPresence;
  reducedMotion?: boolean;
  assistedStillness?: boolean;
  onComplete: (
    actionId: string,
    outcomes: readonly JourneyPlayerActionOutcome[],
    rememberedAs: string,
    choiceId?: string,
  ) => void;
};

const DEFAULT_HOLD_MS = 1_350;
const DEFAULT_STILLNESS_MS = 2_400;
const STILLNESS_RADIUS = 0.09;

function planarDistance(a: Vector3Tuple | null, b: Vector3Tuple | null) {
  if (!a || !b) return 0;
  return Math.hypot(a[0] - b[0], a[2] - b[2]);
}

function yawDistance(a: number | null, b: number | null) {
  if (a === null || b === null) return 0;
  return Math.abs(Math.atan2(Math.sin(a - b), Math.cos(a - b)));
}

function isTypingTarget(target: EventTarget | null) {
  return target instanceof HTMLElement && Boolean(
    target.closest("input, textarea, select, button, [contenteditable='true']"),
  );
}

export function StoryMomentInteraction({
  action: incomingAction,
  choice: worldChoice = null,
  active,
  presence,
  reducedMotion = false,
  assistedStillness = false,
  onComplete,
}: StoryMomentInteractionProps) {
  const [progress, setProgress] = useState(0);
  const [holding, setHolding] = useState(false);
  const [heldHands, setHeldHands] = useState({ hold: false, keep: false });
  const [assistedDualHold, setAssistedDualHold] = useState(false);
  const [assistedStillnessActive, setAssistedStillnessActive] = useState(false);
  const [latchedStillnessAction, setLatchedStillnessAction] =
    useState<JourneyPlayerAction | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const startRef = useRef<number | null>(null);
  const completedRef = useRef(false);
  const heldKeysRef = useRef(new Set<string>());
  const heldPointersRef = useRef(new Set<string>());
  const movementAnchorRef = useRef<Vector3Tuple | null>(null);
  const yawAnchorRef = useRef<number | null>(null);
  const stillnessAnchorRef = useRef<Vector3Tuple | null>(null);
  const stillnessStartedRef = useRef<number | null>(null);
  const assistedStillnessTimerRef = useRef<number | null>(null);
  const latchedStillnessActionRef = useRef<JourneyPlayerAction | null>(null);

  // Once a player deliberately enters assisted stillness, keep that authored
  // action active even if a nearby portal briefly changes the current entry.
  // The choice belongs to the action they entered, not to a later proximity
  // sample from the physics world.
  const action = latchedStillnessAction ?? incomingAction;
  const interactionTarget = action?.mode === "choice"
    ? worldChoice?.target
    : action?.target;
  const choiceReady = action?.mode !== "choice" || Boolean(worldChoice);

  const assistedStillnessLatched = Boolean(
    action?.mode === "stillness" && assistedStillness && assistedStillnessActive,
  );
  const available = Boolean(
    action &&
      choiceReady &&
      ((active && presence.insideClearing && presence.atTarget !== false) ||
        assistedStillnessLatched),
  );
  const visible = Boolean(action && (active || assistedStillnessLatched));

  const finish = useCallback(
    (choice?: JourneyPlayerActionChoice) => {
      if (!action || completedRef.current) return;
      if (action.mode === "choice" && !choice) return;
      const outcomes = choice?.outcomes ?? action.outcomes ?? [];
      if (outcomes.length === 0) return;
      completedRef.current = true;
      if (assistedStillnessTimerRef.current !== null) {
        window.clearTimeout(assistedStillnessTimerRef.current);
        assistedStillnessTimerRef.current = null;
      }
      startRef.current = null;
      stillnessStartedRef.current = null;
      heldKeysRef.current.clear();
      heldPointersRef.current.clear();
      setHolding(false);
      setHeldHands({ hold: false, keep: false });
      setAssistedDualHold(false);
      setAssistedStillnessActive(false);
      latchedStillnessActionRef.current = null;
      setLatchedStillnessAction(null);
      setProgress(1);
      setFeedback(choice ? `${action.rememberedAs} ${choice.label}.` : action.rememberedAs);
      onComplete(action.id, outcomes, action.rememberedAs, choice?.id);
    },
    [action, onComplete],
  );

  const cancelTimedAction = useCallback(() => {
    if (completedRef.current) return;
    startRef.current = null;
    setHolding(false);
    setProgress(0);
  }, []);

  const beginTimedAction = useCallback(() => {
    if (!action || !available || completedRef.current || startRef.current !== null) return;
    startRef.current = performance.now();
    setHolding(true);
    setProgress(0.015);
  }, [action, available]);

  const beginAssistedStillness = useCallback(() => {
    if (
      !assistedStillness ||
      !action ||
      action.mode !== "stillness" ||
      !available ||
      completedRef.current
    ) return;
    latchedStillnessActionRef.current = action;
    setLatchedStillnessAction(action);
    stillnessAnchorRef.current = presence.playerPosition;
    stillnessStartedRef.current = performance.now();
    setAssistedStillnessActive(true);
    setProgress(0.015);
    if (assistedStillnessTimerRef.current !== null) {
      window.clearTimeout(assistedStillnessTimerRef.current);
    }
    // Once intentionally entered, assisted stillness is a deliberate input in
    // its own right. Complete from that input's clock instead of depending on
    // a continuously mounted RAF effect; renderer/proximity reconciliation may
    // legitimately drop a frame without revoking the player's choice.
    assistedStillnessTimerRef.current = window.setTimeout(
      () => finish(),
      Math.max(650, action.durationMs ?? DEFAULT_STILLNESS_MS),
    );
  }, [action, assistedStillness, available, finish, presence.playerPosition]);

  const cancelAssistedStillness = useCallback(() => {
    if (completedRef.current) return;
    if (assistedStillnessTimerRef.current !== null) {
      window.clearTimeout(assistedStillnessTimerRef.current);
      assistedStillnessTimerRef.current = null;
    }
    stillnessStartedRef.current = null;
    setAssistedStillnessActive(false);
    latchedStillnessActionRef.current = null;
    setLatchedStillnessAction(null);
    setProgress(0);
  }, []);

  const syncDualHold = useCallback(() => {
    if (!action || action.mode !== "dual-hold" || !available || completedRef.current) return;
    const keyCodes = action.keyCodes ?? ["KeyQ", "KeyE"];
    const keyboardReady = keyCodes.every((code) => heldKeysRef.current.has(code));
    const pointerReady = heldPointersRef.current.has("hold") && heldPointersRef.current.has("keep");
    setHeldHands({
      hold: heldKeysRef.current.has(keyCodes[0]) || heldPointersRef.current.has("hold") || assistedDualHold,
      keep: heldKeysRef.current.has(keyCodes[1]) || heldPointersRef.current.has("keep") || assistedDualHold,
    });
    if (keyboardReady || pointerReady || assistedDualHold) beginTimedAction();
    else cancelTimedAction();
  }, [action, assistedDualHold, available, beginTimedAction, cancelTimedAction]);

  // Reset between sequential actions before the next control is painted. A
  // passive reset can otherwise land after a fast keyboard/switch activation
  // and cancel the player's first deliberate input on the newly shown action.
  useLayoutEffect(() => {
    if (
      latchedStillnessActionRef.current &&
      assistedStillnessTimerRef.current !== null
    ) {
      return;
    }
    completedRef.current = false;
    if (assistedStillnessTimerRef.current !== null) {
      window.clearTimeout(assistedStillnessTimerRef.current);
      assistedStillnessTimerRef.current = null;
    }
    startRef.current = null;
    stillnessStartedRef.current = null;
    heldKeysRef.current.clear();
    heldPointersRef.current.clear();
    movementAnchorRef.current = null;
    yawAnchorRef.current = null;
    stillnessAnchorRef.current = null;
    setProgress(0);
    setHolding(false);
    setHeldHands({ hold: false, keep: false });
    setAssistedDualHold(false);
    setAssistedStillnessActive(false);
    latchedStillnessActionRef.current = null;
    setLatchedStillnessAction(null);
  }, [action?.id]);

  useEffect(
    () => () => {
      if (assistedStillnessTimerRef.current !== null) {
        window.clearTimeout(assistedStillnessTimerRef.current);
      }
    },
    [],
  );

  useEffect(() => {
    if (assistedStillness || !assistedStillnessActive) return;
    cancelAssistedStillness();
  }, [assistedStillness, assistedStillnessActive, cancelAssistedStillness]);

  useEffect(() => {
    if (!feedback) return;
    const timeout = window.setTimeout(() => setFeedback(null), reducedMotion ? 1_200 : 2_400);
    return () => window.clearTimeout(timeout);
  }, [feedback, reducedMotion]);

  useEffect(() => {
    if (!action || !available || completedRef.current) {
      movementAnchorRef.current = null;
      yawAnchorRef.current = null;
      stillnessAnchorRef.current = null;
      stillnessStartedRef.current = null;
      return;
    }

    if (action.mode === "move" || action.mode === "turn-and-move") {
      movementAnchorRef.current ??= presence.playerPosition;
      yawAnchorRef.current ??= presence.cameraYaw;
      const distanceProgress = Math.min(
        1,
        planarDistance(presence.playerPosition, movementAnchorRef.current) / Math.max(0.25, action.distance ?? 1),
      );
      const turnProgress = action.mode === "turn-and-move"
        ? Math.min(
            1,
            yawDistance(presence.cameraYaw, yawAnchorRef.current) / Math.max(0.2, action.turnRadians ?? 0.6),
          )
        : 1;
      const next = Math.min(distanceProgress, turnProgress);
      setProgress(next);
      if (next >= 1) finish();
      return;
    }

    if (action.mode === "stillness") {
      const position = presence.playerPosition;
      if (!position) return;
      if (assistedStillness) {
        stillnessAnchorRef.current = position;
        if (!assistedStillnessActive) {
          stillnessStartedRef.current = null;
          setProgress(0);
        } else if (stillnessStartedRef.current === null) {
          stillnessStartedRef.current = performance.now();
        }
        return;
      }
      if (
        !stillnessAnchorRef.current ||
        planarDistance(position, stillnessAnchorRef.current) > STILLNESS_RADIUS
      ) {
        stillnessAnchorRef.current = position;
        stillnessStartedRef.current = performance.now();
        setProgress(0);
      } else if (stillnessStartedRef.current === null) {
        stillnessStartedRef.current = performance.now();
      }
    }
  }, [
    action,
    assistedStillness,
    assistedStillnessActive,
    available,
    finish,
    presence.cameraYaw,
    presence.playerPosition,
  ]);

  useEffect(() => {
    if (!action || !available || completedRef.current) return;
    if (!["hold", "dual-hold", "stillness"].includes(action.mode)) return;

    let frame = 0;
    const tick = (timestamp: number) => {
      const started = action.mode === "stillness" ? stillnessStartedRef.current : startRef.current;
      if (started !== null) {
        const duration = Math.max(
          650,
          action.durationMs ?? (action.mode === "stillness" ? DEFAULT_STILLNESS_MS : DEFAULT_HOLD_MS),
        );
        const next = Math.min(1, (timestamp - started) / duration);
        setProgress(next);
        if (next >= 1) {
          finish();
          return;
        }
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [action, available, finish]);

  useEffect(() => {
    if (!action || !available) return;
    const keyCodes = action.keyCodes ?? ["KeyE"];

    const keyDown = (event: KeyboardEvent) => {
      if (!keyCodes.includes(event.code) || isTypingTarget(event.target)) return;
      event.preventDefault();
      heldKeysRef.current.add(event.code);

      if (action.mode === "dual-hold") {
        syncDualHold();
      } else if (action.mode === "hold" && !event.repeat) {
        beginTimedAction();
      } else if (action.mode === "press" && !event.repeat) {
        finish();
      } else if (action.mode === "choice" && worldChoice && !event.repeat) {
        finish(worldChoice);
      } else if (action.mode === "stillness" && assistedStillness && !event.repeat) {
        if (assistedStillnessActive) cancelAssistedStillness();
        else beginAssistedStillness();
      }
    };

    const keyUp = (event: KeyboardEvent) => {
      if (!keyCodes.includes(event.code)) return;
      heldKeysRef.current.delete(event.code);
      if (action.mode === "dual-hold") syncDualHold();
      if (action.mode === "hold") cancelTimedAction();
    };

    const clear = () => {
      heldKeysRef.current.clear();
      heldPointersRef.current.clear();
      setHeldHands({ hold: false, keep: false });
      if (!assistedDualHold) cancelTimedAction();
    };

    window.addEventListener("keydown", keyDown);
    window.addEventListener("keyup", keyUp);
    window.addEventListener("blur", clear);
    return () => {
      window.removeEventListener("keydown", keyDown);
      window.removeEventListener("keyup", keyUp);
      window.removeEventListener("blur", clear);
    };
  }, [
    action,
    assistedDualHold,
    assistedStillness,
    assistedStillnessActive,
    available,
    beginAssistedStillness,
    beginTimedAction,
    cancelAssistedStillness,
    cancelTimedAction,
    finish,
    syncDualHold,
    worldChoice,
  ]);

  useEffect(() => {
    if (action?.mode === "dual-hold") syncDualHold();
  }, [action?.mode, assistedDualHold, syncDualHold]);

  if (!action && !feedback) return null;

  return (
    <>
      {action && visible ? (
        <aside
          className={`story-moment is-${action.mode}${holding ? " is-holding" : ""}${!available ? " is-awaiting-target" : ""}`}
          aria-label={action.label}
          data-story-action-id={action.id}
          data-story-action-mode={action.mode}
          data-story-choice-presentation={action.mode === "choice" ? "world-target" : undefined}
          data-story-choice-id={action.mode === "choice" ? worldChoice?.id : undefined}
        >
          <div className="story-moment__copy">
            <span>{action.verb}</span>
            <strong>{action.mode === "choice" && worldChoice ? worldChoice.label : action.label}</strong>
            <p>
              {action.mode === "choice" && worldChoice && available
                ? `You are beside ${worldChoice.target.label}. Press E to ${action.verb} it.`
                : action.instruction}
            </p>
          </div>

          {!available && interactionTarget ? (
            <div className="story-moment__target" role="status">
              <span>approach</span>
              <strong>{presence.targetLabel ?? interactionTarget.label}</strong>
              {typeof presence.targetDistance === "number" ? (
                <em>{Math.max(1, Math.ceil(presence.targetDistance))} steps away</em>
              ) : null}
              {assistedStillness && action.mode !== "choice" ? (
                <button
                  type="button"
                  data-story-action-id={action.id}
                  data-story-action-mode={
                    action.mode === "move" || action.mode === "turn-and-move"
                      ? "accessible-move"
                      : "accessible-target"
                  }
                  aria-label={`Use an assisted approach to ${interactionTarget.label}`}
                  onClick={() => finish()}
                >
                  assisted approach
                </button>
              ) : null}
            </div>
          ) : null}

          {available && action.mode === "dual-hold" ? (
            <div className="story-moment__two-hands" aria-label="Two-hand controls">
              {(["hold", "keep"] as const).map((hand, index) => (
                <button
                  key={hand}
                  type="button"
                  className={heldHands[hand] ? "is-held" : ""}
                  data-story-action-id={action.id}
                  data-story-action-mode={action.mode}
                  data-story-action-hand={hand}
                  aria-label={`${hand === "hold" ? "Hold" : "Keep"} hand — hold ${index === 0 ? "Q" : "E"}`}
                  onPointerDown={(event) => {
                    event.currentTarget.setPointerCapture(event.pointerId);
                    heldPointersRef.current.add(hand);
                    syncDualHold();
                  }}
                  onPointerUp={() => {
                    heldPointersRef.current.delete(hand);
                    syncDualHold();
                  }}
                  onPointerCancel={() => {
                    heldPointersRef.current.delete(hand);
                    syncDualHold();
                  }}
                >
                  <span className="story-moment__key" aria-hidden="true">{index === 0 ? "Q" : "E"}</span>
                  <span>{hand}</span>
                </button>
              ))}
              <button
                type="button"
                className="story-moment__accessible"
                data-story-action-id={action.id}
                data-story-action-mode="accessible-dual-hold"
                aria-pressed={assistedDualHold}
                aria-label="Use an accessible two-hand hold"
                onClick={() => setAssistedDualHold((value) => !value)}
              >
                {assistedDualHold ? "release steady hold" : "accessible steady hold"}
              </button>
              <i className="story-moment__progress" style={{ transform: `scaleX(${progress})` }} />
            </div>
          ) : null}

          {available && action.mode === "choice" && worldChoice ? (
            <button
              type="button"
              className="story-moment__primary story-moment__world-choice"
              data-story-action-id={action.id}
              data-story-action-mode="world-choice"
              data-story-choice-id={worldChoice.id}
              data-story-object={worldChoice.label.toLowerCase().replace(/\s+/g, "-")}
              aria-label={`Press to ${action.verb} ${worldChoice.label}`}
              onClick={() => finish(worldChoice)}
            >
              <span className="story-moment__key" aria-hidden="true">E</span>
              <span>{action.verb} this</span>
            </button>
          ) : null}

          {available && (action.mode === "press" || action.mode === "hold") ? (
            <button
              type="button"
              className="story-moment__primary"
              data-story-action-id={action.id}
              data-story-action-mode={action.mode}
              aria-label={`${action.mode === "hold" ? "Hold" : "Press"} to ${action.verb}`}
              onClick={(event) => {
                if (action.mode === "press") finish();
                else if (event.detail === 0) finish();
              }}
              onPointerDown={action.mode === "hold" ? beginTimedAction : undefined}
              onPointerUp={action.mode === "hold" ? cancelTimedAction : undefined}
              onPointerCancel={action.mode === "hold" ? cancelTimedAction : undefined}
            >
              <span className="story-moment__key" aria-hidden="true">
                {action.keyCodes?.[0] === "KeyQ"
                  ? "Q"
                  : action.keyCodes?.[0] === "Delete" ? "DEL" : "E"}
              </span>
              <span>{holding ? action.verb : action.mode === "hold" ? `hold to ${action.verb}` : action.verb}</span>
              <i className="story-moment__progress" style={{ transform: `scaleX(${progress})` }} />
            </button>
          ) : null}

          {available && action.mode === "stillness" ? (
            assistedStillness ? (
              <button
                type="button"
                className="story-moment__primary story-moment__assisted-stillness"
                data-story-action-id={action.id}
                data-story-action-mode="accessible-stillness"
                aria-pressed={assistedStillnessActive}
                aria-label={assistedStillnessActive ? "Release assisted stillness" : "Enter assisted stillness"}
                onClick={assistedStillnessActive ? cancelAssistedStillness : beginAssistedStillness}
              >
                <span className="story-moment__key" aria-hidden="true">E</span>
                <span>{assistedStillnessActive ? "release stillness" : "enter stillness"}</span>
                <i className="story-moment__progress" style={{ transform: `scaleX(${progress})` }} />
              </button>
            ) : (
              <div className={`story-moment__passive${progress > 0.16 ? " is-listening" : ""}`} role="status">
                <i />
                <span>{progress > 0.16 ? "stay with this moment" : "be still"}</span>
              </div>
            )
          ) : null}

          {available && (action.mode === "move" || action.mode === "turn-and-move") ? (
            <div className="story-moment__movement" role="status">
              <span>{action.mode === "turn-and-move" ? "turn, then move" : "walk onward"}</span>
              <i><b style={{ transform: `scaleX(${progress})` }} /></i>
              <button
                type="button"
                data-story-action-id={action.id}
                data-story-action-mode="accessible-move"
                aria-label={`Use an accessible movement to ${action.verb}`}
                onClick={() => finish()}
              >
                accessible step
              </button>
            </div>
          ) : null}
        </aside>
      ) : null}

      {feedback ? (
        <p className="story-moment-feedback" role="status" aria-live="polite">
          <span aria-hidden="true">✦</span> {feedback}
        </p>
      ) : null}
    </>
  );
}

export default StoryMomentInteraction;
