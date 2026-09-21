import { useFrame, useThree } from "@react-three/fiber";
import { type RefObject, useMemo, useRef } from "react";
import * as THREE from "three";

export type ShadowCullingOptions = {
  shadowRadius?: number;
  forwardDistance?: number;
  updateEveryFrames?: number;
  mobile?: boolean;
};

export function usePlayerShadowCulling(
  shadowRootRef: RefObject<THREE.Group>,
  lightRef: RefObject<THREE.DirectionalLight>,
  options: ShadowCullingOptions = {},
) {
  const { camera } = useThree();
  const frameRef = useRef(0);

  const config = {
    shadowRadius: options.shadowRadius ?? 22,
    forwardDistance: options.forwardDistance ?? 12,
    updateEveryFrames: options.updateEveryFrames ?? 8,
    mobile: options.mobile ?? false,
  };

  const temp = useMemo(
    () => ({
      forward: new THREE.Vector3(),
      center: new THREE.Vector3(),
      objectWorld: new THREE.Vector3(),
      cameraProjection: new THREE.Matrix4(),
      frustum: new THREE.Frustum(),
    }),
    [],
  );

  useFrame(() => {
    frameRef.current += 1;
    if (frameRef.current % config.updateEveryFrames !== 0) return;

    const shadowRoot = shadowRootRef.current;
    const light = lightRef.current;
    if (!shadowRoot || !light) return;

    camera.getWorldDirection(temp.forward);
    temp.center.copy(camera.position).addScaledVector(temp.forward, config.forwardDistance);
    updateShadowCamera(light, temp.center, config.mobile);

    temp.cameraProjection.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
    temp.frustum.setFromProjectionMatrix(temp.cameraProjection);

    shadowRoot.traverse((object) => {
      const mesh = object as THREE.Mesh;
      if (!mesh.isMesh) return;

      mesh.getWorldPosition(temp.objectWorld);
      const distance = temp.objectWorld.distanceTo(camera.position);
      mesh.castShadow = distance <= config.shadowRadius && temp.frustum.containsPoint(temp.objectWorld);
    });
  });
}

function updateShadowCamera(light: THREE.DirectionalLight, center: THREE.Vector3, mobile: boolean) {
  const shadowCamera = light.shadow.camera as THREE.OrthographicCamera;
  const extent = mobile ? 12 : 18;
  const far = mobile ? 38 : 58;

  light.target.position.copy(center);
  light.target.updateMatrixWorld();

  shadowCamera.left = -extent;
  shadowCamera.right = extent;
  shadowCamera.top = extent;
  shadowCamera.bottom = -extent;
  shadowCamera.near = 0.5;
  shadowCamera.far = far;
  shadowCamera.updateProjectionMatrix();

  light.shadow.mapSize.set(mobile ? 512 : 1024, mobile ? 512 : 1024);
  light.shadow.needsUpdate = true;
}
