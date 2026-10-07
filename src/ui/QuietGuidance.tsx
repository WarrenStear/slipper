import { useEffect, useId, useRef, useState, type ReactNode, type Ref } from "react";
import type { JourneySceneId } from "../lib/storyJourneyState";
import type { GuidedStoryBeat } from "../storyEvents/guidedStory";
import "./QuietGuidance.css";

export type QuietConsequence = Readonly<{
  eventId: string;
  line: string;
  held: boolean;
  onHeldChange: (held: boolean) => void;
  onDismiss: () => void;
}>;
export type QuietGuidanceProps = {
  sceneId: JourneySceneId;
  kind: GuidedStoryBeat["kind"];
  eventIds: readonly string[];
  line: string | null;
  instruction: string;
  hint: string;
  detailsOpen: boolean;
  onCloseDetails: () => void;
  inline?: boolean;
  reducedMotion?: boolean;
  readable?: boolean;
  consequence?: QuietConsequence | null;
  captionRef?: Ref<HTMLParagraphElement>;
  onFocusWithinChange?: (focused: boolean) => void;
  onNextStepOpenChange?: (open: boolean) => void;
  /** Existing explicit reader/follow controls; never generated outcomes. */
  actions?: ReactNode;
};

/** A compact line with deliberate details; narrative/caption lifetimes stay upstream. */
export function QuietGuidance({ sceneId, kind, eventIds, line, instruction, hint,
  detailsOpen, onCloseDetails, inline = false, reducedMotion = false, readable = true, consequence,
  captionRef, onFocusWithinChange, onNextStepOpenChange, actions }: QuietGuidanceProps) {
  const nextStepId = useId();
  const [nextStepOpen, setNextStepOpen] = useState(false);
  const nextStepCallback = useRef(onNextStepOpenChange);
  nextStepCallback.current = onNextStepOpenChange;
  useEffect(() => {
    setNextStepOpen(false); nextStepCallback.current?.(false);
  }, [sceneId, consequence?.eventId, detailsOpen]);
  const toggleNext = () => {
    const next = !nextStepOpen; setNextStepOpen(next); onNextStepOpenChange?.(next);
  };
  if (!line && !detailsOpen) return null;
  return <aside className={`quiet-guidance${inline ? " quiet-guidance--inline" : ""}${detailsOpen ? " is-expanded" : ""}`}
    data-guided-story={sceneId} data-guided-beat={kind} data-guided-event={eventIds.join(" ")}
    data-guided-response={consequence ? "true" : "false"} data-aftermath-event={consequence?.eventId}
    data-aftermath-held={consequence?.held ? "true" : "false"} data-aftermath-readable={readable ? "true" : "false"} data-quiet-guidance={detailsOpen ? "details" : "line"}
    data-reduced-motion={reducedMotion ? "true" : "false"} aria-label="Your place in the story"
    onFocusCapture={() => onFocusWithinChange?.(true)}
    onBlurCapture={event => {
      if (!(event.relatedTarget instanceof Node) || !event.currentTarget.contains(event.relatedTarget)) onFocusWithinChange?.(false);
    }}>
    {line ? <p ref={captionRef} tabIndex={-1} className="quiet-guidance__line"
      role="status" aria-live="polite" aria-atomic="true">{line}</p> : null}
    {detailsOpen ? <div className="quiet-guidance__details">
      {consequence ? <>
        <div className="quiet-guidance__actions">
          <button type="button" aria-pressed={consequence.held} onClick={() => consequence.onHeldChange(!consequence.held)}>Stay with this moment</button>
          <button type="button" aria-label="Continue past this moment" onClick={consequence.onDismiss}>Continue</button>
          {kind !== "quiet" && kind !== "sequence" ? <button type="button" aria-expanded={nextStepOpen}
            aria-controls={nextStepId} onClick={toggleNext}>{nextStepOpen ? "Return to this moment" : "Show my next step"}</button> : null}
        </div>
        <section id={nextStepId} hidden={!nextStepOpen} aria-label="Your current next step">
          <p>{instruction}</p><p className="quiet-guidance__hint">{hint}</p>{actions}
        </section>
      </> : <>
        {line !== instruction ? <p>{instruction}</p> : null}
        <p className="quiet-guidance__hint">{hint}</p>
        {actions ? <div className="quiet-guidance__actions">{actions}</div> : null}
      </>}
      {!inline ? <button type="button" className="quiet-guidance__less" onClick={onCloseDetails}>Less guidance</button> : null}
    </div> : null}
  </aside>;
}
