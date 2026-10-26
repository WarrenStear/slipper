import { memo, useEffect, useMemo } from "react";
import { WoodlandSurfaceMaterial } from "../environment/WoodlandSurfaceMaterial";
import { FoliageMaterial } from "../environment/FoliageMaterial";
import { createMossStoneGeometry } from "../environmentArt/woodlandAccentsGeometry";
import { createRushGeometry } from "../environmentArt/woodlandHabitatGeometry";
import { artNoise, mergeArtGeometries } from "../environmentArt/authoredGeometry";
import { createSanctuaryShorelineGeometry } from "./sanctuaryShorelineGeometry";

/** Three bounded opaque batches. The centre and bridge landings remain clear. */
export const SanctuaryShoreline = memo(function SanctuaryShoreline() {
  const geometry = useMemo(createSanctuaryShorelineGeometry, []);
  const dressing = useMemo(() => {
    const stone = createMossStoneGeometry(), rush = createRushGeometry();
    const rocks = [], plants = [];
    for (let i = 0; i < 40; i++) {
      const side = i % 2 ? 1 : -1, x = side * (10.05 + artNoise(43, i) * 1.1), z = -7 + artNoise(58, i) * 14;
      const scale = .13 + artNoise(69, i) ** 2 * .52;
      rocks.push(stone.clone().scale(scale * 1.3, scale * .65, scale).rotateY(i * 2.4).translate(x, -.055, z));
      const size = .5 + artNoise(91, i) * .8;
      plants.push(rush.clone().scale(size, size, size).rotateY(i * 1.7).translate(side * (10.7 + artNoise(11, i) * .7), -.1, z));
    }
    const gravel = createMossStoneGeometry(0);
    for (let i = 0; i < 96; i++) {
      const side = i % 4, along = (artNoise(114, i) * 2 - 1) * (side < 2 ? 8 : 10.4);
      // Small gravel gathers on both margins, leaving the bridge landings open.
      if (side >= 2 && Math.abs(along) < 2) continue;
      const across = (side < 2 ? 9.9 : 7.8) + artNoise(117, i) * .9;
      const x = side < 2 ? (side === 0 ? -across : across) : along;
      const z = side < 2 ? along : (side === 2 ? -across : across);
      const scale = .035 + artNoise(121, i) * .095;
      rocks.push(gravel.clone().scale(scale * 1.4, scale * .65, scale).rotateY(i * 2.4).translate(x, -.012, z));
    }
    stone.dispose(); gravel.dispose(); rush.dispose();
    return { rocks: mergeArtGeometries(rocks), plants: mergeArtGeometries(plants) };
  }, []);
  useEffect(() => () => { geometry.dispose(); dressing.rocks.dispose(); dressing.plants.dispose(); }, [geometry, dressing]);
  return <group name="sanctuary-planted-waterline">
    <mesh name="sanctuary-sediment-waterline" geometry={geometry} receiveShadow><WoodlandSurfaceMaterial surface="soil" /></mesh>
    <mesh name="sanctuary-waterworn-stones" geometry={dressing.rocks} receiveShadow><WoodlandSurfaceMaterial surface="stone" /></mesh>
    <mesh name="sanctuary-bank-sedges" geometry={dressing.plants} receiveShadow><FoliageMaterial color="#7a9167" doubleSided /></mesh>
  </group>;
});
