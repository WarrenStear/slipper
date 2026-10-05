import * as THREE from "three";

export function createSoftMistTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 128;
  const context = canvas.getContext("2d");
  if (!context) return new THREE.CanvasTexture(canvas);

  const haze = context.createRadialGradient(128, 64, 6, 128, 64, 124);
  haze.addColorStop(0, "rgba(225, 238, 250, 0.72)");
  haze.addColorStop(0.38, "rgba(196, 216, 235, 0.34)");
  haze.addColorStop(0.74, "rgba(150, 179, 207, 0.11)");
  haze.addColorStop(1, "rgba(120, 150, 178, 0)");
  context.fillStyle = haze;
  context.fillRect(0, 0, canvas.width, canvas.height);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.needsUpdate = true;
  return texture;
}

export function createMoonShaftTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = 128;
  canvas.height = 512;
  const context = canvas.getContext("2d");
  if (!context) return new THREE.CanvasTexture(canvas);

  const vertical = context.createLinearGradient(0, 0, 0, canvas.height);
  vertical.addColorStop(0, "rgba(228, 241, 255, 0)");
  vertical.addColorStop(0.12, "rgba(220, 237, 255, 0.72)");
  vertical.addColorStop(0.68, "rgba(177, 207, 236, 0.22)");
  vertical.addColorStop(1, "rgba(152, 187, 218, 0)");
  context.fillStyle = vertical;
  context.fillRect(0, 0, canvas.width, canvas.height);

  context.globalCompositeOperation = "destination-in";
  const horizontal = context.createLinearGradient(0, 0, canvas.width, 0);
  horizontal.addColorStop(0, "rgba(255, 255, 255, 0)");
  horizontal.addColorStop(0.42, "rgba(255, 255, 255, 0.74)");
  horizontal.addColorStop(0.5, "rgba(255, 255, 255, 1)");
  horizontal.addColorStop(0.58, "rgba(255, 255, 255, 0.74)");
  horizontal.addColorStop(1, "rgba(255, 255, 255, 0)");
  context.fillStyle = horizontal;
  context.fillRect(0, 0, canvas.width, canvas.height);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.needsUpdate = true;
  return texture;
}

