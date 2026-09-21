import { useCallback, useEffect, useRef, useState } from "react";
import { useSettingsStore } from "../../../stores/useSettingsStore";
import type { ContextualRitual, RitualPresence } from "./ritualTypes";
import "./RitualInteraction.css";

type RitualInteractionProps = {
  ritual: ContextualRitual | null;
  active: boolean;
  completed: boolean;
  presence: RitualPresence;
  reducedMotion?: boolean;
  onComplete: (ritualId: string) => void;
};

const DEFAULT_HOLD_MS = 1600;
const DEFAULT_STILLNESS_MS = 6200;
const STILLNESS_DISTANCE = 0.085;
export const ASSISTED_STILLNESS_EVENT = "slipper:assisted-stillness";

function publishAssistedStillness(active: boolean, ritualId?: string) {
  window.dispatchEvent(
    new CustomEvent(ASSISTED_STILLNESS_EVENT, {
      detail: { active, ritualId: ritualId ?? null },
    }),
  );
}

function distanceSq(a: RitualPresence["playerPosition"], b: RitualPresence["playerPosition"]) {
  if (!a || !b) return Number.POSITIVE_INFINITY;
  const dx = a[0] - b[0];
  const dz = a[2] - b[2];
  return dx * dx + dz * dz;
}

export function RitualInteraction({
  ritual,
  active,
  completed,
  presence,
  reducedMotion = false,
  onComplete,
}: RitualInteractionProps) {
  const [holding, setHolding] = useState(false);
  const [progress, setProgress] = useState(0);
  const [feedbackVisible, setFeedbackVisible] = useState(false);
  const [feedbackLabel, setFeedbackLabel] = useState<string | null>(null);
  const [assistedActive, setAssistedActive] = useState(false);
  const assistedStillness = useSettingsStore((state) => state.assistedStillness);
  const startRef = useRef<number | null>(null);
  const completedRef = useRef(false);
  const stillAnchorRef = useRef<RitualPresence["playerPosition"]>(null);
  const stillStartedRef = useRef<number | null>(null);

  const available = Boolean(ritual && active && presence.insideClearing && !completed);

  const finish = useCallback(() => {
    if (!ritual || completedRef.current) return;
    completedRef.current = true;
    startRef.current = null;
    stillStartedRef.current = null;
    setHolding(false);
    setAssistedActive(false);
    if (ritual.inputMode === "stillness") publishAssistedStillness(false, ritual.id);
    setProgress(1);
    setFeedbackLabel(ritual.label);
    setFeedbackVisible(true);
    onComplete(ritual.id);
  }, [onComplete, ritual]);

  const cancelHold = useCallback(() => {
    if (completedRef.current) return;
    startRef.current = null;
    setHolding(false);
    setProgress(0);
  }, []);

  const begin = useCallback(() => {
    if (!ritual || !available || completedRef.current || ritual.inputMode === "stillness") return;
    if (ritual.inputMode === "press") {
      finish();
      return;
    }
    if (startRef.current !== null) return;
    startRef.current = performance.now();
    setHolding(true);
    setProgress(0.015);
  }, [available, finish, ritual]);

  const beginAssistedStillness = useCallback(() => {
    if (
      !assistedStillness ||
      !ritual ||
      ritual.inputMode !== "stillness" ||
      !available ||
      completedRef.current
    ) return;
    stillAnchorRef.current = presence.playerPosition;
    stillStartedRef.current = performance.now();
    setAssistedActive(true);
    publishAssistedStillness(true, ritual.id);
    setProgress(0.015);
  }, [assistedStillness, available, presence.playerPosition, ritual]);

  const cancelAssistedStillness = useCallback(() => {
    if (completedRef.current) return;
    stillStartedRef.current = null;
    setAssistedActive(false);
    publishAssistedStillness(false, ritual?.id);
    setProgress(0);
  }, [ritual?.id]);

  useEffect(() => {
    completedRef.current = completed;
    startRef.current = null;
    stillStartedRef.current = null;
    stillAnchorRef.current = presence.playerPosition;
    setHolding(false);
    setAssistedActive(false);
    publishAssistedStillness(false, ritual?.id);
    setProgress(completed ? 1 : 0);
  }, [completed, ritual?.id]);

  useEffect(
    () => () => publishAssistedStillness(false, ritual?.id),
    [ritual?.id],
  );

  useEffect(() => {
    if (assistedStillness || !assistedActive) return;
    setAssistedActive(false);
    publishAssistedStillness(false, ritual?.id);
    stillStartedRef.current = null;
    setProgress(0);
  }, [assistedActive, assistedStillness, ritual?.id]);

  useEffect(() => {
    if (!feedbackVisible) return;
    const timeout = window.setTimeout(() => {
      setFeedbackVisible(false);
      setFeedbackLabel(null);
    }, reducedMotion ? 1600 : 2800);
    return () => window.clearTimeout(timeout);
  }, [feedbackVisible, reducedMotion]);

  useEffect(() => {
    if (!ritual || !available || ritual.inputMode !== "stillness" || completedRef.current) {
      stillStartedRef.current = null;
      stillAnchorRef.current = presence.playerPosition;
      setProgress(0);
      return;
    }

    const position = presence.playerPosition;
    if (!position) return;
    if (assistedStillness) {
      stillAnchorRef.current = position;
      if (!assistedActive) {
        stillStartedRef.current = null;
        setProgress(0);
      } else if (stillStartedRef.current === null) {
        stillStartedRef.current = performance.now();
      }
      return;
    }
    if (distanceSq(position, stillAnchorRef.current) > STILLNESS_DISTANCE * STILLNESS_DISTANCE) {
      stillAnchorRef.current = position;
      stillStartedRef.current = performance.now();
      setProgress(0);
    } else if (stillStartedRef.current === null) {
      stillAnchorRef.current = position;
      stillStartedRef.current = performance.now();
    }
  }, [assistedActive, assistedStillness, available, presence.playerPosition, ritual]);

  useEffect(() => {
    if (!ritual || !available || completedRef.current || ritual.inputMode === "press") return;
    let animationFrame = 0;
    const tick = (now: number) => {
      if (ritual.inputMode === "hold" && startRef.current !== null) {
        const duration = Math.max(600, ritual.durationMs ?? DEFAULT_HOLD_MS);
        const next = Math.min(1, (now - startRef.current) / duration);
        setProgress(next);
        if (next >= 1) {
          finish();
          return;
        }
      }
      if (ritual.inputMode === "stillness" && stillStartedRef.current !== null) {
        const duration = Math.max(1800, ritual.durationMs ?? DEFAULT_STILLNESS_MS);
        const next = Math.min(1, (now - stillStartedRef.current) / duration);
        setProgress(next);
        if (next >= 1) {
          finish();
          return;
        }
      }
      animationFrame = requestAnimationFrame(tick);
    };
    animationFrame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(animationFrame);
  }, [available, finish, ritual]);

  useEffect(() => {
    if (!ritual || !available) return;
    const keyDown = (event: KeyboardEvent) => {
      if (event.code !== "KeyE" || event.repeat) return;
      const target = event.target as HTMLElement | null;
      if (target?.closest("input, textarea, select, [contenteditable='true']")) return;
      if (ritual.inputMode === "stillness") {
        if (!assistedStillness) return;
        event.preventDefault();
        if (assistedActive) cancelAssistedStillness();
        else beginAssistedStillness();
        return;
      }
      event.preventDefault();
      begin();
    };
    const keyUp = (event: KeyboardEvent) => {
      if (event.code !== "KeyE") return;
      if (ritual.inputMode === "hold") cancelHold();
    };
    window.addEventListener("keydown", keyDown);
    window.addEventListener("keyup", keyUp);
    window.addEventListener("blur", cancelHold);
    return () => {
      window.removeEventListener("keydown", keyDown);
      window.removeEventListener("keyup", keyUp);
      window.removeEventListener("blur", cancelHold);
    };
  }, [assistedActive, assistedStillness, available, begin, beginAssistedStillness, cancelAssistedStillness, cancelHold, ritual]);

  if (!ritual && !feedbackVisible) return null;

  return (
    <>
      {ritual && available ? (
        <aside
          className={`ritual-interaction is-${ritual.inputMode}${ritual.id === "ritual.surrender" ? " is-surrender" : ""}${holding ? " is-holding" : ""}${assistedStillness && ritual.inputMode === "stillness" ? " is-assisted" : ""}`}
          aria-label={ritual.label}
          data-ritual-id={ritual.id}
          data-story-moment-mode={ritual.inputMode}
        >
          {ritual.id === "ritual.surrender" ? (
            <div className="ritual-interaction__surrender-cue" role="status" aria-live="polite">
              <i />
              <span>nothing is asked of you</span>
              {assistedStillness ? (
                <button
                  type="button"
                  aria-pressed={assistedActive}
                  onClick={assistedActive ? cancelAssistedStillness : beginAssistedStillness}
                >
                  <span className="ritual-interaction__key" aria-hidden="true">E</span>
                  <span>{assistedActive ? "release stillness" : "enter stillness"}</span>
                  <i style={{ transform: `scaleX(${progress})` }} />
                </button>
              ) : null}
            </div>
          ) : (
            <>
              <div className="ritual-interaction__copy">
                <span>{ritual.verb}</span>
                <strong>{ritual.label}</strong>
                <p>{ritual.instruction}</p>
              </div>
              {ritual.inputMode === "stillness" ? (
                assistedStillness ? (
                  <button
                    type="button"
                    aria-pressed={assistedActive}
                    onClick={assistedActive ? cancelAssistedStillness : beginAssistedStillness}
                  >
                    <span className="ritual-interaction__key" aria-hidden="true">E</span>
                    <span>{assistedActive ? "release stillness" : "enter stillness"}</span>
                    <i style={{ transform: `scaleX(${progress})` }} />
                  </button>
                ) : (
                  <div className={`ritual-interaction__stillness${progress > 0.18 ? " is-listening" : ""}`} aria-hidden="true">
                    <i />
                    <span>{progress > 0.18 ? "the world is listening" : "listen"}</span>
                  </div>
                )
              ) : (
                <button
                  type="button"
                  onClick={(event) => {
                    if (ritual.inputMode === "press") {
                      begin();
                      return;
                    }
                    // A hold gesture has no native keyboard equivalent. Preserve the
                    // deliberate pointer hold while letting keyboard activation
                    // complete the ritual as one accessible, intentional action.
                    if (ritual.inputMode === "hold" && event.detail === 0) finish();
                  }}
                  onPointerDown={ritual.inputMode === "hold" ? begin : undefined}
                  onPointerUp={ritual.inputMode === "hold" ? cancelHold : undefined}
                  onPointerCancel={ritual.inputMode === "hold" ? cancelHold : undefined}
                  aria-label={`${ritual.inputMode === "hold" ? "Hold" : "Press"} to ${ritual.verb}`}
                >
                  <span className="ritual-interaction__key" aria-hidden="true">E</span>
                  <span>{holding ? ritual.verb : ritual.inputMode === "hold" ? `hold to ${ritual.verb}` : ritual.verb}</span>
                  <i style={{ transform: `scaleX(${progress})` }} />
                </button>
              )}
            </>
          )}
        </aside>
      ) : null}
      {feedbackVisible && (feedbackLabel || ritual) ? (
        <p className="ritual-feedback is-visible" role="status" aria-live="polite">
          <span aria-hidden="true">✦</span> The world remembers: {feedbackLabel ?? ritual?.label}
        </p>
      ) : null}
    </>
  );
}

export default RitualInteraction;
