import * as THREE from "three";
import { artNoise, createLeafGeometry, createTaperedBranchGeometry, mergeArtGeometries, type ArtVec3 } from "./authoredGeometry.ts";

/** Four triangular faces meet at a raised vein; no transparent billboard cards. */
function pinnule(base: THREE.Vector3, tip: THREE.Vector3, width: number) {
  const cross = new THREE.Vector3().subVectors(tip, base).cross(new THREE.Vector3(0, 1, 0)).normalize().multiplyScalar(width);
  const middle = base.clone().lerp(tip, .46), ridge = middle.clone(); ridge.y += width * .27;
  const points = [base, middle.clone().add(cross), tip, middle.clone().sub(cross), ridge];
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(points.flatMap(p => p.toArray()), 3));
  geometry.setAttribute("uv", new THREE.Float32BufferAttribute([.5, 0, 0, .46, .5, 1, 1, .46, .5, .46], 2));
  geometry.setIndex([0, 4, 1, 1, 4, 2, 2, 4, 3, 3, 4, 0]);
  geometry.computeVertexNormals(); return geometry;
}

/** One shared fern geometry: 270 / 530 triangles, not an object per leaflet. */
export function createFernGeometry(relief = false) {
  const pieces: THREE.BufferGeometry[] = [], fronds = relief ? 5 : 3, pairs = relief ? 7 : 5;
  for (let f = 0; f < fronds; f++) {
    const angle = f * 2.39996 + .32, length = .86 + artNoise(14, f) * .35;
    const point = (t: number) => new THREE.Vector3(Math.sin(angle) * t * length, Math.sin(t * Math.PI * .83) * .64 * length, Math.cos(angle) * t * length);
    pieces.push(createTaperedBranchGeometry([0, .3, .68, 1].map(t => point(t).toArray() as ArtVec3), .009, f, 3, 8));
    for (let pair = 0; pair < pairs; pair++) {
      const t = .16 + pair / pairs * .7, base = point(t), leafLength = (.19 * Math.sin(t * Math.PI) + .025) * length;
      for (const side of [-1, 1]) {
        const tip = point(Math.min(1, t + .12));
        tip.x += Math.cos(angle) * side * leafLength;
        tip.z -= Math.sin(angle) * side * leafLength;
        tip.y += .016;
        pieces.push(pinnule(base, tip, leafLength * .24));
      }
    }
  }
  return mergeArtGeometries(pieces);
}

export function createRushGeometry() {
  const pieces: THREE.BufferGeometry[] = [];
  for (let i = 0; i < 5; i++) {
    const leaf = createLeafGeometry(.8 + artNoise(83, i) * .55, .022, .08, 6);
    leaf.rotateX(-1.18 - i % 2 * .16); leaf.rotateY(i * 2.4);
    leaf.translate(Math.sin(i * 2.4) * .055, 0, Math.cos(i * 2.4) * .055); pieces.push(leaf);
  }
  return mergeArtGeometries(pieces);
}

export function createLeafLitterGeometry() {
  const pieces: THREE.BufferGeometry[] = [];
  for (let i = 0; i < 6; i++) {
    const a = i * 2.4, base = new THREE.Vector3(Math.sin(a) * .22, .01, Math.cos(a) * .22);
    const tip = base.clone().add(new THREE.Vector3(Math.sin(a + .8) * .19, .012, Math.cos(a + .8) * .19));
    pieces.push(pinnule(base, tip, .04));
  }
  return mergeArtGeometries(pieces);
}

export function createDeadwoodGeometry() {
  return mergeArtGeometries([
    createTaperedBranchGeometry([[-.22, .14, -1.1], [.02, .2, -.25], [-.12, .18, .65], [.07, .13, 1.2]], .18, 8, 7, 14),
    createTaperedBranchGeometry([[0, .17, -.15], [-.3, .31, .12], [-.72, .36, .38]], .074, 9, 5, 8),
    createTaperedBranchGeometry([[-.09, .15, .48], [.23, .3, .7], [.55, .34, 1.01]], .054, 10, 5, 8),
  ]);
}

/** An irregular root threshold replaces three visibly concentric torus loops.
 * Its open centre remains at least 3.1m wide, with no new collision or trigger. */
export function createRootThresholdGeometry() {
  return mergeArtGeometries([
    createTaperedBranchGeometry([[-2.8, 0, -.24], [-2.65, 1.4, -.15], [-2.2, 3.1, .15], [-.6, 4, .32], [1.3, 3.8, .1], [2.65, 2.65, -.2]], .36, 18, 9, 24),
    createTaperedBranchGeometry([[2.82, 0, .27], [2.53, 1.05, .1], [2.63, 2.75, -.15], [1.7, 3.6, -.37], [.8, 4.12, -.18]], .32, 19, 8, 20),
    createTaperedBranchGeometry([[-2.7, .04, -.3], [-3.23, .12, -.67], [-3.66, .01, -.9]], .21, 20, 6, 10),
    createTaperedBranchGeometry([[2.79, .03, .23], [3.3, .14, .51], [3.78, .01, .78]], .18, 21, 6, 10),
    createTaperedBranchGeometry([[-2.26, 2.9, .12], [-3.1, 3.67, .25], [-3.74, 3.85, .41]], .14, 22, 6, 12),
  ]);
}
