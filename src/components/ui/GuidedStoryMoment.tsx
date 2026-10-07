import { useEffect, useLayoutEffect, useId, useMemo, useRef, useState } from "react";
import { useShallow } from "zustand/react/shallow";
import type { JourneySceneId } from "../../lib/storyJourneyState";
import { resolveGuidedStory } from "../../storyEvents/guidedStory";
import { canReadStoryAftermath } from "../../storyEvents/storyAftermath";
import { useStoryAftermath } from "../../hooks/useStoryAftermath";
import { useStoryCaptionVisibility } from "../../hooks/useStoryCaptionVisibility";
import { useJourneyStore } from "../../stores/useJourneyStore";
import { useSettingsStore } from "../../stores/useSettingsStore";
import { QuietGuidance } from "../../ui/QuietGuidance";
import { resolveQuietGuidance } from "../../ui/quietGuidancePresentation";
import "./GuidedStoryMoment.css";

type Props = {
  sceneId: JourneySceneId;
  active?: boolean;
  inline?: boolean;
  canRead?: boolean;
  canFollow?: boolean;
  onRead?: () => void;
  onFollow?: () => void;
  idleMs?: number;
  detailRequested?: boolean | null;
  onDetailRequestedChange?: (requested: boolean) => void;
  onQuietFocusRequest?: () => void;
};

/** Canonical beat/aftermath authority stays here; QuietGuidance owns disclosure only. */
export default function GuidedStoryMoment({ sceneId, active = true, inline = false,
  canRead = false, canFollow = false, onRead, onFollow, idleMs = 0,
  detailRequested, onDetailRequestedChange, onQuietFocusRequest }: Props) {
  const state = useJourneyStore(useShallow(journey => ({
    sceneId: journey.sceneId, completedSceneIds: journey.completedSceneIds,
    completedStoryEventIds: journey.completedStoryEventIds, worldFlags: journey.worldFlags,
    inventory: journey.inventory, storyObjectStates: journey.storyObjectStates,
    storyPlacementStates: journey.storyPlacementStates,
  })));
  const drawerOpen = useSettingsStore(settings => settings.drawerOpen);
  const reducedMotion = useSettingsStore(settings => settings.reducedMotion);
  const assistanceEnabled = useSettingsStore(settings => settings.showContextualGuidance);
  const beat = useMemo(() => resolveGuidedStory(state), [state]);
  const [collapsed, setCollapsed] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const nextStepId = useId();
  const toggleRef = useRef<HTMLButtonElement>(null);
  const [localDetails, setLocalDetails] = useState<boolean | null>(null);
  const [nextStepOpen, setNextStepOpen] = useState(false);
  const [focusWithin, setFocusWithin] = useState(false);
  const pendingFocus = useRef<"intention" | "toggle" | "memories" | null>(null);
  const quiet = !inline && (beat.kind === "quiet" || beat.kind === "sequence");
  const available = active && !drawerOpen && !quiet && state.sceneId === sceneId;
  const { captionRef, inView } = useStoryCaptionVisibility(available && !collapsed, sceneId);
  const readable = canReadStoryAftermath({ available, collapsed, inView, focusWithin, nextStepOpen });
  const { current: response, held, setHeld, dismiss } = useStoryAftermath(sceneId, active && !quiet, readable);
  const projection = resolveQuietGuidance({ sceneId, kind: beat.kind, instruction: beat.instruction,
    active: available, inline, idleMs, assistanceEnabled,
    detailRequested: detailRequested === undefined ? localDetails : detailRequested,
    consequenceLine: response?.line });
  const activity = useRef({ available }); activity.current = { available };

  useLayoutEffect(() => {
    if (detailRequested === true && available && !inline) captionRef.current?.focus({ preventScroll: true });
  }, [detailRequested, available, inline, captionRef]);

  useEffect(() => { setLocalDetails(null); setHelpOpen(false); setNextStepOpen(false); }, [sceneId]);
  useEffect(() => { setNextStepOpen(false); }, [response?.eventId]);
  useEffect(() => { if (!available || collapsed) setFocusWithin(false); }, [available, collapsed]);
  useLayoutEffect(() => {
    const requested = pendingFocus.current; pendingFocus.current = null;
    if (requested === "intention" && captionRef.current) captionRef.current.focus({ preventScroll: true });
    else if (requested === "toggle") toggleRef.current?.focus({ preventScroll: true });
    else if (requested) onQuietFocusRequest?.();
  });
  const act = (callback?: () => void) => {
    if (activity.current.available && useJourneyStore.getState().sceneId === sceneId
      && !useSettingsStore.getState().drawerOpen && !document.hidden && document.hasFocus()) callback?.();
  };
  if (!available) return null;
  const currentResponse = response?.line ?? null;
  const nextStepVisible = Boolean(currentResponse && nextStepOpen);
  const canInspectStep = beat.kind !== "quiet" && beat.kind !== "sequence";
  const toggleGuide = () => act(() => {
    pendingFocus.current = "toggle";
    setCollapsed(value => !value);
  });
  const continueMoment = () => act(() => {
    pendingFocus.current = "intention";
    setNextStepOpen(false);
    dismiss();
  });

  if (inline) {
  return (
    <aside className={`guided-story${inline ? " guided-story--inline" : ""}${collapsed ? " is-collapsed" : ""}`}
      data-guided-story={sceneId} data-guided-beat={beat.kind} data-guided-event={beat.eventIds.join(" ")}
      data-guided-response={currentResponse ? "true" : "false"}
      data-aftermath-event={response?.eventId} data-aftermath-held={held ? "true" : "false"}
      data-aftermath-readable={readable ? "true" : "false"} data-reduced-motion={reducedMotion ? "true" : "false"}
      onFocusCapture={() => setFocusWithin(true)}
      onBlurCapture={event => {
        if (!(event.relatedTarget instanceof Node) || !event.currentTarget.contains(event.relatedTarget)) setFocusWithin(false);
      }}
      aria-label="Your place in the story">
      {collapsed ? <button ref={toggleRef} type="button" onClick={toggleGuide}>Show story guidance</button> : <>
        <div className="guided-story__heading"><span>{beat.title}</span><button ref={toggleRef} type="button" onClick={toggleGuide} aria-label="Hide story guidance">Hide</button></div>
        <p ref={captionRef} tabIndex={-1} className="guided-story__intention" role="status" aria-live="polite" aria-atomic="true">{currentResponse ?? beat.instruction}</p>
        {/* Focus must not reflow labels and move a button between pointer-down and click. */}
        {currentResponse ? <span className="guided-story__caption-label">{held || nextStepOpen ? "This moment will wait" : "The world responds"}</span> : null}
        {!currentResponse && helpOpen ? <p className="guided-story__help">{beat.hint}</p> : null}
        <div className="guided-story__actions">
          {currentResponse ? <>
            <button type="button" aria-pressed={held} onClick={() => act(() => setHeld(value => !value))}>Stay with this moment</button>
            <button type="button" aria-label="Continue past this moment" onClick={continueMoment}>Continue</button>
            {canInspectStep ? <button type="button" aria-expanded={nextStepVisible} aria-controls={nextStepId}
              onClick={() => act(() => setNextStepOpen(value => !value))}>{nextStepVisible ? "Return to this moment" : "Show my next step"}</button> : null}
          </> : null}
          {!currentResponse && beat.kind !== "complete" && beat.kind !== "quiet" && beat.kind !== "sequence" ? <button type="button" aria-expanded={helpOpen} onClick={() => act(() => {
            setHelpOpen(current => !current);
            if (!inline) useSettingsStore.getState().setSetting("showContextualGuidance", true);
          })}>{helpOpen ? "Less guidance" : "What do I do?"}</button> : null}
          {canRead && onRead ? <button type="button" onClick={() => act(onRead)}>Read this memory</button> : null}
          {beat.kind === "complete" && canFollow && onFollow && !currentResponse ? <button type="button" className="guided-story__onward" onClick={() => act(onFollow)}>Follow the next path</button> : null}
        </div>
        {currentResponse && canInspectStep ? <section id={nextStepId} className="guided-story__next-step" hidden={!nextStepVisible} aria-label="Your current next step">
          <h2>Your next step</h2>
          <p>{beat.instruction}</p>
          <p className="guided-story__help">{beat.hint}</p>
        </section> : null}
      </>}
    </aside>
  );
  }
  if (!projection.visible) return null;
  return <QuietGuidance sceneId={sceneId} kind={beat.kind} eventIds={beat.eventIds}
    line={projection.line} instruction={beat.instruction} hint={beat.hint}
    detailsOpen={projection.detailsOpen} inline={inline} reducedMotion={reducedMotion}
    captionRef={captionRef} readable={readable} onFocusWithinChange={setFocusWithin}
    onNextStepOpenChange={setNextStepOpen}
    onCloseDetails={() => act(() => {
      // Move focus before removing the disclosure's focused controls.
      onQuietFocusRequest?.(); setLocalDetails(false); onDetailRequestedChange?.(false);
    })}
    consequence={response ? {
      eventId: response.eventId, line: response.line, held,
      onHeldChange: value => act(() => setHeld(value)),
      onDismiss: () => act(() => { pendingFocus.current = "intention"; setNextStepOpen(false); dismiss(); }),
    } : null}
    actions={<>
      {canRead && onRead ? <button type="button" onClick={() => act(onRead)}>Read this memory</button> : null}
      {beat.kind === "complete" && canFollow && onFollow ? <button type="button" onClick={() => act(onFollow)}>Follow the next path</button> : null}
    </>}
  />;
}
