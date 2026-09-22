import * as THREE from "three";
import { createLeafGeometry, createSectionGeometry, createSweptGeometry, mergeArtGeometries, type ArtDetail, type ArtVec3 } from "./authoredGeometry.ts";

function oval(position: ArtVec3, size: ArtVec3, sides = 12) {
  const geometry = createSectionGeometry([[-1, 0, 0, 0], [-.8, .6, .6, 0], [-.4, .92, .92, 0], [0, 1, 1, 0], [.4, .92, .92, 0], [.8, .6, .6, 0], [1, 0, 0, 0]], sides);
  geometry.scale(...size); geometry.translate(...position); return geometry;
}

function ear(side: number, y: number) {
  const x = side * .14;
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute([x - .10, y, .78, x + .10, y, .78, x + side * .035, y + .27, .79, x, y + .055, .92], 3));
  geometry.setAttribute("uv", new THREE.Float32BufferAttribute([0, 0, 1, 0, .5, 1, .5, .3], 2));
  geometry.setIndex([0, 2, 1, 0, 3, 2, 1, 2, 3, 0, 1, 3]); geometry.computeVertexNormals(); return geometry;
}

/** Anatomy is authored in a single forward +Z coordinate frame, with a grounded paw origin. */
export function createWolfGeometries(resting = false, detail: ArtDetail = "base") {
  const sides = detail === "relief" ? 10 : 8, steps = detail === "relief" ? 18 : 12;
  const fur: THREE.BufferGeometry[] = [], dark: THREE.BufferGeometry[] = [], light: THREE.BufferGeometry[] = [];
  const bodyY = resting ? .40 : .81, headY = resting ? .62 : 1.13;
  const body = createSweptGeometry([[0, bodyY, -.6], [0, bodyY + .035, -.12], [0, bodyY + .09, .39]], [.19, .3, .31, .25], sides, steps);
  body.scale(1, 1.16, 1); fur.push(body);
  fur.push(createSweptGeometry([[0, bodyY + .03, .3], [0, headY - .16, .61], [0, headY, .76]], [.28, .25, .18], sides, steps));
  fur.push(oval([0, headY, .79], [.205, .21, .27], sides));
  // A wedge-shaped long muzzle, separate cheek/jaw, and high listening ears.
  const muzzle = createSectionGeometry([[-.17, .15, .10, 0], [0, .115, .075, 0], [.24, .073, .06, 0], [.27, .045, .035, 0]], sides);
  muzzle.rotateX(Math.PI / 2); muzzle.translate(0, headY - .09, .99); light.push(muzzle);
  dark.push(oval([0, headY - .084, 1.26], [.07, .048, .04], 8));
  for (const side of [-1, 1]) {
    fur.push(ear(side, headY + .105));
    dark.push(oval([side * .16, headY + .04, .952], [.018, .014, .018], 8));
    for (const front of [false, true]) {
      const x = side * (front ? .19 : .21), z = front ? .4 : -.47;
      const points: ArtVec3[] = resting
        ? [[x, .38, z], [x * 1.15, .18, z + .14], [x * 1.16, .07, z + .45]]
        : [[x, front ? .86 : .76, z], [x * 1.10, .45, z + (front ? -.045 : -.16)], [x * 1.1, .13, z + (front ? .07 : -.045)]];
      fur.push(createSweptGeometry(points, [front ? .105 : .135, .07, .04], sides, 10));
      fur.push(oval([x * 1.1, .065, z + (resting ? .5 : .085)], [.075, .065, .15], sides));
    }
  }
  fur.push(createSweptGeometry(resting ? [[0, .4, -.64], [.23, .2, -.83], [.43, .1, -.52], [.36, .09, -.2]] : [[0, .78, -.62], [.07, .52, -.96], [.12, .24, -1.11], [.17, .17, -.99]], [.14, .16, .11, .02], sides, steps));
  // Ruff has a scalloped physical outline at the breast without extra fur cards.
  light.push(createSweptGeometry([[0, headY - .1, .86], [0, headY - .34, .65], [0, bodyY - .14, .5]], [.105, .16, .035], sides, 10));
  return { body: mergeArtGeometries(fur), accent: mergeArtGeometries(light), dark: mergeArtGeometries(dark) };
}

export function createSwanGeometries(detail: ArtDetail = "base") {
  const sides = detail === "relief" ? 14 : 10;
  const body: THREE.BufferGeometry[] = [], dark: THREE.BufferGeometry[] = [];
  body.push(oval([0, .28, -.04], [.35, .27, .64], sides));
  body.push(createSweptGeometry([[0, .34, .37], [0, .56, .56], [0, .86, .46], [0, 1.16, .49], [0, 1.29, .67], [0, 1.28, .83]], [.14, .10, .073, .065, .07, .076], 8, detail === "relief" ? 30 : 20));
  body.push(oval([0, 1.285, .82], [.112, .112, .175], sides));
  const featherCount = detail === "relief" ? 7 : 5;
  for (const side of [-1, 1]) for (let index = 0; index < featherCount; index++) {
    const feather = createLeafGeometry(.75 - index * .05, .13 - index * .008, .06);
    feather.rotateX(.18 + index * .06); feather.rotateY(Math.PI + side * (.09 + index * .075));
    feather.rotateZ(-side * (.55 + index * .08)); feather.translate(side * .21, .40 + index * .024, .19); body.push(feather);
  }
  const tail = createLeafGeometry(.32, .19, .045); tail.rotateY(Math.PI); tail.rotateX(.1); tail.translate(0, .33, -.5); body.push(tail);
  const beak = createSectionGeometry([[-.11, .042, .031, 0], [-.07, .054, .03, 0], [.09, .026, .018, 0], [.13, 0, 0, 0]], 8);
  beak.rotateX(Math.PI / 2 + .12); beak.translate(0, 1.248, 1.02);
  dark.push(oval([0, 1.29, .954], [.047, .045, .035], 8));
  for (const side of [-1, 1]) dark.push(oval([side * .095, 1.305, .869], [.012, .012, .012], 8));
  return { body: mergeArtGeometries(body), accent: beak, dark: mergeArtGeometries(dark) };
}

/** An asymmetrical hanging mantle and hood; no generic cone or glowing orb. */
export function createPhantomGeometries(detail: ArtDetail = "base") {
  const sides = detail === "relief" ? 24 : 16;
  const mantle = createSectionGeometry([[.04, .50, .19, 0], [.28, .43, .16, -.03], [.8, .31, .14, -.03], [1.25, .30, .13, 0], [1.66, .43, .17, 0], [1.84, .32, .15, 0], [1.95, .19, .15, 0], [2.1, .19, .17, 0], [2.28, .09, .12, -.01], [2.31, 0, 0, -.01]], sides);
  const p = mantle.getAttribute("position");
  for (let index = 0; index < p.count; index++) {
    const angle = index % sides / sides * Math.PI * 2, y = p.getY(index), fold = Math.sin(angle * 6 + y * .7) * .022 * Math.max(0, 1 - y / 2);
    p.setXYZ(index, p.getX(index) + Math.cos(angle) * fold, y + (y < .3 ? Math.sin(angle * 3) * .036 : 0), p.getZ(index) + Math.sin(angle) * fold);
  }
  mantle.computeVertexNormals(); mantle.computeBoundingBox(); mantle.computeBoundingSphere();
  const hood = oval([0, 2.05, .144], [.112, .15, .025], 12);
  return { body: mantle, accent: hood, dark: mergeArtGeometries([]) };
}
