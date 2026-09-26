import * as THREE from "three";

/** Low sediment shelves mask the rectangular water mesh without moving it.
 * The bank is only 19 cm deep, and the centre stays clear for the bridge and
 * accepted water interaction at [3.3, .08, 1.8]. No collision is introduced. */
export function createSanctuaryShorelineGeometry() {
  const positions: number[] = [], colors: number[] = [], uvs: number[] = [], indices: number[] = [];
  const wet = new THREE.Color("#444c43"), earth = new THREE.Color("#6d7056"), dry = new THREE.Color("#87846c");
  const tint = new THREE.Color();
  const segments = 36, bands = 5;
  // Each pair follows one shoreline. End shelves reach beneath the last bridge
  // boards, giving the existing deck a landfall instead of ending over water.
  for (let side = 0; side < 4; side++) {
    const offset = positions.length / 3;
    for (let i = 0; i <= segments; i++) {
      const t = i / segments;
      const envelope = Math.sin(t * Math.PI);
      const scallop = (Math.sin(t * 17 + side * 2.1) * .22 + Math.sin(t * 39 + side) * .08) * envelope;
      const inner = (side < 2 ? 9.56 : 7.48) + scallop;
      for (let row = 0; row < bands; row++) {
        const v = row / (bands - 1);
        // Mitered corners share identical vertices; shelves never overlap and
        // cannot shimmer against one another at grazing walking-camera angles.
        const along = (t * 2 - 1) * (side < 2 ? 7.48 + v * 2.4 : 9.56 + v * 2.2);
        const across = inner + v * (side < 2 ? 2.2 : 2.4);
        const x = side < 2 ? (side === 0 ? -across : across) : along;
        const z = side < 2 ? along : (side === 2 ? -across : across);
        const y = row === bands - 1 ? -.155 : .035 - v * .11 + Math.sin(t * 29 + side * 1.4) * .006 * envelope;
        positions.push(x, y, z); uvs.push(x * .35, z * .35);
        tint.copy(row < 2 ? wet : earth).lerp(row < 2 ? earth : dry, row < 2 ? v * .8 : (v - .5) * .7);
        tint.multiplyScalar(.94 + Math.sin(t * 21 + side) * .045);
        tint.toArray(colors, colors.length);
        if (i < segments && row < bands - 1) {
          const a = offset + i * bands + row, b = a + bands;
          const clockwise = side === 1 || side === 2;
          if (clockwise) indices.push(a, b, a + 1, b, b + 1, a + 1);
          else indices.push(a, a + 1, b, b, a + 1, b + 1);
        }
      }
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
  geometry.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices); geometry.computeVertexNormals();
  geometry.computeBoundingBox(); geometry.computeBoundingSphere();
  return geometry;
}
