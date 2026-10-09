import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

/** Four joined timber strips in one geometry/draw, replacing the old decorative panel stack. */
export function createPhotoMemoryFrame(width: number, height: number) {
  if (!Number.isFinite(width)||!Number.isFinite(height)||width<=0||height<=0||width>2.75||height>2.75) throw new RangeError("Invalid bounded photo-memory dimensions");
  const thickness = .055, depth = .042;
  const parts = [
    new THREE.BoxGeometry(width + thickness * 2, thickness, depth).translate(0,(height + thickness)/2,0),
    new THREE.BoxGeometry(width + thickness * 2, thickness, depth).translate(0,-(height + thickness)/2,0),
    new THREE.BoxGeometry(thickness, height, depth).translate((width + thickness)/2,0,0),
    new THREE.BoxGeometry(thickness, height, depth).translate(-(width + thickness)/2,0,0),
  ];
  const frame = mergeGeometries(parts,false); for (const part of parts) part.dispose();
  frame.computeBoundingBox(); frame.computeBoundingSphere(); return frame;
}
