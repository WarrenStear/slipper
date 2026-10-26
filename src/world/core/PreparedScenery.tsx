import { useLayoutEffect, useRef, type ReactNode } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import type { Group } from "three";
import { useSceneLook } from "../../components/three/artDirection/SceneLookContext";
import { prepareStreamedScenery, queueSceneryPreparation } from "./sceneryPreparation";

/** Only nearby scenery waits; active story objects and inputs remain immediate. */
export function PreparedScenery({ children, active }: { children: ReactNode; active: boolean }) {
  const ref = useRef<Group>(null), { scene } = useThree();
  useLayoutEffect(() => {
    if (!ref.current || active) return;
    return queueSceneryPreparation(scene, ref.current);
  }, [scene, active]);
  return <group ref={ref}>{children}</group>;
}

/** Low/medium draw directly; high/cinematic drain inside their beauty target. */
export function SceneryPreparationDriver() {
  const presentation = useSceneLook();
  useFrame(({ gl, scene, camera }) => {
    if (!presentation?.look.budget.edgeSmoothing) prepareStreamedScenery(gl, scene, camera, performance.now());
  });
  return null;
}
