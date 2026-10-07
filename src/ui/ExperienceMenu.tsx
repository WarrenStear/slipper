import { useEffect, useId, useRef, type ReactNode, type RefObject } from "react";
import type { SlipperExperienceCapabilities } from "../lib/experienceMode";
import "./ExperienceMenu.css";

export type ExperienceMenuAction = Readonly<{
  id: string;
  label: string;
  disabled?: boolean;
  onSelect: () => boolean | void;
}>;
export type ExperienceMenuProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  capabilities: SlipperExperienceCapabilities;
  fragmentAvailable: boolean;
  /** Earned directed viewer availability; full exploration is available by default. */
  constellationAvailable?: boolean;
  onFragment: () => boolean | void;
  onConstellation: () => void;
  onArchive: () => void;
  onSettings: () => void;
  onHelp?: () => void;
  navigationActions?: readonly ExperienceMenuAction[];
  /** Existing route controls can remain inside the deliberate menu disclosure. */
  navigationDetails?: ReactNode;
  triggerRef?: RefObject<HTMLButtonElement>;
};

/** Controlled UI only. The shell owns modal activity and all accepted commands. */
export function ExperienceMenu({ open, onOpenChange, capabilities, fragmentAvailable,
  constellationAvailable = capabilities.allowConstellationNavigation,
  onFragment, onConstellation, onArchive, onSettings, onHelp, navigationActions = [],
  navigationDetails, triggerRef }: ExperienceMenuProps) {
  const dialogId = useId(), titleId = useId();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const internalTrigger = useRef<HTMLButtonElement>(null);
  const trigger = triggerRef ?? internalTrigger;
  const restoreFocus = useRef(false);
  const dismiss = () => { restoreFocus.current = true; onOpenChange(false); };
  const select = (callback: () => boolean | void) => {
    const accepted = callback();
    if (accepted === false) return;
    restoreFocus.current = false;
    onOpenChange(false);
  };
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      try { dialog.showModal(); }
      catch { dialog.setAttribute("open", ""); }
      closeRef.current?.focus({ preventScroll: true });
    }
    if (!open) {
      if (dialog.open) dialog.close();
      // Selection hands focus to its destination; dismiss returns to Memories.
      if (restoreFocus.current && trigger.current?.isConnected) trigger.current.focus({ preventScroll: true });
      restoreFocus.current = false;
    }
    return () => { if (dialog.open) dialog.close(); };
  }, [open, trigger]);
  return <>
    <button ref={trigger} id="experience-memories-trigger" type="button" className="experience-menu__trigger"
      aria-haspopup="dialog" aria-expanded={open} aria-controls={dialogId}
      onClick={() => onOpenChange(true)}>Memories</button>
    <dialog ref={dialogRef} id={dialogId} className="experience-menu" aria-labelledby={titleId}
      onCancel={event => { event.preventDefault(); dismiss(); }}
      onKeyDown={event => {
        if (event.key === "Escape") { event.preventDefault(); dismiss(); return; }
        if (event.key !== "Tab") return;
        const controls = Array.from(event.currentTarget.querySelectorAll<HTMLElement>(
          "button:not(:disabled),a[href],input:not(:disabled),select:not(:disabled),textarea:not(:disabled),summary,[tabindex]:not([tabindex='-1'])",
        )).filter(element => {
          const closedPaths = element.closest("details:not([open])");
          if (closedPaths && !closedPaths.querySelector(":scope > summary")?.contains(element)) return false;
          return !element.hidden && element.offsetParent !== null
            && Array.from(element.getClientRects()).some(rect => rect.width > 0 && rect.height > 0);
        });
        const first = controls[0], last = controls[controls.length - 1];
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
      }}
      onClick={event => { if (event.target === event.currentTarget) dismiss(); }}>
      <div className="experience-menu__body">
        <header><h2 id={titleId}>Memories</h2><button ref={closeRef} type="button" onClick={dismiss} aria-label="Close memories">Close</button></header>
        <nav aria-label="Memory views">
          {capabilities.allowContextualReading ? <button type="button" disabled={!fragmentAvailable}
            onClick={() => select(onFragment)}>Fragment</button> : null}
          {capabilities.allowConstellationView && constellationAvailable ? <button type="button"
            onClick={() => select(onConstellation)}>Constellation</button> : null}
          {capabilities.allowFullArchive ? <button type="button" onClick={() => select(onArchive)}>Archive</button> : null}
          {capabilities.allowSettings ? <button type="button" onClick={() => select(onSettings)}>Settings</button> : null}
        </nav>
        {onHelp ? <button type="button" className="experience-menu__help" onClick={() => select(onHelp)}>Help with this place</button> : null}
        {capabilities.showGenericNavigation && (navigationActions.length > 0 || navigationDetails) ? <details>
          <summary>Walking and remembered paths</summary>
          <div className="experience-menu__paths">
            {navigationActions.map(action => <button type="button" key={action.id} disabled={action.disabled}
              onClick={() => select(action.onSelect)}>{action.label}</button>)}
            {navigationDetails}
          </div>
        </details> : null}
      </div>
    </dialog>
  </>;
}
