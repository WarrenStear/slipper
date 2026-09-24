import { createTaperedBranchGeometry, mergeArtGeometries } from "../environmentArt/authoredGeometry";
import { TactileMaterial } from "../storyEvents/TactileMaterial";
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
    for (let i = 0; i < 34; i++) {
      const side = i % 2 ? 1 : -1, row = Math.floor(i / 2);
      const x = side * (2.6 + row % 4 * 1.13 + Math.sin(row * 2.7) * .7), z = -2.5 + row * 3.65;
      const height = 4.8 + row % 5 * .95;
      trunks.push({ position: [x, height / 2, z], scale: [.43 + row % 3 * .19, height, .4 + row % 2 * .16], rotation: [.025 * side, i, .04 * side] });
      if (row > 1) crowns.push({ position: [x + side * 2.5, height - .5, z], scale: [1.1 + row % 3 * .36, 1.2 + row % 2 * .6, 1.5], rotation: [0, i, .04] });
    }
    const branches = mergeArtGeometries([
      createTaperedBranchGeometry([[-5,6,-2],[-3,7.2,1],[-1.8,7.8,2.4]],.17,31),
      createTaperedBranchGeometry([[5,4,2],[3,5.7,4],[2,6.4,5.2]],.13,72),
      createTaperedBranchGeometry([[-7,2,12],[-4,3.5,14],[-2,4.3,15]],.15,13),
    ]);
    return { trunks, crowns, branches };
  }, []);
  useEffect(() => () => forest.branches.dispose(), [forest]);
  const resources = useMemo(() => {
    if (!resolution) return null;
    const scene = new Scene(); scene.background = new Color("#081216"); scene.fog = new FogExp2("#101e23", .032);
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
    <group position={[0, -11.5, 1]}>
      <Forms name="underfloor-depth-trunks" forms={forest.trunks} kind="tree" surface="bark" color="#7b9183" />
      <Forms name="underfloor-depth-canopy" forms={forest.crowns} kind="crown" color="#506d59" />
      <mesh name="underfloor-near-boughs" geometry={forest.branches}><TactileMaterial surface="bark" color="#2b382f" /></mesh>
      <SceneGround radius={38} y={-.3} color="#4c604d" />
      <LanternProp position={[.2, 2.1, 8]} scale={.72} reducedMotion />
      <hemisphereLight args={["#a5c1cd", "#26372f", 1.15]} />
      <pointLight position={[-4, 5.5, 6]} color="#94b1c0" intensity={31} distance={25} />
    </group>
  </group>, resources.scene) : null;
  return { texture: resources?.target.texture, valid, portal };
}
