import * as THREE from "three";
import { FOREST_ARCHETYPES, FOREST_REFERENCE_CROWN_HEIGHT, FOREST_REFERENCE_CROWN_SCALE, FOREST_REFERENCE_TRUNK_SCALE } from "./forestGeometry.ts";

type MorphImage = { data: Float32Array; width: number; height: number };

/** Coordinate identity survives worker-window packing and quality changes. The
 * sixteenth-metre grid also treats float worker and double local positions alike. */
export function forestArchetypeAtWorldPosition(x: number, z: number) {
  const qx = Math.round(Math.fround(x) * 16), qz = Math.round(Math.fround(z) * 16);
  let hash = Math.imul(qx, 0x1f123bb5) ^ Math.imul(qz, 0x5f356495);
  hash ^= hash >>> 15;
  hash = Math.imul(hash, 0x2c1b3c6d);
  hash ^= hash >>> 12;
  return (hash >>> 0) % FOREST_ARCHETYPES.length;
}

/** Allocate against constructor capacity, never the active count. Native
 * setMorphAt would allocate a zero-height texture during worker preparation. */
export function initializeForestMorphWeights(mesh: THREE.InstancedMesh) {
  const targets = mesh.geometry.morphAttributes.position?.length ?? 0;
  if (targets === 0) return false;
  if (targets !== FOREST_ARCHETYPES.length) throw new Error("Incomplete forest archetype library");
  const width = targets + 1, capacity = mesh.instanceMatrix.count;
  const existing = mesh.morphTexture?.source.data as MorphImage | undefined;
  if (existing?.data instanceof Float32Array && existing.width === width && existing.height === capacity
    && mesh.morphTexture?.type === THREE.FloatType) return true;
  disposeForestMorphWeights(mesh);
  const weights = new Float32Array(width * capacity);
  for (let index = 0; index < capacity; index++) weights[index * width + 1] = 1;
  mesh.morphTexture = new THREE.DataTexture(weights, width, capacity, THREE.RedFormat, THREE.FloatType);
  mesh.morphTexture.needsUpdate = true;
  return true;
}

export function setForestArchetypeAt(mesh: THREE.InstancedMesh, index: number, archetype: number) {
  if (!initializeForestMorphWeights(mesh)) return;
  if (!Number.isInteger(index) || index < 0 || index >= mesh.instanceMatrix.count
    || !Number.isInteger(archetype) || archetype < 0 || archetype >= FOREST_ARCHETYPES.length) {
    throw new RangeError("Forest archetype exceeds its instance capacity");
  }
  const image = mesh.morphTexture!.source.data as MorphImage, offset = index * image.width;
  image.data.fill(0, offset, offset + image.width);
  image.data[offset + archetype + 1] = 1;
}

export function disposeForestMorphWeights(mesh: THREE.InstancedMesh) {
  mesh.morphTexture?.dispose();
  mesh.morphTexture = null;
}

export function forestReferenceCrownTransform() {
  return new THREE.Matrix4().makeTranslation(0, FOREST_REFERENCE_CROWN_HEIGHT / FOREST_REFERENCE_TRUNK_SCALE[1] - .5, 0)
    .multiply(new THREE.Matrix4().makeScale(
      FOREST_REFERENCE_CROWN_SCALE[0] / FOREST_REFERENCE_TRUNK_SCALE[0],
      FOREST_REFERENCE_CROWN_SCALE[1] / FOREST_REFERENCE_TRUNK_SCALE[1],
      FOREST_REFERENCE_CROWN_SCALE[2] / FOREST_REFERENCE_TRUNK_SCALE[2],
    ));
}

/** Only the canopy presentation basis changes. Trunk uploads and the raw worker
 * buffers remain untouched. The shared authored anchors then meet under every
 * existing trunk width, height, heading and lean, including native shadows. */
export function applyRootedForestPresentation(trunks: THREE.InstancedMesh, crowns: THREE.InstancedMesh) {
  initializeForestMorphWeights(trunks);
  initializeForestMorphWeights(crowns);
  const trunkMatrix = new THREE.Matrix4(), crownMatrix = new THREE.Matrix4();
  const crownLocal = forestReferenceCrownTransform();
  const count = Math.min(trunks.count, crowns.count);
  for (let index = 0; index < count; index++) {
    trunks.getMatrixAt(index, trunkMatrix);
    const archetype = forestArchetypeAtWorldPosition(trunkMatrix.elements[12], trunkMatrix.elements[14]);
    setForestArchetypeAt(trunks, index, archetype);
    setForestArchetypeAt(crowns, index, archetype);
    crownMatrix.multiplyMatrices(trunkMatrix, crownLocal);
    crowns.setMatrixAt(index, crownMatrix);
  }
  if (trunks.morphTexture) trunks.morphTexture.needsUpdate = true;
  if (crowns.morphTexture) crowns.morphTexture.needsUpdate = true;
  crowns.instanceMatrix.needsUpdate = true;
  for (const mesh of [trunks, crowns]) {
    mesh.computeBoundingBox();
    mesh.computeBoundingSphere();
  }
}
