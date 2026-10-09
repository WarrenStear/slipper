import type { BufferGeometry, Matrix4 } from "three";
import { TERRAIN_SIZE } from "../../../world/terrain/worldConstants.ts";

/** A far trunk may sample height outside the ground mesh, but cannot root there. */
export function distantTrunkFitsTerrain(geometry: BufferGeometry, matrix: Matrix4): boolean {
  const positions = geometry.getAttribute("position");
  const half = TERRAIN_SIZE * .5, elements = matrix.elements;
  let rootY = Infinity;
  for (let i = 0; i < positions.count; i++) rootY = Math.min(rootY, positions.getY(i));
  for (let i = 0; i < positions.count; i++) {
    if (positions.getY(i) !== rootY) continue;
    const x = positions.getX(i), z = positions.getZ(i);
    const worldX = elements[0] * x + elements[4] * rootY + elements[8] * z + elements[12];
    const worldZ = elements[2] * x + elements[6] * rootY + elements[10] * z + elements[14];
    if (Math.abs(worldX) > half || Math.abs(worldZ) > half) return false;
  }
  return true;
}
