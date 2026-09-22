import { memo, useEffect, useMemo } from "react";
import * as THREE from "three";
import { makeStorySheet, paperBirdPositions, type SheetKind } from "./visualGeometry";
import { TactileMaterial } from "./TactileMaterial";
import { BotanicalCluster } from "../environmentArt/EnvironmentArt";
import { createChairGeometry } from "../environmentArt/heroGeometry.ts";
import { createWornTimberGeometry, mergeArtGeometries } from "../environmentArt/authoredGeometry.ts";

function useSheet(kind: SheetKind) {
  const geometry = useMemo(() => {
    const data = makeStorySheet(kind);
    const result = new THREE.BufferGeometry();
    result.setAttribute("position", new THREE.Float32BufferAttribute(data.positions, 3));
    result.setAttribute("uv", new THREE.Float32BufferAttribute(data.uvs, 2));
    result.setIndex(data.indices); result.computeVertexNormals();
    return result;
  }, [kind]);
  useEffect(() => () => geometry.dispose(), [geometry]);
  return geometry;
}

export const MemoryRose = memo(function MemoryRose({ burnt = false }: { burnt?: boolean }) {
  return <group name="tactile-memory-rose"><BotanicalCluster kind="rose" position={[0, 0, 0]} burnt={burnt} /></group>;
});

export const MemoryFeather = memo(function MemoryFeather({ burnt = false }: { burnt?: boolean }) {
  const vane = useSheet("feather");
  const barbs = useMemo(() => {
    const points: number[] = [];
    for (let i = 1; i < 17; i++) {
      const v = i / 18, z = (v - .5) * .68, width = (.012 + .20 * Math.pow(Math.sin(Math.PI * v), .9)) * .46;
      for (const direction of [-1, 1]) points.push(0, .022, z, direction * width * (direction < 0 ? .78 : 1), .021, z - .025);
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.Float32BufferAttribute(points, 3)); return geometry;
  }, []);
  useEffect(() => () => barbs.dispose(), [barbs]);
  return <group name="tactile-swan-feather" rotation={[-Math.PI / 2, 0, .4]}>
    <mesh geometry={vane}><TactileMaterial surface="paper" color={burnt ? "#342b26" : "#dfddd2"} side={THREE.DoubleSide} /></mesh>
    <mesh position={[0, .017, -.01]} rotation={[Math.PI / 2, 0, 0]}><cylinderGeometry args={[.003, .008, .79, 6]} /><meshStandardMaterial color={burnt ? "#2a231e" : "#c8bea9"} roughness={.78} /></mesh>
    <lineSegments geometry={barbs}><lineBasicMaterial color={burnt ? "#30261f" : "#b7b4a7"} transparent opacity={.35} /></lineSegments>
  </group>;
});

export const FoldedPaperBird = memo(function FoldedPaperBird({ burnt = false }: { burnt?: boolean }) {
  const geometry = useMemo(() => {
    const result = new THREE.BufferGeometry();
    result.setAttribute("position", new THREE.Float32BufferAttribute(paperBirdPositions(), 3));
    result.computeVertexNormals(); return result;
  }, []);
  useEffect(() => () => geometry.dispose(), [geometry]);
  return <group name="tactile-folded-paper-bird">
    <mesh geometry={geometry}><TactileMaterial surface="paper" color={burnt ? "#382e27" : "#dcd4c3"} roughness={.97} side={THREE.DoubleSide} /></mesh>
  </group>;
});

export const StoryLinen = memo(function StoryLinen({ burnt = false }: { burnt?: boolean }) {
  const sheet = useSheet("cloth");
  return <group name="tactile-folded-linen" rotation={[0, .14, 0]}>
    <mesh geometry={sheet}><TactileMaterial surface="linen" color={burnt ? "#332a24" : "#ded9ca"} roughness={.99} side={THREE.DoubleSide} /></mesh>
    <mesh geometry={sheet} position={[.022, .022, .014]} rotation={[0, -.06, 0]} scale={[.95, .7, .9]}><TactileMaterial surface="linen" color={burnt ? "#332a24" : "#e8e1d2"} roughness={.99} side={THREE.DoubleSide} /></mesh>
  </group>;
});

export const StoryPaper = memo(function StoryPaper({ letter = false, burnt = false }: { letter?: boolean; burnt?: boolean }) {
  const sheet = useSheet("paper");
  return <group name={letter ? "tactile-folded-letter" : "tactile-memory-page"} rotation={[0, .14, 0]}>
    <mesh geometry={sheet}><TactileMaterial surface="paper" color={burnt ? "#3a3027" : "#d8cfbc"} roughness={.97} side={THREE.DoubleSide} /></mesh>
    {letter ? <>
      <mesh position={[0, .008, .015]} rotation={[-Math.PI / 2, 0, Math.PI]}><circleGeometry args={[.21, 3]} /><TactileMaterial surface="paper" color={burnt ? "#312820" : "#e2d7c2"} side={THREE.DoubleSide} /></mesh>
      <mesh position={[0, .017, .03]} rotation={[-Math.PI / 2, 0, 0]}><circleGeometry args={[.033, 14]} /><meshStandardMaterial color={burnt ? "#30251f" : "#754d4a"} roughness={.65} /></mesh>
    </> : null}
  </group>;
});

export const ClothboundBook = memo(function ClothboundBook({ open = false, burnt = false }: { open?: boolean; burnt?: boolean }) {
  const cover = burnt ? "#312720" : "#534340";
  const shapes = useMemo(() => {
    const lower = createWornTimberGeometry([.68, .016, .45], 19); lower.translate(0, .003, 0);
    const spine = createWornTimberGeometry([.025, .087, .45], 3); spine.translate(-.327, .043, 0);
    const pages = createWornTimberGeometry([.61, .064, .405], 11); pages.translate(0, .042, 0);
    const lid = createWornTimberGeometry([.68, .016, .45], 23); lid.translate(.327, 0, 0);
    const inlay: THREE.BufferGeometry[] = [];
    for (const z of [-.16, .16]) { const piece = createWornTimberGeometry([.51, .0015, .003], 3); piece.translate(.327, .009, z); inlay.push(piece); }
    for (const x of [.073, .581]) { const piece = createWornTimberGeometry([.003, .0015, .32], 4); piece.translate(x, .009, 0); inlay.push(piece); }
    return { lower: mergeArtGeometries([lower, spine]), pages, lid, inlay: mergeArtGeometries(inlay) };
  }, []);
  useEffect(() => () => { for (const geometry of Object.values(shapes)) geometry.dispose(); }, [shapes]);
  return <group name="tactile-clothbound-book" rotation={[0, .14, 0]}>
    <mesh geometry={shapes.pages}><TactileMaterial surface="paper" color={burnt ? "#382e26" : "#cfc5b1"} roughness={1} /></mesh>
    <mesh geometry={shapes.lower}><TactileMaterial surface="linen" color={cover} /></mesh>
    <group position={[-.327, .086, 0]} rotation={[0, 0, open ? 2.65 : 0]}>
      <mesh geometry={shapes.lid}><TactileMaterial surface="linen" color={cover} /></mesh>
      <mesh geometry={shapes.inlay}><TactileMaterial surface="metal" color={burnt ? cover : "#a38c67"} metalness={.35} roughness={.65} /></mesh>
    </group>
    <mesh position={[.20, .034, -.239]}><boxGeometry args={[.03, .004, .064]} /><TactileMaterial surface="linen" color={burnt ? cover : "#956c63"} /></mesh>
  </group>;
});

export const DomesticChair = memo(function DomesticChair() {
  const geometry = useMemo(() => createChairGeometry(), []);
  useEffect(() => () => geometry.dispose(), [geometry]);
  return <group name="tactile-domestic-chair"><mesh geometry={geometry} receiveShadow><TactileMaterial surface="wood" color="#695442" roughness={.8} /></mesh></group>;
});
