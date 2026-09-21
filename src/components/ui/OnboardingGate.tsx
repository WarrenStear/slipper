import {
  useEffect,
  useRef,
  type KeyboardEvent as ReactKeyboardEvent,
} from "react";
import {
  applyStoredMotionPreference,
  setOnboardingComplete,
} from "../../lib/experiencePreferences";
import type { SlipperStartState } from "../../lib/experienceMode";
import "./OnboardingGate.css";

const FOCUSABLE_SELECTOR = [
  "a[href]",
  "button:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  "[tabindex]:not([tabindex='-1'])",
].join(",");

function visibleFocusableElements(dialog: HTMLElement) {
  return Array.from(
    dialog.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR),
  ).filter(
    (element) =>
      !element.hidden &&
      element.getAttribute("aria-hidden") !== "true" &&
      element.offsetParent !== null,
  );
}

export type OnboardingGateProps = {
  onBegin: () => void;
  onOpenSettings?: () => void;
  startState: SlipperStartState;
  restoring?: boolean;
};

export function OnboardingGate({
  onBegin,
  onOpenSettings,
  startState,
  restoring = false,
}: OnboardingGateProps) {
  const dialogRef = useRef<HTMLElement>(null);
  const primaryActionRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    applyStoredMotionPreference();
  }, []);

  useEffect(() => {
    if (restoring) return;
    const focusDelay = window.matchMedia("(prefers-reduced-motion: reduce)").matches
      ? 0
      : 3_250;
    const focusTimer = window.setTimeout(() => {
      if (document.querySelector("#experience-settings-dialog[open]")) return;
      primaryActionRef.current?.focus({ preventScroll: true });
    }, focusDelay);
    return () => window.clearTimeout(focusTimer);
  }, [restoring]);

  useEffect(() => {
    const keepFocusInsideDialog = (event: FocusEvent) => {
      const dialog = dialogRef.current;
      const target = event.target;
      if (
        !dialog ||
        !(target instanceof Element) ||
        dialog.contains(target)
      ) {
        return;
      }

      // The global settings drawer is a nested native modal. Let it own focus
      // while open; it restores focus to its onboarding trigger when closed.
      if (target.closest("dialog[open]")) return;

      (visibleFocusableElements(dialog)[0] ?? dialog).focus();
    };

    document.addEventListener("focusin", keepFocusInsideDialog, true);
    return () => {
      document.removeEventListener("focusin", keepFocusInsideDialog, true);
    };
  }, []);

  const handleDialogKeyDown = (
    event: ReactKeyboardEvent<HTMLElement>,
  ) => {
    if (event.key !== "Tab") return;

    const dialog = dialogRef.current;
    if (!dialog) return;
    const focusable = visibleFocusableElements(dialog);
    if (focusable.length === 0) {
      event.preventDefault();
      dialog.focus();
      return;
    }

    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    const active = document.activeElement;
    if (event.shiftKey && (active === first || active === dialog)) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && active === last) {
      event.preventDefault();
      first.focus();
    }
  };

  const begin = () => {
    setOnboardingComplete(true);
    onBegin();
  };

  return (
    <section
      ref={dialogRef}
      className="onboarding-gate is-story-first"
      role="dialog"
      tabIndex={-1}
      aria-modal="true"
      aria-busy={restoring}
      aria-labelledby="onboarding-title"
      aria-describedby="onboarding-description"
      data-start-state={startState.id}
      onKeyDown={handleDialogKeyDown}
    >
      <div className="onboarding-grain" aria-hidden="true" />
      <div className="onboarding-card">
        <h1 id="onboarding-title">SLIPPER IN THE WOODS</h1>
        <p className="onboarding-copy" id="onboarding-description">A journey to you.</p>
        <div className="onboarding-actions">
          <button
            ref={primaryActionRef}
            type="button"
            className="primary"
            disabled={restoring}
            onClick={begin}
          >
            {restoring ? "Restoring the path…" : startState.actionLabel}
          </button>
        </div>
      </div>
      {onOpenSettings ? (
        <button
          type="button"
          className="onboarding-settings"
          aria-label="Accessibility and sound settings"
          onClick={(event) => {
            event.currentTarget.focus();
            onOpenSettings();
          }}
        >
          <span aria-hidden="true">◌</span>
          <span className="sr-only">Accessibility and sound settings</span>
        </button>
      ) : null}
    </section>
  );
}

export default OnboardingGate;
