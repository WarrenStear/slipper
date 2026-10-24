import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { type RenderQualityProfile } from "../../components/three/renderQuality";
import type { Slipper3DEntry, Vector3Tuple } from "../../data/slipper3dTypes";
import { nearestPathStatus, yawFromDirection, type TrailState } from "../../lib/navigationResolver";
import type { PlayerControls as StorySceneControls, ExperienceMode as StorySceneMode } from "../../player/playerTypes";
import { useBreadcrumbStore, type BreadcrumbKind, type BreadcrumbTrace } from "../../stores/useBreadcrumbStore";
import { terrainElevationAtPoint } from "../terrain/terrainSampler.ts";
import { TERRAIN_BASE_Y } from "../terrain/worldConstants.ts";
import { type MazePathSegment } from "../terrain/worldPaths.ts";
import { worldSeededUnit } from "../worldMath.ts";
import { dominantSemanticTheme } from "../worldSemantics.ts";
import { type NarrativeWorldState } from "../worldTypes.ts";


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

export function PlayerBreadcrumbRecorder({
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

export function PersistentEnvironmentalBreadcrumbs({ qualityProfile, narrativeWorldState }: { qualityProfile: RenderQualityProfile; narrativeWorldState: NarrativeWorldState }) {
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
