import { createTaperedBranchGeometry, mergeArtGeometries } from "../../components/three/environmentArt/authoredGeometry.ts";
import type { DressingForm } from "../../components/three/environment/chapterEnvironment";

/** Owns the exact 34 trunks, 30 crowns and single merged six-limb geometry. */
export function createUnderfloorGeometry() {
const trunks: DressingForm[] = [], crowns: DressingForm[] = [];
for (let i = 0; i < 34; i++) {
      const side = i % 2 ? 1 : -1, row = Math.floor(i / 2);
      const x = side * (2.6 + row % 4 * 1.13 + Math.sin(row * 2.7) * .7), z = -2.5 + row * 3.65;
      const height = row < 3 ? 9.8 - row * .5 : 4.8 + row % 5 * .95;
      trunks.push({ position: [x, height / 2, z], scale: [.43 + row % 3 * .19, height, .4 + row % 2 * .16], rotation: [.025 * side, i, .04 * side] });
      if (row > 1) crowns.push({ position: [x + side * 2.5, height - .5, z], scale: [1.1 + row % 3 * .36, 1.2 + row % 2 * .6, 1.5], rotation: [0, i, .04] });
    }
const branches = mergeArtGeometries([
      // Heavy near limbs and much smaller distant limbs make lateral camera
      // parallax legible. They share one mesh and the existing bounded pass.
      createTaperedBranchGeometry([[-3.1,7.5,-2.5],[-2.5,8.8,-.7],[-.9,9.2,.4],[.1,9,1.7]],.34,31),
      createTaperedBranchGeometry([[-2.1,8.9,-.4],[-2.7,9.3,1.1],[-3.5,9.4,2.2]],.14,32),
      createTaperedBranchGeometry([[3.1,7.2,1.2],[2.4,8.2,2.5],[1.4,8.7,3.8],[.6,8.6,4.5]],.29,72),
      createTaperedBranchGeometry([[2.4,8.2,2.5],[3.4,8.8,3.8],[4.3,8.9,4.1]],.12,73),
      createTaperedBranchGeometry([[-7,2,12],[-4,3.5,14],[-2,4.3,15]],.15,13),
      createTaperedBranchGeometry([[4.7,3.8,20],[2.8,4.9,21],[1.8,5.1,22.4]],.12,14),
    ]);
return { trunks, crowns, branches };
}
