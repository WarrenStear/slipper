import { memo, useEffect, useMemo } from "react";
import { createForkPath } from "./forkLandscapeGeometry";
import { createTaperedBranchGeometry, mergeArtGeometries } from "../environmentArt/authoredGeometry";
import { Forms } from "./EnvironmentDressing";
import type { DressingForm } from "./chapterEnvironment";
import { BotanicalBatch, type BotanicalPlacement } from "../environmentArt/EnvironmentArt";
import { TactileMaterial } from "../storyEvents/TactileMaterial";

export const ForkLandscape = memo(function ForkLandscape({ overgrown, established, reducedEffects }: { overgrown: boolean; established: boolean; reducedEffects: boolean }) {
  const paths = useMemo(() => [
    createForkPath(false, overgrown ? "#52533f" : "#74634c"),
    createForkPath(true, established ? "#616858" : "#525b4d"),
  ], [overgrown, established]);
  useEffect(() => () => paths.forEach(path => path.dispose()), [paths]);
  const layout = useMemo(() => {
    const trunks: DressingForm[] = [], crowns: DressingForm[] = [], undergrowth: BotanicalPlacement[] = [], grass: BotanicalPlacement[] = [];
    const boughs = [];
    const count = reducedEffects ? 9 : 16;
    for (let i = 0; i < count; i++) {
      const a = -.6 + i / (count - 1) * 3.7;
      const x = -9 + Math.cos(a) * 7, z = 5 + Math.sin(a) * 8, h = 6 + i % 4;
      trunks.push({ position: [x, h / 2, z], scale: [.68, h, .75], rotation: [0, i, .09 * Math.sin(i)] });
      crowns.push({ position: [x + .3, h, z], scale: [2.4, 1.35, 2.6], rotation: [0, i, .08] });
      if (i % 2 === 0) {
        const inward = x < -9 ? 1 : -1;
        boughs.push(createTaperedBranchGeometry([[x, h * .58, z], [x + inward, h * .61, z + .4], [x + inward * 2.6, h * .57, z + 1.2]], .21, i, 6, 10));
      }
    }
    for (let i = 0; i < 16; i++) {
      undergrowth.push({ position: [-4 - i % 4 * 1.7, .02, -2 + Math.floor(i / 4) * 2.7], scale: .7 + (i % 3) * .14, rotation: [0, i * 2.4, 0] });

    }
    // Uneven swathes keep the future legible as exposed ground, not a planted grid.
    const grassCount = reducedEffects ? 12 : 30;
    for (let i = 0; i < grassCount; i++) {
      const t = i / grassCount, side = i % 2 ? 1 : -1;
      grass.push({ position: [3.5 + t * 11 + side * (2.5 + Math.sin(i * 2.1) * 1.2), .02, -2 + t * 34 + Math.cos(i * 2.7)], scale: [.8, .5 + (i % 4) * .13, .8], rotation: [0, i * 2.4, -.09] });
    }
    return { trunks, crowns, undergrowth, grass, boughs: mergeArtGeometries(boughs) };
  }, [reducedEffects]);
  useEffect(() => () => layout.boughs.dispose(), [layout]);
  return <group name="fork-asymmetric-landscape" userData={{ familiarRoute: "folds-back-enclosed", futureRoute: "narrows-to-open-horizon" }}>
    <mesh name="fork-past-path" geometry={paths[0]} receiveShadow userData={{ memoryStage: overgrown ? "partially-overgrown" : "open" }}><TactileMaterial surface="earth" color="#ffffff" vertexColors /></mesh>
    <mesh name="fork-future-path" geometry={paths[1]} receiveShadow userData={{ memoryStage: established ? "established" : "uncertain" }}><TactileMaterial surface="earth" color="#ffffff" vertexColors /></mesh>
    <Forms name="familiar-path-enclosing-trunks" forms={layout.trunks} kind="tree" surface="bark" color="#443b2b" />
    <mesh name="familiar-path-overhead-boughs" geometry={layout.boughs} receiveShadow><TactileMaterial surface="bark" color="#574b38" /></mesh>
    <Forms name="familiar-path-low-canopy" forms={layout.crowns} kind="crown" color="#424d36" />
    {overgrown ? <group name="fork-past-path-overgrowth"><BotanicalBatch kind="reeds" placements={layout.undergrowth} mergeFoliage /></group> : null}
    <group name="fork-future-path-established"><BotanicalBatch kind="reeds" placements={layout.grass} mergeFoliage /></group>
  </group>;
});
