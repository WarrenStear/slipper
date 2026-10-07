import * as THREE from "three";
import { createLeafGeometry, createSectionGeometry, createSweptGeometry, mergeArtGeometries, type ArtDetail, type ArtVec3 } from "./authoredGeometry.ts";

function oval(position: ArtVec3, size: ArtVec3, sides = 12) {
  const geometry = createSectionGeometry([[-1, 0, 0, 0], [-.8, .6, .6, 0], [-.4, .92, .92, 0], [0, 1, 1, 0], [.4, .92, .92, 0], [.8, .6, .6, 0], [1, 0, 0, 0]], sides);
  geometry.scale(...size); geometry.translate(...position); return geometry;
}

/** Cross sections along the spine: widths and belly/back heights are authored independently. */
function spine(sections: readonly (readonly [number, number, number, number])[], sides: number) {
  const g = createSectionGeometry(sections.map(([z, width, height, y]) => [z, width, height, -y]), sides);
  g.rotateX(Math.PI / 2); return g;
}

function ear(side: number, y: number) {
  const x = side * .14;
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute([x - .10, y, .78, x + .10, y, .78, x + side * .067, y + .19, .70, x, y + .055, .92], 3));
  geometry.setAttribute("uv", new THREE.Float32BufferAttribute([0, 0, 1, 0, .5, 1, .5, .3], 2));
  geometry.setIndex([0, 2, 1, 0, 3, 2, 1, 2, 3, 0, 1, 3]); geometry.computeVertexNormals(); return geometry;
}

/** Anatomy is authored in a single forward +Z coordinate frame, with a grounded paw origin. */
export function createWolfGeometries(resting = false, detail: ArtDetail = "base") {
  const sides = detail === "relief" ? 10 : 8, steps = detail === "relief" ? 18 : 12;
  const fur: THREE.BufferGeometry[] = [], dark: THREE.BufferGeometry[] = [], light: THREE.BufferGeometry[] = [];
  const bodyY = resting ? .31 : .81, headY = resting ? .59 : 1.11;
  fur.push(spine([
    [-.78, .06, .09, bodyY], [-.64, .19, .21, bodyY + .015],
    [-.45, .214, .25, bodyY], [-.2, .185, resting ? .23 : .185, bodyY + .025],
    [.05, .237, .278, bodyY], [.28, .253, .319, bodyY + .035],
    [.46, .22, .3, bodyY + .07], [.58, .1, .16, bodyY + .12],
  ], sides));
  fur.push(createSweptGeometry([[0, bodyY + .04, .31], [0, headY - .17, .56], [0, headY, .72]], [.255, .198, .146], sides, 10));
  fur.push(spine([[.59,.075,.13,headY],[.7,.174,.176,headY],[.83,.174,.155,headY-.01],[.97,.125,.115,headY-.045],[1.05,.09,.065,headY-.085]], sides));
  // A wedge-shaped long muzzle, separate cheek/jaw, and high listening ears.
  const muzzle = createSectionGeometry([[-.17, .15, .10, 0], [0, .115, .075, 0], [.24, .073, .06, 0], [.27, .045, .035, 0]], sides);
  muzzle.rotateX(Math.PI / 2); muzzle.translate(0, headY - .09, .99); fur.push(muzzle);
  dark.push(oval([0, headY - .084, 1.26], [.06, .043, .031], 8));
  for (const side of [-1, 1]) {
    fur.push(ear(side, headY + .105));
    dark.push(oval([side * .123, headY + .028, .925], [.009, .009, .009], 8));
    for (const front of [false, true]) {
      const x = side * (front ? .19 : .21), z = front ? .4 : -.47;
      const points: ArtVec3[] = resting
        ? [[x, .38, z], [x * (front ? 1.08 : 1.38), .16, z + (front ? .16 : -.12)], [x * 1.16, .07, z + (front ? .48 : .16)]]
        : [[x, front ? .86 : .78, z], [x * 1.10, .45, z + (front ? -.05 : .15)], [x * 1.1, .28, z + (front ? .02 : -.16)], [x * 1.1, .12, z + (front ? .07 : -.045)]];
      fur.push(createSweptGeometry(points, [front ? .115 : .145, .08, .047, .036], sides, 10));
      fur.push(oval([x * 1.1, .065, z + (resting ? (front ? .52 : .18) : .085)], [.075, .065, .15], sides));
    }
  }
  fur.push(createSweptGeometry(resting ? [[0, .4, -.64], [.23, .2, -.83], [.43, .1, -.52], [.36, .09, -.2]] : [[0, .78, -.62], [.07, .52, -.96], [.12, .24, -1.11], [.17, .17, -.99]], [.14, .16, .11, .02], sides, steps));
  // Ruff has a scalloped physical outline at the breast without extra fur cards.
  light.push(createSweptGeometry([[0, headY - .12, .825], [0, headY - .34, .635], [0, bodyY - .14, .5]], [.078, .126, .027], sides, 10));
  return { body: finishAnimalSurface(mergeArtGeometries(fur), "wolf", bodyY), accent: finishAnimalSurface(mergeArtGeometries(light), "ruff", bodyY), dark: mergeArtGeometries(dark) };
}

export function createSwanGeometries(detail: ArtDetail = "base") {
  const sides = detail === "relief" ? 14 : 10;
  const body: THREE.BufferGeometry[] = [], dark: THREE.BufferGeometry[] = [];
  body.push(spine([[-.77,.025,.025,.31],[-.56,.21,.14,.29],[-.3,.335,.22,.26],[.03,.35,.245,.27],[.29,.27,.22,.3],[.48,.12,.14,.37],[.53,.025,.035,.43]], sides));
  // Folded wings form a continuous shoulder mass above the waterline.
  for (const side of [-1, 1]) {
    const wing = spine([[-.64,.016,.026,.365],[-.39,.096,.096,.435],[-.05,.115,.104,.432],[.22,.066,.082,.425],[.33,.01,.02,.37]], 8);
    wing.translate(side * .22, 0, 0); body.push(wing);
  }
  body.push(createSweptGeometry([[0, .34, .37], [0, .56, .56], [0, .83, .38], [0, 1.12, .43], [0, 1.28, .66], [0, 1.28, .83]], [.122, .088, .067, .061, .065, .070], 8, detail === "relief" ? 30 : 20));
  body.push(oval([0, 1.285, .82], [.083, .087, .147], sides));
  const featherCount = detail === "relief" ? 5 : 3;
  for (const side of [-1, 1]) for (let index = 0; index < featherCount; index++) {
    const feather = createLeafGeometry(.52 - index * .034, .060 - index * .005, .014);
    feather.rotateX(.045 + index * .026); feather.rotateY(Math.PI + side * (.07 + index * .060));
    feather.rotateZ(-side * (.16 + index * .04)); feather.translate(side * .213, .455 + index * .012, .16); body.push(feather);
  }
  const tail = createLeafGeometry(.32, .19, .045); tail.rotateY(Math.PI); tail.rotateX(.1); tail.translate(0, .33, -.5); body.push(tail);
  const beak = createSectionGeometry([[-.11, .042, .031, 0], [-.07, .054, .03, 0], [.09, .026, .018, 0], [.13, 0, 0, 0]], 8);
  beak.rotateX(Math.PI / 2 + .12); beak.translate(0, 1.248, 1.02);
  dark.push(oval([0, 1.29, .954], [.047, .045, .035], 8));
  for (const side of [-1, 1]) dark.push(oval([side * .071, 1.302, .869], [.012, .012, .012], 8));
  return { body: finishAnimalSurface(mergeArtGeometries(body), "swan", .27), accent: finishAnimalSurface(beak, "bill", 1.248), dark: mergeArtGeometries(dark) };
}

/** Directional coat/feather value is carried by existing vertices, not cards or maps.
 * No silhouette noise: the calm body surface remains readable in a distant scene. */
function finishAnimalSurface(geometry: THREE.BufferGeometry, kind: "wolf" | "ruff" | "swan" | "bill", centerY: number) {
  const position=geometry.getAttribute("position"),normal=geometry.getAttribute("normal"),colors=new Float32Array(position.count*3);
  for(let i=0;i<position.count;i++) {
    const x=position.getX(i),y=position.getY(i),z=position.getZ(i),up=THREE.MathUtils.smoothstep(normal.getY(i),-.55,.65);
    const grain=Math.sin(z*31+y*11+x*7)*Math.sin(z*9-x*17)*.018;
    const belly=1-THREE.MathUtils.smoothstep(y-centerY,-.16,.11);
    const value=kind==="swan"?.84+up*.12-belly*.11+grain*.45:kind==="bill"?.76+up*.18:kind==="ruff"?.86+up*.10+grain:.76+up*.18-belly*.055+grain;
    colors.set([Math.min(1,value),Math.min(1,value*(kind==="swan"?.997:.987)),Math.min(1,value*(kind==="swan"?.975:.95))],i*3);
  }
  geometry.setAttribute("color",new THREE.Float32BufferAttribute(colors,3));return geometry;
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
