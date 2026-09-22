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
  // ExtrudeGeometry is non-indexed; normalise before the single material merge.
  return mergeArtGeometries(parts.map(part => { if (!part.index) return part; const expanded = part.toNonIndexed(); part.dispose(); return expanded; }));
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
