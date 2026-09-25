import { memo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { useSceneLook } from "../artDirection/SceneLookContext";
import * as THREE from "three";

const HIDDEN_ROUTE = [
  [-1.65, -2.38],
  [-0.88, -1.52],
  [-1.18, -0.48],
  [-0.22, 0.38],
  [0.34, 1.42],
  [1.28, 2.34],
] as const;

export type ReflectedPathProps = {
  visible: boolean;
  still?: boolean;
  truthful?: boolean;
  reducedEffects?: boolean;
};

/** A reflected route appears as the surface settles; guidance stays in accessible UI. */
function ReflectedPathComponent({ visible, still = false, truthful = false, reducedEffects = false }: ReflectedPathProps) {
  const presentation = useSceneLook();
  const route = useRef<THREE.Group>(null);
  useFrame(() => {
    if (!route.current) return;
    const clarity = presentation ? presentation.stillness : Number(still);
    for (const child of route.current.children) {
      const material = (child as THREE.Mesh).material as THREE.MeshBasicMaterial;
      if (material) material.opacity = (truthful ? .18 : .06) + clarity * .32;
    }
  });
  if (!visible) return null;
  return (
    <group ref={route} name="reflection-only-hidden-route" position={[0, 0, 0.205]}>
      {HIDDEN_ROUTE.slice(0, reducedEffects ? 4 : HIDDEN_ROUTE.length).map((point, index) => (
        <mesh key={`${point[0]}:${point[1]}`} position={[point[0], point[1], 0]} renderOrder={5}>
          <circleGeometry args={[0.034 + index * 0.003, 9]} />
          <meshBasicMaterial color={still ? "#e0eeeb" : "#9fc6cd"} transparent opacity={still ? .42 : .23} depthWrite={false} toneMapped={false} />
        </mesh>
      ))}
    </group>
  );
}

export const ReflectedPath = memo(ReflectedPathComponent);
export default ReflectedPath;
