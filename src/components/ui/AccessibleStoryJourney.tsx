import GuidedStoryMoment from "./GuidedStoryMoment";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useShallow } from "zustand/react/shallow";
import {
  getJourneyChapter,
  getJourneyEntryContext,
  getJourneyRitualBeat,
  getJourneyScene,
  journeyChapters,
} from "../../data/journeyBlueprint";
import type { Slipper3DEntry } from "../../data/slipper3dTypes";
import {
  nextJourneyPlayerAction,
  type JourneyPlayerAction,
  type JourneyPlayerActionChoice,
} from "../../lib/journeyPlayerActions";
import {
  canEnterNarrativeEntry,
  nextResolvableRitualForEntry,
} from "../../lib/journeyProgression";
import {
  getSlipperExperienceCapabilities,
  isDirectedJourneyMode,
  type SlipperExperienceMode,
} from "../../lib/experienceMode";
import { resolveStoryTransitionDurations } from "../../lib/storyTransitionPacing";
import { useJourneyStore } from "../../stores/useJourneyStore";
import { useSettingsStore } from "../../stores/useSettingsStore";
import { useStoryRuntime } from "../../experience/StoryRuntimeContext";
import { canReadStoryEntry } from "../../narrative/StorySelectors";
import { selectStoryProgression } from "../../narrative/StoryRuntime";
import AccessibleStoryObjects from "./AccessibleStoryObjects";
import "./AccessibleStoryJourney.css";

export type AccessibleStoryJourneyProps = {
  entries: Slipper3DEntry[];
  activeEntryId: string;
  experienceMode: SlipperExperienceMode;
  onOpenArchive: () => void;
  onOpenSettings: () => void;
  onReturnToThreshold?: () => void;
  onFinalConstellationFormationComplete?: () => void;
};

function entryParagraphs(entry: Slipper3DEntry) {
  return entry.paragraphs.length > 0 ? entry.paragraphs : [entry.body];
}

function accessibleActionLabel(action: JourneyPlayerAction) {
  if (action.mode === "dual-hold") return "Hold and keep with one deliberate control";
  if (action.mode === "stillness") return "Enter intentional stillness";
  if (action.mode === "move") return "Take the next step";
  if (action.mode === "turn-and-move") return "Turn away and take the next step";
  if (action.mode === "hold") return `Hold to ${action.verb}`;
  return action.verb;
}

const ACCESSIBLE_FINAL_SCENE = getJourneyScene("epilogue.constellation");
const ACCESSIBLE_FINAL_SETTLE_FALLBACK_MS = 3_200;
const ACCESSIBLE_FINAL_SETTLE_REDUCED_MS = 600;

/**
 * A canonical, non-WebGL route through the same persisted narrative state.
 * It deliberately does not mount a canvas and never places unwitnessed prose
 * in the DOM. Rituals and embodied actions retain their normal ordering and
 * outcomes; only the physical input is translated into an explicit control.
 */
export function AccessibleStoryJourney({
  entries,
  activeEntryId,
  experienceMode,
  onOpenArchive,
  onOpenSettings,
  onReturnToThreshold,
  onFinalConstellationFormationComplete,
}: AccessibleStoryJourneyProps) {
  const journey = useJourneyStore(useShallow((state) => ({
    witnessedEntryIds: state.witnessedEntryIds,
    completedRitualIds: state.completedRitualIds,
    worldFlags: state.worldFlags,
    inventory: state.inventory,
    completedActs: state.completedActs,
    completedChapterIds: state.completedChapterIds,
    completedSceneIds: state.completedSceneIds,
    completedStoryEventIds: state.completedStoryEventIds,
    storyObjectStates: state.storyObjectStates,
    storyPlacementStates: state.storyPlacementStates,
    storyStarted: state.storyStarted,
    storyCompleted: state.storyCompleted,
    history: state.history,
    bookmarkedEntryIds: state.bookmarkedEntryIds,
    toggleBookmark: state.toggleBookmark,
  })));
  const runtime = useStoryRuntime();
  const [announcement, setAnnouncement] = useState("");
  const [accessibleConstellationFormation, setAccessibleConstellationFormation] =
    useState<"forming" | "complete">("forming");
  const finalCodaRef = useRef<HTMLElement>(null);
  const reducedMotion = useSettingsStore((state) => state.reducedMotion);

  useEffect(() => {
    if (!journey.storyCompleted || !finalCodaRef.current) {
      setAccessibleConstellationFormation("forming");
      return;
    }
    setAccessibleConstellationFormation("forming");
    let completionFrame = 0;
    let renderedFrame = 0;
    const authoredSettleDuration = ACCESSIBLE_FINAL_SCENE
      ? resolveStoryTransitionDurations(ACCESSIBLE_FINAL_SCENE, reducedMotion).departure
      : reducedMotion
        ? ACCESSIBLE_FINAL_SETTLE_REDUCED_MS
        : ACCESSIBLE_FINAL_SETTLE_FALLBACK_MS;
    const settleDuration = reducedMotion
      ? Math.max(ACCESSIBLE_FINAL_SETTLE_REDUCED_MS, authoredSettleDuration)
      : authoredSettleDuration;
    const settleTimer = window.setTimeout(() => {
      if (!finalCodaRef.current?.isConnected) return;
      setAccessibleConstellationFormation("complete");
      renderedFrame = window.requestAnimationFrame(() => {
        completionFrame = window.requestAnimationFrame(() => {
          if (finalCodaRef.current?.isConnected) {
            onFinalConstellationFormationComplete?.();
          }
        });
      });
    }, settleDuration);
    return () => {
      window.clearTimeout(settleTimer);
      window.cancelAnimationFrame(renderedFrame);
      if (completionFrame) window.cancelAnimationFrame(completionFrame);
    };
  }, [journey.storyCompleted, onFinalConstellationFormationComplete, reducedMotion]);

  const entryById = useMemo(
    () => new Map(entries.map((entry) => [entry.id, entry] as const)),
    [entries],
  );
  const activeEntry = entryById.get(activeEntryId) ?? entries[0];
  const activeContext = activeEntry ? getJourneyEntryContext(activeEntry.id) : undefined;
  const activeChapter = activeContext ? getJourneyChapter(activeContext.chapterId) : undefined;
  const activeScene = activeContext ? getJourneyScene(activeContext.sceneId) : undefined;
  const isWitnessed = Boolean(activeEntry && canReadStoryEntry(activeEntry.id, journey));
  const isBookmarked = Boolean(activeEntry && journey.bookmarkedEntryIds.includes(activeEntry.id));
  const capabilities = getSlipperExperienceCapabilities(experienceMode);
  const directedJourney = isDirectedJourneyMode(experienceMode);
  // Keep carried objects and optional home interactions visible after this
  // scene's required events settle, until the player chooses to continue.
  const storyEventsActive = Boolean(activeScene && !journey.storyCompleted);

  const progressionState = useMemo(
    () => ({
      activeEntryId: activeEntry?.id ?? activeEntryId,
      sceneId: activeScene?.id,
      witnessedEntryIds: journey.witnessedEntryIds,
      completedRitualIds: journey.completedRitualIds,
      worldFlags: journey.worldFlags,
      inventory: journey.inventory,
      completedActs: journey.completedActs,
      completedChapterIds: journey.completedChapterIds,
      completedSceneIds: journey.completedSceneIds,
      completedStoryEventIds: journey.completedStoryEventIds,
      storyObjectStates: journey.storyObjectStates,
      storyPlacementStates: journey.storyPlacementStates,
      storyStarted: journey.storyStarted,
      storyCompleted: journey.storyCompleted,
    }),
    [
      activeEntry?.id,
      activeEntryId,
      activeScene?.id,
      journey.completedActs,
      journey.completedChapterIds,
      journey.completedRitualIds,
      journey.completedSceneIds,
      journey.completedStoryEventIds,
      journey.storyObjectStates,
      journey.storyPlacementStates,
      journey.inventory,
      journey.storyCompleted,
      journey.storyStarted,
      journey.witnessedEntryIds,
      journey.worldFlags,
    ],
  );

  const ritualProgression = activeEntry && isWitnessed && !storyEventsActive
    ? nextResolvableRitualForEntry(activeEntry.id, progressionState)
    : undefined;
  const ritualBeat = ritualProgression
    ? getJourneyRitualBeat(ritualProgression.ritualId)
    : undefined;
  const ritualInteraction = ritualBeat?.interactions?.find(
    (interaction) => interaction.ritualId === ritualProgression?.ritualId,
  );
  const storyAction = activeScene &&
      !storyEventsActive &&
      !ritualInteraction &&
      !journey.completedSceneIds.includes(activeScene.id) &&
      journey.witnessedEntryIds.includes(activeScene.keystoneEntryId)
    ? nextJourneyPlayerAction(activeScene.id, journey.worldFlags)
    : undefined;
  const requiredEntryId = selectStoryProgression(progressionState).nextEntryId;
  const requiredEntry = requiredEntryId ? entryById.get(requiredEntryId) : undefined;
  const canContinue = Boolean(
    requiredEntry &&
      activeEntry &&
      requiredEntry.id !== activeEntry.id &&
      canEnterNarrativeEntry(requiredEntry.id, progressionState),
  );
  const sceneEchoes = (activeScene?.echoEntryIds ?? [])
    .map((entryId) => entryById.get(entryId))
    .filter((entry): entry is Slipper3DEntry => {
      if (!entry) return false;
      return !directedJourney || journey.witnessedEntryIds.includes(entry.id);
    });
  const chapterNumber = activeChapter
    ? journeyChapters.findIndex((chapter) => chapter.id === activeChapter.id) + 1
    : 1;

  const resolveRitual = useCallback(() => {
    const lease = runtime?.currentLease();
    if (!runtime || !lease || !ritualInteraction) return;
    const result = runtime.dispatch({ type: "ritual", ritualId: ritualInteraction.ritualId, lease });
    setAnnouncement(result.accepted ? result.messages.join(" ") : "That moment is not ready yet.");
  }, [runtime, ritualInteraction]);

  const resolveStoryAction = useCallback((action: JourneyPlayerAction, choice?: JourneyPlayerActionChoice) => {
    const lease = runtime?.currentLease();
    if (!runtime || !lease) return;
    const result = runtime.dispatch({ type: "legacy-action", actionId: action.id, choiceId: choice?.id, lease });
    setAnnouncement(result.accepted ? result.messages.join(" ") : "That moment is not ready yet.");
  }, [runtime]);

  const witnessActiveEntry = useCallback(() => {
    const lease = runtime?.currentLease();
    if (!runtime || !lease || !activeEntry) return;
    const result = runtime.dispatch({ type: "witness", entryId: activeEntry.id, lease });
    if (result.accepted) setAnnouncement(`${activeEntry.title} is now remembered.`);
  }, [activeEntry, runtime]);

  const navigate = useCallback((entryId: string) => {
    if (!runtime) return;
    const result = runtime.dispatch({ type: "navigate", entryId, expectedEntryId: activeEntry?.id });
    if (!result.accepted) { setAnnouncement("That memory has not opened yet."); return; }
    setAnnouncement(`${entryById.get(entryId)?.title ?? "The next memory"} is ready to witness.`);
    window.scrollTo({ top: 0, behavior: "auto" });
  }, [activeEntry?.id, entryById, runtime]);

  const chapterHeadingRef = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    chapterHeadingRef.current?.focus({ preventScroll: true });
  }, [activeEntry?.id]);

  if (!activeEntry) {
    return (
      <main className="accessible-story-journey" data-accessible-journey="true">
        <p role="status">The first memory could not be found.</p>
      </main>
    );
  }

  return (
    <main
      className="accessible-story-journey"
      data-accessible-journey="true"
      data-active-entry={activeEntry.id}
      data-experience-mode={experienceMode}
      data-story-complete={journey.storyCompleted ? "true" : "false"}
    >
      <a className="accessible-story-journey__skip" href="#accessible-memory">
        Skip to the current memory
      </a>



      <header className="accessible-story-journey__header">
        <div>
          <p>Slipper in the Woods · text journey</p>
          <h1 ref={chapterHeadingRef} tabIndex={-1}>{activeChapter?.title ?? "The remembered path"}</h1>
          <span>
            {capabilities.showJourneyMetrics
              ? `Chapter ${chapterNumber} of ${journeyChapters.length}${activeScene ? ` · ${activeScene.title}` : ""}`
              : activeScene?.title ?? "The remembered path"}
          </span>
        </div>
        <nav aria-label="Text journey actions">
          {capabilities.showArchiveInPrimaryNavigation ? (
            <button type="button" onClick={onOpenArchive}>Archive</button>
          ) : null}
          <button type="button" onClick={onOpenSettings}>Accessibility &amp; settings</button>
          {capabilities.showGenericNavigation && onReturnToThreshold ? (
            <button type="button" onClick={onReturnToThreshold}>Return to threshold</button>
          ) : null}
        </nav>
      </header>

      {directedJourney && activeScene && !journey.storyCompleted ? (
        <GuidedStoryMoment sceneId={activeScene.id} inline canFollow={canContinue}
          onFollow={() => requiredEntry && navigate(requiredEntry.id)} />
      ) : null}

      {capabilities.showJourneyMetrics ? (
        <div className="accessible-story-journey__progress" aria-label="Journey progress">
          <span>{journey.completedChapterIds.length} of {journeyChapters.length} chapters carried</span>
          <span>{journey.witnessedEntryIds.length} of {entries.length} memories witnessed</span>
        </div>
      ) : null}

      <article
        className={`accessible-story-memory${isWitnessed ? " is-witnessed" : " is-veiled"}`}
        id="accessible-memory"
        aria-labelledby="accessible-memory-title"
      >
        <p className="accessible-story-memory__state">
          {isWitnessed ? "Remembered" : "Unwitnessed memory"}
        </p>
        <h2 id="accessible-memory-title">{activeEntry.title}</h2>

        {isWitnessed ? (
          <div className="accessible-story-memory__prose" role="document">
            {entryParagraphs(activeEntry).map((paragraph, index) => (
              <p key={`${activeEntry.id}-accessible-${index}`}>{paragraph}</p>
            ))}
          </div>
        ) : (
          <div className="accessible-story-memory__veil">
            <p>
              The words remain veiled until you choose to witness this memory.
              Its title and place in the journey are visible; its prose is not.
            </p>
            <button
              type="button"
              className="is-primary"
              data-accessible-witness={activeEntry.id}
              onClick={witnessActiveEntry}
            >
              Witness and reveal this memory
            </button>
          </div>
        )}

        {isWitnessed && capabilities.allowBookmarks ? (
          <footer>
            <button
              type="button"
              aria-pressed={isBookmarked}
              onClick={() => journey.toggleBookmark(activeEntry.id)}
            >
              {isBookmarked ? "Remove bookmark" : "Bookmark this memory"}
            </button>
          </footer>
        ) : null}
      </article>

      {storyEventsActive && activeScene ? (
        <AccessibleStoryObjects key={activeScene.id} sceneId={activeScene.id} onAnnouncement={setAnnouncement} />
      ) : null}

      {isWitnessed && ritualInteraction ? (
        <section
          className="accessible-story-moment"
          aria-labelledby="accessible-ritual-title"
          data-accessible-ritual-id={ritualInteraction.ritualId}
        >
          <p>{ritualInteraction.verb}</p>
          <h2 id="accessible-ritual-title">{ritualInteraction.label}</h2>
          <span>{ritualInteraction.instruction}</span>
          <button type="button" className="is-primary" onClick={resolveRitual}>
            {ritualInteraction.inputMode === "stillness"
              ? "Enter intentional stillness"
              : `${ritualInteraction.verb.charAt(0).toUpperCase()}${ritualInteraction.verb.slice(1)}`}
          </button>
          <small>
            This deliberate control preserves the same moment without requiring a
            canvas, timed hold, precise movement, or motion tracking.
          </small>
        </section>
      ) : null}

      {isWitnessed && !ritualInteraction && storyAction ? (
        <section
          className="accessible-story-moment"
          aria-labelledby="accessible-action-title"
          data-accessible-action-id={storyAction.id}
          data-accessible-action-mode={storyAction.mode}
        >
          <p>{storyAction.verb}</p>
          <h2 id="accessible-action-title">{storyAction.label}</h2>
          <span>{storyAction.instruction}</span>

          {storyAction.mode === "choice" ? (
            <div className="accessible-story-moment__choices" role="group" aria-label={storyAction.label}>
              {storyAction.choices?.map((choice) => (
                <button
                  key={choice.id}
                  type="button"
                  data-accessible-choice-id={choice.id}
                  onClick={() => resolveStoryAction(storyAction, choice)}
                >
                  <strong>{choice.label}</strong>
                  <span>{choice.meaning}</span>
                </button>
              ))}
            </div>
          ) : (
            <button
              type="button"
              className="is-primary"
              onClick={() => resolveStoryAction(storyAction)}
            >
              {accessibleActionLabel(storyAction)}
            </button>
          )}

          <small>
            This is the non-visual equivalent of the same embodied moment. Its
            consequences and required order are unchanged.
          </small>
        </section>
      ) : null}

      {journey.storyCompleted ? (
        <section
          ref={finalCodaRef}
          className={`accessible-story-coda is-${accessibleConstellationFormation}`}
          aria-live="polite"
          data-accessible-constellation-formation={accessibleConstellationFormation}
        >
          <span>Slipper in the Woods</span>
          <h2>I returned to myself.</h2>
          <p>The lantern remains lit where it was placed. Every witnessed memory remains in the constellation.</p>
        </section>
      ) : (
        <section className="accessible-story-next" aria-label="Continue the story">
          <div>
            <p>The path ahead</p>
            <strong>
              {requiredEntry?.title ?? "This moment is still settling."}
            </strong>
          </div>
          <button
            type="button"
            className="is-primary"
            disabled={!canContinue}
            onClick={() => requiredEntry && navigate(requiredEntry.id)}
          >
            {canContinue ? "Continue the story" : "Stay with this moment to continue"}
          </button>
        </section>
      )}

      {sceneEchoes.length > 0 ? (
        <aside className="accessible-story-echoes" aria-labelledby="accessible-echoes-title">
          <div>
            <p>Optional memories in this place</p>
            <h2 id="accessible-echoes-title">Memories beside the path</h2>
          </div>
          <ul>
            {sceneEchoes.map((entry) => {
              const witnessed = journey.witnessedEntryIds.includes(entry.id);
              const current = entry.id === activeEntry.id;
              return (
                <li key={entry.id} className={directedJourney ? "is-context-only" : undefined}>
                  <span>{witnessed ? "Remembered" : "Unwitnessed"}</span>
                  <strong>{entry.title}</strong>
                  {capabilities.allowSceneRevisiting ? (
                    <button
                      type="button"
                      disabled={current}
                      onClick={() => navigate(entry.id)}
                    >
                      {current ? "Current memory" : witnessed ? "Return to memory" : "Witness this memory"}
                    </button>
                  ) : null}
                </li>
              );
            })}
          </ul>
        </aside>
      ) : null}

      {capabilities.showGenericNavigation && capabilities.allowFullArchive ? (
        <footer className="accessible-story-journey__footer">
          <button
            type="button"
            disabled={journey.history.length === 0}
            onClick={() => runtime?.dispatch({ type: "back", expectedEntryId: activeEntry.id })}
          >
            Back
          </button>
          <button type="button" onClick={onOpenArchive}>Open all 66 memory titles</button>
        </footer>
      ) : null}

      <p className="sr-only" role="status" aria-live="polite">{announcement}</p>
    </main>
  );
}

export default AccessibleStoryJourney;
