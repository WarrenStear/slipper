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

/** One material batch, with joinery and wear authored into each bounded piece. */
export function createConstructionGeometry(pieces: readonly ConstructionPiece[], plaster = false) {
  const geometries = pieces.slice(0, 256).map((piece, index) => {
    const geometry = plaster
      ? createWeatheredPanelGeometry(piece.size, index + 17)
      : createWornTimberGeometry(piece.size, index + 17);
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
    const crease = Math.sin(p.x / width * 19) * Math.sin(p.z / depth * 13) * .009;
    p.y *= 1 - Math.abs(crease);
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

/** The bowl has an actual recessed interior and a worn rolled rim. */
export function createBasinGeometry(radius = 1.68, height = .45) {
  const profile = [
    [.16, 0], [.82, 0], [.92, .12], [.99, .72], [1, .89],
    [.97, 1], [.9, .99], [.86, .86], [.81, .34], [.12, .28],
  ].map(([r, y]) => new THREE.Vector2(r * radius, y * height - height / 2));
  const geometry = new THREE.LatheGeometry(profile, 32);
  geometry.computeBoundingBox(); geometry.computeBoundingSphere();
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
