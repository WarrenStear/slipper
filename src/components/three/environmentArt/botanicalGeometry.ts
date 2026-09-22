import * as THREE from "three";
import { artNoise, createLeafGeometry, createTaperedBranchGeometry, mergeArtGeometries, type ArtDetail } from "./authoredGeometry.ts";
export type BotanicalKind = "rose" | "lily" | "reeds";

export function createBotanicalGeometries(kind: BotanicalKind, seed = 0, detail: ArtDetail = "base") {
  const stems: THREE.BufferGeometry[] = [], leaves: THREE.BufferGeometry[] = [], petals: THREE.BufferGeometry[] = [];
  if (kind === "reeds") {
    const count = detail === "relief" ? 7 : 5;
    for (let index = 0; index < count; index++) {
      const angle = index * 2.4, x = Math.cos(angle) * .10, z = Math.sin(angle) * .10, height = .58 + artNoise(seed, index) * .4;
      stems.push(createTaperedBranchGeometry([[x, 0, z], [x * 1.3, height * .65, z * 1.2], [x * 2, height, z * 2]], .009, seed + index, 4));
      const leaf = createLeafGeometry(height * .75, .025, .04);
      leaf.rotateX(-1.03); leaf.rotateY(angle); leaf.translate(x, height * .16, z); leaves.push(leaf);
    }
  } else {
    const rose = kind === "rose", height = rose ? .435 : .07;
    if (rose) {
      stems.push(createTaperedBranchGeometry([[0, 0, 0], [-.012, .22, .012], [0, height, 0]], .015, seed));
      for (let i = 0; i < 3; i++) { const leaf = createLeafGeometry(.16, .048, .015); leaf.rotateX(-.3); leaf.rotateY(i * 2.4); leaf.translate(0, .13 + i * .075, 0); leaves.push(leaf); }
    } else {
      for (let i = 0; i < 3; i++) { const pad = createLeafGeometry(.45, .24, .012); pad.rotateY(i * 2.4); pad.translate(0, .005 + i * .003, 0); leaves.push(pad); }
    }
    const count = detail === "relief" ? 13 : 9;
    for (let index = 0; index < count; index++) {
      const layer = index < 5 ? 0 : index < 9 ? 1 : 2, size = 1 - layer * .23;
      const petal = createLeafGeometry((rose ? .18 : .25) * size, (rose ? .092 : .055) * size, rose ? .055 : .028);
      petal.rotateX(-.23 - layer * .37); petal.rotateY(index * 2.39996 + seed * .1); petal.translate(0, height + layer * .021, 0); petals.push(petal);
    }
  }
  return { stems: mergeArtGeometries(stems), leaves: mergeArtGeometries(leaves), petals: mergeArtGeometries(petals) };
}
