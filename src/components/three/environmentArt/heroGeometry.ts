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

/** Forged bow, a shouldered barrel and an uneven, cut ward. One material draw. */
export function createKeyGeometry() {
  const shape = new THREE.Shape();
  shape.moveTo(.27,.07);shape.bezierCurveTo(.16,.28,-.14,.32,-.32,.16);
  shape.bezierCurveTo(-.45,.03,-.29,-.27,-.08,-.255);shape.bezierCurveTo(.1,-.26,.2,-.15,.27,-.065);shape.closePath();
  const hole = new THREE.Path();hole.moveTo(.15,.035);hole.bezierCurveTo(.11,-.12,-.12,-.19,-.22,-.095);
  hole.bezierCurveTo(-.32,.02,-.18,.205,-.05,.19);hole.bezierCurveTo(.06,.18,.16,.12,.15,.035);shape.holes.push(hole);
  const bow = new THREE.ExtrudeGeometry(shape, { depth: .068, bevelEnabled: true, bevelSize: .014, bevelThickness: .008, bevelSegments: 2, curveSegments: 9, steps: 1 });
  bow.translate(0, 0, -.034);
  const stem = new THREE.Shape();
  [[.86,.045],[1.21,.048],[1.23,-.04],[1.20,-.27],[1.12,-.282],[1.10,-.16],[1.035,-.16],[1.03,-.25],[.953,-.25],[.956,-.10],[.89,-.10]].forEach(([x,y],i)=>i?stem.lineTo(x,y):stem.moveTo(x,y));stem.closePath();
  const bit = new THREE.ExtrudeGeometry(stem, { depth: .075, bevelEnabled: true, bevelSize: .009, bevelThickness: .008, bevelSegments: 1, curveSegments: 1, steps: 1 });bit.translate(0,0,-.0375);
  const barrel = createSweptGeometry([[.23,0,0],[.32,.008,0],[.72,.012,0],[1.19,.004,0]],[.054,.046,.039,.042],10,14);
  const shoulder = new THREE.LatheGeometry([[.049,.23],[.068,.265],[.066,.31],[.049,.34]].map(([r,y])=>new THREE.Vector2(r,y)),12);shoulder.rotateZ(-Math.PI/2);
  return agedMetal(mergeArtGeometries([bow,barrel,shoulder,bit]));
}

/** Warm rubbed edges over blackened metal; stable vertex colour, no extra draw. */
function agedMetal(geometry: THREE.BufferGeometry) {
  const p=geometry.getAttribute("position"), colors=new Float32Array(p.count*3);
  for(let i=0;i<p.count;i++) {
    const x=p.getX(i), y=p.getY(i), z=p.getZ(i);
    const patina=.72+.23*(.5+.5*Math.sin(x*12.7+y*7.1+z*8.3));
    const edge=.5+.5*Math.sin(y*91+x*5);
    colors.set([patina+edge*.12,patina+edge*.07,patina*.94],i*3);
  }
  geometry.setAttribute("color",new THREE.BufferAttribute(colors,3));return geometry;
}

/** Rolled fuel reservoir, open vent slots, pressed guards and pinned bail handle. */
export function createLanternHousingGeometry() {
  const lathe=(profile:number[][],segments=24,start=0,arc=Math.PI*2)=>new THREE.LatheGeometry(profile.map(([r,y])=>new THREE.Vector2(r,y)),segments,start,arc);
  const parts: THREE.BufferGeometry[] = [
    lathe([[0,0],[.255,0],[.275,.018],[.278,.038],[.259,.048],[.262,.074],[.25,.105],[.207,.153],[.173,.166],[.178,.19],[.198,.198],[.199,.214],[.174,.219],[.105,.219],[.061,.255],[.051,.276],[0,.276]]),
    lathe([[.178,.729],[.209,.733],[.237,.75],[.244,.77],[.239,.79],[.199,.812],[.163,.842],[.134,.852]]),
    lathe([[.14,.902],[.152,.916],[.14,.939],[.10,.962],[.081,.964],[.079,.986],[0,.99]]),
  ];
  // Eight real apertures separate the cowl from its vented crown.
  for(let i=0;i<8;i++)parts.push(lathe([[.135,.846],[.131,.886],[.139,.911]],3,i*Math.PI/4,.29));
  for(const side of [-1,1])for(const z of [-1,1]) {
    const guard=createSweptGeometry([[side*.142,.13,z*.142],[side*.182,.28,z*.176],[side*.18,.61,z*.179],[side*.145,.81,z*.14]],[.024,.018,.017,.025],6,10);
    parts.push(guard);
  }
  // The bail is slightly off-square from years of carrying, with visible hinges.
  parts.push(createSweptGeometry([[-.227,.77,0],[-.25,.96,.004],[-.169,1.125,.011],[.012,1.185,.018],[.19,1.102,.01],[.232,.96,0],[.221,.785,0]],[.017,.014,.014,.014,.017],6,24));
  for(const side of [-1,1]) {
    const hinge=lathe([[0,-.018],[.038,-.018],[.041,0],[.026,.024],[0,.025]],10);hinge.rotateZ(Math.PI/2);hinge.translate(side*.224,.785,0);parts.push(hinge);
  }
  const cap=lathe([[0,0],[.045,0],[.046,.025],[.032,.033],[0,.033]],10);cap.rotateX(.4);cap.translate(.15,.127,.077);parts.push(cap);
  const adjuster=createSweptGeometry([[.045,.264,0],[.156,.264,0],[.21,.26,0]],[.009,.01,.016],6,6);parts.push(adjuster);
  const geometry=mergeArtGeometries(parts), p=geometry.getAttribute("position");
  for(let i=0;i<p.count;i++) {const y=p.getY(i),warp=1+Math.sin(y*16+p.getZ(i)*9)*.006;p.setX(i,p.getX(i)*warp);}
  geometry.computeVertexNormals();geometry.computeBoundingBox();geometry.computeBoundingSphere();
  return agedMetal(geometry);
}

/** Open-ended chimney with a belly and narrow neck, kept separate from the frame. */
export function createLanternGlassGeometry() {
  return new THREE.LatheGeometry([[.158,.218],[.174,.247],[.183,.32],[.186,.47],[.171,.63],[.14,.7],[.137,.746]].map(([r,y])=>new THREE.Vector2(r,y)),24);
}

/** Deep, uneven frame profile; joints interrupt the moulding rather than decorating it. */
export function createMirrorFrameGeometry(width=5.4,height=6) {
  const parts:THREE.BufferGeometry[]=[];
  for(const [lip,band,depth,z] of [[.0,.09,.12,0],[.07,.18,.17,-.06],[.23,.065,.11,-.09]]) {
    const x=width/2+lip,y=height/2+lip,shape=new THREE.Shape();
    shape.moveTo(-x-band,-y-band);shape.lineTo(x+band*.92,-y-band*.98);shape.lineTo(x+band*.96,y+band*.58);
    shape.quadraticCurveTo(x*.37,y+band*1.16,-x-band*.97,y+band*.77);shape.closePath();
    const hole=new THREE.Path();hole.moveTo(-x,-y);hole.lineTo(-x,y);hole.lineTo(x,y);hole.lineTo(x,-y);hole.closePath();shape.holes.push(hole);
    const rail=new THREE.ExtrudeGeometry(shape,{depth,bevelEnabled:true,bevelSize:.012,bevelThickness:.014,bevelSegments:1,steps:1,curveSegments:10});rail.translate(0,0,z);parts.push(rail);
  }
  return agedMetal(mergeArtGeometries(parts));
}

/** The shoulder/neck line carries recognition; the lower contour remains incomplete. */
export function createApparitionGeometry() {
  const shape=new THREE.Shape();shape.moveTo(-.29,0);shape.bezierCurveTo(-.19,.32,-.27,.6,-.24,.83);
  shape.lineTo(-.36,.68);shape.bezierCurveTo(-.39,.87,-.4,1.1,-.26,1.21);
  shape.quadraticCurveTo(-.17,1.245,-.107,1.29);shape.lineTo(-.087,1.405);
  shape.bezierCurveTo(-.172,1.48,-.14,1.686,-.024,1.735);shape.bezierCurveTo(.102,1.787,.192,1.62,.126,1.48);
  shape.lineTo(.074,1.39);shape.lineTo(.107,1.282);shape.quadraticCurveTo(.263,1.25,.335,1.1);
  shape.bezierCurveTo(.36,.93,.318,.83,.295,.68);shape.lineTo(.237,.89);
  shape.bezierCurveTo(.19,.54,.3,.26,.238,0);shape.closePath();
  return new THREE.ShapeGeometry(shape,10);
}
