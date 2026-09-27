import { memo, useEffect, useLayoutEffect, useMemo, useRef } from "react";
import { RigidBody, TrimeshCollider } from "@react-three/rapier";
import * as THREE from "three";
import { TactileMaterial } from "../storyEvents/TactileMaterial";
import { FoliageMaterial } from "./FoliageMaterial";
import { NarrativeWater } from "./SanctuaryWater";
import { createSaplingBarkGeometry, createSaplingLeafGeometry, createMossStoneGeometry, createFallenBranchGeometry } from "../environmentArt/woodlandAccentsGeometry";
import { createRushGeometry } from "../environmentArt/woodlandHabitatGeometry";
import {
  createLandscapeTerrain, createLandscapeRiver, createLandscapeObjects, landscapeBudget, landscapeForScene,
  LANDSCAPE_CAPACITY, LANDSCAPE_WATER_Y, type LandscapeBuffers, type LandscapePlacement, type LandscapeSpec,
} from "./landscapeGeography";

import { ENVIRONMENT_THEMES, BIOME_ECOLOGY_CAPACITY, biomeEcologyBudget } from "./environmentThemes";
import { createLandscapeEcology } from "./landscapeEcology";
import { createEvergreenBuffers, createTussockBuffers, createMeadowFlowerBuffers } from "./biomeGeometry";
import { LandscapeGroundMaterial } from "./LandscapeGroundMaterial";

const IGNORE_RAYCAST = () => undefined;
function geometryFromBuffers(data: LandscapeBuffers) {
  const geometry = new THREE.BufferGeometry();
  const vertices = new Float32Array(data.positions), indices = new Uint32Array(data.indices);
  geometry.setAttribute("position", new THREE.BufferAttribute(vertices, 3));
  geometry.setAttribute("normal", new THREE.Float32BufferAttribute(data.normals, 3));
  geometry.setAttribute("uv", new THREE.Float32BufferAttribute(data.uvs, 2));
  geometry.setAttribute("color", new THREE.Float32BufferAttribute(data.colors, 3));
  geometry.setIndex(new THREE.BufferAttribute(indices, 1));
  geometry.computeBoundingBox(); geometry.computeBoundingSphere();
  return { geometry, vertices, indices, colliderArgs: [vertices, indices] as [Float32Array, Uint32Array] };
}

type ScatterProps = {
  geometry: THREE.BufferGeometry; placements: readonly LandscapePlacement[]; capacity: number; count: number;
  name: string; finish: "bark" | "stone" | "leaves" | "reeds" | "grass" | "flowers"; tint?: string;
};
const LandscapeInstances = memo(function LandscapeInstances({ geometry, placements, capacity, count: requestedCount, name, finish, tint }: ScatterProps) {
  const count = Number.isFinite(requestedCount) ? Math.max(0, Math.floor(requestedCount)) : 0;
  const ref = useRef<THREE.InstancedMesh>(null);
  useLayoutEffect(() => {
    const mesh = ref.current; if (!mesh) return;
    const transform = new THREE.Object3D(), tint = new THREE.Color();
    const available = Math.min(placements.length, mesh.instanceMatrix.count);
    for (let i = 0; i < available; i++) {
      const item = placements[i];
      transform.position.set(...item.position); transform.rotation.set(...item.rotation); transform.scale.set(...item.scale);
      transform.updateMatrix(); mesh.setMatrixAt(i, transform.matrix);
      const shade = .87 + (i % 5) * .03;
      tint.setRGB(shade, shade, shade * .96); mesh.setColorAt(i, tint);
    }
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  }, [placements, capacity]);
  useLayoutEffect(() => {
    const mesh = ref.current; if (!mesh) return;
    const available = Math.min(placements.length, mesh.instanceMatrix.count);
    // Geometry changes affect bounds, not transforms. Quality-only count changes
    // must not re-upload matrices, colours or recompute the full-capacity bounds.
    mesh.count = available; mesh.computeBoundingBox(); mesh.computeBoundingSphere();
    if (finish === "leaves" || finish === "reeds" || finish === "grass") {
      mesh.boundingBox?.expandByScalar(.4); if (mesh.boundingSphere) mesh.boundingSphere.radius += .4;
    }
  }, [geometry, placements, capacity, finish]);
  useLayoutEffect(() => {
    const mesh = ref.current; if (!mesh) return;
    const available = Math.min(placements.length, mesh.instanceMatrix.count);
    // Also runs after either setup effect, restoring the active prefix before draw.
    mesh.count = Math.min(available, count);
    mesh.visible = mesh.count > 0;
  }, [count, geometry, placements, capacity, finish]);
  return <instancedMesh ref={ref} name={name} args={[undefined, undefined, capacity]} geometry={geometry} receiveShadow raycast={IGNORE_RAYCAST}>
    {finish === "flowers" ? <meshStandardMaterial color={tint ?? "#e3d8b2"} vertexColors roughness={.88} side={THREE.DoubleSide} />
      : finish === "leaves" || finish === "reeds" || finish === "grass" ? <FoliageMaterial color={tint ?? (finish === "leaves" ? "#859566" : "#8c9973")}
        vertexColors={finish !== "reeds"} doubleSided flexibility={finish === "leaves" ? .014 : .023} />
        : <TactileMaterial surface={finish} color={tint ?? (finish === "stone" ? "#ffffff" : "#9c8f77")} vertexColors={finish === "stone"} roughness={.95} />}
  </instancedMesh>;
});

/** Optional biome ecology: fixed geometry, prefix counts and one-time transforms. */
const LandscapeEcologyLayer = memo(function LandscapeEcologyLayer({ spec, data, trees, quality, reducedEffects }: {
  spec: LandscapeSpec; data: LandscapeBuffers; trees: readonly LandscapePlacement[]; quality: string; reducedEffects: boolean;
}) {
  const budget = biomeEcologyBudget(quality, reducedEffects), theme = ENVIRONMENT_THEMES[spec.family];
  const placements = useMemo(() => createLandscapeEcology(spec, data, trees), [spec, data, trees]);
  const shapes = useMemo(() => {
    const evergreen = createEvergreenBuffers();
    return { bark: geometryFromBuffers(evergreen.bark).geometry, leaves: geometryFromBuffers(evergreen.leaves).geometry,
      grass: geometryFromBuffers(createTussockBuffers()).geometry, flowers: geometryFromBuffers(createMeadowFlowerBuffers()).geometry };
  }, []);
  useEffect(() => () => { Object.values(shapes).forEach(geometry => geometry.dispose()); }, [shapes]);
  return <group name={`biome-ecology:${spec.family}`} userData={{ decorativeOnly: true, maxExtraDraws: theme.meadowFlowers ? 4 : 3 }}>
    <LandscapeInstances name="wind-shaped-evergreen-trunks" geometry={shapes.bark} placements={placements.evergreens} count={budget.evergreens} capacity={BIOME_ECOLOGY_CAPACITY.evergreens} finish="bark" tint={theme.bark} />
    <LandscapeInstances name="layered-evergreen-boughs" geometry={shapes.leaves} placements={placements.evergreens} count={budget.evergreens} capacity={BIOME_ECOLOGY_CAPACITY.evergreens} finish="leaves" tint={theme.evergreen} />
    <LandscapeInstances name="clustered-hillside-tussocks" geometry={shapes.grass} placements={placements.grass} count={budget.grass} capacity={BIOME_ECOLOGY_CAPACITY.grass} finish="grass" tint={theme.grass} />
    {theme.meadowFlowers ? <LandscapeInstances name="meadow-wildflower-drifts" geometry={shapes.flowers} placements={placements.flowers} count={budget.flowers} capacity={BIOME_ECOLOGY_CAPACITY.flowers} finish="flowers" tint={theme.flower} /> : null}
  </group>;
});

function LandscapeBasin({ spec, quality, reducedEffects, reducedMotion, collidable }: {
  spec: LandscapeSpec; quality: string; reducedEffects: boolean; reducedMotion: boolean; collidable: boolean;
}) {
  const budget = landscapeBudget(quality, reducedEffects), rich = !reducedEffects && (quality === "high" || quality === "cinematic");
  const theme = ENVIRONMENT_THEMES[spec.family], ecology = biomeEcologyBudget(quality, reducedEffects);
  const extraDraws = ecology.evergreens > 0 ? (theme.meadowFlowers ? 4 : 3) : 0;
  const data = useMemo(() => createLandscapeTerrain(spec), [spec]);
  const land = useMemo(() => geometryFromBuffers(data), [data]);
  const river = useMemo(() => { const buffers = createLandscapeRiver(spec); return buffers ? geometryFromBuffers(buffers) : null; }, [spec]);
  const objects = useMemo(() => createLandscapeObjects(spec, data), [spec, data]);
  const bark = useMemo(createSaplingBarkGeometry, []), stone = useMemo(createMossStoneGeometry, []);
  const leaves = useMemo(() => createSaplingLeafGeometry(rich), [rich]);
  const timber = useMemo(createFallenBranchGeometry, []), reeds = useMemo(createRushGeometry, []);
  useEffect(() => () => land.geometry.dispose(), [land]);
  useEffect(() => () => river?.geometry.dispose(), [river]);
  useEffect(() => () => bark.dispose(), [bark]);
  useEffect(() => () => leaves.dispose(), [leaves]);
  useEffect(() => () => stone.dispose(), [stone]);
  useEffect(() => () => timber.dispose(), [timber]);
  useEffect(() => () => reeds.dispose(), [reeds]);
  return <group name={`outdoor-landscape:${spec.family}`} userData={{ family: spec.family, rivers: Number(Boolean(river)), trees: budget.trees + ecology.evergreens, terrainTriangles: data.indices.length / 3, drawCallBudget: (river ? 7 : 6) + extraDraws }}>
    <mesh name="rolling-hills-and-carved-riverbanks" geometry={land.geometry} receiveShadow raycast={IGNORE_RAYCAST}>
      <LandscapeGroundMaterial spec={spec} />
    </mesh>
    {collidable ? <RigidBody type="fixed" colliders={false} name="landscape-terrain-collision">
      {/* Same vertex/index arrays as the visible terrain, invariant across quality. */}
      <TrimeshCollider args={land.colliderArgs} friction={.85} />
    </RigidBody> : null}
    {river ? <group name="meandering-river-reach" position={[0, LANDSCAPE_WATER_Y, 0]}>
      <NarrativeWater geometry={river.geometry} width={2.56} depth={spec.length * 2} flow={theme.water.flow} color={theme.water.color} opacity={theme.water.depth} roughness={theme.water.roughness} riverBanks
        reducedMotion={reducedMotion} reducedEffects={reducedEffects} />
    </group> : null}
    <LandscapeInstances name="hillside-tree-trunks" geometry={bark} placements={objects.trees} count={budget.trees} capacity={LANDSCAPE_CAPACITY.trees} finish="bark" tint={theme.bark} />
    <LandscapeInstances name="hillside-tree-canopies" geometry={leaves} placements={objects.trees} count={budget.trees} capacity={LANDSCAPE_CAPACITY.trees} finish="leaves" tint={theme.leaf} />
    <LandscapeInstances name="riverbank-mossy-boulders" geometry={stone} placements={objects.stones} count={budget.stones} capacity={LANDSCAPE_CAPACITY.stones} finish="stone" />
    <LandscapeInstances name="fallen-hillside-timber" geometry={timber} placements={objects.timber} count={budget.timber} capacity={LANDSCAPE_CAPACITY.timber} finish="bark" tint={theme.bark} />
    <LandscapeInstances name="riverbank-rush-clusters" geometry={reeds} placements={objects.reeds} count={budget.reeds} capacity={LANDSCAPE_CAPACITY.reeds} finish="reeds" tint={theme.grass} />
    {ecology.evergreens > 0 ? <LandscapeEcologyLayer spec={spec} data={data} trees={objects.trees} quality={quality} reducedEffects={reducedEffects} /> : null}
  </group>;
}

/** Only the active outdoor scene gets landscape; no lights, stores or new clocks. */
export const OutdoorLandscape = memo(function OutdoorLandscape({ sceneId, quality, reducedEffects, reducedMotion, collidable = true }: {
  sceneId: string; quality: string; reducedEffects: boolean; reducedMotion: boolean; collidable?: boolean;
}) {
  const spec = landscapeForScene(sceneId);
  return spec ? <LandscapeBasin spec={spec} quality={quality} reducedEffects={reducedEffects} reducedMotion={reducedMotion} collidable={collidable} /> : null;
});
