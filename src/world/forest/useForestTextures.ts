import { useEffect, useMemo } from "react";
import { useTexture } from "@react-three/drei";
import * as THREE from "three";

export type ForestTexturePack = {
  barkMap: THREE.Texture;
  barkNormalMap: THREE.Texture | null;
  barkRoughnessMap: THREE.Texture | null;
  crownMap: THREE.Texture;
  crownNormalMap: THREE.Texture | null;
  crownRoughnessMap: THREE.Texture | null;
  marshMap: THREE.Texture;
  marshNormalMap: THREE.Texture | null;
  marshRoughnessMap: THREE.Texture | null;
  ruinMap: THREE.Texture;
  ruinNormalMap: THREE.Texture | null;
  ruinRoughnessMap: THREE.Texture | null;
};

export const FOREST_GROUND_ALBEDO_PATH = "/textures/forest/ground-albedo-v3.webp";

export function createSafeCanvasTexture(kind: "bark" | "crown" | "marsh" | "ruin") {
  const canvas = document.createElement("canvas");
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext("2d");

  if (ctx) {
    const palettes: Record<typeof kind, [string, string, string]> = {
      bark: ["#817b68", "#47473d", "#b0a28a"],
      crown: ["#58725a", "#354a3b", "#8ba184"],
      marsh: ["#20251f", "#101510", "#516055"],
      ruin: ["#625e56", "#302e2a", "#958b7c"],
    };
    const [base, dark, light] = palettes[kind];
    ctx.fillStyle = base;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    if (kind === "crown") {
      for (let i = 0; i < 144; i += 1) {
        const x = (i * 47) % 128;
        const y = (i * 71) % 128;
        const radius = 3 + ((i * 17) % 9);
        const gradient = ctx.createRadialGradient(
          x - radius * 0.22,
          y - radius * 0.28,
          radius * 0.08,
          x,
          y,
          radius,
        );
        gradient.addColorStop(0, i % 4 === 0 ? light : base);
        gradient.addColorStop(1, dark);
        ctx.globalAlpha = 0.1 + (i % 6) * 0.025;
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.ellipse(x, y, radius, radius * (0.68 + (i % 3) * 0.08), (i % 7) * 0.22, 0, Math.PI * 2);
        ctx.fill();
      }
    } else if (kind === "bark") {
      ctx.lineCap = "round";
      for (let i = 0; i < 52; i += 1) {
        const x = (i * 29) % 128;
        const sway = ((i * 17) % 13) - 6;
        ctx.globalAlpha = 0.12 + (i % 5) * 0.035;
        ctx.strokeStyle = i % 4 === 0 ? light : dark;
        ctx.lineWidth = 1 + (i % 4) * 0.72;
        ctx.beginPath();
        ctx.moveTo(x, -8);
        ctx.bezierCurveTo(x + sway, 34, x - sway * 0.6, 88, x + sway * 0.4, 136);
        ctx.stroke();
      }
    } else {
      for (let i = 0; i < 112; i += 1) {
        const x = (i * 37) % 128;
        const y = (i * 61) % 128;
        const w = 2 + ((i * 17) % 11);
        const h = 2 + ((i * 19) % 9);
        ctx.globalAlpha = 0.1 + (i % 7) * 0.025;
        ctx.fillStyle = i % 3 === 0 ? light : dark;
        ctx.fillRect(x, y, w, h);
      }
    }

    ctx.globalAlpha = 1;
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.anisotropy = 8;
  texture.needsUpdate = true;
  return texture;
}

export function useSafeForestTextures(): ForestTexturePack {
  const groundAlbedo = useTexture(FOREST_GROUND_ALBEDO_PATH);
  const textures = useMemo<ForestTexturePack>(
    () => ({
      barkMap: createSafeCanvasTexture("bark"),
      barkNormalMap: null,
      barkRoughnessMap: null,
      crownMap: createSafeCanvasTexture("crown"),
      crownNormalMap: null,
      crownRoughnessMap: null,
      marshMap: groundAlbedo.clone(),
      marshNormalMap: null,
      marshRoughnessMap: null,
      ruinMap: createSafeCanvasTexture("ruin"),
      ruinNormalMap: null,
      ruinRoughnessMap: null,
    }),
    [groundAlbedo],
  );

  useEffect(() => {
    textures.barkMap.repeat.set(1.4, 2.6);
    textures.crownMap.repeat.set(1.1, 1.1);
    textures.marshMap.colorSpace = THREE.SRGBColorSpace;
    textures.marshMap.wrapS = THREE.RepeatWrapping;
    textures.marshMap.wrapT = THREE.RepeatWrapping;
    textures.marshMap.anisotropy = 4;
    textures.marshMap.repeat.set(144, 144);
    textures.marshMap.needsUpdate = true;
    textures.ruinMap.repeat.set(1.8, 1.8);

    return () => {
      textures.barkMap.dispose();
      textures.crownMap.dispose();
      textures.marshMap.dispose();
      textures.ruinMap.dispose();
    };
  }, [textures]);

  return textures;
}
useTexture.preload(FOREST_GROUND_ALBEDO_PATH);
