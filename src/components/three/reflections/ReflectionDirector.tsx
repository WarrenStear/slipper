import { HeroReflectionSurface } from "./HeroReflectionSurface";
import { memo, useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { useSceneLook } from "../artDirection/SceneLookContext";
import { HeroAssetSlot } from "../actors/HeroAssetSlot";
import { Beam } from "../chapters/ChapterPrimitives";
import type { RenderQualityProfile } from "../renderQuality";
import { MirrorMemorySurface } from "./MirrorMemorySurface";
import { ReflectedPath } from "./ReflectedPath";
import { ReflectionApparition } from "./ReflectionApparition";
import { createMirrorFrameGeometry } from "../environmentArt/heroGeometry";
import { TactileMaterial } from "../storyEvents/TactileMaterial";

export type ReflectionDirectorProps = {
  sceneId: string;
  qualityProfile: RenderQualityProfile;
  reducedEffects?: boolean;
  reducedMotion?: boolean;
};

function AlternateReflectedLandmark({ truthful, still }: { truthful: boolean; still: boolean }) {
  const color = still ? "#d7e8e8" : truthful ? "#8fb5ba" : "#9a5544";
  return (
    <group name="alternate-reflected-landmark" position={[1.48, -2.55, 0.19]} scale={[0.72, 0.72, 0.72]}>
      <Beam from={[0, 0, 0]} to={[0, 4.35, 0]} radius={0.11} color={color} opacity={0.14} />
      <Beam from={[0, 2.45, 0]} to={[-0.82, 3.7, 0]} radius={0.07} color={color} opacity={0.12} />
      <Beam from={[0, 2.72, 0]} to={[0.92, 4.04, 0]} radius={0.07} color={color} opacity={0.12} />
      <mesh position={[0, 4.4, 0]}>
        <circleGeometry args={[0.24, 12]} />
        <meshBasicMaterial color={color} transparent opacity={still ? 0.16 : 0.1} depthWrite={false} toneMapped={false} />
      </mesh>
    </group>
  );
}

/**
 * Story-specific reflection illusion: the figure follows old camera samples,
 * while routes, text, a second presence, and a changed landmark exist only on
 * the mirror plane. This keeps the effect bounded to one scene and one pass.
 */
function ReflectionDirectorComponent({
  sceneId,
  qualityProfile,
  reducedEffects = false,
  reducedMotion = false,
}: ReflectionDirectorProps) {
  const presentation = useSceneLook();
  const rootRef = useRef<THREE.Group>(null);
  const playerRef = useRef<THREE.Group>(null);
  const apparitionRef = useRef<THREE.Group>(null);
  const cursorRef = useRef(0);
  const primedRef = useRef(false);
  const isWarning = sceneId === "sunset.warning-grove";
  const isTruthful = sceneId === "sunset.true-mirror";
  const isStillnessScene = sceneId === "sunset.stillness";
  const frameGeometry = useMemo(() => createMirrorFrameGeometry(), []);
  useEffect(() => () => frameGeometry.dispose(), [frameGeometry]);
  const reflectionSettled = isStillnessScene && Boolean(presentation?.look.stillness);
  const sampleCount = reducedMotion ? 1 : reflectionSettled ? 2 : reducedEffects ? 12 : qualityProfile.quality === "low" ? 18 : 34;
  const samplesRef = useRef(Array.from({ length: sampleCount }, () => new THREE.Vector3()));
  const localCameraRef = useRef(new THREE.Vector3());

  useEffect(() => {
    samplesRef.current = Array.from({ length: sampleCount }, () => new THREE.Vector3());
    cursorRef.current = 0;
    primedRef.current = false;
  }, [sampleCount, sceneId]);

  useFrame(({ camera, clock }, delta) => {
    const root = rootRef.current;
    const player = playerRef.current;
    if (!root || !player) return;

    root.updateWorldMatrix(true, false);
    const localCamera = localCameraRef.current.copy(camera.position);
    root.worldToLocal(localCamera);
    const samples = samplesRef.current;
    if (!primedRef.current) {
      samples.forEach((sample) => sample.copy(localCamera));
      primedRef.current = true;
    }
    samples[cursorRef.current].copy(localCamera);
    cursorRef.current = (cursorRef.current + 1) % samples.length;
    const delayed = samples[cursorRef.current];
    const reflectedX = THREE.MathUtils.clamp(-delayed.x * 0.34, -1.72, 1.72);
    player.position.x = THREE.MathUtils.damp(
      player.position.x,
      reflectedX,
      reflectionSettled ? 7.5 : 3.1,
      Math.min(delta, 0.05),
    );
    player.position.y = -2.35 + THREE.MathUtils.clamp((delayed.y - 1.7) * 0.035, -0.12, 0.2);
    if (!reducedMotion) {
      player.rotation.z = Math.sin((presentation?.time.water ?? clock.elapsedTime) * 0.31) * (presentation ? presentation.motion.water * .08 : .025);
    }

    const apparition = apparitionRef.current;
    if (apparition) {
      apparition.position.x = -player.position.x * 0.54 + (isWarning ? -0.72 : 0.82);
      apparition.position.y = player.position.y + 0.18;
      apparition.scale.setScalar(reflectionSettled ? 0.92 : 1.04);
    }
  });

  return (
    <group ref={rootRef} name="memory-reflection-director" position={[0, 3.15, 5.4]} rotation={[0, Math.PI, 0]}>
      <mesh>
        <boxGeometry args={[5.76, 6.36, 0.18]} />
        <meshStandardMaterial color="#25201c" metalness={0.58} roughness={0.42} />
      </mesh>
      <HeroAssetSlot id="cracked-mirror"><mesh name="worn-joined-mirror-frame" geometry={frameGeometry} position={[0, 0, .11]}>
        <TactileMaterial surface="metal" color="#8c7960" vertexColors metalness={.38} roughness={.68} memory={{ wear: .92, damage: .65 }} />
      </mesh></HeroAssetSlot>

      <group name="reflected-past-and-future" position={[0, 0, 0.155]}>
        <mesh position={[-1.35, 0.62, 0]}>
          <planeGeometry args={[2.45, 4.82]} />
          <meshBasicMaterial color={isWarning ? "#713927" : "#263846"} transparent opacity={0.065} depthWrite={false} />
        </mesh>
        <mesh position={[1.35, 0.62, 0.006]}>
          <planeGeometry args={[2.45, 4.82]} />
          <meshBasicMaterial
            color={reflectionSettled ? "#a9c4c0" : "#5b737a"}
            transparent
            opacity={reflectionSettled ? 0.035 : 0.07}
            depthWrite={false}
          />
        </mesh>
      </group>

      <HeroReflectionSurface kind="mirror" size={[5.4, 6]} position={[0, 0, .115]} settled={reflectionSettled} />
      <group name="mirror-scar-retained-through-truth" position={[0, 0, .23]}>
        <Beam from={[-.92, 2.92, 0]} to={[-.47, 1.15, 0]} radius={.009} color="#637879" opacity={.7} radialSegments={3} />
        <Beam from={[-.47, 1.15, 0]} to={[.25, -.68, 0]} radius={.007} color="#91a3a0" opacity={.5} radialSegments={3} />
        <Beam from={[-.47, 1.15, 0]} to={[-1.35, .42, 0]} radius={.006} color="#637879" opacity={.55} radialSegments={3} />
        <Beam from={[.25, -.68, 0]} to={[.16, -1.72, 0]} radius={.004} color="#8c9b96" opacity={.45} radialSegments={3} />
        <Beam from={[-.75, 2.35, 0]} to={[-.22, 2.05, 0]} radius={.003} color="#8c9b96" opacity={.45} radialSegments={3} />
      </group>
      <AlternateReflectedLandmark truthful={isTruthful} still={reflectionSettled} />
      <group ref={apparitionRef} position={[-0.72, -2.17, 0.185]} visible={!reducedEffects || isWarning}>
        <ReflectionApparition apparition />
      </group>
      <group ref={playerRef} position={[0, -2.35, 0.205]}>
        <ReflectionApparition />
      </group>

      <ReflectedPath visible={isTruthful || reflectionSettled} still={reflectionSettled} reducedEffects={reducedEffects} />
      <MirrorMemorySurface
        warm={isWarning}
        still={reflectionSettled}
        reducedMotion={reducedMotion}
        reducedEffects={reducedEffects}
      />
    </group>
  );
}

export const ReflectionDirector = memo(ReflectionDirectorComponent);
export default ReflectionDirector;
