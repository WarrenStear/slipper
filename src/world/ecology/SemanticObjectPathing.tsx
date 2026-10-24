import { useFrame, useThree } from "@react-three/fiber";
import { BallCollider, InstancedRigidBodies } from "@react-three/rapier";
import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { type RenderQualityProfile } from "../../components/three/renderQuality";
import { resolveWorldVisualState } from "../../components/three/worldVisualState";
import type { Slipper3DEntry } from "../../data/slipper3dTypes";
import { classifyRouteSegment, routeClassWeight } from "../../lib/navigationResolver";
import { terrainElevationAtPoint } from "../terrain/terrainSampler.ts";
import { CHAPTER_BLUE_MOON_ARCHIVE, CHAPTER_CROWNED_RETURN, CHAPTER_FIRE_AND_RIVER, CHAPTER_MIRROR_CLEARING, CHAPTER_THORNED_HOUSE, CLEARING_SAFE_RADIUS, CORRIDOR_BASE_WIDTH, CORRIDOR_MIN_WIDTH, TERRAIN_BASE_Y } from "../terrain/worldConstants.ts";
import { curvedPathPointAt, nearestMazePathSegment, pathSegmentAngle, type MazePathSegment } from "../terrain/worldPaths.ts";
import { allClearingPositions, chapterProgress, isChapter } from "../terrain/worldPlacement.ts";
import { clamp01, worldSeededUnit } from "../worldMath.ts";
import { dominantSemanticTheme, SEMANTIC_PATH_THEMES, type SemanticPathTheme } from "../worldSemantics.ts";
import { type NarrativeWorldState } from "../worldTypes.ts";

const DECORATION_CELL_SIZE = 5.5;
const DECORATION_CELL_RADIUS = 4;
const DECORATIONS_PER_CELL = 2;
const DECORATION_INSTANCE_COUNT = (DECORATION_CELL_RADIUS * 2 + 1) * (DECORATION_CELL_RADIUS * 2 + 1) * DECORATIONS_PER_CELL;
const SEMANTIC_REBUILD_MIN_INTERVAL = 0.18;
const SEMANTIC_SENSOR_LIMIT = 16;

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

export function SemanticObjectPathing({
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
