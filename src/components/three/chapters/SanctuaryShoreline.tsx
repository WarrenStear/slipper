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
    stone.dispose(); rush.dispose();
    return { rocks: mergeArtGeometries(rocks), plants: mergeArtGeometries(plants) };
  }, []);
  useEffect(() => () => { geometry.dispose(); dressing.rocks.dispose(); dressing.plants.dispose(); }, [geometry, dressing]);
  return <group name="sanctuary-planted-waterline">
    <mesh name="sanctuary-sediment-waterline" geometry={geometry} receiveShadow><WoodlandSurfaceMaterial surface="soil" /></mesh>
    <mesh name="sanctuary-waterworn-stones" geometry={dressing.rocks} receiveShadow><WoodlandSurfaceMaterial surface="stone" /></mesh>
    <mesh name="sanctuary-bank-sedges" geometry={dressing.plants} receiveShadow><FoliageMaterial color="#7a9167" doubleSided /></mesh>
  </group>;
});
