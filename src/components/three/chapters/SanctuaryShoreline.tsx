import { memo, useEffect, useLayoutEffect, useMemo, useRef, type ReactNode } from "react";
import * as THREE from "three";
import { WoodlandSurfaceMaterial } from "../environment/WoodlandSurfaceMaterial";
import { FoliageMaterial } from "../environment/FoliageMaterial";
import { createMossStoneGeometry } from "../environmentArt/woodlandAccentsGeometry";
import { createRushGeometry } from "../environmentArt/woodlandHabitatGeometry";
import { createSanctuaryShorelineGeometry } from "./sanctuaryShorelineGeometry";
import { sanctuaryShorelineLayout, type ShorelineInstance } from "./sanctuaryShorelineLayout";

function ShorelineBatch({ geometry, items, name, children }: { geometry: THREE.BufferGeometry; items: readonly ShorelineInstance[]; name: string; children: ReactNode }) {
  const ref = useRef<THREE.InstancedMesh>(null);
  useLayoutEffect(() => {
    const mesh = ref.current; if (!mesh) return;
    const transform = new THREE.Object3D();
    items.forEach((item, i) => {
      transform.position.set(...item.position); transform.scale.set(...item.scale); transform.rotation.set(0, item.yaw, 0);
      transform.updateMatrix(); mesh.setMatrixAt(i, transform.matrix);
    });
    mesh.instanceMatrix.needsUpdate = true; mesh.computeBoundingBox(); mesh.computeBoundingSphere();
  }, [items, geometry]);
  return <instancedMesh ref={ref} name={name} args={[geometry, undefined, items.length]} receiveShadow>{children}</instancedMesh>;
}

/** Four bounded batches: repeated forms upload once, without rebuilding merged
 * copies on every revisit. The centre and bridge landings remain clear. */
export const SanctuaryShoreline = memo(function SanctuaryShoreline() {
  const layout = useMemo(sanctuaryShorelineLayout, []);
  const geometry = useMemo(createSanctuaryShorelineGeometry, []);
  const stone = useMemo(createMossStoneGeometry, []), gravel = useMemo(() => createMossStoneGeometry(0), []), rush = useMemo(createRushGeometry, []);
  useEffect(() => () => { geometry.dispose(); stone.dispose(); gravel.dispose(); rush.dispose(); }, [geometry, stone, gravel, rush]);
  return <group name="sanctuary-planted-waterline" userData={{ drawCallBudget: 4 }}>
    <mesh name="sanctuary-sediment-waterline" geometry={geometry} receiveShadow><WoodlandSurfaceMaterial surface="soil" /></mesh>
    <ShorelineBatch name="sanctuary-waterworn-stones" geometry={stone} items={layout.rocks}><WoodlandSurfaceMaterial surface="stone" /></ShorelineBatch>
    <ShorelineBatch name="sanctuary-fine-gravel" geometry={gravel} items={layout.gravel}><WoodlandSurfaceMaterial surface="stone" /></ShorelineBatch>
    <ShorelineBatch name="sanctuary-bank-sedges" geometry={rush} items={layout.plants}><FoliageMaterial color="#7a9167" doubleSided /></ShorelineBatch>
  </group>;
});
