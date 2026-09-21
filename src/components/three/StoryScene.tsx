import { useJourneyStore } from "../../stores/useJourneyStore";
import { getCurrentCinematicProfile } from "../../cinematics/emotionalCinematography";
import { getAuthoredSceneArrival } from "../../cinematics/sceneArrival";
import { EmotionalCinematographyDirector } from "./cinematics/EmotionalCinematographyDirector";
import { SpatialProseDirector } from "./storyText/SpatialProseDirector";
import { Component, memo, Suspense, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type ErrorInfo, type ReactNode } from "react";
import { Float, Html, OrbitControls, Sparkles, Stars, useGLTF, useTexture } from "@react-three/drei";
import { BallCollider, CapsuleCollider, CuboidCollider, InstancedRigidBodies, RigidBody, TrimeshCollider, useRapier, type RapierRigidBody } from "@react-three/rapier";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import type { EulerTuple, Slipper3DEntry, Slipper3DVisual, Vector3Tuple } from "../../data/slipper3dTypes";
import {
  getJourneyChapterForEntry,
  getJourneyEntryContext,
  getJourneySceneForEntry,
} from "../../data/journeyNarrative";
import {
  getJourneySceneLayout,
  getJourneyEntryBiome,
  getJourneyEntryClearingRadius,
  getJourneyEntryWorldPlacement,
  getJourneyEntryWorldPosition,
  isJourneyEntryElevated,
} from "../../data/journeyWorldLayout";
import type { ForestClearingSeed, ForestPathSeed, ForestWorkerConfig, ForestWorkerResponse, PackedForestCollider, TerrainWorkerConfig } from "../../workers/forestWorker.types";
import { getOrderedEntries } from "../../lib/storyGraph";
import { buildPhysicalStoryLinks, type PhysicalPathRole } from "../../lib/worldTopology";
import NarrativeAudioDirector from "./audio/NarrativeAudioDirector";
import EnvironmentalThreshold from "./journey/EnvironmentalThreshold";
import JourneyWorldComposition from "./journey/JourneyWorldComposition";
import WorldMemoryDirector, { type WorldMemoryState } from "./worldMemory/WorldMemoryDirector";
import { resolveWorldVisualState, type WorldVisualState } from "./worldVisualState";
import { resolveChapterDirector, type ChapterDirector } from "./chapterDirector";
import { resolveNarrativeRenderScale, shouldShowDebugOverlay, type RenderQualityProfile } from "./renderQuality";
import { classifyRouteSegment, nearestPathStatus, resolveNavigationTarget, routeClassWeight, yawFromDirection, type TrailState } from "../../lib/navigationResolver";
import { useBreadcrumbStore, type BreadcrumbKind, type BreadcrumbTrace } from "../../stores/useBreadcrumbStore";
import { usePlayerInputStore } from "../../stores/usePlayerInputStore";
import { useSettingsStore } from "../../stores/useSettingsStore";
import {
  createTerrainSurfaceSampler,
  terrainCurvedPathPointAt as sampleTerrainCurvePoint,
  terrainCurvedPathTangentAt as sampleTerrainCurveTangent,
  terrainDistanceToPathSq as sampleTerrainPathDistanceSq,
  terrainPathProjectionT as sampleTerrainPathProjectionT,
  type TerrainCurveSeed,
  type TerrainSamplerConfig,
} from "../../lib/terrainModel";
import "./StoryScene.css";

export type StorySceneControls = "orbit" | "walk" | "none";
export type StorySceneMode = "explore" | "read" | "map";

export type NarrativeWorldState = {
  visitedCount: number;
  totalCount: number;
  traceCount: number;
  fireCount: number;
  waterCount: number;
  memoryCount: number;
  thresholdCount: number;
  crownCount: number;
  fireWaterBalance: number;
  explorationDepth: number;
  memoryPressure: number;
  symbolicWeight: number;
};

export type SceneProximityState = {
  activeEntryId: string;
  nearestEntryId: string | null;
  nearestTitle: string | null;
  distance: number;
  uiPresence: number;
  insideClearing: boolean;
  playerPosition: Vector3Tuple;
  activeWorldPosition: Vector3Tuple | null;
  nearestWorldPosition: Vector3Tuple | null;
  approachingEntryId: string | null;
  approachingTitle: string | null;
  approachingDistance: number;
  approachingWorldPosition: Vector3Tuple | null;
  cameraYaw: number;
  navigationTargetId: string | null;
  navigationTargetTitle: string | null;
  navigationTargetWorldPosition: Vector3Tuple | null;
  navigationTargetDistance: number;
  navigationTargetReason: string | null;
  nearestPathDistance: number;
  trailState: TrailState;
};

type PlayerSpatialWindow = {
  position: Vector3Tuple;
  cameraYaw: number;
  navigationTargetId: string | null;
  nearestPathDistance: number;
  trailState: TrailState;
};

export type StorySceneProps = {
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
  initialPlayerPosition?: Vector3Tuple | null;
  narrativeAudioSuppressed?: boolean;
  onFinalConstellationFormationComplete?: () => void;
  onPortalSelect?: (targetEntryId: string) => void;
  onPlayerProximityChange?: (state: SceneProximityState) => void;
};

const DEFAULT_CAMERA_POSITION: Vector3Tuple = [0, 0, 0.1];
const DEFAULT_TEXT_POSITION: Vector3Tuple = [0, 0, -3];
const DEFAULT_TEXT_ROTATION: EulerTuple = [0, 0, 0];
const DEFAULT_ENVIRONMENT_RADIUS = 50;
const DEFAULT_FOV = 65;
const PLAYER_EYE_HEIGHT = 0.64;
const PLAYER_CAMERA_OFFSET_Y = 1.16;
const PLAYER_SPEED = 4.08;
const PLAYER_ACCELERATION = 10.8;
const PLAYER_LINEAR_DAMPING = 12.4;
const HEAD_BOB_AMPLITUDE = 0.014;
const HEAD_BOB_FREQUENCY = 6.8;
const PLAYER_LOOK_DOWN_LIMIT = Math.PI * 0.3;
const PLAYER_LOOK_UP_LIMIT = Math.PI * 0.28;
const CONSTELLATION_CENTER = 120;
const CONSTELLATION_WORLD_SCALE = 0.72;
const AUTHORED_WORLD_SCALE = 1.5;
const NODE_ACTIVATION_RADIUS = 3.15;
const NODE_ACTIVATION_RADIUS_SQ = NODE_ACTIVATION_RADIUS * NODE_ACTIVATION_RADIUS;
const PROXIMITY_UI_UPDATE_INTERVAL = 0.2;
const PLAYER_SPATIAL_CELL_SIZE = 6;
const NODE_APPROACH_RADIUS = 11.5;
const FOREST_CELL_SIZE = 7;
const FOREST_CELL_RADIUS = 4;
const FOREST_TREES_PER_CELL = 3;
const FOREST_INSTANCE_COUNT = (FOREST_CELL_RADIUS * 2 + 1) * (FOREST_CELL_RADIUS * 2 + 1) * FOREST_TREES_PER_CELL;
const DECORATION_CELL_SIZE = 5.5;
const DECORATION_CELL_RADIUS = 4;
const DECORATIONS_PER_CELL = 2;
const DECORATION_INSTANCE_COUNT = (DECORATION_CELL_RADIUS * 2 + 1) * (DECORATION_CELL_RADIUS * 2 + 1) * DECORATIONS_PER_CELL;
const GROUND_DETAIL_CELL_SIZE = 6.4;
const GROUND_DETAIL_CELL_RADIUS = 3;
const GROUND_DETAILS_PER_CELL = 2;
const GROUND_DETAIL_INSTANCE_COUNT = (GROUND_DETAIL_CELL_RADIUS * 2 + 1) * (GROUND_DETAIL_CELL_RADIUS * 2 + 1) * GROUND_DETAILS_PER_CELL;
const TERRAIN_SEGMENT_BOUNDS_PADDING = 24;
const SEMANTIC_REBUILD_MIN_INTERVAL = 0.18;
const SEMANTIC_SENSOR_LIMIT = 16;
const CLEARING_SAFE_RADIUS = 8.8;
const FOREST_CLEARING_RADIUS = 7.2;
const CORRIDOR_BASE_WIDTH = 5.2;
const CORRIDOR_MIN_WIDTH = 3.6;
const TREE_COLLIDER_LIMIT = 36;
const ROOTED_TRUNK_COLLIDER_SCALE = 1.72;
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
const FOREST_GROUND_ALBEDO_PATH = "/textures/forest/ground-albedo-v3.webp";
const FIRST_WOOD_PANORAMA_PATH = "/textures/environment/first-wood-panorama-v3.webp";
const FIRST_WOOD_DEPTH_PLATE_PATH = "/textures/environment/forest-sky-horizon-v1.webp";
const MOON_ALBEDO_PATH = "/textures/environment/moon-albedo-v1.png";
const MEMORY_BLOOM_TEXTURE_PATH = "/textures/forest/memory-bloom-v1.png";

// Proactively warm the drei GLTF cache so NPC encounters do not suspend the entire
// world canvas the first time the player approaches a loaded story node.
useGLTF.preload(NPC_MODEL_PATHS.wolf);
useGLTF.preload(NPC_MODEL_PATHS.phantom);
useGLTF.preload(NPC_MODEL_PATHS.swan);
useTexture.preload(FOREST_GROUND_ALBEDO_PATH);
useTexture.preload(FIRST_WOOD_PANORAMA_PATH);
useTexture.preload(MOON_ALBEDO_PATH);
useTexture.preload(MEMORY_BLOOM_TEXTURE_PATH);


type SymbolicLayerMode = "current" | "echo";

function clamp01(value: number) {
  return Math.max(0, Math.min(1, value));
}

function anchorMoonOffsetToOpening(
  camera: THREE.Camera,
  authoredPosition: Vector3Tuple,
  distance: number,
  output: THREE.Vector3,
  right: THREE.Vector3,
  up: THREE.Vector3,
) {
  camera.getWorldDirection(output);
  right.setFromMatrixColumn(camera.matrixWorld, 0).normalize();
  up.setFromMatrixColumn(camera.matrixWorld, 1).normalize();
  const authoredHorizontalLength = Math.max(0.001, Math.hypot(authoredPosition[0], authoredPosition[2]));
  const authoredSide = THREE.MathUtils.clamp(authoredPosition[0] / authoredHorizontalLength, -1, 1);
  const authoredDepth = THREE.MathUtils.clamp(-authoredPosition[2] / authoredHorizontalLength, 0, 1);
  const aspect = camera instanceof THREE.PerspectiveCamera ? camera.aspect : 1;
  const horizontalBias = authoredSide * (aspect < 0.7 ? 0.28 : 0.5);
  const elevation =
    0.345 +
    THREE.MathUtils.clamp(authoredPosition[1] / 86, 0.035, 0.1) +
    (1 - authoredDepth) * 0.035;
  return output
    .addScaledVector(right, horizontalBias)
    .addScaledVector(up, elevation)
    .normalize()
    .multiplyScalar(distance);
}

function hashString(value: string) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash += (hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24);
  }
  return Math.abs(hash >>> 0);
}

function seededUnit(seed: number, index: number) {
  const x = Math.sin(seed * 999 + index * 77.13) * 10000;
  return x - Math.floor(x);
}

function fract(value: number) {
  return value - Math.floor(value);
}

function worldSeededUnit(x: number, z: number, salt = 0) {
  return fract(Math.sin(x * 127.1 + z * 311.7 + salt * 74.7) * 43758.5453123);
}

type OrganicCrownLobe = {
  position: Vector3Tuple;
  rotation: Vector3Tuple;
  scale: Vector3Tuple;
  phase: number;
};

const ORGANIC_CROWN_LOBES: OrganicCrownLobe[] = [
  { position: [0, -0.1, 0.02], rotation: [0.04, 0.2, -0.03], scale: [0.9, 0.56, 0.84], phase: 0.4 },
  { position: [0.12, 0.48, -0.1], rotation: [-0.08, -0.34, 0.08], scale: [0.62, 0.54, 0.58], phase: 1.7 },
  { position: [-0.58, 0.08, 0.18], rotation: [0.12, 0.48, -0.14], scale: [0.56, 0.4, 0.62], phase: 3.1 },
  { position: [0.58, 0.12, -0.08], rotation: [-0.06, -0.42, 0.12], scale: [0.57, 0.43, 0.55], phase: 4.6 },
  { position: [-0.08, 0.04, -0.55], rotation: [0.1, 0.18, 0.05], scale: [0.52, 0.36, 0.6], phase: 6.2 },
  { position: [0.12, 0.02, 0.5], rotation: [-0.11, -0.12, -0.08], scale: [0.5, 0.34, 0.54], phase: 7.8 },
  { position: [-0.3, 0.42, 0.14], rotation: [0.06, 0.56, -0.12], scale: [0.43, 0.36, 0.44], phase: 9.4 },
  { position: [0.34, -0.3, 0.24], rotation: [-0.04, 0.32, 0.08], scale: [0.56, 0.28, 0.5], phase: 10.8 },
  { position: [-0.28, -0.26, -0.26], rotation: [0.08, -0.28, -0.06], scale: [0.52, 0.3, 0.54], phase: 12.1 },
];

function createOrganicCrownGeometry(detail: 0 | 1 = 0) {
  const lobes = ORGANIC_CROWN_LOBES.map((specification) => {
    // Distant trees use detail 0; the clearing ring uses detail 1. Both remain
    // one merged instanced geometry, so nearby crowns gain a softer deciduous
    // silhouette without adding draw calls across the continuous forest.
    const geometry = new THREE.IcosahedronGeometry(1, detail);
    const position = geometry.getAttribute("position") as THREE.BufferAttribute;

    for (let index = 0; index < position.count; index += 1) {
      const x = position.getX(index);
      const y = position.getY(index);
      const z = position.getZ(index);
      const lowFrequency = Math.sin(x * 3.7 + y * 4.9 + z * 3.1 + specification.phase) * 0.055;
      const highFrequency = Math.sin(x * 8.3 - y * 6.1 + z * 7.7 + specification.phase * 1.9) * 0.025;
      const contour = 1 + lowFrequency + highFrequency;
      position.setXYZ(index, x * contour, y * contour, z * contour);
    }

    position.needsUpdate = true;
    // IcosahedronGeometry is non-indexed, so computeVertexNormals() preserves
    // one normal per triangle and makes moonlit crowns read as crystals. A
    // radial field keeps the same low triangle budget while letting the nine
    // deformed lobes shade as one soft mass of leaves.
    const smoothNormals = new Float32Array(position.count * 3);
    for (let index = 0; index < position.count; index += 1) {
      const x = position.getX(index);
      const y = position.getY(index);
      const z = position.getZ(index);
      const inverseLength = 1 / Math.max(0.0001, Math.hypot(x, y, z));
      smoothNormals[index * 3] = x * inverseLength;
      smoothNormals[index * 3 + 1] = y * inverseLength;
      smoothNormals[index * 3 + 2] = z * inverseLength;
    }
    geometry.setAttribute("normal", new THREE.Float32BufferAttribute(smoothNormals, 3));
    geometry.scale(...specification.scale);
    geometry.rotateX(specification.rotation[0]);
    geometry.rotateY(specification.rotation[1]);
    geometry.rotateZ(specification.rotation[2]);
    geometry.translate(...specification.position);
    return geometry;
  });
  const merged = mergeGeometries(lobes, false);
  lobes.forEach((geometry) => geometry.dispose());

  if (!merged) return new THREE.IcosahedronGeometry(1, 1);
  merged.computeBoundingBox();
  merged.computeBoundingSphere();
  return merged;
}

function createForestTrunkGeometry() {
  // Every tree still occupies one instanced draw call. The extra silhouette is
  // baked into this shared low-poly geometry: a tapered, furrowed bole, four
  // buttress roots, and three rising limbs. This gives nearby trees believable
  // structure without creating a mesh (or React node) per branch.
  const parts: THREE.BufferGeometry[] = [];
  const trunk = new THREE.CylinderGeometry(0.56, 1.36, 1, 10, 4, false);
  const trunkPositions = trunk.getAttribute("position") as THREE.BufferAttribute;
  for (let index = 0; index < trunkPositions.count; index += 1) {
    const x = trunkPositions.getX(index);
    const y = trunkPositions.getY(index);
    const z = trunkPositions.getZ(index);
    const angle = Math.atan2(z, x);
    const height = y + 0.5;
    const furrow = 1 + Math.sin(angle * 3 + height * 5.2) * 0.055 + Math.sin(angle * 7 - height * 3.6) * 0.025;
    const centerlineX = height * height * 0.72;
    const centerlineZ = Math.sin(height * Math.PI * 1.25) * height * 0.18;
    trunkPositions.setXYZ(index, x * furrow + centerlineX, y, z * furrow + centerlineZ);
  }
  trunkPositions.needsUpdate = true;
  trunk.computeVertexNormals();
  parts.push(trunk);

  const rootAngles = [0.18, 1.74, 3.28, 4.86];
  rootAngles.forEach((angle, rootIndex) => {
    const root = new THREE.BoxGeometry(1, 1, 1);
    const positions = root.getAttribute("position") as THREE.BufferAttribute;
    const length = 3.5 + (rootIndex % 2) * 0.48;
    for (let index = 0; index < positions.count; index += 1) {
      const sourceX = positions.getX(index);
      const sourceY = positions.getY(index);
      const sourceZ = positions.getZ(index);
      const progress = sourceX + 0.5;
      const radial = 0.68 + progress * length;
      const width = (0.88 - progress * 0.62) * sourceZ;
      const localY = -0.485 + sourceY * (0.038 - progress * 0.018) + Math.sin(progress * Math.PI) * 0.012;
      const localX = Math.cos(angle) * radial - Math.sin(angle) * width;
      const localZ = Math.sin(angle) * radial + Math.cos(angle) * width;
      positions.setXYZ(index, localX, localY, localZ);
    }
    positions.needsUpdate = true;
    root.computeVertexNormals();
    parts.push(root);
  });

  const branchSpecs = [
    { angle: 0.54, baseY: 0.05, length: 4.9, rise: 0.13 },
    { angle: 2.68, baseY: 0.16, length: 4.2, rise: 0.1 },
    { angle: 4.52, baseY: 0.27, length: 3.6, rise: 0.08 },
  ];
  branchSpecs.forEach((specification) => {
    const branch = new THREE.CylinderGeometry(0.5, 0.9, 1, 5, 1, false);
    branch.rotateZ(Math.PI / 2);
    const positions = branch.getAttribute("position") as THREE.BufferAttribute;
    for (let index = 0; index < positions.count; index += 1) {
      const sourceX = positions.getX(index);
      const sourceY = positions.getY(index);
      const sourceZ = positions.getZ(index);
      const progress = sourceX + 0.5;
      const radial = 0.46 + progress * specification.length;
      const cross = sourceZ * (0.68 - progress * 0.3);
      const localY = specification.baseY + progress * specification.rise + sourceY * (0.017 - progress * 0.006);
      const localX = Math.cos(specification.angle) * radial - Math.sin(specification.angle) * cross;
      const localZ = Math.sin(specification.angle) * radial + Math.cos(specification.angle) * cross;
      positions.setXYZ(index, localX, localY, localZ);
    }
    positions.needsUpdate = true;
    branch.computeVertexNormals();
    parts.push(branch);
  });

  const merged = mergeGeometries(parts, false);
  parts.forEach((geometry) => geometry.dispose());
  if (!merged) return new THREE.CylinderGeometry(0.56, 1.36, 1, 10, 4, false);
  merged.computeVertexNormals();
  merged.computeBoundingBox();
  merged.computeBoundingSphere();
  return merged;
}

const CHAPTER_FIRST_WOOD = "The First Wood";
const CHAPTER_MIRROR_CLEARING = "The Mirror Clearing";
const CHAPTER_THORNED_HOUSE = "The Thorned House";
const CHAPTER_BLUE_MOON_ARCHIVE = "The Blue Moon Archive";
const CHAPTER_FIRE_AND_RIVER = "The Fire and River";
const CHAPTER_CROWNED_RETURN = "The Crowned Return";
const CROWNED_RETURN_BASE_RISE = 0.6;
const CROWNED_RETURN_ASCENT_HEIGHT = 6;
const TERRAIN_BASE_Y = -1.255;
const TERRAIN_COLLIDER_Y = -1.34;
const TERRAIN_SIZE = 860;
const TERRAIN_SEGMENTS = 128;
const CROWNED_RETURN_RAMP_WIDTH = 12;

type ChapterBiome = "firstWood" | "mirror" | "thorned" | "archive" | "fireRiver" | "crowned";

function isChapter(entry: Slipper3DEntry, chapter: string) {
  return entry.chapter === chapter;
}

function chapterBiome(entry: Slipper3DEntry): ChapterBiome {
  if (isChapter(entry, CHAPTER_MIRROR_CLEARING)) return "mirror";
  if (isChapter(entry, CHAPTER_THORNED_HOUSE)) return "thorned";
  if (isChapter(entry, CHAPTER_BLUE_MOON_ARCHIVE)) return "archive";
  if (isChapter(entry, CHAPTER_FIRE_AND_RIVER)) return "fireRiver";
  if (isChapter(entry, CHAPTER_CROWNED_RETURN)) return "crowned";
  return "firstWood";
}

function chapterProgress(entry: Slipper3DEntry, entries: Slipper3DEntry[], chapter: string) {
  const ordered = getOrderedEntries(entries).filter((candidate) => candidate.chapter === chapter);
  const index = ordered.findIndex((candidate) => candidate.id === entry.id);
  if (index < 0) return 0;
  return ordered.length <= 1 ? 1 : index / (ordered.length - 1);
}

function crownedReturnElevation(entry: Slipper3DEntry, entries: Slipper3DEntry[]) {
  if (!isChapter(entry, CHAPTER_CROWNED_RETURN)) return 0;
  const progress = chapterProgress(entry, entries, CHAPTER_CROWNED_RETURN);
  const eased = progress * progress * (3 - 2 * progress);
  return CROWNED_RETURN_BASE_RISE + eased * CROWNED_RETURN_ASCENT_HEIGHT;
}

function entryWorldPosition(entry: Slipper3DEntry, entries: Slipper3DEntry[]): Vector3Tuple {
  const narrativePosition = getJourneyEntryWorldPosition(entry.id);
  if (narrativePosition) return [...narrativePosition];

  const authored = entry.engine3d.worldPosition;
  const manual = entry.engine3d.constellationPosition;
  const y = crownedReturnElevation(entry, entries);

  // Compiled archives carry a deliberate 3D placement. Honour it before the
  // 2D constellation projection or procedural fallback so the walkable world
  // keeps its authored scale, spacing, and short opening route.
  if (authored) {
    return [
      authored[0] * AUTHORED_WORLD_SCALE,
      authored[1] + y,
      authored[2] * AUTHORED_WORLD_SCALE,
    ];
  }

  if (manual) {
    return [
      (manual[0] - CONSTELLATION_CENTER) * CONSTELLATION_WORLD_SCALE,
      y,
      (manual[1] - CONSTELLATION_CENTER) * CONSTELLATION_WORLD_SCALE,
    ];
  }

  const index = Math.max(0, entries.findIndex((candidate) => candidate.id === entry.id));
  const angle = index * 2.399963229728653;
  const radius = 8 + Math.sqrt(index + 1) * 5.2;
  return [Math.cos(angle) * radius, y, Math.sin(angle) * radius];
}

function nearestEntryByXZ(x: number, z: number, entries: Slipper3DEntry[]) {
  let nearest: Slipper3DEntry | null = null;
  let nearestDistanceSq = Number.POSITIVE_INFINITY;

  for (const entry of entries) {
    const position = entryWorldPosition(entry, entries);
    const dx = x - position[0];
    const dz = z - position[2];
    const distanceSq = dx * dx + dz * dz;
    if (distanceSq < nearestDistanceSq) {
      nearest = entry;
      nearestDistanceSq = distanceSq;
    }
  }

  return { entry: nearest, distanceSq: nearestDistanceSq };
}

type SpatialStoryNode = {
  entry: Slipper3DEntry;
  position: Vector3Tuple;
  isActive: boolean;
  isVisited: boolean;
  graphDistance: 0 | 1 | 2;
};

function buildSpatialStoryNodes({
  activeEntryId,
  entries,
  visitedEntryIds,
}: {
  activeEntryId: string;
  entries: Slipper3DEntry[];
  visitedEntryIds: string[];
}): SpatialStoryNode[] {
  const links = buildPhysicalStoryLinks(entries.map((entry) => ({
    id: entry.id,
    chapter: entry.chapter,
    sequence: entry.sequence,
    position: entryWorldPosition(entry, entries),
  })));
  const neighborIds = new Set<string>();

  for (const link of links) {
    if (link.sourceId === activeEntryId) neighborIds.add(link.targetId);
    if (link.targetId === activeEntryId) neighborIds.add(link.sourceId);
  }

  const visitedSet = new Set(visitedEntryIds);

  return entries.map((entry): SpatialStoryNode => {
    const isActive = entry.id === activeEntryId;
    return {
      entry,
      position: entryWorldPosition(entry, entries),
      isActive,
      isVisited: visitedSet.has(entry.id),
      graphDistance: isActive ? 0 : neighborIds.has(entry.id) ? 1 : 2,
    };
  });
}

function allClearingPositions(entries: Slipper3DEntry[]): Vector3Tuple[] {
  return entries.map((entry) => entryWorldPosition(entry, entries));
}

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



type PlayerControlState = {
  forward: boolean;
  backward: boolean;
  left: boolean;
  right: boolean;
};

function setPlayerKey(state: PlayerControlState, event: KeyboardEvent, pressed: boolean) {
  switch (event.code) {
    case "KeyW":
    case "ArrowUp":
      state.forward = pressed;
      return true;
    case "KeyS":
    case "ArrowDown":
      state.backward = pressed;
      return true;
    case "KeyA":
    case "ArrowLeft":
      state.left = pressed;
      return true;
    case "KeyD":
    case "ArrowRight":
      state.right = pressed;
      return true;
    default:
      return false;
  }
}

function resetPlayerKeys(state: PlayerControlState) {
  state.forward = false;
  state.backward = false;
  state.left = false;
  state.right = false;
}

function usePlayerControls(enabled: boolean) {
  const keysRef = useRef<PlayerControlState>({
    forward: false,
    backward: false,
    left: false,
    right: false,
  });

  useEffect(() => {
    const keys = keysRef.current;

    if (!enabled) {
      resetPlayerKeys(keys);
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const isTyping = target?.tagName === "INPUT" || target?.tagName === "TEXTAREA" || target?.isContentEditable;
      if (isTyping) return;

      if (setPlayerKey(keys, event, true)) {
        event.preventDefault();
      }
    };

    const handleKeyUp = (event: KeyboardEvent) => {
      if (setPlayerKey(keys, event, false)) {
        event.preventDefault();
      }
    };

    const handleBlur = () => resetPlayerKeys(keys);

    window.addEventListener("keydown", handleKeyDown, { passive: false });
    window.addEventListener("keyup", handleKeyUp, { passive: false });
    window.addEventListener("blur", handleBlur);

    return () => {
      resetPlayerKeys(keys);
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
      window.removeEventListener("blur", handleBlur);
    };
  }, [enabled]);

  return keysRef;
}

const PLAYER_RADIUS = 0.28;
const PLAYER_HALF_HEIGHT = 0.54;
const PLAYER_FOOT_OFFSET = PLAYER_HALF_HEIGHT + PLAYER_RADIUS;
const PLAYER_GROUND_CLEARANCE = 0.035;
const PLAYER_KCC_OFFSET = 0.045;
const PLAYER_GRAVITY = 18;
const PLAYER_MAX_FALL_SPEED = 22;
const PLAYER_GROUND_SNAP = 0.34;
const PLAYER_STEP_HEIGHT = 0.42;
const PLAYER_MIN_STEP_WIDTH = 0.18;
const PLAYER_SLOPE_LIMIT_RADIANS = THREE.MathUtils.degToRad(48);

function readReducedExperiencePreferences() {
  if (typeof document === "undefined") {
    return { reducedMotion: false, reducedEffects: false };
  }

  const root = document.documentElement;
  return {
    reducedMotion:
      root.dataset.motion === "reduced" ||
      root.classList.contains("sidtw-reduced-motion"),
    reducedEffects:
      root.dataset.effects === "reduced" ||
      root.classList.contains("sidtw-reduced-effects"),
  };
}

function FirstPersonPlayer({
  enabled,
  movementEnabled,
  cameraReadyRef,
  initialPosition,
  activeEntry,
  narrativeWorldState,
  sampleGroundY,
}: {
  enabled: boolean;
  movementEnabled: boolean;
  cameraReadyRef: { current: boolean };
  initialPosition: Vector3Tuple;
  activeEntry: Slipper3DEntry;
  narrativeWorldState: NarrativeWorldState;
  sampleGroundY: (x: number, z: number) => number;
}) {
  const { camera } = useThree();
  const { world } = useRapier();

  const director = useMemo(() => resolveChapterDirector(activeEntry), [activeEntry]);
  const bodyRef = useRef<RapierRigidBody>(null);
  const colliderRef = useRef<any>(null);
  const controllerRef = useRef<any>(null);
  const hasSpawnedRef = useRef(false);
  const keysRef = usePlayerControls(enabled && movementEnabled);

  const horizontalVelocityRef = useRef(new THREE.Vector3());
  const targetVelocityRef = useRef(new THREE.Vector3());
  const desiredMoveRef = useRef(new THREE.Vector3());
  const forwardRef = useRef(new THREE.Vector3());
  const rightRef = useRef(new THREE.Vector3());
  const lookRotationRef = useRef(new THREE.Euler());
  const lookDeltaRef = useRef({ x: 0, y: 0 });
  const verticalVelocityRef = useRef(0);
  const bobPhaseRef = useRef(0);
  const reducedPreferencesRef = useRef(readReducedExperiencePreferences());
  const groundProbeRef = useRef({ x: Number.NaN, z: Number.NaN, y: initialPosition[1] - PLAYER_FOOT_OFFSET - PLAYER_GROUND_CLEARANCE });
  const groundProbeTimerRef = useRef(0);
  const cameraHeightRef = useRef(
    activeEntry.id === "fragment-001" && !movementEnabled ? 0.08 : PLAYER_CAMERA_OFFSET_Y,
  );

  useEffect(() => {
    const controller = world.createCharacterController(PLAYER_KCC_OFFSET);
    controller.setUp({ x: 0, y: 1, z: 0 });
    controller.enableAutostep(PLAYER_STEP_HEIGHT, PLAYER_MIN_STEP_WIDTH, true);
    controller.enableSnapToGround(PLAYER_GROUND_SNAP);
    controller.setMaxSlopeClimbAngle(PLAYER_SLOPE_LIMIT_RADIANS);
    controller.setMinSlopeSlideAngle(THREE.MathUtils.degToRad(58));
    controllerRef.current = controller;

    return () => {
      world.removeCharacterController(controller);
      controllerRef.current = null;
    };
  }, [world]);

  useEffect(() => {
    const body = bodyRef.current;
    if (!body || hasSpawnedRef.current) return;
    body.setTranslation({ x: initialPosition[0], y: initialPosition[1], z: initialPosition[2] }, true);
    body.setNextKinematicTranslation({ x: initialPosition[0], y: initialPosition[1], z: initialPosition[2] });
    verticalVelocityRef.current = 0;
    groundProbeRef.current = { x: initialPosition[0], z: initialPosition[2], y: initialPosition[1] - PLAYER_FOOT_OFFSET - PLAYER_GROUND_CLEARANCE };
    groundProbeTimerRef.current = 0;
    hasSpawnedRef.current = true;
  }, [initialPosition]);

  useEffect(() => {
    if (typeof document === "undefined") return;
    const root = document.documentElement;
    const sync = () => {
      reducedPreferencesRef.current = readReducedExperiencePreferences();
    };
    const observer = new MutationObserver(sync);
    observer.observe(root, {
      attributes: true,
      attributeFilter: ["class", "data-motion", "data-effects"],
    });
    sync();
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!enabled || !movementEnabled) {
      usePlayerInputStore.getState().reset();
      horizontalVelocityRef.current.set(0, 0, 0);
      targetVelocityRef.current.set(0, 0, 0);
      desiredMoveRef.current.set(0, 0, 0);
      verticalVelocityRef.current = 0;
    }
  }, [enabled, movementEnabled]);

  useFrame((_, delta) => {
    const body = bodyRef.current;
    const collider = colliderRef.current;
    const controller = controllerRef.current;
    if (!body || !collider || !controller) return;

    const step = Math.min(delta, 0.05);
    const current = body.translation();
    const openingCameraHeight =
      activeEntry.id === "fragment-001" && !movementEnabled
        ? 0.08
        : PLAYER_CAMERA_OFFSET_Y;
    cameraHeightRef.current = THREE.MathUtils.lerp(
      cameraHeightRef.current,
      openingCameraHeight,
      1 - Math.exp(-step * (movementEnabled ? 1.45 : 4.2)),
    );

    if (!enabled || !cameraReadyRef.current) {
      camera.position.set(current.x, current.y + cameraHeightRef.current, current.z);
      return;
    }

    const keys = keysRef.current;
    const forward = forwardRef.current;
    const right = rightRef.current;
    const targetVelocity = targetVelocityRef.current.set(0, 0, 0);
    const horizontalVelocity = horizontalVelocityRef.current;
    const mobileInput = usePlayerInputStore.getState();
    const lookDelta = mobileInput.consumeLookDelta(lookDeltaRef.current);
    if (lookDelta.x !== 0 || lookDelta.y !== 0) {
      const rotation = lookRotationRef.current.setFromQuaternion(
        camera.quaternion,
        "YXZ",
      );
      const motionScale = reducedPreferencesRef.current.reducedMotion ? 0.72 : 1;
      rotation.y -= lookDelta.x * 0.0032 * motionScale;
      rotation.x = THREE.MathUtils.clamp(
        rotation.x - lookDelta.y * 0.0032 * motionScale,
        -PLAYER_LOOK_DOWN_LIMIT,
        PLAYER_LOOK_UP_LIMIT,
      );
      camera.quaternion.setFromEuler(rotation);
    }

    if (!movementEnabled) {
      camera.position.set(current.x, current.y + cameraHeightRef.current, current.z);
      return;
    }

    camera.getWorldDirection(forward);
    forward.y = 0;
    if (forward.lengthSq() > 0.0001) forward.normalize();

    right.copy(forward).cross(camera.up);
    if (right.lengthSq() > 0.0001) right.normalize();

    if (keys.forward) targetVelocity.add(forward);
    if (keys.backward) targetVelocity.addScaledVector(forward, -1);
    if (keys.right) targetVelocity.add(right);
    if (keys.left) targetVelocity.addScaledVector(right, -1);
    if (mobileInput.moveZ !== 0) targetVelocity.addScaledVector(forward, mobileInput.moveZ);
    if (mobileInput.moveX !== 0) targetVelocity.addScaledVector(right, mobileInput.moveX);

    const emotionalSlowdown = 1 - clamp01(narrativeWorldState.memoryPressure) * 0.055;
    const directedSpeed = PLAYER_SPEED * director.movementSpeedMultiplier * emotionalSlowdown / getCurrentCinematicProfile().movementWeight;
    const keyboardMagnitude =
      keys.forward || keys.backward || keys.right || keys.left ? 1 : 0;
    const mobileMagnitude = Math.min(
      1,
      Math.hypot(mobileInput.moveX, mobileInput.moveZ),
    );
    const requestedMagnitude = Math.max(keyboardMagnitude, mobileMagnitude);
    if (targetVelocity.lengthSq() > 0.0001) {
      targetVelocity
        .normalize()
        .multiplyScalar(directedSpeed * requestedMagnitude);
    }

    horizontalVelocity.lerp(targetVelocity, 1 - Math.exp(-step * PLAYER_ACCELERATION));
    verticalVelocityRef.current = Math.max(verticalVelocityRef.current - PLAYER_GRAVITY * step, -PLAYER_MAX_FALL_SPEED);

    const desiredMove = desiredMoveRef.current.set(horizontalVelocity.x * step, verticalVelocityRef.current * step, horizontalVelocity.z * step);
    controller.computeColliderMovement(collider, { x: desiredMove.x, y: desiredMove.y, z: desiredMove.z });
    const corrected = controller.computedMovement();

    if (controller.computedGrounded()) verticalVelocityRef.current = Math.max(0, verticalVelocityRef.current);

    const next = { x: current.x + corrected.x, y: current.y + corrected.y, z: current.z + corrected.z };

    // The forest floor is procedural, so the player needs both Rapier collision
    // resolution and a deterministic terrain probe. The probe is a defensive
    // guard against a frame where the terrain collider is still mounting or the
    // KCC misses a steep generated triangle: the capsule is never allowed to
    // sink below the rendered ground surface.
    groundProbeTimerRef.current += step;
    const cachedGround = groundProbeRef.current;
    const probeDx = next.x - cachedGround.x;
    const probeDz = next.z - cachedGround.z;
    if (!Number.isFinite(cachedGround.y) || probeDx * probeDx + probeDz * probeDz > 0.18 || groundProbeTimerRef.current >= 0.065) {
      cachedGround.x = next.x;
      cachedGround.z = next.z;
      cachedGround.y = sampleGroundY(next.x, next.z);
      groundProbeTimerRef.current = 0;
    }
    const groundY = cachedGround.y;
    const minimumBodyY = groundY + PLAYER_FOOT_OFFSET + PLAYER_GROUND_CLEARANCE;
    const groundDelta = next.y - minimumBodyY;
    const isFallingOrGrounded = verticalVelocityRef.current <= 0 || controller.computedGrounded();
    const shouldTerrainSnap = groundDelta < -0.012 || (isFallingOrGrounded && groundDelta < PLAYER_GROUND_SNAP && horizontalVelocity.lengthSq() > 0.0001);

    if (shouldTerrainSnap) {
      next.y = minimumBodyY;
      verticalVelocityRef.current = 0;
    }

    body.setNextKinematicTranslation(next);

    const speedRatio = clamp01(horizontalVelocity.length() / Math.max(0.001, PLAYER_SPEED));
    const bobSuppression = 1 - clamp01(narrativeWorldState.memoryPressure) * 0.18;
    bobPhaseRef.current += step * HEAD_BOB_FREQUENCY * (0.22 + speedRatio);
    const bob =
      reducedPreferencesRef.current.reducedMotion ||
      reducedPreferencesRef.current.reducedEffects
        ? 0
        : Math.sin(bobPhaseRef.current) *
          HEAD_BOB_AMPLITUDE *
          speedRatio *
          bobSuppression;
    camera.position.set(next.x, next.y + cameraHeightRef.current + bob, next.z);
  });

  return (
    <RigidBody ref={bodyRef} type="kinematicPosition" position={initialPosition} colliders={false} lockRotations canSleep={false}>
      <CapsuleCollider ref={colliderRef} args={[PLAYER_HALF_HEIGHT, PLAYER_RADIUS]} position={[0, 0, 0]} friction={0} restitution={0} />
    </RigidBody>
  );
}

type PlayerLanternPalette = {
  color: string;
  emissive: string;
  glassOpacity: number;
  pointIntensity: number;
  spotIntensity: number;
};

function lanternPaletteForWorldState(narrativeWorldState: NarrativeWorldState): PlayerLanternPalette {
  const balance = narrativeWorldState.fireWaterBalance;
  const pressure = narrativeWorldState.memoryPressure;
  const depth = narrativeWorldState.explorationDepth;
  const pressureDim = THREE.MathUtils.lerp(1, 0.78, clamp01(pressure));

  if (balance > 0.2) {
    return {
      color: "#ff9a42",
      emissive: "#ff6a1a",
      glassOpacity: 0.42,
      pointIntensity: (1.45 + depth * 0.12) * pressureDim,
      spotIntensity: (2.85 + depth * 0.42) * pressureDim,
    };
  }

  if (balance < -0.2) {
    return {
      color: "#8fd7ff",
      emissive: "#52bfff",
      glassOpacity: 0.34,
      pointIntensity: (1.1 + depth * 0.1) * pressureDim,
      spotIntensity: (2.35 + depth * 0.36) * pressureDim,
    };
  }

  return {
    color: "#ffd77a",
    emissive: "#ffb84d",
    glassOpacity: 0.38,
    pointIntensity: (1.25 + depth * 0.11) * pressureDim,
    spotIntensity: (2.55 + depth * 0.38) * pressureDim,
  };
}

function PlayerLantern({
  activeEntry,
  narrativeWorldState,
  visualState,
  qualityProfile,
  navigationTargetPosition,
}: {
  activeEntry: Slipper3DEntry;
  narrativeWorldState: NarrativeWorldState;
  visualState: WorldVisualState;
  qualityProfile: RenderQualityProfile;
  navigationTargetPosition?: Vector3Tuple | null;
}) {
  const { camera } = useThree();
  const groupRef = useRef<THREE.Group>(null);
  const pointLightRef = useRef<THREE.PointLight>(null);
  const spotLightRef = useRef<THREE.SpotLight>(null);
  const spotTargetRef = useRef<THREE.Object3D>(null);

  const forwardRef = useRef(new THREE.Vector3());
  const rightRef = useRef(new THREE.Vector3());
  const toTargetRef = useRef(new THREE.Vector3());
  const targetPositionRef = useRef(new THREE.Vector3());
  const lanternWorldPositionRef = useRef(new THREE.Vector3());

  const lanternColorRef = useRef(new THREE.Color("#ffd77a"));
  const targetLanternColorRef = useRef(new THREE.Color("#ffd77a"));
  const neutralLanternColorRef = useRef(new THREE.Color("#ffd77a"));
  const fireLanternColorRef = useRef(new THREE.Color("#ff8a2a"));
  const waterLanternColorRef = useRef(new THREE.Color("#86d8ff"));
  const guideColorRef = useRef(new THREE.Color());

  const director = useMemo(() => resolveChapterDirector(activeEntry), [activeEntry]);
  const palette = useMemo(() => lanternPaletteForWorldState(narrativeWorldState), [narrativeWorldState]);

  useFrame((state, delta) => {
    const group = groupRef.current;
    if (!group) return;

    const elapsed = state.clock.elapsedTime;
    const pressure = clamp01(narrativeWorldState.memoryPressure);
    const balance = THREE.MathUtils.clamp(narrativeWorldState.fireWaterBalance, -1, 1);
    const instability = 1 - visualState.lanternStability;

    const carryBobX = Math.sin(elapsed * 2) * (0.075 + instability * 0.035);
    const carryBobY = Math.cos(elapsed * 3) * (0.035 + instability * 0.02);
    const carryBobZ = Math.sin(elapsed * 1.55 + 0.7) * (0.025 + instability * 0.012);

    const idleSwayX = Math.sin(elapsed * 1.45) * (0.011 + instability * 0.012);
    const idleSwayY = Math.cos(elapsed * 1.9) * (0.016 + instability * 0.018);
    const walkingPulse = Math.sin(elapsed * 8.2) * (0.005 + instability * 0.006);
    const breathingDriftZ = Math.cos(elapsed * 1.15) * (0.009 + instability * 0.008);

    group.position.copy(camera.position);
    group.rotation.copy(camera.rotation);

    group.translateX(0.46 + idleSwayX + carryBobX * 0.25);
    group.translateY(-0.34 + idleSwayY + walkingPulse + carryBobY * 0.35);
    group.translateZ(-0.78 + breathingDriftZ + carryBobZ);

    group.rotation.z += Math.sin(elapsed * 1.35) * (0.016 + instability * 0.02);
    group.rotation.x += Math.cos(elapsed * 1.1) * (0.007 + instability * 0.012);

    camera.getWorldDirection(forwardRef.current);
    rightRef.current.setFromMatrixColumn(camera.matrixWorld, 0).normalize();

    let guidanceAlignment = 0;
    if (navigationTargetPosition) {
      toTargetRef.current.set(
        navigationTargetPosition[0] - camera.position.x,
        navigationTargetPosition[1] - camera.position.y,
        navigationTargetPosition[2] - camera.position.z,
      );
      if (toTargetRef.current.lengthSq() > 0.001) {
        toTargetRef.current.normalize();
        guidanceAlignment = clamp01((forwardRef.current.dot(toTargetRef.current) + 0.12) / 1.12);
      }
    }

    const pointLight = pointLightRef.current;
    const spotLight = spotLightRef.current;
    const spotTarget = spotTargetRef.current;

    const highPressureDimming = THREE.MathUtils.lerp(1, 0.66, pressure);
    const emotionalFlicker =
      1 -
      pressure * (0.04 + instability * 0.045) +
      Math.sin(elapsed * (7.4 + pressure * 4.2)) * pressure * (0.025 + instability * 0.05) +
      Math.sin(elapsed * 17.2) * pressure * (0.01 + instability * 0.024);

    const guidanceStability = THREE.MathUtils.lerp(0.88, 1.14, guidanceAlignment);
    const reach = visualState.lanternReach * THREE.MathUtils.lerp(0.78, 1.16, guidanceAlignment);

    targetLanternColorRef.current.copy(neutralLanternColorRef.current);
    if (balance >= 0) {
      targetLanternColorRef.current.lerp(fireLanternColorRef.current, balance);
    } else {
      targetLanternColorRef.current.lerp(waterLanternColorRef.current, Math.abs(balance));
    }

    guideColorRef.current.set(visualState.palette.particle);
    targetLanternColorRef.current.lerp(guideColorRef.current, guidanceAlignment * 0.18);
    lanternColorRef.current.lerp(targetLanternColorRef.current, 1 - Math.exp(-delta * 5.2));

    if (pointLight) {
      lanternWorldPositionRef.current.copy(camera.position);
      lanternWorldPositionRef.current.addScaledVector(rightRef.current, 0.16 + carryBobX);
      lanternWorldPositionRef.current.addScaledVector(forwardRef.current, 0.52 + carryBobZ);
      lanternWorldPositionRef.current.y += -0.2 + carryBobY;

      pointLight.position.copy(lanternWorldPositionRef.current);
      pointLight.color.copy(lanternColorRef.current);
      pointLight.intensity = THREE.MathUtils.lerp(
        pointLight.intensity,
        palette.pointIntensity * emotionalFlicker * highPressureDimming * guidanceStability * (0.72 + director.skyOpenness * 0.14 + visualState.clearingGlowIntensity * 0.12),
        1 - Math.exp(-delta * 4.2),
      );
      pointLight.distance = THREE.MathUtils.lerp(pointLight.distance, 4.4 + reach * 0.22, 1 - Math.exp(-delta * 3.2));
    }

    if (spotLight && spotTarget) {
      targetPositionRef.current.copy(camera.position).addScaledVector(forwardRef.current, reach);
      targetPositionRef.current.y -= 0.38;
      spotTarget.position.copy(targetPositionRef.current);
      spotTarget.updateMatrixWorld();
      spotLight.target = spotTarget;
      spotLight.color.copy(lanternColorRef.current);
      const targetAngle = THREE.MathUtils.lerp(0.48, 0.25, clamp01(director.lanternNarrowness + pressure * 0.12 - guidanceAlignment * 0.16));
      spotLight.angle = THREE.MathUtils.lerp(spotLight.angle, targetAngle, 1 - Math.exp(-delta * 3.4));
      spotLight.distance = THREE.MathUtils.lerp(spotLight.distance, reach, 1 - Math.exp(-delta * 2.8));
      spotLight.intensity = THREE.MathUtils.lerp(
        spotLight.intensity,
        palette.spotIntensity * emotionalFlicker * highPressureDimming * guidanceStability * (0.78 + director.pathClarity * 0.14 + visualState.pathGlowIntensity * 0.12),
        1 - Math.exp(-delta * 3.5),
      );
    }
  });

  const castLanternShadow = qualityProfile.enableLanternShadows && qualityProfile.quality === "cinematic";
  const shadowBias = -0.0006 - visualState.shadowStrength * 0.0008;

  return (
    <>
      <object3D ref={spotTargetRef} />
      <pointLight
        ref={pointLightRef}
        color={palette.color}
        intensity={palette.pointIntensity}
        distance={5.8}
        decay={1.85}
        castShadow={castLanternShadow}
        shadow-mapSize={[256, 256]}
        shadow-camera-far={10}
        shadow-bias={shadowBias}
        shadow-normalBias={0.035}
      />

      <group ref={groupRef} renderOrder={60}>
        <spotLight
          ref={spotLightRef}
          color={palette.color}
          intensity={palette.spotIntensity}
          distance={visualState.lanternReach}
          angle={0.38}
          penumbra={0.8}
          decay={1.42}
          position={[0, 0.04, -0.18]}
          castShadow={false}
        />

        <group scale={[0.72, 0.72, 0.72]}>
          <mesh position={[0, 0.16, 0]} rotation={[0, 0, Math.PI / 2]}>
            <torusGeometry args={[0.18, 0.014, 10, 36, Math.PI]} />
            <meshStandardMaterial color="#2a2118" metalness={0.62} roughness={0.32} emissive={palette.emissive} emissiveIntensity={0.03} />
          </mesh>

          <mesh position={[0, -0.06, 0]}>
            <cylinderGeometry args={[0.105, 0.13, 0.12, 18]} />
            <meshStandardMaterial color="#211811" metalness={0.72} roughness={0.28} emissive={palette.emissive} emissiveIntensity={0.04} />
          </mesh>

          <mesh position={[0, -0.185, 0]}>
            <cylinderGeometry args={[0.16, 0.19, 0.08, 20]} />
            <meshStandardMaterial color="#1a130d" metalness={0.78} roughness={0.26} emissive={palette.emissive} emissiveIntensity={0.05} />
          </mesh>

          <mesh position={[0, -0.005, 0]}>
            <cylinderGeometry args={[0.115, 0.135, 0.24, 28, 1, true]} />
            <meshPhysicalMaterial
              color={palette.color}
              emissive={palette.emissive}
              emissiveIntensity={0.62 + visualState.pathGlowIntensity * 0.08}
              transparent
              opacity={palette.glassOpacity}
              roughness={0.08}
              metalness={0.02}
              transmission={0.24}
              thickness={0.08}
              depthWrite={false}
            />
          </mesh>

          <mesh position={[0, -0.005, 0]}>
            <sphereGeometry args={[0.075, 16, 10]} />
            <meshBasicMaterial color={palette.color} transparent opacity={0.58} depthWrite={false} toneMapped={false} />
          </mesh>

          <mesh position={[0, -0.005, -0.004]}>
            <sphereGeometry args={[0.18, 20, 12]} />
            <meshBasicMaterial color={palette.color} transparent opacity={0.11 + narrativeWorldState.memoryPressure * 0.08 + visualState.pathGlowIntensity * 0.025} depthWrite={false} toneMapped={false} />
          </mesh>

          <mesh position={[0, 0.082, 0]}>
            <cylinderGeometry args={[0.13, 0.105, 0.035, 24]} />
            <meshStandardMaterial color="#2a2118" metalness={0.68} roughness={0.3} emissive={palette.emissive} emissiveIntensity={0.03} />
          </mesh>

          <mesh position={[-0.095, -0.04, 0]}>
            <cylinderGeometry args={[0.009, 0.009, 0.22, 8]} />
            <meshStandardMaterial color="#110d09" metalness={0.65} roughness={0.4} />
          </mesh>
          <mesh position={[0.095, -0.04, 0]}>
            <cylinderGeometry args={[0.009, 0.009, 0.22, 8]} />
            <meshStandardMaterial color="#110d09" metalness={0.65} roughness={0.4} />
          </mesh>
          <mesh position={[0, -0.04, -0.095]}>
            <cylinderGeometry args={[0.009, 0.009, 0.22, 8]} />
            <meshStandardMaterial color="#110d09" metalness={0.65} roughness={0.4} />
          </mesh>
          <mesh position={[0, -0.04, 0.095]}>
            <cylinderGeometry args={[0.009, 0.009, 0.22, 8]} />
            <meshStandardMaterial color="#110d09" metalness={0.65} roughness={0.4} />
          </mesh>
        </group>
      </group>
    </>
  );
}

function AnimatedSceneCamera({
  entry,
  mode,
  controls,
  cameraReadyRef,
  activePosition,
  playerInitialPosition,
  guidanceLookTarget,
  reducedMotion,
}: {
  entry: Slipper3DEntry;
  mode: StorySceneMode;
  controls: StorySceneControls;
  cameraReadyRef: { current: boolean };
  activePosition: Vector3Tuple;
  playerInitialPosition: Vector3Tuple;
  guidanceLookTarget: Vector3Tuple | null;
  reducedMotion: boolean;
}) {
  const { camera } = useThree();
  const progressRef = useRef(0);
  const hasInitialisedRef = useRef(false);
  const fromRef = useRef(new THREE.Vector3());
  const toRef = useRef(new THREE.Vector3());
  const lookAtRef = useRef(new THREE.Vector3());
  const start = entry.engine3d.cameraStart ?? DEFAULT_CAMERA_POSITION;
  const target = entry.engine3d.cameraTarget ?? [0, 0, -1];
  const fov = entry.engine3d.cameraFov ?? DEFAULT_FOV;
  const entryOffset = mode === "read" ? 0.22 : 0.36;

  useEffect(() => {
    if (hasInitialisedRef.current) {
      cameraReadyRef.current = true;
      return;
    }

    const isWalkMode = mode === "explore" && controls === "walk";
    const atUnresolvedFloor = isWalkMode && entry.id === "fragment-001" && !useJourneyStore.getState().completedRitualIds.includes("ritual.accept-lantern");
    const cameraOriginX = isWalkMode ? playerInitialPosition[0] : activePosition[0] + start[0];
    const cameraOriginY = isWalkMode
      ? playerInitialPosition[1] + (atUnresolvedFloor ? .08 : PLAYER_CAMERA_OFFSET_Y)
      : activePosition[1] + start[1];
    const cameraOriginZ = isWalkMode ? playerInitialPosition[2] : activePosition[2] + start[2];

    cameraReadyRef.current = false;
    progressRef.current = 0;
    fromRef.current.set(
      cameraOriginX + entryOffset,
      cameraOriginY + 0.04,
      cameraOriginZ + 0.65,
    );
    toRef.current.set(cameraOriginX, cameraOriginY, cameraOriginZ);
    if (isWalkMode && guidanceLookTarget) {
      lookAtRef.current.set(...guidanceLookTarget);
      // Keep the opening composition on the path horizon. A lower sampled
      // terrain point can otherwise pitch the first-person camera into a hill.
      lookAtRef.current.y = Math.max(lookAtRef.current.y, cameraOriginY + 0.12);
    } else {
      lookAtRef.current.set(
        activePosition[0] + target[0],
        activePosition[1] + (isWalkMode ? Math.max(target[1], PLAYER_EYE_HEIGHT * 0.82) : target[1]),
        activePosition[2] + target[2],
      );
    }
    if (atUnresolvedFloor) {
      const dx = lookAtRef.current.x - cameraOriginX;
      const dz = lookAtRef.current.z - cameraOriginZ;
      const length = Math.max(.1, Math.hypot(dx, dz));
      lookAtRef.current.set(cameraOriginX + dx / length * 2.3, cameraOriginY - .7, cameraOriginZ + dz / length * 2.3);
    }
    camera.position.copy(fromRef.current);
    camera.lookAt(lookAtRef.current);

    if (camera instanceof THREE.PerspectiveCamera) {
      camera.fov = mode === "read" ? Math.max(52, fov - 8) : fov;
      camera.updateProjectionMatrix();
    }

    if (reducedMotion) {
      camera.position.copy(toRef.current);
      camera.lookAt(lookAtRef.current);
      progressRef.current = 1;
      cameraReadyRef.current = true;
    }

    hasInitialisedRef.current = true;
  }, [activePosition, camera, cameraReadyRef, controls, entryOffset, fov, guidanceLookTarget, mode, playerInitialPosition, reducedMotion, start, target]);

  useFrame((_, delta) => {
    if (reducedMotion && progressRef.current < 1) {
      camera.position.copy(toRef.current);
      camera.lookAt(lookAtRef.current);
      progressRef.current = 1;
      cameraReadyRef.current = true;
      return;
    }

    if (progressRef.current >= 1) {
      cameraReadyRef.current = true;
      return;
    }

    progressRef.current = Math.min(1, progressRef.current + delta * 1.85);
    const eased = 1 - Math.pow(1 - progressRef.current, 3);
    camera.position.lerpVectors(fromRef.current, toRef.current, eased);
    camera.lookAt(lookAtRef.current);

    if (progressRef.current >= 1) {
      cameraReadyRef.current = true;
    }
  });

  return null;
}

function EnvironmentSphere({ src, radius }: { src: string; radius: number }) {
  const texture = useTexture(src);
  const meshRef = useRef<THREE.Mesh>(null);
  const { camera } = useThree();

  useEffect(() => {
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.wrapS = THREE.ClampToEdgeWrapping;
    texture.wrapT = THREE.ClampToEdgeWrapping;
    texture.needsUpdate = true;
  }, [texture]);

  useFrame(() => {
    if (meshRef.current) meshRef.current.position.copy(camera.position);
  });

  return (
    <mesh ref={meshRef} scale={[-1, 1, 1]}>
      <sphereGeometry args={[radius, 96, 64]} />
      <meshBasicMaterial map={texture} side={THREE.DoubleSide} toneMapped={false} />
    </mesh>
  );
}

function CinematicForestDepthPlate({ visualState }: { visualState: WorldVisualState }) {
  const texture = useTexture(FIRST_WOOD_DEPTH_PLATE_PATH);
  const meshRef = useRef<THREE.Mesh>(null);
  const offsetRef = useRef(new THREE.Vector3());
  const settlingTimeRef = useRef(0);
  const { camera } = useThree();
  const targetFogColorRef = useRef(new THREE.Color(visualState.fogColor));
  const targetSkyColorRef = useRef(new THREE.Color(visualState.moonColor));
  const targetOpacityRef = useRef(0.7);
  const targetFogStrengthRef = useRef(0.4);
  const uniforms = useMemo(
    () => ({
      plateMap: { value: texture },
      fogTint: { value: new THREE.Color(visualState.fogColor) },
      skyTint: { value: new THREE.Color(visualState.moonColor) },
      plateOpacity: { value: 0.7 },
      fogStrength: { value: 0.4 },
    }),
    [texture],
  );

  useEffect(() => {
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.wrapS = THREE.ClampToEdgeWrapping;
    texture.wrapT = THREE.ClampToEdgeWrapping;
    texture.minFilter = THREE.LinearMipmapLinearFilter;
    texture.magFilter = THREE.LinearFilter;
    texture.anisotropy = 2;
    texture.needsUpdate = true;
  }, [texture]);

  useEffect(() => {
    targetFogColorRef.current.set(visualState.fogColor);
    targetSkyColorRef.current.set(visualState.moonColor);
    targetOpacityRef.current = 0.58 + visualState.director.skyOpenness * 0.2;
    targetFogStrengthRef.current = THREE.MathUtils.clamp((visualState.fogDensity - 0.0032) / 0.0088, 0, 1);
  }, [visualState.director.skyOpenness, visualState.fogColor, visualState.fogDensity, visualState.moonColor]);

  useFrame((_, delta) => {
    const mesh = meshRef.current;
    if (!mesh) return;

    const smoothing = 1 - Math.exp(-Math.min(delta, 0.05) * 1.25);
    uniforms.fogTint.value.lerp(targetFogColorRef.current, smoothing);
    uniforms.skyTint.value.lerp(targetSkyColorRef.current, smoothing);
    uniforms.plateOpacity.value = THREE.MathUtils.lerp(
      uniforms.plateOpacity.value,
      targetOpacityRef.current,
      smoothing,
    );
    uniforms.fogStrength.value = THREE.MathUtils.lerp(uniforms.fogStrength.value, targetFogStrengthRef.current, smoothing);

    if (settlingTimeRef.current < 1.2) {
      settlingTimeRef.current += Math.min(delta, 0.05);
      camera.getWorldDirection(offsetRef.current);
      offsetRef.current.y = THREE.MathUtils.clamp(offsetRef.current.y, -0.04, 0.08);
      offsetRef.current.normalize().multiplyScalar(122);
      offsetRef.current.y -= 8.6;
      mesh.position.copy(camera.position).add(offsetRef.current);
      mesh.lookAt(camera.position);
      return;
    }
    mesh.position.copy(camera.position).add(offsetRef.current);
  });

  return (
    <mesh ref={meshRef} renderOrder={-28}>
      <planeGeometry args={[178, 100]} />
      <shaderMaterial
        uniforms={uniforms}
        transparent
        depthWrite={false}
        toneMapped
        vertexShader={`
          varying vec2 vPlateUv;
          void main() {
            vPlateUv = uv;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          }
        `}
        fragmentShader={`
          uniform sampler2D plateMap;
          uniform vec3 fogTint;
          uniform vec3 skyTint;
          uniform float plateOpacity;
          uniform float fogStrength;
          varying vec2 vPlateUv;
          void main() {
            vec3 plate = texture2D(plateMap, vPlateUv).rgb;
            float luminance = dot(plate, vec3(0.2126, 0.7152, 0.0722));
            plate = mix(vec3(luminance), plate, 0.8);

            float lowerBlend = 1.0 - smoothstep(0.04, 0.27, vPlateUv.y);
            float horizonHaze = 1.0 - smoothstep(0.0, 0.17, abs(vPlateUv.y - 0.47));
            float skyBlend = smoothstep(0.56, 0.9, vPlateUv.y);
            plate = mix(plate, fogTint, lowerBlend * 0.42 + horizonHaze * (0.2 + fogStrength * 0.34));
            plate = mix(plate, skyTint, skyBlend * 0.055);

            vec2 fromCenter = abs(vPlateUv - 0.5) * 2.0;
            float sideFeather = 1.0 - smoothstep(0.7, 1.0, fromCenter.x);
            float topFeather = 1.0 - smoothstep(0.76, 1.0, vPlateUv.y);
            float bottomFeather = smoothstep(0.01, 0.13, vPlateUv.y);
            float alpha = sideFeather * topFeather * bottomFeather * plateOpacity;
            gl_FragColor = vec4(plate, alpha);
            #include <tonemapping_fragment>
            #include <colorspace_fragment>
          }
        `}
      />
    </mesh>
  );
}

function AtmosphericForestPanorama({
  radius,
  visualState,
  showDepthPlate,
}: {
  radius: number;
  visualState: WorldVisualState;
  showDepthPlate: boolean;
}) {
  const texture = useTexture(FIRST_WOOD_PANORAMA_PATH);
  const meshRef = useRef<THREE.Mesh>(null);
  const { camera } = useThree();
  const targetFogColorRef = useRef(new THREE.Color(visualState.fogColor));
  const targetSkyColorRef = useRef(new THREE.Color(visualState.backgroundColor));
  const targetSkyOpennessRef = useRef(visualState.director.skyOpenness);
  const targetForestOpacityRef = useRef(0.72);
  const targetFogStrengthRef = useRef(0.4);
  const uniforms = useMemo(
    () => ({
      panoramaMap: { value: texture },
      fogTint: { value: new THREE.Color(visualState.fogColor) },
      skyTint: { value: new THREE.Color(visualState.backgroundColor) },
      skyOpenness: { value: visualState.director.skyOpenness },
      forestOpacity: { value: 0.72 },
      fogStrength: { value: 0.4 },
    }),
    [texture],
  );

  useEffect(() => {
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.ClampToEdgeWrapping;
    texture.anisotropy = 2;
    texture.needsUpdate = true;
  }, [texture]);

  useEffect(() => {
    targetFogColorRef.current.set(visualState.fogColor);
    targetSkyColorRef.current.set(visualState.backgroundColor);
    targetSkyOpennessRef.current = visualState.director.skyOpenness;
    targetForestOpacityRef.current = THREE.MathUtils.clamp(
      0.12 + visualState.director.forestDensity * visualState.director.forestDensity * 0.62,
      0.12,
      0.62,
    );
    targetFogStrengthRef.current = THREE.MathUtils.clamp((visualState.fogDensity - 0.0032) / 0.0088, 0, 1);
  }, [
    visualState.backgroundColor,
    visualState.director.forestDensity,
    visualState.director.skyOpenness,
    visualState.fogColor,
    visualState.fogDensity,
  ]);

  useFrame((_, delta) => {
    if (meshRef.current) meshRef.current.position.copy(camera.position);
    const smoothing = 1 - Math.exp(-Math.min(delta, 0.05) * 1.1);
    uniforms.fogTint.value.lerp(targetFogColorRef.current, smoothing);
    uniforms.skyTint.value.lerp(targetSkyColorRef.current, smoothing);
    uniforms.skyOpenness.value = THREE.MathUtils.lerp(
      uniforms.skyOpenness.value,
      targetSkyOpennessRef.current,
      smoothing,
    );
    uniforms.forestOpacity.value = THREE.MathUtils.lerp(uniforms.forestOpacity.value, targetForestOpacityRef.current, smoothing);
    uniforms.fogStrength.value = THREE.MathUtils.lerp(uniforms.fogStrength.value, targetFogStrengthRef.current, smoothing);
  });

  return (
    <>
      <mesh ref={meshRef} rotation={[0, Math.PI / 2, 0]} renderOrder={-30}>
        <sphereGeometry args={[radius, 48, 28]} />
        <shaderMaterial
          uniforms={uniforms}
          side={THREE.BackSide}
          depthWrite={false}
          toneMapped
          vertexShader={`
          varying vec2 vPanoramaUv;
          varying float vLocalHeight;
          void main() {
            vPanoramaUv = uv;
            vLocalHeight = normalize(position).y * 0.5 + 0.5;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          }
          `}
          fragmentShader={`
          uniform sampler2D panoramaMap;
          uniform vec3 fogTint;
          uniform vec3 skyTint;
          uniform float skyOpenness;
          uniform float forestOpacity;
          uniform float fogStrength;
          varying vec2 vPanoramaUv;
          varying float vLocalHeight;
          void main() {
            vec3 panorama = texture2D(panoramaMap, vPanoramaUv).rgb;
            float luminance = dot(panorama, vec3(0.2126, 0.7152, 0.0722));
            panorama = mix(vec3(luminance), panorama, 0.76);
            panorama *= vec3(0.78, 0.87, 1.0);

            float lowerForest = 1.0 - smoothstep(0.34, 0.58, vLocalHeight);
            float horizonMist = exp(-abs(vLocalHeight - 0.47) * 13.0);
            float seamDistance = min(vPanoramaUv.x, 1.0 - vPanoramaUv.x);
            float seamVeil = 1.0 - smoothstep(0.0, 0.055, seamDistance);
            float haze = clamp(
              lowerForest * 0.72 +
              horizonMist * (0.26 + fogStrength * 0.34) +
              seamVeil * 0.34,
              0.0,
              0.9
            );
            vec3 graded = mix(panorama, fogTint, haze);
            graded = mix(graded, skyTint, smoothstep(0.48, 0.74, vLocalHeight) * 0.12);

            float canopyStart = 0.57 + skyOpenness * 0.075;
            float canopyFade = 1.0 - smoothstep(canopyStart, canopyStart + 0.18, vLocalHeight);
            float groundFade = smoothstep(0.08, 0.28, vLocalHeight);
            float alpha = canopyFade * groundFade * forestOpacity;
            alpha *= 1.0 - seamVeil * 0.28;

            gl_FragColor = vec4(graded, alpha);
            #include <tonemapping_fragment>
            #include <colorspace_fragment>
          }
          `}
          transparent
        />
      </mesh>
      {showDepthPlate ? <CinematicForestDepthPlate visualState={visualState} /> : null}
    </>
  );
}

function DistantForestSilhouetteRing({
  visualState,
  qualityProfile,
}: {
  visualState: WorldVisualState;
  qualityProfile: RenderQualityProfile;
}) {
  const meshRef = useRef<THREE.Mesh>(null);
  const { camera } = useThree();
  const targetNearColorRef = useRef(new THREE.Color(visualState.palette.trunk));
  const targetFarColorRef = useRef(new THREE.Color(visualState.fogColor));
  const targetOpacityRef = useRef(0.32);
  const uniforms = useMemo(
    () => ({
      nearColor: { value: new THREE.Color(visualState.palette.trunk) },
      farColor: { value: new THREE.Color(visualState.fogColor) },
      silhouetteOpacity: { value: 0.32 },
    }),
    [],
  );

  useEffect(() => {
    targetNearColorRef.current
      .set(visualState.backgroundColor)
      .lerp(new THREE.Color(visualState.fogColor), 0.38)
      .lerp(new THREE.Color(visualState.palette.trunk), 0.045);
    targetFarColorRef.current
      .set(visualState.backgroundColor)
      .lerp(new THREE.Color(visualState.fogColor), 0.52);
    targetOpacityRef.current = THREE.MathUtils.clamp(
      0.1 + visualState.director.forestDensity * 0.21,
      0.12,
      0.3,
    );
  }, [
    visualState.backgroundColor,
    visualState.director.forestDensity,
    visualState.fogColor,
    visualState.palette.trunk,
  ]);

  useFrame((_, delta) => {
    const mesh = meshRef.current;
    if (!mesh) return;
    mesh.position.copy(camera.position);
    mesh.position.y -= 9.5;
    const smoothing = 1 - Math.exp(-Math.min(delta, 0.05) * 1.2);
    uniforms.nearColor.value.lerp(targetNearColorRef.current, smoothing);
    uniforms.farColor.value.lerp(targetFarColorRef.current, smoothing);
    uniforms.silhouetteOpacity.value = THREE.MathUtils.lerp(
      uniforms.silhouetteOpacity.value,
      targetOpacityRef.current,
      smoothing,
    );
  });

  return (
    <mesh ref={meshRef} renderOrder={-24} frustumCulled={false}>
      <cylinderGeometry args={[74, 74, 54, qualityProfile.quality === "low" ? 72 : 112, 1, true]} />
      <shaderMaterial
        side={THREE.BackSide}
        transparent
        depthWrite={false}
        toneMapped
        uniforms={uniforms}
        vertexShader={`
          varying vec2 vSilhouetteUv;
          void main() {
            vSilhouetteUv = uv;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          }
        `}
        fragmentShader={`
          uniform vec3 nearColor;
          uniform vec3 farColor;
          uniform float silhouetteOpacity;
          varying vec2 vSilhouetteUv;

          void main() {
            float angle = vSilhouetteUv.x * 6.2831853;
            float broad = sin(angle * 7.0 + 0.8) * 0.5 + 0.5;
            float middle = sin(angle * 19.0 - 1.4) * 0.5 + 0.5;
            float needles = pow(sin(angle * 47.0 + 2.1) * 0.5 + 0.5, 10.0);
            float distantNeedles = pow(sin(angle * 31.0 - 0.45) * 0.5 + 0.5, 8.0);
            float ridge = 0.6 + broad * 0.075 + middle * 0.055 + needles * 0.09 + distantNeedles * 0.045;
            float silhouette = 1.0 - smoothstep(ridge - 0.012, ridge + 0.018, vSilhouetteUv.y);
            float baseMist = smoothstep(0.05, 0.34, vSilhouetteUv.y);
            float crownMist = smoothstep(0.24, 0.82, vSilhouetteUv.y);
            vec3 color = mix(farColor, nearColor, crownMist * 0.78);
            float alpha = silhouette * baseMist * silhouetteOpacity;
            if (alpha < 0.002) discard;
            gl_FragColor = vec4(color, alpha);
            #include <tonemapping_fragment>
            #include <colorspace_fragment>
          }
        `}
      />
    </mesh>
  );
}

function ProceduralDome({
  entry,
  visualState,
  radius,
  narrativeWorldState = ZERO_STATE,
  qualityProfile,
}: {
  entry: Slipper3DEntry;
  visualState: WorldVisualState;
  radius: number;
  narrativeWorldState?: NarrativeWorldState;
  qualityProfile: RenderQualityProfile;
}) {
  const materialRef = useRef<THREE.ShaderMaterial>(null);
  const meshRef = useRef<THREE.Mesh>(null);
  const { camera } = useThree();
  const targetZenithRef = useRef(new THREE.Color(visualState.backgroundColor));
  const targetUpperRef = useRef(new THREE.Color(visualState.palette.fog));
  const targetHorizonRef = useRef(new THREE.Color(visualState.fogColor));
  const targetCloudRef = useRef(new THREE.Color(visualState.moonColor));
  const targetSkyOpennessRef = useRef(visualState.director.skyOpenness);
  const targetCloudAmountRef = useRef(0.48);
  const targetCloudDetailRef = useRef(0);
  const targetMoodWeightRef = useRef(visualState.domeOpacity);
  const [authoredLow, authoredMid, authoredHigh = visualState.moonColor] = entry.engine3d.environmentGradient ?? [
    visualState.backgroundColor,
    visualState.palette.fog,
    visualState.moonColor,
  ];
  const uniforms = useMemo(
    () => ({
      colorZenith: { value: new THREE.Color(visualState.backgroundColor) },
      colorUpper: { value: new THREE.Color(visualState.palette.fog) },
      colorHorizon: { value: new THREE.Color(visualState.fogColor) },
      cloudColor: { value: new THREE.Color(visualState.moonColor) },
      skyOpenness: { value: visualState.director.skyOpenness },
      cloudAmount: { value: 0.48 },
      cloudDetail: { value: 0 },
      moodWeight: { value: visualState.domeOpacity },
      journeyDepth: { value: narrativeWorldState.explorationDepth },
      fireWaterBalance: { value: narrativeWorldState.fireWaterBalance },
      memoryPressure: { value: narrativeWorldState.memoryPressure },
      time: { value: 0 },
    }),
    [],
  );

  useEffect(() => {
    targetZenithRef.current
      .set(visualState.backgroundColor)
      .lerp(new THREE.Color(authoredLow), 0.26)
      .multiplyScalar(0.74);
    targetUpperRef.current
      .set(visualState.palette.fog)
      .lerp(new THREE.Color(authoredMid), 0.24)
      .lerp(new THREE.Color(visualState.backgroundColor), 0.34);
    targetHorizonRef.current
      .set(visualState.fogColor)
      .lerp(new THREE.Color(authoredHigh), 0.075)
      .lerp(new THREE.Color(visualState.moonColor), 0.04 + visualState.director.skyOpenness * 0.03);
    targetCloudRef.current.set(visualState.moonColor).multiplyScalar(0.62);
    targetSkyOpennessRef.current = visualState.director.skyOpenness;
    targetCloudAmountRef.current = THREE.MathUtils.clamp(
      0.34 + visualState.weatherIntensity * 0.34 + (1 - visualState.director.skyOpenness) * 0.14,
      0.3,
      0.72,
    );
    targetCloudDetailRef.current =
      qualityProfile.particleMultiplier <= 0 || qualityProfile.quality === "low"
        ? 0
        : qualityProfile.quality === "medium"
          ? 0.55
          : 1;
    targetMoodWeightRef.current = visualState.domeOpacity;
  }, [
    authoredHigh,
    authoredLow,
    authoredMid,
    qualityProfile.particleMultiplier,
    qualityProfile.quality,
    visualState.backgroundColor,
    visualState.director.skyOpenness,
    visualState.domeOpacity,
    visualState.fogColor,
    visualState.moonColor,
    visualState.palette.fog,
    visualState.weatherIntensity,
  ]);

  useFrame(({ clock }, delta) => {
    if (meshRef.current) meshRef.current.position.copy(camera.position);
    const lerpSpeed = 1 - Math.exp(-Math.min(delta, 0.05) * 1.35);
    uniforms.colorZenith.value.lerp(targetZenithRef.current, lerpSpeed);
    uniforms.colorUpper.value.lerp(targetUpperRef.current, lerpSpeed);
    uniforms.colorHorizon.value.lerp(targetHorizonRef.current, lerpSpeed);
    uniforms.cloudColor.value.lerp(targetCloudRef.current, lerpSpeed);
    uniforms.skyOpenness.value = THREE.MathUtils.lerp(uniforms.skyOpenness.value, targetSkyOpennessRef.current, lerpSpeed);
    uniforms.cloudAmount.value = THREE.MathUtils.lerp(uniforms.cloudAmount.value, targetCloudAmountRef.current, lerpSpeed);
    uniforms.cloudDetail.value = THREE.MathUtils.lerp(uniforms.cloudDetail.value, targetCloudDetailRef.current, lerpSpeed);
    uniforms.moodWeight.value = THREE.MathUtils.lerp(uniforms.moodWeight.value, targetMoodWeightRef.current, lerpSpeed);
    uniforms.journeyDepth.value = THREE.MathUtils.lerp(uniforms.journeyDepth.value, narrativeWorldState.explorationDepth, lerpSpeed);
    uniforms.fireWaterBalance.value = THREE.MathUtils.lerp(uniforms.fireWaterBalance.value, narrativeWorldState.fireWaterBalance, lerpSpeed);
    uniforms.memoryPressure.value = THREE.MathUtils.lerp(uniforms.memoryPressure.value, narrativeWorldState.memoryPressure, lerpSpeed);
    uniforms.time.value = qualityProfile.particleMultiplier > 0 ? clock.elapsedTime : 0;
  });

  return (
    <mesh ref={meshRef} renderOrder={-40} frustumCulled={false}>
      <sphereGeometry args={[radius, 40, 20]} />
      <shaderMaterial
        ref={materialRef}
        side={THREE.BackSide}
        depthWrite={false}
        depthTest={false}
        toneMapped
        uniforms={uniforms}
        vertexShader={`
          varying vec3 vSkyDirection;
          void main() {
            vSkyDirection = normalize(position);
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          }
        `}
        fragmentShader={`
          uniform vec3 colorZenith;
          uniform vec3 colorUpper;
          uniform vec3 colorHorizon;
          uniform vec3 cloudColor;
          uniform float skyOpenness;
          uniform float cloudAmount;
          uniform float cloudDetail;
          uniform float moodWeight;
          uniform float journeyDepth;
          uniform float fireWaterBalance;
          uniform float memoryPressure;
          uniform float time;
          varying vec3 vSkyDirection;

          float skyHash(vec2 point) {
            point = fract(point * vec2(123.34, 456.21));
            point += dot(point, point + 45.32);
            return fract(point.x * point.y);
          }

          float skyNoise(vec2 point) {
            vec2 cell = floor(point);
            vec2 local = fract(point);
            local = local * local * (3.0 - 2.0 * local);
            return mix(
              mix(skyHash(cell), skyHash(cell + vec2(1.0, 0.0)), local.x),
              mix(skyHash(cell + vec2(0.0, 1.0)), skyHash(cell + vec2(1.0, 1.0)), local.x),
              local.y
            );
          }

          float skyFbmLow(vec2 point) {
            float value = skyNoise(point) * 0.62;
            value += skyNoise(point * 2.03 + vec2(7.13, 3.71)) * 0.3;
            return value;
          }

          float skyFbmHigh(vec2 point) {
            float value = 0.0;
            float amplitude = 0.56;
            for (int octave = 0; octave < 4; octave++) {
              value += skyNoise(point) * amplitude;
              point = point * 2.03 + vec2(7.13, 3.71);
              amplitude *= 0.48;
            }
            return value;
          }

          void main() {
            vec3 direction = normalize(vSkyDirection);
            float height = direction.y;
            float horizon = exp(-abs(height + 0.025) * 8.8);
            float upperBlend = smoothstep(-0.12, 0.38, height);
            float zenithBlend = smoothstep(0.2, 0.94, height);
            vec3 sky = mix(colorHorizon, colorUpper, upperBlend);
            sky = mix(sky, colorZenith, zenithBlend * (0.82 + skyOpenness * 0.12));

            vec3 fireTint = vec3(1.0, 0.36, 0.16);
            vec3 waterTint = vec3(0.22, 0.48, 0.76);
            vec3 memoryTint = vec3(0.42, 0.32, 0.62);
            float axis = fireWaterBalance * 0.5 + 0.5;
            vec3 axisTint = mix(waterTint, fireTint, clamp(axis, 0.0, 1.0));

            if (cloudDetail > 0.01) {
              vec2 cloudUv =
                direction.xz * (3.5 + max(height, 0.0) * 1.4) +
                vec2(height * 1.25, -height * 0.68) +
                vec2(time * 0.0017, time * 0.00042);
              float cloudNoise = skyFbmLow(cloudUv);
              if (cloudDetail > 0.78) {
                cloudNoise = skyFbmHigh(cloudUv) * 0.76 + skyFbmHigh(cloudUv * vec2(1.82, 2.34) + 8.4) * 0.24;
              }
              float cloudThreshold = 0.77 - cloudAmount * 0.3;
              float clouds = smoothstep(cloudThreshold, cloudThreshold + 0.18, cloudNoise);
              float cloudZone = smoothstep(-0.1, 0.08, height) * (1.0 - smoothstep(0.64, 0.94, height));
              float cloudStrata = 0.76 + 0.24 * sin((height + cloudNoise * 0.05) * 42.0);
              clouds *= cloudZone * cloudStrata;
              vec3 litCloud = mix(colorUpper, cloudColor, 0.46 + horizon * 0.24);
              sky = mix(sky, litCloud, clouds * (0.09 + cloudAmount * 0.15));
            }

            float horizonVeil = horizon * (0.1 + (1.0 - skyOpenness) * 0.13);
            sky = mix(sky, colorHorizon, horizonVeil);
            sky = mix(sky, axisTint, abs(fireWaterBalance) * journeyDepth * 0.075);
            sky = mix(sky, memoryTint, memoryPressure * 0.055);
            sky *= 1.0 - journeyDepth * (0.025 + moodWeight * 0.035);

            float dither = (skyHash(gl_FragCoord.xy) - 0.5) / 255.0;
            sky += dither;

            gl_FragColor = vec4(sky, 1.0);
            #include <tonemapping_fragment>
            #include <colorspace_fragment>
          }
        `}
      />
    </mesh>
  );
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

function isIntegratedFinaleEntry(entryId: string) {
  return getJourneySceneForEntry(entryId)?.id === "epilogue.constellation";
}

function usesAuthoredCausalComposition(entryId: string) {
  // Every canonical scene now supplies physical objects and material prose.
  // Legacy cards, tag chips and abstract markers would duplicate that layer.
  return Boolean(getJourneySceneForEntry(entryId));
}

function hasAuthoredChapterMoon(entryId: string) {
  const sceneId = getJourneySceneForEntry(entryId)?.id;
  return isIntegratedFinaleEntry(entryId) ||
    sceneId === "blue-moon.sanctuary" ||
    sceneId === "blue-moon.intimacy" ||
    sceneId === "blue-moon.caged-bird" ||
    sceneId === "wolf-swan.false-choice" ||
    sceneId === "wolf-swan.convergence";
}

function CelestialMoon({
  visualState,
  qualityProfile,
  radius,
}: {
  visualState: WorldVisualState;
  qualityProfile: RenderQualityProfile;
  radius: number;
}) {
  const texture = useTexture(MOON_ALBEDO_PATH);
  const groupRef = useRef<THREE.Group>(null);
  const discMaterialRef = useRef<THREE.ShaderMaterial>(null);
  const haloMaterialRef = useRef<THREE.ShaderMaterial>(null);
  const distance = Math.max(42, radius * 0.88);
  const moonOffsetRef = useRef(new THREE.Vector3(...visualState.moonPosition).normalize().multiplyScalar(distance));
  const targetOffsetRef = useRef(moonOffsetRef.current.clone());
  const moonRightRef = useRef(new THREE.Vector3());
  const moonUpRef = useRef(new THREE.Vector3());
  const hasAnchoredMoonRef = useRef(false);
  const targetColor = useMemo(
    () => new THREE.Color(visualState.moonColor),
    [visualState.moonColor],
  );
  const targetDiscColor = useMemo(
    () => new THREE.Color("#eef1e8").lerp(targetColor, 0.22),
    [targetColor],
  );
  const moonUniforms = useMemo(
    () => ({
      moonMap: { value: texture },
      moonColor: { value: new THREE.Color("#eef1e8").lerp(new THREE.Color(visualState.moonColor), 0.22) },
      moonOpacity: { value: 0.9 },
      veilStrength: { value: qualityProfile.enableBloomProxies ? 0.18 : 0.08 },
      time: { value: 0 },
    }),
    [texture],
  );
  const haloUniforms = useMemo(
    () => ({
      haloColor: { value: new THREE.Color(visualState.moonColor) },
      haloOpacity: { value: qualityProfile.enableBloomProxies ? 0.056 : 0.026 },
      time: { value: 0 },
    }),
    [],
  );
  const moonScale = qualityProfile.quality === "low" ? 0.78 : 0.92;

  useEffect(() => {
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.wrapS = THREE.ClampToEdgeWrapping;
    texture.wrapT = THREE.ClampToEdgeWrapping;
    texture.minFilter = THREE.LinearMipmapLinearFilter;
    texture.magFilter = THREE.LinearFilter;
    texture.anisotropy = 2;
    texture.needsUpdate = true;
  }, [texture]);

  useEffect(() => {
    hasAnchoredMoonRef.current = false;
  }, [distance, visualState.moonPosition]);

  useFrame(({ camera, clock }, delta) => {
    const group = groupRef.current;
    if (!group) return;

    const smoothing = 1 - Math.exp(-Math.min(delta, 0.05) * 1.7);
    if (!hasAnchoredMoonRef.current) {
      anchorMoonOffsetToOpening(
        camera,
        visualState.moonPosition,
        distance,
        targetOffsetRef.current,
        moonRightRef.current,
        moonUpRef.current,
      );
      moonOffsetRef.current.copy(targetOffsetRef.current);
      hasAnchoredMoonRef.current = true;
    }
    moonOffsetRef.current.lerp(targetOffsetRef.current, smoothing);
    group.position.copy(camera.position).add(moonOffsetRef.current);
    group.lookAt(camera.position);

    const fogTransmittance = THREE.MathUtils.clamp(1 - visualState.fogDensity * 27, 0.64, 0.88);
    moonUniforms.moonColor.value.lerp(targetDiscColor, smoothing);
    moonUniforms.moonOpacity.value = THREE.MathUtils.lerp(
      moonUniforms.moonOpacity.value,
      fogTransmittance,
      smoothing,
    );
    moonUniforms.veilStrength.value = THREE.MathUtils.lerp(
      moonUniforms.veilStrength.value,
      qualityProfile.enableBloomProxies ? 0.18 : 0.08,
      smoothing,
    );
    moonUniforms.time.value = qualityProfile.particleMultiplier > 0 ? clock.elapsedTime : 0;
    if (haloMaterialRef.current) {
      haloMaterialRef.current.uniforms.haloColor.value.lerp(targetColor, smoothing);
      const breath = qualityProfile.particleMultiplier > 0
        ? 0.056 + Math.sin(clock.elapsedTime * 0.19) * 0.005
        : 0.052;
      haloMaterialRef.current.uniforms.haloOpacity.value = THREE.MathUtils.lerp(
        haloMaterialRef.current.uniforms.haloOpacity.value,
        (qualityProfile.enableBloomProxies ? breath : 0.026) * fogTransmittance,
        smoothing,
      );
      haloMaterialRef.current.uniforms.time.value = moonUniforms.time.value;
    }
  });

  return (
    <group ref={groupRef} scale={[moonScale, moonScale, moonScale]}>
      <mesh renderOrder={-4}>
        <circleGeometry args={[0.74, 48]} />
        <shaderMaterial
          ref={discMaterialRef}
          uniforms={moonUniforms}
          transparent
          alphaTest={0.015}
          depthWrite={false}
          fog={false}
          toneMapped={false}
          vertexShader={`
            varying vec2 vMoonUv;
            void main() {
              vMoonUv = uv;
              gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
            }
          `}
          fragmentShader={`
            uniform sampler2D moonMap;
            uniform vec3 moonColor;
            uniform float moonOpacity;
            uniform float veilStrength;
            uniform float time;
            varying vec2 vMoonUv;

            float moonHash(vec2 point) {
              return fract(sin(dot(point, vec2(127.1, 311.7))) * 43758.5453);
            }

            float moonNoise(vec2 point) {
              vec2 cell = floor(point);
              vec2 local = fract(point);
              local = local * local * (3.0 - 2.0 * local);
              return mix(
                mix(moonHash(cell), moonHash(cell + vec2(1.0, 0.0)), local.x),
                mix(moonHash(cell + vec2(0.0, 1.0)), moonHash(cell + vec2(1.0, 1.0)), local.x),
                local.y
              );
            }

            void main() {
              vec2 point = (vMoonUv - 0.5) * 2.0;
              float radiusSquared = dot(point, point);
              if (radiusSquared > 1.0) discard;

              vec4 albedoSample = texture2D(moonMap, vMoonUv);
              float sphereDepth = sqrt(max(0.0, 1.0 - radiusSquared));
              vec3 sphereNormal = normalize(vec3(point, sphereDepth));
              vec3 lightDirection = normalize(vec3(-0.24, 0.18, 0.96));
              float diffuse = clamp(dot(sphereNormal, lightDirection), 0.0, 1.0);
              float limb = smoothstep(0.02, 0.34, sphereDepth);

              float albedoLuminance = dot(albedoSample.rgb, vec3(0.2126, 0.7152, 0.0722));
              vec3 lunarAlbedo = mix(vec3(albedoLuminance), albedoSample.rgb, 0.74);
              float veilNoise = moonNoise(vec2(vMoonUv.x * 3.2 + time * 0.006, vMoonUv.y * 11.0));
              float veilBand = smoothstep(0.58, 0.8, veilNoise + sin((vMoonUv.y + vMoonUv.x * 0.16) * 34.0) * 0.1);
              float illumination = (0.48 + diffuse * 0.52) * mix(1.0, 0.68, veilBand * veilStrength);
              vec3 color = lunarAlbedo * moonColor * illumination;
              float alpha = albedoSample.a * limb * moonOpacity;

              gl_FragColor = vec4(color, alpha);
              #include <colorspace_fragment>
            }
          `}
        />
      </mesh>
      <mesh position={[0, 0, -0.025]} renderOrder={-5}>
        <circleGeometry args={[2.9, 44]} />
        <shaderMaterial
          ref={haloMaterialRef}
          uniforms={haloUniforms}
          transparent
          blending={THREE.AdditiveBlending}
          depthWrite={false}
          toneMapped={false}
          vertexShader={`
            varying vec2 vHaloUv;
            void main() {
              vHaloUv = uv;
              gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
            }
          `}
          fragmentShader={`
            uniform vec3 haloColor;
            uniform float haloOpacity;
            uniform float time;
            varying vec2 vHaloUv;
            void main() {
              vec2 point = (vHaloUv - 0.5) * 2.0;
              float radius = length(point);
              float falloff = pow(1.0 - smoothstep(0.035, 1.0, radius), 3.1);
              float asymmetry = 0.86 + 0.14 * sin(point.y * 11.0 + point.x * 4.0 + time * 0.035);
              float innerCorona = 1.0 - smoothstep(0.06, 0.34, radius);
              float alpha = (falloff * asymmetry + innerCorona * 0.24) * haloOpacity;
              gl_FragColor = vec4(haloColor, alpha);
              #include <colorspace_fragment>
            }
          `}
        />
      </mesh>
    </group>
  );
}

function SceneAtmosphere({
  cinematicActive = false,
  entry,
  entries,
  narrativeWorldState,
  qualityProfile,
}: {
  entry: Slipper3DEntry;
  entries: Slipper3DEntry[];
  narrativeWorldState: NarrativeWorldState;
  qualityProfile: RenderQualityProfile;
  cinematicActive?: boolean;
}) {
  const { camera, scene } = useThree();
  const starsRef = useRef<THREE.Group>(null);
  const activeVisualState = useMemo(
    () => resolveWorldVisualState({ entry, nearestEntry: entry, nearestDistance: 0, narrativeWorldState }),
    [entry, narrativeWorldState],
  );
  const bgColorRef = useRef(new THREE.Color(activeVisualState.backgroundColor));
  const fogColorRef = useRef(new THREE.Color(activeVisualState.fogColor));
  const targetBgColorRef = useRef(new THREE.Color(activeVisualState.backgroundColor));
  const targetFogColorRef = useRef(new THREE.Color(activeVisualState.fogColor));
  const sampledVisualStateRef = useRef(activeVisualState);
  const lastAtmosphereSampleRef = useRef(Number.NEGATIVE_INFINITY);
  const suppressAmbientMoon = hasAuthoredChapterMoon(entry.id);

  useEffect(() => {
    sampledVisualStateRef.current = activeVisualState;
    lastAtmosphereSampleRef.current = Number.NEGATIVE_INFINITY;
    targetBgColorRef.current.set(activeVisualState.backgroundColor);
    targetFogColorRef.current.set(activeVisualState.fogColor);
    if (!(scene.background instanceof THREE.Color)) {
      scene.background = bgColorRef.current.clone();
    }
    if (!(scene.fog instanceof THREE.FogExp2)) {
      scene.fog = new THREE.FogExp2(fogColorRef.current.clone(), activeVisualState.fogDensity);
    }
  }, [activeVisualState.backgroundColor, activeVisualState.fogColor, activeVisualState.fogDensity, scene]);

  useFrame((state, delta) => {
    if (starsRef.current) starsRef.current.position.copy(camera.position);

    let visualState = sampledVisualStateRef.current;
    if (state.clock.elapsedTime - lastAtmosphereSampleRef.current >= 0.16) {
      const nearest = nearestEntryByXZ(camera.position.x, camera.position.z, entries);
      const nearestDistance = Math.sqrt(nearest.distanceSq);
      const nearestEntry = nearest.entry && nearestDistance < 38 ? nearest.entry : entry;
      visualState = resolveWorldVisualState({ entry, nearestEntry, nearestDistance, narrativeWorldState });
      sampledVisualStateRef.current = visualState;
      lastAtmosphereSampleRef.current = state.clock.elapsedTime;
    }

    const lerpSpeed = 1 - Math.exp(-delta * 0.92);

    targetBgColorRef.current.set(visualState.backgroundColor);
    targetFogColorRef.current.set(visualState.fogColor);

    if (!(scene.background instanceof THREE.Color)) {
      scene.background = bgColorRef.current.clone();
    }

    bgColorRef.current.copy(scene.background as THREE.Color);
    bgColorRef.current.lerp(targetBgColorRef.current, lerpSpeed);
    (scene.background as THREE.Color).copy(bgColorRef.current);

    if (!(scene.fog instanceof THREE.FogExp2)) {
      scene.fog = new THREE.FogExp2(fogColorRef.current.clone(), visualState.fogDensity);
    }

    if (cinematicActive) return;
    const fog = scene.fog as THREE.FogExp2;
    fog.color.lerp(targetFogColorRef.current, lerpSpeed);
    fog.density = THREE.MathUtils.lerp(fog.density, visualState.fogDensity, lerpSpeed);
  });

  return (
    <>
      {suppressAmbientMoon ? null : (
        <CelestialMoon
          visualState={activeVisualState}
          qualityProfile={qualityProfile}
          radius={entry.engine3d.environmentRadius ?? DEFAULT_ENVIRONMENT_RADIUS}
        />
      )}
      {activeVisualState.showStars && qualityProfile.starMultiplier > 0 ? (
        <group ref={starsRef} renderOrder={-35}>
          <Stars
            radius={204}
            depth={22}
            count={Math.max(120, Math.round(activeVisualState.starCount * qualityProfile.starMultiplier))}
            factor={activeVisualState.starFactor * qualityProfile.starMultiplier}
            saturation={0}
            fade
            speed={0.12 + narrativeWorldState.memoryPressure * 0.05}
          />
        </group>
      ) : null}
    </>
  );
}
type MazeMorphOptions = {
  memoryPressure?: number;
  explorationDepth?: number;
};

type MazePathSegment = {
  source: THREE.Vector2;
  controlA: THREE.Vector2;
  controlB: THREE.Vector2;
  target: THREE.Vector2;
  sourceEntry: Slipper3DEntry;
  targetEntry: Slipper3DEntry;
  key: string;
  role: PhysicalPathRole;
  curveSeed: number;
  curveLength: number;
  crownRamp: boolean;
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
};

const terrainCurveSeedCache = new WeakMap<
  MazePathSegment,
  TerrainCurveSeed
>();

function terrainCurveSeedFor(segment: MazePathSegment) {
  let cached = terrainCurveSeedCache.get(segment);
  if (!cached) {
    cached = {
      source: [segment.source.x, segment.source.y],
      controlA: [segment.controlA.x, segment.controlA.y],
      controlB: [segment.controlB.x, segment.controlB.y],
      target: [segment.target.x, segment.target.y],
      curveSeed: segment.curveSeed,
      curveLength: segment.curveLength,
    };
    terrainCurveSeedCache.set(segment, cached);
  }
  return cached;
}

type TreeCollider = {
  key: string;
  position: Vector3Tuple;
  args: Vector3Tuple;
};

function cubicBezierPoint2D(source: THREE.Vector2, controlA: THREE.Vector2, controlB: THREE.Vector2, target: THREE.Vector2, t: number) {
  const u = 1 - t;
  const tt = t * t;
  const uu = u * u;
  const uuu = uu * u;
  const ttt = tt * t;
  return new THREE.Vector2(
    uuu * source.x + 3 * uu * t * controlA.x + 3 * u * tt * controlB.x + ttt * target.x,
    uuu * source.y + 3 * uu * t * controlA.y + 3 * u * tt * controlB.y + ttt * target.y,
  );
}

function curvedPathPointAt(segment: MazePathSegment, t: number, morph: MazeMorphOptions = {}) {
  const point = sampleTerrainCurvePoint(
    terrainCurveSeedFor(segment),
    t,
    morph,
  );
  return new THREE.Vector2(point[0], point[1]);
}

function curvedPathTangentAt(segment: MazePathSegment, t: number, morph: MazeMorphOptions = {}) {
  const tangent = sampleTerrainCurveTangent(
    terrainCurveSeedFor(segment),
    t,
    morph,
  );
  return new THREE.Vector2(tangent[0], tangent[1]);
}

function segmentProjectionT(x: number, z: number, segment: MazePathSegment, morph: MazeMorphOptions = {}) {
  return sampleTerrainPathProjectionT(
    x,
    z,
    terrainCurveSeedFor(segment),
    morph,
  );
}

function distancePointToSegmentSq(x: number, z: number, segment: MazePathSegment, morph: MazeMorphOptions = {}) {
  return sampleTerrainPathDistanceSq(
    x,
    z,
    terrainCurveSeedFor(segment),
    morph,
  );
}

function nearestMazePathSegment(x: number, z: number, segments: MazePathSegment[], morph: MazeMorphOptions = {}) {
  let nearest: MazePathSegment | null = null;
  let distanceSq = Number.POSITIVE_INFINITY;
  let projectionT = 0;

  for (const segment of segments) {
    if (distanceToSegmentBoundsSq(x, z, segment, CORRIDOR_BASE_WIDTH * 2.4) > distanceSq) continue;
    const candidateT = segmentProjectionT(x, z, segment, morph);
    const point = curvedPathPointAt(segment, candidateT, morph);
    const dx = x - point.x;
    const dz = z - point.y;
    const candidateDistanceSq = dx * dx + dz * dz;

    if (candidateDistanceSq < distanceSq) {
      nearest = segment;
      distanceSq = candidateDistanceSq;
      projectionT = candidateT;
    }
  }

  return { segment: nearest, distanceSq, projectionT };
}

function entrySemanticSignal(entry: Slipper3DEntry) {
  return `${entry.title ?? ""} ${entry.chapter ?? ""} ${(entry.paragraphs ?? []).join(" ")} ${entry.body ?? ""} ${(entry.tags ?? []).join(" ")} ${entry.engine3d.sceneKind ?? ""} ${entry.engine3d.emotionalTone ?? ""} ${entry.engine3d.mood ?? ""}`.toLowerCase();
}

function pathSegmentAngle(segment: MazePathSegment, t = 0.5, morph: MazeMorphOptions = {}) {
  const tangent = curvedPathTangentAt(segment, t, morph);
  return Math.atan2(tangent.y, tangent.x);
}

function valueNoise2D(x: number, z: number, salt = 0) {
  const ix = Math.floor(x);
  const iz = Math.floor(z);
  const fx = x - ix;
  const fz = z - iz;
  const smoothX = fx * fx * (3 - 2 * fx);
  const smoothZ = fz * fz * (3 - 2 * fz);
  const a = worldSeededUnit(ix, iz, salt);
  const b = worldSeededUnit(ix + 1, iz, salt);
  const c = worldSeededUnit(ix, iz + 1, salt);
  const d = worldSeededUnit(ix + 1, iz + 1, salt);
  const ab = THREE.MathUtils.lerp(a, b, smoothX);
  const cd = THREE.MathUtils.lerp(c, d, smoothX);
  return THREE.MathUtils.lerp(ab, cd, smoothZ);
}

function ridgeMazeNoise(x: number, z: number, depth: number, memoryPressure: number) {
  const n1 = valueNoise2D(x * 0.032, z * 0.032, 2.1);
  const n2 = valueNoise2D(x * 0.071 + 19.4, z * 0.071 - 4.7, 9.8);
  const n3 = valueNoise2D(x * 0.14 - 11.2, z * 0.14 + 6.8, 21.3);
  const blended = n1 * 0.55 + n2 * 0.32 + n3 * 0.13;
  const ridge = 1 - Math.abs(blended * 2 - 1);
  const temporalPressure = depth * 0.18 + memoryPressure * 0.14;
  return clamp01(ridge + temporalPressure);
}

function estimateCurveLength(source: THREE.Vector2, controlA: THREE.Vector2, controlB: THREE.Vector2, target: THREE.Vector2) {
  let length = 0;
  let previous = source.clone();
  for (let i = 1; i <= 32; i += 1) {
    const point = cubicBezierPoint2D(source, controlA, controlB, target, i / 32);
    length += point.distanceTo(previous);
    previous = point;
  }
  return length;
}

function estimateCurveBounds(source: THREE.Vector2, controlA: THREE.Vector2, controlB: THREE.Vector2, target: THREE.Vector2, padding = TERRAIN_SEGMENT_BOUNDS_PADDING) {
  let minX = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let minZ = Number.POSITIVE_INFINITY;
  let maxZ = Number.NEGATIVE_INFINITY;

  for (let i = 0; i <= 20; i += 1) {
    const point = cubicBezierPoint2D(source, controlA, controlB, target, i / 20);
    minX = Math.min(minX, point.x);
    maxX = Math.max(maxX, point.x);
    minZ = Math.min(minZ, point.y);
    maxZ = Math.max(maxZ, point.y);
  }

  return { minX: minX - padding, maxX: maxX + padding, minZ: minZ - padding, maxZ: maxZ + padding };
}

function distanceToSegmentBoundsSq(x: number, z: number, segment: MazePathSegment, padding = 0) {
  const clampedX = THREE.MathUtils.clamp(x, segment.minX - padding, segment.maxX + padding);
  const clampedZ = THREE.MathUtils.clamp(z, segment.minZ - padding, segment.maxZ + padding);
  const dx = x - clampedX;
  const dz = z - clampedZ;
  return dx * dx + dz * dz;
}

const clearingPositionCache = new WeakMap<Slipper3DEntry[], Vector3Tuple[]>();
function getCachedClearingPositions(entries: Slipper3DEntry[]) {
  let cached = clearingPositionCache.get(entries);
  if (!cached) {
    cached = entries.map((entry) => entryWorldPosition(entry, entries));
    clearingPositionCache.set(entries, cached);
  }
  return cached;
}

function buildMazePathSegments(entries: Slipper3DEntry[]) {
  const entryMap = new Map(entries.map((entry) => [entry.id, entry]));
  const ordered = getOrderedEntries(entries);
  const orderIndexById = new Map(
    ordered.map((entry, index) => [entry.id, index]),
  );
  const segments: MazePathSegment[] = [];
  const seenKeys = new Set<string>();

  const addSegment = (source: Slipper3DEntry | undefined, target: Slipper3DEntry | undefined, role: PhysicalPathRole) => {
    if (!source || !target || source.id === target.id) return;
    const pairKey = [source.id, target.id].sort().join("::");
    if (seenKeys.has(pairKey)) return;
    seenKeys.add(pairKey);

    const a = entryWorldPosition(source, entries);
    const b = entryWorldPosition(target, entries);
    const sourcePoint = new THREE.Vector2(a[0], a[2]);
    const targetPoint = new THREE.Vector2(b[0], b[2]);
    const sourceIndex = orderIndexById.get(source.id) ?? -1;
    const targetIndex = orderIndexById.get(target.id) ?? -1;
    const sourcePlacement = getJourneyEntryWorldPlacement(source.id);
    const targetPlacement = getJourneyEntryWorldPlacement(target.id);
    const crownRamp = sourcePlacement && targetPlacement
      ? role === "backbone" &&
        (isJourneyEntryElevated(source.id) || isJourneyEntryElevated(target.id))
      : sourceIndex >= 0 &&
        targetIndex >= 0 &&
        Math.abs(sourceIndex - targetIndex) === 1 &&
        (source.chapter === CHAPTER_CROWNED_RETURN ||
          target.chapter === CHAPTER_CROWNED_RETURN);
    const direction = targetPoint.clone().sub(sourcePoint);
    const length = Math.max(0.001, direction.length());
    const tangent = direction.clone().normalize();
    const normal = new THREE.Vector2(-tangent.y, tangent.x);
    const seed = hashString(pairKey);
    const bendLimit = crownRamp ? 1.6 : 2.8;
    const secondaryBendLimit = crownRamp ? 0.9 : 1.8;
    const bend = (seededUnit(seed, 1) * 2 - 1) * Math.min(bendLimit, length * 0.18);
    const bendB = (seededUnit(seed, 2) * 2 - 1) * Math.min(secondaryBendLimit, length * 0.12);
    const tensionA = 0.28 + seededUnit(seed, 3) * 0.08;
    const tensionB = 0.64 + seededUnit(seed, 4) * 0.08;
    const controlA = sourcePoint
      .clone()
      .add(direction.clone().multiplyScalar(tensionA))
      .add(normal.clone().multiplyScalar(bend));
    const controlB = sourcePoint
      .clone()
      .add(direction.clone().multiplyScalar(tensionB))
      .add(normal.clone().multiplyScalar(-bend * 0.42 + bendB));

    const bounds = estimateCurveBounds(sourcePoint, controlA, controlB, targetPoint);
    segments.push({
      key: pairKey,
      role,
      source: sourcePoint,
      controlA,
      controlB,
      target: targetPoint,
      sourceEntry: source,
      targetEntry: target,
      crownRamp,
      curveSeed: seed / 2147483647,
      curveLength: estimateCurveLength(sourcePoint, controlA, controlB, targetPoint),
      ...bounds,
    });
  };

  const physicalLinks = buildPhysicalStoryLinks(entries.map((entry) => ({
    id: entry.id,
    chapter: entry.chapter,
    sequence: entry.sequence,
    position: entryWorldPosition(entry, entries),
  })));
  for (const link of physicalLinks) {
    addSegment(entryMap.get(link.sourceId), entryMap.get(link.targetId), link.role);
  }

  return segments;
}

function packForestClearingSeeds(entries: Slipper3DEntry[]): ForestClearingSeed[] {
  return entries.map((entry) => ({
    id: entry.id,
    chapter: entry.chapter,
    position: entryWorldPosition(entry, entries),
    radius: getJourneyEntryClearingRadius(entry.id),
    biome: getJourneyEntryBiome(entry.id),
    elevated: getJourneyEntryWorldPlacement(entry.id)?.elevated,
  }));
}

function packForestPathSeeds(pathSegments: MazePathSegment[], entries: Slipper3DEntry[]): ForestPathSeed[] {
  return pathSegments.map((segment) => {
    const source = entryWorldPosition(segment.sourceEntry, entries);
    const target = entryWorldPosition(segment.targetEntry, entries);
    return {
      source: [source[0], source[2]],
      controlA: [segment.controlA.x, segment.controlA.y],
      controlB: [segment.controlB.x, segment.controlB.y],
      target: [target[0], target[2]],
      curveSeed: segment.curveSeed,
      curveLength: segment.curveLength,
      sourceChapter: segment.sourceEntry.chapter,
      targetChapter: segment.targetEntry.chapter,
      sourceY: source[1],
      targetY: target[1],
      // Only the authored chapter sequence forms a physical ascent. Portal
      // return links from the crowned chapter remain navigable, but must not
      // raise unrelated paths into walls where the graph crosses itself.
      crownRamp: segment.crownRamp,
      minX: segment.minX,
      maxX: segment.maxX,
      minZ: segment.minZ,
      maxZ: segment.maxZ,
    };
  });
}

type CachedTerrainSampler = {
  segments: MazePathSegment[];
  explorationDepth: number;
  memoryPressure: number;
  config: TerrainSamplerConfig;
  sample: ReturnType<typeof createTerrainSurfaceSampler>;
};

const terrainSamplerCache = new WeakMap<Slipper3DEntry[], CachedTerrainSampler>();

function resolveTerrainSamplerConfig(
  entries: Slipper3DEntry[],
  segments: MazePathSegment[],
  morph: MazeMorphOptions = {},
) {
  const explorationDepth = clamp01(morph.explorationDepth ?? 0);
  const memoryPressure = clamp01(morph.memoryPressure ?? 0);
  const cached = terrainSamplerCache.get(entries);

  if (
    cached &&
    cached.segments === segments &&
    cached.explorationDepth === explorationDepth &&
    cached.memoryPressure === memoryPressure
  ) {
    return cached;
  }

  const config: TerrainSamplerConfig = {
    clearingSafeRadius: FOREST_CLEARING_RADIUS,
    corridorBaseWidth: CORRIDOR_BASE_WIDTH,
    crownedRampWidth: CROWNED_RETURN_RAMP_WIDTH,
    explorationDepth,
    memoryPressure,
    clearings: packForestClearingSeeds(entries),
    paths: packForestPathSeeds(segments, entries),
  };

  const sampler: CachedTerrainSampler = {
    segments,
    explorationDepth,
    memoryPressure,
    config,
    sample: createTerrainSurfaceSampler(
      config,
      TERRAIN_SIZE,
      TERRAIN_SEGMENTS,
    ),
  };
  terrainSamplerCache.set(entries, sampler);

  return sampler;
}

function terrainElevationAtPoint(
  x: number,
  z: number,
  entries: Slipper3DEntry[],
  segments: MazePathSegment[],
  morph: MazeMorphOptions = {},
) {
  return resolveTerrainSamplerConfig(entries, segments, morph).sample(x, z);
}

type ForestTexturePack = {
  barkMap: THREE.Texture;
  barkNormalMap: THREE.Texture | null;
  barkRoughnessMap: THREE.Texture | null;
  crownMap: THREE.Texture;
  crownNormalMap: THREE.Texture | null;
  crownRoughnessMap: THREE.Texture | null;
  marshMap: THREE.Texture;
  marshNormalMap: THREE.Texture | null;
  marshRoughnessMap: THREE.Texture | null;
  ruinMap: THREE.Texture;
  ruinNormalMap: THREE.Texture | null;
  ruinRoughnessMap: THREE.Texture | null;
};

function createSafeCanvasTexture(kind: "bark" | "crown" | "marsh" | "ruin") {
  const canvas = document.createElement("canvas");
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext("2d");

  if (ctx) {
    const palettes: Record<typeof kind, [string, string, string]> = {
      bark: ["#73553c", "#3c2b21", "#ad815d"],
      crown: ["#58725a", "#354a3b", "#8ba184"],
      marsh: ["#20251f", "#101510", "#516055"],
      ruin: ["#625e56", "#302e2a", "#958b7c"],
    };
    const [base, dark, light] = palettes[kind];
    ctx.fillStyle = base;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    if (kind === "crown") {
      for (let i = 0; i < 144; i += 1) {
        const x = (i * 47) % 128;
        const y = (i * 71) % 128;
        const radius = 3 + ((i * 17) % 9);
        const gradient = ctx.createRadialGradient(
          x - radius * 0.22,
          y - radius * 0.28,
          radius * 0.08,
          x,
          y,
          radius,
        );
        gradient.addColorStop(0, i % 4 === 0 ? light : base);
        gradient.addColorStop(1, dark);
        ctx.globalAlpha = 0.1 + (i % 6) * 0.025;
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.ellipse(x, y, radius, radius * (0.68 + (i % 3) * 0.08), (i % 7) * 0.22, 0, Math.PI * 2);
        ctx.fill();
      }
    } else if (kind === "bark") {
      ctx.lineCap = "round";
      for (let i = 0; i < 52; i += 1) {
        const x = (i * 29) % 128;
        const sway = ((i * 17) % 13) - 6;
        ctx.globalAlpha = 0.12 + (i % 5) * 0.035;
        ctx.strokeStyle = i % 4 === 0 ? light : dark;
        ctx.lineWidth = 1 + (i % 4) * 0.72;
        ctx.beginPath();
        ctx.moveTo(x, -8);
        ctx.bezierCurveTo(x + sway, 34, x - sway * 0.6, 88, x + sway * 0.4, 136);
        ctx.stroke();
      }
    } else {
      for (let i = 0; i < 112; i += 1) {
        const x = (i * 37) % 128;
        const y = (i * 61) % 128;
        const w = 2 + ((i * 17) % 11);
        const h = 2 + ((i * 19) % 9);
        ctx.globalAlpha = 0.1 + (i % 7) * 0.025;
        ctx.fillStyle = i % 3 === 0 ? light : dark;
        ctx.fillRect(x, y, w, h);
      }
    }

    ctx.globalAlpha = 1;
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.anisotropy = 8;
  texture.needsUpdate = true;
  return texture;
}

function useSafeForestTextures(): ForestTexturePack {
  const groundAlbedo = useTexture(FOREST_GROUND_ALBEDO_PATH);
  const textures = useMemo<ForestTexturePack>(
    () => ({
      barkMap: createSafeCanvasTexture("bark"),
      barkNormalMap: null,
      barkRoughnessMap: null,
      crownMap: createSafeCanvasTexture("crown"),
      crownNormalMap: null,
      crownRoughnessMap: null,
      marshMap: groundAlbedo.clone(),
      marshNormalMap: null,
      marshRoughnessMap: null,
      ruinMap: createSafeCanvasTexture("ruin"),
      ruinNormalMap: null,
      ruinRoughnessMap: null,
    }),
    [groundAlbedo],
  );

  useEffect(() => {
    textures.barkMap.repeat.set(1.4, 2.6);
    textures.crownMap.repeat.set(1.1, 1.1);
    textures.marshMap.colorSpace = THREE.SRGBColorSpace;
    textures.marshMap.wrapS = THREE.RepeatWrapping;
    textures.marshMap.wrapT = THREE.RepeatWrapping;
    textures.marshMap.anisotropy = 4;
    textures.marshMap.repeat.set(144, 144);
    textures.marshMap.needsUpdate = true;
    textures.ruinMap.repeat.set(1.8, 1.8);

    return () => {
      textures.barkMap.dispose();
      textures.crownMap.dispose();
      textures.marshMap.dispose();
      textures.ruinMap.dispose();
    };
  }, [textures]);

  return textures;
}

function HillyForestGround({
  entries,
  pathSegments,
  narrativeWorldState,
  visualState,
  textures,
}: {
  entries: Slipper3DEntry[];
  pathSegments: MazePathSegment[];
  narrativeWorldState: NarrativeWorldState;
  visualState: WorldVisualState;
  textures: ForestTexturePack;
}) {
  const geometry = useMemo(() => {
    const geometry = new THREE.PlaneGeometry(
      TERRAIN_SIZE,
      TERRAIN_SIZE,
      TERRAIN_SEGMENTS,
      TERRAIN_SEGMENTS,
    );
    geometry.rotateX(-Math.PI / 2);

    const positions = geometry.getAttribute("position") as THREE.BufferAttribute;
    for (let index = 0; index < positions.count; index += 1) {
      positions.setY(index, TERRAIN_BASE_Y);
    }
    positions.setUsage(THREE.DynamicDrawUsage);

    const colorValues = new Float32Array(positions.count * 3);
    colorValues.fill(1);
    const colors = new THREE.BufferAttribute(colorValues, 3);
    colors.setUsage(THREE.DynamicDrawUsage);
    geometry.setAttribute("color", colors);
    geometry.computeVertexNormals();
    geometry.computeBoundingBox();
    geometry.computeBoundingSphere();

    return geometry;
  }, []);

  const workerRef = useRef<Worker | null>(null);
  const requestIdRef = useRef(0);
  const colliderRevisionRef = useRef(0);
  const clearingSeeds = useMemo(() => packForestClearingSeeds(entries), [entries]);
  const pathSeeds = useMemo(() => packForestPathSeeds(pathSegments, entries), [entries, pathSegments]);
  const terrainShapeToken = useMemo(
    () => ({}),
    [
      clearingSeeds,
      narrativeWorldState.explorationDepth,
      narrativeWorldState.memoryPressure,
      pathSeeds,
    ],
  );
  const latestRequestShapeTokenRef = useRef(terrainShapeToken);
  const colliderShapeTokenRef = useRef<object | null>(null);
  const terrainIndices = useMemo(() => {
    const index = geometry.getIndex();
    return index ? Uint32Array.from(index.array) : new Uint32Array();
  }, [geometry]);
  const [terrainSurface, setTerrainSurface] = useState<
    Extract<ForestWorkerResponse, { type: "TERRAIN_READY" }>
  >(() => ({
    type: "TERRAIN_READY",
    requestId: 0,
    positions: Float32Array.from(
      (geometry.getAttribute("position") as THREE.BufferAttribute).array,
    ),
    colors: Float32Array.from(
      (geometry.getAttribute("color") as THREE.BufferAttribute).array,
    ),
  }));
  const [terrainColliderSurface, setTerrainColliderSurface] = useState<{
    revision: number;
    positions: Extract<
      ForestWorkerResponse,
      { type: "TERRAIN_READY" }
    >["positions"];
  }>(() => ({
    revision: 0,
    positions: Float32Array.from(
      (geometry.getAttribute("position") as THREE.BufferAttribute).array,
    ),
  }));

  useEffect(() => {
    const worker = new Worker(new URL("../../workers/forestWorker.ts", import.meta.url), { type: "module" });
    workerRef.current = worker;

    worker.onmessage = (event: MessageEvent<ForestWorkerResponse>) => {
      const result = event.data;
      if (result.type !== "TERRAIN_READY" || result.requestId !== requestIdRef.current) return;
      setTerrainSurface(result);
      const shapeToken = latestRequestShapeTokenRef.current;
      if (colliderShapeTokenRef.current !== shapeToken) {
        colliderShapeTokenRef.current = shapeToken;
        colliderRevisionRef.current += 1;
        setTerrainColliderSurface({
          revision: colliderRevisionRef.current,
          positions: result.positions,
        });
      }
    };

    return () => {
      worker.terminate();
      workerRef.current = null;
    };
  }, []);

  useLayoutEffect(() => {
    const positionAttribute = geometry.getAttribute("position") as THREE.BufferAttribute;
    const colorAttribute = geometry.getAttribute("color") as THREE.BufferAttribute;

    positionAttribute.array.set(terrainSurface.positions);
    colorAttribute.array.set(terrainSurface.colors);
    positionAttribute.needsUpdate = true;
    colorAttribute.needsUpdate = true;
    geometry.computeVertexNormals();
    geometry.computeBoundingBox();
    geometry.computeBoundingSphere();
  }, [geometry, terrainSurface]);

  useEffect(() => {
    const worker = workerRef.current;
    if (!worker) return;

    requestIdRef.current += 1;
    latestRequestShapeTokenRef.current = terrainShapeToken;

    const config: TerrainWorkerConfig = {
      terrainSize: TERRAIN_SIZE,
      terrainSegments: TERRAIN_SEGMENTS,
      terrainBaseY: TERRAIN_BASE_Y,
      clearingSafeRadius: FOREST_CLEARING_RADIUS,
      corridorBaseWidth: CORRIDOR_BASE_WIDTH,
      crownedRampWidth: CROWNED_RETURN_RAMP_WIDTH,
      explorationDepth: narrativeWorldState.explorationDepth,
      memoryPressure: narrativeWorldState.memoryPressure,
      groundColor: visualState.palette.ground,
      clearings: clearingSeeds,
      paths: pathSeeds,
    };

    worker.postMessage({
      type: "GENERATE_TERRAIN",
      requestId: requestIdRef.current,
      config,
    });
  }, [
    clearingSeeds,
    geometry,
    narrativeWorldState.explorationDepth,
    narrativeWorldState.memoryPressure,
    pathSeeds,
    terrainShapeToken,
    visualState.palette.ground,
  ]);

  useEffect(() => () => geometry.dispose(), [geometry]);

  return (
    <RigidBody type="fixed" colliders={false}>
      {terrainIndices.length > 0 ? (
        <TrimeshCollider
          key={`terrain-collider-${terrainColliderSurface.revision}`}
          args={[terrainColliderSurface.positions, terrainIndices]}
          friction={1.45}
        />
      ) : null}
      <mesh geometry={geometry} receiveShadow>
        <meshStandardMaterial
          map={textures.marshMap}
          normalMap={textures.marshNormalMap}
          roughnessMap={textures.marshRoughnessMap}
          vertexColors
          color="#ffffff"
          roughness={0.78}
          metalness={0.025}
        />
      </mesh>
    </RigidBody>
  );
}

type ClearingFrameTree = {
  x: number;
  z: number;
  groundY: number;
  height: number;
  width: number;
  crownRadius: number;
  crownHeight: number;
  lean: number;
  yaw: number;
};

function ClearingForestFrame({
  center,
  openingAngles,
  visualState,
  qualityProfile,
  textures,
  seed,
  trunkGeometry,
  crownGeometry,
  groundYAt,
}: {
  center: Vector3Tuple;
  openingAngles: number[];
  visualState: WorldVisualState;
  qualityProfile: RenderQualityProfile;
  textures: ForestTexturePack;
  seed: number;
  trunkGeometry: THREE.BufferGeometry;
  crownGeometry: THREE.BufferGeometry;
  groundYAt: (x: number, z: number) => number;
}) {
  const viewportAspect = useThree(
    (state) => state.size.width / Math.max(1, state.size.height),
  );
  const trunkRef = useRef<THREE.InstancedMesh>(null);
  const crownRef = useRef<THREE.InstancedMesh>(null);
  const portraitFrame = viewportAspect < 0.78;
  const routeOpeningHalfAngle = portraitFrame ? 0.46 : 0.36;
  const requestedCount = qualityProfile.quality === "low"
    ? 10
    : qualityProfile.quality === "medium"
      ? 16
      : qualityProfile.quality === "high"
        ? 22
        : 26;
  const treeCount = visualState.biome === "archive"
    ? Math.max(4, Math.round(requestedCount * 0.34))
    : visualState.biome === "mirror"
      ? Math.max(6, Math.round(requestedCount * 0.62))
      : requestedCount;
  const trees = useMemo<ClearingFrameTree[]>(() => {
    const next: ClearingFrameTree[] = [];
    const candidateLimit = treeCount * 4;

    for (let index = 0; index < candidateLimit && next.length < treeCount; index += 1) {
      const ringOffset = seededUnit(seed, index + 41) * 1.9;
      let angle = (index / treeCount) * Math.PI * 2 + (seededUnit(seed, index + 83) - 0.5) * 0.32;
      const intersectsRoute = openingAngles.some((openingAngle) => {
        const signedOpeningOffset = Math.atan2(
          Math.sin(angle - openingAngle),
          Math.cos(angle - openingAngle),
        );
        return Math.abs(signedOpeningOffset) < routeOpeningHalfAngle;
      });
      if (intersectsRoute) continue;

      const radius = 7.9 + ringOffset + (index % 3) * 0.82;
      const x = center[0] + Math.cos(angle) * radius;
      const z = center[2] + Math.sin(angle) * radius;
      next.push({
        x,
        z,
        groundY: groundYAt(x, z),
        height: 9.6 + seededUnit(seed, index + 127) * 6.8,
        width: 0.3 + seededUnit(seed, index + 169) * 0.22,
        crownRadius: 1.32 + seededUnit(seed, index + 211) * 0.82,
        crownHeight: 2.28 + seededUnit(seed, index + 257) * 1.2,
        lean: (seededUnit(seed, index + 293) - 0.5) * 0.09,
        yaw: seededUnit(seed, index + 331) * Math.PI * 2,
      });
    }

    return next;
  }, [center, groundYAt, openingAngles, routeOpeningHalfAngle, seed, treeCount]);

  useLayoutEffect(() => {
    const trunk = trunkRef.current;
    const crown = crownRef.current;
    if (!trunk || !crown) return;

    const dummy = new THREE.Object3D();
    const crownColor = new THREE.Color();
    for (let index = 0; index < trees.length; index += 1) {
      const tree = trees[index];
      const groundY = tree.groundY;

      dummy.position.set(tree.x, groundY + tree.height * 0.5, tree.z);
      dummy.rotation.set(tree.lean, tree.yaw, tree.lean * 0.38);
      dummy.scale.set(tree.width, tree.height, tree.width);
      dummy.updateMatrix();
      trunk.setMatrixAt(index, dummy.matrix);

      dummy.position.set(
        tree.x - Math.sin(tree.yaw) * tree.crownRadius * 0.08,
        groundY + tree.height * 0.8 + tree.crownHeight * 0.32,
        tree.z + Math.cos(tree.yaw) * tree.crownRadius * 0.08,
      );
      dummy.rotation.set(tree.lean * 0.36, tree.yaw, -tree.lean * 0.26);
      dummy.scale.set(
        tree.crownRadius * 1.12,
        Math.max(tree.crownRadius * 0.76, tree.crownHeight * 0.82),
        tree.crownRadius * 1.08,
      );
      dummy.updateMatrix();
      crown.setMatrixAt(index, dummy.matrix);
      crownColor.setHSL(
        0.35 + (seededUnit(seed, index + 389) - 0.5) * 0.025,
        0.12 + seededUnit(seed, index + 401) * 0.08,
        0.58 + seededUnit(seed, index + 419) * 0.1,
      );
      crown.setColorAt(index, crownColor);
    }

    for (const mesh of [trunk, crown]) {
      mesh.count = trees.length;
      mesh.instanceMatrix.needsUpdate = true;
      mesh.computeBoundingBox();
      mesh.computeBoundingSphere();
    }
    if (crown.instanceColor) crown.instanceColor.needsUpdate = true;
  }, [seed, trees]);

  const castShadow = qualityProfile.enableMoonShadows;

  return (
    <group>
      <RigidBody type="fixed" colliders={false}>
        {trees.map((tree, index) => (
          <CuboidCollider
            key={`clearing-frame-collider-${index}`}
            args={[
              Math.max(0.42, tree.width * ROOTED_TRUNK_COLLIDER_SCALE),
              tree.height * 0.44,
              Math.max(0.42, tree.width * ROOTED_TRUNK_COLLIDER_SCALE),
            ]}
            position={[tree.x, tree.groundY + tree.height * 0.5, tree.z]}
            friction={1.35}
          />
        ))}
      </RigidBody>
      <instancedMesh ref={trunkRef} args={[trunkGeometry, undefined, requestedCount]} castShadow={castShadow} receiveShadow>
        <meshStandardMaterial map={textures.barkMap} normalMap={textures.barkNormalMap} roughnessMap={textures.barkRoughnessMap} color="#81756d" emissive={visualState.palette.trunk} emissiveIntensity={0.055} roughness={0.9} metalness={0.01} />
      </instancedMesh>
      <instancedMesh ref={crownRef} args={[crownGeometry, undefined, requestedCount]} castShadow={castShadow} receiveShadow>
        <meshStandardMaterial map={textures.crownMap} vertexColors color="#e2e8e2" emissive={visualState.palette.leaf} emissiveIntensity={0.045} roughness={0.88} />
      </instancedMesh>
    </group>
  );
}

function ContinuousForestBed({
  entries,
  pathSegments,
  narrativeWorldState,
  activeEntry,
  qualityProfile,
  showClearingFrame = true,
}: {
  entries: Slipper3DEntry[];
  pathSegments: MazePathSegment[];
  narrativeWorldState: NarrativeWorldState;
  activeEntry: Slipper3DEntry;
  qualityProfile: RenderQualityProfile;
  showClearingFrame?: boolean;
}) {
  const { camera } = useThree();

  const trunkRef = useRef<THREE.InstancedMesh>(null);
  const crownRef = useRef<THREE.InstancedMesh>(null);
  const marshRef = useRef<THREE.InstancedMesh>(null);
  const ruinRef = useRef<THREE.InstancedMesh>(null);
  const trunkGeometry = useMemo(() => createForestTrunkGeometry(), []);
  const crownGeometry = useMemo(() => createOrganicCrownGeometry(0), []);
  const clearingCrownGeometry = useMemo(() => createOrganicCrownGeometry(1), []);

  const workerRef = useRef<Worker | null>(null);
  const requestIdRef = useRef(0);
  const lastCellRef = useRef({
    cellX: Number.NaN,
    cellZ: Number.NaN,
    depth: Number.NaN,
    pressure: Number.NaN,
    entryCount: Number.NaN,
    quality: "",
    forestDensity: Number.NaN,
    pathClarity: Number.NaN,
  });
  const visualState = useMemo(
    () => resolveWorldVisualState({ entry: activeEntry, narrativeWorldState }),
    [activeEntry, narrativeWorldState],
  );

  // Safe procedural fallback textures prevent a black screen when production KTX2 assets
  // have not yet been uploaded to /public/textures/forest. The material slots remain
  // compatible with real map/normal/roughness textures later.
  const forestTextures = useSafeForestTextures();

  const [treeColliders, setTreeColliders] = useState<PackedForestCollider[]>([]);

  const clearingSeeds = useMemo(() => packForestClearingSeeds(entries), [entries]);

  const pathSeeds = useMemo<ForestPathSeed[]>(
    () => packForestPathSeeds(pathSegments, entries),
    [entries, pathSegments],
  );
  const activePosition = useMemo(
    () => entryWorldPosition(activeEntry, entries),
    [activeEntry, entries],
  );
  const forestTerrainMorph = useMemo(
    () => ({
      memoryPressure: narrativeWorldState.memoryPressure,
      explorationDepth: narrativeWorldState.explorationDepth,
    }),
    [narrativeWorldState.explorationDepth, narrativeWorldState.memoryPressure],
  );
  const forestGroundYAt = useCallback(
    (x: number, z: number) =>
      TERRAIN_BASE_Y + terrainElevationAtPoint(x, z, entries, pathSegments, forestTerrainMorph),
    [entries, forestTerrainMorph, pathSegments],
  );
  const clearingOpeningAngles = useMemo(() => {
    const angles: number[] = [];
    const morph = {
      memoryPressure: narrativeWorldState.memoryPressure,
      explorationDepth: narrativeWorldState.explorationDepth,
    };

    for (const segment of pathSegments) {
      const activeIsSource = segment.sourceEntry.id === activeEntry.id;
      const activeIsTarget = segment.targetEntry.id === activeEntry.id;
      if (!activeIsSource && !activeIsTarget) continue;
      const tangent = curvedPathTangentAt(segment, activeIsSource ? 0 : 1, morph);
      if (activeIsTarget) tangent.multiplyScalar(-1);
      const angle = Math.atan2(tangent.y, tangent.x);
      const duplicatesExisting = angles.some((candidate) =>
        Math.abs(Math.atan2(Math.sin(angle - candidate), Math.cos(angle - candidate))) < 0.16,
      );
      if (!duplicatesExisting) angles.push(angle);
    }

    return angles;
  }, [
    activeEntry.id,
    narrativeWorldState.explorationDepth,
    narrativeWorldState.memoryPressure,
    pathSegments,
  ]);

  useEffect(() => () => {
    trunkGeometry.dispose();
    crownGeometry.dispose();
    clearingCrownGeometry.dispose();
  }, [clearingCrownGeometry, crownGeometry, trunkGeometry]);

  useEffect(() => {
    for (const mesh of [trunkRef.current, crownRef.current, marshRef.current, ruinRef.current]) {
      if (!mesh) continue;
      mesh.count = 0;
      mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    }

    const worker = new Worker(new URL("../../workers/forestWorker.ts", import.meta.url), { type: "module" });
    workerRef.current = worker;

    worker.onmessage = (event: MessageEvent<ForestWorkerResponse>) => {
      const result = event.data;
      if (result.type !== "FOREST_READY" || result.requestId !== requestIdRef.current) return;

      const meshes = [
        { mesh: trunkRef.current, matrices: result.trunkMatrices, colors: result.trunkColors, count: result.trunkCount },
        { mesh: crownRef.current, matrices: result.crownMatrices, colors: result.crownColors, count: result.crownCount },
        { mesh: marshRef.current, matrices: result.marshMatrices, colors: result.marshColors, count: result.marshCount },
        { mesh: ruinRef.current, matrices: result.ruinMatrices, colors: result.ruinColors, count: result.ruinCount },
      ];

      for (const item of meshes) {
        if (!item.mesh) continue;
        item.mesh.count = Math.min(item.count, FOREST_INSTANCE_COUNT);
        item.mesh.instanceMatrix.array.set(item.matrices);
        item.mesh.instanceMatrix.needsUpdate = true;

        if (!item.mesh.instanceColor) {
          item.mesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(FOREST_INSTANCE_COUNT * 3), 3);
        }

        item.mesh.instanceColor.array.set(item.colors);
        item.mesh.instanceColor.needsUpdate = true;
        item.mesh.computeBoundingBox();
        item.mesh.computeBoundingSphere();
      }

      setTreeColliders(result.colliders);
    };

    return () => {
      worker.terminate();
      workerRef.current = null;
    };
  }, []);

  const requestForestBuild = (cellX: number, cellZ: number) => {
    const worker = workerRef.current;
    if (!worker) return;

    requestIdRef.current += 1;

    const config: ForestWorkerConfig = {
      cellSize: FOREST_CELL_SIZE,
      cellRadius: Math.min(FOREST_CELL_RADIUS, qualityProfile.forestCellRadius),
      treesPerCell: Math.min(FOREST_TREES_PER_CELL, qualityProfile.treesPerCell),
      instanceCount: FOREST_INSTANCE_COUNT,
      clearingSafeRadius: FOREST_CLEARING_RADIUS,
      corridorBaseWidth: CORRIDOR_BASE_WIDTH,
      corridorMinWidth: CORRIDOR_MIN_WIDTH,
      treeColliderLimit: TREE_COLLIDER_LIMIT,
      terrainBaseY: TERRAIN_BASE_Y,
      terrainColliderY: TERRAIN_COLLIDER_Y,
      terrainSize: TERRAIN_SIZE,
      terrainSegments: TERRAIN_SEGMENTS,
      crownedRampWidth: CROWNED_RETURN_RAMP_WIDTH,
      cameraX: camera.position.x,
      cameraZ: camera.position.z,
      cellX,
      cellZ,
      explorationDepth: narrativeWorldState.explorationDepth,
      memoryPressure: narrativeWorldState.memoryPressure,
      forestDensity: visualState.director.forestDensity,
      pathClarity: visualState.pathClarity,
      clearings: clearingSeeds,
      paths: pathSeeds,
    };

    worker.postMessage({ type: "BUILD_FOREST", requestId: requestIdRef.current, config });
  };

  useFrame(() => {
    const cameraPosition = camera.position;
    const cellX = Math.floor(cameraPosition.x / FOREST_CELL_SIZE);
    const cellZ = Math.floor(cameraPosition.z / FOREST_CELL_SIZE);
    const depth = Math.round(narrativeWorldState.explorationDepth * 100);
    const pressure = Math.round(narrativeWorldState.memoryPressure * 100);
    const entryCount = entries.length;
    const quality = qualityProfile.quality;
    const forestDensity = Math.round(visualState.director.forestDensity * 100);
    const pathClarity = Math.round(visualState.pathClarity * 100);
    const last = lastCellRef.current;

    if (
      last.cellX === cellX &&
      last.cellZ === cellZ &&
      last.depth === depth &&
      last.pressure === pressure &&
      last.entryCount === entryCount &&
      last.quality === quality &&
      last.forestDensity === forestDensity &&
      last.pathClarity === pathClarity
    ) {
      return;
    }

    last.cellX = cellX;
    last.cellZ = cellZ;
    last.depth = depth;
    last.pressure = pressure;
    last.entryCount = entryCount;
    last.quality = quality;
    last.forestDensity = forestDensity;
    last.pathClarity = pathClarity;

    requestForestBuild(cellX, cellZ);
  });

  return (
    <group>
      <RigidBody type="fixed" colliders={false}>
        {treeColliders.map((collider, index) => (
          <CuboidCollider key={`forest-collider-${index}`} args={collider.args} position={collider.position} friction={1.4} />
        ))}
      </RigidBody>

      <HillyForestGround entries={entries} pathSegments={pathSegments} narrativeWorldState={narrativeWorldState} visualState={visualState} textures={forestTextures} />
      {showClearingFrame ? (
        <ClearingForestFrame
          center={activePosition}
          openingAngles={clearingOpeningAngles}
          visualState={visualState}
          qualityProfile={qualityProfile}
          textures={forestTextures}
          seed={hashString(`${activeEntry.id}-clearing-frame`)}
          trunkGeometry={trunkGeometry}
          crownGeometry={clearingCrownGeometry}
          groundYAt={forestGroundYAt}
        />
      ) : null}
      <instancedMesh ref={trunkRef} args={[trunkGeometry, undefined, FOREST_INSTANCE_COUNT]} frustumCulled castShadow receiveShadow>
        <meshStandardMaterial map={forestTextures.barkMap} normalMap={forestTextures.barkNormalMap} roughnessMap={forestTextures.barkRoughnessMap} vertexColors color="#948579" emissive={visualState.palette.trunk} emissiveIntensity={0.045 + visualState.silhouetteContrast * 0.025} roughness={0.88} metalness={0.01} />
      </instancedMesh>

      <instancedMesh ref={crownRef} args={[crownGeometry, undefined, FOREST_INSTANCE_COUNT]} frustumCulled castShadow receiveShadow>
        <meshStandardMaterial map={forestTextures.crownMap} normalMap={forestTextures.crownNormalMap} roughnessMap={forestTextures.crownRoughnessMap} vertexColors color="#e8eee8" emissive={visualState.palette.leaf} emissiveIntensity={0.055 + visualState.silhouetteContrast * 0.025} roughness={0.88} metalness={0.01} />
      </instancedMesh>

      <instancedMesh ref={marshRef} args={[undefined, undefined, FOREST_INSTANCE_COUNT]} frustumCulled receiveShadow>
        <circleGeometry args={[1, 24]} />
        <meshStandardMaterial map={forestTextures.marshMap} normalMap={forestTextures.marshNormalMap} roughnessMap={forestTextures.marshRoughnessMap} vertexColors color={visualState.palette.accent} emissive={visualState.palette.emissive} emissiveIntensity={0.07} metalness={0.22} roughness={0.28} transparent opacity={0.28 * visualState.semanticOpacity} side={THREE.DoubleSide} depthWrite={false} />
      </instancedMesh>

      <instancedMesh ref={ruinRef} args={[undefined, undefined, FOREST_INSTANCE_COUNT]} frustumCulled castShadow receiveShadow>
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial map={forestTextures.ruinMap} normalMap={forestTextures.ruinNormalMap} roughnessMap={forestTextures.ruinRoughnessMap} vertexColors color="#ffffff" roughness={0.9} metalness={0.045} transparent opacity={0.64 * visualState.semanticOpacity} />
      </instancedMesh>
    </group>
  );
}

type SemanticPathTheme = "archive" | "fire" | "water" | "threshold" | "crown" | "thorns" | "celestial";

type SemanticThemeResult = {
  theme: SemanticPathTheme;
  score: number;
};

const SEMANTIC_PATH_THEMES: SemanticPathTheme[] = ["archive", "fire", "water", "threshold", "crown", "thorns", "celestial"];

const SEMANTIC_THEME_PATTERNS: Record<SemanticPathTheme, RegExp[]> = {
  archive: [/\barchives?\b/g, /\barchived\b/g, /\bmoon\b/g, /\bnight\b/g, /\bmemory\b/g, /\bmemories\b/g, /\bsilence\b/g, /\bsilent\b/g],
  fire: [/\bfire\b/g, /\bembers?\b/g, /\bburn(?:ed|ing|s)?\b/g, /\bash(?:es)?\b/g, /\bflames?\b/g, /\bsmoke\b/g],
  water: [/\bwater\b/g, /\brivers?\b/g, /\bmirrors?\b/g, /\bpools?\b/g, /\breflection\b/g, /\breflections\b/g, /\brain\b/g],
  threshold: [/\bthresholds?\b/g, /\bhouses?\b/g, /\bdoors?\b/g, /\bcrossing\b/g, /\bcrossings\b/g, /\bgates?\b/g],
  crown: [/\bcrowns?\b/g, /\breturn\b/g, /\breturns\b/g, /\breturned\b/g, /\breturning\b/g, /\bexits?\b/g, /\bgold(?:en)?\b/g],
  thorns: [/\bthorns?\b/g, /\brot\b/g, /\bdecay\b/g],
  celestial: [/\bstars?\b/g, /\bconstellation\b/g],
};

function countPatternMatches(signal: string, patterns: RegExp[]) {
  return patterns.reduce((total, pattern) => total + (signal.match(pattern)?.length ?? 0), 0);
}

function dominantSemanticTheme(entry: Slipper3DEntry): SemanticThemeResult {
  const signal = entrySemanticSignal(entry);
  const scores = SEMANTIC_PATH_THEMES.map((theme) => ({
    theme,
    score: countPatternMatches(signal, SEMANTIC_THEME_PATTERNS[theme]),
  }));

  const bump = (theme: SemanticPathTheme, amount: number) => {
    const target = scores.find((candidate) => candidate.theme === theme);
    if (target) target.score += amount;
  };

  if (isChapter(entry, CHAPTER_MIRROR_CLEARING)) bump("water", 10);
  if (isChapter(entry, CHAPTER_THORNED_HOUSE)) {
    bump("threshold", 6);
    bump("thorns", 8);
  }
  if (isChapter(entry, CHAPTER_BLUE_MOON_ARCHIVE)) bump("archive", 8);
  if (isChapter(entry, CHAPTER_FIRE_AND_RIVER)) bump("fire", 12);
  if (isChapter(entry, CHAPTER_CROWNED_RETURN)) bump("crown", 14);

  scores.sort((a, b) => b.score - a.score);
  const dominant = scores[0];
  if (dominant.score > 0) return dominant;

  const fallbackSignal = (entry.engine3d.sceneKind ?? "") + " " + (entry.engine3d.mood ?? "") + " " + (entry.engine3d.emotionalTone ?? "");
  if (/fire|ember|ash|burn|flame/.test(fallbackSignal)) return { theme: "fire", score: 1 };
  if (/water|river|mirror|pool|reflection/.test(fallbackSignal)) return { theme: "water", score: 1 };
  if (/threshold|house|door|crossing/.test(fallbackSignal)) return { theme: "threshold", score: 1 };
  if (/thorn|rot|decay/.test(fallbackSignal)) return { theme: "thorns", score: 1 };
  if (/star|constellation|celestial/.test(fallbackSignal)) return { theme: "celestial", score: 1 };
  if (/crown|return|exit/.test(fallbackSignal)) return { theme: "crown", score: 1 };
  return { theme: "archive", score: 0.5 };
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

function cloneTransparentModel(sourceScene: THREE.Group, baseOpacity: number) {
  const clone = sourceScene.clone(true);
  const materials: THREE.Material[] = [];

  clone.traverse((object) => {
    const mesh = object as THREE.Mesh;
    if (!mesh.isMesh) return;

    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.frustumCulled = false;

    const cloneMaterial = (material: THREE.Material) => {
      const cloned = material.clone();
      cloned.transparent = true;
      cloned.opacity = baseOpacity;
      cloned.depthWrite = false;
      materials.push(cloned);
      return cloned;
    };

    if (Array.isArray(mesh.material)) {
      mesh.material = mesh.material.map(cloneMaterial);
    } else if (mesh.material) {
      mesh.material = cloneMaterial(mesh.material);
    }
  });

  return { scene: clone, materials };
}

function npcFallbackColor(kind: NPCEncounterKind) {
  if (kind === "wolf") return "#8f7560";
  if (kind === "phantom") return "#c9c2df";
  return "#f2ead2";
}

function ProceduralNPCFallback({ config }: { config: NPCEncounterConfig }) {
  const { camera } = useThree();
  const groupRef = useRef<THREE.Group>(null);
  const materialRef = useRef<THREE.MeshBasicMaterial>(null);
  const worldPositionRef = useRef(new THREE.Vector3());
  const opacityRef = useRef(config.baseOpacity * 0.72);
  const color = npcFallbackColor(config.kind);

  useFrame((_, delta) => {
    if (!groupRef.current) return;

    groupRef.current.getWorldPosition(worldPositionRef.current);
    const dx = camera.position.x - worldPositionRef.current.x;
    const dz = camera.position.z - worldPositionRef.current.z;
    const playerDistance = Math.sqrt(dx * dx + dz * dz);
    const fade = THREE.MathUtils.smoothstep(playerDistance, config.fadeNear, config.fadeFar);
    opacityRef.current = THREE.MathUtils.lerp(opacityRef.current, config.baseOpacity * 0.72 * fade, 1 - Math.exp(-delta * 4.2));

    if (materialRef.current) materialRef.current.opacity = opacityRef.current;
    groupRef.current.visible = opacityRef.current > 0.025;
  });

  return (
    <Float speed={0.95} rotationIntensity={0.07} floatIntensity={0.26} floatingRange={[-0.04, 0.13]}>
      <group ref={groupRef} position={config.position} rotation={config.rotation} scale={config.scale}>
        <mesh position={[0, 0.8, 0]}>
          {config.kind === "swan" ? <sphereGeometry args={[0.42, 24, 16]} /> : config.kind === "wolf" ? <coneGeometry args={[0.48, 1.1, 5]} /> : <sphereGeometry args={[0.46, 24, 16]} />}
          <meshBasicMaterial ref={materialRef} color={color} transparent opacity={config.baseOpacity * 0.72} depthWrite={false} />
        </mesh>
        {config.kind === "swan" ? (
          <>
            <mesh position={[-0.42, 0.72, 0]} rotation={[0, 0, -0.34]}>
              <planeGeometry args={[0.72, 0.28]} />
              <meshBasicMaterial color={color} transparent opacity={0.28} depthWrite={false} side={THREE.DoubleSide} />
            </mesh>
            <mesh position={[0.42, 0.72, 0]} rotation={[0, 0, 0.34]}>
              <planeGeometry args={[0.72, 0.28]} />
              <meshBasicMaterial color={color} transparent opacity={0.28} depthWrite={false} side={THREE.DoubleSide} />
            </mesh>
          </>
        ) : null}
        <mesh position={[0, 0.12, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <circleGeometry args={[1.2, 56]} />
          <meshBasicMaterial color="#fff4d2" transparent opacity={0.06} depthWrite={false} side={THREE.DoubleSide} />
        </mesh>
      </group>
    </Float>
  );
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
  const { camera } = useThree();
  const groupRef = useRef<THREE.Group>(null);
  const worldPositionRef = useRef(new THREE.Vector3());
  const opacityRef = useRef(config.baseOpacity);
  const gltf = useGLTF(config.src) as { scene: THREE.Group };
  const model = useMemo(() => cloneTransparentModel(gltf.scene, config.baseOpacity), [gltf.scene, config.baseOpacity]);

  useEffect(() => {
    return () => {
      for (const material of model.materials) material.dispose();
    };
  }, [model.materials]);

  useFrame((_, delta) => {
    if (!groupRef.current) return;

    groupRef.current.getWorldPosition(worldPositionRef.current);
    const dx = camera.position.x - worldPositionRef.current.x;
    const dz = camera.position.z - worldPositionRef.current.z;
    const playerDistance = Math.sqrt(dx * dx + dz * dz);
    const fade = THREE.MathUtils.smoothstep(playerDistance, config.fadeNear, config.fadeFar);
    const targetOpacity = config.baseOpacity * fade;
    opacityRef.current = THREE.MathUtils.lerp(opacityRef.current, targetOpacity, 1 - Math.exp(-delta * 4.2));

    for (const material of model.materials) {
      material.opacity = opacityRef.current;
    }

    groupRef.current.visible = opacityRef.current > 0.025;
  });

  return (
    <Float speed={1.05} rotationIntensity={0.08} floatIntensity={0.34} floatingRange={[-0.06, 0.16]}>
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

function weatherConfigForEntry(entry: Slipper3DEntry, narrativeWorldState: NarrativeWorldState) {
  const semantic = dominantSemanticTheme(entry);
  const pressure = narrativeWorldState.memoryPressure;
  const depth = narrativeWorldState.explorationDepth;

  if (semantic.theme === "fire") {
    return {
      key: "fire",
      color: "#ff7a2e",
      count: 72 + Math.round(depth * 32),
      scale: [7.8, 2.1, 7.8] as Vector3Tuple,
      size: 2.3 + semantic.score * 0.08,
      speed: 0.42,
      opacity: 0.54 + pressure * 0.16,
    };
  }

  if (semantic.theme === "water") {
    return {
      key: "water",
      color: "#82c9ff",
      count: 86 + Math.round(depth * 22),
      scale: [8.6, 1.8, 8.6] as Vector3Tuple,
      size: 1.55 + semantic.score * 0.045,
      speed: 0.24,
      opacity: 0.44 + pressure * 0.12,
    };
  }

  if (semantic.theme === "archive") {
    return {
      key: "archive",
      color: "#fff5ce",
      count: 104 + Math.round(pressure * 42),
      scale: [9.2, 2.9, 9.2] as Vector3Tuple,
      size: 1.75 + pressure * 0.8,
      speed: 0.16,
      opacity: 0.46 + pressure * 0.18,
    };
  }

  if (semantic.theme === "crown") {
    return {
      key: "crown",
      color: "#f3d37a",
      count: 96 + Math.round(depth * 28),
      scale: [8.4, 2.7, 8.4] as Vector3Tuple,
      size: 1.95 + depth * 0.9,
      speed: 0.2,
      opacity: 0.5 + pressure * 0.12,
    };
  }

  return {
    key: "threshold",
    color: "#f4efe2",
    count: 58 + Math.round(depth * 24),
    scale: [7.4, 2.0, 7.4] as Vector3Tuple,
    size: 1.6,
    speed: 0.18,
    opacity: 0.38 + pressure * 0.1,
  };
}

function NarrativeWeather({
  entry,
  narrativeWorldState,
  qualityProfile,
}: {
  entry: Slipper3DEntry;
  narrativeWorldState: NarrativeWorldState;
  qualityProfile: RenderQualityProfile;
}) {
  const director = useMemo(() => resolveChapterDirector(entry), [entry]);
  const weather = useMemo(() => weatherConfigForEntry(entry, narrativeWorldState), [entry, narrativeWorldState]);
  const particleCount = Math.max(12, Math.round(weather.count * director.weatherMultiplier * qualityProfile.particleMultiplier));

  return (
    <group position={[0, 1.24, 0]}>
      <Sparkles
        key={`${entry.id}-${weather.key}`}
        count={particleCount}
        scale={weather.scale}
        size={weather.size * 0.09}
        speed={weather.speed}
        opacity={weather.opacity * 0.62}
        color={weather.color}
        noise={1.7}
      />
    </group>
  );
}

function createVignetteTexture() {
  const texture = new THREE.CanvasTexture(document.createElement("canvas"));
  const canvas = texture.image as HTMLCanvasElement;
  canvas.width = 512;
  canvas.height = 512;

  const ctx = canvas.getContext("2d");
  if (ctx) {
    const gradient = ctx.createRadialGradient(256, 256, 72, 256, 256, 256);
    gradient.addColorStop(0, "rgba(0,0,0,0)");
    gradient.addColorStop(0.48, "rgba(0,0,0,0)");
    gradient.addColorStop(0.72, "rgba(0,0,0,0.38)");
    gradient.addColorStop(1, "rgba(0,0,0,0.92)");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 512, 512);
  }

  texture.colorSpace = THREE.SRGBColorSpace;
  texture.needsUpdate = true;
  return texture;
}

function CinematicFrameOverlay({
  visualState,
  narrativeWorldState,
  qualityProfile,
}: {
  visualState: WorldVisualState;
  narrativeWorldState: NarrativeWorldState;
  qualityProfile: RenderQualityProfile;
}) {
  const { camera } = useThree();
  const groupRef = useRef<THREE.Group>(null);
  const materialRef = useRef<THREE.MeshBasicMaterial>(null);
  const opacityRef = useRef(0);
  const vignetteTexture = useMemo(() => (typeof document === "undefined" ? null : createVignetteTexture()), []);

  useEffect(() => () => vignetteTexture?.dispose(), [vignetteTexture]);

  useFrame((_, delta) => {
    const group = groupRef.current;
    if (!group || !qualityProfile.enableCinematicVignette) return;

    group.position.copy(camera.position);
    group.quaternion.copy(camera.quaternion);

    const qualityLift = qualityProfile.quality === "cinematic" ? 1.08 : qualityProfile.quality === "high" ? 0.92 : 0.72;
    const targetOpacity = visualState.vignetteIntensity * qualityLift * (0.82 + clamp01(narrativeWorldState.memoryPressure) * 0.22);
    opacityRef.current = THREE.MathUtils.lerp(opacityRef.current, targetOpacity, 1 - Math.exp(-delta * 3.4));
    if (materialRef.current) materialRef.current.opacity = opacityRef.current;
  });

  if (!qualityProfile.enableCinematicVignette || !vignetteTexture) return null;

  return (
    <group ref={groupRef} renderOrder={1000}>
      <mesh position={[0, 0, -0.72]} scale={[1.84, 1.08, 1]}>
        <planeGeometry args={[1, 1, 1, 1]} />
        <meshBasicMaterial
          ref={materialRef}
          map={vignetteTexture}
          transparent
          opacity={opacityRef.current || visualState.vignetteIntensity * 0.72}
          depthTest={false}
          depthWrite={false}
          toneMapped={false}
        />
      </mesh>
    </group>
  );
}

type WeatherLayerConfig = {
  key: string;
  color: string;
  count: number;
  scale: Vector3Tuple;
  size: number;
  speed: number;
  opacity: number;
  y: number;
};

function weatherLayersForBiome(visualState: WorldVisualState, narrativeWorldState: NarrativeWorldState): WeatherLayerConfig[] {
  const memory = clamp01(narrativeWorldState.memoryPressure);
  const depth = clamp01(narrativeWorldState.explorationDepth);
  const fireBias = clamp01(narrativeWorldState.fireWaterBalance * 0.5 + 0.5);
  const intensity = visualState.weatherIntensity;

  if (visualState.biome === "mirror") {
    return [
      { key: "mirror-mist", color: "#8fdcff", count: 96, scale: [16, 2.4, 16], size: 1.05, speed: 0.11, opacity: 0.34 + memory * 0.12, y: 0.86 },
      { key: "mirror-shards", color: "#d8f7ff", count: 34, scale: [10, 1.2, 10], size: 0.72, speed: 0.05, opacity: 0.2 + intensity * 0.12, y: 0.12 },
    ];
  }

  if (visualState.biome === "thorned") {
    return [
      { key: "thorn-ash", color: "#b69a8e", count: 76, scale: [13.5, 2.2, 13.5], size: 1.15, speed: 0.17, opacity: 0.28 + memory * 0.18, y: 0.72 },
      { key: "thorn-dust", color: "#4f3b31", count: 42, scale: [10, 1.0, 10], size: 0.82, speed: 0.08, opacity: 0.18 + memory * 0.08, y: -0.08 },
    ];
  }

  if (visualState.biome === "archive") {
    return [
      { key: "archive-stars", color: "#dbe6ff", count: 130, scale: [16, 4.2, 16], size: 0.96, speed: 0.08, opacity: 0.38 + intensity * 0.16, y: 1.54 },
      { key: "archive-paper", color: "#fff3ce", count: 48, scale: [12, 2.4, 12], size: 1.38, speed: 0.06, opacity: 0.2 + memory * 0.08, y: 0.46 },
    ];
  }

  if (visualState.biome === "fireRiver") {
    return [
      { key: "fire-river-embers", color: "#ff9a42", count: 86, scale: [14, 2.4, 14], size: 1.42, speed: 0.22 + fireBias * 0.1, opacity: 0.34 + fireBias * 0.18, y: 0.8 },
      { key: "fire-river-spray", color: "#7fd5ff", count: 58, scale: [13, 1.4, 13], size: 0.94, speed: 0.13, opacity: 0.18 + (1 - fireBias) * 0.16, y: 0.18 },
    ];
  }

  if (visualState.biome === "crowned") {
    return [
      { key: "crowned-gold-dust", color: "#ffe1a3", count: 118, scale: [16, 5.2, 16], size: 1.22 + depth * 0.32, speed: 0.1, opacity: 0.36 + intensity * 0.18, y: 1.72 },
      { key: "crowned-high-stars", color: "#fff7d8", count: 54, scale: [12, 6.2, 12], size: 1.6, speed: 0.04, opacity: 0.18 + depth * 0.12, y: 3.1 },
    ];
  }

  return [
    { key: "first-wood-pollen", color: "#d7c39a", count: 72, scale: [13.5, 2.4, 13.5], size: 0.96, speed: 0.08, opacity: 0.24 + memory * 0.1, y: 0.86 },
    { key: "first-wood-fireflies", color: "#ffd77a", count: 28, scale: [9, 1.8, 9], size: 1.4, speed: 0.12, opacity: 0.18 + intensity * 0.1, y: 0.3 },
  ];
}

function BiomeWeatherField({
  activeEntry,
  narrativeWorldState,
  visualState,
  qualityProfile,
}: {
  activeEntry: Slipper3DEntry;
  narrativeWorldState: NarrativeWorldState;
  visualState: WorldVisualState;
  qualityProfile: RenderQualityProfile;
}) {
  const { camera } = useThree();
  const groupRef = useRef<THREE.Group>(null);
  const layers = useMemo(
    () => weatherLayersForBiome(visualState, narrativeWorldState),
    [
      visualState.biome,
      visualState.weatherIntensity,
      narrativeWorldState.memoryPressure,
      narrativeWorldState.explorationDepth,
      narrativeWorldState.fireWaterBalance,
    ],
  );

  useFrame(({ clock }) => {
    if (!groupRef.current) return;
    groupRef.current.position.copy(camera.position);
    groupRef.current.rotation.y = Math.sin(clock.elapsedTime * 0.035 + hashString(activeEntry.chapter) * 0.0001) * 0.08;
  });

  const density = qualityProfile.weatherLayerMultiplier * qualityProfile.particleMultiplier * visualState.weatherIntensity;
  if (density < 0.08) return null;

  return (
    <group ref={groupRef}>
      {layers.map((layer) => (
        <group key={`${visualState.biome}-${layer.key}`} position={[0, layer.y, 0]}>
          <Sparkles
            count={Math.max(6, Math.round(layer.count * density))}
            scale={layer.scale}
            size={layer.size * 0.14}
            speed={layer.speed}
            opacity={layer.opacity * 0.66 * Math.min(1, density + 0.22)}
            color={layer.color}
            noise={visualState.biome === "thorned" ? 2.2 : 1.55}
          />
        </group>
      ))}

      {qualityProfile.enableBloomProxies && visualState.biome === "crowned" ? (
        <group position={[0, 1.6, -5.2]} rotation={[0, 0, 0]}>
          {[0, 1, 2].map((index) => (
            <mesh key={`crowned-light-shaft-${index}`} position={[(index - 1) * 1.4, 1.3 + index * 0.46, -index * 0.35]} rotation={[0.18, 0, (index - 1) * 0.08]}>
              <planeGeometry args={[0.24 + index * 0.08, 4.4 + index * 0.9]} />
              <meshBasicMaterial color="#ffe1a3" transparent opacity={(0.034 + index * 0.012) * visualState.bloomIntensity} depthWrite={false} side={THREE.DoubleSide} toneMapped={false} />
            </mesh>
          ))}
        </group>
      ) : null}
    </group>
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

  useEffect(() => {
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

function SafePointerLockLookControls() {
  const { camera, gl } = useThree();
  const rotationRef = useRef(new THREE.Euler(0, 0, 0, "YXZ"));

  useEffect(() => {
    const canvas = gl.domElement;
    const requestPointerLock = canvas.requestPointerLock?.bind(canvas);
    if (!requestPointerLock || !("pointerLockElement" in document)) return;

    const handleCanvasClick = () => {
      if (document.pointerLockElement === canvas) return;
      try {
        const pending = requestPointerLock();
        if (pending && typeof pending.catch === "function") pending.catch(() => undefined);
      } catch {
        // Embedded preview browsers can expose the API while denying the request.
      }
    };
    const handleMouseMove = (event: MouseEvent) => {
      if (document.pointerLockElement !== canvas) return;
      const rotation = rotationRef.current.setFromQuaternion(camera.quaternion);
      rotation.y -= event.movementX * 0.0019;
      rotation.x = THREE.MathUtils.clamp(
        rotation.x - event.movementY * 0.0019,
        -PLAYER_LOOK_DOWN_LIMIT,
        PLAYER_LOOK_UP_LIMIT,
      );
      camera.quaternion.setFromEuler(rotation);
    };

    canvas.addEventListener("click", handleCanvasClick);
    document.addEventListener("mousemove", handleMouseMove);
    return () => {
      canvas.removeEventListener("click", handleCanvasClick);
      document.removeEventListener("mousemove", handleMouseMove);
      if (document.pointerLockElement === canvas) document.exitPointerLock?.();
    };
  }, [camera, gl]);

  return null;
}

function SceneControls({ controls, mode }: { controls: StorySceneControls; mode: StorySceneMode }) {
  if (controls === "none" || mode !== "explore") return null;

  if (controls === "walk") {
    const touchLikeInput =
      typeof document !== "undefined" &&
      (document.documentElement.dataset.mobile === "true" ||
        window.matchMedia?.("(pointer: coarse)").matches === true);
    if (touchLikeInput) return null;
    const pointerLockAvailable =
      typeof document !== "undefined" &&
      "pointerLockElement" in document &&
      navigator.webdriver !== true &&
      typeof document.documentElement.requestPointerLock === "function";
    if (!pointerLockAvailable) return null;
    return <SafePointerLockLookControls />;
  }

  return (
    <OrbitControls
      enablePan={false}
      enableZoom={false}
      rotateSpeed={0.42}
      dampingFactor={0.08}
      enableDamping
      minPolarAngle={Math.PI * 0.22}
      maxPolarAngle={Math.PI * 0.78}
    />
  );
}


function NarrativeLightingRig({
  visualState,
  qualityProfile,
}: {
  visualState: WorldVisualState;
  qualityProfile: RenderQualityProfile;
}) {
  const { camera } = useThree();
  const moonRef = useRef<THREE.DirectionalLight>(null);
  const moonTargetRef = useRef<THREE.Object3D>(null);
  const rimRef = useRef<THREE.DirectionalLight>(null);
  const moonColorRef = useRef(new THREE.Color(visualState.moonColor));
  const rimColorRef = useRef(new THREE.Color(visualState.rimColor));
  const targetMoonColorRef = useRef(new THREE.Color(visualState.moonColor));
  const targetRimColorRef = useRef(new THREE.Color(visualState.rimColor));
  const moonOffsetRef = useRef(new THREE.Vector3(...visualState.moonPosition));
  const targetMoonOffsetRef = useRef(new THREE.Vector3(...visualState.moonPosition));
  const moonRightRef = useRef(new THREE.Vector3());
  const moonUpRef = useRef(new THREE.Vector3());
  const hasAnchoredMoonRef = useRef(false);
  const rimOffsetRef = useRef(new THREE.Vector3(...visualState.rimPosition));
  const targetRimOffsetRef = useRef(new THREE.Vector3(...visualState.rimPosition));

  useEffect(() => {
    if (!moonRef.current || !moonTargetRef.current) return;
    moonRef.current.target = moonTargetRef.current;
    moonTargetRef.current.updateMatrixWorld();
  }, []);

  useEffect(() => {
    hasAnchoredMoonRef.current = false;
  }, [visualState.moonPosition]);

  useFrame((state, delta) => {
    const moon = moonRef.current;
    const moonTarget = moonTargetRef.current;
    const rim = rimRef.current;
    const lerp = 1 - Math.exp(-delta * 2.6);
    const pressurePulse = 1 + Math.sin(state.clock.elapsedTime * 0.42) * visualState.shadowStrength * 0.05;

    targetMoonColorRef.current.set(visualState.moonColor);
    targetRimColorRef.current.set(visualState.rimColor);
    moonColorRef.current.lerp(targetMoonColorRef.current, lerp);
    rimColorRef.current.lerp(targetRimColorRef.current, lerp);

    if (!hasAnchoredMoonRef.current) {
      anchorMoonOffsetToOpening(
        camera,
        visualState.moonPosition,
        18,
        targetMoonOffsetRef.current,
        moonRightRef.current,
        moonUpRef.current,
      );
      moonOffsetRef.current.copy(targetMoonOffsetRef.current);
      hasAnchoredMoonRef.current = true;
    }
    targetRimOffsetRef.current.fromArray(visualState.rimPosition);
    moonOffsetRef.current.lerp(targetMoonOffsetRef.current, lerp);
    rimOffsetRef.current.lerp(targetRimOffsetRef.current, lerp);

    if (moonTarget) {
      moonTarget.position.copy(camera.position);
      moonTarget.updateMatrixWorld();
    }

    if (moon) {
      moon.color.copy(moonColorRef.current);
      moon.intensity = THREE.MathUtils.lerp(
        moon.intensity,
        visualState.moonIntensity * pressurePulse * 0.52,
        lerp,
      );
      moon.position.copy(camera.position).add(moonOffsetRef.current);
      moon.updateMatrixWorld();
    }

    if (rim) {
      rim.color.copy(rimColorRef.current);
      rim.intensity = THREE.MathUtils.lerp(rim.intensity, visualState.rimIntensity, lerp);
      rim.position.copy(camera.position).add(rimOffsetRef.current);
      rim.updateMatrixWorld();
    }
  });

  const enableMoonShadow = qualityProfile.enableMoonShadows;
  const mapSize = qualityProfile.shadowMapSize;

  return (
    <>
      <object3D ref={moonTargetRef} />
      <ambientLight intensity={visualState.ambientIntensity * 0.42} color={visualState.moonColor} />
      <hemisphereLight args={[visualState.moonColor, visualState.palette.ground, visualState.hemisphereIntensity * 1.16]} />
      <directionalLight
        ref={moonRef}
        position={visualState.moonPosition}
        color={visualState.moonColor}
        intensity={visualState.moonIntensity}
        castShadow={enableMoonShadow}
        shadow-mapSize-width={mapSize}
        shadow-mapSize-height={mapSize}
        shadow-camera-near={0.5}
        shadow-camera-far={40}
        shadow-camera-left={-12}
        shadow-camera-right={12}
        shadow-camera-top={12}
        shadow-camera-bottom={-12}
        shadow-bias={-0.00085}
        shadow-normalBias={0.045}
      />
      <directionalLight ref={rimRef} position={visualState.rimPosition} color={visualState.rimColor} intensity={visualState.rimIntensity} />
    </>
  );
}

function guidedPathSegment(
  pathSegments: MazePathSegment[],
  activeEntryId: string,
  navigationTargetId: string | null,
) {
  if (navigationTargetId && navigationTargetId !== activeEntryId) {
    const queue = [activeEntryId];
    const visited = new Set(queue);
    const firstSegmentByEntry = new Map<string, MazePathSegment>();

    while (queue.length > 0) {
      const entryId = queue.shift();
      if (!entryId) break;
      for (const segment of pathSegments) {
        const sourceId = segment.sourceEntry.id;
        const targetId = segment.targetEntry.id;
        const nextId = sourceId === entryId ? targetId : targetId === entryId ? sourceId : null;
        if (!nextId || visited.has(nextId)) continue;
        visited.add(nextId);
        const firstSegment = firstSegmentByEntry.get(entryId) ?? segment;
        firstSegmentByEntry.set(nextId, firstSegment);
        if (nextId === navigationTargetId) return firstSegment;
        queue.push(nextId);
      }
    }
  }

  return (
    pathSegments.find(
      (candidate) =>
        candidate.sourceEntry.id === activeEntryId ||
        candidate.targetEntry.id === activeEntryId,
    ) ??
    pathSegments[0]
  );
}

function createLivingPathTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = 128;
  canvas.height = 256;
  const context = canvas.getContext("2d");
  if (!context) return new THREE.CanvasTexture(canvas);

  const edgeFade = context.createLinearGradient(0, 0, canvas.width, 0);
  edgeFade.addColorStop(0, "rgba(39, 55, 35, 0)");
  edgeFade.addColorStop(0.12, "rgba(43, 62, 39, 0.16)");
  edgeFade.addColorStop(0.27, "rgba(75, 72, 45, 0.3)");
  edgeFade.addColorStop(0.5, "rgba(145, 109, 61, 0.64)");
  edgeFade.addColorStop(0.73, "rgba(75, 72, 45, 0.3)");
  edgeFade.addColorStop(0.88, "rgba(43, 62, 39, 0.16)");
  edgeFade.addColorStop(1, "rgba(39, 55, 35, 0)");
  context.fillStyle = edgeFade;
  context.fillRect(0, 0, canvas.width, canvas.height);

  for (let index = 0; index < 72; index += 1) {
    const x = 10 + seededUnit(9281, index * 3 + 1) * 108;
    const y = seededUnit(9281, index * 3 + 2) * canvas.height;
    const radiusX = 0.7 + seededUnit(9281, index * 3 + 3) * 2.9;
    const radiusY = 1.1 + seededUnit(9281, index * 3 + 4) * 4.2;
    const light = seededUnit(9281, index * 3 + 5) > 0.56;
    context.beginPath();
    context.ellipse(x, y, radiusX, radiusY, seededUnit(9281, index + 149) * Math.PI, 0, Math.PI * 2);
    context.fillStyle = light
      ? "rgba(225, 190, 112, 0.34)"
      : "rgba(34, 48, 30, 0.42)";
    context.fill();
  }

  context.strokeStyle = "rgba(227, 193, 123, 0.12)";
  context.lineWidth = 6.5;
  context.beginPath();
  context.moveTo(64, 0);
  context.bezierCurveTo(55, 72, 72, 168, 61, canvas.height);
  context.stroke();
  context.strokeStyle = "rgba(36, 38, 25, 0.17)";
  context.lineWidth = 2.1;
  context.beginPath();
  context.moveTo(68, 0);
  context.bezierCurveTo(60, 78, 69, 178, 65, canvas.height);
  context.stroke();

  context.globalCompositeOperation = "destination-in";
  const endFade = context.createLinearGradient(0, 0, 0, canvas.height);
  endFade.addColorStop(0, "rgba(255,255,255,0.24)");
  endFade.addColorStop(0.12, "rgba(255,255,255,0.86)");
  endFade.addColorStop(0.88, "rgba(255,255,255,0.86)");
  endFade.addColorStop(1, "rgba(255,255,255,0.24)");
  context.fillStyle = endFade;
  context.fillRect(0, 0, canvas.width, canvas.height);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.ClampToEdgeWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(1, 3.4);
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.needsUpdate = true;
  return texture;
}

function LivingPathRibbon({
  pathSegments,
  activeEntry,
  navigationTargetId,
  narrativeWorldState,
  sampleGroundY,
}: {
  pathSegments: MazePathSegment[];
  activeEntry: Slipper3DEntry;
  navigationTargetId: string | null;
  narrativeWorldState: NarrativeWorldState;
  sampleGroundY: (x: number, z: number) => number;
}) {
  const texture = useMemo(
    () => (typeof document === "undefined" ? null : createLivingPathTexture()),
    [],
  );
  const geometry = useMemo(() => {
    const segment = guidedPathSegment(pathSegments, activeEntry.id, navigationTargetId);
    if (!segment) return null;

    const pointCount = 49;
    const positions = new Float32Array(pointCount * 2 * 3);
    const uvs = new Float32Array(pointCount * 2 * 2);
    const indices: number[] = [];
    const morph = {
      memoryPressure: narrativeWorldState.memoryPressure,
      explorationDepth: narrativeWorldState.explorationDepth,
    };
    const seed = hashString(`${segment.key}:living-path`);

    for (let index = 0; index < pointCount; index += 1) {
      const t = index / (pointCount - 1);
      const point = curvedPathPointAt(segment, t, morph);
      const tangent = curvedPathTangentAt(segment, t, morph);
      const normal = new THREE.Vector2(-tangent.y, tangent.x).normalize();
      const width = 0.84 + seededUnit(seed, index + 19) * 0.22;

      for (let sideIndex = 0; sideIndex < 2; sideIndex += 1) {
        const side = sideIndex === 0 ? -1 : 1;
        const x = point.x + normal.x * width * side;
        const z = point.y + normal.y * width * side;
        const vertexIndex = index * 2 + sideIndex;
        positions[vertexIndex * 3] = x;
        positions[vertexIndex * 3 + 1] = sampleGroundY(x, z) + 0.055;
        positions[vertexIndex * 3 + 2] = z;
        uvs[vertexIndex * 2] = sideIndex;
        uvs[vertexIndex * 2 + 1] = t;
      }

      if (index < pointCount - 1) {
        const left = index * 2;
        indices.push(left, left + 2, left + 1, left + 1, left + 2, left + 3);
      }
    }

    const nextGeometry = new THREE.BufferGeometry();
    nextGeometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    nextGeometry.setAttribute("uv", new THREE.BufferAttribute(uvs, 2));
    nextGeometry.setIndex(indices);
    nextGeometry.computeBoundingBox();
    nextGeometry.computeBoundingSphere();
    return nextGeometry;
  }, [activeEntry.id, narrativeWorldState.explorationDepth, narrativeWorldState.memoryPressure, navigationTargetId, pathSegments, sampleGroundY]);

  useEffect(() => () => geometry?.dispose(), [geometry]);
  useEffect(() => () => texture?.dispose(), [texture]);

  if (!geometry || !texture) return null;

  return (
    <mesh geometry={geometry} frustumCulled renderOrder={4}>
      <meshBasicMaterial
        map={texture}
        color="#d2b078"
        transparent
        opacity={0.58}
        depthWrite={false}
        side={THREE.DoubleSide}
        polygonOffset
        polygonOffsetFactor={-2}
        toneMapped={false}
      />
    </mesh>
  );
}

function createPathUnderstoryGeometry() {
  const positions: number[] = [];
  const colors: number[] = [];
  const palette = {
    stem: new THREE.Color("#344437"),
    frond: new THREE.Color("#506a55"),
    frondLight: new THREE.Color("#718866"),
    moss: new THREE.Color("#324631"),
    stone: new THREE.Color("#5f6559"),
  };
  const pushTriangle = (
    a: [number, number, number],
    b: [number, number, number],
    c: [number, number, number],
    color: THREE.Color,
  ) => {
    positions.push(...a, ...b, ...c);
    for (let vertex = 0; vertex < 3; vertex += 1) {
      colors.push(color.r, color.g, color.b);
    }
  };

  const pointOnFrond = (
    angle: number,
    length: number,
    progress: number,
    lift: number,
  ): [number, number, number] => [
    Math.cos(angle) * length * progress,
    0.025 + Math.sin(progress * Math.PI * 0.62) * lift,
    Math.sin(angle) * length * progress,
  ];

  // Each instance is a complete radial fern clump, so the plant reads as
  // broad forest-floor foliage from every camera angle instead of a flat,
  // conifer-like card. The geometry stays in one instanced draw call.
  for (let frondIndex = 0; frondIndex < 6; frondIndex += 1) {
    const angle = frondIndex * 1.047 + (frondIndex % 2 === 0 ? 0.08 : -0.12);
    const length = 0.72 + (frondIndex % 3) * 0.13;
    const lift = 0.31 + (frondIndex % 2) * 0.11;
    const sideX = -Math.sin(angle);
    const sideZ = Math.cos(angle);

    for (let segment = 0; segment < 7; segment += 1) {
      const startProgress = segment / 7;
      const endProgress = (segment + 1) / 7;
      const start = pointOnFrond(angle, length, startProgress, lift);
      const end = pointOnFrond(angle, length, endProgress, lift);
      const stemWidth = 0.012 - segment * 0.0013;
      const startLeft: [number, number, number] = [
        start[0] + sideX * stemWidth,
        start[1],
        start[2] + sideZ * stemWidth,
      ];
      const startRight: [number, number, number] = [
        start[0] - sideX * stemWidth,
        start[1],
        start[2] - sideZ * stemWidth,
      ];
      const endLeft: [number, number, number] = [
        end[0] + sideX * stemWidth * 0.72,
        end[1],
        end[2] + sideZ * stemWidth * 0.72,
      ];
      const endRight: [number, number, number] = [
        end[0] - sideX * stemWidth * 0.72,
        end[1],
        end[2] - sideZ * stemWidth * 0.72,
      ];
      pushTriangle(startLeft, startRight, endLeft, palette.stem);
      pushTriangle(startRight, endRight, endLeft, palette.stem);

      if (segment === 0 || segment === 6) continue;
      const leafLength = (0.15 - segment * 0.012) * (0.94 + (frondIndex % 2) * 0.1);
      const forward = 0.032 + segment * 0.004;
      const leafColor = (segment + frondIndex) % 3 === 0
        ? palette.frondLight
        : palette.frond;
      const leftTip: [number, number, number] = [
        start[0] + sideX * leafLength + Math.cos(angle) * forward,
        start[1] + 0.014,
        start[2] + sideZ * leafLength + Math.sin(angle) * forward,
      ];
      const rightTip: [number, number, number] = [
        start[0] - sideX * leafLength + Math.cos(angle) * forward,
        start[1] + 0.01,
        start[2] - sideZ * leafLength + Math.sin(angle) * forward,
      ];
      pushTriangle(start, leftTip, end, leafColor);
      pushTriangle(start, end, rightTip, leafColor);
    }

    const shoulder = pointOnFrond(angle, length, 0.82, lift);
    const tip = pointOnFrond(angle, length, 1.03, lift);
    const tipWidth = 0.065;
    pushTriangle(
      shoulder,
      [
        shoulder[0] + sideX * tipWidth,
        shoulder[1] + 0.012,
        shoulder[2] + sideZ * tipWidth,
      ],
      tip,
      palette.frondLight,
    );
    pushTriangle(
      shoulder,
      tip,
      [
        shoulder[0] - sideX * tipWidth,
        shoulder[1] + 0.01,
        shoulder[2] - sideZ * tipWidth,
      ],
      palette.frondLight,
    );
  }

  for (let segment = 0; segment < 10; segment += 1) {
    const angleA = (segment / 10) * Math.PI * 2;
    const angleB = ((segment + 1) / 10) * Math.PI * 2;
    const radiusA = 0.27 + Math.sin(segment * 2.7) * 0.035;
    const radiusB = 0.27 + Math.sin((segment + 1) * 2.7) * 0.035;
    pushTriangle(
      [Math.cos(angleA) * radiusA, 0.012, Math.sin(angleA) * radiusA],
      [Math.cos(angleB) * radiusB, 0.012, Math.sin(angleB) * radiusB],
      [0.025, 0.115, -0.018],
      palette.moss,
    );
  }

  const addStone = (x: number, z: number, radius: number, height: number) => {
    const top: [number, number, number] = [x + radius * 0.08, height, z - radius * 0.06];
    const corners: Array<[number, number, number]> = [
      [x - radius, 0.018, z - radius * 0.56],
      [x + radius * 0.72, 0.018, z - radius * 0.72],
      [x + radius, 0.018, z + radius * 0.42],
      [x - radius * 0.68, 0.018, z + radius * 0.76],
    ];
    for (let index = 0; index < corners.length; index += 1) {
      pushTriangle(
        corners[index],
        corners[(index + 1) % corners.length],
        top,
        palette.stone,
      );
    }
  };
  addStone(0.31, -0.08, 0.15, 0.14);
  addStone(-0.22, 0.21, 0.11, 0.105);

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute(
    "position",
    new THREE.Float32BufferAttribute(positions, 3),
  );
  geometry.setAttribute(
    "color",
    new THREE.Float32BufferAttribute(colors, 3),
  );
  geometry.computeVertexNormals();
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  return geometry;
}

function MoonlitPathUnderstory({
  pathSegments,
  activeEntry,
  navigationTargetId,
  narrativeWorldState,
  qualityProfile,
  sampleGroundY,
}: {
  pathSegments: MazePathSegment[];
  activeEntry: Slipper3DEntry;
  navigationTargetId: string | null;
  narrativeWorldState: NarrativeWorldState;
  qualityProfile: RenderQualityProfile;
  sampleGroundY: (x: number, z: number) => number;
}) {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const geometry = useMemo(() => createPathUnderstoryGeometry(), []);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const instanceColor = useMemo(() => new THREE.Color(), []);
  const visualState = useMemo(
    () => resolveWorldVisualState({ entry: activeEntry, narrativeWorldState }),
    [activeEntry, narrativeWorldState],
  );
  const instances = useMemo(() => {
    const segment = guidedPathSegment(
      pathSegments,
      activeEntry.id,
      navigationTargetId,
    );
    if (!segment) return [];

    const count =
      qualityProfile.quality === "low"
        ? 8
        : qualityProfile.quality === "medium"
          ? 16
          : qualityProfile.quality === "high"
            ? 24
            : 28;
    const seed = hashString(`${segment.key}:moonlit-understory`);
    const morph = {
      memoryPressure: narrativeWorldState.memoryPressure,
      explorationDepth: narrativeWorldState.explorationDepth,
    };

    return Array.from({ length: count }, (_, index) => {
      const progress = (index + 0.7) / (count + 0.4);
      const t = THREE.MathUtils.clamp(
        progress + (seededUnit(seed, index + 7) - 0.5) * 0.032,
        0.025,
        0.975,
      );
      const point = curvedPathPointAt(segment, t, morph);
      const tangent = curvedPathTangentAt(segment, t, morph);
      const normal = new THREE.Vector2(-tangent.y, tangent.x).normalize();
      const side = index % 2 === 0 ? -1 : 1;
      const offset = 2.25 + seededUnit(seed, index + 31) * 1.85;
      const scale = 0.62 + seededUnit(seed, index + 53) * 0.44;
      const x = point.x + normal.x * offset * side;
      const z = point.y + normal.y * offset * side;

      return {
        x,
        y: sampleGroundY(x, z) + 0.018,
        z,
        yaw:
          Math.atan2(tangent.x, tangent.y) +
          (seededUnit(seed, index + 79) - 0.5) * 1.18,
        scale,
        spread: 0.9 + seededUnit(seed, index + 89) * 0.28,
        warmth: seededUnit(seed, index + 97),
        tiltX: (seededUnit(seed, index + 113) - 0.5) * 0.1,
        tiltZ: (seededUnit(seed, index + 127) - 0.5) * 0.1,
      };
    });
  }, [
    activeEntry.id,
    narrativeWorldState.explorationDepth,
    narrativeWorldState.memoryPressure,
    navigationTargetId,
    pathSegments,
    qualityProfile.quality,
    sampleGroundY,
  ]);

  useLayoutEffect(() => {
    const mesh = meshRef.current;
    if (!mesh) return;
    const highlightColor = new THREE.Color("#b0bd9f");

    for (let index = 0; index < instances.length; index += 1) {
      const fern = instances[index];
      dummy.position.set(fern.x, fern.y, fern.z);
      dummy.rotation.set(fern.tiltX, fern.yaw, fern.tiltZ);
      dummy.scale.set(
        fern.scale * fern.spread,
        fern.scale * (0.88 + fern.warmth * 0.16),
        fern.scale * (1.08 - (fern.spread - 0.86) * 0.24),
      );
      dummy.updateMatrix();
      mesh.setMatrixAt(index, dummy.matrix);
      instanceColor
        .set(visualState.palette.leaf)
        .lerp(highlightColor, 0.4 + fern.warmth * 0.12);
      mesh.setColorAt(index, instanceColor);
    }

    mesh.count = instances.length;
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    mesh.computeBoundingBox();
    mesh.computeBoundingSphere();
  }, [dummy, instanceColor, instances, visualState.palette.leaf]);

  useEffect(() => () => geometry.dispose(), [geometry]);

  if (instances.length === 0) return null;

  return (
    <instancedMesh
      ref={meshRef}
      args={[geometry, undefined, instances.length]}
      frustumCulled
      receiveShadow
      renderOrder={2}
    >
      <meshStandardMaterial
        vertexColors
        color="#b9c3ad"
        emissive={visualState.palette.leaf}
        emissiveIntensity={0.08}
        roughness={0.9}
        metalness={0.01}
        side={THREE.DoubleSide}
      />
    </instancedMesh>
  );
}

function createSoftMistTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 128;
  const context = canvas.getContext("2d");
  if (!context) return new THREE.CanvasTexture(canvas);

  const haze = context.createRadialGradient(128, 64, 6, 128, 64, 124);
  haze.addColorStop(0, "rgba(225, 238, 250, 0.72)");
  haze.addColorStop(0.38, "rgba(196, 216, 235, 0.34)");
  haze.addColorStop(0.74, "rgba(150, 179, 207, 0.11)");
  haze.addColorStop(1, "rgba(120, 150, 178, 0)");
  context.fillStyle = haze;
  context.fillRect(0, 0, canvas.width, canvas.height);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.needsUpdate = true;
  return texture;
}

function createMoonShaftTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = 128;
  canvas.height = 512;
  const context = canvas.getContext("2d");
  if (!context) return new THREE.CanvasTexture(canvas);

  const vertical = context.createLinearGradient(0, 0, 0, canvas.height);
  vertical.addColorStop(0, "rgba(228, 241, 255, 0)");
  vertical.addColorStop(0.12, "rgba(220, 237, 255, 0.72)");
  vertical.addColorStop(0.68, "rgba(177, 207, 236, 0.22)");
  vertical.addColorStop(1, "rgba(152, 187, 218, 0)");
  context.fillStyle = vertical;
  context.fillRect(0, 0, canvas.width, canvas.height);

  context.globalCompositeOperation = "destination-in";
  const horizontal = context.createLinearGradient(0, 0, canvas.width, 0);
  horizontal.addColorStop(0, "rgba(255, 255, 255, 0)");
  horizontal.addColorStop(0.42, "rgba(255, 255, 255, 0.74)");
  horizontal.addColorStop(0.5, "rgba(255, 255, 255, 1)");
  horizontal.addColorStop(0.58, "rgba(255, 255, 255, 0.74)");
  horizontal.addColorStop(1, "rgba(255, 255, 255, 0)");
  context.fillStyle = horizontal;
  context.fillRect(0, 0, canvas.width, canvas.height);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.needsUpdate = true;
  return texture;
}

type LivingMistPatch = {
  position: Vector3Tuple;
  rotation: number;
  scale: [number, number, number];
};

function LivingPathMist({
  pathSegments,
  activeEntry,
  navigationTargetId,
  narrativeWorldState,
  qualityProfile,
  sampleGroundY,
}: {
  pathSegments: MazePathSegment[];
  activeEntry: Slipper3DEntry;
  navigationTargetId: string | null;
  narrativeWorldState: NarrativeWorldState;
  qualityProfile: RenderQualityProfile;
  sampleGroundY: (x: number, z: number) => number;
}) {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const materialRef = useRef<THREE.MeshBasicMaterial>(null);
  const dummyRef = useRef(new THREE.Object3D());
  const reducedMotion = useSettingsStore((state) => state.reducedMotion);
  const texture = useMemo(
    () => (typeof document === "undefined" ? null : createSoftMistTexture()),
    [],
  );
  const patchCount = qualityProfile.weatherLayerMultiplier < 0.25
    ? 0
    : qualityProfile.quality === "medium"
      ? 2
      : 3;
  const patches = useMemo<LivingMistPatch[]>(() => {
    const segment = guidedPathSegment(pathSegments, activeEntry.id, navigationTargetId);
    if (!segment || patchCount === 0) return [];

    const reverse = navigationTargetId
      ? segment.sourceEntry.id === navigationTargetId
      : segment.targetEntry.id === activeEntry.id;
    const morph = {
      memoryPressure: narrativeWorldState.memoryPressure,
      explorationDepth: narrativeWorldState.explorationDepth,
    };
    const seed = hashString(`${segment.key}:living-mist`);
    const generated: LivingMistPatch[] = [];

    for (let index = 0; index < patchCount; index += 1) {
      const progress = 0.18 + (index / Math.max(1, patchCount - 1)) * 0.48;
      const t = reverse ? 1 - progress : progress;
      const point = curvedPathPointAt(segment, t, morph);
      const tangent = curvedPathTangentAt(segment, t, morph);
      const lateral = (seededUnit(seed, index + 31) - 0.5) * 3.1;
      const normal = new THREE.Vector2(-tangent.y, tangent.x);
      const x = point.x + normal.x * lateral;
      const z = point.y + normal.y * lateral;
      generated.push({
        position: [x, sampleGroundY(x, z) + 0.13 + index * 0.015, z],
        rotation: Math.atan2(tangent.y, tangent.x),
        scale: [3.15 + seededUnit(seed, index + 67) * 1.35, 1.3 + seededUnit(seed, index + 83) * 0.7, 1],
      });
    }

    return generated;
  }, [activeEntry.id, narrativeWorldState.explorationDepth, narrativeWorldState.memoryPressure, navigationTargetId, patchCount, pathSegments, sampleGroundY]);

  useLayoutEffect(() => {
    const mesh = meshRef.current;
    if (!mesh) return;
    const dummy = dummyRef.current;
    for (let index = 0; index < patches.length; index += 1) {
      const patch = patches[index];
      dummy.position.set(...patch.position);
      dummy.rotation.set(-Math.PI / 2, 0, patch.rotation);
      dummy.scale.set(...patch.scale);
      dummy.updateMatrix();
      mesh.setMatrixAt(index, dummy.matrix);
    }
    mesh.count = patches.length;
    mesh.instanceMatrix.needsUpdate = true;
    mesh.computeBoundingBox();
    mesh.computeBoundingSphere();
  }, [patches]);

  useFrame(({ clock }) => {
    if (!materialRef.current) return;
    const breath = reducedMotion ? 1 : 0.9 + Math.sin(clock.elapsedTime * 0.22) * 0.1;
    materialRef.current.opacity = (0.028 + narrativeWorldState.memoryPressure * 0.012) * qualityProfile.weatherLayerMultiplier * breath;
  });

  useEffect(() => () => texture?.dispose(), [texture]);

  if (!texture || patches.length === 0) return null;

  return (
    <instancedMesh ref={meshRef} args={[undefined, undefined, patches.length]} frustumCulled renderOrder={3}>
      <planeGeometry args={[1, 1, 1, 1]} />
      <meshBasicMaterial ref={materialRef} map={texture} color="#a8c3d9" transparent opacity={0.025} depthWrite={false} side={THREE.DoubleSide} blending={THREE.AdditiveBlending} toneMapped={false} />
    </instancedMesh>
  );
}

function MemoryBloomLandmark({
  pathSegments,
  activeEntry,
  navigationTargetId,
  narrativeWorldState,
  qualityProfile,
  sampleGroundY,
}: {
  pathSegments: MazePathSegment[];
  activeEntry: Slipper3DEntry;
  navigationTargetId: string | null;
  narrativeWorldState: NarrativeWorldState;
  qualityProfile: RenderQualityProfile;
  sampleGroundY: (x: number, z: number) => number;
}) {
  const texture = useTexture(MEMORY_BLOOM_TEXTURE_PATH);
  const shaftTexture = useMemo(
    () => (typeof document === "undefined" ? null : createMoonShaftTexture()),
    [],
  );
  const groupRef = useRef<THREE.Group>(null);
  const bloomMaterialRef = useRef<THREE.SpriteMaterial>(null);
  const glowMaterialRef = useRef<THREE.SpriteMaterial>(null);
  const shaftMaterialRef = useRef<THREE.SpriteMaterial>(null);
  const reducedMotion = useSettingsStore((state) => state.reducedMotion);
  const pose = useMemo(() => {
    const segment = guidedPathSegment(pathSegments, activeEntry.id, navigationTargetId);
    if (!segment) return null;
    const reverse = navigationTargetId
      ? segment.sourceEntry.id === navigationTargetId
      : segment.targetEntry.id === activeEntry.id;
    const morph = {
      memoryPressure: narrativeWorldState.memoryPressure,
      explorationDepth: narrativeWorldState.explorationDepth,
    };
    // Keep the bloom beyond the opening foreground so it reads as a quiet
    // destination marker instead of occluding the route at portrait viewports.
    const t = reverse ? 0.56 : 0.44;
    const point = curvedPathPointAt(segment, t, morph);
    const tangent = curvedPathTangentAt(segment, t, morph);
    const normal = new THREE.Vector2(-tangent.y, tangent.x);
    const side = seededUnit(hashString(`${segment.key}:memory-bloom`), 17) > 0.5 ? 1 : -1;
    const x = point.x + normal.x * side * 1.08;
    const z = point.y + normal.y * side * 1.08;
    return {
      position: [x, sampleGroundY(x, z) + 1.42, z] as Vector3Tuple,
      groundOffset: -1.41,
    };
  }, [activeEntry.id, narrativeWorldState.explorationDepth, narrativeWorldState.memoryPressure, navigationTargetId, pathSegments, sampleGroundY]);

  useEffect(() => {
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.wrapS = THREE.ClampToEdgeWrapping;
    texture.wrapT = THREE.ClampToEdgeWrapping;
    texture.minFilter = THREE.LinearMipmapLinearFilter;
    texture.magFilter = THREE.LinearFilter;
    texture.needsUpdate = true;
  }, [texture]);

  useEffect(() => () => shaftTexture?.dispose(), [shaftTexture]);

  useFrame(({ clock }) => {
    const group = groupRef.current;
    if (!group || !pose) return;
    const pulse = reducedMotion ? 1 : 1 + Math.sin(clock.elapsedTime * 0.62) * 0.025;
    group.scale.setScalar(pulse);
    group.position.y = pose.position[1] + (reducedMotion ? 0 : Math.sin(clock.elapsedTime * 0.4) * 0.012);
    if (bloomMaterialRef.current) {
      bloomMaterialRef.current.opacity = 0.82 + Math.sin(clock.elapsedTime * 0.48) * (reducedMotion ? 0 : 0.06);
    }
    if (glowMaterialRef.current) {
      glowMaterialRef.current.opacity = qualityProfile.enableBloomProxies
        ? 0.075 + Math.sin(clock.elapsedTime * 0.38) * (reducedMotion ? 0 : 0.018)
        : 0;
    }
    if (shaftMaterialRef.current) {
      shaftMaterialRef.current.opacity = qualityProfile.enableBloomProxies
        ? 0.065 + narrativeWorldState.explorationDepth * 0.018
        : 0;
    }
  });

  if (!pose) return null;

  return (
    <group ref={groupRef} position={pose.position} renderOrder={18}>
      {shaftTexture && qualityProfile.enableBloomProxies ? (
        <sprite position={[0, 3.35, -0.14]} scale={[2.9, 8.4, 1]}>
          <spriteMaterial ref={shaftMaterialRef} map={shaftTexture} color="#9dbddd" transparent opacity={0.04} depthWrite={false} blending={THREE.AdditiveBlending} toneMapped={false} />
        </sprite>
      ) : null}
      <sprite scale={[1.48, 2.22, 1]}>
        <spriteMaterial ref={bloomMaterialRef} map={texture} color="#f1ddb0" transparent opacity={0.86} alphaTest={0.035} depthWrite={false} toneMapped={false} />
      </sprite>
      {qualityProfile.enableBloomProxies ? (
        <sprite position={[0, 0, -0.03]} scale={[1.72, 2.58, 1]}>
          <spriteMaterial ref={glowMaterialRef} map={texture} color="#f3c96e" transparent opacity={0.08} alphaTest={0.012} depthWrite={false} blending={THREE.AdditiveBlending} toneMapped={false} />
        </sprite>
      ) : null}
      <mesh position={[0, pose.groundOffset, 0]} rotation={[-Math.PI / 2, 0, 0]} renderOrder={17}>
        <circleGeometry args={[0.7, 32]} />
        <meshBasicMaterial color="#dfc06d" transparent opacity={0.045} side={THREE.DoubleSide} depthWrite={false} blending={THREE.AdditiveBlending} toneMapped={false} />
      </mesh>
    </group>
  );
}

type PathLightMote = {
  position: Vector3Tuple;
  scale: number;
};

function PathLightMotes({
  pathSegments,
  activeEntry,
  navigationTargetId,
  visualState,
  narrativeWorldState,
  qualityProfile,
  sampleGroundY,
}: {
  pathSegments: MazePathSegment[];
  activeEntry: Slipper3DEntry;
  navigationTargetId: string | null;
  visualState: WorldVisualState;
  narrativeWorldState: NarrativeWorldState;
  qualityProfile: RenderQualityProfile;
  sampleGroundY: (x: number, z: number) => number;
}) {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const haloRef = useRef<THREE.InstancedMesh>(null);
  const materialRef = useRef<THREE.MeshBasicMaterial>(null);
  const haloMaterialRef = useRef<THREE.MeshBasicMaterial>(null);
  const transformRef = useRef(new THREE.Object3D());

  const motes = useMemo<PathLightMote[]>(() => {
    const activeId = activeEntry.id;
    const targetId = navigationTargetId;
    const segment = guidedPathSegment(pathSegments, activeId, targetId);

    if (!segment) return [];
    const count = Math.max(10, Math.round(qualityProfile.pathLightMoteCount * visualState.pathGlowIntensity * 0.62));
    const reverse = targetId ? segment.sourceEntry.id === targetId : segment.targetEntry.id === activeId;
    const morph = {
      memoryPressure: narrativeWorldState.memoryPressure,
      explorationDepth: narrativeWorldState.explorationDepth,
    };
    const seed = hashString(segment.key + ':' + (targetId ?? activeId));
    const generated: PathLightMote[] = [];

    for (let index = 0; index < count; index += 1) {
      const progress = count <= 1 ? 0 : index / (count - 1);
      const t = reverse ? 1 - progress : progress;
      const point = curvedPathPointAt(segment, t, morph);
      const side = seededUnit(seed, index * 3 + 1) * 2 - 1;
      const lift = 0.18 + seededUnit(seed, index * 3 + 2) * 0.34;
      const tangent = curvedPathTangentAt(segment, t, morph);
      const normal = new THREE.Vector2(-tangent.y, tangent.x);
      const x = point.x + normal.x * side * 0.62;
      const z = point.y + normal.y * side * 0.62;
      generated.push({
        position: [x, sampleGroundY(x, z) + lift, z],
        scale: 0.032 + seededUnit(seed, index * 3 + 3) * 0.027,
      });
    }
    return generated;
  }, [activeEntry.id, navigationTargetId, narrativeWorldState.explorationDepth, narrativeWorldState.memoryPressure, pathSegments, qualityProfile.pathLightMoteCount, sampleGroundY, visualState.pathGlowIntensity]);

  useEffect(() => {
    const mesh = meshRef.current;
    const halo = haloRef.current;
    if (!mesh || !halo) return;
    const transform = transformRef.current;
    for (let index = 0; index < motes.length; index += 1) {
      const mote = motes[index];
      transform.position.set(...mote.position);
      transform.scale.setScalar(mote.scale);
      transform.updateMatrix();
      mesh.setMatrixAt(index, transform.matrix);
      transform.scale.setScalar(mote.scale * 2.9);
      transform.updateMatrix();
      halo.setMatrixAt(index, transform.matrix);
    }
    for (const target of [mesh, halo]) {
      target.count = motes.length;
      target.instanceMatrix.needsUpdate = true;
      target.computeBoundingBox();
      target.computeBoundingSphere();
    }
  }, [motes]);

  useFrame((state) => {
    const material = materialRef.current;
    if (!material) return;
    const pressure = clamp01(narrativeWorldState.memoryPressure);
    const pulse = 0.78 + Math.sin(state.clock.elapsedTime * (0.65 + pressure * 0.9)) * 0.16;
    material.opacity = THREE.MathUtils.clamp((0.22 + visualState.pathGlowIntensity * 0.36) * pulse, 0.12, 0.82);
    if (haloMaterialRef.current) {
      haloMaterialRef.current.opacity = THREE.MathUtils.clamp((0.025 + visualState.pathGlowIntensity * 0.05) * pulse, 0.018, 0.12);
    }
  });

  if (motes.length === 0) return null;

  return (
    <group>
      <instancedMesh ref={haloRef} args={[undefined as unknown as THREE.BufferGeometry, undefined as unknown as THREE.Material, motes.length]} frustumCulled renderOrder={21}>
        <sphereGeometry args={[1, 5, 5]} />
        <meshBasicMaterial ref={haloMaterialRef} color="#f2c86b" transparent opacity={0.06} depthWrite={false} blending={THREE.AdditiveBlending} toneMapped={false} />
      </instancedMesh>
      <instancedMesh ref={meshRef} args={[undefined as unknown as THREE.BufferGeometry, undefined as unknown as THREE.Material, motes.length]} frustumCulled renderOrder={22}>
        <sphereGeometry args={[1, 6, 6]} />
        <meshBasicMaterial ref={materialRef} color="#ffe3a1" transparent opacity={0.52} depthWrite={false} toneMapped={false} />
      </instancedMesh>
    </group>
  );
}

function ClearingLightHalo({
  nodes,
  navigationTargetId,
  approachingEntryId,
  visualState,
  narrativeWorldState,
  qualityProfile,
}: {
  nodes: SpatialStoryNode[];
  navigationTargetId: string | null;
  approachingEntryId: string | null;
  visualState: WorldVisualState;
  narrativeWorldState: NarrativeWorldState;
  qualityProfile: RenderQualityProfile;
}) {
  const haloNodes = useMemo(() => {
    const ranked = nodes
      .filter((node) => node.isActive || node.entry.id === navigationTargetId || node.entry.id === approachingEntryId)
      .sort((a, b) => {
        const rank = (node: SpatialStoryNode) => (node.isActive ? -3 : node.entry.id === navigationTargetId ? -2 : node.entry.id === approachingEntryId ? -1 : 0);
        return rank(a) - rank(b);
      });
    return ranked.slice(0, qualityProfile.clearingGlowResolution === "low" ? 2 : 3);
  }, [approachingEntryId, navigationTargetId, nodes, qualityProfile.clearingGlowResolution]);

  if (haloNodes.length === 0) return null;

    const haloOpacity = THREE.MathUtils.clamp(0.04 + visualState.clearingGlowIntensity * 0.07 + narrativeWorldState.symbolicWeight * 0.015, 0.04, 0.16);
  const showHeroLight = qualityProfile.clearingGlowResolution === "high";

  return (
    <group>
      {haloNodes.map((node) => {
        const isTarget = node.entry.id === navigationTargetId;
        const isActive = node.isActive;
        const radius = isActive ? 5.2 : isTarget ? 4.4 : 3.8;
        const opacity = haloOpacity * (isActive ? 1.18 : isTarget ? 1 : 0.72);
        const y = node.position[1] - 1.13;
        return (
          <group key={'light-halo-' + node.entry.id} position={[node.position[0], y, node.position[2]]}>
            {showHeroLight && (isActive || isTarget) ? (
              <pointLight
                color={visualState.palette.portal}
                intensity={visualState.clearingGlowIntensity * (isActive ? 0.44 : 0.3)}
                distance={14}
                decay={2.1}
                position={[0, 1.7, 0]}
                castShadow={false}
              />
            ) : null}
            <mesh rotation={[Math.PI / 2, 0, 0]} renderOrder={18}>
              <circleGeometry args={[radius, qualityProfile.clearingGlowResolution === "low" ? 36 : 72]} />
              <meshBasicMaterial color={visualState.palette.portal} transparent opacity={opacity * 0.24} depthWrite={false} side={THREE.DoubleSide} toneMapped={false} />
            </mesh>
            <mesh rotation={[Math.PI / 2, 0, 0]} renderOrder={19}>
              <ringGeometry args={[radius * 0.68, radius, qualityProfile.clearingGlowResolution === "low" ? 40 : 88]} />
              <meshBasicMaterial color={visualState.palette.particle} transparent opacity={opacity * 0.62} depthWrite={false} side={THREE.DoubleSide} toneMapped={false} />
            </mesh>
          </group>
        );
      })}
    </group>
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

function NodeProximityActivator({
  nodes,
  pathSegments,
  visitedEntryIds,
  lockedEntryIds,
  explicitNavigationTargetId,
  controls,
  mode,
  onNodeEnter,
  onApproachChange,
  onPlayerProximityChange,
  onPlayerSpatialChange,
}: {
  nodes: SpatialStoryNode[];
  pathSegments: MazePathSegment[];
  visitedEntryIds: string[];
  lockedEntryIds: readonly string[];
  explicitNavigationTargetId?: string | null;
  controls: StorySceneControls;
  mode: StorySceneMode;
  onNodeEnter?: (targetEntryId: string) => void;
  onApproachChange?: (targetEntryId: string | null) => void;
  onPlayerProximityChange?: (state: SceneProximityState) => void;
  onPlayerSpatialChange?: (state: PlayerSpatialWindow) => void;
}) {
  const { camera } = useThree();
  const lastApproachRef = useRef<string | null>(null);
  const lastUiSignatureRef = useRef<string>("");
  const lastSpatialSignatureRef = useRef<string>("");
  const lastUpdateTimeRef = useRef(Number.NEGATIVE_INFINITY);
  const lastSpatialCalcTimeRef = useRef(Number.NEGATIVE_INFINITY);
  const lastEnteredNodeRef = useRef<string | null>(null);
  const cameraDirectionRef = useRef(new THREE.Vector3());
  const lockedEntryIdSet = useMemo(() => new Set(lockedEntryIds), [lockedEntryIds]);
  const availableNavigationNodes = useMemo(
    () => nodes.filter((node) => !lockedEntryIdSet.has(node.entry.id)),
    [lockedEntryIdSet, nodes],
  );
  const explicitNavigationTargetNode = useMemo(
    () =>
      explicitNavigationTargetId && !lockedEntryIdSet.has(explicitNavigationTargetId)
        ? nodes.find((node) => node.entry.id === explicitNavigationTargetId)
        : undefined,
    [explicitNavigationTargetId, lockedEntryIdSet, nodes],
  );

  useEffect(() => {
    lastApproachRef.current = null;
    lastSpatialSignatureRef.current = "";
    onApproachChange?.(null);
  }, [nodes, onApproachChange]);

  useFrame((state) => {
    if (mode !== "explore" || controls !== "walk" || nodes.length === 0) return;
    if (state.clock.elapsedTime - lastSpatialCalcTimeRef.current < 0.08) return;
    lastSpatialCalcTimeRef.current = state.clock.elapsedTime;

    let closestNode: SpatialStoryNode | undefined;
    let closestDistanceSq = Number.POSITIVE_INFINITY;
    let closestInactiveNode: SpatialStoryNode | undefined;
    let closestInactiveDistanceSq = Number.POSITIVE_INFINITY;
    const activeNode = nodes.find((node) => node.isActive);

    for (const node of nodes) {
      const dx = camera.position.x - node.position[0];
      const dz = camera.position.z - node.position[2];
      const distanceSq = dx * dx + dz * dz;
      if (distanceSq < closestDistanceSq) {
        closestDistanceSq = distanceSq;
        closestNode = node;
      }
      if (!node.isActive && distanceSq < closestInactiveDistanceSq) {
        closestInactiveDistanceSq = distanceSq;
        closestInactiveNode = node;
      }
    }

    const closestDistance = closestNode ? Math.sqrt(closestDistanceSq) : Number.POSITIVE_INFINITY;
    const playerPosition: Vector3Tuple = [camera.position.x, camera.position.y, camera.position.z];
    camera.getWorldDirection(cameraDirectionRef.current);
    const cameraYaw = yawFromDirection(cameraDirectionRef.current.x, cameraDirectionRef.current.z);
    const insideClearing = closestDistance <= CLEARING_SAFE_RADIUS;
    const pathStatus = nearestPathStatus({ playerPosition, pathSegments, insideClearing });
    const automaticNavigationTarget = explicitNavigationTargetNode
      ? null
      : resolveNavigationTarget({
          nodes: availableNavigationNodes,
          activeEntryId: activeNode?.entry.id ?? "",
          visitedEntryIds,
          playerPosition,
          cameraYaw,
        });
    const navigationTargetNode =
      explicitNavigationTargetNode ??
      (automaticNavigationTarget
        ? nodes.find(
            (node) => node.entry.id === automaticNavigationTarget.entryId,
          )
        : undefined);
    const navigationTargetDistance = explicitNavigationTargetNode
      ? Math.hypot(
          explicitNavigationTargetNode.position[0] - playerPosition[0],
          explicitNavigationTargetNode.position[2] - playerPosition[2],
        )
      : (automaticNavigationTarget?.distance ?? 999);
    const navigationTargetId =
      explicitNavigationTargetNode?.entry.id ??
      automaticNavigationTarget?.entryId ??
      null;
    const navigationTargetTitle =
      explicitNavigationTargetNode?.entry.title ??
      automaticNavigationTarget?.title ??
      null;
    const navigationTargetPosition =
      explicitNavigationTargetNode?.position ??
      automaticNavigationTarget?.position ??
      null;
    const navigationTargetReason = explicitNavigationTargetNode
      ? explicitNavigationTargetNode.isVisited
        ? ("return" as const)
        : ("unvisited" as const)
      : (automaticNavigationTarget?.reason ?? null);
    const approachingNode = navigationTargetNode ?? closestInactiveNode;
    const approachingDistance = navigationTargetNode
      ? navigationTargetDistance
      : closestInactiveNode
        ? Math.sqrt(closestInactiveDistanceSq)
        : 999;
    const basePresence = closestNode ? clamp01(1 - Math.max(0, closestDistance - NODE_ACTIVATION_RADIUS) / NODE_APPROACH_RADIUS) : 0;
    const trailPresence = pathStatus.state === "lost" ? 0.86 : pathStatus.state === "edge-of-trail" ? 0.62 : 0.22;
    const uiPresence = insideClearing ? 1 : Math.max(basePresence, trailPresence);
    const proximityState: SceneProximityState = {
      activeEntryId: activeNode?.entry.id ?? "",
      nearestEntryId: closestNode?.entry.id ?? null,
      nearestTitle: closestNode?.entry.title ?? null,
      distance: closestNode ? closestDistance : 999,
      uiPresence,
      insideClearing,
      playerPosition,
      activeWorldPosition: activeNode?.position ?? null,
      nearestWorldPosition: closestNode?.position ?? null,
      approachingEntryId: approachingNode?.entry.id ?? null,
      approachingTitle: approachingNode?.entry.title ?? null,
      approachingDistance,
      approachingWorldPosition: approachingNode?.position ?? null,
      cameraYaw,
      navigationTargetId,
      navigationTargetTitle,
      navigationTargetWorldPosition: navigationTargetPosition,
      navigationTargetDistance,
      navigationTargetReason,
      nearestPathDistance: pathStatus.distance,
      trailState: pathStatus.state,
    };
    const signature = `${proximityState.nearestEntryId}:${proximityState.navigationTargetId}:${proximityState.trailState}:${Math.round(proximityState.distance * 10)}:${Math.round(proximityState.nearestPathDistance * 10)}:${Math.round(proximityState.cameraYaw * 10)}:${Math.round(proximityState.uiPresence * 100)}`;
    const now = state.clock.elapsedTime;
    const canPublishUiUpdate =
      now - lastUpdateTimeRef.current >= PROXIMITY_UI_UPDATE_INTERVAL;

    if (signature !== lastUiSignatureRef.current && canPublishUiUpdate) {
      lastUiSignatureRef.current = signature;
      lastUpdateTimeRef.current = now;
      onPlayerProximityChange?.(proximityState);
    }

    // Scene culling only needs a coarse player window. Keep the live HUD at
    // its existing cadence, but avoid reconciling the full world tree for
    // every small movement or camera turn.
    const spatialSignature = `${navigationTargetId}:${Math.round(playerPosition[0] / PLAYER_SPATIAL_CELL_SIZE)}:${Math.round(playerPosition[2] / PLAYER_SPATIAL_CELL_SIZE)}`;
    if (spatialSignature !== lastSpatialSignatureRef.current) {
      lastSpatialSignatureRef.current = spatialSignature;
      onPlayerSpatialChange?.({
        position: playerPosition,
        cameraYaw,
        navigationTargetId,
        nearestPathDistance: pathStatus.distance,
        trailState: pathStatus.state,
      });
    }

    const approachingId =
      navigationTargetId &&
      navigationTargetDistance < NODE_APPROACH_RADIUS * 1.65
        ? navigationTargetId
        : closestInactiveNode &&
            closestInactiveDistanceSq <
              NODE_APPROACH_RADIUS * NODE_APPROACH_RADIUS
          ? closestInactiveNode.entry.id
          : null;
    if (approachingId !== lastApproachRef.current) {
      lastApproachRef.current = approachingId;
      onApproachChange?.(approachingId);
    }

    // Physical story travel is continuous: walking through the environmental
    // threshold activates the clearing. Deliberate holds are reserved for
    // authored rituals, not ordinary navigation.
    if (
      closestInactiveNode &&
      closestInactiveDistanceSq <= NODE_ACTIVATION_RADIUS_SQ &&
      closestInactiveNode.entry.id !== lastEnteredNodeRef.current
    ) {
      lastEnteredNodeRef.current = closestInactiveNode.entry.id;
      onNodeEnter?.(closestInactiveNode.entry.id);
    } else if (closestInactiveDistanceSq > NODE_ACTIVATION_RADIUS_SQ * 2.25) {
      lastEnteredNodeRef.current = null;
    }
  });

  return null;
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
  const suppressLegacyActiveLandmark = isIntegratedFinale || usesAuthoredCausalComposition(node.entry.id);
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
      {!node.isActive ? <NodeLandmarkSilhouette node={node} activeEntry={activeEntry} narrativeWorldState={narrativeWorldState} qualityProfile={qualityProfile} /> : null}
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
      {!node.isActive ? (
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
  initialPlayerPosition = null,
  narrativeAudioSuppressed = false,
  onFinalConstellationFormationComplete,
  onPortalSelect,
  onPlayerProximityChange,
}: StorySceneProps) {
  const cameraReadyRef = useRef(false);
  const cameraAssistance = useSettingsStore((state) => state.cameraAssistance);
  const eventObjects = useJourneyStore((state) => state.storyObjectStates);
  const eventFlags = useJourneyStore((state) => state.worldFlags);
  const eventIds = useJourneyStore((state) => state.completedStoryEventIds);
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

  const start = entry?.engine3d.cameraStart ?? DEFAULT_CAMERA_POSITION;
  const authoredArrival = useMemo(() => narrativeScene && mode === "explore" && controls === "walk"
    ? getAuthoredSceneArrival(narrativeScene.id, authoredSceneOrigin, getJourneySceneLayout(narrativeScene.id).anchor.headingRadians)
    : null, [narrativeScene, mode, controls, authoredSceneOrigin]);
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

  return (
    <>
      {reducedEffects ? null : (
        <CinematicFrameOverlay visualState={visualState} narrativeWorldState={narrativeWorldState} qualityProfile={qualityProfile} />
      )}
      <AnimatedSceneCamera
        entry={entry}
        mode={mode}
        controls={controls}
        cameraReadyRef={cameraReadyRef}
        activePosition={activePosition}
        playerInitialPosition={playerInitialPosition}
        guidanceLookTarget={cameraGuidanceTarget}
        reducedMotion={reducedMotion}
      />
      <ContinuousForestBed entries={entries} pathSegments={pathSegments} narrativeWorldState={narrativeWorldState} activeEntry={entry} qualityProfile={qualityProfile} showClearingFrame={openingResolved} />
      <FirstPersonPlayer
        enabled={mode === "explore" && controls === "walk"}
        movementEnabled={openingResolved}
        cameraReadyRef={cameraReadyRef}
        initialPosition={playerInitialPosition}
        activeEntry={entry}
        narrativeWorldState={narrativeWorldState}
        sampleGroundY={sampleGroundY}
      />
      <JourneyWorldComposition
        activeSceneId={narrativeScene?.id}
        activeOrigin={authoredSceneOrigin}
        qualityProfile={qualityProfile}
        reducedEffects={reducedEffects}
        reducedMotion={reducedMotion}
        renderAdjacent
        interactionsEnabled={mode === "explore"}
        openingResolved={openingResolved}
        onFinalConstellationFormationComplete={
          onFinalConstellationFormationComplete
        }
      />
      {narrativeScene && mode === "explore" ? <>
        <EmotionalCinematographyDirector sceneId={narrativeScene.id} reducedMotion={reducedMotion} cameraAssistance={cameraAssistance}
          focusPosition={cameraGuidanceTarget} lanternOwned={eventFlags["lantern.owned"]}
          surrenderComplete={eventObjects["river.white-fabric"] === "raised"} compression={["refilled-twice", "waiting-again"].includes(eventObjects["thorn-house.table"]) ? 1 : eventObjects["thorn-house.table"] === "refilled" ? .5 : 0}
          mindReleased={eventObjects["mind.questions"] === "behind"} creationComplete={Boolean(eventObjects["womb.creation"])} />
        <SpatialProseDirector entry={entry} scene={narrativeScene} position={authoredSceneOrigin} headingRadians={getJourneySceneLayout(narrativeScene.id).anchor.headingRadians} active witnessed={visitedEntryIds.includes(entry.id)} reducedMotion={reducedMotion}
          suppressed={narrativeScene.id === "broken-floor.confession" && !eventIds.includes("broken-floor.first-wipe")} />
      </> : null}
      {/* MasterPlayerLantern is mounted by StorySceneWithMasterLantern and is the sole carried lantern. */}
      {audioEnabled && !narrativeAudioSuppressed && mode === "explore" ? (
        <NarrativeAudioDirector qualityProfile={qualityProfile} />
      ) : null}
      <NodeProximityActivator
        nodes={spatialNodes}
        pathSegments={pathSegments}
        visitedEntryIds={visitedEntryIds}
        lockedEntryIds={lockedEntryIds}
        explicitNavigationTargetId={explicitNavigationTargetNode?.entry.id}
        controls={controls}
        mode={mode}
        onNodeEnter={onPortalSelect}
        onApproachChange={setApproachingEntryId}
        onPlayerProximityChange={onPlayerProximityChange}
        onPlayerSpatialChange={setPlayerSpatial}
      />
      <SceneAtmosphere cinematicActive={mode === "explore"} entry={entry} entries={entries} narrativeWorldState={narrativeWorldState} qualityProfile={qualityProfile} />
      {reducedEffects ? null : (
        <BiomeWeatherField activeEntry={entry} narrativeWorldState={narrativeWorldState} visualState={visualState} qualityProfile={qualityProfile} />
      )}
      <NarrativeLightingRig visualState={visualState} qualityProfile={qualityProfile} />
      {openingResolved ? (
        <>
          <LivingPathRibbon pathSegments={pathSegments} activeEntry={entry} navigationTargetId={navigationTargetId} narrativeWorldState={narrativeWorldState} sampleGroundY={sampleGroundY} />
          <MoonlitPathUnderstory pathSegments={pathSegments} activeEntry={entry} navigationTargetId={navigationTargetId} narrativeWorldState={narrativeWorldState} qualityProfile={qualityProfile} sampleGroundY={sampleGroundY} />
          {reducedEffects ? null : (
            <PathLightMotes pathSegments={pathSegments} activeEntry={entry} navigationTargetId={navigationTargetId} visualState={visualState} narrativeWorldState={narrativeWorldState} qualityProfile={qualityProfile} sampleGroundY={sampleGroundY} />
          )}
          {reducedEffects ? null : (
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
      <ProceduralDome
        entry={entry}
        visualState={visualState}
        radius={Math.max(232, activeRadius * 4.8)}
        narrativeWorldState={narrativeWorldState}
        qualityProfile={qualityProfile}
      />
      <AtmosphericForestPanorama
        radius={Math.max(182, activeRadius * 3.8)}
        visualState={visualState}
        showDepthPlate={visualState.biome === "firstWood" && qualityProfile.quality !== "low"}
      />
      <DistantForestSilhouetteRing visualState={visualState} qualityProfile={qualityProfile} />
      {fallbackEnvironmentSrc ? <EnvironmentSphere src={fallbackEnvironmentSrc} radius={activeRadius * 0.98} /> : null}
      {openingResolved ? (
        <>
          <PlayerBreadcrumbRecorder entries={entries} activeEntry={entry} narrativeWorldState={narrativeWorldState} pathSegments={pathSegments} controls={controls} mode={mode} qualityProfile={qualityProfile} />
          <PersistentEnvironmentalBreadcrumbs qualityProfile={qualityProfile} narrativeWorldState={narrativeWorldState} />
          <NarrativeGroundTrails entries={entries} pathSegments={pathSegments} narrativeWorldState={narrativeWorldState} activeEntry={entry} qualityProfile={qualityProfile} visitedEntryIds={visitedEntryIds} navigationTargetId={navigationTargetId} />
          {reducedEffects ? null : (
            <NarrativeGroundDetailField entries={entries} pathSegments={pathSegments} activeEntry={entry} narrativeWorldState={narrativeWorldState} qualityProfile={qualityProfile} />
          )}
          <SemanticObjectPathing entries={entries} pathSegments={pathSegments} narrativeWorldState={narrativeWorldState} activeEntry={entry} qualityProfile={qualityProfile} visitedEntryIds={visitedEntryIds} navigationTargetId={navigationTargetId} />
          {reducedEffects ? null : (
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
      <SceneControls controls={controls} mode={mode} />
      {showDebugOverlay ? <SceneDebugOverlay entry={entry} narrativeWorldState={narrativeWorldState} qualityProfile={qualityProfile} visualState={visualState} nodes={spatialNodes} /> : null}
    </>
  );
}

export default memo(StoryScene);
