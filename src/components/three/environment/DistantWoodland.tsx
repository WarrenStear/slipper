import { memo, useEffect, useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { createOrganicCrownGeometry } from "./forestGeometry";

import { distantWoodlandLayout, distantWoodlandUnit as unit } from "./distantWoodlandLayout";

export const DistantWoodland = memo(function DistantWoodland({ origin, quality, sampleGroundY, quiet = false }: {
  origin: [number, number, number]; quality: string; sampleGroundY: (x: number, z: number) => number; quiet?: boolean;
}) {
  const trunks = useRef<THREE.InstancedMesh>(null), crowns = useRef<THREE.InstancedMesh>(null);
  const count = quiet ? 16 : quality === "low" ? 40 : quality === "medium" ? 64 : 96;
  const layout = useMemo(() => distantWoodlandLayout(count), [count]);
  const detail = quality === "low" ? 0 : 1;
  const crown = useMemo(() => createOrganicCrownGeometry(detail), [detail]);
  useEffect(() => () => crown.dispose(), [crown]);
  useLayoutEffect(() => {
    if (!trunks.current || !crowns.current) return;
    const dummy = new THREE.Object3D(), tint = new THREE.Color();
    layout.forEach((tree, i) => {
      const x = origin[0] + tree.x, z = origin[2] + tree.z, ground = sampleGroundY(x, z);
      dummy.position.set(x, ground + tree.height * .5, z);
      dummy.rotation.set(.035 * Math.sin(i * 2.7), tree.yaw, .025 * Math.cos(i * 1.7));
      dummy.scale.set(tree.width, tree.height, tree.width); dummy.updateMatrix();
      trunks.current!.setMatrixAt(i, dummy.matrix);
      dummy.position.set(x + .2, ground + tree.height * .86, z);
      dummy.scale.set(tree.crown, tree.crown * (.65 + unit(i + 51) * .7), tree.crown * .86); dummy.updateMatrix();
      crowns.current!.setMatrixAt(i, dummy.matrix);
      tint.setHSL(.31 + unit(i + 41) * .03, .12, .5 + unit(i + 53) * .2); crowns.current!.setColorAt(i, tint);
    });
    for (const mesh of [trunks.current, crowns.current]) {
      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
      mesh.computeBoundingBox(); mesh.computeBoundingSphere();
    }
  }, [layout, origin, sampleGroundY, crown]);
  return <group name="world-anchored-distant-woodland" userData={{ drawCallBudget: 2, distantOnly: true }}>
    <instancedMesh ref={trunks} args={[undefined, undefined, count]}>
      <cylinderGeometry args={[.35, 1, 1, 5, 1]} />
      <meshStandardMaterial color="#505950" roughness={1} />
    </instancedMesh>
    <instancedMesh ref={crowns} args={[crown, undefined, count]}>
      <meshStandardMaterial color="#63715e" vertexColors roughness={1} />
    </instancedMesh>
  </group>;
});
