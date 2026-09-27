import { memo, useEffect, useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { TactileMaterial } from "../storyEvents/TactileMaterial";
import { FoliageMaterial } from "./FoliageMaterial";
import { WoodlandFireflies } from "./WoodlandFireflies";
import type { HabitatPlacement, WoodlandVariant } from "./woodlandHabitatLayout";
import { woodlandAccentsLayout, woodlandAccentTier } from "./woodlandAccentsLayout";
import { createFallenBranchGeometry, createMossStoneGeometry, createSaplingBarkGeometry, createSaplingLeafGeometry } from "../environmentArt/woodlandAccentsGeometry";
import { createMushroomClusterBuffers } from "../environmentArt/woodlandGrowthBuffers";

const IGNORE_RAYCAST = () => undefined;
function AccentInstances({ geometry, placements, name, finish, color }: {
  geometry: THREE.BufferGeometry; placements: readonly HabitatPlacement[]; name: string;
  finish: "bark" | "stone" | "leaves" | "fungi"; color: string;
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
    if (finish === "leaves") { mesh.boundingBox?.expandByScalar(.14); if (mesh.boundingSphere) mesh.boundingSphere.radius += .14; }
  }, [geometry, placements, finish]);
  if (!placements.length) return null;
  return <instancedMesh ref={ref} name={name} args={[geometry, undefined, placements.length]} receiveShadow raycast={IGNORE_RAYCAST}>
    {finish === "leaves" ? <FoliageMaterial color={color} vertexColors doubleSided flexibility={.018} />
      : finish === "stone" || finish === "fungi" ? <meshStandardMaterial color={color} vertexColors roughness={finish === "fungi" ? .82 : .97} metalness={0} />
        : <TactileMaterial surface="bark" barkCoordinates color={color} roughness={.96} />}
  </instancedMesh>;
}

function mushroomGeometry(rich: boolean) {
  const data = createMushroomClusterBuffers(rich), geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(data.positions, 3));
  geometry.setAttribute("normal", new THREE.Float32BufferAttribute(data.normals, 3));
  geometry.setAttribute("color", new THREE.Float32BufferAttribute(data.colors, 3));
  geometry.setAttribute("uv", new THREE.Float32BufferAttribute(data.uvs, 2));
  geometry.setIndex(data.indices); geometry.computeBoundingBox(); geometry.computeBoundingSphere();
  return geometry;
}

/** Independent lifetimes: a leaf-detail change must not rebuild stone or bark. */
export const WoodlandAccents = memo(function WoodlandAccents({ variant, quality, reducedEffects }: {
  variant: WoodlandVariant; quality: string; reducedEffects: boolean;
}) {
  const shore = variant === "blue-moon", tier = woodlandAccentTier(quality, reducedEffects), rich = tier >= 2;
  const layout = useMemo(() => woodlandAccentsLayout(variant, quality, reducedEffects), [variant, quality, reducedEffects]);
  const bark = useMemo(() => shore ? null : createSaplingBarkGeometry(), [shore]);
  const leaves = useMemo(() => shore ? null : createSaplingLeafGeometry(rich), [shore, rich]);
  const stone = useMemo(createMossStoneGeometry, []), branch = useMemo(createFallenBranchGeometry, []);
  const fungiEnabled = tier > 0;
  const fungi = useMemo(() => fungiEnabled ? mushroomGeometry(rich) : null, [fungiEnabled, rich]);
  useEffect(() => () => bark?.dispose(), [bark]);
  useEffect(() => () => leaves?.dispose(), [leaves]);
  useEffect(() => () => stone.dispose(), [stone]);
  useEffect(() => () => branch.dispose(), [branch]);
  useEffect(() => () => fungi?.dispose(), [fungi]);
  return <group name={`${variant}-woodland-accents`} userData={{ decorativeOnly: true, drawCallBudget: (shore ? 2 : 4) + Number(fungiEnabled) + Number(!shore && rich), saplings: layout.saplings.length }}>
    {bark && leaves ? <>
      <AccentInstances name="forked-sapling-trunks" geometry={bark} placements={layout.saplings} finish="bark" color="#827361" />
      <AccentInstances name="folded-sapling-leaves" geometry={leaves} placements={layout.saplings} finish="leaves" color="#768a58" />
    </> : null}
    <AccentInstances name="moss-settled-stones" geometry={stone} placements={layout.stones} finish="stone" color="#ffffff" />
    <AccentInstances name="fallen-branch-scatter" geometry={branch} placements={layout.twigs} finish="bark" color={shore ? "#736d5d" : "#847354"} />
    {fungi ? <AccentInstances name="woodland-mushroom-clusters" geometry={fungi} placements={layout.fungi} finish="fungi" color="#ffffff" /> : null}
    {!shore ? <WoodlandFireflies quality={quality} reducedEffects={reducedEffects} /> : null}
  </group>;
});
