import { useEffect, useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import type { Slipper3DEntry } from "../../data/slipper3dTypes.ts";
import { type RenderQualityProfile } from "../../components/three/renderQuality.ts";
import { type MazePathSegment } from "../terrain/worldPaths.ts";
import { type NarrativeWorldState } from "../worldTypes.ts";
import { guidedPathSegment } from "./routeGeometry.ts";
import { applyPathUnderstoryShader, createPathUnderstoryBuffers, createPathUnderstoryInstances, UNDERSTORY_CAPACITY, type PathUnderstoryInstance } from "./pathUnderstoryHabitat.ts";

export function createPathUnderstoryGeometry() {
  const buffers = createPathUnderstoryBuffers(), geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(buffers.positions, 3));
  geometry.setAttribute("color", new THREE.Float32BufferAttribute(buffers.colors, 3));
  geometry.setAttribute("understoryForm", new THREE.Float32BufferAttribute(buffers.forms, 1));
  geometry.computeVertexNormals(); geometry.computeBoundingBox(); geometry.computeBoundingSphere();
  return geometry;
}

const decorativeRaycast = () => {};
const shaderKey = () => "sidtw-path-floor-habitat-v1";

export function uploadPathUnderstoryHabitat(geometry: THREE.BufferGeometry, instances: PathUnderstoryInstance[]) {
  const arrays = {
    understoryWeightsA: new Float32Array(UNDERSTORY_CAPACITY * 4),
    understoryWeightsB: new Float32Array(UNDERSTORY_CAPACITY * 3),
    understoryLeaf: new Float32Array(UNDERSTORY_CAPACITY * 3),
    understoryFlower: new Float32Array(UNDERSTORY_CAPACITY * 3),
    understoryEarth: new Float32Array(UNDERSTORY_CAPACITY * 3),
    understoryWood: new Float32Array(UNDERSTORY_CAPACITY * 3),
  };
  for (const [index, instance] of instances.slice(0, UNDERSTORY_CAPACITY).entries()) {
    const { weights, palette } = instance.habitat;
    arrays.understoryWeightsA.set(weights.slice(0, 4), index * 4);
    arrays.understoryWeightsB.set(weights.slice(4), index * 3);
    arrays.understoryLeaf.set(palette.leaf, index * 3);
    arrays.understoryFlower.set(palette.flower, index * 3);
    arrays.understoryEarth.set(palette.earth, index * 3);
    arrays.understoryWood.set(palette.wood, index * 3);
  }
  for (const [name, array] of Object.entries(arrays)) {
    const size = name === "understoryWeightsA" ? 4 : 3;
    const previous = geometry.getAttribute(name) as THREE.InstancedBufferAttribute | undefined;
    if (previous?.array.length === array.length) { previous.array.set(array); previous.needsUpdate = true; }
    else geometry.setAttribute(name, new THREE.InstancedBufferAttribute(array, size));
  }
}

export function MoonlitPathUnderstory({ pathSegments, activeEntry, navigationTargetId, narrativeWorldState, qualityProfile, sampleGroundY }: {
  pathSegments: MazePathSegment[]; activeEntry: Slipper3DEntry; navigationTargetId: string | null;
  narrativeWorldState: NarrativeWorldState; qualityProfile: RenderQualityProfile; sampleGroundY: (x: number, z: number) => number;
}) {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const geometry = useMemo(createPathUnderstoryGeometry, []);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const instances = useMemo(() => {
    const segment = guidedPathSegment(pathSegments, activeEntry.id, navigationTargetId);
    return segment ? createPathUnderstoryInstances(segment, qualityProfile.quality, {
      memoryPressure: narrativeWorldState.memoryPressure, explorationDepth: narrativeWorldState.explorationDepth,
    }, sampleGroundY) : [];
  }, [activeEntry.id, navigationTargetId, pathSegments, qualityProfile.quality, narrativeWorldState.memoryPressure,
    narrativeWorldState.explorationDepth, sampleGroundY]);
  useLayoutEffect(() => {
    const mesh = meshRef.current;
    if (!mesh) return;
    uploadPathUnderstoryHabitat(geometry, instances);
    for (const [index, instance] of instances.entries()) {
      dummy.position.set(...instance.position); dummy.rotation.set(...instance.rotation); dummy.scale.set(...instance.scale);
      dummy.updateMatrix(); mesh.setMatrixAt(index, dummy.matrix);
    }
    mesh.count = instances.length; mesh.instanceMatrix.needsUpdate = true;
    mesh.computeBoundingBox(); mesh.computeBoundingSphere();
  }, [dummy, geometry, instances]);
  useEffect(() => () => geometry.dispose(), [geometry]);
  if (!instances.length) return null;
  return <instancedMesh name="contextual-path-understory" ref={meshRef} args={[geometry, undefined, instances.length]}
    frustumCulled receiveShadow renderOrder={2} raycast={decorativeRaycast} userData={{ decorativeOnly: true }}>
    <meshStandardMaterial vertexColors color="#ffffff" roughness={.94} metalness={0} side={THREE.DoubleSide}
      onBeforeCompile={applyPathUnderstoryShader} customProgramCacheKey={shaderKey} />
  </instancedMesh>;
}
