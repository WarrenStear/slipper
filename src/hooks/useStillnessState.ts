import { useFrame } from "@react-three/fiber";
import { useRef, useState } from "react";
import * as THREE from "three";
import { useWorldStore } from "../stores/useWorldStore";
import { useSettingsStore } from "../stores/useSettingsStore";
import { advancePresentationStillness } from "../lib/presentationStillness";

export type StillnessOptions = {
  stillSpeed?: number;
  requiredSeconds?: number;
  enabled?: boolean;
  observeCamera?: boolean;
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
  const cameraPosition = useRef(new THREE.Vector3());
  const cameraRotation = useRef(new THREE.Quaternion());
  const cameraPrimed = useRef(false);

  useFrame(({ camera }, delta) => {
    const world = useWorldStore.getState();
    const current = currentPositionRef.current.set(...world.playerPosition);
    let speed = current.distanceTo(lastPositionRef.current) / Math.max(delta, 0.001);
    lastPositionRef.current.copy(current);
    const turnSpeed = options.observeCamera && cameraPrimed.current
      ? cameraRotation.current.angleTo(camera.quaternion) / Math.max(delta, .001) : 0;
    if (options.observeCamera && cameraPrimed.current) speed = Math.max(speed, camera.position.distanceTo(cameraPosition.current) / Math.max(delta, .001));
    cameraPosition.current.copy(camera.position);
    cameraRotation.current.copy(camera.quaternion);
    cameraPrimed.current = true;

    const witnessed = options.enabled !== false && !document.hidden && document.hasFocus()
      && world.mode === "explore" && !useSettingsStore.getState().drawerOpen;
    stillTimeRef.current = advancePresentationStillness(stillTimeRef.current, delta, witnessed, Boolean(world.sceneProximity?.insideClearing), speed, turnSpeed, stillSpeed);

    const nextStill = stillTimeRef.current >= requiredSeconds;
    if (published.current !== nextStill) { published.current = nextStill; setIsStill(nextStill); }
  });

  return isStill;
}
