import * as THREE from "three";
import { artNoise, createSweptGeometry, createTaperedBranchGeometry, mergeArtGeometries, type ArtVec3 } from "../../components/three/environmentArt/authoredGeometry.ts";
import { terrainCurvedPathPointAt, type TerrainMorphState } from "../../lib/terrainModel.ts";
import { explorationPaths, WILLOW_POOL } from "../terrain/explorationLayout.ts";
import { createMossStoneGeometry } from "../../components/three/environmentArt/woodlandAccentsGeometry.ts";
import { TERRAIN_BASE_Y } from "../terrain/worldConstants.ts";
import { createFernGeometry, createRushGeometry, rootedBarkUv } from "../../components/three/environmentArt/woodlandHabitatGeometry.ts";

export function createWillowUnderstory(quality: string, ground: (x: number, z: number) => number) {
  const detailed = quality === "high" || quality === "cinematic", pieces: THREE.BufferGeometry[] = [];
  const fern = createFernGeometry(detailed), rush = createRushGeometry();
  for (let i = 0; i < (detailed ? 104 : 52); i++) {
    const a = i * 2.39996, isFern = i % 2 === 0;
    const r = isFern ? 2.8 + artNoise(19, i) * 8 : 6.5 + artNoise(31, i) * 2;
    const x = (isFern ? -53 : WILLOW_POOL.x) + Math.cos(a) * r;
    const z = (isFern ? -320 : WILLOW_POOL.z) + Math.sin(a) * r * (isFern ? 1 : .7);
    // Leave the approach/return corridors open and keep ferns above the pool.
    if (isFern && (Math.abs(x + 53) < 2 || (x > -53 && Math.abs(z + 320) < 2) || ground(x, z) < TERRAIN_BASE_Y - .12)) continue;
    const scale = .7 + artNoise(48, i) * .85;
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

/** Branchlets grow from sampled boughs. Both tiers keep the same asymmetric
 * shelter silhouette; low uses fewer leaf pairs, never a bare scaffold. */
export function createWillowGeometry(quality: string, ground: (x: number, z: number) => number) {
  const detailed = quality === "high" || quality === "cinematic";
  const wood: THREE.BufferGeometry[] = [];
  const branch = (points: ArtVec3[], radius: number, seed: number, sides = 5, segments = 10) =>
    wood.push(rootedBarkUv(createTaperedBranchGeometry(points, radius, seed, sides, segments)));
  wood.push(rootedBarkUv(createSweptGeometry([[0, -.22, 0], [.25, 1.4, -.12], [.85, 3.3, -.3], [.3, 5.1, -.25], [-1.25, 6.3, -.5]], [1.08, .92, .72, .43, .1], 14, 28)));
  wood.push(rootedBarkUv(createSweptGeometry([[.25, 1.2, -.08], [1.15, 2.8, .12], [2.4, 4.5, .9], [4.3, 5.7, 1.5], [6.2, 5.2, 2.3]], [.7, .58, .37, .19, .035], 12, 24)));
  for (let i = 0; i < 11; i++) {
    const a = i * 2.39996, length = 2.8 + artNoise(56, i) * 2.5;
    const x = Math.cos(a) * length, z = Math.sin(a) * length;
    branch([[.1, .7, 0], [x * .25, .35, z * .25], [x * .65, ground(x * .65, z * .65) + .09, z * .65], [x, ground(x, z) - .03, z]], .36, i, 7, 14);
  }
  const positions: number[] = [], indices: number[] = [], colors: number[] = [];
  const addLeaf = (origin: THREE.Vector3, angle: number, seed: number) => {
    const length = .25 + artNoise(seed, 4) * .17, width = .047 + artNoise(seed, 5) * .023;
    const direction = new THREE.Vector3(Math.cos(angle) * .65, -.76, Math.sin(angle) * .65).normalize();
    const across = new THREE.Vector3(-Math.sin(angle), .1, Math.cos(angle)).multiplyScalar(width);
    const middle = origin.clone().addScaledVector(direction, length * .45);
    const tip = origin.clone().addScaledVector(direction, length); tip.y -= .025;
    const base = positions.length / 3;
    for (const p of [origin, middle.clone().add(across), tip, middle.clone().sub(across)]) positions.push(p.x, p.y, p.z);
    indices.push(base, base + 1, base + 2, base, base + 2, base + 3);
    const variation = .68 + artNoise(seed, 9) * .32;
    for (let j = 0; j < 4; j++) colors.push(variation * .91, variation, variation * .72);
  };
  for (let arm = 0; arm < 10; arm++) {
    const a = arm * 2.39996, radius = 5 + artNoise(97, arm) * 2.4;
    const start = new THREE.Vector3(.5, 3.5 + artNoise(33, arm) * 1.5, 0);
    const crest = new THREE.Vector3(Math.cos(a) * radius * .55, 6.8 + artNoise(9, arm) * 1.15, Math.sin(a) * radius * .55);
    const tip = new THREE.Vector3(Math.cos(a) * radius, 5.4 + artNoise(71, arm) * 1.1, Math.sin(a) * radius);
    const bough = new THREE.CatmullRomCurve3([start, crest, tip]);
    branch([start.toArray(), crest.toArray(), tip.toArray()], .24 + artNoise(2, arm) * .1, arm, 7, 18);
    for (let fork = 0; fork < 3; fork++) {
      const anchor = bough.getPoint(.27 + fork * .3), side = fork % 2 ? -1 : 1;
      const end = anchor.clone().add(new THREE.Vector3(Math.cos(a + side * .7) * (1.7 + fork * .22), -.6 - fork * .2, Math.sin(a + side * .7) * (1.7 + fork * .22)));
      const arch = anchor.clone().lerp(end, .45); arch.y += .35;
      const twig = new THREE.CatmullRomCurve3([anchor, arch, end]);
      branch([anchor.toArray(), arch.toArray(), end.toArray()], .065, arm * 3 + fork, 4, 8);
      const strands = detailed ? 8 : 6, pairs = detailed ? 22 : 13;
      for (let strand = 0; strand < strands; strand++) {
        const seed = arm * 307 + fork * 37 + strand;
        const top = twig.getPoint(.12 + strand / strands * .86);
        const length = 1.1 + artNoise(5, seed) * 3.5;
        const drift = new THREE.Vector3(Math.cos(a + strand) * .55, -length, Math.sin(a + strand) * .55);
        const mid = top.clone().addScaledVector(drift, .43); mid.x += .18;
        const bottom = top.clone().add(drift);
        const hanging = new THREE.CatmullRomCurve3([top, mid, bottom]);
        branch([top.toArray(), mid.toArray(), bottom.toArray()], .012, seed, 3, 5);
        for (let pair = 0; pair < pairs; pair++) {
          const t = (pair + .25) / pairs, p = hanging.getPoint(t);
          addLeaf(p, a + pair * 2.39996, seed * 23 + pair);
          addLeaf(p.clone().add(new THREE.Vector3(.025, -.045, -.025)), a + pair * 2.39996 + Math.PI, seed * 31 + pair);
        }
      }
    }
  }
  const leaves = new THREE.BufferGeometry();
  leaves.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  leaves.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
  leaves.setIndex(indices); leaves.computeVertexNormals(); leaves.computeBoundingSphere();
  const bole = mergeArtGeometries(wood), p = bole.getAttribute("position"), tint: number[] = [];
  for (let i = 0; i < p.count; i++) {
    const moss = Math.exp(-Math.max(0, p.getY(i)) * .8) * (.5 + .5 * Math.sin(p.getX(i) * 2 + p.getZ(i)));
    tint.push(1 - moss * .36, 1 - moss * .18, 1 - moss * .4);
  }
  bole.setAttribute("color", new THREE.Float32BufferAttribute(tint, 3));
  return { wood: bole, leaves };
}

/** Low stones sit into the sampled bank, in loose groups instead of a necklace. */
export function createWillowBankStones(quality: string, ground: (x: number, z: number) => number) {
  const source = createMossStoneGeometry(), pieces: THREE.BufferGeometry[] = [];
  const count = quality === "high" || quality === "cinematic" ? 44 : 24;
  const waterY = TERRAIN_BASE_Y + WILLOW_POOL.surfaceOffset;
  for (let i = 0; i < count; i++) {
    const a = i * 2.39996;
    let lo = 0, hi = 16;
    for (let n = 0; n < 18; n++) {
      const r = (lo + hi) / 2;
      if (ground(WILLOW_POOL.x + Math.cos(a) * r, WILLOW_POOL.z + Math.sin(a) * r) < waterY) lo = r; else hi = r;
    }
    const radius = lo + .2 + artNoise(74, i) * 1.1;
    const x = WILLOW_POOL.x + Math.cos(a) * radius, z = WILLOW_POOL.z + Math.sin(a) * radius;
    const size = .15 + artNoise(82, i) ** 2 * .85;
    const stone = source.clone().scale(size * 1.4, size * .65, size).rotateY(a);
    stone.translate(x, ground(x, z) - .08, z); pieces.push(stone);
  }
  source.dispose(); return mergeArtGeometries(pieces);
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
