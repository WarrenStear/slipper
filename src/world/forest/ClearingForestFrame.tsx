import { forestCrownHabit } from "../../lib/forestArt.ts";
import { useLayoutEffect, useMemo, useRef } from "react";
import { CuboidCollider, RigidBody } from "@react-three/rapier";
import { useThree } from "@react-three/fiber";
import * as THREE from "three";
import { ForestSurfaceMaterial } from "../../components/three/environment/ForestSurfaceMaterial";
import type { Vector3Tuple } from "../../data/slipper3dTypes.ts";
import { type WorldVisualState } from "../../components/three/worldVisualState.ts";
import { type RenderQualityProfile } from "../../components/three/renderQuality.ts";
import { type ForestTexturePack } from "./useForestTextures.ts";
import { seededUnit } from "../worldMath.ts";
import { ROOTED_TRUNK_COLLIDER_SCALE } from "./forestConstants.ts";

export type ClearingFrameTree = {
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

export function ClearingForestFrame({
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
      const habit = forestCrownHabit(seededUnit(seed, index + 467));
      dummy.scale.set(
        tree.crownRadius * 1.12 * habit[0],
        Math.max(tree.crownRadius * 0.76, tree.crownHeight * 0.82) * habit[1],
        tree.crownRadius * 1.08 * habit[2],
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
        <ForestSurfaceMaterial finish="bark" qualityProfile={qualityProfile} map={textures.barkMap} color="#81756d" emissive={visualState.palette.trunk} emissiveIntensity={0.025} />
      </instancedMesh>
      <instancedMesh ref={crownRef} args={[crownGeometry, undefined, requestedCount]} castShadow={castShadow} receiveShadow>
        <ForestSurfaceMaterial finish="canopy" qualityProfile={qualityProfile} map={textures.crownMap} vertexColors color="#d4ded1" emissive={visualState.palette.leaf} emissiveIntensity={0.025} />
      </instancedMesh>
    </group>
  );
}

