import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import { journeyScenes, JOURNEY_ENTRY_PROGRESS } from "../src/data/journeyBlueprint.ts";
import { createFreshStoryJourneyState } from "../src/lib/storyJourneyState.ts";
import { getAvailableStoryEvents, STORY_EVENTS, isSceneStoryComplete } from "../src/storyEvents/storyEventRegistry.ts";
import { dispatchStoryEventState } from "../src/storyEvents/storyEventState.ts";
import { resolveGuidedStory, storyResponseFor, STORY_RESPONSES } from "../src/storyEvents/guidedStory.ts";
import { publishAcceptedStoryEvents, subscribeAcceptedStoryEvents } from "../src/storyEvents/acceptedStoryEvents.ts";
import { resolveStoryEventAudioCue } from "../src/components/three/audio/storyEventAudio.ts";
import { createStoryAttentionSession } from "../src/storyEvents/storyAttentionSession.ts";

const fresh = () => createFreshStoryJourneyState({ fallbackEntryId: "fragment-001", entryProgress: JOURNEY_ENTRY_PROGRESS });
function send(state, event) { return dispatchStoryEventState(state, { sceneId: state.sceneId, eventId: event.id, trigger: event.trigger, objectId: event.objectId, targetId: event.targetId, duration: event.durationMs }).state; }
function completeUntil(sceneId) {
  let state = fresh();
  for (const scene of journeyScenes) {
    state = { ...state, sceneId: scene.id, chapterId: scene.chapterId, activeEntryId: scene.keystoneEntryId };
    state = dispatchStoryEventState(state, { sceneId: scene.id, trigger: "scene-enter" }).state;
    if (scene.id === sceneId) return state;
    for (let budget = 0; !isSceneStoryComplete(state) && budget < 45; budget++) state = send(state, getAvailableStoryEvents(state).find(e => !e.optional));
    state = { ...state, completedSceneIds: [...state.completedSceneIds, scene.id] };
  }
  throw Error(sceneId);
}

test("all 32 scenes have an eligible current intention without changing state or order", () => {
  let state = fresh(), steps = 0;
  for (const scene of journeyScenes) {
    state = { ...state, sceneId: scene.id, chapterId: scene.chapterId, activeEntryId: scene.keystoneEntryId };
    state = dispatchStoryEventState(state, { sceneId: scene.id, trigger: "scene-enter" }).state;
    for (let budget = 0; !isSceneStoryComplete(state) && budget < 45; budget++) {
      const before = JSON.stringify(state), beat = resolveGuidedStory(state), available = getAvailableStoryEvents(state);
      assert.equal(JSON.stringify(state), before);
      assert.equal(beat.sceneId, scene.id);
      assert.ok(beat.instruction.length && beat.hint.length);
      assert.ok(beat.eventIds.length, scene.id);
      for (const id of beat.eventIds) assert.ok(available.some(e => e.id === id), id);
      state = send(state, available.find(e => e.id === beat.eventIds[0])); steps++;
    }
    assert.equal(resolveGuidedStory(state).kind, "complete", scene.id);
    assert.equal(resolveGuidedStory(state).instruction, scene.presentation.completionLine);
    state = { ...state, completedSceneIds: [...state.completedSceneIds, scene.id] };
  }
  assert.ok(steps > 75);
  assert.equal(state.storyObjectStates["fire.true-memory"], "preserved");
});

test("the opening only offers the current one of two wipes and then the touch", () => {
  let state = fresh();
  for (const id of ["broken-floor.first-wipe", "broken-floor.forest-revealed", "broken-floor.inversion"]) {
    const beat = resolveGuidedStory(state);
    assert.deepEqual(beat.eventIds, [id]);
    state = send(state, getAvailableStoryEvents(state).find(e => e.id === id));
  }
});

test("a carried fire object guides toward the flame instead of another pickup", () => {
  let state = completeUntil("fire.boundary");
  state = send(state, getAvailableStoryEvents(state).find(e => e.id === "fire.false-promise.take"));
  const beat = resolveGuidedStory(state);
  assert.deepEqual(beat.eventIds, ["fire.false-promise.flame"]);
  assert.ok(beat.targetLabel);
});

test("all Heart alternatives remain equal and only one is required", () => {
  let state = completeUntil("climb.heart");
  const beat = resolveGuidedStory(state);
  assert.equal(beat.kind, "choice"); assert.equal(beat.targetLabel, null);
  assert.deepEqual(new Set(beat.eventIds), new Set(["heart.rose.chosen", "heart.feather.chosen", "heart.reflection.chosen"]));
  state = send(state, getAvailableStoryEvents(state).find(e => e.id === "heart.feather.chosen"));
  assert.equal(resolveGuidedStory(state).kind, "complete");
});

test("creation and final placement also retain multiple available choices", () => {
  for (const sceneId of ["climb.womb", "crowned.sovereignty"]) {
    let state = completeUntil(sceneId);
    for (let i = 0; i < 12; i++) {
      const beat = resolveGuidedStory(state);
      if (beat.kind === "choice") { assert.ok(beat.eventIds.length >= 3); assert.equal(beat.targetLabel, null); break; }
      assert.ok(i < 11, sceneId); state = send(state, getAvailableStoryEvents(state).find(e => e.id === beat.eventIds[0]));
    }
  }
});

test("optional question pages do not displace the onward action", () => {
  const beat = resolveGuidedStory(completeUntil("climb.mind"));
  assert.deepEqual(beat.eventIds, ["mind.questions-left"]);
});

test("Surrender drops directional prompting only after the birds are released", () => {
  let state = completeUntil("river.release-surrender");
  assert.equal(resolveGuidedStory(state).kind, "action");
  state = send(state, getAvailableStoryEvents(state).find(e => e.id === "river.birds-released"));
  assert.equal(resolveGuidedStory(state).kind, "quiet");
  assert.equal(resolveGuidedStory(state).targetLabel, null);
  assert.equal(storyResponseFor(state.sceneId, ["river.surrender"]), null);
});

test("the finale asks for witnessing, not an instant completion button", () => {
  const beat = resolveGuidedStory(completeUntil("epilogue.constellation"));
  assert.equal(beat.kind, "sequence"); assert.equal(beat.targetLabel, null);
  assert.deepEqual(beat.eventIds, ["epilogue.reverse-light-complete"]);
});

test("after a safe drop, guidance can recover an eligible carried object", () => {
  let state = completeUntil("nest.protection");
  state = dispatchStoryEventState(state, { sceneId: state.sceneId, trigger: "drop", objectId: "nest.protected-linen" }).state;
  const beat = resolveGuidedStory(state);
  assert.ok(getAvailableStoryEvents(state).some(e => e.id === beat.eventIds[0]));
  assert.notEqual(beat.kind, "complete");
});

test("every bespoke aftermath caption belongs to a real authored event", () => {
  for (const [id, line] of Object.entries(STORY_RESPONSES)) {
    const event = STORY_EVENTS.find(e => e.id === id);
    assert.ok(event, id); assert.ok(line.trim());
    assert.equal(storyResponseFor(event.sceneId, [id]), line);
  }
});

test("captions cannot leak across scenes or appear from scene entry", () => {
  assert.equal(storyResponseFor("broken-floor.confession", ["crown.recognised"]), null);
  assert.equal(storyResponseFor("broken-floor.confession", ["broken-floor.confession.enter", "unknown"]), null);
});

test("choice consequences use the accepted choice without naming a preferred alternative", () => {
  assert.equal(storyResponseFor("climb.heart", ["heart.rose.chosen"]), storyResponseFor("climb.heart", ["heart.feather.chosen"]));
  assert.match(storyResponseFor("crowned.sovereignty", ["lantern.placed.window"]), /where you placed it/);
});

test("the accepted-event channel has no replay and cleans up its listener", () => {
  publishAcceptedStoryEvents("broken-floor.confession", ["broken-floor.first-wipe"]);
  const received = [], unsubscribe = subscribeAcceptedStoryEvents(event => received.push(event));
  assert.equal(received.length, 0);
  publishAcceptedStoryEvents("broken-floor.confession", []); assert.equal(received.length, 0);
  publishAcceptedStoryEvents("broken-floor.confession", ["broken-floor.forest-revealed"]); assert.equal(received.length, 1);
  unsubscribe(); unsubscribe();
  publishAcceptedStoryEvents("broken-floor.confession", ["broken-floor.inversion"]); assert.equal(received.length, 1);
});

test("presentation subscribers receive an immutable copy", () => {
  let received; const ids = ["broken-floor.first-wipe"];
  const unsubscribe = subscribeAcceptedStoryEvents(event => { received = event; });
  publishAcceptedStoryEvents("broken-floor.confession", ids); ids.push("later");
  assert.deepEqual(received.eventIds, ["broken-floor.first-wipe"]);
  assert.ok(Object.isFrozen(received) && Object.isFrozen(received.eventIds)); unsubscribe();
});

test("a failed presentation observer does not suppress later observers", () => {
  let calls = 0; const warn = console.warn; console.warn = () => {};
  const one = subscribeAcceptedStoryEvents(() => { throw Error("observer"); });
  const two = subscribeAcceptedStoryEvents(() => { calls++; });
  try { publishAcceptedStoryEvents("broken-floor.confession", ["broken-floor.first-wipe"]); assert.equal(calls, 1); }
  finally { one(); two(); console.warn = warn; }
});

test("dramatic contrast is bounded and the existing sacred silences keep priority", () => {
  for (const id of ["enchanted.hearth-unease", "blue-moon.cage-recognised", "thorn-house.refilled", "thorn-house.pattern-returned"]) {
    const cue = resolveStoryEventAudioCue(id);
    assert.ok(cue.silenceFloor >= 0 && cue.silenceFloor < 1); assert.ok(cue.silenceHold > 0 && cue.silenceHold <= 3);
  }
  assert.equal(resolveStoryEventAudioCue("fire.true-memory.flame").silenceFloor, 0);
  assert.equal(resolveStoryEventAudioCue("river.surrender").silenceFloor, 0);
});

test("aftermath presentation cannot pay off hidden or Settings wall time", () => {
  const session = createStoryAttentionSession(3600, false);
  session.setActive(true); session.sample(0); session.sample(900);
  session.setActive(false); assert.equal(session.sample(80000).completedNow, false);
  session.setActive(true); assert.equal(session.sample(81000).elapsedMs, 900);
  for (const t of [81900, 82800]) assert.equal(session.sample(t).completedNow, false);
  assert.equal(session.sample(83700).completedNow, true);
});

const source = path => fs.readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
test("only accepted input publishes: neither hydration nor repeated accepted IDs replay", () => {
  const store = source("src/stores/useJourneyStore.ts");
  assert.equal((store.match(/publishAcceptedStoryEvents\(/g) ?? []).length, 1);
  assert.match(store, /commitStory\(\{ \.\.\.result\.state[\s\S]{0,150}publishAcceptedStoryEvents/);
  assert.match(store, /result\.eventIds\.filter\(id => !snapshot\.completedStoryEventIds\.includes\(id\)\)/);
  assert.doesNotMatch(source("src/components/three/audio/useStoryEventAudio.ts"), /newAudibleStoryEvents\(/);
});

test("guidance has no progression writes or automatic choice dispatcher", () => {
  const guide = source("src/components/ui/GuidedStoryMoment.tsx");
  assert.doesNotMatch(guide, /dispatchStoryEvent|completeScene|completeStory|witnessEntry\(/);
  assert.match(guide, /beat\.kind === "quiet" \|\| beat\.kind === "sequence"/);
  assert.match(guide, /aria-live="polite"/);
});

test("directed reading offers a real path rather than teleporting to unread writing", () => {
  const app = source("src/App.tsx");
  assert.match(app, /onFollow=\{\(\) => requestGuidance\(authoredJourneyTarget\?\.id\)\}/);
  assert.match(app, /experienceMode !== "free-woods" && canContinueAuthoredStory/);
});

test("transition phases use foreground attention and retain their authored phase durations", () => {
  const transition = source("src/components/three/journey/StoryTransitionDirector.tsx");
  assert.match(transition, /createStoryAttentionSession\(phaseDuration, false\)/);
  assert.match(transition, /!suppressed && pageActive && focused && !document\.hidden/);
  assert.doesNotMatch(transition, /window\.setTimeout/);
  assert.match(transition, /session\.setActive\(false\); unsubscribe\(\)/);
});


test("transition fading follows the same witnessed time as its phase", () => {
  const component = source("src/components/three/journey/StoryTransitionDirector.tsx");
  assert.match(component, /--story-transition-elapsed/);
  assert.match(component, /phaseElapsed.current = sample.elapsedMs/);
  const css = source("src/components/three/journey/StoryTransitionDirector.css");
  assert.match(css, /animation-play-state: paused/);
  assert.match(css, /animation-delay: var\(--story-transition-elapsed/);
});

test("object guidance hides its DOM label rather than relying on Three visibility", () => {
  const director = source("src/components/three/storyEvents/StoryEventDirector.tsx");
  assert.match(director, /guideLabel.current.style.visibility = "hidden"/);
  assert.match(director, /guideLabel.current.style.visibility = guideAnchor.current.visible/);
});

test("asking for guidance cannot restore the old generic prompt into directed silence", () => {
  assert.match(source("src/components/ui/GuidedStoryMoment.css"), /\.app-shell:not\(\.is-free-woods\) \.contextual-nav-prompt\{display:none\}/);
});
