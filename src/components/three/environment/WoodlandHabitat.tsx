import { memo, useEffect, useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { TactileMaterial, useTactileDetail } from "../storyEvents/TactileMaterial";
import { FoliageMaterial } from "./FoliageMaterial";
import { WoodlandAccents } from "./WoodlandAccents";
import { woodlandHabitatLayout, type HabitatPlacement, type WoodlandVariant } from "./woodlandHabitatLayout";
import { createDeadwoodGeometry, createFernGeometry, createLeafLitterGeometry, createRootThresholdGeometry, createRushGeometry } from "../environmentArt/woodlandHabitatGeometry";

function HabitatInstances({ geometry, placements, name, color, foliage = false, flexibility = 0 }: {
  geometry: THREE.BufferGeometry; placements: readonly HabitatPlacement[]; name: string; color: string; foliage?: boolean; flexibility?: number;
}) {
  const ref = useRef<THREE.InstancedMesh>(null);
  useLayoutEffect(() => {
    const mesh = ref.current; if (!mesh) return;
    const transform = new THREE.Object3D(), tint = new THREE.Color();
    placements.forEach((item, i) => {
      transform.position.set(...item.position); transform.rotation.set(...item.rotation); transform.scale.set(...item.scale);
      transform.updateMatrix(); mesh.setMatrixAt(i, transform.matrix);
      tint.setRGB(.84 + i % 3 * .055, .88 + i % 3 * .035, .8 + i % 4 * .04); mesh.setColorAt(i, tint);
    });
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    mesh.computeBoundingBox(); mesh.computeBoundingSphere();
  }, [geometry, placements]);
  return <instancedMesh ref={ref} name={name} args={[geometry, undefined, placements.length]} receiveShadow>
    {foliage ? <FoliageMaterial color={color} doubleSided flexibility={flexibility} /> : <TactileMaterial surface="bark" color={color} roughness={.96} side={THREE.DoubleSide} />}
  </instancedMesh>;
}

/** The original three habitat draws plus a separately bounded accent layer. */
export const WoodlandHabitat = memo(function WoodlandHabitat({ variant, quality, reducedEffects }: {
  variant: WoodlandVariant; quality: string; reducedEffects: boolean;
}) {
  const detail = useTactileDetail(), shore = variant === "blue-moon";
  const layout = useMemo(() => woodlandHabitatLayout(variant, quality, reducedEffects), [variant, quality, reducedEffects]);
  const plant = useMemo(() => shore ? createRushGeometry() : createFernGeometry(detail === "relief"), [shore, detail]);
  const litter = useMemo(createLeafLitterGeometry, []), timber = useMemo(createDeadwoodGeometry, []);
  useEffect(() => () => plant.dispose(), [plant]);
  useEffect(() => () => { litter.dispose(); timber.dispose(); }, [litter, timber]);
  return <>
    <group name={`${variant}-ground-habitat`} userData={{ decorativeOnly: true, drawCallBudget: 3 }}>
      <HabitatInstances name="clustered-forest-understory" geometry={plant} placements={layout.plants} color={shore ? "#718367" : "#6c8051"} foliage flexibility={shore ? .025 : .012} />
      <HabitatInstances name="curled-ground-leaves" geometry={litter} placements={layout.litter} color={shore ? "#615749" : "#8c7955"} />
      <HabitatInstances name="fallen-wood-at-forest-edge" geometry={timber} placements={layout.timber} color="#645d48" />
    </group>
    <WoodlandAccents variant={variant} quality={quality} reducedEffects={reducedEffects} />
  </>;
});

export const RootThreshold = memo(function RootThreshold() {
  const geometry = useMemo(createRootThresholdGeometry, []);
  useEffect(() => () => geometry.dispose(), [geometry]);
  return <mesh name="root-woven-rabbit-threshold" geometry={geometry} position={[0, -.2, 2.8]} receiveShadow>
    <TactileMaterial surface="bark" barkCoordinates color="#9b907a" roughness={.95} />
  </mesh>;
});
