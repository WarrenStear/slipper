import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { createWornTimberGeometry, createWeatheredPanelGeometry } from "../environmentArt/authoredGeometry.ts";

export type ArtVector = [number, number, number];
export type ConstructionPiece = {
  position: ArtVector;
  size: ArtVector;
  rotation?: ArtVector;
  color?: string;
};

/** Re-map only construction timber. The shared chair/actor source stays intact.
 * Separate caps preserve end grain; side UVs measure the actual perimeter and
 * length, including the short worn end rings. Every board remains 60 triangles. */
function constructionTimber(size: ArtVector, seed: number) {
  const source = createWornTimberGeometry(size, seed);
  const sourcePosition = source.getAttribute("position");
  const dimensions = size.map(Math.abs), axis = dimensions.indexOf(Math.max(...dimensions));
  const across = (axis + 1) % 3, thickness = (axis + 2) % 3;
  const positions: number[] = [], coordinates: number[] = [], uvs: number[] = [], indices: number[] = [];
  const point = (index: number) => [sourcePosition.getX(index), sourcePosition.getY(index), sourcePosition.getZ(index)];
  const perimeter = [0];
  for (let corner = 0; corner < 8; corner++) {
    const a = point(8 + corner), b = point(8 + (corner + 1) % 8);
    perimeter.push(perimeter[corner] + Math.hypot(b[across] - a[across], b[thickness] - a[thickness]));
  }
  const append = (vertex: number, u: number, v: number) => {
    const p = point(vertex); positions.push(...p);
    // Long grain is always local Y, regardless of a board's construction axis.
    coordinates.push(p[across], p[axis], p[thickness]); uvs.push(u, v);
  };
  for (let ring = 0; ring < 4; ring++) for (let corner = 0; corner <= 8; corner++) {
    const vertex = ring * 8 + corner % 8;
    append(vertex, perimeter[corner], point(vertex)[axis] / 2.2 + seed * .173);
    if (ring < 3 && corner < 8) {
      const i = ring * 9 + corner; indices.push(i, i + 1, i + 9, i + 1, i + 10, i + 9);
    }
  }
  for (let end = 0; end < 2; end++) {
    const offset = positions.length / 3, ring = end ? 3 : 0;
    for (let corner = 0; corner < 8; corner++) {
      const vertex = ring * 8 + corner, p = point(vertex);
      append(vertex, p[across] + seed * .137, p[thickness] + seed * .173);
    }
    for (let corner = 1; corner < 7; corner++) {
      if (end) indices.push(offset, offset + corner, offset + corner + 1);
      else indices.push(offset, offset + corner + 1, offset + corner);
    }
  }
  source.dispose();
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setAttribute("storySurfacePosition", new THREE.Float32BufferAttribute(coordinates, 3));
  geometry.setIndex(indices); geometry.computeVertexNormals();
  const normal = geometry.getAttribute("normal");
  // The duplicated wrap edge has one shared lighting normal, but distinct UVs.
  for (let ring = 0; ring < 4; ring++) {
    const a = ring * 9, b = a + 8;
    const n = new THREE.Vector3(normal.getX(a) + normal.getX(b), normal.getY(a) + normal.getY(b), normal.getZ(a) + normal.getZ(b)).normalize();
    normal.setXYZ(a, n.x, n.y, n.z); normal.setXYZ(b, n.x, n.y, n.z);
  }
  const grainNormals: number[] = [];
  for (let i = 0; i < normal.count; i++) {
    const n = [normal.getX(i), normal.getY(i), normal.getZ(i)];
    grainNormals.push(n[across], n[axis], n[thickness]);
  }
  geometry.setAttribute("storySurfaceNormal", new THREE.Float32BufferAttribute(grainNormals, 3));
  return geometry;
}

/** One material batch, with joinery and wear authored into each bounded piece. */
export function createConstructionGeometry(pieces: readonly ConstructionPiece[], plaster = false) {
  const geometries = pieces.slice(0, 256).map((piece, index) => {
    const geometry = plaster
      ? createWeatheredPanelGeometry(piece.size, index + 17)
      : constructionTimber(piece.size, index + 17);
    const transform = new THREE.Matrix4().compose(
      new THREE.Vector3(...piece.position),
      new THREE.Quaternion().setFromEuler(new THREE.Euler(...(piece.rotation ?? [0, 0, 0]))),
      new THREE.Vector3(1, 1, 1),
    );
    geometry.applyMatrix4(transform);
    const tint = new THREE.Color(piece.color ?? "#ffffff");
    const colors = new Float32Array(geometry.getAttribute("position").count * 3);
    for (let i = 0; i < colors.length; i += 3) tint.toArray(colors, i);
    geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    return geometry;
  });
  const merged = geometries.length ? mergeGeometries(geometries, false) : new THREE.BufferGeometry();
  geometries.forEach(geometry => geometry.dispose());
  if (!merged) throw new Error("Construction pieces must share position, normal, UV and color attributes.");
  merged.computeBoundingBox();
  merged.computeBoundingSphere();
  return merged;
}

/** Padded rectangular upholstery: seams, a soft crown and four recognisable corners. */
export function createUpholsteryGeometry(size: ArtVector) {
  const [width, height, depth] = size;
  const geometry = new THREE.BoxGeometry(width, height, depth, 8, 4, 8);
  const position = geometry.getAttribute("position");
  const radius = Math.min(width, height, depth) * .24;
  const inner = new THREE.Vector3(width / 2 - radius, height / 2 - radius, depth / 2 - radius);
  const p = new THREE.Vector3(), nearest = new THREE.Vector3(), normal = new THREE.Vector3();
  for (let i = 0; i < position.count; i++) {
    p.fromBufferAttribute(position, i);
    nearest.copy(p).clamp(inner.clone().negate(), inner);
    normal.subVectors(p, nearest).normalize();
    p.copy(nearest).addScaledVector(normal, radius);
    // Shallow creases sit inside the original volume; they do not inflate bounds.
    const nx = p.x / width * 2, nz = p.z / depth * 2;
    const seat = Math.max(0, 1 - nx * nx) * Math.max(0, 1 - nz * nz);
    const crease = Math.sin(nx * 12 + nz * 2) * .016 * Math.pow(Math.abs(nz), 5);
    if (p.y > 0) p.y -= height * (.19 * seat * seat + Math.abs(crease));
    // Broad compression, with shallow gathered corners, never noisy bumps.
    p.z *= 1 - .016 * Math.abs(Math.cos(nx * 9)) * Math.max(0, 1 - Math.abs(p.y / height * 2));
    position.setXYZ(i, p.x, p.y, p.z);
  }
  geometry.computeVertexNormals();
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  return geometry;
}

/** A chipped, shallow stone. The top remains at z=0 (the existing walk surface). */
export function createSteppingStoneGeometry() {
  const sides = 12, positions: number[] = [], uvs: number[] = [], indices: number[] = [];
  for (let ring = 0; ring < 3; ring++) {
    const radius = ring === 0 ? .76 : ring === 1 ? 1 : .93;
    for (let i = 0; i < sides; i++) {
      const angle = i / sides * Math.PI * 2;
      const chipped = .93 + Math.sin(i * 7.13 + 2) * .05;
      const x = Math.cos(angle) * radius * chipped, y = Math.sin(angle) * radius * chipped;
      positions.push(x, y, ring === 0 ? 0 : ring === 1 ? -.025 : -.07);
      uvs.push(x * .5 + .5, y * .5 + .5);
      if (ring < 2) {
        const a = ring * sides + i, b = ring * sides + (i + 1) % sides;
        indices.push(a, a + sides, b, b, a + sides, b + sides);
      }
    }
  }
  positions.push(0, 0, 0); uvs.push(.5, .5);
  for (let i = 0; i < sides; i++) indices.push(36, i, (i + 1) % sides);
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices); geometry.computeVertexNormals();
  geometry.computeBoundingBox(); geometry.computeBoundingSphere();
  return geometry;
}

/** A ground-based outcrop with broad weathered shoulders, not a regular solid. */
export function createWeatheredBoulderGeometry(seed = 1) {
  const geometry = new THREE.SphereGeometry(1, 10, 6);
  const p = geometry.getAttribute("position");
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    const shoulder = .86 + Math.sin(x * 3.8 + y * 2.3 + seed) * .08 + Math.cos(z * 4.7 - y + seed * .7) * .045;
    const height = Math.max(0, (y + .64) / 1.64);
    p.setXYZ(i, x * shoulder + height * .09, height * (.95 + Math.sin(x * 4 + seed) * .04), z * (.78 + Math.cos(x * 3 + y * 2 + seed) * .075));
  }
  geometry.computeVertexNormals(); geometry.computeBoundingBox(); geometry.computeBoundingSphere();
  return geometry;
}

/** The bowl has an actual recessed interior and a worn rolled rim. */
export function createBasinGeometry(radius = 1.68, height = .45) {
  const profile = [
    [.16, 0], [.82, 0], [.92, .12], [.99, .72], [1, .89],
    [.97, 1], [.9, .99], [.86, .86], [.81, .34], [.12, .28],
  ].map(([r, y]) => new THREE.Vector2(r * radius, y * height - height / 2));
  const geometry = new THREE.LatheGeometry(profile, 32);
  const p = geometry.getAttribute("position");
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), z = p.getZ(i), a = Math.atan2(z, x);
    const rim = Math.max(0, p.getY(i) / height + .1);
    const wear = .986 + .009 * Math.sin(a * 3 + .8) + .004 * Math.sin(a * 7);
    p.setXYZ(i, x * wear, p.getY(i) - rim * height * (.017 + .012 * Math.sin(a * 5)), z * wear);
  }
  geometry.computeVertexNormals(); geometry.computeBoundingBox(); geometry.computeBoundingSphere();
  return geometry;
}

/** One coherent bird silhouette, reused by the bounded symbolic flock. */
export function createFlightSilhouetteGeometry() {
  const shape = new THREE.Shape();
  shape.moveTo(0, .25); shape.lineTo(.08, .04);
  shape.bezierCurveTo(.25, .04, .41, .26, .64, .29);
  shape.lineTo(.47, -.04); shape.lineTo(.19, -.13); shape.lineTo(.06, -.08);
  shape.lineTo(.09, -.3); shape.lineTo(0, -.24); shape.lineTo(-.09, -.3);
  shape.lineTo(-.06, -.08); shape.lineTo(-.19, -.13); shape.lineTo(-.47, -.04);
  shape.lineTo(-.64, .29); shape.bezierCurveTo(-.41, .26, -.25, .04, -.08, .04);
  shape.closePath();
  const geometry = new THREE.ShapeGeometry(shape, 5);
  geometry.computeBoundingBox(); geometry.computeBoundingSphere();
  return geometry;
}
