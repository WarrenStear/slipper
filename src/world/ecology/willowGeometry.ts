import * as THREE from "three";
import { artNoise, createTaperedBranchGeometry, mergeArtGeometries, type ArtVec3 } from "../../components/three/environmentArt/authoredGeometry.ts";
import { terrainCurvedPathPointAt, type TerrainMorphState } from "../../lib/terrainModel.ts";
import { explorationPaths, WILLOW_POOL } from "../terrain/explorationLayout.ts";
import { TERRAIN_BASE_Y } from "../terrain/worldConstants.ts";
import { createFernGeometry, createRushGeometry } from "../../components/three/environmentArt/woodlandHabitatGeometry.ts";

export function createWillowUnderstory(quality: string, ground: (x: number, z: number) => number) {
  const detailed = quality === "high" || quality === "cinematic", pieces: THREE.BufferGeometry[] = [];
  const fern = createFernGeometry(detailed), rush = createRushGeometry();
  for (let i = 0; i < (detailed ? 38 : 18); i++) {
    const a = i * 2.39996, isFern = i % 2 === 0;
    const r = isFern ? 3.5 + artNoise(19, i) * 2.5 : 6.5 + artNoise(31, i) * 1.5;
    const x = (isFern ? -53 : WILLOW_POOL.x) + Math.cos(a) * r;
    const z = (isFern ? -320 : WILLOW_POOL.z) + Math.sin(a) * r * (isFern ? 1 : .7);
    const scale = .65 + artNoise(48, i) * .7;
    const plant = (isFern ? fern : rush).clone().scale(scale, scale, scale).rotateY(a);
    plant.translate(x, ground(x, z), z); pieces.push(plant);
  }
  fern.dispose(); rush.dispose();
  return mergeArtGeometries(pieces);
}

/** Flat water meets the actual quantized terrain surface, including at low quality. */
export function createWillowPoolGeometry(ground: (x: number, z: number) => number) {
  const positions = [0, 0, 0], uvs = [.5, .5], indices: number[] = [], segments = 64;
  const waterY = TERRAIN_BASE_Y + WILLOW_POOL.surfaceOffset;
  for (let i = 0; i <= segments; i++) {
    const a = i / segments * Math.PI * 2;
    let lo = 0, hi = 16;
    for (let n = 0; n < 18; n++) {
      const r = (lo + hi) / 2;
      if (ground(WILLOW_POOL.x + Math.cos(a) * r, WILLOW_POOL.z + Math.sin(a) * r) < waterY) lo = r; else hi = r;
    }
    const x = Math.cos(a) * lo, z = Math.sin(a) * lo;
    positions.push(x, -z, 0); uvs.push(.5 + x / 22, .5 - z / 22);
    if (i < segments) indices.push(0, i + 2, i + 1);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices); geometry.computeVertexNormals(); geometry.computeBoundingSphere();
  return geometry;
}

/** Authored asymmetry: a leaning, split trunk, low sheltering arms and exposed roots. */
export function createWillowGeometry(quality: string, ground: (x: number, z: number) => number) {
  const detailed = quality === "high" || quality === "cinematic";
  const wood: THREE.BufferGeometry[] = [];
  wood.push(createTaperedBranchGeometry([[0, -.22, 0], [.35, 1.4, -.15], [1.05, 3.5, -.35], [.35, 6.7, -.25], [-1.4, 8.1, -.2]], 1.08, 41, 14, 30));
  wood.push(createTaperedBranchGeometry([[.3, 1.2, -.08], [1.2, 2.8, .12], [2.25, 4.9, .9], [4.5, 6.2, 1.5], [6.6, 5.3, 2.3]], .74, 43, 12, 26));
  for (let i = 0; i < 11; i++) {
    const angle = i * 2.39996, length = 2.8 + artNoise(56, i) * 2.5;
    const x = Math.cos(angle) * length, z = Math.sin(angle) * length;
    wood.push(createTaperedBranchGeometry([[.1, .7, 0], [x * .25, .5, z * .25], [x * .65, ground(x * .65, z * .65) + .13, z * .65], [x, ground(x, z) + .02, z]], .36, i, 7, 14));
  }
  const positions: number[] = [], indices: number[] = [], colors: number[] = [];
  const addLeaf = (x: number, y: number, z: number, angle: number, seed: number) => {
    const length = .26 + artNoise(seed, 4) * .25, width = .042 + artNoise(seed, 5) * .021;
    const dx = Math.cos(angle) * width, dz = Math.sin(angle) * width, base = positions.length / 3;
    positions.push(x, y, z, x + dx, y - length * .48, z + dz, x + dx * .8, y - length, z + dz * .8, x - dx, y - length * .48, z - dz);
    indices.push(base, base + 1, base + 2, base, base + 2, base + 3);
    const variation = .65 + artNoise(seed, 9) * .35;
    for (let j = 0; j < 4; j++) colors.push(variation, Math.min(1, variation * 1.07), variation * .82);
  };
  const arms = 13, strands = detailed ? 17 : 8, pairs = detailed ? 24 : 15;
  for (let arm = 0; arm < arms; arm++) {
    const a = arm * 2.39996, r = 4.7 + artNoise(97, arm) * 2.5;
    const tip: ArtVec3 = [Math.cos(a) * r + .5, 5.6 + artNoise(9, arm) * 1.8, Math.sin(a) * r];
    wood.push(createTaperedBranchGeometry([[.5, 3.1, 0], [tip[0] * .46, 6.7, tip[2] * .48], tip], .3, arm, 7, 16));
    for (let strand = 0; strand < strands; strand++) {
      const seed = arm * 53 + strand, f = .5 + strand / strands * .55;
      const x = tip[0] * f + (artNoise(82, seed) - .5) * 1.2, z = tip[2] * f + (artNoise(64, seed) - .5) * 1.2;
      const y = tip[1] + Math.sin(f * Math.PI) * .9, length = 2.6 + artNoise(5, seed) * 2.5;
      wood.push(createTaperedBranchGeometry([[x, y, z], [x + .32, y - length * .45, z + .18], [x + .12, y - length, z + .4]], .014, seed, 3, 6));
      for (let pair = 0; pair < pairs; pair++) {
        const t = pair / pairs;
        addLeaf(x + Math.sin(t * Math.PI) * .32, y - length * t, z + t * .4, a + pair * 2.39996, seed * 23 + pair);
        if (detailed) addLeaf(x + Math.sin(t * Math.PI) * .32 + .09, y - length * t + .08, z + t * .4 - .08, a + pair * 2.39996 + Math.PI, seed * 31 + pair);
      }
    }
  }
  const leaves = new THREE.BufferGeometry();
  leaves.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  leaves.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
  leaves.setIndex(indices); leaves.computeVertexNormals(); leaves.computeBoundingSphere();
  return { wood: mergeArtGeometries(wood), leaves };
}

/** Rendered path, forest exclusion, controller and terrain triangles share these seeds. */
export function createExplorationPathGeometry(sampleGroundY: (x: number, z: number) => number, morph: TerrainMorphState) {
  const positions: number[] = [], indices: number[] = [], colors: number[] = [];
  for (const path of explorationPaths()) {
    const base = positions.length / 3, steps = Math.ceil(path.curveLength * 2);
    for (let i = 0; i <= steps; i++) {
      const t = i / steps, p = terrainCurvedPathPointAt(path, t, morph);
      const next = terrainCurvedPathPointAt(path, Math.min(1, t + .001), morph), prev = terrainCurvedPathPointAt(path, Math.max(0, t - .001), morph);
      const dx = next[0] - prev[0], dz = next[1] - prev[1], length = Math.hypot(dx, dz) || 1;
      const width = 1.4 + Math.sin(t * Math.PI * 4) * .13;
      for (const side of [-1, 0, 1]) {
        const x = p[0] - dz / length * side * width, z = p[1] + dx / length * side * width;
        positions.push(x, sampleGroundY(x, z) + .025, z);
        const shade = side === 0 ? .73 : .91;
        colors.push(shade * .91, shade, shade * .73);
      }
      if (i < steps) for (let col = 0; col < 2; col++) {
        const a = base + i * 3 + col; indices.push(a, a + 3, a + 1, a + 1, a + 3, a + 4);
      }
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
  geometry.setIndex(indices); geometry.computeVertexNormals(); geometry.computeBoundingSphere();
  return geometry;
}
