import * as THREE from "three";
import { terrainCurvedPathPointAt, terrainCurvedPathTangentAt, type TerrainCurveSeed } from "../../../lib/terrainModel.ts";
type Morph = { memoryPressure: number; explorationDepth: number };

/** The ribbon samples the same curved route and triangulated ground as collision. */
export function createPhysicalPathGeometry(curve: TerrainCurveSeed, morph: Morph, sampleGroundY: (x: number, z: number) => number) {
  const count = 49, positions = new Float32Array(count * 6), uvs = new Float32Array(count * 4), indices: number[] = [];
  for (let i = 0; i < count; i++) {
    const t = i / (count - 1), point = terrainCurvedPathPointAt(curve, t, morph), tangent = terrainCurvedPathTangentAt(curve, t, morph);
    const length = Math.max(.0001, Math.hypot(...tangent));
    const width = .88 + Math.sin(t * 23 + curve.curveSeed * 7) * .09 + Math.sin(t * 49) * .025;
    for (let side = 0; side < 2; side++) {
      const offset = width * (side ? 1 : -1), x = point[0] - tangent[1] / length * offset, z = point[1] + tangent[0] / length * offset;
      const vertex = i * 2 + side;
      positions.set([x, sampleGroundY(x, z) + .027, z], vertex * 3);
      uvs.set([side, t], vertex * 2);
    }
    if (i < count - 1) { const left = i * 2; indices.push(left, left + 2, left + 1, left + 1, left + 2, left + 3); }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute("uv", new THREE.BufferAttribute(uvs, 2)); geometry.setIndex(indices);
  geometry.computeVertexNormals(); geometry.computeBoundingBox(); geometry.computeBoundingSphere();
  return geometry;
}
