import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { createConstructionGeometry, type ConstructionPiece } from "./chapterArtGeometry.ts";

/** Closed memory-storage cases stay inside the original unit clutter collider.
 * A recessed lid joint, battens and iron carrying grips make their purpose legible
 * without changing the authored placements or the release-path choreography. */
export function createStorageCaseGeometry() {
  const pieces: ConstructionPiece[] = [
    { position: [0, -.1, 0], size: [.94, .8, .94], color: "#bbaa92" },
    { position: [0, .317, 0], size: [.89, .04, .89], color: "#675946" },
    { position: [0, .408, 0], size: [.98, .144, .98], color: "#c7b59b" },
    ...[-1, 1].flatMap(side => [
      { position: [side * .3, .49, 0] as [number, number, number], size: [.072, .02, .96] as [number, number, number], color: "#998266" },
      ...[-1, 1].map(face => ({
        position: [side * .3, -.055, face * .482] as [number, number, number],
        size: [.072, .88, .028] as [number, number, number], color: "#a58e71",
      })),
    ]),
  ];
  const wood = createConstructionGeometry(pieces);
  const hardware: THREE.BufferGeometry[] = [];
  for (const face of [-1, 1]) {
    // Two fixing plates and a recessed horizontal grip fit inside the same box.
    for (const side of [-1, 1]) {
      const plate = new THREE.BoxGeometry(.046, .1, .018);
      plate.translate(side * .105, .08, face * .48); hardware.push(plate);
    }
    const grip = new THREE.BoxGeometry(.23, .028, .027);
    grip.translate(0, .05, face * .484); hardware.push(grip);
    const catchPlate = new THREE.BoxGeometry(.045, .11, .018);
    catchPlate.translate(0, .304, face * .48); hardware.push(catchPlate);
  }
  const fittings = mergeGeometries(hardware, false)!;
  hardware.forEach(geometry => geometry.dispose());
  fittings.computeBoundingBox(); fittings.computeBoundingSphere();
  return { wood, fittings };
}
