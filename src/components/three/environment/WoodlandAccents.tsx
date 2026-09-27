import { memo, useEffect, useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { TactileMaterial } from "../storyEvents/TactileMaterial";
import { FoliageMaterial } from "./FoliageMaterial";
import type { HabitatPlacement, WoodlandVariant } from "./woodlandHabitatLayout";
import { woodlandAccentsLayout, woodlandAccentTier } from "./woodlandAccentsLayout";
import { createFallenBranchGeometry, createMossStoneGeometry, createSaplingBarkGeometry, createSaplingLeafGeometry } from "../environmentArt/woodlandAccentsGeometry";

const IGNORE_RAYCAST = () => undefined;
function AccentInstances({ geometry, placements, name, finish, color }: {
  geometry: THREE.BufferGeometry; placements: readonly HabitatPlacement[]; name: string;
  finish: "bark" | "stone" | "leaves"; color: string;
}) {
  const ref = useRef<THREE.InstancedMesh>(null);
  useLayoutEffect(() => {
    const mesh = ref.current; if (!mesh) return;
    const transform = new THREE.Object3D(), tint = new THREE.Color();
    placements.forEach((item, index) => {
      transform.position.set(...item.position); transform.rotation.set(...item.rotation); transform.scale.set(...item.scale);
      transform.updateMatrix(); mesh.setMatrixAt(index, transform.matrix);
      const variation = .88 + index % 4 * .035;
      tint.setRGB(variation, variation, variation * .97); mesh.setColorAt(index, tint);
    });
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    mesh.computeBoundingBox(); mesh.computeBoundingSphere();
    // The foliage shader moves tips slightly outside their static bounds.
    if (finish === "leaves") { mesh.boundingBox?.expandByScalar(.14); if (mesh.boundingSphere) mesh.boundingSphere.radius += .14; }
  }, [geometry, placements, finish]);
  if (!placements.length) return null;
  return <instancedMesh ref={ref} name={name} args={[geometry, undefined, placements.length]} receiveShadow raycast={IGNORE_RAYCAST}>
    {finish === "leaves" ? <FoliageMaterial color={color} vertexColors doubleSided flexibility={.018} />
      : finish === "stone" ? <meshStandardMaterial color={color} vertexColors roughness={.97} metalness={0} />
        : <TactileMaterial surface="bark" barkCoordinates color={color} roughness={.96} />}
  </instancedMesh>;
}

/** Four fixed draws in woodland, two on shore. No new lights or scene-state owner. */
export const WoodlandAccents = memo(function WoodlandAccents({ variant, quality, reducedEffects }: {
  variant: WoodlandVariant; quality: string; reducedEffects: boolean;
}) {
  const shore = variant === "blue-moon";
  const rich = woodlandAccentTier(quality, reducedEffects) >= 2;
  const layout = useMemo(() => woodlandAccentsLayout(variant, quality, reducedEffects), [variant, quality, reducedEffects]);
  const shapes = useMemo(() => ({
    bark: shore ? null : createSaplingBarkGeometry(), leaves: shore ? null : createSaplingLeafGeometry(rich),
    stone: createMossStoneGeometry(), branch: createFallenBranchGeometry(),
  }), [shore, rich]);
  useEffect(() => () => { Object.values(shapes).forEach(geometry => geometry?.dispose()); }, [shapes]);
  return <group name={`${variant}-woodland-accents`} userData={{ decorativeOnly: true, drawCallBudget: shore ? 2 : 4, saplings: layout.saplings.length }}>
    {shapes.bark && shapes.leaves ? <>
      <AccentInstances name="forked-sapling-trunks" geometry={shapes.bark} placements={layout.saplings} finish="bark" color="#827361" />
      <AccentInstances name="folded-sapling-leaves" geometry={shapes.leaves} placements={layout.saplings} finish="leaves" color="#768a58" />
    </> : null}
    <AccentInstances name="moss-settled-stones" geometry={shapes.stone} placements={layout.stones} finish="stone" color="#ffffff" />
    <AccentInstances name="fallen-branch-scatter" geometry={shapes.branch} placements={layout.twigs} finish="bark" color={shore ? "#736d5d" : "#847354"} />
  </group>;
});
