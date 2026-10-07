import { scenePresentationActive } from "../presentationActivity";
import { advanceWetFloorUniforms } from "./wetFloorMotion";
import { vertexShader, fragmentShader } from "./wetFloorShader";
import { createWetFloorTextureView, createWetFloorMask, createWetFloorUniforms } from "./wetFloorResources";
import { useUnderfloorForest } from "./UnderfloorForest";
import { useTexture } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useCallback, useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { useSettingsStore } from "../../stores/useSettingsStore";
import { useWorldStore } from "../../stores/useWorldStore";
import { FLOOR_MASK_SIZE, floorBrush, resetFloorBrush } from "../../components/three/storyEvents/storyInteractionRuntime";

/** A fixed-size accumulated mask; only the two authored reveal stages are saved. */
export function WetFloorReveal({ stage, reducedMotion = false, apertureOpacity }: { stage: number; reducedMotion?: boolean; apertureOpacity?: () => number }) {
  const source = useTexture("/story-materials/forest-reflection.jpg");
  // Annotate a private texture view, not Drei's shared cached source.
  const forest = useMemo(() => createWetFloorTextureView(source), [source]);
  useEffect(() => () => forest.dispose(), [forest]);
  const material = useRef<THREE.ShaderMaterial>(null);
  const surface = useRef<THREE.Mesh>(null);
  const underfloor = useUnderfloorForest(surface, stage, { reducedMotion, visible: () => (apertureOpacity?.() ?? .94) > .012 });
  const revision = useRef(-1);
  const mask = useMemo(() => createWetFloorMask(floorBrush.coverage, FLOOR_MASK_SIZE), []);
  const uniforms = useMemo(() => createWetFloorUniforms(forest, mask, stage), [forest, mask]);
  useEffect(() => { resetFloorBrush(); revision.current = -1; return () => { resetFloorBrush(); mask.dispose(); }; }, [mask]);
  useEffect(() => { if (stage === 0) resetFloorBrush(); }, [stage]);
  const renderedCanvas = useRef<HTMLCanvasElement | null>(null);
  useEffect(() => () => { if (renderedCanvas.current) delete renderedCanvas.current.dataset.openingRenderedStage; }, []);
  const recordRenderedStage = useCallback((renderer: THREE.WebGLRenderer) => {
    renderedCanvas.current = renderer.domElement;
    if (Math.abs(uniforms.stage.value - stage) > .02) return;
    const value = String(stage);
    if (renderer.domElement.dataset.openingRenderedStage !== value) renderer.domElement.dataset.openingRenderedStage = value;
  }, [stage, uniforms]);
  useFrame((_, delta) => {
    uniforms.liveForest.value = underfloor.texture ?? forest;
    uniforms.hasDepth.value = underfloor.valid.current ? 1 : 0;
    const world = useWorldStore.getState();
    if (!material.current || !scenePresentationActive({ visible: !document.hidden, focused: document.hasFocus(),
      overlayOpen: useSettingsStore.getState().drawerOpen, mode: world.mode, physicsPaused: world.physicsPaused })) return;
    // An earned wipe must still become visible on a slow GPU. Dropping every
    // frame above 250 ms froze the reveal indefinitely at the Cinematic tier.
    advanceWetFloorUniforms(uniforms, stage, delta, reducedMotion);
    uniforms.apertureOpacity.value = apertureOpacity?.() ?? .94;
    if (revision.current !== floorBrush.revision) { mask.needsUpdate = true; revision.current = floorBrush.revision; }
  });
  return <>{underfloor.portal}<mesh ref={surface} onAfterRender={recordRenderedStage} name="wipeable-wet-floor" position={[0, .012, .3]} rotation={[-Math.PI / 2, 0, 0]} userData={{ revealStage: stage, maskSize: FLOOR_MASK_SIZE }}>
    <planeGeometry args={[12.8, 12.5]} />
    <shaderMaterial toneMapped={false} ref={material} uniforms={uniforms} transparent depthWrite={false} side={THREE.DoubleSide}
      vertexShader={vertexShader}
      fragmentShader={fragmentShader}
    />
  </mesh></>;
}
