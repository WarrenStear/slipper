import * as THREE from "three";
import { artNoise, createLeafGeometry, createSectionGeometry, createSweptGeometry, createWornTimberGeometry, mergeArtGeometries, type ArtDetail } from "./authoredGeometry.ts";

export function createChairGeometry() {
  const parts: THREE.BufferGeometry[] = [];
  const seat = createWornTimberGeometry([.65, .085, .6], 7); seat.translate(0, .5, 0); parts.push(seat);
  // Curved crest rail and bowed spindles make the empty chair legible in silhouette.
  const back = new THREE.Shape();
  back.moveTo(-.325, -.08); back.quadraticCurveTo(0, -.025, .325, -.08); back.lineTo(.325, .08); back.quadraticCurveTo(0, .13, -.325, .08); back.closePath();
  const crest = new THREE.ExtrudeGeometry(back, { depth: .065, bevelEnabled: true, bevelSize: .008, bevelThickness: .008, bevelSegments: 1, steps: 1, curveSegments: 5 });
  crest.translate(0, 1.14, .225); parts.push(crest);
  for (const x of [-.26, -.09, .09, .26]) parts.push(createSweptGeometry([[x, .53, .25], [x * 1.04, .83, .29], [x, 1.16, .265]], [.023, .018, .021], 6, 10));
  for (const x of [-.26, .26]) for (const z of [-.24, .24]) {
    parts.push(createSweptGeometry([[x * 1.09, .005, z * 1.09], [x * 1.05, .19, z * 1.05], [x, .49, z]], [.024, .028, .035], 8, 8));
  }
  for (const x of [-.25, .25]) parts.push(createSweptGeometry([[x, .21, -.24], [x, .2, 0], [x, .21, .24]], [.014, .012, .014], 6, 8));
  return mergeArtGeometries(parts);
}

export function createNestGeometries(detail: ArtDetail = "base") {
  const count = detail === "relief" ? 28 : 18;
  const outer: THREE.BufferGeometry[] = [], inner: THREE.BufferGeometry[] = [];
  for (let i = 0; i < count; i++) {
    const angle = i * 2.39996, radius = .27 + (i % 4) * .044, y = .035 + (i % 5) * .026;
    const points: [number, number, number][] = [];
    for (let j = 0; j < 6; j++) { const a = angle + (j / 5 - .5) * 2.9; points.push([Math.cos(a) * radius, y + Math.sin(j * 1.9 + i) * .015, Math.sin(a) * radius]); }
    const piece = createSweptGeometry(points, [.008, .013, .012, .006], 4, 12);
    (i % 3 ? outer : inner).push(piece);
  }
  for (let i = 0; i < 7; i++) {
    const leaf = createLeafGeometry(.38, .065, .035); leaf.rotateY(i * 2.4); leaf.translate(0, .018 + i * .001, 0); inner.push(leaf);
  }
  return { outer: mergeArtGeometries(outer), inner: mergeArtGeometries(inner) };
}

export function createSeedGeometry() {
  const seed = createSectionGeometry([[-.14, 0, 0, 0], [-.105, .052, .06, 0], [-.03, .078, .083, 0], [.07, .066, .07, .014], [.14, .018, .025, .021], [.15, 0, 0, .023]], 10);
  const p = seed.getAttribute("position");
  for (let i = 0; i < p.count; i++) p.setX(i, p.getX(i) * (.96 + artNoise(9, i % 10) * .04));
  seed.computeVertexNormals(); return seed;
}

/** Warded key: flattened oval bow, shouldered stem and unequal teeth, one mesh. */
export function createKeyGeometry() {
  const shape = new THREE.Shape();
  shape.absellipse(0, 0, .34, .25, 0, Math.PI * 2, false, 0);
  const hole = new THREE.Path(); hole.absellipse(0, 0, .245, .16, 0, Math.PI * 2, true, 0); shape.holes.push(hole);
  const bow = new THREE.ExtrudeGeometry(shape, { depth: .065, bevelEnabled: true, bevelSize: .013, bevelThickness: .008, bevelSegments: 2, curveSegments: 12, steps: 1 });
  bow.translate(0, 0, -.0325);
  const stem = new THREE.Shape();
  [[.26,.055],[1.17,.055],[1.17,-.28],[1.06,-.28],[1.06,-.13],[.97,-.13],[.97,-.23],[.86,-.23],[.86,-.055],[.26,-.055]].forEach(([x,y],i)=>i?stem.lineTo(x,y):stem.moveTo(x,y));stem.closePath();
  const bit = new THREE.ExtrudeGeometry(stem, { depth: .075, bevelEnabled: true, bevelSize: .009, bevelThickness: .008, bevelSegments: 1, curveSegments: 1, steps: 1 });bit.translate(0,0,-.0375);
  return mergeArtGeometries([bow,bit]);
}

/** Spun foot and vent hood, bowed wire handle and four restrained guard rails. */
export function createLanternHousingGeometry() {
  const profile = [[0,0],[.24,0],[.29,.035],[.29,.085],[.25,.13],[.21,.17],[.21,.19]];
  const foot = new THREE.LatheGeometry(profile.map(([r,y])=>new THREE.Vector2(r,y)),16);
  const hood = new THREE.LatheGeometry([[.23,.76],[.28,.79],[.25,.85],[.18,.89],[.11,.94],[.09,.98]].map(([r,y])=>new THREE.Vector2(r,y)),16);
  const parts: THREE.BufferGeometry[] = [foot,hood];
  for(const side of [-1,1])for(const z of [-1,1])parts.push(createSweptGeometry([[side*.17,.14,z*.17],[side*.195,.47,z*.195],[side*.17,.82,z*.17]],[.018,.016,.018],6,8));
  parts.push(createSweptGeometry([[-.2,.86,0],[-.22,1.04,0],[0,1.18,0],[.22,1.04,0],[.2,.86,0]],[.018,.018,.02,.018,.018],6,16));
  return mergeArtGeometries(parts);
}
