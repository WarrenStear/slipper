import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import {
  canOpenFullArchive,
  canPresentGiftDedication,
  constellationScopeFor,
  getSlipperExperienceCapabilities,
  isDirectedJourneyMode,
  resolveSlipperExperienceMode,
  resolveSlipperStartState,
} from "../src/lib/experienceMode.ts";
import {
  clearGiftDedicationAcknowledgement,
  getGiftDedicationAcknowledged,
  GIFT_DEDICATION_ACKNOWLEDGEMENT_STORAGE_KEY,
  setGiftDedicationAcknowledged,
} from "../src/lib/dedicationPresentation.ts";

function memoryStorage(initial = new Map()) {
  const values = new Map(initial);
  return {
    getItem(key) {
      return values.get(key) ?? null;
    },
    setItem(key, value) {
      values.set(key, value);
    },
    removeItem(key) {
      values.delete(key);
    },
    values,
  };
}

test("experience mode requires the presentation acknowledgement before free woods", () => {
  assert.equal(resolveSlipperExperienceMode({
    storyStarted: false,
    storyCompleted: false,
    dedicationAcknowledged: false,
  }), "first-journey");
  assert.equal(resolveSlipperExperienceMode({
    storyStarted: true,
    storyCompleted: false,
    dedicationAcknowledged: false,
  }), "returning-journey");
  assert.equal(resolveSlipperExperienceMode({
    storyStarted: true,
    storyCompleted: true,
    dedicationAcknowledged: false,
  }), "returning-journey");
  assert.equal(resolveSlipperExperienceMode({
    storyStarted: true,
    storyCompleted: true,
    dedicationAcknowledged: true,
  }), "free-woods");
  assert.equal(resolveSlipperExperienceMode({
    storyStarted: false,
    storyCompleted: false,
    dedicationAcknowledged: true,
  }), "first-journey", "presentation state cannot advance narrative state");
});

test("start states expose exactly one authored action label", () => {
  assert.deepEqual(resolveSlipperStartState({
    storyStarted: false,
    storyCompleted: false,
  }), { id: "fresh", actionLabel: "Begin" });
  assert.deepEqual(resolveSlipperStartState({
    storyStarted: true,
    storyCompleted: false,
  }), { id: "incomplete", actionLabel: "Continue the Journey" });
  assert.deepEqual(resolveSlipperStartState({
    storyStarted: true,
    storyCompleted: true,
  }), { id: "completed", actionLabel: "Return to the Woods" });
});

test("directed modes retain story and accessibility controls while withholding archive software", () => {
  for (const mode of ["first-journey", "returning-journey"]) {
    const policy = getSlipperExperienceCapabilities(mode);
    assert.equal(isDirectedJourneyMode(mode), true);
    assert.equal(policy.allowWalking, true);
    assert.equal(policy.allowContextualReading, true);
    assert.equal(policy.allowSettings, true);
    assert.equal(policy.allowAudioControls, true);
    assert.equal(policy.allowFullArchive, false);
    assert.equal(policy.showArchiveInPrimaryNavigation, false);
    assert.equal(policy.constellationScope, "witnessed-only");
    assert.equal(policy.allowConstellationNavigation, false);
    assert.equal(policy.allowArbitraryEntryNavigation, false);
    assert.equal(policy.allowFreeExploration, false);
    assert.equal(policy.showJourneyMetrics, false);
  }

  const free = getSlipperExperienceCapabilities("free-woods");
  assert.equal(isDirectedJourneyMode("free-woods"), false);
  assert.equal(canOpenFullArchive("free-woods"), true);
  assert.equal(constellationScopeFor("free-woods"), "full");
  assert.equal(free.allowConstellationNavigation, true);
  assert.equal(free.allowSceneRevisiting, true);
  assert.equal(free.allowFreeExploration, true);
});

test("dedication waits for completion, the in-world reveal, and an idle transition", () => {
  assert.equal(canPresentGiftDedication({
    storyCompleted: true,
    inWorldConstellationRevealed: true,
    transitionIdle: true,
  }), true);

  for (const blocked of [
    { storyCompleted: false, inWorldConstellationRevealed: true, transitionIdle: true },
    { storyCompleted: true, inWorldConstellationRevealed: false, transitionIdle: true },
    { storyCompleted: true, inWorldConstellationRevealed: true, transitionIdle: false },
  ]) {
    assert.equal(canPresentGiftDedication(blocked), false);
  }
});

test("dedication acknowledgement is versioned, persistent, and independently clearable", () => {
  const storage = memoryStorage();
  assert.equal(getGiftDedicationAcknowledged(storage), false);
  assert.equal(setGiftDedicationAcknowledged(true, storage), true);
  assert.equal(getGiftDedicationAcknowledged(storage), true);
  assert.match(
    storage.values.get(GIFT_DEDICATION_ACKNOWLEDGEMENT_STORAGE_KEY),
    /"version":1/,
  );
  assert.equal(clearGiftDedicationAcknowledgement(storage), true);
  assert.equal(getGiftDedicationAcknowledged(storage), false);

  storage.values.set(GIFT_DEDICATION_ACKNOWLEDGEMENT_STORAGE_KEY, "true");
  assert.equal(getGiftDedicationAcknowledged(storage), false);
  storage.values.set(GIFT_DEDICATION_ACKNOWLEDGEMENT_STORAGE_KEY, "not-json");
  assert.equal(getGiftDedicationAcknowledged(storage), false);
});

test("GiftDedication keeps exact gift copy, persistence, and all three render gates", () => {
  const component = fs.readFileSync(
    new URL("../src/components/ui/GiftDedication.tsx", import.meta.url),
    "utf8",
  );
  const styles = fs.readFileSync(
    new URL("../src/components/ui/GiftDedication.css", import.meta.url),
    "utf8",
  );

  assert.match(component, /title: "Slipper in the Woods"/);
  assert.match(component, /subtitle: "A journey to you\."/);
  assert.match(component, /recipient: "For Kylie\."/);
  assert.match(component, /"You gave these words a forest"/);
  assert.match(component, /"long before it had trees\."/);
  assert.match(component, /"I only built somewhere"/);
  assert.match(component, /"for them to live\."/);
  assert.match(component, /actionLabel: "Return to the Woods"/);
  assert.match(component, /canPresentGiftDedication\(\{/);
  assert.match(component, /setGiftDedicationAcknowledged\(true\)/);
  assert.match(component, /onReturnToWoods\(\)/);
  assert.match(component, /sibling\.inert = true/);
  assert.match(component, /document\.addEventListener\("focusin", keepFocusInsideDialog, true\)/);
  assert.match(component, /if \(event\.key !== "Tab"\) return/);
  assert.match(component, /onKeyDown=\{handleDialogKeyDown\}/);
  assert.match(styles, /prefers-reduced-motion: reduce/);
  assert.match(styles, /min-height: 100dvh/);
});
