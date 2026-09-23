import { useFrame } from "@react-three/fiber";
import { useRef, useState } from "react";
import * as THREE from "three";
import { useWorldStore } from "../stores/useWorldStore";

export type StillnessOptions = {
  stillSpeed?: number;
  requiredSeconds?: number;
  enabled?: boolean;
};

export function useStillnessState(options: StillnessOptions = {}) {
  const stillSpeed = options.stillSpeed ?? 0.025;
  const requiredSeconds = options.requiredSeconds ?? 2.4;
  const playerPosition = useWorldStore.getState().playerPosition;
  const lastPositionRef = useRef(new THREE.Vector3(...playerPosition));
  const currentPositionRef = useRef(new THREE.Vector3(...playerPosition));
  const stillTimeRef = useRef(0);
  const [isStill, setIsStill] = useState(false);
  const published = useRef(false);

  useFrame((_, delta) => {
    const world = useWorldStore.getState();
    const current = currentPositionRef.current.set(...world.playerPosition);
    const speed = current.distanceTo(lastPositionRef.current) / Math.max(delta, 0.001);
    lastPositionRef.current.copy(current);

    const witnessed = options.enabled !== false && !document.hidden && document.hasFocus()
      && Number.isFinite(delta) && delta > 0 && delta <= .25;
    if (witnessed && world.sceneProximity?.insideClearing && speed < stillSpeed) stillTimeRef.current += Math.min(delta, .05);
    else stillTimeRef.current = 0;

    const nextStill = stillTimeRef.current >= requiredSeconds;
    if (published.current !== nextStill) { published.current = nextStill; setIsStill(nextStill); }
  });

  return isStill;
}
