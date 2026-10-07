import { scenePresentationActive } from "../presentationActivity";
import { openingBoughPose } from "./openingComposition";
import { useSettingsStore } from "../../stores/useSettingsStore";
import { useWorldStore } from "../../stores/useWorldStore";
import { createUnderfloorCaptureResources, captureUnderfloorFrame } from "./underfloorCapture";
import { createUnderfloorGeometry } from "./underfloorGeometry";
import { TactileMaterial } from "../../components/three/storyEvents/TactileMaterial";
import { useEffect, useLayoutEffect, useMemo, useRef, type RefObject } from "react";
import { createPortal, useFrame } from "@react-three/fiber";
import { Group, type Mesh } from "three";
import { LanternProp, SceneGround } from "../../components/three/chapters/ChapterPrimitives";
import { Forms } from "../../components/three/environment/EnvironmentDressing";
import { useSceneLook } from "../../components/three/artDirection/SceneLookContext";

/** A real, separate underfloor volume rendered from the player's actual camera.
 * Projective sampling on the wiped floor preserves translation parallax. */
export function useUnderfloorForest(surface: RefObject<Mesh>, stage: number, options: { reducedMotion?: boolean; visible?: () => boolean } = {}) {
  const presentation = useSceneLook();
  const resolution = presentation?.look.budget.reflectionSize ?? 0;
  const enabled = resolution > 0;
  const root = useRef<Group>(null), tick = useRef(0), valid = useRef(false);
  const boughMotion = useRef<Group>(null), captureActive = useRef(false);
  const forest = useMemo(() => enabled ? createUnderfloorGeometry() : null, [enabled]);
  useEffect(() => () => forest?.branches.dispose(), [forest]);
  const resources = useMemo(() => {
    if (!forest || !resolution) return null;
    return createUnderfloorCaptureResources(resolution);
  }, [forest, resolution]);
  useLayoutEffect(() => { valid.current = false; return () => { resources?.target.dispose(); }; }, [resources]);
  useFrame(({ gl, camera }) => {
    const world = useWorldStore.getState();
    const active = stage >= 1 && (options.visible?.() ?? true) && scenePresentationActive({ visible: !document.hidden, focused: document.hasFocus(),
      overlayOpen: useSettingsStore.getState().drawerOpen, mode: world.mode, physicsPaused: world.physicsPaused });
    if (!resources || !root.current || !surface.current || !active) { captureActive.current = false; return; }
    const resumed = !captureActive.current; captureActive.current = true;
    const motion = openingBoughPose(presentation?.time.vegetation ?? 0, presentation?.motion.vegetation ?? 0,
      options.reducedMotion === true || presentation?.reducedMotion === true || presentation?.reducedEffects === true);
    boughMotion.current?.rotation.set(motion.x, 0, motion.z);
    if (tick.current++ % (presentation?.look.budget.reflectionEveryFrames ?? 2) !== 0 && valid.current && !resumed) return;
    captureUnderfloorFrame(gl, camera, resources, root.current, surface.current, valid);
  }, -.5);
  const portal = resources && forest ? createPortal(<group ref={root} matrixAutoUpdate={false} name="underfloor-parallax-volume">
    <group position={[0, -11.5, 1]}>
      <Forms name="underfloor-depth-trunks" forms={forest.trunks} kind="tree" surface="bark" color="#7b9183" />
      <Forms name="underfloor-depth-canopy" forms={forest.crowns} kind="crown" color="#506d59" />
      <group ref={boughMotion} name="underfloor-shared-clock-bough-motion" position={[0, 7.6, 0]}>
        <mesh name="underfloor-near-boughs" position={[0, -7.6, 0]} geometry={forest.branches}><TactileMaterial surface="bark" color="#526258" /></mesh>
      </group>
      <SceneGround radius={38} y={-.3} color="#4c604d" />
      <LanternProp position={[.2, 2.1, 8]} scale={.72} reducedMotion />
      <hemisphereLight args={["#a5c1cd", "#26372f", 1.15]} />
      <pointLight position={[-4, 5.5, 6]} color="#94b1c0" intensity={31} distance={25} />
    </group>
  </group>, resources.scene) : null;
  return { texture: resources?.target.texture, valid, portal };
}
