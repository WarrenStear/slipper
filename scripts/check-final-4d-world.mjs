import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();

const requiredFiles = [
  "src/components/three/StoryScene.tsx",
  "src/components/three/environment/forestGeometry.ts",
  "src/components/three/environment/ProceduralDome.tsx",
  "src/components/three/WorldCanvas.tsx",
  "src/components/three/StorySceneWithMasterLantern.tsx",
  "src/components/three/world/PerfectWorldGround.tsx",
  "src/components/three/world/WorldEngineLayer.tsx",
  "src/workers/forestWorker.ts",
  "src/lib/terrainModel.ts",
  "src/lib/worldLayout.ts",
  "src/lib/worldTopology.ts",
  "src/lib/storyJourneyState.ts",
  "src/lib/lanternNarrative.ts",
  "src/lib/narrativeJourneyState.ts",
  "src/data/journeyBlueprint.ts",
  "src/components/three/journey/JourneyDirector.tsx",
  "src/components/three/journey/JourneyWorldComposition.tsx",
  "src/components/three/journey/EnvironmentalThreshold.tsx",
  "src/components/three/rituals/RitualInteraction.tsx",
  "src/components/three/worldMemory/WorldMemoryDirector.tsx",
  "src/components/three/chapterDirector.ts",
  "src/components/three/renderQuality.ts",
  "src/components/three/worldVisualState.ts",
  "public/textures/forest/ground-albedo-v3.webp",
  "public/textures/forest/memory-bloom-v1.png",
  "public/textures/environment/first-wood-panorama-v3.webp",
  "public/textures/environment/forest-sky-horizon-v1.webp",
  "docs/FINAL_4D_WORLD.md",
];

function read(relativePath) {
  return fs.readFileSync(path.join(ROOT, relativePath), "utf8");
}

function profileBlock(source, quality, nextQuality) {
  const end = nextQuality ? `\n  ${nextQuality}: {` : "\n};";
  return source.split(`\n  ${quality}: {`)[1]?.split(end)[0] ?? "";
}

const missing = requiredFiles.filter((filePath) => !fs.existsSync(path.join(ROOT, filePath)));
if (missing.length > 0) {
  console.error(`[final:world] Missing required world files: ${missing.join(", ")}`);
  process.exit(1);
}

const storyScene = read("src/components/three/StoryScene.tsx");
const forestGeometry = read("src/components/three/environment/forestGeometry.ts");
const proceduralDome = read("src/components/three/environment/ProceduralDome.tsx");
const worldCanvas = read("src/components/three/WorldCanvas.tsx");
const worldEngine = read("src/components/three/world/WorldEngineLayer.tsx");
const renderQuality = read("src/components/three/renderQuality.ts");
const terrainModel = read("src/lib/terrainModel.ts");
const terrainWorker = read("src/workers/forestWorker.ts");
const worldLayout = read("src/lib/worldLayout.ts");
const perfectGround = read("src/components/three/world/PerfectWorldGround.tsx");
const journeyBlueprint = read("src/data/journeyBlueprint.ts");
const journeyDirector = read("src/components/three/journey/JourneyDirector.tsx");
const journeyStore = read("src/stores/useJourneyStore.ts");
const worldMemory = read("src/components/three/worldMemory/WorldMemoryDirector.tsx");
const wrapper = read("src/components/three/StorySceneWithMasterLantern.tsx");
const lanternNarrative = read("src/lib/lanternNarrative.ts");
const worldVisualState = read("src/components/three/worldVisualState.ts");
const mediumProfile = profileBlock(renderQuality, "medium", "high");
const cinematicProfile = profileBlock(renderQuality, "cinematic");
const hardFailures = [];

if (storyScene.includes("terrainGeometry")) hardFailures.push("terrainGeometry leaked into StoryScene");
if (!worldLayout.includes("export function curvedPathPointAt") || !worldLayout.includes("segment: MazePathSegment") || !worldLayout.includes("return out;")) hardFailures.push("worldLayout curvedPathPointAt structure is invalid");
if (!terrainModel.includes("createTerrainSurfaceSampler")) hardFailures.push("canonical triangle terrain sampler is missing");
if (!terrainWorker.includes("createTerrainSurfaceSampler")) hardFailures.push("forest grounding is not using the canonical triangle terrain sampler");
if (!storyScene.includes("<TrimeshCollider") || !storyScene.includes("terrainColliderSurface.positions")) hardFailures.push("explicit terrain collider is missing");
if (storyScene.includes('colliders="trimesh"')) hardFailures.push("automatic terrain trimesh can snapshot undeformed geometry");
if (storyScene.includes("crownRampSegments") || storyScene.includes("buildCrownRampSegments")) hardFailures.push("duplicate crowned ramp surfaces are mounted");
if (perfectGround.includes("WorldGroundShader") || perfectGround.includes("<shaderMaterial") || perfectGround.includes("planeGeometry")) hardFailures.push("a second displaced ground surface is mounted");
if (!/<Canvas\s+[\s\S]*?shadows=/.test(worldCanvas)) hardFailures.push("canvas shadow policy is missing");
if (!worldLayout.includes("buildPhysicalStoryLinks")) hardFailures.push("authored physical maze topology is not mounted");
if (!storyScene.includes("<EnvironmentalThreshold") || /<WorldGateway\b|<Portals\b|<PortalPathBeams\b/.test(storyScene)) hardFailures.push("generic journey portals were not replaced by environmental thresholds");
if (!storyScene.includes("createForestTrunkGeometry") || !forestGeometry.includes("const rootAngles = [") || !storyScene.includes('from "./environment/forestGeometry"')) hardFailures.push("rooted forest trunk geometry is missing");
if (terrainWorker.includes("tooCloseToPlayer") || terrainWorker.includes("playerPosition")) hardFailures.push("forest worker still cuts a player-relative tree hole");

if (
  !journeyBlueprint.includes("const COMPATIBILITY_PHASES") ||
  !journeyBlueprint.includes("COMPATIBILITY_PHASES.map") ||
  !journeyBlueprint.includes("journeyChapters.filter")
) hardFailures.push("narrative-derived compatibility phases are missing");
if (!journeyDirector.includes("completionRequirements.every") || !journeyDirector.includes("applyJourneyOutcome")) hardFailures.push("ritual-to-transformation journey progression is incomplete");
if (!journeyStore.includes("JOURNEY_ENTRY_PROGRESS") || !journeyStore.includes("JOURNEY_RITUAL_IDS")) hardFailures.push("journey persistence is not governed by the authored blueprint");
if (!worldMemory.includes('name="persistent-world-memory"')) hardFailures.push("persistent landmark transformation layer is missing");
if (
  !wrapper.includes("showCarriedLantern") ||
  !wrapper.includes("deriveLanternNarrative") ||
  !wrapper.includes('lanternNarrative.presence === "carried"') ||
  !lanternNarrative.includes("lantern.placed-and-lit")
) hardFailures.push("carried lantern lifecycle is not state-driven");
if (!storyScene.includes("<JourneyWorldComposition")) hardFailures.push("authored chapter compositions are not mounted");

if (worldEngine.includes("<WorldAtmosphere") || worldEngine.includes("<WorldLightingRig")) hardFailures.push("duplicate atmosphere or lighting rigs are mounted");
if (!storyScene.includes("function CelestialMoon") || !storyScene.includes("<CelestialMoon")) hardFailures.push("visible moon layer is missing");
if (!storyScene.includes("MOON_ALBEDO_PATH")) hardFailures.push("realistic moon albedo is missing");
if (!storyScene.includes("FOREST_GROUND_ALBEDO_PATH") || storyScene.includes("applyNarrativeTextureBlend")) hardFailures.push("production ground material is missing or vertex tint is double-applied");
if (!storyScene.includes("FIRST_WOOD_PANORAMA_PATH") || !storyScene.includes("<AtmosphericForestPanorama")) hardFailures.push("atmospheric forest panorama is missing");
if (!storyScene.includes("FIRST_WOOD_DEPTH_PLATE_PATH") || !storyScene.includes("<CinematicForestDepthPlate")) hardFailures.push("cinematic forest depth plate is missing");
if (!storyScene.includes("first-wood-panorama-v3.webp") || !storyScene.includes("forest-sky-horizon-v1.webp") || !proceduralDome.includes("skyFbm") || !storyScene.includes('from "./environment/ProceduralDome"') || !storyScene.includes("<ProceduralDome")) hardFailures.push("layered procedural sky or seam-safe horizon assets are missing");
if (!storyScene.includes("activeVisualState.showStars && qualityProfile.starMultiplier > 0")) hardFailures.push("reduced-effects star field is still mounted");
if (!storyScene.includes("function DistantForestSilhouetteRing") || !storyScene.includes("<DistantForestSilhouetteRing")) hardFailures.push("single-pass distant forest skyline is missing");
if (!storyScene.includes('showDepthPlate={visualState.biome === "firstWood" && qualityProfile.quality !== "low"}')) hardFailures.push("cinematic horizon plate is not First-Wood-only or low-tier gated");
if (!proceduralDome.includes('qualityProfile.quality === "medium"') || !proceduralDome.includes("cloudDetail")) hardFailures.push("procedural cloud cost is not quality-tiered");
if (worldVisualState.includes("fireBias > 0.54") || !worldVisualState.includes("baseMoonColor")) hardFailures.push("Fire and River moon colour still hard-snaps");
if (!storyScene.includes("MEMORY_BLOOM_TEXTURE_PATH") || !storyScene.includes("<MemoryBloomLandmark")) hardFailures.push("memory-bloom path landmark is missing");
if (!storyScene.includes("<LivingPathMist")) hardFailures.push("living path mist is missing");
if (!storyScene.includes("<LivingPathRibbon")) hardFailures.push("terrain-conforming guidance path is missing");
if (!storyScene.includes("createOrganicCrownGeometry") || !forestGeometry.includes("function createOrganicCrownGeometry") || !forestGeometry.includes("mergeGeometries")) hardFailures.push("single-pass organic crown geometry is missing");
if (/crownAccentRef|lowerCrownRef|upperCrownRef|sideCrownRef/.test(storyScene)) hardFailures.push("stacked duplicate canopy draw calls are mounted");
if (!/decorationsPerCell: [1-9]/.test(mediumProfile) || !/groundDetailMultiplier: 0\.[1-9]/.test(mediumProfile)) hardFailures.push("medium quality does not restore budgeted world detail");
if (!/enableMoonShadows: true/.test(cinematicProfile) || !/shadowMapSize: 1024/.test(cinematicProfile)) hardFailures.push("cinematic shadow budget is incomplete");
if (!/export function resolveEnvironmentalEffectsProfile[\s\S]*?particleMultiplier: 0,/.test(renderQuality)) hardFailures.push("reduced-effects mode does not disable animated particles");
if (!/resolveEnvironmentalEffectsProfile[\s\S]*?groundDetailMultiplier: 0,/.test(renderQuality)) hardFailures.push("reduced-effects mode does not disable generated ground detail");

const textureBytes = fs.statSync(path.join(ROOT, "public/textures/forest/ground-albedo-v3.webp")).size;
if (textureBytes > 400_000) hardFailures.push(`forest ground texture exceeds its 400 KB budget (${textureBytes} bytes)`);
const panoramaBytes = fs.statSync(path.join(ROOT, "public/textures/environment/first-wood-panorama-v3.webp")).size;
if (panoramaBytes > 250_000) hardFailures.push(`forest panorama exceeds its 250 KB budget (${panoramaBytes} bytes)`);
const depthPlateBytes = fs.statSync(path.join(ROOT, "public/textures/environment/forest-sky-horizon-v1.webp")).size;
if (depthPlateBytes > 140_000) hardFailures.push(`forest sky horizon exceeds its 140 KB budget (${depthPlateBytes} bytes)`);
const memoryBloomBytes = fs.statSync(path.join(ROOT, "public/textures/forest/memory-bloom-v1.png")).size;
if (memoryBloomBytes > 320_000) hardFailures.push(`memory bloom exceeds its 320 KB budget (${memoryBloomBytes} bytes)`);
const moonAlbedoBytes = fs.statSync(path.join(ROOT, "public/textures/environment/moon-albedo-v1.png")).size;
if (moonAlbedoBytes > 240_000) hardFailures.push(`moon albedo exceeds its 240 KB budget (${moonAlbedoBytes} bytes)`);

if (hardFailures.length > 0) {
  console.error(`[final:world] Environment audit failed: ${hardFailures.join("; ")}`);
  process.exit(1);
}

console.log(`[final:world] Visual and performance audit passed (ground ${Math.round(textureBytes / 1024)} KB, panorama ${Math.round(panoramaBytes / 1024)} KB, depth plate ${Math.round(depthPlateBytes / 1024)} KB, bloom ${Math.round(memoryBloomBytes / 1024)} KB, moon ${Math.round(moonAlbedoBytes / 1024)} KB).`);
