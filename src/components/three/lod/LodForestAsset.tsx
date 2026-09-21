import { Detailed, useGLTF } from "@react-three/drei";
import { memo } from "react";
import * as THREE from "three";

export type LodForestAssetProps = {
  position: [number, number, number];
  rotationY?: number;
  scale?: number;
  highSrc: string;
  lowSrc: string;
};

export const LodForestAsset = memo(function LodForestAsset({
  position,
  rotationY = 0,
  scale = 1,
  highSrc,
  lowSrc,
}: LodForestAssetProps) {
  const high = useGLTF(highSrc);
  const low = useGLTF(lowSrc);

  return (
    <group position={position} rotation-y={rotationY} scale={scale}>
      <Detailed distances={[0, 22, 55]}>
        <primitive object={high.scene.clone(true)} />
        <primitive object={low.scene.clone(true)} />
        <BillboardTreeProxy />
      </Detailed>
    </group>
  );
});

function BillboardTreeProxy() {
  return (
    <mesh frustumCulled castShadow={false} receiveShadow={false}>
      <planeGeometry args={[1.6, 4.2, 1, 1]} />
      <meshBasicMaterial color="#151a14" transparent opacity={0.72} depthWrite={false} side={THREE.DoubleSide} />
    </mesh>
  );
}
