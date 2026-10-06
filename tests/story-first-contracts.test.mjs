import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { journeyScenes } from "../src/data/journeyNarrative.ts";
import { JOURNEY_SCENE_IDS } from "../src/lib/storyJourneyState.ts";
import {
  resolveStoryTransitionDurations,
  storyTransitionAllowsAction,
  storyTransitionAllowsProse,
  storyTransitionSuppressesAudio,
} from "../src/lib/storyTransitionPacing.ts";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function source(relativePath) {
  return fs.readFileSync(path.join(ROOT, relativePath), "utf8");
}

function quotedStrings(block) {
  return [...block.matchAll(/"((?:\\.|[^"\\])*)"/g)].map((match) =>
    JSON.parse(`"${match[1]}"`),
  );
}

test("all 32 authored scenes carry complete presentation and pacing contracts", () => {
  assert.equal(journeyScenes.length, 32);
  assert.deepEqual(
    journeyScenes.map((scene) => scene.id),
    [...JOURNEY_SCENE_IDS],
    "the authored experience metadata must follow the canonical scene order",
  );

  const validDensities = new Set(["none", "low", "focused", "ritual"]);
  const validTransitions = new Set(["walk", "fade", "environment", "reflection", "silence"]);
  const validTitleTreatments = new Set(["none", "subtle", "full"]);
  const validProseTreatments = new Set([
    "ambient",
    "reflected",
    "water",
    "ash",
    "wall",
    "constellation",
  ]);

  for (const scene of journeyScenes) {
    const { presentation, pacing } = scene;
    assert.ok(presentation.arrivalLine?.trim(), `${scene.id} needs an authored arrival line`);
    assert.ok(presentation.completionLine?.trim(), `${scene.id} needs an authored completion line`);
    assert.ok(Array.isArray(presentation.guidanceLines), `${scene.id} needs authored guidance lines`);
    assert.ok(
      presentation.guidanceLines.every((line) => line.trim().length > 0),
      `${scene.id} guidance cannot contain blank generated fallbacks`,
    );
    assert.ok(validTitleTreatments.has(presentation.chapterTitleTreatment));
    assert.ok(validProseTreatments.has(presentation.proseTreatment));

    assert.ok(validDensities.has(pacing.interactionDensity));
    assert.ok(validTransitions.has(pacing.transitionStyle));
    assert.ok(Number.isFinite(pacing.arrivalQuietMs) && pacing.arrivalQuietMs >= 1_800);
    assert.ok(
      Number.isFinite(pacing.minimumContemplationMs) && pacing.minimumContemplationMs >= 5_000,
      `${scene.id} must preserve a meaningful contemplation window`,
    );
    assert.ok(Number.isFinite(pacing.completionQuietMs) && pacing.completionQuietMs >= 2_000);
    assert.ok(
      Number.isFinite(pacing.guidanceDelayMs) && pacing.guidanceDelayMs >= 12_000,
      `${scene.id} guidance must remain delayed rather than behave like a HUD`,
    );
    if (presentation.silenceAfterCompletionMs !== undefined) {
      assert.equal(
        presentation.silenceAfterCompletionMs,
        pacing.completionQuietMs,
        `${scene.id} completion silence and pacing must share one authored duration`,
      );
    }
  }

  assert.deepEqual(
    journeyScenes.find((scene) => scene.id === "river.release-surrender")?.presentation.guidanceLines,
    [],
    "surrender is intentionally silent instead of receiving generated guidance",
  );
});

test("authored transition pacing resolves every handoff phase without hard-locking contemplation", () => {
  const epilogue = journeyScenes.find(
    (scene) => scene.id === "epilogue.constellation",
  );
  assert.ok(epilogue);

  assert.deepEqual(resolveStoryTransitionDurations(epilogue), {
    arrival: 5_000,
    contemplation: 7_000,
    departure: 7_000,
    silence: 7_000,
  });

  const reduced = resolveStoryTransitionDurations(epilogue, true);
  assert.deepEqual(Object.keys(reduced), [
    "arrival",
    "contemplation",
    "departure",
    "silence",
  ]);
  for (const duration of Object.values(reduced)) {
    assert.ok(duration > 0 && duration <= 160);
  }

  assert.equal(storyTransitionAllowsProse("arrival"), false);
  assert.equal(storyTransitionAllowsProse("contemplation"), true);
  assert.equal(storyTransitionAllowsAction("contemplation"), true);
  assert.equal(storyTransitionAllowsAction("departure"), false);
  assert.equal(storyTransitionSuppressesAudio("departure"), false);
  assert.equal(storyTransitionSuppressesAudio("silence"), true);
});

test("transition and dedication truth come from the authored handoff and rendered constellation", () => {
  const app = source("src/App.tsx");
  const transition = source(
    "src/components/three/journey/StoryTransitionDirector.tsx",
  );
  const finalTableau = source(
    "src/components/three/chapters/IntegratedFinalTableau.tsx",
  );
  const accessibleJourney = source(
    "src/components/ui/AccessibleStoryJourney.tsx",
  );

  assert.match(transition, /resolveStoryTransitionDurations\(scene, reducedMotion\)/);
  assert.match(transition, /sceneCompleted[\s\S]*?"departure"/);
  assert.match(transition, /scene\.presentation\.completionLine/);
  assert.match(transition, /advance\("contemplation"\)/);
  assert.match(transition, /advance\("silence"\)/);

  assert.doesNotMatch(
    app,
    /setTimeout\([\s\S]{0,160}setFinalConstellationRevealed\(true\)/,
  );
  assert.match(
    app,
    /onFinalConstellationFormationComplete=\{[\s\S]{0,100}handleFinalConstellationFormationComplete/,
  );
  assert.match(app, /narrativeAudioSuppressed=\{transitionSuppressesAudio\}/);
  assert.match(app, /suppressed=\{!transitionAllowsAction\}/);
  assert.match(app, /transitionAllowsProse/);

  assert.match(
    finalTableau,
    /eased >= CONSTELLATION_FORMATION_COMPLETE_THRESHOLD/,
  );
  assert.match(
    finalTableau,
    /MathUtils\.damp\([\s\S]{0,160}Math\.min\(delta, CONSTELLATION_MAX_FRAME_DELTA\)/,
  );
  assert.match(finalTableau, /onFormationCompleteRef\.current\?\.\(\)/);
  assert.match(
    accessibleJourney,
    /data-accessible-constellation-formation=\{accessibleConstellationFormation\}/,
  );
  assert.match(
    accessibleJourney,
    /resolveStoryTransitionDurations\(ACCESSIBLE_FINAL_SCENE, reducedMotion\)\.departure/,
  );
  assert.match(accessibleJourney, /setAccessibleConstellationFormation\("complete"\)/);
  assert.match(
    accessibleJourney,
    /finalCodaRef\.current\?\.isConnected[\s\S]{0,120}onFinalConstellationFormationComplete\?\.\(\)/,
  );
});

test("App consumes centralized authored guidance without keyword-derived narrative copy", () => {
  const app = source("src/App.tsx");

  assert.match(app, /import \{ resolveStoryGuidance \} from "\.\/lib\/storyGuidance"/);
  assert.match(app, /resolveStoryGuidance\(\{[\s\S]*?guidanceDelayMs: activeNarrativeScene\?\.pacing\.guidanceDelayMs,[\s\S]*?guidanceLines: activeNarrativeScene\?\.presentation\.guidanceLines,/);
  assert.match(app, /storySceneId === "river\.release-surrender"/);
  assert.match(app, /data-story-guidance-level=\{storyGuidance\.level\}/);

  assert.doesNotMatch(app, /function\s+narrativeSignal\b/);
  assert.doesNotMatch(app, /function\s+buildNarrativeCue\b/);
  assert.doesNotMatch(app, /(?:activeEntry|entry)\?*\.(?:body|title|excerpt)[\s\S]{0,120}\.includes\(/);
  assert.doesNotMatch(app, /(?:body|title|excerpt)\.toLowerCase\(\)[\s\S]{0,120}includes\(/);
});

test("cloud hydration reaches readiness before the start action can mutate story state", () => {
  const app = source("src/App.tsx");
  const cloudSync = source("src/hooks/useCloudJourneySync.ts");
  const onboarding = source("src/components/ui/OnboardingGate.tsx");

  assert.match(cloudSync, /const \[bootstrapReady, setBootstrapReady\] = useState\(false\)/);
  assert.match(cloudSync, /if \(!isInitialized \|\| cloudReadyRef\.current\) return/);
  assert.match(cloudSync, /hydrateJourney\(payload\.journey, \{ source: "cloud" \}\);[\s\S]{0,800}setBootstrapReady\(true\)/);
  assert.match(cloudSync, /if \(!isInitialized \|\| !bootstrapReady \|\| !bootstrappedRef\.current \|\| !cloudReadyRef\.current/);
  assert.match(cloudSync, /bootstrapRequestRef\.current \?\? beginCloudJourneyRestore/);
  assert.match(cloudSync, /if \(!restore\.accept\(payload\.sessionToken\)\)/);
  assert.match(cloudSync, /cloudReadyRef\.current = false;[\s\S]{0,250}setBootstrapReady\(true\)/);
  assert.match(cloudSync, /return \{ bootstrapReady \} as const/);

  const host = source("src/experience/StoryRuntimeContext.tsx");
  const runtime = source("src/narrative/StoryRuntime.ts");
  assert.match(app, /ready: journeyInitialized && cloudJourney\.bootstrapReady/);
  assert.match(host, /ready: shell\.ready && useJourneyStore\.getState\(\)\.isInitialized/);
  assert.match(runtime, /activity\.ready && activity\.foreground && !activity\.overlayOpen/);
  assert.doesNotMatch(app, /startStory\(/);
  assert.match(app, /restoring=\{!journeyInitialized \|\| !cloudJourney\.bootstrapReady\}/);
  assert.match(onboarding, /disabled=\{restoring\}/);
  assert.match(onboarding, /\{restoring \? "Restoring the path…" : startState\.actionLabel\}/);
});

test("Begin primes the shared narrative audio context inside the trusted gesture", () => {
  const app = source("src/App.tsx");
  const activation = source("src/lib/narrativeAudioActivation.ts");
  const director = source("src/components/three/audio/NarrativeAudioDirector.tsx");

  const navigation = source("src/experience/useStoryNavigation.ts");
  assert.match(app, /onBegin=\{enterForest\}/);
  assert.match(navigation, /function enterForest\(\)[\s\S]{0,600}dispatchNavigation\(\{ type: start\.id === "fresh" \? "begin" : "continue" \}\)/);
  assert.match(navigation, /if \(!result\?\.accepted\) return;\s*if \(!config\.accessibleJourney\) activateNarrativeAudioFromGesture\(config\.audioEnabled\)/);
  assert.match(activation, /gestureActivatedContext \?\?= new AudioContextConstructor\(\)/);
  assert.match(activation, /gestureActivatedContext\.resume\(\)/);
  assert.match(director, /THREE\.AudioContext\.setContext\(gestureContext\)/);
  const settings = source("src/components/ui/ExperienceSettingsDrawer.tsx");
  assert.match(settings, /if \(nextAudioEnabled\) activateNarrativeAudioFromGesture\(true\)/);
});

test("diegetic prose is selected by authored treatment and rendered from its canonical entry", () => {
  const director = source("src/components/three/storyText/DiegeticProseDirector.tsx");
  const moment = source("src/components/three/storyText/StoryTextMoment.tsx");
  const treatments = [
    ["ambient", "AmbientProse"],
    ["reflected", "ReflectedProse"],
    ["water", "WaterProse"],
    ["ash", "AshProse"],
    ["wall", "WallProse"],
    ["constellation", "ConstellationProse"],
  ];

  assert.match(director, /if \(!entry \|\| !scene \|\| !witnessed \|\| !active \|\| suppressed\) return null/);
  assert.match(director, /scene\.presentation\.proseTreatment \?\? "ambient"/);
  assert.match(director, /return <Prose entry=\{entry\} onOpenReader=\{onOpenReader\} \/>/);

  for (const [treatment, component] of treatments) {
    assert.match(director, new RegExp(`${treatment}: ${component}`));
    const wrapper = source(`src/components/three/storyText/${component}.tsx`);
    assert.match(wrapper, new RegExp(`treatment="${treatment}"`));
  }

  assert.match(moment, /entry\.paragraphs\.find\(/);
  assert.match(moment, /\?\? entry\.body/);
  assert.match(moment, /<blockquote>\{excerpt\}<\/blockquote>/);
  assert.match(moment, /data-source-entry=\{entry\.id\}/);
  assert.doesNotMatch(moment, /journeyScenes|guidanceLines|arrivalLine|completionLine/);
});

test("directed journey capabilities gate every software-like App entry point", () => {
  const app = source("src/App.tsx");
  const navigation = source("src/experience/useStoryNavigation.ts");
  const settings = source("src/components/ui/ExperienceSettingsDrawer.tsx");

  assert.match(app, /const experienceCapabilities = getSlipperExperienceCapabilities\(experienceMode\)/);
  assert.match(app, /if \(archiveOpen && experienceCapabilities\.allowFullArchive\)/);
  assert.match(navigation, /function openArchive\(\)[\s\S]{0,140}if \(!config\.capabilities\.allowFullArchive\) return/);
  assert.match(navigation, /config\.capabilities\.showGenericNavigation &&[\s\S]{0,160}key === "b"/);
  assert.match(navigation, /key === "m"[\s\S]{0,80}config\.capabilities\.allowConstellationNavigation/);
  assert.match(app, /experienceMode === "free-woods" \? <MagicLinkSignIn \/> : null/);
  assert.match(app, /experienceMode === "free-woods" && showMiniMap \? <MiniMapHUD/);
  assert.match(app, /prologueResolved && mode === "explore"[\s\S]{0,360}showContextualGuidance \? <ContextualNavigationPrompt/);
  assert.match(app, /experienceMode === "free-woods" \? \([\s\S]{0,900}<button type="button" onClick=\{openArchive\}>Open archive<\/button>/);
  assert.match(app, /<AccessibleStoryJourney[\s\S]{0,240}experienceMode=\{experienceMode\}/);
  assert.match(app, /freeWoods=\{experienceMode === "free-woods"\}/);
  assert.match(settings, /experienceCapabilities\.showJourneyMetrics \? \([\s\S]{0,200}<section className="experience-settings-card journey-card"/);
  assert.match(settings, /experienceCapabilities\.allowConstellationNavigation \? \([\s\S]{0,220}<span>Archive map<\/span>/);
  assert.match(settings, /experienceCapabilities\.allowFreeExploration && !mobileViewport\.isMobile/);
  assert.match(settings, /experienceCapabilities\.allowFreeExploration \? \([\s\S]{0,520}Reset journey/);
  assert.match(settings, /<span>Guidance assistance<\/span>/);
  assert.match(settings, /setSetting\("showContextualGuidance", !showContextualGuidance\)/);
});

test("the threshold presents the exact gift title, subtitle, and one state-derived primary action", () => {
  const onboarding = source("src/components/ui/OnboardingGate.tsx");
  const styles = source("src/components/ui/OnboardingGate.css");

  assert.match(onboarding, /<h1 id="onboarding-title">SLIPPER IN THE WOODS<\/h1>/);
  assert.match(onboarding, /<p className="onboarding-copy" id="onboarding-description">A journey to you\.<\/p>/);
  assert.match(onboarding, /className="primary"[\s\S]{0,160}\{restoring \? "Restoring the path…" : startState\.actionLabel\}/);
  assert.equal((onboarding.match(/className="primary"/g) ?? []).length, 1);
  assert.doesNotMatch(onboarding, /Begin the text journey|Read first|Enter the world|Open archive|View map/);
  assert.match(styles, /\.onboarding-card h1[\s\S]{0,360}onboarding-story-stage 1\.2s \.35s/);
  assert.match(styles, /\.onboarding-copy[\s\S]{0,300}onboarding-story-stage 1\.1s 1\.35s/);
  assert.match(styles, /\.onboarding-actions[\s\S]{0,300}onboarding-story-stage 1s 2\.35s/);
  assert.match(styles, /@media \(prefers-reduced-motion: reduce\)[\s\S]{0,1400}animation: none/);
});

test("the final dedication preserves the exact Kylie copy and Return action", () => {
  const dedication = source("src/components/ui/GiftDedication.tsx");
  const messageBlock = dedication.match(/message: Object\.freeze\(\[([\s\S]*?)\]\),/);
  assert.ok(messageBlock, "dedication message array must remain explicit and reviewable");

  assert.match(dedication, /recipient: "For Kylie\."/);
  assert.deepEqual(quotedStrings(messageBlock[1]), [
    "You gave these words a forest",
    "long before it had trees.",
    "I only built somewhere",
    "for them to live.",
  ]);
  assert.match(dedication, /actionLabel: "Return to the Woods"/);
  assert.match(dedication, /canPresentGiftDedication\(\{[\s\S]*?storyCompleted,[\s\S]*?inWorldConstellationRevealed,[\s\S]*?transitionIdle,/);
  assert.match(dedication, /setGiftDedicationAcknowledged\(true\);\s*onReturnToWoods\(\)/);
});
