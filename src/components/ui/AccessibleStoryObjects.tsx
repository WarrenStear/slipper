import { useEffect, useMemo, useRef, useState } from "react";
import { useShallow } from "zustand/react/shallow";
import type { JourneySceneId } from "../../lib/storyJourneyState";
import {
  eventsForScene,
  getAvailableStoryEvents,
  getCarriedStoryObjects,
  getStoryObject,
} from "../../storyEvents/storyEventRegistry";
import { useStoryRuntime } from "../../experience/StoryRuntimeContext";
import { subscribeAcceptedStoryEvents } from "../../storyEvents/acceptedStoryEvents";
import type { StoryEventDefinition, StoryEventTrigger } from "../../storyEvents/storyEventTypes";
import { useJourneyStore } from "../../stores/useJourneyStore";
import { useSettingsStore } from "../../stores/useSettingsStore";

const VERBS: Record<StoryEventTrigger, string> = {
  "scene-enter": "Enter",
  "volume-enter": "Walk toward",
  "volume-exit": "Walk away from",
  gaze: "Look at",
  inspect: "Inspect",
  touch: "Touch",
  pickup: "Carry",
  place: "Place",
  drop: "Set down",
  open: "Open",
  close: "Close",
  wipe: "Wipe",
  light: "Light",
  extinguish: "Extinguish",
  burn: "Place in the fire",
  wash: "Wash",
  plant: "Plant",
  release: "Release",
  stillness: "Enter intentional stillness beside",
  "scene-complete": "Continue from",
  "sequence-complete": "Watch",
};

const REVERSE_PLACES = [
  "Home", "Gate", "Womb", "Heart", "Mind", "Fork", "Surrender", "River",
  "Fire", "Wolf, Swan and Seer", "Thorned House", "Sunset Seer", "Nest",
  "Blue Moon", "Enchanted Wood", "Broken Floor",
] as const;

function eventLabel(event: StoryEventDefinition) {
  const object = event.objectId ? getStoryObject(event.objectId) : undefined;
  const target = object?.targets?.find((candidate) => candidate.id === event.targetId);
  if (!object && event.trigger === "stillness") return "Remain with the constellation";
  return `${VERBS[event.trigger]} ${object?.label ?? "this place"}${target ? ` — ${target.label}` : ""}`;
}

/** Physical scene descriptions are interface alternatives, never canonical prose. */
const ENVIRONMENT_DESCRIPTIONS: Record<string, string> = {
  "broken-floor.first-wipe": "A clear patch opens in the water.",
  "broken-floor.forest-revealed": "Branches are visible beneath the floor.",
  "broken-floor.inversion": "The room becomes the reflection. The forest is now around you.",
  "epilogue.reverse-light-complete": "The places behind you have returned in light. They begin to become stars.",
  "epilogue.constellation-seen": "Your witnessed memories remain together in the sky.",
};

function acceptsInput(sceneId: JourneySceneId) {
  return !document.hidden && document.hasFocus()
    && !useSettingsStore.getState().drawerOpen
    && useJourneyStore.getState().sceneId === sceneId;
}

export default function AccessibleStoryObjects({
  sceneId,
  onAnnouncement,
}: {
  sceneId: JourneySceneId;
  onAnnouncement: (message: string) => void;
}) {
  const runtime = useStoryRuntime();
  const state = useJourneyStore(useShallow((journey) => ({
    sceneId: journey.sceneId,
    activeEntryId: journey.activeEntryId,
    relocationRevision: journey.sceneRelocationRevision,
    completedSceneIds: journey.completedSceneIds,
    worldFlags: journey.worldFlags,
    inventory: journey.inventory,
    completedStoryEventIds: journey.completedStoryEventIds,
    storyObjectStates: journey.storyObjectStates,
    storyPlacementStates: journey.storyPlacementStates,
  })));
  const drawerOpen = useSettingsStore(settings => settings.drawerOpen);
  const [pending, setPending] = useState<StoryEventDefinition | null>(null);
  const [description, setDescription] = useState("");
  const [reversePlace, setReversePlace] = useState(0);
  const [paused, setPaused] = useState(false);
  const [attentionEpoch, setAttentionEpoch] = useState(0);
  const announcement = useRef(onAnnouncement);
  announcement.current = onAnnouncement;
  const events = useMemo(() => getAvailableStoryEvents(state, sceneId), [state, sceneId]);
  const carried = useMemo(() => getCarriedStoryObjects(state), [state]);
  const sequence = events.find((event) => event.trigger === "sequence-complete");
  const visibleEvents = events.filter((event) => !["scene-enter", "sequence-complete", "scene-complete"].includes(event.trigger));
  const controlsDisabled = Boolean(!runtime || pending || sequence || drawerOpen);

  useEffect(() => {
    setPending(null);
    setDescription("");
    setReversePlace(0);
  }, [sceneId, state.activeEntryId, state.relocationRevision]);

  useEffect(() => subscribeAcceptedStoryEvents(receipt => {
    if (receipt.sceneId !== sceneId) return;
    for (const id of receipt.eventIds) {
      const event = eventsForScene(sceneId).find(candidate => candidate.id === id);
      if (!event || event.trigger === "scene-enter") continue;
      const message = ENVIRONMENT_DESCRIPTIONS[id] ?? (event.trigger === "sequence-complete"
        ? "The light returns through the places you walked."
        : `${eventLabel(event)}. The change remains in this place.`);
      setDescription(message); announcement.current(message);
      setPending(current => current?.id === id ? null : current);
    }
  }), [sceneId]);

  useEffect(() => {
    const event = sequence ?? pending;
    const lease = runtime?.currentLease();
    if (!runtime || !lease || !event || event.sceneId !== sceneId) return;
    const token = runtime.beginAttention(lease, event.id);
    if (!token) return;
    const isSequence = event.trigger === "sequence-complete";
    let frame = 0, disposed = false, lastPlace = -1, wasPaused = false;
    const read = () => {
      if (disposed) return;
      const projection = runtime.readAttention(token);
      if (!projection) {
        setPending(current => current?.id === event.id ? null : current);
        if (runtime.currentLease() && runtime.currentLease() !== lease) setAttentionEpoch(current => current + 1);
        return;
      }
      if (projection.paused !== wasPaused) { wasPaused = projection.paused; setPaused(projection.paused); }
      if (isSequence) {
        const place = Math.min(REVERSE_PLACES.length - 1, Math.floor(projection.elapsedMs / Math.max(1, projection.durationMs) * REVERSE_PLACES.length));
        if (place !== lastPlace) { lastPlace = place; setReversePlace(place); }
      }
      if (!projection.completed) frame = window.requestAnimationFrame(read);
    };
    setPaused(false);
    if (isSequence) setReversePlace(0);
    frame = window.requestAnimationFrame(read);
    return () => { disposed = true; window.cancelAnimationFrame(frame); runtime.cancelAttention(token); };
  }, [runtime, sequence, pending, sceneId, attentionEpoch]);

  function act(event: StoryEventDefinition) {
    const lease = runtime?.currentLease();
    if (!runtime || !lease || pending || sequence || !acceptsInput(sceneId)) return;
    if (event.durationMs) { setPending(event); return; }
    runtime.dispatch({ type: "event", eventId: event.id, lease });
  }

  return (
    <section className="accessible-story-moment" aria-label="Objects in this place" data-accessible-story-objects={sceneId}>
      {carried.length > 0 ? (
        <div aria-label="Carried objects">
          <p>Carried with you</p>
          <ul>{carried.map((object) => (
            <li key={object.id} data-carried-story-object={object.id}>
              {object.label}
              {!object.keepsake && object.sceneIds.includes(sceneId) ? (
                <button type="button" disabled={controlsDisabled} onClick={() => {
                  if (controlsDisabled || !acceptsInput(sceneId)) return;
                  const lease = runtime?.currentLease();
                  const accepted = lease && runtime?.dispatch({ type: "drop", objectId: object.id, lease });
                  if (accepted?.accepted) onAnnouncement(`${object.label} is set down safely.`);
                }}>Set down {object.label}</button>
              ) : null}
            </li>
          ))}</ul>
        </div>
      ) : null}
      {sequence ? (
        <p role="status" data-story-sequence="reverse-light" data-story-sequence-state={paused ? "paused" : "running"}>
          {paused ? "The returning lights wait for you." : `${REVERSE_PLACES[reversePlace]} returns in light behind you.`}
        </p>
      ) : null}
      {pending ? (
        <div data-story-event-pending={pending.id} data-story-attention-state={paused ? "paused" : "running"}>
          <p>{paused ? "This moment is paused. Return here to continue." : pending.trigger === "stillness" ? "You remain here in stillness." : "You stay with this moment."}</p>
          <button type="button" disabled={drawerOpen} onClick={() => setPending(null)}>
            {pending.trigger === "stillness" ? "Leave intentional stillness" : "Look away"}
          </button>
        </div>
      ) : null}
      <div className="accessible-story-moment__choices">
        {visibleEvents.map((event) => (
          <button key={event.id} type="button" className="is-primary" data-story-event-id={event.id} data-story-object-id={event.objectId} data-story-event-optional={event.optional ? "true" : "false"} disabled={controlsDisabled} onClick={() => act(event)}>
            {eventLabel(event)}
          </button>
        ))}
      </div>
      {description ? <p role="status" data-story-environment-description="true">{description}</p> : null}
    </section>
  );
}
