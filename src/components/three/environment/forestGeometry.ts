import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import type { Vector3Tuple } from "../../../data/slipper3dTypes";

type OrganicCrownLobe = {
  position: Vector3Tuple;
  rotation: Vector3Tuple;
  scale: Vector3Tuple;
  phase: number;
};

// Broad, offset leaf shelves leave air between branch ends. They share one draw
// call; the worker selects slender, spreading, and wind-shaped proportions.
const ORGANIC_CROWN_LOBES: OrganicCrownLobe[] = [
  { position: [-0.1, 0.05, 0], rotation: [0.08, 0.22, -0.1], scale: [0.92, 0.42, 0.82], phase: 0.4 },
  { position: [0.18, 0.61, -0.14], rotation: [-0.15, -0.34, 0.14], scale: [0.57, 0.44, 0.48], phase: 1.7 },
  { position: [-0.69, -0.02, 0.2], rotation: [0.12, 0.48, -0.22], scale: [0.7, 0.28, 0.57], phase: 3.1 },
  { position: [0.6, 0.23, -0.13], rotation: [-0.16, -0.42, 0.2], scale: [0.65, 0.33, 0.48], phase: 4.6 },
  { position: [-0.12, -0.12, -0.63], rotation: [0.1, 0.18, 0.16], scale: [0.57, 0.25, 0.66], phase: 6.2 },
  { position: [0.22, -0.19, 0.58], rotation: [-0.14, -0.12, -0.15], scale: [0.64, 0.23, 0.52], phase: 7.8 },
  { position: [-0.38, 0.39, 0.14], rotation: [0.16, 0.56, -0.16], scale: [0.48, 0.3, 0.46], phase: 9.4 },
];

export function createOrganicCrownGeometry(detail: 0 | 1 | 2 = 0) {
  const lobes = ORGANIC_CROWN_LOBES.map((specification, shelfIndex) => {
    // A small opaque core supports distinct folded leaves at the silhouette.
    // 140 triangles on low; 560/532 on the richer variants, still below 600.
    const geometry = new THREE.SphereGeometry(1, 5, 3);
    const position = geometry.getAttribute("position") as THREE.BufferAttribute;

    for (let index = 0; index < position.count; index += 1) {
      const x = position.getX(index);
      const y = position.getY(index);
      const z = position.getZ(index);
      const lowFrequency = Math.sin(x * 3.7 + y * 4.9 + z * 3.1 + specification.phase) * 0.115;
      const highFrequency = Math.sin(x * 8.3 - y * 6.1 + z * 7.7 + specification.phase * 1.9) * 0.048;
      const contour = 1 + lowFrequency + highFrequency;
      position.setXYZ(index, x * contour, y * contour, z * contour);
    }

    position.needsUpdate = true;
    // A radial field keeps deformed shelves softly shaded across their UV seam.
    const smoothNormals = new Float32Array(position.count * 3);
    for (let index = 0; index < position.count; index += 1) {
      const x = position.getX(index);
      const y = position.getY(index);
      const z = position.getZ(index);
      const inverseLength = 1 / Math.max(0.0001, Math.hypot(x, y, z));
      smoothNormals[index * 3] = x * inverseLength;
      smoothNormals[index * 3 + 1] = y * inverseLength;
      smoothNormals[index * 3 + 2] = z * inverseLength;
    }
    geometry.setAttribute("normal", new THREE.Float32BufferAttribute(smoothNormals, 3));
    // Soft self-occlusion is baked once, not a new screen-space pass. The
    // brighter upper leaf shelves remain distinct from their sheltered centres.
    const shades = new Float32Array(position.count * 3);
    for (let index = 0; index < position.count; index += 1) {
      const x = position.getX(index), y = position.getY(index), z = position.getZ(index);
      const sunward = THREE.MathUtils.clamp((y + 1) * .5, 0, 1);
      const dapple = Math.sin(x * 9.1 + z * 8.4 + specification.phase) * .035;
      const shade = .75 + sunward * .24 + dapple;
      shades[index * 3] = shade * (.97 + shelfIndex % 3 * .013);
      shades[index * 3 + 1] = shade;
      shades[index * 3 + 2] = shade * .94;
    }
    geometry.setAttribute("color", new THREE.Float32BufferAttribute(shades, 3));
    if (detail !== 0) {
      geometry.scale(.76, .76, .76);
      const leafPositions: number[] = [], leafUvs: number[] = [], leafColors: number[] = [], leafIndices: number[] = [];
      const leafCount = detail === 1 ? 15 : 14;
      for (let leaf = 0; leaf < leafCount; leaf++) {
        const a = leaf * 2.39996 + specification.phase;
        const y = -.72 + (leaf + .5) / leafCount * 1.44;
        const ring = Math.sqrt(Math.max(.1, 1 - y * y));
        const centre = new THREE.Vector3(Math.cos(a) * ring, y, Math.sin(a) * ring);
        const forward = new THREE.Vector3(Math.cos(a + .55), .22, Math.sin(a + .55)).normalize();
        const across = new THREE.Vector3(-forward.z, 0, forward.x).multiplyScalar(.17 + leaf % 3 * .024);
        const stem = centre.clone().addScaledVector(forward, -.29);
        const tip = centre.clone().addScaledVector(forward, .32 + leaf % 2 * .055);
        const ridge = centre.clone(); ridge.y += .075;
        const points = [stem, centre.clone().add(across), tip, centre.clone().sub(across), ridge];
        const offset = leafPositions.length / 3;
        points.forEach((point, i) => {
          leafPositions.push(point.x, point.y, point.z);
          const shade = .84 + (leaf % 4) * .04 + (i === 4 ? .04 : 0);
          leafColors.push(shade * .96, shade, shade * .9);
        });
        leafUvs.push(.5, 0, 0, .46, .5, 1, 1, .46, .5, .46);
        leafIndices.push(...[0,4,1,1,4,2,2,4,3,3,4,0].map(i => i + offset));
      }
      const leaves = new THREE.BufferGeometry();
      leaves.setAttribute("position", new THREE.Float32BufferAttribute(leafPositions, 3));
      leaves.setAttribute("uv", new THREE.Float32BufferAttribute(leafUvs, 2));
      leaves.setAttribute("color", new THREE.Float32BufferAttribute(leafColors, 3));
      leaves.setIndex(leafIndices); leaves.computeVertexNormals();
      const detailed = mergeGeometries([geometry, leaves], false);
      leaves.dispose();
      if (!detailed) throw new Error("Incompatible crown leaf attributes");
      geometry.copy(detailed); detailed.dispose();
    }
    geometry.scale(...specification.scale);
    geometry.rotateX(specification.rotation[0]);
    geometry.rotateY(specification.rotation[1]);
    geometry.rotateZ(specification.rotation[2]);
    geometry.translate(...specification.position);
    return geometry;
  });
  const merged = mergeGeometries(lobes, false);
  lobes.forEach((geometry) => geometry.dispose());

  if (!merged) return new THREE.IcosahedronGeometry(1, 1);
  merged.computeBoundingBox();
  merged.computeBoundingSphere();
  return merged;
}

export function createForestTrunkGeometry() {
  // Every tree still occupies one instanced draw call. The extra silhouette is
  // baked into this shared low-poly geometry: a tapered, furrowed bole, four
  // buttress roots, and three rising limbs. This gives nearby trees believable
  // structure without creating a mesh (or React node) per branch.
  const parts: THREE.BufferGeometry[] = [];
  const trunk = new THREE.CylinderGeometry(0.56, 1.36, 1, 10, 3, false);
  const trunkPositions = trunk.getAttribute("position") as THREE.BufferAttribute;
  for (let index = 0; index < trunkPositions.count; index += 1) {
    const x = trunkPositions.getX(index);
    const y = trunkPositions.getY(index);
    const z = trunkPositions.getZ(index);
    const angle = Math.atan2(z, x);
    const height = y + 0.5;
    const furrow = 1 + Math.sin(angle * 3 + height * 5.2) * 0.055 + Math.sin(angle * 7 - height * 3.6) * 0.048;
    const centerlineX = height * height * 0.72;
    const centerlineZ = Math.sin(height * Math.PI * 1.25) * height * 0.18;
    trunkPositions.setXYZ(index, x * furrow + centerlineX, y, z * furrow + centerlineZ);
  }
  trunkPositions.needsUpdate = true;
  trunk.computeVertexNormals();
  parts.push(trunk);

  const rootAngles = [0.18, 1.74, 3.28, 4.86];
  rootAngles.forEach((angle, rootIndex) => {
    const root = new THREE.CylinderGeometry(0.12, 0.62, 1, 6, 1, false);
    root.rotateZ(-Math.PI / 2);
    const positions = root.getAttribute("position") as THREE.BufferAttribute;
    const length = 3.5 + (rootIndex % 2) * 0.48;
    for (let index = 0; index < positions.count; index += 1) {
      const sourceX = positions.getX(index);
      const sourceY = positions.getY(index);
      const sourceZ = positions.getZ(index);
      const progress = sourceX + 0.5;
      const radial = 0.68 + progress * length;
      const width = (0.88 - progress * 0.62) * sourceZ;
      const localY = -0.492 + sourceY * 0.052 + Math.sin(progress * Math.PI) * 0.017;
      const localX = Math.cos(angle) * radial - Math.sin(angle) * width;
      const localZ = Math.sin(angle) * radial + Math.cos(angle) * width;
      positions.setXYZ(index, localX, localY, localZ);
    }
    positions.needsUpdate = true;
    root.computeVertexNormals();
    parts.push(root);
  });

  const branchSpecs = [
    { angle: 0.54, baseY: 0.05, length: 4.9, rise: 0.13 },
    { angle: 2.68, baseY: 0.16, length: 4.2, rise: 0.1 },
    { angle: 4.52, baseY: 0.27, length: 3.6, rise: 0.08 },
  ];
  branchSpecs.forEach((specification) => {
    const branch = new THREE.CylinderGeometry(0.16, 0.92, 1, 5, 2, false);
    branch.rotateZ(Math.PI / 2);
    const positions = branch.getAttribute("position") as THREE.BufferAttribute;
    for (let index = 0; index < positions.count; index += 1) {
      const sourceX = positions.getX(index);
      const sourceY = positions.getY(index);
      const sourceZ = positions.getZ(index);
      const progress = sourceX + 0.5;
      const radial = 0.46 + progress * specification.length;
      const cross = sourceZ * (0.68 - progress * 0.3);
      const localY = specification.baseY + progress * specification.rise + Math.sin(progress * Math.PI) * 0.024 + sourceY * (0.019 - progress * 0.008);
      const localX = Math.cos(specification.angle) * radial - Math.sin(specification.angle) * cross;
      const localZ = Math.sin(specification.angle) * radial + Math.cos(specification.angle) * cross;
      positions.setXYZ(index, localX, localY, localZ);
    }
    positions.needsUpdate = true;
    branch.computeVertexNormals();
    parts.push(branch);
  });

  const merged = mergeGeometries(parts, false);
  parts.forEach((geometry) => geometry.dispose());
  if (!merged) return new THREE.CylinderGeometry(0.56, 1.36, 1, 10, 3, false);
  merged.computeVertexNormals();
  merged.computeBoundingBox();
  merged.computeBoundingSphere();
  return merged;
}
