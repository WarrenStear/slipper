import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  createDefaultSettings,
  getExperienceSettingsSnapshot,
  resetExperienceSettings,
  updateExperienceSettings,
} from "../src/stores/useSettingsStore.ts";

test("Assisted Stillness is explicit, persisted state and defaults off", () => {
  assert.equal(createDefaultSettings().assistedStillness, false);
  updateExperienceSettings({ assistedStillness: true });
  assert.equal(getExperienceSettingsSnapshot().assistedStillness, true);
  resetExperienceSettings();
  assert.equal(getExperienceSettingsSnapshot().assistedStillness, false);
});

test("stillness rituals retain immersion by default and expose a deliberate assist control", () => {
  const ritualSource = readFileSync(
    new URL("../src/components/three/rituals/RitualInteraction.tsx", import.meta.url),
    "utf8",
  );
  const settingsSource = readFileSync(
    new URL("../src/components/ui/ExperienceSettingsDrawer.tsx", import.meta.url),
    "utf8",
  );
  const storyMomentSource = readFileSync(
    new URL("../src/components/three/moments/StoryMomentInteraction.tsx", import.meta.url),
    "utf8",
  );
  const journeyDirectorSource = readFileSync(
    new URL("../src/components/three/journey/JourneyDirector.tsx", import.meta.url),
    "utf8",
  );
  const reflectionSource = readFileSync(
    new URL("../src/components/three/reflections/ReflectionDirector.tsx", import.meta.url),
    "utf8",
  );
  const runtimeSource = readFileSync(new URL("../src/narrative/StoryRuntime.ts", import.meta.url), "utf8");
  const eventDirectorSource = readFileSync(new URL("../src/components/three/storyEvents/StoryEventDirector.tsx", import.meta.url), "utf8");

  assert.match(ritualSource, /if \(assistedStillness\)/);
  assert.match(ritualSource, /distanceSq\(position, stillAnchorRef\.current\)/);
  assert.match(ritualSource, /event\.code !== "KeyE"/);
  assert.match(ritualSource, /onClick=\{assistedActive \? cancelAssistedStillness : beginAssistedStillness\}/);
  assert.match(settingsSource, />Assisted Stillness</);
  assert.match(settingsSource, /controller drift cannot interrupt them/);
  assert.match(storyMomentSource, /assistedStillness = false/);
  assert.match(storyMomentSource, /useLayoutEffect\(\(\) => \{/);
  assert.match(storyMomentSource, /if \(assistedStillness\)/);
  assert.match(storyMomentSource, /assistedStillnessActive \? cancelAssistedStillness : beginAssistedStillness/);
  assert.match(storyMomentSource, /assistedStillnessLatched/);
  assert.match(storyMomentSource, /latchedStillnessAction \?\? incomingAction/);
  assert.match(storyMomentSource, /latchedStillnessActionRef\.current = action/);
  assert.match(
    storyMomentSource,
    /active &&\s+presence\.insideClearing &&\s+presence\.atTarget !== false/,
  );
  assert.match(storyMomentSource, /data-story-action-mode="accessible-stillness"/);
  assert.doesNotMatch(
    storyMomentSource,
    /story-moment__passive[\s\S]{0,320}scaleX\(\$\{progress\}\)/,
    "default stillness must invite quiet listening without a visible progress bar",
  );
  assert.match(journeyDirectorSource, /useSettingsStore\(\(state\) => state\.assistedStillness\)/);
  assert.match(journeyDirectorSource, /assistedStillness=\{assistedStillness\}/);
  assert.match(journeyDirectorSource, /JOURNEY_PLAYER_ACTIONS\.find/);
  assert.match(
    journeyDirectorSource,
    /availableJourneyPlayerActionsForScene\(storyActionScene\.id, worldFlags\)/,
  );
  assert.match(
    runtimeSource,
    /journeyPlayerActionAvailable\(action, state\.worldFlags\)/,
    "a completed authored action must be validated directly when a scene offers multiple available actions",
  );
  assert.match(runtimeSource, /intent\.type === "legacy-start" \|\| intent\.source === "physical"/);
  assert.match(journeyDirectorSource, /type: "legacy-action", actionId, choiceId, lease/);
  assert.doesNotMatch(journeyDirectorSource, /applyPlayerActionOutcome|journeyPlayerActionAvailable/);
  assert.match(eventDirectorSource, /const still = facts\.stillEligible/);
  assert.match(eventDirectorSource, /auto && !\(assistedStillness && intentionalStillnessId === event\.id\)/);
  assert.match(eventDirectorSource, /intentionalToken\.current = runtime\.beginAttention\(lease, event\.id\)/);
  assert.match(runtimeSource, /event\?\.trigger !== "stillness" \|\| facts\.stillEligible/);
  assert.match(journeyDirectorSource, /presentedStorySceneId/);
  assert.match(journeyDirectorSource, /presentedStoryScene \?\? activeNarrativeScene/);
  assert.match(journeyDirectorSource, /mode !== "explore" \|\| controls !== "walk"/);
  assert.match(journeyDirectorSource, /getJourneyEntryWorldPosition\(storyActionScene\.keystoneEntryId\)/);
  assert.match(ritualSource, /ASSISTED_STILLNESS_EVENT/);
  const directorSource = readFileSync(new URL("../src/components/three/artDirection/SceneLookDirector.tsx", import.meta.url), "utf8");
  assert.match(directorSource, /mirrorStill: measuredStillness \|\| assisted/);
  assert.match(reflectionSource, /presentation\?\.look.stillness/);
  assert.doesNotMatch(reflectionSource, /useStillnessState|ASSISTED_STILLNESS_EVENT/);
  assert.doesNotMatch(ritualSource, /\{Math\.round\(progress \* 100\)\}/);
  assert.doesNotMatch(storyMomentSource, /\{Math\.round\(progress \* 100\)\}/);
});
