import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";

export type ArtVec3 = [number, number, number];
export type ArtDetail = "base" | "relief";
const TAU = Math.PI * 2;
const finite = (value: number, fallback: number) => Number.isFinite(value) ? value : fallback;
export const artNoise = (seed: number, index: number) => {
  const value = Math.sin(finite(seed, 0) * 12.9898 + index * 78.233) * 43758.5453;
  return value - Math.floor(value);
};

function finish(positions: number[], indices: number[], uvs: number[]) {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals(); geometry.computeBoundingBox(); geometry.computeBoundingSphere();
  return geometry;
}

/** Consume temporary pieces and return one owned, single-material geometry. */
export function mergeArtGeometries(pieces: THREE.BufferGeometry[]) {
  if (!pieces.length) return finish([], [], []);
  const geometry = mergeGeometries(pieces, false);
  for (const piece of pieces) piece.dispose();
  if (!geometry) throw new Error("Incompatible authored geometry attributes.");
  geometry.computeBoundingBox(); geometry.computeBoundingSphere();
  return geometry;
}

/** A shaved eight-sided timber profile with worn ends, held inside its exact box. */
export function createWornTimberGeometry(size: ArtVec3, seed = 0) {
  const dimensions = size.map(value => Math.max(.0001, Math.min(1000, Math.abs(finite(value, 1)))));
  const axis = dimensions.indexOf(Math.max(...dimensions));
  const uAxis = (axis + 1) % 3, vAxis = (axis + 2) % 3;
  const a = dimensions[uAxis] / 2, b = dimensions[vAxis] / 2;
  const bevel = Math.min(a, b) * .23;
  const profile = [[-a + bevel, -b], [a - bevel, -b], [a, -b + bevel], [a, b - bevel], [a - bevel, b], [-a + bevel, b], [-a, b - bevel], [-a, -b + bevel]];
  const positions: number[] = [], indices: number[] = [], uvs: number[] = [];
  const ringPositions = [-.5, -.47, .44, .5];
  for (let ring = 0; ring < 4; ring++) for (let corner = 0; corner < 8; corner++) {
    const point = [0, 0, 0];
    const wear = ring === 0 || ring === 3 ? .89 + artNoise(seed, ring * 8 + corner) * .07 : .985 + artNoise(seed, corner) * .015;
    point[axis] = ringPositions[ring] * dimensions[axis];
    point[uAxis] = profile[corner][0] * wear; point[vAxis] = profile[corner][1] * wear;
    positions.push(...point); uvs.push(corner / 8, ring / 3);
    if (ring < 3) { const i = ring * 8 + corner, next = ring * 8 + (corner + 1) % 8; indices.push(i, next, i + 8, next, next + 8, i + 8); }
  }
  for (let corner = 1; corner < 7; corner++) { indices.push(0, corner + 1, corner); indices.push(24, 24 + corner, 25 + corner); }
  return finish(positions, indices, uvs);
}

/** Shallow chipped corners, rather than a floating noise displacement on a box. */
export function createWeatheredPanelGeometry(size: ArtVec3, seed = 0) {
  const geometry = createWornTimberGeometry(size, seed);
  const positions = geometry.getAttribute("position");
  const thinAxis = size.map(Math.abs).indexOf(Math.min(...size.map(Math.abs)));
  for (let index = 0; index < positions.count; index++) {
    const point = [positions.getX(index), positions.getY(index), positions.getZ(index)];
    point[thinAxis] *= .93 + artNoise(seed + 9, index) * .07;
    positions.setXYZ(index, point[0], point[1], point[2]);
  }
  geometry.computeVertexNormals(); geometry.computeBoundingBox(); geometry.computeBoundingSphere();
  return geometry;
}

/** Variable-radius curved limbs, branches and roots. No per-frame geometry changes. */
export function createSweptGeometry(points: ArtVec3[], radii: number[], sides = 8, segments = 20) {
  const safePoints = points.slice(0, 32).map(point => new THREE.Vector3(...point.map(v => finite(v, 0)) as ArtVec3));
  if (!safePoints.length) safePoints.push(new THREE.Vector3());
  if (safePoints.length < 2) safePoints.push(safePoints[0].clone().add(new THREE.Vector3(0, .001, 0)));
  const count = Math.max(4, Math.min(48, Math.floor(finite(segments, 20))));
  const around = Math.max(3, Math.min(16, Math.floor(finite(sides, 8))));
  const curve = new THREE.CatmullRomCurve3(safePoints);
  const frames = curve.computeFrenetFrames(count, false);
  const positions: number[] = [], indices: number[] = [], uvs: number[] = [];
  for (let row = 0; row <= count; row++) {
    const t = row / count, center = curve.getPointAt(t), ri = t * Math.max(0, radii.length - 1), low = Math.floor(ri);
    const radius = Math.max(.00001, Math.min(100, finite(THREE.MathUtils.lerp(radii[low] ?? .01, radii[Math.min(low + 1, radii.length - 1)] ?? .01, ri - low), .01)));
    for (let side = 0; side < around; side++) {
      const angle = side / around * TAU;
      const point = center.clone().addScaledVector(frames.normals[row], Math.cos(angle) * radius).addScaledVector(frames.binormals[row], Math.sin(angle) * radius);
      positions.push(point.x, point.y, point.z); uvs.push(side / around, t);
      if (row < count) { const i = row * around + side, next = row * around + (side + 1) % around; indices.push(i, next, i + around, next, next + around, i + around); }
    }
  }
  for (let i = 1; i < around - 1; i++) { indices.push(0, i + 1, i); const end = count * around; indices.push(end, end + i, end + i + 1); }
  return finish(positions, indices, uvs);
}

export function createTaperedBranchGeometry(points: ArtVec3[], radius: number, seed = 0, sides = 6) {
  const r = Math.max(.0001, Math.min(10, Math.abs(finite(radius, .02))));
  return createSweptGeometry(points, [r, r * (.85 + artNoise(seed, 2) * .1), r * .62, r * .35, r * .035], sides, Math.min(24, Math.max(8, points.length * 4)));
}

/** Revolved authored cross-sections. Coordinates are [height, radiusX, radiusZ, offsetZ]. */
export function createSectionGeometry(sections: [number, number, number, number][], sides = 12) {
  const around = Math.max(4, Math.min(24, sides));
  const positions: number[] = [], indices: number[] = [], uvs: number[] = [];
  sections.forEach(([y, rx, rz, z], row) => {
    for (let side = 0; side < around; side++) {
      const angle = side / around * TAU;
      positions.push(Math.cos(angle) * rx, y, Math.sin(angle) * rz + z); uvs.push(side / around, row / (sections.length - 1));
      if (row < sections.length - 1) { const i = row * around + side, next = row * around + (side + 1) % around; indices.push(i, i + around, next, next, i + around, next + around); }
    }
  });
  return finish(positions, indices, uvs);
}

export function createWaxCandleGeometry(radius = .085, height = .4, seed = 0) {
  const r = Math.max(.001, Math.min(5, Math.abs(finite(radius, .085)))), h = Math.max(.01, Math.min(20, Math.abs(finite(height, .4))));
  const geometry = createSectionGeometry([[-h / 2, 0, 0, 0], [-h / 2, r * .91, r * .91, 0], [-h * .44, r, r, 0], [h * .2, r * .9, r * .9, 0], [h * .46, r * .86, r * .86, 0], [h * .5, r * .68, r * .68, 0], [h * .43, r * .55, r * .55, 0], [h * .41, 0, 0, 0]], 12);
  const p = geometry.getAttribute("position");
  for (let index = 24; index < p.count - 12; index++) {
    const row = Math.floor(index / 12), side = index % 12;
    p.setY(index, p.getY(index) - artNoise(seed, side) * h * (row >= 4 ? .035 : .012));
  }
  geometry.computeVertexNormals(); geometry.computeBoundingBox(); geometry.computeBoundingSphere();
  return geometry;
}

export function createFlameGeometry(radius = .05, height = .16) {
  const r = Math.max(.001, Math.abs(finite(radius, .05))), h = Math.max(.01, Math.abs(finite(height, .16)));
  return createSectionGeometry([[-h / 2, 0, 0, 0], [-h * .3, r * .7, r * .7, 0], [-h * .05, r, r, 0], [h * .22, r * .55, r * .55, r * .12], [h / 2, 0, 0, r * .35]], 8);
}

/** A folded lanceolate leaf with an actual pointed outline and central rib. */
export function createLeafGeometry(length = .3, width = .1, curl = .04) {
  const positions: number[] = [], indices: number[] = [], uvs: number[] = [];
  for (let row = 0; row <= 8; row++) {
    const t = row / 8, span = Math.sin(Math.PI * t) ** .8 * width;
    for (const side of [-1, 0, 1]) { positions.push(span * side, Math.sin(t * Math.PI) * curl + Math.abs(side) * curl * .3, t * length); uvs.push((side + 1) / 2, t); }
    if (row < 8) for (let side = 0; side < 2; side++) { const i = row * 3 + side; indices.push(i, i + 3, i + 1, i + 1, i + 3, i + 4); }
  }
  return finish(positions, indices, uvs);
}
