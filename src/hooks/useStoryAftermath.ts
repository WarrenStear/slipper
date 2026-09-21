import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import type { JourneySceneId } from "../lib/storyJourneyState";
import { useSettingsStore } from "../stores/useSettingsStore";
import { subscribeAcceptedStoryEvents } from "../storyEvents/acceptedStoryEvents";
import { createStoryAttentionSession } from "../storyEvents/storyAttentionSession";
import { advanceStoryAftermath, createStoryAftermathState, enqueueStoryAftermath } from "../storyEvents/storyAftermath";

/** Transient, player-paced aftermath. Never persisted or used to award progression. */
export function useStoryAftermath(sceneId: JourneySceneId, active: boolean, visible: boolean) {
  const [state, setState] = useState(() => createStoryAftermathState(sceneId));
  const [held, setHeld] = useState(false);
  const controls = useRef({ sceneId, active, visible, held });
  controls.current = { sceneId, active, visible, held };
  const sessionRef = useRef<ReturnType<typeof createStoryAttentionSession> | null>(null);
  const current = state.sceneId === sceneId ? state.current : null;

  useEffect(() => subscribeAcceptedStoryEvents(event => {
    const control = controls.current;
    if (!control.active || event.sceneId !== control.sceneId || document.hidden || !document.hasFocus()
      || useSettingsStore.getState().drawerOpen) return;
    setState(previous => enqueueStoryAftermath(previous.sceneId === event.sceneId ? previous : createStoryAftermathState(event.sceneId), event.sceneId, event.eventIds));
  }), []);

  // Temporary reading/transition suppression pauses; only a different scene
  // discards the queue. Reload starts with an empty queue and never replays it.
  useEffect(() => {
    setState(previous => previous.sceneId === sceneId ? previous : createStoryAftermathState(sceneId));
    setHeld(false);
  }, [sceneId]);

  const dismiss = useCallback(() => {
    if (!current) return;
    // Mark inactive synchronously, before a queued frame can see the old controls.
    sessionRef.current?.cancel();
    setState(previous => advanceStoryAftermath(previous, current.eventId));
    setHeld(false);
  }, [current]);

  useLayoutEffect(() => {
    sessionRef.current?.setActive(active && visible && !held && !document.hidden && document.hasFocus()
      && !useSettingsStore.getState().drawerOpen);
  }, [active, visible, held]);

  useEffect(() => {
    if (!current) return;
    const session = createStoryAttentionSession(current.durationMs, false);
    sessionRef.current = session;
    let frame = 0;
    let disposed = false;
    let pageVisible = !document.hidden;
    let focused = document.hasFocus();
    const refresh = () => {
      const control = controls.current;
      session.setActive(control.sceneId === current.sceneId && control.active && control.visible && !control.held
        && pageVisible && focused && !useSettingsStore.getState().drawerOpen);
    };
    const blur = () => { focused = false; refresh(); };
    const focus = () => { focused = document.hasFocus(); refresh(); };
    const visibility = () => { pageVisible = !document.hidden; refresh(); };
    const hide = () => { pageVisible = false; refresh(); };
    const show = () => { pageVisible = !document.hidden; focused = document.hasFocus(); refresh(); };
    const unsubscribe = useSettingsStore.subscribe((next, previous) => { if (next.drawerOpen !== previous.drawerOpen) refresh(); });
    const tick = (now: number) => {
      if (disposed) return;
      refresh();
      if (session.sample(now).completedNow) {
        setState(previous => advanceStoryAftermath(previous, current.eventId));
        setHeld(false);
        return;
      }
      frame = requestAnimationFrame(tick);
    };
    window.addEventListener("blur", blur); window.addEventListener("focus", focus);
    window.addEventListener("pagehide", hide); window.addEventListener("pageshow", show);
    document.addEventListener("visibilitychange", visibility);
    refresh(); frame = requestAnimationFrame(tick);
    return () => {
      disposed = true; session.cancel(); cancelAnimationFrame(frame); unsubscribe();
      if (sessionRef.current === session) sessionRef.current = null;
      window.removeEventListener("blur", blur); window.removeEventListener("focus", focus);
      window.removeEventListener("pagehide", hide); window.removeEventListener("pageshow", show);
      document.removeEventListener("visibilitychange", visibility);
    };
    // Adding a queued response does not restart the current caption's clock.
  }, [current]);

  return { current, held, setHeld, dismiss };
}
