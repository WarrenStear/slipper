import { memo, useEffect, useMemo } from "react";
import * as THREE from "three";
import { TactileMaterial, useTactileDetail } from "../storyEvents/TactileMaterial";
import { createFlameGeometry, createLeafGeometry, createSectionGeometry, createTaperedBranchGeometry, createWaxCandleGeometry, mergeArtGeometries } from "./authoredGeometry.ts";
import { createNestGeometries, createSeedGeometry } from "./heroGeometry.ts";

export const PerchedStoryBird = memo(function PerchedStoryBird() {
  const geometry = useMemo(() => {
    const body = createSectionGeometry([[-.1, 0, 0, 0], [-.06, .11, .21, 0], [.04, .12, .2, 0], [.13, .07, .12, .11], [.21, .062, .07, .19], [.25, 0, 0, .18]], 10);
    const parts = [body];
    for (const side of [-1, 1]) { const wing = createLeafGeometry(.32, .09, .025); wing.rotateY(Math.PI + side * .2); wing.rotateZ(side * .6); wing.translate(side * .08, .05, .05); parts.push(wing); }
    return mergeArtGeometries(parts);
  }, []);
  useEffect(() => () => geometry.dispose(), [geometry]);
  return <mesh name="perched-story-bird" geometry={geometry}><TactileMaterial surface="velvet" color="#252e2b" side={THREE.DoubleSide} /></mesh>;
});

export const WovenNest = memo(function WovenNest() {
  const detail = useTactileDetail();
  const shapes = useMemo(() => createNestGeometries(detail), [detail]);
  useEffect(() => () => { shapes.outer.dispose(); shapes.inner.dispose(); }, [shapes]);
  return <group name="woven-memory-nest"><mesh geometry={shapes.outer}><TactileMaterial surface="bark" color="#7c6550" /></mesh><mesh geometry={shapes.inner}><TactileMaterial surface="linen" color="#b09b7e" side={THREE.DoubleSide} /></mesh></group>;
});

export const AuthoredCandle = memo(function AuthoredCandle({ lit = false, color = "#d5cdbd" }: { lit?: boolean; color?: string }) {
  const shapes = useMemo(() => ({ wax: createWaxCandleGeometry(.085, .4, 8), flame: createFlameGeometry(.035, .16) }), []);
  useEffect(() => () => { shapes.wax.dispose(); shapes.flame.dispose(); }, [shapes]);
  return <group name="melted-wax-memory-candle"><mesh geometry={shapes.wax} position={[0, .2, 0]}><TactileMaterial surface="wax" color={color} roughness={.74} /></mesh>{lit ? <mesh geometry={shapes.flame} position={[0, .46, 0]}><meshBasicMaterial color="#ffe0a1" /></mesh> : null}</group>;
});

export const StorySeed = memo(function StorySeed({ grown = false }: { grown?: boolean }) {
  const shapes = useMemo(() => {
    const seed = createSeedGeometry(), pieces = [createTaperedBranchGeometry([[0, 0, 0], [-.014, .35, 0], [.02, .65, .01]], .018, 13)];
    for (let i = 0; i < 2; i++) { const leaf = createLeafGeometry(.26, .07, .04); leaf.rotateY(i * 2.7 + .8); leaf.rotateX(-.55); leaf.translate(0, .45 + i * .12, 0); pieces.push(leaf); }
    return { seed, sprout: mergeArtGeometries(pieces) };
  }, []);
  useEffect(() => () => { shapes.seed.dispose(); shapes.sprout.dispose(); }, [shapes]);
  return <group name="authored-living-seed"><mesh geometry={shapes.seed}><TactileMaterial surface="wood" color="#826243" /></mesh>{grown ? <mesh geometry={shapes.sprout}><TactileMaterial surface="linen" color="#768368" side={THREE.DoubleSide} /></mesh> : null}</group>;
});
