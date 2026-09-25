import { memo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Group, Mesh, MeshStandardMaterial } from "three";
import { useSceneLook } from "../artDirection/SceneLookContext";
import { Beam, WaterSurface } from "../chapters/ChapterPrimitives";

export type WaterMemoryReflectionProps = {
  truthful?: boolean;
  still?: boolean;
  reducedEffects?: boolean;
};

const ROUTE_POINTS = [
  [-2.9, -4.6],
  [-1.7, -2.9],
  [-2.25, -1.1],
  [-0.8, 0.45],
  [-1.15, 2.25],
  [0.1, 4.2],
] as const;

/** The submerged line is absent from the physical path and only legible in water. */
function WaterMemoryReflectionComponent({
  truthful = false,
  still = false,
  reducedEffects = false,
}: WaterMemoryReflectionProps) {
  const presentation = useSceneLook();
  const route = useRef<Group>(null);
  const visiblePoints = ROUTE_POINTS.slice(0, reducedEffects ? 4 : ROUTE_POINTS.length);
  const opacity = truthful ? .3 : .1;
  useFrame(() => {
    const clarity = presentation ? presentation.stillness : Number(still);
    // Beam owns a single mesh. Update just this bounded route, not the scene.
    for (const child of route.current?.children ?? []) {
      const material = (child as Mesh).material as MeshStandardMaterial;
      if (material) material.opacity = opacity + clarity * .35;
    }
  });

  return (
    <group name="water-memory-reflection" position={[0, 0.015, 0.6]}>
      <WaterSurface position={[0, 0, 0]} size={[17, 13]} color="#111921" opacity={0.82} roughness={.38} />
      <group ref={route} name="reflection-only-water-route" position={[0, 0.035, 0]}>
        {visiblePoints.slice(0, -1).map((point, index) => {
          const next = visiblePoints[index + 1];
          return (
            <Beam
              key={`${point[0]}:${point[1]}`}
              from={[point[0], 0, point[1]]}
              to={[next[0], 0, next[1]]}
              radius={0.027}
              color="#91b6c5"
              opacity={opacity}
            />
          );
        })}
      </group>
    </group>
  );
}

export const WaterMemoryReflection = memo(WaterMemoryReflectionComponent);
export default WaterMemoryReflection;
