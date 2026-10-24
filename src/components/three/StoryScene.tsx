import { Float, Html } from "@react-three/drei";
import { useFrame, useThree } from "@react-three/fiber";
import { Component, memo, Suspense, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type ErrorInfo, type ReactNode } from "react";
import * as THREE from "three";
import { getCurrentCinematicProfile } from "../../cinematics/emotionalCinematography";
import { openingEnclosed } from "../../cinematics/openingPresentation";
import { cameraPresentationActive } from "../../cinematics/shotComposition";
import { getJourneyChapterForEntry, getJourneyEntryContext, getJourneySceneForEntry } from "../../data/journeyNarrative";
import { getJourneyEntryWorldPosition, getJourneySceneLayout } from "../../data/journeyWorldLayout";
import type { EulerTuple, Slipper3DEntry, Slipper3DVisual, Vector3Tuple } from "../../data/slipper3dTypes";
import { useStoryRuntimeHost } from "../../experience/StoryRuntimeContext";
import { useCompressedGLTF } from "../../lib/assets/gltfLoaders";
import { cloneNpcPresentation, isPlaceholderNpcAsset } from "../../lib/assets/npcAssetPolicy";
import { getSceneManifestForEntry, resolveSceneManifestArrival } from "../../narrative/StoryManifest";
import { MemoryShrine } from "../../photos/PhotoMemory";
import { CameraController } from "../../player/CameraController";
import { PlayerController } from "../../player/PlayerController";
import { PLAYER_CAMERA_OFFSET_Y, PLAYER_EYE_HEIGHT } from "../../player/cameraModel";
import { NODE_ACTIVATION_RADIUS_SQ } from "../../player/interactionProximity";
import { PLAYER_FOOT_OFFSET, PLAYER_GROUND_CLEARANCE, PLAYER_SPEED } from "../../player/playerMovement";
import type { PlayerControls as StorySceneControls, ExperienceMode as StorySceneMode } from "../../player/playerTypes";
import { createPlayerPose } from "../../player/playerTypes";
import { useJourneyStore } from "../../stores/useJourneyStore";
import { useSettingsStore } from "../../stores/useSettingsStore";
import { useWorldStore } from "../../stores/useWorldStore";
import type { QuietGuidanceActivity } from "../../ui/quietGuidancePresentation";
import { AtmosphericForestPanorama } from "../../world/atmosphere/AtmosphericForestPanorama.tsx";
import { BiomeWeatherField } from "../../world/atmosphere/BiomeWeatherField.tsx";
import { DistantForestSilhouetteRing } from "../../world/atmosphere/DistantForestSilhouetteRing.tsx";
import { EnvironmentSphere } from "../../world/atmosphere/EnvironmentSphere.tsx";
import { LegacySceneAtmosphere } from "../../world/atmosphere/LegacySceneAtmosphere.tsx";
import { LivingPathMist } from "../../world/atmosphere/LivingPathMist.tsx";
import { NarrativeWeather } from "../../world/atmosphere/NarrativeWeather.tsx";
import { PersistentEnvironmentalBreadcrumbs, PlayerBreadcrumbRecorder } from "../../world/ecology/EnvironmentalBreadcrumbs";
import { NarrativeGroundDetailField, NarrativeGroundTrails } from "../../world/ecology/NarrativeGroundDetails";
import { SemanticObjectPathing } from "../../world/ecology/SemanticObjectPathing";
import { WillowRefuge } from "../../world/ecology/WillowRefuge";
import { ContinuousForestBed } from "../../world/forest/ContinuousForestBed.tsx";
import { ClearingLightHalo } from "../../world/guidance/ClearingLightHalo.tsx";
import { GuidanceController } from "../../world/guidance/GuidanceController";
import { LivingPathRibbon } from "../../world/guidance/LivingPathRibbon.tsx";
import { MemoryBloomLandmark } from "../../world/guidance/MemoryBloomLandmark.tsx";
import { MoonlitPathUnderstory } from "../../world/guidance/MoonlitPathUnderstory.tsx";
import { PathLightMotes } from "../../world/guidance/PathLightMotes.tsx";
import type { PlayerSpatialWindow, SceneProximityState } from "../../world/guidance/guidanceTypes";
import { guidedPathSegment } from "../../world/guidance/routeGeometry.ts";
import { NarrativeLightingRig } from "../../world/lighting/NarrativeLightingRig.tsx";
import { terrainElevationAtPoint } from "../../world/terrain/terrainSampler.ts";
import { CHAPTER_BLUE_MOON_ARCHIVE, CHAPTER_MIRROR_CLEARING, CHAPTER_THORNED_HOUSE, DEFAULT_ENVIRONMENT_RADIUS, TERRAIN_BASE_Y } from "../../world/terrain/worldConstants.ts";
import { buildMazePathSegments, curvedPathPointAt, segmentProjectionT, type MazePathSegment } from "../../world/terrain/worldPaths.ts";
import { buildSpatialStoryNodes, chapterBiome, entryWorldPosition, isChapter, type SpatialStoryNode } from "../../world/terrain/worldPlacement.ts";
import { clamp01, hashString, seededUnit } from "../../world/worldMath.ts";
import { isIntegratedFinaleEntry, usesAuthoredCausalComposition } from "../../world/worldPresentationPolicy.ts";
import { countPatternMatches, dominantSemanticTheme, entrySemanticSignal } from "../../world/worldSemantics.ts";
import { type NarrativeWorldState } from "../../world/worldTypes.ts";
import { CinematicFrameOverlay } from "./artDirection/LegacyFrameOverlay";
import { SceneLookDirector } from "./artDirection/SceneLookDirector";
import NarrativeAudioDirector from "./audio/NarrativeAudioDirector";
import { createAudioApproachTarget } from "./audio/audioApproach";
import { resolveChapterDirector } from "./chapterDirector";
import { DistantWoodland } from "./environment/DistantWoodland";
import { ProceduralDome } from "./environment/ProceduralDome";
import { AuthoredNpcSilhouette } from "./environmentArt/AuthoredNpc";
import EnvironmentalThreshold from "./journey/EnvironmentalThreshold";
import JourneyWorldComposition from "./journey/JourneyWorldComposition";
import { resolveNarrativeRenderScale, shouldShowDebugOverlay, type RenderQualityProfile } from "./renderQuality";
import { SpatialProseDirector } from "./storyText/SpatialProseDirector";
import WorldMemoryDirector, { type WorldMemoryState } from "./worldMemory/WorldMemoryDirector";
import { resolveWorldVisualState, type WorldVisualState } from "./worldVisualState";
export type { NarrativeWorldState } from "../../world/worldTypes";

import "./StoryScene.css";

// Stable public import paths for consumers during the staged migration.

export type { PlayerControls as StorySceneControls, ExperienceMode as StorySceneMode } from "../../player/playerTypes";
export type { SceneProximityState } from "../../world/guidance/guidanceTypes";

export type StorySceneProps = {
  /** Global presentation layers share the canonical director and its clocks. */
  children?: ReactNode;
  /** The production wrapper projects map/opening eligibility for canonical air. */
  ambientParticlesEnabled?: boolean;
  entryId: string;
  entries: Slipper3DEntry[];
  visuals: Slipper3DVisual[];
  qualityProfile: RenderQualityProfile;
  reducedEffects?: boolean;
  controls?: StorySceneControls;
  mode?: StorySceneMode;
  fallbackEnvironmentSrc?: string;
  visitedEntryIds?: string[];
  narrativeWorldState?: NarrativeWorldState;
  storyWorldMemory?: WorldMemoryState;
  lockedEntryIds?: string[];
  navigationTargetEntryId?: string | null;
  quietGuidanceActivity?: QuietGuidanceActivity;
  initialPlayerPosition?: Vector3Tuple | null;
  narrativeAudioSuppressed?: boolean;
  onFinalConstellationFormationComplete?: () => void;
  onPortalSelect?: (targetEntryId: string) => void;
  onPlayerProximityChange?: (state: SceneProximityState) => void;
};

const DEFAULT_CAMERA_POSITION: Vector3Tuple = [0, 0, 0.1];
const DEFAULT_TEXT_POSITION: Vector3Tuple = [0, 0, -3];
const DEFAULT_TEXT_ROTATION: EulerTuple = [0, 0, 0];

const DEFAULT_FOV = 65;

const STORY_NODE_DETAIL_RADIUS = 54;
const STORY_NODE_VISITED_RADIUS = 66;
const GATEWAY_VISIBILITY_RADIUS = 58;
const GATEWAY_VISITED_RADIUS = 72;
const ZERO_STATE: NarrativeWorldState = {
  visitedCount: 1,
  totalCount: 1,
  traceCount: 1,
  fireCount: 0,
  waterCount: 0,
  memoryCount: 0,
  thresholdCount: 0,
  crownCount: 0,
  fireWaterBalance: 0,
  explorationDepth: 0,
  memoryPressure: 0,
  symbolicWeight: 0.5,
};

const NPC_MODEL_PATHS = {
  wolf: "/models/wolf.glb",
  phantom: "/models/phantom.glb",
  swan: "/models/swan.glb",
} as const;

// NPCs load through the configured model loader at their encounter boundary.

type SymbolicLayerMode = "current" | "echo";

function applyGroupOpacity(group: THREE.Group, opacityScale: number) {
  group.traverse((object) => {
    if (!(object instanceof THREE.Mesh) && !(object instanceof THREE.Line) && !(object instanceof THREE.Points)) return;
    const materials = Array.isArray(object.material) ? object.material : [object.material];

    for (const material of materials) {
      if (!material) continue;
      const materialWithOpacity = material as THREE.Material & { opacity?: number };
      const userData = materialWithOpacity.userData as { slipperBaseOpacity?: number };
      if (typeof userData.slipperBaseOpacity !== "number") {
        userData.slipperBaseOpacity = typeof materialWithOpacity.opacity === "number" ? materialWithOpacity.opacity : 1;
      }
      materialWithOpacity.transparent = true;
      materialWithOpacity.opacity = userData.slipperBaseOpacity * opacityScale;
    }
  });
}

function WaterMirrorShrine({ entry, visitedCount }: { entry: Slipper3DEntry; visitedCount: number }) {
  const color = entry.engine3d.environmentGradient?.[2] ?? "#9fbfc5";
  const evolution = clamp01(visitedCount / 18);
  const radius = 2.1 + evolution * 0.78;
  return (
    <group position={[0, -0.72, -5.9]}>
      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[radius, 128]} />
        <meshStandardMaterial color={color} emissive="#183842" emissiveIntensity={0.08 + evolution * 0.12} metalness={0.48} roughness={0.12} transparent opacity={0.34 + evolution * 0.08} side={THREE.DoubleSide} depthWrite={false} />
      </mesh>
      <mesh position={[0, 0.07, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[radius + 0.08, radius + 0.22, 128]} />
        <meshBasicMaterial color="#ffffff" transparent opacity={0.18 + evolution * 0.1} side={THREE.DoubleSide} depthWrite={false} />
      </mesh>
      <mesh position={[0, 0.32 + evolution * 0.18, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[1.05 + evolution * 0.42, 0.012 + evolution * 0.006, 10, 128]} />
        <meshBasicMaterial color={color} transparent opacity={0.28 + evolution * 0.1} depthWrite={false} />
      </mesh>
    </group>
  );
}

function ThresholdDoorShrine({ entry, visitedCount }: { entry: Slipper3DEntry; visitedCount: number }) {
  const color = entry.engine3d.environmentGradient?.[2] ?? "#c8b38a";
  const evolution = clamp01(visitedCount / 16);
  const opening = 0.95 + evolution * 0.42;
  const lean = 0.045 + evolution * 0.13;
  return (
    <group position={[0, 0.22, -5.85]}>
      <mesh position={[-opening, 0, 0]} rotation={[0, evolution * 0.14, -lean]}>
        <boxGeometry args={[0.12, 2.75 + evolution * 0.36, 0.16]} />
        <meshStandardMaterial color="#201b16" emissive={color} emissiveIntensity={0.08 + evolution * 0.08} roughness={0.78} />
      </mesh>
      <mesh position={[opening, 0, 0]} rotation={[0, -evolution * 0.14, lean]}>
        <boxGeometry args={[0.12, 2.75 + evolution * 0.36, 0.16]} />
        <meshStandardMaterial color="#201b16" emissive={color} emissiveIntensity={0.08 + evolution * 0.08} roughness={0.78} />
      </mesh>
      <mesh position={[0, 1.36 + evolution * 0.18, 0]}>
        <boxGeometry args={[2.02 + evolution * 0.74, 0.12, 0.16]} />
        <meshStandardMaterial color="#201b16" emissive={color} emissiveIntensity={0.1 + evolution * 0.1} roughness={0.78} />
      </mesh>
      <mesh position={[0, 0.05, -0.045]}>
        <planeGeometry args={[1.42 + evolution * 0.56, 2.25 + evolution * 0.34]} />
        <meshBasicMaterial color={color} transparent opacity={0.08 + evolution * 0.1} side={THREE.DoubleSide} depthWrite={false} />
      </mesh>
    </group>
  );
}

function ArchiveDiscShrine({ entry, visitedCount }: { entry: Slipper3DEntry; visitedCount: number }) {
  const color = entry.engine3d.environmentGradient?.[2] ?? "#b8c8d8";
  const evolution = clamp01(visitedCount / 20);
  return (
    <group position={[0, 1.05 + evolution * 0.25, -7.25]}>
      <mesh>
        <circleGeometry args={[1.18 + evolution * 0.3, 128]} />
        <meshBasicMaterial color={color} transparent opacity={0.36 + evolution * 0.12} side={THREE.DoubleSide} depthWrite={false} />
      </mesh>
      <mesh rotation={[0, 0, Math.PI * (0.17 + evolution * 0.1)]}>
        <ringGeometry args={[1.42 + evolution * 0.18, 1.48 + evolution * 0.22, 128]} />
        <meshBasicMaterial color="#ffffff" transparent opacity={0.16 + evolution * 0.08} side={THREE.DoubleSide} depthWrite={false} />
      </mesh>
      <mesh rotation={[0, 0, -Math.PI * (0.28 + evolution * 0.08)]}>
        <ringGeometry args={[1.76 + evolution * 0.28, 1.79 + evolution * 0.32, 128]} />
        <meshBasicMaterial color={color} transparent opacity={0.18 + evolution * 0.12} side={THREE.DoubleSide} depthWrite={false} />
      </mesh>
    </group>
  );
}

function ChapterShrine({ entry, visual, narrativeWorldState }: { entry: Slipper3DEntry; visual?: Slipper3DVisual; narrativeWorldState: NarrativeWorldState }) {
  if (isChapter(entry, CHAPTER_MIRROR_CLEARING)) return <WaterMirrorShrine entry={entry} visitedCount={narrativeWorldState.waterCount} />;
  if (isChapter(entry, CHAPTER_THORNED_HOUSE)) return <ThresholdDoorShrine entry={entry} visitedCount={narrativeWorldState.thresholdCount + narrativeWorldState.memoryCount} />;
  if (isChapter(entry, CHAPTER_BLUE_MOON_ARCHIVE)) return <ArchiveDiscShrine entry={entry} visitedCount={narrativeWorldState.memoryCount} />;
  return visual ? <MemoryShrine visual={visual} entry={entry} /> : null;
}

function VisualEnvironment({
  entry,
  visual,
  fallbackEnvironmentSrc,
  narrativeWorldState,
  qualityProfile,
}: {
  entry: Slipper3DEntry;
  visual?: Slipper3DVisual;
  fallbackEnvironmentSrc?: string;
  narrativeWorldState: NarrativeWorldState;
  qualityProfile: RenderQualityProfile;
}) {
  const radius = entry.engine3d.environmentRadius ?? DEFAULT_ENVIRONMENT_RADIUS;
  const src = visual?.src ?? fallbackEnvironmentSrc;
  const isImmersive = visual?.orientation === "landscape" || visual?.environmentKind === "equirectangular";
  const visualState = useMemo(
    () => resolveWorldVisualState({ entry, narrativeWorldState }),
    [entry, narrativeWorldState],
  );

  if (src && isImmersive) {
    return (
      <>
        <EnvironmentSphere src={src} radius={radius} />
        <ProceduralDome entry={entry} visualState={visualState} radius={radius * 0.985} narrativeWorldState={narrativeWorldState} qualityProfile={qualityProfile} />
        <GroundMemoryRing entry={entry} narrativeWorldState={narrativeWorldState} />
        <DepthVeils entry={entry} narrativeWorldState={narrativeWorldState} />
      </>
    );
  }

  return (
    <>
      <ProceduralDome entry={entry} visualState={visualState} radius={radius} narrativeWorldState={narrativeWorldState} qualityProfile={qualityProfile} />
      {visual && src ? <MemoryShrine visual={visual} entry={entry} /> : null}
      <GroundMemoryRing entry={entry} narrativeWorldState={narrativeWorldState} />
      <DepthVeils entry={entry} narrativeWorldState={narrativeWorldState} />
    </>
  );
}

function GroundMemoryRing({ entry, narrativeWorldState }: { entry: Slipper3DEntry; narrativeWorldState: NarrativeWorldState }) {
  const color = entry.engine3d.environmentGradient?.[2] ?? "#d8d0ba";
  const milestoneRings = Math.min(4, Math.floor(narrativeWorldState.visitedCount / 10));
  const scale = 1 + Math.min(0.46, narrativeWorldState.visitedCount / Math.max(1, narrativeWorldState.totalCount) * 0.6);

  return (
    <group position={[0, -1.24, -3.6]} rotation={[Math.PI / 2, 0, 0]} scale={[scale, scale, 1]}>
      <mesh>
        <ringGeometry args={[2.48, 2.66, 96]} />
        <meshBasicMaterial color={color} transparent opacity={0.032 + narrativeWorldState.explorationDepth * 0.022} side={THREE.DoubleSide} depthWrite={false} />
      </mesh>
      <mesh>
        <circleGeometry args={[1.32, 64]} />
        <meshBasicMaterial color="#ffffff" transparent opacity={0.012 + narrativeWorldState.memoryPressure * 0.016} side={THREE.DoubleSide} depthWrite={false} />
      </mesh>
      {Array.from({ length: milestoneRings }, (_, index) => (
        <mesh key={`journey-ring-${index}`}>
          <ringGeometry args={[5.5 + index * 0.42, 5.56 + index * 0.42, 128]} />
          <meshBasicMaterial color={color} transparent opacity={0.035 + index * 0.01} side={THREE.DoubleSide} depthWrite={false} />
        </mesh>
      ))}
    </group>
  );
}

function DepthVeils({ entry, narrativeWorldState }: { entry: Slipper3DEntry; narrativeWorldState: NarrativeWorldState }) {
  const color = entry.engine3d.environmentGradient?.[2] ?? "#d8d0ba";
  const weight = entry.engine3d.symbolicWeight ?? 3;
  const veils = useMemo(
    () => [
      { z: -4.3, scale: 2.8, opacity: 0.018 + weight * 0.003 },
      { z: -6.2, scale: 4.3, opacity: 0.014 + weight * 0.002 },
      { z: -8.4, scale: 5.8, opacity: 0.01 + weight * 0.002 },
    ],
    [weight],
  );

  return (
    <group>
      {veils.map((veil) => (
        <mesh key={`${entry.id}-veil-${veil.z}`} position={[0, 0.15, veil.z]} scale={[veil.scale, veil.scale * 0.56, 1]}>
          <circleGeometry args={[1, 96]} />
          <meshBasicMaterial color={color} transparent opacity={veil.opacity + narrativeWorldState.memoryPressure * 0.012} side={THREE.DoubleSide} depthWrite={false} />
        </mesh>
      ))}
    </group>
  );
}

function NarrativeWhisperField({
  entry,
  narrativeWorldState,
  qualityProfile,
}: {
  entry: Slipper3DEntry;
  narrativeWorldState: NarrativeWorldState;
  qualityProfile: RenderQualityProfile;
}) {
  const { camera } = useThree();
  const pointsRef = useRef<THREE.Points>(null);
  const visualState = useMemo(
    () => resolveWorldVisualState({ entry, narrativeWorldState }),
    [entry, narrativeWorldState],
  );
  const color = visualState.palette.particle;
  const count = Math.min(150, Math.round((64 + narrativeWorldState.visitedCount * 1.15) * visualState.particleIntensity * qualityProfile.particleMultiplier));
  const seed = hashString(entry.id + "-" + entry.chapter + "-" + (entry.engine3d.emotionalTone ?? "wood"));

  const geometry = useMemo(() => {
    const positions = new Float32Array(count * 3);

    for (let index = 0; index < count; index += 1) {
      const radius = 1.4 + seededUnit(seed, index) * 6.4;
      const angle = seededUnit(seed, index + 100) * Math.PI * 2;
      const height = -0.82 + seededUnit(seed, index + 200) * 2.78;
      const forwardPull = -2.1 - seededUnit(seed, index + 300) * 5.8;

      positions[index * 3] = Math.cos(angle) * radius * 0.48;
      positions[index * 3 + 1] = height;
      positions[index * 3 + 2] = forwardPull + Math.sin(angle) * radius * 0.26;
    }

    const pointsGeometry = new THREE.BufferGeometry();
    pointsGeometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    return pointsGeometry;
  }, [count, seed]);

  useEffect(() => () => geometry.dispose(), [geometry]);

  useFrame(({ clock }, delta) => {
    if (!pointsRef.current) return;
    const depthDrift = 0.018 + narrativeWorldState.explorationDepth * 0.028;
    pointsRef.current.rotation.y += delta * depthDrift;
    pointsRef.current.rotation.z = Math.sin(clock.elapsedTime * 0.14 + seed) * 0.018;
    pointsRef.current.position.copy(camera.position);
    pointsRef.current.position.y += Math.sin(clock.elapsedTime * 0.26 + seed) * 0.035;
  });

  return (
    <points ref={pointsRef} geometry={geometry}>
      <pointsMaterial
        color={color}
        size={0.014 + narrativeWorldState.memoryPressure * 0.01}
        transparent
        opacity={(0.16 + narrativeWorldState.memoryPressure * 0.12) * visualState.particleIntensity}
        depthWrite={false}
        sizeAttenuation
      />
    </points>
  );
}

const STORY_PREVIEW_CHARACTER_LIMIT = 220;

function storyPreview(entry: Slipper3DEntry) {
  const source = entry.paragraphs?.[0] ?? entry.body ?? "";
  const compact = source.replace(/\s+/g, " ").trim();
  if (compact.length <= STORY_PREVIEW_CHARACTER_LIMIT) return compact;

  const candidate = compact.slice(0, STORY_PREVIEW_CHARACTER_LIMIT + 1);
  const finalWordBoundary = candidate.lastIndexOf(" ");
  const excerpt = candidate.slice(
    0,
    finalWordBoundary > STORY_PREVIEW_CHARACTER_LIMIT * 0.72
      ? finalWordBoundary
      : STORY_PREVIEW_CHARACTER_LIMIT,
  );
  return `${excerpt.trimEnd()}…`;
}

function StoryText({ entry }: { entry: Slipper3DEntry }) {
  const preview = storyPreview(entry);
  const textPosition = entry.engine3d.textPosition ?? DEFAULT_TEXT_POSITION;
  const textRotation = entry.engine3d.textRotation ?? DEFAULT_TEXT_ROTATION;
  const maxWidth = entry.engine3d.textMaxWidth ?? 520;
  const distanceFactor = entry.engine3d.textDistanceFactor ?? 1.15;

  return (
    <Html
      transform
      position={textPosition}
      rotation={textRotation}
      distanceFactor={distanceFactor}
      occlude={false}
      zIndexRange={[10, 0]}
    >
      <article className="slipper-story-card" style={{ maxWidth }} data-scene-kind={entry.engine3d.sceneKind}>
        <p className="slipper-story-kicker">
          {getJourneyChapterForEntry(entry.id)?.title ?? entry.chapter}
          {entry.engine3d.mood ? ` / ${entry.engine3d.mood}` : ""}
        </p>
        <h1 className="slipper-story-title">{entry.title}</h1>

        <div className="slipper-story-body">
          <p>{preview}</p>
        </div>

        <p className="slipper-story-action">Press F or Enter to read the full fragment</p>

        {entry.tags?.length > 0 ? (
          <div className="slipper-story-meta" aria-label="Story tags">
            {entry.tags.slice(0, 3).map((tag) => (
              <span className="slipper-story-tag" key={`${entry.id}-${tag}`}>
                {tag}
              </span>
            ))}
          </div>
        ) : null}
      </article>
    </Html>
  );
}

type NPCEncounterKind = keyof typeof NPC_MODEL_PATHS;

type NPCEncounterConfig = {
  kind: NPCEncounterKind;
  src: string;
  label: string;
  scale: number;
  position: Vector3Tuple;
  rotation: EulerTuple;
  baseOpacity: number;
  fadeNear: number;
  fadeFar: number;
};

const NPC_KEYWORD_PATTERNS: Record<NPCEncounterKind, RegExp[]> = {
  wolf: [/\bwolves?\b/g, /\bteeth\b/g, /\btooth\b/g, /\bfangs?\b/g, /\bhunts?\b/g, /\bhunted\b/g, /\bhunting\b/g, /\bpredator\b/g],
  phantom: [/\bphantoms?\b/g, /\bghosts?\b/g, /\bspect(?:er|re)s?\b/g, /\bhaunts?\b/g, /\bhaunted\b/g, /\bshadows?\b/g, /\babsence\b/g, /\bvoid\b/g],
  swan: [/\bswans?\b/g, /\bwings?\b/g, /\bfeathers?\b/g, /\bwhite bird\b/g, /\blake\b/g, /\bgrace\b/g],
};

function selectNPCEncounter(entry: Slipper3DEntry): NPCEncounterConfig | null {
  const signal = entrySemanticSignal(entry);
  const scored = (Object.keys(NPC_MODEL_PATHS) as NPCEncounterKind[]).map((kind) => ({
    kind,
    score: countPatternMatches(signal, NPC_KEYWORD_PATTERNS[kind]),
  }));

  scored.sort((a, b) => b.score - a.score);
  const winner = scored[0];
  if (!winner || winner.score <= 0) return null;

  if (winner.kind === "wolf") {
    return {
      kind: "wolf",
      src: NPC_MODEL_PATHS.wolf,
      label: "wolf encounter",
      scale: 1.18,
      position: [2.4, -0.94, -2.9],
      rotation: [0, -0.34, 0],
      baseOpacity: 0.86,
      fadeNear: 2.15,
      fadeFar: 7.7,
    };
  }

  if (winner.kind === "phantom") {
    return {
      kind: "phantom",
      src: NPC_MODEL_PATHS.phantom,
      label: "phantom encounter",
      scale: 1.08,
      position: [-2.1, -0.74, -3.3],
      rotation: [0, 0.32, 0],
      baseOpacity: 0.72,
      fadeNear: 2.45,
      fadeFar: 8.8,
    };
  }

  return {
    kind: "swan",
    src: NPC_MODEL_PATHS.swan,
    label: "swan encounter",
    scale: 0.96,
    position: [1.85, -0.88, -3.15],
    rotation: [0, -0.18, 0],
    baseOpacity: 0.82,
    fadeNear: 2.0,
    fadeFar: 7.4,
  };
}

function ProceduralNPCFallback({ config }: { config: NPCEncounterConfig }) {
  const { camera } = useThree();
  const reducedMotion = useSettingsStore((state) => state.reducedMotion);
  const reducedEffects = useSettingsStore((state) => state.reducedEffects);
  const groupRef = useRef<THREE.Group>(null);
  const materialsRef = useRef<THREE.Material[]>([]);
  const worldPositionRef = useRef(new THREE.Vector3());
  const opacityRef = useRef(config.baseOpacity * 0.72);

  useLayoutEffect(() => {
    const materials: THREE.Material[] = [];
    groupRef.current?.traverse((object) => {
      if (!(object instanceof THREE.Mesh)) return;
      const entries = Array.isArray(object.material) ? object.material : [object.material];
      for (const material of entries) if (!materials.includes(material)) materials.push(material);
    });
    materialsRef.current = materials;
  }, [config.kind, reducedEffects]);

  useFrame((_, delta) => {
    if (!groupRef.current) return;
    groupRef.current.getWorldPosition(worldPositionRef.current);
    const dx = camera.position.x - worldPositionRef.current.x;
    const dz = camera.position.z - worldPositionRef.current.z;
    const distance = Math.sqrt(dx * dx + dz * dz);
    const fade = THREE.MathUtils.smoothstep(distance, config.fadeNear, config.fadeFar);
    opacityRef.current = THREE.MathUtils.lerp(opacityRef.current, config.baseOpacity * 0.72 * fade, 1 - Math.exp(-delta * 4.2));
    for (const material of materialsRef.current) material.opacity = opacityRef.current;
    groupRef.current.visible = opacityRef.current > 0.025;
  });

  return <Float enabled={!reducedMotion && !reducedEffects} speed={0.6} rotationIntensity={0.025} floatIntensity={config.kind === "phantom" ? 0.12 : 0.025} floatingRange={[-0.02, 0.06]}>
    <group ref={groupRef} position={config.position} rotation={config.rotation} scale={config.scale}>
      <AuthoredNpcSilhouette kind={config.kind} opacity={config.baseOpacity * 0.72} />
    </group>
  </Float>;
}

type NPCEncounterErrorBoundaryState = { hasError: boolean };

class NPCEncounterErrorBoundary extends Component<
  { config: NPCEncounterConfig; children: ReactNode },
  NPCEncounterErrorBoundaryState
> {
  state: NPCEncounterErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(): NPCEncounterErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    if (import.meta.env.DEV) {
      console.warn(`NPC model failed to load. Rendering procedural fallback instead: ${this.props.config.src}`, error, info.componentStack);
    }
  }

  componentDidUpdate(previousProps: { config: NPCEncounterConfig }) {
    if (previousProps.config.src !== this.props.config.src && this.state.hasError) {
      this.setState({ hasError: false });
    }
  }

  render() {
    if (this.state.hasError) return <ProceduralNPCFallback config={this.props.config} />;
    return this.props.children;
  }
}

function NPCEncounterModel({ config }: { config: NPCEncounterConfig }) {
  const gltf = useCompressedGLTF(config.src);
  return !gltf || isPlaceholderNpcAsset(gltf) ? <ProceduralNPCFallback config={config} /> : <LoadedNPCEncounterModel config={config} source={gltf.scene} />;
}

function LoadedNPCEncounterModel({ config, source }: { config: NPCEncounterConfig; source: THREE.Group }) {
  const { camera } = useThree();
  const reducedMotion = useSettingsStore((state) => state.reducedMotion);
  const reducedEffects = useSettingsStore((state) => state.reducedEffects);
  const groupRef = useRef<THREE.Group>(null);
  const worldPositionRef = useRef(new THREE.Vector3());
  const opacityRef = useRef(config.baseOpacity);
  const model = useMemo(() => {
    const owned = cloneNpcPresentation(source, config.baseOpacity);
    const surfaces: { material: THREE.Material; opacity: number }[] = [];
    owned.scene.traverse((object) => {
      if (!(object instanceof THREE.Mesh)) return;
      const materials = Array.isArray(object.material) ? object.material : [object.material];
      for (const material of materials) if (!surfaces.some((surface) => surface.material === material)) surfaces.push({ material, opacity: material.opacity });
    });
    return { ...owned, surfaces };
  }, [source, config.baseOpacity]);

  useEffect(() => () => model.dispose(), [model]);

  useFrame((_, delta) => {
    if (!groupRef.current) return;

    groupRef.current.getWorldPosition(worldPositionRef.current);
    const dx = camera.position.x - worldPositionRef.current.x;
    const dz = camera.position.z - worldPositionRef.current.z;
    const playerDistance = Math.sqrt(dx * dx + dz * dz);
    const fade = THREE.MathUtils.smoothstep(playerDistance, config.fadeNear, config.fadeFar);
    const targetOpacity = config.baseOpacity * fade;
    opacityRef.current = THREE.MathUtils.lerp(opacityRef.current, targetOpacity, 1 - Math.exp(-delta * 4.2));

    for (const surface of model.surfaces) {
      surface.material.opacity = surface.opacity * opacityRef.current / config.baseOpacity;
    }

    groupRef.current.visible = opacityRef.current > 0.025;
  });

  return (
    <Float enabled={!reducedMotion && !reducedEffects} speed={1.05} rotationIntensity={0.08} floatIntensity={0.34} floatingRange={[-0.06, 0.16]}>
      <group ref={groupRef} position={config.position} rotation={config.rotation} scale={config.scale}>
        <primitive object={model.scene} />
        <mesh position={[0, 0.12, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <circleGeometry args={[1.35, 72]} />
          <meshBasicMaterial color="#fff4d2" transparent opacity={0.075} depthWrite={false} side={THREE.DoubleSide} />
        </mesh>
      </group>
    </Float>
  );
}

function NPCEncounter({ entry }: { entry: Slipper3DEntry }) {
  const config = useMemo(() => selectNPCEncounter(entry), [entry]);
  if (!config) return null;
  return (
    <NPCEncounterErrorBoundary key={config.src} config={config}>
      <Suspense fallback={<ProceduralNPCFallback config={config} />}>
        <NPCEncounterModel config={config} />
      </Suspense>
    </NPCEncounterErrorBoundary>
  );
}

type ChapterLandmarkSpec = {
  chapter: string;
  position: Vector3Tuple;
  color: string;
  kind: "firstWood" | "mirror" | "thorned" | "archive" | "fireRiver" | "crowned";
};

function visualBloomForLandmark(kind: ChapterLandmarkSpec["kind"]) {
  if (kind === "crowned") return 0.12;
  if (kind === "archive") return 0.09;
  if (kind === "fireRiver") return 0.08;
  if (kind === "mirror") return 0.07;
  return 0.045;
}

function ChapterLandmarks({ entries, activeEntry, qualityProfile }: { entries: Slipper3DEntry[]; activeEntry: Slipper3DEntry; qualityProfile: RenderQualityProfile }) {
  const landmarks = useMemo<ChapterLandmarkSpec[]>(() => {
    const byChapter = new Map<string, Slipper3DEntry[]>();
    for (const entry of entries) {
      const bucket = byChapter.get(entry.chapter) ?? [];
      bucket.push(entry);
      byChapter.set(entry.chapter, bucket);
    }

    return Array.from(byChapter.entries()).map(([chapter, chapterEntries]) => {
      let x = 0;
      let z = 0;
      for (const entry of chapterEntries) {
        const position = entryWorldPosition(entry, entries);
        x += position[0];
        z += position[2];
      }
      const count = Math.max(1, chapterEntries.length);
      const anchor = chapterEntries[Math.floor(chapterEntries.length * 0.55)] ?? chapterEntries[0];
      const anchorPosition = entryWorldPosition(anchor, entries);
      return {
        chapter,
        position: [x / count, TERRAIN_BASE_Y + anchorPosition[1] + 0.08, z / count] as Vector3Tuple,
        color: anchor.engine3d.environmentGradient?.[2] ?? "#d8d0ba",
        kind: chapterBiome(anchor),
      };
    });
  }, [entries]);

  return (
    <group>
      {landmarks.map((landmark) => {
        const isActive = landmark.chapter === activeEntry.chapter;
        const opacity = (isActive ? 0.34 : 0.13) * qualityProfile.landmarkSilhouetteMultiplier;
        const scale = isActive ? 1.12 : 0.88;
        const bloomOpacity = qualityProfile.enableBloomProxies ? opacity * visualBloomForLandmark(landmark.kind) : 0;
        return (
          <group key={landmark.chapter} position={landmark.position} scale={[scale, scale, scale]}>
            {bloomOpacity > 0 ? (
              <>
                <mesh position={[0, landmark.kind === "crowned" ? 3.7 : 2.3, 0]}>
                  <sphereGeometry args={[landmark.kind === "crowned" ? 3.2 : 2.2, 24, 12]} />
                  <meshBasicMaterial color={landmark.color} transparent opacity={bloomOpacity} depthWrite={false} toneMapped={false} />
                </mesh>
                <mesh position={[0, 0.08, 0]} rotation={[-Math.PI / 2, 0, 0]}>
                  <ringGeometry args={[2.9, 3.08, 72]} />
                  <meshBasicMaterial color={landmark.color} transparent opacity={bloomOpacity * 1.6} depthWrite={false} side={THREE.DoubleSide} toneMapped={false} />
                </mesh>
              </>
            ) : null}
            {landmark.kind === "mirror" ? (
              <mesh position={[0, 3.2, 0]} rotation={[0.08, Math.PI * 0.22, -0.12]}>
                <boxGeometry args={[0.12, 6.2, 2.1]} />
                <meshBasicMaterial color={landmark.color} transparent opacity={opacity} depthWrite={false} />
              </mesh>
            ) : landmark.kind === "thorned" ? (
              <group>
                <mesh position={[0, 2.25, 0]} rotation={[0, Math.PI / 4, 0]}>
                  <boxGeometry args={[4.8, 0.28, 1.2]} />
                  <meshBasicMaterial color="#16110f" transparent opacity={opacity * 1.2} depthWrite={false} />
                </mesh>
                <mesh position={[0, 1.35, 0]}>
                  <coneGeometry args={[2.1, 3.1, 5]} />
                  <meshBasicMaterial color={landmark.color} transparent opacity={opacity * 0.62} depthWrite={false} />
                </mesh>
              </group>
            ) : landmark.kind === "archive" ? (
              <group>
                {[0, 1, 2].map((index) => (
                  <mesh key={index} position={[0, 1.3 + index * 1.1, 0]} rotation={[0, index * 0.48, 0]}>
                    <boxGeometry args={[2.9 - index * 0.42, 0.08, 1.1 + index * 0.24]} />
                    <meshBasicMaterial color={landmark.color} transparent opacity={opacity * (0.78 - index * 0.08)} depthWrite={false} />
                  </mesh>
                ))}
              </group>
            ) : landmark.kind === "fireRiver" ? (
              <mesh position={[0, 0.12, 0]} rotation={[-Math.PI / 2, 0, Math.PI * 0.18]}>
                <planeGeometry args={[7.8, 1.1, 1, 1]} />
                <meshBasicMaterial color={landmark.color} transparent opacity={opacity * 0.84} side={THREE.DoubleSide} depthWrite={false} />
              </mesh>
            ) : landmark.kind === "crowned" ? (
              <group>
                <mesh position={[0, 5.2, 0]} rotation={[Math.PI / 2, 0, 0]}>
                  <torusGeometry args={[1.55, 0.045, 6, 24]} />
                  <meshBasicMaterial color={landmark.color} transparent opacity={opacity * 1.35} depthWrite={false} />
                </mesh>
                <mesh position={[0, 2.4, 0]}>
                  <cylinderGeometry args={[0.18, 0.34, 4.8, 6]} />
                  <meshBasicMaterial color={landmark.color} transparent opacity={opacity * 0.62} depthWrite={false} />
                </mesh>
              </group>
            ) : (
              <group>
                <mesh position={[0, 2.3, 0]}>
                  <cylinderGeometry args={[0.16, 0.34, 4.6, 6]} />
                  <meshBasicMaterial color="#30261d" transparent opacity={isActive ? 0.62 : 0.28} depthWrite={false} />
                </mesh>
                <mesh position={[0, 5.1, 0]}>
                  <coneGeometry args={[1.55, 3.4, 7]} />
                  <meshBasicMaterial color={isActive ? "#183128" : "#0c1713"} transparent opacity={isActive ? 0.68 : 0.3} depthWrite={false} />
                </mesh>
              </group>
            )}
          </group>
        );
      })}
    </group>
  );
}

function ClearingMemoryMarker({ entry, visitedCount }: { entry: Slipper3DEntry; visitedCount: number }) {
  const color = entry.engine3d.environmentGradient?.[2] ?? "#c8b38a";
  const scale = 1 + Math.min(0.24, visitedCount / 180);

  return (
    <group position={[0, -1.19, 0]} rotation={[Math.PI / 2, 0, 0]} scale={[scale, scale, 1]}>
      <mesh>
        <ringGeometry args={[1.72, 2.08, 96]} />
        <meshBasicMaterial color={color} transparent opacity={0.09 + clamp01(visitedCount / 100) * 0.06} side={THREE.DoubleSide} depthWrite={false} />
      </mesh>
      <mesh>
        <circleGeometry args={[1.45, 96]} />
        <meshBasicMaterial color="#ffffff" transparent opacity={0.018 + clamp01(visitedCount / 140) * 0.018} side={THREE.DoubleSide} depthWrite={false} />
      </mesh>
    </group>
  );
}

function ForestMarkers({ entry, visitedCount }: { entry: Slipper3DEntry; visitedCount: number }) {
  const seed = hashString(entry.id);
  const color = entry.engine3d.environmentGradient?.[2] ?? "#c8b38a";
  const trunkCount = Math.min(34, 18 + Math.floor(visitedCount / 5));
  const trunks = useMemo(
    () =>
      Array.from({ length: trunkCount }, (_, index) => {
        const side = index % 2 === 0 ? -1 : 1;
        const x = side * (2.9 + seededUnit(seed, index) * 3.2);
        const y = -0.15 + seededUnit(seed, index + 12) * 0.35;
        const z = -3.8 - seededUnit(seed, index + 20) * 5.6;
        const height = 1.25 + seededUnit(seed, index + 33) * 2.5;
        return { x, y, z, height };
      }),
    [seed, trunkCount],
  );

  return (
    <group>
      {trunks.map((trunk, index) => (
        <mesh key={`${entry.id}-trunk-${index}`} position={[trunk.x, trunk.y, trunk.z]} rotation={[0, 0, (seededUnit(seed, index + 50) - 0.5) * 0.22]}>
          <cylinderGeometry args={[0.018, 0.045, trunk.height, 6]} />
          <meshBasicMaterial color={color} transparent opacity={0.14 + clamp01(visitedCount / 80) * 0.08} />
        </mesh>
      ))}
    </group>
  );
}

function EmberMarkers({ entry, visitedCount }: { entry: Slipper3DEntry; visitedCount: number }) {
  const seed = hashString(entry.id);
  const groupRef = useRef<THREE.Group>(null);
  const emberCount = Math.min(40, 12 + Math.floor(visitedCount * 0.48));
  const embers = useMemo(
    () =>
      Array.from({ length: emberCount }, (_, index) => ({
        x: (seededUnit(seed, index) - 0.5) * 4.8,
        y: -0.8 + seededUnit(seed, index + 20) * 2.8,
        z: -2.2 - seededUnit(seed, index + 40) * 5.2,
        scale: 0.008 + seededUnit(seed, index + 60) * (0.018 + clamp01(visitedCount / 50) * 0.01),
      })),
    [emberCount, seed, visitedCount],
  );

  useFrame(({ clock }) => {
    if (groupRef.current) {
      groupRef.current.position.y = Math.sin(clock.elapsedTime * 0.7) * 0.025;
    }
  });

  return (
    <group ref={groupRef}>
      {embers.map((ember, index) => (
        <mesh key={`${entry.id}-ember-${index}`} position={[ember.x, ember.y, ember.z]}>
          <sphereGeometry args={[ember.scale, 10, 10]} />
          <meshBasicMaterial color="#e6b878" transparent opacity={0.26 + clamp01(visitedCount / 70) * 0.16} />
        </mesh>
      ))}
    </group>
  );
}

function WaterMirror({ entry, visitedCount }: { entry: Slipper3DEntry; visitedCount: number }) {
  const color = entry.engine3d.environmentGradient?.[2] ?? "#9fb6ad";
  const scale = 1 + Math.min(0.32, visitedCount / 120);
  return (
    <group position={[0, -1.18, -4.3]} rotation={[Math.PI / 2, 0, 0]} scale={[scale, scale, 1]}>
      <mesh>
        <circleGeometry args={[2.28, 96]} />
        <meshBasicMaterial color={color} transparent opacity={0.13 + clamp01(visitedCount / 100) * 0.05} side={THREE.DoubleSide} depthWrite={false} />
      </mesh>
      <mesh>
        <ringGeometry args={[2.34, 2.42, 96]} />
        <meshBasicMaterial color="#ffffff" transparent opacity={0.16} side={THREE.DoubleSide} depthWrite={false} />
      </mesh>
    </group>
  );
}

function ThresholdDoor({ entry, visitedCount }: { entry: Slipper3DEntry; visitedCount: number }) {
  const color = entry.engine3d.environmentGradient?.[2] ?? "#c8b38a";
  const glow = Math.min(0.16, visitedCount / 260);
  return (
    <group position={[0, 0.08, -5.42]}>
      <mesh position={[-0.86, 0, 0]}>
        <boxGeometry args={[0.035, 2.35, 0.04]} />
        <meshBasicMaterial color={color} transparent opacity={0.28 + glow} />
      </mesh>
      <mesh position={[0.86, 0, 0]}>
        <boxGeometry args={[0.035, 2.35, 0.04]} />
        <meshBasicMaterial color={color} transparent opacity={0.28 + glow} />
      </mesh>
      <mesh position={[0, 1.18, 0]}>
        <boxGeometry args={[1.75, 0.035, 0.04]} />
        <meshBasicMaterial color={color} transparent opacity={0.26 + glow} />
      </mesh>
    </group>
  );
}

function ArchiveMoonOrbitGlyph({ entry, visitedCount }: { entry: Slipper3DEntry; visitedCount: number }) {
  const color = entry.engine3d.environmentGradient?.[2] ?? "#b8c8d8";
  return (
    <mesh position={[0, 2.4, -8.2]} rotation={[0, 0, Math.PI * 0.14]} scale={1 + Math.min(0.28, visitedCount / 140)}>
      <ringGeometry args={[0.61, 0.67, 56]} />
      <meshBasicMaterial color={color} transparent opacity={0.2 + clamp01(visitedCount / 80) * 0.12} depthWrite={false} toneMapped={false} />
    </mesh>
  );
}

function CrownGlyph({ entry, visitedCount }: { entry: Slipper3DEntry; visitedCount: number }) {
  const color = entry.engine3d.environmentGradient?.[2] ?? "#e8d49a";
  const ringCount = Math.min(5, 2 + Math.floor(visitedCount / 10));
  return (
    <group position={[0, 1.55, -5.8]}>
      {Array.from({ length: ringCount }, (_, index) => (
        <mesh key={`${entry.id}-crown-ring-${index}`} position={[0, index * 0.09, 0]} rotation={[Math.PI / 2, 0, index * 0.18]}>
          <torusGeometry args={[0.38 + index * 0.2, 0.008 + index * 0.0015, 12, 128]} />
          <meshBasicMaterial color={index === 1 ? "#ffffff" : color} transparent opacity={index === 1 ? 0.22 : 0.22 + index * 0.055} />
        </mesh>
      ))}
    </group>
  );
}

function SymbolicObjects({ entry, visitedCount }: { entry: Slipper3DEntry; visitedCount: number }) {
  const text = `${entry.engine3d.sceneKind ?? ""} ${entry.engine3d.emotionalTone ?? ""} ${entry.tags.join(" ")}`.toLowerCase();
  const isWater = /water|mirror|river|pool|reflection/.test(text);
  const isFire = /fire|ember|ash|burn|flame/.test(text);
  const isArchive = /archive|moon|night|stars/.test(text);
  const isThreshold = /threshold|house|door|first|crossing/.test(text);
  const isCrown = /crown|return|exit/.test(text);

  return (
    <>
      {isWater ? <WaterMirror entry={entry} visitedCount={visitedCount} /> : null}
      {isFire ? <EmberMarkers entry={entry} visitedCount={visitedCount} /> : null}
      {isArchive ? <ArchiveMoonOrbitGlyph entry={entry} visitedCount={visitedCount} /> : null}
      {isThreshold ? <ThresholdDoor entry={entry} visitedCount={visitedCount} /> : null}
      {isCrown ? <CrownGlyph entry={entry} visitedCount={visitedCount} /> : null}
    </>
  );
}

function SymbolicLayer({ entry, visitedCount, mode }: { entry: Slipper3DEntry; visitedCount: number; mode: SymbolicLayerMode }) {
  const groupRef = useRef<THREE.Group>(null);
  const progressRef = useRef(mode === "current" ? 1 : 0);

  useEffect(() => {
    progressRef.current = 0;
  }, [entry.id, mode]);

  useFrame((_, delta) => {
    if (!groupRef.current) return;
    progressRef.current = Math.min(1, progressRef.current + delta * (mode === "current" ? 1.65 : 0.92));
    const t = 1 - Math.pow(1 - progressRef.current, 3);

    if (mode === "current") {
      groupRef.current.position.y = THREE.MathUtils.lerp(-0.32, 0, t);
      groupRef.current.scale.setScalar(THREE.MathUtils.lerp(0.96, 1, t));
      applyGroupOpacity(groupRef.current, THREE.MathUtils.lerp(0.2, 1, t));
      return;
    }

    groupRef.current.position.y = THREE.MathUtils.lerp(0, -1.12, t);
    groupRef.current.scale.setScalar(THREE.MathUtils.lerp(1, 0.92, t));
    applyGroupOpacity(groupRef.current, 1 - t);
  });

  return (
    <group ref={groupRef}>
      <SymbolicObjects entry={entry} visitedCount={visitedCount} />
    </group>
  );
}

function CarryoverSymbolicObjects({ entry, visitedCount }: { entry: Slipper3DEntry; visitedCount: number }) {
  const previousEntryRef = useRef<Slipper3DEntry | null>(null);
  const cleanupTimeoutsRef = useRef<number[]>([]);
  const [echoes, setEchoes] = useState<Array<{ key: string; entry: Slipper3DEntry }>>([]);

  useEffect(() => {
    const previousEntry = previousEntryRef.current;
    if (previousEntry && previousEntry.id !== entry.id) {
      const key = `${previousEntry.id}-${Date.now()}`;
      setEchoes((current) => [...current.slice(-2), { key, entry: previousEntry }]);
      const cleanup = window.setTimeout(() => {
        setEchoes((current) => current.filter((echo) => echo.key !== key));
      }, 1500);
      cleanupTimeoutsRef.current.push(cleanup);
    }

    previousEntryRef.current = entry;
  }, [entry]);

  useEffect(() => {
    return () => {
      for (const timeout of cleanupTimeoutsRef.current) window.clearTimeout(timeout);
    };
  }, []);

  return (
    <>
      {echoes.map((echo) => (
        <SymbolicLayer key={echo.key} entry={echo.entry} visitedCount={visitedCount} mode="echo" />
      ))}
      <SymbolicLayer entry={entry} visitedCount={visitedCount} mode="current" />
    </>
  );
}

function SceneDebugOverlay({
  entry,
  narrativeWorldState,
  qualityProfile,
  visualState,
  nodes,
}: {
  entry: Slipper3DEntry;
  narrativeWorldState: NarrativeWorldState;
  qualityProfile: RenderQualityProfile;
  visualState: WorldVisualState;
  nodes: SpatialStoryNode[];
}) {
  const { gl, camera } = useThree();
  const renderScale = useMemo(
    () => resolveNarrativeRenderScale({ qualityProfile, narrativeWorldState }),
    [
      qualityProfile,
      narrativeWorldState.memoryPressure,
      narrativeWorldState.explorationDepth,
      narrativeWorldState.fireWaterBalance,
      narrativeWorldState.symbolicWeight,
    ],
  );
  const frameCountRef = useRef(0);
  const elapsedRef = useRef(0);
  const [stats, setStats] = useState({ fps: 0, calls: 0, triangles: 0, geometries: 0, textures: 0, x: 0, z: 0 });

  useFrame((_, delta) => {
    frameCountRef.current += 1;
    elapsedRef.current += delta;
    if (elapsedRef.current < 0.5) return;

    const fps = Math.round(frameCountRef.current / elapsedRef.current);
    frameCountRef.current = 0;
    elapsedRef.current = 0;

    setStats({
      fps,
      calls: gl.info.render.calls,
      triangles: gl.info.render.triangles,
      geometries: gl.info.memory.geometries,
      textures: gl.info.memory.textures,
      x: camera.position.x,
      z: camera.position.z,
    });
  });

  return (
    <Html fullscreen zIndexRange={[40, 0]}>
      <aside className="slipper-debug-overlay" aria-label="Scene debug overlay">
        <strong>SIDTW debug</strong>
        <span>quality: {qualityProfile.label} / {renderScale.label}</span>
        <span>chapter: {getJourneyChapterForEntry(entry.id)?.title ?? entry.chapter}</span>
        <span>director: {visualState.director.navigationStyle}</span>
        <span>fps: {stats.fps}</span>
        <span>draw calls: {stats.calls}</span>
        <span>triangles: {stats.triangles.toLocaleString()}</span>
        <span>geo/tex: {stats.geometries}/{stats.textures}</span>
        <span>dpr: {renderScale.effectivePixelRatio.toFixed(2)} / cap {renderScale.narrativePixelRatioCap.toFixed(2)}</span>
        <span>fog: {visualState.fogDensity.toFixed(3)}</span>
        <span>path clarity: {visualState.pathClarity.toFixed(2)}</span>
        <span>nodes: {nodes.length}</span>
        <span>pos: {stats.x.toFixed(1)}, {stats.z.toFixed(1)}</span>
        <span>memory: {narrativeWorldState.memoryPressure.toFixed(2)}</span>
      </aside>
    </Html>
  );
}

function NodeLandmarkSilhouette({
  node,
  activeEntry,
  narrativeWorldState,
  qualityProfile,
}: {
  node: SpatialStoryNode;
  activeEntry: Slipper3DEntry;
  narrativeWorldState: NarrativeWorldState;
  qualityProfile: RenderQualityProfile;
}) {
  const semantic = useMemo(() => dominantSemanticTheme(node.entry), [node.entry]);
  const visualState = useMemo(() => resolveWorldVisualState({ entry: node.entry, narrativeWorldState }), [node.entry, narrativeWorldState]);
  const chapterKind = chapterBiome(node.entry);
  const isActive = node.isActive;
  const isTargetTone = node.entry.chapter === activeEntry.chapter;
  const baseOpacity = (isActive ? 0.24 : node.isVisited ? 0.14 : 0.09) * qualityProfile.landmarkSilhouetteMultiplier;
  const bloomOpacity = qualityProfile.enableBloomProxies ? baseOpacity * visualState.bloomIntensity : baseOpacity * 0.35;
  const color = visualState.palette.portal;
  const accent = visualState.palette.accent;
  const lift = isActive ? 0.22 : 0;

  return (
    <group position={[0, lift, 0]} renderOrder={node.isActive ? 18 : 8}>
      <mesh position={[0, -1.08, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[2.15, 2.32, 80]} />
        <meshBasicMaterial color={color} transparent opacity={baseOpacity * (isTargetTone ? 1.25 : 0.82)} depthWrite={false} side={THREE.DoubleSide} toneMapped={false} />
      </mesh>

      {semantic.theme === "water" ? (
        <group>
          <mesh position={[0, -1.02, 0]} rotation={[-Math.PI / 2, 0, 0]} scale={[1.28, 0.62, 1]}>
            <circleGeometry args={[1.7, 64]} />
            <meshBasicMaterial color="#9fd4dd" transparent opacity={bloomOpacity * 0.9} depthWrite={false} side={THREE.DoubleSide} toneMapped={false} />
          </mesh>
          <mesh position={[0, 0.86, 0]} rotation={[0.04, Math.PI * 0.22, -0.08]}>
            <boxGeometry args={[0.055, 2.2, 0.92]} />
            <meshBasicMaterial color="#d8f7ff" transparent opacity={baseOpacity * 1.5} depthWrite={false} toneMapped={false} />
          </mesh>
        </group>
      ) : semantic.theme === "fire" ? (
        <group>
          <mesh position={[0, 0.46, 0]} rotation={[0, Math.PI * 0.2, 0]}>
            <coneGeometry args={[0.78, 1.95, 6]} />
            <meshBasicMaterial color="#ff8a36" transparent opacity={bloomOpacity * 1.25} depthWrite={false} toneMapped={false} />
          </mesh>
          <mesh position={[0, -0.98, 0]} rotation={[-Math.PI / 2, 0, 0]}>
            <ringGeometry args={[0.72, 1.58, 54]} />
            <meshBasicMaterial color="#ffb36a" transparent opacity={baseOpacity} depthWrite={false} side={THREE.DoubleSide} toneMapped={false} />
          </mesh>
        </group>
      ) : semantic.theme === "threshold" || semantic.theme === "thorns" ? (
        <group>
          <mesh position={[-0.56, 0.1, 0]} rotation={[0, 0, 0.12]}>
            <boxGeometry args={[0.12, 2.2, 0.12]} />
            <meshBasicMaterial color={accent} transparent opacity={baseOpacity * 1.35} depthWrite={false} />
          </mesh>
          <mesh position={[0.56, 0.1, 0]} rotation={[0, 0, -0.12]}>
            <boxGeometry args={[0.12, 2.2, 0.12]} />
            <meshBasicMaterial color={accent} transparent opacity={baseOpacity * 1.35} depthWrite={false} />
          </mesh>
          <mesh position={[0, 1.18, 0]}>
            <boxGeometry args={[1.35, 0.12, 0.12]} />
            <meshBasicMaterial color={accent} transparent opacity={baseOpacity * 1.15} depthWrite={false} />
          </mesh>
          {semantic.theme === "thorns" ? (
            <mesh position={[0, 0.28, 0]} rotation={[0, 0, Math.PI / 4]}>
              <coneGeometry args={[0.34, 1.5, 5]} />
              <meshBasicMaterial color="#60704a" transparent opacity={baseOpacity * 0.95} depthWrite={false} />
            </mesh>
          ) : null}
        </group>
      ) : semantic.theme === "crown" ? (
        <group>
          <mesh position={[0, 1.72, 0]} rotation={[Math.PI / 2, 0, 0]}>
            <torusGeometry args={[0.92, 0.035, 8, 48]} />
            <meshBasicMaterial color="#ffe1a3" transparent opacity={baseOpacity * 1.75} depthWrite={false} toneMapped={false} />
          </mesh>
          <mesh position={[0, 0.46, 0]}>
            <cylinderGeometry args={[0.06, 0.18, 2.55, 6]} />
            <meshBasicMaterial color="#e2bd63" transparent opacity={bloomOpacity * 1.1} depthWrite={false} toneMapped={false} />
          </mesh>
        </group>
      ) : semantic.theme === "archive" || semantic.theme === "celestial" || chapterKind === "archive" ? (
        <group>
          {[0, 1, 2].map((index) => (
            <mesh key={`node-archive-page-${index}`} position={[0, 0.32 + index * 0.34, 0]} rotation={[0.12, index * 0.42, 0.05 * (index - 1)]}>
              <boxGeometry args={[1.08 - index * 0.16, 0.035, 0.44 + index * 0.06]} />
              <meshBasicMaterial color="#dbe6ff" transparent opacity={baseOpacity * (1.4 - index * 0.18)} depthWrite={false} toneMapped={false} />
            </mesh>
          ))}
          <mesh position={[0, 1.02, 0]} rotation={[Math.PI / 2, 0, Math.PI * 0.17]}>
            <torusGeometry args={[0.92, 0.018, 6, 48]} />
            <meshBasicMaterial color="#b7c9ff" transparent opacity={bloomOpacity} depthWrite={false} toneMapped={false} />
          </mesh>
        </group>
      ) : (
        <group>
          <mesh position={[0, 0.68, 0]}>
            <cylinderGeometry args={[0.065, 0.12, 1.85, 6]} />
            <meshBasicMaterial color={accent} transparent opacity={baseOpacity} depthWrite={false} />
          </mesh>
          <mesh position={[0, 1.64, 0]}>
            <coneGeometry args={[0.62, 1.12, 7]} />
            <meshBasicMaterial color={color} transparent opacity={baseOpacity * 1.25} depthWrite={false} />
          </mesh>
        </group>
      )}
    </group>
  );
}

function WorldStoryNode({
  node,
  visual,
  activeEntry,
  narrativeWorldState,
  mode,
  qualityProfile,
}: {
  node: SpatialStoryNode;
  visual?: Slipper3DVisual;
  activeEntry: Slipper3DEntry;
  narrativeWorldState: NarrativeWorldState;
  mode: StorySceneMode;
  qualityProfile: RenderQualityProfile;
}) {
  const { camera } = useThree();
  const groupRef = useRef<THREE.Group>(null);
  const journeyRole = getJourneyEntryContext(node.entry.id)?.role ?? "echo";
  const isKeystone = journeyRole === "keystone";
  const isEcho = journeyRole === "echo";
  const isIntegratedFinale = isIntegratedFinaleEntry(node.entry.id);
  const authoredScene = getJourneySceneForEntry(node.entry.id);
  const suppressLegacyActiveLandmark = Boolean(authoredScene) || isIntegratedFinale || usesAuthoredCausalComposition(node.entry.id);
  const opacity = node.isActive
    ? 1
    : (node.isVisited ? 0.68 : 0.48) * (isEcho ? 0.72 : 1);
  const scaleRef = useRef(new THREE.Vector3(1, 1, 1));

  useFrame((_, delta) => {
    if (!groupRef.current) return;
    const distanceFromCamera = Math.hypot(
      camera.position.x - node.position[0],
      camera.position.z - node.position[2],
    );
    groupRef.current.visible = node.isActive || distanceFromCamera > 6.5;
    if (!groupRef.current.visible) return;
    const targetScale = node.isActive
      ? isKeystone ? 1.06 : 0.88
      : isKeystone ? 0.9 : 0.7;
    scaleRef.current.set(targetScale, targetScale, targetScale);
    groupRef.current.scale.lerp(scaleRef.current, 1 - Math.exp(-delta * 4.5));
  });

  return (
    <group
      ref={groupRef}
      position={node.position}
      userData={{ journeyRole, keystone: isKeystone }}
    >
      {!node.isActive && !authoredScene ? <NodeLandmarkSilhouette node={node} activeEntry={activeEntry} narrativeWorldState={narrativeWorldState} qualityProfile={qualityProfile} /> : null}
      <group>
        {node.isActive && !suppressLegacyActiveLandmark ? <SymbolicObjects entry={node.entry} visitedCount={narrativeWorldState.visitedCount} /> : null}
        {node.isActive && isKeystone && !suppressLegacyActiveLandmark ? (
          <group name="keystone-memory-halo" position={[0, 0.16, 0]}>
            <mesh rotation={[Math.PI / 2, 0, 0]}>
              <torusGeometry args={[2.15, 0.025, 6, 48]} />
              <meshBasicMaterial color={node.entry.engine3d.environmentGradient?.[2] ?? "#e4d2a6"} transparent opacity={0.2} depthWrite={false} toneMapped={false} />
            </mesh>
            <mesh rotation={[Math.PI / 2, 0.34, 0]}>
              <torusGeometry args={[1.64, 0.012, 5, 36]} />
              <meshBasicMaterial color="#f4ead2" transparent opacity={0.12} depthWrite={false} toneMapped={false} />
            </mesh>
          </group>
        ) : null}
        {node.isActive && isEcho && !suppressLegacyActiveLandmark ? (
          <mesh name="echo-memory-whisper" position={[0, 0.42, 0]} rotation={[0.18, 0.32, 0.08]}>
            <octahedronGeometry args={[0.32, 0]} />
            <meshBasicMaterial color={node.entry.engine3d.environmentGradient?.[1] ?? "#a8b6b0"} transparent opacity={0.24} depthWrite={false} />
          </mesh>
        ) : null}
        {node.isActive && isKeystone && !suppressLegacyActiveLandmark && qualityProfile.quality === "cinematic" ? <NarrativeWeather entry={node.entry} narrativeWorldState={narrativeWorldState} qualityProfile={qualityProfile} /> : null}
        {node.isActive && isKeystone && !suppressLegacyActiveLandmark ? <NPCEncounter entry={node.entry} /> : null}
        {node.isActive && isKeystone && !suppressLegacyActiveLandmark ? <ChapterShrine visual={visual} entry={node.entry} narrativeWorldState={narrativeWorldState} /> : null}
      </group>
      {node.isActive && mode === "explore" && !suppressLegacyActiveLandmark ? <StoryText entry={node.entry} /> : null}
      {!node.isActive && !authoredScene ? (
        <mesh position={[0, -1.05, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <ringGeometry args={[2.8, 3.05, 96]} />
          <meshBasicMaterial color={activeEntry.engine3d.environmentGradient?.[2] ?? "#d8d0ba"} transparent opacity={0.05 * opacity} side={THREE.DoubleSide} depthWrite={false} />
        </mesh>
      ) : null}
    </group>
  );
}

function thresholdRotationForNode(
  node: SpatialStoryNode,
  pathSegments: MazePathSegment[],
) {
  const segment = pathSegments.find(
    (candidate) =>
      candidate.sourceEntry.id === node.entry.id ||
      candidate.targetEntry.id === node.entry.id,
  );
  if (!segment) return undefined;
  const otherPosition = segment.sourceEntry.id === node.entry.id
    ? segment.target
    : segment.source;
  return Math.atan2(
    otherPosition.x - node.position[0],
    otherPosition.y - node.position[2],
  );
}

export function StoryScene({
  children,
  ambientParticlesEnabled = false,
  entryId,
  entries,
  visuals,
  qualityProfile,
  reducedEffects = false,
  controls = "orbit",
  mode = "explore",
  fallbackEnvironmentSrc,
  visitedEntryIds = [],
  narrativeWorldState = ZERO_STATE,
  storyWorldMemory,
  lockedEntryIds = [],
  navigationTargetEntryId = null,
  quietGuidanceActivity,
  initialPlayerPosition = null,
  narrativeAudioSuppressed = false,
  onFinalConstellationFormationComplete,
  onPortalSelect,
  onPlayerProximityChange,
}: StorySceneProps) {
  const cameraReadyRef = useRef(false);
  const playerPoseRef = useRef(createPlayerPose(DEFAULT_CAMERA_POSITION));
  const physicalInputActive = useCallback(() => !document.hidden && document.hasFocus() && !useSettingsStore.getState().drawerOpen && !useWorldStore.getState().physicsPaused, []);
  const openingReflectionInverted = useJourneyStore(state => state.storyObjectStates["broken-floor.reflection"] === "inverted");
  const cameraAssistance = useSettingsStore((state) => state.cameraAssistance);
  const eventFlags = useJourneyStore((state) => state.worldFlags);
  const eventIds = useJourneyStore((state) => state.completedStoryEventIds);
  const witnessedEntryIds = useJourneyStore((state) => state.witnessedEntryIds);
  const reducedMotion = useSettingsStore((state) => state.reducedMotion);
  const audioEnabled = useSettingsStore((state) => state.audioEnabled);
  const showDebugOverlay = useMemo(() => shouldShowDebugOverlay() || qualityProfile.showDebugByDefault, [qualityProfile.showDebugByDefault]);
  const [approachingEntryId, setApproachingEntryId] = useState<string | null>(null);
  const [playerSpatial, setPlayerSpatial] = useState<PlayerSpatialWindow | null>(null);
  const lockedEntryIdSet = useMemo(() => new Set(lockedEntryIds), [lockedEntryIds]);
  const entry = useMemo(() => entries.find((candidate) => candidate.id === entryId) ?? entries[0], [entries, entryId]);
  const visualState = useMemo(
    () => entry ? resolveWorldVisualState({ entry, nearestEntry: entry, nearestDistance: 0, narrativeWorldState }) : null,
    [entry, narrativeWorldState],
  );
  const playerChapterDirector = useMemo(() => entry ? resolveChapterDirector(entry) : null, [entry]);
  const movementBaseSpeed = PLAYER_SPEED * (playerChapterDirector?.movementSpeedMultiplier ?? 1) * (1 - clamp01(narrativeWorldState.memoryPressure) * .055);
  const movementSpeed = useCallback(() => movementBaseSpeed / getCurrentCinematicProfile().movementWeight, [movementBaseSpeed]);
  const spatialNodes = useMemo(
    () => buildSpatialStoryNodes({ activeEntryId: entry?.id ?? entryId, entries, visitedEntryIds }),
    [entries, entry?.id, entryId, visitedEntryIds],
  );
  const activeNode = useMemo(() => spatialNodes.find((node) => node.isActive), [spatialNodes]);
  const activePosition: Vector3Tuple = activeNode?.position ?? [0, 0, 0];
  const pathSegments = useMemo(() => buildMazePathSegments(entries), [entries]);
  const explicitNavigationTargetNode = useMemo(
    () =>
      navigationTargetEntryId
        ? spatialNodes.find((node) => node.entry.id === navigationTargetEntryId)
        : undefined,
    [navigationTargetEntryId, spatialNodes],
  );
  const navigationTargetId =
    explicitNavigationTargetNode?.entry.id ??
    playerSpatial?.navigationTargetId ??
    approachingEntryId;
  const navigationTargetNode = useMemo(() => spatialNodes.find((node) => node.entry.id === navigationTargetId), [spatialNodes, navigationTargetId]);
  const navigationTargetPosition: Vector3Tuple | null = navigationTargetNode?.position ?? null;
  const playerFocusPosition = playerSpatial?.position ?? activePosition;
  const visibleStoryNodes = useMemo(
    () =>
      spatialNodes.filter((node) => {
        if (node.isActive || node.entry.id === navigationTargetId) return true;
        const dx = node.position[0] - playerFocusPosition[0];
        const dz = node.position[2] - playerFocusPosition[2];
        const distanceSq = dx * dx + dz * dz;
        if (distanceSq <= STORY_NODE_DETAIL_RADIUS * STORY_NODE_DETAIL_RADIUS) return node.graphDistance <= 1;
        return node.isVisited && distanceSq <= STORY_NODE_VISITED_RADIUS * STORY_NODE_VISITED_RADIUS;
      }),
    [spatialNodes, navigationTargetId, playerFocusPosition[0], playerFocusPosition[2]],
  );
  const visibleGatewayNodes = useMemo(
    () =>
      spatialNodes
        .filter((node) => {
          // Canonical narrative transitions are expressed by authored world
          // geometry (water, doors, paths, climbs, and the castle gate).
          // EnvironmentalThreshold remains only as a compatibility fallback
          // for content that has no twelve-chapter narrative context.
          if (getJourneyEntryContext(node.entry.id)) return false;
          if (node.isActive) return false;
          if (approachingEntryId === node.entry.id || node.entry.id === navigationTargetId) return true;
          const dx = node.position[0] - playerFocusPosition[0];
          const dz = node.position[2] - playerFocusPosition[2];
          const distanceSq = dx * dx + dz * dz;
          if (distanceSq <= GATEWAY_VISIBILITY_RADIUS * GATEWAY_VISIBILITY_RADIUS) return node.graphDistance <= 1;
          return node.isVisited && distanceSq <= GATEWAY_VISITED_RADIUS * GATEWAY_VISITED_RADIUS;
        })
        .sort((a, b) => {
          const rankA = a.isActive ? -3 : a.entry.id === navigationTargetId ? -2 : approachingEntryId === a.entry.id ? -1 : 0;
          const rankB = b.isActive ? -3 : b.entry.id === navigationTargetId ? -2 : approachingEntryId === b.entry.id ? -1 : 0;
          if (rankA !== rankB) return rankA - rankB;
          const da = (a.position[0] - playerFocusPosition[0]) ** 2 + (a.position[2] - playerFocusPosition[2]) ** 2;
          const db = (b.position[0] - playerFocusPosition[0]) ** 2 + (b.position[2] - playerFocusPosition[2]) ** 2;
          return da - db;
        })
        .slice(0, 3),
    [spatialNodes, approachingEntryId, navigationTargetId, playerFocusPosition[0], playerFocusPosition[2]],
  );
  const terrainMorph = useMemo(
    () => ({
      memoryPressure: narrativeWorldState.memoryPressure,
      explorationDepth: narrativeWorldState.explorationDepth,
    }),
    [narrativeWorldState.memoryPressure, narrativeWorldState.explorationDepth],
  );

  const sampleGroundY = useCallback(
    (x: number, z: number) => TERRAIN_BASE_Y + terrainElevationAtPoint(x, z, entries, pathSegments, terrainMorph),
    [entries, pathSegments, terrainMorph],
  );
  const narrativeScene = useMemo(
    () => (entry ? getJourneySceneForEntry(entry.id) : undefined),
    [entry],
  );
  const runtimeHost = useStoryRuntimeHost();
  const sceneRelocationRevision = useJourneyStore(state => state.sceneRelocationRevision);
  const observation = useCallback(() => narrativeScene ? runtimeHost?.physicalBinding({
    entryId: entry.id, sceneId: narrativeScene.id, revision: sceneRelocationRevision,
  }) ?? null : null, [runtimeHost, entry.id, narrativeScene, sceneRelocationRevision]);
  const handleObservedClearing = useCallback((facts: {
    active: { id: string } | null; nearest: { id: string } | null; insideClearing: boolean;
    nearestInactive: { id: string; position: Vector3Tuple } | null;
  }) => {
    if (!narrativeScene || !runtimeHost) return;
    const scope = { entryId: entry.id, sceneId: narrativeScene.id, revision: sceneRelocationRevision };
    runtimeHost.observeClearingPresence(scope, facts.active?.id === entry.id && facts.nearest?.id === entry.id && facts.insideClearing);
    if (facts.nearestInactive) runtimeHost.observeThresholdDistance(scope, facts.nearestInactive.id,
      facts.nearestInactive.position, NODE_ACTIVATION_RADIUS_SQ);
  }, [runtimeHost, entry.id, narrativeScene, sceneRelocationRevision]);
  const handleObservedThreshold = useCallback((targetEntryId: string) => {
    if (runtimeHost && narrativeScene && !observation()) return false;
    onPortalSelect?.(targetEntryId);
    // The DOM scheduler admits this report asynchronously; keep reporting until
    // the canonical target becomes active, including after a suspended receipt.
    if (runtimeHost && narrativeScene) return false;
  }, [runtimeHost, narrativeScene, observation, onPortalSelect]);
  const sceneManifest = useMemo(() => getSceneManifestForEntry(entry.id), [entry.id]);
  const cameraPresentationEnabled = useCallback(() => {
    const state = useWorldStore.getState();
    return cameraPresentationActive({ visible: !document.hidden, focused: document.hasFocus(), overlayOpen: useSettingsStore.getState().drawerOpen,
      mode: state.mode, controls: state.controls, physicsPaused: state.physicsPaused, sceneCurrent: useJourneyStore.getState().sceneId === narrativeScene?.id });
  }, [narrativeScene?.id]);
  const narrativeSceneAnchor = useMemo(
    () => narrativeScene
      ? getJourneyEntryWorldPosition(narrativeScene.keystoneEntryId)
      : undefined,
    [narrativeScene],
  );
  const authoredSceneOrigin = useMemo<Vector3Tuple>(
    () => [
      narrativeSceneAnchor?.[0] ?? activePosition[0],
      sampleGroundY(
        narrativeSceneAnchor?.[0] ?? activePosition[0],
        narrativeSceneAnchor?.[2] ?? activePosition[2],
      ) + 0.2,
      narrativeSceneAnchor?.[2] ?? activePosition[2],
    ],
    [activePosition, narrativeSceneAnchor, sampleGroundY],
  );
  const openingResolved = Boolean(
    storyWorldMemory?.inventory.lantern ||
      storyWorldMemory?.completedRitualIds?.includes("ritual.accept-lantern"),
  );
  const exteriorVisible = !openingEnclosed(narrativeScene?.id, openingResolved || openingReflectionInverted);

  const start = entry?.engine3d.cameraStart ?? DEFAULT_CAMERA_POSITION;
  const authoredArrival = useMemo(() => sceneManifest && mode === "explore" && controls === "walk"
    ? resolveSceneManifestArrival(sceneManifest, authoredSceneOrigin, sceneManifest.layout.anchor.headingRadians)
    : null, [sceneManifest, mode, controls, authoredSceneOrigin]);
  const playerSpawnX = authoredArrival?.position[0] ?? activePosition[0] + start[0];
  const playerSpawnZ = authoredArrival?.position[2] ?? activePosition[2] + start[2];
  const playerSpawnGroundY = sampleGroundY(playerSpawnX, playerSpawnZ);
  const defaultPlayerInitialPosition: Vector3Tuple = [
    playerSpawnX,
    playerSpawnGroundY + PLAYER_FOOT_OFFSET + PLAYER_GROUND_CLEARANCE,
    playerSpawnZ,
  ];
  const playerInitialPosition = useMemo<Vector3Tuple>(() => {
    if (
      !initialPlayerPosition ||
      initialPlayerPosition.length !== 3 ||
      !initialPlayerPosition.every(
        (coordinate) =>
          Number.isFinite(coordinate) && Math.abs(coordinate) <= 10_000,
      )
    ) {
      return defaultPlayerInitialPosition;
    }

    const dx = initialPlayerPosition[0] - activePosition[0];
    const dz = initialPlayerPosition[2] - activePosition[2];
    const maximumSavedDistance = Math.max(
      18,
      (entry?.engine3d.environmentRadius ?? DEFAULT_ENVIRONMENT_RADIUS) * 0.6,
    );
    if (dx * dx + dz * dz > maximumSavedDistance * maximumSavedDistance) {
      return defaultPlayerInitialPosition;
    }

    const savedGroundY = sampleGroundY(
      initialPlayerPosition[0],
      initialPlayerPosition[2],
    );
    const expectedCameraY =
      savedGroundY +
      PLAYER_FOOT_OFFSET +
      PLAYER_GROUND_CLEARANCE +
      PLAYER_CAMERA_OFFSET_Y;
    if (Math.abs(initialPlayerPosition[1] - expectedCameraY) > 12) {
      return defaultPlayerInitialPosition;
    }

    return [
      initialPlayerPosition[0],
      savedGroundY + PLAYER_FOOT_OFFSET + PLAYER_GROUND_CLEARANCE,
      initialPlayerPosition[2],
    ];
  }, [
    activePosition,
    defaultPlayerInitialPosition,
    entry?.engine3d.environmentRadius,
    initialPlayerPosition,
    sampleGroundY,
  ]);

  const cameraGuidanceTarget = useMemo<Vector3Tuple | null>(() => {
    if (!entry) return null;
    if (authoredArrival) return authoredArrival.focus;

    const segment = guidedPathSegment(
      pathSegments,
      entry.id,
      navigationTargetId,
    );

    if (!segment) {
      return navigationTargetPosition
        ? [
            navigationTargetPosition[0],
            sampleGroundY(
              navigationTargetPosition[0],
              navigationTargetPosition[2],
            ) + PLAYER_EYE_HEIGHT * 0.9,
            navigationTargetPosition[2],
          ]
        : null;
    }

    const activeIsSource = segment.sourceEntry.id === entry.id;
    const projectionT = segmentProjectionT(
      playerInitialPosition[0],
      playerInitialPosition[2],
      segment,
      terrainMorph,
    );
    const direction = activeIsSource ? 1 : -1;
    const lookAheadT = Math.min(0.28, 8 / Math.max(1, segment.curveLength));
    const targetT = THREE.MathUtils.clamp(
      projectionT + direction * lookAheadT,
      0,
      1,
    );
    const point = curvedPathPointAt(segment, targetT, terrainMorph);

    return [
      point.x,
      sampleGroundY(point.x, point.y) + PLAYER_EYE_HEIGHT * 0.9,
      point.y,
    ];
  }, [
    entry,
    authoredArrival,
    navigationTargetId,
    navigationTargetPosition,
    pathSegments,
    playerInitialPosition,
    sampleGroundY,
    terrainMorph,
  ]);

  if (!entry || !visualState) {
    return (
      <Html center>
        <div className="slipper-scene-error">Story node not found: {entryId}</div>
      </Html>
    );
  }

  const activeRadius = entry.engine3d.environmentRadius ?? DEFAULT_ENVIRONMENT_RADIUS;

  const world = (
    <>
      {reducedEffects || narrativeScene ? null : (
        <CinematicFrameOverlay visualState={visualState} narrativeWorldState={narrativeWorldState} qualityProfile={qualityProfile} />
      )}
      <CameraController
        mode={mode} controls={controls} movementEnabled={openingResolved} cameraReadyRef={cameraReadyRef} pose={playerPoseRef}
        activePosition={activePosition} playerInitialPosition={playerInitialPosition}
        cameraStart={entry.engine3d.cameraStart ?? DEFAULT_CAMERA_POSITION} cameraTarget={entry.engine3d.cameraTarget ?? [0, 0, -1]}
        fov={entry.engine3d.cameraFov ?? DEFAULT_FOV} guidanceLookTarget={cameraGuidanceTarget}
        lowView={entry.id === "fragment-001" && !openingResolved} bobSuppression={1 - clamp01(narrativeWorldState.memoryPressure) * .18}
        reducedMotion={reducedMotion} reducedEffects={reducedEffects} sceneId={narrativeScene?.id ?? null} cameraAssistance={cameraAssistance}
        openingShotOwned={narrativeScene?.id === "broken-floor.confession" && !openingReflectionInverted}
        presentationActive={cameraPresentationEnabled} inputActive={physicalInputActive}
        observation={observation}
      />
      {/* Authored chapters already frame their footprint. The legacy eight-metre
          ring put trunks and colliders through water, furniture and sightlines. */}
      <ContinuousForestBed entries={entries} pathSegments={pathSegments} narrativeWorldState={narrativeWorldState} activeEntry={entry} qualityProfile={qualityProfile} showClearingFrame={openingResolved && !narrativeScene} renderVisible={exteriorVisible} />
      <PlayerController
        enabled={mode === "explore" && controls === "walk"}
        movementEnabled={openingResolved}
        cameraReadyRef={cameraReadyRef}
        initialPosition={playerInitialPosition}
        movementSpeed={movementSpeed}
        pose={playerPoseRef}
        inputActive={physicalInputActive}
        sampleGroundY={sampleGroundY}
      />
      {exteriorVisible && narrativeScene ? <WillowRefuge quality={qualityProfile.quality} sampleGroundY={sampleGroundY} explorationDepth={narrativeWorldState.explorationDepth} memoryPressure={narrativeWorldState.memoryPressure} /> : null}
      <JourneyWorldComposition
        activeSceneId={narrativeScene?.id}
        activeOrigin={authoredSceneOrigin}
        qualityProfile={qualityProfile}
        reducedEffects={reducedEffects}
        reducedMotion={reducedMotion}
        renderAdjacent={exteriorVisible}
        sampleGroundY={sampleGroundY}
        interactionsEnabled={mode === "explore"}
        quietGuidanceActivity={quietGuidanceActivity}
        openingResolved={openingResolved}
        onFinalConstellationFormationComplete={
          onFinalConstellationFormationComplete
        }
      />
      {narrativeScene && mode === "explore" ? <>
        <SpatialProseDirector entry={entry} scene={narrativeScene} position={authoredSceneOrigin} headingRadians={getJourneySceneLayout(narrativeScene.id).anchor.headingRadians} active witnessed={witnessedEntryIds.includes(entry.id)} reducedMotion={reducedMotion}
          suppressed={narrativeScene.id === "broken-floor.confession" && !eventIds.includes("broken-floor.first-wipe")} />
      </> : null}
      {/* MasterPlayerLantern is mounted by StorySceneWithMasterLantern and is the sole carried lantern. */}
      {audioEnabled && !narrativeAudioSuppressed && mode === "explore" ? (
        <NarrativeAudioDirector qualityProfile={qualityProfile} approachTarget={
          navigationTargetNode ? createAudioApproachTarget(
            narrativeScene?.id ?? "", navigationTargetNode.entry.id, navigationTargetNode.position,
            useJourneyStore.getState(),
          ) : null
        } />
      ) : null}
      <GuidanceController
        nodes={spatialNodes}
        pathSegments={pathSegments}
        visitedEntryIds={visitedEntryIds}
        lockedEntryIds={lockedEntryIds}
        explicitNavigationTargetId={explicitNavigationTargetNode?.entry.id}
        controls={controls}
        mode={mode}
        onNodeEnter={handleObservedThreshold}
        onApproachChange={setApproachingEntryId}
        onPlayerProximityChange={onPlayerProximityChange}
        onPhysicalPresence={handleObservedClearing}
        onPlayerSpatialChange={setPlayerSpatial}
      />
      {/* FALLBACK PRESENTATION ONLY: canonical atmosphere, fill, sky and finishing
          are owned by SceneLookDirector below. These legacy rigs must stay gated. */}
      {narrativeScene ? null : <LegacySceneAtmosphere entry={entry} entries={entries} narrativeWorldState={narrativeWorldState} qualityProfile={qualityProfile} />}
      {reducedEffects || narrativeScene ? null : (
        <BiomeWeatherField activeEntry={entry} narrativeWorldState={narrativeWorldState} visualState={visualState} qualityProfile={qualityProfile} />
      )}
      {narrativeScene ? null : <NarrativeLightingRig visualState={visualState} qualityProfile={qualityProfile} />}
      {openingResolved ? (
        <>
          <LivingPathRibbon qualityProfile={qualityProfile} pathSegments={pathSegments} activeEntry={entry} navigationTargetId={navigationTargetId} narrativeWorldState={narrativeWorldState} sampleGroundY={sampleGroundY} />
          <MoonlitPathUnderstory pathSegments={pathSegments} activeEntry={entry} navigationTargetId={navigationTargetId} narrativeWorldState={narrativeWorldState} qualityProfile={qualityProfile} sampleGroundY={sampleGroundY} />
          {reducedEffects || narrativeScene ? null : (
            <PathLightMotes pathSegments={pathSegments} activeEntry={entry} navigationTargetId={navigationTargetId} visualState={visualState} narrativeWorldState={narrativeWorldState} qualityProfile={qualityProfile} sampleGroundY={sampleGroundY} />
          )}
          {reducedEffects || narrativeScene ? null : (
            <LivingPathMist pathSegments={pathSegments} activeEntry={entry} navigationTargetId={navigationTargetId} narrativeWorldState={narrativeWorldState} qualityProfile={qualityProfile} sampleGroundY={sampleGroundY} />
          )}
          {usesAuthoredCausalComposition(entry.id) ? null : (
            <MemoryBloomLandmark pathSegments={pathSegments} activeEntry={entry} navigationTargetId={navigationTargetId} narrativeWorldState={narrativeWorldState} qualityProfile={qualityProfile} sampleGroundY={sampleGroundY} />
          )}
          {!eventFlags["story-events.started"] ? <>
          <ClearingLightHalo nodes={spatialNodes} navigationTargetId={navigationTargetId} approachingEntryId={approachingEntryId} visualState={visualState} narrativeWorldState={narrativeWorldState} qualityProfile={qualityProfile} />
          <ChapterLandmarks entries={entries} activeEntry={entry} qualityProfile={qualityProfile} />
          {storyWorldMemory ? <WorldMemoryDirector entries={entries} state={storyWorldMemory} /> : null}
          </> : null}
        </>
      ) : null}
      {narrativeScene ? null : <ProceduralDome
        entry={entry}
        visualState={visualState}
        radius={Math.max(232, activeRadius * 4.8)}
        narrativeWorldState={narrativeWorldState}
        qualityProfile={qualityProfile}
      />
      }
      {narrativeScene ? null : <AtmosphericForestPanorama
        radius={Math.max(182, activeRadius * 3.8)}
        visualState={visualState}
        showDepthPlate={visualState.biome === "firstWood" && qualityProfile.quality !== "low"}
      />}
      <group name="distant-woodland-visibility" visible={exteriorVisible}>
        {narrativeScene ? <DistantWoodland origin={authoredSceneOrigin} quality={qualityProfile.quality} sampleGroundY={sampleGroundY} quiet={narrativeScene.id === "epilogue.constellation"} />
          : <DistantForestSilhouetteRing visualState={visualState} qualityProfile={qualityProfile} />}
      </group>
      {fallbackEnvironmentSrc ? <EnvironmentSphere src={fallbackEnvironmentSrc} radius={activeRadius * 0.98} /> : null}
      {openingResolved ? (
        <>
          <PlayerBreadcrumbRecorder entries={entries} activeEntry={entry} narrativeWorldState={narrativeWorldState} pathSegments={pathSegments} controls={controls} mode={mode} qualityProfile={qualityProfile} />
          <PersistentEnvironmentalBreadcrumbs qualityProfile={qualityProfile} narrativeWorldState={narrativeWorldState} />
          <NarrativeGroundTrails entries={entries} pathSegments={pathSegments} narrativeWorldState={narrativeWorldState} activeEntry={entry} qualityProfile={qualityProfile} visitedEntryIds={visitedEntryIds} navigationTargetId={navigationTargetId} />
          {reducedEffects ? null : (
            <NarrativeGroundDetailField entries={entries} pathSegments={pathSegments} activeEntry={entry} narrativeWorldState={narrativeWorldState} qualityProfile={qualityProfile} />
          )}
          {narrativeScene ? null : <SemanticObjectPathing entries={entries} pathSegments={pathSegments} narrativeWorldState={narrativeWorldState} activeEntry={entry} qualityProfile={qualityProfile} visitedEntryIds={visitedEntryIds} navigationTargetId={navigationTargetId} />}
          {reducedEffects || narrativeScene ? null : (
            <NarrativeWhisperField entry={entry} narrativeWorldState={narrativeWorldState} qualityProfile={qualityProfile} />
          )}
          {visibleStoryNodes.map((node) => (
            <WorldStoryNode
              key={node.entry.id}
              node={node}
              visual={node.isActive && !getJourneySceneForEntry(node.entry.id) && witnessedEntryIds.includes(node.entry.id)
                ? visuals.find(visual => visual.id === node.entry.engine3d.linkedVisualId) : undefined}
              activeEntry={entry}
              narrativeWorldState={narrativeWorldState}
              mode={mode}
              qualityProfile={qualityProfile}
            />
          ))}
          {mode === "explore"
            ? visibleGatewayNodes.map((node) => (
                <EnvironmentalThreshold
                  key={'gateway-' + node.entry.id}
                  position={node.position}
                  chapter={node.entry.chapter}
                  chapterLabel={getJourneyChapterForEntry(node.entry.id)?.title}
                  title={node.entry.title}
                  color={node.entry.engine3d.environmentGradient?.[2] ?? "#d8d0ba"}
                  isApproaching={approachingEntryId === node.entry.id || navigationTargetId === node.entry.id}
                  isVisited={node.isVisited}
                  locked={lockedEntryIdSet.has(node.entry.id)}
                  rotationY={thresholdRotationForNode(node, pathSegments)}
                />
              ))
            : null}
        </>
      ) : null}
      {showDebugOverlay ? <SceneDebugOverlay entry={entry} narrativeWorldState={narrativeWorldState} qualityProfile={qualityProfile} visualState={visualState} nodes={spatialNodes} /> : null}
    </>
  );
  // Include the wrapper-provided lantern and compatibility/debug helpers under this same
  // owner. Keeping origin/camera resolution here avoids a second scene-state tree.
  return narrativeScene ? <SceneLookDirector sceneId={narrativeScene.id} quality={qualityProfile.quality} reducedEffects={reducedEffects} reducedMotion={reducedMotion}
    particlesEnabled={ambientParticlesEnabled} particleScale={qualityProfile.particleMultiplier} origin={authoredSceneOrigin} heading={getJourneySceneLayout(narrativeScene.id).anchor.headingRadians}
    bloomIntensity={visualState.bloomIntensity} vignetteIntensity={visualState.vignetteIntensity}>{children}{world}</SceneLookDirector> : <>{children}{world}</>;
}

export default memo(StoryScene);
