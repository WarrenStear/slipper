import { memo, useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import type { JourneySceneId } from "../../../lib/storyJourneyState";
import type { RenderQualityProfile } from "../renderQuality";
import { useJourneyStore } from "../../../stores/useJourneyStore";
import { resolveEnvironmentalChoreography, type EnvironmentalCueState } from "../../../cinematics/environmentalChoreography";
import { getCurrentCinematicProfile } from "../../../cinematics/emotionalCinematography";
import { StoryObjectModel } from "./StoryObjectModel";
import { Beam, DoorFrame, FabricVeil, WaterSurface } from "../chapters/ChapterPrimitives";
import { createFlameGeometry, createWaxCandleGeometry } from "../environmentArt/authoredGeometry.ts";
import { TactileMaterial } from "./TactileMaterial";

type ChoreographyProps = { sceneId: JourneySceneId; reducedMotion: boolean; reducedEffects: boolean; qualityProfile: RenderQualityProfile };

function CandleChain({ lit, reducedMotion, count }: { lit: boolean; reducedMotion: boolean; count: number }) {
  const flames = useRef<THREE.InstancedMesh>(null);
  const wax = useRef<THREE.InstancedMesh>(null);
  const light = useRef<THREE.PointLight>(null);
  const time = useRef(lit ? 12 : 0);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const geometry = useMemo(() => ({ wax: createWaxCandleGeometry(.085, .5, 5), flame: createFlameGeometry(.055, .13) }), []);
  useEffect(() => () => { geometry.wax.dispose(); geometry.flame.dispose(); }, [geometry]);
  useFrame((_, delta) => {
    if (lit) time.current = Math.min(12, time.current + Math.min(delta, 0.05));
    for (let index = 0; index < count; index += 1) {
      const progress = index / Math.max(1, count - 1);
      dummy.position.set(-3.3 + Math.sin(progress * Math.PI) * 0.7, 0.25, -1.5 + progress * 9);
      dummy.scale.set(1, 1 + (index % 3) * 0.2, 1); dummy.updateMatrix(); wax.current?.setMatrixAt(index, dummy.matrix);
      const strength = lit ? Math.max(0, Math.min(1, (time.current - progress * (reducedMotion ? 0 : 5)) * 1.4)) : 0;
      dummy.position.y = 0.51 + (index % 3) * 0.1;
      dummy.scale.set(strength, strength * 1.7, strength); dummy.updateMatrix(); flames.current?.setMatrixAt(index, dummy.matrix);
    }
    if (wax.current) wax.current.instanceMatrix.needsUpdate = true;
    if (flames.current) flames.current.instanceMatrix.needsUpdate = true;
    if (light.current) light.current.intensity += ((lit ? 1.5 : 0) - light.current.intensity) * Math.min(delta, 0.05);
  });
  return <group name="candle-chain-response" userData={{ lit }}>
    <instancedMesh ref={wax} geometry={geometry.wax} args={[undefined, undefined, count]}><TactileMaterial surface="wax" color="#cec2a7" roughness={0.82} /></instancedMesh>
    <instancedMesh ref={flames} geometry={geometry.flame} args={[undefined, undefined, count]}><meshBasicMaterial color="#efcf91" /></instancedMesh>
    <pointLight ref={light} position={[-3.1, 0.9, 2]} color="#e4bd83" intensity={0} distance={11} decay={2} />
  </group>;
}

function WaterResponse({ position, active, washed = false, includeSoot = false, reducedMotion }: { position: [number, number, number]; active: boolean; washed?: boolean; includeSoot?: boolean; reducedMotion: boolean }) {
  const rings = useRef<THREE.Group>(null);
  const soot = useRef<THREE.Mesh>(null);
  const time = useRef(0);
  useEffect(() => { time.current = 0; }, [active, washed]);
  useFrame((_, delta) => {
    time.current += Math.min(delta, 0.05);
    if (rings.current) rings.current.children.forEach((child, index) => {
      const progress = reducedMotion ? 0.4 + index * 0.15 : ((time.current * 0.13 + index * 0.23) % 1);
      child.scale.setScalar(0.5 + progress * 3.6);
      const material = (child as THREE.Mesh).material as THREE.MeshBasicMaterial;
      material.opacity = active ? (1 - progress) * 0.19 : 0;
    });
    if (soot.current) {
      const material = soot.current.material as THREE.MeshBasicMaterial;
      const target = washed ? 0 : active ? 0.16 : 0.34;
      material.opacity += (target - material.opacity) * (1 - Math.exp(-Math.min(delta, 0.05) * 0.7));
      if (!reducedMotion && active) soot.current.rotation.z += Math.min(delta, 0.05) * 0.02;
    }
  });
  return <group position={position} name="water-and-ash-response">
    <group ref={rings} rotation={[-Math.PI / 2, 0, 0]}>{[0, 1, 2].map(index => <mesh key={index} position={[0, 0, index * 0.001]}><ringGeometry args={[0.97, 1, 48]} /><meshBasicMaterial color="#b3c9ce" transparent opacity={0} depthWrite={false} side={THREE.DoubleSide} /></mesh>)}</group>
    {includeSoot ? <mesh ref={soot} position={[0, 0.002, 0]} rotation={[-Math.PI / 2, 0, 0]}><circleGeometry args={[1.4, 16]} /><meshBasicMaterial color="#202522" transparent opacity={washed ? 0 : 0.34} depthWrite={false} /></mesh> : null}
  </group>;
}

function CageResponse({ physical, reflected }: { physical: boolean; reflected: boolean }) {
  const physicalRef = useRef<THREE.Group>(null);
  useFrame((_, delta) => {
    if (!physicalRef.current) return;
    physicalRef.current.scale.y += ((physical ? 1 : 0.001) - physicalRef.current.scale.y) * (1 - Math.exp(-Math.min(delta, 0.05) * 0.65));
  });
  return <group name="reflection-becomes-captivity" userData={{ physical, reflected }}>
    {reflected ? <group position={[1, 1.3, 2.9]}>{[-0.4, -0.2, 0, 0.2, 0.4].map(x => <mesh key={x} position={[x, 0.6, 0]}><boxGeometry args={[0.018, 1.3, 0.018]} /><meshBasicMaterial color="#323d43" /></mesh>)}</group> : null}
    <group ref={physicalRef} position={[3.1, 0, -2.8]} scale={[1, physical ? 1 : 0.001, 1]}>
      {Array.from({ length: 14 }, (_, index) => { const angle = index / 14 * Math.PI * 2; return <mesh key={index} position={[Math.cos(angle) * 1.1, 1.4, Math.sin(angle) * 1.1]}><cylinderGeometry args={[0.024, 0.024, 2.8, 5]} /><meshStandardMaterial color="#53534b" metalness={0.62} roughness={0.58} /></mesh>; })}
      {[0.15, 2.75].map(y => <mesh key={y} position={[0, y, 0]} rotation={[Math.PI / 2, 0, 0]}><torusGeometry args={[1.1, 0.04, 5, 32]} /><meshStandardMaterial color="#53534b" metalness={0.62} roughness={0.58} /></mesh>)}
    </group>
  </group>;
}

function DomesticResponse({ state, house, reducedMotion, reducedEffects }: { state: EnvironmentalCueState; house: boolean; reducedMotion: boolean; reducedEffects: boolean }) {
  const windowLight = useRef<THREE.PointLight>(null);
  const walls = useRef<THREE.Group>(null);
  const clutter = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const amount = useRef(house ? state.houseCompression : Number(state.daysCompressed));
  const count = reducedEffects ? 8 : 20;
  useFrame(({ clock }, delta) => {
    const target = house ? state.houseCompression : Number(state.daysCompressed);
    amount.current += (target - amount.current) * (1 - Math.exp(-Math.min(delta, 0.05) * 0.5));
    if (walls.current) walls.current.children.forEach((child, index) => { child.position.x = (index ? 1 : -1) * (4.3 - amount.current * 1.2); });
    for (let index = 0; index < count; index += 1) {
      const visible = index < 3 + amount.current * (count - 3);
      dummy.position.set((index % 2 ? -1 : 1) * (2.8 + index % 3 * 0.35), 0.18 + Math.floor(index / 8) * 0.22, 0.5 + index % 5 * 0.92);
      dummy.rotation.set(0.05 * (index % 3), index * 0.84, 0.06);
      dummy.scale.set(visible ? 0.5 : 0, visible ? 0.22 : 0, visible ? 0.4 : 0); dummy.updateMatrix(); clutter.current?.setMatrixAt(index, dummy.matrix);
    }
    if (clutter.current) clutter.current.instanceMatrix.needsUpdate = true;
    if (windowLight.current) {
      const cycle = state.daysCompressed && !reducedMotion ? 0.75 + Math.sin(clock.elapsedTime * 0.7) * 0.35 : 1;
      windowLight.current.intensity = house ? 0.65 * (1 - amount.current * 0.8) : cycle;
    }
  });
  return <group name={house ? "house-refill-compression" : "nest-time-and-weight"} userData={{ handsOccupied: state.handsOccupied, compressed: state.daysCompressed, compression: state.houseCompression }}>
    <pointLight ref={windowLight} position={[0, 4, 4]} color="#d7c5a0" intensity={0.8} distance={13} decay={2} />
    <instancedMesh ref={clutter} args={[undefined, undefined, count]}><boxGeometry args={[1, 1, 1]} /><meshStandardMaterial color={house ? "#685340" : "#8e7760"} roughness={1} /></instancedMesh>
    {house ? <group ref={walls}>{[-1, 1].map(side => <group key={side} position={[side * 4.3, 0, 1]}><mesh position={[0, 1.7, 0]}><boxGeometry args={[0.3, 3.4, 7.5]} /><meshStandardMaterial color="#564638" roughness={0.98} /></mesh><mesh position={[-side * 0.2, 2, -1]}><boxGeometry args={[0.08, 1.3, 0.9]} /><meshStandardMaterial color="#2b2c28" roughness={0.95} /></mesh></group>)}</group> : <group name="child-space-remains-protected" position={[-1, 0, 3.5]}><pointLight position={[0, 1.4, 0]} color="#f0d2a5" intensity={1.2} distance={5} decay={2} /><mesh position={[0, 0.13, 0]}><cylinderGeometry args={[0.9, 1, 0.25, 24]} /><meshStandardMaterial color="#ad937a" roughness={1} /></mesh><group position={[0, 0.29, 0]} scale={1.5}><StoryObjectModel kind="fabric" reducedMotion={reducedMotion} /></group></group>}
  </group>;
}

function WhiteFabric({ raised, reducedMotion }: { raised: boolean; reducedMotion: boolean }) {
  const cloth = useRef<THREE.Group>(null);
  useFrame(({ clock }, delta) => {
    if (!cloth.current) return;
    cloth.current.position.y += ((raised ? 2.3 : 0.8) - cloth.current.position.y) * (1 - Math.exp(-Math.min(delta, 0.05) * 0.6));
    cloth.current.rotation.z = reducedMotion ? 0 : Math.sin(clock.elapsedTime * 0.42) * Math.max(0.008, getCurrentCinematicProfile().airMovement * 0.13);
  });
  return <group position={[1, 0, 4]} name="surrender-white-fabric-response"><Beam from={[-0.7, 0, 0]} to={[-0.7, 3.4, 0]} radius={0.025} color="#6a6558" /><group ref={cloth} position={[0, raised ? 2.3 : 0.8, 0]}><mesh><planeGeometry args={[1.4, 0.85]} /><meshStandardMaterial color="#e5e4d9" roughness={1} side={THREE.DoubleSide} /></mesh></group></group>;
}

function ChosenContinuity({ memory, creation, atHome, reducedMotion }: { memory: string; creation: string; atHome: boolean; reducedMotion: boolean }) {
  const grown = useRef<THREE.Group>(null);
  useFrame((_, delta) => { if (grown.current) grown.current.scale.y += (1 - grown.current.scale.y) * (1 - Math.exp(-Math.min(delta, 0.05) * 0.55)); });
  return <group name="chosen-memory-and-creation-continuity" userData={{ memory, creation }}>
    {atHome && memory ? <group position={[-2.5, 1.15, 2.5]}><StoryObjectModel kind={memory === "blush-rose" ? "rose" : memory === "swan-feather" ? "feather" : "mirror"} reducedMotion={reducedMotion} /><mesh position={[0, -0.12, 0]}><cylinderGeometry args={[0.5, 0.5, 0.12, 20]} /><meshStandardMaterial color="#8c7960" roughness={0.92} /></mesh></group> : null}
    {creation ? <group ref={grown} scale={[1, reducedMotion ? 1 : 0.02, 1]} position={atHome ? [2.8, 0, 2.8] : [0, 0, 4.5]}>
      {creation === "rest" ? <><mesh position={[0, 0.5, 0]}><boxGeometry args={[2.4, 0.25, 1.2]} /><meshStandardMaterial color="#8f7c64" roughness={1} /></mesh><group position={[0, 0.67, 0]} scale={[2.2, 1, 2]}><StoryObjectModel kind="fabric" reducedMotion={reducedMotion} /></group></> : creation === "home" ? <><DoorFrame width={2.8} height={3.6} depth={0.3} color="#998b70" /><group position={[0.9, 0.6, 0]}><StoryObjectModel kind="candle" state="lit" /></group><pointLight position={[0.9, 1, 0]} intensity={1.2} distance={7} color="#dfcba5" /></> : <><mesh position={[0, 0.85, 0]}><boxGeometry args={[2.2, 0.13, 1.1]} /><meshStandardMaterial color="#8c7963" roughness={1} /></mesh><group position={[0, 0.95, 0]}><StoryObjectModel kind="page" /></group><group position={[0, 0, 0.9]}><StoryObjectModel kind="chair" /></group></>}
    </group> : null}
  </group>;
}

export const EnvironmentalChoreography = memo(function EnvironmentalChoreography({ sceneId, reducedMotion, reducedEffects, qualityProfile }: ChoreographyProps) {
  const objectStates = useJourneyStore(state => state.storyObjectStates);
  const state = useMemo(() => resolveEnvironmentalChoreography(objectStates), [objectStates]);
  const blue = sceneId.startsWith("blue-moon.");
  const house = sceneId.startsWith("thorned.");
  const home = sceneId.startsWith("crowned.");
  return <group name="EnvironmentalChoreography" userData={{ sceneId }}>
    {blue ? <><CandleChain lit={state.candlesLit} reducedMotion={reducedMotion} count={reducedEffects ? 6 : qualityProfile.quality === "low" ? 10 : 18} /><WaterResponse position={[3.3, 0.08, 1.8]} active={state.waterTouched} reducedMotion={reducedMotion} />{sceneId === "blue-moon.caged-bird" ? <CageResponse physical={state.cagePhysical} reflected={state.cageReflected} /> : null}</> : null}
    {sceneId.startsWith("nest.") || house ? <DomesticResponse state={state} house={house} reducedMotion={reducedMotion} reducedEffects={reducedEffects} /> : null}
    {sceneId === "river.wash" ? <WaterResponse position={[0, 0.09, 3]} active={state.sootLoosening || state.sootWashed} washed={state.sootWashed} includeSoot reducedMotion={reducedMotion} /> : null}
    {sceneId === "river.release-surrender" ? <WhiteFabric raised={state.surrendered} reducedMotion={reducedMotion} /> : null}
    {sceneId.startsWith("fork.") ? <group position={[-5.5, 0, 2]} name="past-motifs-remain-behind"><pointLight position={[0, 2, 0]} color="#d9ad77" intensity={state.pastQuiet ? 0.08 : state.pastReturned ? 1.7 : 0.9} distance={9} decay={2} /><DoorFrame width={2} height={3.2} color="#65503f" /><WaterSurface position={[0, 0.02, -1.2]} size={[2, 2]} color="#3e5360" /><FabricVeil position={[-0.8, 1.6, 0]} size={[0.8, 2.6]} opacity={state.pastQuiet ? 0.22 : 0.65} reducedMotion={reducedMotion} />{state.pastReturned ? <DoorFrame position={[-1.4, 0, -2]} width={1.8} height={2.8} color="#574537" /> : null}</group> : null}
    {sceneId === "climb.womb" || home ? <ChosenContinuity memory={state.heartMemory} creation={state.creation} atHome={home} reducedMotion={reducedMotion} /> : null}
    {home && objectStates["home.water"] === "rippled" ? <WaterResponse position={[-4, 0.08, 3]} active reducedMotion={reducedMotion} /> : null}
  </group>;
});
export default EnvironmentalChoreography;
