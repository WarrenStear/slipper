import * as THREE from "three";
import { artNoise, createLeafGeometry, createSweptGeometry, createTaperedBranchGeometry, mergeArtGeometries, type ArtVec3 } from "./authoredGeometry.ts";

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

/** Retain swept geometry exactly; only give each ring metre-scaled bark UVs.
 * Duplicate the wrap edge so the last face does not stretch across a whole tile. */
function rootedBarkUv(geometry: THREE.BufferGeometry) {
  const p = geometry.getAttribute("position"), uv = geometry.getAttribute("uv");
  const rings = new Map<number, number[]>();
  for (let i = 0; i < p.count; i++) {
    const row = uv.getY(i); if (!rings.has(row)) rings.set(row, []); rings.get(row)!.push(i);
  }
  const metreU = new Float32Array(p.count), metreV = new Float32Array(p.count);
  let distance = 0, previous: THREE.Vector3 | undefined;
  for (const vertices of rings.values()) {
    const centre = new THREE.Vector3();
    vertices.forEach(i => centre.add(new THREE.Vector3(p.getX(i), p.getY(i), p.getZ(i)))); centre.divideScalar(vertices.length);
    if (previous) distance += centre.distanceTo(previous); previous = centre;
    let perimeter = 0;
    for (let j = 0; j < vertices.length; j++) {
      const a = vertices[j], b = vertices[(j + 1) % vertices.length];
      perimeter += Math.hypot(p.getX(b)-p.getX(a),p.getY(b)-p.getY(a),p.getZ(b)-p.getZ(a));
    }
    vertices.forEach(i => { metreU[i] = perimeter / .8; metreV[i] = distance / 1.6; });
  }
  const arrays = Object.fromEntries(Object.entries(geometry.attributes).map(([name,a]) => [name, Array.from(a.array)]));
  const index = Array.from(geometry.index!.array), copies = new Map<number, number>();
  for (let i = 0; i < index.length; i += 3) {
    const face = index.slice(i,i+3), us = face.map(j => uv.getX(j)), vs = face.map(j => uv.getY(j));
    if (Math.max(...us)-Math.min(...us) < .5 || Math.max(...vs)===Math.min(...vs)) continue;
    for(let j=0;j<3;j++) if(uv.getX(face[j])===0) {
      const original=face[j]; let copy=copies.get(original);
      if(copy===undefined) {
        copy=arrays.position.length/3; copies.set(original,copy);
        for(const [name,a] of Object.entries(geometry.attributes)) for(let k=0;k<a.itemSize;k++) arrays[name].push(a.array[original*a.itemSize+k]);
        arrays.uv[copy*2]=metreU[original]; arrays.uv[copy*2+1]=metreV[original];
      }
      index[i+j]=copy;
    }
  }
  for(let i=0;i<p.count;i++) {arrays.uv[i*2]=uv.getX(i)*metreU[i]; arrays.uv[i*2+1]=metreV[i];}
  for(const [name,a] of Object.entries(geometry.attributes)) geometry.setAttribute(name,new THREE.Float32BufferAttribute(arrays[name],a.itemSize));
  geometry.setIndex(index); return geometry;
}

/** An irregular root threshold replaces three visibly concentric torus loops.
 * Its open centre remains at least 3.1m wide, with no new collision or trigger. */
export function createRootThresholdGeometry() {
  return mergeArtGeometries([
    // Two old boles grow beyond their meeting limb; the threshold reads as
    // living trees rather than a free-standing decorative arch. Same passage.
    createSweptGeometry([[-2.8, -.04, -.24], [-3, 2.6, -.4], [-2.7, 4.6, .05], [-3.65, 6.4, .25], [-3.3, 8, .5]], [.72, .6, .38, .22, .09], 8, 20),
    createSweptGeometry([[2.82, -.04, .27], [3.1, 2.4, .05], [3.65, 4.8, -.3], [3.2, 6.7, -.45], [4, 7.3, -.3]], [.61, .49, .32, .17, .035], 8, 20),
    createTaperedBranchGeometry([[-2.8, 3.4, .05], [-1.6, 4.05, .15], [.2, 4.3, .15], [1.5, 4.05, -.1], [3.3, 3.9, -.2]], .32, 18, 5, 10),
    createTaperedBranchGeometry([[-2.9, 4.7, 0], [-1.7, 6.05, -.2], [-.4, 6.9, -.3]], .26, 19, 5, 10),
    createTaperedBranchGeometry([[3.5, 4.5, -.2], [2.35, 5.6, .4], [1.45, 6.7, .65]], .22, 22, 5, 10),
    ...[-1, 1].flatMap(side => [-1, 1].map(front => createTaperedBranchGeometry([
      [side * 2.85, .3, side * .24], [side * 3.22, .1, front * .67], [side * 3.8, -.04, front * 1.5],
    ], .3, 20 + side + front, 5, 4))),
  ].map(rootedBarkUv));
}
