import { GroundMistBanks } from "../atmosphere/GroundMist";
import type { MistPatch } from "../atmosphere/groundMistField";
import { useSceneLook } from "../../components/three/artDirection/SceneLookContext";
import { WoodlandSurfaceMaterial } from "../../components/three/environment/WoodlandSurfaceMaterial";
import { memo, useEffect, useMemo, useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import { CylinderCollider, RigidBody } from "@react-three/rapier";
import { DoubleSide } from "three";
import { TactileMaterial } from "../../components/three/storyEvents/TactileMaterial";
import { FoliageMaterial } from "../../components/three/environment/FoliageMaterial";
import { KeyProp } from "../../components/three/chapters/ChapterPrimitives";
import { WILLOW_REFUGE, WILLOW_POOL } from "../terrain/explorationLayout.ts";
import { TERRAIN_BASE_Y } from "../terrain/worldConstants.ts";
import { NarrativeWater } from "../../components/three/environment/SanctuaryWater";
import { createWillowBankStones, createExplorationPathGeometry, createWillowGeometry, createWillowPoolGeometry, createWillowUnderstory } from "./willowGeometry.ts";
import type { TerrainMorphState } from "../../lib/terrainModel.ts";
import { useWoodlandBarkTexture } from "../forest/useForestTextures";

const WillowTree = memo(function WillowTree({ quality, sampleGroundY }: { quality: string; sampleGroundY: (x: number, z: number) => number }) {
  const bark = useWoodlandBarkTexture();
  const look = useSceneLook();
  const { x, z } = WILLOW_REFUGE, y = sampleGroundY(x, z);
  const mist = useMemo<MistPatch[]>(() => [[-9, -1, 4], [-12, -1, 9], [4, -1, 7], [-8, -1, -7]].map(([dx, , dz], i) =>
    [dx, sampleGroundY(x + dx, z + dz) - y + .28, dz, 5 + i % 2, .38 + i % 2 * .1, 3.5]), [sampleGroundY, x, y, z]);
  const geometry = useMemo(() => createWillowGeometry(quality, (dx, dz) => sampleGroundY(x + dx, z + dz) - y), [quality, sampleGroundY, x, y, z]);
  const pool = useMemo(() => createWillowPoolGeometry(sampleGroundY), [sampleGroundY]);
  const stones = useMemo(() => createWillowBankStones(quality, sampleGroundY).translate(-x, -y, -z), [quality, sampleGroundY, x, y, z]);
  useEffect(() => () => stones.dispose(), [stones]);
  const understory = useMemo(() => createWillowUnderstory(quality, sampleGroundY).translate(-x, -y, -z), [quality, sampleGroundY, x, y, z]);
  useEffect(() => () => { geometry.wood.dispose(); geometry.leaves.dispose(); }, [geometry]);
  useEffect(() => () => pool.dispose(), [pool]);
  useEffect(() => () => understory.dispose(), [understory]);
  return <group name="willow-refuge" position={[x, y, z]} userData={{ optionalGeography: true }}>
    <mesh name="willow-leaning-trunk-and-grounded-roots" geometry={geometry.wood} castShadow receiveShadow>
      <meshStandardMaterial map={bark} bumpMap={quality === "high" || quality === "cinematic" ? bark : null} bumpScale={.075} color="#d2cfbc" vertexColors roughness={.96} />
    </mesh>
    <mesh name="willow-hanging-lanceolate-leaves" geometry={geometry.leaves} castShadow receiveShadow>
      <FoliageMaterial color="#879b68" vertexColors doubleSided flexibility={.022} />
    </mesh>
    <mesh name="willow-root-ferns-and-bank-rushes" geometry={understory} receiveShadow><FoliageMaterial color="#667d52" doubleSided /></mesh>
    <mesh name="willow-weathered-bank-stones" geometry={stones} receiveShadow><WoodlandSurfaceMaterial surface="stone" /></mesh>
    <RigidBody type="fixed" colliders={false}><CylinderCollider args={[1.6, .86]} position={[.3, 1.5, 0]} /></RigidBody>
    <group name="willow-quiet-pool" position={[WILLOW_POOL.x - x, TERRAIN_BASE_Y + WILLOW_POOL.surfaceOffset - y, WILLOW_POOL.z - z]}>
      <NarrativeWater geometry={pool} width={22} depth={16} color="#405653" opacity={.42} roughness={.32} reducedEffects={quality === "low"} />
    </group>
    {look?.look.budget.shafts && (quality === "high" || quality === "cinematic") ? <GroundMistBanks patches={mist} opacityScale={1.8} /> : null}
    {/* A literary echo, without a quest, inventory write, event or completion condition. */}
    <group name="willow-unclaimed-key" rotation={[0, -.4, .2]}><KeyProp position={[-.65, .37, .6]} scale={.65} color="#978562" /></group>
  </group>;
});

export const WillowRefuge = memo(function WillowRefuge({ quality, sampleGroundY, explorationDepth = 0, memoryPressure = 0 }: {
  quality: string; sampleGroundY: (x: number, z: number) => number;
} & TerrainMorphState) {
  const [resident, setResident] = useState(false), residentRef = useRef(false);
  useFrame(({ camera }) => {
    const distance = Math.hypot(camera.position.x - WILLOW_REFUGE.x, camera.position.z - WILLOW_REFUGE.z);
    const next = distance < (residentRef.current ? 125 : 105);
    if (next !== residentRef.current) { residentRef.current = next; setResident(next); }
  });
  const path = useMemo(() => createExplorationPathGeometry(sampleGroundY, { explorationDepth, memoryPressure }), [sampleGroundY, explorationDepth, memoryPressure]);
  useEffect(() => () => path.dispose(), [path]);
  return <group name="optional-exploration-geography">
    <mesh name="willow-connected-earth-paths" geometry={path} receiveShadow><TactileMaterial surface="earth" color="#5e5846" vertexColors side={DoubleSide} /></mesh>
    {resident ? <WillowTree quality={quality} sampleGroundY={sampleGroundY} /> : null}
  </group>;
});
