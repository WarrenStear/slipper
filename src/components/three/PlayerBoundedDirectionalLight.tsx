import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";
import { useWorldStore } from "../../stores/useWorldStore";

type PlayerBoundedDirectionalLightProps = {
  size?: number;
  height?: number;
  intensity?: number;
  mapSize?: number;
};

export function PlayerBoundedDirectionalLight({
  size = 20,
  height = 18,
  intensity = 2.4,
  mapSize = 2048,
}: PlayerBoundedDirectionalLightProps) {
  const lightRef = useRef<THREE.DirectionalLight>(null);
  const target = useMemo(() => new THREE.Object3D(), []);
  const playerPosition = useWorldStore((state) => state.playerPosition);

  useFrame(() => {
    const light = lightRef.current;
    if (!light) return;

    const [x, y, z] = playerPosition;
    const halfSize = size / 2;

    target.position.set(x, y + 0.75, z);
    light.target = target;
    light.position.set(x - 8, y + height, z + 7);

    const shadowCamera = light.shadow.camera as THREE.OrthographicCamera;
    shadowCamera.left = -halfSize;
    shadowCamera.right = halfSize;
    shadowCamera.top = halfSize;
    shadowCamera.bottom = -halfSize;
    shadowCamera.near = 0.5;
    shadowCamera.far = height + 42;
    shadowCamera.updateProjectionMatrix();
  });

  return (
    <>
      <primitive object={target} />
      <directionalLight
        ref={lightRef}
        castShadow
        intensity={intensity}
        shadow-mapSize={[mapSize, mapSize]}
        shadow-bias={-0.00035}
        shadow-normalBias={0.025}
        shadow-camera-left={-size / 2}
        shadow-camera-right={size / 2}
        shadow-camera-top={size / 2}
        shadow-camera-bottom={-size / 2}
        shadow-camera-near={0.5}
        shadow-camera-far={height + 42}
      />
    </>
  );
}
