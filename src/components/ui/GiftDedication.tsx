import {
  useEffect,
  useId,
  useRef,
  type KeyboardEvent as ReactKeyboardEvent,
} from "react";
import {
  setGiftDedicationAcknowledged,
} from "../../lib/dedicationPresentation";
import {
  canPresentGiftDedication,
  type GiftDedicationGate,
} from "../../lib/experienceMode";
import "./GiftDedication.css";

const FOCUSABLE_SELECTOR = [
  "a[href]",
  "button:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  "[tabindex]:not([tabindex='-1'])",
].join(",");

function visibleFocusableElements(dialog: HTMLElement) {
  return Array.from(dialog.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter(
    (element) =>
      !element.hidden &&
      element.getAttribute("aria-hidden") !== "true" &&
      element.offsetParent !== null,
  );
}

export type GiftDedicationCopy = Readonly<{
  title: string;
  subtitle: string;
  recipient: string;
  message: readonly string[];
  actionLabel: string;
}>;

export const DEFAULT_GIFT_DEDICATION_COPY = Object.freeze({
  title: "Slipper in the Woods",
  subtitle: "A journey to you.",
  recipient: "For Kylie.",
  message: Object.freeze([
    "You gave these words a forest",
    "long before it had trees.",
    "I only built somewhere",
    "for them to live.",
  ]),
  actionLabel: "Return to the Woods",
} satisfies GiftDedicationCopy);

export type GiftDedicationProps = GiftDedicationGate & {
  copy?: GiftDedicationCopy;
  onReturnToWoods: () => void;
};

export function GiftDedication({
  storyCompleted,
  inWorldConstellationRevealed,
  transitionIdle,
  copy = DEFAULT_GIFT_DEDICATION_COPY,
  onReturnToWoods,
}: GiftDedicationProps) {
  const titleId = useId();
  const descriptionId = useId();
  const dialogRef = useRef<HTMLElement>(null);
  const visible = canPresentGiftDedication({
    storyCompleted,
    inWorldConstellationRevealed,
    transitionIdle,
  });

  useEffect(() => {
    if (!visible) return;
    const dialog = dialogRef.current;
    if (!dialog) return;
    const isolatedElements: Array<{
      element: HTMLElement;
      inert: boolean;
      ariaHidden: string | null;
    }> = [];
    let activeBranch: HTMLElement = dialog;

    while (activeBranch.parentElement) {
      const parent = activeBranch.parentElement;
      for (const sibling of Array.from(parent.children)) {
        if (!(sibling instanceof HTMLElement) || sibling === activeBranch) continue;
        isolatedElements.push({
          element: sibling,
          inert: sibling.inert,
          ariaHidden: sibling.getAttribute("aria-hidden"),
        });
        sibling.inert = true;
        sibling.setAttribute("aria-hidden", "true");
      }
      if (parent === document.body) break;
      activeBranch = parent;
    }

    const keepFocusInsideDialog = (event: FocusEvent) => {
      if (event.target instanceof Node && !dialog.contains(event.target)) {
        (visibleFocusableElements(dialog)[0] ?? dialog).focus();
      }
    };
    document.addEventListener("focusin", keepFocusInsideDialog, true);
    const focusFrame = window.requestAnimationFrame(() => {
      (visibleFocusableElements(dialog)[0] ?? dialog).focus({ preventScroll: true });
    });
    return () => {
      window.cancelAnimationFrame(focusFrame);
      document.removeEventListener("focusin", keepFocusInsideDialog, true);
      for (const { element, inert, ariaHidden } of isolatedElements) {
        element.inert = inert;
        if (ariaHidden === null) element.removeAttribute("aria-hidden");
        else element.setAttribute("aria-hidden", ariaHidden);
      }
    };
  }, [visible]);

  if (!visible) return null;

  const returnToWoods = () => {
    setGiftDedicationAcknowledged(true);
    onReturnToWoods();
  };

  const handleDialogKeyDown = (event: ReactKeyboardEvent<HTMLElement>) => {
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

  return (
    <section
      ref={dialogRef}
      className="gift-dedication"
      role="dialog"
      tabIndex={-1}
      aria-modal="true"
      aria-labelledby={titleId}
      aria-describedby={descriptionId}
      data-gift-dedication="visible"
      data-final-constellation-revealed="true"
      data-story-transition="idle"
      onKeyDown={handleDialogKeyDown}
    >
      <div className="gift-dedication__stars" aria-hidden="true" />
      <div className="gift-dedication__content">
        <header className="gift-dedication__heading">
          <h1 id={titleId}>{copy.title}</h1>
          <p>{copy.subtitle}</p>
        </header>

        <div className="gift-dedication__message" id={descriptionId}>
          <p className="gift-dedication__recipient">{copy.recipient}</p>
          {copy.message.map((line, index) => <p key={`${index}:${line}`}>{line}</p>)}
        </div>

        <button type="button" onClick={returnToWoods}>
          {copy.actionLabel}
        </button>
      </div>
    </section>
  );
}

export default GiftDedication;
