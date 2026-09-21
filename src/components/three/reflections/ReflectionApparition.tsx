import { memo } from "react";
import { Beam } from "../chapters/ChapterPrimitives";

export type ReflectionApparitionProps = {
  apparition?: boolean;
};

/** A deliberately simple body proxy shared by the delayed self and the second presence. */
function ReflectionApparitionComponent({ apparition = false }: ReflectionApparitionProps) {
  const color = apparition ? "#17171b" : "#c1d5dc";
  const opacity = apparition ? 0.34 : 0.46;
  return (
    <group name={apparition ? "apparition-behind-player" : "delayed-player-reflection"}>
      <mesh position={[0, 1.42, 0]}>
        <sphereGeometry args={[0.22, 10, 8]} />
        <meshBasicMaterial color={color} transparent opacity={opacity} depthWrite={false} toneMapped={false} />
      </mesh>
      <mesh position={[0, 0.78, 0]}>
        <capsuleGeometry args={[0.24, 0.84, 5, 9]} />
        <meshBasicMaterial color={color} transparent opacity={opacity} depthWrite={false} toneMapped={false} />
      </mesh>
      <Beam from={[-0.17, 0.82, 0]} to={[-0.42, 0.08, 0]} radius={0.055} color={color} opacity={opacity} />
      <Beam from={[0.17, 0.82, 0]} to={[0.42, 0.08, 0]} radius={0.055} color={color} opacity={opacity} />
    </group>
  );
}

export const ReflectionApparition = memo(ReflectionApparitionComponent);
export default ReflectionApparition;
