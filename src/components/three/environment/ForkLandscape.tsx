import { memo, useEffect, useMemo } from "react";
import { BufferGeometry, CatmullRomCurve3, Float32BufferAttribute, Vector3 } from "three";
import { Forms } from "./EnvironmentDressing";
import type { DressingForm } from "./chapterEnvironment";
import { BotanicalBatch, type BotanicalPlacement } from "../environmentArt/EnvironmentArt";
import { TactileMaterial } from "../storyEvents/TactileMaterial";

const PAST = [[0, 0, -6], [-3.5, 0, -1], [-6.5, 0, 5], [-9.5, 0, 9], [-13, 0, 5], [-11, 0, -1]];
const FUTURE = [[0, 0, -6], [3.2, 0, -1], [6.5, 0, 8], [10, 0, 19], [13, 0, 34]];

/** Irregular edges belong to the path geometry; no luminous breadcrumb trail. */
export function createForkPath(future: boolean) {
  const curve = new CatmullRomCurve3((future ? FUTURE : PAST).map(p => new Vector3(...p)));
  const positions: number[] = [], uv: number[] = [], indices: number[] = [];
  for (let i = 0; i <= 48; i++) {
    const t = i / 48, p = curve.getPoint(t), tangent = curve.getTangent(t);
    const width = (future ? 1.12 * (1 - t * .92) : 1.38) * (1 + Math.sin(i * 1.9) * .08);
    for (const side of [-1, 1]) {
      positions.push(p.x + tangent.z * width * side, .017, p.z - tangent.x * width * side);
      uv.push((side + 1) / 2, t * 16);
    }
    if (i < 48) { const k = i * 2; indices.push(k, k + 2, k + 1, k + 1, k + 2, k + 3); }
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new Float32BufferAttribute(positions, 3));
  geometry.setAttribute("uv", new Float32BufferAttribute(uv, 2));
  geometry.setIndex(indices); geometry.computeVertexNormals(); geometry.computeBoundingSphere();
  return geometry;
}

export const ForkLandscape = memo(function ForkLandscape({ overgrown, established, reducedEffects }: { overgrown: boolean; established: boolean; reducedEffects: boolean }) {
  const paths = useMemo(() => [createForkPath(false), createForkPath(true)], []);
  useEffect(() => () => paths.forEach(path => path.dispose()), [paths]);
  const layout = useMemo(() => {
    const trunks: DressingForm[] = [], crowns: DressingForm[] = [], undergrowth: BotanicalPlacement[] = [], grass: BotanicalPlacement[] = [];
    const count = reducedEffects ? 9 : 16;
    for (let i = 0; i < count; i++) {
      const a = -.6 + i / (count - 1) * 3.7;
      const x = -9 + Math.cos(a) * 7, z = 5 + Math.sin(a) * 8, h = 6 + i % 4;
      trunks.push({ position: [x, h / 2, z], scale: [.68, h, .75], rotation: [0, i, .09 * Math.sin(i)] });
      crowns.push({ position: [x + .3, h, z], scale: [2.4, 2, 2.6], rotation: [0, i, .08] });
    }
    for (let i = 0; i < 16; i++) {
      undergrowth.push({ position: [-4 - i % 4 * 1.7, .02, -2 + Math.floor(i / 4) * 2.7], scale: .7 + (i % 3) * .14, rotation: [0, i * 2.4, 0] });
      grass.push({ position: [4.5 + i % 4 * 3.1, .02, 2 + Math.floor(i / 4) * 6], scale: [.6, .35 + i % 3 * .1, .6], rotation: [0, i * 2.4, 0] });
    }
    return { trunks, crowns, undergrowth, grass };
  }, [reducedEffects]);
  return <group name="fork-asymmetric-landscape" userData={{ familiarRoute: "folds-back-enclosed", futureRoute: "narrows-to-open-horizon" }}>
    <mesh name="fork-past-path" geometry={paths[0]} receiveShadow userData={{ memoryStage: overgrown ? "partially-overgrown" : "open" }}><TactileMaterial surface="earth" color={overgrown ? "#52533f" : "#74634c"} /></mesh>
    <mesh name="fork-future-path" geometry={paths[1]} receiveShadow userData={{ memoryStage: established ? "established" : "uncertain" }}><TactileMaterial surface="earth" color={established ? "#727666" : "#5b6153"} /></mesh>
    <Forms name="familiar-path-enclosing-trunks" forms={layout.trunks} kind="tree" surface="bark" color="#443b2b" />
    <Forms name="familiar-path-low-canopy" forms={layout.crowns} kind="crown" color="#424d36" />
    {overgrown ? <group name="fork-past-path-overgrowth"><BotanicalBatch kind="reeds" placements={layout.undergrowth} mergeFoliage /></group> : null}
    <group name="fork-future-path-established"><BotanicalBatch kind="reeds" placements={layout.grass} mergeFoliage /></group>
  </group>;
});
