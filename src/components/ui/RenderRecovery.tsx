import { Component, useEffect, useRef, type ErrorInfo, type ReactNode } from "react";
import "./RenderRecovery.css";

type RecoveryProps = { onContinueTextJourney: () => void };

export function RenderRecovery({ onContinueTextJourney }: RecoveryProps) {
  const headingRef = useRef<HTMLHeadingElement>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    if (document.pointerLockElement) document.exitPointerLock?.();
    const dialog = dialogRef.current;
    dialog?.showModal();
    headingRef.current?.focus({ preventScroll: true });
    return () => dialog?.close();
  }, []);

  return (
    <dialog
      ref={dialogRef}
      className="render-recovery"
      aria-labelledby="render-recovery-title"
      aria-describedby="render-recovery-description"
      onCancel={event => event.preventDefault()}
      onKeyDown={event => {
        event.stopPropagation();
        if (event.key !== "Tab") return;
        const buttons = event.currentTarget.querySelectorAll<HTMLButtonElement>("button");
        const first = buttons[0];
        const last = buttons[buttons.length - 1];
        if (event.shiftKey && (document.activeElement === first || document.activeElement === headingRef.current)) {
          event.preventDefault();
          last?.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first?.focus();
        }
      }}
      onKeyUp={event => event.stopPropagation()}
    >
      <div className="render-recovery__card">
        <p className="render-recovery__eyebrow">Slipper in the Woods</p>
        <h1 id="render-recovery-title" ref={headingRef} tabIndex={-1}>The story is still here.</h1>
        <p id="render-recovery-description">The forest could not finish opening. Continue the same journey through text, or reload to try the forest again.</p>
        <div className="render-recovery__actions">
          <button type="button" onClick={onContinueTextJourney}>Continue with text journey</button>
          <button type="button" onClick={() => window.location.reload()}>Reload forest</button>
        </div>
      </div>
    </dialog>
  );
}

/** Eagerly imported so failed lazy chunks can never remove recovery controls. */
export class RenderRecoveryBoundary extends Component<
  RecoveryProps & { children: ReactNode },
  { hasError: boolean }
> {
  state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("Slipper presentation failed:", error, info.componentStack);
  }

  render() {
    return this.state.hasError
      ? <RenderRecovery onContinueTextJourney={this.props.onContinueTextJourney} />
      : this.props.children;
  }
}
