import * as THREE from "three";
import type { Vector3Tuple } from "../../data/slipper3dTypes";
// Geometry construction only. Placement, density, collider and family selection
// remain owned by the forest worker and presentation adapter.
export const FOREST_ARCHETYPES = Object.freeze([
  "old-broad", "narrow-reaching", "broken", "twisted", "leaning", "young", "partially-dead", "open-canopy",
] as const);
export type ForestArchetypeId = typeof FOREST_ARCHETYPES[number];
export type ForestGeometryDetail = 0 | 1 | 2;
type TrunkForm = {
  spine: Vector3Tuple[];
  lift: number[];
  turns: number[];
  widths: number[];
  root: number;
  births: number[];
  radii: number[];
};
type CrownForm = {
  islands: Vector3Tuple[];
  spreads: Vector3Tuple[];
  leaf: number;
};
type GeometryBuffers = {
  positions: number[];
  uvs: number[];
  colors: number[];
  indices: number[];
  seamPairs: [number, number][];
};
const toVector = (p: Vector3Tuple) => new THREE.Vector3(...p);
export const FOREST_REFERENCE_TRUNK_SCALE = Object.freeze([0.3, 12, 0.3] as const);
const referenceTrunkScale = FOREST_REFERENCE_TRUNK_SCALE;
export const FOREST_REFERENCE_CROWN_SCALE = Object.freeze([1.5, 2.15, 1.45] as const);
export const FOREST_REFERENCE_CROWN_HEIGHT = 10.3;
const rootAngles = [.18, 1.74, 3.28, 4.86];
// Trunk points are authored in metre space for a 12m tree, then normalized for
// the established anisotropic trunk matrix. Core topology stays identical.
// Unequal branch birth heights and bole bends distinguish age and growth habit.
// All forms retain the exact six-ring/eight-side trunk and six supported limbs.
const TREE_FORMS: TrunkForm[] = [
  { spine: [[0, 0, 0], [.04, .65, -.03], [-.09, 3.2, .05], [.12, 5.8, .02], [.02, 8.4, -.06], [.13, 12, .04]], lift: [.2, .35, .1, .15, .1, .3], turns: [.1, 1.3, 2.5, 3.7, 4.7, 5.8], widths: [1.1, 1, .82, .96, .84, .68], root: 1.05, births: [4.7, 5.8, 7.4, 5.1, 6.8, 4.4], radii: [.43, .34, .29, .235, .13, .018] },
  { spine: [[0, 0, 0], [.015, .65, .02], [-.04, 3.2, -.02], [.035, 5.8, -.05], [.08, 8.4, .02], [.07, 12, -.02]], lift: [1.4, 1.65, 1.6, 1.3, .95, .72], turns: [.25, 1.45, 2.7, 3.9, 5.1, 6.15], widths: [.65, .75, .7, .6, .5, .45], root: .82, births: [5.1, 5.9, 7.1, 8.3, 9.2, 10.1], radii: [.29, .24, .2, .155, .09, .018] },
  { spine: [[0, 0, 0], [-.04, .65, 0], [.1, 3.2, -.08], [.2, 5.8, .035], [.11, 8.4, -.07], [.26, 10.45, .06]], lift: [.15, -.35, .35, -.15, -.18, -.2], turns: [.2, 2.3, 4.0, .8, 3.5, 5.6], widths: [1.0, .85, .75, .58, .45, .4], root: 1, births: [4.2, 5.1, 6.8, 5.6, 7.4, 8.5], radii: [.42, .33, .285, .23, .14, .055] },
  { spine: [[0, 0, 0], [-.07, .65, .04], [.2, 3.2, -.12], [-.18, 5.8, .19], [.24, 8.4, -.05], [-.03, 12, .16]], lift: [.5, .2, .6, .3, .2, .45], turns: [.45, 1.7, 3.0, 4.25, 5.4, 6.4], widths: [.95, 1, .88, .9, .8, .7], root: 1.02, births: [4.5, 5.6, 6.4, 7.5, 8.1, 9.1], radii: [.4, .31, .25, .225, .13, .018] },
  { spine: [[0, 0, 0], [.06, .65, -.025], [.14, 3.2, -.07], [.32, 5.8, -.04], [.56, 8.4, -.09], [.72, 12, -.03]], lift: [.35, .6, .2, .55, .45, .25], turns: [.05, .8, 2.0, 3.1, 5.25, 6.0], widths: [.95, .95, .72, .66, .8, .65], root: 1, births: [4.4, 5.8, 6.6, 7.4, 8.5, 7.9], radii: [.4, .32, .27, .22, .12, .018] },
  { spine: [[0, 0, 0], [-.015, .65, .02], [.025, 3.2, -.01], [.06, 5.8, .035], [-.025, 8.4, .015], [.02, 12, .03]], lift: [.45, .65, .6, .8, .6, .45], turns: [.2, 1.8, 3.0, 4.2, 5.5, 6.3], widths: [.52, .5, .47, .43, .42, .38], root: .72, births: [6.2, 6.9, 7.7, 8.4, 9.2, 9.8], radii: [.24, .19, .16, .12, .07, .012] },
  { spine: [[0, 0, 0], [.04, .65, -.03], [-.04, 3.2, -.1], [.15, 5.8, .035], [.08, 8.4, .1], [.19, 12, -.02]], lift: [-.1, .05, -.5, .1, .4, .1], turns: [.1, 1.5, 2.85, 3.9, 5.2, 6.1], widths: [1, .95, .9, .82, .75, .7], root: 1.04, births: [4.6, 5.5, 6.3, 7.4, 8.7, 9.1], radii: [.43, .335, .29, .235, .145, .018] },
  { spine: [[0, 0, 0], [.02, .65, .015], [-.07, 3.2, .06], [.09, 5.8, -.045], [.03, 8.4, .05], [.02, 12, 0]], lift: [.45, .2, .5, .25, .35, .15], turns: [.2, 1.3, 2.5, 3.65, 4.8, 5.9], widths: [.88, .88, .82, .83, .75, .65], root: 1, births: [4.8, 5.5, 6.3, 7.1, 8.5, 9.0], radii: [.38, .3, .255, .21, .115, .018] },
];
const CROWN_FORMS: CrownForm[] = [
  { islands: [[-1.02, -1.04, .25], [.94, -.64, -.32], [-.14, .25, -.16], [-.72, -.3, -.7], [.68, -.17, .66], [-.1, -1.22, .78], [.14, .04, .26]], spreads: [[.65, .2, .46], [.58, .2, .42], [.48, .23, .42], [.55, .18, .39], [.57, .18, .43], [.52, .16, .36], [.43, .18, .38]], leaf: 1 },
  { islands: [[-.34, -.58, .11], [.32, -.29, -.15], [-.26, .13, -.26], [.25, .46, .13], [-.15, .77, .1], [.11, 1.07, -.09], [0, .34, .35]], spreads: [[.3, .34, .27], [.3, .34, .25], [.27, .38, .26], [.25, .36, .23], [.24, .32, .23], [.18, .24, .2], [.28, .31, .24]], leaf: .86 },
  { islands: [[-.78, -1.22, .12], [.67, -.96, -.14], [-.29, -.35, .36], [.32, -1.12, .44], [-.18, -.54, -.41], [.12, -.64, .2], [.04, -.58, .03]], spreads: [[.44, .15, .36], [.42, .17, .33], [.31, .16, .3], [.2, .13, .21], [.19, .1, .2], [.13, .1, .14], [.11, .09, .12]], leaf: .86 },
  { islands: [[-.81, -.95, .2], [.79, -.61, -.27], [-.5, -.21, -.65], [.59, .29, .32], [-.23, .58, .48], [.12, .89, -.31], [.03, .04, .24]], spreads: [[.48, .2, .38], [.43, .21, .34], [.4, .24, .31], [.44, .18, .32], [.39, .25, .34], [.31, .23, .28], [.3, .21, .28]], leaf: .94 },
  { islands: [[.09, -1.08, .12], [.61, -.71, -.41], [.99, -.28, .18], [.8, .21, -.2], [1.08, .62, .37], [.52, .4, .12], [.42, -.26, .64]], spreads: [[.37, .2, .3], [.47, .17, .33], [.42, .24, .3], [.44, .18, .31], [.38, .2, .29], [.33, .24, .26], [.36, .16, .28]], leaf: .93 },
  { islands: [[-.29, -.36, .14], [.26, -.18, -.14], [-.14, .18, -.25], [.13, .45, .19], [-.07, .64, .12], [.08, .87, -.07], [0, .14, .26]], spreads: [[.21, .2, .18], [.23, .2, .18], [.22, .23, .18], [.18, .22, .17], [.18, .2, .17], [.13, .18, .14], [.17, .19, .16]], leaf: .65 },
  { islands: [[-.9, -.95, .22], [.8, -.64, -.13], [-.4, -.18, -.6], [.61, .24, .28], [-.19, .72, .44], [.18, .58, -.28], [.01, -.18, .13]], spreads: [[.5, .17, .37], [.14, .07, .12], [.11, .1, .08], [.49, .22, .35], [.4, .23, .32], [.12, .09, .1], [.08, .06, .07]], leaf: .92 },
  { islands: [[-1.05, -.29, .14], [.97, -.12, -.31], [-.57, .26, -.91], [.65, .38, .72], [-.32, .81, .28], [.38, .77, -.37], [-.58, -.37, .77]], spreads: [[.43, .14, .34], [.42, .16, .31], [.37, .17, .28], [.4, .17, .31], [.31, .2, .28], [.28, .2, .25], [.36, .14, .3]], leaf: .82 },
];
function addTube(buffers: GeometryBuffers, points: Vector3Tuple[], radii: number[], sides: number, bole = false) {
  const start = buffers.positions.length / 3;
  const stride = sides + 1;
  for (let row = 0; row < points.length; row++) {
    const point = toVector(points[row]);
    const tangent = toVector(points[Math.min(points.length - 1, row + 1)]).sub(toVector(points[Math.max(0, row - 1)])).normalize();
    const reference = Math.abs(tangent.y) > .95 ? new THREE.Vector3(1, 0, 0) : new THREE.Vector3(0, 1, 0);
    const across = new THREE.Vector3().crossVectors(tangent, reference).normalize();
    const around = new THREE.Vector3().crossVectors(tangent, across).normalize();
    for (let side = 0; side <= sides; side++) {
      if (side === sides) {
        // The wrap twin uses exactly the first point and color, with U=1. A
        // closing face must not interpolate from almost1 back across the map.
        const first = start + row * stride;
        buffers.positions.push(...buffers.positions.slice(first * 3, first * 3 + 3));
        buffers.colors.push(...buffers.colors.slice(first * 3, first * 3 + 3));
        buffers.uvs.push(1, row / (points.length - 1));
        buffers.seamPairs.push([first, first + sides]);
        continue;
      }
      const angle = side / sides * Math.PI * 2;
      const basal = bole ? Math.exp(-point.y * 1.8) : 0;
      const flute = 1 + Math.sin(side * 2.17 + row * .8) * (bole ? .06 : .034)
        + basal * (.16 + .2 * Math.cos(angle * 4 + .35));
      const vertex = point.clone().addScaledVector(across, Math.cos(angle) * radii[row] * flute).addScaledVector(around, Math.sin(angle) * radii[row] * flute);
      buffers.positions.push(vertex.x / referenceTrunkScale[0], vertex.y / referenceTrunkScale[1] - .5, vertex.z / referenceTrunkScale[2]);
      buffers.uvs.push(side / sides, row / (points.length - 1));
      const shade = .73 + row / (points.length - 1) * .17 + side % 3 * .018;
      // Broad, low-frequency dampness and a sheltered moss face supplement the
      // existing authored bark maps without another material or draw.
      const contact = bole ? Math.exp(-point.y * .85) : 0;
      const sheltered = bole ? Math.max(0, Math.cos(angle - .7)) * Math.exp(-point.y * .48) : 0;
      buffers.colors.push(shade * (.98 - contact * .11 - sheltered * .09),
        shade * (1 - contact * .075), shade * (.95 - contact * .09 - sheltered * .07));
    }
  }
  for (let row = 0; row < points.length - 1; row++)
    for (let side = 0; side < sides; side++) {
      const a = start + row * stride + side, b = a + 1, c = start + (row + 1) * stride + side + 1, d = c - 1;
      buffers.indices.push(a, b, c, a, c, d);
    }
  const capCentres: number[] = [];
  for (const end of [0, points.length - 1]) {
    const centre = buffers.positions.length / 3;
    capCentres.push(centre);
    const [x, y, z] = points[end];
    buffers.positions.push(x / referenceTrunkScale[0], y / referenceTrunkScale[1] - .5, z / referenceTrunkScale[2]);
    buffers.uvs.push(.5, .5);
    buffers.colors.push(.75, .77, .73);
    for (let side = 0; side < sides; side++) {
      const a = start + end * stride + side, b = a + 1;
      buffers.indices.push(...(end === 0 ? [centre, b, a] : [centre, a, b]));
    }
  }
  return {
    endCapVertexIndex: capCentres[1],
    endRingVertexIndices: Array.from({ length: stride }, (_, side) => start + (points.length - 1) * stride + side),
  };
}
function buffers(): GeometryBuffers { return { positions: [], uvs: [], colors: [], indices: [], seamPairs: [] }; }
function finish(data: GeometryBuffers, name: string) {
  const geometry = new THREE.BufferGeometry();
  geometry.name = name;
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(data.positions, 3));
  geometry.setAttribute("uv", new THREE.Float32BufferAttribute(data.uvs, 2));
  geometry.setAttribute("color", new THREE.Float32BufferAttribute(data.colors, 3));
  geometry.setIndex(data.indices);
  geometry.computeVertexNormals();
  const normal = geometry.getAttribute("normal") as THREE.BufferAttribute;
  const average = new THREE.Vector3();
  for (const [first, twin] of data.seamPairs) {
    average.set(normal.getX(first) + normal.getX(twin), normal.getY(first) + normal.getY(twin), normal.getZ(first) + normal.getZ(twin)).normalize();
    normal.setXYZ(first, average.x, average.y, average.z);
    normal.setXYZ(twin, average.x, average.y, average.z);
  }
  if (data.seamPairs.length > 0) geometry.userData.seamVertexPairs = data.seamPairs.map(pair => [...pair]);
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  return geometry;
}
function trunkAt(type: number) {
  const form = TREE_FORMS[type], data = buffers();
  const spine = form.spine.map(point => [...point] as Vector3Tuple);
  // Living leaders taper into the central foliage instead of ending as a sawn
  // pole above it. Broken and partly dead trees retain an exposed old terminus.
  if (type !== 2 && type !== 6) {
    const [x, y, z] = CROWN_FORMS[type].islands[6];
    spine[5] = [x * FOREST_REFERENCE_CROWN_SCALE[0], FOREST_REFERENCE_CROWN_HEIGHT + y * FOREST_REFERENCE_CROWN_SCALE[1], z * FOREST_REFERENCE_CROWN_SCALE[2]];
  }
  const leader = addTube(data, spine, form.radii, 8, true);
  const spineAtHeight = (height: number): THREE.Vector3 => {
    const next = spine.findIndex(point => point[1] >= height);
    if (next <= 0) return toVector(spine[Math.max(0, next)]);
    const previous = spine[next - 1], end = spine[next];
    return toVector(previous).lerp(toVector(end), (height - previous[1]) / (end[1] - previous[1]));
  };
  rootAngles.forEach((angle, i) => {
    const reach = (1.08 + (i % 2) * .13) * form.root;
    const rootAngle = angle + Math.sin(type * 1.3 + i) * .11;
    addTube(data, [[Math.cos(rootAngle) * .19, .4 * form.root, Math.sin(rootAngle) * .19],
      [Math.cos(rootAngle) * reach, .055, Math.sin(rootAngle) * reach]], [.15 * form.root, .028], 4);
  });
  const branchTipVertexIndices: number[] = [];
  for (let i = 0; i < 6; i++) {
    const base = spineAtHeight(form.births[i]);
    const island = CROWN_FORMS[type].islands[i];
    const end: Vector3Tuple = [island[0] * FOREST_REFERENCE_CROWN_SCALE[0], FOREST_REFERENCE_CROWN_HEIGHT + island[1] * FOREST_REFERENCE_CROWN_SCALE[1], island[2] * FOREST_REFERENCE_CROWN_SCALE[2]];
    const bend = .16 + (i % 3) * .045;
    const middle = base.clone().lerp(toVector(end), i % 2 ? .52 : .43).add(new THREE.Vector3(
      Math.cos(form.turns[i]) * bend,
      .12 + form.lift[i] * .16,
      Math.sin(form.turns[i]) * bend,
    )).toArray();
    const branch = addTube(data, [base.toArray(), middle, end], [.13, .075, .014].map(r => r * form.widths[i]), 3);
    branchTipVertexIndices.push(branch.endCapVertexIndex);
  }
  const oldLimbTips: number[] = [];
  for (let i = 0; i < 2; i++) {
    // Reuse the former two crown twigs as old torn limbs at readable eye-side
    // heights. Short scars stay within the old rooted footprint even on saplings.
    const base = spineAtHeight(3.25 + i * 1.35 + (type % 3) * .18).toArray();
    const angle = form.turns[i] + (i % 2 ? .48 : -.5), reach = type === 5 ? .16 : .22 + i * .05;
    const end: Vector3Tuple = [base[0] + Math.cos(angle) * reach,
      base[1] + (type === 2 || type === 6 ? -.16 : .18), base[2] + Math.sin(angle) * reach];
    const oldLimb = addTube(data, [base, end], [type === 5 ? .034 : .064, .009], 3);
    oldLimbTips.push(oldLimb.endCapVertexIndex);
  }
  const geometry = finish(data, `trunk:${FOREST_ARCHETYPES[type]}`);
  // Semantic construction indices follow the real tubes, so support probes and
  // presentation adapters do not reconstruct offsets from incidental counts.
  geometry.userData.branchTipVertexIndices = branchTipVertexIndices;
  geometry.userData.oldLimbTipVertexIndices = oldLimbTips;
  geometry.userData.leaderTipVertexIndex = leader.endCapVertexIndex;
  geometry.userData.leaderRingVertexIndices = leader.endRingVertexIndices;
  return geometry;
}
const CLUSTER_POINTS: [number, number][] = [[0, 0], [-.45, -.2], [.42, .21], [-.14, .43], [.08, -.47]];
for (let i = 5; i < 38; i++) {
  const angle = i * 2.399963, radial = .38 + ((i * 7) % 11) / 11 * .46;
  CLUSTER_POINTS.push([Math.cos(angle) * radial, Math.sin(angle) * radial]);
}
function crownAt(type: number, detail: ForestGeometryDetail) {
  const form = CROWN_FORMS[type], data = buffers(), leaves = detail === 0 ? 10 : 38;
  for (let island = 0; island < 7; island++) {
    const centre = form.islands[island], spread = form.spreads[island];
    for (let leaf = 0; leaf < leaves; leaf++) {
      const [u, v] = CLUSTER_POINTS[leaf], angle = leaf * 2.399963 + island * .71;
      const c = new THREE.Vector3(centre[0] + u * spread[0], centre[1] + Math.sin(angle) * spread[1] + v * spread[1] * .5, centre[2] + v * spread[2]);
      const direction = new THREE.Vector3(Math.cos(angle + .4), .42 + Math.sin(leaf * 1.7 + island) * .68, Math.sin(angle + .4)).normalize();
      const across = new THREE.Vector3(-direction.z, 0, direction.x).normalize()
        .applyAxisAngle(direction, Math.sin(leaf * 1.31 + island * .47) * 1.1);
      const islandScale = Math.min(1, Math.max(...spread) / .3);
      const length = (detail === 0 ? .26 : .18) * form.leaf * islandScale * (.85 + (leaf % 4) * .11);
      const width = (detail === 0 ? .22 : .15) * form.leaf * islandScale * (.8 + (leaf % 3) * .12);
      // Alpha-cut twig sprays replace single diamond blades at the same vertex
      // budget. Folded cards and irregular pitch preserve depth from below.
      const points = [
        c.clone().addScaledVector(direction, -length).addScaledVector(across, -width),
        c.clone().addScaledVector(direction, -length).addScaledVector(across, width),
        c.clone().addScaledVector(direction, length).addScaledVector(across, width),
        c.clone().addScaledVector(direction, length).addScaledVector(across, -width),
      ];
      points[1].y += detail === 0 ? .055 : .035;
      points[3].y += detail === 0 ? .045 : .027;
      const offset = data.positions.length / 3;
      points.forEach((p, corner) => {
        data.positions.push(p.x, p.y, p.z);
        const shade = .67 + (leaf % 5) * .065 + (corner === 1 ? .065 : 0);
        data.colors.push(shade * .98, shade, shade * .92);
      });
      data.uvs.push(0, 0, 1, 0, 1, 1, 0, 1);
      data.indices.push(...[0, 1, 2, 0, 2, 3].map(n => n + offset));
    }
  }
  return finish(data, `crown:${FOREST_ARCHETYPES[type]}:detail-${detail}`);
}
function library(build: (type: number) => THREE.BufferGeometry, name: string) {
  const targets = FOREST_ARCHETYPES.map((_, i) => build(i)), geometry = targets[0].clone();
  geometry.name = name;
  geometry.morphTargetsRelative = false;
  geometry.morphAttributes.position = targets.map(g => g.getAttribute("position").clone());
  geometry.morphAttributes.normal = targets.map(g => g.getAttribute("normal").clone());
  geometry.userData = { ...geometry.userData, archetypeIds: [...FOREST_ARCHETYPES], requiresInitializedMorphWeights: true };
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  targets.forEach(g => g.dispose());
  return geometry;
}
// Existing generic consumers get a complete ordinary geometry, not uninitialized
// instanced morph weights. Only explicit library consumers acquire morph targets.
export function createForestTrunkGeometry() {
  return trunkAt(0);
}
export function createOrganicCrownGeometry(detail: ForestGeometryDetail = 0) {
  return crownAt(0, detail);
}
export function createForestTrunkLibrary() {
  return library(trunkAt, "eight-authored-trunk-library");
}
export function createForestCrownLibrary(detail: ForestGeometryDetail = 0) {
  return library(i => crownAt(i, detail), `eight-authored-crown-library:detail-${detail}`);
}
export function createForestArchetypeGeometry(type: ForestArchetypeId, detail: ForestGeometryDetail = 0) {
  const index = FOREST_ARCHETYPES.indexOf(type);
  if (index < 0) throw new RangeError("Unknown forest archetype");
  return { trunk: trunkAt(index), crown: crownAt(index, detail) };
}
// Pure support metadata exists for structural probes and paired transform adapters.
export function getForestArchetypeBranchSupports(type: ForestArchetypeId): Vector3Tuple[] {
  const index = FOREST_ARCHETYPES.indexOf(type);
  if (index < 0) throw new RangeError("Unknown forest archetype");
  return CROWN_FORMS[index].islands.slice(0, 6).map(([x, y, z]) => [
    x * FOREST_REFERENCE_CROWN_SCALE[0],
    FOREST_REFERENCE_CROWN_HEIGHT + y * FOREST_REFERENCE_CROWN_SCALE[1],
    z * FOREST_REFERENCE_CROWN_SCALE[2],
  ]);
}
