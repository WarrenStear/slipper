import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function read(relativePath) {
  return fs.readFileSync(path.join(ROOT, relativePath), "utf8");
}

test("the accessible route is deterministic and never mounts the WebGL world", () => {
  const app = read("src/App.tsx");
  const accessibleBranch = app.indexOf("if (accessibleJourney) {");
  const worldBranch = app.indexOf("<WorldCanvas");

  assert.match(app, /params\.get\("accessible"\) === "1"/);
  assert.match(app, /canvas\.getContext\("webgl2"/);
  assert.match(app, /<AccessibleStoryJourney/);
  assert.ok(accessibleBranch >= 0 && accessibleBranch < worldBranch);
});

test("the text journey uses canonical gates, outcomes, and explicit choices", () => {
  const journey = read("src/components/ui/AccessibleStoryJourney.tsx");

  assert.match(journey, /nextResolvableRitualForEntry\(activeEntry\.id, progressionState\)/);
  assert.match(journey, /canResolveRitual\(ritualInteraction\.ritualId, latest\)/);
  assert.match(journey, /nextJourneyPlayerAction\(activeScene\.id, latest\.worldFlags\)/);
  assert.match(journey, /canEnterNarrativeEntry\(entryId, latest\)/);
  assert.match(journey, /for \(const outcome of ritualBeat\.outcomes \?\? \[\]\) applyRitualOutcome\(outcome\)/);
  assert.match(journey, /const outcomes = choice\?\.outcomes \?\? action\.outcomes \?\? \[\]/);
  assert.match(journey, /storyAction\.choices\?\.map\(\(choice\) =>/);
  assert.match(journey, /data-accessible-choice-id=\{choice\.id\}/);
  assert.match(journey, /mode="map"[\s\S]*proximity=\{null\}/);
});

test("the text journey follows first-journey, returning, and free-woods disclosure", () => {
  const journey = read("src/components/ui/AccessibleStoryJourney.tsx");

  assert.match(journey, /experienceMode: SlipperExperienceMode/);
  assert.match(journey, /getSlipperExperienceCapabilities\(experienceMode\)/);
  assert.match(journey, /isDirectedJourneyMode\(experienceMode\)/);
  assert.match(journey, /data-experience-mode=\{experienceMode\}/);
  assert.match(journey, /capabilities\.showJourneyMetrics \? \(/);
  assert.match(journey, /capabilities\.showArchiveInPrimaryNavigation \? \(/);
  assert.match(journey, /isWitnessed && capabilities\.allowBookmarks/);
  assert.match(journey, /capabilities\.allowSceneRevisiting \? \(/);
  assert.match(journey, /capabilities\.showGenericNavigation && capabilities\.allowFullArchive/);
  assert.match(
    journey,
    /return !directedJourney \|\| journey\.witnessedEntryIds\.includes\(entry\.id\)/,
    "directed journeys must not expose unwitnessed scene titles",
  );
  assert.match(
    journey,
    /<button type="button" onClick=\{onOpenSettings\}>Accessibility &amp; settings<\/button>/,
    "settings remain directly reachable in every experience mode",
  );
});

test("unwitnessed prose remains absent from both accessible surfaces", () => {
  const journey = read("src/components/ui/AccessibleStoryJourney.tsx");
  const archive = read("src/components/ui/AccessibleArchive.tsx");

  assert.match(journey, /\{isWitnessed \? \([\s\S]*entryParagraphs\(activeEntry\)\.map/);
  assert.match(journey, /Witness and reveal this memory/);
  assert.match(archive, /new Set\(witnessedEntryIds \?\? visitedEntryIds\)/);
  assert.match(archive, /const searchableProse = remembered\.has\(entry\.id\)/);
  assert.match(archive, /isVisited && isExpanded/);
});
