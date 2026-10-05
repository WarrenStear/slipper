import { useEffect, useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import type { Slipper3DEntry } from "../../data/slipper3dTypes.ts";
import { resolveWorldVisualState } from "../../components/three/worldVisualState.ts";
import { type RenderQualityProfile } from "../../components/three/renderQuality.ts";
import { curvedPathPointAt, curvedPathTangentAt, type MazePathSegment } from "../terrain/worldPaths.ts";
import { type NarrativeWorldState } from "../worldTypes.ts";
import { guidedPathSegment } from "./routeGeometry.ts";
import { hashString, seededUnit } from "../worldMath.ts";

export function createPathUnderstoryGeometry() {
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

export function MoonlitPathUnderstory({
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

