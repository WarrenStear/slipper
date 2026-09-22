import { useCallback, useEffect, useMemo } from "react";
import * as THREE from "three";
import type { TerrainCurveSeed } from "../../../lib/terrainModel";
import { createPhysicalPathGeometry } from "./livingPathGeometry";
import { applyTactileShader, tactileDetailFor } from "../storyEvents/tactileShader";
import type { RenderQualityProfile } from "../renderQuality";

type Morph = { memoryPressure: number; explorationDepth: number };

/** Worn earth and broken leaf edges, never an unlit objective stripe. */
export function createPhysicalPathTexture() {
  const canvas = document.createElement("canvas"); canvas.width = 128; canvas.height = 256;
  const context = canvas.getContext("2d"); if (!context) return null;
  const random = (i: number) => { const n = Math.sin(i * 78.233 + 18.71) * 43758.5453; return n - Math.floor(n); };
  const image = context.createImageData(canvas.width, canvas.height);
  for (let y = 0; y < canvas.height; y++) for (let x = 0; x < canvas.width; x++) {
    const u = x / 127, v = y / 256, edge = Math.abs(u - .5) * 2;
    const boundary = .9 + Math.sin(v * Math.PI * 8) * .06 + Math.sin(v * Math.PI * 18) * .035;
    const shade = random(x + y * 128) * 20;
    const at = (y * 128 + x) * 4;
    image.data.set([116 + shade, 108 + shade, 89 + shade, 255 * Math.min(.64, Math.max(0, (boundary - edge) * 2.7))], at);
  }
  context.putImageData(image, 0, 0);
  for (let i = 0; i < 90; i++) {
    const x = random(i + 1000) * 128, y = random(i + 2000) * 256;
    context.fillStyle = i % 3 ? "rgba(72,81,53,.35)" : "rgba(176,157,107,.22)";
    context.beginPath(); context.ellipse(x, y, 1.3 + random(i + 9) * 2.6, .5 + random(i + 8), random(i + 7) * 6.28, 0, Math.PI * 2); context.fill();
  }
  const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.ClampToEdgeWrapping; texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(1, 8); texture.anisotropy = 4;
  return texture;
}

export function PhysicalPathRibbon({ curve, morph, sampleGroundY, qualityProfile }: {
  curve: TerrainCurveSeed | null; morph: Morph; sampleGroundY: (x: number, z: number) => number; qualityProfile: RenderQualityProfile;
}) {
  const texture = useMemo(() => typeof document === "undefined" ? null : createPhysicalPathTexture(), []);
  const geometry = useMemo(() => curve ? createPhysicalPathGeometry(curve, morph, sampleGroundY) : null, [curve, morph.memoryPressure, morph.explorationDepth, sampleGroundY]);
  const detail = tactileDetailFor(qualityProfile.quality, qualityProfile.particleMultiplier <= 0);
  const compile = useCallback((shader: Parameters<THREE.MeshStandardMaterial["onBeforeCompile"]>[0]) => applyTactileShader(shader, "earth", detail), [detail]);
  const key = useCallback(() => `sidtw-physical-path-${detail}-v1`, [detail]);
  useEffect(() => () => geometry?.dispose(), [geometry]);
  useEffect(() => () => texture?.dispose(), [texture]);
  if (!geometry || !texture) return null;
  return <mesh name="compressed-earth-path" geometry={geometry} frustumCulled receiveShadow renderOrder={1}>
    <meshStandardMaterial key={key()} map={texture} color="#aaa594" transparent opacity={.68} roughness={.86} metalness={0}
      depthWrite={false} side={THREE.DoubleSide} polygonOffset polygonOffsetFactor={-1} onBeforeCompile={compile} customProgramCacheKey={key} />
  </mesh>;
}
