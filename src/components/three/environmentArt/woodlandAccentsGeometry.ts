import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";

type Point = [number, number, number];

function limb(parts: THREE.BufferGeometry[], start: Point, end: Point, radius: number, radialSegments = 7) {
  const a = new THREE.Vector3(...start), b = new THREE.Vector3(...end);
  const direction = b.clone().sub(a), length = direction.length();
  if (length < .00001) return;
  const geometry = new THREE.CylinderGeometry(radius * .32, radius, length, radialSegments, 2);
  geometry.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.normalize()));
  const centre = a.add(b).multiplyScalar(.5);
  geometry.translate(centre.x, centre.y, centre.z);
  parts.push(geometry);
}

function finish(parts: THREE.BufferGeometry[]) {
  const merged = mergeGeometries(parts, false);
  parts.forEach(part => part.dispose());
  if (!merged) throw new Error("Woodland accent geometry attributes must match");
  merged.computeBoundingBox(); merged.computeBoundingSphere();
  return merged;
}

/** A slender, asymmetric forked tree, rather than another scaled canopy blob. */
export function createSaplingBarkGeometry() {
  const parts: THREE.BufferGeometry[] = [];
  limb(parts, [0, 0, 0], [.09, 1.7, .05], .115, 9);
  limb(parts, [.09, 1.7, .05], [.2, 3.65, -.08], .072, 8);
  limb(parts, [.06, 1.35, .04], [-.42, 2.52, -.14], .065);
  limb(parts, [-.42, 2.52, -.14], [-.73, 2.93, -.21], .034);
  limb(parts, [.12, 2.12, .01], [.66, 3.17, .29], .05);
  limb(parts, [.14, 2.65, -.02], [-.19, 3.52, .25], .034);
  for (let i = 0; i < 4; i++) {
    const angle = i * 1.65 + .2;
    limb(parts, [0, .15, 0], [Math.cos(angle) * .44, .025, Math.sin(angle) * .44], .044, 5);
  }
  return finish(parts);
}

/** Folded leaf silhouettes, no transparent spheres, alpha cards or extra textures. */
export function createSaplingLeafGeometry(rich: boolean) {
  const positions: number[] = [], colors: number[] = [], uvs: number[] = [], indices: number[] = [];
  const shelves: Point[] = [[-.58, 2.8, -.17], [.51, 3.14, .27], [.08, 3.67, .04]];
  const count = rich ? 36 : 20;
  shelves.forEach(([cx, cy, cz], shelf) => {
    for (let i = 0; i < count; i++) {
      const angle = i * 2.399963 + shelf * 1.7;
      const level = -1 + 2 * (i + .5) / count;
      const ring = Math.sqrt(Math.max(.04, 1 - level * level));
      const centre = new THREE.Vector3(cx + Math.cos(angle) * ring * .64, cy + level * .45, cz + Math.sin(angle) * ring * .54);
      const direction = new THREE.Vector3(Math.cos(angle + .35), .15 + (i % 3) * .1, Math.sin(angle + .35)).normalize();
      const across = new THREE.Vector3(-direction.z, 0, direction.x).multiplyScalar(.1 + i % 3 * .014);
      const ridge = centre.clone(); ridge.y += .045;
      const points = [centre.clone().addScaledVector(direction, -.18), centre.clone().add(across), centre.clone().addScaledVector(direction, .23), centre.clone().sub(across), ridge];
      const offset = positions.length / 3;
      points.forEach((point, corner) => {
        positions.push(point.x, point.y, point.z);
        const light = .78 + (i % 5) * .04 + (corner === 4 ? .06 : 0);
        colors.push(light * .94, light, light * .84);
      });
      uvs.push(.5, 0, 0, .45, .5, 1, 1, .45, .5, .45);
      indices.push(...[0, 4, 1, 1, 4, 2, 2, 4, 3, 3, 4, 0].map(index => index + offset));
    }
  });
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute("normal", new THREE.Float32BufferAttribute(new Float32Array(positions.length), 3));
  geometry.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
  geometry.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices); geometry.computeVertexNormals();
  geometry.computeBoundingBox(); geometry.computeBoundingSphere();
  return geometry;
}

/** Moss follows the same stone surface: no floating shell or z-fighting overlay. */
export function createMossStoneGeometry() {
  const geometry = new THREE.IcosahedronGeometry(1, 2);
  const position = geometry.getAttribute("position") as THREE.BufferAttribute;
  const shades = new Float32Array(position.count * 3);
  const stone = new THREE.Color("#81877d"), moss = new THREE.Color("#566948"), tint = new THREE.Color();
  let floor = Infinity;
  for (let i = 0; i < position.count; i++) {
    const x = position.getX(i), y = position.getY(i), z = position.getZ(i);
    const contour = 1 + Math.sin(x * 5.7 + z * 4.3) * .075 + Math.cos(z * 7.1 - y * 3.6) * .035;
    const py = y * .53 * contour;
    position.setXYZ(i, x * contour, py, z * contour * .79); floor = Math.min(floor, py);
    const patch = .5 + .5 * Math.sin(x * 6.2 + Math.cos(z * 5.4) * 1.7);
    const cover = THREE.MathUtils.smoothstep(y, -.1, .65) * THREE.MathUtils.smoothstep(patch, .18, .72);
    tint.copy(stone).lerp(moss, cover).multiplyScalar(.77 + (y + 1) * .115);
    shades.set([tint.r, tint.g, tint.b], i * 3);
  }
  for (let i = 0; i < position.count; i++) position.setY(i, position.getY(i) - floor);
  position.needsUpdate = true;
  geometry.setAttribute("color", new THREE.Float32BufferAttribute(shades, 3));
  geometry.computeVertexNormals(); geometry.computeBoundingBox(); geometry.computeBoundingSphere();
  return geometry;
}

export function createFallenBranchGeometry() {
  const parts: THREE.BufferGeometry[] = [];
  limb(parts, [-.56, .065, -.06], [.06, .07, .045], .052);
  limb(parts, [.06, .07, .045], [.61, .04, -.025], .036);
  limb(parts, [-.06, .065, .025], [.28, .12, .36], .025, 5);
  limb(parts, [.2, .058, .025], [.41, .09, -.25], .018, 5);
  return finish(parts);
}
