import type { Vector3Tuple } from "../../data/slipper3dTypes";
import "./MiniMapCompass.css";

export type MiniMapCompassProps = {
  playerPosition: Vector3Tuple;
  cameraYaw: number;
  targetPosition: Vector3Tuple | null;
  isLost: boolean;
};

export function MiniMapCompass({ playerPosition, cameraYaw, targetPosition, isLost }: MiniMapCompassProps) {
  if (!isLost || !targetPosition) return null;

  const dx = targetPosition[0] - playerPosition[0];
  const dz = targetPosition[2] - playerPosition[2];
  const worldAngle = Math.atan2(dx, dz);
  const needleAngle = worldAngle - cameraYaw;

  return (
    <div className="mini-map-compass" aria-label="The wood is pointing you onward">
      <div className="mini-map-compass__needle" style={{ transform: `rotate(${needleAngle}rad)` }} />
      <div className="mini-map-compass__whisper">the path remembers</div>
    </div>
  );
}
