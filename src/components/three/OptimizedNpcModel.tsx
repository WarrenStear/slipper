import { Clone } from "@react-three/drei";
import { useMemo } from "react";
import * as THREE from "three";
import { useCompressedGLTF } from "../../lib/assets/gltfLoaders";

type OptimizedNpcModelProps = {
  kind: "wolf" | "phantom";
  position?: [number, number, number];
  rotation?: [number, number, number];
  scale?: number;
  opacity?: number;
};

const MODEL_PATHS = {
  wolf: "/models/wolf.glb",
  phantom: "/models/phantom.glb",
} as const;

export function OptimizedNpcModel({
  kind,
  position = [0, 0, 0],
  rotation = [0, 0, 0],
  scale = 1,
  opacity = 1,
}: OptimizedNpcModelProps) {
  const gltf = useCompressedGLTF(MODEL_PATHS[kind]);

  const object = useMemo(() => {
    const cloned = gltf.scene.clone(true);

    cloned.traverse((child) => {
      if (!(child instanceof THREE.Mesh)) return;

      child.frustumCulled = true;
      child.castShadow = false;
      child.receiveShadow = true;

      const material = child.material;

      if (Array.isArray(material)) {
        material.forEach((mat) => {
          mat.transparent = opacity < 1;
          mat.opacity = opacity;
        });
      } else if (material) {
        material.transparent = opacity < 1;
        material.opacity = opacity;
      }
    });

    return cloned;
  }, [gltf.scene, opacity]);

  return (
    <group position={position} rotation={rotation} scale={scale}>
      <Clone object={object} />
    </group>
  );
}
