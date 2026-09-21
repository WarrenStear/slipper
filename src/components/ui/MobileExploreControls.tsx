import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";
import {
  clampLookSensitivity,
  MOBILE_INPUT_RESET_EVENT,
  resolveJoystickVector,
  resolveLookDelta,
} from "../../lib/mobileControls";
import { usePlayerInputStore } from "../../stores/usePlayerInputStore";
import "./MobileExploreControls.css";

export type MobileControlMode = "direct" | "guided";
export type MobileControlSide = "left" | "right";

export type MobileJourneyHistoryItem = {
  id: string;
  title: string;
};

export type MobileExploreControlsProps = {
  mode: MobileControlMode;
  freeWoods?: boolean;
  contemplativeIdle?: boolean;
  controlSide?: MobileControlSide;
  lookSensitivity?: number;
  hapticsEnabled?: boolean;
  reducedEffects?: boolean;
  guidedTargetTitle?: string;
  guidanceActive?: boolean;
  canGoBack?: boolean;
  canGoNext?: boolean;
  canFindUnread?: boolean;
  canReturnToChapterPath?: boolean;
  journeyHistory?: MobileJourneyHistoryItem[];
  onModeChange: (mode: MobileControlMode) => void;
  onRead: () => void;
  onMap: () => void;
  onArchive: () => void;
  onReturnToVisitedEntry: (entryId: string) => void;
  onBack: () => void;
  onNext: () => void;
  onLastClearing: () => void;
  onChapterPath: () => void;
  onFindUnread: () => void;
  onGuidedMove: () => void;
  onCancelGuidance: () => void;
  onOpenSettings: () => void;
  onLeaveForest: () => void;
};

type ActiveLookPointer = {
  id: number;
  x: number;
  y: number;
};

function releaseCapture(
  element: HTMLElement | null,
  pointerId: number | null,
) {
  if (!element || pointerId === null) return;
  try {
    if (element.hasPointerCapture(pointerId)) {
      element.releasePointerCapture(pointerId);
    }
  } catch {
    // Pointer capture may already have been released by the browser.
  }
}

function gentleHaptic(enabled: boolean, reducedEffects: boolean, duration = 6) {
  if (
    !enabled ||
    reducedEffects ||
    typeof navigator === "undefined" ||
    typeof navigator.vibrate !== "function"
  ) {
    return;
  }

  try {
    navigator.vibrate(Math.max(1, Math.min(12, duration)));
  } catch {
    // Haptics are optional and must never interrupt an action.
  }
}

export default function MobileExploreControls({
  mode,
  freeWoods = false,
  contemplativeIdle = false,
  controlSide = "left",
  lookSensitivity = 1,
  hapticsEnabled = false,
  reducedEffects = false,
  guidedTargetTitle,
  guidanceActive = false,
  canGoBack = true,
  canGoNext = true,
  canFindUnread = true,
  canReturnToChapterPath = true,
  journeyHistory = [],
  onModeChange,
  onRead,
  onMap,
  onArchive,
  onReturnToVisitedEntry,
  onBack,
  onNext,
  onLastClearing,
  onChapterPath,
  onFindUnread,
  onGuidedMove,
  onCancelGuidance,
  onOpenSettings,
  onLeaveForest,
}: MobileExploreControlsProps) {
  const joystickRef = useRef<HTMLDivElement>(null);
  const joystickThumbRef = useRef<HTMLSpanElement>(null);
  const lookRef = useRef<HTMLDivElement>(null);
  const joystickPointerRef = useRef<number | null>(null);
  const lookPointerRef = useRef<ActiveLookPointer | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [controlsCollapsed, setControlsCollapsed] = useState(false);
  const safeLookSensitivity = clampLookSensitivity(lookSensitivity);

  const resetPointers = useCallback(() => {
    const joystickPointerId = joystickPointerRef.current;
    const lookPointerId = lookPointerRef.current?.id ?? null;
    joystickPointerRef.current = null;
    lookPointerRef.current = null;
    releaseCapture(joystickRef.current, joystickPointerId);
    releaseCapture(lookRef.current, lookPointerId);
    if (joystickThumbRef.current) {
      joystickThumbRef.current.style.transform = "translate3d(0px, 0px, 0)";
      joystickThumbRef.current.classList.remove("is-active");
    }
    usePlayerInputStore.getState().reset();
  }, []);

  useEffect(() => {
    const handleExternalReset = () => resetPointers();
    window.addEventListener(MOBILE_INPUT_RESET_EVENT, handleExternalReset);
    return () => {
      window.removeEventListener(MOBILE_INPUT_RESET_EVENT, handleExternalReset);
      resetPointers();
    };
  }, [resetPointers]);

  useEffect(() => {
    resetPointers();
  }, [mode, controlSide, resetPointers]);

  const updateJoystick = (event: ReactPointerEvent<HTMLDivElement>) => {
    const element = joystickRef.current;
    if (!element) return;
    const bounds = element.getBoundingClientRect();
    const vector = resolveJoystickVector({
      center: {
        x: bounds.left + bounds.width / 2,
        y: bounds.top + bounds.height / 2,
      },
      pointer: { x: event.clientX, y: event.clientY },
      radius: Math.max(32, Math.min(bounds.width, bounds.height) * 0.34),
    });

    if (joystickThumbRef.current) {
      joystickThumbRef.current.style.transform =
        `translate3d(${vector.thumbX}px, ${vector.thumbY}px, 0)`;
      joystickThumbRef.current.classList.add("is-active");
    }
    usePlayerInputStore.getState().setMovement(vector.moveX, vector.moveZ);
  };

  const endJoystick = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (joystickPointerRef.current !== event.pointerId) return;
    joystickPointerRef.current = null;
    releaseCapture(event.currentTarget, event.pointerId);
    if (joystickThumbRef.current) {
      joystickThumbRef.current.style.transform = "translate3d(0px, 0px, 0)";
      joystickThumbRef.current.classList.remove("is-active");
    }
    usePlayerInputStore.getState().setMovement(0, 0);
  };

  const endLook = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (lookPointerRef.current?.id !== event.pointerId) return;
    lookPointerRef.current = null;
    releaseCapture(event.currentTarget, event.pointerId);
  };

  const runAction = (action: () => void, closeMenu = true) => {
    gentleHaptic(hapticsEnabled, reducedEffects);
    action();
    if (closeMenu) {
      setMenuOpen(false);
      setHistoryOpen(false);
    }
  };

  return (
    <section
      className={[
        "mobile-explore-controls",
        `is-${mode}`,
        `controls-${controlSide}`,
        contemplativeIdle ? "is-contemplative-idle" : "",
        controlsCollapsed ? "is-collapsed" : "",
      ]
        .filter(Boolean)
        .join(" ")}
      aria-label="Mobile forest controls"
    >
      {freeWoods ? <div className="mobile-control-header">
        <div className="mobile-control-mode" role="group" aria-label="Mobile exploration style">
          <button
            type="button"
            className={mode === "direct" ? "is-active" : ""}
            aria-pressed={mode === "direct"}
            onClick={() => runAction(() => onModeChange("direct"), false)}
          >
            Direct
          </button>
          <button
            type="button"
            className={mode === "guided" ? "is-active" : ""}
            aria-pressed={mode === "guided"}
            onClick={() => runAction(() => onModeChange("guided"), false)}
          >
            Guided
          </button>
        </div>

        <div className="mobile-control-header-actions">
          <button
            type="button"
            aria-expanded={menuOpen}
            aria-controls="mobile-forest-more-actions"
            onClick={() => {
              gentleHaptic(hapticsEnabled, reducedEffects);
              setMenuOpen((current) => !current);
            }}
          >
            More
          </button>
          <button
            type="button"
            aria-expanded={!controlsCollapsed}
            aria-controls="mobile-direct-inputs"
            aria-label={controlsCollapsed ? "Expand movement controls" : "Collapse movement controls"}
            onClick={() => {
              resetPointers();
              setControlsCollapsed((current) => !current);
            }}
          >
            {controlsCollapsed ? "Open" : "Hide"}
          </button>
        </div>
      </div> : null}

      {mode === "guided" && !controlsCollapsed ? (
        <div className="mobile-guided-actions" aria-live="polite">
          <span>Lantern route</span>
          <strong>{guidedTargetTitle ?? "No valid guide target"}</strong>
          <p>Guidance reveals direction. You remain in control of walking and looking.</p>
          <div>
            <button
              type="button"
              disabled={!guidedTargetTitle}
              onClick={() => runAction(onGuidedMove, false)}
            >
              {guidanceActive ? "Refresh route" : "Follow lantern"}
            </button>
            {guidanceActive ? (
              <button type="button" onClick={() => runAction(onCancelGuidance, false)}>
                Cancel
              </button>
            ) : null}
          </div>
        </div>
      ) : null}

      {!controlsCollapsed ? (
        <div id="mobile-direct-inputs" className="mobile-direct-layout">
          <div
            ref={joystickRef}
            className="mobile-joystick"
            role="group"
            aria-label="Analogue movement control"
            onPointerDown={(event) => {
              if (
                joystickPointerRef.current !== null &&
                joystickPointerRef.current !== event.pointerId
              ) {
                return;
              }
              event.preventDefault();
              event.stopPropagation();
              joystickPointerRef.current = event.pointerId;
              try {
                event.currentTarget.setPointerCapture(event.pointerId);
              } catch {
                // The pointer can still be tracked until it leaves the surface.
              }
              gentleHaptic(hapticsEnabled, reducedEffects, 4);
              updateJoystick(event);
            }}
            onPointerMove={(event) => {
              if (joystickPointerRef.current !== event.pointerId) return;
              event.preventDefault();
              updateJoystick(event);
            }}
            onPointerUp={endJoystick}
            onPointerCancel={resetPointers}
            onLostPointerCapture={(event) => {
              if (joystickPointerRef.current === event.pointerId) resetPointers();
            }}
          >
            <span className="mobile-joystick-ring" aria-hidden="true" />
            <span
              ref={joystickThumbRef}
              className="mobile-joystick-thumb"
              aria-hidden="true"
            />
            <small>Move</small>
          </div>

          <div
            ref={lookRef}
            className="mobile-look-pad"
            role="group"
            aria-label="Drag to look around"
            onPointerDown={(event) => {
              if (
                lookPointerRef.current !== null &&
                lookPointerRef.current.id !== event.pointerId
              ) {
                return;
              }
              event.preventDefault();
              event.stopPropagation();
              try {
                event.currentTarget.setPointerCapture(event.pointerId);
              } catch {
                // The pointer can still be tracked until it leaves the surface.
              }
              lookPointerRef.current = {
                id: event.pointerId,
                x: event.clientX,
                y: event.clientY,
              };
              gentleHaptic(hapticsEnabled, reducedEffects, 3);
            }}
            onPointerMove={(event) => {
              const current = lookPointerRef.current;
              if (!current || current.id !== event.pointerId) return;
              event.preventDefault();
              const delta = resolveLookDelta({
                deltaX: event.clientX - current.x,
                deltaY: event.clientY - current.y,
                sensitivity: safeLookSensitivity,
              });
              usePlayerInputStore.getState().addLookDelta(delta.x, delta.y);
              current.x = event.clientX;
              current.y = event.clientY;
            }}
            onPointerUp={endLook}
            onPointerCancel={resetPointers}
            onLostPointerCapture={(event) => {
              if (lookPointerRef.current?.id === event.pointerId) resetPointers();
            }}
          >
            <span aria-hidden="true">↔</span>
            <strong>Look</strong>
            <small>Drag independently</small>
          </div>
        </div>
      ) : null}

      <div className="mobile-mode-actions">
        <button type="button" onClick={() => runAction(onRead)}>Read</button>
        {freeWoods ? <button type="button" onClick={() => runAction(onMap)}>Map</button> : null}
        {!freeWoods ? <button type="button" onClick={() => runAction(onOpenSettings)}>Settings</button> : null}
      </div>

      {freeWoods && menuOpen ? (
        <div
          id="mobile-forest-more-actions"
          className="mobile-more-sheet"
          aria-label="More forest actions"
        >
          <div className="mobile-more-action-grid">
            <button type="button" onClick={() => runAction(onArchive)}>Archive</button>
            <button
              type="button"
              aria-expanded={historyOpen}
              aria-controls="mobile-journey-history"
              disabled={journeyHistory.length === 0}
              onClick={() => setHistoryOpen((current) => !current)}
            >
              Journey history
            </button>
            <button type="button" disabled={!canGoBack} onClick={() => runAction(onBack)}>
              Back
            </button>
            <button type="button" disabled={!canGoNext} onClick={() => runAction(onNext)}>
              Next
            </button>
            <button type="button" onClick={() => runAction(onLastClearing)}>
              Last clearing
            </button>
            <button
              type="button"
              disabled={!canReturnToChapterPath}
              onClick={() => runAction(onChapterPath)}
            >
              Chapter path
            </button>
            <button
              type="button"
              disabled={!canFindUnread}
              onClick={() => runAction(onFindUnread)}
            >
              Find unread
            </button>
            <button type="button" onClick={() => runAction(onOpenSettings)}>
              Settings
            </button>
            <button type="button" onClick={() => runAction(onLeaveForest)}>
              Threshold
            </button>
          </div>

          {historyOpen ? (
            <div id="mobile-journey-history" className="mobile-journey-history">
              <strong>Visited trail</strong>
              <div>
                {journeyHistory.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() =>
                      runAction(() => onReturnToVisitedEntry(item.id))
                    }
                  >
                    {item.title}
                  </button>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
