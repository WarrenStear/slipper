import { memo, useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import type { JourneySceneId } from "../../../lib/storyJourneyState";
import type { Vector3Tuple } from "../../../data/slipper3dTypes";
import type { RenderQualityProfile } from "../renderQuality";
import { LanternProp } from "../chapters/ChapterPrimitives";
import { getCurrentCinematicProfile } from "../../../cinematics/emotionalCinematography";
import { CINEMATIC_ACTOR_CUES, flockInstanceCount, sampleActorCue, sampleFlockPose, type ActorCueDefinition, type ActorPose, type FlockPose } from "../../../cinematics/cinematicCueRegistry";

import { SwanModel } from "./SwanModel";

const ORIGIN: Vector3Tuple = [0, 0, 0];
const NO_CUES: readonly ActorCueDefinition[] = [];

function WolfFigure({ resting }: { resting: boolean }) {
  return <group scale={[0.8, 0.8, 0.8]} rotation={[0, Math.PI / 2, 0]}>
    <mesh position={[0, resting ? 0.46 : 0.85, 0]} scale={[1.1, 0.52, 0.42]}><dodecahedronGeometry args={[0.8, 1]} /><meshStandardMaterial color="#42433e" roughness={1} /></mesh>
    <mesh position={[0.92, resting ? 0.53 : 1.12, 0]} scale={[0.4, 0.38, 0.34]}><dodecahedronGeometry args={[0.8, 1]} /><meshStandardMaterial color="#353732" roughness={1} /></mesh>
    <mesh position={[1.22, resting ? 0.48 : 1.02, 0]} scale={[0.42, 0.19, 0.22]}><sphereGeometry args={[0.7, 10, 6]} /><meshStandardMaterial color="#282d29" roughness={1} /></mesh>
    {[-1, 1].map((side) => <mesh key={side} position={[0.88, resting ? 0.94 : 1.53, side * 0.19]}><coneGeometry args={[0.16, 0.4, 4]} /><meshStandardMaterial color="#282d29" roughness={1} /></mesh>)}
    {[-0.7, 0.6].flatMap((x) => [-0.25, 0.25].map((z) => <mesh key={`${x}:${z}`} position={[x + (resting ? 0.2 : 0), resting ? 0.13 : 0.4, z]} rotation={[0, 0, resting ? Math.PI / 2 : 0]}><capsuleGeometry args={[0.095, 0.56, 3, 6]} /><meshStandardMaterial color="#353732" roughness={1} /></mesh>))}
    <mesh position={[-1.1, resting ? 0.22 : 0.65, 0]} rotation={[0, 0, 1.2]}><capsuleGeometry args={[0.14, 0.72, 3, 6]} /><meshStandardMaterial color="#3a3e37" roughness={1} /></mesh>
  </group>;
}

function SwanFigure() {
  return <SwanModel />;
}

function ReflectedSeer() {
  return <group name="seer-apparition-only-in-reflection" rotation={[0, Math.PI, 0]}>
    <mesh position={[0, 1.65, 0]}><boxGeometry args={[1.9, 3.3, 0.12]} /><meshStandardMaterial color="#252b2e" metalness={0.65} roughness={0.18} /></mesh>
    <mesh position={[0, 1.65, 0.068]}><planeGeometry args={[1.68, 3.05]} /><meshPhysicalMaterial color="#596971" metalness={0.8} roughness={0.12} /></mesh>
    <mesh position={[0.03, 2.14, 0.078]} scale={[0.19, 0.25, 0.006]}><sphereGeometry args={[1, 14, 8]} /><meshBasicMaterial color="#bac5c7" transparent opacity={0.38} depthWrite={false} /></mesh>
    <mesh position={[0, 1.18, 0.078]} scale={[0.47, 1.25, 0.005]}><coneGeometry args={[1, 1.4, 12]} /><meshBasicMaterial color="#aebbbe" transparent opacity={0.23} depthWrite={false} /></mesh>
  </group>;
}

function AuthoredActor({ definition, reducedMotion }: { definition: ActorCueDefinition; reducedMotion: boolean }) {
  const group = useRef<THREE.Group>(null);
  const elapsed = useRef(0);
  const scratch = useMemo(() => ({ player: [0, 0, 0], pose: { x: 0, y: 0, z: 0, yaw: 0, visible: true } as ActorPose, world: new THREE.Vector3() }), []);
  useEffect(() => { elapsed.current = 0; }, [definition]);
  useFrame(({ camera }, delta) => {
    const actor = group.current;
    if (!actor) return;
    scratch.world.copy(camera.position);
    actor.parent?.worldToLocal(scratch.world);
    scratch.player[0] = scratch.world.x;
    scratch.player[1] = scratch.world.y;
    scratch.player[2] = scratch.world.z;
    const distance = Math.hypot(actor.position.x - scratch.player[0], actor.position.z - scratch.player[2]);
    const profile = getCurrentCinematicProfile();
    if (distance <= definition.waitDistance || definition.cue !== "lead") elapsed.current += Math.min(delta, 0.05) * (0.65 + profile.airMovement);
    const pose = sampleActorCue(definition, elapsed.current, scratch.player, reducedMotion, scratch.pose);
    const alpha = 1 - Math.exp(-Math.min(delta, 0.05) * 2.2);
    actor.position.set(THREE.MathUtils.lerp(actor.position.x, pose.x, alpha), pose.y, THREE.MathUtils.lerp(actor.position.z, pose.z, alpha));
    if (definition.actor !== "seer") actor.rotation.y = THREE.MathUtils.lerp(actor.rotation.y, pose.yaw, alpha);
    actor.visible = pose.visible;
    if (definition.actor === "seer") {
      // Only the face of the mirror carries the apparition, never a free NPC.
      actor.visible = scratch.player[2] < definition.from[2] && Math.abs(scratch.player[0] - definition.from[0]) < 10;
    }
  });
  return <group ref={group} position={definition.from} name={`StoryActor:${definition.actor}:${definition.cue}`}>
    {definition.actor === "lantern" ? <LanternProp scale={0.5} reducedMotion={reducedMotion} /> : null}
    {definition.actor === "wolf" ? <WolfFigure resting={definition.cue === "rest"} /> : null}
    {definition.actor === "swan" ? <SwanFigure /> : null}
    {definition.actor === "seer" ? <ReflectedSeer /> : null}
  </group>;
}

export const InstancedStoryFlock = memo(function InstancedStoryFlock({ qualityProfile, reducedEffects, reducedMotion, released, origami = false, awakened = false }: {
  qualityProfile: RenderQualityProfile; reducedEffects: boolean; reducedMotion: boolean; released: boolean; origami?: boolean; awakened?: boolean;
}) {
  const mesh = useRef<THREE.InstancedMesh>(null);
  const elapsed = useRef(0);
  const release = useRef(released ? 1 : 0);
  const count = flockInstanceCount(qualityProfile.quality, reducedEffects, origami);
  const scratch = useMemo(() => ({ transform: new THREE.Object3D(), pose: { x: 0, y: 0, z: 0, yaw: 0, flap: 0, scale: 1 } as FlockPose }), []);
  const geometry = useMemo(() => {
    const result = new THREE.BufferGeometry();
    result.setAttribute("position", new THREE.Float32BufferAttribute([
      0, 0, 0.6, -1.5, 0.25, -0.35, 0, 0, -0.2,
      0, 0, 0.6, 0, 0, -0.2, 1.5, 0.25, -0.35,
      0, 0, 0.6, 0, -0.17, -0.25, 0, 0, -0.6,
    ], 3));
    result.computeVertexNormals();
    return result;
  }, []);
  useEffect(() => () => geometry.dispose(), [geometry]);
  useFrame((_, delta) => {
    if (!mesh.current) return;
    if (!origami || awakened) elapsed.current += Math.min(delta, 0.05);
    if (released) release.current = Math.min(1, release.current + Math.min(delta, 0.05) / (reducedMotion ? 3 : 14));
    for (let index = 0; index < count; index += 1) {
      const pose = sampleFlockPose(index, elapsed.current, origami ? (awakened ? 0.18 : 0) : release.current, origami, reducedMotion, scratch.pose);
      scratch.transform.position.set(pose.x, pose.y, pose.z);
      scratch.transform.rotation.set(0, pose.yaw, pose.flap * 0.13);
      scratch.transform.scale.set(pose.scale, pose.scale * (0.8 + Math.abs(pose.flap)), pose.scale);
      scratch.transform.updateMatrix();
      mesh.current.setMatrixAt(index, scratch.transform.matrix);
    }
    mesh.current.instanceMatrix.needsUpdate = true;
  });
  return <instancedMesh ref={mesh} args={[geometry, undefined, count]} frustumCulled={false} name={origami ? "InstancedOrigamiAwakening" : "InstancedMurmurationRelease"} userData={{ instanceCount: count }}>
    <meshStandardMaterial color={origami ? "#dce0da" : "#121819"} roughness={0.96} side={THREE.DoubleSide} />
  </instancedMesh>;
});

export type StoryActorDirectorProps = {
  sceneId: JourneySceneId; position?: Vector3Tuple; qualityProfile: RenderQualityProfile; reducedEffects: boolean; reducedMotion: boolean;
  lanternOwned?: boolean; lanternPlaced?: boolean; birdsReleased?: boolean; origamiAwakened?: boolean;
};

export function StoryActorDirector({ sceneId, position = ORIGIN, qualityProfile, reducedEffects, reducedMotion, lanternOwned = false, lanternPlaced = false, birdsReleased = false, origamiAwakened = false }: StoryActorDirectorProps) {
  const cues = CINEMATIC_ACTOR_CUES[sceneId] ?? NO_CUES;
  return <group position={position} name="StoryActorDirector">
    {cues.filter((definition) => definition.actor !== "lantern" || (!lanternOwned && !lanternPlaced)).map((definition) => <AuthoredActor key={`${sceneId}:${definition.actor}`} definition={definition} reducedMotion={reducedMotion} />)}
    {sceneId === "river.release-surrender" ? <InstancedStoryFlock qualityProfile={qualityProfile} reducedEffects={reducedEffects} reducedMotion={reducedMotion} released={birdsReleased} /> : null}
    {sceneId === "blue-moon.intimacy" || sceneId === "blue-moon.sanctuary" ? <InstancedStoryFlock origami awakened={origamiAwakened} qualityProfile={qualityProfile} reducedEffects={reducedEffects} reducedMotion={reducedMotion} released={false} /> : null}
  </group>;
}
export default StoryActorDirector;
