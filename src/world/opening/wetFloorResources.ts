import * as THREE from 'three';

/** The source remains owned by Drei; only this private texture view is released. */
export function createWetFloorTextureView(source: THREE.Texture) {
  const texture = source.clone();
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.needsUpdate = true;
  return texture;
}
export function createWetFloorMask(coverage: Uint8Array<ArrayBuffer>, size: number) {
  const texture = new THREE.DataTexture(coverage, size, size, THREE.RedFormat);
  texture.minFilter = texture.magFilter = THREE.LinearFilter;
  texture.unpackAlignment = 1;
  texture.needsUpdate = true;
  return texture;
}
export function createWetFloorUniforms(forest: THREE.Texture, mask: THREE.DataTexture, stage: number) {
  return { forest: { value: forest }, liveForest: { value: forest }, hasDepth: { value: 0 }, coverageMask: { value: mask }, stage: { value: stage }, time: { value: 0 }, apertureOpacity: { value: .94 } };
}
