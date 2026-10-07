import type { QuietGuidanceActivity } from "../../ui/quietGuidancePresentation";
import { CinematicFrameOverlay } from "./artDirection/LegacyFrameOverlay";
import { useCompressedGLTF } from "../../lib/assets/gltfLoaders";
import { cloneNpcPresentation, isPlaceholderNpcAsset } from "../../lib/assets/npcAssetPolicy";
import { AuthoredNpcSilhouette } from "./environmentArt/AuthoredNpc";
import { useJourneyStore } from "../../stores/useJourneyStore";
import { getCurrentCinematicProfile } from "../../cinematics/emotionalCinematography";
import { getSceneManifestForEntry, resolveSceneManifestArrival } from "../../narrative/StoryManifest";
import { useStoryRuntimeHost } from "../../experience/StoryRuntimeContext";
import { openingEnclosed } from "../../cinematics/openingPresentation";
import { SceneLookDirector } from "./artDirection/SceneLookDirector";
import { SpatialProseDirector } from "./storyText/SpatialProseDirector";
import { Component, memo, Suspense, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type ErrorInfo, type ReactNode } from "react";
import { Float, Html, useTexture } from "@react-three/drei";
import { BallCollider, InstancedRigidBodies } from "@react-three/rapier";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { DistantWoodland } from "./environment/DistantWoodland";
import { ProceduralDome } from "./environment/ProceduralDome";
import type { EulerTuple, Slipper3DEntry, Slipper3DVisual, Vector3Tuple } from "../../data/slipper3dTypes";
import { getJourneyChapterForEntry, getJourneyEntryContext, getJourneySceneForEntry } from "../../data/journeyNarrative";
import { getJourneySceneLayout, getJourneyEntryWorldPosition } from "../../data/journeyWorldLayout";
import NarrativeAudioDirector from "./audio/NarrativeAudioDirector";
import EnvironmentalThreshold from "./journey/EnvironmentalThreshold";
import JourneyWorldComposition from "./journey/JourneyWorldComposition";
import WorldMemoryDirector, { type WorldMemoryState } from "./worldMemory/WorldMemoryDirector";
import { resolveWorldVisualState, type WorldVisualState } from "./worldVisualState";
import { resolveChapterDirector } from "./chapterDirector";
import { resolveNarrativeRenderScale, shouldShowDebugOverlay, type RenderQualityProfile } from "./renderQuality";
import { classifyRouteSegment, nearestPathStatus, routeClassWeight, yawFromDirection, type TrailState } from "../../lib/navigationResolver";
import { useBreadcrumbStore, type BreadcrumbKind, type BreadcrumbTrace } from "../../stores/useBreadcrumbStore";
import { useSettingsStore } from "../../stores/useSettingsStore";
import type { PlayerControls as StorySceneControls, ExperienceMode as StorySceneMode } from "../../player/playerTypes";
import { createPlayerPose } from "../../player/playerTypes";
import { PlayerController } from "../../player/PlayerController";
import { CameraController } from "../../player/CameraController";
import { PLAYER_FOOT_OFFSET, PLAYER_GROUND_CLEARANCE, PLAYER_SPEED } from "../../player/playerMovement";
import { PLAYER_CAMERA_OFFSET_Y, PLAYER_EYE_HEIGHT } from "../../player/cameraModel";
import { cameraPresentationActive } from "../../cinematics/shotComposition";
import { NODE_ACTIVATION_RADIUS_SQ } from "../../player/interactionProximity";
import { useWorldStore } from "../../stores/useWorldStore";
import { GuidanceController } from "../../world/guidance/GuidanceController";
import type { PlayerSpatialWindow, SceneProximityState } from "../../world/guidance/guidanceTypes";
import { type NarrativeWorldState } from "../../world/worldTypes.ts";
import { clamp01, hashString, seededUnit, worldSeededUnit } from "../../world/worldMath.ts";
import { allClearingPositions, buildSpatialStoryNodes, chapterBiome, chapterProgress, entryWorldPosition, isChapter, nearestEntryByXZ, type ChapterBiome, type SpatialStoryNode } from "../../world/terrain/worldPlacement.ts";
import { CHAPTER_BLUE_MOON_ARCHIVE, CHAPTER_CROWNED_RETURN, CHAPTER_FIRE_AND_RIVER, CHAPTER_MIRROR_CLEARING, CHAPTER_THORNED_HOUSE, CLEARING_SAFE_RADIUS, CORRIDOR_BASE_WIDTH, CORRIDOR_MIN_WIDTH, DEFAULT_ENVIRONMENT_RADIUS, TERRAIN_BASE_Y } from "../../world/terrain/worldConstants.ts";
import { EnvironmentSphere } from "../../world/atmosphere/EnvironmentSphere.tsx";
import { SEMANTIC_PATH_THEMES, countPatternMatches, dominantSemanticTheme, entrySemanticSignal, type SemanticPathTheme } from "../../world/worldSemantics.ts";
import { buildMazePathSegments, curvedPathPointAt, curvedPathTangentAt, nearestMazePathSegment, pathSegmentAngle, segmentProjectionT, type MazePathSegment } from "../../world/terrain/worldPaths.ts";
import { terrainElevationAtPoint } from "../../world/terrain/terrainSampler.ts";
import { isIntegratedFinaleEntry, usesAuthoredCausalComposition } from "../../world/worldPresentationPolicy.ts";
import { NarrativeWeather } from "../../world/atmosphere/NarrativeWeather.tsx";
import { guidedPathSegment } from "../../world/guidance/routeGeometry.ts";
import { ContinuousForestBed } from "../../world/forest/ContinuousForestBed.tsx";
import { LegacySceneAtmosphere } from "../../world/atmosphere/LegacySceneAtmosphere.tsx";
import { BiomeWeatherField } from "../../world/atmosphere/BiomeWeatherField.tsx";
import { NarrativeLightingRig } from "../../world/lighting/NarrativeLightingRig.tsx";
import { LivingPathRibbon } from "../../world/guidance/LivingPathRibbon.tsx";
import { MoonlitPathUnderstory } from "../../world/guidance/MoonlitPathUnderstory.tsx";
import { PathLightMotes } from "../../world/guidance/PathLightMotes.tsx";
import { LivingPathMist } from "../../world/atmosphere/LivingPathMist.tsx";
import { MemoryBloomLandmark } from "../../world/guidance/MemoryBloomLandmark.tsx";
import { ClearingLightHalo } from "../../world/guidance/ClearingLightHalo.tsx";
import { AtmosphericForestPanorama } from "../../world/atmosphere/AtmosphericForestPanorama.tsx";
import { DistantForestSilhouetteRing } from "../../world/atmosphere/DistantForestSilhouetteRing.tsx";
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

const DECORATION_CELL_SIZE = 5.5;
const DECORATION_CELL_RADIUS = 4;
const DECORATIONS_PER_CELL = 2;
const DECORATION_INSTANCE_COUNT = (DECORATION_CELL_RADIUS * 2 + 1) * (DECORATION_CELL_RADIUS * 2 + 1) * DECORATIONS_PER_CELL;
const GROUND_DETAIL_CELL_SIZE = 6.4;
const GROUND_DETAIL_CELL_RADIUS = 3;
const GROUND_DETAILS_PER_CELL = 2;
const GROUND_DETAIL_INSTANCE_COUNT = (GROUND_DETAIL_CELL_RADIUS * 2 + 1) * (GROUND_DETAIL_CELL_RADIUS * 2 + 1) * GROUND_DETAILS_PER_CELL;

const SEMANTIC_REBUILD_MIN_INTERVAL = 0.18;
const SEMANTIC_SENSOR_LIMIT = 16;

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

function MemoryShrine({ visual, entry }: { visual: Slipper3DVisual; entry: Slipper3DEntry }) {
  const texture = useTexture(visual.src);
  const isSquare = visual.orientation === "square";
  const width = isSquare ? 2.45 : 1.72;
  const height = isSquare ? 2.45 : 2.75;
  const z = entry.engine3d.sceneKind === "archive" ? -6.7 : -6.15;
  const color = entry.engine3d.environmentGradient?.[2] ?? "#d8d0ba";

  useEffect(() => {
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.wrapS = THREE.ClampToEdgeWrapping;
    texture.wrapT = THREE.ClampToEdgeWrapping;
    texture.needsUpdate = true;
  }, [texture]);

  return (
    <group position={[0, 0.42, z]}>
      <mesh position={[0, 0, -0.055]}>
        <planeGeometry args={[width + 0.58, height + 0.58]} />
        <meshBasicMaterial color="#050506" transparent opacity={0.7} />
      </mesh>
      <mesh position={[0, 0, -0.034]}>
        <planeGeometry args={[width + 0.28, height + 0.28]} />
        <meshBasicMaterial color={color} transparent opacity={0.18} />
      </mesh>
      <mesh position={[-width * 0.68, 0.05, -0.02]} rotation={[0, 0, -0.08]}>
        <planeGeometry args={[0.28, height * 0.86]} />
        <meshBasicMaterial color={color} transparent opacity={0.085} side={THREE.DoubleSide} />
      </mesh>
      <mesh position={[width * 0.68, -0.04, -0.02]} rotation={[0, 0, 0.08]}>
        <planeGeometry args={[0.28, height * 0.86]} />
        <meshBasicMaterial color={color} transparent opacity={0.085} side={THREE.DoubleSide} />
      </mesh>
      <mesh>
        <planeGeometry args={[width, height]} />
        <meshBasicMaterial map={texture} toneMapped={false} transparent opacity={0.94} />
      </mesh>
      <mesh position={[0, -height * 0.58, 0.02]} rotation={[Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.72, 1.22, 96]} />
        <meshBasicMaterial color={color} transparent opacity={0.1} side={THREE.DoubleSide} />
      </mesh>
      <Html transform center position={[0, -height * 0.66, 0.04]} distanceFactor={1.28} zIndexRange={[8, 0]}>
        <div className="slipper-visual-plaque">
          <span>{visual.orientation}</span>
          <strong>{visual.alt ?? entry.title}</strong>
        </div>
      </Html>
    </group>
  );
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

type GroundDetailKind = "root" | "leaf" | "stone" | "puddle" | "ash" | "gold";

function groundDetailKindForBiome(biome: ChapterBiome, roll: number): GroundDetailKind {
  if (biome === "mirror") return roll < 0.42 ? "puddle" : roll < 0.68 ? "stone" : "leaf";
  if (biome === "thorned") return roll < 0.44 ? "ash" : roll < 0.78 ? "root" : "stone";
  if (biome === "archive") return roll < 0.48 ? "leaf" : roll < 0.74 ? "stone" : "gold";
  if (biome === "fireRiver") return roll < 0.34 ? "ash" : roll < 0.58 ? "puddle" : roll < 0.82 ? "root" : "gold";
  if (biome === "crowned") return roll < 0.56 ? "gold" : roll < 0.78 ? "leaf" : "stone";
  return roll < 0.42 ? "root" : roll < 0.74 ? "leaf" : "stone";
}

function groundDetailTint(kind: GroundDetailKind, visualState: WorldVisualState) {
  if (kind === "root") return visualState.biome === "firstWood" ? "#46372d" : visualState.palette.trunk;
  if (kind === "leaf") return visualState.biome === "archive" ? "#f2e7ce" : visualState.palette.leaf;
  if (kind === "stone") return visualState.biome === "mirror" ? "#8daab0" : "#6d6254";
  if (kind === "puddle") return visualState.biome === "fireRiver" ? "#6aa7b8" : "#9fd4dd";
  if (kind === "ash") return visualState.biome === "thorned" ? "#4e3b33" : "#6c5445";
  return "#e2bd63";
}

function useGroundDetailGeometries() {
  const geometries = useMemo(
    () => ({
      root: new THREE.CylinderGeometry(0.055, 0.085, 1, 6),
      leaf: new THREE.PlaneGeometry(0.62, 0.28, 1, 1),
      stone: new THREE.DodecahedronGeometry(0.32, 0),
      puddle: new THREE.CircleGeometry(1, 36),
      ash: new THREE.CircleGeometry(0.8, 24),
      gold: new THREE.RingGeometry(0.28, 0.42, 32),
    }),
    [],
  );

  useEffect(
    () => () => {
      Object.values(geometries).forEach((geometry) => geometry.dispose());
    },
    [geometries],
  );

  return geometries;
}

function NarrativeGroundDetailField({
  entries,
  pathSegments,
  activeEntry,
  narrativeWorldState,
  qualityProfile,
}: {
  entries: Slipper3DEntry[];
  pathSegments: MazePathSegment[];
  activeEntry: Slipper3DEntry;
  narrativeWorldState: NarrativeWorldState;
  qualityProfile: RenderQualityProfile;
}) {
  const { camera } = useThree();
  const rootRef = useRef<THREE.InstancedMesh>(null);
  const leafRef = useRef<THREE.InstancedMesh>(null);
  const stoneRef = useRef<THREE.InstancedMesh>(null);
  const puddleRef = useRef<THREE.InstancedMesh>(null);
  const ashRef = useRef<THREE.InstancedMesh>(null);
  const goldRef = useRef<THREE.InstancedMesh>(null);
  const dummyRef = useRef(new THREE.Object3D());
  const lastCellRef = useRef({
    cellX: Number.NaN,
    cellZ: Number.NaN,
    biome: "",
    quality: "",
    memory: Number.NaN,
    depth: Number.NaN,
  });
  const visualState = useMemo(
    () => resolveWorldVisualState({ entry: activeEntry, narrativeWorldState }),
    [activeEntry, narrativeWorldState],
  );
  const geometries = useGroundDetailGeometries();
  const terrainMorph = useMemo(
    () => ({
      memoryPressure: narrativeWorldState.memoryPressure,
      explorationDepth: narrativeWorldState.explorationDepth,
    }),
    [narrativeWorldState.memoryPressure, narrativeWorldState.explorationDepth],
  );

  useLayoutEffect(() => {
    // An animation frame can precede passive effects. Reconnecting a retained
    // layout also needs a fresh build after resetting its populated batches.
    lastCellRef.current = {
      cellX: Number.NaN, cellZ: Number.NaN, biome: "", quality: "",
      memory: Number.NaN, depth: Number.NaN,
    };
    for (const mesh of [rootRef.current, leafRef.current, stoneRef.current, puddleRef.current, ashRef.current, goldRef.current]) {
      if (!mesh) continue;
      mesh.count = 0;
      mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    }
  }, []);

  const finalizeGroundMeshes = (counts: Record<GroundDetailKind, number>) => {
    const targets: Array<[THREE.InstancedMesh | null, GroundDetailKind]> = [
      [rootRef.current, "root"],
      [leafRef.current, "leaf"],
      [stoneRef.current, "stone"],
      [puddleRef.current, "puddle"],
      [ashRef.current, "ash"],
      [goldRef.current, "gold"],
    ];

    for (const [mesh, kind] of targets) {
      if (!mesh) continue;
      mesh.count = counts[kind];
      mesh.instanceMatrix.needsUpdate = true;
      mesh.computeBoundingSphere();
    }
  };

  const rebuildGroundDetails = (cellX: number, cellZ: number) => {
    const refs: Record<GroundDetailKind, { current: THREE.InstancedMesh | null }> = {
      root: rootRef,
      leaf: leafRef,
      stone: stoneRef,
      puddle: puddleRef,
      ash: ashRef,
      gold: goldRef,
    };
    const counts: Record<GroundDetailKind, number> = {
      root: 0,
      leaf: 0,
      stone: 0,
      puddle: 0,
      ash: 0,
      gold: 0,
    };
    const dummy = dummyRef.current;
    const radius = Math.max(2, Math.round(GROUND_DETAIL_CELL_RADIUS * (0.42 + qualityProfile.groundDetailMultiplier * 0.58)));
    const perCell = Math.max(1, Math.round(GROUND_DETAILS_PER_CELL * (0.6 + qualityProfile.groundDetailMultiplier * 0.6)));
    const density = visualState.groundDetailIntensity * qualityProfile.groundDetailMultiplier;
    const detailSeed = hashString(`${activeEntry.chapter}-${visualState.biome}`);

    for (let dx = -radius; dx <= radius; dx += 1) {
      for (let dz = -radius; dz <= radius; dz += 1) {
        const worldCellX = cellX + dx;
        const worldCellZ = cellZ + dz;

        for (let localIndex = 0; localIndex < perCell; localIndex += 1) {
          const roll = worldSeededUnit(worldCellX, worldCellZ, detailSeed + localIndex * 17.1);
          if (roll > density + 0.08) continue;

          const x = (worldCellX + worldSeededUnit(worldCellX, worldCellZ, detailSeed + localIndex * 3.3)) * GROUND_DETAIL_CELL_SIZE;
          const z = (worldCellZ + worldSeededUnit(worldCellX, worldCellZ, detailSeed + localIndex * 5.7)) * GROUND_DETAIL_CELL_SIZE;
          const nearestPath = nearestMazePathSegment(x, z, pathSegments, terrainMorph);
          const pathDistance = Math.sqrt(nearestPath.distanceSq);
          const nearPath = !!nearestPath.segment && pathDistance < CORRIDOR_BASE_WIDTH * (visualState.pathClarity > 0.8 ? 1.9 : 1.45);
          const clearingPenalty = nearestEntryByXZ(x, z, entries).distanceSq < CLEARING_SAFE_RADIUS * CLEARING_SAFE_RADIUS * 0.58;

          if (!nearPath && roll > density * 0.42) continue;
          if (clearingPenalty && roll > 0.22) continue;

          const kind = groundDetailKindForBiome(visualState.biome, worldSeededUnit(worldCellX, worldCellZ, detailSeed + localIndex * 11.9));
          const mesh = refs[kind].current;
          const index = counts[kind];
          if (!mesh || index >= GROUND_DETAIL_INSTANCE_COUNT) continue;

          const y = TERRAIN_BASE_Y + terrainElevationAtPoint(x, z, entries, pathSegments, terrainMorph);
          const angle = nearestPath.segment
            ? pathSegmentAngle(nearestPath.segment, nearestPath.projectionT, terrainMorph)
            : worldSeededUnit(worldCellX, worldCellZ, detailSeed + localIndex * 2.1) * Math.PI * 2;
          const edgeLift = nearPath ? THREE.MathUtils.smoothstep(pathDistance, CORRIDOR_BASE_WIDTH * 0.2, CORRIDOR_BASE_WIDTH * 1.7) : 0;
          const scaleJitter = 0.72 + worldSeededUnit(worldCellX, worldCellZ, detailSeed + localIndex * 13.4) * 0.68;
          const side = worldSeededUnit(worldCellX, worldCellZ, detailSeed + localIndex * 23.4) > 0.5 ? 1 : -1;

          dummy.position.set(x, y + 0.018 + edgeLift * 0.012, z);
          dummy.rotation.set(0, angle + side * (0.25 + roll * 0.7), 0);

          if (kind === "root") {
            dummy.rotation.set(0, angle + side * (0.25 + roll * 0.7), Math.PI / 2);
            dummy.scale.set(0.72 + scaleJitter * 0.38, 0.78 + scaleJitter * 1.05, 0.72 + scaleJitter * 0.38);
          } else if (kind === "leaf") {
            dummy.rotation.set(-Math.PI / 2 + (roll - 0.5) * 0.08, 0, angle + roll * Math.PI);
            dummy.scale.set(scaleJitter * 0.9, scaleJitter * 0.72, 1);
          } else if (kind === "stone") {
            dummy.position.y += 0.055;
            dummy.scale.set(scaleJitter * 0.32, scaleJitter * 0.18, scaleJitter * 0.26);
          } else if (kind === "puddle") {
            dummy.rotation.set(-Math.PI / 2, 0, angle);
            dummy.position.y += 0.012;
            dummy.scale.set(scaleJitter * 0.64, scaleJitter * 0.38, 1);
          } else if (kind === "ash") {
            dummy.rotation.set(-Math.PI / 2, 0, angle);
            dummy.position.y += 0.01;
            dummy.scale.set(scaleJitter * 0.52, scaleJitter * 0.34, 1);
          } else {
            dummy.rotation.set(-Math.PI / 2, 0, angle);
            dummy.position.y += 0.018 + visualState.pathGlowIntensity * 0.006;
            dummy.scale.set(scaleJitter * 0.48, scaleJitter * 0.48, 1);
          }

          dummy.updateMatrix();
          mesh.setMatrixAt(index, dummy.matrix);
          counts[kind] += 1;
        }
      }
    }

    finalizeGroundMeshes(counts);
  };

  useFrame(() => {
    const cellX = Math.floor(camera.position.x / GROUND_DETAIL_CELL_SIZE);
    const cellZ = Math.floor(camera.position.z / GROUND_DETAIL_CELL_SIZE);
    const quality = qualityProfile.quality;
    const memory = Math.round(narrativeWorldState.memoryPressure * 20);
    const depth = Math.round(narrativeWorldState.explorationDepth * 20);
    const last = lastCellRef.current;

    if (
      last.cellX === cellX &&
      last.cellZ === cellZ &&
      last.biome === visualState.biome &&
      last.quality === quality &&
      last.memory === memory &&
      last.depth === depth
    ) {
      return;
    }

    last.cellX = cellX;
    last.cellZ = cellZ;
    last.biome = visualState.biome;
    last.quality = quality;
    last.memory = memory;
    last.depth = depth;

    rebuildGroundDetails(cellX, cellZ);
  });

  return (
    <group>
      <instancedMesh ref={rootRef} args={[geometries.root, undefined, GROUND_DETAIL_INSTANCE_COUNT]} frustumCulled>
        <meshStandardMaterial color={groundDetailTint("root", visualState)} roughness={0.86} metalness={0.03} transparent opacity={0.42 + visualState.silhouetteContrast * 0.22} />
      </instancedMesh>
      <instancedMesh ref={leafRef} args={[geometries.leaf, undefined, GROUND_DETAIL_INSTANCE_COUNT]} frustumCulled>
        <meshStandardMaterial color={groundDetailTint("leaf", visualState)} roughness={0.78} metalness={0.02} transparent opacity={0.28 + visualState.groundDetailIntensity * 0.24} side={THREE.DoubleSide} depthWrite={false} />
      </instancedMesh>
      <instancedMesh ref={stoneRef} args={[geometries.stone, undefined, GROUND_DETAIL_INSTANCE_COUNT]} frustumCulled>
        <meshStandardMaterial color={groundDetailTint("stone", visualState)} roughness={0.92} metalness={0.04} transparent opacity={0.42 + visualState.silhouetteContrast * 0.12} />
      </instancedMesh>
      <instancedMesh ref={puddleRef} args={[geometries.puddle, undefined, GROUND_DETAIL_INSTANCE_COUNT]} frustumCulled>
        <meshStandardMaterial color={groundDetailTint("puddle", visualState)} emissive={visualState.palette.emissive} emissiveIntensity={0.08 + visualState.bloomIntensity * 0.04} roughness={0.12} metalness={0.16} transparent opacity={0.24 + visualState.pathGlowIntensity * 0.04} side={THREE.DoubleSide} depthWrite={false} />
      </instancedMesh>
      <instancedMesh ref={ashRef} args={[geometries.ash, undefined, GROUND_DETAIL_INSTANCE_COUNT]} frustumCulled>
        <meshBasicMaterial color={groundDetailTint("ash", visualState)} transparent opacity={0.16 + narrativeWorldState.memoryPressure * 0.09} side={THREE.DoubleSide} depthWrite={false} />
      </instancedMesh>
      <instancedMesh ref={goldRef} args={[geometries.gold, undefined, GROUND_DETAIL_INSTANCE_COUNT]} frustumCulled>
        <meshBasicMaterial color={groundDetailTint("gold", visualState)} transparent opacity={0.18 + visualState.bloomIntensity * 0.12} side={THREE.DoubleSide} depthWrite={false} toneMapped={false} />
      </instancedMesh>
    </group>
  );
}

function chapterThemeDensity(theme: SemanticPathTheme, entry: Slipper3DEntry) {
  if (theme === "water" && isChapter(entry, CHAPTER_MIRROR_CLEARING)) return 0.42;
  if (theme === "fire" && isChapter(entry, CHAPTER_FIRE_AND_RIVER)) return 0.46;
  if (theme === "crown" && isChapter(entry, CHAPTER_CROWNED_RETURN)) return 0.5;
  if (theme === "archive" && isChapter(entry, CHAPTER_BLUE_MOON_ARCHIVE)) return 0.28;
  if (theme === "threshold" && isChapter(entry, CHAPTER_THORNED_HOUSE)) return 0.3;
  if (theme === "thorns" && isChapter(entry, CHAPTER_THORNED_HOUSE)) return 0.5;
  if (theme === "celestial" && (isChapter(entry, CHAPTER_BLUE_MOON_ARCHIVE) || isChapter(entry, CHAPTER_CROWNED_RETURN))) return 0.34;
  return 0;
}

function NarrativeGroundTrails({
  entries,
  pathSegments,
  activeEntry,
  narrativeWorldState,
  qualityProfile,
  visitedEntryIds,
  navigationTargetId,
}: {
  entries: Slipper3DEntry[];
  pathSegments: MazePathSegment[];
  activeEntry: Slipper3DEntry;
  narrativeWorldState: NarrativeWorldState;
  qualityProfile: RenderQualityProfile;
  visitedEntryIds: string[];
  navigationTargetId?: string | null;
}) {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const visitedSet = useMemo(() => new Set(visitedEntryIds), [visitedEntryIds]);
  const visualState = useMemo(
    () => resolveWorldVisualState({ entry: activeEntry, narrativeWorldState }),
    [activeEntry, narrativeWorldState],
  );

  const trailInstances = useMemo(() => {
    const instances: Array<{
      x: number;
      y: number;
      z: number;
      angle: number;
      width: number;
      length: number;
    }> = [];
    const maxInstances = qualityProfile.quality === "low" ? 120 : qualityProfile.quality === "medium" ? 190 : 280;
    const morph = { memoryPressure: narrativeWorldState.memoryPressure, explorationDepth: narrativeWorldState.explorationDepth };

    for (const segment of pathSegments) {
      const length = segment.curveLength;
      if (length < 0.001) continue;

      const routeClass = classifyRouteSegment({ segment, activeEntryId: activeEntry.id, navigationTargetId, visitedEntryIds: visitedSet });
      const routeWeight = routeClassWeight(routeClass);
      const semantic = dominantSemanticTheme(segment.targetEntry);
      const director = resolveChapterDirector(segment.targetEntry);
      const baseSteps = Math.max(3, Math.min(24, Math.floor(length / (director.navigationStyle === "ascending" ? 2.9 : 3.4))));
      // The living ribbon owns active navigation. These circular traces are
      // reserved for travelled memory only; showing every adjacent route at
      // once creates overlapping loops and spends fill-rate on false choices.
      if (routeClass !== "visited") continue;
      const steps = Math.max(2, Math.round(baseSteps * (0.42 + routeWeight * 0.58)));
      for (let index = 1; index < steps; index += 1) {
        if (instances.length >= maxInstances) break;
        const t = index / steps;
        const rhythm = worldSeededUnit(Math.floor(segment.source.x + index * 13), Math.floor(segment.source.y - index * 17), semantic.score + 33.2);
        if (rhythm < 0.18 && director.groundTrailOpacity < 0.3) continue;

        const point = curvedPathPointAt(segment, t, morph);
        const tangent = curvedPathTangentAt(segment, t, morph);
        const angle = Math.atan2(tangent.y, tangent.x);
        const x = point.x;
        const z = point.y;
        const terrainLift = terrainElevationAtPoint(x, z, entries, pathSegments, morph);
        const routeScale = 0.46;
        const width = THREE.MathUtils.lerp(0.55, 0.94, director.pathClarity) * (0.86 + rhythm * 0.18) * routeScale;
        const patchLength = THREE.MathUtils.lerp(1.75, 2.68, director.pathClarity) * (0.84 + rhythm * 0.16) * (0.9 + routeScale * 0.1);

        instances.push({
          x,
          y: TERRAIN_BASE_Y + terrainLift + 0.028,
          z,
          angle,
          width,
          length: patchLength,
        });
      }
    }

    return instances;
  }, [activeEntry.id, entries, navigationTargetId, narrativeWorldState.explorationDepth, narrativeWorldState.memoryPressure, pathSegments, qualityProfile.quality, visitedSet]);

  useEffect(() => {
    const mesh = meshRef.current;
    if (!mesh) return;

    for (let index = 0; index < trailInstances.length; index += 1) {
      const trail = trailInstances[index];
      dummy.position.set(trail.x, trail.y, trail.z);
      dummy.rotation.set(-Math.PI / 2, 0, trail.angle);
      dummy.scale.set(trail.length, trail.width, 1);
      dummy.updateMatrix();
      mesh.setMatrixAt(index, dummy.matrix);
    }

    mesh.count = trailInstances.length;
    mesh.instanceMatrix.needsUpdate = true;
    mesh.computeBoundingBox();
    mesh.computeBoundingSphere();
  }, [dummy, trailInstances]);

  if (trailInstances.length === 0) return null;

  const opacity = Math.min(
    0.14,
    0.025 + visualState.director.groundTrailOpacity * visualState.pathClarity * qualityProfile.semanticDensityMultiplier * 0.13,
  );

  return (
    <instancedMesh ref={meshRef} args={[undefined, undefined, trailInstances.length]} frustumCulled>
      <circleGeometry args={[0.5, 12]} />
      <meshBasicMaterial
        color="#b8af9b"
        transparent
        opacity={opacity}
        side={THREE.DoubleSide}
        depthWrite={false}
        toneMapped={false}
        polygonOffset
        polygonOffsetFactor={-1}
      />
    </instancedMesh>
  );
}

type BreadcrumbMaterialConfig = {
  color: string;
  length: number;
  width: number;
  opacity: number;
  yLift: number;
};

function breadcrumbKindForWorldState(entry: Slipper3DEntry, narrativeWorldState: NarrativeWorldState, trailState: TrailState): BreadcrumbKind {
  const semantic = dominantSemanticTheme(entry);

  if (trailState === "lost" || narrativeWorldState.memoryPressure > 0.72) return "ghost";
  if (narrativeWorldState.fireWaterBalance > 0.24 || semantic.theme === "fire") return "ember";
  if (narrativeWorldState.fireWaterBalance < -0.24 || semantic.theme === "water") return "puddle";
  if (semantic.theme === "archive" && narrativeWorldState.memoryPressure > 0.46) return "ghost";
  return "footprint";
}

function breadcrumbMaterialConfig(trace: BreadcrumbTrace): BreadcrumbMaterialConfig {
  const trailSoftness = trace.trailState === "lost" ? 1.34 : trace.trailState === "edge-of-trail" ? 1.16 : 1;
  const intensity = THREE.MathUtils.clamp(trace.intensity, 0.18, 1.15);
  const scale = THREE.MathUtils.clamp(trace.scale, 0.72, 1.65) * trailSoftness;

  if (trace.kind === "ember") {
    return {
      color: "#ff8a35",
      length: 0.34 * scale,
      width: 0.22 * scale,
      opacity: 0.36 + intensity * 0.28,
      yLift: 0.028,
    };
  }

  if (trace.kind === "puddle") {
    return {
      color: "#76c8e7",
      length: 0.72 * scale,
      width: 0.42 * scale,
      opacity: 0.2 + intensity * 0.2,
      yLift: 0.016,
    };
  }

  if (trace.kind === "ghost") {
    return {
      color: "#d8d8ff",
      length: 0.9 * scale,
      width: 0.34 * scale,
      opacity: 0.14 + intensity * 0.18,
      yLift: 0.022,
    };
  }

  return {
    color: "#f3e8cc",
    length: 0.58 * scale,
    width: 0.26 * scale,
    opacity: 0.18 + intensity * 0.16,
    yLift: 0.018,
  };
}

function breadcrumbLimitForQuality(qualityProfile: RenderQualityProfile) {
  if (qualityProfile.quality === "low") return 180;
  if (qualityProfile.quality === "medium") return 320;
  return 520;
}

function PlayerBreadcrumbRecorder({
  entries,
  activeEntry,
  narrativeWorldState,
  pathSegments,
  controls,
  mode,
  qualityProfile,
}: {
  entries: Slipper3DEntry[];
  activeEntry: Slipper3DEntry;
  narrativeWorldState: NarrativeWorldState;
  pathSegments: MazePathSegment[];
  controls: StorySceneControls;
  mode: StorySceneMode;
  qualityProfile: RenderQualityProfile;
}) {
  const { camera } = useThree();
  const lastPositionRef = useRef<THREE.Vector3 | null>(null);
  const directionRef = useRef(new THREE.Vector3());
  const elapsedSinceDropRef = useRef(0);

  useEffect(() => {
    lastPositionRef.current = null;
    elapsedSinceDropRef.current = 0;
  }, [activeEntry.id]);

  useFrame((_, delta) => {
    if (mode !== "explore" || controls !== "walk") return;

    elapsedSinceDropRef.current += delta;
    const current = camera.position;
    const last = lastPositionRef.current;
    const minDelay = narrativeWorldState.memoryPressure > 0.62 ? 0.26 : 0.34;
    if (elapsedSinceDropRef.current < minDelay) return;

    if (!last) {
      lastPositionRef.current = current.clone();
      return;
    }

    const dx = current.x - last.x;
    const dz = current.z - last.z;
    const distance = Math.sqrt(dx * dx + dz * dz);
    if (distance > 16) {
      last.copy(current);
      elapsedSinceDropRef.current = 0;
      return;
    }

    const minDistance = narrativeWorldState.memoryPressure > 0.64 ? 0.82 : 1.12;
    if (distance < minDistance) return;

    const playerPosition: Vector3Tuple = [current.x, current.y, current.z];
    const pathStatus = nearestPathStatus({ playerPosition, pathSegments, insideClearing: false });
    const terrainLift = terrainElevationAtPoint(current.x, current.z, entries, pathSegments, { memoryPressure: narrativeWorldState.memoryPressure, explorationDepth: narrativeWorldState.explorationDepth });
    camera.getWorldDirection(directionRef.current);
    const yaw = yawFromDirection(directionRef.current.x, directionRef.current.z);
    const kind = breadcrumbKindForWorldState(activeEntry, narrativeWorldState, pathStatus.state);
    const sequence = useBreadcrumbStore.getState().sequence;
    const side = sequence % 2 === 0 ? -1 : 1;
    const lateralOffset = kind === "footprint" ? side * 0.16 : kind === "ghost" ? side * 0.08 : 0;
    const rightX = Math.cos(yaw);
    const rightZ = -Math.sin(yaw);
    const pressureLift = narrativeWorldState.memoryPressure * 0.02;
    const intensity = THREE.MathUtils.clamp(
      0.48 + narrativeWorldState.memoryPressure * 0.32 + Math.abs(narrativeWorldState.fireWaterBalance) * 0.18 + (pathStatus.state === "lost" ? 0.2 : 0),
      0.24,
      1,
    );

    useBreadcrumbStore.getState().addBreadcrumb(
      {
        position: [current.x + rightX * lateralOffset, TERRAIN_BASE_Y + terrainLift + 0.036 + pressureLift, current.z + rightZ * lateralOffset],
        yaw,
        kind,
        intensity,
        scale: 0.88 + narrativeWorldState.symbolicWeight * 0.42,
        activeEntryId: activeEntry.id,
        trailState: pathStatus.state,
      },
      breadcrumbLimitForQuality(qualityProfile),
    );

    last.copy(current);
    elapsedSinceDropRef.current = 0;
  });

  return null;
}

function PersistentEnvironmentalBreadcrumbs({ qualityProfile, narrativeWorldState }: { qualityProfile: RenderQualityProfile; narrativeWorldState: NarrativeWorldState }) {
  const traces = useBreadcrumbStore((state) => state.traces);
  const pruneBreadcrumbs = useBreadcrumbStore((state) => state.pruneBreadcrumbs);
  const groundRef = useRef<THREE.InstancedMesh>(null);
  const emberRef = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const color = useMemo(() => new THREE.Color(), []);
  const emberColor = useMemo(() => new THREE.Color(), []);

  const maxTraces = breadcrumbLimitForQuality(qualityProfile);
  const visibleTraces = useMemo(() => traces.slice(-maxTraces), [maxTraces, traces]);
  const emberTraces = useMemo(() => visibleTraces.filter((trace) => trace.kind === "ember"), [visibleTraces]);
  const averageOpacity = useMemo(() => {
    if (visibleTraces.length === 0) return 0;
    const total = visibleTraces.reduce((sum, trace) => sum + breadcrumbMaterialConfig(trace).opacity, 0);
    return total / visibleTraces.length;
  }, [visibleTraces]);

  useEffect(() => {
    pruneBreadcrumbs(maxTraces);
  }, [maxTraces, pruneBreadcrumbs]);

  useEffect(() => {
    const mesh = groundRef.current;
    if (!mesh) return;

    for (let index = 0; index < visibleTraces.length; index += 1) {
      const trace = visibleTraces[index];
      const config = breadcrumbMaterialConfig(trace);
      dummy.position.set(trace.position[0], trace.position[1] + config.yLift, trace.position[2]);
      dummy.rotation.set(-Math.PI / 2, 0, -trace.yaw);
      dummy.scale.set(config.width, config.length, 1);
      dummy.updateMatrix();
      mesh.setMatrixAt(index, dummy.matrix);
      color.set(config.color).multiplyScalar(0.82 + trace.intensity * 0.32);
      mesh.setColorAt(index, color);
    }

    mesh.count = visibleTraces.length;
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    mesh.computeBoundingBox();
    mesh.computeBoundingSphere();
  }, [color, dummy, visibleTraces]);

  useEffect(() => {
    const mesh = emberRef.current;
    if (!mesh) return;

    for (let index = 0; index < emberTraces.length; index += 1) {
      const trace = emberTraces[index];
      const flickerSeed = worldSeededUnit(Math.floor(trace.position[0] * 10), Math.floor(trace.position[2] * 10), trace.intensity * 31.2);
      const emberScale = 0.045 + trace.intensity * 0.045 + flickerSeed * 0.018;
      dummy.position.set(trace.position[0], trace.position[1] + 0.12 + flickerSeed * 0.08, trace.position[2]);
      dummy.rotation.set(0, trace.yaw, 0);
      dummy.scale.setScalar(emberScale);
      dummy.updateMatrix();
      mesh.setMatrixAt(index, dummy.matrix);
      emberColor.set("#ffc072").lerp(new THREE.Color("#ff6f2e"), flickerSeed * 0.6);
      mesh.setColorAt(index, emberColor);
    }

    mesh.count = emberTraces.length;
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    mesh.computeBoundingBox();
    mesh.computeBoundingSphere();
  }, [dummy, emberColor, emberTraces]);

  if (visibleTraces.length === 0) return null;

  const memoryGlow = 0.78 + narrativeWorldState.memoryPressure * 0.24;
  const groundOpacity = THREE.MathUtils.clamp(averageOpacity * qualityProfile.semanticDensityMultiplier * memoryGlow, 0.08, 0.58);
  const emberOpacity = THREE.MathUtils.clamp((0.34 + Math.max(0, narrativeWorldState.fireWaterBalance) * 0.26) * qualityProfile.particleMultiplier, 0.16, 0.7);

  return (
    <group>
      <instancedMesh ref={groundRef} args={[undefined, undefined, maxTraces]} frustumCulled>
        <circleGeometry args={[1, 24]} />
        <meshBasicMaterial vertexColors transparent opacity={groundOpacity} side={THREE.DoubleSide} depthWrite={false} />
      </instancedMesh>
      {emberTraces.length > 0 ? (
        <instancedMesh ref={emberRef} args={[undefined, undefined, maxTraces]} frustumCulled>
          <sphereGeometry args={[1, 8, 8]} />
          <meshBasicMaterial vertexColors transparent opacity={emberOpacity} depthWrite={false} />
        </instancedMesh>
      ) : null}
    </group>
  );
}
type SemanticRigidInstance = {
  key: string;
  position: [number, number, number];
  rotation: [number, number, number];
  scale: [number, number, number];
};

function emptySemanticRecord<T>(factory: () => T): Record<SemanticPathTheme, T> {
  return {
    archive: factory(),
    fire: factory(),
    water: factory(),
    threshold: factory(),
    crown: factory(),
    thorns: factory(),
    celestial: factory(),
  };
}

const SEMANTIC_MODEL_PATHS: Record<SemanticPathTheme, string> = {
  archive: "/models/book.glb",
  fire: "/models/ember.glb",
  water: "/models/shattered_mirror.glb",
  threshold: "/models/archway.glb",
  crown: "/models/crown.glb",
  thorns: "/models/bramble.glb",
  celestial: "/models/crystal.glb",
};

function firstGeometryFromGLTF(root: THREE.Object3D | undefined, fallback: THREE.BufferGeometry) {
  let geometry: THREE.BufferGeometry | null = null;
  root?.traverse((child) => {
    const mesh = child as THREE.Mesh;
    if (!geometry && mesh.isMesh && mesh.geometry) geometry = mesh.geometry;
  });
  return geometry ?? fallback;
}

function useSemanticObjectGeometries() {
  const fallbacks = useMemo<Record<SemanticPathTheme, THREE.BufferGeometry>>(
    () => ({
      archive: new THREE.PlaneGeometry(0.52, 0.82, 1, 1),
      fire: new THREE.SphereGeometry(1, 8, 8),
      water: new THREE.DodecahedronGeometry(1, 0),
      threshold: new THREE.TorusGeometry(1, 0.055, 6, 24, Math.PI),
      crown: new THREE.TorusGeometry(1, 0.032, 6, 24),
      thorns: new THREE.ConeGeometry(0.55, 1.8, 5),
      celestial: new THREE.OctahedronGeometry(1, 0),
    }),
    [],
  );
  const [loaded, setLoaded] = useState<Partial<Record<SemanticPathTheme, THREE.BufferGeometry>>>({});

  useEffect(() => {
    let disposed = false;
    const loader = new GLTFLoader();
    const loadedGeometries: THREE.BufferGeometry[] = [];

    for (const theme of SEMANTIC_PATH_THEMES) {
      loader.load(
        SEMANTIC_MODEL_PATHS[theme],
        (gltf) => {
          if (disposed) return;
          const geometry = firstGeometryFromGLTF(gltf.scene, fallbacks[theme]).clone();
          geometry.computeBoundingBox();
          geometry.computeBoundingSphere();
          loadedGeometries.push(geometry);
          setLoaded((current) => ({ ...current, [theme]: geometry }));
        },
        undefined,
        () => {
          // Missing bespoke GLB files should never take the whole scene down.
          // The fallback geometry remains active until the real model exists.
        },
      );
    }

    return () => {
      disposed = true;
      for (const geometry of loadedGeometries) geometry.dispose();
      for (const geometry of Object.values(fallbacks)) geometry.dispose();
    };
  }, [fallbacks]);

  return useMemo<Record<SemanticPathTheme, THREE.BufferGeometry>>(
    () => ({
      archive: loaded.archive ?? fallbacks.archive,
      fire: loaded.fire ?? fallbacks.fire,
      water: loaded.water ?? fallbacks.water,
      threshold: loaded.threshold ?? fallbacks.threshold,
      crown: loaded.crown ?? fallbacks.crown,
      thorns: loaded.thorns ?? fallbacks.thorns,
      celestial: loaded.celestial ?? fallbacks.celestial,
    }),
    [fallbacks, loaded],
  );
}

function SemanticObjectPathing({
  entries,
  pathSegments,
  narrativeWorldState,
  activeEntry,
  qualityProfile,
  visitedEntryIds,
  navigationTargetId,
}: {
  entries: Slipper3DEntry[];
  pathSegments: MazePathSegment[];
  narrativeWorldState: NarrativeWorldState;
  activeEntry: Slipper3DEntry;
  qualityProfile: RenderQualityProfile;
  visitedEntryIds: string[];
  navigationTargetId?: string | null;
}) {
  const { camera } = useThree();
  const archiveRef = useRef<THREE.InstancedMesh>(null);
  const fireRef = useRef<THREE.InstancedMesh>(null);
  const waterRef = useRef<THREE.InstancedMesh>(null);
  const thresholdRef = useRef<THREE.InstancedMesh>(null);
  const crownRef = useRef<THREE.InstancedMesh>(null);
  const thornsRef = useRef<THREE.InstancedMesh>(null);
  const celestialRef = useRef<THREE.InstancedMesh>(null);
  const lastCellRef = useRef({
    cellX: Number.NaN,
    cellZ: Number.NaN,
    depth: Number.NaN,
    pressure: Number.NaN,
    entryCount: Number.NaN,
    quality: "",
    semanticDensity: Number.NaN,
    navigationTargetId: null as string | null,
    interactionPulse: Number.NaN,
  });
  const lastSemanticRebuildTimeRef = useRef(Number.NEGATIVE_INFINITY);
  const lastInteractionPulseTimeRef = useRef(Number.NEGATIVE_INFINITY);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const forwardVector = useMemo(() => new THREE.Vector3(), []);
  const geometries = useSemanticObjectGeometries();
  const [interactionPulse, setInteractionPulse] = useState(0);
  const [semanticRigidBodies, setSemanticRigidBodies] = useState<Record<SemanticPathTheme, SemanticRigidInstance[]>>(() => emptySemanticRecord(() => [] as SemanticRigidInstance[]));
  const interactiveSemanticRigidBodies = useMemo(() => {
    if (qualityProfile.quality !== "high" && qualityProfile.quality !== "cinematic") {
      return emptySemanticRecord(() => [] as SemanticRigidInstance[]);
    }

    return {
      archive: [] as SemanticRigidInstance[],
      fire: [] as SemanticRigidInstance[],
      water: semanticRigidBodies.water.slice(0, SEMANTIC_SENSOR_LIMIT),
      threshold: semanticRigidBodies.threshold.slice(0, SEMANTIC_SENSOR_LIMIT),
      crown: [] as SemanticRigidInstance[],
      thorns: semanticRigidBodies.thorns.slice(0, SEMANTIC_SENSOR_LIMIT),
      celestial: semanticRigidBodies.celestial.slice(0, SEMANTIC_SENSOR_LIMIT),
    };
  }, [qualityProfile.quality, semanticRigidBodies]);
  const visitedSet = useMemo(() => new Set(visitedEntryIds), [visitedEntryIds]);
  const clearingPositions = useMemo(() => allClearingPositions(entries), [entries]);
  const visualState = useMemo(
    () => resolveWorldVisualState({ entry: activeEntry, narrativeWorldState }),
    [activeEntry, narrativeWorldState],
  );

  const meshRefs = useMemo(
    () => ({
      archive: archiveRef,
      fire: fireRef,
      water: waterRef,
      threshold: thresholdRef,
      crown: crownRef,
      thorns: thornsRef,
      celestial: celestialRef,
    }),
    [],
  );

  const finalizeInstancedSemanticMeshes = (counts: Record<SemanticPathTheme, number>) => {
    for (const theme of SEMANTIC_PATH_THEMES) {
      const mesh = meshRefs[theme].current;
      if (!mesh) continue;
      mesh.count = Math.min(counts[theme], DECORATION_INSTANCE_COUNT);
      mesh.instanceMatrix.needsUpdate = true;
      mesh.computeBoundingBox();
      mesh.computeBoundingSphere();
    }
  };

  useEffect(() => {
    for (const theme of SEMANTIC_PATH_THEMES) {
      const mesh = meshRefs[theme].current;
      if (!mesh) continue;
      mesh.count = 0;
      mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    }
  }, [meshRefs]);

  const rebuildSemanticObjects = (cellX: number, cellZ: number, elapsedTime: number) => {
    if (SEMANTIC_PATH_THEMES.some((theme) => !meshRefs[theme].current)) return;

    const counts = emptySemanticRecord(() => 0);
    const nextRigidBodies = emptySemanticRecord(() => [] as SemanticRigidInstance[]);
    const depth = clamp01(narrativeWorldState.explorationDepth);
    const memoryPressure = clamp01(narrativeWorldState.memoryPressure);
    const pressure = clamp01(depth * 0.65 + memoryPressure * 0.48);
    const morph = { memoryPressure, explorationDepth: depth };
    const corridorWidth = THREE.MathUtils.lerp(CORRIDOR_BASE_WIDTH, CORRIDOR_MIN_WIDTH, Math.pow(pressure, 1.18));
    const clearingRadius = THREE.MathUtils.lerp(CLEARING_SAFE_RADIUS + 0.58, CLEARING_SAFE_RADIUS - 0.78, pressure);
    camera.getWorldDirection(forwardVector);
    const forwardX = forwardVector.x;
    const forwardZ = forwardVector.z;
    const semanticDensityMultiplier = (visualState?.semanticDensity ?? 0.62) * qualityProfile.semanticDensityMultiplier;
    const centerQuietness = visualState?.centerQuietness ?? 0.82;
    const shouldBuildSensors = qualityProfile.quality === "high" || qualityProfile.quality === "cinematic";
    const effectiveCellRadius = Math.min(DECORATION_CELL_RADIUS, qualityProfile.semanticCellRadius);
    const effectiveDecorationsPerCell = Math.min(DECORATIONS_PER_CELL, qualityProfile.decorationsPerCell);

    if (pathSegments.length === 0) {
      finalizeInstancedSemanticMeshes(counts);
      if (shouldBuildSensors) setSemanticRigidBodies(nextRigidBodies);
      return;
    }

    for (let gx = -effectiveCellRadius; gx <= effectiveCellRadius; gx += 1) {
      for (let gz = -effectiveCellRadius; gz <= effectiveCellRadius; gz += 1) {
        const worldCellX = cellX + gx;
        const worldCellZ = cellZ + gz;

        for (let localIndex = 0; localIndex < effectiveDecorationsPerCell; localIndex += 1) {
          const salt = localIndex * 31.7;
          const jitterX = worldSeededUnit(worldCellX, worldCellZ, salt + 3.9);
          const jitterZ = worldSeededUnit(worldCellX, worldCellZ, salt + 8.4);
          const candidateX = (worldCellX + jitterX) * DECORATION_CELL_SIZE;
          const candidateZ = (worldCellZ + jitterZ) * DECORATION_CELL_SIZE;
          const nearest = nearestMazePathSegment(candidateX, candidateZ, pathSegments, morph);
          const segment = nearest.segment;
          const insideCorridor = Boolean(segment) && nearest.distanceSq < corridorWidth * corridorWidth;
          if (!segment || !insideCorridor) continue;

          const center = curvedPathPointAt(segment, nearest.projectionT, morph);
          const centerX = center.x;
          const centerZ = center.y;
          const tooCloseToClearing = clearingPositions.some((position) => {
            const dx = centerX - position[0];
            const dz = centerZ - position[2];
            return dx * dx + dz * dz < clearingRadius * clearingRadius;
          });
          if (tooCloseToClearing) continue;

          const routeClass = classifyRouteSegment({ segment, activeEntryId: activeEntry.id, navigationTargetId, visitedEntryIds: visitedSet });
          const routeWeight = routeClassWeight(routeClass);
          if (routeClass === "background" && worldSeededUnit(worldCellX, worldCellZ, salt + 41.22) > 0.2) continue;
          if (routeClass === "visited" && worldSeededUnit(worldCellX, worldCellZ, salt + 42.22) > 0.42) continue;

          const semantic = dominantSemanticTheme(segment.targetEntry);
          const theme = semantic.theme;
          const chapterBias = chapterThemeDensity(theme, segment.targetEntry);
          const corridorRhythm = worldSeededUnit(Math.floor(centerX * 0.12), Math.floor(centerZ * 0.12), salt + 88.8);
          if (corridorRhythm < 0.18 && chapterBias < 0.32) continue;

          const density = clamp01((0.18 + semantic.score * 0.028 + pressure * 0.1 + chapterBias) * semanticDensityMultiplier * (0.18 + routeWeight * 0.92));
          if (worldSeededUnit(worldCellX, worldCellZ, salt + 10.15) > density) continue;

          const mesh = meshRefs[theme].current;
          if (!mesh) continue;
          const instanceIndex = counts[theme];
          if (instanceIndex >= DECORATION_INSTANCE_COUNT) continue;

          const pathAngle = pathSegmentAngle(segment, nearest.projectionT, morph);
          const perpendicularAngle = pathAngle + Math.PI / 2;
          const side = worldSeededUnit(worldCellX, worldCellZ, salt + 11.2) > 0.5 ? 1 : -1;
          const crownPath = isChapter(segment.targetEntry, CHAPTER_CROWNED_RETURN) || isChapter(segment.sourceEntry, CHAPTER_CROWNED_RETURN);
          const edgeStart = corridorWidth * (crownPath && theme === "crown" ? 0.48 : 0.58);
          const edgeEnd = corridorWidth * (crownPath && theme === "crown" ? 0.88 : 1.02);
          const lateralOffset = THREE.MathUtils.lerp(edgeStart, edgeEnd, worldSeededUnit(worldCellX, worldCellZ, salt + 16.6)) * side;
          const longitudinalDrift = (worldSeededUnit(worldCellX, worldCellZ, salt + 17.9) - 0.5) * 1.35;
          const baseX = centerX + Math.cos(perpendicularAngle) * lateralOffset + Math.cos(pathAngle) * longitudinalDrift;
          const baseZ = centerZ + Math.sin(perpendicularAngle) * lateralOffset + Math.sin(pathAngle) * longitudinalDrift;

          const dxToCandidate = baseX - camera.position.x;
          const dzToCandidate = baseZ - camera.position.z;
          const candidateDistance = Math.sqrt(dxToCandidate * dxToCandidate + dzToCandidate * dzToCandidate);
          if (candidateDistance < 6.5) continue;
          if (candidateDistance > 0.001 && candidateDistance < 16) {
            const forwardDot = (dxToCandidate / candidateDistance) * forwardX + (dzToCandidate / candidateDistance) * forwardZ;
            if (forwardDot > 0.78 && worldSeededUnit(worldCellX, worldCellZ, salt + 99.2) < centerQuietness) continue;
          }

          const terrainLift = terrainElevationAtPoint(baseX, baseZ, entries, pathSegments, morph);
          const baseY = TERRAIN_BASE_Y + terrainLift;
          const phase = elapsedTime + worldCellX * 0.19 + worldCellZ * 0.13 + localIndex * 0.53;
          const organicTilt = (worldSeededUnit(worldCellX, worldCellZ, salt + 22.2) - 0.5) * 0.52;
          const organicYaw = pathAngle + (worldSeededUnit(worldCellX, worldCellZ, salt + 23.8) - 0.5) * 1.8;
          const semanticScale = 1 + Math.min(0.26, semantic.score * 0.032) + pressure * 0.08;

          if (theme === "archive") {
            const flutter = Math.sin(phase * 0.9) * 0.075;
            const scale = (0.38 + worldSeededUnit(worldCellX, worldCellZ, salt + 24.1) * 0.38) * semanticScale;
            dummy.position.set(baseX, baseY + 0.58 + flutter + worldSeededUnit(worldCellX, worldCellZ, salt + 25.7) * 0.82, baseZ);
            dummy.rotation.set(organicTilt, organicYaw + Math.sin(phase * 0.42) * 0.22, organicTilt * 0.7);
            dummy.scale.set(scale * 0.72, scale, scale);
          } else if (theme === "fire") {
            const chapterScale = isChapter(segment.targetEntry, CHAPTER_FIRE_AND_RIVER) ? 1.85 : 1;
            const lift = Math.sin(phase * 1.7) * 0.055;
            const scale = (0.09 + worldSeededUnit(worldCellX, worldCellZ, salt + 31.3) * 0.2) * semanticScale * chapterScale;
            dummy.position.set(baseX, baseY + 0.2 + lift + worldSeededUnit(worldCellX, worldCellZ, salt + 32.4) * 0.42, baseZ);
            dummy.rotation.set(0, organicYaw, 0);
            dummy.scale.set(scale * 1.15, scale * (0.65 + worldSeededUnit(worldCellX, worldCellZ, salt + 33.4) * 0.9), scale * 1.15);
          } else if (theme === "water") {
            const chapterScale = isChapter(segment.targetEntry, CHAPTER_MIRROR_CLEARING) ? 1.75 : 1;
            const scale = (0.22 + worldSeededUnit(worldCellX, worldCellZ, salt + 41.1) * 0.32) * semanticScale * chapterScale;
            dummy.position.set(baseX, baseY + 0.1 + Math.sin(phase * 0.55) * 0.035, baseZ);
            dummy.rotation.set(organicTilt * 0.32, organicYaw, organicTilt * 0.2);
            dummy.scale.set(scale * 1.32, scale * 0.72, scale * 0.92);
          } else if (theme === "threshold") {
            const archScale = (0.72 + worldSeededUnit(worldCellX, worldCellZ, salt + 51.9) * 0.44) * semanticScale;
            const lean = (worldSeededUnit(worldCellX, worldCellZ, salt + 52.7) - 0.5) * 0.34;
            dummy.position.set(baseX, baseY + 0.72, baseZ);
            dummy.rotation.set(0, Math.PI / 2 - pathAngle, lean);
            dummy.scale.set(corridorWidth * 0.44 * archScale, 1.02 + pressure * 0.24, 1.1 + archScale * 0.16);
          } else if (theme === "crown") {
            const progress = chapterProgress(segment.targetEntry, entries, CHAPTER_CROWNED_RETURN);
            const crownScaleBoost = isChapter(segment.targetEntry, CHAPTER_CROWNED_RETURN) ? 2.6 + progress * 1.9 : 1;
            const scale = (0.34 + worldSeededUnit(worldCellX, worldCellZ, salt + 61.4) * 0.36) * semanticScale * crownScaleBoost;
            const hover = Math.sin(phase * 0.72) * 0.12;
            const skyLift = isChapter(segment.targetEntry, CHAPTER_CROWNED_RETURN) ? 3.6 + progress * 6.8 : 0.64;
            dummy.position.set(baseX, baseY + skyLift + hover + worldSeededUnit(worldCellX, worldCellZ, salt + 62.1) * 0.9, baseZ);
            dummy.rotation.set(Math.PI / 2 + organicTilt * 0.25, organicYaw + elapsedTime * 0.12, organicTilt * 0.3);
            dummy.scale.set(scale, scale, scale);
          } else if (theme === "thorns") {
            const scale = (0.42 + worldSeededUnit(worldCellX, worldCellZ, salt + 71.4) * 0.36) * semanticScale;
            dummy.position.set(baseX, baseY + 0.34 + pressure * 0.18, baseZ);
            dummy.rotation.set(organicTilt * 0.4, organicYaw + Math.PI * 0.22, organicTilt);
            dummy.scale.set(scale * 0.72, scale * (1.1 + pressure * 0.5), scale * 0.72);
          } else {
            const scale = (0.2 + worldSeededUnit(worldCellX, worldCellZ, salt + 81.4) * 0.28) * semanticScale;
            const hover = Math.sin(phase * 0.86) * 0.14;
            dummy.position.set(baseX, baseY + 1.2 + hover + worldSeededUnit(worldCellX, worldCellZ, salt + 82.1) * 1.1, baseZ);
            dummy.rotation.set(organicTilt * 0.2 + elapsedTime * 0.06, organicYaw, organicTilt * 0.35);
            dummy.scale.set(scale, scale, scale);
          }

          dummy.updateMatrix();
          mesh.setMatrixAt(instanceIndex, dummy.matrix);
          counts[theme] += 1;

          if (shouldBuildSensors && (theme === "water" || theme === "threshold" || theme === "thorns" || theme === "celestial")) {
            nextRigidBodies[theme].push({
              key: `${theme}-${worldCellX}-${worldCellZ}-${localIndex}`,
              position: [dummy.position.x, dummy.position.y, dummy.position.z],
              rotation: [dummy.rotation.x, dummy.rotation.y, dummy.rotation.z],
              scale: [Math.max(0.28, dummy.scale.x), Math.max(0.28, dummy.scale.y), Math.max(0.28, dummy.scale.z)],
            });
          }
        }
      }
    }

    finalizeInstancedSemanticMeshes(counts);
    if (shouldBuildSensors) setSemanticRigidBodies(nextRigidBodies);
  };

  useFrame(({ clock }) => {
    const cameraPosition = camera.position;
    const cellX = Math.floor(cameraPosition.x / DECORATION_CELL_SIZE);
    const cellZ = Math.floor(cameraPosition.z / DECORATION_CELL_SIZE);
    const depth = Math.round(narrativeWorldState.explorationDepth * 30);
    const pressure = Math.round(narrativeWorldState.memoryPressure * 30);
    const entryCount = entries.length;
    const quality = qualityProfile.quality;
    const semanticDensity = Math.round(visualState.semanticDensity * 100);
    const targetId = navigationTargetId ?? null;
    const last = lastCellRef.current;

    if (
      last.cellX === cellX &&
      last.cellZ === cellZ &&
      last.depth === depth &&
      last.pressure === pressure &&
      last.entryCount === entryCount &&
      last.quality === quality &&
      last.semanticDensity === semanticDensity &&
      last.navigationTargetId === targetId &&
      last.interactionPulse === interactionPulse
    ) {
      return;
    }

    if (clock.elapsedTime - lastSemanticRebuildTimeRef.current < SEMANTIC_REBUILD_MIN_INTERVAL) return;

    last.cellX = cellX;
    last.cellZ = cellZ;
    last.depth = depth;
    last.pressure = pressure;
    last.entryCount = entryCount;
    last.quality = quality;
    last.semanticDensity = semanticDensity;
    last.navigationTargetId = targetId;
    last.interactionPulse = interactionPulse;
    lastSemanticRebuildTimeRef.current = clock.elapsedTime;

    rebuildSemanticObjects(cellX, cellZ, clock.elapsedTime);
  });

  const handleWaterIntersection = () => {
    const now = performance.now() / 1000;
    if (now - lastInteractionPulseTimeRef.current < 0.35) return;
    lastInteractionPulseTimeRef.current = now;
    setInteractionPulse((value) => (value + 1) % 100000);
  };

  return (
    <group>
      <instancedMesh ref={archiveRef} args={[geometries.archive, undefined, DECORATION_INSTANCE_COUNT]} frustumCulled>
        <meshStandardMaterial color="#eadfca" emissive="#625946" emissiveIntensity={0.08 + narrativeWorldState.memoryPressure * 0.08} transparent opacity={(0.24 + narrativeWorldState.memoryPressure * 0.12) * visualState.semanticOpacity} roughness={0.68} side={THREE.DoubleSide} depthWrite={false} />
      </instancedMesh>
      <instancedMesh ref={fireRef} args={[geometries.fire, undefined, DECORATION_INSTANCE_COUNT]} frustumCulled>
        <meshStandardMaterial color="#ff7a2e" emissive="#ff3c14" emissiveIntensity={1.9 + narrativeWorldState.fireCount * 0.015} transparent opacity={0.68 * visualState.semanticOpacity} roughness={0.35} depthWrite={false} />
      </instancedMesh>
      <InstancedRigidBodies instances={interactiveSemanticRigidBodies.water} type="fixed" colliders={false} colliderNodes={[<BallCollider key="water-sensor" args={[0.62]} sensor onIntersectionEnter={handleWaterIntersection} />]}>
        <instancedMesh ref={waterRef} args={[geometries.water, undefined, DECORATION_INSTANCE_COUNT]} frustumCulled>
          <meshStandardMaterial color="#9fbfc5" emissive="#2e6775" emissiveIntensity={0.18 + narrativeWorldState.waterCount * 0.004 + (interactionPulse % 16) * 0.012} metalness={0.22} roughness={0.14} transparent opacity={0.42 * visualState.semanticOpacity} depthWrite={false} />
        </instancedMesh>
      </InstancedRigidBodies>
      <InstancedRigidBodies instances={interactiveSemanticRigidBodies.threshold} type="fixed" colliders={false} colliderNodes={[<BallCollider key="threshold-sensor" args={[0.78]} sensor />]}>
        <instancedMesh ref={thresholdRef} args={[geometries.threshold, undefined, DECORATION_INSTANCE_COUNT]} frustumCulled>
          <meshStandardMaterial color="#7f7668" emissive="#2b241d" emissiveIntensity={0.18} roughness={0.72} transparent opacity={(0.22 + narrativeWorldState.thresholdCount * 0.003) * visualState.semanticOpacity} side={THREE.DoubleSide} depthWrite={false} />
        </instancedMesh>
      </InstancedRigidBodies>
      <instancedMesh ref={crownRef} args={[geometries.crown, undefined, DECORATION_INSTANCE_COUNT]} frustumCulled>
        <meshStandardMaterial color="#e2bd63" emissive="#d8a546" emissiveIntensity={0.72 + narrativeWorldState.crownCount * 0.012} metalness={0.44} roughness={0.22} transparent opacity={0.58 * visualState.semanticOpacity} depthWrite={false} />
      </instancedMesh>
      <InstancedRigidBodies instances={interactiveSemanticRigidBodies.thorns} type="fixed" colliders={false} colliderNodes={[<BallCollider key="thorns-sensor" args={[0.56]} sensor />]}>
        <instancedMesh ref={thornsRef} args={[geometries.thorns, undefined, DECORATION_INSTANCE_COUNT]} frustumCulled>
          <meshStandardMaterial color="#53613b" emissive="#1f2a18" emissiveIntensity={0.2 + narrativeWorldState.memoryPressure * 0.18} roughness={0.86} transparent opacity={0.24 * visualState.semanticOpacity} depthWrite={false} />
        </instancedMesh>
      </InstancedRigidBodies>
      <InstancedRigidBodies instances={interactiveSemanticRigidBodies.celestial} type="fixed" colliders={false} colliderNodes={[<BallCollider key="celestial-sensor" args={[0.48]} sensor />]}>
        <instancedMesh ref={celestialRef} args={[geometries.celestial, undefined, DECORATION_INSTANCE_COUNT]} frustumCulled>
          <meshStandardMaterial color="#aeb9ff" emissive="#7a8cff" emissiveIntensity={0.6 + narrativeWorldState.crownCount * 0.008} metalness={0.18} roughness={0.18} transparent opacity={0.48 * visualState.semanticOpacity} depthWrite={false} />
        </instancedMesh>
      </InstancedRigidBodies>
    </group>
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

  const visualByEntryId = useMemo(() => {
    const visualMap = new Map<string, Slipper3DVisual>();
    for (const candidateEntry of entries) {
      const candidateVisual = visuals.find((candidate) => candidate.id === candidateEntry.engine3d.linkedVisualId);
      if (candidateVisual) visualMap.set(candidateEntry.id, candidateVisual);
    }
    return visualMap;
  }, [entries, visuals]);

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
      <JourneyWorldComposition
        activeSceneId={narrativeScene?.id}
        activeOrigin={authoredSceneOrigin}
        qualityProfile={qualityProfile}
        reducedEffects={reducedEffects}
        reducedMotion={reducedMotion}
        renderAdjacent={false}
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
        <NarrativeAudioDirector qualityProfile={qualityProfile} />
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
              visual={visualByEntryId.get(node.entry.id)}
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
