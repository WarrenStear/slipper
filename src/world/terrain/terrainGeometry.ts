import * as THREE from "three";
import type { ForestWorkerResponse } from "../../workers/forestWorker.types";
import { TERRAIN_BASE_Y, TERRAIN_SEGMENTS, TERRAIN_SIZE } from "./worldConstants.ts";

export type TerrainSurface = Extract<ForestWorkerResponse, { type: "TERRAIN_READY" }>;

/** The visible mesh and Rapier indices retain the same fixed production grid. */
export function createTerrainGeometry() {
  const geometry = new THREE.PlaneGeometry(
    TERRAIN_SIZE,
    TERRAIN_SIZE,
    TERRAIN_SEGMENTS,
    TERRAIN_SEGMENTS,
  );
  geometry.rotateX(-Math.PI / 2);

  const positions = geometry.getAttribute("position") as THREE.BufferAttribute;
  for (let index = 0; index < positions.count; index += 1) {
    positions.setY(index, TERRAIN_BASE_Y);
  }
  positions.setUsage(THREE.DynamicDrawUsage);

  const colorValues = new Float32Array(positions.count * 3);
  colorValues.fill(1);
  const colors = new THREE.BufferAttribute(colorValues, 3);
  colors.setUsage(THREE.DynamicDrawUsage);
  geometry.setAttribute("color", colors);
  geometry.setAttribute("terrainHabitat", new THREE.BufferAttribute(new Float32Array(positions.count * 4), 4));
  geometry.computeVertexNormals();
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();

  return geometry;
}

export function terrainColliderIndices(geometry: THREE.BufferGeometry) {
  const index = geometry.getIndex();
  return index ? Uint32Array.from(index.array) : new Uint32Array();
}

/** Upload the worker's surface without a separate displacement or collider mesh. */
export function applyTerrainSurface(geometry: THREE.BufferGeometry, terrainSurface: TerrainSurface) {
  const positionAttribute = geometry.getAttribute("position") as THREE.BufferAttribute;
  const colorAttribute = geometry.getAttribute("color") as THREE.BufferAttribute;

  positionAttribute.array.set(terrainSurface.positions);
  colorAttribute.array.set(terrainSurface.colors);
  const habitat = geometry.getAttribute("terrainHabitat") as THREE.BufferAttribute;
  habitat.array.set(terrainSurface.habitat);
  habitat.needsUpdate = true;
  positionAttribute.needsUpdate = true;
  colorAttribute.needsUpdate = true;
  geometry.computeVertexNormals();
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
}
