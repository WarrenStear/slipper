import * as THREE from "three";
import type { Vector3Tuple } from "../../data/slipper3dTypes.ts";

export function anchorMoonOffsetToOpening(
  camera: THREE.Camera,
  authoredPosition: Vector3Tuple,
  distance: number,
  output: THREE.Vector3,
  right: THREE.Vector3,
  up: THREE.Vector3,
) {
  camera.getWorldDirection(output);
  right.setFromMatrixColumn(camera.matrixWorld, 0).normalize();
  up.setFromMatrixColumn(camera.matrixWorld, 1).normalize();
  const authoredHorizontalLength = Math.max(0.001, Math.hypot(authoredPosition[0], authoredPosition[2]));
  const authoredSide = THREE.MathUtils.clamp(authoredPosition[0] / authoredHorizontalLength, -1, 1);
  const authoredDepth = THREE.MathUtils.clamp(-authoredPosition[2] / authoredHorizontalLength, 0, 1);
  const aspect = camera instanceof THREE.PerspectiveCamera ? camera.aspect : 1;
  const horizontalBias = authoredSide * (aspect < 0.7 ? 0.28 : 0.5);
  const elevation =
    0.345 +
    THREE.MathUtils.clamp(authoredPosition[1] / 86, 0.035, 0.1) +
    (1 - authoredDepth) * 0.035;
  return output
    .addScaledVector(right, horizontalBias)
    .addScaledVector(up, elevation)
    .normalize()
    .multiplyScalar(distance);
}

