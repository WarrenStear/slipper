import * as THREE from "three";

export function clamp01(value: number) {
  return Math.max(0, Math.min(1, value));
}

export function hashString(value: string) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash += (hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24);
  }
  return Math.abs(hash >>> 0);
}

export function seededUnit(seed: number, index: number) {
  const x = Math.sin(seed * 999 + index * 77.13) * 10000;
  return x - Math.floor(x);
}

export function fract(value: number) {
  return value - Math.floor(value);
}

export function worldSeededUnit(x: number, z: number, salt = 0) {
  return fract(Math.sin(x * 127.1 + z * 311.7 + salt * 74.7) * 43758.5453123);
}

export function valueNoise2D(x: number, z: number, salt = 0) {
  const ix = Math.floor(x);
  const iz = Math.floor(z);
  const fx = x - ix;
  const fz = z - iz;
  const smoothX = fx * fx * (3 - 2 * fx);
  const smoothZ = fz * fz * (3 - 2 * fz);
  const a = worldSeededUnit(ix, iz, salt);
  const b = worldSeededUnit(ix + 1, iz, salt);
  const c = worldSeededUnit(ix, iz + 1, salt);
  const d = worldSeededUnit(ix + 1, iz + 1, salt);
  const ab = THREE.MathUtils.lerp(a, b, smoothX);
  const cd = THREE.MathUtils.lerp(c, d, smoothX);
  return THREE.MathUtils.lerp(ab, cd, smoothZ);
}

export function ridgeMazeNoise(x: number, z: number, depth: number, memoryPressure: number) {
  const n1 = valueNoise2D(x * 0.032, z * 0.032, 2.1);
  const n2 = valueNoise2D(x * 0.071 + 19.4, z * 0.071 - 4.7, 9.8);
  const n3 = valueNoise2D(x * 0.14 - 11.2, z * 0.14 + 6.8, 21.3);
  const blended = n1 * 0.55 + n2 * 0.32 + n3 * 0.13;
  const ridge = 1 - Math.abs(blended * 2 - 1);
  const temporalPressure = depth * 0.18 + memoryPressure * 0.14;
  return clamp01(ridge + temporalPressure);
}

