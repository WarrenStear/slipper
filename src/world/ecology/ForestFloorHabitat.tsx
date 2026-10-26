import { memo, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { createFernGeometry } from "../../components/three/environmentArt/woodlandHabitatGeometry";
import { createTussockBuffers } from "../../components/three/environment/biomeGeometry";
import { FoliageMaterial } from "../../components/three/environment/FoliageMaterial";
import type { ForestClearingSeed, ForestPathSeed } from "../../workers/forestWorker.types";
import type { TerrainMorphState } from "../../lib/terrainModel";
import { forestFloorBudget, forestFloorLayout, FOREST_FLOOR_CAPACITY, type ForestFloorPlant } from "./forestFloorLayout";

function Plants({ geometry, plants, count, capacity, name, color }: { geometry: THREE.BufferGeometry; plants: ForestFloorPlant[]; count: number; capacity: number; name: string; color: string }) {
  const ref = useRef<THREE.InstancedMesh>(null);
  useLayoutEffect(() => {
    const mesh = ref.current; if (!mesh) return;
    const transform = new THREE.Object3D(), tint = new THREE.Color();
    plants.forEach((p, i) => {
      transform.position.set(p.x, p.y - .015, p.z); transform.rotation.set(0, p.yaw, 0); transform.scale.setScalar(p.scale); transform.updateMatrix();
      mesh.setMatrixAt(i, transform.matrix); tint.setHSL(.25 + p.seed * .06, .18, .65 + p.seed * .2); mesh.setColorAt(i, tint);
    });
    mesh.count = plants.length; mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    mesh.computeBoundingBox(); mesh.computeBoundingSphere();
    mesh.count = Math.min(count, plants.length);
  }, [plants, count]);
  return <instancedMesh ref={ref} args={[geometry, undefined, capacity]} name={name} receiveShadow>
    <FoliageMaterial color={color} doubleSided flexibility={.014} />
  </instancedMesh>;
}

export const ForestFloorHabitat = memo(function ForestFloorHabitat({ quality, paths, clearings, ground, morph }: {
  quality: string; paths: readonly ForestPathSeed[]; clearings: readonly ForestClearingSeed[]; ground: (x: number, z: number) => number; morph: TerrainMorphState;
}) {
  const [cell, setCell] = useState<[number, number]>([0, 0]), last = useRef("");
  useFrame(({ camera }) => {
    const x = Math.floor(camera.position.x / 4.8), z = Math.floor(camera.position.z / 4.8), key = `${x}:${z}`;
    if (key !== last.current) { last.current = key; setCell([x, z]); }
  });
  const layout = useMemo(() => forestFloorLayout(cell[0], cell[1], paths, clearings, ground, morph), [cell, paths, clearings, ground, morph]);
  const fern = useMemo(() => createFernGeometry(false), []);
  const grass = useMemo(() => {
    const data = createTussockBuffers(), geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.Float32BufferAttribute(data.positions, 3));
    geometry.setAttribute("normal", new THREE.Float32BufferAttribute(data.normals, 3));
    geometry.setIndex(data.indices); geometry.computeBoundingSphere(); return geometry;
  }, []);
  useEffect(() => () => { fern.dispose(); grass.dispose(); }, [fern, grass]);
  const budget = forestFloorBudget(quality);
  return <group name="continuous-forest-floor" userData={{ decorativeOnly: true, drawCallBudget: 2 }}>
    <Plants name="woodland-fern-colonies" geometry={fern} plants={layout.ferns} count={budget.ferns} capacity={FOREST_FLOOR_CAPACITY.ferns} color="#879459" />
    <Plants name="woodland-floor-grasses" geometry={grass} plants={layout.grass} count={budget.grass} capacity={FOREST_FLOOR_CAPACITY.grass} color="#879971" />
  </group>;
});
