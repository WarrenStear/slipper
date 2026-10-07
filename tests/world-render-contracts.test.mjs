import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import {
  THORNED_HOUSE_COLLIDER_BUDGET,
  THORNED_HOUSE_SAFE_ROUTE_HALF_WIDTH,
  resolveThornedHouseColliderLayout,
} from "../src/lib/thornedHouseArchitecture.ts";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function read(relativePath) {
  return fs.readFileSync(path.join(ROOT, relativePath), "utf8");
}

test("semantic Rapier sensors keep exactly one instanced-mesh child", () => {
  const source = read("src/components/three/StoryScene.tsx");
  const lines = source.split(/\r?\n/);
  const themes = ["water", "threshold", "thorns", "celestial"];

  for (const theme of themes) {
    const openingIndex = lines.findIndex((line) =>
      line.includes(`instances={interactiveSemanticRigidBodies.${theme}}`),
    );
    assert.notEqual(openingIndex, -1, `missing ${theme} InstancedRigidBodies`);
    assert.match(lines[openingIndex], /colliderNodes=\{\[<BallCollider\b.*\/>\]\}>/);

    const firstChild = lines.slice(openingIndex + 1).find((line) => line.trim() !== "");
    assert.match(firstChild ?? "", /^\s*<instancedMesh\b/);
  }
});

test("the master lantern and canvas own their render responsibilities", () => {
  const scene = read("src/components/three/StoryScene.tsx");
  const wrapper = read("src/components/three/StorySceneWithMasterLantern.tsx");
  const canvas = read("src/components/three/WorldCanvas.tsx");
  const atmosphere = read("src/components/three/world/WorldAtmosphere.tsx");
  const engine = read("src/components/three/world/WorldEngineLayer.tsx");
  const visualState = read("src/components/three/worldVisualState.ts");
  const lanternNarrative = read("src/lib/lanternNarrative.ts");
  const finalizer = read("scripts/check-final-4d-world.mjs");

  assert.doesNotMatch(scene, /<PlayerLantern\b/);
  assert.doesNotMatch(scene, /useRenderQualityProfile\(\)/);
  assert.doesNotMatch(scene, /<RenderQualityController\b/);
  assert.match(wrapper, /deriveLanternNarrative/);
  assert.match(wrapper, /const showCarriedLantern[\s\S]*lanternNarrative\.presence === "carried"/);
  assert.match(wrapper, /showCarriedLantern \? \([\s\S]*<MasterPlayerLantern/);
  assert.match(wrapper, /narrativePhase=\{lanternNarrative\}/);
  assert.match(wrapper, /<MasterPlayerLantern[\s\S]*reducedEffects=\{reducedEffects\}/);
  assert.match(wrapper, /<StoryScene[\s\S]*qualityProfile=\{qualityProfile\}[\s\S]*reducedEffects=\{reducedEffects\}/);
  assert.match(canvas, /resolveEnvironmentalEffectsProfile\(requestedQualityProfile, reducedEffects\)/);
  assert.match(canvas, /<CanvasRendererController\b/);
  assert.doesNotMatch(atmosphere, /gl\.toneMapping|gl\.outputColorSpace/);
  assert.doesNotMatch(engine, /<WorldAtmosphere|<WorldLightingRig/);
  assert.match(read("src/world/atmosphere/CelestialMoon.tsx"), /function CelestialMoon/);
  assert.match(read("src/world/atmosphere/LegacySceneAtmosphere.tsx"), /<CelestialMoon/);
  assert.match(scene, /from "\.\.\/\.\.\/world\/atmosphere\/LegacySceneAtmosphere\.tsx"/);
  assert.match(scene, /<LegacySceneAtmosphere/);
  assert.match(read("src/world/forest/useForestTextures.ts"), /FOREST_GROUND_ALBEDO_PATH/);
  assert.match(read("src/world/forest/ContinuousForestBed.tsx"), /useSafeForestTextures/);
  assert.match(read("src/world/atmosphere/AtmosphericForestPanorama.tsx"), /FIRST_WOOD_PANORAMA_PATH/);
  assert.match(read("src/world/atmosphere/CinematicForestDepthPlate.tsx"), /FIRST_WOOD_DEPTH_PLATE_PATH/);
  assert.match(read("src/world/atmosphere/AtmosphericForestPanorama.tsx"), /<CinematicForestDepthPlate/);
  assert.match(scene, /<AtmosphericForestPanorama/);
  assert.match(read("src/world/atmosphere/AtmosphericForestPanorama.tsx"), /first-wood-panorama-v3\.webp/);
  assert.match(read("src/world/atmosphere/CinematicForestDepthPlate.tsx"), /forest-sky-horizon-v1\.webp/);
  assert.match(scene, /from "\.\/environment\/ProceduralDome"/);
  assert.match(read("src/components/three/environment/ProceduralDome.tsx"), /function ProceduralDome[\s\S]*skyFbm/);
  assert.match(read("src/world/atmosphere/LegacySceneAtmosphere.tsx"), /activeVisualState\.showStars && qualityProfile\.starMultiplier > 0/);
  assert.match(read("src/world/atmosphere/DistantForestSilhouetteRing.tsx"), /function DistantForestSilhouetteRing/);
  assert.match(scene, /<DistantForestSilhouetteRing/);
  assert.match(scene, /showDepthPlate=\{visualState\.biome === "firstWood" && qualityProfile\.quality !== "low"\}/);
  assert.match(read("src/components/three/environment/ProceduralDome.tsx"), /qualityProfile\.quality === "medium"[\s\S]*cloudDetail/);
  assert.doesNotMatch(visualState, /fireBias > 0\.54/);
  assert.match(lanternNarrative, /"distant"[\s\S]*"borrowed"[\s\S]*"released"/);
  assert.match(visualState, /const baseMoonColor = biome === "fireRiver"[\s\S]*mixColor/);
  assert.match(read("src/world/atmosphere/CelestialMoon.tsx"), /MOON_ALBEDO_PATH/);
  assert.match(read("src/world/guidance/MemoryBloomLandmark.tsx"), /MEMORY_BLOOM_TEXTURE_PATH/);
  assert.match(scene, /<MemoryBloomLandmark/);
  assert.match(scene, /<LivingPathMist/);
  assert.match(scene, /<LivingPathRibbon/);
  assert.match(read("src/world/forest/ContinuousForestBed.tsx"), /from "\.\/forestGeometry(?:\.ts)?"/);
  assert.match(scene, /<ContinuousForestBed/);
  assert.match(read("src/world/forest/forestGeometry.ts"), /function createOrganicCrownGeometry/);
  assert.match(read("src/world/forest/forestGeometry.ts"), /geometry\.setIndex\(data\.indices\)/);
  assert.match(read("src/world/forest/forestGeometry.ts"), /geometry\.morphAttributes\.normal/);
  assert.doesNotMatch(read("src/world/forest/ContinuousForestBed.tsx"), /crownAccentRef|lowerCrownRef|upperCrownRef|sideCrownRef/);
  assert.doesNotMatch(scene, /applyNarrativeTextureBlend/);
  assert.ok(
    fs.statSync(path.join(ROOT, "public/textures/forest/ground-albedo-v3.webp")).size < 400_000,
  );
  assert.ok(
    fs.statSync(path.join(ROOT, "public/textures/forest/memory-bloom-v1.png")).size < 320_000,
  );
  assert.ok(
    fs.statSync(path.join(ROOT, "public/textures/environment/moon-albedo-v1.png")).size < 240_000,
  );
  assert.ok(
    fs.statSync(path.join(ROOT, "public/textures/environment/forest-sky-horizon-v1.webp")).size < 140_000,
  );
  assert.ok(
    fs.statSync(path.join(ROOT, "public/textures/environment/first-wood-panorama-v3.webp")).size < 250_000,
  );
  assert.match(
    finalizer,
    /resolveEnvironmentalEffectsProfile[\s\S]*?particleMultiplier: 0,/,
  );
});

test("authored world geometry replaces generic portals while thresholds remain a fallback", () => {
  const app = read("src/App.tsx");
  const scene = read("src/components/three/StoryScene.tsx");
  const wrapper = read("src/components/three/StorySceneWithMasterLantern.tsx");
  const layout = read("src/lib/worldLayout.ts");
  const worker = read("src/workers/forestWorker.ts");
  const journeyDirector = read("src/components/three/journey/JourneyDirector.tsx");
  const threshold = read("src/components/three/journey/EnvironmentalThreshold.tsx");
  const worldMemory = read("src/components/three/worldMemory/WorldMemoryDirector.tsx");
  const ritual = read("src/components/three/rituals/RitualInteraction.tsx");
  const lanternNarrative = read("src/lib/lanternNarrative.ts");

  assert.match(app, /<JourneyDirector[\s\S]*activeEntryId=\{resolvedActiveEntryId\}/);
  assert.match(app, /lockedEntryIds=\{lockedJourneyEntryIds\}/);
  assert.match(scene, /if \(getJourneyEntryContext\(node\.entry\.id\)\) return false;/);
  assert.match(scene, /<EnvironmentalThreshold[\s\S]*locked=\{lockedEntryIdSet\.has\(node\.entry\.id\)\}/);
  assert.match(scene, /<WorldMemoryDirector\b/);
  assert.doesNotMatch(scene, /function WorldGateway|function Portals|function PortalPathBeams/);
  assert.doesNotMatch(scene, /<WorldGateway\b|<Portals\b|<PortalPathBeams\b/);
  assert.match(layout, /buildPhysicalStoryLinks/);
  assert.match(journeyDirector, /canEnterJourneyEntry/);
  const storyRuntime = read("src/narrative/StoryRuntime.ts");
  assert.match(storyRuntime, /selectReadyActTransformation\(act\.id, state\)/);
  assert.match(storyRuntime, /applyJourneyOutcome\(outcome, getState\(\)\)/);
  assert.match(storyRuntime, /from "\.\/StoryActions\.ts"/);
  assert.match(journeyDirector, /runtime\.dispatch\(\{ type: "ritual"/);
  assert.match(journeyDirector, /runtime\.dispatch\(\{ type: "legacy-action"/);
  assert.doesNotMatch(journeyDirector, /function applyJourneyOutcome|export function canEnterJourneyEntry/);
  assert.match(threshold, /the way is not ready/);
  assert.match(threshold, /import \{ CapsuleCollider, RigidBody \} from "@react-three\/rapier"/);
  assert.match(
    threshold,
    /LOCKED_BRANCH_ROTATIONS\.map\([\s\S]*?<cylinderGeometry[\s\S]*?LOCKED_BRANCH_LENGTH[\s\S]*?<RigidBody type="fixed" colliders=\{false\}[\s\S]*?<CapsuleCollider[\s\S]*?LOCKED_BRANCH_COLLIDER_HALF_HEIGHT[\s\S]*?LOCKED_BRANCH_RADIUS/,
  );
  assert.match(threshold, /locked = false/);
  assert.match(threshold, /\{locked \? <LockedThresholdBarrier \/> : null\}/);
  assert.equal((threshold.match(/<LockedThresholdBarrier \/>/g) ?? []).length, 1);
  assert.match(worldMemory, /name="persistent-world-memory"/);
  assert.match(worldMemory, /AUTHORED_MEMORY_LANDMARKS[\s\S]*JOURNEY_CHAPTER_LAYOUTS\.map/);
  assert.match(worldMemory, /landmark\.chapterId !== state\.chapterId/);
  assert.match(wrapper, /deriveLanternNarrative/);
  assert.match(lanternNarrative, /lantern\.placed-and-lit/);
  assert.match(ritual, /event\.code !== "KeyE"/);
  assert.match(ritual, /inputMode === "stillness"/);
  assert.doesNotMatch(ritual, /Stand still for|seconds remaining|% complete/i);
  assert.doesNotMatch(worker, /tooCloseToPlayer|playerPosition/);
});

test("persistent world memory renders authored multi-stage consequences within fixed budgets", () => {
  const app = read("src/App.tsx");
  const worldMemory = read("src/components/three/worldMemory/WorldMemoryDirector.tsx");
  const fireRiver = read("src/components/three/chapters/FireRiverChapter.tsx");
  const fork = read("src/components/three/chapters/ForkChapter.tsx");

  assert.match(app, /const resonances = useJourneyStore\(\(state\) => state\.resonances\)/);
  assert.match(app, /const releasedWords = useJourneyStore\(\(state\) => state\.releasedWords\)/);
  assert.match(app, /worldFlags,\s*resonances,\s*releasedWords,\s*storyStarted,\s*storyCompleted,/);
  assert.match(worldMemory, /resonances: Readonly<Record<ResonanceKey, number>>/);
  assert.match(worldMemory, /releasedWords: readonly string\[\]/);
  assert.match(worldMemory, /resolveResonancePalette/);
  assert.match(worldMemory, /symbolKeys: RESONANCE_KEYS\.filter/);

  assert.match(worldMemory, /mirrorStage = witnessed \? "readable-cracked" : "distorted"/);
  assert.match(worldMemory, /MIRROR_DISTORTION_SLICES/);
  assert.match(worldMemory, /memoryStage = flowersBloomed \? "open-flowering" : doorOpen \? "open-bare" : "closed-thorned"/);
  assert.match(worldMemory, /"beautiful-no-longer-loops"/);
  assert.match(worldMemory, /name="blue-moon-memory-open-path"/);
  assert.match(worldMemory, /name="blue-moon-memory-looping-path"/);
  assert.match(worldMemory, /fireStage: shootsGrowing \? "ash-and-shoots" : burned \? "ash" : "flame"/);
  assert.match(worldMemory, /waterStage: washed \? "clear" : "dark"/);
  assert.match(worldMemory, /birdsStage: departed \? "departed" : "present"/);
  assert.match(worldMemory, /name="white-surrender-flag"/);
  assert.match(worldMemory, /gateStage: keyRecognised \? "key-recognised" : "awaiting-key"/);
  assert.match(worldMemory, /name="sparse-final-room-symbols"/);
  assert.match(worldMemory, /name="completed-in-world-constellation"/);
  assert.match(worldMemory, /lanternStage: placed \? "placed-and-lit"/);
  assert.match(worldMemory, /"landmark\.first-wood-lantern"[\s\S]*actDone\(state, "first-wood"\)/);
  assert.match(worldMemory, /memoryStage: transformed[\s\S]*"path-transformed"/);
  assert.match(worldMemory, /name="first-wood-transformed-path"/);
  assert.match(worldMemory, /name="broken-floor-memory"/);
  assert.match(worldMemory, /"calm-after-crowned-return"/);
  assert.match(worldMemory, /name="nest-memory"/);
  assert.match(worldMemory, /"warm-open-space"/);
  assert.match(worldMemory, /name="wolf-swan-seer-memory"/);
  assert.match(worldMemory, /"three-symbols-integrated"/);
  assert.match(worldMemory, /name="fork-memory"/);
  assert.match(worldMemory, /pastPathStage: pastOvergrown \? "partially-overgrown"/);
  assert.match(worldMemory, /futurePathStage: futureEstablished \? "established"/);
  assert.match(worldMemory, /name="three-climbs-memory"/);
  assert.match(worldMemory, /name="lantern-epilogue-memory"/);

  for (const chapterId of [
    "broken-floor",
    "enchanted-wood",
    "blue-moon-sanctuary",
    "nest",
    "sunset-seer",
    "thorned-house",
    "wolf-swan-seer",
    "fire-river",
    "fork",
    "three-climbs",
    "crowned-return",
  ]) {
    assert.match(worldMemory, new RegExp(`chapterId === "${chapterId}"`));
  }
  assert.match(worldMemory, /return <EpilogueMemory/);
  assert.doesNotMatch(worldMemory, /LANDMARK_ANCHOR_BY_CHAPTER|entryWorldPosition|grouped\.get\(entry\.chapter\)/);

  assert.match(fireRiver, /worldFlags\["fire\.boundary-burned"\]/);
  assert.match(fireRiver, /completedRitualIds\.includes\("ritual\.burn-boundary"\)/);
  assert.match(fireRiver, /worldFlags\["river\.grief-washed"\]/);
  assert.match(fireRiver, /worldFlags\["surrender\.white-flag-raised"\]/);
  assert.match(fireRiver, /resolved=\{fireResolved\}/);
  assert.match(fireRiver, /resolved=\{riverResolved\}/);
  assert.doesNotMatch(fireRiver, /fireResolved = atRiver \|\| surrendered/);

  const forkLandscape = read("src/components/three/environment/ForkLandscape.tsx");
  assert.match(fork, /<ForkLandscape overgrown=\{pastPathOvergrown\} established=\{futurePathEstablished\}/);
  assert.match(forkLandscape, /name="fork-past-path-overgrowth"/);
  assert.match(forkLandscape, /name="fork-future-path-established"/);
  assert.match(fork, /rememberFourVerbs = fourVerbs \|\| letGo \|\| declined \|\| departed \|\| deleted/);
  assert.match(fork, /rememberOwnership = ownershipScene \|\| oldHopeRelinquished \|\| lanternOwned/);

  assert.match(worldMemory, /const MAX_RELEASED_WORDS = 5/);
  assert.match(worldMemory, /words\.slice\(-MAX_RELEASED_WORDS\)/);
  assert.doesNotMatch(worldMemory, /state\.releasedWords\.map\(/);
  assert.match(worldMemory, /createBlackBirdFlockGeometry/);
  assert.match(worldMemory, /<lineSegments>/);
  assert.match(worldMemory, /useSettingsStore\(\(settings\) => settings\.reducedMotion\)/);
  assert.match(worldMemory, /if \(reducedMotion\) \{/);
  assert.doesNotMatch(worldMemory, /useTexture|useGLTF|<Text\b/);
});

test("the prologue, story roles, and guidance express authored progression", () => {
  const app = read("src/App.tsx");
  const scene = read("src/components/three/StoryScene.tsx");
  const guidance = read("src/world/guidance/GuidanceController.tsx");
  const brokenFloor = read("src/scenes/broken-floor/BrokenFloorScene.tsx");
  const onboarding = read("src/components/ui/OnboardingGate.tsx");
  const onboardingStyles = read("src/components/ui/OnboardingGate.css");
  const ritual = read("src/components/three/rituals/RitualInteraction.tsx");
  const ritualStyles = read("src/components/three/rituals/RitualInteraction.css");
  const worldMemory = read("src/components/three/worldMemory/WorldMemoryDirector.tsx");
  const sunsetSeer = read("src/components/three/chapters/SunsetSeerChapter.tsx");
  const reflection = read("src/components/three/reflections/ReflectionDirector.tsx");
  const mirrorSurface = read("src/components/three/reflections/MirrorMemorySurface.tsx");
  const reflectedPath = read("src/components/three/reflections/ReflectedPath.tsx");
  const waterReflection = read("src/components/three/reflections/WaterMemoryReflection.tsx");
  const nest = read("src/components/three/chapters/NestChapter.tsx");
  const thornedHouse = read("src/components/three/chapters/ThornedHouseChapter.tsx");
  const fireRiver = read("src/components/three/chapters/FireRiverChapter.tsx");
  const firePath = read("src/components/three/chapters/FirePath.tsx");
  const riverPath = read("src/components/three/chapters/RiverPath.tsx");
  const surrenderClearing = read("src/components/three/chapters/SurrenderClearing.tsx");
  const archiveIndex = read("src/components/ui/ArchiveIndex.tsx");
  const accessibleArchive = read("src/components/ui/AccessibleArchive.tsx");
  const constellation = read("src/components/ui/ConstellationMap.tsx");

  assert.match(onboarding, /SLIPPER IN THE WOODS/);
  assert.match(onboarding, /A journey to you\./);
  assert.match(onboarding, /startState\.actionLabel/);
  assert.match(onboarding, /className="onboarding-gate is-story-first"/);
  assert.doesNotMatch(onboarding, /Read First|Open Map|Enter the Wood/);
  assert.match(onboardingStyles, /\.onboarding-gate\.is-story-first/);
  assert.match(onboardingStyles, /background: #010202/);
  assert.match(brokenFloor, /name="broken-floor-progressive-inversion"/);
  assert.match(brokenFloor, /name="forest-beneath-wet-reflection"/);
  assert.match(brokenFloor, /storyObjectStates\?\.\["broken-floor\.reflection"\]/);
  assert.match(brokenFloor, /<WetFloorReveal stage=\{revealStage\}/);
  assert.match(read("src/world/opening/openingComposition.ts"), /const target = openingRoomTarget\(stage\)/);
  assert.match(brokenFloor, /advanceOpeningRoom\(inversionProgressRef\.current, revealStage, delta, active, reducedMotion\)/);
  assert.doesNotMatch(brokenFloor, /inversionProgressRef\.current \+ delta \/ duration/);
  assert.match(brokenFloor, /roomMaterialRef\.current\.opacity = roomOpacity/);
  assert.match(brokenFloor, /name="distant-light-recedes-into-wood"/);

  assert.match(ritual, /ritual\.id === "ritual\.surrender"/);
  assert.match(ritual, /className="ritual-interaction__surrender-cue"/);
  assert.match(ritualStyles, /\.ritual-interaction\.is-surrender/);
  assert.doesNotMatch(ritual, /seconds remaining|% complete/i);

  assert.match(scene, /const journeyRole = getJourneyEntryContext\(node\.entry\.id\)\?\.role \?\? "echo"/);
  assert.doesNotMatch(scene, /getJourneyBeatForEntry\(node\.entry\.id\)/);
  assert.match(app, /activeJourneyChapter\?\.title \?\? activeEntry\?\.chapter/);
  const rememberedPaths = read("src/ui/navigation/RememberedPaths.tsx");
  assert.match(app, /const visitedCount = visitedEntryIds\.length;/);
  assert.match(app, /const totalCount = entries\.length;/);
  assert.match(app, /navigationDetails=\{<RememberedPaths[\s\S]*?counts=\{\{ visited: visitedCount, total: totalCount, visuals: contentDiagnostics\.visualCount, chapters: journeyChapters\.length \}\}/);
  assert.match(rememberedPaths, /\{counts\.visited\}\/\{counts\.total\} seen · \{counts\.visuals\} visuals · \{counts\.chapters\} chapters/);
  assert.match(archiveIndex, /canonicalChapter\?\.title \?\? entry\.chapter/);
  assert.match(accessibleArchive, /journeyChapters\.map\(\(chapter, chapterIndex\)/);
  assert.match(constellation, /journeyChapters\.length\} chapters/);
  assert.doesNotMatch(constellation, /completedRituals\} rituals/);
  assert.match(scene, /name="keystone-memory-halo"/);
  assert.match(scene, /name="echo-memory-whisper"/);
  assert.match(guidance, /availableNavigationNodes/);
  assert.match(guidance, /nodes\.filter\(node => !lockedEntryIdSet\.has\(node\.entry\.id\)\)/);
  assert.match(scene, /lockedEntryIdSet\.has\(node\.entry\.id\)/);
  assert.match(app, /nextRequiredEntry/);
  assert.match(app, /authoredJourneyTarget \?\? nextUnreadEntry/);

  assert.match(worldMemory, /JOURNEY_CHAPTER_LAYOUTS/);
  assert.match(worldMemory, /anchorSceneId: chapter\.anchorSceneId/);
  assert.match(worldMemory, /rotationY: chapter\.anchor\.headingRadians/);
  assert.match(scene, /thresholdRotationForNode/);
  assert.match(scene, /rotationY=\{thresholdRotationForNode\(node, pathSegments\)\}/);

  assert.match(sunsetSeer, /<ReflectionDirector/);
  assert.match(sunsetSeer, /<WaterMemoryReflection/);
  assert.match(reflection, /samplesRef/);
  assert.doesNotMatch(reflection, /useStillnessState|addEventListener/);
  assert.match(
    reflection,
    /reflectionSettled = isStillnessScene && Boolean\(presentation\?\.look.stillness\)/,
  );
  assert.match(reflection, /sampleCount = reducedMotion \? 1 : reducedEffects \? 12 : qualityProfile.quality === "low" \? 18 : 34/);
  assert.match(reflection, /lerp\(delayed.x, localCamera.x, clarity\)/);
  assert.doesNotMatch(reflection, /sampleCount = [^;]*reflectionSettled/, "stillness must blend the existing history, not reset the reflection buffer");
  assert.match(reflection, /name="reflected-past-and-future"/);
  assert.match(reflection, /<ReflectionApparition apparition/);
  assert.match(reflection, /<ReflectedPath/);
  assert.match(mirrorSurface, /uDistortion/);
  assert.match(mirrorSurface, /still \? 0 : warm/);
  assert.doesNotMatch(reflectedPath, /LOOK AGAIN|HiddenReflectionText|reflection-only-hidden-text/, "physical reflection shows the route; accessible guidance remains separate");
  assert.match(reflectedPath, /name="reflection-only-hidden-route"/);
  assert.match(waterReflection, /name="reflection-only-water-route"/);

  assert.match(nest, /function TwoHandRepair/);
  assert.match(nest, /function UnsupportedWeight/);
  assert.match(nest, /function ProtectionShelter/);
  assert.match(thornedHouse, /name="thorned-house-modular-rooms"/);
  assert.match(thornedHouse, /name="thorned-house-refilled-surfaces"/);
  assert.match(thornedHouse, /name=\{`thorned-house-exit:\$\{stage\}`\}/);
  assert.match(fireRiver, /<FirePath/);
  assert.match(fireRiver, /<RiverPath/);
  assert.match(fireRiver, /<SurrenderClearing/);
  assert.match(firePath, /name="fire-path"/);
  assert.match(riverPath, /name="river-path"/);
  assert.match(surrenderClearing, /name="surrender-clearing"/);
});

test("forest trees use grounded rooted geometry and open instanced crowns", () => {
  const scene = read("src/components/three/StoryScene.tsx");
  const worker = read("src/workers/forestWorker.ts");

  const geometry = read("src/world/forest/forestGeometry.ts");
  assert.match(read("src/components/three/environment/forestGeometry.ts"), /from "\.\.\/\.\.\/\.\.\/world\/forest\/forestGeometry\.ts"/);
  assert.match(read("src/world/forest/ContinuousForestBed.tsx"), /from "\.\/forestGeometry(?:\.ts)?"/);
  assert.match(scene, /<ContinuousForestBed/);
  assert.match(geometry, /function createForestTrunkGeometry/);
  assert.match(geometry, /const rootAngles = \[/);
  assert.match(read("src/world/forest/ClearingForestFrame.tsx"), /groundYAt/);
  assert.match(geometry, /createForestCrownLibrary/);
  assert.doesNotMatch(geometry, /new THREE\.(?:SphereGeometry|IcosahedronGeometry|PlaneGeometry|CircleGeometry)/);
  assert.match(read("src/components/three/environment/DistantWoodland.tsx"), /<meshStandardMaterial color="#63715e"[^>]*side=\{THREE\.DoubleSide\}/);
  assert.match(read("src/components/three/chapters/ChapterPrimitives.tsx"), /<meshStandardMaterial color=\{tint\} roughness=\{0\.98\} side=\{THREE\.DoubleSide\}/);
  for (const owner of ["src/world/forest/ContinuousForestBed.tsx", "src/world/forest/ClearingForestFrame.tsx"]) assert.doesNotMatch(read(owner), /transparent\s+opacity=.*crown/i);
  assert.match(worker, /edgeWall/);
  assert.match(worker, /trunkWidth/);
});

test("disabled audio stays unmounted and render loops avoid known allocations", () => {
  const scene = read("src/components/three/StoryScene.tsx");
  const engine = read("src/components/three/world/WorldEngineLayer.tsx");
  const ground = read("src/components/three/world/PerfectWorldGround.tsx");
  const lantern = read("src/player/PlayerLantern.tsx");
  const lanternGeometry = read("src/player/playerLanternGeometry.ts");
  const repair = read("scripts/enforce-single-master-lantern.mjs");
  const guidance = read("src/world/guidance/GuidanceController.tsx");

  assert.match(
    scene,
    /audioEnabled && !narrativeAudioSuppressed && mode === "explore"[\s\S]*<NarrativeAudioDirector\b/,
  );
  assert.match(guidance, /const PROXIMITY_UI_UPDATE_INTERVAL = 0\.2;/);
  assert.match(guidance, /const PLAYER_SPATIAL_CELL_SIZE = 6;/);
  assert.match(
    guidance,
    /now - lastUpdateTimeRef\.current >= PROXIMITY_UI_UPDATE_INTERVAL/,
  );
  assert.match(
    guidance,
    /spatialSignature !== lastSpatialSignatureRef\.current/,
  );
  assert.doesNotMatch(scene, /group\.scale\.lerp\(new THREE\.Vector3/);
  assert.doesNotMatch(engine, /\.lerp\(new THREE\.(?:Vector3|Color)/);
  assert.doesNotMatch(ground, /\.lerp\(new THREE\.(?:Vector3|Color)/);
  assert.match(lantern, /const director = useMemo\(/);
  assert.match(lanternGeometry, /housingBuilder: \(\) => THREE\.BufferGeometry = createLanternHousingGeometry/);
  assert.match(lanternGeometry, /const metal = housingBuilder\(\)/);
  assert.match(lantern, /useMemo\(geometryFactory, \[geometryFactory\]\)/);
  assert.match(lantern, /geometryFactory = createReviewedPlayerLanternGeometries/);
  assert.match(read("src/components/three/environmentArt/heroGeometry.ts"), /mergeArtGeometries\(parts\)/);
  assert.match(lantern, /<pointLight[\s\S]*castShadow=\{false\}/);
  assert.doesNotMatch(lantern, /visible=\{false\}/);
  assert.doesNotMatch(
    lantern,
    /useFrame\([\s\S]*?const director = resolveLanternDirector/,
  );
  assert.match(repair, /migrateInstancedRigidBodySensors/);
  assert.doesNotMatch(repair, /Rapier instanced sensor disabled/);
});

test("live HUD updates do not continuously remount or reconcile the 4D canvas", () => {
  const app = read("src/App.tsx");
  const canvas = read("src/components/three/WorldCanvas.tsx");
  const scene = read("src/components/three/StoryScene.tsx");

  assert.doesNotMatch(
    app,
    /useJourneyStore\(\(state\) => state\.playerPosition\)/,
  );
  assert.match(
    app,
    /const initialPlayerPosition = useMemo\([\s\S]*useJourneyStore\.getState\(\)/,
  );
  assert.match(app, /onPortalSelect=\{handlePortalSelect\}/);
  assert.match(app, /onMapSelectEntry=\{handleMapSelectEntry\}/);
  assert.match(canvas, /export default memo\(WorldCanvas\);/);
  assert.match(canvas, /className="slipper-world-canvas"/);
  assert.match(scene, /const STORY_PREVIEW_CHARACTER_LIMIT = 220;/);
  const camera = read("src/player/CameraController.tsx");
  assert.match(camera, /function usePointerLockLookInput/);
  assert.match(scene, /<CameraController\b/);
  assert.match(
    camera,
    /"pointerLockElement" in document[\s\S]*navigator\.webdriver !== true[\s\S]*typeof document\.documentElement\.requestPointerLock === "function"/,
  );
});

test("terrain rendering, grounding, and collision share one explicit surface", () => {
  const scene = read("src/components/three/StoryScene.tsx");
  const worker = read("src/workers/forestWorker.ts");
  const layout = read("src/lib/worldLayout.ts");
  const ground = read("src/components/three/world/PerfectWorldGround.tsx");

  assert.match(read("src/world/terrain/terrainSampler.ts"), /createTerrainSurfaceSampler/);
  assert.match(scene, /from "\.\.\/\.\.\/world\/terrain\/terrainSampler\.ts"/);
  assert.match(read("src/world/terrain/HillyForestGround.tsx"), /<TrimeshCollider[\s\S]*terrainColliderSurface\.positions/);
  assert.match(read("src/world/forest/ContinuousForestBed.tsx"), /<HillyForestGround/);
  assert.match(read("src/world/terrain/HillyForestGround.tsx"), /<RigidBody type="fixed" colliders=\{false\}>/);
  assert.doesNotMatch(scene, /colliders="trimesh"/);
  assert.doesNotMatch(read("src/world/terrain/HillyForestGround.tsx"), /colliders="trimesh"/);
  assert.doesNotMatch(scene, /crownRampSegments|buildCrownRampSegments/);
  assert.match(worker, /createTerrainSurfaceSampler/);
  assert.match(worker, /createTerrainPointSampler,[\s\S]*from "\.\.\/lib\/terrainModel\.ts"/);
  assert.match(worker, /const samplePoint = createTerrainPointSampler\(config\)/);
  assert.match(worker, /samplePoint\(x, z, point\)/);
  assert.match(layout, /createTerrainSurfaceSampler/);
  assert.doesNotMatch(ground, /WorldGroundShader|shaderMaterial|planeGeometry/);
  assert.match(ground, /positions\[\(row \+ 0\) \* 3 \+ 2\] = t - 0\.5/);
});

test("Heart, Womb, and Crowned Return stage saved choices as authored world objects", () => {
  const climbs = read("src/components/three/chapters/ThreeClimbsChapter.tsx");
  const crowned = read("src/components/three/chapters/CrownedReturnChapter.tsx");

  for (const marker of [
    "heart-three-physical-memories",
    "heart-memory-tenderness-rose",
    "heart-memory-beauty-swan-feather",
    "heart-memory-selfhood-blue-moon-reflection",
    "womb-protected-creation-space",
    "womb-three-approachable-futures",
    "womb-future-rest",
    "womb-future-home",
    "womb-future-voice",
  ]) {
    assert.match(climbs, new RegExp(`name="${marker}"`));
  }
  for (const symbolicObjectId of [
    "memory.heart.tenderness",
    "memory.heart.beauty",
    "memory.heart.selfhood",
    "creation.future.rest",
    "creation.future.home",
    "creation.future.voice",
  ]) {
    assert.match(climbs, new RegExp(`inventory\\.symbolicObjects\\.includes\\("${symbolicObjectId.replaceAll(".", "\\.")}\\"\\)`));
  }
  assert.match(climbs, /HEART_MEMORY_WORLD_TARGETS/);
  assert.match(climbs, /WOMB_FUTURE_WORLD_TARGETS/);
  assert.match(climbs, /interaction: "approach-and-press"/);
  assert.match(climbs, /worldChoiceId: "heart\.selfhood"/);
  assert.match(climbs, /worldChoiceId: "future\.voice"/);

  for (const marker of [
    "kylie-self-owned-inner-home",
    "home-living-water-fountain",
    "home-books-reading-writing",
    "home-writing-desk",
    "home-velvet-reading-nook",
    "home-candles-and-roses",
    "home-protected-child-space",
    "home-open-light-windows",
    "home-high-protective-walls",
    "home-intentionally-unused-space",
  ]) {
    assert.match(crowned, new RegExp(`name="${marker}"`));
  }
  assert.doesNotMatch(crowned, /home-reflection-gallery|<ReflectivePanel/, "The noninteractive mirror gallery stays removed; the canonical sovereign mirror is checked below.");
  assert.match(crowned, /name="crowned-gate-recognises-accumulated-state"/);
  assert.match(crowned, /open=\{gateRecognisesJourney\}/);
  assert.match(crowned, /requiredJourneyState: "keys-heart-womb-lantern-surrender"/);
  assert.match(crowned, /reservedFor: "what-may-come"/);
  const mirrorObject = read("src/components/three/storyEvents/StoryObjectModel.tsx");
  assert.match(mirrorObject, /name="crown-visible-only-in-sovereign-mirror"/);
  assert.match(mirrorObject, /reflectionOnly: true, physicalCrown: false/);
  assert.match(mirrorObject, /viewer.z < -.1/);
  assert.match(mirrorObject, /state === "recognised"/);
});

test("the epilogue composes the travelled world from the current journey history", () => {
  const epilogue = read("src/components/three/chapters/LanternEpilogueChapter.tsx");
  const tableau = read("src/components/three/chapters/IntegratedFinalTableau.tsx");
  const scene = read("src/components/three/StoryScene.tsx");

  assert.match(epilogue, /<IntegratedFinalTableau/);
  assert.doesNotMatch(epilogue, /<ConstellationField/);
  assert.match(tableau, /useJourneyStore\(\(state\) => state\.witnessedEntryIds\)/);
  assert.match(tableau, /model\.routeEntryIds[\s\S]*\.map\(memoryStarPosition\)/);
  assert.match(tableau, /source: "journey-store-history"/);
  assert.match(tableau, /name="witnessed-memory-constellation"/);
  assert.match(tableau, /name="constellation-actual-walked-route"/);
  assert.match(tableau, /name="placed-lit-lantern-continuity"/);
  assert.match(tableau, /userData=\{\{ placementId \}\}/);
  assert.match(tableau, /<LanternProp[\s\S]*position=\{\[1\.18, FINAL_GROUND_Y, -6\.32\]\}/);
  assert.match(tableau, /<LanternProp[\s\S]*light=\{false\}/);
  assert.match(tableau, /name="final-woods-remain"/);
  assert.match(tableau, /eventDriven && !formationReady \? <ReverseMemoryLights/);
  assert.match(tableau, /name="constellation-formation-reveal"/);
  assert.match(tableau, /const formationReady = \(lanternPlaced && \(!eventDriven \|\| reverseComplete\)\) \|\| storyCompleted/);
  assert.match(tableau, /formationReady=\{formationReady\}/);
  assert.match(tableau, /formationMode: reducedMotion \? "immediate" : "gradual"/);
  assert.match(tableau, /beginsAfter: "lantern-placement-or-story-completion"/);
  assert.match(tableau, /onFormationComplete=\{onFinalConstellationFormationComplete\}/);
  // Integration stays in Crowned Return; only actual visited places become sky.
  assert.doesNotMatch(tableau, /MoonDisc|RestingWolf|SwanOnWater|QuietSeer|EmberFire|DistantThornedHouse|RememberedForkLandmark|RememberedThreeClimbsLandmark|ProtectedChildNest|KeyProp|SelfOwnedHome|ReturnedSelf|FinalCrackedLookBackMirror/);
  assert.doesNotMatch(tableau, /ConstellationResonanceLights|ReleasedWordConstellation|ConstellationProtectedNest|ringGeometry|AdditiveBlending/);
  assert.doesNotMatch(tableau, /dispatchStoryEvent|setState|localStorage|RigidBody|Collider/);
  for (const buffer of ["historyGeometry", "keystoneGeometry", "threadGeometry"]) {
    assert.ok(tableau.includes(`${buffer}.dispose()`), `${buffer} must be released when route data changes`);
  }
  assert.match(read("src/world/worldPresentationPolicy.ts"), /function isIntegratedFinaleEntry/);
  assert.match(read("src/world/worldPresentationPolicy.ts"), /function usesAuthoredCausalComposition/);
  assert.match(read("src/world/worldPresentationPolicy.ts"), /function hasAuthoredChapterMoon/);
  assert.match(read("src/world/atmosphere/LegacySceneAtmosphere.tsx"), /suppressAmbientMoon \? null : \(/);
  assert.match(scene, /mode === "explore" && !suppressLegacyActiveLandmark \? <StoryText/);
});

test("the Thorned House mounts bounded fixed collision architecture from its visible layout", () => {
  const house = read("src/components/three/chapters/ThornedHouseChapter.tsx");

  assert.match(house, /import \{ CuboidCollider, RigidBody \} from "@react-three\/rapier"/);
  assert.match(
    house,
    /<RigidBody[\s\S]*name="thorned-house-fixed-collision"[\s\S]*type="fixed"[\s\S]*colliders=\{false\}/,
  );
  assert.match(
    house,
    /colliderSpecs\.map\(\(spec\) => \([\s\S]*<CuboidCollider[\s\S]*args=\{spec\.args\}[\s\S]*position=\{spec\.position\}[\s\S]*rotation=\{spec\.rotation\}/,
  );
  assert.match(house, /journey\.worldFlags\["thorn-door\.open"\] === true/);
  assert.match(house, /journey\.worldFlags\["path\.house-exit-open"\] === true/);
  assert.match(house, /const exitUnlocked = thornDoorOpen \|\| houseExitOpen \|\| exitCrossed/);
  assert.match(house, /isLeaving && exitUnlocked[\s\S]*\? "open"/);
  assert.match(house, /<ThornedHouseCollisionArchitecture[\s\S]*exitStage=\{exitStage\}/);
});

test("the Thorned House collision layout opens its exit and preserves a walkable centre route", () => {
  const shellSize = [12.8, 5.05, 11.4];
  const closed = resolveThornedHouseColliderLayout({
    stage: "leaving",
    exitStage: "glimpsed",
    detail: 3,
    reducedEffects: false,
    shellSize,
    cleared: true,
    refilled: true,
    reorganisationReleased: true,
  });
  const open = resolveThornedHouseColliderLayout({
    stage: "leaving",
    exitStage: "open",
    detail: 3,
    reducedEffects: false,
    shellSize,
    cleared: true,
    refilled: true,
    reorganisationReleased: true,
  });

  assert.ok(closed.some((spec) => spec.role === "exit-door"));
  assert.ok(!open.some((spec) => spec.role === "exit-door"));
  assert.ok(open.some((spec) => spec.role === "shell-wall"));
  assert.ok(open.some((spec) => spec.role === "room-wall"));
  assert.ok(open.some((spec) => spec.role === "corridor-frame"));
  assert.ok(open.some((spec) => spec.role === "memory-surface"));
  assert.ok(open.some((spec) => spec.role === "memory-clutter"));

  const routeBlockers = open.filter((spec) => {
    const reachesPlayerHeight = spec.position[1] + spec.args[1] > 0.25;
    const overlapsRouteDepth =
      spec.position[2] + spec.args[2] >= -3 &&
      spec.position[2] - spec.args[2] <= 8.45;
    const conservativeHalfWidth = Math.hypot(spec.args[0], spec.args[2]);
    const intrudesIntoCentre =
      Math.abs(spec.position[0]) - conservativeHalfWidth <
      THORNED_HOUSE_SAFE_ROUTE_HALF_WIDTH;
    return reachesPlayerHeight && overlapsRouteDepth && intrudesIntoCentre;
  });
  assert.deepEqual(
    routeBlockers.map((spec) => spec.id),
    [],
    "the opened, reorganised house must leave a capsule-safe route from spawn through the exit",
  );
});

test("the Thorned House collider budget holds across scene and saved-state variants", () => {
  const shellSizes = {
    garden: [13.5, 5.45, 11],
    bedroom: [12.2, 4.75, 11.8],
    leaving: [12.8, 5.05, 11.4],
  };

  for (const stage of ["garden", "bedroom", "leaving"]) {
    for (const exitStage of ["sealed", "glimpsed", "open"]) {
      for (const reducedEffects of [false, true]) {
        for (const detail of [0, 1, 2, 3, 6]) {
          for (const [cleared, refilled] of [[false, false], [true, false], [true, true]]) {
            const layout = resolveThornedHouseColliderLayout({
              stage,
              exitStage,
              detail,
              reducedEffects,
              shellSize: shellSizes[stage],
              cleared,
              refilled,
              reorganisationReleased: stage === "leaving",
            });
            assert.ok(layout.length <= THORNED_HOUSE_COLLIDER_BUDGET);
            assert.equal(new Set(layout.map((spec) => spec.id)).size, layout.length);
            for (const spec of layout) {
              assert.ok(spec.args.every((extent) => Number.isFinite(extent) && extent > 0));
              assert.ok(spec.position.every(Number.isFinite));
            }
          }
        }
      }
    }
  }
});
