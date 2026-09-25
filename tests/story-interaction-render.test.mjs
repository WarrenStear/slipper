import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function source(path) {
  return readFileSync(new URL(path, import.meta.url), "utf8");
}

test("Blue Moon interactions bind to authored sanctuary objects and contradictions", () => {
  const actions = source("../src/lib/journeyPlayerActions.ts");
  const chapter = source("../src/components/three/chapters/BlueMoonSanctuaryChapter.tsx")
    + source("../src/components/three/storyEvents/ObservedSanctuaryReflection.tsx");

  for (const actionId of [
    "action.blue-moon.light-candles",
    "action.blue-moon.touch-water",
    "action.blue-moon.follow-swan",
    "action.blue-moon.place-flowers",
    "action.blue-moon.open-door",
  ]) {
    assert.match(actions, new RegExp(actionId.replaceAll(".", "\\.")));
  }
  for (const objectName of [
    "blue-moon-candle-path",
    "blue-moon-guiding-swan",
    "blue-moon-flower-table",
    "blue-moon-delayed-reflection",
    "lock-visible-only-in-reflection",
    "candle-that-died-without-wind",
    "bridge-that-loops",
  ]) {
    assert.match(chapter, new RegExp(objectName));
  }
  assert.match(chapter, /open=\{beautifulDoorOpen\}/);
  const director = source("../src/components/three/storyEvents/StoryEventDirector.tsx");
  assert.match(director, /sceneId === "blue-moon\.sanctuary" && object\.id === "blue-moon\.water"/);
  // Suppress only the duplicate image: the named pose still supplies the same
  // authored location to physical proximity, focus and touch-event selection.
  assert.match(director, /return <StoryObjectPose[^>]+position=\{location\}[^>]*>\s*\{chapterOwnsVisual \? null : <StoryObjectModel/);
  assert.match(director, /renderedObject\.getWorldPosition\(target\.current\); root\.worldToLocal\(target\.current\)/);
});

test("Wolf Swan and Seer require three witnessed paths before convergence", () => {
  const actions = source("../src/lib/journeyPlayerActions.ts");
  const progression = source("../src/lib/journeyProgression.ts");
  const chapter = source("../src/components/three/chapters/IntegrationChapter.tsx");

  assert.match(actions, /action\.integration\.swan-alone/);
  assert.match(actions, /action\.integration\.wolf-alone/);
  assert.match(actions, /action\.integration\.seer-alone/);
  assert.match(actions, /action\.integration\.hold-three/);
  assert.match(progression, /integration\.three-aspects-held/);
  assert.match(chapter, /integrated-\$\{symbol\}-node/);
  assert.match(chapter, /three-aspects-held/);
});

test("Fork verbs resolve only at bounded object-space targets by default", () => {
  const actions = source("../src/lib/journeyPlayerActions.ts");
  const director = source("../src/components/three/journey/JourneyDirector.tsx");
  const interaction = source("../src/components/three/moments/StoryMomentInteraction.tsx");

  assert.match(actions, /localPosition: \[-5\.2, -4\].+moving water/);
  assert.match(actions, /localPosition: \[5\.3, -3\.8\].+familiar door/);
  assert.match(actions, /localPosition: \[6\.2, 3\.5\].+obsolete path marker/);
  assert.match(director, /targetDistance <= target\.radius/);
  assert.match(interaction, /presence\.atTarget !== false/);
  assert.match(interaction, /Use an assisted approach to/);
});

test("Heart and Womb visual choices are one-at-a-time world targets, not a button menu", () => {
  const actions = source("../src/lib/journeyPlayerActions.ts");
  const chapter = source("../src/components/three/chapters/ThreeClimbsChapter.tsx");
  const director = source("../src/components/three/journey/JourneyDirector.tsx");
  const interaction = source("../src/components/three/moments/StoryMomentInteraction.tsx");
  const accessibleJourney = source("../src/components/ui/AccessibleStoryJourney.tsx");

  assert.match(actions, /HEART_MEMORY_WORLD_TARGETS/);
  assert.match(actions, /WOMB_FUTURE_WORLD_TARGETS/);
  assert.match(actions, /frame: "arrival"/);
  assert.match(actions, /nearestJourneyPlayerActionChoice/);
  assert.match(actions, /journeyPlayerActionChoiceAtTarget/);
  assert.match(chapter, /worldChoiceId: "heart\.tenderness"/);
  assert.match(chapter, /worldChoiceId: "future\.home"/);
  assert.match(chapter, /interaction: "approach-and-press"/);
  assert.match(director, /const storyActionChoiceProximity = useMemo/);
  assert.match(director, /physicallyReachedChoice\?\.id !== selectedChoice\.id/);
  assert.match(interaction, /data-story-choice-presentation=\{action\.mode === "choice" \? "world-target"/);
  assert.match(interaction, /action\.mode === "choice" && worldChoice && !event\.repeat/);
  assert.match(interaction, /data-story-action-mode="world-choice"/);
  assert.doesNotMatch(interaction, /className="story-moment__choices"/);
  assert.doesNotMatch(interaction, /action\.choices\?\.map/);
  assert.doesNotMatch(interaction, /worldChoice\.meaning/);

  // The non-canvas reader intentionally retains an equivalent explicit list.
  assert.match(accessibleJourney, /className="accessible-story-moment__choices"/);
  assert.match(accessibleJourney, /storyAction\.choices\?\.map/);
});
