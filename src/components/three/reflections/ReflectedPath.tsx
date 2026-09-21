import { memo, useEffect, useMemo } from "react";
import * as THREE from "three";

const HIDDEN_ROUTE = [
  [-1.65, -2.38],
  [-0.88, -1.52],
  [-1.18, -0.48],
  [-0.22, 0.38],
  [0.34, 1.42],
  [1.28, 2.34],
] as const;

function createHiddenTextTexture(text: string) {
  if (typeof document === "undefined") return null;
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 96;
  const context = canvas.getContext("2d");
  if (!context) return null;
  context.clearRect(0, 0, canvas.width, canvas.height);
  context.font = "500 28px Georgia, serif";
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.letterSpacing = "4px";
  context.fillStyle = "rgba(219, 235, 238, 0.88)";
  context.fillText(text, canvas.width / 2, canvas.height / 2);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.needsUpdate = true;
  return texture;
}

function HiddenReflectionText() {
  const texture = useMemo(() => createHiddenTextTexture("LOOK AGAIN"), []);
  useEffect(() => () => texture?.dispose(), [texture]);
  if (!texture) return null;
  return (
    <mesh name="reflection-only-hidden-text" position={[0, -2.48, 0.01]} renderOrder={6}>
      <planeGeometry args={[3.9, 0.72]} />
      <meshBasicMaterial map={texture} transparent opacity={0.76} depthWrite={false} toneMapped={false} />
    </mesh>
  );
}

export type ReflectedPathProps = {
  visible: boolean;
  still?: boolean;
  reducedEffects?: boolean;
};

/** A route and instruction that have no corresponding direct-world geometry. */
function ReflectedPathComponent({ visible, still = false, reducedEffects = false }: ReflectedPathProps) {
  if (!visible) return null;
  return (
    <group name="reflection-only-hidden-route" position={[0, 0, 0.205]}>
      {HIDDEN_ROUTE.slice(0, reducedEffects ? 4 : HIDDEN_ROUTE.length).map((point, index) => (
        <mesh key={`${point[0]}:${point[1]}`} position={[point[0], point[1], 0]} renderOrder={5}>
          <circleGeometry args={[0.085 + index * 0.008, 9]} />
          <meshBasicMaterial color={still ? "#e0eeeb" : "#9fc6cd"} transparent opacity={0.74} depthWrite={false} toneMapped={false} />
        </mesh>
      ))}
      <HiddenReflectionText />
    </group>
  );
}

export const ReflectedPath = memo(ReflectedPathComponent);
export default ReflectedPath;
