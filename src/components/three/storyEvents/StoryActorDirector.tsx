import { useSceneLook } from "../artDirection/SceneLookContext";
import { memo, useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import type { JourneySceneId } from "../../../lib/storyJourneyState";
import type { Vector3Tuple } from "../../../data/slipper3dTypes";
import type { RenderQualityProfile } from "../renderQuality";
import { ReflectionApparition } from "../reflections/ReflectionApparition";
import { LanternProp, ReflectivePanel } from "../chapters/ChapterPrimitives";
import { getCurrentCinematicProfile } from "../../../cinematics/emotionalCinematography";
import { CINEMATIC_ACTOR_CUES, flockInstanceCount, sampleActorCue, sampleFlockPose, type ActorCueDefinition, type ActorPose, type FlockPose } from "../../../cinematics/cinematicCueRegistry";

import { SwanModel } from "./SwanModel";
import { AuthoredNpcSilhouette } from "../environmentArt/AuthoredNpc";
import { HeroAssetSlot } from "../actors/HeroAssetSlot";

const ORIGIN: Vector3Tuple = [0, 0, 0];
const NO_CUES: readonly ActorCueDefinition[] = [];

function WolfFigure({ resting }: { resting: boolean }) {
  return <group scale={.8}><HeroAssetSlot id={resting ? "wolf-resting" : "wolf"}><AuthoredNpcSilhouette kind="wolf" resting={resting} /></HeroAssetSlot></group>;
}

function SwanFigure() {
  return <HeroAssetSlot id="swan"><SwanModel /></HeroAssetSlot>;
}

function ReflectedSeer() {
  return <group name="seer-apparition-only-in-reflection" rotation={[0, Math.PI, 0]}>
    <ReflectivePanel position={[0, 1.65, 0]} size={[1.68, 3.05]} />
    <group position={[0, .63, .16]} scale={1.12}><ReflectionApparition apparition /></group>
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
    const alpha = reducedMotion ? 1 : 1 - Math.exp(-Math.min(delta, 0.05) * 2.2);
    actor.position.set(THREE.MathUtils.lerp(actor.position.x, pose.x, alpha), pose.y, THREE.MathUtils.lerp(actor.position.z, pose.z, alpha));
    if (definition.actor !== "seer") actor.rotation.y = THREE.MathUtils.lerp(actor.rotation.y, pose.yaw, alpha);
    actor.visible = pose.visible;
    if (definition.actor === "seer") {
      // Only the face of the mirror carries the apparition, never a free NPC.
      actor.visible = scratch.player[2] < definition.from[2] && Math.abs(scratch.player[0] - definition.from[0]) < 10;
    }
  });
  const start = reducedMotion && definition.actor === "swan" && definition.cue === "lead" ? definition.to : definition.from;
  return <group ref={group} position={start} name={`StoryActor:${definition.actor}:${definition.cue}`}>
    {definition.actor === "lantern" ? <LanternProp scale={0.5} reducedMotion={reducedMotion} /> : null}
    {definition.actor === "wolf" ? <WolfFigure resting={definition.cue === "rest"} /> : null}
    {definition.actor === "swan" ? <SwanFigure /> : null}
    {definition.actor === "seer" ? <ReflectedSeer /> : null}
  </group>;
}

export const InstancedStoryFlock = memo(function InstancedStoryFlock({ qualityProfile, reducedEffects, reducedMotion, released, origami = false, awakened = false }: {
  qualityProfile: RenderQualityProfile; reducedEffects: boolean; reducedMotion: boolean; released: boolean; origami?: boolean; awakened?: boolean;
}) {
  const presentation = useSceneLook();
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
    // Idle flight obeys scene stillness; the finite release remains a story action.
    const ambientMotion = reducedEffects || reducedMotion ? 0 : presentation ? Math.min(1, presentation.motion.vegetation * 5) : 1;
    if (!origami || awakened) elapsed.current += Math.min(delta, 0.05) * ambientMotion;
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
  // The Sunset chapter owns its one monumental mirror and its local apparition.
  const chapterOwnsSeer = sceneId.startsWith("sunset.");
  // Rabbit's canonical grounded guide is owned by FirstWoodScene; retain the
  // moving lantern actor in every other authored scene and its carrying gates.
  const chapterOwnsGuideLantern = sceneId === "enchanted.rabbit-hole";
  return <group position={position} name="StoryActorDirector">
    {cues.filter((definition) => !(chapterOwnsSeer && definition.actor === "seer") && (definition.actor !== "lantern" || (!chapterOwnsGuideLantern && !lanternOwned && !lanternPlaced))).map((definition) => <AuthoredActor key={`${sceneId}:${definition.actor}`} definition={definition} reducedMotion={reducedMotion} />)}
    {sceneId === "river.release-surrender" ? <InstancedStoryFlock qualityProfile={qualityProfile} reducedEffects={reducedEffects} reducedMotion={reducedMotion} released={birdsReleased} /> : null}
    {origamiAwakened && (sceneId === "blue-moon.intimacy" || sceneId === "blue-moon.sanctuary") ? <InstancedStoryFlock origami awakened={origamiAwakened} qualityProfile={qualityProfile} reducedEffects={reducedEffects} reducedMotion={reducedMotion} released={false} /> : null}
  </group>;
}
export default StoryActorDirector;
