import { useFrame } from "@react-three/fiber";
import { useRef, useState } from "react";
import * as THREE from "three";
import { useWorldStore } from "../stores/useWorldStore";

export type StillnessOptions = {
  stillSpeed?: number;
  requiredSeconds?: number;
};

export function useStillnessState(options: StillnessOptions = {}) {
  const stillSpeed = options.stillSpeed ?? 0.025;
  const requiredSeconds = options.requiredSeconds ?? 2.4;
  const playerPosition = useWorldStore((state) => state.playerPosition);
  const insideClearing = useWorldStore((state) => state.sceneProximity?.insideClearing ?? false);
  const lastPositionRef = useRef(new THREE.Vector3(...playerPosition));
  const currentPositionRef = useRef(new THREE.Vector3(...playerPosition));
  const stillTimeRef = useRef(0);
  const [isStill, setIsStill] = useState(false);

  useFrame((_, delta) => {
    const current = currentPositionRef.current.set(...playerPosition);
    const speed = current.distanceTo(lastPositionRef.current) / Math.max(delta, 0.001);
    lastPositionRef.current.copy(current);

    if (insideClearing && speed < stillSpeed) stillTimeRef.current += delta;
    else stillTimeRef.current = 0;

    const nextStill = stillTimeRef.current >= requiredSeconds;
    setIsStill((previous) => (previous === nextStill ? previous : nextStill));
  });

  return isStill;
}
