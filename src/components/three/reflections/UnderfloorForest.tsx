import { useEffect, useMemo, useRef, type RefObject } from "react";
import { createPortal, useFrame } from "@react-three/fiber";
import { Color, FogExp2, Group, HalfFloatType, UnsignedByteType, Scene, WebGLRenderTarget, type Mesh } from "three";
import { LanternProp, SceneGround } from "../chapters/ChapterPrimitives";
import { Forms } from "../environment/EnvironmentDressing";
import type { DressingForm } from "../environment/chapterEnvironment";
import { useSceneLook } from "../artDirection/SceneLookContext";

/** A real, separate underfloor volume rendered from the player's actual camera.
 * Projective sampling on the wiped floor preserves translation parallax. */
export function useUnderfloorForest(surface: RefObject<Mesh>, stage: number) {
  const presentation = useSceneLook();
  const resolution = presentation?.look.budget.reflectionSize ?? 0;
  const root = useRef<Group>(null), tick = useRef(0), valid = useRef(false);
  const forest = useMemo(() => {
    const trunks: DressingForm[] = [], crowns: DressingForm[] = [];
    for (let i = 0; i < 18; i++) {
      const side = i % 2 ? 1 : -1, row = Math.floor(i / 2);
      const x = side * (1.6 + row % 3 * 1.3), z = row * 2.8;
      const height = 4.1 + row % 3 * .4;
      trunks.push({ position: [x, height / 2, z], scale: [.42, height, .46], rotation: [.025 * side, i, .04 * side] });
      crowns.push({ position: [x, height, z], scale: [1.15, .75, 1.25], rotation: [0, i, .04] });
    }
    return { trunks, crowns };
  }, []);
  const resources = useMemo(() => {
    if (!resolution) return null;
    const scene = new Scene(); scene.background = new Color("#081216"); scene.fog = new FogExp2("#101e23", .025);
    const target = new WebGLRenderTarget(resolution, resolution, { type: HalfFloatType, depthBuffer: true });
    target.texture.name = "bounded-underfloor-world";
    return { scene, target };
  }, [resolution]);
  useEffect(() => { valid.current = false; return () => { resources?.target.dispose(); }; }, [resources]);
  useFrame(({ gl, camera }) => {
    if (!resources || !root.current || !surface.current || stage < 1 || document.hidden) return;
    if (tick.current++ % (presentation?.look.budget.reflectionEveryFrames ?? 2) !== 0 && valid.current) return;
    surface.current.parent?.updateWorldMatrix(true, false);
    root.current.matrix.copy(surface.current.parent?.matrixWorld ?? surface.current.matrixWorld);
    root.current.matrixWorldNeedsUpdate = true;
    if (!gl.extensions.has("EXT_color_buffer_float")) resources.target.texture.type = UnsignedByteType;
    const previous = gl.getRenderTarget(), xr = gl.xr.enabled, shadows = gl.shadowMap.autoUpdate;
    try { gl.xr.enabled = false; gl.shadowMap.autoUpdate = false; gl.setRenderTarget(resources.target); gl.clear(); gl.render(resources.scene, camera); valid.current = true; }
    finally { gl.setRenderTarget(previous); gl.xr.enabled = xr; gl.shadowMap.autoUpdate = shadows; }
  }, -.5);
  const portal = resources ? createPortal(<group ref={root} matrixAutoUpdate={false} name="underfloor-parallax-volume">
    <group position={[0, -7, 1]}>
      <Forms name="underfloor-depth-trunks" forms={forest.trunks} kind="tree" surface="bark" color="#45554d" />
      <Forms name="underfloor-depth-canopy" forms={forest.crowns} kind="crown" color="#3c5147" />
      <SceneGround radius={38} y={-.3} color="#24352b" />
      <LanternProp position={[0, 1.4, 12]} scale={.8} reducedMotion />
      <hemisphereLight args={["#a5c1cd", "#1a2724", 1.1]} />
      <pointLight position={[-4, 5.5, 6]} color="#94b1c0" intensity={18} distance={28} />
    </group>
  </group>, resources.scene) : null;
  return { texture: resources?.target.texture, valid, portal };
}
