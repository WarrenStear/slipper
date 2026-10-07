import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import { canReadStoryAftermath, createStoryAftermathState, enqueueStoryAftermath } from "../src/storyEvents/storyAftermath.ts";
import { createStoryAttentionSession } from "../src/storyEvents/storyAttentionSession.ts";
import { resolveGuidedStory } from "../src/storyEvents/guidedStory.ts";
import { createFreshStoryJourneyState } from "../src/lib/storyJourneyState.ts";
import { JOURNEY_ENTRY_PROGRESS } from "../src/data/journeyBlueprint.ts";
import { dispatchStoryEventState } from "../src/storyEvents/storyEventState.ts";
import { getAvailableStoryEvents } from "../src/storyEvents/storyEventRegistry.ts";

const read = file => fs.readFileSync(new URL(`../${file}`, import.meta.url), "utf8");
const viewing = { available: true, collapsed: false, inView: true, focusWithin: false, nextStepOpen: false };

test("only an available, visible, unattended caption spends time in every boolean combination", () => {
  for (let mask = 0; mask < 32; mask++) {
    const [available, collapsed, inView, focusWithin, nextStepOpen] = Array.from({ length: 5 }, (_, bit) => Boolean(mask & (1 << bit)));
    const context = Object.freeze({ available, collapsed, inView, focusWithin, nextStepOpen });
    assert.equal(canReadStoryAftermath(context), available && !collapsed && inView && !focusWithin && !nextStepOpen);
  }
});

test("offscreen reading and guide focus independently retain the remaining interval", () => {
  for (const pause of [{ inView: false }, { focusWithin: true }, { nextStepOpen: true }]) {
    const session = createStoryAttentionSession(3600, false);
    session.setActive(canReadStoryAftermath(viewing)); session.sample(0); session.sample(600);
    session.setActive(canReadStoryAftermath({ ...viewing, ...pause }));
    assert.equal(session.sample(60000).completedNow, false);
    session.setActive(canReadStoryAftermath(viewing));
    assert.equal(session.sample(61000).elapsedMs, 600);
    session.sample(62000); session.sample(63000);
    assert.equal(session.sample(64000).completedNow, true);
  }
});

test("checking the next step never replaces the consequence or changes earned story state", () => {
  let state = createFreshStoryJourneyState({ fallbackEntryId: "fragment-001", entryProgress: JOURNEY_ENTRY_PROGRESS });
  const perform = id => {
    const event = getAvailableStoryEvents(state).find(item => item.id === id);
    state = dispatchStoryEventState(state, { sceneId: state.sceneId, eventId: id, trigger: event.trigger, objectId: event.objectId }).state;
  };
  perform("broken-floor.first-wipe");
  const aftermath = enqueueStoryAftermath(createStoryAftermathState(state.sceneId), state.sceneId, ["broken-floor.first-wipe"]);
  const before = JSON.stringify(state);
  assert.deepEqual(resolveGuidedStory(state).eventIds, ["broken-floor.forest-revealed"]);
  assert.equal(JSON.stringify(state), before);
  perform("broken-floor.forest-revealed");
  const next = enqueueStoryAftermath(aftermath, state.sceneId, ["broken-floor.forest-revealed"]);
  assert.equal(next.current, aftermath.current);
  assert.deepEqual(resolveGuidedStory(state).eventIds, ["broken-floor.inversion"]);
  assert.equal(next.current.eventId, "broken-floor.first-wipe");
});

test("the next-step view renders the existing eligible instruction, not future-scene content", () => {
  const guide = read("src/components/ui/GuidedStoryMoment.tsx");
  assert.match(guide, /aria-label="Your current next step"/);
  assert.match(guide, /hidden=\{!nextStepVisible\}/);
  assert.match(guide, /<p>\{beat.instruction\}<\/p>/);
  assert.match(guide, /aria-expanded=\{nextStepVisible\} aria-controls=\{nextStepId\}/);
  assert.doesNotMatch(guide, /dispatchStoryEvent|completeScene|completeStory|witnessEntry\(|localStorage/);
});

test("visibility follows the actual caption and disconnects stale observers", () => {
  const hook = read("src/hooks/useStoryCaptionVisibility.ts");
  assert.match(hook, /observer.observe\(caption\)/);
  assert.match(hook, /entry.isIntersecting && entry.intersectionRatio >= 0.5/);
  assert.match(hook, /disposed = true; observer.disconnect\(\)/);
  assert.match(hook, /visibility.scopeKey === scopeKey/);
  assert.match(hook, /typeof IntersectionObserver === "undefined"/);
});

test("focus moves only after explicit guide controls, never on every new caption", () => {
  const guide = read("src/components/ui/GuidedStoryMoment.tsx");
  assert.match(guide, /pendingFocus.current = "intention";[\s\S]{0,100}dismiss\(\)/);
  assert.match(guide, /if \(requested === "intention" && captionRef.current\) captionRef.current.focus\(\{ preventScroll: true \}\)/);
  assert.match(guide, /onFocusCapture=\{\(\) => setFocusWithin\(true\)\}/);
  assert.match(guide, /event.relatedTarget instanceof Node/);
  assert.match(guide, /tabIndex=\{-1\}/);
  const quiet = read("src/ui/QuietGuidance.tsx");
  assert.match(quiet, /onFocusCapture=\{\(\) => onFocusWithinChange\?\.\(true\)\}/);
  assert.match(quiet, /event.relatedTarget instanceof Node/);
  assert.match(guide, /onQuietFocusRequest\?\.\(\); setLocalDetails\(false\)/);
});

test("quiet and sequence scenes do not acquire a next-step target", () => {
  const guide = read("src/components/ui/GuidedStoryMoment.tsx");
  assert.match(guide, /const quiet = !inline && \(beat.kind === "quiet" \|\| beat.kind === "sequence"\)/);
  assert.match(guide, /const canInspectStep = beat.kind !== "quiet" && beat.kind !== "sequence"/);
});

test("expanded fixed guides are bounded, scrollable, and retain explicit focus indicators", () => {
  const css = read("src/components/ui/GuidedStoryMoment.css");
  assert.match(css, /guided-story__next-step\[hidden\]\{display:none\}/);
  assert.match(css, /max-height:min\(60dvh,26rem\)/);
  assert.match(css, /overflow-y:auto;overscroll-behavior:contain/);
  assert.match(css, /guided-story__intention:focus-visible/);
});

test("focusing a control cannot change caption-label height before its click", () => {
  const guide = read("src/components/ui/GuidedStoryMoment.tsx");
  const label = guide.match(/className="guided-story__caption-label">([^\n]+)/)?.[1];
  assert.ok(label);
  assert.doesNotMatch(label, /focusWithin/);
  assert.match(label, /held \|\| nextStepOpen/);
});
