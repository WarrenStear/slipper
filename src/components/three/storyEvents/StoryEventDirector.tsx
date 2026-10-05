import { resolveGuidedStory } from "../../../storyEvents/guidedStory";
import { Html } from "@react-three/drei";
import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { observeInteractionTarget } from "../../../player/interactionFacts";
import type { JourneySceneId } from "../../../lib/storyJourneyState";
import { objectsForScene, eventsForScene, getAvailableStoryEvents, getCarriedStoryObjects } from "../../../storyEvents/storyEventRegistry";
import {
  advanceStoryAttentionClock, beginStoryPointerGesture, cancelStoryPointerGesture,
  clearStorySequencePlayback, createStoryAttentionClock, createStoryPointerGesture,
  finishStoryPointerGesture, ownsStoryPointerGesture, pauseStoryAttentionClock,
  publishStorySequencePlayback, type StoryAttentionClock,
} from "../../../storyEvents/storyEventRuntime";
import type { StoryEventDefinition, StoryObjectDefinition } from "../../../storyEvents/storyEventTypes";
import { useJourneyStore } from "../../../stores/useJourneyStore";
import { useSettingsStore } from "../../../stores/useSettingsStore";
import { useWorldStore } from "../../../stores/useWorldStore";
import { StoryObjectModel } from "./StoryObjectModel";
import { beginFloorStroke, breakFloorStroke, brushFloor, cancelFloorStroke, floorStrokeReady } from "./storyInteractionRuntime";
import { StoryObjectIdentity, StoryObjectPose } from "./StoryObjectPose";
import { StoneBasin, TimberAssembly } from "../chapters/ChapterArt";
import type { ConstructionPiece } from "../chapters/chapterArtGeometry";
import "./StoryObjects.css";

const AUTOMATIC = new Set(["scene-enter", "volume-enter", "volume-exit", "gaze", "stillness", "scene-complete", "sequence-complete"]);
const VERBS: Record<string, string> = { pickup: "Take", touch: "Touch", wipe: "Wipe", place: "Place", light: "Light", open: "Open", close: "Close", burn: "Place in fire", wash: "Wash", release: "Release", plant: "Plant", inspect: "Look closely", extinguish: "Extinguish" };
// Stable construction data avoids rebuilding this merged mesh as focus changes.
// The semantic mirror stays at its authored height; joined feet reach Y=0.
const CROWN_MIRROR_STAND: readonly ConstructionPiece[] = [
  ...[-.61, .61].flatMap(x => [
    { position: [x, -.38, 0] as [number, number, number], size: [.12, 2.44, .16] as [number, number, number] },
    { position: [x, -1.55, 0] as [number, number, number], size: [.25, .1, .9] as [number, number, number] },
  ]),
  { position: [0, -.92, 0], size: [1.22, .12, .13] },
];

function eventLocation(event: StoryEventDefinition, objects: readonly StoryObjectDefinition[]) {
  const object = objects.find(item => item.id === event.objectId);
  const target = object?.targets?.find(item => item.id === event.targetId)
    ?? objects.flatMap(item => item.targets ?? []).find(item => item.id === event.targetId);
  return { object, position: target?.localPosition ?? object?.localPosition ?? [0, 0, 0], radius: target?.radius ?? object?.radius ?? 3, label: target?.label ?? object?.label ?? "this place" };
}

/** Physical inputs and semantic controls share one authored reducer. No frame enters durable state. */
export function StoryEventDirector({ sceneId, reducedMotion, enabled = true }: { sceneId: JourneySceneId; reducedMotion: boolean; enabled?: boolean }) {
  const { camera, gl, scene: renderedScene } = useThree();
  const group = useRef<THREE.Group>(null);
  const carriedGroup = useRef<THREE.Group>(null);
  const hudAnchor = useRef<THREE.Group>(null);
  const guideAnchor = useRef<THREE.Group>(null);
  const guideLabel = useRef<HTMLSpanElement>(null);
  const events = useJourneyStore(state => state.completedStoryEventIds);
  const objectStates = useJourneyStore(state => state.storyObjectStates);
  const placements = useJourneyStore(state => state.storyPlacementStates);
  const flags = useJourneyStore(state => state.worldFlags);
  const inventory = useJourneyStore(state => state.inventory);
  const completedScenes = useJourneyStore(state => state.completedSceneIds);
  const guidance = useSettingsStore(state => state.showContextualGuidance);
  const assistedStillness = useSettingsStore(state => state.assistedStillness);
  const [focused, setFocused] = useState<StoryEventDefinition | null>(null);
  const focusRef = useRef<StoryEventDefinition | null>(null);
  const [lastAction, setLastAction] = useState("");
  const [touched, setTouched] = useState(false);
  const [intentionalStillnessId, setIntentionalStillnessId] = useState<string | null>(null);
  const objects = useMemo(() => objectsForScene(sceneId), [sceneId]);
  const pending = useMemo(() => getAvailableStoryEvents(useJourneyStore.getState(), sceneId), [events, objectStates, placements, flags, inventory, completedScenes, sceneId]);
  const pendingRef = useRef(pending); pendingRef.current = pending;
  const guidedBeat = useMemo(() => resolveGuidedStory(useJourneyStore.getState()), [pending]);
  const guidedEvent = guidedBeat.kind === "action" ? pending.find(event => event.id === guidedBeat.eventIds[0]) : undefined;
  const carried = getCarriedStoryObjects(useJourneyStore.getState()).filter(object => object.id !== "lantern.master");
  const localCamera = useRef(new THREE.Vector3());
  const localForward = useRef(new THREE.Vector3());
  const target = useRef(new THREE.Vector3());
  const cameraLast = useRef(new THREE.Vector3());
  const quaternionLast = useRef(new THREE.Quaternion());
  const orientation = useRef(new THREE.Quaternion());
  const timers = useRef(new Map<string, StoryAttentionClock>());
  const entered = useRef(new Set<string>());
  const sample = useRef(0);
  const inputActivity = useRef({ keys: new Set<string>(), pointers: new Set<number>(), lastAt: 0 });
  const raycaster = useRef(new THREE.Raycaster());
  const pointer = useRef(new THREE.Vector2());
  const surfaces = useMemo(() => {
    const targetIds = new Set(eventsForScene(sceneId).flatMap(event => event.targetId ? [event.targetId] : []));
    const uniqueTargets = new Map<string, NonNullable<StoryObjectDefinition["targets"]>[number]>();
    for (const object of objects) for (const target of object.targets ?? []) {
      if (targetIds.has(target.id) && !objects.some(item => item.id === target.id)) uniqueTargets.set(target.id, target);
    }
    return [...uniqueTargets.values()];
  }, [sceneId, objects]);
  const gesture = useRef(createStoryPointerGesture<StoryEventDefinition>());

  function suspendInput() {
    if (guideAnchor.current) guideAnchor.current.visible = false;
    if (guideLabel.current) guideLabel.current.style.visibility = "hidden";
    cancelStoryPointerGesture(gesture.current);
    cancelFloorStroke();
    for (const clock of timers.current.values()) pauseStoryAttentionClock(clock);
    sample.current = 0;
    inputActivity.current.keys.clear();
    inputActivity.current.pointers.clear();
    inputActivity.current.lastAt = performance.now();
    if (focusRef.current) { focusRef.current = null; setFocused(null); }
  }

  function dispatch(event: StoryEventDefinition, duration = event.durationMs ?? 0) {
    if (!enabled || document.hidden || !document.hasFocus() || useSettingsStore.getState().drawerOpen || useWorldStore.getState().mode !== "explore") return false;
    if (event.objectId && renderedScene.getObjectByName(`story-object:${event.objectId}`)?.userData.storyPresentationSettled === false) return false;
    const accepted = useJourneyStore.getState().dispatchStoryEvent({ sceneId, eventId: event.id, trigger: event.trigger, objectId: event.objectId, targetId: event.targetId, duration });
    if (accepted.length) {
      setLastAction(`${VERBS[event.trigger] ?? "Witnessed"} · ${eventLocation(event, objects).label}`);
      timers.current.delete(event.id);
    }
    return accepted.length > 0;
  }
  useEffect(() => {
    timers.current.clear(); entered.current.clear(); sample.current = 0;
    cancelStoryPointerGesture(gesture.current);
    cancelFloorStroke();
    clearStorySequencePlayback(sceneId);
    setIntentionalStillnessId(null);
    setFocused(null); focusRef.current = null;
    if (enabled) useJourneyStore.getState().dispatchStoryEvent({ sceneId, trigger: "scene-enter" });
    return () => clearStorySequencePlayback(sceneId);
  }, [sceneId, enabled]);

  useEffect(() => {
    if (!assistedStillness && intentionalStillnessId) {
      timers.current.delete(intentionalStillnessId);
      setIntentionalStillnessId(null);
    }
  }, [assistedStillness, intentionalStillnessId]);

  useEffect(() => {
    if (!enabled) return;
    const canvas = gl.domElement;
    const canInput = () => !document.hidden && document.hasFocus() && !useSettingsStore.getState().drawerOpen && useWorldStore.getState().mode === "explore";
    const down = (event: PointerEvent) => {
      if (!canInput() || !beginStoryPointerGesture(gesture.current, event.pointerId, focusRef.current, event.clientX, event.clientY, event.button)) return;
      setTouched(true);
      if (focusRef.current?.objectId === "broken-floor.reflection" && focusRef.current.trigger === "wipe") { beginFloorStroke(); move(event); }
    };
    const move = (event: PointerEvent) => {
      const state = gesture.current;
      if (!ownsStoryPointerGesture(state, event.pointerId)) return;
      if (!canInput()) { cancelStoryPointerGesture(state); cancelFloorStroke(); return; }
      const dx = document.pointerLockElement === canvas ? event.movementX : event.clientX - state.x;
      const dy = document.pointerLockElement === canvas ? event.movementY : event.clientY - state.y;
      state.x = event.clientX; state.y = event.clientY;
      if (state.event?.trigger !== "wipe" || state.event.objectId !== "broken-floor.reflection") { state.length += Math.hypot(dx, dy); return; }
      // Stamp the mesh UV under the actual ray, not the unrelated screen UV.
      const floor = renderedScene.getObjectByName("wipeable-wet-floor");
      if (!floor) { breakFloorStroke(); return; }
      const rect = canvas.getBoundingClientRect();
      pointer.current.set(document.pointerLockElement === canvas ? 0 : (event.clientX - rect.left) / rect.width * 2 - 1,
        document.pointerLockElement === canvas ? 0 : 1 - (event.clientY - rect.top) / rect.height * 2);
      raycaster.current.setFromCamera(pointer.current, camera);
      const hit = raycaster.current.intersectObject(floor, false)[0];
      if (!hit?.uv) { breakFloorStroke(); return; }
      state.length += Math.hypot(dx, dy);
      brushFloor(hit.uv.x, hit.uv.y);
    };
    const up = (event: PointerEvent) => {
      const state = finishStoryPointerGesture(gesture.current, event.pointerId);
      if (!state) return;
      const coveredFloor = floorStrokeReady();
      cancelFloorStroke();
      if (!state.event || !canInput()) return;
      // A tap must still refer to the object being attended to at release.
      if (state.event.trigger !== "wipe" && focusRef.current?.id !== state.event.id) return;
      state.x = event.clientX; state.y = event.clientY;
      if (state.event.objectId === "broken-floor.reflection" && state.event.trigger === "touch") {
        const floor = renderedScene.getObjectByName("wipeable-wet-floor");
        const rect = canvas.getBoundingClientRect();
        pointer.current.set(document.pointerLockElement === canvas ? 0 : (state.x - rect.left) / rect.width * 2 - 1,
          document.pointerLockElement === canvas ? 0 : 1 - (state.y - rect.top) / rect.height * 2);
        raycaster.current.setFromCamera(pointer.current, camera);
        if (!floor || !raycaster.current.intersectObject(floor, false)[0]?.uv) return;
      }
      const physicalWipe = state.event.objectId === "broken-floor.reflection" ? coveredFloor : state.length >= 100;
      if (state.event.trigger === "wipe" ? physicalWipe : state.length < 22) dispatch(state.event);
    };
    const key = (event: KeyboardEvent) => {
      if (!canInput() || event.repeat || event.defaultPrevented || event.ctrlKey || event.metaKey || event.altKey || event.isComposing) return;
      if (event.target instanceof HTMLElement && (event.target.isContentEditable || event.target.closest("button,input,textarea,select"))) return;
      if (event.code === "KeyE" && focusRef.current) {
        cancelStoryPointerGesture(gesture.current);
        cancelFloorStroke();
        dispatch(focusRef.current);
      }
      if (event.code === "KeyG") {
        const item = getCarriedStoryObjects(useJourneyStore.getState()).find(item => !item.keepsake);
        if (item) useJourneyStore.getState().dispatchStoryEvent({ sceneId, trigger: "drop", objectId: item.id });
      }
    };
    const activityDown = (event: PointerEvent) => { inputActivity.current.pointers.add(event.pointerId); inputActivity.current.lastAt = performance.now(); };
    const activityUp = (event: PointerEvent) => { inputActivity.current.pointers.delete(event.pointerId); inputActivity.current.lastAt = performance.now(); };
    const keyDown = (event: KeyboardEvent) => { inputActivity.current.keys.add(event.code); inputActivity.current.lastAt = performance.now(); };
    const keyUp = (event: KeyboardEvent) => { inputActivity.current.keys.delete(event.code); inputActivity.current.lastAt = performance.now(); };
    const cancel = () => suspendInput();
    const cancelPointer = (event: PointerEvent) => {
      if (ownsStoryPointerGesture(gesture.current, event.pointerId)) { cancelStoryPointerGesture(gesture.current); cancelFloorStroke(); }
    };
    const visibility = () => { if (document.hidden) cancel(); };
    window.addEventListener("pointerdown", activityDown);
    window.addEventListener("pointerup", activityUp);
    window.addEventListener("pointercancel", activityUp);
    window.addEventListener("keydown", keyDown);
    window.addEventListener("keyup", keyUp);
    window.addEventListener("blur", cancel);
    window.addEventListener("pointercancel", cancelPointer);
    canvas.addEventListener("lostpointercapture", cancelPointer);
    document.addEventListener("visibilitychange", visibility);
    document.addEventListener("pointerlockchange", cancel);
    canvas.addEventListener("pointerdown", down);
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    window.addEventListener("keydown", key);
    return () => {
      canvas.removeEventListener("pointerdown", down);
      window.removeEventListener("pointercancel", cancelPointer);
      canvas.removeEventListener("lostpointercapture", cancelPointer);
      document.removeEventListener("visibilitychange", visibility);
      document.removeEventListener("pointerlockchange", cancel);
      window.removeEventListener("pointermove", move); window.removeEventListener("pointerup", up); window.removeEventListener("keydown", key);
      window.removeEventListener("pointerdown", activityDown); window.removeEventListener("pointerup", activityUp); window.removeEventListener("pointercancel", activityUp);
      window.removeEventListener("keydown", keyDown); window.removeEventListener("keyup", keyUp); window.removeEventListener("blur", cancel);
      cancel();
    };
  }, [enabled, gl, camera, renderedScene, sceneId, objects]);

  useFrame((_, delta) => {
    const root = group.current;
    if (!root) return;
    if (!enabled || document.hidden || !document.hasFocus() || useSettingsStore.getState().drawerOpen || useWorldStore.getState().mode !== "explore") {
      suspendInput();
      return;
    }
    const dt = Math.min(delta, .1);
    sample.current += dt;
    if (hudAnchor.current) {
      target.current.set(0, 0, -1).applyQuaternion(camera.quaternion).add(camera.position);
      root.worldToLocal(target.current);
      hudAnchor.current.position.copy(target.current);
    }
    if (carriedGroup.current) {
      target.current.set(-.28, -.38, -.92).applyQuaternion(camera.quaternion).add(camera.position);
      root.worldToLocal(target.current);
      carriedGroup.current.position.lerp(target.current, reducedMotion ? 1 : 1 - Math.exp(-dt * 16));
      root.getWorldQuaternion(orientation.current).invert();
      carriedGroup.current.quaternion.copy(orientation.current).multiply(camera.quaternion);
    }
    if (sample.current < .075) return;
    const now = performance.now(); sample.current = 0;
    const still = inputActivity.current.keys.size === 0 && inputActivity.current.pointers.size === 0
      && performance.now() - inputActivity.current.lastAt > 350
      && camera.position.distanceToSquared(cameraLast.current) < .0009
      && 1 - Math.abs(camera.quaternion.dot(quaternionLast.current)) < .00008;
    cameraLast.current.copy(camera.position); quaternionLast.current.copy(camera.quaternion);
    localCamera.current.copy(camera.position); root.worldToLocal(localCamera.current);
    camera.getWorldDirection(localForward.current);
    root.getWorldQuaternion(orientation.current).invert(); localForward.current.applyQuaternion(orientation.current);
    let best: StoryEventDefinition | null = null; let bestScore = Infinity;
    for (const event of pendingRef.current) {
      const location = eventLocation(event, objects);
      const renderedObject = event.objectId && !event.targetId ? renderedScene.getObjectByName(`story-object:${event.objectId}`) : undefined;
      if (renderedObject?.userData.storyPresentationSettled === false) continue;
      if (renderedObject) { renderedObject.getWorldPosition(target.current); root.worldToLocal(target.current); }
      else target.current.set(location.position[0], location.position[1], location.position[2]);
      const { distance, inside, alignment, looking } = observeInteractionTarget(
        localCamera.current, localForward.current, target.current, location.radius,
      );
      const atFloor = sceneId === "broken-floor.confession" && objectStates["broken-floor.reflection"] !== "inverted";
      const lookingAtFloor = atFloor && localForward.current.y < -.08;
      const at = inside || (lookingAtFloor && ["wipe", "touch"].includes(event.trigger));
      if (inside) entered.current.add(event.id);
      const leavingHouse = event.objectId === "thorn-house.threshold";
      // Cross the actual open front doorway and come back into the room.
      // Leaving a spherical trigger toward the room is not a departure.
      const volumeEntry = leavingHouse ? inside && localCamera.current.z > -2.6 : inside;
      const volumeExit = leavingHouse ? localCamera.current.z < -4.85 && Math.abs(localCamera.current.x) < 2
        : !inside && (event.objectId !== "fork.door" || !looking);
      const auto = event.trigger === "scene-enter" || event.trigger === "scene-complete" || event.trigger === "sequence-complete"
        || (event.trigger === "volume-enter" && volumeEntry)
        || (event.trigger === "volume-exit" && volumeExit && entered.current.has(event.id))
        || (event.trigger === "gaze" && inside && looking)
        || (event.trigger === "stillness" && (
          ((inside || !event.objectId) && still)
          || (assistedStillness && intentionalStillnessId === event.id)
        ));
      if (AUTOMATIC.has(event.trigger)) {
        let clock = timers.current.get(event.id);
        if (!clock) { clock = createStoryAttentionClock(event.trigger !== "sequence-complete"); timers.current.set(event.id, clock); }
        const elapsed = advanceStoryAttentionClock(clock, now, auto);
        const required = event.durationMs ?? (event.trigger === "gaze" ? 1100 : event.trigger === "stillness" ? 4500 : 0);
        if (event.trigger === "sequence-complete") publishStorySequencePlayback(sceneId, event.id, elapsed, required);
        if (auto && elapsed >= required) dispatch(event, elapsed);
      } else if (at && (looking || lookingAtFloor)) {
        const score = distance + (1 - alignment) * 2;
        if (score < bestScore) { best = event; bestScore = score; }
      }
    }
    if (guideAnchor.current && guidedEvent) {
      const location = eventLocation(guidedEvent, objects);
      const renderedObject = guidedEvent.objectId ? renderedScene.getObjectByName(`story-object:${guidedEvent.objectId}`) : undefined;
      if (!guidedEvent.targetId && renderedObject) {
        renderedObject.getWorldPosition(target.current); root.worldToLocal(target.current);
      } else target.current.set(location.position[0], location.position[1], location.position[2]);
      target.current.y += 1.1;
      guideAnchor.current.position.copy(target.current);
      guideAnchor.current.visible = guidance && !best && renderedObject?.userData.storyPresentationSettled !== false;
      // Html is a DOM overlay: Three group visibility alone does not hide its label.
      if (guideLabel.current) guideLabel.current.style.visibility = guideAnchor.current.visible ? "visible" : "hidden";
    }
    if (best?.id !== focusRef.current?.id) { focusRef.current = best; setFocused(best); }
  });

  const surrenderQuiet = sceneId === "river.release-surrender" && pending.some(event => event.trigger === "stillness");
  const visible = focused && !surrenderQuiet;
  return <group ref={group} name="lived-story-objects" userData={{ sceneId }}>
    {objects.map(object => {
      const state = objectStates[object.id];
      if (object.id === "broken-floor.reflection" || object.kind === "path" || ["carried", "burned", "released"].includes(state ?? "")) return null;
      // The actor/player lantern owns guidance and carrying. Only the chosen
      // placed light is rendered by the object system.
      if (object.kind === "lantern" && !(object.id === "lantern.master" && state === "placed")) return null;
      if (object.id === "thorn-house.threshold") return null;
      // Keep semantic poses for input while the chapter/actor owns the image.
      // A second miniature Swan at its destination competes with the real bird
      // and overlaps it when reduced motion parks the actor at that location.
      // SanctuaryWater also owns the touch surface; a metallic object disk
      // floats above it and obscures the moon reflection.
      const chapterOwnsVisual = (sceneId.startsWith("sunset.") && object.kind === "mirror")
        || (sceneId === "blue-moon.intimacy" && object.kind === "swan")
        || (sceneId === "blue-moon.sanctuary" && object.id === "blue-moon.water")
        || (sceneId === "fire.boundary" && object.id === "fire.flame")
        || (sceneId === "fork.weighing" && object.id === "fork.weighing-stone");
      const placement = state === "reset" || state === "resting" ? undefined : object.targets?.find(item => item.id === placements[object.id]);
      const preservedAt = state === "preserved" ? object.targets?.[0]?.localPosition : undefined;
      const location: [number, number, number] = preservedAt ? [preservedAt[0] + .8, preservedAt[1] + .2, preservedAt[2]] : placement?.localPosition ?? object.localPosition;
      return <StoryObjectPose key={object.id} object={object} state={state} position={location} placementId={placements[object.id]} reducedMotion={reducedMotion}>
        {chapterOwnsVisual ? null : <StoryObjectModel kind={object.kind} state={state ?? (object.id === "fork.door" ? "open" : undefined)} reducedMotion={reducedMotion} />}
        {object.id === "home.crown-mirror" ? <TimberAssembly name="crown-mirror-grounded-stand" color="#66503d" pieces={CROWN_MIRROR_STAND} /> : null}
        {object.id === "home.water" ? <group name="home-water-basin-support"><StoneBasin position={[0, -.16, 0]} radius={1.12} height={.34} color="#827b69" /></group> : null}
      </StoryObjectPose>;
    })}
    {surfaces.map(surface => <group key={surface.id} name={`story-placement:${surface.id}`} position={surface.localPosition} userData={{ targetId: surface.id }}>
      <mesh position={[0, -.07, 0]} receiveShadow><boxGeometry args={[.95, .1, .7]} /><meshStandardMaterial color="#635648" roughness={.96} /></mesh>
    </group>)}
    <group ref={carriedGroup} name="first-person-story-carry">
      {carried.map((object, index) => <group key={object.id} position={[index * .36, 0, 0]} scale={.36} name={`carried:${object.id}`}><StoryObjectModel kind={object.kind} state="carried" reducedMotion={reducedMotion} /><StoryObjectIdentity objectId={object.id} /></group>)}
    </group>
    {guidance && guidedEvent && sceneId !== "broken-floor.confession" ? (
      <group ref={guideAnchor} visible={false} name="current-story-intention">
        <Html center zIndexRange={[25, 20]} style={{ pointerEvents: "none" }}>
          <span ref={guideLabel} className="story-guided-target" style={{ visibility: "hidden" }} aria-hidden="true">{guidedBeat.targetLabel}</span>
        </Html>
      </group>
    ) : null}
    <group ref={hudAnchor}>
    <Html fullscreen zIndexRange={[45, 40]} style={{ pointerEvents: "none" }}>
      <div className="story-object-hud" data-story-scene={sceneId} data-story-events={events.join(" ")}>
        {visible ? <button type="button" className="story-object-focus" data-story-object-id={focused.objectId} data-story-event-id={focused.id} onClick={() => dispatch(focused)}>
          <span>{VERBS[focused.trigger] ?? focused.trigger}</span><small>{eventLocation(focused, objects).label}</small>
        </button> : null}
        {sceneId === "broken-floor.confession" && (!touched || !events.includes("broken-floor.first-wipe")) ? <p className="story-object-onboarding">Look down. Drag across the wet floor.</p> : null}
        {!surrenderQuiet && carried.some(item => !item.keepsake) ? <button type="button" className="story-object-focus story-object-drop" style={{ bottom: "31%", right: "1rem", left: "auto", transform: "none" }} onClick={() => {
          const item = getCarriedStoryObjects(useJourneyStore.getState()).find(item => !item.keepsake);
          if (item) useJourneyStore.getState().dispatchStoryEvent({ sceneId, trigger: "drop", objectId: item.id });
        }}>Set down</button> : null}
        {guidance && carried.length > 0 ? <p className="story-object-carry-label">{carried.map(item => item.label).join(" · ")} <span>G · set down</span></p> : null}
        {assistedStillness && surrenderQuiet ? <button className="story-object-focus" onClick={() => {
          const event = pending.find(item => item.trigger === "stillness");
          if (!event) return;
          // Assistance replaces the need to hold the camera still, not the
          // authored quiet interval. The same frame clock performs completion.
          timers.current.delete(event.id);
          setIntentionalStillnessId(current => current === event.id ? null : event.id);
        }}>{intentionalStillnessId ? "Cancel intentional stillness" : "Enter intentional stillness"}</button> : null}
        <span className="sr-only" role="status">{lastAction}</span>
      </div>
    </Html>
    </group>
  </group>;
}
