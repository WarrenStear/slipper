import { useEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import type { WorldVisualState } from "../worldVisualState";
import type { NarrativeWorldState } from "../StoryScene";
import type { RenderQualityProfile } from "../renderQuality";
const clamp01 = (value: number) => Math.max(0, Math.min(1, value));

function createVignetteTexture() {
  const texture = new THREE.CanvasTexture(document.createElement("canvas"));
  const canvas = texture.image as HTMLCanvasElement;
  canvas.width = 512;
  canvas.height = 512;

  const ctx = canvas.getContext("2d");
  if (ctx) {
    const gradient = ctx.createRadialGradient(256, 256, 72, 256, 256, 256);
    gradient.addColorStop(0, "rgba(0,0,0,0)");
    gradient.addColorStop(0.48, "rgba(0,0,0,0)");
    gradient.addColorStop(0.72, "rgba(0,0,0,0.38)");
    gradient.addColorStop(1, "rgba(0,0,0,0.92)");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 512, 512);
  }

  texture.colorSpace = THREE.SRGBColorSpace;
  texture.needsUpdate = true;
  return texture;
}

export function CinematicFrameOverlay({
  visualState,
  narrativeWorldState,
  qualityProfile,
}: {
  visualState: WorldVisualState;
  narrativeWorldState: NarrativeWorldState;
  qualityProfile: RenderQualityProfile;
}) {
  const { camera } = useThree();
  const groupRef = useRef<THREE.Group>(null);
  const materialRef = useRef<THREE.MeshBasicMaterial>(null);
  const opacityRef = useRef(0);
  const vignetteTexture = useMemo(() => (typeof document === "undefined" ? null : createVignetteTexture()), []);

  useEffect(() => () => vignetteTexture?.dispose(), [vignetteTexture]);

  useFrame((_, delta) => {
    const group = groupRef.current;
    if (!group || !qualityProfile.enableCinematicVignette) return;

    group.position.copy(camera.position);
    group.quaternion.copy(camera.quaternion);

    const qualityLift = qualityProfile.quality === "cinematic" ? 1.08 : qualityProfile.quality === "high" ? 0.92 : 0.72;
    const targetOpacity = visualState.vignetteIntensity * qualityLift * (0.82 + clamp01(narrativeWorldState.memoryPressure) * 0.22);
    opacityRef.current = THREE.MathUtils.lerp(opacityRef.current, targetOpacity, 1 - Math.exp(-delta * 3.4));
    if (materialRef.current) materialRef.current.opacity = opacityRef.current;
  });

  if (!qualityProfile.enableCinematicVignette || !vignetteTexture) return null;

  return (
    <group ref={groupRef} renderOrder={1000}>
      <mesh position={[0, 0, -0.72]} scale={[1.84, 1.08, 1]}>
        <planeGeometry args={[1, 1, 1, 1]} />
        <meshBasicMaterial
          ref={materialRef}
          map={vignetteTexture}
          transparent
          opacity={opacityRef.current || visualState.vignetteIntensity * 0.72}
          depthTest={false}
          depthWrite={false}
          toneMapped={false}
        />
      </mesh>
    </group>
  );
}

