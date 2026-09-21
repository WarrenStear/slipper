import { createStoryAttentionSession } from "../../../storyEvents/storyAttentionSession";
import { useSettingsStore } from "../../../stores/useSettingsStore";
import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import type { JourneyChapter, JourneyScene } from "../../../data/journeyNarrative";
import {
  resolveStoryTransitionDurations,
  type StoryTransitionPhase,
} from "../../../lib/storyTransitionPacing";
import "./StoryTransitionDirector.css";

export type { StoryTransitionPhase } from "../../../lib/storyTransitionPacing";

type StoryTransitionDirectorProps = {
  chapter?: JourneyChapter;
  scene?: JourneyScene;
  sceneCompleted?: boolean;
  reducedMotion?: boolean;
  suppressed?: boolean;
  onPhaseChange?: (phase: StoryTransitionPhase) => void;
};

type StoryTransitionState = {
  sceneId: string | null;
  phase: StoryTransitionPhase;
  startedAt: number;
};

function monotonicNow() {
  return typeof performance === "undefined" ? Date.now() : performance.now();
}

export function StoryTransitionDirector({
  chapter,
  scene,
  sceneCompleted = false,
  reducedMotion = false,
  suppressed = false,
  onPhaseChange,
}: StoryTransitionDirectorProps) {
  const [transition, setTransition] = useState<StoryTransitionState>(() => ({
    sceneId: scene && !suppressed ? scene.id : null,
    phase: scene && !suppressed ? "arrival" : "idle",
    startedAt: monotonicNow(),
  }));
  const completedHandoffsRef = useRef(new Set<string>());
  const sceneId = scene?.id ?? null;
  const phaseElement = useRef<HTMLElement>(null);
  const phaseElapsed = useRef(0);
  const phaseClock = useRef<{ key: string; session: ReturnType<typeof createStoryAttentionSession> } | null>(null);

  const effectivePhase: StoryTransitionPhase = !scene || suppressed
    ? "idle"
    : transition.sceneId === scene.id
      ? transition.phase
      : "arrival";

  useLayoutEffect(() => {
    onPhaseChange?.(effectivePhase);
  }, [effectivePhase, onPhaseChange]);

  useEffect(() => {
    if (!scene) {
      setTransition((current) =>
        current.sceneId === null && current.phase === "idle"
          ? current
          : { sceneId: null, phase: "idle", startedAt: monotonicNow() },
      );
      return;
    }

    setTransition((current) => {
      if (current.sceneId === scene.id) return current;
      if (!sceneCompleted) completedHandoffsRef.current.delete(scene.id);
      return {
        sceneId: scene.id,
        phase: "arrival",
        startedAt: monotonicNow(),
      };
    });
  }, [scene, sceneCompleted, sceneId, suppressed]);

  useEffect(() => {
    if (!scene || transition.sceneId !== scene.id) return;
    if (!sceneCompleted) completedHandoffsRef.current.delete(scene.id);

    const durations = resolveStoryTransitionDurations(scene, reducedMotion);
    const advance = (phase: StoryTransitionPhase) => {
      setTransition((current) =>
        current.sceneId === scene.id
          ? { ...current, phase, startedAt: monotonicNow() }
          : current,
      );
    };
    const finishCompletionHandoff = () => {
      completedHandoffsRef.current.add(scene.id);
      advance("idle");
    };

    if (
      transition.phase === "idle" &&
      !suppressed &&
      sceneCompleted &&
      !completedHandoffsRef.current.has(scene.id)
    ) {
      advance("departure");
      return;
    }

    const phaseDuration = transition.phase === "arrival"
      ? durations.arrival
      : transition.phase === "contemplation"
        ? durations.contemplation
        : transition.phase === "departure"
          ? durations.departure
          : transition.phase === "silence"
            ? durations.silence
            : null;
    if (phaseDuration === null) return;

    const key = `${scene.id}:${transition.phase}:${transition.startedAt}:${phaseDuration}`;
    if (phaseClock.current?.key !== key) {
      phaseClock.current?.session.cancel();
      phaseClock.current = { key, session: createStoryAttentionSession(phaseDuration, false) };
      phaseElapsed.current = 0;
    }
    const session = phaseClock.current.session;
    let frame = 0;
    let disposed = false;
    let pageActive = true;
    let focused = document.hasFocus();
    const refresh = () => session.setActive(!suppressed && pageActive && focused && !document.hidden && !useSettingsStore.getState().drawerOpen);
    const advancePhase = () => {
      if (transition.phase === "arrival") { advance("contemplation"); return; }
      if (transition.phase === "contemplation") {
        advance(sceneCompleted && !completedHandoffsRef.current.has(scene.id) ? "departure" : "idle");
        return;
      }
      if (transition.phase === "departure" && durations.silence > 0) { advance("silence"); return; }
      finishCompletionHandoff();
    };
    const tick = (now: number) => {
      if (disposed) return;
      refresh();
      const sample = session.sample(now);
      phaseElapsed.current = sample.elapsedMs;
      // The visible fade follows the same attention clock as phase ownership.
      // Pausing logical time alone would leave the CSS animation running behind Settings.
      phaseElement.current?.style.setProperty("--story-transition-elapsed", `${-sample.elapsedMs}ms`);
      if (sample.completedNow) { advancePhase(); return; }
      frame = window.requestAnimationFrame(tick);
    };
    const blur = () => { focused = false; refresh(); };
    const focus = () => { focused = document.hasFocus(); refresh(); };
    const hide = () => { pageActive = false; refresh(); };
    const show = () => { pageActive = true; focused = document.hasFocus(); refresh(); };
    const unsubscribe = useSettingsStore.subscribe((next, previous) => { if (next.drawerOpen !== previous.drawerOpen) refresh(); });
    window.addEventListener("blur", blur); window.addEventListener("focus", focus);
    window.addEventListener("pagehide", hide); window.addEventListener("pageshow", show);
    document.addEventListener("visibilitychange", refresh);
    refresh(); frame = window.requestAnimationFrame(tick);
    return () => {
      disposed = true; window.cancelAnimationFrame(frame); session.setActive(false); unsubscribe();
      window.removeEventListener("blur", blur); window.removeEventListener("focus", focus);
      window.removeEventListener("pagehide", hide); window.removeEventListener("pageshow", show);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [
    reducedMotion,
    scene,
    sceneCompleted,
    suppressed,
    transition,
  ]);

  if (
    !scene ||
    suppressed ||
    effectivePhase === "idle" ||
    effectivePhase === "contemplation"
  ) return null;
  const treatment = scene.presentation.chapterTitleTreatment ?? "none";
  const durations = resolveStoryTransitionDurations(scene, reducedMotion);
  const visibleDuration = effectivePhase === "arrival"
    ? durations.arrival
    : effectivePhase === "departure"
      ? durations.departure
      : durations.silence;
  const transitionStyle = {
    "--story-transition-duration": `${Math.max(1, visibleDuration)}ms`,
    "--story-transition-elapsed": `${-phaseElapsed.current}ms`,
  } as CSSProperties;
  const silence = effectivePhase === "silence";

  return (
    <section
      ref={phaseElement}
      className={`story-transition story-transition--${scene.pacing.transitionStyle} story-transition--phase-${effectivePhase} story-transition--title-${treatment}`}
      aria-hidden={silence ? "true" : undefined}
      aria-live={silence ? undefined : "polite"}
      aria-label={silence ? undefined : "Story transition"}
      data-story-transition={effectivePhase}
      data-story-scene={scene.id}
      style={transitionStyle}
    >
      {effectivePhase === "arrival" && treatment !== "none" ? (
        <p>{chapter?.title.replace(/^.*?—\s*/, "") ?? ""}</p>
      ) : null}
      {effectivePhase === "arrival" && treatment === "full" ? (
        <h2>{scene.title}</h2>
      ) : null}
      {effectivePhase === "arrival" && scene.presentation.arrivalLine ? (
        <span>{scene.presentation.arrivalLine}</span>
      ) : null}
      {effectivePhase === "departure" && scene.presentation.completionLine ? (
        <span>{scene.presentation.completionLine}</span>
      ) : null}
    </section>
  );
}

export default StoryTransitionDirector;
